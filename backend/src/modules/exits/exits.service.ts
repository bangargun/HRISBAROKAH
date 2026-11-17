import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExitReason, ExitStatus, ExitType, PayrollStatus, Prisma, RequestStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { businessToday, parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { CreateExitDto, UpdateExitDto } from './exits.dto';

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN];
const HR_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN];

const RESIGN_REASONS: ExitReason[] = [
  ExitReason.CAREER_OPPORTUNITY,
  ExitReason.FAMILY_DOMICILE,
  ExitReason.WORKLOAD_PHYSICAL,
  ExitReason.WORK_ENVIRONMENT,
  ExitReason.HEALTH,
  ExitReason.WALKOUT,
  ExitReason.OTHER,
];
const TERMINATION_REASONS: ExitReason[] = [
  ExitReason.MISCONDUCT,
  ExitReason.PERFORMANCE,
  ExitReason.CONTRACT_END,
  ExitReason.RESTRUCTURING,
  ExitReason.HEALTH,
  ExitReason.OTHER,
];

const INCLUDE = {
  employee: {
    select: {
      id: true,
      fullName: true,
      nik: true,
      joinDate: true,
      outlet: { select: { id: true, name: true } },
      position: { select: { title: true } },
      user: { select: { role: true, isActive: true } },
    },
  },
  createdBy: { select: { username: true, profile: { select: { fullName: true } } } },
  closedBy: { select: { username: true, profile: { select: { fullName: true } } } },
} satisfies Prisma.EmployeeExitInclude;

