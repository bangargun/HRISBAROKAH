'use client';

import React, { useState } from 'react';
import { Delete } from 'lucide-react';
import type { Person } from '@/lib/kiosk/today';
import { btnPrimary, btnQuiet } from './ui';

const PIN_LENGTH = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * PIN absen 6 digit. Tablet tidak bisa memeriksa PIN (tidak menyimpan hash); PIN dikirim
 * bersama event dan diperiksa server saat sinkron.
 */
export default function PinPad({
  person,
  hasPin,
  onSubmit,
  onCancel,
}: {
  person: Person;
  // false = roster menyatakan kru ini belum punya PIN; undefined = tidak diketahui (kru cabang lain)
  hasPin: boolean | undefined;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const press = (d: string) => setPin((p) => (p.length < PIN_LENGTH ? p + d : p));
  const back = () => setPin((p) => p.slice(0, -1));
  const keyClass =
    'flex min-h-16 items-center justify-center rounded-lg border border-ink-700 bg-ink-800 text-3xl font-semibold text-white hover:bg-ink-700 active:bg-ink-900';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-5 px-4 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">{person.fullName}</h1>
        <p className="mt-1 text-base text-slate-300">Masukkan PIN absen 6 digit</p>
      </div>

      {hasPin === false && (
        <p role="alert" className="text-center text-base text-amber-200">
          Kru ini belum punya PIN absen. Minta HR membuatkan PIN, atau atur PIN di aplikasi kru menu Akun.
        </p>
      )}

      <div className="flex gap-3" aria-label={`${pin.length} dari ${PIN_LENGTH} digit terisi`} role="status">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? 'border-brand-400 bg-brand-400' : 'border-slate-500'}`}
          />
        ))}
      </div>

      <div className="grid w-full grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button key={k} type="button" onClick={() => press(k)} className={keyClass}>
            {k}
          </button>
        ))}
        <button type="button" onClick={back} className={keyClass} aria-label="Hapus satu digit">
          <Delete className="h-7 w-7" aria-hidden />
        </button>
        <button type="button" onClick={() => press('0')} className={keyClass}>
          0
        </button>
        <button
          type="button"
          disabled={pin.length !== PIN_LENGTH || hasPin === false}
          onClick={() => onSubmit(pin)}
          className={`${btnPrimary} min-h-16 sm:min-h-16`}
        >
          Lanjut
        </button>
      </div>

      <button type="button" onClick={onCancel} className={`${btnQuiet} w-full`}>
        Batal
      </button>
    </main>
  );
}
