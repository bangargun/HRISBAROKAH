// Uji notifikasi Telegram dengan server Telegram palsu di port 3199.
// Backend harus dijalankan dengan TELEGRAM_BOT_TOKEN, TELEGRAM_API_BASE=http://127.0.0.1:3199,
// TELEGRAM_WEBHOOK_SECRET=e2e-webhook-secret dan APP_PUBLIC_URL (deploy/check.sh mengaturnya).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createOutlet, http, sql } from './e2e-kiosk.mjs';

const SECRET = 'e2e-webhook-secret';
if (!process.env.E2E_TELEGRAM) {
  console.log('Lewati: jalankan lewat deploy/check.sh (butuh backend dengan Telegram palsu)');
  process.exit(0);
}

// ---------- Telegram palsu ----------
const sent = [];
const fake = { failSend: false };
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const method = req.url.split('/').pop();
    const data = body ? JSON.parse(body) : {};
    const reply = (status, json) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
    };
    if (method === 'getMe') return reply(200, { ok: true, result: { username: 'hris_test_bot' } });
    if (method === 'setWebhook') return reply(200, { ok: true, result: true });
    if (method === 'sendMessage') {
      if (fake.failSend) return reply(500, { ok: false, description: 'down' });
      if (String(data.chat_id).startsWith('blocked')) return reply(403, { ok: false, description: 'Forbidden: bot was blocked by the user' });
      sent.push(data);
      return reply(200, { ok: true, result: {} });
    }
    reply(404, { ok: false, description: 'unknown' });
  });
});
await new Promise((r) => server.listen(3199, '127.0.0.1', r));

