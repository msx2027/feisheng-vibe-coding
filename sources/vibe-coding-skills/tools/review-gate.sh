#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: tools/doc-sync-helpers.sh, .claude/.needs-review, .claude/.review-snapshot
# Syncs with: tools/mark-review-clean.sh, tools/pre-commit-gate.sh, hooks/mark-source-change-needed.sh, codex-hooks/mark-source-change-needed.sh
# Shared review gate. Blocks commits when staged source changes have not been explicitly review-approved.

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
if [ ! -f "$HELPERS" ]; then
  exit 0
fi

# shellcheck disable=SC1090
source "$HELPERS"

declare -a REVIEW_FILES=()
declare -a STALE_FILES=()
declare -a COMPLEX_REVIEW_FILES=()
declare -a STRICT_REVIEW_FILES=()
declare -a T2_CHECK_FILES=()

read_state() {
  local state_file="$1"

  if [ ! -f "$state_file" ]; then
    printf '\n'
    return 0
  fi

  sed $'1s/^\xEF\xBB\xBF//' "$state_file" 2>/dev/null | tr -d '[:space:]'
}

file_mtime_epoch() {
  local path="$1"

  if stat -c %Y "$path" >/dev/null 2>&1; then
    stat -c %Y "$path"
    return 0
  fi

  if stat -f %m "$path" >/dev/null 2>&1; then
    stat -f %m "$path"
    return 0
  fi

  return 1
}

collect_complex_review_files() {
  local status old_path new_path path

  while IFS= read -r -d '' status; do
    case "$status" in
      R*)
        IFS= read -r -d '' old_path || break
        IFS= read -r -d '' new_path || break
        old_path=$(doc_sync_normalize_path "$old_path")
        new_path=$(doc_sync_normalize_path "$new_path")

        if doc_sync_staged_change_requires_review "$ROOT" "$old_path" "$status" || doc_sync_staged_change_requires_review "$ROOT" "$new_path" "$status"; then
          printf '%s\n' "$new_path"
        fi
        ;;
      D)
        IFS= read -r -d '' path || break
        path=$(doc_sync_normalize_path "$path")

        if doc_sync_staged_change_requires_review "$ROOT" "$path" "$status"; then
          printf '%s\n' "$path"
        fi
        ;;
      *)
        IFS= read -r -d '' path || break
        ;;
    esac
  done < <(git -C "$ROOT" diff --cached --name-status -z --diff-filter=DR)
}

collect_gate_files() {
  local status old_path new_path path primary

  while IFS= read -r -d '' status; do
    case "$status" in
      R*|C*)
        IFS= read -r -d '' old_path || break
        IFS= read -r -d '' new_path || break
        old_path=$(doc_sync_normalize_path "$old_path")
        new_path=$(doc_sync_normalize_path "$new_path")
        primary="${new_path:-$old_path}"

        if doc_sync_staged_change_requires_strict_review "$ROOT" "$old_path" "$status" || doc_sync_staged_change_requires_strict_review "$ROOT" "$new_path" "$status"; then
          STRICT_REVIEW_FILES+=("$primary")
        elif doc_sync_staged_change_requires_t2_check "$ROOT" "$old_path" "$status" || doc_sync_staged_change_requires_t2_check "$ROOT" "$new_path" "$status"; then
          T2_CHECK_FILES+=("$primary")
        fi
        ;;
      *)
        IFS= read -r -d '' path || break
        path=$(doc_sync_normalize_path "$path")

        if doc_sync_staged_change_requires_strict_review "$ROOT" "$path" "$status"; then
          STRICT_REVIEW_FILES+=("$path")
        elif doc_sync_staged_change_requires_t2_check "$ROOT" "$path" "$status"; then
          T2_CHECK_FILES+=("$path")
        fi
        ;;
    esac
  done < <(git -C "$ROOT" diff --cached --name-status -z --diff-filter=ACMRD)
}

review_snapshot_is_current() {
  local stored current
  stored=$(read_state "$SNAPSHOT_FILE")
  current=$(doc_sync_review_snapshot_hash "$ROOT" 2>/dev/null || printf '\n')

  [ -n "$stored" ] && [ -n "$current" ] && [ "$stored" = "$current" ]
}

t2_check_snapshot_is_current() {
  local state_file snapshot_file stored current state
  state_file="$ROOT/.claude/.needs-t2-check"
  snapshot_file="$ROOT/.claude/.t2-check-snapshot"
  state=$(read_state "$state_file")

  [ "$state" = "clean" ] || return 1

  stored=$(read_state "$snapshot_file")
  current=$(doc_sync_t2_check_snapshot_hash "$ROOT" 2>/dev/null || printf '\n')

  [ -n "$stored" ] && [ -n "$current" ] && [ "$stored" = "$current" ]
}

