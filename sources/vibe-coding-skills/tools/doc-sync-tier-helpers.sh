# DocMap:
# Layer: L3 / tools internal helper
# Module: tools
# Loaded by: tools/doc-sync-helpers.sh
# Execution tier and diff risk classification.

doc_sync_is_behavior_path() {
  local path match_path
  path=$(doc_sync_normalize_path "${1:-}")
  match_path=$(doc_sync_lowercase_path "$path")

  if doc_sync_is_generated_path "$path" || doc_sync_is_low_signal_path "$path" || doc_sync_is_doc_path "$path"; then
    return 1
  fi

  case "$match_path" in
    skills/*|agents/*|hooks/*|codex-hooks/*|tools/*|.githooks/*|migrations/*|settings.json|codex-hooks.json|.env|.env.*|*/.env|*/.env.*|*.ts|*.tsx|*.mts|*.cts|*.js|*.jsx|*.mjs|*.cjs|*.vue|*.svelte|*.html|*.css|*.scss|*.py|*.rs|*.go|*.java|*.kt|*.dart|*.swift|*.cs|*.cpp|*.sh|*.ps1|*.psm1|*.json|*.yaml|*.yml|*.toml|*.sql)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

doc_sync_tier_rank() {
  case "${1:-}" in
    t0) printf '0\n' ;;
    t1) printf '1\n' ;;
    t2) printf '2\n' ;;
    t3) printf '3\n' ;;
    *) printf '2\n' ;;
  esac
}

doc_sync_tier_requires_gate() {
  local tier rank
  tier="${1:-t2}"
  rank=$(doc_sync_tier_rank "$tier")
  [ "$rank" -ge 2 ]
}

doc_sync_gate_level_requires_strict_review() {
  [ "${1:-none}" = "strict" ]
}

doc_sync_gate_level_requires_t2_check() {
  [ "${1:-none}" = "t2-light" ]
}

doc_sync_is_repo_workflow_path() {
  local path match_path
  path=$(doc_sync_normalize_path "${1:-}")
  match_path=$(doc_sync_lowercase_path "$path")

  case "$match_path" in
    skills/*|agents/*|hooks/*|codex-hooks/*|tools/*|.githooks/*|settings.json|codex-hooks.json)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

doc_sync_path_has_hazard_signal() {
  local path match_path
  path=$(doc_sync_normalize_path "${1:-}")
  match_path=$(doc_sync_lowercase_path "$path")

  case "$match_path" in
    skills/*|agents/*|hooks/*|codex-hooks/*|tools/*|.githooks/*|settings.json|codex-hooks.json)
      return 0
      ;;
    .env|.env.*|*/.env|*/.env.*)
      return 0
      ;;
  esac

  printf '%s\n' "$path" \
    | grep -E -i '(^|[/_.-])(auth|permission|security|token|secret|payment|database|db|migration|migrations|data[-_]?loss|filesystem|shell|network|eval|pre[-_]?commit|hook|agent|routing|release|deploy|publish|delete|danger|admin|role|privacy|login|logout|signin|sign[-_]?in|signup|sign[-_]?up|authorize|authorization)([/_.-]|$)' >/dev/null
}

doc_sync_path_tier() {
  local path match_path
  path=$(doc_sync_normalize_path "${1:-}")
  match_path=$(doc_sync_lowercase_path "$path")

  if doc_sync_is_generated_path "$path" || doc_sync_is_low_signal_path "$path"; then
    printf 't0\n'
    return 0
  fi

  if doc_sync_is_protected_source_doc_path "$path"; then
    printf 't2\n'
    return 0
  fi

  if doc_sync_is_repo_workflow_path "$path"; then
    printf 't3\n'
    return 0
  fi

  if doc_sync_path_has_hazard_signal "$path" && doc_sync_is_behavior_path "$path"; then
    printf 't3\n'
    return 0
  fi

  case "$match_path" in
    *.tsx|*.jsx|*.vue|*.svelte|*.html|*.css|*.scss)
      printf 't1\n'
      return 0
      ;;
  esac

  if doc_sync_is_doc_path "$path"; then
    printf 't0\n'
    return 0
  fi

  if doc_sync_is_behavior_path "$path"; then
    printf 't2\n'
    return 0
  fi

  printf 't0\n'
}

doc_sync_path_requires_review() {
  local path level
  path=$(doc_sync_normalize_path "${1:-}")
  level=$(doc_sync_path_gate_level "$path")
  doc_sync_is_source_change_path "$path" && doc_sync_gate_level_requires_strict_review "$level"
}

