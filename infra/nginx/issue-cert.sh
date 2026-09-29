#!/usr/bin/env bash
# Obtain the Let's Encrypt certificate for tms.moc.gov.kh (HTTP-01 webroot) and
# switch on HTTPS. Installed to /srv/tms/nginx/issue-cert.sh on tmslb.
# Prerequisite: tms.moc.gov.kh resolves publicly to the LB and port 80 on it is
# reachable from the internet. Run as root. Safe to re-run.
set -euo pipefail

DOMAIN=tms.moc.gov.kh
CERTBOT_IMAGE=certbot/certbot:v5.8.0
BASE=/srv/tms/nginx

if [[ ! -s "/srv/tms/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  docker run --rm \
    -v /srv/tms/letsencrypt:/etc/letsencrypt \
    -v "${BASE}/acme:/var/www/acme" \
    "${CERTBOT_IMAGE}" certonly --webroot -w /var/www/acme -d "${DOMAIN}" \
      --agree-tos --register-unsafely-without-email --non-interactive \
      --key-type ecdsa
fi

install -m 644 "${BASE}/pending/30-tms-web-https.conf" "${BASE}/conf.d/30-tms-web-https.conf"
docker exec tms-nginx nginx -t
docker exec tms-nginx nginx -s reload
echo "HTTPS enabled for ${DOMAIN}"
