'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { BACKEND_API, clearSession, getSessionUser, getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import AccessRightsModule from '@/components/AccessRightsModule';
import CoachingModule from '@/components/CoachingModule';
import LegalDocsModule from '@/components/LegalDocsModule';
import TrainingModule from '@/components/training/TrainingModule';
import { LEAVE_TYPES, actionFor, isPending, useAdminRequests } from '@/lib/requests';
import AppShell from '@/components/AppShell';
import DashboardHome from '@/components/DashboardHome';
import EmployeeDialog from '@/components/EmployeeDialog';
import EmployeeListModule from '@/components/EmployeeListModule';
import BankChangesModule from '@/components/BankChangesModule';
import CorrectionsModule from '@/components/CorrectionsModule';
import DailyAttendanceModule from '@/components/DailyAttendanceModule';
import AttendanceReviewModule from '@/components/AttendanceReviewModule';
import DailyReportsModule from '@/components/DailyReportsModule';
import CrewAppPreview from '@/components/CrewAppPreview';
import KpiModule from '@/components/KpiModule';
import InspectionsModule from '@/components/InspectionsModule';
import Survey360Module from '@/components/Survey360Module';
import SanctionsModule from '@/components/SanctionsModule';
import RequestsApprovalModule from '@/components/RequestsApprovalModule';
import OutletMasterModule from '@/components/OutletMasterModule';
import WorkScheduleModule from '@/components/WorkScheduleModule';
import PayrollModule from '@/components/PayrollModule';
import PayrollSettingsModule from '@/components/PayrollSettingsModule';
import {
  ChefHat,
  Building2,
  Users,
  Clock,
  Coffee,
  Wallet,
  CalendarDays,
  FileText,
  ShieldAlert,
  BrainCircuit,
  GraduationCap,
  Layers,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  MapPin,
  Download,
  Plus,
  BadgePercent,
  TrendingUp,
  Receipt,
  UserCheck,
  Calendar,
  SlidersHorizontal,
  Eye,
  Edit2,
  Trash2,
  X,
  Shuffle,
  Sparkles,
  RotateCcw,
  UtensilsCrossed,
  Smartphone,
  Tablet,
  Wifi,
  BatteryCharging,
  Radio,
  Cast,
  Monitor,
  Video,
  RefreshCw,
  Send,
  Activity,
  MessageSquare,
  QrCode,
  Power,
  ArrowUpRight,
  ArrowLeftRight,
  CheckCheck,
  ScanFace,
  Camera,
  ShieldCheck,
  ShoppingCart,
  ShoppingBag,
  Utensils,
  Printer,
  Maximize2,
  LogOut,
  ChevronDown,
  Tag,
  Lock,
  Unlock,
  MessageCircle,
  Upload,
  FileSpreadsheet,
  UserPlus,
  CreditCard,
  LayoutGrid,
  Menu,
  ArrowRight,
  BookOpen,
  KeyRound,
  Award,
  CheckSquare,
  FileSignature,
  Scale,
  FileBadge,
  Stamp,
  Star,
  Inbox,
  CalendarCheck2,
  Landmark,
  Check,
  Cake,
  Gift,
  Heart,
  CalendarRange,
  Briefcase,
  FileDown,
  BarChart3,
  PieChart,
  Filter,
  LogIn,
  Megaphone,
  BellRing,
  ClipboardCheck,
  TrendingDown,
  Flame,
  UserX,
} from 'lucide-react';
import ExitsModule from '@/components/ExitsModule';
import {
  AiSopStudio,
  AiSopModal,
  AiSopOfficialViewerModal,
  GeneratedSopDocument,
} from '@/components/AiSopGenerator';
import {
  CareerPathView,
} from '@/components/BerlianModules';

type MainMenuId =
  | 'hub'
  | 'employees'
  | 'attendance'
  | 'payroll'
  | 'performance'
  | 'development'
  | 'career'
  | 'coaching'
  | 'sops'
  | 'sanctions'
  | 'requests'
  | 'kru-portal'
  | 'permissions'
  | 'legal-docs'
  | 'outlets';

