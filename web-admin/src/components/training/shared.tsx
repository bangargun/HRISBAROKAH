'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface Department { id: string; name: string; positions: { id: string; title: string }[] }
export interface OutletOption { id: string; name: string }
export interface QuestionInput { prompt: string; options: string[]; correctIndex: number }

export const CATEGORY_LABEL: Record<string, string> = {
  ONBOARDING: 'Onboarding',
  RESEP_BOH: 'Resep & dapur',
  SERVICE_FOH: 'Layanan tamu',
  HYGIENE_HACCP: 'Higiene & keamanan pangan',
  LEADERSHIP: 'Kepemimpinan',
};

export const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
export const longDate = (ymd: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(ymd.slice(0, 10)));

/** Data master yang dipakai beberapa tab: departemen + jabatan, dan cabang. */
export function useMasterData() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  useEffect(() => {
    apiFetch<Department[]>('/departments').then(setDepartments).catch(() => setDepartments([]));
    apiFetch<OutletOption[]>('/outlets').then(setOutlets).catch(() => setOutlets([]));
  }, []);
  return { departments, outlets };
}

/** Ringkasan sasaran jabatan untuk tabel. */
export function targetLabel(ids: string[], departments: Department[]): string {
  if (ids.length === 0) return 'Semua jabatan';
  const titles = departments.flatMap((d) => d.positions).filter((p) => ids.includes(p.id)).map((p) => p.title);
  return titles.length <= 2 ? titles.join(', ') : `${titles.slice(0, 2).join(', ')} +${titles.length - 2}`;
}

/** Pilih jabatan sasaran per departemen; tidak ada yang dicentang = semua jabatan. */
export function PositionPicker({ value, onChange, departments }: { value: string[]; onChange: (v: string[]) => void; departments: Department[] }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <fieldset className="space-y-2">
      <legend className="field-label">Jabatan sasaran</legend>
      <p className="text-xs text-slate-500">Tidak ada yang dicentang berarti untuk semua jabatan.</p>
      <div className="grid max-h-48 gap-3 overflow-y-auto rounded-md border border-slate-200 p-3 sm:grid-cols-2">
        {departments.map((d) => (
          <div key={d.id}>
            <p className="text-xs font-semibold text-slate-500">{d.name}</p>
            {d.positions.map((p) => (
              <label key={p.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-800">
                <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} />
                {p.title}
              </label>
            ))}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/** Editor soal pilihan ganda; bisa dikunci (baca saja). */
export function QuestionsEditor({ value, onChange, locked }: { value: QuestionInput[]; onChange: (v: QuestionInput[]) => void; locked: boolean }) {
  const update = (i: number, q: QuestionInput) => onChange(value.map((x, j) => (j === i ? q : x)));
  return (
    <fieldset className="space-y-3">
      <legend className="field-label">Soal ({value.length})</legend>
      {locked && <p className="text-xs text-slate-500">Soal terkunci karena sudah ada yang mengerjakan.</p>}
      {value.map((q, i) => (
        <div key={i} className="space-y-2 rounded-md border border-slate-200 p-3">
          <div className="flex items-start gap-2">
            <span className="mt-2 text-sm font-semibold text-slate-500">{i + 1}.</span>
            <input
              required
              disabled={locked}
              maxLength={500}
              aria-label={`Teks soal ${i + 1}`}
              value={q.prompt}
              onChange={(e) => update(i, { ...q, prompt: e.target.value })}
              className="input"
              placeholder="Tulis pertanyaan"
            />
            {!locked && (
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="btn btn-sm btn-ghost" aria-label={`Hapus soal ${i + 1}`}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          <div className="space-y-1.5 pl-6">
            {q.options.map((o, k) => (
              <div key={k} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${i}`}
                  disabled={locked}
                  checked={q.correctIndex === k}
                  onChange={() => update(i, { ...q, correctIndex: k })}
                  aria-label={`Pilihan ${k + 1} benar`}
                />
                <input
                  required
                  disabled={locked}
                  maxLength={300}
                  aria-label={`Pilihan ${k + 1} soal ${i + 1}`}
                  value={o}
                  onChange={(e) => update(i, { ...q, options: q.options.map((x, j) => (j === k ? e.target.value : x)) })}
                  className="input py-1.5"
                />
                {!locked && q.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => update(i, { ...q, options: q.options.filter((_, j) => j !== k), correctIndex: q.correctIndex >= k && q.correctIndex > 0 ? q.correctIndex - 1 : q.correctIndex })}
                    className="btn btn-sm btn-ghost"
                    aria-label={`Hapus pilihan ${k + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {!locked && q.options.length < 5 && (
              <button type="button" onClick={() => update(i, { ...q, options: [...q.options, ''] })} className="btn btn-sm btn-ghost">
                <Plus className="h-4 w-4" aria-hidden /> Tambah pilihan
              </button>
            )}
            <p className="text-xs text-slate-500">Tandai bulatan pada jawaban yang benar.</p>
          </div>
        </div>
      ))}
      {!locked && value.length < 50 && (
        <button type="button" onClick={() => onChange([...value, { prompt: '', options: ['', ''], correctIndex: 0 }])} className="btn btn-secondary">
          <Plus className="h-4 w-4" aria-hidden /> Tambah soal
        </button>
      )}
    </fieldset>
  );
}
