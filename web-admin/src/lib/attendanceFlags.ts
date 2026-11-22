/** Penanda absen tablet (sama dengan backend kiosk.rules.ts) dan label tampilannya. */
export const FLAG_LABEL: Record<string, string> = {
  OFFLINE: 'Offline',
  PIN: 'PIN',
  GUEST: 'Kru tamu',
  UNSCHEDULED: 'Tidak terjadwal',
  CLOCK_CHANGED: 'Jam tablet berubah',
  FACE_REVIEW: 'Wajah perlu dicek',
  NO_FACE: 'Belum daftar wajah',
  PENDING_REVIEW: 'Menunggu tinjauan',
  BREAK_AUTO_CLOSED: 'Istirahat ditutup otomatis',
};

/** Penanda yang butuh perhatian HR diberi warna kuning; sisanya netral. */
const ATTENTION = new Set(['CLOCK_CHANGED', 'FACE_REVIEW', 'NO_FACE', 'PENDING_REVIEW']);

export const flagLabel = (flag: string) => FLAG_LABEL[flag] ?? flag;
export const flagClass = (flag: string) => (ATTENTION.has(flag) ? 'badge badge-warning' : 'badge badge-neutral');

/** Absen kru tamu bisa ditandai lewat isGuest atau penanda GUEST; keduanya tampil sekali. */
export function flagsOf(flags: string[] | null | undefined, isGuest = false): string[] {
  const list = [...(flags ?? [])];
  if (isGuest && !list.includes('GUEST')) list.unshift('GUEST');
  return list;
}

export const EVENT_TYPE_LABEL: Record<string, string> = {
  CLOCK_IN: 'Absen masuk',
  BREAK_START: 'Mulai istirahat',
  BREAK_END: 'Selesai istirahat',
  CLOCK_OUT: 'Absen pulang',
};
