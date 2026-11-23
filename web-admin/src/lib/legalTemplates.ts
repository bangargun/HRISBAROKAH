// Teks acuan statis untuk Surat & Kontrak: isi bawaan surat edaran dan pustaka klausul baku.
// Bukan data transaksi; surat yang diterbitkan disimpan di server.

export interface LegalClause {
  id: string;
  title: string;
  category: string;
  badge: string;
  badgeColor: string;
  text: string;
  legalReference?: string;
  isAiGenerated?: boolean;
  createdAt?: string;
}

export const EDARAN_TEMPLATES: Record<string, string> = {
  SE_LIBUR_OPERASIONAL: `1. Dalam rangka menyambut Hari Libur Nasional / Libur Hari Raya, manajemen menetapkan penyesuaian jam operasional seluruh outlet jaringan restoran Barokah Grup.\n2. Seluruh outlet operasional wajib memastikan closing inventori bahan baku, pemadaman instalasi gas LPG & listrik, serta sanitasi total area dapur/dining sebelum jam tutup.\n3. Mengingat periode ini merupakan PEAK SEASON pelayanan resto dengan lonjakan pengunjung, seluruh staf dan pimpinan cabang TIDAK DIPERKENANKAN mengambil libur tanpa persetujuan tertulis manajemen pusat.\n4. Pelanggaran mangkir atau libur sepihak pada Hari Libur Nasional dikenakan sanksi DENDA Rp 250.000,-/hari serta penerbitan Surat Peringatan (SP) sesuai klausul PKWT.\n5. Insentif omzet dan uang makan tetap dibayarkan penuh bagi seluruh kru yang bertugas menjaga kelancaran operasional.`,
  SE_KUOTA_LIBUR: `1. Menegaskan kembali SOP-HR-001 & SOP-HR-003: Jatah libur reguler kru adalah 2 (dua) hari per bulan kalender dan HANYA dapat diambil pada hari kerja biasa (weekday: Senin s/d Kamis).\n2. DILARANG KERAS mengambil jatah libur pada akhir pekan (Jumat malam, Sabtu, atau Minggu). Pelanggaran libur di weekend dikenakan denda Rp 200.000,-/hari.\n3. Kuota harian cabang berlaku baku: cabang dengan < 8 staf maksimal 1 orang libur per hari; cabang dengan >= 8 staf maksimal 2 orang libur per hari (wajib beda stasiun kerja BOH Kitchen & FOH Service).\n4. Pengajuan libur wajib disubmit melalui sistem HRIS minimal H-3 sebelum tanggal libur. Pengajuan mendadak (< H-3) pada weekday dikenakan denda Rp 50.000,-/hari.\n5. Jika jatah libur bulanan tidak diambil hingga akhir bulan berjalan (memilih tetap bertugas penuh), karyawan berhak atas Kompensasi Insentif Tunai Rp 75.000,- per hari yang langsung dibayarkan bersama slip gaji.`,
  SE_CUTI_TAHUNAN: `1. Berdasarkan SOP-HR-007 tentang Cuti Tahunan Berjenjang, seluruh karyawan dengan masa kerja minimal 1 (satu) tahun penuh berhak atas Cuti Tahunan Berbayar (Upah Pokok dibayar 100% penuh).\n2. Besaran hak cuti tahunan: Masa kerja 1 tahun = 1 hari; masa kerja 2 tahun = 2 hari; dan bertambah 1 hari untuk setiap penambahan masa kerja 1 tahun berikutnya secara berjenjang.\n3. Pengambilan cuti tahunan wajib mematuhi 4 GUARDRAILS KETAT: (a) Dilarang digabungkan dengan jatah libur reguler 2 hari bulanan; (b) Dilarang diambil pada akhir pekan (Sabtu/Minggu); (c) Dilarang diambil pada Hari Libur Nasional / Peak Season; (d) Dilarang disambung langsung sebelum/sesudah cuti bersama Lebaran.\n4. Pengajuan cuti tahunan wajib diajukan melalui sistem HRIS minimal H-7 sebelum tanggal cuti dan wajib disetujui oleh Kepala Cabang serta Supervisor Area.`,
  SE_CUSTOM: `1. Seluruh pimpinan cabang dan kru wajib senantiasa menjaga standar kebersihan, higienitas pengolahan makanan (HACCP), dan keramahan pelayanan kepada tamu.\n2. Koordinasi operasional harian antar-stasiun (BOH Kitchen & FOH Service) wajib berjalan tertib sesuai SOP baku Barokah Grup.\n3. Himbauan ini berlaku efektif sejak tanggal diterbitkan untuk dilaksanakan dengan penuh rasa tanggung jawab demi kemajuan bersama.`,
};

