#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checkerPath = path.join(repoRoot, "tools", "check-target-guardrails.mjs");

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function run(root, ...extra) {
  return spawnSync(process.execPath, [checkerPath, root, "--json", ...extra], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function runWithoutGit(root, ...extra) {
  return spawnSync(process.execPath, [checkerPath, root, "--json", ...extra], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, PATH: "" },
  });
}

function runGit(root, ...args) {
  return spawnSync("git", ["-C", root, ...args], {
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

function writeManifest(root, overrides = {}) {
  writeFile(
    path.join(root, ".vibe-docs.json"),
    JSON.stringify(
      {
        productSpec: "需求文档.md",
        devPlan: "开发计划.md",
        manualAcceptance: "验收记录.md",
        interfaceContracts: "接口契约.md",
        projectProfile: "项目画像.md",
        constitutionDesign: "宪法设计.md",
        ...overrides,
      },
      null,
      2,
    ),
  );
}

function makeGoodTarget(base) {
  const root = path.join(base, "good-target");
  writeManifest(root);
  writeFile(
    path.join(root, "需求文档.md"),
    "# 需求文档\n\n## 范围\n\n- 文档可以说明 TODO 的展示边界。\n\n## 不做什么\n\n## 成功标准\n\n## 停止条件\n\n## 未验证事项\n",
  );
  writeFile(path.join(root, "开发计划.md"), "# 开发计划\n\n## 验证闭环\n\n- 运行 `npm run check:health`。\n");
  writeFile(path.join(root, "验收记录.md"), "# 验收记录\n\n## 人工验收状态\n\n- 状态：待用户验收\n");
  writeFile(path.join(root, "接口契约.md"), "# 接口契约\n\n## 契约清单\n\n| 能力ID | 统一能力 | 入口类型 | 契约入口 | 调用方 | 状态 | 说明 |\n| --- | --- | --- | --- | --- | --- | --- |\n");
  writeFile(path.join(root, "项目画像.md"), "# 项目画像\n\n## Owner Map\n\n## 停止条件\n\n## 未验证项\n");
  writeFile(path.join(root, "宪法设计.md"), "# 宪法设计包\n\n## 项目证据包\n\n## 条款映射\n\n## 停止条件\n\n## 未验证项\n");
  return root;
}

function makeWarningTarget(base) {
  const root = makeGoodTarget(base);
  const warningRoot = path.join(base, "warning-target");
  fs.cpSync(root, warningRoot, { recursive: true });
  writeFile(path.join(warningRoot, "开发计划.md"), "# 开发计划\n\n## 验证闭环\n\nTODO 后续再补。\n");
  writeFile(path.join(warningRoot, ".env"), "SECRET=fixture\n");
  return warningRoot;
}

function makeSensitiveRuntimeTarget(base) {
  const root = makeGoodTarget(base);
  const sensitiveRoot = path.join(base, "sensitive-runtime-target");
  fs.cpSync(root, sensitiveRoot, { recursive: true });
  for (const relativePath of [
    ".ddzj/secret.json",
    ".cache/.env",
    ".tmp/dump.sql",
    "tmp/secret.txt",
    "sessions/private-key.pem",
    "archived_sessions/.env.local",
    "runtime.sqlite-wal",
  ]) {
    writeFile(path.join(sensitiveRoot, relativePath), "fixture\n");
  }
  return sensitiveRoot;
}

function makeSensitiveMappedDocumentTarget(base) {
  const root = makeGoodTarget(base);
  const sensitiveRoot = path.join(base, "sensitive-mapped-document-target");
  fs.cpSync(root, sensitiveRoot, { recursive: true });
  writeManifest(sensitiveRoot, { productSpec: ".ddzj/需求文档.md" });
  writeFile(path.join(sensitiveRoot, ".ddzj", "需求文档.md"), "# 需求文档\n\n## 范围\n");
  return sensitiveRoot;
}

function makeUppercaseSensitiveMappedDocumentTarget(base) {
  const root = makeGoodTarget(base);
  const sensitiveRoot = path.join(base, "uppercase-sensitive-mapped-document-target");
  fs.cpSync(root, sensitiveRoot, { recursive: true });
  writeManifest(sensitiveRoot, { productSpec: ".DDZJ/需求文档.md" });
  writeFile(path.join(sensitiveRoot, ".DDZJ", "需求文档.md"), "# 需求文档\n\n## 范围\n");
  return sensitiveRoot;
}

function makeTrackedSensitiveRuntimeTarget(base) {
  const root = makeGoodTarget(base);
  const trackedRoot = path.join(base, "tracked-sensitive-runtime-target");
  fs.cpSync(root, trackedRoot, { recursive: true });
  writeFile(path.join(trackedRoot, ".ddzj", "private-key.pem"), "fixture\n");
  writeFile(path.join(trackedRoot, ".ddzj", "private-key.test.ts"), "export {};\n");
  const init = runGit(trackedRoot, "init", "--quiet");
  assert.equal(init.status, 0, init.stderr || init.stdout);
  const add = runGit(trackedRoot, "add", ".ddzj/private-key.pem", ".ddzj/private-key.test.ts");
  assert.equal(add.status, 0, add.stderr || add.stdout);
  return trackedRoot;
}

function makeTestSourceTarget(base) {
  const root = makeGoodTarget(base);
  const testSourceRoot = path.join(base, "test-source-target");
  fs.cpSync(root, testSourceRoot, { recursive: true });
  writeFile(path.join(testSourceRoot, "tests", "model-credential-secret.test.ts"), "export {};\n");
  return testSourceRoot;
}

function makeBlockedTarget(base) {
  const root = path.join(base, "blocked-target");
  writeManifest(root, { productSpec: "Product-Spec.md" });
  writeFile(path.join(root, "Product-Spec.md"), "# Spec\n");
  return root;
}

function makeUnsafeManifestTarget(base) {
  const root = makeGoodTarget(base);
  const unsafeRoot = path.join(base, "unsafe-manifest-target");
  fs.cpSync(root, unsafeRoot, { recursive: true });
  fs.rmSync(path.join(unsafeRoot, ".vibe-docs.json"), { force: true });
  fs.mkdirSync(path.join(unsafeRoot, ".vibe-docs.json"));
  return unsafeRoot;
}

function makeMappedDocumentJunctionTarget(base) {
  const root = makeGoodTarget(base);
  const unsafeRoot = path.join(base, "mapped-document-junction-target");
  fs.cpSync(root, unsafeRoot, { recursive: true });
  const outsideDocs = path.join(base, "outside-lifecycle-docs");
  writeFile(path.join(outsideDocs, "需求文档.md"), "# 仓库外需求文档\n\n## 范围\n");
  const linkedDocs = path.join(unsafeRoot, "外部文档");
  fs.symlinkSync(outsideDocs, linkedDocs, process.platform === "win32" ? "junction" : "dir");
  writeManifest(unsafeRoot, { productSpec: "外部文档/需求文档.md" });
  return unsafeRoot;
}

let tmpRoot = "";

try {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "target-guardrails-"));

  const good = run(makeGoodTarget(tmpRoot), "--strict");
  const goodPayload = parseJson(good);
  assert.equal(good.status, 0, good.stderr || good.stdout);
  assert.equal(goodPayload.ok, true);

  const warning = run(makeWarningTarget(tmpRoot));
  const warningPayload = parseJson(warning);
  assert.equal(warning.status, 0, warning.stderr || warning.stdout);
  assert(warningPayload.findings.some((finding) => finding.id === "placeholder"));
  assert(warningPayload.findings.some((finding) => finding.id === "privacy-file"));

  const warningStrict = run(makeWarningTarget(tmpRoot), "--strict");
  assert.equal(warningStrict.status, 1, "strict mode should fail on warnings");

  const sensitiveRuntime = run(makeSensitiveRuntimeTarget(tmpRoot), "--strict");
  const sensitiveRuntimePayload = parseJson(sensitiveRuntime);
  assert.equal(sensitiveRuntime.status, 0, sensitiveRuntime.stderr || sensitiveRuntime.stdout);
  assert.equal(sensitiveRuntimePayload.ok, true);
  assert.equal(
    sensitiveRuntimePayload.findings.some((finding) => finding.id === "privacy-file"),
    false,
    "sensitive runtime directories and SQLite artifacts must not be scanned",
  );

  const sensitiveMappedDocument = run(makeSensitiveMappedDocumentTarget(tmpRoot));
  const sensitiveMappedDocumentPayload = parseJson(sensitiveMappedDocument);
  assert.equal(sensitiveMappedDocument.status, 1, "runtime state must not be mapped as lifecycle docs");
  assert(
    sensitiveMappedDocumentPayload.findings.some((finding) => finding.id === "doc-sensitive-runtime-path"),
  );

  const uppercaseSensitiveMappedDocument = run(makeUppercaseSensitiveMappedDocumentTarget(tmpRoot));
  const uppercaseSensitiveMappedDocumentPayload = parseJson(uppercaseSensitiveMappedDocument);
  assert.equal(uppercaseSensitiveMappedDocument.status, 1, "runtime path matching must be case-insensitive");
  assert(
    uppercaseSensitiveMappedDocumentPayload.findings.some(
      (finding) => finding.id === "doc-sensitive-runtime-path",
    ),
  );

  const trackedSensitiveRuntimeRoot = makeTrackedSensitiveRuntimeTarget(tmpRoot);
  const trackedSensitiveRuntime = run(trackedSensitiveRuntimeRoot);
  const trackedSensitiveRuntimePayload = parseJson(trackedSensitiveRuntime);
  assert.equal(trackedSensitiveRuntime.status, 0, trackedSensitiveRuntime.stderr || trackedSensitiveRuntime.stdout);
  assert(
    trackedSensitiveRuntimePayload.findings.some(
      (finding) => finding.id === "privacy-file" && finding.file === ".ddzj/private-key.pem",
    ),
    "tracked privacy files inside skipped runtime directories must still be reported",
  );
  assert(
    trackedSensitiveRuntimePayload.findings.some(
      (finding) => finding.id === "privacy-file" && finding.file === ".ddzj/private-key.test.ts",
    ),
    "tracked runtime files must not be ignored merely because their name looks like a test source",
  );

  if (process.platform === "win32") {
    const outsideFakeBin = `${trackedSensitiveRuntimeRoot}-outside-fake-bin`;
    const targetFakeBin = path.join(trackedSensitiveRuntimeRoot, "fake-bin");
    fs.mkdirSync(outsideFakeBin, { recursive: true });
    fs.copyFileSync(process.env.ComSpec, path.join(outsideFakeBin, "git.exe"));
    fs.symlinkSync(outsideFakeBin, targetFakeBin, "junction");
    try {
      const junctionAttempt = spawnSync(
        process.execPath,
        [checkerPath, trackedSensitiveRuntimeRoot, "--json"],
        {
          cwd: repoRoot,
          encoding: "utf8",
          env: { ...process.env, PATH: `${targetFakeBin}${path.delimiter}${process.env.PATH || ""}` },
        },
      );
      const junctionPayload = parseJson(junctionAttempt);
      assert.equal(junctionAttempt.status, 0, junctionAttempt.stderr || junctionAttempt.stdout);
      assert(
        junctionPayload.findings.some(
          (finding) => finding.id === "privacy-file" && finding.file === ".ddzj/private-key.pem",
        ),
        "a target-local PATH junction must not redirect the tracked-file scan to a fake Git executable",
      );
    } finally {
      fs.rmSync(targetFakeBin, { recursive: true, force: true });
      fs.rmSync(outsideFakeBin, { recursive: true, force: true });
    }
  }

  const gitUnavailable = runWithoutGit(makeTrackedSensitiveRuntimeTarget(tmpRoot), "--strict");
  const gitUnavailablePayload = parseJson(gitUnavailable);
  assert.equal(gitUnavailable.status, 1, "strict guardrail must fail when a required tracked-file scan cannot run");
  assert(
    gitUnavailablePayload.findings.some((finding) => finding.id === "git-tracked-scan"),
    "git scan failure must be visible instead of silently returning an empty tracked-file list",
  );

  const testSource = run(makeTestSourceTarget(tmpRoot), "--strict");
  const testSourcePayload = parseJson(testSource);
  assert.equal(testSource.status, 0, testSource.stderr || testSource.stdout);
  assert.equal(testSourcePayload.ok, true);

  const blocked = run(makeBlockedTarget(tmpRoot));
  const blockedPayload = parseJson(blocked);
  assert.equal(blocked.status, 1, "blockers should fail");
  assert(blockedPayload.findings.some((finding) => finding.id === "role-missing" || finding.id === "doc-name"));

  const unsafeManifest = run(makeUnsafeManifestTarget(tmpRoot));
  const unsafeManifestPayload = parseJson(unsafeManifest);
  assert.equal(unsafeManifest.status, 1, "manifest must be a regular file");
  assert(
    unsafeManifestPayload.findings.some((finding) => finding.id === "manifest-unsafe-file"),
    "non-regular manifests must be rejected before reading",
  );

  const mappedDocumentJunction = run(makeMappedDocumentJunctionTarget(tmpRoot));
  const mappedDocumentJunctionPayload = parseJson(mappedDocumentJunction);
  assert.equal(mappedDocumentJunction.status, 1, "mapped lifecycle docs must not cross a junction");
  assert(
    mappedDocumentJunctionPayload.findings.some((finding) => finding.id === "doc-unsafe-file"),
    "mapped lifecycle document junctions must be rejected before reading",
  );

  const outsideRoot = path.join(tmpRoot, "outside-linked-root");
  writeFile(path.join(outsideRoot, ".env.secret"), "SECRET=must-not-be-enumerated\n");
  const linkedRoot = path.join(tmpRoot, "linked-target-root");
  fs.symlinkSync(outsideRoot, linkedRoot, process.platform === "win32" ? "junction" : "dir");
  const linkedRootResult = run(linkedRoot);
  const linkedRootPayload = parseJson(linkedRootResult);
  assert.equal(linkedRootResult.status, 1, "linked target roots must fail closed");
  assert(
    linkedRootPayload.findings.some((finding) => finding.id === "target-root"),
    "linked target roots must be rejected at the entry boundary",
  );
  assert.equal(
    linkedRootPayload.findings.some((finding) => finding.file === ".env.secret"),
    false,
    "guardrails must not enumerate files through a linked target root",
  );

  console.log("Target guardrail tests passed");
} finally {
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
}
