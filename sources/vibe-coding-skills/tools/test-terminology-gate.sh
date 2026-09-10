#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: tools/pre-commit-gate.sh, tools/terminology-gate.sh, tools/check-terminology-consistency.sh, tools/doc-sync-helpers.sh
# Syncs with: tools/INDEX.md, tools/test-terminology-consistency.sh
# Smoke tests for terminology gate + pre-commit chain order.

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SOURCE_ROOT=$(dirname "$SCRIPT_DIR")
TMP_ROOT=$(mktemp -d)
REPO_TEMPLATE_ROOT=""

cleanup() {
  rm -rf "$TMP_ROOT"
}

trap cleanup EXIT

copy_tree() {
  local source_root="$1"
  local target_root="$2"

  mkdir -p "$target_root"
  cp -R "$source_root"/. "$target_root"/
}

copy_gate_files() {
  local repo_root="$1"

  mkdir -p "$repo_root/tools" "$repo_root/hooks" "$repo_root/src/features/work-item" "$repo_root/.claude"

  cp "$SOURCE_ROOT/tools/doc-sync-helpers.sh" "$repo_root/tools/doc-sync-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-path-helpers.sh" "$repo_root/tools/doc-sync-path-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-doc-helpers.sh" "$repo_root/tools/doc-sync-doc-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-tier-helpers.sh" "$repo_root/tools/doc-sync-tier-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-state-helpers.sh" "$repo_root/tools/doc-sync-state-helpers.sh"
  cp "$SOURCE_ROOT/tools/review-gate.sh" "$repo_root/tools/review-gate.sh"
  cp "$SOURCE_ROOT/tools/mark-review-clean.sh" "$repo_root/tools/mark-review-clean.sh"
  cp "$SOURCE_ROOT/tools/mark-t2-check-clean.mjs" "$repo_root/tools/mark-t2-check-clean.mjs"
  cp "$SOURCE_ROOT/tools/safe-target-fs.mjs" "$repo_root/tools/safe-target-fs.mjs"
  cp "$SOURCE_ROOT/tools/trusted-git.mjs" "$repo_root/tools/trusted-git.mjs"
  cp "$SOURCE_ROOT/tools/minimal-quality-gate.sh" "$repo_root/tools/minimal-quality-gate.sh"
  cp "$SOURCE_ROOT/tools/structural-gate.sh" "$repo_root/tools/structural-gate.sh"
  cp "$SOURCE_ROOT/tools/structural-lint.mjs" "$repo_root/tools/structural-lint.mjs"
  cp "$SOURCE_ROOT/tools/check-terminology-consistency.sh" "$repo_root/tools/check-terminology-consistency.sh"
  cp "$SOURCE_ROOT/tools/terminology-path-helpers.sh" "$repo_root/tools/terminology-path-helpers.sh"
  cp "$SOURCE_ROOT/tools/terminology-content-helpers.sh" "$repo_root/tools/terminology-content-helpers.sh"
  cp "$SOURCE_ROOT/tools/terminology-gate.sh" "$repo_root/tools/terminology-gate.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-gate.sh" "$repo_root/tools/doc-sync-gate.sh"
  cp "$SOURCE_ROOT/tools/pre-commit-gate.sh" "$repo_root/tools/pre-commit-gate.sh"
}

write_valid_spec() {
  local repo_root="$1"
  cat > "$repo_root/Product-Spec.md" <<'EOF'
# Product Spec

## 术语与命名规范
| 对象ID | 类别 | 统一口径 | 禁用别名 | 代码命名映射 | 适用范围 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| work-item | 核心对象 | 工作项 | job_item | work_item | 全仓 | active | 统一业务对象名。 |
| work-item-module | 模块 | 工作项模块 | task_module | work_item_module | src/features | active | 模块术语。 |
EOF
}

write_valid_plan() {
  local repo_root="$1"
  cat > "$repo_root/DEV-PLAN.md" <<'EOF'
# DEV-PLAN

## 术语对齐

### 本轮术语变更清单
| 对象ID | 变更类型 | 影响范围 | 必须回写文件 | 完成状态 |
| --- | --- | --- | --- | --- |
| work-item | 沿用 | docs + code | Product-Spec.md; DEV-PLAN.md | done |
| work-item-module | 沿用 | docs + code | Product-Spec.md; DEV-PLAN.md | done |
EOF
}

