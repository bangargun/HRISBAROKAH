import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CorrectionStatus, CorrectionType, PayrollStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { businessDateTime, businessToday, monthDateRange, parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { AttendanceService } from './attendance.service';
import { CreateCorrectionDto, DecideCorrectionDto } from './corrections.dto';

// SOP-HR-008: mulai koreksi ke-3 dalam sebulan, uang makan hari itu hangus
export const CORRECTION_MONTHLY_LIMIT = 3;

const INCLUDE = {
  employee: { select: { id: true, fullName: true, nik: true, outlet: { select: { id: true, name: true } } } },
  createdBy: { select: { username: true, profile: { select: { fullName: true } } } },
  decidedBy: { select: { username: true, profile: { select: { fullName: true } } } },
} satisfies Prisma.AttendanceCorrectionInclude;

@Injectable()
export class CorrectionsService {
  constructor(
    private prisma: PrismaService,
    private attendance: AttendanceService,
    private notifications: NotificationsService,
  ) {}

  /** Koreksi per bulan (default bulan ini), terbaru dulu, dengan urutan ke-N koreksi karyawan di bulan itu. */
  async list(actor: AuthUser, month?: string, outletId?: string) {
    outletId = scopedOutletId(actor, outletId);
    const [year, mon] = (month ?? businessToday().toISOString().slice(0, 7)).split('-').map(Number);
    if (!year || !mon || mon < 1 || mon > 12) throw new BadRequestException('Bulan harus berformat YYYY-MM');
    const { first, last } = monthDateRange(year, mon);
    const rows = await this.prisma.attendanceCorrection.findMany({
      where: { date: { gte: first, lte: last }, ...(outletId && { employee: { outletId } }) },
      include: INCLUDE,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    // Urutan dihitung dari koreksi yang tidak ditolak
    const seen = new Map<string, number>();
    const withCount = rows.map((r) => {
      if (r.status === CorrectionStatus.REJECTED) return { ...r, monthlyCount: null };
      const n = (seen.get(r.employeeId) ?? 0) + 1;
      seen.set(r.employeeId, n);
      return { ...r, monthlyCount: n, overLimit: n >= CORRECTION_MONTHLY_LIMIT };
    });
    return withCount.reverse();
  }

  async create(actor: AuthUser, dto: CreateCorrectionDto) {
    const employee = await this.prisma.employeeProfile.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan');
    assertOutletAccess(actor, employee.outletId, 'Anda hanya bisa mengajukan koreksi untuk karyawan di cabang Anda');

    const date = toDateOnly(parseDateParam(dto.date));
    if (date > businessToday()) throw new BadRequestException('Tanggal koreksi tidak boleh di masa depan');

    const duplicate = await this.prisma.attendanceCorrection.findFirst({
      where: { employeeId: employee.id, date, status: { not: CorrectionStatus.REJECTED } },
    });
    if (duplicate) throw new ConflictException('Sudah ada koreksi untuk karyawan ini di tanggal tersebut');

    await this.assertApplicable(employee.id, date, dto.type);
    const created = await this.prisma.attendanceCorrection.create({
      data: {
        employeeId: employee.id,
        date,
        type: dto.type,
        clockIn: dto.type === CorrectionType.BOTH ? dto.clockIn : null,
        clockOut: dto.clockOut,
        witness: dto.witness || null,
        reason: dto.reason,
        createdById: actor.id,
      },
      include: INCLUDE,
    });
    this.notifications.fire(() => this.notifications.correctionCreated(created.id));
    return created;
  }

  /** Setujui (absen hari itu dilengkapi) atau tolak. Hanya koreksi yang masih menunggu. */
  async decide(actor: AuthUser, id: string, dto: DecideCorrectionDto) {
    const correction = await this.prisma.attendanceCorrection.findUnique({
      where: { id },
      include: { employee: { include: { outlet: true } } },
    });
    if (!correction) throw new NotFoundException('Koreksi tidak ditemukan');
    if (correction.status !== CorrectionStatus.PENDING) {
      throw new ConflictException('Koreksi ini sudah diputuskan');
    }

    const decided = { decidedById: actor.id, decidedAt: new Date(), decisionNote: dto.note || null };
    if (dto.decision === 'REJECTED') {
      return this.transition(id, { status: CorrectionStatus.REJECTED, ...decided });
    }

    const { employee, date, type } = correction;
    const ymd = date.toISOString().slice(0, 10);
    const existing = await this.assertApplicable(employee.id, date, type);

    const clockIn = type === CorrectionType.BOTH ? businessDateTime(ymd, correction.clockIn!) : existing!.clockInTime!;
    let clockOut = businessDateTime(ymd, correction.clockOut);
    // Jam pulang sebelum jam masuk berarti pulang lewat tengah malam
    if (clockOut <= clockIn) clockOut = new Date(clockOut.getTime() + 24 * 60 * 60_000);
    const note = `Koreksi presensi (${type === CorrectionType.BOTH ? 'lupa absen masuk & pulang' : 'lupa absen pulang'})`;

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.transition(id, { status: CorrectionStatus.APPROVED, ...decided }, tx);
      if (type === CorrectionType.CLOCK_OUT) {
        await tx.attendance.update({
          where: { id: existing!.id },
          data: { clockOutTime: clockOut, notes: [existing!.notes, note].filter(Boolean).join(' | ') },
        });
      } else {
        const punctuality = await this.attendance.punctuality(employee.id, employee.outlet, date, clockIn);
        const data = { clockInTime: clockIn, clockOutTime: clockOut, ...punctuality, notes: note };
        if (existing) {
          await tx.attendance.update({ where: { id: existing.id }, data });
        } else {
          await tx.attendance.create({ data: { employeeId: employee.id, outletId: employee.outletId, date, ...data } });
        }
      }
      return updated;
    });
  }

  /** Perubahan status atomik: gagal bila koreksi sudah diputuskan oleh orang lain. */
  private async transition(id: string, data: Prisma.AttendanceCorrectionUncheckedUpdateInput, tx: Prisma.TransactionClient = this.prisma) {
    const { count } = await tx.attendanceCorrection.updateMany({
      where: { id, status: CorrectionStatus.PENDING },
      data,
    });
    if (count === 0) throw new ConflictException('Koreksi ini sudah diputuskan');
    return tx.attendanceCorrection.findUnique({ where: { id }, include: INCLUDE });
  }

  /**
   * Koreksi hanya masuk akal bila absen hari itu cocok dengan jenisnya, dan
   * gaji periode itu belum difinalkan. Mengembalikan absen yang ada (bila ada).
   */
  private async assertApplicable(employeeId: string, date: Date, type: CorrectionType) {
    const locked = await this.prisma.payroll.findFirst({
      where: { employeeId, status: PayrollStatus.FINALIZED, periodStart: { lte: date }, periodEnd: { gte: date } },
    });
    if (locked) throw new BadRequestException('Gaji periode tanggal ini sudah difinalkan, presensinya tidak bisa dikoreksi');

    const existing = await this.prisma.attendance.findFirst({ where: { employeeId, date } });
    if (type === CorrectionType.CLOCK_OUT) {
      if (!existing?.clockInTime) throw new BadRequestException('Belum ada absen masuk di tanggal ini. Pilih "Lupa absen masuk & pulang".');
      if (existing.clockOutTime) throw new BadRequestException('Absen pulang di tanggal ini sudah tercatat');
    } else if (existing?.clockInTime) {
      throw new BadRequestException('Sudah ada absen masuk di tanggal ini. Pilih "Lupa absen pulang".');
    }
    return existing;
  }
}
