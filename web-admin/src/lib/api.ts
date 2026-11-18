import { BACKEND_API, clearSession, getToken, messageFrom } from './auth';

/** Kirim permintaan ber-token; menangani sesi habis dan pesan galat yang siap ditampilkan. */
async function send(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${getToken() ?? ''}`, ...init.headers },
    });
  } catch {
    throw new Error('Server HRIS tidak bisa dihubungi. Periksa koneksi lalu coba lagi.');
  }
  if (res.status === 401) {
    clearSession();
    window.location.assign('/login');
    throw new Error('Sesi berakhir, silakan masuk lagi.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(
      res.status === 413 ? 'Ukuran berkas terlalu besar' : messageFrom(data, `Permintaan gagal (kode ${res.status})`),
    );
  }
  return res;
}

/** Panggilan JSON ke backend HRIS dengan token sesi admin. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  return (await res.json().catch(() => null)) as T;
}

/** Unggah berkas (multipart); browser yang mengatur Content-Type. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await send(path, { method: 'POST', body: form });
  return (await res.json()) as T;
}

/** Unduh berkas privat sebagai Blob (butuh token, jadi tidak bisa lewat tautan biasa). */
export async function apiBlob(path: string): Promise<Blob> {
  return (await send(path, {})).blob();
}
