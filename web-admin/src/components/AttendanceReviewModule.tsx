'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { apiBlob, apiFetch } from '@/lib/api';
import { BACKEND_API } from '@/lib/auth';
import { EVENT_TYPE_LABEL, flagClass, flagLabel } from '@/lib/attendanceFlags';

type Tab = 'NEEDS_REVIEW' | 'REJECTED';
type Decision = 'accept' | 'reject';

export interface ReviewRow {
  id: string;
  type: string;
  method: string;
  effectiveTime: string;
  status: string;
  applied: boolean;
  reason: string | null;
  flags: string[];
  employee: { id: string; fullName: string; homeOutletName: string };
  outlet: { id: string; name: string };
  photoUrl: string | null;
  enrolledPhotoUrl: string | null;
}

interface OutletOption {
  id: string;
  name: string;
}

const BACKEND_ORIGIN = BACKEND_API.replace(/\/api\/v1\/?$/, '');
const API_PREFIX = /^\/api\/v1/;
const whenFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Dampak keputusan, ditampilkan sebelum HR mengonfirmasi. */
function effectOf(row: ReviewRow, decision: Decision): string {
  if (decision === 'accept') {
    // Event yang tidak diterapkan (urutan tidak sah, PIN/foto bermasalah, akun nonaktif) tidak
    // pernah masuk absen: "Terima" hanya menandai sudah dilihat
    if (!row.applied) {
      return 'Hanya ditandai sudah dilihat. Absen ini tidak dicatat ke presensi; bila perlu dicatat, perbaiki lewat Koreksi Absen.';
    }
    return 'Absen ini dianggap sah dan hilang dari daftar tinjauan.';
  }
  if (!row.applied) return 'Absen ini tidak dicatat dan dipindah ke daftar Ditolak.';
  switch (row.type) {
    case 'CLOCK_IN':
      return 'Absen hari ini dibatalkan.';
    case 'BREAK_START':
    case 'BREAK_END':
      return 'Istirahat ini tidak dihitung.';
    case 'CLOCK_OUT':
      return 'Jam pulang dihapus. Kru dianggap belum pulang.';
    default:
      return 'Absen ini ditolak.';
  }
}

/** Foto acuan disimpan privat: diambil dengan token lalu ditampilkan lewat object URL. */
function EnrolledPhoto({ path, name }: { path: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    apiBlob(path.replace(API_PREFIX, ''))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (failed) return <div className="flex h-28 w-24 items-center justify-center rounded-md bg-slate-100 p-2 text-center text-xs text-slate-500">Foto tidak bisa dimuat</div>;
  if (!src) return <div className="flex h-28 w-24 items-center justify-center rounded-md bg-slate-100"><Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Foto terdaftar ${name}`} className="h-28 w-24 rounded-md object-cover" />;
}

function Photos({ row }: { row: ReviewRow }) {
  const box = 'flex h-28 w-24 items-center justify-center rounded-md bg-slate-100 p-2 text-center text-xs text-slate-500';
  return (
    <div className="flex gap-2">
      <figure className="space-y-1">
        {row.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${BACKEND_ORIGIN}${row.photoUrl}`} alt={`Foto absen ${row.employee.fullName}`} className="h-28 w-24 rounded-md object-cover" />
        ) : (
          <div className={box}>Tanpa foto</div>
        )}
        <figcaption className="text-xs text-slate-500">Foto absen</figcaption>
      </figure>
      <figure className="space-y-1">
        {row.enrolledPhotoUrl ? <EnrolledPhoto path={row.enrolledPhotoUrl} name={row.employee.fullName} /> : <div className={box}>Belum terdaftar</div>}
        <figcaption className="text-xs text-slate-500">Foto terdaftar</figcaption>
      </figure>
    </div>
  );
}

/**
 * Absen tablet yang meragukan. Menunggu = perlu keputusan HR; Ditolak = riwayat.
 * onChanged dipanggil setelah keputusan supaya angka di menu ikut diperbarui.
 */
