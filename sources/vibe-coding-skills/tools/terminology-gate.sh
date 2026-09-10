#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: tools/doc-sync-helpers.sh, tools/check-terminology-consistency.sh
# Syncs with: tools/pre-commit-gate.sh, tools/test-terminology-gate.sh, tools/INDEX.md
# Shared terminology gate. Runs hard-block checks when staged terminology-scope doc/behavior changes exist.

set -u

ROOT="${1:-}"

if [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  exit 0
fi

if ! git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

HELPERS="$ROOT/tools/doc-sync-helpers.sh"
CHECKER="$ROOT/tools/check-terminology-consistency.sh"

if [ ! -f "$HELPERS" ]; then
  echo "[terminology-gate] blocked: missing tools/doc-sync-helpers.sh." >&2
  exit 2
fi

if [ ! -f "$CHECKER" ]; then
  echo "[terminology-gate] blocked: missing tools/check-terminology-consistency.sh." >&2
  exit 2
fi

# shellcheck disable=SC1090
source "$HELPERS"

declare -a CHANGED_FILES=()
declare -a DOC_FILES=()
declare -a BEHAVIOR_FILES=()

mapfile -d '' CHANGED_FILES < <(git -C "$ROOT" diff --cached --name-only -z --diff-filter=ACMRD)

if [ ${#CHANGED_FILES[@]} -eq 0 ]; then
  exit 0
fi

for raw_path in "${CHANGED_FILES[@]}"; do
  path=$(doc_sync_normalize_path "$raw_path")
  if doc_sync_is_doc_path "$path"; then
    DOC_FILES+=("$path")
  fi
  if doc_sync_is_behavior_path "$path"; then
    BEHAVIOR_FILES+=("$path")
  fi
done

if [ ${#DOC_FILES[@]} -eq 0 ] && [ ${#BEHAVIOR_FILES[@]} -eq 0 ]; then
  exit 0
fi

bash "$CHECKER" --root "$ROOT" --mode staged
status=$?
if [ $status -ne 0 ]; then
  echo "[terminology-gate] blocked: staged terminology checks did not pass." >&2
  exit $status
fi

exit 0
