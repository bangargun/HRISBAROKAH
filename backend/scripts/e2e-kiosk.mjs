// E2E tablet absensi. Jalankan terhadap backend scratch (lihat laporan task):
//   E2E_API=http://localhost:3100/api/v1 E2E_ADMIN_USER=admin E2E_ADMIN_PASS=... \
//   E2E_DATABASE_URL=postgresql://.../hris_barokah_e2e node scripts/e2e-kiosk.mjs
// Task berikutnya menambah check lewat checks.push(['nama', async (ctx) => {...}]).
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

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
  assert.equal(boot.body.outlet.id, ctx.outlet.id);

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

checks.push(['outlet: mode absen tidak bisa diatur lagi (field tidak dikenal ditolak)', async (ctx) => {
  const r = await http('PUT', `/outlets/${ctx.outlet.id}`, { token: ctx.admin, body: { attendanceMode: 'MOBILE' } });
  assert.equal(r.status, 400);
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

// ---------- Task 3: bootstrap + jadwal bertugas di cabang ----------
const jakartaYmd = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
};

let seq = 0;
async function createCrew(admin, outletId, role = 'EMPLOYEE', name = 'Kru Uji') {
  const positionId = sql(`select id from "Position" limit 1`);
  const tag = `${Date.now().toString(36)}${seq++}`;
  const username = `kru.${tag}`;
  const r = await http('POST', '/employees', {
    token: admin,
    body: { username, password: 'kru-pass-123', role, nik: `K${tag}`, fullName: `${name} ${tag}`, phone: '0800', outletId, positionId, joinDate: '2026-01-01' },
  });
  assert.equal(r.status, 201, `buat kru gagal: ${JSON.stringify(r.body)}`);
  return { id: r.body.id, username, fullName: r.body.fullName, password: 'kru-pass-123' };
}
async function login(username, password) {
  const r = await http('POST', '/auth/login', { body: { username, password } });
  assert.equal(r.status, 201);
  return r.body.accessToken;
}
const schedule = (token, entries) => http('PUT', '/schedules', { token, body: { entries } });

checks.push(['bootstrap: roster rumah + tamu terjadwal (hari ini..+3), direktori tanpa embeddings, recap hanya kru rumah', async (ctx) => {
  const out1 = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}B1`);
  const out2 = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}B2`);
  const dev = await pairDevice(ctx.admin, out1.id, 'Tablet Boot');
  const home = await createCrew(ctx.admin, out1.id, 'EMPLOYEE', 'Rumah');
  const guest = await createCrew(ctx.admin, out2.id, 'EMPLOYEE', 'Tamu');
  const far = await createCrew(ctx.admin, out2.id, 'EMPLOYEE', 'Jauh');
  const none = await createCrew(ctx.admin, out2.id, 'EMPLOYEE', 'Tanpa Jadwal');
  const admin2 = await createCrew(ctx.admin, out1.id, 'HR_ADMIN', 'Admin');
  sql(`insert into "FaceEnrollment"(id,"employeeId",embedding,"photoPath","enrolledById") values (gen_random_uuid(),'${home.id}','{0.1,0.2}','x','x'),(gen_random_uuid(),'${home.id}','{0.3,0.4}','x','x')`);
  sql(`update "EmployeeProfile" set "attendancePinHash"='hash' where id='${home.id}'`);

  const tomorrow = jakartaYmd(1);
  const s1 = await schedule(ctx.admin, [
    { employeeId: guest.id, date: tomorrow, working: true, outletId: out1.id },
    { employeeId: far.id, date: jakartaYmd(5), working: true, outletId: out1.id },
  ]);
  assert.equal(s1.status, 200, JSON.stringify(s1.body));

  const b = await http('GET', '/kiosk/bootstrap', { token: dev.token });
  assert.equal(b.status, 200);
  const p = b.body;
  assert.ok(!Number.isNaN(Date.parse(p.serverTime)));
  assert.equal(typeof p.matchThreshold, 'number');
  assert.equal(p.outlet.id, out1.id);
  assert.equal(p.outlet.breakLimitMins, 60);
  assert.equal(p.outlet.hours.weekdayWorkStart, '09:00');
  assert.ok(Array.isArray(p.holidays));

  const r = Object.fromEntries(p.roster.map((x) => [x.employeeId, x]));
  assert.ok(r[home.id] && r[home.id].isGuest === false && r[home.id].hasPin === true);
  assert.equal(r[home.id].embeddings.length, 2);
  assert.deepEqual(r[home.id].embeddings.map((e) => e.length), [2, 2]);
  assert.equal(r[home.id].homeOutletName, out1.name);
  assert.ok(r[guest.id] && r[guest.id].isGuest === true && r[guest.id].hasPin === false);
  assert.deepEqual(r[guest.id].embeddings, []);
  assert.deepEqual(r[guest.id].guestDates, [tomorrow]);
  assert.equal(r[guest.id].homeOutletName, out2.name);
  assert.equal(r[far.id], undefined, 'jadwal +5 hari tidak masuk roster');
  assert.equal(r[none.id], undefined);
  assert.equal(r[admin2.id], undefined, 'admin tidak masuk roster');

  const d = Object.fromEntries(p.directory.map((x) => [x.employeeId, x]));
  assert.ok(d[none.id] && d[far.id] && d[home.id]);
  assert.equal(d[admin2.id], undefined);
  for (const x of p.directory) assert.equal(x.embeddings, undefined, 'direktori tanpa embeddings');
  assert.ok(!JSON.stringify(p.directory).includes('embedding'));

  const rc = p.recap.map((x) => x.employeeId);
  assert.ok(rc.includes(home.id));
  assert.ok(!rc.includes(guest.id), 'recap hanya kru rumah');
}]);

// Task 9: roster[].shifts = jadwal hari ini..+3 di cabang mana pun (untuk terlambat seperti
// punctuality) dengan here = bertugas di cabang tablet (outletId jadwal, kosong = cabang asal).
checks.push(['bootstrap: roster shifts (here: jadwal tanpa cabang = cabang asal; cabang lain = false)', async (ctx) => {
  const out1 = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}S1`);
  const out2 = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}S2`);
  const dev = await pairDevice(ctx.admin, out1.id, 'Tablet Shift');
  const homeHere = await createCrew(ctx.admin, out1.id, 'EMPLOYEE', 'Rumah Sini');
  const homeAway = await createCrew(ctx.admin, out1.id, 'EMPLOYEE', 'Rumah Dipinjam');
  const homeOff = await createCrew(ctx.admin, out1.id, 'EMPLOYEE', 'Rumah Libur');
  const guest = await createCrew(ctx.admin, out2.id, 'EMPLOYEE', 'Tamu Sini');
  const today = jakartaYmd(0);
  const s = await schedule(ctx.admin, [
    { employeeId: homeHere.id, date: today, working: true }, // outletId kosong -> cabang asal
    { employeeId: homeHere.id, date: jakartaYmd(2), working: true, outletId: out1.id },
    { employeeId: homeAway.id, date: today, working: true, outletId: out2.id },
    { employeeId: guest.id, date: today, working: true, outletId: out1.id },
    { employeeId: homeOff.id, date: jakartaYmd(5), working: true }, // di luar jendela +3
  ]);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(sql(`select coalesce("outletId"::text,'null') from "ShiftSchedule" where "employeeId"='${homeHere.id}' and date='${today}'`), 'null');

  const p = (await http('GET', '/kiosk/bootstrap', { token: dev.token })).body;
  const r = Object.fromEntries(p.roster.map((x) => [x.employeeId, x]));
  assert.deepEqual(r[homeHere.id].shifts, [{ date: today, here: true }, { date: jakartaYmd(2), here: true }]);
  assert.deepEqual(r[homeAway.id].shifts, [{ date: today, here: false }], 'kru rumah dijadwalkan di cabang lain');
  assert.deepEqual(r[homeOff.id].shifts, [], 'jadwal +5 hari di luar jendela');
  assert.deepEqual(r[guest.id].shifts, [{ date: today, here: true }]);
  assert.deepEqual(r[guest.id].guestDates, [today]);
}]);

