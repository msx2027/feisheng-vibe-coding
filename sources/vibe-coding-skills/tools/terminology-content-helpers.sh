#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Used by: tools/check-terminology-consistency.sh
# Stable staged-index content materialization for terminology checks.

cleanup_staged_content_root() {
  if [ -n "$STAGED_CONTENT_ROOT" ] && [ -d "$STAGED_CONTENT_ROOT" ]; then
    rm -rf "$STAGED_CONTENT_ROOT"
  fi
}

is_safe_index_relative_path() {
  local path
  path=$(normalize_path "${1:-}")
  case "$path" in
    ""|/*|../*|*/../*|*"/.."|*"//"*)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

resolve_content_path_for_mode() {
  local path target
  path=$(normalize_path "${1:-}")
  is_safe_index_relative_path "$path" || return 1

  if [ "$MODE" != "staged" ]; then
    CONTENT_PATH_RESULT="$ROOT/$path"
    return 0
  fi

  if [ -n "${STAGED_CONTENT_READY[$path]:-}" ]; then
    CONTENT_PATH_RESULT="$STAGED_CONTENT_ROOT/$path"
    return 0
  fi

  if [ -z "$STAGED_CONTENT_ROOT" ]; then
    STAGED_CONTENT_ROOT=$(mktemp -d) || return 1
  fi
  if ! git -C "$ROOT" cat-file -e ":$path" 2>/dev/null; then
    return 1
  fi

  target="$STAGED_CONTENT_ROOT/$path"
  mkdir -p "$(dirname "$target")" || return 1
  if ! git -C "$ROOT" show ":$path" > "$target"; then
    rm -f "$target"
    return 1
  fi
  STAGED_CONTENT_READY["$path"]=1
  CONTENT_PATH_RESULT="$target"
}

resolve_content_root_for_mode() {
  if [ "$MODE" = "staged" ]; then
    if [ -z "$STAGED_CONTENT_ROOT" ]; then
      STAGED_CONTENT_ROOT=$(mktemp -d) || return 1
    fi
    CONTENT_ROOT_RESULT="$STAGED_CONTENT_ROOT"
    return 0
  fi

  CONTENT_ROOT_RESULT="$ROOT"
}