populate_repo() {
  local repo_root="$1"

  mkdir -p "$repo_root"
  copy_gate_files "$repo_root"
  write_valid_spec "$repo_root"
  write_valid_plan "$repo_root"

  cat > "$repo_root/README.md" <<'EOF'
# demo

统一口径：工作项。
EOF

  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "ready";
EOF

  cat > "$repo_root/AGENTS.md" <<'EOF'
# demo
EOF

  cat > "$repo_root/settings.json" <<'EOF'
{"hooks":[]}
EOF

  cat > "$repo_root/tools/minimal-quality-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  cat > "$repo_root/tools/structural-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  chmod +x \
    "$repo_root/tools/minimal-quality-gate.sh" \
    "$repo_root/tools/structural-gate.sh"

  git -C "$repo_root" init -q
  git -C "$repo_root" config user.email "terminology-gate@example.com"
  git -C "$repo_root" config user.name "Terminology Gate Test"
  git -C "$repo_root" config core.autocrlf false
  git -C "$repo_root" add .
  git -C "$repo_root" commit -qm "init"
}

ensure_repo_template() {
  if [ -n "$REPO_TEMPLATE_ROOT" ] && [ -d "$REPO_TEMPLATE_ROOT" ]; then
    return 0
  fi

  REPO_TEMPLATE_ROOT="$TMP_ROOT/_terminology-gate-repo-template"
  populate_repo "$REPO_TEMPLATE_ROOT"
}

create_repo() {
  local repo_root="$1"

  ensure_repo_template
  rm -rf "$repo_root"
  copy_tree "$REPO_TEMPLATE_ROOT" "$repo_root"
}

write_svg_text_contract() {
  local repo_root="$1"
  shift
  local path

  cat > "$repo_root/.editorconfig" <<'EOF'
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.svg]
charset = unset
end_of_line = unset
insert_final_newline = unset
trim_trailing_whitespace = unset
EOF

  for path in "$@"; do
    cat >> "$repo_root/.editorconfig" <<EOF

[$path]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
EOF
  done

  cat > "$repo_root/.gitattributes" <<'EOF'
* text=auto eol=lf
*.svg binary
EOF

  for path in "$@"; do
    printf '/%s text eol=lf\n' "$path" >> "$repo_root/.gitattributes"
  done
}

run_pre_commit_gate() {
  local repo_root="$1"
  local output_file="$TMP_ROOT/pre-commit-gate.log"

  if bash "$repo_root/tools/pre-commit-gate.sh" "$repo_root" >"$output_file" 2>&1; then
    return 0
  fi

  cat "$output_file" >&2
  return 1
}

run_pre_commit_gate_capture() {
  local repo_root="$1"
  local output_file="$2"

  if bash "$repo_root/tools/pre-commit-gate.sh" "$repo_root" >"$output_file" 2>&1; then
    return 0
  fi

  return 1
}

TERMINOLOGY_BLOCK_MESSAGE='[terminology-gate] blocked:'
DOC_SYNC_BLOCK_MESSAGE='related docs:'
REVIEW_NOT_CLEAN_MESSAGE='检测到需要 review 的 staged source changes，但 `.claude/.needs-review` 不是 `clean`。'
T2_CHECK_NOT_CLEAN_MESSAGE='检测到普通 T2 staged source changes，但缺少有效的轻量 T2 检查快照。'

output_must_contain() {
  local output_file="$1"
  local needle="$2"

  grep -Fq "$needle" "$output_file"
}

output_must_not_contain() {
  local output_file="$1"
  local needle="$2"

  if grep -Fq "$needle" "$output_file"; then
    return 1
  fi

  return 0
}

run_staged_terminology_check() {
  local repo_root="$1"
  bash "$repo_root/tools/check-terminology-consistency.sh" --root "$repo_root" --mode staged >/dev/null 2>&1
}

run_repo_terminology_check_capture() {
  local repo_root="$1"
  local output_file="$2"

  if bash "$repo_root/tools/check-terminology-consistency.sh" --root "$repo_root" --mode repo >"$output_file" 2>&1; then
    return 0
  fi

  return 1
}

mark_review_clean() {
  local repo_root="$1"
  bash "$repo_root/tools/mark-review-clean.sh" "$repo_root" >/dev/null
}

