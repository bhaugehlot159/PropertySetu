#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-propertysetu.in}"
WWW_DOMAIN="${WWW_DOMAIN:-www.${DOMAIN}}"
EMAIL="${EMAIL:-}"
APP_DIR="${APP_DIR:-/var/www/propertysetu}"
REPO_URL="${REPO_URL:-https://github.com/bhaugehlot159/PropertySetu.git}"
BRANCH="${BRANCH:-main}"
APP_PROFILE="$(echo "${APP_PROFILE:-legacy}" | tr '[:upper:]' '[:lower:]')"

JWT_SECRET="${JWT_SECRET:-}"
ADMIN_REGISTRATION_KEY="${ADMIN_REGISTRATION_KEY:-}"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/propertysetu_pro}"
CORS_ORIGIN="${CORS_ORIGIN:-https://${DOMAIN},https://${WWW_DOMAIN}}"

STORAGE_PROVIDER="${STORAGE_PROVIDER:-cloudinary}"
CLOUDINARY_CLOUD_NAME="${CLOUDINARY_CLOUD_NAME:-replace_with_cloud_name}"
CLOUDINARY_API_KEY="${CLOUDINARY_API_KEY:-replace_with_api_key}"
CLOUDINARY_API_SECRET="${CLOUDINARY_API_SECRET:-replace_with_api_secret}"
CLOUDINARY_UPLOAD_FOLDER="${CLOUDINARY_UPLOAD_FOLDER:-propertysetu/properties}"

AWS_REGION="${AWS_REGION:-ap-south-1}"
AWS_S3_BUCKET="${AWS_S3_BUCKET:-replace_with_s3_bucket}"

RAZORPAY_KEY_ID="${RAZORPAY_KEY_ID:-replace_with_razorpay_key_id}"
RAZORPAY_KEY_SECRET="${RAZORPAY_KEY_SECRET:-replace_with_razorpay_key_secret}"
ENABLE_UFW="${ENABLE_UFW:-1}"

if [[ "${APP_PROFILE}" == "professional" || "${APP_PROFILE}" == "pro" ]]; then
  APP_PROFILE="professional"
  APP_PORT="${APP_PORT:-5200}"
  APP_NAME="${APP_NAME:-propertysetu-pro-app}"
  HEALTH_PATH="${HEALTH_PATH:-/api/v3/health}"
elif [[ "${APP_PROFILE}" == "legacy" ]]; then
  APP_PROFILE="legacy"
  APP_PORT="${APP_PORT:-5000}"
  APP_NAME="${APP_NAME:-propertysetu-app}"
  HEALTH_PATH="${HEALTH_PATH:-/api/health}"
else
  echo "ERROR: APP_PROFILE must be legacy or professional."
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Missing command '$1'."
    exit 1
  fi
}

generate_secret() {
  local size="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "${size}"
    return 0
  fi
  echo "propertysetu-$(date +%s)-change-me"
}

write_legacy_env() {
  local env_file="${APP_DIR}/server/.env"
  if [[ -f "${env_file}" ]]; then
    echo "server/.env already exists. Keeping existing values."
    return 0
  fi

  cat > "${env_file}" <<EOF
PORT=${APP_PORT}
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
EOF
  chmod 600 "${env_file}"
  echo "Created server/.env (legacy profile)"
}

write_professional_env() {
  local env_file="${APP_DIR}/server/.env.pro"
  if [[ -f "${env_file}" ]]; then
    echo "server/.env.pro already exists. Keeping existing values."
    return 0
  fi

  cat > "${env_file}" <<EOF
PRO_PORT=${APP_PORT}
NODE_ENV=production
MONGO_URI=${MONGO_URI}
JWT_SECRET=${JWT_SECRET}
ADMIN_REGISTRATION_KEY=${ADMIN_REGISTRATION_KEY}
CORE_EXPOSE_OTP=false
STORAGE_PROVIDER=${STORAGE_PROVIDER}
CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}
CLOUDINARY_UPLOAD_FOLDER=${CLOUDINARY_UPLOAD_FOLDER}
AWS_REGION=${AWS_REGION}
AWS_S3_BUCKET=${AWS_S3_BUCKET}
RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}
CORS_ORIGIN=${CORS_ORIGIN}
EOF
  chmod 600 "${env_file}"
  echo "Created server/.env.pro (professional profile)"
}

echo "Provisioning PropertySetu production server..."
echo "DOMAIN=${DOMAIN}, WWW_DOMAIN=${WWW_DOMAIN}, APP_DIR=${APP_DIR}, BRANCH=${BRANCH}"
echo "PROFILE=${APP_PROFILE}, APP_NAME=${APP_NAME}, APP_PORT=${APP_PORT}, HEALTH_PATH=${HEALTH_PATH}"

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

if [[ -z "${JWT_SECRET}" ]]; then
  JWT_SECRET="$(generate_secret 32)"
fi

if [[ "${APP_PROFILE}" == "professional" && -z "${ADMIN_REGISTRATION_KEY}" ]]; then
  ADMIN_REGISTRATION_KEY="$(generate_secret 24)"
fi

if [[ "${APP_PROFILE}" == "professional" ]]; then
  write_professional_env
else
  write_legacy_env
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

APP_DIR="${APP_DIR}" APP_PROFILE="${APP_PROFILE}" APP_NAME="${APP_NAME}" APP_PORT="${APP_PORT}" pm2 startOrReload deploy/ecosystem.config.cjs --env production
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

if curl -fsS "http://127.0.0.1:${APP_PORT}${HEALTH_PATH}" >/dev/null; then
  echo "Health check passed at http://127.0.0.1:${APP_PORT}${HEALTH_PATH}"
else
  echo "ERROR: Health check failed."
  exit 1
fi

if [[ "${APP_PROFILE}" == "professional" ]]; then
  echo "INFO: Replace placeholder storage/payment credentials in server/.env.pro before full live traffic."
fi

echo "Provision complete."
echo "Next deploy command: cd ${APP_DIR} && APP_PROFILE=${APP_PROFILE} ./deploy/scripts/deploy.sh ${BRANCH}"
