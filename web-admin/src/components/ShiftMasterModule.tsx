'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Dialog from '@/components/Dialog';
import { Clock, Edit2, Loader2, Moon, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';

interface OutletOption {
  id: string;
  code: string;
  name: string;
}

interface Shift {
  id: string;
  outletId: string;
  name: string;
  startTime: string;
  endTime: string;
  breakLimitMins: number;
  outlet: OutletOption;
  _count: { schedules: number };
}

interface ShiftForm {
  id?: string;
  outletId: string;
  name: string;
  startTime: string;
  endTime: string;
  breakLimitMins: number;
}

// Sama dengan @Roles di backend shifts.controller.ts
const EDITORS = ['SUPER_ADMIN', 'HR_ADMIN', 'AREA_MANAGER'];
const DELETERS = ['SUPER_ADMIN', 'HR_ADMIN'];

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Durasi shift dalam menit; jam selesai yang lebih kecil berarti lewat tengah malam. */
function durationMins(start: string, end: string) {
  const diff = toMinutes(end) - toMinutes(start);
  return diff > 0 ? diff : diff + 24 * 60;
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
}

export default function ShiftMasterModule() {
  const role = getSessionUser()?.role ?? '';
  const canEdit = EDITORS.includes(role);
  const canDelete = DELETERS.includes(role);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outletFilter, setOutletFilter] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState<ShiftForm | null>(null);
  const [deleting, setDeleting] = useState<Shift | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftData, outletData] = await Promise.all([
        apiFetch<Shift[]>('/shifts'),
        apiFetch<OutletOption[]>('/outlets'),
      ]);
      setShifts(shiftData);
      setOutlets(outletData);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (outletFilter ? shifts.filter((s) => s.outletId === outletFilter) : shifts),
    [shifts, outletFilter],
  );

  function openCreate() {
    setNotice(null);
    setForm({
      outletId: outletFilter || outlets[0]?.id || '',
      name: '',
      startTime: '09:00',
      endTime: '17:00',
      breakLimitMins: 60,
    });
  }

  async function save(data: ShiftForm) {
    const { id, outletId, ...fields } = data;
    if (id) {
      await apiFetch(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(fields) });
    } else {
      await apiFetch('/shifts', { method: 'POST', body: JSON.stringify({ outletId, ...fields }) });
    }
    setForm(null);
    setNotice({ kind: 'ok', text: `Shift "${fields.name.trim()}" ${id ? 'diperbarui' : 'ditambahkan'}.` });
    await load();
  }

  async function confirmDelete(shift: Shift) {
    setDeleting(null);
    try {
      await apiFetch(`/shifts/${shift.id}`, { method: 'DELETE' });
      setNotice({ kind: 'ok', text: `Shift "${shift.name}" dihapus.` });
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-slate-100 text-slate-600 rounded-md mt-0.5">
            <Clock className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Master Shift Kerja per Outlet</h3>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
              Setiap shift punya jam mulai, jam selesai dan batas istirahat. Buat shift terpisah bila jam weekend
              berbeda, misalnya &quot;Long Shift Weekday&quot; dan &quot;Long Shift Weekend&quot;.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <label className="sr-only" htmlFor="shift-outlet-filter">
            Saring outlet
          </label>
          <select
            id="shift-outlet-filter"
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
          >
            <option value="">Semua outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Muat ulang"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              disabled={outlets.length === 0}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm"
            >
              <Plus className="h-4 w-4 text-amber-400" aria-hidden />
              Tambah Shift
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
            notice.kind === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        {loadError && shifts.length === 0 ? (
          <div role="alert" className="p-8 text-center text-rose-800 bg-rose-50">
            <p className="font-semibold">{loadError}</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 font-bold hover:bg-rose-100"
            >
              Coba lagi
            </button>
          </div>
        ) : loading && shifts.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat shift…
          </div>
        ) : outlets.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <p className="font-semibold text-slate-700">Belum ada outlet di database.</p>
            <p className="mt-1">Tambahkan outlet lebih dulu, lalu buat shift untuk outlet tersebut.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <p className="font-semibold text-slate-700">Belum ada shift{outletFilter ? ' di outlet ini' : ''}.</p>
            {canEdit && <p className="mt-1">Gunakan tombol &quot;Tambah Shift&quot; untuk membuat shift pertama.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                  <th scope="col" className="py-3 px-4">Outlet</th>
                  <th scope="col" className="py-3 px-4">Nama Shift</th>
                  <th scope="col" className="py-3 px-4">Jam Kerja</th>
                  <th scope="col" className="py-3 px-4">Batas Istirahat</th>
                  <th scope="col" className="py-3 px-4">Dipakai</th>
                  {canEdit && <th scope="col" className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((s) => {
                  const overnight = toMinutes(s.endTime) < toMinutes(s.startTime);
                  const used = s._count.schedules;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-slate-700">{s.outlet.name}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900">
                          {s.startTime} – {s.endTime}
                        </span>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          {formatDuration(durationMins(s.startTime, s.endTime))}
                          {overnight && (
                            <span className="inline-flex items-center gap-0.5 text-indigo-700">
                              <Moon className="h-3 w-3" aria-hidden /> lewat tengah malam
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{s.breakLimitMins} menit</td>
                      <td className="py-3 px-4 text-slate-500">{used ? `${used} jadwal` : 'Belum dipakai'}</td>
                      {canEdit && (
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setNotice(null);
                                setForm({
                                  id: s.id,
                                  outletId: s.outletId,
                                  name: s.name,
                                  startTime: s.startTime,
                                  endTime: s.endTime,
                                  breakLimitMins: s.breakLimitMins,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-bold text-slate-700 hover:bg-slate-50"
                            >
                              <Edit2 className="h-3.5 w-3.5" aria-hidden /> Ubah
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleting(s)}
                                disabled={used > 0}
                                title={used > 0 ? 'Shift yang sudah dipakai jadwal tidak bisa dihapus' : undefined}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:hover:bg-transparent"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Hapus
                              </button>
                            )}
                          </div>
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

      {form && <ShiftFormDialog initial={form} outlets={outlets} onCancel={() => setForm(null)} onSave={save} />}

      {deleting && (
        <Dialog title={`Hapus shift "${deleting.name}"?`} onClose={() => setDeleting(null)}>
          <p className="text-slate-600">
            Shift di {deleting.outlet.name} ini akan dihapus permanen. Shift yang belum pernah dipakai jadwal saja yang
            bisa dihapus.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setDeleting(null)} className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100">
              Batal
            </button>
            <button
              type="button"
              onClick={() => confirmDelete(deleting)}
              className="rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-500"
            >
              Hapus shift
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ShiftFormDialog({
  initial,
  outlets,
  onCancel,
  onSave,
}: {
  initial: ShiftForm;
  outlets: OutletOption[];
  onCancel: () => void;
  onSave: (data: ShiftForm) => Promise<void>;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial.id);
  const same = data.startTime === data.endTime;
  const overnight = !same && toMinutes(data.endTime) < toMinutes(data.startTime);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (same) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...data, name: data.name.trim() });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const field = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:border-amber-500 disabled:opacity-60';

  return (
    <Dialog title={isEdit ? 'Ubah shift' : 'Tambah shift'} onClose={onCancel}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1">
          <span className="font-bold text-slate-600">Outlet</span>
          <select
            required
            value={data.outletId}
            disabled={isEdit}
            onChange={(e) => setData({ ...data, outletId: e.target.value })}
            className={field}
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {isEdit && <span className="text-[10px] text-slate-500">Outlet shift tidak bisa dipindah.</span>}
        </label>
        <label className="block space-y-1">
          <span className="font-bold text-slate-600">Nama shift</span>
          <input
            required
            maxLength={60}
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="Misalnya: Shift Pagi"
            className={field}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="font-bold text-slate-600">Jam mulai</span>
            <input
              type="time"
              required
              value={data.startTime}
              onChange={(e) => setData({ ...data, startTime: e.target.value })}
              className={field}
            />
          </label>
          <label className="block space-y-1">
            <span className="font-bold text-slate-600">Jam selesai</span>
            <input
              type="time"
              required
              value={data.endTime}
              onChange={(e) => setData({ ...data, endTime: e.target.value })}
              className={field}
            />
          </label>
        </div>
        <p className={`text-[11px] ${same ? 'text-rose-700 font-semibold' : 'text-slate-500'}`}>
          {same
            ? 'Jam mulai dan jam selesai tidak boleh sama.'
            : `Durasi ${formatDuration(durationMins(data.startTime, data.endTime))}${overnight ? ', selesai keesokan harinya' : ''}.`}
        </p>
        <label className="block space-y-1">
          <span className="font-bold text-slate-600">Batas istirahat (menit)</span>
          <input
            type="number"
            required
            min={0}
            max={240}
            value={data.breakLimitMins}
            onChange={(e) => setData({ ...data, breakLimitMins: Number(e.target.value) })}
            className={field}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-semibold text-rose-800">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || same}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Simpan shift
          </button>
        </div>
      </form>
    </Dialog>
  );
}
