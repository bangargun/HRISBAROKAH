import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SanctionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { businessToday, parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { CreateSanctionDto } from './sanctions.dto';

const PREFIX: Record<SanctionType, string> = {
  TEGURAN_LISAN: 'TL',
  SP_1: 'SP1',
  SP_2: 'SP2',
  SP_3: 'SP3',
  SUSPENSION: 'SKORS',
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
// Surat peringatan berlaku paling lama 6 bulan (UU Ketenagakerjaan)
const MAX_VALID_MONTHS = 6;

const INCLUDE = {
  employee: {
    select: {
      id: true,
      fullName: true,
      nik: true,
      outlet: { select: { id: true, name: true } },
      position: { select: { title: true } },
    },
  },
  issuedBy: { select: { username: true, profile: { select: { fullName: true } } } },
} satisfies Prisma.SanctionInclude;

@Injectable()
export class SanctionsService {
  constructor(private prisma: PrismaService) {}

  list(actor: AuthUser, outletId?: string, employeeId?: string) {
    outletId = scopedOutletId(actor, outletId);
    return this.prisma.sanction.findMany({
      where: { ...(outletId && { employee: { outletId } }), ...(employeeId && { employeeId }) },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(actor: AuthUser, dto: CreateSanctionDto) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: dto.employeeId },
      include: { outlet: true },
    });
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan');
    assertOutletAccess(actor, employee.outletId, 'Anda hanya bisa menerbitkan surat untuk karyawan di cabang Anda');

    const today = businessToday();
    const incidentDate = toDateOnly(parseDateParam(dto.incidentDate));
    const validUntil = toDateOnly(parseDateParam(dto.validUntil));
    if (incidentDate > today) throw new BadRequestException('Tanggal kejadian tidak boleh di masa depan');
    if (validUntil <= today) throw new BadRequestException('Masa berlaku harus setelah hari ini');
    const maxValid = new Date(today);
    maxValid.setUTCMonth(maxValid.getUTCMonth() + MAX_VALID_MONTHS);
    if (validUntil > maxValid) throw new BadRequestException(`Masa berlaku paling lama ${MAX_VALID_MONTHS} bulan`);

    // Nomor urut per tahun; bila bentrok karena dua surat dibuat bersamaan, coba nomor berikutnya
    const year = today.getUTCFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.sanction.count({
        where: { createdAt: { gte: new Date(Date.UTC(year, 0, 1)) } },
      });
      const seq = String(count + 1 + attempt).padStart(3, '0');
      const letterNumber = `${PREFIX[dto.type]}/${employee.outlet.code}/${ROMAN[today.getUTCMonth()]}/${year}/${seq}`;
      try {
        return await this.prisma.sanction.create({
          data: {
            employeeId: employee.id,
            type: dto.type,
            letterNumber,
            incidentDate,
            validUntil,
            category: dto.category || null,
            violationDesc: dto.violationDesc,
            actionTaken: dto.actionTaken || null,
            witness: dto.witness || null,
            issuedById: actor.id,
          },
          include: INCLUDE,
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      }
    }
    throw new ConflictException('Gagal membuat nomor surat, coba lagi');
  }

  /** Untuk membatalkan surat yang salah terbit. */
  async remove(id: string) {
    const existing = await this.prisma.sanction.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Surat tidak ditemukan');
    await this.prisma.sanction.delete({ where: { id } });
    return { id };
  }
}