export default function AttendanceReviewModule({ onChanged }: { onChanged?: () => void }) {
  const [tab, setTab] = useState<Tab>('NEEDS_REVIEW');
  const [outletId, setOutletId] = useState('');
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<{ id: string; decision: Decision } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    apiFetch<OutletOption[]>('/outlets').then(setOutlets).catch(() => setOutlets([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ status: tab });
      if (outletId) q.set('outletId', outletId);
      setRows(await apiFetch<ReviewRow[]>(`/attendance-review?${q}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, outletId]);

  useEffect(() => {
    setRows(null);
    setPending(null);
    load();
  }, [load]);

  async function decide(row: ReviewRow, decision: Decision) {
    setBusy(true);
    setNotice(null);
    try {
      await apiFetch(`/attendance-review/${row.id}/${decision}`, { method: 'POST' });
      setNotice({
        ok: true,
        text: `Absen ${row.employee.fullName} (${EVENT_TYPE_LABEL[row.type]?.toLowerCase() ?? row.type}) ${decision === 'accept' ? 'diterima' : 'ditolak'}.`,
      });
      setPending(null);
      onChanged?.();
    } catch (e) {
      // Mis. sudah ditinjau orang lain: daftar dimuat ulang supaya sesuai kenyataan
      setNotice({ ok: false, text: (e as Error).message });
      setPending(null);
      onChanged?.();
    } finally {
      setBusy(false);
      await load();
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented" role="group" aria-label="Status tinjauan">
            {([['NEEDS_REVIEW', 'Menunggu'], ['REJECTED', 'Ditolak']] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className="segmented-item">
                {label}
              </button>
            ))}
          </div>
          {outlets.length > 1 && (
            <>
              <label className="sr-only" htmlFor="review-outlet">Cabang</label>
              <select id="review-outlet" value={outletId} onChange={(e) => setOutletId(e.target.value)} className="input w-auto">
                <option value="">Semua cabang</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <button type="button" onClick={load} disabled={loading} className="btn btn-secondary self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden /> Muat ulang
        </button>
      </div>

      <p className="max-w-3xl text-slate-600">
        {tab === 'NEEDS_REVIEW'
          ? 'Absen dari tablet yang wajahnya belum cocok atau perlu dicek. Bandingkan foto absen dengan foto terdaftar, lalu terima atau tolak.'
          : 'Absen yang sudah ditolak. Daftar ini hanya riwayat.'}
      </p>

      {notice && (
        <p
          role={notice.ok ? 'status' : 'alert'}
          className={notice.ok ? 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800' : 'alert-error'}
        >
          {notice.text}
        </p>
      )}

      <div className="card overflow-hidden">
        {error ? (
          <div role="alert" className="alert-error rounded-none border-0 p-8 text-center">
            <p>Gagal memuat daftar: {error}</p>
            <button type="button" onClick={load} className="btn btn-secondary mt-3">Coba lagi</button>
          </div>
        ) : rows === null ? (
          <p className="empty-state flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
          </p>
        ) : rows.length === 0 ? (
          <p className="empty-state">
            {tab === 'NEEDS_REVIEW' ? 'Tidak ada absen yang menunggu tinjauan.' : 'Belum ada absen yang ditolak.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => {
              const active = pending?.id === row.id ? pending : null;
              const guest = row.employee.homeOutletName !== row.outlet.name;
              return (
                <li key={row.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
                  <Photos row={row} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="font-medium text-slate-900">
                      {row.employee.fullName}
                      <span className="ml-2 font-normal text-slate-600">{EVENT_TYPE_LABEL[row.type] ?? row.type}</span>
                    </p>
                    <p className="text-slate-700">
                      {whenFmt.format(new Date(row.effectiveTime))} · {row.outlet.name}
                      {guest && <span className="text-slate-500"> (kru {row.employee.homeOutletName})</span>}
                    </p>
                    {row.reason && <p className="text-slate-700">Alasan: {row.reason}</p>}
                    {row.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {row.flags.map((f) => (
                          <span key={f} className={flagClass(f)}>{flagLabel(f)}</span>
                        ))}
                      </div>
                    )}
                    {tab === 'NEEDS_REVIEW' && (
                      <div className="pt-1">
                        {active ? (
                          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                            <p className="text-slate-800">{effectOf(row, active.decision)}</p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => decide(row, active.decision)}
                                className={`btn btn-sm ${active.decision === 'reject' ? 'btn-danger' : 'btn-primary'}`}
                              >
                                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                                {active.decision === 'reject' ? 'Ya, tolak' : 'Ya, terima'}
                              </button>
                              <button type="button" disabled={busy} onClick={() => setPending(null)} className="btn btn-ghost btn-sm">
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setPending({ id: row.id, decision: 'accept' }); setNotice(null); }} className="btn btn-primary btn-sm">
                              Terima
                            </button>
                            <button type="button" onClick={() => { setPending({ id: row.id, decision: 'reject' }); setNotice(null); }} className="btn btn-danger-outline btn-sm">
                              Tolak
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
