import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceEventStatus, AttendanceSource, KioskEventType, Prisma } from '@prisma/client';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { PRIVATE_STORAGE_ROOT } from '../../common/utils/attendance-photo.util';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { FLAG_BREAK_AUTO_CLOSED, FLAG_PENDING_REVIEW } from './kiosk.rules';

export const REASON_CLOCK_IN_REJECTED = 'Absen masuk ditolak';
const ALREADY_REVIEWED = 'Sudah ditinjau';
const LIST_LIMIT = 300;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

type Tx = Prisma.TransactionClient;
type ReviewableStatus = 'NEEDS_REVIEW' | 'REJECTED';

/** Tinjauan HR atas event tablet yang meragukan (NEEDS_REVIEW) dan riwayat yang ditolak. */
@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  async list(actor: AuthUser, q: { status?: string; outletId?: string; from?: string; to?: string }) {
    const status = (q.status ?? 'NEEDS_REVIEW') as ReviewableStatus;
    if (status !== 'NEEDS_REVIEW' && status !== 'REJECTED') {
      throw new BadRequestException('status harus NEEDS_REVIEW atau REJECTED');
    }
    for (const d of [q.from, q.to]) {
      if (d && !YMD.test(d)) throw new BadRequestException('Tanggal harus berformat YYYY-MM-DD');
    }
    const outletId = scopedOutletId(actor, q.outletId || undefined);
    // Tanggal dibaca sebagai hari kalender WIB
    const effectiveTime: Prisma.DateTimeFilter = {};
    if (q.from) effectiveTime.gte = new Date(`${q.from}T00:00:00+07:00`);
    if (q.to) effectiveTime.lte = new Date(`${q.to}T23:59:59.999+07:00`);

    const rows = await this.prisma.attendanceEvent.findMany({
      where: {
        status,
        ...(outletId && { outletId }),
        ...(q.from || q.to ? { effectiveTime } : {}),
      },
      orderBy: { effectiveTime: 'desc' },
      take: LIST_LIMIT,
      include: {
        employee: { select: { id: true, fullName: true, outlet: { select: { name: true } } } },
        outlet: { select: { id: true, name: true } },
      },
    });

    // Foto acuan: pendaftaran wajah terbaru tiap kru (satu kueri untuk semua)
    const enrolled = await this.prisma.faceEnrollment.findMany({
      where: { employeeId: { in: [...new Set(rows.map((r) => r.employeeId))] } },
      distinct: ['employeeId'],
      orderBy: { createdAt: 'desc' },
      select: { employeeId: true },
    });
    const hasEnrollment = new Set(enrolled.map((e) => e.employeeId));

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      method: r.method,
      effectiveTime: r.effectiveTime,
      status: r.status,
      applied: r.applied,
      reason: r.reason,
      flags: r.flags,
      employee: { id: r.employee.id, fullName: r.employee.fullName, homeOutletName: r.employee.outlet.name },
      outlet: r.outlet,
      photoUrl: r.photoPath,
      // Foto acuan disimpan privat: diambil lewat endpoint berotorisasi di bawah
      enrolledPhotoUrl: hasEnrollment.has(r.employeeId) ? `/api/v1/attendance-review/${r.id}/enrolled-photo` : null,
      localScore: r.localScore,
      serverScore: r.serverScore,
    }));
  }

  /** Path berkas foto acuan terbaru kru pemilik event; dengan pemeriksaan outlet. */
  async enrolledPhotoFile(actor: AuthUser, id: string): Promise<string> {
    const event = await this.prisma.attendanceEvent.findUnique({
      where: { id },
      select: { employeeId: true, outletId: true },
    });
    if (!event) throw new NotFoundException('Event tidak ditemukan');
    assertOutletAccess(actor, event.outletId, 'Event ini milik outlet lain');
    const latest = await this.prisma.faceEnrollment.findFirst({
      where: { employeeId: event.employeeId },
      orderBy: { createdAt: 'desc' },
      select: { photoPath: true },
    });
    const file = latest && join(PRIVATE_STORAGE_ROOT, latest.photoPath);
    if (!file || !existsSync(file)) throw new NotFoundException('Foto terdaftar tidak ada');
    return file;
  }

  async accept(actor: AuthUser, id: string) {
    return this.review(actor, id, async (tx, event) => {
      await this.recomputePending(tx, event.attendanceId);
    });
  }

  async reject(actor: AuthUser, id: string) {
    return this.review(actor, id, async (tx, event, reviewedAt) => {
      if (!event.applied || !event.attendanceId) return;
      const attendanceId = event.attendanceId;
      const stamp = { reviewedById: actor.id, reviewedAt };

      if (event.type === KioskEventType.CLOCK_IN) {
        const att = await tx.attendance.findUnique({ where: { id: attendanceId }, select: { source: true } });
        if (!att) return;
        // Semua event lain pada absen ini ikut ditolak
        await tx.attendanceEvent.updateMany({
          where: { attendanceId, id: { not: event.id }, status: { not: AttendanceEventStatus.REJECTED } },
          data: { status: AttendanceEventStatus.REJECTED, reason: REASON_CLOCK_IN_REJECTED, ...stamp },
        });
        await tx.attendanceEvent.update({ where: { id: event.id }, data: { reason: REASON_CLOCK_IN_REJECTED } });
        if (att.source === AttendanceSource.TABLET) {
          // Istirahat ikut terhapus (cascade); event menjadi tanpa absen (SetNull)
          await tx.attendance.delete({ where: { id: attendanceId } });
        }
        return;
      }

      if (event.type === KioskEventType.BREAK_START) {
        await tx.attendanceBreak.deleteMany({ where: { attendanceId, startBreak: event.effectiveTime } });
      } else if (event.type === KioskEventType.BREAK_END) {
        // Istirahat yang akhirnya tak terverifikasi tidak dihitung: seluruh barisnya dihapus
        await tx.attendanceBreak.deleteMany({ where: { attendanceId, endBreak: event.effectiveTime } });
      } else if (event.type === KioskEventType.CLOCK_OUT) {
        await tx.attendance.update({
          where: { id: attendanceId },
          data: {
            clockOutTime: null,
            clockOutLat: null,
            clockOutLng: null,
            clockOutPhotoUrl: null,
            clockOutDistanceM: null,
            clockOutFaceScore: null,
          },
        });
        if (event.flags.includes(FLAG_BREAK_AUTO_CLOSED)) {
          // Istirahat yang ditutup otomatis oleh pulang ini dibuka kembali
          await tx.attendanceBreak.updateMany({
            where: { attendanceId, endBreak: event.effectiveTime },
            data: { endBreak: null, totalMinutes: null, isOverLimit: false, overLimitMins: 0 },
          });
        }
      }
      await this.recomputePending(tx, attendanceId);
    }, AttendanceEventStatus.REJECTED);
  }

  private async review(
    actor: AuthUser,
    id: string,
    apply: (tx: Tx, event: { type: KioskEventType; applied: boolean; attendanceId: string | null; effectiveTime: Date; flags: string[]; id: string }, at: Date) => Promise<void>,
    to: AttendanceEventStatus = AttendanceEventStatus.APPLIED,
  ) {
    const found = await this.prisma.attendanceEvent.findUnique({ where: { id }, select: { employeeId: true, outletId: true } });
    if (!found) throw new NotFoundException('Event tidak ditemukan');
    assertOutletAccess(actor, found.outletId, 'Event ini milik outlet lain');

    return this.prisma.$transaction(async (tx) => {
      // Sebaris dengan penerapan event kru (EventsService): tidak berebut dengan kiriman tablet
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.employeeId}))`;
      const at = new Date();
      // Pembaruan bersyarat: hanya satu peninjau yang menang bila diklik bersamaan
      const won = await tx.attendanceEvent.updateMany({
        where: { id, status: AttendanceEventStatus.NEEDS_REVIEW },
        data: { status: to, reviewedById: actor.id, reviewedAt: at },
      });
      if (won.count === 0) throw new BadRequestException(ALREADY_REVIEWED);
      const event = await tx.attendanceEvent.findUniqueOrThrow({
        where: { id },
        select: { id: true, type: true, applied: true, attendanceId: true, effectiveTime: true, flags: true },
      });
      await apply(tx, event, at);
      return { id, status: to };
    }, { maxWait: 10_000, timeout: 20_000 });
  }

  /** PENDING_REVIEW dicabut dari absen bila tak ada lagi event diterapkan yang menunggu tinjauan. */
  private async recomputePending(tx: Tx, attendanceId: string | null) {
    if (!attendanceId) return;
    const att = await tx.attendance.findUnique({ where: { id: attendanceId }, select: { flags: true } });
    if (!att || !att.flags.includes(FLAG_PENDING_REVIEW)) return;
    const pending = await tx.attendanceEvent.count({
      where: { attendanceId, applied: true, status: AttendanceEventStatus.NEEDS_REVIEW },
    });
    if (pending === 0) {
      await tx.attendance.update({
        where: { id: attendanceId },
        data: { flags: att.flags.filter((f) => f !== FLAG_PENDING_REVIEW) },
      });
    }
  }
}
