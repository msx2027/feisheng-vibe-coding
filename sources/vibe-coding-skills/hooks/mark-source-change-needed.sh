#!/bin/bash
# DocMap:
# Layer: L3 / 关键 Hook
# Module: hooks
# Depends on: tools/doc-sync-helpers.sh, .claude/.needs-review, .claude/.needs-doc-sync
# Syncs with: codex-hooks/mark-source-change-needed.sh, settings.json, tools/review-gate.sh, tools/doc-sync-gate.sh
# PostToolUse hook: 合并 source-change review 和 doc-sync 标记，减少每次编辑后的固定进程成本

INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    process.stdout.write(String(JSON.parse(input)?.tool_input?.file_path || ""));
  } catch {}
});
' 2>/dev/null)
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
REVIEW_STATE_FILE="$ROOT/.claude/.needs-review"
DOC_SYNC_STATE_FILE="$ROOT/.claude/.needs-doc-sync"
T2_CHECK_STATE_FILE="$ROOT/.claude/.needs-t2-check"
T2_CHECK_SNAPSHOT_FILE="$ROOT/.claude/.t2-check-snapshot"
T2_CHECK_EVIDENCE_FILE="$ROOT/.claude/.t2-check-evidence.json"
SNAPSHOT_FILE="$ROOT/.claude/.review-snapshot"
DIRTY_MARKER_FILE="$ROOT/.claude/.source-change-touched"

if [ -z "$REL_PATH" ]; then
  exit 0
fi

mkdir -p "$ROOT/.claude"

if doc_sync_path_requires_review "$REL_PATH"; then
  rm -f "$SNAPSHOT_FILE"
  echo "dirty" > "$DIRTY_MARKER_FILE"
  echo "needs_review" > "$REVIEW_STATE_FILE"
fi

if doc_sync_path_requires_t2_check "$REL_PATH"; then
  rm -f "$T2_CHECK_SNAPSHOT_FILE" "$T2_CHECK_EVIDENCE_FILE"
  echo "dirty" > "$DIRTY_MARKER_FILE"
  echo "needs_t2_check" > "$T2_CHECK_STATE_FILE"
fi

if doc_sync_path_requires_doc_sync "$REL_PATH"; then
  echo "dirty" > "$DIRTY_MARKER_FILE"
  echo "needs_doc_sync" > "$DOC_SYNC_STATE_FILE"
elif doc_sync_is_doc_path "$REL_PATH" && [ -f "$DIRTY_MARKER_FILE" ] && [ -f "$DOC_SYNC_STATE_FILE" ]; then
  echo "needs_doc_sync" > "$DOC_SYNC_STATE_FILE"
fi

exit 0
