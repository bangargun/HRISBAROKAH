// Uji API Surat & Kontrak. Jalankan seperti e2e-kiosk.mjs (E2E_API, E2E_ADMIN_USER, E2E_ADMIN_PASS, E2E_DATABASE_URL).
import assert from 'node:assert/strict';
import { createOutlet, http, sql } from './e2e-kiosk.mjs';

let seq = 0;
async function createPerson(admin, outletId, role, name) {
  const positionId = sql(`select id from "Position" order by title limit 1`);
  const tag = `${Date.now().toString(36)}l${seq++}`;
  const username = `lg.${tag}`;
  const r = await http('POST', '/employees', {
    token: admin,
    body: { username, password: 'lg-pass-1234', role, nik: `L${tag}`, fullName: `${name} ${tag}`, phone: '0800', outletId, positionId, joinDate: '2026-01-01' },
  });
  assert.equal(r.status, 201, `buat akun gagal: ${JSON.stringify(r.body)}`);
  const login = await http('POST', '/auth/login', { body: { username, password: 'lg-pass-1234' } });
  return { profileId: r.body.id, positionId, token: login.body.accessToken };
}

const jakarta = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
const today = jakarta();
const future = jakarta(new Date(Date.now() + 10 * 86400_000));
const base = { title: 'Uji', effectiveDate: today, signatoryName: 'Direktur', signatoryRole: 'Direktur Operasional', contentBody: 'Isi surat uji.' };
const issue = (token, body) => http('POST', '/legal-docs', { token, body: { ...base, ...body } });
const profile = (id) => sql(`select "outletId"||'|'||"positionId"||'|'||status from "EmployeeProfile" where id='${id}'`);

const checks = [];

checks.push(['nomor otomatis berurutan dan unik walau terbit serentak', async ({ admin, outlet }) => {
  const crew = await createPerson(admin, outlet.id, 'EMPLOYEE', 'Kru');
  const res = await Promise.all(
    Array.from({ length: 5 }, () => issue(admin, { docType: 'SK_PENYESUAIAN_GAJI', employeeId: crew.profileId, salaryAmount: 2500000 })),
  );
  assert.ok(res.every((r) => r.status === 201), JSON.stringify(res.map((r) => r.body)));
  const nums = res.map((r) => r.body.docNumber);
  assert.equal(new Set(nums).size, 5);
  assert.ok(nums.every((n) => /^\d{3}\/SK-GAJI\/HR-BKN\/[IVX]+\/\d{4}$/.test(n)), nums.join(','));
  assert.equal(res[0].body.employeeName.startsWith('Kru'), true);
  assert.equal(res[0].body.category, 'SK');
}]);

checks.push(['SK Mutasi: terapkan mengubah cabang sekali saja; tidak bisa dibatalkan setelahnya', async ({ admin, outlet }) => {
  const dest = await createOutlet(admin, `${Date.now().toString(36).toUpperCase()}LD`);
  const crew = await createPerson(admin, outlet.id, 'EMPLOYEE', 'Kru');
  assert.equal((await issue(admin, { docType: 'SK_MUTASI', employeeId: crew.profileId })).status, 400, 'tanpa cabang tujuan ditolak');
  assert.equal((await issue(admin, { docType: 'SK_MUTASI', employeeId: crew.profileId, targetOutletId: outlet.id })).status, 400, 'cabang sama ditolak');
  const doc = (await issue(admin, { docType: 'SK_MUTASI', employeeId: crew.profileId, targetOutletId: dest.id })).body;
  const [a, b] = await Promise.all([http('POST', `/legal-docs/${doc.id}/apply`, { token: admin }), http('POST', `/legal-docs/${doc.id}/apply`, { token: admin })]);
  assert.deepEqual([a.status, b.status].sort(), [201, 400]);
  assert.equal(profile(crew.profileId).split('|')[0], dest.id);
  assert.equal((await http('POST', `/legal-docs/${doc.id}/cancel`, { token: admin, body: { reason: 'salah' } })).status, 400);
}]);