doc_sync_path_requires_t2_check() {
  local path level
  path=$(doc_sync_normalize_path "${1:-}")
  level=$(doc_sync_path_gate_level "$path")
  doc_sync_is_source_change_path "$path" && doc_sync_gate_level_requires_t2_check "$level"
}

doc_sync_path_requires_doc_sync() {
  local path
  path=$(doc_sync_normalize_path "${1:-}")
  doc_sync_is_source_change_path "$path" && doc_sync_path_requires_review "$path"
}

doc_sync_path_gate_level() {
  local path tier rank
  path=$(doc_sync_normalize_path "${1:-}")

  if ! doc_sync_is_source_change_path "$path"; then
    printf 'none\n'
    return 0
  fi

  tier=$(doc_sync_path_tier "$path")
  rank=$(doc_sync_tier_rank "$tier")
  if [ "$rank" -lt 2 ]; then
    printf 'none\n'
    return 0
  fi

  if [ "$tier" = "t3" ] || doc_sync_is_repo_workflow_path "$path"; then
    printf 'strict\n'
    return 0
  fi

  printf 't2-light\n'
}

doc_sync_diff_has_high_risk_signal() {
  local root path scope diff_args
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")
  scope="${3:-cached}"

  [ -n "$root" ] && [ -n "$path" ] || return 1

  if doc_sync_diff_has_hazard_signal "$root" "$path" "$scope"; then
    return 0
  fi

  diff_args=(diff)
  if [ "$scope" = "cached" ]; then
    diff_args+=(--cached)
  fi

  git -C "$root" "${diff_args[@]}" -- "$path" 2>/dev/null \
    | grep -E -i '^[+-][^+-].*(auth|permission|token|secret|payment|database|migration|security|eval|network|filesystem|shell|pre-commit|hook|agent|routing|route|env|sql|password|credential|private[_-]?key|api[_-]?key|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|api|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|test\(|expect\(|assert)' >/dev/null
}

doc_sync_diff_has_protected_doc_strict_signal() {
  local root path scope diff_args
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")
  scope="${3:-cached}"

  [ -n "$root" ] && [ -n "$path" ] || return 1

  if doc_sync_diff_has_hazard_signal "$root" "$path" "$scope" || doc_sync_diff_has_high_risk_signal "$root" "$path" "$scope"; then
    return 0
  fi

  diff_args=(diff)
  if [ "$scope" = "cached" ]; then
    diff_args+=(--cached)
  fi

  git -C "$root" "${diff_args[@]}" -- "$path" 2>/dev/null \
    | grep -E -i '^[+-][^+-].*(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)' >/dev/null
}

doc_sync_diff_has_hazard_signal() {
  local root path scope diff_args
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")
  scope="${3:-cached}"

  [ -n "$root" ] && [ -n "$path" ] || return 1

  if doc_sync_path_has_hazard_signal "$path"; then
    return 0
  fi

  diff_args=(diff)
  if [ "$scope" = "cached" ]; then
    diff_args+=(--cached)
  fi

  git -C "$root" "${diff_args[@]}" -- "$path" 2>/dev/null \
    | grep -E -i '^[+-][^+-].*(auth|permission|security|token|secret|payment|database|db|migration|data[ _-]?loss|filesystem|file system|shell|network|eval|pre[-_ ]?commit|hook|agent routing|routing|release|deploy|publish|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|password|credential|private[_ -]?key|api[_ -]?key|sql|rollback|chmod|rm -rf|exec\(|spawn\(|child_process|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|test\(|expect\(|assert|https?://)' >/dev/null
}

doc_sync_file_has_hazard_signal() {
  local root path abs_path
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")

  [ -n "$root" ] && [ -n "$path" ] || return 1

  if doc_sync_path_has_hazard_signal "$path"; then
    return 0
  fi

  abs_path="$root/$path"
  [ -f "$abs_path" ] || return 1

  grep -I -E -i '(auth|permission|security|token|secret|payment|database|db|migration|data[ _-]?loss|filesystem|file system|shell|network|eval|pre[-_ ]?commit|hook|agent routing|routing|release|deploy|publish|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|password|credential|private[_ -]?key|api[_ -]?key|sql|rollback|chmod|rm -rf|exec\(|spawn\(|child_process|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|https?://)' "$abs_path" >/dev/null
}

