#!/bin/bash
# DocMap:
# Layer: L3 / key script
# Module: tools
# Depends on: tools/render-project-scaffold.sh, target document governance tools, target experience governance tools, tools/init-target-runtime.mjs, tools/vibe-health-check.mjs
# Syncs with: README.md, DOC-MAP.md, skills/dev-builder/SKILL.md
# High-cost runtime smoke test for reusable project scaffolds.

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SOURCE_ROOT=$(dirname "$SCRIPT_DIR")
TMP_ROOT=""
KEEP_TMP=0
CASE_FILTER=""
TOOL_BIN_DIR=""
LOG_DIR=""
CLEANUP_ON_FAILURE=0
RUN_FAILED=0
FAILURE_LABEL=""
FAILURE_STEP=""
FAILURE_LOG_PATH=""
RUNTIME_CASE_COUNT=0

usage() {
  cat <<'EOF'
Usage:
  bash ./tools/test-runtime-project-scaffold.sh \
    [--case <next-feature-first|vite-feature-first|electron-next-feature-first|cli-feature-first>] \
    [--tool-bin <dir>] \
    [--log-dir <dir>] \
    [--keep-tmp] \
    [--cleanup-on-failure] \
    [--tmp-root <dir>]

Notes:
  - This is a high-cost runtime smoke test for scaffold templates.
  - It renders each template into a temp directory, runs npm ci, npm run build, and optional smoke.
  - npm lifecycle scripts are disabled during dependency restoration.
  - By default temp artifacts are cleaned up on success and kept on failure.
  - Pass --keep-tmp when you want to inspect success artifacts too.
  - Pass --cleanup-on-failure to opt back into automatic cleanup after failures.
  - Pass --tool-bin to prepend a fixture bin directory for node/npm fault injection or custom runtimes.
  - Pass --case to rerun only one scaffold label while debugging a runtime failure.
EOF
}

fail() {
  RUN_FAILED=1
  printf '[FAIL] %s\n' "$1" >&2
  if [ -n "$FAILURE_LABEL" ] && [ -n "$FAILURE_STEP" ]; then
    printf '[INFO] Failed case: %s | step: %s\n' "$FAILURE_LABEL" "$FAILURE_STEP" >&2
  fi
  if [ -n "$FAILURE_LOG_PATH" ]; then
    printf '[INFO] Failure log: %s\n' "$FAILURE_LOG_PATH" >&2
  fi
  if [ -n "${TMP_ROOT:-}" ] && [ "$KEEP_TMP" -ne 1 ] && [ "$CLEANUP_ON_FAILURE" -eq 1 ]; then
    printf '[INFO] Re-run without --cleanup-on-failure or pass --keep-tmp to inspect runtime test artifacts.\n' >&2
  fi
  exit 1
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --keep-tmp)
        KEEP_TMP=1
        shift
        ;;
      --cleanup-on-failure)
        CLEANUP_ON_FAILURE=1
        shift
        ;;
      --tmp-root)
        TMP_ROOT="${2:-}"
        [ -n "$TMP_ROOT" ] || fail "Missing value for --tmp-root"
        shift 2
        ;;
      --case)
        CASE_FILTER="${2:-}"
        [ -n "$CASE_FILTER" ] || fail "Missing value for --case"
        shift 2
        ;;
      --tool-bin)
        TOOL_BIN_DIR="${2:-}"
        [ -n "$TOOL_BIN_DIR" ] || fail "Missing value for --tool-bin"
        shift 2
        ;;
      --log-dir)
        LOG_DIR="${2:-}"
        [ -n "$LOG_DIR" ] || fail "Missing value for --log-dir"
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

prepend_tool_bin() {
  if [ -z "$TOOL_BIN_DIR" ]; then
    return
  fi

  [ -d "$TOOL_BIN_DIR" ] || fail "Tool bin directory not found: $TOOL_BIN_DIR"
  PATH="$TOOL_BIN_DIR:$PATH"
}

