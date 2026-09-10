#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(relativePath, ...needles) {
  const text = read(relativePath);
  for (const needle of needles) {
    assert(text.includes(needle), `${relativePath} must include ${JSON.stringify(needle)}`);
  }
}

function assertNotIncludes(relativePath, ...needles) {
  const text = read(relativePath);
  for (const needle of needles) {
    assert(!text.includes(needle), `${relativePath} must not retain ${JSON.stringify(needle)}`);
  }
}

const targetDocTemplateRoot = "skills/dev-builder/templates/project-scaffolds/_target-docs";
const targetDocTemplateManifest = JSON.parse(read(`${targetDocTemplateRoot}/_vibe-docs.json.template`));

function targetDocTemplate(role) {
  const documentPath = targetDocTemplateManifest[role];
  assert.equal(typeof documentPath, "string", `target doc manifest must declare ${role}`);
  return `${targetDocTemplateRoot}/${documentPath}.template`;
}

const targetProductSpecTemplate = targetDocTemplate("productSpec");
const targetDevPlanTemplate = targetDocTemplate("devPlan");

const policyDocs = [
  "AGENTS.md",
  ".claude/CLAUDE.md",
  "README.md",
  "Product-Spec.md",
  "DEV-PLAN.md",
  "TERMINOLOGY-AND-NAMING.md",
  "skills/INDEX.md",
  "skills/product-spec-builder/SKILL.md",
  "skills/product-spec-builder/templates/product-spec-template.md",
  "skills/product-spec-builder/references/conversation-strategy.md",
  "skills/product-spec-builder/references/skill-scope.md",
  "skills/product-spec-builder/references/workflow-zero-to-one.md",
  "skills/product-spec-builder/references/workflow-iteration.md",
  "skills/product-spec-builder/references/sufficiency-check.md",
  "skills/product-spec-builder/references/requirement-dimensions.md",
  "skills/dev-planner/SKILL.md",
  "skills/dev-planner/templates/dev-plan-template.md",
  "skills/dev-planner/templates/phase-detail-template.md",
  "skills/dev-planner/templates/current-execution-template.md",
  "skills/dev-planner/references/analysis-dimensions.md",
  "skills/dev-planner/references/workflow-generation.md",
  "skills/dev-planner/references/sufficiency-check.md",
  "skills/dev-builder/SKILL.md",
  "skills/dev-builder/references/workflow-continuous-development.md",
  "skills/dev-builder/references/phase-completion.md",
  "skills/dev-builder/references/development-rules.md",
  targetProductSpecTemplate,
  targetDevPlanTemplate,
  "skills/bug-fixer/SKILL.md",
  "skills/test-automation/SKILL.md",
  "skills/test-automation/references/workflow.md",
  "skills/code-review/SKILL.md",
  "skills/code-review/references/workflow.md",
  "skills/code-review/references/review-dimensions.md",
  "skills/code-review/references/llm-coding-antipatterns.md",
  "agents/implementer.md",
];

const retiredPolicyPhrases = [
  ["验证优先 + ", "渐进" + "测试"].join(""),
  "验证优先，不是 blanket TDD",
  "implement-first-then-verify",
  "不强制先写测试",
  "允许先实现再验证",
  "允许先做出可见结果",
  "implement-first",
  "不适合 test-first",
  "实现后验证",
  "test-first 或回归计划",
  "无法先写的原因",
  "test-first 适用性",
  "确实无法自动化",
  "或无法自动化场景",
  "或无法自动化的例外",
  "用户明确批准不补自动化回归",
];

for (const file of policyDocs) assertNotIncludes(file, ...retiredPolicyPhrases);

const automationExceptionApproval = /(无法自动化|不能自动化)[^。\n]{0,100}(请求用户批准|取得用户明确批准|待用户审批|TDD 例外|审批状态)/;
for (const file of policyDocs) {
  const match = read(file).match(automationExceptionApproval);
  assert(!match, `${file} must block instead of approving an automation-difficulty exception: ${JSON.stringify(match?.[0])}`);
}

for (const file of ["AGENTS.md", ".claude/CLAUDE.md", "README.md", "skills/INDEX.md"]) {
  assertIncludes(file, "严格 TDD", "RED-GREEN-REFACTOR", "用户明确批准");
}

const controlledVisualT1Docs = [
  "AGENTS.md",
  ".claude/CLAUDE.md",
  "README.md",
  "Product-Spec.md",
  "DEV-PLAN.md",
  "TERMINOLOGY-AND-NAMING.md",
  "skills/INDEX.md",
  "skills/product-spec-builder/templates/product-spec-template.md",
  "skills/dev-planner/templates/dev-plan-template.md",
  "skills/dev-builder/SKILL.md",
  targetProductSpecTemplate,
  targetDevPlanTemplate,
  "skills/test-automation/SKILL.md",
  "skills/code-review/SKILL.md",
  "skills/target-runtime-setup/SKILL.md",
  "tools/init-target-runtime.mjs",
];

