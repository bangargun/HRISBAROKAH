'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  User,
  ScanFace,
  QrCode,
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Smartphone,
  Monitor,
  RefreshCw,
  Users,
  Sparkles,
  Store,
  BadgeCheck
} from 'lucide-react';

interface ActiveShiftStaff {
  id: string;
  nik: string;
  name: string;
  role: string;
  station: string;
  avatar: string;
  username: string;
}

export default function LoginPage() {
  const router = useRouter();

  // Mode: 'admin' (Desktop Web Admin HQ) | 'kiosk' (Tablet Kiosk Kru)
  const [loginMode, setLoginMode] = useState<'admin' | 'kiosk'>('admin');

  // Admin form state (Username only - No password)
  const [adminUsername, setAdminUsername] = useState('admin');
  const [rememberMe, setRememberMe] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  // Kiosk form state (Username/Staff selector only - No password)
  const [activeShiftStaffList, setActiveShiftStaffList] = useState<ActiveShiftStaff[]>([]);
  const [kioskMethod, setKioskMethod] = useState<'username' | 'face' | 'qr'>('username');
  const [selectedStaff, setSelectedStaff] = useState<ActiveShiftStaff | null>(null);
  const [kruUsernameInput, setKruUsernameInput] = useState<string>('');
  const [kioskLoading, setKioskLoading] = useState(false);
  const [kioskError, setKioskError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Fetch real staff from API if registered in PostgreSQL
  useEffect(() => {
    fetch('http://localhost:3000/api/v1/employees')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: ActiveShiftStaff[] = data.map((emp) => {
            const isBoh = emp.department?.name?.includes('Kitchen') || emp.department?.name?.includes('Produksi');
            return {
              id: emp.id,
              nik: emp.id,
              name: emp.fullName,
              role: emp.position?.title || 'Kru Resto',
              station: emp.position?.title || 'Stasiun Kerja',
              avatar: isBoh ? '👨‍🍳' : '🤵',
              username: emp.id.toLowerCase(),
            };
          });
          setActiveShiftStaffList(mapped);
          setSelectedStaff(mapped[0]);
          setKruUsernameInput(mapped[0].nik);
        }
      })
      .catch(() => {});
  }, []);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Live clock
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Handle Admin Login Submit (Username only)
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);

    const cleanUsername = adminUsername.trim();
    if (!cleanUsername) {
      setAdminError('Silakan masukkan Username atau NIK Anda');
      return;
    }

    setAdminLoading(true);

    setTimeout(() => {
      setAdminLoading(false);
      triggerToast(`Login Berhasil! Selamat datang, ${cleanUsername} 👋`, 'success');
      setTimeout(() => {
        router.push('/');
      }, 700);
    }, 700);
  };

  // Handle Kiosk Kru Login Submit (Username only)
  const handleKruSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKioskError(null);

    const identifier = (kruUsernameInput || selectedStaff?.username || selectedStaff?.nik || '').trim();
    if (!identifier) {
      setKioskError('Silakan pilih profil kru atau masukkan Username / NIK Anda');
      return;
    }

    setKioskLoading(true);

    setTimeout(() => {
      setKioskLoading(false);
      const staffName = selectedStaff ? `${selectedStaff.name} (${selectedStaff.role})` : identifier;
      triggerToast(`Login Berhasil! Selamat bertugas, ${staffName} 👋`, 'success');
      setTimeout(() => {
        router.push('/?tab=kru-full');
      }, 700);
    }, 700);
  };

  // Handle Face AI Scan Simulation (Contactless)
  const handleFaceScan = () => {
    if (!selectedStaff && !kruUsernameInput) {
      setKioskError('Silakan pilih profil kru terlebih dahulu');
      return;
    }
    setIsScanning(true);
    setKioskError(null);
    setTimeout(() => {
      setIsScanning(false);
      triggerToast(`Wajah Terverifikasi AI (Skor 99.2%)! Halo, ${selectedStaff?.name || kruUsernameInput}`, 'success');
      setTimeout(() => {
        router.push('/?tab=kru-full');
      }, 800);
    }, 1800);
  };

  // Handle QR Badge Scan Simulation (Contactless)
  const handleQrScan = () => {
    if (!selectedStaff && !kruUsernameInput) {
      setKioskError('Silakan pilih profil kru terlebih dahulu');
      return;
    }
    setIsScanning(true);
    setKioskError(null);
    setTimeout(() => {
      setIsScanning(false);
      triggerToast(`Kartu ID ${selectedStaff?.nik || kruUsernameInput} Terbaca! Halo, ${selectedStaff?.name || kruUsernameInput}`, 'success');
      setTimeout(() => {
        router.push('/?tab=kru-full');
      }, 1500);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white relative overflow-x-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold border backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-600/50'
                : 'bg-rose-950/90 text-rose-200 border-rose-600/50'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOP BAR / MODE SWITCHER HEADER                            */}
      {/* ========================================================= */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-4 relative z-20">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/logo-barokah.jpg"
            alt="Barokah Group"
            className="h-10 w-auto rounded-xl object-contain bg-black px-2 py-1 border border-amber-500/40 shadow-lg shadow-black/50 ring-1 ring-amber-400/20"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">Barokah Group</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                HRIS v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Multi-Outlet F&amp;B Culinary Command &amp; Crew Superapp</p>
          </div>
        </div>

        {/* Center: Dual Mode Switcher */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setLoginMode('admin');
              setKioskError(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              loginMode === 'admin'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span>Web Admin HQ &amp; Manajer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('kiosk');
              setAdminError(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              loginMode === 'kiosk'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>Kiosk Tablet &amp; Staf Kru</span>
          </button>
        </div>

        {/* Right Info & Direct Link */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-mono font-bold text-amber-400">{currentTime || '18:00 WIB'}</span>
            <span className="text-[10px] text-slate-400">Server Waktu Terverifikasi</span>
          </div>
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
          >
            <span>Buka Dashboard Utama</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN CONTAINER CONTENT                                    */}
      {/* ========================================================= */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10">
        {loginMode === 'admin' ? (
          /* ======================================================= */
          /* MODE 1: DESKTOP WEB ADMIN (USERNAME ONLY)               */
          /* ======================================================= */
          <div className="w-full max-w-5xl bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 backdrop-blur-xl">
            {/* Left Hero Side (5 cols) */}
            <div className="lg:col-span-5 p-8 sm:p-10 bg-gradient-to-br from-slate-950 via-emerald-950/70 to-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 mb-6">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Sistem Informasi SDM Terintegrasi</span>
                </div>

                <div className="mb-6">
                  <img
                    src="/logo-barokah.jpg"
                    alt="Barokah Group"
                    className="h-14 sm:h-16 w-auto rounded-xl object-contain bg-black/90 p-2 border border-amber-500/50 shadow-2xl shadow-amber-950/40 ring-1 ring-amber-400/30"
                  />
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight mb-3">
                  Pusat Kendali HRIS <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
                    Barokah Group
                  </span>
                </h1>
                <p className="text-xs text-slate-300 leading-relaxed mb-8">
                  Akses langsung portal manajemen SDM, pengupahan (payroll), checklist SOP resto, dan monitoring multi-outlet secara instan cukup dengan Username.
                </p>

                {/* 3 Metric Cards as in Mockup */}
                <div className="grid grid-cols-3 gap-2.5 mb-8">
                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                    <Building2 className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                    <div className="text-base font-black text-white">32</div>
                    <div className="text-[9px] text-slate-400 uppercase font-semibold leading-tight">Cabang Aktif</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                    <ScanFace className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                    <div className="text-base font-black text-emerald-400">99.4%</div>
                    <div className="text-[9px] text-slate-400 uppercase font-semibold leading-tight">Presensi AI</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                    <ShieldCheck className="h-4 w-4 text-teal-400 mx-auto mb-1" />
                    <div className="text-base font-black text-white">ISO</div>
                    <div className="text-[9px] text-slate-400 uppercase font-semibold leading-tight">27001 Data</div>
                  </div>
                </div>
              </div>

              {/* Bottom Assurance */}
              <div className="pt-6 border-t border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 font-bold text-xs">
                    ⚡
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Otentikasi cepat berbasis nama pengguna resmi perusahaan tanpa hambatan lupa sandi.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Form Side (7 cols) */}
            <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-slate-900/50">
              <div className="max-w-md w-full mx-auto">
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-white tracking-tight mb-1.5 flex items-center gap-2">
                    <span>Selamat Datang Kembali</span>
                    <span className="text-xl">👋</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Masuk ke Sistem Manajemen SDM F&amp;B dengan mengetikkan <b>Username</b> atau <b>NIK HRD</b> Anda.
                  </p>
                </div>

                {/* Error Banner */}
                {adminError && (
                  <div className="mb-6 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-start gap-3 text-xs text-rose-300 animate-in fade-in">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{adminError}</span>
                  </div>
                )}

                <form onSubmit={handleAdminSubmit} className="space-y-5">
                  {/* Field: Username / NIK */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Username / NIK Akun
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="h-4 w-4 text-emerald-400" />
                      </div>
                      <input
                        type="text"
                        autoFocus
                        value={adminUsername}
                        onChange={(e) => {
                          setAdminUsername(e.target.value);
                          setAdminError(null);
                        }}
                        placeholder="Masukkan username (contoh: admin, hrd_pusat, atau NIK)"
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-950/80 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-sm text-white placeholder-slate-500 transition outline-none font-medium"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      *Cukup gunakan Username atau NIK resmi Anda untuk langsung masuk.
                    </p>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500/30"
                      />
                      <span>Ingat username di perangkat ini</span>
                    </label>
                    <span className="text-[11px] text-slate-500">Akses Langsung</span>
                  </div>

                  {/* Primary Submit Button */}
                  <button
                    type="submit"
                    disabled={adminLoading}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {adminLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Memverifikasi Akun...</span>
                      </>
                    ) : (
                      <>
                        <span>Masuk ke Dashboard Pusat</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {/* Divider */}
                  <div className="relative flex items-center justify-center my-4">
                    <div className="border-t border-slate-800 w-full" />
                    <span className="bg-slate-900 px-3 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                      atau masuk dengan
                    </span>
                  </div>

                  {/* Google SSO Button */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerToast('Mengalihkan ke Google SSO Workspace Barokah Grup...', 'success');
                      setTimeout(() => router.push('/'), 1000);
                    }}
                    className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2.5 cursor-pointer shadow-xs"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Masuk dengan Google SSO Akun Resto</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================= */
          /* MODE 2: KIOSK TABLET & KRU FAST LOGIN (USERNAME ONLY)   */
          /* ======================================================= */
          <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
            {/* Kiosk Header */}
            <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-extrabold text-sm text-white">Crew Fast Login Kiosk</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                    Outlet Senopati
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {currentTime || '14:30 WIB'} • Shift Siang Aktif (12 Staf Bertugas)
                </p>
              </div>

              {/* Method Switcher Pills */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setKioskMethod('username');
                    setKioskError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    kioskMethod === 'username'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Pilih Kru / Username</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKioskMethod('face');
                    setKioskError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    kioskMethod === 'face'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ScanFace className="h-3.5 w-3.5" />
                  <span>Scan Wajah AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKioskMethod('qr');
                    setKioskError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    kioskMethod === 'qr'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Scan Kartu QR</span>
                </button>
              </div>
            </div>

            {/* Kiosk Body */}
            <div className="p-6 sm:p-8">
              {/* Active Staff Selector Shortcut Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-amber-400" />
                    <span>Sentuh Profil Kru untuk Memilih:</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Tanpa Password</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {activeShiftStaffList.length === 0 ? (
                    <div className="col-span-full p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-slate-400 text-xs">
                      Belum ada kru yang terdaftar di sistem. Gunakan NIK manual di bawah atau daftarkan kru via Web Admin HQ.
                    </div>
                  ) : (
                    activeShiftStaffList.map((stf) => {
                      const isSelected = selectedStaff?.id === stf.id;
                      return (
                        <button
                          key={stf.id}
                          type="button"
                          onClick={() => {
                            setSelectedStaff(stf);
                            setKruUsernameInput(stf.nik);
                            setKioskError(null);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-emerald-950/50 border-emerald-500 shadow-md shadow-emerald-950 ring-2 ring-emerald-500/40'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-2.5 right-2.5">
                              <BadgeCheck className="h-4 w-4 text-emerald-400" />
                            </div>
                          )}
                          <div className="text-3xl mb-1.5">{stf.avatar}</div>
                          <div className="font-black text-xs text-white truncate">{stf.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{stf.role}</div>
                          <div className="text-[9px] font-mono text-amber-400 mt-1 font-bold">{stf.nik}</div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Error Banner */}
              {kioskError && (
                <div className="mb-6 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center gap-3 text-xs text-rose-300 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{kioskError}</span>
                </div>
              )}

              {/* METHOD 1: USERNAME / DIRECT CREW SELECT */}
              {kioskMethod === 'username' && (
                <form onSubmit={handleKruSubmit} className="max-w-md mx-auto space-y-4">
                  {/* Selected Crew Highlight Card */}
                  {selectedStaff && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-950 border border-emerald-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{selectedStaff.avatar}</span>
                        <div>
                          <div className="font-black text-sm text-white flex items-center gap-2">
                            <span>{selectedStaff.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                              {selectedStaff.nik}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {selectedStaff.role} • {selectedStaff.station}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-600/40">
                        Siap Masuk
                      </span>
                    </div>
                  )}

                  {/* Manual Username / NIK Input Field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Username atau NIK Kru Lain
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="h-4 w-4 text-emerald-400" />
                      </div>
                      <input
                        type="text"
                        value={kruUsernameInput}
                        onChange={(e) => {
                          setKruUsernameInput(e.target.value);
                          setKioskError(null);
                        }}
                        placeholder="Contoh: NIK Karyawan atau Username"
                        className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 transition outline-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={kioskLoading}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {kioskLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Membuka Portal Kru...</span>
                      </>
                    ) : (
                      <>
                        <span>Masuk ke Portal Kru Resto</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-slate-500">
                    Akses kru instan tanpa password untuk kelancaran operasional kitchen &amp; kasir.
                  </p>
                </form>
              )}

              {/* METHOD 2: SCAN WAJAH AI (VIEWFINDER SIMULATION) */}
              {kioskMethod === 'face' && (
                <div className="max-w-sm mx-auto text-center">
                  <div className="text-xs text-slate-400 mb-4">
                    Verifikasi Biometrik Wajah Kru:{' '}
                    <b className="text-white">{selectedStaff ? selectedStaff.name : (kruUsernameInput || 'Kru')}</b>
                  </div>

                  {/* Camera Reticle Viewfinder */}
                  <div className="w-56 h-72 mx-auto rounded-3xl bg-slate-950 border-2 border-dashed border-emerald-500/60 relative overflow-hidden flex flex-col items-center justify-center p-4 mb-4 shadow-xl">
                    {/* Laser Scanner Line */}
                    {isScanning && (
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400 animate-bounce" />
                    )}

                    <div className="w-36 h-48 rounded-full border-2 border-emerald-400/40 flex items-center justify-center relative">
                      <ScanFace
                        className={`h-20 w-20 text-emerald-400/60 transition ${
                          isScanning ? 'scale-110 text-emerald-400 animate-pulse' : ''
                        }`}
                      />
                      {isScanning && (
                        <div className="absolute top-2 px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[9px] font-mono font-bold animate-pulse">
                          MENGENALI KONTUR...
                        </div>
                      )}
                    </div>

                    <div className="mt-3 text-[10px] text-slate-400">
                      {isScanning ? 'Menganalisis anti-spoofing...' : 'Posisikan wajah di dalam oval'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleFaceScan}
                    disabled={isScanning}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Memindai Wajah...</span>
                      </>
                    ) : (
                      <>
                        <ScanFace className="h-4 w-4" />
                        <span>Mulai Verifikasi Biometrik Wajah</span>
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-slate-500 mt-3">
                    Liveness detection aktif: Pastikan pencahayaan terang dan lepas kacamata hitam.
                  </p>
                </div>
              )}

              {/* METHOD 3: SCAN QR ID CARD */}
              {kioskMethod === 'qr' && (
                <div className="max-w-sm mx-auto text-center">
                  <div className="text-xs text-slate-400 mb-4">
                    Pindai Kartu ID Lanyard Kru:{' '}
                    <b className="text-white">{selectedStaff ? selectedStaff.name : (kruUsernameInput || 'Kru')}</b>
                  </div>

                  {/* QR Viewfinder Frame */}
                  <div className="w-56 h-56 mx-auto rounded-3xl bg-slate-950 border-2 border-emerald-500/60 relative overflow-hidden flex flex-col items-center justify-center p-4 mb-4 shadow-xl">
                    {/* Laser Scanner Bar */}
                    {isScanning && (
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-lg shadow-amber-400 animate-bounce" />
                    )}

                    <QrCode
                      className={`h-24 w-24 text-slate-600 transition ${
                        isScanning ? 'scale-105 text-amber-400 animate-pulse' : ''
                      }`}
                    />

                    <div className="mt-2 text-[10px] text-slate-400">
                      {isScanning ? 'Membaca barcode...' : 'Arahkan QR ID Card ke kamera'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleQrScan}
                    disabled={isScanning}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Membaca Barcode Kartu...</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4" />
                        <span>Pindai Kartu ID Kru</span>
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-slate-500 mt-3">
                    Scan otomatis membaca ID Card fisik kru terintegrasi presensi shift.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* FOOTER                                                    */}
      {/* ========================================================= */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-4 py-3 text-center text-xs text-slate-500 relative z-20">
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
          <span>© 2026 PT Barokah Kuliner Grup. Hak Cipta Dilindungi.</span>
          <span>•</span>
          <span>Sistem HRIS &amp; Operasional Multi-Outlet Resto</span>
          <span>•</span>
          <span className="text-slate-400">Bantuan IT &amp; HRD: +62 812-9900-8800</span>
        </div>
      </footer>
    </div>
  );
}
