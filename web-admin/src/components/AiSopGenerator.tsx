'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Printer,
  Copy,
  Plus,
  RotateCcw,
  Clock,
  ChefHat,
  Users,
  Wallet,
  Building2,
  Layers,
  ArrowRight,
  X,
  FileSignature,
  Scale,
  Award,
  Edit2,
  Download,
} from 'lucide-react';

export interface GeneratedSopDocument {
  id: string;
  skNumber: string;
  title: string;
  category: string;
  station: string;
  riskLevel: 'KRITIS (HACCP/FINANCE)' | 'SEDANG (OPERASIONAL)' | 'STANDAR (RUTIN)';
  effectiveDate: string;
  revision: string;
  author: string;
  reviewedBy: string;
  approvedBy: string;
  scope: string;
  targetRoles: string[];
  legalReferences: string[];
  summary: string;
  articles: {
    number: string;
    title: string;
    badge?: string;
    content: string[];
    table?: {
      headers: string[];
      rows: string[][];
    };
    callout?: {
      type: 'warning' | 'info' | 'critical' | 'success';
      title: string;
      text: string;
    };
  }[];
  kpis: {
    metric: string;
    target: string;
    tolerance: string;
    frequency: string;
  }[];
  penalties: {
    tier: string;
    infraction: string;
    sanction: string;
  }[];
}

export const PRESET_SOP_PROMPTS = [
  {
    category: 'KITCHEN (BOH)',
    station: 'Station Penggorengan & Wok',
    title: 'SOP Penggantian Minyak Goreng & Uji TPM Dapur',
    riskLevel: 'KRITIS (HACCP/FINANCE)' as const,
    prompt: 'Standar penggantian minyak goreng sawit, uji batas polar TPM maks 24%, penyaringan remah setiap 2 jam, dan pencegahan oksidasi minyak.',
  },
  {
    category: 'KITCHEN (BOH)',
    station: 'Station Butcher & Chiller',
    title: 'Standar Thawing & Suhu Cold Chain Daging Unggas (<4°C)',
    riskLevel: 'KRITIS (HACCP/FINANCE)' as const,
    prompt: 'Protokol pencairan daging ayam beku di chiller 0-4°C, larangan thawing suhu ruang, rotasi FIFO, dan batas waktu olah maks 24 jam.',
  },
  {
    category: 'KITCHEN (BOH)',
    station: 'Station Prep & Bahan Mentah',
    title: 'Pencegahan Kontaminasi Silang Talenan (HACCP 5 Warna)',
    riskLevel: 'KRITIS (HACCP/FINANCE)' as const,
    prompt: 'Penggunaan talenan warna: Merah (Daging sapi mentah), Kuning (Ayam mentah), Hijau (Sayur/Buah), Biru (Seafood), Putih (Matang), dan sanitasi klorin 100 ppm.',
  },
  {
    category: 'SERVICE (FOH)',
    station: 'Dining Floor & Bar',
    title: 'Standar Pelayanan Meja 3S & Waktu Servis <15 Menit',
    riskLevel: 'SEDANG (OPERASIONAL)' as const,
    prompt: 'Standar 3S (Senyum, Salam, Sapa) dalam 5 detik, delivery minuman <3 menit, makanan utama <15 menit, dan pembersihan meja <60 detik setelah tamu bangun.',
  },
  {
    category: 'SERVICE (FOH)',
    station: 'Dining Floor & Customer Service',
    title: 'Penanganan Keluhan Tamu (Guest Complaint) Metode LAST',
    riskLevel: 'SEDANG (OPERASIONAL)' as const,
    prompt: 'Resolusi komplain rasa asin/dingin/benda asing menggunakan metode LAST (Listen, Apologize, Solve, Thank) dan eskalasi ke Floor Supervisor.',
  },
  {
    category: 'CASHIER (POS)',
    station: 'Kasir & Front Counter',
    title: 'Prosedur Pembatalan Transaksi (Void) & Otorisasi PIN SPV',
    riskLevel: 'KRITIS (HACCP/FINANCE)' as const,
    prompt: 'Larangan kasir membatalkan nota tanpa izin, wajib dual-authorization PIN Supervisor, formulir pembatalan fisik, dan audit selisih kas POS.',
  },
  {
    category: 'CASHIER (POS)',
    station: 'Kasir & Brankas Toko',
    title: 'Closing Kasir, Rekonsiliasi Z-Report & Audit Selisih Kas',
    riskLevel: 'KRITIS (HACCP/FINANCE)' as const,
    prompt: 'Pencocokan fisik uang tunai vs laporan Z-Report sistem, toleransi selisih Rp 0, penanganan uang palsu UV, dan penyetoran uang ke brankas drop-box.',
  },
  {
    category: 'HR & LEGAL',
    station: 'HRD & Store Operations',
    title: 'Mekanisme Izin Setengah Hari & Prosedur Tukar Shift Kru Resto',
    riskLevel: 'SEDANG (OPERASIONAL)' as const,
    prompt: 'Prosedur izin setengah hari maks 4 jam dengan persetujuan Kepala Cabang H-1, mekanisme tukar shift sesama divisi, dan sanksi mangkir.',
  },
  {
    category: 'HR & LEGAL',
    station: 'HRD & Manajemen Barokah Grup',
    title: 'Kepatuhan Larangan Libur Weekend & Hari Raya (SK 001/V/2025)',
    riskLevel: 'KRITIS (HACCP/FINANCE)' as const,
    prompt: 'Penegakan larangan jatah libur (off) di hari Sabtu/Minggu/Libur Nasional, denda off weekend Rp 200rb, insentif masuk penuh Rp 75rb/hari, dan sanksi SP1.',
  },
];