checks.push(['bootstrap: today (absen hari ini + terbuka kemarin) dan recap bulan ini', async (ctx) => {
  const out = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}B3`);
  const dev = await pairDevice(ctx.admin, out.id, 'Tablet Today');
  const a = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'Hari Ini');
  const b = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'Kemarin Terbuka');
  const c = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'Kemarin Lama');
  const today = jakartaYmd(0);
  const yest = jakartaYmd(-1);
  const ins = (emp, date, inExpr, outExpr, late = 0) => {
    const id = sql(`insert into "Attendance"(id,"employeeId","outletId",date,"clockInTime","clockOutTime","lateMinutes") values (gen_random_uuid(),'${emp}','${out.id}','${date}',${inExpr},${outExpr},${late}) returning id`).split('\n')[0];
    return id;
  };
  const aId = ins(a.id, today, `(now() at time zone 'utc') - interval '2 hours'`, 'null', 7);
  sql(`insert into "AttendanceBreak"(id,"attendanceId","startBreak") values (gen_random_uuid(),'${aId}', (now() at time zone 'utc') - interval '10 minutes')`);
  ins(b.id, yest, `(now() at time zone 'utc') - interval '5 hours'`, 'null');
  ins(c.id, yest, `(now() at time zone 'utc') - interval '20 hours'`, 'null');

  const p = (await http('GET', '/kiosk/bootstrap', { token: dev.token })).body;
  const t = Object.fromEntries(p.today.map((x) => [x.employeeId, x]));
  assert.ok(t[a.id] && t[a.id].clockIn && t[a.id].clockOut === null && t[a.id].openBreakStart && t[a.id].lateMinutes === 7);
  assert.ok(t[b.id], 'absen terbuka kemarin (<16 jam) ikut');
  assert.equal(t[c.id], undefined, 'kemarin >16 jam tidak ikut');

  // recap: hari ini ada bila bulan sama (selalu, today di bulan berjalan)
  const rc = Object.fromEntries(p.recap.map((x) => [x.employeeId, x]));
  const day = rc[a.id].days.find((x) => x.date === today);
  assert.ok(day && day.clockIn && day.clockOut === null && day.lateMinutes === 7);
  assert.equal(day.workMinutes, 0);
  assert.equal(day.breakMinutes, 0, 'istirahat yang masih terbuka tidak dihitung');
}]);

checks.push(['recap: breakMinutes dan workMinutes untuk hari yang sudah pulang', async (ctx) => {
  const out = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}B4`);
  const dev = await pairDevice(ctx.admin, out.id, 'Tablet Recap');
  const a = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'Recap');
  const today = jakartaYmd(0);
  const id = sql(`insert into "Attendance"(id,"employeeId","outletId",date,"clockInTime","clockOutTime") values (gen_random_uuid(),'${a.id}','${out.id}','${today}', (now() at time zone 'utc') - interval '300 minutes', (now() at time zone 'utc') - interval '60 minutes') returning id`).split('\n')[0];
  sql(`insert into "AttendanceBreak"(id,"attendanceId","startBreak","endBreak","totalMinutes") values (gen_random_uuid(),'${id}', (now() at time zone 'utc') - interval '200 minutes', (now() at time zone 'utc') - interval '170 minutes', 30), (gen_random_uuid(),'${id}', (now() at time zone 'utc') - interval '120 minutes', (now() at time zone 'utc') - interval '110 minutes', 10)`);
  const p = (await http('GET', '/kiosk/bootstrap', { token: dev.token })).body;
  const day = p.recap.find((x) => x.employeeId === a.id).days.find((x) => x.date === today);
  assert.equal(day.breakMinutes, 40);
  assert.equal(day.workMinutes, 240 - 40);
}]);

checks.push(['jadwal: outletId disimpan, dikembalikan findRange, validasi outlet & peran', async (ctx) => {
  const out1 = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}S1`);
  const out2 = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}S2`);
  const crew = await createCrew(ctx.admin, out2.id, 'EMPLOYEE', 'Jadwal');
  const mate = await createCrew(ctx.admin, out1.id, 'EMPLOYEE', 'Satu Outlet');
  const sm = await createCrew(ctx.admin, out1.id, 'STORE_MANAGER', 'SM');
  const smToken = await login(sm.username, sm.password);
  const date = jakartaYmd(2);

  const ok = await schedule(ctx.admin, [{ employeeId: crew.id, date, working: true, outletId: out1.id }]);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const list = await http('GET', `/schedules?from=${date}&to=${date}`, { token: ctx.admin });
  const row = list.body.find((x) => x.employeeId === crew.id);
  assert.equal(row.outletId, out1.id);
  const plain = await http('GET', `/schedules?from=${date}&to=${date}`, { token: ctx.admin });
  assert.equal(plain.body.find((x) => x.employeeId === crew.id).outletId, out1.id);

  // tanpa outletId -> null
  await schedule(ctx.admin, [{ employeeId: mate.id, date, working: true }]);
  const l2 = await http('GET', `/schedules?from=${date}&to=${date}`, { token: ctx.admin });
  assert.equal(l2.body.find((x) => x.employeeId === mate.id).outletId, null);

  // outlet tidak ada / nonaktif / bukan UUID
  assert.equal((await schedule(ctx.admin, [{ employeeId: crew.id, date, working: true, outletId: 'bukan-uuid' }])).status, 400);
  assert.equal((await schedule(ctx.admin, [{ employeeId: crew.id, date, working: true, outletId: '00000000-0000-4000-8000-000000000000' }])).status, 400);
  sql(`update "Outlet" set "isActive"=false where id='${out2.id}'`);
  assert.equal((await schedule(ctx.admin, [{ employeeId: mate.id, date, working: true, outletId: out2.id }])).status, 400);
  sql(`update "Outlet" set "isActive"=true where id='${out2.id}'`);

  // Store Manager: outlet sendiri untuk kru outlet sendiri OK; outlet lain / kru outlet lain 403
  assert.equal((await schedule(smToken, [{ employeeId: mate.id, date, working: true, outletId: out1.id }])).status, 200);
  assert.equal((await schedule(smToken, [{ employeeId: mate.id, date, working: true, outletId: out2.id }])).status, 403);
  assert.equal((await schedule(smToken, [{ employeeId: crew.id, date, working: true, outletId: out1.id }])).status, 403);
}]);

// ---------- Task 4: ingest event, cek wajah server, identify ----------
// face-a/face-b: potongan @vladmandic/human assets/samples.jpg (lisensi MIT), masing-masing satu wajah
const FIXTURES = new URL('../test/fixtures/', import.meta.url);
const FACE_A = readFileSync(new URL('face-a.jpg', FIXTURES)).toString('base64');
const FACE_B = readFileSync(new URL('face-b.jpg', FIXTURES)).toString('base64');
const MIN = 60_000;

// Kru dengan wajah face-a terdaftar lewat endpoint pendaftaran wajah yang sudah ada
async function enrolledCrew(admin, outletId, name = 'Wajah') {
  const crew = await createCrew(admin, outletId, 'EMPLOYEE', name);
  const r = await http('POST', `/face/employees/${crew.id}`, {
    token: admin,
    body: { photosBase64: [FACE_A, FACE_A, FACE_A], consentConfirmed: true },
  });
  assert.equal(r.status, 201, `daftar wajah gagal: ${JSON.stringify(r.body)}`);
  return crew;
}

function setPin(employeeId, pin) {
  sql(`update "EmployeeProfile" set "attendancePinHash"='${bcrypt.hashSync(pin, 10)}' where id='${employeeId}'`);
}

// Event tablet; default: jam tablet tepat (offset 0), kejadian `agoMin` menit lalu
function ev(employeeId, type, { agoMin = 0, at, offset = 0, method = 'FACE_LOCAL', photo = FACE_A, pin } = {}) {
  const effective = at ? new Date(at) : new Date(Date.now() - agoMin * MIN);
  return {
    id: randomUUID(),
    employeeId,
    type,
    method,
    deviceTime: new Date(effective.getTime() - offset).toISOString(),
    offsetAtEventMs: offset,
    localScore: 0.8,
    photoBase64: photo,
    ...(pin ? { pin } : {}),
  };
}
const postEvents = (token, events, extra = {}) =>
  http('POST', '/kiosk/events', { token, body: { deviceNow: new Date().toISOString(), events }, ...extra });
const eventRow = (id) => sql(`select status||'|'||applied||'|'||coalesce(reason,'')||'|'||array_to_string(flags,',') from "AttendanceEvent" where id='${id}'`);