const [P1] = sql(`select id from "Position" order by title`).split('\n');
let seq = 0;
const tag = () => `${Date.now().toString(36)}n${seq++}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Tunggu pesan ke chat tertentu yang memuat teks (kiriman berjalan di belakang). */
async function messageTo(chat, text, timeout = 4000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const m = sent.find((x) => String(x.chat_id) === String(chat) && x.text.includes(text));
    if (m) return m;
    await sleep(100);
  }
  return null;
}
const countTo = (chat) => sent.filter((x) => String(x.chat_id) === String(chat)).length;
const webhook = (chatId, text, { secret = SECRET, type = 'private' } = {}) =>
  http('POST', '/telegram/webhook', {
    headers: secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {},
    body: { message: { text, chat: { id: chatId, type }, from: { username: `u${chatId}` } } },
  });

async function person(admin, outletId, role = 'EMPLOYEE') {
  const t = tag();
  const username = `nt.${t}`;
  const r = await http('POST', '/employees', {
    token: admin,
    body: { username, password: 'nt-pass-1234', role, nik: `NT${t}`, fullName: `${role} ${t}`, phone: '0800', outletId, positionId: P1, joinDate: '2026-01-01' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const login = await http('POST', '/auth/login', { body: { username, password: 'nt-pass-1234' } });
  return { id: r.body.id, userId: r.body.user.id, name: r.body.fullName, token: login.body.accessToken };
}
async function link(user, chatId) {
  const r = await http('POST', '/me/telegram/link', { token: user.token });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const code = r.body.url.split('start=')[1];
  assert.equal((await webhook(chatId, `/start ${code}`)).status, 200);
  assert.ok(await messageTo(chatId, 'Terhubung'), 'balasan terhubung');
  return code;
}

const checks = [];

checks.push(['hubungkan: kode sekali pakai, kedaluwarsa, chat pindah akun, /stop, webhook tanpa secret & grup ditolak', async ({ admin, outlet }) => {
  const a = await person(admin, outlet.id);
  const b = await person(admin, outlet.id);
  const before = await http('GET', '/me/telegram', { token: a.token });
  assert.deepEqual(before.body, { available: true, linked: false, telegramUsername: null });

  const r = await http('POST', '/me/telegram/link', { token: a.token });
  assert.match(r.body.url, /^https:\/\/t\.me\/hris_test_bot\?start=[A-Za-z0-9_-]{20,}$/);
  const code = r.body.url.split('start=')[1];
  assert.equal((await webhook(5001, `/start ${code}`, { secret: null })).status, 403, 'tanpa secret');
  assert.equal((await webhook(5001, `/start ${code}`, { secret: 'salah' })).status, 403, 'secret salah');
  await webhook(5002, `/start ${code}`, { type: 'group' });
  assert.equal((await http('GET', '/me/telegram', { token: a.token })).body.linked, false, 'grup diabaikan');

  await webhook(5001, `/start ${code}`);
  assert.ok(await messageTo(5001, `Terhubung sebagai ${a.name}`));
  assert.deepEqual((await http('GET', '/me/telegram', { token: a.token })).body, { available: true, linked: true, telegramUsername: 'u5001' });
  await webhook(5003, `/start ${code}`);
  assert.ok(await messageTo(5003, 'kedaluwarsa'), 'kode dipakai dua kali');

  const old = (await http('POST', '/me/telegram/link', { token: b.token })).body.url.split('start=')[1];
  sql(`update "TelegramLinkCode" set "expiresAt" = '2000-01-01' where code = '${old}'`);
  await webhook(5001, `/start ${old}`);
  assert.equal((await http('GET', '/me/telegram', { token: b.token })).body.linked, false, 'kode kedaluwarsa');

  await link(b, 5001);
  assert.equal((await http('GET', '/me/telegram', { token: a.token })).body.linked, false, 'chat pindah ke akun b');
  await webhook(5001, '/stop');
  assert.ok(await messageTo(5001, 'dihentikan'));
  assert.equal((await http('GET', '/me/telegram', { token: b.token })).body.linked, false);
  assert.equal((await http('DELETE', '/me/telegram', { token: a.token })).status, 200);
}]);

checks.push(['alur pengajuan: Kepala Cabang → HR → kru; cabang tanpa kepala langsung ke HR', async ({ admin, outlet, outlet2 }) => {
  const sm = await person(admin, outlet.id, 'STORE_MANAGER');
  const hr = await person(admin, outlet.id, 'HR_ADMIN');
  const crew = await person(admin, outlet.id);
  const lone = await person(admin, outlet2.id);
  await link(sm, 6001);
  await link(hr, 6002);
  await link(crew, 6003);
  await link(lone, 6004);

  const req = await http('POST', '/requests/general', {
    token: crew.token,
    body: { type: 'IZIN', startDate: '2026-12-10', reason: 'Urusan keluarga' },
  });
  assert.equal(req.status, 201, JSON.stringify(req.body));
  const toSm = await messageTo(6001, crew.name);
  assert.ok(toSm, 'Kepala Cabang menerima pengajuan baru');
  assert.match(toSm.text, /Izin · \d+ Des 2026/);
  assert.equal(toSm.reply_markup.inline_keyboard[0][0].url, 'https://hris.test/?menu=requests');
  await sleep(300);
  assert.equal(countTo(6002) - 1, 0, 'HR belum menerima (hanya pesan terhubung)');

  assert.equal((await http('PATCH', `/requests/${req.body.id}/store-manager-review`, { token: sm.token, body: { action: 'APPROVE' } })).status, 200);
  assert.ok(await messageTo(6002, 'menunggu HR'), 'HR menerima setelah Kepala Cabang setuju');
  assert.equal((await http('PATCH', `/requests/${req.body.id}/hr-review`, { token: hr.token, body: { action: 'REJECT', notes: 'Tanggal itu ada acara' } })).status, 200);
  const toCrew = await messageTo(6003, 'ditolak');
  assert.ok(toCrew && toCrew.text.includes('Tanggal itu ada acara'), 'kru menerima alasan');
  assert.equal(toCrew.reply_markup.inline_keyboard[0][0].url, 'https://hris.test/kru/');

  // Cabang 2 tanpa Kepala Cabang: ke HR
  await http('POST', '/requests/general', { token: lone.token, body: { type: 'SAKIT', startDate: '2026-12-11', reason: 'Demam tinggi' } });
  assert.ok(await messageTo(6002, lone.name), 'cabang tanpa kepala langsung ke HR');
}]);

checks.push(['rekening: HR diberi tahu (dengan tanda nama berbeda), kru menerima hasil', async ({ admin, outlet }) => {
  const hr = await person(admin, outlet.id, 'HR_ADMIN');
  const crew = await person(admin, outlet.id);
  await link(hr, 7001);
  await link(crew, 7002);
  await http('POST', '/me/profile/bank-change', { token: crew.token, body: { bankName: 'BCA', bankAccountNumber: '1234567', bankAccountHolder: 'Orang Lain' } });
  const toHr = await messageTo(7001, crew.name);
  assert.ok(toHr && toHr.text.includes('Nama pemilik berbeda'));
  assert.equal(toHr.reply_markup.inline_keyboard[0][0].url, 'https://hris.test/?menu=employees&tab=bank-changes');
  const pending = (await http('GET', '/bank-changes?status=PENDING', { token: admin })).body.find((c) => c.employee.fullName === crew.name);
  await http('POST', `/bank-changes/${pending.id}/approve`, { token: admin });
  assert.ok(await messageTo(7002, 'Rekening gaji diganti ke BCA 1234567'));
}]);

checks.push(['Telegram gagal tidak menggagalkan pengajuan; chat yang memblokir bot diputus', async ({ admin, outlet }) => {
  const sm = await person(admin, outlet.id, 'STORE_MANAGER');
  const crew = await person(admin, outlet.id);
  await link(sm, 8001);
  fake.failSend = true;
  const r = await http('POST', '/requests/general', { token: crew.token, body: { type: 'IZIN', startDate: '2026-12-12', reason: 'Telegram mati' } });
  assert.equal(r.status, 201, 'pengajuan tetap tersimpan');
  fake.failSend = false;

  const blocked = await person(admin, outlet.id);
  const code = (await http('POST', '/me/telegram/link', { token: blocked.token })).body.url.split('start=')[1];
  await webhook('blocked-9', `/start ${code}`);
  await sleep(300);
  assert.equal((await http('GET', '/me/telegram', { token: blocked.token })).body.linked, true);
  await http('POST', '/me/profile/bank-change', { token: blocked.token, body: { bankName: 'BRI', bankAccountNumber: '7654321', bankAccountHolder: blocked.name } });
  const pending = (await http('GET', '/bank-changes?status=PENDING', { token: admin })).body.find((c) => c.employee.fullName === blocked.name);
  await http('POST', `/bank-changes/${pending.id}/approve`, { token: admin });
  let linked = true;
  for (let i = 0; i < 30 && linked; i++) {
    await sleep(100);
    linked = (await http('GET', '/me/telegram', { token: blocked.token })).body.linked;
  }
  assert.equal(linked, false, 'chat yang memblokir bot diputus');
}]);

checks.push(['ringkasan pagi: hanya yang punya pekerjaan menunggu, Kepala Cabang hanya cabangnya', async ({ admin, outlet3 }) => {
  const sm = await person(admin, outlet3.id, 'STORE_MANAGER');
  const crew = await person(admin, outlet3.id);
  const idleCrew = await person(admin, outlet3.id);
  await link(sm, 9101);
  await link(idleCrew, 9102);
  await http('POST', '/requests/general', { token: crew.token, body: { type: 'IZIN', startDate: '2026-12-13', reason: 'Ringkasan' } });
  await messageTo(9101, crew.name);
  const r = await http('POST', '/notifications/digest', { token: admin });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.ok(r.body.recipients >= 1);
  const digest = await messageTo(9101, 'Ringkasan pagi');
  assert.ok(digest, 'Kepala Cabang menerima ringkasan');
  assert.match(digest.text, /• 1 pengajuan menunggu Kepala Cabang/);
  assert.equal(await messageTo(9102, 'Ringkasan pagi', 500), null, 'kru tidak menerima ringkasan');
  assert.equal((await http('POST', '/notifications/digest', { token: sm.token })).status, 403, 'hanya Super Admin');
}]);

const login = await http('POST', '/auth/login', { body: { username: process.env.E2E_ADMIN_USER, password: process.env.E2E_ADMIN_PASS } });
assert.equal(login.status, 201);
const ctx = { admin: login.body.accessToken };
const suffix = Date.now().toString(36).toUpperCase();
ctx.outlet = await createOutlet(ctx.admin, `${suffix}NA`);
ctx.outlet2 = await createOutlet(ctx.admin, `${suffix}NB`);
ctx.outlet3 = await createOutlet(ctx.admin, `${suffix}NC`);
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
server.close();
process.exit(failed ? 1 : 0);
