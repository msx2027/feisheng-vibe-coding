#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: skills/dev-builder/templates/project-scaffolds/, tools/check-api-contracts.mjs, tools/check-ui-reuse.mjs, tools/check-hotspots.mjs, tools/hotspot-policy.mjs, tools/markdown-governance-core.mjs, tools/check-target-guardrails.mjs, tools/vibe-health-check.mjs, tools/init-target-constitution.mjs, tools/init-target-runtime.mjs, tools/init-target-task-context.mjs, tools/experience-anchor-contract.mjs, tools/experience-ledger-core.mjs, tools/experience-managed-blocks.mjs, tools/target-task-continuity-core.mjs, tools/safe-target-fs.mjs, skills/dev-builder/SKILL.md, tools/INDEX.md
# Syncs with: tools/test-render-project-scaffold.sh, README.md, DOC-MAP.md
# Render reusable Web/Desktop project scaffolds from dev-builder template assets.

set -euo pipefail

# Preserve literal user arguments at the caller boundary, then restore normal
# MSYS path conversion for the Windows-native Node processes launched below.
unset MSYS2_ARG_CONV_EXCL MSYS_NO_PATHCONV

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(dirname "$SCRIPT_DIR")
TEMPLATE_ROOT="$REPO_ROOT/skills/dev-builder/templates/project-scaffolds"
SHARED_DOCS_TEMPLATE_DIR="$TEMPLATE_ROOT/_target-docs"
SHARED_UI_TEMPLATE_DIR="$TEMPLATE_ROOT/_shared-ui"

TEMPLATE_NAME=""
PROJECT_NAME=""
PROJECT_TITLE=""
OUTPUT_DIR=""

usage() {
  cat <<'EOF'
Usage:
  bash ./tools/render-project-scaffold.sh \
    --template <next-feature-first|vite-feature-first|electron-next-feature-first|cli-feature-first> \
    --project-name <project-name> \
    --output <target-dir> \
    [--title <project title>]

Notes:
  - The output directory must not already exist.
  - Project title defaults to the project name.
  - Templates are sourced from skills/dev-builder/templates/project-scaffolds/.
EOF
}

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

log_pass() {
  printf '[PASS] %s\n' "$1"
}

normalize_package_name() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g'
}

validate_text_input() {
  local label="$1"
  local value="$2"

  case "$value" in
    *$'\n'*|*$'\r'*)
      fail "$label must not contain control characters or newlines"
      ;;
  esac
  if LC_ALL=C printf '%s' "$value" | grep -q '[[:cntrl:]]'; then
    fail "$label must not contain control characters or newlines"
  fi
}

validate_template_name() {
  case "$TEMPLATE_NAME" in
    next-feature-first|vite-feature-first|electron-next-feature-first|cli-feature-first)
      ;;
    *)
      fail "Unknown scaffold template: $TEMPLATE_NAME"
      ;;
  esac
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --template)
        TEMPLATE_NAME="${2:-}"
        shift 2
        ;;
      --project-name)
        PROJECT_NAME="${2:-}"
        shift 2
        ;;
      --output)
        OUTPUT_DIR="${2:-}"
        shift 2
        ;;
      --title)
        PROJECT_TITLE="${2:-}"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
  done
}

