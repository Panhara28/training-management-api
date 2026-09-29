#!/usr/bin/env bash
# Boot-time safety net: make sure this server's TMS containers are running.
# Installed to /usr/local/sbin/tms-ensure-up.sh, run by tms-ensure-up.service
# after Docker and the network are up.
#
# Why: Docker's restart policies normally bring containers back after a reboot,
# but the phase 7 reboot test showed a race (dockerd logs "error unmounting
# container ... layer not mounted" while restoring, with live-restore on) in
# which a container was left exited (255) and never restarted — the load
# balancer stayed down until started by hand. This retries until they run.
#
# Usage: tms-ensure-up.sh compose:<compose-file> | containers:<name>[,<name>...]
set -uo pipefail

TARGET="${1:?usage: tms-ensure-up.sh compose:<file> | containers:<a,b>}"
DEADLINE=$((SECONDS + 120))

running() { [[ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" == "true" ]]; }

while (( SECONDS < DEADLINE )); do
  ok=1
  case "$TARGET" in
    compose:*)
      file="${TARGET#compose:}"
      docker compose -f "$file" up -d >/dev/null 2>&1 || ok=0
      for c in $(docker compose -f "$file" ps -a --format '{{.Name}}' 2>/dev/null); do running "$c" || ok=0; done
      ;;
    containers:*)
      IFS=',' read -ra names <<< "${TARGET#containers:}"
      for c in "${names[@]}"; do
        # Only containers that exist (Pongreay creates them on first deploy).
        docker inspect "$c" >/dev/null 2>&1 || continue
        running "$c" || { docker start "$c" >/dev/null 2>&1; running "$c" || ok=0; }
      done
      ;;
    *) echo "unknown target: $TARGET" >&2; exit 2 ;;
  esac
  if (( ok )); then echo "all TMS containers running (${TARGET})"; exit 0; fi
  sleep 5
done
echo "TMS containers still not running after 120s (${TARGET})" >&2
exit 1
