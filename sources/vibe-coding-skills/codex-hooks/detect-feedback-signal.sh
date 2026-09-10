#!/bin/bash
# Codex 兼容薄包装：统一委托给零第三方依赖 Node 信号入口。

set -u

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SIGNAL_TOOL=""
for ROOT_CANDIDATE in "$SCRIPT_DIR/.." "$SCRIPT_DIR/../.."; do
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

exec node "$SIGNAL_TOOL" --runtime codex
