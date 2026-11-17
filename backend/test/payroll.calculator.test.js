// Uji aturan gaji (docs/payroll-rules.md). Jalankan: npm test (build lalu node --test).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculatePayroll, payrollPeriod, completedMonths, tenureAllowance } = require('../dist/modules/payroll/payroll.calculator');

const rules = {
  basicSalaryProbation: 1_000_000,
  basicSalaryRegular: 1_200_000,
  probationMonths: 3,
  mealAllowancePerDay: 20_000,
  latePenaltyPerMinute: 1_000,
  tenureAllowanceMonth7: 100_000,
  tenureAllowanceMonth13: 200_000,
  tenureAllowanceMonth19: 250_000,
  tenureAllowanceStep: 50_000,
  kasbonMaxPercent: 50,
  kpiIncentiveGradeA: 100_000,
};

const nov = { start: '2026-11-01', end: '2026-11-30' };
const base = { joinDate: '2025-01-10', period: nov, today: '2026-12-05', attendance: [], scheduledDates: [], approvedLeaves: [], kasbons: [] };
const days = (from, n) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 10, from + i)).toISOString().slice(0, 10));

test('periode mengikuti tanggal tutup buku', () => {
  assert.deepEqual(payrollPeriod(2026, 11, 31), { start: '2026-11-01', end: '2026-11-30' });
  assert.deepEqual(payrollPeriod(2026, 11, 25), { start: '2026-10-26', end: '2026-11-25' });
  assert.deepEqual(payrollPeriod(2027, 2, 31), { start: '2027-02-01', end: '2027-02-28' });
  assert.deepEqual(payrollPeriod(2027, 3, 30), { start: '2027-03-01', end: '2027-03-30' }); // Feb hanya 28 hari
  assert.deepEqual(payrollPeriod(2027, 1, 25), { start: '2026-12-26', end: '2027-01-25' });
});

test('masa kerja dihitung dalam bulan penuh', () => {
  assert.equal(completedMonths('2026-08-15', '2026-11-14'), 2);
  assert.equal(completedMonths('2026-08-15', '2026-11-15'), 3);
  assert.equal(completedMonths('2026-12-01', '2026-11-30'), 0);
});

test('tunjangan masa kerja per bulan kerja ke-n', () => {
  const t = (months) => tenureAllowance(rules, months);
  assert.equal(t(5), 0); // bulan ke-6
  assert.equal(t(6), 100_000); // bulan ke-7
  assert.equal(t(11), 100_000); // bulan ke-12
  assert.equal(t(12), 200_000); // bulan ke-13
  assert.equal(t(18), 250_000); // bulan ke-19
  assert.equal(t(23), 250_000); // bulan ke-24
  assert.equal(t(24), 300_000); // bulan ke-25
  assert.equal(t(30), 350_000); // bulan ke-31
});

test('gaji pokok: masa percobaan vs reguler', () => {
  const probation = calculatePayroll(rules, { ...base, joinDate: '2026-09-15', period: { start: '2026-11-01', end: '2026-11-30' } });
  // masuk 15 Sep: per 30 Nov baru 2 bulan penuh -> masa percobaan, tidak prorata (masuk sebelum periode)
  assert.equal(probation.tenureMonths, 2);
  assert.equal(probation.basicSalary, 1_000_000);
  const regular = calculatePayroll(rules, base);
  assert.equal(regular.basicSalary, 1_200_000);
});

test('karyawan baru di tengah periode mendapat gaji pokok prorata', () => {
  const r = calculatePayroll(rules, { ...base, joinDate: '2026-11-16' });
  assert.equal(r.daysEmployed, 15);
  assert.equal(r.basicSalary, 500_000); // 1.000.000 / 30 x 15
});

test('uang makan per hari hadir dan potongan terlambat per menit', () => {
  const attendance = days(2, 20).map((d, i) => ({ date: d, lateMinutes: i < 3 ? 10 : 0 }));
  const r = calculatePayroll(rules, { ...base, attendance });
  assert.equal(r.daysPresent, 20);
  assert.equal(r.mealAllowance, 400_000);
  assert.equal(r.lateMinutes, 30);
  assert.equal(r.latePenalty, 30_000);
});

test('izin dan mangkir memotong gaji; cuti dan sakit tidak', () => {
  const scheduled = days(2, 10); // 2-11 Nov dijadwalkan
  const attendance = days(2, 5).map((d) => ({ date: d, lateMinutes: 0 })); // hadir 2-6
  const approvedLeaves = [
    { type: 'IZIN', start: '2026-11-07', end: '2026-11-08' }, // 2 hari izin (tanpa gaji)
    { type: 'SAKIT', start: '2026-11-09', end: '2026-11-09' }, // sakit, dibayar
    { type: 'CUTI_TAHUNAN', start: '2026-11-10', end: '2026-11-10' }, // cuti, dibayar
  ];
  // 11 Nov dijadwalkan, tidak hadir, tidak ada pengajuan -> mangkir
  const r = calculatePayroll(rules, { ...base, scheduledDates: scheduled, attendance, approvedLeaves });
  assert.equal(r.unpaidLeaveDays, 2);
  assert.equal(r.absentDays, 1);
  assert.equal(r.unpaidDeduction, 120_000); // 1.200.000 / 30 x 3
});

