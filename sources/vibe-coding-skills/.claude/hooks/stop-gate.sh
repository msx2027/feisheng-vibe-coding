#!/bin/bash
# DocMap:
# Layer: L3 / 关键 Hook
# Module: hooks
# Depends on: .claude/.needs-review, .claude/.needs-doc-sync, .claude/.review-snapshot, .claude/.needs-t2-check, .claude/.t2-check-snapshot
# Syncs with: codex-hooks/stop-gate.sh
# Stop hook: recompute current source changes before trusting review/doc-sync/T2-check state

read_state() {
  local state_file="$1"

  if [ ! -f "$state_file" ]; then
    printf '\n'
    return 0
  fi

  sed $'1s/^\xEF\xBB\xBF//' "$state_file" 2>/dev/null | tr -d '[:space:]'
}

ROOT="${CLAUDE_PROJECT_DIR:-}"
REVIEW_STATE_FILE="$ROOT/.claude/.needs-review"
DOC_SYNC_STATE_FILE="$ROOT/.claude/.needs-doc-sync"
REVIEW_SNAPSHOT_FILE="$ROOT/.claude/.review-snapshot"
T2_CHECK_STATE_FILE="$ROOT/.claude/.needs-t2-check"
T2_CHECK_SNAPSHOT_FILE="$ROOT/.claude/.t2-check-snapshot"
T2_CHECK_EVIDENCE_FILE="$ROOT/.claude/.t2-check-evidence.json"
DIRTY_MARKER_FILE="$ROOT/.claude/.source-change-touched"

if [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
  exit 0
fi

HELPERS="$ROOT/tools/doc-sync-helpers.sh"
if [ -f "$HELPERS" ]; then
  # shellcheck disable=SC1090
  source "$HELPERS"
fi

REVIEW_STATE=$(read_state "$REVIEW_STATE_FILE")
DOC_SYNC_STATE=$(read_state "$DOC_SYNC_STATE_FILE")
T2_CHECK_STATE=$(read_state "$T2_CHECK_STATE_FILE")

if [ ! -f "$HELPERS" ] || ! command -v git >/dev/null 2>&1 || ! git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  if [ "$REVIEW_STATE" = "needs_review" ]; then
    echo '{"decision": "block", "reason": "review state is needs_review, but current changes could not be recomputed. Run code-review and refresh review state before stopping."}'
    exit 0
  fi

  if [ "$DOC_SYNC_STATE" = "needs_doc_sync" ]; then
    echo '{"decision": "block", "reason": "doc-sync state is needs_doc_sync, but current changes could not be recomputed. Run doc-sync-guardian or clear the state after verifying docs."}'
    exit 0
  fi

  if [ "$T2_CHECK_STATE" = "needs_t2_check" ]; then
    echo '{"decision": "block", "reason": "T2 check state is needs_t2_check, but current changes could not be recomputed. Run targeted validation and refresh the T2 check state before stopping."}'
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
  echo '{"decision": "block", "reason": "当前存在 strict source changes，但 review 尚未完成。请先运行 code-review，并在通过后执行 tools/mark-review-clean.sh 刷新当前 staged source snapshot。"}'
  exit 0
fi

if [ $STAGED_STRICT_REQUIRED -eq 0 ]; then
  STORED_SNAPSHOT_HASH=$(read_state "$REVIEW_SNAPSHOT_FILE")
  CURRENT_SNAPSHOT_HASH=$(doc_sync_review_snapshot_hash "$ROOT" 2>/dev/null || printf '\n')

  if [ -z "$STORED_SNAPSHOT_HASH" ] || [ -z "$CURRENT_SNAPSHOT_HASH" ] || [ "$STORED_SNAPSHOT_HASH" != "$CURRENT_SNAPSHOT_HASH" ]; then
    echo '{"decision": "block", "reason": ".claude/.needs-review 是 clean，但 review snapshot 缺失或已过期。请重新运行 code-review，并执行 tools/mark-review-clean.sh 刷新当前 staged source snapshot。"}'
    exit 0
  fi
fi

if [ $UNSTAGED_STRICT_REQUIRED -eq 0 ]; then
  echo '{"decision": "block", "reason": "当前存在未 staged 的 strict source changes，无法形成稳定 review snapshot。请先 stage / 收口改动，完成 code-review 后再停止。"}'
  exit 0
fi

if [ $UNSTAGED_T2_CHECK_REQUIRED -eq 0 ]; then
  echo '{"decision": "block", "reason": "当前存在未 staged 的普通 T2 source changes，无法形成稳定 T2 check snapshot。请先 stage / 收口改动，完成定向验证后执行 node tools/mark-t2-check-clean.mjs。"}'
  exit 0
fi

if [ $STAGED_T2_CHECK_REQUIRED -eq 0 ] && [ $STAGED_STRICT_REQUIRED -ne 0 ]; then
  STORED_T2_SNAPSHOT_HASH=$(read_state "$T2_CHECK_SNAPSHOT_FILE")
  CURRENT_T2_SNAPSHOT_HASH=$(doc_sync_t2_check_snapshot_hash "$ROOT" 2>/dev/null || printf '\n')

  if [ "$T2_CHECK_STATE" != "clean" ] || [ -z "$STORED_T2_SNAPSHOT_HASH" ] || [ -z "$CURRENT_T2_SNAPSHOT_HASH" ] || [ "$STORED_T2_SNAPSHOT_HASH" != "$CURRENT_T2_SNAPSHOT_HASH" ]; then
    echo '{"decision": "block", "reason": "当前存在普通 T2 staged source changes，但 T2 check 状态缺失或快照过期。请完成定向验证，并执行 node tools/mark-t2-check-clean.mjs . --evidence \"<验证命令或说明>\"。"}'
    exit 0
  fi
fi

if doc_sync_current_has_uncovered_strict_doc_sync_sources "$ROOT"; then
  echo '{"decision": "block", "reason": "当前 strict source changes 尚未被相关文档覆盖。请运行 doc-sync-guardian 或同步对应 AGENTS / CLAUDE / Product-Spec / DEV-PLAN / INDEX 等文档后再停止。"}'
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
