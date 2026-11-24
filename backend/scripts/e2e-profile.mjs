// Uji impor/perbarui karyawan lewat Excel, data diri kru dan perubahan rekening.
// Jalankan seperti e2e-kiosk.mjs (E2E_API, E2E_ADMIN_USER, E2E_ADMIN_PASS, E2E_DATABASE_URL).
import assert from 'node:assert/strict';
import { createOutlet, http, sql } from './e2e-kiosk.mjs';

const [P1, P2] = sql(`select title from "Position" order by title`).split('\n');
assert.ok(P1 && P2, 'butuh minimal 2 jabatan dari seed');

let seq = 0;
const tag = () => `${Date.now().toString(36)}p${seq++}`;
const importRows = (admin, rows, dryRun) =>
  http('POST', '/employees/import', { token: admin, body: { rows: rows.map((r, i) => ({ ...r, excelRow: i + 2 })), dryRun } });
async function loginAs(username, password) {
  const r = await http('POST', '/auth/login', { body: { username, password } });
  assert.equal(r.status, 201, `login ${username} gagal`);
  return r.body.accessToken;
}
const employeeByNik = (admin, nik) => http('GET', '/employees', { token: admin }).then((r) => r.body.find((e) => e.nik === nik));

const checks = [];

checks.push(['impor: NIK baru dibuat lengkap, NIK lama hanya sel terisi yang berubah, baris sama = tidak berubah', async ({ admin, outlet, outlet2 }) => {
  const nik = `N${tag()}`;
  const fresh = {
    nik, fullName: 'Budi Impor', phone: '0811', outlet: outlet.code, position: P1, joinDate: '2026-02-01',
    birthDate: '1999-05-04', gender: 'L', address: 'Jl. Mawar 1', email: `${nik}@contoh.id`.toLowerCase(),
    bankName: 'BCA', bankAccountNumber: '123 456 7890', bankAccountHolder: 'Budi Impor', password: 'budi-pass-1',
  };
  const dry = await importRows(admin, [fresh], true);
  assert.equal(dry.status, 201, JSON.stringify(dry.body));
  assert.deepEqual([dry.body.saved, dry.body.summary], [false, { created: 1, updated: 0, unchanged: 0 }]);
  const saved = await importRows(admin, [fresh], false);
  assert.equal(saved.body.saved, true, JSON.stringify(saved.body));
  let e = await employeeByNik(admin, nik);
  assert.deepEqual(
    [e.gender, e.address, e.bankAccountNumber, e.birthDate.slice(0, 10), e.user.email, e.user.username],
    ['Laki-laki', 'Jl. Mawar 1', '1234567890', '1999-05-04', fresh.email, nik.toLowerCase()],
  );

  // Perbarui: alamat + cabang berubah, kolom lain kosong tidak menghapus
  const upd = await importRows(admin, [{ nik, address: 'Jl. Melati 2', outlet: outlet2.code, username: 'diabaikan' }], true);
  assert.deepEqual(upd.body.summary, { created: 0, updated: 1, unchanged: 0 });
  assert.equal(upd.body.rows[0].mode, 'update');
  assert.deepEqual(upd.body.rows[0].changed, [`Cabang → ${outlet2.name}`, 'Alamat']);
  assert.equal((await importRows(admin, [{ nik, address: 'Jl. Melati 2', outlet: outlet2.code }], false)).body.saved, true);
  e = await employeeByNik(admin, nik);
  assert.deepEqual([e.address, e.outletId, e.bankAccountNumber, e.phone, e.user.username], ['Jl. Melati 2', outlet2.id, '1234567890', '0811', nik.toLowerCase()]);

  const same = await importRows(admin, [{ nik, fullName: 'Budi Impor', gender: 'Laki-laki' }], true);
  assert.deepEqual(same.body.summary, { created: 0, updated: 0, unchanged: 1 });
}]);

