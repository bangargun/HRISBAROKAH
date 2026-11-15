'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { AdminRequest, AdminRequestsStore, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, actionFor } from '@/lib/requests';

interface Employee {
  id: string;
  fullName: string;
  outlet: { name: string };
  position: { title: string };
  user: { isActive: boolean };
}

interface AttendanceRow {
  id: string;
  employeeId: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  clockInLat: number | null;
  clockInDistanceM: number | null;
  clockOutLat: number | null;
  clockOutDistanceM: number | null;
  outlet: { name: string; geofenceRadius: number };
  employee: { fullName: string; outlet: { name: string } };
  breaks: { startBreak: string; endBreak: string | null; isOverLimit: boolean }[];
}

// Sama dengan @Roles laporan harian di attendance.controller.ts
const ATTENDANCE_VIEWERS = ['SUPER_ADMIN', 'HR_ADMIN', 'STORE_MANAGER', 'AREA_MANAGER'];
// Batas istirahat di backend saat ini (attendance.service.ts endBreak)
const BREAK_LIMIT_MINS = 60;

const timeFmt = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const todayFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

// Jam perangkat bisa sedikit berbeda dari server; durasi tidak boleh negatif
function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}

/** Absen masuk/pulang yang lokasinya tidak terkirim atau di luar radius cabang (dicatat, tidak ditolak). */
function locationIssues(rows: AttendanceRow[]) {
  const issues: { key: string; name: string; meta: string; aside: string; warn: boolean }[] = [];
  for (const a of rows) {
    const checks = [
      { label: 'Masuk', at: a.clockInTime, lat: a.clockInLat, dist: a.clockInDistanceM },
      { label: 'Pulang', at: a.clockOutTime, lat: a.clockOutLat, dist: a.clockOutDistanceM },
    ];
    for (const c of checks) {
      if (!c.at) continue;
      const time = timeFmt.format(new Date(c.at));
      if (c.lat === null || c.dist === null) {
        issues.push({ key: a.id + c.label, name: a.employee.fullName, meta: `${c.label} ${time} · ${a.outlet.name}`, aside: 'Lokasi tidak terkirim', warn: false });
      } else if (c.dist > a.outlet.geofenceRadius) {
        issues.push({
          key: a.id + c.label,
          name: a.employee.fullName,
          meta: `${c.label} ${time} · ${a.outlet.name} (radius ${a.outlet.geofenceRadius} m)`,
          aside: `${formatDistance(c.dist)} dari cabang`,
          warn: true,
        });
      }
    }
  }
  return issues;
}

function minutesSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function requestDetail(r: AdminRequest) {
  if (r.kasbonLoan) return rupiah.format(Number(r.kasbonLoan.amount));
  if (!r.startDate) return '-';
  const start = dateFmt.format(new Date(r.startDate));
  return r.totalDays && r.totalDays > 1 ? `${start}, ${r.totalDays} hari` : start;
}

interface Props {
  requests: AdminRequestsStore;
  /** Membuka modul lain di halaman admin, opsional langsung ke sub-tab tertentu. */
  onOpen: (menu: string, subTab?: string) => void;
}

