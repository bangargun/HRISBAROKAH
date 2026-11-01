import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockInDto, ClockOutDto } from './attendance.dto';
import { validateFaceContour } from '../../common/utils/face-detection.util';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private getTodayDate(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
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

    // ============================================================
    // VALIDASI BIOMETRIK KONTUR WAJAH (GEOFENCE GPS DIHAPUS)
    // Apabila bukan kontur wajah yang dikirim, maka akan tertolak
    // ============================================================
    const faceCheck = await validateFaceContour(dto.photoUrl);
    if (!faceCheck.isValid) {
      throw new BadRequestException(
        `Absensi Ditolak: ${faceCheck.reason || 'Foto yang dikirim tidak memuat kontur wajah manusia yang valid. Pastikan wajah terlihat jelas menghadap kamera.'}`,
      );
    }

    const now = new Date();
    const biometricConfidence = Math.round((faceCheck.confidenceScore || 0.95) * 100);
    const verificationNote = `[Biometrik Wajah: Lolos (${biometricConfidence}% Kontur Cocok)]`;
    const finalNotes = dto.notes ? `${dto.notes} | ${verificationNote}` : verificationNote;

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          clockInTime: now,
          clockInLat: dto.latitude ?? 0,
          clockInLng: dto.longitude ?? 0,
          clockInPhotoUrl: dto.photoUrl,
          clockInDistanceM: 0,
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
        clockInLat: dto.latitude ?? 0,
        clockInLng: dto.longitude ?? 0,
        clockInPhotoUrl: dto.photoUrl,
        clockInDistanceM: 0,
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
      include: { breaks: true },
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

    // ============================================================
    // VALIDASI BIOMETRIK KONTUR WAJAH SAAT KEPULANGAN (CLOCK OUT)
    // ============================================================
    const faceCheck = await validateFaceContour(dto.photoUrl);
    if (!faceCheck.isValid) {
      throw new BadRequestException(
        `Clock-Out Ditolak: ${faceCheck.reason || 'Foto yang dikirim tidak memuat kontur wajah manusia yang valid.'}`,
      );
    }

    const now = new Date();
    const biometricConfidence = Math.round((faceCheck.confidenceScore || 0.95) * 100);
    const outVerificationNote = `[Biometrik Pulang: Lolos (${biometricConfidence}% Kontur Cocok)]`;
    const finalOutNotes = dto.notes
      ? `${attendance.notes || ''} | Out: ${dto.notes} (${outVerificationNote})`
      : `${attendance.notes || ''} | ${outVerificationNote}`;

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOutTime: now,
        clockOutLat: dto.latitude ?? 0,
        clockOutLng: dto.longitude ?? 0,
        clockOutPhotoUrl: dto.photoUrl,
        clockOutDistanceM: 0,
        notes: finalOutNotes,
      },
      include: { breaks: true },
    });
  }

  async startBreak(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({ where: { userId } });
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
    const profile = await this.prisma.employeeProfile.findUnique({ where: { userId } });
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
    const profile = await this.prisma.employeeProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil karyawan tidak ditemukan');

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month ? month - 1 : new Date().getMonth();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

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
    const targetDate = dateStr ? new Date(dateStr) : this.getTodayDate();
    targetDate.setHours(0, 0, 0, 0);

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
        breaks: true,
      },
      orderBy: { clockInTime: 'asc' },
    });
  }
}
