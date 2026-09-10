#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const checkerPath = path.join(scriptDir, "check-routing-manifest.mjs");

function mkdirp(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeFile(filePath, content) {
  mkdirp(filePath);
  fs.writeFileSync(filePath, content, "utf8");
}

function makeRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `routing-manifest-${name}-`));
}

function writeIndex(root, rows) {
  writeFile(
    path.join(root, "skills", "INDEX.md"),
    [
      "# Skills Index",
      "",
      "| 内部 Skill | 中文场景 | 默认触发方式 | 主要输出 |",
      "| --- | --- | --- | --- |",
      ...rows.map((row) => `| \`${row.id}\` | ${row.scenario} | ${row.trigger} | ${row.output} |`),
      "",
    ].join("\n"),
  );
}

function writeSkill(root, id, description, body = "", invocation = "router-only") {
  const invocationFrontmatter = invocation === "user-only"
      ? ["user-invocable: true", "disable-model-invocation: true"]
      : invocation === "event-only"
      ? ["user-invocable: false", "disable-model-invocation: true"]
      : ["user-invocable: false", "disable-model-invocation: true"];
  writeFile(
    path.join(root, "skills", id, "SKILL.md"),
    [
      "---",
      `name: ${id}`,
      `description: ${description}`,
      ...invocationFrontmatter,
      "---",
      "",
      body,
      "",
    ].join("\n"),
  );
}

function runChecker(root, ...args) {
  return spawnSync(process.execPath, [checkerPath, root, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function parseJson(stdout) {
  return JSON.parse(stdout);
}

function assertIssueIncludes(payload, pattern) {
  assert(
    payload.issues.some((issue) => issue.includes(pattern)),
    `Expected issue containing ${JSON.stringify(pattern)}, got:\n${payload.issues.join("\n")}`,
  );
}

function caseWriteCreatesV3TriggersAndManualOnly() {
  const root = makeRoot("write-v3");
  writeIndex(root, [
    {
      id: "shape",
      scenario: "UX / UI 规划 / shape",
      trigger: "用户显式点名 shape 或“用 shape 规划”时进入",
      output: "设计简报",
    },
    {
      id: "audit",
      scenario: "可访问性 / 性能 / 技术 UI 审计",
      trigger: "用户要求 accessibility、performance、responsive 或 anti-pattern 审计时进入",
      output: "审计报告",
    },
    {
      id: "vibe-coding-skills",
      scenario: "总入口",
    trigger: "用户在当前对话调用总入口后可指定 Skill ID 或使用自然语言",
      output: "路由结果",
    },
  ]);
  writeSkill(
    root,
    "shape",
    "Plan the UX and UI for a feature before writing code. Use during the planning phase to establish design direction.",
  );
  writeSkill(
    root,
    "audit",
    "Run technical quality checks. Use when the user wants an accessibility check, performance audit, or technical quality review.",
  );
  writeSkill(
    root,
    "vibe-coding-skills",
    "唯一用户可见的 Skill 总入口。",
    "",
    "user-only",
  );

  const result = runChecker(root, "--write", "--json");
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "skills", "ROUTING-MANIFEST.json"), "utf8"));
  assert.equal(manifest.version, 3);
  const shape = manifest.skills.find((skill) => skill.id === "shape");
  const audit = manifest.skills.find((skill) => skill.id === "audit");
  assert(shape, "shape should be present");
  assert(audit, "audit should be present");
  assert.equal(shape.manualOnly, true);
  assert.equal(shape.invocation, "router-only");
  assert.equal(shape.activation, "conversation-gated");
  assert.equal(shape.userInvocable, false);
  assert.equal(shape.disableModelInvocation, true);
  assert(Array.isArray(shape.routeHints), "shape.routeHints should be an array");
  assert(shape.routeHints.some((hint) => hint.includes("shape")));
  assert(shape.routeHints.some((hint) => hint.includes("UX") || hint.includes("UI")));
  assert.equal(shape.routeHint, shape.routeHints[0]);
  assert.equal(audit.invocation, "router-only");
  assert.equal(audit.activation, "conversation-gated");
  assert.equal(audit.manualOnly, true);
  assert(audit.routeHints.some((hint) => hint.includes("accessibility")));
  assert(audit.routeHints.some((hint) => hint.includes("performance")));
}

function caseRejectsCurrentManifestWithoutTriggers() {
  const root = makeRoot("missing-triggers");
  writeIndex(root, [
    { id: "demo", scenario: "演示场景", trigger: "用户说 demo 时进入", output: "演示输出" },
  ]);
  writeSkill(root, "demo", "当用户说 demo 时使用。");
  writeFile(
    path.join(root, "skills", "ROUTING-MANIFEST.json"),
    `${JSON.stringify({
      version: 3,
      sourceHash: "stale",
      skills: [{ id: "demo", trigger: "演示场景", risk: [], refs: 0, tokens: 10 }],
    })}\n`,
  );

  const result = runChecker(root, "--json");
  assert.notEqual(result.status, 0, "manifest without triggers should fail");
  const payload = parseJson(result.stdout);
  assertIssueIncludes(payload, "demo routeHints must be a non-empty array");
}

