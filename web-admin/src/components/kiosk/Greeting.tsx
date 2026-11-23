'use client';

import React from 'react';
import { AlertCircle, CalendarDays, Loader2 } from 'lucide-react';
import type { CurrentDay } from '@/lib/kiosk/status';
import type { Person } from '@/lib/kiosk/today';
import type { KioskEventType } from '@/lib/kiosk/types';
import { btnPrimary, btnQuiet, btnSecondary, hhmm } from './ui';

export const ACTION_LABEL: Record<KioskEventType, string> = {
  CLOCK_IN: 'Masuk',
  BREAK_START: 'Mulai istirahat',
  BREAK_END: 'Selesai istirahat',
  CLOCK_OUT: 'Pulang',
};

// Jalur PIN belum terverifikasi di tablet: status tanpa jam, agar jam absen orang lain tidak terlihat
function statusLine(day: CurrentDay, showTimes: boolean): string {
  if (day.status === 'IN') return day.clockIn && showTimes ? `Masuk ${hhmm(day.clockIn)}, sedang bekerja` : 'Sedang bekerja';
  if (day.status === 'ON_BREAK') return day.openBreakStart && showTimes ? `Istirahat sejak ${hhmm(day.openBreakStart)}` : 'Sedang istirahat';
  if (day.status === 'DONE') {
    return day.clockOut && showTimes ? `Sudah pulang ${hhmm(day.clockOut)}. Absen hari ini sudah lengkap.` : 'Absen hari ini sudah lengkap.';
  }
  return 'Belum absen masuk hari ini';
}

export interface GreetingProps {
  person: Person;
  day: CurrentDay;
  actions: KioskEventType[];
  viaPin: boolean;
  busy: boolean;
  error: string | null;
  onAction: (type: KioskEventType) => void;
  onNotMe: () => void;
  onRecap: () => void;
}

/** "Halo {nama}" dengan tombol aksi yang berlaku untuk status kru saat ini. */
export default function Greeting({ person, day, actions, viaPin, busy, error, onAction, onNotMe, onRecap }: GreetingProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        {!person.isHome && (
          <p className="mb-2 inline-block rounded bg-ink-700 px-2 py-1 text-sm font-medium text-brand-200">
            Kru tamu dari {person.homeOutletName || 'cabang lain'}
          </p>
        )}
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Halo {person.fullName}</h1>
        <p className="mt-2 text-lg text-slate-300">{statusLine(day, !viaPin)}</p>
        {viaPin && <p className="mt-1 text-sm text-slate-400">Absen dengan PIN. PIN dan wajah diperiksa server saat terkirim.</p>}
      </div>

      {error && (
        <p role="alert" className="inline-flex items-center gap-2 text-base text-rose-200">
          <AlertCircle className="h-5 w-5" aria-hidden />
          {error}
        </p>
      )}

      <div className="flex w-full max-w-md flex-col gap-3">
        {actions.map((type, i) => (
          <button
            key={type}
            type="button"
            disabled={busy}
            onClick={() => onAction(type)}
            className={i === 0 ? `${btnPrimary} min-h-16 text-xl sm:min-h-16` : `${btnSecondary} min-h-16 text-xl sm:min-h-16`}
          >
            {busy && i === 0 && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            {ACTION_LABEL[type]}
          </button>
        ))}
        {actions.length === 0 && !viaPin && (
          <button type="button" onClick={onRecap} className={btnSecondary}>
            <CalendarDays className="h-5 w-5" aria-hidden />
            Rekap saya
          </button>
        )}
        <button type="button" disabled={busy} onClick={onNotMe} className={btnQuiet}>
          Bukan saya
        </button>
      </div>
    </main>
  );
}

/** Konfirmasi setelah event tersimpan di tablet. */
export function Recorded({
  person,
  type,
  at,
  lateMinutes,
  onRecap,
  onDone,
}: {
  person: Person;
  type: KioskEventType;
  at: Date;
  lateMinutes: number | null;
  // null = rekap tidak ditawarkan (jalur PIN: belum ada wajah yang cocok)
  onRecap: (() => void) | null;
  onDone: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div role="status" aria-live="assertive">
        <p className="text-lg text-slate-300">
          {ACTION_LABEL[type]} · {person.fullName}
        </p>
        <p className="mt-2 text-5xl font-semibold tabular-nums text-white">Tercatat ✓ {hhmm(at)}</p>
        {type === 'CLOCK_IN' && lateMinutes !== null && lateMinutes > 0 && (
          <p className="mt-3 text-xl font-medium text-brand-300">terlambat {lateMinutes} menit</p>
        )}
      </div>
      <div className="flex w-full max-w-md flex-col gap-3">
        {onRecap && (
          <button type="button" onClick={onRecap} className={btnSecondary}>
            <CalendarDays className="h-5 w-5" aria-hidden />
            Rekap saya
          </button>
        )}
        <button type="button" onClick={onDone} className={btnPrimary}>
          Selesai
        </button>
      </div>
    </main>
  );
}
