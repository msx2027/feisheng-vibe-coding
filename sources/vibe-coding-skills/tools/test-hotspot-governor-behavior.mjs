#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const skillText = readFileSync(path.join(repoRoot, "skills", "hotspot-governor", "SKILL.md"), "utf8");
const checker = path.join(repoRoot, "tools", "check-hotspots.mjs");

function assertIncludes(text, label, ...needles) {
  for (const needle of needles) {
    assert(text.includes(needle), `${label} should include ${JSON.stringify(needle)}`);
  }
}

function assertSection(name, ...needles) {
  const pattern = new RegExp(`\\[${name}\\]([\\s\\S]*?)(?=\\n\\[[^\\n]+\\]|$)`);
  const match = skillText.match(pattern);
  assert(match, `hotspot-governor should contain [${name}]`);
  assertIncludes(match[1], `[${name}]`, ...needles);
}

assertSection(
  "防误用边界",
  "只输出诊断和拆分路线",
  "不直接改代码",
  "历史只减不增",
  "新生产文件超过 300 行",
  "测试文件 300 行开始提醒",
  "不再是开始启用门禁的阈值",
  "不要在本 Skill 内直接大重构",
  "`code-review`",
  "`test-automation`",
  "`ui-system-guardian`",
  "`codebase-memory-scout`",
);

assertSection(
  "报告模板",
  "热区结论",
  "证据",
  "风险",
  "拆分路线",
  "后续路由",
  "人工验收状态",
);

assertSection(
  "行为验收样例",
  "这个文件太长",
  "这一坨看不懂",
  "别往这里塞了",
  "模块越来越大",
  "帮我看大组件",
  "超大组件",
  "开始按方案拆",
  "直接重构",
  "无边界大改",
);

function lines(count, line = "export const value = 1;") {
  return Array.from({ length: count }, (_, index) => `${line} // ${index}`).join("\n");
}

function runChecker(root, ...args) {
  const result = spawnSync("node", [checker, root, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function assertNoMirrorFindings(report) {
  const mirrorFindings = report.findings.filter((item) =>
    [item.file, item.directory, ...(item.files || [])].some((value) => /(^|\/)\.(agents|claude|codex)(\/|$)/.test(value || "")),
  );
  assert.deepEqual(
    mirrorFindings,
    [],
    `mirror directories should not produce hotspot findings:\n${JSON.stringify(mirrorFindings, null, 2)}`,
  );
}

function writeMirrorHotspotFixture(root) {
  for (const mirrorDir of [".agents", ".claude", ".codex"]) {
    mkdirSync(path.join(root, mirrorDir, "skills", "mirror"), { recursive: true });
    writeFileSync(path.join(root, mirrorDir, "skills", "mirror", "ignored.ts"), lines(901));
  }
}

const rootOnlyTempRoot = mkdtempSync(path.join(tmpdir(), "hotspot-governor-root-only-"));
try {
  writeMirrorHotspotFixture(rootOnlyTempRoot);
  writeFileSync(path.join(rootOnlyTempRoot, "small.ts"), "export const value = 1;\n");
  assertNoMirrorFindings(runChecker(rootOnlyTempRoot, "--json"));
} finally {
  rmSync(rootOnlyTempRoot, { recursive: true, force: true });
}

const tempRoot = mkdtempSync(path.join(tmpdir(), "hotspot-governor-behavior-"));
try {
  writeMirrorHotspotFixture(tempRoot);
  mkdirSync(path.join(tempRoot, "src"), { recursive: true });
  writeFileSync(path.join(tempRoot, "src", "small.ts"), "export const value = 1;\n");

  assertNoMirrorFindings(runChecker(tempRoot, "--json"));

  const gitReady = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
  if (gitReady) {
    assert.equal(spawnSync("git", ["init"], { cwd: tempRoot, encoding: "utf8" }).status, 0);
    assert.equal(spawnSync("git", ["add", "."], { cwd: tempRoot, encoding: "utf8" }).status, 0);
    assertNoMirrorFindings(runChecker(tempRoot, "--staged", "--json"));
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Hotspot governor behavior tests passed");
