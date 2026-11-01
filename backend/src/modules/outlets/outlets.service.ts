import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOutletDto, UpdateOutletDto } from './outlets.dto';

@Injectable()
export class OutletsService {
  constructor(private prisma: PrismaService) {}

  async findAll(onlyActive = true) {
    return this.prisma.outlet.findMany({
      where: onlyActive ? { isActive: true } : {},
      include: {
        _count: {
          select: { employees: true, shifts: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
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
    const existing = await this.prisma.outlet.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Kode outlet ${dto.code} sudah digunakan`);
    }

    return this.prisma.outlet.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        geofenceRadius: dto.geofenceRadius ?? 50,
        wifiBssid: dto.wifiBssid,
      },
    });
  }

  async update(id: string, dto: UpdateOutletDto) {
    await this.findOne(id);
    return this.prisma.outlet.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete dengan nonaktifkan status
    return this.prisma.outlet.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