mark_t2_check_clean() {
  local repo_root="$1"
  node "$repo_root/tools/mark-t2-check-clean.mjs" "$repo_root" --evidence "terminology gate regression passed" >/dev/null
}

assert_passes() {
  local name="$1"
  shift

  if "$@"; then
    echo "[PASS] $name"
    return 0
  fi

  echo "[FAIL] $name" >&2
  exit 1
}

assert_fails() {
  local name="$1"
  shift

  if "$@"; then
    echo "[FAIL] $name" >&2
    exit 1
  fi

  echo "[PASS] $name"
}

case_pre_commit_passes_with_review_docs_and_terminology_clean() {
  local repo_root="$TMP_ROOT/case_pre_commit_passes_with_review_docs_and_terminology_clean"
  create_repo "$repo_root"

  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "changed";
EOF
  printf '\n\n同步备注：work-item 模块已更新。\n' >> "$repo_root/DEV-PLAN.md"
  printf '\n\n同步备注：work-item 模块已更新。\n' >> "$repo_root/Product-Spec.md"
  git -C "$repo_root" add src/features/work-item/index.ts DEV-PLAN.md Product-Spec.md
  mark_review_clean "$repo_root"
  run_pre_commit_gate "$repo_root"
}

case_terminology_gate_blocks_forbidden_alias() {
  local repo_root="$TMP_ROOT/case_terminology_gate_blocks_forbidden_alias"
  local output_file="$TMP_ROOT/case_terminology_gate_blocks_forbidden_alias.log"
  create_repo "$repo_root"

  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export const job_item = "changed";
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

统一口径：工作项（文档已更新）。
EOF

  git -C "$repo_root" add src/features/work-item/index.ts README.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  return 1
}

case_terminology_gate_still_blocks_staged_asset_text() {
  local repo_root="$TMP_ROOT/case_terminology_gate_still_blocks_staged_asset_text"
  local output_file="$TMP_ROOT/case_terminology_gate_still_blocks_staged_asset_text.log"
  create_repo "$repo_root"

  mkdir -p "$repo_root/skills/ui-styling/canvas-fonts"
  cat > "$repo_root/skills/ui-styling/canvas-fonts/alias-license.txt" <<'EOF'
job_item should still block when this asset text is staged.
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

统一口径：工作项（文档已更新）。
EOF

  git -C "$repo_root" add skills/ui-styling/canvas-fonts/alias-license.txt README.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq 'skills/ui-styling/canvas-fonts/alias-license.txt' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  return 1
}

case_terminology_gate_blocks_asset_only_staged_text_before_doc_sync() {
  local repo_root="$TMP_ROOT/case_terminology_gate_blocks_asset_only_staged_text_before_doc_sync"
  local output_file="$TMP_ROOT/case_terminology_gate_blocks_asset_only_staged_text_before_doc_sync.log"
  create_repo "$repo_root"

  mkdir -p "$repo_root/skills/ui-styling/canvas-fonts"
  cat > "$repo_root/skills/ui-styling/canvas-fonts/alias-license.txt" <<'EOF'
job_item should still block when this is the only staged text asset.
EOF

  git -C "$repo_root" add skills/ui-styling/canvas-fonts/alias-license.txt
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  output_must_contain "$output_file" "$TERMINOLOGY_BLOCK_MESSAGE" || return 0
  output_must_contain "$output_file" 'skills/ui-styling/canvas-fonts/alias-license.txt' || return 0
  output_must_contain "$output_file" 'job_item' || return 0
  output_must_not_contain "$output_file" "$DOC_SYNC_BLOCK_MESSAGE" || return 0
  output_must_not_contain "$output_file" "$REVIEW_NOT_CLEAN_MESSAGE" || return 0
  return 1
}

case_terminology_gate_blocks_opted_in_repo_owned_svg() {
  local repo_root="$TMP_ROOT/case_terminology_gate_blocks_opted_in_repo_owned_svg"
  local output_file="$TMP_ROOT/case_terminology_gate_blocks_opted_in_repo_owned_svg.log"
  create_repo "$repo_root"
  write_svg_text_contract "$repo_root" "skills/demo-skill/assets/owned.svg"

  mkdir -p "$repo_root/skills/demo-skill/assets"
  cat > "$repo_root/skills/demo-skill/assets/owned.svg" <<'EOF'
<svg>
  <text>job_item should still block when this opted-in SVG is staged.</text>
</svg>
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

文档已同步。
EOF

  git -C "$repo_root" add .editorconfig .gitattributes skills/demo-skill/assets/owned.svg README.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq 'skills/demo-skill/assets/owned.svg' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  return 1
}

