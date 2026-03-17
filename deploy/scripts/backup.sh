#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/propertysetu}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/propertysetu}"
KEEP_DAYS="${KEEP_DAYS:-14}"
ENABLE_MONGO_DUMP="${ENABLE_MONGO_DUMP:-0}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command missing -> $1"
    exit 1
  fi
}

require_cmd git
require_cmd tar
require_cmd find

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "ERROR: ${APP_DIR} is not a git repository."
  exit 1
fi

mkdir -p "${BACKUP_ROOT}"

cd "${APP_DIR}"
TS="$(date +%Y%m%d_%H%M%S)"
SHORT_COMMIT="$(git rev-parse --short HEAD)"
BRANCH_NAME="$(git rev-parse --abbrev-ref HEAD)"
BACKUP_DIR="${BACKUP_ROOT}/${TS}_${SHORT_COMMIT}"
mkdir -p "${BACKUP_DIR}"

echo "Creating backup at: ${BACKUP_DIR}"

# 1) Code backup from git HEAD (tracked files only)
git archive --format=tar.gz -o "${BACKUP_DIR}/code_${TS}_${SHORT_COMMIT}.tar.gz" HEAD

# 2) Runtime config backup
if [[ -f "${APP_DIR}/server/.env" ]]; then
  cp "${APP_DIR}/server/.env" "${BACKUP_DIR}/server.env"
fi

if [[ -f "/etc/nginx/sites-available/propertysetu.conf" ]]; then
  sudo cp "/etc/nginx/sites-available/propertysetu.conf" "${BACKUP_DIR}/nginx.propertysetu.conf"
  sudo chown "$USER:$USER" "${BACKUP_DIR}/nginx.propertysetu.conf"
fi

# 3) Metadata
cat > "${BACKUP_DIR}/metadata.txt" <<EOF
timestamp=${TS}
branch=${BRANCH_NAME}
commit=${SHORT_COMMIT}
app_dir=${APP_DIR}
backup_root=${BACKUP_ROOT}
EOF

# 4) Optional MongoDB dump if requested and possible
if [[ "${ENABLE_MONGO_DUMP}" == "1" ]]; then
  if command -v mongodump >/dev/null 2>&1 && [[ -f "${APP_DIR}/server/.env" ]]; then
    MONGODB_URI="$(grep -E '^MONGODB_URI=' "${APP_DIR}/server/.env" | head -n1 | sed 's/^MONGODB_URI=//')"
    if [[ -n "${MONGODB_URI}" ]]; then
      mongodump --uri="${MONGODB_URI}" --out "${BACKUP_DIR}/mongo_dump" || echo "WARN: mongodump failed."
    else
      echo "WARN: MONGODB_URI not set, mongo dump skipped."
    fi
  else
    echo "WARN: mongodump command missing or server/.env unavailable, mongo dump skipped."
  fi
fi

# 5) Compress backup directory into single bundle
tar -czf "${BACKUP_ROOT}/propertysetu_backup_${TS}_${SHORT_COMMIT}.tar.gz" -C "${BACKUP_ROOT}" "$(basename "${BACKUP_DIR}")"

# 6) Retention cleanup
find "${BACKUP_ROOT}" -maxdepth 1 -type f -name "propertysetu_backup_*.tar.gz" -mtime "+${KEEP_DAYS}" -delete || true
find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "20*" -mtime "+${KEEP_DAYS}" -exec rm -rf {} + || true

echo "Backup completed:"
echo " - Folder: ${BACKUP_DIR}"
echo " - Bundle: ${BACKUP_ROOT}/propertysetu_backup_${TS}_${SHORT_COMMIT}.tar.gz"
