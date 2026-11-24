# Notifikasi pengajuan lewat Telegram

## Tujuan

Orang yang harus bertindak tahu saat itu juga, tanpa harus membuka web atau aplikasi untuk mengecek:
Kepala Cabang, HR dan kru menerima pesan Telegram dari bot HRIS, dengan tautan ke halaman yang tepat.
Ditambah ringkasan pagi 08:00 WIB untuk yang masih menunggu.

## Satu bot untuk semua

Bot HRIS yang sama dipakai untuk backup/peringatan server (`deploy/ops`) dan notifikasi aplikasi.

- Token disimpan di `backend/.env` sebagai `TELEGRAM_BOT_TOKEN` (backend butuh untuk mengirim), plus
  `TELEGRAM_WEBHOOK_SECRET` acak. Skrip ops membaca token dari situ; `/root/.hris-ops.env` tinggal
  menyimpan chat penerima peringatan dan kata sandi backup.
- Backend memasang webhook `https://DOMAIN/api/v1/telegram/webhook` saat start (bila token ada).
  Telegram mengirim header `X-Telegram-Bot-Api-Secret-Token`; permintaan tanpa header yang cocok ditolak.
- Karena webhook aktif, `deploy/ops/telegram-setup.sh` tidak lagi memakai `getUpdates`. Alurnya:
  tempel token → disimpan ke `backend/.env` → API di-restart → login web admin sebagai Super Admin →
  **Hubungkan Telegram** → skrip mengambil chat Super Admin itu dari database sebagai penerima
  peringatan server, lalu mengirim pesan uji.
- Tanpa token, semua fitur notifikasi diam (tidak ada error); tombol "Hubungkan Telegram" tidak tampil.

## Menghubungkan akun

Data baru (tabel baru saja, aman untuk deploy):

```
TelegramLink      userId (PK, ke User), chatId (unik), username Telegram, linkedAt
TelegramLinkCode  code (PK, 24 karakter acak), userId, expiresAt (15 menit)
```

- `POST /me/telegram/link` membuat kode dan mengembalikan `https://t.me/<bot>?start=<kode>`.
- Pengguna menekan tautan → Telegram terbuka → tekan **Start** → bot menerima `/start <kode>`,
  mencocokkan kode yang belum kedaluwarsa, menyimpan chat ke pengguna itu, menghapus kode, membalas
  "Terhubung sebagai <nama>". Chat yang sebelumnya terhubung ke akun lain dipindahkan.
- `/stop` di Telegram atau tombol **Putuskan** di aplikasi menghapus hubungan.
- `GET /me/telegram` → `{ available, linked, telegramUsername }` untuk tampilan status.
- Tempat tombolnya: web admin di menu akun (Super Admin, HR, Keuangan, Area Manager, Kepala Cabang);
  aplikasi kru di layar **Data Diri** (kru dan Kepala Cabang yang memakai HP).

## Siapa menerima apa

| Kejadian | Penerima | Isi |
|---|---|---|
| Pengajuan baru (cuti, izin, sakit, kasbon, lembur, tukar shift), dari HP atau tablet | Kepala Cabang cabang kru itu; bila cabang tanpa kepala → HR | Nama, jenis, tanggal/nominal, alasan; tautan ke Persetujuan |
| Kepala Cabang menyetujui → menunggu HR | HR (semua Admin HR aktif; bila tidak ada → Super Admin) | Sama, "sudah disetujui <Kepala Cabang>" |
| Keputusan akhir: disetujui / ditolak (dengan alasan) / kasbon dicairkan | Kru yang mengajukan | Hasil + alasan bila ditolak |
| Ditolak Kepala Cabang | Kru | Hasil + alasan |
| Perubahan rekening diajukan | HR | Nama, rekening baru, tanda bila nama pemilik berbeda |
| Perubahan rekening disetujui / ditolak | Kru | Hasil + alasan |
| Koreksi absen dibuat Kepala Cabang | HR | Nama, tanggal, alasan |
| Absen tablet perlu ditinjau | Kepala Cabang cabang itu | Paling banyak satu pesan per 2 jam per cabang ("N absen perlu ditinjau") |
| Ringkasan pagi 08:00 WIB | Kepala Cabang, HR, Keuangan | Hanya bila ada yang menunggu: jumlah per jenis + tautan |

Kepala Cabang = `Outlet.managerId`. Area Manager tidak menerima pesan per kejadian (cukup ringkasan pagi
untuk cabang yang ia bawahi) agar tidak dobel dengan Kepala Cabang.

## Cara mengirim

- `NotificationsService.notify(userIds, text, link?)`: hanya untuk pengguna yang terhubung dan aktif.
  Dipanggil **setelah** transaksi database berhasil, tidak ditunggu oleh permintaan (fire-and-forget);
  kegagalan Telegram hanya dicatat di log, tidak pernah menggagalkan pengajuan atau persetujuan.
- Chat yang memblokir bot (Telegram menjawab 403) otomatis diputus.
- Pesan teks biasa (tanpa HTML) agar nama/alasan yang diketik orang tidak merusak format; tautan berupa
  tombol inline "Buka".
- Ringkasan pagi: penjadwal sederhana di backend (cek tiap menit, kirim sekali per hari setelah 08:00
  WIB; tanggal terakhir disimpan di database agar restart tidak mengirim dua kali).

## Tautan

- Web admin: `https://DOMAIN/?menu=requests` (dan `menu=employees&tab=bank-changes`, `menu=attendance&tab=...`).
  Web admin dibuat membaca `menu`/`tab` dari alamat saat dibuka.
- Kru: `https://DOMAIN/kru/`.

## Di luar cakupan

- WhatsApp, email, notifikasi push HP.
- Menyetujui langsung dari Telegram (tombol Setujui/Tolak di chat): bisa menyusul, tapi butuh
  pemeriksaan hak akses lewat chat dan pencatatan siapa yang menyetujui.

## Pengujian

- Uji API: kode tautan (kedaluwarsa, dipakai dua kali, chat pindah akun), webhook menolak tanpa secret,
  `/stop`, siapa menerima pesan pada tiap kejadian (Telegram diganti penerima palsu di mode uji:
  `TELEGRAM_API_BASE` menunjuk server lokal yang mencatat pesan), pengajuan tetap berhasil saat
  Telegram gagal, ringkasan pagi tidak terkirim dua kali.
- Uji di browser: tombol Hubungkan di web dan aplikasi kru menampilkan status.
