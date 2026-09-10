#!/bin/bash
# DocMap:
# Layer: L3 / validation test
# Module: tools
# Depends on: tools/check-target-doc-names.mjs
# Syncs with: tools/INDEX.md
# Verifies target-project lifecycle Markdown naming enforcement.

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(dirname "$SCRIPT_DIR")
CHECKER="$REPO_ROOT/tools/check-target-doc-names.mjs"

TMP_ROOT=""

cleanup() {
  if [ -n "$TMP_ROOT" ] && [ -d "$TMP_ROOT" ]; then
    rm -rf "$TMP_ROOT"
  fi
}

trap cleanup EXIT

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

pass() {
  printf '[PASS] %s\n' "$1"
}

expect_pass() {
  local label="$1"
  shift
  if "$@"; then
    pass "$label"
  else
    fail "$label"
  fi
}

expect_fail() {
  local label="$1"
  shift
  if "$@"; then
    fail "$label"
  else
    pass "$label"
  fi
}

make_case_root() {
  local name="$1"
  local root="$TMP_ROOT/$name"
  mkdir -p "$root/plans"
  printf '%s\n' "$root"
}

case_valid_mapping_passes() {
  local root
  root=$(make_case_root "valid")
  cat > "$root/.vibe-docs.json" <<'JSON'
{
  "productSpec": "需求文档.md",
  "productSpecChangelog": "需求变更.md",
  "designBrief": "设计简报.md",
  "devPlan": "开发计划.md",
  "currentExecution": "plans/执行光标.md",
  "planDetails": ["plans/第一阶段.md", "plans/第二阶段.md"]
}
JSON
  touch "$root/需求文档.md" "$root/需求变更.md" "$root/设计简报.md" "$root/开发计划.md"
  touch "$root/plans/执行光标.md" "$root/plans/第一阶段.md" "$root/plans/第二阶段.md"
  node "$CHECKER" "$root" --require-existing
}

case_archive_index_passes() {
  local root
  root=$(make_case_root "archive-index")
  cat > "$root/.vibe-docs.json" <<'JSON'
{
  "productSpec": "需求文档.md",
  "archiveIndex": "docs/99-归档/索引.md"
}
JSON
  mkdir -p "$root/docs/99-归档"
  touch "$root/需求文档.md" "$root/docs/99-归档/索引.md"
  node "$CHECKER" "$root" --require-existing
}

case_other_archive_name_fails() {
  local root
  root=$(make_case_root "other-archive-name")
  cat > "$root/.vibe-docs.json" <<'JSON'
{
  "productSpec": "需求文档.md",
  "archiveIndex": "docs/99-归档/归档.md"
}
JSON
  node "$CHECKER" "$root"
}

case_bad_name_fails() {
  local root
  root=$(make_case_root "bad-name")
  cat > "$root/.vibe-docs.json" <<'JSON'
{
  "productSpec": "Product-Spec.md"
}
JSON
  node "$CHECKER" "$root"
}

case_legacy_doc_fails() {
  local root
  root=$(make_case_root "legacy")
  cat > "$root/.vibe-docs.json" <<'JSON'
{
  "productSpec": "需求文档.md"
}
JSON
  touch "$root/Product-Spec.md"
  node "$CHECKER" "$root"
}

case_legacy_allowed_passes() {
  local root
  root=$(make_case_root "legacy-allowed")
  cat > "$root/.vibe-docs.json" <<'JSON'
{
  "productSpec": "需求文档.md"
}
JSON
  touch "$root/Product-Spec.md"
  node "$CHECKER" "$root" --allow-legacy
}

case_missing_manifest_fails() {
  local root
  root=$(make_case_root "missing-manifest")
  node "$CHECKER" "$root"
}

main() {
  TMP_ROOT=$(mktemp -d)

  expect_pass "valid mapping passes" case_valid_mapping_passes
  expect_pass "archiveIndex is allowed as a non-lifecycle entry" case_archive_index_passes
  expect_fail "other archive Markdown basenames remain strict" case_other_archive_name_fails
  expect_fail "bad Markdown basename fails" case_bad_name_fails
  expect_fail "legacy doc fails by default" case_legacy_doc_fails
  expect_pass "legacy doc can be allowed explicitly" case_legacy_allowed_passes
  expect_fail "missing manifest fails" case_missing_manifest_fails
}

main "$@"
