/* Service worker tablet absen (scope /absen).
 * - Halaman /absen, aset /_next/static, model wajah /models/human, manifest, ikon: dari cache dulu,
 *   agar tablet tetap terbuka tanpa internet.
 * - Halaman /absen diperbarui di latar: HTML baru baru dipakai setelah semua aset yang
 *   dirujuknya ikut tersimpan, jadi versi baru tidak pernah setengah tersimpan.
 * - API (/api/ dan origin lain): selalu ke jaringan, tidak pernah dari cache.
 * Naikkan VERSION untuk membuang seluruh cache lama.
 */
const VERSION = 'v1';
const CACHE = `absen-${VERSION}`;
const SHELL_PAGE = '/absen';
const SHELL_FILES = ['/absen.webmanifest', '/icons/absen-192.png', '/icons/absen-512.png', '/logo-barokah.jpg'];
const MODEL_FILES = ['blazeface', 'facemesh', 'faceres', 'antispoof', 'liveness'].flatMap((m) => [
  `/models/human/${m}.json`,
  `/models/human/${m}.bin`,
]);

const isStatic = (path) =>
  path.startsWith('/_next/static/') ||
  path.startsWith('/models/human/') ||
  path.startsWith('/icons/') ||
  SHELL_FILES.includes(path);

const isShellNavigation = (path) => path === SHELL_PAGE || path.startsWith(`${SHELL_PAGE}/`);

// Aset Next yang dirujuk HTML: tag <script>/<link> dan potongan "static/chunks/..." di data RSC
function assetsIn(html) {
  const found = new Set();
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\)]+/g)) found.add(m[0]);
  for (const m of html.matchAll(/(?<![\w/])static\/(?:chunks|css|media)\/[^"'\s\\)]+/g)) found.add(`/_next/${m[0]}`);
  return [...found];
}

// Respons hasil redirect tidak boleh dipakai untuk navigasi
async function storable(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function cacheMissing(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      if (await cache.match(url)) return;
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      await cache.put(url, res);
    }),
  );
}

/** Ambil /absen terbaru beserta asetnya; simpan HTML hanya bila semua aset tersimpan. */
async function refreshShell() {
  const cache = await caches.open(CACHE);
  const res = await fetch(SHELL_PAGE, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${SHELL_PAGE}: ${res.status}`);
  const html = await res.clone().text();
  await cacheMissing(cache, assetsIn(html));
  await cache.put(SHELL_PAGE, await storable(res));
  return res;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cacheMissing(cache, SHELL_FILES);
      await refreshShell();
      // Model wajah besar (~10 MB): gagal di sini tidak menggagalkan pemasangan,
      // file yang belum ada diambil saat dipakai atau saat halaman meminta "warm"
      await Promise.allSettled(MODEL_FILES.map((url) => cacheMissing(cache, [url])));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('absen-') && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') await cache.put(request, res.clone());
  return res;
}

async function shellNavigation(event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(SHELL_PAGE, { ignoreVary: true });
  if (hit) {
    // Versi baru dipakai pada pembukaan berikutnya
    event.waitUntil(refreshShell().catch(() => undefined));
    return hit;
  }
  try {
    return await refreshShell();
  } catch {
    return fetch(event.request).catch(
      () =>
        new Response('<!doctype html><meta charset="utf-8"><title>Absen</title><p>Tablet belum pernah membuka halaman absen saat online.</p>', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // API dan origin lain: jaringan saja
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate' && isShellNavigation(url.pathname)) {
    event.respondWith(shellNavigation(event));
    return;
  }
  if (isStatic(url.pathname)) event.respondWith(cacheFirst(request));
});

// Halaman mengirim daftar aset yang sudah dimuatnya (termasuk potongan yang dimuat belakangan)
// dan meminta model wajah dilengkapi.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'cache-urls' && Array.isArray(data.urls)) {
    const paths = data.urls
      .map((u) => {
        try {
          const url = new URL(u, self.location.origin);
          return url.origin === self.location.origin && isStatic(url.pathname) ? url.pathname + url.search : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    event.waitUntil(
      caches.open(CACHE).then((cache) => Promise.allSettled([...new Set([...paths, ...MODEL_FILES])].map((p) => cacheMissing(cache, [p])))),
    );
  }
});
