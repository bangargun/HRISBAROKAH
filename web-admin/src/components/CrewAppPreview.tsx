'use client';

import React, { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';

// Aplikasi HP kru (Flutter) versi web, disajikan terpisah; lihat mobile_user/tool/build-web-preview.sh
const CREW_APP_URL = process.env.NEXT_PUBLIC_CREW_APP_URL || 'http://localhost:3003';

/** Aplikasi HP kru yang sebenarnya, tampil dalam bingkai seukuran HP. Data yang sama dengan aplikasi di HP. */
export default function CrewAppPreview() {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="flex flex-col gap-6 text-sm lg:flex-row lg:items-start">
      <div className="mx-auto shrink-0 rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-xl">
        <iframe
          key={reloadKey}
          src={CREW_APP_URL}
          title="Aplikasi kru"
          className="h-[760px] w-[375px] rounded-[1.8rem] bg-white"
        />
      </div>
      <div className="max-w-md space-y-3 text-slate-700">
        <h3 className="text-base font-semibold text-slate-900">Aplikasi HP kru</h3>
        <p>
          Ini aplikasi yang sama dengan yang dipasang di HP kru, tersambung ke data asli. Masuk dengan akun kru atau kepala
          cabang untuk melihat tampilan mereka; semua yang dikirim dari sini langsung tampil di Presensi, Persetujuan dan
          Laporan Harian.
        </p>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          Absen masuk/pulang dengan verifikasi wajah hanya bisa dari HP, karena butuh kamera dan pendeteksi wajah di
          perangkat.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Muat ulang
          </button>
          <a
            href={CREW_APP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> Buka di tab baru
          </a>
        </div>
        <p className="text-xs text-slate-500">
          Tidak tampil? Aplikasi versi web perlu dibangun dulu dengan <code>mobile_user/tool/build-web-preview.sh</code>.
        </p>
      </div>
    </div>
  );
}
