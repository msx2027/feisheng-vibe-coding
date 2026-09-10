#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: tools/structural-gate.sh, tools/structural-lint.mjs, tools/check-ui-reuse.mjs, tools/pre-commit-gate.sh
# Syncs with: Product-Spec.md, DEV-PLAN.md, tools/INDEX.md
# Smoke tests for the structural gate in isolated temporary repositories.

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SOURCE_ROOT=$(dirname "$SCRIPT_DIR")
TMP_ROOT=$(mktemp -d)
STRUCTURAL_GATE_SOURCE="${STRUCTURAL_GATE_SOURCE:-$SOURCE_ROOT/tools/structural-gate.sh}"
STRUCTURAL_LINT_SOURCE="${STRUCTURAL_LINT_SOURCE:-$SOURCE_ROOT/tools/structural-lint.mjs}"
CHECK_UI_REUSE_SOURCE="${CHECK_UI_REUSE_SOURCE:-$SOURCE_ROOT/tools/check-ui-reuse.mjs}"
PRE_COMMIT_GATE_SOURCE="${PRE_COMMIT_GATE_SOURCE:-$SOURCE_ROOT/tools/pre-commit-gate.sh}"
LAST_OUTPUT=""
LAST_REPO_ROOT=""
LAST_STATUS=0

cleanup() {
  rm -rf "$TMP_ROOT"
}

trap cleanup EXIT

require_source_files() {
  local missing=0

  for path in \
    "$STRUCTURAL_GATE_SOURCE" \
    "$STRUCTURAL_LINT_SOURCE" \
    "$CHECK_UI_REUSE_SOURCE" \
    "$PRE_COMMIT_GATE_SOURCE"
  do
    if [ ! -f "$path" ]; then
      echo "[FAIL] missing required source file: ${path#$SOURCE_ROOT/}" >&2
      missing=1
    fi
  done

  if [ "$missing" -ne 0 ]; then
    exit 1
  fi
}

copy_gate_files() {
  local repo_root="$1"

  mkdir -p "$repo_root/tools"

  while IFS= read -r file; do
    cp "$file" "$repo_root/tools/"
  done < <(
    find "$SOURCE_ROOT/tools" -maxdepth 1 -type f \
      \( -name "*.sh" -o -name "*.mjs" \) \
      -print
  )

  cp "$STRUCTURAL_GATE_SOURCE" "$repo_root/tools/structural-gate.sh"
  cp "$STRUCTURAL_LINT_SOURCE" "$repo_root/tools/structural-lint.mjs"
  cp "$PRE_COMMIT_GATE_SOURCE" "$repo_root/tools/pre-commit-gate.sh"

  find "$repo_root/tools" -maxdepth 1 -type f -name "*.sh" -exec chmod +x {} \;
}

create_repo() {
  local repo_root="$1"

  mkdir -p "$repo_root"
  copy_gate_files "$repo_root"

  cat > "$repo_root/README.md" <<'EOF'
# structural-gate-smoke-test
EOF

  git -C "$repo_root" init -q
  git -C "$repo_root" config user.email "structural-gate@example.com"
  git -C "$repo_root" config user.name "Structural Gate Test"
  git -C "$repo_root" config core.autocrlf false
  git -C "$repo_root" add -A
  git -C "$repo_root" commit -qm "init"
}

create_ts_project() {
  local repo_root="$1"

  mkdir -p \
    "$repo_root/src/app" \
    "$repo_root/src/components" \
    "$repo_root/src/hooks" \
    "$repo_root/src/lib" \
    "$repo_root/src/pages" \
    "$repo_root/src/services" \
    "$repo_root/src/types" \
    "$repo_root/src/utils"

  cat > "$repo_root/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "jsx": "preserve",
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
EOF

  cat > "$repo_root/src/jsx.d.ts" <<'EOF'
declare namespace JSX {
  interface Element {}

  interface IntrinsicElements {
    div: Record<string, unknown>;
    section: Record<string, unknown>;
    span: Record<string, unknown>;
  }
}
EOF
}

commit_all() {
  local repo_root="$1"
  local message="$2"

  git -C "$repo_root" add -A
  git -C "$repo_root" commit -qm "$message"
}

