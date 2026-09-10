#!/bin/bash
# DocMap:
# Layer: L3 / key script
# Module: tools
# Depends on: examples/golden-path/, tools/vibe-health-check.mjs
# Syncs with: README.md, DOC-MAP.md, tools/INDEX.md, .github/workflows/vibe-quality.yml
# Runs install, health, build, and optional test/smoke for golden path examples.

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(dirname "$SCRIPT_DIR")
EXAMPLE_ROOT="$REPO_ROOT/examples/golden-path"
EXAMPLES=(
  "web-vite-mini"
  "desktop-electron-mini"
  "cli-node-mini"
)

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

run_in_example() {
  local example="$1"
  shift
  (
    cd "$EXAMPLE_ROOT/$example"
    "$@"
  )
}

run_desktop_smoke() {
  if [ "$(uname -s)" = "Linux" ]; then
    run_in_example "desktop-electron-mini" sudo chown root:root node_modules/electron/dist/chrome-sandbox
    run_in_example "desktop-electron-mini" sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
  fi
  if command -v xvfb-run >/dev/null 2>&1; then
    run_in_example "desktop-electron-mini" xvfb-run -a npm run smoke
  else
    run_in_example "desktop-electron-mini" npm run smoke
  fi
}

ensure_ready() {
  command -v node >/dev/null 2>&1 || fail "node is required"
  command -v npm >/dev/null 2>&1 || fail "npm is required"
  [ -d "$EXAMPLE_ROOT" ] || fail "Missing examples root: $EXAMPLE_ROOT"
}

check_runtime_freshness() {
  local example="$1"
  local target_root="$EXAMPLE_ROOT/$example"

  printf '[STEP] [%s] target constitution --check\n' "$example"
  node "$REPO_ROOT/tools/init-target-constitution.mjs" "$target_root" --skills-root "$REPO_ROOT" --check --json

  printf '[STEP] [%s] target runtime --check\n' "$example"
  node "$REPO_ROOT/tools/init-target-runtime.mjs" "$target_root" --skills-root "$REPO_ROOT" --check --json

  printf '[STEP] [%s] strict document manifest check\n' "$example"
  node "$REPO_ROOT/tools/check-target-doc-drift.mjs" "$target_root" --full --strict --json
}

run_example() {
  local example="$1"
  [ -f "$EXAMPLE_ROOT/$example/package.json" ] || fail "Missing package.json for $example"

  [ -f "$EXAMPLE_ROOT/$example/package-lock.json" ] || fail "Missing package-lock.json for $example"
  check_runtime_freshness "$example"
  printf '[STEP] [%s] npm ci --ignore-scripts\n' "$example"
  run_in_example "$example" npm ci --ignore-scripts --no-audit --no-fund

  if [ "$example" = "desktop-electron-mini" ]; then
    printf '[STEP] [%s] npm run prepare:electron\n' "$example"
    run_in_example "$example" npm run prepare:electron
  fi

  printf '[STEP] [%s] npm run check:health\n' "$example"
  run_in_example "$example" npm run check:health

  printf '[STEP] [%s] npm run build\n' "$example"
  run_in_example "$example" npm run build

  printf '[STEP] [%s] npm run test --if-present\n' "$example"
  run_in_example "$example" npm run test --if-present

  printf '[STEP] [%s] npm run smoke --if-present\n' "$example"
  if [ "$example" = "desktop-electron-mini" ]; then
    run_desktop_smoke
  else
    run_in_example "$example" npm run smoke --if-present
  fi

  printf '[PASS] %s\n' "$example"
}

main() {
  ensure_ready
  for example in "${EXAMPLES[@]}"; do
    run_example "$example"
  done
  printf '[STEP] real source contract tests\n'
  node "$REPO_ROOT/tools/test-golden-path-real-code.mjs"
  printf 'All golden path examples passed.\n'
}

main "$@"
