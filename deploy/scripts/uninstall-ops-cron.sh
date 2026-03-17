#!/usr/bin/env bash
set -euo pipefail

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

crontab "${TMP_FILE}"
rm -f "${TMP_FILE}"

echo "PropertySetu ops cron block removed."