ensure_command_ready() {
  local command_name="$1"
  local probe_arg="${2:---version}"

  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required (check PATH or --tool-bin)"
  "$command_name" "$probe_arg" >/dev/null 2>&1 || fail "$command_name is required and must be runnable (check PATH or --tool-bin)"
}

ensure_dependencies() {
  prepend_tool_bin
  ensure_command_ready bash --version
  ensure_command_ready node --version
  ensure_command_ready npm --version
}

prepare_tmp_root() {
  if [ -n "$TMP_ROOT" ]; then
    [ ! -e "$TMP_ROOT" ] || fail "Temp root already exists: $TMP_ROOT"
    mkdir -p "$TMP_ROOT"
    return
  fi

  TMP_ROOT=$(mktemp -d)
}

prepare_log_dir() {
  if [ -n "$LOG_DIR" ]; then
    [ ! -e "$LOG_DIR" ] || [ -d "$LOG_DIR" ] || fail "Log dir exists and is not a directory: $LOG_DIR"
    mkdir -p "$LOG_DIR"
    return
  fi

  LOG_DIR="$TMP_ROOT/_logs"
  mkdir -p "$LOG_DIR"
}

cleanup() {
  if [ -z "${TMP_ROOT:-}" ] || [ ! -e "$TMP_ROOT" ]; then
    return
  fi

  if [ "$KEEP_TMP" -eq 1 ]; then
    printf '[INFO] Kept runtime test artifacts: %s\n' "$TMP_ROOT"
    return
  fi

  if [ "$RUN_FAILED" -eq 1 ] && [ "$CLEANUP_ON_FAILURE" -ne 1 ]; then
    printf '[INFO] Failure artifacts kept: %s\n' "$TMP_ROOT" >&2
    return
  fi

  rm -rf "$TMP_ROOT"
}

trap cleanup EXIT

log_step() {
  local label="$1"
  local step="$2"
  printf '[STEP] [%s] %s\n' "$label" "$step"
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g'
}

step_log_path() {
  local label_slug step_slug
  label_slug=$(slugify "$1")
  step_slug=$(slugify "$2")
  printf '%s/%s--%s.log\n' "$LOG_DIR" "$label_slug" "$step_slug"
}

run_step() {
  local label="$1"
  local step="$2"
  local log_path
  shift 2

  log_path=$(step_log_path "$label" "$step")
  log_step "$label" "$step"
  if "$@" >"$log_path" 2>&1; then
    printf '[PASS] [%s] %s\n' "$label" "$step"
    return 0
  fi

  FAILURE_LABEL="$label"
  FAILURE_STEP="$step"
  FAILURE_LOG_PATH="$log_path"
  fail "$label failed during: $step"
}

run_in_dir() {
  local dir="$1"
  shift

  (
    cd "$dir"
    "$@"
  )
}

render_scaffold() {
  local template_name="$1"
  local project_name="$2"
  local output_dir="$3"
  local title="${4:-$project_name}"

  bash "$SOURCE_ROOT/tools/render-project-scaffold.sh" \
    --template "$template_name" \
    --project-name "$project_name" \
    --title "$title" \
    --output "$output_dir"
}

verify_next_build() {
  local root="$1"
  test -f "$root/.next/BUILD_ID"
}

verify_vite_build() {
  local root="$1"
  test -f "$root/dist/index.html"
}

verify_electron_build() {
  local root="$1"
  test -f "$root/.next/BUILD_ID"
  test -f "$root/.electron-dist/main.js"
  test -f "$root/.electron-dist/preload.js"
}

verify_cli_build() {
  local root="$1"
  test -f "$root/src/index.mjs"
}

