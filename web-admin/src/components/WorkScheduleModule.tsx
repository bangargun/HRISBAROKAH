'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Lock, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';

type DayType = 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';

interface OutletOption {
  id: string;
  name: string;
  weekdayWorkStart: string;
  weekdayWorkEnd: string;
  weekendWorkStart: string;
  weekendWorkEnd: string;
  holidayWorkStart: string;
  holidayWorkEnd: string;
}

interface Employee {
  id: string;
  fullName: string;
  position: { title: string };
  user: { isActive: boolean };
}

interface ScheduleRow {
  employeeId: string;
  date: string;
  locked: boolean;
}

interface Holiday {
  date: string;
  name: string;
}

// Sama dengan @Roles PUT /schedules di backend
const EDITORS = ['SUPER_ADMIN', 'HR_ADMIN', 'AREA_MANAGER', 'STORE_MANAGER'];
const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DAY_TYPE_LABEL: Record<DayType, string> = { WEEKDAY: 'Weekday', WEEKEND: 'Weekend', HOLIDAY: 'Libur nasional' };

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

/** Sama dengan backend work-hours.util: libur nasional, lalu Sabtu-Minggu, selain itu weekday. */
function dayTypeOf(ymd: string, holidays: Map<string, string>): DayType {
  if (holidays.has(ymd)) return 'HOLIDAY';
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY';
}

function hoursOf(outlet: OutletOption, type: DayType) {
  if (type === 'HOLIDAY') return `${outlet.holidayWorkStart}–${outlet.holidayWorkEnd}`;
  if (type === 'WEEKEND') return `${outlet.weekendWorkStart}–${outlet.weekendWorkEnd}`;
  return `${outlet.weekdayWorkStart}–${outlet.weekdayWorkEnd}`;
}

const cellKey = (employeeId: string, date: string) => `${employeeId}|${date}`;