doc_sync_file_has_high_risk_signal() {
  local root path abs_path
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")

  [ -n "$root" ] && [ -n "$path" ] || return 1

  if doc_sync_file_has_hazard_signal "$root" "$path"; then
    return 0
  fi

  abs_path="$root/$path"
  [ -f "$abs_path" ] || return 1

  grep -I -E -i '(auth|permission|token|secret|payment|database|migration|security|eval|network|filesystem|shell|pre-commit|hook|agent|routing|route|env|sql|password|credential|private[_-]?key|api[_-]?key|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|api|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|test\(|expect\(|assert)' "$abs_path" >/dev/null
}

doc_sync_file_has_protected_doc_strict_signal() {
  local root path abs_path
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")

  [ -n "$root" ] && [ -n "$path" ] || return 1

  if doc_sync_file_has_hazard_signal "$root" "$path" || doc_sync_file_has_high_risk_signal "$root" "$path"; then
    return 0
  fi

  abs_path="$root/$path"
  [ -f "$abs_path" ] || return 1

  grep -I -E -i '(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)' "$abs_path" >/dev/null
}

doc_sync_staged_change_has_hazard_signal() {
  local root path status
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  if doc_sync_is_generated_path "$path" || doc_sync_is_low_signal_path "$path"; then
    return 1
  fi

  case "$status" in
    D|R*)
      doc_sync_is_behavior_path "$path"
      return $?
      ;;
  esac

  doc_sync_diff_has_hazard_signal "$root" "$path"
}

doc_sync_is_low_risk_changed_line() {
  local line trimmed
  line="${1:-}"
  trimmed="${line#"${line%%[![:space:]]*}"}"
  trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"

  case "$trimmed" in
    ""|//\ *|//|/*|*\ */|*\{/\**\}*)
      return 0
      ;;
  esac

  if printf '%s\n' "$trimmed" | grep -E '\bon[A-Z][A-Za-z]*=|@[A-Za-z-]+=|on:[A-Za-z-]+=|\{.*\}' >/dev/null; then
    return 1
  fi

  case "$trimmed" in
    *className=*|*class=*|*aria-label=*|*title=*|*placeholder=*|*alt=*|*style=*)
      return 0
      ;;
    \<[A-Za-z]*\>*\<\/[A-Za-z]*\>|*\>*\<\/[A-Za-z]*\>)
      if printf '%s\n' "$trimmed" | grep -E '[`{}=]|\bon[A-Z][A-Za-z]*=|\b(if|for|while|switch|return|import|export|const|let|var|function|async|await)\b' >/dev/null; then
        return 1
      fi
      return 0
      ;;
    color:*|background:*|background-color:*|font:*|font-size:*|font-weight:*|line-height:*|letter-spacing:*|width:*|height:*|min-width:*|max-width:*|min-height:*|max-height:*|inline-size:*|block-size:*|min-inline-size:*|max-inline-size:*|min-block-size:*|max-block-size:*|inset:*|inset-*:*|top:*|right:*|bottom:*|left:*|transform:*|translate:*|translate-*:*|scale:*|rotate:*|margin:*|margin-*:*|padding:*|padding-*:*|gap:*|row-gap:*|column-gap:*|border:*|border-*:*|border-radius:*|box-shadow:*|opacity:*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

doc_sync_staged_diff_is_light() {
  local root path scope has_changed line body diff_args
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")
  scope="${3:-cached}"
  has_changed=1

  [ -n "$root" ] && [ -n "$path" ] || return 1

  case "$path" in
    *.tsx|*.jsx|*.vue|*.svelte|*.html|*.css|*.scss)
      ;;
    *)
      return 1
      ;;
  esac

  diff_args=(diff)
  if [ "$scope" = "cached" ]; then
    diff_args+=(--cached)
  fi

  while IFS= read -r line; do
    case "$line" in
      +++*|---*|@@*)
        continue
        ;;
      +*|-*)
        body="${line#?}"
        has_changed=0
        if ! doc_sync_is_low_risk_changed_line "$body"; then
          return 1
        fi
        ;;
    esac
  done < <(git -C "$root" "${diff_args[@]}" -- "$path" 2>/dev/null)

  [ $has_changed -eq 0 ]
}

