#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-skill-token-budget.mjs");

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function runBudget(root) {
  const result = spawnSync(process.execPath, [scriptPath, root, "--strict", "--json"], {
    encoding: "utf8",
  });

  return {
    status: result.status ?? 0,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Expected JSON output, got:\n${stdout}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-token-budget-"));

  writeFile(
    path.join(root, "skills", "adapter-only", "SKILL.md"),
    [
      "---",
      "name: adapter-only",
      "---",
      "references 只按 [按需加载 references] 或本文件 Reference Navigation 命中场景读取，不默认全量读取。",
    ].join("\n"),
  );

  writeFile(
    path.join(root, "skills", "missing-reference", "SKILL.md"),
    [
      "---",
      "name: missing-reference",
      "---",
      "[按需加载 references]",
      "| Reference | 读取时机 |",
      "| --- | --- |",
      "| `references/missing.md` | 用于测试缺失路径。 |",
    ].join("\n"),
  );

  writeFile(
    path.join(root, "skills", "no-references", "SKILL.md"),
    [
      "---",
      "name: no-references",
      "---",
      "无 references，保持按需加载策略。",
    ].join("\n"),
  );

  writeFile(
    path.join(root, "skills", "single-reference", "SKILL.md"),
    [
      "---",
      "name: single-reference",
      "---",
      "Reference Navigation",
      "- Read `reference/existing.md` when needed.",
    ].join("\n"),
  );
  writeFile(
    path.join(root, "skills", "single-reference", "reference", "existing.md"),
    "# Existing reference\n",
  );

  writeFile(
    path.join(root, "skills", "cross-skill", "SKILL.md"),
    [
      "---",
      "name: cross-skill",
      "---",
      "Use `skills/single-reference/reference/existing.md` for shared details.",
    ].join("\n"),
  );

  return root;
}

let fixtureRoot;

try {
  fixtureRoot = createFixture();
  const firstRun = runBudget(fixtureRoot);
  const firstPayload = parseJson(firstRun.stdout);

  assert(firstRun.status === 1, "Missing reference fixture should fail in strict mode");
  assert(
    firstPayload.warnings.some((warning) =>
      warning.includes("skills/missing-reference/SKILL.md: missing referenced file(s): references/missing.md"),
    ),
    "Missing concrete reference path should be reported",
  );
  assert(
    firstPayload.warnings.every((warning) => !warning.includes("adapter-only")),
    "Generic adapter references sentence should not warn",
  );
  assert(
    firstPayload.warnings.every((warning) => !warning.includes("no-references")),
    "\"No references\" policy text should not warn",
  );
  assert(
    firstPayload.warnings.every((warning) => !warning.includes("single-reference")),
    "Existing singular reference directory should pass",
  );
  assert(
    firstPayload.warnings.every((warning) => !warning.includes("cross-skill")),
    "Existing cross-skill reference path should pass",
  );

  writeFile(
    path.join(fixtureRoot, "skills", "missing-reference", "references", "missing.md"),
    "# Now present\n",
  );

  const secondRun = runBudget(fixtureRoot);
  const secondPayload = parseJson(secondRun.stdout);

  assert(secondRun.status === 0, `Expected strict mode to pass after fixing fixture, got ${secondRun.status}`);
  assert(secondPayload.warnings.length === 0, "Expected no warnings after fixture reference is present");

  console.log("Skill token budget fixture tests passed");
} finally {
  if (fixtureRoot) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}