for (const file of controlledVisualT1Docs) {
  assertIncludes(file, "visual-only T1 受控例外", "既有测试 / visual regression seam", "改前基线", "改后同路径定向视觉证据");
}

for (const file of ["AGENTS.md", ".claude/CLAUDE.md", "Product-Spec.md", "skills/test-automation/SKILL.md", "skills/code-review/SKILL.md"]) {
  assertIncludes(file, "全局 token / theme", "真实业务行为");
}

assertNotIncludes("agents/implementer.md", "visual-only T1 受控例外");

assertNotIncludes(
  "Product-Spec.md",
  "只要会改生产代码，仍须先建立能正确失败的 DOM、组件、视觉回归或其他用户可观察行为测试",
  "项目暂时没有合适测试 seam 时必须先建立 seam",
  "| 最小完成证据 | RED 失败证据 + GREEN 通过证据 + 必要回归 |",
);

assertNotIncludes(
  "skills/dev-planner/SKILL.md",
  "每个 Task 都要列出 RED 测试与预期失败原因、GREEN 最小实现边界、全绿后的 REFACTOR 范围，以及本轮 RED/GREEN fresh 证据",
);

for (const file of ["Product-Spec.md", "skills/dev-planner/SKILL.md"]) {
  assertIncludes(file, "严格 TDD Task", "受控 T1 Task", "副作用检查");
}

for (const file of [
  "skills/product-spec-builder/SKILL.md",
  "skills/product-spec-builder/templates/product-spec-template.md",
  "skills/product-spec-builder/references/sufficiency-check.md",
  "skills/product-spec-builder/references/conversation-strategy.md",
  "skills/dev-planner/SKILL.md",
  "skills/dev-planner/templates/dev-plan-template.md",
  "skills/dev-planner/references/sufficiency-check.md",
  "skills/dev-planner/references/workflow-generation.md",
  "skills/dev-builder/SKILL.md",
  "skills/dev-builder/references/development-rules.md",
  "skills/dev-builder/references/workflow-continuous-development.md",
  targetProductSpecTemplate,
  targetDevPlanTemplate,
]) {
  assertIncludes(file, "边界核对", "副作用检查");
}

assertIncludes(
  "skills/test-automation/SKILL.md",
  "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST",
  "RED - 先写一个最小失败测试",
  "GREEN - 只写让测试通过的最小生产代码",
  "REFACTOR - 只在全绿后整理",
  "原型、生成代码、配置文件",
  "用户明确批准",
);

for (const file of ["skills/dev-builder/SKILL.md", "skills/bug-fixer/SKILL.md", "skills/code-review/SKILL.md"]) {
  assertIncludes(file, "RED-GREEN-REFACTOR", "用户明确批准");
}
assertIncludes("agents/implementer.md", "RED-GREEN-REFACTOR", "RED 失败证据", "GREEN 通过证据", "用户明确批准");

assertIncludes(
  "Product-Spec.md",
  "strict-tdd",
  "严格 TDD",
  "每个新增或改变的可观察行为",
  "RED 失败证据",
  "GREEN 通过证据",
);
assertIncludes("DEV-PLAN.md", "严格 TDD", "RED-GREEN-REFACTOR");
assertIncludes("TERMINOLOGY-AND-NAMING.md", "strict-tdd", "strict_tdd", "严格 TDD");

assertIncludes("tools/vibe-health-check.mjs", "tools/test-strict-tdd-policy.mjs");
assertIncludes("tools/vibe-health-check.mjs", "tools/test-strict-tdd-human-scenarios.mjs");
assertIncludes("tools/test-vibe-health-check.mjs", "tools/test-strict-tdd-policy.mjs");
assertIncludes("tools/test-vibe-health-check.mjs", "tools/test-strict-tdd-human-scenarios.mjs");
assertIncludes(".github/workflows/vibe-quality.yml", "node tools/test-strict-tdd-policy.mjs");
assertIncludes(".github/workflows/vibe-quality.yml", "node tools/test-strict-tdd-human-scenarios.mjs");
assertIncludes("package.json", '"test:tdd-policy": "node tools/test-strict-tdd-policy.mjs"');
assertIncludes("package.json", '"test:tdd-scenarios": "node tools/test-strict-tdd-human-scenarios.mjs"');
assertIncludes("tools/INDEX.md", "test-strict-tdd-policy.mjs");
assertIncludes("tools/INDEX.md", "test-strict-tdd-human-scenarios.mjs");

assert(
  !fs.existsSync(path.join(repoRoot, "skills", "test-driven-development")),
  "strict TDD is integrated into test-automation; do not add a duplicate project skill entry",
);

console.log("Strict TDD policy tests passed");