doc_sync_staged_change_tier() {
  local root path status
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  if doc_sync_is_generated_path "$path" || doc_sync_is_low_signal_path "$path"; then
    printf 't0\n'
    return 0
  fi

  if doc_sync_is_protected_source_doc_path "$path"; then
    if doc_sync_diff_has_protected_doc_strict_signal "$root" "$path" cached; then
      printf 't3\n'
    else
      printf 't2\n'
    fi
    return 0
  fi

  if doc_sync_is_repo_workflow_path "$path"; then
    printf 't3\n'
    return 0
  fi

  case "$status" in
    D|R*|C*)
      if doc_sync_is_behavior_path "$path"; then
        if doc_sync_staged_change_has_hazard_signal "$root" "$path" "$status"; then
          printf 't3\n'
        else
          printf 't2\n'
        fi
      else
        printf 't0\n'
      fi
      return 0
      ;;
  esac

  if doc_sync_is_doc_path "$path"; then
    if git -C "$root" diff --cached -- "$path" 2>/dev/null \
      | grep -E -i '^[+-][^+-].*(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)' >/dev/null; then
      printf 't2\n'
    else
      printf 't0\n'
    fi
    return 0
  fi

  if ! doc_sync_is_behavior_path "$path"; then
    printf 't0\n'
    return 0
  fi

  if doc_sync_staged_change_has_hazard_signal "$root" "$path" "$status" || doc_sync_diff_has_high_risk_signal "$root" "$path"; then
    printf 't3\n'
    return 0
  fi

  if doc_sync_staged_diff_is_light "$root" "$path"; then
    printf 't1\n'
    return 0
  fi

  printf 't2\n'
}

doc_sync_staged_change_gate_level() {
  local root path status tier rank
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  if ! doc_sync_is_source_change_path "$path"; then
    printf 'none\n'
    return 0
  fi

  tier=$(doc_sync_staged_change_tier "$root" "$path" "$status")
  rank=$(doc_sync_tier_rank "$tier")
  if [ "$rank" -lt 2 ]; then
    printf 'none\n'
    return 0
  fi

  if [ "$tier" = "t3" ] || doc_sync_is_repo_workflow_path "$path"; then
    printf 'strict\n'
    return 0
  fi

  case "$status" in
    D|R*|C*)
      if doc_sync_is_behavior_path "$path"; then
        printf 'strict\n'
        return 0
      fi
      ;;
  esac

  printf 't2-light\n'
}

doc_sync_staged_change_requires_review() {
  local root path status tier
  root="${1:-}"
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  if ! doc_sync_is_source_change_path "$path"; then
    return 1
  fi

  tier=$(doc_sync_staged_change_tier "$root" "$path" "$status")
  doc_sync_tier_requires_gate "$tier"
}

doc_sync_staged_change_requires_strict_review() {
  local root path status level
  root="${1:-}"
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  level=$(doc_sync_staged_change_gate_level "$root" "$path" "$status")
  doc_sync_gate_level_requires_strict_review "$level"
}

doc_sync_staged_change_requires_t2_check() {
  local root path status level
  root="${1:-}"
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  level=$(doc_sync_staged_change_gate_level "$root" "$path" "$status")
  doc_sync_gate_level_requires_t2_check "$level"
}

doc_sync_worktree_change_tier() {
  local root path status
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  if doc_sync_is_generated_path "$path" || doc_sync_is_low_signal_path "$path"; then
    printf 't0\n'
    return 0
  fi

  if doc_sync_is_protected_source_doc_path "$path"; then
    if doc_sync_diff_has_protected_doc_strict_signal "$root" "$path" worktree; then
      printf 't3\n'
    else
      printf 't2\n'
    fi
    return 0
  fi

  if doc_sync_is_repo_workflow_path "$path"; then
    printf 't3\n'
    return 0
  fi

  case "$status" in
    D|R*|C*)
      if doc_sync_is_behavior_path "$path"; then
        if doc_sync_diff_has_hazard_signal "$root" "$path" worktree; then
          printf 't3\n'
        else
          printf 't2\n'
        fi
      else
        printf 't0\n'
      fi
      return 0
      ;;
  esac

  if doc_sync_is_doc_path "$path"; then
    if git -C "$root" diff -- "$path" 2>/dev/null \
      | grep -E -i '^[+-][^+-].*(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)' >/dev/null; then
      printf 't2\n'
    else
      printf 't0\n'
    fi
    return 0
  fi

  if ! doc_sync_is_behavior_path "$path"; then
    printf 't0\n'
    return 0
  fi

  if doc_sync_diff_has_hazard_signal "$root" "$path" worktree || doc_sync_diff_has_high_risk_signal "$root" "$path" worktree; then
    printf 't3\n'
    return 0
  fi

  if doc_sync_staged_diff_is_light "$root" "$path" worktree; then
    printf 't1\n'
    return 0
  fi

  printf 't2\n'
}

