import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { KioskMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { decodePhoto } from '../../common/utils/attendance-photo.util';
import { FaceEnrollmentService } from '../face/face-enrollment.service';
import { RequestsService } from '../requests/requests.service';
import { DeviceContext } from './device-auth.guard';
import { EventsService } from './events.service';
import { KioskRequestDto } from './kiosk.dto';

/**
 * Pengajuan cuti / izin / sakit dari tablet. Tablet sudah mengenali kru, tetapi server memastikan ulang:
 * wajah dicocokkan dengan wajah terdaftar, atau PIN diperiksa. Butuh internet (tidak diantrekan).
 */
@Injectable()
export class KioskRequestsService {
  constructor(
    private prisma: PrismaService,
    private faceEnrollment: FaceEnrollmentService,
    private events: EventsService,
    private requests: RequestsService,
  ) {}

  async create(device: DeviceContext, dto: KioskRequestDto) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: dto.employeeId },
      include: { user: { select: { isActive: true } } },
    });
    if (!employee || !employee.user.isActive) throw new NotFoundException('Karyawan tidak ditemukan atau sudah nonaktif');

    if (dto.method === KioskMethod.PIN) {
      const pin = await this.events.checkPin(device.deviceId, employee.attendancePinHash, dto.pin);
      if (pin === 'budget') throw new HttpException('Terlalu banyak PIN salah, coba lagi nanti', HttpStatus.TOO_MANY_REQUESTS);
      if (pin === 'wrong') throw new ForbiddenException('PIN salah');
    } else {
      const photo = decodePhoto(dto.photoBase64, 'Foto');
      const check = await this.faceEnrollment.scoreAgainst(employee.id, photo.buffer);
      if (!check.enrolled) throw new BadRequestException('Wajah belum terdaftar, ajukan dengan PIN');
      if (check.reason) throw new ForbiddenException('Wajah tidak cocok, ajukan dengan PIN');
    }

    const request = await this.requests.createForProfile(employee, {
      type: dto.type,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason,
    });
    return { id: request.id, type: request.type, status: request.status, startDate: request.startDate, endDate: request.endDate, totalDays: request.totalDays };
  }
}
