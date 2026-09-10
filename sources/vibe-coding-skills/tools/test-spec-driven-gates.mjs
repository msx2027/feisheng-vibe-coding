#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function isPurePackage() {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "MANIFEST.json"), "utf8")).profile === "pure";
  } catch {
    return false;
  }
}

if (isPurePackage()) {
  console.log("[SKIP] spec-driven source gate is not part of the pure runtime package");
  process.exit(0);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireText(relativePath, ...needles) {
  const content = read(relativePath);
  for (const needle of needles) {
    try {
      assert.ok(content.includes(needle), `${relativePath} must include ${JSON.stringify(needle)}`);
    } catch (error) {
      failures.push(error.message);
    }
  }
}

function forbidText(relativePath, ...needles) {
  const content = read(relativePath);
  for (const needle of needles) {
    try {
      assert.ok(!content.includes(needle), `${relativePath} must not own ${JSON.stringify(needle)}`);
    } catch (error) {
      failures.push(error.message);
    }
  }
}

requireText(
  "skills/product-spec-builder/SKILL.md",
  "需求澄清记录",
  "影响行为、验收、数据、权限、接口或范围",
  "不得进入计划",
);
requireText(
  "skills/product-spec-builder/templates/product-spec-template.md",
  "## 需求澄清记录",
  "问题 | 决策 | 依据 | 影响范围 | 状态",
  "未决",
);
requireText(
  "skills/dev-planner/SKILL.md",
  "预实现一致性分析",
  "需求、验收标准、术语、接口契约、测试策略、Phase/Task 映射与依赖顺序",
  "Critical / Important",
  "不得进入生产代码",
);
requireText(
  "skills/dev-planner/templates/dev-plan-template.md",
  "## 预实现一致性分析",
  "sourceRevision",
  "分析证据",
  "分析结论",
  "阻断项",
);
requireText(
  "skills/dev-planner/templates/phase-detail-template.md",
  "sourceRevision",
  "分析证据",
  "分析结论",
  "阻断项",
);
requireText(
  "tools/init-target-task-context.mjs",
  "一致性分析回执",
  "sourceRevision",
  "分析证据",
  "分析结论",
  "阻断项",
  "不成为第二份计划真源",
);
requireText(
  "skills/dev-builder/SKILL.md",
  "T2/T3",
  "首个 RED",
  "分析 PASS",
  "收敛检查",
  "Get-Command bash",
  '"<skills-root>/tools/render-project-scaffold.sh"',
);
forbidText("skills/dev-builder/SKILL.md", "bash ./tools/render-project-scaffold.sh");
requireText(
  "docs/language-platform-profiles.md",
  "## 验证选择矩阵",
  "优先运行项目已有的 build / typecheck / lint / test / smoke 脚本",
  "没有现成脚本时才按 language adapter",
  "不适用 + 原因",
  "Windows PowerShell",
);
requireText(
  "skills/dev-builder/references/development-rules.md",
  "最小自动门禁由当前 platform profile、language adapter 和项目已有脚本决定",
  "TypeScript 项目才检查",
  "Get-Command bash",
);
requireText(
  "skills/dev-builder/references/phase-completion.md",
  "Web / service",
  "CLI",
  "Library",
  "Invoke-WebRequest",
  "Get-Command bash",
  "不适用 + 原因",
);
forbidText(
  "skills/dev-builder/references/phase-completion.md",
  "`bash ./tools/check-project-structure.sh",
  "`bash ./tools/check-terminology-consistency.sh",
  "API endpoint 用 curl",
  "grep 检查",
  "安全扫描：npm audit 无 critical 漏洞",
  "启动 dev server，确认无错误输出",
);
requireText(
  "skills/code-review/references/workflow.md",
  "按 platform profile、language adapter 和项目已有脚本执行 build / typecheck / lint / test",
);
forbidText("skills/code-review/references/workflow.md", "编译验证：tsc --noEmit", "grep 检查危险模式");
requireText("agents/implementer.md", "构建 / 编译 / 静态检查结果", "按 architecture profile 选择的功能验证");
forbidText("agents/implementer.md", "**编译结果**：tsc --noEmit 输出", "**功能验证**：启动项目后的验证结果");
requireText("skills/dev-builder/references/output-style.md", "按当前项目实际验证链路");
forbidText(
  "skills/dev-builder/references/output-style.md",
  "Phase 3 交付清单 5 项已全部实现，tsc --noEmit 零错误，dev server 正常启动。",
);
requireText(
  "skills/brand/SKILL.md",
  "```powershell",
  'node "<skills-root>/skills/brand/scripts/inject-brand-context.cjs"',
  '"<asset-path>"',
  "Select-Object -First 20",
);
forbidText("skills/brand/SKILL.md", "```bash", "node skills/brand/scripts/", "head -20");
requireText(
  "skills/target-constitution-setup/SKILL.md",
  'node "<skills-root>/tools/check-target-doc-names.mjs" "<target-root>" --require-existing',
  'node "<skills-root>/tools/build-target-doc-index.mjs" "<target-root>" --write',
);
forbidText(
  "skills/target-constitution-setup/SKILL.md",
  "`check:docs`",
  "再运行 `check-target-doc-names.mjs <target-root> --require-existing`",
);
requireText(
  "skills/target-runtime-setup/SKILL.md",
  'node "<skills-root>/tools/check-target-doc-names.mjs" "<target-root>" --require-existing',
  'node "<skills-root>/tools/build-target-doc-index.mjs" "<target-root>" --check',
);
forbidText(
  "skills/target-runtime-setup/SKILL.md",
  "再运行 `check-target-doc-names.mjs <target-root> --require-existing`",
);
requireText(
  "skills/code-review/SKILL.md",
  "交付收敛检查",
  "需求、计划、Task",
  "回写既有计划/Phase Task",
  "重新进入 RED-GREEN-REFACTOR",
);
requireText(
  "agents/implementer.md",
  "预实现一致性分析",
  "首个 RED",
  "交付收敛检查",
);
requireText(
  "agents/code-reviewer.md",
  "交付收敛检查",
  "未计划或未实现缺口",
);
requireText(
  "AGENTS.md",
  "需求澄清门",
  "预实现一致性分析",
  "交付收敛检查",
);
requireText(
  ".claude/CLAUDE.md",
  "T2/T3：需求澄清门 -> 新项目和高影响变更先走 `architecture-foundation` 开工前架构地基并取得 PASS -> 预实现一致性分析 -> 交付收敛检查；T0/T1 快车道不变。",
);
requireText(
  "README.md",
  "需求澄清门",
  "预实现一致性分析",
  "交付收敛检查",
);
requireText(
  "skills/INDEX.md",
  "需求澄清门",
  "预实现一致性分析",
  "交付收敛检查",
);
requireText(
  "package.json",
  '"test:spec-driven-gates"',
  "node tools/test-spec-driven-gates.mjs && node tools/vibe-health-check.mjs",
);
requireText(".github/workflows/vibe-quality.yml", "node tools/test-spec-driven-gates.mjs");
forbidText("skills/clarify/SKILL.md", "需求澄清记录", "预实现一致性分析", "交付收敛检查");

if (failures.length > 0) {
  console.error("[FAIL] spec-driven gate policy is incomplete:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("[PASS] spec-driven gate policy is complete.");
}
