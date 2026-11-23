import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CoachingStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { CreateCoachingDto, SetCoachingStatusDto, UpdateCoachingDto } from './coaching.dto';

/** Peran yang boleh menjadi pendamping. */
export const COACH_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER];

const OPEN: CoachingStatus[] = [CoachingStatus.PLANNED, CoachingStatus.IN_PROGRESS];

const INCLUDE = {
  employee: {
    select: {
      id: true,
      fullName: true,
      nik: true,
      position: { select: { title: true } },
    },
  },
  outlet: { select: { id: true, name: true } },
  coach: { select: { id: true, username: true, profile: { select: { fullName: true } } } },
  createdBy: { select: { username: true, profile: { select: { fullName: true } } } },
} satisfies Prisma.CoachingSessionInclude;

@Injectable()
export class CoachingService {
  constructor(private prisma: PrismaService) {}

  list(actor: AuthUser, outletId?: string, status?: string) {
    outletId = scopedOutletId(actor, outletId);
    const statusFilter = Object.values(CoachingStatus).includes(status as CoachingStatus) ? (status as CoachingStatus) : undefined;
    return this.prisma.coachingSession.findMany({
      where: { ...(outletId && { outletId }), ...(statusFilter && { status: statusFilter }) },
      include: INCLUDE,
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  /** Akun yang bisa dipilih sebagai pendamping (Kepala Cabang: hanya dirinya sendiri). */
  coaches(actor: AuthUser) {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: COACH_ROLES },
        ...(actor.role === UserRole.STORE_MANAGER && { id: actor.id }),
      },
      select: { id: true, username: true, role: true, profile: { select: { fullName: true } } },
      orderBy: { username: 'asc' },
    });
  }

  async create(actor: AuthUser, dto: CreateCoachingDto) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: dto.employeeId },
      include: { user: { select: { isActive: true } } },
    });
    if (!employee || !employee.user.isActive) throw new NotFoundException('Karyawan tidak ditemukan atau sudah nonaktif');
    assertOutletAccess(actor, employee.outletId, 'Anda hanya bisa menjadwalkan pendampingan untuk kru di cabang Anda');
    const coachId = await this.resolveCoach(actor, dto.coachId ?? actor.id);
    return this.prisma.coachingSession.create({
      data: {
        employeeId: employee.id,
        outletId: employee.outletId,
        coachId,
        createdById: actor.id,
        topic: dto.topic,
        scheduledDate: toDateOnly(parseDateParam(dto.scheduledDate)),
        priority: dto.priority,
      },
      include: INCLUDE,
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateCoachingDto) {
    const session = await this.getOpen(actor, id);
    const coachId = await this.resolveCoach(actor, dto.coachId);
    return this.prisma.coachingSession.update({
      where: { id: session.id },
      data: {
        topic: dto.topic,
        scheduledDate: toDateOnly(parseDateParam(dto.scheduledDate)),
        priority: dto.priority,
        coachId,
      },
      include: INCLUDE,
    });
  }

  async setStatus(actor: AuthUser, id: string, dto: SetCoachingStatusDto) {
    const session = await this.getOpen(actor, id);
    if (dto.status === CoachingStatus.IN_PROGRESS && session.status !== CoachingStatus.PLANNED) {
      throw new BadRequestException('Sesi ini sudah berjalan');
    }
    if (dto.status === CoachingStatus.DONE && !dto.resultNote) {
      throw new BadRequestException('Isi catatan hasil sebelum menandai sesi selesai');
    }
    const now = new Date();
    // Klaim bersyarat: dua orang yang menekan bersamaan tidak bisa sama-sama mengubah status
    const { count } = await this.prisma.coachingSession.updateMany({
      where: { id: session.id, status: session.status },
      data: {
        status: dto.status,
        ...(dto.status === CoachingStatus.IN_PROGRESS && { startedAt: now }),
        ...(dto.status === CoachingStatus.DONE && {
          completedAt: now,
          startedAt: session.startedAt ?? now,
          resultNote: dto.resultNote,
        }),
      },
    });
    if (count === 0) throw new BadRequestException('Status sesi sudah diubah orang lain, muat ulang halaman');
    return this.prisma.coachingSession.findUnique({ where: { id: session.id }, include: INCLUDE });
  }

  private async getOpen(actor: AuthUser, id: string) {
    const session = await this.prisma.coachingSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Sesi pendampingan tidak ditemukan');
    assertOutletAccess(actor, session.outletId, 'Sesi ini milik cabang lain');
    if (!OPEN.includes(session.status)) throw new BadRequestException('Sesi yang sudah selesai atau dibatalkan tidak bisa diubah');
    return session;
  }

  private async resolveCoach(actor: AuthUser, coachId: string) {
    if (actor.role === UserRole.STORE_MANAGER && coachId !== actor.id) {
      throw new ForbiddenException('Kepala Cabang hanya bisa menjadwalkan dirinya sendiri sebagai pendamping');
    }
    const coach = await this.prisma.user.findUnique({ where: { id: coachId }, select: { id: true, role: true, isActive: true } });
    if (!coach || !coach.isActive || !COACH_ROLES.includes(coach.role)) {
      throw new BadRequestException('Pendamping harus akun admin atau kepala cabang yang aktif');
    }
    return coach.id;
  }
}
