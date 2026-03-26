# PropertySetu Direct Production Deploy Checklist

This checklist is for direct live deployment with:
- Domain DNS
- PM2 process manager
- Nginx reverse proxy
- SSL (Let's Encrypt)

Quick one-command setup guide: `docs/PRODUCTION_ONE_SHOT_DEPLOY.md`

Use this on an Ubuntu server (22.04/24.04 recommended).

## 0) Pre-check

- Domain should be ready: `propertysetu.in` and `www.propertysetu.in`
- Server public IP available
- SSH access available (`sudo` user)
- App will run from: `/var/www/propertysetu`
- Choose profile:
  - `legacy`: port `5000`, health `/api/health`
  - `professional` (Option 1): port `5200`, health `/api/v3/health`

## 1) Domain DNS mapping

In your domain DNS panel, add:

- `A` record: host `@` -> `<SERVER_PUBLIC_IP>`
- `A` record: host `www` -> `<SERVER_PUBLIC_IP>`

Verify from local terminal:

```bash
nslookup propertysetu.in
nslookup www.propertysetu.in
```

Both must resolve to your server IP.

## 2) Server bootstrap

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 3) App clone/update on server

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/bhaugehlot159/PropertySetu.git propertysetu
cd propertysetu
git checkout main
```

If already cloned:

```bash
cd /var/www/propertysetu
git fetch origin
git pull --ff-only origin main
```

## 4) Environment setup

Legacy profile (`APP_PROFILE=legacy`): create `server/.env`:

```env
PORT=5000
NODE_ENV=production
JWT_SECRET=replace_with_long_random_secret
MONGODB_URI=replace_with_mongodb_uri_if_used
RAZORPAY_KEY_ID=replace_if_enabled
RAZORPAY_KEY_SECRET=replace_if_enabled
```

Professional profile (`APP_PROFILE=professional`): create `server/.env.pro`:

```env
PRO_PORT=5200
NODE_ENV=production
MONGO_URI=replace_with_mongodb_uri
JWT_SECRET=replace_with_long_random_secret
ADMIN_REGISTRATION_KEY=replace_with_admin_registration_key
CORE_EXPOSE_OTP=false
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=replace_with_cloud_name
CLOUDINARY_API_KEY=replace_with_api_key
CLOUDINARY_API_SECRET=replace_with_api_secret
RAZORPAY_KEY_ID=replace_if_enabled
RAZORPAY_KEY_SECRET=replace_if_enabled
CORS_ORIGIN=https://propertysetu.in,https://www.propertysetu.in
```

Install backend dependencies:

```bash
cd /var/www/propertysetu/server
npm ci --omit=dev
```

## 5) PM2 process manager setup

Install PM2 globally:

```bash
sudo npm install -g pm2
```

Start app with repo config:

```bash
cd /var/www/propertysetu
APP_PROFILE=legacy APP_PORT=5000 APP_NAME=propertysetu-app pm2 start deploy/ecosystem.config.cjs --env production
pm2 save
```

Professional start:

```bash
cd /var/www/propertysetu
APP_PROFILE=professional APP_PORT=5200 APP_NAME=propertysetu-pro-app pm2 start deploy/ecosystem.config.cjs --env production
pm2 save
```

Enable PM2 auto-start on reboot:

```bash
pm2 startup
```

Run the command shown by PM2 output, then run:

```bash
pm2 save
pm2 status
```

## 6) Nginx reverse proxy setup

Copy repo config into Nginx sites:

```bash
sudo cp /var/www/propertysetu/deploy/nginx/propertysetu.conf /etc/nginx/sites-available/propertysetu.conf
sudo ln -s /etc/nginx/sites-available/propertysetu.conf /etc/nginx/sites-enabled/propertysetu.conf
sudo nginx -t
sudo systemctl reload nginx
```

If default site conflicts, disable default:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 7) SSL (Let's Encrypt)

Issue SSL certificate:

```bash
sudo certbot --nginx -d propertysetu.in -d www.propertysetu.in
```

Test auto-renew:

```bash
sudo certbot renew --dry-run
```

## 8) Firewall hardening

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 9) Post-deploy validation

```bash
curl -I http://propertysetu.in
curl -I https://propertysetu.in
curl https://propertysetu.in/api/health
pm2 logs propertysetu-app --lines 100
```

Expected:
- HTTPS works without browser warning
- `/api/health` returns `{ "ok": true, ... }`
- PM2 app status is `online`

Professional profile expected:
- HTTPS works without browser warning
- `/api/v3/health` returns `{ "ok": true, ... }`
- PM2 app `propertysetu-pro-app` status is `online`

## 10) Next deploy command (repeat releases)

Use the included deploy script:

```bash
cd /var/www/propertysetu
chmod +x deploy/scripts/deploy.sh
APP_PROFILE=legacy ./deploy/scripts/deploy.sh main
```

Professional repeat deploy:

```bash
cd /var/www/propertysetu
APP_PROFILE=professional APP_PORT=5200 HEALTH_PATH=/api/v3/health ./deploy/scripts/deploy.sh main
```

## 11) Rollback quick plan

If new release fails:

```bash
cd /var/www/propertysetu
git log --oneline -n 5
git checkout <previous_commit_hash>
cd server && npm ci --omit=dev && cd ..
APP_PROFILE=legacy pm2 restart propertysetu-app
sudo systemctl reload nginx
```

Professional quick rollback restart:

```bash
cd /var/www/propertysetu
APP_PROFILE=professional pm2 restart propertysetu-pro-app
sudo systemctl reload nginx
```

Detailed operations runbook (backup + rollback script flow):
`docs/PRODUCTION_OPERATIONS_RUNBOOK.md`

Automation schedule guide (cron health-check + daily backup):
`docs/PRODUCTION_AUTOMATION_SCHEDULE.md`

---

If your live domain is different, replace `propertysetu.in` and `www.propertysetu.in` everywhere in this checklist and in `deploy/nginx/propertysetu.conf`.
