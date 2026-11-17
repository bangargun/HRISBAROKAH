/**
 * Daftar foto laporan harian cabang (SOP operasional). Satu-satunya sumber daftar ini:
 * web admin dan aplikasi HP mengambilnya dari GET /daily-reports/checklist.
 */
export const DAILY_REPORT_CATEGORIES = {
  OPENING_BOH: "Persiapan Dapur (BOH)",
  OPENING_FOH: "Display & Kasir (FOH)",
  HYGIENE_MID: "Kebersihan & Hygiene",
  CLOSING: "Penutupan Toko (Closing)",
} as const;

export type DailyReportCategory = keyof typeof DAILY_REPORT_CATEGORIES;

export interface DailyReportChecklistItem {
  key: string;
  title: string;
  category: DailyReportCategory;
  targetTime: string;
  description: string;
}

export const DAILY_REPORT_CHECKLIST: DailyReportChecklistItem[] = [
  {
    key: "ayam_bebek_rebus",
    title: "Ayam & Bebek Selesai Direbus & Dibersihkan",
    category: "OPENING_BOH",
    targetTime: "Sebelum 09:30 WIB",
    description: "Ayam & bebek dibersihkan dari sisa bulu/lemak, direbus & diungkep bumbu kuning rempah matang merata di wadah bersih tertutup.",
  },
  {
    key: "nasi_nasi_uduk",
    title: "Nasi Putih Pulen & Nasi Uduk Gurih Matang",
    category: "OPENING_BOH",
    targetTime: "Sebelum 09:30 WIB",
    description: "Magic warmer/rice cooker menyala, ketersediaan nasi putih pulen dan nasi uduk gurih wangi siap saji sebelum pintu buka.",
  },
  {
    key: "chiller_freezer",
    title: "Chiller / Freezer Terbuka yang Rapi",
    category: "OPENING_BOH",
    targetTime: "Sebelum 09:30 WIB",
    description: "Pintu chiller/freezer terbuka menunjukkan susunan bahan baku rapi, suhu 0°C - 4°C, berlabel tanggal FIFO.",
  },
  {
    key: "dapur_bersih",
    title: "Dapur Bersih & Kompor Siap Nyala",
    category: "OPENING_BOH",
    targetTime: "Sebelum 09:30 WIB",
    description: "Lantai dapur BOH disapu & dipel kering tidak licin/berminyak, exhaust hood bersih, burner kompor siap operasional.",
  },
  {
    key: "stelling_display",
    title: "Stelling (Etalase Kaca Display Makanan)",
    category: "OPENING_FOH",
    targetTime: "Sebelum 09:45 WIB",
    description: "Kaca stelling etalase bening mengkilap bebas minyak, potongan ayam/bebek ungkep tersusun rapi & tertutup rapat dari lalat/debu.",
  },
  {
    key: "kasir_tablet_printer_modal",
    title: "Kasir: Tablet POS, Printer Thermal, Struk & Modal",
    category: "OPENING_FOH",
    targetTime: "Sebelum 09:45 WIB",
    description: "Tablet POS touchscreen online, printer thermal ready dengan tes cetak struk penjualan, dan laci uang modal pecahan siap kembalian.",
  },
  {
    key: "dining_area",
    title: "Dining Area Siap Sambut Tamu Pertama",
    category: "OPENING_FOH",
    targetTime: "Sebelum 09:50 WIB",
    description: "Meja & kursi tertata rapi, lantai disapu & dipel wangi, AC/kipas sejuk, playlist resto menyala siap sambut tamu.",
  },
  {
    key: "meja_plating",
    title: "Meja Plating Bersih & Siap Saji",
    category: "HYGIENE_MID",
    targetTime: "Rutin Setiap Shift",
    description: "Meja stainless plating bersih steril, bebas ceceran kuah/minyak, wadah sambal dan lalapan tertutup higienis.",
  },
  {
    key: "toilet_bersih",
    title: "Toilet Tamu & Staf Bersih & Wangi",
    category: "HYGIENE_MID",
    targetTime: "Cek Berkala Tiap 2 Jam",
    description: "Lantai toilet kering, kloset bersih disikat, sabun cuci tangan & tisu terisi penuh, aroma wangi segar.",
  },
  {
    key: "wastafel_tamu",
    title: "Wastafel Cuci Tangan Tamu",
    category: "HYGIENE_MID",
    targetTime: "Rutin Setiap Pergantian Tamu",
    description: "Cermin bening bebas noda cipratan, wastafel kinclong air mengalir lancar, sabun cair terisi penuh.",
  },
  {
    key: "cuci_piring_stewarding",
    title: "Area Cuci Piring (Stewarding) & Rak Peniris",
    category: "HYGIENE_MID",
    targetTime: "Rutin Setiap Shift",
    description: "Wastafel cuci piring bersih, piring tersusun rapi di rak peniris, tidak ada lemak menumpuk di saluran/grease trap.",
  },
  {
    key: "closing_dapur_kompor",
    title: "Closing: Dapur Deep Cleaning & Kompor/Gas Mati",
    category: "CLOSING",
    targetTime: "Selesai 22:30 WIB",
    description: "Kompor mati total, regulator tabung gas dicabut/dikunci aman (fire safety), grease trap dibersihkan, lantai dipel bersih.",
  },
  {
    key: "closing_kasir_rekap",
    title: "Closing: Rekap Kasir & Printout Struk Settlement",
    category: "CLOSING",
    targetTime: "Selesai 22:30 WIB",
    description: "Printout struk settlement closing POS + uang fisik tunai di laci dihitung cocok tanpa selisih, siap disetor/brankas.",
  },
  {
    key: "closing_pintu_gembok",
    title: "Closing: Pintu & Gembok Toko Terkunci Rapat",
    category: "CLOSING",
    targetTime: "Selesai 22:45 WIB",
    description: "Seluruh sakelar non-chiller dimatikan, rolling door/pintu dan gembok cabang terkunci rapat aman ditinggalkan malam.",
  },
];

export const DAILY_REPORT_KEYS = new Set(DAILY_REPORT_CHECKLIST.map((i) => i.key));
