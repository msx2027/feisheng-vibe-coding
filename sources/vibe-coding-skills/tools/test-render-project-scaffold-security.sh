#!/bin/bash

set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SOURCE_ROOT=$(dirname "$SCRIPT_DIR")
RENDERER="$SOURCE_ROOT/tools/render-project-scaffold.sh"
TMP_ROOT=$(mktemp -d)
FAILURES=0

cleanup() {
  if [ "${KEEP_TMP:-0}" = "1" ]; then
    printf '[INFO] Preserved scaffold security fixtures: %s\n' "$TMP_ROOT"
  else
    rm -rf -- "$TMP_ROOT"
  fi
}
trap cleanup EXIT

fail_case() {
  printf '[FAIL] %s\n' "$1" >&2
  FAILURES=$((FAILURES + 1))
}

pass_case() {
  printf '[PASS] %s\n' "$1"
}

run_renderer() {
  local previous="${MSYS2_ARG_CONV_EXCL-}"
  local was_set=0
  local status
  [ "${MSYS2_ARG_CONV_EXCL+x}" = "x" ] && was_set=1
  export MSYS2_ARG_CONV_EXCL='*'
  bash "$RENDERER" "$@"
  status=$?
  if [ "$was_set" -eq 1 ]; then
    export MSYS2_ARG_CONV_EXCL="$previous"
  else
    unset MSYS2_ARG_CONV_EXCL
  fi
  return "$status"
}

expect_rejected() {
  local label="$1"
  shift
  if run_renderer "$@" >"$TMP_ROOT/$label.stdout" 2>"$TMP_ROOT/$label.stderr"; then
    fail_case "$label should be rejected"
  else
    pass_case "$label rejected"
  fi
}

expect_rejected \
  "non-allowlisted-template" \
  --template ../project-scaffolds/cli-feature-first \
  --project-name demo \
  --output "$TMP_ROOT/non-allowlisted-output"

if [ -e "$TMP_ROOT/non-allowlisted-output" ]; then
  fail_case "rejected template must not create partial output"
else
  pass_case "rejected template creates no output"
fi

CONTROL_TITLE=$(printf 'safe\n<script>bad</script>')
expect_rejected \
  "control-character-title" \
  --template cli-feature-first \
  --project-name demo \
  --title "$CONTROL_TITLE" \
  --output "$TMP_ROOT/control-output"

CLI_PROJECT='safe", mode: (process.exit(24), "pwn"), tail: "'
CLI_TITLE='Safe ${process.exit(23)} ` title'
CLI_OUTPUT="$TMP_ROOT/cli-safe"
if ! run_renderer \
  --template cli-feature-first \
  --project-name "$CLI_PROJECT" \
  --title "$CLI_TITLE" \
  --output "$CLI_OUTPUT" >"$TMP_ROOT/cli.stdout" 2>"$TMP_ROOT/cli.stderr"; then
  fail_case "CLI malicious-data scaffold should render safely"
else
  if node "$CLI_OUTPUT/src/index.mjs" --health >"$TMP_ROOT/cli-health.stdout" 2>"$TMP_ROOT/cli-health.stderr"; then
    if node - "$TMP_ROOT/cli-health.stdout" "$CLI_PROJECT" <<'NODE'
const fs = require("node:fs");
const [file, expected] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(file, "utf8"));
if (payload.app !== expected || payload.ok !== true) process.exit(1);
NODE
    then
      pass_case "project name remains inert JS string data"
    else
      fail_case "project name changed meaning after JS rendering"
    fi
  else
    fail_case "project name executed or broke generated CLI health command"
  fi

  if node "$CLI_OUTPUT/src/index.mjs" >"$TMP_ROOT/cli-help.stdout" 2>"$TMP_ROOT/cli-help.stderr"; then
    if grep -Fq 'Safe ${process.exit(23)} ` title' "$TMP_ROOT/cli-help.stdout"; then
      pass_case "title remains inert template-literal data"
    else
      fail_case "template-literal title was not preserved"
    fi
  else
    fail_case "title executed or broke generated CLI help command"
  fi
