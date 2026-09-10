#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function content(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

const packageManifest = JSON.parse(content("MANIFEST.json"));
assert.ok(["safe-lite", "pure"].includes(packageManifest.profile), "MANIFEST.json must declare a known package profile");

function includesAll(relative, values) {
  const source = content(relative);
  for (const value of values) {
    assert.ok(source.includes(value), `${relative} missing contract text: ${value}`);
  }
}

function includesAllForPublishedProfile(relative, values) {
  if (fs.existsSync(path.join(root, relative))) {
    includesAll(relative, values);
    return;
  }
  assert.equal(packageManifest.profile, "pure", `${relative} is required outside the pure distribution profile`);
  assert.ok(
    packageManifest.exclude?.profilePaths?.includes(relative),
    `MANIFEST.json must record pure-profile omission of ${relative}`,
  );
}

includesAll("skills/experience-elevator/SKILL.md", [
  "docs/项目治理/经验治理.md",
  "eventId",
  "experience-governance.mjs",
  "target-experience-registry",
  "target-experience-projection",
  "用户确认凭据",
  "L3→L2→L1",
  "checker",
  "occurredAt",
  "consumedConfirmations",
  "canonical fields",
  "registrationFiles",
  "fromTier",
  "toTier",
  "只接受 `node <checkerPath> [checker args]`",
  "type/path/entry/command",
  "不接受 `registrationUpdates`",
  "双向 exact 且顺序一致",
  "完整 canonical match-set",
  "同一路径允许不同 entry",
  "lowercase canonical token",
  "大小写敏感",
  "fresh match-set",
  "零 match",
  "l1RegistryAnchor",
  "adopt-anchor",
  "L0 anchor → current L1 registry → expected L2 projections/runtime registry",
  "UserPromptSubmit Hook",
  "autoRecord",
  "自动判断并记录 L0",
  "不得自动升级 L1/L2/L3",
  "一次性偏好或证据不足时跳过",
  "不引入签名系统",
  "有序 multiset",
  "canonical command-word tokenizer",
]);

includesAll("skills/experience-elevator/references/ledger-and-elevation.md", [
  "结构化、确定性删除",
  "package script key",
  "workflow run entry",
  "Hook/test line",
  "不接受 `registrationUpdates`",
  "双向 exact 且顺序一致",
  "完整 canonical match-set",
  "同一路径允许不同 entry",
  "lowercase canonical token",
  "大小写敏感",
  "fresh match-set",
  "零 match",
  "l1RegistryAnchor",
  "adopt-anchor",
  "L0 anchor → current L1 registry → expected L2 projections/runtime registry",
  "不引入签名系统",
  "有序 multiset",
  "canonical command-word tokenizer",
]);

includesAll("skills/feedback-writer/SKILL.md", [
  "package-feedback",
  "单 scope",
  "禁止自动双写",
  "target-project",
]);

includesAll("skills/evolution-engine/SKILL.md", [
  "package-feedback",
  "不处理 target-project",
  "用户确认",
]);

includesAll("skills/target-constitution-setup/SKILL.md", [
  "experienceGovernance",
  "docs/项目治理/经验治理.md",
  "target-experience-registry",
  "非 canonical",
  "显式迁移",
]);

includesAll("skills/target-runtime-setup/SKILL.md", [
  "target-experience-projection",
  "sourceHash",
  "outputHash",
  "fail closed",
  "experienceProjection stored/actual hash",
  "当前 L1 registry 确定性重算",
  "L0 anchor → current L1 registry → expected L2 projections/runtime registry",
  "runtime 不得写入",
]);

includesAllForPublishedProfile("DEV-PLAN.md", [
  "> sourceRevision：`EXP-GOV-CLOSURE-20260723-r2`",
  "REQ `EXP-GOV-001..013` 均映射到 T1-T7",
  "| T1 统一信号 |",
  "| T4 启用状态 |",
  "| T5 L1→L2/L3 |",
  "| T6 L0 独立锚点与原子事务 |",
  "| T7 退役 |",
  "双向 exact 且顺序一致",
  "完整 canonical match-set",
  "同路径不同 entry",
  "fresh/stored exact set",
  "lowercase canonical token",
  "大小写敏感",
  "adopt-anchor",
  "有序 multiset",
  "canonical command-word tokenizer",
]);

