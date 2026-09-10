#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceSkillsRoot = path.join(repoRoot, "skills");

function walkFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(root, entry.name);
    return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath];
  });
}

const impeccableStateUsers = walkFiles(sourceSkillsRoot)
  .filter((file) => /\.(?:md|json|template)$/u.test(file))
  .flatMap((file) => {
    const content = fs.readFileSync(file, "utf8");
    return content.includes(".impeccable.md") ? [path.relative(repoRoot, file).replaceAll("\\", "/")] : [];
  });
const findings = impeccableStateUsers.map((file) => `${file}: 根 .impeccable.md 是第二设计状态源`);

const designBriefSurfaces = [
  "skills/design-brief-builder/SKILL.md",
  "skills/design-brief-builder/templates/design-brief-template.md",
  "skills/design-maker/SKILL.md",
  "skills/dev-builder/SKILL.md",
  "skills/dev-builder/templates/project-scaffolds/_target-docs/文档索引.md.template",
  "skills/dev-planner/SKILL.md",
  "skills/dev-planner/references/workflow-generation.md",
  "skills/dev-planner/references/workflow-iteration.md",
  "skills/doc-sync-guardian/references/document-surfaces.md",
  "skills/shape/SKILL.md",
];
const rootBriefPattern = /(^|[^\w/])设计简报\.md/gu;
const violations = [];
for (const relativePath of designBriefSurfaces) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  for (const match of content.matchAll(rootBriefPattern)) {
    const prefix = content.slice(Math.max(0, match.index - 5), match.index + match[0].length);
    if (prefix.includes("docs/设计简报.md")) continue;
    const line = content.slice(0, match.index).split("\n").length;
    violations.push(`${relativePath}:${line}: ${match[0].trim()}`);
  }
}
findings.push(...violations);
assert.deepEqual(findings, [], `新目标项目设计状态必须统一由 docs/设计简报.md 承载：\n${findings.join("\n")}`);

const manifest = JSON.parse(fs.readFileSync(
  path.join(repoRoot, "skills/dev-builder/templates/project-scaffolds/_target-docs/_vibe-docs.json.template"),
  "utf8",
));
assert.equal(manifest.designBrief, "docs/设计简报.md");
assert.equal(manifest.documents.find((entry) => entry.role === "designBrief")?.path, "docs/设计简报.md");

const manifestFirstConsumers = [
  "skills/design-brief-builder/SKILL.md",
  "skills/design-maker/SKILL.md",
  "skills/dev-builder/SKILL.md",
  "skills/dev-planner/SKILL.md",
  "skills/impeccable/SKILL.md",
  "skills/shape/SKILL.md",
];
for (const relativePath of manifestFirstConsumers) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  assert.match(content, /\.vibe-docs\.json/u, `${relativePath} 必须先读取目标项目 manifest`);
  assert.match(content, /designBrief/u, `${relativePath} 必须通过 designBrief 角色解析设计状态`);
}

console.log("Design brief source contract tests passed");
