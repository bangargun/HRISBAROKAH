'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';

interface Holiday {
  id: string;
  date: string;
  name: string;
}

// Sama dengan @Roles POST/DELETE /holidays di backend
const EDITORS = ['SUPER_ADMIN', 'HR_ADMIN'];
const dateFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Daftar libur nasional: tanggal ini memakai jam kerja "Libur nasional" di semua cabang. */
export default function HolidayList() {
  const canEdit = EDITORS.includes(getSessionUser()?.role ?? '');
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await apiFetch<Holiday[]>(`/holidays?year=${year}`));
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await apiFetch('/holidays', { method: 'POST', body: JSON.stringify({ date, name }) });
      setNotice({ kind: 'ok', text: `${name.trim()} ditambahkan.` });
      setDate('');
      setName('');
      if (Number(date.slice(0, 4)) !== year) setYear(Number(date.slice(0, 4)));
      else await load();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(h: Holiday) {
    if (!window.confirm(`Hapus ${h.name} (${h.date}) dari daftar libur nasional?`)) return;
    setNotice(null);
    try {
      await apiFetch(`/holidays/${h.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    }
  }

  return (
    <section className="card" aria-labelledby="holiday-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 id="holiday-heading" className="font-semibold text-slate-900">Libur nasional</h2>
          <p className="text-xs text-slate-500">Tanggal ini memakai jam kerja &quot;Libur nasional&quot; di semua cabang.</p>
        </div>
        <label className="flex items-center gap-2 text-slate-600">
          Tahun
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input w-auto px-2 py-1.5">
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>

      {canEdit && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-4 py-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Tanggal</span>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto px-2 py-1.5" />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Nama libur</span>
            <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Hari Raya Idulfitri" className="input min-w-[12rem] py-1.5" />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="btn btn-secondary"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />} Tambah
          </button>
        </form>
      )}

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`mx-4 mt-3 rounded-md border px-3 py-2 ${
            notice.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 px-4 py-4 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-4 text-slate-600">Belum ada libur nasional untuk tahun {year}.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <p className="text-slate-900">{h.name}</p>
                <p className="text-xs text-slate-500">{dateFmt.format(new Date(`${h.date}T00:00:00Z`))}</p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(h)}
                  aria-label={`Hapus ${h.name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 sm:h-9 sm:w-9"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
