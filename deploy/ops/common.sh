# Dipakai skrip ops HRIS (backup.sh, monitor.sh, telegram-setup.sh). Jalan sebagai root di VPS.
# Rahasia ops ada di /root/.hris-ops.env (chmod 600), bukan di repo:
#   HRIS_TG_BOT_TOKEN   token bot Telegram HRIS (dari BotFather)
#   HRIS_TG_CHAT_ID     chat penerima backup & peringatan (diisi telegram-setup.sh)
#   HRIS_BACKUP_PASSPHRASE  kata sandi enkripsi backup (dibuat backup.sh pada jalan pertama)
APP_DIR=/var/www/hris-app
DOMAIN=hris.barokahgroupindonesia.tech
OPS_ENV=/root/.hris-ops.env
BACKUP_DIR=/root/backups/hris-app
STATE_DIR=/var/lib/hris-ops
LOG_FILE=/var/log/hris-ops.log

umask 077
mkdir -p "$BACKUP_DIR" "$STATE_DIR"
[ -f "$OPS_ENV" ] || { touch "$OPS_ENV"; chmod 600 "$OPS_ENV"; }
set -a
. "$OPS_ENV"
set +a

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; }

# Simpan / ganti satu nilai di file rahasia ops
ops_set() {
  grep -v "^$1=" "$OPS_ENV" > "$OPS_ENV.tmp" || true
  echo "$1=$2" >> "$OPS_ENV.tmp"
  mv "$OPS_ENV.tmp" "$OPS_ENV"
  chmod 600 "$OPS_ENV"
}

tg_ready() { [ -n "${HRIS_TG_BOT_TOKEN:-}" ] && [ -n "${HRIS_TG_CHAT_ID:-}" ]; }

tg_api() { curl -sS --max-time 120 "https://api.telegram.org/bot${HRIS_TG_BOT_TOKEN}/$1" "${@:2}"; }

# Kirim pesan teks; gagal kirim hanya dicatat di log
tg_send() {
  tg_ready || { log "Telegram belum diatur: $1"; return 0; }
  tg_api sendMessage --data-urlencode "chat_id=${HRIS_TG_CHAT_ID}" --data-urlencode "text=$1" > /dev/null \
    || log "Gagal kirim pesan Telegram"
}

# Kirim file (maks 50 MB dari bot)
tg_file() {
  tg_ready || return 1
  tg_api sendDocument -F "chat_id=${HRIS_TG_CHAT_ID}" -F "document=@$1" -F "caption=$2" | grep -q '"ok":true'
}

# DATABASE_URL aplikasi tanpa ?schema=... (pg_dump tidak menerimanya)
db_url() {
  grep '^DATABASE_URL=' "$APP_DIR/backend/.env" | cut -d= -f2- | tr -d '"' | sed 's/?.*$//'
}
