import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BankChangeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { businessDateString, parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { BankChangeDto, UpdateMyProfileDto } from './profile.dto';

const EMPLOYEE_SUMMARY = {
  select: {
    id: true,
    nik: true,
    fullName: true,
    bankName: true,
    bankAccountNumber: true,
    bankAccountHolder: true,
    outlet: { select: { name: true } },
    position: { select: { title: true } },
  },
} as const;

/**
 * Data diri kru (dari aplikasi HP) dan pengajuan perubahan rekening gaji.
 * Data pribadi langsung tersimpan; rekening baru berlaku setelah disetujui HR.
 */
@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  private async profileOf(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new NotFoundException('Akun ini tidak punya data karyawan');
    return profile.id;
  }

  async myProfile(userId: string) {
    const id = await this.profileOf(userId);
    const [p, lastChange] = await Promise.all([
      this.prisma.employeeProfile.findUniqueOrThrow({
        where: { id },
        include: {
          user: { select: { username: true, email: true } },
          outlet: { select: { name: true } },
          position: { select: { title: true } },
        },
      }),
      this.prisma.bankAccountChange.findFirst({ where: { employeeId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      nik: p.nik,
      fullName: p.fullName,
      username: p.user.username,
      phone: p.phone,
      email: p.user.email,
      birthDate: p.birthDate ? businessDateString(p.birthDate) : null,
      gender: p.gender,
      address: p.address,
      outlet: p.outlet.name,
      position: p.position.title,
      status: p.status,
      joinDate: businessDateString(p.joinDate),
      bank: { bankName: p.bankName, bankAccountNumber: p.bankAccountNumber, bankAccountHolder: p.bankAccountHolder },
      // Pengajuan terakhir: yang menunggu, atau keputusan HR yang belum lama
      bankChange: lastChange
        ? {
            status: lastChange.status,
            bankName: lastChange.bankName,
            bankAccountNumber: lastChange.bankAccountNumber,
            bankAccountHolder: lastChange.bankAccountHolder,
            note: lastChange.note,
            createdAt: lastChange.createdAt,
            reviewedAt: lastChange.reviewedAt,
          }
        : null,
      needsCompletion: !p.birthDate || !p.gender || !p.address,
    };
  }

  async updateMyProfile(userId: string, dto: UpdateMyProfileDto) {
    const id = await this.profileOf(userId);
    let birthDate: Date;
    try {
      birthDate = toDateOnly(parseDateParam(dto.birthDate));
    } catch {
      throw new BadRequestException('Tanggal lahir tidak valid');
    }
    if (dto.birthDate >= businessDateString(new Date()) || dto.birthDate < '1930-01-01') {
      throw new BadRequestException('Tanggal lahir tidak masuk akal');
    }
    const email = dto.email ?? null;
    if (email) {
      const taken = await this.prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
      if (taken) throw new ConflictException(`Email ${email} sudah dipakai akun lain`);
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { email } }),
      this.prisma.employeeProfile.update({
        where: { id },
        data: { phone: dto.phone, birthDate, gender: dto.gender, address: dto.address },
      }),
    ]);
    return this.myProfile(userId);
  }

  /** Ajukan rekening baru. Pengajuan yang masih menunggu diganti dengan isian terbaru. */
  async requestBankChange(userId: string, dto: BankChangeDto) {
    const employeeId = await this.profileOf(userId);
    const data = { bankName: dto.bankName, bankAccountNumber: dto.bankAccountNumber, bankAccountHolder: dto.bankAccountHolder };
    await this.prisma.$transaction(async (tx) => {
      const pending = await tx.bankAccountChange.findFirst({ where: { employeeId, status: BankChangeStatus.PENDING } });
      if (pending) {
        await tx.bankAccountChange.update({ where: { id: pending.id }, data: { ...data, createdAt: new Date() } });
      } else {
        await tx.bankAccountChange.create({ data: { employeeId, ...data } });
      }
    });
    return this.myProfile(userId);
  }

  /** Batalkan pengajuan rekening yang masih menunggu. */
  async cancelBankChange(userId: string) {
    const employeeId = await this.profileOf(userId);
    await this.prisma.bankAccountChange.deleteMany({ where: { employeeId, status: BankChangeStatus.PENDING } });
    return this.myProfile(userId);
  }

  list(status?: BankChangeStatus) {
    return this.prisma.bankAccountChange.findMany({
      where: status ? { status } : {},
      include: { employee: EMPLOYEE_SUMMARY, reviewedBy: { select: { username: true } } },
      orderBy: { createdAt: status === BankChangeStatus.PENDING ? 'asc' : 'desc' },
      take: status === BankChangeStatus.PENDING ? undefined : 100,
    });
  }

  /** Setujui: rekening karyawan diganti. Klaim bersyarat agar dua HR tidak memproses bersamaan. */
  async approve(reviewerId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const change = await tx.bankAccountChange.findUnique({ where: { id } });
      if (!change) throw new NotFoundException('Pengajuan tidak ditemukan');
      const claimed = await tx.bankAccountChange.updateMany({
        where: { id, status: BankChangeStatus.PENDING },
        data: { status: BankChangeStatus.APPROVED, reviewedById: reviewerId, reviewedAt: new Date() },
      });
      if (!claimed.count) throw new ConflictException('Pengajuan ini sudah diproses');
      await tx.employeeProfile.update({
        where: { id: change.employeeId },
        data: { bankName: change.bankName, bankAccountNumber: change.bankAccountNumber, bankAccountHolder: change.bankAccountHolder },
      });
      return tx.bankAccountChange.findUniqueOrThrow({ where: { id }, include: { employee: EMPLOYEE_SUMMARY } });
    });
  }

  async reject(reviewerId: string, id: string, note: string) {
    const change = await this.prisma.bankAccountChange.findUnique({ where: { id }, select: { id: true } });
    if (!change) throw new NotFoundException('Pengajuan tidak ditemukan');
    const claimed = await this.prisma.bankAccountChange.updateMany({
      where: { id, status: BankChangeStatus.PENDING },
      data: { status: BankChangeStatus.REJECTED, note, reviewedById: reviewerId, reviewedAt: new Date() },
    });
    if (!claimed.count) throw new ConflictException('Pengajuan ini sudah diproses');
    return this.prisma.bankAccountChange.findUniqueOrThrow({ where: { id }, include: { employee: EMPLOYEE_SUMMARY } });
  }
}