async function tabletOutlet(ctx, tag) {
  const out = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}${tag}`);
  const dev = await pairDevice(ctx.admin, out.id, `Tablet ${tag}`);
  return { out, dev };
}

checks.push(['events: CLOCK_IN wajah cocok -> APPLIED, Attendance source TABLET dari cabang tablet', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'E1');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const e = ev(crew.id, 'CLOCK_IN');
  const r = await postEvents(dev.token, [e]);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.deepEqual(r.body.results, [{ id: e.id, status: 'APPLIED', reason: null }]);
  const row = sql(`select source||'|'||"outletId"||'|'||coalesce("deviceId",'')||'|'||"isGuest"||'|'||array_to_string(flags,',')||'|'||("clockInPhotoUrl" is not null)||'|'||("clockInFaceScore">0) from "Attendance" where "employeeId"='${crew.id}'`);
  assert.equal(row, `TABLET|${out.id}|${dev.device.id}|false||true|true`);
  const evRow = sql(`select "attendanceId" is not null and "serverScore" is not null and "photoPath" is not null from "AttendanceEvent" where id='${e.id}'`);
  assert.equal(evRow, 't');
}]);

checks.push(['events: batch sama dikirim dua kali (dan serentak) -> hasil identik, satu Attendance, satu event', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'E2');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const batch = [ev(crew.id, 'CLOCK_IN', { agoMin: 1 }), ev(crew.id, 'BREAK_START')];
  const first = await postEvents(dev.token, batch);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const second = await postEvents(dev.token, batch);
  assert.deepEqual(second.body, first.body);
  assert.equal(sql(`select count(*) from "Attendance" where "employeeId"='${crew.id}'`), '1');
  assert.equal(sql(`select count(*) from "AttendanceEvent" where "employeeId"='${crew.id}'`), '2');
  assert.equal(sql(`select count(*) from "AttendanceBreak" b join "Attendance" a on a.id=b."attendanceId" where a."employeeId"='${crew.id}'`), '1');

  // balapan: dua kiriman serentak dengan id yang sama
  const crew2 = await enrolledCrew(ctx.admin, out.id);
  const race = [ev(crew2.id, 'CLOCK_IN')];
  const [a, b] = await Promise.all([postEvents(dev.token, race), postEvents(dev.token, race)]);
  assert.equal(a.status, 201);
  assert.deepEqual(a.body, b.body);
  assert.equal(a.body.results[0].status, 'APPLIED');
  assert.equal(sql(`select count(*) from "Attendance" where "employeeId"='${crew2.id}'`), '1');
  assert.equal(sql(`select count(*) from "AttendanceEvent" where "employeeId"='${crew2.id}'`), '1');
}]);

checks.push(['events: BREAK_START lalu CLOCK_OUT saat istirahat -> istirahat ditutup pada jam pulang', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'E3');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const batch = [ev(crew.id, 'CLOCK_OUT', { agoMin: 10 }), ev(crew.id, 'CLOCK_IN', { agoMin: 60 }), ev(crew.id, 'BREAK_START', { agoMin: 30 })];
  const r = await postEvents(dev.token, batch);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.deepEqual(r.body.results.map((x) => x.id), batch.map((x) => x.id), 'hasil mengikuti urutan kiriman');
  assert.deepEqual(r.body.results.map((x) => x.status), ['APPLIED', 'APPLIED', 'APPLIED']);
  const row = sql(`select (b."endBreak" = a."clockOutTime")||'|'||b."totalMinutes"||'|'||(a."clockOutTime" is not null) from "AttendanceBreak" b join "Attendance" a on a.id=b."attendanceId" where a."employeeId"='${crew.id}'`);
  assert.equal(row, 'true|20|true');
}]);

checks.push(['events: masuk 18:00 hari D, pulang 01:30 D+1, dikirim 3 hari kemudian -> satu absen tanggal D, terlambat, OFFLINE', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'E4');
  sql(`update "Outlet" set "weekdayWorkStart"='09:00',"weekendWorkStart"='09:00',"holidayWorkStart"='09:00' where id='${out.id}'`);
  const crew = await enrolledCrew(ctx.admin, out.id);
  const d = jakartaYmd(-3);
  const d1 = jakartaYmd(-2);
  sql(`insert into "ShiftSchedule"(id,"employeeId",date) values (gen_random_uuid(),'${crew.id}','${d}')`);
  const batch = [ev(crew.id, 'CLOCK_IN', { at: `${d}T18:00:00+07:00` }), ev(crew.id, 'CLOCK_OUT', { at: `${d1}T01:30:00+07:00` })];
  const r = await postEvents(dev.token, batch);
  assert.deepEqual(r.body.results.map((x) => x.status), ['APPLIED', 'APPLIED'], JSON.stringify(r.body));
  const rows = sql(`select to_char(date,'YYYY-MM-DD')||'|'||"lateMinutes"||'|'||status||'|'||array_to_string(flags,',')||'|'||("scheduleId" is not null)||'|'||("clockOutTime" is not null) from "Attendance" where "employeeId"='${crew.id}'`);
  assert.equal(rows, `${d}|540|LATE|OFFLINE|true|true`);
  assert.match(eventRow(batch[1].id), /^APPLIED\|true\|\|OFFLINE$/);
}]);

checks.push(['events: CLOCK_IN kedua di hari sama -> NEEDS_REVIEW tidak diterapkan, "Sudah absen masuk"', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'E5');
  const crew = await enrolledCrew(ctx.admin, out.id);
  await postEvents(dev.token, [ev(crew.id, 'CLOCK_IN', { agoMin: 1 })]);
  const e = ev(crew.id, 'CLOCK_IN');
  const r = await postEvents(dev.token, [e]);
  assert.deepEqual(r.body.results, [{ id: e.id, status: 'NEEDS_REVIEW', reason: 'Sudah absen masuk' }]);
  assert.match(eventRow(e.id), /^NEEDS_REVIEW\|false\|Sudah absen masuk\|/);
  assert.equal(sql(`select count(*) from "Attendance" where "employeeId"='${crew.id}'`), '1');
}]);

checks.push(['events: wajah lain -> NEEDS_REVIEW tetap diterapkan, FACE_REVIEW + PENDING_REVIEW', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'E6');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const e = ev(crew.id, 'CLOCK_IN', { photo: FACE_B });
  const r = await postEvents(dev.token, [e]);
  assert.equal(r.body.results[0].status, 'NEEDS_REVIEW', JSON.stringify(r.body));
  assert.ok(r.body.results[0].reason, 'alasan terisi');
  const [status, applied, , flags] = eventRow(e.id).split('|');
  assert.equal(status, 'NEEDS_REVIEW');
  assert.equal(applied, 'true');
  assert.ok(flags.split(',').includes('FACE_REVIEW'));
  const att = sql(`select array_to_string(flags,',') from "Attendance" where "employeeId"='${crew.id}'`).split(',');
  assert.ok(att.includes('FACE_REVIEW') && att.includes('PENDING_REVIEW'), att.join());
}]);

checks.push(['events: PIN benar tanpa wajah terdaftar -> NEEDS_REVIEW diterapkan (NO_FACE, PIN); PIN salah -> REJECTED', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'E7');
  const crew = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'Tanpa Wajah');
  setPin(crew.id, '123456');
  const bad = ev(crew.id, 'CLOCK_IN', { method: 'PIN', pin: '654321', agoMin: 1 });
  const rb = await postEvents(dev.token, [bad]);
  assert.deepEqual(rb.body.results, [{ id: bad.id, status: 'REJECTED', reason: 'PIN salah' }]);
  assert.match(eventRow(bad.id), /^REJECTED\|false\|PIN salah\|/);
  assert.equal(sql(`select count(*) from "Attendance" where "employeeId"='${crew.id}'`), '0');

  const good = ev(crew.id, 'CLOCK_IN', { method: 'PIN', pin: '123456' });
  const rg = await postEvents(dev.token, [good]);
  assert.equal(rg.body.results[0].status, 'NEEDS_REVIEW', JSON.stringify(rg.body));
  const [, applied, , flags] = eventRow(good.id).split('|');
  assert.equal(applied, 'true');
  assert.ok(flags.includes('NO_FACE') && flags.includes('PIN'), flags);
  const att = sql(`select array_to_string(flags,',') from "Attendance" where "employeeId"='${crew.id}'`).split(',');
  assert.ok(att.includes('NO_FACE') && att.includes('PIN') && att.includes('PENDING_REVIEW'), att.join());

  // kru tanpa PIN sama sekali -> PIN salah
  const noPin = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'Tanpa PIN');
  const np = ev(noPin.id, 'CLOCK_IN', { method: 'PIN', pin: '000000' });
  assert.equal((await postEvents(dev.token, [np])).body.results[0].reason, 'PIN salah');
}]);

checks.push(['events: offsetAtEventMs beda 5 menit dari offset sekarang -> CLOCK_CHANGED', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'E8');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const e = ev(crew.id, 'CLOCK_IN', { offset: 5 * MIN });
  const r = await postEvents(dev.token, [e]);
  assert.equal(r.body.results[0].status, 'NEEDS_REVIEW', JSON.stringify(r.body));
  const [, applied, , flags] = eventRow(e.id).split('|');
  assert.equal(applied, 'true');
  assert.ok(flags.split(',').includes('CLOCK_CHANGED'), flags);
  assert.ok(!flags.split(',').includes('OFFLINE'), 'waktu efektif = sekarang, bukan offline');
}]);

checks.push(['events: kru tamu tidak terjadwal di cabang ini -> GUEST + UNSCHEDULED', async (ctx) => {
  const { dev } = await tabletOutlet(ctx, 'E9');
  const home = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}E9H`);
  const crew = await enrolledCrew(ctx.admin, home.id);
  const e = ev(crew.id, 'CLOCK_IN');
  const r = await postEvents(dev.token, [e]);
  assert.equal(r.body.results[0].status, 'NEEDS_REVIEW', JSON.stringify(r.body));
  const att = sql(`select "isGuest"||'|'||array_to_string(flags,',') from "Attendance" where "employeeId"='${crew.id}'`);
  const [isGuest, flags] = att.split('|');
  assert.equal(isGuest, 'true');
  for (const f of ['GUEST', 'UNSCHEDULED', 'PENDING_REVIEW']) assert.ok(flags.split(',').includes(f), flags);
}]);

