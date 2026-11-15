import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShiftDto, UpdateShiftDto } from './shifts.dto';

const SHIFT_INCLUDE = {
  outlet: { select: { id: true, code: true, name: true } },
  _count: { select: { schedules: true } },
} as const;

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async findAll(actor: AuthUser, outletId?: string) {
    outletId = scopedOutletId(actor, outletId);

    return this.prisma.shift.findMany({
      where: outletId ? { outletId } : {},
      include: SHIFT_INCLUDE,
      orderBy: [{ outlet: { name: 'asc' } }, { startTime: 'asc' }],
    });
  }

  async create(dto: CreateShiftDto) {
    const outlet = await this.prisma.outlet.findUnique({ where: { id: dto.outletId } });
    if (!outlet) throw new NotFoundException('Outlet tidak ditemukan');

    const name = this.cleanName(dto.name);
    this.assertValidWindow(dto.startTime, dto.endTime);
    await this.assertUniqueName(dto.outletId, name);

    return this.prisma.shift.create({
      data: { ...dto, name },
      include: SHIFT_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateShiftDto) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Shift tidak ditemukan');

    const name = dto.name === undefined ? undefined : this.cleanName(dto.name);
    this.assertValidWindow(dto.startTime ?? shift.startTime, dto.endTime ?? shift.endTime);
    if (name && name.toLowerCase() !== shift.name.toLowerCase()) {
      await this.assertUniqueName(shift.outletId, name);
    }

    return this.prisma.shift.update({
      where: { id },
      data: { ...dto, ...(name && { name }) },
      include: SHIFT_INCLUDE,
    });
  }

  async remove(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: { _count: { select: { schedules: true } } },
    });
    if (!shift) throw new NotFoundException('Shift tidak ditemukan');

    // Jadwal kerja dan absensi lama merujuk ke shift ini; menghapusnya akan merusak riwayat
    if (shift._count.schedules > 0) {
      throw new ConflictException(
        `Shift "${shift.name}" sudah dipakai di ${shift._count.schedules} jadwal kerja sehingga tidak bisa dihapus`,
      );
    }

    await this.prisma.shift.delete({ where: { id } });
    return { message: `Shift "${shift.name}" dihapus` };
  }

  // Jam selesai lebih kecil dari jam mulai berarti shift melewati tengah malam, dan itu sah
  private assertValidWindow(startTime: string, endTime: string) {
    if (startTime === endTime) {
      throw new BadRequestException('Jam mulai dan jam selesai tidak boleh sama');
    }
  }

  private cleanName(raw: string) {
    const name = raw.trim();
    if (!name) throw new BadRequestException('Nama shift wajib diisi');
    return name;
  }

  private async assertUniqueName(outletId: string, name: string) {
    const existing = await this.prisma.shift.findFirst({
      where: { outletId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException(`Shift "${name}" sudah ada di outlet ini`);
  }
}
