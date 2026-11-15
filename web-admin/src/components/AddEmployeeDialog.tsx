'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/navigation';
import Dialog from '@/components/Dialog';

interface OutletOption {
  id: string;
  name: string;
}

interface PositionOption {
  id: string;
  title: string;
  department: { name: string };
}

// Sama dengan aturan backend: akun admin hanya bisa dibuat Super Admin
const BASE_ROLES = ['EMPLOYEE', 'STORE_MANAGER', 'AREA_MANAGER'];
const ADMIN_ROLES = ['HR_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'];
const roleLabel = (r: string) => (r === 'EMPLOYEE' ? 'Kru (aplikasi HP)' : ROLE_LABEL[r] ?? r);

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Form tambah karyawan: menyimpan langsung ke database, pilihan cabang dan jabatan dari data asli. */
export default function AddEmployeeDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (fullName: string) => void }) {
  const isSuperAdmin = getSessionUser()?.role === 'SUPER_ADMIN';
  const roles = isSuperAdmin ? [...BASE_ROLES, ...ADMIN_ROLES] : BASE_ROLES;

  const [outlets, setOutlets] = useState<OutletOption[] | null>(null);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    nik: '',
    phone: '',
    outletId: '',
    positionId: '',
    role: 'EMPLOYEE',
    joinDate: localToday(),
    username: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<OutletOption[]>('/outlets'), apiFetch<PositionOption[]>('/employees/positions')])
      .then(([o, p]) => {
        setOutlets(o);
        setPositions(p);
        setForm((f) => ({ ...f, outletId: o[0]?.id ?? '', positionId: p[0]?.id ?? '' }));
      })
      .catch((e) => {
        setOutlets([]);
        setError((e as Error).message);
      });
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/employees', { method: 'POST', body: JSON.stringify(form) });
      onSaved(form.fullName.trim());
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-amber-500';
  const heading = 'text-xs font-semibold uppercase text-slate-500';

  return (
    <Dialog wide title="Tambah karyawan" onClose={onClose}>
      {outlets === null ? (
        <div className="flex items-center gap-2 py-6 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat cabang dan jabatan…
        </div>
      ) : outlets.length === 0 || positions.length === 0 ? (
        <div className="space-y-3">
          <p className="text-slate-700">
            {error ??
              (outlets.length === 0
                ? 'Belum ada cabang aktif. Tambahkan cabang lebih dulu di menu Cabang, lalu daftarkan karyawannya.'
                : 'Belum ada jabatan di database.')}
          </p>
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button type="button" onClick={onClose} className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800">
              Tutup
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-3">
            <p className={heading}>Data karyawan</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 sm:col-span-2">
                <span className="font-medium text-slate-700">Nama lengkap</span>
                <input required maxLength={100} value={form.fullName} onChange={set('fullName')} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">NIK (KTP)</span>
                <input required maxLength={30} inputMode="numeric" value={form.nik} onChange={set('nik')} className={`${field} font-mono`} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Nomor HP</span>
                <input required maxLength={20} inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="0812…" className={field} />
              </label>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className={heading}>Penempatan</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Cabang</span>
                <select required value={form.outletId} onChange={set('outletId')} className={field}>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Jabatan</span>
                <select required value={form.positionId} onChange={set('positionId')} className={field}>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} · {p.department.name}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Tanggal masuk</span>
                <input required type="date" value={form.joinDate} onChange={set('joinDate')} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Peran di sistem</span>
                <select value={form.role} onChange={set('role')} className={field}>
                  {roles.map((r) => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className={heading}>Akun login</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Username</span>
                <input
                  required
                  value={form.username}
                  onChange={set('username')}
                  pattern="[A-Za-z0-9._\-]{3,30}"
                  title="3-30 karakter: huruf, angka, titik, garis bawah atau tanda hubung"
                  autoComplete="off"
                  className={`${field} lowercase`}
                />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Password awal</span>
                <input
                  required
                  type="text"
                  minLength={6}
                  maxLength={72}
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="off"
                  className={`${field} font-mono`}
                />
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Minimal 6 karakter. Berikan ke karyawan dan minta ia menggantinya setelah login pertama. Karyawan juga bisa
              login memakai NIK.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{error}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Simpan karyawan
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
