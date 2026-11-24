'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Dialog from '@/components/Dialog';
import { Department, PositionPicker, QuestionInput, QuestionsEditor, longDate, targetLabel, todayYmd } from './shared';

interface QuizRow {
  id: string;
  title: string;
  weekStart: string;
  deadline: string;
  passingScore: number;
  targetPositionIds: string[];
  isPublished: boolean;
  questionCount: number;
  attemptCount: number;
  averageScore: number | null;
  targetCount: number;
}
interface QuizDetail extends QuizRow { questions: QuestionInput[] }
interface Results {
  quiz: { title: string; deadline: string; passingScore: number; closed: boolean };
  rows: {
    id: string;
    fullName: string;
    outlet: { name: string };
    position: { title: string };
    attempt: { score: number; passed: boolean } | null;
    state: 'DONE' | 'PENDING' | 'MISSED';
  }[];
  outlets: { outletName: string; total: number; done: number; averageScore: number | null }[];
}

/** Kuis mingguan: terkunci setelah diterbitkan, dikerjakan sekali oleh kru di HP. */
export default function QuizzesTab({ canManage, departments }: { canManage: boolean; departments: Department[] }) {
  const [rows, setRows] = useState<QuizRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<QuizDetail | 'new' | null>(null);
  const [results, setResults] = useState<QuizRow | null>(null);
  const [confirmPublish, setConfirmPublish] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<QuizRow[]>('/training/quizzes').then(setRows).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  async function publish(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/training/quizzes/${id}/publish`, { method: 'PATCH', body: JSON.stringify({ isPublished: true }) });
      setConfirmPublish(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function open(id: string) {
    try {
      setEditing(await apiFetch<QuizDetail>(`/training/quizzes/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col justify-between gap-3 p-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Kuis mingguan</h2>
          <p className="max-w-2xl text-sm text-slate-600">
            Kuis singkat yang dikerjakan kru sekali di aplikasi HP sampai tenggat. Setelah diterbitkan, kuis tidak bisa diubah.
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={() => setEditing('new')} className="btn btn-primary shrink-0">
            <Plus className="h-4 w-4" aria-hidden /> Kuis baru
          </button>
        )}
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Kuis</th>
              <th scope="col" className="px-4 py-3">Tenggat</th>
              <th scope="col" className="px-4 py-3">Sasaran</th>
              <th scope="col" className="px-4 py-3">Mengerjakan</th>
              <th scope="col" className="px-4 py-3">Rata-rata</th>
              <th scope="col" className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null ? (
              <tr><td colSpan={6} className="px-4 py-6 text-slate-500">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">Belum ada kuis.</td></tr>
            ) : (
              rows.map((q) => (
                <tr key={q.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{q.title}</div>
                    <div className="text-xs text-slate-500">
                      {q.questionCount} soal · lulus {q.passingScore}% · {q.isPublished ? 'terbit' : 'draf'}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{longDate(q.deadline)}</td>
                  <td className="px-4 py-3 text-slate-700">{targetLabel(q.targetPositionIds, departments)}</td>
                  <td className="px-4 py-3 tabular-nums">{q.attemptCount} / {q.targetCount}</td>
                  <td className="px-4 py-3 tabular-nums">{q.averageScore ?? '–'}</td>
                  <td className="px-4 py-3">
                    {confirmPublish === q.id ? (
                      <span className="flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-600">Setelah terbit kuis terkunci.</span>
                        <span className="flex gap-1.5">
                          <button type="button" disabled={busy} onClick={() => publish(q.id)} className="btn btn-sm btn-primary">Terbitkan</button>
                          <button type="button" disabled={busy} onClick={() => setConfirmPublish(null)} className="btn btn-sm btn-ghost">Batal</button>
                        </span>
                      </span>
                    ) : (
                      <span className="flex flex-wrap justify-end gap-1.5">
                        {q.isPublished && <button type="button" onClick={() => setResults(q)} className="btn btn-sm btn-secondary">Hasil</button>}
                        {canManage && !q.isPublished && (
                          <>
                            <button type="button" onClick={() => open(q.id)} className="btn btn-sm btn-ghost">Ubah</button>
                            <button type="button" onClick={() => setConfirmPublish(q.id)} className="btn btn-sm btn-primary">Terbitkan</button>
                          </>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <QuizEditor
          quiz={editing === 'new' ? null : editing}
          departments={departments}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {results && <QuizResults quiz={results} onClose={() => setResults(null)} />}
    </div>
  );
}

function QuizEditor({ quiz, departments, onClose, onSaved }: { quiz: QuizDetail | null; departments: Department[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: quiz?.title ?? '',
    weekStart: quiz?.weekStart.slice(0, 10) ?? todayYmd(),
    deadline: quiz?.deadline.slice(0, 10) ?? todayYmd(),
    passingScore: String(quiz?.passingScore ?? 80),
  });
  const [targets, setTargets] = useState<string[]>(quiz?.targetPositionIds ?? []);
  const [questions, setQuestions] = useState<QuestionInput[]>(quiz?.questions.map((q) => ({ prompt: q.prompt, options: q.options, correctIndex: q.correctIndex })) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, passingScore: Number(form.passingScore), targetPositionIds: targets, ...(questions.length > 0 && { questions }) };
      await apiFetch(quiz ? `/training/quizzes/${quiz.id}` : '/training/quizzes', { method: quiz ? 'PUT' : 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!quiz) return;
    setSaving(true);
    try {
      await apiFetch(`/training/quizzes/${quiz.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog wide title={quiz ? 'Ubah kuis' : 'Kuis baru'} onClose={() => !saving && onClose()}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block space-y-1 md:col-span-4">
            <span className="field-label">Judul</span>
            <input required maxLength={200} value={form.title} onChange={set('title')} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">Mulai</span>
            <input required type="date" value={form.weekStart} onChange={set('weekStart')} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">Tenggat</span>
            <input required type="date" min={form.weekStart} value={form.deadline} onChange={set('deadline')} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">Nilai lulus (%)</span>
            <input required type="number" min={1} max={100} value={form.passingScore} onChange={set('passingScore')} className="input" />
          </label>
        </div>
        <PositionPicker value={targets} onChange={setTargets} departments={departments} />
        <QuestionsEditor value={questions} onChange={setQuestions} locked={false} />
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3">
          <div>{quiz && <button type="button" disabled={saving} onClick={remove} className="btn btn-ghost">Hapus draf</button>}</div>
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={onClose} className="btn btn-ghost">Batal</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Simpan draf
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

const STATE_LABEL = { DONE: '', PENDING: 'Belum mengerjakan', MISSED: 'Tidak mengerjakan' } as const;

function QuizResults({ quiz, onClose }: { quiz: QuizRow; onClose: () => void }) {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<Results>(`/training/quizzes/${quiz.id}/results`).then(setData).catch((e) => setError((e as Error).message));
  }, [quiz.id]);
  return (
    <Dialog wide title={`Hasil · ${quiz.title}`} onClose={onClose}>
      {error && <p role="alert" className="alert-error">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-500">Memuat…</p>}
      {data && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {data.outlets.map((o) => (
              <div key={o.outletName} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="font-medium text-slate-900">{o.outletName}</div>
                <div className="text-slate-600">{o.done}/{o.total} mengerjakan · rata-rata {o.averageScore ?? '–'}</div>
              </div>
            ))}
          </div>
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head sticky top-0">
                <tr>
                  <th scope="col" className="px-3 py-2">Kru</th>
                  <th scope="col" className="px-3 py-2">Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{r.fullName}</div>
                      <div className="text-xs text-slate-500">{r.position.title} · {r.outlet.name}</div>
                    </td>
                    <td className="px-3 py-2">
                      {r.attempt ? (
                        <span className={`badge ${r.attempt.passed ? 'badge-success' : 'badge-warning'}`}>
                          {r.attempt.score} · {r.attempt.passed ? 'lulus' : 'belum lulus'}
                        </span>
                      ) : (
                        <span className={`badge ${r.state === 'MISSED' ? 'badge-danger' : 'badge-neutral'}`}>{STATE_LABEL[r.state]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  );
}
