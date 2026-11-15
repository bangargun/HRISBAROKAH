'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Lock, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';

interface OutletOption {
  id: string;
  name: string;
}

interface ShiftOption {
  id: string;
  outletId: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface Employee {
  id: string;
  fullName: string;
  outletId: string;
  position: { title: string };
  user: { isActive: boolean };
}

interface ScheduleRow {
  employeeId: string;
  shiftId: string;
  date: string;
  locked: boolean;
}

// Sama dengan @Roles PUT /schedules di backend
const EDITORS = ['SUPER_ADMIN', 'HR_ADMIN', 'AREA_MANAGER', 'STORE_MANAGER'];
const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const OFF = '';

const dayFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const rangeFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Tanggal YYYY-MM-DD dihitung dalam UTC agar penambahan hari tidak bergeser karena zona waktu. */
function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(ymd: string) {
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = Minggu
  return addDays(ymd, day === 0 ? -6 : 1 - day);
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const cellKey = (employeeId: string, date: string) => `${employeeId}|${date}`;

export default function WorkScheduleModule() {
  const role = getSessionUser()?.role ?? '';
  const canEdit = EDITORS.includes(role);

  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [outletId, setOutletId] = useState('');
  const [weekStart, setWeekStart] = useState(() => mondayOf(localToday()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [saved, setSaved] = useState<Map<string, ScheduleRow>>(new Map());
  const [draft, setDraft] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = localToday();

  // Daftar cabang sekali di awal; Kepala Cabang otomatis hanya mendapat cabangnya
  useEffect(() => {
    apiFetch<OutletOption[]>('/outlets')
      .then((list) => {
        setOutlets(list);
        setOutletId((current) => current || list[0]?.id || '');
        if (list.length === 0) setLoading(false);
      })
      .catch((e) => {
        setNotice({ kind: 'error', text: (e as Error).message });
        setLoading(false);
      });
  }, []);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const [emp, sh, sched] = await Promise.all([
        apiFetch<Employee[]>(`/employees?outletId=${outletId}`),
        apiFetch<ShiftOption[]>(`/shifts?outletId=${outletId}`),
        apiFetch<ScheduleRow[]>(`/schedules?outletId=${outletId}&from=${days[0]}&to=${days[6]}`),
      ]);
      setEmployees(emp.filter((e) => e.user.isActive));
      setShifts(sh);
      setSaved(new Map(sched.map((s) => [cellKey(s.employeeId, s.date), s])));
      setDraft(new Map());
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [outletId, days]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = draft.size > 0;

  function confirmDiscard() {
    return !dirty || window.confirm('Perubahan jadwal belum disimpan. Buang perubahan?');
  }

  function valueOf(employeeId: string, date: string) {
    const key = cellKey(employeeId, date);
    return draft.has(key) ? draft.get(key)! : saved.get(key)?.shiftId ?? OFF;
  }

  function setCell(employeeId: string, date: string, value: string) {
    const key = cellKey(employeeId, date);
    const original = saved.get(key)?.shiftId ?? OFF;
    const next = new Map(draft);
    if (value === original) next.delete(key);
    else next.set(key, value);
    setDraft(next);
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const entries = Array.from(draft.entries()).map(([key, shiftId]) => {
        const [employeeId, date] = key.split('|');
        return { employeeId, date, shiftId: shiftId || null };
      });
      await apiFetch('/schedules', { method: 'PUT', body: JSON.stringify({ entries }) });
      setNotice({ kind: 'ok', text: `${entries.length} perubahan jadwal disimpan.` });
      await load();
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  // Jam di depan: bila teks terpotong di sel sempit, yang hilang namanya, bukan jamnya
  const shiftLabel = (s: ShiftOption) => `${s.startTime}–${s.endTime} ${s.name}`;
  const workingCount = (date: string) => employees.filter((e) => valueOf(e.id, date) !== OFF).length;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="schedule-outlet">
            Cabang
          </label>
          <select
            id="schedule-outlet"
            value={outletId}
            onChange={(e) => {
              if (confirmDiscard()) setOutletId(e.target.value);
            }}
            disabled={outlets.length <= 1}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-800 disabled:bg-slate-50"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <div className="flex items-center rounded-md border border-slate-300 bg-white">
            <button
              type="button"
              aria-label="Minggu sebelumnya"
              onClick={() => confirmDiscard() && setWeekStart(addDays(weekStart, -7))}
              className="p-2 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-[13rem] px-2 text-center font-medium text-slate-800">
              {dayFmt.format(new Date(`${days[0]}T00:00:00Z`))} – {rangeFmt.format(new Date(`${days[6]}T00:00:00Z`))}
            </span>
            <button
              type="button"
              aria-label="Minggu berikutnya"
              onClick={() => confirmDiscard() && setWeekStart(addDays(weekStart, 7))}
              className="p-2 text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {weekStart !== mondayOf(today) && (
            <button
              type="button"
              onClick={() => confirmDiscard() && setWeekStart(mondayOf(today))}
              className="rounded-md px-2 py-2 font-medium text-amber-700 hover:underline"
            >
              Minggu ini
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => confirmDiscard() && load()}
            disabled={loading}
            aria-label="Muat ulang"
            className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
          {canEdit && (
            <>
              {dirty && (
                <button
                  type="button"
                  onClick={() => setDraft(new Map())}
                  className="rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
                >
                  Batalkan
                </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Simpan{dirty ? ` (${draft.size})` : ''}
              </button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-md border px-3 py-2 ${
            notice.kind === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && employees.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat jadwal…
          </div>
        ) : outlets.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada cabang aktif.</p>
        ) : shifts.length === 0 ? (
          <p className="p-10 text-center text-slate-600">
            Cabang ini belum punya shift. Buat shift lebih dulu di menu Cabang → Shift.
          </p>
        ) : employees.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada karyawan aktif di cabang ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-medium">
                    Karyawan
                  </th>
                  {days.map((d, i) => (
                    <th
                      key={d}
                      scope="col"
                      className={`min-w-[9.5rem] px-2 py-3 font-medium ${d === today ? 'text-amber-800' : ''}`}
                    >
                      {DAY_NAMES[i]}, {dayFmt.format(new Date(`${d}T00:00:00Z`))}
                      {d === today && <span className="ml-1 text-[11px]">(hari ini)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-normal">
                      <p className="font-medium text-slate-900">{emp.fullName}</p>
                      <p className="text-xs text-slate-500">{emp.position.title}</p>
                    </th>
                    {days.map((d) => {
                      const key = cellKey(emp.id, d);
                      const locked = saved.get(key)?.locked ?? false;
                      const changed = draft.has(key);
                      const value = valueOf(emp.id, d);
                      return (
                        <td key={d} className="px-2 py-2">
                          <div className="relative">
                            <select
                              aria-label={`Jadwal ${emp.fullName} ${dayFmt.format(new Date(`${d}T00:00:00Z`))}`}
                              value={value}
                              disabled={!canEdit || locked}
                              onChange={(e) => setCell(emp.id, d, e.target.value)}
                              title={locked ? 'Sudah dipakai absen, tidak bisa diubah' : undefined}
                              className={`w-full rounded-md border px-2 py-1.5 text-xs ${
                                changed
                                  ? 'border-amber-500 bg-amber-50 text-slate-900'
                                  : value === OFF
                                    ? 'border-slate-200 bg-slate-50 text-slate-500'
                                    : 'border-slate-300 bg-white text-slate-900'
                              } disabled:cursor-not-allowed disabled:opacity-80 ${locked ? 'pr-6' : ''}`}
                            >
                              <option value={OFF}>Libur</option>
                              {shifts.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {shiftLabel(s)}
                                </option>
                              ))}
                            </select>
                            {locked && (
                              <Lock
                                className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500"
                                aria-label="Terkunci"
                              />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th scope="row" className="sticky left-0 bg-slate-50 px-4 py-2 text-left font-medium">
                    Masuk
                  </th>
                  {days.map((d) => (
                    <td key={d} className="px-2 py-2 tabular-nums">
                      {workingCount(d)} dari {employees.length}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      {canEdit && (
        <p className="text-xs text-slate-500">
          Sel yang diubah ditandai kuning sampai disimpan. Jadwal yang sudah dipakai absen dikunci agar catatan
          keterlambatan tidak berubah.
        </p>
      )}
    </div>
  );
}