export default function WorkScheduleModule() {
  const canEdit = EDITORS.includes(getSessionUser()?.role ?? '');

  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [outletId, setOutletId] = useState('');
  const [weekStart, setWeekStart] = useState(() => mondayOf(localToday()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saved, setSaved] = useState<Map<string, ScheduleRow>>(new Map());
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  // Perubahan yang belum disimpan: true = masuk, false = libur
  const [draft, setDraft] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = localToday();
  const outlet = outlets.find((o) => o.id === outletId);

  useEffect(() => {
    apiFetch<OutletOption[]>('/outlets')
      .then((list) => {
        setOutlets(list);
        setOutletId((c) => c || list[0]?.id || '');
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
      const years = Array.from(new Set(days.map((d) => d.slice(0, 4))));
      const [emp, sched, ...hol] = await Promise.all([
        apiFetch<Employee[]>(`/employees?outletId=${outletId}`),
        apiFetch<ScheduleRow[]>(`/schedules?outletId=${outletId}&from=${days[0]}&to=${days[6]}`),
        ...years.map((y) => apiFetch<Holiday[]>(`/holidays?year=${y}`)),
      ]);
      setEmployees((emp as Employee[]).filter((e) => e.user.isActive));
      setSaved(new Map((sched as ScheduleRow[]).map((s) => [cellKey(s.employeeId, s.date), s])));
      setHolidays(new Map((hol as Holiday[][]).flat().map((h) => [h.date, h.name])));
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
  const confirmDiscard = () => !dirty || window.confirm('Perubahan jadwal belum disimpan. Buang perubahan?');

  function isWorking(employeeId: string, date: string) {
    const key = cellKey(employeeId, date);
    return draft.has(key) ? draft.get(key)! : saved.has(key);
  }

  function toggle(employeeId: string, date: string) {
    const key = cellKey(employeeId, date);
    const next = new Map(draft);
    const value = !isWorking(employeeId, date);
    if (value === saved.has(key)) next.delete(key);
    else next.set(key, value);
    setDraft(next);
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const entries = Array.from(draft.entries()).map(([key, working]) => {
        const [employeeId, date] = key.split('|');
        return { employeeId, date, working };
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

  const workingCount = (date: string) => employees.filter((e) => isWorking(e.id, date)).length;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="schedule-outlet">Cabang</label>
          <select
            id="schedule-outlet"
            value={outletId}
            onChange={(e) => {
              if (confirmDiscard()) setOutletId(e.target.value);
            }}
            disabled={outlets.length <= 1}
            className="input w-auto font-medium"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <div className="flex items-center rounded-md border border-slate-300 bg-white">
            <button type="button" aria-label="Minggu sebelumnya" onClick={() => confirmDiscard() && setWeekStart(addDays(weekStart, -7))} className="flex h-11 w-11 items-center justify-center rounded-l-md text-slate-600 hover:bg-slate-50 active:bg-slate-100 sm:h-9 sm:w-9">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-[13rem] px-2 text-center font-medium text-slate-800">
              {dayFmt.format(new Date(`${days[0]}T00:00:00Z`))} – {rangeFmt.format(new Date(`${days[6]}T00:00:00Z`))}
            </span>
            <button type="button" aria-label="Minggu berikutnya" onClick={() => confirmDiscard() && setWeekStart(addDays(weekStart, 7))} className="flex h-11 w-11 items-center justify-center rounded-r-md text-slate-600 hover:bg-slate-50 active:bg-slate-100 sm:h-9 sm:w-9">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {weekStart !== mondayOf(today) && (
            <button type="button" onClick={() => confirmDiscard() && setWeekStart(mondayOf(today))} className="link inline-flex min-h-11 items-center rounded-md px-2 sm:min-h-9">
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
            className="btn btn-secondary w-11 px-0 text-slate-600 sm:w-9"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
          {canEdit && (
            <>
              {dirty && (
                <button type="button" onClick={() => setDraft(new Map())} className="btn btn-ghost">
                  Batalkan
                </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="btn btn-primary"
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
            notice.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="card overflow-hidden">
        {loading && employees.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat jadwal…
          </div>
        ) : outlets.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada cabang aktif. Tambahkan cabang di menu Cabang.</p>
        ) : employees.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada karyawan aktif di cabang ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-medium">Karyawan</th>
                  {days.map((d, i) => {
                    const type = dayTypeOf(d, holidays);
                    return (
                      <th key={d} scope="col" className={`min-w-[7.5rem] px-2 py-2 align-top font-medium ${d === today ? 'text-brand-700' : ''}`}>
                        <p>
                          {DAY_NAMES[i]}, {dayFmt.format(new Date(`${d}T00:00:00Z`))}
                          {d === today && <span className="ml-1 font-normal">(hari ini)</span>}
                        </p>
                        <p className={`font-normal ${type === 'HOLIDAY' ? 'text-rose-700' : 'text-slate-500'}`} title={holidays.get(d)}>
                          {DAY_TYPE_LABEL[type]}
                          {outlet ? ` ${hoursOf(outlet, type)}` : ''}
                        </p>
                      </th>
                    );
                  })}
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
                      const working = isWorking(emp.id, d);
                      const changed = draft.has(key);
                      return (
                        <td key={d} className="px-2 py-2">
                          <button
                            type="button"
                            aria-pressed={working}
                            aria-label={`${emp.fullName} ${dayFmt.format(new Date(`${d}T00:00:00Z`))}: ${working ? 'masuk' : 'libur'}`}
                            disabled={!canEdit || locked}
                            onClick={() => toggle(emp.id, d)}
                            title={locked ? 'Sudah absen, tidak bisa dijadikan libur' : undefined}
                            className={`inline-flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                              changed
                                ? 'border-brand-500 bg-brand-50 text-slate-900'
                                : working
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-500'
                            }`}
                          >
                            {locked && <Lock className="h-3 w-3" aria-hidden />}
                            {working ? 'Masuk' : 'Libur'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th scope="row" className="sticky left-0 bg-slate-50 px-4 py-2 text-left font-medium">Masuk</th>
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
          Klik sel untuk mengganti Masuk/Libur. Jam masuk mengikuti jam kerja cabang sesuai jenis hari. Sel yang sudah
          dipakai absen dikunci.
        </p>
      )}
    </div>
  );
}
