#!/usr/bin/env bash
# Rolling production deploy of TMS with Pongreay.
#
#   infra/deploy-production.sh api|web|all
#
# Order: preflight (both repos on a clean `main`, tests once) → database
# migrations ONCE (from the new API image, on tmsapp01) → API app01 → verify via
# LB → app02 → verify → app03 → verify → same for the web frontend.
# The rollout stops at the first failure; Pongreay has already rolled that one
# server back to its previous image, the others are untouched.
#
# Pongreay's own `--confirm` guard only applies to an environment named exactly
# `production`, so this script asks for an explicit typed confirmation instead.
#
# Env: WEB_REPO (default ../training-management-system relative to the API repo)
#      SKIP_LB_CHECK=1  skip the through-the-load-balancer checks (before phase 6)
set -euo pipefail

TARGET="${1:-}"
[[ "$TARGET" =~ ^(api|web|all)$ ]] || { echo "usage: $0 api|web|all" >&2; exit 2; }

API_REPO="$(cd "$(dirname "$0")/.." && pwd)"
WEB_REPO="${WEB_REPO:-$(cd "${API_REPO}/../training-management-system" && pwd)}"
SERVERS=(production-app01 production-app02 production-app03)
# production-app01 -> tmsapp01 (macOS ships bash 3.2: no associative arrays)
host_of() { echo "tms${1#production-}"; }
LB_API_HEALTH="http://172.20.15.55:8090/health"        # internal API listener (app servers only)
LB_WEB_HEALTH="https://tms.moc.gov.kh/api/health"
WEB_API_URL="http://172.20.15.55:8090"                  # baked into the web build (not a secret)
SKIP_LB_CHECK="${SKIP_LB_CHECK:-0}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

preflight_repo() {
  local repo="$1"
  ( cd "$repo"
    [[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]] || fail "$repo is not on main"
    [[ -z "$(git status --short)" ]] || fail "$repo has uncommitted changes"
    git fetch -q origin main && [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] \
      || fail "$repo main is not in sync with origin/main (push or pull first)"
    pongreay config validate >/dev/null || fail "$repo: pongreay config invalid"
    log "tests: $repo"; npm test --silent )
}

verify_via_lb() {
  local what="$1" host="$2"
  [[ "$SKIP_LB_CHECK" == "1" ]] && { echo "(LB check skipped)"; return 0; }
  for _ in $(seq 1 10); do
    if [[ "$what" == api ]]; then
      ssh "$host" "curl -fsS -o /dev/null $LB_API_HEALTH" && { echo "API healthy through the LB"; return 0; }
    else
      curl -fsS -o /dev/null "$LB_WEB_HEALTH" && { echo "web healthy through the LB"; return 0; }
    fi
    sleep 3
  done
  fail "$what not healthy through the load balancer after deploying to $host"
}

run_migrations() {
  local sha tag
  sha="$(git -C "$API_REPO" rev-parse --short HEAD)"
  tag="tms-api:migrate-${sha}"
  log "database migrations (once, from ${tag}, on tmsapp01)"
  ( cd "$API_REPO" && docker build -q -t "$tag" . >/dev/null )
  docker save "$tag" | gzip -1 | ssh tmsapp01 'gunzip | docker load -q'
  ssh tmsapp01 "docker run --rm --env-file /etc/pongreay/tms-api/production.env '$tag' npx prisma migrate deploy \
    && docker image rm '$tag' >/dev/null"
  docker image rm "$tag" >/dev/null
}

roll_out() {
  local what="$1" repo build_args=()
  if [[ "$what" == api ]]; then repo="$API_REPO"; else repo="$WEB_REPO"; build_args=(--build-arg "API_URL=${WEB_API_URL}"); fi
  for env in "${SERVERS[@]}"; do
    log "deploy ${what} → ${env} ($(host_of "$env"))"
    ( cd "$repo" && pongreay "$env" --skip-tests --timeout 90 ${build_args[@]+"${build_args[@]}"} ) \
      || fail "${what} deploy to ${env} failed (Pongreay rolled that server back); rollout stopped"
    verify_via_lb "$what" "$(host_of "$env")"
  done
}

log "TMS production deploy: ${TARGET}"
echo "API repo: ${API_REPO} @ $(git -C "$API_REPO" rev-parse --short HEAD)"
echo "Web repo: ${WEB_REPO} @ $(git -C "$WEB_REPO" rev-parse --short HEAD)"
read -r -p "Type 'deploy production' to continue: " answer
[[ "$answer" == "deploy production" ]] || fail "not confirmed"

[[ "$TARGET" == web ]] || preflight_repo "$API_REPO"
[[ "$TARGET" == api ]] || preflight_repo "$WEB_REPO"

if [[ "$TARGET" != web ]]; then
  run_migrations
  roll_out api
fi
[[ "$TARGET" == api ]] || roll_out web

log "production deploy of '${TARGET}' completed"
