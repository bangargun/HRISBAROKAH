'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Loader2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Dialog from '@/components/Dialog';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';

interface BankChange {
  id: string;
  status: Status;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: { username: string } | null;
  employee: {
    id: string;
    nik: string;
    fullName: string;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankAccountHolder: string | null;
    outlet: { name: string };
    position: { title: string };
  };
}

const STATUS_LABEL: Record<Status, string> = { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak' };
const STATUS_CLASS: Record<Status, string> = { PENDING: 'badge badge-warning', APPROVED: 'badge badge-success', REJECTED: 'badge badge-neutral' };

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Account({ name, number, holder }: { name: string | null; number: string | null; holder: string | null }) {
  if (!number) return <span className="text-slate-500">Belum ada</span>;
  return (
    <div>
      <div className="font-medium text-slate-900">{name ?? '–'}</div>
      <div className="font-mono text-sm text-slate-800">{number}</div>
      <div className="text-xs text-slate-500">a.n. {holder ?? '–'}</div>
    </div>
  );
}

/**
 * Pengajuan rekening gaji dari aplikasi kru. Rekening lama tetap dipakai untuk gaji sampai HR
 * menyetujui; cocokkan nama pemilik rekening dengan nama karyawan sebelum menyetujui.
 */
export default function BankChangesModule({ showToast, onChanged }: { showToast: (msg: string) => void; onChanged: () => void }) {
  const [view, setView] = useState<'PENDING' | 'DONE'>('PENDING');
  const [rows, setRows] = useState<BankChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<BankChange | null>(null);

  const load = useCallback(() => {
    setRows(null);
    setError(null);
    const query = view === 'PENDING' ? '?status=PENDING' : '';
    apiFetch<BankChange[]>(`/bank-changes${query}`)
      .then((list) => setRows(view === 'PENDING' ? list : list.filter((r) => r.status !== 'PENDING')))
      .catch((e) => setError((e as Error).message));
  }, [view]);
  useEffect(load, [load]);

  async function approve(row: BankChange) {
    setBusyId(row.id);
    setError(null);
    try {
      await apiFetch(`/bank-changes/${row.id}/approve`, { method: 'POST' });
      showToast(`Rekening ${row.employee.fullName} diganti`);
      onChanged();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          Kru mengajukan rekening gaji baru dari aplikasi HP. Gaji tetap dibayar ke rekening lama sampai pengajuan disetujui.
          Cocokkan nama pemilik rekening dengan nama karyawan sebelum menyetujui.
        </p>
        <div role="tablist" aria-label="Tampilan" className="inline-flex rounded-md border border-slate-200 p-0.5">
          {(['PENDING', 'DONE'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded px-3 py-1.5 text-sm ${view === v ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              {v === 'PENDING' ? 'Menunggu' : 'Riwayat'}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="alert-error">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Karyawan</th>
              {view === 'PENDING' && (
                <>
                  <th scope="col" className="px-4 py-3">Rekening sekarang</th>
                  <th scope="col" className="px-4 py-3" aria-label="Menjadi" />
                </>
              )}
              <th scope="col" className="px-4 py-3">Rekening diajukan</th>
              <th scope="col" className="px-4 py-3 text-right">{view === 'PENDING' ? 'Keputusan' : 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null ? (
              <tr><td colSpan={view === 'PENDING' ? 5 : 3} className="px-4 py-6 text-slate-500">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={view === 'PENDING' ? 5 : 3} className="empty-state">
                  {view === 'PENDING' ? 'Tidak ada pengajuan rekening yang menunggu.' : 'Belum ada pengajuan yang diproses.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const holderDiffers = r.bankAccountHolder.trim().toLowerCase() !== r.employee.fullName.trim().toLowerCase();
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.employee.fullName}</div>
                      <div className="text-xs text-slate-500">{r.employee.position.title} · {r.employee.outlet.name}</div>
                      <div className="text-xs text-slate-500">Diajukan {dateTime(r.createdAt)}</div>
                    </td>
                    {view === 'PENDING' && (
                      <>
                        <td className="px-4 py-3">
                          <Account name={r.employee.bankName} number={r.employee.bankAccountNumber} holder={r.employee.bankAccountHolder} />
                        </td>
                        <td className="px-2 py-3 text-slate-400"><ArrowRight className="h-4 w-4" aria-hidden /></td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <Account name={r.bankName} number={r.bankAccountNumber} holder={r.bankAccountHolder} />
                      {holderDiffers && (
                        <p className="mt-1 text-xs font-medium text-amber-700">Nama pemilik berbeda dari nama karyawan</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'PENDING' ? (
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={!!busyId} onClick={() => setRejecting(r)} className="btn btn-sm btn-ghost">
                            <X className="h-4 w-4" aria-hidden /> Tolak
                          </button>
                          <button type="button" disabled={!!busyId} onClick={() => approve(r)} className="btn btn-sm btn-primary">
                            {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                            Setujui
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
                          <div className="text-xs text-slate-500">
                            {r.reviewedBy?.username ?? '–'}{r.reviewedAt ? ` · ${dateTime(r.reviewedAt)}` : ''}
                          </div>
                          {r.note && <div className="text-xs text-slate-600">{r.note}</div>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <RejectDialog
          change={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            showToast(`Pengajuan rekening ${rejecting.employee.fullName} ditolak`);
            setRejecting(null);
            onChanged();
            load();
          }}
        />
      )}
    </div>
  );
}

function RejectDialog({ change, onClose, onDone }: { change: BankChange; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/bank-changes/${change.id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog title={`Tolak rekening ${change.employee.fullName}`} onClose={() => !busy && onClose()}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Alasan (dibaca kru di aplikasi HP)</span>
          <textarea
            required
            minLength={5}
            maxLength={300}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Misalnya: nama pemilik rekening harus atas nama sendiri"
            className="input"
          />
        </label>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={busy} onClick={onClose} className="btn btn-ghost">Batal</button>
          <button type="submit" disabled={busy} className="btn btn-danger">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Tolak pengajuan
          </button>
        </div>
      </form>
    </Dialog>
  );
}
