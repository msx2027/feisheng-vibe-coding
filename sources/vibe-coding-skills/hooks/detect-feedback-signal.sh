#!/bin/bash
# vibe-coding-skills:managed-target-experience-signal-hook
# Claude UserPromptSubmit 薄包装：关键词和事件 schema 只由统一 Node 入口维护。

set -u

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SIGNAL_TOOL=""
if [ -n "${VIBE_CODING_SKILLS_HOME:-}" ]; then
  ROOT_CANDIDATES=("$VIBE_CODING_SKILLS_HOME")
else
  ROOT_CANDIDATES=("$SCRIPT_DIR/.." "$SCRIPT_DIR/../..")
fi
for ROOT_CANDIDATE in "${ROOT_CANDIDATES[@]}"; do
  RESOLVED_ROOT=$(cd "$ROOT_CANDIDATE" 2>/dev/null && pwd -P) || continue
  if [ -f "$RESOLVED_ROOT/tools/detect-experience-signal.mjs" ]; then
    SIGNAL_TOOL="$RESOLVED_ROOT/tools/detect-experience-signal.mjs"
    break
  fi
done

if [ -z "$SIGNAL_TOOL" ]; then
  echo "experience signal tool missing from source/mirror repository root" >&2
  exit 2
fi

exec node "$SIGNAL_TOOL" --runtime claude