includesAllForPublishedProfile("Product-Spec.md", [
  "> sourceRevision：`EXP-GOV-CLOSURE-20260723-r2`",
  "| EXP-GOV-013 | 已有目标项目升级闭环 |",
  "active / archived / processedEvents / consumedConfirmations",
  "拒绝未知额外字段",
  "不接受 caller 提交 replacement content",
  "当前 L1 registry 确定性重算",
  "双向 exact 且顺序一致",
  "完整 canonical match-set",
  "lowercase canonical token",
  "大小写敏感",
  "adopt-anchor",
  "不引入签名系统",
  "有序 multiset",
  "canonical command-word tokenizer",
]);

for (const entry of ["AGENTS.md", ".claude/CLAUDE.md"]) {
  includesAll(entry, ["显性纠错事件只能进入一个 scope", "禁止自动跨域双写"]);
}

includesAll("tools/INDEX.md", [
  "detect-experience-signal.mjs",
  "experience-anchor-contract.mjs",
  "experience-managed-blocks.mjs",
  "experience-governance.mjs",
  "docs/项目治理/经验治理.md",
  "只有未启用时才 SKIP",
]);

includesAll("hooks/INDEX.md", ["统一 Node 信号入口", "不依赖 jq"]);
includesAll("codex-hooks/INDEX.md", ["统一 Node 信号入口", "同一 signal schema"]);
includesAll("skills/INDEX.md", ["docs/项目治理/经验治理.md", "不自行跨域双写", "确认凭据"]);
includesAll("README.md", ["经验治理闭环", "L0", "L1", "L2", "L3", "eventId"]);
includesAllForPublishedProfile("DOC-MAP.md", ["experienceGovernance", "target experience registry", "target experience projection"]);

includesAll("plans/经验升级体系-主计划.md", [
  "> sourceRevision：`EXP-GOV-CLOSURE-20260723-r2`",
  "Product Spec 的 `EXP-GOV-001..013`、DEV-PLAN 的 T1-T7",
  "旧口径已废止",
  "唯一现行方案",
  "target-experience-registry",
  "target-experience-projection",
  "三域互斥",
]);
const plan = content("plans/经验升级体系-主计划.md");
for (const stale of [
  "feedback→evolution 链的\"升级目标\"从本包自身改为目标项目四级阶梯",
  "L2 升级只能写 block 外",
  "新机制独立成一个 Skill（如 `experience-elevator`）还是并入现有",
]) {
  assert.ok(!plan.includes(stale), `plans/经验升级体系-主计划.md still carries stale instruction: ${stale}`);
}

const runtimePlanPath = "plans/经验晋升运行态闭环实施方案-20260801.md";
const runtimePlan = content(runtimePlanPath);
assert.doesNotMatch(
  runtimePlan,
  /> 当前状态：r[0-9]+|r[0-9]+ 当前状态只写入|r[0-9]+ 当前审查的唯一机器可读 authority/u,
  `${runtimePlanPath} must not carry stale current-round pointers`,
);
const currentLedgerPath = "plans/经验晋升运行态闭环当前审查.json";
const PLAN_REVISION = "EXP-GOV-RUNTIME-BRIDGE-20260801-r59";
const ARCHIVE_START = "<!-- REVIEW_LEDGER_START -->";
const ARCHIVE_END = "<!-- REVIEW_LEDGER_END -->";
const ARCHIVE_PLACEHOLDER = "<!-- REVIEW_LEDGER_ARCHIVE_OMITTED -->\n";

