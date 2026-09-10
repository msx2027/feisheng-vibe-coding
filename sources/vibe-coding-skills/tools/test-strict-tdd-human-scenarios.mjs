#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import * as targetRuntimeModule from "./init-target-runtime.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const targetRuntimeBlockVersion = targetRuntimeModule.TARGET_RUNTIME_BLOCK_VERSION;

assert.equal(
  typeof targetRuntimeBlockVersion,
  "string",
  "init-target-runtime.mjs must export the current target runtime block version",
);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function requireText(relativePath, text, scenario) {
  assert(read(relativePath).includes(text), `${scenario}: ${relativePath} must require ${JSON.stringify(text)}`);
}

function forbidText(relativePath, text, scenario) {
  assert(!read(relativePath).includes(text), `${scenario}: ${relativePath} must reject ${JSON.stringify(text)}`);
}

const executionRules = [
  "skills/dev-builder/SKILL.md",
  "skills/bug-fixer/SKILL.md",
  "skills/test-automation/SKILL.md",
  "agents/implementer.md",
];

for (const file of executionRules) {
  requireText(file, "删除该实现并从 RED 重新开始", "developer already wrote production code first");
  requireText(file, "测试通过、测试自身报错或失败原因不符时先修测试", "first RED attempt passes or fails incorrectly");
  requireText(file, "无法自动化本身不构成例外资格", "developer asks to skip TDD because automation is hard");
  forbidText(file, "确实无法自动化", "developer asks to skip TDD because automation is hard");
}

function parseReviewPolicy() {
  const source = read("skills/code-review/references/review-profiles.md");
  const match = source.match(/```review-policy-json\s*\n([\s\S]*?)\n```/u);
  assert(match, "review profile machine projection is missing");
  return JSON.parse(match[1]);
}

const reviewPolicy = parseReviewPolicy();

function reviewProfileFor({ tier, triggers = [] }) {
  const base = reviewPolicy.tierProfiles[tier];
  assert(base, `unknown execution tier: ${tier}`);
  if (tier === "T2" && triggers.some((trigger) => reviewPolicy.independentReviewTriggers.includes(trigger))) {
    return "independent-two-stage";
  }
  return base;
}

function isControlledVisualOnlyT1(scenario) {
  return (
    scenario.tier === "T1" &&
    scenario.visualOnlyT1 === true &&
    scenario.hasExistingSeam === false &&
    scenario.boundaryVerified === true &&
    scenario.changesUserPath !== true &&
    scenario.changesInformationHierarchy !== true &&
    scenario.changesResponsiveStructure !== true &&
    scenario.changesGlobalTokensOrTheme !== true &&
    scenario.changesUiPackageContract !== true &&
    scenario.changesBusinessBehavior !== true
  );
}

function evaluateScenario(scenario) {
  const reviewProfile = reviewProfileFor(scenario);
  const controlledVisualOnlyT1 = isControlledVisualOnlyT1(scenario);
  const tddRequired = scenario.productionBehavior === true && !controlledVisualOnlyT1;
  const mayWriteProduction = controlledVisualOnlyT1
    ? scenario.beforeBaselineCaptured === true
    : !tddRequired || scenario.redVerified === true || scenario.approvedException === true;
  const independentReview = ["independent-two-stage", "hazard-review"].includes(reviewProfile);
  const findingsClosed = scenario.openImportantFinding !== true || scenario.reverified === true || scenario.userAcceptedRisk === true;
  const visualEvidenceClosed =
    !controlledVisualOnlyT1 || (scenario.samePathAfterEvidence === true && scenario.sideEffectsChecked === true);
  const tddEvidenceClosed =
    !tddRequired ||
    scenario.approvedException === true ||
    (scenario.redVerified === true && scenario.greenVerified === true && scenario.regressionVerified === true);
  const reviewStagesClosed =
    ["none", "directed-check"].includes(reviewProfile) ||
    (scenario.specStageReceipt === true && scenario.qualityStageReceipt === true);
  const reviewIsolationClosed = !independentReview || scenario.independentReviewerReceipts === true;
  const subagentEvidenceClosed =
    !scenario.triggers?.includes("subagent-implementation") ||
    (scenario.mainAgentDiffChecked === true && scenario.mainAgentVerificationChecked === true);
  const phaseEvidenceClosed =
    !scenario.triggers?.includes("phase-closeout") ||
    (scenario.phaseLedgerReviewed === true && scenario.phaseIntegrationVerified === true);
  const implementationReady = scenario.productionBehavior !== true || (mayWriteProduction && tddEvidenceClosed);
  const mayClose =
    findingsClosed &&
    visualEvidenceClosed &&
    implementationReady &&
    reviewStagesClosed &&
    reviewIsolationClosed &&
    subagentEvidenceClosed &&
    phaseEvidenceClosed;
  return {
    id: scenario.id,
    input: scenario.userText,
    executionTier: scenario.tier,
    reviewProfile,
    controlledVisualOnlyT1,
    tddRequired,
    mayWriteProduction,
    verificationMode: controlledVisualOnlyT1
      ? "before-baseline + same-path-directed-visual-evidence"
      : tddRequired
        ? "red-green-refactor"
        : "directed-check",
    independentReview,
    tddEvidenceClosed,
    reviewStagesClosed,
    reviewIsolationClosed,
    subagentEvidenceClosed,
    phaseEvidenceClosed,
    mayClose,
    decisionSource: "review-policy-json + strict-TDD/visual-only-T1 rules",
  };
}

