import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { PublishDto, SaveModuleDto } from './training.dto';
import { questionRows, targetEmployeesWhere } from './training.shared';

/** Modul pelatihan dari sisi admin: susun, terbitkan, arsipkan, lihat hasil. */
@Injectable()
export class TrainingModulesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const modules = await this.prisma.trainingModule.findMany({
      include: { _count: { select: { questions: true } } },
      orderBy: [{ isPublished: 'desc' }, { createdAt: 'desc' }],
    });
    const passed = await this.prisma.trainingResult.groupBy({
      by: ['moduleId'],
      where: { passedAt: { not: null } },
      _count: { _all: true },
    });
    const passedBy = new Map(passed.map((p) => [p.moduleId, p._count._all]));
    return Promise.all(
      modules.map(async (m) => ({
        ...m,
        questionCount: m._count.questions,
        passedCount: passedBy.get(m.id) ?? 0,
        targetCount: await this.prisma.employeeProfile.count({ where: targetEmployeesWhere(m.targetPositionIds) }),
      })),
    );
  }

  async detail(id: string) {
    const m = await this.prisma.trainingModule.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } }, _count: { select: { results: true } } },
    });
    if (!m) throw new NotFoundException('Modul tidak ditemukan');
    return { ...m, locked: m._count.results > 0 };
  }

  async create(actor: AuthUser, dto: SaveModuleDto) {
    await this.assertPositions(dto.targetPositionIds);
    try {
      return await this.prisma.trainingModule.create({
        data: {
          ...this.fields(dto),
          createdById: actor.id,
          questions: { create: questionRows(dto.questions ?? []) },
        },
      });
    } catch (e) {
      throw this.duplicateCode(e);
    }
  }

  async update(id: string, dto: SaveModuleDto) {
    const current = await this.detail(id);
    await this.assertPositions(dto.targetPositionIds);
    if (dto.questions && current.locked) {
      throw new BadRequestException('Soal terkunci karena sudah ada kru yang mengerjakan. Buat modul baru untuk soal yang berbeda.');
    }
    if (dto.questions && dto.questions.length === 0 && current.isPublished) {
      throw new BadRequestException('Modul yang terbit harus punya soal');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.questions) {
          await tx.trainingQuestion.deleteMany({ where: { moduleId: id } });
          await tx.trainingQuestion.createMany({ data: questionRows(dto.questions).map((q) => ({ ...q, moduleId: id })) });
        }
        return tx.trainingModule.update({ where: { id }, data: this.fields(dto) });
      });
    } catch (e) {
      throw this.duplicateCode(e);
    }
  }

  async publish(id: string, dto: PublishDto) {
    const m = await this.detail(id);
    if (dto.isPublished && m.questions.length === 0) throw new BadRequestException('Tambahkan soal sebelum modul diterbitkan');
    return this.prisma.trainingModule.update({ where: { id }, data: { isPublished: dto.isPublished } });
  }

  async remove(id: string) {
    const m = await this.detail(id);
    if (m.locked) throw new BadRequestException('Modul ini sudah punya hasil kru; arsipkan saja (batalkan terbit)');
    await this.prisma.trainingModule.delete({ where: { id } });
    return { ok: true };
  }

  /** Hasil per kru sasaran (+ kru lain yang pernah mengerjakan); Kepala Cabang hanya cabangnya. */
  async results(actor: AuthUser, id: string, outletId?: string) {
    const m = await this.detail(id);
    const scoped = scopedOutletId(actor, outletId);
    const employees = await this.prisma.employeeProfile.findMany({
      where: {
        OR: [targetEmployeesWhere(m.targetPositionIds, scoped), { trainingResults: { some: { moduleId: id } }, ...(scoped && { outletId: scoped }) }],
      },
      select: {
        id: true,
        fullName: true,
        nik: true,
        outlet: { select: { name: true } },
        position: { select: { title: true } },
        trainingResults: { where: { moduleId: id } },
      },
      orderBy: { fullName: 'asc' },
    });
    return employees.map(({ trainingResults, ...e }) => ({ ...e, result: trainingResults[0] ?? null }));
  }

  /** Sertifikat = modul yang lulus. */
  certificates(actor: AuthUser, outletId?: string, moduleId?: string) {
    const scoped = scopedOutletId(actor, outletId);
    return this.prisma.trainingResult.findMany({
      where: { passedAt: { not: null }, ...(moduleId && { moduleId }), ...(scoped && { employee: { outletId: scoped } }) },
      include: {
        module: { select: { id: true, code: true, title: true, category: true } },
        employee: { select: { id: true, fullName: true, nik: true, outlet: { select: { name: true } }, position: { select: { title: true } } } },
      },
      orderBy: { passedAt: 'desc' },
      take: 2000,
    });
  }

  private fields(dto: SaveModuleDto) {
    return {
      code: dto.code,
      title: dto.title,
      category: dto.category,
      description: dto.description ?? '',
      content: dto.content,
      videoUrl: dto.videoUrl ?? null,
      passingScore: dto.passingScore ?? 80,
      isOnboarding: dto.isOnboarding ?? false,
      targetPositionIds: dto.targetPositionIds ?? [],
    };
  }

  private async assertPositions(ids?: string[]) {
    if (!ids?.length) return;
    const found = await this.prisma.position.count({ where: { id: { in: ids } } });
    if (found !== new Set(ids).size) throw new BadRequestException('Ada jabatan sasaran yang tidak ditemukan');
  }

  private duplicateCode(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('Kode modul sudah dipakai');
    }
    return e;
  }
}
