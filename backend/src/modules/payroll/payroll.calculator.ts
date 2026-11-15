/**
 * Perhitungan gaji tahap 1. Fungsi murni tanpa database agar setiap aturan di
 * docs/payroll-rules.md bisa diuji langsung. Nominal dalam rupiah (bilangan bulat).
 */

export interface PayrollRules {
  basicSalaryProbation: number;
  basicSalaryRegular: number;
  probationMonths: number;
  mealAllowancePerDay: number;
  latePenaltyPerMinute: number;
  tenureAllowanceMonth7: number;
  tenureAllowanceMonth13: number;
  tenureAllowanceMonth19: number;
  tenureAllowanceStep: number;
  kasbonMaxPercent: number;
}

export interface PayrollPeriod {
  start: string; // YYYY-MM-DD, inklusif
  end: string; // YYYY-MM-DD, inklusif
}

export interface PayrollInput {
  joinDate: string; // YYYY-MM-DD
  period: PayrollPeriod;
  /** Tanggal hari ini (zona bisnis); hari mangkir hanya dihitung sampai tanggal ini. */
  today: string;
  /** Tanggal-tanggal ada absen masuk, beserta menit terlambatnya. */
  attendance: { date: string; lateMinutes: number }[];
  /** Tanggal yang dijadwalkan masuk. */
  scheduledDates: string[];
  /** Pengajuan yang sudah disetujui HR dan bersinggungan dengan periode. */
  approvedLeaves: { type: string; start: string; end: string }[];
  /** Kasbon yang sudah dicairkan dan belum lunas, urut dari yang terlama. */
  kasbons: { id: string; monthlyDeduction: number; remainingAmount: number }[];
}

export interface PayrollResult {
  tenureMonths: number;
  daysEmployed: number;
  daysPresent: number;
  unpaidLeaveDays: number;
  absentDays: number;
  lateMinutes: number;
  basicSalary: number;
  mealAllowance: number;
  tenureAllowance: number;
  unpaidDeduction: number;
  latePenalty: number;
  kasbonDeduction: number;
  kasbonAllocations: { kasbonId: string; amount: number }[];
  netSalary: number;
}

const UNPAID_LEAVE_TYPES = new Set(['IZIN']);

function ymdToUtc(ymd: string) {
  return Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
}

