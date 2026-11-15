import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { daysBetween, parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { dayTypeFor, holidaysBetween, workWindow } from '../../common/utils/work-hours.util';
import { SaveSchedulesDto } from './schedules.dto';

const MAX_RANGE_DAYS = 62;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

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
    const [rows, holidays] = await Promise.all([
      this.prisma.shiftSchedule.findMany({
        where: {
          date: { gte: toDateOnly(from), lte: toDateOnly(to) },
          ...(outletId && { employee: { outletId } }),
        },
        include: {
          employee: { select: { outlet: true } },
          _count: { select: { attendances: true } },
        },
        orderBy: [{ date: 'asc' }],
      }),
      holidaysBetween(this.prisma, from, to),
    ]);

    return rows.map((r) => {
      const date = ymd(r.date);
      const dayType = dayTypeFor(date, holidays);
      const hours = workWindow(r.employee.outlet, dayType);
      return {
        id: r.id,
        employeeId: r.employeeId,
        date,
        dayType,
        startTime: hours.start,
        endTime: hours.end,
        // Sudah dipakai absen: tidak bisa dijadikan libur lagi
        locked: r._count.attendances > 0,
      };
    });
  }

  async save(actor: AuthUser, dto: SaveSchedulesDto) {
    const seen = new Set<string>();
    for (const e of dto.entries) {
      parseDateParam(e.date);
      const key = `${e.employeeId}|${e.date}`;
      if (seen.has(key)) throw new BadRequestException('Satu karyawan hanya boleh punya satu jadwal per tanggal');
      seen.add(key);
    }

    const employeeIds = Array.from(new Set(dto.entries.map((e) => e.employeeId)));
    const [employees, existing] = await Promise.all([
      this.prisma.employeeProfile.findMany({ where: { id: { in: employeeIds } }, select: { id: true, fullName: true, outletId: true } }),
      this.prisma.shiftSchedule.findMany({
        where: { OR: dto.entries.map((e) => ({ employeeId: e.employeeId, date: toDateOnly(e.date) })) },
        include: { _count: { select: { attendances: true } } },
      }),
    ]);
    const employeeById = new Map(employees.map((e) => [e.id, e]));
    const existingByKey = new Map(existing.map((s) => [`${s.employeeId}|${ymd(s.date)}`, s]));

    for (const e of dto.entries) {
      const employee = employeeById.get(e.employeeId);
      if (!employee) throw new NotFoundException('Ada karyawan yang tidak ditemukan');
      assertOutletAccess(actor, employee.outletId, 'Anda hanya bisa menyusun jadwal karyawan di outlet Anda');
      const current = existingByKey.get(`${e.employeeId}|${e.date}`);
      if (current && current._count.attendances > 0 && !e.working) {
        throw new ConflictException(`${employee.fullName} sudah absen pada ${e.date}, jadi tanggal itu tidak bisa dijadikan libur`);
      }
    }

    let saved = 0;
    let removed = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const e of dto.entries) {
        const date = toDateOnly(e.date);
        if (e.working) {
          await tx.shiftSchedule.upsert({
            where: { employeeId_date: { employeeId: e.employeeId, date } },
            create: { employeeId: e.employeeId, date },
            update: {},
          });
          saved++;
        } else {
          removed += (await tx.shiftSchedule.deleteMany({ where: { employeeId: e.employeeId, date } })).count;
        }
      }
    });
    return { saved, removed };
  }
}
