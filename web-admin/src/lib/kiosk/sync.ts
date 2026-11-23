// Sinkron tablet absen: kirim antrean (naik), lalu ambil bootstrap (turun) dan
// catat selisih jam tablet-server. Jalan saat mulai, tiap 5 menit, dan saat koneksi pulih.
import { DeviceRevokedError, kioskFetch } from './api';
import { getConfig, pendingEvents, queueStats, removeEvents, saveBootstrap, saveConfig } from './db';
import type { BootstrapPayload, EventsResponse, QueuedEvent } from './types';

export interface SyncState {
  online: boolean;
  pending: number;
  lastSync: string | null; // ISO, bootstrap terakhir yang berhasil
}

const INTERVAL_MS = 5 * 60_000;
const BATCH_SIZE = 50; // sama dengan MAX_KIOSK_EVENTS_PER_BATCH di backend
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
  };
}

async function postEvents(events: QueuedEvent[]): Promise<Response> {
  return kioskFetch('/kiosk/events', {
    method: 'POST',
    body: JSON.stringify({ deviceNow: new Date().toISOString(), events: events.map(toDto) }),
  });
}

/** Kirim satu batch; kembalikan id event yang sudah dijawab server. */
async function sendBatch(batch: QueuedEvent[]): Promise<string[]> {
  const res = await postEvents(batch);
  if (res.ok) {
    const body = (await res.json()) as EventsResponse;
    const sent = new Set(batch.map((e) => e.id));
    return body.results.map((r) => r.id).filter((id) => sent.has(id));
  }
  // Batch ditolak utuh (isi tidak sah / terlalu besar): kirim satu per satu agar
  // satu event rusak tidak menahan yang lain. Event rusak tetap di antrean.
  if ((res.status === 400 || res.status === 413) && batch.length > 1) {
    const answered: string[] = [];
    for (const e of batch) answered.push(...(await sendBatch([e]).catch(rethrowUnlessHttp)));
    return answered;
  }
  if (res.status === 400 || res.status === 413) return [];
  throw new SyncHttpError(res.status);
}

function rethrowUnlessHttp(err: unknown): string[] {
  if (err instanceof SyncHttpError) return [];
  throw err;
}

/** true bila antrean habis terkirim dan semuanya dijawab. */
async function uploadQueue(): Promise<boolean> {
  for (;;) {
    const batch = await pendingEvents(BATCH_SIZE);
    if (batch.length === 0) return true;
    const answered = await sendBatch(batch);
    await removeEvents(answered);
    // Server belum bisa memproses sebagian: sisanya dicoba lagi nanti
    if (answered.length < batch.length) return false;
  }
}

async function pullBootstrap(): Promise<void> {
  const t0 = Date.now();
  const res = await kioskFetch('/kiosk/bootstrap');
  const t1 = Date.now(); // header diterima; serverTime dibuat sebelum isi paket disusun
  if (!res.ok) throw new SyncHttpError(res.status);
  const payload = (await res.json()) as BootstrapPayload;
  const offsetMs = Math.round(Date.parse(payload.serverTime) - (t0 + t1) / 2);
  await saveBootstrap(payload);
  const config = await getConfig();
  if (config) await saveConfig({ ...config, offsetMs, lastSyncAt: new Date().toISOString() });
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
  const state: SyncState = { online: navigator.onLine, pending: 0, lastSync: null };

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
      state.pending = (await queueStats()).count;
      emit();
      if (!navigator.onLine) {
        state.online = false;
      } else {
        const drained = await uploadQueue();
        await pullBootstrap();
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
      // fetch gagal = tidak ada jaringan; galat HTTP = server terjangkau tapi bermasalah
      state.online = err instanceof SyncHttpError;
    } finally {
      running = false;
      if (!stopped) {
        state.pending = await queueStats()
          .then((s) => s.count)
          .catch(() => state.pending);
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
