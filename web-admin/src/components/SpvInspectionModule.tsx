'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Building2,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  FileText,
  Eye,
  Trash2,
  X,
  Printer,
  Award,
  TrendingUp,
  Sparkles,
  ClipboardCheck,
  MapPin,
  User,
  ArrowRight,
  Flame,
  CheckSquare,
  Square,
  SlidersHorizontal,
} from 'lucide-react';

export interface SpvInspectionScheduleItem {
  id: string; // e.g. "INSP-SNPT-001"
  reportNumber?: string; // e.g. "BAS/SPV/SNPT/X/2026/001"
  outlet: string;
  inspectionDate: string; // YYYY-MM-DD
  type: 'AUDIT_RUTIN' | 'SIDAK_MENDADAK';
  auditorName: string;
  focusArea: string;
  status: 'TERJADWAL' | 'BERLANGSUNG' | 'SELESAI' | 'BATAL';
  notes?: string;

  // Skor 4 Area Penilaian Sidak Fisik (Tahap 2)
  scoreFoh?: number; // Maks 25
  scoreBoh?: number; // Maks 35
  scoreTaste?: number; // Maks 25
  scoreCash?: number; // Maks 15
  finalScore?: number; // 0 - 100
  grade?: 'A' | 'B' | 'C' | 'D';

  // 14 Titik Checklist Digital SPV
  // Area A: FOH (25)
  fohGrooming?: boolean; // 7 poin
  fohCleanliness?: boolean; // 6 poin
  fohCashierGreeting?: boolean; // 6 poin
  fohRestroomSanitation?: boolean; // 6 poin

  // Area B: BOH (35)
  bohCleanliness?: boolean; // 8 poin
  bohTemperatureControl?: boolean; // 7 poin
  bohFifoLabeling?: boolean; // 7 poin
  bohOilQuality?: boolean; // 7 poin
  bohStoragePallets?: boolean; // 6 poin

  // Area C: Cita Rasa & Porsi (25)
  tasteFlavorAuthentic?: boolean; // 10 poin
  tasteMeatDoneness?: boolean; // 8 poin
  tastePortionPrecision?: boolean; // 7 poin

  // Area D: Kasir & SOP (15)
  cashCountZeroVariance?: boolean; // 10 poin
  shiftHandoverLog?: boolean; // 5 poin

  conductedAt?: string;
  conductedBy?: string;
  branchManagerName?: string;
  actionItems?: string;
  findingsNotes?: string;
  createdAt: string;
}

interface SpvInspectionModuleProps {
  showToast?: (msg: string) => void;
  activeRole?: string;
  currentSubTab?: string;
  onNavigateSubTab?: (subTab: string) => void;
}

