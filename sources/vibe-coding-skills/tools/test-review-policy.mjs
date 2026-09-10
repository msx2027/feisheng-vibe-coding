#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);

function absolute(relativePath) {
  return path.join(repoRoot, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), "utf8");
}

function assertExists(relativePath) {
  assert(fs.existsSync(absolute(relativePath)), `${relativePath} must exist`);
}

function assertIncludes(relativePath, ...needles) {
  const content = read(relativePath);
  for (const needle of needles) {
    assert(content.includes(needle), `${relativePath} must include ${JSON.stringify(needle)}`);
  }
}

function parseMachinePolicy(content) {
  const match = content.match(/```review-policy-json\s*\n([\s\S]*?)\n```/u);
  assert(match, "review-profiles.md must contain one review-policy-json block");
  return JSON.parse(match[1]);
}

function canTransition(
  policy,
  {
    from,
    to,
    severity = "minor",
    userAccepted = false,
    userAcceptanceEvidence = "",
    resolution = "",
    evidence = "",
    reverificationEvidence = "",
    newRound = false,
    invalidationEvidence = "",
  },
) {
  const allowed = policy.transitions[from] || [];
  if (!allowed.includes(to)) return false;
  if (policy.constraints.nonOpenRequiresResolution && to !== "open" && resolution.trim() === "") return false;
  if (from === "reverified" && to === "fixing") {
    if (policy.constraints.reopenReverifiedRequiresNewRound && newRound !== true) return false;
    if (policy.constraints.reopenReverifiedRequiresInvalidationEvidence && invalidationEvidence.trim() === "") return false;
  }
  if (to === "accepted-risk") {
    if (policy.constraints.acceptedRiskRequiresUser && userAccepted !== true) return false;
    if (policy.constraints.acceptedRiskRequiresUserEvidence && userAcceptanceEvidence.trim() === "") return false;
    return true;
  }
  if (to === "deferred") return policy.constraints.deferredSeverities.includes(severity) && resolution.trim() !== "";
  if (to === "rejected-with-reason") {
    if (resolution.trim() === "") return false;
    return !policy.constraints.rejectedWithReasonRequiresEvidence || evidence.trim() !== "";
  }
  if (to === "reverified") {
    return !policy.constraints.reverifiedRequiresFreshEvidence || reverificationEvidence.trim() !== "";
  }
  return true;
}

function selectReviewProfile(policy, { tier, triggers = [] }) {
  const base = policy.tierProfiles[tier];
  assert(base, `unknown execution tier: ${tier}`);
  if (tier === "T2" && triggers.some((trigger) => policy.independentReviewTriggers.includes(trigger))) {
    return "independent-two-stage";
  }
  return base;
}

function section(content, start, end) {
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end, startIndex + start.length);
  assert(startIndex >= 0 && endIndex > startIndex, `missing bounded section ${start} -> ${end}`);
  return content.slice(startIndex, endIndex);
}

function assertRuntimeT2Policy(content) {
  const ordinaryT2Lines = content.split(/\r?\n/u).filter((line) => line.includes("普通 T2"));
  assert(ordinaryT2Lines.some((line) => line.includes("split-self-review")), "runtime policy must require T2 split-self-review");
  const stale = ordinaryT2Lines.filter(
    (line) => /(只需要|只需)/u.test(line) && !line.includes("split-self-review"),
  );
  assert.deepEqual(stale, [], `runtime policy retains validation-only T2 rule: ${stale.join(" | ")}`);
}

const protocolPath = "skills/code-review/references/review-profiles.md";
assertExists(protocolPath);
const protocolText = read(protocolPath);
const machinePolicy = parseMachinePolicy(protocolText);

assert.deepEqual(machinePolicy.tierProfiles, {
  T0: "none",
  T1: "directed-check",
  T2: "split-self-review",
  T3: "independent-two-stage",
  "T3+": "hazard-review",
});
assert.deepEqual(machinePolicy.stageRequirements.T2, ["spec", "quality"]);
assert.deepEqual(machinePolicy.constraints.implementerThreshold, {
  minimumModules: 3,
  minimumFiles: 5,
  operator: "and",
});
assert.equal(machinePolicy.constraints.acceptedRiskRequiresUser, true);
assert.equal(machinePolicy.constraints.acceptedRiskRequiresUserEvidence, true);
assert.equal(machinePolicy.constraints.reverifiedRequiresFreshEvidence, true);
assert.equal(machinePolicy.constraints.rejectedWithReasonRequiresEvidence, true);
assert.equal(machinePolicy.constraints.nonOpenRequiresResolution, true);
assert.equal(machinePolicy.constraints.reopenReverifiedRequiresNewRound, true);
assert.equal(machinePolicy.constraints.reopenReverifiedRequiresInvalidationEvidence, true);
assert.equal(machinePolicy.roles.reviewer.readOnly, true);
assert.equal(machinePolicy.roles.reviewer.canModifyCode, false);
assert.equal(machinePolicy.roles.reviewer.canWriteLedger, false);
assert.equal(machinePolicy.roles.reviewer.canSpawnReviewer, false);
assert.equal(machinePolicy.roles.mainAgent.writesLedger, true);

