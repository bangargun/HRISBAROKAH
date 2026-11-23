'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/navigation';
import Dialog from '@/components/Dialog';
import type { EmployeeRecord } from '@/components/EmployeeDialog';

type Status = 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
type Priority = 'HIGH' | 'MEDIUM' | 'NORMAL';

interface Session {
  id: string;
  topic: string;
  scheduledDate: string;
  priority: Priority;
  status: Status;
  resultNote: string | null;
  completedAt: string | null;
  employee: { id: string; fullName: string; nik: string; position: { title: string } };
  outlet: { id: string; name: string };
  coach: { id: string; username: string; profile: { fullName: string } | null };
}
interface Coach { id: string; username: string; role: string; profile: { fullName: string } | null }
interface OutletOption { id: string; name: string }

const STATUS_LABEL: Record<Status, string> = {
  PLANNED: 'Direncanakan',
  IN_PROGRESS: 'Berjalan',
  DONE: 'Selesai',
  CANCELLED: 'Dibatalkan',
};
const STATUS_BADGE: Record<Status, string> = {
  PLANNED: 'badge-neutral',
  IN_PROGRESS: 'badge-warning',
  DONE: 'badge-success',
  CANCELLED: 'badge-neutral',
};
const PRIORITY_LABEL: Record<Priority, string> = { HIGH: 'Tinggi', MEDIUM: 'Sedang', NORMAL: 'Biasa' };
const PRIORITY_BADGE: Record<Priority, string> = { HIGH: 'badge-danger', MEDIUM: 'badge-warning', NORMAL: 'badge-neutral' };

const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const coachName = (c: { username: string; profile: { fullName: string } | null }) => c.profile?.fullName ?? c.username;
const isOpen = (s: Session) => s.status === 'PLANNED' || s.status === 'IN_PROGRESS';

