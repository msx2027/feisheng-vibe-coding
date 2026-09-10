#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Used by: tools/check-terminology-consistency.sh
# Stable path normalization and repository text-contract helpers.

trim() {
  local value="${1-}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

normalize_path() {
  if declare -F doc_sync_normalize_path >/dev/null 2>&1; then
    doc_sync_normalize_path "$1"
    return 0
  fi

  printf '%s\n' "$1" | sed 's#\\#/#g; s#^\./##'
}

normalize_contract_path() {
  local path
  path=$(normalize_path "${1:-}")
  path="${path#/}"
  printf '%s\n' "$path"
}

normalize_rule_line() {
  local line="${1-}"
  printf '%s\n' "$line" | sed 's/[[:space:]][[:space:]]*/ /g; s/^ //; s/ $//'
}

path_has_glob_syntax() {
  local path="$1"

  case "$path" in
    *"*"*|*"?"*|*"["*|*"]"*|*"{"*|*"}"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

gitattributes_rule_marks_text() {
  local line="$1"

  [[ "$line" =~ (^|[[:space:]])text($|[[:space:]=]) ]] || return 1
  [[ "$line" =~ (^|[[:space:]])-text($|[[:space:]]) ]] && return 1
  [[ "$line" =~ (^|[[:space:]])binary($|[[:space:]]) ]] && return 1

  return 0
}

editorconfig_glob_to_regex() {
  local pattern="$1"
  local regex="" char next_char
  local length=${#pattern}
  local index=0

  while [ "$index" -lt "$length" ]; do
    char="${pattern:$index:1}"
    case "$char" in
      '*')
        next_char=""
        if [ $((index + 1)) -lt "$length" ]; then
          next_char="${pattern:$((index + 1)):1}"
        fi

        if [ "$next_char" = "*" ]; then
          regex="${regex}.*"
          index=$((index + 1))
        else
          regex="${regex}[^/]*"
        fi
        ;;
      '?')
        regex="${regex}[^/]"
        ;;
      '.'|'+'|'('|')'|'|'|'^'|'$'|'{'|'}'|'['|']'|'\\')
        regex="${regex}\\${char}"
        ;;
      '/')
        regex="${regex}/"
        ;;
      *)
        regex="${regex}${char}"
        ;;
    esac
    index=$((index + 1))
  done

  printf '^%s$' "$regex"
}

editorconfig_pattern_matches_path() {
  local pattern path target regex
  pattern=$(normalize_contract_path "${1:-}")
  path=$(normalize_contract_path "${2:-}")

  [ -n "$pattern" ] || return 1
  [ -n "$path" ] || return 1

  if [[ "$pattern" == */* ]]; then
    target="$path"
  else
    target=$(basename "$path")
  fi

  regex=$(editorconfig_glob_to_regex "$pattern")
  [[ "$target" =~ $regex ]]
}

editorconfig_path_has_repo_text_settings() {
  local file_path="$1"
  local relative_path="$2"
  local line trimmed pattern current_section_matches=0
  local expected_value
  declare -A effective_settings=()

  [ -f "$file_path" ] || return 1

  while IFS= read -r line || [ -n "$line" ]; do
    trimmed=$(trim "$line")

    case "$trimmed" in
      ""|\#*|\;*)
        continue
        ;;
    esac

    if [[ "$trimmed" =~ ^\[(.+)\]$ ]]; then
      pattern="${BASH_REMATCH[1]}"
      if editorconfig_pattern_matches_path "$pattern" "$relative_path"; then
        current_section_matches=1
      else
        current_section_matches=0
      fi
      continue
    fi

    if [ "$current_section_matches" -ne 1 ]; then
      continue
    fi

    if [[ "$trimmed" =~ ^([A-Za-z0-9_.-]+)[[:space:]]*=[[:space:]]*([^[:space:]]+)[[:space:]]*$ ]]; then
      effective_settings["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
    fi
  done < "$file_path"

  expected_value="utf-8"
  [ "${effective_settings[charset]:-}" = "$expected_value" ] || return 1
  expected_value="lf"
  [ "${effective_settings[end_of_line]:-}" = "$expected_value" ] || return 1
  expected_value="true"
  [ "${effective_settings[insert_final_newline]:-}" = "$expected_value" ] || return 1
  expected_value="true"
  [ "${effective_settings[trim_trailing_whitespace]:-}" = "$expected_value" ] || return 1

  return 0
}
