import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AttendanceEventStatus, AttendanceSource, KioskEventType, KioskMethod, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { rm } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { FaceEnrollmentService } from '../face/face-enrollment.service';
import { DecodedPhoto, UPLOADS_ROOT, decodePhoto, saveAttendancePhoto } from '../../common/utils/attendance-photo.util';
import { businessDateString, toDateOnly } from '../../common/utils/business-date.util';
import { AttemptLimiter } from './attempt-limiter';
import { DeviceContext } from './device-auth.guard';
import { KioskEventDto, KioskEventsDto } from './kiosk.dto';
import {
  DayState,
  FLAG_BREAK_AUTO_CLOSED,
  FLAG_CLOCK_CHANGED,
  FLAG_FACE_REVIEW,
  FLAG_GUEST,
  FLAG_NO_FACE,
  FLAG_OFFLINE,
  FLAG_PENDING_REVIEW,
  FLAG_PIN,
  FLAG_UNSCHEDULED,
  OPEN_ATTENDANCE_MAX_MS,
  checkTransition,
  clockChanged,
  effectiveTime,
  inFuture,
  wasOffline,
} from './kiosk.rules';

export const REASON_WRONG_PIN = 'PIN salah';
const REASON_EMPLOYEE_NOT_FOUND = 'Karyawan tidak ditemukan';
const REASON_BAD_PHOTO = 'Foto absen tidak valid';
export const REASON_INACTIVE = 'Karyawan nonaktif';

// Tanda yang membuat event tetap diterapkan tetapi menunggu tinjauan HR
const REVIEW_FLAGS: Record<string, string> = {
  [FLAG_CLOCK_CHANGED]: 'Jam tablet berubah',
  [FLAG_FACE_REVIEW]: 'Wajah tidak cocok',
  [FLAG_NO_FACE]: 'Belum daftar wajah',
  [FLAG_UNSCHEDULED]: 'Tidak terjadwal di cabang ini',
  [FLAG_PIN]: 'Absen dengan PIN',
};

// 10 kegagalan per tablet per 10 menit, terpisah untuk identify dan PIN
const LIMIT_FAILURES = 10;
const LIMIT_WINDOW_MS = 10 * 60_000;

export interface EventResult {
  id: string;
  status: AttendanceEventStatus;
  reason: string | null;
}

type Tx = Prisma.TransactionClient;

interface ClockInContext {
  date: Date;
  punctuality: Awaited<ReturnType<AttendanceService['punctuality']>>;
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Menerapkan event absen dari tablet tepat sekali. Id event (dari tablet) adalah kunci
 * primer AttendanceEvent: kiriman ulang mengembalikan hasil yang tersimpan.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly limiter = new AttemptLimiter(LIMIT_FAILURES, LIMIT_WINDOW_MS);

  constructor(
    private prisma: PrismaService,
    private attendance: AttendanceService,
    private faceEnrollment: FaceEnrollmentService,
  ) {}

  /**
   * Hasil dikembalikan sesuai urutan kiriman. Dua jenis kegagalan dibedakan:
   * - kesalahan event itu sendiri yang akan sama setiap kali dikirim (mis. foto tidak bisa
   *   dibaca) -> disimpan NEEDS_REVIEW, tidak diterapkan, dijawab (lihat applyOne);
   * - error server/infrastruktur (DB putus, timeout transaksi, disk) dan jatah PIN habis ->
   *   tidak ikut di `results`; tablet tetap mengantre dan mengirim ulang (aman: idempoten).
   */
  async ingest(device: DeviceContext, dto: KioskEventsDto): Promise<{ results: EventResult[] }> {
    const receivedAt = new Date();
    // Selisih jam sekarang: yang diukur tablet tepat sebelum batch (GET /kiosk/time) bila ada.
    // deviceNow dicap sebelum unggahan; unggahan lambat (foto, Nginx menampung body) membuat
    // receivedAt - deviceNow membengkak dan menandai CLOCK_CHANGED palsu. Bentuk lama tetap diterima.
    const offsetNowMs = dto.offsetNowMs ?? receivedAt.getTime() - new Date(dto.deviceNow).getTime();
    const ordered = dto.events
      .map((e, index) => ({ e, index, effective: effectiveTime(new Date(e.deviceTime), e.offsetAtEventMs) }))
      .sort((a, b) => a.effective.getTime() - b.effective.getTime() || a.index - b.index);

    const results: (EventResult | null)[] = new Array(dto.events.length).fill(null);
    for (const { e, index, effective } of ordered) {
      try {
        results[index] = await this.applyOne(device, e, effective, offsetNowMs, receivedAt);
      } catch (err) {
        // Error tak terduga = sementara: jangan disimpan permanen, biarkan tablet mengulang
        this.logger.error(`Event ${e.id} gagal diproses, menunggu kiriman ulang: ${err?.message}`, err?.stack);
        results[index] = null;
      }
    }
    return { results: results.filter((r): r is EventResult => r !== null) };
  }

