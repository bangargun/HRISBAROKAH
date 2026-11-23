'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { captureAndDescribe, loadFace, type FaceCapture } from '@/lib/kiosk/face';
import { btnPrimary, btnQuiet, btnSecondary } from './ui';

// Jeda setelah video berjalan sebelum bingkai pertama diambil (kamera menyetel cahaya)
const SETTLE_MS = 900;
const NOT_LIVE = 'Ulangi, hadapkan wajah ke kamera';

type Phase = 'starting' | 'scanning' | 'retry' | 'camera-error';

export interface CaptureProps {
  title: string;
  // false untuk jalur nama + PIN: foto tetap wajib, cek hidup tidak menghalangi
  requireLive: boolean;
  onCaptured: (c: FaceCapture) => void;
  onCancel: () => void;
  // Ditawarkan setelah gagal berulang (jalur wajah)
  onUsePin?: () => void;
}

/** Kamera depan: ambil wajah otomatis, cek hidup, embedding + foto absen. */
export default function Capture({ title, requireLive, onCaptured, onCancel, onUsePin }: CaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [message, setMessage] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [ready, setReady] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  // Induk membuat ulang callback tiap render; pengambilan otomatis tidak boleh ikut terulang
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;

  useEffect(() => {
    alive.current = true;
    // Per efek (bukan ref bersama): di StrictMode efek dijalankan dua kali, dan aliran kamera
    // dari jalan pertama yang selesai belakangan harus tetap dimatikan
    let cancelled = false;
    let stream: MediaStream | null = null;
    const start = async () => {
      try {
        // Model dimuat bersamaan; galatnya muncul saat pengambilan (bisa diulang)
        loadFace().catch(() => undefined);
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current!;
        video.srcObject = s;
        await video.play();
        setTimeout(() => !cancelled && setReady(true), SETTLE_MS);
      } catch {
        if (!cancelled) setPhase('camera-error');
      }
    };
    void start();
    return () => {
      cancelled = true;
      alive.current = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const scan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busy.current) return;
    busy.current = true;
    setPhase('scanning');
    setMessage(null);
    try {
      const res = await captureAndDescribe(video);
      if (!alive.current) return;
      // Skor cek hidup ke konsol untuk menyetel REAL_MIN / LIVE_MIN di tablet nyata (remote debugging)
      if (!('error' in res)) console.info(`[absen] cek hidup real ${res.real.toFixed(3)} live ${res.liveScore.toFixed(3)} lolos ${res.live}`);
      if ('error' in res) {
        setMessage(res.error);
      } else if (requireLive && !res.live) {
        setMessage(NOT_LIVE);
      } else {
        onCapturedRef.current(res);
        return;
      }
      setFailures((f) => f + 1);
      setPhase('retry');
    } catch {
      if (!alive.current) return;
      setMessage('Pengenalan wajah gagal dimuat. Coba lagi.');
      setFailures((f) => f + 1);
      setPhase('retry');
    } finally {
      busy.current = false;
    }
  }, [requireLive]);

  // Pengambilan pertama otomatis setelah kamera siap
  useEffect(() => {
    if (ready) void scan();
  }, [ready, scan]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 py-6">
      <h1 className="text-center text-2xl font-semibold text-white">{title}</h1>

      {phase === 'camera-error' ? (
        <div role="alert" className="max-w-md text-center text-base text-slate-200">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-300" aria-hidden />
          Kamera tidak bisa dibuka. Izinkan kamera untuk halaman ini di pengaturan browser, lalu coba lagi.
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full max-w-xl overflow-hidden rounded-lg border border-ink-700 bg-black portrait:max-w-md portrait:aspect-[3/4]">
          {/* Pratinjau dicerminkan agar kru melihat dirinya seperti di cermin; foto tidak */}
          <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" aria-label="Pratinjau kamera depan" />
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-3/4 w-1/2 rounded-[50%] border-4 border-brand-400/80 portrait:w-2/3 portrait:h-2/3" />
          </div>
        </div>
      )}

      <div className="min-h-14 text-center" role="status" aria-live="polite">
        {phase === 'starting' && (
          <p className="inline-flex items-center gap-2 text-lg text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Menyiapkan kamera…
          </p>
        )}
        {phase === 'scanning' && (
          <p className="inline-flex items-center gap-2 text-lg text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Melihat wajah, tahan sebentar…
          </p>
        )}
        {phase === 'retry' && message && <p className="text-lg font-medium text-amber-200">{message}</p>}
      </div>

      <div className="flex w-full max-w-xl flex-wrap justify-center gap-3">
        {phase === 'retry' && (
          <button type="button" onClick={() => void scan()} className={btnPrimary}>
            Ulangi
          </button>
        )}
        {onUsePin && failures >= 2 && (
          <button type="button" onClick={onUsePin} className={btnSecondary}>
            <KeyRound className="h-5 w-5" aria-hidden />
            Pilih nama + PIN
          </button>
        )}
        <button type="button" onClick={onCancel} className={btnQuiet}>
          Batal
        </button>
      </div>
    </main>
  );
}

/** Wajah tidak dikenali (atau server tidak terjangkau): tawarkan nama + PIN. */
export function NotRecognized({ reason, onRetry, onUsePin, onCancel }: { reason: string; onRetry: () => void; onUsePin: () => void; onCancel: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-white">Wajah belum dikenali</h1>
        <p className="mt-2 max-w-md text-base text-slate-300">{reason}</p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-3">
        <button type="button" onClick={onUsePin} className={btnPrimary}>
          <KeyRound className="h-5 w-5" aria-hidden />
          Pilih nama + PIN
        </button>
        <button type="button" onClick={onRetry} className={btnSecondary}>
          Coba wajah lagi
        </button>
        <button type="button" onClick={onCancel} className={btnQuiet}>
          Kembali ke papan
        </button>
      </div>
    </main>
  );
}
