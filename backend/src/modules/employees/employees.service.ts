import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './employees.dto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { parseDateParam, toDateOnly } from '../../common/utils/business-date.util';

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN];

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(actor: AuthUser, outletId?: string, departmentId?: string) {
    outletId = scopedOutletId(actor, outletId);
    return this.prisma.employeeProfile.findMany({
      where: {
        ...(outletId && { outletId }),
        ...(departmentId && { position: { departmentId } }),
      },
      include: {
        user: { select: { id: true, username: true, email: true, role: true, isActive: true } },
        outlet: { select: { id: true, code: true, name: true } },
        position: {
          select: {
            id: true,
            title: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const employee = await this.getOrThrow(id);
    assertOutletAccess(actor, employee.outletId, 'Anda hanya bisa melihat karyawan di outlet Anda');
    return employee;
  }

  private async getOrThrow(id: string) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, email: true, role: true, isActive: true } },
        outlet: true,
        position: { include: { department: true } },
        sanctions: { orderBy: { incidentDate: 'desc' }, take: 5 },
        discResults: { orderBy: { testedAt: 'desc' }, take: 1 },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Karyawan dengan ID ${id} tidak ditemukan`);
    }
    return employee;
  }

  async create(actor: AuthUser, dto: CreateEmployeeDto) {
    // Akun admin (HR, Keuangan, Super Admin) hanya boleh dibuat Super Admin
    const role = dto.role ?? UserRole.EMPLOYEE;
    if (ADMIN_ROLES.includes(role) && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Hanya Super Admin yang bisa membuat akun admin');
    }

    // Cek username atau email atau NIK
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });
    if (existingUser) {
      throw new ConflictException('Username atau email sudah digunakan');
    }

    const existingNik = await this.prisma.employeeProfile.findUnique({
      where: { nik: dto.nik },
    });
    if (existingNik) {
      throw new ConflictException(`NIK ${dto.nik} sudah terdaftar`);
    }

    await this.assertOutletAndPosition(dto.outletId, dto.positionId);
    const joinDate = toDateOnly(parseDateParam(dto.joinDate.slice(0, 10)));
    const birthDate = dto.birthDate ? toDateOnly(parseDateParam(dto.birthDate.slice(0, 10))) : undefined;

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash: hashedPassword,
          role: dto.role || UserRole.EMPLOYEE,
        },
      });

      const profile = await tx.employeeProfile.create({
        data: {
          userId: user.id,
          nik: dto.nik,
          fullName: dto.fullName,
          phone: dto.phone,
          outletId: dto.outletId,
          positionId: dto.positionId,
          status: dto.status,
          joinDate,
          birthDate,
          gender: dto.gender,
          address: dto.address,
          bankName: dto.bankName,
          bankAccountNumber: dto.bankAccountNumber,
          bankAccountHolder: dto.bankAccountHolder,
        },
        include: {
          user: { select: { id: true, username: true, role: true } },
          outlet: true,
          position: true,
        },
      });

      return profile;
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.getOrThrow(id);
    await this.assertOutletAndPosition(dto.outletId, dto.positionId);
    return this.prisma.employeeProfile.update({
      where: { id },
      data: dto,
      include: {
        user: { select: { id: true, username: true, role: true } },
        outlet: true,
        position: true,
      },
    });
  }

  async toggleActiveStatus(id: string) {
    const employee = await this.getOrThrow(id);
    const updated = await this.prisma.user.update({
      where: { id: employee.userId },
      data: { isActive: !employee.user.isActive },
    });

    return {
      message: `Status karyawan ${employee.fullName} berhasil diubah menjadi ${
        updated.isActive ? 'Aktif' : 'Non-aktif'
      }`,
      isActive: updated.isActive,
    };
  }

  /** Daftar jabatan untuk pilihan di form karyawan. */
  async listPositions() {
    return this.prisma.position.findMany({
      select: { id: true, title: true, department: { select: { id: true, name: true } } },
      orderBy: [{ department: { name: 'asc' } }, { title: 'asc' }],
    });
  }

  private async assertOutletAndPosition(outletId?: string, positionId?: string) {
    if (outletId) {
      const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
      if (!outlet) throw new BadRequestException('Cabang tidak ditemukan');
      if (!outlet.isActive) throw new BadRequestException(`Cabang ${outlet.name} sudah nonaktif`);
    }
    if (positionId && !(await this.prisma.position.findUnique({ where: { id: positionId } }))) {
      throw new BadRequestException('Jabatan tidak ditemukan');
    }
  }
}
