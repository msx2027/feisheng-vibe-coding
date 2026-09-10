#!/usr/bin/env node
// 长任务连续性 V1 定向测试：先锁定契约，再由最小实现使其通过。
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildManifestOperations } from "./target-task-continuity-core.mjs";
import { commitTargetTransaction, readTargetText } from "./target-doc-transaction.mjs";
import { hashContent } from "./target-doc-manifest-schema.mjs";

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

function run(script, root, ...extra) {
  return spawnSync(process.execPath, [script, root, "--json", ...extra], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function parseJson(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Expected JSON output, got:\n${result.stdout}\n${result.stderr}`);
  }
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8"));
}

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}

function makeDocsTarget(base, name) {
  const root = path.join(base, name);
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
  for (const [, [file, content]] of Object.entries(mapped)) writeFile(path.join(root, ...file.split("/")), content);
  writeFile(
    path.join(root, ".vibe-docs.json"),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        ...Object.fromEntries(Object.entries(mapped).map(([role, [file]]) => [role, file])),
        documentIndex: "文档索引.md",
        documents: Object.entries(mapped).map(([role, [file, content]]) => ({
          role,
          path: file,
          owner: `test:${role}`,
          authority: ["currentExecution", "documentIndex"].includes(role) ? "projection" : "source",
          contentHash: hashContent(content),
          estimatedTokens: Math.max(1, Math.ceil(content.length / 4)),
          dependsOn: [],
          sections: [],
        })),
        loadPolicy: { always: ["documentIndex"], never: [] },
      },
      null,
      2,
    )}\n`,
  );
  return root;
}

function makeLegacyTarget(base, name) {
  const root = makeDocsTarget(base, name);
  const manifest = readJson(root, ".vibe-docs.json");
  const legacy = Object.fromEntries([
    "productSpec", "devPlan", "currentExecution", "manualAcceptance", "interfaceContracts",
    "projectProfile", "constitutionDesign", "documentIndex",
  ].map((role) => [role, manifest[role]]));
  writeFile(root + "/.vibe-docs.json", `${JSON.stringify(legacy, null, 2)}\n`);
  return root;
}

function capsuleFile(root, capsule, file) {
  return path.join(root, ...`${capsule}/${file}`.split("/"));
}

function initContinuity(root) {
  const result = run(initScript, root, "--continuity-mode", "t2", "--slug", "continuity", "--title", "Continuity", "--write");
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const manifest = parseJson(result);
  return { manifest: readJson(root, ".vibe-docs.json"), payload: manifest };
}

test("共享 hash 将 BOM、CRLF、CR 和 LF 视为同一内容", () => {
  assert.equal(hashContent("\uFEFFalpha\r\nbeta\r"), hashContent("alpha\nbeta\n"));
});

test("事务 hook 观察真实 applying 中途并回滚已写 operation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-transaction-"));
  try {
    writeFile(path.join(root, "a.txt"), "a0");
    writeFile(path.join(root, "b.txt"), "b0");
    let observed = false;
    assert.throws(
      () => commitTargetTransaction(root, {
        journalPath: ".vibe-task-continuity.json",
        kind: "continuity-test",
        operations: [
          { file: "a.txt", content: "a1", expectedContent: "a0" },
          { file: "b.txt", content: "b1", expectedContent: "b0" },
        ],
        testHooks: {
          beforeApply(operation, index) {
            if (index !== 1) return;
            const journal = JSON.parse(readTargetText(root, ".vibe-task-continuity.json"));
            assert.equal(operation.file, "b.txt");
            assert.equal(readTargetText(root, "a.txt"), "a1");
            assert.equal(journal.status, "applying");
            observed = true;
            throw new Error("injected mid-apply failure");
          },
        },
      }),
      /injected mid-apply failure/u,
    );
    assert.equal(observed, true);
    assert.equal(readTargetText(root, "a.txt"), "a0");
    assert.equal(readTargetText(root, "b.txt"), "b0");
    assert.equal(readTargetText(root, ".vibe-task-continuity.json"), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("source 在规划后晚改时 continuity commit 拒绝并保持零写入", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-late-source-edit-"));
  try {
    const root = makeDocsTarget(base, "target");
    initContinuity(root);
    const manifestRaw = readText(root, ".vibe-docs.json");
    const manifest = JSON.parse(manifestRaw);
    const handoffPath = manifest.taskContext.continuity.handoff;
    const handoffBefore = readText(root, handoffPath);
    const indexBefore = readText(root, manifest.documentIndex);
    const manifestBefore = manifestRaw;
    const plan = buildManifestOperations(root, manifest, manifestRaw, [{
      file: handoffPath,
      content: handoffBefore + "planned late edit\n",
      expectedContent: handoffBefore,
    }]);

    writeFile(path.join(root, "需求文档.md"), "# 外部晚改\n");
    assert.throws(
      () => commitTargetTransaction(root, {
        journalPath: ".vibe-task-continuity.json",
        kind: "late-source-edit-test",
        operations: plan.operations,
        preconditions: plan.preconditions || [],
      }),
      /target changed after planning/u,
    );
    assert.equal(readText(root, handoffPath), handoffBefore);
    assert.equal(readText(root, manifest.documentIndex), indexBefore);
    assert.equal(readText(root, ".vibe-docs.json"), manifestBefore);
    assert.equal(readTargetText(root, ".vibe-task-continuity.json"), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("continuity 首次启用创建 knowledge、handoff、role metadata 和初始 revision", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-init-"));
  try {
    const root = makeDocsTarget(base, "target");
    const { manifest } = initContinuity(root);
    const capsule = manifest.taskContext.currentTaskCapsule;
    const continuity = manifest.taskContext.continuity;
    assert.deepEqual(Object.keys(continuity).sort(), ["enabled", "handoff", "knowledge", "protocolVersion"]);
    assert.equal(continuity.enabled, true);
    assert.equal(continuity.protocolVersion, 1);
    assert.equal(fs.existsSync(capsuleFile(root, capsule, "任务状态.json")), true);
    assert.equal(fs.existsSync(capsuleFile(root, capsule, "确认状态.json")), true);
    assert.equal(fs.existsSync(capsuleFile(root, capsule, "任务交接.md")), true);
    const knowledge = readJson(root, continuity.knowledge);
    assert.match(knowledge.revision, /^sha256:[a-f0-9]{64}$/u);
    assert.deepEqual(knowledge.confirmed, []);
    assert.deepEqual(knowledge.rejected, []);
    assert.deepEqual(knowledge.unverified, []);
    assert.match(readText(root, continuity.handoff), /vibe-task-handoff:v1 stateRevision=sha256:[a-f0-9]{64} knowledgeRevision=sha256:[a-f0-9]{64}/u);
    for (const role of ["taskKnowledge", "taskHandoff"]) {
      assert.equal(manifest.documents.filter((entry) => entry.role === role).length, 1);
    }
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("未知 continuity mode 在写入前失败", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-mode-"));
  try {
    const root = makeDocsTarget(base, "target");
    const before = readText(root, ".vibe-docs.json");
    const result = run(initScript, root, "--continuity-mode", "unknown", "--slug", "continuity", "--title", "Continuity", "--write");
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /continuity-mode|unsupported/iu);
    assert.equal(readText(root, ".vibe-docs.json"), before);
    assert.equal(fs.existsSync(path.join(root, "docs", "plans", "任务")), false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("continuity init dry-run 只规划不写入", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-dry-run-"));
  try {
    const root = makeDocsTarget(base, "target");
    const before = readText(root, ".vibe-docs.json");
    const result = run(initScript, root, "--continuity-mode", "t2", "--slug", "continuity", "--title", "Continuity");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(parseJson(result).ok, true);
    assert.equal(readText(root, ".vibe-docs.json"), before);
    assert.equal(fs.existsSync(path.join(root, "docs", "plans", "任务")), false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("continuity init 胶囊路径冲突时零写入", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-collision-"));
  try {
    const root = makeDocsTarget(base, "target");
    const date = new Date();
    const dateId = [
      String(date.getFullYear()).padStart(4, "0"),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const capsule = "docs/plans/任务/" + dateId + "-continuity";
    const statePath = capsule + "/任务状态.json";
    writeFile(path.join(root, ...statePath.split("/")), "用户已有状态");
    const manifestBefore = readText(root, ".vibe-docs.json");
    const result = run(initScript, root, "--continuity-mode", "t2", "--slug", "continuity", "--title", "Continuity", "--write");
    assert.notEqual(result.status, 0);
    assert.equal(readText(root, ".vibe-docs.json"), manifestBefore);
    assert.equal(readText(root, statePath), "用户已有状态");
    assert.equal(readTargetText(root, ".vibe-task-continuity.json"), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("已启用 continuity 可刷新当前 capsule，传新任务则拒绝且零写入", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-refresh-"));
  try {
    const root = makeDocsTarget(base, "target");
    const { manifest } = initContinuity(root);
    const manifestBeforeSwitch = readText(root, ".vibe-docs.json");
    const statePath = `${manifest.taskContext.currentTaskCapsule}/任务状态.json`;
    const handoffPath = manifest.taskContext.continuity.handoff;
    const stateBeforeSwitch = readText(root, statePath);
    const handoffBeforeSwitch = readText(root, handoffPath);
    const refreshed = run(initScript, root, "--continuity-mode", "t2", "--write");
    assert.equal(refreshed.status, 0, refreshed.stdout + refreshed.stderr);
    assert.equal(parseJson(refreshed).ok, true);
    const switched = run(initScript, root, "--continuity-mode", "t2", "--slug", "next", "--title", "Next", "--write");
    assert.notEqual(switched.status, 0);
    const switchOutput = switched.stdout + switched.stderr;
    assert.match(switchOutput, /task switch unsupported|already enabled/iu);
    assert.equal(readText(root, ".vibe-docs.json"), manifestBeforeSwitch);
    assert.equal(readText(root, statePath), stateBeforeSwitch);
    assert.equal(readText(root, handoffPath), handoffBeforeSwitch);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-legacy-"));
test("legacy manifest 启用 continuity 在规划前 fail-closed 且保持字节不变", () => {
  try {
    const root = makeLegacyTarget(base, "target");
    const before = readText(root, ".vibe-docs.json");
    const result = run(initScript, root, "--continuity-mode", "t2", "--slug", "continuity", "--title", "Continuity", "--write");
    assert.notEqual(result.status, 0);
    const output = `${result.stdout}${result.stderr}`;
    assert.doesNotMatch(output, /Unknown argument: --continuity-mode/u);
    assert.match(output, /continuity requires|schemaVersion 2|legacy/iu);
    assert.equal(readText(root, ".vibe-docs.json"), before);
    assert.equal(fs.existsSync(path.join(root, "docs", "plans", "任务")), false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("knowledge upsert 校验数组 evidence、CAS 和 stale source，并同步 handoff", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-knowledge-"));
  try {
    const root = makeDocsTarget(base, "target");
    const { manifest } = initContinuity(root);
    const knowledgePath = manifest.taskContext.continuity.knowledge;
    const current = readJson(root, knowledgePath);
    const evidence = [{
      kind: "document",
      role: "productSpec",
      path: "需求文档.md",
      selector: { kind: "wholeFile" },
      sourceRevision: hashContent(readText(root, "需求文档.md")),
    }];
    const updated = run(knowledgeScript, root, "--category", "confirmed", "--id", "K-001", "--kind", "decision", "--statement", "采用连续性 V1", "--evidence-json", JSON.stringify(evidence), "--expected-revision", current.revision, "--write");
    assert.equal(updated.status, 0, `${updated.stdout}\n${updated.stderr}`);
    const next = readJson(root, knowledgePath);
    assert.equal(next.confirmed[0].id, "K-001");
    assert.deepEqual(next.confirmed[0].evidence, evidence);
    assert.match(readText(root, manifest.taskContext.continuity.handoff), /采用连续性 V1/u);
    const beforeStale = readText(root, knowledgePath);
    writeFile(path.join(root, "需求文档.md"), "# 需求已变化\n");
    const stale = run(knowledgeScript, root, "--category", "confirmed", "--id", "K-002", "--kind", "decision", "--statement", "不应写入", "--evidence-json", JSON.stringify(evidence), "--expected-revision", next.revision, "--write");
    assert.notEqual(stale.status, 0);
    assert.equal(readText(root, knowledgePath), beforeStale);
    const objectEvidence = run(knowledgeScript, root, "--category", "confirmed", "--id", "K-003", "--kind", "decision", "--statement", "对象不是数组", "--evidence-json", JSON.stringify(evidence[0]), "--expected-revision", next.revision, "--write");
    assert.notEqual(objectEvidence.status, 0);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("state 更新维护 blocker/doneWhen，并在一次 continuity 提交中刷新交接单", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-state-"));
  try {
    const root = makeDocsTarget(base, "target");
    const { manifest } = initContinuity(root);
    const capsule = manifest.taskContext.currentTaskCapsule;
    const result = run(stateScript, root, "--status", "doing", "--phase", "P1", "--task", "T1", "--checkpoint", "已完成 RED", "--next", "开始 GREEN", "--blocker", "", "--done-when", "测试全绿", "--write");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const state = readJson(root, `${capsule}/任务状态.json`);
    assert.equal(state.blocker, "");
    assert.equal(state.doneWhen, "测试全绿");
    assert.match(readText(root, manifest.taskContext.continuity.handoff), /开始 GREEN/u);
    const preserve = run(stateScript, root, "--status", "doing", "--phase", "P1", "--task", "T1", "--checkpoint", "继续", "--next", "下一步", "--write");
    assert.equal(preserve.status, 0, `${preserve.stdout}\n${preserve.stderr}`);
    assert.equal(readJson(root, `${capsule}/任务状态.json`).doneWhen, "测试全绿");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("resolver 以 handoff、state、currentExecution、knowledge 顺序恢复当前 capsule", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-resolver-"));
  try {
    const root = makeDocsTarget(base, "target");
    const { manifest } = initContinuity(root);
    const capsule = manifest.taskContext.currentTaskCapsule;
    const result = run(resolverScript, root, "--capsule", capsule, "--json");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const payload = parseJson(result);
    assert.deepEqual(payload.allowed.map((entry) => entry.role), ["taskHandoff", "taskState", "currentExecution", "taskKnowledge"]);
    const wrongCapsule = run(resolverScript, root, "--capsule", "docs/plans/任务/1900-01-01-old", "--json");
    assert.notEqual(wrongCapsule.status, 0);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("resolver 将损坏 handoff header 作为 stale 返回失败", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-header-"));
  try {
    const root = makeDocsTarget(base, "target");
    const { manifest } = initContinuity(root);
    const handoffPath = manifest.taskContext.continuity.handoff;
    const handoffFile = path.join(root, ...handoffPath.split("/"));
    const malformed = readText(root, handoffPath).replace(/^<!--.*-->/u, "<!-- invalid -->");
    writeFile(handoffFile, malformed);
    const nextManifest = readJson(root, ".vibe-docs.json");
    const entry = nextManifest.documents.find((item) => item.role === "taskHandoff");
    entry.contentHash = hashContent(malformed);
    writeFile(path.join(root, ".vibe-docs.json"), JSON.stringify(nextManifest, null, 2));
    const result = run(resolverScript, root, "--capsule", manifest.taskContext.currentTaskCapsule);
    assert.notEqual(result.status, 0);
    const payload = parseJson(result);
    assert.ok(Array.isArray(payload.stale), result.stdout + result.stderr);
    assert.equal(payload.stale[0].reason, "handoff-header-invalid");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("handoff check/write 复用确定性 renderer，不因 freshness 自动修 source", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-handoff-"));
  try {
    const root = makeDocsTarget(base, "target");
    const { manifest } = initContinuity(root);
    const check = run(handoffScript, root, "--check");
    assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);
    const handoffBefore = readText(root, manifest.taskContext.continuity.handoff);
    const dryRun = run(handoffScript, root, "--dry-run");
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`);
    assert.equal(readText(root, manifest.taskContext.continuity.handoff), handoffBefore);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

