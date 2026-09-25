#!/usr/bin/env bash
# Phase 1 — base hardening for a TMS server (Ubuntu 26.04).
# Usage (as root): phase1-base.sh <hostname> <role>
#   role: lb | app | db | redis
# Idempotent: safe to run more than once.
set -euo pipefail

NEW_HOSTNAME="${1:?hostname required}"
ROLE="${2:?role required (lb|app|db|redis)}"
export DEBIAN_FRONTEND=noninteractive

log() { printf '\n==> %s\n' "$*"; }

# ── Hostname + timezone + time sync ──────────────────────────────────────────
log "hostname ${NEW_HOSTNAME}, timezone Asia/Phnom_Penh"
hostnamectl set-hostname "${NEW_HOSTNAME}"
if grep -q '^127\.0\.1\.1' /etc/hosts; then
  sed -i "s/^127\.0\.1\.1.*/127.0.1.1 ${NEW_HOSTNAME}/" /etc/hosts
else
  echo "127.0.1.1 ${NEW_HOSTNAME}" >> /etc/hosts
fi
# Stop cloud-init from resetting the hostname on reboot.
mkdir -p /etc/cloud/cloud.cfg.d
echo 'preserve_hostname: true' > /etc/cloud/cloud.cfg.d/99-tms-preserve-hostname.cfg
timedatectl set-timezone Asia/Phnom_Penh
apt-get update -q
apt-get install -y -q chrony ufw fail2ban unattended-upgrades >/dev/null
systemctl enable --now chrony >/dev/null

# ── Security updates only, never reboot automatically ────────────────────────
log "unattended-upgrades (security only, no auto-reboot)"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat > /etc/apt/apt.conf.d/52tms-unattended-upgrades <<'EOF'
// TMS: security updates only (Ubuntu default origins), no automatic reboot.
Unattended-Upgrade::Automatic-Reboot "false";
EOF
log "installing pending security updates"
unattended-upgrade || { echo "unattended-upgrade reported an error"; exit 1; }

# ── SSH hardening (drop-in must sort before 50-cloud-init.conf: first value wins) ─
log "sshd hardening"
cat > /etc/ssh/sshd_config.d/10-tms-hardening.conf <<'EOF'
# TMS hardening. Loaded before 50-cloud-init.conf; sshd uses the first value it reads.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers panhara
MaxAuthTries 3
EOF
chmod 644 /etc/ssh/sshd_config.d/10-tms-hardening.conf
sshd -t
systemctl reload ssh

# ── Firewall ─────────────────────────────────────────────────────────────────
# SSH stays reachable from any source (key-only + fail2ban), per operator decision.
# DB/Redis port rules are added in their own phases; app ports use DOCKER-USER (phase 5).
log "ufw"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'ssh (key-only; brute force handled by fail2ban)' >/dev/null
if [[ "${ROLE}" == "lb" ]]; then
  ufw allow 80/tcp comment 'http' >/dev/null
  ufw allow 443/tcp comment 'https' >/dev/null
fi
ufw --force enable >/dev/null

# ── fail2ban for sshd ────────────────────────────────────────────────────────
log "fail2ban"
cat > /etc/fail2ban/jail.d/tms-sshd.local <<'EOF'
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
systemctl enable fail2ban >/dev/null
systemctl restart fail2ban

# ── Kernel / limits ──────────────────────────────────────────────────────────
log "sysctl + nofile limits"
cat > /etc/sysctl.d/99-tms.conf <<'EOF'
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 1024 65000
fs.file-max = 2097152
vm.swappiness = 10
EOF
sysctl --system >/dev/null
cat > /etc/security/limits.d/99-tms.conf <<'EOF'
*    soft nofile 65535
*    hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF
mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/99-tms-limits.conf <<'EOF'
[Manager]
DefaultLimitNOFILE=65535
EOF
systemctl daemon-reexec

# ── Transparent Huge Pages off on DB and Redis ───────────────────────────────
if [[ "${ROLE}" == "db" || "${ROLE}" == "redis" ]]; then
  log "disable THP"
  cat > /etc/systemd/system/disable-thp.service <<'EOF'
[Unit]
Description=Disable Transparent Huge Pages (TMS)
DefaultDependencies=no
After=sysinit.target local-fs.target
Before=basic.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled && echo never > /sys/kernel/mm/transparent_hugepage/defrag'

[Install]
WantedBy=basic.target
EOF
  systemctl daemon-reload
  systemctl enable --now disable-thp.service >/dev/null
fi

# ── Swap: keep existing swap; create 4G only if there is none ────────────────
if ! swapon --show --noheadings | grep -q .; then
  log "creating 4G swap"
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "phase 1 done on $(hostname)"
