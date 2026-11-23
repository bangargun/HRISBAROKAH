// Ringkasan hari ini di tablet: papan (siapa sudah masuk, istirahat, pulang, belum datang,
// terlambat), menit terlambat lokal, dan rekap pribadi. Semua dari bootstrap + antrean lokal.
import { businessDate, currentDay, type DayStatus, type StatusEvent } from './status';
import type { BootstrapPayload, BootstrapRecapDay, BootstrapRosterEntry, OutletHours } from './types';

type DayType = 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';

// Salinan dayTypeFor / workWindow dari backend/src/common/utils/work-hours.util.ts
function dayTypeFor(ymd: string, holidays: string[]): DayType {
  if (holidays.includes(ymd)) return 'HOLIDAY';
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY';
}

function workStart(hours: OutletHours, dayType: DayType): string {
  if (dayType === 'HOLIDAY') return hours.holidayWorkStart;
  if (dayType === 'WEEKEND') return hours.weekendWorkStart;
  return hours.weekdayWorkStart;
}

const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
// Jadwal di bootstrap mencakup hari ini .. +3 (GUEST_WINDOW_DAYS di bootstrap.service.ts)
const SHIFT_WINDOW_DAYS = 3;

/**
 * Menit terlambat seperti AttendanceService.punctuality(): hanya bila kru terjadwal pada tanggal
 * itu (cabang mana pun), dihitung dari jam mulai cabang tablet untuk jenis harinya.
 * null bila tidak bisa dihitung dengan benar (kru di luar roster, tanggal di luar data jadwal).
 */
export function lateMinutesAt(b: BootstrapPayload, employeeId: string, at: Date): number | null {
  const entry = b.roster.find((r) => r.employeeId === employeeId);
  if (!entry || !Array.isArray(entry.shifts)) return null;
  const ymd = businessDate(at);
  const from = businessDate(new Date(b.serverTime));
  if (ymd < from || ymd > addDays(from, SHIFT_WINDOW_DAYS)) return null;
  if (!entry.shifts.some((s) => s.date === ymd)) return 0;
  // Zona bisnis Asia/Jakarta (UTC+7, tanpa musim panas), sama dengan businessDateTime() backend
  const start = Date.parse(`${ymd}T${workStart(b.outlet.hours, dayTypeFor(ymd, b.holidays))}:00+07:00`);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((at.getTime() - start) / 60_000));
}

export interface Person {
  employeeId: string;
  fullName: string;
  homeOutletName: string;
  isHome: boolean; // kru cabang tablet ini
}

export function personFor(b: BootstrapPayload, employeeId: string, fallback?: Partial<Person>): Person {
  const r = b.roster.find((x) => x.employeeId === employeeId);
  if (r) return { employeeId, fullName: r.fullName, homeOutletName: r.homeOutletName, isHome: !r.isGuest };
  const d = b.directory.find((x) => x.employeeId === employeeId);
  return {
    employeeId,
    fullName: d?.fullName ?? fallback?.fullName ?? 'Kru',
    homeOutletName: d?.homeOutletName ?? fallback?.homeOutletName ?? '',
    isHome: false,
  };
}

function scheduledHere(r: BootstrapRosterEntry, ymd: string): boolean {
  return (r.shifts ?? []).some((s) => s.date === ymd && s.here);
}

export interface BoardRow {
  employeeId: string;
  fullName: string;
  at: Date | null; // jam masuk / mulai istirahat / pulang sesuai kelompok
  lateMinutes: number;
}

export interface BoardSummary {
  working: BoardRow[];
  onBreak: BoardRow[];
  done: BoardRow[];
  notYet: BoardRow[];
  late: BoardRow[];
}

/** Lateness hari ini untuk satu kru: dari baris server bila jam masuknya sama, selain itu hitung lokal. */
function lateFor(b: BootstrapPayload, employeeId: string, clockIn: Date): number | null {
  const row = b.today.find((t) => t.employeeId === employeeId && t.clockIn && Date.parse(t.clockIn) === clockIn.getTime());
  if (row) return row.lateMinutes;
  return lateMinutesAt(b, employeeId, clockIn);
}

