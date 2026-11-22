# Absen Terpusat di Tablet Cabang (PWA offline) — Desain

Tanggal: 2026-11-22 · Status: menunggu persetujuan pemilik

## Maksud dan alasan

Absen kru pindah dari HP masing-masing ke **satu tablet per cabang** (tablet kasir). Pemilik ingin
menutup semua celah yang mungkin terjadi pada absen lewat HP: titip absen, fake GPS, kru tanpa HP.
Tablet hanya menampilkan absen — masuk, mulai istirahat, selesai istirahat, pulang — beserta rekapnya.
Tablet harus tetap bisa dipakai saat internet putus; absen tersimpan di tablet dan terkirim otomatis
saat online.

## Sasaran

1. Kru absen di tablet cabang dengan wajah; tablet mengenali wajah sendiri, online maupun offline.
2. Absen offline tersimpan di tablet dan terkirim saat online, tanpa ganda dan tanpa hilang.
3. Kru yang dipindah sementara ke cabang lain tetap bisa absen (terjadwal maupun dadakan).
4. Tablet menampilkan papan hari ini dan rekap pribadi kru (setelah wajah dikenali).
5. HR bisa menerapkan per cabang secara bertahap; begitu cabang memakai tablet, absen lewat HP untuk
   cabang itu ditutup.

## Bukan sasaran

- Integrasi ke aplikasi POS kasir (MRIS). Tablet membuka halaman HRIS di browser, terpisah dari POS.
- Pendaftaran wajah lewat tablet. Pendaftaran tetap seperti sekarang (HR).
- Menghitung lembur.
- Menghapus fitur lain aplikasi kru di HP (slip gaji, izin, kasbon, laporan harian, survei tetap ada).

## Anti-sasaran (gagal walau secara teknis jalan)

- Kru terhalang absen karena internet putus, wajah gagal dikenali, atau sedang di cabang lain.
- Absen hilang atau terbuang diam-diam; setiap catatan yang ditolak harus terlihat oleh HR.
- Absen tercatat ganda karena terkirim ulang.
- Data wajah kru cabang lain tersimpan di tablet tanpa alasan (bukan kru tamu terjadwal).

## Kondisi saat ini (yang disentuh)

- Absen: `backend/src/modules/attendance/attendance.service.ts` — `clockIn`/`clockOut`/`startBreak`/
  `endBreak` berbasis user login (JWT), selfie dicek `FaceEnrollmentService.verifyForAttendance`
  (1:1, ambang `FACE_MATCH_THRESHOLD` 0.5), lokasi dihitung dari GPS ke titik cabang, waktu = jam server,
  cabang = cabang asal kru.
- Wajah: `@vladmandic/human` (WASM) di server, embedding 1024 angka; `FaceEnrollment.embedding Float[]`.
  Paket yang sama bisa berjalan di browser, jadi embedding tablet dan server sebanding.
- Jadwal: `ShiftSchedule` (employeeId, date) tanpa cabang.
- Web admin: Next.js 14 (app router), token admin di `lib/auth`, `apiFetch` mengalihkan ke `/login` saat 401.
- Aplikasi kru Flutter memanggil `/attendance/clock-in` dst lewat `mobile_user/lib/services/api_service.dart`.

## Pendekatan yang dipertimbangkan

| | Cara | Untung | Rugi |
|---|---|---|---|
| **A (dipilih)** | Halaman web HRIS `/absen` sebagai PWA di Chrome tablet | Tanpa APK; setiap deploy langsung sampai; pakai ulang server dan model wajah | Kamera/penyimpanan lewat browser |
| B | Mode tablet di aplikasi Flutter kru | Kamera native, offline mudah | Pasang ulang APK di semua tablet tiap pembaruan |
| C | Digabung ke aplikasi POS (MRIS) | Satu aplikasi | Lintas proyek; gangguan absen bisa mengganggu kasir |

Pemilik memilih **A** dan meminta PWA yang offline-first.

Pengenalan wajah offline: (1) tablet mengenali wajah sendiri, atau (2) offline pakai nama + PIN dan
wajah dicek server belakangan. Pemilik memilih **(1)** dengan penanganan kru tamu di bawah.

## Desain

### 1. Perangkat tablet (pasangan sekali per cabang)

- Model baru `AttendanceDevice` { id, outletId, name, tokenHash, pairedAt, lastSeenAt, revokedAt?,
  createdById }.
