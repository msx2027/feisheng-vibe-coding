#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: tools/terminology-path-helpers.sh, tools/terminology-content-helpers.sh, tools/doc-sync-helpers.sh, Product-Spec.md, DEV-PLAN.md, tools/INDEX.md
# Syncs with: tools/terminology-gate.sh, tools/test-terminology-consistency.sh, tools/test-terminology-gate.sh
# Checks strict terminology registry + DEV-PLAN change list consistency in repo/staged mode.

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck disable=SC1091
source "$SCRIPT_DIR/terminology-path-helpers.sh"

ROOT="."
MODE="repo"
ERROR_COUNT=0
WARN_COUNT=0
SOFT_FAIL_COUNT=0
FAIL_AS_WARN=0

SPEC_SECTION_TITLE="## 术语与命名规范"
PLAN_SECTION_TITLE="## 术语对齐"
PLAN_CHANGE_SUBSECTION_TITLE="### 本轮术语变更清单"
TERMINOLOGY_TABLE_SECTION_TITLE="## 默认术语表"

EXPECTED_REGISTRY_HEADER="对象ID|类别|统一口径|禁用别名|代码命名映射|适用范围|状态|说明"
EXPECTED_CHANGE_HEADER="对象ID|变更类型|影响范围|必须回写文件|完成状态"

declare -A SPEC_IDS=()
declare -A SPEC_STATUS_BY_ID=()
declare -A CODE_MAPPING_BY_ID=()
declare -A CODE_MAPPING_SEEN=()
declare -A FORBIDDEN_ALIAS_TO_CANONICAL=()
declare -A CODE_NAME_FAMILY_SET=()
declare -A REPO_MAIN_DOC_IGNORED_LINE_KEYS=()
declare -A REPO_MAIN_DOC_IGNORED_LINES_READY=()
declare -A SVG_TEXT_GITATTRIBUTES_SET=()
declare -A SVG_TEXT_CONTRACT_SET=()

declare -a REGISTRY_ROWS=()
declare -a CHANGE_ROWS=()

declare -a SCAN_TARGETS=()
declare -a STAGED_DOC_FILES=()
declare -a STAGED_BEHAVIOR_FILES=()
declare -a STAGED_ADDED_BEHAVIOR_FILES=()
HELPERS_READY=0
STAGED_FILES_READY=0
REGISTRY_READY=0
CHANGE_LIST_READY=0
SVG_TEXT_CONTRACT_READY=0
STAGED_CONTENT_ROOT=""
declare -A STAGED_CONTENT_READY=()
CONTENT_PATH_RESULT=""
CONTENT_ROOT_RESULT=""
# shellcheck disable=SC1091
source "$SCRIPT_DIR/terminology-content-helpers.sh"

trap cleanup_staged_content_root EXIT

usage() {
  cat <<'EOF'
Usage:
  bash ./tools/check-terminology-consistency.sh --root <project-root> [--mode repo|staged]

Mode:
  repo   Validate required sections + strict table schema + full-repo forbidden alias leakage baseline.
  staged Validate hard-block rules on staged docs/behavior scope. If neither staged docs nor behavior changes exist, exits 0.
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
  if [ "$FAIL_AS_WARN" -eq 1 ]; then
    SOFT_FAIL_COUNT=$((SOFT_FAIL_COUNT + 1))
    WARN_COUNT=$((WARN_COUNT + 1))
    printf '[WARN] %s\n' "$1"
    return 0
  fi

  ERROR_COUNT=$((ERROR_COUNT + 1))
  printf '[FAIL] %s\n' "$1" >&2
}

load_svg_text_contract() {
  local gitattributes_path editorconfig_path
  local line normalized_line rule_key path

  if [ "$SVG_TEXT_CONTRACT_READY" -eq 1 ]; then
    return 0
  fi

  if resolve_content_path_for_mode ".gitattributes"; then
    gitattributes_path="$CONTENT_PATH_RESULT"
  else
    gitattributes_path=""
  fi
  if resolve_content_path_for_mode ".editorconfig"; then
    editorconfig_path="$CONTENT_PATH_RESULT"
  else
    editorconfig_path=""
  fi

  if [ -f "$gitattributes_path" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      normalized_line=$(normalize_rule_line "$line")

      case "$normalized_line" in
        ""|\#*)
          continue
          ;;
      esac

      rule_key=$(normalize_contract_path "${normalized_line%% *}")
      case "$rule_key" in
        *.svg) ;;
        *)
          continue
          ;;
      esac

      if path_has_glob_syntax "$rule_key"; then
        continue
      fi

      if gitattributes_rule_marks_text "$normalized_line"; then
        SVG_TEXT_GITATTRIBUTES_SET["$rule_key"]=1
      fi
    done < "$gitattributes_path"
  fi

  if [ -f "$editorconfig_path" ]; then
    for path in "${!SVG_TEXT_GITATTRIBUTES_SET[@]}"; do
      if editorconfig_path_has_repo_text_settings "$editorconfig_path" "$path"; then
        SVG_TEXT_CONTRACT_SET["$path"]=1
      fi
    done
  fi

  SVG_TEXT_CONTRACT_READY=1
}

is_separator_cell() {
  local cell
  cell=$(trim "$1")
  [[ "$cell" =~ ^:?-{3,}:?$ ]]
}

is_nil_value() {
  local value
  value=$(trim "${1:-}")
  case "$value" in
    ""|"-"|"无"|"N/A"|"n/a"|"NA"|"na")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}


path_is_staged_scope() {
  local candidate="$1"
  local path

  for path in "${STAGED_DOC_FILES[@]}" "${STAGED_BEHAVIOR_FILES[@]}"; do
    if [ "$path" = "$candidate" ]; then
      return 0
    fi
  done

  return 1
}