/** Pendampingan kru: jadwal sesi tersimpan di server, ditutup dengan catatan hasil. */
export default function CoachingModule() {
  const role = getSessionUser()?.role;
  const isStoreManager = role === 'STORE_MANAGER';
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [outletId, setOutletId] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Session | 'new' | null>(null);
  const [finishing, setFinishing] = useState<Session | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (outletId) params.set('outletId', outletId);
    if (status) params.set('status', status);
    apiFetch<Session[]>(`/coaching${params.size ? `?${params}` : ''}`)
      .then(setSessions)
      .catch((e) => setError((e as Error).message));
  }, [outletId, status]);

  useEffect(load, [load]);
  useEffect(() => {
    if (!isStoreManager) apiFetch<OutletOption[]>('/outlets').then(setOutlets).catch(() => setOutlets([]));
  }, [isStoreManager]);

  const today = todayYmd();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sessions ?? []).filter(
      (s) =>
        !q ||
        s.topic.toLowerCase().includes(q) ||
        s.employee.fullName.toLowerCase().includes(q) ||
        s.employee.nik.toLowerCase().includes(q),
    );
  }, [sessions, query]);

  async function changeStatus(s: Session, next: Status) {
    setBusy(s.id);
    setError(null);
    try {
      await apiFetch(`/coaching/${s.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      setConfirmCancel(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col justify-between gap-4 p-4 md:flex-row md:items-start">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Pendampingan kru</h2>
          <p className="max-w-2xl text-sm text-slate-600">
            Sesi satu-lawan-satu untuk menaikkan standar kerja kru. Sesi ditutup dengan catatan hasil supaya tindak lanjutnya tercatat.
          </p>
        </div>
        <button type="button" onClick={() => setEditing('new')} className="btn btn-primary shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Jadwalkan pendampingan
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <label htmlFor="coaching-search" className="sr-only">Cari pendampingan</label>
          <input
            id="coaching-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari agenda, nama, NIK"
            className="input pl-9"
          />
        </div>
        <div className="segmented flex-wrap" role="group" aria-label="Saring status">
          {(['', 'PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const).map((st) => (
            <button key={st || 'all'} type="button" aria-pressed={status === st} onClick={() => setStatus(st)} className="segmented-item">
              {st ? STATUS_LABEL[st] : 'Semua'}
            </button>
          ))}
        </div>
        {!isStoreManager && (
          <>
            <label htmlFor="coaching-outlet" className="sr-only">Cabang</label>
            <select id="coaching-outlet" value={outletId} onChange={(e) => setOutletId(e.target.value)} className="input w-auto">
              <option value="">Semua cabang</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {error && <p role="alert" className="alert-error">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Agenda</th>
              <th scope="col" className="px-4 py-3">Kru</th>
              <th scope="col" className="px-4 py-3">Tanggal</th>
              <th scope="col" className="px-4 py-3">Prioritas</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {sessions === null ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-500">
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…</span>
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  {sessions.length === 0 ? 'Belum ada sesi pendampingan.' : 'Tidak ada sesi yang cocok dengan pencarian.'}
                </td>
              </tr>
            ) : (
              shown.map((s) => {
                const ymd = s.scheduledDate.slice(0, 10);
                const late = isOpen(s) && ymd < today;
                return (
                  <tr key={s.id} className="align-top">
                    <td className="max-w-xs px-4 py-3">
                      <div className="font-medium text-slate-900">{s.topic}</div>
                      <div className="mt-0.5 text-xs text-slate-500">Pendamping: {coachName(s.coach)}</div>
                      {s.resultNote && <p className="mt-1.5 whitespace-pre-line text-xs text-slate-600">Hasil: {s.resultNote}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{s.employee.fullName}</div>
                      <div className="text-xs text-slate-500">NIK {s.employee.nik} · {s.employee.position.title}</div>
                      <div className="text-xs text-slate-600">{s.outlet.name}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {dateFmt.format(new Date(ymd))}
                      {late && <span className="badge badge-danger ml-2">Terlambat</span>}
                    </td>
                    <td className="px-4 py-3"><span className={`badge ${PRIORITY_BADGE[s.priority]}`}>{PRIORITY_LABEL[s.priority]}</span></td>
                    <td className="whitespace-nowrap px-4 py-3"><span className={`badge ${STATUS_BADGE[s.status]}`}>{STATUS_LABEL[s.status]}</span></td>
                    <td className="px-4 py-3">
                      {isOpen(s) &&
                        (confirmCancel === s.id ? (
                          <span className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-slate-600">Batalkan sesi?</span>
                            <button type="button" disabled={!!busy} onClick={() => changeStatus(s, 'CANCELLED')} className="btn btn-sm btn-danger">Batalkan</button>
                            <button type="button" disabled={!!busy} onClick={() => setConfirmCancel(null)} className="btn btn-sm btn-ghost">Tidak</button>
                          </span>
                        ) : (
                          <span className="flex flex-wrap items-center justify-end gap-1.5">
                            {s.status === 'PLANNED' && (
                              <button type="button" disabled={!!busy} onClick={() => changeStatus(s, 'IN_PROGRESS')} className="btn btn-sm btn-secondary">
                                {busy === s.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Mulai
                              </button>
                            )}
                            <button type="button" disabled={!!busy} onClick={() => setFinishing(s)} className="btn btn-sm btn-primary">Selesai</button>
                            <button type="button" disabled={!!busy} onClick={() => setEditing(s)} className="btn btn-sm btn-ghost">Ubah</button>
                            <button type="button" disabled={!!busy} onClick={() => setConfirmCancel(s.id)} className="btn btn-sm btn-ghost">Batalkan</button>
                          </span>
                        ))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <SessionDialog
          session={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {finishing && (
        <FinishDialog
          session={finishing}
          onClose={() => setFinishing(null)}
          onSaved={() => {
            setFinishing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function SessionDialog({ session, onClose, onSaved }: { session: Session | null; onClose: () => void; onSaved: () => void }) {
  const me = getSessionUser();
  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(session ? [] : null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [form, setForm] = useState({
    employeeId: session?.employee.id ?? '',
    topic: session?.topic ?? '',
    scheduledDate: session?.scheduledDate.slice(0, 10) ?? todayYmd(),
    priority: session?.priority ?? ('NORMAL' as Priority),
    coachId: session?.coach.id ?? me?.id ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Coach[]>('/coaching/coaches').then(setCoaches).catch((e) => setError((e as Error).message));
    if (!session) {
      apiFetch<EmployeeRecord[]>('/employees')
        .then((d) => setEmployees(d.filter((e) => e.user.isActive)))
        .catch((e) => {
          setEmployees([]);
          setError((e as Error).message);
        });
    }
  }, [session]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { topic: form.topic, scheduledDate: form.scheduledDate, priority: form.priority, coachId: form.coachId };
      if (session) await apiFetch(`/coaching/${session.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/coaching', { method: 'POST', body: JSON.stringify({ ...body, employeeId: form.employeeId }) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title={session ? 'Ubah sesi pendampingan' : 'Jadwalkan pendampingan'} onClose={() => !saving && onClose()}>
      <form onSubmit={save} className="space-y-3">
        {session ? (
          <p className="text-sm text-slate-700">
            Kru: <span className="font-medium text-slate-900">{session.employee.fullName}</span> · {session.outlet.name}
          </p>
        ) : (
          <label className="block space-y-1">
            <span className="field-label">Kru</span>
            <select required value={form.employeeId} onChange={set('employeeId')} className="input" disabled={employees === null}>
              <option value="">{employees === null ? 'Memuat…' : 'Pilih kru'}</option>
              {(employees ?? []).map((e) => (
                <option key={e.id} value={e.id}>{e.fullName} · {e.position.title} · {e.outlet.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block space-y-1">
          <span className="field-label">Agenda / fokus pendampingan</span>
          <input required maxLength={200} value={form.topic} onChange={set('topic')} className="input" placeholder="Misalnya: gramatur sambal sesuai SOP" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="field-label">Tanggal sesi</span>
            <input required type="date" value={form.scheduledDate} onChange={set('scheduledDate')} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">Prioritas</span>
            <select value={form.priority} onChange={set('priority')} className="input">
              {(['HIGH', 'MEDIUM', 'NORMAL'] as const).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="field-label">Pendamping</span>
          <select required value={form.coachId} onChange={set('coachId')} className="input">
            {coaches.length === 0 && <option value={form.coachId}>Memuat…</option>}
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>{coachName(c)} · {ROLE_LABEL[c.role] ?? c.role}</option>
            ))}
          </select>
        </label>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={saving} onClick={onClose} className="btn btn-ghost">Batal</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Simpan
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function FinishDialog({ session, onClose, onSaved }: { session: Session; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/coaching/${session.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'DONE', resultNote: note }),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="Tandai sesi selesai" onClose={() => !saving && onClose()}>
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-slate-700">
          {session.topic} · <span className="font-medium text-slate-900">{session.employee.fullName}</span>
        </p>
        <label className="block space-y-1">
          <span className="field-label">Catatan hasil</span>
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
            placeholder="Apa yang dibahas, apa yang sudah baik, dan tindak lanjutnya"
          />
        </label>
        <p className="text-xs text-slate-500">Sesi yang sudah selesai tidak bisa diubah lagi.</p>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={saving} onClick={onClose} className="btn btn-ghost">Batal</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Simpan & selesaikan
          </button>
        </div>
      </form>
    </Dialog>
  );
}
