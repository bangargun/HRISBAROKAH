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

/** Karyawan sebagaimana dikirim GET /employees */
export interface EmployeeRecord {
  id: string;
  nik: string;
  fullName: string;
  phone: string;
  status: string;
  joinDate: string;
  outletId: string;
  positionId: string;
  user: { id: string; username: string; role: string; isActive: boolean };
  outlet: { id: string; name: string };
  position: { id: string; title: string; department: { name: string } };
}

// Sama dengan aturan backend: akun admin hanya bisa dibuat dan diubah Super Admin
const BASE_ROLES = ['EMPLOYEE', 'STORE_MANAGER', 'AREA_MANAGER'];
const ADMIN_ROLES = ['HR_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'];
const roleLabel = (r: string) => (r === 'EMPLOYEE' ? 'Kru (aplikasi HP)' : ROLE_LABEL[r] ?? r);
const STATUSES: [string, string][] = [
  ['PROBATION', 'Masa percobaan'],
  ['CONTRACT', 'Kontrak'],
  ['PERMANENT', 'Tetap'],
  ['DAILY_WORKER', 'Harian'],
  ['INTERN', 'Magang'],
];

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Form karyawan, langsung ke database. Tanpa `employee` = tambah karyawan baru (dengan akun login);
 * dengan `employee` = ubah data karyawan itu.
 */
export default function EmployeeDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee?: EmployeeRecord;
  onClose: () => void;
  onSaved: (fullName: string) => void;
}) {
  const session = getSessionUser();
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isEdit = !!employee;
  const roles = isSuperAdmin ? [...BASE_ROLES, ...ADMIN_ROLES] : BASE_ROLES;
  // Peran sendiri tidak bisa diubah (mencegah terkunci dari sistem)
  const roleLocked = isEdit && employee.user.id === session?.id;

  const [outlets, setOutlets] = useState<OutletOption[] | null>(null);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [form, setForm] = useState({
    fullName: employee?.fullName ?? '',
    nik: employee?.nik ?? '',
    phone: employee?.phone ?? '',
    outletId: employee?.outletId ?? '',
    positionId: employee?.positionId ?? '',
    role: employee?.user.role ?? 'EMPLOYEE',
    status: employee?.status ?? 'PROBATION',
    joinDate: employee ? employee.joinDate.slice(0, 10) : localToday(),
    username: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<OutletOption[]>('/outlets'), apiFetch<PositionOption[]>('/employees/positions')])
      .then(([o, p]) => {
        // Cabang lama yang sudah nonaktif tetap tampil agar data karyawan bisa disimpan tanpa dipindah
        if (employee && !o.some((x) => x.id === employee.outletId)) {
          o = [...o, { id: employee.outlet.id, name: `${employee.outlet.name} (nonaktif)` }];
        }
        setOutlets(o);
        setPositions(p);
        if (!employee) setForm((f) => ({ ...f, outletId: o[0]?.id ?? '', positionId: p[0]?.id ?? '' }));
      })
      .catch((e) => {
        setOutlets([]);
        setError((e as Error).message);
      });
  }, [employee]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (employee) {
        const { username, password, role, ...rest } = form;
        await apiFetch(`/employees/${employee.id}`, {
          method: 'PUT',
          body: JSON.stringify(roleLocked ? rest : { ...rest, role }),
        });
      } else {
        await apiFetch('/employees', { method: 'POST', body: JSON.stringify(form) });
      }
      onSaved(form.fullName.trim());
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const field = 'input';
  const heading = 'text-sm font-semibold text-slate-900';

  return (
    <Dialog wide title={isEdit ? `Ubah data ${employee.fullName}` : 'Tambah karyawan'} onClose={onClose}>
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
                : 'Belum ada jabatan. Tambahkan dulu di Master Data → Departemen & Jabatan.')}
          </p>
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button type="button" onClick={onClose} className="btn btn-secondary px-4">
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
                <span className="font-medium text-slate-700">Status kerja</span>
                <select value={form.status} onChange={set('status')} className={field}>
                  {STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Peran di sistem</span>
                <select value={form.role} onChange={set('role')} disabled={roleLocked} className={field}>
                  {roles.map((r) => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
              </label>
            </div>
            {isEdit && employee.user.role === 'STORE_MANAGER' && (
              <p className="text-xs text-slate-500">
                Jika kepala cabang dipindah cabang atau perannya diganti, posisinya sebagai kepala cabang otomatis dilepas.
              </p>
            )}
          </div>

          {!isEdit && (
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
          )}

          {isEdit && !roleLocked && <ResetPassword employeeId={employee.id} name={employee.fullName} />}

          {error && (
            <p role="alert" className="alert-error">{error}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={onClose} className="btn btn-ghost px-4">
              Batal
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary px-4">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {isEdit ? 'Simpan perubahan' : 'Simpan karyawan'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/** HR membuat password sementara untuk karyawan yang lupa; sesi lama karyawan itu otomatis keluar. */
function ResetPassword({ employeeId, name }: { employeeId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function reset() {
    if (password.length < 6) {
      setNotice({ ok: false, text: 'Password sementara minimal 6 karakter' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await apiFetch(`/employees/${employeeId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: password }) });
      setNotice({ ok: true, text: `Password ${name} di-reset. Berikan password sementara ini dan minta ia menggantinya setelah masuk.` });
      setOpen(false);
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-slate-100 pt-4">
      <p className="text-sm font-semibold text-slate-900">Akun login</p>
      {open ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            autoComplete="off"
            minLength={6}
            maxLength={72}
            aria-label="Password sementara"
            placeholder="Password sementara"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input w-auto min-w-0 flex-1 font-mono"
          />
          <button type="button" disabled={busy} onClick={reset} className="btn btn-danger">
            {busy ? 'Menyimpan…' : 'Reset password'}
          </button>
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="btn btn-ghost">
            Batal
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => { setOpen(true); setNotice(null); }} className="link">
          Reset password karyawan ini…
        </button>
      )}
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className={`rounded-md border px-3 py-2 ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {notice.text}
        </p>
      )}
    </div>
  );
}
