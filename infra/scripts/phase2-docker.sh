#!/usr/bin/env bash
# Phase 2 — Docker Engine + Compose plugin from Docker's official apt repo.
# Usage (as root): phase2-docker.sh [docker-ce-version]
#   Without a version it installs the newest one available and prints it, so the
#   same exact version can then be pinned on every other server.
# Idempotent: safe to run more than once.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
DOCKER_VERSION="${1:-}"
DOCKER_PKGS=(docker-ce docker-ce-cli)
EXTRA_PKGS=(containerd.io docker-buildx-plugin docker-compose-plugin)

log() { printf '\n==> %s\n' "$*"; }

log "remove distro container packages if present"
for p in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  if dpkg -s "$p" >/dev/null 2>&1; then apt-get remove -y -q "$p"; fi
done

log "docker apt repository"
apt-get update -q
apt-get install -y -q ca-certificates curl >/dev/null
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${VERSION_CODENAME}
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update -q

if [[ -z "$DOCKER_VERSION" ]]; then
  DOCKER_VERSION="$(apt-cache madison docker-ce | awk 'NR==1{print $3}')"
  echo "newest docker-ce available: ${DOCKER_VERSION}"
fi

log "install docker-ce ${DOCKER_VERSION} (pinned + held)"
apt-mark unhold "${DOCKER_PKGS[@]}" "${EXTRA_PKGS[@]}" >/dev/null 2>&1 || true
apt-get install -y -q --allow-downgrades \
  "docker-ce=${DOCKER_VERSION}" "docker-ce-cli=${DOCKER_VERSION}" "${EXTRA_PKGS[@]}" >/dev/null
# Held so a routine `apt upgrade` never changes the container runtime under
# running services; upgrade deliberately (see infra/README.md).
apt-mark hold "${DOCKER_PKGS[@]}" "${EXTRA_PKGS[@]}" >/dev/null

log "daemon.json"
install -m 0755 -d /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "live-restore": true,
  "userland-proxy": false
}
EOF

log "enable docker on boot"
systemctl enable containerd docker >/dev/null
systemctl restart docker

# The docker group is root-equivalent (documented in infra/README.md); Pongreay needs it.
log "add panhara to docker group"
usermod -aG docker panhara

log "smoke test"
docker run --rm hello-world >/dev/null && echo "hello-world ran OK"
docker image rm hello-world >/dev/null
echo "docker $(docker version --format '{{.Server.Version}}') | compose $(docker compose version --short)"

log "phase 2 done on $(hostname)"
