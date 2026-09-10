#!/bin/bash
# DocMap:
# Layer: L3 / 验证脚本
# Module: tools
# Depends on: tools/doc-sync-helpers.sh, tools/review-gate.sh, tools/doc-sync-gate.sh
# Verifies execution tier behavior for review/doc-sync gates.

set -euo pipefail

SOURCE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP_ROOT=$(mktemp -d)

if command -v pwsh >/dev/null 2>&1; then
  POWERSHELL_BIN="pwsh"
elif command -v powershell >/dev/null 2>&1; then
  POWERSHELL_BIN="powershell"
else
  POWERSHELL_BIN=""
fi

to_powershell_path() {
  local path="$1"

  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$path"
  else
    printf '%s\n' "$path"
  fi
}

run_powershell_hook_json() {
  local hook_path="$1"
  local json="$2"
  local hook_name="${3:-}"
  local bridge config_path payload_path bridge_ps payload_ps status

  [ -n "$POWERSHELL_BIN" ] || return 0
  bridge="$TMP_ROOT/invoke-codex-hook.ps1"
  if [ ! -f "$bridge" ]; then
    cat > "$bridge" <<'EOF'
[CmdletBinding()]
$configPath = Join-Path $PSScriptRoot "invoke-codex-hook-config.json"
$configText = [System.IO.File]::ReadAllText($configPath, [System.Text.Encoding]::UTF8)
$config = $configText | ConvertFrom-Json
$hookInput = [System.IO.File]::ReadAllText([string]$config.hookInputPath, [System.Text.Encoding]::UTF8)
if ([string]::IsNullOrWhiteSpace([string]$config.hookName)) {
    & ([string]$config.hookPath) -HookInput $hookInput
}
else {
    & ([string]$config.hookPath) -Hook ([string]$config.hookName) -HookInput $hookInput
}
exit $LASTEXITCODE
EOF
  fi

  config_path="$TMP_ROOT/invoke-codex-hook-config.json"
  payload_path="$TMP_ROOT/hook-input-${RANDOM}-${RANDOM}.json"
  printf '%s' "$json" > "$payload_path"
  bridge_ps=$(to_powershell_path "$bridge")
  payload_ps=$(to_powershell_path "$payload_path")
  node -e 'process.stdout.write(JSON.stringify({ hookPath: process.argv[1], hookInputPath: process.argv[2], hookName: process.argv[3] }))' "$hook_path" "$payload_ps" "$hook_name" > "$config_path"

  if "$POWERSHELL_BIN" -NoProfile -ExecutionPolicy Bypass -File "$bridge_ps"; then
    status=0
  else
    status=$?
  fi

  rm -f "$config_path" "$payload_path"
  return "$status"
}

cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

copy_gate_tools() {
  local repo="$1"
  mkdir -p "$repo/tools" "$repo/hooks" "$repo/codex-hooks" "$repo/.claude"
  cp "$SOURCE_ROOT/tools/doc-sync-helpers.sh" "$repo/tools/doc-sync-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-path-helpers.sh" "$repo/tools/doc-sync-path-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-doc-helpers.sh" "$repo/tools/doc-sync-doc-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-tier-helpers.sh" "$repo/tools/doc-sync-tier-helpers.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-state-helpers.sh" "$repo/tools/doc-sync-state-helpers.sh"
  cp "$SOURCE_ROOT/tools/review-gate.sh" "$repo/tools/review-gate.sh"
  cp "$SOURCE_ROOT/tools/doc-sync-gate.sh" "$repo/tools/doc-sync-gate.sh"
  cp "$SOURCE_ROOT/tools/mark-review-clean.sh" "$repo/tools/mark-review-clean.sh"
  cp "$SOURCE_ROOT/tools/mark-t2-check-clean.mjs" "$repo/tools/mark-t2-check-clean.mjs"
  cp "$SOURCE_ROOT/tools/safe-target-fs.mjs" "$repo/tools/safe-target-fs.mjs"
  cp "$SOURCE_ROOT/tools/trusted-git.mjs" "$repo/tools/trusted-git.mjs"
  cp "$SOURCE_ROOT/hooks/stop-gate.sh" "$repo/hooks/stop-gate.sh"
  cp "$SOURCE_ROOT/codex-hooks/shared.ps1" "$repo/codex-hooks/shared.ps1"
  cp "$SOURCE_ROOT/codex-hooks/shared-paths.ps1" "$repo/codex-hooks/shared-paths.ps1"
  cp "$SOURCE_ROOT/codex-hooks/shared-changes.ps1" "$repo/codex-hooks/shared-changes.ps1"
  cp "$SOURCE_ROOT/codex-hooks/shared-docs.ps1" "$repo/codex-hooks/shared-docs.ps1"
  cp "$SOURCE_ROOT/codex-hooks/stop-gate.ps1" "$repo/codex-hooks/stop-gate.ps1"
  cp "$SOURCE_ROOT/codex-hooks/pre-commit-check.ps1" "$repo/codex-hooks/pre-commit-check.ps1"
  cp "$SOURCE_ROOT/codex-hooks/mark-source-change-needed.ps1" "$repo/codex-hooks/mark-source-change-needed.ps1"
  cp "$SOURCE_ROOT/codex-hooks/run-hook.ps1" "$repo/codex-hooks/run-hook.ps1"
  cp "$SOURCE_ROOT/codex-hooks/stop-gate.sh" "$repo/codex-hooks/stop-gate.sh"
  cp "$SOURCE_ROOT/codex-hooks/pre-commit-check.sh" "$repo/codex-hooks/pre-commit-check.sh"
  cp "$SOURCE_ROOT/codex-hooks/mark-source-change-needed.sh" "$repo/codex-hooks/mark-source-change-needed.sh"
  cp "$SOURCE_ROOT/hooks/pre-commit-check.sh" "$repo/hooks/pre-commit-check.sh"
}

new_repo() {
  local name="$1"
  local repo="$TMP_ROOT/$name"
  mkdir -p "$repo"
  copy_gate_tools "$repo"
  git -C "$repo" init -q
  git -C "$repo" config user.email "test@example.com"
  git -C "$repo" config user.name "Execution Tier Test"
  git -C "$repo" config core.autocrlf false
  printf '# Test\n' > "$repo/AGENTS.md"
  git -C "$repo" add .
  git -C "$repo" commit -q -m "init"
  printf '%s\n' "$repo"
}

expect_pass() {
  local repo="$1"
  local gate="$2"

  if ! bash "$repo/tools/$gate" "$repo" >/tmp/execution-tier-gate.out 2>/tmp/execution-tier-gate.err; then
    echo "expected pass: $gate in $repo" >&2
    cat /tmp/execution-tier-gate.err >&2 || true
    exit 1
  fi
}

expect_block() {
  local repo="$1"
  local gate="$2"

  set +e
  bash "$repo/tools/$gate" "$repo" >/tmp/execution-tier-gate.out 2>/tmp/execution-tier-gate.err
  local status=$?
  set -e

  if [ "$status" -eq 0 ]; then
    echo "expected block: $gate in $repo" >&2
    cat /tmp/execution-tier-gate.out >&2 || true
    exit 1
  fi
}

stage_all() {
  local repo="$1"
  git -C "$repo" add -A
}

helper_tier() {
  local repo="$1"
  local path="$2"
  local status="${3:-M}"

  # shellcheck disable=SC1090
  source "$repo/tools/doc-sync-helpers.sh"
  doc_sync_staged_change_tier "$repo" "$path" "$status"
}

helper_untracked_tier() {
  local repo="$1"
  local path="$2"

  # shellcheck disable=SC1090
  source "$repo/tools/doc-sync-helpers.sh"
  doc_sync_untracked_change_tier "$repo" "$path"
}

helper_path_tier() {
  local repo="$1"
  local path="$2"

  # shellcheck disable=SC1090
  source "$repo/tools/doc-sync-helpers.sh"
  doc_sync_path_tier "$path"
}

helper_has_hazard() {
  local repo="$1"
  local path="$2"
  local status="${3:-M}"

  # shellcheck disable=SC1090
  source "$repo/tools/doc-sync-helpers.sh"
  doc_sync_staged_change_has_hazard_signal "$repo" "$path" "$status"
}

expect_tier() {
  local repo="$1"
  local path="$2"
  local status="$3"
  local expected="$4"
  local actual

  actual=$(helper_tier "$repo" "$path" "$status")
  if [ "$actual" != "$expected" ]; then
    echo "expected tier $expected for $path, got $actual" >&2
    exit 1
  fi
}

