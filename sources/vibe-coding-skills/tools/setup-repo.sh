#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT=$(dirname "$SCRIPT_DIR")

if command -v pwsh >/dev/null 2>&1; then
  PS_BIN="pwsh"
elif command -v powershell >/dev/null 2>&1; then
  PS_BIN="powershell"
else
  echo "PowerShell was not found. Install pwsh or powershell and try again." >&2
  exit 1
fi

echo "Step 1/2: syncing compatibility directories..."
"$PS_BIN" -ExecutionPolicy Bypass -File "$SCRIPT_DIR/sync-compat.ps1"

if ! git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "Step 2/2: skipping Git hooks because the folder is not a Git repository."
  echo "If you later run git init or place the package inside a cloned repo, rerun tools/install-git-hooks.sh."
  echo "Repository setup complete."
  exit 0
fi

if ! git -C "$ROOT" rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "Step 2/2: skipping Git hooks because this Git repository has no baseline commit yet."
  echo "Commit the imported package once, then rerun tools/install-git-hooks.sh."
  echo "Repository setup complete."
  exit 0
fi

if ! command -v bash >/dev/null 2>&1; then
  echo "Step 2/2: skipping Git hooks because bash was not found."
  echo "Install Git Bash or another bash and rerun tools/install-git-hooks.sh if you want repo-level hooks."
  echo "Repository setup complete."
  exit 0
fi

echo "Step 2/2: installing repo Git hooks..."
bash "$SCRIPT_DIR/install-git-hooks.sh"

echo "Repository setup complete."