case_terminology_gate_blocks_missing_registry_or_change_list() {
  local repo_root="$TMP_ROOT/case_terminology_gate_blocks_missing_registry_or_change_list"
  local output_file="$TMP_ROOT/case_terminology_gate_blocks_missing_registry_or_change_list.log"
  create_repo "$repo_root"

  cat > "$repo_root/Product-Spec.md" <<'EOF'
# Product Spec

## 术语与命名规范
无表格，结构非法。
EOF
  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "changed";
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

文档有同步。
EOF

  git -C "$repo_root" add Product-Spec.md src/features/work-item/index.ts README.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  return 1
}

case_ordinary_t2_behavior_without_docs_passes_after_targeted_check() {
  local repo_root="$TMP_ROOT/case_ordinary_t2_behavior_without_docs_passes_after_targeted_check"
  local output_file="$TMP_ROOT/case_ordinary_t2_behavior_without_docs_passes_after_targeted_check.log"
  create_repo "$repo_root"

  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "changed";
EOF

  git -C "$repo_root" add src/features/work-item/index.ts
  mark_t2_check_clean "$repo_root" || return 1
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  output_must_not_contain "$output_file" "$DOC_SYNC_BLOCK_MESSAGE"
  output_must_not_contain "$output_file" "$TERMINOLOGY_BLOCK_MESSAGE"
  output_must_not_contain "$output_file" "$REVIEW_NOT_CLEAN_MESSAGE"
}

case_t2_check_gate_blocks_first_when_not_clean() {
  local repo_root="$TMP_ROOT/case_t2_check_gate_blocks_first_when_not_clean"
  local output_file="$TMP_ROOT/case_t2_check_gate_blocks_first_when_not_clean.log"
  create_repo "$repo_root"

  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export const job_item = "changed";
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

文档有同步。
EOF

  git -C "$repo_root" add src/features/work-item/index.ts README.md
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  output_must_contain "$output_file" "$T2_CHECK_NOT_CLEAN_MESSAGE" || return 0
  output_must_not_contain "$output_file" "$TERMINOLOGY_BLOCK_MESSAGE" || return 0
  output_must_not_contain "$output_file" "$DOC_SYNC_BLOCK_MESSAGE" || return 0
  output_must_not_contain "$output_file" "$REVIEW_NOT_CLEAN_MESSAGE" || return 0
  return 1
}

case_docs_only_clean_terms_pass() {
  local repo_root="$TMP_ROOT/case_docs_only_clean_terms_pass"
  create_repo "$repo_root"

  cat > "$repo_root/README.md" <<'EOF'
# demo

仅文档更新。
EOF

  git -C "$repo_root" add README.md
  run_pre_commit_gate "$repo_root"
}

case_docs_only_alias_in_doc_still_blocks() {
  local repo_root="$TMP_ROOT/case_docs_only_alias_in_doc_still_blocks"
  local output_file="$TMP_ROOT/case_docs_only_alias_in_doc_still_blocks.log"
  create_repo "$repo_root"

  cat > "$repo_root/README.md" <<'EOF'
# demo

这里把禁用别名写回文档：job_item。
EOF

  git -C "$repo_root" add README.md
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  return 1
}

case_docs_only_invalid_registry_still_blocks() {
  local repo_root="$TMP_ROOT/case_docs_only_invalid_registry_still_blocks"
  local output_file="$TMP_ROOT/case_docs_only_invalid_registry_still_blocks.log"
  create_repo "$repo_root"

  cat > "$repo_root/Product-Spec.md" <<'EOF'
# Product Spec

## 术语与命名规范
无表格，结构非法。
EOF

  git -C "$repo_root" add Product-Spec.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq '术语与命名规范' "$output_file" || return 0
  return 1
}

