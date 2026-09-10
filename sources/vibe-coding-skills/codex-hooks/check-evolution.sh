#!/bin/bash
# Codex SessionStart hook
# 检查共享 feedback 索引，提示是否需要运行 evolution-engine

ROOT="$PWD"
while [ "$ROOT" != "/" ] && [ ! -d "$ROOT/.claude" ] && [ ! -f "$ROOT/AGENTS.md" ]; do
  ROOT=$(dirname "$ROOT")
done

FEEDBACK_INDEX="$ROOT/.claude/feedback/FEEDBACK-INDEX.md"

if [ ! -f "$FEEDBACK_INDEX" ]; then
  exit 0
fi

COUNT=$(grep -c "^- \[" "$FEEDBACK_INDEX" 2>/dev/null || true)
COUNT=${COUNT:-0}
COUNT=$(echo "$COUNT" | tr -d '[:space:]')

if [ "$COUNT" -gt 0 ] 2>/dev/null; then
  echo "项目有 ${COUNT} 条 feedback 记录。需要时运行 evolution-engine 检查是否该升级规则。"
fi

exit 0
