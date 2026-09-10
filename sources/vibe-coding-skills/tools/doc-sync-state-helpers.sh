# DocMap:
# Layer: L3 / tools internal helper
# Module: tools
# Loaded by: tools/doc-sync-helpers.sh
# Snapshots, change records, coverage checks, and state helpers.

doc_sync_append_staged_review_snapshot_record() {
  local root target status old_path new_path
  local -a diff_paths=()
  root=$(doc_sync_normalize_root "${1:-}")
  target="${2:-}"
  status="${3:-M}"
  old_path=$(doc_sync_normalize_path "${4:-}")
  new_path=$(doc_sync_normalize_path "${5:-}")

  printf 'record\t%s\t%s\t%s\n' "$status" "$old_path" "$new_path" >> "$target"

  if [ -n "$old_path" ]; then
    diff_paths+=("$old_path")
  fi

  if [ -n "$new_path" ] && [ "$new_path" != "$old_path" ]; then
    diff_paths+=("$new_path")
  fi

  if [ ${#diff_paths[@]} -gt 0 ]; then
    git -C "$root" diff --cached --binary -- "${diff_paths[@]}" >> "$target" 2>/dev/null || true
  fi

  printf '\nend-record\n' >> "$target"
}

doc_sync_write_review_snapshot() {
  local root target status path old_path new_path
  local has_records=1

  root=$(doc_sync_normalize_root "${1:-}")
  target="${2:-}"

  if [ -z "$root" ] || [ -z "$target" ] || ! command -v git >/dev/null 2>&1; then
    return 1
  fi

  printf 'review-snapshot-v2\n' > "$target"

  while IFS= read -r -d '' status; do
    case "$status" in
      R*|C*)
        IFS= read -r -d '' old_path || break
        IFS= read -r -d '' new_path || break
        old_path=$(doc_sync_normalize_path "$old_path")
        new_path=$(doc_sync_normalize_path "$new_path")

        if doc_sync_staged_change_requires_review "$root" "$old_path" "$status" || doc_sync_staged_change_requires_review "$root" "$new_path" "$status"; then
          has_records=0
          doc_sync_append_staged_review_snapshot_record "$root" "$target" "$status" "$old_path" "$new_path"
        fi
        ;;
      *)
        IFS= read -r -d '' path || break
        path=$(doc_sync_normalize_path "$path")

        if doc_sync_staged_change_requires_review "$root" "$path" "$status"; then
          has_records=0
          doc_sync_append_staged_review_snapshot_record "$root" "$target" "$status" "$path" ""
        fi
        ;;
    esac
  done < <(git -C "$root" diff --cached --name-status -z --diff-filter=ACMRD 2>/dev/null)

  if [ $has_records -ne 0 ]; then
    rm -f "$target"
    return 1
  fi
}

doc_sync_write_t2_check_snapshot() {
  local root target status path old_path new_path
  local has_records=1

  root=$(doc_sync_normalize_root "${1:-}")
  target="${2:-}"

  if [ -z "$root" ] || [ -z "$target" ] || ! command -v git >/dev/null 2>&1; then
    return 1
  fi

  printf 't2-check-snapshot-v1\n' > "$target"

  while IFS= read -r -d '' status; do
    case "$status" in
      R*|C*)
        IFS= read -r -d '' old_path || break
        IFS= read -r -d '' new_path || break
        old_path=$(doc_sync_normalize_path "$old_path")
        new_path=$(doc_sync_normalize_path "$new_path")

        if doc_sync_staged_change_requires_t2_check "$root" "$old_path" "$status" || doc_sync_staged_change_requires_t2_check "$root" "$new_path" "$status"; then
          has_records=0
          doc_sync_append_staged_review_snapshot_record "$root" "$target" "$status" "$old_path" "$new_path"
        fi
        ;;
      *)
        IFS= read -r -d '' path || break
        path=$(doc_sync_normalize_path "$path")

        if doc_sync_staged_change_requires_t2_check "$root" "$path" "$status"; then
          has_records=0
          doc_sync_append_staged_review_snapshot_record "$root" "$target" "$status" "$path" ""
        fi
        ;;
    esac
  done < <(git -C "$root" diff --cached --name-status -z --diff-filter=ACMRD 2>/dev/null)

  if [ $has_records -ne 0 ]; then
    rm -f "$target"
    return 1
  fi
}