const scenarioCases = [
  {
    id: "t0-doc-copy",
    userText: "把这句纯说明文字改顺一点",
    tier: "T0",
    productionBehavior: false,
    expected: { reviewProfile: "none", controlledVisualOnlyT1: false, tddRequired: false, mayWriteProduction: true, verificationMode: "directed-check", independentReview: false, mayClose: true },
  },
  {
    id: "t1-visual-existing-seam",
    userText: "把这个按钮颜色改深一点；已有 seam，RED/GREEN 与回归均 fresh 通过",
    tier: "T1",
    productionBehavior: true,
    visualOnlyT1: true,
    hasExistingSeam: true,
    boundaryVerified: true,
    redVerified: true,
    greenVerified: true,
    regressionVerified: true,
    expected: { reviewProfile: "directed-check", controlledVisualOnlyT1: false, tddRequired: true, mayWriteProduction: true, verificationMode: "red-green-refactor", independentReview: false, mayClose: true },
  },
  {
    id: "t1-visual-no-seam-with-baseline",
    userText: "把同一按钮颜色改深一点；项目没有测试或视觉回归 seam",
    tier: "T1",
    productionBehavior: true,
    visualOnlyT1: true,
    hasExistingSeam: false,
    boundaryVerified: true,
    beforeBaselineCaptured: true,
    samePathAfterEvidence: true,
    sideEffectsChecked: true,
    expected: { reviewProfile: "directed-check", controlledVisualOnlyT1: true, tddRequired: false, mayWriteProduction: true, verificationMode: "before-baseline + same-path-directed-visual-evidence", independentReview: false, mayClose: true },
  },
  {
    id: "t1-visual-no-seam-without-baseline",
    userText: "没有测试 seam，也没留改前基线，直接改按钮颜色",
    tier: "T1",
    productionBehavior: true,
    visualOnlyT1: true,
    hasExistingSeam: false,
    boundaryVerified: true,
    beforeBaselineCaptured: false,
    samePathAfterEvidence: false,
    sideEffectsChecked: false,
    expected: { reviewProfile: "directed-check", controlledVisualOnlyT1: true, tddRequired: false, mayWriteProduction: false, verificationMode: "before-baseline + same-path-directed-visual-evidence", independentReview: false, mayClose: false },
  },
  {
    id: "t1-visual-no-seam-unverified-boundary",
    userText: "看起来像纯视觉微调，但没有核对用户路径、响应式或全局 token 边界",
    tier: "T1",
    productionBehavior: true,
    visualOnlyT1: true,
    hasExistingSeam: false,
    beforeBaselineCaptured: true,
    samePathAfterEvidence: true,
    sideEffectsChecked: true,
    expected: { reviewProfile: "directed-check", controlledVisualOnlyT1: false, tddRequired: true, mayWriteProduction: false, verificationMode: "red-green-refactor", independentReview: false, mayClose: false },
  },
  {
    id: "t1-visual-no-seam-without-side-effect-check",
    userText: "有改前和改后截图，但没有检查同容器副作用",
    tier: "T1",
    productionBehavior: true,
    visualOnlyT1: true,
    hasExistingSeam: false,
    boundaryVerified: true,
    beforeBaselineCaptured: true,
    samePathAfterEvidence: true,
    sideEffectsChecked: false,
    expected: { reviewProfile: "directed-check", controlledVisualOnlyT1: true, tddRequired: false, mayWriteProduction: true, verificationMode: "before-baseline + same-path-directed-visual-evidence", independentReview: false, mayClose: false },
  },
  {
    id: "visual-request-crosses-global-theme-boundary",
    userText: "改全局主题 token，让所有按钮颜色变化",
    tier: "T2",
    productionBehavior: true,
    visualOnlyT1: true,
    hasExistingSeam: false,
    changesGlobalTokensOrTheme: true,
    redVerified: false,
    expected: { reviewProfile: "split-self-review", controlledVisualOnlyT1: false, tddRequired: true, mayWriteProduction: false, verificationMode: "red-green-refactor", independentReview: false, mayClose: false },
  },
  {
    id: "ordinary-t2-state-logic",
    userText: "实现普通状态逻辑，最小 RED 已正确失败",
    tier: "T2",
    productionBehavior: true,
    redVerified: true,
    expected: { reviewProfile: "split-self-review", controlledVisualOnlyT1: false, tddRequired: true, mayWriteProduction: true, verificationMode: "red-green-refactor", independentReview: false, mayClose: false },
  },
  {
    id: "ordinary-t2-complete",
    userText: "普通状态逻辑已完成 RED/GREEN/回归，并分别完成 Spec 与 Quality 自审",
    tier: "T2",
    productionBehavior: true,
    redVerified: true,
    greenVerified: true,
    regressionVerified: true,
    specStageReceipt: true,
    qualityStageReceipt: true,
    expected: { reviewProfile: "split-self-review", controlledVisualOnlyT1: false, tddRequired: true, mayWriteProduction: true, verificationMode: "red-green-refactor", independentReview: false, mayClose: true },
  },
  {
    id: "subagent-t2",
    userText: "子 Agent 已实现普通 T2，主 Agent 准备收口",
    tier: "T2",
    triggers: ["subagent-implementation"],
    productionBehavior: true,
    redVerified: true,
    expected: { reviewProfile: "independent-two-stage", controlledVisualOnlyT1: false, tddRequired: true, mayWriteProduction: true, verificationMode: "red-green-refactor", independentReview: true, mayClose: false },
  },
  {
    id: "subagent-t2-complete",
    userText: "子 Agent 实现后，主 Agent 已检查 diff 与验证证据，GREEN/回归和独立双审均完成",
    tier: "T2",
    triggers: ["subagent-implementation"],
    productionBehavior: true,
    redVerified: true,
    greenVerified: true,
    regressionVerified: true,
    specStageReceipt: true,
    qualityStageReceipt: true,
    independentReviewerReceipts: true,
    mainAgentDiffChecked: true,
    mainAgentVerificationChecked: true,
    expected: { reviewProfile: "independent-two-stage", controlledVisualOnlyT1: false, tddRequired: true, mayWriteProduction: true, verificationMode: "red-green-refactor", independentReview: true, mayClose: true },
  },
  {
    id: "phase-closeout",
    userText: "每个 Task 单测都绿了，现在结束 Phase",
    tier: "T2",
    triggers: ["phase-closeout"],
    productionBehavior: false,
    expected: { reviewProfile: "independent-two-stage", controlledVisualOnlyT1: false, tddRequired: false, mayWriteProduction: true, verificationMode: "directed-check", independentReview: true, mayClose: false },
  },
  {
    id: "phase-closeout-complete",
    userText: "Phase ledger、累计 diff、跨 Task 集成验证和独立双阶段 receipt 均已完成",
    tier: "T2",
    triggers: ["phase-closeout"],
    productionBehavior: false,
    specStageReceipt: true,
    qualityStageReceipt: true,
    independentReviewerReceipts: true,
    phaseLedgerReviewed: true,
    phaseIntegrationVerified: true,
    expected: { reviewProfile: "independent-two-stage", controlledVisualOnlyT1: false, tddRequired: false, mayWriteProduction: true, verificationMode: "directed-check", independentReview: true, mayClose: true },
  },
  {
    id: "important-fixed-not-reverified",
    userText: "Important 已修，未复审，直接宣布完成",
    tier: "T3",
    productionBehavior: false,
    openImportantFinding: true,
    expected: { reviewProfile: "independent-two-stage", controlledVisualOnlyT1: false, tddRequired: false, mayWriteProduction: true, verificationMode: "directed-check", independentReview: true, mayClose: false },
  },
  {
    id: "automation-hard-no-red",
    userText: "测试很难，先实现以后再补",
    tier: "T2",
    productionBehavior: true,
    redVerified: false,
    expected: { reviewProfile: "split-self-review", controlledVisualOnlyT1: false, tddRequired: true, mayWriteProduction: false, verificationMode: "red-green-refactor", independentReview: false, mayClose: false },
  },
];

