#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-propertysetu.in}"
APP_PROFILE="$(echo "${APP_PROFILE:-legacy}" | tr '[:upper:]' '[:lower:]')"
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

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command missing -> $1"
    exit 1
  fi
}

require_cmd curl
require_cmd pm2

echo "== PropertySetu Live Verification =="
echo "App: ${APP_NAME}"
echo "Profile: ${APP_PROFILE}"
echo "Port: ${APP_PORT}"
echo "Domain: ${DOMAIN}"
echo "Health: ${HEALTH_PATH}"
echo

if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  echo "OK: PM2 app '${APP_NAME}' exists."
else
  echo "ERROR: PM2 app '${APP_NAME}' not found."
  exit 1
fi

if curl -fsS "http://127.0.0.1:${APP_PORT}${HEALTH_PATH}" >/dev/null; then
  echo "OK: Local API health passed on port ${APP_PORT}."
else
  echo "ERROR: Local API health failed."
  exit 1
fi

if curl -fsS -I "http://${DOMAIN}" >/dev/null; then
  echo "OK: HTTP responds for ${DOMAIN}."
else
  echo "ERROR: HTTP check failed for ${DOMAIN}."
  exit 1
fi

if [[ "${CHECK_HTTPS}" == "1" ]]; then
  if curl -fsS -I "https://${DOMAIN}" >/dev/null; then
    echo "OK: HTTPS responds for ${DOMAIN}."
  else
    echo "ERROR: HTTPS check failed for ${DOMAIN}."
    exit 1
  fi
else
  echo "INFO: HTTPS check skipped (CHECK_HTTPS=${CHECK_HTTPS})."
fi

echo
echo "Live verification complete."
