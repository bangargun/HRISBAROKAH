'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ChefHat,
  Building2,
  Users,
  Clock,
  Wallet,
  CalendarDays,
  FileCheck2,
  ShieldAlert,
  BrainCircuit,
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  UtensilsCrossed,
  Coffee,
  Coins,
  ArrowLeft,
  ChevronRight,
  SlidersHorizontal,
  Info,
  X,
  AlertTriangle,
} from 'lucide-react';

type MasterSubTab = 'outlets' | 'departments' | 'shifts' | 'payroll' | 'leaves';

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<MasterSubTab>('outlets');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal States
  const [reviewModalData, setReviewModalData] = useState<{ type: string; data: any } | null>(null);
  const [editModalData, setEditModalData] = useState<{ type: string; data: any } | null>(null);
  const [deleteModalData, setDeleteModalData] = useState<{ type: string; id: string; name: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Data Outlet & Geofence (Zero Mock Policy: Persistent State)
  const [outlets, setOutlets] = useState<any[]>([]);

  // 2. Data Departemen & Posisi / Station Resto (Zero Mock Policy: Persistent State)
  const [departments, setDepartments] = useState<any[]>([]);

  // 3. Data Master Jadwal Long Shift Outlet F&B (Zero Mock Policy: Persistent State)
  const [shifts, setShifts] = useState<any[]>([]);

  const hasLoadedMasterRef = useRef(false);

  useEffect(() => {
    try {
      const savedOutlets = localStorage.getItem('hris_master_outlets');
      if (savedOutlets) setOutlets(JSON.parse(savedOutlets));

      const savedDepts = localStorage.getItem('hris_master_departments');
      if (savedDepts) setDepartments(JSON.parse(savedDepts));

      const savedShifts = localStorage.getItem('hris_master_shifts');
      if (savedShifts) setShifts(JSON.parse(savedShifts));
    } catch (e) {
      console.error('Error loading master data from localStorage:', e);
    }
    hasLoadedMasterRef.current = true;
  }, []);

  useEffect(() => {
    if (hasLoadedMasterRef.current) {
      try {
        localStorage.setItem('hris_master_outlets', JSON.stringify(outlets));
      } catch (e) {
        console.error('Error saving outlets:', e);
      }
    }
  }, [outlets]);

  useEffect(() => {
    if (hasLoadedMasterRef.current) {
      try {
        localStorage.setItem('hris_master_departments', JSON.stringify(departments));
      } catch (e) {
        console.error('Error saving departments:', e);
      }
    }
  }, [departments]);

  useEffect(() => {
    if (hasLoadedMasterRef.current) {
      try {
        localStorage.setItem('hris_master_shifts', JSON.stringify(shifts));
      } catch (e) {
        console.error('Error saving shifts:', e);
      }
    }
  }, [shifts]);

  // Form State untuk Tambah Jadwal Long Shift Baru
  const [newShiftFormData, setNewShiftFormData] = useState({
    id: '',
    outletName: '',
    name: '',
    weekdayOpenTime: '10:00',
    weekdayCloseTime: '22:00',
    weekdayShiftStart: '09:00',
    weekdayShiftEnd: '22:30',
    weekdayBreak: '2 Jam (120 Menit)',
    weekendOpenTime: '09:00',
    weekendCloseTime: '23:00',
    weekendShiftStart: '08:00',
    weekendShiftEnd: '23:30',
    weekendBreak: '3 Jam (180 Menit)',
    status: 'AKTIF',
    description: '',
  });

  // 4. Data Master Komponen Payroll & Service Charge
  const [payrollRules, setPayrollRules] = useState([
    {
      id: 'PR-01',
      componentName: 'Gaji Pokok & Upah Terhitung Cuti Tahunan (SOP-HR-007)',
      type: 'Upah Tetap Bulanan',
      formula: 'Masa Kerja < 3 Bln Rp 1.000.000, >= 3 Bln Rp 1.200.000 (100% Dibayar Saat Cuti Tahunan Sah)',
      taxable: 'Ya (PPh 21)',
      notes: 'Upah pokok harian tetap dibayar penuh (terhitung) saat staf mengambil Cuti Tahunan Berjenjang resmi.',
    },
    {
      id: 'PR-02',
      componentName: 'Uang Makan Harian Kehadiran Fisik',
      type: 'Tunjangan Harian Kehadiran',
      formula: 'Rp 20.000 / Hari Kehadiran Fisik Valid di Outlet',
      taxable: 'Tidak',
      notes: 'Hanya cair untuk hari kerja hadir riil. Ditiadakan (Rp 0) pada hari libur reguler, cuti tahunan, sakit, dan cuti unpaid.',
    },
    {
      id: 'PR-03',
      componentName: 'Tunjangan Lama Bekerja (SOP-HR-005)',
      type: 'Tunjangan Masa Kerja Tetap',
      formula: 'Bln 1-6 Rp 0; Bln 7-12 Rp 100k; Bln 13-18 Rp 200k; Bln 19-24 Rp 250k; +Rp 50k per 6 bulan seterusnya',
      taxable: 'Ya (PPh 21)',
      notes: 'Dicairkan pada periode +1 bulan setelah masa kerja terpenuhi. Tetap cair utuh saat cuti tahunan resmi.',
    },
    {
      id: 'PR-04',
      componentName: 'Potongan Cuti Unpaid / Di Luar Tanggungan (SOP-HR-006)',
      type: 'Potongan Prorata Harian',
      formula: '(Gaji Pokok / 30 Hari) x Jumlah Hari Unpaid',
      taxable: '-',
      notes: 'Berlaku untuk: sisa duka inti (4 hari), melahirkan (27 hari), keguguran (11 hari), urus nikah/cerai (2 hari), umroh (14 hari), dan sakit rawat inap > 3 hari.',
    },
    {
      id: 'PR-05',
      componentName: 'Kompensasi Insentif Libur Tidak Diambil (SOP-001/006)',
      type: 'Pendapatan Tambahan',
      formula: 'Rp 75.000 / Hari Off Reguler Tidak Diambil (Maksimal Rp 150.000 / Bulan)',
      taxable: 'Ya (PPh 21)',
      notes: 'Kompensasi bagi staf yang secara sukarela masuk kerja pada jatah 2 hari libur reguler bulanannya.',
    },
    {
      id: 'PR-06',
      componentName: 'Denda Pelanggaran Libur & Kehadiran (SOP-HR-003)',
      type: 'Potongan Kedisiplinan',
      formula: 'Weekend Rp 200k; Libur Nas/Peak Season Rp 250k; Mendadak <H-3 Rp 50k; Jatah Habis Rp 15k (staf) / Rp 25k (leader)',
      taxable: '-',
      notes: 'Dikenakan bila melanggar jadwal libur outlet. Libur nasional wajib ada konfirmasi SK/edaran Peak Season Perusahaan.',
    },
    {
      id: 'PR-07',
      componentName: 'Potongan Cicilan Kasbon Karyawan (SOP-HR-002/004)',
      type: 'Potongan Pinjaman',
      formula: 'Cicilan Bulanan Disetujui HR (Maksimal 50% Gaji Pokok)',
      taxable: '-',
      notes: 'SOP-HR-004 Pasal 4.2: Karyawan baru yang belum genap 3 bulan bekerja dilarang keras mengajukan kasbon.',
    },
    {
      id: 'PR-08',
      componentName: 'Ketentuan Resign Tengah Jalan / Wanprestasi (SOP-HR-003/006/007 & Kontrak CLS-008)',
      type: 'Kebijakan Pengakhiran Kerja',
      formula: 'Gaji Berjalan Rp 0 (Hangus) + Seluruh Tunjangan Rp 0 + Pesangon Rp 0',
      taxable: '-',
      notes: 'Bagi kru/staf yang resign sepihak sebelum masa kontrak PKWT berakhir, perusahaan tidak berkewajiban membayar pesangon maupun sisa gaji/tunjangan berjalan; seluruh hak finansial gugur/hangus sebagai kompensasi ganti rugi operasional.',
    },
    {
      id: 'PR-09',
      componentName: 'Ketentuan Izin Pulang Setengah Hari (SOP Operasional Bab 5)',
      type: 'Ketentuan Kehadiran Parsial',
      formula: '>50% Shift Weekday: Upah Pokok Harian Dapat, Uang Makan & Lembur Rp 0; Weekend 25-50% Denda Rp 100k; <25% Mangkir SP1 (+ Denda Rp 200k Weekend)',
      taxable: 'Ya (PPh 21 jika berlaku)',
      notes: 'Izin pulang setengah hari (>50% shift) pada weekday tetap mempertahankan gaji pokok harian, namun uang makan dinas Rp 20.000 ditiadakan otomatis.',
    },
  ]);

  // 5. Data Master Jenis Cuti & Izin (Tersinkronisasi SOP-HR-006 & SOP-HR-007)
  const [leaveTypes, setLeaveTypes] = useState([
    {
      id: 'LV-01',
      name: 'Cuti Tahunan Berjenjang (SOP-HR-007)',
      quota: '1 Hari / Thn Masa Kerja (1 thn=1h, 2 thn=2h, dst - 100% Paid)',
      reduceQuota: 'Ya (Saldo Cuti Tahunan)',
      requiresAttachment: 'Tidak (Persetujuan SPV & HRD)',
      minDaysNotice: 'H-7 Pengajuan (Larangan: Reguler, Weekend, Tgl Merah, Lebaran)',
    },
    {
      id: 'LV-02',
      name: 'Libur Reguler Operasional Resto (SOP-HR-001/003/006)',
      quota: '2 Hari / Bulan Kalender (Weekday)',
      reduceQuota: 'Ya (Jatah Off Bulanan)',
      requiresAttachment: 'Tidak',
      minDaysNotice: 'H-3 Pengajuan (Insentif Rp 75rb/hari jika tidak diambil)',
    },
    {
      id: 'LV-03',
      name: 'Sakit Rawat Inap RS / Opname (SOP-HR-006)',
      quota: 'Maksimal 3 Hari Pertama Paid (Hari ke-4 dst Unpaid)',
      reduceQuota: 'Tidak',
      requiresAttachment: 'Ya (Surat Rawat Inap & Kwitansi Resmi RS)',
      minDaysNotice: 'Hari H (Maks 1x24 Jam Notifikasi)',
    },
    {
      id: 'LV-04',
      name: 'Cuti Khusus Karyawan Menikah (SOP-HR-006)',
      quota: '3 Hari Kerja (100% Paid)',
      reduceQuota: 'Tidak (Cuti Khusus)',
      requiresAttachment: 'Ya (Undangan & Buku Nikah Resmi)',
      minDaysNotice: 'H-14 Pengajuan',
    },
    {
      id: 'LV-05',
      name: 'Duka Cita Keluarga Inti (SOP-HR-006)',
      quota: 'Total 7 Hari (3 Hari Pertama Paid, 4 Hari Unpaid)',
      reduceQuota: 'Tidak',
      requiresAttachment: 'Ya (Surat Kematian RT & Kartu Keluarga)',
      minDaysNotice: 'Hari H (Darurat)',
    },
    {
      id: 'LV-06',
      name: 'Cuti Melahirkan Karyawati (SOP-HR-006)',
      quota: '30 Hari (3 Hari Pertama Paid, 27 Hari Unpaid Prorata / 30)',
      reduceQuota: 'Tidak',
      requiresAttachment: 'Ya (Surat Keterangan Bersalin Medis)',
      minDaysNotice: 'H-14 Pengajuan',
    },
    {
      id: 'LV-07',
      name: 'Cuti Keguguran Karyawati (SOP-HR-006)',
      quota: '14 Hari (3 Hari Pertama Paid, 11 Hari Unpaid Prorata / 30)',
      reduceQuota: 'Tidak',
      requiresAttachment: 'Ya (Surat Keterangan Kuret/Tindakan Medis RS)',
      minDaysNotice: 'Hari H (Darurat)',
    },
    {
      id: 'LV-08',
      name: 'Ibadah Umroh ke Tanah Suci (SOP-HR-006)',
      quota: '14 Hari Unpaid Penuh (Di Luar Tanggungan)',
      reduceQuota: 'Tidak',
      requiresAttachment: 'Ya (Tiket & Jadwal Travel Umroh Resmi)',
      minDaysNotice: 'H-30 Pengajuan',
    },
    {
      id: 'LV-09',
      name: 'Legalitas Pernikahan / Perceraian (SOP-HR-006)',
      quota: '2 Hari Kerja Unpaid Penuh (Di Luar Tanggungan)',
      reduceQuota: 'Tidak',
      requiresAttachment: 'Ya (Surat Panggilan KUA / Pengadilan / Catatan Sipil)',
      minDaysNotice: 'H-7 Pengajuan',
    },
    {
      id: 'LV-10',
      name: 'Dispensasi Musibah Bencana (SOP-HR-006)',
      quota: 'Kebakaran 3 Hari / Banjir 2 Hari (100% Paid)',
      reduceQuota: 'Tidak',
      requiresAttachment: 'Ya (Foto Dokumentasi & Surat RT/RW/Polsek)',
      minDaysNotice: 'Hari H (Darurat)',
    },
    {
      id: 'LV-11',
      name: 'Izin Pulang Setengah Hari / Parsial (SOP Operasional Bab 5)',
      quota: 'Maks. 4 Jam Kerja / Sesi (>50% Shift Weekday: Upah Pokok Tetap Dapat)',
      reduceQuota: 'Tidak (Uang Makan & Lembur Hangus)',
      requiresAttachment: 'Form Izin Pulang + Konfirmasi Kru Cover Station',
      minDaysNotice: 'H-1 (Terencana) / Segera Lapor ke SPV (Darurat)',
    },
  ]);

  // Handle Save New Long Shift
  const handleSaveNewShift = (e: React.FormEvent) => {
    e.preventDefault();
    const created = {
      ...newShiftFormData,
      id: newShiftFormData.id || `LS-0${shifts.length + 1}`,
    };
    setShifts([...shifts, created]);
    showToast(`Jadwal Long Shift "${created.name}" untuk ${created.outletName} berhasil disimpan!`);
    setShowAddModal(false);
  };

  // Handle Edit Submit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalData) return;

    const { type, data } = editModalData;
    if (type === 'outlets') {
      setOutlets(outlets.map((o) => (o.id === data.id ? data : o)));
      showToast(`Data cabang ${data.name} berhasil diperbarui!`);
    } else if (type === 'departments') {
      setDepartments(departments.map((d) => (d.id === data.id ? data : d)));
      showToast(`Data station ${data.title} berhasil diperbarui!`);
    } else if (type === 'shifts') {
      setShifts(shifts.map((s) => (s.id === data.id ? data : s)));
      showToast(`Jadwal shift ${data.name} berhasil diperbarui!`);
    } else if (type === 'payroll') {
      setPayrollRules(payrollRules.map((p) => (p.id === data.id ? data : p)));
      showToast(`Aturan ${data.componentName} berhasil diperbarui!`);
    } else if (type === 'leaves') {
      setLeaveTypes(leaveTypes.map((l) => (l.id === data.id ? data : l)));
      showToast(`Jenis cuti ${data.name} berhasil diperbarui!`);
    }

    setEditModalData(null);
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = () => {
    if (!deleteModalData) return;
    const { type, id, name } = deleteModalData;

    if (type === 'outlets') {
      setOutlets(outlets.filter((o) => o.id !== id));
    } else if (type === 'departments') {
      setDepartments(departments.filter((d) => d.id !== id));
    } else if (type === 'shifts') {
      setShifts(shifts.filter((s) => s.id !== id));
    } else if (type === 'payroll') {
      setPayrollRules(payrollRules.filter((p) => p.id !== id));
    } else if (type === 'leaves') {
      setLeaveTypes(leaveTypes.filter((l) => l.id !== id));
    }

    showToast(`Data "${name}" berhasil dihapus dari sistem!`);
    setDeleteModalData(null);
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans antialiased overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 text-xs border border-slate-700 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. LEFT SIDEBAR                                           */}
      {/* ========================================================= */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800 z-20">
        <div className="h-16 flex items-center px-5 border-b border-slate-800/80 bg-slate-950/40">
          <div className="bg-amber-500 p-2 rounded-xl text-slate-950 mr-3 shadow-md shadow-amber-500/20">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">HRIS RESTORAN</h1>
            <p className="text-[11px] text-amber-400/90 font-medium">Multi-Outlet Culinary</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Navigasi Utama
          </div>

          <Link
            href="/"
            className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
          >
            <Clock className="h-4 w-4 text-slate-400" />
            <span>Dashboard Operasional</span>
          </Link>

          <button
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 shadow-md transition-all"
          >
            <div className="flex items-center space-x-2.5">
              <SlidersHorizontal className="h-4 w-4 text-slate-950" />
              <span>Master Data Pusat</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase bg-slate-950 text-amber-400">
              Aktif
            </span>
          </button>

          <div className="pt-4 px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Modul Terkait
          </div>

          <Link
            href="/"
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
          >
            <Users className="h-4 w-4" />
            <span>Karyawan &amp; Divisi</span>
          </Link>
          <Link
            href="/"
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
          >
            <Wallet className="h-4 w-4" />
            <span>Payroll &amp; Kasbon</span>
          </Link>
          <Link
            href="/"
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
          >
            <FileCheck2 className="h-4 w-4" />
            <span>Pustaka SOP Resto</span>
          </Link>
          <Link
            href="/"
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Sanksi &amp; Disiplin (SP)</span>
          </Link>
        </div>

        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-xs">
              HR
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">Admin HR Pusat</p>
              <p className="text-[10px] text-slate-400">Master Data Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN CONTENT AREA                                      */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2 text-xs">
            <Link href="/" className="text-slate-400 hover:text-slate-700 flex items-center font-medium">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Kembali ke Dashboard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800">Master Data &amp; Konfigurasi Restoran</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari master data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 w-48"
              />
            </div>
          </div>
        </header>

        {/* Sub-Tabs Bar */}
        <div className="bg-white border-b border-slate-200 px-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <SlidersHorizontal className="h-5 w-5 text-amber-500 mr-2" />
                Manajemen Master Data Restoran
              </h2>
              <p className="text-xs text-slate-500">
                Pusat konfigurasi outlet cabang, geofencing GPS, struktur station dapur/service, shift kerja, dan aturan payroll.
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center space-x-1.5 shadow-sm self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>
                {activeTab === 'outlets' && 'Tambah Cabang Resto'}
                {activeTab === 'departments' && 'Tambah Station Posisi'}
                {activeTab === 'shifts' && 'Tambah Jadwal Shift'}
                {activeTab === 'payroll' && 'Tambah Komponen Payroll'}
                {activeTab === 'leaves' && 'Tambah Jenis Cuti'}
              </span>
            </button>
          </div>

          {/* Sub-Tabs Navigation */}
          <div className="flex space-x-1 border-t border-slate-100 pt-2 -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('outlets')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap flex items-center space-x-2 ${
                activeTab === 'outlets'
                  ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Master Outlet &amp; GPS Geofence</span>
              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold">{outlets.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('departments')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap flex items-center space-x-2 ${
                activeTab === 'departments'
                  ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              <span>Departemen &amp; Station Dapur/Service</span>
              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold">{departments.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap flex items-center space-x-2 ${
                activeTab === 'shifts'
                  ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Jadwal Shift &amp; Istirahat Resto</span>
              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold">{shifts.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('payroll')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap flex items-center space-x-2 ${
                activeTab === 'payroll'
                  ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Coins className="h-3.5 w-3.5" />
              <span>Komponen Payroll &amp; Service Charge</span>
            </button>

            <button
              onClick={() => setActiveTab('leaves')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap flex items-center space-x-2 ${
                activeTab === 'leaves'
                  ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Jenis Cuti &amp; Izin Dokter</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================= */}
          {/* SUB-TAB 1: MASTER OUTLET & GEOFENCE                      */}
          {/* ========================================================= */}
          {activeTab === 'outlets' && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-900">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold">Informasi Geofencing:</span> Karyawan hanya dapat melakukan presensi di aplikasi jika berada dalam radius meter cabang. Gunakan tombol <b>Review</b> untuk melihat detail koordinat, <b>Edit</b> untuk mengubah radius, atau <b>Delete</b> untuk menghapus cabang.
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-3 px-4">Kode &amp; Nama Cabang</th>
                      <th className="py-3 px-4">Jam Kerja &amp; Operasional</th>
                      <th className="py-3 px-4">Siklus Cut-Off &amp; Gajian</th>
                      <th className="py-3 px-4">Koordinat &amp; Geofence</th>
                      <th className="py-3 px-4">Total Staf</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {outlets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <div className="p-3 bg-amber-50 rounded-full text-amber-600">
                              <Building2 className="h-8 w-8" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">Belum Ada Data Cabang Outlet</p>
                              <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                                Seluruh mock data telah dibersihkan secara permanen. Tambahkan cabang outlet restoran riil pertama Anda.
                              </p>
                            </div>
                            <button
                              onClick={() => setShowAddModal(true)}
                              className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                            >
                              + Tambah Cabang Outlet Baru
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      outlets.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 text-sm">{o.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{o.code}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">{o.address}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs space-y-0.5">
                          <div className="text-slate-700"><span className="text-slate-400 font-semibold">Buka:</span> <b className="text-slate-900">{o.operatingHoursWeekday || '11:00-22:00'}</b></div>
                          <div className="text-slate-700"><span className="text-slate-400 font-semibold">Kerja:</span> <b className="text-amber-800">{o.workHours || '10:00-23:00'}</b></div>
                          <div className="text-[10px] text-slate-500">Istirahat {o.breakHours || 2} Jam • Closing {o.closingHours || '23:00'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs space-y-1 font-mono">
                          <div><span className="text-[10px] bg-slate-100 text-slate-800 font-bold px-1.5 py-0.5 rounded border border-slate-200">Cut-Off: Tgl {o.cutoffDate || 5}</span></div>
                          <div><span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-300">Payday: Tgl {o.paydayDate || 10}</span></div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 text-xs">
                          <div>Lat: {o.lat} • Lng: {o.lng}</div>
                          <span className="inline-block mt-0.5 bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold text-[10px]">
                            Radius {o.radius}m
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {o.totalStaff} Orang
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              o.status === 'AKTIF'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center space-x-1.5">
                            {/* Tombol Review */}
                            <button
                              onClick={() => setReviewModalData({ type: 'outlets', data: o })}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors title='Review / Detail'"
                              title="Review / Detail"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {/* Tombol Edit */}
                            <button
                              onClick={() => setEditModalData({ type: 'outlets', data: { ...o } })}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors title='Edit Data'"
                              title="Edit Data"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {/* Tombol Delete */}
                            <button
                              onClick={() => setDeleteModalData({ type: 'outlets', id: o.id, name: o.name })}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors title='Hapus Cabang'"
                              title="Hapus Cabang"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SUB-TAB 2: DEPARTEMEN & STATION POSISI                   */}
          {/* ========================================================= */}
          {activeTab === 'departments' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="py-3 px-4">Departemen / Divisi</th>
                    <th className="py-3 px-4">Nama Posisi &amp; Station</th>
                    <th className="py-3 px-4">Kategori Peran</th>
                    <th className="py-3 px-4">Standar Gaji Pokok (Berdasarkan Masa Kerja)</th>
                    <th className="py-3 px-4">Jumlah Staf</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="p-3 bg-amber-50 rounded-full text-amber-600">
                            <ChefHat className="h-8 w-8" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Belum Ada Data Departemen / Posisi</p>
                            <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                              Seluruh mock data telah dibersihkan secara permanen. Tambahkan departemen dan standar gaji station riil Anda.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                          >
                            + Tambah Departemen / Station Baru
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    departments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{d.department}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{d.title}</div>
                        <div className="text-[10px] font-mono text-slate-400">{d.id}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{d.category}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 font-semibold border border-amber-200">0 - 3 Bulan:</span>
                            <span className="font-semibold text-emerald-700">{d.salaryUnder3Months}</span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">&gt; 3 Bulan:</span>
                            <span className="font-bold text-emerald-800">{d.salaryOver3Months}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-700">{d.activeStaff} Staf</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setReviewModalData({ type: 'departments', data: d })}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Review / Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditModalData({ type: 'departments', data: { ...d } })}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Data"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModalData({ type: 'departments', id: d.id, name: d.title })}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Posisi"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================= */}
          {/* SUB-TAB 3: JADWAL LONG SHIFT OUTLET                      */}
          {/* ========================================================= */}
          {activeTab === 'shifts' && (
            <div className="space-y-4">
              {/* Header Info & Quick Action */}
              <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/30 border border-amber-200/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold shadow-sm mt-0.5">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      Jadwal Long Shift Terintegrasi Outlet Resto
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold border border-amber-300">
                        Buka - Tutup Manual
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Kelola jam buka-tutup outlet dan rentang jam kerja kru long shift secara manual untuk <strong>Hari Biasa (Senin - Jumat)</strong> serta <strong>Weekend (Sabtu - Minggu) &amp; Libur Nasional</strong>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow-sm whitespace-nowrap self-start md:self-auto transition-all"
                >
                  <Plus className="h-4 w-4 text-amber-400" />
                  <span>Tambah Jadwal Long Shift</span>
                </button>
              </div>

              {/* Tabel Jadwal Long Shift */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-3 px-4">Outlet &amp; Nama Shift</th>
                      <th className="py-3 px-4">Hari Biasa (Senin - Jumat)</th>
                      <th className="py-3 px-4">Weekend &amp; Libur Nasional</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Catatan Operasional</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shifts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <div className="p-3 bg-amber-50 rounded-full text-amber-600">
                              <Clock className="h-8 w-8" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">Belum Ada Jadwal Long Shift</p>
                              <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                                Seluruh mock data telah dibersihkan secara permanen. Tambahkan konfigurasi jam buka-tutup dan jam kerja shift riil.
                              </p>
                            </div>
                            <button
                              onClick={() => setShowAddModal(true)}
                              className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                            >
                              + Tambah Jadwal Long Shift Baru
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      shifts.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5 mb-1">
                            <Building2 className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-bold text-slate-900 text-xs">{s.outletName}</span>
                          </div>
                          <div className="font-semibold text-slate-700 text-[11px]">{s.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{s.id}</div>
                        </td>

                        {/* Hari Biasa */}
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 space-y-1">
                            <div className="flex items-center justify-between text-slate-700">
                              <span className="text-[10px] font-sans font-semibold text-amber-800">Buka - Tutup:</span>
                              <span className="font-bold text-slate-900">{s.weekdayOpenTime} - {s.weekdayCloseTime} WIB</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-700">
                              <span className="text-[10px] font-sans font-semibold text-blue-700">Shift Kru:</span>
                              <span className="font-bold text-blue-900">{s.weekdayShiftStart} - {s.weekdayShiftEnd} WIB</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-700 border-t border-amber-100/80 pt-1 text-[10px]">
                              <span className="font-sans font-semibold">Waktu Istirahat:</span>
                              <span className="font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-300">
                                {s.weekdayBreak}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Weekend & Libur Nasional */}
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <div className="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 space-y-1">
                            <div className="flex items-center justify-between text-slate-700">
                              <span className="text-[10px] font-sans font-semibold text-rose-800">Buka - Tutup:</span>
                              <span className="font-bold text-slate-900">{s.weekendOpenTime} - {s.weekendCloseTime} WIB</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-700">
                              <span className="text-[10px] font-sans font-semibold text-purple-700">Shift Kru:</span>
                              <span className="font-bold text-purple-900">{s.weekendShiftStart} - {s.weekendShiftEnd} WIB</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-700 border-t border-rose-100/80 pt-1 text-[10px]">
                              <span className="font-sans font-semibold">Waktu Istirahat:</span>
                              <span className="font-bold text-purple-900 bg-purple-100/80 px-1.5 py-0.5 rounded border border-purple-300">
                                {s.weekendBreak}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === 'AKTIF'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>

                        {/* Keterangan */}
                        <td className="py-3.5 px-4 max-w-xs text-slate-600 text-[11px] leading-relaxed">
                          {s.description}
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => setReviewModalData({ type: 'shifts', data: s })}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Review / Detail Shift"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditModalData({ type: 'shifts', data: { ...s } })}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit Jam Long Shift"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteModalData({ type: 'shifts', id: s.id, name: s.name })}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus Jadwal"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>

              {/* Card Ketentuan Durasi Istirahat 2 Jam vs 3 Jam & Rolling Break 12:00 - 18:00 WIB */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-5 text-white shadow-md space-y-4 border border-slate-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        Kebijakan Master Data Resto
                      </span>
                      <span className="text-slate-400 text-xs font-mono">
                        Window Istirahat 12:00 - 18:00 WIB
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-white">
                      Ketentuan Durasi Istirahat: 2 Jam atau 3 Jam (Tergantung Jam Kerja Outlet)
                    </h4>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      Waktu istirahat staf ditetapkan sebesar <strong>2 Jam atau 3 Jam</strong> berdasarkan total rentang jam buka operasional outlet. Seluruh jadwal dirotasi secara otomatis acak pada rentang pukul <strong>12:00 siang hingga 18:00 sore</strong>.
                    </p>
                  </div>

                  <Link
                    href="/"
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow whitespace-nowrap self-start sm:self-auto transition-all"
                  >
                    <span>Buka Monitor &amp; Generator Istirahat</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Matriks Standar 2 Jam vs 3 Jam */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Matriks Standar Durasi Istirahat Sesuai Jam Kerja Outlet
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-[12px]">Kategori A: Jam Buka Outlet ≤ 12 Jam</span>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-extrabold rounded text-[11px] border border-emerald-500/30">
                          Istirahat 2 Jam (120 Menit)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Berlaku umum untuk <strong>Hari Biasa (Weekday)</strong> dengan jam buka standar (misal 10:00 - 22:00 WIB atau 11:00 - 23:00 WIB). Istirahat dibagi dalam sesi rotasi siang dan sore.
                      </p>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-[12px]">Kategori B: Jam Buka Outlet &gt; 12 Jam</span>
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 font-extrabold rounded text-[11px] border border-purple-500/30">
                          Istirahat 3 Jam (180 Menit)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Berlaku untuk <strong>Weekend (Sabtu-Minggu) &amp; Libur Nasional</strong> atau outlet mall dengan jam buka panjang (misal 08:00 - 23:00 atau 08:00 - 00:00 WIB). Memastikan staf tetap bugar.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3 Ketentuan Wajib per Kloter */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="font-bold text-amber-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      1. Wajib Bagian Produksi
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Setiap kloter istirahat wajib memuat staf dapur (Cook / Prep / BOH) agar dapur tidak pernah kosong saat pesanan masuk.
                    </p>
                  </div>

                  <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="font-bold text-blue-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      2. Wajib Bagian Waiters
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Setiap kloter istirahat wajib memuat staf service (Waiters / FOH) agar pelayanan tamu meja makan tetap terjaga.
                    </p>
                  </div>

                  <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="font-bold text-pink-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                      3. Wajib Kasir / Staf Perempuan
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Setiap kloter wajib memuat kasir atau staf perempuan demi kelancaran operasional POS transaksi dan rotasi yang proporsional.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SUB-TAB 4: KOMPONEN PAYROLL & SERVICE CHARGE              */}
          {/* ========================================================= */}
          {activeTab === 'payroll' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="py-3 px-4">Nama Komponen</th>
                    <th className="py-3 px-4">Tipe Komponen</th>
                    <th className="py-3 px-4">Rumus / Formula</th>
                    <th className="py-3 px-4">Pajak PPh 21</th>
                    <th className="py-3 px-4">Keterangan Khusus F&amp;B</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrollRules.map((pr) => (
                    <tr key={pr.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{pr.componentName}</td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                          {pr.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-emerald-700 max-w-xs">{pr.formula}</td>
                      <td className="py-3.5 px-4">{pr.taxable}</td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs">{pr.notes}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setReviewModalData({ type: 'payroll', data: pr })}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Review Aturan"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditModalData({ type: 'payroll', data: { ...pr } })}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Aturan"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModalData({ type: 'payroll', id: pr.id, name: pr.componentName })}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Aturan"
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
          )}

          {/* ========================================================= */}
          {/* SUB-TAB 5: JENIS CUTI & IZIN                             */}
          {/* ========================================================= */}
          {activeTab === 'leaves' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="py-3 px-4">Jenis Cuti / Izin</th>
                    <th className="py-3 px-4">Alokasi Kuota</th>
                    <th className="py-3 px-4">Memotong Saldo Cuti</th>
                    <th className="py-3 px-4">Wajib Dokumen / Surat</th>
                    <th className="py-3 px-4">Batas Minimal Pengajuan</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaveTypes.map((lt) => (
                    <tr key={lt.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{lt.name}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">{lt.quota}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            lt.reduceQuota === 'Ya' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {lt.reduceQuota}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{lt.requiresAttachment}</td>
                      <td className="py-3.5 px-4 text-slate-600">{lt.minDaysNotice}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setReviewModalData({ type: 'leaves', data: lt })}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Review Cuti"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditModalData({ type: 'leaves', data: { ...lt } })}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Cuti"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModalData({ type: 'leaves', id: lt.id, name: lt.name })}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Cuti"
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
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* 3. MODAL REVIEW / DETAIL                                  */}
      {/* ========================================================= */}
      {reviewModalData && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Detail &amp; Review Record</h3>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                    Kategori: {reviewModalData.type.toUpperCase()}
                  </p>
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
              {Object.entries(reviewModalData.data).map(([key, val]) => {
                const fieldLabels: Record<string, string> = {
                  id: 'ID / Kode',
                  department: 'Departemen / Divisi',
                  title: 'Nama Posisi / Station',
                  category: 'Kategori Peran',
                  salaryUnder3Months: 'Gaji Pokok (0 - 3 Bulan / Training)',
                  salaryOver3Months: 'Gaji Pokok (> 3 Bulan / Reguler)',
                  activeStaff: 'Jumlah Staf Aktif',
                  code: 'Kode Outlet',
                  name: 'Nama',
                  address: 'Alamat Lokasi',
                  lat: 'Latitude GPS',
                  lng: 'Longitude GPS',
                  radius: 'Radius Geofence (Meter)',
                  totalStaff: 'Total Staf',
                  status: 'Status Operasional',
                  outletName: 'Cabang Outlet Restoran',
                  weekdayOpenTime: 'Hari Biasa - Jam Buka Outlet',
                  weekdayCloseTime: 'Hari Biasa - Jam Tutup Outlet',
                  weekdayShiftStart: 'Hari Biasa - Jam Masuk Karyawan',
                  weekdayShiftEnd: 'Hari Biasa - Jam Pulang Karyawan',
                  weekdayBreak: 'Hari Biasa - Alokasi Istirahat',
                  weekendOpenTime: 'Weekend & Libur - Jam Buka Outlet',
                  weekendCloseTime: 'Weekend & Libur - Jam Tutup Outlet',
                  weekendShiftStart: 'Weekend & Libur - Jam Masuk Karyawan',
                  weekendShiftEnd: 'Weekend & Libur - Jam Pulang Karyawan',
                  weekendBreak: 'Weekend & Libur - Alokasi Istirahat',
                  startTime: 'Jam Mulai Shift',
                  endTime: 'Jam Selesai Shift',
                  breakLimit: 'Batas Istirahat',
                  type: 'Tipe / Klasifikasi',
                  description: 'Keterangan Shift / Operasional',
                  componentName: 'Nama Komponen Gaji',
                  formula: 'Rumus Perhitungan',
                  taxable: 'Kena Pajak PPh21',
                  notes: 'Catatan Komponen',
                  quota: 'Kuota Hari',
                  reduceQuota: 'Memotong Cuti Tahunan',
                  requiresAttachment: 'Wajib Lampiran Surat',
                  minDaysNotice: 'Batas Pengajuan (Hari Sebelumnya)',
                };
                return (
                  <div key={key} className="flex justify-between py-1.5 border-b border-slate-200/50 last:border-b-0 items-center">
                    <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">
                      {fieldLabels[key] || key}
                    </span>
                    <span className="font-bold text-slate-800 text-right">{String(val)}</span>
                  </div>
                );
              })}
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
      {/* 4. MODAL EDIT DATA MASTER                                 */}
      {/* ========================================================= */}
      {editModalData && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Edit2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Edit Data Master</h3>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                    Kategori: {editModalData.type.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-96 overflow-y-auto pr-1">
              {/* 1. OUTLETS: SEMUA KOLOM TABEL ADA DI FORM EDIT */}
              {editModalData.type === 'outlets' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Kode Cabang</label>
                      <input
                        type="text"
                        value={editModalData.data.code}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, code: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Status Operasional</label>
                      <select
                        value={editModalData.data.status}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, status: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                      >
                        <option value="AKTIF">AKTIF</option>
                        <option value="PERSIAPAN (OPENING)">PERSIAPAN (OPENING)</option>
                        <option value="NON-AKTIF">NON-AKTIF</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Restoran / Cabang</label>
                    <input
                      type="text"
                      value={editModalData.data.name}
                      onChange={(e) =>
                        setEditModalData({
                          ...editModalData,
                          data: { ...editModalData.data, name: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Alamat Lokasi</label>
                    <textarea
                      rows={2}
                      value={editModalData.data.address}
                      onChange={(e) =>
                        setEditModalData({
                          ...editModalData,
                          data: { ...editModalData.data, address: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Pengaturan Manual Jam Operasional & Jam Kerja Outlet */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <p className="font-bold text-slate-800 text-xs">Profil Jam Operasional &amp; Jam Kerja (Input Manual):</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">Buka Weekday</label>
                        <input
                          type="text"
                          value={editModalData.data.operatingHoursWeekday || '11:00 - 22:00 WIB'}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, operatingHoursWeekday: e.target.value },
                            })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">Buka Weekend</label>
                        <input
                          type="text"
                          value={editModalData.data.operatingHoursWeekend || '11:00 - 23:00 WIB'}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, operatingHoursWeekend: e.target.value },
                            })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">Jam Kerja Kru</label>
                        <input
                          type="text"
                          value={editModalData.data.workHours || '10:00 - 23:00 WIB'}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, workHours: e.target.value },
                            })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-600 font-semibold mb-0.5">Selesai Closing</label>
                        <input
                          type="text"
                          value={editModalData.data.closingHours || '23:00 WIB'}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, closingHours: e.target.value },
                            })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pengaturan Manual Cut-Off & Tanggal Gajian */}
                  <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2">
                    <p className="font-bold text-amber-950 text-xs">Siklus Cut-Off &amp; Tanggal Gajian (Input Manual):</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-700 font-semibold mb-0.5">Tutup Buku (Cut-Off)</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={editModalData.data.cutoffDate || 5}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, cutoffDate: parseInt(e.target.value, 10) || 5 },
                            })
                          }
                          className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs bg-white font-black"
                        />
                        <span className="text-[9px] text-slate-500">Tiap bulan (Rekap Absen)</span>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-700 font-semibold mb-0.5">Tanggal Gajian (Payday)</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={editModalData.data.paydayDate || 10}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, paydayDate: parseInt(e.target.value, 10) || 10 },
                            })
                          }
                          className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs bg-white font-black text-emerald-700"
                        />
                        <span className="text-[9px] text-slate-500">Tiap bulan (Cair Rekening)</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Latitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={editModalData.data.lat}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, lat: parseFloat(e.target.value) },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Longitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={editModalData.data.lng}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, lng: parseFloat(e.target.value) },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Radius Geofence (Meter)</label>
                      <input
                        type="number"
                        value={editModalData.data.radius}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, radius: parseInt(e.target.value, 10) },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Total Staf Resto</label>
                      <input
                        type="number"
                        value={editModalData.data.totalStaff}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, totalStaff: parseInt(e.target.value, 10) },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 2. DEPARTMENTS & POSISI: SEMUA KOLOM TABEL ADA DI FORM EDIT */}
              {editModalData.type === 'departments' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Kode Posisi / Station</label>
                      <input
                        type="text"
                        value={editModalData.data.id}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, id: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Kategori Peran</label>
                      <input
                        type="text"
                        value={editModalData.data.category}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, category: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Posisi &amp; Station</label>
                    <input
                      type="text"
                      value={editModalData.data.title}
                      onChange={(e) =>
                        setEditModalData({
                          ...editModalData,
                          data: { ...editModalData.data, title: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Departemen / Divisi</label>
                      <input
                        type="text"
                        value={editModalData.data.department}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, department: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Jumlah Staf Aktif</label>
                      <input
                        type="number"
                        value={editModalData.data.activeStaff}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, activeStaff: parseInt(e.target.value, 10) },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                      />
                    </div>
                  </div>
                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Standar Gaji Pokok Berdasarkan Lama Bekerja
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Masa Kerja 0 - 3 Bulan (Probation / Training)</label>
                        <input
                          type="text"
                          value={editModalData.data.salaryUnder3Months}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, salaryUnder3Months: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-emerald-700 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Masa Kerja &gt; 3 Bulan (3 Bulan ke Atas)</label>
                        <input
                          type="text"
                          value={editModalData.data.salaryOver3Months}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, salaryOver3Months: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-emerald-700 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 3. SHIFTS: FORM EDIT JADWAL LONG SHIFT OUTLET */}
              {editModalData.type === 'shifts' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Pilih Cabang Outlet</label>
                      <select
                        value={editModalData.data.outletName}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, outletName: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-800"
                      >
                        {outlets.length === 0 ? (
                          <option value="">(Belum ada cabang - silakan tambah di tab Cabang)</option>
                        ) : (
                          outlets.map((o) => (
                            <option key={o.id} value={o.name}>
                              {o.name} ({o.code})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Status Shift</label>
                      <select
                        value={editModalData.data.status || 'AKTIF'}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, status: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                      >
                        <option value="AKTIF">AKTIF (Berjalan)</option>
                        <option value="PERSIAPAN">PERSIAPAN (Opening)</option>
                        <option value="NONAKTIF">NONAKTIF</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Kode Shift</label>
                      <input
                        type="text"
                        value={editModalData.data.id}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, id: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Nama Jadwal Long Shift</label>
                      <input
                        type="text"
                        value={editModalData.data.name}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, name: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                      />
                    </div>
                  </div>

                  {/* Group 1: Hari Biasa (Senin - Jumat) */}
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                      <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center">
                        📅 Jadwal Hari Biasa (Senin - Jumat)
                      </span>
                      <span className="text-[10px] text-amber-700 font-semibold">Weekday Operation</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Jam Buka Outlet Resto</label>
                        <input
                          type="text"
                          value={editModalData.data.weekdayOpenTime}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, weekdayOpenTime: e.target.value },
                            })
                          }
                          placeholder="e.g. 10:00"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Jam Tutup Outlet Resto</label>
                        <input
                          type="text"
                          value={editModalData.data.weekdayCloseTime}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, weekdayCloseTime: e.target.value },
                            })
                          }
                          placeholder="e.g. 22:00"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-amber-200/50">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Jam Masuk Kru (Prep)</label>
                        <input
                          type="text"
                          value={editModalData.data.weekdayShiftStart}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, weekdayShiftStart: e.target.value },
                            })
                          }
                          placeholder="e.g. 09:00"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold text-blue-700 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Jam Pulang (Closing)</label>
                        <input
                          type="text"
                          value={editModalData.data.weekdayShiftEnd}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, weekdayShiftEnd: e.target.value },
                            })
                          }
                          placeholder="e.g. 22:30"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold text-blue-700 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Durasi Istirahat</label>
                        <select
                          value={editModalData.data.weekdayBreak || '2 Jam (120 Menit)'}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, weekdayBreak: e.target.value },
                            })
                          }
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-xs bg-white text-slate-800"
                        >
                          <option value="2 Jam (120 Menit)">2 Jam (120 Menit) - Jam Kerja Outlet ≤ 12 Jam</option>
                          <option value="3 Jam (180 Menit)">3 Jam (180 Menit) - Jam Kerja Outlet &gt; 12 Jam</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Group 2: Weekend & Libur Nasional */}
                  <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/80 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-rose-200 pb-1.5">
                      <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider flex items-center">
                        🎉 Weekend (Sabtu - Minggu) &amp; Libur Nasional
                      </span>
                      <span className="text-[10px] text-rose-700 font-semibold">Rush Hour / Holiday</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Jam Buka Outlet Resto</label>
                        <input
                          type="text"
                          value={editModalData.data.weekendOpenTime}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, weekendOpenTime: e.target.value },
                            })
                          }
                          placeholder="e.g. 09:00"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Jam Tutup Outlet Resto</label>
                        <input
                          type="text"
                          value={editModalData.data.weekendCloseTime}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, weekendCloseTime: e.target.value },
                            })
                          }
                          placeholder="e.g. 23:00"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-rose-200/50">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Jam Masuk Kru (Prep)</label>
                        <input
                          type="text"
                          value={editModalData.data.weekendShiftStart}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, weekendShiftStart: e.target.value },
                            })
                          }
                          placeholder="e.g. 08:00"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold text-purple-700 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Jam Pulang (Closing)</label>
                        <input
                          type="text"
                          value={editModalData.data.weekendShiftEnd}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, weekendShiftEnd: e.target.value },
                            })
                          }
                          placeholder="e.g. 23:30"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold text-purple-700 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Durasi Istirahat</label>
                        <select
                          value={editModalData.data.weekendBreak || '3 Jam (180 Menit)'}
                          onChange={(e) =>
                            setEditModalData({
                              ...editModalData,
                              data: { ...editModalData.data, weekendBreak: e.target.value },
                            })
                          }
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-xs bg-white text-slate-800"
                        >
                          <option value="2 Jam (120 Menit)">2 Jam (120 Menit) - Jam Kerja Outlet ≤ 12 Jam</option>
                          <option value="3 Jam (180 Menit)">3 Jam (180 Menit) - Jam Kerja Outlet &gt; 12 Jam</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Catatan &amp; Ketentuan Operasional</label>
                    <textarea
                      rows={2}
                      value={editModalData.data.description}
                      onChange={(e) =>
                        setEditModalData({
                          ...editModalData,
                          data: { ...editModalData.data, description: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                    />
                  </div>
                </>
              )}

              {/* 4. PAYROLL: SEMUA KOLOM TABEL ADA DI FORM EDIT */}
              {editModalData.type === 'payroll' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Kode Komponen</label>
                      <input
                        type="text"
                        value={editModalData.data.id}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, id: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Tipe Komponen</label>
                      <input
                        type="text"
                        value={editModalData.data.type}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, type: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Komponen Payroll</label>
                    <input
                      type="text"
                      value={editModalData.data.componentName}
                      onChange={(e) =>
                        setEditModalData({
                          ...editModalData,
                          data: { ...editModalData.data, componentName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Formula Perhitungan</label>
                      <input
                        type="text"
                        value={editModalData.data.formula}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, formula: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-emerald-700 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Pajak PPh 21</label>
                      <select
                        value={editModalData.data.taxable}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, taxable: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                      >
                        <option value="Ya (PPh 21)">Ya (PPh 21)</option>
                        <option value="Tidak">Tidak</option>
                        <option value="-">-</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Keterangan Khusus F&amp;B</label>
                    <textarea
                      rows={2}
                      value={editModalData.data.notes}
                      onChange={(e) =>
                        setEditModalData({
                          ...editModalData,
                          data: { ...editModalData.data, notes: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </>
              )}

              {/* 5. LEAVES: SEMUA KOLOM TABEL ADA DI FORM EDIT */}
              {editModalData.type === 'leaves' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Kode Cuti</label>
                      <input
                        type="text"
                        value={editModalData.data.id}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, id: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Memotong Saldo Cuti</label>
                      <select
                        value={editModalData.data.reduceQuota}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, reduceQuota: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                      >
                        <option value="Ya">Ya</option>
                        <option value="Tidak">Tidak</option>
                        <option value="Tidak (Cuti Khusus)">Tidak (Cuti Khusus)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Jenis Cuti / Izin</label>
                    <input
                      type="text"
                      value={editModalData.data.name}
                      onChange={(e) =>
                        setEditModalData({
                          ...editModalData,
                          data: { ...editModalData.data, name: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Alokasi Kuota</label>
                      <input
                        type="text"
                        value={editModalData.data.quota}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, quota: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Wajib Dokumen / Surat</label>
                      <input
                        type="text"
                        value={editModalData.data.requiresAttachment}
                        onChange={(e) =>
                          setEditModalData({
                            ...editModalData,
                            data: { ...editModalData.data, requiresAttachment: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Batas Minimal Pengajuan</label>
                    <input
                      type="text"
                      value={editModalData.data.minDaysNotice}
                      onChange={(e) =>
                        setEditModalData({
                          ...editModalData,
                          data: { ...editModalData.data, minDaysNotice: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditModalData(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-sm"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. MODAL KONFIRMASI DELETE                                */}
      {/* ========================================================= */}
      {deleteModalData && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Hapus Data Master?</h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus data <b>&quot;{deleteModalData.name}&quot;</b>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="pt-2 flex justify-center space-x-2">
              <button
                onClick={() => setDeleteModalData(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
              >
                Ya, Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL TAMBAH DATA (CREATE NEW)                         */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          {activeTab === 'shifts' ? (
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Tambah Jadwal Long Shift Outlet</h3>
                    <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                      Atur Buka-Tutup &amp; Jam Shift Manual
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveNewShift} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Pilih Cabang Outlet Resto</label>
                    <select
                      value={newShiftFormData.outletName}
                      onChange={(e) =>
                        setNewShiftFormData({ ...newShiftFormData, outletName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-800"
                    >
                      {outlets.length === 0 ? (
                        <option value="">(Belum ada cabang - silakan tambah di tab Cabang)</option>
                      ) : (
                        outlets.map((o) => (
                          <option key={o.id} value={o.name}>
                            {o.name} ({o.code})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Status Shift</label>
                    <select
                      value={newShiftFormData.status}
                      onChange={(e) =>
                        setNewShiftFormData({ ...newShiftFormData, status: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                    >
                      <option value="AKTIF">AKTIF (Berjalan)</option>
                      <option value="PERSIAPAN">PERSIAPAN (Opening / Trial)</option>
                      <option value="NONAKTIF">NONAKTIF</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Kode Shift</label>
                    <input
                      type="text"
                      value={newShiftFormData.id}
                      onChange={(e) =>
                        setNewShiftFormData({ ...newShiftFormData, id: e.target.value })
                      }
                      placeholder="e.g. LS-04"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Jadwal Shift</label>
                    <input
                      type="text"
                      value={newShiftFormData.name}
                      onChange={(e) =>
                        setNewShiftFormData({ ...newShiftFormData, name: e.target.value })
                      }
                      placeholder="e.g. Long Shift Full-Day PIK"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                    />
                  </div>
                </div>

                {/* Group 1: Hari Biasa (Senin - Jumat) */}
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                    <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center">
                      📅 Jadwal Hari Biasa (Senin - Jumat)
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold">Weekday Hours</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Jam Buka Outlet</label>
                      <input
                        type="text"
                        value={newShiftFormData.weekdayOpenTime}
                        onChange={(e) =>
                          setNewShiftFormData({ ...newShiftFormData, weekdayOpenTime: e.target.value })
                        }
                        placeholder="10:00"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Jam Tutup Outlet</label>
                      <input
                        type="text"
                        value={newShiftFormData.weekdayCloseTime}
                        onChange={(e) =>
                          setNewShiftFormData({ ...newShiftFormData, weekdayCloseTime: e.target.value })
                        }
                        placeholder="22:00"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-amber-200/50">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Jam Masuk Kru (Prep)</label>
                      <input
                        type="text"
                        value={newShiftFormData.weekdayShiftStart}
                        onChange={(e) =>
                          setNewShiftFormData({ ...newShiftFormData, weekdayShiftStart: e.target.value })
                        }
                        placeholder="09:00"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold text-blue-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Jam Pulang (Closing)</label>
                      <input
                        type="text"
                        value={newShiftFormData.weekdayShiftEnd}
                        onChange={(e) =>
                          setNewShiftFormData({ ...newShiftFormData, weekdayShiftEnd: e.target.value })
                        }
                        placeholder="22:30"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold text-blue-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Durasi Istirahat</label>
                      <select
                        value={newShiftFormData.weekdayBreak}
                        onChange={(e) =>
                          setNewShiftFormData({ ...newShiftFormData, weekdayBreak: e.target.value })
                        }
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-xs bg-white text-slate-800"
                      >
                        <option value="2 Jam (120 Menit)">2 Jam (120 Menit) - Jam Kerja Outlet ≤ 12 Jam</option>
                        <option value="3 Jam (180 Menit)">3 Jam (180 Menit) - Jam Kerja Outlet &gt; 12 Jam</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Group 2: Weekend & Libur Nasional */}
                <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/80 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-rose-200 pb-1.5">
                    <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider flex items-center">
                      🎉 Weekend (Sabtu - Minggu) &amp; Libur Nasional
                    </span>
                    <span className="text-[10px] text-rose-700 font-semibold">Weekend / Holiday</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Jam Buka Outlet</label>
                      <input
                        type="text"
                        value={newShiftFormData.weekendOpenTime}
                        onChange={(e) =>
                          setNewShiftFormData({ ...newShiftFormData, weekendOpenTime: e.target.value })
                        }
                        placeholder="09:00"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Jam Tutup Outlet</label>
                      <input
                        type="text"
                        value={newShiftFormData.weekendCloseTime}
                        onChange={(e) =>
                          setNewShiftFormData({ ...newShiftFormData, weekendCloseTime: e.target.value })
                        }
                        placeholder="23:00"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-rose-200/50">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Jam Masuk Kru (Prep)</label>
                      <input
                        type="text"
                        value={newShiftFormData.weekendShiftStart}
                        onChange={(e) =>
                          setNewShiftFormData({ ...newShiftFormData, weekendShiftStart: e.target.value })
                        }
                        placeholder="08:00"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold text-purple-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Jam Pulang (Closing)</label>
                      <input
                        type="text"
                        value={newShiftFormData.weekendShiftEnd}
                        onChange={(e) =>
                          setNewShiftFormData({ ...newShiftFormData, weekendShiftEnd: e.target.value })
                        }
                        placeholder="23:30"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold text-purple-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[10px]">Durasi Istirahat</label>
                      <select
                        value={newShiftFormData.weekendBreak}
                        onChange={(e) =>
                          setNewShiftFormData({ ...newShiftFormData, weekendBreak: e.target.value })
                        }
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-xs bg-white text-slate-800"
                      >
                        <option value="2 Jam (120 Menit)">2 Jam (120 Menit) - Jam Kerja Outlet ≤ 12 Jam</option>
                        <option value="3 Jam (180 Menit)">3 Jam (180 Menit) - Jam Kerja Outlet &gt; 12 Jam</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Catatan &amp; Ketentuan Operasional</label>
                  <textarea
                    rows={2}
                    value={newShiftFormData.description}
                    onChange={(e) =>
                      setNewShiftFormData({ ...newShiftFormData, description: e.target.value })
                    }
                    placeholder="e.g. Termasuk 2 sesi istirahat split siang dan sore."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-md"
                  >
                    Simpan Jadwal Long Shift
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">
                  Tambah {activeTab === 'outlets' ? 'Cabang Baru' : 'Data Master'}
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kode Cabang</label>
                  <input
                    type="text"
                    placeholder="e.g. RESTO-SBY-04"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nama Restoran</label>
                  <input
                    type="text"
                    placeholder="e.g. Resto Nusantara Tunjungan Surabaya"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Alamat Lengkap</label>
                  <textarea
                    rows={2}
                    placeholder="Jl. Tunjungan No. ..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="-7.2575"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="112.7521"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Radius Geofence GPS (Meter)</label>
                  <input
                    type="number"
                    defaultValue={60}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    showToast('Cabang baru berhasil disimpan ke sistem!');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                >
                  Simpan Data
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
