#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: Product-Spec.md, DEV-PLAN.md, tools/INDEX.md, skills/dev-builder/SKILL.md
# Syncs with: tools/test-project-structure-check.sh, tools/test-doc-map.sh
# Lightweight structure checks for Web/Desktop projects under feature-first or legacy-incremental strategies.

set -euo pipefail

ROOT="."
PLATFORM="web"
STRATEGY="feature-first"
ERROR_COUNT=0
WARN_COUNT=0

usage() {
  cat <<'EOF'
Usage:
  bash ./tools/check-project-structure.sh --root <project-dir> --platform <web|desktop> --strategy <feature-first|legacy-incremental>

Notes:
  - Only Web/Desktop projects are checked.
  - `feature-first` is strict about `src/features/*`.
  - `legacy-incremental` uses relaxed checks for existing projects.
EOF
}

log_pass() {
  printf '[PASS] %s\n' "$1"
}

log_warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf '[WARN] %s\n' "$1"
}

log_fail() {
  ERROR_COUNT=$((ERROR_COUNT + 1))
  printf '[FAIL] %s\n' "$1" >&2
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --root)
        ROOT="${2:-}"
        shift 2
        ;;
      --platform)
        PLATFORM="${2:-}"
        shift 2
        ;;
      --strategy)
        STRATEGY="${2:-}"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        printf '[FAIL] Unknown argument: %s\n' "$1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done
}

extract_import_paths() {
  local file="$1"
  local line path
  local from_regex="from[[:space:]]*['\"]([^'\"]+)['\"]"
  local require_regex="require\\([[:space:]]*['\"]([^'\"]+)['\"]"

  while IFS= read -r line; do
    path=""

    if [[ "$line" =~ $from_regex ]]; then
      path="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ $require_regex ]]; then
      path="${BASH_REMATCH[1]}"
    fi

    if [ -n "$path" ]; then
      printf '%s\n' "$path"
    fi
  done < <(grep -E "^[[:space:]]*(import|export)[^;]*from[[:space:]]*['\"][^'\"]+['\"]|require\([[:space:]]*['\"][^'\"]+['\"]" "$file" || true)
}

is_js_like_file() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.mts|*.cts|*.mjs|*.cjs)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

collect_feature_names() {
  local features_dir="$1"

  if [ ! -d "$features_dir" ]; then
    return 0
  fi

  find "$features_dir" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort
}

is_valid_feature_public_import() {
  local suffix="$1"

  case "$suffix" in
    ""|index|index.ts|index.tsx|index.js|index.jsx|index.mjs|index.cjs)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

check_feature_first_root_layout() {
  local src_dir="$1"
  local features_dir="$src_dir/features"

  if [ ! -d "$features_dir" ]; then
    log_fail "feature-first 项目缺少 \`src/features\` 目录"
    return 0
  fi

  if ! find "$features_dir" -mindepth 1 -maxdepth 1 -type d | grep -q .; then
    log_fail "feature-first 项目的 \`src/features\` 下至少要有一个功能模块"
  else
    log_pass "feature-first 项目存在 \`src/features/*\`"
  fi

  for path in "$src_dir/components" "$src_dir/hooks" "$src_dir/lib"; do
    if [ -d "$path" ]; then
      log_fail "feature-first 项目不应继续把业务代码散落在顶层目录：${path#"$ROOT"/}"
    fi
  done
}

