'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { type SessionUser, updateSession } from '@/lib/auth';
import Dialog from '@/components/Dialog';

const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:border-amber-500';

/** Akun saya: ganti password dan username akun yang sedang masuk. */
export default function AccountDialog({
  user,
  onClose,
  onChanged,
}: {
  user: SessionUser;
  onClose: () => void;
  onChanged: (user: SessionUser) => void;
}) {
  const [tab, setTab] = useState<'password' | 'username'>('password');
  const [pw, setPw] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [un, setUn] = useState({ newUsername: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) {
      setNotice({ ok: false, text: 'Konfirmasi password baru tidak sama' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiFetch<{ accessToken: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword: pw.oldPassword, newPassword: pw.newPassword }),
      });
      updateSession(res.accessToken);
      setPw({ oldPassword: '', newPassword: '', confirm: '' });
      setNotice({ ok: true, text: 'Password diganti. Perangkat lain yang memakai akun ini perlu masuk lagi.' });
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function changeUsername(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiFetch<{ accessToken: string; user: unknown }>('/auth/change-username', {
        method: 'POST',
        body: JSON.stringify(un),
      });
      const updated = updateSession(res.accessToken, res.user);
      if (updated) onChanged(updated);
      setUn({ newUsername: '', password: '' });
      setNotice({ ok: true, text: `Username diganti menjadi ${updated?.username}. Pakai username ini saat masuk berikutnya.` });
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Akun saya" onClose={() => !busy && onClose()}>
      <p className="text-slate-600">
        Masuk sebagai <span className="font-mono font-medium text-slate-900">{user.username}</span>
      </p>
      <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label="Pengaturan akun">
        {(['password', 'username'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setNotice(null);
            }}
            className={`rounded px-3 py-1.5 font-medium ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {t === 'password' ? 'Ganti password' : 'Ganti username'}
          </button>
        ))}
      </div>

      {tab === 'password' ? (
        <form onSubmit={changePassword} className="space-y-3">
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Password saat ini</span>
            <input required type="password" autoComplete="current-password" value={pw.oldPassword} onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })} className={field} />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Password baru</span>
            <input required type="password" minLength={6} maxLength={72} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className={field} />
            <span className="block text-xs text-slate-500">Minimal 6 karakter. Sebaiknya 10 karakter atau lebih, campur huruf dan angka.</span>
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Ulangi password baru</span>
            <input required type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className={field} />
          </label>
          <Footer busy={busy} notice={notice} onClose={onClose} label="Ganti password" />
        </form>
      ) : (
        <form onSubmit={changeUsername} className="space-y-3">
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Username baru</span>
            <input
              required
              pattern="[A-Za-z0-9._\-]{3,30}"
              title="3-30 karakter: huruf, angka, titik, garis bawah atau tanda hubung"
              autoComplete="off"
              value={un.newUsername}
              onChange={(e) => setUn({ ...un, newUsername: e.target.value })}
              className={`${field} lowercase`}
            />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Password saat ini</span>
            <input required type="password" autoComplete="current-password" value={un.password} onChange={(e) => setUn({ ...un, password: e.target.value })} className={field} />
          </label>
          <Footer busy={busy} notice={notice} onClose={onClose} label="Ganti username" />
        </form>
      )}
    </Dialog>
  );
}

function Footer({ busy, notice, onClose, label }: { busy: boolean; notice: { ok: boolean; text: string } | null; onClose: () => void; label: string }) {
  return (
    <>
      {notice && (
        <p
          role={notice.ok ? 'status' : 'alert'}
          className={`rounded-md border px-3 py-2 ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}
        >
          {notice.text}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-md px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
          Tutup
        </button>
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {label}
        </button>
      </div>
    </>
  );
}
