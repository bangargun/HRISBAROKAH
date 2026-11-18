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
      <div className="card flex flex-col justify-between gap-4 p-4 md:flex-row md:items-start">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Pendampingan kru</h2>
          <p className="max-w-2xl text-sm text-slate-600">
            Pendampingan satu-lawan-satu di station kerja oleh Supervisor &amp; Coach HQ untuk menaikkan standar gramatur,
            kecepatan layanan meja 3S, dan kepatuhan SOP resto.
          </p>
        </div>
        <button type="button" onClick={() => setIsScheduleModalOpen(true)} className="btn btn-primary shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Jadwalkan pendampingan
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <label htmlFor="coaching-search" className="sr-only">Cari pendampingan</label>
          <input
            id="coaching-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari agenda, nama staf, NIK"
            className="input pl-9"
          />
        </div>

        <div className="segmented flex-wrap" role="group" aria-label="Saring status">
          {(['ALL', 'Belum Mulai', 'Sedang Berjalan', 'Selesai'] as const).map((st) => (
            <button
              key={st}
              type="button"
              aria-pressed={selectedStatusFilter === st}
              onClick={() => setSelectedStatusFilter(st)}
              className="segmented-item"
            >
              {st === 'ALL' ? 'Semua status' : st}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-head">
                <th scope="col" className="px-4 py-3">Agenda pendampingan</th>
                <th scope="col" className="px-4 py-3">PIC (kru)</th>
                <th scope="col" className="px-4 py-3">Tenggat</th>
                <th scope="col" className="px-4 py-3">Prioritas</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Progres</th>
                <th scope="col" className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    Tidak ada agenda pendampingan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-50">
                    {/* Tugas */}
                    <td className="max-w-xs px-4 py-3">
                      <div className="font-medium leading-snug text-slate-900">{item.topic}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{item.coach}</div>
                    </td>

                    {/* PIC */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm" aria-hidden>
                          {item.avatar}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{item.employeeName}</div>
                          <div className="text-xs text-slate-500">NIK {item.nik}</div>
                          <div className="text-xs text-slate-600">
                            {item.outlet} · {item.station}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Tenggat */}
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{item.dueDate}</td>

                    {/* Prioritas */}
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          item.priority === 'High' ? 'badge-danger' : item.priority === 'Medium' ? 'badge-warning' : 'badge-neutral'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`badge ${
                          item.status === 'Belum Mulai'
                            ? 'badge-neutral'
                            : item.status === 'Sedang Berjalan'
                            ? 'badge-info'
                            : 'badge-success'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${item.progress > 0 ? 'bg-emerald-600' : 'bg-transparent'}`}
                            style={{ width: `${item.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs tabular-nums text-slate-700">{item.progress}%</span>
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.status === 'Belum Mulai') {
                              onUpdateStatus(item.id, 'Sedang Berjalan', 50);
                              showToast(`Sesi "${item.employeeName}" dimulai (Progress: 50%)`);
                            } else if (item.status === 'Sedang Berjalan') {
                              onUpdateStatus(item.id, 'Selesai', 100);
                              showToast(`Sesi "${item.employeeName}" selesai dievaluasi (100%).`);
                            } else {
                              onUpdateStatus(item.id, 'Belum Mulai', 0);
                              showToast(`Status "${item.employeeName}" di-reset`);
                            }
                          }}
                          className="btn btn-sm btn-secondary"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="coaching-schedule-title"
            className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 text-sm shadow-xl"
          >
            <h2 id="coaching-schedule-title" className="text-base font-semibold text-slate-900">
              Jadwalkan sesi pendampingan
            </h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="coaching-topic" className="field-label mb-1">Agenda / fokus coaching</label>
                <input
                  id="coaching-topic"
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="coaching-employee" className="field-label mb-1">Nama staf / PIC</label>
                <input
                  id="coaching-employee"
                  type="text"
                  value={newEmployee}
                  onChange={(e) => setNewEmployee(e.target.value)}
                  placeholder="Nama karyawan"
                  className="input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setIsScheduleModalOpen(false)} className="btn btn-ghost px-4">
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast(`Jadwal pendampingan baru berhasil dibuat!`);
                  setIsScheduleModalOpen(false);
                }}
                className="btn btn-primary px-4"
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
      <div className="card flex flex-col justify-between gap-4 p-4 md:flex-row md:items-start">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Jenjang karier &amp; jalur promosi</h2>
          <p className="max-w-2xl text-sm text-slate-600">
            Kepastian jenjang promosi bagi kru dapur (BOH) dan layanan (FOH), untuk menekan turnover dan menumbuhkan loyalitas
            kerja.
          </p>
        </div>

        <div className="segmented shrink-0 self-start" role="group" aria-label="Jalur karier">
          <button
            type="button"
            aria-pressed={activeCareerTab === 'kitchen'}
            onClick={() => setActiveCareerTab('kitchen')}
            className="segmented-item"
          >
            Dapur (BOH)
          </button>
          <button
            type="button"
            aria-pressed={activeCareerTab === 'service'}
            onClick={() => setActiveCareerTab('service')}
            className="segmented-item"
          >
            Layanan (FOH)
          </button>
        </div>
      </div>

      {/* Tangga level */}
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {currentPath.map((lvl, idx) => (
          <li key={idx} className="card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="badge badge-neutral">{lvl.level}</span>
              <span className="text-xs text-slate-500">{lvl.tenure}</span>
            </div>

            <h3 className="min-h-[2.5rem] text-sm font-semibold leading-tight text-slate-900">{lvl.title}</h3>

            <div className="space-y-0.5 rounded-md bg-slate-50 p-2.5">
              <span className="block text-xs text-slate-500">Standar gaji pokok</span>
              <span className="text-sm font-medium tabular-nums text-slate-900">{lvl.salary}</span>
            </div>

            <div className="border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-600">
              <span className="mb-0.5 block font-medium text-slate-700">Kompetensi utama</span>
              <p>{lvl.skills}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Eligibility Checklist */}
      <section className="card space-y-3 p-4" aria-labelledby="career-eligibility-heading">
        <h2 id="career-eligibility-heading" className="text-sm font-semibold text-slate-900">
          Syarat kenaikan level
        </h2>
        <ol className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
          <li className="space-y-1 rounded-md border border-slate-200 p-3">
            <span className="block font-medium text-slate-900">1. Masa kerja</span>
            <p className="text-xs text-slate-600">Telah menyelesaikan masa kerja minimum di level aktif.</p>
          </li>
          <li className="space-y-1 rounded-md border border-slate-200 p-3">
            <span className="block font-medium text-slate-900">2. Kuis pelatihan</span>
            <p className="text-xs text-slate-600">Nilai evaluasi modul onboarding &amp; resep baku min 85.</p>
          </li>
          <li className="space-y-1 rounded-md border border-slate-200 p-3">
            <span className="block font-medium text-slate-900">3. Rapor kinerja</span>
            <p className="text-xs text-slate-600">Mendapatkan penilaian Rapor berkala Grade A atau B.</p>
          </li>
          <li className="space-y-1 rounded-md border border-slate-200 p-3">
            <span className="block font-medium text-slate-900">4. Tanpa SP aktif</span>
            <p className="text-xs text-slate-600">Tidak memiliki Surat Peringatan aktif dalam 6 bulan terakhir.</p>
          </li>
        </ol>
      </section>
    </div>
  );
}
