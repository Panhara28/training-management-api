# TMS production runbook

Production for the TMS (Training Management System) at **https://tms.moc.gov.kh**.
Everything here is idempotent and safe to re-run. **No secret values are stored
in this repository** — this file only says where they live.

## Architecture

```
Browser ──HTTPS──▶ Cloudflare (proxy, orange cloud)
                      │  only Cloudflare IP ranges may reach 80/443 (UFW)
                      ▼
              tmslb 172.20.15.55  nginx 1.30.5 (Let's Encrypt cert, TLS 1.2/1.3)
                      │ public: tms.moc.gov.kh ─▶ upstream tms_web (least_conn)
                      │ internal: 172.20.15.55:8090 ─▶ upstream tms_api
          ┌───────────┼───────────┐
          ▼           ▼           ▼
   tmsapp01 .56  tmsapp02 .57  tmsapp03 .58     each: tms-web :3000 (Next.js)
          │           │           │                   tms-api :8090 (NestJS)
          │  web's /api/* and server-side calls ──▶ tmslb:8090 ──▶ any tms-api
          └───────────┼───────────┘
                      ▼
              tmsdb 172.20.15.59   MySQL 8.4.11 (1 TB disk, HDD)

tmsredis 172.20.15.60 — hardened and Docker-ready, not used yet (the app keeps
no server-side sessions: signed JWT cookies, any app server serves any request).
```

- The API is **not public**: browsers only talk to `tms.moc.gov.kh`; the web tier
  relays `/api/*` to the internal listener. Cookies are host-only on
  `tms.moc.gov.kh`, `Secure`, `HttpOnly`, `SameSite=Lax`.
- Real visitor IP: Cloudflare `CF-Connecting-IP` (trusted only from Cloudflare
  ranges) → nginx replaces `X-Forwarded-For` → web → internal listener
  (trusts app servers) → API (`TRUST_PROXY`). Rate limits and the login lockout
  are therefore per visitor.
- Rate limits (per IP): nginx web 30 r/s, API 20 r/s, login routes 10/min;
  API throttler 1000/min (`/health` exempt). Uploads up to 50 MB.

## Servers

| Host | IP | Role | Listens |
|---|---|---|---|
| tmslb | .55 | nginx load balancer | 22, 80/443 (Cloudflare only), 8090 (app servers only) |
| tmsapp01-03 | .56-.58 | tms-web, tms-api (Pongreay) | 22, 3000/8090 (tmslb only, `DOCKER-USER`) |
| tmsdb | .59 | MySQL 8.4 | 22, 3306 (app servers only) |
| tmsredis | .60 | spare / future Redis | 22 |

All: Ubuntu 26.04, Asia/Phnom_Penh, SSH keys only (`panhara`, no root, no
passwords), fail2ban, UFW default deny, security updates automatic (never an
automatic reboot), Docker 29.8.1 held (`apt-mark hold`).

## Where things live (paths only)

| What | Where |
|---|---|
| MySQL compose / config / data / logs | tmsdb `/srv/tms/mysql/{compose.yml,conf.d,data,logs}` |
| **MySQL passwords** (root, app, backup) | tmsdb `/srv/tms/mysql/secrets/*_password` (root dir 700, files 400) |
| MySQL backups (14 days) | tmsdb `/srv/tms/backups/tms-YYYYmmdd-HHMMSS.sql.gz` |
| **API env** (DATABASE_URL, JWT/SESSION secrets, AAS, storage) | tmsapp01-03 `/etc/pongreay/tms-api/production.env` (panhara, 600) |
| **Web env** (API_URL, JWT/SESSION secrets — no DB credentials) | tmsapp01-03 `/etc/pongreay/tms-web/production.env` (panhara, 600) |
| nginx config / logs | tmslb `/srv/tms/nginx/{nginx.conf,conf.d,snippets,logs}` |
| TLS certificate + key | tmslb `/srv/tms/letsencrypt/live/tms.moc.gov.kh/` (dir 700) |
| App-port firewall | tmsapp01-03 `/usr/local/sbin/tms-docker-user.sh` + `tms-docker-user.service` |
| Boot safety net | all but tmsredis: `tms-ensure-up@….service` |

Timers: `tms-mysql-backup.timer` (tmsdb, 02:00), `tms-cert-renew.timer`
(tmslb, twice daily), `unattended-upgrades` (all).

## Deploying

From a Mac with Docker running, both repos cloned side by side, on a clean
`main` that matches `origin/main`, connected to the VPN:

```bash
cd training-management-api
./infra/deploy-production.sh api   # or: web | all
# type: deploy production
```

Order: tests → **database migrations once** (from the new API image, on
tmsapp01) → API app01 → check through the LB → app02 → app03 → web the same way.
It stops at the first failure; Pongreay rolls that one server back itself.
A rolling deploy of all six containers was measured with **zero** failed
requests (588/588 while probing).

Rules:
- Migrations must be backward compatible with the previous release (old and new
  API run side by side during a rollout): add columns/tables first, drop later.
- Pongreay's own `--confirm` guard only applies to an environment literally
  named `production`; our envs are `production-app01..03`, so the typed
  confirmation lives in `deploy-production.sh`. Don't call `pongreay
  production-app0X` directly unless you mean it.
- The web image bakes `API_URL=http://172.20.15.55:8090` at build time
  (the script passes it). UAT builds still default to the UAT API.

