# DocMap:
# Layer: L3 / tools internal helper
# Module: tools
# Loaded by: tools/doc-sync-helpers.sh
# Repository path normalization and classification.

doc_sync_normalize_path() {
  local path="${1:-}"
  path="${path//$'\r'/}"
  path="${path//\\//}"

  while [ "${path#./}" != "$path" ]; do
    path="${path#./}"
  done

  if [ "$path" = "." ]; then
    path=""
  fi

  printf '%s\n' "$path"
}

# 路径规则按 PowerShell 的大小写不敏感匹配保持跨运行时一致。
doc_sync_lowercase_path() {
  printf '%s' "${1:-}" | LC_ALL=C tr '[:upper:]' '[:lower:]'
  printf '\n'
}

# Normalize a REPOSITORY ROOT path. Unlike doc_sync_normalize_path (which is for
# relative FILE paths and intentionally collapses "." to the empty prefix), a root
# of "." means the current directory and MUST be preserved: it is later used as
# `git -C "$root"` and `"$root/$path"`, both of which break on an empty root.
# This only strips CR and normalizes backslashes; it never empties ".".
doc_sync_normalize_root() {
  local root="${1:-}"
  root="${root//$'\r'/}"
  root="${root//\\//}"
  printf '%s\n' "$root"
}

doc_sync_relativize_path() {
  local root path
  # 此处 root 刻意仍用 doc_sync_normalize_path（而非 doc_sync_normalize_root）：
  # 本函数是 strip-prefix 语义，调用方（各 hook 的 mark-*-needed.sh）传入的 root
  # 均为绝对路径来源（CLAUDE_PROJECT_DIR / $PWD / git rev-parse --show-toplevel），
  # 不会是 "."；且此处不含 [ -z "$root" ] 门禁，归一为空也只影响前缀是否剥离，无 return 1 风险。
  root=$(doc_sync_normalize_path "${1:-}")
  path=$(doc_sync_normalize_path "${2:-}")

  if [ -z "$path" ]; then
    printf '\n'
    return 0
  fi

  case "$path" in
    "$root")
      path=""
      ;;
    "$root"/*)
      path="${path#"$root"/}"
      ;;
  esac

  printf '%s\n' "$path"
}

doc_sync_is_generated_path() {
  local path
  path=$(doc_sync_normalize_path "${1:-}")

  case "$path" in
    .claude/CLAUDE.md)
      return 1
      ;;
    .claude/*|.agents/*|.codex/*|.git/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

doc_sync_is_low_signal_path() {
  local path
  path=$(doc_sync_normalize_path "${1:-}")

  case "$path" in
    ""|*.lock|*.log|*.tmp|*.bak|*.swp|*.swo|.gitignore|.gitattributes|.editorconfig|.DS_Store|Thumbs.db|*.cache)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

doc_sync_is_module_index_path() {
  local path
  path=$(doc_sync_normalize_path "${1:-}")

  case "$path" in
    skills/INDEX.md|agents/INDEX.md|hooks/INDEX.md|codex-hooks/INDEX.md|tools/INDEX.md)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

doc_sync_is_protected_source_doc_path() {
  local path
  path=$(doc_sync_normalize_path "${1:-}")

  case "$path" in
    AGENTS.md|.claude/CLAUDE.md|DOC-MAP.md|Product-Spec.md|DEV-PLAN.md|TERMINOLOGY-AND-NAMING.md|skills/INDEX.md|agents/INDEX.md|hooks/INDEX.md|codex-hooks/INDEX.md|tools/INDEX.md)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

doc_sync_is_source_change_path() {
  local path
  path=$(doc_sync_normalize_path "${1:-}")

  if doc_sync_is_generated_path "$path" || doc_sync_is_low_signal_path "$path"; then
    return 1
  fi

  doc_sync_is_protected_source_doc_path "$path" || doc_sync_is_behavior_path "$path"
}

doc_sync_is_global_doc_path() {
  local path
  path=$(doc_sync_normalize_path "${1:-}")

  case "$path" in
    README.md|CHANGELOG.md|CONTRIBUTING.md|DOC-MAP.md|Product-Spec.md|Product-Spec-CHANGELOG.md|DEV-PLAN.md|Design-Brief.md|AGENTS.md|.claude/CLAUDE.md|TERMINOLOGY-AND-NAMING.md|docs/*|plans/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

doc_sync_behavior_doc_scope() {
  local path
  path=$(doc_sync_normalize_path "${1:-}")

  case "$path" in
    skills/*|agents/*|hooks/*|codex-hooks/*|tools/*|.githooks/*|settings.json|codex-hooks.json)
      printf 'repo-workflow\n'
      ;;
    *)
      printf 'project-surface\n'
      ;;
  esac
}

doc_sync_is_doc_path() {
  local path
  path=$(doc_sync_normalize_path "${1:-}")

  if doc_sync_is_generated_path "$path" || doc_sync_is_low_signal_path "$path"; then
    return 1
  fi

  if doc_sync_is_module_index_path "$path"; then
    return 0
  fi

  case "$path" in
    skills/*|agents/*|hooks/*|codex-hooks/*|tools/*|.githooks/*)
      return 1
      ;;
    README.md|CHANGELOG.md|CONTRIBUTING.md|Product-Spec.md|Product-Spec-CHANGELOG.md|DEV-PLAN.md|Design-Brief.md|AGENTS.md|.claude/CLAUDE.md|docs/*|plans/*|*.md|*.mdx|*.txt)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}
