// Uji API Pelatihan. Jalankan seperti e2e-kiosk.mjs (E2E_API, E2E_ADMIN_USER, E2E_ADMIN_PASS, E2E_DATABASE_URL).
import assert from 'node:assert/strict';
import { createOutlet, http, sql } from './e2e-kiosk.mjs';

const positions = sql(`select id from "Position" order by title`).split('\n');
assert.ok(positions.length >= 2, 'butuh minimal 2 jabatan dari seed');
const [P1, P2] = positions;

let seq = 0;
async function person(admin, outletId, { role = 'EMPLOYEE', positionId = P1, name = 'Kru' } = {}) {
  const tag = `${Date.now().toString(36)}t${seq++}`;
  const username = `tr.${tag}`;
  const r = await http('POST', '/employees', {
    token: admin,
    body: { username, password: 'tr-pass-1234', role, nik: `T${tag}`, fullName: `${name} ${tag}`, phone: '0800', outletId, positionId, joinDate: '2026-01-01' },
  });
  assert.equal(r.status, 201, `buat akun gagal: ${JSON.stringify(r.body)}`);
  const login = await http('POST', '/auth/login', { body: { username, password: 'tr-pass-1234' } });
  return { id: r.body.id, token: login.body.accessToken };
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const code = () => `M${Date.now().toString(36).toUpperCase()}${seq++}`.slice(0, 20);
const QUESTIONS = [
  { prompt: 'Suhu chiller?', options: ['0-4 C', '10-15 C'], correctIndex: 0 },
  { prompt: 'Cuci tangan berapa detik?', options: ['5', '20', '60'], correctIndex: 1 },
];
const moduleBody = (extra = {}) => ({
  code: code(),
  title: 'Higiene dasar',
  category: 'HYGIENE_HACCP',
  content: 'Isi materi higiene.',
  passingScore: 50,
  targetPositionIds: [P1],
  questions: QUESTIONS,
  ...extra,
});

const checks = [];

checks.push(['modul: kru sasaran melihat tanpa kunci jawaban, ulang sampai lulus, nomor sertifikat, lalu ditutup', async ({ admin, outlet }) => {
  const created = await http('POST', '/training/modules', { token: admin, body: moduleBody() });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const m = created.body;
  const crew = await person(admin, outlet.id);
  const other = await person(admin, outlet.id, { positionId: P2 });
  assert.equal((await http('GET', '/training/my/modules', { token: crew.token })).body.length, 0, 'belum terbit tidak terlihat');
  assert.equal((await http('PATCH', `/training/modules/${m.id}/publish`, { token: admin, body: { isPublished: true } })).status, 200);

  const list = await http('GET', '/training/my/modules', { token: crew.token });
  assert.deepEqual(list.body.map((x) => x.id), [m.id]);
  assert.equal((await http('GET', '/training/my/modules', { token: other.token })).body.length, 0, 'jabatan lain tidak melihat');
  const detail = await http('GET', `/training/my/modules/${m.id}`, { token: crew.token });
  assert.equal(detail.body.questions.length, 2);
  assert.ok(!JSON.stringify(detail.body).includes('correctIndex'), 'kunci jawaban tidak dikirim');

  assert.equal((await http('POST', `/training/my/modules/${m.id}/attempts`, { token: crew.token, body: { answers: [1] } })).status, 400, 'jawaban kurang ditolak');
  const fail = await http('POST', `/training/my/modules/${m.id}/attempts`, { token: crew.token, body: { answers: [1, 0] } });
  assert.equal(fail.status, 201);
  assert.deepEqual([fail.body.score, fail.body.passed, fail.body.result.attempts], [0, false, 1]);
  const pass = await http('POST', `/training/my/modules/${m.id}/attempts`, { token: crew.token, body: { answers: [0, 0] } });
  assert.deepEqual([pass.body.score, pass.body.passed, pass.body.result.attempts, pass.body.result.bestScore], [50, true, 2, 50]);
  assert.equal(pass.body.result.certificateNo, `${m.code}-0001`);
  assert.equal((await http('POST', `/training/my/modules/${m.id}/attempts`, { token: crew.token, body: { answers: [0, 1] } })).status, 400, 'sudah lulus');
  assert.equal((await http('GET', `/training/my/modules/${m.id}`, { token: crew.token })).body.questions.length, 0, 'soal ditutup setelah lulus');
  assert.equal((await http('POST', `/training/my/modules/${m.id}/attempts`, { token: other.token, body: { answers: [0, 1] } })).status, 404);
}]);

checks.push(['modul: validasi, kode ganda, soal terkunci setelah ada hasil, tidak bisa dihapus, kru ditolak', async ({ admin, outlet }) => {
  assert.equal((await http('POST', '/training/modules', { token: admin, body: moduleBody({ questions: [{ prompt: 'x', options: ['a', 'b'], correctIndex: 5 }] }) })).status, 400);
  assert.equal((await http('POST', '/training/modules', { token: admin, body: moduleBody({ code: 'kecil' }) })).status, 400);
  const first = (await http('POST', '/training/modules', { token: admin, body: moduleBody() })).body;
  assert.equal((await http('POST', '/training/modules', { token: admin, body: moduleBody({ code: first.code }) })).status, 409);
  const empty = (await http('POST', '/training/modules', { token: admin, body: moduleBody({ questions: undefined }) })).body;
  assert.equal((await http('PATCH', `/training/modules/${empty.id}/publish`, { token: admin, body: { isPublished: true } })).status, 400, 'tanpa soal tidak bisa terbit');
  assert.equal((await http('DELETE', `/training/modules/${empty.id}`, { token: admin })).status, 200);

  await http('PATCH', `/training/modules/${first.id}/publish`, { token: admin, body: { isPublished: true } });
  const crew = await person(admin, outlet.id);
  await http('POST', `/training/my/modules/${first.id}/attempts`, { token: crew.token, body: { answers: [1, 0] } });
  const body = moduleBody({ code: first.code, content: 'Materi diperbarui' });
  assert.equal((await http('PUT', `/training/modules/${first.id}`, { token: admin, body })).status, 400, 'soal terkunci');
  const { questions, ...noQuestions } = body;
  assert.equal((await http('PUT', `/training/modules/${first.id}`, { token: admin, body: noQuestions })).status, 200, 'materi tetap bisa diubah');
  assert.equal((await http('DELETE', `/training/modules/${first.id}`, { token: admin })).status, 400);
  assert.equal((await http('POST', '/training/modules', { token: crew.token, body: moduleBody() })).status, 403);
  const results = await http('GET', `/training/modules/${first.id}/results`, { token: admin });
  const row = results.body.find((r) => r.id === crew.id);
  assert.equal(row.result.attempts, 1);
}]);

checks.push(['sertifikat: dua kru lulus bersamaan mendapat nomor berbeda; Kepala Cabang hanya cabangnya', async ({ admin, outlet }) => {
  const other = await createOutlet(admin, `${Date.now().toString(36).toUpperCase()}TC`);
  const m = (await http('POST', '/training/modules', { token: admin, body: moduleBody({ targetPositionIds: [] }) })).body;
  await http('PATCH', `/training/modules/${m.id}/publish`, { token: admin, body: { isPublished: true } });
  const a = await person(admin, outlet.id);
  const b = await person(admin, other.id);
  const res = await Promise.all([a, b].map((c) => http('POST', `/training/my/modules/${m.id}/attempts`, { token: c.token, body: { answers: [0, 1] } })));
  assert.ok(res.every((r) => r.status === 201), JSON.stringify(res.map((r) => r.body)));
  assert.deepEqual(res.map((r) => r.body.result.certificateNo).sort(), [`${m.code}-0001`, `${m.code}-0002`]);
  const sm = await person(admin, outlet.id, { role: 'STORE_MANAGER', name: 'SM' });
  const certs = await http('GET', `/training/certificates?moduleId=${m.id}&outletId=${other.id}`, { token: sm.token });
  assert.equal(certs.status, 200);
  assert.deepEqual(certs.body.map((c) => c.employee.id), [a.id]);
}]);

checks.push(['kuis mingguan: terkunci setelah terbit, sekali saja, ditolak setelah tenggat, hasil per cabang', async ({ admin, outlet }) => {
  const quiz = (await http('POST', '/training/quizzes', {
    token: admin,
    body: { title: 'Kuis minggu ini', weekStart: today, deadline: today, passingScore: 100, targetPositionIds: [P1], questions: QUESTIONS },
  })).body;
  assert.equal((await http('POST', '/training/quizzes', { token: admin, body: { title: 'x', weekStart: today, deadline: '2020-01-01', questions: QUESTIONS } })).status, 400);
  const crew = await person(admin, outlet.id);
  const late = await person(admin, outlet.id);
  assert.equal((await http('GET', '/training/my/quizzes', { token: crew.token })).body.length, 0);
  assert.equal((await http('PATCH', `/training/quizzes/${quiz.id}/publish`, { token: admin, body: { isPublished: true } })).status, 200);
  assert.equal((await http('PUT', `/training/quizzes/${quiz.id}`, { token: admin, body: { title: 'ubah', weekStart: today, deadline: today, questions: QUESTIONS } })).status, 400);
  assert.equal((await http('PATCH', `/training/quizzes/${quiz.id}/publish`, { token: admin, body: { isPublished: false } })).status, 400);

  const mine = await http('GET', '/training/my/quizzes', { token: crew.token });
  assert.equal(mine.body[0].open, true);
  const q = await http('GET', `/training/my/quizzes/${quiz.id}`, { token: crew.token });
  assert.ok(!JSON.stringify(q.body).includes('correctIndex'));
  const sub = await http('POST', `/training/my/quizzes/${quiz.id}/attempts`, { token: crew.token, body: { answers: [0, 0] } });
  assert.deepEqual([sub.status, sub.body.score, sub.body.passed], [201, 50, false]);
  assert.equal((await http('POST', `/training/my/quizzes/${quiz.id}/attempts`, { token: crew.token, body: { answers: [0, 1] } })).status, 409);

  sql(`update "WeeklyQuiz" set deadline='2020-01-01' where id='${quiz.id}'`);
  assert.equal((await http('POST', `/training/my/quizzes/${quiz.id}/attempts`, { token: late.token, body: { answers: [0, 1] } })).status, 400);
  const results = await http('GET', `/training/quizzes/${quiz.id}/results?outletId=${outlet.id}`, { token: admin });
  const states = Object.fromEntries(results.body.rows.map((r) => [r.id, r.state]));
  assert.equal(states[crew.id], 'DONE');
  assert.equal(states[late.id], 'MISSED');
  const o = results.body.outlets.find((x) => x.outletName === outlet.name);
  assert.equal(o.averageScore, 50);
}]);

checks.push(['jadwal: validasi, Kepala Cabang catat hadir hanya kru cabangnya, selesai wajib daftar hadir lengkap', async ({ admin, outlet }) => {
  const other = await createOutlet(admin, `${Date.now().toString(36).toUpperCase()}TS`);
  const a = await person(admin, outlet.id);
  const b = await person(admin, other.id);
  const sm = await person(admin, outlet.id, { role: 'STORE_MANAGER', name: 'SM' });
  const base = { title: 'Praktek higiene', date: today, startTime: '09:00', endTime: '11:00', mode: 'OFFLINE', trainerName: 'Coach', participantIds: [a.id, b.id] };
  assert.equal((await http('POST', '/training/sessions', { token: admin, body: base })).status, 400, 'offline tanpa lokasi');
  assert.equal((await http('POST', '/training/sessions', { token: admin, body: { ...base, location: 'Dapur', endTime: '08:00' } })).status, 400);
  const s = (await http('POST', '/training/sessions', { token: admin, body: { ...base, location: 'Dapur pusat' } })).body;
  assert.equal(s.participants.length, 2);

  const smList = await http('GET', '/training/sessions', { token: sm.token });
  assert.ok(smList.body.some((x) => x.id === s.id));
  assert.equal((await http('PATCH', `/training/sessions/${s.id}/attendance`, { token: sm.token, body: { entries: [{ employeeId: b.id, attended: true }] } })).status, 403);
  assert.equal((await http('PATCH', `/training/sessions/${s.id}/attendance`, { token: sm.token, body: { entries: [{ employeeId: a.id, attended: true }] } })).status, 200);
  assert.equal((await http('PATCH', `/training/sessions/${s.id}/status`, { token: admin, body: { status: 'DONE' } })).status, 400, 'belum lengkap');
  await http('PATCH', `/training/sessions/${s.id}/attendance`, { token: admin, body: { entries: [{ employeeId: b.id, attended: false }] } });
  assert.equal((await http('PATCH', `/training/sessions/${s.id}/status`, { token: admin, body: { status: 'DONE' } })).status, 200);
  assert.equal((await http('PUT', `/training/sessions/${s.id}`, { token: admin, body: { ...base, location: 'x' } })).status, 400, 'sesi selesai terkunci');

  const mine = await http('GET', '/training/my/sessions', { token: a.token });
  const row = mine.body.find((x) => x.id === s.id);
  assert.deepEqual([row.attended, row.status], [true, 'DONE']);
}]);

const login = await http('POST', '/auth/login', { body: { username: process.env.E2E_ADMIN_USER, password: process.env.E2E_ADMIN_PASS } });
assert.equal(login.status, 201);
const ctx = { admin: login.body.accessToken };
ctx.outlet = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}TR`);
let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn(ctx);
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} :: ${String(e.message).split('\n')[0]} ${e.actual !== undefined ? `(actual=${JSON.stringify(e.actual)} expected=${JSON.stringify(e.expected)})` : ''}`);
  }
}
process.exit(failed ? 1 : 0);
