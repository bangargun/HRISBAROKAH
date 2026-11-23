import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FaceRecognitionService } from '../face/face-recognition.service';
import { businessDateString, monthDateRange, toDateOnly } from '../../common/utils/business-date.util';
import { OutletHours, holidaysBetween } from '../../common/utils/work-hours.util';
import { OPEN_ATTENDANCE_MAX_MS, isOpen } from './kiosk.rules';

// Sama dengan employees.service: peran admin bukan kru lapangan
const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN];

const GUEST_WINDOW_DAYS = 3; // tamu terjadwal: hari ini .. hari ini + 3
const HOLIDAY_WINDOW_DAYS = 7;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => ymd(new Date(toDateOnly(date).getTime() + n * 86_400_000));
const diffMinutes = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));

export interface BootstrapPayload {
  serverTime: string;
  matchThreshold: number;
  outlet: { id: string; name: string; hours: OutletHours; breakLimitMins: number };
  holidays: string[];
  roster: {
    employeeId: string;
    fullName: string;
    positionTitle: string;
    homeOutletName: string;
    isGuest: boolean;
    guestDates: string[];
    embeddings: number[][];
    hasPin: boolean;
    // Jadwal shift hari ini .. +3 (cabang mana pun). here = bertugas di cabang tablet ini.
    // Tablet memakainya untuk "Belum datang" dan menghitung terlambat seperti punctuality().
    shifts: { date: string; here: boolean }[];
  }[];
  directory: { employeeId: string; fullName: string; homeOutletName: string }[];
  today: {
    employeeId: string;
    clockIn: string | null;
    clockOut: string | null;
    openBreakStart: string | null;
    lateMinutes: number;
  }[];
  recap: {
    employeeId: string;
    days: {
      date: string;
      clockIn: string | null;
      clockOut: string | null;
      lateMinutes: number;
      breakMinutes: number;
      // 0 selama belum absen pulang
      workMinutes: number;
    }[];
  }[];
}

/** Paket data yang diunduh tablet agar bisa mengenali wajah dan bekerja offline. */
@Injectable()
export class BootstrapService {
  constructor(
    private prisma: PrismaService,
    private face: FaceRecognitionService,
  ) {}

  async build(outletId: string): Promise<BootstrapPayload> {
    const now = new Date();
    const today = businessDateString(now);
    const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) throw new NotFoundException('Cabang tidak ditemukan');

    const guestTo = addDays(today, GUEST_WINDOW_DAYS);
    const crewWhere = { user: { isActive: true, role: { notIn: ADMIN_ROLES } } };
    const [holidays, guestSchedules, directoryRows] = await Promise.all([
      holidaysBetween(this.prisma, today, addDays(today, HOLIDAY_WINDOW_DAYS)),
      this.prisma.shiftSchedule.findMany({
        where: { outletId, date: { gte: toDateOnly(today), lte: toDateOnly(guestTo) }, employee: crewWhere },
        select: { employeeId: true, date: true },
      }),
      this.prisma.employeeProfile.findMany({
        where: crewWhere,
        select: { id: true, fullName: true, outletId: true, outlet: { select: { name: true } } },
        orderBy: { fullName: 'asc' },
      }),
    ]);

    const guestDatesByEmployee = new Map<string, string[]>();
    for (const s of guestSchedules) {
      const list = guestDatesByEmployee.get(s.employeeId) ?? [];
      list.push(ymd(s.date));
      guestDatesByEmployee.set(s.employeeId, list);
    }

