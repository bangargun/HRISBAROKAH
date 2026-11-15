'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { clearSession, getSessionUser, type SessionUser } from '@/lib/auth';
import { NAV_GROUPS, ROLE_LABEL, type NavItem } from '@/lib/navigation';

interface Props {
  /** Id menu yang sedang aktif (lihat NAV_GROUPS). */
  activeId: string;
  /**
   * Dipanggil saat menu halaman utama dipilih. Tanpa fungsi ini (halaman lain),
   * menu tersebut membuka halaman utama di menu yang dipilih.
   */
  onSelect?: (id: string) => void;
  title: string;
  /** Angka kecil di samping menu, misalnya jumlah pengajuan yang menunggu. */
  counts?: Partial<Record<string, number>>;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

function initials(name: string) {
  // Ambil huruf pertama dari dua kata pertama yang diawali huruf, abaikan tanda baca
  return name
    .split(/\s+/)
    .map((w) => w.match(/[A-Za-zÀ-ÿ]/)?.[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AppShell({ activeId, onSelect, title, counts, headerActions, children }: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Sesi dibaca setelah mount agar render server dan klien sama
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => setUser(getSessionUser()), []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  const displayName = user?.fullName || user?.username || '';

  const itemClass = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
      active ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  function renderItem(item: NavItem) {
    const active = item.id === activeId;
    const Icon = item.icon;
    const count = counts?.[item.id];
    const content = (
      <>
        <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-amber-400' : 'text-slate-400'}`} aria-hidden />
        <span className="flex-1 text-left">{item.label}</span>
        {count ? (
          <span className="rounded bg-amber-500 px-1.5 text-xs font-semibold leading-5 text-slate-950" aria-label={`${count} menunggu`}>
            {count}
          </span>
        ) : null}
      </>
    );

    if (item.href || !onSelect) {
      return (
        <Link
          key={item.id}
          href={item.href ?? `/?menu=${item.id}`}
          onClick={() => setDrawerOpen(false)}
          aria-current={active ? 'page' : undefined}
          className={itemClass(active)}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          onSelect(item.id);
          setDrawerOpen(false);
        }}
        aria-current={active ? 'page' : undefined}
        className={itemClass(active)}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-navy text-slate-300 transition-transform lg:static lg:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigasi utama"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <Link href="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2.5 rounded-md">
            <img src="/logo-barokah.jpg" alt="" className="h-8 w-8 rounded-md bg-black object-contain" />
            <span className="text-sm font-semibold text-white">Barokah Grup</span>
            <span className="text-xs text-slate-400">HRIS</span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-xs font-medium text-slate-400">{group.label}</p>
              <div className="space-y-0.5">{group.items.map(renderItem)}</div>
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-semibold text-white">
            {initials(displayName) || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{displayName || 'Memuat…'}</p>
            <p className="truncate text-xs text-slate-400">{user ? ROLE_LABEL[user.role] ?? user.role : ''}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Keluar"
            title="Keluar"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">{title}</h1>
          {headerActions && <div className="flex shrink-0 items-center gap-2">{headerActions}</div>}
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
