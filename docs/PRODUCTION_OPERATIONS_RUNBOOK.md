# PropertySetu Production Operations Runbook

This runbook covers production safety operations:
- backup
- verify
- rollback
- automation schedule

## 1) Script permissions

```bash
cd /var/www/propertysetu
chmod +x deploy/scripts/*.sh
```

## 2) Create backup before each deploy

```bash
APP_DIR=/var/www/propertysetu \
BACKUP_ROOT=/var/backups/propertysetu \
KEEP_DAYS=14 \
./deploy/scripts/backup.sh
```

Optional Mongo dump:

```bash
ENABLE_MONGO_DUMP=1 ./deploy/scripts/backup.sh
```

## 3) Deploy latest code

```bash
cd /var/www/propertysetu
APP_PROFILE=legacy ./deploy/scripts/deploy.sh main
```

Professional deploy:

```bash
cd /var/www/propertysetu
APP_PROFILE=professional APP_PORT=5200 HEALTH_PATH=/api/v3/health ./deploy/scripts/deploy.sh main
```

## 4) Verify live

```bash
DOMAIN=propertysetu.in \
APP_PROFILE=legacy \
APP_PORT=5000 \
./deploy/scripts/verify-live.sh
```

Professional verify:

```bash
DOMAIN=propertysetu.in \
APP_PROFILE=professional \
APP_PORT=5200 \
HEALTH_PATH=/api/v3/health \
./deploy/scripts/verify-live.sh
```

## 5) Rollback if release fails

Find recent commits:

```bash
cd /var/www/propertysetu
git log --oneline -n 10
```

Rollback to specific commit:

```bash
DOMAIN=propertysetu.in \
APP_PROFILE=legacy \
APP_PORT=5000 \
./deploy/scripts/rollback.sh <commit_or_tag>
```

Professional rollback:

```bash
DOMAIN=propertysetu.in \
APP_PROFILE=professional \
APP_PORT=5200 \
HEALTH_PATH=/api/v3/health \
./deploy/scripts/rollback.sh <commit_or_tag>
```

## 6) Return to latest main after emergency rollback

```bash
cd /var/www/propertysetu
git checkout main
git pull --ff-only origin main
APP_PROFILE=legacy ./deploy/scripts/deploy.sh main
```

## 7) Recommended routine

- Daily: run `verify-live.sh`
- Before deploy: run `backup.sh`
- After deploy: run `verify-live.sh`
- Weekly: confirm SSL auto-renew dry-run

```bash
sudo certbot renew --dry-run
```

## 8) Enable scheduled automation

Use the dedicated schedule guide:

`docs/PRODUCTION_AUTOMATION_SCHEDULE.md`

Quick install command:

```bash
APP_DIR=/var/www/propertysetu DOMAIN=propertysetu.in APP_PROFILE=legacy APP_PORT=5000 ./deploy/scripts/install-ops-cron.sh
```

Professional schedule install:

```bash
APP_DIR=/var/www/propertysetu DOMAIN=propertysetu.in APP_PROFILE=professional APP_PORT=5200 HEALTH_PATH=/api/v3/health ./deploy/scripts/install-ops-cron.sh
```
