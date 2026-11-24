# Deploy ke VPS Hostinger

Server `187.77.122.142` (Ubuntu 24.04) sudah menjalankan banyak aplikasi lain dengan Nginx + PM2 + PostgreSQL.
HRIS mengikuti pola yang sama dan tidak menyentuh aplikasi lain:

| Bagian | Di server |
|---|---|
| Kode | `/var/www/hris-app` (clone repo ini) |
| Database | `hris_app` di PostgreSQL server (user `hris_app`, password di `backend/.env`) |
| Backend | PM2 `hris-app-api`, port 3110 (hanya lokal) |
| Web admin | PM2 `hris-app-web`, port 3111 (hanya lokal) |
| Aplikasi kru (web) | `/var/www/hris-app/kru`, disajikan di `/kru/` |
| Nginx | `/etc/nginx/sites-enabled/hris-app` (dari `deploy/nginx-hris.conf`) |
| Foto | `backend/uploads` (publik di `/uploads`) dan `backend/storage` (wajah, privat) |

Alamat: `https://hris.barokahgroupindonesia.tech`. Aplikasi HP produksi memakai
`--dart-define=API_URL=https://hris.barokahgroupindonesia.tech/api/v1`.

## Update

Commit dan push ke `main`, lalu dari Mac:

```sh
deploy/deploy.sh root@187.77.122.142
```

Skrip menolak jalan bila ada perubahan yang belum di-push. Sebelum mengirim apa pun, `deploy/check.sh`
menjalankan cek tipe, unit test, `flutter analyze` dan semua uji API (`backend/scripts/e2e-*.mjs`) di
database percobaan sementara di Mac; bila ada yang gagal, deploy dibatalkan (darurat: `SKIP_CHECKS=1`).

VPS dipakai aplikasi lain mulai jam 10 pagi, jadi deploy sebaiknya sebelum jam 10 atau setelah jam 22.
Di luar jam itu skrip meminta konfirmasi (lewati dengan `DEPLOY_ANYTIME=1`).

Perubahan skema database diterapkan dengan `prisma db push`; perubahan yang akan menghapus data membuat
deploy berhenti dan harus ditangani manual.

## Aplikasi kru

Kru memakai aplikasi web (PWA) di `https://hris.barokahgroupindonesia.tech/kru/`, tidak perlu APK:

- Android (Chrome): buka alamat itu → menu ⋮ → **Tambahkan ke layar utama** / **Instal aplikasi**.
- iPhone (Safari): buka alamat itu → tombol Bagikan → **Tambah ke Layar Utama**.

Aplikasi ikut ter-update setiap deploy; kru cukup menutup dan membuka ulang aplikasinya.

## Pemasangan pertama (sudah dilakukan)

1. `ssh root@187.77.122.142 'sh -s' < deploy/server-setup.sh` membuat database, `backend/.env` (rahasia acak) dan konfigurasi web.
2. `deploy/deploy.sh root@187.77.122.142`
3. Akun admin: `cd /var/www/hris-app/backend && npx prisma db seed`; password awalnya ada di `backend/.env` (`ADMIN_INITIAL_PASSWORD`).
4. Nginx: salin `deploy/nginx-hris.conf` ke `/etc/nginx/sites-available/hris-app`, aktifkan, `nginx -t`, lalu `systemctl reload nginx`.

## Backup & pemantauan

Otomatis setiap hari 04:30 WIB, salinan terenkripsi dikirim ke Telegram, dan server dipantau tiap
5 menit. Lihat [OPERASIONAL-BACKUP.md](OPERASIONAL-BACKUP.md) untuk menghubungkan bot dan memulihkan.