doc_sync_review_snapshot_hash() {
  local root tmp hash

  root=$(doc_sync_normalize_root "${1:-}")
  if [ -z "$root" ] || ! command -v git >/dev/null 2>&1; then
    return 1
  fi

  tmp=$(mktemp 2>/dev/null) || return 1

  if ! doc_sync_write_review_snapshot "$root" "$tmp"; then
    rm -f "$tmp"
    return 1
  fi

  hash=$(git hash-object "$tmp" 2>/dev/null)
  rm -f "$tmp"

  if [ -z "$hash" ]; then
    return 1
  fi

  printf '%s\n' "$hash"
}

doc_sync_t2_check_snapshot_hash() {
  local root tmp hash

  root=$(doc_sync_normalize_root "${1:-}")
  if [ -z "$root" ] || ! command -v git >/dev/null 2>&1; then
    return 1
  fi

  tmp=$(mktemp 2>/dev/null) || return 1

  if ! doc_sync_write_t2_check_snapshot "$root" "$tmp"; then
    rm -f "$tmp"
    return 1
  fi

  hash=$(git hash-object "$tmp" 2>/dev/null)
  rm -f "$tmp"

  if [ -z "$hash" ]; then
    return 1
  fi

  printf '%s\n' "$hash"
}

doc_sync_print_git_change_records() {
  local root scope status old_path new_path path
  root=$(doc_sync_normalize_root "${1:-}")
  scope="${2:-all}"

  [ -n "$root" ] || return 0
  command -v git >/dev/null 2>&1 || return 0
  git -C "$root" rev-parse --git-dir >/dev/null 2>&1 || return 0

  if [ "$scope" = "cached" ] || [ "$scope" = "all" ]; then
    while IFS= read -r -d '' status; do
      case "$status" in
        R*|C*)
          IFS= read -r -d '' old_path || break
          IFS= read -r -d '' new_path || break
          printf '%s\0%s\0%s\0' "$status" "$(doc_sync_normalize_path "$old_path")" "$(doc_sync_normalize_path "$new_path")"
          ;;
        *)
          IFS= read -r -d '' path || break
          printf '%s\0%s\0' "$status" "$(doc_sync_normalize_path "$path")"
          ;;
      esac
    done < <(git -C "$root" diff --cached --name-status -z --diff-filter=ACMRD 2>/dev/null)
  fi

  if [ "$scope" = "unstaged" ] || [ "$scope" = "all" ]; then
    while IFS= read -r -d '' status; do
      case "$status" in
        R*|C*)
          IFS= read -r -d '' old_path || break
          IFS= read -r -d '' new_path || break
          printf '%s\0%s\0%s\0' "$status" "$(doc_sync_normalize_path "$old_path")" "$(doc_sync_normalize_path "$new_path")"
          ;;
        *)
          IFS= read -r -d '' path || break
          printf '%s\0%s\0' "$status" "$(doc_sync_normalize_path "$path")"
          ;;
      esac
    done < <(git -C "$root" diff --name-status -z --diff-filter=ACMRD 2>/dev/null)
  fi

  if [ "$scope" = "untracked" ] || [ "$scope" = "all" ]; then
    while IFS= read -r -d '' path; do
      printf 'A\0%s\0' "$(doc_sync_normalize_path "$path")"
    done < <(git -C "$root" ls-files --others --exclude-standard -z 2>/dev/null)
  fi
}

doc_sync_record_requires_review() {
  local root status path extra
  root=$(doc_sync_normalize_root "${1:-}")
  status="${2:-M}"
  path=$(doc_sync_normalize_path "${3:-}")
  extra=$(doc_sync_normalize_path "${4:-}")

  case "$status" in
    R*|C*)
      doc_sync_staged_change_requires_review "$root" "$path" "$status" ||
        doc_sync_staged_change_requires_review "$root" "$extra" "$status"
      ;;
    *)
      doc_sync_staged_change_requires_review "$root" "$path" "$status"
      ;;
  esac
}

doc_sync_record_requires_strict_review() {
  local root status path extra
  root=$(doc_sync_normalize_root "${1:-}")
  status="${2:-M}"
  path=$(doc_sync_normalize_path "${3:-}")
  extra=$(doc_sync_normalize_path "${4:-}")

  case "$status" in
    R*|C*)
      doc_sync_staged_change_requires_strict_review "$root" "$path" "$status" ||
        doc_sync_staged_change_requires_strict_review "$root" "$extra" "$status"
      ;;
    *)
      doc_sync_staged_change_requires_strict_review "$root" "$path" "$status"
      ;;
  esac
}

