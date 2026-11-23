// Sinkron tablet absen: kirim antrean (naik), lalu ambil bootstrap (turun) dan
// catat selisih jam tablet-server. Jalan saat mulai, tiap 5 menit, dan saat koneksi pulih.
import { DeviceRevokedError, KioskNetworkError, kioskFetch } from './api';
import { aheadOfNow, resetClockBaseline } from './clock';
import { getConfig, markUnanswered, pendingEvents, queueStats, removeEvents, saveBootstrap, saveConfig } from './db';
import type { BootstrapPayload, EventsResponse, QueuedEvent } from './types';

export interface SyncState {
  online: boolean;
  pending: number;
  stuck: number; // dikirim tetapi tidak dijawab server lebih dari 24 jam
  oldest: string | null; // deviceTime event antre tertua (batas antrean di papan)
  lastSync: string | null; // ISO, bootstrap terakhir yang berhasil
}

const INTERVAL_MS = 5 * 60_000;
// Batas backend 50 (MAX_KIOSK_EVENTS_PER_BATCH); 20 agar satu unggahan (foto) tetap singkat di jaringan lambat
const BATCH_SIZE = 20;
// Event yang belum dijawab server dikirim ulang dengan jeda bertambah: 30 dtk, 1, 2, 4, lalu 5 menit
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 5 * 60_000;

/** Server terjangkau tetapi menjawab dengan galat (5xx, 4xx selain 401). */
class SyncHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

// Hanya field KioskEventDto: field tambahan di antrean tidak boleh membuat batch ditolak
function toDto(e: QueuedEvent) {
  return {
    id: e.id,
    employeeId: e.employeeId,
    type: e.type,
    method: e.method,
    deviceTime: e.deviceTime,
    offsetAtEventMs: e.offsetAtEventMs,
    ...(e.localScore !== undefined ? { localScore: e.localScore } : {}),
    photoBase64: e.photoBase64,
    ...(e.pin ? { pin: e.pin } : {}),
    // Jam tablet saat event di depan jam sekarang: dibuat ketika jam dimajukan lalu dikembalikan
    ...(e.clockSuspect || aheadOfNow(e.deviceTime) ? { clockSuspect: true } : {}),
  };
}

/**
 * Selisih jam server - jam tablet, diukur tepat sebelum mengirim batch (titik tengah permintaan
 * ringan GET /kiosk/time). deviceNow saja tidak cukup: dicap sebelum unggahan foto yang bisa lama.
 * null bila server belum punya rute ini (deploy lama): server memakai deviceNow.
 */
async function measureOffset(): Promise<number | null> {
  const t0 = Date.now();
  const res = await kioskFetch('/kiosk/time');
  const t1 = Date.now();
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new SyncHttpError(res.status);
  }
  const { serverTime } = (await res.json()) as { serverTime: string };
  const server = Date.parse(serverTime);
  return Number.isFinite(server) ? Math.round(server - (t0 + t1) / 2) : null;
}

async function postEvents(events: QueuedEvent[], offsetNowMs: number | null): Promise<Response> {
  return kioskFetch('/kiosk/events', {
    method: 'POST',
    body: JSON.stringify({
      deviceNow: new Date().toISOString(),
      ...(offsetNowMs !== null ? { offsetNowMs } : {}),
      events: events.map(toDto),
    }),
  });
}

/** Kirim satu batch; kembalikan id event yang sudah dijawab server. */
async function sendBatch(batch: QueuedEvent[], offsetNowMs: number | null): Promise<string[]> {
  const res = await postEvents(batch, offsetNowMs);
  if (res.ok) {
    const body = (await res.json()) as EventsResponse;
    const sent = new Set(batch.map((e) => e.id));
    return body.results.map((r) => r.id).filter((id) => sent.has(id));
  }
  // Batch ditolak utuh (isi tidak sah / terlalu besar): kirim satu per satu agar
  // satu event rusak tidak menahan yang lain. Event rusak tetap di antrean.
  if ((res.status === 400 || res.status === 413) && batch.length > 1) {
    const answered: string[] = [];
    for (const e of batch) answered.push(...(await sendBatch([e], offsetNowMs).catch(rethrowUnlessHttp)));
    return answered;
  }
  if (res.status === 400 || res.status === 413) return [];
  throw new SyncHttpError(res.status);
}

function rethrowUnlessHttp(err: unknown): string[] {
  if (err instanceof SyncHttpError) return [];
  throw err;
}

/**
 * Kirim seluruh antrean sekali jalan, halaman demi halaman (kursor setelah event terakhir yang
 * dicoba), sehingga event yang tidak dijawab di depan tidak menghalangi event sesudahnya.
 * true bila semua event dijawab; null bila dihentikan.
 */