- Web admin (Cabang → Tablet Absen): HR membuat **kode pasangan** 8 karakter, berlaku 15 menit, untuk
  satu cabang. Di tablet, `/absen` meminta kode itu; server menukarnya dengan **token perangkat** acak
  panjang (disimpan di server sebagai hash). Token disimpan di tablet.
- Semua endpoint tablet memakai guard token perangkat (bukan JWT user). Token dicabut → respons 401 →
  tablet menghapus seluruh data lokal (roster, wajah, antrean yang sudah terkirim) dan kembali ke layar
  pasangan. Antrean yang belum terkirim saat dicabut tidak bisa dikirim lagi; HR diberi tahu jumlahnya
  lewat `lastSeenAt`/peringatan di admin (lihat bagian 8).
- Satu cabang boleh punya lebih dari satu tablet.

### 2. PWA `/absen`

- Halaman client-only di web admin (`src/app/absen`), tanpa sidebar admin, layar penuh, tampilan
  tablet landscape dan portrait.
- `manifest` dengan scope `/absen`, ikon Barokah; service worker menyimpan app shell dan file model
  wajah (detector, mesh, description, antispoof/liveness) agar halaman terbuka tanpa internet.
  File model disajikan dari `public/` web admin (disalin dari paket `@vladmandic/human`, versi sama
  dengan backend).
- Penyimpanan lokal di IndexedDB: konfigurasi perangkat, roster + embedding, status hari ini, rekap
  bulan berjalan, antrean absen beserta foto.

### 3. Sinkron turun (server → tablet)

`GET /kiosk/bootstrap` saat online, setiap 5 menit dan saat koneksi pulih. Isi:
- Cabang: nama, jam kerja per jenis hari, batas istirahat; daftar libur nasional 7 hari ke depan.
- Jam server (untuk cek jam tablet).
- **Roster wajah**: kru aktif cabang ini + kru tamu yang **dijadwalkan di cabang ini** hari ini s/d
  3 hari ke depan, masing-masing dengan embedding wajahnya. Kru tanpa wajah terdaftar ikut dengan
  tanda "belum daftar wajah".
- **Daftar nama semua kru aktif** (id, nama, cabang asal) — tanpa embedding — untuk tombol
  "Saya dari cabang lain".
- Status hari ini semua kru yang absen di cabang ini.
- Rekap bulan berjalan untuk kru cabang ini (per hari: masuk, pulang, menit terlambat, lama istirahat,
  lama kerja). Lembur tidak ditampilkan: `overtimeMinutes` belum dihitung di mana pun dan menghitungnya
  akan menyentuh penggajian. *(keputusan pembangun desain)*
Data kru tamu yang masa tugasnya lewat otomatis hilang di bootstrap berikutnya.

### 4. Alur di tablet

```
[ Papan hari ini ]                         ● Online / Offline · 3 menunggu terkirim
  Sudah masuk (5) · Istirahat (1) · Pulang (2) · Belum datang (4) · Terlambat (1)
            [ Tekan untuk absen ]   [ Saya dari cabang lain ]
```
1. Kru menekan **Absen** → kamera depan → cek hidup (antispoof + liveness bawaan `human`, ambang di
   tablet) → embedding → dicocokkan ke roster (ambang sama dengan server).
2. Cocok → "Halo Joko Susilo" + tombol aksi yang **berlaku sesuai status**: Masuk, atau Mulai istirahat /
   Pulang, atau Selesai istirahat. Kru menekan aksi → tercatat → "Tercatat ✓ 08:57 · terlambat 12 menit".
   Pilihan "Bukan saya" kembali ke papan.
   Kru tamu tidak terjadwal hanya mendapat rekap hari ini.
3. Setelah tercatat, kru bisa membuka **Rekap saya** (bulan berjalan) selama 30 detik, lalu layar kembali
   ke papan. Rekap kru lain tidak pernah tampil.
4. Wajah tidak dikenali:
   - **Online** → tablet mengirim foto ke `POST /kiosk/identify`; server mencari di semua kru aktif.
     Ketemu → lanjut seperti langkah 2, dengan label "kru tamu dari Cabang A".
   - **Offline** → tablet menawarkan "Saya dari cabang lain": kru memilih nama dari daftar dan
     memasukkan PIN, foto disimpan; PIN dan wajah diperiksa server saat sinkron.
   - Kru cabang ini yang gagal dikenali juga bisa memakai jalur nama + PIN (tanda "absen PIN").

### 5. Antrean dan sinkron naik (tablet → server)