case_non_staged_drift_is_left_to_repo_baseline_and_does_not_block_staged_gate() {
  local repo_root="$TMP_ROOT/case_non_staged_drift_is_left_to_repo_baseline_and_does_not_block_staged_gate"
  local output_file="$TMP_ROOT/case_non_staged_drift_is_left_to_repo_baseline_and_does_not_block_staged_gate.log"
  local repo_output_file="$TMP_ROOT/case_non_staged_drift_is_left_to_repo_baseline_and_does_not_block_staged_gate.repo.log"
  create_repo "$repo_root"

  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "changed";
EOF
  printf '\n\n同步备注：work-item 模块已更新。\n' >> "$repo_root/DEV-PLAN.md"
  printf '\n\n同步备注：work-item 模块已更新。\n' >> "$repo_root/Product-Spec.md"
  git -C "$repo_root" add src/features/work-item/index.ts DEV-PLAN.md Product-Spec.md
  mark_review_clean "$repo_root"

  mkdir -p "$repo_root/docs"
  cat > "$repo_root/docs/history-example.md" <<'EOF'
这里保留历史术语：job_item。
EOF

  run_pre_commit_gate_capture "$repo_root" "$output_file"
  output_must_not_contain "$output_file" '[WARN] 非硬拦范围仍存在禁用别名'

  run_repo_terminology_check_capture "$repo_root" "$repo_output_file"
  grep -Fq '[WARN] 非硬拦范围仍存在禁用别名' "$repo_output_file"
  grep -Fq 'job_item' "$repo_output_file"
}

case_staged_mode_allows_registry_alias_rows_in_main_docs() {
  local repo_root="$TMP_ROOT/case_staged_mode_allows_registry_alias_rows_in_main_docs"
  local alias_name='naming'"_magic"
  create_repo "$repo_root"

  cat > "$repo_root/Product-Spec.md" <<EOF
# Product Spec

## 术语与命名规范
| 对象ID | 类别 | 统一口径 | 禁用别名 | 代码命名映射 | 适用范围 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| work-item | 核心对象 | 工作项 | job_item | work_item | 全仓 | active | 统一业务对象名。 |
| work-item-module | 模块 | 工作项模块 | task_module、${alias_name} | work_item_module | src/features | active | 合法更新禁用别名。 |
EOF
  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "changed";
EOF

  git -C "$repo_root" add Product-Spec.md src/features/work-item/index.ts
  run_staged_terminology_check "$repo_root"
}

case_staged_mode_allows_alias_rows_in_terminology_main_table() {
  local repo_root="$TMP_ROOT/case_staged_mode_allows_alias_rows_in_terminology_main_table"
  local alias_name='naming'"_magic"
  create_repo "$repo_root"

  cat > "$repo_root/TERMINOLOGY-AND-NAMING.md" <<EOF
# Terminology and Naming

## 默认术语表
| 类别 | 统一口径 | 避免写法 | 代码命名映射 | 说明 |
| --- | --- | --- | --- | --- |
| 路由方式 | 隐藏路由 | auto_guess、${alias_name} | hidden_routing | 合法登记禁用别名。 |
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

文档已同步。
EOF

  git -C "$repo_root" add TERMINOLOGY-AND-NAMING.md README.md
  run_staged_terminology_check "$repo_root"
}

case_docs_only_alias_in_terminology_source_still_blocks() {
  local repo_root="$TMP_ROOT/case_docs_only_alias_in_terminology_source_still_blocks"
  local output_file="$TMP_ROOT/case_docs_only_alias_in_terminology_source_still_blocks.log"
  create_repo "$repo_root"

  cat > "$repo_root/TERMINOLOGY-AND-NAMING.md" <<'EOF'
# Terminology and Naming

这里不允许写 job_item 这种禁用别名。
EOF

  git -C "$repo_root" add TERMINOLOGY-AND-NAMING.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq 'TERMINOLOGY-AND-NAMING.md' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  return 1
}

case_terminology_gate_blocks_unregistered_module_basename() {
  local repo_root="$TMP_ROOT/case_terminology_gate_blocks_unregistered_module_basename"
  local output_file="$TMP_ROOT/case_terminology_gate_blocks_unregistered_module_basename.log"
  create_repo "$repo_root"

  mkdir -p "$repo_root/src/features/job-item"
  cat > "$repo_root/src/features/job-item/index.ts" <<'EOF'
export const WorkItemModule = "changed";
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

文档有同步。
EOF

  git -C "$repo_root" add src/features/job-item/index.ts README.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq "job-item" "$output_file" || return 0
  return 1
}

