// Deteksi jam tablet yang dimundurkan (spec: absen dengan jam digeser harus ditinjau HR).
// Server hanya melihat selisih jam saat sinkron; jam yang dimundurkan saat offline lalu
// dikembalikan sebelum sinkron tidak terlihat di sana. Tablet menandai event clockSuspect bila:
//  - jam sekarang lebih dari 2 menit di belakang jam tertinggi yang pernah terlihat (disimpan di
//    IndexedDB, jadi tetap terdeteksi setelah halaman dimuat ulang), atau
//  - jam dinding berjalan mundur terhadap jam monoton (performance.now) sejak acuan terakhir.
// Jam dinding yang maju lebih cepat dari jam monoton tidak ditandai: perangkat yang tidur
// menghentikan jam monoton, jadi itu tidak bisa dibedakan dari pemajuan jam.
import { getClockMark, saveClockMark } from './db';

export const CLOCK_JUMP_MS = 2 * 60_000;
const MARK_INTERVAL_MS = 60_000;

// Acuan jam dinding vs monoton; diperbarui setelah sinkron berhasil (jam sudah diukur server)
let base = { wall: performance.timeOrigin, mono: 0 };

function wallBehindMonotonic(now: number): boolean {
  const expected = base.wall + (performance.now() - base.mono);
  return now < expected - CLOCK_JUMP_MS;
}

async function raiseMark(now: number): Promise<number | null> {
  const mark = await getClockMark();
  if (mark === null || now > mark) await saveClockMark(now);
  return mark;
}

/** Dipanggil saat event dibuat. Galat IndexedDB tidak menahan absen (dianggap tidak mencurigakan). */
export async function clockSuspectNow(): Promise<boolean> {
  const now = Date.now();
  let suspect = wallBehindMonotonic(now);
  try {
    const mark = await raiseMark(now);
    if (mark !== null && now < mark - CLOCK_JUMP_MS) suspect = true;
  } catch {
    // abaikan
  }
  return suspect;
}

/** Event antre yang jam tabletnya di depan jam sekarang: dibuat saat jam dimajukan. */
export function aheadOfNow(deviceTimeIso: string, now = Date.now()): boolean {
  return Date.parse(deviceTimeIso) > now + CLOCK_JUMP_MS;
}

/** Setelah sinkron berhasil: jam tablet baru diukur server, acuan dimulai ulang dari sekarang. */
export async function resetClockBaseline(): Promise<void> {
  const now = Date.now();
  base = { wall: now, mono: performance.now() };
  await saveClockMark(now);
}

/** Catat jam tertinggi tiap menit selama halaman terbuka; kembalikan fungsi penghenti. */
export function startClockWatch(): () => void {
  const tick = () => void raiseMark(Date.now()).catch(() => undefined);
  tick();
  const id = setInterval(tick, MARK_INTERVAL_MS);
  return () => clearInterval(id);
}