verify_hotspot_scaffold() {
  local root="$1"
  test -f "$root/tools/check-hotspots.mjs" || return 1
  test -f "$root/tools/hotspot-policy.mjs" || return 1
  test -f "$root/tools/hotspot-git.mjs" || return 1
  test -f "$root/tools/trusted-git.mjs" || return 1
  test -f "$root/.githooks/pre-commit" || return 1
  grep -F 'tools/check-hotspots.mjs' "$root/.githooks/pre-commit" >/dev/null || return 1
  grep -F -- '--strict --staged' "$root/.githooks/pre-commit" >/dev/null || return 1
  node -e '
    const fs = require("node:fs");
    const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (pkg.scripts?.["check:hotspots"] !== "node tools/check-hotspots.mjs .") process.exit(1);
    if (!pkg.scripts?.["check:health"]?.includes("tools/vibe-health-check.mjs")) process.exit(1);
  ' "$root/package.json"
}

verify_document_governance_scaffold() {
  local root="$1"
  for tool in \
    archive-lifecycle-docs.mjs \
    build-target-doc-index.mjs \
    check-lifecycle-doc-budget.mjs \
    check-target-doc-drift.mjs \
    markdown-governance-core.mjs \
    migrate-target-doc-system.mjs \
    resolve-target-doc-context.mjs \
    target-doc-migration-helpers.mjs \
    target-doc-manifest-core.mjs \
    target-doc-manifest-schema.mjs \
    target-doc-transaction.mjs \
    update-target-task-state.mjs; do
    test -f "$root/tools/$tool"
  done
  test -f "$root/文档索引.md"
  node -e '
    const fs = require("node:fs");
    const root = process.argv[1];
    const manifest = JSON.parse(fs.readFileSync(`${root}/.vibe-docs.json`, "utf8"));
    const pkg = JSON.parse(fs.readFileSync(`${root}/package.json`, "utf8"));
    if (manifest.schemaVersion !== 2) process.exit(1);
    if (manifest.documentIndex !== "文档索引.md") process.exit(1);
    if (!Array.isArray(manifest.documents)) process.exit(1);
    const requiredRoles = [
      "documentIndex",
      "productSpec",
      "devPlan",
      "currentExecution",
      "manualAcceptance",
      "interfaceContracts",
      "projectProfile",
      "constitutionDesign",
    ];
    for (const role of requiredRoles) {
      const entries = manifest.documents.filter((entry) => entry?.role === role);
      if (entries.length !== 1 || entries[0].path !== manifest[role]) process.exit(1);
    }
    const expectedPaths = {
      productSpec: "docs/需求文档.md",
      devPlan: "docs/项目治理/开发计划.md",
      currentExecution: "docs/plans/执行光标.md",
      manualAcceptance: "docs/项目治理/验收记录.md",
      interfaceContracts: "docs/接口契约.md",
      projectProfile: "docs/项目治理/项目画像.md",
      constitutionDesign: "docs/项目治理/宪法设计.md",
    };
    for (const [role, expectedPath] of Object.entries(expectedPaths)) {
      if (manifest[role] !== expectedPath) process.exit(1);
    }
    if (!manifest.loadPolicy?.always?.includes("documentIndex")) process.exit(1);
    if (typeof pkg.scripts?.["check:docs"] !== "string") process.exit(1);
    if (!pkg.scripts["check:docs"].includes("check-target-doc-drift.mjs")) process.exit(1);
    if (!pkg.scripts?.["check:health"]?.startsWith("npm run check:docs && ")) process.exit(1);
  ' "$root"
}

