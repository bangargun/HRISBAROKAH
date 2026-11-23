// Perilaku perangkat tablet absen: service worker (offline), layar penuh, layar tetap menyala.
import { useEffect } from 'react';

const SW_URL = '/absen-sw.js';
const SW_SCOPE = '/absen';

/**
 * Pasang service worker (hanya build produksi: di `next dev` aset berubah terus dan cache
 * dulu akan menyajikan kode lama). Minta penyimpanan persisten agar cache dan antrean tidak
 * dibersihkan browser saat ruang menipis.
 */
export function registerServiceWorker(): void {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register(SW_URL, { scope: SW_SCOPE })
    .then(() => reportLoadedAssets())
    .catch(() => undefined);
  navigator.storage?.persist?.().catch(() => undefined);
}

/** Kirim daftar aset yang sudah dimuat halaman ke service worker agar ikut tersimpan untuk offline. */
export function reportLoadedAssets(): void {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      const urls = performance.getEntriesByType('resource').map((e) => e.name);
      reg.active?.postMessage({ type: 'cache-urls', urls });
    })
    .catch(() => undefined);
}

/** Layar penuh pada sentuhan pertama dan kunci layar menyala selama halaman terlihat. */
export function useKioskScreen(): void {
  useEffect(() => {
    // Browser hanya mengizinkan layar penuh dari gestur pengguna
    const goFullscreen = () => {
      if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    };
    document.addEventListener('pointerdown', goFullscreen, { once: true });

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
