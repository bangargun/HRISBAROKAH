// Aturan murni absen tablet (kiosk): waktu efektif, deteksi offline/jam berubah,
// dan urutan kejadian yang sah. Tanpa akses database agar mudah diuji.

export type KioskEventType = 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT';

// Penanda pada Attendance / AttendanceEvent
export const FLAG_OFFLINE = 'OFFLINE';
export const FLAG_PIN = 'PIN';
export const FLAG_GUEST = 'GUEST';
export const FLAG_UNSCHEDULED = 'UNSCHEDULED';
export const FLAG_CLOCK_CHANGED = 'CLOCK_CHANGED';
export const FLAG_FACE_REVIEW = 'FACE_REVIEW';
export const FLAG_NO_FACE = 'NO_FACE';
export const FLAG_PENDING_REVIEW = 'PENDING_REVIEW';
// Pulang saat istirahat belum selesai: istirahat ditutup otomatis pada jam pulang
export const FLAG_BREAK_AUTO_CLOSED = 'BREAK_AUTO_CLOSED';

// Alasan penolakan urutan kejadian
export const REASON_ALREADY_CLOCKED_IN = 'Sudah absen masuk';
export const REASON_NOT_CLOCKED_IN = 'Belum absen masuk';
export const REASON_ALREADY_ON_BREAK = 'Masih istirahat';
export const REASON_NOT_ON_BREAK = 'Tidak sedang istirahat';
export const REASON_BEFORE_CLOCK_IN = 'Waktu sebelum absen masuk';

// Absen yang belum pulang dianggap tidak lagi terbuka setelah 16 jam
export const OPEN_ATTENDANCE_MAX_MS = 16 * 3600_000;

export interface DayState {
  attendanceId: string;
  clockIn: Date;
  clockOut: Date | null;
  openBreakStart: Date | null;
}

// offsetAtEventMs = waktu server - waktu tablet saat kejadian
export function effectiveTime(deviceTime: Date, offsetAtEventMs: number): Date {
  return new Date(deviceTime.getTime() + offsetAtEventMs);
}

// Jam tablet digeser bila selisihnya berubah lebih dari toleransi
export function clockChanged(offsetAtEventMs: number, offsetNowMs: number, toleranceMs = 120_000): boolean {
  return Math.abs(offsetNowMs - offsetAtEventMs) > toleranceMs;
}

// Offline = diterima server lebih dari 2 menit setelah kejadian
export function wasOffline(effective: Date, receivedAt: Date): boolean {
  return receivedAt.getTime() - effective.getTime() > 120_000;
}

export function isOpen(state: DayState | null, at: Date): boolean {
  if (!state || state.clockOut) return false;
  return at.getTime() - state.clockIn.getTime() <= OPEN_ATTENDANCE_MAX_MS;
}

export type TransitionResult = { ok: true; closeBreakAt?: Date } | { ok: false; reason: string };

// Untuk CLOCK_IN, pemanggil memberi state baris absen pada tanggal itu (atau null).
export function checkTransition(state: DayState | null, type: KioskEventType, at: Date): TransitionResult {
  if (state && at.getTime() < state.clockIn.getTime()) {
    return { ok: false, reason: REASON_BEFORE_CLOCK_IN };
  }
  if (type === 'CLOCK_IN') {
    return state ? { ok: false, reason: REASON_ALREADY_CLOCKED_IN } : { ok: true };
  }
  if (!state || !isOpen(state, at)) return { ok: false, reason: REASON_NOT_CLOCKED_IN };
  if (type === 'BREAK_START') {
    return state.openBreakStart ? { ok: false, reason: REASON_ALREADY_ON_BREAK } : { ok: true };
  }
  if (type === 'BREAK_END') {
    return state.openBreakStart ? { ok: true } : { ok: false, reason: REASON_NOT_ON_BREAK };
  }
  // CLOCK_OUT: istirahat yang masih terbuka ikut ditutup
  return state.openBreakStart ? { ok: true, closeBreakAt: at } : { ok: true };
}
