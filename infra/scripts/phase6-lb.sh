#!/usr/bin/env bash
# Phase 6 — Nginx load balancer on tmslb.
# Usage (as root): phase6-lb.sh <path-to-infra-dir>
# Idempotent. HTTPS for tms.moc.gov.kh is switched on only when the
# certificate exists (issue it with /srv/tms/nginx/issue-cert.sh once DNS points
# here); until then the site answers on port 80 with ACME + redirect only.
set -euo pipefail

SRC="${1:?path to infra/ directory required}"
BASE=/srv/tms/nginx
APP_HOSTS=(172.20.15.56 172.20.15.57 172.20.15.58)

log() { printf '\n==> %s\n' "$*"; }

log "directories"
install -d -m 755 /srv/tms "${BASE}" "${BASE}/conf.d" "${BASE}/snippets" "${BASE}/pending" "${BASE}/acme"
install -d -m 750 "${BASE}/logs"
install -d -m 700 /srv/tms/letsencrypt

log "config files"
install -m 644 "${SRC}/nginx/compose.yml"  "${BASE}/compose.yml"
install -m 644 "${SRC}/nginx/nginx.conf"   "${BASE}/nginx.conf"
install -m 644 "${SRC}/nginx/snippets/"*.conf "${BASE}/snippets/"
install -m 644 "${SRC}/nginx/pending/"*.conf  "${BASE}/pending/"
install -m 700 "${SRC}/nginx/issue-cert.sh"   "${BASE}/issue-cert.sh"
# conf.d is replaced as a whole so removed files do not linger.
find "${BASE}/conf.d" -maxdepth 1 -name '*.conf' ! -name '30-tms-web-https.conf' -delete
install -m 644 "${SRC}/nginx/conf.d/"*.conf "${BASE}/conf.d/"
if [[ -s /srv/tms/letsencrypt/live/tms.moc.gov.kh/fullchain.pem ]]; then
  install -m 644 "${BASE}/pending/30-tms-web-https.conf" "${BASE}/conf.d/30-tms-web-https.conf"
  echo "certificate present: HTTPS enabled"
else
  rm -f "${BASE}/conf.d/30-tms-web-https.conf"
  echo "no certificate yet: HTTPS server block kept in pending/"
fi

log "validate config before (re)starting"
docker run --rm --network host \
  -v "${BASE}/nginx.conf:/etc/nginx/nginx.conf:ro" \
  -v "${BASE}/conf.d:/etc/nginx/conf.d:ro" \
  -v "${BASE}/snippets:/etc/nginx/snippets:ro" \
  -v /srv/tms/letsencrypt:/etc/letsencrypt:ro \
  nginx:1.30.5-alpine nginx -t

log "start / reload nginx"
if docker inspect tms-nginx >/dev/null 2>&1 && [[ "$(docker inspect -f '{{.State.Running}}' tms-nginx)" == "true" ]]; then
  docker compose -f "${BASE}/compose.yml" up -d   # recreates only if compose.yml changed
  docker exec tms-nginx nginx -s reload
else
  docker compose -f "${BASE}/compose.yml" up -d
fi

log "firewall: internal API listener 8090 only from the app servers"
for host in "${APP_HOSTS[@]}"; do
  ufw allow proto tcp from "${host}" to 172.20.15.55 port 8090 comment 'internal API listener' >/dev/null
done

log "firewall: 80/443 only from Cloudflare (the site is served through its proxy)"
# Same range list nginx trusts for CF-Connecting-IP (snippets/cloudflare-realip.conf),
# so direct-to-origin traffic that bypasses Cloudflare is dropped.
mapfile -t CF_RANGES < <(sed -n 's/^set_real_ip_from \(.*\);$/\1/p' "${BASE}/snippets/cloudflare-realip.conf")
(( ${#CF_RANGES[@]} >= 10 )) || { echo "Cloudflare range list looks wrong (${#CF_RANGES[@]} entries)" >&2; exit 1; }
# Drop any 80/443 rule that is not in the current Cloudflare list (incl. "Anywhere").
while read -r num; do ufw --force delete "$num" >/dev/null; done < <(
  ufw status numbered | grep -E ' (80,443|80|443)/tcp ' | grep -v 'cloudflare' \
    | sed -E 's/^\[ *([0-9]+)\].*/\1/' | sort -rn)
for range in "${CF_RANGES[@]}"; do
  ufw allow proto tcp from "${range}" to any port 80,443 comment 'cloudflare' >/dev/null
done
echo "80/443 allowed from ${#CF_RANGES[@]} Cloudflare ranges"

log "log rotation"
cat > /etc/logrotate.d/tms-nginx <<'EOF'
/srv/tms/nginx/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        docker kill -s USR1 tms-nginx >/dev/null 2>&1 || true
    endscript
}
EOF

log "certificate renewal timer"
install -m 644 "${SRC}/systemd/tms-cert-renew.service" /etc/systemd/system/
install -m 644 "${SRC}/systemd/tms-cert-renew.timer"   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now tms-cert-renew.timer >/dev/null

log "boot safety net"
bash "${SRC}/scripts/install-ensure-up.sh" "${SRC}" "compose:${BASE}/compose.yml"

log "phase 6 done on $(hostname)"
