import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockInDto, ClockOutDto } from './attendance.dto';
import { FaceEnrollmentService } from '../face/face-enrollment.service';
import { AttendanceStatus, FaceCheckKind } from '@prisma/client';
import { calculateDistanceInMeters } from '../../common/utils/geofence.util';
import {
  businessDateString,
  businessToday,
  monthDateRange,
  parseDateParam,
  toDateOnly,
} from '../../common/utils/business-date.util';

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
   * Lokasi absen beserta jaraknya ke cabang. Absen tidak ditolak karena jarak
   * (kebijakan: dicatat saja); lokasi yang tidak terkirim disimpan kosong, bukan 0,0.
   */
  private locate(outlet: { latitude: number; longitude: number }, lat?: number, lng?: number) {
    if (lat === undefined || lng === undefined) {
      return { lat: null, lng: null, distanceM: null };
    }
    return { lat, lng, distanceM: calculateDistanceInMeters(lat, lng, outlet.latitude, outlet.longitude) };
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

    return {
      outlet: profile.outlet,
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
          status: AttendanceStatus.PRESENT,
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
        status: AttendanceStatus.PRESENT,
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

    const today = this.getTodayDate();
    const attendance = await this.prisma.attendance.findFirst({
      where: { employeeId: profile.id, date: today },
      include: { breaks: true, outlet: { include: { shifts: true } } },
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

    // Standar istirahat restoran = 60 menit (atau sesuai shift)
    const breakLimitMins = 60;
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

    return this.prisma.attendance.findMany({
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
        outlet: { select: { id: true, name: true, geofenceRadius: true } },
        breaks: true,
      },
      orderBy: { clockInTime: 'asc' },
    });
  }
}
