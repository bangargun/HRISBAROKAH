import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockInDto, ClockOutDto } from './attendance.dto';
import { FaceEnrollmentService } from '../face/face-enrollment.service';
import { AttendanceMode, AttendanceStatus, FaceCheckKind } from '@prisma/client';
import { calculateDistanceInMeters } from '../../common/utils/geofence.util';
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
  constructor(
    private prisma: PrismaService,
    private faceEnrollment: FaceEnrollmentService,
  ) {}

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

  /**
   * Lokasi absen beserta jaraknya ke cabang. Absen tidak ditolak karena jarak
   * (kebijakan: dicatat saja); lokasi yang tidak terkirim disimpan kosong, bukan 0,0.
   */
  private locate(outlet: { latitude: number; longitude: number }, lat?: number, lng?: number) {
    if (lat === undefined || lng === undefined) {
      return { lat: null, lng: null, distanceM: null };
    }
    return { lat, lng, distanceM: calculateDistanceInMeters(lat, lng, outlet.latitude, outlet.longitude) };
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

  /** Cabang tablet menutup absen HP, supaya aplikasi versi lama pun tidak bisa dipakai absen. */
  private async assertPhoneAllowed(employeeId: string) {
    const outlet = await this.workingOutletToday(employeeId);
    if (outlet.attendanceMode === AttendanceMode.TABLET) {
      throw new BadRequestException('Absen di tablet cabang');
    }
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
      attendanceMode: workingOutlet.attendanceMode,
      workingOutletName: workingOutlet.name,
      date: today,
      attendance: attendance || null,
      isOnBreak: !!activeBreak,
      currentBreak: activeBreak,
    };
  }

  async clockIn(userId: string, dto: ClockInDto) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: { outlet: true },
    });
    if (!profile) {
      throw new NotFoundException('Profil karyawan tidak ditemukan');
    }
    await this.assertPhoneAllowed(profile.id);

    const today = this.getTodayDate();

    // Cek apakah sudah pernah clock-in hari ini
    const existing = await this.prisma.attendance.findFirst({
      where: { employeeId: profile.id, date: today },
    });
    if (existing && existing.clockInTime) {
      throw new BadRequestException('Anda sudah melakukan Clock In hari ini');
    }

    // Selfie dicocokkan dengan wajah terdaftar karyawan ini
    const { photoUrl, score } = await this.faceEnrollment.verifyForAttendance(
      profile.id,
      dto.photoBase64,
      FaceCheckKind.CLOCK_IN,
    );

    const now = new Date();
    const finalNotes = dto.notes ?? null;
    const location = this.locate(profile.outlet, dto.latitude, dto.longitude);
    const punctuality = await this.punctuality(profile.id, profile.outlet, today, now);

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          clockInTime: now,
          clockInLat: location.lat,
          clockInLng: location.lng,
          clockInPhotoUrl: photoUrl,
          clockInFaceScore: score,
          clockInDistanceM: location.distanceM,
          ...punctuality,
          notes: finalNotes,
        },
      });
    }

    return this.prisma.attendance.create({
      data: {
        employeeId: profile.id,
        outletId: profile.outletId,
        date: today,
        clockInTime: now,
        clockInLat: location.lat,
        clockInLng: location.lng,
        clockInPhotoUrl: photoUrl,
        clockInFaceScore: score,
        clockInDistanceM: location.distanceM,
        ...punctuality,
        notes: finalNotes,
      },
      include: { breaks: true },
    });
  }

  async clockOut(userId: string, dto: ClockOutDto) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: { outlet: true },
    });
    if (!profile) {
      throw new NotFoundException('Profil karyawan tidak ditemukan');
    }
    await this.assertPhoneAllowed(profile.id);

    const today = this.getTodayDate();

    const attendance = await this.prisma.attendance.findFirst({
      where: { employeeId: profile.id, date: today },
      include: { breaks: true, outlet: true },
    });

    if (!attendance || !attendance.clockInTime) {
      throw new BadRequestException('Anda belum melakukan Clock In hari ini');
    }

    if (attendance.clockOutTime) {
      throw new BadRequestException('Anda sudah melakukan Clock Out hari ini');
    }

    // Pastikan tidak sedang dalam status istirahat (harus end break dulu)
    const activeBreak = attendance.breaks.find((b) => b.endBreak === null);
    if (activeBreak) {
      throw new BadRequestException('Anda masih dalam sesi istirahat. Harap selesaikan istirahat terlebih dahulu');
    }

    const { photoUrl, score } = await this.faceEnrollment.verifyForAttendance(
      profile.id,
      dto.photoBase64,
      FaceCheckKind.CLOCK_OUT,
    );

    const now = new Date();
    const finalOutNotes = dto.notes
      ? [attendance.notes, `Pulang: ${dto.notes}`].filter(Boolean).join(' | ')
      : attendance.notes;
    // Dibandingkan dengan cabang tempat absen masuk hari ini
    const location = this.locate(attendance.outlet, dto.latitude, dto.longitude);

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOutTime: now,
        clockOutLat: location.lat,
        clockOutLng: location.lng,
        clockOutPhotoUrl: photoUrl,
        clockOutFaceScore: score,
        clockOutDistanceM: location.distanceM,
        notes: finalOutNotes,
      },
      include: { breaks: true },
    });
  }

  async startBreak(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profil karyawan tidak ditemukan');
    await this.assertPhoneAllowed(profile.id);

    const today = this.getTodayDate();
    const attendance = await this.prisma.attendance.findFirst({
      where: { employeeId: profile.id, date: today },
      include: { breaks: true },
    });

    if (!attendance || !attendance.clockInTime) {
      throw new BadRequestException('Anda harus Clock In terlebih dahulu sebelum istirahat');
    }

    if (attendance.clockOutTime) {
      throw new BadRequestException('Anda sudah Clock Out untuk hari ini');
    }

    const activeBreak = attendance.breaks.find((b) => b.endBreak === null);
    if (activeBreak) {
      throw new BadRequestException('Anda sudah berada dalam sesi istirahat');
    }

    return this.prisma.attendanceBreak.create({
      data: {
        attendanceId: attendance.id,
        startBreak: new Date(),
      },
    });
  }

  async endBreak(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profil karyawan tidak ditemukan');
    await this.assertPhoneAllowed(profile.id);

    const today = this.getTodayDate();
    const attendance = await this.prisma.attendance.findFirst({
      where: { employeeId: profile.id, date: today },
      include: { breaks: true, outlet: { select: { breakLimitMins: true } } },
    });

    if (!attendance) {
      throw new BadRequestException('Absensi hari ini tidak ditemukan');
    }

    const activeBreak = attendance.breaks.find((b) => b.endBreak === null);
    if (!activeBreak) {
      throw new BadRequestException('Tidak ada sesi istirahat aktif yang perlu diakhiri');
    }

    const now = new Date();
    const diffMs = now.getTime() - new Date(activeBreak.startBreak).getTime();
    const totalMinutes = Math.round(diffMs / 60000);

    // Batas istirahat mengikuti pengaturan cabang tempat absen hari itu
    const breakLimitMins = attendance.outlet.breakLimitMins;
    const isOverLimit = totalMinutes > breakLimitMins;
    const overLimitMins = isOverLimit ? totalMinutes - breakLimitMins : 0;

    return this.prisma.attendanceBreak.update({
      where: { id: activeBreak.id },
      data: {
        endBreak: now,
        totalMinutes,
        isOverLimit,
        overLimitMins,
      },
    });
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