includesAll(runtimePlanPath, [
  "planBodyHash",
  ARCHIVE_START,
  ARCHIVE_END,
  "Phase 0 是基础设施实现阶段",
  "tools/target-doc-transaction.mjs",
  "tools/test-target-doc-transaction.mjs",
  "MANIFEST.files",
  "phase-<number>",
  "stage=RED",
  "assertionsPass=true",
  "outcome=fail",
  "reviewedLedgerRevision",
  "reviewedLedgerHash",
  "predecessorSnapshotPath",
  "predecessorSnapshotHash",
  "Phase 0 receipts 只进入 allowedFiles/receiptPath 校验，不进入 generatedFiles",
  "fixtureId` 是单一路径段",
  "Phase receipt 固定 exact keys",
  "beforeSnapshot / beforeSnapshotHash / afterSnapshot / afterSnapshotHash",
  "started-no-exit",
  "decision` 固定 exact keys",
  "current receipt selection binds the decision predecessor",
]);
const runtimeImplementation = runtimePlan.slice(runtimePlan.indexOf("## 4. 目标架构"));
for (const stale of [
  "方案文件任何修改都会使旧 reviewedHash 过期",
  "MANIFEST.json.phaseAuthorities",
  "git write-tree",
  "Phase 0 是方案冻结与来源门禁阶段，不属于实现 Phase",
  "目标按 contract 回滚时 outcome=pass",
  "0B PARITY：验证源码 checkout 不依赖源码根 MANIFEST；验证发行构建",
  "再落盘 Phase 0 RED/GREEN/REFACTOR/PARITY receipt",
  "<phase=0..5>",
  "把已经存在的 Phase 0 receipts 纳入 allowedFiles/generatedFiles 证据",
  "r49 当前状态只写入 3.3 指定的外置 ledger",
  "遵循 4.7 的 signal/exit contract",
  "按 4.6.1 的相对路径/basename",
  "实际 manifest 必须完整列出全部 trusted entry、静态 import closure、sourceBlob、sourceIndexTree",
  "同一路径存在不同 `introducedInPhase`、`requiredWhen`、`mode`、`byteLength`、`sha256`、`sourceBlob` 或 `sourceIndexTree`",
  "Phase 0..5 的 RED、GREEN、REFACTOR 和 parity 结果都保存一份 JSON receipt，至少包含",
  "五行条件覆盖所有 receipt",
]) {
  assert.ok(!runtimeImplementation.includes(stale), `${runtimePlanPath} still carries stale runtime-plan contract: ${stale}`);
}

assert.equal(/\\n[-| ]/u.test(runtimePlan), false, `${runtimePlanPath} contains literal escaped line breaks in normative list/table`);
assert.doesNotMatch(runtimeImplementation, /绑定 r[0-9]+ `planBodyHash`/u, `${runtimePlanPath} must bind the current frozen plan hash, not a revision literal`);
function normalizePlanBody(plan) {
  const normalized = plan.replace(/\r\n?/gu, "\n");
  assert.equal(normalized.split(ARCHIVE_START).length - 1, 1, "archive start marker must be unique");
  assert.equal(normalized.split(ARCHIVE_END).length - 1, 1, "archive end marker must be unique");
  const start = normalized.indexOf(ARCHIVE_START);
  const end = normalized.indexOf(ARCHIVE_END, start) + ARCHIVE_END.length;
  const suffixStart = normalized[end] === "\n" ? end + 1 : end;
  return normalized.slice(0, start) + ARCHIVE_PLACEHOLDER + normalized.slice(suffixStart);
}

function canonicalizeJson(value) {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`)
    .join(",")}}`;
}

const computedPlanBodyHash = `sha256:${crypto
  .createHash("sha256")
  .update(normalizePlanBody(runtimePlan), "utf8")
  .digest("hex")}`;
