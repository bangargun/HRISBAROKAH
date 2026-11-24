'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/navigation';

type Role = 'SUPER_ADMIN' | 'AREA_MANAGER' | 'STORE_MANAGER' | 'HR_ADMIN' | 'FINANCE_ADMIN' | 'EMPLOYEE';
type Rule = { kind: 'TABLET' } | { kind: 'PUBLIC' } | { kind: 'LOGGED_IN' } | { kind: 'ROLES'; roles: Role[] };
interface Action { method: string; path: string; write: boolean; rule: Rule }
interface Matrix { roles: Role[]; modules: { key: string; actions: Action[] }[] }
interface RoleHolders { role: Role; users: { id: string; username: string; fullName: string | null; outletName: string | null; positionTitle: string | null }[] }

/** Kolom matriks: lima peran admin, kru (aplikasi HP) dan tablet cabang. */
const COLUMNS: { key: Role | 'TABLET'; label: string }[] = [
  { key: 'SUPER_ADMIN', label: 'Super Admin' },
  { key: 'HR_ADMIN', label: 'HR' },
  { key: 'FINANCE_ADMIN', label: 'Keuangan' },
  { key: 'AREA_MANAGER', label: 'Area Manager' },
  { key: 'STORE_MANAGER', label: 'Kepala Cabang' },
  { key: 'EMPLOYEE', label: 'Kru (HP)' },
  { key: 'TABLET', label: 'Tablet cabang' },
];

/** Nama fitur untuk tiap grup endpoint server. Grup baru tampil dengan path aslinya. */
const MODULE_LABEL: Record<string, string> = {
  access: 'Hak akses',
  attendance: 'Absen & presensi',
  coaching: 'Pendampingan',
  'attendance-corrections': 'Koreksi absen',
  'attendance-review': 'Tinjauan absen tablet',
  auth: 'Akun & login',
  'daily-reports': 'Laporan harian cabang',
  departments: 'Departemen & jabatan',
  'employee-exits': 'Karyawan keluar',
  employees: 'Data karyawan',
  'employees/:employeeId/documents': 'Dokumen karyawan',
  face: 'Wajah terdaftar',
  holidays: 'Hari libur',
  inspections: 'Sidak SPV',
  kiosk: 'Tablet absen',
  kpi: 'KPI kru',
  'legal-docs': 'Surat & kontrak',
  me: 'PIN absen (akun sendiri)',
  outlets: 'Cabang',
  'outlets/:id/devices': 'Perangkat tablet',
  payroll: 'Penggajian',
  'payroll/my': 'Slip gaji sendiri',
  requests: 'Pengajuan kru',
  sanctions: 'Surat peringatan',
  schedules: 'Jadwal shift',
  survey360: 'Survei 360°',
  training: 'Pelatihan (admin)',
  'training/my': 'Pelatihan saya (aplikasi HP)',
  'me/profile': 'Data diri & rekening (aplikasi HP)',
  'bank-changes': 'Persetujuan perubahan rekening',
  health: 'Cek kesehatan server (pemantauan)',
};

const METHOD_LABEL: Record<string, string> = { GET: 'Lihat', POST: 'Tambah/aksi', PUT: 'Ubah', PATCH: 'Ubah', DELETE: 'Hapus' };

function allows(rule: Rule, col: Role | 'TABLET'): boolean {
  if (rule.kind === 'TABLET') return col === 'TABLET';
  if (col === 'TABLET') return false;
  if (rule.kind === 'PUBLIC' || rule.kind === 'LOGGED_IN') return true;
  return rule.roles.includes(col);
}

/** Ringkasan per fitur. Aksi tanpa login (login, pasangkan tablet) tidak menandakan hak suatu peran. */
function cellText(actions: Action[], col: Role | 'TABLET'): string {
  const counted = actions.filter((a) => a.rule.kind !== 'PUBLIC');
  const read = counted.some((a) => !a.write && allows(a.rule, col));
  const write = counted.some((a) => a.write && allows(a.rule, col));
  if (read && write) return 'Lihat & ubah';
  if (read) return 'Lihat';
  if (write) return 'Ubah';
  return '–';
}

