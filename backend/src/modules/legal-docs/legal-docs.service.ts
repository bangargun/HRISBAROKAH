import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, LegalDocCategory, LegalDocStatus, LegalDocType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { businessDateString, parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { CancelLegalDocDto, CreateLegalDocDto } from './legal-docs.dto';

/** Kategori dan kode nomor per jenis surat. */
const TYPE_INFO: Record<LegalDocType, { category: LegalDocCategory; code: string }> = {
  SK_PENGANGKATAN: { category: LegalDocCategory.SK, code: 'SK-ANGKAT' },
  SK_PROMOSI: { category: LegalDocCategory.SK, code: 'SK-PROMO' },
  SK_MUTASI: { category: LegalDocCategory.SK, code: 'SK-MUT' },
  SK_PENYESUAIAN_GAJI: { category: LegalDocCategory.SK, code: 'SK-GAJI' },
  PKWT_KRU: { category: LegalDocCategory.PKWT, code: 'PKWT' },
  PKWTT_TETAP: { category: LegalDocCategory.PKWT, code: 'PKWTT' },
  SE_LIBUR_OPERASIONAL: { category: LegalDocCategory.EDARAN, code: 'SE' },
  SE_KUOTA_LIBUR: { category: LegalDocCategory.EDARAN, code: 'SE' },
  SE_CUTI_TAHUNAN: { category: LegalDocCategory.EDARAN, code: 'SE' },
  SE_CUSTOM: { category: LegalDocCategory.EDARAN, code: 'SE' },
};

/** Jenis surat yang bisa diterapkan ke data karyawan. */
export const APPLICABLE: LegalDocType[] = [
  LegalDocType.SK_MUTASI,
  LegalDocType.SK_PROMOSI,
  LegalDocType.SK_PENGANGKATAN,
  LegalDocType.PKWTT_TETAP,
  LegalDocType.PKWT_KRU,
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const INCLUDE = {
  targetPosition: { select: { id: true, title: true } },
  targetOutlet: { select: { id: true, name: true } },
  createdBy: { select: { username: true, profile: { select: { fullName: true } } } },
  cancelledBy: { select: { username: true, profile: { select: { fullName: true } } } },
  appliedBy: { select: { username: true, profile: { select: { fullName: true } } } },
} satisfies Prisma.LegalDocumentInclude;

@Injectable()
export class LegalDocsService {
  constructor(private prisma: PrismaService) {}

  /** Kepala Cabang hanya melihat surat untuk kru cabangnya dan semua surat edaran. */
  list(actor: AuthUser, category?: string, outletId?: string) {
    const cat = Object.values(LegalDocCategory).includes(category as LegalDocCategory) ? (category as LegalDocCategory) : undefined;
    const isSm = actor.role === UserRole.STORE_MANAGER;
    const scoped = scopedOutletId(actor, outletId);
    const where: Prisma.LegalDocumentWhereInput = {
      ...(cat && { category: cat }),
      ...(scoped && (isSm ? { OR: [{ outletId: scoped }, { category: LegalDocCategory.EDARAN }] } : { outletId: scoped })),
    };
    return this.prisma.legalDocument.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, take: 1000 });
  }

  async create(actor: AuthUser, dto: CreateLegalDocDto) {
    const info = TYPE_INFO[dto.docType];
    const isEdaran = info.category === LegalDocCategory.EDARAN;
    const effectiveYmd = parseDateParam(dto.effectiveDate);
    const expiredYmd = dto.expiredDate ? parseDateParam(dto.expiredDate) : undefined;

    if (dto.docType === LegalDocType.PKWT_KRU && !expiredYmd) {
      throw new BadRequestException('Kontrak PKWT wajib punya tanggal berakhir');
    }
    if (expiredYmd && expiredYmd <= effectiveYmd) throw new BadRequestException('Tanggal berakhir harus setelah tanggal berlaku');
    if (dto.docType === LegalDocType.SK_MUTASI && !dto.targetOutletId) throw new BadRequestException('Pilih cabang tujuan mutasi');
    if (dto.docType === LegalDocType.SK_PROMOSI && !dto.targetPositionId) throw new BadRequestException('Pilih jabatan baru');

    let employee: Prisma.EmployeeProfileGetPayload<{ include: { outlet: true; position: true; user: true } }> | null = null;
    if (!isEdaran) {
      if (!dto.employeeId) throw new BadRequestException('Pilih karyawan untuk surat ini');
      employee = await this.prisma.employeeProfile.findUnique({
        where: { id: dto.employeeId },
        include: { outlet: true, position: true, user: true },
      });
      if (!employee || !employee.user.isActive) throw new NotFoundException('Karyawan tidak ditemukan atau sudah nonaktif');
    }
    if (dto.targetOutletId) {
      const o = await this.prisma.outlet.findUnique({ where: { id: dto.targetOutletId } });
      if (!o || !o.isActive) throw new BadRequestException('Cabang tujuan tidak ditemukan atau nonaktif');
      if (employee && o.id === employee.outletId && dto.docType === LegalDocType.SK_MUTASI) {
        throw new BadRequestException('Cabang tujuan sama dengan cabang sekarang');
      }
    }
    if (dto.targetPositionId) {
      const p = await this.prisma.position.findUnique({ where: { id: dto.targetPositionId } });
      if (!p) throw new BadRequestException('Jabatan tujuan tidak ditemukan');
    }

    // Nomor mengikuti bulan dan tahun surat diterbitkan
    const issued = businessDateString();
    const year = Number(issued.slice(0, 4));
    const month = Number(issued.slice(5, 7));
    // Penghitung baru yang dibuat dua permintaan sekaligus bisa bentrok (P2002): cukup ulangi
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.issue(actor, dto, info, employee, isEdaran, effectiveYmd, expiredYmd, year, month);
      } catch (e) {
        if (attempt >= 3 || !(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') throw e;
      }
    }
  }

  private issue(
    actor: AuthUser,
    dto: CreateLegalDocDto,
    info: { category: LegalDocCategory; code: string },
    employee: Prisma.EmployeeProfileGetPayload<{ include: { outlet: true; position: true; user: true } }> | null,
    isEdaran: boolean,
    effectiveYmd: string,
    expiredYmd: string | undefined,
    year: number,
    month: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Nomor urut: upsert + increment dalam transaksi, jadi dua penerbitan serentak tidak dapat nomor sama
      const counter = await tx.legalDocumentCounter.upsert({
        where: { code_year: { code: info.code, year } },
        create: { code: info.code, year, last: 1 },
        update: { last: { increment: 1 } },
      });
      const docNumber = `${String(counter.last).padStart(3, '0')}/${info.code}/HR-BKN/${ROMAN[month - 1]}/${year}`;
      return tx.legalDocument.create({
        data: {
          docNumber,
          docType: dto.docType,
          category: info.category,
          employeeId: employee?.id,
          employeeName: employee?.fullName,
          employeeNik: employee?.nik,
          positionTitle: employee?.position.title,
          outletName: employee?.outlet.name,
          outletId: employee?.outletId,
          targetPositionId: isEdaran ? undefined : dto.targetPositionId,
          targetOutletId: isEdaran ? undefined : dto.targetOutletId,
          salaryAmount: isEdaran ? undefined : dto.salaryAmount,
          audience: isEdaran ? dto.audience : undefined,
          subject: isEdaran ? dto.subject : undefined,
          title: dto.title,
          effectiveDate: toDateOnly(effectiveYmd),
          expiredDate: expiredYmd ? toDateOnly(expiredYmd) : undefined,
          signatoryName: dto.signatoryName,
          signatoryRole: dto.signatoryRole,
          contentBody: dto.contentBody,
          considerations: (dto.considerations ?? []).map((c) => c.trim()).filter(Boolean),
          decisions: (dto.decisions ?? []).map((c) => c.trim()).filter(Boolean),
          createdById: actor.id,
        },
        include: INCLUDE,
      });
    });
  }

  async cancel(actor: AuthUser, id: string, dto: CancelLegalDocDto) {
    const doc = await this.getOrThrow(id);
    if (doc.appliedAt) throw new BadRequestException('Surat yang sudah diterapkan ke data karyawan tidak bisa dibatalkan; terbitkan surat baru');
    const { count } = await this.prisma.legalDocument.updateMany({
      where: { id, status: LegalDocStatus.ISSUED, appliedAt: null },
      data: { status: LegalDocStatus.CANCELLED, cancelReason: dto.reason, cancelledById: actor.id, cancelledAt: new Date() },
    });
    if (count === 0) throw new BadRequestException('Surat sudah dibatalkan atau diterapkan');
    return this.prisma.legalDocument.findUnique({ where: { id }, include: INCLUDE });
  }

  /** Terapkan SK/kontrak ke data karyawan: sekali saja, dan hanya mulai tanggal berlaku. */
  async apply(actor: AuthUser, id: string) {
    const doc = await this.getOrThrow(id);
    if (!APPLICABLE.includes(doc.docType)) throw new BadRequestException('Jenis surat ini tidak mengubah data karyawan');
    if (doc.status !== LegalDocStatus.ISSUED) throw new BadRequestException('Surat yang dibatalkan tidak bisa diterapkan');
    if (doc.appliedAt) throw new BadRequestException('Surat ini sudah diterapkan');
    const effective = doc.effectiveDate.toISOString().slice(0, 10);
    if (effective > businessDateString()) throw new BadRequestException(`Surat ini baru bisa diterapkan mulai ${effective}`);
    if (!doc.employeeId) throw new BadRequestException('Karyawan pada surat ini sudah tidak ada');

    const employee = await this.prisma.employeeProfile.findUnique({ where: { id: doc.employeeId }, include: { user: true } });
    if (!employee || !employee.user.isActive) throw new BadRequestException('Karyawan sudah nonaktif');
    if (employee.user.role !== UserRole.EMPLOYEE && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Hanya Super Admin yang boleh mengubah data akun admin');
    }

    const data: Prisma.EmployeeProfileUncheckedUpdateInput = {};
    if (doc.targetOutletId) {
      const o = await this.prisma.outlet.findUnique({ where: { id: doc.targetOutletId } });
      if (!o?.isActive) throw new BadRequestException('Cabang tujuan sudah nonaktif');
      data.outletId = o.id;
    }
    if (doc.targetPositionId) data.positionId = doc.targetPositionId;
    if (doc.docType === LegalDocType.SK_PENGANGKATAN || doc.docType === LegalDocType.PKWTT_TETAP) {
      data.status = EmploymentStatus.PERMANENT;
    }
    if (doc.docType === LegalDocType.PKWT_KRU) data.status = EmploymentStatus.CONTRACT;

    return this.prisma.$transaction(async (tx) => {
      // Klaim bersyarat: dua klik bersamaan tidak menerapkan dua kali
      const { count } = await tx.legalDocument.updateMany({
        where: { id, status: LegalDocStatus.ISSUED, appliedAt: null },
        data: { appliedAt: new Date(), appliedById: actor.id },
      });
      if (count === 0) throw new BadRequestException('Surat ini sudah diterapkan atau dibatalkan');
      await tx.employeeProfile.update({ where: { id: employee.id }, data });
      return tx.legalDocument.findUnique({ where: { id }, include: INCLUDE });
    });
  }

  private async getOrThrow(id: string) {
    const doc = await this.prisma.legalDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Surat tidak ditemukan');
    return doc;
  }
}
