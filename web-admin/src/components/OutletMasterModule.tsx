'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, ExternalLink, Loader2, Plus, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';
import HolidayList from '@/components/HolidayList';
import OutletDevicesPanel from '@/components/OutletDevicesPanel';

type DayKey = 'weekday' | 'weekend' | 'holiday';

interface Outlet {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  city: string | null;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  wifiBssid: string | null;
  managerId: string | null;
  manager: { id: string; fullName: string } | null;
  weekdayWorkStart: string;
  weekdayWorkEnd: string;
  weekendWorkStart: string;
  weekendWorkEnd: string;
  holidayWorkStart: string;
  holidayWorkEnd: string;
  weekdayOpen: string | null;
  weekdayClose: string | null;
  weekendOpen: string | null;
  weekendClose: string | null;
  holidayOpen: string | null;
  holidayClose: string | null;
  breakLimitMins: number;
  attendanceMode?: 'MOBILE' | 'TABLET';
  payrollCutoffDay: number;
  paydayDay: number;
  isActive: boolean;
  _count: { employees: number };
}

/** Isian form, urutannya sama dengan kolom di tabel. */
type OutletForm = { id?: string } & Record<
  | 'code' | 'name' | 'brand' | 'city' | 'address' | 'managerId'
  | 'weekdayWorkStart' | 'weekdayWorkEnd' | 'weekendWorkStart' | 'weekendWorkEnd' | 'holidayWorkStart' | 'holidayWorkEnd'
  | 'weekdayOpen' | 'weekdayClose' | 'weekendOpen' | 'weekendClose' | 'holidayOpen' | 'holidayClose'
  | 'attendanceMode' | 'breakLimitMins' | 'latitude' | 'longitude' | 'geofenceRadius' | 'wifiBssid' | 'payrollCutoffDay' | 'paydayDay',
  string
>;

interface ManagerOption {
  id: string;
  fullName: string;
  user: { role: string; isActive: boolean };
}

// Sama dengan @Roles di backend outlets.controller.ts
const CREATORS = ['SUPER_ADMIN', 'HR_ADMIN'];
const EDITORS = ['SUPER_ADMIN', 'HR_ADMIN', 'AREA_MANAGER'];
const STATUS_CHANGERS = ['SUPER_ADMIN', 'HR_ADMIN'];

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'weekday', label: 'Weekday (Sen–Jum)' },
  { key: 'weekend', label: 'Weekend (Sab–Min)' },
  { key: 'holiday', label: 'Libur nasional' },
];

const BRANDS = ['Ayam Pecak 2001 Seafood', 'Ayam Bakar Surabaya', 'Pecel Lele Pak Haji'];

const EMPTY_FORM: OutletForm = {
  code: '', name: '', brand: '', city: '', address: '', managerId: '',
  weekdayWorkStart: '09:00', weekdayWorkEnd: '22:00',
  weekendWorkStart: '09:00', weekendWorkEnd: '23:00',
  holidayWorkStart: '09:00', holidayWorkEnd: '23:00',
  weekdayOpen: '10:00', weekdayClose: '22:00',
  weekendOpen: '10:00', weekendClose: '23:00',
  holidayOpen: '10:00', holidayClose: '23:00',
  attendanceMode: 'MOBILE', breakLimitMins: '60', latitude: '', longitude: '', geofenceRadius: '50', wifiBssid: '',
  payrollCutoffDay: '31', paydayDay: '1',
};

function toForm(o: Outlet): OutletForm {
  const s = (v: string | number | null) => (v === null ? '' : String(v));
  return {
    id: o.id, code: o.code, name: o.name, brand: s(o.brand), city: s(o.city), address: o.address, managerId: s(o.managerId),
    weekdayWorkStart: o.weekdayWorkStart, weekdayWorkEnd: o.weekdayWorkEnd,
    weekendWorkStart: o.weekendWorkStart, weekendWorkEnd: o.weekendWorkEnd,
    holidayWorkStart: o.holidayWorkStart, holidayWorkEnd: o.holidayWorkEnd,
    weekdayOpen: s(o.weekdayOpen), weekdayClose: s(o.weekdayClose),
    weekendOpen: s(o.weekendOpen), weekendClose: s(o.weekendClose),
    holidayOpen: s(o.holidayOpen), holidayClose: s(o.holidayClose),
    attendanceMode: o.attendanceMode ?? 'MOBILE', breakLimitMins: s(o.breakLimitMins), latitude: s(o.latitude), longitude: s(o.longitude),
    geofenceRadius: s(o.geofenceRadius), wifiBssid: s(o.wifiBssid),
    payrollCutoffDay: s(o.payrollCutoffDay), paydayDay: s(o.paydayDay),
  };
}

