import { BACKEND_API, clearSession, getToken, messageFrom } from './auth';

/** Panggilan ke backend HRIS dengan token sesi admin. Melempar Error berisi pesan yang siap ditampilkan. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_API}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken() ?? ''}`,
        ...init.headers,
      },
    });
  } catch {
    throw new Error('Server HRIS tidak bisa dihubungi. Periksa koneksi lalu coba lagi.');
  }

  const data = await res.json().catch(() => null);

  if (res.status === 401) {
    clearSession();
    window.location.assign('/login');
    throw new Error('Sesi berakhir, silakan masuk lagi.');
  }
  if (!res.ok) {
    throw new Error(messageFrom(data, `Permintaan gagal (kode ${res.status})`));
  }
  return data as T;
}
