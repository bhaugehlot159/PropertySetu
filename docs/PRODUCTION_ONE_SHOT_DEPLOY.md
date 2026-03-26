# PropertySetu One-Shot Production Deploy

This is the fastest server setup path for:
- Domain
- PM2
- Nginx reverse proxy
- SSL

## Profile modes

- `legacy` profile (default): `server/server.js`, port `5000`, health `/api/health`
- `professional` profile (Option 1): `server/professional-server.js`, port `5200`, health `/api/v3/health`

## 1) Login to VPS

```bash
ssh <server-user>@<server-ip>
```

## 2) Clone repo (first time only)

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/bhaugehlot159/PropertySetu.git propertysetu
cd propertysetu
```

## 3) Make scripts executable

```bash
chmod +x deploy/scripts/*.sh
```

## 4) Run preflight (recommended)

```bash
DOMAIN=propertysetu.in \
WWW_DOMAIN=www.propertysetu.in \
APP_DIR=/var/www/propertysetu \
BRANCH=main \
APP_PROFILE=legacy \
APP_PORT=5000 \
./deploy/scripts/preflight.sh
```

Professional preflight:

```bash
DOMAIN=propertysetu.in \
WWW_DOMAIN=www.propertysetu.in \
APP_DIR=/var/www/propertysetu \
BRANCH=main \
APP_PROFILE=professional \
APP_PORT=5200 \
HEALTH_PATH=/api/v3/health \
./deploy/scripts/preflight.sh
```

## 5) Run one-shot provision command

```bash
DOMAIN=propertysetu.in \
WWW_DOMAIN=www.propertysetu.in \
EMAIL=you@example.com \
APP_DIR=/var/www/propertysetu \
BRANCH=main \
APP_PROFILE=legacy \
APP_PORT=5000 \
./deploy/scripts/provision-ubuntu.sh
```

Professional one-shot provision:

```bash
DOMAIN=propertysetu.in \
WWW_DOMAIN=www.propertysetu.in \
EMAIL=you@example.com \
APP_DIR=/var/www/propertysetu \
BRANCH=main \
APP_PROFILE=professional \
APP_PORT=5200 \
HEALTH_PATH=/api/v3/health \
./deploy/scripts/provision-ubuntu.sh
```

What this command does:
- installs system dependencies
- ensures Node.js 20+
- installs PM2
- pulls latest code
- installs server packages
- creates `server/.env` (legacy) or `server/.env.pro` (professional) if missing
- writes Nginx site config
- starts app with PM2
- provisions SSL with certbot (if `EMAIL` provided)

## 6) Verify

```bash
pm2 status
curl -fsS http://127.0.0.1:5000/api/health
curl -I https://propertysetu.in
DOMAIN=propertysetu.in APP_PROFILE=legacy APP_PORT=5000 ./deploy/scripts/verify-live.sh
```

Professional verify:

```bash
pm2 status
curl -fsS http://127.0.0.1:5200/api/v3/health
curl -I https://propertysetu.in
DOMAIN=propertysetu.in APP_PROFILE=professional APP_PORT=5200 HEALTH_PATH=/api/v3/health ./deploy/scripts/verify-live.sh
```

## 7) Future deploys (code updates only)

```bash
cd /var/www/propertysetu
APP_PROFILE=legacy ./deploy/scripts/deploy.sh main
```

Professional future deploy:

```bash
cd /var/www/propertysetu
APP_PROFILE=professional APP_PORT=5200 HEALTH_PATH=/api/v3/health ./deploy/scripts/deploy.sh main
```

## 8) Optional env variables

- `REPO_URL` default: `https://github.com/bhaugehlot159/PropertySetu.git`
- `ENABLE_UFW` default: `1`
- `APP_PROFILE` default: `legacy` (`professional` for Option 1 live backend)
- `JWT_SECRET` (if omitted, script auto-generates only on first `.env` creation)
- `ADMIN_REGISTRATION_KEY` (professional mode only, auto-generated if omitted)
- `HEALTH_PATH` default depends on profile
- `CHECK_HTTPS` default: `1` (set `0` to skip HTTPS check when certificate is not issued yet)

## 9) If SSL was skipped

If you ran without `EMAIL`, run later:

```bash
sudo certbot --nginx -d propertysetu.in -d www.propertysetu.in
sudo certbot renew --dry-run
```

## 10) Ops runbook

For backup/rollback operations use:

`docs/PRODUCTION_OPERATIONS_RUNBOOK.md`

For cron-based auto monitoring + backup schedule:

`docs/PRODUCTION_AUTOMATION_SCHEDULE.md`
