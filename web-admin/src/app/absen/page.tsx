'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Board from '@/components/absen/Board';
import PairScreen from '@/components/absen/PairScreen';
import { getBootstrap, getConfig } from '@/lib/kiosk/db';
import { checkForUpdate, listenForShellUpdate, registerServiceWorker, reportLoadedAssets, useKioskScreen } from '@/lib/kiosk/device';
import { startSync, type SyncState } from '@/lib/kiosk/sync';
import type { BootstrapPayload, DeviceConfig } from '@/lib/kiosk/types';

type View = { kind: 'loading' } | { kind: 'unpaired' } | { kind: 'paired'; config: DeviceConfig } | { kind: 'storage-error' };

/** Halaman tablet absen cabang: tanpa sesi admin, bekerja offline setelah dipasangkan. */
export default function AbsenPage() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [sync, setSync] = useState<SyncState | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  useKioskScreen();

  // Deploy baru: SW menyimpan build baru lalu halaman dimuat ulang saat papan diam
  useEffect(() => listenForShellUpdate(), []);

  useEffect(() => {
    registerServiceWorker();
    Promise.all([getConfig(), getBootstrap()])
      .then(([config, b]) => {
        setBootstrap(b);
        setView(config ? { kind: 'paired', config } : { kind: 'unpaired' });
      })
      .catch(() => setView({ kind: 'storage-error' }));
  }, []);

  const pairedDeviceId = view.kind === 'paired' ? view.config.deviceId : null;
  useEffect(() => {
    if (!pairedDeviceId) return;
    let lastSeen: string | null | undefined;
    return startSync((s) => {
      setSync(s);
      if (s.lastSync === lastSeen) return;
      lastSeen = s.lastSync;
      // Bootstrap baru: muat ulang paket data dan selisih jam
      Promise.all([getConfig(), getBootstrap()])
        .then(([config, b]) => {
          if (config) setView({ kind: 'paired', config });
          setBootstrap(b);
          if (s.online && s.lastSync) {
            reportLoadedAssets();
            checkForUpdate();
          }
        })
        .catch(() => undefined);
    });
  }, [pairedDeviceId]);

  if (view.kind === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" aria-label="Memuat" />
      </div>
    );
  }
  if (view.kind === 'storage-error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p role="alert" className="max-w-md text-sm text-slate-300">
          Penyimpanan tablet tidak bisa dibuka. Tutup mode penyamaran / pribadi browser, lalu buka lagi halaman ini.
        </p>
      </div>
    );
  }
  if (view.kind === 'unpaired') {
    return <PairScreen onPaired={(config) => setView({ kind: 'paired', config })} />;
  }
  return <Board config={view.config} sync={sync} bootstrap={bootstrap} />;
}
