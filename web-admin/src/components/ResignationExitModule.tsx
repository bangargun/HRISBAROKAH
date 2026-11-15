'use client';

import React, { useState, useEffect } from 'react';
import {
  UserX,
  Users,
  CheckCircle2,
  AlertTriangle,
  Star,
  MessageSquare,
  Building2,
  ShieldAlert,
  FileText,
  Printer,
  Search,
  Plus,
  Trash2,
  HelpCircle,
  TrendingDown,
  UserCheck,
  ShieldCheck,
  Scale,
  X,
  Eye,
  Check,
  RotateCcw,
  FileSignature,
  Award,
  ChevronRight,
  MapPin,
  Calendar,
  Wallet,
} from 'lucide-react';

export type ResignReasonCategory =
  | 'CAREER_OPPORTUNITY'
  | 'FAMILY_DOMICILE'
  | 'WORKLOAD_PHYSICAL'
  | 'WORK_ENVIRONMENT_TEAM'
  | 'WANPRESTASI_WALKOUT'
  | 'HEALTH_CONDITION'
  | 'OTHER';

export type NoticePeriodStatus =
  | 'STANDARD_30_DAYS'
  | 'SHORT_NOTICE'
  | 'WANPRESTASI_IMMEDIATE';

export type RehireRecommendation =
  | 'HIGHLY_RECOMMENDED'
  | 'CONDITIONAL'
  | 'DO_NOT_REHIRE';

export interface ResignationRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  outlet: string;
  positionTitle: string;
  joinDate: string;
  submissionDate: string;
  effectiveExitDate: string;
  noticeStatus: NoticePeriodStatus;

  // 1. Laporan Wajib Admin / Kepala Cabang
  adminReporterName: string;
  adminReporterRole: string;
  adminReasonCategory: ResignReasonCategory;
  adminReasonNotes: string;
  rehireRecommendation: RehireRecommendation;

  // Checklist Clearance Lapangan
  clearance: {
    uniformReturned: boolean;
    idCardLockerCleared: boolean;
    kasbonSettled: boolean;
    remainingKasbonAmount: number;
    finalSalaryStatus: 'FULL_TRANSFER' | 'HANGUS_WANPRESTASI' | 'PENDING_CUTOFF';
    handoverNotes: string;
  };

  // 2. Exit Interview Mandiri Kru (Direct Voice)
  crewFeedback?: {
    crewReasonCategory: ResignReasonCategory;
    crewReasonExplanation: string;
    branchLeadershipRating: number;
    shiftFairnessRating: number;
    teamAtmosphereRating: number;
    trainingSupportRating: number;
    whatToImprove: string;
    wouldRecommendBarokah: boolean;
    submittedAt: string;
  };

  status: 'MENUNGGU_CLEARANCE' | 'DISETUJUI_HQ' | 'SELESAI_RESIGN';
  createdAt: string;
}

