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
