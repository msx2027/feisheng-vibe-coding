#!/bin/bash
# vibe-coding-skills:managed-routing-session-gate

set -u

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=""
ROOT_CANDIDATES=(
  "${VIBE_CODING_SKILLS_HOME:-}"
  "$SCRIPT_DIR/.."
  "$SCRIPT_DIR/../.."
)
for ROOT_CANDIDATE in "${ROOT_CANDIDATES[@]}"; do
  [ -n "$ROOT_CANDIDATE" ] || continue
  RESOLVED_ROOT=$(cd "$ROOT_CANDIDATE" 2>/dev/null && pwd -P) || continue
  if [ -f "$RESOLVED_ROOT/tools/routing-session-gate.mjs" ]; then
    ROOT="$RESOLVED_ROOT"
    break
  fi
done
if [ -z "$ROOT" ]; then
  echo "routing session gate tool missing from source/mirror repository root" >&2
  exit 2
fi
TOOL="$ROOT/tools/routing-session-gate.mjs"

exec node "$TOOL" --hook --runtime claude