fi

WEB_TITLE='prefix</title><script>window.pwned=1</script>{process.exit(22)}'
VITE_OUTPUT="$TMP_ROOT/vite-safe"
if ! run_renderer \
  --template vite-feature-first \
  --project-name demo \
  --title "$WEB_TITLE" \
  --output "$VITE_OUTPUT" >"$TMP_ROOT/vite.stdout" 2>"$TMP_ROOT/vite.stderr"; then
  fail_case "Vite malicious-data scaffold should render safely"
else
  if grep -Fq 'prefix</title><script>window.pwned=1</script>' "$VITE_OUTPUT/index.html"; then
    fail_case "HTML title injection remained executable markup"
  elif grep -Fq 'prefix&lt;/title&gt;&lt;script&gt;window.pwned=1&lt;/script&gt;&#123;process.exit(22)&#125;' "$VITE_OUTPUT/index.html"; then
    pass_case "HTML title is context-encoded"
  else
    fail_case "HTML title encoding is incomplete"
  fi

  TSX_FILE="$VITE_OUTPUT/src/features/home/components/home-screen.tsx"
  if grep -Fq '<script>window.pwned=1</script>' "$TSX_FILE"; then
    fail_case "JSX text injection remained executable markup"
  elif grep -Fq 'prefix&lt;/title&gt;&lt;script&gt;window.pwned=1&lt;/script&gt;&#123;process.exit(22)&#125;' "$TSX_FILE"; then
    pass_case "JSX title is context-encoded"
  else
    fail_case "JSX title encoding is incomplete"
  fi

  if [ -f "$VITE_OUTPUT/tools/trusted-git.mjs" ]; then
    pass_case "trusted executable helper ships with target scanners"
  else
    fail_case "trusted executable helper missing from rendered target"
  fi
  if [ -f "$VITE_OUTPUT/tools/safe-target-fs.mjs" ]; then
    pass_case "safe target filesystem helper ships with target writers"
  else
    fail_case "safe target filesystem helper missing from rendered target"
  fi
fi

NEXT_OUTPUT="$TMP_ROOT/next-safe"
if ! run_renderer \
  --template next-feature-first \
  --project-name "$CLI_PROJECT" \
  --title "$CLI_TITLE" \
  --output "$NEXT_OUTPUT" >"$TMP_ROOT/next.stdout" 2>"$TMP_ROOT/next.stderr"; then
  fail_case "Next malicious-data scaffold should render safely"
elif node - "$NEXT_OUTPUT/src/core/config/app-config.ts" "$CLI_PROJECT" "$CLI_TITLE" <<'NODE'
const fs = require("node:fs");
const [file, expectedProject, expectedTitle] = process.argv.slice(2);
let source = fs.readFileSync(file, "utf8");
source = source.replace(/^export const appConfig\s*=\s*/u, "return ").replace(/\s+as const;\s*$/u, ";");
const value = Function(source)();
if (value.projectName !== expectedProject || value.title !== expectedTitle) process.exit(1);
NODE
then
  pass_case "TypeScript string fields are context-encoded"
else
  fail_case "TypeScript string fields executed or changed meaning"
fi

ELECTRON_OUTPUT="$TMP_ROOT/electron-safe"
if run_renderer \
  --template electron-next-feature-first \
  --project-name safe-project \
  --title 'Safe Desktop Title' \
  --output "$ELECTRON_OUTPUT" >"$TMP_ROOT/electron.stdout" 2>"$TMP_ROOT/electron.stderr" \
  && [ -s "$ELECTRON_OUTPUT/package.json" ] \
  && grep -Fq 'safe-project' "$ELECTRON_OUTPUT/package.json"; then
  pass_case "all allowlisted scaffold families still render"
else
  fail_case "Electron allowlisted scaffold regressed"
fi

if [ "$FAILURES" -ne 0 ]; then
  printf '\nScaffold security tests failed: %s\n' "$FAILURES" >&2
  exit 1
fi

printf '\nScaffold security tests passed\n'