check_page_shell_imports() {
  local src_dir="$1"
  local file import_path

  while IFS= read -r -d '' file; do
    while IFS= read -r import_path; do
      case "$import_path" in
        "@/components"|@/components/*|@/hooks|@/hooks/*|@/lib|@/lib/*|../components|../components/*|../../components|../../components/*|../../../components|../../../components/*|../hooks|../hooks/*|../../hooks|../../hooks/*|../../../hooks|../../../hooks/*|../lib|../lib/*|../../lib|../../lib/*|../../../lib|../../../lib/*)
          log_fail "页面层文件 ${file#"$ROOT"/} 直接依赖了顶层业务目录：$import_path"
          ;;
      esac
    done < <(extract_import_paths "$file")
  done < <(
    {
      if [ -d "$src_dir/app" ]; then
        find "$src_dir/app" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) ! -path "$src_dir/app/api/*" -print0
      fi

      if [ -d "$src_dir/pages" ]; then
        find "$src_dir/pages" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print0
      fi
    }
  )
}

check_cross_feature_imports() {
  local src_dir="$1"
  local features_dir="$src_dir/features"
  local file current_feature import_path import_without_prefix other_feature suffix resolved target_feature target_suffix

  [ -d "$features_dir" ] || return 0

  while IFS= read -r -d '' file; do
    current_feature="${file#"$features_dir"/}"
    current_feature="${current_feature%%/*}"

    while IFS= read -r import_path; do
      case "$import_path" in
        "@/features/"*|features/*)
          import_without_prefix="${import_path#@/}"
          import_without_prefix="${import_without_prefix#features/}"
          other_feature="${import_without_prefix%%/*}"

          if [ -n "$other_feature" ] && [ "$other_feature" != "$current_feature" ]; then
            suffix="${import_without_prefix#"$other_feature"}"
            suffix="${suffix#/}"

            if ! is_valid_feature_public_import "$suffix"; then
              log_fail "功能模块 ${current_feature} 直连了 ${other_feature} 的内部实现：${file#"$ROOT"/} -> $import_path"
            fi
          fi
          ;;
        ./*|../*)
          if command -v realpath >/dev/null 2>&1; then
            resolved=$(realpath -m "$(dirname "$file")/$import_path")
            case "$resolved" in
              "$features_dir"/*)
                target_feature="${resolved#"$features_dir"/}"
                target_feature="${target_feature%%/*}"

                if [ -n "$target_feature" ] && [ "$target_feature" != "$current_feature" ]; then
                  target_suffix="${resolved#"$features_dir/$target_feature"}"
                  target_suffix="${target_suffix#/}"

                  if ! is_valid_feature_public_import "$target_suffix"; then
                    log_fail "功能模块 ${current_feature} 通过相对路径直连了 ${target_feature} 的内部实现：${file#"$ROOT"/} -> $import_path"
                  fi
                fi
                ;;
            esac
          fi
          ;;
      esac
    done < <(extract_import_paths "$file")
  done < <(find "$features_dir" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mts' -o -name '*.cts' -o -name '*.mjs' -o -name '*.cjs' \) -print0)
}

check_shared_warnings() {
  local src_dir="$1"
  local shared_dir="$src_dir/shared"
  local features_dir="$src_dir/features"
  local feature

  [ -d "$shared_dir" ] || return 0
  [ -d "$features_dir" ] || return 0

  while IFS= read -r feature; do
    [ -n "$feature" ] || continue

    if find "$shared_dir" -mindepth 1 \
      \( -path "$shared_dir/$feature" -o -path "$shared_dir/$feature/*" -o -name "${feature}-*" -o -name "${feature}_*" \) \
      | grep -q .; then
      log_warn "'shared/*' 里出现了明显带有单功能特征的路径（${feature}）；确认它是否真的被多个 feature 复用"
    fi
  done < <(collect_feature_names "$features_dir")
}

main() {
  local src_dir

  parse_args "$@"

  case "$PLATFORM" in
    web|desktop)
      ;;
    *)
      printf '[SKIP] Platform %s is out of scope for this checker.\n' "$PLATFORM"
      exit 0
      ;;
  esac

  case "$STRATEGY" in
    feature-first|legacy-incremental)
      ;;
    *)
      printf '[FAIL] Unsupported strategy: %s\n' "$STRATEGY" >&2
      exit 1
      ;;
  esac

  if [ ! -d "$ROOT" ]; then
    printf '[FAIL] Root path does not exist: %s\n' "$ROOT" >&2
    exit 1
  fi

  src_dir="$ROOT/src"
  if [ ! -d "$src_dir" ]; then
    printf '[FAIL] Missing src directory under %s\n' "$ROOT" >&2
    exit 1
  fi

  if [ "$STRATEGY" = "feature-first" ]; then
    check_feature_first_root_layout "$src_dir"
    check_page_shell_imports "$src_dir"
  else
    log_pass "legacy-incremental 使用宽松模式；保留旧结构，但仍检查 feature 模块越界"
  fi

  check_cross_feature_imports "$src_dir"
  check_shared_warnings "$src_dir"

  if [ "$ERROR_COUNT" -gt 0 ]; then
    printf '[FAIL] Structure check failed with %s error(s) and %s warning(s).\n' "$ERROR_COUNT" "$WARN_COUNT" >&2
    exit 1
  fi

  printf '[PASS] Structure check passed with %s warning(s).\n' "$WARN_COUNT"
}

main "$@"
