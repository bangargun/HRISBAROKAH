'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, ExternalLink, Loader2, Plus, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';

interface Outlet {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  wifiBssid: string | null;
  payrollCutoffDay: number;
  isActive: boolean;
  _count: { employees: number; shifts: number };
}

interface OutletForm {
  id?: string;
  code: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadius: string;
  wifiBssid: string;
  payrollCutoffDay: string;
}

// Sama dengan @Roles di backend outlets.controller.ts
const CREATORS = ['SUPER_ADMIN', 'HR_ADMIN'];
const EDITORS = ['SUPER_ADMIN', 'HR_ADMIN', 'AREA_MANAGER'];
const STATUS_CHANGERS = ['SUPER_ADMIN', 'HR_ADMIN'];

const EMPTY_FORM: OutletForm = {
  code: '',
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  geofenceRadius: '50',
  wifiBssid: '',
  payrollCutoffDay: '31',
};

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
    const body = {
      name: data.name,
      address: data.address,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      geofenceRadius: Number(data.geofenceRadius),
      wifiBssid: data.wifiBssid,
      payrollCutoffDay: Number(data.payrollCutoffDay),
    };
    if (data.id) {
      await apiFetch(`/outlets/${data.id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/outlets', { method: 'POST', body: JSON.stringify({ ...body, code: data.code }) });
    }
    setForm(null);
    setNotice({ kind: 'ok', text: `Cabang "${data.name.trim()}" ${data.id ? 'diperbarui' : 'ditambahkan'}.` });
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
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Daftar Cabang</h3>
          <p className="mt-0.5 max-w-2xl text-slate-600">
            Lokasi dan radius disimpan untuk aturan lokasi absen. Saat ini absen diverifikasi dengan wajah; jarak ke
            cabang belum diperiksa.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Muat ulang"
            className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
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
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 font-medium text-slate-950 hover:bg-amber-400"
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
            notice.kind === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loadError && outlets.length === 0 ? (
          <div role="alert" className="bg-rose-50 p-8 text-center text-rose-800">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-md border border-rose-300 px-3 py-1.5 font-medium hover:bg-rose-100"
            >
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
            {canCreate && <p className="mt-1">Tambahkan cabang pertama untuk mulai mencatat karyawan, shift dan presensi.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-600">
                  <th scope="col" className="px-4 py-3">Cabang</th>
                  <th scope="col" className="px-4 py-3">Alamat</th>
                  <th scope="col" className="px-4 py-3">Lokasi</th>
                  <th scope="col" className="px-4 py-3 text-right">Karyawan</th>
                  <th scope="col" className="px-4 py-3 text-right">Shift</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  {canEdit && <th scope="col" className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outlets.map((o) => (
                  <tr key={o.id} className={o.isActive ? '' : 'bg-slate-50/60 text-slate-500'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{o.name}</p>
                      <p className="font-mono text-xs text-slate-500">{o.code}</p>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">
                      {o.address}
                      <p className="text-xs text-slate-500">
                        Tutup buku gaji {o.payrollCutoffDay === 31 ? 'akhir bulan' : `tgl ${o.payrollCutoffDay}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <a
                        href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-amber-700 hover:underline"
                      >
                        {o.latitude.toFixed(5)}, {o.longitude.toFixed(5)}
                        <ExternalLink className="h-3 w-3" aria-label="(buka peta)" />
                      </a>
                      <p className="text-xs text-slate-500">
                        Radius {o.geofenceRadius} m{o.wifiBssid ? ` · Wi-Fi ${o.wifiBssid}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{o._count.employees}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o._count.shifts}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
                          o.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {o.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setNotice(null);
                              setForm({
                                id: o.id,
                                code: o.code,
                                name: o.name,
                                address: o.address,
                                latitude: String(o.latitude),
                                longitude: String(o.longitude),
                                geofenceRadius: String(o.geofenceRadius),
                                wifiBssid: o.wifiBssid ?? '',
                                payrollCutoffDay: String(o.payrollCutoffDay),
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Edit2 className="h-3.5 w-3.5" aria-hidden /> Ubah
                          </button>
                          {canChangeStatus && (
                            <button
                              type="button"
                              onClick={() => setToggling(o)}
                              className={`rounded-md border px-2.5 py-1.5 font-medium ${
                                o.isActive
                                  ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
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

      {form && <OutletFormDialog initial={form} onCancel={() => setForm(null)} onSave={save} />}

      {toggling && (
        <Dialog
          title={`${toggling.isActive ? 'Nonaktifkan' : 'Aktifkan kembali'} cabang "${toggling.name}"?`}
          onClose={() => setToggling(null)}
        >
          <p className="text-slate-600">
            {toggling.isActive
              ? 'Cabang nonaktif tidak muncul di pilihan cabang. Riwayat absensi dan shift-nya tetap tersimpan. Cabang yang masih punya karyawan aktif tidak bisa dinonaktifkan.'
              : 'Cabang akan muncul lagi di pilihan cabang.'}
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setToggling(null)}
              className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => confirmToggle(toggling)}
              className={`rounded-md px-4 py-2 font-medium text-white ${
                toggling.isActive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
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
  const isEdit = Boolean(initial.id);
  const set = (key: keyof OutletForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setData({ ...data, [key]: e.target.value });

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

  const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-amber-500 disabled:bg-slate-100 disabled:text-slate-500';

  return (
    <Dialog title={isEdit ? 'Ubah cabang' : 'Tambah cabang'} onClose={onCancel}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-1 block space-y-1">
            <span className="font-medium text-slate-700">Kode</span>
            <input
              required
              value={data.code}
              onChange={set('code')}
              disabled={isEdit}
              pattern="[A-Za-z0-9\-]{2,30}"
              title="2-30 karakter: huruf, angka atau tanda hubung"
              placeholder="PIK-02"
              className={`${field} font-mono uppercase`}
            />
          </label>
          <label className="col-span-2 block space-y-1">
            <span className="font-medium text-slate-700">Nama cabang</span>
            <input required maxLength={100} value={data.name} onChange={set('name')} className={field} />
          </label>
        </div>
        {isEdit && <p className="-mt-1 text-xs text-slate-500">Kode cabang tidak bisa diubah.</p>}
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Alamat</span>
          <textarea required maxLength={300} rows={2} value={data.address} onChange={set('address')} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Latitude</span>
            <input
              required
              type="number"
              step="any"
              min={-90}
              max={90}
              value={data.latitude}
              onChange={set('latitude')}
              placeholder="-6.10850"
              className={field}
            />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Longitude</span>
            <input
              required
              type="number"
              step="any"
              min={-180}
              max={180}
              value={data.longitude}
              onChange={set('longitude')}
              placeholder="106.74120"
              className={field}
            />
          </label>
        </div>
        <p className="-mt-1 text-xs text-slate-500">
          Di Google Maps, klik kanan titik lokasi cabang lalu klik angka koordinat untuk menyalinnya.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Radius (meter)</span>
            <input
              required
              type="number"
              min={10}
              max={1000}
              step={1}
              value={data.geofenceRadius}
              onChange={set('geofenceRadius')}
              className={field}
            />
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

        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Tanggal tutup buku gaji</span>
          <input
            required
            type="number"
            min={1}
            max={31}
            step={1}
            value={data.payrollCutoffDay}
            onChange={set('payrollCutoffDay')}
            className={field}
          />
          <span className="text-xs text-slate-500">
            Periode gaji berakhir di tanggal ini setiap bulan. Isi 31 untuk akhir bulan.
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Simpan cabang
          </button>
        </div>
      </form>
    </Dialog>
  );
}
