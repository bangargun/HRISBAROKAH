#!/bin/sh
# Deploy / update dari Mac ke VPS.
# Pemakaian: deploy/deploy.sh root@187.77.122.142
set -e
TARGET=${1:?Pemakaian: deploy/deploy.sh root@IP-VPS}
DOMAIN=hris.barokahgroupindonesia.tech
APP_DIR=/var/www/hris-app
cd "$(dirname "$0")/.."

# Server mengambil kode dari GitHub, jadi semua perubahan harus sudah di-push
git fetch -q origin main
if [ -n "$(git status --porcelain)" ] || [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "Ada perubahan yang belum di-commit atau belum di-push ke origin/main. Commit & push dulu." >&2
  exit 1
fi

# Aplikasi kru (Flutter web) dibangun di Mac lalu dikirim
(cd mobile_user && flutter build web --base-href /kru/ --dart-define=API_URL="https://$DOMAIN/api/v1" -o build/web-prod)
rsync -az --delete mobile_user/build/web-prod/ "$TARGET:$APP_DIR/kru/"

ssh "$TARGET" "set -e
cd $APP_DIR && git pull --ff-only
cd backend && npm ci --no-audit --no-fund && npx prisma generate && npx prisma db push --skip-generate && npm run build
cd ../web-admin && npm ci --no-audit --no-fund && npm run build
cd .. && pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save"
echo "Selesai: https://$DOMAIN"