write_small_function() {
  local path="$1"
  local name="${2:-sumPair}"

  cat > "$path" <<EOF
export function $name(left: number, right: number): number {
  return left + right;
}
EOF
}

write_function_with_total_lines() {
  local path="$1"
  local name="$2"
  local total_lines="$3"
  local filler_count=$((total_lines - 4))
  local index

  {
    echo "export function $name(value: number): number {"
    echo "  let current = value;"
    for index in $(seq 1 "$filler_count"); do
      echo "  current += $index;"
    done
    echo "  return current;"
    echo "}"
  } > "$path"
}

write_parameter_function() {
  local path="$1"
  local name="$2"
  local parameter_count="$3"
  local index
  local params=()

  for index in $(seq 1 "$parameter_count"); do
    params+=("arg$index: number")
  done

  {
    printf 'export function %s(%s): number {\n' "$name" "$(IFS=', '; echo "${params[*]}")"
    echo "  return $(seq -s ' + ' 1 "$parameter_count" | sed 's/[0-9]\+/arg&/g');"
    echo "}"
  } > "$path"
}

write_complexity_function() {
  local path="$1"
  local name="$2"
  local target_complexity="$3"
  local branch_count=$((target_complexity - 1))
  local index

  {
    echo "export function $name(value: number): number {"
    echo "  let score = 0;"
    for index in $(seq 1 "$branch_count"); do
      echo "  if (value > $index) {"
      echo "    score += $index;"
      echo "  }"
    done
    echo "  return score;"
    echo "}"
  } > "$path"
}

write_nested_function() {
  local path="$1"
  local name="$2"
  local depth="$3"
  local index
  local indent

  {
    echo "export function $name(value: number): number {"
    for index in $(seq 1 "$depth"); do
      indent=$(printf '%*s' $((index * 2)) "")
      echo "${indent}if (value > $index) {"
    done
    indent=$(printf '%*s' $(((depth + 1) * 2)) "")
    echo "${indent}return value;"
    for index in $(seq "$depth" -1 1); do
      indent=$(printf '%*s' $((index * 2)) "")
      echo "${indent}}"
    done
    echo "  return value;"
    echo "}"
  } > "$path"
}

write_small_component() {
  local path="$1"
  local name="${2:-StatusBadge}"

  cat > "$path" <<EOF
export function $name(): JSX.Element {
  return (
    <section>
      <div>ready</div>
    </section>
  );
}
EOF
}

write_component_with_total_lines() {
  local path="$1"
  local name="$2"
  local total_lines="$3"
  local inner_line_count=$((total_lines - 6))
  local index

  {
    echo "export function $name(): JSX.Element {"
    echo "  return ("
    echo "    <section>"
    for index in $(seq 1 "$inner_line_count"); do
      echo "      <div>line $index</div>"
    done
    echo "    </section>"
    echo "  );"
    echo "}"
  } > "$path"
}

run_structural_gate() {
  local repo_root="$1"
  local output
  local status

  LAST_REPO_ROOT="$repo_root"

  set +e
  output=$(bash "$repo_root/tools/structural-gate.sh" "$repo_root" 2>&1)
  status=$?
  set -e

  LAST_OUTPUT="$output"
  LAST_STATUS="$status"
  return "$status"
}

run_pre_commit_gate() {
  local repo_root="$1"
  local output
  local status

  LAST_REPO_ROOT="$repo_root"

  set +e
  output=$(bash "$repo_root/tools/pre-commit-gate.sh" "$repo_root" 2>&1)
  status=$?
  set -e

  LAST_OUTPUT="$output"
  LAST_STATUS="$status"
  return "$status"
}

dump_last_run() {
  if [ -n "$LAST_REPO_ROOT" ]; then
    echo "Last repo: $LAST_REPO_ROOT" >&2
  fi

  echo "Last status: $LAST_STATUS" >&2

  if [ -n "$LAST_OUTPUT" ]; then
    echo "Last gate output:" >&2
    echo "$LAST_OUTPUT" >&2
  fi
}

count_warning_items() {
  printf '%s\n' "$LAST_OUTPUT" | grep -c '^  - ' || true
}