const currentLedger = JSON.parse(content(currentLedgerPath));
assert.deepEqual(Object.keys(currentLedger.decision).sort(), [
  "predecessorLedgerHash",
  "predecessorLedgerRevision",
  "predecessorSnapshotHash",
  "predecessorSnapshotPath",
  "reason",
  "status",
].sort());
assert.ok(["blocked", "pass"].includes(currentLedger.decision.status));
assert.ok(typeof currentLedger.decision.reason === "string");
assert.equal((currentLedger.decision.predecessorLedgerRevision === null) === (currentLedger.decision.predecessorLedgerHash === null), true);
assert.equal((currentLedger.decision.predecessorSnapshotPath === null) === (currentLedger.decision.predecessorSnapshotHash === null), true);
assert.equal(currentLedger.decision.predecessorLedgerRevision === null, currentLedger.decision.predecessorSnapshotPath === null);
assert.deepEqual(Object.keys(currentLedger).sort(), [
  "archive",
  "authority",
  "decision",
  "findings",
  "ledgerHash",
  "ledgerId",
  "ledgerRevision",
  "planBodyHash",
  "planRevision",
  "receipts",
  "schemaVersion",
].sort());
assert.equal(currentLedger.schemaVersion, 1);
assert.equal(currentLedger.authority, currentLedgerPath);
assert.equal(currentLedger.planRevision, PLAN_REVISION);
assert.equal(currentLedger.planBodyHash, computedPlanBodyHash);
assert.equal(currentLedger.archive.ledgerRevision, "r48");
assert.equal(currentLedger.archive.ledgerHash, "83974d290a84e4eee8d714a5219eca8895af2d3280d88cb60e0b36e09230e4b7");

const archiveStart = runtimePlan.indexOf(ARCHIVE_START) + ARCHIVE_START.length;
const archiveEnd = runtimePlan.indexOf(ARCHIVE_END, archiveStart);
const archiveLedger = JSON.parse(runtimePlan.slice(archiveStart, archiveEnd));
const archiveFindingIds = new Set(archiveLedger.entries.map((entry) => entry.findingId));
const findingKeys = [
  "affectedFiles",
  "evidence",
  "findingId",
  "history",
  "resolution",
  "reverificationEvidence",
  "reviewStage",
  "severity",
  "status",
  "userDecisionEvidence",
].sort();
const allowedTransitions = new Map([
  ["open", new Set(["fixing", "accepted-risk", "deferred", "rejected-with-reason"])],
  ["fixing", new Set(["fixed", "accepted-risk"])],
  ["fixed", new Set(["reverified", "fixing", "accepted-risk"])],
  ["reverified", new Set(["fixing"])],
  ["accepted-risk", new Set()],
  ["deferred", new Set()],
  ["rejected-with-reason", new Set()],
]);
assert.ok(Array.isArray(currentLedger.findings) && currentLedger.findings.length > 0);
const currentFindingIds = new Set();
function assertQualityRepairReadyStatus(status, findingId) {
  assert.ok(["fixed", "reverified"].includes(status), `quality repair must remain fixed or reverified: ${findingId}`);
}
assert.doesNotThrow(() => assertQualityRepairReadyStatus("reverified", "fixture-quality-ready"));
assert.throws(() => assertQualityRepairReadyStatus("fixing", "fixture-quality-not-ready"), /fixed or reverified/u);

