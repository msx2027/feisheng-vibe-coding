#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const toolsRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(toolsRoot);
const indexBuilder = path.join(toolsRoot, "build-target-doc-index.mjs");
const autoSync = path.join(toolsRoot, "auto-sync-target-doc-index.mjs");
const preCommitCheck = path.join(toolsRoot, "check-target-doc-precommit.mjs");
const resolver = path.join(toolsRoot, "resolve-target-doc-context.mjs");
const claudeHook = path.join(repoRoot, "hooks", "auto-sync-target-doc-index.sh");
const codexHook = path.join(repoRoot, "codex-hooks", "auto-sync-target-doc-index.ps1");

function write(root, relative, content) {
  const target = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function sha256(content) {
  return `sha256:${crypto.createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function run(script, root, ...args) {
  return spawnSync(process.execPath, [script, root, ...args], { encoding: "utf8" });
}

function git(root, ...args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

function seed(root, { capsule = false } = {}) {
  const mapped = {
    productSpec: ["需求文档.md", "# 需求文档\n\n初始需求。\n"],
    devPlan: ["开发计划.md", "# 开发计划\n"],
    currentExecution: ["plans/执行光标.md", "# 执行光标\n"],
    manualAcceptance: ["验收记录.md", "# 验收记录\n"],
    interfaceContracts: ["接口契约.md", "# 接口契约\n"],
    projectProfile: ["项目画像.md", "# 项目画像\n"],
    constitutionDesign: ["宪法设计.md", "# 宪法设计\n"],
    documentIndex: ["文档索引.md", "# 文档索引\n"],
  };
  for (const [, [file, content]] of Object.entries(mapped)) write(root, file, content);
  const manifest = {
    schemaVersion: 2,
    ...Object.fromEntries(Object.entries(mapped).map(([role, [file]]) => [role, file])),
    documents: Object.entries(mapped).map(([role, [file, content]]) => ({
      role,
      path: file,
      owner: `test:${role}`,
      authority: ["currentExecution", "documentIndex"].includes(role) ? "projection" : "source",
      contentHash: sha256(content),
      estimatedTokens: 0,
      dependsOn: [],
      sections: [],
    })),
    loadPolicy: { always: ["documentIndex"], never: [] },
  };
  if (capsule) {
    manifest.taskContext = { enabled: true, currentTaskCapsule: "plans/任务/current" };
    write(root, "plans/任务/current/实现上下文.jsonl", `${JSON.stringify({
      role: "productSpec",
      file: "需求文档.md",
      selector: { kind: "wholeFile" },
      reason: "回归测试",
      source: "spec",
      required: true,
      sourceRevision: sha256(mapped.productSpec[1]),
      maxTokens: 1000,
    })}\n`);
  }
  write(root, ".vibe-docs.json", `${JSON.stringify(manifest, null, 2)}\n`);
  assert.equal(run(indexBuilder, root, "--write").status, 0);
}

function initGit(root) {
  assert.equal(git(root, "init", "--quiet").status, 0);
  assert.equal(git(root, "config", "user.email", "test@example.com").status, 0);
  assert.equal(git(root, "config", "user.name", "测试").status, 0);
  assert.equal(git(root, "add", ".").status, 0);
  assert.equal(git(root, "commit", "--quiet", "-m", "基线").status, 0);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "target-doc-auto-sync-"));
try {
  seed(root, { capsule: true });
  const capsulePath = path.join(root, "plans", "任务", "current", "实现上下文.jsonl");
  const capsuleBefore = fs.readFileSync(capsulePath, "utf8");
  write(root, "需求文档.md", "# 需求文档\n\n已修改需求。\n");

  const synced = run(autoSync, root, "--file", path.join(root, "需求文档.md"), "--json");
  assert.equal(synced.status, 0, synced.stderr || synced.stdout);
  assert.equal(JSON.parse(synced.stdout).changed, true);
  assert.equal(run(indexBuilder, root, "--check").status, 0);
  assert.equal(fs.readFileSync(capsulePath, "utf8"), capsuleBefore, "自动同步不得改写旧 sourceRevision");

  const staleCapsule = run(resolver, root, "--capsule", "plans/任务/current", "--json");
  assert.equal(staleCapsule.status, 1, staleCapsule.stderr || staleCapsule.stdout);
  assert.equal(JSON.parse(staleCapsule.stdout).stale[0].reason, "source-revision-mismatch");

  const bomHook = spawnSync(process.execPath, [autoSync, root, "--hook-input", "--json"], {
    encoding: "utf8",
    input: `\uFEFF${JSON.stringify({ cwd: root, tool_input: { file_path: path.join(root, "需求文档.md") } })}`,
  });
  assert.equal(bomHook.status, 0, bomHook.stderr || bomHook.stdout);

  const rootlessHook = spawnSync(process.execPath, [autoSync, "--hook-input", "--json"], {
    encoding: "utf8",
    input: JSON.stringify({ cwd: path.join(root, "plans"), tool_input: { file_path: path.join(root, "需求文档.md") } }),
  });
  assert.equal(rootlessHook.status, 0, rootlessHook.stderr || rootlessHook.stdout);

  if (process.platform === "win32") {
    const bash = process.env.VIBE_GATE_BASH || "D:\\Git\\bin\\bash.exe";
    const powershell = path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const payload = JSON.stringify({ cwd: path.join(root, "plans"), tool_input: { file_path: path.join(root, "需求文档.md") } });
    write(root, "需求文档.md", "# 需求文档\n\nClaude Hook 修改。\n");
    const claudeResult = spawnSync(bash, [claudeHook], { cwd: root, encoding: "utf8", input: payload, env: { ...process.env, VIBE_CODING_SKILLS_HOME: repoRoot } });
    assert.equal(claudeResult.status, 0, claudeResult.stderr || claudeResult.stdout);
    assert.equal(run(indexBuilder, root, "--check").status, 0);
    write(root, "需求文档.md", "# 需求文档\n\nCodex Hook 修改。\n");
    const codexResult = spawnSync(powershell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", codexHook], { cwd: root, encoding: "utf8", input: payload, env: { ...process.env, VIBE_CODING_SKILLS_HOME: repoRoot } });
    assert.equal(codexResult.status, 0, codexResult.stderr || codexResult.stdout);
    const codexIndexCheck = run(indexBuilder, root, "--check", "--json");
    assert.equal(codexIndexCheck.status, 0, `${codexResult.stderr || codexResult.stdout}\n${codexIndexCheck.stderr || codexIndexCheck.stdout}`);
    assert.notEqual(spawnSync(bash, [claudeHook], { cwd: root, encoding: "utf8", input: "", env: { ...process.env, VIBE_CODING_SKILLS_HOME: repoRoot } }).status, 0);
    assert.notEqual(spawnSync(powershell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", codexHook], { cwd: root, encoding: "utf8", input: "", env: { ...process.env, VIBE_CODING_SKILLS_HOME: repoRoot } }).status, 0);
  }

  const manifestBefore = fs.readFileSync(path.join(root, ".vibe-docs.json"), "utf8");
  const manifestSkipped = run(autoSync, root, "--file", path.join(root, ".vibe-docs.json"), "--json");
  assert.equal(manifestSkipped.status, 0, manifestSkipped.stderr || manifestSkipped.stdout);
  assert.equal(JSON.parse(manifestSkipped.stdout).skipped, true, "manifest 本身不是 documents[] 受管正文");
  write(root, "普通说明.md", "# 普通说明\n");
  const skipped = run(autoSync, root, "--file", path.join(root, "普通说明.md"), "--json");
  assert.equal(skipped.status, 0, skipped.stderr || skipped.stdout);
  assert.equal(JSON.parse(skipped.stdout).skipped, true);
  assert.equal(fs.readFileSync(path.join(root, ".vibe-docs.json"), "utf8"), manifestBefore);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

const commitRoot = fs.mkdtempSync(path.join(os.tmpdir(), "target-doc-precommit-"));
try {
  seed(commitRoot);
  initGit(commitRoot);
  write(commitRoot, "需求文档.md", "# 需求文档\n\n待提交修改。\n");
  assert.equal(git(commitRoot, "add", "需求文档.md").status, 0);
  const stale = run(preCommitCheck, commitRoot, "--json");
  assert.equal(stale.status, 1, stale.stderr || stale.stdout);

  const synced = run(autoSync, commitRoot, "--file", path.join(commitRoot, "需求文档.md"), "--json");
  assert.equal(synced.status, 0, synced.stderr || synced.stdout);
  assert.equal(git(commitRoot, "add", ".vibe-docs.json", "文档索引.md").status, 0);
  const fresh = run(preCommitCheck, commitRoot, "--json");
  assert.equal(fresh.status, 0, fresh.stderr || fresh.stdout);

  const noGit = spawnSync(process.execPath, [preCommitCheck, commitRoot, "--json"], {
    encoding: "utf8",
    env: { ...process.env, PATH: "", VIBE_GIT_EXECUTABLE: "" },
  });
  assert.notEqual(noGit.status, 0, "trusted Git 不可用时提交门禁必须 fail closed");
} finally {
  fs.rmSync(commitRoot, { recursive: true, force: true });
}

console.log("Target document auto-sync tests passed");
