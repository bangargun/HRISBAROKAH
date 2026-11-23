'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, Printer, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { EDARAN_TEMPLATES, LEGAL_CLAUSES } from '@/lib/legalTemplates';
import Dialog from '@/components/Dialog';
import type { EmployeeRecord } from '@/components/EmployeeDialog';

export type LegalTab = 'sk-list' | 'contract-list' | 'edaran-list' | 'generate-doc' | 'template-library';
type Category = 'SK' | 'PKWT' | 'EDARAN';
type DocType =
  | 'SK_PENGANGKATAN'
  | 'SK_PROMOSI'
  | 'SK_MUTASI'
  | 'SK_PENYESUAIAN_GAJI'
  | 'PKWT_KRU'
  | 'PKWTT_TETAP'
  | 'SE_LIBUR_OPERASIONAL'
  | 'SE_KUOTA_LIBUR'
  | 'SE_CUTI_TAHUNAN'
  | 'SE_CUSTOM';

interface LegalDoc {
  id: string;
  docNumber: string;
  docType: DocType;
  category: Category;
  employeeId: string | null;
  employeeName: string | null;
  employeeNik: string | null;
  positionTitle: string | null;
  outletName: string | null;
  targetPosition: { id: string; title: string } | null;
  targetOutlet: { id: string; name: string } | null;
  salaryAmount: string | null;
  audience: string | null;
  subject: string | null;
  title: string;
  effectiveDate: string;
  expiredDate: string | null;
  signatoryName: string;
  signatoryRole: string;
  contentBody: string;
  considerations: string[];
  decisions: string[];
  status: 'ISSUED' | 'CANCELLED';
  cancelReason: string | null;
  appliedAt: string | null;
  createdAt: string;
}
interface OutletOption { id: string; name: string }
interface Department { id: string; name: string; positions: { id: string; title: string }[] }

const TYPES: { value: DocType; label: string; category: Category; title: string }[] = [
  { value: 'SK_PENGANGKATAN', label: 'SK Pengangkatan Karyawan Tetap', category: 'SK', title: 'Pengangkatan Karyawan Tetap' },
  { value: 'SK_PROMOSI', label: 'SK Promosi Jabatan', category: 'SK', title: 'Promosi Jabatan' },
  { value: 'SK_MUTASI', label: 'SK Mutasi Cabang', category: 'SK', title: 'Mutasi Cabang' },
  { value: 'SK_PENYESUAIAN_GAJI', label: 'SK Penyesuaian Gaji', category: 'SK', title: 'Penyesuaian Gaji' },
  { value: 'PKWT_KRU', label: 'Kontrak PKWT (waktu tertentu)', category: 'PKWT', title: 'Perjanjian Kerja Waktu Tertentu' },
  { value: 'PKWTT_TETAP', label: 'Kontrak PKWTT (karyawan tetap)', category: 'PKWT', title: 'Perjanjian Kerja Waktu Tidak Tertentu' },
  { value: 'SE_LIBUR_OPERASIONAL', label: 'Edaran Libur Operasional', category: 'EDARAN', title: 'Penyesuaian Operasional Hari Libur' },
  { value: 'SE_KUOTA_LIBUR', label: 'Edaran Kuota Libur Kru', category: 'EDARAN', title: 'Kuota Libur Kru' },
  { value: 'SE_CUTI_TAHUNAN', label: 'Edaran Cuti Tahunan', category: 'EDARAN', title: 'Cuti Tahunan Berjenjang' },
  { value: 'SE_CUSTOM', label: 'Edaran lainnya', category: 'EDARAN', title: 'Himbauan Operasional' },
];
const TYPE_BY = Object.fromEntries(TYPES.map((t) => [t.value, t])) as Record<DocType, (typeof TYPES)[number]>;
const APPLY_EFFECT: Partial<Record<DocType, string>> = {
  SK_MUTASI: 'cabang karyawan diganti ke cabang tujuan',
  SK_PROMOSI: 'jabatan karyawan diganti ke jabatan baru',
  SK_PENGANGKATAN: 'status kerja karyawan menjadi Tetap',
  PKWTT_TETAP: 'status kerja karyawan menjadi Tetap',
  PKWT_KRU: 'status kerja karyawan menjadi Kontrak',
};
const TAB_CATEGORY: Partial<Record<LegalTab, Category>> = { 'sk-list': 'SK', 'contract-list': 'PKWT', 'edaran-list': 'EDARAN' };
const DOC_HEADING: Record<Category, string> = {
  SK: 'SURAT KEPUTUSAN',
  PKWT: 'PERJANJIAN KERJA',
  EDARAN: 'SURAT EDARAN',
};
const DEFAULT_BODY: Record<Category, string> = {
  SK: 'Keputusan ini berlaku sejak tanggal yang ditetapkan. Apabila di kemudian hari terdapat kekeliruan, akan diadakan perbaikan sebagaimana mestinya.',
  PKWT: 'Karyawan wajib mematuhi peraturan perusahaan, SOP operasional dan tata tertib kerja Barokah Grup selama masa perjanjian ini.',
  EDARAN: '',
};
const SIGNATORY_KEY = 'hris-legal-signatory';