is_warn_only_path() {
  local path="$1"

  case "$path" in
    plans/archive/*)
      return 0
      ;;
    *example*|*examples/*|*sample*|*fixture*)
      if declare -F is_terminology_repo_behavior_path >/dev/null 2>&1; then
        if is_terminology_repo_behavior_path "$path"; then
          return 1
        fi
      fi
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_terminology_excluded_asset_path() {
  local path="$1"

  case "$path" in
    *.csv|*.tsbuildinfo|*.ttf|*.otf|*.woff|*.woff2|*.eot|*.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.pdf|*.zip|*.tar|*.tgz|*.gz|*.bz2|*.xz|*.7z|*.rar|*.mp3|*.mp4|*.mov|*.avi|*.wav|*.flac|*.ogg|*.db|*.sqlite|*.sqlite3)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_terminology_text_path() {
  local path="$1"

  case "$path" in
    *.md|*.mdx|*.mmd|*.txt|*.json|*.yaml|*.yml|*.toml|*.sh|*.bash|*.zsh|*.ps1|*.psm1|*.py|*.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx|*.mts|*.cts|*.html|*.css|*.scss|*.sass|*.less|*.xml|*.svg|*.ini|*.cfg|*.conf|*/pre-commit|*/pre-push|*/commit-msg|Dockerfile|Makefile|LICENSE|NOTICE)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_terminology_explicit_text_asset_path() {
  local path
  path=$(normalize_contract_path "${1:-}")

  [ -n "$path" ] || return 1

  load_svg_text_contract
  [ -n "${SVG_TEXT_CONTRACT_SET[$path]:-}" ]
}

is_terminology_scan_target() {
  local path content_path
  path=$(normalize_path "${1:-}")

  [ -n "$path" ] || return 1

  resolve_content_path_for_mode "$path" || return 1
  content_path="$CONTENT_PATH_RESULT"
  [ -f "$content_path" ] || return 1

  if is_terminology_explicit_text_asset_path "$path"; then
    return 0
  fi

  if is_terminology_excluded_asset_path "$path"; then
    return 1
  fi

  if ! is_terminology_text_path "$path"; then
    return 1
  fi

  return 0
}

is_terminology_staged_scan_target() {
  local path content_path
  path=$(normalize_path "${1:-}")

  [ -n "$path" ] || return 1

  resolve_content_path_for_mode "$path" || return 1
  content_path="$CONTENT_PATH_RESULT"
  [ -f "$content_path" ] || return 1

  if is_terminology_explicit_text_asset_path "$path"; then
    return 0
  fi

  if is_terminology_excluded_asset_path "$path"; then
    return 1
  fi

  if ! is_terminology_text_path "$path"; then
    return 1
  fi

  if declare -F doc_sync_is_doc_path >/dev/null 2>&1; then
    if doc_sync_is_doc_path "$path" || doc_sync_is_behavior_path "$path"; then
      return 0
    fi
    return 1
  fi

  return 0
}

is_terminology_repo_excluded_path() {
  local path="$1"

  case "$path" in
    *.csv|*.tsbuildinfo|*.ttf|*.otf|*.woff|*.woff2|*.eot|*.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.pdf|*.zip|*.tar|*.tgz|*.gz|*.bz2|*.xz|*.7z|*.rar|*.mp3|*.mp4|*.mov|*.avi|*.wav|*.flac|*.ogg|*.db|*.sqlite|*.sqlite3|*.svg)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_terminology_repo_doc_path() {
  local path="$1"

  if [[ "$path" == *.mmd && "$path" != */* ]]; then
    return 0
  fi

  case "$path" in
    README.md|CHANGELOG.md|CONTRIBUTING.md|Product-Spec.md|Product-Spec-CHANGELOG.md|DEV-PLAN.md|Design-Brief.md|DOC-MAP.md|AGENTS.md|CLAUDE.md|TERMINOLOGY-AND-NAMING.md|docs/*.md|docs/*.mdx|docs/*.mmd|docs/*.txt|plans/*.md|plans/*.mdx|plans/*.mmd|plans/*.txt|skills/*.md|skills/*.mdx|skills/*.mmd|agents/*.md|agents/*.mdx|agents/*.mmd|hooks/*.md|hooks/*.mdx|hooks/*.mmd|codex-hooks/*.md|codex-hooks/*.mdx|codex-hooks/*.mmd|tools/*.md|tools/*.mdx|tools/*.mmd)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_terminology_repo_behavior_path() {
  local path="$1"

  if declare -F doc_sync_is_behavior_path >/dev/null 2>&1; then
    if ! doc_sync_is_behavior_path "$path"; then
      return 1
    fi
  else
    case "$path" in
      tools/*|skills/*|agents/*|hooks/*|codex-hooks/*|.githooks/*|settings.json|codex-hooks.json|*.json|*.yaml|*.yml|*.toml|*.sh|*.bash|*.zsh|*.ps1|*.psm1|*.py|*.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx|*.mts|*.cts|*.html|*.css|*.scss|*.sass|*.less|*.xml|*.ini|*.cfg|*.conf) ;;
      *)
        return 1
        ;;
    esac
  fi

  case "$path" in
    *.json|*.yaml|*.yml|*.toml|*.sh|*.bash|*.zsh|*.ps1|*.psm1|*.py|*.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx|*.mts|*.cts|*.html|*.css|*.scss|*.sass|*.less|*.xml|*.ini|*.cfg|*.conf|*/pre-commit|*/pre-push|*/commit-msg|Dockerfile|Makefile)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_terminology_repo_scan_target() {
  local path content_path
  path=$(normalize_path "${1:-}")

  [ -n "$path" ] || return 1

  resolve_content_path_for_mode "$path" || return 1
  content_path="$CONTENT_PATH_RESULT"
  [ -f "$content_path" ] || return 1

  if is_terminology_explicit_text_asset_path "$path"; then
    return 0
  fi

  if is_terminology_repo_excluded_path "$path"; then
    return 1
  fi

  if is_terminology_repo_doc_path "$path" || is_terminology_repo_behavior_path "$path"; then
    return 0
  fi

  return 1
}

table_line_to_tsv() {
  local line="$1"
  printf '%s\n' "$line" | awk -F'|' '
    {
      first = 1
      for (i = 2; i < NF; i++) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $i)
        if (first == 0) {
          printf "\t"
        }
        printf "%s", $i
        first = 0
      }
      printf "\n"
    }
  '
}