render_file() {
  local source_file="$1"
  local target_file="$2"

  if ! grep -Eq '__PROJECT_NAME__|__PROJECT_TITLE__|__NPM_PACKAGE_NAME__' "$source_file"; then
    cp "$source_file" "$target_file"
    return
  fi

  node - "$source_file" "$target_file" "$PROJECT_NAME" "$PROJECT_TITLE" "$NPM_PACKAGE_NAME" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [sourceFile, targetFile, projectName, projectTitle, packageName] = process.argv.slice(2);
const values = new Map([
  ["__PROJECT_NAME__", projectName],
  ["__PROJECT_TITLE__", projectTitle],
  ["__NPM_PACKAGE_NAME__", packageName],
]);
const extension = path.extname(targetFile).toLowerCase();
let content = fs.readFileSync(sourceFile, "utf8");

function jsStringLiteral(value) {
  return JSON.stringify(value)
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
}

function templateLiteralText(value) {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/`/gu, "\\`")
    .replace(/\$\{/gu, "\\${")
    .replace(/\r/gu, "\\r")
    .replace(/\n/gu, "\\n")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
}

function markupText(value) {
  return value.replace(/[&<>"'{}]/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "{": "&#123;",
    "}": "&#125;",
  })[character]);
}

function markdownText(value) {
  const markdownEscaped = value.replace(/([\\`*_[\]()#+\-.!|])/gu, "\\$1");
  return markupText(markdownEscaped);
}

function replaceQuotedJsToken(source, token, value) {
  const literal = jsStringLiteral(value);
  return source
    .replaceAll(`"${token}"`, () => literal)
    .replaceAll(`'${token}'`, () => literal);
}

if ([".json", ".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx"].includes(extension)) {
  for (const [token, value] of values) content = replaceQuotedJsToken(content, token, value);
}

for (const [token, value] of values) {
  if (!content.includes(token)) continue;
  if ([".mjs", ".js", ".cjs"].includes(extension)) {
    content = content.replaceAll(token, () => templateLiteralText(value));
  } else if ([".tsx", ".jsx", ".html", ".htm"].includes(extension)) {
    content = content.replaceAll(token, () => markupText(value));
  } else if (extension === ".md") {
    content = content.replaceAll(token, () => markdownText(value));
  } else {
    throw new Error(`Unsupported placeholder context in ${sourceFile}: ${token}`);
  }
}

for (const token of values.keys()) {
  if (content.includes(token)) throw new Error(`Unrendered placeholder in ${sourceFile}: ${token}`);
}

fs.writeFileSync(targetFile, content, "utf8");
NODE
}

render_template_tree() {
  local source_dir="$1"
  local path relative_path target_path

  [ -d "$source_dir" ] || return 0

  while IFS= read -r path; do
    relative_path="${path#$source_dir/}"
    target_path=$(resolve_target_path "$relative_path")
    target_path="$OUTPUT_DIR/$target_path"

    if [ -d "$path" ]; then
      mkdir -p "$target_path"
      continue
    fi

    mkdir -p "$(dirname "$target_path")"
    render_file "$path" "$target_path"
  done < <(find "$source_dir" -mindepth 1 | sort)
}

include_shared_ui_template() {
  case "$TEMPLATE_NAME" in
    next-feature-first|vite-feature-first|electron-next-feature-first)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

copy_shared_tools() {
  local tool_name source_path

  mkdir -p "$OUTPUT_DIR/tools"

  for tool_name in archive-lifecycle-docs.mjs build-target-doc-index.mjs check-api-contracts.mjs check-ui-reuse.mjs check-hotspots.mjs hotspot-policy.mjs hotspot-git.mjs check-lifecycle-doc-budget.mjs check-runtime-sync.mjs check-target-doc-drift.mjs check-target-doc-names.mjs check-target-guardrails.mjs check-target-constitution.mjs experience-anchor-contract.mjs experience-ledger-core.mjs experience-managed-blocks.mjs init-target-constitution.mjs init-target-runtime.mjs init-target-task-context.mjs markdown-governance-core.mjs migrate-target-doc-system.mjs resolve-target-doc-context.mjs target-doc-index-core.mjs target-doc-manifest-core.mjs target-doc-manifest-schema.mjs target-doc-migration-helpers.mjs target-doc-transaction.mjs target-task-continuity-core.mjs update-target-task-state.mjs setup-target-hooks.mjs safe-target-fs.mjs trusted-git.mjs vibe-health-check.mjs; do
    source_path="$REPO_ROOT/tools/$tool_name"
    [ -f "$source_path" ] || continue
    cp "$source_path" "$OUTPUT_DIR/tools/$tool_name"
  done
}

init_target_runtime_rules() {
  node "$REPO_ROOT/tools/init-target-constitution.mjs" "$OUTPUT_DIR" --skills-root "$REPO_ROOT" --write >/dev/null
  node "$REPO_ROOT/tools/build-target-doc-index.mjs" "$OUTPUT_DIR" --write >/dev/null
  node "$REPO_ROOT/tools/init-target-runtime.mjs" "$OUTPUT_DIR" --skills-root "$REPO_ROOT" --write >/dev/null
  # 安装 pre-commit 钩子：提交前校验 runtime 同步与 staged 结构热区棘轮。
  node "$REPO_ROOT/tools/setup-target-hooks.mjs" "$OUTPUT_DIR" >/dev/null
}

resolve_target_path() {
  local relative_path="$1"
  local trimmed basename dirname_path

  trimmed="${relative_path%.template}"
  dirname_path=$(dirname "$trimmed")
  basename=$(basename "$trimmed")

  if [[ "$basename" == _* ]]; then
    basename=".${basename#_}"
  fi

  if [ "$dirname_path" = "." ]; then
    printf '%s\n' "$basename"
  else
    printf '%s/%s\n' "$dirname_path" "$basename"
  fi
}

main() {
  local template_dir template_root_real template_dir_real

  parse_args "$@"

  [ -n "$TEMPLATE_NAME" ] || fail "Missing required argument: --template"
  [ -n "$PROJECT_NAME" ] || fail "Missing required argument: --project-name"
  [ -n "$OUTPUT_DIR" ] || fail "Missing required argument: --output"

  PROJECT_TITLE="${PROJECT_TITLE:-$PROJECT_NAME}"
  validate_template_name
  validate_text_input "Project name" "$PROJECT_NAME"
  validate_text_input "Project title" "$PROJECT_TITLE"
  NPM_PACKAGE_NAME=$(normalize_package_name "$PROJECT_NAME")
  [ -n "$NPM_PACKAGE_NAME" ] || fail "Could not derive a valid package name from project name: $PROJECT_NAME"

  template_dir="$TEMPLATE_ROOT/$TEMPLATE_NAME"
  [ -d "$template_dir" ] || fail "Unknown scaffold template: $TEMPLATE_NAME"
  template_root_real=$(CDPATH= cd -- "$TEMPLATE_ROOT" && pwd -P)
  template_dir_real=$(CDPATH= cd -- "$template_dir" && pwd -P)
  case "$template_dir_real/" in
    "$template_root_real/"*) ;;
    *) fail "Scaffold template resolves outside template root: $TEMPLATE_NAME" ;;
  esac
  [ ! -e "$OUTPUT_DIR" ] || fail "Output path already exists: $OUTPUT_DIR"

  mkdir -p "$OUTPUT_DIR"

  render_template_tree "$SHARED_DOCS_TEMPLATE_DIR"

  if include_shared_ui_template; then
    render_template_tree "$SHARED_UI_TEMPLATE_DIR"
  fi

  copy_shared_tools
  render_template_tree "$template_dir"
  init_target_runtime_rules

  log_pass "Rendered scaffold '$TEMPLATE_NAME' into $OUTPUT_DIR"
  log_pass "Project title: $PROJECT_TITLE"
  log_pass "Package name: $NPM_PACKAGE_NAME"
}

main "$@"
