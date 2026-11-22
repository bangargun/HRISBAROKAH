'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AdminRequest, REQUEST_TYPE_LABEL, RequestType } from '@/lib/requests';
import type { EmployeeRecord } from '@/components/EmployeeDialog';
import { flagClass, flagLabel, flagsOf } from '@/lib/attendanceFlags';

interface AttendanceRow {
  employeeId: string;
  source?: 'MOBILE' | 'TABLET';
  isGuest?: boolean;
  flags?: string[];
  /** Dikirim backend bersama baris absen; dipakai untuk kru tamu yang bukan karyawan cabang ini */
  employee?: Pick<EmployeeRecord, 'id' | 'nik' | 'fullName' | 'user' | 'outlet' | 'position'>;
  clockInTime: string | null;
  clockOutTime: string | null;
  clockInDistanceM: number | null;
  clockOutDistanceM: number | null;
  status: string;
  lateMinutes: number;
  notes: string | null;
  scheduleId: string | null;
  outlet: { name: string; geofenceRadius: number; breakLimitMins: number };
  breaks: { startBreak: string; endBreak: string | null; isOverLimit: boolean }[];
}

interface ScheduleRow {
  employeeId: string;
  startTime: string;
  endTime: string;
}

interface OutletOption {
  id: string;
  name: string;
}

type Status = 'LATE' | 'ABSENT' | 'NOT_YET' | 'PRESENT' | 'LEAVE' | 'OFF';

interface Row {
  employee: EmployeeRecord;
  schedule: ScheduleRow | undefined;
  attendance: AttendanceRow | undefined;
  leave: AdminRequest | undefined;
  status: Status;
  breakMins: number;
  breakOpen: boolean;
  breakOver: boolean;
}

// Cuti, izin dan sakit yang disetujui menutup kewajiban hadir hari itu
const ABSENCE_TYPES: RequestType[] = ['CUTI_TAHUNAN', 'CUTI_KHUSUS', 'IZIN', 'SAKIT'];
const STATUS_ORDER: Status[] = ['ABSENT', 'LATE', 'NOT_YET', 'PRESENT', 'LEAVE', 'OFF'];
const STATUS_STYLE: Record<Status, string> = {
  ABSENT: 'bg-rose-50 text-rose-800 border-rose-200',
  LATE: 'bg-amber-50 text-amber-800 border-amber-200',
  NOT_YET: 'bg-slate-50 text-slate-700 border-slate-200',
  PRESENT: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  LEAVE: 'bg-sky-50 text-sky-800 border-sky-200',
  OFF: 'bg-slate-50 text-slate-500 border-slate-200',
};

