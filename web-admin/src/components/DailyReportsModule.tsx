'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { BACKEND_API, getSessionUser } from '@/lib/auth';
import Dialog from '@/components/Dialog';

interface ChecklistItem {
  key: string;
  title: string;
  category: string;
  targetTime: string;
  description: string;
}

interface Photo {
  itemKey: string;
  photoUrl: string;
  notes: string | null;
  submittedAt: string;
  submittedBy: { username: string; profile: { fullName: string } | null };
}

interface DayReport {
  date: string;
  total: number;
  outlets: { outlet: { id: string; name: string }; photos: Photo[] }[];
}

const BACKEND_ORIGIN = BACKEND_API.replace(/\/api\/v1\/?$/, '');
const timeFmt = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Perkecil foto (sisi terpanjang 1600 px, JPEG) agar di bawah batas 2 MB server. */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('File bukan gambar yang bisa dibaca'));
    };
    img.src = url;
  });
}

/** Laporan harian cabang: 14 foto checklist operasional per cabang per hari, dari database. */
export default function DailyReportsModule() {
  const role = getSessionUser()?.role;
  const today = localYmd();
  const yesterday = localYmd(new Date(Date.now() - 86_400_000));

  const [checklist, setChecklist] = useState<{ categories: Record<string, string>; items: ChecklistItem[] } | null>(null);
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<DayReport | null>(null);
  const [outletId, setOutletId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<ChecklistItem | null>(null);
  const [viewing, setViewing] = useState<{ item: ChecklistItem; photo: Photo } | null>(null);

  // Laporan hanya bisa diisi untuk hari ini atau kemarin (closing lewat tengah malam)
  const canSubmit = (role === 'STORE_MANAGER' || role === 'SUPER_ADMIN' || role === 'HR_ADMIN' || role === 'AREA_MANAGER') &&
    (date === today || date === yesterday);

  useEffect(() => {
    apiFetch<{ categories: Record<string, string>; items: ChecklistItem[] }>('/daily-reports/checklist')
      .then(setChecklist)
      .catch((e) => setError((e as Error).message));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<DayReport>(`/daily-reports?date=${date}`);
      setReport(r);
      setOutletId((cur) => (r.outlets.some((o) => o.outlet.id === cur) ? cur : r.outlets[0]?.outlet.id ?? ''));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const current = report?.outlets.find((o) => o.outlet.id === outletId);
  const photoOf = new Map((current?.photos ?? []).map((p) => [p.itemKey, p]));
  const categories = checklist ? Object.keys(checklist.categories) : [];

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-slate-600">Tanggal</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="input w-auto py-1.5"
            />
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden /> Muat ulang
          </button>
        </div>
        {!canSubmit && date !== today && <p className="text-xs text-slate-500">Laporan tanggal ini hanya bisa dilihat.</p>}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">{error}</p>
      ) : !report || !checklist ? (
        <p className="flex items-center justify-center gap-2 p-10 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat laporan…
        </p>
      ) : report.outlets.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-600">Belum ada cabang aktif.</p>
      ) : (
        <>
          {/* Ringkasan per cabang; klik untuk melihat detailnya */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {report.outlets.map(({ outlet, photos }) => {
              const done = photos.length;
              const selected = outlet.id === outletId;
              return (
                <button
                  key={outlet.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setOutletId(outlet.id)}
                  className={`rounded-lg border bg-white p-3 text-left ${selected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <p className="font-medium text-slate-900">{outlet.name}</p>
                  <p className={`text-xs ${done === report.total ? 'text-emerald-700' : done === 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                    {done} dari {report.total} foto
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-100">
                    <div className="h-full bg-emerald-500" style={{ width: `${(done / report.total) * 100}%` }} />
                  </div>
                </button>
              );
            })}
          </div>

          {current &&
            categories.map((cat) => {
              const items = checklist.items.filter((i) => i.category === cat);
              return (
                <section key={cat} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 font-semibold text-slate-900">
                    {checklist.categories[cat]}
                  </h3>
                  <ul className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const photo = photoOf.get(item.key);
                      return (
                        <li key={item.key} className="flex items-start gap-3 px-4 py-3">
                          {photo ? (
                            <button
                              type="button"
                              onClick={() => setViewing({ item, photo })}
                              className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200"
                              aria-label={`Lihat foto ${item.title}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`${BACKEND_ORIGIN}${photo.photoUrl}`} alt="" className="h-full w-full object-cover" />
                            </button>
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400">
                              <Camera className="h-5 w-5" aria-hidden />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900">{item.title}</p>
                            <p className="text-xs text-slate-500">{item.targetTime}</p>
                            {photo ? (
                              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                                <Check className="h-3.5 w-3.5" aria-hidden />
                                {timeFmt.format(new Date(photo.submittedAt))} oleh{' '}
                                {photo.submittedBy.profile?.fullName ?? photo.submittedBy.username}
                                {photo.notes ? ` · ${photo.notes}` : ''}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-slate-500">Belum ada foto</p>
                            )}
                          </div>
                          {canSubmit && (
                            <button
                              type="button"
                              onClick={() => setUploading(item)}
                              className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {photo ? 'Ganti foto' : 'Unggah foto'}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
        </>
      )}

      {uploading && current && (
        <UploadDialog
          item={uploading}
          date={date}
          outlet={current.outlet}
          sendOutletId={role !== 'STORE_MANAGER'}
          onClose={() => setUploading(null)}
          onSaved={() => {
            setUploading(null);
            load();
          }}
        />
      )}

      {viewing && (
        <Dialog wide title={viewing.item.title} onClose={() => setViewing(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BACKEND_ORIGIN}${viewing.photo.photoUrl}`} alt={viewing.item.title} className="max-h-[60vh] w-full rounded-md object-contain" />
          <p className="text-slate-700">{viewing.item.description}</p>
          <p className="text-xs text-slate-500">
            Dikirim {new Date(viewing.photo.submittedAt).toLocaleString('id-ID')} oleh{' '}
            {viewing.photo.submittedBy.profile?.fullName ?? viewing.photo.submittedBy.username}
            {viewing.photo.notes ? ` · ${viewing.photo.notes}` : ''}
          </p>
        </Dialog>
      )}
    </div>
  );
}

function UploadDialog({
  item,
  date,
  outlet,
  sendOutletId,
  onClose,
  onSaved,
}: {
  item: ChecklistItem;
  date: string;
  outlet: { id: string; name: string };
  sendOutletId: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) {
      setError('Pilih foto terlebih dahulu');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/daily-reports/${date}/${item.key}`, {
        method: 'PUT',
        body: JSON.stringify({ photoBase64: photo, notes, ...(sendOutletId && { outletId: outlet.id }) }),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog title={`${item.title} · ${outlet.name}`} onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-slate-600">{item.description}</p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pick} className="sr-only" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
          style={{ minHeight: 160 }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Pratinjau" className="max-h-64 w-full object-contain" />
          ) : (
            <span className="flex items-center gap-2 py-12">
              <Camera className="h-5 w-5" aria-hidden /> Pilih atau ambil foto
            </span>
          )}
        </button>
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Catatan (opsional)</span>
          <input
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input"
          />
        </label>
        {error && <p role="alert" className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={saving} onClick={onClose} className="btn btn-ghost px-4">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary px-4"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Kirim foto
          </button>
        </div>
      </form>
    </Dialog>
  );
}