const resolvedQualityFindingIds = new Set([
  "EXP-GOV-RUNTIME-BRIDGE-quality-001",
  "EXP-GOV-RUNTIME-BRIDGE-quality-011",
  "EXP-GOV-RUNTIME-BRIDGE-quality-016",
  "EXP-GOV-RUNTIME-BRIDGE-r49-quality-005",
  "EXP-GOV-RUNTIME-BRIDGE-r52-quality-001",
]);
const acceptedLegacyRiskIds = new Set([
  "Q-026",
  "r18-quality-001",
  "r18-quality-002",
  "r18-quality-003",
  "r18-quality-004",
  "r18-quality-005",
  "r18-spec-001",
  "r18-spec-002",
  "r19-quality-006",
  "r19-quality-007",
  "r19-quality-008",
  "r19-quality-009",
]);
for (const finding of currentLedger.findings) {
  assert.deepEqual(Object.keys(finding).sort(), findingKeys);
  assert.ok(!currentFindingIds.has(finding.findingId), `duplicate current finding: ${finding.findingId}`);
  currentFindingIds.add(finding.findingId);
  assert.ok(["spec", "quality"].includes(finding.reviewStage));
  assert.ok(["critical", "important", "minor"].includes(finding.severity));
  assert.ok(Array.isArray(finding.affectedFiles) && finding.affectedFiles.length > 0);
  assert.ok(Array.isArray(finding.history) && finding.history.length > 0);
  assert.equal(finding.history.at(-1).status, finding.status);
  for (let index = 1; index < finding.history.length; index += 1) {
    const prior = finding.history[index - 1].status;
    const next = finding.history[index].status;
    assert.ok(allowedTransitions.get(prior)?.has(next), `illegal finding transition: ${finding.findingId} ${prior}->${next}`);
  }
  if (finding.status !== "open") assert.ok(finding.resolution);
  if (finding.status === "reverified") assert.ok(finding.reverificationEvidence);
  if (finding.status === "accepted-risk") assert.ok(finding.userDecisionEvidence);
  if (resolvedQualityFindingIds.has(finding.findingId)) {
    assertQualityRepairReadyStatus(finding.status, finding.findingId);
  }
  if (acceptedLegacyRiskIds.has(finding.findingId)) {
    assert.equal(finding.status, "accepted-risk", `legacy finding must retain the user's accepted-risk decision: ${finding.findingId}`);
    assert.match(finding.userDecisionEvidence, /2026-08-02.*(明确回复|明确同意)/u);
  }
}
for (const findingId of archiveFindingIds) {
  assert.ok(currentFindingIds.has(findingId), `archive finding missing from current authority: ${findingId}`);
}

const receiptKeys = [
  "conclusion",
  "findingIds",
  "freshEvidence",
  "planBodyHash",
  "planRevision",
  "receiptId",
  "reviewStage",
  "reviewedLedgerHash",
  "reviewedLedgerRevision",
  "reviewerInstance",
  "round",
].sort();
assert.ok(Array.isArray(currentLedger.receipts));
const receiptIds = new Set();
for (const receipt of currentLedger.receipts) {
  assert.deepEqual(Object.keys(receipt).sort(), receiptKeys);
  assert.ok(!receiptIds.has(receipt.receiptId), `duplicate receipt: ${receipt.receiptId}`);
  receiptIds.add(receipt.receiptId);
  assert.ok(["spec", "quality"].includes(receipt.reviewStage));
  assert.ok(receipt.reviewerInstance && receipt.round);
  assert.ok(Array.isArray(receipt.findingIds) && receipt.findingIds.length > 0);
  assert.ok(Array.isArray(receipt.freshEvidence) && receipt.freshEvidence.length > 0);
  assert.ok(["NO BLOCKING FINDINGS", "BLOCKING FINDINGS"].includes(receipt.conclusion));
  assert.ok(receipt.reviewedLedgerRevision && /^sha256:[a-f0-9]{64}$/u.test(receipt.reviewedLedgerHash));
}

const { ledgerHash, ...ledgerPayload } = currentLedger;
const computedLedgerHash = `sha256:${crypto
  .createHash("sha256")
  .update(canonicalizeJson(ledgerPayload), "utf8")
  .digest("hex")}`;
assert.equal(ledgerHash, computedLedgerHash);

const planCurrentReceipts = currentLedger.receipts.filter(
  (receipt) =>
    receipt.planRevision === currentLedger.planRevision &&
    receipt.planBodyHash === currentLedger.planBodyHash &&
    receipt.conclusion === "NO BLOCKING FINDINGS",
);
const decisionHasPredecessor =
  currentLedger.decision.predecessorLedgerRevision !== null &&
  currentLedger.decision.predecessorLedgerHash !== null &&
  currentLedger.decision.predecessorSnapshotPath !== null &&
  currentLedger.decision.predecessorSnapshotHash !== null;
const currentReceipts = decisionHasPredecessor
  ? planCurrentReceipts.filter(
    (receipt) =>
      receipt.reviewedLedgerRevision === currentLedger.decision.predecessorLedgerRevision &&
      receipt.reviewedLedgerHash === currentLedger.decision.predecessorLedgerHash,
  )
  : [];
