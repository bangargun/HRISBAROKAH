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
  /** Insentif untuk KPI nilai A */
  kpiIncentiveGradeA: number;
}

export interface PayrollPeriod {
  start: string; // YYYY-MM-DD, inklusif
  end: string; // YYYY-MM-DD, inklusif
}

export interface PayrollInput {
  joinDate: string; // YYYY-MM-DD
  /** Hari terakhir kerja (karyawan yang keluar), YYYY-MM-DD. */
  endDate?: string | null;
  period: PayrollPeriod;
  /** Tanggal hari ini (zona bisnis); hari mangkir hanya dihitung sampai tanggal ini. */
  today: string;
  /** Tanggal-tanggal ada absen masuk, beserta menit terlambatnya (late = melewati toleransi). */
  attendance: { date: string; lateMinutes: number; late?: boolean }[];
  /** Hari yang ada istirahatnya; overLimit bila ada istirahat melewati batas cabang. */
  breakDays?: { date: string; overLimit: boolean }[];
  /** Rata-rata survei 360° (skala 1-5) untuk periode ini, null bila belum ada. */
  surveyAverage?: number | null;
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
  kpi: KpiResult;
  kpiIncentive: number;
  netSalary: number;
}

export type KpiGrade = 'A' | 'B' | 'C' | 'D';

export interface KpiResult {
  /** Hari tepat waktu ÷ (hari masuk + mangkir) × 100; null bila tidak ada hari kerja */
  disciplineIn: number | null;
  /** Hari istirahat sesuai batas ÷ hari istirahat × 100; null bila tidak pernah istirahat */
  disciplineBreak: number | null;
  /** Rata-rata survei 360° × 20; null bila belum ada survei */
  attitude: number | null;
  /** 100 bila bebas kasbon, 0 bila masih ada sisa kasbon */
  kasbon: number;
  score: number;
  /** Null bila belum lengkap: nilai huruf hanya untuk KPI dengan data disiplin masuk dan survei */
  grade: KpiGrade | null;
  /** Disiplin masuk dan sikap tersedia; syarat mendapat nilai dan insentif */
  complete: boolean;
}

export const KPI_WEIGHTS = { disciplineIn: 0.3, disciplineBreak: 0.25, attitude: 0.35, kasbon: 0.1 } as const;

export function kpiGrade(score: number): KpiGrade {
  return score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, whole: number) => (whole > 0 ? round1((part / whole) * 100) : null);

/** Nilai berbobot; komponen tanpa data dikeluarkan dan bobotnya dibagi ulang. */
export function kpiScore(parts: Omit<KpiResult, 'score' | 'grade' | 'complete'>) {
  let sum = 0;
  let weight = 0;
  for (const key of Object.keys(KPI_WEIGHTS) as (keyof typeof KPI_WEIGHTS)[]) {
    const v = parts[key];
    if (v === null) continue;
    sum += v * KPI_WEIGHTS[key];
    weight += KPI_WEIGHTS[key];
  }
  return weight ? round1(sum / weight) : 0;
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
  // Masa kerja dihitung sampai akhir periode, atau sampai hari terakhir kerja bila lebih awal
  const tenureAsOf = input.endDate && input.endDate < period.end ? input.endDate : period.end;
  const tenureMonths = completedMonths(input.joinDate, tenureAsOf);
  const fullBasic = tenureMonths < rules.probationMonths ? rules.basicSalaryProbation : rules.basicSalaryRegular;
  const dailyRate = fullBasic / 30;

  // Prorata bila mulai bekerja setelah awal periode atau keluar sebelum akhir periode
  const employedFrom = input.joinDate > period.start ? input.joinDate : period.start;
  const employedTo = input.endDate && input.endDate < period.end ? input.endDate : period.end;
  const daysEmployed = employedFrom > employedTo ? 0 : daysInclusive(employedFrom, employedTo);
  const partial = employedFrom !== period.start || employedTo !== period.end;
  const prorate = (monthly: number) => (partial ? Math.min(monthly, Math.round((monthly / 30) * daysEmployed)) : monthly);
  const basicSalary = prorate(fullBasic);

  const inEmployment = (d: string) => d >= employedFrom && d <= employedTo;
  const present = new Map(input.attendance.filter((a) => inEmployment(a.date)).map((a) => [a.date, a.lateMinutes]));
  const daysPresent = present.size;
  const lateMinutes = Array.from(present.values()).reduce((n, m) => n + Math.max(0, m), 0);

  const leaveDates = (types?: Set<string>) => {
    const set = new Set<string>();
    for (const l of input.approvedLeaves) {
      if (types && !types.has(l.type)) continue;
      const from = l.start > employedFrom ? l.start : employedFrom;
      const to = l.end < employedTo ? l.end : employedTo;
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
  // Tunjangan masa kerja ikut prorata hanya untuk yang keluar di tengah periode (karyawan baru belum mendapatkannya)
  const fullTenure = Math.round(tenureAllowance(rules, tenureMonths));
  const tenure = employedTo !== period.end ? prorate(fullTenure) : daysEmployed > 0 ? fullTenure : 0;
  const unpaidDeduction = Math.min(basicSalary, Math.round(dailyRate * (unpaidLeaveDays + absentDays)));
  const latePenalty = Math.round(rules.latePenaltyPerMinute * lateMinutes);

  // KPI periode ini (lihat docs/payroll-rules.md, bagian KPI)
  const onTimeDays = Array.from(present.keys()).filter((d) => !input.attendance.find((a) => a.date === d)?.late).length;
  const breakDays = (input.breakDays ?? []).filter((b) => inEmployment(b.date));
  const kpiParts = {
    disciplineIn: pct(onTimeDays, daysPresent + absentDays),
    disciplineBreak: pct(breakDays.filter((b) => !b.overLimit).length, breakDays.length),
    attitude: input.surveyAverage != null ? round1(input.surveyAverage * 20) : null,
    kasbon: input.kasbons.some((k) => k.remainingAmount > 0) ? 0 : 100,
  };
  const score = kpiScore(kpiParts);
  const complete = kpiParts.disciplineIn !== null && kpiParts.attitude !== null;
  const kpi: KpiResult = { ...kpiParts, score, grade: complete ? kpiGrade(score) : null, complete };
  const kpiIncentive = kpi.grade === 'A' ? Math.round(rules.kpiIncentiveGradeA) : 0;

  const gross = basicSalary + mealAllowance + tenure + kpiIncentive;
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
    kpi,
    kpiIncentive,
    netSalary: beforeKasbon - kasbonDeduction,
  };
}
