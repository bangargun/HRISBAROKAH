// Perilaku perangkat tablet absen: service worker (offline), layar penuh, layar tetap menyala.
import { useEffect } from 'react';

const SW_URL = '/absen-sw.js';
const SW_SCOPE = '/absen';
const isProd = () => process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator;

/**
 * Pasang service worker (hanya build produksi: di `next dev` aset berubah terus dan cache
 * dulu akan menyajikan kode lama). Minta penyimpanan persisten agar cache dan antrean tidak
 * dibersihkan browser saat ruang menipis.
 */
export function registerServiceWorker(): void {
  if (!isProd()) return;
  navigator.serviceWorker
    .register(SW_URL, { scope: SW_SCOPE })
    .then(() => reportLoadedAssets())
    .catch(() => undefined);
  navigator.storage?.persist?.().catch(() => undefined);
}

/** Kirim daftar aset yang sudah dimuat halaman ke service worker agar ikut tersimpan untuk offline. */
export function reportLoadedAssets(): void {
  if (!isProd()) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      const urls = performance.getEntriesByType('resource').map((e) => e.name);
      reg.active?.postMessage({ type: 'cache-urls', urls });
    })
    .catch(() => undefined);
}

/**
 * Setelah sinkron berhasil: periksa skrip service worker baru dan build halaman baru.
 * Bila ada build baru, SW menyimpannya lalu mengirim "shell-updated" (lihat listenForShellUpdate).
 */
export function checkForUpdate(): void {
  if (!isProd()) return;
  navigator.serviceWorker
    .getRegistration(SW_SCOPE)
    .then(async (reg) => {
      if (!reg) return;
      await reg.update().catch(() => undefined);
      (reg.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'check-update' });
    })
    .catch(() => undefined);
}

// Papan boleh dimuat ulang hanya saat tidak ada kru yang sedang absen (kamera / sapaan).
// Task 9 memasang pemeriksaannya lewat setIdleCheck; sampai itu papan selalu diam.
let idleCheck: () => boolean = () => true;
export function setIdleCheck(fn: () => boolean): () => void {
  idleCheck = fn;
  return () => {
    if (idleCheck === fn) idleCheck = () => true;
  };
}

const RELOAD_RETRY_MS = 5_000;

/** Muat ulang ke build baru setelah SW selesai menyimpannya, menunggu papan diam. */
export function listenForShellUpdate(): () => void {
  if (!isProd()) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tryReload = () => {
    if (idleCheck()) window.location.reload();
    else timer = setTimeout(tryReload, RELOAD_RETRY_MS);
  };
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'shell-updated' && timer === undefined) tryReload();
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => {
    clearTimeout(timer);
    navigator.serviceWorker.removeEventListener('message', onMessage);
  };
}

/** Layar penuh pada sentuhan pertama dan kunci layar menyala selama halaman terlihat. */
export function useKioskScreen(): void {
  useEffect(() => {
    // Browser hanya mengizinkan layar penuh dari gestur pengguna; diminta lagi pada setiap
    // sentuhan selama belum layar penuh (mis. setelah keluar lewat gestur sistem)
    const goFullscreen = () => {
      const el = document.documentElement;
      if (document.fullscreenElement || typeof el.requestFullscreen !== 'function') return;
      try {
        const p = el.requestFullscreen({ navigationUI: 'hide' }) as Promise<void> | undefined;
        p?.catch?.(() => undefined);
      } catch {
        // browser lama: requestFullscreen tanpa promise dan bisa melempar
      }
    };
    document.addEventListener('pointerdown', goFullscreen);

    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      if (lock && !lock.released) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (disposed) await lock.release();
      } catch {
        lock = null; // baterai lemah / tidak didukung: layar mengikuti setelan tablet
      }
    };
    // Kunci dilepas otomatis saat halaman tersembunyi; minta lagi saat terlihat
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('pointerdown', goFullscreen);
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release().catch(() => undefined);
    };
  }, []);
}
