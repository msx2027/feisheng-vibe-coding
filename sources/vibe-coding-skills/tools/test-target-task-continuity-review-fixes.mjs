#!/usr/bin/env node
// 实现阶段 finding 的 RED 回归：每个断言先锁定一个已知缺口，再修生产代码。
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { makeInitialKnowledge, validateKnowledge } from "./target-task-continuity-core.mjs";
import { estimateTokens, hashContent } from "./target-doc-manifest-core.mjs";
import { readTargetText, sha256 } from "./target-doc-transaction.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const initScript = path.join(repoRoot, "tools", "init-target-task-context.mjs");
const knowledgeScript = path.join(repoRoot, "tools", "update-target-task-knowledge.mjs");
const stateScript = path.join(repoRoot, "tools", "update-target-task-state.mjs");
const handoffScript = path.join(repoRoot, "tools", "generate-target-task-handoff.mjs");
const resolverScript = path.join(repoRoot, "tools", "resolve-target-doc-context.mjs");

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function run(script, root, ...args) {
  return spawnSync(process.execPath, [script, root, "--json", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function output(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(result.stdout + result.stderr);
  }
}

function makeDocsTarget(base) {
  const root = path.join(base, "target");
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
  for (const [file, content] of Object.values(mapped)) writeFile(path.join(root, ...file.split("/")), content);
  const manifest = {
    schemaVersion: 2,
    ...Object.fromEntries(Object.entries(mapped).map(([role, [file]]) => [role, file])),
    documentIndex: "文档索引.md",
    documents: Object.entries(mapped).map(([role, [file, content]]) => ({
      role,
      path: file,
      owner: "test:" + role,
      authority: role === "currentExecution" || role === "documentIndex" ? "projection" : "source",
      contentHash: hashContent(content),
      estimatedTokens: Math.max(1, estimateTokens(content)),
      dependsOn: [],
      sections: [],
    })),
    loadPolicy: { always: ["documentIndex"], never: [] },
  };
  writeFile(path.join(root, ".vibe-docs.json"), JSON.stringify(manifest, null, 2) + "\n");
  return root;
}

function initContinuity(root) {
  const result = run(initScript, root, "--continuity-mode", "t2", "--slug", "continuity", "--title", "Continuity", "--write");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return readJson(root, ".vibe-docs.json");
}

function canonicalRevision(value) {
  return sha256(JSON.stringify({ ...value, revision: "" }, null, 2) + "\n");
}

test("semantic revision follows stable JSON with two-space indentation and LF", () => {
  const value = makeInitialKnowledge();
  assert.equal(value.revision, canonicalRevision(value));
});

test("continuity recovers journal before reading a malformed knowledge source", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-review-recovery-"));
  try {
    const root = makeDocsTarget(base);
    const manifest = initContinuity(root);
    const knowledgePath = manifest.taskContext.continuity.knowledge;
    writeFile(path.join(root, knowledgePath), "{ invalid");
    writeFile(path.join(root, "marker.txt"), "after");
    const before = Buffer.from("before", "utf8").toString("base64");
    const after = Buffer.from("after", "utf8").toString("base64");
    writeFile(path.join(root, ".vibe-task-continuity.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "review-recovery",
      status: "applying",
      operations: [{ file: "marker.txt", beforeBase64: before, afterBase64: after }],
    }) + "\n");
    const result = run(knowledgeScript, root, "--category", "confirmed", "--id", "K-001", "--kind", "decision", "--statement", "x", "--expected-revision", "sha256:" + "0".repeat(64), "--write");
    assert.notEqual(result.status, 0);
    assert.equal(readText(root, "marker.txt"), "before");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("continuity CLI 在恢复 journal 后重新加载恢复后的 manifest", () => {
  const cases = [
    { name: "handoff", script: handoffScript, args: () => ["--check"] },
    { name: "resolver", script: resolverScript, args: (manifest) => ["--capsule", manifest.taskContext.currentTaskCapsule] },
    {
      name: "knowledge",
      script: knowledgeScript,
      args: (_manifest, knowledge) => ["--category", "confirmed", "--id", "K-001", "--kind", "decision", "--statement", "reload", "--expected-revision", knowledge.revision, "--write"],
    },
    {
      name: "state",
      script: stateScript,
      args: () => ["--status", "doing", "--phase", "P1", "--task", "T1", "--checkpoint", "reload", "--next", "next", "--write"],
    },
    { name: "init", script: initScript, args: () => ["--continuity-mode", "t2", "--write"] },
  ];

  for (const item of cases) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-review-manifest-reload-"));
    try {
      const root = makeDocsTarget(base);
      const manifest = initContinuity(root);
      const knowledge = readJson(root, manifest.taskContext.continuity.knowledge);
      const beforeRaw = readText(root, ".vibe-docs.json");
      const afterManifest = JSON.parse(beforeRaw);
      afterManifest.taskContext.continuity.handoff = "docs/plans/错误交接.md";
      const afterRaw = JSON.stringify(afterManifest, null, 2) + "\n";
      writeFile(path.join(root, ".vibe-docs.json"), afterRaw);
      writeFile(
        path.join(root, ".vibe-task-continuity.json"),
        JSON.stringify({
          schemaVersion: 1,
          kind: "manifest-reload-test",
          status: "applying",
          operations: [{
            file: ".vibe-docs.json",
            beforeBase64: Buffer.from(beforeRaw, "utf8").toString("base64"),
            afterBase64: Buffer.from(afterRaw, "utf8").toString("base64"),
          }],
        }, null, 2) + "\n",
      );

      const result = run(item.script, root, ...item.args(manifest, knowledge));
      assert.equal(result.status, 0, item.name + " 必须在恢复后读取合法 manifest：\n" + result.stdout + result.stderr);
      const recoveredManifest = readJson(root, ".vibe-docs.json");
      assert.equal(recoveredManifest.taskContext.continuity.handoff, manifest.taskContext.continuity.handoff);
      assert.equal(readTargetText(root, ".vibe-task-continuity.json"), null, item.name + " 恢复后 journal 必须清除");
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  }
});

test("enabled continuity rejects a handoff path outside the current capsule", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-review-path-"));
  try {
    const root = makeDocsTarget(base);
    const manifest = initContinuity(root);
    const currentPath = manifest.taskContext.continuity.handoff;
    const otherPath = "docs/plans/other-handoff.md";
    const handoff = readText(root, currentPath);
    writeFile(path.join(root, otherPath), handoff);
    manifest.taskContext.continuity.handoff = otherPath;
    const entry = manifest.documents.find((item) => item.role === "taskHandoff");
    entry.path = otherPath;
    entry.contentHash = hashContent(handoff);
    entry.estimatedTokens = estimateTokens(handoff);
    writeFile(path.join(root, ".vibe-docs.json"), JSON.stringify(manifest, null, 2) + "\n");
    const result = run(resolverScript, root, "--capsule", manifest.taskContext.currentTaskCapsule, "--json");
    assert.notEqual(result.status, 0);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("handoff write refuses stale state metadata instead of repairing the manifest", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-review-freshness-"));
  try {
    const root = makeDocsTarget(base);
    const manifest = initContinuity(root);
    const statePath = manifest.taskContext.currentTaskCapsule + "/任务状态.json";
    const state = readJson(root, statePath);
    state.checkpoint = "external edit";
    writeFile(path.join(root, statePath), JSON.stringify(state, null, 2) + "\n");
    const manifestBefore = readText(root, ".vibe-docs.json");
    const result = run(handoffScript, root, "--write");
    assert.notEqual(result.status, 0);
    assert.equal(readText(root, ".vibe-docs.json"), manifestBefore);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("resolver reports stale evidence when its source changes", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-review-evidence-"));
  try {
    const root = makeDocsTarget(base);
    const manifest = initContinuity(root);
    const knowledgePath = manifest.taskContext.continuity.knowledge;
    const current = readJson(root, knowledgePath);
    const source = readText(root, "需求文档.md");
    const evidence = [{
      kind: "document",
      role: "productSpec",
      path: "需求文档.md",
      selector: { kind: "wholeFile" },
      sourceRevision: hashContent(source),
    }];
    const updated = run(knowledgeScript, root, "--category", "confirmed", "--id", "K-001", "--kind", "decision", "--statement", "source", "--evidence-json", JSON.stringify(evidence), "--expected-revision", current.revision, "--write");
    assert.equal(updated.status, 0, updated.stdout + updated.stderr);
    writeFile(path.join(root, "需求文档.md"), "# 外部修改\n");
    const result = run(resolverScript, root, "--capsule", manifest.taskContext.currentTaskCapsule, "--json");
    assert.notEqual(result.status, 0);
    const payload = output(result);
    assert.ok(payload.stale.some((entry) => entry.reason === "evidence-stale"));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("resolver uses shared token estimation for Chinese budget decisions", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-review-budget-"));
  try {
    const root = makeDocsTarget(base);
    const manifest = initContinuity(root);
    const knowledgePath = manifest.taskContext.continuity.knowledge;
    const current = readJson(root, knowledgePath);
    const statement = "知".repeat(600);
    const updated = run(knowledgeScript, root, "--category", "confirmed", "--id", "K-001", "--kind", "decision", "--statement", statement, "--expected-revision", current.revision, "--write");
    assert.equal(updated.status, 0, updated.stdout + updated.stderr);
    const paths = [
      manifest.taskContext.continuity.handoff,
      manifest.taskContext.currentTaskCapsule + "/任务状态.json",
      manifest.currentExecution,
      manifest.taskContext.continuity.knowledge,
    ];
    const expectedTokens = paths.reduce((sum, relativePath) => sum + estimateTokens(readText(root, relativePath)), 0);
    const result = run(resolverScript, root, "--capsule", manifest.taskContext.currentTaskCapsule, "--budget", String(Math.max(1, expectedTokens - 1)), "--json");
    assert.notEqual(result.status, 0);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("continuity state rejects blocker values over 2000 UTF-8 bytes", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-review-state-limit-"));
  try {
    const root = makeDocsTarget(base);
    initContinuity(root);
    const result = run(stateScript, root, "--status", "doing", "--phase", "P1", "--task", "T1", "--checkpoint", "x", "--next", "y", "--blocker", "x".repeat(2001), "--write");
    assert.notEqual(result.status, 0);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("knowledge validation rejects unknown record fields", () => {
  const value = makeInitialKnowledge();
  value.confirmed.push({ id: "K-001", kind: "decision", statement: "x", evidence: [], extra: true });
  value.revision = canonicalRevision(value);
  assert.throws(() => validateKnowledge(value), /unknown/u);
});

test("resolver reports a missing state source as stale JSON", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-review-missing-"));
  try {
    const root = makeDocsTarget(base);
    const manifest = initContinuity(root);
    const statePath = path.join(root, ...((manifest.taskContext.currentTaskCapsule + "/任务状态.json").split("/")));
    fs.unlinkSync(statePath);
    const result = run(resolverScript, root, "--capsule", manifest.taskContext.currentTaskCapsule, "--json");
    assert.notEqual(result.status, 0);
    const payload = output(result);
    assert.ok(Array.isArray(payload.stale));
    assert.ok(payload.stale.some((entry) => entry.role === "taskState"));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