const receiptByStage = new Map();
for (const stage of ["spec", "quality"]) {
  const matches = currentReceipts.filter((receipt) => receipt.reviewStage === stage);
  assert.ok(matches.length <= 1, `multiple current ${stage} receipts`);
  if (matches.length === 1) receiptByStage.set(stage, matches[0]);
}
const reviewers = new Set([...receiptByStage.values()].map((receipt) => receipt.reviewerInstance));
const findingsClosed = currentLedger.findings.every((finding) =>
  ["reverified", "accepted-risk", "rejected-with-reason"].includes(finding.status),
);
const coverageComplete = currentLedger.findings.every((finding) =>
  receiptByStage.get(finding.reviewStage)?.findingIds.includes(finding.findingId),
);
const mayPass =
  findingsClosed &&
  receiptByStage.size === 2 &&
  reviewers.size === 2 &&
  coverageComplete;
if (mayPass) {
  assert.equal(currentLedger.decision.status, "pass");
  assert.ok(currentLedger.decision.predecessorLedgerRevision);
  assert.ok(currentLedger.decision.predecessorLedgerHash);
  for (const receipt of receiptByStage.values()) {
    assert.equal(receipt.reviewedLedgerRevision, currentLedger.decision.predecessorLedgerRevision);
    assert.equal(receipt.reviewedLedgerHash, currentLedger.decision.predecessorLedgerHash);
  }
  assert.match(currentLedger.decision.predecessorSnapshotPath, /^plans\/经验晋升运行态闭环证据\/审查\/r[0-9]+\.[0-9]+-predecessor\.json$/u);
  assert.equal(
    currentLedger.decision.predecessorSnapshotPath,
    `plans/经验晋升运行态闭环证据/审查/${currentLedger.decision.predecessorLedgerRevision}-predecessor.json`,
    "snapshot path revision mismatch",
  );
  const predecessorSnapshot = JSON.parse(content(currentLedger.decision.predecessorSnapshotPath));
  assert.deepEqual(Object.keys(predecessorSnapshot).sort(), [
    "authority",
    "findingIds",
    "ledgerHash",
    "ledgerRevision",
    "planBodyHash",
    "planRevision",
    "schemaVersion",
    "snapshotHash",
    "snapshotId",
  ].sort());
  const { snapshotHash, ...snapshotPayload } = predecessorSnapshot;
  const computedSnapshotHash = `sha256:${crypto
    .createHash("sha256")
    .update(canonicalizeJson(snapshotPayload), "utf8")
    .digest("hex")}`;
  assert.equal(currentLedger.decision.predecessorSnapshotHash, computedSnapshotHash);
  assert.equal(snapshotHash, computedSnapshotHash);
  assert.equal(predecessorSnapshot.authority, currentLedger.authority);
  assert.equal(predecessorSnapshot.planRevision, currentLedger.planRevision);
  assert.equal(predecessorSnapshot.planBodyHash, currentLedger.planBodyHash);
  assert.equal(predecessorSnapshot.ledgerRevision, currentLedger.decision.predecessorLedgerRevision);
  assert.equal(predecessorSnapshot.ledgerHash, currentLedger.decision.predecessorLedgerHash);
  assert.deepEqual(predecessorSnapshot.findingIds, [...new Set(predecessorSnapshot.findingIds)].sort());
  assert.deepEqual(predecessorSnapshot.findingIds, [...currentFindingIds].sort());} else {
  assert.equal(currentLedger.decision.status, "blocked");
}

