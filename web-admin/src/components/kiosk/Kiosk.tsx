'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DeviceRevokedError, KioskNetworkError, kioskFetch } from '@/lib/kiosk/api';
import { enqueue, recentEvents, type QueuedSummary } from '@/lib/kiosk/db';
import { setIdleCheck } from '@/lib/kiosk/device';
import { bestMatch, loadFace, type FaceCapture } from '@/lib/kiosk/face';
import { allowedActions, currentDay, type CurrentDay } from '@/lib/kiosk/status';
import { syncNow, type SyncState } from '@/lib/kiosk/sync';
import { lateMinutesAt, personFor, recapFor, type Person } from '@/lib/kiosk/today';
import type { BootstrapPayload, DeviceConfig, KioskEventType, KioskMethod, QueuedEvent } from '@/lib/kiosk/types';
import Board from './Board';
import Capture, { NotRecognized } from './Capture';
import Greeting, { Recorded } from './Greeting';
import GuestPicker, { type PickerTab } from './GuestPicker';
import MyRecap from './MyRecap';
import PinPad from './PinPad';

type Greet = {
  person: Person;
  day: CurrentDay;
  method: KioskMethod;
  localScore?: number;
  photoBase64: string;
  pin?: string;
  error: string | null;
};

type Step =
  | { kind: 'board' }
  | { kind: 'capture-face' }
  | { kind: 'identifying' }
  | { kind: 'not-recognized'; reason: string }
  | { kind: 'picker'; tab: PickerTab }
  | { kind: 'pin'; person: Person }
  | { kind: 'capture-pin'; person: Person; pin: string }
  | ({ kind: 'greeting' } & Greet)
  | { kind: 'recorded'; person: Person; type: KioskEventType; at: Date; lateMinutes: number | null; canRecap: boolean }
  | { kind: 'recap'; person: Person };

// Layar kembali ke papan bila tidak disentuh selama ini (privasi: nama dan rekap tidak tertinggal)
const IDLE_MS: Partial<Record<Step['kind'], number>> = {
  'capture-face': 60_000,
  'capture-pin': 60_000,
  'not-recognized': 30_000,
  picker: 60_000,
  pin: 45_000,
  greeting: 20_000,
  // Cadangan bila permintaan identify tetap menggantung (batas fetch IDENTIFY_TIMEOUT_MS lebih dulu)
  identifying: 20_000,
  recorded: 10_000,
};
// Event antre yang dibaca untuk status papan (aturan absen terbuka 16 jam + cadangan)
const RECENT_WINDOW_MS = 48 * 3600_000;

// Server lambat / tidak terjangkau saat identify: hentikan dan tawarkan nama + PIN
const IDENTIFY_TIMEOUT_MS = 9_000;

const OFFLINE_REASON = 'Tablet sedang offline. Pakai nama dan PIN; absen tetap tersimpan dan terkirim saat online.';
const SLOW_REASON = 'Server belum menjawab. Pakai nama dan PIN; absen tetap tersimpan dan terkirim saat online.';

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

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

export interface KioskProps {
  config: DeviceConfig;
  sync: SyncState | null;
  bootstrap: BootstrapPayload | null;
}