expect_path_tier() {
  local repo="$1"
  local path="$2"
  local expected="$3"
  local actual

  actual=$(helper_path_tier "$repo" "$path")
  if [ "$actual" != "$expected" ]; then
    echo "expected path tier $expected for $path, got $actual" >&2
    exit 1
  fi
}

expect_hazard() {
  local repo="$1"
  local path="$2"
  local status="${3:-M}"

  if ! helper_has_hazard "$repo" "$path" "$status"; then
    echo "expected hazard signal for $path" >&2
    exit 1
  fi
}

expect_not_hazard() {
  local repo="$1"
  local path="$2"
  local status="${3:-M}"

  if helper_has_hazard "$repo" "$path" "$status"; then
    echo "expected no hazard signal for $path" >&2
    exit 1
  fi
}

expect_stop_block() {
  local repo="$1"
  local output

  output=$(CLAUDE_PROJECT_DIR="$repo" bash "$repo/hooks/stop-gate.sh")
  if ! printf '%s\n' "$output" | grep -q '"decision"[[:space:]]*:[[:space:]]*"block"'; then
    echo "expected stop hook block in $repo" >&2
    printf '%s\n' "$output" >&2
    exit 1
  fi
}

expect_stop_pass() {
  local repo="$1"
  local output

  output=$(CLAUDE_PROJECT_DIR="$repo" bash "$repo/hooks/stop-gate.sh")
  if printf '%s\n' "$output" | grep -q '"decision"[[:space:]]*:[[:space:]]*"block"'; then
    echo "expected stop hook pass in $repo" >&2
    printf '%s\n' "$output" >&2
    exit 1
  fi
}

codex_hook_json_for_cwd() {
  local repo="$1"
  local repo_ps
  repo_ps=$(to_powershell_path "$repo")
  node -e 'process.stdout.write(JSON.stringify({cwd: process.argv[1]}))' "$repo_ps"
}

codex_commit_hook_json_for_cwd() {
  local repo="$1"
  local command="${2:-git commit}"
  local repo_ps
  repo_ps=$(to_powershell_path "$repo")
  node -e 'process.stdout.write(JSON.stringify({tool_input: {command: process.argv[2]}, cwd: process.argv[1]}))' "$repo_ps" "$command"
}

expect_codex_stop_pass() {
  local repo="$1"
  local script_ps json output
  [ -n "$POWERSHELL_BIN" ] || return 0
  script_ps=$(to_powershell_path "$repo/codex-hooks/stop-gate.ps1")
  json=$(codex_hook_json_for_cwd "$repo")
  output=$(run_powershell_hook_json "$script_ps" "$json" | tr -d '\r')
  if printf '%s\n' "$output" | grep -q '"decision"[[:space:]]*:[[:space:]]*"block"'; then
    echo "expected Codex stop hook pass in $repo" >&2
    printf '%s\n' "$output" >&2
    exit 1
  fi
}

expect_codex_stop_block() {
  local repo="$1"
  local script_ps json output
  [ -n "$POWERSHELL_BIN" ] || return 0
  script_ps=$(to_powershell_path "$repo/codex-hooks/stop-gate.ps1")
  json=$(codex_hook_json_for_cwd "$repo")
  output=$(run_powershell_hook_json "$script_ps" "$json" | tr -d '\r')
  if ! printf '%s\n' "$output" | grep -q '"decision"[[:space:]]*:[[:space:]]*"block"'; then
    echo "expected Codex stop hook block in $repo" >&2
    printf '%s\n' "$output" >&2
    exit 1
  fi
}

expect_codex_precommit_pass() {
  local repo="$1"
  local script_ps json
  [ -n "$POWERSHELL_BIN" ] || return 0
  script_ps=$(to_powershell_path "$repo/codex-hooks/pre-commit-check.ps1")
  json=$(codex_commit_hook_json_for_cwd "$repo")
  if ! run_powershell_hook_json "$script_ps" "$json" >/tmp/execution-tier-precommit.out 2>/tmp/execution-tier-precommit.err; then
    echo "expected Codex pre-commit fallback pass in $repo" >&2
    cat /tmp/execution-tier-precommit.err >&2 || true
    cat /tmp/execution-tier-precommit.out >&2 || true
    exit 1
  fi
}

expect_codex_precommit_block() {
  local repo="$1"
  local script_ps json status
  [ -n "$POWERSHELL_BIN" ] || return 0
  script_ps=$(to_powershell_path "$repo/codex-hooks/pre-commit-check.ps1")
  json=$(codex_commit_hook_json_for_cwd "$repo")
  set +e
  run_powershell_hook_json "$script_ps" "$json" >/tmp/execution-tier-precommit.out 2>/tmp/execution-tier-precommit.err
  status=$?
  set -e
  if [ "$status" -eq 0 ]; then
    echo "expected Codex pre-commit fallback block in $repo" >&2
    cat /tmp/execution-tier-precommit.out >&2 || true
    exit 1
  fi
}

mark_dirty() {
  local repo="$1"

  mkdir -p "$repo/.claude"
  printf 'dirty\n' > "$repo/.claude/.source-change-touched"
}

mark_t2_check_clean() {
  local repo="$1"

  node "$repo/tools/mark-t2-check-clean.mjs" "$repo" --evidence "targeted validation passed" >/tmp/execution-tier-t2-check.out 2>/tmp/execution-tier-t2-check.err
}

hook_json_for_command() {
  local command="$1"
  node -e 'process.stdout.write(JSON.stringify({tool_input: {command: process.argv[1]}}))' "$command"
}

test_bash_precommit_hook_detects_git_commit_variants() {
  local repo json command
  repo=$(new_repo bash-precommit-command-detection)
  cat > "$repo/tools/pre-commit-gate.sh" <<'EOF'
#!/bin/bash
printf 'called\n' > "$1/.precommit-called"
EOF

  for command in \
    "git commit -m test" \
    "git -C . commit -m test" \
    "git  -c user.name=test commit -m test" \
    "command git commit --amend"; do
    rm -f "$repo/.precommit-called"
    json=$(hook_json_for_command "$command")
    printf '%s' "$json" | CLAUDE_PROJECT_DIR="$repo" bash "$repo/hooks/pre-commit-check.sh"
    if [ ! -f "$repo/.precommit-called" ]; then
      echo "expected Bash pre-commit hook to detect: $command" >&2
      exit 1
    fi
  done

  rm -f "$repo/.precommit-called"
  json=$(hook_json_for_command "git status && echo commit")
  printf '%s' "$json" | CLAUDE_PROJECT_DIR="$repo" bash "$repo/hooks/pre-commit-check.sh"
  if [ -f "$repo/.precommit-called" ]; then
    echo "expected Bash pre-commit hook to ignore a non-commit git command" >&2
    exit 1
  fi
}

test_codex_shell_precommit_hook_detects_git_commit_variants() {
  local repo json command
  repo=$(new_repo codex-shell-precommit-command-detection)
  cat > "$repo/tools/pre-commit-gate.sh" <<'EOF'
#!/bin/bash
printf 'called\n' > "$1/.precommit-called"
EOF

  for command in \
    "git commit -m test" \
    "git -C . commit -m test" \
    "git  -c user.name=test commit -m test" \
    "command git commit --amend"; do
    rm -f "$repo/.precommit-called"
    json=$(node -e 'process.stdout.write(JSON.stringify({cwd: process.argv[1], tool_input: {command: process.argv[2]}}))' "$repo" "$command")
    printf '%s' "$json" | bash "$repo/codex-hooks/pre-commit-check.sh"
    if [ ! -f "$repo/.precommit-called" ]; then
      echo "expected Codex shell pre-commit hook to detect: $command" >&2
      exit 1
    fi
  done

  rm -f "$repo/.precommit-called"
  json=$(node -e 'process.stdout.write(JSON.stringify({cwd: process.argv[1], tool_input: {command: process.argv[2]}}))' "$repo" "git status && echo commit")
  printf '%s' "$json" | bash "$repo/codex-hooks/pre-commit-check.sh"
  if [ -f "$repo/.precommit-called" ]; then
    echo "expected Codex shell pre-commit hook to ignore a non-commit git command" >&2
    exit 1
  fi
}