export const REASON_LABELS: Record<ResignReasonCategory, { label: string; badgeColor: string }> = {
  CAREER_OPPORTUNITY: { label: 'Peluang Karir / Pekerjaan Baru', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  FAMILY_DOMICILE: { label: 'Keluarga / Pulang Kampung', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  WORKLOAD_PHYSICAL: { label: 'Beban Fisik & Jam Shift Resto', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
  WORK_ENVIRONMENT_TEAM: { label: 'Masalah Rekan / Pimpinan Cabang', badgeColor: 'bg-rose-100 text-rose-800 border-rose-200' },
  WANPRESTASI_WALKOUT: { label: 'Wanprestasi Sepihak / Mangkir >=5 Hari', badgeColor: 'bg-red-600 text-white border-red-700' },
  HEALTH_CONDITION: { label: 'Kesehatan Fisik / Medis', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
  OTHER: { label: 'Alasan Khusus Lainnya', badgeColor: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export const NOTICE_LABELS: Record<NoticePeriodStatus, { label: string; sub: string; badge: string }> = {
  STANDARD_30_DAYS: {
    label: 'One-Month Notice (30 Hari)',
    sub: 'Sesuai Prosedur Baku SOP Resto (Good Terms)',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  SHORT_NOTICE: {
    label: 'Pemberitahuan Singkat (<30 Hari)',
    sub: 'Disetujui Khusus dengan Izin Manajemen',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  WANPRESTASI_IMMEDIATE: {
    label: 'Resign Mendadak / Sepihak (CLS-008)',
    sub: 'Wanprestasi Kontrak PKWT (Hak Gaji Bulan Berjalan Hangus)',
    badge: 'bg-rose-100 text-rose-800 border-rose-300 font-black',
  },
};

export const REHIRE_LABELS: Record<RehireRecommendation, { label: string; badge: string }> = {
  HIGHLY_RECOMMENDED: { label: 'Sangat Direkomendasikan (Good Terms)', badge: 'bg-emerald-100 text-emerald-800' },
  CONDITIONAL: { label: 'Bersyarat (Evaluasi Ulang HQ)', badge: 'bg-amber-100 text-amber-800' },
  DO_NOT_REHIRE: { label: 'Tidak Direkomendasikan (Blacklist PKWT)', badge: 'bg-rose-100 text-rose-800 font-bold' },
};

interface ResignationExitModuleProps {
  employees: Array<{
    id: string;
    fullName: string;
    nikKtp: string;
    outlet: string;
    positionTitle: string;
    joinDate: string;
    department: string;
  }>;
  outlets: Array<{
    id: string;
    name: string;
  }>;
  showToast: (msg: string) => void;
  onEmployeeUpdate?: React.Dispatch<React.SetStateAction<any[]>>;
}

export const ResignationExitModule: React.FC<ResignationExitModuleProps> = ({
  employees,
  outlets,
  showToast,
}) => {
  // 1. Data State (Zero Mock Policy: Default empty [])
  const [resignationList, setResignationList] = useState<ResignationRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Modals State
  const [isAddResignModalOpen, setIsAddResignModalOpen] = useState<boolean>(false);
  const [isCrewExitModalOpen, setIsCrewExitModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<ResignationRecord | null>(null);

  // Form State: Laporan Admin Wajib
  const [adminFormEmpId, setAdminFormEmpId] = useState<string>('');
  const [adminFormSubmissionDate, setAdminFormSubmissionDate] = useState<string>('24 Okt 2026');
  const [adminFormEffectiveDate, setAdminFormEffectiveDate] = useState<string>('24 Nov 2026');
  const [adminFormNoticeStatus, setAdminFormNoticeStatus] = useState<NoticePeriodStatus>('STANDARD_30_DAYS');
  const [adminFormCategory, setAdminFormCategory] = useState<ResignReasonCategory>('CAREER_OPPORTUNITY');
  const [adminFormNotes, setAdminFormNotes] = useState<string>('');
  const [adminFormRehire, setAdminFormRehire] = useState<RehireRecommendation>('HIGHLY_RECOMMENDED');
  const [adminFormUniform, setAdminFormUniform] = useState<boolean>(true);
  const [adminFormLocker, setAdminFormLocker] = useState<boolean>(true);
  const [adminFormKasbonSettled, setAdminFormKasbonSettled] = useState<boolean>(true);
  const [adminFormRemainingKasbon, setAdminFormRemainingKasbon] = useState<number>(0);
  const [adminFormFinalSalary, setAdminFormFinalSalary] = useState<'FULL_TRANSFER' | 'HANGUS_WANPRESTASI' | 'PENDING_CUTOFF'>('FULL_TRANSFER');
  const [adminFormReporterName, setAdminFormReporterName] = useState<string>('Admin Operasional Cabang');
  const [adminFormReporterRole, setAdminFormReporterRole] = useState<string>('Kepala Cabang / Supervisor');

  // Form State: Exit Interview Mandiri Kru
  const [crewFormRecordId, setCrewFormRecordId] = useState<string>('');
  const [crewFormCategory, setCrewFormCategory] = useState<ResignReasonCategory>('CAREER_OPPORTUNITY');
  const [crewFormExplanation, setCrewFormExplanation] = useState<string>('');
  const [crewFormLeadershipRating, setCrewFormLeadershipRating] = useState<number>(5);
  const [crewFormShiftRating, setCrewFormShiftRating] = useState<number>(5);
  const [crewFormTeamRating, setCrewFormTeamRating] = useState<number>(5);
  const [crewFormTrainingRating, setCrewFormTrainingRating] = useState<number>(5);
  const [crewFormWhatToImprove, setCrewFormWhatToImprove] = useState<string>('');
  const [crewFormWouldRecommend, setCrewFormWouldRecommend] = useState<boolean>(true);

  // Load from localStorage on mount (Zero Mock Policy)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hris_exit_interviews');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setResignationList(parsed);
        }
      }
    } catch (err) {
      console.error('Error loading exit interviews from localStorage:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage whenever resignationList changes
  const saveResignations = (updated: ResignationRecord[]) => {
    setResignationList(updated);
    try {
      localStorage.setItem('hris_exit_interviews', JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }
  };

  // Preselect employee in Admin Modal
  useEffect(() => {
    if (employees.length > 0 && !adminFormEmpId) {
      setAdminFormEmpId(employees[0].id);
    }
  }, [employees, adminFormEmpId]);

  // Handle Admin Submit
  const handleAdminFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((x) => x.id === adminFormEmpId);
    if (!emp) {
      showToast('Harap pilih karyawan terlebih dahulu!');
      return;
    }
    if (!adminFormNotes || adminFormNotes.trim().length < 5) {
      showToast('Wajib memberikan catatan kronologis alasan resign minimal 5 karakter!');
      return;
    }

    const newRecord: ResignationRecord = {
      id: `RESIGN-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.fullName,
      outlet: emp.outlet,
      positionTitle: emp.positionTitle,
      joinDate: emp.joinDate,
      submissionDate: adminFormSubmissionDate,
      effectiveExitDate: adminFormEffectiveDate,
      noticeStatus: adminFormNoticeStatus,
      adminReporterName: adminFormReporterName,
      adminReporterRole: adminFormReporterRole,
      adminReasonCategory: adminFormCategory,
      adminReasonNotes: adminFormNotes,
      rehireRecommendation: adminFormRehire,
      clearance: {
        uniformReturned: adminFormUniform,
        idCardLockerCleared: adminFormLocker,
        kasbonSettled: adminFormKasbonSettled,
        remainingKasbonAmount: adminFormRemainingKasbon,
        finalSalaryStatus: adminFormFinalSalary,
        handoverNotes: adminFormNotes,
      },
      status: adminFormKasbonSettled && adminFormUniform && adminFormLocker ? 'SELESAI_RESIGN' : 'MENUNGGU_CLEARANCE',
      createdAt: '24 Okt 2026',
    };

    const updated = [newRecord, ...resignationList];
    saveResignations(updated);
    setIsAddResignModalOpen(false);
    setAdminFormNotes('');
    showToast(`Laporan pengunduran diri ${emp.fullName} berhasil dicatat resmi!`);
  };

  // Handle Crew Exit Interview Submit
  const handleCrewExitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!crewFormRecordId) {
      showToast('Harap pilih kru yang mengajukan resign!');
      return;
    }

    const updated = resignationList.map((rec) => {
      if (rec.id === crewFormRecordId) {
        return {
          ...rec,
          crewFeedback: {
            crewReasonCategory: crewFormCategory,
            crewReasonExplanation: crewFormExplanation || 'Alasan pribadi yang disampaikan saat wawancara.',
            branchLeadershipRating: crewFormLeadershipRating,
            shiftFairnessRating: crewFormShiftRating,
            teamAtmosphereRating: crewFormTeamRating,
            trainingSupportRating: crewFormTrainingRating,
            whatToImprove: crewFormWhatToImprove || 'Pertahankan kekeluargaan dan transparansi.',
            wouldRecommendBarokah: crewFormWouldRecommend,
            submittedAt: '24 Okt 2026',
          },
        };
      }
      return rec;
    });

    saveResignations(updated);
    setIsCrewExitModalOpen(false);
    showToast('Hasil Exit Interview kru berhasil disimpan dan disinkronkan!');
  };

  // Filtered List
  const filteredList = resignationList.filter((item) => {
    if (selectedOutletFilter !== 'ALL' && !item.outlet.toLowerCase().includes(selectedOutletFilter.toLowerCase())) {
      return false;
    }
    if (selectedCategoryFilter !== 'ALL' && item.adminReasonCategory !== selectedCategoryFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.employeeName.toLowerCase().includes(q) ||
        item.employeeId.toLowerCase().includes(q) ||
        item.outlet.toLowerCase().includes(q) ||
        item.positionTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate Disparity Alert
  const checkDisparity = (rec: ResignationRecord): { hasDisparity: boolean; reason: string } => {
    if (!rec.crewFeedback) {
      return { hasDisparity: false, reason: 'Belum ada data exit interview dari kru' };
    }
    const adminCat = rec.adminReasonCategory;
    const crewCat = rec.crewFeedback.crewReasonCategory;
    const leadershipRating = rec.crewFeedback.branchLeadershipRating;

    if (adminCat !== crewCat) {
      return {
        hasDisparity: true,
        reason: `Disparitas Kategori Alasan: Admin melapor "${REASON_LABELS[adminCat].label}", sedangkan Kru menyatakan "${REASON_LABELS[crewCat].label}".`,
      };
    }
    if (leadershipRating <= 2) {
      return {
        hasDisparity: true,
        reason: `Rating Kepemimpinan Rendah (${leadershipRating}/5): Kru menyatakan ketidakpuasan terhadap perlakuan Kepala Cabang / SPV.`,
      };
    }
    return { hasDisparity: false, reason: 'Alasan terverifikasi selaras antara Admin dan Kru.' };
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Action */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
              <ShieldAlert className="h-3 w-3" />
              AKUNTABILITAS WAJIB ADMIN &amp; EXIT INTERVIEW
            </span>
            <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" />
              Dual-Validation SOP-HR-003 &amp; PKWT CLS-008
            </span>
          </div>
          <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            <UserX className="h-5 w-5 text-rose-400" />
            MANAJEMEN PENGUNDURAN DIRI (RESIGN) &amp; AUDIT RETENSI CABANG
          </h3>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            Admin dan Kepala Cabang <strong>wajib menyampaikan alasan riil</strong> setiap kali ada kru yang mengundurkan diri. Sistem mencocokkan laporan admin dengan <strong>suara langsung kru (Exit Interview)</strong> untuk mencegah penutupan masalah internal dan melindungi aset resto.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddResignModalOpen(true)}
            className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-1.5 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>+ Lapor Resign Kru (Wajib Admin)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (resignationList.length === 0) {
                showToast('Belum ada data pengajuan resign untuk diwawancara. Silakan input laporan resign terlebih dahulu.');
                return;
              }
              setCrewFormRecordId(resignationList[0].id);
              setIsCrewExitModalOpen(true);
            }}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-1.5 transition-all"
          >
            <Star className="h-4 w-4 fill-slate-950" />
            <span>📝 Input Exit Interview Kru</span>
          </button>
        </div>
      </div>

      {/* 2. Stat Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Kru Resign</p>
            <h4 className="text-xl font-black text-slate-900 mt-0.5">{resignationList.length} Orang</h4>
            <span className="text-[10px] text-slate-400 font-medium">Tercatat di Database</span>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <UserX className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">30-Day Notice (Resmi)</p>
            <h4 className="text-xl font-black text-emerald-700 mt-0.5">
              {resignationList.filter((r) => r.noticeStatus === 'STANDARD_30_DAYS').length} Orang
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold">Good Terms &amp; Berhak Paklaring</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Wanprestasi Sepihak</p>
            <h4 className="text-xl font-black text-rose-700 mt-0.5">
              {resignationList.filter((r) => r.noticeStatus === 'WANPRESTASI_IMMEDIATE').length} Orang
            </h4>
            <span className="text-[10px] text-rose-600 font-bold">Gaji Berjalan Hangus (CLS-008)</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Clearance Selesai</p>
            <h4 className="text-xl font-black text-blue-700 mt-0.5">
              {resignationList.filter((r) => r.status === 'SELESAI_RESIGN').length} Tuntas
            </h4>
            <span className="text-[10px] text-blue-600 font-bold">Seragam &amp; Kasbon Lunas</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Award className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama kru, ID, atau jabatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none w-64"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-600">Outlet:</span>
            <select
              value={selectedOutletFilter}
              onChange={(e) => setSelectedOutletFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="ALL">Semua Outlet Barokah Grup</option>
              {outlets.map((out) => (
                <option key={out.id} value={out.name}>
                  {out.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-600">Alasan:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="ALL">Semua Kategori Alasan</option>
              {Object.entries(REASON_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Menampilkan <strong>{filteredList.length}</strong> data resign
        </div>
      </div>

      {/* 4. Resignation Records Table (Zero Mock: Clean Empty State if 0) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <UserCheck className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-sm font-black text-slate-800">
                Belum Ada Pengajuan Resign Tercatat
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Seluruh kru aktif tercatat bertugas normal di cabang masing-masing. Setiap kali ada karyawan yang mengajukan pengunduran diri, Admin Cabang <strong>wajib menyampaikan laporan kronologi alasan dan checklist clearance</strong> melalui tombol di bawah.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddResignModalOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>+ Buat Laporan Resign Kru (Wajib Admin)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Karyawan &amp; Outlet</th>
                  <th className="py-3 px-4">Status Notice &amp; Tanggal</th>
                  <th className="py-3 px-4">Laporan Alasan Admin</th>
                  <th className="py-3 px-4">Exit Interview Kru</th>
                  <th className="py-3 px-4">Audit Disparitas</th>
                  <th className="py-3 px-4">Clearance Aset</th>
                  <th className="py-3 px-4 text-center">Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((rec) => {
                  const disparity = checkDisparity(rec);
                  const noticeCfg = NOTICE_LABELS[rec.noticeStatus];
                  const adminCatCfg = REASON_LABELS[rec.adminReasonCategory];

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Kru Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{rec.employeeName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">ID: {rec.employeeId}</div>
                        <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {rec.outlet.split(',')[0]} • {rec.positionTitle}
                        </div>
                      </td>

                      {/* Notice Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${noticeCfg.badge}`}>
                          {noticeCfg.label}
                        </span>
                        <div className="text-[11px] text-slate-600 mt-1">
                          Efektif: <strong>{rec.effectiveExitDate}</strong>
                        </div>
                        <div className="text-[10px] text-slate-400">Pengajuan: {rec.submissionDate}</div>
                      </td>

                      {/* Admin Report */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${adminCatCfg.badgeColor}`}>
                          {adminCatCfg.label}
                        </span>
                        <p className="text-[11px] text-slate-700 mt-1 line-clamp-2 italic">
                          &ldquo;{rec.adminReasonNotes}&rdquo;
                        </p>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Pelapor: {rec.adminReporterName} ({rec.adminReporterRole})
                        </div>
                      </td>

                      {/* Crew Voice */}
                      <td className="py-3.5 px-4">
                        {rec.crewFeedback ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              <span>{rec.crewFeedback.branchLeadershipRating}/5</span>
                              <span className="text-[10px] text-slate-400 font-normal">(Rating Pimpinan)</span>
                            </div>
                            <p className="text-[11px] text-slate-700 line-clamp-1">
                              &ldquo;{rec.crewFeedback.crewReasonExplanation}&rdquo;
                            </p>
                            <span className="text-[10px] text-emerald-600 font-bold block">
                              ✓ Exit Survey Terisi
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded block text-center">
                              Belum Mengisi Survey
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCrewFormRecordId(rec.id);
                                setIsCrewExitModalOpen(true);
                              }}
                              className="text-[10px] text-amber-700 hover:text-amber-900 font-bold underline block"
                            >
                              + Input Hasil Wawancara
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Audit Disparity */}
                      <td className="py-3.5 px-4">
                        {disparity.hasDisparity ? (
                          <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[10px] space-y-0.5 max-w-xs">
                            <div className="font-bold flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-rose-600" />
                              <span>DISPARITAS LAPORAN</span>
                            </div>
                            <p className="line-clamp-2">{disparity.reason}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Selaras &amp; Valid</span>
                          </div>
                        )}
                      </td>

                      {/* Clearance */}
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] space-y-0.5">
                          <div>
                            Seragam: {rec.clearance.uniformReturned ? <strong className="text-emerald-700">✓ Kembali</strong> : <strong className="text-rose-600">Belum</strong>}
                          </div>
                          <div>
                            Loker/ID: {rec.clearance.idCardLockerCleared ? <strong className="text-emerald-700">✓ Selesai</strong> : <strong className="text-rose-600">Belum</strong>}
                          </div>
                          <div>
                            Kasbon: {rec.clearance.kasbonSettled ? <strong className="text-emerald-700">✓ Lunas</strong> : <strong className="text-rose-600">Sisa Rp {rec.clearance.remainingKasbonAmount.toLocaleString('id-ID')}</strong>}
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRecord(rec);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition"
                            title="Buka Dossier & Cetak Surat Resmi"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Yakin ingin menghapus arsip pengunduran diri ${rec.employeeName}?`)) {
                                const updated = resignationList.filter((x) => x.id !== rec.id);
                                saveResignations(updated);
                                showToast(`Arsip resign ${rec.employeeName} dihapus.`);
                              }
                            }}
                            className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition"
                            title="Hapus Arsip"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: FORMULIR LAPORAN RESIGN WAJIB ADMIN & KEPALA CABANG */}
      {/* ========================================================= */}
      {isAddResignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <UserX className="h-5 w-5 text-rose-400" />
                <span className="font-extrabold text-xs uppercase tracking-wide">
                  Laporan Wajib Pengunduran Diri Kru (Admin &amp; Kepala Cabang)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddResignModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdminFormSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
              {/* Alert SOP */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <ShieldAlert className="h-4 w-4 text-amber-700" />
                  Kewajiban Akuntabilitas Pimpinan Outlet:
                </span>
                <p className="text-[11px] leading-relaxed">
                  Admin/Kepala Cabang wajib menyampaikan alasan riil, status pemberitahuan masa kontrak, serta memastikan penyelesaian inventori seragam dan kasbon darurat sebelum kru meninggalkan outlet.
                </p>
              </div>

              {/* 1. Pilih Karyawan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Karyawan yang Mengajukan Resign:</label>
                <select
                  value={adminFormEmpId}
                  onChange={(e) => setAdminFormEmpId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.id}) — {emp.positionTitle} [{emp.outlet.split(',')[0]}]
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Tanggal Pengajuan & Tanggal Efektif */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Pengajuan Resign:</label>
                  <input
                    type="text"
                    value={adminFormSubmissionDate}
                    onChange={(e) => setAdminFormSubmissionDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="Contoh: 24 Okt 2026"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Efektif Terakhir Bekerja:</label>
                  <input
                    type="text"
                    value={adminFormEffectiveDate}
                    onChange={(e) => setAdminFormEffectiveDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="Contoh: 24 Nov 2026"
                  />
                </div>
              </div>

              {/* 3. Status Notice Period */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kualifikasi Notice Pengunduran Diri:</label>
                <select
                  value={adminFormNoticeStatus}
                  onChange={(e) => {
                    const val = e.target.value as NoticePeriodStatus;
                    setAdminFormNoticeStatus(val);
                    if (val === 'WANPRESTASI_IMMEDIATE') {
                      setAdminFormCategory('WANPRESTASI_WALKOUT');
                      setAdminFormFinalSalary('HANGUS_WANPRESTASI');
                      setAdminFormRehire('DO_NOT_REHIRE');
                    } else if (val === 'STANDARD_30_DAYS') {
                      setAdminFormFinalSalary('FULL_TRANSFER');
                      setAdminFormRehire('HIGHLY_RECOMMENDED');
                    }
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="STANDARD_30_DAYS">✓ Memenuhi 30-Day Notice (Sesuai SOP Baku - Good Terms)</option>
                  <option value="SHORT_NOTICE">⚠️ Pemberitahuan Singkat (&lt; 30 Hari dengan Izin Tertulis)</option>
                  <option value="WANPRESTASI_IMMEDIATE">⛔ Resign Mendadak / Sepihak (Wanprestasi PKWT CLS-008)</option>
                </select>
              </div>

              {/* 4. Kategori Alasan Baku */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kategori Alasan Pengunduran Diri (Wajib):</label>
                <select
                  value={adminFormCategory}
                  onChange={(e) => setAdminFormCategory(e.target.value as ResignReasonCategory)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {Object.entries(REASON_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Catatan Kronologis Admin */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan Kronologis &amp; Penjelasan Nyata Lapangan (Wajib):
                </label>
                <textarea
                  rows={3}
                  value={adminFormNotes}
                  onChange={(e) => setAdminFormNotes(e.target.value)}
                  placeholder="Jelaskan detail alasan kru, kronologi penyampaian, dan hasil wawancara awal di outlet..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* 6. Checklist Clearance Lapangan */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <span className="font-bold text-slate-900 block text-xs">
                  Checklist Clearance &amp; Tanggungan Outlet (SOP Barokah):
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminFormUniform}
                      onChange={(e) => setAdminFormUniform(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Seragam &amp; Celemek Dikembalikan Lengkap</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminFormLocker}
                      onChange={(e) => setAdminFormLocker(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>ID Card &amp; Kunci Loker Diserahkan</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminFormKasbonSettled}
                      onChange={(e) => setAdminFormKasbonSettled(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Saldo Kasbon Darurat Lunas / Nihil</span>
                  </label>
                </div>

                {!adminFormKasbonSettled && (
                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-rose-700">Sisa Kasbon Belum Lunas (Rp):</label>
                      <input
                        type="number"
                        value={adminFormRemainingKasbon}
                        onChange={(e) => setAdminFormRemainingKasbon(Number(e.target.value))}
                        className="w-full p-2 border border-rose-300 rounded-lg text-xs font-bold text-rose-800"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mt-4">
                        *Wajib dipotong otomatis dari gaji terakhir.
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200">
                  <label className="block font-bold text-slate-700 mb-1">Status Pembayaran Gaji Terakhir:</label>
                  <select
                    value={adminFormFinalSalary}
                    onChange={(e: any) => setAdminFormFinalSalary(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium"
                  >
                    <option value="FULL_TRANSFER">Ditransfer Penuh saat Cut-off (Sesuai Kehadiran Riil)</option>
                    <option value="HANGUS_WANPRESTASI">Hangus (Rp 0) sebagai Ganti Rugi Resto sesuai CLS-008</option>
                    <option value="PENDING_CUTOFF">Menunggu Rekapitulasi Akhir Bulan</option>
                  </select>
                </div>
              </div>

              {/* 7. Rekomendasi Re-hire & Identitas Pelapor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rekomendasi Re-hire di Masa Depan:</label>
                  <select
                    value={adminFormRehire}
                    onChange={(e: any) => setAdminFormRehire(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="HIGHLY_RECOMMENDED">Sangat Direkomendasikan (Kru Baik)</option>
                    <option value="CONDITIONAL">Bersyarat (Perlu Evaluasi Ulang)</option>
                    <option value="DO_NOT_REHIRE">Tidak Direkomendasikan (Blacklist)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Admin / Kepala Cabang Pelapor:</label>
                  <input
                    type="text"
                    value={adminFormReporterName}
                    onChange={(e) => setAdminFormReporterName(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddResignModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Simpan Laporan Resign Resmi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: FORMULIR EXIT INTERVIEW LANGSUNG DARI KRU       */}
      {/* ========================================================= */}
      {isCrewExitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                <span className="font-extrabold text-xs uppercase tracking-wide">
                  Formulir Exit Interview &amp; Suara Mandiri Kru Restoran
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCrewExitModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCrewExitSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <MessageSquare className="h-4 w-4 text-blue-700" />
                  Kerahasiaan Terjamin &amp; Bebas Intimidasi:
                </span>
                <p className="text-[11px] leading-relaxed">
                  Data ini dikirim langsung ke Manajemen Pusat (Direksi &amp; Operations Manager) untuk evaluasi obyektif perbaikan cabang dan kepemimpinan.
                </p>
              </div>

              {/* Pilih Resignation Record */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Kru yang Diwawancarai:</label>
                <select
                  value={crewFormRecordId}
                  onChange={(e) => setCrewFormRecordId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {resignationList.map((rec) => (
                    <option key={rec.id} value={rec.id}>
                      {rec.employeeName} ({rec.employeeId}) — {rec.positionTitle} [{rec.outlet.split(',')[0]}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Kategori Alasan Versi Kru */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Alasan Utama Resign Versi Kru:</label>
                <select
                  value={crewFormCategory}
                  onChange={(e) => setCrewFormCategory(e.target.value as ResignReasonCategory)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {Object.entries(REASON_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Uraian Jujur Kru */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Uraian Alasan / Keluh Kesah Nyata Tanpa Sensor:
                </label>
                <textarea
                  rows={3}
                  value={crewFormExplanation}
                  onChange={(e) => setCrewFormExplanation(e.target.value)}
                  placeholder="Ceritakan dengan bebas apa faktor terbesar yang membuatmu memutuskan berhenti..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Rating Bintang 1-5 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="font-bold text-slate-900 block text-xs">
                  Penilaian Kualitas &amp; Suasana Kerja Cabang (Bintang 1 s/d 5):
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Rating Kepemimpinan */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Kepemimpinan Kepala Cabang/SPV:</span>
                      <strong className="text-amber-600">{crewFormLeadershipRating} / 5 ⭐</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={crewFormLeadershipRating}
                      onChange={(e) => setCrewFormLeadershipRating(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>1 (Sangat Buruk)</span>
                      <span>5 (Sangat Adil)</span>
                    </div>
                  </div>

                  {/* Rating Keadilan Shift */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Keadilan Shift &amp; Istirahat (Break):</span>
                      <strong className="text-amber-600">{crewFormShiftRating} / 5 ⭐</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={crewFormShiftRating}
                      onChange={(e) => setCrewFormShiftRating(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>1 (Sering Dipotong)</span>
                      <span>5 (Tepat 60 Menit)</span>
                    </div>
                  </div>

                  {/* Rating Suasana Tim */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Kekompakan Tim Antar-Stasiun:</span>
                      <strong className="text-amber-600">{crewFormTeamRating} / 5 ⭐</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={crewFormTeamRating}
                      onChange={(e) => setCrewFormTeamRating(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>1 (Banyak Konflik)</span>
                      <span>5 (Sangat Kompak)</span>
                    </div>
                  </div>

                  {/* Rating Pelatihan & Alat */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Fasilitas Alat &amp; Standar SOP:</span>
                      <strong className="text-amber-600">{crewFormTrainingRating} / 5 ⭐</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={crewFormTrainingRating}
                      onChange={(e) => setCrewFormTrainingRating(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>1 (Alat Rusak/Kurang)</span>
                      <span>5 (Sangat Lengkap)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Saran Terbuka */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Apa 1 hal terbesar yang perlu segera diperbaiki oleh manajemen Barokah Grup?
                </label>
                <textarea
                  rows={2}
                  value={crewFormWhatToImprove}
                  onChange={(e) => setCrewFormWhatToImprove(e.target.value)}
                  placeholder="Saran bebas untuk perbaikan operasional, kesejahteraan, atau budaya kerja..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Rekomendasi Barokah */}
              <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  id="wouldRecommend"
                  checked={crewFormWouldRecommend}
                  onChange={(e) => setCrewFormWouldRecommend(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="wouldRecommend" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Saya bersedia merekomendasikan Barokah Grup kepada teman/keluarga sebagai tempat bekerja yang baik.
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCrewExitModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold shadow-md transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Simpan Hasil Exit Interview</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: DOSSIER DETAIL DUAL-VALIDATION & CETAK SURAT RESMI */}
      {/* ========================================================= */}
      {isDetailModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            {/* Modal Control Bar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <FileSignature className="h-5 w-5 text-amber-400" />
                <span className="font-extrabold text-xs uppercase tracking-wide">
                  Dossier Dual-Validation Pengunduran Diri — {selectedRecord.employeeName}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak Dokumen Resmi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Document Printable Sheet */}
            <div className="p-8 space-y-6 text-slate-800 bg-white relative">
              {/* Kop Surat Resmi Barokah Grup */}
              <div className="rounded-xl overflow-hidden shadow-xs border border-amber-200/60 mb-5 bg-white">
                <img
                  src="/kop-surat-barokah.jpg"
                  alt="Kop Surat Resmi Barokah Grup"
                  className="w-full h-auto object-contain block"
                />
              </div>

              {/* Title */}
              <div className="text-center space-y-1">
                <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-900 underline underline-offset-4">
                  {selectedRecord.noticeStatus === 'WANPRESTASI_IMMEDIATE'
                    ? 'BERITA ACARA PEMUTUSAN HUBUNGAN KERJA SEPIHAK (WANPRESTASI PKWT)'
                    : 'SURAT KETERANGAN PENGALAMAN KERJA (PAKLARING RESMI)'}
                </h3>
                <p className="text-xs font-mono font-bold text-slate-700">
                  Nomor: {selectedRecord.noticeStatus === 'WANPRESTASI_IMMEDIATE' ? 'BA-WAN/BKN/HR/' : 'SKP-BKN/DIR-HR/'}2026/X/{selectedRecord.id.replace('RESIGN-', '').slice(-4)}
                </p>
              </div>

              {/* Kru Info Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1.5 font-sans">
                <div className="grid grid-cols-3">
                  <span className="text-slate-500 font-semibold">Nama Lengkap Karyawan</span>
                  <span className="col-span-2 font-bold text-slate-900">: {selectedRecord.employeeName}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-slate-500 font-semibold">ID Karyawan / Staf</span>
                  <span className="col-span-2 font-mono font-bold text-slate-800">: {selectedRecord.employeeId}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-slate-500 font-semibold">Jabatan Terakhir</span>
                  <span className="col-span-2 font-bold text-blue-700">: {selectedRecord.positionTitle}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-slate-500 font-semibold">Penempatan Outlet</span>
                  <span className="col-span-2 font-semibold text-slate-800">: {selectedRecord.outlet}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-slate-500 font-semibold">Periode Pengabdian</span>
                  <span className="col-span-2 font-semibold text-slate-800">
                    : {selectedRecord.joinDate} s.d. {selectedRecord.effectiveExitDate}
                  </span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-slate-500 font-semibold">Status Prosedur Resign</span>
                  <span className="col-span-2">
                    : <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${NOTICE_LABELS[selectedRecord.noticeStatus].badge}`}>
                      {NOTICE_LABELS[selectedRecord.noticeStatus].label}
                    </span>
                  </span>
                </div>
              </div>

              {/* Dual-Validation Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Laporan Admin */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="font-bold text-slate-900 uppercase text-[11px] border-b border-slate-200 pb-1 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <span>Laporan Resmi Admin / Kepala Cabang:</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Kategori Alasan:</span>
                    <strong className="text-slate-800">{REASON_LABELS[selectedRecord.adminReasonCategory].label}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Catatan Kronologi:</span>
                    <p className="text-slate-700 italic bg-white p-2.5 rounded border border-slate-200 leading-relaxed">
                      &ldquo;{selectedRecord.adminReasonNotes}&rdquo;
                    </p>
                  </div>
                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Rekomendasi Re-hire:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${REHIRE_LABELS[selectedRecord.rehireRecommendation].badge}`}>
                      {REHIRE_LABELS[selectedRecord.rehireRecommendation].label}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Pelapor: {selectedRecord.adminReporterName} ({selectedRecord.adminReporterRole})
                  </div>
                </div>

                {/* Suara Kru (Exit Interview) */}
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                  <div className="font-bold text-slate-900 uppercase text-[11px] border-b border-amber-200 pb-1 flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span>Suara Langsung Kru (Exit Interview):</span>
                  </div>
                  {selectedRecord.crewFeedback ? (
                    <>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Alasan Versi Kru:</span>
                        <strong className="text-slate-800">{REASON_LABELS[selectedRecord.crewFeedback.crewReasonCategory].label}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Uraian Kru:</span>
                        <p className="text-slate-700 italic bg-white p-2.5 rounded border border-amber-200 leading-relaxed">
                          &ldquo;{selectedRecord.crewFeedback.crewReasonExplanation}&rdquo;
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                        <div className="bg-white p-1.5 rounded border border-amber-200">
                          Kepemimpinan: <strong>{selectedRecord.crewFeedback.branchLeadershipRating}/5 ⭐</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-amber-200">
                          Shift &amp; Break: <strong>{selectedRecord.crewFeedback.shiftFairnessRating}/5 ⭐</strong>
                        </div>
                      </div>
                      {selectedRecord.crewFeedback.whatToImprove && (
                        <div>
                          <span className="text-slate-500 block text-[10px]">Masukan Perbaikan:</span>
                          <p className="text-slate-700 text-[11px]">{selectedRecord.crewFeedback.whatToImprove}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs italic">
                      Kru belum mengisi kuesioner Exit Interview.
                    </div>
                  )}
                </div>
              </div>

              {/* Disparity Alert Banner */}
              {(() => {
                const disp = checkDisparity(selectedRecord);
                return disp.hasDisparity ? (
                  <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <span>PERINGATAN DISPARITAS LAPORAN OPERASIONAL:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{disp.reason}</p>
                    <p className="text-[10px] text-rose-700 font-semibold italic">
                      Rekomendasi: Operations Manager atau Direksi disarankan melakukan audit langsung ke Kepala Cabang terkait.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Laporan Admin dan Testimoni Kru selaras. Tidak ditemukan indikasi konflik internal di outlet.</span>
                  </div>
                );
              })()}

              {/* Clearance Summary Box */}
              <div className="text-xs space-y-2 border-t border-slate-200 pt-3">
                <div className="font-bold text-slate-900 uppercase text-[11px]">STATUS SERAH TERIMA &amp; HAK AKHIR:</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-[11px]">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Seragam Resto:</span>
                    <strong className={selectedRecord.clearance.uniformReturned ? 'text-emerald-700' : 'text-rose-600'}>
                      {selectedRecord.clearance.uniformReturned ? '✓ Dikembalikan' : 'Belum Selesai'}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Loker &amp; ID Card:</span>
                    <strong className={selectedRecord.clearance.idCardLockerCleared ? 'text-emerald-700' : 'text-rose-600'}>
                      {selectedRecord.clearance.idCardLockerCleared ? '✓ Diserahkan' : 'Belum Selesai'}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Kasbon Darurat:</span>
                    <strong className={selectedRecord.clearance.kasbonSettled ? 'text-emerald-700' : 'text-rose-600'}>
                      {selectedRecord.clearance.kasbonSettled ? '✓ Lunas' : `Sisa Rp ${selectedRecord.clearance.remainingKasbonAmount.toLocaleString('id-ID')}`}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Gaji Bulan Berjalan:</span>
                    <strong className={selectedRecord.clearance.finalSalaryStatus === 'FULL_TRANSFER' ? 'text-emerald-700' : selectedRecord.clearance.finalSalaryStatus === 'HANGUS_WANPRESTASI' ? 'text-rose-600' : 'text-amber-700'}>
                      {selectedRecord.clearance.finalSalaryStatus === 'FULL_TRANSFER' ? 'Ditransfer Penuh' : selectedRecord.clearance.finalSalaryStatus === 'HANGUS_WANPRESTASI' ? 'Hangus (Rp 0)' : 'Pending Rekap'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="space-y-12">
                  <p className="font-semibold text-slate-600">Karyawan yang Mengundurkan Diri,</p>
                  <div>
                    <p className="font-bold text-slate-900 underline">{selectedRecord.employeeName}</p>
                    <p className="text-[10px] text-slate-500">ID: {selectedRecord.employeeId}</p>
                  </div>
                </div>
                <div className="space-y-12 relative">
                  <p className="font-semibold text-slate-600">Direksi &amp; Manajemen Pusat,</p>
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-75 pointer-events-none">
                    <div className="border-2 border-dashed border-rose-600 rounded-full w-20 h-20 flex flex-col items-center justify-center text-rose-600 text-[8px] font-black rotate-[-12deg]">
                      <span>PT BKN</span>
                      <span>SAH RESMI</span>
                      <span>JAKARTA</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 underline">Arif Gunawan Panggabean</p>
                    <p className="text-[10px] text-slate-500">Direktur Utama / Founder Barokah Grup</p>
                  </div>
                </div>
              </div>

              {/* Bottom Print Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Dokumen Sah Digital - Barokah HRIS v2026.10</span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center space-x-1.5 transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak Dokumen Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
