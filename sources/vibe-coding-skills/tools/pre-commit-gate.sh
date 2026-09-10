#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: tools/minimal-quality-gate.sh, tools/review-gate.sh, tools/structural-gate.sh, tools/terminology-gate.sh, tools/doc-sync-gate.sh
# Syncs with: hooks/pre-commit-check.sh, codex-hooks/pre-commit-check.sh, .githooks/pre-commit
# Shared pre-commit gate entrypoint.

set -u

ROOT="${1:-}"

if [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
  exit 0
fi

GATE_BASH="${VIBE_GATE_BASH:-${DDZJ_GATE_SHELL:-bash}}"

if ! "$GATE_BASH" -lc "exit 0" >/dev/null 2>&1; then
  echo "[pre-commit-gate] blocked: configured bash is not usable: $GATE_BASH" >&2
  exit 2
fi

"$GATE_BASH" "$ROOT/tools/review-gate.sh" "$ROOT"
REVIEW_EXIT=$?
if [ $REVIEW_EXIT -ne 0 ]; then
  exit $REVIEW_EXIT
fi

"$GATE_BASH" "$ROOT/tools/minimal-quality-gate.sh" "$ROOT"
QUALITY_EXIT=$?
if [ $QUALITY_EXIT -ne 0 ]; then
  exit $QUALITY_EXIT
fi

STRUCTURAL_GATE="$ROOT/tools/structural-gate.sh"
if [ ! -f "$STRUCTURAL_GATE" ]; then
  echo "[pre-commit-gate] blocked: missing tools/structural-gate.sh." >&2
  exit 2
fi

"$GATE_BASH" "$STRUCTURAL_GATE" "$ROOT"
STRUCTURAL_EXIT=$?
if [ $STRUCTURAL_EXIT -ne 0 ]; then
  exit $STRUCTURAL_EXIT
fi

TERMINOLOGY_GATE="$ROOT/tools/terminology-gate.sh"
if [ ! -f "$TERMINOLOGY_GATE" ]; then
  echo "[pre-commit-gate] blocked: missing tools/terminology-gate.sh." >&2
  exit 2
fi

"$GATE_BASH" "$TERMINOLOGY_GATE" "$ROOT"
TERMINOLOGY_EXIT=$?
if [ $TERMINOLOGY_EXIT -ne 0 ]; then
  exit $TERMINOLOGY_EXIT
fi

"$GATE_BASH" "$ROOT/tools/doc-sync-gate.sh" "$ROOT"
exit $?
