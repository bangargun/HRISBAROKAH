/* Service worker tablet absen (scope /absen).
 * - Halaman /absen dan aset /_next/static disimpan per build Next ("absen-build-<buildId>"),
 *   model wajah di cache tetap ("absen-models-<versi human>"). Semua dari cache dulu, agar
 *   tablet tetap terbuka tanpa internet.
 * - Deploy baru: halaman meminta "check-update" setelah sinkron berhasil (dan tiap navigasi).
 *   SW mengambil /absen terbaru; bila buildId berbeda, semua aset build itu disimpan dulu,
 *   baru penunjuk build dipindah dan halaman diberi tahu "shell-updated" (halaman memuat ulang
 *   saat papan diam). Build lama baru dihapus saat halaman build baru dibuka, jadi halaman yang
 *   sedang berjalan tidak pernah kehilangan potongan kodenya.
 * - API (/api/ dan origin lain): selalu ke jaringan, tidak pernah dari cache.
 * Tidak perlu menaikkan versi apa pun saat deploy.
 */
const SHELL_PAGE = '/absen';
const BUILD_PREFIX = 'absen-build-';
const MODELS_CACHE = 'absen-models-3.3.6'; // versi @vladmandic/human; ganti bila model diganti
const META_CACHE = 'absen-meta';
const CURRENT_KEY = '/__absen/current-build';
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
  return [...found].sort();
}

// buildId Next ada di data RSC; cadangan: sidik daftar aset (berubah bila aset berubah)
function buildIdOf(html, assets) {
  const m = /buildId\\?":\\?"([\w-]+)/.exec(html);
  if (m) return m[1];
  let h = 0;
  for (const c of assets.join('|')) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return `assets-${(h >>> 0).toString(36)}`;
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

async function currentBuild() {
  const res = await (await caches.open(META_CACHE)).match(CURRENT_KEY);
  return res ? res.text() : null;
}

async function setCurrentBuild(id) {
  await (await caches.open(META_CACHE)).put(CURRENT_KEY, new Response(id));
}

async function notifyClients(message) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of list) c.postMessage(message);
}

/**
 * Ambil /absen dari server. Build baru: simpan HTML + semua asetnya ke cache build baru,
 * lalu pindahkan penunjuk dan kabari halaman. Gagal di tengah jalan: penunjuk tetap di build lama.
 */
let checking = null;
function checkUpdate() {
  if (!checking) {
    checking = (async () => {
      const res = await fetch(SHELL_PAGE, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${SHELL_PAGE}: ${res.status}`);
      const html = await res.clone().text();
      const assets = assetsIn(html);
      const id = buildIdOf(html, assets);
      const prev = await currentBuild();
      if (prev === id && (await (await caches.open(BUILD_PREFIX + id)).match(SHELL_PAGE))) return { updated: false, id };
      const cache = await caches.open(BUILD_PREFIX + id);
      await cacheMissing(cache, [...assets, ...SHELL_FILES]);
      await cache.put(SHELL_PAGE, await storable(res));
      await setCurrentBuild(id);
      // Pemasangan pertama bukan "pembaruan": halaman yang terbuka sudah build ini
      if (prev && prev !== id) await notifyClients({ type: 'shell-updated', buildId: id });
      return { updated: prev !== id, id };
    })().finally(() => {
      checking = null;
    });
  }
  return checking;
}

async function warmModels() {
  const cache = await caches.open(MODELS_CACHE);
  // Model besar (~10 MB): satu file gagal tidak menggagalkan yang lain
  await Promise.allSettled(MODEL_FILES.map((url) => cacheMissing(cache, [url])));
}

/** Hapus cache build lain dan cache skema lama. Hanya saat halaman build terkini dibuka. */
async function pruneOtherBuilds(keepId) {
  const keep = new Set([BUILD_PREFIX + keepId, MODELS_CACHE, META_CACHE]);
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n.startsWith('absen-') && !keep.has(n)).map((n) => caches.delete(n)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await checkUpdate();
      await warmModels();
      await self.skipWaiting();
    })(),
  );
});

// Tidak menghapus cache di sini: halaman lama bisa masih berjalan dengan build lama
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function cacheFirst(request) {
  // Cari di semua cache: halaman build lama tetap menemukan potongan kodenya
  const hit = await caches.match(request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    const path = new URL(request.url).pathname;
    const id = await currentBuild();
    const name = path.startsWith('/models/human/') ? MODELS_CACHE : id ? BUILD_PREFIX + id : null;
    if (name) await (await caches.open(name)).put(request, res.clone());
  }
  return res;
}

async function shellNavigation(event) {
  const id = await currentBuild();
  const hit = id ? await (await caches.open(BUILD_PREFIX + id)).match(SHELL_PAGE, { ignoreVary: true }) : null;
  if (hit) {
    event.waitUntil(
      (async () => {
        await pruneOtherBuilds(id);
        await checkUpdate().catch(() => undefined); // deploy baru dipakai lewat "shell-updated"
      })(),
    );
    return hit;
  }
  try {
    await checkUpdate();
    const now = await currentBuild();
    const fresh = now && (await (await caches.open(BUILD_PREFIX + now)).match(SHELL_PAGE));
    if (fresh) return fresh;
  } catch {
    // jatuh ke jaringan di bawah
  }
  return fetch(event.request).catch(
    () =>
      new Response('<!doctype html><meta charset="utf-8"><title>Absen</title><p>Tablet belum pernah membuka halaman absen saat online.</p>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
  );
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

self.addEventListener('message', (event) => {
  const data = event.data || {};
  // Halaman mengirim aset yang sudah dimuatnya (termasuk potongan yang dimuat belakangan)
  if (data.type === 'cache-urls' && Array.isArray(data.urls)) {
    const paths = data.urls
      .map((u) => {
        try {
          const url = new URL(u, self.location.origin);
          return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/') ? url.pathname : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    event.waitUntil(
      (async () => {
        const id = await currentBuild();
        if (id) {
          const cache = await caches.open(BUILD_PREFIX + id);
          await Promise.allSettled(paths.map((p) => cacheMissing(cache, [p])));
        }
        await warmModels();
      })(),
    );
  }
  // Setelah sinkron berhasil: cek deploy baru
  if (data.type === 'check-update') {
    event.waitUntil(checkUpdate().catch(() => undefined));
  }
});
