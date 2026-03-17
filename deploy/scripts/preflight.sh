#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-propertysetu.in}"
WWW_DOMAIN="${WWW_DOMAIN:-www.${DOMAIN}}"
APP_DIR="${APP_DIR:-/var/www/propertysetu}"
APP_PORT="${APP_PORT:-5000}"
APP_NAME="${APP_NAME:-propertysetu-app}"
BRANCH="${BRANCH:-main}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command missing -> $1"
    exit 1
  fi
}

resolve_ip() {
  local host="$1"
  if command -v getent >/dev/null 2>&1; then
    getent ahosts "$host" 2>/dev/null | awk 'NR==1{print $1}'
  fi
}

echo "== PropertySetu Production Preflight =="
echo "Domain: ${DOMAIN}"
echo "WWW: ${WWW_DOMAIN}"
echo "App: ${APP_NAME}"
echo "App Dir: ${APP_DIR}"
echo "Branch: ${BRANCH}"
echo "Port: ${APP_PORT}"
echo

require_cmd git
require_cmd curl
require_cmd node
require_cmd npm

if ! command -v nginx >/dev/null 2>&1; then
  echo "WARN: nginx command not found (will be installed by provision script if needed)."
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "WARN: pm2 command not found (will be installed by provision script if needed)."
fi

if [[ ! -d "${APP_DIR}" ]]; then
  echo "WARN: ${APP_DIR} does not exist yet."
else
  if [[ -d "${APP_DIR}/.git" ]]; then
    echo "OK: Git repository exists at ${APP_DIR}"
  else
    echo "WARN: ${APP_DIR} exists but is not a git repository."
  fi
fi

if [[ "${APP_PORT}" =~ ^[0-9]+$ ]] && (( APP_PORT > 0 && APP_PORT < 65536 )); then
  echo "OK: APP_PORT ${APP_PORT} is valid."
else
  echo "ERROR: APP_PORT must be between 1 and 65535."
  exit 1
fi

DOMAIN_IP="$(resolve_ip "${DOMAIN}" || true)"
WWW_IP="$(resolve_ip "${WWW_DOMAIN}" || true)"
SERVER_IP="$(curl -fsS https://api.ipify.org || true)"

if [[ -n "${DOMAIN_IP}" ]]; then
  echo "OK: ${DOMAIN} resolves to ${DOMAIN_IP}"
else
  echo "WARN: ${DOMAIN} does not resolve yet."
fi

if [[ -n "${WWW_IP}" ]]; then
  echo "OK: ${WWW_DOMAIN} resolves to ${WWW_IP}"
else
  echo "WARN: ${WWW_DOMAIN} does not resolve yet."
fi

if [[ -n "${SERVER_IP}" ]]; then
  echo "INFO: Server public IP appears as ${SERVER_IP}"
fi

if [[ -n "${SERVER_IP}" && -n "${DOMAIN_IP}" && "${SERVER_IP}" != "${DOMAIN_IP}" ]]; then
  echo "WARN: ${DOMAIN} DNS IP (${DOMAIN_IP}) differs from server public IP (${SERVER_IP})."
fi

if [[ -n "${SERVER_IP}" && -n "${WWW_IP}" && "${SERVER_IP}" != "${WWW_IP}" ]]; then
  echo "WARN: ${WWW_DOMAIN} DNS IP (${WWW_IP}) differs from server public IP (${SERVER_IP})."
fi

echo
echo "Preflight complete."