read_table_cells() {
  local line="$1"
  mapfile -t TABLE_CELLS < <(
    printf '%s\n' "$line" | awk -F'|' '
      {
        for (i = 2; i < NF; i++) {
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", $i)
          print $i
        }
      }
    '
  )
}

join_cells_with_pipe() {
  local -a cells=("$@")
  local out="" cell
  for cell in "${cells[@]}"; do
    if [ -n "$out" ]; then
      out="${out}|"
    fi
    out="${out}${cell}"
  done
  printf '%s\n' "$out"
}

derive_code_name_family() {
  local snake="$1"
  local camel="" pascal="" upper="" kebab="" word first=1

  if [[ ! "$snake" =~ ^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]$ ]]; then
    return 0
  fi

  kebab=${snake//_/-}
  upper=$(printf '%s' "$snake" | tr '[:lower:]' '[:upper:]')

  IFS='_' read -r -a words <<<"$snake"
  for word in "${words[@]}"; do
    [ -n "$word" ] || continue
    if [ $first -eq 1 ]; then
      camel="$word"
      first=0
    else
      camel="${camel}$(printf '%s' "$word" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')"
    fi
  done
  pascal="$(printf '%s' "$camel" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')"

  CODE_NAME_FAMILY_SET["$snake"]=1
  CODE_NAME_FAMILY_SET["$kebab"]=1
  CODE_NAME_FAMILY_SET["$upper"]=1
  CODE_NAME_FAMILY_SET["$camel"]=1
  CODE_NAME_FAMILY_SET["$pascal"]=1
}

split_aliases() {
  local raw="$1"
  if command -v perl >/dev/null 2>&1; then
    RAW_ALIAS_TEXT="$raw" perl -MEncode=decode -CS -e '
      my $text = decode("UTF-8", $ENV{RAW_ALIAS_TEXT} // q{});
      $text =~ s/[\x{3001}\x{FF0C}\x{FF1B};\/]/\n/g;
      print $text;
    '
    return 0
  fi

  printf '%s' "$raw" | sed 's/[;\/]/\n/g'
}

extract_aliases_from_registry_line() {
  local registry_line="$1"

  RAW_REGISTRY_LINE="$registry_line" perl -MEncode=decode -CS -e '
    my $line = decode("UTF-8", $ENV{RAW_REGISTRY_LINE} // q{});
    my @cells = ($line =~ /\|([^|]*)/g);
    exit 0 if @cells < 4;

    my $aliases = $cells[3];
    $aliases =~ s/^\s+|\s+$//g;
    exit 0 if $aliases eq q{} || $aliases eq q{-} || $aliases eq q{无} || lc($aliases) eq q{n/a};

    for my $alias (split(/[\x{3001}\x{FF0C}\x{FF1B};\/]/, $aliases)) {
      $alias =~ s/^\s+|\s+$//g;
      next if $alias eq q{};
      print $alias, "\n";
    }
  '
}

extract_section_block() {
  local file_path="$1"
  local section_title="$2"

  awk -v section="$section_title" '
    $0 == section { in_section=1; next }
    /^## / && in_section == 1 { exit }
    in_section == 1 { print }
  ' "$file_path"
}

extract_subsection_block() {
  local file_path="$1"
  local subsection_title="$2"

  awk -v section="$subsection_title" '
    $0 == section { in_section=1; next }
    /^### / && in_section == 1 { exit }
    /^## / && in_section == 1 { exit }
    in_section == 1 { print }
  ' "$file_path"
}

extract_subsection_block_from_text() {
  local subsection_title="$1"

  awk -v section="$subsection_title" '
    $0 == section { in_section=1; next }
    /^### / && in_section == 1 { exit }
    /^## / && in_section == 1 { exit }
    in_section == 1 { print }
  '
}

extract_first_table() {
  awk '
    BEGIN { in_table=0 }
    /^\|/ {
      print
      in_table=1
      next
    }
    in_table == 1 { exit }
  '
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --root)
        if [ $# -lt 2 ] || [ -z "${2:-}" ] || [[ "${2:-}" == --* ]]; then
          printf '[FAIL] Missing value for --root\n' >&2
          usage >&2
          exit 1
        fi
        ROOT="${2:-}"
        shift 2
        ;;
      --mode)
        if [ $# -lt 2 ] || [ -z "${2:-}" ] || [[ "${2:-}" == --* ]]; then
          printf '[FAIL] Missing value for --mode\n' >&2
          usage >&2
          exit 1
        fi
        MODE="${2:-}"
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

  case "$MODE" in
    repo|staged) ;;
    *)
      printf '[FAIL] Invalid --mode: %s (expected repo|staged)\n' "$MODE" >&2
      exit 1
      ;;
  esac
}

load_helpers() {
  local helpers="$ROOT/tools/doc-sync-helpers.sh"
  if [ ! -f "$helpers" ]; then
    log_fail "缺少 tools/doc-sync-helpers.sh，无法做路径分类。"
    return 1
  fi
  # shellcheck disable=SC1090
  source "$helpers"
  HELPERS_READY=1
}