collect_gate_files

if [ ${#STRICT_REVIEW_FILES[@]} -eq 0 ] && [ ${#T2_CHECK_FILES[@]} -eq 0 ]; then
  exit 0
fi

STATE_FILE="$ROOT/.claude/.needs-review"
SNAPSHOT_FILE="$ROOT/.claude/.review-snapshot"
REVIEW_STATE=$(read_state "$STATE_FILE")

if [ ${#STRICT_REVIEW_FILES[@]} -eq 0 ]; then
  if [ "$REVIEW_STATE" = "clean" ] && review_snapshot_is_current; then
    exit 0
  fi

  if t2_check_snapshot_is_current; then
    exit 0
  fi

  echo "检测到普通 T2 staged source changes，但缺少有效的轻量 T2 检查快照。" >&2
  echo "请先完成定向验证，并执行 \`node tools/mark-t2-check-clean.mjs . --evidence \"<验证命令或说明>\"\`。" >&2
  echo "本次触发轻量 T2 检查的 source change：" >&2

  for path in "${T2_CHECK_FILES[@]}"; do
    echo "  - $path" >&2
  done

  exit 2
fi

while IFS= read -r -d '' status; do
  case "$status" in
    R*|C*)
      IFS= read -r -d '' old_path || break
      IFS= read -r -d '' new_path || break
      old_path=$(doc_sync_normalize_path "$old_path")
      new_path=$(doc_sync_normalize_path "$new_path")

      if doc_sync_staged_change_requires_review "$ROOT" "$old_path" "$status" || doc_sync_staged_change_requires_review "$ROOT" "$new_path" "$status"; then
        REVIEW_FILES+=("$new_path")
      fi
      ;;
    *)
      IFS= read -r -d '' path || break
      path=$(doc_sync_normalize_path "$path")

      if doc_sync_staged_change_requires_review "$ROOT" "$path" "$status"; then
        REVIEW_FILES+=("$path")
      fi
      ;;
  esac
done < <(git -C "$ROOT" diff --cached --name-status -z --diff-filter=ACMRD)

if [ ${#REVIEW_FILES[@]} -eq 0 ]; then
  exit 0
fi

if [ "$REVIEW_STATE" != "clean" ]; then
  echo "检测到需要 strict review 的 staged source changes，但 \`.claude/.needs-review\` 不是 \`clean\`。" >&2
  echo "请先完成 code-review，并在 review 通过后执行 \`tools/mark-review-clean.sh\` 刷新当前 staged source-change review 快照。" >&2
  echo "本次触发门禁的 source change：" >&2

  for path in "${STRICT_REVIEW_FILES[@]}"; do
    echo "  - $path" >&2
  done

  exit 2
fi

STORED_SNAPSHOT_HASH=$(read_state "$SNAPSHOT_FILE")
CURRENT_SNAPSHOT_HASH=$(doc_sync_review_snapshot_hash "$ROOT" 2>/dev/null || printf '\n')

if [ -z "$STORED_SNAPSHOT_HASH" ] || [ -z "$CURRENT_SNAPSHOT_HASH" ]; then
  STALE_FILES=("${REVIEW_FILES[@]}")
elif [ "$STORED_SNAPSHOT_HASH" = "$CURRENT_SNAPSHOT_HASH" ]; then
  exit 0
else
  STALE_FILES=("${REVIEW_FILES[@]}")
fi

if [ ${#STALE_FILES[@]} -eq 0 ]; then
  STATE_MTIME=$(file_mtime_epoch "$STATE_FILE" 2>/dev/null || printf '\n')

  if [ -n "$STATE_MTIME" ]; then
    for path in "${REVIEW_FILES[@]}"; do
      abs_path="$ROOT/$path"

      if [ ! -f "$abs_path" ]; then
        continue
      fi

      FILE_MTIME=$(file_mtime_epoch "$abs_path" 2>/dev/null || printf '\n')
      if [ -n "$FILE_MTIME" ] && [ "$FILE_MTIME" -gt "$STATE_MTIME" ]; then
        STALE_FILES+=("$path")
      fi
    done
  fi
fi

if [ ${#STALE_FILES[@]} -gt 0 ]; then
  echo "检测到 \`.claude/.needs-review = clean\` 缺少有效快照或已经过期：当前 staged source changes 和最近一次 review 确认的内容不一致。" >&2
  echo "请重新执行 code-review，并在通过后运行 \`tools/mark-review-clean.sh\` 刷新 review 快照。" >&2

  for path in "${STALE_FILES[@]}"; do
    echo "  - $path" >&2
  done

  exit 2
fi

exit 0