verify_constitution_scaffold() {
  local root="$1"
  test -f "$root/tools/check-target-constitution.mjs"
  test -f "$root/tools/init-target-constitution.mjs"
  test -f "$root/tools/init-target-task-context.mjs"
  test -f "$root/tools/experience-anchor-contract.mjs"
  test -f "$root/tools/experience-ledger-core.mjs"
  test -f "$root/tools/experience-managed-blocks.mjs"
  test -f "$root/tools/safe-target-fs.mjs"
  test -f "$root/tools/target-task-continuity-core.mjs"
  test -f "$root/docs/项目治理/项目画像.md"
  test -f "$root/docs/项目治理/宪法设计.md"
  test -f "$root/AGENTS.md"
  test -f "$root/CLAUDE.md"
  test -f "$root/.vibe-runtime.json"
  test ! -f "$root/会话记录.md"
  node -e '
    const fs = require("node:fs");
    const root = process.argv[1];
    const manifest = JSON.parse(fs.readFileSync(`${root}/.vibe-docs.json`, "utf8"));
    const registry = JSON.parse(fs.readFileSync(`${root}/.vibe-runtime.json`, "utf8"));
    if (manifest.projectProfile !== "docs/项目治理/项目画像.md") process.exit(1);
    if (manifest.constitutionDesign !== "docs/项目治理/宪法设计.md") process.exit(1);
    if (manifest.taskContext?.enabled !== false) process.exit(1);
    if (manifest.taskContext?.taskCapsulesRoot !== "docs/plans/任务") process.exit(1);
    if ("sessionJournal" in manifest.taskContext) process.exit(1);
    if ("experience" in manifest) process.exit(1);
    if (fs.existsSync(`${root}/经验教训.md`) || fs.existsSync(`${root}/经验索引.md`)) process.exit(1);
    if (registry.schemaVersion !== 1) process.exit(1);
    if (registry.generatedBy !== "vibe-coding-skills") process.exit(1);
    for (const runtimeFile of ["AGENTS.md", "CLAUDE.md"]) {
      const block = registry.runtimeBlocks?.[runtimeFile];
      if (block?.kind !== "target-runtime") process.exit(1);
      if (block?.version !== "6") process.exit(1);
      if (!/^[a-f0-9]{64}$/.test(block?.checksum || "")) process.exit(1);
    }
    if (!fs.readFileSync(`${root}/AGENTS.md`, "utf8").includes("Agent 宪法")) process.exit(1);
    if (!fs.readFileSync(`${root}/CLAUDE.md`, "utf8").includes("Agent 宪法")) process.exit(1);
    const rootMarkdown = fs.readdirSync(root).filter((name) => name.endsWith(".md")).sort();
    if (JSON.stringify(rootMarkdown) !== JSON.stringify(["AGENTS.md", "CLAUDE.md", "文档索引.md"])) process.exit(1);
  ' "$root"
  node "$root/tools/init-target-constitution.mjs" "$root" --skills-root "$SOURCE_ROOT" --check --json >/dev/null
  node "$root/tools/init-target-runtime.mjs" "$root" --skills-root "$SOURCE_ROOT" --check --json >/dev/null
  node "$root/tools/init-target-task-context.mjs" "$root" --check --json >/dev/null
}

verify_dependency_lock_scaffold() {
  local root="$1"
  test -f "$root/package.json"
  test -f "$root/package-lock.json"
  node -e '
    const fs = require("node:fs");
    const root = process.argv[1];
    const pkg = JSON.parse(fs.readFileSync(`${root}/package.json`, "utf8"));
    const lock = JSON.parse(fs.readFileSync(`${root}/package-lock.json`, "utf8"));
    const lockRoot = lock.packages?.[""];
    const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

    if (lock.lockfileVersion !== 3) process.exit(1);
    if (lock.name !== pkg.name || lockRoot?.name !== pkg.name) process.exit(1);
    if (lock.version !== pkg.version || lockRoot?.version !== pkg.version) process.exit(1);
    if (JSON.stringify(lockRoot?.bin ?? {}) !== JSON.stringify(pkg.bin ?? {})) process.exit(1);
    if (JSON.stringify(lock).includes("__NPM_PACKAGE_NAME__")) process.exit(1);

    for (const group of ["dependencies", "devDependencies"]) {
      const packageDependencies = pkg[group] ?? {};
      if (JSON.stringify(lockRoot?.[group] ?? {}) !== JSON.stringify(packageDependencies)) process.exit(1);
      for (const [dependency, version] of Object.entries(packageDependencies)) {
        if (!exactVersion.test(version)) process.exit(1);
        if (lock.packages?.[`node_modules/${dependency}`]?.version !== version) process.exit(1);
      }
    }
    for (const [dependency, version] of Object.entries(pkg.overrides ?? {})) {
      if (!exactVersion.test(version)) process.exit(1);
      if (lock.packages?.[`node_modules/${dependency}`]?.version !== version) process.exit(1);
    }
  ' "$root"
}