collect_staged_files() {
  local status old_path new_path normalized

  STAGED_DOC_FILES=()
  STAGED_BEHAVIOR_FILES=()
  STAGED_ADDED_BEHAVIOR_FILES=()
  STAGED_FILES_READY=0

  if ! command -v git >/dev/null 2>&1; then
    log_fail "staged 模式需要 git 命令。"
    return 1
  fi

  if ! git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    log_fail "staged 模式要求 --root 是 git 仓库。"
    return 1
  fi

  while IFS= read -r -d '' status; do
    case "$status" in
      R*|C*)
        IFS= read -r -d '' old_path || break
        IFS= read -r -d '' new_path || break
        old_path=$(normalize_path "$old_path")
        new_path=$(normalize_path "$new_path")

        if doc_sync_is_doc_path "$new_path"; then
          STAGED_DOC_FILES+=("$new_path")
        fi
        if doc_sync_is_behavior_path "$new_path"; then
          STAGED_BEHAVIOR_FILES+=("$new_path")
          STAGED_ADDED_BEHAVIOR_FILES+=("$new_path")
        fi
        if doc_sync_is_behavior_path "$old_path"; then
          STAGED_BEHAVIOR_FILES+=("$old_path")
        fi
        ;;
      *)
        IFS= read -r -d '' new_path || break
        normalized=$(normalize_path "$new_path")
        if doc_sync_is_doc_path "$normalized"; then
          STAGED_DOC_FILES+=("$normalized")
        fi
        if doc_sync_is_behavior_path "$normalized"; then
          STAGED_BEHAVIOR_FILES+=("$normalized")
          if [ "$status" = "A" ]; then
            STAGED_ADDED_BEHAVIOR_FILES+=("$normalized")
          fi
        fi
        ;;
    esac
  done < <(git -C "$ROOT" diff --cached --name-status -z --diff-filter=ACMRD)

  STAGED_FILES_READY=1
}

collect_scan_targets_repo() {
  local abs_path rel_path
  SCAN_TARGETS=()

  while IFS= read -r abs_path; do
    rel_path="${abs_path#"$ROOT"/}"
    rel_path=$(normalize_path "$rel_path")
    if is_terminology_repo_scan_target "$rel_path"; then
      SCAN_TARGETS+=("$rel_path")
    fi
  done < <(
    find "$ROOT" \
      \( -path "$ROOT/.git" -o -path "$ROOT/.git/*" \
        -o -path "$ROOT/node_modules" -o -path "$ROOT/node_modules/*" \
        -o -path "$ROOT/.next" -o -path "$ROOT/.next/*" \
        -o -path "$ROOT/dist" -o -path "$ROOT/dist/*" \
        -o -path "$ROOT/build" -o -path "$ROOT/build/*" \
        -o -path "$ROOT/.claude" -o -path "$ROOT/.claude/*" \
        -o -path "$ROOT/.agents" -o -path "$ROOT/.agents/*" \
        -o -path "$ROOT/.codex" -o -path "$ROOT/.codex/*" \
        -o -path "$ROOT/skills/ui-styling/canvas-fonts" -o -path "$ROOT/skills/ui-styling/canvas-fonts/*" \
        -o -path "$ROOT/skills/ui-ux-pro-max/data" -o -path "$ROOT/skills/ui-ux-pro-max/data/*" \) -prune \
      -o -type f -print
  )
}

collect_first_table_line_numbers_in_section() {
  local file_path="$1"
  local section_title="$2"

  awk -v section="$section_title" '
    $0 == section { in_section=1; next }
    /^## / && in_section == 1 { exit }
    in_section == 1 {
      if ($0 ~ /^[[:space:]]*\|.*\|[[:space:]]*$/) {
        print NR
        in_table=1
        next
      }
      if (in_table == 1) { exit }
    }
  ' "$file_path"
}

collect_first_table_line_numbers_in_subsection() {
  local file_path="$1"
  local section_title="$2"
  local subsection_title="$3"

  awk -v section="$section_title" -v subsection="$subsection_title" '
    $0 == section { in_section=1; next }
    /^## / && in_section == 1 { exit }
    in_section == 1 && $0 == subsection { in_subsection=1; next }
    in_section == 1 && /^### / && in_subsection == 1 { exit }
    in_section == 1 && in_subsection == 1 {
      if ($0 ~ /^[[:space:]]*\|.*\|[[:space:]]*$/) {
        print NR
        in_table=1
        next
      }
      if (in_table == 1) { exit }
    }
  ' "$file_path"
}

populate_repo_main_doc_ignored_lines() {
  local path="$1"
  local file_path line_number

  if [ -n "${REPO_MAIN_DOC_IGNORED_LINES_READY[$path]:-}" ]; then
    return 0
  fi

  if ! resolve_content_path_for_mode "$path"; then
    REPO_MAIN_DOC_IGNORED_LINES_READY["$path"]=1
    return 0
  fi
  file_path="$CONTENT_PATH_RESULT"
  if [ ! -f "$file_path" ]; then
    REPO_MAIN_DOC_IGNORED_LINES_READY["$path"]=1
    return 0
  fi

  case "$path" in
    Product-Spec.md)
      while IFS= read -r line_number; do
        [ -n "$line_number" ] || continue
        REPO_MAIN_DOC_IGNORED_LINE_KEYS["$path:$line_number"]=1
      done < <(collect_first_table_line_numbers_in_section "$file_path" "$SPEC_SECTION_TITLE")
      ;;
    DEV-PLAN.md)
      while IFS= read -r line_number; do
        [ -n "$line_number" ] || continue
        REPO_MAIN_DOC_IGNORED_LINE_KEYS["$path:$line_number"]=1
      done < <(collect_first_table_line_numbers_in_subsection "$file_path" "$PLAN_SECTION_TITLE" "$PLAN_CHANGE_SUBSECTION_TITLE")
      ;;
    TERMINOLOGY-AND-NAMING.md)
      while IFS= read -r line_number; do
        [ -n "$line_number" ] || continue
        REPO_MAIN_DOC_IGNORED_LINE_KEYS["$path:$line_number"]=1
      done < <(collect_first_table_line_numbers_in_section "$file_path" "$TERMINOLOGY_TABLE_SECTION_TITLE")
      ;;
  esac

  REPO_MAIN_DOC_IGNORED_LINES_READY["$path"]=1
}

is_repo_main_doc_ignored_line() {
  local path="$1"
  local line_number="$2"

  case "$path" in
    Product-Spec.md|DEV-PLAN.md|TERMINOLOGY-AND-NAMING.md)
      populate_repo_main_doc_ignored_lines "$path"
      [ -n "${REPO_MAIN_DOC_IGNORED_LINE_KEYS["$path:$line_number"]:-}" ]
      return
      ;;
  esac

  return 1
}

