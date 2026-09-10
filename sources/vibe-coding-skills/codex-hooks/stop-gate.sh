#!/bin/bash
# DocMap:
# Layer: L3 / 关键 Hook
# Module: codex-hooks
# Depends on: .claude/.needs-review, .claude/.needs-doc-sync, .claude/.review-snapshot, .claude/.needs-t2-check, .claude/.t2-check-snapshot
# Syncs with: hooks/stop-gate.sh, codex-hooks.json
# Codex Stop hook: recompute current source changes before trusting review/doc-sync/T2-check state

INPUT=$(cat)
CWD=$(printf '%s' "$INPUT" | node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try { process.stdout.write(String(JSON.parse(input)?.cwd || "")); } catch {}
});
' 2>/dev/null)
ROOT=$(git -C "${CWD:-$PWD}" rev-parse --show-toplevel 2>/dev/null || true)

read_state() {
  local state_file="$1"

  if [ ! -f "$state_file" ]; then
    printf '\n'
    return 0
  fi

  sed $'1s/^\xEF\xBB\xBF//' "$state_file" 2>/dev/null | tr -d '[:space:]'
}

[ -n "$ROOT" ] || exit 0

HELPERS="$ROOT/tools/doc-sync-helpers.sh"
if [ -f "$HELPERS" ]; then
  # shellcheck disable=SC1090
  source "$HELPERS"
fi

REVIEW_STATE_FILE="$ROOT/.claude/.needs-review"
DOC_SYNC_STATE_FILE="$ROOT/.claude/.needs-doc-sync"
REVIEW_SNAPSHOT_FILE="$ROOT/.claude/.review-snapshot"
T2_CHECK_STATE_FILE="$ROOT/.claude/.needs-t2-check"
T2_CHECK_SNAPSHOT_FILE="$ROOT/.claude/.t2-check-snapshot"
T2_CHECK_EVIDENCE_FILE="$ROOT/.claude/.t2-check-evidence.json"
DIRTY_MARKER_FILE="$ROOT/.claude/.source-change-touched"

REVIEW_STATE=$(read_state "$REVIEW_STATE_FILE")
DOC_SYNC_STATE=$(read_state "$DOC_SYNC_STATE_FILE")
T2_CHECK_STATE=$(read_state "$T2_CHECK_STATE_FILE")

if [ ! -f "$HELPERS" ] || ! command -v git >/dev/null 2>&1 || ! git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  if [ "$REVIEW_STATE" = "needs_review" ]; then
    echo '{"decision":"block","reason":"review state is needs_review, but current changes could not be recomputed. Run code-review and refresh review state before stopping."}'
    exit 0
  fi

  if [ "$DOC_SYNC_STATE" = "needs_doc_sync" ]; then
    echo '{"decision":"block","reason":"doc-sync state is needs_doc_sync, but current changes could not be recomputed. Run doc-sync-guardian or clear the state after verifying docs."}'
    exit 0
  fi

  if [ "$T2_CHECK_STATE" = "needs_t2_check" ]; then
    echo '{"decision":"block","reason":"T2 check state is needs_t2_check, but current changes could not be recomputed. Run targeted validation and refresh the T2 check state before stopping."}'
    exit 0
  fi

  exit 0
fi

STAGED_STRICT_REQUIRED=1
UNSTAGED_STRICT_REQUIRED=1
STAGED_T2_CHECK_REQUIRED=1
UNSTAGED_T2_CHECK_REQUIRED=1
CURRENT_SOURCE_REQUIRED=1

if doc_sync_current_has_strict_source_changes "$ROOT" cached; then
  STAGED_STRICT_REQUIRED=0
fi

if doc_sync_current_has_strict_source_changes "$ROOT" unstaged || doc_sync_current_has_strict_source_changes "$ROOT" untracked; then
  UNSTAGED_STRICT_REQUIRED=0
fi

if doc_sync_current_has_t2_light_changes "$ROOT" cached; then
  STAGED_T2_CHECK_REQUIRED=0
fi

if doc_sync_current_has_t2_light_changes "$ROOT" unstaged || doc_sync_current_has_t2_light_changes "$ROOT" untracked; then
  UNSTAGED_T2_CHECK_REQUIRED=0
