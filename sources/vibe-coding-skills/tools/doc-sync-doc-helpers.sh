# DocMap:
# Layer: L3 / tools internal helper
# Module: tools
# Loaded by: tools/doc-sync-helpers.sh
# Relevant-document pattern and coverage mapping.

doc_sync_print_relevant_doc_patterns_for_source_path() {
  local path scope
  path=$(doc_sync_normalize_path "${1:-}")

  [ -n "$path" ] || return 0

  case "$path" in
    AGENTS.md)
      cat <<'EOF'
.claude/CLAUDE.md
DOC-MAP.md
README.md
skills/INDEX.md
agents/INDEX.md
hooks/INDEX.md
codex-hooks/INDEX.md
tools/INDEX.md
Product-Spec.md
DEV-PLAN.md
TERMINOLOGY-AND-NAMING.md
EOF
      return 0
      ;;
    .claude/CLAUDE.md)
      cat <<'EOF'
AGENTS.md
DOC-MAP.md
README.md
skills/INDEX.md
agents/INDEX.md
hooks/INDEX.md
codex-hooks/INDEX.md
tools/INDEX.md
Product-Spec.md
DEV-PLAN.md
TERMINOLOGY-AND-NAMING.md
EOF
      return 0
      ;;
    DOC-MAP.md)
      cat <<'EOF'
AGENTS.md
.claude/CLAUDE.md
README.md
skills/INDEX.md
agents/INDEX.md
hooks/INDEX.md
codex-hooks/INDEX.md
tools/INDEX.md
Product-Spec.md
DEV-PLAN.md
TERMINOLOGY-AND-NAMING.md
EOF
      return 0
      ;;
    Product-Spec.md)
      cat <<'EOF'
DEV-PLAN.md
Product-Spec-CHANGELOG.md
TERMINOLOGY-AND-NAMING.md
EOF
      return 0
      ;;
    DEV-PLAN.md)
      cat <<'EOF'
Product-Spec.md
TERMINOLOGY-AND-NAMING.md
README.md
EOF
      return 0
      ;;
    TERMINOLOGY-AND-NAMING.md)
      cat <<'EOF'
Product-Spec.md
DEV-PLAN.md
EOF
      return 0
      ;;
    skills/INDEX.md)
      cat <<'EOF'
skills/*
AGENTS.md
.claude/CLAUDE.md
DOC-MAP.md
README.md
Product-Spec.md
DEV-PLAN.md
TERMINOLOGY-AND-NAMING.md
EOF
      return 0
      ;;
    agents/INDEX.md)
      cat <<'EOF'
agents/*
AGENTS.md
.claude/CLAUDE.md
DOC-MAP.md
README.md
Product-Spec.md
DEV-PLAN.md
TERMINOLOGY-AND-NAMING.md
EOF
      return 0
      ;;
    hooks/INDEX.md)
      cat <<'EOF'
hooks/*
.githooks/*
AGENTS.md
.claude/CLAUDE.md
DOC-MAP.md
README.md
Product-Spec.md
DEV-PLAN.md
TERMINOLOGY-AND-NAMING.md
EOF
      return 0
      ;;
    codex-hooks/INDEX.md)
      cat <<'EOF'
codex-hooks/*
.githooks/*
AGENTS.md
.claude/CLAUDE.md
DOC-MAP.md
README.md
Product-Spec.md
DEV-PLAN.md
TERMINOLOGY-AND-NAMING.md
EOF
      return 0
      ;;
    tools/INDEX.md)
      cat <<'EOF'
tools/*
AGENTS.md
.claude/CLAUDE.md
DOC-MAP.md
README.md
Product-Spec.md
DEV-PLAN.md
TERMINOLOGY-AND-NAMING.md
EOF
      return 0
      ;;
  esac

  scope=$(doc_sync_behavior_doc_scope "$path")

  if [ "$scope" = "repo-workflow" ]; then
    cat <<'EOF'
README.md
CHANGELOG.md
CONTRIBUTING.md
DOC-MAP.md
Product-Spec.md
Product-Spec-CHANGELOG.md
DEV-PLAN.md
Design-Brief.md
AGENTS.md
.claude/CLAUDE.md
TERMINOLOGY-AND-NAMING.md
docs/*
plans/*
EOF
  else
    cat <<'EOF'
CHANGELOG.md
Product-Spec.md
Product-Spec-CHANGELOG.md
DEV-PLAN.md
Design-Brief.md
docs/*
plans/*
EOF
  fi

  case "$path" in
    skills/*)
      printf 'skills/INDEX.md\n'
      ;;
    agents/*)
      printf 'agents/INDEX.md\n'
      ;;
    hooks/*)
      printf 'hooks/INDEX.md\n'
      ;;
    codex-hooks/*)
      printf 'codex-hooks/INDEX.md\n'
      ;;
    tools/*)
      printf 'tools/INDEX.md\n'
      ;;
    .githooks/*)
      printf 'hooks/INDEX.md\n'
      printf 'codex-hooks/INDEX.md\n'
      printf 'tools/INDEX.md\n'
      ;;
  esac
}

doc_sync_print_relevant_doc_patterns_for_behavior_path() {
  doc_sync_print_relevant_doc_patterns_for_source_path "$@"
}

doc_sync_is_relevant_doc_for_source_path() {
  local doc_path source_path pattern
  doc_path=$(doc_sync_normalize_path "${1:-}")
  source_path=$(doc_sync_normalize_path "${2:-}")

  if [ -z "$doc_path" ] || [ -z "$source_path" ] || [ "$doc_path" = "$source_path" ]; then
    return 1
  fi

  if ! doc_sync_is_source_change_path "$source_path"; then
    return 1
  fi

  while IFS= read -r pattern; do
    [ -n "$pattern" ] || continue

    case "$doc_path" in
      $pattern)
        return 0
        ;;
    esac
  done < <(doc_sync_print_relevant_doc_patterns_for_source_path "$source_path")

  return 1
}

doc_sync_is_relevant_doc_for_behavior_path() {
  doc_sync_is_relevant_doc_for_source_path "$@"
}