collect_scan_targets_staged() {
  local path
  SCAN_TARGETS=()

  for path in "${STAGED_DOC_FILES[@]}" "${STAGED_BEHAVIOR_FILES[@]}"; do
    case "$path" in
      ""|plans/archive/*)
        continue
        ;;
    esac
    if is_terminology_staged_scan_target "$path"; then
      SCAN_TARGETS+=("$path")
    fi
  done
}

validate_main_doc_for_mode() {
  local mode_path="$1" content_path
  local validator="$2"
  local previous_fail_as_warn="$FAIL_AS_WARN"

  if [ "$MODE" = "staged" ] && ! path_is_staged_scope "$mode_path"; then
    FAIL_AS_WARN=1
    if resolve_content_path_for_mode "$mode_path"; then
      "$validator" "$CONTENT_PATH_RESULT" || true
    else
      log_fail "$mode_path 在 Git index 中不存在。"
    fi
    FAIL_AS_WARN="$previous_fail_as_warn"
    return 0
  fi

  if ! resolve_content_path_for_mode "$mode_path"; then
    log_fail "$mode_path 在 Git index 中不存在。"
    return 1
  fi
  content_path="$CONTENT_PATH_RESULT"
  "$validator" "$content_path"
}

validate_registry_table() {
  local spec_path="$1"
  local section_block table_block row_count=0
  local line normalized_header
  local errors_before="$ERROR_COUNT"
  local soft_fail_before="$SOFT_FAIL_COUNT"

  REGISTRY_READY=0

  section_block=$(extract_section_block "$spec_path" "$SPEC_SECTION_TITLE")
  if [ -z "$section_block" ]; then
    log_fail "Product-Spec.md 缺少“术语与命名规范”章节。"
    return 1
  fi

  table_block=$(printf '%s\n' "$section_block" | extract_first_table)
  if [ -z "$table_block" ]; then
    log_fail "Product-Spec.md 的“术语与命名规范”缺少表格。"
    return 1
  fi

  REGISTRY_ROWS=()
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    REGISTRY_ROWS+=("$line")
  done <<<"$table_block"

  if [ "${#REGISTRY_ROWS[@]}" -lt 3 ]; then
    log_fail "术语注册表至少需要表头、分隔行和 1 条数据行。"
    return 1
  fi

  read_table_cells "${REGISTRY_ROWS[0]}"
  normalized_header=$(join_cells_with_pipe "${TABLE_CELLS[@]}")
  if [ "$normalized_header" != "$EXPECTED_REGISTRY_HEADER" ]; then
    log_fail "术语注册表表头不合法。必须是：$EXPECTED_REGISTRY_HEADER"
  fi

  local object_id category canonical forbidden_aliases code_mapping scope status notes
  local alias
  local -A seen_ids=()
  local index

  for (( index=1; index<${#REGISTRY_ROWS[@]}; index++ )); do
    line="${REGISTRY_ROWS[$index]}"
    read_table_cells "$line"

    if [ "${#TABLE_CELLS[@]}" -eq 0 ]; then
      continue
    fi

    if is_separator_cell "${TABLE_CELLS[0]}"; then
      continue
    fi

    if [ "${#TABLE_CELLS[@]}" -ne 8 ]; then
      log_fail "术语注册表第 $((index + 1)) 行列数错误，期望 8 列。"
      continue
    fi

    object_id=$(trim "${TABLE_CELLS[0]}")
    category=$(trim "${TABLE_CELLS[1]}")
    canonical=$(trim "${TABLE_CELLS[2]}")
    forbidden_aliases=$(trim "${TABLE_CELLS[3]}")
    code_mapping=$(trim "${TABLE_CELLS[4]}")
    scope=$(trim "${TABLE_CELLS[5]}")
    status=$(trim "${TABLE_CELLS[6]}")
    notes=$(trim "${TABLE_CELLS[7]}")

    row_count=$((row_count + 1))

    if [ -z "$object_id" ] || [ -z "$category" ] || [ -z "$canonical" ] || [ -z "$code_mapping" ] || [ -z "$scope" ] || [ -z "$status" ] || [ -z "$notes" ]; then
      log_fail "术语注册表第 $((index + 1)) 行存在必填字段为空。"
      continue
    fi

    if [[ ! "$object_id" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
      log_fail "对象ID '$object_id' 不符合 kebab-case。"
    fi

    case "$category" in
      核心对象|页面|状态|动作|模块|公开文案) ;;
      *)
        log_fail "对象ID '$object_id' 的类别 '$category' 非法。"
        ;;
    esac

    case "$status" in
      active|deprecated) ;;
      *)
        log_fail "对象ID '$object_id' 的状态 '$status' 非法。"
        ;;
    esac

    if [[ ! "$code_mapping" =~ ^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]$ ]]; then
      log_fail "对象ID '$object_id' 的代码命名映射 '$code_mapping' 不是 canonical snake_case。"
    fi

    if [ -n "${seen_ids[$object_id]:-}" ]; then
      log_fail "对象ID 重复：$object_id"
    else
      seen_ids["$object_id"]=1
      SPEC_IDS["$object_id"]=1
      SPEC_STATUS_BY_ID["$object_id"]="$status"
      CODE_MAPPING_BY_ID["$object_id"]="$code_mapping"
    fi

    if [ -n "${CODE_MAPPING_SEEN[$code_mapping]:-}" ]; then
      log_fail "代码命名映射重复：$code_mapping"
    else
      CODE_MAPPING_SEEN["$code_mapping"]=1
    fi

    derive_code_name_family "$code_mapping"

    while IFS= read -r alias; do
      alias=$(trim "$alias")
      [ -n "$alias" ] || continue
      FORBIDDEN_ALIAS_TO_CANONICAL["$alias"]="$canonical"
    done < <(extract_aliases_from_registry_line "$line")
  done

  if [ "$row_count" -eq 0 ]; then
    log_fail "术语注册表缺少数据行。"
    return 1
  fi

  if [ "$ERROR_COUNT" -eq "$errors_before" ] && [ "$SOFT_FAIL_COUNT" -eq "$soft_fail_before" ]; then
    REGISTRY_READY=1
    log_pass "术语注册表结构合法。"
  fi
}

validate_change_list_table() {
  local plan_path="$1"
  local section_block sub_section_block table_block line normalized_header
  local object_id change_type impact required_files done_status
  local row_count=0 index
  local errors_before="$ERROR_COUNT"
  local soft_fail_before="$SOFT_FAIL_COUNT"

  CHANGE_LIST_READY=0

  if [ ! -f "$plan_path" ]; then
    log_fail "缺少 DEV-PLAN.md。"
    return 1
  fi

  section_block=$(extract_section_block "$plan_path" "$PLAN_SECTION_TITLE")
  if [ -z "$section_block" ]; then
    log_fail "DEV-PLAN.md 缺少“术语对齐”章节。"
    return 1
  fi

  sub_section_block=$(printf '%s\n' "$section_block" | extract_subsection_block_from_text "$PLAN_CHANGE_SUBSECTION_TITLE")
  if [ -z "$sub_section_block" ]; then
    log_fail "DEV-PLAN.md 缺少“本轮术语变更清单”子表。"
    return 1
  fi

  table_block=$(printf '%s\n' "$sub_section_block" | extract_first_table)
  if [ -z "$table_block" ]; then
    log_fail "本轮术语变更清单缺少表格。"
    return 1
  fi

  CHANGE_ROWS=()
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    CHANGE_ROWS+=("$line")
  done <<<"$table_block"

  if [ "${#CHANGE_ROWS[@]}" -lt 3 ]; then
    log_fail "本轮术语变更清单至少需要表头、分隔行和 1 条数据行。"
    return 1
  fi

  read_table_cells "${CHANGE_ROWS[0]}"
  normalized_header=$(join_cells_with_pipe "${TABLE_CELLS[@]}")
  if [ "$normalized_header" != "$EXPECTED_CHANGE_HEADER" ]; then
    log_fail "本轮术语变更清单表头不合法。必须是：$EXPECTED_CHANGE_HEADER"
  fi

  for (( index=1; index<${#CHANGE_ROWS[@]}; index++ )); do
    line="${CHANGE_ROWS[$index]}"
    read_table_cells "$line"
    if [ "${#TABLE_CELLS[@]}" -eq 0 ]; then
      continue
    fi
    if is_separator_cell "${TABLE_CELLS[0]}"; then
      continue
    fi

    if [ "${#TABLE_CELLS[@]}" -ne 5 ]; then
      log_fail "变更清单第 $((index + 1)) 行列数错误，期望 5 列。"
      continue
    fi

    object_id=$(trim "${TABLE_CELLS[0]}")
    change_type=$(trim "${TABLE_CELLS[1]}")
    impact=$(trim "${TABLE_CELLS[2]}")
    required_files=$(trim "${TABLE_CELLS[3]}")
    done_status=$(trim "${TABLE_CELLS[4]}")
    row_count=$((row_count + 1))

    if [ -z "$object_id" ] || [ -z "$change_type" ] || [ -z "$impact" ] || [ -z "$required_files" ] || [ -z "$done_status" ]; then
      log_fail "变更清单第 $((index + 1)) 行存在必填字段为空。"
      continue
    fi

    case "$change_type" in
      新增|重命名|废弃|沿用) ;;
      *)
        log_fail "变更清单对象ID '$object_id' 的变更类型 '$change_type' 非法。"
        ;;
    esac

    case "$done_status" in
      todo|doing|blocked|done) ;;
      *)
        log_fail "变更清单对象ID '$object_id' 的完成状态 '$done_status' 非法。"
        ;;
    esac

    if [ -z "${SPEC_IDS[$object_id]:-}" ]; then
      if [ "$change_type" = "新增" ] || [ "$change_type" = "重命名" ] || [ "$change_type" = "废弃" ]; then
        log_fail "变更清单声明 '$change_type'（对象ID: $object_id），但 Spec 注册表未同步该对象ID。"
      else
        log_fail "变更清单引用未知对象ID：$object_id"
      fi
      continue
    fi

    if [ "$change_type" = "废弃" ] && [ "${SPEC_STATUS_BY_ID[$object_id]:-}" != "deprecated" ]; then
      log_fail "变更清单声明废弃（对象ID: $object_id），但 Spec 注册表状态不是 deprecated。"
    fi
  done

  if [ "$row_count" -eq 0 ]; then
    log_fail "本轮术语变更清单缺少数据行。"
    return 1
  fi

  if [ "$ERROR_COUNT" -eq "$errors_before" ] && [ "$SOFT_FAIL_COUNT" -eq "$soft_fail_before" ]; then
    CHANGE_LIST_READY=1
    log_pass "本轮术语变更清单结构合法。"
  fi
}

check_forbidden_alias_leakage() {
  local alias canonical path line line_number remainder content tmp_patterns content_path scan_root
  local -a grep_paths=()
  declare -A FAIL_HITS_BY_ALIAS=()
  declare -A WARN_HITS_BY_ALIAS=()

  if [ "$REGISTRY_READY" -ne 1 ]; then
    log_warn "术语注册表未就绪，跳过禁用别名泄漏检查。"
    return 0
  fi

  if [ "${#FORBIDDEN_ALIAS_TO_CANONICAL[@]}" -eq 0 ]; then
    log_pass "禁用别名列表为空，跳过泄漏检查。"
    return 0
  fi

  if [ "${#SCAN_TARGETS[@]}" -eq 0 ]; then
    log_warn "无可扫描文件，跳过禁用别名泄漏检查。"
    return 0
  fi

  for path in "${SCAN_TARGETS[@]}"; do
    resolve_content_path_for_mode "$path" || continue
    content_path="$CONTENT_PATH_RESULT"
    [ -f "$content_path" ] || continue
    grep_paths+=("$path")
  done

  if [ "${#grep_paths[@]}" -eq 0 ]; then
    log_warn "无可扫描文件，跳过禁用别名泄漏检查。"
    return 0
  fi

  tmp_patterns=$(mktemp 2>/dev/null || printf '')
  if [ -z "$tmp_patterns" ]; then
    log_fail "无法创建临时 alias pattern 文件。"
    return 1
  fi

  for alias in "${!FORBIDDEN_ALIAS_TO_CANONICAL[@]}"; do
    printf '%s\n' "$alias" >> "$tmp_patterns"
  done

  resolve_content_root_for_mode || {
    rm -f "$tmp_patterns"
    log_fail "无法准备术语扫描内容根目录。"
    return 1
  }
  scan_root="$CONTENT_ROOT_RESULT"

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    path="${line%%:*}"
    [ -n "$path" ] || continue
    remainder="${line#*:}"
    line_number="${remainder%%:*}"
    content="${remainder#*:}"

    if is_repo_main_doc_ignored_line "$path" "$line_number"; then
      continue
    fi

    for alias in "${!FORBIDDEN_ALIAS_TO_CANONICAL[@]}"; do
      case "$line" in
        *"$alias"*)
          if [ "$MODE" = "staged" ] && ! path_is_staged_scope "$path"; then
            WARN_HITS_BY_ALIAS["$alias"]+="$line"$'\n'
            continue
          fi

          if is_warn_only_path "$path"; then
            WARN_HITS_BY_ALIAS["$alias"]+="$line"$'\n'
          else
            FAIL_HITS_BY_ALIAS["$alias"]+="$line"$'\n'
          fi
          ;;
      esac
    done
  done < <(
    (
      cd "$scan_root" &&
      grep -nHIF -f "$tmp_patterns" "${grep_paths[@]}"
    ) 2>/dev/null
  )

  rm -f "$tmp_patterns"

  for alias in "${!FORBIDDEN_ALIAS_TO_CANONICAL[@]}"; do
    canonical="${FORBIDDEN_ALIAS_TO_CANONICAL[$alias]}"

    if [ -n "${WARN_HITS_BY_ALIAS[$alias]:-}" ]; then
      log_warn "非硬拦范围仍存在禁用别名 '$alias'（统一口径：$canonical）。"
      printf '%s' "${WARN_HITS_BY_ALIAS[$alias]}" | sed '/^$/d; s/^/  -> /'
    fi

    if [ -n "${FAIL_HITS_BY_ALIAS[$alias]:-}" ]; then
      log_fail "禁用别名泄漏：'$alias'（统一口径：$canonical）。"
      printf '%s' "${FAIL_HITS_BY_ALIAS[$alias]}" | sed '/^$/d; s/^/  -> /' >&2
    fi
  done
}

is_technical_whitelist_token() {
  local token="$1"
  case "$token" in
    index|page|pages|route|routes|layout|loading|error|not-found|template|main|app|entry|client|server|types|type|utils|util|common|shared|core|base|lib|api|service|store|state|model|schema|dto|entity|feature|module|modules|component|components|hook|hooks|provider|providers|context|contexts|config|configs|constant|constants)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

token_matches_family() {
  local token="$1"
  local normalized="$token"
  local suffix
  local family_key

  [ -n "$token" ] || return 1

  if [ -n "${CODE_NAME_FAMILY_SET[$token]:-}" ]; then
    return 0
  fi

  normalized=$(printf '%s' "$token" | sed 's/\.[^.]*$//')
  if [ -n "${CODE_NAME_FAMILY_SET[$normalized]:-}" ]; then
    return 0
  fi

  for family_key in "${!CODE_NAME_FAMILY_SET[@]}"; do
    case "$token" in
      "$family_key"|"$family_key"s|"$family_key"es|"$family_key"-*|"$family_key"_*|"$family_key"[A-Z]*|"$family_key"s[A-Z]*)
        return 0
        ;;
    esac
  done

  for suffix in Page Module State Action Store Model Service Feature View Route Screen; do
    if [[ "$token" =~ ^(.+)${suffix}$ ]]; then
      if [ -n "${CODE_NAME_FAMILY_SET[${BASH_REMATCH[1]}]:-}" ]; then
        return 0
      fi
    fi
  done

  if [[ "$token" =~ ^use([A-Z].+)$ ]]; then
    if [ -n "${CODE_NAME_FAMILY_SET[${BASH_REMATCH[1]}]:-}" ]; then
      return 0
    fi
  fi

  return 1
}

is_module_or_page_entry_path() {
  local path="$1"
  if [[ "$path" =~ (^|.*/)app/([^/]+/)*(page|layout|route|loading|error|not-found|template)\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$ ]]; then
    return 0
  fi

  if [[ "$path" =~ (^|.*/)(features|module|modules|page|pages)/[^/]+/(index|mod|page)\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$ ]]; then
      return 0
  fi

  return 1
}

