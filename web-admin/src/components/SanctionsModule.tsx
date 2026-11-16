'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Printer, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';
import type { EmployeeRecord } from '@/components/EmployeeDialog';

type SanctionType = 'TEGURAN_LISAN' | 'SP_1' | 'SP_2' | 'SP_3' | 'SUSPENSION';

interface Sanction {
  id: string;
  type: SanctionType;
  letterNumber: string;
  incidentDate: string;
  category: string | null;
  violationDesc: string;
  actionTaken: string | null;
  witness: string | null;
  validUntil: string;
  createdAt: string;
  employee: { id: string; fullName: string; nik: string; outlet: { name: string }; position: { title: string } };
  issuedBy: { username: string; profile: { fullName: string } | null };
}

const TYPE_LABEL: Record<SanctionType, string> = {
  TEGURAN_LISAN: 'Teguran lisan',
  SP_1: 'SP 1',
  SP_2: 'SP 2',
  SP_3: 'SP 3 (terakhir)',
  SUSPENSION: 'Skorsing',
};
const TYPE_TITLE: Record<SanctionType, string> = {
  TEGURAN_LISAN: 'Catatan Teguran Lisan',
  SP_1: 'Surat Peringatan Pertama (SP 1)',
  SP_2: 'Surat Peringatan Kedua (SP 2)',
  SP_3: 'Surat Peringatan Ketiga (SP 3)',
  SUSPENSION: 'Surat Keputusan Skorsing',
};
const ORDER: SanctionType[] = ['TEGURAN_LISAN', 'SP_1', 'SP_2', 'SP_3', 'SUSPENSION'];
const CATEGORIES = [
  'Kedisiplinan & Presensi',
  'Hygiene, Grooming & Kebersihan',
  'SOP Resep & Food Waste',
  'Pelayanan & Kasir/POS',
  'Integritas & Keamanan Resto',
  'Pembangkangan Instruksi Kerja',
];

