// Uji aturan absen tablet (kiosk). Jalankan: npm test (build lalu node --test).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  effectiveTime, clockChanged, wasOffline, isOpen, checkTransition, OPEN_ATTENDANCE_MAX_MS,
} = require('../dist/modules/kiosk/kiosk.rules');

const d = (s) => new Date(s);
const state = (clockIn, extra = {}) => ({ attendanceId: 'a1', clockIn: d(clockIn), clockOut: null, openBreakStart: null, ...extra });

test('effectiveTime = waktu tablet + selisih', () => {
  assert.equal(effectiveTime(d('2026-11-22T01:00:00Z'), 90_000).toISOString(), '2026-11-22T01:01:30.000Z');
});

test('clockChanged: jam tablet digeser lebih dari toleransi', () => {
  assert.equal(clockChanged(5_000, 100_000), false);
  assert.equal(clockChanged(5_000, 200_000), true);
});

test('wasOffline: diterima lebih dari 2 menit setelah kejadian', () => {
  assert.equal(wasOffline(d('2026-11-22T01:00:00Z'), d('2026-11-22T01:01:59Z')), false);
  assert.equal(wasOffline(d('2026-11-22T01:00:00Z'), d('2026-11-22T01:03:00Z')), true);
});

test('isOpen: batas 16 jam', () => {
  assert.equal(OPEN_ATTENDANCE_MAX_MS, 16 * 3600_000);
  assert.equal(isOpen(null, d('2026-11-22T01:00:00Z')), false);
  assert.equal(isOpen(state('2026-11-21T18:00:00Z', { clockOut: d('2026-11-22T00:00:00Z') }), d('2026-11-22T01:00:00Z')), false);
});

test('CLOCK_IN tanpa state boleh; sudah masuk ditolak', () => {
  assert.deepEqual(checkTransition(null, 'CLOCK_IN', d('2026-11-22T01:00:00Z')), { ok: true });
  assert.deepEqual(checkTransition(state('2026-11-22T00:00:00Z'), 'CLOCK_IN', d('2026-11-22T01:00:00Z')), { ok: false, reason: 'Sudah absen masuk' });
});

test('CLOCK_OUT lintas tengah malam: sah dalam 16 jam, lewat itu belum absen masuk', () => {
  const s = state('2026-11-21T18:00:00Z');
  assert.deepEqual(checkTransition(s, 'CLOCK_OUT', d('2026-11-22T01:30:00Z')), { ok: true });
  assert.deepEqual(checkTransition(s, 'CLOCK_OUT', d('2026-11-22T11:00:00Z')), { ok: false, reason: 'Belum absen masuk' });
});

test('CLOCK_OUT saat istirahat menutup istirahat', () => {
  const at = d('2026-11-22T05:00:00Z');
  const s = state('2026-11-22T01:00:00Z', { openBreakStart: d('2026-11-22T04:30:00Z') });
  assert.deepEqual(checkTransition(s, 'CLOCK_OUT', at), { ok: true, closeBreakAt: at });
});

test('BREAK_START / BREAK_END', () => {
  const at = d('2026-11-22T03:00:00Z');
  assert.deepEqual(checkTransition(null, 'BREAK_START', at), { ok: false, reason: 'Belum absen masuk' });
  assert.deepEqual(checkTransition(state('2026-11-22T01:00:00Z'), 'BREAK_START', at), { ok: true });
  const onBreak = state('2026-11-22T01:00:00Z', { openBreakStart: d('2026-11-22T02:00:00Z') });
  assert.deepEqual(checkTransition(onBreak, 'BREAK_START', at), { ok: false, reason: 'Masih istirahat' });
  assert.deepEqual(checkTransition(state('2026-11-22T01:00:00Z'), 'BREAK_END', at), { ok: false, reason: 'Tidak sedang istirahat' });
  assert.deepEqual(checkTransition(onBreak, 'BREAK_END', at), { ok: true });
});

test('waktu sebelum absen masuk ditolak untuk semua jenis', () => {
  const s = state('2026-11-22T05:00:00Z');
  const at = d('2026-11-22T04:00:00Z');
  for (const t of ['CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT']) {
    assert.deepEqual(checkTransition(s, t, at), { ok: false, reason: 'Waktu sebelum absen masuk' }, t);
  }
});
