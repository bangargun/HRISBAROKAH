import { PrismaService } from '../../prisma/prisma.service';
import { toDateOnly } from './business-date.util';

export type DayType = 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';

export interface OutletHours {
  weekdayWorkStart: string;
  weekdayWorkEnd: string;
  weekendWorkStart: string;
  weekendWorkEnd: string;
  holidayWorkStart: string;
  holidayWorkEnd: string;
}

/** Libur nasional diutamakan; Sabtu dan Minggu dihitung weekend. */
export function dayTypeFor(ymd: string, holidays: Set<string>): DayType {
  if (holidays.has(ymd)) return 'HOLIDAY';
  const day = toDateOnly(ymd).getUTCDay();
  return day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY';
}

/** Jam kerja kru cabang untuk jenis hari tertentu. */
export function workWindow(outlet: OutletHours, dayType: DayType) {
  if (dayType === 'HOLIDAY') return { start: outlet.holidayWorkStart, end: outlet.holidayWorkEnd };
  if (dayType === 'WEEKEND') return { start: outlet.weekendWorkStart, end: outlet.weekendWorkEnd };
  return { start: outlet.weekdayWorkStart, end: outlet.weekdayWorkEnd };
}

/** Tanggal libur nasional (YYYY-MM-DD) dalam rentang inklusif. */
export async function holidaysBetween(prisma: PrismaService, from: string, to: string): Promise<Set<string>> {
  const rows = await prisma.publicHoliday.findMany({
    where: { date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
    select: { date: true },
  });
  return new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
}
