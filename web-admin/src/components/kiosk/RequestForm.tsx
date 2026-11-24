'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { DeviceRevokedError, KioskNetworkError, kioskFetch } from '@/lib/kiosk/api';
import type { Person } from '@/lib/kiosk/today';
import type { KioskMethod } from '@/lib/kiosk/types';
import { btnPrimary, btnQuiet, btnSecondary, panel } from './ui';

export const REQUEST_LABEL: Record<string, string> = {
  CUTI_TAHUNAN: 'Cuti tahunan',
  CUTI_KHUSUS: 'Cuti khusus',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
};
const TYPES = ['IZIN', 'SAKIT', 'CUTI_TAHUNAN', 'CUTI_KHUSUS'] as const;
const field = 'w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-3 text-lg text-white focus:border-brand-400 focus:outline-none';
const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

/**
 * Pengajuan cuti / izin / sakit dari tablet untuk kru yang baru dikenali. Langsung dikirim ke server
 * (butuh internet); server memeriksa ulang wajah atau PIN, lalu pengajuan masuk ke persetujuan Kepala Cabang.
 */
export default function RequestForm({
  person,
  method,
  photoBase64,
  pin,
  onDone,
}: {
  person: Person;
  method: KioskMethod;
  photoBase64: string;
  pin?: string;
  onDone: () => void;
}) {
  const [type, setType] = useState<(typeof TYPES)[number]>('IZIN');
  const [startDate, setStartDate] = useState(todayYmd());
  const [endDate, setEndDate] = useState(todayYmd());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (endDate < startDate) {
      setError('Tanggal selesai tidak boleh sebelum tanggal mulai');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await kioskFetch('/kiosk/requests', {
        method: 'POST',
        body: JSON.stringify({ employeeId: person.employeeId, type, startDate, endDate, reason, method, photoBase64, ...(pin && { pin }) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = Array.isArray(body?.message) ? body.message[0] : body?.message;
        setError(typeof msg === 'string' ? msg : 'Pengajuan gagal dikirim. Coba lagi.');
        return;
      }
      setSent(true);
    } catch (err) {
      if (err instanceof DeviceRevokedError) return; // halaman kembali ke layar pasangan
      setError(err instanceof KioskNetworkError ? 'Tidak ada koneksi ke server. Coba lagi saat tablet online.' : 'Pengajuan gagal dikirim. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-6 text-center">
        <div role="status" aria-live="assertive" className="space-y-2">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" aria-hidden />
          <p className="text-3xl font-semibold text-white">Pengajuan terkirim</p>
          <p className="text-lg text-slate-300">
            {REQUEST_LABEL[type]} · {person.fullName}. Menunggu persetujuan Kepala Cabang, lalu HR.
          </p>
        </div>
        <button type="button" onClick={onDone} className={`${btnPrimary} w-full max-w-md`}>
          Selesai
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Ajukan cuti / izin</h1>
        <p className="text-base text-slate-400">{person.fullName}</p>
      </div>
      {!online && (
        <p role="alert" className="inline-flex items-center gap-2 text-base text-amber-200">
          <AlertCircle className="h-5 w-5" aria-hidden />
          Tablet sedang offline. Pengajuan butuh internet; absen tetap bisa dilakukan.
        </p>
      )}
      <form onSubmit={submit} className={`${panel} space-y-4 p-4`}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-300">Jenis</legend>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={type === t ? btnPrimary : btnSecondary}
              >
                {REQUEST_LABEL[t]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-300">Mulai</span>
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-300">Selesai</span>
            <input required type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={field} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-300">Alasan</span>
          <textarea required maxLength={1000} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
        </label>
        {error && (
          <p role="alert" className="inline-flex items-center gap-2 text-base text-rose-200">
            <AlertCircle className="h-5 w-5" aria-hidden />
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button type="submit" disabled={busy || !online} className={`${btnPrimary} sm:flex-1`}>
            {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            Kirim pengajuan
          </button>
          <button type="button" disabled={busy} onClick={onDone} className={`${btnQuiet} sm:flex-1`}>
            Batal
          </button>
        </div>
      </form>
    </main>
  );
}
