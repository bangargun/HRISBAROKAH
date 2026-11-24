# Dipakai skrip ops HRIS (backup.sh, monitor.sh, telegram-setup.sh). Jalan sebagai root di VPS.
# Bot Telegram HRIS dipakai aplikasi (notifikasi) dan ops (backup & peringatan). Tokennya di
# backend/.env (TELEGRAM_BOT_TOKEN). Rahasia khusus ops di /root/.hris-ops.env (chmod 600):
#   HRIS_TG_CHAT_ID         chat penerima backup & peringatan (diisi telegram-setup.sh)
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

APP_ENV="$APP_DIR/backend/.env"
app_env_get() { grep "^$1=" "$APP_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'; }
app_env_set() {
  grep -v "^$1=" "$APP_ENV" > "$APP_ENV.tmp" || true
  echo "$1=\"$2\"" >> "$APP_ENV.tmp"
  cat "$APP_ENV.tmp" > "$APP_ENV"
  rm -f "$APP_ENV.tmp"
}
# Token lama (versi pertama skrip menyimpannya di file ops) tetap dipakai sampai dipindahkan
HRIS_TG_BOT_TOKEN="$(app_env_get TELEGRAM_BOT_TOKEN)"
HRIS_TG_BOT_TOKEN="${HRIS_TG_BOT_TOKEN:-$(grep '^HRIS_TG_BOT_TOKEN=' "$OPS_ENV" | cut -d= -f2-)}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; }

# Pasang bot di aplikasi: token, secret webhook dan alamat publik di backend/.env.
# Mengembalikan 0 bila ada yang berubah (API perlu di-restart).
ensure_app_bot_env() {
  local changed=1
  [ -n "${HRIS_TG_BOT_TOKEN:-}" ] || return 1
  if [ "$(app_env_get TELEGRAM_BOT_TOKEN)" != "$HRIS_TG_BOT_TOKEN" ]; then app_env_set TELEGRAM_BOT_TOKEN "$HRIS_TG_BOT_TOKEN"; changed=0; fi
  if [ -z "$(app_env_get TELEGRAM_WEBHOOK_SECRET)" ]; then app_env_set TELEGRAM_WEBHOOK_SECRET "$(openssl rand -hex 32)"; changed=0; fi
  if [ -z "$(app_env_get APP_PUBLIC_URL)" ]; then app_env_set APP_PUBLIC_URL "https://$DOMAIN"; changed=0; fi
  if grep -q '^HRIS_TG_BOT_TOKEN=' "$OPS_ENV"; then
    grep -v '^HRIS_TG_BOT_TOKEN=' "$OPS_ENV" > "$OPS_ENV.tmp" || true
    mv "$OPS_ENV.tmp" "$OPS_ENV"; chmod 600 "$OPS_ENV"
  fi
  return $changed
}

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