export function synthesizeSopWithAi(params: {
  category: string;
  station: string;
  topic: string;
  riskLevel: 'KRITIS (HACCP/FINANCE)' | 'SEDANG (OPERASIONAL)' | 'STANDAR (RUTIN)';
  references: string[];
  targetRoles: string[];
  customNotes?: string;
}): GeneratedSopDocument {
  const year = '2026';
  const prefix = params.category.includes('KITCHEN')
    ? 'BOH'
    : params.category.includes('SERVICE')
    ? 'FOH'
    : params.category.includes('CASHIER')
    ? 'CAS'
    : 'HR';

  const randomNum = Math.floor(100 + Math.random() * 900);
  const docId = `SOP-${prefix}-${year}-${randomNum}`;
  const skNumber = `SK-${randomNum}/${prefix}/${year}/DIR-BAROKAH`;

  const titleClean = params.topic.trim().length > 0 ? params.topic.trim() : 'SOP Standar Operasional Baku';

  let articles: GeneratedSopDocument['articles'] = [];
  let kpis: GeneratedSopDocument['kpis'] = [];
  let penalties: GeneratedSopDocument['penalties'] = [];

  if (params.category.includes('KITCHEN')) {
    articles = [
      {
        number: '1.0',
        title: 'TUJUAN & DASAR KEBIJAKAN HIGIENE MUTU (HACCP)',
        content: [
          `Standar Operasional Prosedur (SOP) ini diterbitkan sebagai panduan baku seluruh staf ${params.station} di 4 cabang Barokah Grup (Senopati, Kemang, PIK, dan BSD) guna menjamin kebersihan, keselamatan pangan (Food Safety), dan konsistensi cita rasa sesuai resep baku perusahaan.`,
          'Seluruh tahapan kerja tunduk pada standar Good Manufacturing Practices (GMP) dan rujukan sertifikasi Halal LPPOM-MUI serta ISO 22000.',
        ],
        callout: {
          type: 'critical',
          title: 'PERINGATAN KRITIS FOOD SAFETY (CCP-1)',
          text: 'Pelanggaran terhadap suhu cold-chain atau penggunaan minyak kedaluwarsa berakibat penarikan batch makanan seketika dan penerbitan Surat Peringatan (SP) Tingkat 1 bagi Cook bertugas.',
        },
      },
      {
        number: '2.0',
        title: 'RUANG LINGKUP & KUALIFIKASI PETUGAS',
        content: [
          `Berlaku untuk seluruh kru Kitchen BOH (Executive Chef, CDP, Demi Chef, Cook 1/2/3, Kitchen Helper, dan Dishwasher).`,
          'Petugas wajib memiliki sertifikat lulus Kuis Onboarding Dapur Barokah Grup dengan nilai minimum 85/100.',
          'Kru yang menderita penyakit menular, demam >37.5°C, flu, atau luka terbuka di tangan DILARANG memegang bahan baku sebelum diobati dan dinyatakan laik oleh Supervisor.',
        ],
      },
      {
        number: '3.0',
        title: 'ALAT PELINDUNG DIRI (APD) & PERALATAN WAJIB',
        content: [
          'Seragam chef jacket bersih yang disetrika rapi dengan celemek (apron) anti-air.',
          'Penutup rambut (hairnet) dan masker mulut pelindung (spit guard) wajib dipakai selama berada di area dapur.',
          'Sepatu safety kitchen boots anti-selip (slip-resistant) dengan sol karet bermotif.',
          'Termometer tusuk digital berkalibrasi dan test kit minyak polar (TPM meter) yang tersimpan di station masing-masing.',
        ],
      },
      {
        number: '4.0',
        title: 'PROSEDUR LANGKAH KERJA BAKU (STEP-BY-STEP)',
        content: [
          'FASE 1 - PRA-OPERASIONAL (09:00 - 09:30 WIB): Lakukan cuci tangan 6 langkah WHO dengan sabun antibakteri minimal 20 detik. Cek suhu chiller (0°C s.d. 4°C) dan freezer (-18°C). Dokumentasikan foto logbook opening.',
          'FASE 2 - EKSEKUSI KERJA (SHIFT BERJALAN): Selalu gunakan metode rotasi bahan baku FIFO (First In First Out). Pastikan waktu memasak dan pemanasan mencapai titik suhu internal daging minimal 74°C selama minimal 15 detik.',
          'FASE 3 - MONITORING SANITASI BERKALA: Lakukan penyaringan remah minyak dan pembersihan station setiap 2 jam. Pisahkan limbah basah organik dan limbah padat di tempat sampah berpedal.',
          'FASE 4 - PASCA-OPERASIONAL & CLOSING (22:00 - 22:45 WIB): Matikan saluran gas LPG utama, tutup deep fryer, bersihkan grease trap saluran lemak, dan simpan sisa bahan marinasi bertanggal di wadah kedap udara.',
        ],
      },
      {
        number: '5.0',
        title: 'TITIK KENDALI KRITIS (CRITICAL CONTROL POINTS) & KPI',
        content: [
          'Setiap parameter kualitas diukur secara real-time dan dicatat dalam Checklist Harian Resto.',
        ],
        table: {
          headers: ['Parameter Mutu', 'Standar Baku', 'Batas Toleransi', 'Frekuensi Cek'],
          rows: [
            ['Suhu Chiller Unggas/Daging', '0°C s.d. +4°C', 'Maksimal +5°C (<30 menit)', 'Setiap 4 Jam'],
            ['Kualitas Minyak Goreng (TPM)', 'TPM 12% - 18%', 'Maksimal TPM 24% (Wajib Ganti)', 'Opening & Mid-Shift'],
            ['Suhu Masak Inti Daging', 'Minimal 74°C', 'Tidak Boleh Di Bawah 74°C', 'Setiap Batch Masak'],
            ['Gramatur Porsi Ayam Goreng', '220 - 240 gram', 'Deviasi maksimal ±5 gram', 'Random Sample 5 Porsi/Hari'],
          ],
        },
      },
      {
        number: '6.0',
        title: 'KLAUSUL SANKSI PELANGGARAN & PENEGAKAN DISIPLIN',
        content: [
          'Karyawan yang terbukti mengabaikan standar hygiene, tidak menggunakan hairnet, atau membiarkan bahan baku basi disajikan ke tamu akan dikenakan sanksi berjenjang sesuai Peraturan Perusahaan Barokah Grup.',
        ],
      },
    ];

    kpis = [
      { metric: 'Kepatuhan Uji TPM Minyak', target: '100% Lolos Uji', tolerance: '0 Kasus Minyak Hitam', frequency: 'Harian' },
      { metric: 'Suhu Cold Chain Chiller', target: '0°C s.d. 4°C', tolerance: 'Maksimal 5°C', frequency: 'Setiap 4 Jam' },
      { metric: 'Tingkat Keluhan Rasa Makanan', target: '0% Komplain', tolerance: '< 0.5% dari total order', frequency: 'Mingguan' },
      { metric: 'Food Waste / Shrinkage', target: '< 2.0%', tolerance: 'Maks 2.5% dari total belanja', frequency: 'Bulanan' },
    ];

    penalties = [
      { tier: 'Teguran Lisan', infraction: 'Kuku panjang, tidak memakai hairnet, atau apron kotor', sanction: 'Pencatatan di Rapor SPV & Pembinaan langsung' },
      { tier: 'Surat Peringatan 1 (SP1)', infraction: 'Lupa mematikan gas LPG closing, atau membiarkan minyak >24% TPM', sanction: 'SP1 berlaku 6 bulan & pemotongan insentif operasional' },
      { tier: 'Surat Peringatan 2 (SP2)', infraction: 'Menyajikan bahan basi/berbau yang memicu komplain tamu keracunan', sanction: 'SP2 + Ganti rugi medis tamu + skorsing 3 hari' },
      { tier: 'Surat Peringatan 3 (SP3)', infraction: 'Penggelapan bahan baku (daging/minyak) atau sabotase resep baku', sanction: 'Pemutusan Hubungan Kerja (PHK) tanpa pesangon' },
    ];
  } else if (params.category.includes('SERVICE')) {
    articles = [
      {
        number: '1.0',
        title: 'TUJUAN & STANDAR KERAMAHAN (HOSPITALITY STANDARD)',
        content: [
          `SOP ini mengatur tata cara pelayanan meja, etika bersikap, serta kecepatan servis (Speed of Service) staf FOH di ${params.station} agar seluruh tamu Barokah Grup mendapatkan pengalaman bersantap yang hangat, higienis, dan berkesan.`,
          'Menerapkan filosofi 3S (Senyum, Salam, Sapa) dan proaktif dalam memahami kebutuhan tamu.',
        ],
      },
      {
        number: '2.0',
        title: 'STANDAR GROOMING & PENAMPILAN KRU SERVICE',
        content: [
          'Seragam polo/kemeja resmi Barokah Grup bersih, rapi, dan wangi tanpa noda makanan.',
          'Pria: Rambut pendek rapi di atas kerah, kumis/jenggot dicukur bersih. Wanita: Rambut diikat rapi dengan hairnet hitam, riasan natural segar.',
          'Wajib memakai name tag di dada sebelah kiri dan sepatu pantofel/sneakers hitam bersih.',
          'Aroma badan dijaga, dilarang merokok sebelum shift atau mengenakan parfum yang terlalu menyengat.',
        ],
      },
      {
        number: '3.0',
        title: 'PROSEDUR WAKTU & TAHAPAN SERVICE MEJA',
        content: [
          'TAHAP 1 - GREETING (0 - 5 DETIK): Sambut tamu di depan pintu dengan ucapan hangat: "Selamat datang di Barokah Resto! Untuk berapa orang Kak/Bapak/Ibu?".',
          'TAHAP 2 - ORDER TAKING (<2 MENIT): Antarkan ke meja, berikan buku menu/QR Code, dan tawarkan menu signature: "Hari ini rekomendasi kami Ayam Pecak Sambal Medok dan Es Jeruk Murni, boleh dicoba?".',
          'TAHAP 3 - PENGANTARAN MINUMAN (<3 MENIT): Sajikan minuman dingin/panas sebelum makanan tiba, gunakan tatakan gelas bersih.',
          'TAHAP 4 - PENYAJIAN MAKANAN (<15 MENIT): Antarkan pesanan makanan dengan kedua tangan, sebutkan nama menu, dan pastikan kelengkapan sambal serta lalapan.',
          'TAHAP 5 - TABLE CLEARING (<60 DETIK): Begitu tamu meninggalkan meja, bersihkan piring kotor dan lap meja dengan desinfektan food-grade.',
        ],
      },
      {
        number: '4.0',
        title: 'PROTOKOL PENANGANAN KOMPLAIN (METODE LAST)',
        content: [
          'Apabila tamu mengeluhkan makanan dingin, terlalu asin, atau ada benda asing, staf wajib menerapkan metode LAST:',
          'L (Listen): Dengarkan keluhan tamu dengan kontak mata penuh tanpa memotong pembicaraan.',
          'A (Apologize): Sampaikan permohonan maaf tulus tanpa menyalahkan bagian dapur.',
          'S (Solve): Tarik makanan bermasalah segera, gantikan dengan porsi baru dalam tempo <7 menit, atau tawarkan complimentary minuman.',
          'T (Thank): Ucapkan terima kasih atas masukan demi peningkatan mutu resto, lalu catat insiden di Buku Log Komplain SPV.',
        ],
        callout: {
          type: 'warning',
          title: 'ESKALASI KOMPLAIN TINGKAT TINGGI',
          text: 'Jika tamu menolak solusi kru, panggil Floor Supervisor atau Store Manager dalam waktu kurang dari 60 detik. Kru dilarang mendebat tamu.',
        },
      },
    ];

    kpis = [
      { metric: 'Waktu Saji Minuman', target: '< 3 Menit', tolerance: 'Maks 5 Menit saat peak hour', frequency: 'Realtime POS' },
      { metric: 'Waktu Saji Makanan Utama', target: '< 15 Menit', tolerance: 'Maks 20 Menit saat full house', frequency: 'Realtime KDS' },
      { metric: 'Table Clearing Speed', target: '< 60 Detik', tolerance: 'Maks 90 Detik', frequency: 'Audit SPV' },
      { metric: 'Rating Kepuasan Tamu (Google/Survey)', target: 'Min 4.8 / 5.0', tolerance: 'Tidak boleh < 4.6', frequency: 'Mingguan' },
    ];

    penalties = [
      { tier: 'Teguran Lisan', infraction: 'Grooming berantakan, tidak memakai nametag, atau terlambat salam 3S', sanction: 'Teguran SPV & Refresher Grooming' },
      { tier: 'Surat Peringatan 1 (SP1)', infraction: 'Mendebat tamu, bermain HP saat bertugas di dining area, atau membiarkan meja kotor >5 menit', sanction: 'SP1 + Pemindahan ke tugas runner/back area' },
      { tier: 'Surat Peringatan 2 (SP2)', infraction: 'Menerima tips pribadi tanpa dimasukkan ke kotak tips bersama tim resto', sanction: 'SP2 + Pemotongan pembagian service charge' },
      { tier: 'Surat Peringatan 3 (SP3)', infraction: 'Berperilaku kasar/berkelahi dengan tamu atau mencemarkan nama baik resto', sanction: 'PHK Langsung & Laporan Kepolisian jika ada tindak pidana' },
    ];
  } else if (params.category.includes('CASHIER')) {
    articles = [
      {
        number: '1.0',
        title: 'TUJUAN & KEBIJAKAN PENGENDALIAN ARUS KAS (LOSS PREVENTION)',
        content: [
          `SOP ini menjadi pedoman mutlak seluruh kasir dan penanggung jawab POS di ${params.station} untuk menjaga akurasi pembukuan, mencegah selisih kas, dan memastikan kepatuhan settlement EDC/QRIS harian.`,
          'Setiap rupiah uang kas masuk dan keluar wajib tercatat secara elektronik di sistem POS tanpa terkecuali.',
        ],
        callout: {
          type: 'critical',
          title: 'PRINSIP INTEGRITAS KASIR (ZERO TOLERANCE FRAUD)',
          text: 'Pemberian nota manual tanpa sistem POS, manipulasi diskon, atau menyimpan uang penjualan di saku pribadi dikategorikan sebagai FRAUD berat berujung PHK.',
        },
      },
      {
        number: '2.0',
        title: 'PROSEDUR MODAL AWAL & PEMERIKSAAN LACI KASIR',
        content: [
          'Setiap awal shift, kasir menerima Uang Modal Awal (Cash Float) sebesar Rp 500.000 dengan rincian pecahan yang telah diverifikasi bersama Supervisor.',
          'Dilarang menyimpan uang pribadi, dompet, atau tas di dalam atau di sekitar meja kasir.',
          'Pemeriksaan fisik laci kasir (Spot Check) dapat dilakukan sewaktu-waktu oleh Store Manager atau Internal Audit.',
        ],
      },
      {
        number: '3.0',
        title: 'PROSEDUR PEMBATALAN TRANSAKSI (VOID BILL) & REFUND',
        content: [
          'Kasir DILARANG KERAS melakukan pembatalan transaksi (VOID) secara mandiri.',
          'Setiap VOID wajib mendapatkan persetujuan Supervisor bertugas dengan memasukkan Master PIN SPV.',
          'Struk asli transaksi yang dibatalkan wajib ditempel pada Formulir Laporan Void harian lengkap dengan tanda tangan Kasir, SPV, dan alasan pembatalan jelas.',
        ],
      },
      {
        number: '4.0',
        title: 'PROSEDUR CLOSING HARIAN & REKONSILIASI Z-REPORT',
        content: [
          'Pada akhir shift operasional, cetak Laporan X-Report dan Z-Report dari sistem POS.',
          'Hitung fisik uang tunai di hadapan Supervisor di ruangan tertutup CCTV.',
          'Cocokkan jumlah penerimaan non-tunai (EDC Debit/Kredit, QRIS BCA/Mandiri, GrabFood/GoFood) dengan slip settlement fisik EDC.',
          'Uang hasil penjualan wajib dimasukkan ke dalam kantong uang bersegel dan disetorkan ke brankas drop-safe toko.',
        ],
      },
    ];

    kpis = [
      { metric: 'Akurasi Rekonsiliasi Kas (Selisih)', target: 'Rp 0 (Balance)', tolerance: 'Maks Rp 1.000 (Human rounding)', frequency: 'Harian' },
      { metric: 'Rasio Void Bill Terhadap Total Order', target: '< 0.5%', tolerance: 'Maks 1.0% dengan approval tertulis', frequency: 'Harian' },
      { metric: 'Waktu Transaksi Kasir Per Tamu', target: '< 45 Detik', tolerance: 'Maks 75 Detik saat antrean padat', frequency: 'Realtime POS' },
      { metric: 'Kepatuhan Settlement EDC/QRIS', target: '100% Sukses Settled', tolerance: '0 Transaksi Gantung', frequency: 'Setiap Closing' },
    ];

    penalties = [
      { tier: 'Ganti Rugi Langsung', infraction: 'Selisih minus uang fisik kasir di akhir shift', sanction: 'Wajib mengganti tunai pada hari yang sama saat serah terima shift' },
      { tier: 'Surat Peringatan 1 (SP1)', infraction: 'Terjadi selisih kas berulang >3 kali dalam 1 bulan atau lupa settlement EDC', sanction: 'SP1 + Penurunan sementara ke tugas service non-kasir' },
      { tier: 'Surat Peringatan 2 (SP2)', infraction: 'Melakukan void tanpa persetujuan SPV atau menerima pembayaran tanpa cetak struk', sanction: 'SP2 + Pencabutan akses akun kasir selama 3 bulan' },
      { tier: 'Surat Peringatan 3 (SP3)', infraction: 'Pencurian uang laci kasir, penggelapan setoran, atau pemalsuan struk QRIS', sanction: 'PHK Tanpa Pesangon & Proses Hukum Pidana Penggelapan Jabatan' },
    ];
  } else {
    // HR & Legal
    articles = [
      {
        number: '1.0',
        title: 'TUJUAN & LANDASAN HUKUM KETENAGAKERJAAN',
        content: [
          `SOP ini merupakan aturan resmi pelaksanaan tata tertib kerja, disiplin kehadiran, hak libur, dan pembinaan sumber daya manusia di lingkungan Barokah Grup (Ayam Bakar Surabaya, Pecel Lele Pak Haji, dan Ayam Pecak 2001 Seafood).`,
          'Berlandaskan UU No. 13 Tahun 2003 tentang Ketenagakerjaan jo UU Cipta Kerja No. 6 Tahun 2023 serta Surat Keputusan Direksi No. 001/V/2025/ADM-APS dan No. 003/IV/2026/SOP-BAROKAH.',
        ],
        callout: {
          type: 'info',
          title: 'KEPATUHAN MENGIKAT SELURUH CABANG',
          text: 'SOP ini berlaku mengikat seluruh kru tetap (PKWTT), kontrak (PKWT), maupun harian lepas di Outlet Senopati, Kemang, PIK, dan BSD tanpa terkecuali.',
        },
      },
      {
        number: '2.0',
        title: 'ATURAN JAM KERJA, SHIFT & PRESENSI BIOMETRIK WAJAH',
        content: [
          'Jam kerja reguler resto terbagi menjadi 2 shift utama: Shift Pagi (09:00 - 18:00 WIB) dan Shift Siang/Closing (14:00 - 23:00 WIB).',
          'Presensi kehadiran WAJIB menggunakan scan biometrik kontur wajah pada tablet outlet yang terhubung dengan GPS validasi outlet.',
          'Toleransi keterlambatan maksimal 5 menit. Keterlambatan >5 menit dikenakan sanksi pemotongan uang kehadiran sesuai matriks regulasi.',
        ],
      },
      {
        number: '3.0',
        title: 'KEBIJAKAN IZIN SETENGAH HARI & TUKAR SHIFT',
        content: [
          'IZIN SETENGAH HARI: Diberikan maksimal 4 jam kerja untuk keperluan mendesak dengan persetujuan tertulis Kepala Cabang H-1. Jam kerja yang ditinggalkan dipotong secara prorata atau diganti pada hari lain dalam bulan yang sama.',
          'TUKAR SHIFT: Wajib diajukan minimal 24 jam sebelumnya melalui Form Tukar Shift resmi dengan pengganti dari divisi dan kompetensi yang setara (misal Cook dengan Cook, Kasir dengan Kasir).',
        ],
      },
      {
        number: '4.0',
        title: 'LARANGAN LIBUR WEEKEND & HARI LIBUR NASIONAL (SK 001/V/2025)',
        content: [
          'Hari Sabtu, Minggu, dan Hari Libur Nasional (Tanggal Merah) adalah Hari Sibuk (Peak Sales Day) resto.',
          'Karyawan DILARANG KERAS mengajukan jatah libur (off) pada hari Sabtu, Minggu, dan Hari Libur Nasional.',
          'Pelanggaran dikenakan denda pemotongan payroll sebesar Rp 200.000 (hari weekend) dan Rp 250.000 (hari libur nasional).',
          'Bagi karyawan yang tidak mengambil jatah off reguler, perusahaan memberikan kompensasi insentif sebesar Rp 75.000 per hari kerja pengganti.',
        ],
      },
    ];

    kpis = [
      { metric: 'Tingkat Kehadiran Kru Outlet', target: 'Min 98.0%', tolerance: 'Maks 1x izin darurat/bulan', frequency: 'Bulanan' },
      { metric: 'Kepatuhan Jam Masuk (Zero Late)', target: '100% Tepat Waktu', tolerance: 'Maks 5 menit keterlambatan', frequency: 'Harian' },
      { metric: 'Pelanggaran Libur Weekend', target: '0 Kasus Mangkir', tolerance: '0 Toleransi (Denda Otomatis)', frequency: 'Bulanan' },
      { metric: 'Kepatuhan Penilaian Rapor Kru', target: 'Min Grade B', tolerance: 'Grade C wajib pembinaan HRD', frequency: 'Triwulanan' },
    ];

    penalties = [
      { tier: 'Denda Pemotongan Payroll', infraction: 'Mangkir / libur weekend tanpa izin (Sabtu/Minggu)', sanction: 'Denda Rp 200.000/hari dipotong langsung dari slip gaji bulan berjalan' },
      { tier: 'Surat Peringatan 1 (SP1)', infraction: 'Terlambat >3 kali sebulan atau izin setengah hari tanpa pemberitahuan H-1', sanction: 'SP1 berlaku 6 bulan & penangguhan insentif kerajinan' },
      { tier: 'Surat Peringatan 2 (SP2)', infraction: 'Mangkir 2 hari berturut-turut tanpa kabar dan tanpa surat dokter valid', sanction: 'SP2 + Penurunan plafon kasbon ke 0%' },
      { tier: 'Surat Peringatan 3 (SP3) / Resign', infraction: 'Mangkir 5 hari kerja berturut-turut atau memprovokasi mogok kerja tim resto', sanction: 'Dianggap mengundurkan diri (Auto-Resign) sesuai UU Ketenagakerjaan' },
    ];
  }

  // Append custom prompt if provided
  if (params.customNotes && params.customNotes.trim().length > 0) {
    articles.push({
      number: `${articles.length + 1}.0`,
      title: 'INSTRUKSI KHUSUS & KETENTUAN TAMBAHAN MANAJEMEN',
      content: [
        `Berdasarkan arahan khusus manajemen: "${params.customNotes.trim()}"`,
        'Instruksi ini bersifat komplementer dan memiliki kekuatan eksekusi setara dengan pasal-pasal sebelumnya.',
      ],
      callout: {
        type: 'info',
        title: 'CATATAN OPERASIONAL SPESIFIK',
        text: params.customNotes.trim(),
      },
    });
  }

  // Append final Signatures Article
  articles.push({
    number: `${articles.length + 1}.0`,
    title: 'LEMBAR PENGESAHAN DOKUMEN & OTORISASI 3 TINGKAT',
    content: [
      'SOP ini telah ditinjau dan disetujui secara berjenjang oleh Supervisor Operasional, Operations Manager, dan Direktur Utama Barokah Resto Grup.',
      'SOP ini mulai berlaku efektif sejak tanggal ditandatangani dan menggantikan seluruh instruksi lisan atau memo internal sebelumnya yang bertentangan.',
    ],
  });

  return {
    id: docId,
    skNumber,
    title: titleClean,
    category: params.category,
    station: params.station,
    riskLevel: params.riskLevel,
    effectiveDate: '20 Oktober 2026',
    revision: 'Rev. 01 (Edisi Standar Operasional 2026)',
    author: 'AI Resto Intelligence & SPV Operasional',
    reviewedBy: 'Operations Manager Barokah Grup',
    approvedBy: 'Arif Gunawan Panggabean (Direktur Utama)',
    scope: 'Seluruh Outlet Barokah Grup (Senopati, Kemang, PIK, BSD)',
    targetRoles: params.targetRoles.length > 0 ? params.targetRoles : ['Seluruh Kru Terkait'],
    legalReferences: params.references.length > 0 ? params.references : ['SK No. 001/V/2025/ADM-APS', 'SK No. 003/IV/2026/SOP-BAROKAH', 'Standar HACCP & ISO 22000'],
    summary: `SOP operasional baku untuk station ${params.station} mencakup standar prosedur, batasan toleransi KPI, protokol penanganan deviasi, dan matriks sanksi disiplin resmi.`,
    articles,
    kpis,
    penalties,
  };
}