for (const transition of [
  ["open", "fixing"],
  ["fixing", "fixed"],
  ["fixed", "fixing"],
]) {
  assert.equal(canTransition(machinePolicy, { from: transition[0], to: transition[1], resolution: "round action" }), true);
}
assert.equal(canTransition(machinePolicy, { from: "fixing", to: "fixed" }), false);
assert.equal(canTransition(machinePolicy, { from: "fixed", to: "reverified" }), false);
assert.equal(
  canTransition(machinePolicy, {
    from: "fixed",
    to: "reverified",
    resolution: "implemented the bounded fix",
    reverificationEvidence: "Quality Reviewer round 3 fresh receipt",
  }),
  true,
);
for (const transition of [
  ["open", "fixed"],
  ["fixing", "reverified"],
]) {
  assert.equal(canTransition(machinePolicy, { from: transition[0], to: transition[1] }), false);
}
assert.equal(canTransition(machinePolicy, { from: "reverified", to: "fixing", resolution: "new diff invalidated evidence" }), false);
assert.equal(
  canTransition(machinePolicy, {
    from: "reverified",
    to: "fixing",
    resolution: "new diff invalidated evidence",
    newRound: true,
  }),
  false,
);
assert.equal(
  canTransition(machinePolicy, {
    from: "reverified",
    to: "fixing",
    resolution: "new diff invalidated evidence",
    newRound: true,
    invalidationEvidence: "round 4 diff touches the affected contract",
  }),
  true,
);
assert.equal(canTransition(machinePolicy, { from: "fixed", to: "accepted-risk" }), false);
assert.equal(canTransition(machinePolicy, { from: "fixed", to: "accepted-risk", userAccepted: true }), false);
assert.equal(
  canTransition(machinePolicy, {
    from: "fixed",
    to: "accepted-risk",
    resolution: "user accepts the documented compatibility risk",
    userAccepted: true,
    userAcceptanceEvidence: "User explicitly accepted RP-001 in the current task",
  }),
  true,
);

assert.equal(selectReviewProfile(machinePolicy, { tier: "T0" }), "none");
assert.equal(selectReviewProfile(machinePolicy, { tier: "T1" }), "directed-check");
assert.equal(selectReviewProfile(machinePolicy, { tier: "T2" }), "split-self-review");
for (const trigger of [
  "public-contract",
  "modules-at-least-3",
  "files-at-least-5-with-business-logic",
  "subagent-implementation",
  "requirements-or-plan-changed",
  "same-fix-failed-at-least-2-times",
  "manual-acceptance-path",
  "phase-closeout",
  "release-or-merge",
  "automation-incomplete",
  "tier-risk-mismatch",
]) {
  assert.equal(
    selectReviewProfile(machinePolicy, { tier: "T2", triggers: [trigger] }),
    "independent-two-stage",
    `${trigger} must upgrade T2 review isolation`,
  );
}
assert.equal(canTransition(machinePolicy, { from: "open", to: "deferred", severity: "important", resolution: "later" }), false);
assert.equal(canTransition(machinePolicy, { from: "open", to: "deferred", severity: "minor", resolution: "Phase 2" }), true);
assert.equal(canTransition(machinePolicy, { from: "open", to: "rejected-with-reason", resolution: "duplicate" }), false);
assert.equal(
  canTransition(machinePolicy, {
    from: "open",
    to: "rejected-with-reason",
    resolution: "duplicate of F-001",
    evidence: "same affected range and root cause",
  }),
  true,
);

assert.throws(
  () => assertRuntimeT2Policy("- 普通 T2 只需要短计划、定向验证和 T2 check snapshot。"),
  /split-self-review/u,
);
assertRuntimeT2Policy(read("docs/runtime-loading-policy.md"));

const workflowText = read("skills/code-review/references/workflow.md");
const workflowSpec = section(workflowText, "[第三步：逐项比对]", "[第四步：Code Quality + 安全审查]");
const workflowQuality = section(workflowText, "[第四步：Code Quality + 安全审查]", "[第五步：输出审查报告与 ledger delta]");
assert(!workflowSpec.includes("运用 [测试与验证策略一致性]"), "Spec stage must not execute the test-quality dimension");
assert(workflowSpec.includes("留给 Quality stage"), "Spec stage must explicitly hand strict-TDD chronology to Quality");
assert(workflowQuality.includes("[测试与验证策略一致性]") && workflowQuality.includes("正确 RED"), "Quality stage must own strict-TDD chronology review");

