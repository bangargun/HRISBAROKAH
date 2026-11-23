// Status absen seorang kru di tablet: baris "today" dari bootstrap + event yang masih di antrean.
// Sumber kebenaran ada di backend: backend/src/modules/kiosk/kiosk.rules.ts (checkTransition,
// isOpen, OPEN_ATTENDANCE_MAX_MS) dan pemilihan baris di events.service.ts (applyInTx).
// Ubah keduanya bersamaan.
import type { BootstrapTodayRow, KioskEventType, QueuedEvent } from './types';

export type DayStatus = 'OUT' | 'IN' | 'ON_BREAK' | 'DONE';

// Absen yang belum pulang dianggap tidak lagi terbuka setelah 16 jam
export const OPEN_ATTENDANCE_MAX_MS = 16 * 3600_000;

// Zona waktu bisnis backend (BUSINESS_TIMEZONE, bawaan Asia/Jakarta)
const ymdFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Tanggal kalender (YYYY-MM-DD) di zona waktu bisnis. */
export function businessDate(at: Date): string {
  return ymdFormat.format(at);
}

interface DayState {
  date: string; // tanggal kalender absen (tanggal bisnis jam masuk)
  clockIn: Date;
  clockOut: Date | null;
  openBreakStart: Date | null;
}

type TransitionResult = { ok: true; closeBreakAt?: Date } | { ok: false; reason: string };

// Salinan isOpen dari kiosk.rules.ts
function isOpen(state: DayState | null, at: Date): boolean {
  if (!state || state.clockOut) return false;
  return at.getTime() - state.clockIn.getTime() <= OPEN_ATTENDANCE_MAX_MS;
}

// Salinan checkTransition dari kiosk.rules.ts (alasan sama dengan backend)
function checkTransition(state: DayState | null, type: KioskEventType, at: Date): TransitionResult {
  if (state && at.getTime() < state.clockIn.getTime()) {
    return { ok: false, reason: 'Waktu sebelum absen masuk' };
  }
  if (type === 'CLOCK_IN') {
    return state ? { ok: false, reason: 'Sudah absen masuk' } : { ok: true };
  }
  if (!state || !isOpen(state, at)) return { ok: false, reason: 'Belum absen masuk' };
  if (type === 'BREAK_START') {
    return state.openBreakStart ? { ok: false, reason: 'Masih istirahat' } : { ok: true };
  }
  if (type === 'BREAK_END') {
    return state.openBreakStart ? { ok: true } : { ok: false, reason: 'Tidak sedang istirahat' };
  }
  return state.openBreakStart ? { ok: true, closeBreakAt: at } : { ok: true };
}

const toDate = (iso: string | null) => (iso ? new Date(iso) : null);

// Seperti applyInTx: CLOCK_IN -> baris pada tanggal kejadian; lainnya -> absen belum pulang
// terbaru yang dimulai dalam 16 jam sebelum kejadian.
function rowFor(rows: DayState[], type: KioskEventType, at: Date): DayState | null {
  if (type === 'CLOCK_IN') return rows.find((r) => r.date === businessDate(at)) ?? null;
  const t = at.getTime();
  const open = rows.filter(
    (r) => !r.clockOut && r.clockIn.getTime() <= t && r.clockIn.getTime() >= t - OPEN_ATTENDANCE_MAX_MS,
  );
  return open.sort((a, b) => b.clockIn.getTime() - a.clockIn.getTime())[0] ?? null;
}

function apply(rows: DayState[], e: QueuedEvent): void {
  // Waktu efektif = jam tablet + selisih jam saat kejadian (effectiveTime di backend)
  const at = new Date(Date.parse(e.deviceTime) + e.offsetAtEventMs);
  const row = rowFor(rows, e.type, at);
  if (!checkTransition(row, e.type, at).ok) return; // di server menjadi NEEDS_REVIEW, tidak diterapkan
  if (e.type === 'CLOCK_IN') {
    rows.push({ date: businessDate(at), clockIn: at, clockOut: null, openBreakStart: null });
  } else if (row && e.type === 'BREAK_START') {
    row.openBreakStart = at;
  } else if (row && e.type === 'BREAK_END') {
    row.openBreakStart = null;
  } else if (row) {
    row.openBreakStart = null;
    row.clockOut = at;
  }
}

/**
 * Status kru pada `now` (jam server: jam tablet + offsetMs).
 * OUT = boleh absen masuk; IN = sedang bekerja; ON_BREAK = istirahat; DONE = sudah pulang hari ini.
 */
export function dayStatus(
  bootstrapToday: BootstrapTodayRow[],
  queued: QueuedEvent[],
  employeeId: string,
  now: Date,
): DayStatus {
  const rows: DayState[] = bootstrapToday
    .filter((r) => r.employeeId === employeeId && r.clockIn)
    .map((r) => {
      const clockIn = new Date(r.clockIn as string);
      return { date: businessDate(clockIn), clockIn, clockOut: toDate(r.clockOut), openBreakStart: toDate(r.openBreakStart) };
    });
  const mine = queued
    .filter((e) => e.employeeId === employeeId)
    .sort((a, b) => Date.parse(a.deviceTime) + a.offsetAtEventMs - (Date.parse(b.deviceTime) + b.offsetAtEventMs));
  for (const e of mine) apply(rows, e);

  const open = rowFor(rows, 'CLOCK_OUT', now);
  if (open && isOpen(open, now)) return open.openBreakStart ? 'ON_BREAK' : 'IN';
  // Sudah ada absen pada tanggal ini: server menolak absen masuk kedua
  if (rows.some((r) => r.date === businessDate(now))) return 'DONE';
  return 'OUT';
}

/** Tombol aksi yang berlaku untuk status (spec §4: Masuk / Mulai istirahat, Pulang / Selesai istirahat). */
export function allowedActions(status: DayStatus): KioskEventType[] {
  switch (status) {
    case 'OUT':
      return ['CLOCK_IN'];
    case 'IN':
      return ['BREAK_START', 'CLOCK_OUT'];
    case 'ON_BREAK':
      return ['BREAK_END'];
    default:
      return [];
  }
}