extract_candidate_basename() {
  local path="$1"
  local base parent stem
  base=$(basename "$path")
  parent=$(basename "$(dirname "$path")")
  stem="${base%.*}"

  case "$stem" in
    index|page|route|layout|loading|error|not-found|template|main|entry|mod)
      printf '%s\n' "$parent"
      ;;
    *)
      printf '%s\n' "$stem"
      ;;
  esac
}

collect_export_names_from_named_export_buffer() {
  local raw="$1"
  local target_name="$2"
  local token part export_body
  local -n target_seen_ref=$target_name

  if [[ ! "$raw" =~ ^export[[:space:]]+(type[[:space:]]+)?\{([^}]*)\}([[:space:]]+from[[:space:]].*)?$ ]]; then
    return 0
  fi

  export_body="${BASH_REMATCH[2]}"
  IFS=',' read -r -a parts <<<"$export_body"
  for part in "${parts[@]}"; do
    part=$(trim "$part")
    part="${part#type }"
    [ -n "$part" ] || continue
    if [[ "$part" =~ ^([A-Za-z_][A-Za-z0-9_]*)[[:space:]]+as[[:space:]]+([A-Za-z_][A-Za-z0-9_]*)$ ]]; then
      token="${BASH_REMATCH[2]}"
      target_seen_ref["$token"]=1
    elif [[ "$part" =~ ^([A-Za-z_][A-Za-z0-9_]*)$ ]]; then
      token="${BASH_REMATCH[1]}"
      target_seen_ref["$token"]=1
    fi
  done
}

