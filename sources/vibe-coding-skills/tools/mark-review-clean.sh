#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: tools/doc-sync-helpers.sh, .claude/.needs-review, .claude/.review-snapshot
# Syncs with: tools/review-gate.sh, README.md, AGENTS.md
# Writes review clean state plus the current staged source-change snapshot.

set -euo pipefail

ROOT="${1:-$PWD}"
ROOT="${ROOT//\\//}"

while [ "$ROOT" != "/" ] && [ ! -d "$ROOT/.claude" ] && [ ! -f "$ROOT/AGENTS.md" ]; do
  ROOT=$(dirname "$ROOT")
done

if [ "$ROOT" = "/" ] || [ ! -d "$ROOT" ]; then
  echo "未找到仓库根目录，未写入 review 状态。" >&2
  exit 1
fi

HELPERS="$ROOT/tools/doc-sync-helpers.sh"
if [ ! -f "$HELPERS" ]; then
  echo "缺少 tools/doc-sync-helpers.sh，未写入 review 状态。" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$HELPERS"

STATE_FILE="$ROOT/.claude/.needs-review"
SNAPSHOT_FILE="$ROOT/.claude/.review-snapshot"
SNAPSHOT_HASH=""

mkdir -p "$ROOT/.claude"

if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  SNAPSHOT_HASH=$(doc_sync_review_snapshot_hash "$ROOT" 2>/dev/null || printf '\n')
fi

printf 'clean\n' > "$STATE_FILE"

if [ -n "$SNAPSHOT_HASH" ]; then
  printf '%s\n' "$SNAPSHOT_HASH" > "$SNAPSHOT_FILE"
  echo "review 状态已写为 clean，并记录当前 staged source-change 快照。"
  exit 0
fi

rm -f "$SNAPSHOT_FILE"
echo "review 状态已写为 clean；当前没有可记录的 staged source-change 快照。"
exit 0