    const rosterRows = await this.prisma.employeeProfile.findMany({
      where: {
        ...crewWhere,
        OR: [{ outletId }, { id: { in: [...guestDatesByEmployee.keys()] } }],
      },
      select: {
        id: true,
        fullName: true,
        outletId: true,
        attendancePinHash: true,
        outlet: { select: { name: true } },
        position: { select: { title: true } },
        faceEnrollments: { select: { embedding: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const homeIds = rosterRows.filter((r) => r.outletId === outletId).map((r) => r.id);
    const [todayRows, recapRows, rosterSchedules] = await Promise.all([
      this.todayRows(outletId, today, now),
      this.recapRows(homeIds, today),
      this.prisma.shiftSchedule.findMany({
        where: { employeeId: { in: rosterRows.map((r) => r.id) }, date: { gte: toDateOnly(today), lte: toDateOnly(guestTo) } },
        select: { employeeId: true, date: true, outletId: true },
        orderBy: { date: 'asc' },
      }),
    ]);
    const homeOutletOf = new Map(rosterRows.map((r) => [r.id, r.outletId]));
    const shiftsByEmployee = new Map<string, { date: string; here: boolean }[]>();
    for (const s of rosterSchedules) {
      const list = shiftsByEmployee.get(s.employeeId) ?? [];
      // Jadwal tanpa cabang berarti bertugas di cabang asal
      list.push({ date: ymd(s.date), here: (s.outletId ?? homeOutletOf.get(s.employeeId)) === outletId });
      shiftsByEmployee.set(s.employeeId, list);
    }

    return {
      serverTime: now.toISOString(),
      matchThreshold: this.face.matchThreshold,
      outlet: {
        id: outlet.id,
        name: outlet.name,
        breakLimitMins: outlet.breakLimitMins,
        hours: {
          weekdayWorkStart: outlet.weekdayWorkStart,
          weekdayWorkEnd: outlet.weekdayWorkEnd,
          weekendWorkStart: outlet.weekendWorkStart,
          weekendWorkEnd: outlet.weekendWorkEnd,
          holidayWorkStart: outlet.holidayWorkStart,
          holidayWorkEnd: outlet.holidayWorkEnd,
        },
      },
      holidays: [...holidays].sort(),
      roster: rosterRows.map((r) => {
        const isGuest = r.outletId !== outletId;
        return {
          employeeId: r.id,
          fullName: r.fullName,
          positionTitle: r.position.title,
          homeOutletName: r.outlet.name,
          isGuest,
          guestDates: isGuest ? (guestDatesByEmployee.get(r.id) ?? []).sort() : [],
          embeddings: r.faceEnrollments.map((f) => f.embedding),
          hasPin: !!r.attendancePinHash,
          shifts: shiftsByEmployee.get(r.id) ?? [],
        };
      }),
      directory: directoryRows.map((r) => ({ employeeId: r.id, fullName: r.fullName, homeOutletName: r.outlet.name })),
      today: todayRows,
      recap: recapRows,
    };
  }

  /** Absen di cabang ini hari ini, ditambah absen kemarin yang masih terbuka (aturan 16 jam). */
  private async todayRows(outletId: string, today: string, now: Date): Promise<BootstrapPayload['today']> {
    const rows = await this.prisma.attendance.findMany({
      where: {
        outletId,
        OR: [
          { date: toDateOnly(today) },
          { date: toDateOnly(addDays(today, -1)), clockOutTime: null, clockInTime: { gte: new Date(now.getTime() - OPEN_ATTENDANCE_MAX_MS) } },
        ],
      },
      include: { breaks: { where: { endBreak: null }, select: { startBreak: true } } },
      orderBy: { clockInTime: 'asc' },
    });
    return rows
      .filter((r) => ymd(r.date) === today || (r.clockInTime && isOpen({ attendanceId: r.id, clockIn: r.clockInTime, clockOut: null, openBreakStart: null }, now)))
      .map((r) => ({
        employeeId: r.employeeId,
        clockIn: r.clockInTime?.toISOString() ?? null,
        clockOut: r.clockOutTime?.toISOString() ?? null,
        openBreakStart: r.breaks[0]?.startBreak.toISOString() ?? null,
        lateMinutes: r.lateMinutes,
      }));
  }

  /** Rekap bulan berjalan per kru rumah. */
  private async recapRows(employeeIds: string[], today: string): Promise<BootstrapPayload['recap']> {
    if (employeeIds.length === 0) return [];
    const { first, last } = monthDateRange(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
    const rows = await this.prisma.attendance.findMany({
      where: { employeeId: { in: employeeIds }, date: { gte: first, lte: last } },
      include: { breaks: { select: { endBreak: true, totalMinutes: true, startBreak: true } } },
      orderBy: { date: 'asc' },
    });
    const byEmployee = new Map<string, BootstrapPayload['recap'][number]['days']>(employeeIds.map((id) => [id, []]));
    for (const r of rows) {
      const breakMinutes = r.breaks.reduce(
        (sum, b) => sum + (b.endBreak ? (b.totalMinutes ?? diffMinutes(b.startBreak, b.endBreak)) : 0),
        0,
      );
      const workMinutes =
        r.clockInTime && r.clockOutTime ? Math.max(0, diffMinutes(r.clockInTime, r.clockOutTime) - breakMinutes) : 0;
      byEmployee.get(r.employeeId)!.push({
        date: ymd(r.date),
        clockIn: r.clockInTime?.toISOString() ?? null,
        clockOut: r.clockOutTime?.toISOString() ?? null,
        lateMinutes: r.lateMinutes,
        breakMinutes,
        workMinutes,
      });
    }
    return [...byEmployee].map(([employeeId, days]) => ({ employeeId, days }));
  }
}
