# Backup, pemantauan & pemulihan HRIS

Semua jadwal ada di crontab root VPS dengan tanda `# hris-app-ops` (dipasang ulang otomatis oleh
`deploy/deploy.sh` lewat `deploy/ops/install.sh`). Jadwal aplikasi lain tidak disentuh.

| Jadwal | Skrip | Isi |
|---|---|---|
| Setiap hari 04:30 WIB | `deploy/ops/backup.sh` | Dump database `hris_app` + arsip `backend/storage` & `backend/uploads` |
| Setiap 5 menit | `deploy/ops/monitor.sh` | API + database, web admin, aplikasi kru, umur backup, disk |

Log: `/var/log/hris-ops.log`. Rahasia ops (token bot, chat, kata sandi backup): `/root/.hris-ops.env` (hanya root).

## Di mana backup disimpan

1. **VPS**: `/root/backups/hris-app/`, 14 hari terakhir (`hris-db-*.dump`, `hris-files-*.tar.gz`).
2. **Telegram (di luar VPS)**: bot HRIS mengirim salinan terenkripsi AES-256 ke chat Owner setiap hari.
   Database selalu dikirim; arsip file hanya bila di bawah 45 MB (batas bot Telegram 50 MB).

Kata sandi enkripsi dibuat pada backup pertama setelah bot terhubung dan dikirim **sekali** ke chat
Telegram. Simpan di pengelola kata sandi atau kertas di tempat aman, lalu hapus pesannya. Tanpa kata
sandi itu, salinan di Telegram tidak bisa dibuka.

## Menghubungkan bot Telegram (sekali)

1. Di Telegram buka **@BotFather** → `/newbot` → beri nama, misalnya `HRIS Barokah Backup`. Salin tokennya.
2. Di Mac: `ssh -t root@187.77.122.142 bash /var/www/hris-app/deploy/ops/telegram-setup.sh`
   lalu tempel token (tidak tampil di layar).
3. Buka bot baru itu di Telegram dan kirim `/start`. Skrip mencatat chat ini dan mengirim pesan uji.
4. Coba backup sekarang: `ssh root@187.77.122.142 bash /var/www/hris-app/deploy/ops/backup.sh`
   → di Telegram masuk kata sandi backup lalu file `hris-db-*.dump.enc`.

## Peringatan yang dikirim bot

- 🚨 API/database, web admin atau aplikasi kru tidak bisa dibuka; backup terakhir > 26 jam; disk ≥ 90%.
  Diulang tiap 2 jam selama belum pulih.
- ✅ saat sudah pulih.
- ⚠️ saat backup harian gagal.

## Memulihkan

Dari salinan VPS (tidak terenkripsi):

```sh
pm2 stop hris-app-api
pg_restore --clean --if-exists --no-owner -d "postgresql://hris_app:...@127.0.0.1:5432/hris_app" \
  /root/backups/hris-app/hris-db-YYYYMMDD-HHMM.dump
tar -xzf /root/backups/hris-app/hris-files-YYYYMMDD-HHMM.tar.gz -C /var/www/hris-app/backend
pm2 start hris-app-api
```

Dari Telegram: unduh file `.enc`, lalu buka dengan kata sandi backup:

```sh
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in hris-db-YYYYMMDD-HHMM.dump.enc -out hris-db.dump
```

lalu `pg_restore` seperti di atas. Arsip file: dekripsi dengan perintah yang sama, lalu `tar -xzf`.

Uji pemulihan sesekali ke database percobaan (bukan `hris_app`) agar yakin backup bisa dipakai.