async function uploadQueue(isStopped: () => boolean): Promise<boolean | null> {
  let allAnswered = true;
  let after: QueuedEvent | undefined;
  for (;;) {
    if (isStopped()) return null;
    const batch = await pendingEvents(BATCH_SIZE, after);
    if (batch.length === 0) return allAnswered;
    after = batch[batch.length - 1];
    const answered = await sendBatch(batch, await measureOffset());
    if (isStopped()) return null; // dijawab server tapi belum dihapus: kiriman ulang aman (idempoten)
    await removeEvents(answered);
    const answeredSet = new Set(answered);
    const unanswered = batch.filter((e) => !answeredSet.has(e.id)).map((e) => e.id);
    if (unanswered.length > 0) {
      // Server belum bisa memproses sebagian: dicoba lagi pada jalan berikutnya (dengan jeda)
      allAnswered = false;
      await markUnanswered(unanswered, new Date().toISOString());
    }
  }
}

/** `pending` = absen yang belum terkirim; disimpan server agar admin tahu sebelum mencabut tablet. */
async function pullBootstrap(pending: number): Promise<void> {
  const t0 = Date.now();
  const res = await kioskFetch(`/kiosk/bootstrap?pending=${pending}`);
  const t1 = Date.now(); // header diterima; serverTime dibuat sebelum isi paket disusun
  if (!res.ok) throw new SyncHttpError(res.status);
  const payload = (await res.json()) as BootstrapPayload;
  const offsetMs = Math.round(Date.parse(payload.serverTime) - (t0 + t1) / 2);
  await saveBootstrap(payload);
  const config = await getConfig();
  if (config) await saveConfig({ ...config, offsetMs, lastSyncAt: new Date().toISOString() });
  await resetClockBaseline().catch(() => undefined);
}

let activeTrigger: (() => void) | null = null;

/** Minta sinkron segera (mis. setelah event baru diantre). Tidak berbuat apa pun bila sinkron belum dimulai. */
export function syncNow(): void {
  activeTrigger?.();
}

/** Mulai sinkron berkala; kembalikan fungsi untuk menghentikannya. */
export function startSync(onState: (s: SyncState) => void): () => void {
  let stopped = false;
  let running = false;
  let rerun = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const state: SyncState = { online: navigator.onLine, pending: 0, stuck: 0, oldest: null, lastSync: null };
  const refreshQueue = async () => {
    const stats = await queueStats();
    state.pending = stats.count;
    state.stuck = stats.stuck;
    state.oldest = stats.oldest;
  };

  const emit = () => {
    if (!stopped) onState({ ...state });
  };

  const schedule = (healthy: boolean) => {
    if (stopped) return;
    clearTimeout(timer);
    failures = healthy ? 0 : failures + 1;
    const delay = healthy ? INTERVAL_MS : Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
    timer = setTimeout(run, delay);
  };

  async function run(): Promise<void> {
    if (stopped) return;
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    clearTimeout(timer);
    let healthy = false;
    try {
      const config = await getConfig();
      if (!config) {
        stopped = true;
        return;
      }
      state.lastSync = config.lastSyncAt ?? null;
      await refreshQueue();
      emit();
      if (!navigator.onLine) {
        state.online = false;
      } else {
        const drained = await uploadQueue(() => stopped);
        if (drained === null) return;
        await pullBootstrap((await queueStats()).count);
        state.online = true;
        state.lastSync = (await getConfig())?.lastSyncAt ?? state.lastSync;
        healthy = drained;
      }
    } catch (err) {
      if (err instanceof DeviceRevokedError) {
        // Data lokal sudah dihapus dan halaman dimuat ulang ke layar kode
        stopped = true;
        return;
      }
      // Hanya fetch yang gagal berarti offline; galat HTTP = server terjangkau tapi bermasalah;
      // galat lain (IndexedDB, JSON) tidak mengubah status koneksi
      if (err instanceof KioskNetworkError) state.online = false;
      else if (err instanceof SyncHttpError) state.online = true;
    } finally {
      running = false;
      if (!stopped) {
        await refreshQueue().catch(() => undefined);
        emit();
        schedule(healthy);
        if (rerun) {
          rerun = false;
          void run();
        }
      }
    }
  }

  const onOnline = () => {
    failures = 0;
    void run();
  };
  const onOffline = () => {
    state.online = false;
    emit();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const trigger = () => void run();
  activeTrigger = trigger;
  void run();

  return () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    if (activeTrigger === trigger) activeTrigger = null;
  };
}