- Setiap aksi menjadi **event**: { id (UUID dari tablet), employeeId, jenis CLOCK_IN | BREAK_START |
  BREAK_END | CLOCK_OUT, waktu tablet, selisih jam tablet-server saat sinkron terakhir, foto JPEG
  (sisi terpanjang 480 px), metode FACE_LOCAL | FACE_SERVER | PIN, skor kecocokan lokal, PIN (hanya
  untuk metode PIN, dikirim lewat HTTPS, tidak disimpan setelah terkirim) }.
- Event disimpan di IndexedDB **sebelum** layar menampilkan "Tercatat". Status kru di tablet langsung
  diperbarui dari event lokal.
- `POST /kiosk/events` mengirim batch berurutan waktu; diulang otomatis sampai sukses.
- Server menyimpan setiap event di tabel `AttendanceEvent` dengan **id dari tablet sebagai kunci unik**,
  jadi kiriman ulang tidak membuat ganda. Respons per event: APPLIED, NEEDS_REVIEW (dengan alasan), atau
  REJECTED (dengan alasan). Tablet menghapus event yang sudah dijawab dari antrean.
- Batas antrean: 7 hari atau 2000 event; mendekati batas, tablet menampilkan peringatan keras agar
  disambungkan ke internet.

### 6. Server menerapkan event

- **Waktu absen** = waktu tablet + selisih jam saat sinkron terakhir. Server membandingkan selisih
  sekarang dengan selisih yang dibawa event; beda lebih dari 2 menit berarti jam tablet pernah digeser →
  event NEEDS_REVIEW (alasan "jam tablet berubah").
- **Tanggal absen**: CLOCK_IN memakai tanggal kalender Asia/Jakarta dari waktu absen (bukan jam server
  saat diterima). BREAK_START/BREAK_END/CLOCK_OUT menempel ke absen kru yang **masih terbuka** (sudah
  masuk, belum pulang) dan dimulai paling lama 16 jam sebelumnya, walaupun sudah lewat tengah malam.
  Kode sekarang belum punya aturan lewat tengah malam (`businessToday()` hanya tanggal kalender);
  aturan ini juga dipakai tablet untuk status lokal. *(keputusan pembangun desain)*
- **Cabang absen** = cabang tablet. Keterlambatan memakai jam kerja cabang itu dan jadwal kru pada
  tanggal itu. `punctuality()` diubah agar menerima cabang dan waktu sebagai parameter.
- **Wajah**: server mengulang pencocokan dari foto. Untuk FACE_LOCAL/FACE_SERVER, skor server di bawah
  ambang → NEEDS_REVIEW (alasan "wajah tidak cocok"). Untuk PIN: PIN salah → REJECTED; PIN benar tapi
  wajah tidak cocok → NEEDS_REVIEW. Kru tanpa wajah terdaftar boleh absen dengan PIN; event-nya
  NEEDS_REVIEW (alasan "belum daftar wajah").
- **Ditinjau tetap tercatat (sementara)**: event NEEDS_REVIEW karena wajah, jam tablet, PIN, atau
  "tidak terjadwal" **tetap diterapkan** ke `Attendance` dengan tanda "menunggu tinjauan", sehingga
  istirahat dan pulang berikutnya hari itu berjalan normal dan satu masalah tidak menular ke seharian.
  HR **Terima** → tanda dihapus. HR **Tolak** pada CLOCK_IN → absen hari itu dari tablet dibatalkan
  (hari itu dihitung tidak hadir; bisa diperbaiki lewat Koreksi Absen yang sudah ada); Tolak pada event
  lain → waktu event itu dikosongkan. Penggajian memakai absen yang menunggu tinjauan apa adanya; HR
  menuntaskan tinjauan sebelum tutup buku. *(keputusan pembangun desain)*
- **Urutan status**: event diterapkan sesuai urutan waktu absen. Transisi tidak sah (masuk kedua kali,
  pulang tanpa masuk, pulang saat istirahat belum selesai) **tidak diterapkan**; event disimpan sebagai
  NEEDS_REVIEW agar terlihat. "Terima" di sini hanya menandai sudah dilihat; perbaikan data memakai
  Koreksi Absen. Pengecualian: pulang saat istirahat belum selesai → istirahat ditutup pada waktu pulang,
  lalu pulang diterapkan dengan tanda.
- Event APPLIED menulis ke `Attendance`/`AttendanceBreak` yang sudah ada, sehingga laporan, koreksi absen,
  KPI, dan penggajian tetap berjalan tanpa perubahan.
- Kru tamu (cabang asal ≠ cabang tablet) diterapkan normal, dengan tanda "kru tamu" di `Attendance`.
  Jika tidak terjadwal di cabang itu, tanda "tidak terjadwal di cabang ini" ditambahkan.

