'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ShiftMasterModule from '@/components/ShiftMasterModule';
import AppShell from '@/components/AppShell';
import OutletMasterModule from '@/components/OutletMasterModule';
import { getSessionUser } from '@/lib/auth';
import { actionFor, useAdminRequests } from '@/lib/requests';
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal States
  const [reviewModalData, setReviewModalData] = useState<{ type: string; data: any } | null>(null);
  const [editModalData, setEditModalData] = useState<{ type: string; data: any } | null>(null);
  const [deleteModalData, setDeleteModalData] = useState<{ type: string; id: string; name: string } | null>(null);

  // Angka di menu Persetujuan sama dengan di halaman utama
  const adminRequests = useAdminRequests();
  const sessionRole = getSessionUser()?.role;
  const requestsAwaitingMe = adminRequests.requests.filter((r) => actionFor(r, sessionRole)).length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 2. Data Departemen & Posisi / Station Resto (Zero Mock Policy: Persistent State)
  const [departments, setDepartments] = useState<any[]>([]);

  const hasLoadedMasterRef = useRef(false);

  useEffect(() => {
    try {
      const savedDepts = localStorage.getItem('hris_master_departments');
      if (savedDepts) setDepartments(JSON.parse(savedDepts));

    } catch (e) {
      console.error('Error loading master data from localStorage:', e);
    }
    hasLoadedMasterRef.current = true;
  }, []);

  useEffect(() => {
    if (hasLoadedMasterRef.current) {
      try {
        localStorage.setItem('hris_master_departments', JSON.stringify(departments));
      } catch (e) {
        console.error('Error saving departments:', e);
      }
    }
  }, [departments]);


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

  // Handle Edit Submit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalData) return;

    const { type, data } = editModalData;
    if (type === 'departments') {
      setDepartments(departments.map((d) => (d.id === data.id ? data : d)));
      showToast(`Data station ${data.title} berhasil diperbarui!`);
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

    if (type === 'departments') {
      setDepartments(departments.filter((d) => d.id !== id));
    } else if (type === 'payroll') {
      setPayrollRules(payrollRules.filter((p) => p.id !== id));
    } else if (type === 'leaves') {
      setLeaveTypes(leaveTypes.filter((l) => l.id !== id));
    }

    showToast(`Data "${name}" berhasil dihapus dari sistem!`);
    setDeleteModalData(null);
  };

  return (
    <AppShell activeId="master-data" title="Master Data" counts={{ requests: requestsAwaitingMe }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 text-xs border border-slate-700">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

        <div className="shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6">
          <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Bagian master data">
            {(
              [
                { id: 'outlets', label: 'Cabang & Geofence' },
                { id: 'departments', label: 'Departemen & Stasiun' },
                { id: 'shifts', label: 'Shift' },
                { id: 'payroll', label: 'Komponen Gaji' },
                { id: 'leaves', label: 'Jenis Cuti' },
              ] as { id: MasterSubTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-amber-500 font-medium text-slate-900'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================= */}
          {/* SUB-TAB 1: MASTER OUTLET & GEOFENCE                      */}
          {/* ========================================================= */}
          {activeTab === 'outlets' && <OutletMasterModule />}

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
                              Belum ada departemen. Tambahkan departemen dan stasiun kerja pertama.
                            </p>
                          </div>
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
          {activeTab === 'shifts' && <ShiftMasterModule />}

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

      {/* ========================================================= */}
      {/* 3. MODAL REVIEW / DETAIL                                  */}
      {/* ========================================================= */}
      {reviewModalData && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
    </AppShell>
  );
}