## Rollback

```bash
cd training-management-api        # or training-management-system for the web
pongreay rollback production-app01 # repeat for app02, app03
```
This restarts the previous image recorded on that server. It does **not** undo
database migrations (restore a backup if a migration itself must be undone).

## Operations

```bash
pongreay status production-app01          # container + health
pongreay logs production-app02            # tail logs
ssh tmslb 'tail -f /srv/tms/nginx/logs/access.log'
curl https://tms.moc.gov.kh/api/health    # web tier through Cloudflare
ssh tmsapp01 curl -s http://172.20.15.55:8090/health   # API tier + DB via LB
```

First production data (already done once): `node dist/prisma/bootstrap.js`
inside a tms-api container with `BOOTSTRAP_ADMIN_EMAIL=<name>@moc.gov.kh` creates
permission modules, roles and an **AAS-only** administrator. Never run the demo
seed (`prisma db seed`) on production — it creates `password123` accounts.

## Backups and restore

Nightly `mysqldump --single-transaction` (no app locking) by a read-only
`tms_backup` user; the script refuses to keep an incomplete dump. Restore test:
full restore of all 24 tables into a scratch database verified on 2026-09-26.

Restore into a scratch database to inspect (safe):
```bash
ssh tmsdb
F=$(ls -1t /srv/tms/backups/tms-*.sql.gz | head -1)
sudo docker exec -i tms-mysql sh -c 'MYSQL_PWD=$(cat /run/secrets/mysql_root_password) mysql -uroot -e "CREATE DATABASE tms_restore"'
sudo zcat "$F" | sed -e 's/`tms`/`tms_restore`/' | sudo docker exec -i tms-mysql sh -c 'MYSQL_PWD=$(cat /run/secrets/mysql_root_password) mysql -uroot'
```
Restoring **over** production is a destructive, planned operation: take a fresh
backup first, stop the three `tms-api` containers, restore into `tms`, start them.

**Backups are on tmsdb only** (decision at setup). Losing that disk loses the
database and its backups together — adding an off-server copy (NAS, second
server, S3-compatible) is one line at the end of `/srv/tms/mysql/backup.sh`.

## Rotating secrets

- **MySQL app password**: generate (`openssl rand -hex 24`) into
  `/srv/tms/mysql/secrets/app_password`, `ALTER USER 'tms_app'@'<each app IP>'`
  as root, update `DATABASE_URL` in the three API env files, then roll the API
  (`deploy-production.sh api`, or restart containers one at a time).
- **JWT_SECRET / SESSION_SECRET**: must be identical in all six env files (API +
  web on 3 servers). Changing them signs everyone out. Update all six, then roll
  API and web.
- **AAS client secret / storage keys**: API env files only; roll the API.
- **The `panhara` sudo password was shared in chat during setup — change it**
  (`passwd` on each server).

## TLS and Cloudflare

- Let's Encrypt (HTTP-01 through Cloudflare), renewed by `tms-cert-renew.timer`
  (twice daily; certbot only renews when due) and nginx reloaded after `nginx -t`.
- Cloudflare SSL/TLS mode should be **Full (strict)** (origin cert is valid).
- Cloudflare IP ranges are used twice (real-IP trust + UFW 80/443). If
  Cloudflare changes them: `infra/nginx/update-cloudflare-ips.sh`, review, commit,
  re-run `infra/scripts/phase6-lb.sh` on tmslb. (Rules for ranges Cloudflare
  *removes* must be deleted by hand: `ufw status numbered`.)
- The `tms-api.moc.gov.kh` DNS record is not used (API is internal); delete it.

## Rebuilding a server

Scripts in `infra/scripts/`, run in order as root with `infra/` copied to the
server: `phase1-base.sh <hostname> <role>`, `phase2-docker.sh <exact docker version>`,
then per role `phase3-mysql.sh` (tmsdb), `phase5-app.sh` (app servers; needs the
secrets file described in the script), `phase6-lb.sh` (tmslb), then
`nginx/issue-cert.sh` on tmslb. Each ends by installing the boot safety net.

## Known limits and deviations (decided during setup)

- **Single points of failure**: one load balancer, one database. A tmslb reboot
  was measured at ~9 s of downtime, a tmsdb reboot at ~1 min for database-backed
  pages. App servers can be lost one at a time with no user-facing errors (tested
  by stopping a container and by black-holing a host). Later: keepalived VRRP
  pair for the LB; MySQL replica + backups off-server.
- **Boot race (fixed)**: after a reboot Docker sometimes logs "layer not mounted"
  and leaves a container exited despite its restart policy (seen once on tmslb:
  site down until started by hand). `tms-ensure-up@` starts them after boot;
  verified with a second reboot.
- Ubuntu **26.04** (spec said 24.04); **MySQL 8.4** instead of PostgreSQL (the app
  is built for MySQL); **Redis not used** yet; SSH allowed from any source
  (key-only + fail2ban) rather than an admin-IP allow-list; backups local only.
- The `docker` group (which `panhara` is in, for Pongreay) is **root-equivalent**.
- Capacity (2026-09-29): ~1,200 req/s combined against cheap endpoints at p99
  7 ms with the app servers nearly idle; through Cloudflare from one client
  20 r/s at p95 140 ms, 0 errors. Batch certificate PDFs are the CPU-heavy path.
