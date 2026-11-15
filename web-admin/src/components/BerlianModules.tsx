'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Briefcase,
  Award,
  TrendingUp,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  ChevronRight,
  Edit2,
  Trash2,
  Eye,
  Check,
  Star,
  Layers,
  ChefHat,
  Filter,
  Wallet,
  GraduationCap,
  AlertTriangle,
  Printer,
  RefreshCw,
  X,
  Coins,
  CheckCheck,
  ThumbsUp,
  Coffee,
} from 'lucide-react';

// =====================================================================
// 1. DATA & KOMPONEN: PENDAMPINGAN (COACHING & SHARING EXCELLENT)
// =====================================================================
export interface CoachingTaskItem {
  id: string;
  topic: string;
  coach: string;
  employeeName: string;
  nik: string;
  avatar: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Normal';
  status: 'Belum Mulai' | 'Sedang Berjalan' | 'Selesai';
  progress: number;
  outlet?: string;
  station?: string;
}

export const INITIAL_COACHING_TASKS: CoachingTaskItem[] = [];

interface PendampinganViewProps {
  tasks: CoachingTaskItem[];
  onUpdateStatus: (id: string, newStatus: CoachingTaskItem['status'], newProgress: number) => void;
  showToast: (msg: string) => void;
}

export function PendampinganView({ tasks, onUpdateStatus, showToast }: PendampinganViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'Belum Mulai' | 'Sedang Berjalan' | 'Selesai'>('ALL');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('Sharing excellent bersama coach habibie');
  const [newEmployee, setNewEmployee] = useState('');

  const filteredTasks = tasks.filter((t) => {
    const matchSearch =
      t.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.nik.includes(searchQuery) ||
      t.topic.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = selectedStatusFilter === 'ALL' || t.status === selectedStatusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      {/* Hero Strip Header */}
      <div className="bg-[#0e1d33] border border-[#1b2f4f] rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">
              HC MANAGEMENT • COACHING &amp; FIELD MENTORING
            </span>
            <span className="text-xs text-blue-300 font-bold flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Sesi Pendampingan Kerja Lapangan Kru
            </span>
          </div>
          <h3 className="text-lg font-black text-white tracking-tight">
            PENDAMPINGAN KRU &amp; SHARING EXCELLENCE BERSAMA COACH
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Program pendampingan satu-lawan-satu (1-on-1 coaching) di station kerja oleh Supervisor &amp; Coach HQ untuk meningkatkan standar mutu gramatur, kecepatan layanan meja 3S, dan kepatuhan SOP resto.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow-md transition-all active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span>Jadwalkan Pendampingan</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0f1f38] p-3 rounded-xl border border-[#1a3154] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari agenda, nama staf, NIK..."
            className="w-full bg-[#0a1526] border border-[#1d375e] text-slate-200 placeholder:text-slate-500 text-xs rounded-lg pl-9 pr-3 py-2 outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-[11px] text-slate-400 font-bold shrink-0">Filter Status:</span>
          {(['ALL', 'Belum Mulai', 'Sedang Berjalan', 'Selesai'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                selectedStatusFilter === st
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0a1526] text-slate-400 hover:text-white border border-[#1a3154]'
              }`}
            >
              {st === 'ALL' ? 'Semua Status' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table Matching Berlian Screenshot */}
      <div className="bg-[#0b1728] rounded-xl border border-[#162744] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#08101d] border-b border-[#162744] text-slate-400 uppercase font-black tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Tugas / Agenda Pendampingan</th>
                <th className="py-3.5 px-4">PIC (Kru Resto)</th>
                <th className="py-3.5 px-4">Tenggat</th>
                <th className="py-3.5 px-4 text-center">Prioritas</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Progress</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#13223b] text-slate-200">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Tidak ada agenda pendampingan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#0e1e36] transition-colors group"
                  >
                    {/* Tugas */}
                    <td className="py-4 px-4 font-medium text-slate-200 max-w-xs">
                      <div className="font-semibold text-white leading-snug">{item.topic}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.coach}</div>
                    </td>

                    {/* PIC */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shadow-xs shrink-0">
                          {item.avatar}
                        </div>
                        <div>
                          <div className="font-extrabold text-white text-xs tracking-tight">
                            {item.employeeName}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider">
                            {item.nik}
                          </div>
                          <div className="text-[9.5px] text-amber-400/90 font-medium">
                            {item.outlet} • {item.station}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Tenggat */}
                    <td className="py-4 px-4 font-medium text-slate-300 whitespace-nowrap">
                      {item.dueDate}
                    </td>

                    {/* Prioritas (Merah Maroon Badge) */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide ${
                          item.priority === 'High'
                            ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                            : item.priority === 'Medium'
                            ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>

                    {/* Status (Amber Badge Belum Mulai) */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold ${
                          item.status === 'Belum Mulai'
                            ? 'bg-[#332211] text-[#f59e0b] border border-[#553818]'
                            : item.status === 'Sedang Berjalan'
                            ? 'bg-blue-950/80 text-blue-400 border border-blue-800'
                            : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    {/* Progress */}
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center space-x-2">
                        <div className="w-16 bg-[#07101c] h-1.5 rounded-full overflow-hidden border border-[#162744]">
                          <div
                            className={`h-full rounded-full ${
                              item.progress === 100
                                ? 'bg-emerald-500'
                                : item.progress > 0
                                ? 'bg-blue-500'
                                : 'bg-transparent'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          ></div>
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-300">
                          {item.progress}%
                        </span>
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.status === 'Belum Mulai') {
                              onUpdateStatus(item.id, 'Sedang Berjalan', 50);
                              showToast(`Sesi "${item.employeeName}" dimulai (Progress: 50%)`);
                            } else if (item.status === 'Sedang Berjalan') {
                              onUpdateStatus(item.id, 'Selesai', 100);
                              showToast(`✅ Sesi "${item.employeeName}" selesai dievaluasi (100%)!`);
                            } else {
                              onUpdateStatus(item.id, 'Belum Mulai', 0);
                              showToast(`Status "${item.employeeName}" di-reset`);
                            }
                          }}
                          className="px-2.5 py-1 bg-[#13243d] hover:bg-blue-600 text-slate-200 hover:text-white rounded-lg text-[10px] font-bold transition border border-[#1f385e]"
                        >
                          {item.status === 'Belum Mulai' ? 'Mulai' : item.status === 'Sedang Berjalan' ? 'Selesaikan' : 'Reset'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Schedule */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1728] border border-[#1b2f4f] rounded-2xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <h4 className="font-black text-sm text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-400" />
              <span>Jadwalkan Sesi Pendampingan Baru</span>
            </h4>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Agenda / Fokus Coaching:</label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full bg-[#08101d] border border-[#1c355c] p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Nama Staf / PIC:</label>
                <input
                  type="text"
                  value={newEmployee}
                  onChange={(e) => setNewEmployee(e.target.value)}
                  placeholder="Nama karyawan..."
                  className="w-full bg-[#08101d] border border-[#1c355c] p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[#162744]">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  showToast(`Jadwal pendampingan baru berhasil dibuat!`);
                  setIsScheduleModalOpen(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
              >
                Simpan Jadwal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// 2. DATA & KOMPONEN: CAREER (JENJANG KARIR & PROMOSI KRU RESTO)
// =====================================================================
export function CareerPathView({ showToast }: { showToast: (msg: string) => void }) {
  const [activeCareerTab, setActiveCareerTab] = useState<'kitchen' | 'service'>('kitchen');

  const kitchenLevels = [
    { level: 'Level 1', title: 'Kitchen Helper & Dishwasher', tenure: '0 - 3 Bulan', salary: 'Rp 2.400.000', skills: 'Kebersihan alat, preparasi sayur, sanitasi talenan 5 warna' },
    { level: 'Level 2', title: 'Cook 3 (Station Goreng & Bakar)', tenure: '3 - 9 Bulan', salary: 'Rp 2.700.000', skills: 'Suhu minyak goreng TPM <24%, porsi bakar taliwang' },
    { level: 'Level 3', title: 'Cook 1 (Wok, Bumbu & Marinasi)', tenure: '9 - 18 Bulan', salary: 'Rp 3.000.000', skills: 'Gramatur bumbu medok, kontrol shrinkage daging <2.5%' },
    { level: 'Level 4', title: 'CDP (Chef de Partie / Lead)', tenure: '18 - 36 Bulan', salary: 'Rp 3.600.000', skills: 'Manajemen shift dapur, audit cold-chain HACCP, resep baku' },
    { level: 'Level 5', title: 'Head Kitchen Manager', tenure: '> 36 Bulan', salary: 'Rp 4.500.000 - Rp 5.500.000', skills: 'Food cost control, pelatihan koki baru, otorisasi menu' },
  ];

  const serviceLevels = [
    { level: 'Level 1', title: 'Busser & Food Runner', tenure: '0 - 3 Bulan', salary: 'Rp 2.400.000', skills: 'Table clearing <60 detik, pengantaran menu panas aman' },
    { level: 'Level 2', title: 'Waiter / Server Meja', tenure: '3 - 9 Bulan', salary: 'Rp 2.600.000', skills: 'Standar 3S, speed of service <15m, metode LAST komplain' },
    { level: 'Level 3', title: 'Cashier & POS Specialist', tenure: '9 - 18 Bulan', salary: 'Rp 2.900.000', skills: 'Rekonsiliasi Z-Report kasir, anti-selisih kas, otorisasi PIN' },
    { level: 'Level 4', title: 'Captain Floor & Assistant SPV', tenure: '18 - 36 Bulan', salary: 'Rp 3.500.000', skills: 'Pengaturan giliran break 60m, penanganan VIP tamu' },
    { level: 'Level 5', title: 'Store Manager (Kepala Cabang)', tenure: '> 36 Bulan', salary: 'Rp 4.500.000 - Rp 6.000.000', skills: 'Manajemen P&L cabang, target omset, pembinaan tim resto' },
  ];

  const currentPath = activeCareerTab === 'kitchen' ? kitchenLevels : serviceLevels;

  return (
    <div className="space-y-5">
      <div className="bg-[#0e1d33] border border-[#1b2f4f] rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
              CAREER &amp; PROMOTION PATH
            </span>
            <span className="text-xs text-amber-300 font-bold flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              Tangga Karir Transparan Kru Restoran 2026
            </span>
          </div>
          <h3 className="text-lg font-black text-white tracking-tight">
            JENJANG KARIR &amp; JALUR PROMOSI BERJENJANG BAROKAH GRUP
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Memberikan kepastian jenjang promosi bagi seluruh kru Dapur (BOH) dan Layanan (FOH) untuk menekan angka keluar-masuk karyawan (*turnover*) dan menumbuhkan loyalitas kerja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveCareerTab('kitchen')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
              activeCareerTab === 'kitchen'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-[#08101d] text-slate-300 hover:text-white border border-[#1b2f4f]'
            }`}
          >
            🍳 Jalur Dapur (Kitchen BOH)
          </button>
          <button
            onClick={() => setActiveCareerTab('service')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
              activeCareerTab === 'service'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-[#08101d] text-slate-300 hover:text-white border border-[#1b2f4f]'
            }`}
          >
            🍽️ Jalur Layanan (Service FOH)
          </button>
        </div>
      </div>

      {/* Ladder Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {currentPath.map((lvl, idx) => (
          <div
            key={idx}
            className="bg-[#0b1728] border border-[#162744] hover:border-amber-500/50 rounded-2xl p-4 text-white space-y-3 transition group relative"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                {lvl.level}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">{lvl.tenure}</span>
            </div>

            <h4 className="font-black text-xs text-white leading-tight min-h-[32px]">
              {lvl.title}
            </h4>

            <div className="p-2.5 bg-[#08101d] rounded-xl border border-[#14233a] space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">
                Standar Gaji Pokok:
              </span>
              <span className="font-extrabold text-xs text-emerald-400 font-mono">
                {lvl.salary}
              </span>
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed border-t border-[#14233a] pt-2">
              <span className="text-[10px] font-bold text-slate-300 block mb-0.5">Kompetensi Utama:</span>
              <p>{lvl.skills}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Eligibility Checklist */}
      <div className="bg-[#0b1728] border border-[#162744] rounded-2xl p-5 text-white space-y-3">
        <h4 className="font-black text-sm text-white flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-400" />
          <span>Syarat Kenaikan Pangkat Otomatis Kru Resto:</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#08101d] rounded-xl border border-[#162744] space-y-1">
            <span className="text-emerald-400 font-bold block">1. Masa Kerja</span>
            <p className="text-slate-300 text-[11px]">Telah menyelesaikan masa kerja minimum di level aktif.</p>
          </div>
          <div className="p-3 bg-[#08101d] rounded-xl border border-[#162744] space-y-1">
            <span className="text-emerald-400 font-bold block">2. Ujian Kuis LMS</span>
            <p className="text-slate-300 text-[11px]">Nilai evaluasi modul onboarding &amp; resep baku min 85.</p>
          </div>
          <div className="p-3 bg-[#08101d] rounded-xl border border-[#162744] space-y-1">
            <span className="text-emerald-400 font-bold block">3. Rapor Kinerja</span>
            <p className="text-slate-300 text-[11px]">Mendapatkan penilaian Rapor berkala Grade A atau B.</p>
          </div>
          <div className="p-3 bg-[#08101d] rounded-xl border border-[#162744] space-y-1">
            <span className="text-emerald-400 font-bold block">4. Zero Sanksi (SP)</span>
            <p className="text-slate-300 text-[11px]">Tidak memiliki Surat Peringatan aktif dalam 6 bulan terakhir.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 4. DATA & KOMPONEN: PERFORMANCE (PENILAIAN KPI 4 PILAR BERBOBOT)
// =====================================================================

export interface KpiEmployeeItem {
  id: string;
  name: string;
  nik: string;
  avatar: string;
  station: string;
  category: 'Kitchen' | 'Service' | 'Kasir';
  outlet: string;
  // 4 Pilar Bobot Resmi (Kompetensi Ditiadakan sesuai arahan Bang Argun):
  scoreDisiplinMasuk: number;    // Bobot 30% (Ketepatan Waktu Masuk / Clock-In & Zero Mangkir)
  scoreDisiplinIstirahat: number;// Bobot 25% (Kepatuhan Timer Break & Kuota Toleransi 15m)
  scoreDisiplin?: number;        // Kompatibilitas agregat
  scoreAttitude: number;        // Bobot 35% (Survey 360°, Hospitality 3S, Teamwork)
  scoreFinancialKasbon: number; // Bobot 10% (Kemandirian Finansial: 100 = Bebas Kasbon, 0 = Ada Kasbon)
  scoreKompetensi?: number;      // Deprecated / tidak masuk KPI
  hasKasbon: boolean;
  kasbonAmount: number;
  lateMinutes: number;          // Menit keterlambatan jam masuk kerja
  overBreakMinutes?: number;    // Menit keterlambatan kembali istirahat
  quizAvgScore?: number;
  attitudeFeedback: string;
}

export const INITIAL_KPI_EMPLOYEES: KpiEmployeeItem[] = [];

export function calculateKpiScore(item: KpiEmployeeItem): number {
  const scoreMasuk = item.scoreDisiplinMasuk ?? item.scoreDisiplin ?? 90;
  const scoreIstirahat = item.scoreDisiplinIstirahat ?? item.scoreDisiplin ?? 90;
  const finalScore =
    scoreMasuk * 0.30 +
    scoreIstirahat * 0.25 +
    item.scoreAttitude * 0.35 +
    item.scoreFinancialKasbon * 0.10;
  return Math.round(finalScore * 10) / 10;
}

export function getKpiGrade(score: number): {
  grade: 'A' | 'B' | 'C' | 'D';
  label: string;
  badgeBg: string;
  badgeText: string;
  bonusPct: number;
  bonusNominal: number;
} {
  if (score >= 90) {
    return {
      grade: 'A',
      label: 'Excellence (Insentif Rp 100.000)',
      badgeBg: 'bg-emerald-500/20 border-emerald-500/40',
      badgeText: 'text-emerald-400',
      bonusPct: 100,
      bonusNominal: 100000,
    };
  } else if (score >= 80) {
    return {
      grade: 'B',
      label: 'Good (Standar Tercapai - Rp 0)',
      badgeBg: 'bg-blue-500/20 border-blue-500/40',
      badgeText: 'text-blue-400',
      bonusPct: 0,
      bonusNominal: 0,
    };
  } else if (score >= 70) {
    return {
      grade: 'C',
      label: 'Needs Improvement (Pembinaan - Rp 0)',
      badgeBg: 'bg-amber-500/20 border-amber-500/40',
      badgeText: 'text-amber-400',
      bonusPct: 0,
      bonusNominal: 0,
    };
  } else {
    return {
      grade: 'D',
      label: 'Underperforming (Evaluasi SP - Rp 0)',
      badgeBg: 'bg-rose-500/20 border-rose-500/40',
      badgeText: 'text-rose-400',
      bonusPct: 0,
      bonusNominal: 0,
    };
  }
}

export function PerformanceView({ showToast }: { showToast?: (msg: string) => void }) {
  const [employees, setEmployees] = useState<KpiEmployeeItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hris_kpi_employees');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return INITIAL_KPI_EMPLOYEES;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hris_kpi_employees', JSON.stringify(employees));
    }
  }, [employees]);

  const [filterOutlet, setFilterOutlet] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterGrade, setFilterGrade] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Modal State Tambah Karyawan Baru
  const [isAddKpiModalOpen, setIsAddKpiModalOpen] = useState(false);
  const [newKpiForm, setNewKpiForm] = useState<Partial<KpiEmployeeItem>>({
    name: '',
    nik: '',
    station: '',
    category: 'Kitchen',
    outlet: 'Cabang Senopati, Jaksel',
    scoreDisiplinMasuk: 90,
    scoreDisiplinIstirahat: 90,
    scoreAttitude: 90,
    scoreFinancialKasbon: 100,
    hasKasbon: false,
    kasbonAmount: 0,
    lateMinutes: 0,
    overBreakMinutes: 0,
    attitudeFeedback: '',
  });

  // Modal State Edit Evaluasi (4 Pilar Operasional Murni: Masuk 30%, Istirahat 25%, Attitude 35%, Bebas Kasbon 10%)
  const [selectedKpi, setSelectedKpi] = useState<KpiEmployeeItem | null>(null);
  const [editScoreDisiplinMasuk, setEditScoreDisiplinMasuk] = useState<number>(90);
  const [editScoreDisiplinIstirahat, setEditScoreDisiplinIstirahat] = useState<number>(90);
  const [editScoreAttitude, setEditScoreAttitude] = useState<number>(90);
  const [editScoreFinancial, setEditScoreFinancial] = useState<number>(100);
  const [editFeedback, setEditFeedback] = useState<string>('');

  const filteredEmployees = employees.filter((emp) => {
    if (filterOutlet !== 'ALL' && emp.outlet !== filterOutlet) return false;
    if (filterCategory !== 'ALL' && emp.category !== filterCategory) return false;
    const finalScore = calculateKpiScore(emp);
    const grade = getKpiGrade(finalScore).grade;
    if (filterGrade !== 'ALL' && grade !== filterGrade) return false;
    if (
      searchKeyword.trim() !== '' &&
      !emp.name.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !emp.nik.includes(searchKeyword) &&
      !emp.station.toLowerCase().includes(searchKeyword.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const totalBonusAnggaran = employees.reduce((acc, curr) => {
    const sc = calculateKpiScore(curr);
    return acc + getKpiGrade(sc).bonusNominal;
  }, 0);

  const avgKpiScore =
    employees.length > 0
      ? Math.round(
          (employees.reduce((acc, curr) => acc + calculateKpiScore(curr), 0) / employees.length) * 10
        ) / 10
      : 0;

  const countGradeA = employees.filter((e) => calculateKpiScore(e) >= 90).length;
  const countBebasKasbon = employees.filter((e) => e.scoreFinancialKasbon === 100).length;

  const handleOpenDetail = (emp: KpiEmployeeItem) => {
    setSelectedKpi(emp);
    setEditScoreDisiplinMasuk(emp.scoreDisiplinMasuk ?? emp.scoreDisiplin ?? 90);
    setEditScoreDisiplinIstirahat(emp.scoreDisiplinIstirahat ?? emp.scoreDisiplin ?? 90);
    setEditScoreAttitude(emp.scoreAttitude);
    setEditScoreFinancial(emp.scoreFinancialKasbon);
    setEditFeedback(emp.attitudeFeedback);
  };

  const handleSaveEvaluation = () => {
    if (!selectedKpi) return;
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === selectedKpi.id
          ? {
              ...e,
              scoreDisiplinMasuk: editScoreDisiplinMasuk,
              scoreDisiplinIstirahat: editScoreDisiplinIstirahat,
              scoreDisiplin: Math.round(((editScoreDisiplinMasuk * 0.30) + (editScoreDisiplinIstirahat * 0.25)) / 0.55),
              scoreAttitude: editScoreAttitude,
              scoreFinancialKasbon: editScoreFinancial,
              hasKasbon: editScoreFinancial < 100,
              attitudeFeedback: editFeedback,
            }
          : e
      )
    );
    setSelectedKpi(null);
    showToast?.(`Evaluasi KPI untuk ${selectedKpi.name} berhasil diperbarui!`);
  };

  const handleAddKpiEmployee = () => {
    if (!newKpiForm.name?.trim()) {
      showToast?.('Nama karyawan wajib diisi!');
      return;
    }
    const newItem: KpiEmployeeItem = {
      id: `KPI-${Date.now().toString().slice(-4)}`,
      name: newKpiForm.name.trim(),
      nik: newKpiForm.nik?.trim() || `NIK-${Date.now().toString().slice(-6)}`,
      avatar: newKpiForm.category === 'Kitchen' ? '👨‍🍳' : newKpiForm.category === 'Kasir' ? '👩‍💼' : '👨‍💼',
      station: newKpiForm.station || 'Crew Resto',
      category: newKpiForm.category || 'Kitchen',
      outlet: newKpiForm.outlet || 'Cabang Senopati, Jaksel',
      scoreDisiplinMasuk: Number(newKpiForm.scoreDisiplinMasuk ?? 90),
      scoreDisiplinIstirahat: Number(newKpiForm.scoreDisiplinIstirahat ?? 90),
      scoreAttitude: Number(newKpiForm.scoreAttitude ?? 90),
      scoreFinancialKasbon: Number(newKpiForm.scoreFinancialKasbon ?? 100),
      hasKasbon: Number(newKpiForm.scoreFinancialKasbon ?? 100) < 100,
      kasbonAmount: Number(newKpiForm.kasbonAmount ?? 0),
      lateMinutes: Number(newKpiForm.lateMinutes ?? 0),
      overBreakMinutes: Number(newKpiForm.overBreakMinutes ?? 0),
      attitudeFeedback: newKpiForm.attitudeFeedback || 'Kinerja lapangan terpantau baik.',
    };
    setEmployees((prev) => [newItem, ...prev]);
    setIsAddKpiModalOpen(false);
    setNewKpiForm({
      name: '',
      nik: '',
      station: '',
      category: 'Kitchen',
      outlet: 'Cabang Senopati, Jaksel',
      scoreDisiplinMasuk: 90,
      scoreDisiplinIstirahat: 90,
      scoreAttitude: 90,
      scoreFinancialKasbon: 100,
      hasKasbon: false,
      kasbonAmount: 0,
      lateMinutes: 0,
      overBreakMinutes: 0,
      attitudeFeedback: '',
    });
    showToast?.(`Karyawan ${newItem.name} berhasil ditambahkan ke matriks KPI!`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Official Weight Formula */}
      <div className="bg-gradient-to-r from-[#0a1526] via-[#0f213d] to-[#0a1526] border border-[#1b2f4f] rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded font-mono shadow-xs">
              SISTEM EVALUASI KPI RESMI
            </span>
            <span className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" />
              Periode Evaluasi: Oktober 2026 (Tutup Buku)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            RAPOR PENILAIAN KINERJA (KPI) KRU RESTORAN
          </h2>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            Menilai kinerja kru secara adil &amp; terukur melalui formula 4 pilar berbobot, terhubung langsung ke kalkulasi bonus insentif bulanan pada slip gaji karyawan.
          </p>

          {/* Formula 4 Pilar Berbobot Operasional Murni */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="bg-[#12233f] border border-[#1d355e] px-2.5 py-1 rounded-lg text-[11px] text-slate-200 flex items-center gap-1.5" title="Ketepatan waktu clock-in pagi/prep & zero mangkir">
              <Clock className="h-3 w-3 text-emerald-400" />
              <span>Disiplin Masuk: <strong className="text-emerald-400">30%</strong></span>
            </div>
            <div className="bg-[#12233f] border border-[#1d355e] px-2.5 py-1 rounded-lg text-[11px] text-slate-200 flex items-center gap-1.5" title="Kepatuhan timer break & kuota toleransi 15m/bulan">
              <Coffee className="h-3 w-3 text-teal-400" />
              <span>Disiplin Break: <strong className="text-teal-400">25%</strong></span>
            </div>
            <div className="bg-[#12233f] border border-[#1d355e] px-2.5 py-1 rounded-lg text-[11px] text-slate-200 flex items-center gap-1.5" title="Evaluasi jujur perilaku & kerjasama tim saat rush hour">
              <Star className="h-3 w-3 text-purple-400" />
              <span>Attitude 360°: <strong className="text-purple-400">35%</strong></span>
            </div>
            <div className="bg-[#12233f] border border-[#1d355e] px-2.5 py-1 rounded-lg text-[11px] text-slate-200 flex items-center gap-1.5" title="Tertib finansial & nihil penarikan kasbon">
              <Coins className="h-3 w-3 text-amber-400" />
              <span>Bebas Kasbon: <strong className="text-amber-400">10%</strong></span>
            </div>
            <span className="text-xs font-black text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
              = 100%
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
          <button
            onClick={() => setIsAddKpiModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-md transition"
          >
            <Plus className="h-4 w-4" />
            <span>+ Input KPI Karyawan</span>
          </button>
          <button
            onClick={() => showToast?.('Kalkulasi ulang nilai KPI 4 pilar seluruh kru selesai!')}
            className="bg-[#132644] hover:bg-[#1a335c] text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-[#234273] flex items-center gap-2 shadow-xs transition"
          >
            <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
            <span>Hitung Ulang Otomatis</span>
          </button>
          <button
            onClick={() => showToast?.('Bonus insentif KPI periode Oktober 2026 berhasil disinkronkan ke slip gaji Payroll!')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2 rounded-xl shadow-md flex items-center gap-2 transition"
          >
            <CheckCheck className="h-4 w-4" />
            <span>Sinkronkan ke Payroll</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0b1728] p-4 rounded-xl border border-[#162744] shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Award className="h-3.5 w-3.5 text-amber-400" />
            Rata-rata Skor KPI Resto
          </span>
          <p className="text-2xl font-black text-white">{avgKpiScore} <span className="text-xs text-slate-400 font-semibold">/ 100</span></p>
          <span className="text-[10px] text-emerald-400 font-semibold">
            {avgKpiScore >= 90 ? 'Grade A (Excellence)' : avgKpiScore >= 80 ? 'Grade B (Baik)' : avgKpiScore > 0 ? 'Grade C / D' : 'Belum Ada Data'}
          </span>
        </div>

        <div className="bg-[#0b1728] p-4 rounded-xl border border-[#162744] shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-emerald-400" />
            Top Performer (Grade A)
          </span>
          <p className="text-2xl font-black text-emerald-400">{countGradeA} <span className="text-xs text-slate-400 font-semibold">dari {employees.length} Kru</span></p>
          <span className="text-[10px] text-emerald-500 font-semibold">
            {employees.length > 0 ? Math.round((countGradeA / employees.length) * 100) : 0}% Meraih Insentif Penuh 100%
          </span>
        </div>

        <div className="bg-[#0b1728] p-4 rounded-xl border border-[#162744] shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            Kemandirian Finansial (Bebas Kasbon)
          </span>
          <p className="text-2xl font-black text-amber-400">{countBebasKasbon} <span className="text-xs text-slate-400 font-semibold">dari {employees.length} Kru</span></p>
          <span className="text-[10px] text-slate-400">
            {employees.length > 0 ? Math.round((countBebasKasbon / employees.length) * 100) : 0}% Tertib Rp 0 Kasbon Darurat
          </span>
        </div>

        <div className="bg-[#0b1728] p-4 rounded-xl border border-[#162744] shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Wallet className="h-3.5 w-3.5 text-blue-400" />
            Total Insentif KPI Grade A
          </span>
          <p className="text-2xl font-black text-blue-400">Rp {totalBonusAnggaran.toLocaleString('id-ID')}</p>
          <span className="text-[10px] text-slate-400 font-semibold">{countGradeA} Kru Lolos Grade A (Rp 100.000 / staf)</span>
        </div>
      </div>

      {/* 3. Filter & Search Controls */}
      <div className="bg-[#0b1728] p-4 rounded-2xl border border-[#162744] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Cari nama kru, NIK, atau stasiun..."
            className="w-full bg-[#081220] border border-[#1e3456] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Outlet */}
          <select
            value={filterOutlet}
            onChange={(e) => setFilterOutlet(e.target.value)}
            className="bg-[#081220] border border-[#1e3456] text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer"
          >
            <option value="ALL">Semua Cabang</option>
            <option value="Cabang Senopati">Cabang Senopati</option>
            <option value="Cabang Kemang">Cabang Kemang</option>
            <option value="Cabang PIK Pantjoran">Cabang PIK Pantjoran</option>
            <option value="Cabang Tebing Tinggi">Cabang Tebing Tinggi</option>
          </select>

          {/* Filter Kategori */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-[#081220] border border-[#1e3456] text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer"
          >
            <option value="ALL">Semua Divisi</option>
            <option value="Kitchen">Kitchen (BOH)</option>
            <option value="Service">Service (FOH)</option>
            <option value="Kasir">Kasir &amp; Billing</option>
          </select>

          {/* Filter Grade */}
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="bg-[#081220] border border-[#1e3456] text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer"
          >
            <option value="ALL">Semua Grade</option>
            <option value="A">Grade A (90 - 100)</option>
            <option value="B">Grade B (80 - 89.9)</option>
            <option value="C">Grade C (70 - 79.9)</option>
            <option value="D">Grade D (&lt; 70)</option>
          </select>
        </div>
      </div>

      {/* 4. Main KPI Appraisal Table */}
      <div className="bg-[#0b1728] rounded-2xl border border-[#162744] shadow-md overflow-hidden">
        <div className="p-4 border-b border-[#162744] bg-[#070e1a]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black text-white uppercase flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              Matriks Penilaian Rapor KPI Seluruh Staf Restoran (4 Pilar Operasional)
            </h4>
            <p className="text-[11px] text-slate-400">
              Formula: (Disiplin Masuk × 30%) + (Disiplin Break × 25%) + (Attitude 360° × 35%) + (Bebas Kasbon × 10%)
            </p>
          </div>
          <span className="text-[11px] bg-[#12233f] text-slate-200 border border-[#1d355e] font-bold px-3 py-1 rounded-full">
            {filteredEmployees.length} Karyawan Terdaftar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#070e1a] border-b border-[#162744] text-slate-400 uppercase font-bold text-[10.5px]">
                <th className="py-3 px-4">Karyawan &amp; Stasiun</th>
                <th className="py-3 px-3 text-center">
                  🚪 Masuk Kerja
                  <span className="block text-[9px] text-emerald-400 font-mono">(30%)</span>
                </th>
                <th className="py-3 px-3 text-center">
                  ☕ Istirahat
                  <span className="block text-[9px] text-teal-400 font-mono">(25%)</span>
                </th>
                <th className="py-3 px-3 text-center">
                  🤝 Attitude 360°
                  <span className="block text-[9px] text-purple-400 font-mono">(35%)</span>
                </th>
                <th className="py-3 px-3 text-center">
                  💰 Bebas Kasbon
                  <span className="block text-[9px] text-amber-400 font-mono">(10%)</span>
                </th>
                <th className="py-3 px-3 text-center">
                  Total Nilai
                  <span className="block text-[9px] text-slate-400 font-mono">(0-100)</span>
                </th>
                <th className="py-3 px-3 text-center">Grade</th>
                <th className="py-3 px-3 text-right">Bonus Insentif</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#15243d]">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#12233f] text-amber-400 flex items-center justify-center mx-auto border border-[#1b345d]">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">Belum Ada Data Penilaian KPI Karyawan</p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Seluruh data dummy/mock telah dihapus permanen. Silakan input penilaian kinerja riil staf restoran.
                        </p>
                      </div>
                      <button
                        onClick={() => setIsAddKpiModalOpen(true)}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5 shadow-md"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Input KPI Karyawan Baru</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const finalScore = calculateKpiScore(emp);
                  const gradeInfo = getKpiGrade(finalScore);

                  return (
                    <tr key={emp.id} className="hover:bg-[#0e1d33]/60 transition-colors">
                      {/* Employee Profile */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#12233f] text-base flex items-center justify-center shrink-0 border border-[#1b345d]">
                            {emp.avatar}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">{emp.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{emp.nik}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] font-bold bg-[#142642] text-amber-300 px-1.5 py-0.5 rounded border border-[#1f3a63]">
                                {emp.station}
                              </span>
                              <span className="text-[9px] text-slate-400">• {emp.outlet}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 1. Disiplin Masuk Kerja (30%) */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-block text-center">
                          <span className="font-mono font-black text-xs text-emerald-400">
                            {emp.scoreDisiplinMasuk ?? emp.scoreDisiplin}
                          </span>
                          <div className="w-14 h-1.5 bg-[#142642] rounded-full overflow-hidden mx-auto mt-1">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${emp.scoreDisiplinMasuk ?? emp.scoreDisiplin}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 mt-0.5 block">
                            {emp.lateMinutes === 0 ? '0m Telat' : `${emp.lateMinutes}m Telat`}
                          </span>
                        </div>
                      </td>

                      {/* 2. Disiplin Istirahat / Break Time (25%) */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-block text-center">
                          <span className="font-mono font-black text-xs text-teal-400">
                            {emp.scoreDisiplinIstirahat ?? emp.scoreDisiplin}
                          </span>
                          <div className="w-14 h-1.5 bg-[#142642] rounded-full overflow-hidden mx-auto mt-1">
                            <div
                              className="h-full bg-teal-500 rounded-full"
                              style={{ width: `${emp.scoreDisiplinIstirahat ?? emp.scoreDisiplin}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 mt-0.5 block">
                            {(emp.overBreakMinutes || 0) === 0 ? '0m Over' : `${emp.overBreakMinutes}m Over`}
                          </span>
                        </div>
                      </td>

                      {/* 3. Attitude 360° (35%) */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-block text-center">
                          <span className="font-mono font-black text-xs text-purple-400">{emp.scoreAttitude}</span>
                          <div className="w-16 h-1.5 bg-[#142642] rounded-full overflow-hidden mx-auto mt-1">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${emp.scoreAttitude}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 mt-0.5 block">
                            Survei 360°
                          </span>
                        </div>
                      </td>

                      {/* 4. Bebas Kasbon (10%) - KEMAMPUAN FINANCIAL */}
                      <td className="py-3.5 px-3 text-center">
                        {emp.scoreFinancialKasbon === 100 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              <Check className="h-3 w-3" />
                              100 (Rp 0)
                            </span>
                            <span className="text-[9px] text-emerald-400 font-semibold mt-0.5">Bebas Kasbon</span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              <AlertTriangle className="h-3 w-3" />
                              0 (Ada Kasbon)
                            </span>
                            <span className="text-[9px] text-rose-400 font-semibold mt-0.5">
                              Rp {emp.kasbonAmount.toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Total Score */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="font-mono font-black text-sm text-white">
                          {finalScore}
                        </div>
                        <span className="text-[9px] text-slate-400">Skor Total</span>
                      </td>

                      {/* Grade Badge */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md font-black text-xs border ${gradeInfo.badgeBg} ${gradeInfo.badgeText}`}
                          title={gradeInfo.label}
                        >
                          Grade {gradeInfo.grade}
                        </span>
                      </td>

                      {/* Bonus Insentif */}
                      <td className="py-3.5 px-3 text-right">
                        {gradeInfo.bonusNominal > 0 ? (
                          <div>
                            <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                              +Rp {gradeInfo.bonusNominal.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[9px] text-emerald-400 block mt-0.5 font-bold">
                              ⭐ Insentif Grade A
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-mono text-xs text-slate-400">-</span>
                            <span className="text-[9px] text-slate-500 block mt-0.5">
                              Rp 0 (Non-Grade A)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleOpenDetail(emp)}
                          className="bg-[#12233f] hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[11px] font-bold px-3 py-1 rounded-lg border border-[#1f3a63] hover:border-amber-400 transition"
                        >
                          Detail &amp; Koreksi
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Detail & Evaluation Modal */}
      {selectedKpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="bg-[#0b1728] border border-[#1b2f4f] rounded-2xl w-full max-w-xl text-white shadow-2xl overflow-hidden duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#162744] bg-[#070e1a]/80 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#12233f] text-xl flex items-center justify-center border border-[#1b345d]">
                  {selectedKpi.avatar}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{selectedKpi.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedKpi.nik} • {selectedKpi.station} ({selectedKpi.outlet})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedKpi(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#12233f]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Sliders for 4 Operational Pillars */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-[#0e1d33] p-3.5 rounded-xl border border-[#1d355e] flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-300">Simulasi Skor Akhir:</span>
                  <div className="text-2xl font-black text-amber-400 font-mono">
                    {Math.round(
                      (editScoreDisiplinMasuk * 0.30 +
                        editScoreDisiplinIstirahat * 0.25 +
                        editScoreAttitude * 0.35 +
                        editScoreFinancial * 0.10) *
                        10
                    ) / 10}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-300">Prediksi Grade:</span>
                  <div>
                    <span
                      className={`inline-block px-3 py-1 rounded-lg font-black text-sm border ${
                        getKpiGrade(
                          editScoreDisiplinMasuk * 0.30 +
                            editScoreDisiplinIstirahat * 0.25 +
                            editScoreAttitude * 0.35 +
                            editScoreFinancial * 0.10
                        ).badgeBg
                      } ${
                        getKpiGrade(
                          editScoreDisiplinMasuk * 0.30 +
                            editScoreDisiplinIstirahat * 0.25 +
                            editScoreAttitude * 0.35 +
                            editScoreFinancial * 0.10
                        ).badgeText
                      }`}
                    >
                      Grade{' '}
                      {
                        getKpiGrade(
                          editScoreDisiplinMasuk * 0.30 +
                            editScoreDisiplinIstirahat * 0.25 +
                            editScoreAttitude * 0.35 +
                            editScoreFinancial * 0.10
                        ).grade
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Slider 1: Disiplin Masuk Kerja 30% */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    1. Kedisiplinan Masuk Kerja / Clock-In (Bobot 30%)
                  </span>
                  <span className="font-mono text-emerald-300">{editScoreDisiplinMasuk} / 100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editScoreDisiplinMasuk}
                  onChange={(e) => setEditScoreDisiplinMasuk(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Dihitung dari ketepatan waktu hadir jam prep/opening, presensi biometrik wajah terverifikasi di kiosk POS, dan zero mangkir.
                </p>
              </div>

              {/* Slider 2: Disiplin Jam Istirahat 25% */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-teal-400 flex items-center gap-1.5">
                    <Coffee className="h-3.5 w-3.5" />
                    2. Kedisiplinan Jam Istirahat / Break Tracker (Bobot 25%)
                  </span>
                  <span className="font-mono text-teal-300">{editScoreDisiplinIstirahat} / 100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editScoreDisiplinIstirahat}
                  onChange={(e) => setEditScoreDisiplinIstirahat(Number(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Dihitung dari kepatuhan timer istirahat di kiosk POS, kepatuhan batas kuota toleransi 15 menit/bulan, dan zero over-break.
                </p>
              </div>

              {/* Slider 3: Attitude 360° 35% */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-purple-400 flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5" />
                    3. Sikap Kerja &amp; Survey 360° (Bobot 35%)
                  </span>
                  <span className="font-mono text-purple-300">{editScoreAttitude} / 100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editScoreAttitude}
                  onChange={(e) => setEditScoreAttitude(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Kerjasama tim saat rush hour resto, keramahan 3S tamu, dan hasil review atasan serta rekan sejawat.
                </p>
              </div>

              {/* Slider 4: Bebas Kasbon 10% */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5" />
                    4. Kemandirian Finansial / Bebas Kasbon (Bobot 10%)
                  </span>
                  <span className="font-mono text-amber-300">
                    {editScoreFinancial === 100 ? '100 (Bebas Kasbon ✅)' : '0 (Ada Kasbon ⚠️)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditScoreFinancial(100)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      editScoreFinancial === 100
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-[#12233f] text-slate-300 border-[#1f3a63] hover:bg-[#1a335c]'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    <span>Bebas Kasbon (Skor 100)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditScoreFinancial(0)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      editScoreFinancial === 0
                        ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                        : 'bg-[#12233f] text-slate-300 border-[#1f3a63] hover:bg-[#1a335c]'
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Ada Kasbon (Skor 0)</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Mengukur kematangan finansial pribadi kru. Nilai 100 bila tidak pernah mengajukan kasbon darurat dalam sebulan.
                </p>
              </div>

              {/* Feedback text */}
              <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Catatan Ulasan Supervisor (Umpan Balik Kinerja):
                </label>
                <textarea
                  value={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.value)}
                  rows={2}
                  className="w-full bg-[#081220] border border-[#1e3456] rounded-xl p-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition"
                  placeholder="Berikan apresiasi atau hal yang perlu ditingkatkan..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#162744] bg-[#070e1a]/80 flex justify-end gap-2">
              <button
                onClick={() => setSelectedKpi(null)}
                className="px-4 py-2 bg-[#12233f] hover:bg-[#1a335c] text-slate-300 text-xs font-bold rounded-xl border border-[#1f3a63] transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEvaluation}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition"
              >
                Simpan Evaluasi KPI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Tambah Evaluasi KPI Karyawan Baru */}
      {isAddKpiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="bg-[#0b1728] border border-[#1b2f4f] rounded-2xl w-full max-w-xl text-white shadow-2xl overflow-hidden duration-200">
            <div className="p-5 border-b border-[#162744] bg-[#070e1a]/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Input Evaluasi KPI Karyawan Riil</h3>
                  <p className="text-xs text-slate-400">Tambahkan data performa staf nyata ke sistem rapor kinerja.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddKpiModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#12233f]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              {/* Form Biodata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nama Lengkap Karyawan *</label>
                  <input
                    type="text"
                    value={newKpiForm.name || ''}
                    onChange={(e) => setNewKpiForm({ ...newKpiForm, name: e.target.value })}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full bg-[#081220] border border-[#1e3456] rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">NIK Karyawan</label>
                  <input
                    type="text"
                    value={newKpiForm.nik || ''}
                    onChange={(e) => setNewKpiForm({ ...newKpiForm, nik: e.target.value })}
                    placeholder="Contoh: 1101202201012000"
                    className="w-full bg-[#081220] border border-[#1e3456] rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Outlet / Cabang</label>
                  <select
                    value={newKpiForm.outlet}
                    onChange={(e) => setNewKpiForm({ ...newKpiForm, outlet: e.target.value })}
                    className="w-full bg-[#081220] border border-[#1e3456] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Cabang Senopati, Jaksel">Cabang Senopati, Jaksel</option>
                    <option value="Cabang Kemang, Jaksel">Cabang Kemang, Jaksel</option>
                    <option value="Cabang PIK Pantjoran">Cabang PIK Pantjoran</option>
                    <option value="Cabang BSD, Tangerang">Cabang BSD, Tangerang</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Divisi &amp; Posisi</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newKpiForm.category}
                      onChange={(e) => setNewKpiForm({ ...newKpiForm, category: e.target.value as any })}
                      className="bg-[#081220] border border-[#1e3456] rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="Kitchen">Kitchen</option>
                      <option value="Service">Service</option>
                      <option value="Kasir">Kasir</option>
                    </select>
                    <input
                      type="text"
                      value={newKpiForm.station || ''}
                      onChange={(e) => setNewKpiForm({ ...newKpiForm, station: e.target.value })}
                      placeholder="Stasiun (e.g. Cook)"
                      className="bg-[#081220] border border-[#1e3456] rounded-xl px-2.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Sliders Nilai 4 Pilar */}
              <div className="p-3.5 bg-[#0e1d33] rounded-xl border border-[#1d355e] space-y-3">
                <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block">
                  Nilai 4 Pilar Operasional:
                </span>

                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-[11px]">
                    <span className="text-emerald-400">1. Disiplin Masuk (30%)</span>
                    <span className="font-mono text-emerald-300">{newKpiForm.scoreDisiplinMasuk ?? 90} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newKpiForm.scoreDisiplinMasuk ?? 90}
                    onChange={(e) => setNewKpiForm({ ...newKpiForm, scoreDisiplinMasuk: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-[11px]">
                    <span className="text-teal-400">2. Disiplin Istirahat (25%)</span>
                    <span className="font-mono text-teal-300">{newKpiForm.scoreDisiplinIstirahat ?? 90} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newKpiForm.scoreDisiplinIstirahat ?? 90}
                    onChange={(e) => setNewKpiForm({ ...newKpiForm, scoreDisiplinIstirahat: Number(e.target.value) })}
                    className="w-full accent-teal-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-[11px]">
                    <span className="text-purple-400">3. Attitude 360° (35%)</span>
                    <span className="font-mono text-purple-300">{newKpiForm.scoreAttitude ?? 90} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newKpiForm.scoreAttitude ?? 90}
                    onChange={(e) => setNewKpiForm({ ...newKpiForm, scoreAttitude: Number(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-[11px]">
                    <span className="text-amber-400">4. Bebas Kasbon (10%)</span>
                    <span className="font-mono text-amber-300">
                      {(newKpiForm.scoreFinancialKasbon ?? 100) === 100 ? '100 (Bebas Kasbon ✅)' : '0 (Ada Kasbon ⚠️)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewKpiForm({ ...newKpiForm, scoreFinancialKasbon: 100, hasKasbon: false, kasbonAmount: 0 })}
                      className={`py-1.5 rounded-lg border text-xs font-bold transition ${
                        (newKpiForm.scoreFinancialKasbon ?? 100) === 100
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-[#12233f] text-slate-300 border-[#1f3a63]'
                      }`}
                    >
                      Bebas Kasbon (100)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewKpiForm({ ...newKpiForm, scoreFinancialKasbon: 0, hasKasbon: true, kasbonAmount: 200000 })}
                      className={`py-1.5 rounded-lg border text-xs font-bold transition ${
                        (newKpiForm.scoreFinancialKasbon ?? 100) === 0
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-[#12233f] text-slate-300 border-[#1f3a63]'
                      }`}
                    >
                      Ada Kasbon (0)
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Catatan Ulasan Supervisor</label>
                <textarea
                  value={newKpiForm.attitudeFeedback || ''}
                  onChange={(e) => setNewKpiForm({ ...newKpiForm, attitudeFeedback: e.target.value })}
                  rows={2}
                  placeholder="Catatan performa lapangan..."
                  className="w-full bg-[#081220] border border-[#1e3456] rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="p-4 border-t border-[#162744] bg-[#070e1a]/80 flex justify-end gap-2">
              <button
                onClick={() => setIsAddKpiModalOpen(false)}
                className="px-4 py-2 bg-[#12233f] hover:bg-[#1a335c] text-slate-300 text-xs font-bold rounded-xl border border-[#1f3a63] transition"
              >
                Batal
              </button>
              <button
                onClick={handleAddKpiEmployee}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition"
              >
                Simpan &amp; Tambahkan Karyawan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
