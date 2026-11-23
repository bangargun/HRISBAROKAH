// Penyimpanan lokal tablet absen (IndexedDB "hris-absen"):
//   config    -> satu baris "device": token perangkat, nama cabang, selisih jam
//   bootstrap -> satu baris "current": paket data terakhir dari server
//   queue     -> event absen yang belum dijawab server (kunci: id event)
import type { BootstrapPayload, DeviceConfig, QueuedEvent } from './types';

const DB_NAME = 'hris-absen';
const DB_VERSION = 1;
const CONFIG = 'config';
const BOOTSTRAP = 'bootstrap';
const QUEUE = 'queue';
const BY_TIME = 'byDeviceTime';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CONFIG)) db.createObjectStore(CONFIG);
      if (!db.objectStoreNames.contains(BOOTSTRAP)) db.createObjectStore(BOOTSTRAP);
      if (!db.objectStoreNames.contains(QUEUE)) {
        db.createObjectStore(QUEUE, { keyPath: 'id' }).createIndex(BY_TIME, 'deviceTime');
      }
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
  const tx = db.transaction(QUEUE, 'readwrite');
  tx.objectStore(QUEUE).put(e);
  await done(tx);
}

/** Event tertua lebih dulu (urutan waktu tablet). */
export async function pendingEvents(limit: number): Promise<QueuedEvent[]> {
  const db = await openDb();
  const index = db.transaction(QUEUE, 'readonly').objectStore(QUEUE).index(BY_TIME);
  return result(index.getAll(null, limit)) as Promise<QueuedEvent[]>;
}

export async function removeEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE, 'readwrite');
  const store = tx.objectStore(QUEUE);
  for (const id of ids) store.delete(id);
  await done(tx);
}

export async function queueStats(): Promise<{ count: number; oldest: string | null }> {
  const db = await openDb();
  const store = db.transaction(QUEUE, 'readonly').objectStore(QUEUE);
  const [count, cursor] = await Promise.all([result(store.count()), result(store.index(BY_TIME).openCursor())]);
  return { count, oldest: cursor ? (cursor.value as QueuedEvent).deviceTime : null };
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