checks.push(['impor: kesalahan per baris, NIK/email ganda, baris baru tanpa kolom wajib, tidak ada yang tersimpan', async ({ admin, outlet }) => {
  const a = `N${tag()}`;
  const b = `N${tag()}`;
  const mail = `${tag()}@contoh.id`;
  const r = await importRows(admin, [
    { nik: a, fullName: 'A', phone: '08', outlet: outlet.code, position: P1, joinDate: '2026-02-01', gender: 'X', birthDate: '04-05-1999' },
    { nik: a, fullName: 'A2', phone: '08', outlet: outlet.code, position: P1, joinDate: '2026-02-01' },
    { nik: b, fullName: 'B' },
    { nik: `N${tag()}`, fullName: 'C', phone: '08', outlet: outlet.code, position: P1, joinDate: '2026-02-01', email: mail },
    { nik: `N${tag()}`, fullName: 'D', phone: '08', outlet: outlet.code, position: P1, joinDate: '2026-02-01', email: mail, bankAccountNumber: '12ab' },
    { nik: `N${tag()}`, fullName: 'E', phone: '08', outlet: outlet.code, position: P1, joinDate: '2026-02-01', email: 'ADMIN-e2e@contoh.id' },
  ], false);
  assert.equal(r.body.saved, false);
  assert.equal(r.body.invalid, 5);
  const errs = r.body.rows.map((x) => x.errors.join(' | '));
  assert.match(errs[0], /Jenis kelamin "X"/);
  assert.match(errs[0], /Tanggal lahir harus berformat/);
  assert.match(errs[1], /NIK .* sama dengan baris 2/);
  assert.match(errs[2], /No HP wajib/);
  assert.match(errs[2], /Cabang wajib/);
  assert.deepEqual(r.body.rows[3].errors, []);
  assert.match(errs[4], /Email .* sama dengan baris 5/);
  assert.match(errs[4], /Nomor rekening/);
  assert.match(errs[5], /Email admin-e2e@contoh.id sudah dipakai akun lain/);
  assert.equal(await employeeByNik(admin, b), undefined, 'tidak ada yang tersimpan');
}]);

checks.push(['impor: HR tidak bisa mengubah akun admin, tapi baris admin yang tidak berubah lolos', async ({ admin, outlet }) => {
  const hrUser = `hr.${tag()}`;
  const hrNik = `H${tag()}`;
  await importRows(admin, [{ nik: hrNik, fullName: 'Admin HR Uji', phone: '08', outlet: outlet.code, position: P1, joinDate: '2026-01-01', role: 'Admin HR', username: hrUser, password: 'hr-pass-1234' }], false);
  const hr = await loginAs(hrUser, 'hr-pass-1234');
  const adminRow = await employeeByNik(admin, hrNik);
  assert.equal(adminRow.user.role, 'HR_ADMIN');
  const unchanged = await importRows(hr, [{ nik: hrNik, fullName: 'Admin HR Uji' }], true);
  assert.equal(unchanged.body.invalid, 0, JSON.stringify(unchanged.body.rows));
  const changed = await importRows(hr, [{ nik: hrNik, address: 'Jl. Baru 9' }], true);
  assert.match(changed.body.rows[0].errors.join(' '), /hanya bisa diubah Super Admin/);
  const ownRole = await importRows(hr, [{ nik: hrNik, role: 'Kru' }], true);
  assert.match(ownRole.body.rows[0].errors.join(' '), /akun Anda sendiri/);
}]);

