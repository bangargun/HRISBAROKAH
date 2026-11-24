# Pelatihan di Server — Desain

Tanggal: 2026-11-24 · Status: menunggu persetujuan pemilik

## Maksud

Menu Pelatihan di web admin hanya hidup di browser: modul, jadwal, kuis dan artikel hilang saat
halaman dimuat ulang, dan halaman Sertifikasi menandai **semua** karyawan "Tersertifikasi, skor 100".
Pemilik ingin pelatihan yang asli: HR menyusun materi dan kuis, kru membaca dan mengerjakan kuis
**di aplikasi HP** (tablet cabang tetap khusus absen dan pengajuan), nilai tersimpan dan menjadi
dasar sertifikasi, dan sesi tatap muka terjadwal dengan daftar hadir.

## Sasaran

1. **Materi + kuis modul**: HR membuat modul (teks, tautan video opsional, kategori, untuk jabatan
   tertentu atau semua, soal pilihan ganda, nilai lulus). Kru membaca dan mengerjakan kuis di HP;
   boleh mengulang sampai lulus. Artikel kepemimpinan menjadi kategori modul; kurikulum onboarding
   menjadi penanda "wajib kru baru" pada modul.
2. **Kuis mingguan**: HR menerbitkan kuis dengan tenggat dan sasaran jabatan; kru mengerjakan
   sekali di HP; HR melihat nilai, yang belum mengerjakan, dan rata-rata per cabang.
3. **Sertifikasi** dihitung otomatis dari modul yang kuisnya lulus; bisa dicetak sebagai sertifikat.
4. **Jadwal pelatihan tatap muka/online**: HR menjadwalkan sesi (tanggal, jam, tempat atau tautan,
   pelatih, modul terkait opsional, cabang/jabatan sasaran), memilih peserta, dan mencatat hadir.
   Kru melihat jadwalnya di HP.

## Bukan sasaran / disembunyikan

- **Rapor karyawan** (sudah tercakup KPI di Penilaian Kinerja) dan **Tes DISC** disembunyikan dari menu.
  *(keputusan pembangun desain — pemilik tidak diminta memilih keduanya)*
- Generator soal "AI": dihapus (soal ditulis HR).
- Kuis di tablet cabang.
- Video diunggah ke server: hanya tautan (mis. YouTube), agar disk VPS bersama tidak penuh.

## Data (tabel baru saja)

Tabel lama `TrainingCourse`/`TrainingProgress` (kosong) tidak disentuh: menambah aturan unik di tabel
lama memicu peringatan "data loss" di `prisma db push` yang menghentikan skrip deploy. Tabel baru:

- `TrainingModule`: `code` unik, `title`, `category` (ONBOARDING, RESEP_BOH, SERVICE_FOH,
  HYGIENE_HACCP, LEADERSHIP), `description`, `content`, `videoUrl?`, `passingScore` (80), `isOnboarding`,
  `targetPositionIds String[]` (kosong = semua), `isPublished`, `createdById`, waktu.
- `TrainingResult`: hasil modul per kru — `attempts`, `bestScore`, `lastScore`, `passedAt?`,
  `certificateNo?` unik; unik per (modul, kru).
- `TrainingQuestion`: `moduleId?` / `weeklyQuizId?`, `prompt`, `options String[]` (2–5), `correctIndex`, `order`.
- `WeeklyQuiz` dan `WeeklyQuizAttempt` (unik per kuis+kru).
- `TrainingSession` dan `TrainingSessionParticipant` (`attended` null = belum dicatat).

## Aturan

- **Jawaban benar tidak pernah dikirim ke HP**; nilai dihitung server (persen benar, dibulatkan).
- Soal modul **terkunci** setelah ada kru yang mengerjakan (judul, isi materi, video, sasaran tetap
  bisa diubah). Untuk mengganti soal: buat modul baru. Kuis mingguan terkunci setelah diterbitkan.
- Modul/kuis yang belum diterbitkan tidak terlihat kru.
- Kru melihat modul dan kuis untuk jabatannya atau untuk semua jabatan; kuis mingguan hanya bisa
  dikerjakan sampai tenggat (akhir hari, zona Jakarta).
