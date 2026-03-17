# PropertySetu Production Operations Runbook

This runbook covers production safety operations:
- backup
- verify
- rollback

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
./deploy/scripts/deploy.sh main
```

## 4) Verify live

```bash
DOMAIN=propertysetu.in \
APP_PORT=5000 \
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
APP_PORT=5000 \
./deploy/scripts/rollback.sh <commit_or_tag>
```

## 6) Return to latest main after emergency rollback

```bash
cd /var/www/propertysetu
git checkout main
git pull --ff-only origin main
./deploy/scripts/deploy.sh main
```

## 7) Recommended routine

- Daily: run `verify-live.sh`
- Before deploy: run `backup.sh`
- After deploy: run `verify-live.sh`
- Weekly: confirm SSL auto-renew dry-run

```bash
sudo certbot renew --dry-run
```
