#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/propertysetu}"
APP_NAME="${APP_NAME:-propertysetu-app}"
DOMAIN="${DOMAIN:-propertysetu.in}"
APP_PORT="${APP_PORT:-5000}"
CHECK_HTTPS="${CHECK_HTTPS:-0}"
LOG_DIR="${LOG_DIR:-${APP_DIR}/logs/ops}"

mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/health-watch.log"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

run_verify() {
  DOMAIN="${DOMAIN}" APP_PORT="${APP_PORT}" APP_NAME="${APP_NAME}" CHECK_HTTPS="${CHECK_HTTPS}" "${APP_DIR}/deploy/scripts/verify-live.sh"
}

echo "[$(timestamp)] health-watch start app=${APP_NAME} domain=${DOMAIN} port=${APP_PORT}" >> "${LOG_FILE}"

if run_verify >> "${LOG_FILE}" 2>&1; then
  echo "[$(timestamp)] health-watch ok" >> "${LOG_FILE}"
  exit 0
fi

echo "[$(timestamp)] health-watch failed. restarting ${APP_NAME}..." >> "${LOG_FILE}"
if pm2 restart "${APP_NAME}" >> "${LOG_FILE}" 2>&1; then
  sleep 10
  if run_verify >> "${LOG_FILE}" 2>&1; then
    echo "[$(timestamp)] health-watch recovered after restart" >> "${LOG_FILE}"
    exit 0
  fi
fi

echo "[$(timestamp)] health-watch critical: service still unhealthy after restart" >> "${LOG_FILE}"
exit 1
