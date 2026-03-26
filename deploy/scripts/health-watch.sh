#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/propertysetu}"
APP_PROFILE="$(echo "${APP_PROFILE:-legacy}" | tr '[:upper:]' '[:lower:]')"
DOMAIN="${DOMAIN:-propertysetu.in}"
CHECK_HTTPS="${CHECK_HTTPS:-0}"
LOG_DIR="${LOG_DIR:-${APP_DIR}/logs/ops}"

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

mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/health-watch.log"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

run_verify() {
  DOMAIN="${DOMAIN}" APP_PROFILE="${APP_PROFILE}" APP_PORT="${APP_PORT}" APP_NAME="${APP_NAME}" HEALTH_PATH="${HEALTH_PATH}" CHECK_HTTPS="${CHECK_HTTPS}" "${APP_DIR}/deploy/scripts/verify-live.sh"
}

echo "[$(timestamp)] health-watch start app=${APP_NAME} profile=${APP_PROFILE} domain=${DOMAIN} port=${APP_PORT} health=${HEALTH_PATH}" >> "${LOG_FILE}"

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