function utcToYmd(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysInclusive(from: string, to: string) {
  return Math.round((ymdToUtc(to) - ymdToUtc(from)) / 86_400_000) + 1;
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = ymdToUtc(from); t <= ymdToUtc(to); t += 86_400_000) out.push(utcToYmd(t));
  return out;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Periode gaji bulan `month` untuk tanggal tutup buku `cutoffDay` (1-31). */
export function payrollPeriod(year: number, month: number, cutoffDay: number): PayrollPeriod {
  const endDay = Math.min(cutoffDay, daysInMonth(year, month));
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevEndDay = Math.min(cutoffDay, daysInMonth(prevYear, prevMonth));
  const end = utcToYmd(Date.UTC(year, month - 1, endDay));
  const start = utcToYmd(Date.UTC(prevYear, prevMonth - 1, prevEndDay) + 86_400_000);
  return { start, end };
}

/** Jumlah bulan penuh dari tanggal masuk sampai `asOf`. */
export function completedMonths(joinDate: string, asOf: string) {
  const [jy, jm, jd] = joinDate.split('-').map(Number);
  const [ay, am, ad] = asOf.split('-').map(Number);
  let months = (ay - jy) * 12 + (am - jm);
  if (ad < jd) months -= 1;
  return Math.max(0, months);
}

/** Tunjangan masa kerja untuk bulan kerja ke-n (n = bulan penuh + 1). */
export function tenureAllowance(rules: PayrollRules, tenureMonths: number) {
  const n = tenureMonths + 1;
  if (n <= 6) return 0;
  if (n <= 12) return rules.tenureAllowanceMonth7;
  if (n <= 18) return rules.tenureAllowanceMonth13;
  if (n <= 24) return rules.tenureAllowanceMonth19;
  return rules.tenureAllowanceMonth19 + rules.tenureAllowanceStep * Math.ceil((n - 24) / 6);
}

export function calculatePayroll(rules: PayrollRules, input: PayrollInput): PayrollResult {
  const { period } = input;
  const tenureMonths = completedMonths(input.joinDate, period.end);
  const fullBasic = tenureMonths < rules.probationMonths ? rules.basicSalaryProbation : rules.basicSalaryRegular;
  const dailyRate = fullBasic / 30;

  // Prorata bila mulai bekerja setelah awal periode
  const employedFrom = input.joinDate > period.start ? input.joinDate : period.start;
  const daysEmployed = employedFrom > period.end ? 0 : daysInclusive(employedFrom, period.end);
  const basicSalary = input.joinDate > period.start ? Math.min(fullBasic, Math.round(dailyRate * daysEmployed)) : fullBasic;

  const inEmployment = (d: string) => d >= employedFrom && d <= period.end;
  const present = new Map(input.attendance.filter((a) => inEmployment(a.date)).map((a) => [a.date, a.lateMinutes]));
  const daysPresent = present.size;
  const lateMinutes = Array.from(present.values()).reduce((n, m) => n + Math.max(0, m), 0);

  const leaveDates = (types?: Set<string>) => {
    const set = new Set<string>();
    for (const l of input.approvedLeaves) {
      if (types && !types.has(l.type)) continue;
      const from = l.start > employedFrom ? l.start : employedFrom;
      const to = l.end < period.end ? l.end : period.end;
      if (from <= to) eachDate(from, to).forEach((d) => set.add(d));
    }
    return set;
  };
  const unpaidLeave = leaveDates(UNPAID_LEAVE_TYPES);
  const anyLeave = leaveDates();
  // Izin di hari yang tetap dihadiri tidak memotong gaji
  const unpaidLeaveDays = Array.from(unpaidLeave).filter((d) => !present.has(d)).length;

  // Mangkir hanya untuk hari yang sudah lewat; hari ini belum selesai
  const absentDays = new Set(
    input.scheduledDates.filter((d) => inEmployment(d) && d < input.today && !present.has(d) && !anyLeave.has(d)),
  ).size;

  const mealAllowance = Math.round(rules.mealAllowancePerDay * daysPresent);
  const tenure = Math.round(tenureAllowance(rules, tenureMonths));
  const unpaidDeduction = Math.min(basicSalary, Math.round(dailyRate * (unpaidLeaveDays + absentDays)));
  const latePenalty = Math.round(rules.latePenaltyPerMinute * lateMinutes);

  const gross = basicSalary + mealAllowance + tenure;
  const beforeKasbon = Math.max(0, gross - unpaidDeduction - latePenalty);

  // Cicilan kasbon: maks persentase gaji pokok dan tidak membuat gaji minus
  let kasbonBudget = Math.min(Math.round((fullBasic * rules.kasbonMaxPercent) / 100), beforeKasbon);
  const kasbonAllocations: { kasbonId: string; amount: number }[] = [];
  for (const k of input.kasbons) {
    if (kasbonBudget <= 0) break;
    const amount = Math.min(Math.round(k.monthlyDeduction), Math.round(k.remainingAmount), kasbonBudget);
    if (amount > 0) {
      kasbonAllocations.push({ kasbonId: k.id, amount });
      kasbonBudget -= amount;
    }
  }
  const kasbonDeduction = kasbonAllocations.reduce((n, a) => n + a.amount, 0);

  return {
    tenureMonths,
    daysEmployed,
    daysPresent,
    unpaidLeaveDays,
    absentDays,
    lateMinutes,
    basicSalary,
    mealAllowance,
    tenureAllowance: tenure,
    unpaidDeduction,
    latePenalty,
    kasbonDeduction,
    kasbonAllocations,
    netSalary: beforeKasbon - kasbonDeduction,
  };
}
