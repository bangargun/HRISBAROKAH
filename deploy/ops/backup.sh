#!/bin/bash
# ==============================================================================
# BACKUP HARIAN HRIS (cron 04:30 WIB, saat VPS sepi; dipasang oleh install.sh)
#
# Isi: database hris_app (pg_dump format custom) + file pribadi (backend/storage:
# foto absen, wajah, dokumen karyawan) + backend/uploads.
#   - Disimpan di VPS: /root/backups/hris-app, 14 hari terakhir.
#   - Dikirim ke Telegram (bot HRIS): database selalu; file bila < 45 MB. Keduanya
#     dienkripsi AES-256 dengan HRIS_BACKUP_PASSPHRASE.
#
# Kata sandi dibuat pada jalan pertama dan dikirim SEKALI ke Telegram. Simpan di
# tempat aman di luar VPS: tanpa itu backup di Telegram tidak bisa dibuka.
#
# Memulihkan: lihat docs/OPERASIONAL-BACKUP.md
# ==============================================================================
set -euo pipefail
. "$(dirname "$0")/common.sh"

trap 'log "Backup GAGAL (baris $LINENO)"; tg_send "⚠️ HRIS: backup harian GAGAL pada $(date "+%d-%m-%Y %H:%M"). Cek /var/log/hris-ops.log di VPS."' ERR

STAMP=$(date +%Y%m%d-%H%M)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# 1. Database
DB_FILE="$BACKUP_DIR/hris-db-$STAMP.dump"
pg_dump --format=custom --no-owner --no-privileges --dbname="$(db_url)" --file="$DB_FILE"
pg_restore --list "$DB_FILE" > /dev/null   # file bisa dibaca kembali

# 2. File pribadi & unggahan (bila sudah ada)
FILES_FILE=""
DIRS=()
for d in storage uploads; do
  if [ -d "$APP_DIR/backend/$d" ]; then DIRS+=("$d"); fi
done
if [ ${#DIRS[@]} -gt 0 ]; then
  FILES_FILE="$BACKUP_DIR/hris-files-$STAMP.tar.gz"
  tar -czf "$FILES_FILE" -C "$APP_DIR/backend" "${DIRS[@]}"
fi

# 3. Hapus backup lokal lebih dari 14 hari
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hris-*' -mtime +14 -delete

# 4. Salinan terenkripsi ke Telegram (setelah bot dihubungkan dengan telegram-setup.sh)
DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
NOTE="database $DB_SIZE"
if tg_ready; then
  if [ -z "${HRIS_BACKUP_PASSPHRASE:-}" ]; then
    HRIS_BACKUP_PASSPHRASE=$(openssl rand -base64 33 | tr -d '/+=' | cut -c1-40)
    export HRIS_BACKUP_PASSPHRASE
    ops_set HRIS_BACKUP_PASSPHRASE "$HRIS_BACKUP_PASSPHRASE"
    tg_send "🔑 Kata sandi backup HRIS. Simpan di tempat aman di luar VPS (pesan ini hanya dikirim sekali), lalu boleh hapus pesan ini:
$HRIS_BACKUP_PASSPHRASE"
    log "Kata sandi backup baru dibuat"
  fi
  encrypt() {
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:HRIS_BACKUP_PASSPHRASE -in "$1" -out "$2"
  }
  encrypt "$DB_FILE" "$WORK/hris-db-$STAMP.dump.enc"
  tg_file "$WORK/hris-db-$STAMP.dump.enc" "Backup database HRIS $STAMP" || { log "Kirim backup database ke Telegram gagal"; false; }
  if [ -n "$FILES_FILE" ]; then
    if [ "$(du -k "$FILES_FILE" | cut -f1)" -lt 46080 ]; then
      encrypt "$FILES_FILE" "$WORK/hris-files-$STAMP.tar.gz.enc"
      tg_file "$WORK/hris-files-$STAMP.tar.gz.enc" "Backup file HRIS $STAMP" || { log "Kirim backup file ke Telegram gagal"; false; }
      NOTE="$NOTE, file $(du -h "$FILES_FILE" | cut -f1)"
    else
      NOTE="$NOTE, file $(du -h "$FILES_FILE" | cut -f1) (terlalu besar untuk Telegram, hanya di VPS)"
    fi
  fi
else
  NOTE="$NOTE (Telegram belum dihubungkan: salinan hanya di VPS)"
fi

date +%s > "$STATE_DIR/last-backup-ok"
log "Backup selesai: $NOTE"