function validatePassFixture(ledger, snapshot) {
  assert.equal(ledger.decision.status, "pass");
  const currentReceipts = ledger.receipts.filter(
    (receipt) =>
      receipt.planRevision === ledger.planRevision &&
      receipt.planBodyHash === ledger.planBodyHash &&
      receipt.conclusion === "NO BLOCKING FINDINGS" &&
      receipt.reviewedLedgerRevision === ledger.decision.predecessorLedgerRevision &&
      receipt.reviewedLedgerHash === ledger.decision.predecessorLedgerHash,
  );
  assert.equal(currentReceipts.length, 2, "pass requires exactly two current receipts");
  assert.equal(new Set(currentReceipts.map((receipt) => receipt.reviewStage)).size, 2, "pass requires both review stages");
  assert.equal(new Set(currentReceipts.map((receipt) => receipt.reviewerInstance)).size, 2, "pass requires distinct reviewers");
  assert.equal(
    currentReceipts.every(
      (receipt) => Array.isArray(receipt.freshEvidence) && receipt.freshEvidence.length > 0,
    ),
    true,
    "pass requires freshEvidence",
  );
  assert.equal(
    ledger.findings.every((finding) => ["reverified", "accepted-risk", "rejected-with-reason"].includes(finding.status)),
    true,
    "pass requires closed findings",
  );
  assert.equal(
    ledger.findings.every((finding) =>
      currentReceipts.find((receipt) => receipt.reviewStage === finding.reviewStage)?.findingIds.includes(finding.findingId)),
    true,
    "pass requires complete receipt coverage",
  );
  const { snapshotHash, ...snapshotPayload } = snapshot;
  const computedSnapshotHash = `sha256:${crypto.createHash("sha256").update(canonicalizeJson(snapshotPayload), "utf8").digest("hex")}`;
  assert.equal(snapshotHash, computedSnapshotHash, "snapshot hash mismatch");
  assert.equal(ledger.decision.predecessorSnapshotHash, computedSnapshotHash, "snapshot hash mismatch");
  assert.equal(snapshot.authority, ledger.authority, "snapshot authority mismatch");
  assert.equal(snapshot.planRevision, ledger.planRevision, "snapshot plan pair mismatch");
  assert.equal(snapshot.planBodyHash, ledger.planBodyHash, "snapshot plan pair mismatch");
  assert.equal(snapshot.ledgerRevision, ledger.decision.predecessorLedgerRevision, "snapshot ledger pair mismatch");
  assert.equal(snapshot.ledgerHash, ledger.decision.predecessorLedgerHash, "snapshot ledger pair mismatch");
  assert.match(
    ledger.decision.predecessorSnapshotPath,
    /^plans\/经验晋升运行态闭环证据\/审查\/r[0-9]+\.[0-9]+-predecessor\.json$/u,
    "snapshot path mismatch",
  );
  assert.equal(
    ledger.decision.predecessorSnapshotPath,
    `plans/经验晋升运行态闭环证据/审查/${ledger.decision.predecessorLedgerRevision}-predecessor.json`,
    "snapshot path revision mismatch",
  );
  const expectedFindingIds = ledger.findings.map((finding) => finding.findingId).sort();
  assert.deepEqual(snapshot.findingIds, [...new Set(snapshot.findingIds)].sort(), "snapshot findingIds must be unique and sorted");
  assert.deepEqual(snapshot.findingIds, expectedFindingIds, "snapshot findingIds mismatch");
}
const passFixtureFindingIds = ["fixture-quality-001", "fixture-spec-001"];
const passFixtureSnapshotPayload = {
  schemaVersion: 1,
  snapshotId: "EXP-GOV-RUNTIME-BRIDGE-fixture-PREDECESSOR",
  authority: currentLedgerPath,
  planRevision: PLAN_REVISION,
  planBodyHash: computedPlanBodyHash,
  ledgerRevision: "r59.2",
  ledgerHash: `sha256:${"1".repeat(64)}`,
  findingIds: passFixtureFindingIds,
};
const passFixtureSnapshot = {
  ...passFixtureSnapshotPayload,
  snapshotHash: `sha256:${crypto.createHash("sha256").update(canonicalizeJson(passFixtureSnapshotPayload), "utf8").digest("hex")}`,
};
const passFixture = {
  authority: currentLedgerPath,
  planRevision: PLAN_REVISION,
  planBodyHash: computedPlanBodyHash,
  findings: [
    { findingId: "fixture-quality-001", reviewStage: "quality", status: "reverified" },
    { findingId: "fixture-spec-001", reviewStage: "spec", status: "reverified" },
  ],
  receipts: [
    { reviewStage: "spec", reviewerInstance: "/fixture/spec", planRevision: PLAN_REVISION, planBodyHash: computedPlanBodyHash, reviewedLedgerRevision: "r59.2", reviewedLedgerHash: `sha256:${"1".repeat(64)}`, findingIds: ["fixture-spec-001"], freshEvidence: ["fixture spec evidence"], conclusion: "NO BLOCKING FINDINGS" },
    { reviewStage: "quality", reviewerInstance: "/fixture/quality", planRevision: PLAN_REVISION, planBodyHash: computedPlanBodyHash, reviewedLedgerRevision: "r59.2", reviewedLedgerHash: `sha256:${"1".repeat(64)}`, findingIds: ["fixture-quality-001"], freshEvidence: ["fixture quality evidence"], conclusion: "NO BLOCKING FINDINGS" },
  ],
  decision: {
    status: "pass",
    predecessorLedgerRevision: "r59.2",
    predecessorLedgerHash: `sha256:${"1".repeat(64)}`,
    predecessorSnapshotPath: "plans/经验晋升运行态闭环证据/审查/r59.2-predecessor.json",
    predecessorSnapshotHash: passFixtureSnapshot.snapshotHash,
  },
};

