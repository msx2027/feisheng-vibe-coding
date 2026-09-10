#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const targetRuleFiles = [
  "AGENTS.md",
  ".claude/CLAUDE.md",
  "DOC-MAP.md",
  "DEV-PLAN.md",
  "Product-Spec.md",
  "TERMINOLOGY-AND-NAMING.md",
  "docs/runtime-loading-policy.md",
  "skills/INDEX.md",
  "skills/beginner-flow-guide/references/route-matrix.md",
  "skills/code-review/SKILL.md",
  "skills/dev-builder/SKILL.md",
  "skills/dev-builder/references/development-rules.md",
  "skills/dev-builder/references/development-strategy.md",
  "skills/dev-builder/references/workflow-continuous-development.md",
  "skills/dev-builder/templates/project-scaffolds/_target-docs/文档索引.md.template",
  "skills/dev-builder/templates/project-scaffolds/_target-docs/_vibe-docs.json.template",
  "skills/dev-planner/SKILL.md",
  "skills/dev-planner/references/workflow-generation.md",
  "skills/dev-planner/references/workflow-iteration.md",
  "skills/dev-planner/templates/current-execution-template.md",
  "skills/dev-planner/templates/dev-plan-template.md",
  "skills/dev-planner/templates/phase-detail-template.md",
  "skills/doc-sync-guardian/SKILL.md",
  "skills/doc-sync-guardian/references/document-surfaces.md",
  "skills/product-spec-builder/SKILL.md",
];
const rootPlanPattern = /(^|[^\w/])plans\/(?:执行光标|第[一二三四五六七八九十]+阶段|任务|会话记录|archive|\*)(?:\/|\.md|`)/gu;
const rootDevPlanControlPattern = /(?:默认|保存为|保存更新后的|文件(?:命名)?：|devPlan\s*=|devPlan\s*=\s*)\s*[`"]?开发计划\.md[`"]?/gu;

const violations = [];
for (const relativePath of targetRuleFiles) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  for (const match of content.matchAll(rootPlanPattern)) {
    const line = content.slice(0, match.index).split("\n").length;
    violations.push(`${relativePath}:${line}: ${match[0].trim()}`);
  }
  for (const match of content.matchAll(rootDevPlanControlPattern)) {
    const line = content.slice(0, match.index).split("\n").length;
    violations.push(`${relativePath}:${line}: ${match[0].trim()}`);
  }
}

assert.deepEqual(
  violations,
  [],
  `新目标项目路径不得回落到根 plans/... 或根 开发计划.md：\n${violations.join("\n")}`,
);

const packageDocs = ["AGENTS.md", ".claude/CLAUDE.md", "DOC-MAP.md"]
  .map((relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8"))
  .join("\n");
assert.match(packageDocs, /本分发包自身/u, "必须声明本分发包自身与目标项目的路径边界");
assert.match(packageDocs, /plans\/CURRENT-EXECUTION\.md/u, "必须保留本分发包自身的 plans 真源");

const toolDefaults = [
  ["tools/init-target-constitution.mjs", /currentExecution:\s*"docs\/plans\/执行光标\.md"/u],
  ["tools/init-target-task-context.mjs", /DEFAULT_TASK_ROOT\s*=\s*"docs\/plans\/任务"/u],
  ["tools/update-target-task-state.mjs", /\|\|\s*"docs\/plans\/执行光标\.md"/u],
  ["tools/target-task-continuity-core.mjs", /\|\|\s*"docs\/plans\/执行光标\.md"/u],
];
for (const [relativePath, expectedPattern] of toolDefaults) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  assert.match(content, expectedPattern, `${relativePath} 的新项目缺省路径必须使用 docs/plans/...`);
}

const devPlanSurfaces = [
  ["skills/beginner-flow-guide/references/route-matrix.md", /目标项目开发计划（默认 `docs\/项目治理\/开发计划\.md`/u],
  ["skills/dev-builder/SKILL.md", /目标项目开发计划：[^\n]+默认 `docs\/项目治理\/开发计划\.md`/u],
  ["skills/dev-planner/references/workflow-generation.md", /保存为 `docs\/项目治理\/开发计划\.md`/u],
  ["skills/dev-planner/references/workflow-iteration.md", /保存更新后的 `docs\/项目治理\/开发计划\.md`/u],
  ["skills/dev-planner/templates/dev-plan-template.md", /devPlan = "docs\/项目治理\/开发计划\.md"/u],
];
for (const [relativePath, expectedPattern] of devPlanSurfaces) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  assert.match(content, expectedPattern, `${relativePath} 必须把新项目开发计划映射到 docs/项目治理/开发计划.md`);
}

console.log("Target lifecycle path contract tests passed");