export default function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState<MainMenuId>('hub');
  const [activeSubTab, setActiveSubTab] = useState<string>('bento-cards');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Jumlah absen tablet yang menunggu tinjauan, untuk angka di menu Presensi
  const [reviewCount, setReviewCount] = useState(0);
  const refreshReviewCount = useCallback(() => {
    const role = getSessionUser()?.role;
    if (role !== 'SUPER_ADMIN' && role !== 'HR_ADMIN' && role !== 'STORE_MANAGER') return;
    apiFetch<unknown[]>('/attendance-review?status=NEEDS_REVIEW')
      .then((list) => setReviewCount(Array.isArray(list) ? list.length : 0))
      .catch(() => setReviewCount(0));
  }, []);
  useEffect(() => {
    refreshReviewCount();
  }, [refreshReviewCount]);

  // Pengajuan rekening gaji dari aplikasi kru yang menunggu HR
  const canReviewBank = ['SUPER_ADMIN', 'HR_ADMIN'].includes(getSessionUser()?.role ?? '');
  const [bankChangeCount, setBankChangeCount] = useState(0);
  const refreshBankChangeCount = useCallback(() => {
    if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(getSessionUser()?.role ?? '')) return;
    apiFetch<unknown[]>('/bank-changes?status=PENDING')
      .then((list) => setBankChangeCount(Array.isArray(list) ? list.length : 0))
      .catch(() => setBankChangeCount(0));
  }, []);
  useEffect(() => {
    refreshBankChangeCount();
  }, [refreshBankChangeCount]);

  // States: Artikel Kepemimpinan (Leader Hub) & Kuis 10 Soal

  // States: Asesmen DISC Kepribadian (20 Soal Situasional Restoran)

  // Modal States
  const [reviewModalData, setReviewModalData] = useState<{ title: string; category: string; data: Record<string, any> } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // State Interaktif Aplikasi Kru Resto (Portal Mobile Staf)
  const [kruActiveStaffId, setKruActiveStaffId] = useState<string>('STF-01');

  // Time Clock State
  const [timeClockStatus, setTimeClockStatus] = useState<'not_clocked' | 'clocked_in'>('not_clocked');
  const [timeClockLiveSeconds, setTimeClockLiveSeconds] = useState<number>(0);

  // Export PDF Report Modal State (Per Outlet & Filter Bulan dengan Nama-Nama Karyawan)
  const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState<boolean>(false);
  const [exportPdfOutlet, setExportPdfOutlet] = useState<string>('Cabang Senopati, Jaksel');
  const [exportPdfMonth, setExportPdfMonth] = useState<string>('Oktober 2026');
  const [exportPdfIncludeEmployeeDetails, setExportPdfIncludeEmployeeDetails] = useState<boolean>(true);

  const [currentTime, setCurrentTime] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Live timer for Time Clock
  useEffect(() => {
    let interval: any = null;
    if (timeClockStatus === 'clocked_in') {
      interval = setInterval(() => {
        setTimeClockLiveSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeClockStatus]);

  // Full Roster & Payroll Directory per Outlet untuk Cetak PDF Resmi (Dinamis dari Master Data)
  const getExportPayrollDirectory = (): Record<
    string,
    {
      outletName: string;
      address: string;
      leader: string;
      supervisor: string;
      employees: {
        nik: string;
        name: string;
        position: string;
        department: string;
        daysWorked: number;
        baseSalary: number;
        mealAllowance: number;
        leaveIncentive: number;
        kasbonDeduction: number;
        stockFineDeduction?: number;
        penaltyDeduction: number;
        paymentMethod: string;
        bankAccount: string;
      }[];
    }
  > => {
    const result: Record<string, any> = {};
    outletsConfigList.forEach((outlet) => {
      const outletEmployees = employeesMasterList.filter(
        (emp) =>
          emp.outlet.toLowerCase().includes(outlet.name.toLowerCase()) ||
          outlet.name.toLowerCase().includes(emp.outlet.toLowerCase()) ||
          emp.outlet.toLowerCase().includes(outlet.city.toLowerCase())
      );
      result[outlet.name] = {
        outletName: outlet.name,
        address: outlet.address,
        leader: outlet.managerName || 'Store Manager',
        supervisor: 'Supervisor Operasional Area',
        employees: outletEmployees.map((emp) => ({
          nik: emp.id,
          name: emp.fullName,
          position: emp.positionTitle,
          department: emp.department,
          daysWorked: 30,
          baseSalary: emp.positionKey === 'koki' ? 3000000 : emp.positionKey === 'kasir' ? 2600000 : 2400000,
          mealAllowance: 600000,
          leaveIncentive: 0,
          kasbonDeduction: 0,
          stockFineDeduction: 0,
          penaltyDeduction: 0,
          paymentMethod: emp.paymentMethod,
          bankAccount: emp.accountNumber,
        })),
      };
    });
    return result;
  };

  const handleDownloadPayrollBudgetPdfFiltered = (
    selectedOutlet: string,
    selectedMonth: string,
    includeEmployeeDetails: boolean
  ) => {
    const exportPayrollDirectoryByOutlet = getExportPayrollDirectory();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Pop-up browser terblokir. Harap izinkan pop-up untuk mencetak PDF laporan.');
      return;
    }

    const monthShort = selectedMonth.split(' ')[0];
    const isAllOutlets = selectedOutlet === 'SEMUA';
    
    // Tentukan outlets to print
    const outletsToPrint = isAllOutlets
      ? Object.keys(exportPayrollDirectoryByOutlet)
      : [selectedOutlet];

    let grandTotalCrew = 0;
    let grandTotalBaseSalary = 0;
    let grandTotalMeal = 0;
    let grandTotalIncentive = 0;
    let grandTotalKasbon = 0;
    let grandTotalStockFine = 0;
    let grandTotalTHP = 0;

    outletsToPrint.forEach((key) => {
      const data = exportPayrollDirectoryByOutlet[key];
      if (data) {
        data.employees.forEach((emp) => {
          grandTotalCrew += 1;
          grandTotalBaseSalary += emp.baseSalary;
          grandTotalMeal += emp.mealAllowance;
          grandTotalIncentive += emp.leaveIncentive;
          grandTotalKasbon += emp.kasbonDeduction;
          const fine = emp.stockFineDeduction || 0;
          grandTotalStockFine += fine;
          grandTotalTHP += emp.baseSalary + emp.mealAllowance + emp.leaveIncentive - emp.kasbonDeduction - fine - emp.penaltyDeduction;
        });
      }
    });

    const activeOutletData = !isAllOutlets ? exportPayrollDirectoryByOutlet[selectedOutlet] : null;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Laporan Payroll ${isAllOutlets ? 'Konsolidasi Seluruh Cabang' : activeOutletData?.outletName} - ${selectedMonth}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 15px;
            background: #ffffff;
            font-size: 10.5px;
            line-height: 1.4;
          }
          .header {
            border-bottom: 2.5px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .logo-badge {
            background: #0f172a;
            color: #f59e0b;
            font-weight: 900;
            font-size: 14px;
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid #f59e0b;
            letter-spacing: 0.5px;
          }
          .title {
            font-size: 16px;
            font-weight: 900;
            color: #0f172a;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: -0.2px;
          }
          .subtitle {
            font-size: 10.5px;
            color: #475569;
            margin-top: 2px;
          }
          .badge {
            background: #ecfdf5;
            color: #047857;
            padding: 4px 9px;
            border-radius: 6px;
            font-size: 9.5px;
            font-weight: 800;
            border: 1px solid #a7f3d0;
            display: inline-block;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin-bottom: 16px;
          }
          .summary-card {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px 10px;
          }
          .summary-card .label {
            font-size: 9px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 800;
          }
          .summary-card .value {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 16px;
            font-size: 9.5px;
          }
          th {
            background: #f1f5f9;
            padding: 7px 8px;
            text-align: left;
            font-weight: 800;
            border-top: 1.5px solid #0f172a;
            border-bottom: 2px solid #94a3b8;
            color: #1e293b;
            font-size: 9px;
            text-transform: uppercase;
          }
          td {
            padding: 6px 8px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
          }
          tr:nth-child(even) td {
            background: #fafafa;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .total-row td {
            background: #f1f5f9;
            font-weight: 900;
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            color: #0f172a;
            font-size: 10px;
          }
          .sop-notice {
            background: #fffbeb;
            border: 1px solid #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 8px 12px;
            border-radius: 6px;
            margin-top: 12px;
            margin-bottom: 20px;
            font-size: 9px;
            color: #92400e;
            line-height: 1.5;
          }
          .footer {
            margin-top: 25px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .sig-box {
            text-align: center;
            width: 200px;
          }
          .sig-line {
            margin-top: 45px;
            border-top: 1px solid #0f172a;
            font-weight: 800;
            padding-top: 4px;
            font-size: 10px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <!-- Kop Surat Resmi Barokah Grup -->
        <div style="margin-bottom: 12px;">
          <img src="/kop-surat-barokah.jpg" style="width: 100%; height: auto; object-fit: contain; display: block; border-radius: 6px;" alt="Kop Surat Resmi Barokah Grup" />
        </div>

        <!-- Header -->
        <div class="header" style="margin-top: 8px;">
          <div class="header-left">
            <div>
              <h1 class="title">
                ${isAllOutlets ? 'LAPORAN REKAPITULASI PAYROLL KONSOLIDASI SELURUH CABANG' : `LAPORAN REKAPITULASI PAYROLL & KEHADIRAN:${activeOutletData?.outletName.toUpperCase()}`}
              </h1>
              <p class="subtitle">
                <strong>Unit:</strong> ${isAllOutlets ? 'Konsolidasi 4 Outlet Restoran (Senopati, Kelapa Gading, BSD, Bintaro)' : `${activeOutletData?.outletName} • ${activeOutletData?.address}`}
              </p>
              <p class="subtitle">
                <strong>Periode Cut-Off:</strong> 25 ${selectedMonth} • <strong>Penanggung Jawab:</strong> ${isAllOutlets ? 'Manajemen HQ Pusat' : activeOutletData?.leader}
              </p>
            </div>
          </div>
          <div style="text-align: right;">
            <span class="badge">STATUS: SIAP TRANSFER / SAH</span>
            <p class="subtitle" style="margin-top: 4px; font-size: 9px;">Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • Oleh Super Admin</p>
            <p class="subtitle" style="font-size: 8.5px; font-family: monospace;">DOC/BKN-PAY/${selectedMonth.replace(' ', '-').toUpperCase()}</p>
          </div>
        </div>

        <!-- KPI Summary Cards -->
        <div class="summary-grid">
          <div class="summary-card">
            <div class="label">Total Kru Terdaftar</div>
            <div class="value">${grandTotalCrew} Karyawan</div>
          </div>
          <div class="summary-card">
            <div class="label">Total Gaji Pokok</div>
            <div class="value">Rp ${grandTotalBaseSalary.toLocaleString('id-ID')}</div>
          </div>
          <div class="summary-card">
            <div class="label">Uang Makan (20k/hr)</div>
            <div class="value">Rp ${grandTotalMeal.toLocaleString('id-ID')}</div>
          </div>
          <div class="summary-card">
            <div class="label">Insentif Libur SOP</div>
            <div class="value" style="color: #059669;">+Rp ${grandTotalIncentive.toLocaleString('id-ID')}</div>
          </div>
          <div class="summary-card" style="background: #f0fdf4; border-color: #86efac;">
            <div class="label" style="color: #166534;">Total Gaji Bersih (THP)</div>
            <div class="value" style="color: #15803d;">Rp ${grandTotalTHP.toLocaleString('id-ID')}</div>
          </div>
        </div>

        ${isAllOutlets ? `
          <h3 style="font-size: 11px; font-weight: 800; margin: 12px 0 6px 0; color: #0f172a; text-transform: uppercase;">
            I. Rangkuman Beban Anggaran Payroll Konsolidasi Antar-Cabang Restoran
          </h3>
          <table>
            <thead>
              <tr>
                <th style="width: 25px;">No</th>
                <th>Nama Cabang Outlet</th>
                <th>Alamat Restoran</th>
                <th>Pimpinan Cabang</th>
                <th class="text-right">Kru</th>
                <th class="text-right">Gaji Pokok</th>
                <th class="text-right">Uang Makan</th>
                <th class="text-right">Insentif Libur</th>
                <th class="text-right">Pot. Kasbon</th>
                <th class="text-right" style="color: #b91c1c;">Pot. Denda Stok</th>
                <th class="text-right">Total Anggaran THP</th>
              </tr>
            </thead>
            <tbody>
              ${outletsToPrint.map((key, idx) => {
                const out = exportPayrollDirectoryByOutlet[key];
                const totalKru = out.employees.length;
                const gapok = out.employees.reduce((s, e) => s + e.baseSalary, 0);
                const makan = out.employees.reduce((s, e) => s + e.mealAllowance, 0);
                const insentif = out.employees.reduce((s, e) => s + e.leaveIncentive, 0);
                const kasbon = out.employees.reduce((s, e) => s + e.kasbonDeduction, 0);
                const dendaStok = out.employees.reduce((s, e) => s + (e.stockFineDeduction || 0), 0);
                const thp = gapok + makan + insentif - kasbon - dendaStok;
                return `
                  <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td><b>${out.outletName}</b></td>
                    <td>${out.address}</td>
                    <td>${out.leader}</td>
                    <td class="text-right">${totalKru} Staf</td>
                    <td class="text-right">Rp ${gapok.toLocaleString('id-ID')}</td>
                    <td class="text-right">Rp ${makan.toLocaleString('id-ID')}</td>
                    <td class="text-right" style="color: #059669;">+Rp ${insentif.toLocaleString('id-ID')}</td>
                    <td class="text-right" style="color: #dc2626;">-Rp ${kasbon.toLocaleString('id-ID')}</td>
                    <td class="text-right" style="color: #b91c1c;">${dendaStok > 0 ? `-Rp ${dendaStok.toLocaleString('id-ID')}` : '-'}</td>
                    <td class="text-right" style="font-weight: 800; color: #047857;">Rp ${thp.toLocaleString('id-ID')}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td colspan="4"><b>TOTAL KONSOLIDASI SELURUH 4 OUTLET RESTORAN</b></td>
                <td class="text-right"><b>${grandTotalCrew} Staf</b></td>
                <td class="text-right"><b>Rp ${grandTotalBaseSalary.toLocaleString('id-ID')}</b></td>
                <td class="text-right"><b>Rp ${grandTotalMeal.toLocaleString('id-ID')}</b></td>
                <td class="text-right" style="color: #059669;"><b>+Rp ${grandTotalIncentive.toLocaleString('id-ID')}</b></td>
                <td class="text-right" style="color: #dc2626;"><b>-Rp ${grandTotalKasbon.toLocaleString('id-ID')}</b></td>
                <td class="text-right" style="color: #b91c1c;"><b>${grandTotalStockFine > 0 ? `-Rp ${grandTotalStockFine.toLocaleString('id-ID')}` : '-'}</b></td>
                <td class="text-right" style="font-size: 11px; color: #047857;"><b>Rp ${grandTotalTHP.toLocaleString('id-ID')}</b></td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        ${includeEmployeeDetails ? `
          <h3 style="font-size: 11px; font-weight: 800; margin: 16px 0 6px 0; color: #0f172a; text-transform: uppercase;">
            ${isAllOutlets ? 'II. Rincian Lengkap Daftar Nama-Nama Karyawan Seluruh Cabang' : 'Rincian Lengkap Daftar Nama-Nama Karyawan Cabang'}
          </h3>
          ${outletsToPrint.map((key) => {
            const out = exportPayrollDirectoryByOutlet[key];
            let subtotalGapok = 0;
            let subtotalMakan = 0;
            let subtotalInsentif = 0;
            let subtotalKasbon = 0;
            let subtotalStockFine = 0;
            let subtotalTHP = 0;

            return `
              <div style="margin-bottom: 20px; page-break-inside: avoid;">
                ${isAllOutlets ? `
                  <div style="background: #e2e8f0; padding: 6px 10px; font-weight: 800; font-size: 10px; border-radius: 4px; margin-top: 10px; display: flex; justify-content: space-between;">
                    <span>${out.outletName.toUpperCase()}:${out.address}</span>
                    <span>Pimpinan: ${out.leader} • ${out.employees.length} Kru</span>
                  </div>
                ` : ''}
                <table>
                  <thead>
                    <tr>
                      <th style="width: 22px;">No</th>
                      <th style="width: 55px;">NIK Staf</th>
                      <th style="width: 135px;">Nama Karyawan</th>
                      <th>Posisi / Station</th>
                      <th class="text-center" style="width: 42px;">Dinas</th>
                      <th class="text-right">Gaji Pokok</th>
                      <th class="text-right">Uang Makan</th>
                      <th class="text-right">Insentif Libur</th>
                      <th class="text-right">Pot. Kasbon</th>
                      <th class="text-right" style="color: #b91c1c;">Pot. Denda Stok</th>
                      <th class="text-right">Take Home Pay</th>
                      <th>Rekening / E-Wallet</th>
                      <th class="text-center" style="width: 55px;">Paraf</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${out.employees.map((emp, eIdx) => {
                      const fine = emp.stockFineDeduction || 0;
                      const empTHP = emp.baseSalary + emp.mealAllowance + emp.leaveIncentive - emp.kasbonDeduction - fine - emp.penaltyDeduction;
                      subtotalGapok += emp.baseSalary;
                      subtotalMakan += emp.mealAllowance;
                      subtotalInsentif += emp.leaveIncentive;
                      subtotalKasbon += emp.kasbonDeduction;
                      subtotalStockFine += fine;
                      subtotalTHP += empTHP;

                      return `
                        <tr>
                          <td class="text-center">${eIdx + 1}</td>
                          <td style="font-family: monospace; font-weight: bold;">${emp.nik}</td>
                          <td><b>${emp.name}</b></td>
                          <td>${emp.position}</td>
                          <td class="text-center">${emp.daysWorked} hr</td>
                          <td class="text-right">Rp ${emp.baseSalary.toLocaleString('id-ID')}</td>
                          <td class="text-right">Rp ${emp.mealAllowance.toLocaleString('id-ID')}</td>
                          <td class="text-right" style="color: ${emp.leaveIncentive > 0 ? '#059669' : '#64748b'}; font-weight: ${emp.leaveIncentive > 0 ? 'bold' : 'normal'};">
                            ${emp.leaveIncentive > 0 ? `+Rp ${emp.leaveIncentive.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td class="text-right" style="color: ${emp.kasbonDeduction > 0 ? '#dc2626' : '#64748b'}; font-weight: ${emp.kasbonDeduction > 0 ? 'bold' : 'normal'};">
                            ${emp.kasbonDeduction > 0 ? `-Rp ${emp.kasbonDeduction.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td class="text-right" style="color: ${fine > 0 ? '#b91c1c' : '#64748b'}; font-weight: ${fine > 0 ? 'bold' : 'normal'};">
                            ${fine > 0 ? `-Rp ${fine.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td class="text-right" style="font-weight: 800; color: #047857;">
                            Rp ${empTHP.toLocaleString('id-ID')}
                          </td>
                          <td style="font-size: 8.5px; font-family: monospace;">
                            ${emp.paymentMethod}: ${emp.bankAccount}
                          </td>
                          <td class="text-center" style="color: #94a3b8; font-size: 8px;">
                            [............]
                          </td>
                        </tr>
                      `;
                    }).join('')}
                    <tr class="total-row">
                      <td colspan="5"><b>SUBTOTAL ${out.outletName.toUpperCase()} (${out.employees.length} KRU)</b></td>
                      <td class="text-right"><b>Rp ${subtotalGapok.toLocaleString('id-ID')}</b></td>
                      <td class="text-right"><b>Rp ${subtotalMakan.toLocaleString('id-ID')}</b></td>
                      <td class="text-right" style="color: #059669;"><b>+Rp ${subtotalInsentif.toLocaleString('id-ID')}</b></td>
                      <td class="text-right" style="color: #dc2626;"><b>-Rp ${subtotalKasbon.toLocaleString('id-ID')}</b></td>
                      <td class="text-right" style="color: #b91c1c;"><b>${subtotalStockFine > 0 ? `-Rp ${subtotalStockFine.toLocaleString('id-ID')}` : '-'}</b></td>
                      <td class="text-right" style="color: #047857;"><b>Rp ${subtotalTHP.toLocaleString('id-ID')}</b></td>
                      <td colspan="2" style="font-size: 8.5px; color: #475569;">100% Rekening Valid</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        ` : ''}

        <!-- SOP Compliance Notice -->
        <div class="sop-notice">
          <strong>PENEGASAN KEPATUHAN SOP & REGULASI RESTORAN:</strong><br/>
          1. <strong>Insentif Hak Libur (SK No. 001/V/2025 Pasal 2.3):</strong> Staf yang memilih tidak mengambil jatah libur bulanan 2 hari diberikan kompensasi insentif tunai penuh Rp 75.000/hari (maks. Rp 150.000) yang telah digabungkan ke nominal THP di atas.<br/>
          2. <strong>Potongan Kasbon (SOP-HR-002):</strong> Potongan kasbon telah divalidasi tidak melebihi batas 50% gaji pokok dan diselaraskan dengan termin pencairan kasir outlet.<br/>
          3. <strong>Otoritas Approval:</strong> Dokumen ini merupakan bukti sah yang telah disetujui Direksi Finance & Owner Pusat untuk diteruskan ke proses kliring perbankan/e-wallet.
        </div>

        <!-- 3-Tier Official Signature Blocks -->
        <div class="footer">
          <div class="sig-box">
            <p style="font-size: 9.5px; margin-bottom: 2px; color: #64748b;">Dibuat & Dihitung Oleh:</p>
            <div class="sig-line">
              Petugas HRD &amp; Payroll HQ<br/>
              <span style="font-weight: normal; color: #64748b; font-size: 9px;">Pusat Administrasi Barokah Grup</span>
            </div>
          </div>
          <div class="sig-box">
            <p style="font-size: 9.5px; margin-bottom: 2px; color: #64748b;">Diketahui & Diverifikasi:</p>
            <div class="sig-line">
              ${isAllOutlets ? 'Para Kepala Cabang Resto' : activeOutletData?.leader}<br/>
              <span style="font-weight: normal; color: #64748b; font-size: 9px;">Pimpinan Operasional Cabang</span>
            </div>
          </div>
          <div class="sig-box">
            <p style="font-size: 9.5px; margin-bottom: 2px; color: #64748b;">Disetujui Sah (ACC Final):</p>
            <div class="sig-line">
              Owner / Direktur Utama<br/>
              <span style="font-weight: normal; color: #047857; font-size: 9px; font-weight: bold;">Super Admin (PT Barokah Kuliner)</span>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showToast(`Dokumen Resmi Payroll ${isAllOutlets ? 'Semua Cabang' : activeOutletData?.outletName} (${selectedMonth}) siap dicetak / disimpan PDF!`);
  };



  // =========================================================================
  // SISTEM ALARM PENGINGAT WAKTU SHOLAT OTOMATIS BERBASIS LOKASI OUTLET
  // =========================================================================
  type PrayerKey = 'shubuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';

  interface OutletPrayerSchedule {
    shubuh: string;
    dzuhur: string;
    ashar: string;
    maghrib: string;
    isya: string;
    timezone: string;
  }

  interface PrayerAlarmInfo {
    active: boolean;
    type: 'PRE_10_MIN' | 'ADHAN';
    prayerKey: PrayerKey;
    prayerLabel: string;
    prayerTime: string;
    outletName: string;
    cityLabel: string;
    soundMuted: boolean;
  }

  const getPrayerTimesByOutlet = (outletNameOrCity: string): { schedule: OutletPrayerSchedule; cityLabel: string } => {
    const lower = (outletNameOrCity || '').toLowerCase();
    if (lower.includes('tebing') || lower.includes('medan') || lower.includes('sumut')) {
      return {
        schedule: { shubuh: '04:58', dzuhur: '12:18', ashar: '15:32', maghrib: '18:22', isya: '19:31', timezone: 'WIB' },
        cityLabel: 'Tebing Tinggi (Sumut)',
      };
    }
    if (lower.includes('surabaya') || lower.includes('jatim')) {
      return {
        schedule: { shubuh: '04:06', dzuhur: '11:27', ashar: '14:40', maghrib: '17:33', isya: '18:43', timezone: 'WIB' },
        cityLabel: 'Surabaya (Jawa Timur)',
      };
    }
    if (lower.includes('bali') || lower.includes('denpasar')) {
      return {
        schedule: { shubuh: '04:55', dzuhur: '12:15', ashar: '15:28', maghrib: '18:21', isya: '19:32', timezone: 'WITA' },
        cityLabel: 'Denpasar (Bali)',
      };
    }
    if (lower.includes('makassar') || lower.includes('sulsel')) {
      return {
        schedule: { shubuh: '04:38', dzuhur: '11:58', ashar: '15:12', maghrib: '18:04', isya: '19:14', timezone: 'WITA' },
        cityLabel: 'Makassar (Sulawesi Selatan)',
      };
    }
    if (lower.includes('bandung') || lower.includes('jabar')) {
      return {
        schedule: { shubuh: '04:30', dzuhur: '11:48', ashar: '15:02', maghrib: '17:54', isya: '19:04', timezone: 'WIB' },
        cityLabel: 'Bandung (Jawa Barat)',
      };
    }
    // Default DKI Jakarta / Jabodetabek (Senopati, PIK, dll)
    return {
      schedule: { shubuh: '04:32', dzuhur: '11:51', ashar: '15:04', maghrib: '17:56', isya: '19:06', timezone: 'WIB' },
      cityLabel: 'DKI Jakarta & Sekitarnya',
    };
  };

  const playPrayerChime = (type: 'PRE_10_MIN' | 'ADHAN') => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (type === 'PRE_10_MIN') {
        const notes = [659.25, 830.61, 987.77];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.28);
          gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.28);
          gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + idx * 0.28 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.28 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.28);
          osc.stop(ctx.currentTime + idx * 0.28 + 0.6);
        });
      } else {
        const adhanNotes = [
          { f: 440.0, d: 0.5, t: 0.0 },
          { f: 554.37, d: 0.6, t: 0.5 },
          { f: 659.25, d: 1.1, t: 1.1 },
          { f: 554.37, d: 0.7, t: 2.2 },
          { f: 440.0, d: 1.3, t: 2.9 },
        ];
        adhanNotes.forEach((n) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(n.f, ctx.currentTime + n.t);
          gain.gain.setValueAtTime(0.001, ctx.currentTime + n.t);
          gain.gain.exponentialRampToValueAtTime(0.32, ctx.currentTime + n.t + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n.t + n.d);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + n.t);
          osc.stop(ctx.currentTime + n.t + n.d + 0.1);
        });
      }
    } catch {
      // Audio might be silenced by browser policy
    }
  };

  const [prayerAlarmState, setPrayerAlarmState] = useState<PrayerAlarmInfo | null>(null);
  const [prayerSoundMuted, setPrayerSoundMuted] = useState<boolean>(false);
  const [kruPrayerTurnActive, setKruPrayerTurnActive] = useState<boolean>(false);
  const [kruPrayerTurnMinutesRemaining, setKruPrayerTurnMinutesRemaining] = useState<number>(15);
  const [kruPrayerTurnCurrentName, setKruPrayerTurnCurrentName] = useState<string>('Dzuhur');
  const lastTriggeredPrayerRef = useRef<string>('');

  // Countdown Timer Giliran Sholat (15 Menit)
  useEffect(() => {
    let intv: NodeJS.Timeout | null = null;
    if (kruPrayerTurnActive) {
      intv = setInterval(() => {
        setKruPrayerTurnMinutesRemaining((prev) => {
          if (prev <= 1) {
            setKruPrayerTurnActive(false);
            showToast('Waktu giliran sholat selesai (15 Menit). Silakan kembali ke station dan infokan rekan berikutnya!');
            return 15;
          }
          return prev - 1;
        });
      }, 60000);
    }
    return () => {
      if (intv) clearInterval(intv);
    };
  }, [kruPrayerTurnActive]);

  const [survey360StaffResponses, setSurvey360StaffResponses] = useState<Record<string, {
    completed: boolean;
    averageScore: number;
    respondentsCount: number;
    peerScore: number;
    supervisorScore: number;
    selfScore: number;
    scoresBreakdown: number[];
    anonymousNotes: string[];
  }>>({});

  // Staff Payroll Data (Terintegrasi SOP Libur 001/V/2025 & Struktur Gaji 2026)
  interface PayrollStaffItem {
    id: string;
    name: string;
    nik: string;
    outlet: string;
    positionKey: string;
    positionTitle: string;
    tenureStatus: 'MAGANG_3_HARI' | 'UNDER_3_MONTHS' | 'OVER_3_MONTHS' | 'SENIOR_6_MONTHS';
    monthsWorked?: number; // Total masa kerja dalam bulan untuk kalkulasi Tunjangan Lama Bekerja (SOP-HR-005)
    customBaseSalary?: number; // Input langsung/custom Gaji Pokok karyawan (jika kosong, pakai rumus otomatis)
    customMealAllowance?: number; // Input langsung/custom Uang Makan karyawan
    customOvertime?: number; // Input langsung/custom Lembur karyawan
    customPositionAllowance?: number; // Input langsung/custom Tunjangan Jabatan karyawan
    isMarried: boolean;
    daysWorked: number;
    unusedOffDays: number; // SOP Pasal 2.3: Rp 75.000/hari tidak diambil (maks. Rp 150.000/bln)
    offViolationPenalty: number; // SOP-HR-003: Weekend Rp 200rb, Libur Nas (Peak Season) Rp 250rb, Mendadak <H-3 Rp 50rb, Izin Habis Rp 15rb/25rb
    stockFineDeduction: number; // Potongan denda selisih stok / opname bahan baku resto (input manual)
    unpaidLeaveDays?: number; // SOP-HR-006: Jumlah hari cuti tidak dibayar (Melahirkan 27h, Keguguran 11h, Duka 4h, Nikah/Cerai 2h, Umroh 14h)
    annualLeaveDays?: number; // SOP-HR-007: Jumlah hari cuti tahunan berjenjang yang diambil (Upah Terhitung 100% Gaji Pokok)
    halfDayLeaveDays?: number; // SOP Bab 5: Jumlah hari izin pulang setengah hari (>50% weekday: uang makan & lembur ditiadakan)
    halfDayPenalties?: number; // SOP Bab 5: Denda izin 1/2 hari (Weekend 25%-50% = Rp 100k, Weekend <25% = Rp 200k)
    kasbonDeduction: number;
    penaltyDeduction: number;
    bonusAdjustment: number;
    kpiScore?: number;
    kpiGrade?: 'A' | 'B' | 'C' | 'D';
    kpiIncentive?: number; // Insentif KPI Grade A: Rp 100.000, Grade B/C/D = Rp 0
    paymentStatus: 'SIAP_TRANSFER' | 'SUDAH_DIBAYAR' | 'PENDING_REVIEW' | 'GAJI_TERTUNDA' | 'HANGUS_RESIGN_SEPIHAK';
  }

  const initialPayrollStaffList: PayrollStaffItem[] = [];

  const [payrollStaffList, setPayrollStaffList] = useState<PayrollStaffItem[]>(initialPayrollStaffList);
  const hasLoadedPayrollRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hris_payroll_staff_list');
      if (saved) {
        setPayrollStaffList(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading payrollStaffList:', e);
    }
    hasLoadedPayrollRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasLoadedPayrollRef.current) return;
    try {
      localStorage.setItem('hris_payroll_staff_list', JSON.stringify(payrollStaffList));
    } catch (e) {
      console.error('Error saving payrollStaffList:', e);
    }
  }, [payrollStaffList]);

  interface KruDirectoryStaffItem {
    id: string;
    name: string;
    nik: string;
    role: string;
    department: string;
    outlet: string;
    shift: string;
    breakSlot: string;
    breakStatus: string;
    clockInTime: string;
    clockInStatus: string;
    positionKey: string;
    tenureStatus: 'MAGANG_3_HARI' | 'UNDER_3_MONTHS' | 'OVER_3_MONTHS' | 'SENIOR_6_MONTHS';
    isMarried: boolean;
    kasbonLimit: number;
    avatar: string;
    phone: string;
    device: string;
    joinDate: string;
  }

  // ==============================================================
  // MASTER DATA KARYAWAN & SINKRONISASI DATABASE POSTGRESQL
  // ==============================================================
  interface EmployeeMaster {
    id: string; // EMP-001
    nikKtp: string;
    fullName: string;
    nickname: string;
    birthPlace: string;
    birthDate: string; // YYYY-MM-DD
    gender: 'Laki-laki' | 'Perempuan';
    religion: string;
    phone: string;
    addressKtp: string;
    addressDomisili: string;

    // Penempatan Resto
    outlet: string;
    department: 'Produksi (Kitchen BOH)' | 'Layanan (Service FOH)' | 'Kasir & Billing';
    positionKey: 'koki' | 'kasir' | 'waiters' | 'helper' | 'kepalaProduksi' | 'kepalaCabang';
    positionTitle: string;
    stationKey: 'koki' | 'kasir' | 'waiters' | 'pic';
    joinDate: string; // YYYY-MM-DD
    mutationHistory?: Array<{
      date: string;
      fromOutlet: string;
      toOutlet: string;
      reason: string;
      skNumber: string;
      newRole?: string;
    }>;

    // Payroll & Keuangan
    isMarried: boolean;
    paymentMethod: 'BANK' | 'E_WALLET';
    bankOrWalletProvider: string;
    accountNumber: string;
    accountHolderName: string;

    // Kontak Darurat
    emergencyName: string;
    emergencyRelation: 'Orang Tua' | 'Pasangan' | 'Saudara Kandung' | 'Lainnya';
    emergencyPhone: string;

    // Dokumen & Status
    avatar: string;
    hasKtpFile: boolean;
    hasKkFile: boolean;
    hasContractFile: boolean;
    faceEnrolled: boolean;
    source: 'WEB_ADMIN' | 'EXCEL_IMPORT' | 'ANDROID_APP';
  }

  // Helper Menghitung Masa Kerja Otomatis & Kategori Gaji 2026
  // Helper Menghitung Masa Kerja Otomatis & Kategori Gaji 2026 (SOP-HR-005)
  const calculateTenure = (joinDateStr: string): {
    years: number;
    months: number;
    days: number;
    totalMonths: number;
    text: string;
    category: 'MAGANG_3_HARI' | 'UNDER_3_MONTHS' | 'OVER_3_MONTHS' | 'SENIOR_6_MONTHS';
    categoryLabel: string;
    tenureAllowance: number;
    tenureAllowanceLabel: string;
  } => {
    if (!joinDateStr) {
      return {
        years: 0,
        months: 0,
        days: 0,
        totalMonths: 0,
        text: '-',
        category: 'UNDER_3_MONTHS',
        categoryLabel: 'Probation (< 3 Bulan)',
        tenureAllowance: 0,
        tenureAllowanceLabel: 'Rp 0 (Masa Kerja ≤ 6 Bulan)',
      };
    }
    const joinDate = new Date(joinDateStr);
    const today = new Date('2026-10-17');
    if (isNaN(joinDate.getTime())) {
      return {
        years: 0,
        months: 0,
        days: 0,
        totalMonths: 0,
        text: '-',
        category: 'UNDER_3_MONTHS',
        categoryLabel: 'Probation (< 3 Bulan)',
        tenureAllowance: 0,
        tenureAllowanceLabel: 'Rp 0 (Masa Kerja ≤ 6 Bulan)',
      };
    }

    const diffTime = today.getTime() - joinDate.getTime();
    const diffDaysTotal = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let years = today.getFullYear() - joinDate.getFullYear();
    let months = today.getMonth() - joinDate.getMonth();
    let days = today.getDate() - joinDate.getDate();

    if (days < 0) {
      months--;
      const prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      days += prevMonthLastDay;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    let text = '';
    if (years > 0) text += `${years} Thn `;
    if (months > 0) text += `${months} Bln `;
    text += `${Math.max(0, days)} Hari`;

    const totalMonths = Math.max(0, years * 12 + months);

    let category: 'MAGANG_3_HARI' | 'UNDER_3_MONTHS' | 'OVER_3_MONTHS' | 'SENIOR_6_MONTHS' = 'OVER_3_MONTHS';
    let categoryLabel = 'Karyawan Tetap (> 3 Bulan)';

    if (diffDaysTotal <= 3) {
      category = 'MAGANG_3_HARI';
      categoryLabel = 'Magang Training (1-3 Hari)';
    } else if (diffDaysTotal < 90) {
      category = 'UNDER_3_MONTHS';
      categoryLabel = 'Probation (< 3 Bulan)';
    } else if (diffDaysTotal < 180) {
      category = 'OVER_3_MONTHS';
      categoryLabel = 'Karyawan Tetap (> 3 Bulan)';
    } else {
      category = 'SENIOR_6_MONTHS';
      categoryLabel = 'Senior (> 6 Bulan) +Tunjangan';
    }

    // SOP-HR-005 Tunjangan Lama Bekerja
    let tenureAllowance = 0;
    let tenureAllowanceLabel = 'Rp 0 (Masa Kerja ≤ 6 Bulan)';

    if (totalMonths >= 7 && totalMonths <= 12) {
      tenureAllowance = 100000;
      tenureAllowanceLabel = '+Rp 100.000 / bln (SOP-HR-005: Bln 7-12)';
    } else if (totalMonths >= 13 && totalMonths <= 18) {
      tenureAllowance = 200000;
      tenureAllowanceLabel = '+Rp 200.000 / bln (SOP-HR-005: Bln 13-18)';
    } else if (totalMonths >= 19 && totalMonths <= 24) {
      tenureAllowance = 250000;
      tenureAllowanceLabel = '+Rp 250.000 / bln (SOP-HR-005: Bln 19-24)';
    } else if (totalMonths >= 25) {
      const extraSteps = Math.floor((totalMonths - 19) / 6) + 1;
      tenureAllowance = 200000 + (extraSteps * 50000);
      tenureAllowanceLabel = `+Rp ${tenureAllowance.toLocaleString('id-ID')} / bln (SOP-HR-005: Bln ${totalMonths})`;
    }

    return {
      years,
      months,
      days,
      totalMonths,
      text: text.trim(),
      category,
      categoryLabel,
      tenureAllowance,
      tenureAllowanceLabel,
    };
  };

  const initialEmployeesMaster: EmployeeMaster[] = [];
  const [employeesMasterList, setEmployeesMasterList] = useState<EmployeeMaster[]>(initialEmployeesMaster);

  // Integrasi Backend API (sesi dibuat di halaman login, dicek oleh AuthGuard)
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [backendToken, setBackendToken] = useState<string>('');

  // Data karyawan hanya dari backend (tidak lagi disimpan di browser)
  const reloadEmployees = useCallback(async () => {
    const token = getToken() || '';
    setBackendToken(token);
    if (!token) return;
    try {
      const empRes = await fetch(`${BACKEND_API}/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!empRes.ok) return;
      const empData = await empRes.json();
      setIsBackendConnected(true);
      // Karyawan nonaktif tidak ditampilkan di daftar aktif
      const mapped: EmployeeMaster[] = empData.filter((e: any) => e.user?.isActive !== false).map((e: any) => ({
        id: e.nik || e.id,
        nikKtp: e.nik || '',
        fullName: e.fullName || '',
        nickname: (e.fullName || '').split(' ')[0],
        birthPlace: 'Kota',
        birthDate: e.birthDate ? new Date(e.birthDate).toISOString().split('T')[0] : '2000-01-01',
        gender: (e.gender || 'Laki-laki') as any,
        religion: 'Islam',
        phone: e.phone || '',
        addressKtp: e.address || '',
        addressDomisili: e.address || '',
        outlet: e.outlet?.name || '-',
        department: (e.position?.department?.name || 'Produksi (Kitchen BOH)') as any,
        positionKey: (e.position?.title?.toLowerCase().includes('cook') ? 'koki' : 'waiters') as any,
        positionTitle: e.position?.title || 'Staf Resto',
        stationKey: 'koki',
        joinDate: e.joinDate ? new Date(e.joinDate).toISOString().split('T')[0] : '2026-01-01',
        isMarried: false,
        paymentMethod: 'BANK',
        bankOrWalletProvider: e.bankName || 'BCA',
        accountNumber: e.bankAccountNumber || '',
        accountHolderName: e.bankAccountHolder || e.fullName || '',
        emergencyName: 'Keluarga',
        emergencyRelation: 'Orang Tua',
        emergencyPhone: e.phone || '',
        avatar: (e.fullName || 'ST').slice(0, 2).toUpperCase(),
        hasKtpFile: true,
        hasKkFile: false,
        hasContractFile: true,
        faceEnrolled: true,
        source: 'WEB_ADMIN',
      }));
      setEmployeesMasterList(mapped);
    } catch (err) {
      console.warn('Backend tidak bisa dihubungi:', err);
    }
  }, []);

  useEffect(() => {
    reloadEmployees();
  }, [reloadEmployees]);

  // Kru Directory yang Diturunkan Secara Dinamis dari Data Riil Karyawan
  const kruStaffDirectory: KruDirectoryStaffItem[] = employeesMasterList.map((emp) => ({
    id: emp.id,
    name: emp.fullName,
    nik: emp.id,
    role: emp.positionTitle,
    department: emp.department,
    outlet: emp.outlet,
    shift: 'Shift Reguler Resto',
    breakSlot: 'Kloter Istirahat',
    breakStatus: 'Standby di Station',
    clockInTime: '-',
    clockInStatus: 'BELUM_ABSEN',
    positionKey: emp.positionKey,
    tenureStatus: 'OVER_3_MONTHS' as const,
    isMarried: emp.isMarried,
    kasbonLimit: 1500000,
    avatar: emp.avatar || emp.fullName.slice(0, 2).toUpperCase(),
    phone: emp.phone,
    device: 'Android Smartphone',
    joinDate: emp.joinDate,
  }));

  // Multi-Outlet Filter Data & Full Configuration (SOP Barokah Grup 2026)
  interface OutletConfig {
    id: string;
    name: string;
    unitBrand: 'Ayam Bakar Surabaya' | 'Pecel Lele Pak Haji' | 'Ayam Pecak 2001 Seafood' | 'Unit Lain';
    address: string;
    city: string;
    cutoffDate: number; // Tanggal Tutup Buku (Cut-off Payroll) - Input Manual
    paydayDate: number; // Tanggal Gajian (Payday) - Input Manual
    dailyKasbonMaxCashout: number; // Batas kas keluar kasbon harian per outlet (Rp 500.000)
    managerName: string;
    totalStaff: number;
    operatingHoursWeekday?: string; // Jam Operasional Weekday (Input Manual)
    operatingHoursWeekend?: string; // Jam Operasional Weekend & Libur Nasional (Input Manual)
    closingHours?: string; // Jam Selesai Closing & Pembersihan (Input Manual)
    operatingHours: string; // Teks ringkasan jam operasional
    workHours: string; // Jam Kerja Staf (Input Manual)
    breakHours: number; // Durasi Istirahat Resmi (Jam)
    overtimeScheme: string; // Skema Lembur Resmi Cabang
    maxDailyOffQuota: number; // SOP: <8 karyawan = 1 orang/hari, >=8 karyawan = 2 orang/hari
  }

  const initialOutletsConfig: OutletConfig[] = [];
  const [outletsConfigList, setOutletsConfigList] = useState<OutletConfig[]>(initialOutletsConfig);

  const hasLoadedOutletsRef = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hris_outlets_config');
      if (saved) {
        setOutletsConfigList(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading outlets config:', e);
    }
    hasLoadedOutletsRef.current = true;
  }, []);

  useEffect(() => {
    if (hasLoadedOutletsRef.current) {
      try {
        localStorage.setItem('hris_outlets_config', JSON.stringify(outletsConfigList));
      } catch (e) {
        console.error('Error saving outlets config:', e);
      }
    }
  }, [outletsConfigList]);

  const outlets = [
    { id: 'ALL', name: 'Semua Cabang (Multi-Outlet)', tutupBukuDate: 31, paydayDate: 1, cutOffLabel: 'Tutup Buku: Akhir Bulan (Tgl 31)' },
    { id: 'RESTO-SENOPATI-01', name: 'Cabang Senopati, Jaksel', tutupBukuDate: 31, paydayDate: 1, cutOffLabel: 'Tutup Buku: Tgl 31 • Gajian: Tgl 1' },
    { id: 'RESTO-PIK-02', name: 'Cabang PIK Pantjoran, Jakut', tutupBukuDate: 31, paydayDate: 1, cutOffLabel: 'Tutup Buku: Tgl 31 • Gajian: Tgl 1' },
    { id: 'RESTO-TEBING-03', name: 'Cabang Tebing Tinggi, Sumut', tutupBukuDate: 30, paydayDate: 1, cutOffLabel: 'Tutup Buku: Tgl 30 • Gajian: Tgl 1' },
  ];

  // Definisi Menu Sidebar & Sub-Tab Masing-Masing
  const menuConfig: Record<
    MainMenuId,
    {
      title: string;
      icon: React.ElementType;
      badge?: string;
      subTabs: { id: string; label: string; badge?: number }[];
    }
  > = {
    hub: {
      title: 'Dasbor',
      icon: LayoutGrid,
      subTabs: [
        { id: 'bento-cards', label: 'Ringkasan' },
      ],
    },
    employees: {
      title: 'Data Karyawan',
      icon: Users,
      subTabs: [
        { id: 'employee-list', label: 'Daftar Karyawan' },
        ...(canReviewBank ? [{ id: 'bank-changes', label: 'Perubahan Rekening', badge: bankChangeCount }] : []),
        { id: 'resignation-exit', label: 'Karyawan Keluar' },
      ],
    },
    attendance: {
      title: 'Presensi & Shift',
      icon: Clock,
      subTabs: [
        { id: 'daily-timesheet', label: 'Presensi Harian' },
        { id: 'work-schedule', label: 'Jadwal Kerja' },
        { id: 'attendance-review', label: 'Perlu ditinjau', badge: reviewCount },
        { id: 'attendance-corrections', label: 'Koreksi Absen' },
      ],
    },
    payroll: {
      title: 'Penggajian',
      icon: Wallet,
      subTabs: [
        { id: 'payroll-calc', label: 'Hitung Gaji' },
        { id: 'salary-structure', label: 'Aturan Gaji' },
      ],
    },
    performance: {
      title: 'Penilaian Kinerja',
      icon: TrendingUp,
      subTabs: [
        { id: 'kpi-matrix', label: 'KPI Kru' },
        { id: 'spv-inspections', label: 'Sidak SPV' },
      ],
    },
    development: {
      title: 'Pelatihan',
      icon: GraduationCap,
      subTabs: [
        { id: 'training-lms', label: 'Materi' },
        { id: 'weekly-quizzes', label: 'Kuis Mingguan' },
        { id: 'certification-tracker', label: 'Sertifikasi' },
        { id: 'training-schedules', label: 'Jadwal Pelatihan' },
        { id: 'survey-360', label: 'Evaluasi 360°' },
      ],
    },
    career: {
      title: 'Jenjang Karier',
      icon: Briefcase,
      subTabs: [
        { id: 'career-ladder', label: 'Jenjang Karier' },
      ],
    },
    coaching: {
      title: 'Pendampingan',
      icon: Sparkles,
      subTabs: [
        { id: 'coaching-list', label: 'Sesi Pendampingan' },
      ],
    },
    sops: {
      title: 'SOP',
      icon: FileCheck2,
      subTabs: [
        { id: 'ai-sop-generator', label: 'Template SOP' },
        { id: 'sop-library', label: 'Resep & Standar Menu' },
        { id: 'daily-store-reports', label: 'Laporan Harian Cabang' },
        { id: 'hygiene-rules', label: 'Higiene & Sanitasi' },
        { id: 'signatures', label: 'Tanda Tangan SOP' },
      ],
    },
    sanctions: {
      title: 'Kedisiplinan & SP',
      icon: ShieldAlert,
      subTabs: [
        { id: 'active-sp', label: 'Surat Peringatan' },
      ],
    },
    requests: {
      title: 'Persetujuan',
      icon: CalendarDays,
      subTabs: [
        { id: 'leave-requests', label: 'Pengajuan Kru' },
      ],
    },
    'kru-portal': {
      title: 'Aplikasi Kru',
      icon: Smartphone,
      subTabs: [
        { id: 'kru-app', label: 'Aplikasi HP' },
      ],
    },
    permissions: {
      title: 'Hak Akses',
      icon: ShieldCheck,
      subTabs: [
        { id: 'matrix-roles', label: 'Matriks Peran' },
        { id: 'user-assignment', label: 'Penugasan Peran' },
      ],
    },
    'legal-docs': {
      title: 'Surat & Kontrak',
      icon: FileText,
      subTabs: [
        { id: 'sk-list', label: 'Surat Keputusan' },
        { id: 'contract-list', label: 'Kontrak Kerja' },
        { id: 'edaran-list', label: 'Surat Edaran' },
        { id: 'generate-doc', label: 'Buat Surat' },
        { id: 'template-library', label: 'Klausul Baku' },
      ],
    },
    outlets: {
      title: 'Cabang',
      icon: Building2,
      subTabs: [
        { id: 'outlet-master', label: 'Daftar Cabang' },
      ],
    },
  };

  const handleMenuChange = (menuId: MainMenuId) => {
    setActiveMenu(menuId);
    setActiveSubTab(menuConfig[menuId].subTabs[0].id);
  };

  // Menu samping di halaman lain dan tautan notifikasi membuka /?menu=<id>[&tab=<sub-tab>]
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const menu = params.get('menu');
    if (menu && menu in menuConfig) {
      handleMenuChange(menu as MainMenuId);
      const tab = params.get('tab');
      if (tab && menuConfig[menu as MainMenuId].subTabs.some((t) => t.id === tab)) setActiveSubTab(tab);
      window.history.replaceState(null, '', '/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Master Data Dokumen SOP Resmi Barokah Grup (SOP-001 s/d SOP-008)
  const [sopList, setSopList] = useState([
    {
      id: 'SOP-HR-008',
      skNumber: '008/HR-ATT/2026/BAROKAH',
      title: 'SOP Prosedur Pengajuan & Verifikasi Koreksi Presensi (Kelupaan Clock-In / Clock-Out) Serta Batas Toleransi Kelalaian',
      category: 'SDM & OPERASIONAL RESTO (BAROKAH GRUP)',
      compliance: 100,
      signedCount: `${employeesMasterList.length}/${employeesMasterList.length} Staf`,
      updatedAt: '25 Oktober 2026',
      author: 'Direksi & Manajemen Barokah Grup',
      isOfficialDocument: true,
      summary: 'Mengatur mekanisme penyelamatan hak upah staf resto yang lupa melakukan absensi biometrik (lupa masuk, lupa pulang, atau lupa keduanya). Guardrails ketat: (1) Wajib diajukan maksimal H+1 (1x24 jam) dan sebelum tanggal cut-off payroll (tgl 5). (2) Wajib ada saksi kehadiran fisik dari Store Leader / rekan stasiun kerja atau rekaman CCTV resto. (3) Otoritas persetujuan 100% di Admin HR / Store Manager via Web Admin. (4) Batas toleransi wajar maksimal 2x sebulan bebas denda (gaji & uang makan utuh). Ke-3 kali dan seterusnya dalam bulan berjalan: kehadiran fisik diakui (gaji pokok cair), namun uang makan harian Rp 20.000 ditiadakan (hangus) sebagai sanksi kelalaian berulang.',
    },
    {
      id: 'SOP-HR-007',
      skNumber: '007/HR-LEAVE/2026/BAROKAH',
      title: 'SOP Cuti Tahunan Berjenjang Berdasarkan Masa Kerja & Ketentuan Upah Terhitung',
      category: 'SDM & PENGGAJIAN (BAROKAH GRUP)',
      compliance: 100,
      signedCount: `${employeesMasterList.length}/${employeesMasterList.length} Staf`,
      updatedAt: '22 Oktober 2026',
      author: 'Direksi & Manajemen Barokah Grup',
      isOfficialDocument: true,
      summary: 'Mengatur hak cuti tahunan berjenjang dengan upah terhitung (dibayar penuh) berdasarkan loyalitas masa kerja: 1 tahun dapat 1 hari, 2 tahun dapat 2 hari, dan bertambah 1 hari per tahun masa kerja berikutnya. Guardrails ketat: Dilarang digabung dengan libur reguler, dilarang diambil di weekend atau libur nasional, dan dilarang menyambung sebelum/sesudah libur Lebaran (Idul Fitri). Menjadi rujukan klausul PKWT.',
    },
    {
      id: 'SOP-HR-006',
      skNumber: '006/HR-LEAVE/2026/BAROKAH',
      title: 'SOP Hak Libur Operasional, Cuti Khusus, Izin Musibah & Ketentuan Upah Prorata',
      category: 'SDM & PENGGAJIAN (BAROKAH GRUP)',
      compliance: 100,
      signedCount: `${employeesMasterList.length}/${employeesMasterList.length} Staf`,
      updatedAt: '22 Oktober 2026',
      author: 'Direksi & Manajemen Barokah Grup',
      isOfficialDocument: true,
      summary: 'Pedoman baku hak libur resto: Libur reguler 2 hari/bln (tanpa libur nasional/tanggal merah). Cuti dibayar penuh: Menikah (3 hari), duka cita keluarga inti (3 hari pertama dari 7 hari), duka serumah (1 hari), istri melahirkan/keguguran (2 hari), kebakaran (3 hari), kebanjiran (2 hari). Sakit rawat inap RS: maks 3 hari gaji pokok (tanpa uang makan & lembur). Cuti unpaid (potong prorata Gaji Pokok/30 hari, tanpa uang makan & lembur): Urus nikah/cerai (2 hari), sisa duka inti (4 hari), melahirkan karyawati 30 hari (27 hari unpaid), keguguran 14 hari (11 hari unpaid), umroh 14 hari. Menjadi rujukan klausul PKWT & payroll.',
    },
    {
      id: 'SOP-HR-005',
      skNumber: '005/HR-PAY/2026/BAROKAH',
      title: 'SOP Ketentuan Gaji Pokok & Tunjangan Lama Bekerja Berdasarkan Masa Kerja',
      category: 'SDM & PENGGAJIAN (BAROKAH GRUP)',
      compliance: 100,
      signedCount: `${employeesMasterList.length}/${employeesMasterList.length} Staf`,
      updatedAt: '21 Oktober 2026',
      author: 'Direksi & Manajemen Barokah Grup',
      isOfficialDocument: true,
      summary: 'Mengatur skema gaji pokok berdasarkan masa kerja (< 3 bulan Rp 1jt, >= 3 bulan Rp 1.2jt untuk staf operasional) dan tunjangan lama bekerja dalam blok 6 bulanan: Bulan 1-6 Rp 0; Bulan 7-12 Rp 100.000; Bulan 13-18 Rp 200.000; Bulan 19-24 Rp 250.000; dan bertambah Rp 50.000 setiap kelipatan 6 bulan seterusnya. Hak tunjangan mulai dicairkan pada periode +1 bulan setelah masa kerja terpenuhi.',
    },
    {
      id: 'SOP-HR-004',
      skNumber: '004/HR-PAY/2026/BAROKAH',
      title: 'SOP Skema Penggajian Karyawan Baru (Onboarding Payroll 3 Bulan Pertama)',
      category: 'SDM & PENGGAJIAN (BAROKAH GRUP)',
      compliance: 100,
      signedCount: `${employeesMasterList.length}/${employeesMasterList.length} Staf`,
      updatedAt: '21 Oktober 2026',
      author: 'Direksi & Manajemen Barokah Grup',
      isOfficialDocument: true,
      summary: 'Mengatur skema cut-off tgl 6 s/d tgl 5 & payday tgl 10 (mengikuti SOP sebelumnya). Khusus staf baru: Bulan 1 menerima gaji penuh setelah genap 1 bulan bekerja (cth: masuk 10 Mei, gajian 10 Juni full); Bulan 2 penyesuaian prorata tgl 10 Juni s/d 5 Juli (cair tgl 10 Juli); Bulan 3 dan seterusnya full normal (siklus tgl 6 s/d tgl 5, cair tgl 10). Pasal 4.2: Karyawan baru belum genap 3 bulan bekerja dilarang kasbon.',
    },
    {
      id: 'SOP-HR-003',
      skNumber: '003/IV/2026/SOP-BAROKAH',
      title: 'SOP Jam Kerja, Jam Operasional, Kehadiran, Libur & Sanksi (01 April 2026)',
      category: 'OPERASIONAL & SDM (BAROKAH GRUP)',
      compliance: 100,
      signedCount: `${employeesMasterList.length}/${employeesMasterList.length} Staf`,
      updatedAt: '01 April 2026',
      author: 'Direksi & Manajemen Barokah Grup',
      isOfficialDocument: true,
      summary: 'Mengatur jam operasional & lembur resto, kuota harian (< 8 staf maks 1, >= 8 staf maks 2), denda off weekend Rp 200rb, denda off libur nasional Rp 250rb (dengan konfirmasi SK/edaran Peak Season), sakit rawat inap RS <= 3 hari upah pokok dapat (uang makan & lembur tidak dapat), pengajuan mendadak < H-3 weekday denda Rp 50rb, dan jatah off habis denda Rp 15k (staf) / Rp 25k (leader).',
    },
    {
      id: 'SOP-HR-001',
      skNumber: '001/V/2025/ADM-APS',
      title: 'Petunjuk Teknis Pengajuan Jatah Libur (Off) & Kompensasi Insentif',
      category: 'SDM & OPERASIONAL (AYAM PECAK 2001 SEAFOOD)',
      compliance: 96,
      signedCount: `${employeesMasterList.length}/${employeesMasterList.length} Staf`,
      updatedAt: '25 Mei 2025',
      author: 'Arif Gunawan Panggabean (Manajemen)',
      isOfficialDocument: true,
      summary: 'Dokumen historis unit Ayam Pecak 2001: Mengatur hak 2 hari off/bln, insentif tidak ambil off Rp 75.000/hari, dan kuota. Catatan: Ketentuan denda tanggal merah, denda off mendadak, dan kuota cabang telah diselaraskan mengikuti SOP-HR-003 & SOP-HR-006 tahun 2026.',
    },
    {
      id: 'SOP-HR-002',
      skNumber: '002/HR-FIN/2026/APS',
      title: 'Pedoman, Batas Plafon & Prosedur Pinjaman Kasbon Karyawan',
      category: 'SDM & KEUANGAN (BAROKAH GRUP)',
      compliance: 98,
      signedCount: `${employeesMasterList.length}/${employeesMasterList.length} Staf`,
      updatedAt: '18 Okt 2026',
      author: 'Arif Gunawan Panggabean (Manajemen HRD)',
      isOfficialDocument: true,
      summary: 'Pedoman kasbon darurat: Syarat masa kerja minimal 3 bulan (genap onboarding sesuai SOP-HR-004 Pasal 4.2), batas maksimal 50% gaji pokok, jendela pengajuan H+10 s.d. H-10 gajian, pencairan kas harian outlet maks Rp 500.000/hari bertahap, dan pelunasan saat resign.',
    },
    {
      id: 'SOP-KITCHEN-01',
      skNumber: '002/KITCHEN/2025',
      title: 'Standar Hygiene Dapur, Grooming & Cuci Tangan 6 Langkah',
      category: 'KITCHEN (BOH)',
      compliance: 94,
      signedCount: `${employeesMasterList.length}/${employeesMasterList.length} Staf`,
      updatedAt: '01 Okt 2026',
      author: 'Head Kitchen',
      isOfficialDocument: false,
      summary: 'Seragam bersih disetrika, celemek higienis, penutup kepala/hairnet wajib di area dapur, kuku rapi dan mencuci tangan setiap 30 menit.',
    },
    {
      id: 'SOP-KITCHEN-02',
      skNumber: '003/RECIPE/2025',
      title: 'Gramatur Baku Marinasi & Porsi Ayam Bakar Taliwang',
      category: 'KITCHEN (BOH)',
      compliance: 100,
      signedCount: '24/24 Cook',
      updatedAt: '28 Sep 2026',
      author: 'Executive Chef',
      isOfficialDocument: false,
      summary: 'Standar gramatur marinasi bumbu ayam bakar dan takaran porsi baku penyajian.',
    },
    {
      id: 'SOP-SERVICE-01',
      skNumber: '004/SERVICE/2025',
      title: 'Standar Table Service, Greeting & Penanganan Keluhan Tamu',
      category: 'SERVICE (FOH)',
      compliance: 88,
      signedCount: '35/40 Waiter',
      updatedAt: '15 Sep 2026',
      author: 'Floor Manager',
      isOfficialDocument: false,
      summary: 'Standar pelayanan meja, 3S (Senyum, Salam, Sapa), dan SOP penyajian minuman maks 5 menit, makanan maks 15 menit.',
    },
  ]);

  const [viewingOfficialSopDoc, setViewingOfficialSopDoc] = useState<boolean>(false);
  const [viewingOfficialSop2026Doc, setViewingOfficialSop2026Doc] = useState<boolean>(false);
  const [viewingOfficialSopOnboardingDoc, setViewingOfficialSopOnboardingDoc] = useState<boolean>(false);
  const [viewingOfficialSopTenureDoc, setViewingOfficialSopTenureDoc] = useState<boolean>(false);
  const [viewingOfficialSopAnnualLeaveDoc, setViewingOfficialSopAnnualLeaveDoc] = useState<boolean>(false);
  const [viewingOfficialSopUnpaidDoc, setViewingOfficialSopUnpaidDoc] = useState<boolean>(false);
  const [isAiSopModalOpen, setIsAiSopModalOpen] = useState<boolean>(false);
  const [viewingAiCustomSop, setViewingAiCustomSop] = useState<GeneratedSopDocument | null>(null);

  const handleSaveGeneratedSop = (newSop: GeneratedSopDocument) => {
    const newEntry = {
      id: newSop.id,
      skNumber: newSop.skNumber,
      title: newSop.title,
      category: newSop.category,
      compliance: 100,
      signedCount: `${employeesMasterList.length}/${employeesMasterList.length} Staf`,
      updatedAt: newSop.effectiveDate,
      author: newSop.author,
      isOfficialDocument: true,
      summary: newSop.summary,
      rawGeneratedDoc: newSop,
    };
    setSopList((prev: any) => [newEntry, ...prev]);
    showToast(`Berhasil! "${newSop.title}" telah didaftarkan ke Pustaka Master SOP Barokah Grup.`);
  };


  // =========================================================
  // MODUL DATA KARYAWAN RESTO (MASTER SDM)
  // Perhitungan Otomatis: Usia & Lama Bekerja
  // Pembayaran: Bank & E-Wallet (GoPay, OVO, DANA, ShopeePay, LinkAja)
  // =========================================================

  // Master Data Karyawan (EmployeeMaster & State) telah didefinisikan di level teratas komponen.

  // =========================================================
  // SISTEM RAPOR KARYAWAN BERKALA (PERFORMANCE SCORECARD)
  // =========================================================
  interface EmployeeReportCard {
    employeeId: string;
    employeeName: string;
    positionTitle: string;
    outlet: string;
    period: string;
    evaluatorName: string;
    evaluationDate: string;
    docNumber: string;

    // 1. Kedisiplinan & Presensi (Bobot 20%)
    attendanceScore: number;
    attendanceNotes: string;
    attendanceDetails: {
      presenceRate: string;
      lateMinutes: number;
      alphaDays: number;
      breakCompliance: string;
    };

    // 2. Kepatuhan SOP & Kebersihan (Bobot 20%)
    sopScore: number;
    sopNotes: string;
    sopDetails: {
      grooming: string;
      haccpSanitation: string;
      foodWasteEfficiency: string;
    };

    // 3. Pelayanan & Hospitality (Bobot 15%)
    hospitalityScore: number;
    hospitalityNotes: string;
    hospitalityDetails: {
      guestRating: string;
      discProfile: string;
      teamCooperation: string;
    };

    // 4. Inisiatif & Kecepatan Output (Bobot 15%)
    competencyScore: number;
    competencyNotes: string;
    competencyDetails: {
      speedOfService: string;
      upsellTarget: string;
      recipeConsistency: string;
    };

    // 5. Knowledge, Training & Hasil Kuis LMS (Bobot 15%)
    knowledgeScore: number;
    knowledgeNotes: string;
    knowledgeDetails: {
      trainingCompletionRate: string;
      quizAverageScore: number;
      completedModulesCount: number;
      totalAssignedModules: number;
      latestQuizPassed: string;
    };

    // 6. Rekam Jejak Disiplin (Bobot 15%)
    disciplineScore: number;
    disciplineNotes: string;
    disciplineDetails: {
      spCount: number;
      penaltyCount: number;
      awardsCount: number;
    };

    // Nilai Akhir & Rekomendasi
    totalScore: number;
    grade: 'A' | 'B+' | 'B' | 'C' | 'D';
    gradeLabel: string;
    recommendation: 'PROMOSI_LEADER' | 'PERPANJANG_PKWT' | 'PEMBINAAN_RETRAINING' | 'TIDAK_DIPERPANJANG';
    recommendationLabel: string;
    evaluatorFeedback: string;
    developmentPlan: string;
  }

  const initialEmployeesReportCards: Record<string, EmployeeReportCard> = {};

  const [employeesReportCards, setEmployeesReportCards] = useState<Record<string, EmployeeReportCard>>(initialEmployeesReportCards);
  const [selectedReportCardEmp, setSelectedReportCardEmp] = useState<EmployeeMaster | null>(null);
  const [isEditReportCardModalOpen, setIsEditReportCardModalOpen] = useState<boolean>(false);
  const [editingReportCardData, setEditingReportCardData] = useState<EmployeeReportCard | null>(null);

  const calculateReportCardFinal = (
    att: number,
    sop: number,
    hosp: number,
    comp: number,
    disc: number,
    know: number = 90
  ): { totalScore: number; grade: 'A' | 'B+' | 'B' | 'C' | 'D'; gradeLabel: string } => {
    // 6 Pilar Terpadu Rapor (Total Bobot 100%):
    // 1. Presensi (20%) + 2. SOP (20%) + 3. Hospitality (15%) + 4. Output (15%) + 5. Knowledge (15%) + 6. Disiplin (15%) = 100%
    const total = Math.round((att * 0.20 + sop * 0.20 + hosp * 0.15 + comp * 0.15 + know * 0.15 + disc * 0.15) * 10) / 10;
    let grade: 'A' | 'B+' | 'B' | 'C' | 'D' = 'B';
    let gradeLabel = 'Baik (Good)';

    if (total >= 92) {
      grade = 'A';
      gradeLabel = 'Sangat Memuaskan (Exemplary)';
    } else if (total >= 85) {
      grade = 'B+';
      gradeLabel = 'Memuaskan (Superior)';
    } else if (total >= 75) {
      grade = 'B';
      gradeLabel = 'Baik (Competent)';
    } else if (total >= 65) {
      grade = 'C';
      gradeLabel = 'Cukup / Perlu Pembinaan';
    } else {
      grade = 'D';
      gradeLabel = 'Kurang / Di Bawah Standar';
    }

    return { totalScore: total, grade, gradeLabel };
  };

  const getEmployeeReportCard = (emp: EmployeeMaster): EmployeeReportCard => {
    if (employeesReportCards[emp.id]) {
      return employeesReportCards[emp.id];
    }
    const tenureData = calculateTenure(emp.joinDate);
    const isSenior = tenureData.category === 'SENIOR_6_MONTHS';
    const score = isSenior ? 91.5 : 85.0;
    const grade = isSenior ? 'A' : 'B+';
    const gradeLabel = isSenior ? 'Sangat Memuaskan (Exemplary)' : 'Memuaskan (Superior)';

    return {
      employeeId: emp.id,
      employeeName: emp.fullName,
      positionTitle: emp.positionTitle,
      outlet: emp.outlet,
      period: 'Semester II / 2026 (Juli - Des 2026)',
      evaluatorName: 'Store Manager & Bima Satria (HRD)',
      evaluationDate: '18 Oktober 2026',
      docNumber: `RAPOR/BKN/2026/X/${emp.id.replace('EMP-', '')}`,
      attendanceScore: isSenior ? 94 : 88,
      attendanceNotes: 'Catatan presensi terpantau tertib dan disiplin.',
      attendanceDetails: {
        presenceRate: '96.5%',
        lateMinutes: 20,
        alphaDays: 0,
        breakCompliance: '97% Patuh',
      },
      sopScore: isSenior ? 92 : 86,
      sopNotes: 'Menjalankan SOP kebersihan dan operasional sesuai panduan standar.',
      sopDetails: {
        grooming: 'Standar Seragam Bersih & Rapi',
        haccpSanitation: 'Kepatuhan 92%',
        foodWasteEfficiency: 'Efisien Sesuai Standar',
      },
      hospitalityScore: isSenior ? 90 : 85,
      hospitalityNotes: 'Komunikasi antar rekan kerja terjalin dengan baik.',
      hospitalityDetails: {
        guestRating: '4.7 / 5.0',
        discProfile: 'Steadiness & Conscientiousness',
        teamCooperation: 'Komunikatif & Sigap',
      },
      competencyScore: isSenior ? 90 : 84,
      competencyNotes: 'Menyelesaikan beban kerja harian secara konsisten.',
      competencyDetails: {
        speedOfService: 'Sesuai Standar Waktu Outlet',
        upsellTarget: '90% Capaian Target',
        recipeConsistency: '100% Standar Resep',
      },
      knowledgeScore: isSenior ? 94 : 88,
      knowledgeNotes: 'Tuntas menyelesaikan seluruh kurikulum modul pelatihan wajib LMS dan lulus kuis evaluasi berkala.',
      knowledgeDetails: {
        trainingCompletionRate: isSenior ? '100% (5/5 Modul Selesai)' : '80% (4/5 Modul Selesai)',
        quizAverageScore: isSenior ? 92.0 : 86.0,
        completedModulesCount: isSenior ? 5 : 4,
        totalAssignedModules: 5,
        latestQuizPassed: 'LMS-GEN-01: Standar Sanitasi & Etika Kerja (Skor 92)',
      },
      disciplineScore: 100,
      disciplineNotes: 'Zero surat peringatan disiplin.',
      disciplineDetails: {
        spCount: 0,
        penaltyCount: 0,
        awardsCount: 0,
      },
      totalScore: score,
      grade: grade as any,
      gradeLabel: gradeLabel,
      recommendation: 'PERPANJANG_PKWT',
      recommendationLabel: 'Direkomendasikan Perpanjang PKWT Periode Berikutnya',
      evaluatorFeedback: `Karyawan ${emp.fullName} menunjukkan komitmen yang konsisten pada posisinya di ${emp.outlet}. Pertahankan kinerja positif ini.`,
      developmentPlan: 'Pelatihan sertifikasi kompetensi keahlian stasiun lanjutan.',
    };
  };
  const [employeeListKey, setEmployeeListKey] = useState(0);

  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState<boolean>(false);



  // =========================================================
  // STATE PENERAPAN SOP-HR-001 (001/V/2025/ADM-APS)
  // 1. Approval Table Pengajuan Libur & Validasi SOP
  // 2. Kalender Roster Cerdas (Smart Scheduling & Quota Lock)
  // 3. WhatsApp Broadcast Bot Simulator
  // =========================================================


  // Pengajuan cuti/izin/kasbon kru: sumbernya backend, bukan penyimpanan browser
  const adminRequests = useAdminRequests();


  // Modal State: Koreksi Presensi Admin
  const [viewingOfficialSop008Doc, setViewingOfficialSop008Doc] = useState(false);


  const fallbackKruStaff: KruDirectoryStaffItem = {
    id: '-',
    name: 'Belum Ada Kru Terdaftar',
    nik: '-',
    role: 'Staf Restoran',
    department: 'Operasional',
    outlet: 'Semua Cabang',
    shift: 'Belum Ada Shift',
    breakSlot: '-',
    breakStatus: 'Standby',
    clockInTime: '-',
    clockInStatus: 'BELUM_ABSEN',
    positionKey: 'waiters',
    tenureStatus: 'UNDER_3_MONTHS',
    isMarried: false,
    kasbonLimit: 0,
    avatar: 'HR',
    phone: '-',
    device: '-',
    joinDate: '2026-01-01',
  };
  const currentKruStaff = kruStaffDirectory.find((s) => s.id === kruActiveStaffId) || kruStaffDirectory[0] || fallbackKruStaff;

  // Otomatis Pengecekan Waktu Sholat Berdasarkan Lokasi Outlet
  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}_${currentH}:${currentM}`;

      const { schedule, cityLabel } = getPrayerTimesByOutlet(currentKruStaff.outlet);

      const prayerConfigs: { key: PrayerKey; label: string; time: string; hasPreAlarm: boolean }[] = [
        { key: 'shubuh', label: 'Shubuh', time: schedule.shubuh, hasPreAlarm: false },
        { key: 'dzuhur', label: 'Dzuhur', time: schedule.dzuhur, hasPreAlarm: true },
        { key: 'ashar', label: 'Ashar', time: schedule.ashar, hasPreAlarm: true },
        { key: 'maghrib', label: 'Maghrib', time: schedule.maghrib, hasPreAlarm: true },
        { key: 'isya', label: 'Isya', time: schedule.isya, hasPreAlarm: false },
      ];

      for (const p of prayerConfigs) {
        const [pH, pM] = p.time.split(':').map(Number);
        const diffMinutes = (pH * 60 + pM) - (currentH * 60 + currentM);

        // KONDISI 1: 10 Menit Sebelum Sholat Masuk (Khusus Dzuhur, Ashar, Maghrib)
        if (diffMinutes === 10 && p.hasPreAlarm) {
          const triggerKey = `${dateKey}_${p.key}_PRE_10`;
          if (lastTriggeredPrayerRef.current !== triggerKey) {
            lastTriggeredPrayerRef.current = triggerKey;
            setPrayerAlarmState({
              active: true,
              type: 'PRE_10_MIN',
              prayerKey: p.key,
              prayerLabel: p.label,
              prayerTime: `${p.time} ${schedule.timezone}`,
              outletName: currentKruStaff.outlet,
              cityLabel,
              soundMuted: prayerSoundMuted,
            });
            if (!prayerSoundMuted) playPrayerChime('PRE_10_MIN');
          }
          break;
        }

        // KONDISI 2: Tepat Masuk Waktu Sholat (0 Menit) -> Kumandang Azan
        // Dzuhur, Ashar, Maghrib + Azan; Isya & Shubuh Azan Saja
        if (diffMinutes === 0) {
          const triggerKey = `${dateKey}_${p.key}_ADHAN`;
          if (lastTriggeredPrayerRef.current !== triggerKey) {
            lastTriggeredPrayerRef.current = triggerKey;
            setPrayerAlarmState({
              active: true,
              type: 'ADHAN',
              prayerKey: p.key,
              prayerLabel: p.label,
              prayerTime: `${p.time} ${schedule.timezone}`,
              outletName: currentKruStaff.outlet,
              cityLabel,
              soundMuted: prayerSoundMuted,
            });
            if (!prayerSoundMuted) playPrayerChime('ADHAN');
          }
          break;
        }
      }
    };

    checkSchedule();
    const intv = setInterval(checkSchedule, 20000);
    return () => clearInterval(intv);
  }, [currentKruStaff.outlet, prayerSoundMuted]);

  // Peran tampilan mengikuti akun yang login; hak akses sebenarnya tetap dicek backend
  const sessionRole = getSessionUser()?.role;
  const requestsAwaitingMe = adminRequests.requests.filter((r) => actionFor(r, sessionRole)).length;

  const btnPrimary = 'btn btn-primary';
  const btnSecondary = 'btn btn-secondary';

  const moduleActions =
    activeMenu === 'employees' ? (
      <button type="button" onClick={() => setIsAddEmployeeModalOpen(true)} className={btnPrimary}>
        <UserPlus className="h-4 w-4" aria-hidden /> Tambah Karyawan
      </button>
    ) : activeMenu === 'performance' ? (
      <button type="button" onClick={() => setActiveSubTab('spv-inspections')} className={btnSecondary}>
        <Calendar className="h-4 w-4" aria-hidden /> Jadwal Sidak
      </button>
    ) : activeMenu === 'requests' ? (
      <button type="button" onClick={() => setViewingOfficialSopDoc(true)} className={btnSecondary}>
        <FileText className="h-4 w-4" aria-hidden /> Naskah SK Libur
      </button>
    ) : activeMenu === 'sops' ? (
      <button type="button" onClick={() => setIsAiSopModalOpen(true)} className={btnPrimary}>
        <Plus className="h-4 w-4" aria-hidden /> Buat dari Template
      </button>
    ) : null;

  return (
    <AppShell
      activeId={activeMenu}
      onSelect={(id) => handleMenuChange(id as MainMenuId)}
      title={menuConfig[activeMenu].title}
      counts={{ requests: requestsAwaitingMe }}
    >
      {/* Notifikasi singkat; satu-satunya elemen melayang, jadi satu-satunya yang berbayang */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-50 max-w-sm">
        {toastMessage && (
          <div className="flex items-start gap-2 rounded-lg bg-ink-800 px-4 py-3 text-sm text-white shadow-lg">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>


        {activeMenu !== 'hub' && (
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6">
            {moduleActions && <div className="flex flex-wrap items-center justify-end gap-2 pt-3">{moduleActions}</div>}
            <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label={`Bagian ${menuConfig[activeMenu].title}`}>
              {menuConfig[activeMenu].subTabs.map((sub) => {
                const isSubActive = activeSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setActiveSubTab(sub.id)}
                    aria-current={isSubActive ? 'page' : undefined}
                    className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${
                      isSubActive
                        ? 'border-brand-500 font-medium text-slate-900'
                        : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {sub.label}
                    {sub.badge ? (
                      <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 text-xs font-medium tabular-nums text-slate-900">
                        <span className="sr-only">, </span>{sub.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ========================================================= */}
          {/* TAB 0: EXECUTIVE BENTO CARD HUB (CARD-BASED NAVIGATION)   */}
          {/* ========================================================= */}
          {activeMenu === 'hub' && (
            <DashboardHome
              requests={adminRequests}
              onOpen={(menu, subTab) => {
                handleMenuChange(menu as MainMenuId);
                if (subTab) setActiveSubTab(subTab);
              }}
            />
          )}

          {/* ========================================================= */}
          {/* BERLIAN MODULE 1: ORGANIZATION                           */}
          {/* ========================================================= */}

          {/* ========================================================= */}
          {/* BERLIAN MODULE 2: PERFORMANCE & SPV MONITORING            */}
          {/* ========================================================= */}
          {activeMenu === 'performance' && (
            <div className="space-y-6">
              {activeSubTab === 'spv-inspections' ? (
                <InspectionsModule showToast={showToast} />
              ) : (
                <KpiModule />
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* BERLIAN MODULE 3: CAREER                                 */}
          {/* ========================================================= */}
          {activeMenu === 'career' && <CareerPathView showToast={showToast} />}

          {/* ========================================================= */}
          {/* BERLIAN MODULE 4: PENDAMPINGAN (SHARING EXCELLENT COACH) */}
          {/* ========================================================= */}
          {activeMenu === 'coaching' && <CoachingModule />}

          {/* ========================================================= */}
          {/* TAB 1: KEHADIRAN & FLOOR OPS                             */}
          {/* ========================================================= */}
          {activeMenu === 'attendance' && (
            <div className="space-y-5">
              {activeSubTab === 'work-schedule' ? (
                <WorkScheduleModule />
              ) : activeSubTab === 'attendance-review' ? (
                <AttendanceReviewModule onChanged={refreshReviewCount} />
              ) : activeSubTab === 'attendance-corrections' ? (
                <CorrectionsModule showToast={showToast} />
              ) : (
                <DailyAttendanceModule requests={adminRequests.requests} />
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* MENU KHUSUS: APLIKASI KRU RESTO (PORTAL MOBILE DI WEB)     */}
          {/* ========================================================= */}
          {activeMenu === 'kru-portal' && <CrewAppPreview />}

          {/* ========================================================= */}
          {/* TAB 2: PAYROLL & KASBON                                   */}
          {/* ========================================================= */}
          {activeMenu === 'payroll' && (
            <div className="space-y-5">
              {/* =================================================== */}
              {/* SUB-TAB 1: STRUKTUR GAJI MASTER 2026 (EDITABLE)     */}
              {/* =================================================== */}
              {activeSubTab === 'salary-structure' && <PayrollSettingsModule />}

              {/* =================================================== */}
              {/* SUB-TAB 2: KALKULASI GAJI KARYAWAN CABANG           */}
              {/* =================================================== */}
              {activeSubTab === 'payroll-calc' && <PayrollModule />}



            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: STANDAR SOP RESTO                                  */}
          {/* ========================================================= */}
          {activeMenu === 'sops' && (
            <div className="space-y-5">
              {activeSubTab === 'ai-sop-generator' ? (
                <AiSopStudio
                  onSaveSop={handleSaveGeneratedSop}
                  showToast={showToast}
                  employeesCount={employeesMasterList.length}
                />
              ) : activeSubTab === 'daily-store-reports' ? (
                <DailyReportsModule />
              ) : (
                <div className="space-y-5">
                  {/* Official SOP Banner */}
                  <section className="card space-y-4 p-4" aria-labelledby="sop-library-heading">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <h2 id="sop-library-heading" className="text-base font-semibold text-slate-900">
                          Pustaka SOP
                        </h2>
                        <p className="max-w-2xl text-sm text-slate-600">
                          Pedoman resmi Barokah Grup &amp; Ayam Pecak 2001 Seafood untuk seluruh staf FOH dan BOH. Aturan di sini dipakai
                          untuk validasi presensi, pengajuan cuti/libur, dan komponen denda pada payroll.
                        </p>
                      </div>
                      <button type="button" onClick={() => setActiveSubTab('ai-sop-generator')} className="btn btn-secondary shrink-0">
                        Buka Template SOP
                      </button>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium text-slate-600">Naskah SOP resmi</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setViewingOfficialSop008Doc(true)} className="btn btn-sm btn-secondary">
                          SOP Lupa Absen (008)
                        </button>
                        <button type="button" onClick={() => setViewingOfficialSopAnnualLeaveDoc(true)} className="btn btn-sm btn-secondary">
                          SOP Cuti Tahunan (007)
                        </button>
                        <button type="button" onClick={() => setViewingOfficialSopUnpaidDoc(true)} className="btn btn-sm btn-secondary">
                          SOP Cuti &amp; Sakit (006)
                        </button>
                        <button type="button" onClick={() => setViewingOfficialSopTenureDoc(true)} className="btn btn-sm btn-secondary">
                          SOP Tunjangan Lama Bekerja
                        </button>
                        <button type="button" onClick={() => setViewingOfficialSopOnboardingDoc(true)} className="btn btn-sm btn-secondary">
                          SOP Gaji Kru Baru (Onboarding)
                        </button>
                        <button type="button" onClick={() => setViewingOfficialSop2026Doc(true)} className="btn btn-sm btn-secondary">
                          SOP Jam Kerja 2026
                        </button>
                        <button type="button" onClick={() => setViewingOfficialSopDoc(true)} className="btn btn-sm btn-secondary">
                          Juknis Libur No. 001/V/2025
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Grid SOP Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sopList.map((sop: any) => {
                      const isOfficialAttendanceCorrection = sop.id === 'SOP-HR-008';
                      const isOfficialAnnualLeave = sop.id === 'SOP-HR-007';
                      const isOfficialUnpaid = sop.id === 'SOP-HR-006';
                      const isOfficialTenure = sop.id === 'SOP-HR-005';
                      const isOfficialOnboarding = sop.id === 'SOP-HR-004';
                      const isOfficial2026 = sop.id === 'SOP-HR-003';
                      const isOfficial2025 = sop.id === 'SOP-HR-001';
                      const isAiGenerated = !!sop.rawGeneratedDoc;
                      const isOfficial = isOfficialAttendanceCorrection || isOfficialAnnualLeave || isOfficialUnpaid || isOfficialTenure || isOfficialOnboarding || isOfficial2026 || isOfficial2025 || isAiGenerated;
                      return (
                        <div
                          key={sop.id}
                          className={`rounded-lg border bg-white p-4 space-y-3 ${
                            isOfficial ? 'border-slate-300' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className={`badge ${isOfficial ? 'badge-success' : 'badge-neutral'}`}>
                              {isAiGenerated ? 'Dari template' : sop.category.split('(')[0]}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-500">{sop.id}</span>
                          </div>

                          <div>
                            {sop.skNumber && (
                              <span className="text-xs font-mono text-amber-700 font-bold block mb-0.5">
                                SK: {sop.skNumber}
                              </span>
                            )}
                            <h4 className="font-semibold text-xs text-slate-900 leading-snug">
                              {sop.title}
                            </h4>
                          </div>

                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {sop.summary}
                          </p>

                          <div className="space-y-1 pt-1 border-t border-slate-100">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Tanda Tangan Staf:</span>
                              <span className="font-bold text-emerald-700">{sop.signedCount} ({sop.compliance}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-2 rounded-full ${isAiGenerated ? 'bg-ink-800' : isOfficialAnnualLeave ? 'bg-ink-800' : isOfficialUnpaid ? 'bg-sky-500' : isOfficial ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${sop.compliance}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-2 text-xs text-slate-500 border-t border-slate-100">
                            <span>Disahkan: {sop.updatedAt}</span>
                            <button
                              onClick={() => {
                                if (isAiGenerated && sop.rawGeneratedDoc) {
                                  setViewingAiCustomSop(sop.rawGeneratedDoc);
                                } else if (isOfficialAttendanceCorrection) {
                                  setViewingOfficialSop008Doc(true);
                                } else if (isOfficialAnnualLeave) {
                                  setViewingOfficialSopAnnualLeaveDoc(true);
                                } else if (isOfficialUnpaid) {
                                  setViewingOfficialSopUnpaidDoc(true);
                                } else if (isOfficialTenure) {
                                  setViewingOfficialSopTenureDoc(true);
                                } else if (isOfficialOnboarding) {
                                  setViewingOfficialSopOnboardingDoc(true);
                                } else if (isOfficial2026) {
                                  setViewingOfficialSop2026Doc(true);
                                } else if (isOfficial2025) {
                                  setViewingOfficialSopDoc(true);
                                } else {
                                  setReviewModalData({
                                    title: `SOP: ${sop.title}`,
                                    category: sop.category,
                                    data: {
                                      'Kode Dokumen': sop.id,
                                      'Nomor SK': sop.skNumber || '-',
                                      'Judul SOP': sop.title,
                                      'Divisi Terkait': sop.category,
                                      'Pejabat Pengesah': sop.author || 'Manajemen',
                                      'Persentase Dibaca': `${sop.compliance}%`,
                                      'Jumlah Staf TTD': sop.signedCount,
                                      'Ringkasan Regulasi': sop.summary || '-',
                                      'Terakhir Diperbarui': sop.updatedAt,
                                    },
                                  });
                                }
                              }}
                              className={`font-semibold text-xs flex items-center space-x-1 ${
                                isAiGenerated
                                  ? 'text-slate-700 hover:text-slate-900 bg-slate-50 px-2 py-1 rounded-lg'
                                  : isOfficial
                                  ? 'text-amber-700 hover:text-amber-900 bg-amber-100 px-2 py-1 rounded-lg'
                                  : 'text-sky-600 hover:text-sky-800'
                              }`}
                            >
                              <span>{isOfficial ? 'Buka Naskah SOP' : 'Lihat Dokumen'}</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: SANKSI, SURAT PERINGATAN (SP) & BERITA ACARA (BAP) */}
          {/* ========================================================= */}
          {activeMenu === 'sanctions' && <SanctionsModule showToast={showToast} />}

          {/* ========================================================= */}
          {/* TAB 5: MATERI TRAINING & LMS KNOWLEDGE BASE               */}
          {/* ========================================================= */}
          {activeMenu === 'development' &&
            (activeSubTab === 'survey-360' ? (
              <Survey360Module />
            ) : (
              <TrainingModule
                tab={(['training-lms', 'weekly-quizzes', 'certification-tracker', 'training-schedules'] as const).find((t) => t === activeSubTab) ?? 'training-lms'}
              />
            ))}

          {activeMenu === 'permissions' && (
            <AccessRightsModule tab={activeSubTab === 'user-assignment' ? 'user-assignment' : 'matrix-roles'} />
          )}

          {/* ========================================================= */}
          {/* TAB: CUTI, ROSTER & APPROVAL SOP (SK 001/V/2025/ADM-APS) */}
          {/* ========================================================= */}
          {activeMenu === 'requests' && (
            <div className="space-y-5">
              {/* =================================================== */}
              {/* SUB-TAB 1: APPROVAL PENGAJUAN LIBUR (SOP 001)       */}
              {/* =================================================== */}
              {activeSubTab === 'leave-requests' && (
                <RequestsApprovalModule
                    key="requests-all"
                  store={adminRequests}
                  title="Semua Pengajuan Kru"
                  description="Cuti, izin, sakit, lembur, tukar shift dan kasbon dari aplikasi HP kru. Kepala Cabang menyetujui lebih dulu, lalu HR atau Finance memberi keputusan akhir."
                />
              )}





            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: DATA KARYAWAN RESTO (MASTER SDM BAROKAH GRUP)        */}
          {/* ========================================================= */}
          {activeMenu === 'employees' && (
            activeSubTab === 'bank-changes' && canReviewBank ? (
              <BankChangesModule
                showToast={showToast}
                onChanged={() => {
                  refreshBankChangeCount();
                  setEmployeeListKey((k) => k + 1);
                }}
              />
            ) : activeSubTab === 'resignation-exit' ? (
              <ExitsModule
                showToast={showToast}
                onChanged={() => {
                  setEmployeeListKey((k) => k + 1);
                  reloadEmployees();
                }}
              />
            ) : (
              <EmployeeListModule
                reloadKey={employeeListKey}
                onChanged={reloadEmployees}
                showToast={showToast}
                onOpenReport={(nik) => {
                  const emp = employeesMasterList.find((e) => e.nikKtp === nik);
                  if (emp) setSelectedReportCardEmp(emp);
                }}
              />
            )
          )}

          {activeMenu === 'legal-docs' && (
            <LegalDocsModule
              tab={(['sk-list', 'contract-list', 'edaran-list', 'generate-doc', 'template-library'] as const).find((t) => t === activeSubTab) ?? 'sk-list'}
              onNavigate={setActiveSubTab}
            />
          )}

          {/* ========================================================= */}
          {/* TAB: PENGELOLAAN DATA OUTLET & SIKLUS PAYROLL/KASBON      */}
          {/* ========================================================= */}
          {activeMenu === 'outlets' && activeSubTab === 'outlet-master' && <OutletMasterModule />}

        </main>

      {/* ========================================================= */}
      {/* 3. MODAL REVIEW / DETAIL                                  */}
      {/* ========================================================= */}
      {reviewModalData && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{reviewModalData.title}</h3>
                  <p className="text-xs text-slate-500 font-medium">{reviewModalData.category}</p>
                </div>
              </div>
              <button
                onClick={() => setReviewModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 text-xs">
              {Object.entries(reviewModalData.data).map(([key, val]) => (
                <div key={key} className="flex justify-between py-1 border-b border-slate-200/50 last:border-b-0">
                  <span className="font-medium text-slate-600 text-xs">{key}</span>
                  <span className="font-bold text-slate-800 text-right">{String(val)}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setReviewModalData(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
              >
                Tutup Review
              </button>
            </div>
          </div>
        </div>
      )}





      {/* ========================================================= */}
      {/* MODAL 8: DOKUMEN RESMI SOP 001/V/2025 (BAROKAH GRUP)      */}
      {/* ========================================================= */}
      {viewingOfficialSopDoc && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6 sm:p-8 shadow-xl space-y-6 max-h-[92vh] overflow-y-auto border border-slate-200 font-sans text-slate-900">
            {/* Header / Kop Surat Resmi Barokah Grup */}
            <div className="relative mb-3">
              <button
                onClick={() => setViewingOfficialSopDoc(false)}
                className="absolute right-2 top-2 p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl z-10 transition bg-white/80 shadow-xs"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="rounded-xl overflow-hidden shadow-xs border border-amber-200/60 bg-white">
                <img
                  src="/kop-surat-barokah.jpg"
                  alt="Kop Surat Resmi Barokah Grup"
                  className="w-full h-auto object-contain block"
                />
              </div>
            </div>

            {/* Document Metadata Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <p className="font-bold text-slate-900">
                  No : <span className="font-mono text-amber-700">001/V/2025/ADM-APS</span>
                </p>
                <p className="font-bold text-slate-900 mt-0.5">
                  Perihal : <span className="text-slate-800">Petunjuk Teknis Pengajuan Jatah Libur Karyawan</span>
                </p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full font-bold text-xs uppercase shrink-0">
                STATUS: SOP RESMI AKTIF &amp; MENGIKAT
              </span>
            </div>

            {/* Adendum Harmonisasi Regulasi 2026 */}
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-300 text-xs space-y-1">
              <span className="font-semibold text-amber-900 text-xs flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Catatan Adendum Harmonisasi Barokah Group (2026):
              </span>
              <p className="text-xs text-amber-950 leading-relaxed">
                Sesuai penetapan Manajemen Barokah Group 2026: (1) Sanksi libur di Hari Libur Nasional diselaraskan menjadi <b>Denda Rp 250.000,-</b> (wajib ada konfirmasi Surat Keterangan / Pengumuman Peak Season Perusahaan); (2) Pengajuan mendadak (&lt; H-3) pada weekday dikenakan <b>Denda Rp 50.000,-</b>; (3) Kuota harian cabang diatur baku berdasarkan jumlah staf cabang: <b>&lt; 8 staf maks 1 orang</b>, dan <b>&ge; 8 staf maks 2 orang</b>; (4) Jika jatah libur habis, berlaku ketentuan pemotongan prorata (Gaji Pokok / 30) serta denda Rp 15.000/hari (staf) atau Rp 25.000/hari (leader) sesuai SOP-HR-003 &amp; SOP-HR-006.
              </p>
            </div>

            {/* Body of SOP (6 Articles) */}
            <div className="space-y-5 text-xs text-slate-800 leading-relaxed">
              {/* 1. TUJUAN */}
              <section className="space-y-1.5">
                <h4 className="font-semibold text-slate-950 text-sm uppercase">1. TUJUAN</h4>
                <p className="text-slate-700 pl-4 border-l-2 border-amber-500">
                  Petunjuk teknis ini bertujuan untuk mengatur hak dan kewajiban karyawan dalam pengambilan hari libur (off) secara tertib, adil, dan terstruktur guna menjaga kualitas kerja dan kesehatan mental karyawan, serta memastikan kelancaran operasional restoran.
                </p>
              </section>

              {/* 2. KETENTUAN UMUM */}
              <section className="space-y-2">
                <h4 className="font-semibold text-slate-950 text-sm uppercase">2. KETENTUAN UMUM</h4>
                <div className="space-y-2 pl-4">
                  <div>
                    <h5 className="font-semibold text-slate-900">2.1 Hak Jatah Off</h5>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      <li>Setiap karyawan memiliki hak <b>2 (dua) hari off setiap bulan</b>.</li>
                      <li>Jatah off dihitung dari tanggal 1 hingga akhir bulan.</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-900">2.2 Tenggat Waktu Penggunaan Off</h5>
                    <p className="text-slate-700">
                      Jatah off yang tidak diambil selama 2 bulan berturut-turut, maka pada <b>bulan ke-3 karyawan wajib mengambil off</b>, demi mencegah kelelahan kerja dan menurunkan stres.
                    </p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                    <h5 className="font-semibold text-emerald-950">2.3 Insentif Tidak Mengambil Off</h5>
                    <p className="text-emerald-900">
                      Bila jatah off tidak digunakan dalam 1 bulan, maka karyawan mendapat insentif sebesar <b>Rp75.000 per hari</b> yang tidak diambil (<b>maks. Rp150.000 per bulan</b>).
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. ATURAN PENGAMBILAN OFF */}
              <section className="space-y-2">
                <h4 className="font-semibold text-slate-950 text-sm uppercase">3. ATURAN PENGAMBILAN OFF</h4>
                <div className="space-y-2.5 pl-4">
                  <div>
                    <h5 className="font-semibold text-slate-900">3.1 Pengambilan Off Normal</h5>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      <li>Pengambilan off <b>hanya diperbolehkan pada weekday (Senin–Jumat)</b> dan bukan hari libur nasional.</li>
                      <li className="text-rose-700 font-semibold">
                        Jika off diambil pada weekend atau tanggal merah, tetap memotong jatah dan <b>dikenakan sanksi Rp200.000 per hari</b>.
                      </li>
                    </ul>
                  </div>
                  <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200">
                    <h5 className="font-semibold text-rose-950">3.2 Off Lebih dari 2 Hari dalam Sebulan</h5>
                    <p className="text-rose-900">
                      Jika karyawan mengambil off lebih dari 2 hari dalam satu bulan, maka akan dikenakan <b>sanksi Rp75.000 per hari tambahan</b> (berlaku kelipatan).
                    </p>
                    <p className="text-xs text-rose-800 italic mt-0.5">
                      Contoh: ambil 3 hari = kena denda Rp75.000; ambil 4 hari = kena denda Rp150.000.
                    </p>
                  </div>
                  <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200">
                    <h5 className="font-semibold text-rose-950">3.3 Off Lebih dari 2 Hari Berturut-Turut</h5>
                    <p className="text-rose-900">
                      Jika mengambil lebih dari 2 hari off berturut-turut, maka dikenakan <b>sanksi Rp100.000 per hari tambahan</b> dari hari ketiga dan seterusnya (berlaku kelipatan).
                    </p>
                    <p className="text-xs text-rose-800 italic mt-0.5">
                      Contoh: ambil 3 hari berturut = kena denda Rp100.000; ambil 4 hari = Rp200.000.
                    </p>
                  </div>
                </div>
              </section>

              {/* 4. MEKANISME PENGAJUAN OFF */}
              <section className="space-y-2">
                <h4 className="font-semibold text-slate-950 text-sm uppercase">4. MEKANISME PENGAJUAN OFF</h4>
                <div className="space-y-2.5 pl-4">
                  <div>
                    <h5 className="font-semibold text-slate-900">4.1 Format Pengajuan</h5>
                    <div className="bg-slate-100 p-2.5 rounded-lg font-mono text-xs text-slate-800 border border-slate-200">
                      <p>Dilakukan di grup WhatsApp tim dengan format:</p>
                      <p className="font-bold text-amber-900 mt-1">Nama : [Nama Lengkap]</p>
                      <p className="font-bold text-amber-900">Tanggal Libur : [Tanggal yang diajukan]</p>
                    </div>
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-900">4.2 Waktu Pengajuan &amp; Kuota Harian</h5>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      <li>Pengajuan <b>maksimal H-3</b> sebelum hari yang diajukan kecuali keadaan darurat.</li>
                      <li><b>Senin, Kamis, Jumat, Sabtu, Minggu:</b> maksimal <b>1 orang</b> per hari.</li>
                      <li><b>Selasa dan Rabu:</b> maksimal <b>2 orang</b> per hari.</li>
                      <li>Jika Selasa/Rabu bertepatan dengan tanggal merah, maka kuota digeser ke hari kerja setelahnya.</li>
                    </ul>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                    <h5 className="font-semibold text-amber-950">4.3 Kombinasi Posisi (Guardrails Station)</h5>
                    <p className="text-amber-900 mb-1">
                      Jika 2 orang mengambil off di hari yang sama, <b>tidak boleh dari posisi yang sama</b>, seperti:
                    </p>
                    <div className="grid grid-cols-2 gap-1 font-bold text-xs text-amber-950">
                      <span>• Tidak boleh dua koki</span>
                      <span>• Tidak boleh dua kasir</span>
                      <span>• Tidak boleh dua waiters</span>
                      <span>• Tidak boleh dua PIC</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 5. PELANGGARAN DAN SANKSI */}
              <section className="space-y-2">
                <h4 className="font-semibold text-slate-950 text-sm uppercase">5. PELANGGARAN DAN SANKSI</h4>
                <div className="space-y-2 pl-4">
                  <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    <h5 className="font-semibold text-rose-950">5.1 Off Tanpa Pemberitahuan</h5>
                    <p className="text-rose-900">
                      Jika off dilakukan tanpa pemberitahuan, maka akan <b>langsung diberikan Surat Peringatan (SP) 1</b>.
                    </p>
                  </div>
                  <div className="bg-rose-100 p-2.5 rounded-lg border border-rose-300">
                    <h5 className="font-semibold text-rose-950">5.2 Off Tanpa Kabar Selama 5 Hari</h5>
                    <p className="text-rose-950 font-bold">
                      Jika dalam waktu 5 hari berturut-turut karyawan tidak ada kabar, maka akan <b>dianggap resign secara otomatis</b>.
                    </p>
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-900">5.3 Bentrok Pengajuan</h5>
                    <p className="text-slate-700">
                      Jika terjadi bentrok jadwal, prioritas diberikan kepada keperluan darurat (sakit, keluarga, dsb.). Manajemen akan memberikan keputusan akhir berdasarkan urgensi dan kebutuhan operasional.
                    </p>
                  </div>
                </div>
              </section>

              {/* 6. PENUTUP & PENGESAHAN */}
              <section className="space-y-3 pt-3 border-t border-slate-200">
                <h4 className="font-semibold text-slate-950 text-sm uppercase">6. PENUTUP</h4>
                <p className="text-slate-700 italic">
                  Petunjuk teknis ini berlaku sebagai <b>aturan resmi internal dan wajib ditaati seluruh karyawan</b>. Ketidaktahuan terhadap aturan ini bukan alasan untuk pelanggaran. Demi kenyamanan bersama, mari jaga kedisiplinan dan komunikasi yang baik.
                </p>

                {/* Tanda Tangan Resmi */}
                <div className="pt-4 flex justify-between items-end">
                  <div className="text-xs text-slate-500">
                    <p>Diterbitkan di: Kota Tebing Tinggi</p>
                    <p>Unit Usaha: Ayam Pecak 2001 Seafood</p>
                    <p className="text-emerald-700 font-bold mt-1">✓ Terverifikasi Digital di Sistem HRIS</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold text-slate-800">Disahkan oleh:</p>
                    <div className="h-10 w-28 border-b-2 border-slate-900 flex items-center justify-center mx-auto text-slate-400 font-serif italic text-sm">
                      (Arif G. P.)
                    </div>
                    <p className="font-semibold text-slate-950 text-xs">ARIF GUNAWAN PANGGABEAN</p>
                    <p className="text-xs text-slate-600 font-medium">Manajemen Ayam Pecak 2001 Seafood</p>
                    <p className="text-xs text-slate-500 font-mono">Tanggal: 25 Mei 2025</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs text-slate-500">
                Aturan ini telah aktif sebagai guardrail otomatis pada aplikasi Android staf.
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => showToast('Salinan resmi PDF SOP 001/V/2025 berhasil diunduh!')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center space-x-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-amber-400" />
                  <span>Unduh Dokumen Asli (PDF)</span>
                </button>
                <button
                  onClick={() => setViewingOfficialSopDoc(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800"
                >
                  Tutup Naskah SOP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 9: DOKUMEN RESMI SOP JAM KERJA & KEHADIRAN 2026     */}
      {/* BERLAKU 01 APRIL 2026 - BAROKAH GRUP (8 HALAMAN LENGKAP)  */}
      {/* ========================================================= */}
      {viewingOfficialSop2026Doc && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 sm:p-8 shadow-xl space-y-6 max-h-[92vh] overflow-y-auto border border-slate-200 font-sans text-slate-900">
            {/* Header / Kop Surat Resmi Barokah Grup */}
            <div className="relative mb-3">
              <button
                onClick={() => setViewingOfficialSop2026Doc(false)}
                className="absolute right-2 top-2 p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl z-10 transition bg-white/80 shadow-xs"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="rounded-xl overflow-hidden shadow-xs border border-amber-200/60 bg-white">
                <img
                  src="/kop-surat-barokah.jpg"
                  alt="Kop Surat Resmi Barokah Grup"
                  className="w-full h-auto object-contain block"
                />
              </div>
            </div>

            {/* Document Metadata Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs">
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  STANDARD OPERATIONAL PROCEDURE (SOP)
                </p>
                <p className="font-semibold text-amber-800 text-base">
                  JAM KERJA, JAM OPERASIONAL DAN KEHADIRAN
                </p>
                <p className="text-slate-700 font-semibold mt-0.5">
                  Unit Usaha: Ayam Bakar Surabaya, Pecel Lele Pak Haji, Ayam Pecak 2001 Seafood, dll.
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="bg-emerald-600 text-white px-3 py-1 rounded-full font-semibold text-xs uppercase shadow-xs inline-block">
                  BERLAKU: 01 APRIL 2026
                </span>
                <p className="text-xs text-slate-500 font-mono mt-1">Dokumen Asli (8 Halaman)</p>
              </div>
            </div>

            {/* Quick Navigation Pills */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-100 rounded-xl text-xs font-bold">
              <span className="text-slate-500 py-1 px-2">Lompat Cepat:</span>
              <a href="#sop26-bab1" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Bab 1: Jam Kerja</a>
              <a href="#sop26-bab2" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Bab 2: Jam Operasional</a>
              <a href="#sop26-bab3" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Bab 3: Off Resmi</a>
              <a href="#sop26-bab4" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Bab 4: Sakit &amp; Opname</a>
              <a href="#sop26-bab5" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Bab 5: Setengah Hari</a>
              <a href="#sop26-bab6" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Bab 6: Libur Tambahan</a>
              <a href="#sop26-bab7" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Bab 7: Integritas Absen</a>
            </div>

            {/* Body of SOP 2026 */}
            <div className="space-y-6 text-xs text-slate-800 leading-relaxed">
              
              {/* BAB 1: JAM KERJA, ISTIRAHAT & LEMBUR */}
              <section id="sop26-bab1" className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded text-xs">BAB 1</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">KETENTUAN JAM KERJA, ISTIRAHAT &amp; LEMBUR</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-200 text-slate-900 font-bold">
                      <tr>
                        <th className="p-2 border">Unit Usaha</th>
                        <th className="p-2 border">Kategori Hari</th>
                        <th className="p-2 border">Jam Kerja Staf</th>
                        <th className="p-2 border">Istirahat</th>
                        <th className="p-2 border">Kebijakan Lembur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      <tr>
                        <td className="p-2 font-bold border" rowSpan={2}>Ayam Bakar Surabaya</td>
                        <td className="p-2 border">Weekday (Senin-Jumat)</td>
                        <td className="p-2 font-mono border">10.00 – 23.00 WIB</td>
                        <td className="p-2 border">2 Jam</td>
                        <td className="p-2 text-slate-500 border">Tidak ada lembur</td>
                      </tr>
                      <tr>
                        <td className="p-2 border bg-amber-50/40">Weekend &amp; Libur Nas.</td>
                        <td className="p-2 font-mono border bg-amber-50/40 font-bold text-amber-900">10.00 – 24.00 WIB</td>
                        <td className="p-2 border bg-amber-50/40">2 Jam</td>
                        <td className="p-2 border bg-amber-50/40 font-bold text-emerald-700">Lembur 1 Jam</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border">Ayam Pecak 2001 Seafood</td>
                        <td className="p-2 border">Weekday &amp; Weekend / Libur Nas.</td>
                        <td className="p-2 font-mono border">10.00 – 01.00 WIB</td>
                        <td className="p-2 border">3 Jam</td>
                        <td className="p-2 font-bold text-emerald-700 border">Rp 7.000 / hari (Maks. Rp 200.000 / bln)</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border">Pecel Lele Pak Haji</td>
                        <td className="p-2 border">Weekday &amp; Weekend / Libur Nas.</td>
                        <td className="p-2 font-mono border">10.00 – 01.00 WIB</td>
                        <td className="p-2 border">3 Jam</td>
                        <td className="p-2 font-bold text-emerald-700 border">Rp 7.000 / hari (Maks. Rp 200.000 / bln)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* BAB 2: JAM OPERASIONAL OUTLET */}
              <section id="sop26-bab2" className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded text-xs">BAB 2</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">JAM OPERASIONAL OUTLET (BUKA, TUTUP &amp; CLOSING)</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Ayam Bakar Surabaya</p>
                    <p className="text-xs text-slate-600">• Weekday: Buka 11.00 - 22.00 WIB (Closing 23.00)</p>
                    <p className="text-xs text-slate-600">• Weekend: Buka 11.00 - 23.00 WIB (Closing 24.00)</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Ayam Pecak 2001 Seafood</p>
                    <p className="text-xs text-slate-600">• Setiap Hari: Buka 11.00 - 24.00 WIB</p>
                    <p className="text-xs text-amber-700 font-semibold">• Jam Closing: 01.00 WIB</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Pecel Lele Pak Haji</p>
                    <p className="text-xs text-slate-600">• Setiap Hari: Buka 11.00 - 24.00 WIB</p>
                    <p className="text-xs text-amber-700 font-semibold">• Jam Closing: 01.00 WIB</p>
                  </div>
                </div>
              </section>

              {/* BAB 3: KETENTUAN KEHADIRAN & LIBUR RESMI */}
              <section id="sop26-bab3" className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded text-xs">BAB 3</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">KETENTUAN KEHADIRAN &amp; OFF RESMI (LIBUR REGULER)</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <h5 className="font-semibold text-slate-900">Ketentuan Dasar &amp; Kuota Cabang</h5>
                    <ul className="list-disc list-inside space-y-1 text-slate-700 text-xs">
                      <li>Hak jatah libur resmi adalah <b>2 hari per bulan</b> setelah masa kerja minimal 1 bulan.</li>
                      <li>Wajib diajukan ke HRD minimal <b>H-3</b> sebelum tanggal libur. Pengajuan &lt; H-3 masuk kategori Libur Tambahan.</li>
                      <li>Outlet dengan <b>&lt; 8 staf</b>: Maksimal <b>1 orang off per hari</b>.</li>
                      <li>Outlet dengan <b>&ge; 8 staf</b>: Maksimal <b>2 orang off per hari</b> (wajib berbeda stasiun/posisi kerja).</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <h5 className="font-semibold text-slate-900">Konsekuensi Pengambilan Hari</h5>
                    <div className="space-y-1.5 text-xs">
                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="font-bold text-emerald-950">Weekday (Senin - Jumat):</span>
                        <p className="text-emerald-900">Gaji harian tetap dibayar penuh (tanpa sanksi denda).</p>
                      </div>
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                        <span className="font-bold text-rose-950">Weekend (Sabtu / Minggu):</span>
                        <p className="text-rose-900">Dikenakan <b>Denda Rp 200.000,-</b> + Jatah off berkurang 1 hari.</p>
                      </div>
                      <div className="p-2 bg-rose-100 border border-rose-300 rounded-lg">
                        <span className="font-bold text-rose-950">Hari Libur Nasional:</span>
                        <p className="text-rose-950">Dikenakan <b>Denda Rp 250.000,-</b> + Jatah off berkurang 1 hari (Wajib disertai konfirmasi Surat Keterangan / Pengumuman Peak Season Perusahaan).</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* BAB 4: KETENTUAN SAKIT */}
              <section id="sop26-bab4" className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded text-xs">BAB 4</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">KETENTUAN SAKIT (RAWAT INAP VS RAWAT JALAN)</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
                    <h5 className="font-semibold text-emerald-950">Sakit Rawat Inap (Opname RS)</h5>
                    <div className="space-y-1 text-xs text-emerald-900">
                      <p className="font-bold">• Rawat Inap &le; 3 Hari (Surat RS Resmi):</p>
                      <ul className="list-disc list-inside pl-2 space-y-0.5">
                        <li>Gaji Pokok / Upah Harian: <b>TETAP DAPAT (100%)</b></li>
                        <li className="text-rose-800 font-semibold">Uang Makan: <b>TIDAK DAPAT (Rp 0)</b></li>
                        <li className="text-rose-800 font-semibold">Uang Lembur: <b>TIDAK DAPAT (Rp 0)</b></li>
                        <li>Sanksi Denda: <b>TIDAK ADA SANKSI</b></li>
                      </ul>
                      <p className="font-bold pt-1">• Rawat Inap &gt; 3 Hari (Hari ke-4 dst):</p>
                      <p className="pl-2">Gaji pokok harian, uang makan, dan uang lembur tidak dibayar (unpaid, tanpa sanksi denda).</p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
                    <h5 className="font-semibold text-amber-950">Sakit Rawat Jalan (Klinik/Puskesmas)</h5>
                    <div className="space-y-1.5 text-xs text-slate-700">
                      <p>• <b>Klaim Upah</b>: Sakit rawat jalan tidak mendapatkan upah harian/prorata, uang makan &amp; lembur (unpaid).</p>
                      <div className="p-2 bg-white rounded border border-amber-200">
                        <p className="font-bold text-slate-900">• Sakit di Weekend / Libur Nasional:</p>
                        <p className="text-emerald-700">✓ <b>Dengan Surat Dokter</b>: Tanpa gaji/makan/lembur, <b>TIDAK ADA DENDA</b>.</p>
                        <p className="text-rose-700 font-bold">✗ <b>TANPA Surat Dokter</b>: Tanpa gaji/makan/lembur + <b>DENDA Rp 50.000,-</b>.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* BAB 5: MASUK SETENGAH HARI */}
              <section id="sop26-bab5" className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded text-xs">BAB 5</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">KETENTUAN MASUK SETENGAH HARI (PARSIAL)</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-200 text-slate-900 font-bold">
                      <tr>
                        <th className="p-2 border">Durasi Kehadiran</th>
                        <th className="p-2 border">Kategori Hari</th>
                        <th className="p-2 border">Hak Karyawan</th>
                        <th className="p-2 border">Sanksi &amp; Konsekuensi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      <tr>
                        <td className="p-2 font-bold border" rowSpan={2}>&gt; 50% Jam Kerja</td>
                        <td className="p-2 border">Weekday</td>
                        <td className="p-2 font-bold text-emerald-700 border">Mendapat Gaji Harian</td>
                        <td className="p-2 text-slate-500 border">Tidak dapat uang makan &amp; lembur</td>
                      </tr>
                      <tr>
                        <td className="p-2 border">Weekend / Libur Nas.</td>
                        <td className="p-2 text-slate-500 border">Tidak dapat gaji, makan &amp; lembur</td>
                        <td className="p-2 text-emerald-700 border">Tanpa denda tambahan</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border" rowSpan={2}>25% - 50% Jam Kerja</td>
                        <td className="p-2 border">Weekday</td>
                        <td className="p-2 text-slate-500 border">Tidak dapat gaji, makan &amp; lembur</td>
                        <td className="p-2 text-emerald-700 border">Tanpa denda tambahan</td>
                      </tr>
                      <tr>
                        <td className="p-2 border bg-rose-50/40">Weekend / Libur Nas.</td>
                        <td className="p-2 border bg-rose-50/40 text-slate-500">Tidak dapat gaji, makan &amp; lembur</td>
                        <td className="p-2 border bg-rose-50/40 font-bold text-rose-700">Denda Rp 100.000,-</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border" rowSpan={2}>&lt; 25% Jam Kerja</td>
                        <td className="p-2 border bg-rose-100/50">Weekday</td>
                        <td className="p-2 font-bold text-rose-900 border bg-rose-100/50">Dianggap Tidak Masuk Kerja</td>
                        <td className="p-2 border bg-rose-100/50 font-bold text-rose-800">SP1 (Surat Peringatan 1)</td>
                      </tr>
                      <tr>
                        <td className="p-2 border bg-rose-200/50">Weekend / Libur Nas.</td>
                        <td className="p-2 font-bold text-rose-900 border bg-rose-200/50">Dianggap Tidak Masuk Kerja</td>
                        <td className="p-2 border bg-rose-200/50 font-bold text-rose-900">SP1 + Denda Rp 200.000,-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* BAB 6: LIBUR TAMBAHAN & DISPENSASI */}
              <section id="sop26-bab6" className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded text-xs">BAB 6</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">LIBUR TAMBAHAN (DI LUAR JATAH OFF) &amp; DISPENSASI</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                    <p className="font-bold text-slate-900">Pengajuan Mendadak (&lt; H-3)</p>
                    <p className="text-slate-600">
                      Jika jatah off bulanan masih ada namun diajukan &lt; H-3 pada hari kerja (weekday) dengan alasan disetujui atasan/HRD, maka jatah off berkurang 1 hari dan dikenakan <b>Denda Rp 50.000,-</b>.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                    <p className="font-bold text-slate-900">Jatah Off Habis (Maks. 3 Hari dengan Izin HRD)</p>
                    <p className="text-slate-600">
                      Tidak mendapatkan gaji harian (dipotong prorata Gaji Pokok / 30 sesuai SOP-HR-006), tidak dapat uang makan, dan tidak dapat uang lembur, serta dikenakan sanksi denda per hari:
                    </p>
                    <ul className="list-disc list-inside text-rose-800 font-semibold space-y-0.5">
                      <li>Tingkat Leader (Kepala Cabang/Produksi/Layanan): <b>Denda Rp 25.000 / hari</b></li>
                      <li>Tingkat Karyawan / Staf: <b>Denda Rp 15.000 / hari</b></li>
                    </ul>
                  </div>
                </div>

                <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900">
                  <b>Dispensasi Alasan Tertentu:</b> Libur keperluan darurat keluarga, pernikahan, atau kedukaan yang telah disetujui HRD secara resmi <b>TIDAK DIKENAKAN SANKSI DENDA</b>.
                </div>
              </section>

              {/* BAB 7: INTEGRITAS ABSENSI & KEDISIPLINAN */}
              <section id="sop26-bab7" className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded text-xs">BAB 7</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">INTEGRITAS ABSENSI &amp; SANKSI INDISIPLINER</h4>
                </div>

                <div className="space-y-2 text-xs text-slate-700">
                  <p>1. Seluruh karyawan wajib melakukan absensi masuk dan absensi pulang melalui sistem biometrik/aplikasi HRIS sesuai jam kerja.</p>
                  <p>2. Karyawan yang tidak melakukan absensi dianggap belum hadir sampai diverifikasi oleh atasan langsung.</p>
                  <p className="text-rose-700 font-bold">
                    3. Pelanggaran manipulasi absensi (titip absen, memalsukan data lokasi GPS/kamera) dikategorikan sebagai pelanggaran berat dan dikenakan sanksi SP3 atau Pemutusan Hubungan Kerja (PHK).
                  </p>
                  <p className="text-rose-800 font-semibold">
                    4. Tidak masuk kerja tanpa keterangan / tanpa kabar: 1 hari dikenakan SP1; 5 hari berturut-turut tanpa kabar dianggap mengundurkan diri secara sepihak (Auto-Resign).
                  </p>
                </div>
              </section>

              {/* PENGESAHAN DOKUMEN */}
              <section className="pt-4 border-t-2 border-slate-900 flex flex-col sm:flex-row justify-between items-end gap-4">
                <div className="text-xs text-slate-500 space-y-0.5">
                  <p className="font-bold text-slate-700">Ditetapkan di: Kota Tebing Tinggi</p>
                  <p>Berlaku Efektif: <b>01 April 2026</b></p>
                  <p className="text-emerald-700 font-bold">✓ Terkoneksi Otomatis ke Payroll, Roster &amp; Kru App</p>
                </div>

                <div className="text-right space-y-1">
                  <p className="font-bold text-slate-800 text-xs">Disahkan oleh:</p>
                  <div className="h-12 w-32 border-b-2 border-slate-900 flex items-center justify-center mx-auto text-slate-400 font-serif italic text-sm">
                    (Direksi)
                  </div>
                  <p className="font-semibold text-slate-950 text-xs">DIREKSI &amp; MANAJEMEN HRD</p>
                  <p className="text-xs text-slate-600 font-semibold uppercase">BAROKAH GRUP INDONESIA</p>
                  <p className="text-xs text-slate-400 font-mono">Verifikasi Hash Digital: BG-SOP-2026-04-VALID</p>
                </div>
              </section>
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs text-slate-500">
                Formula denda &amp; kuota SOP ini aktif secara real-time di seluruh sistem HRIS.
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => showToast('Salinan resmi PDF SOP Barokah Grup (01 April 2026) siap dicetak!')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center space-x-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-amber-400" />
                  <span>Cetak / Unduh PDF</span>
                </button>
                <button
                  onClick={() => setViewingOfficialSop2026Doc(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800"
                >
                  Tutup Naskah SOP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 10: DOKUMEN RESMI SOP ONBOARDING PAYROLL KRU BARU  */}
      {/* SK: 004/HR-PAY/2026/BAROKAH - BERLAKU 21 OKTOBER 2026     */}
      {/* ========================================================= */}
      {viewingOfficialSopOnboardingDoc && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 sm:p-8 shadow-xl space-y-6 max-h-[92vh] overflow-y-auto border border-slate-200 font-sans text-slate-900">
            {/* Header / Kop Surat Resmi Barokah Grup */}
            <div className="relative mb-3">
              <button
                onClick={() => setViewingOfficialSopOnboardingDoc(false)}
                className="absolute right-2 top-2 p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl z-10 transition bg-white/80 shadow-xs"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="rounded-xl overflow-hidden shadow-xs border border-amber-200/60 bg-white">
                <img
                  src="/kop-surat-barokah.jpg"
                  alt="Kop Surat Resmi Barokah Grup"
                  className="w-full h-auto object-contain block"
                />
              </div>
            </div>

            {/* Document Metadata Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs">
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  STANDARD OPERATIONAL PROCEDURE (SOP)
                </p>
                <p className="font-semibold text-amber-900 text-base">
                  SKEMA PENGGAJIAN KARYAWAN BARU (ONBOARDING PAYROLL 3 BULAN PERTAMA)
                </p>
                <p className="text-slate-600 font-mono text-xs mt-0.5">
                  Nomor Dokumen: <span className="font-bold text-amber-800">004/HR-PAY/2026/BAROKAH</span> | Klasifikasi: Operasional HRD &amp; Payroll
                </p>
                <p className="text-slate-700 font-semibold mt-0.5">
                  Unit Usaha: Ayam Bakar Surabaya, Pecel Lele Pak Haji, Ayam Pecak 2001 Seafood, &amp; Seluruh Kitchen Pusat.
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="bg-amber-600 text-white px-3 py-1 rounded-full font-semibold text-xs uppercase shadow-xs inline-block">
                  BERLAKU: 21 OKTOBER 2026
                </span>
                <p className="text-xs text-slate-500 font-mono mt-1">Dokumen Resmi Acuan HRIS</p>
              </div>
            </div>

            {/* Quick Navigation Pills */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-100 rounded-xl text-xs font-bold">
              <span className="text-slate-500 py-1 px-2">Lompat Cepat:</span>
              <a href="#sop-onb-pasal1" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 1: Siklus Standar Resto</a>
              <a href="#sop-onb-pasal2" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 2: Skema 3 Tahap Onboarding</a>
              <a href="#sop-onb-pasal3" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 3: Tabel Simulasi Real</a>
              <a href="#sop-onb-pasal4" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 4: Formula Prorata &amp; Kasbon</a>
              <a href="#sop-onb-pasal5" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 5: Komponen &amp; Insentif KPI</a>
              <a href="#sop-onb-pengesahan" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Lembar Pengesahan</a>
            </div>

            {/* Body of SOP Onboarding Payroll */}
            <div className="space-y-6 text-xs text-slate-800 leading-relaxed">
              
              {/* PASAL 1: SIKLUS PENGGAJIAN STANDAR RESTORAN */}
              <section id="sop-onb-pasal1" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-amber-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 1</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">SIKLUS PENGGAJIAN STANDAR RESTORAN (ACUAN UTAMA)</h4>
                </div>

                <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 text-slate-800 space-y-2">
                  <p className="font-semibold text-amber-950">
                    Sesuai dengan ketetapan SOP Penggajian Barokah Resto Group sebelumnya:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="bg-white p-3 rounded-lg border border-amber-300 shadow-xs">
                      <div className="flex items-center space-x-1.5 text-amber-800 font-semibold text-xs mb-1">
                        <Clock className="h-4 w-4" />
                        <span>1.1. Periode Tutup Buku (Cut-Off) Operasional</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        Periode tutup buku (cut-off) operasional restoran dihitung dari <strong>tanggal 6 bulan sebelumnya sampai dengan tanggal 5 bulan berjalan</strong>.
                      </p>
                      <span className="inline-block mt-2 text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                        Contoh: 06 Juni s/d 05 Juli
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-amber-300 shadow-xs">
                      <div className="flex items-center space-x-1.5 text-emerald-800 font-semibold text-xs mb-1">
                        <Wallet className="h-4 w-4" />
                        <span>1.2. Pembayaran Gaji Serentak (Payday)</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        Pembayaran gaji (payday) seluruh outlet dilaksanakan <strong>serentak pada tanggal 10</strong> setiap bulannya melalui transfer rekening bank karyawan.
                      </p>
                      <span className="inline-block mt-2 text-xs font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold border border-emerald-200">
                        Cair: Tanggal 10 Setiap Bulan
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 italic pt-1">
                    * Ketentuan ini mengikat untuk seluruh staf dan kru restoran yang telah melewati masa penyesuaian onboarding.
                  </p>
                </div>
              </section>

              {/* PASAL 2: KETENTUAN PENGGAJIAN KARYAWAN BARU */}
              <section id="sop-onb-pasal2" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded text-xs">PASAL 2</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">KETENTUAN PENGGAJIAN KARYAWAN BARU (SKEMA 3 BULAN PERTAMA)</h4>
                </div>

                <p className="text-xs text-slate-700">
                  Untuk menjaga keadilan hak keringat kru baru sekaligus menyelaraskan catatan pembukuan akuntansi outlet, diberlakukan 3 tahapan penyesuaian penggajian:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* BULAN 1 */}
                  <div className="p-3.5 bg-white rounded-xl border-2 border-sky-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="bg-ink-800 text-white text-xs font-semibold px-2 py-0.5 rounded">TAHAP 1</span>
                      <span className="text-xs font-semibold text-sky-700">BULAN KE-1</span>
                    </div>
                    <h5 className="font-bold text-slate-900 text-xs">Gaji Pertama (Genap 1 Bulan Bekerja)</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Karyawan yang baru bergabung akan mendapatkan gaji setelah <strong>genap 1 (satu) bulan bekerja</strong>.
                    </p>
                    <div className="bg-sky-50 p-2 rounded-lg text-xs space-y-1 border border-sky-100">
                      <p className="font-bold text-sky-900">• Status: GAJI FULL (100%)</p>
                      <p className="text-slate-600">• Diberikan tepat 1 bulan sejak mulai bergabung.</p>
                      <p className="text-slate-600">• Contoh: Masuk 10 Mei → Gajian di 10 Juni.</p>
                    </div>
                  </div>

                  {/* BULAN 2 */}
                  <div className="p-3.5 bg-white rounded-xl border-2 border-amber-300 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="bg-amber-600 text-white text-xs font-semibold px-2 py-0.5 rounded">TAHAP 2</span>
                      <span className="text-xs font-semibold text-amber-800">BULAN KE-2</span>
                    </div>
                    <h5 className="font-bold text-slate-900 text-xs">Penyesuaian Gaji (Penyelarasan Cut-Off)</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Dihitung dari tanggal selesai bulan pertama hingga tanggal tutup buku restoran (tanggal 5).
                    </p>
                    <div className="bg-amber-50 p-2 rounded-lg text-xs space-y-1 border border-amber-200">
                      <p className="font-bold text-amber-900">• Status: GAJI PRORATA PENYESUAIAN</p>
                      <p className="text-slate-600">• Periode: Tgl 10 s/d Tgl 5 bulan berikutnya.</p>
                      <p className="text-slate-600">• Gajian dibayarkan serentak tgl 10.</p>
                    </div>
                  </div>

                  {/* BULAN 3 */}
                  <div className="p-3.5 bg-white rounded-xl border-2 border-emerald-300 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="bg-emerald-600 text-white text-xs font-semibold px-2 py-0.5 rounded">TAHAP 3</span>
                      <span className="text-xs font-semibold text-emerald-800">BULAN KE-3 DST</span>
                    </div>
                    <h5 className="font-bold text-slate-900 text-xs">Siklus Reguler Penuh Restoran</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Mulai bulan ketiga dan seterusnya, karyawan sudah 100% mengikuti siklus operasional restoran.
                    </p>
                    <div className="bg-emerald-50 p-2 rounded-lg text-xs space-y-1 border border-emerald-200">
                      <p className="font-bold text-emerald-900">• Status: GAJI FULL REGULER (100%)</p>
                      <p className="text-slate-600">• Periode: Tgl 6 s/d Tgl 5 bulan berjalan.</p>
                      <p className="text-slate-600">• Gajian serentak tgl 10 setiap bulan.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* PASAL 3: TABEL SIMULASI OPERASIONAL NYATA */}
              <section id="sop-onb-pasal3" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-amber-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 3</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">SIMULASI OPERASIONAL KASUS NYATA (MASUK TANGGAL 10 MEI)</h4>
                </div>

                <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-950 flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-sky-600 shrink-0" />
                  <span>
                    <strong>Studi Kasus Resmi:</strong> Karyawan baru <strong>Budi Santoso (Cook Kitchen)</strong> bergabung dan mulai aktif bekerja pada tanggal <strong>10 Mei (10 Bulan 5)</strong>.
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-900 text-amber-300 font-bold">
                      <tr>
                        <th className="p-2.5 border border-slate-700">Tahapan Penggajian</th>
                        <th className="p-2.5 border border-slate-700">Rentang Tanggal Kerja</th>
                        <th className="p-2.5 border border-slate-700">Tutup Buku (Cut-Off)</th>
                        <th className="p-2.5 border border-slate-700">Tanggal Gajian (Payday)</th>
                        <th className="p-2.5 border border-slate-700">Nominal / Hak Gaji</th>
                        <th className="p-2.5 border border-slate-700">Dasar Ketetapan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      <tr className="hover:bg-sky-50/40">
                        <td className="p-2.5 font-bold text-sky-900 border">
                          <span className="px-2 py-0.5 bg-sky-100 rounded text-xs font-semibold mr-1">Bulan 1</span>
                          Gaji Awal Kerja
                        </td>
                        <td className="p-2.5 font-mono border">10 Mei – 09 Juni</td>
                        <td className="p-2.5 text-slate-600 border">09 Juni (Genap 1 Bln)</td>
                        <td className="p-2.5 font-bold text-sky-700 border">10 Juni (10 Bulan 6)</td>
                        <td className="p-2.5 font-semibold text-sky-800 border bg-sky-50/30">
                          GAJI FULL (100%)
                        </td>
                        <td className="p-2.5 text-slate-600 border text-xs">
                          Hak penuh setelah genap menyelesaikan 30 hari kalender kerja awal.
                        </td>
                      </tr>

                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2.5 font-bold text-amber-900 border">
                          <span className="px-2 py-0.5 bg-amber-100 rounded text-xs font-semibold mr-1">Bulan 2</span>
                          Penyesuaian Gaji
                        </td>
                        <td className="p-2.5 font-mono border font-semibold text-amber-900">10 Juni – 05 Juli</td>
                        <td className="p-2.5 font-bold text-slate-900 border">05 Juli (Tutup Buku Resto)</td>
                        <td className="p-2.5 font-bold text-amber-700 border">10 Juli</td>
                        <td className="p-2.5 font-semibold text-amber-900 border bg-amber-50/50">
                          PRORATA PENYESUAIAN
                        </td>
                        <td className="p-2.5 text-slate-600 border text-xs">
                          Penyelarasan tanggal kerja agar menyatu dengan tutup buku serentak restoran (tgl 5).
                        </td>
                      </tr>

                      <tr className="hover:bg-emerald-50/40">
                        <td className="p-2.5 font-bold text-emerald-900 border">
                          <span className="px-2 py-0.5 bg-emerald-100 rounded text-xs font-semibold mr-1">Bulan 3</span>
                          Gaji Reguler Penuh
                        </td>
                        <td className="p-2.5 font-mono border font-semibold text-emerald-900">06 Juli – 05 Agustus</td>
                        <td className="p-2.5 font-bold text-slate-900 border">05 Agustus (Tutup Buku Resto)</td>
                        <td className="p-2.5 font-bold text-emerald-700 border">10 Agustus</td>
                        <td className="p-2.5 font-semibold text-emerald-800 border bg-emerald-50/50">
                          GAJI FULL (100%)
                        </td>
                        <td className="p-2.5 text-slate-600 border text-xs">
                          100% mengikuti siklus standar restoran seterusnya (cut-off 6-5, cair tgl 10).
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* PASAL 4: FORMULA PERHITUNGAN PRORATA & ATURAN KASBON */}
              <section id="sop-onb-pasal4" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded text-xs">PASAL 4</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">FORMULA PRORATA BULAN KEDUA &amp; PEMBATASAN KASBON</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <h5 className="font-bold text-slate-900 text-xs">4.1. Formula Perhitungan Prorata Bulan 2:</h5>
                    <div className="p-2.5 bg-slate-900 text-amber-300 font-mono text-xs rounded-lg">
                      Gaji Bulan 2 = (Jumlah Hari Kerja Riil / Hari Kerja Standar) × (Gaji Pokok + Tunjangan Tetap)
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Hari kerja riil dihitung dari tanggal 10 Juni sampai dengan 5 Juli (dikurangi hari libur resmi mingguan). Tunjangan kehadiran dan transport dihitung berdasarkan absensi clock-in aktual.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-rose-200 space-y-2">
                    <h5 className="font-bold text-rose-900 text-xs flex items-center space-x-1">
                      <ShieldCheck className="h-4 w-4 text-rose-600" />
                      <span>4.2. Kebijakan Kasbon Karyawan Baru (SOP-HR-002):</span>
                    </h5>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Sesuai Pedoman Kasbon Restoran (SOP-HR-002), karyawan baru yang <strong>belum genap 3 (tiga) bulan bekerja</strong> atau masih berada dalam skema penyesuaian gaji <strong>TIDAK DIPERBOLEHKAN</strong> mengajukan pinjaman kasbon.
                    </p>
                    <p className="text-xs text-rose-700 font-semibold">
                      * Sistem HRIS mengunci otomatis form pengajuan kasbon bagi NIK karyawan berstatus onboarding.
                    </p>
                  </div>
                </div>
              </section>

              {/* PASAL 5: KOMPONEN PAYROLL & INSENTIF KPI GRADE A */}
              <section id="sop-onb-pasal5" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-amber-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 5</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">KOMPONEN PAYROLL &amp; INSENTIF KPI GRADE A (RP 100.000)</h4>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <p className="font-bold text-emerald-950 text-xs">
                    Insentif Prestasi Kinerja Kru Baru:
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Meskipun berstatus onboarding, kru baru tetap berhak menerima <strong>Insentif Prestasi Sebesar Rp 100.000</strong> yang dimasukkan langsung ke dalam kolom Payroll apabila berhasil meraih <strong>Grade A</strong> pada evaluasi bulanan:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 text-center">
                      <span className="text-xs text-slate-500 font-bold block">Disiplin Masuk</span>
                      <span className="text-xs font-semibold text-emerald-700">Bobot 30%</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 text-center">
                      <span className="text-xs text-slate-500 font-bold block">Disiplin Break</span>
                      <span className="text-xs font-semibold text-emerald-700">Bobot 25%</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 text-center">
                      <span className="text-xs text-slate-500 font-bold block">Survei 360° Attitude</span>
                      <span className="text-xs font-semibold text-emerald-700">Bobot 35%</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 text-center">
                      <span className="text-xs text-slate-500 font-bold block">Bebas Kasbon</span>
                      <span className="text-xs font-semibold text-emerald-700">Bobot 10%</span>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-800 italic pt-1">
                    * Karyawan dengan Grade B, C, dan D tidak mendapatkan insentif (Rp 0).
                  </p>
                </div>
              </section>

              {/* LEMBAR PENGESAHAN DOKUMEN RESMI */}
              <section id="sop-onb-pengesahan" className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-xs font-medium text-slate-600">LEMBAR PENGESAHAN DIREKSI &amp; MANAJEMEN HRD</p>
                  <p className="text-xs font-semibold text-slate-900">DITETAPKAN DI JAKARTA, PADA TANGGAL 21 OKTOBER 2026</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                    <p className="text-xs font-medium text-slate-600">Disusun Oleh,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-bold text-slate-600 text-sm">Hendra Pratama</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-bold text-slate-900 text-xs">Hendra Pratama, S.E.</p>
                      <p className="text-xs text-slate-500">Head of Payroll &amp; HR Ops</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                    <p className="text-xs font-medium text-slate-600">Diverifikasi Oleh,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-bold text-slate-600 text-sm">dr. Siti Rahmawati</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-bold text-slate-900 text-xs">Siti Rahmawati, M.M.</p>
                      <p className="text-xs text-slate-500">General Manager HRD</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border-2 border-amber-300 text-center space-y-2 relative overflow-hidden bg-amber-50/20">
                    <span className="absolute top-1 right-1 text-[8px] font-semibold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded uppercase">
                      TERVERIFIKASI
                    </span>
                    <p className="text-xs font-medium text-slate-600">Disetujui &amp; Disahkan,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-semibold text-amber-900 text-sm">H. Bambang Sutrisno</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-semibold text-slate-950 text-xs">H. Bambang Sutrisno</p>
                      <p className="text-xs text-amber-800 font-bold">Managing Director - Barokah F&amp;B Group</p>
                    </div>
                  </div>
                </div>
              </section>

            </div>

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs text-slate-500">
                Dokumen ini merupakan acuan mutlak kalkulasi sistem Payroll &amp; HRIS Barokah Grup.
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => showToast('Salinan naskah resmi SOP Onboarding Payroll (SK: 004/HR-PAY/2026/BAROKAH) siap dicetak!')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center space-x-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-amber-400" />
                  <span>Cetak / Unduh PDF</span>
                </button>
                <button
                  onClick={() => {
                    setViewingOfficialSopOnboardingDoc(false);
                    setActiveMenu('payroll');
                    showToast('Navigasi ke Modul Penggajian (Payroll) dengan acuan SOP Onboarding aktif!');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1 shadow-sm"
                >
                  <Wallet className="h-3.5 w-3.5 text-slate-950" />
                  <span>Buka Modul Penggajian</span>
                </button>
                <button
                  onClick={() => setViewingOfficialSopOnboardingDoc(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800"
                >
                  Tutup Naskah SOP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 11: DOKUMEN RESMI SOP GAJI POKOK & TUNJANGAN MASA   */}
      {/* KERJA (TENURE ALLOWANCE) - SK: 005/HR-PAY/2026/BAROKAH    */}
      {/* ========================================================= */}
      {viewingOfficialSopTenureDoc && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 sm:p-8 shadow-xl space-y-6 max-h-[92vh] overflow-y-auto border border-slate-200 font-sans text-slate-900">
            {/* Header / Kop Surat Resmi Barokah Grup */}
            <div className="relative mb-3">
              <button
                onClick={() => setViewingOfficialSopTenureDoc(false)}
                className="absolute right-2 top-2 p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl z-10 transition bg-white/80 shadow-xs"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="rounded-xl overflow-hidden shadow-xs border border-amber-200/60 bg-white">
                <img
                  src="/kop-surat-barokah.jpg"
                  alt="Kop Surat Resmi Barokah Grup"
                  className="w-full h-auto object-contain block"
                />
              </div>
            </div>

            {/* Document Metadata Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs">
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  STANDARD OPERATIONAL PROCEDURE (SOP)
                </p>
                <p className="font-semibold text-amber-900 text-base">
                  KETENTUAN GAJI POKOK &amp; TUNJANGAN LAMA BEKERJA (TENURE ALLOWANCE)
                </p>
                <p className="text-slate-600 font-mono text-xs mt-0.5">
                  Nomor Dokumen: <span className="font-bold text-amber-800">005/HR-PAY/2026/BAROKAH</span> | Klasifikasi: Operasional SDM &amp; Payroll
                </p>
                <p className="text-slate-700 font-semibold mt-0.5">
                  Unit Usaha: Ayam Bakar Surabaya, Pecel Lele Pak Haji, Ayam Pecak 2001 Seafood, &amp; Seluruh Kitchen Pusat.
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="bg-amber-600 text-white px-3 py-1 rounded-full font-semibold text-xs uppercase shadow-xs inline-block">
                  BERLAKU: 21 OKTOBER 2026
                </span>
                <p className="text-xs text-slate-500 font-mono mt-1">Dokumen Resmi Acuan HRIS</p>
              </div>
            </div>

            {/* Quick Navigation Pills */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-100 rounded-xl text-xs font-bold">
              <span className="text-slate-500 py-1 px-2">Lompat Cepat:</span>
              <a href="#sop-ten-pasal1" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 1: Gaji Pokok</a>
              <a href="#sop-ten-pasal2" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 2: Tunjangan Blok 6 Bln</a>
              <a href="#sop-ten-pasal3" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 3: Klausul +1 Bulan</a>
              <a href="#sop-ten-pasal4" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 4: Matriks Simulasi</a>
              <a href="#sop-ten-pasal5" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 5: Komponen Slip Gaji</a>
              <a href="#sop-ten-pengesahan" className="bg-white hover:bg-amber-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Lembar Pengesahan</a>
            </div>

            {/* Body of SOP Tenure Allowance */}
            <div className="space-y-6 text-xs text-slate-800 leading-relaxed">
              
              {/* PASAL 1: STRUKTUR GAJI POKOK BERDASARKAN LAMA BEKERJA */}
              <section id="sop-ten-pasal1" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-amber-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 1</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">STRUKTUR GAJI POKOK BERDASARKAN MASA KERJA (ACUAN SOP RESTO)</h4>
                </div>

                <p className="text-xs text-slate-700">
                  Mengacu pada pedoman struktur skala upah Barokah Resto Group, Gaji Pokok karyawan dibagi menjadi 2 tahap kelayakan masa kerja:
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-900 text-amber-300 font-bold">
                      <tr>
                        <th className="p-2.5 border border-slate-700">Tingkat Posisi / Divisi</th>
                        <th className="p-2.5 border border-slate-700">Masa Kerja &lt; 3 Bulan (Probation)</th>
                        <th className="p-2.5 border border-slate-700">Masa Kerja &ge; 3 Bulan (Karyawan Tetap)</th>
                        <th className="p-2.5 border border-slate-700">Kenaikan Gaji Pokok</th>
                        <th className="p-2.5 border border-slate-700">Ketentuan Evaluasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-mono text-xs">
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold font-sans text-slate-900 border">KASIR / FRONT COUNTER</td>
                        <td className="p-2 border">Rp 1.000.000</td>
                        <td className="p-2 font-bold text-emerald-700 border bg-emerald-50/30">Rp 1.200.000</td>
                        <td className="p-2 text-emerald-600 font-bold border">+Rp 200.000</td>
                        <td className="p-2 font-sans text-xs text-slate-600 border">Otomatis naik setelah 90 hari kalender kerja</td>
                      </tr>
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold font-sans text-slate-900 border">WAITERS / PRAMUSAJI</td>
                        <td className="p-2 border">Rp 1.000.000</td>
                        <td className="p-2 font-bold text-emerald-700 border bg-emerald-50/30">Rp 1.200.000</td>
                        <td className="p-2 text-emerald-600 font-bold border">+Rp 200.000</td>
                        <td className="p-2 font-sans text-xs text-slate-600 border">Otomatis naik setelah 90 hari kalender kerja</td>
                      </tr>
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold font-sans text-slate-900 border">KOKI (WOK, GORENG, BAKAR)</td>
                        <td className="p-2 border">Rp 1.000.000</td>
                        <td className="p-2 font-bold text-emerald-700 border bg-emerald-50/30">Rp 1.200.000</td>
                        <td className="p-2 text-emerald-600 font-bold border">+Rp 200.000</td>
                        <td className="p-2 font-sans text-xs text-slate-600 border">Otomatis naik setelah 90 hari kalender kerja</td>
                      </tr>
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold font-sans text-slate-900 border">HELPER PERSIAPAN DAPUR</td>
                        <td className="p-2 border">Rp 1.000.000</td>
                        <td className="p-2 font-bold text-emerald-700 border bg-emerald-50/30">Rp 1.200.000</td>
                        <td className="p-2 text-emerald-600 font-bold border">+Rp 200.000</td>
                        <td className="p-2 font-sans text-xs text-slate-600 border">Otomatis naik setelah 90 hari kalender kerja</td>
                      </tr>
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold font-sans text-slate-900 border">KEPALA PRODUKSI / HEAD COOK</td>
                        <td className="p-2 border">Rp 1.000.000</td>
                        <td className="p-2 font-bold text-emerald-700 border bg-emerald-50/30">Rp 1.200.000</td>
                        <td className="p-2 text-emerald-600 font-bold border">+Rp 200.000</td>
                        <td className="p-2 font-sans text-xs text-slate-600 border">Otomatis naik setelah 90 hari kalender kerja</td>
                      </tr>
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold font-sans text-slate-900 border">KEPALA CABANG (STORE MANAGER)</td>
                        <td className="p-2 border">Rp 1.500.000</td>
                        <td className="p-2 font-bold text-emerald-700 border bg-emerald-50/30">Rp 1.700.000</td>
                        <td className="p-2 text-emerald-600 font-bold border">+Rp 200.000</td>
                        <td className="p-2 font-sans text-xs text-slate-600 border">Evaluasi KPI &amp; omzet target outlet</td>
                      </tr>
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold font-sans text-slate-900 border">ASISTEN SUPERVISOR</td>
                        <td className="p-2 border">Rp 1.900.000</td>
                        <td className="p-2 font-bold text-emerald-700 border bg-emerald-50/30">Rp 2.100.000</td>
                        <td className="p-2 text-emerald-600 font-bold border">+Rp 200.000</td>
                        <td className="p-2 font-sans text-xs text-slate-600 border">Evaluasi leadership &amp; audit operasional</td>
                      </tr>
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold font-sans text-slate-900 border">SUPERVISOR AREA</td>
                        <td className="p-2 border">Rp 2.400.000</td>
                        <td className="p-2 font-bold text-emerald-700 border bg-emerald-50/30">Rp 2.700.000</td>
                        <td className="p-2 text-emerald-600 font-bold border">+Rp 300.000</td>
                        <td className="p-2 font-sans text-xs text-slate-600 border">SK Resmi Direksi Barokah Group</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* PASAL 2: SKEMA TUNJANGAN LAMA BEKERJA (BLOK 6 BULANAN) */}
              <section id="sop-ten-pasal2" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded text-xs">PASAL 2</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">SKEMA TUNJANGAN LAMA BEKERJA DALAM BLOK 6 BULAN</h4>
                </div>

                <p className="text-xs text-slate-700">
                  Sebagai wujud apresiasi atas kesetiaan, dedikasi, dan loyalitas karyawan di lingkungan Barokah Resto Group, diberikan <strong>Tunjangan Lama Bekerja (Tenure Allowance)</strong> dengan skema blok interval 6 bulanan:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                    <span className="text-xs font-medium text-slate-600 block">Tahap Awal</span>
                    <h5 className="font-semibold text-slate-900 text-xs">Bulan 1 s/d 6</h5>
                    <p className="text-xl font-semibold text-slate-500 tabular-nums">Rp 0</p>
                    <p className="text-xs text-slate-500 leading-tight">Masa pengenalan kultur, training SOP, dan stabilisasi jam kerja.</p>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border-2 border-amber-300 space-y-1.5 shadow-xs bg-amber-50/20">
                    <span className="text-xs font-semibold text-amber-800 uppercase block">Periode ke-1</span>
                    <h5 className="font-semibold text-slate-900 text-xs">Bulan 7 s/d 12</h5>
                    <p className="text-xl font-semibold text-amber-700 font-mono">Rp 100.000</p>
                    <p className="text-xs text-slate-600 leading-tight">Tambahan pertama sebesar Rp 100.000/bln pasca genap 6 bulan bekerja.</p>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border-2 border-emerald-300 space-y-1.5 shadow-xs bg-emerald-50/20">
                    <span className="text-xs font-semibold text-emerald-800 uppercase block">Periode ke-2</span>
                    <h5 className="font-semibold text-slate-900 text-xs">Bulan 13 s/d 18</h5>
                    <p className="text-xl font-semibold text-emerald-700 font-mono">Rp 200.000</p>
                    <p className="text-xs text-slate-600 leading-tight">Tambah lagi Rp 100.000 pasca genap 1 tahun (Total Rp 200.000/bln).</p>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border-2 border-sky-300 space-y-1.5 shadow-xs bg-sky-50/20">
                    <span className="text-xs font-semibold text-sky-800 uppercase block">Periode ke-3 dst</span>
                    <h5 className="font-semibold text-slate-900 text-xs">Bulan 19 Ke Atas</h5>
                    <p className="text-xl font-semibold text-sky-700 font-mono">+ Rp 50.000</p>
                    <p className="text-xs text-slate-600 leading-tight">Setiap kelipatan 6 bulan bertambah Rp 50.000/bln secara kumulatif.</p>
                  </div>
                </div>
              </section>

              {/* PASAL 3: KLAUSUL WAKTU PENCAIRAN (+1 BULAN) */}
              <section id="sop-ten-pasal3" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-amber-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 3</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">KLAUSUL WAKTU PENCAIRAN HAK TUNJANGAN (+1 BULAN)</h4>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-slate-800 space-y-2">
                  <p className="font-semibold text-amber-950 text-xs">
                    Mekanisme Sinkronisasi Tutup Buku &amp; Pencairan Gaji:
                  </p>
                  <p className="text-xs leading-relaxed text-slate-700">
                    Sesuai SOP Siklus Penggajian (SOP-HR-004), operasional restoran memberlakukan cut-off dari <strong>tanggal 6 s/d tanggal 5 bulan berjalan</strong> dan pencairan serentak pada <strong>tanggal 10</strong>. Maka, pemberian tunjangan lama bekerja mengikuti prinsip <strong>+ 1 Bulan dari Usia Bekerja yang Memenuhi Syarat</strong>:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-xs">
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                      <p className="font-bold text-slate-900 mb-1">1. Syarat 6 Bulan Terpenuhi:</p>
                      <p className="text-slate-600 text-xs">Karyawan menuntaskan genap 6 bulan kerja di bulan ke-6. Maka hak tunjangan pertama sebesar <strong>Rp 100.000</strong> mulai dicairkan pada <strong>Bulan ke-7 s/d 12</strong>.</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                      <p className="font-bold text-slate-900 mb-1">2. Syarat 12 Bulan (1 Thn) Terpenuhi:</p>
                      <p className="text-slate-600 text-xs">Karyawan menuntaskan genap 12 bulan kerja di bulan ke-12. Maka kenaikan tunjangan menjadi <strong>Rp 200.000</strong> mulai dicairkan pada <strong>Bulan ke-13 s/d 18</strong>.</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                      <p className="font-bold text-slate-900 mb-1">3. Syarat 18 Bulan Terpenuhi:</p>
                      <p className="text-slate-600 text-xs">Karyawan menuntaskan genap 18 bulan kerja di bulan ke-18. Maka kenaikan tunjangan menjadi <strong>Rp 250.000</strong> mulai dicairkan pada <strong>Bulan ke-19 s/d 24</strong>.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* PASAL 4: TABEL MATRIKS SIMULASI LENGKAP 1 S/D 48 BULAN */}
              <section id="sop-ten-pasal4" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-amber-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 4</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">MATRIKS SIMULASI TUNJANGAN LAMA BEKERJA (BULAN 1 S/D 48)</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-900 text-amber-300 font-bold">
                      <tr>
                        <th className="p-2.5 border border-slate-700">Rentang Bulan Masa Kerja</th>
                        <th className="p-2.5 border border-slate-700">Gaji Pokok (Kru Operasional)</th>
                        <th className="p-2.5 border border-slate-700">Tunjangan Masa Kerja</th>
                        <th className="p-2.5 border border-slate-700">Total Pokok + Tunj. Masa Kerja</th>
                        <th className="p-2.5 border border-slate-700">Keterangan Eskalasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-mono text-xs">
                      <tr>
                        <td className="p-2 font-sans font-bold text-slate-700 border">Bulan 1 s/d 2</td>
                        <td className="p-2 border">Rp 1.000.000</td>
                        <td className="p-2 text-slate-400 border">Rp 0</td>
                        <td className="p-2 font-bold text-slate-900 border">Rp 1.000.000</td>
                        <td className="p-2 font-sans text-xs text-slate-500 border">Masa kerja &lt; 3 bulan (Probation)</td>
                      </tr>
                      <tr className="bg-amber-50/30">
                        <td className="p-2 font-sans font-bold text-slate-800 border">Bulan 3 s/d 6</td>
                        <td className="p-2 font-bold text-emerald-700 border">Rp 1.200.000</td>
                        <td className="p-2 text-slate-400 border">Rp 0</td>
                        <td className="p-2 font-bold text-slate-900 border">Rp 1.200.000</td>
                        <td className="p-2 font-sans text-xs text-emerald-800 border">Gaji pokok naik ke Rp 1.200.000 pasca 3 bulan</td>
                      </tr>
                      <tr className="bg-amber-100/50">
                        <td className="p-2 font-sans font-bold text-amber-900 border">Bulan 7 s/d 12</td>
                        <td className="p-2 font-bold text-slate-800 border">Rp 1.200.000</td>
                        <td className="p-2 font-semibold text-amber-800 border bg-amber-100/70">+ Rp 100.000</td>
                        <td className="p-2 font-semibold text-slate-950 border">Rp 1.300.000</td>
                        <td className="p-2 font-sans text-xs text-amber-900 border">Tunjangan pertama (+1 bln setelah genap 6 bln)</td>
                      </tr>
                      <tr className="bg-emerald-50/40">
                        <td className="p-2 font-sans font-bold text-emerald-900 border">Bulan 13 s/d 18</td>
                        <td className="p-2 font-bold text-slate-800 border">Rp 1.200.000</td>
                        <td className="p-2 font-semibold text-emerald-800 border bg-emerald-100/70">+ Rp 200.000</td>
                        <td className="p-2 font-semibold text-slate-950 border">Rp 1.400.000</td>
                        <td className="p-2 font-sans text-xs text-emerald-900 border">Kenaikan kedua (+1 bln setelah genap 12 bln / 1 thn)</td>
                      </tr>
                      <tr className="bg-sky-50/40">
                        <td className="p-2 font-sans font-bold text-sky-900 border">Bulan 19 s/d 24</td>
                        <td className="p-2 font-bold text-slate-800 border">Rp 1.200.000</td>
                        <td className="p-2 font-semibold text-sky-800 border bg-sky-100/70">+ Rp 250.000</td>
                        <td className="p-2 font-semibold text-slate-950 border">Rp 1.450.000</td>
                        <td className="p-2 font-sans text-xs text-sky-900 border">Kelipatan 6 bulan: tambah Rp 50.000 kumulatif</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-bold text-slate-900 border">Bulan 25 s/d 30</td>
                        <td className="p-2 font-bold text-slate-800 border">Rp 1.200.000</td>
                        <td className="p-2 font-semibold text-slate-800 border bg-slate-100/70">+ Rp 300.000</td>
                        <td className="p-2 font-semibold text-slate-950 border">Rp 1.500.000</td>
                        <td className="p-2 font-sans text-xs text-slate-900 border">Kelipatan 6 bulan: tambah Rp 50.000 kumulatif</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-bold text-slate-900 border">Bulan 31 s/d 36</td>
                        <td className="p-2 font-bold text-slate-800 border">Rp 1.200.000</td>
                        <td className="p-2 font-semibold text-slate-800 border bg-slate-100/70">+ Rp 350.000</td>
                        <td className="p-2 font-semibold text-slate-950 border">Rp 1.550.000</td>
                        <td className="p-2 font-sans text-xs text-slate-900 border">Kelipatan 6 bulan: tambah Rp 50.000 kumulatif (3 Tahun)</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-bold text-rose-900 border">Bulan 37 s/d 42</td>
                        <td className="p-2 font-bold text-slate-800 border">Rp 1.200.000</td>
                        <td className="p-2 font-semibold text-rose-800 border bg-rose-100/70">+ Rp 400.000</td>
                        <td className="p-2 font-semibold text-slate-950 border">Rp 1.600.000</td>
                        <td className="p-2 font-sans text-xs text-rose-900 border">Kelipatan 6 bulan: tambah Rp 50.000 kumulatif</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-bold text-slate-900 border">Bulan 43 s/d 48</td>
                        <td className="p-2 font-bold text-slate-800 border">Rp 1.200.000</td>
                        <td className="p-2 font-semibold text-slate-800 border bg-slate-200">+ Rp 450.000</td>
                        <td className="p-2 font-semibold text-slate-950 border">Rp 1.650.000</td>
                        <td className="p-2 font-sans text-xs text-slate-700 border">Kelipatan 6 bulan: tambah Rp 50.000 kumulatif (4 Tahun)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* PASAL 5: INTEGRASI SISTEM PAYROLL & SLIP GAJI */}
              <section id="sop-ten-pasal5" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-amber-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 5</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">INTEGRASI MODUL PAYROLL &amp; TRANSPARANSI SLIP GAJI</h4>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
                  <p>
                    1. <strong>Tercatat Otomatis:</strong> Nilai Tunjangan Lama Bekerja dihitung secara real-time berdasarkan usia kerja resmi yang tersimpan di Master Data Karyawan HRIS.
                  </p>
                  <p>
                    2. <strong>Rincian di Slip Gaji:</strong> Komponen ini ditampilkan secara eksplisit pada rincian slip gaji bulanan karyawan dengan label <em>"Tunjangan Lama Bekerja"</em> guna menjamin transparansi hak.
                  </p>
                  <p>
                    3. <strong>Perlindungan Hak:</strong> Tunjangan ini bersifat hak pasti dan tidak dapat dipotong kecuali atas ketetapan sanksi denda resmi SOP Resto yang telah disahkan.
                  </p>
                </div>
              </section>

              {/* LEMBAR PENGESAHAN DOKUMEN RESMI */}
              <section id="sop-ten-pengesahan" className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-xs font-medium text-slate-600">LEMBAR PENGESAHAN DIREKSI &amp; MANAJEMEN HRD</p>
                  <p className="text-xs font-semibold text-slate-900">DITETAPKAN DI JAKARTA, PADA TANGGAL 21 OKTOBER 2026</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                    <p className="text-xs font-medium text-slate-600">Disusun Oleh,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-bold text-slate-600 text-sm">Hendra Pratama</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-bold text-slate-900 text-xs">Hendra Pratama, S.E.</p>
                      <p className="text-xs text-slate-500">Head of Payroll &amp; Compensation</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                    <p className="text-xs font-medium text-slate-600">Diverifikasi Oleh,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-bold text-slate-600 text-sm">dr. Siti Rahmawati</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-bold text-slate-900 text-xs">Siti Rahmawati, M.M.</p>
                      <p className="text-xs text-slate-500">General Manager HRD</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border-2 border-amber-300 text-center space-y-2 relative overflow-hidden bg-amber-50/20">
                    <span className="absolute top-1 right-1 text-[8px] font-semibold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded uppercase">
                      TERVERIFIKASI
                    </span>
                    <p className="text-xs font-medium text-slate-600">Disetujui &amp; Disahkan,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-semibold text-amber-900 text-sm">H. Bambang Sutrisno</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-semibold text-slate-950 text-xs">H. Bambang Sutrisno</p>
                      <p className="text-xs text-amber-800 font-bold">Managing Director - Barokah F&amp;B Group</p>
                    </div>
                  </div>
                </div>
              </section>

            </div>

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs text-slate-500">
                Dokumen ini merupakan acuan mutlak kalkulasi Tunjangan Masa Kerja pada seluruh outlet Barokah Grup.
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => showToast('Salinan naskah resmi SOP Tunjangan Lama Bekerja (SK: 005/HR-PAY/2026/BAROKAH) siap dicetak!')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center space-x-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-amber-400" />
                  <span>Cetak / Unduh PDF</span>
                </button>
                <button
                  onClick={() => {
                    setViewingOfficialSopTenureDoc(false);
                    setActiveMenu('payroll');
                    showToast('Navigasi ke Modul Penggajian (Payroll) dengan kalkulasi Tunjangan Lama Bekerja aktif!');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1 shadow-sm"
                >
                  <Wallet className="h-3.5 w-3.5 text-slate-950" />
                  <span>Buka Modul Penggajian</span>
                </button>
                <button
                  onClick={() => setViewingOfficialSopTenureDoc(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800"
                >
                  Tutup Naskah SOP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL NASKAH RESMI: SOP-HR-007 (CUTI TAHUNAN BERJENJANG)   */}
      {/* ========================================================= */}
      {viewingOfficialSopAnnualLeaveDoc && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 sm:p-8 shadow-xl space-y-6 max-h-[92vh] overflow-y-auto border border-slate-200 font-sans text-slate-900">
            {/* Header / Kop Surat Resmi Barokah Grup */}
            <div className="relative mb-3">
              <button
                onClick={() => setViewingOfficialSopAnnualLeaveDoc(false)}
                className="absolute right-2 top-2 p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl z-10 transition bg-white/80 shadow-xs"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="rounded-xl overflow-hidden shadow-xs border border-emerald-200/60 bg-white">
                <img
                  src="/kop-surat-barokah.jpg"
                  alt="Kop Surat Resmi Barokah Grup"
                  className="w-full h-auto object-contain block"
                />
              </div>
            </div>

            {/* Document Metadata Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-xs">
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  STANDARD OPERATIONAL PROCEDURE (SOP)
                </p>
                <p className="font-semibold text-emerald-950 text-base">
                  KETENTUAN HAK CUTI TAHUNAN BERJENJANG BERDASARKAN MASA KERJA &amp; KETENTUAN UPAH TERHITUNG
                </p>
                <p className="text-slate-600 font-mono text-xs mt-0.5">
                  Nomor Dokumen: <span className="font-bold text-emerald-800">007/HR-LEAVE/2026/BAROKAH</span> | Klasifikasi: SDM &amp; Hak Istirahat Karyawan
                </p>
                <p className="text-slate-700 font-semibold mt-0.5">
                  Unit Usaha: Ayam Bakar Surabaya, Pecel Lele Pak Haji, Ayam Pecak 2001 Seafood, &amp; Seluruh Kitchen Pusat.
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="bg-ink-800 text-white px-3 py-1 rounded-full font-semibold text-xs uppercase shadow-xs inline-block">
                  BERLAKU: 22 OKTOBER 2026
                </span>
                <p className="text-xs text-slate-500 font-mono mt-1">Dokumen Resmi Acuan HRIS &amp; PKWT</p>
              </div>
            </div>

            {/* Quick Navigation Pills */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-100 rounded-xl text-xs font-bold">
              <span className="text-slate-500 py-1 px-2">Lompat Cepat:</span>
              <a href="#sop-ann-pasal1" className="bg-white hover:bg-emerald-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 1: Filosofi Loyalitas</a>
              <a href="#sop-ann-pasal2" className="bg-white hover:bg-emerald-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 2: Skema Berjenjang (1-10 Thn)</a>
              <a href="#sop-ann-pasal3" className="bg-white hover:bg-emerald-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 3: Upah Terhitung (100% Paid)</a>
              <a href="#sop-ann-pasal4" className="bg-white hover:bg-emerald-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 4: 4 Guardrails Ketat</a>
              <a href="#sop-ann-pasal5" className="bg-white hover:bg-emerald-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 5: Prosedur H-7 &amp; Kuota Cabang</a>
              <a href="#sop-ann-pasal6" className="bg-white hover:bg-emerald-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Lembar Pengesahan</a>
            </div>

            {/* Body of SOP Annual Leave */}
            <div className="space-y-6 text-xs text-slate-800 leading-relaxed">
              
              {/* PASAL 1: FILOSOFI PENGHARGAAN LOYALITAS & HAK DASAR KRU */}
              <section id="sop-ann-pasal1" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-emerald-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 1</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">HAKIKAT, TUJUAN &amp; FILOSOFI PENGHARGAAN LOYALITAS MASA KERJA</h4>
                </div>
                <p>
                  1. Cuti Tahunan Berjenjang adalah hak istirahat tahunan resmi berbayar penuh yang diberikan oleh Manajemen Barokah F&amp;B Group kepada karyawan sebagai wujud apresiasi atas kesetiaan, dedikasi, integritas, dan masa pengabdian kerja yang berkesinambungan tanpa putus kontrak.
                </p>
                <p>
                  2. Hak Cuti Tahunan Berjenjang ini timbul secara otomatis tepat pada tanggal karyawan menyelesaikan masa kerja aktif genap 1 (satu) tahun kalender sejak tanggal resmi bergabung (Join Date) pada sistem HRIS.
                </p>
                <p>
                  3. Hak Cuti Tahunan ini bersifat independen dan berdiri sendiri, di luar jatah libur reguler operasional bulanan (2 hari/bulan sesuai SOP-HR-001/003) serta di luar hak cuti khusus duka cita atau pernikahan (SOP-HR-006).
                </p>
              </section>

              {/* PASAL 2: SKEMA PERHITUNGAN HAK CUTI TAHUNAN BERJENJANG */}
              <section id="sop-ann-pasal2" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-emerald-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 2</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">SKEMA FORMULA PERHITUNGAN HAK CUTI TAHUNAN BERJENJANG</h4>
                </div>
                <p>
                  1. Alokasi kuota hari Cuti Tahunan bertambah 1 (satu) hari kerja untuk setiap kelipatan 1 (satu) tahun masa kerja aktif yang telah diselesaikan karyawan secara sah, dengan formula matematis baku:
                </p>
                <div className="p-3 bg-white rounded-lg border border-emerald-200 font-mono text-center font-bold text-emerald-900 text-xs">
                  Hak Cuti Tahunan (Hari/Tahun) = ⌊ Tahun Masa Kerja Aktif ⌋ (untuk Masa Kerja ≥ 1 Tahun)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <thead className="bg-ink-800 text-white font-bold">
                      <tr>
                        <th className="p-2 text-left">Masa Kerja Karyawan</th>
                        <th className="p-2 text-center">Hak Cuti Tahunan</th>
                        <th className="p-2 text-center">Status Upah Pokok</th>
                        <th className="p-2 text-left">Keterangan Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="bg-slate-50">
                        <td className="p-2 font-medium">&lt; 1 Tahun (Bulan 1 s.d. 12)</td>
                        <td className="p-2 text-center font-bold text-slate-400">0 Hari</td>
                        <td className="p-2 text-center text-slate-400">-</td>
                        <td className="p-2 text-slate-500">Masa orientasi &amp; pematangan kompetensi resto</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-emerald-900">Genap 1 Tahun (Tahun ke-1)</td>
                        <td className="p-2 text-center font-semibold text-emerald-700 bg-emerald-50">1 Hari / Tahun</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-slate-700">Hak cuti perdana aktif otomatis di HRIS</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-2 font-bold text-emerald-900">Genap 2 Tahun (Tahun ke-2)</td>
                        <td className="p-2 text-center font-semibold text-emerald-700 bg-emerald-50">2 Hari / Tahun</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-slate-700">Loyalitas 24 bulan pengabdian operasional</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-emerald-900">Genap 3 Tahun (Tahun ke-3)</td>
                        <td className="p-2 text-center font-semibold text-emerald-700 bg-emerald-50">3 Hari / Tahun</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-slate-700">Staf senior terlatih &amp; penguasaan multi-station</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-2 font-bold text-emerald-900">Genap 4 Tahun (Tahun ke-4)</td>
                        <td className="p-2 text-center font-semibold text-emerald-700 bg-emerald-50">4 Hari / Tahun</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-slate-700">Kader calon Leader / Supervisor Outlet</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-emerald-900">Genap 5 Tahun (Tahun ke-5)</td>
                        <td className="p-2 text-center font-semibold text-emerald-700 bg-emerald-50">5 Hari / Tahun</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-slate-700">Karyawan teladan pilar utama operasional cabang</td>
                      </tr>
                      <tr className="bg-emerald-50/50">
                        <td className="p-2 font-bold text-emerald-950">Setiap +1 Tahun Seterusnya (N Tahun)</td>
                        <td className="p-2 text-center font-semibold text-emerald-800 bg-emerald-100">+1 Hari (N Hari)</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-emerald-900 font-semibold">Bertambah 1 hari secara linier tanpa batas maksimal</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-600 italic">
                  2. Sifat Kuota Cuti Tahunan: Kuota cuti berlaku selama 1 (satu) tahun periode berjalan terhitung sejak tanggal timbulnya hak. Hak cuti tidak dapat diuangkan (no encashment/kompensasi rupiah) dan tidak dapat diakumulasikan ke tahun-tahun berikutnya (hangus otomatis pada pergantian periode tahunan).
                </p>
              </section>

              {/* PASAL 3: STATUS PENGUPAHAN TERHITUNG (100% PAID LEAVE) */}
              <section id="sop-ann-pasal3" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-emerald-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 3</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">STATUS PENGUPAHAN &amp; KOMPONEN UPAH TERHITUNG (PAID LEAVE)</h4>
                </div>
                <p>
                  1. <b>Upah Pokok Terhitung (Dibayar 100% Penuh):</b> Karyawan yang mengambil cuti tahunan resmi yang telah disetujui tetap menerima upah pokok harian secara penuh tanpa ada pemotongan prorata absensi harian (Gaji Pokok / 30).
                </p>
                <p>
                  2. <b>Fasilitas Kehadiran Fisik (Uang Makan &amp; Lembur):</b> Pada hari cuti tahunan, fasilitas uang makan harian (Rp 20.000,-/hari) dan hak lembur ditiadakan (Rp 0,-), mengingat uang makan dan upah lembur merupakan kompensasi atas kehadiran fisik nyata kru di outlet resto.
                </p>
                <p>
                  3. <b>Tunjangan Lama Bekerja &amp; Tunjangan Jabatan:</b> Seluruh tunjangan tetap bulanan seperti Tunjangan Masa Kerja (SOP-HR-005), Tunjangan Jabatan, dan Insentif Disiplin tetap dibayarkan utuh dan tidak terpengaruh oleh pengambilan cuti tahunan resmi.
                </p>
              </section>

              {/* PASAL 4: 4 GUARDRAILS KETAT LARANGAN PENGAMBILAN CUTI */}
              <section id="sop-ann-pasal4" className="space-y-3 p-4 bg-rose-50/50 rounded-xl border-2 border-rose-300">
                <div className="flex items-center gap-2 border-b border-rose-200 pb-2">
                  <span className="bg-rose-600 text-white font-semibold px-2 py-0.5 rounded text-xs">PASAL 4</span>
                  <h4 className="font-semibold text-rose-950 text-sm uppercase">EMPAT (4) GUARDRAILS OPERASIONAL &amp; LARANGAN KERAS PENGAMBILAN</h4>
                </div>
                <p className="text-rose-950 font-medium">
                  Demi menjamin kelancaran pelayanan restoran, mencegah kekosongan stasiun dapur, serta menjaga keadilan shift operasional, pengambilan Cuti Tahunan Berjenjang terikat secara mutlak pada 4 (empat) guardrails larangan ketat berikut:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  
                  {/* Guardrail 1 */}
                  <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>1. Dilarang Digabung Libur Reguler</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cuti tahunan <b>DILARANG KERAS</b> diambil berturut-turut atau menempel langsung dengan jatah libur reguler bulanan (2 hari off). Pengambilan cuti tahunan wajib diselingi minimal <b>2 (dua) hari kerja aktif normal</b> agar stasiun kerja tidak mengalami kekosongan kru berhari-hari.
                    </p>
                  </div>

                  {/* Guardrail 2 */}
                  <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>2. Dilarang Diambil di Weekend</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cuti tahunan <b>DILARANG KERAS</b> diambil pada hari Sabtu dan Minggu (weekend). Seluruh kru wajib siaga penuh melayani lonjakan pengunjung di akhir pekan. Cuti tahunan hanya dapat dijadwalkan pada hari kerja biasa (weekday: Senin s.d. Jumat).
                    </p>
                  </div>

                  {/* Guardrail 3 */}
                  <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>3. Dilarang di Hari Libur Nasional</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cuti tahunan <b>DILARANG KERAS</b> diambil pada Hari Libur Nasional resmi pemerintah, cuti bersama, atau hari besar keagamaan yang berstatus <i>Peak Season</i> restoran. Pengambilan libur pada tanggal merah tanpa izin direksi dikenakan denda pelanggaran <b>Rp 250.000,-</b> sesuai SOP-HR-003.
                    </p>
                  </div>

                  {/* Guardrail 4 */}
                  <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>4. Dilarang Menyambung Libur Lebaran</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cuti tahunan <b>DILARANG KERAS</b> diambil menyambung, mendahului, atau memperpanjang jadwal Libur Hari Raya Idul Fitri (Lebaran), baik pada periode <b>H-7 sebelum Lebaran</b> maupun <b>H+7 setelah Lebaran</b> (<i>Resto Blackout Period</i>).
                    </p>
                  </div>

                </div>
              </section>

              {/* PASAL 5: TATA CARA PENGAJUAN, KUOTA CABANG & VERIFIKASI */}
              <section id="sop-ann-pasal5" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-emerald-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 5</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">TATA CARA PENGAJUAN, KUOTA HARIAN CABANG &amp; PROSEDUR VERIFIKASI</h4>
                </div>
                <p>
                  1. <b>Batas Minimal Pengajuan:</b> Pengajuan cuti tahunan wajib didaftarkan oleh kru melalui Aplikasi HRIS Kru selambat-lambatnya <b>H-7 (tujuh hari kalender)</b> sebelum tanggal cuti yang direncanakan. Pengajuan mendadak (&lt; H-7) otomatis ditolak oleh sistem.
                </p>
                <p>
                  2. <b>Batas Kuota Harian Cabang (SOP-HR-003):</b> Total kru yang diperbolehkan off/cuti pada hari yang sama di satu cabang dibatasi ketat:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700">
                  <li>Cabang dengan jumlah staf <b>&lt; 8 orang:</b> Maksimal <b>1 (satu) orang</b> yang diizinkan libur/cuti per hari.</li>
                  <li>Cabang dengan jumlah staf <b>≥ 8 orang:</b> Maksimal <b>2 (dua) orang</b> yang diizinkan libur/cuti per hari, dengan syarat mutlak berasal dari divisi/stasiun kerja yang berbeda (contoh: 1 orang staf Kitchen BOH dan 1 orang staf Service FOH).</li>
                </ul>
                <p>
                  3. <b>Alur Persetujuan Resmi:</b> Permohonan diverifikasi oleh Leader/Supervisor Cabang berdasarkan ketersediaan kru cadangan, kemudian disetujui oleh Kepala Cabang, dan disahkan oleh HRD Pusat melalui sistem HRIS. Cuti tanpa persetujuan sah dikategorikan sebagai mangkir kerja / alpa.
                </p>
              </section>

              {/* PASAL 6: LEMBAR PENGESAHAN DIREKSI */}
              <section id="sop-ann-pasal6" className="space-y-4 pt-2 border-t border-slate-200">
                <div className="text-center space-y-1">
                  <h4 className="font-semibold text-slate-950 text-xs ">LEMBAR PENGESAHAN DOKUMEN RESMI</h4>
                  <p className="text-xs text-slate-500">
                    Ditetapkan di Jakarta pada tanggal 22 Oktober 2026. Mengikat seluruh entitas restoran dan kitchen PT Barokah Kuliner Nusantara.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                    <p className="text-xs font-medium text-slate-600">Dibuat Oleh,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-bold text-slate-600 text-sm">Hendra Pratama</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-bold text-slate-900 text-xs">Hendra Pratama, S.E.</p>
                      <p className="text-xs text-slate-500">Head of Payroll &amp; Compensation</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                    <p className="text-xs font-medium text-slate-600">Diverifikasi Oleh,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-bold text-slate-600 text-sm">Siti Rahmawati</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-bold text-slate-900 text-xs">Siti Rahmawati, M.M.</p>
                      <p className="text-xs text-slate-500">General Manager HRD</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border-2 border-emerald-400 text-center space-y-2 relative overflow-hidden bg-emerald-50/20">
                    <span className="absolute top-1 right-1 text-[8px] font-semibold bg-ink-800 text-white px-1.5 py-0.5 rounded uppercase">
                      TERVERIFIKASI
                    </span>
                    <p className="text-xs font-medium text-slate-600">Disetujui &amp; Disahkan,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-semibold text-emerald-950 text-sm">H. Bambang Sutrisno</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-semibold text-slate-950 text-xs">H. Bambang Sutrisno</p>
                      <p className="text-xs text-emerald-800 font-bold">Managing Director - Barokah F&amp;B Group</p>
                    </div>
                  </div>
                </div>
              </section>

            </div>

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs text-slate-500">
                Dokumen ini merupakan acuan mutlak pengajuan &amp; pengesahan Cuti Tahunan Berjenjang di seluruh outlet Barokah Grup.
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => showToast('Salinan naskah resmi SOP Cuti Tahunan Berjenjang (SK: 007/HR-LEAVE/2026/BAROKAH) siap dicetak!')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center space-x-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Cetak / Unduh PDF</span>
                </button>
                <button
                  onClick={() => {
                    setViewingOfficialSopAnnualLeaveDoc(false);
                    setActiveMenu('kru-portal');
                    showToast('Navigasi ke Portal Kru: Pengajuan Cuti Tahunan Berjenjang siap digunakan!');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-ink-800 hover:bg-ink-700 text-white flex items-center space-x-1 shadow-sm"
                >
                  <Calendar className="h-3.5 w-3.5 text-emerald-100" />
                  <span>Buka Portal Pengajuan Cuti</span>
                </button>
                <button
                  onClick={() => setViewingOfficialSopAnnualLeaveDoc(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800"
                >
                  Tutup Naskah SOP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL NASKAH RESMI: SOP-HR-006 (LIBUR, CUTI KHUSUS & UPAH) */}
      {/* ========================================================= */}
      {viewingOfficialSopUnpaidDoc && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 sm:p-8 shadow-xl space-y-6 max-h-[92vh] overflow-y-auto border border-slate-200 font-sans text-slate-900">
            {/* Header / Kop Surat Resmi Barokah Grup */}
            <div className="relative mb-3">
              <button
                onClick={() => setViewingOfficialSopUnpaidDoc(false)}
                className="absolute right-2 top-2 p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl z-10 transition bg-white/80 shadow-xs"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="rounded-xl overflow-hidden shadow-xs border border-sky-200/60 bg-white">
                <img
                  src="/kop-surat-barokah.jpg"
                  alt="Kop Surat Resmi Barokah Grup"
                  className="w-full h-auto object-contain block"
                />
              </div>
            </div>

            {/* Document Metadata Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-sky-50 p-4 rounded-xl border border-sky-200 text-xs">
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  STANDARD OPERATIONAL PROCEDURE (SOP)
                </p>
                <p className="font-semibold text-sky-950 text-base">
                  KETENTUAN HAK LIBUR OPERASIONAL, CUTI KHUSUS, DISPENSASI MUSIBAH, KLAIM SAKIT RAWAT INAP &amp; UPAH PRORATA
                </p>
                <p className="text-slate-600 font-mono text-xs mt-0.5">
                  Nomor Dokumen: <span className="font-bold text-sky-800">006/HR-LEAVE/2026/BAROKAH</span> | Klasifikasi: Operasional SDM &amp; Penggajian
                </p>
                <p className="text-slate-700 font-semibold mt-0.5">
                  Unit Usaha: Ayam Bakar Surabaya, Pecel Lele Pak Haji, Ayam Pecak 2001 Seafood, &amp; Seluruh Kitchen Pusat.
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="bg-sky-700 text-white px-3 py-1 rounded-full font-semibold text-xs uppercase shadow-xs inline-block">
                  BERLAKU: 22 OKTOBER 2026
                </span>
                <p className="text-xs text-slate-500 font-mono mt-1">Dokumen Acuan Kontrak PKWT &amp; Payroll</p>
              </div>
            </div>

            {/* Quick Navigation Pills */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-100 rounded-xl text-xs font-bold">
              <span className="text-slate-500 py-1 px-2">Lompat Cepat:</span>
              <a href="#sop-unp-pasal1" className="bg-white hover:bg-sky-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 1: Libur Reguler 2 Hari</a>
              <a href="#sop-unp-pasal2" className="bg-white hover:bg-sky-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 2: Cuti Khusus Dibayar Penuh</a>
              <a href="#sop-unp-pasal3" className="bg-white hover:bg-sky-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 3: Klaim Sakit Rawat Inap RS</a>
              <a href="#sop-unp-pasal4" className="bg-white hover:bg-sky-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 4: Cuti Unpaid (Tidak Dibayar)</a>
              <a href="#sop-unp-pasal5" className="bg-white hover:bg-sky-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Pasal 5: Rumus Prorata (Gaji / 30)</a>
              <a href="#sop-unp-pasal6" className="bg-white hover:bg-sky-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 transition">Lembar Pengesahan</a>
            </div>

            {/* Body of SOP Unpaid & Special Leave */}
            <div className="space-y-6 text-xs text-slate-800 leading-relaxed">
              
              {/* PASAL 1: SISTEM LIBUR REGULER OPERASIONAL RESTORAN */}
              <section id="sop-unp-pasal1" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-sky-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 1</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">SISTEM WAKTU KERJA &amp; HAK LIBUR REGULER OPERASIONAL RESTORAN</h4>
                </div>
                <p>
                  1. Mengingat karakteristik industri restoran dan makanan siap saji yang beroperasi tanpa henti 7 (tujuh) hari dalam seminggu, sistem kerja di Barokah Group <b>tidak memberlakukan libur mingguan 4 hari sebulan dan tidak memberlakukan hari libur nasional / tanggal merah</b>.
                </p>
                <p>
                  2. Setiap karyawan berhak atas jatah libur reguler sebanyak <b>2 (dua) hari dalam sebulan kalender</b> yang wajib dijadwalkan pada hari kerja biasa (weekday: Senin s.d. Jumat).
                </p>
                <p>
                  3. <b>Insentif Tidak Ambil Libur:</b> Karyawan yang secara sukarela tidak menggunakan jatah libur regulernya demi mendukung kelancaran operasional outlet berhak memperoleh uang kompensasi insentif sebesar <b>Rp 75.000,- per hari</b> yang dicairkan bersamaan dengan slip gaji bulanan.
                </p>
              </section>

              {/* PASAL 2: CUTI KHUSUS KELUARGA DIBAYAR PENUH */}
              <section id="sop-unp-pasal2" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-sky-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 2</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">HAK CUTI KHUSUS KELUARGA &amp; DISPENSASI MUSIBAH DIBAYAR PENUH (PAID LEAVE)</h4>
                </div>
                <p>
                  Perusahaan memberikan hak cuti khusus dengan <b>upah pokok tetap dibayar penuh (100%)</b> untuk kondisi-kondisi darurat berikut:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <thead className="bg-slate-900 text-white font-bold">
                      <tr>
                        <th className="p-2 text-left">Peristiwa / Keperluan Cuti Khusus</th>
                        <th className="p-2 text-center">Durasi Total</th>
                        <th className="p-2 text-center">Status Upah Pokok</th>
                        <th className="p-2 text-left">Syarat Bukti Resmi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-2 font-bold text-slate-800">Karyawan Sendiri Menikah</td>
                        <td className="p-2 text-center font-semibold text-emerald-700 bg-emerald-50">3 Hari Kerja</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-slate-600">Undangan &amp; Buku Nikah resmi KUA/Catatan Sipil</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-2 font-bold text-slate-800">Duka Cita Keluarga Inti (Ortu / Anak / Pasangan)</td>
                        <td className="p-2 text-center font-semibold text-slate-900">7 Hari Total</td>
                        <td className="p-2 text-center font-bold text-amber-800 bg-amber-50">
                          3 Hari Pertama Dibayar, 4 Hari Unpaid
                        </td>
                        <td className="p-2 text-slate-600">Surat Kematian RT/Kelurahan &amp; Kartu Keluarga</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-800">Duka Cita Anggota Keluarga Serumah</td>
                        <td className="p-2 text-center font-bold text-emerald-700 bg-emerald-50">1 Hari Kerja</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-slate-600">Surat Keterangan Kematian &amp; Kartu Keluarga</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-2 font-bold text-slate-800">Istri Karyawan Melahirkan / Keguguran</td>
                        <td className="p-2 text-center font-bold text-emerald-700 bg-emerald-50">2 Hari Kerja</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-slate-600">Surat Keterangan Lahir / Tindakan Medis RS/Bidan</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-800">Dispensasi Musibah Kebakaran Tempat Tinggal</td>
                        <td className="p-2 text-center font-semibold text-emerald-700 bg-emerald-50">3 Hari Kerja</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-slate-600">Surat Keterangan Musibah Damkar / Polsek / RT-RW</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-2 font-bold text-slate-800">Dispensasi Musibah Banjir Tempat Tinggal</td>
                        <td className="p-2 text-center font-semibold text-emerald-700 bg-emerald-50">2 Hari Kerja</td>
                        <td className="p-2 text-center font-bold text-emerald-700">Dibayar Penuh (100%)</td>
                        <td className="p-2 text-slate-600">Foto dokumentasi lokasi &amp; konfirmasi RT/RW</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-600 italic">
                  Catatan: Selama hari pelaksanaan cuti khusus dibayar penuh di atas, karyawan tidak mendapatkan uang makan harian (Rp 20.000,-/hari) dan upah lembur ditiadakan (Rp 0,-).
                </p>
              </section>

              {/* PASAL 3: KETENTUAN KLAIM SAKIT RAWAT INAP RS */}
              <section id="sop-unp-pasal3" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-sky-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 3</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">STANDAR KLAIM SAKIT (HANYA SAKIT RAWAT INAP RUMAH SAKIT)</h4>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs">
                    <ShieldAlert className="h-4 w-4 text-amber-700" />
                    <span>KETETAPAN MUTLAK KLAIM SAKIT RESMI RESTORAN</span>
                  </div>
                  <p className="text-xs text-amber-950 leading-relaxed">
                    Sakit yang dapat diajukan klaimnya pada sistem penggajian Barokah Group <b>HANYA sakit yang memerlukan RAWAT INAP (opname) di Rumah Sakit atau Puskesmas Rawat Inap resmi</b> yang dibuktikan dengan Surat Keterangan Rawat Inap, resume medis, dan kwitansi administrasi Rumah Sakit.
                  </p>
                </div>
                <p>
                  1. <b>Maksimal 3 Hari Upah Pokok:</b> Karyawan yang menjalani rawat inap RS berhak menerima upah pokok harian dibayar penuh <b>maksimal 3 (tiga) hari kalender pertama saja</b>.
                </p>
                <p>
                  2. <b>Rawat Inap Hari ke-4 dan Seterusnya:</b> Hari rawat inap terhitung mulai hari ke-4 (keempat) dan seterusnya berstatus <b>unpaid (tidak dibayar / di luar tanggungan)</b> dan memotong upah pokok secara prorata harian.
                </p>
                <p>
                  3. <b>Uang Makan &amp; Lembur:</b> Selama menjalani sakit rawat inap, karyawan <b>TIDAK MENDAPATKAN uang makan harian (Rp 20.000,-/hari) dan TIDAK MENDAPATKAN uang lembur</b>.
                </p>
                <p>
                  4. <b>Sakit Rawat Jalan:</b> Istirahat sakit di rumah karena rawat jalan (meskipun melampirkan surat dokter klinik umum) <b>tidak berhak atas upah harian (unpaid)</b> dan memotong upah secara prorata harian.
                </p>
              </section>

              {/* PASAL 4: CUTI TIDAK DIBAYAR (UNPAID LEAVE) */}
              <section id="sop-unp-pasal4" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-sky-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 4</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">KETENTUAN CUTI TIDAK DIBAYAR (UNPAID LEAVE / DI LUAR TANGGUNGAN)</h4>
                </div>
                <p>
                  Karyawan yang mengajukan izin untuk keperluan berikut diberikan izin resmi tanpa sanksi denda, namun <b>upah pokok harian tidak dibayarkan (unpaid / potong prorata)</b>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="font-semibold text-slate-900 block">Pengurusan Legalitas Pernikahan / Perceraian:</span>
                    <p className="text-slate-600">Maksimal 2 (dua) hari kerja di KUA, Pengadilan Agama, atau Catatan Sipil. Status: <b>Unpaid penuh (2 hari)</b>.</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="font-semibold text-slate-900 block">Sisa Masa Duka Cita Keluarga Inti:</span>
                    <p className="text-slate-600">Total 7 hari izin: Hari ke-1 s.d. ke-3 dibayar penuh; <b>Hari ke-4 s.d. ke-7 (4 hari) berstatus unpaid</b>.</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="font-semibold text-slate-900 block">Cuti Melahirkan Karyawati:</span>
                    <p className="text-slate-600">Diberikan 1 (satu) bulan / 30 hari kalender: <b>3 hari pertama dibayar penuh, 27 hari sisanya berstatus unpaid</b>.</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="font-semibold text-slate-900 block">Cuti Keguguran Kandungan:</span>
                    <p className="text-slate-600">Diberikan 14 hari istirahat pemulihan: <b>3 hari pertama dibayar penuh, 11 hari sisanya berstatus unpaid</b>.</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="font-semibold text-slate-900 block">Ibadah Umroh ke Tanah Suci:</span>
                    <p className="text-slate-600">Diberikan izin maksimal 14 hari kalender dengan status <b>Unpaid Penuh (14 hari tidak dibayar)</b>.</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="font-semibold text-slate-900 block">Istirahat Haid:</span>
                    <p className="text-slate-600"><b>Tidak diberlakukan</b> istirahat haid berbayar dalam sistem operasional restoran Barokah Group.</p>
                  </div>
                </div>
              </section>

              {/* PASAL 5: RUMUS PEMOTONGAN PRORATA UPAH POKOK */}
              <section id="sop-unp-pasal5" className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="bg-slate-900 text-sky-300 font-semibold px-2 py-0.5 rounded text-xs">PASAL 5</span>
                  <h4 className="font-semibold text-slate-950 text-sm uppercase">FORMULA RUMUS PEMOTONGAN PRORATA UPAH POKOK (PEMBAGI 30 HARI)</h4>
                </div>
                <p>
                  1. Sesuai revisi penetapan Manajemen 2026, rumus baku perhitungan pemotongan upah pokok untuk setiap hari izin/cuti tidak dibayar (unpaid) menggunakan dasar <b>pembagi 30 (tiga puluh) hari kalender</b>:
                </p>
                <div className="p-3 bg-white rounded-lg border border-sky-300 font-mono text-center font-bold text-sky-950 text-xs">
                  Potongan Prorata Harian = Gaji Pokok / 30 Hari
                </div>
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs space-y-1">
                  <p className="font-bold text-sky-950">Contoh Simulasi Staf Operasional (Gaji Pokok Rp 1.200.000,-):</p>
                  <p>• Upah harian prorata = Rp 1.200.000 / 30 hari = <b>Rp 40.000,- per hari</b>.</p>
                  <p>• Jika staf mengambil cuti melahirkan unpaid 27 hari: Potongan = 27 × Rp 40.000 = Rp 1.080.000,-.</p>
                  <p>• Jika staf mengambil izin legalitas nikah 2 hari: Potongan = 2 × Rp 40.000 = Rp 80.000,-.</p>
                  <p>• Pada seluruh hari unpaid tersebut, uang makan (Rp 20.000/hari) dan lembur otomatis bernilai Rp 0,-.</p>
                </div>
                <p>
                  2. <b>Sanksi Denda Pelanggaran (SOP-HR-003):</b> Apabila karyawan mengambil libur saat jatah off habis tanpa izin darurat yang disahkan, selain pemotongan prorata upah pokok harian, dikenakan sanksi denda <b>Rp 15.000,-/hari (staf)</b> atau <b>Rp 25.000,-/hari (leader)</b>.
                </p>
              </section>

              {/* PASAL 6: LEMBAR PENGESAHAN DIREKSI */}
              <section id="sop-unp-pasal6" className="space-y-4 pt-2 border-t border-slate-200">
                <div className="text-center space-y-1">
                  <h4 className="font-semibold text-slate-950 text-xs ">LEMBAR PENGESAHAN DOKUMEN RESMI</h4>
                  <p className="text-xs text-slate-500">
                    Ditetapkan di Jakarta pada tanggal 22 Oktober 2026. Menjadi rujukan mutlak klausul Perjanjian Kerja Waktu Tertentu (PKWT) dan sistem HRIS Payroll Barokah Group.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                    <p className="text-xs font-medium text-slate-600">Dibuat Oleh,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-bold text-slate-600 text-sm">Hendra Pratama</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-bold text-slate-900 text-xs">Hendra Pratama, S.E.</p>
                      <p className="text-xs text-slate-500">Head of Payroll &amp; Compensation</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center space-y-2">
                    <p className="text-xs font-medium text-slate-600">Diverifikasi Oleh,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-bold text-slate-600 text-sm">Siti Rahmawati</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-bold text-slate-900 text-xs">Siti Rahmawati, M.M.</p>
                      <p className="text-xs text-slate-500">General Manager HRD</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border-2 border-sky-400 text-center space-y-2 relative overflow-hidden bg-sky-50/20">
                    <span className="absolute top-1 right-1 text-[8px] font-semibold bg-sky-600 text-white px-1.5 py-0.5 rounded uppercase">
                      TERVERIFIKASI
                    </span>
                    <p className="text-xs font-medium text-slate-600">Disetujui &amp; Disahkan,</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic font-semibold text-sky-950 text-sm">H. Bambang Sutrisno</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <p className="font-semibold text-slate-950 text-xs">H. Bambang Sutrisno</p>
                      <p className="text-xs text-sky-800 font-bold">Managing Director - Barokah F&amp;B Group</p>
                    </div>
                  </div>
                </div>
              </section>

            </div>

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs text-slate-500">
                Dokumen ini merupakan acuan resmi pemotongan upah prorata dan cuti khusus kru seluruh unit Barokah Group.
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => showToast('Salinan naskah resmi SOP Hak Libur & Cuti Khusus (SK: 006/HR-LEAVE/2026/BAROKAH) siap dicetak!')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center space-x-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-sky-400" />
                  <span>Cetak / Unduh PDF</span>
                </button>
                <button
                  onClick={() => {
                    setViewingOfficialSopUnpaidDoc(false);
                    setActiveMenu('payroll');
                    showToast('Navigasi ke Modul Penggajian (Payroll) dengan kalkulator pemotongan prorata aktif!');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-ink-800 hover:bg-ink-700 text-white flex items-center space-x-1 shadow-sm"
                >
                  <Wallet className="h-3.5 w-3.5 text-sky-100" />
                  <span>Buka Modul Penggajian</span>
                </button>
                <button
                  onClick={() => setViewingOfficialSopUnpaidDoc(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800"
                >
                  Tutup Naskah SOP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* AI SOP GENERATOR WORKBENCH MODAL                          */}
      {/* ========================================================= */}
      <AiSopModal
        isOpen={isAiSopModalOpen}
        onClose={() => setIsAiSopModalOpen(false)}
        onSaveSop={handleSaveGeneratedSop}
        showToast={showToast}
        employeesCount={employeesMasterList.length}
      />

      {/* ========================================================= */}
      {/* AI GENERATED OFFICIAL SOP VIEWER MODAL                    */}
      {/* ========================================================= */}
      <AiSopOfficialViewerModal
        sop={viewingAiCustomSop}
        onClose={() => setViewingAiCustomSop(null)}
        showToast={showToast}
      />

      {/* ========================================================= */}
      {/* MODAL PENOLAKAN PENGAJUAN LIBUR SESUAI ALASAN SOP 001     */}
      {/* ========================================================= */}

      {/* ========================================================= */}
      {/* MODAL 1: FORM PENERBITAN IZIN RESMI OLEH ADMIN           */}
      {/* ========================================================= */}

      {/* ========================================================= */}
      {/* MODAL 2: DOSSIER SURAT IZIN / DISPENSASI SIAP CETAK        */}
      {/* ========================================================= */}





      {/* ========================================================= */}
      {/* MODAL 3: NASKAH RESMI SK DIREKSI SOP-HR-008                */}
      {/* ========================================================= */}
      {viewingOfficialSop008Doc && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 sm:p-8 shadow-xl space-y-6 max-h-[92vh] overflow-y-auto border border-slate-200 font-sans text-slate-900">
            {/* Header / Kop Surat Resmi Barokah Grup */}
            <div className="relative mb-3">
              <button
                onClick={() => setViewingOfficialSop008Doc(false)}
                className="absolute right-2 top-2 p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl z-10 transition bg-white/80 shadow-xs"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="rounded-xl overflow-hidden shadow-xs border border-amber-200/60 bg-white">
                <img
                  src="/kop-surat-barokah.jpg"
                  alt="Kop Surat Resmi Barokah Grup"
                  className="w-full h-auto object-contain block"
                />
              </div>
            </div>

            {/* Document Metadata Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs">
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  SURAT KEPUTUSAN DIREKSI &amp; STANDAR OPERASIONAL PROSEDUR (SOP)
                </p>
                <p className="font-semibold text-amber-950 text-base">
                  SOP-HR-008: PROSEDUR PENGAJUAN &amp; VERIFIKASI KOREKSI PRESENSI (KELUPAAN CLOCK-IN/CLOCK-OUT) SERTA BATAS TOLERANSI KELALAIAN
                </p>
                <p className="text-slate-600 font-mono text-xs mt-0.5">
                  Nomor Dokumen: <span className="font-bold text-amber-800">008/HR-ATT/2026/BAROKAH</span> | Klasifikasi: Presensi &amp; Perlindungan Upah Resto
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="bg-amber-700 text-white px-3 py-1 rounded-full font-semibold text-xs uppercase shadow-xs inline-block">
                  BERLAKU: 25 OKTOBER 2026
                </span>
                <p className="text-xs text-slate-500 font-mono mt-1">Otoritas Mutlak Web Admin</p>
              </div>
            </div>

            {/* Body of SOP-008 */}
            <div className="space-y-5 text-xs text-slate-800 leading-relaxed">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-semibold text-slate-900 text-sm uppercase">PASAL 1: MUKADIMAH &amp; DEFINISI</h4>
                <p>
                  Dalam operasional restoran multi-outlet dengan beban persiapan dapur (*prepping BOH*) dan penutupan malam (*closing deep cleaning*), kelupaan absensi merupakan kejadian manusiawi. SOP ini dibentuk untuk menjamin hak upah staf yang hadir fisik tetap terlindungi, serta menutup celah manipulasi kehadiran lisan (*fraud*).
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-semibold text-slate-900 text-sm uppercase">PASAL 2: BATAS WAKTU PENGAJUAN (SLA 24 JAM)</h4>
                <p>
                  1. Pengajuan koreksi lupa absen wajib dilaporkan maksimal <strong>H+1 (1x24 jam)</strong> setelah shift kerja berakhir.<br />
                  2. Seluruh pengajuan bulan berjalan wajib selesai sebelum pukul 23:59 WIB pada <strong>Tanggal 5 (Batas Cut-Off Payroll)</strong>. Pengajuan yang melewati batas cut-off terkunci permanen sebagai status Mangkir / Unpaid.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-semibold text-slate-900 text-sm uppercase">PASAL 3: VERIFIKASI DUA LAPIS (ANTI-FRAUD)</h4>
                <p>
                  1. Wajib mencantumkan nama 1 orang <strong>Saksi Fisik Lapangan</strong> (Shift Leader / Rekan Stasiun Resto).<br />
                  2. Admin HR dan Pimpinan Cabang berhak memvalidasi via log transaksi kasir POS atau rekaman CCTV area outlet.<br />
                  3. Otoritas persetujuan mutlak berada <strong>100% pada Web Admin</strong>. Kru dilarang menyetujui koreksinya sendiri.
                </p>
              </div>

              <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 space-y-3">
                <h4 className="font-semibold text-amber-950 text-sm uppercase">PASAL 4: KUOTA TOLERANSI BULANAN &amp; DAMPAK UPAH</h4>
                <div className="border border-amber-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left text-xs divide-y divide-amber-200">
                    <thead className="bg-amber-100/75 text-amber-900 font-bold text-xs">
                      <tr>
                        <th className="p-2">Frekuensi Koreksi / Bln</th>
                        <th className="p-2">Status Kehadiran</th>
                        <th className="p-2">Gaji Pokok Harian</th>
                        <th className="p-2">Uang Makan Dinas (Rp 20.000)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-2 font-bold">Koreksi Ke-1 &amp; Ke-2</td>
                        <td className="p-2 text-emerald-700 font-bold">Hadir Sah (Toleransi Wajar)</td>
                        <td className="p-2 text-emerald-700 font-bold">100% Cair Utuh</td>
                        <td className="p-2 text-emerald-700 font-bold">100% Cair Utuh (Rp 20.000)</td>
                      </tr>
                      <tr className="bg-rose-50/50">
                        <td className="p-2 font-bold text-rose-800">Koreksi Ke-3 &amp; Seterusnya</td>
                        <td className="p-2 text-rose-800 font-bold">Hadir Bersyarat</td>
                        <td className="p-2 text-emerald-700 font-bold">100% Cair Utuh (Hak Dilindungi)</td>
                        <td className="p-2 text-rose-700 font-bold">HANGUS (Rp 0 - Pinalti Kelalaian)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-amber-900 font-semibold">
                  <strong>Prinsip Utama:</strong> Gaji pokok staf TIDAK PERNAH DIPOTONG selama kehadiran fisik terbukti benar. Yang ditiadakan pada kelalaian ke-3 dan seterusnya hanyalah uang makan harian dinas sebagai penegakan kedisiplinan biometrik.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-semibold text-slate-900 text-sm uppercase">PASAL 5: SANKSI KECURANGAN (FRAUD)</h4>
                <p>
                  Karyawan yang terbukti merekayasa kehadiran atau mengajukan koreksi palsu dikenakan sanksi minimum <strong>Surat Peringatan 3 (SP3)</strong> atau <strong>PHK Seketika</strong>. Saksi yang terbukti berkolusi dikenakan sanksi minimum <strong>SP2</strong>.
                </p>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-500 font-medium">
                Ditetapkan di Jakarta, 25 Oktober 2026 • Direksi Barokah Enterprise Grup
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setViewingOfficialSop008Doc(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-300 shadow-sm flex items-center gap-1.5 transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak Dokumen SOP-HR-008</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}




      {/* ========================================================= */}
      {/* 1. MODAL TAMBAH KARYAWAN BARU (+ LIVE USIA & MASA KERJA)  */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* MODAL UNDUH PDF LAPORAN PAYROLL PER OUTLET & FILTER BULAN */}
      {/* ========================================================= */}
      {isExportPdfModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-xl space-y-5 my-8 max-h-[92vh] overflow-y-auto border border-slate-200">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-brand-400 text-slate-950 rounded-xl font-bold shadow-sm">
                  <FileDown className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                    <span>Pusat Cetak &amp; Unduh PDF Laporan Payroll</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      Print-Ready
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pilih cabang outlet spesifik dan filter bulan periode cut-off untuk mengunduh rekap gaji resmi lengkap dengan daftar nama seluruh karyawan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportPdfModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Selection Form */}
            <div className="space-y-4">
              {/* Filter 1: Outlet Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-amber-600" />
                  <span>1. Pilih Cabang Outlet Restoran:</span>
                </label>
                <select
                  value={exportPdfOutlet}
                  onChange={(e) => setExportPdfOutlet(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="SEMUA">Semua Cabang (Konsolidasi Multi-Outlet - {employeesMasterList.length} Kru)</option>
                  {outletsConfigList.map((out) => {
                    const cnt = employeesMasterList.filter(e => e.outlet.toLowerCase().includes(out.name.toLowerCase()) || out.name.toLowerCase().includes(e.outlet.toLowerCase()) || e.outlet.toLowerCase().includes(out.city.toLowerCase())).length;
                    return (
                      <option key={out.id} value={out.name}>{out.name} • {cnt} Kru (Leader: {out.managerName})</option>
                    );
                  })}
                </select>
                <span className="text-xs text-slate-400">
                  {exportPdfOutlet === 'SEMUA'
                    ? 'Menghasilkan laporan konsolidasi seluruh cabang lengkap dengan subtotal per unit outlet.'
                    : `Menghasilkan laporan khusus unit ${exportPdfOutlet} lengkap dengan alamat dan kepala cabang.`}
                </span>
              </div>

              {/* Filter 2: Month Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <span>2. Pilih Filter Bulan Periode Payroll:</span>
                </label>
                <select
                  value={exportPdfMonth}
                  onChange={(e) => setExportPdfMonth(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="Oktober 2026">Oktober 2026 (Periode Aktif • Cut-Off 25 Okt 2026)</option>
                  <option value="September 2026">September 2026 (Cut-Off 25 Sep 2026 • Arsip)</option>
                  <option value="Agustus 2026">Agustus 2026 (Cut-Off 25 Agu 2026 • Arsip)</option>
                  <option value="Juli 2026">Juli 2026 (Cut-Off 25 Jul 2026 • Arsip)</option>
                  <option value="Juni 2026">Juni 2026 (Cut-Off 25 Jun 2026 • Arsip)</option>
                </select>
              </div>

              {/* Filter 3: Checkbox Include Employee Names */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportPdfIncludeEmployeeDetails}
                    onChange={(e) => setExportPdfIncludeEmployeeDetails(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-900">
                    Sertakan Rincian Tabel Nama-Nama Seluruh Karyawan
                  </span>
                </label>
                <p className="text-xs text-slate-500 pl-6 leading-relaxed">
                  Mencantumkan nama lengkap setiap kru, jabatan stasiun kerja (Cook, Kasir, Waiter), rincian Gaji Pokok, Uang Makan (20k/hr), Insentif Libur SOP 001 (+75k/hr), potongan kasbon/denda, dan Take Home Pay (THP) siap transfer.
                </p>
              </div>

              {/* Dynamic Preview Summary Box */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    Preview Ringkasan Dokumen PDF:
                  </span>
                  <span className="text-xs font-mono bg-amber-200 text-amber-950 px-2 py-0.5 rounded font-semibold">
                    Cut-Off: 25 {exportPdfMonth.split(' ')[0]}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block font-medium">Outlet:</span>
                    <span className="font-semibold text-slate-900 truncate block">
                      {exportPdfOutlet === 'SEMUA' ? 'Semua Cabang (4)' : exportPdfOutlet.split(',')[0]}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block font-medium">Bulan:</span>
                    <span className="font-semibold text-slate-900">{exportPdfMonth}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block font-medium">Total Kru:</span>
                    <span className="font-semibold text-emerald-700">
                      {exportPdfOutlet === 'SEMUA'
                        ? `${employeesMasterList.length} Karyawan`
                        : `${employeesMasterList.filter(e => e.outlet.toLowerCase().includes(exportPdfOutlet.toLowerCase()) || exportPdfOutlet.toLowerCase().includes(e.outlet.toLowerCase())).length} Karyawan`}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block font-medium">Estimasi THP:</span>
                    <span className="font-semibold text-amber-700">
                      {exportPdfOutlet === 'SEMUA'
                        ? `Rp ${employeesMasterList.reduce((acc, curr) => acc + (curr.positionKey === 'koki' ? 3000000 : curr.positionKey === 'kasir' ? 2600000 : 2400000), 0).toLocaleString('id-ID')}`
                        : `Rp ${employeesMasterList.filter(e => e.outlet.toLowerCase().includes(exportPdfOutlet.toLowerCase()) || exportPdfOutlet.toLowerCase().includes(e.outlet.toLowerCase())).reduce((acc, curr) => acc + (curr.positionKey === 'koki' ? 3000000 : curr.positionKey === 'kasir' ? 2600000 : 2400000), 0).toLocaleString('id-ID')}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsExportPdfModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDownloadPayrollBudgetPdfFiltered(
                    exportPdfOutlet,
                    exportPdfMonth,
                    exportPdfIncludeEmployeeDetails
                  );
                  setIsExportPdfModalOpen(false);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-brand-400 hover:bg-brand-300 text-slate-950 font-semibold text-xs rounded-xl shadow-sm shadow-amber-500/20 transition flex items-center justify-center space-x-2"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak &amp; Unduh PDF Resmi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddEmployeeModalOpen && (
        <EmployeeDialog
          onClose={() => setIsAddEmployeeModalOpen(false)}
          onSaved={(fullName) => {
            setIsAddEmployeeModalOpen(false);
            showToast(`Karyawan ${fullName} tersimpan.`);
            setEmployeeListKey((k) => k + 1);
            reloadEmployees();
          }}
        />
      )}

      {/* ========================================================= */}
      {/* 2. MODAL IMPORT EXCEL KARYAWAN (.XLSX / .CSV)              */}
      {/* ========================================================= */}
















      {/* ========================================================= */}
      {/* MODAL ALARM PENGINGAT WAKTU SHOLAT & ADZAN OTOMATIS OUTLET */}
      {/* ========================================================= */}
      {prayerAlarmState && prayerAlarmState.active && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-lg max-w-md w-full p-6 text-white shadow-xl relative overflow-hidden space-y-4">
            {/* Background glowing circle */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>

            {/* Header Alarm */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${prayerAlarmState.type === 'ADHAN' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-bounce'}`}></span>
                <span className="text-xs font-semibold  text-amber-400">
                  {prayerAlarmState.type === 'PRE_10_MIN' ? 'Peringatan T-10 Menit Pra-Sholat' : 'Kumandang Azan Waktu Sholat'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPrayerSoundMuted(!prayerSoundMuted)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                  title={prayerSoundMuted ? 'Nyalakan Audio' : 'Heningkan Audio'}
                >
                  {prayerSoundMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400 animate-pulse" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPrayerAlarmState(null)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="text-center space-y-2 py-2">
              <div className="w-16 h-16 mx-auto rounded-lg bg-ink flex items-center justify-center text-3xl shadow-sm ring-4 ring-amber-500/30">
                🕌
              </div>
              <h3 className="text-xl font-semibold text-white">
                {prayerAlarmState.type === 'PRE_10_MIN'
                  ? `Waktu Sholat ${prayerAlarmState.prayerLabel} Masuk 10 Menit Lagi`
                  : `Waktu Sholat ${prayerAlarmState.prayerLabel} Telah Masuk!`}
              </h3>
              <div className="inline-block px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-full text-xs font-semibold text-amber-300 font-mono">
                {prayerAlarmState.cityLabel} • {prayerAlarmState.prayerTime}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                {prayerAlarmState.type === 'PRE_10_MIN'
                  ? `Segera bersiap-siap, ambil wudhu, dan atur rolling giliran sholat dengan rekan tim station agar operasional resto tetap tertib terjaga.`
                  : `Hayya 'alas-Shalah, mari tunaikan sholat ${prayerAlarmState.prayerLabel}. Lakukan pergantian station dengan tertib.`}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setKruPrayerTurnActive(true);
                  setKruPrayerTurnMinutesRemaining(15);
                  setKruPrayerTurnCurrentName(prayerAlarmState.prayerLabel);
                  setPrayerAlarmState(null);
                  showToast(`Giliran sholat ${prayerAlarmState.prayerLabel} dimulai! Timer 15 menit berjalan.`);
                }}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2"
              >
                <span>Ambil Wudhu &amp; Mulai Giliran Sholat (Timer 15 Menit)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrayerAlarmState(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Tutup &amp; Heningkan Alarm
              </button>
            </div>
          </div>
        </div>
      )}












      {/* ========================================================= */}
      {/* MODAL 1: LEMBAR DOKUMEN RAPOR KARYAWAN RESMI (SCORECARD)  */}
      {/* ========================================================= */}
      {selectedReportCardEmp && (() => {
        const report = getEmployeeReportCard(selectedReportCardEmp);
        const tenureData = calculateTenure(selectedReportCardEmp.joinDate);
        const isGradeA = report.grade === 'A';
        const isGradeB = report.grade === 'B+' || report.grade === 'B';
        const emp360 = survey360StaffResponses[selectedReportCardEmp.id] || {
          completed: false,
          averageScore: 0,
          respondentsCount: 0,
          peerScore: 0,
          supervisorScore: 0,
          selfScore: 0,
          scoresBreakdown: [],
          anonymousNotes: [],
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3 sm:p-5 overflow-y-auto print:p-0 print:bg-white print:static">
            <div className="bg-white rounded-lg max-w-4xl w-full shadow-xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] print:max-h-none print:border-none print:shadow-none duration-150">
              
              {/* Header Modal Bar (Non-Printable) */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-white/10 text-slate-200 rounded-lg border border-white/15">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <span>Rapor Penilaian Kinerja Karyawan</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                        {report.docNumber}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300">
                      Evaluasi berkala SDM Barokah Grup • {report.period}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReportCardData({ ...report });
                      setIsEditReportCardModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit Nilai Rapor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-ink-800 hover:bg-ink-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Cetak Rapor (PDF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedReportCardEmp(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Rapor Document Body (Printable) */}
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 bg-white text-slate-900 print:p-0">
                
                {/* Kop Surat Resmi Barokah Grup */}
                <div className="rounded-xl overflow-hidden shadow-xs border border-amber-200/60 mb-4 bg-white">
                  <img
                    src="/kop-surat-barokah.jpg"
                    alt="Kop Surat Resmi Barokah Grup"
                    className="w-full h-auto object-contain block"
                  />
                </div>

                {/* Sub-Header Metadata Rapor */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-slate-900 gap-2">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900 uppercase flex items-center gap-2">
                      <span>LEMBAR EVALUASI RAPOR KINERJA KRU RESTORAN</span>
                      <span className="text-xs font-semibold  bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300 font-mono">
                        DOKUMEN RESMI
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Standar Operasional Penilaian 360° &amp; Manajemen Mutu PT Barokah Kuliner Nusantara
                    </p>
                  </div>
                  <div className="sm:text-right text-xs">
                    <p className="font-mono text-slate-800 font-bold text-xs">No: {report.docNumber}</p>
                    <p className="text-slate-500 text-xs">Tgl Evaluasi: {report.evaluationDate}</p>
                  </div>
                </div>

                {/* Info Biodata Karyawan */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">Nama Karyawan</span>
                    <p className="font-semibold text-slate-900 text-sm">{selectedReportCardEmp.fullName}</p>
                    <p className="text-xs font-mono text-slate-500 font-bold">{selectedReportCardEmp.id} • NIK: {selectedReportCardEmp.nikKtp}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">Posisi &amp; Stasiun</span>
                    <p className="font-semibold text-sky-800">{selectedReportCardEmp.positionTitle}</p>
                    <p className="text-xs text-slate-500">Stasiun: {selectedReportCardEmp.stationKey.toUpperCase()}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">Outlet Penempatan</span>
                    <p className="font-semibold text-slate-900">{selectedReportCardEmp.outlet}</p>
                    <p className="text-xs text-slate-500">Masa Kerja: {tenureData.text}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">Periode Evaluasi</span>
                    <p className="font-semibold text-slate-800">{report.period}</p>
                    <p className="text-xs text-slate-500">Evaluator: {report.evaluatorName.split('&')[0]}</p>
                  </div>
                </div>

                {/* Hero Summary Nilai & Rekomendasi */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card Skor Akhir */}
                  <div className={`p-5 rounded-lg border-2 flex items-center space-x-4 ${
                    isGradeA
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : isGradeB
                      ? 'bg-sky-50/70 border-sky-300'
                      : 'bg-amber-50/70 border-amber-300'
                  }`}>
                    <div className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center font-semibold shrink-0 shadow-sm ${
                      isGradeA
                        ? 'bg-emerald-600 text-white'
                        : isGradeB
                        ? 'bg-ink-800 text-white'
                        : 'bg-amber-500 text-slate-950'
                    }`}>
                      <span className="text-xl leading-none">{report.grade}</span>
                      <span className="text-xs font-mono opacity-80 mt-0.5">{report.totalScore}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold  text-slate-500">
                        Predikat Nilai Akhir
                      </span>
                      <h4 className="text-base font-semibold text-slate-900 mt-0.5">
                        {report.gradeLabel}
                      </h4>
                      <p className="text-xs text-slate-600">
                        Akumulasi 6 pilar kinerja berbobot 100%
                      </p>
                    </div>
                  </div>

                  {/* Card Rekomendasi Manajemen */}
                  <div className="md:col-span-2 p-5 rounded-lg border-2 border-slate-200 bg-slate-50 flex flex-col justify-center space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        REKOMENDASI MANAJEMEN HRD
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        Keputusan Evaluasi Berkala
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-semibold text-slate-950">
                      {report.recommendationLabel}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Berdasarkan data performa presensi, sanitasi HACCP, kepatuhan resep, kelulusan kuis materi training LMS, dan kepuasan pelanggan periode {report.period}.
                    </p>
                  </div>
                </div>

                {/* 6 Komponen Rincian Evaluasi */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold  text-slate-500 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-slate-600" />
                    <span>Rincian Nilai 6 Aspek Kinerja &amp; Pembelajaran F&amp;B</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* 1. Kedisiplinan & Presensi */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-sky-600" />
                          <span>1. Kedisiplinan &amp; Presensi</span>
                          <span className="text-xs font-normal text-slate-500">(Bobot 20%)</span>
                        </span>
                        <span className="font-mono font-semibold text-sm text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          {report.attendanceScore} / 100
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${report.attendanceScore}%` }}></div>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                        <div className="flex justify-between">
                          <span>Tingkat Presensi:</span>
                          <span className="font-bold text-slate-800">{report.attendanceDetails.presenceRate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Akumulasi Keterlambatan:</span>
                          <span className="font-bold text-slate-800">{report.attendanceDetails.lateMinutes} Menit</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Kepatuhan Timer Break:</span>
                          <span className="font-bold text-slate-800">{report.attendanceDetails.breakCompliance}</span>
                        </div>
                        <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-100">
                          &quot;{report.attendanceNotes}&quot;
                        </p>
                      </div>
                    </div>

                    {/* 2. Standar SOP & Kebersihan */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          <span>2. Standar SOP &amp; Higienitas</span>
                          <span className="text-xs font-normal text-slate-500">(Bobot 20%)</span>
                        </span>
                        <span className="font-mono font-semibold text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {report.sopScore} / 100
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${report.sopScore}%` }}></div>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                        <div className="flex justify-between">
                          <span>Standar Grooming &amp; Seragam:</span>
                          <span className="font-bold text-slate-800">{report.sopDetails.grooming}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sanitasi Meja/Station HACCP:</span>
                          <span className="font-bold text-slate-800">{report.sopDetails.haccpSanitation}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Efisiensi / Food Waste:</span>
                          <span className="font-bold text-slate-800">{report.sopDetails.foodWasteEfficiency}</span>
                        </div>
                        <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-100">
                          &quot;{report.sopNotes}&quot;
                        </p>
                      </div>
                    </div>

                    {/* 3. Pelayanan & Hospitality */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-slate-600" />
                          <span>3. Pelayanan &amp; Hospitality</span>
                          <span className="text-xs font-normal text-slate-500">(Bobot 15%)</span>
                        </span>
                        <span className="font-mono font-semibold text-sm text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          {report.hospitalityScore} / 100
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${report.hospitalityScore}%` }}></div>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                        <div className="flex justify-between">
                          <span>Rating Ulasan Tamu / Meja:</span>
                          <span className="font-bold text-slate-800">{report.hospitalityDetails.guestRating}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Karakter Kerja (DISC):</span>
                          <span className="font-bold text-slate-800">{report.hospitalityDetails.discProfile}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Kekompakan Tim Shift:</span>
                          <span className="font-bold text-slate-800">{report.hospitalityDetails.teamCooperation}</span>
                        </div>
                        <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-100">
                          &quot;{report.hospitalityNotes}&quot;
                        </p>
                      </div>
                    </div>

                    {/* 4. Kompetensi & Kecepatan Output */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4 text-amber-600" />
                          <span>4. Kompetensi &amp; Output</span>
                          <span className="text-xs font-normal text-slate-500">(Bobot 15%)</span>
                        </span>
                        <span className="font-mono font-semibold text-sm text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {report.competencyScore} / 100
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-600 h-full rounded-full" style={{ width: `${report.competencyScore}%` }}></div>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                        <div className="flex justify-between">
                          <span>Kecepatan Saji / Transaksi:</span>
                          <span className="font-bold text-slate-800">{report.competencyDetails.speedOfService}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Capaian Target Upsell:</span>
                          <span className="font-bold text-slate-800">{report.competencyDetails.upsellTarget}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Konsistensi Standar Resep:</span>
                          <span className="font-bold text-slate-800">{report.competencyDetails.recipeConsistency}</span>
                        </div>
                        <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-100">
                          &quot;{report.competencyNotes}&quot;
                        </p>
                      </div>
                    </div>

                    {/* 5. Knowledge, Training & Hasil Kuis LMS */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/20 space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <GraduationCap className="h-4 w-4 text-slate-600" />
                          <span>5. Knowledge &amp; Training LMS (Kirkpatrick Level 2 Learning)</span>
                          <span className="text-xs font-normal text-slate-500">(Bobot 15%)</span>
                        </span>
                        <span className="font-mono font-semibold text-sm text-slate-700 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200">
                          {report.knowledgeScore} / 100
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${report.knowledgeScore}%` }}></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 pt-1">
                        <div>
                          <span className="text-xs text-slate-500 block font-medium">Ketuntasan Modul Training:</span>
                          <span className="font-bold text-slate-800">{report.knowledgeDetails.trainingCompletionRate}</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block font-medium">Rata-rata Skor Kuis:</span>
                          <span className="font-bold text-slate-700 font-mono">{report.knowledgeDetails.quizAverageScore} / 100</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block font-medium">Ujian Terakhir Lulus:</span>
                          <span className="font-bold text-slate-800 truncate block">{report.knowledgeDetails.latestQuizPassed}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-200">
                        &quot;{report.knowledgeNotes}&quot;
                      </p>
                    </div>
                  </div>

                  {/* 6. Catatan Disiplin & Penghargaan (Bobot 15%) */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-slate-900 text-amber-400 rounded-lg">
                        <Award className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">6. Rekam Jejak Disiplin &amp; Penghargaan (Bobot 15%)</span>
                        <p className="text-xs text-slate-500">
                          Riwayat Surat Peringatan (SP): <strong>{report.disciplineDetails.spCount} SP</strong> • Sanksi Denda: <strong>{report.disciplineDetails.penaltyCount}x</strong> • Piagam Penghargaan: <strong>{report.disciplineDetails.awardsCount} Piagam</strong>
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-semibold text-sm text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        Skor: {report.disciplineScore} / 100
                      </span>
                    </div>
                  </div>
                </div>

                {/* 7. Hasil Evaluasi Review Multi-Sumber 360° Bulanan (SOP-HR-003) */}
                <div className="p-4 rounded-lg border-2 border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-xs ">
                            7. Evaluasi Multi-Sumber 360° Bulanan (SOP-HR-003)
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            emp360.completed 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {emp360.completed ? '✓ Selesai & Terverifikasi' : 'Belum Mengisi (Gaji Tertunda)'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Penilaian tertutup &amp; 100% anonim (Blind Tokenization) dari atasan, rekan selevel, &amp; penilaian mandiri
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1.5 bg-ink-800 text-white px-3 py-1.5 rounded-xl shadow-xs">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-mono font-semibold text-xs">
                          {emp360.averageScore.toFixed(2)} / 5.00
                        </span>
                        <span className="text-xs text-slate-300 font-bold">
                          ({Math.round((emp360.averageScore / 5) * 100)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tri-Angle Breakdown Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-xs font-bold text-slate-400  block">
                        Rekan Selevel (Peers)
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base font-semibold text-slate-950 font-mono">
                          {emp360.peerScore.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">/ 5.0</span>
                      </div>
                      <span className="text-xs text-emerald-700 font-semibold block">
                        Relasi &amp; Teamwork
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-xs font-bold text-slate-400  block">
                        Atasan (SPV / SM)
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base font-semibold text-slate-950 font-mono">
                          {emp360.supervisorScore.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">/ 5.0</span>
                      </div>
                      <span className="text-xs text-sky-700 font-semibold block">
                        Kepatuhan &amp; Eksekusi
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-xs font-bold text-slate-400  block">
                        Mandiri (Self-Review)
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base font-semibold text-slate-950 font-mono">
                          {emp360.selfScore.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">/ 5.0</span>
                      </div>
                      <span className="text-xs text-slate-700 font-semibold block">
                        Refleksi Diri
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-xs font-bold text-slate-400  block">
                        Panel Penilai
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base font-semibold text-slate-950 font-mono">
                          {emp360.respondentsCount}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">Responden</span>
                      </div>
                      <span className="text-xs text-slate-700 font-semibold block">
                        Blind Tokenized
                      </span>
                    </div>
                  </div>

                  {/* Catatan Ulasan Kualitatif Anonim Rekan Kerja */}
                  {emp360.anonymousNotes && emp360.anonymousNotes.length > 0 && (
                    <div className="bg-white/90 p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-950  flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-slate-600" />
                          <span>Ulasan Kualitatif Anonim Rekan Shift (Tercatat Resmi):</span>
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Identitas Penilai Dirahasiakan Mutlak
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {emp360.anonymousNotes.map((note, idx) => (
                          <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 italic text-slate-700 text-xs leading-relaxed flex items-start space-x-1.5">
                            <span className="text-slate-500 font-bold text-xs shrink-0">&ldquo;</span>
                            <span className="flex-1">{note}</span>
                            <span className="text-slate-500 font-bold text-xs shrink-0">&rdquo;</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Feedback Evaluator & Rencana Pengembangan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                    <span className="text-xs font-bold  text-slate-500 block">
                      Catatan &amp; Umpan Balik Store Manager / HRD:
                    </span>
                    <p className="text-slate-800 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-200/80">
                      &quot;{report.evaluatorFeedback}&quot;
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50/60 rounded-lg border border-slate-200 space-y-1.5">
                    <span className="text-xs font-bold  text-slate-700 block">
                      Rencana Pengembangan Karir (Development Plan):
                    </span>
                    <p className="text-slate-950 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                      {report.developmentPlan}
                    </p>
                  </div>
                </div>

                {/* Lembar Tanda Tangan Digital Bipartit */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
                  <div className="space-y-12">
                    <span className="text-xs text-slate-600 font-medium block">
                      Evaluator Penilai (Store Manager / HRD)
                    </span>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900 underline">{report.evaluatorName}</p>
                      <p className="text-xs text-slate-500 font-mono">Tanda Tangan Digital Resmi Terverifikasi</p>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <span className="text-xs text-slate-600 font-medium block">
                      Karyawan yang Dinilai (Pihak Kedua)
                    </span>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900 underline">{selectedReportCardEmp.fullName}</p>
                      <p className="text-xs text-slate-500 font-mono">NIK: {selectedReportCardEmp.nikKtp}</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer Toolbar */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
                <span className="text-xs text-slate-500">
                  Dokumen evaluasi berkala tersimpan secara aman di database HRIS Barokah Grup.
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReportCardData({ ...report });
                      setIsEditReportCardModalOpen(true);
                    }}
                    className="px-3.5 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Sesuaikan Nilai</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-ink-800 hover:bg-ink-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Cetak PDF Resmi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedReportCardEmp(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    Tutup Rapor
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* MODAL 2: FORM EDIT / PENYESUAIAN NILAI RAPOR KARYAWAN      */}
      {/* ========================================================= */}
      {isEditReportCardModalOpen && editingReportCardData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-xl w-full shadow-xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh] duration-150">
            {/* Header */}
            <div className="p-5 bg-ink text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 text-slate-200 rounded-lg border border-white/15">
                  <Edit2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    Edit &amp; Evaluasi Nilai Rapor Karyawan
                  </h4>
                  <p className="text-xs text-slate-200">
                    {editingReportCardData.employeeName} ({editingReportCardData.employeeId}) • {editingReportCardData.positionTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditReportCardModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Live Preview Skor */}
              <div className="p-4 bg-slate-50/80 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold  text-slate-700">
                    Kalkulasi Skor Otomatis
                  </span>
                  <h5 className="text-lg font-semibold text-slate-900">
                    {editingReportCardData.gradeLabel}
                  </h5>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-semibold text-slate-700 font-mono">
                    {editingReportCardData.totalScore}
                  </span>
                  <span className="block text-xs font-bold text-slate-500">Grade: {editingReportCardData.grade}</span>
                </div>
              </div>

              {/* 6 Input Skor Slider/Number */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <span className="text-xs font-semibold  text-slate-600 block">
                  Penilaian 6 Komponen Kinerja &amp; Pembelajaran (Skor 0 - 100):
                </span>

                {/* 1. Presensi */}
                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>1. Kedisiplinan &amp; Presensi (Bobot 20%)</span>
                    <span className="font-mono text-sky-700">{editingReportCardData.attendanceScore}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={editingReportCardData.attendanceScore}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const res = calculateReportCardFinal(
                        val,
                        editingReportCardData.sopScore,
                        editingReportCardData.hospitalityScore,
                        editingReportCardData.competencyScore,
                        editingReportCardData.disciplineScore,
                        editingReportCardData.knowledgeScore
                      );
                      setEditingReportCardData({
                        ...editingReportCardData,
                        attendanceScore: val,
                        totalScore: res.totalScore,
                        grade: res.grade,
                        gradeLabel: res.gradeLabel,
                      });
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* 2. SOP & Kebersihan */}
                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>2. Standar SOP &amp; Higienitas (Bobot 20%)</span>
                    <span className="font-mono text-emerald-700">{editingReportCardData.sopScore}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={editingReportCardData.sopScore}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const res = calculateReportCardFinal(
                        editingReportCardData.attendanceScore,
                        val,
                        editingReportCardData.hospitalityScore,
                        editingReportCardData.competencyScore,
                        editingReportCardData.disciplineScore,
                        editingReportCardData.knowledgeScore
                      );
                      setEditingReportCardData({
                        ...editingReportCardData,
                        sopScore: val,
                        totalScore: res.totalScore,
                        grade: res.grade,
                        gradeLabel: res.gradeLabel,
                      });
                    }}
                    className="w-full accent-emerald-600"
                  />
                </div>

                {/* 3. Hospitality */}
                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>3. Pelayanan &amp; Hospitality (Bobot 15%)</span>
                    <span className="font-mono text-slate-700">{editingReportCardData.hospitalityScore}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={editingReportCardData.hospitalityScore}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const res = calculateReportCardFinal(
                        editingReportCardData.attendanceScore,
                        editingReportCardData.sopScore,
                        val,
                        editingReportCardData.competencyScore,
                        editingReportCardData.disciplineScore,
                        editingReportCardData.knowledgeScore
                      );
                      setEditingReportCardData({
                        ...editingReportCardData,
                        hospitalityScore: val,
                        totalScore: res.totalScore,
                        grade: res.grade,
                        gradeLabel: res.gradeLabel,
                      });
                    }}
                    className="w-full accent-purple-600"
                  />
                </div>

                {/* 4. Kompetensi Output */}
                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>4. Kompetensi &amp; Kecepatan Output (Bobot 15%)</span>
                    <span className="font-mono text-amber-700">{editingReportCardData.competencyScore}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={editingReportCardData.competencyScore}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const res = calculateReportCardFinal(
                        editingReportCardData.attendanceScore,
                        editingReportCardData.sopScore,
                        editingReportCardData.hospitalityScore,
                        val,
                        editingReportCardData.disciplineScore,
                        editingReportCardData.knowledgeScore
                      );
                      setEditingReportCardData({
                        ...editingReportCardData,
                        competencyScore: val,
                        totalScore: res.totalScore,
                        grade: res.grade,
                        gradeLabel: res.gradeLabel,
                      });
                    }}
                    className="w-full accent-amber-600"
                  />
                </div>

                {/* 5. Knowledge, Training & Kuis LMS */}
                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>5. Knowledge &amp; Kuis LMS (Bobot 15%)</span>
                    <span className="font-mono text-slate-700">{editingReportCardData.knowledgeScore}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={editingReportCardData.knowledgeScore}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const res = calculateReportCardFinal(
                        editingReportCardData.attendanceScore,
                        editingReportCardData.sopScore,
                        editingReportCardData.hospitalityScore,
                        editingReportCardData.competencyScore,
                        editingReportCardData.disciplineScore,
                        val
                      );
                      setEditingReportCardData({
                        ...editingReportCardData,
                        knowledgeScore: val,
                        totalScore: res.totalScore,
                        grade: res.grade,
                        gradeLabel: res.gradeLabel,
                      });
                    }}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* 6. Disiplin */}
                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>6. Rekam Jejak Disiplin (Bobot 15%)</span>
                    <span className="font-mono text-slate-900">{editingReportCardData.disciplineScore}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={editingReportCardData.disciplineScore}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const res = calculateReportCardFinal(
                        editingReportCardData.attendanceScore,
                        editingReportCardData.sopScore,
                        editingReportCardData.hospitalityScore,
                        editingReportCardData.competencyScore,
                        val,
                        editingReportCardData.knowledgeScore
                      );
                      setEditingReportCardData({
                        ...editingReportCardData,
                        disciplineScore: val,
                        totalScore: res.totalScore,
                        grade: res.grade,
                        gradeLabel: res.gradeLabel,
                      });
                    }}
                    className="w-full accent-slate-800"
                  />
                </div>
              </div>

              {/* Pilihan Rekomendasi Manajemen */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Rekomendasi Keputusan Manajemen:
                </label>
                <select
                  value={editingReportCardData.recommendation}
                  onChange={(e) => {
                    const rec = e.target.value as any;
                    let label = 'Direkomendasikan Perpanjang PKWT Periode Berikutnya';
                    if (rec === 'PROMOSI_LEADER') {
                      label = 'Direkomendasikan Promosi Level: Senior Kru / PIC Stasiun';
                    } else if (rec === 'PEMBINAAN_RETRAINING') {
                      label = 'Program Pembinaan & Pelatihan Ulang (Retraining 1 Bulan Evaluasi)';
                    } else if (rec === 'TIDAK_DIPERPANJANG') {
                      label = 'Tidak Direkomendasikan Perpanjangan Kontrak (Selesai Masa PKWT)';
                    }
                    setEditingReportCardData({
                      ...editingReportCardData,
                      recommendation: rec,
                      recommendationLabel: label,
                    });
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="PROMOSI_LEADER">Rekomendasi Promosi ke Senior / Leader Stasiun</option>
                  <option value="PERPANJANG_PKWT">Rekomendasi Perpanjang Kontrak Kerja (PKWT)</option>
                  <option value="PEMBINAAN_RETRAINING">Program Pembinaan &amp; Pelatihan Ulang (Retraining)</option>
                  <option value="TIDAK_DIPERPANJANG">Tidak Direkomendasikan Perpanjang Kontrak</option>
                </select>
              </div>

              {/* Catatan Evaluator */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Catatan &amp; Umpan Balik Evaluator (Store Manager / HRD):
                </label>
                <textarea
                  rows={2}
                  value={editingReportCardData.evaluatorFeedback}
                  onChange={(e) => setEditingReportCardData({ ...editingReportCardData, evaluatorFeedback: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Development Action Plan */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Rencana Pengembangan Karir (Development Plan):
                </label>
                <textarea
                  rows={2}
                  value={editingReportCardData.developmentPlan}
                  onChange={(e) => setEditingReportCardData({ ...editingReportCardData, developmentPlan: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsEditReportCardModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmployeesReportCards((prev) => ({
                    ...prev,
                    [editingReportCardData.employeeId]: editingReportCardData,
                  }));
                  setIsEditReportCardModalOpen(false);
                  showToast(`Rapor performa staf ${editingReportCardData.employeeName} berhasil diperbarui!`);
                }}
                className="px-4 py-2 bg-ink-800 hover:bg-ink-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Simpan Perubahan Rapor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: TAMBAH & EDIT MASTER DATA OUTLET CABANG            */}
      {/* ========================================================= */}

    </AppShell>
  );
}
