/** Checklist sidak SPV: 14 titik, total 100 poin. Skor dihitung server dari titik yang lolos. */
export const INSPECTION_AREAS = {
  FOH: 'Area depan (FOH)',
  BOH: 'Dapur (BOH)',
  TASTE: 'Cita rasa & porsi',
  CASH: 'Kasir & administrasi',
} as const;

export const INSPECTION_CHECKLIST = [
  { key: 'fohGrooming', area: 'FOH' as keyof typeof INSPECTION_AREAS, points: 7, title: "Grooming & Keseragaman Kru FOH", description: "Seragam bersih, apron rapi, penutup kepala/hairnet terpasang, nametag dipakai, kuku pendek dan bersih." },
  { key: 'fohCleanliness', area: 'FOH' as keyof typeof INSPECTION_AREAS, points: 6, title: "Kebersihan Meja, Lantai Dining & Suasana Makan", description: "Meja bebas noda minyak, lantai kering dan disapu/pel rutin, AC/ventilasi dingin nyaman, tempat tisu terisi." },
  { key: 'fohCashierGreeting', area: 'FOH' as keyof typeof INSPECTION_AREAS, points: 6, title: "Area Kasir, Greeting & Kecepatan Struk POS", description: "Kasir menyapa ramah (greeting), struk diberikan ke tamu, meja kasir rapi tanpa uang tunai tercecer di luar laci." },
  { key: 'fohRestroomSanitation', area: 'FOH' as keyof typeof INSPECTION_AREAS, points: 6, title: "Kebersihan Toilet & Wastafel Tamu", description: "Sabun cuci tangan terisi, cermin bersih tidak buram, tempat sampah tertutup, tidak ada aroma tak sedap." },
  { key: 'bohCleanliness', area: 'BOH' as keyof typeof INSPECTION_AREAS, points: 8, title: "Kebersihan Kompor, Wajan & Exhaust Hood", description: "Kompor bebas jelaga tebal dan kerak gosong, cerobong asap dibersihkan, lantai dapur tidak berminyak licin." },
  { key: 'bohTemperatureControl', area: 'BOH' as keyof typeof INSPECTION_AREAS, points: 7, title: "Kontrol Suhu Chiller (< 4°C) & Freezer (< -18°C)", description: "Termometer terpasang dan berfungsi akurat, log pemantauan suhu shift pagi dan siang terisi rapi." },
  { key: 'bohFifoLabeling', area: 'BOH' as keyof typeof INSPECTION_AREAS, points: 7, title: "Sistem FIFO & Labeling Expired Date Bahan Baku", description: "Ayam marinasi, sambal olahan, dan sayur diberi stiker tanggal produksi & jam kadaluarsa (tidak ada bahan basi)." },
  { key: 'bohOilQuality', area: 'BOH' as keyof typeof INSPECTION_AREAS, points: 7, title: "Kualitas Minyak Goreng & Uji TPM Minyak", description: "Minyak tidak hitam pekat / berbusa berlebihan, lolos uji visual dan uji TPM (< 24% sesuai SOP BOH 924)." },
  { key: 'bohStoragePallets', area: 'BOH' as keyof typeof INSPECTION_AREAS, points: 6, title: "Kerapian Gudang & Palet Bahan Kering", description: "Beras, tepung, dan minyak jerigen tersusun di atas palet plastik/kayu (tidak menyentuh lantai langsung)." },
  { key: 'tasteFlavorAuthentic', area: 'TASTE' as keyof typeof INSPECTION_AREAS, points: 10, title: "Uji Petik Rasa Sambal & Ayam Pecak (Taste Test)", description: "Rasa gurih, pedas, dan aroma autentik 100% konsisten sesuai gramatur resep baku Barokah Grup." },
  { key: 'tasteMeatDoneness', area: 'TASTE' as keyof typeof INSPECTION_AREAS, points: 8, title: "Kematangan Daging & Suhu Penyajian Hangat", description: "Daging ayam matang sempurna hingga ke dalam tulang, tidak berdarah, dan disajikan hangat ke meja tamu." },
  { key: 'tastePortionPrecision', area: 'TASTE' as keyof typeof INSPECTION_AREAS, points: 7, title: "Presisi Gramatur & Porsi Saji", description: "Potongan ayam memenuhi standar gramatur porsi (tidak disunat/susut), porsi nasi dan sambal tepat." },
  { key: 'cashCountZeroVariance', area: 'CASH' as keyof typeof INSPECTION_AREAS, points: 10, title: "Uji Petik Uang Fisik Kasir", description: "Uang tunai di laci kasir dihitung mendadak dan dicocokkan dengan running sales POS: Wajib Selisih Rp 0." },
  { key: 'shiftHandoverLog', area: 'CASH' as keyof typeof INSPECTION_AREAS, points: 5, title: "Log Serah Terima Shift & Buku Komunikasi", description: "Buku serah terima shift pagi ke malam terisi lengkap dan briefing harian operasional terdokumentasi." },
];

export const INSPECTION_KEYS = new Set(INSPECTION_CHECKLIST.map((i) => i.key));
