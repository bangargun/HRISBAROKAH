import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SurveyRespondentRole, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, assertOutletAccess } from '../../common/utils/outlet-scope.util';
import { businessDateString, toDateOnly } from '../../common/utils/business-date.util';
import { payrollPeriod } from '../payroll/payroll.calculator';
import { SURVEY_360_QUESTIONS } from './survey360.questions';
import { SubmitSurvey360Dto } from './survey360.dto';

// Survei dibuka H-7 sampai H-3 sebelum tanggal tutup buku cabang
const OPEN_DAYS_BEFORE = 7;
const CLOSE_DAYS_BEFORE = 3;

const addDays = (ymd: string, n: number) => new Date(toDateOnly(ymd).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** Periode gaji yang memuat hari ini, beserta jendela survei 360° periode itu. */
export function surveyWindow(cutoffDay: number, today = businessDateString()) {
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  let period = payrollPeriod(year, month, cutoffDay);
  if (today > period.end) {
    month = month === 12 ? 1 : month + 1;
    year = month === 1 ? year + 1 : year;
    period = payrollPeriod(year, month, cutoffDay);
  }
  const from = addDays(period.end, -OPEN_DAYS_BEFORE);
  const to = addDays(period.end, -CLOSE_DAYS_BEFORE);
  return { year, month, period, from, to, open: today >= from && today <= to };
}

@Injectable()
export class Survey360Service {
  constructor(private prisma: PrismaService) {}

  questions() {
    return SURVEY_360_QUESTIONS;
  }

  /** Untuk aplikasi HP: jendela survei dan rekan satu cabang yang bisa dinilai. */
  async mine(userId: string) {
    const me = await this.respondent(userId);
    const window = surveyWindow(me.outlet.payrollCutoffDay);
    const [colleagues, given] = await Promise.all([
      this.prisma.employeeProfile.findMany({
        where: { outletId: me.outletId, id: { not: me.id }, user: { isActive: true } },
        select: { id: true, fullName: true, position: { select: { title: true } } },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.survey360Response.findMany({
        where: { respondentId: me.id, periodYear: window.year, periodMonth: window.month },
        select: { targetId: true },
      }),
    ]);
    const done = new Set(given.map((g) => g.targetId));
    return {
      ...window,
      targets: colleagues.map((c) => ({ ...c, done: done.has(c.id) })),
    };
  }

  async submit(userId: string, dto: SubmitSurvey360Dto) {
    const me = await this.respondent(userId);
    if (dto.targetId === me.id) throw new BadRequestException('Anda tidak bisa menilai diri sendiri');
    const target = await this.prisma.employeeProfile.findUnique({ where: { id: dto.targetId }, include: { user: true } });
    if (!target || !target.user.isActive || target.outletId !== me.outletId) {
      throw new BadRequestException('Hanya rekan aktif di cabang yang sama yang bisa dinilai');
    }
    const window = surveyWindow(me.outlet.payrollCutoffDay);
    if (!window.open) {
      throw new BadRequestException(`Survei periode ini dibuka ${window.from} sampai ${window.to}`);
    }
    try {
      return await this.prisma.survey360Response.create({
        data: {
          periodYear: window.year,
          periodMonth: window.month,
          outletId: me.outletId,
          targetId: target.id,
          respondentId: me.id,
          respondentRole: me.user.role === UserRole.STORE_MANAGER ? SurveyRespondentRole.MANAGER : SurveyRespondentRole.PEER,
          answers: dto.answers,
          average: Math.round((dto.answers.reduce((n, a) => n + a, 0) / dto.answers.length) * 100) / 100,
          comment: dto.comment || null,
        },
        select: { id: true, targetId: true, average: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Anda sudah menilai ${target.fullName} periode ini`);
      }
      throw e;
    }
  }

  /** Rekap per karyawan untuk admin: rata-rata, jumlah penilai, rata-rata per pertanyaan, komentar anonim. */
  async results(actor: AuthUser, outletId: string, year: number, month: number) {
    assertOutletAccess(actor, outletId, 'Anda hanya bisa melihat hasil survei cabang Anda');
    const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) throw new NotFoundException('Cabang tidak ditemukan');
    const [employees, responses] = await Promise.all([
      this.prisma.employeeProfile.findMany({
        where: { outletId, user: { isActive: true } },
        select: { id: true, fullName: true, position: { select: { title: true } } },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.survey360Response.findMany({
        where: { outletId, periodYear: year, periodMonth: month },
        select: { targetId: true, respondentRole: true, answers: true, average: true, comment: true },
      }),
    ]);
    const window = surveyWindow(outlet.payrollCutoffDay, payrollPeriod(year, month, outlet.payrollCutoffDay).end);
    return {
      period: window.period,
      window: { from: window.from, to: window.to },
      questions: SURVEY_360_QUESTIONS,
      rows: employees.map((e) => {
        const mine = responses.filter((r) => r.targetId === e.id);
        const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((n, x) => n + x, 0) / xs.length) * 100) / 100 : null);
        return {
          employee: e,
          responses: mine.length,
          managerResponses: mine.filter((r) => r.respondentRole === SurveyRespondentRole.MANAGER).length,
          average: avg(mine.map((r) => r.average)),
          perQuestion: SURVEY_360_QUESTIONS.map((_, i) => avg(mine.map((r) => r.answers[i]))),
          // Tanpa nama penilai agar tetap anonim
          comments: mine.map((r) => r.comment).filter((c): c is string => !!c),
        };
      }),
    };
  }

  private async respondent(userId: string) {
    const me = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: { outlet: true, user: true },
    });
    if (!me) throw new ForbiddenException('Akun ini tidak terhubung ke data karyawan');
    return me;
  }
}
