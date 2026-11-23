// Bentuk data API tablet absen (kiosk). Tidak ada paket bersama antar aplikasi:
// jaga tetap sama dengan sumber backend saat salah satunya berubah.
//   - backend/src/modules/kiosk/bootstrap.service.ts (BootstrapPayload)
//   - backend/src/modules/kiosk/kiosk.dto.ts (KioskEventDto, KioskEventsDto)
//   - backend/src/modules/kiosk/events.service.ts (EventResult)
//   - backend/src/modules/kiosk/devices.service.ts (respons pair)
//   - backend/src/common/utils/work-hours.util.ts (OutletHours)

export type KioskEventType = 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT';
export type KioskMethod = 'FACE_LOCAL' | 'FACE_SERVER' | 'PIN';
export type AttendanceEventStatus = 'APPLIED' | 'NEEDS_REVIEW' | 'REJECTED';

export interface OutletHours {
  weekdayWorkStart: string;
  weekdayWorkEnd: string;
  weekendWorkStart: string;
  weekendWorkEnd: string;
  holidayWorkStart: string;
  holidayWorkEnd: string;
}

export interface BootstrapRosterEntry {
  employeeId: string;
  fullName: string;
  positionTitle: string;
  homeOutletName: string;
  isGuest: boolean;
  guestDates: string[];
  embeddings: number[][];
  hasPin: boolean;
  // Jadwal hari ini .. +3 di cabang mana pun; here = bertugas di cabang tablet ini
  shifts: { date: string; here: boolean }[];
}

export interface BootstrapTodayRow {
  employeeId: string;
  clockIn: string | null;
  clockOut: string | null;
  openBreakStart: string | null;
  lateMinutes: number;
  // Absen tercatat di cabang tablet ini. false = absen kru roster di cabang lain (hari ini / masih
  // terbuka) agar kru yang pindah cabang bisa istirahat / pulang di sini. Tidak ada di paket lama = true.
  here?: boolean;
}

export interface BootstrapRecapDay {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  lateMinutes: number;
  breakMinutes: number;
  // 0 selama belum absen pulang
  workMinutes: number;
}

export interface BootstrapPayload {
  serverTime: string;
  matchThreshold: number;
  outlet: { id: string; name: string; hours: OutletHours; breakLimitMins: number };
  holidays: string[];
  roster: BootstrapRosterEntry[];
  directory: { employeeId: string; fullName: string; homeOutletName: string }[];
  today: BootstrapTodayRow[];
  recap: { employeeId: string; days: BootstrapRecapDay[] }[];
}

export interface PairResponse {
  token: string;
  device: { id: string; name: string };
  outlet: { id: string; name: string };
}

/** Satu event absen di antrean tablet; bentuknya sama dengan KioskEventDto. */
export interface QueuedEvent {
  id: string; // UUID dari tablet, kunci unik di server
  employeeId: string;
  type: KioskEventType;
  method: KioskMethod;
  deviceTime: string; // ISO, jam tablet saat kejadian
  offsetAtEventMs: number; // jam server - jam tablet pada sinkron terakhir sebelum kejadian
  localScore?: number;
  photoBase64: string;
  pin?: string; // hanya metode PIN; hilang bersama event setelah dijawab server
  clockSuspect?: boolean; // jam tablet terlihat mundur saat event dibuat (lihat clock.ts)
  // Diisi tablet: kiriman pertama yang diterima server tetapi tidak dijawab. Tidak dikirim.
  firstSentAt?: string;
}

/** Jawaban POST /kiosk/identify. today = absen hari ini / masih terbuka kru itu di cabang mana pun. */
export interface IdentifyResponse {
  employeeId: string;
  fullName: string;
  homeOutletName: string;
  score: number;
  today?: BootstrapTodayRow[];
}

export interface EventResult {
  id: string;
  status: AttendanceEventStatus;
  reason: string | null;
}

export interface EventsResponse {
  // Event yang belum bisa diproses server tidak ikut di sini: tetap diantre dan dikirim ulang
  results: EventResult[];
}

export interface DeviceConfig {
  token: string;
  deviceId: string;
  deviceName: string;
  outletName: string;
  offsetMs: number; // jam server - jam tablet, dari bootstrap terakhir
  lastSyncAt?: string | null; // ISO jam tablet saat bootstrap terakhir berhasil
}
