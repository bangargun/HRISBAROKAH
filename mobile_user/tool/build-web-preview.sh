#!/bin/sh
# Bangun aplikasi kru versi web untuk menu "Aplikasi Kru" di web admin.
# Hasilnya di build/web, disajikan di http://localhost:3003 (LaunchAgent com.barokah.hris.crewapp).
# Jalankan ulang setiap kali kode aplikasi HP berubah.
set -e
cd "$(dirname "$0")/.."
API_URL="${API_URL:-http://localhost:3000/api/v1}"
flutter build web --dart-define=API_URL="$API_URL"
echo "Selesai. Buka menu Aplikasi Kru di web admin (atau http://localhost:3003)."
