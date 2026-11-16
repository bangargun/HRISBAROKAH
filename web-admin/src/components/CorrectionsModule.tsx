'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';
import type { EmployeeRecord } from '@/components/EmployeeDialog';

interface Correction {
  id: string;
  date: string;
  type: 'CLOCK_OUT' | 'BOTH';
  clockIn: string | null;
  clockOut: string;
  witness: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decisionNote: string | null;
  monthlyCount: number | null;
  overLimit?: boolean;
  employee: { id: string; fullName: string; nik: string; outlet: { name: string } };
  createdBy: { username: string; profile: { fullName: string } | null };
  decidedBy: { username: string; profile: { fullName: string } | null } | null;
}

const TYPE_LABEL = { CLOCK_OUT: 'Lupa absen pulang', BOTH: 'Lupa absen masuk & pulang' };
const STATUS_STYLE = {
  PENDING: ['Menunggu', 'bg-amber-50 text-amber-800 border-amber-200'],
  APPROVED: ['Disetujui', 'bg-emerald-50 text-emerald-800 border-emerald-200'],
  REJECTED: ['Ditolak', 'bg-slate-100 text-slate-600 border-slate-200'],
} as const;

const who = (u: { username: string; profile: { fullName: string } | null } | null) => u?.profile?.fullName ?? u?.username ?? '-';

