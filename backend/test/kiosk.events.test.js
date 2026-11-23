// Uji EventsService tanpa DB: error infrastruktur tidak boleh jadi hasil permanen.
// Jalankan: npm test (build lalu node --test).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { EventsService } = require('../dist/modules/kiosk/events.service');
const { UPLOADS_ROOT } = require('../dist/common/utils/attendance-photo.util');
const { businessDateString } = require('../dist/common/utils/business-date.util');

const FACE_A = readFileSync(join(__dirname, 'fixtures/face-a.jpg')).toString('base64');
const device = { deviceId: 'dev-1', outletId: 'out-1' };
const photoDir = () => join(UPLOADS_ROOT, 'attendance', businessDateString());
const listPhotos = () => (existsSync(photoDir()) ? readdirSync(photoDir()) : []);

function makeService({ txError, photo = FACE_A } = {}) {
  const created = [];
  const prisma = {
    attendanceEvent: {
      findUnique: async () => null,
      create: async ({ data }) => { created.push(data); return data; },
    },
    employeeProfile: { findUnique: async () => ({ outletId: 'out-1', attendancePinHash: null, user: { isActive: true } }) },
    outlet: { findUniqueOrThrow: async () => ({ id: 'out-1' }) },
    $transaction: async () => { throw txError; },
  };
  const attendance = { punctuality: async () => ({ scheduleId: null, lateMinutes: 0, status: 'PRESENT' }) };
  const face = { scoreAgainst: async () => ({ score: 0.9, enrolled: true, reason: null }) };
  const service = new EventsService(prisma, attendance, face);
  const dto = {
    deviceNow: new Date().toISOString(),
    events: [{
      id: '11111111-1111-4111-8111-111111111111',
      employeeId: '22222222-2222-4222-8222-222222222222',
      type: 'CLOCK_IN',
      method: 'FACE_LOCAL',
      deviceTime: new Date().toISOString(),
      offsetAtEventMs: 0,
      photoBase64: photo,
    }],
  };
  return { service, dto, created };
}

test('error transaksi (DB putus / timeout) -> event tidak dijawab, tidak disimpan, foto dibuang', async () => {
  const before = listPhotos();
  const { service, dto, created } = makeService({ txError: new Error('Connection terminated unexpectedly') });
  service.logger.error = () => {}; // log yang diharapkan tidak mengotori output uji
  const res = await service.ingest(device, dto);
  assert.deepEqual(res, { results: [] });
  assert.equal(created.length, 0, 'tidak ada AttendanceEvent tersimpan');
  assert.deepEqual(listPhotos().sort(), before.sort(), 'foto percobaan ini dihapus');
});

test('foto tidak bisa dibaca (deterministik) -> disimpan NEEDS_REVIEW applied=false dan dijawab', async () => {
  const { service, dto, created } = makeService({ photo: Buffer.from('bukan gambar').toString('base64') });
  const res = await service.ingest(device, dto);
  assert.equal(res.results.length, 1);
  assert.equal(res.results[0].status, 'NEEDS_REVIEW');
  assert.match(res.results[0].reason, /^Foto absen tidak valid/);
  assert.equal(created.length, 1);
  assert.equal(created[0].applied, false);
});