### 7. Perubahan data

- `AttendanceDevice` (baru, bagian 1) dan `AttendanceDevicePairing` (kode, outletId, expiresAt, usedAt).
- `AttendanceEvent` (baru): id (dari tablet), deviceId, employeeId, outletId, type, deviceTime,
  offsetAtEventMs, effectiveTime, method, localScore, serverScore, photoPath, status
  (APPLIED/NEEDS_REVIEW/REJECTED), reason, reviewedById?, reviewedAt?, attendanceId?, receivedAt.
- `Attendance`: tambah `source` (MOBILE | TABLET, default MOBILE), `deviceId?`, `isGuest` (bool),
  `flags String[]` (offline, PIN, kru tamu, tidak terjadwal, jam berubah, wajah ditinjau).
- `ShiftSchedule`: tambah `outletId?` — "bertugas di cabang"; kosong = cabang asal.
- `Outlet`: tambah `attendanceMode` (MOBILE | TABLET, default MOBILE).
- `EmployeeProfile`: tambah `attendancePinHash?` (PIN 6 digit, bcrypt).
- Semua perubahan bersifat tambahan; diterapkan dengan `prisma db push` seperti biasa, data lama aman.

### 8. Web admin

- **Cabang**: pengaturan mode absen (HP / Tablet) dan daftar tablet (nama, terakhir online, cabut,
  buat kode pasangan). Tablet yang tidak online lebih dari 24 jam ditandai.
- **Jadwal shift**: kolom "bertugas di cabang" saat menjadwalkan kru.
- **Presensi Harian**: kolom sumber (HP/Tablet) dan label tanda (offline, PIN, kru tamu, dst).
- **Perlu ditinjau** (baru, di Presensi): daftar event NEEDS_REVIEW dengan foto absen dan foto wajah
  terdaftar, alasan, waktu. HR/Store Manager cabang terkait memilih **Terima** (event diterapkan) atau
  **Tolak** (lihat bagian 6, tercatat siapa yang menolak). Event REJECTED juga bisa dilihat di sini.
  Yang berhak meninjau: HR/Super Admin semua cabang, dan Store Manager **cabang tempat absen** (cabang
  tablet), termasuk untuk kru tamu. *(keputusan pembangun desain)*
- **Data Karyawan**: HR bisa **membuat atau mengatur ulang PIN** absen kru (untuk kru tanpa HP, HR
  memberikan PIN langsung). PIN yang dibuat HR tidak wajib diganti.

### 9. Aplikasi kru (HP)

- Aturan memakai **cabang tempat kru bertugas hari itu** (`ShiftSchedule.outletId` hari itu, kosong =
  cabang asal), bukan cabang asal. Jika cabang itu berstatus TABLET, tombol absen disembunyikan dan
  diganti keterangan "Absen di tablet cabang"; riwayat absen tetap bisa dilihat. Endpoint
  `/attendance/clock-in` dst menolak dengan pesan yang sama, supaya aplikasi versi lama tidak bisa dipakai
  absen. Jika cabang itu masih mode HP, absen HP tetap jalan (mis. kru cabang tablet yang ditugaskan ke
  cabang tanpa tablet). *(keputusan pembangun desain)*
- Kru mengatur PIN absen sendiri di aplikasi (menu Akun), wajib mengisi password akun.

### 10. Keamanan dan privasi

- Embedding wajah di tablet terbatas pada kru cabang + kru tamu terjadwal; dihapus saat token dicabut
  atau saat kru tidak lagi di roster.
- Foto absen disimpan privat di server seperti foto absen sekarang.
- Endpoint tablet dibatasi laju (identify dan PIN) untuk mencegah tebak-tebakan.
- Tablet tidak menyimpan hash PIN; PIN hanya diperiksa server.

## Diserahkan ke pembangun

- Tata letak dan visual layar tablet mengikuti sistem desain web admin (ink-and-gold).
- Pustaka service worker (tulis sendiri atau Workbox) dan struktur IndexedDB.
- Nilai ambang cek hidup di tablet, diuji di perangkat nyata.
- Bentuk tepat respons endpoint dan nama berkas.

## Peluncuran

1. Deploy dengan semua cabang tetap mode HP (tidak ada perubahan bagi kru).
2. HR memasang tablet di satu cabang uji coba, mengubah mode cabang itu ke Tablet.
3. Setelah berjalan, cabang lain dipindah satu per satu.
Kembali ke HP cukup dengan mengubah mode cabang.
