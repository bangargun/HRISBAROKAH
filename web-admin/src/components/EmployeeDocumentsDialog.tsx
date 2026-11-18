'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { apiBlob, apiFetch, apiUpload } from '@/lib/api';
import Dialog from '@/components/Dialog';

interface DocumentRow {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  size: number;
  note: string | null;
  createdAt: string;
  uploadedBy: { username: string; profile: { fullName: string } | null };
}

const TYPES: [string, string][] = [
  ['KTP', 'KTP'],
  ['KK', 'Kartu keluarga'],
  ['CONTRACT', 'Kontrak kerja'],
  ['DIPLOMA', 'Ijazah'],
  ['NPWP', 'NPWP'],
  ['BPJS', 'Kartu BPJS'],
  ['OTHER', 'Lainnya'],
];
const TYPE_LABEL = Object.fromEntries(TYPES);
const MAX_BYTES = 5 * 1024 * 1024;
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/** Dokumen pribadi karyawan (KTP, KK, kontrak, ...). Hanya HR dan Super Admin; berkas tidak terbuka untuk publik. */
export default function EmployeeDocumentsDialog({ employee, onClose }: { employee: { id: string; fullName: string }; onClose: () => void }) {
  const base = `/employees/${employee.id}/documents`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [type, setType] = useState('KTP');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocumentRow | null>(null);

  const load = useCallback(() => {
    apiFetch<DocumentRow[]>(base)
      .then(setDocs)
      .catch((e) => setError((e as Error).message));
  }, [base]);

  useEffect(load, [load]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (f && f.size > MAX_BYTES) {
      setError('Ukuran berkas maksimal 5 MB');
      return;
    }
    setError(null);
    setFile(f);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Pilih berkas PDF, JPG atau PNG');
      return;
    }
    setBusy('upload');
    setError(null);
    try {
      const form = new FormData();
      form.append('type', type);
      if (note.trim()) form.append('note', note.trim());
      form.append('file', file);
      await apiUpload(base, form);
      setFile(null);
      setNote('');
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function view(doc: DocumentRow) {
    setBusy(doc.id);
    setError(null);
    // Jendela dibuka dulu agar tidak diblokir browser, lalu diisi setelah berkas terunduh
    const win = window.open('', '_blank');
    try {
      const blob = await apiBlob(`${base}/${doc.id}/file`);
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      win?.close();
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(doc: DocumentRow) {
    setBusy(doc.id);
    setError(null);
    try {
      await apiFetch(`${base}/${doc.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog wide title={`Dokumen ${employee.fullName}`} onClose={() => !busy && onClose()}>
      <p className="text-slate-600">Berkas pribadi, hanya bisa dibuka HR dan Super Admin. PDF, JPG atau PNG, maksimal 5 MB.</p>

      {docs === null ? (
        <p className="flex items-center gap-2 py-4 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…</p>
      ) : docs.length === 0 ? (
        <p className="empty-state">Belum ada dokumen.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <FileText className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{TYPE_LABEL[d.type] ?? d.type}</p>
                <p className="truncate text-xs text-slate-500">
                  {d.fileName} · {size(d.size)} · {dateFmt.format(new Date(d.createdAt))} oleh {d.uploadedBy.profile?.fullName ?? d.uploadedBy.username}
                </p>
                {d.note && <p className="text-xs text-slate-600">{d.note}</p>}
              </div>
              {confirmDelete?.id === d.id ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600">Hapus permanen?</span>
                  <button type="button" disabled={!!busy} onClick={() => remove(d)} className="btn btn-sm btn-danger">Hapus</button>
                  <button type="button" disabled={!!busy} onClick={() => setConfirmDelete(null)} className="btn btn-sm btn-ghost">Batal</button>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <button type="button" disabled={!!busy} onClick={() => view(d)} className="btn btn-sm btn-secondary">
                    {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />} Lihat
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setConfirmDelete(d)}
                    className="btn btn-sm btn-ghost"
                    aria-label={`Hapus ${TYPE_LABEL[d.type] ?? d.type}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={upload} className="space-y-3 border-t border-slate-100 pt-3">
        <p className="font-medium text-slate-900">Tambah dokumen</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="field-label">Jenis</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="field-label">Catatan (opsional)</span>
            <input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className="input" />
          </label>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" onChange={pick} className="sr-only" />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-secondary">
            <Upload className="h-4 w-4" aria-hidden /> Pilih berkas
          </button>
          <span className="truncate text-slate-600">{file ? `${file.name} (${size(file.size)})` : 'Belum ada berkas dipilih'}</span>
        </div>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={!!busy} onClick={onClose} className="btn btn-ghost">Tutup</button>
          <button type="submit" disabled={!!busy || !file} className="btn btn-primary">
            {busy === 'upload' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Unggah
          </button>
        </div>
      </form>
    </Dialog>
  );
}
