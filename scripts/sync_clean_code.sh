#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <target-branch> [source-branch]"
  echo "Example: $0 codex/develop-complete-propertysetu-website-structure-ajuciq work"
  exit 1
fi

TARGET_BRANCH="$1"
SOURCE_BRANCH="${2:-work}"

echo "[1/7] Fetching origin..."
git fetch origin

echo "[2/7] Checking out target branch: ${TARGET_BRANCH}"
git checkout "${TARGET_BRANCH}"

echo "[3/7] Pulling latest target branch..."
git pull --rebase origin "${TARGET_BRANCH}"

echo "[4/7] Syncing clean files from source branch: ${SOURCE_BRANCH}"
git checkout "${SOURCE_BRANCH}" -- .

echo "[5/7] Verifying conflict markers..."
if rg -n "^(<<<<<<<|=======|>>>>>>>)" >/tmp/propertysetu_conflicts.txt 2>/dev/null; then
  echo "Conflict markers still found:"
  cat /tmp/propertysetu_conflicts.txt
  exit 2
fi

echo "[6/7] Committing clean sync..."
git add .
if git diff --cached --quiet; then
  echo "No changes to commit. Branch is already clean."
else
  git commit -m "Sync clean code from ${SOURCE_BRANCH} and remove merge conflict artifacts"
fi

echo "[7/7] Pushing branch..."
git push origin "${TARGET_BRANCH}"

echo "Done. Refresh GitHub PR page and merge."
