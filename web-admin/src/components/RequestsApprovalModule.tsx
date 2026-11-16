'use client';

import React, { useMemo, useState } from 'react';
import Dialog from '@/components/Dialog';
import { CheckCircle2, Loader2, Paperclip, RefreshCw, Wallet, XCircle } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import {
  AdminRequest,
  AdminRequestsStore,
  REQUEST_STATUS_LABEL,
  REQUEST_TYPE_LABEL,
  RequestStatus,
  RequestType,
  actionFor,
  isPending,
} from '@/lib/requests';

interface Props {
  store: AdminRequestsStore;
  title: string;
  description: string;
  /** Jenis pengajuan yang ditampilkan; kosong berarti semua jenis. */
  types?: RequestType[];
  /** Hanya tampilkan status ini (misalnya arsip yang sudah disetujui). */
  statuses?: RequestStatus[];
}

type Filter = 'mine' | 'pending' | 'done' | 'all';

const STATUS_STYLE: Record<RequestStatus, string> = {
  PENDING_STORE_MANAGER: 'bg-amber-50 text-amber-800 border-amber-200',
  PENDING_HR: 'bg-sky-50 text-sky-800 border-sky-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  DISBURSED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-800 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function formatDate(value: string | null) {
  return value ? dateFmt.format(new Date(value)) : '-';
}

function periodText(req: AdminRequest) {
  if (!req.startDate) return '-';
  const start = formatDate(req.startDate);
  const end = req.endDate && req.endDate !== req.startDate ? ` – ${formatDate(req.endDate)}` : '';
  return `${start}${end}${req.totalDays ? ` (${req.totalDays} hari)` : ''}`;
}