export const LEGAL_CLAUSES: LegalClause[] = [
  {
    id: 'CLS-001',
    title: 'Klausul Kerahasiaan Resep & Bumbu Rahasia (Kitchen NDA)',
    category: 'BOH Kitchen & Resep',
    badge: 'Proteksi Aset',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    text: 'Karyawan berkewajiban menjaga kerahasiaan komposisi resep masakan, bumbu marinasi, takaran gramasi, dan proses memasak milik Restoran Barokah Grup, baik selama masa kerja maupun setelah berakhirnya hubungan kerja.',
    legalReference: 'UU No. 30 Tahun 2000 tentang Rahasia Dagang',
    createdAt: 'Standar SOP 2026',
  },
  {
    id: 'CLS-002',
    title: 'Klausul Higienitas & Kepatuhan Sanitasi Standar HACCP',
    category: 'Hygiene & Food Safety',
    badge: 'SOP Dapur',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    text: 'Karyawan wajib mematuhi 6 langkah cuci tangan berkala, mengenakan penutup kepala dan apron bersih, tidak mengenakan perhiasan berlebih pada area pengolahan makanan, serta menjaga kebersihan stasiun kerja sesuai pedoman kebersihan dinas kesehatan.',
    legalReference: 'Permenkes No. 1096/Menkes/PER/VI/2011 tentang Higiene Sanitasi Jasaboga',
    createdAt: 'Standar SOP 2026',
  },
  {
    id: 'CLS-003',
    title: 'Klausul Jadwal Roster, Kuota Libur Cabang & Denda Peak Season (SOP-HR-003)',
    category: 'Jam Kerja & Operasional',
    badge: 'SOP-HR-003',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    text: 'Karyawan bersedia mematuhi sistem shift kerja operasional restoran dan jatah libur reguler 2 hari per bulan pada hari kerja biasa (weekday). Kuota harian cabang diatur baku: cabang dengan < 8 staf maksimal 1 orang libur per hari; cabang dengan >= 8 staf maksimal 2 orang libur per hari (wajib beda stasiun kerja). Pengambilan libur di akhir pekan (Sabtu/Minggu) dikenakan sanksi denda Rp 200.000/hari, dan libur pada Hari Libur Nasional (yang dikonfirmasi resmi oleh manajemen melalui Surat Keterangan / Pengumuman Peak Season) dikenakan sanksi denda Rp 250.000/hari. Pengajuan libur mendadak (< H-3) pada weekday memotong jatah libur dan dikenakan denda Rp 50.000/hari. Apabila jatah libur bulanan habis dan mengambil izin tambahan, upah harian tidak dibayar serta dikenakan denda Rp 15.000/hari untuk staf atau Rp 25.000/hari untuk leader.',
    legalReference: 'SOP-HR-003 & PP No. 35 Tahun 2021 (Waktu Kerja & Operasional Resto)',
    createdAt: 'Standar SOP 2026',
  },
  {
    id: 'CLS-004',
    title: 'Klausul Masa Percobaan (3 Bulan) & Ketentuan Kasbon (SOP-HR-004 & SOP-HR-002)',
    category: 'Status Ketenagakerjaan',
    badge: 'Evaluasi & Kasbon',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    text: 'Karyawan menjalani masa evaluasi kerja selama 3 (tiga) bulan. Sesuai SOP-HR-004 Pasal 4.2, karyawan baru yang belum genap 3 (tiga) bulan bekerja atau masih dalam skema penyesuaian gaji DILARANG KERAS mengajukan pinjaman kasbon. Fasilitas pinjaman kasbon darurat (plafon maksimal 50% gaji pokok sesuai SOP-HR-002) baru dapat diakses setelah karyawan genap 3 bulan masa kerja dan berstatus staf resmi, dibuka pada jendela H+10 s.d. H-10 sebelum gajian.',
    legalReference: 'SOP-HR-004 Pasal 4.2 & SOP-HR-002 Barokah Culinary Group',
    createdAt: 'Standar SOP 2026',
  },
  {
    id: 'CLS-005',
    title: 'Klausul Mutasi Antar-Outlet & Kontinuitas Masa Kerja (SOP-HR-005)',
    category: 'Penempatan & Mutasi',
    badge: 'Mutasi Cabang',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    text: 'Pemindahtugasan (mutasi) antar-outlet Barokah Group dilakukan tanpa pemutusan hubungan kerja. Masa kerja dihitung secara akumulatif sejak tanggal pertama bergabung di Barokah Group (tidak pernah reset ke nol), hak tunjangan lama bekerja (SOP-HR-005) tetap berlanjut penuh, dan presensi biometrik wajah otomatis disinkronkan ke outlet tujuan.',
    legalReference: 'PP No. 35 Tahun 2021 & SOP-HR-005 Barokah Culinary Group',
    createdAt: 'Standar SOP 2026',
  },
  {
    id: 'CLS-006',
    title: 'Klausul Hak Libur Operasional, Cuti Khusus, Sakit Rawat Inap & Upah Prorata (SOP-HR-006)',
    category: 'Waktu Kerja & Cuti Resto',
    badge: 'SOP-HR-006',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    text: 'PIHAK KEDUA memahami dan menyepakati sistem operasional restoran Barokah Group dengan jatah libur reguler 2 (dua) hari per bulan kalender tanpa hari libur nasional/tanggal merah. Ketentuan cuti khusus, sakit, dan pemotongan upah mengacu pada SOP-HR-006: (a) Cuti dibayar penuh: Karyawan menikah (3 hari), duka cita keluarga inti orang tua/anak/pasangan (3 hari pertama dari total 7 hari), duka cita keluarga serumah (1 hari), istri melahirkan/keguguran (2 hari), musibah kebakaran tempat tinggal (3 hari), dan musibah kebanjiran (2 hari). (b) Sakit yang dapat diklaim: HANYA sakit rawat inap (opname Rumah Sakit) dengan surat keterangan resmi RS, di mana upah pokok dibayar penuh maksimal 3 (tiga) hari pertama saja; hari ke-4 dan seterusnya tidak dibayar (unpaid), serta selama rawat inap TIDAK MENDAPAT uang makan dan TIDAK MENDAPAT uang lembur. Sakit rawat jalan tidak dibayar (unpaid). (c) Cuti tidak dibayar (Unpaid / potong gaji prorata harian): Pengurusan legalitas nikah/cerai (2 hari unpaid), sisa masa duka cita keluarga inti (4 hari unpaid), cuti melahirkan karyawati 30 hari (3 hari dibayar, 27 hari unpaid), cuti keguguran 14 hari (3 hari dibayar, 11 hari unpaid), dan ibadah umroh 14 hari (unpaid penuh). Hari izin/cuti tidak dibayar otomatis memotong upah secara prorata harian (Gaji Pokok / 30 hari), serta pada hari tersebut karyawan TIDAK MENDAPAT uang makan dan TIDAK MENDAPAT uang lembur.',
    legalReference: 'SOP-HR-006 & SOP-HR-003 Barokah Culinary Group 2026',
    createdAt: 'Standar SOP 2026',
  },
  {
    id: 'CLS-007',
    title: 'Klausul Hak Cuti Tahunan Berjenjang Berdasarkan Masa Kerja (SOP-HR-007)',
    category: 'Waktu Kerja & Cuti Resto',
    badge: 'SOP-HR-007',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    text: 'PIHAK KEDUA yang telah memiliki masa kerja minimal 1 (satu) tahun berhak atas Cuti Tahunan Berjenjang dengan upah terhitung (tetap dibayar penuh) sesuai SOP-HR-007: masa kerja 1 tahun berhak atas 1 hari cuti, masa kerja 2 tahun berhak atas 2 hari cuti, dan bertambah 1 hari untuk setiap kelipatan 1 tahun masa kerja seterusnya. Pengambilan cuti tahunan tunduk pada guardrails operasional ketat: (a) Tidak dapat digabungkan dengan jatah libur reguler bulanan; (b) Tidak dapat diambil pada akhir pekan (weekend: Sabtu atau Minggu); (c) Tidak dapat diambil pada Hari Libur Nasional / Tanggal Merah; dan (d) Tidak dapat menyambung sebelum atau sesudah libur Hari Raya Idul Fitri (Lebaran). Pengajuan wajib dilakukan minimal H-7 dan disetujui Kepala Cabang serta HRD.',
    legalReference: 'SOP-HR-007 & UU Ketenagakerjaan (Hak Cuti Tahunan Berbayar)',
    createdAt: 'Standar SOP 2026',
  },
  {
    id: 'CLS-008',
    title: 'Klausul Konsekuensi Finansial Resign di Tengah Jalan (Wanprestasi PKWT)',
    category: 'Pengakhiran Hubungan Kerja & Wanprestasi',
    badge: 'WANPRESTASI PKWT',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    text: 'PIHAK KEDUA menyatakan mengerti dan menyepakati bahwa masa ikatan kerja yang disepakati adalah bersifat mengikat sampai berakhirnya perjanjian kerja (PKWT) ini. Apabila PIHAK KEDUA memutuskan untuk mengundurkan diri (resign), berhenti bekerja, atau meninggalkan tugas operasional di tengah jalan sebelum masa kontrak berakhir tanpa persetujuan tertulis dari Direksi PIHAK PERTAMA, maka perbuatan tersebut dikategorikan sebagai tindakan wanprestasi (pelanggaran berat ikatan kontrak). Atas pengunduran diri sepihak tersebut, PIHAK PERTAMA (Perusahaan) DIBEBASKAN SEPENUHNYA DARI SEGALA KEWAJIBAN PEMBAYARAN UANG PESANGON, UANG KOMPENSASI KONTRAK, SERTA UPAH/GAJI POKOK BESERTA SELURUH TUNJANGAN (UANG MAKAN, LEMBUR, TUNJANGAN MASA KERJA, DAN INSENTIF) YANG BELUM DIBAYARKAN PADA BULAN/PERIODE BERJALAN. Seluruh sisa hak finansial tersebut secara otomatis disepakati beralih dan dikompensasikan penuh sebagai ganti rugi operasional atas kerugian terganggunya layanan restoran, dan PIHAK KEDUA melepaskan hak penuntutan hukum dalam bentuk apa pun di kemudian hari.',
    legalReference: 'Pasal 1338 KUHPerdata, Pasal 62 UU No. 13/2003 & Peraturan Perusahaan Barokah Group 2026',
    createdAt: 'Standar SOP 2026',
  },
  {
    id: 'CLS-009',
    title: 'Klausul Izin Setengah Hari & Kehadiran Parsial (SOP Operasional Bab 5)',
    category: 'Tata Tertib Kehadiran & Shift',
    badge: 'IZIN SETENGAH HARI',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    text: 'PIHAK KEDUA menyatakan memahami dan mematuhi ketentuan kehadiran parsial / izin pulang setengah hari sesuai SOP Bab 5: (1) Kehadiran > 50% Jam Kerja pada hari kerja biasa (weekday) tetap memperoleh hak upah pokok harian, namun uang makan dinas (Rp 20.000) dan upah lembur ditiadakan (tidak dibayar); (2) Kehadiran > 50% Jam Kerja pada Weekend / Hari Libur Nasional tidak berhak atas gaji pokok harian, uang makan, maupun lembur (tanpa denda tambahan); (3) Kehadiran 25% s/d 50% Jam Kerja pada hari biasa tidak berhak atas upah harian/makan/lembur (tanpa denda), namun bila terjadi pada Weekend / Hari Libur Nasional dikenakan DENDA Rp 100.000,- karena gangguan pelayanan jam sibuk restoran; (4) Kehadiran < 25% Jam Kerja dikualifikasikan sebagai TIDAK MASUK KERJA (MANGKIR), dikenakan Surat Peringatan 1 (SP1), dan tambahan DENDA Rp 200.000,- jika terjadi pada Weekend / Hari Libur Nasional; (5) Seluruh permohonan izin setengah hari wajib diajukan minimal H-1 untuk izin terencana atau segera lapor pada kondisi darurat dengan persetujuan tertulis Kepala Cabang / Supervisor serta memastikan adanya rekan kru pengganti (cover station).',
    legalReference: 'SOP Operasional Restoran Bab 5 (Ketentuan Masuk/Pulang Setengah Hari) & Peraturan Perusahaan 2026',
    createdAt: 'Standar SOP 2026',
  },
];
