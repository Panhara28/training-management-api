#!/usr/bin/env bash
# Restrict Docker-published app ports on an app server to the load balancer.
# Installed to /usr/local/sbin/tms-docker-user.sh; applied by
# tms-docker-user.service at boot and whenever Docker (re)starts.
#
# Why: ports published with `docker run -p` are DNAT-ed before UFW's INPUT
# rules, so UFW cannot protect them. Docker evaluates the DOCKER-USER chain
# first for all forwarded traffic and never touches its contents.
#
# Rules match only packets ARRIVING on the external interface, by their
# original (pre-DNAT) destination port, so container replies, containers' own
# outbound connections and local health checks on 127.0.0.1 are unaffected.
# Idempotent: our rules carry a comment tag and are replaced on every run.
set -euo pipefail

LB_IP="172.20.15.55"
APP_PORTS=(3000 8090)   # tms-web, tms-api host ports
TAG="tms-docker-user"

EXT_IF="$(ip -o -4 route get "${LB_IP}" | sed -E 's/.* dev ([^ ]+).*/\1/')"
[[ -n "${EXT_IF}" ]] || { echo "cannot determine external interface" >&2; exit 1; }

# DOCKER-USER exists once dockerd has started.
for _ in $(seq 1 30); do
  iptables -nL DOCKER-USER >/dev/null 2>&1 && break
  sleep 1
done
iptables -nL DOCKER-USER >/dev/null 2>&1 || { echo "DOCKER-USER chain not found" >&2; exit 1; }

# Remove our previous rules.
while read -r rule; do
  read -ra parts <<< "${rule/#-A /-D }"
  iptables "${parts[@]}"
done < <(iptables -S DOCKER-USER | grep -- "${TAG}" | sed -E 's/"//g' || true)

for port in "${APP_PORTS[@]}"; do
  iptables -I DOCKER-USER 1 -i "${EXT_IF}" -p tcp -m conntrack --ctorigdstport "${port}" \
    ! -s "${LB_IP}" -j DROP -m comment --comment "${TAG}-${port}"
done

echo "DOCKER-USER: ports ${APP_PORTS[*]} on ${EXT_IF} reachable only from ${LB_IP}"
iptables -S DOCKER-USER | grep -- "${TAG}"
