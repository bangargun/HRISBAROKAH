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

  async update(actor: AuthUser, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.getOrThrow(id);
    const roleChanges = dto.role !== undefined && dto.role !== employee.user.role;
    if (roleChanges) {
      if (employee.userId === actor.id) {
        throw new ForbiddenException('Anda tidak bisa mengubah peran akun Anda sendiri');
      }
      this.assertCanManageAdmin(actor, employee.user.role, dto.role);
    } else {
      this.assertCanManageAdmin(actor, employee.user.role);
    }

    if (dto.nik && dto.nik !== employee.nik) {
      const taken = await this.prisma.employeeProfile.findUnique({ where: { nik: dto.nik } });
      if (taken) throw new ConflictException(`NIK ${dto.nik} sudah terdaftar`);
    }
    if (dto.outletId !== employee.outletId) await this.assertOutletAndPosition(dto.outletId, undefined);
    await this.assertOutletAndPosition(undefined, dto.positionId);

    // Kepala cabang yang pindah cabang atau berganti peran dilepas dari jabatan kepala cabangnya
    const leavesManagerPost =
      (dto.outletId !== undefined && dto.outletId !== employee.outletId) ||
      (roleChanges && dto.role !== UserRole.STORE_MANAGER);

    return this.prisma.$transaction(async (tx) => {
      if (leavesManagerPost) {
        await tx.outlet.updateMany({ where: { managerId: id }, data: { managerId: null } });
      }
      if (roleChanges) {
        await tx.user.update({ where: { id: employee.userId }, data: { role: dto.role } });
      }
      return tx.employeeProfile.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          nik: dto.nik,
          phone: dto.phone,
          outletId: dto.outletId,
          positionId: dto.positionId,
          status: dto.status,
          joinDate: dto.joinDate ? toDateOnly(parseDateParam(dto.joinDate.slice(0, 10))) : undefined,
          bankName: dto.bankName,
          bankAccountNumber: dto.bankAccountNumber,
          bankAccountHolder: dto.bankAccountHolder,
        },
        include: {
          user: { select: { id: true, username: true, role: true, isActive: true } },
          outlet: true,
          position: true,
        },
      });
    });
  }

  /** Aktifkan atau nonaktifkan akun. Akun nonaktif tidak bisa login dan tidak masuk hitungan gaji. */
  async setActive(actor: AuthUser, id: string, isActive: boolean) {
    const employee = await this.getOrThrow(id);
    if (employee.userId === actor.id) {
      throw new ForbiddenException('Anda tidak bisa menonaktifkan akun Anda sendiri');
    }
    this.assertCanManageAdmin(actor, employee.user.role);
    if (employee.user.isActive !== isActive) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: employee.userId }, data: { isActive } });
        if (!isActive) await tx.outlet.updateMany({ where: { managerId: id }, data: { managerId: null } });
        // Dipekerjakan kembali: tanggal keluar lama tidak berlaku lagi (gaji kembali dihitung penuh)
        if (isActive) await tx.employeeProfile.update({ where: { id }, data: { endDate: null } });
      });
    }
    return {
      message: `${employee.fullName} sekarang ${isActive ? 'aktif' : 'nonaktif'}`,
      isActive,
    };
  }

  /** Akun admin (HR, Keuangan, Super Admin) hanya boleh diubah oleh Super Admin. */
  private assertCanManageAdmin(actor: AuthUser, ...roles: (UserRole | undefined)[]) {
    if (actor.role !== UserRole.SUPER_ADMIN && roles.some((r) => r && ADMIN_ROLES.includes(r))) {
      throw new ForbiddenException('Hanya Super Admin yang bisa mengubah akun admin');
    }
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