/** Hak akses yang benar-benar berlaku, dibaca dari aturan server. Tidak bisa diubah dari sini. */
export default function AccessRightsModule({ tab }: { tab: 'matrix-roles' | 'user-assignment' }) {
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [holders, setHolders] = useState<RoleHolders[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const load =
      tab === 'matrix-roles'
        ? apiFetch<Matrix>('/access/matrix').then(setMatrix)
        : apiFetch<RoleHolders[]>('/access/role-holders').then(setHolders);
    load.catch((e) => setError((e as Error).message));
  }, [tab]);

  const modules = useMemo(
    () =>
      (matrix?.modules ?? [])
        .map((m) => ({ ...m, label: MODULE_LABEL[m.key] ?? `/${m.key}` }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id')),
    [matrix],
  );

  if (error) return <p role="alert" className="alert-error">{error}</p>;

  if (tab === 'user-assignment') {
    if (!holders) return <Loading />;
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Akun aktif per peran. Peran diubah dari menu <span className="font-medium text-slate-900">Data Karyawan</span>, lalu Ubah.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {holders.map((h) => (
            <section key={h.role} className="card p-4" aria-labelledby={`role-${h.role}`}>
              <h3 id={`role-${h.role}`} className="flex items-baseline justify-between text-sm font-semibold text-slate-900">
                {ROLE_LABEL[h.role] ?? (h.role === 'EMPLOYEE' ? 'Kru' : h.role)}
                <span className="text-xs font-normal text-slate-500">{h.users.length} akun</span>
              </h3>
              {h.users.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Belum ada akun dengan peran ini.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {h.users.slice(0, 50).map((u) => (
                    <li key={u.id} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                      <span className="text-slate-900">{u.fullName ?? u.username}</span>
                      <span className="text-xs text-slate-500">
                        {[u.positionTitle, u.outletName].filter(Boolean).join(' · ') || u.username}
                      </span>
                    </li>
                  ))}
                  {h.users.length > 50 && (
                    <li className="py-1.5 text-xs text-slate-500">dan {h.users.length - 50} akun lain, lihat Data Karyawan.</li>
                  )}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    );
  }

  if (!matrix) return <Loading />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Hak akses yang berlaku saat ini, dibaca langsung dari aturan server. Tabel ini tidak bisa diubah dari sini;
        perubahan hak akses dilakukan lewat pembaruan aplikasi. Buka sebuah baris untuk melihat aksi satu per satu.
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="p-3 text-left">Fitur</th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="p-3 text-left">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {modules.map((m) => {
              const isOpen = open === m.key;
              return (
                <React.Fragment key={m.key}>
                  <tr className="align-top">
                    <th scope="row" className="p-3 text-left font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : m.key)}
                        aria-expanded={isOpen}
                        className="flex items-center gap-1.5 text-left hover:text-ink"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
                        {m.label}
                      </button>
                    </th>
                    {COLUMNS.map((c) => {
                      const text = cellText(m.actions, c.key);
                      return (
                        <td key={c.key} className={`p-3 ${text === '–' ? 'text-slate-400' : 'text-slate-800'}`}>{text}</td>
                      );
                    })}
                  </tr>
                  {isOpen &&
                    m.actions.map((a) => (
                      <tr key={`${a.method} ${a.path}`} className="bg-slate-50 text-xs">
                        <td className="py-1.5 pl-9 pr-3 text-slate-600">
                          {METHOD_LABEL[a.method] ?? a.method} <span className="font-mono text-slate-500">{a.path}</span>
                        </td>
                        {a.rule.kind === 'PUBLIC' ? (
                          <td colSpan={COLUMNS.length} className="px-3 py-1.5 text-slate-500">Terbuka tanpa login</td>
                        ) : (
                          COLUMNS.map((c) => (
                            <td key={c.key} className="px-3 py-1.5">
                              {allows(a.rule, c.key) ? <span className="text-emerald-700">Ya</span> : <span className="text-slate-400">–</span>}
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="card space-y-2 p-4 text-sm text-slate-700" aria-labelledby="access-notes">
        <h3 id="access-notes" className="font-semibold text-slate-900">Aturan tambahan yang tidak terlihat di tabel</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Kepala Cabang hanya melihat dan mengubah data cabangnya sendiri.</li>
          <li>Hanya Super Admin yang boleh mengubah, menonaktifkan, atau mereset password akun admin lain.</li>
          <li>Kru hanya melihat data miliknya sendiri: absen, slip gaji, pengajuan dan survei.</li>
          <li>Absen dari HP ditutup: absen masuk, istirahat dan pulang hanya lewat tablet cabang.</li>
          <li>Tablet cabang hanya bisa dipakai di cabang tempat ia dipasangkan, dan berhenti bekerja begitu dicabut.</li>
        </ul>
      </section>
    </div>
  );
}

function Loading() {
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
    </p>
  );
}