const decisionReceipts = scenarioCases.map((scenario) => {
  const receipt = evaluateScenario(scenario);
  assert.deepEqual(
    {
      reviewProfile: receipt.reviewProfile,
      controlledVisualOnlyT1: receipt.controlledVisualOnlyT1,
      tddRequired: receipt.tddRequired,
      mayWriteProduction: receipt.mayWriteProduction,
      verificationMode: receipt.verificationMode,
      independentReview: receipt.independentReview,
      mayClose: receipt.mayClose,
    },
    scenario.expected,
    scenario.id,
  );
  return receipt;
});

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "strict-tdd-human-"));
try {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "tools", "init-target-runtime.mjs"), tempRoot, "--skills-root", repoRoot, "--write", "--json"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const agents = fs.readFileSync(path.join(tempRoot, "AGENTS.md"), "utf8");
  const claude = fs.readFileSync(path.join(tempRoot, "CLAUDE.md"), "utf8");
  const registry = JSON.parse(fs.readFileSync(path.join(tempRoot, ".vibe-runtime.json"), "utf8"));
  for (const [runtime, content] of [["AGENTS", agents], ["CLAUDE", claude]]) {
    assert(content.includes("严格 TDD：生产代码的新功能、bug 修复、重构和行为变更强制 `RED-GREEN-REFACTOR`"), `${runtime} target runtime lacks strict TDD`);
    assert(content.includes("原型、生成代码、配置文件只有用户明确批准可例外"), `${runtime} target runtime lacks bounded exception approval`);
    assert(content.includes("visual-only T1 受控例外"), `${runtime} target runtime lacks controlled visual-only T1 policy`);
    assert(content.includes("既有测试 / visual regression seam"), `${runtime} target runtime drops the existing-seam TDD boundary`);
    assert(content.includes("改前基线"), `${runtime} target runtime lacks before-change baseline evidence`);
    assert(content.includes("改后同路径定向视觉证据"), `${runtime} target runtime lacks same-path after-change evidence`);
    assert(content.includes("全局 token / theme"), `${runtime} target runtime lacks the visual-only T1 exit boundary`);
    assert(content.includes("审查分层：先判 `execution tier`，再独立计算 `review profile`"), `${runtime} target runtime lacks orthogonal review policy`);
    assert(content.includes("T2 必须把 `Spec Compliance` 与 `Code Quality` 分成两个阶段"), `${runtime} target runtime lacks split review stages`);
    assert(content.includes("跨至少 3 个模块"), `${runtime} target runtime drops the independent-review module threshold`);
    assert(content.includes("子 Agent 的 `DONE` 不是完成证据"), `${runtime} target runtime accepts implementer DONE as completion`);
    assert(content.includes("Critical / Important finding"), `${runtime} target runtime lacks finding closure`);
    assert(content.includes("Phase 收口"), `${runtime} target runtime lacks phase integration review`);
  }
  assert.equal(registry.runtimeBlocks["AGENTS.md"].version, targetRuntimeBlockVersion);
  assert.equal(registry.runtimeBlocks["CLAUDE.md"].version, targetRuntimeBlockVersion);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
  assert(!fs.existsSync(tempRoot), `temporary human-scenario project was not removed: ${tempRoot}`);
}

for (const receipt of decisionReceipts) console.log(JSON.stringify(receipt));
console.log(`Review × strict TDD policy scenarios passed (${decisionReceipts.length} policy decisions + 1 external target runtime)`);
