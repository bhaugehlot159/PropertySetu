#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/propertysetu"
BRANCH="${1:-main}"
APP_NAME="propertysetu-app"

echo "Deploying ${APP_NAME} from branch ${BRANCH}..."

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

pm2 startOrReload deploy/ecosystem.config.cjs --env production
pm2 save

sudo systemctl reload nginx

if curl -fsS http://127.0.0.1:5000/api/health >/dev/null; then
  echo "Health check passed: /api/health"
else
  echo "ERROR: Health check failed."
  exit 1
fi

echo "Deploy complete."