doc_sync_record_requires_t2_check() {
  local root status path extra
  root=$(doc_sync_normalize_root "${1:-}")
  status="${2:-M}"
  path=$(doc_sync_normalize_path "${3:-}")
  extra=$(doc_sync_normalize_path "${4:-}")

  case "$status" in
    R*|C*)
      doc_sync_staged_change_requires_t2_check "$root" "$path" "$status" ||
        doc_sync_staged_change_requires_t2_check "$root" "$extra" "$status"
      ;;
    *)
      doc_sync_staged_change_requires_t2_check "$root" "$path" "$status"
      ;;
  esac
}

doc_sync_record_primary_path() {
  local status path extra
  status="${1:-M}"
  path=$(doc_sync_normalize_path "${2:-}")
  extra=$(doc_sync_normalize_path "${3:-}")

  case "$status" in
    R*|C*)
      printf '%s\n' "${extra:-$path}"
      ;;
    *)
      printf '%s\n' "$path"
      ;;
  esac
}

doc_sync_print_filtered_change_records_for_scope() {
  local root scope mode status path extra primary matched
  root=$(doc_sync_normalize_root "${1:-}")
  scope="${2:-cached}"
  mode="${3:-source}"

  while IFS= read -r -d '' status; do
    extra=""
    case "$status" in
      R*|C*)
        IFS= read -r -d '' path || break
        IFS= read -r -d '' extra || break
        ;;
      *)
        IFS= read -r -d '' path || break
        ;;
    esac

    primary=$(doc_sync_record_primary_path "$status" "$path" "$extra")
    matched=1
    case "$mode:$scope" in
      source:cached) doc_sync_record_requires_review "$root" "$status" "$path" "$extra" && matched=0 ;;
      source:unstaged) doc_sync_worktree_change_requires_review "$root" "$primary" "$status" && matched=0 ;;
      source:untracked) doc_sync_untracked_change_requires_review "$root" "$primary" && matched=0 ;;
      strict:cached) doc_sync_record_requires_strict_review "$root" "$status" "$path" "$extra" && matched=0 ;;
      strict:unstaged) doc_sync_worktree_change_requires_strict_review "$root" "$primary" "$status" && matched=0 ;;
      strict:untracked) doc_sync_untracked_change_requires_strict_review "$root" "$primary" && matched=0 ;;
      t2:cached) doc_sync_record_requires_t2_check "$root" "$status" "$path" "$extra" && matched=0 ;;
      t2:unstaged) doc_sync_worktree_change_requires_t2_check "$root" "$primary" "$status" && matched=0 ;;
      t2:untracked) doc_sync_untracked_change_requires_t2_check "$root" "$primary" && matched=0 ;;
    esac

    if [ $matched -eq 0 ]; then
      printf '%s\0%s\0' "$status" "$primary"
    fi
  done < <(doc_sync_print_git_change_records "$root" "$scope")
}

doc_sync_print_filtered_change_records() {
  local root scope mode current_scope
  root=$(doc_sync_normalize_root "${1:-}")
  scope="${2:-all}"
  mode="${3:-source}"

  for current_scope in cached unstaged untracked; do
    if [ "$scope" = "$current_scope" ] || [ "$scope" = "all" ]; then
      doc_sync_print_filtered_change_records_for_scope "$root" "$current_scope" "$mode"
    fi
  done
}

doc_sync_print_current_source_change_records() {
  doc_sync_print_filtered_change_records "${1:-}" "${2:-all}" source
}

doc_sync_print_current_strict_source_change_records() {
  doc_sync_print_filtered_change_records "${1:-}" "${2:-all}" strict
}

doc_sync_print_current_t2_light_change_records() {
  doc_sync_print_filtered_change_records "${1:-}" "${2:-all}" t2
}

doc_sync_current_has_source_changes() {
  local root scope first_field
  root=$(doc_sync_normalize_root "${1:-}")
  scope="${2:-all}"

  IFS= read -r -d '' first_field < <(doc_sync_print_current_source_change_records "$root" "$scope")
}

