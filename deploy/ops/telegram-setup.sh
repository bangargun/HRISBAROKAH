#!/bin/bash
# Menghubungkan bot Telegram HRIS. Jalankan sekali di VPS sebagai root:
#   1. Buat bot di @BotFather, salin tokennya.
#   2. bash /var/www/hris-app/deploy/ops/telegram-setup.sh
#      (token diminta tanpa ditampilkan, lalu disimpan di /root/.hris-ops.env)
#   3. Kirim /start ke bot dari akun Telegram yang menerima backup & peringatan.
set -euo pipefail
. "$(dirname "$0")/common.sh"

if [ -z "${HRIS_TG_BOT_TOKEN:-}" ]; then
  read -rsp "Token bot dari BotFather: " HRIS_TG_BOT_TOKEN; echo
  tg_api getMe | grep -q '"ok":true' || { echo "Token ditolak Telegram." >&2; exit 1; }
  ops_set HRIS_TG_BOT_TOKEN "$HRIS_TG_BOT_TOKEN"
fi
BOT=$(tg_api getMe | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["username"])')
echo "Kirim /start ke @$BOT dari akun Telegram penerima. Menunggu sampai 2 menit..."
for _ in $(seq 1 24); do
  CHAT=$(tg_api getUpdates | python3 -c '
import json,sys
msgs=[u["message"] for u in json.load(sys.stdin).get("result",[]) if "message" in u and u["message"].get("text","").startswith("/start")]
print(msgs[-1]["chat"]["id"] if msgs else "")')
  if [ -n "$CHAT" ]; then
    ops_set HRIS_TG_CHAT_ID "$CHAT"
    HRIS_TG_CHAT_ID=$CHAT
    tg_send "✅ Bot HRIS terhubung. Backup harian (04:30) dan peringatan server akan dikirim ke chat ini."
    echo "Terhubung ke chat $CHAT."
    exit 0
  fi
  sleep 5
done
echo "Belum ada /start yang masuk. Jalankan lagi skrip ini setelah mengirim /start." >&2
exit 1