test_codex_shell_stop_recomputes_without_marker() {
  local repo json output
  repo=$(new_repo codex-shell-stop-no-marker)
  mkdir -p "$repo/src"
  printf 'export const authEnabled = false;\n' > "$repo/src/auth.ts"
  git -C "$repo" add src/auth.ts
  git -C "$repo" commit -q -m "add auth"
  printf 'export const authEnabled = true;\n' > "$repo/src/auth.ts"
  stage_all "$repo"
  rm -f "$repo/.claude/.source-change-touched" "$repo/.claude/.needs-review" "$repo/.claude/.review-snapshot" "$repo/.claude/.needs-doc-sync"
  json=$(node -e 'process.stdout.write(JSON.stringify({cwd: process.argv[1]}))' "$repo")
  output=$(printf '%s' "$json" | bash "$repo/codex-hooks/stop-gate.sh")

  if ! printf '%s\n' "$output" | grep -q '"decision"[[:space:]]*:[[:space:]]*"block"'; then
    echo "expected Codex shell stop hook to recompute and block without marker" >&2
    printf '%s\n' "$output" >&2
    exit 1
  fi
}

test_codex_precommit_hook_detects_git_commit_variants() {
  local repo script_ps json command
  [ -n "$POWERSHELL_BIN" ] || return 0
  repo=$(new_repo codex-precommit-command-detection)
  cat > "$repo/tools/pre-commit-gate.sh" <<'EOF'
#!/bin/bash
printf 'called\n' > "$1/.precommit-called"
EOF
  script_ps=$(to_powershell_path "$repo/codex-hooks/pre-commit-check.ps1")

  for command in \
    "git commit -m test" \
    "git -C . commit -m test" \
    "git  -c user.name=test commit -m test" \
    "command git commit --amend"; do
    rm -f "$repo/.precommit-called"
    json=$(codex_commit_hook_json_for_cwd "$repo" "$command")
    run_powershell_hook_json "$script_ps" "$json" >/dev/null
    if [ ! -f "$repo/.precommit-called" ]; then
      echo "expected Codex pre-commit hook to detect: $command" >&2
      exit 1
    fi
  done

  rm -f "$repo/.precommit-called"
  json=$(codex_commit_hook_json_for_cwd "$repo" "git status && echo commit")
  run_powershell_hook_json "$script_ps" "$json" >/dev/null
  if [ -f "$repo/.precommit-called" ]; then
    echo "expected Codex pre-commit hook to ignore a non-commit git command" >&2
    exit 1
  fi
}

test_codex_runner_rejects_unknown_hook() {
  local repo runner_ps json status
  [ -n "$POWERSHELL_BIN" ] || return 0
  repo=$(new_repo codex-runner-allowlist)
  cat > "$repo/outside.ps1" <<'EOF'
Set-Content -LiteralPath (Join-Path $PSScriptRoot '.runner-escaped') -Value 'escaped'
EOF
  runner_ps=$(to_powershell_path "$repo/codex-hooks/run-hook.ps1")

  set +e
  "$POWERSHELL_BIN" -NoProfile -ExecutionPolicy Bypass -File "$runner_ps" -Hook '../outside' >/tmp/execution-tier-runner.out 2>/tmp/execution-tier-runner.err
  status=$?
  set -e

  if [ "$status" -eq 0 ] || [ -f "$repo/.runner-escaped" ]; then
    echo "expected Codex runner to reject path traversal / unknown hooks" >&2
    exit 1
  fi

  rm -f "$repo/outside.ps1"
  json=$(codex_hook_json_for_cwd "$repo")
  run_powershell_hook_json "$runner_ps" "$json" 'stop-gate' >/dev/null
}

test_readme_typo_is_t0() {
  local repo
  repo=$(new_repo readme-typo)
  printf 'Helllo world\n' > "$repo/README.md"
  git -C "$repo" add README.md
  git -C "$repo" commit -q -m "add readme"
  printf 'Hello world\n' > "$repo/README.md"
  stage_all "$repo"

  expect_tier "$repo" README.md M t0
  expect_not_hazard "$repo" README.md M
  expect_pass "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
}

