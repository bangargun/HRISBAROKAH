#!/bin/bash
# Pemeriksaan sebelum deploy (jalan di Mac, dipanggil deploy.sh). Deploy dibatalkan bila ada yang gagal.
#   1. Backend: cek tipe + unit test
#   2. Web admin: cek tipe
#   3. Aplikasi kru: flutter analyze
#   4. Semua uji API (backend/scripts/e2e-*.mjs) terhadap backend sementara di port 3100
#      dengan database percobaan baru (hris_barokah_e2e) yang dihapus lagi setelahnya.
set -euo pipefail
export PRISMA_HIDE_UPDATE_MESSAGE=1
cd "$(dirname "$0")/.."
ROOT=$(pwd)
FLUTTER=${FLUTTER:-$(command -v flutter || echo /Users/argun/development/flutter/bin/flutter)}
E2E_DB=hris_barokah_e2e
E2E_PORT=3100
step() { printf '\n== %s\n' "$*"; }

step "Backend: cek tipe + unit test"
(cd backend && npx tsc --noEmit -p tsconfig.json && npm test --silent > /tmp/hris-unit.log 2>&1) \
  || { tail -30 /tmp/hris-unit.log; exit 1; }

step "Web admin: cek tipe"
(cd web-admin && npx tsc --noEmit)

step "Aplikasi kru: flutter analyze"
(cd mobile_user && "$FLUTTER" analyze --no-pub > /tmp/hris-analyze.log 2>&1) || { cat /tmp/hris-analyze.log; exit 1; }

step "Uji API di database percobaan"
BASE=$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"')
E2E_URL=$(echo "$BASE" | sed -E "s#/[^/?]+(\?|$)#/$E2E_DB\1#")
ADMIN_URL=$(echo "$BASE" | sed -E 's#/[^/?]+(\?.*)?$#/postgres#')
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; fi || true
  psql "$ADMIN_URL" -qc "drop database if exists $E2E_DB with (force)" > /dev/null 2>&1 || true
}
trap cleanup EXIT
psql "$ADMIN_URL" -qc "drop database if exists $E2E_DB with (force)" -c "create database $E2E_DB" > /dev/null
(cd backend && DATABASE_URL="$E2E_URL" npx prisma db push --skip-generate > /dev/null \
  && DATABASE_URL="$E2E_URL" ADMIN_INITIAL_PASSWORD=e2e-admin-pass-123 npx prisma db seed > /dev/null)
(cd backend && PORT=$E2E_PORT JWT_SECRET=e2e-check-secret DATABASE_URL="$E2E_URL" exec node dist/main > /tmp/hris-e2e-api.log 2>&1) &
SERVER_PID=$!
for _ in $(seq 1 30); do curl -s -o /dev/null "http://localhost:$E2E_PORT/api/v1/health" && break; sleep 1; done
export E2E_API="http://localhost:$E2E_PORT/api/v1" E2E_ADMIN_USER=admin E2E_ADMIN_PASS=e2e-admin-pass-123
export E2E_DATABASE_URL="${E2E_URL%%\?*}"
FAILED=0
for f in backend/scripts/e2e-*.mjs; do
  if OUT=$(node "$f" 2>&1); then
    echo "lulus  $(basename "$f") ($(echo "$OUT" | grep -c '^PASS') cek)"
  else
    FAILED=1
    echo "GAGAL  $(basename "$f")"
    echo "$OUT" | grep -v '^PASS' | tail -15
  fi
done
[ $FAILED -eq 0 ] || exit 1
echo
echo "Semua pemeriksaan lulus."
