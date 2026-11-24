import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrainingSessionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { AttendanceDto, SaveSessionDto, SessionStatusDto } from './training.dto';

const INCLUDE = {
  module: { select: { id: true, code: true, title: true } },
  participants: {
    include: {
      employee: { select: { id: true, fullName: true, nik: true, outletId: true, outlet: { select: { name: true } }, position: { select: { title: true } } } },
    },
    orderBy: { employee: { fullName: 'asc' } },
  },
} satisfies Prisma.TrainingSessionInclude;

/** Jadwal pelatihan tatap muka / online dengan daftar hadir. */
@Injectable()
export class TrainingSessionsService {
  constructor(private prisma: PrismaService) {}

  /** Kepala Cabang hanya melihat sesi yang pesertanya ada kru cabangnya. */
  list(actor: AuthUser, outletId?: string) {
    const scoped = scopedOutletId(actor, outletId);
    return this.prisma.trainingSession.findMany({
      where: scoped ? { participants: { some: { employee: { outletId: scoped } } } } : {},
      include: INCLUDE,
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
      take: 300,
    });
  }

  async create(actor: AuthUser, dto: SaveSessionDto) {
    const data = await this.fields(dto);
    return this.prisma.trainingSession.create({
      data: {
        ...data,
        createdById: actor.id,
        participants: { create: [...new Set(dto.participantIds)].map((employeeId) => ({ employeeId })) },
      },
      include: INCLUDE,
    });
  }

  /** Ubah sesi; peserta yang sudah dicatat hadirnya tetap dipertahankan. */
  async update(id: string, dto: SaveSessionDto) {
    const session = await this.getOrThrow(id);
    if (session.status !== TrainingSessionStatus.PLANNED) throw new BadRequestException('Sesi yang selesai atau batal tidak bisa diubah');
    const data = await this.fields(dto);
    const wanted = new Set(dto.participantIds);
    return this.prisma.$transaction(async (tx) => {
      await tx.trainingSessionParticipant.deleteMany({ where: { sessionId: id, employeeId: { notIn: [...wanted] } } });
      const existing = new Set(
        (await tx.trainingSessionParticipant.findMany({ where: { sessionId: id }, select: { employeeId: true } })).map((p) => p.employeeId),
      );
      const add = [...wanted].filter((e) => !existing.has(e));
      if (add.length) await tx.trainingSessionParticipant.createMany({ data: add.map((employeeId) => ({ sessionId: id, employeeId })) });
      return tx.trainingSession.update({ where: { id }, data, include: INCLUDE });
    });
  }

  async setStatus(id: string, dto: SessionStatusDto) {
    const session = await this.getOrThrow(id);
    if (session.status !== TrainingSessionStatus.PLANNED) throw new BadRequestException('Status sesi ini sudah final');
    if (dto.status === TrainingSessionStatus.DONE) {
      const unmarked = await this.prisma.trainingSessionParticipant.count({ where: { sessionId: id, attended: null } });
      if (unmarked > 0) throw new BadRequestException(`Catat kehadiran semua peserta dulu (${unmarked} belum dicatat)`);
    }
    const { count } = await this.prisma.trainingSession.updateMany({
      where: { id, status: TrainingSessionStatus.PLANNED },
      data: { status: dto.status },
    });
    if (count === 0) throw new BadRequestException('Status sesi sudah diubah orang lain');
    return this.prisma.trainingSession.findUnique({ where: { id }, include: INCLUDE });
  }

  /** Catat hadir; Kepala Cabang hanya untuk kru cabangnya. */
  async attendance(actor: AuthUser, id: string, dto: AttendanceDto) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id },
      include: { participants: { include: { employee: { select: { outletId: true } } } } },
    });
    if (!session) throw new NotFoundException('Sesi tidak ditemukan');
    if (session.status === TrainingSessionStatus.CANCELLED) throw new BadRequestException('Sesi dibatalkan');
    const byEmployee = new Map(session.participants.map((p) => [p.employeeId, p]));
    const ownOutlet = actor.role === UserRole.STORE_MANAGER ? actor.profile?.outletId : undefined;
    for (const e of dto.entries) {
      const p = byEmployee.get(e.employeeId);
      if (!p) throw new BadRequestException('Ada karyawan yang bukan peserta sesi ini');
      if (actor.role === UserRole.STORE_MANAGER && p.employee.outletId !== ownOutlet) {
        throw new ForbiddenException('Kepala Cabang hanya bisa mencatat kehadiran kru cabangnya');
      }
    }
    await this.prisma.$transaction(
      dto.entries.map((e) =>
        this.prisma.trainingSessionParticipant.update({
          where: { sessionId_employeeId: { sessionId: id, employeeId: e.employeeId } },
          data: { attended: e.attended },
        }),
      ),
    );
    return this.prisma.trainingSession.findUnique({ where: { id }, include: INCLUDE });
  }

  async remove(id: string) {
    const session = await this.getOrThrow(id);
    if (session.status === TrainingSessionStatus.DONE) throw new BadRequestException('Sesi yang selesai tidak bisa dihapus');
    await this.prisma.trainingSession.delete({ where: { id } });
    return { ok: true };
  }

  private async getOrThrow(id: string) {
    const session = await this.prisma.trainingSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Sesi tidak ditemukan');
    return session;
  }

  private async fields(dto: SaveSessionDto) {
    if (dto.endTime <= dto.startTime) throw new BadRequestException('Jam selesai harus setelah jam mulai');
    if (dto.mode === 'ONLINE' && !dto.meetingUrl) throw new BadRequestException('Sesi online wajib punya tautan rapat');
    if (dto.mode === 'OFFLINE' && !dto.location) throw new BadRequestException('Sesi tatap muka wajib punya lokasi');
    if (dto.moduleId) {
      const m = await this.prisma.trainingModule.findUnique({ where: { id: dto.moduleId } });
      if (!m) throw new BadRequestException('Modul tidak ditemukan');
    }
    const ids = [...new Set(dto.participantIds)];
    if (ids.length) {
      const found = await this.prisma.employeeProfile.count({ where: { id: { in: ids }, user: { isActive: true } } });
      if (found !== ids.length) throw new BadRequestException('Ada peserta yang tidak ditemukan atau nonaktif');
    }
    return {
      title: dto.title,
      moduleId: dto.moduleId ?? null,
      date: toDateOnly(parseDateParam(dto.date)),
      startTime: dto.startTime,
      endTime: dto.endTime,
      mode: dto.mode,
      location: dto.mode === 'OFFLINE' ? dto.location : null,
      meetingUrl: dto.mode === 'ONLINE' ? dto.meetingUrl : null,
      trainerName: dto.trainerName,
      notes: dto.notes ?? null,
    };
  }
}
