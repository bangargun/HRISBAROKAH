import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOutletDto, UpdateOutletDto } from './outlets.dto';

@Injectable()
export class OutletsService {
  constructor(private prisma: PrismaService) {}

  async findAll(actor: AuthUser, onlyActive = true) {
    const ownOutlet = scopedOutletId(actor);
    return this.prisma.outlet.findMany({
      where: {
        ...(onlyActive && { isActive: true }),
        ...(ownOutlet && { id: ownOutlet }),
      },
      include: {
        _count: {
          select: { employees: true, shifts: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const outlet = await this.getOrThrow(id);
    assertOutletAccess(actor, outlet.id, 'Anda hanya bisa melihat outlet Anda sendiri');
    return outlet;
  }

  private async getOrThrow(id: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id },
      include: {
        shifts: true,
        employees: {
          include: {
            user: { select: { id: true, username: true, role: true } },
            position: { include: { department: true } },
          },
        },
      },
    });

    if (!outlet) {
      throw new NotFoundException(`Outlet dengan ID ${id} tidak ditemukan`);
    }
    return outlet;
  }

  async create(dto: CreateOutletDto) {
    // DTO sudah menyeragamkan kode ke huruf besar, jadi cek dan simpan memakai nilai yang sama
    const existing = await this.prisma.outlet.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Kode cabang ${dto.code} sudah digunakan`);
    }

    return this.prisma.outlet.create({
      data: {
        code: dto.code,
        name: dto.name,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        geofenceRadius: dto.geofenceRadius ?? 50,
        wifiBssid: dto.wifiBssid,
      },
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateOutletDto) {
    await this.getOrThrow(id);
    // Status aktif mengikuti aturan hapus (DELETE): hanya Super Admin dan HR
    if (dto.isActive !== undefined && actor.role !== UserRole.SUPER_ADMIN && actor.role !== UserRole.HR_ADMIN) {
      throw new ForbiddenException('Hanya Super Admin atau HR yang bisa mengaktifkan atau menonaktifkan cabang');
    }
    if (dto.isActive === false) await this.assertNoActiveStaff(id);
    return this.prisma.outlet.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    await this.assertNoActiveStaff(id);
    // Soft delete: riwayat absensi dan shift tetap merujuk ke cabang ini
    return this.prisma.outlet.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async assertNoActiveStaff(id: string) {
    const activeStaff = await this.prisma.employeeProfile.count({
      where: { outletId: id, user: { isActive: true } },
    });
    if (activeStaff > 0) {
      throw new ConflictException(
        `Cabang ini masih punya ${activeStaff} karyawan aktif. Pindahkan atau nonaktifkan karyawannya lebih dulu.`,
      );
    }
  }
}