function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Koreksi presensi (lupa absen, SOP-HR-008): kepala cabang/HR mengajukan, HR memutuskan. Disetujui = absen dilengkapi. */
export default function CorrectionsModule({ showToast }: { showToast: (msg: string) => void }) {
  const role = getSessionUser()?.role;
  const canDecide = role === 'SUPER_ADMIN' || role === 'HR_ADMIN';
  const canCreate = canDecide || role === 'STORE_MANAGER';

  const [month, setMonth] = useState(localYmd().slice(0, 7));
  const [rows, setRows] = useState<Correction[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deciding, setDeciding] = useState<{ row: Correction; decision: 'APPROVED' | 'REJECTED' } | null>(null);

  const load = useCallback(() => {
    setRows(null);
    apiFetch<Correction[]>(`/attendance-corrections?month=${month}`)
      .then((d) => {
        setRows(d);
        setLoadError(null);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, [month]);

  useEffect(load, [load]);

  const pending = rows?.filter((r) => r.status === 'PENDING').length ?? 0;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-slate-600">Bulan</span>
            <input
              type="month"
              value={month}
              max={localYmd().slice(0, 7)}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-800"
            />
          </label>
          {rows && (
            <p className="text-slate-600">
              {rows.length} koreksi{pending ? `, ${pending} menunggu keputusan` : ''}
            </p>
          )}
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" aria-hidden /> Ajukan koreksi
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Koreksi yang disetujui melengkapi absen karyawan di tanggal itu, sehingga ikut terhitung di gaji. Sesuai SOP-HR-008,
        mulai koreksi ke-3 dalam sebulan uang makan hari itu hangus.
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loadError ? (
          <p role="alert" className="p-10 text-center text-rose-700">Gagal memuat koreksi: {loadError}</p>
        ) : rows === null ? (
          <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
          </p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada koreksi presensi di bulan ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-600">
                  <th scope="col" className="px-4 py-3">Tanggal</th>
                  <th scope="col" className="px-4 py-3">Karyawan</th>
                  <th scope="col" className="px-4 py-3">Koreksi</th>
                  <th scope="col" className="px-4 py-3">Alasan</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  {canDecide && <th scope="col" className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const [label, style] = STATUS_STYLE[r.status];
                  return (
                    <tr key={r.id} className="align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">{r.date.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{r.employee.fullName}</p>
                        <p className="text-xs text-slate-500">{r.employee.outlet.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{TYPE_LABEL[r.type]}</p>
                        <p className="font-mono text-xs text-slate-500">
                          {r.clockIn ? `${r.clockIn} – ${r.clockOut}` : `pulang ${r.clockOut}`}
                        </p>
                        {r.monthlyCount !== null && (
                          <p className={`mt-1 flex items-center gap-1 text-xs ${r.overLimit ? 'font-medium text-rose-700' : 'text-slate-500'}`}>
                            {r.overLimit && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
                            Koreksi ke-{r.monthlyCount} bulan ini{r.overLimit ? ', uang makan hangus' : ''}
                          </p>
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-700">
                        <p>{r.reason}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Diajukan {who(r.createdBy)}
                          {r.witness ? ` · saksi ${r.witness}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>
                        {r.decidedBy && <p className="mt-1 text-xs text-slate-500">oleh {who(r.decidedBy)}</p>}
                        {r.decisionNote && <p className="mt-1 text-xs text-slate-600">{r.decisionNote}</p>}
                      </td>
                      {canDecide && (
                        <td className="px-4 py-3">
                          {r.status === 'PENDING' && (
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDeciding({ row: r, decision: 'APPROVED' })}
                                className="rounded-md bg-slate-900 px-2.5 py-1.5 font-medium text-white hover:bg-slate-800"
                              >
                                Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeciding({ row: r, decision: 'REJECTED' })}
                                className="rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Tolak
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <CreateCorrectionDialog
          onClose={() => setCreating(false)}
          onSaved={(ymd) => {
            setCreating(false);
            showToast('Koreksi presensi diajukan.');
            if (ymd.slice(0, 7) === month) load();
            else setMonth(ymd.slice(0, 7));
          }}
        />
      )}

      {deciding && (
        <DecisionDialog
          {...deciding}
          onClose={() => setDeciding(null)}
          onDone={() => {
            showToast(deciding.decision === 'APPROVED' ? 'Koreksi disetujui, absen sudah dilengkapi.' : 'Koreksi ditolak.');
            setDeciding(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateCorrectionDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (date: string) => void }) {
  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(null);
  const [form, setForm] = useState({
    employeeId: '',
    date: localYmd(),
    type: 'CLOCK_OUT' as 'CLOCK_OUT' | 'BOTH',
    clockIn: '09:00',
    clockOut: '17:00',
    witness: '',
    reason: '',
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

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { clockIn, ...rest } = form;
    try {
      await apiFetch('/attendance-corrections', {
        method: 'POST',
        body: JSON.stringify(form.type === 'BOTH' ? form : rest),
      });
      onSaved(form.date);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-amber-500';

  return (
    <Dialog wide title="Ajukan koreksi presensi" onClose={onClose}>
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
              <span className="font-medium text-slate-700">Tanggal</span>
              <input required type="date" max={localYmd()} value={form.date} onChange={set('date')} className={field} />
            </label>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="font-medium text-slate-700">Yang terlupa</legend>
            {(['CLOCK_OUT', 'BOTH'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2">
                <input type="radio" name="type" value={t} checked={form.type === t} onChange={set('type')} />
                <span className="text-slate-800">{TYPE_LABEL[t]}</span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            {form.type === 'BOTH' && (
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Jam masuk sebenarnya</span>
                <input required type="time" value={form.clockIn} onChange={set('clockIn')} className={field} />
              </label>
            )}
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Jam pulang sebenarnya</span>
              <input required type="time" value={form.clockOut} onChange={set('clockOut')} className={field} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Saksi (shift leader / rekan kerja)</span>
            <input maxLength={100} value={form.witness} onChange={set('witness')} className={field} />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Alasan</span>
            <textarea required maxLength={500} rows={3} value={form.reason} onChange={set('reason')} className={field} />
          </label>
          <p className="text-xs text-slate-500">
            Jam pulang lebih awal dari jam masuk dianggap pulang lewat tengah malam. Keterlambatan dihitung dari jam masuk
            yang diisi.
          </p>
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
              Ajukan
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function DecisionDialog({
  row,
  decision,
  onClose,
  onDone,
}: {
  row: Correction;
  decision: 'APPROVED' | 'REJECTED';
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const approve = decision === 'APPROVED';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/attendance-corrections/${row.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, note }),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog title={`${approve ? 'Setujui' : 'Tolak'} koreksi ${row.employee.fullName}?`} onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-slate-700">
          {row.date.slice(0, 10)} · {TYPE_LABEL[row.type]} ({row.clockIn ? `${row.clockIn} – ${row.clockOut}` : `pulang ${row.clockOut}`}).
          {approve ? ' Absen hari itu akan dilengkapi dengan jam ini.' : ''}
        </p>
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Catatan {approve ? '(opsional)' : 'untuk pengaju'}</span>
          <textarea
            required={!approve}
            maxLength={500}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-amber-500"
          />
        </label>
        {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 font-medium text-white disabled:opacity-50 ${
              approve ? 'bg-slate-900 hover:bg-slate-800' : 'bg-rose-700 hover:bg-rose-800'
            }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {approve ? 'Setujui' : 'Tolak'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