collect_export_names_from_stream() {
  local target_name="$1"
  local line raw token named_export_buffer=""
  local in_named_export=0
  local -n target_seen_ref=$target_name

  while IFS= read -r line || [ -n "$line" ]; do
    raw=$(trim "$line")
    [ -n "$raw" ] || continue

    if [[ "$raw" =~ ^export[[:space:]]+default[[:space:]]+(function|class)[[:space:]]+([A-Za-z_][A-Za-z0-9_]*) ]]; then
      token="${BASH_REMATCH[2]}"
      target_seen_ref["$token"]=1
      continue
    fi

    if [[ "$raw" =~ ^export[[:space:]]+(const|function|class|type|interface|enum)[[:space:]]+([A-Za-z_][A-Za-z0-9_]*) ]]; then
      token="${BASH_REMATCH[2]}"
      target_seen_ref["$token"]=1
      continue
    fi

    if [ "$in_named_export" -eq 1 ]; then
      named_export_buffer="$named_export_buffer $raw"
      if [[ "$raw" == *"}"* ]]; then
        collect_export_names_from_named_export_buffer "$named_export_buffer" "$target_name"
        named_export_buffer=""
        in_named_export=0
      fi
      continue
    fi

    if [[ "$raw" =~ ^export[[:space:]]+(type[[:space:]]+)?\{ ]]; then
      if [[ "$raw" == *"}"* ]]; then
        collect_export_names_from_named_export_buffer "$raw" "$target_name"
      else
        named_export_buffer="$raw"
        in_named_export=1
      fi
    fi
  done
}

collect_export_names_from_git_revision() {
  local revision="$1"
  local target_name="$2"

  if ! git -C "$ROOT" cat-file -e "$revision" 2>/dev/null; then
    return 0
  fi

  collect_export_names_from_stream "$target_name" < <(git -C "$ROOT" show "$revision")
}

extract_added_export_names_from_file() {
  local path="$1"
  local token
  local -A current_seen=()
  local -A previous_seen=()

  collect_export_names_from_git_revision ":$path" current_seen
  collect_export_names_from_git_revision "HEAD:$path" previous_seen

  for token in "${!current_seen[@]}"; do
    if [ -n "${previous_seen[$token]:-}" ]; then
      continue
    fi
    printf '%s\n' "$token"
  done
}

check_new_basename_and_exports_in_staged() {
  local path candidate lower token
  local -a violations=()

  if [ "$REGISTRY_READY" -ne 1 ]; then
    log_warn "术语注册表未就绪，跳过新增 basename / 公开导出名硬拦。"
    return 0
  fi

  for path in "${STAGED_ADDED_BEHAVIOR_FILES[@]}"; do
    is_module_or_page_entry_path "$path" || continue
    candidate=$(extract_candidate_basename "$path")
    candidate=$(trim "$candidate")
    [ -n "$candidate" ] || continue

    lower=$(printf '%s' "$candidate" | tr '[:upper:]' '[:lower:]')
    if is_technical_whitelist_token "$lower"; then
      continue
    fi

    if ! token_matches_family "$candidate"; then
      violations+=("新增模块/页面路径 basename '$candidate'（$path）未映射到已登记代码命名家族。")
    fi
  done

  for path in "${STAGED_BEHAVIOR_FILES[@]}"; do
    case "$path" in
      */index.ts|*/index.tsx|*/index.js|*/index.jsx|*/public-api.ts|*/public-api.js|*/exports.ts|*/exports.js|*/mod.ts|*/mod.js) ;;
      *) continue ;;
    esac

    while IFS= read -r token; do
      [ -n "$token" ] || continue
      lower=$(printf '%s' "$token" | tr '[:upper:]' '[:lower:]')
      if is_technical_whitelist_token "$lower"; then
        continue
      fi
      if ! token_matches_family "$token"; then
        violations+=("新增公开导出名 '$token'（$path）未映射到已登记代码命名家族。")
      fi
    done < <(extract_added_export_names_from_file "$path")
  done

  if [ "${#violations[@]}" -gt 0 ]; then
    for message in "${violations[@]}"; do
      log_fail "$message"
    done
  fi
}

