'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';
import type { EmployeeRecord } from '@/components/EmployeeDialog';
import { OutletOption, longDate, todayYmd } from './shared';

interface Participant {
  id: string;
  employeeId: string;
  attended: boolean | null;
  employee: { id: string; fullName: string; outletId: string; outlet: { name: string }; position: { title: string } };
}
interface Session {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: 'OFFLINE' | 'ONLINE';
  location: string | null;
  meetingUrl: string | null;
  trainerName: string;
  notes: string | null;
  status: 'PLANNED' | 'DONE' | 'CANCELLED';
  module: { id: string; code: string; title: string } | null;
  participants: Participant[];
}
interface ModuleOption { id: string; code: string; title: string }

const STATUS: Record<Session['status'], [string, string]> = {
  PLANNED: ['Terjadwal', 'badge-neutral'],
  DONE: ['Selesai', 'badge-success'],
  CANCELLED: ['Dibatalkan', 'badge-neutral'],
};

/** Jadwal pelatihan tatap muka / online: peserta dan daftar hadir. */
export default function SessionsTab({ canManage, outlets }: { canManage: boolean; outlets: OutletOption[] }) {
  const [rows, setRows] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Session | 'new' | null>(null);
  const [attending, setAttending] = useState<Session | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<Session[]>('/training/sessions').then(setRows).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  async function setStatus(s: Session, status: Session['status']) {
    setBusy(s.id);
    setError(null);
    try {
      await apiFetch(`/training/sessions/${s.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
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
          <h2 className="text-base font-semibold text-slate-900">Jadwal pelatihan</h2>
          <p className="max-w-2xl text-sm text-slate-600">Sesi tatap muka atau online. Peserta melihat jadwalnya di aplikasi HP; kehadiran dicatat di sini.</p>
        </div>
        {canManage && (
          <button type="button" onClick={() => setEditing('new')} className="btn btn-primary shrink-0">
            <Plus className="h-4 w-4" aria-hidden /> Sesi baru
          </button>
        )}
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Sesi</th>
              <th scope="col" className="px-4 py-3">Waktu</th>
              <th scope="col" className="px-4 py-3">Tempat</th>
              <th scope="col" className="px-4 py-3">Peserta</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null ? (
              <tr><td colSpan={6} className="px-4 py-6 text-slate-500">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">Belum ada sesi pelatihan.</td></tr>
            ) : (
              rows.map((s) => {
                const present = s.participants.filter((p) => p.attended === true).length;
                return (
                  <tr key={s.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{s.title}</div>
                      <div className="text-xs text-slate-500">
                        Pelatih: {s.trainerName}
                        {s.module && ` · ${s.module.code}`}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {longDate(s.date)}
                      <div className="text-xs text-slate-500">{s.startTime}–{s.endTime}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {s.mode === 'ONLINE' ? (
                        <a href={s.meetingUrl ?? '#'} target="_blank" rel="noreferrer" className="underline">Online</a>
                      ) : (
                        s.location
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {s.participants.length}
                      {s.status !== 'PLANNED' || s.participants.some((p) => p.attended !== null) ? <span className="text-xs text-slate-500"> · hadir {present}</span> : null}
                    </td>
                    <td className="px-4 py-3"><span className={`badge ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span></td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap justify-end gap-1.5">
                        {s.status !== 'CANCELLED' && (
                          <button type="button" onClick={() => setAttending(s)} className="btn btn-sm btn-secondary">Daftar hadir</button>
                        )}
                        {canManage && s.status === 'PLANNED' && (
                          <>
                            <button type="button" onClick={() => setEditing(s)} className="btn btn-sm btn-ghost">Ubah</button>
                            <button type="button" disabled={busy === s.id} onClick={() => setStatus(s, 'DONE')} className="btn btn-sm btn-primary">Selesai</button>
                            <button type="button" disabled={busy === s.id} onClick={() => setStatus(s, 'CANCELLED')} className="btn btn-sm btn-ghost">Batalkan</button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <SessionEditor
          session={editing === 'new' ? null : editing}
          outlets={outlets}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {attending && (
        <AttendanceDialog
          session={attending}
          onClose={() => setAttending(null)}
          onSaved={() => {
            setAttending(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function SessionEditor({ session, outlets, onClose, onSaved }: { session: Session | null; outlets: OutletOption[]; onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [form, setForm] = useState({
    title: session?.title ?? '',
    moduleId: session?.module?.id ?? '',
    date: session?.date.slice(0, 10) ?? todayYmd(),
    startTime: session?.startTime ?? '09:00',
    endTime: session?.endTime ?? '11:00',
    mode: session?.mode ?? 'OFFLINE',
    location: session?.location ?? '',
    meetingUrl: session?.meetingUrl ?? '',
    trainerName: session?.trainerName ?? '',
    notes: session?.notes ?? '',
  });
  const [participants, setParticipants] = useState<string[]>(session?.participants.map((p) => p.employeeId) ?? []);
  const [filterOutlet, setFilterOutlet] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    apiFetch<EmployeeRecord[]>('/employees').then((d) => setEmployees(d.filter((e) => e.user.isActive))).catch((e) => setError((e as Error).message));
    apiFetch<ModuleOption[]>('/training/modules').then(setModules).catch(() => setModules([]));
  }, []);
  const visible = useMemo(() => employees.filter((e) => !filterOutlet || e.outletId === filterOutlet), [employees, filterOutlet]);
  const toggle = (id: string) => setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allVisible = visible.length > 0 && visible.every((e) => participants.includes(e.id));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        moduleId: form.moduleId || null,
        location: form.mode === 'OFFLINE' ? form.location : undefined,
        meetingUrl: form.mode === 'ONLINE' ? form.meetingUrl : null,
        participantIds: participants,
      };
      await apiFetch(session ? `/training/sessions/${session.id}` : '/training/sessions', { method: session ? 'PUT' : 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog wide title={session ? 'Ubah sesi' : 'Sesi baru'} onClose={() => !saving && onClose()}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block space-y-1 md:col-span-2">
            <span className="field-label">Judul</span>
            <input required maxLength={200} value={form.title} onChange={set('title')} className="input" />
          </label>
          <label className="block space-y-1 md:col-span-2">
            <span className="field-label">Modul terkait (opsional)</span>
            <select value={form.moduleId} onChange={set('moduleId')} className="input">
              <option value="">Tanpa modul</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.code} · {m.title}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="field-label">Tanggal</span>
            <input required type="date" value={form.date} onChange={set('date')} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">Mulai</span>
            <input required type="time" value={form.startTime} onChange={set('startTime')} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">Selesai</span>
            <input required type="time" value={form.endTime} onChange={set('endTime')} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="field-label">Mode</span>
            <select value={form.mode} onChange={set('mode')} className="input">
              <option value="OFFLINE">Tatap muka</option>
              <option value="ONLINE">Online</option>
            </select>
          </label>
          {form.mode === 'OFFLINE' ? (
            <label className="block space-y-1 md:col-span-2">
              <span className="field-label">Lokasi</span>
              <input required maxLength={200} value={form.location} onChange={set('location')} className="input" />
            </label>
          ) : (
            <label className="block space-y-1 md:col-span-2">
              <span className="field-label">Tautan rapat</span>
              <input required type="url" value={form.meetingUrl} onChange={set('meetingUrl')} className="input" placeholder="https://..." />
            </label>
          )}
          <label className="block space-y-1 md:col-span-2">
            <span className="field-label">Pelatih</span>
            <input required maxLength={100} value={form.trainerName} onChange={set('trainerName')} className="input" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="field-label">Catatan (opsional)</span>
          <input maxLength={1000} value={form.notes} onChange={set('notes')} className="input" />
        </label>
        <fieldset className="space-y-2">
          <legend className="field-label">Peserta ({participants.length})</legend>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="session-outlet" className="sr-only">Saring cabang</label>
            <select id="session-outlet" value={filterOutlet} onChange={(e) => setFilterOutlet(e.target.value)} className="input w-auto">
              <option value="">Semua cabang</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                setParticipants((p) => (allVisible ? p.filter((id) => !visible.some((v) => v.id === id)) : Array.from(new Set([...p, ...visible.map((v) => v.id)]))))
              }
              className="btn btn-sm btn-ghost"
            >
              {allVisible ? 'Lepas semua yang tampil' : 'Pilih semua yang tampil'}
            </button>
          </div>
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-slate-200 p-3 sm:grid-cols-2">
            {visible.map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" checked={participants.includes(e.id)} onChange={() => toggle(e.id)} />
                {e.fullName} <span className="text-xs text-slate-500">· {e.position.title} · {e.outlet.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={saving} onClick={onClose} className="btn btn-ghost">Batal</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Simpan
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function AttendanceDialog({ session, onClose, onSaved }: { session: Session; onClose: () => void; onSaved: () => void }) {
  const me = getSessionUser();
  const [ownOutletId, setOwnOutletId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, boolean | null>>(Object.fromEntries(session.participants.map((p) => [p.employeeId, p.attended])));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isStoreManager = me?.role === 'STORE_MANAGER';

  useEffect(() => {
    // Kepala Cabang hanya boleh mencatat kru cabangnya: cabang diambil dari profil akunnya
    if (isStoreManager) {
      apiFetch<{ profile?: { outletId: string } | null }>('/auth/me')
        .then((u) => setOwnOutletId(u.profile?.outletId ?? null))
        .catch(() => setOwnOutletId(null));
    }
  }, [isStoreManager]);
  const editable = (p: Participant) => !isStoreManager || p.employee.outletId === ownOutletId;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const entries = session.participants
        .filter((p) => editable(p) && marks[p.employeeId] !== null && marks[p.employeeId] !== p.attended)
        .map((p) => ({ employeeId: p.employeeId, attended: marks[p.employeeId] as boolean }));
      if (entries.length) await apiFetch(`/training/sessions/${session.id}/attendance`, { method: 'PATCH', body: JSON.stringify({ entries }) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog wide title={`Daftar hadir · ${session.title}`} onClose={() => !saving && onClose()}>
      <div className="space-y-3">
        <div className="max-h-[55vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head sticky top-0">
              <tr>
                <th scope="col" className="px-3 py-2">Peserta</th>
                <th scope="col" className="px-3 py-2">Kehadiran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {session.participants.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{p.employee.fullName}</div>
                    <div className="text-xs text-slate-500">{p.employee.position.title} · {p.employee.outlet.name}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="segmented" role="group" aria-label={`Kehadiran ${p.employee.fullName}`}>
                      {([[true, 'Hadir'], [false, 'Tidak hadir']] as const).map(([v, l]) => (
                        <button
                          key={l}
                          type="button"
                          disabled={!editable(p) || session.status === 'DONE'}
                          aria-pressed={marks[p.employeeId] === v}
                          onClick={() => setMarks({ ...marks, [p.employeeId]: v })}
                          className="segmented-item"
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={saving} onClick={onClose} className="btn btn-ghost">Tutup</button>
          {session.status !== 'DONE' && (
            <button type="button" disabled={saving} onClick={save} className="btn btn-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Simpan kehadiran
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
