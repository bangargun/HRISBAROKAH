// E2E tablet absensi. Jalankan terhadap backend scratch (lihat laporan task):
//   E2E_API=http://localhost:3100/api/v1 E2E_ADMIN_USER=admin E2E_ADMIN_PASS=... \
//   E2E_DATABASE_URL=postgresql://.../hris_barokah_e2e node scripts/e2e-kiosk.mjs
// Task berikutnya menambah check lewat checks.push(['nama', async (ctx) => {...}]).
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const API = process.env.E2E_API;
const DB = (process.env.E2E_DATABASE_URL || '').split('?')[0];
if (!API || !DB) {
  console.error('E2E_API dan E2E_DATABASE_URL wajib diisi');
  process.exit(2);
}

// ---------- helpers bersama ----------
export async function http(method, path, { token, body, headers } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...headers,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

export function sql(statement) {
  return execFileSync('psql', [DB, '-At', '-c', statement], { encoding: 'utf8' }).trim();
}

async function adminLogin() {
  const r = await http('POST', '/auth/login', {
    body: { username: process.env.E2E_ADMIN_USER, password: process.env.E2E_ADMIN_PASS },
  });
  assert.equal(r.status, 201, `login admin gagal (${r.status})`);
  return r.body.accessToken;
}

export async function createOutlet(admin, suffix = Date.now().toString(36).toUpperCase()) {
  const r = await http('POST', '/outlets', {
    token: admin,
    body: { code: `E2E-${suffix}`, name: `Outlet E2E ${suffix}`, address: 'Jl. Uji 1', latitude: -6.2, longitude: 106.8 },
  });
  assert.equal(r.status, 201, `buat outlet gagal: ${JSON.stringify(r.body)}`);
  return r.body;
}

export async function pairDevice(admin, outletId, deviceName = 'Tablet Uji') {
  const p = await http('POST', `/outlets/${outletId}/devices/pairing`, { token: admin, body: { deviceName } });
  assert.equal(p.status, 201, `buat kode gagal: ${JSON.stringify(p.body)}`);
  const r = await http('POST', '/kiosk/pair', { body: { code: p.body.code } });
  assert.equal(r.status, 201, `pair gagal: ${JSON.stringify(r.body)}`);
  return { ...r.body, code: p.body.code };
}

// ---------- daftar check ----------
export const checks = [];

checks.push(['pairing -> pair -> token berfungsi -> kode dipakai ulang ditolak -> revoke -> token 401', async (ctx) => {
  const p = await http('POST', `/outlets/${ctx.outlet.id}/devices/pairing`, { token: ctx.admin, body: { deviceName: 'Tablet Kasir' } });
  assert.equal(p.status, 201);
  assert.match(p.body.code, /^[A-HJ-NP-Z2-9]{8}$/);
  const ttl = new Date(p.body.expiresAt).getTime() - Date.now();
  assert.ok(ttl > 14 * 60_000 && ttl <= 15 * 60_000 + 5000, `ttl ${ttl}`);

  const pair = await http('POST', '/kiosk/pair', { body: { code: p.body.code } });
  assert.equal(pair.status, 201);
  assert.ok(pair.body.token.length >= 43, 'token minimal 32 byte');
  assert.equal(pair.body.device.name, 'Tablet Kasir');
  assert.equal(pair.body.outlet.id, ctx.outlet.id);

  const boot = await http('GET', '/kiosk/bootstrap', { token: pair.body.token });
  assert.equal(boot.status, 200);
  assert.equal(boot.body.outletId, ctx.outlet.id);

  const again = await http('POST', '/kiosk/pair', { body: { code: p.body.code } });
  assert.equal(again.status, 400);
  assert.equal(again.body.message, 'Kode tidak berlaku');

  const list = await http('GET', `/outlets/${ctx.outlet.id}/devices`, { token: ctx.admin });
  assert.equal(list.status, 200);
  const dev = list.body.find((d) => d.id === pair.body.device.id);
  assert.ok(dev && dev.revokedAt === null && dev.pairedAt, 'perangkat terdaftar');
  assert.equal(dev.tokenHash, undefined, 'hash token tidak boleh bocor');

  const rev = await http('POST', `/outlets/${ctx.outlet.id}/devices/${pair.body.device.id}/revoke`, { token: ctx.admin });
  assert.equal(rev.status, 201);
  assert.deepEqual(rev.body, { ok: true });

  const after = await http('GET', '/kiosk/bootstrap', { token: pair.body.token });
  assert.equal(after.status, 401);
}]);

checks.push(['token disimpan sebagai hash SHA-256 (bukan token asli)', async (ctx) => {
  const d = await pairDevice(ctx.admin, ctx.outlet.id, 'Tablet Hash');
  const stored = sql(`select "tokenHash" from "AttendanceDevice" where id='${d.device.id}'`);
  assert.notEqual(stored, d.token);
  assert.match(stored, /^[0-9a-f]{64}$/);
}]);

checks.push(['kode kedaluwarsa ditolak 400', async (ctx) => {
  const p = await http('POST', `/outlets/${ctx.outlet.id}/devices/pairing`, { token: ctx.admin, body: { deviceName: 'Tablet Basi' } });
  sql(`update "AttendanceDevicePairing" set "expiresAt" = (now() at time zone 'utc') - interval '1 minute' where code='${p.body.code}'`);
  const r = await http('POST', '/kiosk/pair', { body: { code: p.body.code } });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Kode tidak berlaku');
}]);

checks.push(['tanpa token / token ngawur -> 401; nama perangkat tervalidasi', async (ctx) => {
  assert.equal((await http('GET', '/kiosk/bootstrap')).status, 401);
  assert.equal((await http('GET', '/kiosk/bootstrap', { token: 'ngawur' })).status, 401);
  const bad = await http('POST', `/outlets/${ctx.outlet.id}/devices/pairing`, { token: ctx.admin, body: { deviceName: '' } });
  assert.equal(bad.status, 400);
  const long = await http('POST', `/outlets/${ctx.outlet.id}/devices/pairing`, { token: ctx.admin, body: { deviceName: 'x'.repeat(41) } });
  assert.equal(long.status, 400);
}]);

checks.push(['endpoint admin butuh login', async (ctx) => {
  assert.equal((await http('POST', `/outlets/${ctx.outlet.id}/devices/pairing`, { body: { deviceName: 'A' } })).status, 401);
  assert.equal((await http('GET', `/outlets/${ctx.outlet.id}/devices`)).status, 401);
}]);

checks.push(['attendanceMode bisa diubah lewat update outlet', async (ctx) => {
  const bad = await http('PUT', `/outlets/${ctx.outlet.id}`, { token: ctx.admin, body: { attendanceMode: 'FAX' } });
  assert.equal(bad.status, 400);
  const ok = await http('PUT', `/outlets/${ctx.outlet.id}`, { token: ctx.admin, body: { attendanceMode: 'TABLET' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.attendanceMode, 'TABLET');
}]);

// Memakai IP palsu via X-Forwarded-For supaya kuota IP check lain tidak ikut habis.
checks.push(['percobaan kode salah beruntun -> 429', async () => {
  const headers = { 'X-Forwarded-For': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.9` };
  let blocked = null;
  for (let i = 0; i < 15; i++) {
    const r = await http('POST', '/kiosk/pair', { body: { code: 'ZZZZZZZZ' }, headers });
    if (r.status === 429) { blocked = r; break; }
    assert.equal(r.status, 400);
  }
  assert.ok(blocked, 'harus kena 429');
  assert.match(blocked.body.message, /Terlalu banyak percobaan/);
}]);

// ---------- runner ----------
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const ctx = { admin: await adminLogin() };
  ctx.outlet = await createOutlet(ctx.admin);
  let failed = 0;
  for (const [name, fn] of checks) {
    try {
      await fn(ctx);
      console.log(`PASS ${name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${name} :: ${String(e.message).split("\n")[0]} ${e.actual !== undefined ? `(actual=${JSON.stringify(e.actual)} expected=${JSON.stringify(e.expected)})` : ""}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
