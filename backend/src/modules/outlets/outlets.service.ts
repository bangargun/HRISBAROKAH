import { BadRequestException, Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
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
        manager: { select: { id: true, fullName: true } },
        _count: { select: { employees: true } },
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
        manager: { select: { id: true, fullName: true } },
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

    this.assertHours(dto);
    // Cabang baru belum punya karyawan, jadi Kepala Cabang dipilih setelah karyawannya didaftarkan
    if (dto.managerId) throw new BadRequestException('Pilih Kepala Cabang setelah karyawannya terdaftar di cabang ini');

    return this.prisma.outlet.create({
      data: { ...dto, managerId: undefined },
      include: { manager: { select: { id: true, fullName: true } }, _count: { select: { employees: true } } },
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateOutletDto) {
    const current = await this.getOrThrow(id);
    this.assertHours({ ...current, ...dto });
    if (dto.managerId) await this.assertManager(id, dto.managerId);
    // Status aktif mengikuti aturan hapus (DELETE): hanya Super Admin dan HR
    if (dto.isActive !== undefined && actor.role !== UserRole.SUPER_ADMIN && actor.role !== UserRole.HR_ADMIN) {
      throw new ForbiddenException('Hanya Super Admin atau HR yang bisa mengaktifkan atau menonaktifkan cabang');
    }
    if (dto.isActive === false) await this.assertNoActiveStaff(id);
    return this.prisma.outlet.update({
      where: { id },
      data: dto,
      include: { manager: { select: { id: true, fullName: true } }, _count: { select: { employees: true } } },
    });
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    await this.assertNoActiveStaff(id);
    // Soft delete: riwayat absensi dan gaji tetap merujuk ke cabang ini
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

  /** Jam selesai lebih kecil dari jam mulai berarti lewat tengah malam (sah); yang tidak boleh: sama persis. */
  private assertHours(fields: object) {
    const o = fields as Record<string, unknown>;
    const labels = { weekday: 'weekday', weekend: 'weekend', holiday: 'libur nasional' } as const;
    for (const [key, label] of Object.entries(labels)) {
      const start = o[`${key}WorkStart`];
      const end = o[`${key}WorkEnd`];
      if (start && end && start === end) {
        throw new BadRequestException(`Jam mulai dan selesai kerja ${label} tidak boleh sama`);
      }
      const open = o[`${key}Open`];
      const close = o[`${key}Close`];
      if (!!open !== !!close) {
        throw new BadRequestException(`Isi jam buka dan jam tutup ${label} keduanya, atau kosongkan keduanya`);
      }
      if (open && open === close) {
        throw new BadRequestException(`Jam buka dan tutup ${label} tidak boleh sama`);
      }
    }
  }

  /** Kepala Cabang harus karyawan aktif cabang ini yang berperan Store Manager. */
  private async assertManager(outletId: string, managerId: string) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: managerId },
      include: { user: { select: { role: true, isActive: true } } },
    });
    if (!employee || employee.outletId !== outletId) {
      throw new BadRequestException('Kepala Cabang harus karyawan dari cabang ini');
    }
    if (employee.user.role !== UserRole.STORE_MANAGER || !employee.user.isActive) {
      throw new BadRequestException(`${employee.fullName} bukan Kepala Cabang (Store Manager) yang aktif`);
    }
  }
}
