#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/propertysetu"
BRANCH="${1:-main}"
APP_PROFILE="$(echo "${APP_PROFILE:-legacy}" | tr '[:upper:]' '[:lower:]')"
DOMAIN="${DOMAIN:-propertysetu.in}"
CHECK_HTTPS="${CHECK_HTTPS:-1}"

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

echo "Deploying ${APP_NAME} from branch ${BRANCH}..."
echo "Profile=${APP_PROFILE}, Port=${APP_PORT}, Health=${HEALTH_PATH}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "ERROR: ${APP_DIR} is not a git repository."
  exit 1
fi

cd "${APP_DIR}"
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

cd server
npm ci --omit=dev
cd ..

APP_DIR="${APP_DIR}" APP_PROFILE="${APP_PROFILE}" APP_PORT="${APP_PORT}" APP_NAME="${APP_NAME}" pm2 startOrReload deploy/ecosystem.config.cjs --env production
pm2 save

sudo systemctl reload nginx

if curl -fsS "http://127.0.0.1:${APP_PORT}${HEALTH_PATH}" >/dev/null; then
  echo "Health check passed: ${HEALTH_PATH}"
else
  echo "ERROR: Health check failed."
  exit 1
fi

if [[ -x "./deploy/scripts/verify-live.sh" ]]; then
  DOMAIN="${DOMAIN}" APP_PROFILE="${APP_PROFILE}" APP_PORT="${APP_PORT}" APP_NAME="${APP_NAME}" HEALTH_PATH="${HEALTH_PATH}" CHECK_HTTPS="${CHECK_HTTPS}" ./deploy/scripts/verify-live.sh
fi

echo "Deploy complete."
