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

// IP palsu unik (lewat X-Forwarded-For dari localhost, trust proxy 'loopback') supaya
// check yang menghasilkan kegagalan tidak menghabiskan jatah IP check lain / run lain.
export const freshIp = () => ({
  'X-Forwarded-For': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`,
});

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

  const again = await http('POST', '/kiosk/pair', { body: { code: p.body.code }, headers: freshIp() });
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
  const r = await http('POST', '/kiosk/pair', { body: { code: p.body.code }, headers: freshIp() });
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
  assert.equal(sql(`select "attendanceMode" from "Outlet" where id='${ctx.outlet.id}'`), 'TABLET', 'tersimpan di DB');
  const back = await http('GET', `/outlets/${ctx.outlet.id}`, { token: ctx.admin });
  assert.equal(back.body.attendanceMode, 'TABLET');
}]);

checks.push(['dua POST /kiosk/pair serentak dengan kode sama -> tepat satu berhasil', async (ctx) => {
  const p = await http('POST', `/outlets/${ctx.outlet.id}/devices/pairing`, { token: ctx.admin, body: { deviceName: 'Tablet Balap' } });
  const rs = await Promise.all([1, 2, 3].map(() => http('POST', '/kiosk/pair', { body: { code: p.body.code }, headers: freshIp() })));
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 400, 400]);
  assert.equal(sql(`select count(*) from "AttendanceDevice" where name='Tablet Balap' and "outletId"='${ctx.outlet.id}'`), '1');
}]);

checks.push(['tebakan paralel dari satu IP: jatah 10, sisanya 429 (tidak bocor)', async () => {
  const headers = freshIp();
  const rs = await Promise.all(Array.from({ length: 30 }, () => http('POST', '/kiosk/pair', { body: { code: 'ZZZZZZZZ' }, headers })));
  const n400 = rs.filter((r) => r.status === 400).length;
  const n429 = rs.filter((r) => r.status === 429).length;
  assert.equal(n400, 10, `400=${n400}`);
  assert.equal(n429, 20, `429=${n429}`);
}]);

checks.push(['Store Manager: lihat perangkat outlet sendiri, 403 outlet lain / pairing / revoke', async (ctx) => {
  const other = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}X`);
  const dev = await pairDevice(ctx.admin, ctx.outlet.id, 'Tablet SM');
  const otherDev = await pairDevice(ctx.admin, other.id, 'Tablet Lain');
  const positionId = sql(`select id from "Position" limit 1`);
  const tag = Date.now().toString(36);
  const uname = `sm.${tag}`;
  const emp = await http('POST', '/employees', {
    token: ctx.admin,
    body: { username: uname, password: 'sm-pass-123', role: 'STORE_MANAGER', nik: `SM${tag}`, fullName: 'SM Uji', phone: '0800', outletId: ctx.outlet.id, positionId, joinDate: '2026-01-01' },
  });
  assert.ok(emp.status === 201, `buat SM gagal: ${JSON.stringify(emp.body)}`);
  const login = await http('POST', '/auth/login', { body: { username: uname, password: 'sm-pass-123' } });
  const sm = login.body.accessToken;

  const own = await http('GET', `/outlets/${ctx.outlet.id}/devices`, { token: sm });
  assert.equal(own.status, 200);
  assert.ok(own.body.some((d) => d.id === dev.device.id));
  assert.equal((await http('GET', `/outlets/${other.id}/devices`, { token: sm })).status, 403);
  assert.equal((await http('POST', `/outlets/${ctx.outlet.id}/devices/pairing`, { token: sm, body: { deviceName: 'X' } })).status, 403);
  assert.equal((await http('POST', `/outlets/${ctx.outlet.id}/devices/${dev.device.id}/revoke`, { token: sm })).status, 403);
  assert.equal((await http('POST', `/outlets/${other.id}/devices/${otherDev.device.id}/revoke`, { token: sm })).status, 403);
  // perangkat tidak ikut tercabut
  assert.equal((await http('GET', '/kiosk/bootstrap', { token: dev.token })).status, 200);
}]);

checks.push(['percobaan kode salah beruntun -> 429', async () => {
  const headers = freshIp();
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
