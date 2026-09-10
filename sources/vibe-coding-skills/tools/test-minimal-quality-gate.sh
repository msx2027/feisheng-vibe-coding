#!/usr/bin/env bash

set -u

SOURCE_ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP_ROOT=$(mktemp -d)

cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

missing_root="$TMP_ROOT/missing-local-tsc"
mkdir -p "$missing_root/fake-bin"
printf '{"compilerOptions":{}}\n' > "$missing_root/tsconfig.json"
cat > "$missing_root/fake-bin/npx" <<'EOF'
#!/usr/bin/env bash
touch "${NPX_MARKER:?}"
exit 0
EOF
chmod +x "$missing_root/fake-bin/npx"

NPX_MARKER="$missing_root/npx-called" PATH="$missing_root/fake-bin:$PATH" \
  bash "$SOURCE_ROOT/tools/minimal-quality-gate.sh" "$missing_root" >/dev/null 2>&1
missing_status=$?

if [ "$missing_status" -eq 0 ]; then
  fail "gate must fail closed when the project-local TypeScript compiler is missing"
fi
if [ -e "$missing_root/npx-called" ]; then
  fail "gate must not invoke npx and implicitly download a compiler"
fi

local_root="$TMP_ROOT/local-tsc"
mkdir -p "$local_root/node_modules/.bin"
printf '{"compilerOptions":{}}\n' > "$local_root/tsconfig.json"
cat > "$local_root/node_modules/.bin/tsc" <<'EOF'
#!/usr/bin/env bash
touch "${LOCAL_TSC_MARKER:?}"
exit 0
EOF
chmod +x "$local_root/node_modules/.bin/tsc"

LOCAL_TSC_MARKER="$local_root/local-tsc-called" \
  bash "$SOURCE_ROOT/tools/minimal-quality-gate.sh" "$local_root" >/dev/null 2>&1
local_status=$?

if [ "$local_status" -ne 0 ]; then
  fail "gate should use a present project-local TypeScript compiler"
fi
if [ ! -e "$local_root/local-tsc-called" ]; then
  fail "project-local TypeScript compiler was not executed"
fi

echo "minimal quality gate tests passed"
