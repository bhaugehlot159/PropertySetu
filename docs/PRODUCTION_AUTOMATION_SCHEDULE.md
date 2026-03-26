# PropertySetu Production Automation Schedule

This guide adds automatic ops jobs for:
- health self-heal checks
- daily backup
- optional certbot renew schedule

## 1) Enable scripts

```bash
cd /var/www/propertysetu
chmod +x deploy/scripts/*.sh
```

## 2) Install cron jobs

```bash
APP_DIR=/var/www/propertysetu \
DOMAIN=propertysetu.in \
APP_PROFILE=legacy \
APP_PORT=5000 \
APP_NAME=propertysetu-app \
HEALTH_EVERY_MIN=10 \
BACKUP_HOUR=2 \
BACKUP_MIN=30 \
BACKUP_ROOT=/var/backups/propertysetu \
KEEP_DAYS=14 \
./deploy/scripts/install-ops-cron.sh
```

Professional mode cron install:

```bash
APP_DIR=/var/www/propertysetu \
DOMAIN=propertysetu.in \
APP_PROFILE=professional \
APP_PORT=5200 \
APP_NAME=propertysetu-pro-app \
HEALTH_PATH=/api/v3/health \
HEALTH_EVERY_MIN=10 \
BACKUP_HOUR=2 \
BACKUP_MIN=30 \
BACKUP_ROOT=/var/backups/propertysetu \
KEEP_DAYS=14 \
./deploy/scripts/install-ops-cron.sh
```

## 3) Optional: include certbot renew in same cron block

```bash
ENABLE_CERTBOT_CRON=1 CERTBOT_DOW=1 CERTBOT_HOUR=4 CERTBOT_MIN=17 ./deploy/scripts/install-ops-cron.sh
```

Note: this adds only `certbot renew --quiet` job. Reload handling remains managed by certbot/Nginx integration.

## 4) Remove automation cron block

```bash
./deploy/scripts/uninstall-ops-cron.sh
```

## 5) Log files

- `logs/ops/health-watch.log`
- `logs/ops/cron-health.log`
- `logs/ops/cron-backup.log`
- `logs/ops/cron-certbot.log` (only if enabled)

## 6) Manual smoke checks

```bash
DOMAIN=propertysetu.in APP_PROFILE=legacy APP_PORT=5000 ./deploy/scripts/verify-live.sh
./deploy/scripts/backup.sh
```

Professional smoke:

```bash
DOMAIN=propertysetu.in APP_PROFILE=professional APP_PORT=5200 HEALTH_PATH=/api/v3/health ./deploy/scripts/verify-live.sh
./deploy/scripts/backup.sh
```
