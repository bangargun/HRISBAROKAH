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
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 text-center text-slate-300">
      {state === 'offline' ? (
        <div role="alert">
          <p className="text-sm">Server HRIS tidak bisa dihubungi. Pastikan backend sudah berjalan.</p>
          <button
            type="button"
            onClick={check}
            className="btn mt-4 border border-slate-500 px-4 text-slate-100 hover:bg-ink-700 active:bg-ink-600"
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
