import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateKasbonDto, CreateGeneralRequestDto, ApprovalActionDto } from './requests.dto';
import { Prisma, RequestStatus, RequestType } from '@prisma/client';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { businessDateTime, daysBetween, parseDateParam } from '../../common/utils/business-date.util';

const MAX_REQUEST_DAYS = 366;

@Injectable()
export class RequestsService {
  constructor(private prisma: PrismaService) {}

  async createKasbon(userId: string, dto: CreateKasbonDto) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: {
        kasbonLoans: {
          where: {
            isFullyPaid: false,
            request: { status: { notIn: [RequestStatus.REJECTED, RequestStatus.CANCELLED] } },
          },
        },
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
    let startDate: Date;
    let endDate: Date;

    {
      // Tanggal kalender di zona bisnis; jam dari perangkat diabaikan
      const startYmd = parseDateParam(dto.startDate.slice(0, 10));
      const endYmd = dto.endDate ? parseDateParam(dto.endDate.slice(0, 10)) : startYmd;
      totalDays = daysBetween(startYmd, endYmd) + 1;
      if (totalDays < 1) {
        throw new BadRequestException('Tanggal selesai tidak boleh sebelum tanggal mulai');
      }
      if (totalDays > MAX_REQUEST_DAYS) {
        throw new BadRequestException(`Satu pengajuan maksimal ${MAX_REQUEST_DAYS} hari`);
      }
      startDate = businessDateTime(startYmd, '00:00');
      endDate = businessDateTime(endYmd, '00:00');
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

  async getAdminRequests(
    actor: AuthUser,
    outletId?: string,
    status?: RequestStatus,
    type?: RequestType,
  ) {
    outletId = scopedOutletId(actor, outletId);

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

  async approveOrRejectByStoreManager(requestId: string, reviewer: AuthUser, dto: ApprovalActionDto) {
    const request = await this.prisma.employeeRequest.findUnique({
      where: { id: requestId },
      include: { employee: true },
    });

    if (!request) throw new NotFoundException('Pengajuan tidak ditemukan');
    assertOutletAccess(reviewer, request.employee.outletId, 'Anda hanya bisa memproses pengajuan karyawan di outlet Anda');
    this.requireRejectNote(dto);

    // Disetujui Store Manager -> lanjut ke HR/Finance
    return this.transition(this.prisma, requestId, RequestStatus.PENDING_STORE_MANAGER, {
      status: dto.action === 'REJECT' ? RequestStatus.REJECTED : RequestStatus.PENDING_HR,
      managerNotes: dto.notes,
      approvedBySmId: reviewer.id,
      approvedAtSm: new Date(),
    });
  }

  async approveOrRejectByHr(requestId: string, hrUserId: string, dto: ApprovalActionDto) {
    const request = await this.prisma.employeeRequest.findUnique({
      where: { id: requestId },
      include: { employee: true },
    });

    if (!request) throw new NotFoundException('Pengajuan tidak ditemukan');
    this.requireRejectNote(dto);

    const review = {
      hrNotes: dto.notes,
      approvedByHrId: hrUserId,
      approvedAtHr: new Date(),
    };

    if (dto.action === 'REJECT') {
      return this.transition(this.prisma, requestId, RequestStatus.PENDING_HR, {
        status: RequestStatus.REJECTED,
        ...review,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Status dikunci lebih dulu agar persetujuan ganda tidak memotong cuti dua kali
      const updated = await this.transition(tx, requestId, RequestStatus.PENDING_HR, {
        status: RequestStatus.APPROVED,
        ...review,
      });

      if (request.type === RequestType.CUTI_TAHUNAN && request.totalDays) {
        const deducted = await tx.employeeProfile.updateMany({
          where: { id: request.employeeId, leaveBalance: { gte: request.totalDays } },
          data: { leaveBalance: { decrement: request.totalDays } },
        });
        if (deducted.count === 0) {
          throw new BadRequestException('Sisa kuota cuti karyawan sudah tidak mencukupi');
        }
      }

      return updated;
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

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, requestId, RequestStatus.APPROVED, { status: RequestStatus.DISBURSED });
      await tx.kasbonLoan.update({
        where: { id: request.kasbonLoan!.id },
        data: { disbursedAt: now },
      });
    });

    return { message: 'Dana kasbon berhasil dicairkan', disbursedAt: now };
  }

  private requireRejectNote(dto: ApprovalActionDto) {
    if (dto.action === 'REJECT' && !dto.notes?.trim()) {
      throw new BadRequestException('Alasan penolakan wajib diisi');
    }
  }

  /**
   * Mengubah status hanya jika masih di tahap yang diharapkan,
   * sehingga dua admin yang menekan tombol bersamaan tidak saling menimpa.
   */
  private async transition(
    db: Prisma.TransactionClient,
    requestId: string,
    from: RequestStatus,
    data: Prisma.EmployeeRequestUpdateManyMutationInput,
  ) {
    const result = await db.employeeRequest.updateMany({
      where: { id: requestId, status: from },
      data,
    });
    if (result.count === 0) {
      throw new ConflictException('Pengajuan ini sudah diproses atau statusnya berubah. Muat ulang data.');
    }
    return db.employeeRequest.findUniqueOrThrow({ where: { id: requestId } });
  }
}
