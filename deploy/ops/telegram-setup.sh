#!/bin/bash
# Menghubungkan bot Telegram HRIS (notifikasi aplikasi + backup & peringatan server).
# Jalankan dari Mac:  ssh -t root@187.77.122.142 bash /var/www/hris-app/deploy/ops/telegram-setup.sh
#   1. Buat bot di @BotFather, salin tokennya, tempel saat diminta (tidak tampil di layar).
#   2. Masuk web admin sebagai Super Admin → Akun saya → Telegram → Hubungkan Telegram → Start.
#      Chat itu menjadi penerima backup & peringatan server.
# Tambahkan --ganti-penerima untuk memilih ulang chat penerima peringatan.
set -euo pipefail
. "$(dirname "$0")/common.sh"

if [ -z "${HRIS_TG_BOT_TOKEN:-}" ]; then
  read -rsp "Token bot dari BotFather: " HRIS_TG_BOT_TOKEN; echo
fi
tg_api getMe | grep -q '"ok":true' || { echo "Token ditolak Telegram." >&2; exit 1; }
if ensure_app_bot_env; then
  pm2 restart hris-app-api --update-env > /dev/null
  echo "Bot dipasang di aplikasi; API di-restart."
fi
BOT=$(tg_api getMe | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["username"])')

if [ -n "${HRIS_TG_CHAT_ID:-}" ] && [ "${1:-}" != "--ganti-penerima" ]; then
  echo "Bot @$BOT aktif. Peringatan server sudah dikirim ke chat yang terdaftar (pakai --ganti-penerima untuk mengganti)."
  exit 0
fi

echo "Sekarang masuk web admin sebagai Super Admin → Akun saya → Telegram → Hubungkan Telegram,"
echo "lalu tekan Start di bot @$BOT. Menunggu sampai 3 menit..."
SINCE=$(date -u '+%Y-%m-%d %H:%M:%S')
for _ in $(seq 1 36); do
  CHAT=$(psql "$(db_url)" -tAc "select l.\"chatId\" from \"TelegramLink\" l join \"User\" u on u.id = l.\"userId\"
    where u.role = 'SUPER_ADMIN' and u.\"isActive\" and l.\"linkedAt\" >= '$SINCE' order by l.\"linkedAt\" desc limit 1")
  if [ -n "$CHAT" ]; then
    ops_set HRIS_TG_CHAT_ID "$CHAT"
    HRIS_TG_CHAT_ID=$CHAT
    tg_send "✅ Chat ini juga menerima backup harian (04:30) dan peringatan server HRIS."
    echo "Selesai: backup & peringatan dikirim ke chat Super Admin itu."
    exit 0
  fi
  sleep 5
done
echo "Belum ada Super Admin yang menghubungkan Telegram. Jalankan lagi skrip ini." >&2
exit 1