  async identify(device: DeviceContext, photoBase64: string) {
    const key = `identify:${device.deviceId}`;
    if (!this.limiter.tryAcquire(key)) {
      throw new HttpException('Terlalu banyak percobaan, coba lagi beberapa menit lagi', HttpStatus.TOO_MANY_REQUESTS);
    }
    const photo = decodePhoto(photoBase64, 'Foto');
    const match = await this.faceEnrollment.identify(photo.buffer);
    if (!match) throw new NotFoundException('Wajah tidak dikenali');
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: match.employeeId },
      select: { fullName: true, outlet: { select: { name: true } } },
    });
    if (!employee) throw new NotFoundException('Wajah tidak dikenali');
    this.limiter.release(key);
    return {
      employeeId: match.employeeId,
      fullName: employee.fullName,
      homeOutletName: employee.outlet.name,
      score: match.score,
    };
  }

  private async applyOne(
    device: DeviceContext,
    e: KioskEventDto,
    effective: Date,
    offsetNowMs: number,
    receivedAt: Date,
  ): Promise<EventResult | null> {
    // 1. Sudah pernah diterima: kembalikan hasil tersimpan, tanpa kerja lain
    const stored = await this.findStored(e.id);
    if (stored) return stored;

    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: e.employeeId },
      select: { outletId: true, attendancePinHash: true, user: { select: { isActive: true } } },
    });
    // Tidak bisa disimpan (FK); tetap dijawab agar tidak terkirim ulang terus
    if (!employee) return { id: e.id, status: AttendanceEventStatus.REJECTED, reason: REASON_EMPLOYEE_NOT_FOUND };

    // 2. Tanda
    const flags = new Set<string>();
    if (clockChanged(e.offsetAtEventMs, offsetNowMs) || e.clockSuspect || inFuture(effective, receivedAt)) {
      flags.add(FLAG_CLOCK_CHANGED);
    }
    if (wasOffline(effective, receivedAt)) flags.add(FLAG_OFFLINE);
    const isGuest = employee.outletId !== device.outletId;
    if (isGuest) flags.add(FLAG_GUEST);
    if (e.method === KioskMethod.PIN) flags.add(FLAG_PIN);

    const base = {
      id: e.id,
      deviceId: device.deviceId,
      employeeId: e.employeeId,
      outletId: device.outletId,
      type: e.type,
      method: e.method,
      deviceTime: new Date(e.deviceTime),
      offsetAtEventMs: e.offsetAtEventMs,
      effectiveTime: effective,
      localScore: e.localScore ?? null,
      receivedAt,
    };

    // Akun nonaktif: tidak diterapkan, disimpan agar HR melihatnya
    if (!employee.user.isActive) {
      return this.storeNotApplied(base, flags, AttendanceEventStatus.NEEDS_REVIEW, REASON_INACTIVE);
    }

    // 3. PIN diperiksa server; salah -> ditolak, tidak diterapkan.
    //    Jatah PIN salah tablet ini habis -> tidak dijawab (diulang tablet setelah jendela lewat)
    if (e.method === KioskMethod.PIN) {
      const pin = await this.checkPin(device.deviceId, employee.attendancePinHash, e.pin);
      if (pin === 'budget') return null;
      if (pin === 'wrong') return this.storeNotApplied(base, flags, AttendanceEventStatus.REJECTED, REASON_WRONG_PIN);
    }

    // 4. Wajah dicocokkan ulang dan foto disimpan (di luar transaksi: berat)
    let photo: DecodedPhoto;
    try {
      photo = decodePhoto(e.photoBase64, 'Foto absen');
    } catch (err) {
      if (!(err instanceof BadRequestException)) throw err;
      // Kesalahan deterministik event ini: kiriman ulang pasti gagal sama -> simpan, jangan ulang
      return this.storeNotApplied(base, flags, AttendanceEventStatus.NEEDS_REVIEW, `${REASON_BAD_PHOTO}: ${err.message}`);
    }
    const check = await this.faceEnrollment.scoreAgainst(e.employeeId, photo.buffer);
    const serverScore = check.score;
    if (!check.enrolled) flags.add(FLAG_NO_FACE);
    else if (check.reason) flags.add(FLAG_FACE_REVIEW);

    // Keterlambatan dihitung sebelum transaksi (kueri jadwal/libur tidak memegang koneksi transaksi)
    const clockIn =
      e.type === KioskEventType.CLOCK_IN ? await this.clockInContext(e.employeeId, device.outletId, effective) : null;

    const photoPath = await saveAttendancePhoto(photo);
    try {
      return await this.prisma.$transaction(
        (tx) => this.applyInTx(tx, device, e, effective, isGuest, flags, base, photoPath, serverScore, clockIn),
        { maxWait: 10_000, timeout: 20_000 },
      );
    } catch (err) {
      // Percobaan ini tidak tersimpan: foto yang baru disimpan dibuang
      await rm(join(UPLOADS_ROOT, photoPath.replace(/^\/uploads\//, '')), { force: true }).catch(() => undefined);
      // Kiriman ganda serentak: kunci primer menolak yang kalah, kembalikan hasil yang menang
      if (isUniqueViolation(err)) {
        const winner = await this.findStored(e.id);
        if (winner) return winner;
      }
      throw err;
    }
  }

  private async clockInContext(employeeId: string, outletId: string, effective: Date): Promise<ClockInContext> {
    const date = toDateOnly(businessDateString(effective));
    const outlet = await this.prisma.outlet.findUniqueOrThrow({ where: { id: outletId } });
    return { date, punctuality: await this.attendance.punctuality(employeeId, outlet, date, effective) };
  }

  private async applyInTx(
    tx: Tx,
    device: DeviceContext,
    e: KioskEventDto,
    effective: Date,
    isGuest: boolean,
    flags: Set<string>,
    base: Omit<Prisma.AttendanceEventUncheckedCreateInput, 'status' | 'applied'>,
    photoPath: string,
    serverScore: number | null,
    clockIn: ClockInContext | null,
  ): Promise<EventResult> {
    // Event seorang kru diterapkan bergiliran (dua tablet / dua kiriman serentak)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${e.employeeId}))`;

    // 5. Keadaan absen: CLOCK_IN -> baris tanggal kalender waktu absen; lainnya -> absen terbuka
    const isClockIn = e.type === KioskEventType.CLOCK_IN;
    const include = {
      breaks: { where: { endBreak: null }, orderBy: { startBreak: 'desc' as const }, take: 1 },
      outlet: { select: { breakLimitMins: true } },
    };
    const row = isClockIn
      ? await tx.attendance.findFirst({
          where: { employeeId: e.employeeId, date: toDateOnly(businessDateString(effective)) },
          include,
        })
      : await tx.attendance.findFirst({
          where: {
            employeeId: e.employeeId,
            clockOutTime: null,
            // Hanya absen yang dimulai sebelum kejadian: event telat untuk hari D tidak
            // menempel ke absen hari berikutnya
            clockInTime: { gte: new Date(effective.getTime() - OPEN_ATTENDANCE_MAX_MS), lte: effective },
          },
          orderBy: { clockInTime: 'desc' },
          include,
        });
    const openBreak = row?.breaks[0] ?? null;
    const state: DayState | null = row?.clockInTime
      ? { attendanceId: row.id, clockIn: row.clockInTime, clockOut: row.clockOutTime, openBreakStart: openBreak?.startBreak ?? null }
      : null;

    const dateYmd = isClockIn || !row ? businessDateString(effective) : ymd(row.date);
    if (isGuest) {
      const here = await tx.shiftSchedule.findFirst({
        where: { employeeId: e.employeeId, date: toDateOnly(dateYmd), outletId: device.outletId },
        select: { id: true },
      });
      if (!here) flags.add(FLAG_UNSCHEDULED);
    }

    const transition = checkTransition(state, e.type, effective);
    if ('reason' in transition) {
      // Urutan tidak sah: disimpan agar terlihat, tidak diterapkan
      await tx.attendanceEvent.create({
        data: {
          ...base,
          photoPath,
          serverScore,
          status: AttendanceEventStatus.NEEDS_REVIEW,
          applied: false,
          reason: transition.reason,
          flags: [...flags],
          attendanceId: row?.id ?? null,
        },
      });
      return { id: e.id, status: AttendanceEventStatus.NEEDS_REVIEW, reason: transition.reason };
    }

    const closeBreakAt = transition.ok ? transition.closeBreakAt : undefined;
    if (closeBreakAt) flags.add(FLAG_BREAK_AUTO_CLOSED);
    const review = Object.keys(REVIEW_FLAGS).filter((f) => flags.has(f));
    if (review.length) flags.add(FLAG_PENDING_REVIEW);
    const mergedFlags = (existing: string[] = []) => [...new Set([...existing, ...flags])];

    // 6. Terapkan ke Attendance / AttendanceBreak
    let attendanceId: string;
    let createdAttendance: boolean | null = null;
    if (isClockIn) {
      const { date, punctuality } = clockIn!;
      const data = {
        outletId: device.outletId,
        clockInTime: effective,
        clockInPhotoUrl: photoPath,
        clockInFaceScore: serverScore,
        ...punctuality,
        source: AttendanceSource.TABLET,
        deviceId: device.deviceId,
        isGuest,
      };
      // Baris tanpa jam masuk (mis. dibuat koreksi) dilengkapi, bukan diduplikasi
      const saved = row
        ? await tx.attendance.update({ where: { id: row.id }, data: { ...data, flags: mergedFlags(row.flags) } })
        : await tx.attendance.create({ data: { ...data, employeeId: e.employeeId, date, flags: mergedFlags() } });
      attendanceId = saved.id;
      createdAttendance = !row;
    } else {
      // checkTransition ok untuk selain CLOCK_IN berarti ada absen terbuka
      const open = row!;
      attendanceId = open.id;
      if (e.type === KioskEventType.BREAK_START) {
        await tx.attendanceBreak.create({ data: { attendanceId, startBreak: effective } });
      }
      if (e.type === KioskEventType.BREAK_END || closeBreakAt) {
        await this.closeBreak(tx, openBreak!, effective, open.outlet.breakLimitMins);
      }
      await tx.attendance.update({
        where: { id: attendanceId },
        data: {
          flags: mergedFlags(open.flags),
          ...(e.type === KioskEventType.CLOCK_OUT && {
            clockOutTime: effective,
            clockOutPhotoUrl: photoPath,
            clockOutFaceScore: serverScore,
          }),
        },
      });
    }

    const status = review.length ? AttendanceEventStatus.NEEDS_REVIEW : AttendanceEventStatus.APPLIED;
    const reason = review.length ? review.map((f) => REVIEW_FLAGS[f]).join(', ') : null;
    await tx.attendanceEvent.create({
      data: { ...base, photoPath, serverScore, status, applied: true, reason, flags: [...flags], attendanceId, createdAttendance },
    });
    return { id: e.id, status, reason };
  }

  /** Sama dengan istirahat dari HP: menit dibulatkan, lewat batas cabang ditandai. */
  private closeBreak(tx: Tx, brk: { id: string; startBreak: Date }, end: Date, breakLimitMins: number) {
    const totalMinutes = Math.round((end.getTime() - brk.startBreak.getTime()) / 60_000);
    const isOverLimit = totalMinutes > breakLimitMins;
    return tx.attendanceBreak.update({
      where: { id: brk.id },
      data: { endBreak: end, totalMinutes, isOverLimit, overLimitMins: isOverLimit ? totalMinutes - breakLimitMins : 0 },
    });
  }

  /** Null bila PIN benar. Setiap percobaan memesan jatah lebih dulu; yang benar dikembalikan. */
  /** Periksa PIN dengan jatah percobaan per tablet (dipakai event absen dan pengajuan dari tablet). */
  async checkPin(deviceId: string, pinHash: string | null, pin?: string): Promise<'budget' | 'wrong' | null> {
    const key = `pin:${deviceId}`;
    if (!this.limiter.tryAcquire(key)) return 'budget';
    let ok = false;
    if (pinHash && pin) {
      try {
        ok = await bcrypt.compare(pin, pinHash);
      } catch {
        ok = false; // hash rusak dianggap PIN salah
      }
    }
    if (!ok) return 'wrong';
    this.limiter.release(key);
    return null;
  }

  /** Simpan event yang tidak diterapkan (PIN salah, foto tidak terbaca); jawaban tetap untuk kiriman ulang. */
  private async storeNotApplied(
    base: Omit<Prisma.AttendanceEventUncheckedCreateInput, 'status' | 'applied'>,
    flags: Set<string>,
    status: AttendanceEventStatus,
    reason: string,
  ): Promise<EventResult> {
    try {
      await this.prisma.attendanceEvent.create({
        data: { ...base, status, applied: false, reason, flags: [...flags] },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      return (await this.findStored(base.id as string))!;
    }
    return { id: base.id as string, status, reason };
  }

  private findStored(id: string): Promise<EventResult | null> {
    return this.prisma.attendanceEvent.findUnique({ where: { id }, select: { id: true, status: true, reason: true } });
  }
}
