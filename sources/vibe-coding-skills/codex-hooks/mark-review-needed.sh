#!/bin/bash
# DocMap:
# Layer: L3 / 关键 Hook
# Module: codex-hooks
# Depends on: tools/doc-sync-helpers.sh, .claude/.needs-review, .claude/.review-snapshot
# Syncs with: hooks/mark-review-needed.sh, codex-hooks.json, tools/review-gate.sh
# Codex PostToolUse hook: 共享 source-change 路径分类；T2/T3 source change 后标记待 review 并清理旧快照

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)

ROOT="${CWD:-$PWD}"
ROOT="${ROOT//\\//}"

while [ "$ROOT" != "/" ] && [ ! -d "$ROOT/.claude" ] && [ ! -f "$ROOT/AGENTS.md" ]; do
  ROOT=$(dirname "$ROOT")
done

if [ "$ROOT" = "/" ] || [ -z "$FILE_PATH" ]; then
  exit 0
fi

HELPERS="$ROOT/tools/doc-sync-helpers.sh"
if [ ! -f "$HELPERS" ]; then
  exit 0
fi

# shellcheck disable=SC1090
source "$HELPERS"

REL_PATH=$(doc_sync_relativize_path "$ROOT" "$FILE_PATH")
STATE_FILE="$ROOT/.claude/.needs-review"
SNAPSHOT_FILE="$ROOT/.claude/.review-snapshot"
DIRTY_MARKER_FILE="$ROOT/.claude/.source-change-touched"

if [ -z "$REL_PATH" ]; then
  exit 0
fi

mkdir -p "$ROOT/.claude"

if doc_sync_path_requires_review "$REL_PATH"; then
  rm -f "$SNAPSHOT_FILE"
  echo "dirty" > "$DIRTY_MARKER_FILE"
  echo "needs_review" > "$STATE_FILE"
fi

exit 0
