#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-propertysetu.in}"
WWW_DOMAIN="${WWW_DOMAIN:-www.${DOMAIN}}"
EMAIL="${EMAIL:-}"
APP_DIR="${APP_DIR:-/var/www/propertysetu}"
REPO_URL="${REPO_URL:-https://github.com/bhaugehlot159/PropertySetu.git}"
BRANCH="${BRANCH:-main}"
APP_PORT="${APP_PORT:-5000}"
JWT_SECRET="${JWT_SECRET:-}"
ENABLE_UFW="${ENABLE_UFW:-1}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Missing command '$1'."
    exit 1
  fi
}

echo "Provisioning PropertySetu production server..."
echo "DOMAIN=${DOMAIN}, WWW_DOMAIN=${WWW_DOMAIN}, APP_DIR=${APP_DIR}, BRANCH=${BRANCH}, APP_PORT=${APP_PORT}"

require_cmd sudo
require_cmd git
require_cmd curl

sudo apt update
sudo apt install -y git curl nginx certbot python3-certbot-nginx ufw

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d'.' -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

sudo npm install -g pm2

sudo mkdir -p "$(dirname "${APP_DIR}")"
sudo chown -R "$USER:$USER" "$(dirname "${APP_DIR}")"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

cd server
npm ci --omit=dev
cd ..

if [[ ! -f "${APP_DIR}/server/.env" ]]; then
  if [[ -z "${JWT_SECRET}" ]]; then
    if command -v openssl >/dev/null 2>&1; then
      JWT_SECRET="$(openssl rand -hex 32)"
    else
      JWT_SECRET="propertysetu-$(date +%s)-change-me"
    fi
  fi

  cat > "${APP_DIR}/server/.env" <<EOF
PORT=${APP_PORT}
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
EOF
  chmod 600 "${APP_DIR}/server/.env"
  echo "Created server/.env"
else
  echo "server/.env already exists. Keeping existing values."
fi

sudo tee /etc/nginx/sites-available/propertysetu.conf >/dev/null <<EOF
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

upstream propertysetu_upstream {
  server 127.0.0.1:${APP_PORT};
  keepalive 32;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN} ${WWW_DOMAIN};

  client_max_body_size 25m;

  location / {
    proxy_pass http://propertysetu_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
  }
}
EOF

sudo ln -sfn /etc/nginx/sites-available/propertysetu.conf /etc/nginx/sites-enabled/propertysetu.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

APP_DIR="${APP_DIR}" APP_PORT="${APP_PORT}" pm2 startOrReload deploy/ecosystem.config.cjs --env production
pm2 save
STARTUP_CMD="$(pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null | grep -Eo 'sudo .+pm2 startup.+' | head -n1 || true)"
if [[ -n "${STARTUP_CMD}" ]]; then
  eval "${STARTUP_CMD}" || true
fi
pm2 save

if [[ "${ENABLE_UFW}" == "1" ]]; then
  sudo ufw allow OpenSSH || true
  sudo ufw allow 'Nginx Full' || true
fi

if [[ -n "${EMAIL}" ]]; then
  sudo certbot --nginx --agree-tos --redirect --non-interactive -m "${EMAIL}" -d "${DOMAIN}" -d "${WWW_DOMAIN}"
else
  echo "Skipping SSL issue: set EMAIL env and run again for non-interactive certbot."
fi

if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null; then
  echo "Health check passed at http://127.0.0.1:${APP_PORT}/api/health"
else
  echo "ERROR: Health check failed."
  exit 1
fi

echo "Provision complete."
echo "Next deploy command: cd ${APP_DIR} && ./deploy/scripts/deploy.sh ${BRANCH}"