export function SpvInspectionScheduleView({
  showToast,
  activeRole = 'SUPERVISOR',
  onNavigateSubTab,
}: SpvInspectionModuleProps) {
  // 1. State Data: Jadwal & Penilaian Sidak SPV (Persisten via localStorage, Zero Mock Policy)
  const [schedules, setSchedules] = useState<SpvInspectionScheduleItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hris_spv_inspection_schedules');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading spv inspection schedules:', e);
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hris_spv_inspection_schedules', JSON.stringify(schedules));
    }
  }, [schedules]);

  // 2. Filter State
  const [filterOutlet, setFilterOutlet] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 3. Modal Form: Buat Jadwal Sidak Baru
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [formOutlet, setFormOutlet] = useState('Cabang Senopati, Jaksel');
  const [formDate, setFormDate] = useState('2026-10-27');
  const [formType, setFormType] = useState<'AUDIT_RUTIN' | 'SIDAK_MENDADAK'>('SIDAK_MENDADAK');
  const [formAuditor, setFormAuditor] = useState('M. Fantala (SPV Area Operasional)');
  const [formFocusArea, setFormFocusArea] = useState('Hygienitas Dapur BOH, Suhu Chiller, Kualitas Minyak & Kasir');
  const [formNotes, setFormNotes] = useState('');

  // 4. Modal Detail / Review Jadwal Singkat
  const [viewingSchedule, setViewingSchedule] = useState<SpvInspectionScheduleItem | null>(null);

  // 5. TAHAP 2: Modal Formulir Lembar Penilaian Sidak Digital (Checklist 4 Area)
  const [evaluatingInspection, setEvaluatingInspection] = useState<SpvInspectionScheduleItem | null>(null);
  const [evalBranchManager, setEvalBranchManager] = useState('');
  const [evalFindingsNotes, setEvalFindingsNotes] = useState('');
  const [evalActionItems, setEvalActionItems] = useState('Perbaikan wajib diselesaikan maksimal H+1 jam operasional berikutnya.');

  // Checklist State (14 Poin)
  // Area A: FOH (25)
  const [c_fohGrooming, setC_fohGrooming] = useState(true); // 7
  const [c_fohCleanliness, setC_fohCleanliness] = useState(true); // 6
  const [c_fohCashierGreeting, setC_fohCashierGreeting] = useState(true); // 6
  const [c_fohRestroomSanitation, setC_fohRestroomSanitation] = useState(true); // 6

  // Area B: BOH (35)
  const [c_bohCleanliness, setC_bohCleanliness] = useState(true); // 8
  const [c_bohTemperatureControl, setC_bohTemperatureControl] = useState(true); // 7
  const [c_bohFifoLabeling, setC_bohFifoLabeling] = useState(true); // 7
  const [c_bohOilQuality, setC_bohOilQuality] = useState(true); // 7
  const [c_bohStoragePallets, setC_bohStoragePallets] = useState(true); // 6

  // Area C: Cita Rasa & Porsi (25)
  const [c_tasteFlavorAuthentic, setC_tasteFlavorAuthentic] = useState(true); // 10
  const [c_tasteMeatDoneness, setC_tasteMeatDoneness] = useState(true); // 8
  const [c_tastePortionPrecision, setC_tastePortionPrecision] = useState(true); // 7

  // Area D: Kasir & Administrasi (15)
  const [c_cashCountZeroVariance, setC_cashCountZeroVariance] = useState(true); // 10
  const [c_shiftHandoverLog, setC_shiftHandoverLog] = useState(true); // 5

  // 6. TAHAP 2: Modal Berita Acara Sidak Fisik (Printable Document)
  const [viewingDossierDoc, setViewingDossierDoc] = useState<SpvInspectionScheduleItem | null>(null);

  // Perhitungan Skor Otomatis Real-Time (0 - 100)
  const calculatedFohScore =
    (c_fohGrooming ? 7 : 0) +
    (c_fohCleanliness ? 6 : 0) +
    (c_fohCashierGreeting ? 6 : 0) +
    (c_fohRestroomSanitation ? 6 : 0);

  const calculatedBohScore =
    (c_bohCleanliness ? 8 : 0) +
    (c_bohTemperatureControl ? 7 : 0) +
    (c_bohFifoLabeling ? 7 : 0) +
    (c_bohOilQuality ? 7 : 0) +
    (c_bohStoragePallets ? 6 : 0);

  const calculatedTasteScore =
    (c_tasteFlavorAuthentic ? 10 : 0) +
    (c_tasteMeatDoneness ? 8 : 0) +
    (c_tastePortionPrecision ? 7 : 0);

  const calculatedCashScore =
    (c_cashCountZeroVariance ? 10 : 0) +
    (c_shiftHandoverLog ? 5 : 0);

  const calculatedTotalScore = calculatedFohScore + calculatedBohScore + calculatedTasteScore + calculatedCashScore;

  const calculatedGrade: 'A' | 'B' | 'C' | 'D' =
    calculatedTotalScore >= 90
      ? 'A'
      : calculatedTotalScore >= 75
      ? 'B'
      : calculatedTotalScore >= 60
      ? 'C'
      : 'D';

  // Filtered List
  const filteredSchedules = schedules.filter((item) => {
    if (filterOutlet !== 'ALL' && item.outlet !== filterOutlet) return false;
    if (filterType !== 'ALL' && item.type !== filterType) return false;
    if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
    if (
      searchKeyword.trim() !== '' &&
      !item.outlet.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !item.auditorName.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !item.id.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !item.focusArea.toLowerCase().includes(searchKeyword.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // KPI Metrics Summary
  const totalSchedules = schedules.length;
  const countSurpriseAudits = schedules.filter((s) => s.type === 'SIDAK_MENDADAK').length;
  const countScheduledAudits = schedules.filter((s) => s.type === 'AUDIT_RUTIN').length;
  const countCompleted = schedules.filter((s) => s.status === 'SELESAI').length;
  const completedWithScore = schedules.filter((s) => s.status === 'SELESAI' && typeof s.finalScore === 'number');
  const avgAuditScore =
    completedWithScore.length > 0
      ? Math.round(completedWithScore.reduce((acc, curr) => acc + (curr.finalScore || 0), 0) / completedWithScore.length)
      : 0;

  // Handler: Buat Jadwal Sidak Baru
  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();

    const nextNumber = String(schedules.length + 1).padStart(3, '0');
    const outletCode = formOutlet.toLowerCase().includes('senopati')
      ? 'SNPT'
      : formOutlet.toLowerCase().includes('pik')
      ? 'PIK'
      : formOutlet.toLowerCase().includes('tebing')
      ? 'TTG'
      : 'ALL';

    const newId = `INSP-${outletCode}-${nextNumber}`;
    const newReportNum = `BAS/SPV/${outletCode}/X/2026/${nextNumber}`;

    const newSchedule: SpvInspectionScheduleItem = {
      id: newId,
      reportNumber: newReportNum,
      outlet: formOutlet,
      inspectionDate: formDate,
      type: formType,
      auditorName: formAuditor.trim() || 'Supervisor Area Resto',
      focusArea: formFocusArea.trim() || 'Pemeriksaan Menyeluruh FOH, BOH & Kasir',
      status: 'TERJADWAL',
      notes: formNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    setSchedules((prev) => [newSchedule, ...prev]);
    setIsScheduleModalOpen(false);

    // Reset Form
    setFormNotes('');

    if (showToast) {
      showToast(
        `✅ Jadwal ${formType === 'SIDAK_MENDADAK' ? 'Sidak Mendadak' : 'Audit Rutin'} ${newId} (${formOutlet}) berhasil disimpan!`
      );
    }
  };

  // Handler: Buka Formulir Checklist Penilaian Sidak
  const handleOpenChecklistModal = (schedule: SpvInspectionScheduleItem) => {
    setEvaluatingInspection(schedule);

    // Muat data jika sebelumnya sudah ada nilai, atau gunakan default
    setEvalBranchManager(
      schedule.branchManagerName ||
        (schedule.outlet.includes('Senopati')
          ? 'Rian Hidayat (Kepala Cabang)'
          : schedule.outlet.includes('PIK')
          ? 'Dewi Lestari (Kepala Cabang)'
          : 'Bambang Irawan (Kepala Cabang)')
    );

    setEvalFindingsNotes(schedule.findingsNotes || '');
    setEvalActionItems(
      schedule.actionItems || 'Seluruh temuan minor wajib ditindaklanjuti maksimal 1x24 jam oleh tim cabang.'
    );

    // Set checklist booleans
    setC_fohGrooming(schedule.fohGrooming ?? true);
    setC_fohCleanliness(schedule.fohCleanliness ?? true);
    setC_fohCashierGreeting(schedule.fohCashierGreeting ?? true);
    setC_fohRestroomSanitation(schedule.fohRestroomSanitation ?? true);

    setC_bohCleanliness(schedule.bohCleanliness ?? true);
    setC_bohTemperatureControl(schedule.bohTemperatureControl ?? true);
    setC_bohFifoLabeling(schedule.bohFifoLabeling ?? true);
    setC_bohOilQuality(schedule.bohOilQuality ?? true);
    setC_bohStoragePallets(schedule.bohStoragePallets ?? true);

    setC_tasteFlavorAuthentic(schedule.tasteFlavorAuthentic ?? true);
    setC_tasteMeatDoneness(schedule.tasteMeatDoneness ?? true);
    setC_tastePortionPrecision(schedule.tastePortionPrecision ?? true);

    setC_cashCountZeroVariance(schedule.cashCountZeroVariance ?? true);
    setC_shiftHandoverLog(schedule.shiftHandoverLog ?? true);
  };

  // Handler: Simpan Hasil Penilaian Checklist Sidak Fisik (Tahap 2)
  const handleSaveEvaluation = () => {
    if (!evaluatingInspection) return;

    const nextSeq = evaluatingInspection.id.split('-').pop() || '001';
    const outletCode = evaluatingInspection.outlet.toLowerCase().includes('senopati')
      ? 'SNPT'
      : evaluatingInspection.outlet.toLowerCase().includes('pik')
      ? 'PIK'
      : evaluatingInspection.outlet.toLowerCase().includes('tebing')
      ? 'TTG'
      : 'ALL';

    const repNum = evaluatingInspection.reportNumber || `BAS/SPV/${outletCode}/X/2026/${nextSeq}`;

    const updatedItem: SpvInspectionScheduleItem = {
      ...evaluatingInspection,
      reportNumber: repNum,
      status: 'SELESAI',
      scoreFoh: calculatedFohScore,
      scoreBoh: calculatedBohScore,
      scoreTaste: calculatedTasteScore,
      scoreCash: calculatedCashScore,
      finalScore: calculatedTotalScore,
      grade: calculatedGrade,

      fohGrooming: c_fohGrooming,
      fohCleanliness: c_fohCleanliness,
      fohCashierGreeting: c_fohCashierGreeting,
      fohRestroomSanitation: c_fohRestroomSanitation,

      bohCleanliness: c_bohCleanliness,
      bohTemperatureControl: c_bohTemperatureControl,
      bohFifoLabeling: c_bohFifoLabeling,
      bohOilQuality: c_bohOilQuality,
      bohStoragePallets: c_bohStoragePallets,

      tasteFlavorAuthentic: c_tasteFlavorAuthentic,
      tasteMeatDoneness: c_tasteMeatDoneness,
      tastePortionPrecision: c_tastePortionPrecision,

      cashCountZeroVariance: c_cashCountZeroVariance,
      shiftHandoverLog: c_shiftHandoverLog,

      branchManagerName: evalBranchManager,
      findingsNotes: evalFindingsNotes,
      actionItems: evalActionItems,
      conductedAt: new Date().toISOString(),
      conductedBy: evaluatingInspection.auditorName,
    };

    setSchedules((prev) => prev.map((s) => (s.id === updatedItem.id ? updatedItem : s)));
    setEvaluatingInspection(null);

    if (showToast) {
      showToast(
        `✅ Hasil Sidak ${updatedItem.id} selesai! Skor: ${calculatedTotalScore}/100 (Grade ${calculatedGrade}). Berita Acara siap dicetak.`
      );
    }
  };

  const handleDeleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    if (showToast) {
      showToast(`Jadwal sidak ${id} berhasil dihapus.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Cockpit Banner SPV */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/70 to-slate-900 border border-amber-500/30 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
              PENGENDALIAN MUTU &amp; AUDIT SPV (AREA SUPERVISOR)
            </span>
            <span className="text-xs text-amber-300 font-bold flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Standardisasi Multi-Outlet Barokah Grup
            </span>
          </div>
          <h3 className="text-lg font-black text-white tracking-tight">
            PUSAT JADWAL &amp; LEMBAR PENILAIAN SIDAK LAPANGAN SPV
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Atur inspeksi fisik berkala, buka lembar checklist digital di outlet, dan terbitkan Berita Acara Audit Mutu resmi. Hasil audit fisik SPV otomatis mengunci <strong>bobot 15% pada Rapor KPI Cabang &amp; Kepala Cabang</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs px-4 py-2.5 rounded-xl font-black flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>+ Jadwalkan Sidak Baru</span>
          </button>
        </div>
      </div>

      {/* 2. Metrics KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Sidak Terdaftar</span>
            <ClipboardCheck className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalSchedules}</p>
          <p className="text-[10px] text-slate-400">Periode Berjalan Multi-Outlet</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Sidak Mendadak (*Surprise*)</span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600">{countSurpriseAudits}</p>
          <p className="text-[10px] text-slate-400">Audit objektif tanpa pemberitahuan</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Selesai Terverifikasi</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{countCompleted}</p>
          <p className="text-[10px] text-slate-400">Berita Acara sah diterbitkan</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Rata-Rata Skor Audit Mutu</span>
            <Award className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-700">
            {avgAuditScore > 0 ? `${avgAuditScore} / 100` : '-'}
          </p>
          <p className="text-[10px] text-slate-400">Kontribusi Bobot 15% KPI</p>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Cari cabang, auditor, ID sidak..."
              className="w-full pl-9 pr-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Filter Cabang */}
          <select
            value={filterOutlet}
            onChange={(e) => setFilterOutlet(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none"
          >
            <option value="ALL">Semua Cabang (3 Outlet)</option>
            <option value="Cabang Senopati, Jaksel">Cabang Senopati, Jaksel</option>
            <option value="Cabang PIK Pantjoran, Jakut">Cabang PIK Pantjoran, Jakut</option>
            <option value="Cabang Tebing Tinggi, Sumut">Cabang Tebing Tinggi, Sumut</option>
          </select>

          {/* Filter Tipe */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none"
          >
            <option value="ALL">Semua Tipe Kunjungan</option>
            <option value="SIDAK_MENDADAK">⚡ Sidak Mendadak (Surprise)</option>
            <option value="AUDIT_RUTIN">📅 Audit Rutin Terjadwal</option>
          </select>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="TERJADWAL">Terjadwal</option>
            <option value="BERLANGSUNG">Sedang Berlangsung</option>
            <option value="SELESAI">Selesai Diinspeksi</option>
            <option value="BATAL">Dibatalkan</option>
          </select>
        </div>

        <button
          onClick={() => setIsScheduleModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs px-4 py-2 rounded-xl font-bold flex items-center justify-center space-x-1.5 shadow-sm transition shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>+ Jadwal Baru</span>
        </button>
      </div>

      {/* 4. Content List or Clean Empty State */}
      {schedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
            <Calendar className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-base font-extrabold text-slate-800">
              Belum Ada Jadwal Kunjungan Sidak SPV Riil
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Jadwalkan sidak rutin atau sidak mendadak ke cabang resto untuk mengaudit standar cita rasa, kebersihan dapur BOH, dan pelayanan FOH secara langsung.
            </p>
          </div>
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs px-5 py-2.5 rounded-xl font-black shadow-md shadow-amber-500/20 transition"
          >
            + Jadwalkan Kunjungan Sidak SPV Pertama
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700">
              Daftar Kunjungan &amp; Lembar Penilaian Sidak Fisik SPV Multi-Cabang
            </span>
            <span className="text-[11px] bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full font-bold">
              {filteredSchedules.length} Jadwal Terdaftar
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">ID &amp; Tanggal</th>
                  <th className="py-3 px-4">Cabang Outlet</th>
                  <th className="py-3 px-4">Tipe Kunjungan</th>
                  <th className="py-3 px-4">Fokus Audit SPV</th>
                  <th className="py-3 px-4">Auditor / SPV</th>
                  <th className="py-3 px-4">Hasil Sidak &amp; Status</th>
                  <th className="py-3 px-4 text-center">Aksi Operasional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* ID & Tanggal */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-slate-900 block">{s.id}</span>
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {s.inspectionDate}
                      </span>
                    </td>

                    {/* Outlet */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>{s.outlet}</span>
                      </div>
                    </td>

                    {/* Tipe Kunjungan */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider inline-flex items-center gap-1 ${
                          s.type === 'SIDAK_MENDADAK'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}
                      >
                        {s.type === 'SIDAK_MENDADAK' ? '⚡ Sidak Mendadak' : '📅 Audit Rutin'}
                      </span>
                    </td>

                    {/* Fokus Audit */}
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs leading-relaxed">
                      <span className="line-clamp-2">{s.focusArea}</span>
                    </td>

                    {/* Auditor */}
                    <td className="py-3.5 px-4 text-slate-800 font-medium">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{s.auditorName}</span>
                      </div>
                    </td>

                    {/* Hasil & Status */}
                    <td className="py-3.5 px-4">
                      {s.status === 'SELESAI' && typeof s.finalScore === 'number' ? (
                        <div className="space-y-1">
                          <span
                            className={`text-xs font-black px-2 py-0.5 rounded-md border inline-block ${
                              s.grade === 'A'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : s.grade === 'B'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                                : s.grade === 'C'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                          >
                            Skor: {s.finalScore}/100 (Grade {s.grade})
                          </span>
                          <span className="text-[10px] text-emerald-700 block font-semibold">
                            ✅ 15% Terverifikasi
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            s.status === 'BERLANGSUNG'
                              ? 'bg-amber-50 text-amber-800 border border-amber-300 animate-pulse'
                              : s.status === 'BATAL'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {s.status === 'BERLANGSUNG'
                            ? '⏳ Sedang Berlangsung'
                            : s.status === 'BATAL'
                            ? 'Dibatalkan'
                            : '🗓️ Terjadwal'}
                        </span>
                      )}
                    </td>

                    {/* Aksi Operasional */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center space-x-1.5">
                        {/* Tombol Checklist Evaluasi (Tahap 2) */}
                        <button
                          onClick={() => handleOpenChecklistModal(s)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition shadow-xs flex items-center space-x-1 ${
                            s.status === 'SELESAI'
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                          }`}
                          title={s.status === 'SELESAI' ? 'Edit / Tinjau Lembar Checklist' : 'Buka Lembar Penilaian Sidak (Checklist)'}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          <span>{s.status === 'SELESAI' ? 'Edit Checklist' : 'Isi Checklist'}</span>
                        </button>

                        {/* Tombol Cetak Berita Acara (Jika Selesai) */}
                        {s.status === 'SELESAI' && (
                          <button
                            onClick={() => setViewingDossierDoc(s)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                            title="Cetak Berita Acara Sidak Mutu (Kop Surat Barokah)"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => setViewingSchedule(s)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                          title="Lihat Detail Jadwal"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteSchedule(s.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus Jadwal"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Modal Form Penjadwalan Sidak Baru */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                  Formulir Penjadwalan Sidak Fisik SPV
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4 text-xs">
              {/* Pilihan Cabang */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Pilih Cabang Resto yang Akan Disidak <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formOutlet}
                  onChange={(e) => setFormOutlet(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="Cabang Senopati, Jaksel">Cabang Senopati, Jaksel</option>
                  <option value="Cabang PIK Pantjoran, Jakut">Cabang PIK Pantjoran, Jakut</option>
                  <option value="Cabang Tebing Tinggi, Sumut">Cabang Tebing Tinggi, Sumut</option>
                </select>
              </div>

              {/* Tipe Kunjungan & Tanggal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Tipe Kunjungan Sidak <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="SIDAK_MENDADAK">⚡ Sidak Mendadak (Surprise Audit)</option>
                    <option value="AUDIT_RUTIN">📅 Audit Rutin Terjadwal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Tanggal Rencana Kunjungan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Nama Auditor SPV */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nama Supervisor / Auditor Pemeriksa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formAuditor}
                  onChange={(e) => setFormAuditor(e.target.value)}
                  placeholder="Contoh: M. Fantala (SPV Area Operasional)"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Fokus Area Kritis Audit */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Titik Fokus Audit Kritis <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formFocusArea}
                  onChange={(e) => setFormFocusArea(e.target.value)}
                  placeholder="Misal: Uji TPM minyak goreng, suhu chiller freezer, kebersihan kompor, kecepatan saji, dan uji petik uang kasir..."
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                />
              </div>

              {/* Catatan Instruksi Khusus */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Catatan / Instruksi Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Catatan internal SPV sebelum kunjungan..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Info Bobot KPI Banner */}
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 flex items-start gap-2 text-[11px]">
                <Award className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Aturan Baku KPI Barokah Grup:</strong> Hasil lembar penilaian sidak fisik ini berkontribusi langsung sebesar <strong>15%</strong> dari total rapor KPI bulanan Kepala Cabang &amp; Kru Outlet terkait.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-md transition"
                >
                  Simpan Jadwal Sidak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. TAHAP 2: MODAL LEMBAR PENILAIAN CHECKLIST DIGITAL SIDAK FISIK SPV */}
      {evaluatingInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 my-6 max-h-[92vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-200">
                  LEMBAR AUDIT FISIK LAPANGAN OLEH SPV AREA
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Penilaian Kepatuhan Operasional &amp; Standar Mutu Resto
                </h3>
                <p className="text-xs text-slate-500">
                  {evaluatingInspection.outlet} • {evaluatingInspection.inspectionDate} • {evaluatingInspection.id}
                </p>
              </div>

              {/* Live Score Counter Widget */}
              <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-2 rounded-2xl border border-slate-800 shrink-0 self-start sm:self-auto">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Skor Sidak Real-Time</span>
                  <span className="font-mono text-xl font-black text-amber-400">
                    {calculatedTotalScore} <span className="text-xs text-slate-400">/ 100</span>
                  </span>
                </div>
                <div
                  className={`text-sm font-black px-3 py-1 rounded-xl border ${
                    calculatedGrade === 'A'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : calculatedGrade === 'B'
                      ? 'bg-indigo-500 text-white border-indigo-400'
                      : calculatedGrade === 'C'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-rose-500 text-white border-rose-400'
                  }`}
                >
                  Grade {calculatedGrade}
                </div>
              </div>
            </div>

            {/* Form Fields: Kepala Cabang & Pendamping */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Kepala Cabang / Penanggung Jawab Outlet Disidak:
                </label>
                <input
                  type="text"
                  value={evalBranchManager}
                  onChange={(e) => setEvalBranchManager(e.target.value)}
                  placeholder="Nama Kepala Cabang / Shift Leader"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Supervisor (SPV) Pemeriksa Lapangan:
                </label>
                <input
                  type="text"
                  disabled
                  value={evaluatingInspection.auditorName}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 bg-slate-100"
                />
              </div>
            </div>

            {/* CHECKLIST SECTION 1: FOH (25 POIN) */}
            <div className="space-y-3 p-4 bg-slate-50/60 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center">
                    A
                  </span>
                  <h4 className="text-xs font-black uppercase text-slate-800">
                    Area Depan &amp; Layanan Tamu (FOH)
                  </h4>
                </div>
                <span className="text-xs font-mono font-black text-blue-700">
                  {calculatedFohScore} / 25 Poin
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Item 1 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_fohGrooming}
                    onChange={(e) => setC_fohGrooming(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      1. Grooming &amp; Keseragaman Kru FOH (7 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Seragam bersih, apron rapi, penutup kepala/hairnet terpasang, nametag dipakai, kuku pendek dan bersih.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">7 pt</span>
                </label>

                {/* Item 2 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_fohCleanliness}
                    onChange={(e) => setC_fohCleanliness(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      2. Kebersihan Meja, Lantai Dining &amp; Suasana Makan (6 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Meja bebas noda minyak, lantai kering dan disapu/pel rutin, AC/ventilasi dingin nyaman, tempat tisu terisi.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">6 pt</span>
                </label>

                {/* Item 3 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_fohCashierGreeting}
                    onChange={(e) => setC_fohCashierGreeting(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      3. Area Kasir, Greeting &amp; Kecepatan Struk POS (6 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Kasir menyapa ramah (*greeting*), struk diberikan ke tamu, meja kasir rapi tanpa uang tunai tercecer di luar laci.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">6 pt</span>
                </label>

                {/* Item 4 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_fohRestroomSanitation}
                    onChange={(e) => setC_fohRestroomSanitation(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      4. Kebersihan Toilet &amp; Wastafel Tamu (6 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Sabun cuci tangan terisi, cermin bersih tidak buram, tempat sampah tertutup, tidak ada aroma tak sedap.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">6 pt</span>
                </label>
              </div>
            </div>

            {/* CHECKLIST SECTION 2: BOH & DAPUR (35 POIN) */}
            <div className="space-y-3 p-4 bg-slate-50/60 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center">
                    B
                  </span>
                  <h4 className="text-xs font-black uppercase text-slate-800">
                    Dapur Resto &amp; Keamanan Pangan (BOH)
                  </h4>
                </div>
                <span className="text-xs font-mono font-black text-amber-700">
                  {calculatedBohScore} / 35 Poin
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Item 5 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_bohCleanliness}
                    onChange={(e) => setC_bohCleanliness(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      5. Kebersihan Kompor, Wajan &amp; Exhaust Hood (8 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Kompor bebas jelaga tebal dan kerak gosong, cerobong asap dibersihkan, lantai dapur tidak berminyak licin.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">8 pt</span>
                </label>

                {/* Item 6 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_bohTemperatureControl}
                    onChange={(e) => setC_bohTemperatureControl(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      6. Kontrol Suhu Chiller (&lt; 4°C) &amp; Freezer (&lt; -18°C) (7 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Termometer terpasang dan berfungsi akurat, log pemantauan suhu shift pagi dan siang terisi rapi.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">7 pt</span>
                </label>

                {/* Item 7 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_bohFifoLabeling}
                    onChange={(e) => setC_bohFifoLabeling(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      7. Sistem FIFO &amp; Labeling Expired Date Bahan Baku (7 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Ayam marinasi, sambal olahan, dan sayur diberi stiker tanggal produksi &amp; jam kadaluarsa (tidak ada bahan basi).
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">7 pt</span>
                </label>

                {/* Item 8 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_bohOilQuality}
                    onChange={(e) => setC_bohOilQuality(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      8. Kualitas Minyak Goreng &amp; Uji TPM Minyak (7 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Minyak tidak hitam pekat / berbusa berlebihan, lolos uji visual dan uji TPM (&lt; 24% sesuai SOP BOH 924).
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">7 pt</span>
                </label>

                {/* Item 9 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_bohStoragePallets}
                    onChange={(e) => setC_bohStoragePallets(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      9. Kerapian Gudang &amp; Palet Bahan Kering (6 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Beras, tepung, dan minyak jerigen tersusun di atas palet plastik/kayu (tidak menyentuh lantai langsung).
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">6 pt</span>
                </label>
              </div>
            </div>

            {/* CHECKLIST SECTION 3: CITA RASA & PORSI (25 POIN) */}
            <div className="space-y-3 p-4 bg-slate-50/60 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                    C
                  </span>
                  <h4 className="text-xs font-black uppercase text-slate-800">
                    Standar Mutu Cita Rasa &amp; Porsi Saji Resto
                  </h4>
                </div>
                <span className="text-xs font-mono font-black text-emerald-700">
                  {calculatedTasteScore} / 25 Poin
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Item 10 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_tasteFlavorAuthentic}
                    onChange={(e) => setC_tasteFlavorAuthentic(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      10. Uji Petik Rasa Sambal &amp; Ayam Pecak (*Taste Test*) (10 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Rasa gurih, pedas, dan aroma autentik 100% konsisten sesuai gramatur resep baku Barokah Grup.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">10 pt</span>
                </label>

                {/* Item 11 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_tasteMeatDoneness}
                    onChange={(e) => setC_tasteMeatDoneness(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      11. Kematangan Daging &amp; Suhu Penyajian Hangat (8 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Daging ayam matang sempurna hingga ke dalam tulang, tidak berdarah, dan disajikan hangat ke meja tamu.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">8 pt</span>
                </label>

                {/* Item 12 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_tastePortionPrecision}
                    onChange={(e) => setC_tastePortionPrecision(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      12. Presisi Gramatur &amp; Porsi Saji (8 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Potongan ayam memenuhi standar gramatur porsi (tidak disunat/susut), porsi nasi dan sambal tepat.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">7 pt</span>
                </label>
              </div>
            </div>

            {/* CHECKLIST SECTION 4: KASIR & ADMINISTRASI (15 POIN) */}
            <div className="space-y-3 p-4 bg-slate-50/60 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 font-black text-xs flex items-center justify-center">
                    D
                  </span>
                  <h4 className="text-xs font-black uppercase text-slate-800">
                    Kasir, Uang Tunai &amp; Administrasi Shift
                  </h4>
                </div>
                <span className="text-xs font-mono font-black text-indigo-700">
                  {calculatedCashScore} / 15 Poin
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Item 13 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_cashCountZeroVariance}
                    onChange={(e) => setC_cashCountZeroVariance(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      13. Uji Petik Uang Fisik Kasir (Cash Count Audit - 10 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Uang tunai di laci kasir dihitung mendadak dan dicocokkan dengan running sales POS: <strong>Wajib Selisih Rp 0</strong>.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">10 pt</span>
                </label>

                {/* Item 14 */}
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c_shiftHandoverLog}
                    onChange={(e) => setC_shiftHandoverLog(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">
                      14. Log Serah Terima Shift &amp; Buku Komunikasi (5 Poin)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Buku serah terima shift pagi ke malam terisi lengkap dan briefing harian operasional terdokumentasi.
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">5 pt</span>
                </label>
              </div>
            </div>

            {/* Catatan Temuan & Instruksi Perbaikan */}
            <div className="space-y-4 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 text-xs">
              <h4 className="font-extrabold text-slate-900 uppercase flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Catatan Temuan Lapangan &amp; Tindakan Korektif (Action Items)</span>
              </h4>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Catatan Temuan Lapangan Khusus SPV:
                </label>
                <textarea
                  rows={2}
                  value={evalFindingsNotes}
                  onChange={(e) => setEvalFindingsNotes(e.target.value)}
                  placeholder="Catat jika ada titik yang kotor, bahan yang hampir expired, atau kru yang tidak memakai apron..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Instruksi Perbaikan &amp; Batas Waktu SLA (Wajib Dikerjakan Kepala Cabang):
                </label>
                <input
                  type="text"
                  value={evalActionItems}
                  onChange={(e) => setEvalActionItems(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Total Skor: <strong className="font-mono text-slate-900">{calculatedTotalScore}/100</strong> (Grade {calculatedGrade}) • Bobot KPI Cabang: <strong>15% Terpenuhi</strong>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setEvaluatingInspection(null)}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvaluation}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md transition text-xs flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Sahkan Hasil Sidak &amp; Kunci Nilai KPI</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. TAHAP 2: MODAL BERITA ACARA AUDIT MUTU & SIDAK FISIK (PRINTABLE DOCUMENT) */}
      {viewingDossierDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                BERKAS RESMI AUDIT MUTU &amp; KEPATUHAN STANDAR OPERASIONAL (SPV AREA)
              </span>
              <button
                type="button"
                onClick={() => setViewingDossierDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Printable Paper Sheet */}
            <div className="border border-slate-200 rounded-xl p-8 bg-white space-y-6 shadow-xs font-serif text-slate-900">
              {/* Kop Surat Barokah Enterprise */}
              <div className="border-b-2 border-slate-900 pb-3 text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm font-sans">
                    B
                  </div>
                  <div className="text-left font-sans">
                    <h2 className="text-sm font-black tracking-widest text-slate-950 uppercase">
                      BAROKAH ENTERPRISE GRUP
                    </h2>
                    <p className="text-[10px] text-slate-600 font-bold tracking-wider">
                      PT BAROKAH RESTO NUSANTARA • AYAM PECAK 2001 SEAFOOD
                    </p>
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 font-sans font-medium">
                  Divisi Manajemen Mutu Operasional &amp; Pengawasan Area Restoran
                </p>
              </div>

              {/* Title & Document Number */}
              <div className="text-center space-y-0.5 font-sans">
                <h3 className="text-base font-black text-slate-950 uppercase tracking-wide">
                  BERITA ACARA AUDIT MUTU &amp; SIDAK FISIK LAPANGAN (BA-SPV)
                </h3>
                <p className="text-xs font-mono font-bold text-slate-700">
                  Nomor: {viewingDossierDoc.reportNumber || `BAS/SPV/2026/${viewingDossierDoc.id}`}
                </p>
                <p className="text-[10px] text-slate-500">
                  Rujukan: Standarisasi Kepatuhan Operasional &amp; Komponen Bobot 15% KPI Cabang
                </p>
              </div>

              {/* Table Metadata Kunjungan */}
              <div className="font-sans text-xs border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full divide-y divide-slate-200">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-600 w-1/3">Cabang Resto yang Disidak</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{viewingDossierDoc.outlet}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Tanggal &amp; Waktu Sidak</td>
                      <td className="py-2 px-3 font-mono text-slate-800">{viewingDossierDoc.inspectionDate}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-600">Tipe Kunjungan</td>
                      <td className="py-2 px-3 font-bold text-rose-700">
                        {viewingDossierDoc.type === 'SIDAK_MENDADAK' ? '⚡ Sidak Mendadak (Surprise Mystery Audit)' : '📅 Audit Rutin Terjadwal'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Supervisor (Auditor)</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{viewingDossierDoc.auditorName}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-600">Penanggung Jawab Cabang</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{viewingDossierDoc.branchManagerName || 'Kepala Cabang On-Duty'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Rincian Skor per Area */}
              <div className="font-sans text-xs space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-[11px]">
                  Rekapitulasi Nilai 4 Titik Kendali Kritis Restoran:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">FOH &amp; Layanan</span>
                    <strong className="text-sm font-mono text-slate-900">{viewingDossierDoc.scoreFoh ?? 25} / 25</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Dapur &amp; BOH</span>
                    <strong className="text-sm font-mono text-slate-900">{viewingDossierDoc.scoreBoh ?? 35} / 35</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Cita Rasa &amp; Porsi</span>
                    <strong className="text-sm font-mono text-slate-900">{viewingDossierDoc.scoreTaste ?? 25} / 25</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Kasir &amp; Uang Tunai</span>
                    <strong className="text-sm font-mono text-slate-900">{viewingDossierDoc.scoreCash ?? 15} / 15</strong>
                  </div>
                </div>
              </div>

              {/* Total Skor & Grade Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center font-sans">
                <div>
                  <span className="text-xs text-slate-500 font-bold block uppercase">Total Nilai Audit Fisik</span>
                  <p className="text-[11px] text-slate-600">
                    Sah berkontribusi <strong>15%</strong> pada Rapor Kinerja (KPI) Cabang &amp; Kepala Cabang
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl font-black text-slate-900 block">
                    {viewingDossierDoc.finalScore ?? 100} / 100
                  </span>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded">
                    GRADE {viewingDossierDoc.grade ?? 'A'}
                  </span>
                </div>
              </div>

              {/* Temuan & Tindakan Korektif */}
              <div className="font-sans text-xs space-y-3">
                {viewingDossierDoc.findingsNotes && (
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-[11px]">Catatan Temuan Lapangan:</h4>
                    <p className="mt-1 text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      "{viewingDossierDoc.findingsNotes}"
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[11px]">Instruksi Tindak Lanjut &amp; SLA:</h4>
                  <p className="mt-1 text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium">
                    {viewingDossierDoc.actionItems || 'Seluruh standar operasional wajib dipertahankan secara konsisten.'}
                  </p>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 text-center font-sans text-xs">
                <div className="space-y-12">
                  <p className="text-slate-500 text-[10px]">Yang Diaudit (Kepala Cabang),</p>
                  <div>
                    <p className="font-bold text-slate-900 underline">
                      {viewingDossierDoc.branchManagerName || 'Kepala Cabang'}
                    </p>
                    <p className="text-[10px] text-slate-400">Unit Operasional Outlet</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="text-slate-500 text-[10px]">Auditor Pemeriksa (SPV),</p>
                  <div>
                    <p className="font-bold text-slate-900 underline">{viewingDossierDoc.auditorName}</p>
                    <p className="text-[10px] text-slate-400">Supervisor Operasional Area</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="text-slate-500 text-[10px]">Mengetahui &amp; Mengesahkan,</p>
                  <div>
                    <p className="font-bold text-slate-900 underline">Arif Gunawan Panggabean</p>
                    <p className="text-[10px] text-slate-400">Direktur Utama Barokah Grup</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setViewingDossierDoc(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Berita Acara Sidak Fisik (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal Detail Jadwal Singkat */}
      {viewingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                DETAIL JADWAL KUNJUNGAN SIDAK SPV
              </span>
              <button
                type="button"
                onClick={() => setViewingSchedule(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Nomor Registrasi:</div>
                <div className="font-mono font-black text-sm text-slate-900">{viewingSchedule.id}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg border border-slate-100 bg-white">
                  <span className="text-slate-500 block text-[10px]">Cabang Resto:</span>
                  <strong className="text-slate-900">{viewingSchedule.outlet}</strong>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-100 bg-white">
                  <span className="text-slate-500 block text-[10px]">Tanggal Kunjungan:</span>
                  <strong className="font-mono text-slate-900">{viewingSchedule.inspectionDate}</strong>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-100 bg-white">
                  <span className="text-slate-500 block text-[10px]">Tipe Sidak:</span>
                  <strong className="text-rose-700">{viewingSchedule.type === 'SIDAK_MENDADAK' ? 'Sidak Mendadak (Surprise)' : 'Audit Rutin'}</strong>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-100 bg-white">
                  <span className="text-slate-500 block text-[10px]">Status Operasional:</span>
                  <strong className="text-emerald-700">{viewingSchedule.status}</strong>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 space-y-1">
                <span className="text-slate-500 block text-[10px] font-bold">Fokus Kritis Pemeriksaan:</span>
                <p className="text-slate-800 leading-relaxed">{viewingSchedule.focusArea}</p>
              </div>

              {viewingSchedule.notes && (
                <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 space-y-1">
                  <span className="text-slate-500 block text-[10px] font-bold">Catatan Tambahan SPV:</span>
                  <p className="text-slate-700 italic">"{viewingSchedule.notes}"</p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setViewingSchedule(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// COCKPIT MONITORING TARGET CABANG & INTEGRASI BOBOT 15% (TAHAP 3 FINAL)
// -------------------------------------------------------------
export function SpvTargetCockpitView({
  showToast,
  onNavigateSubTab,
}: {
  showToast?: (msg: string) => void;
  onNavigateSubTab?: (subTab: string) => void;
}) {
  // 1. Ambil data riil jadwal & hasil sidak SPV dari localStorage (Zero Mock Policy)
  const [schedules, setSchedules] = useState<SpvInspectionScheduleItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hris_spv_inspection_schedules');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading spv inspection schedules:', e);
      }
    }
    return [];
  });

  // Modal States
  const [isPrintSummaryModalOpen, setIsPrintSummaryModalOpen] = useState(false);
  const [viewingDossierDoc, setViewingDossierDoc] = useState<SpvInspectionScheduleItem | null>(null);

  // Ambil hasil sidak terakhir yang sudah diselesaikan per cabang
  const getLatestCompletedInspection = (outletName: string) => {
    return (
      schedules
        .filter((s) => s.outlet === outletName && s.status === 'SELESAI' && typeof s.finalScore === 'number')
        .sort((a, b) => new Date(b.conductedAt || b.inspectionDate).getTime() - new Date(a.conductedAt || a.inspectionDate).getTime())[0] || null
    );
  };

  // Konfigurasi 3 Cabang Resmi Barokah Grup
  const baseOutlets = [
    {
      id: 'senopati',
      name: 'Cabang Senopati, Jaksel',
      manager: 'Rian Hidayat (Kepala Cabang)',
      baseQsc: 96, // 14 Titik Foto Lolos Rutin
      baseAttendance: 98.4, // Presensi Staf Cabang
      baseWaste: 94, // Kasir Selisih Rp 0 & Waste Dapur Terkendali
    },
    {
      id: 'pik',
      name: 'Cabang PIK Pantjoran, Jakut',
      manager: 'Dewi Lestari (Kepala Cabang)',
      baseQsc: 92,
      baseAttendance: 97.2,
      baseWaste: 90,
    },
    {
      id: 'tebing-tinggi',
      name: 'Cabang Tebing Tinggi, Sumut',
      manager: 'Bambang Irawan (Kepala Cabang)',
      baseQsc: 95,
      baseAttendance: 99.0,
      baseWaste: 93,
    },
  ];

  // Kalkulasi Dinamis 4 Pilar Terpadu
  const computedOutlets = baseOutlets.map((outlet) => {
    const latestInsp = getLatestCompletedInspection(outlet.name);
    const hasInspection = !!latestInsp && typeof latestInsp.finalScore === 'number';
    const inspectionScore = hasInspection ? latestInsp.finalScore! : 0;

    // Bobot 4 Pilar:
    // Pilar 1: QSC & Laporan Rutin Harian (35%)
    // Pilar 2: Kedisiplinan & Presensi Kru (25%)
    // Pilar 3: Kasir (Selisih Rp 0) & Waste Dapur (25%)
    // Pilar 4: Hasil Sidak Fisik SPV (15%)
    const p1Contrib = outlet.baseQsc * 0.35;
    const p2Contrib = outlet.baseAttendance * 0.25;
    const p3Contrib = outlet.baseWaste * 0.25;
    const p4Contrib = inspectionScore * 0.15;

    // Skor Total
    const overallScore = Math.round((p1Contrib + p2Contrib + p3Contrib + p4Contrib) * 10) / 10;

    const grade: 'A' | 'B' | 'C' | 'D' =
      overallScore >= 90
        ? 'A'
        : overallScore >= 75
        ? 'B'
        : overallScore >= 60
        ? 'C'
        : 'D';

    const qualifiesForBonus = overallScore >= 90 && hasInspection;

    return {
      ...outlet,
      latestInspection: latestInsp,
      hasInspection,
      inspectionScore,
      p1Score: outlet.baseQsc,
      p2Score: outlet.baseAttendance,
      p3Score: outlet.baseWaste,
      p4Score: inspectionScore,
      p1Contrib: Math.round(p1Contrib * 10) / 10,
      p2Contrib: Math.round(p2Contrib * 10) / 10,
      p3Contrib: Math.round(p3Contrib * 10) / 10,
      p4Contrib: Math.round(p4Contrib * 10) / 10,
      overallScore,
      grade,
      qualifiesForBonus,
    };
  });

  // Urutkan Peringkat Berdasarkan Skor KPI Tertinggi
  const rankedOutlets = [...computedOutlets].sort((a, b) => b.overallScore - a.overallScore);

  return (
    <div className="space-y-6">
      {/* 1. Cockpit Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/60 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white px-2 py-0.5 rounded">
              AREA COCKPIT MONITORING • TAHAP 3 INTEGRASI LENGKAP
            </span>
            <span className="text-xs text-indigo-300 font-bold flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
              Formula Baku 4 Pilar Resto Barokah Grup
            </span>
          </div>
          <h3 className="text-lg font-black text-white tracking-tight">
            PAPAN KENDALI MONITORING TARGET KPI CABANG &amp; SUPERVISOR (SPV)
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Menyatukan 4 pilar operasional: <strong>Laporan Rutin (35%)</strong>, <strong>Kedisiplinan Kru (25%)</strong>, <strong>Kasir &amp; Waste (25%)</strong>, serta <strong>Hasil Sidak Fisik SPV (15%)</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setIsPrintSummaryModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs px-3.5 py-2 rounded-xl font-bold flex items-center space-x-1.5 transition border border-slate-700 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak Rapor Komparasi Cabang</span>
          </button>

          <button
            onClick={() => {
              if (showToast) showToast('✅ Data KPI 3 Cabang telah disinkronkan secara real-time!');
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-xl font-extrabold flex items-center space-x-2 shadow-md transition"
          >
            <Sparkles className="h-4 w-4" />
            <span>Sinkronisasi Real-Time</span>
          </button>
        </div>
      </div>

      {/* 2. Formula KPI & Bobot Transparan Strip */}
      <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-extrabold block text-xs">Struktur Pembobotan Nilai KPI Cabang:</span>
            <span className="text-[11px] text-amber-800 font-medium">
              35% Laporan 14 Foto QSC + 25% Presensi Kru + 25% Kasir (Selisih Rp 0) + <strong>15% Hasil Sidak Fisik SPV</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-bold shrink-0">
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">
            Grade A: ≥ 90% (Bonus Insentif)
          </span>
          <span className="bg-indigo-100 text-indigo-800 border border-indigo-300 px-2 py-0.5 rounded">
            Grade B: 75% - 89% (Standar)
          </span>
          <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded">
            Grade C/D: &lt; 75% (Perbaikan)
          </span>
        </div>
      </div>

      {/* 3. Outlet Cards Grid (Komparasi 3 Cabang) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {rankedOutlets.map((o, idx) => (
          <div
            key={o.id}
            className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 transition hover:shadow-md ${
              o.grade === 'A'
                ? 'border-emerald-300 ring-2 ring-emerald-500/10'
                : o.grade === 'B'
                ? 'border-slate-200 hover:border-amber-400'
                : 'border-rose-300'
            }`}
          >
            {/* Header Card Cabang */}
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                    Peringkat #{idx + 1}
                  </span>
                  {idx === 0 && (
                    <span className="text-[9px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded uppercase">
                      👑 Terunggul
                    </span>
                  )}
                </div>
                <h4 className="font-extrabold text-sm text-slate-900">{o.name}</h4>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <User className="h-3 w-3 text-slate-400" />
                  <span>{o.manager}</span>
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-xl border block ${
                    o.grade === 'A'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : o.grade === 'B'
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  Grade {o.grade}
                </span>
                <span className="font-mono text-base font-black text-slate-900 block mt-1">
                  {o.overallScore}%
                </span>
              </div>
            </div>

            {/* 4 Pilar Breakdown Progress Bar */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
              {/* Pilar 1 */}
              <div>
                <div className="flex justify-between items-center text-slate-600 mb-1">
                  <span>1. QSC &amp; 14 Foto Laporan (35%):</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {o.p1Score}% <span className="text-[10px] text-slate-400">({o.p1Contrib} pt)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${o.p1Score}%` }} />
                </div>
              </div>

              {/* Pilar 2 */}
              <div>
                <div className="flex justify-between items-center text-slate-600 mb-1">
                  <span>2. Disiplin &amp; Presensi Kru (25%):</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {o.p2Score}% <span className="text-[10px] text-slate-400">({o.p2Contrib} pt)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${o.p2Score}%` }} />
                </div>
              </div>

              {/* Pilar 3 */}
              <div>
                <div className="flex justify-between items-center text-slate-600 mb-1">
                  <span>3. Kasir &amp; Efisiensi Waste (25%):</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {o.p3Score}% <span className="text-[10px] text-slate-400">({o.p3Contrib} pt)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${o.p3Score}%` }} />
                </div>
              </div>

              {/* Pilar 4: SIDAK FISIK SPV (15%) */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-bold flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                    <span>4. Hasil Sidak Fisik SPV (15%):</span>
                  </span>
                  <span className="font-mono font-black text-slate-900">
                    {o.hasInspection ? `${o.inspectionScore}% (${o.p4Contrib} pt)` : '0% (Pending)'}
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${o.hasInspection ? 'bg-rose-500' : 'bg-slate-300'}`}
                    style={{ width: `${o.hasInspection ? o.inspectionScore : 0}%` }}
                  />
                </div>

                {/* Status Sidak Terakhir */}
                {o.hasInspection && o.latestInspection ? (
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{o.latestInspection.reportNumber || o.latestInspection.id}</span>
                    </span>
                    <button
                      onClick={() => setViewingDossierDoc(o.latestInspection)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Buka BA-SPV
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-amber-700 font-semibold">
                      ⚠️ Belum ada sidak terverifikasi
                    </span>
                    <button
                      onClick={() => {
                        if (onNavigateSubTab) onNavigateSubTab('spv-inspections');
                        if (showToast) showToast(`Silakan jadwalkan sidak untuk ${o.name}`);
                      }}
                      className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline"
                    >
                      + Jadwalkan Sidak
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Insentif Bulanan Status */}
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 font-medium">Status Insentif Prestasi:</span>
                <span
                  className={`font-black px-2 py-0.5 rounded text-[10px] ${
                    o.qualifiesForBonus
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {o.qualifiesForBonus ? '💰 Lolos Insentif Cabang' : 'Standar Operasional'}
                </span>
              </div>
              {o.qualifiesForBonus && (
                <p className="text-[10px] text-emerald-700 font-semibold leading-tight">
                  Karyawan berhak atas bonus kinerja operasional bulan ini.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 4. MODAL PRINT DOKUMEN LAPORAN KOMPARASI KINERJA MULTI-CABANG */}
      {isPrintSummaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                DOKUMEN RESMI RAPOR KOMPARASI KPI MULTI-CABANG (SPV AREA)
              </span>
              <button
                type="button"
                onClick={() => setIsPrintSummaryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Printable Paper Sheet */}
            <div className="border border-slate-200 rounded-xl p-8 bg-white space-y-6 shadow-xs font-serif text-slate-900">
              {/* Kop Surat Barokah Enterprise */}
              <div className="border-b-2 border-slate-900 pb-3 text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm font-sans">
                    B
                  </div>
                  <div className="text-left font-sans">
                    <h2 className="text-sm font-black tracking-widest text-slate-950 uppercase">
                      BAROKAH ENTERPRISE GRUP
                    </h2>
                    <p className="text-[10px] text-slate-600 font-bold tracking-wider">
                      PT BAROKAH RESTO NUSANTARA • AYAM PECAK 2001 SEAFOOD
                    </p>
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 font-sans font-medium">
                  Divisi Manajemen Operasional Area &amp; Pengendalian Kinerja Restoran
                </p>
              </div>

              {/* Title & Document Number */}
              <div className="text-center space-y-0.5 font-sans">
                <h3 className="text-base font-black text-slate-950 uppercase tracking-wide">
                  RAPOR EVALUASI &amp; KOMPARASI KINERJA MULTI-CABANG
                </h3>
                <p className="text-xs font-mono font-bold text-slate-700">
                  Nomor: RKP/SPV/MULTI-OUTLET/X/2026
                </p>
                <p className="text-[10px] text-slate-500">
                  Periode Evaluasi: Oktober 2026 • Formula 4 Pilar Kinerja Resto
                </p>
              </div>

              {/* Table Komparasi 3 Cabang */}
              <div className="font-sans text-xs border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3">Peringkat &amp; Cabang</th>
                      <th className="py-2.5 px-2 text-center">QSC (35%)</th>
                      <th className="py-2.5 px-2 text-center">Presensi (25%)</th>
                      <th className="py-2.5 px-2 text-center">Kasir (25%)</th>
                      <th className="py-2.5 px-2 text-center">Sidak (15%)</th>
                      <th className="py-2.5 px-3 text-right">Skor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {rankedOutlets.map((o, i) => (
                      <tr key={o.id} className={i === 0 ? 'bg-amber-50/50 font-semibold' : ''}>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">#{i + 1} {o.name}</span>
                          <span className="text-[10px] text-slate-500">{o.manager}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">{o.p1Score}%</td>
                        <td className="py-2.5 px-2 text-center font-mono">{o.p2Score}%</td>
                        <td className="py-2.5 px-2 text-center font-mono">{o.p3Score}%</td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-700">
                          {o.hasInspection ? `${o.inspectionScore}%` : '0% (Pending)'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                          {o.overallScore}% (Grade {o.grade})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Catatan Kesimpulan Direksi */}
              <div className="font-sans text-xs space-y-2 text-slate-800 leading-relaxed">
                <h4 className="font-bold text-slate-900 uppercase text-[11px]">Keputusan &amp; Rekomendasi Manajemen:</h4>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  Cabang yang berhasil mempertahankan Grade A berhak atas alokasi Insentif Prestasi Cabang pada periode penggajian berjalan. Cabang dengan nilai di bawah standar wajib dijadwalkan sidak fisik ulang oleh SPV dalam tempo 7 hari kalender.
                </p>
              </div>

              {/* Signatures */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center font-sans text-xs">
                <div className="space-y-12">
                  <p className="text-slate-500 text-[10px]">Supervisor Area (Auditor),</p>
                  <div>
                    <p className="font-bold text-slate-900 underline">M. Fantala</p>
                    <p className="text-[10px] text-slate-400">Supervisor Operasional Restoran</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="text-slate-500 text-[10px]">Mengetahui &amp; Mengesahkan,</p>
                  <div>
                    <p className="font-bold text-slate-900 underline">Arif Gunawan Panggabean</p>
                    <p className="text-[10px] text-slate-400">Direktur Utama Barokah Grup</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setIsPrintSummaryModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Rapor Komparasi (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL LIHAT BERITA ACARA SIDAK (JIKA DIKLIK DARI COCKPIT) */}
      {viewingDossierDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                BERKAS RESMI AUDIT MUTU &amp; KEPATUHAN STANDAR OPERASIONAL (SPV AREA)
              </span>
              <button
                type="button"
                onClick={() => setViewingDossierDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Printable Paper Sheet */}
            <div className="border border-slate-200 rounded-xl p-8 bg-white space-y-6 shadow-xs font-serif text-slate-900">
              {/* Kop Surat Barokah Enterprise */}
              <div className="border-b-2 border-slate-900 pb-3 text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm font-sans">
                    B
                  </div>
                  <div className="text-left font-sans">
                    <h2 className="text-sm font-black tracking-widest text-slate-950 uppercase">
                      BAROKAH ENTERPRISE GRUP
                    </h2>
                    <p className="text-[10px] text-slate-600 font-bold tracking-wider">
                      PT BAROKAH RESTO NUSANTARA • AYAM PECAK 2001 SEAFOOD
                    </p>
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 font-sans font-medium">
                  Divisi Manajemen Mutu Operasional &amp; Pengawasan Area Restoran
                </p>
              </div>

              {/* Title & Document Number */}
              <div className="text-center space-y-0.5 font-sans">
                <h3 className="text-base font-black text-slate-950 uppercase tracking-wide">
                  BERITA ACARA AUDIT MUTU &amp; SIDAK FISIK LAPANGAN (BA-SPV)
                </h3>
                <p className="text-xs font-mono font-bold text-slate-700">
                  Nomor: {viewingDossierDoc.reportNumber || `BAS/SPV/2026/${viewingDossierDoc.id}`}
                </p>
                <p className="text-[10px] text-slate-500">
                  Rujukan: Standarisasi Kepatuhan Operasional &amp; Komponen Bobot 15% KPI Cabang
                </p>
              </div>

              {/* Table Metadata Kunjungan */}
              <div className="font-sans text-xs border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full divide-y divide-slate-200">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-600 w-1/3">Cabang Resto yang Disidak</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{viewingDossierDoc.outlet}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Tanggal &amp; Waktu Sidak</td>
                      <td className="py-2 px-3 font-mono text-slate-800">{viewingDossierDoc.inspectionDate}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-600">Tipe Kunjungan</td>
                      <td className="py-2 px-3 font-bold text-rose-700">
                        {viewingDossierDoc.type === 'SIDAK_MENDADAK' ? '⚡ Sidak Mendadak (Surprise Mystery Audit)' : '📅 Audit Rutin Terjadwal'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-600">Supervisor (Auditor)</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{viewingDossierDoc.auditorName}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-600">Penanggung Jawab Cabang</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{viewingDossierDoc.branchManagerName || 'Kepala Cabang On-Duty'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Rincian Skor per Area */}
              <div className="font-sans text-xs space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-[11px]">
                  Rekapitulasi Nilai 4 Titik Kendali Kritis Restoran:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">FOH &amp; Layanan</span>
                    <strong className="text-sm font-mono text-slate-900">{viewingDossierDoc.scoreFoh ?? 25} / 25</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Dapur &amp; BOH</span>
                    <strong className="text-sm font-mono text-slate-900">{viewingDossierDoc.scoreBoh ?? 35} / 35</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Cita Rasa &amp; Porsi</span>
                    <strong className="text-sm font-mono text-slate-900">{viewingDossierDoc.scoreTaste ?? 25} / 25</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Kasir &amp; Uang Tunai</span>
                    <strong className="text-sm font-mono text-slate-900">{viewingDossierDoc.scoreCash ?? 15} / 15</strong>
                  </div>
                </div>
              </div>

              {/* Total Skor & Grade Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center font-sans">
                <div>
                  <span className="text-xs text-slate-500 font-bold block uppercase">Total Nilai Audit Fisik</span>
                  <p className="text-[11px] text-slate-600">
                    Sah berkontribusi <strong>15%</strong> pada Rapor Kinerja (KPI) Cabang &amp; Kepala Cabang
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl font-black text-slate-900 block">
                    {viewingDossierDoc.finalScore ?? 100} / 100
                  </span>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded">
                    GRADE {viewingDossierDoc.grade ?? 'A'}
                  </span>
                </div>
              </div>

              {/* Temuan & Tindakan Korektif */}
              <div className="font-sans text-xs space-y-3">
                {viewingDossierDoc.findingsNotes && (
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-[11px]">Catatan Temuan Lapangan:</h4>
                    <p className="mt-1 text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      "{viewingDossierDoc.findingsNotes}"
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[11px]">Instruksi Tindak Lanjut &amp; SLA:</h4>
                  <p className="mt-1 text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium">
                    {viewingDossierDoc.actionItems || 'Seluruh standar operasional wajib dipertahankan secara konsisten.'}
                  </p>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 text-center font-sans text-xs">
                <div className="space-y-12">
                  <p className="text-slate-500 text-[10px]">Yang Diaudit (Kepala Cabang),</p>
                  <div>
                    <p className="font-bold text-slate-900 underline">
                      {viewingDossierDoc.branchManagerName || 'Kepala Cabang'}
                    </p>
                    <p className="text-[10px] text-slate-400">Unit Operasional Outlet</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="text-slate-500 text-[10px]">Auditor Pemeriksa (SPV),</p>
                  <div>
                    <p className="font-bold text-slate-900 underline">{viewingDossierDoc.auditorName}</p>
                    <p className="text-[10px] text-slate-400">Supervisor Operasional Area</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="text-slate-500 text-[10px]">Mengetahui &amp; Mengesahkan,</p>
                  <div>
                    <p className="font-bold text-slate-900 underline">Arif Gunawan Panggabean</p>
                    <p className="text-[10px] text-slate-400">Direktur Utama Barokah Grup</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setViewingDossierDoc(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Berita Acara Sidak Fisik (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}