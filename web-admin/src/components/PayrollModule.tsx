'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Loader2, Lock, Wallet } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';

interface OutletOption {
  id: string;
  name: string;
  payrollCutoffDay: number;
}

interface PayrollRow {
  id: string;
  status: 'DRAFT' | 'FINALIZED';
  isPaid: boolean;
  paidAt: string | null;
  finalizedAt: string | null;
  updatedAt: string;
  tenureMonths: number;
  daysEmployed: number;
  daysPresent: number;
  unpaidLeaveDays: number;
  absentDays: number;
  lateMinutes: number;
  basicSalary: string;
  mealAllowance: string;
  tenureAllowance: string;
  unpaidDeduction: string;
  latePenalty: string;
  kasbonDeduction: string;
  netSalary: string;
  employee: { id: string; nik: string; fullName: string; position: { title: string } };
}

interface PayrollList {
  outlet: { id: string; name: string; payrollCutoffDay: number };
  period: { start: string; end: string };
  rows: PayrollRow[];
  skipped?: string[];
}

// Sama dengan @Roles di backend payroll.controller.ts
const MARK_PAID_ROLES = ['SUPER_ADMIN', 'FINANCE_ADMIN'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const stampFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const rp = (v: string | number) => rupiah.format(Number(v));
const fmtDate = (ymd: string) => dateFmt.format(new Date(`${ymd}T00:00:00Z`));

export default function PayrollModule() {
  const role = getSessionUser()?.role ?? '';
  const canMarkPaid = MARK_PAID_ROLES.includes(role);
  const now = new Date();

  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [outletId, setOutletId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<PayrollList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'generate' | 'finalize' | 'paid' | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<'finalize' | 'paid' | null>(null);

  useEffect(() => {
    apiFetch<OutletOption[]>('/outlets')
      .then((list) => {
        setOutlets(list);
        setOutletId((c) => c || list[0]?.id || '');
        if (list.length === 0) setLoading(false);
      })
      .catch((e) => {
        setNotice({ kind: 'error', text: (e as Error).message });
        setLoading(false);
      });
  }, []);

  const query = `outletId=${outletId}&year=${year}&month=${month}`;
  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      setData(await apiFetch<PayrollList>(`/payroll?${query}`));
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [outletId, query]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows ?? [];
  const hasDraft = rows.some((r) => r.status === 'DRAFT');
  const finalized = rows.length > 0 && !hasDraft;
  const paid = finalized && rows.every((r) => r.isPaid);

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          gross: t.gross + Number(r.basicSalary) + Number(r.mealAllowance) + Number(r.tenureAllowance),
          deductions: t.deductions + Number(r.unpaidDeduction) + Number(r.latePenalty) + Number(r.kasbonDeduction),
          kasbon: t.kasbon + Number(r.kasbonDeduction),
          net: t.net + Number(r.netSalary),
        }),
        { gross: 0, deductions: 0, kasbon: 0, net: 0 },
      ),
    [rows],
  );

  async function run(action: 'generate' | 'finalize' | 'paid') {
    setConfirm(null);
    setBusy(action);
    setNotice(null);
    const path = action === 'generate' ? 'generate' : action === 'finalize' ? 'finalize' : 'mark-paid';
    try {
      const result = await apiFetch<PayrollList>(`/payroll/${path}`, {
        method: 'POST',
        body: JSON.stringify({ outletId, year, month }),
      });
      setData(result);
      const skipped = result.skipped?.length ? ` ${result.skipped.length} karyawan dilewati karena gajinya sudah final di cabang lain.` : '';
      setNotice({
        kind: 'ok',
        text:
          action === 'generate'
            ? `Draf gaji ${result.rows.length} karyawan dihitung.${skipped}`
            : action === 'finalize'
              ? 'Gaji periode ini sudah final. Cicilan kasbon telah dicatat.'
              : 'Gaji periode ini ditandai sudah dibayar.',
      });
    } catch (e) {
      setNotice({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const status = !rows.length ? null : paid ? 'Sudah dibayar' : finalized ? 'Final' : 'Draf';

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="payroll-outlet">Cabang</label>
          <select
            id="payroll-outlet"
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-800"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="payroll-month">Bulan</label>
          <select
            id="payroll-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="payroll-year">Tahun</label>
          <select
            id="payroll-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {data && (
            <span className="text-slate-600">
              Periode {fmtDate(data.period.start)} – {fmtDate(data.period.end)}
              <span className="text-slate-500"> (tutup buku tgl {data.outlet.payrollCutoffDay})</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                paid ? 'bg-emerald-50 text-emerald-800' : finalized ? 'bg-sky-50 text-sky-800' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {finalized && <Lock className="h-3 w-3" aria-hidden />}
              {status}
            </span>
          )}
          {!finalized && (
            <button
              type="button"
              onClick={() => run('generate')}
              disabled={!outletId || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Calculator className="h-4 w-4" aria-hidden />}
              {rows.length ? 'Hitung ulang' : 'Hitung draf'}
            </button>
          )}
          {hasDraft && (
            <button
              type="button"
              onClick={() => setConfirm('finalize')}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Finalkan
            </button>
          )}
          {finalized && !paid && canMarkPaid && (
            <button
              type="button"
              onClick={() => setConfirm('paid')}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Wallet className="h-4 w-4" aria-hidden /> Tandai sudah dibayar
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-md border px-3 py-2 ${
            notice.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Total pendapatan', value: totals.gross },
            { label: 'Total potongan', value: totals.deductions },
            { label: 'Cicilan kasbon', value: totals.kasbon },
            { label: 'Total gaji bersih', value: totals.net, strong: true },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-slate-600">{c.label}</p>
              <p className={`mt-1 text-xl tabular-nums ${c.strong ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{rp(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
          </div>
        ) : outlets.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada cabang aktif.</p>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-600">
            <p className="font-medium text-slate-800">Gaji periode ini belum dihitung.</p>
            <p className="mt-1">Tekan &quot;Hitung draf&quot; untuk menghitung gaji semua karyawan aktif cabang ini dari data absen, jadwal, pengajuan dan kasbon.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-600">
                  <th scope="col" className="px-4 py-3">Karyawan</th>
                  <th scope="col" className="px-3 py-3 text-right">Hadir</th>
                  <th scope="col" className="px-3 py-3 text-right">Gaji pokok</th>
                  <th scope="col" className="px-3 py-3 text-right">Uang makan</th>
                  <th scope="col" className="px-3 py-3 text-right">Tunj. masa kerja</th>
                  <th scope="col" className="px-3 py-3 text-right">Izin & mangkir</th>
                  <th scope="col" className="px-3 py-3 text-right">Terlambat</th>
                  <th scope="col" className="px-3 py-3 text-right">Kasbon</th>
                  <th scope="col" className="px-4 py-3 text-right">Gaji bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.employee.fullName}</p>
                      <p className="text-xs text-slate-500">
                        {r.employee.position.title} · bulan kerja ke-{r.tenureMonths + 1}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">{r.daysPresent} hari</td>
                    <td className="px-3 py-3 text-right text-slate-800">
                      {rp(r.basicSalary)}
                      {data && r.daysEmployed < Math.round((Date.parse(data.period.end) - Date.parse(data.period.start)) / 86400000) + 1 && (
                        <p className="text-xs text-slate-500">prorata {r.daysEmployed} hari</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-800">{rp(r.mealAllowance)}</td>
                    <td className="px-3 py-3 text-right text-slate-800">{rp(r.tenureAllowance)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={Number(r.unpaidDeduction) ? 'text-rose-700' : 'text-slate-500'}>
                        {Number(r.unpaidDeduction) ? `−${rp(r.unpaidDeduction)}` : '-'}
                      </span>
                      {(r.unpaidLeaveDays > 0 || r.absentDays > 0) && (
                        <p className="text-xs text-slate-500">
                          {[r.unpaidLeaveDays && `${r.unpaidLeaveDays} izin`, r.absentDays && `${r.absentDays} mangkir`].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={Number(r.latePenalty) ? 'text-rose-700' : 'text-slate-500'}>
                        {Number(r.latePenalty) ? `−${rp(r.latePenalty)}` : '-'}
                      </span>
                      {r.lateMinutes > 0 && <p className="text-xs text-slate-500">{r.lateMinutes} menit</p>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={Number(r.kasbonDeduction) ? 'text-rose-700' : 'text-slate-500'}>
                        {Number(r.kasbonDeduction) ? `−${rp(r.kasbonDeduction)}` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{rp(r.netSalary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <p className="text-xs text-slate-500">
          {finalized
            ? `Difinalkan ${stampFmt.format(new Date(rows[0].finalizedAt!))}${paid ? ` · dibayar ${stampFmt.format(new Date(rows[0].paidAt!))}` : ''}.`
            : `Draf dihitung ${stampFmt.format(new Date(rows[0].updatedAt))}. Hitung ulang bila absen, jadwal, pengajuan atau kasbon berubah.`}{' '}
          Rumus lengkap ada di docs/payroll-rules.md.
        </p>
      )}

      {confirm && (
        <Dialog
          title={confirm === 'finalize' ? 'Finalkan gaji periode ini?' : 'Tandai gaji sudah dibayar?'}
          onClose={() => setConfirm(null)}
        >
          <p className="text-slate-600">
            {confirm === 'finalize'
              ? `${rows.length} karyawan, total gaji bersih ${rp(totals.net)}. Setelah final, gaji tidak bisa dihitung ulang dan cicilan kasbon ${rp(totals.kasbon)} langsung dipotong dari sisa kasbon karyawan.`
              : `Total ${rp(totals.net)} untuk ${rows.length} karyawan akan ditandai sudah ditransfer.`}
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setConfirm(null)} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
              Batal
            </button>
            <button
              type="button"
              onClick={() => run(confirm)}
              className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
            >
              {confirm === 'finalize' ? 'Finalkan' : 'Tandai dibayar'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