function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const timeFmt = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });
const hhmm = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : '');
const minutesBetween = (from: string, to: string | null) =>
  Math.max(0, Math.round(((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 60_000));

const sourceLabel = (a: AttendanceRow) => (a.source === 'TABLET' ? 'Tablet' : 'HP');

function statusLabel(r: Row) {
  switch (r.status) {
    case 'LATE':
      return `Terlambat ${r.attendance!.lateMinutes} mnt`;
    case 'ABSENT':
      return 'Tidak hadir';
    case 'NOT_YET':
      return 'Belum absen';
    case 'PRESENT':
      return 'Hadir';
    case 'LEAVE':
      return REQUEST_TYPE_LABEL[r.leave!.type];
    case 'OFF':
      return 'Libur';
  }
}

/**
 * Presensi satu hari per cabang, dari data asli: jadwal kerja, absen masuk/pulang,
 * istirahat, dan cuti/izin/sakit yang sudah disetujui.
 */
export default function DailyAttendanceModule({ requests }: { requests: AdminRequest[] }) {
  const today = localYmd();
  const [date, setDate] = useState(today);
  const [outletId, setOutletId] = useState('');
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [data, setData] = useState<{ employees: EmployeeRecord[]; attendance: AttendanceRow[]; schedules: ScheduleRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<OutletOption[]>('/outlets').then(setOutlets).catch(() => setOutlets([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const outletQ = outletId ? `&outletId=${outletId}` : '';
      const [employees, attendance, schedules] = await Promise.all([
        apiFetch<EmployeeRecord[]>(`/employees${outletId ? `?outletId=${outletId}` : ''}`),
        apiFetch<AttendanceRow[]>(`/attendance/admin/daily-report?date=${date}${outletQ}`),
        apiFetch<ScheduleRow[]>(`/schedules?from=${date}&to=${date}${outletQ}`),
      ]);
      setData({ employees, attendance, schedules });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date, outletId]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo<Row[] | null>(() => {
    if (!data) return null;
    const attendanceOf = new Map(data.attendance.map((a) => [a.employeeId, a]));
    const scheduleOf = new Map(data.schedules.map((s) => [s.employeeId, s]));
    const leaveOf = new Map(
      requests
        .filter(
          (r) =>
            r.status === 'APPROVED' &&
            ABSENCE_TYPES.includes(r.type) &&
            r.startDate &&
            localYmd(new Date(r.startDate)) <= date &&
            localYmd(new Date(r.endDate ?? r.startDate)) >= date,
        )
        .map((r) => [r.employee.id, r]),
    );
    // Kru tamu: absen tercatat di cabang ini, tetapi karyawannya terdaftar di cabang lain
    const known = new Set(data.employees.map((e) => e.id));
    const guests = data.attendance
      .filter((a) => a.employee && !known.has(a.employeeId))
      .map((a) => a.employee as EmployeeRecord);
    return [...data.employees, ...guests]
      // Karyawan nonaktif tetap tampil bila hari itu tercatat absen
      .filter((e) => e.user.isActive || attendanceOf.has(e.id))
      .map((employee) => {
        const attendance = attendanceOf.get(employee.id);
        const schedule = scheduleOf.get(employee.id);
        const leave = leaveOf.get(employee.id);
        const clockedIn = !!attendance?.clockInTime;
        const status: Status = clockedIn
          ? attendance!.status === 'LATE'
            ? 'LATE'
            : 'PRESENT'
          : leave
            ? 'LEAVE'
            : schedule
              ? date < today
                ? 'ABSENT'
                : 'NOT_YET'
              : 'OFF';
        const breaks = attendance?.breaks ?? [];
        const breakMins = breaks.reduce((n, b) => n + minutesBetween(b.startBreak, b.endBreak), 0);
        const limit = attendance?.outlet.breakLimitMins ?? 60;
        return {
          employee,
          schedule,
          attendance,
          leave,
          status,
          breakMins,
          breakOpen: breaks.some((b) => !b.endBreak),
          breakOver: breaks.some((b) => b.isOverLimit) || breakMins > limit,
        };
      })
      .sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          a.employee.fullName.localeCompare(b.employee.fullName),
      );
  }, [data, requests, date, today]);

  const count = (...s: Status[]) => rows?.filter((r) => s.includes(r.status)).length ?? 0;
  // Yang wajib hadir: dijadwalkan dan tidak cuti
  const expected = rows?.filter((r) => r.schedule && r.status !== 'LEAVE') ?? [];
  const attended = expected.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const rate = expected.length ? Math.round((attended / expected.length) * 1000) / 10 : null;
  const unscheduledIn = rows?.filter((r) => !r.schedule && !r.attendance?.scheduleId && (r.status === 'PRESENT' || r.status === 'LATE')).length ?? 0;

  function exportCsv() {
    if (!rows) return;
    const header = ['Tanggal', 'Nama', 'NIK', 'Cabang', 'Jadwal', 'Masuk', 'Pulang', 'Terlambat (mnt)', 'Istirahat (mnt)', 'Status', 'Sumber', 'Penanda'];
    const lines = rows.map((r) => [
      date,
      r.employee.fullName,
      r.employee.nik,
      r.employee.outlet.name,
      r.schedule ? `${r.schedule.startTime}-${r.schedule.endTime}` : 'Libur',
      hhmm(r.attendance?.clockInTime ?? null),
      hhmm(r.attendance?.clockOutTime ?? null),
      r.attendance?.lateMinutes ?? '',
      r.attendance ? r.breakMins : '',
      statusLabel(r),
      r.attendance ? sourceLabel(r.attendance) : '',
      r.attendance ? flagsOf(r.attendance.flags, r.attendance.isGuest).map(flagLabel).join('; ') : '',
    ]);
    const csv = [header, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `presensi-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats: [string, string, string?][] = [
    ['Tingkat kehadiran', rate === null ? '–' :`${rate}%`, `${attended} dari ${expected.length} yang wajib hadir`],
    ['Terlambat', String(count('LATE'))],
    [date < today ? 'Tidak hadir' : 'Belum absen', String(count('ABSENT', 'NOT_YET'))],
    ['Cuti / izin / sakit', String(count('LEAVE'))],
  ];

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-slate-600">Tanggal</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="input w-auto py-1.5"
            />
          </label>
          {outlets.length > 1 && (
            <>
              <label className="sr-only" htmlFor="att-outlet">Cabang</label>
              <select
                id="att-outlet"
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
                className="input w-auto"
              >
                <option value="">Semua cabang</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden /> Muat ulang
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!rows?.length}
            className="btn btn-secondary"
          >
            <Download className="h-4 w-4" aria-hidden /> Unduh CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([label, value, hint]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-0.5 text-xl font-semibold text-slate-900">{rows ? value : '…'}</p>
            {hint && rows && <p className="text-xs text-slate-500">{hint}</p>}
          </div>
        ))}
      </div>
      {unscheduledIn > 0 && (
        <p className="text-xs text-slate-500">
          {unscheduledIn} karyawan absen di luar jadwal (tidak dijadwalkan masuk hari ini); tidak dihitung dalam tingkat kehadiran.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {error ? (
          <p role="alert" className="p-10 text-center text-rose-700">Gagal memuat presensi: {error}</p>
        ) : rows === null ? (
          <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat presensi…
          </p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada karyawan aktif di cabang ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="table-head">
                  <th scope="col" className="px-4 py-3">Karyawan</th>
                  <th scope="col" className="px-4 py-3">Jadwal</th>
                  <th scope="col" className="px-4 py-3">Masuk</th>
                  <th scope="col" className="px-4 py-3">Pulang</th>
                  <th scope="col" className="px-4 py-3">Istirahat</th>
                  <th scope="col" className="px-4 py-3">Sumber</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const a = r.attendance;
                  const far = (d: number | null) => d !== null && a && d > a.outlet.geofenceRadius;
                  return (
                    <tr key={r.employee.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{r.employee.fullName}</p>
                        <p className="text-xs text-slate-500">{r.employee.position.title} · {r.employee.outlet.name}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
                        {r.schedule ? `${r.schedule.startTime}–${r.schedule.endTime}` : <span className="font-sans text-slate-400">Libur</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-mono text-slate-800">{hhmm(a?.clockInTime ?? null) || '–'}</p>
                        {a?.clockInDistanceM != null && (
                          <p className={`text-xs ${far(a.clockInDistanceM) ? 'font-medium text-rose-700' : 'text-slate-500'}`}>
                            {Math.round(a.clockInDistanceM)} m dari cabang
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-mono text-slate-800">{hhmm(a?.clockOutTime ?? null) || '–'}</p>
                        {a?.clockOutDistanceM != null && (
                          <p className={`text-xs ${far(a.clockOutDistanceM) ? 'font-medium text-rose-700' : 'text-slate-500'}`}>
                            {Math.round(a.clockOutDistanceM)} m dari cabang
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {a && a.breaks.length > 0 ? (
                          <>
                            <p className={r.breakOver ? 'font-medium text-rose-700' : 'text-slate-800'}>
                              {r.breakMins} mnt{r.breakOpen ? ' (sedang)' : ''}
                            </p>
                            <p className="text-xs text-slate-500">batas {a.outlet.breakLimitMins} mnt</p>
                          </>
                        ) : (
                          <span className="text-slate-400">–</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                        {a ? sourceLabel(a) : <span className="text-slate-400">–</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                          {statusLabel(r)}
                        </span>
                        {a?.clockInTime && !r.schedule && !a.scheduleId && <p className="mt-1 text-xs text-slate-500">di luar jadwal</p>}
                        {a && flagsOf(a.flags, a.isGuest).length > 0 && (
                          <div className="mt-1 flex max-w-[16rem] flex-wrap gap-1">
                            {flagsOf(a.flags, a.isGuest).map((f) => (
                              <span key={f} className={flagClass(f)}>{flagLabel(f)}</span>
                            ))}
                          </div>
                        )}
                        {a?.notes?.includes('Koreksi presensi') && <p className="mt-1 text-xs text-slate-500">hasil koreksi</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
