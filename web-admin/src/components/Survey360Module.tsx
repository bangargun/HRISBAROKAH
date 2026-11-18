'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface OutletOption {
  id: string;
  name: string;
}

interface Result {
  period: { start: string; end: string };
  window: { from: string; to: string };
  questions: { dimension: string; question: string }[];
  rows: {
    employee: { id: string; fullName: string; position: { title: string } };
    responses: number;
    managerResponses: number;
    average: number | null;
    perQuestion: (number | null)[];
    comments: string[];
  }[];
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const fmtDate = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/** Hasil survei 360° per cabang dan periode: rata-rata, jumlah penilai, rincian per pertanyaan, masukan anonim. */
export default function Survey360Module() {
  const now = new Date();
  const [outlets, setOutlets] = useState<OutletOption[] | null>(null);
  const [outletId, setOutletId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<OutletOption[]>('/outlets')
      .then((o) => {
        setOutlets(o);
        setOutletId(o[0]?.id ?? '');
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const load = useCallback(() => {
    if (!outletId) return;
    setData(null);
    apiFetch<Result>(`/survey360/results?outletId=${outletId}&year=${year}&month=${month}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [outletId, year, month]);

  useEffect(load, [load]);

  const select = 'input w-auto';

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
        </div>
        {data && (
          <p className="text-slate-600">
            Survei dibuka {fmtDate(data.window.from)} – {fmtDate(data.window.to)}
          </p>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Kru dan kepala cabang menilai rekan satu cabang dari aplikasi HP (15 pertanyaan, skala 1–5), sekali per rekan per
        periode gaji. Nama penilai tidak disimpan di hasil ini. Rata-rata × 20 menjadi nilai sikap di KPI.
      </p>

      <div className="card overflow-hidden">
        {error ? (
          <p role="alert" className="p-10 text-center text-rose-700">Gagal memuat survei: {error}</p>
        ) : outlets && outlets.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada cabang aktif.</p>
        ) : !data ? (
          <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
          </p>
        ) : data.rows.length === 0 ? (
          <p className="p-10 text-center text-slate-600">Belum ada karyawan aktif di cabang ini.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.rows.map((r) => {
              const expanded = open === r.employee.id;
              return (
                <li key={r.employee.id}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    disabled={r.responses === 0}
                    onClick={() => setOpen(expanded ? null : r.employee.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:hover:bg-white"
                  >
                    {r.responses ? (
                      expanded ? <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden /> : <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden />
                    ) : (
                      <span className="w-4" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-900">{r.employee.fullName}</span>
                      <span className="block text-xs text-slate-500">{r.employee.position.title}</span>
                    </span>
                    <span className="text-right text-xs text-slate-500">
                      {r.responses ? `${r.responses} penilai${r.managerResponses ? ', termasuk kepala cabang' : ''}` : 'Belum dinilai'}
                    </span>
                    <span className="w-16 text-right text-base font-semibold tabular-nums text-slate-900">
                      {r.average ?? '–'}
                    </span>
                  </button>
                  {expanded && (
                    <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                        {data.questions.map((q, i) => (
                          <p key={q.dimension} className="flex justify-between gap-2">
                            <span className="text-slate-700">{q.dimension}</span>
                            <span className={`tabular-nums ${(r.perQuestion[i] ?? 5) < 3 ? 'font-medium text-rose-700' : 'text-slate-900'}`}>
                              {r.perQuestion[i] ?? '–'}
                            </span>
                          </p>
                        ))}
                      </div>
                      {r.comments.length > 0 && (
                        <div>
                          <p className="font-semibold text-slate-900">Masukan anonim</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
                            {r.comments.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