run_repo_checks() {
  collect_scan_targets_repo
  check_forbidden_alias_leakage
}

run_staged_checks() {
  if [ "$STAGED_FILES_READY" -eq 0 ]; then
    collect_staged_files
  fi

  if [ "${#STAGED_BEHAVIOR_FILES[@]}" -eq 0 ] && [ "${#STAGED_DOC_FILES[@]}" -eq 0 ]; then
    log_pass "staged 模式未检测到 staged behavior/doc changes，跳过硬拦检查。"
    return 0
  fi

  collect_scan_targets_staged

  check_forbidden_alias_leakage
  check_new_basename_and_exports_in_staged
}

main() {

  parse_args "$@"

  if [ ! -d "$ROOT" ]; then
    printf '[FAIL] Root path does not exist: %s\n' "$ROOT" >&2
    exit 1
  fi

  ROOT=$(cd "$ROOT" && pwd)

  if ! resolve_content_path_for_mode "Product-Spec.md"; then
    printf '[FAIL] Missing Product-Spec.md under %s\n' "$ROOT" >&2
    exit 1
  fi

  load_helpers || true
  if [ "$MODE" = "staged" ] && [ "$HELPERS_READY" -eq 1 ]; then
    collect_staged_files || true
  fi

  validate_main_doc_for_mode "Product-Spec.md" validate_registry_table
  validate_main_doc_for_mode "DEV-PLAN.md" validate_change_list_table

  if [ "$HELPERS_READY" -eq 1 ]; then
    case "$MODE" in
      repo)
        run_repo_checks
        ;;
      staged)
        run_staged_checks
        ;;
    esac
  fi

  if [ "$ERROR_COUNT" -gt 0 ]; then
    printf '[FAIL] Terminology consistency check failed with %s error(s) and %s warning(s).\n' "$ERROR_COUNT" "$WARN_COUNT" >&2
    exit 1
  fi

  printf '[PASS] Terminology consistency check passed with %s warning(s).\n' "$WARN_COUNT"
}

main "$@"
