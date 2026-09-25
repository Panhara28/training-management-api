#!/usr/bin/env bash
# Phase 3 — MySQL 8.4 LTS on tmsdb.
# Usage (as root): phase3-mysql.sh <path-to-infra-dir>
# Idempotent: safe to run more than once. Secrets are generated once on the
# server and never printed or passed on a command line.
set -euo pipefail

SRC="${1:?path to infra/ directory required}"
BASE=/srv/tms/mysql
SECRETS="${BASE}/secrets"
MYSQL_UID="${MYSQL_UID:-999}"   # uid of the mysql user inside mysql:8.4.11
APP_HOSTS=(172.20.15.56 172.20.15.57 172.20.15.58)

log() { printf '\n==> %s\n' "$*"; }

log "directories"
install -d -m 755 /srv/tms "${BASE}"
# mkdir + chown: Ubuntu 26.04's coreutils `install -o` rejects numeric uids.
mkdir -p "${BASE}/data" "${BASE}/logs"
chown "${MYSQL_UID}:${MYSQL_UID}" "${BASE}/data" "${BASE}/logs"
chmod 750 "${BASE}/data" "${BASE}/logs"
install -d -m 755 "${BASE}/conf.d"
install -d -m 700 "${SECRETS}"
install -d -m 700 /srv/tms/backups

log "secrets (generated once, owner mysql uid ${MYSQL_UID}, mode 400)"
for name in root_password app_password backup_password; do
  f="${SECRETS}/${name}"
  if [[ ! -s "$f" ]]; then
    # hex: no characters that would need escaping in a DATABASE_URL
    ( umask 077; openssl rand -hex 24 > "$f" )
    echo "generated ${f}"
  fi
  chown "${MYSQL_UID}:${MYSQL_UID}" "$f"
  chmod 400 "$f"
done

log "config, compose, backup script, systemd units"
install -m 644 "${SRC}/mysql/compose.yml"     "${BASE}/compose.yml"
install -m 644 "${SRC}/mysql/conf.d/tms.cnf"  "${BASE}/conf.d/tms.cnf"
install -m 700 "${SRC}/mysql/backup.sh"       "${BASE}/backup.sh"
install -m 644 "${SRC}/systemd/tms-mysql-backup.service" /etc/systemd/system/
install -m 644 "${SRC}/systemd/tms-mysql-backup.timer"   /etc/systemd/system/

log "start MySQL"
docker compose -f "${BASE}/compose.yml" up -d
for i in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' tms-mysql 2>/dev/null || echo starting)"
  [[ "$status" == "healthy" ]] && break
  sleep 5
done
[[ "$status" == "healthy" ]] || { echo "tms-mysql not healthy (status: ${status})"; docker logs --tail 50 tms-mysql; exit 1; }
echo "tms-mysql is healthy"

log "database users (tms_app from app servers only, tms_backup local only)"
{
  APP_PW="$(cat "${SECRETS}/app_password")"
  BACKUP_PW="$(cat "${SECRETS}/backup_password")"
  echo "CREATE DATABASE IF NOT EXISTS tms CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
  for host in "${APP_HOSTS[@]}"; do
    echo "CREATE USER IF NOT EXISTS 'tms_app'@'${host}' IDENTIFIED BY '${APP_PW}';"
    echo "ALTER USER 'tms_app'@'${host}' IDENTIFIED BY '${APP_PW}';"
    echo "GRANT ALL PRIVILEGES ON tms.* TO 'tms_app'@'${host}';"
  done
  for host in localhost 127.0.0.1; do
    echo "CREATE USER IF NOT EXISTS 'tms_backup'@'${host}' IDENTIFIED BY '${BACKUP_PW}';"
    echo "ALTER USER 'tms_backup'@'${host}' IDENTIFIED BY '${BACKUP_PW}';"
    echo "GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES ON tms.* TO 'tms_backup'@'${host}';"
  done
  echo "FLUSH PRIVILEGES;"
} | docker exec -i tms-mysql sh -c 'MYSQL_PWD="$(cat /run/secrets/mysql_root_password)" exec mysql -u root --batch'

log "firewall: 3306 only from the app servers"
for host in "${APP_HOSTS[@]}"; do
  ufw allow proto tcp from "${host}" to any port 3306 comment 'mysql from app server' >/dev/null
done

log "log rotation"
cat > /etc/logrotate.d/tms-mysql <<'EOF'
/srv/tms/mysql/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

log "nightly backup timer"
systemctl daemon-reload
systemctl enable --now tms-mysql-backup.timer >/dev/null

log "phase 3 done on $(hostname)"
