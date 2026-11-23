// Uji API Pendampingan. Jalankan seperti e2e-kiosk.mjs (E2E_API, E2E_ADMIN_USER, E2E_ADMIN_PASS, E2E_DATABASE_URL).
import assert from 'node:assert/strict';
import { createOutlet, http, sql } from './e2e-kiosk.mjs';

let seq = 0;
async function createPerson(admin, outletId, role, name) {
  const positionId = sql(`select id from "Position" limit 1`);
  const tag = `${Date.now().toString(36)}c${seq++}`;
  const username = `co.${tag}`;
  const r = await http('POST', '/employees', {
    token: admin,
    body: { username, password: 'co-pass-1234', role, nik: `C${tag}`, fullName: `${name} ${tag}`, phone: '0800', outletId, positionId, joinDate: '2026-01-01' },
  });
  assert.equal(r.status, 201, `buat akun gagal: ${JSON.stringify(r.body)}`);
  const login = await http('POST', '/auth/login', { body: { username, password: 'co-pass-1234' } });
  assert.equal(login.status, 201);
  const me = await http('GET', '/auth/me', { token: login.body.accessToken });
  return { profileId: r.body.id, userId: me.body.id, token: login.body.accessToken };
}

const checks = [];

checks.push(['buat, mulai, selesai dengan catatan; status akhir terkunci', async ({ admin, outlet }) => {
  const crew = await createPerson(admin, outlet.id, 'EMPLOYEE', 'Kru');
  const create = await http('POST', '/coaching', {
    token: admin,
    body: { employeeId: crew.profileId, topic: 'Gramatur sambal', scheduledDate: '2026-12-01', priority: 'HIGH' },
  });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const s = create.body;
  assert.equal(s.status, 'PLANNED');
  assert.equal(s.outlet.id, outlet.id);
  assert.ok(s.coach.id, 'pendamping default = pembuat');

  const noNote = await http('PATCH', `/coaching/${s.id}/status`, { token: admin, body: { status: 'DONE' } });
  assert.equal(noNote.status, 400);
  assert.equal((await http('PATCH', `/coaching/${s.id}/status`, { token: admin, body: { status: 'IN_PROGRESS' } })).status, 200);
  assert.equal((await http('PATCH', `/coaching/${s.id}/status`, { token: admin, body: { status: 'IN_PROGRESS' } })).status, 400);
  const done = await http('PATCH', `/coaching/${s.id}/status`, {
    token: admin,
    body: { status: 'DONE', resultNote: 'Takaran sudah sesuai SOP, cek ulang minggu depan' },
  });
  assert.equal(done.status, 200);
  assert.equal(done.body.status, 'DONE');
  assert.ok(done.body.completedAt && done.body.startedAt);
  assert.equal((await http('PATCH', `/coaching/${s.id}/status`, { token: admin, body: { status: 'CANCELLED' } })).status, 400);
  assert.equal(
    (await http('PUT', `/coaching/${s.id}`, { token: admin, body: { topic: 'x', scheduledDate: '2026-12-02', priority: 'NORMAL', coachId: s.coach.id } })).status,
    400,
  );
}]);

checks.push(['validasi: tanggal, prioritas, karyawan, pendamping kru ditolak', async ({ admin, outlet }) => {
  const crew = await createPerson(admin, outlet.id, 'EMPLOYEE', 'Kru');
  const base = { employeeId: crew.profileId, topic: 'Layanan meja', scheduledDate: '2026-12-01', priority: 'NORMAL' };
  assert.equal((await http('POST', '/coaching', { token: admin, body: { ...base, scheduledDate: '01-12-2026' } })).status, 400);
  assert.equal((await http('POST', '/coaching', { token: admin, body: { ...base, priority: 'URGENT' } })).status, 400);
  assert.equal((await http('POST', '/coaching', { token: admin, body: { ...base, topic: '  ' } })).status, 400);
  assert.equal(
    (await http('POST', '/coaching', { token: admin, body: { ...base, employeeId: '00000000-0000-4000-8000-000000000000' } })).status,
    404,
  );
  assert.equal((await http('POST', '/coaching', { token: admin, body: { ...base, coachId: crew.userId } })).status, 400);
}]);

checks.push(['Kepala Cabang: hanya cabang sendiri, hanya dirinya sebagai pendamping; kru ditolak', async ({ admin, outlet }) => {
  const other = await createOutlet(admin, `${Date.now().toString(36).toUpperCase()}CO`);
  const sm = await createPerson(admin, outlet.id, 'STORE_MANAGER', 'SM');
  const own = await createPerson(admin, outlet.id, 'EMPLOYEE', 'Kru');
  const foreign = await createPerson(admin, other.id, 'EMPLOYEE', 'Kru Lain');
  const body = (employeeId, extra = {}) => ({ employeeId, topic: 'Kebersihan dapur', scheduledDate: '2026-12-03', priority: 'MEDIUM', ...extra });

  const mine = await http('POST', '/coaching', { token: sm.token, body: body(own.profileId) });
  assert.equal(mine.status, 201);
  assert.equal(mine.body.coach.id, sm.userId);
  assert.equal((await http('POST', '/coaching', { token: sm.token, body: body(foreign.profileId) })).status, 403);
  const adminMe = await http('GET', '/auth/me', { token: admin });
  assert.equal((await http('POST', '/coaching', { token: sm.token, body: body(own.profileId, { coachId: adminMe.body.id }) })).status, 403);

  const foreignSession = await http('POST', '/coaching', { token: admin, body: body(foreign.profileId) });
  assert.equal(foreignSession.status, 201);
  const list = await http('GET', `/coaching?outletId=${other.id}`, { token: sm.token });
  assert.equal(list.status, 200);
  assert.ok(list.body.every((x) => x.outlet.id === outlet.id), 'Kepala Cabang hanya melihat cabangnya');
  assert.equal((await http('PATCH', `/coaching/${foreignSession.body.id}/status`, { token: sm.token, body: { status: 'CANCELLED' } })).status, 403);
  const coaches = await http('GET', '/coaching/coaches', { token: sm.token });
  assert.deepEqual(coaches.body.map((c) => c.id), [sm.userId]);

  assert.equal((await http('GET', '/coaching', { token: own.token })).status, 403);
}]);

checks.push(['dua pengubah status serentak: hanya satu yang berhasil', async ({ admin, outlet }) => {
  const crew = await createPerson(admin, outlet.id, 'EMPLOYEE', 'Kru');
  const s = (await http('POST', '/coaching', {
    token: admin,
    body: { employeeId: crew.profileId, topic: 'Kecepatan saji', scheduledDate: '2026-12-04', priority: 'NORMAL' },
  })).body;
  const results = await Promise.all([
    http('PATCH', `/coaching/${s.id}/status`, { token: admin, body: { status: 'CANCELLED' } }),
    http('PATCH', `/coaching/${s.id}/status`, { token: admin, body: { status: 'IN_PROGRESS' } }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
}]);

const login = await http('POST', '/auth/login', { body: { username: process.env.E2E_ADMIN_USER, password: process.env.E2E_ADMIN_PASS } });
assert.equal(login.status, 201);
const ctx = { admin: login.body.accessToken };
ctx.outlet = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}CM`);
let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn(ctx);
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} :: ${String(e.message).split('\n')[0]}`);
  }
}
process.exit(failed ? 1 : 0);
