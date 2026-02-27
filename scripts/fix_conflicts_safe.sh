#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <target-branch> [source-branch]"
  echo "Example: $0 codex/develop-complete-propertysetu-website-structure-ajuciq work"
  exit 1
fi

TARGET_BRANCH="$1"
SOURCE_BRANCH="${2:-work}"

FILES=(
  "add-property.html"
  "client/README.md"
  "client/js/admin-portal.js"
  "client/js/customer-portal.js"
  "client/pages/admin-portal.html"
  "client/pages/customer-portal.html"
  "css/style.css"
  "database/README.md"
  "index.html"
  "js/add-property.js"
  "js/location.js"
  "js/script.js"
  "legal/disclaimer.html"
  "legal/privacy.html"
  "legal/refund.html"
  "legal/service-agreement.html"
  "legal/terms.html"
  "server/package.json"
  "server/routes/propertyRoutes.js"
  "server/server.js"
)

echo "[1/8] fetch origin"
git fetch origin

echo "[2/8] checkout ${TARGET_BRANCH}"
git checkout "${TARGET_BRANCH}"

echo "[3/8] abort half-merge state if exists"
git merge --abort >/dev/null 2>&1 || true


echo "[4/8] sync latest target"
git pull --rebase origin "${TARGET_BRANCH}" || true

echo "[5/8] restore clean files from ${SOURCE_BRANCH}"
git checkout "${SOURCE_BRANCH}" -- "${FILES[@]}"

echo "[6/8] verify conflict markers"
if rg -n "^(<<<<<<<|=======|>>>>>>>)" "${FILES[@]}" >/tmp/propertysetu_conflicts.txt 2>/dev/null; then
  echo "Conflict markers still present:"
  cat /tmp/propertysetu_conflicts.txt
  exit 2
fi

echo "[7/8] commit"
git add "${FILES[@]}"
if git diff --cached --quiet; then
  echo "No file differences. Branch already clean for listed files."
else
  git commit -m "Restore clean UI/server files and remove conflict markers"
fi

echo "[8/8] push"
git push origin "${TARGET_BRANCH}"

echo "Done ✅"
