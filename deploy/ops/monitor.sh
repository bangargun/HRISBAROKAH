#!/bin/bash
# ==============================================================================
# PEMANTAUAN HRIS (cron tiap 5 menit; dipasang oleh install.sh)
#
# Cek: API + database (/api/v1/health lewat Nginx), web admin, aplikasi kru,
# backup terakhir < 26 jam, disk < 90%. Peringatan ke Telegram saat masalah mulai,
# diulang tiap 2 jam selama belum pulih, dan pesan "pulih" saat beres.
# ==============================================================================
set -uo pipefail
. "$(dirname "$0")/common.sh"

NOW=$(date +%s)
REPEAT=7200

check() {   # check <kunci> <pesan bila gagal> <perintah...>
  local key=$1 msg=$2; shift 2
  local state="$STATE_DIR/alert-$key"
  if "$@" > /dev/null 2>&1; then
    if [ -f "$state" ]; then
      rm -f "$state"
      tg_send "✅ HRIS pulih: $msg"
      log "Pulih: $key"
    fi
  else
    local last=0
    [ -f "$state" ] && last=$(cat "$state")
    if [ $((NOW - last)) -ge $REPEAT ]; then
      echo "$NOW" > "$state"
      tg_send "🚨 HRIS bermasalah: $msg ($(date '+%d-%m %H:%M'))"
      log "Masalah: $key"
    fi
  fi
}

http_ok() { curl -fsS --max-time 15 -o /dev/null "$1"; }
backup_fresh() {
  # Sebelum backup pertama tidak ada yang dicek
  [ ! -f "$STATE_DIR/last-backup-ok" ] && return 0
  [ $((NOW - $(cat "$STATE_DIR/last-backup-ok"))) -lt 93600 ]
}
disk_ok() { [ "$(df --output=pcent / | tail -1 | tr -dc '0-9')" -lt 90 ]; }

check api "API atau database tidak menjawab" http_ok "https://$DOMAIN/api/v1/health"
check web "web admin tidak bisa dibuka" http_ok "https://$DOMAIN/login"
check kru "aplikasi kru tidak bisa dibuka" http_ok "https://$DOMAIN/kru/"
check backup "backup terakhir lebih dari 26 jam lalu" backup_fresh
check disk "disk VPS terisi 90% atau lebih" disk_ok
exit 0
