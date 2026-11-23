// Penyimpanan lokal tablet absen (IndexedDB "hris-absen"):
//   config    -> satu baris "device": token perangkat, nama cabang, selisih jam
//   bootstrap -> satu baris "current": paket data terakhir dari server
//   queue     -> event absen yang belum dijawab server (kunci: id event; indeks waktu+id untuk
//                halaman kiriman, dan firstSentAt untuk event yang lama tidak dijawab)
import type { BootstrapPayload, DeviceConfig, QueuedEvent } from './types';

const DB_NAME = 'hris-absen';
const DB_VERSION = 2;
const CONFIG = 'config';
const BOOTSTRAP = 'bootstrap';
const QUEUE = 'queue';
const BY_TIME = 'byDeviceTime';
const BY_TIME_ID = 'byDeviceTimeId';
const BY_FIRST_SENT = 'byFirstSentAt';
// Event yang sudah dikirim tetapi tetap tidak dijawab server selama ini dihitung "macet"
export const STUCK_AFTER_MS = 24 * 3600_000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CONFIG)) db.createObjectStore(CONFIG);
      if (!db.objectStoreNames.contains(BOOTSTRAP)) db.createObjectStore(BOOTSTRAP);
      const queue = db.objectStoreNames.contains(QUEUE)
        ? req.transaction!.objectStore(QUEUE)
        : db.createObjectStore(QUEUE, { keyPath: 'id' });
      if (!queue.indexNames.contains(BY_TIME)) queue.createIndex(BY_TIME, 'deviceTime');
      if (!queue.indexNames.contains(BY_TIME_ID)) queue.createIndex(BY_TIME_ID, ['deviceTime', 'id']);
      if (!queue.indexNames.contains(BY_FIRST_SENT)) queue.createIndex(BY_FIRST_SENT, 'firstSentAt');
    };
    req.onsuccess = () => {
      const db = req.result;
      // Tab lain meningkatkan versi: lepaskan koneksi agar tidak saling menghalangi
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaksi IndexedDB dibatalkan'));
  });
}

function result<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOne<T>(store: string, key: string): Promise<T | null> {
  const db = await openDb();
  const value = await result(db.transaction(store, 'readonly').objectStore(store).get(key));
  return (value as T | undefined) ?? null;
}

async function putOne(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value, key);
  await done(tx);
}

export function getConfig(): Promise<DeviceConfig | null> {
  return getOne<DeviceConfig>(CONFIG, 'device');
}

export function saveConfig(c: DeviceConfig): Promise<void> {
  return putOne(CONFIG, 'device', c);
}

export function getBootstrap(): Promise<BootstrapPayload | null> {
  return getOne<BootstrapPayload>(BOOTSTRAP, 'current');
}

export function saveBootstrap(b: BootstrapPayload): Promise<void> {
  return putOne(BOOTSTRAP, 'current', b);
}

/** Disimpan sebelum layar menampilkan "Tercatat". */
export async function enqueue(e: QueuedEvent): Promise<void> {
  const db = await openDb();
  // strict: tulisan sudah di disk sebelum layar menampilkan "Tercatat"
  const tx = db.transaction(QUEUE, 'readwrite', { durability: 'strict' });
  tx.objectStore(QUEUE).put(e);
  await done(tx);
}

/**
 * Event tertua lebih dulu (urutan waktu tablet, lalu id). `after` = event terakhir halaman
 * sebelumnya, agar event yang belum dijawab tidak menghalangi event sesudahnya.
 */
export async function pendingEvents(limit: number, after?: Pick<QueuedEvent, 'deviceTime' | 'id'>): Promise<QueuedEvent[]> {
  const db = await openDb();
  const index = db.transaction(QUEUE, 'readonly').objectStore(QUEUE).index(BY_TIME_ID);
  const range = after ? IDBKeyRange.lowerBound([after.deviceTime, after.id], true) : null;
  return result(index.getAll(range, limit)) as Promise<QueuedEvent[]>;
}

/** Catat kiriman pertama yang tidak dijawab server (untuk hitungan event macet). */
export async function markUnanswered(ids: string[], at: string): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE, 'readwrite');
  const store = tx.objectStore(QUEUE);
  for (const id of ids) {
    const req = store.get(id);
    req.onsuccess = () => {
      const e = req.result as QueuedEvent | undefined;
      if (e && !e.firstSentAt) store.put({ ...e, firstSentAt: at });
    };
  }
  await done(tx);
}

export async function removeEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE, 'readwrite');
  const store = tx.objectStore(QUEUE);
  for (const id of ids) store.delete(id);
  await done(tx);
}

/** count = semua event antre; stuck = sudah dikirim tetapi tidak dijawab server lebih dari 24 jam. */
export async function queueStats(now: Date = new Date()): Promise<{ count: number; oldest: string | null; stuck: number }> {
  const db = await openDb();
  const store = db.transaction(QUEUE, 'readonly').objectStore(QUEUE);
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS).toISOString();
  const [count, cursor, stuck] = await Promise.all([
    result(store.count()),
    result(store.index(BY_TIME).openKeyCursor()),
    result(store.index(BY_FIRST_SENT).count(IDBKeyRange.upperBound(cutoff))),
  ]);
  return { count, oldest: cursor ? (cursor.key as string) : null, stuck };
}

/** Token dicabut: hapus seluruh data lokal (token, roster, wajah, antrean). */
export async function wipeAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([CONFIG, BOOTSTRAP, QUEUE], 'readwrite');
  tx.objectStore(CONFIG).clear();
  tx.objectStore(BOOTSTRAP).clear();
  tx.objectStore(QUEUE).clear();
  await done(tx);
}
