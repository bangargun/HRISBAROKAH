'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { SyncState } from '@/lib/kiosk/sync';
import type { BootstrapPayload, DeviceConfig } from '@/lib/kiosk/types';

const TZ = 'Asia/Jakarta';
const timeFmt = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Jam server menurut tablet: jam tablet + selisih dari sinkron terakhir. */
function useServerClock(offsetMs: number): Date {
  const [now, setNow] = useState(() => new Date(Date.now() + offsetMs));
  useEffect(() => {
    const tick = () => setNow(new Date(Date.now() + offsetMs));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [offsetMs]);
  return now;
}

export interface BoardProps {
  config: DeviceConfig;
  sync: SyncState | null;
  bootstrap: BootstrapPayload | null;
}

/** Papan tablet. Task 9 mengisi area tengah (ringkasan hari ini dan tombol absen). */
export default function Board({ config, sync, bootstrap }: BoardProps) {
  const now = useServerClock(config.offsetMs);
  const online = sync?.online ?? false;
  const lastSync = sync?.lastSync ?? config.lastSyncAt ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-6 py-4">
        <div className="flex items-center gap-4">
          <img src="/logo-barokah.jpg" alt="Barokah Group" width={100} height={40} className="h-10 w-auto rounded" />
          <div>
            <h1 className="text-lg font-semibold text-white">{bootstrap?.outlet.name ?? config.outletName}</h1>
            <p className="text-xs text-slate-400">{config.deviceName}</p>
          </div>
        </div>
        <SyncStatus online={online} known={sync !== null} pending={sync?.pending ?? 0} lastSync={lastSync} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <p className="text-7xl font-semibold tabular-nums text-white sm:text-8xl">{timeFmt.format(now)}</p>
        <p className="mt-2 text-lg text-slate-300">{dateFmt.format(now)}</p>
        <div className="mt-10 text-sm text-slate-400">
          {bootstrap ? (
            <p>{bootstrap.roster.length} kru terdaftar di tablet ini</p>
          ) : (
            <p className="inline-flex items-center gap-2">
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
        </div>
      </main>
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
        {lastSync ? `Sinkron terakhir ${timeFmt.format(new Date(lastSync))}` : 'Belum pernah sinkron'}
      </span>
    </div>
  );
}