type ExitRow = Prisma.EmployeeExitGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class ExitsService {
  constructor(private prisma: PrismaService) {}

  async list(actor: AuthUser, outletId?: string) {
    outletId = scopedOutletId(actor, outletId);
    const rows = await this.prisma.employeeExit.findMany({
      where: outletId ? { employee: { outletId } } : {},
      include: INCLUDE,
      orderBy: [{ status: 'asc' }, { lastWorkingDate: 'desc' }],
    });
    return this.withKasbon(rows);
  }

  async create(actor: AuthUser, dto: CreateExitDto) {
    const employee = await this.prisma.employeeProfile.findUnique({ where: { id: dto.employeeId }, include: { user: true } });
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan');
    assertOutletAccess(actor, employee.outletId, 'Anda hanya bisa mencatat karyawan di cabang Anda');
    if (!employee.user.isActive) throw new BadRequestException(`${employee.fullName} sudah nonaktif`);
    if (dto.type === ExitType.TERMINATION && !HR_ROLES.includes(actor.role)) {
      throw new ForbiddenException('PHK hanya bisa dicatat oleh HR atau Super Admin');
    }
    this.assertCanManage(actor, employee.user.role);
    if (employee.userId === actor.id) throw new ForbiddenException('Anda tidak bisa mencatat diri sendiri keluar');

    const open = await this.prisma.employeeExit.findFirst({ where: { employeeId: employee.id, status: ExitStatus.OPEN } });
    if (open) throw new ConflictException(`${employee.fullName} sudah punya proses keluar yang berjalan`);

    const submittedDate = toDateOnly(parseDateParam(dto.submittedDate));
    if (submittedDate > businessToday()) throw new BadRequestException('Tanggal pengajuan tidak boleh di masa depan');
    const lastWorkingDate = await this.validLastDay(employee, dto.lastWorkingDate, submittedDate);
    this.assertReason(dto.type, dto.reason, dto.notice);

    const row = await this.prisma.employeeExit.create({
      data: {
        employeeId: employee.id,
        type: dto.type,
        submittedDate,
        lastWorkingDate,
        notice: dto.type === ExitType.RESIGN ? dto.notice : null,
        reason: dto.reason,
        reasonNotes: dto.reasonNotes,
        rehire: dto.rehire,
        createdById: actor.id,
      },
      include: INCLUDE,
    });
    return (await this.withKasbon([row]))[0];
  }

  async update(actor: AuthUser, id: string, dto: UpdateExitDto) {
    const exit = await this.getOpen(actor, id);
    const employee = await this.prisma.employeeProfile.findUniqueOrThrow({ where: { id: exit.employeeId } });
    const lastWorkingDate = dto.lastWorkingDate
      ? await this.validLastDay(employee, dto.lastWorkingDate, exit.submittedDate)
      : undefined;
    if (dto.reason || dto.notice) this.assertReason(exit.type, dto.reason ?? exit.reason, dto.notice ?? exit.notice ?? undefined);

    const touchesInterview = [
      dto.interviewNotes,
      dto.ratingLeadership,
      dto.ratingSchedule,
      dto.ratingTeam,
      dto.ratingTraining,
      dto.improvementSuggestion,
      dto.wouldRecommend,
    ].some((v) => v !== undefined);

    const row = await this.prisma.employeeExit.update({
      where: { id },
      data: {
        ...dto,
        lastWorkingDate,
        notice: exit.type === ExitType.RESIGN ? dto.notice : undefined,
        ...(touchesInterview && !exit.interviewedAt && { interviewedAt: new Date() }),
      },
      include: INCLUDE,
    });
    return (await this.withKasbon([row]))[0];
  }

  /** Menutup proses keluar: akun dinonaktifkan dan tanggal keluar dicatat. */
  async complete(actor: AuthUser, id: string) {
    const exit = await this.getOpen(actor, id);
    if (exit.lastWorkingDate > businessToday()) {
      throw new BadRequestException('Proses keluar baru bisa ditutup mulai hari terakhir kerja');
    }
    const missing = [!exit.uniformReturned && 'seragam', !exit.lockerCleared && 'loker & ID card'].filter(Boolean);
    if (missing.length) throw new BadRequestException(`Serah terima belum lengkap: ${missing.join(', ')}`);

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.employeeExit.updateMany({
        where: { id, status: ExitStatus.OPEN },
        data: { status: ExitStatus.COMPLETED, closedById: actor.id, closedAt: new Date() },
      });
      if (count === 0) throw new ConflictException('Proses keluar ini sudah ditutup');
      const profile = await tx.employeeProfile.update({
        where: { id: exit.employeeId },
        data: { endDate: exit.lastWorkingDate },
      });
      await tx.user.update({ where: { id: profile.userId }, data: { isActive: false } });
      await tx.outlet.updateMany({ where: { managerId: exit.employeeId }, data: { managerId: null } });
      return tx.employeeExit.findUnique({ where: { id }, include: INCLUDE });
    });
  }

  async cancel(actor: AuthUser, id: string) {
    await this.getOpen(actor, id);
    const { count } = await this.prisma.employeeExit.updateMany({
      where: { id, status: ExitStatus.OPEN },
      data: { status: ExitStatus.CANCELLED, closedById: actor.id, closedAt: new Date() },
    });
    if (count === 0) throw new ConflictException('Proses keluar ini sudah ditutup');
    return this.prisma.employeeExit.findUnique({ where: { id }, include: INCLUDE });
  }

  private async getOpen(actor: AuthUser, id: string) {
    const exit = await this.prisma.employeeExit.findUnique({ where: { id }, include: INCLUDE });
    if (!exit) throw new NotFoundException('Data keluar tidak ditemukan');
    assertOutletAccess(actor, exit.employee.outlet.id, 'Anda hanya bisa mengubah data karyawan di cabang Anda');
    this.assertCanManage(actor, exit.employee.user.role);
    if (exit.status !== ExitStatus.OPEN) throw new ConflictException('Proses keluar ini sudah ditutup');
    return exit;
  }

  /** Hari terakhir kerja: tidak sebelum tanggal masuk/pengajuan, dan tidak di periode gaji yang sudah difinalkan. */
  private async validLastDay(employee: { id: string; joinDate: Date }, value: string, submittedDate: Date) {
    const lastDay = toDateOnly(parseDateParam(value));
    if (lastDay < submittedDate) throw new BadRequestException('Hari terakhir kerja tidak boleh sebelum tanggal pengajuan');
    if (lastDay < toDateOnly(employee.joinDate.toISOString().slice(0, 10))) {
      throw new BadRequestException('Hari terakhir kerja tidak boleh sebelum tanggal masuk');
    }
    const locked = await this.prisma.payroll.findFirst({
      where: { employeeId: employee.id, status: PayrollStatus.FINALIZED, periodEnd: { gte: lastDay } },
    });
    if (locked) {
      throw new BadRequestException('Gaji periode hari terakhir kerja ini sudah difinalkan. Pilih tanggal setelah periode tersebut.');
    }
    return lastDay;
  }

  private assertReason(type: ExitType, reason: ExitReason, notice?: ResignNoticeLike) {
    const allowed = type === ExitType.RESIGN ? RESIGN_REASONS : TERMINATION_REASONS;
    if (!allowed.includes(reason)) throw new BadRequestException('Alasan tidak sesuai dengan jenis keluar');
    if (type === ExitType.RESIGN && !notice) throw new BadRequestException('Pilih status pemberitahuan pengunduran diri');
  }

  private assertCanManage(actor: AuthUser, role: UserRole) {
    if (ADMIN_ROLES.includes(role) && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Hanya Super Admin yang bisa memproses akun admin');
    }
  }

  /** Sisa kasbon yang belum lunas, untuk diselesaikan saat serah terima. */
  private async withKasbon(rows: ExitRow[]) {
    const ids = Array.from(new Set(rows.map((r) => r.employeeId)));
    const loans = ids.length
      ? await this.prisma.kasbonLoan.groupBy({
          by: ['employeeId'],
          where: { employeeId: { in: ids }, isFullyPaid: false, request: { status: RequestStatus.DISBURSED } },
          _sum: { remainingAmount: true },
        })
      : [];
    const remaining = new Map(loans.map((l) => [l.employeeId, Number(l._sum.remainingAmount ?? 0)]));
    return rows.map((r) => ({ ...r, kasbonRemaining: remaining.get(r.employeeId) ?? 0 }));
  }
}

type ResignNoticeLike = string | null | undefined;