function caseRejectsCorruptCurrentManifest() {
  const root = makeRoot("corrupt");
  writeIndex(root, [
    { id: "demo", scenario: "演示场景", trigger: "用户说 demo 时进入", output: "演示输出" },
  ]);
  writeSkill(root, "demo", "当用户说 demo 时使用。");
  writeFile(path.join(root, "skills", "ROUTING-MANIFEST.json"), "{ not json");

  const result = runChecker(root, "--json");
  assert.notEqual(result.status, 0, "corrupt manifest should fail");
  const payload = parseJson(result.stdout);
  assertIssueIncludes(payload, "Failed to parse");
}

function caseRejectsMissingReference() {
  const root = makeRoot("missing-reference");
  writeIndex(root, [
    { id: "demo", scenario: "演示场景", trigger: "用户说 demo 时进入", output: "演示输出" },
  ]);
  writeSkill(root, "demo", "当用户说 demo 时使用。", "See `references/missing.md`.");

  const result = runChecker(root, "--write", "--json");
  assert.notEqual(result.status, 0, "missing reference should fail");
  const payload = parseJson(result.stdout);
  assertIssueIncludes(payload, "demo: missing reference path skills/demo/references/missing.md");
}

function caseMissingDescriptionFails() {
  const root = makeRoot("missing-description");
  writeIndex(root, [
    { id: "demo", scenario: "演示场景", trigger: "用户说 demo 时进入", output: "演示输出" },
  ]);
  writeFile(
    path.join(root, "skills", "demo", "SKILL.md"),
    ["---", "name: demo", "---", "", "Body", ""].join("\n"),
  );

  const result = runChecker(root, "--json");
  assert.equal(result.status, 2);
  assert(result.stderr.includes("Missing frontmatter field 'description'"), result.stderr);
}

function caseMissingInvocationFieldFails() {
  const root = makeRoot("missing-invocation-field");
  writeIndex(root, [{ id: "demo", scenario: "演示场景", trigger: "用户说 demo 时进入", output: "演示输出" }]);
  writeFile(path.join(root, "skills", "demo", "SKILL.md"), [
    "---", "name: demo", "description: demo", "user-invocable: false", "---", "", "Body", "",
  ].join("\n"));
  const result = runChecker(root, "--json");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Missing or invalid frontmatter field 'disable-model-invocation'/u);
}

function caseDuplicateIndexFails() {
  const root = makeRoot("duplicate-index");
  writeFile(path.join(root, "skills", "INDEX.md"), [
    "# Skills", "", "| 内部 Skill | 中文场景 | 默认触发方式 | 主要输出 |", "| --- | --- | --- | --- |",
    "| `demo` | A | B | C |", "| `demo` | A2 | B2 | C2 |", "",
  ].join("\n"));
  writeSkill(root, "demo", "demo");
  const result = runChecker(root, "--json");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /duplicate Skill: demo/u);
}

function caseCanonicalizesCrLfInputsForIndexBlobPackages() {
  const root = makeRoot("canonical-line-endings");
  writeIndex(root, [
    { id: "demo", scenario: "演示场景", trigger: "用户说 demo 时进入", output: "演示输出" },
    { id: "vibe-coding-skills", scenario: "总入口", trigger: "用户显式调用总入口", output: "路由结果" },
  ]);
  writeSkill(root, "demo", "当用户说 demo 时使用。", "Canonical content.");
  writeSkill(root, "vibe-coding-skills", "唯一用户可见的 Skill 总入口。", "", "user-only");

  const indexPath = path.join(root, "skills", "INDEX.md");
  const skillPath = path.join(root, "skills", "demo", "SKILL.md");
  const indexLf = fs.readFileSync(indexPath, "utf8");
  const skillLf = fs.readFileSync(skillPath, "utf8");
  fs.writeFileSync(indexPath, indexLf.replace(/\n/g, "\r\n"), "utf8");
  fs.writeFileSync(skillPath, skillLf.replace(/\n/g, "\r\n"), "utf8");

  const writeResult = runChecker(root, "--write", "--json");
  assert.equal(writeResult.status, 0, writeResult.stderr || writeResult.stdout);

  fs.writeFileSync(indexPath, indexLf, "utf8");
  fs.writeFileSync(skillPath, skillLf, "utf8");
  const packageEquivalentCheck = runChecker(root, "--json");
  assert.equal(
    packageEquivalentCheck.status,
    0,
    "routing manifest generated from CRLF worktree inputs must remain valid for LF index-blob package inputs",
  );
}

caseWriteCreatesV3TriggersAndManualOnly();
caseRejectsCurrentManifestWithoutTriggers();
caseRejectsCorruptCurrentManifest();
caseRejectsMissingReference();
caseMissingDescriptionFails();
caseMissingInvocationFieldFails();
caseDuplicateIndexFails();
caseCanonicalizesCrLfInputsForIndexBlobPackages();

console.log("Routing manifest fixture tests passed");
