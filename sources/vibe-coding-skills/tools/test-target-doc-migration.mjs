#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateTargetDocManifest } from "./target-doc-manifest-core.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tools = Object.fromEntries(
  ["build-target-doc-index", "migrate-target-doc-system", "update-target-task-state", "check-target-doc-drift", "archive-lifecycle-docs"].map((name) => [
    name,
    path.join(repoRoot, "tools", `${name}.mjs`),
  ]),
);

function write(root, relative, content) {
  const file = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function run(tool, root, ...args) {
  return spawnSync(process.execPath, [tools[tool], root, ...args, "--json"], { cwd: repoRoot, encoding: "utf8" });
}

function json(result) {
  try { return JSON.parse(result.stdout); } catch { throw new Error(`${result.stdout}\n${result.stderr}`); }
}

function treeHash(root) {
  const hash = crypto.createHash("sha256");
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).replaceAll("\\", "/");
      hash.update(rel);
      if (entry.isDirectory()) visit(full);
      else hash.update(fs.readFileSync(full));
    }
  };
  visit(root);
  return hash.digest("hex");
}

function legacyTarget(base, name) {
  const root = path.join(base, name);
  fs.mkdirSync(root, { recursive: true });
  const docs = {
    productSpec: ["需求文档.md", "# 需求\n\n## 登录\n内容\n"],
    devPlan: ["开发计划.md", "# 计划\n\n## Phase 1\n任务\n"],
    currentExecution: ["plans/执行光标.md", "# 执行光标\n"],
    manualAcceptance: ["验收记录.md", "# 验收记录\n"],
    interfaceContracts: ["接口契约.md", "# 接口契约\n"],
    projectProfile: ["项目画像.md", "# 项目画像\n"],
    constitutionDesign: ["宪法设计.md", "# 宪法设计\n"],
  };
  write(root, ".vibe-docs.json", `${JSON.stringify({ ...Object.fromEntries(Object.entries(docs).map(([role, [file]]) => [role, file])), loadPolicy: { always: [], never: [] } }, null, 2)}\n`);
  for (const [, [file, content]] of Object.entries(docs)) write(root, file, content);
  return root;
}

