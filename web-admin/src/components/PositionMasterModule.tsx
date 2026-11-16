'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Dialog from '@/components/Dialog';

interface Position {
  id: string;
  title: string;
  _count: { employees: number };
}

interface Department {
  id: string;
  name: string;
  positions: Position[];
}

/** Yang sedang diisi di dialog: tambah/ubah departemen, tambah/ubah jabatan, atau hapus salah satunya */
type Action =
  | { kind: 'add-dept' }
  | { kind: 'rename-dept'; dept: Department }
  | { kind: 'delete-dept'; dept: Department }
  | { kind: 'add-pos'; dept: Department }
  | { kind: 'rename-pos'; pos: Position }
  | { kind: 'delete-pos'; pos: Position };

/** Departemen dan jabatan, langsung dari database. Dipakai sebagai pilihan jabatan di form karyawan. */
export default function PositionMasterModule() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<Department[]>('/departments')
      .then((d) => {
        setDepartments(d);
        setLoadError(null);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  useEffect(load, [load]);

  function open(next: Action) {
    setAction(next);
    setError(null);
    setName(next.kind === 'rename-dept' ? next.dept.name : next.kind === 'rename-pos' ? next.pos.title : '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;
    const body = JSON.stringify({ name });
    const request: [string, string] =
      action.kind === 'add-dept' ? ['/departments', 'POST']
      : action.kind === 'rename-dept' ? [`/departments/${action.dept.id}`, 'PUT']
      : action.kind === 'delete-dept' ? [`/departments/${action.dept.id}`, 'DELETE']
      : action.kind === 'add-pos' ? [`/departments/${action.dept.id}/positions`, 'POST']
      : action.kind === 'rename-pos' ? [`/departments/positions/${action.pos.id}`, 'PUT']
      : [`/departments/positions/${action.pos.id}`, 'DELETE'];
    setSaving(true);
    setError(null);
    try {
      await apiFetch(request[0], { method: request[1], ...(request[1] !== 'DELETE' && { body }) });
      setAction(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const iconBtn = 'rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900';
  const isDelete = action?.kind === 'delete-dept' || action?.kind === 'delete-pos';
  const title = !action
    ? ''
    : action.kind === 'add-dept' ? 'Tambah departemen'
    : action.kind === 'rename-dept' ? 'Ubah nama departemen'
    : action.kind === 'delete-dept' ? `Hapus departemen ${action.dept.name}?`
    : action.kind === 'add-pos' ? `Tambah jabatan di ${action.dept.name}`
    : action.kind === 'rename-pos' ? 'Ubah nama jabatan'
    : `Hapus jabatan ${action.pos.title}?`;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-600">Jabatan di sini menjadi pilihan saat menambah atau mengubah data karyawan.</p>
        <button
          type="button"
          onClick={() => open({ kind: 'add-dept' })}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" aria-hidden /> Tambah departemen
        </button>
      </div>

      {loadError ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">
          Gagal memuat departemen: {loadError}
        </p>
      ) : departments === null ? (
        <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
        </p>
      ) : departments.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-600">
          <p className="font-medium text-slate-800">Belum ada departemen.</p>
          <p className="mt-1">Tambahkan departemen pertama, misalnya Dapur atau Pelayanan, lalu isi jabatannya.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {departments.map((dept) => (
            <section key={dept.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <h3 className="font-semibold text-slate-900">{dept.name}</h3>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => open({ kind: 'rename-dept', dept })} className={iconBtn} aria-label={`Ubah nama ${dept.name}`} title="Ubah nama">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  {dept.positions.length === 0 && (
                    <button type="button" onClick={() => open({ kind: 'delete-dept', dept })} className={`${iconBtn} hover:text-rose-700`} aria-label={`Hapus ${dept.name}`} title="Hapus">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </header>
              <ul className="divide-y divide-slate-100">
                {dept.positions.length === 0 && <li className="px-4 py-3 text-slate-500">Belum ada jabatan.</li>}
                {dept.positions.map((pos) => (
                  <li key={pos.id} className="flex items-center justify-between gap-2 px-4 py-2">
                    <span className="text-slate-800">{pos.title}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{pos._count.employees} karyawan</span>
                      <button type="button" onClick={() => open({ kind: 'rename-pos', pos })} className={iconBtn} aria-label={`Ubah nama ${pos.title}`} title="Ubah nama">
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      {pos._count.employees === 0 && (
                        <button type="button" onClick={() => open({ kind: 'delete-pos', pos })} className={`${iconBtn} hover:text-rose-700`} aria-label={`Hapus ${pos.title}`} title="Hapus">
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 px-4 py-2">
                <button
                  type="button"
                  onClick={() => open({ kind: 'add-pos', dept })}
                  className="inline-flex items-center gap-1 font-medium text-amber-700 hover:text-amber-800"
                >
                  <Plus className="h-4 w-4" aria-hidden /> Tambah jabatan
                </button>
              </div>
            </section>
          ))}
        </div>
      )}

      {action && (
        <Dialog title={title} onClose={() => !saving && setAction(null)}>
          <form onSubmit={submit} className="space-y-3">
            {isDelete ? (
              <p className="text-slate-700">Data ini dihapus permanen. Hanya bisa dilakukan selama belum dipakai.</p>
            ) : (
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">{action.kind.endsWith('dept') ? 'Nama departemen' : 'Nama jabatan'}</span>
                <input
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-amber-500"
                />
              </label>
            )}
            {error && (
              <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{error}</p>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" disabled={saving} onClick={() => setAction(null)} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 font-medium text-white disabled:opacity-50 ${
                  isDelete ? 'bg-rose-700 hover:bg-rose-800' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {isDelete ? 'Hapus' : 'Simpan'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
