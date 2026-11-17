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

Skrip menolak jalan bila ada perubahan yang belum di-push. Perubahan skema database diterapkan dengan
`prisma db push`; perubahan yang akan menghapus data membuat deploy berhenti dan harus ditangani manual.

## Pemasangan pertama (sudah dilakukan)

1. `ssh root@187.77.122.142 'sh -s' < deploy/server-setup.sh` membuat database, `backend/.env` (rahasia acak) dan konfigurasi web.
2. `deploy/deploy.sh root@187.77.122.142`
3. Akun admin: `cd /var/www/hris-app/backend && npx prisma db seed`; password awalnya ada di `backend/.env` (`ADMIN_INITIAL_PASSWORD`).
4. Nginx: salin `deploy/nginx-hris.conf` ke `/etc/nginx/sites-available/hris-app`, aktifkan, `nginx -t`, lalu `systemctl reload nginx`.

## Cadangan database

```sh
sudo -u postgres pg_dump hris_app > hris_app-$(date +%F).sql
```