interface AiSopStudioProps {
  onSaveSop: (sop: GeneratedSopDocument) => void;
  showToast: (msg: string) => void;
  employeesCount: number;
}

export function AiSopStudio({ onSaveSop, showToast, employeesCount }: AiSopStudioProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('KITCHEN (BOH)');
  const [selectedStation, setSelectedStation] = useState<string>('Station Penggorengan & Wok');
  const [topicInput, setTopicInput] = useState<string>('Prosedur Penggantian Minyak Goreng & Uji TPM Dapur');
  const [riskLevel, setRiskLevel] = useState<'KRITIS (HACCP/FINANCE)' | 'SEDANG (OPERASIONAL)' | 'STANDAR (RUTIN)'>('KRITIS (HACCP/FINANCE)');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['Cook / Koki', 'Station SPV', 'Kitchen Helper']);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([
    'SK No. 003/IV/2026/SOP-BAROKAH (Jam Kerja, Libur & Denda)',
    'Standar Keamanan Pangan HACCP & Suhu Pangan',
  ]);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedSopDocument | null>(() => {
    return synthesizeSopWithAi({
      category: 'KITCHEN (BOH)',
      station: 'Station Penggorengan & Wok',
      topic: 'SOP Penggantian Minyak Goreng & Uji TPM Dapur Multi-Outlet',
      riskLevel: 'KRITIS (HACCP/FINANCE)',
      references: ['SK No. 003/IV/2026/SOP-BAROKAH', 'Standar HACCP & ISO 22000'],
      targetRoles: ['Cook / Koki', 'Station SPV', 'Kitchen Helper'],
    });
  });

  const [activePreviewTab, setActivePreviewTab] = useState<'document' | 'kpis' | 'sanctions' | 'raw'>('document');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setGenerationStep('Menganalisis matriks risiko station & higienitas...');

    setTimeout(() => {
      setGenerationStep('Menyusun regulasi kepatuhan SK Barokah Grup & UU Cipta Kerja...');
    }, 400);

    setTimeout(() => {
      setGenerationStep('Menetapkan ambang batas Critical Control Points (CCP) & KPI...');
    }, 850);

    setTimeout(() => {
      setGenerationStep('Menyusun draf resmi, lembar pengesahan & matriks sanksi...');
    }, 1300);

    setTimeout(() => {
      const doc = synthesizeSopWithAi({
        category: selectedCategory,
        station: selectedStation,
        topic: topicInput,
        riskLevel,
        references: selectedRefs,
        targetRoles: selectedRoles,
        customNotes,
      });
      setGeneratedDoc(doc);
      setIsGenerating(false);
      showToast(`✨ SOP Berhasil Dibuat: "${doc.title}"`);
    }, 1700);
  };

  const handleCopyText = () => {
    if (!generatedDoc) return;
    const text = `
DOKUMEN RESMI BAROKAH RESTO GRUP
KODE DOKUMEN: ${generatedDoc.id}
NOMOR SK: ${generatedDoc.skNumber}
JUDUL: ${generatedDoc.title}
DIVISI: ${generatedDoc.category} | STATION: ${generatedDoc.station}
RISIKO: ${generatedDoc.riskLevel}
TANGGAL EFEKTIF: ${generatedDoc.effectiveDate}

${generatedDoc.articles
  .map(
    (a) => `
PASAL ${a.number} - ${a.title}
${a.content.join('\n\n')}
`
  )
  .join('\n')}

DISETUJUI OLEH:
- Disusun: ${generatedDoc.author}
- Ditinjau: ${generatedDoc.reviewedBy}
- Disahkan: ${generatedDoc.approvedBy}
    `.trim();

    navigator.clipboard.writeText(text);
    showToast('📋 Naskah lengkap SOP berhasil disalin ke clipboard!');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveToMaster = () => {
    if (!generatedDoc) return;
    onSaveSop(generatedDoc);
    showToast(`✅ Berhasil! "${generatedDoc.title}" telah disimpan ke Pustaka Master SOP.`);
  };

  const stationOptions: Record<string, string[]> = {
    'KITCHEN (BOH)': [
      'Station Penggorengan & Wok',
      'Station Pemanggangan & Bakar',
      'Station Butcher & Marinasi Daging',
      'Station Chiller & Penyimpanan Dingin',
      'Station Dishwashing & Sanitasi Alat',
    ],
    'SERVICE (FOH)': [
      'Dining Floor & Table Service',
      'Bar & Minuman Dingin/Panas',
      'Greeter & Reservasi Tamu',
      'Runner & Pengantaran Makanan',
      'Restroom & Area Publik Tamu',
    ],
    'CASHIER (POS)': [
      'Kasir Utama & Meja Front Counter',
      'Otorisasi Void & Rekonsiliasi EDC',
      'Manajemen Brankas & Kasbon Harian',
    ],
    'HR & LEGAL': [
      'HRD & Kepatuhan Tata Tertib',
      'Store Manager & Jadwal Shift',
      'Rekrutmen & Onboarding Kru',
    ],
  };

  return (
    <div className="space-y-6">
      {/* Hero Studio Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/80 to-slate-900 border border-amber-500/40 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded flex items-center gap-1">
              <Sparkles className="h-3 w-3 fill-slate-950" />
              AI RESTO INTELLIGENCE ENGINE
            </span>
            <span className="text-xs text-amber-300 font-bold flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              SOP Generator &amp; Operational Studio 2026
            </span>
          </div>
          <h3 className="text-lg font-black text-white tracking-tight">
            STUDIO PEMBUATAN SOP OTOMATIS BERBASIS AI MULTI-OUTLET
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Rancang dan terbitkan Standard Operating Procedure (SOP) resmi berstandar industri F&amp;B internasional dalam hitungan detik. Mengakomodasi regulasi ketenagakerjaan, batasan HACCP, toleransi KPI, dan sanksi SK Barokah Grup.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-right sm:text-left">
            <span className="text-[10px] text-slate-400 block font-bold">Cakupan Kru Terkoneksi:</span>
            <span className="font-mono text-lg font-black text-amber-400">
              {employeesCount} Staf Resto (4 Cabang)
            </span>
          </div>
        </div>
      </div>

      {/* Preset Quick Chips */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Template Rekomendasi Cepat (1-Klik Isi Form):
          </span>
          <span className="text-[11px] text-slate-400 font-medium">Pilih topik standar resto</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_SOP_PROMPTS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSelectedCategory(preset.category);
                setSelectedStation(preset.station);
                setTopicInput(preset.title);
                setRiskLevel(preset.riskLevel);
                setCustomNotes(preset.prompt);
                showToast(`Pola SOP "${preset.title}" terpilih`);
              }}
              className="text-left px-3 py-1.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 text-slate-700 hover:text-amber-900 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
              <span>{preset.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Grid (2 Columns: Controls on Left, Live Document Preview on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Parameters Control Panel */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <h4 className="font-black text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Layers className="h-4 w-4 text-amber-600" />
              <span>Parameter &amp; Rujukan Regulasi</span>
            </h4>

            {/* Divisi Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Divisi Operasional Restoran:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'KITCHEN (BOH)', label: '🍳 Kitchen (BOH)', icon: ChefHat },
                  { id: 'SERVICE (FOH)', label: '🍽️ Service (FOH)', icon: Users },
                  { id: 'CASHIER (POS)', label: '💵 Kasir & POS', icon: Wallet },
                  { id: 'HR & LEGAL', label: '👥 HRD & Disiplin', icon: Building2 },
                ].map((div) => {
                  const isSelected = selectedCategory === div.id;
                  return (
                    <button
                      key={div.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(div.id);
                        const firstSt = stationOptions[div.id]?.[0] || 'Station Kerja';
                        setSelectedStation(firstSt);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-extrabold border text-left transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{div.label}</span>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Station Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Station / Pos Kerja Spesifik:</label>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
              >
                {(stationOptions[selectedCategory] || []).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Judul / Topik Inti SOP:</label>
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="Misal: Standar Kebersihan Chiller & Suhu Unggas"
                className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {/* Risk Level Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Tingkat Risiko &amp; Dampak Regulasi:</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'KRITIS (HACCP/FINANCE)', label: '🔴 Kritis', desc: 'HACCP / Uang' },
                  { id: 'SEDANG (OPERASIONAL)', label: '🟡 Sedang', desc: 'Speed / Mutu' },
                  { id: 'STANDAR (RUTIN)', label: '🟢 Standar', desc: 'Grooming' },
                ].map((rl) => {
                  const isCur = riskLevel === rl.id;
                  return (
                    <button
                      key={rl.id}
                      type="button"
                      onClick={() => setRiskLevel(rl.id as any)}
                      className={`p-2 rounded-xl text-center border transition ${
                        isCur
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block text-[11px] font-extrabold">{rl.label}</span>
                      <span className="block text-[9px] text-slate-400">{rl.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Notes / Prompt Addition */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Instruksi Khusus / Catatan Tambahan (Opsional):
              </label>
              <textarea
                rows={3}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Tambahkan detail gramatur, suhu, batas waktu, atau larangan khusus yang ingin diwajibkan..."
                className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 placeholder:text-slate-400 resize-none"
              ></textarea>
            </div>

            {/* Generate Action Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerate}
              className={`w-full py-3.5 rounded-xl font-black text-xs flex items-center justify-center space-x-2 transition shadow-md ${
                isGenerating
                  ? 'bg-amber-300 text-amber-900 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-98 shadow-amber-500/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <RotateCcw className="h-4 w-4 animate-spin text-amber-900" />
                  <span>Sedang Merumuskan SOP Resmi...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 fill-slate-950" />
                  <span>Sintesis &amp; Buat SOP dengan AI</span>
                </>
              )}
            </button>

            {/* Animated Loading Status */}
            {isGenerating && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1 animate-pulse">
                <span className="font-extrabold block text-[10px] uppercase tracking-wider text-amber-700">
                  AI PROMPT SYNTHESIS IN PROGRESS
                </span>
                <p className="font-semibold text-xs text-slate-800">{generationStep}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Document Preview & Actions */}
        <div className="lg:col-span-7 space-y-4">
          {generatedDoc ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              {/* Document Header & Action Bar */}
              <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                      {generatedDoc.id}
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-extrabold uppercase">
                      STATUS: DOKUMEN RESMI
                    </span>
                  </div>
                  <h4 className="font-black text-sm text-white line-clamp-1">
                    {generatedDoc.title}
                  </h4>
                </div>

                {/* Document Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
                    title="Salin Naskah SOP"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Salin</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
                    title="Cetak Naskah Resmi"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Cetak</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveToMaster}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm active:scale-98"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Simpan ke Master SOP</span>
                  </button>
                </div>
              </div>

              {/* Sub-tab view inside Document Viewer */}
              <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-bold">
                {[
                  { id: 'document', label: '📄 Naskah Pasal Lengkap' },
                  { id: 'kpis', label: '📊 Toleransi Mutu & KPI' },
                  { id: 'sanctions', label: '⚖️ Klausul Sanksi' },
                  { id: 'raw', label: '📝 Ringkasan Teks' },
                ].map((tb) => {
                  const isAct = activePreviewTab === tb.id;
                  return (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => setActivePreviewTab(tb.id as any)}
                      className={`pb-2.5 px-3 border-b-2 font-extrabold transition ${
                        isAct
                          ? 'border-amber-600 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tb.label}
                    </button>
                  );
                })}
              </div>

              {/* Document Body */}
              <div className="p-6 space-y-6 max-h-[680px] overflow-y-auto font-sans text-slate-800 text-xs leading-relaxed">
                {/* Official Kop Surat Header */}
                <div className="rounded-xl overflow-hidden shadow-xs border border-amber-200/60 bg-white mb-2">
                  <img
                    src="/kop-surat-barokah.jpg"
                    alt="Kop Surat Resmi Barokah Grup"
                    className="w-full h-auto object-contain block"
                  />
                </div>

                {/* Metadata Strip */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-semibold">Nomor Registrasi:</span>
                    <span className="font-mono font-bold text-slate-900">{generatedDoc.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Nomor SK Direksi:</span>
                    <span className="font-mono font-bold text-amber-700">{generatedDoc.skNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Tingkat Risiko:</span>
                    <span className="font-bold text-rose-700">{generatedDoc.riskLevel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Tanggal Efektif:</span>
                    <span className="font-bold text-slate-900">{generatedDoc.effectiveDate}</span>
                  </div>
                </div>

                {/* TAB 1: FULL DOCUMENT ARTICLES */}
                {activePreviewTab === 'document' && (
                  <div className="space-y-6">
                    {generatedDoc.articles.map((art, idx) => (
                      <section key={idx} className="space-y-2 border-b border-slate-100 pb-5 last:border-0">
                        <div className="flex items-center justify-between">
                          <h5 className="font-black text-slate-950 text-xs uppercase tracking-tight flex items-center gap-1.5">
                            <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-mono">
                              PASAL {art.number}
                            </span>
                            <span>{art.title}</span>
                          </h5>
                        </div>

                        {art.content.map((p, pIdx) => (
                          <p key={pIdx} className="text-slate-700 leading-relaxed text-xs">
                            {p}
                          </p>
                        ))}

                        {/* Callout Box if exists */}
                        {art.callout && (
                          <div
                            className={`p-3.5 rounded-xl border text-xs font-medium space-y-1 ${
                              art.callout.type === 'critical'
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : art.callout.type === 'warning'
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-blue-50 border-blue-200 text-blue-900'
                            }`}
                          >
                            <span className="font-extrabold uppercase text-[10px] tracking-wider block">
                              {art.callout.title}
                            </span>
                            <p>{art.callout.text}</p>
                          </div>
                        )}

                        {/* Table if exists */}
                        {art.table && (
                          <div className="overflow-x-auto rounded-xl border border-slate-200 mt-2">
                            <table className="w-full text-left text-[11px]">
                              <thead>
                                <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                                  {art.table.headers.map((h, hIdx) => (
                                    <th key={hIdx} className="py-2 px-3">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {art.table.rows.map((r, rIdx) => (
                                  <tr key={rIdx} className="hover:bg-slate-50/80">
                                    {r.map((cell, cIdx) => (
                                      <td key={cIdx} className="py-2 px-3 font-medium text-slate-800">
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    ))}

                    {/* Official Signatures Strip */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-6 space-y-3">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block text-center">
                        LEMBAR OTORISASI &amp; PENGESAHAN RESMI (3-TIER APPROVAL)
                      </span>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-8">
                          <span className="text-[10px] font-bold text-slate-400 block">Dibuat Oleh:</span>
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 block">{generatedDoc.author}</span>
                            <span className="text-[9px] text-slate-400">Unit Operasional</span>
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-8">
                          <span className="text-[10px] font-bold text-slate-400 block">Ditinjau Oleh:</span>
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 block">{generatedDoc.reviewedBy}</span>
                            <span className="text-[9px] text-slate-400">Operations Manager</span>
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-8">
                          <span className="text-[10px] font-bold text-slate-400 block">Disahkan Oleh:</span>
                          <div>
                            <span className="font-extrabold text-xs text-emerald-700 block">{generatedDoc.approvedBy}</span>
                            <span className="text-[9px] text-slate-400">Direktur Utama Barokah Grup</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: KPIS & TOLERANCES */}
                {activePreviewTab === 'kpis' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                      Ambang batas toleransi kualitas dan parameter kinerja yang wajib diuji secara berkala oleh Supervisor:
                    </p>
                    <div className="space-y-2.5">
                      {generatedDoc.kpis.map((kpi, kIdx) => (
                        <div
                          key={kIdx}
                          className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-slate-900 block">{kpi.metric}</span>
                            <span className="text-[11px] text-slate-500 block">
                              Target Mutu: <strong className="text-emerald-700">{kpi.target}</strong>
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                              Toleransi: {kpi.tolerance}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-1">Audit: {kpi.frequency}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: SANCTIONS MATRIX */}
                {activePreviewTab === 'sanctions' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                      Matriks penegakan disiplin berjenjang berdasarkan regulasi Barokah Resto Grup:
                    </p>
                    <div className="space-y-2.5">
                      {generatedDoc.penalties.map((pen, pIdx) => (
                        <div
                          key={pIdx}
                          className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                              {pen.tier}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-900">Pelanggaran: {pen.infraction}</p>
                          <p className="text-[11px] text-slate-600">Sanksi: {pen.sanction}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 4: RAW TEXT SUMMARY */}
                {activePreviewTab === 'raw' && (
                  <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-2 whitespace-pre-wrap leading-relaxed">
                    {`# DOKUMEN RESMI BAROKAH RESTO GRUP
KODE DOKUMEN: ${generatedDoc.id}
NOMOR SK: ${generatedDoc.skNumber}
JUDUL: ${generatedDoc.title}
DIVISI: ${generatedDoc.category} | STATION: ${generatedDoc.station}
RISIKO: ${generatedDoc.riskLevel}
TANGGAL EFEKTIF: ${generatedDoc.effectiveDate}

RINGKASAN REGULASI:
${generatedDoc.summary}

CAKUPAN KRU RESTO:
${generatedDoc.scope} (Target: ${generatedDoc.targetRoles.join(', ')})
RUJUKAN HUKUM: ${generatedDoc.legalReferences.join('; ')}`}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
              <Sparkles className="h-10 w-10 text-amber-500 mx-auto animate-bounce" />
              <h4 className="font-black text-slate-900 text-base">Studio Siap Digunakan</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Pilih parameter operasional di sisi kiri atau klik salah satu rekomendasi cepat, lalu tekan &quot;Sintesis &amp; Buat SOP dengan AI&quot;.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AiSopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSop: (sop: GeneratedSopDocument) => void;
  showToast: (msg: string) => void;
  employeesCount: number;
}

export function AiSopModal({ isOpen, onClose, onSaveSop, showToast, employeesCount }: AiSopModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-6xl w-full p-6 shadow-2xl space-y-5 max-h-[94vh] overflow-y-auto border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">
                AI SOP Generator Workbench
              </h3>
              <p className="text-xs text-slate-400">
                Pembuatan Standard Operating Procedure (SOP) Berbasis AI untuk Barokah Resto Grup
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <AiSopStudio
          onSaveSop={(sop) => {
            onSaveSop(sop);
            onClose();
          }}
          showToast={showToast}
          employeesCount={employeesCount}
        />
      </div>
    </div>
  );
}

interface AiSopOfficialViewerModalProps {
  sop: GeneratedSopDocument | null;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export function AiSopOfficialViewerModal({ sop, onClose, showToast }: AiSopOfficialViewerModalProps) {
  if (!sop) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const text = `
DOKUMEN RESMI BAROKAH RESTO GRUP
KODE DOKUMEN: ${sop.id}
NOMOR SK: ${sop.skNumber}
JUDUL: ${sop.title}
DIVISI: ${sop.category} | STATION: ${sop.station}
RISIKO: ${sop.riskLevel}
TANGGAL EFEKTIF: ${sop.effectiveDate}

${sop.articles
  .map(
    (a) => `
PASAL ${a.number} - ${a.title}
${a.content.join('\n\n')}
`
  )
  .join('\n')}

DISETUJUI OLEH:
- Disusun: ${sop.author}
- Ditinjau: ${sop.reviewedBy}
- Disahkan: ${sop.approvedBy}
    `.trim();

    navigator.clipboard.writeText(text);
    showToast('📋 Naskah lengkap SOP berhasil disalin!');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto border border-slate-200 font-sans text-slate-900">
        {/* Header / Kop Surat Resmi Barokah Grup */}
        <div className="relative mb-3">
          <div className="absolute right-2 top-2 flex items-center gap-1.5 z-10">
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition bg-white/80 shadow-xs border border-slate-200"
              title="Salin Naskah"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition bg-white/80 shadow-xs border border-slate-200"
              title="Cetak SOP"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition bg-white/80 shadow-xs border border-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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
              No Registrasi : <span className="font-mono text-amber-700">{sop.id}</span>
            </p>
            <p className="font-bold text-slate-900 mt-0.5">
              SK Direksi : <span className="text-slate-800 font-mono">{sop.skNumber}</span>
            </p>
            <p className="font-bold text-slate-900 mt-0.5">
              Perihal : <span className="text-slate-800">{sop.title}</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full font-bold text-[10px] uppercase block mb-1">
              STATUS: SOP RESMI AKTIF &amp; MENGIKAT
            </span>
            <span className="text-[10px] text-slate-400 block">Efektif: {sop.effectiveDate}</span>
          </div>
        </div>

        {/* Body of SOP (Articles) */}
        <div className="space-y-5 text-xs text-slate-800 leading-relaxed">
          {sop.articles.map((art, idx) => (
            <section key={idx} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
              <h4 className="font-black text-slate-950 text-sm uppercase flex items-center gap-2">
                <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-mono">
                  PASAL {art.number}
                </span>
                <span>{art.title}</span>
              </h4>

              {art.content.map((c, cIdx) => (
                <p key={cIdx} className="text-slate-700">
                  {c}
                </p>
              ))}

              {art.callout && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium space-y-1 my-2 ${
                    art.callout.type === 'critical'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : art.callout.type === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-blue-50 border-blue-200 text-blue-900'
                  }`}
                >
                  <span className="font-bold uppercase text-[10px] block">{art.callout.title}</span>
                  <p>{art.callout.text}</p>
                </div>
              )}

              {art.table && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 mt-2">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                        {art.table.headers.map((h, hIdx) => (
                          <th key={hIdx} className="py-2 px-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {art.table.rows.map((r, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/80">
                          {r.map((cell, cellIdx) => (
                            <td key={cellIdx} className="py-2 px-3 font-medium text-slate-800">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          {/* KPI Tolerance Card */}
          {sop.kpis && sop.kpis.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 block">
                Ambang Batas Toleransi Mutu &amp; KPI Station:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {sop.kpis.map((kpi, kIdx) => (
                  <div key={kIdx} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-0.5">
                    <span className="font-bold text-slate-900 block">{kpi.metric}</span>
                    <span className="text-slate-500 block">
                      Target: <strong className="text-emerald-700">{kpi.target}</strong> (Toleransi: {kpi.tolerance})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3-Tier Signatures */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-6 space-y-3">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block text-center">
              LEMBAR PENGESAHAN RESMI (3-TIER APPROVAL)
            </span>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-8">
                <span className="text-[10px] font-bold text-slate-400 block">Dibuat Oleh:</span>
                <div>
                  <span className="font-extrabold text-xs text-slate-900 block">{sop.author}</span>
                  <span className="text-[9px] text-slate-400">Unit Operasional</span>
                </div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-8">
                <span className="text-[10px] font-bold text-slate-400 block">Ditinjau Oleh:</span>
                <div>
                  <span className="font-extrabold text-xs text-slate-900 block">{sop.reviewedBy}</span>
                  <span className="text-[9px] text-slate-400">Operations Manager</span>
                </div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-8">
                <span className="text-[10px] font-bold text-slate-400 block">Disahkan Oleh:</span>
                <div>
                  <span className="font-extrabold text-xs text-emerald-700 block">{sop.approvedBy}</span>
                  <span className="text-[9px] text-slate-400">Direktur Utama Barokah Grup</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
          >
            Tutup Naskah
          </button>
        </div>
      </div>
    </div>
  );
}