checks.push(['events: validasi batch (kosong, >50, PIN bukan 6 digit, tanpa token)', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'EV');
  const crew = await createCrew(ctx.admin, out.id);
  assert.equal((await postEvents(dev.token, [])).status, 400);
  assert.equal((await postEvents(dev.token, [ev(crew.id, 'CLOCK_IN', { method: 'PIN', pin: '12ab56' })])).status, 400);
  const many = Array.from({ length: 51 }, () => ({ ...ev(crew.id, 'CLOCK_IN'), photoBase64: 'x' }));
  const r51 = await postEvents(dev.token, many);
  assert.equal(r51.status, 400);
  assert.match(JSON.stringify(r51.body.message), /Maksimal 50 event/);
  assert.equal((await postEvents(undefined, [ev(crew.id, 'CLOCK_IN')])).status, 401);
}]);

checks.push(['identify: wajah terdaftar -> kru itu; wajah asing -> 404; 11 gagal beruntun -> 429', async (ctx) => {
  const { dev } = await tabletOutlet(ctx, 'ID');
  const home = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}IDH`);
  const crew = await enrolledCrew(ctx.admin, home.id, 'Wajah Identify');
  // wajah face-a dari run/check lain disingkirkan agar hasilnya pasti kru ini
  sql(`delete from "FaceEnrollment" where "employeeId" <> '${crew.id}' and "employeeId" in (select id from "EmployeeProfile" where "fullName" like 'Wajah%')`);
  const ok = await http('POST', '/kiosk/identify', { token: dev.token, body: { photoBase64: FACE_A } });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.employeeId, crew.id);
  assert.equal(ok.body.fullName, crew.fullName);
  assert.equal(ok.body.homeOutletName, home.name);
  assert.ok(ok.body.score >= 0.5);

  const statuses = [];
  for (let i = 0; i < 11; i++) {
    statuses.push((await http('POST', '/kiosk/identify', { token: dev.token, body: { photoBase64: FACE_B } })).status);
  }
  assert.deepEqual(statuses, [...Array(10).fill(404), 429]);
  const nf = await http('POST', '/kiosk/identify', { token: (await pairDevice(ctx.admin, home.id, 'Tablet ID2')).token, body: { photoBase64: FACE_B } });
  assert.equal(nf.body.message, 'Wajah tidak dikenali');
}]);

checks.push(['events: jatah PIN salah habis (10/10 menit per tablet) -> event ke-11 dst tidak dijawab & tidak disimpan (tablet mengulang)', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'PL');
  const crew = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'Tebak PIN');
  setPin(crew.id, '123456');
  const wrong = Array.from({ length: 11 }, (_, i) => ev(crew.id, 'CLOCK_IN', { method: 'PIN', pin: '000000', agoMin: 12 - i }));
  const right = ev(crew.id, 'CLOCK_IN', { method: 'PIN', pin: '123456' });
  const r = await postEvents(dev.token, [...wrong, right]);
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.results.map((x) => x.id), wrong.slice(0, 10).map((x) => x.id), 'ke-11 dan PIN benar sesudahnya tidak dijawab');
  assert.ok(r.body.results.every((x) => x.status === 'REJECTED' && x.reason === 'PIN salah'));
  assert.equal(sql(`select count(*) from "AttendanceEvent" where id in ('${wrong[10].id}','${right.id}')`), '0', 'tidak disimpan');
  // Kiriman ulang event yang tidak dijawab tetap aman; jatah per tablet, jadi lewat tablet lain
  // (pengganti menunggu 10 menit) PIN benar itu diterapkan
  const dev2 = await pairDevice(ctx.admin, out.id, 'Tablet PL2');
  const r2 = await postEvents(dev2.token, [right]);
  assert.equal(r2.body.results[0].status, 'NEEDS_REVIEW', JSON.stringify(r2.body));
  assert.match(eventRow(right.id), /^NEEDS_REVIEW\|true\|/);
}]);

checks.push(['events: CLOCK_OUT telat untuk hari D menempel ke absen D, bukan absen D+1 yang lebih baru', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'LT');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const d = jakartaYmd(-3);
  const d1 = jakartaYmd(-2);
  const inD = ev(crew.id, 'CLOCK_IN', { at: `${d}T18:00:00+07:00` });
  const inD1 = ev(crew.id, 'CLOCK_IN', { at: `${d1}T08:00:00+07:00` });
  assert.equal((await postEvents(dev.token, [inD])).body.results[0].status, 'APPLIED');
  assert.equal((await postEvents(dev.token, [inD1])).body.results[0].status, 'APPLIED');
  const out23 = ev(crew.id, 'CLOCK_OUT', { at: `${d}T23:00:00+07:00` });
  const r = await postEvents(dev.token, [out23]);
  assert.equal(r.body.results[0].status, 'APPLIED', JSON.stringify(r.body));
  const rows = sql(`select to_char(date,'YYYY-MM-DD')||'|'||("clockOutTime" is not null) from "Attendance" where "employeeId"='${crew.id}' order by date`);
  assert.equal(rows, `${d}|true\n${d1}|false`);
}]);

checks.push(['events: foto tidak bisa dibaca (kesalahan event, deterministik) -> disimpan NEEDS_REVIEW tidak diterapkan, kiriman ulang sama', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'BP');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const e = { ...ev(crew.id, 'CLOCK_IN'), photoBase64: Buffer.from('bukan gambar sama sekali').toString('base64') };
  const r = await postEvents(dev.token, [e]);
  assert.equal(r.body.results[0].status, 'NEEDS_REVIEW', JSON.stringify(r.body));
  assert.match(r.body.results[0].reason, /^Foto absen tidak valid/);
  assert.match(eventRow(e.id), /^NEEDS_REVIEW\|false\|Foto absen tidak valid/);
  assert.equal(sql(`select count(*) from "Attendance" where "employeeId"='${crew.id}'`), '0');
  assert.deepEqual((await postEvents(dev.token, [e])).body, r.body);
}]);

checks.push(['HP: semua rute absen HP ditutup (410), status hari ini tetap bisa dibaca', async (ctx) => {
  const crew = await createCrew(ctx.admin, ctx.outlet.id);
  const token = await login(crew.username, crew.password);
  for (const path of ['/attendance/clock-in', '/attendance/clock-out', '/attendance/break/start', '/attendance/break/end']) {
    const r = await http('POST', path, { token, body: { photoBase64: FACE_A } });
    assert.equal(r.status, 410, path);
    assert.equal(r.body.message, 'Absen hanya lewat tablet cabang');
  }
  assert.equal(sql(`select count(*) from "Attendance" where "employeeId"='${crew.id}'`), '0');
  const today = await http('GET', '/attendance/today', { token });
  assert.equal(today.status, 200);
  assert.equal(today.body.attendanceMode, undefined);
  assert.ok(today.body.workingOutletName);
}]);
// ---------- tinjauan absen meragukan ----------
async function smOf(ctx, outletId) {
  const sm = await createCrew(ctx.admin, outletId, 'STORE_MANAGER', 'SM Tinjau');
  return login(sm.username, sm.password);
}
const attFlags = (empId) => sql(`select array_to_string(flags,',') from "Attendance" where "employeeId"='${empId}'`).split(',');
const review = (token, id, action) => http('POST', `/attendance-review/${id}/${action}`, { token });

checks.push(['tinjau: Store Manager hanya melihat/menyetujui event outletnya; peran lain 403; daftar berisi foto & skor', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'R1');
  const { out: out2 } = await tabletOutlet(ctx, 'R2');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const e = ev(crew.id, 'CLOCK_IN', { photo: FACE_B });
  assert.equal((await postEvents(dev.token, [e])).body.results[0].status, 'NEEDS_REVIEW');
  const sm1 = await smOf(ctx, out.id);
  const sm2 = await smOf(ctx, out2.id);

  const mine = await http('GET', '/attendance-review?status=NEEDS_REVIEW', { token: sm1 });
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  const item = mine.body.find((x) => x.id === e.id);
  assert.ok(item, 'SM outlet sendiri melihat event');
  assert.equal(item.type, 'CLOCK_IN');
  assert.equal(item.applied, true);
  assert.equal(item.employee.id, crew.id);
  assert.equal(item.outlet.id, out.id);
  assert.ok(item.photoUrl && item.photoUrl.startsWith('/uploads/'), item.photoUrl);
  assert.ok(item.enrolledPhotoUrl, 'foto terdaftar ada');
  assert.ok(item.serverScore !== null && item.localScore !== null);
  assert.ok(item.flags.includes('FACE_REVIEW'));
  assert.ok(mine.body.every((x) => x.outlet.id === out.id), 'hanya outlet sendiri');

  const other = await http('GET', '/attendance-review', { token: sm2 });
  assert.equal(other.status, 200);
  assert.ok(!other.body.some((x) => x.id === e.id), 'SM outlet lain tidak melihat');
  const forced = await http('GET', `/attendance-review?outletId=${out.id}`, { token: sm2 });
  assert.ok(!forced.body.some((x) => x.id === e.id));
  assert.equal((await review(sm2, e.id, 'accept')).status, 403);
  assert.equal((await review(sm2, e.id, 'reject')).status, 403);
  assert.equal(eventRow(e.id).split('|')[0], 'NEEDS_REVIEW');

  const crewToken = await login(crew.username, crew.password);
  assert.equal((await http('GET', '/attendance-review', { token: crewToken })).status, 403);
  assert.equal((await review(crewToken, e.id, 'accept')).status, 403);
  assert.equal((await http('GET', '/attendance-review')).status, 401);

  const adminList = await http('GET', `/attendance-review?outletId=${out.id}&from=2000-01-01&to=2999-01-01`, { token: ctx.admin });
  assert.ok(adminList.body.some((x) => x.id === e.id));
  assert.equal((await http('GET', '/attendance-review?status=APPLIED', { token: ctx.admin })).status, 400);
  const photo = await fetch(API.replace('/api/v1', '') + item.photoUrl);
  assert.equal(photo.status, 200);
  const enr = await fetch(API.replace('/api/v1', '') + item.enrolledPhotoUrl, { headers: { Authorization: `Bearer ${sm1}` } });
  assert.equal(enr.status, 200);
  const enrOther = await fetch(API.replace('/api/v1', '') + item.enrolledPhotoUrl, { headers: { Authorization: `Bearer ${sm2}` } });
  assert.equal(enrOther.status, 403);
}]);

checks.push(['tinjau: accept -> APPLIED, PENDING_REVIEW hilang, reviewer tercatat; accept/reject lagi 400 "Sudah ditinjau"; serentak hanya satu menang', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'R3');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const e = ev(crew.id, 'CLOCK_IN', { photo: FACE_B });
  await postEvents(dev.token, [e]);
  assert.ok(attFlags(crew.id).includes('PENDING_REVIEW'));
  const a = await review(ctx.admin, e.id, 'accept');
  assert.equal(a.status, 201, JSON.stringify(a.body));
  const [status, applied] = eventRow(e.id).split('|');
  assert.equal(status, 'APPLIED');
  assert.equal(applied, 'true');
  assert.ok(!attFlags(crew.id).includes('PENDING_REVIEW'), 'PENDING_REVIEW dihapus');
  assert.equal(sql(`select ("reviewedById" is not null)||'|'||("reviewedAt" is not null) from "AttendanceEvent" where id='${e.id}'`), 'true|true');
  const again = await review(ctx.admin, e.id, 'accept');
  assert.equal(again.status, 400);
  assert.equal(again.body.message, 'Sudah ditinjau');
  assert.equal((await review(ctx.admin, e.id, 'reject')).status, 400);
  assert.equal((await review(ctx.admin, randomUUID(), 'accept')).status, 404);

  const crew2 = await enrolledCrew(ctx.admin, out.id);
  const e2 = ev(crew2.id, 'CLOCK_IN', { photo: FACE_B });
  await postEvents(dev.token, [e2]);
  const rs = await Promise.all([review(ctx.admin, e2.id, 'accept'), review(ctx.admin, e2.id, 'reject'), review(ctx.admin, e2.id, 'accept')]);
  assert.equal(rs.filter((r) => r.status === 201).length, 1, JSON.stringify(rs.map((r) => r.status)));
  assert.equal(rs.filter((r) => r.status === 400).length, 2);
}]);

checks.push(['tinjau: accept satu dari dua event meragukan -> PENDING_REVIEW tetap sampai event terakhir ditinjau', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'R4');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const e1 = ev(crew.id, 'CLOCK_IN', { agoMin: 60, photo: FACE_B });
  const e2 = ev(crew.id, 'CLOCK_OUT', { agoMin: 5, photo: FACE_B });
  await postEvents(dev.token, [e1, e2]);
  assert.equal((await review(ctx.admin, e1.id, 'accept')).status, 201);
  assert.ok(attFlags(crew.id).includes('PENDING_REVIEW'), 'masih ada satu menunggu');
  assert.equal((await review(ctx.admin, e2.id, 'accept')).status, 201);
  assert.ok(!attFlags(crew.id).includes('PENDING_REVIEW'));
}]);

checks.push(['tinjau: reject CLOCK_IN -> absen & istirahat terhapus, semua event hari itu REJECTED "Absen masuk ditolak"', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'R5');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const e1 = ev(crew.id, 'CLOCK_IN', { agoMin: 60, photo: FACE_B });
  const e2 = ev(crew.id, 'BREAK_START', { agoMin: 30 });
  const e3 = ev(crew.id, 'CLOCK_IN', { agoMin: 10 }); // ganda: tidak diterapkan, menempel ke absen
  const r = await postEvents(dev.token, [e1, e2, e3]);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(sql(`select count(*) from "AttendanceBreak" b join "Attendance" a on a.id=b."attendanceId" where a."employeeId"='${crew.id}'`), '1');
  const x = await review(ctx.admin, e1.id, 'reject');
  assert.equal(x.status, 201, JSON.stringify(x.body));
  assert.equal(sql(`select count(*) from "Attendance" where "employeeId"='${crew.id}'`), '0');
  for (const id of [e1.id, e2.id, e3.id]) {
    const [status, , reason] = eventRow(id).split('|');
    assert.equal(status, 'REJECTED', id);
    assert.equal(reason, 'Absen masuk ditolak');
  }
  assert.equal(sql(`select ("reviewedById" is not null) from "AttendanceEvent" where id='${e1.id}'`), 't');
  const rejected = await http('GET', '/attendance-review?status=REJECTED', { token: ctx.admin });
  assert.ok(rejected.body.some((i) => i.id === e1.id && i.status === 'REJECTED'));
}]);

checks.push(['tinjau: reject BREAK_END -> istirahat dihapus; reject CLOCK_OUT -> clockOut* kosong; reject tak diterapkan -> hanya REJECTED', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'R6');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const eIn = ev(crew.id, 'CLOCK_IN', { agoMin: 90 });
  const eBs = ev(crew.id, 'BREAK_START', { agoMin: 80 });
  const eBe = ev(crew.id, 'BREAK_END', { agoMin: 70, photo: FACE_B });
  const eOut = ev(crew.id, 'CLOCK_OUT', { agoMin: 5, photo: FACE_B });
  const eDup = ev(crew.id, 'CLOCK_IN', { agoMin: 3 }); // ditolak urutan, tak diterapkan
  assert.equal((await postEvents(dev.token, [eIn, eBs, eBe, eOut, eDup])).status, 201);
  assert.equal(eventRow(eDup.id).split('|')[1], 'false');

  assert.equal((await review(ctx.admin, eBe.id, 'reject')).status, 201);
  assert.equal(sql(`select count(*) from "AttendanceBreak" b join "Attendance" a on a.id=b."attendanceId" where a."employeeId"='${crew.id}'`), '0');
  assert.equal(eventRow(eBe.id).split('|')[0], 'REJECTED');
  assert.ok(attFlags(crew.id).includes('PENDING_REVIEW'), 'CLOCK_OUT masih menunggu');

  assert.equal((await review(ctx.admin, eOut.id, 'reject')).status, 201);
  assert.equal(sql(`select ("clockOutTime" is null)||'|'||("clockOutPhotoUrl" is null)||'|'||("clockOutFaceScore" is null)||'|'||("clockInTime" is not null) from "Attendance" where "employeeId"='${crew.id}'`), 'true|true|true|true');
  assert.ok(!attFlags(crew.id).includes('PENDING_REVIEW'));

  assert.equal((await review(ctx.admin, eDup.id, 'reject')).status, 201);
  assert.equal(eventRow(eDup.id).split('|')[0], 'REJECTED');
  assert.equal(sql(`select count(*) from "Attendance" where "employeeId"='${crew.id}'`), '1');
  assert.equal(eventRow(eIn.id).split('|')[0], 'APPLIED');
}]);

// ---------- Task 6: blokir absen HP di cabang tablet, PIN absen ----------

checks.push(['PIN absen: kru atur sendiri (password salah 400, benar 200, format 6 digit); HR atur; hash tak bocor; PIN dipakai di tablet', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'N1');
  const crew = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'Atur PIN');
  const token = await login(crew.username, crew.password);
  const put = (pin, password) => http('PUT', '/me/attendance-pin', { token, body: { pin, password } });

  assert.equal((await http('PUT', '/me/attendance-pin', { body: { pin: '123456', password: crew.password } })).status, 401);
  const wrong = await put('123456', 'salah-banget');
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.message, 'Password salah');
  assert.equal(sql(`select ("attendancePinHash" is null) from "EmployeeProfile" where id='${crew.id}'`), 't');
  for (const bad of ['12345', '1234567', 'abcdef', '12 456']) {
    assert.equal((await put(bad, crew.password)).status, 400, bad);
  }
  assert.equal((await put(undefined, crew.password)).status, 400);
  const ok = await put('123456', crew.password);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const hash = sql(`select "attendancePinHash" from "EmployeeProfile" where id='${crew.id}'`);
  assert.ok(hash.startsWith('$2') && !hash.includes('123456'));
  assert.ok(bcrypt.compareSync('123456', hash));
  assert.ok(!JSON.stringify(ok.body).includes(hash));

  // PIN dipakai di alur tablet
  const e = ev(crew.id, 'CLOCK_IN', { method: 'PIN', pin: '123456' });
  const r = await postEvents(dev.token, [e]);
  assert.equal(r.body.results[0].status, 'NEEDS_REVIEW', JSON.stringify(r.body));

  // admin melihat hasAttendancePin, tanpa hash
  const detail = await http('GET', `/employees/${crew.id}`, { token: ctx.admin });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.hasAttendancePin, true);
  assert.equal(detail.body.attendancePinHash, undefined);
  const list = await http('GET', `/employees?outletId=${out.id}`, { token: ctx.admin });
  assert.ok(list.body.every((p) => p.attendancePinHash === undefined && typeof p.hasAttendancePin === 'boolean'));
  assert.equal(list.body.find((p) => p.id === crew.id).hasAttendancePin, true);

  // tidak ada endpoint yang membocorkan hash
  const me = await http('GET', '/auth/me', { token });
  assert.ok(!JSON.stringify(me.body).includes('attendancePinHash') && !JSON.stringify(me.body).includes(hash));
  const login2 = await http('POST', '/auth/login', { body: { username: crew.username, password: crew.password } });
  assert.ok(!JSON.stringify(login2.body).includes(hash));
  const daily = await http('GET', `/attendance/admin/daily-report?outletId=${out.id}`, { token: ctx.admin });
  assert.equal(daily.status, 200);
  assert.ok(!JSON.stringify(daily.body).includes(hash) && !JSON.stringify(daily.body).includes('attendancePinHash'));
}]);

checks.push(['PIN absen: HR/Super Admin atur PIN kru; Store Manager & kru 403; akun admin hanya Super Admin; PIN tak valid 400', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'N2');
  const crew = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'PIN oleh HR');
  const hr = await createCrew(ctx.admin, out.id, 'HR_ADMIN', 'HR PIN');
  const hrToken = await login(hr.username, hr.password);
  const sm = await createCrew(ctx.admin, out.id, 'STORE_MANAGER', 'SM PIN');
  const smToken = await login(sm.username, sm.password);
  const crewToken = await login(crew.username, crew.password);
  const url = `/employees/${crew.id}/attendance-pin`;

  assert.equal((await http('PUT', url, { body: { pin: '246810' } })).status, 401);
  assert.equal((await http('PUT', url, { token: smToken, body: { pin: '246810' } })).status, 403);
  assert.equal((await http('PUT', url, { token: crewToken, body: { pin: '246810' } })).status, 403);
  assert.equal((await http('PUT', url, { token: hrToken, body: { pin: '24681' } })).status, 400);
  assert.equal((await http('PUT', url, { token: hrToken, body: { pin: 'abcdef' } })).status, 400);
  assert.equal((await http('PUT', '/employees/00000000-0000-4000-8000-000000000000/attendance-pin', { token: hrToken, body: { pin: '246810' } })).status, 404);
  assert.equal(sql(`select ("attendancePinHash" is null) from "EmployeeProfile" where id='${crew.id}'`), 't');

  const ok = await http('PUT', url, { token: hrToken, body: { pin: '246810' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(bcrypt.compareSync('246810', sql(`select "attendancePinHash" from "EmployeeProfile" where id='${crew.id}'`)));
  const e = ev(crew.id, 'CLOCK_IN', { method: 'PIN', pin: '246810' });
  assert.equal((await postEvents(dev.token, [e])).body.results[0].status, 'NEEDS_REVIEW');
  // reset oleh Super Admin
  assert.equal((await http('PUT', url, { token: ctx.admin, body: { pin: '135790' } })).status, 200);
  assert.ok(bcrypt.compareSync('135790', sql(`select "attendancePinHash" from "EmployeeProfile" where id='${crew.id}'`)));

  // akun admin: HR tidak boleh, Super Admin boleh
  const hr2 = await createCrew(ctx.admin, out.id, 'HR_ADMIN', 'HR Lain');
  const denied = await http('PUT', `/employees/${hr2.id}/attendance-pin`, { token: hrToken, body: { pin: '111222' } });
  assert.equal(denied.status, 403);
  assert.equal((await http('PUT', `/employees/${hr2.id}/attendance-pin`, { token: ctx.admin, body: { pin: '111222' } })).status, 200);
}]);

// ---------- tinjauan akhir: perbaikan menyeluruh ----------
const hasFlag = (id, f) => eventRow(id).split('|')[3].split(',').includes(f);

checks.push(['jam: GET /kiosk/time butuh token; offsetNowMs ukuran tablet dipakai (unggahan lambat tidak CLOCK_CHANGED), bentuk lama tetap diterima', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'TM');
  assert.equal((await http('GET', '/kiosk/time')).status, 401);
  const t = await http('GET', '/kiosk/time', { token: dev.token });
  assert.equal(t.status, 200);
  assert.ok(Math.abs(Date.parse(t.body.serverTime) - Date.now()) < 5000, t.body.serverTime);
  const crew = await enrolledCrew(ctx.admin, out.id);
  // deviceNow dicap 10 menit sebelum diterima (unggahan lambat); tablet mengukur selisih 0 tepat sebelum kirim
  const slow = ev(crew.id, 'CLOCK_IN');
  const r = await http('POST', '/kiosk/events', { token: dev.token, body: { deviceNow: new Date(Date.now() - 10 * MIN).toISOString(), offsetNowMs: 0, events: [slow] } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.deepEqual(r.body.results, [{ id: slow.id, status: 'APPLIED', reason: null }]);
  // bentuk lama (tanpa offsetNowMs): deviceNow basi tetap ditandai seperti sebelumnya
  const crew2 = await enrolledCrew(ctx.admin, out.id);
  const old = ev(crew2.id, 'CLOCK_IN');
  const r2 = await http('POST', '/kiosk/events', { token: dev.token, body: { deviceNow: new Date(Date.now() - 10 * MIN).toISOString(), events: [old] } });
  assert.equal(r2.status, 201);
  assert.ok(hasFlag(old.id, 'CLOCK_CHANGED'));
  // jam tablet benar-benar digeser sejak sinkron terakhir: offsetNowMs ukuran tablet berbeda -> CLOCK_CHANGED
  const crew3 = await enrolledCrew(ctx.admin, out.id);
  const moved = ev(crew3.id, 'CLOCK_IN');
  await http('POST', '/kiosk/events', { token: dev.token, body: { deviceNow: new Date().toISOString(), offsetNowMs: 30 * MIN, events: [moved] } });
  assert.ok(hasFlag(moved.id, 'CLOCK_CHANGED'));
  const bad = await http('POST', '/kiosk/events', { token: dev.token, body: { deviceNow: new Date().toISOString(), offsetNowMs: 'x', events: [ev(crew3.id, 'CLOCK_OUT')] } });
  assert.equal(bad.status, 400);
}]);

checks.push(['jam: clockSuspect dari tablet dan waktu efektif > 2 menit di depan -> CLOCK_CHANGED (tinjau)', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'CS');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const e = { ...ev(crew.id, 'CLOCK_IN', { agoMin: 30 }), clockSuspect: true };
  const r = await postEvents(dev.token, [e]);
  assert.equal(r.body.results[0].status, 'NEEDS_REVIEW', JSON.stringify(r.body));
  assert.ok(hasFlag(e.id, 'CLOCK_CHANGED'));
  assert.equal(sql(`select "attendanceId" is not null from "AttendanceEvent" where id='${e.id}'`), 't', 'tetap diterapkan');
  const plain = ev(crew.id, 'BREAK_START', { agoMin: 10 });
  await postEvents(dev.token, [{ ...plain, clockSuspect: false }]);
  assert.ok(!hasFlag(plain.id, 'CLOCK_CHANGED'));
  const crew2 = await enrolledCrew(ctx.admin, out.id);
  const future = ev(crew2.id, 'CLOCK_IN', { at: Date.now() + 5 * MIN });
  const f = await postEvents(dev.token, [future]);
  assert.equal(f.body.results[0].status, 'NEEDS_REVIEW');
  assert.ok(hasFlag(future.id, 'CLOCK_CHANGED'));
  const near = ev(crew.id, 'BREAK_END', { at: Date.now() + 60_000 });
  await postEvents(dev.token, [near]);
  assert.ok(!hasFlag(near.id, 'CLOCK_CHANGED'), '1 menit di depan masih wajar');
}]);

checks.push(['bootstrap ?pending=N tersimpan di perangkat (pendingCount + waktu) dan tampil di daftar tablet; nilai ngawur diabaikan', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'PD');
  assert.equal((await http('GET', '/kiosk/bootstrap?pending=7', { token: dev.token })).status, 200);
  let d = (await http('GET', `/outlets/${out.id}/devices`, { token: ctx.admin })).body.find((x) => x.id === dev.device.id);
  assert.equal(d.pendingCount, 7);
  assert.ok(Math.abs(Date.parse(d.pendingReportedAt) - Date.now()) < 10_000);
  assert.equal((await http('GET', '/kiosk/bootstrap?pending=abc', { token: dev.token })).status, 200);
  assert.equal((await http('GET', '/kiosk/bootstrap?pending=-1', { token: dev.token })).status, 200);
  d = (await http('GET', `/outlets/${out.id}/devices`, { token: ctx.admin })).body.find((x) => x.id === dev.device.id);
  assert.equal(d.pendingCount, 7);
  await http('GET', '/kiosk/bootstrap?pending=0', { token: dev.token });
  d = (await http('GET', `/outlets/${out.id}/devices`, { token: ctx.admin })).body.find((x) => x.id === dev.device.id);
  assert.equal(d.pendingCount, 0);
}]);

checks.push(['pindah cabang di tengah shift: bootstrap cabang B memuat absen terbuka kru roster dari cabang A (here=false); identify membawa status terbuka; istirahat/pulang di B diterapkan', async (ctx) => {
  const { out: a, dev: devA } = await tabletOutlet(ctx, 'MA');
  const { out: b, dev: devB } = await tabletOutlet(ctx, 'MB');
  const crew = await enrolledCrew(ctx.admin, a.id, 'Wajah Pindah');
  sql(`delete from "FaceEnrollment" where "employeeId" <> '${crew.id}' and "employeeId" in (select id from "EmployeeProfile" where "fullName" like 'Wajah%')`);
  // dijadwalkan di B hari ini (tamu B), tetapi masuk dulu di A
  assert.equal((await schedule(ctx.admin, [{ employeeId: crew.id, date: jakartaYmd(0), working: true, outletId: b.id }])).status, 200);
  const cin = ev(crew.id, 'CLOCK_IN', { agoMin: 120 });
  await postEvents(devA.token, [cin]);
  const boot = await http('GET', '/kiosk/bootstrap', { token: devB.token });
  assert.ok(boot.body.roster.some((r) => r.employeeId === crew.id), 'kru tamu di roster B');
  const row = boot.body.today.find((t) => t.employeeId === crew.id);
  assert.ok(row, 'absen terbuka dari A ikut di bootstrap B');
  assert.equal(row.here, false);
  assert.equal(row.clockOut, null);
  assert.equal(Date.parse(row.clockIn), Date.parse(cin.deviceTime));
  const bootA = await http('GET', '/kiosk/bootstrap', { token: devA.token });
  assert.equal(bootA.body.today.find((t) => t.employeeId === crew.id).here, true);
  // walk-in (bukan roster C): identify menyertakan absen terbuka
  const { dev: devC } = await tabletOutlet(ctx, 'MC');
  const id = await http('POST', '/kiosk/identify', { token: devC.token, body: { photoBase64: FACE_A } });
  assert.equal(id.status, 201, JSON.stringify(id.body));
  assert.equal(id.body.employeeId, crew.id);
  assert.equal(id.body.today.length, 1);
  assert.equal(id.body.today[0].clockOut, null);
  assert.equal(id.body.today[0].here, false);
  const brk = ev(crew.id, 'BREAK_START', { agoMin: 30 });
  const out = ev(crew.id, 'CLOCK_OUT', { agoMin: 1 });
  const r = await postEvents(devB.token, [brk, out]);
  assert.deepEqual(r.body.results.map((x) => x.status), ['APPLIED', 'APPLIED'], JSON.stringify(r.body));
  const after = await http('GET', '/kiosk/bootstrap', { token: devB.token });
  assert.ok(after.body.today.find((t) => t.employeeId === crew.id).clockOut, 'sudah pulang');
}]);

checks.push(['bootstrap dikompres gzip bila diminta; embedding dibulatkan 5 desimal', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'GZ');
  const crew = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'Gzip');
  const emb = Array.from({ length: 1024 }, (_, i) => Math.sin(i + 0.123456789));
  sql(`insert into "FaceEnrollment"(id,"employeeId",embedding,"photoPath","enrolledById") values (gen_random_uuid(),'${crew.id}','{${emb.join(',')}}','x','x')`);
  const res = await fetch(`${API}/kiosk/bootstrap`, { headers: { Authorization: `Bearer ${dev.token}`, 'Accept-Encoding': 'gzip' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-encoding'), 'gzip');
  const body = await res.json();
  const got = body.roster.find((r) => r.employeeId === crew.id).embeddings[0];
  assert.equal(got.length, 1024);
  assert.ok(got.every((v, i) => v === Math.round(emb[i] * 1e5) / 1e5), 'dibulatkan 5 desimal');
  assert.ok(got.some((v) => String(v).split('.')[1]?.length === 5));
}]);

checks.push(['events: kru nonaktif -> NEEDS_REVIEW tidak diterapkan "Karyawan nonaktif"', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'NA');
  const crew = await enrolledCrew(ctx.admin, out.id);
  sql(`update "User" set "isActive"=false where id=(select "userId" from "EmployeeProfile" where id='${crew.id}')`);
  const e = ev(crew.id, 'CLOCK_IN');
  const r = await postEvents(dev.token, [e]);
  assert.deepEqual(r.body.results, [{ id: e.id, status: 'NEEDS_REVIEW', reason: 'Karyawan nonaktif' }]);
  assert.equal(eventRow(e.id).split('|').slice(0, 3).join('|'), 'NEEDS_REVIEW|false|Karyawan nonaktif');
  assert.equal(sql(`select count(*) from "Attendance" where "employeeId"='${crew.id}'`), '0');
}]);

checks.push(['tinjau: reject BREAK_START -> BREAK_END tablet untuk istirahat itu ikut REJECTED', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'RB');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const cin = ev(crew.id, 'CLOCK_IN', { agoMin: 120 });
  const bs = ev(crew.id, 'BREAK_START', { agoMin: 60, photo: FACE_B });
  const be = ev(crew.id, 'BREAK_END', { agoMin: 30 });
  const r = await postEvents(dev.token, [cin, bs, be]);
  assert.deepEqual(r.body.results.map((x) => x.status), ['APPLIED', 'NEEDS_REVIEW', 'APPLIED'], JSON.stringify(r.body));
  const rej = await review(ctx.admin, bs.id, 'reject');
  assert.equal(rej.status, 201, JSON.stringify(rej.body));
  assert.equal(eventRow(be.id).split('|').slice(0, 3).join('|'), 'REJECTED|true|Mulai istirahat ditolak');
  assert.equal(sql(`select "reviewedById" is not null from "AttendanceEvent" where id='${be.id}'`), 't');
  assert.equal(sql(`select count(*) from "AttendanceBreak" b join "Attendance" a on a.id=b."attendanceId" where a."employeeId"='${crew.id}'`), '0');
  assert.equal(eventRow(cin.id).split('|')[0], 'APPLIED', 'absen masuk tidak terpengaruh');
}]);

checks.push(['tinjau: reject CLOCK_IN pada baris yang sudah ada sebelum tablet -> baris tetap, jam masuk/pulang & istirahat dikosongkan', async (ctx) => {
  const { out, dev } = await tabletOutlet(ctx, 'RX');
  const crew = await enrolledCrew(ctx.admin, out.id);
  const existing = randomUUID();
  sql(`insert into "Attendance"(id,"employeeId","outletId",date,notes) values ('${existing}','${crew.id}','${out.id}','${jakartaYmd(0)}','dibuat koreksi')`);
  const cin = ev(crew.id, 'CLOCK_IN', { agoMin: 90, photo: FACE_B });
  const bs = ev(crew.id, 'BREAK_START', { agoMin: 60 });
  const r = await postEvents(dev.token, [cin, bs]);
  assert.deepEqual(r.body.results.map((x) => x.status), ['NEEDS_REVIEW', 'APPLIED'], JSON.stringify(r.body));
  assert.equal(sql(`select "createdAttendance"||'|'||"attendanceId" from "AttendanceEvent" where id='${cin.id}'`), `false|${existing}`);
  assert.equal((await review(ctx.admin, cin.id, 'reject')).status, 201);
  assert.equal(
    sql(`select ("clockInTime" is null)||'|'||("clockInPhotoUrl" is null)||'|'||("clockOutTime" is null)||'|'||status||'|'||notes from "Attendance" where id='${existing}'`),
    'true|true|true|ABSENT|dibuat koreksi',
  );
  assert.equal(sql(`select count(*) from "AttendanceBreak" where "attendanceId"='${existing}'`), '0');
  assert.ok(!attFlags(crew.id).includes('PENDING_REVIEW'));
  assert.equal(eventRow(bs.id).split('|')[0], 'REJECTED');
  // event yang membuat baris sendiri tercatat createdAttendance=true dan barisnya dihapus saat ditolak
  const crew2 = await enrolledCrew(ctx.admin, out.id);
  const c2 = ev(crew2.id, 'CLOCK_IN', { photo: FACE_B });
  await postEvents(dev.token, [c2]);
  assert.equal(sql(`select "createdAttendance" from "AttendanceEvent" where id='${c2.id}'`), 't');
  assert.equal((await review(ctx.admin, c2.id, 'reject')).status, 201);
  assert.equal(sql(`select count(*) from "Attendance" where "employeeId"='${crew2.id}'`), '0');
}]);

checks.push(['tablet: pengajuan cuti/izin diverifikasi wajah atau PIN; disetujui HR mengosongkan jadwal tanpa absen', async (ctx) => {
  const out = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}RQ`);
  const dev = await pairDevice(ctx.admin, out.id, 'Tablet Pengajuan');
  const crew = await enrolledCrew(ctx.admin, out.id, 'Wajah Cuti');
  const plain = await createCrew(ctx.admin, out.id, 'EMPLOYEE', 'Tanpa Wajah');
  const d1 = jakartaYmd(3), d2 = jakartaYmd(4), d3 = jakartaYmd(5);
  const ask = (body) => http('POST', '/kiosk/requests', { token: dev.token, body: { type: 'IZIN', startDate: d1, endDate: d3, reason: 'Acara keluarga', method: 'FACE_LOCAL', photoBase64: FACE_A, ...body } });

  assert.equal((await ask({ employeeId: crew.id, type: 'LEMBUR' })).status, 400, 'jenis di luar cuti/izin/sakit ditolak');
  assert.equal((await ask({ employeeId: crew.id, photoBase64: FACE_B })).status, 403, 'wajah lain ditolak');
  assert.equal((await ask({ employeeId: plain.id })).status, 400, 'belum daftar wajah -> pakai PIN');
  assert.equal((await ask({ employeeId: plain.id, method: 'PIN', pin: '000000' })).status, 403, 'tanpa PIN terdaftar ditolak');
  setPin(plain.id, '246810');
  const byPin = await ask({ employeeId: plain.id, method: 'PIN', pin: '246810', type: 'SAKIT', startDate: d1, endDate: d1 });
  assert.equal(byPin.status, 201, JSON.stringify(byPin.body));
  assert.equal(byPin.body.status, 'PENDING_STORE_MANAGER');

  const sched = await schedule(ctx.admin, [d1, d2, d3].map((date) => ({ employeeId: crew.id, date, working: true })));
  assert.equal(sched.status, 200, JSON.stringify(sched.body));
  // hari kedua sudah ada absen: jadwalnya tidak boleh hilang
  const s2 = sql(`select id from "ShiftSchedule" where "employeeId"='${crew.id}' and date='${d2}'`);
  sql(`insert into "Attendance"(id,"employeeId","outletId","scheduleId",date,status) values (gen_random_uuid(),'${crew.id}','${out.id}','${s2}','${d2}','PRESENT')`);
  const req = await ask({ employeeId: crew.id });
  assert.equal(req.status, 201, JSON.stringify(req.body));
  assert.equal((await http('PATCH', `/requests/${req.body.id}/store-manager-review`, { token: ctx.admin, body: { action: 'APPROVE' } })).status, 200);
  assert.equal(sql(`select count(*) from "ShiftSchedule" where "employeeId"='${crew.id}'`), '3', 'belum berubah sebelum HR');
  assert.equal((await http('PATCH', `/requests/${req.body.id}/hr-review`, { token: ctx.admin, body: { action: 'APPROVE' } })).status, 200);
  assert.equal(sql(`select string_agg(to_char(date,'YYYY-MM-DD'),',') from "ShiftSchedule" where "employeeId"='${crew.id}'`), d2);

  const boot = await http('GET', '/kiosk/bootstrap', { token: dev.token });
  const recap = boot.body.recap.find((r) => r.employeeId === crew.id);
  assert.equal(recap.requests[0].status, 'APPROVED');
  assert.equal(recap.requests[0].startDate, d1);
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
