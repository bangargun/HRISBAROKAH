'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Tablet } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Device {
  id: string;
  name: string;
  pairedAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

interface Pairing {
  code: string;
  expiresAt: string;
}

const STALE_MS = 24 * 3600_000;

/** "5 menit lalu", "3 jam lalu"; null berarti belum pernah terhubung. */
function relative(iso: string | null, now: number) {
  if (!iso) return 'Belum pernah online';
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Tablet absensi satu cabang. Hanya HR dan Super Admin yang bisa memasangkan atau mencabut
 * (canManage); Store Manager hanya melihat daftar.
 */
export default function OutletDevicesPanel({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [naming, setNaming] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [creating, setCreating] = useState(false);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<Device[]>(`/outlets/${outletId}/devices`);
      setDevices(list);
      setError(null);
      return list;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [outletId]);

  useEffect(() => {
    load().then((list) => {
      if (list) knownIds.current = new Set(list.map((d) => d.id));
    });
  }, [load]);

  // Detik berjalan selama ada kode; daftar dimuat ulang tiap 5 detik supaya tablet yang baru
  // terpasang langsung muncul dan kodenya ditutup
  useEffect(() => {
    if (!pairing) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      const list = await load();
      if (list?.some((d) => !knownIds.current.has(d.id))) {
        knownIds.current = new Set(list.map((d) => d.id));
        setPairing(null);
        setNotice('Tablet terpasang.');
      }
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [pairing, load]);

  async function createCode(e?: React.SyntheticEvent) {
    e?.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<Pairing>(`/outlets/${outletId}/devices/pairing`, {
        method: 'POST',
        body: JSON.stringify({ deviceName: deviceName.trim() }),
      });
      setNow(Date.now());
      setPairing(res);
      setNaming(false);
      setDeviceName('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/outlets/${outletId}/devices/${id}/revoke`, { method: 'POST' });
      setRevoking(null);
      setNotice('Tablet dicabut.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const remaining = pairing ? new Date(pairing.expiresAt).getTime() - now : 0;

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Tablet absen</p>
        {canManage && !naming && (
          <button type="button" onClick={() => { setNaming(true); setPairing(null); setNotice(null); }} className="btn btn-secondary btn-sm">
            <Tablet className="h-3.5 w-3.5" aria-hidden /> Pasangkan tablet
          </button>
        )}
      </div>

      {naming && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="block min-w-0 flex-1 space-y-1">
            <span className="field-label">Nama tablet</span>
            <input
              required
              maxLength={40}
              autoFocus
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              onKeyDown={(e) => {
                // Enter di sini tidak boleh ikut mengirim form cabang
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (deviceName.trim() && !creating) createCode(e);
                }
              }}
              placeholder="Tablet kasir depan"
              className="input"
            />
          </label>
          <button type="button" disabled={!deviceName.trim() || creating} onClick={createCode} className="btn btn-primary">
            {creating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Buat kode
          </button>
          <button type="button" onClick={() => setNaming(false)} className="btn btn-ghost">
            Batal
          </button>
        </div>
      )}

      {pairing && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center" role="status">
          {remaining > 0 ? (
            <>
              <p className="font-mono text-3xl font-semibold tracking-[0.3em] text-slate-900" aria-label={`Kode pasangan ${pairing.code.split('').join(' ')}`}>
                {pairing.code}
              </p>
              <p className="mt-2 text-xs tabular-nums text-slate-600">Berlaku {clock(remaining)} lagi</p>
              <p className="mt-2 text-slate-700">
                Buka hris.barokahgroupindonesia.tech/absen di tablet, masukkan kode ini
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-slate-800">Kode sudah tidak berlaku.</p>
              <button type="button" onClick={() => { setPairing(null); setNaming(true); }} className="btn btn-secondary btn-sm mt-2">
                Buat kode baru
              </button>
            </>
          )}
        </div>
      )}

      {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="alert-error">{error}</p>}

      {devices === null ? (
        !error && (
          <p className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat tablet…
          </p>
        )
      ) : devices.length === 0 ? (
        <p className="text-slate-600">Belum ada tablet terpasang di cabang ini.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {devices.map((d) => {
            const stale = !d.revokedAt && (!d.lastSeenAt || now - new Date(d.lastSeenAt).getTime() > STALE_MS);
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {d.revokedAt ? 'Sudah dicabut' : `Terakhir online: ${relative(d.lastSeenAt, now)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {d.revokedAt && <span className="badge badge-neutral">Dicabut</span>}
                  {stale && <span className="badge badge-warning">Tidak online &gt; 24 jam</span>}
                  {canManage && !d.revokedAt && (
                    revoking === d.id ? (
                      <>
                        <span className="text-xs text-slate-600">Tablet ini tidak bisa absen lagi sampai dipasangkan ulang.</span>
                        <button type="button" disabled={busy} onClick={() => revoke(d.id)} className="btn btn-danger btn-sm">
                          Ya, cabut
                        </button>
                        <button type="button" disabled={busy} onClick={() => setRevoking(null)} className="btn btn-ghost btn-sm">
                          Batal
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setRevoking(d.id)} className="btn btn-danger-outline btn-sm">
                        Cabut
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