const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const longDate = (ymd: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(ymd.slice(0, 10)));
const rupiah = (v: string | number) => `Rp ${Number(v).toLocaleString('id-ID')}`;
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Surat & kontrak resmi: arsip di server, nomor otomatis, terapkan ke data karyawan, batalkan dengan alasan. */
export default function LegalDocsModule({ tab, onNavigate }: { tab: LegalTab; onNavigate: (tab: LegalTab) => void }) {
  const role = getSessionUser()?.role;
  const canManage = role === 'SUPER_ADMIN' || role === 'HR_ADMIN';
  const [draftBody, setDraftBody] = useState<string | null>(null);
  const [viewing, setViewing] = useState<LegalDoc | null>(null);
  const category = TAB_CATEGORY[tab];

  return (
    <div className="space-y-4">
      {category && <DocList key={category} category={category} canManage={canManage} onView={setViewing} />}
      {tab === 'generate-doc' &&
        (canManage ? (
          <IssueForm
            pendingClause={draftBody}
            onClauseUsed={() => setDraftBody(null)}
            onIssued={(doc) => {
              onNavigate(doc.category === 'SK' ? 'sk-list' : doc.category === 'PKWT' ? 'contract-list' : 'edaran-list');
              setViewing(doc);
            }}
          />
        ) : (
          <p className="empty-state">Hanya HR dan Super Admin yang bisa menerbitkan surat.</p>
        ))}
      {tab === 'template-library' && (
        <ClauseLibrary
          canUse={canManage}
          onUse={(text) => {
            setDraftBody(text);
            onNavigate('generate-doc');
          }}
        />
      )}
      {viewing && <DocViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function DocList({ category, canManage, onView }: { category: Category; canManage: boolean; onView: (d: LegalDoc) => void }) {
  const isStoreManager = getSessionUser()?.role === 'STORE_MANAGER';
  const [docs, setDocs] = useState<LegalDoc[] | null>(null);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [outletId, setOutletId] = useState('');
  const [status, setStatus] = useState<'' | 'ISSUED' | 'CANCELLED'>('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmApply, setConfirmApply] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<LegalDoc | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ category });
    if (outletId) params.set('outletId', outletId);
    apiFetch<LegalDoc[]>(`/legal-docs?${params}`)
      .then(setDocs)
      .catch((e) => setError((e as Error).message));
  }, [category, outletId]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!isStoreManager && category !== 'EDARAN') apiFetch<OutletOption[]>('/outlets').then(setOutlets).catch(() => setOutlets([]));
  }, [isStoreManager, category]);

  const today = todayYmd();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (docs ?? []).filter(
      (d) =>
        (!status || d.status === status) &&
        (!q ||
          [d.docNumber, d.title, d.employeeName ?? '', d.employeeNik ?? '', d.audience ?? '', d.subject ?? ''].some((v) =>
            v.toLowerCase().includes(q),
          )),
    );
  }, [docs, query, status]);

  async function apply(doc: LegalDoc) {
    setBusy(doc.id);
    setError(null);
    try {
      await apiFetch(`/legal-docs/${doc.id}/apply`, { method: 'POST' });
      setConfirmApply(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <label htmlFor={`legal-search-${category}`} className="sr-only">Cari surat</label>
          <input
            id={`legal-search-${category}`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nomor, judul, nama, NIK"
            className="input pl-9"
          />
        </div>
        <div className="segmented" role="group" aria-label="Saring status surat">
          {(['', 'ISSUED', 'CANCELLED'] as const).map((s) => (
            <button key={s || 'all'} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className="segmented-item">
              {s === '' ? 'Semua' : s === 'ISSUED' ? 'Berlaku' : 'Dibatalkan'}
            </button>
          ))}
        </div>
        {outlets.length > 0 && (
          <>
            <label htmlFor={`legal-outlet-${category}`} className="sr-only">Cabang</label>
            <select id={`legal-outlet-${category}`} value={outletId} onChange={(e) => setOutletId(e.target.value)} className="input w-auto">
              <option value="">Semua cabang</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </>
        )}
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Nomor & judul</th>
              <th scope="col" className="px-4 py-3">{category === 'EDARAN' ? 'Ditujukan kepada' : 'Karyawan'}</th>
              <th scope="col" className="px-4 py-3">Berlaku</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {docs === null ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-slate-500">
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…</span>
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">{docs.length === 0 ? 'Belum ada surat di arsip ini.' : 'Tidak ada surat yang cocok.'}</td>
              </tr>
            ) : (
              shown.map((d) => {
                const effect = APPLY_EFFECT[d.docType];
                const effective = d.effectiveDate.slice(0, 10);
                const canApply = canManage && effect && d.status === 'ISSUED' && !d.appliedAt;
                return (
                  <tr key={d.id} className="align-top">
                    <td className="max-w-xs px-4 py-3">
                      <div className="font-mono text-xs text-slate-500">{d.docNumber}</div>
                      <div className="font-medium text-slate-900">{TYPE_BY[d.docType]?.label ?? d.docType}</div>
                      <div className="text-xs text-slate-600">{d.title}</div>
                    </td>
                    <td className="px-4 py-3">
                      {d.category === 'EDARAN' ? (
                        <span className="text-slate-700">{d.audience || 'Seluruh karyawan'}</span>
                      ) : (
                        <>
                          <div className="font-medium text-slate-900">{d.employeeName}</div>
                          <div className="text-xs text-slate-500">NIK {d.employeeNik} · {d.outletName}</div>
                          {d.targetOutlet && <div className="text-xs text-slate-600">Ke cabang: {d.targetOutlet.name}</div>}
                          {d.targetPosition && <div className="text-xs text-slate-600">Jabatan baru: {d.targetPosition.title}</div>}
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {longDate(effective)}
                      {d.expiredDate && <div className="text-xs text-slate-500">s.d. {longDate(d.expiredDate)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {d.status === 'CANCELLED' ? (
                        <>
                          <span className="badge badge-neutral">Dibatalkan</span>
                          {d.cancelReason && <div className="mt-1 max-w-[14rem] text-xs text-slate-500">{d.cancelReason}</div>}
                        </>
                      ) : d.appliedAt ? (
                        <span className="badge badge-success">Sudah diterapkan</span>
                      ) : effect ? (
                        <span className="badge badge-warning">Belum diterapkan</span>
                      ) : (
                        <span className="badge badge-success">Berlaku</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {confirmApply === d.id ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="max-w-[16rem] text-right text-xs text-slate-600">Terapkan: {effect}. Tidak bisa dibatalkan.</span>
                          <span className="flex gap-1.5">
                            <button type="button" disabled={!!busy} onClick={() => apply(d)} className="btn btn-sm btn-primary">
                              {busy === d.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Terapkan
                            </button>
                            <button type="button" disabled={!!busy} onClick={() => setConfirmApply(null)} className="btn btn-sm btn-ghost">Batal</button>
                          </span>
                        </div>
                      ) : (
                        <span className="flex flex-wrap items-center justify-end gap-1.5">
                          <button type="button" onClick={() => onView(d)} className="btn btn-sm btn-secondary">Lihat & cetak</button>
                          {canApply &&
                            (effective <= today ? (
                              <button type="button" disabled={!!busy} onClick={() => setConfirmApply(d.id)} className="btn btn-sm btn-primary">
                                Terapkan
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">Bisa diterapkan mulai {longDate(effective)}</span>
                            ))}
                          {canManage && d.status === 'ISSUED' && !d.appliedAt && (
                            <button type="button" disabled={!!busy} onClick={() => setCancelling(d)} className="btn btn-sm btn-ghost">Batalkan</button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {cancelling && (
        <CancelDialog
          doc={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CancelDialog({ doc, onClose, onDone }: { doc: LegalDoc; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/legal-docs/${doc.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog title="Batalkan surat" onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-700">
          <span className="font-mono">{doc.docNumber}</span> · {doc.title}. Surat yang dibatalkan tetap ada di arsip dengan alasannya.
        </p>
        <label className="block space-y-1">
          <span className="field-label">Alasan pembatalan</span>
          <input required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="input" />
        </label>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={saving} onClick={onClose} className="btn btn-ghost">Kembali</button>
          <button type="submit" disabled={saving} className="btn btn-danger">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Batalkan surat
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function readSignatory(): { name: string; role: string } {
  try {
    const v = JSON.parse(localStorage.getItem(SIGNATORY_KEY) ?? 'null');
    if (v && typeof v.name === 'string' && typeof v.role === 'string') return v;
  } catch {
    // Penyimpanan browser tidak tersedia; pakai isian kosong
  }
  return { name: '', role: '' };
}

function IssueForm({
  pendingClause,
  onClauseUsed,
  onIssued,
}: {
  pendingClause: string | null;
  onClauseUsed: () => void;
  onIssued: (doc: LegalDoc) => void;
}) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState(() => {
    const sig = readSignatory();
    return {
      docType: 'SK_PROMOSI' as DocType,
      employeeId: '',
      targetOutletId: '',
      targetPositionId: '',
      salaryAmount: '',
      audience: 'Seluruh pimpinan cabang dan kru',
      subject: '',
      title: TYPE_BY.SK_PROMOSI.title,
      effectiveDate: todayYmd(),
      expiredDate: '',
      signatoryName: sig.name,
      signatoryRole: sig.role,
      considerations: '',
      decisions: '',
      contentBody: DEFAULT_BODY.SK,
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<EmployeeRecord[]>('/employees').then((d) => setEmployees(d.filter((e) => e.user.isActive))).catch((e) => setError((e as Error).message));
    apiFetch<OutletOption[]>('/outlets').then(setOutlets).catch(() => setOutlets([]));
    apiFetch<Department[]>('/departments').then(setDepartments).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (pendingClause) {
      setForm((f) => ({ ...f, contentBody: f.contentBody ? `${f.contentBody}\n\n${pendingClause}` : pendingClause }));
      onClauseUsed();
    }
  }, [pendingClause, onClauseUsed]);

  const type = TYPE_BY[form.docType];
  const isEdaran = type.category === 'EDARAN';
  const employee = employees.find((e) => e.id === form.employeeId);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  function changeType(docType: DocType) {
    const next = TYPE_BY[docType];
    setForm((f) => ({
      ...f,
      docType,
      title: next.title,
      contentBody: next.category === 'EDARAN' ? EDARAN_TEMPLATES[docType] ?? '' : f.contentBody && TYPE_BY[f.docType].category !== 'EDARAN' ? f.contentBody : DEFAULT_BODY[next.category],
      subject: next.category === 'EDARAN' ? next.title : f.subject,
      expiredDate: docType === 'PKWT_KRU' ? f.expiredDate : '',
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        docType: form.docType,
        title: form.title,
        effectiveDate: form.effectiveDate,
        signatoryName: form.signatoryName,
        signatoryRole: form.signatoryRole,
        contentBody: form.contentBody,
        considerations: lines(form.considerations),
        decisions: lines(form.decisions),
        ...(isEdaran
          ? { audience: form.audience, subject: form.subject }
          : {
              employeeId: form.employeeId,
              ...(form.targetOutletId && { targetOutletId: form.targetOutletId }),
              ...(form.targetPositionId && { targetPositionId: form.targetPositionId }),
              ...(form.salaryAmount && { salaryAmount: Number(form.salaryAmount) }),
              ...(form.expiredDate && { expiredDate: form.expiredDate }),
            }),
      };
      const doc = await apiFetch<LegalDoc>('/legal-docs', { method: 'POST', body: JSON.stringify(body) });
      try {
        localStorage.setItem(SIGNATORY_KEY, JSON.stringify({ name: form.signatoryName, role: form.signatoryRole }));
      } catch {
        // Tidak bisa mengingat penanda tangan di perangkat ini; tidak masalah
      }
      onIssued(doc);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Terbitkan surat</h2>
        <p className="text-sm text-slate-600">Nomor surat dibuat otomatis saat diterbitkan. Surat yang sudah terbit tidak bisa diubah; kesalahan diperbaiki dengan membatalkan lalu menerbitkan surat baru.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="field-label">Jenis surat</span>
          <select value={form.docType} onChange={(e) => changeType(e.target.value as DocType)} className="input">
            {(['SK', 'PKWT', 'EDARAN'] as const).map((c) => (
              <optgroup key={c} label={c === 'SK' ? 'Surat keputusan' : c === 'PKWT' ? 'Kontrak kerja' : 'Surat edaran'}>
                {TYPES.filter((t) => t.category === c).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="field-label">Judul / tentang</span>
          <input required maxLength={200} value={form.title} onChange={set('title')} className="input" />
        </label>

        {isEdaran ? (
          <>
            <label className="block space-y-1">
              <span className="field-label">Ditujukan kepada</span>
              <input maxLength={300} value={form.audience} onChange={set('audience')} className="input" />
            </label>
            <label className="block space-y-1">
              <span className="field-label">Perihal</span>
              <input maxLength={200} value={form.subject} onChange={set('subject')} className="input" />
            </label>
          </>
        ) : (
          <>
            <label className="block space-y-1 md:col-span-2">
              <span className="field-label">Karyawan</span>
              <select required value={form.employeeId} onChange={set('employeeId')} className="input">
                <option value="">Pilih karyawan</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName} · {e.position.title} · {e.outlet.name}</option>
                ))}
              </select>
              {employee && <span className="text-xs text-slate-500">Sekarang: {employee.position.title} di {employee.outlet.name}, NIK {employee.nik}</span>}
            </label>
            {(form.docType === 'SK_MUTASI' || form.docType === 'SK_PROMOSI') && (
              <label className="block space-y-1">
                <span className="field-label">{form.docType === 'SK_MUTASI' ? 'Cabang tujuan' : 'Cabang baru (opsional)'}</span>
                <select required={form.docType === 'SK_MUTASI'} value={form.targetOutletId} onChange={set('targetOutletId')} className="input">
                  <option value="">{form.docType === 'SK_MUTASI' ? 'Pilih cabang' : 'Tetap di cabang sekarang'}</option>
                  {outlets.filter((o) => o.id !== employee?.outletId).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </label>
            )}
            {form.docType === 'SK_PROMOSI' && (
              <label className="block space-y-1">
                <span className="field-label">Jabatan baru</span>
                <select required value={form.targetPositionId} onChange={set('targetPositionId')} className="input">
                  <option value="">Pilih jabatan</option>
                  {departments.map((d) => (
                    <optgroup key={d.id} label={d.name}>
                      {d.positions.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
            {(form.docType === 'SK_PENYESUAIAN_GAJI' || type.category === 'PKWT') && (
              <label className="block space-y-1">
                <span className="field-label">Gaji pokok per bulan (Rp){form.docType === 'SK_PENYESUAIAN_GAJI' ? '' : ' (opsional)'}</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  required={form.docType === 'SK_PENYESUAIAN_GAJI'}
                  value={form.salaryAmount}
                  onChange={set('salaryAmount')}
                  className="input"
                />
                <span className="text-xs text-slate-500">Hanya tercantum di surat; perhitungan gaji tetap mengikuti Aturan Gaji.</span>
              </label>
            )}
          </>
        )}

        <label className="block space-y-1">
          <span className="field-label">Tanggal berlaku</span>
          <input required type="date" value={form.effectiveDate} onChange={set('effectiveDate')} className="input" />
        </label>
        {form.docType === 'PKWT_KRU' && (
          <label className="block space-y-1">
            <span className="field-label">Tanggal berakhir kontrak</span>
            <input required type="date" value={form.expiredDate} onChange={set('expiredDate')} className="input" />
          </label>
        )}
        <label className="block space-y-1">
          <span className="field-label">Nama penanda tangan</span>
          <input required maxLength={100} value={form.signatoryName} onChange={set('signatoryName')} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="field-label">Jabatan penanda tangan</span>
          <input required maxLength={100} value={form.signatoryRole} onChange={set('signatoryRole')} className="input" />
        </label>
      </div>

      {!isEdaran && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="field-label">Menimbang (satu butir per baris, opsional)</span>
            <textarea rows={3} value={form.considerations} onChange={set('considerations')} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">Memutuskan (satu butir per baris, opsional)</span>
            <textarea rows={3} value={form.decisions} onChange={set('decisions')} className="input" />
          </label>
        </div>
      )}
      <label className="block space-y-1">
        <span className="field-label">Isi surat</span>
        <textarea required rows={8} maxLength={20000} value={form.contentBody} onChange={set('contentBody')} className="input" />
        <span className="text-xs text-slate-500">Klausul dari menu Klausul Baku bisa ditambahkan ke sini.</span>
      </label>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div className="flex justify-end border-t border-slate-100 pt-3">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Terbitkan surat
        </button>
      </div>
    </form>
  );
}

function ClauseLibrary({ canUse, onUse }: { canUse: boolean; onUse: (text: string) => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const clauses = LEGAL_CLAUSES.filter((c) => !q || c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.text.toLowerCase().includes(q));
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Klausul acuan untuk isi surat dan kontrak. Salin ke formulir lalu sesuaikan sebelum diterbitkan.</p>
      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <label htmlFor="clause-search" className="sr-only">Cari klausul</label>
        <input id="clause-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari klausul" className="input pl-9" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {clauses.map((c) => (
          <article key={c.id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{c.title}</h3>
                <p className="text-xs text-slate-500">{c.category}{c.legalReference ? ` · ${c.legalReference}` : ''}</p>
              </div>
              {canUse && (
                <button type="button" onClick={() => onUse(c.text)} className="btn btn-sm btn-secondary shrink-0">
                  <Copy className="h-4 w-4" aria-hidden /> Salin ke formulir
                </button>
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{c.text}</p>
          </article>
        ))}
        {clauses.length === 0 && <p className="empty-state lg:col-span-2">Tidak ada klausul yang cocok.</p>}
      </div>
    </div>
  );
}

function docHtml(d: LegalDoc, origin: string): string {
  const row = (k: string, v: string) => `<tr><td class="k">${esc(k)}</td><td>: ${esc(v)}</td></tr>`;
  const list = (items: string[]) => `<ol>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`;
  const rows =
    d.category === 'EDARAN'
      ? [row('Perihal', d.subject || d.title), row('Ditujukan kepada', d.audience || 'Seluruh karyawan'), row('Berlaku', longDate(d.effectiveDate))]
      : [
          row('Nama', d.employeeName ?? '-'),
          row('NIK', d.employeeNik ?? '-'),
          row('Jabatan', d.targetPosition ? `${d.targetPosition.title} (sebelumnya ${d.positionTitle})` : d.positionTitle ?? '-'),
          row('Penempatan', d.targetOutlet ? `${d.targetOutlet.name} (sebelumnya ${d.outletName})` : d.outletName ?? '-'),
          ...(d.salaryAmount ? [row('Gaji pokok', `${rupiah(d.salaryAmount)} per bulan`)] : []),
          row('Berlaku', d.expiredDate ? `${longDate(d.effectiveDate)} s.d. ${longDate(d.expiredDate)}` : longDate(d.effectiveDate)),
        ];
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(d.docNumber)}</title>
<style>
@page { size: A4; margin: 18mm 18mm 20mm; }
body { font-family: 'Times New Roman', serif; color: #111; font-size: 12pt; line-height: 1.55; margin: 0; }
img.kop { width: 100%; display: block; margin-bottom: 14px; }
h1 { text-align: center; font-size: 14pt; margin: 6px 0 0; letter-spacing: .5px; }
.no { text-align: center; margin: 0 0 14px; }
.tentang { text-align: center; font-weight: bold; margin-bottom: 14px; }
table { border-collapse: collapse; margin: 6px 0 12px; } td { padding: 2px 6px; vertical-align: top; } td.k { width: 150px; }
.body { white-space: pre-wrap; text-align: justify; }
.ttd { margin-top: 36px; width: 260px; margin-left: auto; text-align: center; }
.ttd .space { height: 70px; }
.void { border: 2px solid #b91c1c; color: #b91c1c; padding: 6px 10px; text-align: center; font-weight: bold; margin-bottom: 12px; }
</style></head><body>
<img class="kop" src="${origin}/kop-surat-barokah.jpg" alt="Kop surat Barokah Grup">
${d.status === 'CANCELLED' ? `<div class="void">DIBATALKAN: ${esc(d.cancelReason ?? '')}</div>` : ''}
<h1>${DOC_HEADING[d.category]}</h1>
<p class="no">Nomor: ${esc(d.docNumber)}</p>
<p class="tentang">Tentang: ${esc(d.title)}</p>
${d.considerations.length ? `<p><b>Menimbang:</b></p>${list(d.considerations)}` : ''}
<p>${d.category === 'EDARAN' ? 'Disampaikan kepada seluruh pihak terkait:' : 'Dengan ini menetapkan kepada:'}</p>
<table>${rows.join('')}</table>
${d.decisions.length ? `<p><b>Memutuskan:</b></p>${list(d.decisions)}` : ''}
<div class="body">${esc(d.contentBody)}</div>
<div class="ttd">Ditetapkan pada ${esc(longDate(d.createdAt.slice(0, 10)))}<br>${esc(d.signatoryRole)}<div class="space"></div><b><u>${esc(d.signatoryName)}</u></b></div>
</body></html>`;
}

function DocViewer({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const html = useMemo(() => docHtml(doc, typeof window === 'undefined' ? '' : window.location.origin), [doc]);
  function print() {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.addEventListener('load', () => w.print());
  }
  return (
    <Dialog wide title={`${TYPE_BY[doc.docType]?.label ?? 'Surat'} · ${doc.docNumber}`} onClose={onClose}>
      <div className="space-y-3">
        {doc.appliedAt && (
          <p className="text-sm text-emerald-800">Sudah diterapkan ke data karyawan pada {longDate(doc.appliedAt.slice(0, 10))}.</p>
        )}
        <iframe title="Pratinjau surat" srcDoc={html} className="h-[60vh] w-full rounded-md border border-slate-200 bg-white" />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} className="btn btn-ghost">Tutup</button>
          <button type="button" onClick={print} className="btn btn-primary">
            <Printer className="h-4 w-4" aria-hidden /> Cetak
          </button>
        </div>
      </div>
    </Dialog>
  );
}