export default function RequestsApprovalModule({ store, title, description, types, statuses }: Props) {
  const role = getSessionUser()?.role;
  const [filter, setFilter] = useState<Filter>(statuses ? 'all' : 'mine');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<AdminRequest | null>(null);
  const [typeFilter, setTypeFilter] = useState<RequestType | 'ALL'>('ALL');

  const ofTypes = useMemo(
    () =>
      store.requests.filter(
        (r) => (!types || types.includes(r.type)) && (!statuses || statuses.includes(r.status)),
      ),
    [store.requests, types, statuses],
  );
  // Pilihan jenis hanya dari jenis yang memang ada di daftar
  const typeOptions = Array.from(new Set(ofTypes.map((r) => r.type)));
  const scoped = typeFilter === 'ALL' ? ofTypes : ofTypes.filter((r) => r.type === typeFilter);

  const mine = scoped.filter((r) => actionFor(r, role));
  const counts = {
    mine: mine.length,
    pending: scoped.filter((r) => isPending(r.status)).length,
    done: scoped.filter((r) => !isPending(r.status)).length,
    all: scoped.length,
  };

  const visible =
    filter === 'mine'
      ? mine
      : filter === 'pending'
        ? scoped.filter((r) => isPending(r.status))
        : filter === 'done'
          ? scoped.filter((r) => !isPending(r.status))
          : scoped;

  async function run(req: AdminRequest, task: () => Promise<void>, success: string) {
    setBusyId(req.id);
    setNotice(null);
    try {
      await task();
      setNotice({ kind: 'ok', text: success });
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  function approve(req: AdminRequest) {
    const action = actionFor(req, role);
    if (action === 'sm-review' || action === 'hr-review') {
      const next = action === 'sm-review' ? 'diteruskan ke HR' : 'disetujui';
      run(req, () => store.review(req.id, action, 'APPROVE'), `Pengajuan ${req.employee.fullName} ${next}.`);
    } else if (action === 'disburse') {
      run(req, () => store.disburse(req.id), `Kasbon ${req.employee.fullName} ditandai sudah dicairkan.`);
    }
  }

  function reject(req: AdminRequest, notes: string) {
    const action = actionFor(req, role);
    if (action !== 'sm-review' && action !== 'hr-review') return;
    setRejecting(null);
    run(req, () => store.review(req.id, action, 'REJECT', notes), `Pengajuan ${req.employee.fullName} ditolak.`);
  }

  const filters: { id: Filter; label: string }[] = statuses
    ? [{ id: 'all', label: 'Semua' }]
    : [
        { id: 'mine', label: 'Perlu tindakan Anda' },
        { id: 'pending', label: 'Sedang diproses' },
        { id: 'done', label: 'Selesai' },
        { id: 'all', label: 'Semua' },
      ];

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm text-xs">
      <header className="p-5 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="font-extrabold text-base text-slate-900">{title}</h4>
          <p className="text-[11px] text-slate-500 max-w-2xl mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => store.reload()}
          disabled={store.loading}
          className="self-start inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${store.loading ? 'animate-spin' : ''}`} aria-hidden />
          Muat ulang
        </button>
      </header>

      <div className="px-5 pt-4 flex flex-wrap items-center gap-2">
      {typeOptions.length > 1 && (
        <>
          <label className="sr-only" htmlFor="request-type-filter">Jenis pengajuan</label>
          <select
            id="request-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RequestType | 'ALL')}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700"
          >
            <option value="ALL">Semua jenis</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{REQUEST_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Saring pengajuan">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1.5 font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              filter === f.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label} <span className="opacity-70">({counts[f.id]})</span>
          </button>
        ))}
      </div>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`mx-5 mt-4 rounded-xl border px-3 py-2 font-semibold ${
            notice.kind === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="p-5">
        {store.error && store.requests.length === 0 ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">
            <p className="font-semibold">{store.error}</p>
            <button
              type="button"
              onClick={() => store.reload()}
              className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 font-bold hover:bg-rose-100"
            >
              Coba lagi
            </button>
          </div>
        ) : store.loading && store.requests.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat pengajuan…
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
            <p className="font-semibold text-slate-700">
              {filter === 'mine' ? 'Tidak ada pengajuan yang menunggu tindakan Anda.' : 'Belum ada pengajuan.'}
            </p>
            <p className="mt-1 text-[11px]">Pengajuan yang dikirim kru dari aplikasi HP akan muncul di sini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                  <th scope="col" className="py-3 px-3">Karyawan</th>
                  <th scope="col" className="py-3 px-3">Jenis</th>
                  <th scope="col" className="py-3 px-3">Periode / Nominal</th>
                  <th scope="col" className="py-3 px-3">Alasan</th>
                  <th scope="col" className="py-3 px-3">Status</th>
                  <th scope="col" className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    action={actionFor(req, role)}
                    busy={busyId === req.id}
                    disabled={busyId !== null}
                    onApprove={() => approve(req)}
                    onReject={() => setRejecting(req)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejecting && (
        <RejectDialog req={rejecting} onCancel={() => setRejecting(null)} onConfirm={(notes) => reject(rejecting, notes)} />
      )}
    </section>
  );
}

function RequestRow({
  req,
  action,
  busy,
  disabled,
  onApprove,
  onReject,
}: {
  req: AdminRequest;
  action: ReturnType<typeof actionFor>;
  busy: boolean;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const notes = [req.managerNotes && `Kepala Cabang: ${req.managerNotes}`, req.hrNotes && `HR: ${req.hrNotes}`].filter(
    Boolean,
  );

  return (
    <tr className="align-top hover:bg-slate-50/70">
      <td className="py-3 px-3">
        <div className="font-bold text-slate-900">{req.employee.fullName}</div>
        <div className="text-[11px] text-slate-500">
          {req.employee.position.title} · {req.employee.outlet.name}
        </div>
        <div className="text-[10px] text-slate-500 font-mono">NIK {req.employee.nik}</div>
      </td>
      <td className="py-3 px-3">
        <div className="font-semibold text-slate-800">{REQUEST_TYPE_LABEL[req.type]}</div>
        <div className="text-[10px] text-slate-500">Diajukan {formatDate(req.createdAt)}</div>
        {req.type === 'CUTI_TAHUNAN' && (
          <div className="text-[10px] text-slate-500">Sisa cuti: {req.employee.leaveBalance} hari</div>
        )}
      </td>
      <td className="py-3 px-3 text-slate-700">
        {req.kasbonLoan ? (
          <>
            <div className="font-bold text-slate-900">{rupiah.format(Number(req.kasbonLoan.amount))}</div>
            <div className="text-[10px] text-slate-500">
              {req.kasbonLoan.tenorMonths}× cicilan {rupiah.format(Number(req.kasbonLoan.monthlyDeduction))}
            </div>
          </>
        ) : (
          periodText(req)
        )}
      </td>
      <td className="py-3 px-3 max-w-xs text-slate-600">
        <p className="whitespace-pre-line">{req.reason}</p>
        {req.attachmentUrl && (
          <a
            href={req.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 font-bold text-amber-700 hover:underline"
          >
            <Paperclip className="h-3 w-3" aria-hidden /> Lampiran
          </a>
        )}
      </td>
      <td className="py-3 px-3">
        <span className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLE[req.status]}`}>
          {REQUEST_STATUS_LABEL[req.status]}
        </span>
        {notes.map((n) => (
          <p key={n as string} className="mt-1 text-[10px] text-slate-500 max-w-[14rem]">
            {n}
          </p>
        ))}
      </td>
      <td className="py-3 px-3">
        <div className="flex justify-end gap-1.5">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-label="Memproses" />
          ) : action === 'disburse' ? (
            <button
              type="button"
              onClick={onApprove}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Wallet className="h-3.5 w-3.5" aria-hidden /> Tandai dicairkan
            </button>
          ) : action ? (
            <>
              <button
                type="button"
                onClick={onApprove}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {action === 'sm-review' ? 'Setujui & teruskan' : 'Setujui'}
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden /> Tolak
              </button>
            </>
          ) : (
            <span className="text-[10px] text-slate-500">-</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function RejectDialog({
  req,
  onCancel,
  onConfirm,
}: {
  req: AdminRequest;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const trimmed = notes.trim();

  return (
    <Dialog title={`Tolak ${REQUEST_TYPE_LABEL[req.type].toLowerCase()} ${req.employee.fullName}`} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onConfirm(trimmed);
        }}
        className="space-y-3"
      >
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Alasan penolakan (dilihat oleh karyawan)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            required
            className="w-full rounded-md border border-slate-300 p-2.5 text-slate-800 focus:border-rose-500"
          />
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
            Batal
          </button>
          <button
            type="submit"
            disabled={!trimmed}
            className="rounded-md bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Tolak pengajuan
          </button>
        </div>
      </form>
    </Dialog>
  );
}
