import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './employees.dto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(outletId?: string, departmentId?: string) {
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

  async findOne(id: string) {
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

  async create(dto: CreateEmployeeDto) {
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
          joinDate: new Date(dto.joinDate),
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
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
    await this.findOne(id);
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
    const employee = await this.findOne(id);
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
}
