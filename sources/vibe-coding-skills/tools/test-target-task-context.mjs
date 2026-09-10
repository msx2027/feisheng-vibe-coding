#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptPath = path.join(repoRoot, "tools", "init-target-task-context.mjs");
const docNameChecker = path.join(repoRoot, "tools", "check-target-doc-names.mjs");
const indexBuilder = path.join(repoRoot, "tools", "build-target-doc-index.mjs");
const contextResolver = path.join(repoRoot, "tools", "resolve-target-doc-context.mjs");

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function run(root, ...extra) {
  return spawnSync(process.execPath, [scriptPath, root, "--json", ...extra], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function runDocNames(root) {
  return spawnSync(process.execPath, [docNameChecker, root, "--require-existing"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function runIndex(root, mode) {
  return spawnSync(process.execPath, [indexBuilder, root, mode], { cwd: repoRoot, encoding: "utf8" });
}

function runResolver(root, capsule) {
  return spawnSync(process.execPath, [contextResolver, root, "--capsule", capsule, "--json"], { cwd: repoRoot, encoding: "utf8" });
}

function parseJson(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Expected JSON output, got:\n${result.stdout}\n${result.stderr}`);
  }
}

function makeTarget(base, name) {
  const root = path.join(base, name);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function makeDocsTarget(base, name) {
  const root = makeTarget(base, name);
  const mapped = {
    productSpec: ["需求文档.md", "# 需求\n"],
    devPlan: ["开发计划.md", "# 计划\n"],
    currentExecution: ["plans/执行光标.md", "# 执行光标\n"],
    manualAcceptance: ["验收记录.md", "# 验收记录\n"],
    interfaceContracts: ["接口契约.md", "# 接口契约\n"],
    projectProfile: ["项目画像.md", "# 项目画像\n"],
    constitutionDesign: ["宪法设计.md", "# 宪法设计\n"],
    documentIndex: ["文档索引.md", "# 文档索引\n"],
  };
  for (const [, [file, content]] of Object.entries(mapped)) writeFile(path.join(root, file), content);
  writeFile(
    path.join(root, ".vibe-docs.json"),
    JSON.stringify(
      {
        schemaVersion: 2,
        ...Object.fromEntries(Object.entries(mapped).map(([role, [file]]) => [role, file])),
        documentIndex: "文档索引.md",
        documents: Object.entries(mapped).map(([role, [file, content]]) => ({
          role,
          path: file,
          owner: `test:${role}`,
          authority: ["currentExecution", "documentIndex"].includes(role) ? "projection" : "source",
          contentHash: `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`,
          estimatedTokens: Math.ceil(content.length / 4),
          dependsOn: [],
          sections: [],
        })),
        loadPolicy: { always: ["documentIndex"], never: [] },
      },
      null,
      2,
    ),
  );
  return root;
}

function readJson(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function readText(root, file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function revision(root, file) {
  return `sha256:${crypto.createHash("sha256").update(readText(root, file), "utf8").digest("hex")}`;
}

function listTaskDirs(root) {
  const taskRoot = path.join(root, "docs", "plans", "任务");
  return fs.readdirSync(taskRoot).filter((item) => fs.statSync(path.join(taskRoot, item)).isDirectory());
}

let tmpRoot = "";

try {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "target-task-context-"));

  const dryRunRoot = makeDocsTarget(tmpRoot, "dry-run");
  const dryRun = run(dryRunRoot, "--dry-run");
  const dryRunPayload = parseJson(dryRun);
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  assert(dryRunPayload.files.some((file) => file.file === ".vibe-docs.json" && file.action === "update"));
  assert(!readJson(dryRunRoot, ".vibe-docs.json").taskContext, "dry-run must not write manifest");

  const missingManifestRoot = makeTarget(tmpRoot, "missing-manifest");
  const missingManifestResult = run(missingManifestRoot, "--write", "--slug", "blocked", "--title", "Blocked");
  assert.equal(missingManifestResult.status, 2, "task context must not create an incomplete manifest");
  assert.equal(fs.existsSync(path.join(missingManifestRoot, ".vibe-docs.json")), false);

  const defaultRoot = makeDocsTarget(tmpRoot, "default-write");
  const defaultWrite = run(defaultRoot, "--write");
  const defaultPayload = parseJson(defaultWrite);
  assert.equal(defaultWrite.status, 0, defaultWrite.stderr || defaultWrite.stdout);
  assert.equal(defaultPayload.taskContext.enabled, false);
  assert.deepEqual(readJson(defaultRoot, ".vibe-docs.json").taskContext, {
    enabled: false,
    taskCapsulesRoot: "docs/plans/任务",
  });
  const docNames = runDocNames(defaultRoot);
  assert.equal(docNames.status, 0, docNames.stderr || docNames.stdout);

  const taskRoot = makeDocsTarget(tmpRoot, "task-write");
  const taskWrite = run(taskRoot, "--write", "--slug", "Add Login", "--title", "Add Login", "--record-session", "Started login task.");
  const taskPayload = parseJson(taskWrite);
  assert.equal(taskWrite.status, 0, taskWrite.stderr || taskWrite.stdout);
  assert.equal(
    taskPayload.files.at(-1)?.file,
    ".vibe-docs.json",
    "taskContext manifest must be committed after capsule and journal files",
  );
  const manifest = readJson(taskRoot, ".vibe-docs.json");
  assert.equal(manifest.taskContext.enabled, true);
  assert.equal(manifest.taskContext.sessionJournal, "docs/plans/会话记录.md");
  assert.match(manifest.taskContext.currentTaskCapsule, /^docs\/plans\/任务\/\d{4}-\d{2}-\d{2}-add-login$/);
  assert.equal(listTaskDirs(taskRoot).length, 1);
  const capsuleDir = manifest.taskContext.currentTaskCapsule;
  for (const file of ["任务状态.json", "需求摘录.md", "实现计划.md", "研究记录.md", "实现上下文.jsonl", "验收上下文.jsonl"]) {
    assert(fs.existsSync(path.join(taskRoot, ...capsuleDir.split("/"), file)), `${file} should exist`);
  }
  const status = readJson(taskRoot, path.join(capsuleDir, "任务状态.json"));
  assert.equal(status.schemaVersion, 2);
  assert.equal(status.checkpoint, "任务胶囊已创建");
  assert.equal(status.nextStep, "补充实现计划并开始实现");
  assert.match(status.revision, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(status.context.implementation, "实现上下文.jsonl");
  assert.equal(status.context.acceptance, "验收上下文.jsonl");
  assert(readText(taskRoot, "docs/plans/会话记录.md").includes("Started login task."));
  const taskIndexCheck = runIndex(taskRoot, "--check");
  assert.equal(taskIndexCheck.status, 0, taskIndexCheck.stderr || taskIndexCheck.stdout);
  const generatedContext = runResolver(taskRoot, capsuleDir);
  assert.equal(generatedContext.status, 0, generatedContext.stderr || generatedContext.stdout);
  const generatedImplementationPlan = readText(taskRoot, path.join(capsuleDir, "实现计划.md"));
  for (const expected of ["一致性分析回执", "sourceRevision", "分析证据", "阻断项", "不成为第二份计划真源"]) {
    assert(generatedImplementationPlan.includes(expected), `generated 实现计划.md must include ${expected}`);
  }
  assert.match(generatedImplementationPlan, /分析结论:\s*<待分析 \/ PASS \/ BLOCKED>/u);

  const taskCheck = run(taskRoot, "--check");
  assert.equal(taskCheck.status, 0, taskCheck.stderr || taskCheck.stdout);

  const referenced = "需求文档.md";
  writeFile(
    path.join(taskRoot, ...capsuleDir.split("/"), "实现上下文.jsonl"),
    `${JSON.stringify({ role: "productSpec", file: referenced, selector: { kind: "section", id: "REQ-001" }, reason: "需求来源", source: "spec", required: true, sourceRevision: revision(taskRoot, referenced), maxTokens: 1200 })}\n`,
  );
  const refreshedContextIndex = runIndex(taskRoot, "--write");
  assert.equal(refreshedContextIndex.status, 0, refreshedContextIndex.stderr || refreshedContextIndex.stdout);
  const contextCheck = run(taskRoot, "--check");
  assert.equal(contextCheck.status, 0, contextCheck.stderr || contextCheck.stdout);

  writeFile(path.join(taskRoot, referenced), "# 需求已变化\n");
  const staleRevisionCheck = run(taskRoot, "--check");
  assert.equal(staleRevisionCheck.status, 2, "stale sourceRevision must fail check");
  writeFile(path.join(taskRoot, referenced), "# 需求\n");

  writeFile(
    path.join(taskRoot, ...capsuleDir.split("/"), "实现上下文.jsonl"),
    `${JSON.stringify({ role: "productSpec", file: referenced, selector: { kind: "wholeFile" }, reason: "缺少 required 字段", source: "spec", sourceRevision: revision(taskRoot, referenced), maxTokens: 1200 })}\n`,
  );
  const missingRequiredFieldCheck = run(taskRoot, "--check");
  const missingRequiredFieldPayload = parseJson(missingRequiredFieldCheck);
  assert.equal(missingRequiredFieldCheck.status, 2, "missing required field should fail check");
  assert(missingRequiredFieldPayload.files.some((file) => file.status === "fail" && file.reason.includes("required must be present")));
  writeFile(
    path.join(taskRoot, ...capsuleDir.split("/"), "实现上下文.jsonl"),
    `${JSON.stringify({ role: "productSpec", file: referenced, selector: { kind: "wholeFile" }, reason: "需求来源", source: "spec", required: true, sourceRevision: revision(taskRoot, referenced), maxTokens: 1200 })}\n`,
  );

  writeFile(
    path.join(taskRoot, ...capsuleDir.split("/"), "实现上下文.jsonl"),
    `${JSON.stringify({ role: "productSpec", file: referenced, reason: "缺 selector", source: "spec", required: true, sourceRevision: revision(taskRoot, referenced), maxTokens: 1200 })}\n`,
  );
  const missingSelectorCheck = run(taskRoot, "--check");
  assert.equal(missingSelectorCheck.status, 2, "selector is required");

  writeFile(
    path.join(taskRoot, ...capsuleDir.split("/"), "验收上下文.jsonl"),
    `${JSON.stringify({ role: "manualAcceptance", file: "../outside.md", selector: { kind: "wholeFile" }, reason: "bad", source: "validation", required: false, sourceRevision: `sha256:${"b".repeat(64)}`, maxTokens: 500 })}\n`,
  );
  const badCheck = run(taskRoot, "--check");
  const badPayload = parseJson(badCheck);
  assert.equal(badCheck.status, 2, "path escape should fail check");
  assert(badPayload.files.some((file) => file.status === "fail" && file.reason.includes("escapes target root")));

  const missingRequiredRoot = makeDocsTarget(tmpRoot, "missing-required");
  const missingWrite = run(missingRequiredRoot, "--write", "--slug", "api", "--title", "API");
  assert.equal(missingWrite.status, 0, missingWrite.stderr || missingWrite.stdout);
  const missingManifest = readJson(missingRequiredRoot, ".vibe-docs.json");
  writeFile(
    path.join(missingRequiredRoot, ...missingManifest.taskContext.currentTaskCapsule.split("/"), "实现上下文.jsonl"),
    `${JSON.stringify({ role: "productSpec", file: "不存在.md", selector: { kind: "wholeFile" }, reason: "missing", source: "spec", required: true, sourceRevision: `sha256:${"c".repeat(64)}`, maxTokens: 500 })}\n`,
  );
  const missingCheck = run(missingRequiredRoot, "--check");
  assert.equal(missingCheck.status, 2, "missing required file should fail check");

  const slugOnlyRoot = makeDocsTarget(tmpRoot, "slug-only");
  const slugOnlyWrite = run(slugOnlyRoot, "--write", "--slug", "capsule", "--title", "Capsule");
  assert.equal(slugOnlyWrite.status, 0, slugOnlyWrite.stderr || slugOnlyWrite.stdout);
  assert.equal(fs.existsSync(path.join(slugOnlyRoot, "会话记录.md")), false, "no summary must not create an empty journal");

  const longSlugRoot = makeDocsTarget(tmpRoot, "long-slug");
  const originalLongSlugManifest = readText(longSlugRoot, ".vibe-docs.json");
  const longSlugWrite = run(longSlugRoot, "--write", "--slug", "a".repeat(300), "--title", "Too Long");
  assert.notEqual(longSlugWrite.status, 0, "non-portable task capsule slugs must fail");
  assert.equal(
    readText(longSlugRoot, ".vibe-docs.json"),
    originalLongSlugManifest,
    "failed task capsule creation must not enable taskContext or publish a missing capsule path",
  );
  assert.equal(
    fs.existsSync(path.join(longSlugRoot, "docs", "plans", "任务")),
    false,
    "rejected slugs must not leave partial task capsule directories",
  );

  const junctionRoot = makeDocsTarget(tmpRoot, "junction-write");
  const outsideTaskRoot = path.join(tmpRoot, "outside-task-capsules");
  fs.mkdirSync(path.join(junctionRoot, "docs", "plans"), { recursive: true });
  fs.mkdirSync(outsideTaskRoot, { recursive: true });
  writeFile(path.join(outsideTaskRoot, "outside-marker.txt"), "must survive\n");
  fs.symlinkSync(
    outsideTaskRoot,
    path.join(junctionRoot, "docs", "plans", "任务"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const junctionWrite = run(junctionRoot, "--write", "--slug", "escape", "--title", "Escape");
  const junctionPayload = parseJson(junctionWrite);
  assert.equal(junctionWrite.status, 2, "task capsule writes must reject a junction parent");
  assert(
    junctionPayload.files.some((file) => file.status === "fail" && file.reason.includes("symlink or junction")),
    "junction rejection must be visible in the task context report",
  );
  assert.deepEqual(fs.readdirSync(outsideTaskRoot), ["outside-marker.txt"], "task context must not write outside target root");

  console.log("Target task context tests passed");
} finally {
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
}
