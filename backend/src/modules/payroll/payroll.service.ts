import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PayrollStatus, RequestStatus, RequestType, ExitStatus, ExitType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { businessDateString, businessDateTime, toDateOnly } from '../../common/utils/business-date.util';
import { PayrollRules, calculatePayroll, payrollPeriod } from './payroll.calculator';
import { PayrollPeriodDto, UpdatePayrollSettingsDto } from './payroll.dto';

const SETTINGS_ID = 'default';
const LEAVE_TYPES: RequestType[] = [
  RequestType.CUTI_TAHUNAN,
  RequestType.CUTI_KHUSUS,
  RequestType.IZIN,
  RequestType.SAKIT,
];
const ymd = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    return this.toRules(await this.settingsRow());
  }

  async updateSettings(actorId: string, dto: UpdatePayrollSettingsDto) {
    await this.settingsRow();
    const row = await this.prisma.payrollSetting.update({
      where: { id: SETTINGS_ID },
      data: { ...dto, updatedById: actorId },
    });
    return this.toRules(row);
  }

  async list(dto: PayrollPeriodDto) {
    const outlet = await this.outletOrThrow(dto.outletId);
    const rows = await this.prisma.payroll.findMany({
      where: { outletId: dto.outletId, periodYear: dto.year, periodMonth: dto.month },
      include: { employee: { select: { id: true, nik: true, fullName: true, position: { select: { title: true } } } } },
      orderBy: { employee: { fullName: 'asc' } },
    });
    // Gaji yang sudah dihitung memakai periode saat itu, walau tanggal tutup buku kemudian diubah
    const period = rows.length
      ? { start: ymd(rows[0].periodStart), end: ymd(rows[0].periodEnd) }
      : payrollPeriod(dto.year, dto.month, outlet.payrollCutoffDay);
    return { outlet: { id: outlet.id, name: outlet.name, payrollCutoffDay: outlet.payrollCutoffDay }, period, rows };
  }

  /** Slip gaji karyawan yang login: 12 periode terakhir yang sudah difinalkan (draf tidak ditampilkan). */
  async myPayslips(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil karyawan tidak ditemukan');
    const rows = await this.prisma.payroll.findMany({
      where: { employeeId: profile.id, status: PayrollStatus.FINALIZED },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      take: 12,
      include: { outlet: { select: { name: true } } },
    });
    return rows.map(({ kasbonAllocations, finalizedById, payslipPdfUrl, ...r }) => ({
      ...r,
      periodStart: ymd(r.periodStart),
      periodEnd: ymd(r.periodEnd),
    }));
  }

  /** Membuat (ulang) draf gaji semua karyawan aktif cabang untuk periode itu. */
  async generate(dto: PayrollPeriodDto) {
    const outlet = await this.outletOrThrow(dto.outletId);
    const period = payrollPeriod(dto.year, dto.month, outlet.payrollCutoffDay);
    const today = businessDateString();
    if (period.start > today) {
      throw new BadRequestException(`Periode ${period.start} s.d. ${period.end} belum dimulai`);
    }

    const where = { outletId: outlet.id, periodYear: dto.year, periodMonth: dto.month };
    if (await this.prisma.payroll.count({ where: { ...where, status: PayrollStatus.FINALIZED } })) {
      throw new ConflictException('Gaji periode ini sudah difinalkan dan tidak bisa dihitung ulang');
    }

    const start = toDateOnly(period.start);
    const end = toDateOnly(period.end);
    const exitInPeriod = { status: { not: ExitStatus.CANCELLED }, lastWorkingDate: { gte: start, lte: end } };
    const employees = await this.prisma.employeeProfile.findMany({
      // Karyawan aktif, plus yang hari terakhir kerjanya jatuh di periode ini (sudah atau belum ditutup HR)
      where: {
        outletId: outlet.id,
        joinDate: { lte: businessDateTime(period.end, '23:59') },
        OR: [{ user: { isActive: true } }, { exits: { some: { ...exitInPeriod } } }],
      },
      select: {
        id: true,
        fullName: true,
        joinDate: true,
        exits: { where: exitInPeriod, orderBy: { lastWorkingDate: 'asc' }, take: 1, select: { type: true, lastWorkingDate: true } },
      },
    });
    const ids = employees.map((e) => e.id);

    // Karyawan yang gajinya bulan ini sudah difinalkan di cabang lain (pindah cabang) dilewati
    const finalizedElsewhere = new Set(
      (
        await this.prisma.payroll.findMany({
          where: { employeeId: { in: ids }, periodYear: dto.year, periodMonth: dto.month, NOT: { outletId: outlet.id } },
          select: { employeeId: true },
        })
      ).map((p) => p.employeeId),
    );

    const [rules, attendance, schedules, leaves, kasbons] = await Promise.all([
      this.getSettings(),
      this.prisma.attendance.findMany({
        where: { employeeId: { in: ids }, date: { gte: start, lte: end }, clockInTime: { not: null } },
        select: { employeeId: true, date: true, lateMinutes: true },
      }),
      this.prisma.shiftSchedule.findMany({
        where: { employeeId: { in: ids }, date: { gte: start, lte: end } },
        select: { employeeId: true, date: true },
      }),
      this.prisma.employeeRequest.findMany({
        where: {
          employeeId: { in: ids },
          status: RequestStatus.APPROVED,
          type: { in: LEAVE_TYPES },
          startDate: { lte: businessDateTime(period.end, '23:59') },
          OR: [{ endDate: { gte: start } }, { endDate: null, startDate: { gte: start } }],
        },
        select: { employeeId: true, type: true, startDate: true, endDate: true },
      }),
      this.prisma.kasbonLoan.findMany({
        where: {
          employeeId: { in: ids },
          isFullyPaid: false,
          remainingAmount: { gt: 0 },
          disbursedAt: { not: null, lte: businessDateTime(period.end, '23:59') },
          request: { status: RequestStatus.DISBURSED },
        },
        orderBy: { disbursedAt: 'asc' },
        select: { id: true, employeeId: true, monthlyDeduction: true, remainingAmount: true },
      }),
    ]);

    const group = <T extends { employeeId: string }>(rows: T[]) => {
      const map = new Map<string, T[]>();
      for (const r of rows) map.set(r.employeeId, [...(map.get(r.employeeId) ?? []), r]);
      return map;
    };
    const attendanceBy = group(attendance);
    const schedulesBy = group(schedules);
    const leavesBy = group(leaves);
    const kasbonsBy = group(kasbons);

    const data: Prisma.PayrollCreateManyInput[] = [];
    for (const e of employees) {
      if (finalizedElsewhere.has(e.id)) continue;
      // Mengundurkan diri: gaji periode terakhir tidak dibayar (kesepakatan). PHK: prorata sampai hari terakhir.
      const exit = e.exits[0];
      if (exit?.type === ExitType.RESIGN) continue;
      const r = calculatePayroll(rules, {
        joinDate: ymd(e.joinDate),
        endDate: exit ? ymd(exit.lastWorkingDate) : null,
        period,
        today,
        attendance: (attendanceBy.get(e.id) ?? []).map((a) => ({ date: ymd(a.date), lateMinutes: a.lateMinutes })),
        scheduledDates: (schedulesBy.get(e.id) ?? []).map((s) => ymd(s.date)),
        approvedLeaves: (leavesBy.get(e.id) ?? [])
          .filter((l) => l.startDate)
          .map((l) => ({
            type: l.type,
            start: businessDateString(l.startDate!),
            end: businessDateString(l.endDate ?? l.startDate!),
          })),
        kasbons: (kasbonsBy.get(e.id) ?? []).map((k) => ({
          id: k.id,
          monthlyDeduction: Number(k.monthlyDeduction),
          remainingAmount: Number(k.remainingAmount),
        })),
      });
      const { kasbonAllocations, ...amounts } = r;
      data.push({
        ...amounts,
        employeeId: e.id,
        outletId: outlet.id,
        periodYear: dto.year,
        periodMonth: dto.month,
        periodStart: start,
        periodEnd: end,
        kasbonAllocations,
      });
    }

    await this.prisma.$transaction([
      this.prisma.payroll.deleteMany({ where: { ...where, status: PayrollStatus.DRAFT } }),
      // Draf lama karyawan yang kini pindah cabang juga diganti
      this.prisma.payroll.deleteMany({
        where: { employeeId: { in: ids }, periodYear: dto.year, periodMonth: dto.month, status: PayrollStatus.DRAFT },
      }),
      this.prisma.payroll.createMany({ data }),
    ]);

    return { ...(await this.list(dto)), skipped: employees.filter((e) => finalizedElsewhere.has(e.id)).map((e) => e.fullName) };
  }

  /** Mengunci draf dan mencatat cicilan kasbon. */
  async finalize(actorId: string, dto: PayrollPeriodDto) {
    const where = { outletId: dto.outletId, periodYear: dto.year, periodMonth: dto.month };
    await this.prisma.$transaction(async (tx) => {
      const drafts = await tx.payroll.findMany({ where: { ...where, status: PayrollStatus.DRAFT } });
      if (drafts.length === 0) throw new ConflictException('Tidak ada draf gaji yang bisa difinalkan untuk periode ini');

      const locked = await tx.payroll.updateMany({
        where: { id: { in: drafts.map((d) => d.id) }, status: PayrollStatus.DRAFT },
        data: { status: PayrollStatus.FINALIZED, finalizedAt: new Date(), finalizedById: actorId },
      });
      if (locked.count !== drafts.length) throw new ConflictException('Draf berubah saat difinalkan. Muat ulang lalu coba lagi.');

      for (const d of drafts) {
        for (const a of d.kasbonAllocations as { kasbonId: string; amount: number }[]) {
          const paid = await tx.kasbonLoan.updateMany({
            where: { id: a.kasbonId, isFullyPaid: false, remainingAmount: { gte: a.amount } },
            data: { remainingAmount: { decrement: a.amount } },
          });
          if (paid.count === 0) {
            throw new ConflictException('Sisa kasbon sudah berubah sejak draf dihitung. Hitung ulang gaji lalu finalkan.');
          }
          await tx.kasbonDeductionHistory.create({
            data: { kasbonLoanId: a.kasbonId, payrollId: d.id, amountDeducted: a.amount },
          });
        }
      }
      await tx.kasbonLoan.updateMany({ where: { isFullyPaid: false, remainingAmount: { lte: 0 } }, data: { isFullyPaid: true } });
    });
    return this.list(dto);
  }

  async markPaid(dto: PayrollPeriodDto) {
    const where = { outletId: dto.outletId, periodYear: dto.year, periodMonth: dto.month };
    if (await this.prisma.payroll.count({ where: { ...where, status: PayrollStatus.DRAFT } })) {
      throw new ConflictException('Masih ada draf. Finalkan gaji sebelum menandai sudah dibayar.');
    }
    const res = await this.prisma.payroll.updateMany({
      where: { ...where, status: PayrollStatus.FINALIZED, isPaid: false },
      data: { isPaid: true, paidAt: new Date() },
    });
    if (res.count === 0) throw new ConflictException('Tidak ada gaji final yang belum dibayar untuk periode ini');
    return this.list(dto);
  }

  private async outletOrThrow(id: string) {
    const outlet = await this.prisma.outlet.findUnique({ where: { id } });
    if (!outlet) throw new NotFoundException('Cabang tidak ditemukan');
    return outlet;
  }

  private async settingsRow() {
    return this.prisma.payrollSetting.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID }, update: {} });
  }

  private toRules(row: Awaited<ReturnType<PayrollService['settingsRow']>>): PayrollRules & { updatedAt: Date } {
    return {
      basicSalaryProbation: Number(row.basicSalaryProbation),
      basicSalaryRegular: Number(row.basicSalaryRegular),
      probationMonths: row.probationMonths,
      mealAllowancePerDay: Number(row.mealAllowancePerDay),
      latePenaltyPerMinute: Number(row.latePenaltyPerMinute),
      tenureAllowanceMonth7: Number(row.tenureAllowanceMonth7),
      tenureAllowanceMonth13: Number(row.tenureAllowanceMonth13),
      tenureAllowanceMonth19: Number(row.tenureAllowanceMonth19),
      tenureAllowanceStep: Number(row.tenureAllowanceStep),
      kasbonMaxPercent: row.kasbonMaxPercent,
      updatedAt: row.updatedAt,
    };
  }
}
