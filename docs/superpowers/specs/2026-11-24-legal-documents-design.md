# Surat & Kontrak di Server — Desain

Tanggal: 2026-11-24 · Status: menunggu persetujuan pemilik

## Maksud

Menu Surat & Kontrak sekarang hanya hidup di browser: arsip hilang saat halaman dimuat ulang,
nomor surat diacak, tanggal "Hari Ini (Okt 2026)" ditulis mati, dan SK Mutasi mengubah tampilan
data karyawan tanpa menyimpannya. Pemilik ingin arsip surat yang asli dan SK yang benar-benar
berlaku ke data karyawan.

## Sasaran

1. Setiap surat yang diterbitkan tersimpan di server dan bisa dicari, dilihat, dan dicetak ulang
   dengan kop Barokah.
2. Nomor surat dibuat server, berurutan per jenis per tahun, tidak bisa ganda.
3. SK yang mengubah data karyawan bisa **diterapkan** ke data karyawan dengan satu klik, dan
   penerapannya tercatat di surat itu (pilihan pemilik: "Terapkan saat terbit").
4. Surat yang sudah terbit tidak bisa diubah atau dihapus; kesalahan diperbaiki dengan
   **membatalkan** (wajib alasan) lalu menerbitkan surat baru.

## Bukan sasaran

- Tanda tangan elektronik oleh kru di aplikasi HP (alur lama ada di kode mati, tidak dipakai).
- Gaji per karyawan: HRIS menghitung gaji dari aturan per status (masa percobaan / tetap),
  bukan per orang. SK Penyesuaian Gaji tetap bisa diterbitkan sebagai dokumen, tetapi **tidak**
  mengubah perhitungan gaji.
- Pembuatan PDF di server: cetak tetap lewat jendela cetak browser (A4) seperti sekarang.

## Data

`LegalDocument` (baru): id, `docNumber` (unik), `docType` (enum: SK_PENGANGKATAN, SK_PROMOSI,
SK_MUTASI, SK_PENYESUAIAN_GAJI, PKWT_KRU, PKWTT_TETAP, SE_LIBUR_OPERASIONAL, SE_KUOTA_LIBUR,
SE_CUTI_TAHUNAN, SE_CUSTOM), `category` (SK | PKWT | EDARAN, diturunkan dari jenis),
`employeeId?` (kosong untuk surat edaran), snapshot nama/NIK/jabatan/cabang karyawan saat terbit,
`targetPositionId?`, `targetOutletId?` (untuk mutasi/promosi), `salaryAmount?` (angka pada surat),
`audience?`, `subject?` (edaran), `title`, `effectiveDate`, `expiredDate?` (PKWT),
`signatoryName`, `signatoryRole`, `contentBody`, `considerations String[]`, `decisions String[]`,
`status` (ISSUED | CANCELLED), `cancelReason?`, `cancelledById?`, `cancelledAt?`,
`appliedAt?`, `appliedById?`, `createdById`, `createdAt`.

`LegalDocumentCounter` (baru): (prefix, year) → nomor terakhir, dinaikkan dalam transaksi.
Format nomor: `{urut 3 digit}/{kode jenis}/HR-BKN/{bulan romawi}/{tahun}`, misalnya
`007/SK-MUT/HR-BKN/XI/2026`. Kode jenis: SK-ANGKAT, SK-PROMO, SK-MUT, SK-GAJI, PKWT, PKWTT, SE.

## Menerapkan SK ke data karyawan

| Jenis | Yang diterapkan |
|---|---|
| SK Mutasi | cabang karyawan → `targetOutletId` |
| SK Promosi | jabatan → `targetPositionId` (dan cabang bila diisi) |
| SK Pengangkatan / PKWTT | status kerja → Tetap |
| PKWT Kru | status kerja → Kontrak (tanggal akhir kontrak tetap tercatat di surat; `EmployeeProfile.endDate` adalah tanggal berhenti kerja, bukan akhir kontrak) |
| SK Penyesuaian Gaji, Surat Edaran | tidak ada (dokumen saja) |

- Tombol "Terapkan ke data karyawan" muncul pada surat ISSUED yang belum diterapkan, hanya bila
  `effectiveDate` ≤ hari ini; sebelum itu tampil "Bisa diterapkan mulai {tanggal}".
- Penerapan dalam satu transaksi: ubah karyawan + isi `appliedAt/appliedById`; klaim bersyarat
  agar tidak diterapkan dua kali. Surat yang sudah diterapkan tidak bisa dibatalkan
  (perbaikan lewat surat baru).
- Karyawan nonaktif atau cabang/jabatan tujuan nonaktif → ditolak dengan pesan jelas.

## Hak akses

- Terbitkan, terapkan, batalkan: Super Admin dan HR.
- Lihat dan cetak: Super Admin, HR, Area Manager; Kepala Cabang hanya surat untuk kru cabangnya
  dan surat edaran.
- Kru tidak mengakses menu ini.

## Layar

- Tab SK, Kontrak, Surat Edaran: daftar dari server (cari, saring cabang/status), lihat & cetak,
  batalkan (dengan alasan), terapkan.
- Tab Buat Surat: karyawan dipilih dari data asli; cabang/jabatan tujuan dipilih dari master
  data; nomor tidak diisi manual (ditampilkan "dibuat otomatis saat terbit"); tanggal memakai
  input tanggal; penanda tangan diisi bebas (default terakhir dipakai, disimpan di perangkat).
- Klausul Baku tetap sebagai teks acuan statis (bukan data palsu); tombol hapus klausul dihapus.
- Tombol/teks palsu dihapus: ubah surat terbit, hapus dari arsip, nomor acak, tanggal mati,
  mutasi lokal pada daftar karyawan, alur mutasi cepat dan detail karyawan yang tidak terjangkau.

## Pengujian

Uji API (gaya `backend/scripts/e2e-*.mjs`): nomor berurutan dan unik walau diterbitkan serentak;
terapkan mutasi/promosi/PKWT mengubah data karyawan sekali saja; tanggal masa depan ditolak;
batalkan wajib alasan dan tidak bisa setelah diterapkan; batas Kepala Cabang; kru ditolak.
Cek browser: terbitkan, cari, cetak, terapkan, batalkan.
