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
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  hasAttendancePin?: boolean;
  user: { id: string; username: string; email: string | null; role: string; isActive: boolean };
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
  // Sama dengan @Roles PUT /employees/:id/attendance-pin di backend
  const canSetPin = session?.role === 'SUPER_ADMIN' || session?.role === 'HR_ADMIN';
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
    birthDate: employee?.birthDate?.slice(0, 10) ?? '',
    gender: employee?.gender ?? '',
    address: employee?.address ?? '',
    email: employee?.user.email ?? '',
    bankName: employee?.bankName ?? '',
    bankAccountNumber: employee?.bankAccountNumber ?? '',
    bankAccountHolder: employee?.bankAccountHolder ?? '',
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

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
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
            <p className={heading}>Data pribadi</p>
            <p className="text-xs text-slate-500">Boleh dikosongkan; kru bisa melengkapinya sendiri dari aplikasi HP.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Tanggal lahir</span>
                <input type="date" value={form.birthDate} onChange={set('birthDate')} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Jenis kelamin</span>
                <select value={form.gender} onChange={set('gender')} className={field}>
                  <option value="">Belum diisi</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="font-medium text-slate-700">Alamat</span>
                <textarea rows={2} maxLength={300} value={form.address} onChange={set('address')} className={field} />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="font-medium text-slate-700">Email</span>
                <input type="email" value={form.email} onChange={set('email')} autoComplete="off" className={field} />
              </label>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className={heading}>Rekening gaji</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Nama bank</span>
                <input maxLength={60} value={form.bankName} onChange={set('bankName')} placeholder="BCA, BRI, Mandiri…" className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Nomor rekening</span>
                <input inputMode="numeric" pattern="[0-9]{5,30}" title="5-30 digit angka" value={form.bankAccountNumber} onChange={set('bankAccountNumber')} className={`${field} font-mono`} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Nama pemilik</span>
                <input maxLength={100} value={form.bankAccountHolder} onChange={set('bankAccountHolder')} className={field} />
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

          {isEdit && canSetPin && <AttendancePin employeeId={employee.id} name={employee.fullName} initiallySet={!!employee.hasAttendancePin} />}

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

/** PIN 6 digit untuk absen di tablet bila wajah belum terdaftar atau gagal dikenali. */
function AttendancePin({ employeeId, name, initiallySet }: { employeeId: string; name: string; initiallySet: boolean }) {
  const [isSet, setIsSet] = useState(initiallySet);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    if (!/^\d{6}$/.test(pin)) {
      setNotice({ ok: false, text: 'PIN harus 6 digit angka' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await apiFetch(`/employees/${employeeId}/attendance-pin`, { method: 'PUT', body: JSON.stringify({ pin }) });
      setIsSet(true);
      setOpen(false);
      setPin('');
      setNotice({ ok: true, text: `PIN absen ${name} disimpan. Sampaikan PIN ini langsung ke yang bersangkutan.` });
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-slate-100 pt-4">
      <p className="text-sm font-semibold text-slate-900">PIN absen</p>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-slate-700">PIN absen: {isSet ? 'sudah diatur' : 'belum diatur'}</p>
        {!open && (
          <button type="button" onClick={() => { setOpen(true); setNotice(null); }} className="btn btn-secondary btn-sm">
            Atur PIN
          </button>
        )}
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            aria-label="PIN absen 6 digit"
            placeholder="6 digit"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              // Enter di sini tidak boleh ikut menyimpan form karyawan
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              }
            }}
            className="input w-auto min-w-0 flex-1 font-mono tracking-widest"
          />
          <button type="button" disabled={busy || pin.length !== 6} onClick={save} className="btn btn-primary">
            {busy ? 'Menyimpan…' : 'Simpan PIN'}
          </button>
          <button type="button" disabled={busy} onClick={() => { setOpen(false); setPin(''); }} className="btn btn-ghost">
            Batal
          </button>
        </div>
      )}
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className={notice.ok ? 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800' : 'alert-error'}>
          {notice.text}
        </p>
      )}
    </div>
  );
}