checks.push(['tanggal berlaku di masa depan belum bisa diterapkan; PKWT wajib tanggal akhir dan set status Kontrak', async ({ admin, outlet }) => {
  const crew = await createPerson(admin, outlet.id, 'EMPLOYEE', 'Kru');
  assert.equal((await issue(admin, { docType: 'PKWT_KRU', employeeId: crew.profileId })).status, 400);
  assert.equal((await issue(admin, { docType: 'PKWT_KRU', employeeId: crew.profileId, expiredDate: today })).status, 400, 'akhir = mulai ditolak');
  const later = (await issue(admin, { docType: 'PKWT_KRU', employeeId: crew.profileId, effectiveDate: future, expiredDate: '2027-12-31' })).body;
  const early = await http('POST', `/legal-docs/${later.id}/apply`, { token: admin });
  assert.equal(early.status, 400);
  assert.match(early.body.message, /baru bisa diterapkan mulai/);
  const now = (await issue(admin, { docType: 'PKWT_KRU', employeeId: crew.profileId, expiredDate: '2027-12-31' })).body;
  assert.equal((await http('POST', `/legal-docs/${now.id}/apply`, { token: admin })).status, 201);
  assert.equal(profile(crew.profileId).split('|')[2], 'CONTRACT');
}]);

checks.push(['batalkan wajib alasan; surat batal tidak bisa diterapkan; edaran tanpa karyawan', async ({ admin, outlet }) => {
  const crew = await createPerson(admin, outlet.id, 'EMPLOYEE', 'Kru');
  const otherPos = sql(`select id from "Position" order by title desc limit 1`);
  const promo = (await issue(admin, { docType: 'SK_PROMOSI', employeeId: crew.profileId, targetPositionId: otherPos })).body;
  assert.equal((await http('POST', `/legal-docs/${promo.id}/cancel`, { token: admin, body: { reason: '  ' } })).status, 400);
  const c = await http('POST', `/legal-docs/${promo.id}/cancel`, { token: admin, body: { reason: 'Jabatan salah pilih' } });
  assert.equal(c.status, 201);
  assert.equal(c.body.status, 'CANCELLED');
  assert.equal((await http('POST', `/legal-docs/${promo.id}/apply`, { token: admin })).status, 400);
  assert.equal(profile(crew.profileId).split('|')[1], crew.positionId, 'jabatan tidak berubah');
  const se = await issue(admin, { docType: 'SE_CUSTOM', audience: 'Seluruh kru', subject: 'Kebersihan', employeeId: crew.profileId });
  assert.equal(se.status, 201);
  assert.equal(se.body.employeeId, null, 'edaran tidak terikat karyawan');
  assert.equal(se.body.category, 'EDARAN');
  assert.equal((await http('POST', `/legal-docs/${se.body.id}/apply`, { token: admin })).status, 400);
}]);

checks.push(['Kepala Cabang: lihat surat cabangnya + edaran, tidak bisa terbit/terapkan; kru ditolak', async ({ admin, outlet }) => {
  const other = await createOutlet(admin, `${Date.now().toString(36).toUpperCase()}LO`);
  const sm = await createPerson(admin, outlet.id, 'STORE_MANAGER', 'SM');
  const own = await createPerson(admin, outlet.id, 'EMPLOYEE', 'Kru');
  const foreign = await createPerson(admin, other.id, 'EMPLOYEE', 'Kru Lain');
  const ownDoc = (await issue(admin, { docType: 'SK_PENGANGKATAN', employeeId: own.profileId })).body;
  const foreignDoc = (await issue(admin, { docType: 'SK_PENGANGKATAN', employeeId: foreign.profileId })).body;
  await issue(admin, { docType: 'SE_KUOTA_LIBUR', audience: 'Semua', subject: 'Kuota' });
  const list = await http('GET', `/legal-docs?outletId=${other.id}`, { token: sm.token });
  assert.equal(list.status, 200);
  const ids = list.body.map((d) => d.id);
  assert.ok(ids.includes(ownDoc.id));
  assert.ok(!ids.includes(foreignDoc.id));
  assert.ok(list.body.some((d) => d.category === 'EDARAN'));
  assert.equal((await issue(sm.token, { docType: 'SE_CUSTOM', audience: 'x', subject: 'y' })).status, 403);
  assert.equal((await http('POST', `/legal-docs/${ownDoc.id}/apply`, { token: sm.token })).status, 403);
  assert.equal((await http('GET', '/legal-docs', { token: own.token })).status, 403);
}]);

const login = await http('POST', '/auth/login', { body: { username: process.env.E2E_ADMIN_USER, password: process.env.E2E_ADMIN_PASS } });
assert.equal(login.status, 201);
const ctx = { admin: login.body.accessToken };
ctx.outlet = await createOutlet(ctx.admin, `${Date.now().toString(36).toUpperCase()}LG`);
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
