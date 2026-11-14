export const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const TOKEN_KEY = 'hris_backend_token';
const USER_KEY = 'hris_backend_user';

// Kru (EMPLOYEE) memakai aplikasi HP, bukan web admin
const WEB_ADMIN_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN', 'AREA_MANAGER', 'STORE_MANAGER'];

export interface SessionUser {
  id: string;
  username: string;
  role: string;
  fullName?: string;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return read(TOKEN_KEY);
}

export function getSessionUser(): SessionUser | null {
  const raw = read(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Penyimpanan browser tidak tersedia; tidak ada yang perlu dihapus
  }
}

function toSessionUser(user: any): SessionUser {
  return { id: user.id, username: user.username, role: user.role, fullName: user.profile?.fullName };
}

export function messageFrom(data: any, fallback: string): string {
  const message = data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : fallback;
}

export async function login(username: string, password: string): Promise<SessionUser> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error('Server HRIS tidak bisa dihubungi. Pastikan backend sudah berjalan.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Username atau password salah' : messageFrom(data, 'Login gagal'));
  }
  if (!WEB_ADMIN_ROLES.includes(data.user?.role)) {
    throw new Error('Akun kru tidak bisa masuk ke web admin. Gunakan aplikasi HP.');
  }

  const user = toSessionUser(data.user);
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

/**
 * Memastikan token masih berlaku dan milik peran web admin.
 * Mengembalikan null (dan menghapus sesi) jika tidak.
 */
export async function verifySession(): Promise<SessionUser | null> {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${BACKEND_API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearSession();
    return null;
  }
  if (!res.ok) {
    throw new Error('Server HRIS tidak bisa dihubungi');
  }

  const user = toSessionUser(await res.json());
  if (!WEB_ADMIN_ROLES.includes(user.role)) {
    clearSession();
    return null;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}
