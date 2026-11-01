import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateKasbonDto, CreateGeneralRequestDto, ApprovalActionDto } from './requests.dto';
import { RequestStatus, RequestType, UserRole } from '@prisma/client';

@Injectable()
export class RequestsService {
  constructor(private prisma: PrismaService) {}

  async createKasbon(userId: string, dto: CreateKasbonDto) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: {
        kasbonLoans: { where: { isFullyPaid: false } },
      },
    });

    if (!profile) throw new NotFoundException('Profil karyawan tidak ditemukan');

    // Cek apakah masih memiliki tanggungan kasbon aktif yang belum lunas
    if (profile.kasbonLoans.length > 0) {
      throw new BadRequestException('Anda masih memiliki pinjaman kasbon yang belum lunas');
    }

    const tenor = dto.tenorMonths || 1;
    const monthly = dto.amount / tenor;

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.employeeRequest.create({
        data: {
          employeeId: profile.id,
          type: RequestType.KASBON,
          status: RequestStatus.PENDING_STORE_MANAGER,
          reason: dto.reason,
        },
      });

      const kasbon = await tx.kasbonLoan.create({
        data: {
          requestId: request.id,
          employeeId: profile.id,
          amount: dto.amount,
          tenorMonths: tenor,
          monthlyDeduction: monthly,
          remainingAmount: dto.amount,
          isFullyPaid: false,
        },
      });

      return { request, kasbon };
    });
  }

  async createGeneralRequest(userId: string, dto: CreateGeneralRequestDto) {
    const profile = await this.prisma.employeeProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil karyawan tidak ditemukan');

    let totalDays = 1;
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (dto.startDate) {
      startDate = new Date(dto.startDate);
      endDate = dto.endDate ? new Date(dto.endDate) : startDate;

      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // Jika cuti tahunan, validasi sisa kuota cuti
    if (dto.type === RequestType.CUTI_TAHUNAN) {
      if (profile.leaveBalance < totalDays) {
        throw new BadRequestException(
          `Sisa kuota cuti Anda (${profile.leaveBalance} hari) tidak mencukupi untuk pengajuan ${totalDays} hari`,
        );
      }
    }

    return this.prisma.employeeRequest.create({
      data: {
        employeeId: profile.id,
        type: dto.type,
        status: RequestStatus.PENDING_STORE_MANAGER,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason,
        attachmentUrl: dto.attachmentUrl,
        targetEmployeeId: dto.targetEmployeeId,
      },
    });
  }

  async getMyRequests(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil karyawan tidak ditemukan');

    return this.prisma.employeeRequest.findMany({
      where: { employeeId: profile.id },
      include: { kasbonLoan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAdminRequests(outletId?: string, status?: RequestStatus, type?: RequestType) {
    return this.prisma.employeeRequest.findMany({
      where: {
        ...(status && { status }),
        ...(type && { type }),
        ...(outletId && { employee: { outletId } }),
      },
      include: {
        employee: {
          include: {
            outlet: true,
            position: true,
          },
        },
        kasbonLoan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveOrRejectByStoreManager(requestId: string, reviewerId: string, dto: ApprovalActionDto) {
    const request = await this.prisma.employeeRequest.findUnique({
      where: { id: requestId },
      include: { employee: true },
    });

    if (!request) throw new NotFoundException('Pengajuan tidak ditemukan');
    if (request.status !== RequestStatus.PENDING_STORE_MANAGER) {
      throw new BadRequestException('Status pengajuan ini sudah bukan menunggu Store Manager');
    }

    if (dto.action === 'REJECT') {
      return this.prisma.employeeRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.REJECTED,
          managerNotes: dto.notes,
          approvedBySmId: reviewerId,
          approvedAtSm: new Date(),
        },
      });
    }

    // Jika disetujui Store Manager -> Lanjut ke HR/Finance
    return this.prisma.employeeRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.PENDING_HR,
        managerNotes: dto.notes,
        approvedBySmId: reviewerId,
        approvedAtSm: new Date(),
      },
    });
  }

  async approveOrRejectByHr(requestId: string, hrUserId: string, dto: ApprovalActionDto) {
    const request = await this.prisma.employeeRequest.findUnique({
      where: { id: requestId },
      include: { employee: true, kasbonLoan: true },
    });

    if (!request) throw new NotFoundException('Pengajuan tidak ditemukan');
    if (request.status !== RequestStatus.PENDING_HR) {
      throw new BadRequestException('Status pengajuan ini harus berada di tahap PENDING_HR');
    }

    if (dto.action === 'REJECT') {
      return this.prisma.employeeRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.REJECTED,
          hrNotes: dto.notes,
          approvedByHrId: hrUserId,
          approvedAtHr: new Date(),
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Jika Cuti Tahunan, potong leaveBalance karyawan
      if (request.type === RequestType.CUTI_TAHUNAN && request.totalDays) {
        await tx.employeeProfile.update({
          where: { id: request.employeeId },
          data: { leaveBalance: { decrement: request.totalDays } },
        });
      }

      // Khusus kasbon, status menjadi APPROVED (siap dicairkan / DISBURSED)
      return tx.employeeRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.APPROVED,
          hrNotes: dto.notes,
          approvedByHrId: hrUserId,
          approvedAtHr: new Date(),
        },
      });
    });
  }

  async disburseKasbon(requestId: string) {
    const request = await this.prisma.employeeRequest.findUnique({
      where: { id: requestId },
      include: { kasbonLoan: true },
    });

    if (!request || !request.kasbonLoan) {
      throw new NotFoundException('Data pengajuan kasbon tidak ditemukan');
    }

    if (request.status !== RequestStatus.APPROVED) {
      throw new BadRequestException('Kasbon harus berstatus APPROVED oleh HR sebelum dicairkan');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.employeeRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.DISBURSED },
      }),
      this.prisma.kasbonLoan.update({
        where: { id: request.kasbonLoan.id },
        data: { disbursedAt: now },
      }),
    ]);

    return { message: 'Dana kasbon berhasil dicairkan', disbursedAt: now };
  }
}