verify_electron_prepare_scaffold() {
  local root="$1"

  node - "$root" <<'NODE'
    const fs = require("node:fs");
    const root = process.argv[2];
    const pkg = JSON.parse(fs.readFileSync(`${root}/package.json`, "utf8"));
    const expected = "node node_modules/electron/install.js";

    if (pkg.scripts?.["prepare:electron"] !== expected) {
      throw new Error(`Electron scaffold must expose prepare:electron=${expected}`);
    }
NODE
}

should_run_case() {
  local label="$1"
  local template_name="$2"

  if [ -z "$CASE_FILTER" ]; then
    return 0
  fi

  [ "$CASE_FILTER" = "$label" ] || [ "$CASE_FILTER" = "$template_name" ]
}

run_runtime_case() {
  local label="$1"
  local template_name="$2"
  local project_name="$3"
  local output_dir="$4"
  local verify_fn="$5"

  if ! should_run_case "$label" "$template_name"; then
    return 0
  fi

  RUNTIME_CASE_COUNT=$((RUNTIME_CASE_COUNT + 1))

  run_step "$label" "render scaffold" \
    render_scaffold "$template_name" "$project_name" "$output_dir" "$project_name"

  run_step "$label" "verify hotspot scaffold" \
    verify_hotspot_scaffold "$output_dir"

  run_step "$label" "verify document governance scaffold" \
    verify_document_governance_scaffold "$output_dir"

  run_step "$label" "verify constitution scaffold" \
    verify_constitution_scaffold "$output_dir"

  run_step "$label" "verify reproducible dependency lock" \
    verify_dependency_lock_scaffold "$output_dir"

  if [ "$template_name" = "electron-next-feature-first" ]; then
    run_step "$label" "verify Electron preparation contract" \
      verify_electron_prepare_scaffold "$output_dir"
  fi

  run_step "$label" "npm ci --ignore-scripts" \
    run_in_dir "$output_dir" npm ci --ignore-scripts --no-audit --no-fund

  if [ "$template_name" = "electron-next-feature-first" ]; then
    run_step "$label" "npm run prepare:electron" \
      run_in_dir "$output_dir" npm run prepare:electron
  fi

  run_step "$label" "npm run build" \
    run_in_dir "$output_dir" npm run build

  run_step "$label" "npm run smoke --if-present" \
    run_in_dir "$output_dir" npm run smoke --if-present

  run_step "$label" "verify build artifacts" "$verify_fn" "$output_dir"
}

main() {
  parse_args "$@"
  ensure_dependencies
  prepare_tmp_root
  prepare_log_dir

  run_runtime_case \
    "next-feature-first" \
    "next-feature-first" \
    "Acme Next Runtime" \
    "$TMP_ROOT/next-app" \
    verify_next_build

  run_runtime_case \
    "vite-feature-first" \
    "vite-feature-first" \
    "Acme Vite Runtime" \
    "$TMP_ROOT/vite-app" \
    verify_vite_build

  run_runtime_case \
    "electron-next-feature-first" \
    "electron-next-feature-first" \
    "Acme Desktop Runtime" \
    "$TMP_ROOT/electron-app" \
    verify_electron_build

  run_runtime_case \
    "cli-feature-first" \
    "cli-feature-first" \
    "Acme CLI Runtime" \
    "$TMP_ROOT/cli-app" \
    verify_cli_build

  [ "$RUNTIME_CASE_COUNT" -gt 0 ] || fail "No runtime scaffold case matched: $CASE_FILTER"

  printf '[INFO] Runtime logs: %s\n' "$LOG_DIR"
  printf 'All runtime project scaffold smoke tests passed.\n'
}

main "$@"