/** Alur absen tablet (spec §4): papan, wajah, sapaan + aksi, tercatat, rekap; jalur nama + PIN. */
export default function Kiosk({ config, sync, bootstrap }: KioskProps) {
  const now = useServerClock(config.offsetMs);
  const [step, setStep] = useState<Step>({ kind: 'board' });
  const [queued, setQueued] = useState<QueuedSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState(0);
  const stepRef = useRef(step);
  stepRef.current = step;
  const inFlight = useRef(false);
  const serverNow = useCallback(() => new Date(Date.now() + config.offsetMs), [config.offsetMs]);
  const identifyAbort = useRef<AbortController | null>(null);
  const toBoard = useCallback(() => {
    identifyAbort.current?.abort();
    setStep({ kind: 'board' });
  }, []);

  const refreshQueue = useCallback(async () => {
    const rows = await recentEvents(new Date(Date.now() - RECENT_WINDOW_MS).toISOString());
    setQueued(rows);
    return rows;
  }, []);

  // Antrean dibaca ulang saat sinkron mengirim / bootstrap baru dimuat
  useEffect(() => {
    refreshQueue().catch(() => undefined);
  }, [refreshQueue, sync?.pending, sync?.lastSync, bootstrap]);

  // Deploy baru hanya dimuat ulang saat papan diam (tidak ada kamera, sapaan, PIN, rekap)
  useEffect(() => setIdleCheck(() => stepRef.current.kind === 'board' && !inFlight.current), []);

  // Model wajah dimuat di latar setelah papan tampil, agar absen pertama tidak menunggu
  const hasBootstrap = !!bootstrap;
  useEffect(() => {
    if (!hasBootstrap) return;
    const id = setTimeout(() => loadFace().catch(() => undefined), 1500);
    return () => clearTimeout(id);
  }, [hasBootstrap]);

  // Kembali ke papan bila layar ditinggal
  useEffect(() => {
    const ms = IDLE_MS[step.kind];
    if (!ms || busy) return;
    const id = setTimeout(toBoard, ms);
    return () => clearTimeout(id);
  }, [step, activity, busy, toBoard]);
  useEffect(() => {
    const bump = () => setActivity((a) => a + 1);
    document.addEventListener('pointerdown', bump);
    document.addEventListener('keydown', bump);
    return () => {
      document.removeEventListener('pointerdown', bump);
      document.removeEventListener('keydown', bump);
    };
  }, []);

  // `from` = langkah yang memulai sapaan; bila layar sudah berpindah (Batal, kembali ke papan)
  // selama antrean dibaca, sapaan tidak ditampilkan
  const greet = useCallback(
    async (g: Omit<Greet, 'day' | 'error'>, from: Step['kind']) => {
      if (!bootstrap) return;
      const rows = await refreshQueue().catch(() => queued);
      if (stepRef.current.kind !== from) return;
      const day = currentDay(bootstrap.today, rows, g.person.employeeId, serverNow());
      setStep({ kind: 'greeting', ...g, day, error: null });
    },
    [bootstrap, queued, refreshQueue, serverNow],
  );

  const identifyOnline = useCallback(
    async (c: FaceCapture) => {
      if (!bootstrap) return;
      if (!navigator.onLine) {
        setStep({ kind: 'not-recognized', reason: OFFLINE_REASON });
        return;
      }
      setStep({ kind: 'identifying' });
      // AbortController + setTimeout, bukan AbortSignal.timeout (belum ada di Chrome Android lama).
      // Batas juga mencakup pembacaan isi respons.
      const controller = new AbortController();
      identifyAbort.current = controller;
      const timer = setTimeout(() => controller.abort(), IDENTIFY_TIMEOUT_MS);
      try {
        const res = await kioskFetch('/kiosk/identify', {
          method: 'POST',
          body: JSON.stringify({ photoBase64: c.jpegBase64 }),
          signal: controller.signal,
        });
        if (stepRef.current.kind !== 'identifying') return; // dibatalkan
        if (res.ok) {
          const body = (await res.json()) as { employeeId: string; fullName: string; homeOutletName: string; score: number };
          clearTimeout(timer);
          if (stepRef.current.kind !== 'identifying') return;
          const person = personFor(bootstrap, body.employeeId, body);
          await greet({ person, method: 'FACE_SERVER', photoBase64: c.jpegBase64 }, 'identifying');
          return;
        }
        const reason =
          res.status === 429
            ? 'Terlalu banyak percobaan pengenalan wajah. Pakai nama dan PIN.'
            : 'Wajah belum terdaftar atau kurang jelas. Pakai nama dan PIN, atau coba wajah lagi.';
        setStep({ kind: 'not-recognized', reason });
      } catch (err) {
        if (err instanceof DeviceRevokedError) return; // halaman kembali ke layar pasangan
        if (stepRef.current.kind !== 'identifying') return;
        // Batas waktu (abort) diperlakukan seperti offline: fetch yang dibatalkan juga KioskNetworkError
        const timedOut = controller.signal.aborted;
        setStep({
          kind: 'not-recognized',
          reason: timedOut ? SLOW_REASON : err instanceof KioskNetworkError ? OFFLINE_REASON : 'Pengenalan wajah gagal. Pakai nama dan PIN.',
        });
      } finally {
        clearTimeout(timer);
        if (identifyAbort.current === controller) identifyAbort.current = null;
      }
    },
    [bootstrap, greet],
  );

  const onFaceCaptured = useCallback(
    (c: FaceCapture) => {
      if (!bootstrap) return;
      const match = bestMatch(c.embedding, bootstrap.roster, bootstrap.matchThreshold);
      if (match) {
        void greet({ person: personFor(bootstrap, match.employeeId), method: 'FACE_LOCAL', localScore: match.score, photoBase64: c.jpegBase64 }, 'capture-face');
      } else {
        void identifyOnline(c);
      }
    },
    [bootstrap, greet, identifyOnline],
  );

  const record = useCallback(
    async (g: Greet, type: KioskEventType) => {
      if (!bootstrap || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      const deviceNow = new Date();
      const event: QueuedEvent = {
        id: newId(),
        employeeId: g.person.employeeId,
        type,
        method: g.method,
        deviceTime: deviceNow.toISOString(),
        offsetAtEventMs: config.offsetMs,
        ...(g.localScore !== undefined ? { localScore: Number(g.localScore.toFixed(4)) } : {}),
        photoBase64: g.photoBase64,
        ...(g.pin ? { pin: g.pin } : {}),
      };
      try {
        await enqueue(event);
        const at = new Date(deviceNow.getTime() + config.offsetMs);
        const lateMinutes = type === 'CLOCK_IN' ? lateMinutesAt(bootstrap, g.person.employeeId, at) : null;
        // Rekap hanya setelah wajah cocok (lokal atau server), bukan setelah PIN yang belum diperiksa
        setStep({ kind: 'recorded', person: g.person, type, at, lateMinutes, canRecap: g.method !== 'PIN' });
        syncNow();
        await refreshQueue().catch(() => undefined);
      } catch {
        setStep({ kind: 'greeting', ...g, error: 'Absen gagal disimpan di tablet. Coba tekan lagi.' });
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [bootstrap, config.offsetMs, refreshQueue],
  );

  if (!bootstrap || step.kind === 'board') {
    return (
      <Board
        config={config}
        sync={sync}
        bootstrap={bootstrap}
        queued={queued}
        now={now}
        onAbsen={() => setStep({ kind: 'capture-face' })}
        onOtherOutlet={() => setStep({ kind: 'picker', tab: 'other' })}
      />
    );
  }

  switch (step.kind) {
    case 'capture-face':
      return (
        <Capture
          title="Lihat ke kamera"
          requireLive
          onCaptured={onFaceCaptured}
          onCancel={toBoard}
          onUsePin={() => setStep({ kind: 'picker', tab: 'home' })}
        />
      );
    case 'identifying':
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
          <p className="inline-flex items-center gap-3 text-xl text-slate-200" role="status">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            Mencari wajah di semua cabang…
          </p>
          <button type="button" onClick={toBoard} className="btn min-h-14 px-6 text-lg text-slate-300 hover:bg-ink-800">
            Batal
          </button>
        </main>
      );
    case 'not-recognized':
      return (
        <NotRecognized
          reason={step.reason}
          onRetry={() => setStep({ kind: 'capture-face' })}
          onUsePin={() => setStep({ kind: 'picker', tab: 'home' })}
          onCancel={toBoard}
        />
      );
    case 'picker':
      return <GuestPicker bootstrap={bootstrap} initialTab={step.tab} onPick={(person) => setStep({ kind: 'pin', person })} onCancel={toBoard} />;
    case 'pin': {
      const entry = bootstrap.roster.find((r) => r.employeeId === step.person.employeeId);
      return (
        <PinPad
          person={step.person}
          hasPin={entry ? entry.hasPin : undefined}
          onSubmit={(pin) => setStep({ kind: 'capture-pin', person: step.person, pin })}
          onCancel={toBoard}
        />
      );
    }
    case 'capture-pin':
      return (
        <Capture
          title="Foto untuk absen PIN"
          requireLive={false}
          onCaptured={(c) => void greet({ person: step.person, method: 'PIN', photoBase64: c.jpegBase64, pin: step.pin }, 'capture-pin')}
          onCancel={toBoard}
        />
      );
    case 'greeting':
      return (
        <Greeting
          person={step.person}
          day={step.day}
          actions={allowedActions(step.day.status)}
          viaPin={step.method === 'PIN'}
          busy={busy}
          error={step.error}
          onAction={(type) => void record(step, type)}
          onNotMe={toBoard}
          onRecap={() => setStep({ kind: 'recap', person: step.person })}
        />
      );
    case 'recorded':
      return (
        <Recorded
          person={step.person}
          type={step.type}
          at={step.at}
          lateMinutes={step.lateMinutes}
          onRecap={step.canRecap ? () => setStep({ kind: 'recap', person: step.person }) : null}
          onDone={toBoard}
        />
      );
    case 'recap':
      return <MyRecap person={step.person} rows={recapFor(bootstrap, queued, step.person, serverNow())} onClose={toBoard} />;
  }
}
