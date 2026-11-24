'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { type SessionUser, updateSession } from '@/lib/auth';
import Dialog from '@/components/Dialog';

const field = 'input';

/** Akun saya: ganti password dan username, dan hubungkan Telegram untuk notifikasi. */
export default function AccountDialog({
  user,
  onClose,
  onChanged,
}: {
  user: SessionUser;
  onClose: () => void;
  onChanged: (user: SessionUser) => void;
}) {
  const [tab, setTab] = useState<'password' | 'username' | 'telegram'>('password');
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
      <div className="segmented" role="group" aria-label="Pengaturan akun">
        {(['password', 'username', 'telegram'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setNotice(null);
            }}
            className="segmented-item"
          >
            {t === 'password' ? 'Ganti password' : t === 'username' ? 'Ganti username' : 'Telegram'}
          </button>
        ))}
      </div>

      {tab === 'telegram' ? (
        <TelegramLink onClose={onClose} />
      ) : tab === 'password' ? (
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
        <button type="button" disabled={busy} onClick={onClose} className="btn btn-ghost px-4">
          Tutup
        </button>
        <button type="submit" disabled={busy} className="btn btn-primary px-4">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {label}
        </button>
      </div>
    </>
  );
}

interface TelegramStatus {
  available: boolean;
  linked: boolean;
  telegramUsername: string | null;
}

/**
 * Hubungkan Telegram: tautan t.me membuka bot, pengguna menekan Start, lalu status diperiksa ulang
 * otomatis selama 2 menit.
 */
function TelegramLink({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => apiFetch<TelegramStatus>('/me/telegram').then(setStatus), []);
  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, [load]);

  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      const s = await apiFetch<TelegramStatus>('/me/telegram').catch(() => null);
      if (s?.linked) {
        setStatus(s);
        setWaiting(false);
      } else if (Date.now() - started > 120_000) {
        setWaiting(false);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [waiting]);

  async function connect() {
    setBusy(true);
    setError(null);
    // Jendela dibuka dulu (masih dalam klik pengguna) agar tidak diblokir browser
    const win = window.open('', '_blank');
    try {
      const { url } = await apiFetch<{ url: string | null }>('/me/telegram/link', { method: 'POST' });
      if (!url) throw new Error('Bot Telegram belum siap. Coba lagi sebentar.');
      if (win) win.location.href = url;
      else window.location.href = url;
      setWaiting(true);
    } catch (e) {
      win?.close();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await apiFetch<TelegramStatus>('/me/telegram', { method: 'DELETE' }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-slate-600">
        Terima pemberitahuan di Telegram saat ada pengajuan yang menunggu persetujuan Anda, plus ringkasan setiap pagi
        jam 08.00.
      </p>
      {status === null && !error ? (
        <p className="flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…</p>
      ) : status && !status.available ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
          Bot Telegram HRIS belum dipasang di server. Hubungi Super Admin.
        </p>
      ) : status?.linked ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
          Terhubung{status.telegramUsername ? ` ke @${status.telegramUsername}` : ''}. Notifikasi dikirim ke Telegram Anda.
        </p>
      ) : status ? (
        <p className="text-slate-700">
          {waiting
            ? 'Di Telegram, tekan Start pada bot HRIS. Halaman ini akan berubah otomatis setelah terhubung.'
            : 'Belum terhubung. Tekan tombol di bawah, Telegram akan terbuka, lalu tekan Start.'}
        </p>
      ) : null}
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button type="button" disabled={busy} onClick={onClose} className="btn btn-ghost px-4">Tutup</button>
        {status?.available && (status.linked ? (
          <button type="button" disabled={busy} onClick={disconnect} className="btn btn-secondary px-4">Putuskan</button>
        ) : (
          <button type="button" disabled={busy} onClick={connect} className="btn btn-primary px-4">
            {busy || waiting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {waiting ? 'Menunggu Telegram…' : 'Hubungkan Telegram'}
          </button>
        ))}
      </div>
    </div>
  );
}
