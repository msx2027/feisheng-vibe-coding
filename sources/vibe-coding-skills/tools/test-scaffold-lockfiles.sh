#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SOURCE_ROOT=$(dirname "$SCRIPT_DIR")
TEMPLATE_ROOT="$SOURCE_ROOT/skills/dev-builder/templates/project-scaffolds"
RUNTIME_TEST="$SOURCE_ROOT/tools/test-runtime-project-scaffold.sh"
TMP_ROOT=$(mktemp -d)

cleanup() {
  rm -rf -- "$TMP_ROOT"
}
trap cleanup EXIT

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

run_renderer() {
  local previous="${MSYS2_ARG_CONV_EXCL-}"
  local was_set=0
  local status

  [ "${MSYS2_ARG_CONV_EXCL+x}" = "x" ] && was_set=1
  export MSYS2_ARG_CONV_EXCL='*'
  bash "$SOURCE_ROOT/tools/render-project-scaffold.sh" "$@"
  status=$?
  if [ "$was_set" -eq 1 ]; then
    export MSYS2_ARG_CONV_EXCL="$previous"
  else
    unset MSYS2_ARG_CONV_EXCL
  fi
  return "$status"
}

node - "$TEMPLATE_ROOT" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const root = process.argv[2];
const templates = [
  "next-feature-first",
  "vite-feature-first",
  "electron-next-feature-first",
  "cli-feature-first",
];
const packageToken = "__NPM_PACKAGE_NAME__";
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const requiredOverrides = new Map([
  ["next-feature-first", new Map([["nanoid", "3.3.18"], ["postcss", "8.5.23"], ["sharp", "0.35.0"]])],
  ["vite-feature-first", new Map([["nanoid", "3.3.18"], ["postcss", "8.5.23"]])],
  ["electron-next-feature-first", new Map([["nanoid", "3.3.18"], ["postcss", "8.5.23"], ["sharp", "0.35.0"]])],
]);
const requiredRootDependencies = new Map([
  ["electron-next-feature-first", new Map([["electron", "43.4.0"]])],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const template of templates) {
  const templateDir = path.join(root, template);
  const packagePath = path.join(templateDir, "package.json.template");
  const lockPath = path.join(templateDir, "package-lock.json.template");
  assert(fs.existsSync(lockPath), `${template}: package-lock.json.template is required`);

  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  const lockRoot = lock.packages?.[""];
  assert(pkg.name === packageToken, `${template}: package name must remain renderable`);
  assert(lock.name === packageToken, `${template}: lockfile top-level name must be renderable`);
  assert(lockRoot?.name === packageToken, `${template}: lockfile root package name must be renderable`);
  assert(lock.lockfileVersion === 3, `${template}: lockfileVersion must be 3`);
  assert(lock.version === pkg.version, `${template}: lockfile version must match package.json`);
  assert(lockRoot.version === pkg.version, `${template}: lockfile root version must match package.json`);
  assert(
    JSON.stringify(lockRoot.bin ?? {}) === JSON.stringify(pkg.bin ?? {}),
    `${template}: lockfile root bin map must match package.json`,
  );

  for (const group of ["dependencies", "devDependencies"]) {
    const packageDependencies = pkg[group] ?? {};
    const lockedDependencies = lockRoot[group] ?? {};
    assert(
      JSON.stringify(lockedDependencies) === JSON.stringify(packageDependencies),
      `${template}: lockfile root ${group} must match package.json`,
    );
    for (const [dependency, version] of Object.entries(packageDependencies)) {
      assert(exactVersion.test(version), `${template}: ${dependency} must use an exact version, got ${version}`);
      assert(
        lock.packages?.[`node_modules/${dependency}`]?.version === version,
        `${template}: ${dependency}@${version} must be the direct locked version`,
      );
    }
  }

  for (const [dependency, version] of Object.entries(pkg.overrides ?? {})) {
    assert(exactVersion.test(version), `${template}: override ${dependency} must use an exact version, got ${version}`);
    assert(
      lock.packages?.[`node_modules/${dependency}`]?.version === version,
      `${template}: override ${dependency}@${version} must be the locked version`,
    );
  }
  for (const [dependency, version] of requiredOverrides.get(template) ?? []) {
    assert(pkg.overrides?.[dependency] === version, `${template}: required override ${dependency}@${version} is missing`);
  }
  for (const [dependency, version] of requiredRootDependencies.get(template) ?? []) {
    assert(pkg.dependencies?.[dependency] === version, `${template}: required dependency ${dependency}@${version} is missing`);
  }
}
NODE

if grep -Eq 'npm[[:space:]]+install([[:space:]]|$)' "$RUNTIME_TEST"; then
  fail "runtime scaffold smoke must not use npm install"
fi
grep -Eq 'npm[[:space:]]+ci([[:space:]]|$)' "$RUNTIME_TEST" \
  || fail "runtime scaffold smoke must use npm ci"
grep -Fq -- '--ignore-scripts' "$RUNTIME_TEST" \
  || fail "runtime scaffold smoke must disable lifecycle scripts"

for template in next-feature-first vite-feature-first electron-next-feature-first cli-feature-first; do
  output="$TMP_ROOT/$template"
  project_name="lock-check-$template"
  run_renderer \
    --template "$template" \
    --project-name "$project_name" \
    --output "$output" >/dev/null

  node - "$output" "$project_name" "$template" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [root, expectedName, template] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
if (pkg.name !== expectedName || lock.name !== expectedName || lock.packages?.[""]?.name !== expectedName) {
  throw new Error(`rendered package names are inconsistent for ${expectedName}`);
}
if (JSON.stringify(lock).includes("__NPM_PACKAGE_NAME__")) {
  throw new Error(`rendered lockfile still contains the package-name placeholder for ${expectedName}`);
}
if (JSON.stringify(lock.packages[""].bin ?? {}) !== JSON.stringify(pkg.bin ?? {})) {
  throw new Error(`rendered bin map is inconsistent for ${expectedName}`);
}
if (JSON.stringify(lock.packages[""].dependencies ?? {}) !== JSON.stringify(pkg.dependencies ?? {})) {
  throw new Error(`rendered dependencies are inconsistent for ${expectedName}`);
}
if (JSON.stringify(lock.packages[""].devDependencies ?? {}) !== JSON.stringify(pkg.devDependencies ?? {})) {
  throw new Error(`rendered devDependencies are inconsistent for ${expectedName}`);
}
for (const [dependency, version] of Object.entries(pkg.overrides ?? {})) {
  if (lock.packages?.[`node_modules/${dependency}`]?.version !== version) {
    throw new Error(`rendered override ${dependency}@${version} is not locked for ${expectedName}`);
  }
}
if (["next-feature-first", "vite-feature-first", "electron-next-feature-first"].includes(template) && pkg.overrides?.postcss !== "8.5.23") {
  throw new Error(`rendered PostCSS security override is missing for ${expectedName}`);
}
NODE

  if [ "${VERIFY_PACKAGE_LOCK_ONLY:-0}" = "1" ]; then
    before_hash=$(node -e '
      const fs = require("node:fs");
      const crypto = require("node:crypto");
      process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"));
    ' "$output/package-lock.json")
    (
      cd "$output"
      npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null
    )
    after_hash=$(node -e '
      const fs = require("node:fs");
      const crypto = require("node:crypto");
      process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"));
    ' "$output/package-lock.json")
    [ "$before_hash" = "$after_hash" ] \
      || fail "$template package-lock changed after package-lock-only refresh"
    printf '[PASS] %s package-lock-only is stable\n' "$template"
  fi

  if [ "${VERIFY_NPM_AUDIT:-0}" = "1" ]; then
    audit_json="$TMP_ROOT/$template-npm-audit.json"
    audit_status=0
    (
      cd "$output"
      npm audit --package-lock-only --ignore-scripts --json >"$audit_json"
    ) || audit_status=$?

    node - "$audit_json" "$template" <<'NODE'
const fs = require("node:fs");

const [reportPath, template] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
if (report.error) {
  throw new Error(`${template}: npm audit error: ${report.error.summary ?? report.error.code ?? "unknown"}`);
}
const total = report.metadata?.vulnerabilities?.total;
if (!Number.isInteger(total)) throw new Error(`${template}: npm audit did not return a vulnerability total`);
if (total !== 0) {
  const issues = Object.entries(report.vulnerabilities ?? {})
    .map(([name, vulnerability]) => `${name}:${vulnerability.severity ?? "unknown"}`)
    .join(", ");
  throw new Error(`${template}: npm audit total=${total}${issues ? ` (${issues})` : ""}`);
}
NODE
    [ "$audit_status" -eq 0 ] || fail "$template npm audit exited with status $audit_status"
    printf '[PASS] %s npm audit total=0\n' "$template"
  fi
done

printf 'Scaffold lockfile tests passed.\n'
