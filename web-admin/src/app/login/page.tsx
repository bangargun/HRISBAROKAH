'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { getToken, login, verifySession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sudah login dengan sesi yang masih berlaku: langsung ke dashboard
  useEffect(() => {
    if (!getToken()) return;
    verifySession()
      .then((user) => {
        if (user) router.replace('/');
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Isi username dan password');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink text-slate-100">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <img src="/logo-barokah.jpg" alt="Barokah Group" width={140} height={56} className="h-14 w-auto rounded-md" />
            <h1 className="mt-4 text-xl font-semibold text-white">Masuk ke HRIS Barokah Group</h1>
            <p className="mt-1 text-sm text-slate-400">Untuk HR, keuangan, dan manajer outlet</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 text-slate-900" noValidate>
            <div>
              <label htmlFor="username" className="field-label mb-1.5">
                Username, email, atau NIK
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input py-2.5"
              />
            </div>

            <div>
              <label htmlFor="password" className="field-label mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input py-2.5 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-500 hover:text-slate-900"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="alert-error flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 font-semibold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogIn className="h-4 w-4" aria-hidden />}
              {loading ? 'Memeriksa...' : 'Masuk'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Kru outlet absen dan mengajukan izin lewat aplikasi HP.
            <br />
            Lupa password? Hubungi HR pusat.
          </p>
        </div>
      </main>

      <footer className="border-t border-white/10 px-4 py-3 text-center text-xs text-slate-400">
        © 2026 PT Barokah Kuliner Grup
      </footer>
    </div>
  );
}
