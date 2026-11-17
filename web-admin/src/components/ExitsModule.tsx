'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';
import type { EmployeeRecord } from '@/components/EmployeeDialog';

type ExitType = 'RESIGN' | 'TERMINATION';
type Status = 'OPEN' | 'COMPLETED' | 'CANCELLED';
type Who = { username: string; profile: { fullName: string } | null } | null;

interface ExitRow {
  id: string;
  type: ExitType;
  submittedDate: string;
  lastWorkingDate: string;
  notice: 'STANDARD' | 'SHORT' | 'WALKOUT' | null;
  reason: string;
  reasonNotes: string;
  rehire: 'RECOMMENDED' | 'CONDITIONAL' | 'NOT_RECOMMENDED';
  uniformReturned: boolean;
  lockerCleared: boolean;
  handoverNotes: string | null;
  interviewedAt: string | null;
  interviewNotes: string | null;
  ratingLeadership: number | null;
  ratingSchedule: number | null;
  ratingTeam: number | null;
  ratingTraining: number | null;
  improvementSuggestion: string | null;
  wouldRecommend: boolean | null;
  status: Status;
  kasbonRemaining: number;
  closedAt: string | null;
  employee: {
    id: string;
    fullName: string;
    nik: string;
    outlet: { name: string };
    position: { title: string };
  };
  createdBy: Who;
  closedBy: Who;
}

const TYPE_LABEL: Record<ExitType, string> = { RESIGN: 'Mengundurkan diri', TERMINATION: 'PHK' };
const PAY_RULE: Record<ExitType, string> = {
  RESIGN: 'Gaji periode terakhir tidak dibayar (sesuai kesepakatan kerja).',
  TERMINATION: 'Gaji periode terakhir dibayar prorata sampai hari terakhir kerja.',
};
const REASONS: Record<ExitType, [string, string][]> = {
  RESIGN: [
    ['CAREER_OPPORTUNITY', 'Pekerjaan / peluang karier baru'],
    ['FAMILY_DOMICILE', 'Keluarga / pindah domisili'],
    ['WORKLOAD_PHYSICAL', 'Beban kerja / jam kerja'],
    ['WORK_ENVIRONMENT', 'Masalah dengan rekan / atasan'],
    ['HEALTH', 'Kesehatan'],
    ['WALKOUT', 'Keluar mendadak / mangkir'],
    ['OTHER', 'Lainnya'],
  ],
  TERMINATION: [
    ['MISCONDUCT', 'Pelanggaran berat'],
    ['PERFORMANCE', 'Kinerja tidak memenuhi'],
    ['CONTRACT_END', 'Kontrak tidak diperpanjang'],
    ['RESTRUCTURING', 'Efisiensi / restrukturisasi'],
    ['HEALTH', 'Kesehatan'],
    ['OTHER', 'Lainnya'],
  ],
};
const REASON_LABEL = Object.fromEntries([...REASONS.RESIGN, ...REASONS.TERMINATION]);
const NOTICES: [string, string][] = [
  ['STANDARD', 'Pemberitahuan 30 hari (sesuai SOP)'],
  ['SHORT', 'Kurang dari 30 hari'],
  ['WALKOUT', 'Mendadak / tanpa pemberitahuan'],
];
const REHIRE: [string, string][] = [
  ['RECOMMENDED', 'Boleh direkrut kembali'],
  ['CONDITIONAL', 'Bersyarat'],
  ['NOT_RECOMMENDED', 'Tidak direkomendasikan'],
];
const STATUS_STYLE: Record<Status, [string, string]> = {
  OPEN: ['Proses serah terima', 'bg-amber-50 text-amber-800 border-amber-200'],
  COMPLETED: ['Selesai', 'bg-slate-100 text-slate-700 border-slate-200'],
  CANCELLED: ['Dibatalkan', 'bg-slate-50 text-slate-500 border-slate-200'],
};

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const who = (u: Who) => u?.profile?.fullName ?? u?.username ?? '-';
function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-amber-500 disabled:bg-slate-50';