function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addMonths(ymd: string, months: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1 + months, d);
  return localYmd(date);
}
const isActive = (s: Sanction) => s.validUntil.slice(0, 10) >= localYmd();
const issuer = (s: Sanction) => s.issuedBy.profile?.fullName ?? s.issuedBy.username;
const fmtDate = (ymd: string) =>
  new Date(`${ymd.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

/** Surat peringatan dan teguran, tersimpan di database dengan nomor surat otomatis. */
export default function SanctionsModule({ showToast }: { showToast: (msg: string) => void }) {
  const role = getSessionUser()?.role;
  const canIssue = role === 'SUPER_ADMIN' || role === 'HR_ADMIN';

  const [rows, setRows] = useState<Sanction[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<'active' | 'all'>('active');
  const [keyword, setKeyword] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [viewing, setViewing] = useState<Sanction | null>(null);
  const [cancelling, setCancelling] = useState<Sanction | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<Sanction[]>('/sanctions')
      .then((d) => {
        setRows(d);
        setLoadError(null);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  useEffect(load, [load]);

  const inView = useMemo(() => (rows ?? []).filter((s) => view === 'all' || isActive(s)), [rows, view]);
  const q = keyword.trim().toLowerCase();
  const visible = inView.filter(
    (s) => !q || [s.employee.fullName, s.employee.nik, s.letterNumber, s.employee.outlet.name].some((v) => v.toLowerCase().includes(q)),
  );

  async function cancel(s: Sanction) {
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/sanctions/${s.id}`, { method: 'DELETE' });
      setCancelling(null);
      showToast(`Surat ${s.letterNumber} dibatalkan.`);
      load();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label="Masa berlaku">
            {(['active', 'all'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded px-3 py-1.5 font-medium ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {v === 'active' ? 'Masih berlaku' : 'Semua'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <label className="sr-only" htmlFor="sp-search">Cari surat</label>
            <input
              id="sp-search"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari nama, NIK, nomor surat, cabang"
              className="w-72 rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-800 placeholder-slate-400 focus:border-amber-500"
            />
          </div>
        </div>
        {canIssue && (
          <button
            type="button"
            onClick={() => setIssuing(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" aria-hidden /> Terbitkan SP
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loadError ? (
          <p role="alert" className="p-10 text-center text-rose-700">Gagal memuat surat: {loadError}</p>
        ) : rows === null ? (
          <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
          </p>
        ) : inView.length === 0 ? (
          <p className="p-10 text-center text-slate-600">
            {view === 'active' ? 'Tidak ada SP atau teguran yang masih berlaku.' : 'Belum ada SP atau teguran yang diterbitkan.'}
          </p>
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Tidak ada surat yang cocok dengan pencarian ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-600">
                  <th scope="col" className="px-4 py-3">Surat</th>
                  <th scope="col" className="px-4 py-3">Karyawan</th>
                  <th scope="col" className="px-4 py-3">Pelanggaran</th>
                  <th scope="col" className="px-4 py-3">Berlaku sampai</th>
                  <th scope="col" className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((s) => (
                  <tr key={s.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{TYPE_LABEL[s.type]}</p>
                      <p className="font-mono text-xs text-slate-500">{s.letterNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{s.employee.fullName}</p>
                      <p className="text-xs text-slate-500">{s.employee.position.title} · {s.employee.outlet.name}</p>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-slate-700">
                      {s.category && <p className="text-xs font-medium text-slate-500">{s.category}</p>}
                      <p className="line-clamp-2">{s.violationDesc}</p>
                      <p className="mt-1 text-xs text-slate-500">Kejadian {s.incidentDate.slice(0, 10)}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="text-slate-800">{s.validUntil.slice(0, 10)}</p>
                      <p className={`text-xs ${isActive(s) ? 'font-medium text-rose-700' : 'text-slate-500'}`}>
                        {isActive(s) ? 'Masih berlaku' : 'Sudah berakhir'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewing(s)}
                          className="rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Lihat surat
                        </button>
                        {canIssue && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionError(null);
                              setCancelling(s);
                            }}
                            className="rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Batalkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {issuing && (
        <IssueDialog
          existing={rows ?? []}
          onClose={() => setIssuing(false)}
          onSaved={(s) => {
            setIssuing(false);
            showToast(`${TYPE_LABEL[s.type]} untuk ${s.employee.fullName} diterbitkan (${s.letterNumber}).`);
            load();
            setViewing(s);
          }}
        />
      )}

      {viewing && <LetterDialog sanction={viewing} onClose={() => setViewing(null)} />}

      {cancelling && (
        <Dialog title={`Batalkan ${cancelling.letterNumber}?`} onClose={() => !busy && setCancelling(null)}>
          <p className="text-slate-700">
            Surat untuk {cancelling.employee.fullName} dihapus permanen. Gunakan hanya untuk surat yang salah terbit.
          </p>
          {actionError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{actionError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" disabled={busy} onClick={() => setCancelling(null)} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
              Kembali
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => cancel(cancelling)}
              className="inline-flex items-center gap-1.5 rounded-md bg-rose-700 px-4 py-2 font-medium text-white hover:bg-rose-800 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Batalkan surat
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function IssueDialog({
  existing,
  onClose,
  onSaved,
}: {
  existing: Sanction[];
  onClose: () => void;
  onSaved: (s: Sanction) => void;
}) {
  const today = localYmd();
  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(null);
  const [form, setForm] = useState({
    employeeId: '',
    type: 'SP_1' as SanctionType,
    category: CATEGORIES[0],
    incidentDate: today,
    violationDesc: '',
    actionTaken: '',
    witness: '',
    validUntil: addMonths(today, 6),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<EmployeeRecord[]>('/employees')
      .then((d) => {
        const active = d.filter((e) => e.user.isActive);
        setEmployees(active);
        setForm((f) => ({ ...f, employeeId: active[0]?.id ?? '' }));
      })
      .catch((e) => {
        setEmployees([]);
        setError((e as Error).message);
      });
  }, []);

  // SP yang masih berlaku untuk karyawan terpilih, sebagai dasar memilih tingkat berikutnya
  const activeForEmployee = existing.filter((s) => s.employee.id === form.employeeId && isActive(s));
  const highest = activeForEmployee.reduce<SanctionType | null>(
    (acc, s) => (acc === null || ORDER.indexOf(s.type) > ORDER.indexOf(acc) ? s.type : acc),
    null,
  );
  const suggested = highest === null ? null : ORDER[Math.min(ORDER.indexOf(highest) + 1, ORDER.indexOf('SP_3'))];

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await apiFetch<Sanction>('/sanctions', { method: 'POST', body: JSON.stringify(form) }));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-amber-500';

  return (
    <Dialog wide title="Terbitkan surat peringatan" onClose={onClose}>
      {employees === null ? (
        <p className="flex items-center gap-2 py-6 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat karyawan…
        </p>
      ) : employees.length === 0 ? (
        <p className="text-slate-700">{error ?? 'Belum ada karyawan aktif.'}</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Karyawan</span>
              <select required value={form.employeeId} onChange={set('employeeId')} className={field}>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName} · {e.outlet.name}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Jenis</span>
              <select value={form.type} onChange={set('type')} className={field}>
                {ORDER.map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>
            </label>
          </div>
          {activeForEmployee.length > 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              Masih berlaku: {activeForEmployee.map((s) => `${TYPE_LABEL[s.type]} (s.d. ${s.validUntil.slice(0, 10)})`).join(', ')}.
              {suggested && suggested !== form.type && ` Tingkat berikutnya biasanya ${TYPE_LABEL[suggested]}.`}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Kategori pelanggaran</span>
              <select value={form.category} onChange={set('category')} className={field}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Tanggal kejadian</span>
              <input required type="date" max={today} value={form.incidentDate} onChange={set('incidentDate')} className={field} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Uraian pelanggaran</span>
            <textarea required maxLength={2000} rows={3} value={form.violationDesc} onChange={set('violationDesc')} className={field} />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Tindakan / pembinaan</span>
            <textarea maxLength={1000} rows={2} value={form.actionTaken} onChange={set('actionTaken')} className={field} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Saksi</span>
              <input maxLength={100} value={form.witness} onChange={set('witness')} className={field} />
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Berlaku sampai</span>
              <input
                required
                type="date"
                min={addMonths(today, 0)}
                max={addMonths(today, 6)}
                value={form.validUntil}
                onChange={set('validUntil')}
                className={field}
              />
              <span className="block text-xs text-slate-500">Paling lama 6 bulan sejak hari ini.</span>
            </label>
          </div>
          {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{error}</p>}
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
              Terbitkan
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function LetterDialog({ sanction: s, onClose }: { sanction: Sanction; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Nama', s.employee.fullName],
    ['NIK', s.employee.nik],
    ['Jabatan', s.employee.position.title],
    ['Cabang', s.employee.outlet.name],
  ];
  const body = (
    <>
      <p>Diberikan kepada:</p>
      <table className="my-2">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="w-28 py-0.5 pr-3 align-top">{k}</td>
              <td className="py-0.5">: {v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Pada {fmtDate(s.incidentDate)} yang bersangkutan melakukan pelanggaran
        {s.category ? ` kategori ${s.category}` : ''}:
      </p>
      <p className="my-2 whitespace-pre-line">{s.violationDesc}</p>
      {s.actionTaken && (
        <>
          <p>Tindakan / pembinaan:</p>
          <p className="my-2 whitespace-pre-line">{s.actionTaken}</p>
        </>
      )}
      <p>
        Surat ini berlaku sampai {fmtDate(s.validUntil)}. Pelanggaran serupa selama masa berlaku dapat dikenai sanksi tingkat
        berikutnya.
      </p>
    </>
  );

  function print() {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    const table = rows.map(([k, v]) => `<tr><td style="width:7rem">${k}</td><td>: ${escapeHtml(v)}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(s.letterNumber)}</title>
<style>body{font-family:Georgia,serif;font-size:14px;line-height:1.6;margin:48px;color:#111}h1{font-size:18px;text-align:center;margin:0}
.no{text-align:center;margin:4px 0 24px}td{padding:2px 8px 2px 0;vertical-align:top}.pre{white-space:pre-line}.sign{margin-top:48px;display:flex;justify-content:space-between}</style>
</head><body><h1>${escapeHtml(TYPE_TITLE[s.type])}</h1><p class="no">Nomor: ${escapeHtml(s.letterNumber)}</p>
<p>Diberikan kepada:</p><table>${table}</table>
<p>Pada ${fmtDate(s.incidentDate)} yang bersangkutan melakukan pelanggaran${s.category ? ` kategori ${escapeHtml(s.category)}` : ''}:</p>
<p class="pre">${escapeHtml(s.violationDesc)}</p>
${s.actionTaken ? `<p>Tindakan / pembinaan:</p><p class="pre">${escapeHtml(s.actionTaken)}</p>` : ''}
<p>Surat ini berlaku sampai ${fmtDate(s.validUntil)}. Pelanggaran serupa selama masa berlaku dapat dikenai sanksi tingkat berikutnya.</p>
<p>Diterbitkan ${fmtDate(s.createdAt)}.</p>
<div class="sign"><div>Yang menerima,<br><br><br><br>${escapeHtml(s.employee.fullName)}</div>
${s.witness ? `<div>Saksi,<br><br><br><br>${escapeHtml(s.witness)}</div>` : ''}
<div>Yang menerbitkan,<br><br><br><br>${escapeHtml(issuer(s))}</div></div>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <Dialog wide title={TYPE_TITLE[s.type]} onClose={onClose}>
      <p className="font-mono text-xs text-slate-500">Nomor: {s.letterNumber}</p>
      <div className="space-y-1 rounded-md border border-slate-200 p-4 text-slate-800">
        {body}
        <p className="pt-2 text-xs text-slate-500">
          Diterbitkan {fmtDate(s.createdAt)} oleh {issuer(s)}
          {s.witness ? ` · saksi ${s.witness}` : ''}
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
          Tutup
        </button>
        <button
          type="button"
          onClick={print}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
        >
          <Printer className="h-4 w-4" aria-hidden /> Cetak
        </button>
      </div>
    </Dialog>
  );
}
