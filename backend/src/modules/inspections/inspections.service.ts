import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InspectionStatus, InspectionType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { businessToday, parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { INSPECTION_AREAS, INSPECTION_CHECKLIST, INSPECTION_KEYS } from './inspection.checklist';
import { InspectionResultDto, ScheduleInspectionDto } from './inspections.dto';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const WHO = { select: { username: true, profile: { select: { fullName: true } } } };
const INCLUDE = {
  outlet: { select: { id: true, name: true, code: true } },
  createdBy: WHO,
  conductedBy: WHO,
} satisfies Prisma.OutletInspectionInclude;

export const inspectionGrade = (score: number) => (score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D');

@Injectable()
export class InspectionsService {
  constructor(private prisma: PrismaService) {}

  checklist() {
    return { areas: INSPECTION_AREAS, items: INSPECTION_CHECKLIST };
  }

  list(actor: AuthUser, outletId?: string) {
    outletId = scopedOutletId(actor, outletId);
    return this.prisma.outletInspection.findMany({
      where: {
        ...(outletId && { outletId }),
        // Sidak mendadak yang belum dilakukan tidak boleh terlihat oleh kepala cabang
        ...(actor.role === UserRole.STORE_MANAGER && {
          NOT: { type: InspectionType.SURPRISE, status: InspectionStatus.SCHEDULED },
        }),
      },
      include: INCLUDE,
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async schedule(actor: AuthUser, dto: ScheduleInspectionDto) {
    const outlet = await this.prisma.outlet.findUnique({ where: { id: dto.outletId } });
    if (!outlet?.isActive) throw new BadRequestException('Cabang tidak ditemukan atau nonaktif');
    const date = toDateOnly(parseDateParam(dto.scheduledDate));
    if (date < businessToday()) throw new BadRequestException('Tanggal sidak tidak boleh di masa lalu');
    return this.prisma.outletInspection.create({
      data: { outletId: outlet.id, type: dto.type, scheduledDate: date, focusArea: dto.focusArea || null, createdById: actor.id },
      include: INCLUDE,
    });
  }

  /** Simpan hasil sidak: skor dari titik yang lolos, nomor berita acara otomatis. */
  async record(actor: AuthUser, id: string, dto: InspectionResultDto) {
    const inspection = await this.getScheduled(id);
    const unknown = dto.passedItems.filter((k) => !INSPECTION_KEYS.has(k));
    if (unknown.length) throw new BadRequestException(`Titik checklist tidak dikenal: ${unknown.join(', ')}`);
    const passed = Array.from(new Set(dto.passedItems));
    const score = INSPECTION_CHECKLIST.filter((i) => passed.includes(i.key)).reduce((n, i) => n + i.points, 0);
    const now = new Date();

    for (let attempt = 0; attempt < 5; attempt++) {
      const year = now.getUTCFullYear();
      const count = await this.prisma.outletInspection.count({
        where: { reportNumber: { not: null }, conductedAt: { gte: new Date(Date.UTC(year, 0, 1)) } },
      });
      const reportNumber = `BAS/${inspection.outlet.code}/${ROMAN[now.getUTCMonth()]}/${year}/${String(count + 1 + attempt).padStart(3, '0')}`;
      try {
        const { count: updated } = await this.prisma.outletInspection.updateMany({
          where: { id, status: InspectionStatus.SCHEDULED },
          data: {
            status: InspectionStatus.DONE,
            reportNumber,
            passedItems: passed,
            score,
            grade: inspectionGrade(score),
            findings: dto.findings || null,
            actionItems: dto.actionItems || null,
            branchManagerName: dto.branchManagerName || null,
            conductedAt: now,
            conductedById: actor.id,
          },
        });
        if (updated === 0) throw new ConflictException('Sidak ini sudah selesai atau dibatalkan');
        return this.prisma.outletInspection.findUnique({ where: { id }, include: INCLUDE });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      }
    }
    throw new ConflictException('Gagal membuat nomor berita acara, coba lagi');
  }

  async cancel(id: string) {
    await this.getScheduled(id);
    const { count } = await this.prisma.outletInspection.updateMany({
      where: { id, status: InspectionStatus.SCHEDULED },
      data: { status: InspectionStatus.CANCELLED },
    });
    if (count === 0) throw new ConflictException('Sidak ini sudah selesai atau dibatalkan');
    return this.prisma.outletInspection.findUnique({ where: { id }, include: INCLUDE });
  }

  private async getScheduled(id: string) {
    const inspection = await this.prisma.outletInspection.findUnique({ where: { id }, include: INCLUDE });
    if (!inspection) throw new NotFoundException('Sidak tidak ditemukan');
    if (inspection.status !== InspectionStatus.SCHEDULED) throw new ConflictException('Sidak ini sudah selesai atau dibatalkan');
    return inspection;
  }
}

