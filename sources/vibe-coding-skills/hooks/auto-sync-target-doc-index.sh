#!/bin/bash
# vibe-coding-skills:managed-target-doc-auto-sync-hook
# Claude PostToolUse：受管文档写入后自动刷新 metadata 与文档索引。

set -u
INPUT=$(cat)
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TOOL=""
if [ -n "${VIBE_CODING_SKILLS_HOME:-}" ]; then
  ROOT_CANDIDATES=("$VIBE_CODING_SKILLS_HOME")
else
  ROOT_CANDIDATES=("$SCRIPT_DIR/.." "$SCRIPT_DIR/../..")
fi
for ROOT_CANDIDATE in "${ROOT_CANDIDATES[@]}"; do
  RESOLVED_ROOT=$(cd "$ROOT_CANDIDATE" 2>/dev/null && pwd -P) || continue
  if [ -f "$RESOLVED_ROOT/tools/auto-sync-target-doc-index.mjs" ]; then
    TOOL="$RESOLVED_ROOT/tools/auto-sync-target-doc-index.mjs"
    break
  fi
done
if [ ! -f "$TOOL" ]; then
  echo "[target-doc-auto-sync] blocked: runtime root is unavailable; set VIBE_CODING_SKILLS_HOME for installed target hooks" >&2
  exit 2
fi

printf '%s' "$INPUT" | node "$TOOL" --hook-input --json >/dev/null
exit $?
