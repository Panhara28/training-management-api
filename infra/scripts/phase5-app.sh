#!/usr/bin/env bash
# Phase 5 — prepare an app server (tmsapp01-03) for Pongreay.
# Usage (as root): phase5-app.sh <path-to-infra-dir> <secrets-file>
#   secrets-file: KEY=VALUE lines for APP_DB_PASSWORD, JWT_SECRET, SESSION_SECRET.
#   It is shredded after reading.
# Idempotent. Only the keys listed below are managed; any other line in the env
# files (e.g. MOC_OAUTH_*, MOC_STORAGE_* you add) is preserved. JWT_SECRET and
# SESSION_SECRET are only written when absent, so re-runs never log users out.
set -euo pipefail

SRC="${1:?path to infra/ directory required}"
SECRETS_FILE="${2:?secrets file required}"
DEPLOY_USER=panhara
API_ENV=/etc/pongreay/tms-api/production.env
WEB_ENV=/etc/pongreay/tms-web/production.env

log() { printf '\n==> %s\n' "$*"; }

# ── Read secrets, then destroy the file ──────────────────────────────────────
declare -A S
while IFS='=' read -r k v; do [[ -n "$k" ]] && S["$k"]="$v"; done < "${SECRETS_FILE}"
shred -u "${SECRETS_FILE}"
for k in APP_DB_PASSWORD JWT_SECRET SESSION_SECRET; do
  [[ -n "${S[$k]:-}" ]] || { echo "missing ${k} in secrets file" >&2; exit 1; }
done

# ── Firewall: app ports reachable only from the load balancer ────────────────
log "DOCKER-USER firewall unit"
install -m 750 "${SRC}/firewall/tms-docker-user.sh" /usr/local/sbin/tms-docker-user.sh
install -m 644 "${SRC}/firewall/tms-docker-user.service" /etc/systemd/system/tms-docker-user.service
systemctl daemon-reload
systemctl enable tms-docker-user.service >/dev/null
systemctl restart tms-docker-user.service
systemctl --no-pager -o cat status tms-docker-user.service | tail -3

# ── Env files ────────────────────────────────────────────────────────────────
# set_kv FILE KEY VALUE [only-if-absent]
set_kv() {
  local file="$1" key="$2" value="$3" only_if_absent="${4:-}"
  if grep -q "^${key}=" "$file"; then
    [[ -n "$only_if_absent" ]] && return 0
    local tmp; tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' "$file" > "$tmp"
    cat "$tmp" > "$file"; rm -f "$tmp"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

prepare_env_file() {
  local file="$1"
  install -d -m 700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "$(dirname "$file")"
  [[ -f "$file" ]] || : > "$file"
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "$file"
  chmod 600 "$file"
}

log "API env file ${API_ENV}"
prepare_env_file "${API_ENV}"
set_kv "${API_ENV}" NODE_ENV production
set_kv "${API_ENV}" PORT 8090
set_kv "${API_ENV}" DATABASE_URL "mysql://tms_app:${S[APP_DB_PASSWORD]}@172.20.15.59:3306/tms?connection_limit=20"
set_kv "${API_ENV}" JWT_SECRET "${S[JWT_SECRET]}" only-if-absent
set_kv "${API_ENV}" SESSION_SECRET "${S[SESSION_SECRET]}" only-if-absent
set_kv "${API_ENV}" CORS_ORIGIN https://tms.moc.gov.kh
set_kv "${API_ENV}" CORS_CREDENTIALS true
set_kv "${API_ENV}" TRUST_PROXY 172.20.15.55,172.20.15.56,172.20.15.57,172.20.15.58
set_kv "${API_ENV}" SWAGGER_ENABLED false
set_kv "${API_ENV}" MOC_OAUTH_REDIRECT_URI https://tms.moc.gov.kh/auth/callback

log "web env file ${WEB_ENV} (no database credentials)"
prepare_env_file "${WEB_ENV}"
set_kv "${WEB_ENV}" NODE_ENV production
set_kv "${WEB_ENV}" PORT 3000
set_kv "${WEB_ENV}" HOSTNAME 0.0.0.0
set_kv "${WEB_ENV}" API_URL http://172.20.15.55:8090
set_kv "${WEB_ENV}" JWT_SECRET "${S[JWT_SECRET]}" only-if-absent
set_kv "${WEB_ENV}" SESSION_SECRET "${S[SESSION_SECRET]}" only-if-absent

log "values you still need to add to ${API_ENV}"
for k in MOC_OAUTH_BASE_URL MOC_OAUTH_CLIENT_ID MOC_OAUTH_CLIENT_SECRET \
         MOC_STORAGE_BASE_URL MOC_STORAGE_ACCESS_KEY MOC_STORAGE_SECRET_KEY MOC_STORAGE_BUCKET_SLUG; do
  grep -q "^${k}=." "${API_ENV}" && echo "  ok      ${k}" || echo "  MISSING ${k}"
done

log "boot safety net"
bash "${SRC}/scripts/install-ensure-up.sh" "${SRC}" "containers:tms-api,tms-web"

log "phase 5 app prep done on $(hostname)"
