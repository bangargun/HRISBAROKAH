'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { verifySession } from '@/lib/auth';

const PUBLIC_PATHS = ['/login'];

/** Halaman admin hanya tampil setelah token dicek ke backend. */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const [state, setState] = useState<'checking' | 'ok' | 'offline'>('checking');

  const check = useCallback(async () => {
    setState('checking');
    try {
      const user = await verifySession();
      if (user) {
        setState('ok');
      } else {
        router.replace('/login');
      }
    } catch {
      setState('offline');
    }
  }, [router]);

  useEffect(() => {
    if (!isPublic) check();
  }, [isPublic, check]);

  if (isPublic || state === 'ok') return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-center text-slate-300">
      {state === 'offline' ? (
        <div>
          <p className="text-sm">Server HRIS tidak bisa dihubungi. Pastikan backend sudah berjalan.</p>
          <button
            type="button"
            onClick={check}
            className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Memeriksa sesi" />
      )}
    </div>
  );
}