doc_sync_current_has_strict_source_changes() {
  local root scope first_field
  root=$(doc_sync_normalize_root "${1:-}")
  scope="${2:-all}"

  IFS= read -r -d '' first_field < <(doc_sync_print_current_strict_source_change_records "$root" "$scope")
}

doc_sync_current_has_t2_light_changes() {
  local root scope first_field
  root=$(doc_sync_normalize_root "${1:-}")
  scope="${2:-all}"

  IFS= read -r -d '' first_field < <(doc_sync_print_current_t2_light_change_records "$root" "$scope")
}

doc_sync_change_can_cover_source() {
  local root cover_path source_path status tier path_tier rank path_rank
  root=$(doc_sync_normalize_root "${1:-}")
  cover_path=$(doc_sync_normalize_path "${2:-}")
  source_path=$(doc_sync_normalize_path "${3:-}")
  status="${4:-M}"

  if [ -z "$cover_path" ] || [ -z "$source_path" ] || [ "$cover_path" = "$source_path" ]; then
    return 1
  fi

  if ! doc_sync_is_relevant_doc_for_source_path "$cover_path" "$source_path"; then
    return 1
  fi

  case "$cover_path" in
    Product-Spec-CHANGELOG.md)
      return 0
      ;;
  esac

  tier=$(doc_sync_staged_change_tier "$root" "$cover_path" "$status")
  rank=$(doc_sync_tier_rank "$tier")
  if [ "$rank" -ge 2 ]; then
    return 0
  fi

  path_tier=$(doc_sync_path_tier "$cover_path")
  path_rank=$(doc_sync_tier_rank "$path_tier")
  [ "$path_rank" -ge 2 ]
}

doc_sync_current_has_uncovered_sources_by_mode() {
  local root mode source_index cover_index source_status source_path cover_status cover_path cover_extra cover_primary covered
  local -a source_fields=()
  local -a cover_fields=()

  root=$(doc_sync_normalize_root "${1:-}")
  mode="${2:-source}"
  [ -n "$root" ] || return 1

  if [ "$mode" = "strict" ]; then
    mapfile -d '' -t source_fields < <(doc_sync_print_current_strict_source_change_records "$root" all)
  else
    mapfile -d '' -t source_fields < <(doc_sync_print_current_source_change_records "$root" all)
  fi

  if [ ${#source_fields[@]} -eq 0 ]; then
    return 1
  fi
  if [ $((${#source_fields[@]} % 2)) -ne 0 ]; then
    return 0
  fi

  mapfile -d '' -t cover_fields < <(doc_sync_print_git_change_records "$root" all)
  source_index=0
  while [ $source_index -lt ${#source_fields[@]} ]; do
    source_status="${source_fields[$source_index]}"
    source_index=$((source_index + 1))
    source_path="${source_fields[$source_index]}"
    source_index=$((source_index + 1))
    covered=1
    cover_index=0

    while [ $cover_index -lt ${#cover_fields[@]} ]; do
      cover_status="${cover_fields[$cover_index]}"
      cover_index=$((cover_index + 1))
      cover_extra=""
      case "$cover_status" in
        R*|C*)
          [ $((cover_index + 1)) -lt ${#cover_fields[@]} ] || return 0
          cover_path="${cover_fields[$cover_index]}"
          cover_index=$((cover_index + 1))
          cover_extra="${cover_fields[$cover_index]}"
          cover_index=$((cover_index + 1))
          ;;
        *)
          [ $cover_index -lt ${#cover_fields[@]} ] || return 0
          cover_path="${cover_fields[$cover_index]}"
          cover_index=$((cover_index + 1))
          ;;
      esac

      cover_primary=$(doc_sync_record_primary_path "$cover_status" "$cover_path" "$cover_extra")
      if doc_sync_change_can_cover_source "$root" "$cover_primary" "$source_path" "$cover_status"; then
        covered=0
        break
      fi
    done

    if [ $covered -ne 0 ]; then
      return 0
    fi
  done

  return 1
}

doc_sync_current_has_uncovered_doc_sync_sources() {
  doc_sync_current_has_uncovered_sources_by_mode "${1:-}" source
}

doc_sync_current_has_uncovered_strict_doc_sync_sources() {
  doc_sync_current_has_uncovered_sources_by_mode "${1:-}" strict
}
