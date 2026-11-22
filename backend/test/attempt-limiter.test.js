// Uji AttemptLimiter. Jalankan: npm test (build lalu node --test).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AttemptLimiter } = require('../dist/modules/kiosk/attempt-limiter');

test('burst: hanya sebanyak jatah yang lolos, sisanya ditolak sinkron', () => {
  const l = new AttemptLimiter(10, 60_000);
  const results = Array.from({ length: 50 }, () => l.tryAcquire('ip'));
  assert.equal(results.filter(Boolean).length, 10);
  assert.equal(l.isBlocked('ip'), true);
});

test('kunci berbeda tidak saling memengaruhi', () => {
  const l = new AttemptLimiter(1, 60_000);
  assert.equal(l.tryAcquire('a'), true);
  assert.equal(l.tryAcquire('a'), false);
  assert.equal(l.tryAcquire('b'), true);
});

test('release mengembalikan jatah (percobaan berhasil)', () => {
  const l = new AttemptLimiter(2, 60_000);
  l.tryAcquire('ip'); l.tryAcquire('ip');
  assert.equal(l.tryAcquire('ip'), false);
  l.release('ip');
  assert.equal(l.tryAcquire('ip'), true);
});

test('jatah pulih setelah jendela waktu lewat', () => {
  let t = 1_000;
  const l = new AttemptLimiter(1, 1_000, () => t);
  assert.equal(l.tryAcquire('ip'), true);
  assert.equal(l.tryAcquire('ip'), false);
  t += 1_001;
  assert.equal(l.tryAcquire('ip'), true);
});