/** Karyawan keluar (mengundurkan diri / PHK): pencatatan, serah terima, exit interview, penutupan akun. */
export default function ExitsModule({ showToast, onChanged }: { showToast: (msg: string) => void; onChanged: () => void }) {
  const role = getSessionUser()?.role;
  const isHr = role === 'SUPER_ADMIN' || role === 'HR_ADMIN';
  const canRecord = isHr || role === 'STORE_MANAGER';

  const [rows, setRows] = useState<ExitRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<'OPEN' | 'DONE'>('OPEN');
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<ExitRow | null>(null);

  const load = useCallback(() => {
    apiFetch<ExitRow[]>('/employee-exits')
      .then((d) => {
        setRows(d);
        setLoadError(null);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(
    () => (rows ?? []).filter((r) => (view === 'OPEN' ? r.status === 'OPEN' : r.status !== 'OPEN')),
    [rows, view],
  );
  const openCount = rows?.filter((r) => r.status === 'OPEN').length ?? 0;

  function refresh(message: string) {
    showToast(message);
    load();
    onChanged();
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label="Status">
          {(['OPEN', 'DONE'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded px-3 py-1.5 font-medium ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {v === 'OPEN' ? `Sedang diproses${openCount ? ` (${openCount})` : ''}` : 'Selesai & dibatalkan'}
            </button>
          ))}
        </div>
        {canRecord && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" aria-hidden /> Catat karyawan keluar
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loadError ? (
          <p role="alert" className="p-10 text-center text-rose-700">Gagal memuat data: {loadError}</p>
        ) : rows === null ? (
          <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
          </p>
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-slate-600">
            {view === 'OPEN' ? 'Tidak ada karyawan yang sedang dalam proses keluar.' : 'Belum ada riwayat karyawan keluar.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-600">
                  <th scope="col" className="px-4 py-3">Karyawan</th>
                  <th scope="col" className="px-4 py-3">Jenis & alasan</th>
                  <th scope="col" className="px-4 py-3">Hari terakhir</th>
                  <th scope="col" className="px-4 py-3">Serah terima</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => {
                  const [label, style] = STATUS_STYLE[r.status];
                  return (
                    <tr key={r.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{r.employee.fullName}</p>
                        <p className="text-xs text-slate-500">{r.employee.position.title} · {r.employee.outlet.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className={r.type === 'TERMINATION' ? 'font-medium text-rose-700' : 'text-slate-800'}>{TYPE_LABEL[r.type]}</p>
                        <p className="text-xs text-slate-500">{REASON_LABEL[r.reason] ?? r.reason}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">{r.lastWorkingDate.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-xs">
                        <Item done={r.uniformReturned} label="Seragam" />
                        <Item done={r.lockerCleared} label="Loker & ID card" />
                        <Item done={!!r.interviewedAt} label="Exit interview" />
                        {r.kasbonRemaining > 0 && <p className="mt-0.5 font-medium text-rose-700">Sisa kasbon {rupiah.format(r.kasbonRemaining)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>
                        {r.closedBy && <p className="mt-1 text-xs text-slate-500">oleh {who(r.closedBy)}</p>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setManaging(r)}
                          className="rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {r.status === 'OPEN' ? 'Kelola' : 'Lihat'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <CreateExitDialog
          isHr={isHr}
          onClose={() => setCreating(false)}
          onSaved={(name) => {
            setCreating(false);
            setView('OPEN');
            refresh(`Proses keluar ${name} dicatat.`);
          }}
        />
      )}
      {managing && (
        <ManageExitDialog
          exit={managing}
          isHr={isHr}
          onClose={() => setManaging(null)}
          onDone={(message) => {
            setManaging(null);
            refresh(message);
          }}
        />
      )}
    </div>
  );
}

function Item({ done, label }: { done: boolean; label: string }) {
  return (
    <p className={`flex items-center gap-1 ${done ? 'text-emerald-700' : 'text-slate-500'}`}>
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
      {label}
    </p>
  );
}

function CreateExitDialog({ isHr, onClose, onSaved }: { isHr: boolean; onClose: () => void; onSaved: (name: string) => void }) {
  const today = localYmd();
  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(null);
  const [form, setForm] = useState({
    employeeId: '',
    type: 'RESIGN' as ExitType,
    submittedDate: today,
    lastWorkingDate: today,
    notice: 'STANDARD',
    reason: 'CAREER_OPPORTUNITY',
    reasonNotes: '',
    rehire: 'RECOMMENDED',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const self = getSessionUser()?.id;
    apiFetch<EmployeeRecord[]>('/employees')
      .then((d) => {
        const active = d.filter((e) => e.user.isActive && e.user.id !== self);
        setEmployees(active);
        setForm((f) => ({ ...f, employeeId: active[0]?.id ?? '' }));
      })
      .catch((e) => {
        setEmployees([]);
        setError((e as Error).message);
      });
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });
  const setType = (type: ExitType) => setForm({ ...form, type, reason: REASONS[type][0][0] });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { notice, ...rest } = form;
    try {
      await apiFetch('/employee-exits', {
        method: 'POST',
        body: JSON.stringify(form.type === 'RESIGN' ? form : rest),
      });
      onSaved(employees?.find((x) => x.id === form.employeeId)?.fullName ?? '');
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog wide title="Catat karyawan keluar" onClose={onClose}>
      {employees === null ? (
        <p className="flex items-center gap-2 py-6 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat karyawan…
        </p>
      ) : employees.length === 0 ? (
        <p className="text-slate-700">{error ?? 'Belum ada karyawan aktif.'}</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Karyawan</span>
            <select required value={form.employeeId} onChange={set('employeeId')} className={field}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.fullName} · {e.outlet.name}</option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-1.5">
            <legend className="font-medium text-slate-700">Jenis</legend>
            <div className="flex flex-wrap gap-4">
              {(['RESIGN', 'TERMINATION'] as const).map((t) => (
                <label key={t} className={`flex items-center gap-2 ${t === 'TERMINATION' && !isHr ? 'text-slate-400' : ''}`}>
                  <input type="radio" name="type" checked={form.type === t} disabled={t === 'TERMINATION' && !isHr} onChange={() => setType(t)} />
                  {TYPE_LABEL[t]}
                </label>
              ))}
            </div>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{PAY_RULE[form.type]}</p>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">{form.type === 'RESIGN' ? 'Tanggal pengajuan' : 'Tanggal keputusan'}</span>
              <input required type="date" max={today} value={form.submittedDate} onChange={set('submittedDate')} className={field} />
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Hari terakhir kerja</span>
              <input required type="date" min={form.submittedDate} value={form.lastWorkingDate} onChange={set('lastWorkingDate')} className={field} />
            </label>
            {form.type === 'RESIGN' && (
              <label className="block space-y-1 sm:col-span-2">
                <span className="font-medium text-slate-700">Pemberitahuan</span>
                <select value={form.notice} onChange={set('notice')} className={field}>
                  {NOTICES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Alasan</span>
              <select value={form.reason} onChange={set('reason')} className={field}>
                {REASONS[form.type].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Rekrut kembali</span>
              <select value={form.rehire} onChange={set('rehire')} className={field}>
                {REHIRE.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Keterangan</span>
            <textarea required maxLength={2000} rows={3} value={form.reasonNotes} onChange={set('reasonNotes')} className={field} />
          </label>
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
              Simpan
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

const RATINGS: [keyof ExitRow, string][] = [
  ['ratingLeadership', 'Kepemimpinan kepala cabang'],
  ['ratingSchedule', 'Keadilan jadwal kerja'],
  ['ratingTeam', 'Suasana tim'],
  ['ratingTraining', 'Pelatihan & bimbingan'],
];

function ManageExitDialog({
  exit,
  isHr,
  onClose,
  onDone,
}: {
  exit: ExitRow;
  isHr: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const editable = exit.status === 'OPEN';
  const [form, setForm] = useState({
    lastWorkingDate: exit.lastWorkingDate.slice(0, 10),
    uniformReturned: exit.uniformReturned,
    lockerCleared: exit.lockerCleared,
    handoverNotes: exit.handoverNotes ?? '',
    interviewNotes: exit.interviewNotes ?? '',
    ratingLeadership: exit.ratingLeadership ?? 0,
    ratingSchedule: exit.ratingSchedule ?? 0,
    ratingTeam: exit.ratingTeam ?? 0,
    ratingTraining: exit.ratingTraining ?? 0,
    improvementSuggestion: exit.improvementSuggestion ?? '',
    wouldRecommend: exit.wouldRecommend === null ? '' : String(exit.wouldRecommend),
  });
  const [busy, setBusy] = useState<'save' | 'complete' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = localYmd();

  function payload() {
    const body: Record<string, unknown> = {
      lastWorkingDate: form.lastWorkingDate,
      uniformReturned: form.uniformReturned,
      lockerCleared: form.lockerCleared,
      handoverNotes: form.handoverNotes,
    };
    // Exit interview hanya dikirim bila ada yang diisi
    const ratings = RATINGS.filter(([k]) => (form as Record<string, unknown>)[k as string] as number > 0);
    if (form.interviewNotes || form.improvementSuggestion || form.wouldRecommend || ratings.length) {
      body.interviewNotes = form.interviewNotes;
      body.improvementSuggestion = form.improvementSuggestion;
      for (const [k] of ratings) body[k as string] = (form as Record<string, unknown>)[k as string];
      if (form.wouldRecommend) body.wouldRecommend = form.wouldRecommend === 'true';
    }
    return body;
  }

  async function run(kind: 'save' | 'complete' | 'cancel') {
    setBusy(kind);
    setError(null);
    try {
      if (kind !== 'cancel') {
        await apiFetch(`/employee-exits/${exit.id}`, { method: 'PATCH', body: JSON.stringify(payload()) });
      }
      if (kind === 'complete') await apiFetch(`/employee-exits/${exit.id}/complete`, { method: 'POST' });
      if (kind === 'cancel') await apiFetch(`/employee-exits/${exit.id}/cancel`, { method: 'POST' });
      onDone(
        kind === 'save'
          ? `Data keluar ${exit.employee.fullName} tersimpan.`
          : kind === 'complete'
            ? `Proses keluar ${exit.employee.fullName} selesai; akunnya dinonaktifkan.`
            : `Proses keluar ${exit.employee.fullName} dibatalkan.`,
      );
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  const canComplete = form.uniformReturned && form.lockerCleared && form.lastWorkingDate <= today;
  const heading = 'text-xs font-semibold uppercase text-slate-500';

  return (
    <Dialog wide title={`${TYPE_LABEL[exit.type]}: ${exit.employee.fullName}`} onClose={() => !busy && onClose()}>
      <div className="space-y-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-700">
          <p>
            {REASON_LABEL[exit.reason] ?? exit.reason} · diajukan {exit.submittedDate.slice(0, 10)} oleh {who(exit.createdBy)}
          </p>
          <p className="mt-1 whitespace-pre-line text-slate-800">{exit.reasonNotes}</p>
          <p className="mt-1 text-xs">
            {PAY_RULE[exit.type]} Rekrut kembali: {REHIRE.find(([v]) => v === exit.rehire)?.[1]}.
          </p>
        </div>

        <section className="space-y-2">
          <p className={heading}>Serah terima</p>
          <label className="block max-w-xs space-y-1">
            <span className="font-medium text-slate-700">Hari terakhir kerja</span>
            <input
              type="date"
              disabled={!editable}
              min={exit.submittedDate.slice(0, 10)}
              value={form.lastWorkingDate}
              onChange={(e) => setForm({ ...form, lastWorkingDate: e.target.value })}
              className={field}
            />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" disabled={!editable} checked={form.uniformReturned} onChange={(e) => setForm({ ...form, uniformReturned: e.target.checked })} />
            Seragam sudah dikembalikan
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" disabled={!editable} checked={form.lockerCleared} onChange={(e) => setForm({ ...form, lockerCleared: e.target.checked })} />
            Loker dikosongkan & ID card dikembalikan
          </label>
          <p className={exit.kasbonRemaining > 0 ? 'font-medium text-rose-700' : 'text-slate-600'}>
            {exit.kasbonRemaining > 0
              ? `Sisa kasbon belum lunas: ${rupiah.format(exit.kasbonRemaining)}. Selesaikan sebelum karyawan keluar.`
              : 'Tidak ada sisa kasbon.'}
          </p>
          <textarea
            disabled={!editable}
            maxLength={1000}
            rows={2}
            placeholder="Catatan serah terima (opsional)"
            value={form.handoverNotes}
            onChange={(e) => setForm({ ...form, handoverNotes: e.target.value })}
            className={field}
          />
        </section>

        <section className="space-y-2 border-t border-slate-100 pt-3">
          <p className={heading}>Exit interview {exit.interviewedAt && `· ${exit.interviewedAt.slice(0, 10)}`}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {RATINGS.map(([key, label]) => (
              <label key={key as string} className="flex items-center justify-between gap-2">
                <span className="text-slate-700">{label}</span>
                <select
                  disabled={!editable}
                  value={(form as Record<string, unknown>)[key as string] as number}
                  onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                  className="rounded-md border border-slate-300 px-2 py-1 text-slate-800"
                >
                  <option value={0}>–</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <textarea
            disabled={!editable}
            maxLength={2000}
            rows={2}
            placeholder="Alasan keluar menurut karyawan"
            value={form.interviewNotes}
            onChange={(e) => setForm({ ...form, interviewNotes: e.target.value })}
            className={field}
          />
          <textarea
            disabled={!editable}
            maxLength={1000}
            rows={2}
            placeholder="Apa yang perlu diperbaiki perusahaan?"
            value={form.improvementSuggestion}
            onChange={(e) => setForm({ ...form, improvementSuggestion: e.target.value })}
            className={field}
          />
          <label className="flex items-center gap-2">
            <span className="text-slate-700">Mau merekomendasikan Barokah Grup sebagai tempat kerja?</span>
            <select
              disabled={!editable}
              value={form.wouldRecommend}
              onChange={(e) => setForm({ ...form, wouldRecommend: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1 text-slate-800"
            >
              <option value="">–</option>
              <option value="true">Ya</option>
              <option value="false">Tidak</option>
            </select>
          </label>
        </section>

        {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{error}</p>}
        {editable && isHr && !canComplete && (
          <p className="text-xs text-slate-500">
            Proses bisa ditutup setelah seragam dan loker selesai, mulai hari terakhir kerja ({form.lastWorkingDate}).
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
          {editable && isHr && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('cancel')}
              className="mr-auto rounded-md px-3 py-2 font-medium text-rose-700 hover:bg-rose-50"
            >
              {busy === 'cancel' ? 'Membatalkan…' : 'Batalkan proses keluar'}
            </button>
          )}
          <button type="button" disabled={!!busy} onClick={onClose} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
            Tutup
          </button>
          {editable && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('save')}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Simpan
            </button>
          )}
          {editable && isHr && (
            <button
              type="button"
              disabled={!!busy || !canComplete}
              onClick={() => run('complete')}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === 'complete' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Selesaikan & nonaktifkan akun
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
