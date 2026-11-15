import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { CreateHolidayDto } from './holidays.dto';

@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) {}

  async findYear(year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Tahun tidak valid');
    }
    const rows = await this.prisma.publicHoliday.findMany({
      where: { date: { gte: toDateOnly(`${year}-01-01`), lte: toDateOnly(`${year}-12-31`) } },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), name: r.name }));
  }

  async create(dto: CreateHolidayDto) {
    parseDateParam(dto.date);
    const date = toDateOnly(dto.date);
    if (await this.prisma.publicHoliday.findUnique({ where: { date } })) {
      throw new ConflictException(`Tanggal ${dto.date} sudah tercatat sebagai libur nasional`);
    }
    const row = await this.prisma.publicHoliday.create({ data: { date, name: dto.name } });
    return { id: row.id, date: dto.date, name: row.name };
  }

  async remove(id: string) {
    const row = await this.prisma.publicHoliday.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Libur nasional tidak ditemukan');
    await this.prisma.publicHoliday.delete({ where: { id } });
    return { message: `${row.name} dihapus dari daftar libur nasional` };
  }
}