test_agents_rule_change_requires_review_and_doc_sync() {
  local repo
  repo=$(new_repo agents-rule-change)
  printf '\n[规则]\n    hook 规则变更必须 review 和 doc-sync。\n' >> "$repo/AGENTS.md"
  stage_all "$repo"

  expect_tier "$repo" AGENTS.md M t3
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_agents_and_claude_counterpart_doc_sync_passes() {
  local repo
  repo=$(new_repo agents-claude-sync)
  printf '# Claude\n' > "$repo/.claude/CLAUDE.md"
  printf '# Redirect placeholder\n' > "$repo/CLAUDE.md"
  git -C "$repo" add .claude/CLAUDE.md CLAUDE.md
  git -C "$repo" commit -q -m "add claude"
  printf '\n[规则]\n    hook 规则变更必须 review。\n' >> "$repo/AGENTS.md"
  printf '\n[规则]\n    hook 规则变更必须 review。\n' >> "$repo/.claude/CLAUDE.md"
  stage_all "$repo"

  expect_tier "$repo" .claude/CLAUDE.md M t3
  expect_path_tier "$repo" CLAUDE.md t0
  expect_block "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
}

test_product_spec_requires_related_doc_sync() {
  local repo
  repo=$(new_repo product-spec-doc-sync)
  printf '# Product Spec\n\nOld rule\n' > "$repo/Product-Spec.md"
  printf '# DEV-PLAN\n\nOld plan\n' > "$repo/DEV-PLAN.md"
  git -C "$repo" add Product-Spec.md DEV-PLAN.md
  git -C "$repo" commit -q -m "add planning docs"
  printf '# Product Spec\n\nNew workflow rule\n' > "$repo/Product-Spec.md"
  git -C "$repo" add Product-Spec.md

  expect_block "$repo" doc-sync-gate.sh

  printf '# DEV-PLAN\n\nNew workflow rule\n' > "$repo/DEV-PLAN.md"
  git -C "$repo" add DEV-PLAN.md

  expect_pass "$repo" doc-sync-gate.sh
  expect_block "$repo" review-gate.sh
}

test_skill_change_is_t3() {
  local repo
  repo=$(new_repo skill-change)
  mkdir -p "$repo/skills/demo"
  printf '%s\n' '---' 'name: demo' 'description: demo' '---' > "$repo/skills/demo/SKILL.md"
  git -C "$repo" add skills/demo/SKILL.md
  git -C "$repo" commit -q -m "add skill"
  printf '\n[规则]\n    改一字也会改变 agent 行为。\n' >> "$repo/skills/demo/SKILL.md"
  stage_all "$repo"

  expect_tier "$repo" skills/demo/SKILL.md M t3
  expect_hazard "$repo" skills/demo/SKILL.md M
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_tsx_copy_is_t1() {
  local repo
  repo=$(new_repo tsx-copy)
  mkdir -p "$repo/src"
  cat > "$repo/src/App.tsx" <<'EOF'
export function App() {
  return (
    <button>Save</button>
  );
}
EOF
  git -C "$repo" add src/App.tsx
  git -C "$repo" commit -q -m "add app"
  sed -i 's/<button>Save<\/button>/<button>Save now<\/button>/' "$repo/src/App.tsx"
  stage_all "$repo"

  expect_tier "$repo" src/App.tsx M t1
  expect_not_hazard "$repo" src/App.tsx M
  expect_pass "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
}

test_tsx_classname_spacing_is_t1() {
  local repo
  repo=$(new_repo tsx-classname-spacing)
  mkdir -p "$repo/src"
  cat > "$repo/src/App.tsx" <<'EOF'
export function App() {
  return <button className="px-2 py-1">Save</button>;
}
EOF
  git -C "$repo" add src/App.tsx
  git -C "$repo" commit -q -m "add app"
  sed -i 's/px-2/px-3/' "$repo/src/App.tsx"
  stage_all "$repo"

  expect_tier "$repo" src/App.tsx M t1
  expect_not_hazard "$repo" src/App.tsx M
  expect_pass "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
}

test_vue_static_copy_is_t1() {
  local repo
  repo=$(new_repo vue-copy)
  mkdir -p "$repo/src"
  cat > "$repo/src/App.vue" <<'EOF'
<template>
  <button>Save</button>
</template>
EOF
  git -C "$repo" add src/App.vue
  git -C "$repo" commit -q -m "add vue app"
  sed -i 's/<button>Save<\/button>/<button>Save now<\/button>/' "$repo/src/App.vue"
  stage_all "$repo"

  expect_path_tier "$repo" src/App.vue t1
  expect_tier "$repo" src/App.vue M t1
  expect_not_hazard "$repo" src/App.vue M
  expect_pass "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
}

test_svelte_static_copy_is_t1() {
  local repo
  repo=$(new_repo svelte-copy)
  mkdir -p "$repo/src"
  cat > "$repo/src/App.svelte" <<'EOF'
<button>Save</button>
EOF
  git -C "$repo" add src/App.svelte
  git -C "$repo" commit -q -m "add svelte app"
  sed -i 's/<button>Save<\/button>/<button>Save now<\/button>/' "$repo/src/App.svelte"
  stage_all "$repo"

  expect_path_tier "$repo" src/App.svelte t1
  expect_tier "$repo" src/App.svelte M t1
  expect_not_hazard "$repo" src/App.svelte M
  expect_pass "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
}

test_html_static_copy_is_t1() {
  local repo
  repo=$(new_repo html-copy)
  mkdir -p "$repo/public"
  cat > "$repo/public/index.html" <<'EOF'
<button>Save</button>
EOF
  git -C "$repo" add public/index.html
  git -C "$repo" commit -q -m "add html"
  sed -i 's/<button>Save<\/button>/<button>Save now<\/button>/' "$repo/public/index.html"
  stage_all "$repo"

  expect_path_tier "$repo" public/index.html t1
  expect_tier "$repo" public/index.html M t1
  expect_not_hazard "$repo" public/index.html M
  expect_pass "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
}

test_css_scss_visual_property_changes_are_t1() {
  local repo
  repo=$(new_repo css-scss-visual)
  mkdir -p "$repo/src"
  cat > "$repo/src/styles.css" <<'EOF'
.button {
  color: red;
  width: 120px;
  top: 2px;
}
EOF
  cat > "$repo/src/theme.scss" <<'EOF'
.button {
  margin-top: 4px;
  transform: translateX(0);
}
EOF
  git -C "$repo" add src/styles.css src/theme.scss
  git -C "$repo" commit -q -m "add styles"
  sed -i 's/color: red/color: blue/' "$repo/src/styles.css"
  sed -i 's/width: 120px/width: 128px/' "$repo/src/styles.css"
  sed -i 's/top: 2px/top: 4px/' "$repo/src/styles.css"
  sed -i 's/margin-top: 4px/margin-top: 8px/' "$repo/src/theme.scss"
  sed -i 's/transform: translateX(0)/transform: translateX(2px)/' "$repo/src/theme.scss"
  stage_all "$repo"

  expect_path_tier "$repo" src/styles.css t1
  expect_path_tier "$repo" src/theme.scss t1
  expect_tier "$repo" src/styles.css M t1
  expect_tier "$repo" src/theme.scss M t1
  expect_not_hazard "$repo" src/styles.css M
  expect_not_hazard "$repo" src/theme.scss M
  expect_pass "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
}

test_tsx_submit_fetch_api_changes_upgrade_to_t3() {
  local repo
  repo=$(new_repo tsx-submit-fetch-api)
  mkdir -p "$repo/src"
  cat > "$repo/src/Form.tsx" <<'EOF'
export function Form() {
  return <form><button>Save</button></form>;
}
EOF
  git -C "$repo" add src/Form.tsx
  git -C "$repo" commit -q -m "add form"
  cat > "$repo/src/Form.tsx" <<'EOF'
export function Form() {
  return <form onSubmit={async () => fetch("/api/save")}><button>Save</button></form>;
}
EOF
  stage_all "$repo"

  expect_tier "$repo" src/Form.tsx M t3
  expect_hazard "$repo" src/Form.tsx M
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_tsx_event_handler_line_is_t2_not_t1() {
  local repo
  repo=$(new_repo tsx-event-handler-line)
  mkdir -p "$repo/src"
  cat > "$repo/src/Button.tsx" <<'EOF'
export function Button({ onSave }: { onSave: () => void }) {
  return <button className="primary" onClick={onSave}>Save</button>;
}
EOF
  git -C "$repo" add src/Button.tsx
  git -C "$repo" commit -q -m "add button"
  sed -i 's/className="primary"/className="secondary"/' "$repo/src/Button.tsx"
  stage_all "$repo"

  expect_tier "$repo" src/Button.tsx M t2
  expect_not_hazard "$repo" src/Button.tsx M
  expect_block "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
  mark_t2_check_clean "$repo"
  expect_pass "$repo" review-gate.sh
}

test_delete_button_copy_is_t3() {
  local repo
  repo=$(new_repo delete-button-copy)
  mkdir -p "$repo/src"
  cat > "$repo/src/DangerPanel.tsx" <<'EOF'
export function DangerPanel() {
  return <button>Archive</button>;
}
EOF
  git -C "$repo" add src/DangerPanel.tsx
  git -C "$repo" commit -q -m "add panel"
  sed -i 's/Archive/Delete account/' "$repo/src/DangerPanel.tsx"
  stage_all "$repo"

  expect_tier "$repo" src/DangerPanel.tsx M t3
  expect_hazard "$repo" src/DangerPanel.tsx M
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_high_risk_ui_path_copy_is_t3() {
  local repo
  repo=$(new_repo high-risk-ui-path)
  mkdir -p "$repo/src/auth"
  cat > "$repo/src/auth/Login.tsx" <<'EOF'
export function Login() {
  return <button>Sign in</button>;
}
EOF
  git -C "$repo" add src/auth/Login.tsx
  git -C "$repo" commit -q -m "add login"
  sed -i 's/Sign in/Continue/' "$repo/src/auth/Login.tsx"
  stage_all "$repo"

  expect_path_tier "$repo" src/auth/Login.tsx t3
  expect_tier "$repo" src/auth/Login.tsx M t3
  expect_hazard "$repo" src/auth/Login.tsx M
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_protected_source_doc_typo_is_at_least_t2() {
  local repo
  repo=$(new_repo protected-source-doc-typo)
  printf '# Product Spec\n\nHelllo\n' > "$repo/Product-Spec.md"
  git -C "$repo" add Product-Spec.md
  git -C "$repo" commit -q -m "add product spec"
  printf '# Product Spec\n\nHello\n' > "$repo/Product-Spec.md"
  stage_all "$repo"

  expect_tier "$repo" Product-Spec.md M t2
  expect_block "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
  mark_t2_check_clean "$repo"
  expect_pass "$repo" review-gate.sh
}

test_auth_change_is_t3() {
  local repo
  repo=$(new_repo auth-change)
  mkdir -p "$repo/src"
  printf 'export const authEnabled = false;\n' > "$repo/src/auth.ts"
  git -C "$repo" add src/auth.ts
  git -C "$repo" commit -q -m "add auth"
  printf 'export const authEnabled = true;\n' > "$repo/src/auth.ts"
  stage_all "$repo"

  expect_tier "$repo" src/auth.ts M t3
  expect_hazard "$repo" src/auth.ts M
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_auth_tsx_path_and_staged_tier_are_t3() {
  local repo
  repo=$(new_repo auth-tsx-change)
  mkdir -p "$repo/src"
  cat > "$repo/src/auth.tsx" <<'EOF'
export function AuthButton() {
  return <button>Sign in</button>;
}
EOF
  git -C "$repo" add src/auth.tsx
  git -C "$repo" commit -q -m "add auth tsx"
  sed -i 's/Sign in/Authorize/' "$repo/src/auth.tsx"
  stage_all "$repo"

  expect_path_tier "$repo" src/auth.tsx t3
  expect_tier "$repo" src/auth.tsx M t3
  expect_hazard "$repo" src/auth.tsx M
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_database_change_is_hazard_t3() {
  local repo
  repo=$(new_repo database-change)
  mkdir -p "$repo/src"
  printf 'export const databaseUrl = "sqlite://readonly";\n' > "$repo/src/db.ts"
  git -C "$repo" add src/db.ts
  git -C "$repo" commit -q -m "add db"
  printf 'export const databaseUrl = "postgres://primary";\n' > "$repo/src/db.ts"
  stage_all "$repo"

  expect_tier "$repo" src/db.ts M t3
  expect_hazard "$repo" src/db.ts M
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_migration_change_is_hazard_t3() {
  local repo
  repo=$(new_repo migration-change)
  mkdir -p "$repo/migrations"
  printf 'CREATE TABLE users (id TEXT PRIMARY KEY);\n' > "$repo/migrations/001_initial.sql"
  git -C "$repo" add migrations/001_initial.sql
  git -C "$repo" commit -q -m "add migration"
  printf 'ALTER TABLE users ADD COLUMN deleted_at TEXT;\n' > "$repo/migrations/001_initial.sql"
  stage_all "$repo"

  expect_tier "$repo" migrations/001_initial.sql M t3
  expect_hazard "$repo" migrations/001_initial.sql M
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_release_script_is_hazard_t3() {
  local repo
  repo=$(new_repo release-script)
  mkdir -p "$repo/scripts"
  printf '#!/bin/bash\necho dry-run\n' > "$repo/scripts/deploy.sh"
  git -C "$repo" add scripts/deploy.sh
  git -C "$repo" commit -q -m "add deploy script"
  printf '#!/bin/bash\necho publish\n' > "$repo/scripts/deploy.sh"
  stage_all "$repo"

  expect_tier "$repo" scripts/deploy.sh M t3
  expect_hazard "$repo" scripts/deploy.sh M
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_mixed_batch_uses_highest_tier() {
  local repo
  repo=$(new_repo mixed-batch)
  mkdir -p "$repo/hooks"
  printf '#!/bin/bash\nexit 0\n' > "$repo/hooks/stop-gate.sh"
  printf 'Helllo\n' > "$repo/README.md"
  git -C "$repo" add hooks/stop-gate.sh README.md
  git -C "$repo" commit -q -m "add files"
  printf '#!/bin/bash\necho hook\n' > "$repo/hooks/stop-gate.sh"
  printf 'Hello\n' > "$repo/README.md"
  stage_all "$repo"

  expect_tier "$repo" README.md M t0
  expect_tier "$repo" hooks/stop-gate.sh M t3
  expect_hazard "$repo" hooks/stop-gate.sh M
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_behavior_delete_is_at_least_t2() {
  local repo
  repo=$(new_repo behavior-delete)
  mkdir -p "$repo/src"
  printf 'export const value = 1;\n' > "$repo/src/util.ts"
  git -C "$repo" add src/util.ts
  git -C "$repo" commit -q -m "add util"
  rm "$repo/src/util.ts"
  stage_all "$repo"

  expect_tier "$repo" src/util.ts D t3
  expect_hazard "$repo" src/util.ts D
  expect_block "$repo" review-gate.sh
  expect_block "$repo" doc-sync-gate.sh
}

test_runtime_mirror_is_ignored() {
  local repo
  repo=$(new_repo runtime-mirror)
  mkdir -p "$repo/.agents/skills/demo"
  printf 'mirror\n' > "$repo/.agents/skills/demo/SKILL.md"
  stage_all "$repo"

  expect_tier "$repo" .agents/skills/demo/SKILL.md M t0
  expect_not_hazard "$repo" .agents/skills/demo/SKILL.md M
  expect_pass "$repo" review-gate.sh
  expect_pass "$repo" doc-sync-gate.sh
}

test_stop_gate_recomputes_without_dirty_marker_or_state() {
  local repo
  repo=$(new_repo stop-no-marker-fast-exit)
  mkdir -p "$repo/src"
  printf 'export const authEnabled = false;\n' > "$repo/src/auth.ts"
  git -C "$repo" add src/auth.ts
  git -C "$repo" commit -q -m "add auth"
  printf 'export const authEnabled = true;\n' > "$repo/src/auth.ts"
  stage_all "$repo"
  rm -f "$repo/.claude/.source-change-touched" "$repo/.claude/.needs-review" "$repo/.claude/.review-snapshot" "$repo/.claude/.needs-doc-sync"

  expect_stop_block "$repo"
}

test_stop_gate_blocks_source_change_with_dirty_marker_without_state_file() {
  local repo
  repo=$(new_repo stop-no-state)
  mkdir -p "$repo/src"
  printf 'export const authEnabled = false;\n' > "$repo/src/auth.ts"
  git -C "$repo" add src/auth.ts
  git -C "$repo" commit -q -m "add auth"
  printf 'export const authEnabled = true;\n' > "$repo/src/auth.ts"
  stage_all "$repo"
  rm -f "$repo/.claude/.needs-review" "$repo/.claude/.review-snapshot" "$repo/.claude/.needs-doc-sync"
  mark_dirty "$repo"

  expect_stop_block "$repo"
}

test_stop_gate_blocks_missing_review_snapshot() {
  local repo
  repo=$(new_repo stop-missing-snapshot)
  mkdir -p "$repo/src"
  printf 'export const authEnabled = false;\n' > "$repo/src/auth.ts"
  printf '# Product Spec\n\nAuth changed\n' > "$repo/Product-Spec.md"
  git -C "$repo" add src/auth.ts Product-Spec.md
  git -C "$repo" commit -q -m "add auth"
  printf 'export const authEnabled = true;\n' > "$repo/src/auth.ts"
  printf '# Product Spec\n\nAuth enabled\n' > "$repo/Product-Spec.md"
  stage_all "$repo"
  printf 'clean\n' > "$repo/.claude/.needs-review"
  rm -f "$repo/.claude/.review-snapshot"
  mark_dirty "$repo"

  expect_stop_block "$repo"
}

test_stop_gate_blocks_stale_review_snapshot() {
  local repo
  repo=$(new_repo stop-stale-snapshot)
  mkdir -p "$repo/src"
  printf 'export const authEnabled = false;\n' > "$repo/src/auth.ts"
  printf '# Product Spec\n\nAuth changed\n' > "$repo/Product-Spec.md"
  git -C "$repo" add src/auth.ts Product-Spec.md
  git -C "$repo" commit -q -m "add auth"
  printf 'export const authEnabled = true;\n' > "$repo/src/auth.ts"
  printf '# Product Spec\n\nAuth enabled\n' > "$repo/Product-Spec.md"
  stage_all "$repo"
  bash "$repo/tools/mark-review-clean.sh" "$repo" >/dev/null
  printf 'export const authEnabled = "strict";\n' > "$repo/src/auth.ts"
  stage_all "$repo"
  mark_dirty "$repo"

  expect_stop_block "$repo"
}

test_review_gate_blocks_same_path_stale_review_snapshot() {
  local repo before_hash after_hash
  repo=$(new_repo review-gate-stale-snapshot)
  mkdir -p "$repo/src"
  printf 'export const mode = "old";\n' > "$repo/src/logic.ts"
  printf '# Product Spec\n\nMode changed\n' > "$repo/Product-Spec.md"
  printf '# Dev Plan\n\nMode changed\n' > "$repo/DEV-PLAN.md"
  git -C "$repo" add src/logic.ts Product-Spec.md DEV-PLAN.md
  git -C "$repo" commit -q -m "add logic"
  printf 'export const mode = "reviewed";\n' > "$repo/src/logic.ts"
  printf '# Product Spec\n\nMode reviewed\n' > "$repo/Product-Spec.md"
  printf '# Dev Plan\n\nMode reviewed\n' > "$repo/DEV-PLAN.md"
  stage_all "$repo"
  bash "$repo/tools/mark-review-clean.sh" "$repo" >/dev/null
  source "$repo/tools/doc-sync-helpers.sh"
  before_hash=$(doc_sync_review_snapshot_hash "$repo")
  printf 'export const mode = "changed-after-review";\n' > "$repo/src/logic.ts"
  git -C "$repo" add src/logic.ts
  after_hash=$(doc_sync_review_snapshot_hash "$repo")

  if [ "$before_hash" = "$after_hash" ]; then
    echo "expected review snapshot hash to change when staged diff changes" >&2
    exit 1
  fi

  expect_block "$repo" review-gate.sh
}

test_stop_gate_blocks_doc_sync_clean_when_uncovered() {
  local repo
  repo=$(new_repo stop-doc-clean-stale)
  mkdir -p "$repo/src"
  printf 'export const authEnabled = false;\n' > "$repo/src/auth.ts"
  git -C "$repo" add src/auth.ts
  git -C "$repo" commit -q -m "add auth"
  printf 'export const authEnabled = true;\n' > "$repo/src/auth.ts"
  stage_all "$repo"
  bash "$repo/tools/mark-review-clean.sh" "$repo" >/dev/null
  printf 'clean\n' > "$repo/.claude/.needs-doc-sync"
  mark_dirty "$repo"

  expect_stop_block "$repo"
}

test_stop_gate_blocks_unstaged_event_handler_ui_change() {
  local repo
  repo=$(new_repo stop-unstaged-ui-event)
  mkdir -p "$repo/src"
  cat > "$repo/src/Button.tsx" <<'EOF'
export function Button({ onSave }: { onSave: () => void }) {
  return <button className="primary" onClick={onSave}>Save</button>;
}
EOF
  git -C "$repo" add src/Button.tsx
  git -C "$repo" commit -q -m "add button"
  sed -i 's/Save/Save now/' "$repo/src/Button.tsx"
  rm -f "$repo/.claude/.needs-review" "$repo/.claude/.review-snapshot" "$repo/.claude/.needs-doc-sync"
  mark_dirty "$repo"

  expect_stop_block "$repo"
}

test_stop_gate_passes_staged_t2_light_with_t2_check() {
  local repo
  repo=$(new_repo stop-staged-t2-light)
  mkdir -p "$repo/src"
  cat > "$repo/src/Button.tsx" <<'EOF'
export function Button({ onSave }: { onSave: () => void }) {
  return <button className="primary" onClick={onSave}>Save</button>;
}
EOF
  git -C "$repo" add src/Button.tsx
  git -C "$repo" commit -q -m "add button"
  sed -i 's/className="primary"/className="secondary"/' "$repo/src/Button.tsx"
  stage_all "$repo"
  mark_dirty "$repo"

  expect_stop_block "$repo"
  mark_t2_check_clean "$repo"
  expect_stop_pass "$repo"
}

test_stop_gate_blocks_stale_t2_check_snapshot() {
  local repo
  repo=$(new_repo stop-stale-t2-check)
  mkdir -p "$repo/src"
  cat > "$repo/src/Button.tsx" <<'EOF'
export function Button({ onSave }: { onSave: () => void }) {
  return <button className="primary" onClick={onSave}>Save</button>;
}
EOF
  git -C "$repo" add src/Button.tsx
  git -C "$repo" commit -q -m "add button"
  sed -i 's/className="primary"/className="secondary"/' "$repo/src/Button.tsx"
  stage_all "$repo"
  mark_t2_check_clean "$repo"
  sed -i 's/Save/Save now/' "$repo/src/Button.tsx"
  stage_all "$repo"
  mark_dirty "$repo"

  expect_stop_block "$repo"
}

test_t2_snapshot_hash_matches_bash_node_powershell_and_codex_stop() {
  local repo repo_ps shared_ps bash_hash node_hash ps_hash
  [ -n "$POWERSHELL_BIN" ] || return 0
  repo=$(new_repo t2-snapshot-cross-runtime)
  mkdir -p "$repo/src"
  cat > "$repo/src/Button.tsx" <<'EOF'
export function Button({ onSave }: { onSave: () => void }) {
  return <button className="primary" onClick={onSave}>Save</button>;
}
EOF
  git -C "$repo" add src/Button.tsx
  git -C "$repo" commit -q -m "add button"
  sed -i 's/className="primary"/className="secondary"/' "$repo/src/Button.tsx"
  stage_all "$repo"

  # shellcheck disable=SC1090
  source "$repo/tools/doc-sync-helpers.sh"
  bash_hash=$(doc_sync_t2_check_snapshot_hash "$repo")
  mark_t2_check_clean "$repo"
  node_hash=$(tr -d '[:space:]' < "$repo/.claude/.t2-check-snapshot")
  repo_ps=$(to_powershell_path "$repo")
  shared_ps=$(to_powershell_path "$repo/codex-hooks/shared.ps1")
  ps_hash=$("$POWERSHELL_BIN" -NoProfile -ExecutionPolicy Bypass -Command ". '$shared_ps'; Get-StagedT2CheckSnapshotHash -Root '$repo_ps'" | tr -d '\r\n[:space:]')

  if [ "$bash_hash" != "$node_hash" ] || [ "$bash_hash" != "$ps_hash" ]; then
    echo "expected T2 snapshot hash parity, bash=$bash_hash node=$node_hash powershell=$ps_hash" >&2
    exit 1
  fi

  mark_dirty "$repo"
  expect_codex_stop_pass "$repo"
}

test_review_snapshot_hash_records_when_root_is_dot() {
  # 回归：从仓库内部以相对根 "." 调用时，snapshot 必须仍能记录 staged source changes。
  # 曾有 bug：doc_sync_normalize_path 把 "." 归一为空串并被误用于 root，导致
  # doc_sync_write_review_snapshot 一进门就 return 1，快照恒为空，review-gate 因此永远判 stale。
  local repo stored_hash rc
  repo=$(new_repo review-snapshot-root-dot)
  mkdir -p "$repo/skills/demo"
  printf '%s\n' '---' 'name: demo' 'description: demo' '---' '# Demo' > "$repo/skills/demo/SKILL.md"
  git -C "$repo" add skills/demo/SKILL.md
  git -C "$repo" commit -q -m "add skill"
  printf '\n[规则]\n    hook rule requires strict review.\n' >> "$repo/skills/demo/SKILL.md"
  stage_all "$repo"

  # 关键：进入 repo 目录，用相对根 "." 调用（复现 hook 的真实调用方式）。
  ( cd "$repo" && bash tools/mark-review-clean.sh . >/dev/null )

  if [ ! -s "$repo/.claude/.review-snapshot" ]; then
    echo "root='.' 时 review snapshot 为空：staged source changes 未被记录（normalize_path 误用于 root）" >&2
    exit 1
  fi

  # 且用 "." 直接算的 hash 必须非空、并与传绝对路径一致。
  source "$repo/tools/doc-sync-helpers.sh"
  local dot_hash abs_hash
  dot_hash=$( cd "$repo" && doc_sync_review_snapshot_hash "." )
  abs_hash=$(doc_sync_review_snapshot_hash "$repo")
  if [ -z "$dot_hash" ] || [ "$dot_hash" != "$abs_hash" ]; then
    echo "root='.' 与绝对路径的 snapshot hash 不一致：dot='$dot_hash' abs='$abs_hash'" >&2
    exit 1
  fi
}

test_review_snapshot_hash_matches_bash_powershell() {
  local repo repo_ps shared_ps bash_hash stored_hash ps_hash
  [ -n "$POWERSHELL_BIN" ] || return 0
  repo=$(new_repo review-snapshot-cross-runtime)
  mkdir -p "$repo/skills/demo"
  printf '%s\n' '---' 'name: demo' 'description: demo' '---' '# Demo' > "$repo/skills/demo/SKILL.md"
  git -C "$repo" add skills/demo/SKILL.md
  git -C "$repo" commit -q -m "add skill"
  printf '\n[规则]\n    hook rule requires strict review.\n' >> "$repo/skills/demo/SKILL.md"
  stage_all "$repo"

  # shellcheck disable=SC1090
  source "$repo/tools/doc-sync-helpers.sh"
  bash_hash=$(doc_sync_review_snapshot_hash "$repo")
  bash "$repo/tools/mark-review-clean.sh" "$repo" >/dev/null
  stored_hash=$(tr -d '[:space:]' < "$repo/.claude/.review-snapshot")
  repo_ps=$(to_powershell_path "$repo")
  shared_ps=$(to_powershell_path "$repo/codex-hooks/shared.ps1")
  ps_hash=$("$POWERSHELL_BIN" -NoProfile -ExecutionPolicy Bypass -Command ". '$shared_ps'; Get-StagedReviewSnapshotHash -Root '$repo_ps'" | tr -d '\r\n[:space:]')

  if [ "$bash_hash" != "$stored_hash" ] || [ "$bash_hash" != "$ps_hash" ]; then
    echo "expected review snapshot hash parity, bash=$bash_hash stored=$stored_hash powershell=$ps_hash" >&2
    exit 1
  fi
}

test_codex_stop_accepts_readme_doc_sync_cover() {
  local repo
  repo=$(new_repo codex-stop-readme-cover)
  printf '# README\n\nInitial docs.\n' > "$repo/README.md"
  git -C "$repo" add README.md
  git -C "$repo" commit -q -m "add readme"
  printf '\n[规则]\n    hook rule requires doc sync.\n' >> "$repo/AGENTS.md"
  printf '\nWorkflow rule covered for AGENTS changes.\n' >> "$repo/README.md"
  stage_all "$repo"
  bash "$repo/tools/mark-review-clean.sh" "$repo" >/dev/null
  mark_dirty "$repo"

  expect_pass "$repo" doc-sync-gate.sh
  expect_codex_stop_pass "$repo"
}

test_codex_precommit_fallback_accepts_t2_check() {
  local repo
  repo=$(new_repo codex-precommit-t2-fallback)
  mkdir -p "$repo/src"
  cat > "$repo/src/Button.tsx" <<'EOF'
export function Button({ onSave }: { onSave: () => void }) {
  return <button className="primary" onClick={onSave}>Save</button>;
}
EOF
  git -C "$repo" add src/Button.tsx
  git -C "$repo" commit -q -m "add button"
  sed -i 's/className="primary"/className="secondary"/' "$repo/src/Button.tsx"
  stage_all "$repo"

  expect_codex_precommit_block "$repo"
  mark_t2_check_clean "$repo"
  expect_codex_precommit_pass "$repo"
}

test_stop_gate_blocks_untracked_ui_behavior_file() {
  local repo
  repo=$(new_repo stop-untracked-ui-file)
  mkdir -p "$repo/src"
  cat > "$repo/src/NewPanel.tsx" <<'EOF'
export function NewPanel() {
  return <section>New panel</section>;
}
EOF
  rm -f "$repo/.claude/.needs-review" "$repo/.claude/.review-snapshot" "$repo/.claude/.needs-doc-sync"
  mark_dirty "$repo"

  if [ "$(helper_untracked_tier "$repo" src/NewPanel.tsx)" != "t2" ]; then
    echo "expected untracked UI behavior file to be t2" >&2
    exit 1
  fi

  expect_stop_block "$repo"
}

test_stop_gate_blocks_untracked_high_risk_ui_change() {
  local repo
  repo=$(new_repo stop-untracked-high-risk-ui)
  mkdir -p "$repo/src"
  git -C "$repo" commit --allow-empty -q -m "baseline"
  cat > "$repo/src/Form.tsx" <<'EOF'
export function Form() {
  return <form onSubmit={async () => fetch("/api/save")}><button>Save</button></form>;
}
EOF
  rm -f "$repo/.claude/.needs-review" "$repo/.claude/.review-snapshot" "$repo/.claude/.needs-doc-sync"
  mark_dirty "$repo"

  if [ "$(helper_untracked_tier "$repo" src/Form.tsx)" != "t3" ]; then
    echo "expected untracked high-risk TSX to be t3" >&2
    exit 1
  fi

  expect_stop_block "$repo"
}

test_mark_source_change_needed_not_cleared_by_unrelated_readme_typo() {
  local repo repo_ps readme_ps script_ps json state
  [ -n "$POWERSHELL_BIN" ] || return 0
  repo=$(new_repo mark-doc-readme-typo)
  printf 'Helllo\n' > "$repo/README.md"
  printf '#!/bin/bash\nexit 0\n' > "$repo/hooks/runtime.sh"
  git -C "$repo" add README.md hooks/runtime.sh
  git -C "$repo" commit -q -m "add files"
  printf '#!/bin/bash\necho changed\n' > "$repo/hooks/runtime.sh"
  printf 'Hello\n' > "$repo/README.md"
  printf 'needs_doc_sync\n' > "$repo/.claude/.needs-doc-sync"

  repo_ps=$(to_powershell_path "$repo")
  readme_ps=$(to_powershell_path "$repo/README.md")
  script_ps=$(to_powershell_path "$repo/codex-hooks/mark-source-change-needed.ps1")
  json=$(node -e 'process.stdout.write(JSON.stringify({cwd: process.argv[1], tool_input: {file_path: process.argv[2]}}))' "$repo_ps" "$readme_ps")
  run_powershell_hook_json "$script_ps" "$json" >/dev/null
  state=$(tr -d '[:space:]' < "$repo/.claude/.needs-doc-sync")

  if [ "$state" != "needs_doc_sync" ]; then
    echo "expected mark-source-change-needed to keep needs_doc_sync, got $state" >&2
    exit 1
  fi
}

test_power_shell_shared_tier_matches_bash() {
  local repo repo_ps shared_ps output
  [ -n "$POWERSHELL_BIN" ] || return 0
  repo=$(new_repo powershell-tier)
  mkdir -p "$repo/src"
  cat > "$repo/src/App.vue" <<'EOF'
<template>
  <button>Save</button>
</template>
EOF
  cat > "$repo/src/Button.tsx" <<'EOF'
export function Button({ onSave }: { onSave: () => void }) {
  return <button className="primary" onClick={onSave}>Save</button>;
}
EOF
  cat > "$repo/src/styles.css" <<'EOF'
.button {
  color: red;
  transform: translateX(0);
  top: 2px;
}
EOF
  git -C "$repo" add src/App.vue src/Button.tsx src/styles.css
  git -C "$repo" commit -q -m "add ui files"
  sed -i 's/<button>Save<\/button>/<button>Save now<\/button>/' "$repo/src/App.vue"
  sed -i 's/className="primary"/className="secondary"/' "$repo/src/Button.tsx"
  sed -i 's/color: red/color: blue/' "$repo/src/styles.css"
  sed -i 's/transform: translateX(0)/transform: translateX(2px)/' "$repo/src/styles.css"
  sed -i 's/top: 2px/top: 4px/' "$repo/src/styles.css"
  stage_all "$repo"

  repo_ps=$(to_powershell_path "$repo")
  shared_ps=$(to_powershell_path "$repo/codex-hooks/shared.ps1")
  output=$("$POWERSHELL_BIN" -NoProfile -ExecutionPolicy Bypass -Command ". '$shared_ps'; @((Get-RepoPathExecutionTier 'src/auth.tsx'), (Get-RepoPathExecutionTier 'src/App.tsx'), (Get-RepoPathExecutionTier 'src/App.vue'), (Get-RepoPathExecutionTier 'src/App.svelte'), (Get-RepoPathExecutionTier 'public/index.html'), (Get-RepoPathExecutionTier 'src/styles.css'), (Get-RepoPathExecutionTier 'AGENTS.md'), (Get-RepoPathExecutionTier '.agents/skills/demo/SKILL.md'), (Get-StagedChangeExecutionTier -Root '$repo_ps' -Path 'src/App.vue' -Status 'M'), (Get-StagedChangeExecutionTier -Root '$repo_ps' -Path 'src/Button.tsx' -Status 'M'), (Get-StagedChangeExecutionTier -Root '$repo_ps' -Path 'src/styles.css' -Status 'M'), (Get-RepoPathGateLevel 'src/auth.tsx'), (Get-RepoPathGateLevel 'src/App.tsx'), (Get-StagedChangeGateLevel -Root '$repo_ps' -Path 'src/Button.tsx' -Status 'M'), (Get-StagedChangeGateLevel -Root '$repo_ps' -Path 'src/App.vue' -Status 'M')) -join ','" | tr -d '\r')

  if [ "$output" != "t3,t1,t1,t1,t1,t1,t2,t0,t1,t2,t1,strict,none,t2-light,none" ]; then
    echo "unexpected PowerShell tier output: $output" >&2
    exit 1
  fi
}

test_power_shell_worktree_tier_matches_bash() {
  local repo repo_ps shared_ps output
  [ -n "$POWERSHELL_BIN" ] || return 0
  repo=$(new_repo powershell-worktree-tier)
  mkdir -p "$repo/src"
  cat > "$repo/src/Button.tsx" <<'EOF'
export function Button({ onSave }: { onSave: () => void }) {
  return <button className="primary" onClick={onSave}>Save</button>;
}
EOF
  git -C "$repo" add src/Button.tsx
  git -C "$repo" commit -q -m "add button"
  sed -i 's/Save/Save now/' "$repo/src/Button.tsx"

  repo_ps=$(to_powershell_path "$repo")
  shared_ps=$(to_powershell_path "$repo/codex-hooks/shared.ps1")
  output=$("$POWERSHELL_BIN" -NoProfile -ExecutionPolicy Bypass -Command ". '$shared_ps'; @((Get-WorktreeChangeExecutionTier -Root '$repo_ps' -Path 'src/Button.tsx' -Status 'M'), @((Get-CurrentSourceChangeRecords -Root '$repo_ps' -Scope 'unstaged')).Count, @((Get-CurrentStrictSourceChangeRecords -Root '$repo_ps' -Scope 'unstaged')).Count, @((Get-CurrentT2LightChangeRecords -Root '$repo_ps' -Scope 'unstaged')).Count) -join ','" | tr -d '\r')

  if [ "$output" != "t2,1,0,1" ]; then
    echo "unexpected PowerShell worktree tier output: $output" >&2
    exit 1
  fi
}

test_power_shell_untracked_tier_matches_bash() {
  local repo repo_ps shared_ps output
  [ -n "$POWERSHELL_BIN" ] || return 0
  repo=$(new_repo powershell-untracked-tier)
  mkdir -p "$repo/src"
  cat > "$repo/src/NewPanel.tsx" <<'EOF'
export function NewPanel() {
  return <section>New panel</section>;
}
EOF
  cat > "$repo/src/Form.tsx" <<'EOF'
export function Form() {
  return <form onSubmit={async () => fetch("/api/save")}><button>Save</button></form>;
}
EOF

  repo_ps=$(to_powershell_path "$repo")
  shared_ps=$(to_powershell_path "$repo/codex-hooks/shared.ps1")
  output=$("$POWERSHELL_BIN" -NoProfile -ExecutionPolicy Bypass -Command ". '$shared_ps'; @((Get-UntrackedChangeExecutionTier -Root '$repo_ps' -Path 'src/NewPanel.tsx'), (Get-UntrackedChangeExecutionTier -Root '$repo_ps' -Path 'src/Form.tsx'), @((Get-CurrentSourceChangeRecords -Root '$repo_ps' -Scope 'untracked')).Count, @((Get-CurrentStrictSourceChangeRecords -Root '$repo_ps' -Scope 'untracked')).Count, @((Get-CurrentT2LightChangeRecords -Root '$repo_ps' -Scope 'untracked')).Count) -join ','" | tr -d '\r')

  if [ "$output" != "t2,t3,2,1,1" ]; then
    echo "unexpected PowerShell untracked tier output: $output" >&2
    exit 1
  fi
}

test_power_shell_git_nul_output_is_terminated() {
  local repo repo_ps shared_ps output
  if [ -z "$POWERSHELL_BIN" ]; then
    echo "PowerShell Git -z regression skipped: pwsh/powershell is not available" >&2
    return 0
  fi
  repo=$(new_repo powershell-nul-output)
  mkdir -p "$repo/src"
  printf '%s\n' 'untracked' > "$repo/src/untracked.txt"

  repo_ps=$(to_powershell_path "$repo")
  shared_ps=$(to_powershell_path "$repo/codex-hooks/shared.ps1")
  output=$("$POWERSHELL_BIN" -NoProfile -ExecutionPolicy Bypass -Command ". '$shared_ps'; \$git = Get-TrustedGitCommand -Root '$repo_ps'; \$bytes = Invoke-CodexHookTrustedGitBytes -Git \$git -Root '$repo_ps' -GitArgs @('ls-files', '--others', '--exclude-standard', '-z'); if(\$LASTEXITCODE -ne 0 -or \$null -eq \$bytes -or \$bytes.Length -eq 0 -or \$bytes[\$bytes.Length - 1] -ne 0) { exit 1 }; 'terminated'" | tr -d '\r')

  if [ "$output" != "terminated" ]; then
    echo "expected PowerShell Git -z output to retain the trailing NUL, got: $output" >&2
    exit 1
  fi
}

test_power_shell_parse_checks_pass() {
  local source_ps
  [ -n "$POWERSHELL_BIN" ] || return 0
  source_ps=$(to_powershell_path "$SOURCE_ROOT")
  "$POWERSHELL_BIN" -NoProfile -ExecutionPolicy Bypass -Command "\$hookDir = Join-Path '$source_ps' 'codex-hooks'; \$files = Get-ChildItem -LiteralPath \$hookDir -Filter '*.ps1'; foreach(\$file in \$files){ \$errs = \$null; [System.Management.Automation.Language.Parser]::ParseFile(\$file.FullName, [ref]\$null, [ref]\$errs) > \$null; if(\$errs){ \$errs | Format-List | Out-String; exit 1 } }"
}

test_release_builder_documents_hazard_mode() {
  grep -q 'T3+ hazard mode' "$SOURCE_ROOT/skills/release-builder/SKILL.md"
  grep -qi 'hazard task packet' "$SOURCE_ROOT/skills/release-builder/SKILL.md"
  grep -qi 'rollback' "$SOURCE_ROOT/skills/release-builder/SKILL.md"
}

copy_full_package() {
  local name="$1"
  local repo="$TMP_ROOT/$name"
  mkdir -p "$repo"
  git -C "$SOURCE_ROOT" archive --format=tar HEAD | tar -xf - -C "$repo"
  git -C "$repo" init -q
  git -C "$repo" config user.email "test@example.com"
  git -C "$repo" config user.name "Execution Tier Test"
  git -C "$repo" config core.autocrlf false
  printf '%s\n' "$repo"
}

test_setup_repo_skips_hooks_without_baseline_commit() {
  local repo hooks_path
  repo=$(copy_full_package setup-no-baseline)

  bash "$repo/tools/setup-repo.sh" >/tmp/execution-tier-setup.out 2>/tmp/execution-tier-setup.err
  hooks_path=$(git -C "$repo" config --get core.hooksPath || true)

  if [ -n "$hooks_path" ]; then
    echo "expected setup-repo to skip hooks before baseline commit, got hooksPath=$hooks_path" >&2
    exit 1
  fi

  if ! grep -qi 'baseline commit' /tmp/execution-tier-setup.out; then
    echo "expected setup-repo to explain baseline commit requirement" >&2
    cat /tmp/execution-tier-setup.out >&2 || true
    exit 1
  fi
}

test_install_git_hooks_blocks_without_baseline_commit() {
  local repo
  repo=$(copy_full_package install-no-baseline)

  if bash "$repo/tools/install-git-hooks.sh" >/tmp/execution-tier-install.out 2>/tmp/execution-tier-install.err; then
    echo "expected install-git-hooks to block before baseline commit" >&2
    exit 1
  fi

  if ! grep -qi 'baseline commit' /tmp/execution-tier-install.err; then
    echo "expected install-git-hooks to explain baseline commit requirement" >&2
    cat /tmp/execution-tier-install.err >&2 || true
    exit 1
  fi
}

test_setup_repo_installs_hooks_after_baseline_commit() {
  local repo hooks_path
  repo=$(copy_full_package setup-after-baseline)
  git -C "$repo" add -A
  git -C "$repo" commit -q -m "baseline"

  bash "$repo/tools/setup-repo.sh" >/tmp/execution-tier-setup.out 2>/tmp/execution-tier-setup.err
  hooks_path=$(git -C "$repo" config --get core.hooksPath || true)

  if [ "$hooks_path" != ".githooks" ]; then
    echo "expected setup-repo to install hooks after baseline commit, got hooksPath=$hooks_path" >&2
    cat /tmp/execution-tier-setup.out >&2 || true
    cat /tmp/execution-tier-setup.err >&2 || true
    exit 1
  fi
}

test_readme_typo_is_t0
test_agents_rule_change_requires_review_and_doc_sync
test_agents_and_claude_counterpart_doc_sync_passes
test_product_spec_requires_related_doc_sync
test_skill_change_is_t3
test_tsx_copy_is_t1
test_tsx_classname_spacing_is_t1
test_vue_static_copy_is_t1
test_svelte_static_copy_is_t1
test_html_static_copy_is_t1
test_css_scss_visual_property_changes_are_t1
test_tsx_submit_fetch_api_changes_upgrade_to_t3
test_tsx_event_handler_line_is_t2_not_t1
test_delete_button_copy_is_t3
test_high_risk_ui_path_copy_is_t3
test_protected_source_doc_typo_is_at_least_t2
test_auth_change_is_t3
test_auth_tsx_path_and_staged_tier_are_t3
test_database_change_is_hazard_t3
test_migration_change_is_hazard_t3
test_release_script_is_hazard_t3
test_mixed_batch_uses_highest_tier
test_behavior_delete_is_at_least_t2
test_runtime_mirror_is_ignored
test_bash_precommit_hook_detects_git_commit_variants
test_codex_shell_precommit_hook_detects_git_commit_variants
test_codex_shell_stop_recomputes_without_marker
test_stop_gate_recomputes_without_dirty_marker_or_state
test_stop_gate_blocks_source_change_with_dirty_marker_without_state_file
test_stop_gate_blocks_missing_review_snapshot
test_stop_gate_blocks_stale_review_snapshot
test_review_gate_blocks_same_path_stale_review_snapshot
test_stop_gate_blocks_doc_sync_clean_when_uncovered
test_stop_gate_blocks_unstaged_event_handler_ui_change
test_stop_gate_passes_staged_t2_light_with_t2_check
test_stop_gate_blocks_stale_t2_check_snapshot
test_t2_snapshot_hash_matches_bash_node_powershell_and_codex_stop
test_review_snapshot_hash_records_when_root_is_dot
test_review_snapshot_hash_matches_bash_powershell
test_codex_stop_accepts_readme_doc_sync_cover
test_codex_precommit_fallback_accepts_t2_check
test_codex_precommit_hook_detects_git_commit_variants
test_codex_runner_rejects_unknown_hook
test_stop_gate_blocks_untracked_ui_behavior_file
test_stop_gate_blocks_untracked_high_risk_ui_change
test_mark_source_change_needed_not_cleared_by_unrelated_readme_typo
test_power_shell_shared_tier_matches_bash
test_power_shell_worktree_tier_matches_bash
test_power_shell_untracked_tier_matches_bash
test_power_shell_git_nul_output_is_terminated
test_power_shell_parse_checks_pass
bash "$SOURCE_ROOT/tools/test-hook-path-classification.sh"
test_release_builder_documents_hazard_mode
test_setup_repo_skips_hooks_without_baseline_commit
test_install_git_hooks_blocks_without_baseline_commit
test_setup_repo_installs_hooks_after_baseline_commit

echo "execution tier gate tests passed"
