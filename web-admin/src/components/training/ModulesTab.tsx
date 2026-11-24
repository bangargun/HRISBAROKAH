'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Dialog from '@/components/Dialog';
import { CATEGORY_LABEL, Department, PositionPicker, QuestionInput, QuestionsEditor, longDate, targetLabel } from './shared';

interface ModuleRow {
  id: string;
  code: string;
  title: string;
  category: string;
  isOnboarding: boolean;
  isPublished: boolean;
  passingScore: number;
  targetPositionIds: string[];
  questionCount: number;
  passedCount: number;
  targetCount: number;
}
interface ModuleDetail extends ModuleRow {
  description: string;
  content: string;
  videoUrl: string | null;
  locked: boolean;
  questions: QuestionInput[];
}
interface ResultRow {
  id: string;
  fullName: string;
  nik: string;
  outlet: { name: string };
  position: { title: string };
  result: { attempts: number; bestScore: number; passedAt: string | null; certificateNo: string | null } | null;
}

/** Materi + kuis modul: daftar, editor, terbit/arsip, hasil per kru. */
export default function ModulesTab({ canManage, departments }: { canManage: boolean; departments: Department[] }) {
  const [rows, setRows] = useState<ModuleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ModuleDetail | 'new' | null>(null);
  const [results, setResults] = useState<ModuleRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<ModuleRow[]>('/training/modules').then(setRows).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  async function open(id: string) {
    setError(null);
    try {
      setEditing(await apiFetch<ModuleDetail>(`/training/modules/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function publish(m: ModuleRow, isPublished: boolean) {
    setBusy(m.id);
    setError(null);
    try {
      await apiFetch(`/training/modules/${m.id}/publish`, { method: 'PATCH', body: JSON.stringify({ isPublished }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col justify-between gap-3 p-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Materi pelatihan</h2>
          <p className="max-w-2xl text-sm text-slate-600">
            Modul dibaca dan kuisnya dikerjakan kru di aplikasi HP. Kru boleh mengulang sampai lulus; yang lulus mendapat sertifikat.
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={() => setEditing('new')} className="btn btn-primary shrink-0">
            <Plus className="h-4 w-4" aria-hidden /> Modul baru
          </button>
        )}
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Modul</th>
              <th scope="col" className="px-4 py-3">Sasaran</th>
              <th scope="col" className="px-4 py-3">Soal</th>
              <th scope="col" className="px-4 py-3">Lulus</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null ? (
              <tr><td colSpan={6} className="px-4 py-6 text-slate-500">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">Belum ada modul.</td></tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-slate-500">{m.code}</div>
                    <div className="font-medium text-slate-900">{m.title}</div>
                    <div className="text-xs text-slate-500">
                      {CATEGORY_LABEL[m.category] ?? m.category}
                      {m.isOnboarding && ' · wajib kru baru'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{targetLabel(m.targetPositionIds, departments)}</td>
                  <td className="px-4 py-3 tabular-nums">{m.questionCount}</td>
                  <td className="px-4 py-3 tabular-nums">{m.passedCount} / {m.targetCount}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${m.isPublished ? 'badge-success' : 'badge-neutral'}`}>{m.isPublished ? 'Terbit' : 'Draf / arsip'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" onClick={() => setResults(m)} className="btn btn-sm btn-secondary">Hasil</button>
                      {canManage && (
                        <>
                          <button type="button" onClick={() => open(m.id)} className="btn btn-sm btn-ghost">Ubah</button>
                          <button type="button" disabled={busy === m.id} onClick={() => publish(m, !m.isPublished)} className="btn btn-sm btn-ghost">
                            {busy === m.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                            {m.isPublished ? 'Arsipkan' : 'Terbitkan'}
                          </button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <ModuleEditor
          module={editing === 'new' ? null : editing}
          departments={departments}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {results && <ModuleResults module={results} onClose={() => setResults(null)} />}
    </div>
  );
}

function ModuleEditor({ module, departments, onClose, onSaved }: { module: ModuleDetail | null; departments: Department[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: module?.code ?? '',
    title: module?.title ?? '',
    category: module?.category ?? 'ONBOARDING',
    description: module?.description ?? '',
    content: module?.content ?? '',
    videoUrl: module?.videoUrl ?? '',
    passingScore: String(module?.passingScore ?? 80),
    isOnboarding: module?.isOnboarding ?? false,
  });
  const [targets, setTargets] = useState<string[]>(module?.targetPositionIds ?? []);
  const [questions, setQuestions] = useState<QuestionInput[]>(
    module?.questions.map((q) => ({ prompt: q.prompt, options: q.options, correctIndex: q.correctIndex })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const locked = module?.locked ?? false;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        code: form.code.trim().toUpperCase(),
        passingScore: Number(form.passingScore),
        targetPositionIds: targets,
        ...(!locked && questions.length > 0 && { questions }),
      };
      await apiFetch(module ? `/training/modules/${module.id}` : '/training/modules', { method: module ? 'PUT' : 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!module) return;
    setSaving(true);
    try {
      await apiFetch(`/training/modules/${module.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog wide title={module ? `Ubah modul ${module.code}` : 'Modul baru'} onClose={() => !saving && onClose()}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block space-y-1">
            <span className="field-label">Kode</span>
            <input required maxLength={20} value={form.code} onChange={set('code')} className="input font-mono" placeholder="HYG-01" />
          </label>
          <label className="block space-y-1 md:col-span-2">
            <span className="field-label">Judul</span>
            <input required maxLength={200} value={form.title} onChange={set('title')} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">Kategori</span>
            <select value={form.category} onChange={set('category')} className="input">
              {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="field-label">Nilai lulus (%)</span>
            <input required type="number" min={1} max={100} value={form.passingScore} onChange={set('passingScore')} className="input" />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-800">
            <input type="checkbox" checked={form.isOnboarding} onChange={(e) => setForm({ ...form, isOnboarding: e.target.checked })} />
            Wajib untuk kru baru
          </label>
        </div>
        <label className="block space-y-1">
          <span className="field-label">Ringkasan (opsional)</span>
          <input maxLength={500} value={form.description} onChange={set('description')} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="field-label">Isi materi</span>
          <textarea required rows={8} maxLength={50000} value={form.content} onChange={set('content')} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="field-label">Tautan video (opsional)</span>
          <input type="url" value={form.videoUrl} onChange={set('videoUrl')} className="input" placeholder="https://..." />
        </label>
        <PositionPicker value={targets} onChange={setTargets} departments={departments} />
        <QuestionsEditor value={questions} onChange={setQuestions} locked={locked} />
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div>
            {module && !locked && (deleting ? (
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600">Hapus modul ini?</span>
                <button type="button" disabled={saving} onClick={remove} className="btn btn-sm btn-danger">Hapus</button>
                <button type="button" disabled={saving} onClick={() => setDeleting(false)} className="btn btn-sm btn-ghost">Batal</button>
              </span>
            ) : (
              <button type="button" onClick={() => setDeleting(true)} className="btn btn-ghost">Hapus modul</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={onClose} className="btn btn-ghost">Batal</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Simpan
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function ModuleResults({ module, onClose }: { module: ModuleRow; onClose: () => void }) {
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<ResultRow[]>(`/training/modules/${module.id}/results`).then(setRows).catch((e) => setError((e as Error).message));
  }, [module.id]);
  return (
    <Dialog wide title={`Hasil ${module.code} · ${module.title}`} onClose={onClose}>
      {error && <p role="alert" className="alert-error">{error}</p>}
      {rows === null && !error ? (
        <p className="text-sm text-slate-500">Memuat…</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head sticky top-0">
              <tr>
                <th scope="col" className="px-3 py-2">Kru</th>
                <th scope="col" className="px-3 py-2">Percobaan</th>
                <th scope="col" className="px-3 py-2">Nilai terbaik</th>
                <th scope="col" className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(rows ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.fullName}</div>
                    <div className="text-xs text-slate-500">{r.position.title} · {r.outlet.name}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.result?.attempts ?? 0}</td>
                  <td className="px-3 py-2 tabular-nums">{r.result ? r.result.bestScore : '–'}</td>
                  <td className="px-3 py-2">
                    {r.result?.passedAt ? (
                      <span className="badge badge-success">Lulus {longDate(r.result.passedAt)}</span>
                    ) : r.result ? (
                      <span className="badge badge-warning">Belum lulus</span>
                    ) : (
                      <span className="badge badge-neutral">Belum mengerjakan</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows?.length === 0 && (
                <tr><td colSpan={4} className="empty-state">Belum ada kru sasaran.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
