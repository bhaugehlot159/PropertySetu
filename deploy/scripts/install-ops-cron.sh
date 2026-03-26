#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/propertysetu}"
DOMAIN="${DOMAIN:-propertysetu.in}"
APP_PROFILE="$(echo "${APP_PROFILE:-legacy}" | tr '[:upper:]' '[:lower:]')"
CHECK_HTTPS="${CHECK_HTTPS:-0}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/propertysetu}"
KEEP_DAYS="${KEEP_DAYS:-14}"
HEALTH_EVERY_MIN="${HEALTH_EVERY_MIN:-10}"
BACKUP_HOUR="${BACKUP_HOUR:-2}"
BACKUP_MIN="${BACKUP_MIN:-30}"
ENABLE_CERTBOT_CRON="${ENABLE_CERTBOT_CRON:-0}"
CERTBOT_MIN="${CERTBOT_MIN:-17}"
CERTBOT_HOUR="${CERTBOT_HOUR:-4}"
CERTBOT_DOW="${CERTBOT_DOW:-1}"

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

require_cmd crontab
require_cmd awk
require_cmd mktemp

if [[ ! -d "${APP_DIR}" ]]; then
  echo "ERROR: APP_DIR not found: ${APP_DIR}"
  exit 1
fi

if [[ ! "${HEALTH_EVERY_MIN}" =~ ^[0-9]+$ ]] || (( HEALTH_EVERY_MIN < 1 || HEALTH_EVERY_MIN > 59 )); then
  echo "ERROR: HEALTH_EVERY_MIN must be 1-59."
  exit 1
fi

if [[ ! "${BACKUP_HOUR}" =~ ^[0-9]+$ ]] || (( BACKUP_HOUR < 0 || BACKUP_HOUR > 23 )); then
  echo "ERROR: BACKUP_HOUR must be 0-23."
  exit 1
fi

if [[ ! "${BACKUP_MIN}" =~ ^[0-9]+$ ]] || (( BACKUP_MIN < 0 || BACKUP_MIN > 59 )); then
  echo "ERROR: BACKUP_MIN must be 0-59."
  exit 1
fi

mkdir -p "${APP_DIR}/logs/ops"

BLOCK_START="# BEGIN PROPERTYSETU OPS CRON"
BLOCK_END="# END PROPERTYSETU OPS CRON"
TMP_FILE="$(mktemp)"

{
  crontab -l 2>/dev/null || true
} | awk -v s="${BLOCK_START}" -v e="${BLOCK_END}" '
  $0==s {skip=1; next}
  $0==e {skip=0; next}
  !skip {print}
' > "${TMP_FILE}"

cat >> "${TMP_FILE}" <<EOF
${BLOCK_START}
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/${HEALTH_EVERY_MIN} * * * * APP_DIR=${APP_DIR} DOMAIN=${DOMAIN} APP_PROFILE=${APP_PROFILE} APP_PORT=${APP_PORT} APP_NAME=${APP_NAME} HEALTH_PATH=${HEALTH_PATH} CHECK_HTTPS=${CHECK_HTTPS} /bin/bash ${APP_DIR}/deploy/scripts/health-watch.sh >> ${APP_DIR}/logs/ops/cron-health.log 2>&1
${BACKUP_MIN} ${BACKUP_HOUR} * * * APP_DIR=${APP_DIR} BACKUP_ROOT=${BACKUP_ROOT} KEEP_DAYS=${KEEP_DAYS} /bin/bash ${APP_DIR}/deploy/scripts/backup.sh >> ${APP_DIR}/logs/ops/cron-backup.log 2>&1
EOF

if [[ "${ENABLE_CERTBOT_CRON}" == "1" ]]; then
  cat >> "${TMP_FILE}" <<EOF
${CERTBOT_MIN} ${CERTBOT_HOUR} * * ${CERTBOT_DOW} /usr/bin/certbot renew --quiet >> ${APP_DIR}/logs/ops/cron-certbot.log 2>&1
EOF
fi

cat >> "${TMP_FILE}" <<EOF
${BLOCK_END}
EOF

crontab "${TMP_FILE}"
rm -f "${TMP_FILE}"

echo "PropertySetu ops cron installed."
echo "- Profile: ${APP_PROFILE}"
echo "- Health check every ${HEALTH_EVERY_MIN} minutes"
echo "- Daily backup at ${BACKUP_HOUR}:$(printf '%02d' "${BACKUP_MIN}")"
if [[ "${ENABLE_CERTBOT_CRON}" == "1" ]]; then
  echo "- Certbot renew weekly on day ${CERTBOT_DOW} at ${CERTBOT_HOUR}:$(printf '%02d' "${CERTBOT_MIN}")"
else
  echo "- Certbot cron not added (ENABLE_CERTBOT_CRON=${ENABLE_CERTBOT_CRON})"
fi

echo
echo "Current cron entries:"
crontab -l | sed -n "/${BLOCK_START}/,/${BLOCK_END}/p"
