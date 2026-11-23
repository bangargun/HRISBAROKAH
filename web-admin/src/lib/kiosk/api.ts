// Panggilan API tablet absen. Memakai token perangkat, bukan sesi admin.
import { BACKEND_API } from '@/lib/auth';
import { getConfig, wipeAll } from './db';
import type { PairResponse } from './types';

export const ABSEN_PATH = '/absen';

/** Token tablet sudah dicabut / tidak dikenal; data lokal sudah dihapus. */
export class DeviceRevokedError extends Error {
  constructor() {
    super('Tablet tidak lagi terpasang');
    this.name = 'DeviceRevokedError';
  }
}

/** Permintaan tidak sampai ke server (tidak ada jaringan / server tidak terjangkau). */
export class KioskNetworkError extends Error {
  constructor(cause: unknown) {
    super('Tidak ada koneksi ke server');
    this.name = 'KioskNetworkError';
    this.cause = cause;
  }
}

/** Server menolak permintaan dengan pesan yang bisa ditampilkan. */
export class KioskApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'KioskApiError';
  }
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const msg = Array.isArray(body?.message) ? body.message[0] : body?.message;
    return typeof msg === 'string' && msg ? msg : fallback;
  } catch {
    return fallback;
  }
}

/**
 * fetch ke backend dengan token perangkat. 401 berarti token dicabut: seluruh data lokal
 * dihapus lalu halaman kembali ke layar kode pasangan. Galat jaringan menjadi KioskNetworkError.
 */
export async function kioskFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = await getConfig();
  if (!config) throw new DeviceRevokedError();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${config.token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let res: Response;
  try {
    res = await fetch(`${BACKEND_API}${path}`, { ...init, headers, cache: 'no-store' });
  } catch (err) {
    throw new KioskNetworkError(err);
  }
  if (res.status === 401) {
    await wipeAll();
    window.location.replace(ABSEN_PATH);
    throw new DeviceRevokedError();
  }
  return res;
}

/** Tukar kode pasangan 8 karakter dengan token perangkat. */
export async function pairDevice(code: string): Promise<PairResponse> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_API}/kiosk/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      cache: 'no-store',
    });
  } catch {
    throw new KioskApiError('Tidak ada koneksi ke server. Sambungkan tablet ke internet lalu coba lagi.', 0);
  }
  if (res.status === 429) {
    throw new KioskApiError('Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.', 429);
  }
  if (!res.ok) throw new KioskApiError(await errorMessage(res, 'Kode tidak berlaku'), res.status);
  return res.json();
}
