#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-propertysetu.in}"
APP_PORT="${APP_PORT:-5000}"
APP_NAME="${APP_NAME:-propertysetu-app}"
CHECK_HTTPS="${CHECK_HTTPS:-1}"

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
echo "Port: ${APP_PORT}"
echo "Domain: ${DOMAIN}"
echo

if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  echo "OK: PM2 app '${APP_NAME}' exists."
else
  echo "ERROR: PM2 app '${APP_NAME}' not found."
  exit 1
fi

if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null; then
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