validatePassFixture(passFixture, passFixtureSnapshot);
const emptyEvidenceFixture = {
  ...passFixture,
  receipts: passFixture.receipts.map((receipt) => ({ ...receipt, freshEvidence: [] })),
};
assert.throws(() => validatePassFixture(emptyEvidenceFixture, passFixtureSnapshot), /freshEvidence/u);
const wrongPathFixture = {
  ...passFixture,
  decision: { ...passFixture.decision, predecessorSnapshotPath: "wrong/path.json" },
};
assert.throws(() => validatePassFixture(wrongPathFixture, passFixtureSnapshot), /snapshot path/u);
const wrongRevisionPathFixture = {
  ...passFixture,
  decision: { ...passFixture.decision, predecessorSnapshotPath: "plans/经验晋升运行态闭环证据/审查/r60.1-predecessor.json" },
};
assert.throws(() => validatePassFixture(wrongRevisionPathFixture, passFixtureSnapshot), /snapshot path revision mismatch/u);
assert.throws(() => validatePassFixture(passFixture, { ...passFixtureSnapshot, snapshotHash: `sha256:${"2".repeat(64)}` }), /snapshot hash/u);
const mismatchedLedgerPayload = { ...passFixtureSnapshotPayload, ledgerHash: `sha256:${"2".repeat(64)}` };
const mismatchedLedgerSnapshot = { ...mismatchedLedgerPayload, snapshotHash: `sha256:${crypto.createHash("sha256").update(canonicalizeJson(mismatchedLedgerPayload), "utf8").digest("hex")}` };
const mismatchedLedgerFixture = { ...passFixture, decision: { ...passFixture.decision, predecessorSnapshotHash: mismatchedLedgerSnapshot.snapshotHash } };
assert.throws(() => validatePassFixture(mismatchedLedgerFixture, mismatchedLedgerSnapshot), /ledger pair/u);
const missingFindingPayload = { ...passFixtureSnapshotPayload, findingIds: ["fixture-spec-001"] };
const missingFindingSnapshot = { ...missingFindingPayload, snapshotHash: `sha256:${crypto.createHash("sha256").update(canonicalizeJson(missingFindingPayload), "utf8").digest("hex")}` };
const missingFindingFixture = { ...passFixture, decision: { ...passFixture.decision, predecessorSnapshotHash: missingFindingSnapshot.snapshotHash } };
assert.throws(() => validatePassFixture(missingFindingFixture, missingFindingSnapshot), /findingIds/u);
console.log("Experience governance documentation contracts passed");