export default function DashboardHome({ requests, onOpen }: Props) {
  const role = getSessionUser()?.role;
  const canSeeAttendance = !!role && ATTENDANCE_VIEWERS.includes(role);

  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emp, att] = await Promise.all([
        apiFetch<Employee[]>('/employees'),
        canSeeAttendance ? apiFetch<AttendanceRow[]>('/attendance/admin/daily-report') : Promise.resolve(null),
      ]);
      setEmployees(emp);
      setAttendance(att);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [canSeeAttendance]);

  useEffect(() => {
    load();
  }, [load]);

  const awaitingMe = requests.requests.filter((r) => actionFor(r, role));

  const today = useMemo(() => {
    if (!employees) return null;
    const active = employees.filter((e) => e.user.isActive);
    if (!attendance) return { active, present: [], absent: [], onBreak: [], overLimit: 0 };
    const clockedIn = new Set(attendance.filter((a) => a.clockInTime).map((a) => a.employeeId));
    const onBreak = attendance
      .map((a) => ({ row: a, open: a.breaks.find((b) => !b.endBreak) }))
      .filter((x): x is { row: AttendanceRow; open: AttendanceRow['breaks'][number] } => !!x.open)
      .map(({ row, open }) => ({ row, mins: minutesSince(open.startBreak) }))
      .sort((a, b) => b.mins - a.mins);
    const overLimit =
      attendance.reduce((n, a) => n + a.breaks.filter((b) => b.isOverLimit).length, 0) +
      onBreak.filter((b) => b.mins > BREAK_LIMIT_MINS).length;
    return {
      active,
      present: active.filter((e) => clockedIn.has(e.id)),
      absent: active.filter((e) => !clockedIn.has(e.id)),
      onBreak,
      overLimit,
    };
  }, [employees, attendance]);

  const stats: { label: string; value: string; hint?: string; onClick?: () => void; tone?: 'warn' }[] = [
    {
      label: 'Menunggu tindakan Anda',
      value: requests.loading && requests.requests.length === 0 ? '…' : String(awaitingMe.length),
      hint: 'pengajuan',
      onClick: () => onOpen('requests'),
      tone: awaitingMe.length ? 'warn' : undefined,
    },
    ...(canSeeAttendance
      ? [
          {
            label: 'Sudah absen hari ini',
            value: today ? String(today.present.length) : '…',
            hint: today ? `dari ${today.active.length} karyawan aktif` : undefined,
            onClick: () => onOpen('attendance', 'daily-timesheet'),
          },
          {
            label: 'Belum absen',
            value: today ? String(today.absent.length) : '…',
            hint: 'termasuk yang libur',
          },
          {
            label: 'Istirahat lewat batas',
            value: today ? String(today.overLimit) : '…',
            hint: `batas ${BREAK_LIMIT_MINS} menit`,
            onClick: () => onOpen('attendance', 'break-tracker'),
            tone: today?.overLimit ? ('warn' as const) : undefined,
          },
        ]
      : [
          {
            label: 'Karyawan aktif',
            value: today ? String(today.active.length) : '…',
            onClick: () => onOpen('employees'),
          },
        ]),
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{todayFmt.format(new Date())}</p>
        <button
          type="button"
          onClick={() => {
            load();
            requests.reload();
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden /> Muat ulang
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className={`grid grid-cols-2 gap-3 ${stats.length > 2 ? 'lg:grid-cols-4' : ''}`}>
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-sm text-slate-600">{s.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone === 'warn' ? 'text-amber-700' : 'text-slate-900'}`}>
                {s.value}
              </p>
              {s.hint && <p className="text-xs text-slate-500">{s.hint}</p>}
            </>
          );
          const cls = 'rounded-lg border border-slate-200 bg-white p-4 text-left';
          return s.onClick ? (
            <button key={s.label} type="button" onClick={s.onClick} className={`${cls} hover:border-slate-300 hover:bg-slate-50`}>
              {body}
            </button>
          ) : (
            <div key={s.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white" aria-labelledby="dash-awaiting">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 id="dash-awaiting" className="text-sm font-semibold text-slate-900">
                Perlu tindakan Anda
              </h2>
              <button
                type="button"
                onClick={() => onOpen('requests')}
                className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:underline"
              >
                Buka Persetujuan <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {requests.loading && requests.requests.length === 0 ? (
              <PanelLoading />
            ) : requests.error && requests.requests.length === 0 ? (
              <p role="alert" className="p-4 text-sm text-rose-800">{requests.error}</p>
            ) : awaitingMe.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">Tidak ada pengajuan yang menunggu keputusan Anda.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sr-only">
                  <tr>
                    <th>Karyawan</th>
                    <th>Pengajuan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {awaitingMe.slice(0, 6).map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{r.employee.fullName}</p>
                        <p className="text-xs text-slate-500">{r.employee.outlet.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{REQUEST_TYPE_LABEL[r.type]}</p>
                        <p className="text-xs text-slate-500">{requestDetail(r)}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-slate-600 sm:table-cell">{REQUEST_STATUS_LABEL[r.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {awaitingMe.length > 6 && (
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                dan {awaitingMe.length - 6} pengajuan lainnya
              </p>
            )}
          </section>

          {canSeeAttendance && (
            <PeoplePanel
              title="Lokasi absen perlu dicek"
              note="Absen tetap diterima. Daftar ini memuat absen di luar radius cabang atau yang lokasinya tidak terkirim."
              loading={!attendance && loading}
              empty="Semua absen hari ini tercatat di dalam radius cabang."
              rows={attendance ? locationIssues(attendance) : []}
            />
          )}
        </div>

        {canSeeAttendance ? (
          <div className="space-y-6">
            <PeoplePanel
              title="Sedang istirahat"
              loading={!today}
              empty="Tidak ada yang sedang istirahat."
              rows={(today?.onBreak ?? []).map(({ row, mins }) => ({
                key: row.id,
                name: row.employee.fullName,
                meta: row.employee.outlet.name,
                aside: `${mins} menit`,
                warn: mins > BREAK_LIMIT_MINS,
              }))}
            />
            <PeoplePanel
              title="Belum absen hari ini"
              note="Jadwal kerja belum tercatat di sistem, jadi daftar ini ikut memuat karyawan yang libur."
              loading={!today}
              empty="Semua karyawan aktif sudah absen."
              rows={(today?.absent ?? []).map((e) => ({ key: e.id, name: e.fullName, meta: e.outlet.name }))}
              onMore={() => onOpen('attendance', 'daily-timesheet')}
            />
          </div>
        ) : (
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Data presensi harian hanya tersedia untuk HR, Area Manager dan Kepala Cabang.
          </section>
        )}
      </div>
    </div>
  );
}

function PanelLoading() {
  return (
    <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
    </div>
  );
}

const PEOPLE_LIMIT = 6;

function PeoplePanel({
  title,
  note,
  loading,
  empty,
  rows,
  onMore,
}: {
  title: string;
  note?: string;
  loading: boolean;
  empty: string;
  rows: { key: string; name: string; meta: string; aside?: string; warn?: boolean }[];
  onMore?: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {title}
          {!loading && <span className="ml-1.5 font-normal text-slate-500">({rows.length})</span>}
        </h2>
        {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
      </div>
      {loading ? (
        <PanelLoading />
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.slice(0, PEOPLE_LIMIT).map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-900">{r.name}</p>
                <p className="truncate text-xs text-slate-500">{r.meta}</p>
              </div>
              {r.aside && (
                <span className={`shrink-0 text-xs tabular-nums ${r.warn ? 'font-medium text-rose-700' : 'text-slate-600'}`}>
                  {r.aside}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {rows.length > PEOPLE_LIMIT && (
        <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          {onMore ? (
            <button type="button" onClick={onMore} className="font-medium text-amber-700 hover:underline">
              Lihat {rows.length - PEOPLE_LIMIT} lainnya
            </button>
          ) : (
            `dan ${rows.length - PEOPLE_LIMIT} lainnya`
          )}
        </div>
      )}
    </section>
  );
}