assert_passes() {
  local name="$1"
  shift

  if "$@"; then
    echo "[PASS] $name"
    return 0
  fi

  echo "[FAIL] $name" >&2
  dump_last_run
  exit 1
}

assert_fails() {
  local name="$1"
  shift

  if "$@"; then
    echo "[FAIL] $name" >&2
    dump_last_run
    exit 1
  fi

  echo "[PASS] $name"
}

case_normal_project_passes() {
  local repo_root="$TMP_ROOT/case_normal_project_passes"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  write_small_function "$repo_root/src/lib/math.ts" "sumPair"
  write_small_component "$repo_root/src/components/status-badge.tsx" "StatusBadge"

  cat > "$repo_root/src/pages/home.ts" <<'EOF'
import { sumPair } from "@/lib/math";
import { StatusBadge } from "@/components/status-badge";

export const homeScore = sumPair(1, 2);
export const homeBadge = StatusBadge;
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_boundary_thresholds_pass() {
  local repo_root="$TMP_ROOT/case_boundary_thresholds_pass"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  write_function_with_total_lines "$repo_root/src/lib/boundary-function.ts" "boundaryFunction" 100
  write_component_with_total_lines "$repo_root/src/components/boundary-component.tsx" "BoundaryComponent" 180
  write_parameter_function "$repo_root/src/lib/boundary-params.ts" "boundaryParams" 4
  write_complexity_function "$repo_root/src/lib/boundary-complexity.ts" "boundaryComplexity" 10

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_nesting_boundary_passes() {
  local repo_root="$TMP_ROOT/case_nesting_boundary_passes"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  write_nested_function "$repo_root/src/lib/boundary-nesting.ts" "boundaryNesting" 4

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_long_function_fails() {
  local repo_root="$TMP_ROOT/case_long_function_fails"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  write_function_with_total_lines "$repo_root/src/lib/too-long-function.ts" "tooLongFunction" 101

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_long_component_fails() {
  local repo_root="$TMP_ROOT/case_long_component_fails"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  write_component_with_total_lines "$repo_root/src/components/too-long-component.tsx" "TooLongComponent" 181

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_too_many_parameters_fail() {
  local repo_root="$TMP_ROOT/case_too_many_parameters_fail"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  write_parameter_function "$repo_root/src/lib/too-many-params.ts" "tooManyParams" 5

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_complexity_limit_fail() {
  local repo_root="$TMP_ROOT/case_complexity_limit_fail"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  write_complexity_function "$repo_root/src/lib/too-complex.ts" "tooComplex" 11

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_nesting_limit_fail() {
  local repo_root="$TMP_ROOT/case_nesting_limit_fail"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  write_nested_function "$repo_root/src/lib/too-nested.ts" "tooNested" 5

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_relative_cycle_fails() {
  local repo_root="$TMP_ROOT/case_relative_cycle_fails"

  create_repo "$repo_root"
  create_ts_project "$repo_root"

  cat > "$repo_root/src/lib/a.ts" <<'EOF'
import { b } from "./b";

export const a = b + 1;
EOF

  cat > "$repo_root/src/lib/b.ts" <<'EOF'
import { a } from "./a";

export const b = a + 1;
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_alias_cycle_fails() {
  local repo_root="$TMP_ROOT/case_alias_cycle_fails"

  create_repo "$repo_root"
  create_ts_project "$repo_root"

  cat > "$repo_root/src/utils/alias-a.ts" <<'EOF'
import { aliasB } from "@/utils/alias-b";

export const aliasA = aliasB + 1;
EOF

  cat > "$repo_root/src/utils/alias-b.ts" <<'EOF'
import { aliasA } from "@/utils/alias-a";

export const aliasB = aliasA + 1;
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_cross_layer_import_fails() {
  local repo_root="$TMP_ROOT/case_cross_layer_import_fails"

  create_repo "$repo_root"
  create_ts_project "$repo_root"

  cat > "$repo_root/src/pages/home.ts" <<'EOF'
export const homeTitle = "home";
EOF

  cat > "$repo_root/src/lib/bad-import.ts" <<'EOF'
import { homeTitle } from "@/pages/home";

export const leakedTitle = homeTitle;
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_page_raw_color_fails() {
  local repo_root="$TMP_ROOT/case_page_raw_color_fails"

  create_repo "$repo_root"
  create_ts_project "$repo_root"

  cat > "$repo_root/src/pages/home.tsx" <<'EOF'
export function HomePage(): JSX.Element {
  return <section style={{ color: "#ffffff" }}>Home</section>;
}
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_page_local_button_fails() {
  local repo_root="$TMP_ROOT/case_page_local_button_fails"

  create_repo "$repo_root"
  create_ts_project "$repo_root"

  cat > "$repo_root/src/pages/home.tsx" <<'EOF'
export function Button(): JSX.Element {
  return <span>Save</span>;
}
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_page_native_button_fails() {
  local repo_root="$TMP_ROOT/case_page_native_button_fails"

  create_repo "$repo_root"
  create_ts_project "$repo_root"

  cat > "$repo_root/src/pages/home.tsx" <<'EOF'
export function HomePage(): JSX.Element {
  return <button>Save</button>;
}
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_token_css_raw_values_pass() {
  local repo_root="$TMP_ROOT/case_token_css_raw_values_pass"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  mkdir -p "$repo_root/src/shared/ui"

  cat > "$repo_root/src/shared/ui/tokens.css" <<'EOF'
:root {
  --color-surface: #ffffff;
  --card-shadow: 0 16px 48px rgb(15 23 42 / 0.12);
  --card-radius: 8px;
}
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_ui_root_button_passes() {
  local repo_root="$TMP_ROOT/case_ui_root_button_passes"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  mkdir -p "$repo_root/src/shared/ui"

  cat > "$repo_root/src/shared/ui/button.tsx" <<'EOF'
export function Button(): JSX.Element {
  return <button>Save</button>;
}
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_allow_next_line_reason_passes() {
  local repo_root="$TMP_ROOT/case_allow_next_line_reason_passes"

  create_repo "$repo_root"
  create_ts_project "$repo_root"

  cat > "$repo_root/src/pages/home.tsx" <<'EOF'
export function HomePage(): JSX.Element {
  return (
    <section>
      {/* vibe-ui-allow-next-line: native control kept for browser fallback fixture */}
      <button>Save</button>
    </section>
  );
}
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_allow_next_line_without_reason_fails() {
  local repo_root="$TMP_ROOT/case_allow_next_line_without_reason_fails"

  create_repo "$repo_root"
  create_ts_project "$repo_root"

  cat > "$repo_root/src/pages/home.tsx" <<'EOF'
export function HomePage(): JSX.Element {
  return (
    <section>
      {/* vibe-ui-allow-next-line: */}
      <button>Save</button>
    </section>
  );
}
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_missing_tsconfig_skips() {
  local repo_root="$TMP_ROOT/case_missing_tsconfig_skips"

  create_repo "$repo_root"
  mkdir -p "$repo_root/src"

  cat > "$repo_root/src/standalone.ts" <<'EOF'
export const version = "1.0.0";
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_empty_repo_skips() {
  local repo_root="$TMP_ROOT/case_empty_repo_skips"

  create_repo "$repo_root"
  run_structural_gate "$repo_root"
}

case_no_scannable_code_skips() {
  local repo_root="$TMP_ROOT/case_no_scannable_code_skips"

  create_repo "$repo_root"
  mkdir -p "$repo_root/docs"

  cat > "$repo_root/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "baseUrl": "."
  }
}
EOF

  cat > "$repo_root/docs/notes.md" <<'EOF'
# notes only
EOF

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root"
}

case_docs_only_changes_skip() {
  local repo_root="$TMP_ROOT/case_docs_only_changes_skip"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  write_small_function "$repo_root/src/lib/math.ts" "sumPair"
  write_small_component "$repo_root/src/components/status-badge.tsx" "StatusBadge"
  commit_all "$repo_root" "baseline project"

  cat > "$repo_root/README.md" <<'EOF'
# structural-gate-smoke-test

docs only change
EOF

  git -C "$repo_root" add README.md
  run_structural_gate "$repo_root"
}

case_warning_only_passes() {
  local repo_root="$TMP_ROOT/case_warning_only_passes"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  mkdir -p \
    "$repo_root/src/features/chat" \
    "$repo_root/src/features/orders" \
    "$repo_root/src/features/inbox" \
    "$repo_root/src/features/billing"

  write_small_function "$repo_root/src/features/chat/list.ts" "chatList"
  write_small_component "$repo_root/src/features/chat/view.tsx" "ChatView"
  write_small_function "$repo_root/src/features/orders/list.ts" "orderList"
  write_small_component "$repo_root/src/features/orders/view.tsx" "OrderView"
  write_small_function "$repo_root/src/features/inbox/list.ts" "inboxList"
  write_small_component "$repo_root/src/features/inbox/view.tsx" "InboxView"
  write_small_function "$repo_root/src/features/billing/list.ts" "billingList"
  write_small_component "$repo_root/src/features/billing/view.tsx" "BillingView"
  write_small_function "$repo_root/src/features/billing/helpers.ts" "billingHelpers"

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root" || return 1
  [ "$(count_warning_items)" -eq 2 ]
}

case_warning_scope_ignores_technical_layers() {
  local repo_root="$TMP_ROOT/case_warning_scope_ignores_technical_layers"

  create_repo "$repo_root"
  create_ts_project "$repo_root"
  write_small_function "$repo_root/src/lib/lib-one.ts" "libOne"
  write_small_function "$repo_root/src/lib/lib-two.ts" "libTwo"
  write_small_function "$repo_root/src/utils/util-one.ts" "utilOne"
  write_small_function "$repo_root/src/utils/util-two.ts" "utilTwo"
  write_small_function "$repo_root/src/services/service-one.ts" "serviceOne"
  write_small_function "$repo_root/src/services/service-two.ts" "serviceTwo"
  write_small_function "$repo_root/src/types/type-one.ts" "typeOne"
  write_small_component "$repo_root/src/components/status-one.tsx" "StatusOne"
  write_small_component "$repo_root/src/hooks/status-two.tsx" "StatusTwo"

  git -C "$repo_root" add -A
  run_structural_gate "$repo_root" || return 1
  [ "$(count_warning_items)" -eq 1 ]
}

case_missing_lint_blocks() {
  local repo_root="$TMP_ROOT/case_missing_lint_blocks"

  create_repo "$repo_root"
  rm -f "$repo_root/tools/structural-lint.mjs"

  if run_structural_gate "$repo_root"; then
    return 1
  fi

  [ "$LAST_STATUS" -eq 2 ] && [[ "$LAST_OUTPUT" == *"missing tools/structural-lint.mjs"* ]]
}

case_pre_commit_requires_structural_gate() {
  local repo_root="$TMP_ROOT/case_pre_commit_requires_structural_gate"

  create_repo "$repo_root"

  cat > "$repo_root/tools/review-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  cat > "$repo_root/tools/minimal-quality-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  cat > "$repo_root/tools/doc-sync-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  chmod +x \
    "$repo_root/tools/review-gate.sh" \
    "$repo_root/tools/minimal-quality-gate.sh" \
    "$repo_root/tools/doc-sync-gate.sh"

  rm -f "$repo_root/tools/structural-gate.sh"

  if run_pre_commit_gate "$repo_root"; then
    return 1
  fi

  [ "$LAST_STATUS" -eq 2 ] && [[ "$LAST_OUTPUT" == *"missing tools/structural-gate.sh"* ]]
}

case_pre_commit_blocks_when_lint_is_missing() {
  local repo_root="$TMP_ROOT/case_pre_commit_blocks_when_lint_is_missing"

  create_repo "$repo_root"

  cat > "$repo_root/tools/review-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  cat > "$repo_root/tools/minimal-quality-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  cat > "$repo_root/tools/doc-sync-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.doc-sync-ran"
exit 0
EOF

  rm -f "$repo_root/tools/structural-lint.mjs"

  chmod +x \
    "$repo_root/tools/review-gate.sh" \
    "$repo_root/tools/minimal-quality-gate.sh" \
    "$repo_root/tools/doc-sync-gate.sh"

  if run_pre_commit_gate "$repo_root"; then
    return 1
  fi

  [ "$LAST_STATUS" -eq 2 ] &&
    [ ! -f "$repo_root/.doc-sync-ran" ] &&
    [[ "$LAST_OUTPUT" == *"missing tools/structural-lint.mjs"* ]]
}

case_pre_commit_runs_exact_gate_order() {
  local repo_root="$TMP_ROOT/case_pre_commit_runs_exact_gate_order"

  create_repo "$repo_root"

  cat > "$repo_root/tools/review-gate.sh" <<'EOF'
#!/bin/bash
set -u
printf 'review\n' >> "$1/.gate-order"
exit 0
EOF

  cat > "$repo_root/tools/minimal-quality-gate.sh" <<'EOF'
#!/bin/bash
set -u
printf 'quality\n' >> "$1/.gate-order"
exit 0
EOF

  cat > "$repo_root/tools/structural-gate.sh" <<'EOF'
#!/bin/bash
set -u
printf 'structural\n' >> "$1/.gate-order"
exit 0
EOF

  cat > "$repo_root/tools/terminology-gate.sh" <<'EOF'
#!/bin/bash
set -u
printf 'terminology\n' >> "$1/.gate-order"
exit 0
EOF

  cat > "$repo_root/tools/doc-sync-gate.sh" <<'EOF'
#!/bin/bash
set -u
printf 'doc-sync\n' >> "$1/.gate-order"
exit 0
EOF

  chmod +x \
    "$repo_root/tools/review-gate.sh" \
    "$repo_root/tools/minimal-quality-gate.sh" \
    "$repo_root/tools/structural-gate.sh" \
    "$repo_root/tools/terminology-gate.sh" \
    "$repo_root/tools/doc-sync-gate.sh"

  run_pre_commit_gate "$repo_root" || return 1

  local expected_order
  local actual_order
  expected_order=$(printf 'review\nquality\nstructural\nterminology\ndoc-sync')
  actual_order=$(cat "$repo_root/.gate-order")
  [ "$actual_order" = "$expected_order" ]
}

case_pre_commit_stops_on_review_failure() {
  local repo_root="$TMP_ROOT/case_pre_commit_stops_on_review_failure"

  create_repo "$repo_root"

  cat > "$repo_root/tools/review-gate.sh" <<'EOF'
#!/bin/bash
echo "simulated review failure" >&2
exit 17
EOF

  cat > "$repo_root/tools/minimal-quality-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.quality-ran"
exit 0
EOF

  cat > "$repo_root/tools/structural-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.structural-ran"
exit 0
EOF

  cat > "$repo_root/tools/terminology-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.terminology-ran"
exit 0
EOF

  cat > "$repo_root/tools/doc-sync-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.doc-sync-ran"
exit 0
EOF

  chmod +x \
    "$repo_root/tools/review-gate.sh" \
    "$repo_root/tools/minimal-quality-gate.sh" \
    "$repo_root/tools/structural-gate.sh" \
    "$repo_root/tools/terminology-gate.sh" \
    "$repo_root/tools/doc-sync-gate.sh"

  if run_pre_commit_gate "$repo_root"; then
    return 1
  fi

  [ "$LAST_STATUS" -eq 17 ] &&
    [ ! -f "$repo_root/.quality-ran" ] &&
    [ ! -f "$repo_root/.structural-ran" ] &&
    [ ! -f "$repo_root/.terminology-ran" ] &&
    [ ! -f "$repo_root/.doc-sync-ran" ] &&
    [[ "$LAST_OUTPUT" == *"simulated review failure"* ]]
}

case_pre_commit_stops_on_quality_failure() {
  local repo_root="$TMP_ROOT/case_pre_commit_stops_on_quality_failure"

  create_repo "$repo_root"

  cat > "$repo_root/tools/review-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  cat > "$repo_root/tools/minimal-quality-gate.sh" <<'EOF'
#!/bin/bash
echo "simulated quality failure" >&2
exit 11
EOF

  cat > "$repo_root/tools/structural-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.structural-ran"
exit 0
EOF

  cat > "$repo_root/tools/terminology-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.terminology-ran"
exit 0
EOF

  cat > "$repo_root/tools/doc-sync-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.doc-sync-ran"
exit 0
EOF

  chmod +x \
    "$repo_root/tools/review-gate.sh" \
    "$repo_root/tools/minimal-quality-gate.sh" \
    "$repo_root/tools/structural-gate.sh" \
    "$repo_root/tools/terminology-gate.sh" \
    "$repo_root/tools/doc-sync-gate.sh"

  if run_pre_commit_gate "$repo_root"; then
    return 1
  fi

  [ "$LAST_STATUS" -eq 11 ] &&
    [ ! -f "$repo_root/.structural-ran" ] &&
    [ ! -f "$repo_root/.terminology-ran" ] &&
    [ ! -f "$repo_root/.doc-sync-ran" ] &&
    [[ "$LAST_OUTPUT" == *"simulated quality failure"* ]]
}

case_pre_commit_returns_structural_exit_code() {
  local repo_root="$TMP_ROOT/case_pre_commit_returns_structural_exit_code"

  create_repo "$repo_root"

  cat > "$repo_root/tools/review-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  cat > "$repo_root/tools/minimal-quality-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  cat > "$repo_root/tools/structural-gate.sh" <<'EOF'
#!/bin/bash
echo "simulated structural failure" >&2
exit 2
EOF

  cat > "$repo_root/tools/terminology-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.terminology-ran"
exit 0
EOF

  cat > "$repo_root/tools/doc-sync-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.doc-sync-ran"
exit 0
EOF

  chmod +x \
    "$repo_root/tools/review-gate.sh" \
    "$repo_root/tools/minimal-quality-gate.sh" \
    "$repo_root/tools/structural-gate.sh" \
    "$repo_root/tools/terminology-gate.sh" \
    "$repo_root/tools/doc-sync-gate.sh"

  if run_pre_commit_gate "$repo_root"; then
    return 1
  fi

  [ "$LAST_STATUS" -eq 2 ] &&
    [ ! -f "$repo_root/.terminology-ran" ] &&
    [ ! -f "$repo_root/.doc-sync-ran" ] &&
    [[ "$LAST_OUTPUT" == *"simulated structural failure"* ]]
}

case_pre_commit_returns_terminology_exit_code() {
  local repo_root="$TMP_ROOT/case_pre_commit_returns_terminology_exit_code"

  create_repo "$repo_root"

  cat > "$repo_root/tools/review-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  cat > "$repo_root/tools/minimal-quality-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.quality-ran"
exit 0
EOF

  cat > "$repo_root/tools/structural-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.structural-ran"
exit 0
EOF

  cat > "$repo_root/tools/terminology-gate.sh" <<'EOF'
#!/bin/bash
set -u
echo "simulated terminology failure" >&2
exit 13
EOF

  cat > "$repo_root/tools/doc-sync-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.doc-sync-ran"
exit 0
EOF

  chmod +x \
    "$repo_root/tools/review-gate.sh" \
    "$repo_root/tools/minimal-quality-gate.sh" \
    "$repo_root/tools/structural-gate.sh" \
    "$repo_root/tools/terminology-gate.sh" \
    "$repo_root/tools/doc-sync-gate.sh"

  if run_pre_commit_gate "$repo_root"; then
    return 1
  fi

  [ "$LAST_STATUS" -eq 13 ] &&
    [ -f "$repo_root/.quality-ran" ] &&
    [ -f "$repo_root/.structural-ran" ] &&
    [ ! -f "$repo_root/.doc-sync-ran" ] &&
    [[ "$LAST_OUTPUT" == *"simulated terminology failure"* ]]
}

case_pre_commit_returns_doc_sync_exit_code() {
  local repo_root="$TMP_ROOT/case_pre_commit_returns_doc_sync_exit_code"

  create_repo "$repo_root"

  cat > "$repo_root/tools/review-gate.sh" <<'EOF'
#!/bin/bash
exit 0
EOF

  cat > "$repo_root/tools/minimal-quality-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.quality-ran"
exit 0
EOF

  cat > "$repo_root/tools/structural-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.structural-ran"
exit 0
EOF

  cat > "$repo_root/tools/terminology-gate.sh" <<'EOF'
#!/bin/bash
set -u
touch "$1/.terminology-ran"
exit 0
EOF

  cat > "$repo_root/tools/doc-sync-gate.sh" <<'EOF'
#!/bin/bash
set -u
echo "simulated doc-sync failure" >&2
exit 19
EOF

  chmod +x \
    "$repo_root/tools/review-gate.sh" \
    "$repo_root/tools/minimal-quality-gate.sh" \
    "$repo_root/tools/structural-gate.sh" \
    "$repo_root/tools/terminology-gate.sh" \
    "$repo_root/tools/doc-sync-gate.sh"

  if run_pre_commit_gate "$repo_root"; then
    return 1
  fi

  [ "$LAST_STATUS" -eq 19 ] &&
    [ -f "$repo_root/.quality-ran" ] &&
    [ -f "$repo_root/.structural-ran" ] &&
    [ -f "$repo_root/.terminology-ran" ] &&
    [[ "$LAST_OUTPUT" == *"simulated doc-sync failure"* ]]
}

require_source_files

assert_passes "normal project passes" case_normal_project_passes
assert_passes "threshold boundaries pass at 100/180/4/10" case_boundary_thresholds_pass
assert_passes "nesting boundary passes at 4" case_nesting_boundary_passes
assert_fails "long function fails after 100 lines" case_long_function_fails
assert_fails "long component fails after 180 lines" case_long_component_fails
assert_fails "too many parameters fail after 4" case_too_many_parameters_fail
assert_fails "complexity fails after 10" case_complexity_limit_fail
assert_fails "nesting fails after 4" case_nesting_limit_fail
assert_fails "relative cycle fails" case_relative_cycle_fails
assert_fails "alias cycle fails" case_alias_cycle_fails
assert_fails "cross-layer import fails" case_cross_layer_import_fails
assert_fails "page raw color fails UI reuse gate" case_page_raw_color_fails
assert_fails "page-local base Button fails UI reuse gate" case_page_local_button_fails
assert_fails "page native button fails UI reuse gate" case_page_native_button_fails
assert_passes "token CSS may hold raw token values" case_token_css_raw_values_pass
assert_passes "UI root may define primitive Button" case_ui_root_button_passes
assert_passes "allow-next-line with reason permits local exception" case_allow_next_line_reason_passes
assert_fails "allow-next-line without reason fails" case_allow_next_line_without_reason_fails
assert_passes "missing tsconfig skips" case_missing_tsconfig_skips
assert_passes "empty repo skips" case_empty_repo_skips
assert_passes "no scannable JS/TS code skips" case_no_scannable_code_skips
assert_passes "docs-only changes skip" case_docs_only_changes_skip
assert_passes "warning-only cases do not block and still report both warnings" case_warning_only_passes
assert_passes "technical layer directories do not count as top-level feature scope warnings" case_warning_scope_ignores_technical_layers
assert_passes "missing structural lint blocks with exit code 2" case_missing_lint_blocks
assert_passes "pre-commit blocks when structural lint file is missing" case_pre_commit_blocks_when_lint_is_missing
assert_passes "pre-commit blocks when structural gate file is missing" case_pre_commit_requires_structural_gate
assert_passes "pre-commit runs review -> quality -> structural -> terminology -> doc-sync in exact order" case_pre_commit_runs_exact_gate_order
assert_passes "pre-commit stops immediately when review gate fails" case_pre_commit_stops_on_review_failure
assert_passes "pre-commit preserves minimal-quality exit code and stops structural/terminology/doc-sync" case_pre_commit_stops_on_quality_failure
assert_passes "pre-commit preserves structural gate exit code and stops terminology/doc-sync" case_pre_commit_returns_structural_exit_code
assert_passes "pre-commit preserves terminology gate exit code and stops doc-sync" case_pre_commit_returns_terminology_exit_code
assert_passes "pre-commit preserves doc-sync exit code after review/structural/terminology pass" case_pre_commit_returns_doc_sync_exit_code

echo "All structural gate tests passed."
