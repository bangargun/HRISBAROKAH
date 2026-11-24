import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { businessDateString, parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { PublishDto, SaveWeeklyQuizDto } from './training.dto';
import { questionRows, targetEmployeesWhere } from './training.shared';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Kuis mingguan dari sisi admin: terkunci setelah diterbitkan. */
@Injectable()
export class WeeklyQuizzesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const quizzes = await this.prisma.weeklyQuiz.findMany({
      include: { _count: { select: { questions: true, attempts: true } } },
      orderBy: { weekStart: 'desc' },
      take: 200,
    });
    const avg = await this.prisma.weeklyQuizAttempt.groupBy({ by: ['quizId'], _avg: { score: true } });
    const avgBy = new Map(avg.map((a) => [a.quizId, a._avg.score]));
    return Promise.all(
      quizzes.map(async (q) => ({
        ...q,
        questionCount: q._count.questions,
        attemptCount: q._count.attempts,
        averageScore: avgBy.get(q.id) === undefined || avgBy.get(q.id) === null ? null : Math.round(avgBy.get(q.id)!),
        targetCount: await this.prisma.employeeProfile.count({ where: targetEmployeesWhere(q.targetPositionIds) }),
      })),
    );
  }

  async detail(id: string) {
    const q = await this.prisma.weeklyQuiz.findUnique({ where: { id }, include: { questions: { orderBy: { order: 'asc' } } } });
    if (!q) throw new NotFoundException('Kuis tidak ditemukan');
    return q;
  }

  async create(actor: AuthUser, dto: SaveWeeklyQuizDto) {
    const dates = this.dates(dto);
    return this.prisma.weeklyQuiz.create({
      data: {
        title: dto.title,
        ...dates,
        passingScore: dto.passingScore ?? 80,
        targetPositionIds: dto.targetPositionIds ?? [],
        createdById: actor.id,
        questions: { create: questionRows(dto.questions ?? []) },
      },
    });
  }

  async update(id: string, dto: SaveWeeklyQuizDto) {
    const current = await this.detail(id);
    if (current.isPublished) throw new BadRequestException('Kuis yang sudah terbit tidak bisa diubah');
    const dates = this.dates(dto);
    return this.prisma.$transaction(async (tx) => {
      if (dto.questions) {
        await tx.trainingQuestion.deleteMany({ where: { weeklyQuizId: id } });
        await tx.trainingQuestion.createMany({ data: questionRows(dto.questions).map((q) => ({ ...q, weeklyQuizId: id })) });
      }
      return tx.weeklyQuiz.update({
        where: { id },
        data: { title: dto.title, ...dates, passingScore: dto.passingScore ?? 80, targetPositionIds: dto.targetPositionIds ?? [] },
      });
    });
  }

  /** Terbit mengunci kuis; kuis terbit tidak bisa ditarik kembali agar nilai kru tetap adil. */
  async publish(id: string, dto: PublishDto) {
    const q = await this.detail(id);
    if (!dto.isPublished) throw new BadRequestException('Kuis yang sudah terbit tidak bisa ditarik kembali');
    if (q.isPublished) return q;
    if (q.questions.length === 0) throw new BadRequestException('Tambahkan soal sebelum kuis diterbitkan');
    return this.prisma.weeklyQuiz.update({ where: { id }, data: { isPublished: true } });
  }

  async remove(id: string) {
    const q = await this.detail(id);
    if (q.isPublished) throw new BadRequestException('Kuis yang sudah terbit tidak bisa dihapus');
    await this.prisma.weeklyQuiz.delete({ where: { id } });
    return { ok: true };
  }

  /** Nilai per kru sasaran: dikerjakan / belum / tidak mengerjakan (lewat tenggat), dan rata-rata per cabang. */
  async results(actor: AuthUser, id: string, outletId?: string) {
    const q = await this.detail(id);
    const scoped = scopedOutletId(actor, outletId);
    const closed = ymd(q.deadline) < businessDateString();
    const employees = await this.prisma.employeeProfile.findMany({
      where: {
        OR: [targetEmployeesWhere(q.targetPositionIds, scoped), { weeklyQuizAttempts: { some: { quizId: id } }, ...(scoped && { outletId: scoped }) }],
      },
      select: {
        id: true,
        fullName: true,
        nik: true,
        outlet: { select: { id: true, name: true } },
        position: { select: { title: true } },
        weeklyQuizAttempts: { where: { quizId: id }, select: { score: true, passed: true, submittedAt: true } },
      },
      orderBy: { fullName: 'asc' },
    });
    const rows = employees.map(({ weeklyQuizAttempts, ...e }) => {
      const attempt = weeklyQuizAttempts[0] ?? null;
      return { ...e, attempt, state: attempt ? 'DONE' : closed ? 'MISSED' : 'PENDING' };
    });
    const byOutlet = new Map<string, { outletName: string; total: number; done: number; sum: number }>();
    for (const r of rows) {
      const o = byOutlet.get(r.outlet.id) ?? { outletName: r.outlet.name, total: 0, done: 0, sum: 0 };
      o.total++;
      if (r.attempt) {
        o.done++;
        o.sum += r.attempt.score;
      }
      byOutlet.set(r.outlet.id, o);
    }
    return {
      quiz: { id: q.id, title: q.title, deadline: ymd(q.deadline), passingScore: q.passingScore, closed },
      rows,
      outlets: [...byOutlet.values()].map((o) => ({
        outletName: o.outletName,
        total: o.total,
        done: o.done,
        averageScore: o.done ? Math.round(o.sum / o.done) : null,
      })),
    };
  }

  private dates(dto: SaveWeeklyQuizDto) {
    const start = parseDateParam(dto.weekStart);
    const deadline = parseDateParam(dto.deadline);
    if (deadline < start) throw new BadRequestException('Tenggat tidak boleh sebelum tanggal mulai');
    return { weekStart: toDateOnly(start), deadline: toDateOnly(deadline) };
  }
}
