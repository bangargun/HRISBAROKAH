'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Settings {
  basicSalaryProbation: number;
  basicSalaryRegular: number;
  probationMonths: number;
  mealAllowancePerDay: number;
  latePenaltyPerMinute: number;
  tenureAllowanceMonth7: number;
  tenureAllowanceMonth13: number;
  tenureAllowanceMonth19: number;
  tenureAllowanceStep: number;
  kasbonMaxPercent: number;
  kpiIncentiveGradeA: number;
  updatedAt: string;
}

type Key = Exclude<keyof Settings, 'updatedAt'>;

const SECTIONS: { title: string; fields: { key: Key; label: string; unit: 'rp' | 'bulan' | '%'; hint?: string }[] }[] = [
  {
    title: 'Gaji pokok (SOP-HR-007)',
    fields: [
      { key: 'basicSalaryProbation', label: 'Masa kerja di bawah batas', unit: 'rp' },
      { key: 'basicSalaryRegular', label: 'Masa kerja mencapai batas', unit: 'rp' },
      { key: 'probationMonths', label: 'Batas masa kerja', unit: 'bulan', hint: 'Bulan penuh di akhir periode' },
    ],
  },
  {
    title: 'Tunjangan',
    fields: [
      { key: 'mealAllowancePerDay', label: 'Uang makan per hari hadir', unit: 'rp' },
      { key: 'tenureAllowanceMonth7', label: 'Masa kerja bulan ke-7 s.d. 12', unit: 'rp' },
      { key: 'tenureAllowanceMonth13', label: 'Masa kerja bulan ke-13 s.d. 18', unit: 'rp' },
      { key: 'tenureAllowanceMonth19', label: 'Masa kerja bulan ke-19 s.d. 24', unit: 'rp' },
      { key: 'tenureAllowanceStep', label: 'Tambahan per 6 bulan setelah bulan ke-24', unit: 'rp' },
      { key: 'kpiIncentiveGradeA', label: 'Insentif KPI nilai A (skor ≥ 90)', unit: 'rp', hint: 'Masuk gaji otomatis bila KPI lengkap; isi 0 untuk menonaktifkan' },
    ],
  },
  {
    title: 'Potongan',
    fields: [
      { key: 'latePenaltyPerMinute', label: 'Potongan terlambat per menit', unit: 'rp', hint: 'Isi 0 bila keterlambatan hanya dicatat' },
      { key: 'kasbonMaxPercent', label: 'Batas cicilan kasbon', unit: '%', hint: 'Persen dari gaji pokok per bulan' },
    ],
  },
];

const stampFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function PayrollSettingsModule() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [form, setForm] = useState<Record<Key, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function apply(s: Settings) {
    setSaved(s);
    setForm(Object.fromEntries(SECTIONS.flatMap((sec) => sec.fields.map((f) => [f.key, String(s[f.key])]))) as Record<Key, string>);
  }

  useEffect(() => {
    apiFetch<Settings>('/payroll/settings')
      .then(apply)
      .catch((e) => setNotice({ kind: 'error', text: (e as Error).message }));
  }, []);

  const changed = !!saved && !!form && (Object.keys(form) as Key[]).some((k) => Number(form[k]) !== saved[k]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !saved) return;
    setSaving(true);
    setNotice(null);
    try {
      const body = Object.fromEntries((Object.keys(form) as Key[]).filter((k) => Number(form[k]) !== saved[k]).map((k) => [k, Number(form[k])]));
      apply(await apiFetch<Settings>('/payroll/settings', { method: 'PUT', body: JSON.stringify(body) }));
      setNotice({ kind: 'ok', text: 'Aturan gaji disimpan. Berlaku untuk perhitungan berikutnya; gaji yang sudah final tidak berubah.' });
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return notice ? (
      <p role="alert" className="alert-error">{notice.text}</p>
    ) : (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat aturan gaji…
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-4 text-sm">
      <p className="text-slate-600">
        Angka ini dipakai saat menghitung draf gaji. Mengubahnya tidak mengubah gaji yang sudah final; hitung ulang draf
        yang masih berjalan agar memakai angka baru.
      </p>

      {SECTIONS.map((sec) => (
        <fieldset key={sec.title} className="card p-4">
          <legend className="px-1 font-semibold text-slate-900">{sec.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {sec.fields.map((f) => (
              <label key={f.key} className="block space-y-1">
                <span className="font-medium text-slate-700">{f.label}</span>
                <div className="flex items-center rounded-md border border-slate-300 bg-white hover:border-slate-400 focus-within:border-brand-500">
                  {f.unit === 'rp' && <span className="pl-3 text-slate-500">Rp</span>}
                  <input
                    type="number"
                    required
                    min={0}
                    max={f.unit === '%' ? 100 : f.unit === 'bulan' ? 24 : undefined}
                    step={f.unit === 'rp' ? 1 : 1}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full rounded-md border-0 bg-transparent px-3 py-2 tabular-nums text-slate-900 focus:ring-0"
                  />
                  {f.unit !== 'rp' && <span className="pr-3 text-slate-500">{f.unit}</span>}
                </div>
                {f.hint && <span className="text-xs text-slate-500">{f.hint}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

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

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">Terakhir diubah {saved && stampFmt.format(new Date(saved.updatedAt))}</span>
        <div className="flex gap-2">
          {changed && (
            <button type="button" onClick={() => saved && apply(saved)} className="btn btn-ghost">
              Batalkan
            </button>
          )}
          <button
            type="submit"
            disabled={!changed || saving}
            className="btn btn-primary px-4"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Simpan aturan
          </button>
        </div>
      </div>
    </form>
  );
}
