#!/usr/bin/env bash
set -euo pipefail

TARGET_REF="${1:-}"
APP_DIR="${APP_DIR:-/var/www/propertysetu}"
APP_NAME="${APP_NAME:-propertysetu-app}"
APP_PORT="${APP_PORT:-5000}"
DOMAIN="${DOMAIN:-propertysetu.in}"
CHECK_HTTPS="${CHECK_HTTPS:-1}"

if [[ -z "${TARGET_REF}" ]]; then
  echo "Usage: ./deploy/scripts/rollback.sh <commit_or_tag>"
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command missing -> $1"
    exit 1
  fi
}

require_cmd git
require_cmd npm
require_cmd pm2
require_cmd curl

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "ERROR: ${APP_DIR} is not a git repository."
  exit 1
fi

cd "${APP_DIR}"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Working tree is not clean. Commit/stash changes before rollback."
  exit 1
fi

git fetch --all --tags

if ! git rev-parse --verify "${TARGET_REF}^{commit}" >/dev/null 2>&1; then
  echo "ERROR: Target ref '${TARGET_REF}' not found."
  exit 1
fi

CURRENT_COMMIT="$(git rev-parse --short HEAD)"
TARGET_COMMIT="$(git rev-parse --short "${TARGET_REF}^{commit}")"

echo "Rolling back from ${CURRENT_COMMIT} -> ${TARGET_COMMIT}"

git checkout "${TARGET_REF}"

cd server
npm ci --omit=dev
cd ..

APP_DIR="${APP_DIR}" APP_PORT="${APP_PORT}" pm2 startOrReload deploy/ecosystem.config.cjs --env production
pm2 save
sudo systemctl reload nginx

if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null; then
  echo "Rollback health check passed."
else
  echo "ERROR: Rollback health check failed."
  exit 1
fi

if [[ -x "./deploy/scripts/verify-live.sh" ]]; then
  DOMAIN="${DOMAIN}" APP_PORT="${APP_PORT}" APP_NAME="${APP_NAME}" CHECK_HTTPS="${CHECK_HTTPS}" ./deploy/scripts/verify-live.sh
fi

echo "Rollback completed to ${TARGET_COMMIT}."
echo "When ready, return to main branch:"
echo "  cd ${APP_DIR} && git checkout main && git pull --ff-only origin main"
