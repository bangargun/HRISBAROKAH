import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { daysBetween, parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { SaveSchedulesDto } from './schedules.dto';

const MAX_RANGE_DAYS = 62;

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService) {}

  async findRange(actor: AuthUser, from: string, to: string, outletId?: string) {
    if (!from || !to) throw new BadRequestException('Parameter from dan to wajib diisi (YYYY-MM-DD)');
    parseDateParam(from);
    parseDateParam(to);
    const span = daysBetween(from, to);
    if (span < 0) throw new BadRequestException('Tanggal "from" tidak boleh setelah "to"');
    if (span >= MAX_RANGE_DAYS) throw new BadRequestException(`Rentang maksimal ${MAX_RANGE_DAYS} hari`);

    outletId = scopedOutletId(actor, outletId);
    const rows = await this.prisma.shiftSchedule.findMany({
      where: {
        date: { gte: toDateOnly(from), lte: toDateOnly(to) },
        ...(outletId && { employee: { outletId } }),
      },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, breakLimitMins: true } },
        _count: { select: { attendances: true } },
      },
      orderBy: [{ date: 'asc' }],
    });

    return rows.map(({ _count, ...row }) => ({
      ...row,
      date: row.date.toISOString().slice(0, 10),
      // Sudah dipakai absen: tidak bisa diubah lagi
      locked: _count.attendances > 0,
    }));
  }

  async save(actor: AuthUser, dto: SaveSchedulesDto) {
    const seen = new Set<string>();
    for (const e of dto.entries) {
      parseDateParam(e.date);
      const key = `${e.employeeId}|${e.date}`;
      if (seen.has(key)) throw new BadRequestException('Satu karyawan hanya boleh punya satu jadwal per tanggal');
      seen.add(key);
    }

    const employeeIds = [...new Set(dto.entries.map((e) => e.employeeId))];
    const shiftIds = [...new Set(dto.entries.map((e) => e.shiftId).filter((id): id is string => !!id))];

    const [employees, shifts, existing] = await Promise.all([
      this.prisma.employeeProfile.findMany({ where: { id: { in: employeeIds } }, select: { id: true, fullName: true, outletId: true } }),
      this.prisma.shift.findMany({ where: { id: { in: shiftIds } }, select: { id: true, outletId: true } }),
      this.prisma.shiftSchedule.findMany({
        where: { OR: dto.entries.map((e) => ({ employeeId: e.employeeId, date: toDateOnly(e.date) })) },
        include: { _count: { select: { attendances: true } } },
      }),
    ]);

    const employeeById = new Map(employees.map((e) => [e.id, e]));
    const shiftById = new Map(shifts.map((s) => [s.id, s]));
    const existingByKey = new Map(existing.map((s) => [`${s.employeeId}|${s.date.toISOString().slice(0, 10)}`, s]));

    for (const e of dto.entries) {
      const employee = employeeById.get(e.employeeId);
      if (!employee) throw new NotFoundException('Ada karyawan yang tidak ditemukan');
      assertOutletAccess(actor, employee.outletId, 'Anda hanya bisa menyusun jadwal karyawan di outlet Anda');

      if (e.shiftId) {
        const shift = shiftById.get(e.shiftId);
        if (!shift) throw new NotFoundException('Ada shift yang tidak ditemukan');
        if (shift.outletId !== employee.outletId) {
          throw new BadRequestException(`Shift untuk ${employee.fullName} harus milik cabang tempat ia bekerja`);
        }
      }

      const current = existingByKey.get(`${e.employeeId}|${e.date}`);
      if (current && current._count.attendances > 0 && current.shiftId !== e.shiftId) {
        throw new ConflictException(
          `Jadwal ${employee.fullName} tanggal ${e.date} sudah dipakai absen sehingga tidak bisa diubah`,
        );
      }
    }

    let saved = 0;
    let removed = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const e of dto.entries) {
        const date = toDateOnly(e.date);
        if (e.shiftId) {
          await tx.shiftSchedule.upsert({
            where: { employeeId_date: { employeeId: e.employeeId, date } },
            create: { employeeId: e.employeeId, date, shiftId: e.shiftId },
            update: { shiftId: e.shiftId },
          });
          saved++;
        } else {
          const res = await tx.shiftSchedule.deleteMany({ where: { employeeId: e.employeeId, date } });
          removed += res.count;
        }
      }
    });

    return { saved, removed };
  }
}