fi

if [ $STAGED_STRICT_REQUIRED -eq 0 ] || [ $UNSTAGED_STRICT_REQUIRED -eq 0 ] || [ $STAGED_T2_CHECK_REQUIRED -eq 0 ] || [ $UNSTAGED_T2_CHECK_REQUIRED -eq 0 ]; then
  CURRENT_SOURCE_REQUIRED=0
fi

if { [ $STAGED_STRICT_REQUIRED -eq 0 ] || [ $UNSTAGED_STRICT_REQUIRED -eq 0 ]; } && [ "$REVIEW_STATE" != "clean" ]; then
  echo '{"decision":"block","reason":"Current strict source changes require review. Run code-review, then tools/mark-review-clean.sh to refresh the staged source snapshot."}'
  exit 0
fi

if [ $STAGED_STRICT_REQUIRED -eq 0 ]; then
  STORED_SNAPSHOT_HASH=$(read_state "$REVIEW_SNAPSHOT_FILE")
  CURRENT_SNAPSHOT_HASH=$(doc_sync_review_snapshot_hash "$ROOT" 2>/dev/null || printf '\n')

  if [ -z "$STORED_SNAPSHOT_HASH" ] || [ -z "$CURRENT_SNAPSHOT_HASH" ] || [ "$STORED_SNAPSHOT_HASH" != "$CURRENT_SNAPSHOT_HASH" ]; then
    echo '{"decision":"block","reason":".claude/.needs-review is clean, but the review snapshot is missing or stale. Re-run code-review and tools/mark-review-clean.sh."}'
    exit 0
  fi
fi

if [ $UNSTAGED_STRICT_REQUIRED -eq 0 ]; then
  echo '{"decision":"block","reason":"Unstaged strict source changes cannot produce a stable review snapshot. Stage or close the changes, then complete review."}'
  exit 0
fi

if [ $UNSTAGED_T2_CHECK_REQUIRED -eq 0 ]; then
  echo '{"decision":"block","reason":"Unstaged ordinary T2 source changes cannot produce a stable T2 check snapshot. Stage or close the changes, then run targeted validation and node tools/mark-t2-check-clean.mjs."}'
  exit 0
fi

if [ $STAGED_T2_CHECK_REQUIRED -eq 0 ] && [ $STAGED_STRICT_REQUIRED -ne 0 ]; then
  STORED_T2_SNAPSHOT_HASH=$(read_state "$T2_CHECK_SNAPSHOT_FILE")
  CURRENT_T2_SNAPSHOT_HASH=$(doc_sync_t2_check_snapshot_hash "$ROOT" 2>/dev/null || printf '\n')

  if [ "$T2_CHECK_STATE" != "clean" ] || [ -z "$STORED_T2_SNAPSHOT_HASH" ] || [ -z "$CURRENT_T2_SNAPSHOT_HASH" ] || [ "$STORED_T2_SNAPSHOT_HASH" != "$CURRENT_T2_SNAPSHOT_HASH" ]; then
    echo '{"decision":"block","reason":"Current ordinary T2 staged source changes need a fresh T2 check. Run targeted validation, then node tools/mark-t2-check-clean.mjs . --evidence \"<validation command or note>\"."}'
    exit 0
  fi
fi

if doc_sync_current_has_uncovered_strict_doc_sync_sources "$ROOT"; then
  echo '{"decision":"block","reason":"Current strict source changes are not covered by related docs. Run doc-sync-guardian or update the mapped docs before stopping."}'
  exit 0
fi

if [ $CURRENT_SOURCE_REQUIRED -ne 0 ]; then
  rm -f "$DIRTY_MARKER_FILE"
  rm -f "$REVIEW_SNAPSHOT_FILE"
  rm -f "$REVIEW_STATE_FILE"
  rm -f "$DOC_SYNC_STATE_FILE"
  rm -f "$T2_CHECK_STATE_FILE"
  rm -f "$T2_CHECK_SNAPSHOT_FILE"
  rm -f "$T2_CHECK_EVIDENCE_FILE"
fi

exit 0
