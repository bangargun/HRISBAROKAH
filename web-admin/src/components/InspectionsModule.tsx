'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, Printer, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';

interface ChecklistItem {
  key: string;
  area: string;
  points: number;
  title: string;
  description: string;
}
interface Checklist {
  areas: Record<string, string>;
  items: ChecklistItem[];
}
type Who = { username: string; profile: { fullName: string } | null } | null;
interface Inspection {
  id: string;
  type: 'ROUTINE' | 'SURPRISE';
  scheduledDate: string;
  focusArea: string | null;
  status: 'SCHEDULED' | 'DONE' | 'CANCELLED';
  reportNumber: string | null;
  passedItems: string[];
  score: number | null;
  grade: string | null;
  findings: string | null;
  actionItems: string | null;
  branchManagerName: string | null;
  conductedAt: string | null;
  outlet: { id: string; name: string; code: string };
  createdBy: Who;
  conductedBy: Who;
}
interface OutletOption {
  id: string;
  name: string;
}

const TYPE_LABEL = { ROUTINE: 'Audit rutin', SURPRISE: 'Sidak mendadak' };
const GRADE_STYLE: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  B: 'bg-sky-50 text-sky-800 border-sky-200',
  C: 'bg-amber-50 text-amber-800 border-amber-200',
  D: 'bg-rose-50 text-rose-800 border-rose-200',
};
const who = (u: Who) => u?.profile?.fullName ?? u?.username ?? '-';
const fmtDate = (ymd: string) => new Date(`${ymd.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const field = 'input';
const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Sidak / audit supervisor ke cabang: jadwal, checklist 14 titik (100 poin), berita acara. */
export default function InspectionsModule({ showToast }: { showToast: (msg: string) => void }) {
  const role = getSessionUser()?.role;
  const isAuditor = role === 'SUPER_ADMIN' || role === 'HR_ADMIN' || role === 'AREA_MANAGER';

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [rows, setRows] = useState<Inspection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'SCHEDULED' | 'DONE'>(isAuditor ? 'SCHEDULED' : 'DONE');
  const [scheduling, setScheduling] = useState(false);
  const [conducting, setConducting] = useState<Inspection | null>(null);
  const [viewing, setViewing] = useState<Inspection | null>(null);

  const load = useCallback(() => {
    Promise.all([apiFetch<Checklist>('/inspections/checklist'), apiFetch<Inspection[]>('/inspections')])
      .then(([c, r]) => {
        setChecklist(c);
        setRows(r);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(
    () => (rows ?? []).filter((r) => (view === 'SCHEDULED' ? r.status === 'SCHEDULED' : r.status !== 'SCHEDULED')),
    [rows, view],
  );
  const scheduledCount = rows?.filter((r) => r.status === 'SCHEDULED').length ?? 0;

  async function cancel(r: Inspection) {
    try {
      await apiFetch(`/inspections/${r.id}/cancel`, { method: 'POST' });
      showToast(`Sidak ${r.outlet.name} dibatalkan.`);
      load();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="segmented" role="group" aria-label="Status sidak">
          {(['SCHEDULED', 'DONE'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className="segmented-item"
            >
              {v === 'SCHEDULED' ? `Terjadwal${scheduledCount ? ` (${scheduledCount})` : ''}` : 'Hasil sidak'}
            </button>
          ))}
        </div>
        {isAuditor && (
          <button
            type="button"
            onClick={() => setScheduling(true)}
            className="btn btn-primary shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden /> Jadwalkan sidak
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {error ? (
          <p role="alert" className="p-10 text-center text-rose-700">Gagal memuat sidak: {error}</p>
        ) : rows === null ? (
          <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
          </p>
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-slate-600">
            {view === 'SCHEDULED' ? 'Tidak ada sidak terjadwal.' : 'Belum ada hasil sidak.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="table-head">
                  <th scope="col" className="px-4 py-3">Tanggal</th>
                  <th scope="col" className="px-4 py-3">Cabang</th>
                  <th scope="col" className="px-4 py-3">Jenis & fokus</th>
                  <th scope="col" className="px-4 py-3">{view === 'SCHEDULED' ? 'Dijadwalkan oleh' : 'Hasil'}</th>
                  <th scope="col" className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-800">{fmtDate(r.scheduledDate)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.outlet.name}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{TYPE_LABEL[r.type]}</p>
                      {r.focusArea && <p className="text-xs text-slate-500">{r.focusArea}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'SCHEDULED' ? (
                        <span className="text-slate-700">{who(r.createdBy)}</span>
                      ) : r.status === 'CANCELLED' ? (
                        <span className="text-slate-500">Dibatalkan</span>
                      ) : (
                        <>
                          <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${GRADE_STYLE[r.grade ?? 'D']}`}>
                            {r.score} / 100 · {r.grade}
                          </span>
                          <p className="mt-1 text-xs text-slate-500">oleh {who(r.conductedBy)}</p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {r.status === 'SCHEDULED' && isAuditor && (
                          <>
                            <button type="button" onClick={() => cancel(r)} className="btn btn-sm btn-ghost text-rose-700 hover:bg-rose-50">
                              Batalkan
                            </button>
                            <button
                              type="button"
                              onClick={() => setConducting(r)}
                              className="btn btn-sm btn-dark"
                            >
                              Isi hasil sidak
                            </button>
                          </>
                        )}
                        {r.status === 'DONE' && (
                          <button
                            type="button"
                            onClick={() => setViewing(r)}
                            className="rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Berita acara
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

      {scheduling && (
        <ScheduleDialog
          onClose={() => setScheduling(false)}
          onSaved={(name) => {
            setScheduling(false);
            setView('SCHEDULED');
            showToast(`Sidak ${name} dijadwalkan.`);
            load();
          }}
        />
      )}
      {conducting && checklist && (
        <ConductDialog
          inspection={conducting}
          checklist={checklist}
          onClose={() => setConducting(null)}
          onSaved={(saved) => {
            setConducting(null);
            setView('DONE');
            showToast(`Hasil sidak ${saved.outlet.name} tersimpan (${saved.score}/100).`);
            load();
            setViewing(saved);
          }}
        />
      )}
      {viewing && checklist && <ReportDialog inspection={viewing} checklist={checklist} onClose={() => setViewing(null)} />}
    </div>
  );
}

function ScheduleDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (outletName: string) => void }) {
  const [outlets, setOutlets] = useState<OutletOption[] | null>(null);
  const [form, setForm] = useState({ outletId: '', type: 'ROUTINE', scheduledDate: localYmd(), focusArea: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<OutletOption[]>('/outlets')
      .then((o) => {
        setOutlets(o);
        setForm((f) => ({ ...f, outletId: o[0]?.id ?? '' }));
      })
      .catch((e) => {
        setOutlets([]);
        setError((e as Error).message);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/inspections', { method: 'POST', body: JSON.stringify(form) });
      onSaved(outlets?.find((o) => o.id === form.outletId)?.name ?? '');
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog title="Jadwalkan sidak" onClose={onClose}>
      {outlets === null ? (
        <p className="flex items-center gap-2 py-6 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat cabang…</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Cabang</span>
            <select required value={form.outletId} onChange={(e) => setForm({ ...form, outletId: e.target.value })} className={field}>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Jenis</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={field}>
                <option value="ROUTINE">Audit rutin</option>
                <option value="SURPRISE">Sidak mendadak</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Tanggal</span>
              <input required type="date" min={localYmd()} value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className={field} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Fokus pemeriksaan (opsional)</span>
            <input maxLength={200} value={form.focusArea} onChange={(e) => setForm({ ...form, focusArea: e.target.value })} className={field} />
          </label>
          {form.type === 'SURPRISE' && <p className="text-xs text-slate-500">Sidak mendadak tidak terlihat oleh kepala cabang sampai hasilnya diisi.</p>}
          {error && <p role="alert" className="alert-error">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={onClose} className="btn btn-ghost px-4">Batal</button>
            <button type="submit" disabled={saving} className="btn btn-primary px-4">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Jadwalkan
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function ConductDialog({
  inspection,
  checklist,
  onClose,
  onSaved,
}: {
  inspection: Inspection;
  checklist: Checklist;
  onClose: () => void;
  onSaved: (saved: Inspection) => void;
}) {
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [findings, setFindings] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [manager, setManager] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const score = checklist.items.filter((i) => passed.has(i.key)).reduce((n, i) => n + i.points, 0);

  function toggle(key: string) {
    const next = new Set(passed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPassed(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await apiFetch<Inspection>(`/inspections/${inspection.id}/result`, {
          method: 'POST',
          body: JSON.stringify({ passedItems: Array.from(passed), findings, actionItems, branchManagerName: manager }),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog wide title={`Hasil sidak · ${inspection.outlet.name}`} onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-slate-600">Centang titik yang lolos pemeriksaan. Skor sementara: <strong className="text-slate-900">{score} / 100</strong></p>
        {Object.entries(checklist.areas).map(([area, label]) => {
          const items = checklist.items.filter((i) => i.area === area);
          const got = items.filter((i) => passed.has(i.key)).reduce((n, i) => n + i.points, 0);
          const max = items.reduce((n, i) => n + i.points, 0);
          return (
            <section key={area} className="space-y-1.5">
              <p className="flex justify-between text-sm font-semibold text-slate-900">
                <span>{label}</span>
                <span>{got} / {max}</span>
              </p>
              {items.map((i) => (
                <label key={i.key} className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-2.5 hover:bg-slate-50">
                  <input type="checkbox" checked={passed.has(i.key)} onChange={() => toggle(i.key)} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">{i.title}</span>
                    <span className="block text-xs text-slate-500">{i.description}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-slate-600">{i.points} poin</span>
                </label>
              ))}
            </section>
          );
        })}
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Temuan</span>
          <textarea maxLength={2000} rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} className={field} />
        </label>
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Tindak lanjut</span>
          <textarea maxLength={2000} rows={2} value={actionItems} onChange={(e) => setActionItems(e.target.value)} className={field} />
        </label>
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Kepala cabang yang mendampingi</span>
          <input maxLength={100} value={manager} onChange={(e) => setManager(e.target.value)} className={field} />
        </label>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={saving} onClick={onClose} className="btn btn-ghost px-4">Batal</button>
          <button type="submit" disabled={saving} className="btn btn-primary px-4">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Simpan hasil ({score}/100)
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ReportDialog({ inspection: r, checklist, onClose }: { inspection: Inspection; checklist: Checklist; onClose: () => void }) {
  const passed = new Set(r.passedItems);

  function print() {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    const rowsHtml = checklist.items
      .map((i) => `<tr><td>${escapeHtml(i.title)}</td><td style="text-align:center">${passed.has(i.key) ? 'Lolos' : 'Tidak'}</td><td style="text-align:right">${passed.has(i.key) ? i.points : 0} / ${i.points}</td></tr>`)
      .join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(r.reportNumber ?? '')}</title>
<style>body{font-family:Georgia,serif;font-size:13px;margin:40px;color:#111}h1{font-size:17px;text-align:center;margin:0}.no{text-align:center;margin:4px 0 20px}
table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #999;padding:4px 6px}.pre{white-space:pre-line}.sign{margin-top:40px;display:flex;justify-content:space-between}</style>
</head><body><h1>Berita Acara ${escapeHtml(TYPE_LABEL[r.type])}</h1><p class="no">Nomor: ${escapeHtml(r.reportNumber ?? '')}</p>
<p>Cabang: ${escapeHtml(r.outlet.name)}<br>Tanggal: ${fmtDate(r.conductedAt ?? r.scheduledDate)}<br>Pemeriksa: ${escapeHtml(who(r.conductedBy))}</p>
<table><thead><tr><th>Titik pemeriksaan</th><th>Hasil</th><th>Poin</th></tr></thead><tbody>${rowsHtml}</tbody></table>
<p><strong>Skor: ${r.score} / 100 (nilai ${escapeHtml(r.grade ?? '')})</strong></p>
${r.findings ? `<p>Temuan:</p><p class="pre">${escapeHtml(r.findings)}</p>` : ''}
${r.actionItems ? `<p>Tindak lanjut:</p><p class="pre">${escapeHtml(r.actionItems)}</p>` : ''}
<div class="sign"><div>Pemeriksa,<br><br><br><br>${escapeHtml(who(r.conductedBy))}</div><div>Kepala cabang,<br><br><br><br>${escapeHtml(r.branchManagerName ?? '')}</div></div>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <Dialog wide title={`Berita acara · ${r.outlet.name}`} onClose={onClose}>
      <p className="font-mono text-xs text-slate-500">{r.reportNumber} · {fmtDate(r.conductedAt ?? r.scheduledDate)} · oleh {who(r.conductedBy)}</p>
      <p className="text-lg font-semibold text-slate-900">
        {r.score} / 100 <span className={`ml-2 rounded border px-2 py-0.5 text-sm ${GRADE_STYLE[r.grade ?? 'D']}`}>{r.grade}</span>
      </p>
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {checklist.items.map((i) => (
          <li key={i.key} className="flex items-center gap-2 px-3 py-1.5">
            {passed.has(i.key) ? <Check className="h-4 w-4 text-emerald-600" aria-label="Lolos" /> : <X className="h-4 w-4 text-rose-600" aria-label="Tidak lolos" />}
            <span className="flex-1 text-slate-800">{i.title}</span>
            <span className="text-xs text-slate-500">{passed.has(i.key) ? i.points : 0}/{i.points}</span>
          </li>
        ))}
      </ul>
      {r.findings && <p className="whitespace-pre-line text-slate-700"><strong>Temuan:</strong> {r.findings}</p>}
      {r.actionItems && <p className="whitespace-pre-line text-slate-700"><strong>Tindak lanjut:</strong> {r.actionItems}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={onClose} className="btn btn-ghost px-4">Tutup</button>
        <button type="button" onClick={print} className="btn btn-primary px-4">
          <Printer className="h-4 w-4" aria-hidden /> Cetak
        </button>
      </div>
    </Dialog>
  );
}