export function boardSummary(b: BootstrapPayload, queued: StatusEvent[], now: Date): BoardSummary {
  const today = businessDate(now);
  // Baris here=false = absen kru roster di cabang lain: dipakai untuk status, tetapi kru itu hanya
  // tampil di papan ini bila ada absennya di sini (baris here atau event antre tablet ini)
  const hereRows = b.today.filter((t) => t.here !== false);
  const presentHere = new Set<string>([...hereRows.map((t) => t.employeeId), ...queued.map((e) => e.employeeId)]);
  const ids = new Set<string>([...b.roster.map((r) => r.employeeId), ...Array.from(presentHere)]);
  const out: BoardSummary = { working: [], onBreak: [], done: [], notYet: [], late: [] };
  for (const id of Array.from(ids)) {
    const day = currentDay(b.today, queued, id, now);
    if (day.status !== 'OUT' && !presentHere.has(id)) continue; // sedang / sudah absen di cabang lain
    const name = personFor(b, id).fullName;
    const lateMinutes = day.clockIn && businessDate(day.clockIn) === today ? (lateFor(b, id, day.clockIn) ?? 0) : 0;
    const row = (at: Date | null): BoardRow => ({ employeeId: id, fullName: name, at, lateMinutes });
    const groups: Record<DayStatus, () => void> = {
      IN: () => out.working.push(row(day.clockIn)),
      ON_BREAK: () => out.onBreak.push(row(day.openBreakStart)),
      DONE: () => out.done.push(row(day.clockOut)),
      OUT: () => {
        const r = b.roster.find((x) => x.employeeId === id);
        if (r && scheduledHere(r, today)) out.notYet.push(row(null));
      },
    };
    groups[day.status]();
    if (lateMinutes > 0) out.late.push(row(day.clockIn));
  }
  const byName = (a: BoardRow, c: BoardRow) => a.fullName.localeCompare(c.fullName, 'id');
  for (const list of Object.values(out)) list.sort(byName);
  return out;
}

export interface RecapRow {
  date: string;
  clockIn: Date | null;
  clockOut: Date | null;
  lateMinutes: number | null;
  breakMinutes: number | null;
  workMinutes: number | null;
  onBreak: boolean;
}

const fromServer = (d: BootstrapRecapDay): RecapRow => ({
  date: d.date,
  clockIn: d.clockIn ? new Date(d.clockIn) : null,
  clockOut: d.clockOut ? new Date(d.clockOut) : null,
  lateMinutes: d.lateMinutes,
  breakMinutes: d.breakMinutes,
  workMinutes: d.clockOut ? d.workMinutes : null,
  onBreak: false,
});

/**
 * Rekap pribadi: bulan berjalan untuk kru cabang ini, hari ini saja untuk kru tamu.
 * Baris hari ini memakai absen lokal (termasuk yang belum terkirim); angka yang tidak bisa
 * dihitung di tablet dibiarkan kosong.
 */
export function recapFor(b: BootstrapPayload, queued: StatusEvent[], person: Person, now: Date): RecapRow[] {
  const today = businessDate(now);
  const server = person.isHome ? (b.recap.find((r) => r.employeeId === person.employeeId)?.days ?? []) : [];
  const rows = server.filter((d) => d.date.slice(0, 7) === today.slice(0, 7) && d.date !== today).map(fromServer);

  const day = currentDay(b.today, queued, person.employeeId, now);
  if (day.clockIn && businessDate(day.clockIn) === today) {
    // Lama istirahat dan lama kerja hanya dari server, dan hanya bila tidak ada absen lokal yang belum terkirim
    const hasLocal = queued.some((e) => e.employeeId === person.employeeId);
    const serverToday = hasLocal ? undefined : server.find((d) => d.date === today);
    const sameAsServer = !!serverToday && serverToday.clockIn !== null && Date.parse(serverToday.clockIn) === day.clockIn.getTime();
    rows.push({
      date: today,
      clockIn: day.clockIn,
      clockOut: day.clockOut,
      lateMinutes: lateFor(b, person.employeeId, day.clockIn),
      breakMinutes: sameAsServer && !day.openBreakStart ? serverToday!.breakMinutes : null,
      workMinutes: sameAsServer && day.clockOut ? serverToday!.workMinutes : null,
      onBreak: day.status === 'ON_BREAK',
    });
  }
  return rows.sort((a, c) => c.date.localeCompare(a.date));
}
