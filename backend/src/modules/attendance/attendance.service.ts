import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';
import { OutletHours, dayTypeFor, holidaysBetween, workWindow } from '../../common/utils/work-hours.util';
import {
  businessDateString,
  businessDateTime,
  businessToday,
  monthDateRange,
  parseDateParam,
  toDateOnly,
} from '../../common/utils/business-date.util';

// Toleransi terlambat dalam menit (menit terlambat tetap dicatat apa adanya)
const LATE_GRACE_MINUTES = Math.max(0, Number(process.env.LATE_GRACE_MINUTES ?? 0) || 0);

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private getTodayDate(): Date {
    return businessToday();
  }

  /**
   * Jadwal pada `date` menentukan keterlambatan: menit dari jam mulai kerja cabang `outlet`
   * (jenis hari: weekday, weekend atau libur nasional) sampai `at`.
   * Tanpa jadwal, absen tetap diterima sebagai hadir dan tidak dihitung terlambat.
   */
  async punctuality(employeeId: string, outlet: OutletHours, date: Date, at: Date) {
    const schedule = await this.prisma.shiftSchedule.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });
    if (!schedule) {
      return { scheduleId: null, lateMinutes: 0, status: AttendanceStatus.PRESENT };
    }
    const ymd = date.toISOString().slice(0, 10);
    const { start: startTime } = workWindow(outlet, dayTypeFor(ymd, await holidaysBetween(this.prisma, ymd, ymd)));
    const start = businessDateTime(ymd, startTime);
    const lateMinutes = Math.max(0, Math.floor((at.getTime() - start.getTime()) / 60_000));
    return {
      scheduleId: schedule.id,
      lateMinutes,
      status: lateMinutes > LATE_GRACE_MINUTES ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
    };
  }

  /** Cabang tempat kru bertugas hari ini: jadwal hari itu bila menunjuk cabang, selain itu cabang asal. */
  async workingOutletToday(employeeId: string) {
    const schedule = await this.prisma.shiftSchedule.findUnique({
      where: { employeeId_date: { employeeId, date: this.getTodayDate() } },
      select: { outlet: true, employee: { select: { outlet: true } } },
    });
    if (!schedule) {
      const profile = await this.prisma.employeeProfile.findUnique({
        where: { id: employeeId },
        select: { outlet: true },
      });
      if (!profile) throw new NotFoundException('Profil karyawan tidak ditemukan');
      return profile.outlet;
    }
    return schedule.outlet ?? schedule.employee.outlet;
  }

  async getTodayStatus(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: { outlet: true },
    });
    if (!profile) {
      throw new NotFoundException('Profil karyawan tidak ditemukan');
    }

    const today = this.getTodayDate();

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        employeeId: profile.id,
        date: today,
      },
      include: {
        breaks: { orderBy: { startBreak: 'asc' } },
        outlet: true,
      },
    });

    const activeBreak = attendance?.breaks.find((b) => b.endBreak === null) || null;
    const workingOutlet = await this.workingOutletToday(profile.id);

    return {
      outlet: profile.outlet,
      workingOutletName: workingOutlet.name,
      date: today,
      attendance: attendance || null,
      isOnBreak: !!activeBreak,
      currentBreak: activeBreak,
    };
  }

  async getHistory(userId: string, month?: number, year?: number) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profil karyawan tidak ditemukan');

    const [thisYear, thisMonth] = businessDateString().split('-').map(Number);
    const targetYear = year ?? thisYear;
    const targetMonth = month ?? thisMonth;
    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12 || !Number.isInteger(targetYear)) {
      throw new BadRequestException('Bulan harus 1-12 dan tahun berupa angka');
    }

    const { first: startDate, last: endDate } = monthDateRange(targetYear, targetMonth);

    return this.prisma.attendance.findMany({
      where: {
        employeeId: profile.id,
        date: { gte: startDate, lte: endDate },
      },
      include: { breaks: true, outlet: true },
      orderBy: { date: 'desc' },
    });
  }

  async getAdminDailyReport(outletId?: string, dateStr?: string) {
    const targetDate = dateStr ? toDateOnly(parseDateParam(dateStr)) : this.getTodayDate();

    const rows = await this.prisma.attendance.findMany({
      where: {
        date: targetDate,
        ...(outletId && { outletId }),
      },
      include: {
        employee: {
          include: {
            position: { include: { department: true } },
            outlet: true,
          },
        },
        outlet: true,
        breaks: true,
      },
      orderBy: { clockInTime: 'asc' },
    });

    // Jam kerja yang berlaku hari itu, untuk menampilkan "mulai jam ..." dan batas istirahat
    const ymd = targetDate.toISOString().slice(0, 10);
    const dayType = dayTypeFor(ymd, await holidaysBetween(this.prisma, ymd, ymd));
    return rows.map((r) => {
      const hours = workWindow(r.outlet, dayType);
      return {
        ...r,
        dayType,
        expectedStart: r.scheduleId ? hours.start : null,
        expectedEnd: r.scheduleId ? hours.end : null,
      };
    });
  }
}