const dimensionsText = read("skills/code-review/references/review-dimensions.md");
const dimensionsSpec = section(dimensionsText, "--- Stage 1: Spec Compliance", "--- Stage 2: Code Quality");
const dimensionsQuality = dimensionsText.slice(dimensionsText.indexOf("--- Stage 2: Code Quality"));
assert(!dimensionsSpec.includes("[测试与验证策略一致性]"), "Spec dimensions must not own test-quality review");
assert(dimensionsQuality.includes("[测试与验证策略一致性]"), "Quality dimensions must own test-quality review");

assertIncludes(
  protocolPath,
  "none",
  "directed-check",
  "split-self-review",
  "independent-two-stage",
  "hazard-review",
  "execution tier",
  "review profile",
  "T0",
  "T1",
  "T2",
  "T3",
  "T3+",
  "Spec Compliance",
  "Code Quality",
);

for (const trigger of [
  "auth",
  "permission",
  "secret",
  "payment",
  "database",
  "migration",
  "公共 API",
  "IPC",
  "event channel",
  "schema",
  "server action",
  "service/public entry",
  "至少 3 个模块",
  "至少 5 个文件",
  "子 Agent",
  "需求或计划发生变化",
  "失败至少两次",
  "已经人工验收",
  "Phase 收口",
  "自动化测试不能完全证明",
  "风险信号不匹配",
]) {
  assertIncludes(protocolPath, trigger);
}

for (const field of [
  "findingId",
  "reviewStage",
  "severity",
  "evidence",
  "affectedFiles",
  "status",
  "resolution",
  "reverificationEvidence",
]) {
  assertIncludes(protocolPath, field);
}

for (const status of [
  "open",
  "fixing",
  "fixed",
  "reverified",
  "accepted-risk",
  "deferred",
  "rejected-with-reason",
]) {
  assertIncludes(protocolPath, status);
}

assertIncludes(
  protocolPath,
  "Critical",
  "Important",
  "Minor",
  "用户明确接受风险",
  "只读",
  "不得递归派发 Reviewer",
  "两轮",
  "根因",
  "最小审查包",
  "Review Receipt",
  "Phase ledger",
  "实现者 DONE",
);

for (const entry of ["AGENTS.md", ".claude/CLAUDE.md"]) {
  assertIncludes(
    entry,
    "execution tier",
    "review profile",
    "T0=`none`",
    "T1=`directed-check`",
    "T2=`split-self-review`",
    "T3=`independent-two-stage`",
    "T3+=`hazard-review`",
    "T0/T1 快车道",
  );
  assertIncludes(entry, "跨至少 3 个模块");
  assert(!read(entry).includes("跨模块、公共契约"), `${entry} must not upgrade every cross-module T2 task`);
}

assertIncludes(
  "skills/code-review/SKILL.md",
  "references/review-profiles.md",
  "Spec Compliance",
  "Code Quality",
  "finding ledger",
  "Review Receipt",
);
assertIncludes(
  "agents/code-reviewer.md",
  "reviewStage",
  "spec",
  "quality",
  "只读",
  "不得递归派发 Reviewer",
  "Finding Ledger Delta",
);
assertIncludes(
  "agents/implementer.md",
  "DONE",
  "不等于完成证据",
  "主 Agent",
  "有界 diff",
);
assertIncludes(
  "skills/dev-builder/references/phase-completion.md",
  "Phase ledger",
  "跨 Task",
  "独立 Spec",
  "独立 Quality",
);
assertIncludes(
  "skills/doc-sync-guardian/SKILL.md",
  "review profile",
  "finding ledger",
  "Review Receipt",
  "snapshot 不等于",
);
for (const gateDoc of ["hooks/INDEX.md", "codex-hooks/INDEX.md", "tools/INDEX.md"]) {
  assertIncludes(gateDoc, "split-self-review", "snapshot", "finding ledger");
}

for (const sourceDoc of [
  "README.md",
  "DOC-MAP.md",
  "Product-Spec.md",
  "DEV-PLAN.md",
  "TERMINOLOGY-AND-NAMING.md",
  "skills/INDEX.md",
  "agents/INDEX.md",
]) {
  assertIncludes(sourceDoc, "review profile");
}

assertIncludes("package.json", '"test:review-policy": "node tools/test-review-policy.mjs"');
assertIncludes("tools/vibe-health-check.mjs", "tools/test-review-policy.mjs");
assertIncludes("tools/test-vibe-health-check.mjs", "tools/test-review-policy.mjs");
assertIncludes(".github/workflows/vibe-quality.yml", "node tools/test-review-policy.mjs");
assertIncludes("tools/INDEX.md", "test-review-policy.mjs");

// This change must coexist with the repository's current strict-TDD baseline.
for (const file of ["AGENTS.md", ".claude/CLAUDE.md", "skills/dev-builder/SKILL.md"]) {
  assertIncludes(file, "严格 TDD", "RED-GREEN-REFACTOR");
}

console.log("Review policy tests passed");
