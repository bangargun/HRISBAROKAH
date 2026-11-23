'use client';

import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { KioskApiError, pairDevice } from '@/lib/kiosk/api';
import { saveConfig } from '@/lib/kiosk/db';
import type { DeviceConfig } from '@/lib/kiosk/types';

const CODE_LENGTH = 8;
// Sama dengan CODE_ALPHABET backend (tanpa I, O, 0, 1)
const normalize = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

/** Layar pertama tablet: tukar kode pasangan dari web admin dengan token perangkat. */
export default function PairScreen({ onPaired }: { onPaired: (c: DeviceConfig) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError(`Kode terdiri dari ${CODE_LENGTH} huruf dan angka`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await pairDevice(code);
      const config: DeviceConfig = {
        token: res.token,
        deviceId: res.device.id,
        deviceName: res.device.name,
        outletName: res.outlet.name,
        offsetMs: 0, // diisi sinkron pertama
        lastSyncAt: null,
      };
      await saveConfig(config);
      onPaired(config);
    } catch (err) {
      setError(err instanceof KioskApiError ? err.message : 'Tablet gagal dipasangkan. Coba lagi.');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo-barokah.jpg" alt="Barokah Group" width={140} height={56} className="h-14 w-auto rounded-md" />
          <h1 className="mt-5 text-2xl font-semibold text-white">Pasangkan tablet absen</h1>
          <p className="mt-2 text-sm text-slate-400">
            Minta HR membuat kode di web admin: Cabang, ubah cabang ini, lalu Pasangkan tablet. Kode berlaku 15 menit.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-lg bg-white p-6 text-slate-900" noValidate>
          <div>
            <label htmlFor="pair-code" className="field-label mb-1.5">
              Kode pasangan
            </label>
            <input
              id="pair-code"
              name="code"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              value={code}
              onChange={(e) => setCode(normalize(e.target.value))}
              aria-invalid={!!error}
              aria-describedby={error ? 'pair-error' : undefined}
              className="input py-3 text-center font-mono text-2xl font-semibold uppercase tracking-[0.3em]"
            />
          </div>

          {error && (
            <div id="pair-error" role="alert" className="alert-error flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary w-full py-3 text-base">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? 'Memasangkan…' : 'Pasangkan'}
          </button>
        </form>
      </div>
    </main>
  );
}
