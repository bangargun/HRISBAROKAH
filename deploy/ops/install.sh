#!/bin/bash
# Pasang jadwal ops HRIS di crontab root (dipanggil deploy.sh; aman dijalankan berulang).
# Hanya baris bertanda "# hris-app-ops" yang diganti; jadwal aplikasi lain tidak disentuh.
set -euo pipefail
OPS=/var/www/hris-app/deploy/ops
chmod 700 "$OPS"/*.sh
LINES="30 4 * * * /bin/bash $OPS/backup.sh >/dev/null 2>&1 # hris-app-ops
*/5 * * * * /bin/bash $OPS/monitor.sh >/dev/null 2>&1 # hris-app-ops"
{ crontab -l 2>/dev/null | grep -v '# hris-app-ops' || true; echo "$LINES"; } | crontab -
