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
