#!/bin/bash
# Shared minimal quality gate for project code.
# Hard blocks only objective, low-false-positive issues.

set -u

ROOT="${1:-}"

if [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
  exit 0
fi

TSCONFIG=$(find "$ROOT" -maxdepth 3 -name "tsconfig.json" -not -path "*/node_modules/*" -not -path "*/.next/*" 2>/dev/null | head -1)

if [ -z "$TSCONFIG" ]; then
  exit 0
fi

PROJECT_CODE=$(dirname "$TSCONFIG")
cd "$PROJECT_CODE" || exit 0

EXIT_CODE=0
declare -a REPORT_LINES=()
declare -a CODE_FILES=()

append_section() {
  local title="$1"
  shift

  REPORT_LINES+=("$title")
  for item in "$@"; do
    REPORT_LINES+=("  - $item")
  done
}

while IFS= read -r -d '' file; do
  CODE_FILES+=("$file")
done < <(
  find . -type f \
    \( -name "*.ts" -o -name "*.tsx" -o -name "*.mts" -o -name "*.cts" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.cjs" \) \
    -not -path "./node_modules/*" \
    -not -path "./dist/*" \
    -not -path "./build/*" \
    -not -path "./coverage/*" \
    -not -path "./.next/*" \
    -not -path "./.git/*" \
    -not -path "./.claude/*" \
    -not -path "./.agents/*" \
    -not -path "./.codex/*" \
    -print0
)

TSC_BIN=""
if [ -x "./node_modules/.bin/tsc" ]; then
  TSC_BIN="./node_modules/.bin/tsc"
elif [ -f "./node_modules/.bin/tsc.cmd" ]; then
  TSC_BIN="./node_modules/.bin/tsc.cmd"
fi

if [ -z "$TSC_BIN" ]; then
  EXIT_CODE=2
  append_section \
    "缺少项目本地 TypeScript 编译器" \
    "拒绝调用 npx 自动下载远端包；请先按 lockfile 安装依赖，确保 node_modules/.bin/tsc 存在。"
else
  TSC_OUTPUT=$("$TSC_BIN" --noEmit 2>&1)
  TSC_EXIT=$?
  if [ $TSC_EXIT -ne 0 ]; then
    EXIT_CODE=2
    append_section "TypeScript 编译未通过" "$TSC_OUTPUT"
  fi
fi

if [ ${#CODE_FILES[@]} -gt 0 ]; then
  declare -a OVERSIZED_FILES=()
  declare -a ANY_MATCHES=()
  declare -a TS_IGNORE_MATCHES=()

  for file in "${CODE_FILES[@]}"; do
    line_count=$(wc -l < "$file")
    line_count=$(echo "$line_count" | tr -d '[:space:]')
    if [ "$line_count" -gt 300 ]; then
      OVERSIZED_FILES+=("${file#./}: ${line_count} 行")
    fi
  done

  while IFS= read -r line; do
    if [ -n "$line" ]; then
      ANY_MATCHES+=("${line#./}")
    fi
  done < <(
    grep -nHE ':\s*any(\[\])?\b|<\s*any\s*>|\bas\s+any\b|Array<any>|Promise<any>|Record<[^>]+,\s*any>' "${CODE_FILES[@]}" 2>/dev/null || true
  )

  while IFS= read -r line; do
    if [ -n "$line" ]; then
      TS_IGNORE_MATCHES+=("${line#./}")
    fi
  done < <(
    grep -nHE '@ts-ignore|@ts-nocheck' "${CODE_FILES[@]}" 2>/dev/null || true
  )

  if [ ${#OVERSIZED_FILES[@]} -gt 0 ]; then
    EXIT_CODE=2
    append_section "检测到超过 300 行的代码文件" "${OVERSIZED_FILES[@]}"
  fi

  if [ ${#ANY_MATCHES[@]} -gt 0 ]; then
    EXIT_CODE=2
    append_section "检测到显式 any，请改成具体类型或 unknown + 类型守卫" "${ANY_MATCHES[@]}"
  fi

  if [ ${#TS_IGNORE_MATCHES[@]} -gt 0 ]; then
    EXIT_CODE=2
    append_section "检测到 TypeScript 跳过指令，请修复类型问题而不是忽略" "${TS_IGNORE_MATCHES[@]}"
  fi
fi

if [ $EXIT_CODE -ne 0 ]; then
  echo "最小自动门禁未通过，commit 被阻止：" >&2
  for line in "${REPORT_LINES[@]}"; do
    echo "$line" >&2
  done
fi

exit $EXIT_CODE
