'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, FileSpreadsheet, FileText, Loader2, Pencil, Printer, Search, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';
import EmployeeDialog, { EmployeeRecord } from '@/components/EmployeeDialog';
import ImportEmployeesDialog from '@/components/ImportEmployeesDialog';
import EmployeeDocumentsDialog from '@/components/EmployeeDocumentsDialog';
import { ROLE_LABEL } from '@/lib/navigation';
import { downloadWorkbook, newWorkbook, styleHeader } from '@/lib/excel';

const STATUS_LABEL: Record<string, string> = {
  PROBATION: 'Masa percobaan',
  PERMANENT: 'Tetap',
  CONTRACT: 'Kontrak',
  DAILY_WORKER: 'Harian',
  INTERN: 'Magang',
};
const ADMIN_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN'];

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const roleLabel = (r: string) => (r === 'EMPLOYEE' ? 'Kru' : ROLE_LABEL[r] ?? r);

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
  const [importing, setImporting] = useState(false);
  const [docsFor, setDocsFor] = useState<EmployeeRecord | null>(null);
  const [exporting, setExporting] = useState(false);

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

  const btn = 'btn btn-sm btn-secondary';

  // Ekspor mengikuti filter yang sedang tampil (status, cabang, pencarian)
  const exportTitle = `Data karyawan ${view === 'active' ? 'aktif' : 'nonaktif'}${outletFilter !== 'ALL' ? ` · ${outletFilter}` : ''}`;
  const exportRows = () =>
    visible.map((e) => [
      e.fullName,
      e.nik,
      e.user.username,
      e.phone,
      e.outlet.name,
      e.position.title,
      e.position.department.name,
      roleLabel(e.user.role),
      STATUS_LABEL[e.status] ?? e.status,
      e.joinDate.slice(0, 10),
      tenure(e.joinDate),
    ]);
  const EXPORT_HEADERS = ['Nama', 'NIK', 'Username', 'No HP', 'Cabang', 'Jabatan', 'Departemen', 'Peran', 'Status kerja', 'Tanggal masuk', 'Masa kerja'];

  async function exportExcel() {
    setExporting(true);
    try {
      const wb = await newWorkbook();
      const ws = wb.addWorksheet('Karyawan');
      ws.addRow(EXPORT_HEADERS);
      styleHeader(ws, [28, 20, 16, 16, 24, 20, 20, 16, 16, 14, 18]);
      exportRows().forEach((r) => ws.addRow(r));
      ws.autoFilter = { from: 'A1', to: { row: 1, column: EXPORT_HEADERS.length } };
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await downloadWorkbook(wb, `karyawan-${today}.xlsx`);
    } catch (e) {
      showToast(`Gagal membuat Excel: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  // PDF lewat dialog cetak browser (pilih "Simpan sebagai PDF")
  function printPdf() {
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    const rows = exportRows()
      .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`)
      .join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(exportTitle)}</title>
<style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#15181e}
h1{font-size:14px;margin:0 0 2px}p{margin:0 0 10px;color:#5a6779}table{width:100%;border-collapse:collapse}
th,td{border:1px solid #cfd6de;padding:4px 5px;text-align:left;vertical-align:top}th{background:#e8ebef}</style></head><body>
<h1>${escapeHtml(exportTitle)}</h1><p>Barokah Grup · dicetak ${new Date().toLocaleString('id-ID')} · ${visible.length} karyawan</p>
<table><thead><tr>${EXPORT_HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="segmented" role="group" aria-label="Status akun">
            {(['active', 'inactive'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => {
                  setView(v);
                  setOutletFilter('ALL');
                }}
                className="segmented-item"
              >
                {v === 'active' ? 'Aktif' : `Nonaktif${inactiveCount ? ` (${inactiveCount})` : ''}`}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <label className="sr-only" htmlFor="emp-search">Cari karyawan</label>
            <input
              id="emp-search"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari nama, NIK, jabatan, username"
              className="input pl-9 sm:w-64"
            />
          </div>
          <label className="sr-only" htmlFor="emp-outlet">Cabang</label>
          <select
            id="emp-outlet"
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="ALL">Semua cabang</option>
            {outletOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {employees && (
            <p className="mr-1 text-slate-600">
              {visible.length === inView.length ? `${inView.length} karyawan` : `${visible.length} dari ${inView.length} karyawan`}
            </p>
          )}
          {canEdit && (
            <button type="button" onClick={() => setImporting(true)} className={btn}>
              <Upload className="h-4 w-4" aria-hidden /> Impor Excel
            </button>
          )}
          <button type="button" onClick={exportExcel} disabled={!visible.length || exporting} className={btn}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />} Unduh Excel
          </button>
          <button type="button" onClick={printPdf} disabled={!visible.length} className={btn}>
            <Printer className="h-4 w-4" aria-hidden /> Cetak PDF
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
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
                <tr className="table-head">
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
                          {editable && (
                            <button type="button" onClick={() => setDocsFor(emp)} className={btn}>
                              <FileText className="h-4 w-4" aria-hidden /> Dokumen
                            </button>
                          )}
                          {editable && !isSelf(emp) && (
                            <button
                              type="button"
                              onClick={() => {
                                setActionError(null);
                                setConfirming(emp);
                              }}
                              className={view === 'active' ? 'btn btn-sm btn-danger-outline' : btn}
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

      {importing && (
        <ImportEmployeesDialog
          onClose={() => setImporting(false)}
          onImported={(count) => {
            showToast(`${count} karyawan berhasil diimpor.`);
            load();
            onChanged();
          }}
        />
      )}

      {docsFor && <EmployeeDocumentsDialog employee={docsFor} onClose={() => setDocsFor(null)} />}

      {editing && (
        <EmployeeDialog
          employee={editing}
          // Dimuat ulang saat ditutup supaya status PIN absen yang baru diatur ikut terbaca
          onClose={() => {
            setEditing(null);
            load();
          }}
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
            <p role="alert" className="alert-error">{actionError}</p>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" disabled={busy} onClick={() => setConfirming(null)} className="btn btn-ghost px-4">
              Batal
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setActive(confirming, !confirming.user.isActive)}
              className={`btn px-4 ${confirming.user.isActive ? 'btn-danger' : 'btn-primary'}`}
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
