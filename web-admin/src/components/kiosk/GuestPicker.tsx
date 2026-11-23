'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Person } from '@/lib/kiosk/today';
import type { BootstrapPayload } from '@/lib/kiosk/types';
import { btnQuiet } from './ui';

export type PickerTab = 'home' | 'other';
const MAX_SHOWN = 40;

const norm = (s: string) => s.toLocaleLowerCase('id').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Pilih nama untuk absen dengan PIN: kru cabang ini (roster) atau kru cabang lain (direktori). */
export default function GuestPicker({
  bootstrap,
  initialTab,
  onPick,
  onCancel,
}: {
  bootstrap: BootstrapPayload;
  initialTab: PickerTab;
  onPick: (p: Person) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<PickerTab>(initialTab);
  const [query, setQuery] = useState('');

  const people = useMemo<Person[]>(() => {
    const homeIds = new Set(bootstrap.roster.filter((r) => !r.isGuest).map((r) => r.employeeId));
    if (tab === 'home') {
      return bootstrap.roster
        .filter((r) => !r.isGuest)
        .map((r) => ({ employeeId: r.employeeId, fullName: r.fullName, homeOutletName: r.homeOutletName, isHome: true }));
    }
    return bootstrap.directory
      .filter((d) => !homeIds.has(d.employeeId))
      .map((d) => ({ employeeId: d.employeeId, fullName: d.fullName, homeOutletName: d.homeOutletName, isHome: false }));
  }, [bootstrap, tab]);

  const q = norm(query.trim());
  const matches = q ? people.filter((p) => norm(p.fullName).includes(q)) : people;
  const shown = matches.slice(0, MAX_SHOWN);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Pilih nama kamu</h1>
        <button type="button" onClick={onCancel} className={btnQuiet}>
          Batal
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg border border-ink-700 bg-ink-800 p-1" role="group" aria-label="Asal kru">
        {(
          [
            ['home', 'Kru cabang ini'],
            ['other', 'Kru cabang lain'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-14 rounded-md text-base font-medium ${tab === key ? 'bg-brand-400 text-ink' : 'text-slate-300 hover:bg-ink-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="relative block">
        <span className="sr-only">Cari nama</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ketik nama"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="block min-h-14 w-full rounded-lg border border-ink-600 bg-ink-800 pl-12 pr-4 text-lg text-white placeholder:text-slate-500 focus:border-brand-400 focus:outline-none"
        />
      </label>

      <ul className="flex-1 space-y-2 overflow-y-auto" aria-label="Daftar nama">
        {shown.map((p) => (
          <li key={p.employeeId}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-left hover:bg-ink-700 active:bg-ink-900"
            >
              <span className="text-lg font-medium text-white">{p.fullName}</span>
              {!p.isHome && <span className="text-sm text-slate-400">{p.homeOutletName}</span>}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="py-8 text-center text-base text-slate-400">Nama tidak ditemukan</li>}
        {matches.length > MAX_SHOWN && (
          <li className="py-2 text-center text-sm text-slate-400">Ketik nama untuk mempersempit daftar</li>
        )}
      </ul>
    </main>
  );
}
