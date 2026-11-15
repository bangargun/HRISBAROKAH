import { BadRequestException } from '@nestjs/common';

/**
 * Semua "hari ini" dan batas hari dihitung di zona waktu bisnis, bukan zona waktu
 * server. Tanpa ini, server UTC baru berganti hari pukul 07.00 WIB dan server WIB
 * menyimpan kolom @db.Date mundur satu hari.
 */
export const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Asia/Jakarta';

const ymdFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE, // zona tidak dikenal langsung gagal saat aplikasi start
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const offsetFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIMEZONE,
  timeZoneName: 'longOffset',
});

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Tanggal kalender (YYYY-MM-DD) di zona waktu bisnis pada saat `at`. */
export function businessDateString(at: Date = new Date()): string {
  return ymdFormat.format(at);
}

/** Nilai untuk kolom @db.Date: tengah malam UTC dari tanggal kalender itu. */
export function toDateOnly(ymd: string): Date {
  const m = YMD.exec(ymd);
  if (!m) throw new Error(`Tanggal tidak valid: ${ymd}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Hari ini (zona waktu bisnis) sebagai nilai kolom @db.Date. */
export function businessToday(): Date {
  return toDateOnly(businessDateString());
}

/** Parameter tanggal dari klien: harus YYYY-MM-DD dan tanggal yang benar-benar ada. */
export function parseDateParam(value: string): string {
  const m = YMD.exec(value);
  const date = m && toDateOnly(value);
  if (!date || date.getUTCMonth() !== Number(m![2]) - 1 || date.getUTCDate() !== Number(m![3])) {
    throw new BadRequestException('Format tanggal harus YYYY-MM-DD, misalnya 2026-11-15');
  }
  return value;
}

/** Selisih zona waktu bisnis terhadap UTC (menit) pada saat `at`. */
function offsetMinutes(at: Date): number {
  const name = offsetFormat.formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!m) return 0;
  const mins = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === '-' ? -mins : mins;
}

/** Rentang waktu [start, end) untuk satu tanggal kalender di zona waktu bisnis (untuk kolom timestamp). */
export function businessDayRange(ymd: string): { start: Date; end: Date } {
  const midnightUtc = toDateOnly(ymd).getTime();
  // Offset diambil di tengah hari agar aman bila zona memakai DST
  const start = new Date(midnightUtc - offsetMinutes(new Date(midnightUtc + 12 * 3600_000)) * 60_000);
  const nextUtc = midnightUtc + 24 * 3600_000;
  const end = new Date(nextUtc - offsetMinutes(new Date(nextUtc + 12 * 3600_000)) * 60_000);
  return { start, end };
}

/** Tanggal pertama dan terakhir sebuah bulan, sebagai nilai kolom @db.Date. */
export function monthDateRange(year: number, month: number): { first: Date; last: Date } {
  return {
    first: new Date(Date.UTC(year, month - 1, 1)),
    last: new Date(Date.UTC(year, month, 0)),
  };
}