case_terminology_gate_blocks_unregistered_public_export_name() {
  local repo_root="$TMP_ROOT/case_terminology_gate_blocks_unregistered_public_export_name"
  local output_file="$TMP_ROOT/case_terminology_gate_blocks_unregistered_public_export_name.log"
  create_repo "$repo_root"

  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "ready";
export const SurpriseModule = "changed";
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

文档有同步。
EOF

  git -C "$repo_root" add src/features/work-item/index.ts README.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq "SurpriseModule" "$output_file" || return 0
  return 1
}

case_terminology_gate_blocks_unregistered_hook_export_name() {
  local repo_root="$TMP_ROOT/case_terminology_gate_blocks_unregistered_hook_export_name"
  local output_file="$TMP_ROOT/case_terminology_gate_blocks_unregistered_hook_export_name.log"
  create_repo "$repo_root"

  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "ready";
export function useSurprise() {
  return "changed";
}
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

文档有同步。
EOF

  git -C "$repo_root" add src/features/work-item/index.ts README.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq "useSurprise" "$output_file" || return 0
  return 1
}

case_terminology_gate_allows_private_helper_filename() {
  local repo_root="$TMP_ROOT/case_terminology_gate_allows_private_helper_filename"
  create_repo "$repo_root"

  mkdir -p "$repo_root/src/features/work-item/helpers"
  cat > "$repo_root/src/features/work-item/helpers/surprise.ts" <<'EOF'
export const surprise = "helper";
EOF
  printf '\n\n同步备注：private helper 已新增。\n' >> "$repo_root/DEV-PLAN.md"
  printf '\n\n同步备注：private helper 已新增。\n' >> "$repo_root/Product-Spec.md"
  git -C "$repo_root" add src/features/work-item/helpers/surprise.ts DEV-PLAN.md Product-Spec.md
  mark_review_clean "$repo_root"
  run_pre_commit_gate "$repo_root"
}

case_terminology_gate_blocks_multiline_public_export_name() {
  local repo_root="$TMP_ROOT/case_terminology_gate_blocks_multiline_public_export_name"
  local output_file="$TMP_ROOT/case_terminology_gate_blocks_multiline_public_export_name.log"
  create_repo "$repo_root"

  cat > "$repo_root/src/features/work-item/public-api.ts" <<'EOF'
export const WorkItemModule = "ready";
export const SurpriseModule = "changed";
EOF
  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export {
  WorkItemModule,
  SurpriseModule
} from "./public-api";
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

文档有同步。
EOF

  git -C "$repo_root" add src/features/work-item/public-api.ts src/features/work-item/index.ts README.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq "SurpriseModule" "$output_file" || return 0
  return 1
}

case_terminology_gate_blocks_existing_multiline_public_export_addition() {
  local repo_root="$TMP_ROOT/case_terminology_gate_blocks_existing_multiline_public_export_addition"
  local output_file="$TMP_ROOT/case_terminology_gate_blocks_existing_multiline_public_export_addition.log"
  create_repo "$repo_root"

  cat > "$repo_root/src/features/work-item/public-api.ts" <<'EOF'
export const WorkItemModule = "ready";
export const SurpriseModule = "already-internal";
EOF
  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export {
  WorkItemModule,
} from "./public-api";
EOF
  git -C "$repo_root" add src/features/work-item/public-api.ts src/features/work-item/index.ts
  git -C "$repo_root" commit -qm "seed internal export only"

  cat > "$repo_root/src/features/work-item/index.ts" <<'EOF'
export {
  WorkItemModule,
  SurpriseModule,
} from "./public-api";
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

文档有同步。
EOF

  git -C "$repo_root" add src/features/work-item/index.ts README.md
  mark_review_clean "$repo_root"
  local status=0
  set +e
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq '[terminology-gate] blocked:' "$output_file" || return 0
  grep -Fq "SurpriseModule" "$output_file" || return 0
  return 1
}