test('hari ini dan hari mendatang belum dihitung mangkir', () => {
  const r = calculatePayroll(rules, { ...base, today: '2026-11-20', scheduledDates: ['2026-11-19', '2026-11-20', '2026-11-25'] });
  assert.equal(r.absentDays, 1); // hanya 19 Nov
});

test('izin di hari yang tetap dihadiri tidak memotong gaji', () => {
  const r = calculatePayroll(rules, {
    ...base,
    attendance: [{ date: '2026-11-05', lateMinutes: 0 }],
    approvedLeaves: [{ type: 'IZIN', start: '2026-11-05', end: '2026-11-06' }],
  });
  assert.equal(r.unpaidLeaveDays, 1);
});

test('hari sebelum tanggal masuk tidak dihitung mangkir maupun izin', () => {
  const r = calculatePayroll(rules, { ...base, joinDate: '2026-11-16', scheduledDates: ['2026-11-10', '2026-11-17'], today: '2026-12-01' });
  assert.equal(r.absentDays, 1);
});

test('cicilan kasbon dibatasi 50% gaji pokok dan sisa pinjaman', () => {
  const kasbons = [
    { id: 'a', monthlyDeduction: 500_000, remainingAmount: 300_000 },
    { id: 'b', monthlyDeduction: 500_000, remainingAmount: 1_000_000 },
  ];
  const r = calculatePayroll(rules, { ...base, attendance: days(2, 20).map((d) => ({ date: d, lateMinutes: 0 })), kasbons });
  // batas 600.000: kasbon a 300.000 (sisa), kasbon b 300.000
  assert.deepEqual(r.kasbonAllocations, [{ kasbonId: 'a', amount: 300_000 }, { kasbonId: 'b', amount: 300_000 }]);
  assert.equal(r.kasbonDeduction, 600_000);
});

test('gaji bersih tidak pernah minus; kasbon yang tak terpotong tetap jadi sisa', () => {
  const scheduled = days(1, 30);
  // masuk 1 Jun 2026: bulan kerja ke-6, tunjangan masa kerja Rp 0
  const r = calculatePayroll(rules, {
    ...base,
    joinDate: '2026-06-01',
    scheduledDates: scheduled,
    kasbons: [{ id: 'a', monthlyDeduction: 400_000, remainingAmount: 400_000 }],
  });
  // mangkir 30 hari: potongan = gaji pokok penuh, tidak ada sisa untuk kasbon
  assert.equal(r.unpaidDeduction, 1_200_000);
  assert.equal(r.kasbonDeduction, 0);
  assert.equal(r.netSalary, 0);
});

test('tunjangan masa kerja tetap dibayar walau tidak hadir (sesuai SOP saat ini)', () => {
  const r = calculatePayroll(rules, {
    ...base,
    scheduledDates: days(1, 30),
    kasbons: [{ id: 'a', monthlyDeduction: 400_000, remainingAmount: 400_000 }],
  });
  assert.equal(r.tenureAllowance, 250_000);
  assert.equal(r.kasbonDeduction, 250_000); // hanya sebesar sisa gaji
  assert.equal(r.netSalary, 0);
});

test('contoh lengkap sesuai dokumen', () => {
  const r = calculatePayroll(rules, {
    ...base,
    joinDate: '2025-03-01', // per 30 Nov 2026: 20 bulan penuh -> bulan ke-21 -> tunjangan 250.000
    attendance: days(2, 22).map((d, i) => ({ date: d, lateMinutes: i === 0 ? 15 : 0 })),
    kasbons: [{ id: 'k', monthlyDeduction: 250_000, remainingAmount: 750_000 }],
  });
  assert.equal(r.basicSalary, 1_200_000);
  assert.equal(r.mealAllowance, 440_000);
  assert.equal(r.tenureAllowance, 250_000);
  assert.equal(r.latePenalty, 15_000);
  assert.equal(r.kasbonDeduction, 250_000);
  assert.equal(r.netSalary, 1_200_000 + 440_000 + 250_000 - 15_000 - 250_000);
});

test('karyawan keluar di tengah periode: gaji pokok dan tunjangan prorata sampai hari terakhir', () => {
  // Masuk 2025-01-10 → November 2026 bulan kerja ke-23 (tunjangan 250.000)
  const r = calculatePayroll(rules, { ...base, endDate: '2026-11-15' });
  assert.equal(r.daysEmployed, 15);
  assert.equal(r.basicSalary, 600_000); // 1.200.000 / 30 x 15
  assert.equal(r.tenureAllowance, 125_000); // 250.000 / 30 x 15
});

