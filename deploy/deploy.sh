#!/bin/sh
# Deploy / update dari Mac ke VPS.
# Pemakaian: deploy/deploy.sh root@187.77.122.142
set -e
TARGET=${1:?Pemakaian: deploy/deploy.sh root@IP-VPS}
DOMAIN=hris.barokahgroupindonesia.tech
APP_DIR=/var/www/hris-app
cd "$(dirname "$0")/.."

# VPS dipakai aplikasi lain sejak jam 10 pagi: deploy (build di server) sebaiknya sebelum itu
HOUR=$(TZ=Asia/Jakarta date +%-H)
if [ "$HOUR" -ge 10 ] && [ "$HOUR" -lt 22 ] && [ "${DEPLOY_ANYTIME:-}" != 1 ]; then
  printf 'Sekarang jam %s WIB: VPS sedang dipakai aplikasi lain. Tetap deploy? (y/N) ' "$(TZ=Asia/Jakarta date +%H:%M)"
  read -r answer
  [ "$answer" = y ] || [ "$answer" = Y ] || { echo "Dibatalkan. Deploy sebelum jam 10 pagi atau setelah jam 10 malam."; exit 1; }
fi

# Server mengambil kode dari GitHub, jadi semua perubahan harus sudah di-push
git fetch -q origin main
if [ -n "$(git status --porcelain)" ] || [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "Ada perubahan yang belum di-commit atau belum di-push ke origin/main. Commit & push dulu." >&2
  exit 1
fi

# Uji dulu di Mac; deploy dibatalkan bila ada yang gagal (darurat: SKIP_CHECKS=1)
if [ "${SKIP_CHECKS:-}" = 1 ]; then
  echo "PERINGATAN: pemeriksaan dilewati (SKIP_CHECKS=1)" >&2
else
  deploy/check.sh
fi

# Aplikasi kru (Flutter web) dibangun di Mac lalu dikirim
(cd mobile_user && flutter build web --base-href /kru/ --dart-define=API_URL="https://$DOMAIN/api/v1" -o build/web-prod)
rsync -az --delete mobile_user/build/web-prod/ "$TARGET:$APP_DIR/kru/"

ssh "$TARGET" "set -e
cd $APP_DIR && git pull --ff-only
cd backend && npm ci --no-audit --no-fund && npx prisma generate && npx prisma db push --skip-generate && npm run build
cd ../web-admin && npm ci --no-audit --no-fund && npm run build
cd .. && pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save
bash deploy/ops/install.sh"
echo "Selesai: https://$DOMAIN"
