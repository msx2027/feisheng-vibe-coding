#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireText(relativePath, ...needles) {
  let content = "";
  try {
    content = read(relativePath);
  } catch (error) {
    failures.push(`${relativePath} must exist: ${error.message}`);
    return;
  }
  for (const needle of needles) {
    try {
      assert.ok(content.includes(needle), `${relativePath} must include ${JSON.stringify(needle)}`);
    } catch (error) {
      failures.push(error.message);
    }
  }
}

async function verifyTriggerPolicy() {
  let policy;
  try {
    policy = await import("./architecture-foundation-policy.mjs");
  } catch (error) {
    failures.push(`architecture-foundation trigger policy must exist: ${error.message}`);
    return;
  }

  const scenarios = [
    ["新项目触发", { isNewProject: true, tier: "T2", ordinarySingleModule: false, changes: [] }, true],
    ["跨模块触发", { isNewProject: false, tier: "T2", ordinarySingleModule: false, changes: ["modules-at-least-2"] }, true],
    ["数据变化触发", { isNewProject: false, tier: "T2", ordinarySingleModule: false, changes: ["data"] }, true],
    ["接口变化触发", { isNewProject: false, tier: "T2", ordinarySingleModule: false, changes: ["interface"] }, true],
    ["权限变化触发", { isNewProject: false, tier: "T2", ordinarySingleModule: false, changes: ["permission"] }, true],
    ["部署变化触发", { isNewProject: false, tier: "T2", ordinarySingleModule: false, changes: ["deploy"] }, true],
    ["技术栈变化触发", { isNewProject: false, tier: "T2", ordinarySingleModule: false, changes: ["stack"] }, true],
    ["架构变化触发", { isNewProject: false, tier: "T2", ordinarySingleModule: false, changes: ["architecture"] }, true],
    ["T0 不触发", { isNewProject: true, tier: "T0", ordinarySingleModule: false, changes: ["data"] }, false],
    ["T1 不触发", { isNewProject: true, tier: "T1", ordinarySingleModule: false, changes: ["interface"] }, false],
    ["单模块普通功能不触发", { isNewProject: false, tier: "T2", ordinarySingleModule: true, changes: [] }, false],
    ["新项目即使单模块也触发", { isNewProject: true, tier: "T2", ordinarySingleModule: true, changes: [] }, true],
    ["单模块数据变化也触发", { isNewProject: false, tier: "T2", ordinarySingleModule: true, changes: ["data"] }, true],
  ];
  for (const [name, input, expected] of scenarios) {
    try {
      assert.equal(policy.requiresArchitectureFoundation(input), expected, `${name} must evaluate to ${expected}`);
    } catch (error) {
      failures.push(error.message);
    }
  }
}

requireText(
  "skills/architecture-foundation/SKILL.md",
  "architecture-foundation",
  "新项目",
  "新项目强制进入",
  "跨两个以上模块边界",
  "数据、接口、权限、部署或技术栈",
  "T0/T1 与单模块普通功能不触发",
  "不得进入开发计划或生产代码",
  "用户确认",
  "过期",
);
requireText(
  "skills/INDEX.md",
  "architecture-foundation",
  "开工前架构地基",
);
requireText(
  "skills/ROUTING-MANIFEST.json",
  '"id":"architecture-foundation"',
);
requireText(
  "skills/product-spec-builder/SKILL.md",
  "architecture-foundation",
  "开工前架构地基",
);
requireText(
  "skills/dev-planner/SKILL.md",
  "architecture-foundation",
  "地基 PASS",
  "T0/T1 快车道及单模块普通功能不执行本门",
);
requireText(
  "skills/dev-builder/SKILL.md",
  "architecture-foundation",
  "地基 PASS",
  "T0/T1 快车道及单模块普通功能不执行本门",
);
requireText(
  "AGENTS.md",
  "architecture-foundation",
  "开工前架构地基",
);
requireText(
  ".claude/CLAUDE.md",
  "architecture-foundation",
  "开工前架构地基",
);
requireText(
  "package.json",
  '"test:architecture-foundation"',
  "tools/test-architecture-foundation.mjs",
);
requireText("tools/vibe-health-check.mjs", '"tools/test-architecture-foundation.mjs"');
requireText(".github/workflows/vibe-quality.yml", "node tools/test-architecture-foundation.mjs");
requireText("tools/architecture-foundation-policy.mjs", "requiresArchitectureFoundation", "modules-at-least-2");
requireText("Product-Spec.md", "开工前架构地基", "architecture-foundation");
requireText("DEV-PLAN.md", "开工前架构地基", "系统架构.md");
requireText("TERMINOLOGY-AND-NAMING.md", "开工前架构地基", "architecture_foundation");
requireText("README.md", "开工前架构地基", "architecture-foundation");
requireText("tools/INDEX.md", "test-architecture-foundation.mjs", "开工前架构地基");

await verifyTriggerPolicy();

if (failures.length > 0) {
  console.error("[FAIL] architecture-foundation policy is incomplete:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("[PASS] architecture-foundation policy is complete.");
}
