#!/usr/bin/env bash
# Regenerate snippets/cloudflare-realip.conf from Cloudflare's published ranges.
# Run locally, review the diff, commit, then re-run infra/scripts/phase6-lb.sh.
set -euo pipefail
cd "$(dirname "$0")"
v4="$(curl -fsS https://www.cloudflare.com/ips-v4)"
v6="$(curl -fsS https://www.cloudflare.com/ips-v6)"
{
  echo "# Real visitor IP behind the Cloudflare proxy (orange-cloud DNS records)."
  echo "# Trust CF-Connecting-IP only when the connection comes from Cloudflare."
  echo "# Source: https://www.cloudflare.com/ips/ (fetched $(date +%Y-%m-%d)). Refresh with"
  echo "# infra/nginx/update-cloudflare-ips.sh when Cloudflare announces changes."
  printf '%s\n%s\n' "$v4" "$v6" | grep . | sed 's/^/set_real_ip_from /; s/$/;/'
  echo "real_ip_header CF-Connecting-IP;"
} > snippets/cloudflare-realip.conf
echo "updated snippets/cloudflare-realip.conf"
