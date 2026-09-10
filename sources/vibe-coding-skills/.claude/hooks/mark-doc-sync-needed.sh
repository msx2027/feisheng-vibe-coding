#!/bin/bash
# DocMap:
# Layer: L3 / 关键 Hook
# Module: hooks
# Depends on: tools/doc-sync-helpers.sh, .claude/.needs-doc-sync
# Syncs with: codex-hooks/mark-doc-sync-needed.sh, settings.json
# PostToolUse hook: source change 改动后标记待文档同步；文档层改动后重新计算覆盖状态

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
ROOT="${CLAUDE_PROJECT_DIR:-}"

if [ -z "$FILE_PATH" ] || [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
  exit 0
fi

HELPERS="$ROOT/tools/doc-sync-helpers.sh"
if [ ! -f "$HELPERS" ]; then
  exit 0
fi

# shellcheck disable=SC1090
source "$HELPERS"

REL_PATH=$(doc_sync_relativize_path "$ROOT" "$FILE_PATH")
STATE_FILE="$ROOT/.claude/.needs-doc-sync"
DIRTY_MARKER_FILE="$ROOT/.claude/.source-change-touched"

if [ -z "$REL_PATH" ]; then
  exit 0
fi

mkdir -p "$ROOT/.claude"

if doc_sync_path_requires_doc_sync "$REL_PATH"; then
  echo "dirty" > "$DIRTY_MARKER_FILE"
  echo "needs_doc_sync" > "$STATE_FILE"
elif doc_sync_is_doc_path "$REL_PATH" && [ -f "$DIRTY_MARKER_FILE" ] && [ -f "$STATE_FILE" ]; then
  echo "needs_doc_sync" > "$STATE_FILE"
fi

exit 0