let tmp = "";
try {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "target-doc-migration-"));

  const dryRoot = legacyTarget(tmp, "dry");
  const before = treeHash(dryRoot);
  const dry = run("migrate-target-doc-system", dryRoot);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(json(dry).mode, "dry-run");
  assert.equal(treeHash(dryRoot), before, "default migration must write nothing");

  const writeResult = run("migrate-target-doc-system", dryRoot, "--write");
  assert.equal(writeResult.status, 0, writeResult.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(dryRoot, ".vibe-docs.json"), "utf8"));
  assert.equal(validateTargetDocManifest(manifest).ok, true, JSON.stringify(validateTargetDocManifest(manifest).issues));
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.documentIndex, "文档索引.md");
  assert(manifest.documents.some((doc) => doc.role === "documentIndex"));
  assert(manifest.loadPolicy.always.includes("documentIndex"));
  assert(fs.existsSync(path.join(dryRoot, "文档索引.md")));
  assert.equal(fs.existsSync(path.join(dryRoot, ".vibe-doc-migration.json")), false);
  const indexFresh = run("build-target-doc-index", dryRoot, "--check");
  assert.equal(indexFresh.status, 0, indexFresh.stderr || indexFresh.stdout);
  const afterFirst = treeHash(dryRoot);
  const second = run("migrate-target-doc-system", dryRoot, "--write");
  assert.equal(second.status, 0, second.stderr);
  assert.equal(treeHash(dryRoot), afterFirst, "migration must be idempotent");

  const collectionRoot = legacyTarget(tmp, "collections");
  const collectionManifest = JSON.parse(fs.readFileSync(path.join(collectionRoot, ".vibe-docs.json"), "utf8"));
  collectionManifest.planDetails = ["plans/第一阶段.md", "plans/第二阶段.md"];
  write(collectionRoot, "plans/第一阶段.md", "# 第一阶段\n");
  write(collectionRoot, "plans/第二阶段.md", "# 第二阶段\n");
  write(collectionRoot, ".vibe-docs.json", `${JSON.stringify(collectionManifest, null, 2)}\n`);
  const collectionMigration = run("migrate-target-doc-system", collectionRoot, "--write");
  assert.equal(collectionMigration.status, 0, collectionMigration.stderr || collectionMigration.stdout);
  const collectionResult = JSON.parse(fs.readFileSync(path.join(collectionRoot, ".vibe-docs.json"), "utf8"));
  assert.equal(validateTargetDocManifest(collectionResult).ok, true, JSON.stringify(validateTargetDocManifest(collectionResult).issues));
  assert.deepEqual(
    collectionResult.documents.filter((doc) => doc.role === "planDetails").map((doc) => doc.path).sort(),
    ["plans/第一阶段.md", "plans/第二阶段.md"],
  );

  const recoverRoot = legacyTarget(tmp, "recover");
  const recoverFile = ".vibe-docs.json";
  const recoverBefore = fs.readFileSync(path.join(recoverRoot, recoverFile), "utf8");
  const recoverAfter = `${recoverBefore.trimEnd()}\n `;
  write(recoverRoot, recoverFile, recoverAfter);
  write(
    recoverRoot,
    ".vibe-doc-migration.json",
    `${JSON.stringify({ schemaVersion: 1, kind: "target-doc-migration", status: "applying", operations: [{ file: recoverFile, beforeBase64: Buffer.from(recoverBefore).toString("base64"), afterBase64: Buffer.from(recoverAfter).toString("base64") }] }, null, 2)}\n`,
  );
  const recovered = run("migrate-target-doc-system", recoverRoot, "--recover");
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(fs.readFileSync(path.join(recoverRoot, recoverFile), "utf8"), recoverBefore, "recover must roll back a partial migration");
  assert.equal(fs.existsSync(path.join(recoverRoot, ".vibe-doc-migration.json")), false);

  const capsule = "plans/任务/2026-07-12-demo";
  write(dryRoot, `${capsule}/任务状态.json`, `${JSON.stringify({ schemaVersion: 2, phase: "P1", task: "T1", status: "doing", checkpoint: "start", nextStep: "continue", manualAcceptanceRef: "", revision: "" }, null, 2)}\n`);
  manifest.taskContext = { enabled: true, taskCapsulesRoot: "plans/任务", currentTaskCapsule: capsule };
  write(dryRoot, ".vibe-docs.json", `${JSON.stringify(manifest, null, 2)}\n`);
  const update = run("update-target-task-state", dryRoot, "--status", "blocked", "--phase", "P1", "--task", "T1", "--checkpoint", "blocked here", "--next", "ask user", "--write");
  assert.equal(update.status, 0, update.stderr);
  const updatePayload = json(update);
  const state = JSON.parse(fs.readFileSync(path.join(dryRoot, capsule, "任务状态.json"), "utf8"));
  assert.equal(state.status, "blocked");
  assert.equal(state.checkpoint, "blocked here");
  assert.equal(state.revision, updatePayload.revision);
  const cursorLines = fs.readFileSync(path.join(dryRoot, "plans", "执行光标.md"), "utf8").split(/\r?\n/u);
  assert(cursorLines.slice(0, 10).some((line) => line.includes(`revision: ${state.revision}`)), "cursor machine header must be in first 10 lines");
  const stateIndexFresh = run("build-target-doc-index", dryRoot, "--check");
  assert.equal(stateIndexFresh.status, 0, stateIndexFresh.stderr || stateIndexFresh.stdout);
  const stale = run("update-target-task-state", dryRoot, "--status", "doing", "--phase", "P1", "--task", "T1", "--checkpoint", "x", "--next", "y", "--expected-revision", `sha256:${"0".repeat(64)}`, "--write");
  assert.equal(stale.status, 1, "stale CAS must be rejected");

  write(dryRoot, "孤儿文档.md", "<!-- vibe-lifecycle -->\n# orphan\n");
  const drift = run("check-target-doc-drift", dryRoot, "--full", "--strict");
  assert.equal(drift.status, 1, "marked orphan must block strict drift");
  assert(json(drift).findings.some((item) => item.code === "marked-orphan"));

  const archiveRoot = legacyTarget(tmp, "archive");
  let changelog = "# 变更归档\n\n";
  for (let index = 30; index >= 1; index -= 1) changelog += `## [v${index}] - 2025-01-${String(index).padStart(2, "0")}\n${"内容".repeat(40)}\n`;
  write(archiveRoot, "需求变更.md", changelog + "\n".repeat(600));
  const archiveManifest = JSON.parse(fs.readFileSync(path.join(archiveRoot, ".vibe-docs.json"), "utf8"));
  archiveManifest.productSpecChangelogArchive = "需求变更.md";
  write(archiveRoot, ".vibe-docs.json", `${JSON.stringify(archiveManifest, null, 2)}\n`);
  const archiveMigration = run("migrate-target-doc-system", archiveRoot, "--write");
  assert.equal(archiveMigration.status, 0, archiveMigration.stderr || archiveMigration.stdout);
  const archived = run("archive-lifecycle-docs", archiveRoot, "--write", "--keep-versions", "2");
  assert.equal(archived.status, 0, archived.stderr);
  assert(fs.existsSync(path.join(archiveRoot, "需求一卷.md")), "archive filename must be four Chinese characters");
  const archivedManifest = JSON.parse(fs.readFileSync(path.join(archiveRoot, ".vibe-docs.json"), "utf8"));
  const archiveDoc = archivedManifest.documents.find((doc) => doc.path === "需求一卷.md");
  assert.equal(archiveDoc.authority, "archive");
  assert(archivedManifest.loadPolicy.never.includes(archiveDoc.role));
  const archiveIndexFresh = run("build-target-doc-index", archiveRoot, "--check");
  assert.equal(archiveIndexFresh.status, 0, archiveIndexFresh.stderr || archiveIndexFresh.stdout);

  console.log("Target doc migration tests passed");
} finally {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
}
