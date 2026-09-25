#!/usr/bin/env bash
# Nightly logical backup of the `tms` database — installed to /srv/tms/mysql/backup.sh
# and run by tms-mysql-backup.timer. Consistent snapshot without locking the app
# (--single-transaction, InnoDB). Keeps 14 days in /srv/tms/backups.
set -euo pipefail

BACKUP_DIR=/srv/tms/backups
RETENTION_DAYS=14
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/tms-${STAMP}.sql.gz"
TMP="${OUT}.partial"

umask 077
mkdir -p "${BACKUP_DIR}"

# The backup user's password is read inside the container from a root-only file
# (never on a command line).
docker exec -i tms-mysql sh -c '
  MYSQL_PWD="$(cat /run/tms-backup/password)" exec mysqldump -u tms_backup \
    --single-transaction --quick --routines --triggers --events \
    --no-tablespaces --set-gtid-purged=OFF --databases tms
' | gzip -6 > "${TMP}"

# Refuse to keep an empty/truncated dump.
gzip -t "${TMP}"
zcat "${TMP}" | tail -n 1 | grep -q 'Dump completed' || { echo "dump incomplete" >&2; rm -f "${TMP}"; exit 1; }
mv "${TMP}" "${OUT}"

find "${BACKUP_DIR}" -maxdepth 1 -name 'tms-*.sql.gz' -mtime +"${RETENTION_DAYS}" -delete
echo "backup ok: ${OUT} ($(du -h "${OUT}" | cut -f1))"
