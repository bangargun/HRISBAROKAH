#!/bin/sh
# Pemasangan pertama di VPS (sebagai root), mengikuti pola server yang sudah ada:
# PostgreSQL bawaan server, PM2, Nginx. Tidak menyentuh aplikasi lain.
set -e
APP_DIR=/var/www/hris-app
REPO=https://github.com/bangargun/HRISBAROKAH.git
DOMAIN=hris.barokahgroupindonesia.tech
DB=hris_app

[ -d "$APP_DIR/.git" ] || git clone "$REPO" "$APP_DIR"
mkdir -p "$APP_DIR/kru"

# Database & user baru di PostgreSQL yang sudah ada (password acak, hanya di backend/.env)
if [ ! -f "$APP_DIR/backend/.env" ]; then
  DB_PASS=$(openssl rand -hex 24)
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $DB LOGIN PASSWORD '$DB_PASS'"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB OWNER $DB"
  cat > "$APP_DIR/backend/.env" <<ENV
PORT=3110
DATABASE_URL="postgresql://$DB:$DB_PASS@127.0.0.1:5432/$DB?schema=public"
JWT_SECRET="$(openssl rand -hex 48)"
JWT_EXPIRES_IN="7d"
FACE_MATCH_THRESHOLD=0.5
ADMIN_INITIAL_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=')
BUSINESS_TIMEZONE=Asia/Jakarta
LATE_GRACE_MINUTES=0
ENV
  chmod 600 "$APP_DIR/backend/.env"
fi

cat > "$APP_DIR/web-admin/.env.production.local" <<ENV
NEXT_PUBLIC_API_URL=https://$DOMAIN/api/v1
NEXT_PUBLIC_CREW_APP_URL=https://$DOMAIN/kru/
NEXT_TELEMETRY_DISABLED=1
ENV

echo "Server siap. Lanjutkan dengan deploy/deploy.sh dari Mac."