checks.push(['data diri kru: wajib lengkap, validasi, data kepegawaian tidak bisa diubah, HR bisa mengoreksi', async ({ admin, outlet }) => {
  const nik = `K${tag()}`;
  await importRows(admin, [{ nik, fullName: 'Kru Data', phone: '0812', outlet: outlet.code, position: P1, joinDate: '2026-01-01', password: 'kru-pass-123' }], false);
  const crew = await loginAs(nik.toLowerCase(), 'kru-pass-123');
  const before = await http('GET', '/me/profile', { token: crew });
  assert.deepEqual([before.status, before.body.needsCompletion, before.body.outlet, before.body.bankChange], [200, true, outlet.name, null]);

  const good = { phone: '0812999', birthDate: '2000-01-31', gender: 'Perempuan', address: 'Jl. Kenanga 3', email: '' };
  assert.equal((await http('PUT', '/me/profile', { token: crew, body: { ...good, gender: 'X' } })).status, 400);
  assert.equal((await http('PUT', '/me/profile', { token: crew, body: { ...good, birthDate: '2099-01-01' } })).status, 400);
  assert.equal((await http('PUT', '/me/profile', { token: crew, body: { ...good, outletId: outlet.id } })).status, 400, 'field kepegawaian ditolak');
  assert.equal((await http('PUT', '/me/profile', { token: crew, body: { ...good, email: 'admin-e2e@contoh.id' } })).status, 409, 'email akun lain');
  const after = await http('PUT', '/me/profile', { token: crew, body: good });
  assert.equal(after.status, 200, JSON.stringify(after.body));
  assert.deepEqual([after.body.needsCompletion, after.body.birthDate, after.body.phone, after.body.email], [false, '2000-01-31', '0812999', null]);

  const e = await employeeByNik(admin, nik);
  const put = await http('PUT', `/employees/${e.id}`, { token: admin, body: { address: 'Koreksi HR', gender: '', email: `${nik.toLowerCase()}@contoh.id` } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const fixed = (await http('GET', '/me/profile', { token: crew })).body;
  assert.deepEqual([fixed.address, fixed.gender, fixed.needsCompletion, fixed.email], ['Koreksi HR', null, true, `${nik.toLowerCase()}@contoh.id`]);
}]);

checks.push(['rekening: kru mengajukan, rekening lama tetap, HR menolak dengan alasan lalu menyetujui, tidak bisa diproses dua kali', async ({ admin, outlet }) => {
  const nik = `R${tag()}`;
  await importRows(admin, [{ nik, fullName: 'Kru Rekening', phone: '08', outlet: outlet.code, position: P1, joinDate: '2026-01-01', password: 'kru-pass-123', bankName: 'BRI', bankAccountNumber: '11111', bankAccountHolder: 'Kru Rekening' }], false);
  const crew = await loginAs(nik.toLowerCase(), 'kru-pass-123');
  const body = { bankName: 'BCA', bankAccountNumber: '22222-333', bankAccountHolder: 'Kru Rekening' };
  assert.equal((await http('POST', '/me/profile/bank-change', { token: crew, body: { ...body, bankAccountNumber: '12' } })).status, 400);
  let me = await http('POST', '/me/profile/bank-change', { token: crew, body });
  assert.equal(me.status, 201, JSON.stringify(me.body));
  me = await http('POST', '/me/profile/bank-change', { token: crew, body: { ...body, bankAccountNumber: '22222333' } });
  assert.deepEqual([me.body.bankChange.status, me.body.bank.bankAccountNumber], ['PENDING', '11111'], 'rekening lama tetap');
  assert.equal((await http('GET', '/bank-changes?status=PENDING', { token: crew })).status, 403, 'kru tidak bisa menyetujui');
  const pending = (await http('GET', '/bank-changes?status=PENDING', { token: admin })).body.filter((c) => c.employee.nik === nik);
  assert.equal(pending.length, 1, 'pengajuan kedua menggantikan yang pertama');
  assert.equal(pending[0].employee.bankAccountNumber, '11111');

  assert.equal((await http('POST', `/bank-changes/${pending[0].id}/reject`, { token: admin, body: { note: 'x' } })).status, 400, 'alasan wajib');
  assert.equal((await http('POST', `/bank-changes/${pending[0].id}/reject`, { token: admin, body: { note: 'Nama pemilik harus sesuai KTP' } })).status, 201);
  me = await http('GET', '/me/profile', { token: crew });
  assert.deepEqual([me.body.bankChange.status, me.body.bankChange.note, me.body.bank.bankAccountNumber], ['REJECTED', 'Nama pemilik harus sesuai KTP', '11111']);
  assert.equal((await http('POST', `/bank-changes/${pending[0].id}/approve`, { token: admin })).status, 409, 'sudah ditolak');

  await http('POST', '/me/profile/bank-change', { token: crew, body });
  const cancel = await http('DELETE', '/me/profile/bank-change', { token: crew });
  assert.equal(cancel.body.bankChange.status, 'REJECTED', 'yang menunggu dibatalkan, riwayat tetap');

  await http('POST', '/me/profile/bank-change', { token: crew, body });
  const second = (await http('GET', '/bank-changes?status=PENDING', { token: admin })).body.find((c) => c.employee.nik === nik);
  const [a, b] = await Promise.all([
    http('POST', `/bank-changes/${second.id}/approve`, { token: admin }),
    http('POST', `/bank-changes/${second.id}/approve`, { token: admin }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409], 'hanya satu persetujuan');
  me = await http('GET', '/me/profile', { token: crew });
  assert.deepEqual([me.body.bank.bankName, me.body.bank.bankAccountNumber, me.body.bankChange.status], ['BCA', '22222333', 'APPROVED']);
}]);

const login = await http('POST', '/auth/login', { body: { username: process.env.E2E_ADMIN_USER, password: process.env.E2E_ADMIN_PASS } });
assert.equal(login.status, 201);
const ctx = { admin: login.body.accessToken };
// Email akun admin seed dipakai untuk uji email ganda
sql(`update "User" set email = 'admin-e2e@contoh.id' where username = '${process.env.E2E_ADMIN_USER}'`);
const suffix = Date.now().toString(36).toUpperCase();
ctx.outlet = await createOutlet(ctx.admin, `${suffix}PA`);
ctx.outlet2 = await createOutlet(ctx.admin, `${suffix}PB`);
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
