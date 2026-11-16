'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Loader2, Pencil, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';
import EmployeeDialog, { EmployeeRecord } from '@/components/EmployeeDialog';

const STATUS_LABEL: Record<string, string> = {
  PROBATION: 'Masa percobaan',
  PERMANENT: 'Tetap',
  CONTRACT: 'Kontrak',
  DAILY_WORKER: 'Harian',
  INTERN: 'Magang',
};
const ADMIN_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN'];

function tenure(joinDate: string) {
  const start = new Date(joinDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getUTCFullYear()) * 12 + (now.getMonth() - start.getUTCMonth());
  if (now.getDate() < start.getUTCDate()) months -= 1;
  if (months < 1) return 'Kurang dari 1 bulan';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years} tahun` : '', rest ? `${rest} bulan` : ''].filter(Boolean).join(' ');
}

/** Daftar karyawan dari database: cari, saring cabang, ubah data, aktif/nonaktifkan akun. */
export default function EmployeeListModule({
  reloadKey,
  onChanged,
  onOpenReport,
  showToast,
}: {
  /** Naik setiap kali karyawan baru ditambahkan dari luar modul ini */
  reloadKey: number;
  onChanged: () => void;
  onOpenReport: (nik: string) => void;
  showToast: (msg: string) => void;
}) {
  const session = getSessionUser();
  const canEdit = session?.role === 'SUPER_ADMIN' || session?.role === 'HR_ADMIN';

  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<'active' | 'inactive'>('active');
  const [keyword, setKeyword] = useState('');
  const [outletFilter, setOutletFilter] = useState('ALL');
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [confirming, setConfirming] = useState<EmployeeRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<EmployeeRecord[]>('/employees')
      .then((data) => {
        setEmployees(data);
        setLoadError(null);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  useEffect(load, [load, reloadKey]);

  const inView = useMemo(
    () => (employees ?? []).filter((e) => (view === 'active' ? e.user.isActive : !e.user.isActive)),
    [employees, view],
  );
  const outletOptions = useMemo(
    () => Array.from(new Set(inView.map((e) => e.outlet.name))).sort(),
    [inView],
  );
  const q = keyword.trim().toLowerCase();
  const visible = inView.filter((e) => {
    if (outletFilter !== 'ALL' && e.outlet.name !== outletFilter) return false;
    return !q || [e.fullName, e.nik, e.position.title, e.user.username].some((v) => v.toLowerCase().includes(q));
  });
  const inactiveCount = (employees ?? []).filter((e) => !e.user.isActive).length;

  const isSelf = (e: EmployeeRecord) => e.user.id === session?.id;
  const lockedAdmin = (e: EmployeeRecord) => session?.role !== 'SUPER_ADMIN' && ADMIN_ROLES.includes(e.user.role);

  async function setActive(emp: EmployeeRecord, isActive: boolean) {
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/employees/${emp.id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      setConfirming(null);
      showToast(`${emp.fullName} ${isActive ? 'diaktifkan kembali' : 'dinonaktifkan'}.`);
      load();
      onChanged();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btn = 'inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50';

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label="Status akun">
            {(['active', 'inactive'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => {
                  setView(v);
                  setOutletFilter('ALL');
                }}
                className={`rounded px-3 py-1.5 font-medium ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {v === 'active' ? 'Aktif' : `Nonaktif${inactiveCount ? ` (${inactiveCount})` : ''}`}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <label className="sr-only" htmlFor="emp-search">Cari karyawan</label>
            <input
              id="emp-search"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari nama, NIK, jabatan, username"
              className="w-72 rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-800 placeholder-slate-400 focus:border-amber-500"
            />
          </div>
          <label className="sr-only" htmlFor="emp-outlet">Cabang</label>
          <select
            id="emp-outlet"
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800"
          >
            <option value="ALL">Semua cabang</option>
            {outletOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        {employees && (
          <p className="text-slate-600">
            {visible.length === inView.length ? `${inView.length} karyawan` : `${visible.length} dari ${inView.length} karyawan`}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loadError ? (
          <p role="alert" className="p-10 text-center text-rose-700">Gagal memuat karyawan: {loadError}</p>
        ) : employees === null ? (
          <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat karyawan…
          </p>
        ) : inView.length === 0 ? (
          <div className="p-10 text-center text-slate-600">
            {view === 'active' ? (
              <>
                <p className="font-medium text-slate-800">Belum ada karyawan aktif.</p>
                <p className="mt-1">Gunakan tombol &quot;Tambah Karyawan&quot; di kanan atas untuk mendaftarkan karyawan pertama.</p>
              </>
            ) : (
              <p>Tidak ada karyawan nonaktif.</p>
            )}
          </div>
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Tidak ada karyawan yang cocok dengan pencarian ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-600">
                  <th scope="col" className="px-4 py-3">Karyawan</th>
                  <th scope="col" className="px-4 py-3">Cabang &amp; jabatan</th>
                  <th scope="col" className="px-4 py-3">Status kerja</th>
                  <th scope="col" className="px-4 py-3">Masa kerja</th>
                  <th scope="col" className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((emp) => {
                  const editable = canEdit && !lockedAdmin(emp);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{emp.fullName}</p>
                        <p className="font-mono text-xs text-slate-500">NIK {emp.nik} · {emp.user.username}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{emp.position.title}</p>
                        <p className="text-xs text-slate-500">{emp.outlet.name}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{STATUS_LABEL[emp.status] ?? emp.status}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {tenure(emp.joinDate)}
                        <p className="text-xs text-slate-500">sejak {emp.joinDate.slice(0, 10)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {view === 'active' && (
                            <button type="button" onClick={() => onOpenReport(emp.nik)} className={btn}>
                              <Award className="h-4 w-4" aria-hidden /> Rapor
                            </button>
                          )}
                          {editable && view === 'active' && (
                            <button type="button" onClick={() => setEditing(emp)} className={btn}>
                              <Pencil className="h-4 w-4" aria-hidden /> Ubah
                            </button>
                          )}
                          {editable && !isSelf(emp) && (
                            <button
                              type="button"
                              onClick={() => {
                                setActionError(null);
                                setConfirming(emp);
                              }}
                              className={view === 'active' ? `${btn} text-rose-700 hover:bg-rose-50` : btn}
                            >
                              {view === 'active' ? 'Nonaktifkan' : 'Aktifkan lagi'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <EmployeeDialog
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            showToast(`Data ${name} tersimpan.`);
            load();
            onChanged();
          }}
        />
      )}

      {confirming && (
        <Dialog
          title={confirming.user.isActive ? `Nonaktifkan ${confirming.fullName}?` : `Aktifkan lagi ${confirming.fullName}?`}
          onClose={() => !busy && setConfirming(null)}
        >
          <p className="text-slate-700">
            {confirming.user.isActive
              ? 'Akunnya tidak bisa login lagi dan tidak ikut dihitung gaji periode berikutnya. Riwayat presensi dan gajinya tetap tersimpan. Anda bisa mengaktifkannya lagi kapan saja.'
              : 'Akunnya bisa login lagi dengan username dan password yang lama, dan ikut dihitung gaji lagi.'}
          </p>
          {actionError && (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{actionError}</p>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" disabled={busy} onClick={() => setConfirming(null)} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
              Batal
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setActive(confirming, !confirming.user.isActive)}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 font-medium text-white disabled:opacity-50 ${
                confirming.user.isActive ? 'bg-rose-700 hover:bg-rose-800' : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {confirming.user.isActive ? 'Nonaktifkan' : 'Aktifkan lagi'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