doc_sync_worktree_change_gate_level() {
  local root path status tier rank
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  if ! doc_sync_is_source_change_path "$path"; then
    printf 'none\n'
    return 0
  fi

  tier=$(doc_sync_worktree_change_tier "$root" "$path" "$status")
  rank=$(doc_sync_tier_rank "$tier")
  if [ "$rank" -lt 2 ]; then
    printf 'none\n'
    return 0
  fi

  if [ "$tier" = "t3" ] || doc_sync_is_repo_workflow_path "$path"; then
    printf 'strict\n'
    return 0
  fi

  case "$status" in
    D|R*|C*)
      if doc_sync_is_behavior_path "$path"; then
        printf 'strict\n'
        return 0
      fi
      ;;
  esac

  printf 't2-light\n'
}

doc_sync_worktree_change_requires_review() {
  local root path status tier
  root="${1:-}"
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  if ! doc_sync_is_source_change_path "$path"; then
    return 1
  fi

  tier=$(doc_sync_worktree_change_tier "$root" "$path" "$status")
  doc_sync_tier_requires_gate "$tier"
}

doc_sync_worktree_change_requires_strict_review() {
  local root path status level
  root="${1:-}"
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  level=$(doc_sync_worktree_change_gate_level "$root" "$path" "$status")
  doc_sync_gate_level_requires_strict_review "$level"
}

doc_sync_worktree_change_requires_t2_check() {
  local root path status level
  root="${1:-}"
  path=$(doc_sync_normalize_path "${2:-}")
  status="${3:-M}"

  level=$(doc_sync_worktree_change_gate_level "$root" "$path" "$status")
  doc_sync_gate_level_requires_t2_check "$level"
}

doc_sync_untracked_change_tier() {
  local root path
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")

  if doc_sync_is_generated_path "$path" || doc_sync_is_low_signal_path "$path"; then
    printf 't0\n'
    return 0
  fi

  if doc_sync_is_protected_source_doc_path "$path"; then
    if doc_sync_file_has_protected_doc_strict_signal "$root" "$path"; then
      printf 't3\n'
    else
      printf 't2\n'
    fi
    return 0
  fi

  if doc_sync_is_repo_workflow_path "$path"; then
    printf 't3\n'
    return 0
  fi

  if doc_sync_is_doc_path "$path"; then
    if grep -I -E -i '(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)' "$root/$path" >/dev/null 2>&1; then
      printf 't2\n'
    else
      printf 't0\n'
    fi
    return 0
  fi

  if ! doc_sync_is_behavior_path "$path"; then
    printf 't0\n'
    return 0
  fi

  if doc_sync_file_has_hazard_signal "$root" "$path" || doc_sync_file_has_high_risk_signal "$root" "$path"; then
    printf 't3\n'
    return 0
  fi

  printf 't2\n'
}

doc_sync_untracked_change_gate_level() {
  local root path tier rank
  root=$(doc_sync_normalize_root "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")

  if ! doc_sync_is_source_change_path "$path"; then
    printf 'none\n'
    return 0
  fi

  tier=$(doc_sync_untracked_change_tier "$root" "$path")
  rank=$(doc_sync_tier_rank "$tier")
  if [ "$rank" -lt 2 ]; then
    printf 'none\n'
    return 0
  fi

  if [ "$tier" = "t3" ] || doc_sync_is_repo_workflow_path "$path"; then
    printf 'strict\n'
    return 0
  fi

  printf 't2-light\n'
}

doc_sync_untracked_change_requires_review() {
  local root path tier
  root="${1:-}"
  path=$(doc_sync_normalize_path "${2:-}")

  if ! doc_sync_is_source_change_path "$path"; then
    return 1
  fi

  tier=$(doc_sync_untracked_change_tier "$root" "$path")
  doc_sync_tier_requires_gate "$tier"
}

doc_sync_untracked_change_requires_strict_review() {
  local root path level
  root="${1:-}"
  path=$(doc_sync_normalize_path "${2:-}")

  level=$(doc_sync_untracked_change_gate_level "$root" "$path")
  doc_sync_gate_level_requires_strict_review "$level"
}

doc_sync_untracked_change_requires_t2_check() {
  local root path level
  root="${1:-}"
  path=$(doc_sync_normalize_path "${2:-}")

  level=$(doc_sync_untracked_change_gate_level "$root" "$path")
  doc_sync_gate_level_requires_t2_check "$level"
}