case_non_staged_invalid_main_doc_is_not_visible_to_staged_gate() {
  local repo_root="$TMP_ROOT/case_non_staged_invalid_main_doc_is_not_visible_to_staged_gate"
  local output_file="$TMP_ROOT/case_non_staged_invalid_main_doc_is_not_visible_to_staged_gate.log"
  create_repo "$repo_root"

  cat > "$repo_root/Product-Spec.md" <<'EOF'
# Product Spec

## 术语与命名规范
无表格，结构非法。
EOF
  cat > "$repo_root/README.md" <<'EOF'
# demo

文档有同步。
EOF

  git -C "$repo_root" add README.md
  run_pre_commit_gate_capture "$repo_root" "$output_file"
  if grep -Fq '[terminology-gate] blocked:' "$output_file"; then
    return 1
  fi
  if grep -Fq '[WARN] Product-Spec.md 的“术语与命名规范”缺少表格。' "$output_file"; then
    return 1
  fi
}

assert_passes "behavior + docs + review clean + terminology clean 时 pre-commit 通过" case_pre_commit_passes_with_review_docs_and_terminology_clean
assert_fails "behavior + docs + review clean + forbidden alias 被 terminology gate 拦住" case_terminology_gate_blocks_forbidden_alias
assert_fails "behavior + docs + review clean + 缺严格注册表时被 terminology gate 拦住" case_terminology_gate_blocks_missing_registry_or_change_list
assert_passes "普通 T2 behavior + no docs + 定向验证快照时 pre-commit 通过" case_ordinary_t2_behavior_without_docs_passes_after_targeted_check
assert_fails "普通 T2 behavior + no T2 check + 同时存在术语问题时仍由 T2 check gate 最先拦住，后续 gate 不继续输出" case_t2_check_gate_blocks_first_when_not_clean
assert_passes "docs only 且术语干净时仍可通过" case_docs_only_clean_terms_pass
assert_fails "docs only 写入禁用别名时仍被 terminology gate 拦住" case_docs_only_alias_in_doc_still_blocks
assert_fails "docs only 改坏 TERMINOLOGY-AND-NAMING 时仍被 terminology gate 拦住" case_docs_only_alias_in_terminology_source_still_blocks
assert_fails "docs only 改坏严格注册表时仍被 terminology gate 拦住" case_docs_only_invalid_registry_still_blocks
assert_passes "历史非 staged 漂移不再拖慢 staged gate，但 repo baseline 仍能抓到" case_non_staged_drift_is_left_to_repo_baseline_and_does_not_block_staged_gate
assert_passes "历史未 staged 的主控术语文档不会混入 immutable staged gate，repo baseline 负责报告" case_non_staged_invalid_main_doc_is_not_visible_to_staged_gate
assert_passes "staged 模式允许主控术语表里的合法禁用别名定义" case_staged_mode_allows_registry_alias_rows_in_main_docs
assert_passes "staged 模式允许 TERMINOLOGY 主控术语表里的合法禁用别名定义" case_staged_mode_allows_alias_rows_in_terminology_main_table
assert_fails "behavior + docs + review clean + 未登记模块 basename 被 terminology gate 拦住" case_terminology_gate_blocks_unregistered_module_basename
assert_fails "behavior + docs + review clean + 未登记公开导出名被 terminology gate 拦住" case_terminology_gate_blocks_unregistered_public_export_name
assert_fails "behavior + docs + review clean + 未登记 hook 导出名被 terminology gate 拦住" case_terminology_gate_blocks_unregistered_hook_export_name
assert_passes "behavior + docs + review clean + 私有 helper 文件名不会被 terminology gate 误拦" case_terminology_gate_allows_private_helper_filename
assert_fails "behavior + docs + review clean + 多行公开导出名漂移仍被 terminology gate 拦住" case_terminology_gate_blocks_multiline_public_export_name
assert_fails "behavior + docs + review clean + 已有多行公开导出里新增导出仍被 terminology gate 拦住" case_terminology_gate_blocks_existing_multiline_public_export_addition

assert_fails "staged asset text with forbidden alias is still blocked" case_terminology_gate_still_blocks_staged_asset_text
assert_fails "asset-only staged text still trips terminology gate before doc-sync, and later gates stay silent" case_terminology_gate_blocks_asset_only_staged_text_before_doc_sync
assert_fails "opted-in repo-owned SVG text still trips terminology gate" case_terminology_gate_blocks_opted_in_repo_owned_svg

echo "All terminology gate tests passed."
