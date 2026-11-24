'use client';

import React, { useEffect, useState } from 'react';
import type { Person, RecapRow } from '@/lib/kiosk/today';
import type { RecapRequest } from '@/lib/kiosk/types';
import { REQUEST_LABEL } from './RequestForm';
import { btnPrimary, hhmm, panel } from './ui';

export const RECAP_SECONDS = 30;

const dayFmt = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const day = (ymd: string) => dayFmt.format(new Date(`${ymd}T00:00:00Z`));
const time = (d: Date | null) => (d ? hhmm(d) : '–');
// "1 j 5 m"; tanda pisah bila angka tidak tersedia di tablet
function minutes(m: number | null): string {
  if (m === null) return '–';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} j ${m % 60} m` : `${m} m`;
}

/**
 * Rekap pribadi kru yang baru dikenali: bulan berjalan (kru cabang ini) atau hari ini (kru tamu).
 * Tutup sendiri setelah 30 detik.
 */
const STATUS_LABEL: Record<string, string> = {
  PENDING_STORE_MANAGER: 'Menunggu Kepala Cabang',
  PENDING_HR: 'Menunggu HR',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

export default function MyRecap({
  person,
  rows,
  requests,
  onClose,
}: {
  person: Person;
  rows: RecapRow[];
  requests: RecapRequest[];
  onClose: () => void;
}) {
  const [left, setLeft] = useState(RECAP_SECONDS);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left <= 0) onClose();
  }, [left, onClose]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Rekap {person.fullName}</h1>
          <p className="text-sm text-slate-400">{person.isHome ? 'Bulan ini' : 'Hari ini di cabang ini'}</p>
        </div>
        <button type="button" onClick={onClose} className={btnPrimary}>
          Tutup ({Math.max(0, left)})
        </button>
      </div>

      {rows.length === 0 ? (
        <p className={`${panel} p-8 text-center text-base text-slate-300`}>Belum ada absen yang tercatat.</p>
      ) : (
        <div className={`${panel} overflow-x-auto`}>
          <table className="w-full text-left text-base text-slate-200">
            <thead className="border-b border-ink-700 text-sm text-slate-400">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Tanggal</th>
                <th scope="col" className="px-3 py-2 font-medium">Masuk</th>
                <th scope="col" className="px-3 py-2 font-medium">Pulang</th>
                <th scope="col" className="px-3 py-2 font-medium">Terlambat</th>
                <th scope="col" className="px-3 py-2 font-medium">Istirahat</th>
                <th scope="col" className="px-3 py-2 font-medium">Kerja</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} className="border-b border-ink-700/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{day(r.date)}</td>
                  <td className="px-3 py-2">{time(r.clockIn)}</td>
                  <td className="px-3 py-2">{r.onBreak ? 'istirahat' : time(r.clockOut)}</td>
                  <td className={`px-3 py-2 ${r.lateMinutes ? 'text-brand-300' : ''}`}>{r.lateMinutes ? `${r.lateMinutes} m` : '–'}</td>
                  <td className="px-3 py-2">{minutes(r.breakMinutes)}</td>
                  <td className="px-3 py-2">{minutes(r.workMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {requests.length > 0 && (
        <section className={`${panel} p-4`} aria-labelledby="recap-requests">
          <h2 id="recap-requests" className="mb-2 text-base font-semibold text-white">Pengajuan cuti / izin</h2>
          <ul className="divide-y divide-ink-700/60 text-base text-slate-200">
            {requests.map((q, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {REQUEST_LABEL[q.type] ?? q.type}
                  {q.startDate && (
                    <span className="text-slate-400">
                      {' '}· {day(q.startDate)}{q.endDate && q.endDate !== q.startDate ? ` – ${day(q.endDate)}` : ''}
                    </span>
                  )}
                </span>
                <span className={q.status === 'APPROVED' ? 'text-emerald-300' : q.status === 'REJECTED' ? 'text-rose-300' : 'text-brand-200'}>
                  {STATUS_LABEL[q.status] ?? q.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-sm text-slate-400">Angka hari ini diperbarui setelah absen terkirim ke server.</p>
    </main>
  );
}
