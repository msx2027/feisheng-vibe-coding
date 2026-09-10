#!/bin/bash
# Hook: PreToolUse (Bash)
# Detect git commit variants, then execute the shared pre-commit gate.

INPUT=$(cat)

if ! command -v node >/dev/null 2>&1; then
  echo "node was not found; cannot safely inspect the Bash command for git commit." >&2
  exit 2
fi

if ! printf '%s' "$INPUT" | node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  let command = "";
  try {
    command = String(JSON.parse(input)?.tool_input?.command || "");
  } catch {}
  const gitCommit = /(?:^|[;&|()]+\s*)(?:[A-Za-z_]\w*=\S+\s+)*(?:command\s+)?git\b[^;&|()]*\bcommit(?:\s|$)/m;
  process.exit(gitCommit.test(command) ? 0 : 1);
});
'; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-}"

if [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
  exit 0
fi

bash "$ROOT/tools/pre-commit-gate.sh" "$ROOT"
exit $?
