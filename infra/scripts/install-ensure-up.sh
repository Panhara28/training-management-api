#!/usr/bin/env bash
# Install + enable the boot-time "containers are running" safety net.
# Usage (as root): install-ensure-up.sh <path-to-infra-dir> <target>
#   target: compose:/srv/tms/<stack>/compose.yml  |  containers:tms-api,tms-web
set -euo pipefail
SRC="${1:?infra dir}"; TARGET="${2:?target}"
install -m 755 "${SRC}/systemd/tms-ensure-up.sh" /usr/local/sbin/tms-ensure-up.sh
install -m 644 "${SRC}/systemd/tms-ensure-up@.service" /etc/systemd/system/tms-ensure-up@.service
UNIT="$(systemd-escape --template=tms-ensure-up@.service "${TARGET}")"
systemctl daemon-reload
systemctl enable "${UNIT}" >/dev/null
systemctl restart "${UNIT}"
echo "enabled ${UNIT}: $(systemctl is-active "${UNIT}")"
