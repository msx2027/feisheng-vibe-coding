#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const templateRoot = path.join(repoRoot, "skills", "dev-builder", "templates", "project-scaffolds", "_target-docs");
const manifest = JSON.parse(fs.readFileSync(path.join(templateRoot, "_vibe-docs.json.template"), "utf8"));
const expected = {
  productSpec: "docs/需求文档.md",
  productSpecChangelog: "docs/需求变更.md",
  designBrief: "docs/设计简报.md",
  devPlan: "docs/项目治理/开发计划.md",
  currentExecution: "docs/plans/执行光标.md",
  manualAcceptance: "docs/项目治理/验收记录.md",
  interfaceContracts: "docs/接口契约.md",
  projectProfile: "docs/项目治理/项目画像.md",
  constitutionDesign: "docs/项目治理/宪法设计.md",
};

assert.deepEqual(Object.fromEntries(Object.keys(expected).map((role) => [role, manifest[role]])), expected);
assert.equal(manifest.taskContext.taskCapsulesRoot, "docs/plans/任务");
assert.deepEqual(manifest.markdownGovernance, {
  enabled: true,
  maxTokens: 8000,
  facadeMaxTokens: 3000,
  archiveDirectories: [],
}, "新项目脚手架必须默认启用 Markdown 分卷治理");
assert.deepEqual(
  fs.readdirSync(templateRoot, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name).sort(),
  ["_vibe-docs.json.template", "文档索引.md.template"],
  "脚手架根目录只能保留 manifest 与文档索引模板",
);
assert.equal(fs.existsSync(path.join(templateRoot, "plans", "执行光标.md.template")), false, "执行光标模板不得留在根目录 plans/");
for (const file of Object.values(expected)) {
  assert(fs.existsSync(path.join(templateRoot, `${file}.template`)), `模板缺失：${file}.template`);
}
const expectedRoles = ["documentIndex", ...Object.keys(expected)].sort();
assert.deepEqual(manifest.documents.map((entry) => entry.role).sort(), expectedRoles, "documents[] 必须完整登记所有默认角色且不得冗余");
assert.equal(manifest.documents.length, expectedRoles.length, "documents[] 角色不得重复或缺失");
for (const entry of manifest.documents) {
  assert.equal(entry.path, manifest[entry.role], `${entry.role} 的 documents[] 路径漂移`);
}

for (const example of ["web-vite-mini", "cli-node-mini", "desktop-electron-mini"]) {
  const exampleManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "examples", "golden-path", example, ".vibe-docs.json"), "utf8"));
  assert.equal(exampleManifest.markdownGovernance?.enabled, true, `${example} golden path must enable Markdown governance`);
  assert.equal(exampleManifest.markdownGovernance?.maxTokens, 8000);
  assert.equal(exampleManifest.markdownGovernance?.facadeMaxTokens, 3000);
  assert.equal(exampleManifest.loadPolicy?.note.includes("合计不超过 12,000 token"), true, `${example} must use the 12,000-token always budget`);
  assert.equal(exampleManifest.loadPolicy?.note.includes("合计不超过 50,000 token"), false, `${example} must not advertise the old always budget`);
}

console.log("Scaffold document placement tests passed");
