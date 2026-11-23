'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Loader2, ScanFace, Users } from 'lucide-react';
import type { SyncState } from '@/lib/kiosk/sync';
import type { StatusEvent } from '@/lib/kiosk/status';
import { boardSummary, type BoardRow } from '@/lib/kiosk/today';
import type { BootstrapPayload, DeviceConfig } from '@/lib/kiosk/types';
import { btnPrimary, btnSecondary, dateFmt, hhmm, panel } from './ui';

// Spec §5: batas antrean 7 hari / 2000 event; peringatan keras sebelum batas
const QUEUE_WARN_COUNT = 1500;
const QUEUE_WARN_AGE_MS = 5 * 86_400_000;

export interface BoardProps {
  config: DeviceConfig;
  sync: SyncState | null;
  bootstrap: BootstrapPayload | null;
  queued: StatusEvent[];
  now: Date; // jam server menurut tablet
  onAbsen: () => void;
  onOtherOutlet: () => void;
}

/** Papan hari ini: siapa sudah masuk, istirahat, pulang, belum datang, terlambat; tombol absen. */
export default function Board({ config, sync, bootstrap, queued, now, onAbsen, onOtherOutlet }: BoardProps) {
  const online = sync?.online ?? false;
  const lastSync = sync?.lastSync ?? config.lastSyncAt ?? null;
  const pending = sync?.pending ?? 0;
  const oldestAge = sync?.oldest ? Date.now() - Date.parse(sync.oldest) : 0;
  const queueFull = pending >= QUEUE_WARN_COUNT || oldestAge > QUEUE_WARN_AGE_MS;
  // Dihitung ulang tiap detak jam papan (10 dtk) dan setiap antrean / bootstrap berubah, dengan jam
  // saat itu (bukan `now` yang bisa tertinggal 10 dtk): absen yang baru diantre tidak boleh tampak
  // di masa depan, karena absen yang belum terjadi tidak dihitung terbuka.
  const offsetMs = config.offsetMs;
  const summary = useMemo(
    () => (bootstrap ? boardSummary(bootstrap, queued, new Date(Date.now() + offsetMs)) : null),
    [bootstrap, queued, now, offsetMs], // `now` memicu hitung ulang tiap detak jam
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <img src="/logo-barokah.jpg" alt="Barokah Group" width={100} height={40} className="h-10 w-auto rounded" />
          <div>
            <h1 className="text-lg font-semibold text-white">{bootstrap?.outlet.name ?? config.outletName}</h1>
            <p className="text-xs text-slate-400">{config.deviceName}</p>
          </div>
        </div>
        <SyncStatus online={online} known={sync !== null} pending={pending} lastSync={lastSync} />
      </header>

      {queueFull && (
        <div role="alert" className="flex items-start gap-3 bg-rose-700 px-4 py-3 text-white sm:px-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" aria-hidden />
          <p className="text-base font-semibold">
            Sambungkan tablet ke internet. {pending} absen tersimpan di tablet dan belum terkirim.
          </p>
        </div>
      )}
      {(sync?.stuck ?? 0) > 0 && (
        <div role="status" className="flex items-start gap-3 border-b border-amber-300/30 bg-amber-400/10 px-4 py-3 text-amber-100 sm:px-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-300" aria-hidden />
          <p className="text-sm">
            {sync!.stuck} absen belum diterima server lebih dari sehari. Beri tahu HR agar diperiksa.
          </p>
        </div>
      )}

      <main className="grid flex-1 content-start gap-6 px-4 py-6 sm:px-6 landscape:md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] landscape:md:items-start">
        <section className="flex flex-col items-center justify-center text-center landscape:md:min-h-[60vh]" aria-label="Absen">
          <p className="text-6xl font-semibold tabular-nums text-white sm:text-7xl">{hhmm(now)}</p>
          <p className="mt-2 text-base text-slate-300 sm:text-lg">{dateFmt.format(now)}</p>
          {bootstrap ? (
            <div className="mt-8 flex w-full max-w-md flex-col gap-3">
              <button type="button" onClick={onAbsen} className={`${btnPrimary} min-h-20 text-2xl sm:min-h-20`}>
                <ScanFace className="h-7 w-7" aria-hidden />
                Tekan untuk absen
              </button>
              <button type="button" onClick={onOtherOutlet} className={btnSecondary}>
                <Users className="h-5 w-5" aria-hidden />
                Saya dari cabang lain
              </button>
            </div>
          ) : (
            <p className="mt-10 inline-flex items-center gap-2 text-sm text-slate-400">
              {online || sync === null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Menyiapkan data cabang…
                </>
              ) : (
                'Data cabang belum terunduh. Sambungkan tablet ke internet.'
              )}
            </p>
          )}
        </section>

        {summary && (
          <section aria-label="Hari ini" className="grid grid-cols-2 gap-3 sm:grid-cols-3 landscape:md:grid-cols-2 landscape:xl:grid-cols-3">
            <Group title="Sudah masuk" rows={summary.working} time />
            <Group title="Istirahat" rows={summary.onBreak} time />
            <Group title="Pulang" rows={summary.done} time />
            <Group title="Belum datang" rows={summary.notYet} />
            <Group title="Terlambat" rows={summary.late} late />
          </section>
        )}
      </main>
    </div>
  );
}

function Group({ title, rows, time, late }: { title: string; rows: BoardRow[]; time?: boolean; late?: boolean }) {
  const id = `group-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={`${panel} flex max-h-72 min-h-32 flex-col p-3`}>
      <h2 id={id} className="flex items-baseline justify-between gap-2 text-sm font-medium text-slate-300">
        {title}
        <span className={`text-2xl font-semibold tabular-nums ${late && rows.length > 0 ? 'text-brand-300' : 'text-white'}`}>
          {rows.length}
        </span>
      </h2>
      {rows.length > 0 && (
        <ul aria-labelledby={id} className="mt-2 space-y-1 overflow-y-auto text-sm text-slate-200">
          {rows.map((r) => (
            <li key={r.employeeId} className="flex justify-between gap-2">
              <span className="truncate">{r.fullName}</span>
              {late ? (
                <span className="flex-none tabular-nums text-brand-300">{r.lateMinutes} mnt</span>
              ) : (
                time && r.at && <span className="flex-none tabular-nums text-slate-400">{hhmm(r.at)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SyncStatus({ online, known, pending, lastSync }: { online: boolean; known: boolean; pending: number; lastSync: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300" role="status" aria-live="polite">
      {known && (
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`} aria-hidden />
          {online ? 'Online' : 'Offline'}
        </span>
      )}
      {known && <span>{pending > 0 ? `${pending} menunggu terkirim` : 'Semua terkirim'}</span>}
      <span className="text-slate-400">
        {lastSync ? `Sinkron terakhir ${hhmm(new Date(lastSync))}` : 'Belum pernah sinkron'}
      </span>
    </div>
  );
}
