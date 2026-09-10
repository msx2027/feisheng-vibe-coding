#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: tools/check-terminology-consistency.sh, tools/doc-sync-helpers.sh, tools/INDEX.md
# Syncs with: README.md, DOC-MAP.md, tools/test-terminology-gate.sh
# Smoke tests for strict terminology registry + DEV-PLAN change list checks.

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SOURCE_ROOT=$(dirname "$SCRIPT_DIR")
TMP_ROOT=$(mktemp -d)
PLAIN_TEMPLATE_ROOT=""
GIT_TEMPLATE_ROOT=""

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

run_check_repo() {
  local root="$1"
  bash "$SOURCE_ROOT/tools/check-terminology-consistency.sh" --root "$root" --mode repo
}

run_check_staged() {
  local root="$1"
  bash "$SOURCE_ROOT/tools/check-terminology-consistency.sh" --root "$root" --mode staged
}

run_check_repo_capture() {
  local root="$1"
  local output_file="$2"

  if bash "$SOURCE_ROOT/tools/check-terminology-consistency.sh" --root "$root" --mode repo >"$output_file" 2>&1; then
    return 0
  fi

  return 1
}

run_check_staged_capture() {
  local root="$1"
  local output_file="$2"

  if bash "$SOURCE_ROOT/tools/check-terminology-consistency.sh" --root "$root" --mode staged >"$output_file" 2>&1; then
    return 0
  fi

  return 1
}