test('hari setelah hari terakhir kerja tidak dihitung mangkir maupun hadir', () => {
  const r = calculatePayroll(rules, {
    ...base,
    endDate: '2026-11-15',
    scheduledDates: ['2026-11-14', '2026-11-20'],
    attendance: [{ date: '2026-11-20', lateMinutes: 30 }],
  });
  assert.equal(r.absentDays, 1);
  assert.equal(r.daysPresent, 0);
  assert.equal(r.lateMinutes, 0);
});

test('hari terakhir kerja sebelum periode dimulai: tidak ada gaji', () => {
  const r = calculatePayroll(rules, { ...base, endDate: '2026-10-31' });
  assert.equal(r.daysEmployed, 0);
  assert.equal(r.basicSalary, 0);
  assert.equal(r.tenureAllowance, 0);
  assert.equal(r.netSalary, 0);
});

// ---------------------------------------------------------------- KPI
const present = (dates, late = []) => dates.map((date) => ({ date, lateMinutes: late.includes(date) ? 10 : 0, late: late.includes(date) }));

test('KPI disiplin masuk = hari tepat waktu / (hari masuk + mangkir) x 100', () => {
  const att = present(days(2, 8), [days(2, 8)[0], days(2, 8)[1]]); // 8 hadir, 2 terlambat
  const r = calculatePayroll(rules, { ...base, attendance: att, scheduledDates: days(2, 10) }); // 2 mangkir
  assert.equal(r.absentDays, 2);
  assert.equal(r.kpi.disciplineIn, 60); // 6 tepat waktu / 10
});

test('KPI disiplin istirahat = hari istirahat sesuai batas / hari istirahat x 100', () => {
  const breakDays = [...days(2, 3).map((date) => ({ date, overLimit: false })), { date: days(5, 1)[0], overLimit: true }];
  const r = calculatePayroll(rules, { ...base, attendance: present(days(2, 4)), breakDays });
  assert.equal(r.kpi.disciplineBreak, 75);
});

test('KPI sikap dari rata-rata survei 360 (1-5) x 20; kasbon 100 bila bebas kasbon', () => {
  const r = calculatePayroll(rules, { ...base, attendance: present(days(2, 4)), surveyAverage: 4.5 });
  assert.equal(r.kpi.attitude, 90);
  assert.equal(r.kpi.kasbon, 100);
  const withLoan = calculatePayroll(rules, { ...base, kasbons: [{ id: 'k', monthlyDeduction: 0, remainingAmount: 100 }] });
  assert.equal(withLoan.kpi.kasbon, 0);
});

test('KPI skor berbobot 30/25/35/10 dan nilai A memberi insentif yang masuk gaji', () => {
  const r = calculatePayroll(rules, {
    ...base,
    attendance: present(days(2, 10)),
    scheduledDates: days(2, 10),
    breakDays: days(2, 10).map((date) => ({ date, overLimit: false })),
    surveyAverage: 4.5,
  });
  // 100*0.30 + 100*0.25 + 90*0.35 + 100*0.10 = 96.5
  assert.equal(r.kpi.score, 96.5);
  assert.equal(r.kpi.grade, 'A');
  assert.equal(r.kpiIncentive, 100_000);
  assert.equal(r.netSalary, 1_200_000 + 200_000 + 250_000 + 100_000); // gaji + uang makan 10 hari + tunjangan + insentif
});

test('KPI tanpa survei atau tanpa hari masuk: bobot dibagi ulang, tapi tidak dapat insentif', () => {
  const r = calculatePayroll(rules, { ...base, attendance: present(days(2, 10)), scheduledDates: days(2, 10) });
  assert.equal(r.kpi.attitude, null);
  assert.equal(r.kpi.disciplineBreak, null);
  assert.equal(r.kpi.score, 100); // (100*0.30 + 100*0.10) / 0.40
  assert.equal(r.kpi.complete, false);
  assert.equal(r.kpi.grade, null);
  assert.equal(r.kpiIncentive, 0);
});

test('KPI nilai B ke bawah tidak dapat insentif', () => {
  const att = present(days(2, 10), days(2, 4)); // 4 dari 10 terlambat
  const r = calculatePayroll(rules, { ...base, attendance: att, scheduledDates: days(2, 10), surveyAverage: 4 });
  // 60*0.30 + 80*0.35 + 100*0.10 = 56 / 0.75 = 74.7
  assert.equal(r.kpi.score, 74.7);
  assert.equal(r.kpi.grade, 'C');
  assert.equal(r.kpiIncentive, 0);
});
