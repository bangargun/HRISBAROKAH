'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface OutletOption {
  id: string;
  name: string;
}

interface KpiRow {
  employee: { id: string; fullName: string };
  daysPresent: number;
  absentDays: number;
  incentive: number;
  kpi: {
    disciplineIn: number | null;
    disciplineBreak: number | null;
    attitude: number | null;
    kasbon: number;
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | null;
    complete: boolean;
  };
}

interface KpiList {
  outlet: OutletOption;
  period: { start: string; end: string };
  incentiveGradeA: number;
  rows: KpiRow[];
}

const GRADE: Record<'A' | 'B' | 'C' | 'D', [string, string]> = {
  A: ['Sangat baik', 'bg-emerald-50 text-emerald-800 border-emerald-200'],
  B: ['Baik', 'bg-sky-50 text-sky-800 border-sky-200'],
  C: ['Perlu pembinaan', 'bg-amber-50 text-amber-800 border-amber-200'],
  D: ['Kurang', 'bg-rose-50 text-rose-800 border-rose-200'],
};
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const fmtDate = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

function Value({ v }: { v: number | null }) {
  if (v === null) return <span className="text-slate-400">–</span>;
  return <span className={v >= 90 ? 'text-slate-900' : v >= 70 ? 'text-amber-700' : 'text-rose-700'}>{v}</span>;
}

/** KPI kru dihitung dari data asli dengan rumus yang sama dengan penggajian. */
export default function KpiModule() {
  const now = new Date();
  const [outlets, setOutlets] = useState<OutletOption[] | null>(null);
  const [outletId, setOutletId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<KpiList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<OutletOption[]>('/outlets')
      .then((o) => {
        setOutlets(o);
        setOutletId(o[0]?.id ?? '');
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      setData(await apiFetch<KpiList>(`/kpi?outletId=${outletId}&year=${year}&month=${month}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [outletId, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const select = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800';

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {outlets && outlets.length > 1 && (
            <select aria-label="Cabang" value={outletId} onChange={(e) => setOutletId(e.target.value)} className={select}>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          <select aria-label="Bulan" value={month} onChange={(e) => setMonth(Number(e.target.value))} className={select}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select aria-label="Tahun" value={year} onChange={(e) => setYear(Number(e.target.value))} className={select}>
            {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden /> Muat ulang
          </button>
        </div>
        {data && (
          <p className="text-slate-600">
            Periode {fmtDate(data.period.start)} – {fmtDate(data.period.end)}
          </p>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Skor = disiplin masuk 30% (hari tepat waktu ÷ hari masuk + mangkir) + disiplin istirahat 25% (hari istirahat sesuai
        batas) + sikap 35% (survei 360°) + bebas kasbon 10%. Komponen tanpa data tidak dihitung dan bobotnya dibagi ulang.
        Nilai A (≥ 90) dengan data disiplin dan survei lengkap mendapat insentif{' '}
        {data ? rupiah.format(data.incentiveGradeA) : ''} di gaji periode yang sama.
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {error ? (
          <p role="alert" className="p-10 text-center text-rose-700">Gagal memuat KPI: {error}</p>
        ) : outlets && outlets.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada cabang aktif.</p>
        ) : !data ? (
          <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Menghitung KPI…
          </p>
        ) : data.rows.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada karyawan di cabang ini untuk periode tersebut.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-600">
                  <th scope="col" className="px-4 py-3">Karyawan</th>
                  <th scope="col" className="px-3 py-3 text-right">Disiplin masuk</th>
                  <th scope="col" className="px-3 py-3 text-right">Istirahat</th>
                  <th scope="col" className="px-3 py-3 text-right">Sikap (360°)</th>
                  <th scope="col" className="px-3 py-3 text-right">Kasbon</th>
                  <th scope="col" className="px-3 py-3 text-right">Skor</th>
                  <th scope="col" className="px-3 py-3">Nilai</th>
                  <th scope="col" className="px-4 py-3 text-right">Insentif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {data.rows.map((r) => {
                  return (
                    <tr key={r.employee.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{r.employee.fullName}</p>
                        <p className="text-xs text-slate-500">
                          {r.daysPresent} hari masuk{r.absentDays ? `, ${r.absentDays} mangkir` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right"><Value v={r.kpi.disciplineIn} /></td>
                      <td className="px-3 py-3 text-right"><Value v={r.kpi.disciplineBreak} /></td>
                      <td className="px-3 py-3 text-right"><Value v={r.kpi.attitude} /></td>
                      <td className="px-3 py-3 text-right"><Value v={r.kpi.kasbon} /></td>
                      <td className={`px-3 py-3 text-right font-semibold ${r.kpi.grade ? 'text-slate-900' : 'text-slate-400'}`}>{r.kpi.score}</td>
                      <td className="px-3 py-3">
                        {r.kpi.grade ? (
                          <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${GRADE[r.kpi.grade][1]}`}>
                            {r.kpi.grade} · {GRADE[r.kpi.grade][0]}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Belum lengkap: {[r.kpi.disciplineIn === null && 'belum ada hari masuk', r.kpi.attitude === null && 'belum dinilai di survei'].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.incentive ? <span className="text-emerald-700">{rupiah.format(r.incentive)}</span> : <span className="text-slate-400">–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