const dayOfMonth = (d: number) => (d === 31 ? 'akhir bulan' : `tgl ${d}`);

export default function OutletMasterModule() {
  const role = getSessionUser()?.role ?? '';
  const canCreate = CREATORS.includes(role);
  const canEdit = EDITORS.includes(role);
  const canChangeStatus = STATUS_CHANGERS.includes(role);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState<OutletForm | null>(null);
  const [toggling, setToggling] = useState<Outlet | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOutlets(await apiFetch<Outlet[]>('/outlets?all=true'));
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

  async function save(data: OutletForm) {
    const { id, code, ...f } = data;
    const body = {
      ...f,
      managerId: f.managerId || null,
      latitude: Number(f.latitude),
      longitude: Number(f.longitude),
      geofenceRadius: Number(f.geofenceRadius),
      breakLimitMins: Number(f.breakLimitMins),
      payrollCutoffDay: Number(f.payrollCutoffDay),
      paydayDay: Number(f.paydayDay),
    };
    if (id) {
      await apiFetch(`/outlets/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      const { managerId, ...createBody } = body;
      await apiFetch('/outlets', { method: 'POST', body: JSON.stringify({ ...createBody, code }) });
    }
    setForm(null);
    setNotice({ kind: 'ok', text: `Cabang "${data.name.trim()}" ${id ? 'diperbarui' : 'ditambahkan'}.` });
    await load();
  }

  async function confirmToggle(outlet: Outlet) {
    setToggling(null);
    try {
      if (outlet.isActive) {
        await apiFetch(`/outlets/${outlet.id}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/outlets/${outlet.id}`, { method: 'PUT', body: JSON.stringify({ isActive: true }) });
      }
      setNotice({ kind: 'ok', text: `Cabang "${outlet.name}" ${outlet.isActive ? 'dinonaktifkan' : 'diaktifkan kembali'}.` });
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    }
    await load();
  }

  return (
    <div className="space-y-6 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-slate-600">
          Jam kerja per jenis hari dipakai menghitung keterlambatan. Lokasi dan radius disimpan untuk aturan lokasi absen;
          saat ini absen diverifikasi dengan wajah dan jarak hanya dicatat.
        </p>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Muat ulang"
            className="btn btn-secondary w-11 px-0 text-slate-600 sm:w-9"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setForm({ ...EMPTY_FORM });
              }}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" aria-hidden /> Tambah Cabang
            </button>
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
        {loadError && outlets.length === 0 ? (
          <div role="alert" className="bg-rose-50 p-8 text-center text-rose-800">
            <p>{loadError}</p>
            <button type="button" onClick={load} className="btn btn-secondary mt-3">
              Coba lagi
            </button>
          </div>
        ) : loading && outlets.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat cabang…
          </div>
        ) : outlets.length === 0 ? (
          <div className="p-10 text-center text-slate-600">
            <p className="font-medium text-slate-800">Belum ada cabang.</p>
            {canCreate && <p className="mt-1">Gunakan tombol &quot;Tambah Cabang&quot; untuk mendaftarkan cabang pertama.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="table-head">
                  <th scope="col" className="px-4 py-3">Cabang</th>
                  <th scope="col" className="px-4 py-3">Lokasi</th>
                  <th scope="col" className="px-4 py-3">Kepala cabang</th>
                  <th scope="col" className="px-4 py-3">Jam kerja (buka tamu)</th>
                  <th scope="col" className="px-4 py-3">Gaji</th>
                  <th scope="col" className="px-4 py-3 text-right">Karyawan</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  {canEdit && <th scope="col" className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {outlets.map((o) => (
                  <tr key={o.id} className={o.isActive ? '' : 'bg-slate-50/60 text-slate-500'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{o.name}</p>
                      {o.brand && <p className="text-xs text-slate-600">{o.brand}</p>}
                      <p className="font-mono text-xs text-slate-500">{o.code}</p>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">
                      {o.city && <p className="font-medium text-slate-800">{o.city}</p>}
                      <p>{o.address}</p>
                      <a
                        href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="link inline-flex items-center gap-1 text-xs"
                      >
                        Peta · radius {o.geofenceRadius} m
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{o.manager?.fullName ?? <span className="text-slate-400">Belum dipilih</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-slate-700">
                      {DAYS.map((d) => {
                        const open = o[`${d.key}Open`];
                        const close = o[`${d.key}Close`];
                        return (
                          <p key={d.key}>
                            <span className="inline-block w-24 text-slate-500">{d.label.split(' (')[0]}</span>
                            {o[`${d.key}WorkStart`]}–{o[`${d.key}WorkEnd`]}
                            {open && close && <span className="text-slate-500"> ({open}–{close})</span>}
                          </p>
                        );
                      })}
                      <p className="text-slate-500">Istirahat maks. {o.breakLimitMins} menit</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                      <p>Tutup buku {dayOfMonth(o.payrollCutoffDay)}</p>
                      <p>Gajian {dayOfMonth(o.paydayDay)}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{o._count.employees}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
                          o.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {o.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <p className="mt-1 text-xs text-slate-600">Absen: {o.attendanceMode === 'TABLET' ? 'Tablet' : 'HP'}</p>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setNotice(null);
                              setForm(toForm(o));
                            }}
                            className="btn btn-sm btn-secondary"
                          >
                            <Edit2 className="h-3.5 w-3.5" aria-hidden /> Ubah
                          </button>
                          {canChangeStatus && (
                            <button
                              type="button"
                              onClick={() => setToggling(o)}
                              className={`btn btn-sm ${o.isActive ? 'btn-danger-outline' : 'btn-secondary'}`}
                            >
                              {o.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <HolidayList />

      {form && <OutletFormDialog initial={form} onCancel={() => setForm(null)} onSave={save} />}

      {toggling && (
        <Dialog title={`${toggling.isActive ? 'Nonaktifkan' : 'Aktifkan kembali'} cabang "${toggling.name}"?`} onClose={() => setToggling(null)}>
          <p className="text-slate-600">
            {toggling.isActive
              ? 'Cabang nonaktif tidak muncul di pilihan cabang. Riwayat absensi dan gajinya tetap tersimpan. Cabang yang masih punya karyawan aktif tidak bisa dinonaktifkan.'
              : 'Cabang akan muncul lagi di pilihan cabang.'}
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setToggling(null)} className="btn btn-ghost px-4">
              Batal
            </button>
            <button
              type="button"
              onClick={() => confirmToggle(toggling)}
              className={`btn px-4 ${toggling.isActive ? 'btn-danger' : 'btn-primary'}`}
            >
              {toggling.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function OutletFormDialog({
  initial,
  onCancel,
  onSave,
}: {
  initial: OutletForm;
  onCancel: () => void;
  onSave: (data: OutletForm) => Promise<void>;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const isEdit = Boolean(initial.id);
  // Pasang dan cabut tablet hanya untuk HR dan Super Admin (sama dengan backend devices.controller.ts)
  const canManageDevices = STATUS_CHANGERS.includes(getSessionUser()?.role ?? '');
  const set = (key: keyof OutletForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setData({ ...data, [key]: e.target.value });

  // Kepala Cabang dipilih dari Store Manager aktif di cabang ini (hanya saat mengubah)
  useEffect(() => {
    if (!initial.id) return;
    apiFetch<ManagerOption[]>(`/employees?outletId=${initial.id}`)
      .then((list) => setManagers(list.filter((e) => e.user.role === 'STORE_MANAGER' && e.user.isActive)))
      .catch(() => setManagers([]));
  }, [initial.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(data);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const field = 'input';
  const time = 'input px-2 py-1.5 tabular-nums';
  const section = 'space-y-3 border-t border-slate-100 pt-4';
  const heading = 'text-sm font-semibold text-slate-900';

  return (
    <Dialog wide title={isEdit ? `Ubah cabang ${initial.name}` : 'Tambah cabang'} onClose={onCancel}>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-3">
            <p className={heading}>Cabang</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 sm:col-span-2">
                <span className="font-medium text-slate-700">Nama cabang</span>
                <input required maxLength={100} value={data.name} onChange={set('name')} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Merek usaha</span>
                <input list="outlet-brands" maxLength={60} value={data.brand} onChange={set('brand')} className={field} />
                <datalist id="outlet-brands">
                  {BRANDS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Kode</span>
                <input
                  required
                  value={data.code}
                  onChange={set('code')}
                  disabled={isEdit}
                  pattern="[A-Za-z0-9\-]{2,30}"
                  title="2-30 karakter: huruf, angka atau tanda hubung"
                  placeholder="APS-TEBING-01"
                  className={`${field} font-mono uppercase`}
                />
              </label>
            </div>
          </div>

          <div className={section}>
            <p className={heading}>Lokasi</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Kota / wilayah</span>
                <input maxLength={60} value={data.city} onChange={set('city')} className={field} />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="font-medium text-slate-700">Alamat</span>
                <textarea required maxLength={300} rows={2} value={data.address} onChange={set('address')} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Latitude</span>
                <input required type="number" step="any" min={-90} max={90} value={data.latitude} onChange={set('latitude')} placeholder="3.32850" className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Longitude</span>
                <input required type="number" step="any" min={-180} max={180} value={data.longitude} onChange={set('longitude')} placeholder="99.16250" className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Radius absen (meter)</span>
                <input required type="number" min={10} max={1000} step={1} value={data.geofenceRadius} onChange={set('geofenceRadius')} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">BSSID Wi-Fi (opsional)</span>
                <input
                  value={data.wifiBssid}
                  onChange={set('wifiBssid')}
                  pattern="([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}"
                  title="Format AA:BB:CC:DD:EE:FF"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  className={`${field} font-mono`}
                />
              </label>
            </div>
            <p className="text-xs text-slate-500">Koordinat: di Google Maps klik kanan titik lokasi cabang, lalu klik angkanya untuk menyalin.</p>
          </div>

          <div className={section}>
            <p className={heading}>Kepala cabang</p>
            {isEdit ? (
              <label className="block space-y-1">
                <span className="sr-only">Kepala cabang</span>
                <select value={data.managerId} onChange={set('managerId')} className={field}>
                  <option value="">Belum dipilih</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.fullName}</option>
                  ))}
                </select>
                {managers.length === 0 && (
                  <span className="text-xs text-slate-500">Belum ada karyawan cabang ini dengan peran Kepala Cabang (Store Manager).</span>
                )}
              </label>
            ) : (
              <p className="text-slate-600">Dipilih setelah karyawan cabang ini didaftarkan dengan peran Kepala Cabang.</p>
            )}
          </div>

          <div className={section}>
            <p className={heading}>Jam kerja kru dan jam buka tamu</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th scope="col" className="pb-1 pr-2 font-medium">Hari</th>
                    <th scope="col" className="pb-1 pr-2 font-medium">Kerja mulai</th>
                    <th scope="col" className="pb-1 pr-2 font-medium">Kerja selesai</th>
                    <th scope="col" className="pb-1 pr-2 font-medium">Buka tamu</th>
                    <th scope="col" className="pb-1 font-medium">Tutup</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((d) => (
                    <tr key={d.key}>
                      <th scope="row" className="whitespace-nowrap py-1 pr-2 text-left font-medium text-slate-700">{d.label}</th>
                      {(['WorkStart', 'WorkEnd', 'Open', 'Close'] as const).map((suffix) => {
                        const key = `${d.key}${suffix}` as keyof OutletForm;
                        const required = suffix.startsWith('Work');
                        return (
                          <td key={suffix} className="py-1 pr-2">
                            <input
                              type="time"
                              required={required}
                              aria-label={`${d.label} ${suffix === 'WorkStart' ? 'kerja mulai' : suffix === 'WorkEnd' ? 'kerja selesai' : suffix === 'Open' ? 'buka tamu' : 'tutup'}`}
                              value={data[key] ?? ''}
                              onChange={set(key)}
                              className={time}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="block max-w-xs space-y-1">
              <span className="font-medium text-slate-700">Batas istirahat (menit)</span>
              <input required type="number" min={0} max={240} value={data.breakLimitMins} onChange={set('breakLimitMins')} className={field} />
            </label>
            <p className="text-xs text-slate-500">Jam kerja dipakai menghitung terlambat. Jam buka tamu hanya informasi dan boleh dikosongkan.</p>
          </div>

          <div className={section}>
            <p className={heading}>Mode absen</p>
            <div className="segmented" role="group" aria-label="Mode absen">
              {([['MOBILE', 'HP'], ['TABLET', 'Tablet']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={data.attendanceMode === value}
                  disabled={!canManageDevices}
                  onClick={() => setData({ ...data, attendanceMode: value })}
                  className="segmented-item"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              {data.attendanceMode === 'TABLET'
                ? 'Kru absen lewat tablet di cabang ini. Absen dari HP kru ditutup untuk cabang ini.'
                : 'Kru absen lewat aplikasi di HP masing-masing.'}
              {!canManageDevices && ' Hanya Super Admin atau HR yang bisa mengubah mode absen.'}
            </p>
          </div>

          {isEdit && canManageDevices && initial.id && <OutletDevicesPanel outletId={initial.id} canManage />}

          <div className={section}>
            <p className={heading}>Gaji</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Tanggal tutup buku</span>
                <input required type="number" min={1} max={31} value={data.payrollCutoffDay} onChange={set('payrollCutoffDay')} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Tanggal gajian</span>
                <input required type="number" min={1} max={31} value={data.paydayDay} onChange={set('paydayDay')} className={field} />
              </label>
            </div>
            <p className="text-xs text-slate-500">Isi 31 untuk akhir bulan.</p>
          </div>

          {error && (
            <p role="alert" className="alert-error">{error}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={onCancel} className="btn btn-ghost px-4">
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary px-4"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Simpan cabang
            </button>
          </div>
        </form>
    </Dialog>
  );
}