run_check_raw_capture() {
  local output_file="$1"
  shift

  if bash "$SOURCE_ROOT/tools/check-terminology-consistency.sh" "$@" >"$output_file" 2>&1; then
    return 0
  fi

  return 1
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

write_valid_spec() {
  local root="$1"
  cat > "$root/Product-Spec.md" <<'EOF'
# Product Spec

## 术语与命名规范
| 对象ID | 类别 | 统一口径 | 禁用别名 | 代码命名映射 | 适用范围 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| work-item | 核心对象 | 工作项 | 任务、job_item | work_item | 全仓 | active | 统一业务对象名。 |
| terminology-gate | 模块 | 术语门禁 | terminology check gate | terminology_gate | tools | active | 提交前术语硬拦入口。 |
EOF
}

write_valid_plan() {
  local root="$1"
  cat > "$root/DEV-PLAN.md" <<'EOF'
# DEV-PLAN

## 术语对齐

### 本轮术语变更清单
| 对象ID | 变更类型 | 影响范围 | 必须回写文件 | 完成状态 |
| --- | --- | --- | --- | --- |
| work-item | 沿用 | 文档与实现 | Product-Spec.md; DEV-PLAN.md | done |
| terminology-gate | 新增 | pre-commit | Product-Spec.md; DEV-PLAN.md; tools/INDEX.md | done |
EOF
}

populate_valid_project() {
  local root="$1"
  mkdir -p "$root/src/features/work-item" "$root/docs" "$root/tools"
  cp "$SOURCE_ROOT/tools/doc-sync-helpers.sh" "$root/tools/doc-sync-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-path-helpers.sh" "$root/tools/doc-sync-path-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-doc-helpers.sh" "$root/tools/doc-sync-doc-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-tier-helpers.sh" "$root/tools/doc-sync-tier-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-state-helpers.sh" "$root/tools/doc-sync-state-helpers.sh"
  write_valid_spec "$root"
  write_valid_plan "$root"

  cat > "$root/README.md" <<'EOF'
# Demo Project

项目统一使用“工作项”口径。
EOF

  cat > "$root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "ready";
EOF
}

ensure_plain_template() {
  if [ -n "$PLAIN_TEMPLATE_ROOT" ] && [ -d "$PLAIN_TEMPLATE_ROOT" ]; then
    return 0
  fi

  PLAIN_TEMPLATE_ROOT="$TMP_ROOT/_plain-valid-project-template"
  mkdir -p "$PLAIN_TEMPLATE_ROOT"
  populate_valid_project "$PLAIN_TEMPLATE_ROOT"
}

init_git_repo_in_place() {
  local root="$1"

  git -C "$root" init -q
  git -C "$root" config user.email "terminology-consistency@example.com"
  git -C "$root" config user.name "Terminology Consistency Test"
  git -C "$root" config core.autocrlf false
  git -C "$root" add .
  git -C "$root" commit -qm "init"
}

ensure_git_template() {
  if [ -n "$GIT_TEMPLATE_ROOT" ] && [ -d "$GIT_TEMPLATE_ROOT" ]; then
    return 0
  fi

  ensure_plain_template
  GIT_TEMPLATE_ROOT="$TMP_ROOT/_git-valid-project-template"
  copy_tree "$PLAIN_TEMPLATE_ROOT" "$GIT_TEMPLATE_ROOT"
  init_git_repo_in_place "$GIT_TEMPLATE_ROOT"
}

create_valid_project() {
  local root="$1"

  ensure_plain_template
  rm -rf "$root"
  copy_tree "$PLAIN_TEMPLATE_ROOT" "$root"
}

write_svg_text_contract() {
  local root="$1"
  shift
  local path

  cat > "$root/.editorconfig" <<'EOF'
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
    cat >> "$root/.editorconfig" <<EOF

[$path]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
EOF
  done

  cat > "$root/.gitattributes" <<'EOF'
* text=auto eol=lf
*.svg binary
EOF

  for path in "$@"; do
    printf '/%s text eol=lf\n' "$path" >> "$root/.gitattributes"
  done
}

init_git_repo() {
  local root="$1"

  ensure_git_template
  rm -rf "$root"
  copy_tree "$GIT_TEMPLATE_ROOT" "$root"
}

case_valid_registry_and_change_list_pass() {
  local root="$TMP_ROOT/case_valid_registry_and_change_list_pass"
  create_valid_project "$root"
  run_check_repo "$root" >/dev/null
}

case_missing_required_registry_column_fails() {
  local root="$TMP_ROOT/case_missing_required_registry_column_fails"
  create_valid_project "$root"

  cat > "$root/Product-Spec.md" <<'EOF'
# Product Spec

## 术语与命名规范
| 对象ID | 类别 | 统一口径 | 禁用别名 | 代码命名映射 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| work-item | 核心对象 | 工作项 | job_item | work_item | active | 缺少适用范围列。 |
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_duplicate_object_id_fails() {
  local root="$TMP_ROOT/case_duplicate_object_id_fails"
  create_valid_project "$root"

  cat > "$root/Product-Spec.md" <<'EOF'
# Product Spec

## 术语与命名规范
| 对象ID | 类别 | 统一口径 | 禁用别名 | 代码命名映射 | 适用范围 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| work-item | 核心对象 | 工作项 | job_item | work_item | 全仓 | active | 第一条。 |
| work-item | 模块 | 工作项模块 | task_module | work_item_module | tools | active | 重复对象ID。 |
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_duplicate_code_mapping_fails() {
  local root="$TMP_ROOT/case_duplicate_code_mapping_fails"
  create_valid_project "$root"

  cat > "$root/Product-Spec.md" <<'EOF'
# Product Spec

## 术语与命名规范
| 对象ID | 类别 | 统一口径 | 禁用别名 | 代码命名映射 | 适用范围 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| work-item | 核心对象 | 工作项 | job_item | work_item | 全仓 | active | 第一条。 |
| work-item-page | 页面 | 工作项页面 | task_page | work_item | src/features | active | 重复代码命名映射。 |
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_missing_change_subtable_fails() {
  local root="$TMP_ROOT/case_missing_change_subtable_fails"
  create_valid_project "$root"

  cat > "$root/DEV-PLAN.md" <<'EOF'
# DEV-PLAN

## 术语对齐

- 仅保留说明，不提供“本轮术语变更清单”。
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_unknown_object_id_in_change_list_fails() {
  local root="$TMP_ROOT/case_unknown_object_id_in_change_list_fails"
  create_valid_project "$root"

  cat > "$root/DEV-PLAN.md" <<'EOF'
# DEV-PLAN

## 术语对齐

### 本轮术语变更清单
| 对象ID | 变更类型 | 影响范围 | 必须回写文件 | 完成状态 |
| --- | --- | --- | --- | --- |
| unknown-term | 沿用 | 文档 | DEV-PLAN.md | done |
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_readme_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_readme_fails"
  create_valid_project "$root"

  cat > "$root/README.md" <<'EOF'
# Demo Project

这里仍然写了 job_item。
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_chinese_forbidden_alias_in_readme_fails() {
  local root="$TMP_ROOT/case_chinese_forbidden_alias_in_readme_fails"
  create_valid_project "$root"

  cat > "$root/README.md" <<'EOF'
# Demo Project

这里仍然写了任务。
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_code_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_code_fails"
  create_valid_project "$root"

  cat > "$root/src/features/work-item/index.ts" <<'EOF'
export const job_item = "ready";
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_bundled_csv_asset_is_ignored() {
  local root="$TMP_ROOT/case_forbidden_alias_in_bundled_csv_asset_is_ignored"
  local output_file="$TMP_ROOT/case_forbidden_alias_in_bundled_csv_asset_is_ignored.log"
  create_valid_project "$root"

  mkdir -p "$root/skills/ui-ux-pro-max/data"
  cat > "$root/skills/ui-ux-pro-max/data/google-fonts.csv" <<'EOF'
family,tag
job_item,alias-should-not-block
EOF

  run_check_repo_capture "$root" "$output_file"
  if grep -Fq 'skills/ui-ux-pro-max/data/google-fonts.csv' "$output_file"; then
    return 1
  fi
  if grep -Fq 'job_item' "$output_file"; then
    return 1
  fi
  grep -Fq '[PASS] Terminology consistency check passed' "$output_file"
}

case_forbidden_alias_in_binary_font_asset_is_ignored() {
  local root="$TMP_ROOT/case_forbidden_alias_in_binary_font_asset_is_ignored"
  create_valid_project "$root"

  mkdir -p "$root/skills/ui-styling/canvas-fonts"
  printf '\x00\x01job_item\x00\x02' > "$root/skills/ui-styling/canvas-fonts/demo.ttf"

  run_check_repo "$root" >/dev/null
}

case_forbidden_alias_in_font_license_text_asset_is_ignored() {
  local root="$TMP_ROOT/case_forbidden_alias_in_font_license_text_asset_is_ignored"
  create_valid_project "$root"

  mkdir -p "$root/skills/ui-styling/canvas-fonts"
  cat > "$root/skills/ui-styling/canvas-fonts/demo-OFL.txt" <<'EOF'
job_item should not be scanned from bundled font license text.
EOF

  run_check_repo "$root" >/dev/null
}

case_forbidden_alias_in_json_data_asset_is_ignored() {
  local root="$TMP_ROOT/case_forbidden_alias_in_json_data_asset_is_ignored"
  local output_file="$TMP_ROOT/case_forbidden_alias_in_json_data_asset_is_ignored.log"
  create_valid_project "$root"

  mkdir -p "$root/skills/ui-ux-pro-max/data"
  cat > "$root/skills/ui-ux-pro-max/data/alias-map.json" <<'EOF'
{"legacy":"job_item"}
EOF

  run_check_repo_capture "$root" "$output_file"
  if grep -Fq 'skills/ui-ux-pro-max/data/alias-map.json' "$output_file"; then
    return 1
  fi
  if grep -Fq 'job_item' "$output_file"; then
    return 1
  fi
  grep -Fq '[PASS] Terminology consistency check passed' "$output_file"
}

case_forbidden_alias_in_repo_owned_assets_ts_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_repo_owned_assets_ts_fails"
  local output_file="$TMP_ROOT/case_forbidden_alias_in_repo_owned_assets_ts_fails.log"
  create_valid_project "$root"

  mkdir -p "$root/src/assets"
  cat > "$root/src/assets/registry.ts" <<'EOF'
export const legacyAlias = "job_item";
EOF

  local status=0
  set +e
  run_check_repo_capture "$root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq 'src/assets/registry.ts' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  grep -Fq '[FAIL] Terminology consistency check failed' "$output_file" || return 0
  return 1
}

case_forbidden_alias_in_repo_owned_data_ts_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_repo_owned_data_ts_fails"
  create_valid_project "$root"

  mkdir -p "$root/src/data"
  cat > "$root/src/data/registry.ts" <<'EOF'
export const legacyAlias = "job_item";
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_repo_owned_skill_assets_ts_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_repo_owned_skill_assets_ts_fails"
  create_valid_project "$root"

  mkdir -p "$root/skills/demo-skill/assets"
  cat > "$root/skills/demo-skill/assets/rules.ts" <<'EOF'
export const legacyAlias = "job_item";
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_repo_owned_skill_data_ts_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_repo_owned_skill_data_ts_fails"
  create_valid_project "$root"

  mkdir -p "$root/skills/demo-skill/data"
  cat > "$root/skills/demo-skill/data/rules.ts" <<'EOF'
export const legacyAlias = "job_item";
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_repo_owned_images_ts_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_repo_owned_images_ts_fails"
  create_valid_project "$root"

  mkdir -p "$root/src/images"
  cat > "$root/src/images/registry.ts" <<'EOF'
export const legacyAlias = "job_item";
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_repo_owned_media_ts_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_repo_owned_media_ts_fails"
  create_valid_project "$root"

  mkdir -p "$root/src/media"
  cat > "$root/src/media/registry.ts" <<'EOF'
export const legacyAlias = "job_item";
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_repo_owned_fixtures_ts_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_repo_owned_fixtures_ts_fails"
  create_valid_project "$root"

  mkdir -p "$root/src/fixtures"
  cat > "$root/src/fixtures/registry.ts" <<'EOF'
export const legacyAlias = "job_item";
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_repo_owned_svg_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_repo_owned_svg_fails"
  local output_file="$TMP_ROOT/case_forbidden_alias_in_repo_owned_svg_fails.log"
  create_valid_project "$root"
  write_svg_text_contract "$root" "skills/demo-skill/assets/owned.svg"

  mkdir -p "$root/skills/demo-skill/assets"
  cat > "$root/skills/demo-skill/assets/owned.svg" <<'EOF'
<svg>
  <text>job_item should still be scanned here.</text>
</svg>
EOF

  local status=0
  set +e
  run_check_repo_capture "$root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq 'skills/demo-skill/assets/owned.svg' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  grep -Fq '[FAIL] Terminology consistency check failed' "$output_file" || return 0
  return 1
}

case_forbidden_alias_in_non_opted_repo_owned_svg_is_ignored() {
  local root="$TMP_ROOT/case_forbidden_alias_in_non_opted_repo_owned_svg_is_ignored"
  local output_file="$TMP_ROOT/case_forbidden_alias_in_non_opted_repo_owned_svg_is_ignored.log"
  create_valid_project "$root"

  mkdir -p "$root/skills/demo-skill/assets"
  cat > "$root/skills/demo-skill/assets/ordinary.svg" <<'EOF'
<svg>
  <text>job_item should stay isolated because this SVG is not opted in.</text>
</svg>
EOF

  run_check_repo_capture "$root" "$output_file"
  if grep -Fq 'skills/demo-skill/assets/ordinary.svg' "$output_file"; then
    return 1
  fi
  if grep -Fq 'job_item' "$output_file"; then
    return 1
  fi
  grep -Fq '[PASS] Terminology consistency check passed' "$output_file"
}

case_forbidden_alias_in_repo_owned_mermaid_mmd_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_repo_owned_mermaid_mmd_fails"
  create_valid_project "$root"

  cat > "$root/docs/flow.mmd" <<'EOF'
flowchart TD
  A[job_item] --> B[done]
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_root_mermaid_mmd_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_root_mermaid_mmd_fails"
  create_valid_project "$root"

  cat > "$root/beginner-workflow-flowchart.mmd" <<'EOF'
flowchart TD
  A[job_item] --> B[done]
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_plan_declares_add_but_spec_not_synced_fails() {
  local root="$TMP_ROOT/case_plan_declares_add_but_spec_not_synced_fails"
  create_valid_project "$root"

  cat > "$root/DEV-PLAN.md" <<'EOF'
# DEV-PLAN

## 术语对齐

### 本轮术语变更清单
| 对象ID | 变更类型 | 影响范围 | 必须回写文件 | 完成状态 |
| --- | --- | --- | --- | --- |
| new-core-term | 新增 | src/features | Product-Spec.md; DEV-PLAN.md | doing |
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_change_subtable_outside_term_section_is_ignored() {
  local root="$TMP_ROOT/case_change_subtable_outside_term_section_is_ignored"
  create_valid_project "$root"

  cat > "$root/DEV-PLAN.md" <<'EOF'
# DEV-PLAN

### 本轮术语变更清单
| 对象ID | 变更类型 | 影响范围 | 必须回写文件 | 完成状态 |
| --- | --- | --- | --- | --- |
| unknown-term | 沿用 | 说明文字 | DEV-PLAN.md | done |

## 术语对齐

### 本轮术语变更清单
| 对象ID | 变更类型 | 影响范围 | 必须回写文件 | 完成状态 |
| --- | --- | --- | --- | --- |
| work-item | 沿用 | 文档与实现 | Product-Spec.md; DEV-PLAN.md | done |
| terminology-gate | 新增 | pre-commit | Product-Spec.md; DEV-PLAN.md; tools/INDEX.md | done |
EOF

  run_check_repo "$root" >/dev/null
}

case_forbidden_alias_in_product_spec_body_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_product_spec_body_fails"
  local output_file="$TMP_ROOT/case_forbidden_alias_in_product_spec_body_fails.log"
  create_valid_project "$root"

  cat >> "$root/Product-Spec.md" <<'EOF'

普通正文不允许再出现 job_item 这种禁用别名。
EOF

  local status=0
  set +e
  run_check_repo_capture "$root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq 'Product-Spec.md' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  grep -Fq '[FAIL] Terminology consistency check failed' "$output_file" || return 0
  return 1
}

case_forbidden_alias_in_dev_plan_body_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_dev_plan_body_fails"
  local output_file="$TMP_ROOT/case_forbidden_alias_in_dev_plan_body_fails.log"
  create_valid_project "$root"

  cat >> "$root/DEV-PLAN.md" <<'EOF'

补充说明：job_item 这种禁用别名不能留在正文里。
EOF

  local status=0
  set +e
  run_check_repo_capture "$root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq 'DEV-PLAN.md' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  grep -Fq '[FAIL] Terminology consistency check failed' "$output_file" || return 0
  return 1
}

case_forbidden_alias_in_product_spec_non_registry_table_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_product_spec_non_registry_table_fails"
  local output_file="$TMP_ROOT/case_forbidden_alias_in_product_spec_non_registry_table_fails.log"
  create_valid_project "$root"

  cat >> "$root/Product-Spec.md" <<'EOF'

## 测试与验证策略
| 项目 | 说明 |
| --- | --- |
| 错误示例 | job_item 这种禁用别名不能留在非注册表表格里。 |
EOF

  local status=0
  set +e
  run_check_repo_capture "$root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq 'Product-Spec.md' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  grep -Fq '[FAIL] Terminology consistency check failed' "$output_file" || return 0
  return 1
}

case_forbidden_alias_in_dev_plan_non_change_table_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_dev_plan_non_change_table_fails"
  local output_file="$TMP_ROOT/case_forbidden_alias_in_dev_plan_non_change_table_fails.log"
  create_valid_project "$root"

  cat >> "$root/DEV-PLAN.md" <<'EOF'

## 测试与验证策略
| 项目 | 说明 |
| --- | --- |
| 错误示例 | job_item 这种禁用别名不能留在普通计划表格里。 |
EOF

  local status=0
  set +e
  run_check_repo_capture "$root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq 'DEV-PLAN.md' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  grep -Fq '[FAIL] Terminology consistency check failed' "$output_file" || return 0
  return 1
}

case_forbidden_alias_in_terminology_and_naming_doc_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_terminology_and_naming_doc_fails"
  create_valid_project "$root"

  cat > "$root/TERMINOLOGY-AND-NAMING.md" <<'EOF'
# Terminology and Naming

这里不允许写 job_item 这种禁用别名。
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_repo_mode_allows_alias_rows_in_terminology_main_table() {
  local root="$TMP_ROOT/case_repo_mode_allows_alias_rows_in_terminology_main_table"
  local alias_name='naming'"_magic"
  create_valid_project "$root"

  cat > "$root/TERMINOLOGY-AND-NAMING.md" <<EOF
# Terminology and Naming

## 默认术语表
| 类别 | 统一口径 | 避免写法 | 代码命名映射 | 说明 |
| --- | --- | --- | --- | --- |
| 路由方式 | 隐藏路由 | auto_guess、${alias_name} | hidden_routing | 合法登记禁用别名。 |
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_forbidden_alias_in_product_spec_changelog_fails() {
  local root="$TMP_ROOT/case_forbidden_alias_in_product_spec_changelog_fails"
  create_valid_project "$root"

  cat > "$root/Product-Spec-CHANGELOG.md" <<'EOF'
# Product Spec Changelog

本次变更说明里不允许留下 job_item 这种禁用别名。
EOF

  run_check_repo "$root" >/dev/null 2>&1
}

case_staged_unregistered_module_basename_fails() {
  local root="$TMP_ROOT/case_staged_unregistered_module_basename_fails"
  create_valid_project "$root"
  init_git_repo "$root"

  mkdir -p "$root/src/features/job-item"
  cat > "$root/src/features/job-item/index.ts" <<'EOF'
export const WorkItemModule = "ready";
EOF

  git -C "$root" add src/features/job-item/index.ts
  run_check_staged "$root" >/dev/null 2>&1
}

case_staged_unregistered_public_export_name_fails() {
  local root="$TMP_ROOT/case_staged_unregistered_public_export_name_fails"
  create_valid_project "$root"
  init_git_repo "$root"

  cat > "$root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "ready";
export const SurpriseModule = "drift";
EOF

  git -C "$root" add src/features/work-item/index.ts
  run_check_staged "$root" >/dev/null 2>&1
}

case_staged_unregistered_hook_export_name_fails() {
  local root="$TMP_ROOT/case_staged_unregistered_hook_export_name_fails"
  create_valid_project "$root"
  init_git_repo "$root"

  cat > "$root/src/features/work-item/index.ts" <<'EOF'
export const WorkItemModule = "ready";
export function useSurprise() {
  return "drift";
}
EOF

  git -C "$root" add src/features/work-item/index.ts
  run_check_staged "$root" >/dev/null 2>&1
}

case_staged_alias_in_terminology_and_naming_doc_fails() {
  local root="$TMP_ROOT/case_staged_alias_in_terminology_and_naming_doc_fails"
  create_valid_project "$root"
  init_git_repo "$root"

  cat > "$root/TERMINOLOGY-AND-NAMING.md" <<'EOF'
# Terminology and Naming

这里不允许写 job_item 这种禁用别名。
EOF

  git -C "$root" add TERMINOLOGY-AND-NAMING.md
  run_check_staged "$root" >/dev/null 2>&1
}

case_staged_mode_reads_index_not_worktree_overlay_fails() {
  local root="$TMP_ROOT/case_staged_mode_reads_index_not_worktree_overlay_fails"
  create_valid_project "$root"
  init_git_repo "$root"

  sed -i 's/job_item |/job_item; staged_alias |/' "$root/Product-Spec.md"
  cat > "$root/README.md" <<'EOF'
# Demo Project

这里故意保留 staged_alias。
EOF
  git -C "$root" add Product-Spec.md README.md

  sed -i 's/job_item; staged_alias |/job_item |/' "$root/Product-Spec.md"

  run_check_staged "$root" >/dev/null 2>&1
}

case_staged_private_helper_basename_passes() {
  local root="$TMP_ROOT/case_staged_private_helper_basename_passes"
  create_valid_project "$root"
  init_git_repo "$root"

  mkdir -p "$root/src/features/work-item/helpers"
  cat > "$root/src/features/work-item/helpers/surprise.ts" <<'EOF'
export const surprise = "helper";
EOF

  git -C "$root" add src/features/work-item/helpers/surprise.ts
  run_check_staged "$root" >/dev/null
}

case_staged_multiline_public_export_name_fails() {
  local root="$TMP_ROOT/case_staged_multiline_public_export_name_fails"
  create_valid_project "$root"
  init_git_repo "$root"

  cat > "$root/src/features/work-item/public-api.ts" <<'EOF'
export const WorkItemModule = "ready";
export const SurpriseModule = "drift";
EOF
  cat > "$root/src/features/work-item/index.ts" <<'EOF'
export {
  WorkItemModule,
  SurpriseModule
} from "./public-api";
EOF

  git -C "$root" add src/features/work-item/public-api.ts src/features/work-item/index.ts
  run_check_staged "$root" >/dev/null 2>&1
}

case_staged_existing_multiline_public_export_addition_fails() {
  local root="$TMP_ROOT/case_staged_existing_multiline_public_export_addition_fails"
  create_valid_project "$root"
  init_git_repo "$root"

  cat > "$root/src/features/work-item/public-api.ts" <<'EOF'
export const WorkItemModule = "ready";
export const SurpriseModule = "already-internal";
EOF
  cat > "$root/src/features/work-item/index.ts" <<'EOF'
export {
  WorkItemModule,
} from "./public-api";
EOF
  git -C "$root" add src/features/work-item/public-api.ts src/features/work-item/index.ts
  git -C "$root" commit -qm "seed internal export only"

  cat > "$root/src/features/work-item/index.ts" <<'EOF'
export {
  WorkItemModule,
  SurpriseModule,
} from "./public-api";
EOF

  git -C "$root" add src/features/work-item/index.ts
  run_check_staged "$root" >/dev/null 2>&1
}

case_staged_opted_in_repo_owned_svg_fails() {
  local root="$TMP_ROOT/case_staged_opted_in_repo_owned_svg_fails"
  local output_file="$TMP_ROOT/case_staged_opted_in_repo_owned_svg_fails.log"
  create_valid_project "$root"
  write_svg_text_contract "$root" "skills/demo-skill/assets/owned.svg"
  init_git_repo "$root"

  mkdir -p "$root/skills/demo-skill/assets"
  cat > "$root/skills/demo-skill/assets/owned.svg" <<'EOF'
<svg>
  <text>job_item should still be blocked when this opted-in SVG is staged.</text>
</svg>
EOF

  git -C "$root" add skills/demo-skill/assets/owned.svg
  local status=0
  set +e
  run_check_staged_capture "$root" "$output_file"
  status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  grep -Fq 'skills/demo-skill/assets/owned.svg' "$output_file" || return 0
  grep -Fq 'job_item' "$output_file" || return 0
  grep -Fq '[FAIL] Terminology consistency check failed' "$output_file" || return 0
  return 1
}

case_staged_invalid_nonstaged_main_doc_warns_only() {
  local root="$TMP_ROOT/case_staged_invalid_nonstaged_main_doc_warns_only"
  create_valid_project "$root"
  init_git_repo "$root"

  cat > "$root/Product-Spec.md" <<'EOF'
# Product Spec

## 术语与命名规范
无表格，结构非法。
EOF
  cat > "$root/README.md" <<'EOF'
# Demo Project

项目统一使用“工作项”口径，补一条普通说明。
EOF

  git -C "$root" add README.md
  run_check_staged "$root" >/dev/null
}

case_missing_root_argument_prints_failure() {
  local output_file="$TMP_ROOT/case_missing_root_argument_prints_failure.log"

  local status=0
  set +e
  run_check_raw_capture "$output_file" --root
  status=$?
  set -e

  if [ $status -eq 0 ]; then
    return 1
  fi

  grep -Fq '[FAIL] Missing value for --root' "$output_file"
}

case_missing_mode_argument_prints_failure() {
  local output_file="$TMP_ROOT/case_missing_mode_argument_prints_failure.log"

  local status=0
  set +e
  run_check_raw_capture "$output_file" --root "$TMP_ROOT" --mode
  status=$?
  set -e

  if [ $status -eq 0 ]; then
    return 1
  fi

  grep -Fq '[FAIL] Missing value for --mode' "$output_file"
}

assert_passes "严格注册表 + 术语对齐 + 变更清单合法时通过" case_valid_registry_and_change_list_pass
assert_fails "缺注册表必需列时失败" case_missing_required_registry_column_fails
assert_fails "对象ID 重复时失败" case_duplicate_object_id_fails
assert_fails "代码命名映射重复时失败" case_duplicate_code_mapping_fails
assert_fails "DEV-PLAN 缺本轮术语变更清单时失败" case_missing_change_subtable_fails
assert_fails "变更清单引用未知对象ID时失败" case_unknown_object_id_in_change_list_fails
assert_fails "README 使用禁用别名时失败" case_forbidden_alias_in_readme_fails
assert_fails "README 使用中文禁用别名时失败" case_chinese_forbidden_alias_in_readme_fails
assert_fails "源码使用禁用别名时失败" case_forbidden_alias_in_code_fails
assert_fails "TERMINOLOGY-AND-NAMING 使用禁用别名时失败" case_forbidden_alias_in_terminology_and_naming_doc_fails
assert_passes "repo mode 允许主控术语表里的合法禁用别名定义" case_repo_mode_allows_alias_rows_in_terminology_main_table
assert_fails "Product-Spec-CHANGELOG 使用禁用别名时失败" case_forbidden_alias_in_product_spec_changelog_fails
assert_passes "bundled csv 资产中的禁用别名在 repo 模式会被忽略" case_forbidden_alias_in_bundled_csv_asset_is_ignored
assert_passes "二进制字体资产在 repo 模式会被忽略" case_forbidden_alias_in_binary_font_asset_is_ignored
assert_fails "Plan 声明新增但 Spec 未同步时失败" case_plan_declares_add_but_spec_not_synced_fails

assert_passes "repo mode ignores bundled font license text assets" case_forbidden_alias_in_font_license_text_asset_is_ignored
assert_passes "repo mode ignores json data assets under data directories" case_forbidden_alias_in_json_data_asset_is_ignored
assert_fails "repo mode scans repo-owned TypeScript under src/assets" case_forbidden_alias_in_repo_owned_assets_ts_fails
assert_fails "repo mode scans repo-owned TypeScript under src/data" case_forbidden_alias_in_repo_owned_data_ts_fails
assert_fails "repo mode scans repo-owned TypeScript under skills/*/assets" case_forbidden_alias_in_repo_owned_skill_assets_ts_fails
assert_fails "repo mode scans repo-owned TypeScript under skills/*/data" case_forbidden_alias_in_repo_owned_skill_data_ts_fails
assert_fails "repo mode scans repo-owned TypeScript under src/images" case_forbidden_alias_in_repo_owned_images_ts_fails
assert_fails "repo mode scans repo-owned TypeScript under src/media" case_forbidden_alias_in_repo_owned_media_ts_fails
assert_fails "repo mode scans repo-owned TypeScript under src/fixtures" case_forbidden_alias_in_repo_owned_fixtures_ts_fails
assert_fails "repo mode scans repo-owned SVG text assets" case_forbidden_alias_in_repo_owned_svg_fails
assert_passes "repo mode ignores non-opted SVG assets even if they contain forbidden aliases" case_forbidden_alias_in_non_opted_repo_owned_svg_is_ignored
assert_fails "repo mode scans repo-owned Mermaid .mmd text assets" case_forbidden_alias_in_repo_owned_mermaid_mmd_fails
assert_fails "repo mode scans root Mermaid .mmd text assets" case_forbidden_alias_in_root_mermaid_mmd_fails
assert_fails "repo mode scans Product-Spec prose outside the registry table" case_forbidden_alias_in_product_spec_body_fails
assert_fails "repo mode scans DEV-PLAN prose outside the change table" case_forbidden_alias_in_dev_plan_body_fails
assert_fails "repo mode scans Product-Spec tables outside the registry table" case_forbidden_alias_in_product_spec_non_registry_table_fails
assert_fails "repo mode scans DEV-PLAN tables outside the change table" case_forbidden_alias_in_dev_plan_non_change_table_fails
assert_fails "staged mode blocks unregistered module basename drift" case_staged_unregistered_module_basename_fails
assert_fails "staged mode blocks unregistered public export name drift" case_staged_unregistered_public_export_name_fails
assert_fails "staged mode blocks unregistered hook export name drift" case_staged_unregistered_hook_export_name_fails
assert_fails "staged mode blocks alias in TERMINOLOGY-AND-NAMING" case_staged_alias_in_terminology_and_naming_doc_fails
assert_fails "staged mode reads index content instead of a clean unstaged overlay" case_staged_mode_reads_index_not_worktree_overlay_fails
assert_passes "staged mode ignores private helper basename under features" case_staged_private_helper_basename_passes
assert_fails "staged mode blocks multiline public export name drift" case_staged_multiline_public_export_name_fails
assert_fails "staged mode blocks additions inside existing multiline public exports" case_staged_existing_multiline_public_export_addition_fails
assert_fails "staged mode blocks opted-in repo-owned SVG text assets" case_staged_opted_in_repo_owned_svg_fails
assert_passes "staged mode only warns when invalid main source docs are not staged" case_staged_invalid_nonstaged_main_doc_warns_only
assert_passes "只认术语对齐章节下的本轮术语变更清单" case_change_subtable_outside_term_section_is_ignored
assert_passes "裸 --root 参数会给出明确失败文案" case_missing_root_argument_prints_failure
assert_passes "裸 --mode 参数会给出明确失败文案" case_missing_mode_argument_prints_failure

echo "All terminology consistency tests passed."
