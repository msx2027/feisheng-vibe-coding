#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: tools/structural-lint.mjs, tools/check-ui-reuse.mjs, Product-Spec.md, DEV-PLAN.md
# Syncs with: tools/pre-commit-gate.sh, tools/test-structural-gate.sh, tools/INDEX.md
# Shared structural gate entrypoint.

set -u

ROOT="${1:-}"

if [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[structural-gate] blocked: missing node command." >&2
  exit 2
fi

SCRIPT_PATH="$ROOT/tools/structural-lint.mjs"
if [ ! -f "$SCRIPT_PATH" ]; then
  echo "[structural-gate] blocked: missing tools/structural-lint.mjs." >&2
  exit 2
fi

node "$SCRIPT_PATH" "$ROOT"
exit $?
