import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AttendanceEventStatus, AttendanceSource, KioskEventType, KioskMethod, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { rm } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { FaceEnrollmentService } from '../face/face-enrollment.service';
import { UPLOADS_ROOT, decodePhoto, saveAttendancePhoto } from '../../common/utils/attendance-photo.util';
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
  wasOffline,
} from './kiosk.rules';

export const REASON_WRONG_PIN = 'PIN salah';
export const REASON_TOO_MANY_PIN = 'Terlalu banyak PIN salah, coba lagi nanti';
const REASON_EMPLOYEE_NOT_FOUND = 'Karyawan tidak ditemukan';
const REASON_SERVER_ERROR = 'Gagal diproses server, perlu dicek';

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
   * Hasil dikembalikan sesuai urutan kiriman. Event yang gagal karena error server (mis. DB
   * putus) tidak ikut di `results`; tablet menyimpannya di antrean dan mengirim ulang.
   */
  async ingest(device: DeviceContext, dto: KioskEventsDto): Promise<{ results: EventResult[] }> {
    const receivedAt = new Date();
    const offsetNowMs = receivedAt.getTime() - new Date(dto.deviceNow).getTime();
    const ordered = dto.events
      .map((e, index) => ({ e, index, effective: effectiveTime(new Date(e.deviceTime), e.offsetAtEventMs) }))
      .sort((a, b) => a.effective.getTime() - b.effective.getTime() || a.index - b.index);

    const results: (EventResult | null)[] = new Array(dto.events.length).fill(null);
    for (const { e, index, effective } of ordered) {
      try {
        results[index] = await this.applyOne(device, e, effective, offsetNowMs, receivedAt);
      } catch (err) {
        this.logger.error(`Event ${e.id} gagal diterapkan: ${err?.message}`, err?.stack);
        results[index] = await this.recordFailure(device, e, effective, receivedAt);
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
  ): Promise<EventResult> {
    // 1. Sudah pernah diterima: kembalikan hasil tersimpan, tanpa kerja lain
    const stored = await this.findStored(e.id);
    if (stored) return stored;

    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: e.employeeId },
      select: { outletId: true, attendancePinHash: true },
    });
    // Tidak bisa disimpan (FK); tetap dijawab agar tidak terkirim ulang terus
    if (!employee) return { id: e.id, status: AttendanceEventStatus.REJECTED, reason: REASON_EMPLOYEE_NOT_FOUND };

    // 2. Tanda
    const flags = new Set<string>();
    if (clockChanged(e.offsetAtEventMs, offsetNowMs)) flags.add(FLAG_CLOCK_CHANGED);
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

    // 3. PIN diperiksa server; salah -> ditolak, tidak diterapkan
    if (e.method === KioskMethod.PIN) {
      const pinError = await this.checkPin(device.deviceId, employee.attendancePinHash, e.pin);
      if (pinError) return this.storeRejected(base, flags, pinError);
    }

    // 4. Foto disimpan dan wajah dicocokkan ulang (di luar transaksi: berat)
    let photoPath: string | null = null;
    let serverScore: number | null = null;
    try {
      const photo = decodePhoto(e.photoBase64, 'Foto absen');
      const check = await this.faceEnrollment.scoreAgainst(e.employeeId, photo.buffer);
      serverScore = check.score;
      if (!check.enrolled) flags.add(FLAG_NO_FACE);
      else if (check.reason) flags.add(FLAG_FACE_REVIEW);
      photoPath = await saveAttendancePhoto(photo);
    } catch (err) {
      // Foto rusak/bukan gambar: absen tetap dicatat tetapi wajah perlu ditinjau
      if (!(err instanceof BadRequestException)) throw err;
      flags.add(FLAG_FACE_REVIEW);
    }

    try {
      return await this.prisma.$transaction(
        (tx) => this.applyInTx(tx, device, e, effective, isGuest, flags, base, photoPath, serverScore),
        { maxWait: 10_000, timeout: 20_000 },
      );
    } catch (err) {
      // Kiriman ganda serentak: kunci primer menolak yang kalah, kembalikan hasil yang menang
      if (isUniqueViolation(err)) {
        if (photoPath) await rm(join(UPLOADS_ROOT, photoPath.replace(/^\/uploads\//, '')), { force: true });
        const winner = await this.findStored(e.id);
        if (winner) return winner;
      }
      throw err;
    }
  }

  private async applyInTx(
    tx: Tx,
    device: DeviceContext,
    e: KioskEventDto,
    effective: Date,
    isGuest: boolean,
    flags: Set<string>,
    base: Omit<Prisma.AttendanceEventUncheckedCreateInput, 'status' | 'applied'>,
    photoPath: string | null,
    serverScore: number | null,
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
            clockInTime: { gte: new Date(effective.getTime() - OPEN_ATTENDANCE_MAX_MS) },
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
    if (isClockIn) {
      const date = toDateOnly(dateYmd);
      const outlet = await tx.outlet.findUniqueOrThrow({ where: { id: device.outletId } });
      const punctuality = await this.attendance.punctuality(e.employeeId, outlet, date, effective);
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
      data: { ...base, photoPath, serverScore, status, applied: true, reason, flags: [...flags], attendanceId },
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
  private async checkPin(deviceId: string, pinHash: string | null, pin?: string): Promise<string | null> {
    const key = `pin:${deviceId}`;
    if (!this.limiter.tryAcquire(key)) return REASON_TOO_MANY_PIN;
    let ok = false;
    if (pinHash && pin) {
      try {
        ok = await bcrypt.compare(pin, pinHash);
      } catch {
        ok = false; // hash rusak dianggap PIN salah
      }
    }
    if (!ok) return REASON_WRONG_PIN;
    this.limiter.release(key);
    return null;
  }

  private async storeRejected(
    base: Omit<Prisma.AttendanceEventUncheckedCreateInput, 'status' | 'applied'>,
    flags: Set<string>,
    reason: string,
  ): Promise<EventResult> {
    try {
      await this.prisma.attendanceEvent.create({
        data: { ...base, status: AttendanceEventStatus.REJECTED, applied: false, reason, flags: [...flags] },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      return (await this.findStored(base.id as string))!;
    }
    return { id: base.id as string, status: AttendanceEventStatus.REJECTED, reason };
  }

  /**
   * Error tak terduga: event disimpan sebagai NEEDS_REVIEW (tidak diterapkan) agar terlihat HR
   * dan tidak dikirim ulang tanpa akhir. Bila penyimpanan pun gagal, tidak dijawab (tablet mengulang).
   */
  private async recordFailure(
    device: DeviceContext,
    e: KioskEventDto,
    effective: Date,
    receivedAt: Date,
  ): Promise<EventResult | null> {
    try {
      const stored = await this.findStored(e.id);
      if (stored) return stored;
      await this.prisma.attendanceEvent.create({
        data: {
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
          status: AttendanceEventStatus.NEEDS_REVIEW,
          applied: false,
          reason: REASON_SERVER_ERROR,
        },
      });
      return { id: e.id, status: AttendanceEventStatus.NEEDS_REVIEW, reason: REASON_SERVER_ERROR };
    } catch (err) {
      if (isUniqueViolation(err)) return this.findStored(e.id).catch(() => null);
      this.logger.error(`Event ${e.id} tidak bisa disimpan: ${err?.message}`);
      return null;
    }
  }

  private findStored(id: string): Promise<EventResult | null> {
    return this.prisma.attendanceEvent.findUnique({ where: { id }, select: { id: true, status: true, reason: true } });
  }
}
