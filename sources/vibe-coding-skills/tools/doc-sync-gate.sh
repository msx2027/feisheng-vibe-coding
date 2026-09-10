#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: tools/doc-sync-helpers.sh, DOC-MAP.md
# Syncs with: tools/pre-commit-gate.sh, .githooks/pre-commit
# Shared doc sync gate. Blocks commits when source changes are not covered by relevant docs.

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

declare -a SOURCE_FILES=()
declare -a COVER_FILES=()
declare -a UNCOVERED_SOURCE_FILES=()

change_can_cover_source() {
  local path status tier rank
  path="$1"
  status="${2:-M}"

  tier=$(doc_sync_staged_change_tier "$ROOT" "$path" "$status")
  rank=$(doc_sync_tier_rank "$tier")
  if [ "$rank" -ge 2 ]; then
    return 0
  fi

  case "$path" in
    Product-Spec-CHANGELOG.md)
      return 0
      ;;
  esac

  return 1
}

while IFS= read -r -d '' status; do
  case "$status" in
    R*|C*)
      IFS= read -r -d '' old_path || break
      IFS= read -r -d '' new_path || break
      old_path=$(doc_sync_normalize_path "$old_path")
      new_path=$(doc_sync_normalize_path "$new_path")

      if { doc_sync_is_source_change_path "$old_path" && doc_sync_staged_change_requires_strict_review "$ROOT" "$old_path" "$status"; } ||
        { doc_sync_is_source_change_path "$new_path" && doc_sync_staged_change_requires_strict_review "$ROOT" "$new_path" "$status"; }; then
        SOURCE_FILES+=("$new_path")
      fi

      if change_can_cover_source "$old_path" "$status"; then
        COVER_FILES+=("$status|$old_path")
      fi

      if change_can_cover_source "$new_path" "$status"; then
        COVER_FILES+=("$status|$new_path")
      fi
      ;;
    *)
      IFS= read -r -d '' path || break
      path=$(doc_sync_normalize_path "$path")

      if doc_sync_is_source_change_path "$path" && doc_sync_staged_change_requires_strict_review "$ROOT" "$path" "$status"; then
        SOURCE_FILES+=("$path")
      fi

      if change_can_cover_source "$path" "$status"; then
        COVER_FILES+=("$status|$path")
      fi
      ;;
  esac
done < <(git -C "$ROOT" diff --cached --name-status -z --diff-filter=ACMRD)

if [ ${#SOURCE_FILES[@]} -eq 0 ]; then
  exit 0
fi

source_has_relevant_doc() {
  local source_path="$1"
  local cover_record cover_status cover_path

  for cover_record in "${COVER_FILES[@]}"; do
    cover_status="${cover_record%%|*}"
    cover_path="${cover_record#*|}"
    if doc_sync_change_can_cover_source "$ROOT" "$cover_path" "$source_path" "$cover_status"; then
      return 0
    fi
  done

  return 1
}

print_related_doc_hints() {
  local source_path="$1"
  local pattern

  while IFS= read -r pattern; do
    [ -n "$pattern" ] || continue
    printf '    related docs: %s\n' "$pattern" >&2
  done < <(doc_sync_print_relevant_doc_patterns_for_source_path "$source_path" | sort -u)
}

for path in "${SOURCE_FILES[@]}"; do
  if ! source_has_relevant_doc "$path"; then
    UNCOVERED_SOURCE_FILES+=("$path")
  fi
done

if [ ${#UNCOVERED_SOURCE_FILES[@]} -eq 0 ]; then
  exit 0
fi

if [ ${#COVER_FILES[@]} -eq 0 ]; then
  echo "检测到 source change 变更，但本次 staged changes 里没有任何可覆盖的相关文档更新。" >&2
else
  echo "检测到 source change 变更，但本次 staged changes 里的文档没有命中相关改动面。" >&2
  echo "本次 staged 覆盖候选：" >&2

  for path in "${COVER_FILES[@]}"; do
    echo "  - ${path#*|}" >&2
  done

  echo "" >&2
fi

echo "请先同步与改动面对应的相关文档，例如 Product-Spec / DEV-PLAN / docs / plans，或命中对应模块的 INDEX / DOC-MAP / README / AGENTS / CLAUDE，再提交；也可以先运行 doc-sync-guardian。" >&2
echo "本次尚未被相关文档覆盖的 source change：" >&2

for path in "${UNCOVERED_SOURCE_FILES[@]}"; do
  echo "  - $path" >&2
  print_related_doc_hints "$path"
done

exit 2