- Sertifikat = modul dengan `passedAt`; nomor sertifikat dibentuk dari kode modul + urutan.
- Sesi berstatus SELESAI wajib punya daftar hadir lengkap (setiap peserta hadir/tidak).

## Hak akses

- Kelola modul, kuis, sesi: Super Admin dan HR.
- Lihat hasil dan sertifikasi: Super Admin, HR, Area Manager; Kepala Cabang hanya kru cabangnya,
  dan Kepala Cabang boleh mencatat hadir untuk sesi yang pesertanya kru cabangnya.
- Kru (aplikasi HP): hanya materi/kuis/jadwal miliknya dan nilainya sendiri.

## Layar web admin (menu Pelatihan)

Tab: **Materi**, **Kuis Mingguan**, **Sertifikasi**, **Jadwal Pelatihan**, **Evaluasi 360°** (sudah ada).
- Materi: daftar modul (status terbit, jumlah soal, peserta lulus/total sasaran), editor modul + soal,
  hasil per kru.
- Kuis Mingguan: daftar + editor + hasil (nilai, belum mengerjakan, rata-rata per cabang).
- Sertifikasi: tabel kru × modul lulus, saring cabang/modul, cetak sertifikat (kop Barokah).
- Jadwal Pelatihan: daftar sesi, editor, pilih peserta (per cabang/jabatan), catat hadir.
- Sub-tab lama yang tidak dipakai lagi (Kurikulum, Artikel, Rapor, DISC) dihapus dari menu, beserta
  kode palsunya di `page.tsx`.

## Aplikasi kru (HP)

Menu **Pelatihan** baru: Materi (status Lulus/Belum, baca, tonton tautan video, kerjakan kuis,
lihat nilai), Kuis Mingguan (yang aktif dan tenggatnya; yang sudah dikerjakan tampil nilainya),
Jadwal (sesi mendatang yang diikuti).

## Pengujian

Uji API: jawaban benar tidak bocor ke rute kru; skor dihitung server; ulang modul sampai lulus,
`bestScore`/`passedAt` benar; kuis mingguan sekali saja dan ditolak setelah tenggat; soal terkunci
setelah ada percobaan; sasaran jabatan dihormati; batas Kepala Cabang; catat hadir. Cek browser web
admin; cek aplikasi kru di build web.

## Keputusan rinci (dari pemeriksaan desain) *(keputusan pembangun desain)*

1. **Sasaran jabatan** memakai id `Position` (jabatan per departemen); editor mengelompokkan per
   departemen. Kosong = semua jabatan. Karyawan nonaktif tidak dihitung sebagai sasaran.
2. **Mulai kosong**: tidak ada data contoh yang dipindahkan dari halaman lama (kebijakan tanpa data palsu).
3. **Sertifikat** = satu per modul yang lulus. Nomor sertifikat **disimpan** saat lulus
   (`certificateNo`, format `{kode modul}-{urut 4 digit}`, urutan per modul, dibuat dalam transaksi).
4. Modul yang sudah ada hasil kru **tidak bisa dihapus**, hanya diarsipkan (tidak terbit). Arsip
   menyembunyikan modul dari kru tetapi sertifikat yang sudah didapat tetap ada.
5. **Ulang kuis modul**: tanpa batas sampai lulus; urutan soal tetap; setelah lulus kuis ditutup
   (kru tetap bisa membaca materi). `bestScore` = nilai tertinggi, `lastScore` = terakhir.
6. **Kuis mingguan** bisa dikerjakan sejak diterbitkan sampai akhir hari tenggat (Jakarta). Setelah
   tenggat kru hanya melihat nilainya (tanpa kunci jawaban). Yang tidak mengerjakan tercatat
   "tidak mengerjakan".
7. **Kepala Cabang** boleh mencatat hadir di sesi mana pun yang pesertanya ada kru cabangnya, tetapi
   hanya untuk baris kru cabangnya. Aplikasi kru hanya menampilkan sesi yang kru itu ikuti.
8. Aplikasi kru memakai login akun kru (JWT) → profil karyawan, seperti rute `/payroll/my`.
