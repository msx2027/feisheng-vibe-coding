#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderHookSignal } from "./detect-experience-signal.mjs";
import * as ledgerCore from "./experience-ledger-core.mjs";
import { parseExperienceRegistry, registryInfoFromRegistry } from "./experience-managed-blocks.mjs";
import { commitTargetTransactionPhases } from "./target-doc-transaction.mjs";
import { resolveTrustedPowerShell } from "./trusted-git.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const signalTool = path.join(repoRoot, "tools", "detect-experience-signal.mjs");
const ledgerChecker = path.join(repoRoot, "tools", "check-experience-ledger.mjs");
const runtimeTool = path.join(repoRoot, "tools", "init-target-runtime.mjs");
const claudeHook = path.join(repoRoot, "hooks", "detect-feedback-signal.sh");
const claudeMirrorHook = path.join(repoRoot, ".claude", "hooks", "detect-feedback-signal.sh");
const codexHook = path.join(repoRoot, "codex-hooks", "detect-feedback-signal.ps1");
const codexMirrorHook = path.join(repoRoot, ".codex", "hooks", "detect-feedback-signal.ps1");

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error?.stack || error);
  }
}

function sha256(content) {
  return `sha256:${crypto.createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function fixtureElevation(experienceId, fromTier, ordinal) {
  const toTier = ledgerCore.TIER_ORDER[ledgerCore.TIER_ORDER.indexOf(fromTier) + 1];
  const eventId = `EVT-FIXTURE-${experienceId}-${fromTier}`;
  const confirmedAt = `2026-07-23T09:${String(ordinal).padStart(2, "0")}:00.000Z`;
  const canonical = {
    receiptId: `CONF-FIXTURE-${experienceId}-${fromTier}`,
    eventId,
    experienceId,
    scope: "target-project",
    action: "elevate",
    tier: fromTier,
    confirmedAt,
  };
  return {
    event: {
      eventId,
      signalType: "explicit-correction",
      scope: "target-project",
      promptHash: sha256(eventId),
      occurredAt: confirmedAt,
      experienceId,
    },
    confirmation: {
      ...canonical,
      confirmationHash: sha256(JSON.stringify(canonical)),
      fromTier,
      toTier,
    },
    trajectory: `2026-07-23 升档 ${fromTier}→${toTier}`,
  };
}

function canonicalizeFixtureTransitions(ledger) {
  const generated = [];
  for (const record of [...ledger.experiences, ...ledger.archived]) {
    const tierIndex = ledgerCore.TIER_ORDER.indexOf(record?.tier);
    if (tierIndex <= 0 || !Array.isArray(record.trajectory)) continue;
    const existingHistory = Array.isArray(record.confirmationHistory) ? record.confirmationHistory : [];
    const missing = ledgerCore.TIER_ORDER.slice(0, tierIndex)
      .filter((fromTier) => !existingHistory.some((item) => item?.action === "elevate" && item.fromTier === fromTier))
      .map((fromTier, index) => fixtureElevation(record.id, fromTier, index));
    if (missing.length === 0) continue;
    generated.push(...missing);
    record.confirmationHistory = [...missing.map((item) => item.confirmation), ...existingHistory];
    record.confirmation = record.confirmationHistory.at(-1);
    const retirementIndex = record.trajectory.findIndex((item) => / 退役 /u.test(item));
    record.trajectory.splice(retirementIndex === -1 ? record.trajectory.length : retirementIndex, 0, ...missing.map((item) => item.trajectory));
  }
  ledger.processedEvents = [...generated.map((item) => item.event), ...ledger.processedEvents];
  ledger.consumedConfirmations = [...generated.map((item) => item.confirmation), ...ledger.consumedConfirmations];
  return ledger;
}

function sampleLedger(overrides = {}) {
  return canonicalizeFixtureTransitions({
    vibeExperienceLedger: "v2",
    revision: 1,
    l1RegistryAnchor: null,
    thresholds: { L0: 3, L1: 5, L2: 8 },
    processedEvents: [],
    consumedConfirmations: [],
    experiences: [
      {
        id: "EXP-001",
        summary: "重复踩坑",
        tier: "L0",
        count: 2,
        trajectory: ["2026-07-23 记录@L0"],
        landing: null,
      },
    ],
    archived: [],
    ...overrides,
  });
}

function confirmation(action, extra = {}) {
  const value = {
    receiptId: "CONF-20260723-001",
    eventId: "EVT-001",
    experienceId: "EXP-001",
    scope: "target-project",
    action,
    tier: "L0",
    confirmedAt: "2026-07-23T10:00:00.000Z",
    ...extra,
  };
  value.confirmationHash = sha256(JSON.stringify({
    receiptId: value.receiptId,
    eventId: value.eventId,
    experienceId: value.experienceId,
    scope: value.scope,
    action: value.action,
    tier: value.tier,
    confirmedAt: value.confirmedAt,
  }));
  return value;
}

function makeTarget(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runNode(script, args = [], options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    input: options.input,
    env: { ...process.env, ...options.env },
  });
}

function bashExecutable() {
  const candidates = process.platform === "win32"
    ? ["D:/Git/bin/bash.exe", "C:/Program Files/Git/bin/bash.exe"]
    : ["bash"];
  return candidates.find((candidate) => candidate === "bash" || fs.existsSync(candidate));
}

function runBash(script, input) {
  const executable = bashExecutable();
  assert.ok(executable, "找不到可执行 Bash");
  return spawnSync(executable, [script], { cwd: repoRoot, encoding: "utf8", input });
}

function runPowerShell(script, input, cwd = repoRoot) {
  const executable = resolveTrustedPowerShell(repoRoot);
  assert.ok(executable, "找不到可用 PowerShell（pwsh 或 powershell）");
  return spawnSync(executable, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "$utf8 = New-Object System.Text.UTF8Encoding($false); [Console]::InputEncoding = $utf8; $payload = [Console]::In.ReadToEnd(); & $env:VIBE_TEST_HOOK -HookInput $payload; exit $LASTEXITCODE",
  ], {
    cwd,
    encoding: "utf8",
    input,
    env: { ...process.env, VIBE_TEST_HOOK: script },
  });
}

function event(overrides = {}) {
  return {
    eventId: "EVT-001",
    signalType: "explicit-correction",
    scope: "target-project",
    promptHash: sha256("prompt"),
    occurredAt: "2026-07-23T09:59:00.000Z",
    ...overrides,
  };
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function registryBlock(rules) {
  const body = JSON.stringify({ schemaVersion: 1, sourceRevision: 1, rules }, null, 2);
  const hash = sha256(body).slice("sha256:".length);
  return [
    `<!-- vibe-coding-skills:target-experience-registry:start version=1 checksum=sha256:${hash} -->`,
    body,
    "<!-- vibe-coding-skills:target-experience-registry:end -->",
  ].join("\n");
}

function setupGovernedTarget(target, ledger, rules = []) {
  write(target, ".vibe-docs.json", `${JSON.stringify({
    schemaVersion: 2,
    constitutionDesign: "docs/项目治理/宪法设计.md",
    experienceGovernance: "docs/项目治理/经验治理.md",
  }, null, 2)}\n`);
  const registry = { schemaVersion: 1, sourceRevision: 1, rules };
  const registryInfo = registryInfoFromRegistry(registry, "docs/项目治理/宪法设计.md");
  const anchoredLedger = {
    ...ledger,
    l1RegistryAnchor: rules.length === 0 ? null : {
      path: "docs/项目治理/宪法设计.md",
      blockIdentity: "target-experience-registry",
      blockVersion: "1",
      sourceHash: registryInfo.sourceHash,
    },
  };
  write(target, "docs/项目治理/宪法设计.md", `# 宪法设计\n\n${registryBlock(rules)}\n`);
  const bootstrapLedger = {
    ...sampleLedger(),
    l1RegistryAnchor: anchoredLedger.l1RegistryAnchor,
  };
  write(target, "docs/项目治理/经验治理.md", ledgerCore.renderLedgerMarkdown(bootstrapLedger));
  const runtime = runNode(runtimeTool, [target, "--skills-root", repoRoot, "--write", "--json"]);
  assert.equal(runtime.status, 0, runtime.stderr || runtime.stdout);
  write(target, "docs/项目治理/经验治理.md", ledgerCore.renderLedgerMarkdown(anchoredLedger));
}

function removeProjection(content) {
  return content.replace(
    /\n*<!-- vibe-coding-skills:target-experience-projection:start[^\n]* -->[\s\S]*?<!-- vibe-coding-skills:target-experience-projection:end -->\n?/u,
    "\n",
  );
}

function minimalSignal(output) {
  const parsed = JSON.parse(output);
  return parsed.signal || parsed.hookSpecificOutput?.signal || null;
}

await check("源码与镜像双运行时 wrapper 都能实际调用仓库根统一 Node 信号入口", () => {
  const bashSource = fs.readFileSync(claudeHook, "utf8");
  const psSource = fs.readFileSync(codexHook, "utf8");
  assert.doesNotMatch(bashSource, /\bjq\b/u, "Bash wrapper 不得依赖 jq");
  const input = JSON.stringify({
    prompt: "你又犯错了",
    scope: "target-project",
    messageId: "MSG-001",
    occurredAt: "2026-07-23T09:59:00.000Z",
  });
  for (const script of [claudeHook, claudeMirrorHook]) {
    const result = runBash(script, input);
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
    assert.notEqual(result.stdout.trim(), "", `${script}: wrapper 未输出 JSON；stderr=${result.stderr}`);
    assert.equal(minimalSignal(result.stdout)?.scope, "target-project");
  }
  for (const script of [codexHook, codexMirrorHook]) {
    const result = runPowerShell(script, input, os.tmpdir());
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
    assert.notEqual(result.stdout.trim(), "", `${script}: wrapper 未输出 JSON；stderr=${result.stderr}`);
    assert.equal(minimalSignal(result.stdout)?.scope, "target-project");
  }
});

await check("同一输入在 Claude/Codex 产生相同最小信号且不回显原 prompt", () => {
  const input = JSON.stringify({
    prompt: "你又犯错了，这个坑上次说过了",
    scope: "target-project",
    message_id: "MSG-002",
    occurred_at: "2026-07-23T10:00:00.000Z",
  });
  const claude = runNode(signalTool, ["--runtime", "claude"], { input });
  const codex = runNode(signalTool, ["--runtime", "codex"], { input });
  assert.equal(claude.status, 0, claude.stderr || "Claude signal tool failed");
  assert.equal(codex.status, 0, codex.stderr || "Codex signal tool failed");
  const claudeSignal = minimalSignal(claude.stdout);
  const codexSignal = minimalSignal(codex.stdout);
  assert.deepEqual(claudeSignal, codexSignal);
  assert.equal(claudeSignal.signalType, "explicit-correction");
  assert.equal(claudeSignal.scope, "target-project");
  assert.equal(claudeSignal.occurredAt, "2026-07-23T10:00:00.000Z");
  assert.match(claudeSignal.eventId, /^EVT-[a-f0-9]{24}$/u);
  assert.match(claudeSignal.promptHash, /^sha256:[a-f0-9]{64}$/u);
  assert.doesNotMatch(JSON.stringify(claudeSignal), /你又犯错了/u);
});

await check("target-project 信号要求 AI 自动记录 L0 且不得自动升档", () => {
  const result = runNode(signalTool, ["--runtime", "codex"], { input: JSON.stringify({
    prompt: "你又犯错了",
    scope: "target-project",
    messageId: "MSG-AUTO-L0",
    occurredAt: "2026-08-23T10:00:00.000Z",
  }) });
  assert.equal(result.status, 0, result.stderr || "signal tool failed");
  const output = JSON.parse(result.stdout);
  const context = output.hookSpecificOutput?.additionalContext || "";
  assert.match(context, /自动记录 L0/u);
  assert.match(context, /不得自动升级 L1\/L2\/L3/u);
});

await check("target-project record 输出结构化 AI 路由且未知 disposition fail closed", () => {
  const result = runNode(signalTool, ["--runtime", "codex"], { input: JSON.stringify({
    prompt: "你又犯错了",
    scope: "target-project",
    messageId: "MSG-AUTO-ROUTE",
    occurredAt: "2026-08-23T10:01:00.000Z",
  }) });
  assert.equal(result.status, 0, result.stderr || "signal tool failed");
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.hookSpecificOutput?.autoRecord, {
    skill: "experience-elevator",
    action: "record",
    decision: "ai",
    scope: "target-project",
    caller: "structured-event",
  });
  const unknown = renderHookSignal({ eventId: "EVT-UNKNOWN", disposition: "unknown", scope: "target-project" }, "codex");
  const unknownContext = unknown.hookSpecificOutput?.additionalContext || "";
  assert.doesNotMatch(unknownContext, /自动记录 L0/u);
});

await check("常见 snake_case/camelCase host ID 生成同一事件且不同 occurrence 不碰撞", () => {
  const camel = minimalSignal(runNode(signalTool, ["--runtime", "plain"], { input: JSON.stringify({
    prompt: "你又犯错了",
    scope: "target-project",
    messageId: "MSG-003",
    occurredAt: "2026-07-23T10:01:00.000Z",
  }) }).stdout);
  const snake = minimalSignal(runNode(signalTool, ["--runtime", "plain"], { input: JSON.stringify({
    prompt: "你又犯错了",
    scope: "target-project",
    message_id: "MSG-003",
    occurred_at: "2026-07-23T10:01:00.000Z",
  }) }).stdout);
  const different = minimalSignal(runNode(signalTool, ["--runtime", "plain"], { input: JSON.stringify({
    prompt: "你又犯错了",
    scope: "target-project",
    messageId: "MSG-004",
    occurredAt: "2026-07-23T10:01:01.000Z",
  }) }).stdout);
  assert.deepEqual(camel, snake);
  assert.notEqual(camel.eventId, different.eventId);
});

await check("缺 occurrence identity 或缺失非法 scope 时 fail closed", () => {
  const noIdentity = minimalSignal(runNode(signalTool, [], { input: JSON.stringify({
    prompt: "你又犯错了",
    scope: "target-project",
    occurredAt: "2026-07-23T10:02:00.000Z",
  }) }).stdout);
  assert.equal(noIdentity.disposition, "identity-required");
  assert.equal(noIdentity.eventId, null);
  for (const scope of [undefined, "not-a-scope", ["target-project", "not-a-scope"]]) {
    const input = { prompt: "你又犯错了", messageId: "MSG-SCOPE", occurredAt: "2026-07-23T10:02:00.000Z" };
    if (scope !== undefined) input.scope = scope;
    const signal = minimalSignal(runNode(signalTool, [], { input: JSON.stringify(input) }).stdout);
    assert.equal(signal.disposition, "scope-required");
    assert.equal(signal.scope, null);
  }
});

await check("一个事件请求多个 scope 时只返回跨域提议，不自动双写", () => {
  const input = JSON.stringify({
    prompt: "你又犯错了",
    scopes: ["target-project", "package-feedback"],
    messageId: "MSG-MULTI",
    occurredAt: "2026-07-23T10:03:00.000Z",
  });
  const result = runNode(signalTool, ["--runtime", "codex"], { input });
  assert.equal(result.status, 0, result.stderr);
  const signal = minimalSignal(result.stdout);
  assert.equal(signal.disposition, "proposal-required");
  assert.equal(signal.scope, null);
  assert.deepEqual(signal.proposedScopes, ["target-project", "package-feedback"]);
});

await check("eventId 重放不重复计数并推进 revision", () => {
  const occurrence = event();
  const once = ledgerCore.bumpExperience(sampleLedger(), "EXP-001", occurrence);
  const replay = ledgerCore.bumpExperience(once, "EXP-001", occurrence);
  assert.equal(once.experiences[0].count, 3);
  assert.equal(replay.experiences[0].count, 3);
  assert.equal(replay.processedEvents.length, 1);
  assert.equal(replay.processedEvents[0].experienceId, "EXP-001");
  assert.equal(replay.processedEvents[0].occurredAt, occurrence.occurredAt);
  assert.equal(replay.revision, 2);
  assert.throws(
    () => ledgerCore.bumpExperience(once, "EXP-001", { ...occurrence, promptHash: sha256("different") }),
    /collision|碰撞/u,
  );
  assert.throws(
    () => ledgerCore.bumpExperience(once, "EXP-002", occurrence),
    /collision|碰撞/u,
  );
});

await check("新经验 ID 同时扫描 active 与 archived，不复用 tombstone ID", () => {
  const archivedConfirmation = {
    ...confirmation("retire", {
      receiptId: "CONF-ARCHIVED-009",
      eventId: "EVT-ARCHIVED-009",
      experienceId: "EXP-009",
      tier: "L2",
    }),
    fromTier: "L2",
    toTier: "retired",
  };
  const ledger = sampleLedger({
    processedEvents: [{ ...event({ eventId: "EVT-ARCHIVED-009" }), experienceId: "EXP-009" }],
    consumedConfirmations: [archivedConfirmation],
    archived: [{
      id: "EXP-009",
      summary: "已退役",
      tier: "L2",
      count: 0,
      trajectory: ["2026-07-23 退役 L2→retired tombstone（L0 保留确认与历史轨迹）"],
      landing: null,
      status: "retired",
      retirement: { removed: ["L2:target-experience-projection", "L1:target-experience-registry"] },
      confirmationHistory: [archivedConfirmation],
      confirmation: archivedConfirmation,
    }],
  });
  const next = ledgerCore.addExperience(ledger, {
    summary: "新问题",
    event: event({ eventId: "EVT-002", promptHash: sha256("p2") }),
  });
  assert.equal(next.experiences.at(-1).id, "EXP-010");
});

await check("未达阈值或缺用户确认凭据时不得升档", () => {
  const below = sampleLedger({
    experiences: [{ ...sampleLedger().experiences[0], count: 2 }],
  });
  assert.throws(
    () => ledgerCore.elevateExperience(below, "EXP-001", { confirmation: confirmation("elevate") }),
    /阈值|threshold/u,
  );
  const atThreshold = sampleLedger({
    experiences: [{ ...sampleLedger().experiences[0], count: 3 }],
  });
  assert.throws(() => ledgerCore.elevateExperience(atThreshold, "EXP-001"), /确认|confirmation/u);
});

await check("确认凭据 scope/action/event 不匹配时 fail closed", () => {
  const ledger = sampleLedger({
    experiences: [{ ...sampleLedger().experiences[0], count: 3 }],
    processedEvents: [{ ...event({ promptHash: sha256("p") }), experienceId: "EXP-001" }],
  });
  assert.throws(
    () => ledgerCore.elevateExperience(ledger, "EXP-001", { confirmation: confirmation("remove") }),
    /action|动作/u,
  );
  assert.throws(
    () => ledgerCore.elevateExperience(ledger, "EXP-001", { confirmation: confirmation("elevate", { scope: "package-feedback" }) }),
    /scope|范围/u,
  );
});

await check("manifest 已启用经验治理但缺台账时 checker 失败；未启用才 SKIP", () => {
  const enabled = makeTarget("vibe-exp-enabled-");
  const disabled = makeTarget("vibe-exp-disabled-");
  try {
    write(enabled, ".vibe-docs.json", `${JSON.stringify({ schemaVersion: 2, experienceGovernance: "docs/项目治理/经验治理.md" }, null, 2)}\n`);
    const enabledRun = runNode(ledgerChecker, [enabled, "--json"]);
    assert.notEqual(enabledRun.status, 0, "启用后缺台账必须失败");
    assert.match(`${enabledRun.stdout}\n${enabledRun.stderr}`, /enabled|已启用|缺少|missing/u);
    const disabledRun = runNode(ledgerChecker, [disabled, "--json"]);
    assert.equal(disabledRun.status, 0, disabledRun.stderr);
    assert.match(disabledRun.stdout, /skipped|跳过/u);
  } finally {
    fs.rmSync(enabled, { recursive: true, force: true });
    fs.rmSync(disabled, { recursive: true, force: true });
  }
});

await check("L1 registry 确定性生成 L2 双投影并记录同源 hash", () => {
  const target = makeTarget("vibe-exp-runtime-");
  try {
    const rules = [{ experienceId: "EXP-001", text: "修改全局 token 前必须取得用户确认。", status: "active" }];
    write(target, "docs/项目治理/宪法设计.md", `# 宪法设计\n\n${registryBlock(rules)}\n`);
    const result = runNode(runtimeTool, [target, "--skills-root", repoRoot, "--write", "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const agents = fs.readFileSync(path.join(target, "AGENTS.md"), "utf8");
    const claude = fs.readFileSync(path.join(target, "CLAUDE.md"), "utf8");
    assert.equal(agents.includes("target-experience-projection:start"), true, "AGENTS 缺少经验投影受管块");
    assert.equal(claude.includes("target-experience-projection:start"), true, "CLAUDE 缺少经验投影受管块");
    const registry = JSON.parse(fs.readFileSync(path.join(target, ".vibe-runtime.json"), "utf8"));
    const projection = registry.experienceProjection;
    assert.match(projection.sourceHash, /^sha256:[a-f0-9]{64}$/u);
    assert.equal(projection.outputs["AGENTS.md"].sourceHash, projection.sourceHash);
    assert.equal(projection.outputs["CLAUDE.md"].sourceHash, projection.sourceHash);
    assert.notEqual(projection.outputs["AGENTS.md"].outputHash, undefined);
    assert.notEqual(projection.outputs["CLAUDE.md"].outputHash, undefined);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("经验投影 managed block 冲突时 runtime 写入 fail closed", () => {
  const target = makeTarget("vibe-exp-conflict-");
  try {
    write(target, "docs/项目治理/宪法设计.md", `# 宪法设计\n\n${registryBlock([])}\n`);
    write(target, "AGENTS.md", [
      "# AGENTS.md",
      "",
      "<!-- vibe-coding-skills:target-experience-projection:start file=AGENTS.md version=1 source=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa checksum=sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb -->",
      "被手工篡改",
      "<!-- vibe-coding-skills:target-experience-projection:end -->",
      "",
    ].join("\n"));
    const result = runNode(runtimeTool, [target, "--skills-root", repoRoot, "--write", "--json"]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /experience.*checksum|投影.*冲突|projection.*conflict/iu);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("经验台账自定义路径越界被拒绝", () => {
  const target = makeTarget("vibe-exp-path-");
  try {
    const result = runNode(ledgerChecker, [target, "--file", "../经验治理.md", "--json"]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /project-relative|traversal|越界|路径/u);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("退役按 L3→L2→L1 逆序并在 L0 保留 tombstone/确认轨迹", () => {
  const ledger = sampleLedger({
    experiences: [{ ...sampleLedger().experiences[0], tier: "L3", count: 0, landing: "tools/check-exp-001.mjs" }],
    processedEvents: [{ ...event({ promptHash: sha256("p") }), experienceId: "EXP-001" }],
  });
  const retired = ledgerCore.removeExperience(ledger, "EXP-001", {
    confirmation: confirmation("retire", { tier: "L3" }),
    retirement: {
      removed: ["L3:tools/check-exp-001.mjs", "L2:target-experience-projection", "L1:target-experience-registry"],
    },
  });
  const tombstone = retired.archived.find((item) => item.id === "EXP-001");
  assert.ok(tombstone?.retirement, "退役记录缺少 retirement 审计对象");
  assert.deepEqual(tombstone.retirement.removed.map((item) => item.split(":", 1)[0]), ["L3", "L2", "L1"]);
  assert.equal(tombstone.status, "retired");
  assert.equal(tombstone.confirmation.receiptId, "CONF-20260723-001");
  assert.match(tombstone.trajectory.at(-1), /tombstone|退役/u);
});

await check("多阶段事务第二阶段失败时恢复第一阶段全部文件", () => {
  const target = makeTarget("vibe-exp-rollback-");
  try {
    write(target, "docs/项目治理/经验治理.md", "before-ledger\n");
    write(target, "docs/项目治理/宪法设计.md", "before-constitution\n");
    assert.throws(() => commitTargetTransactionPhases(target, {
      journalPath: ".vibe-experience-transaction.json",
      kind: "experience-governance-test",
      firstOperations: [
        { file: "docs/项目治理/经验治理.md", content: "after-ledger\n", expectedContent: "before-ledger\n" },
        { file: "docs/项目治理/宪法设计.md", content: "after-constitution\n", expectedContent: "before-constitution\n" },
      ],
      nextOperations() {
        throw new Error("injected projection failure");
      },
    }), /injected projection failure/u);
    assert.equal(fs.readFileSync(path.join(target, "docs/项目治理/经验治理.md"), "utf8"), "before-ledger\n");
    assert.equal(fs.readFileSync(path.join(target, "docs/项目治理/宪法设计.md"), "utf8"), "before-constitution\n");
    assert.equal(fs.existsSync(path.join(target, ".vibe-experience-transaction.json")), false);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("experience governance orchestrator 公共入口存在", async () => {
  const modulePath = path.join(repoRoot, "tools", "experience-governance.mjs");
  assert.equal(fs.existsSync(modulePath), true, "缺少统一 experience governance orchestrator");
  const module = await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);
  assert.equal(typeof module.executeExperienceAction, "function");
});

await check("orchestrator 要求 expectedRevision 为显式非负整数", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?revision=${Date.now()}`);
  const target = makeTarget("vibe-exp-revision-");
  try {
    setupGovernedTarget(target, sampleLedger(), []);
    for (const expectedRevision of [undefined, -1, 1.5, "1"]) {
      assert.throws(() => module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "record",
        expectedRevision,
        experienceId: "EXP-001",
        event: event({ eventId: `EVT-REV-${String(expectedRevision)}` }),
      }), /expectedRevision.*non-negative integer|非负整数/iu);
    }
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("orchestrator 在 revision conflict 前识别完全相同 replay，并阻断同 eventId payload collision", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?replay=${Date.now()}`);
  const target = makeTarget("vibe-exp-replay-");
  try {
    setupGovernedTarget(target, sampleLedger(), []);
    const request = {
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "record",
      expectedRevision: 1,
      experienceId: "EXP-001",
      event: event({ eventId: "EVT-REPLAY", promptHash: sha256("same") }),
    };
    const first = module.executeExperienceAction(request);
    assert.equal(first.revision, 2);
    const replay = module.executeExperienceAction(request);
    assert.equal(replay.replayed, true);
    assert.equal(replay.revision, 2);
    assert.throws(
      () => module.executeExperienceAction({ ...request, event: { ...request.event, promptHash: sha256("collision") } }),
      /collision|碰撞/u,
    );
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("orchestrator 在任何新动作前拒绝畸形 confirmation 历史", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?malformed-ledger=${Date.now()}`);
  const target = makeTarget("vibe-exp-malformed-ledger-");
  try {
    const ledger = sampleLedger({ consumedConfirmations: [{}] });
    setupGovernedTarget(target, ledger, []);
    const ledgerPath = path.join(target, "docs/项目治理/经验治理.md");
    const before = fs.readFileSync(ledgerPath, "utf8");
    assert.throws(() => module.executeExperienceAction({
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "record",
      expectedRevision: 1,
      experienceId: "EXP-001",
      event: event({ eventId: "EVT-MALFORMED" }),
    }), /consumedConfirmations|receiptId|confirmation/iu);
    assert.equal(fs.readFileSync(ledgerPath, "utf8"), before);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("orchestrator 在 replay 前拒绝畸形 archived tombstone", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?malformed-archived-replay=${Date.now()}`);
  const target = makeTarget("vibe-exp-malformed-archived-replay-");
  try {
    const replayEvent = { ...event({ eventId: "EVT-ARCHIVED-REPLAY" }), experienceId: "EXP-001" };
    const ledger = sampleLedger({
      experiences: [],
      archived: [{ id: "EXP-001" }],
      processedEvents: [replayEvent],
    });
    setupGovernedTarget(target, ledger, []);
    const tracked = ["docs/项目治理/经验治理.md", "AGENTS.md", "CLAUDE.md", ".vibe-runtime.json"];
    const before = Object.fromEntries(tracked.map((file) => [file, fs.readFileSync(path.join(target, file), "utf8")]));
    assert.throws(() => module.executeExperienceAction({
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "record",
      expectedRevision: 1,
      experienceId: "EXP-001",
      event: event({ eventId: "EVT-ARCHIVED-REPLAY" }),
    }), /archived|summary|tier|count|trajectory|canonical|字段/iu);
    for (const file of tracked) assert.equal(fs.readFileSync(path.join(target, file), "utf8"), before[file]);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("orchestrator replay 与 record 都拒绝全局 consumed 缺少内嵌 confirmation 状态", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?missing-embedded-confirmation=${Date.now()}`);
  const firstEvent = { ...event({ eventId: "EVT-CONFIRM-001" }), experienceId: "EXP-001" };
  const legal = ledgerCore.elevateExperience(sampleLedger({
    experiences: [{ ...sampleLedger().experiences[0], count: 3 }],
    processedEvents: [firstEvent],
  }), "EXP-001", {
    confirmation: confirmation("elevate", { eventId: "EVT-CONFIRM-001" }),
  });
  delete legal.experiences[0].confirmationHistory;
  delete legal.experiences[0].confirmation;

  const requests = [
    {
      name: "replay",
      request: {
        action: "record",
        expectedRevision: legal.revision,
        experienceId: "EXP-001",
        event: event({ eventId: "EVT-CONFIRM-001" }),
      },
    },
    {
      name: "record",
      request: {
        action: "record",
        expectedRevision: legal.revision,
        experienceId: "EXP-001",
        event: event({ eventId: "EVT-CONFIRM-NEW", promptHash: sha256("new-confirm-event") }),
      },
    },
  ];
  for (const scenario of requests) {
    const target = makeTarget(`vibe-exp-missing-embedded-${scenario.name}-`);
    try {
      setupGovernedTarget(target, legal, []);
      const tracked = ["docs/项目治理/经验治理.md", "AGENTS.md", "CLAUDE.md", ".vibe-runtime.json"];
      const before = Object.fromEntries(tracked.map((file) => [file, fs.readFileSync(path.join(target, file), "utf8")]));
      assert.throws(() => module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        ...scenario.request,
      }), /confirmationHistory|confirmation|consumedConfirmations|一致|缺少/iu, scenario.name);
      for (const file of tracked) assert.equal(fs.readFileSync(path.join(target, file), "utf8"), before[file]);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("orchestrator replay 与 record 都拒绝 confirmation 未覆盖的额外 canonical transition", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?extra-transition=${Date.now()}`);
  const firstEvent = { ...event({ eventId: "EVT-TRANSITION-001" }), experienceId: "EXP-001" };
  const malformed = ledgerCore.elevateExperience(sampleLedger({
    experiences: [{ ...sampleLedger().experiences[0], count: 3 }],
    processedEvents: [firstEvent],
  }), "EXP-001", {
    confirmation: confirmation("elevate", { eventId: "EVT-TRANSITION-001" }),
  });
  malformed.experiences[0].trajectory.push("2026-07-23 升档 L1→L2");

  for (const scenario of [
    {
      name: "replay",
      request: { action: "record", expectedRevision: malformed.revision, experienceId: "EXP-001", event: event({ eventId: "EVT-TRANSITION-001" }) },
    },
    {
      name: "record",
      request: {
        action: "record",
        expectedRevision: malformed.revision,
        experienceId: "EXP-001",
        event: event({ eventId: "EVT-TRANSITION-NEW", promptHash: sha256("transition-new") }),
      },
    },
  ]) {
    const target = makeTarget(`vibe-exp-extra-transition-${scenario.name}-`);
    try {
      setupGovernedTarget(target, malformed, []);
      const tracked = ["docs/项目治理/经验治理.md", "AGENTS.md", "CLAUDE.md", ".vibe-runtime.json"];
      const before = Object.fromEntries(tracked.map((file) => [file, fs.readFileSync(path.join(target, file), "utf8")]));
      assert.throws(() => module.executeExperienceAction({ targetRoot: target, skillsRoot: repoRoot, ...scenario.request }), /trajectory|confirmation|transition|一致|额外/iu);
      for (const file of tracked) assert.equal(fs.readFileSync(path.join(target, file), "utf8"), before[file]);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("orchestrator replay 与 record 都拒绝 Unicode format 字符伪装的 transition", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?format-transition=${Date.now()}`);
  const firstEvent = { ...event({ eventId: "EVT-FORMAT-001" }), experienceId: "EXP-001" };
  const malformed = ledgerCore.elevateExperience(sampleLedger({
    experiences: [{ ...sampleLedger().experiences[0], count: 3 }],
    processedEvents: [firstEvent],
  }), "EXP-001", {
    confirmation: confirmation("elevate", { eventId: "EVT-FORMAT-001" }),
  });
  malformed.experiences[0].trajectory.push("2026-07-23 升\u200B档 L1→L2");

  for (const scenario of [
    {
      name: "replay",
      request: { action: "record", expectedRevision: malformed.revision, experienceId: "EXP-001", event: event({ eventId: "EVT-FORMAT-001" }) },
    },
    {
      name: "record",
      request: {
        action: "record",
        expectedRevision: malformed.revision,
        experienceId: "EXP-001",
        event: event({ eventId: "EVT-FORMAT-NEW", promptHash: sha256("format-new") }),
      },
    },
  ]) {
    const target = makeTarget(`vibe-exp-format-transition-${scenario.name}-`);
    try {
      setupGovernedTarget(target, malformed, []);
      const tracked = ["docs/项目治理/经验治理.md", "AGENTS.md", "CLAUDE.md", ".vibe-runtime.json"];
      const before = Object.fromEntries(tracked.map((file) => [file, fs.readFileSync(path.join(target, file), "utf8")]));
      assert.throws(() => module.executeExperienceAction({ targetRoot: target, skillsRoot: repoRoot, ...scenario.request }), /trajectory|transition|canonical|format|Unicode/iu);
      for (const file of tracked) assert.equal(fs.readFileSync(path.join(target, file), "utf8"), before[file]);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("orchestrator replay 与 record 都拒绝 active 档位和 canonical transition 最终档位冲突", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?tier-transition-conflict=${Date.now()}`);
  const firstEvent = { ...event({ eventId: "EVT-TIER-001" }), experienceId: "EXP-001" };
  const malformed = ledgerCore.elevateExperience(sampleLedger({
    experiences: [{ ...sampleLedger().experiences[0], count: 3 }],
    processedEvents: [firstEvent],
  }), "EXP-001", {
    confirmation: confirmation("elevate", { eventId: "EVT-TIER-001" }),
  });
  malformed.experiences[0].tier = "L2";

  for (const scenario of [
    {
      name: "replay",
      request: { action: "record", expectedRevision: malformed.revision, experienceId: "EXP-001", event: event({ eventId: "EVT-TIER-001" }) },
    },
    {
      name: "record",
      request: {
        action: "record",
        expectedRevision: malformed.revision,
        experienceId: "EXP-001",
        event: event({ eventId: "EVT-TIER-NEW", promptHash: sha256("tier-new") }),
      },
    },
  ]) {
    const target = makeTarget(`vibe-exp-tier-transition-${scenario.name}-`);
    try {
      setupGovernedTarget(target, malformed, []);
      const tracked = ["docs/项目治理/经验治理.md", "AGENTS.md", "CLAUDE.md", ".vibe-runtime.json"];
      const before = Object.fromEntries(tracked.map((file) => [file, fs.readFileSync(path.join(target, file), "utf8")]));
      assert.throws(
        () => module.executeExperienceAction({ targetRoot: target, skillsRoot: repoRoot, ...scenario.request }),
        /trajectory|transition|tier|档位|最终|一致/iu,
      );
      for (const file of tracked) assert.equal(fs.readFileSync(path.join(target, file), "utf8"), before[file]);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("established runtime 缺任一 target-experience-projection 时 orchestrator fail closed", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?projection=${Date.now()}`);
  const target = makeTarget("vibe-exp-established-drift-");
  try {
    setupGovernedTarget(target, sampleLedger(), []);
    write(target, "AGENTS.md", removeProjection(fs.readFileSync(path.join(target, "AGENTS.md"), "utf8")));
    assert.throws(() => module.executeExperienceAction({
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "record",
      expectedRevision: 1,
      experienceId: "EXP-001",
      event: event({ eventId: "EVT-DRIFT" }),
    }), /projection.*missing|投影.*缺失|established/iu);
    assert.equal(ledgerCore.parseLedger(fs.readFileSync(path.join(target, "docs/项目治理/经验治理.md"), "utf8")).revision, 1);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("L2→L3 必须验证 checker 与真实 test/CI/Hook 注册并写入 hash 证据", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?hardening=${Date.now()}`);
  const target = makeTarget("vibe-exp-hardening-");
  try {
    const ledger = sampleLedger({
      experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
      processedEvents: [{ ...event(), experienceId: "EXP-001" }],
    });
    setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
    assert.throws(() => module.executeExperienceAction({
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "elevate",
      expectedRevision: 1,
      experienceId: "EXP-001",
      confirmation: confirmation("elevate", { tier: "L2" }),
      hardening: { registered: true, path: "tools/check-exp-001.mjs", registrationFiles: [".github/workflows/quality.yml"] },
    }), /checker.*missing|不存在|registration/iu);

    const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
    write(target, "tools/check-exp-001.mjs", checkerContent);

    const fakePackage = `${JSON.stringify({ scripts: {}, description: "node tools/check-exp-001.mjs" }, null, 2)}\n`;
    const fakeWorkflow = "# run: node tools/check-exp-001.mjs\nenv:\n  CHECKER: tools/check-exp-001.mjs\nsteps: []\n";
    const fakeHook = "# node tools/check-exp-001.mjs\necho node tools/check-exp-001.mjs\nCHECKER=tools/check-exp-001.mjs\n";
    write(target, "package.json", fakePackage);
    write(target, ".github/workflows/quality.yml", fakeWorkflow);
    write(target, "hooks/check-experience.sh", fakeHook);
    for (const registrationFile of ["package.json", ".github/workflows/quality.yml", "hooks/check-experience.sh"]) {
      assert.throws(() => module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: "tools/check-exp-001.mjs", registrationFiles: [registrationFile] },
      }), /executable|execution|registration|执行/iu, `${registrationFile} 只有说明文本时不得算真实注册`);
    }
    for (const [registrationFile, registrationContent] of [
      ["docs/testimony.md", "node tools/check-exp-001.mjs\n"],
      ["test-notes.md", "node tools/check-exp-001.mjs\n"],
      ["hooks/README.md", "node tools/check-exp-001.mjs\n"],
    ]) {
      write(target, registrationFile, registrationContent);
      assert.throws(() => module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: "tools/check-exp-001.mjs", registrationFiles: [registrationFile] },
      }), /package|test|CI|Hook|registration|执行/iu, `${registrationFile} 不是可执行 registration surface`);
    }
    for (const command of [
      "node --check tools/check-exp-001.mjs",
      "node -c tools/check-exp-001.mjs",
      "node -e tools/check-exp-001.mjs",
      "node --eval tools/check-exp-001.mjs",
      "node -p tools/check-exp-001.mjs",
      "node --print tools/check-exp-001.mjs",
      "node --require tools/check-exp-001.mjs other.mjs",
      "node -r tools/check-exp-001.mjs other.mjs",
      "node --import tools/check-exp-001.mjs other.mjs",
      "powershell tools/check-exp-001.mjs",
      "bash -c tools/check-exp-001.mjs",
      "sh -c tools/check-exp-001.mjs",
    ]) {
      write(target, "package.json", `${JSON.stringify({ scripts: { fake: command } }, null, 2)}\n`);
      assert.throws(() => module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: "tools/check-exp-001.mjs", registrationFiles: ["package.json"] },
      }), /executable|execution|registration|执行/iu, `${command} 不得冒充实际执行 checker`);
    }

    const packageRegistration = `${JSON.stringify({ scripts: { "check:experience": "node tools/check-exp-001.mjs" } }, null, 2)}\n`;
    const workflowRegistration = "jobs:\n  quality:\n    steps:\n      - name: experience gate\n        run: |\n          echo checking\n          node tools/check-exp-001.mjs\n";
    const hookRegistration = "#!/usr/bin/env bash\nnode tools/check-exp-001.mjs\n";
    write(target, "package.json", packageRegistration);
    write(target, ".github/workflows/quality.yml", workflowRegistration);
    write(target, "hooks/check-experience.sh", hookRegistration);
    const result = module.executeExperienceAction({
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "elevate",
      expectedRevision: 1,
      experienceId: "EXP-001",
      confirmation: confirmation("elevate", { tier: "L2" }),
      hardening: {
        path: "tools/check-exp-001.mjs",
        registrationFiles: ["package.json", ".github/workflows/quality.yml", "hooks/check-experience.sh"],
      },
    });
    assert.equal(result.ok, true);
    const parsed = parseExperienceRegistry(fs.readFileSync(path.join(target, "docs/项目治理/宪法设计.md"), "utf8"));
    const hardening = parsed.registry.rules[0].hardening;
    assert.deepEqual(hardening.checker, { path: "tools/check-exp-001.mjs", hash: sha256(checkerContent), owned: true });
    assert.equal(hardening.registrations.length, 3);
    assert.deepEqual(hardening.registrations[0], {
      type: "package-script",
      path: "package.json",
      hash: sha256(packageRegistration),
      entry: "scripts.check:experience",
      command: "node tools/check-exp-001.mjs",
    });
    assert.equal(hardening.registrations[1].path, ".github/workflows/quality.yml");
    assert.equal(hardening.registrations[1].type, "workflow-run");
    assert.equal(hardening.registrations[1].hash, sha256(workflowRegistration));
    assert.match(hardening.registrations[1].entry, /^run:/u);
    assert.equal(hardening.registrations[1].command, "node tools/check-exp-001.mjs");
    assert.deepEqual(hardening.registrations[2], {
      type: "line-command",
      path: "hooks/check-experience.sh",
      hash: sha256(hookRegistration),
      entry: "line:2",
      command: "node tools/check-exp-001.mjs",
    });
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("解释器 basename 只接受大小写敏感的 lowercase canonical token", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?interpreter-case=${Date.now()}`);
  const cases = [
    ["node tools/check-exp-001.mjs", true],
    ['"node" "./tools/check-exp-001.mjs"', true],
    ['"C:/Program Files/node.exe" "tools/check-exp-001.mjs"', true],
    ["pwsh -File tools/check-exp-001.mjs", true],
    ["bash tools/check-exp-001.mjs", true],
    ['node "tools/check-exp-001.mjs"evil', false],
    ["node 'tools/check-exp-001.mjs'evil", false],
    ['node "tools/check-exp-001.mjs', false],
    ['node "tools/check-exp-001.mjs"\'', false],
    ["NoDe tools/check-exp-001.mjs", false],
    ["NODE tools/check-exp-001.mjs", false],
    ["PwSh -File tools/check-exp-001.mjs", false],
    ["PowerShell -File tools/check-exp-001.mjs", false],
    ["BASH tools/check-exp-001.mjs", false],
    ["Sh tools/check-exp-001.mjs", false],
  ];
  for (const [command, accepted] of cases) {
    const target = makeTarget("vibe-exp-interpreter-case-");
    try {
      const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
      const packageContent = `${JSON.stringify({ scripts: { "check:experience": command } }, null, 2)}\n`;
      const ledger = sampleLedger({
        experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
        processedEvents: [{ ...event(), experienceId: "EXP-001" }],
      });
      setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
      write(target, "tools/check-exp-001.mjs", checkerContent);
      write(target, "package.json", packageContent);
      const request = {
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: "tools/check-exp-001.mjs", registrationFiles: ["package.json"] },
      };
      if (accepted) assert.equal(module.executeExperienceAction(request).ok, true, command);
      else assert.throws(() => module.executeExperienceAction(request), /executable|execution|registration|执行/iu, command);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("canonical command 分段保留引号内分号并识别引号外连接符", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?quoted-separator=${Date.now()}`);
  const checkerPath = "tools/check;exp-001.mjs";
  const commands = [
    `node "${checkerPath}"`,
    `node "${checkerPath}" "argument&&value"`,
    `node "${checkerPath}" "argument||value"`,
    `echo ignored; node "${checkerPath}"`,
    `echo ignored && node "${checkerPath}"`,
    `echo ignored || node "${checkerPath}"`,
    `echo ignored\nnode "${checkerPath}"`,
    `echo ignored\r\nnode "${checkerPath}"`,
    `node "${checkerPath}"; echo ignored`,
    `echo ignored; node "${checkerPath}"; echo ignored`,
  ];
  for (const command of commands) {
    const target = makeTarget("vibe-exp-quoted-separator-");
    try {
      const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
      const packageContent = `${JSON.stringify({ scripts: { "check:experience": command } }, null, 2)}\n`;
      const ledger = sampleLedger({
        experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
        processedEvents: [{ ...event(), experienceId: "EXP-001" }],
      });
      setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
      write(target, checkerPath, checkerContent);
      write(target, "package.json", packageContent);
      const result = module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: checkerPath, registrationFiles: ["package.json"] },
      });
      assert.equal(result.ok, true, command);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("合法 checker segment 不得遮蔽前后非法 checker segment", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?invalid-composite-segment=${Date.now()}`);
  const checkerPath = "tools/check-exp-001.mjs";
  const commands = [
    `node ${checkerPath}; NoDe ${checkerPath}`,
    `node ${checkerPath}; node --check ${checkerPath}`,
    `node ${checkerPath}; node "${checkerPath}"evil`,
    `node ${checkerPath}; node "${checkerPath}`,
    `NoDe ${checkerPath}; node ${checkerPath}`,
    `node --check ${checkerPath}; node ${checkerPath}`,
    `node "${checkerPath}"evil; node ${checkerPath}`,
    `node "${checkerPath}; node ${checkerPath}`,
    `echo ${checkerPath}; node ${checkerPath}`,
    `node ${checkerPath}; ${checkerPath}`,
    `${checkerPath}; node ${checkerPath}`,
  ];
  for (const command of commands) {
    const target = makeTarget("vibe-exp-invalid-composite-segment-");
    try {
      const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
      const packageContent = `${JSON.stringify({ scripts: { "check:experience": command } }, null, 2)}\n`;
      const ledger = sampleLedger({
        experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
        processedEvents: [{ ...event(), experienceId: "EXP-001" }],
      });
      setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
      write(target, checkerPath, checkerContent);
      write(target, "package.json", packageContent);
      assert.throws(() => module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: checkerPath, registrationFiles: ["package.json"] },
      }), /executable|execution|registration|执行/iu, command);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("复合命令拒绝缺少操作数的空 segment，但保留空行与末尾单分号", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?empty-composite-segment=${Date.now()}`);
  const checkerPath = "tools/check-exp-001.mjs";
  const cases = [
    [`; node ${checkerPath}`, false],
    [`node ${checkerPath};; echo done`, false],
    [`&& node ${checkerPath}`, false],
    [`|| node ${checkerPath}`, false],
    [`node ${checkerPath} &&`, false],
    [`node ${checkerPath} ||`, false],
    [`node ${checkerPath} &&& echo done`, false],
    [`node ${checkerPath} ||| echo done`, false],
    [`node ${checkerPath};`, true],
    [`\nnode ${checkerPath}`, true],
    [`node ${checkerPath}\n`, true],
    [`echo ignored\n\nnode ${checkerPath}`, true],
  ];
  for (const [command, accepted] of cases) {
    const target = makeTarget("vibe-exp-empty-composite-segment-");
    try {
      const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
      const packageContent = `${JSON.stringify({ scripts: { "check:experience": command } }, null, 2)}\n`;
      const ledger = sampleLedger({
        experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
        processedEvents: [{ ...event(), experienceId: "EXP-001" }],
      });
      setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
      write(target, checkerPath, checkerContent);
      write(target, "package.json", packageContent);
      const action = () => module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: checkerPath, registrationFiles: ["package.json"] },
      });
      if (accepted) assert.equal(action().ok, true, command.replaceAll("\n", "<LF>"));
      else assert.throws(action, /executable|execution|registration|执行/iu, command);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("workflow 与 Hook 必须校验完整命令块，不能忽略非法空 segment", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?surface-command-block=${Date.now()}`);
  const checkerPath = "tools/check-exp-001.mjs";
  const cases = [
    [".github/workflows/quality.yml", `jobs:\n  quality:\n    steps:\n      - run: |\n          ;\n          node ${checkerPath}\n`],
    [".github/workflows/quality.yml", `jobs:\n  quality:\n    steps:\n      - run: |\n          node ${checkerPath}\n          &&\n`],
    [".github/workflows/quality.yml", `jobs:\n  quality:\n    steps:\n      - run: node ${checkerPath} &&& echo done\n`],
    [".github/workflows/quality.yml", `jobs:\n  quality:\n    steps:\n      - run: |\n          node ${checkerPath} ||| echo done\n`],
    ["hooks/check-experience.sh", `;\nnode ${checkerPath}\n`],
    ["hooks/check-experience.sh", `node ${checkerPath}\n&&\n`],
    ["hooks/check-experience.sh", `node ${checkerPath} &&& echo done\n`],
    ["hooks/check-experience.sh", `node ${checkerPath} ||| echo done\n`],
  ];
  for (const [registrationFile, registrationContent] of cases) {
    const target = makeTarget("vibe-exp-invalid-surface-block-");
    try {
      const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
      const ledger = sampleLedger({
        experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
        processedEvents: [{ ...event(), experienceId: "EXP-001" }],
      });
      setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
      write(target, checkerPath, checkerContent);
      write(target, registrationFile, registrationContent);
      assert.throws(() => module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: checkerPath, registrationFiles: [registrationFile] },
      }), /executable|execution|registration|执行/iu, registrationFile);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

const workflowStepModule = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?workflow-step-run=${Date.now()}`);
const workflowCheckerPath = "tools/check-exp-001.mjs";
for (const [name, workflowContent] of [
  ["root/env run", `env:\n  run: node ${workflowCheckerPath}\nsteps: []\n`],
  ["root steps", `steps:\n  - run: node ${workflowCheckerPath}\n`],
  ["tab indentation", `jobs:\n\tquality:\n\t\tsteps:\n\t\t\t- run: node ${workflowCheckerPath}\n`],
  ["inline marker without whitespace", `jobs:\n  quality:\n    steps:\n      -run: node ${workflowCheckerPath}\n`],
  ["URL scalar step", `jobs:\n  quality:\n    steps:\n      - http://example.invalid\n        run: node ${workflowCheckerPath}\n`],
  ["form-feed indentation", `jobs:\n\f\fquality:\n\f\f\f\fsteps:\n\f\f\f\f\f\f- run: node ${workflowCheckerPath}\n`],
  ["duplicate root jobs", `jobs:\n  shadowed:\n    steps:\n      - run: echo first\njobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n`],
  ["duplicate quoted root jobs", `jobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n"jobs": {}\n`],
  ["duplicate root jobs with inline override", `jobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\njobs: {}\n`],
  ["duplicate job mapping", `jobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n  quality:\n    steps: []\n`],
  ["duplicate quoted job mapping", `jobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n  "quality":\n    steps: []\n`],
  ["duplicate steps mapping", `jobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n    steps: []\n`],
  ["duplicate quoted steps mapping", `jobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n    "steps": []\n`],
  ["duplicate run mapping", `jobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n        run: echo overridden\n`],
  ["duplicate quoted run mapping", `jobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n        "run": echo overridden\n`],
  ["duplicate escaped quoted run mapping", `jobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n        "\\x72un": echo overridden\n`],
  ["control character outside indentation", `jobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n\u0000invalid: true\n`],
  ["tab outside indentation", `name:\tquality\njobs:\n  quality:\n    steps:\n      - run: node ${workflowCheckerPath}\n`],
  ["malformed literal scalar header", `jobs:\n  quality:\n    steps:\n      - run: |-garbage\n          node ${workflowCheckerPath}\n`],
  ["scalar step", `jobs:\n  quality:\n    steps:\n      - scalar\n        run: node ${workflowCheckerPath}\n`],
  ["nested env run", `jobs:\n  quality:\n    steps:\n      - name: fake env run\n        env:\n          run: node ${workflowCheckerPath}\n`],
  ["folded run", `jobs:\n  quality:\n    steps:\n      - run: >\n          echo folded\n          node ${workflowCheckerPath}\n`],
]) {
  await check(`workflow registration 拒绝 ${name}`, async () => {
    const target = makeTarget("vibe-exp-workflow-step-run-");
    try {
      const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
      const ledger = sampleLedger({
        experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
        processedEvents: [{ ...event(), experienceId: "EXP-001" }],
      });
      setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
      write(target, workflowCheckerPath, checkerContent);
      write(target, ".github/workflows/quality.yml", workflowContent);
      assert.throws(() => workflowStepModule.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: workflowCheckerPath, registrationFiles: [".github/workflows/quality.yml"] },
      }), /executable|execution|registration|执行/iu, workflowContent);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
}

await check("workflow registration 接受 canonical dash-only step mapping", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?workflow-dash-only-step=${Date.now()}`);
  const target = makeTarget("vibe-exp-workflow-dash-only-step-");
  try {
    const checkerPath = "tools/check-exp-001.mjs";
    const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
    const workflowContent = `jobs:\n  quality:\n    steps:\n      -\n        run: node ${checkerPath}\n`;
    const ledger = sampleLedger({
      experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
      processedEvents: [{ ...event(), experienceId: "EXP-001" }],
    });
    setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
    write(target, checkerPath, checkerContent);
    write(target, ".github/workflows/quality.yml", workflowContent);
    const result = module.executeExperienceAction({
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "elevate",
      expectedRevision: 1,
      experienceId: "EXP-001",
      confirmation: confirmation("elevate", { tier: "L2" }),
      hardening: { path: checkerPath, registrationFiles: [".github/workflows/quality.yml"] },
    });
    assert.equal(result.ok, true);
    const registry = parseExperienceRegistry(fs.readFileSync(path.join(target, "docs/项目治理/宪法设计.md"), "utf8")).registry;
    assert.equal(registry.rules[0].hardening.registrations[0].entry, "run:5");
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("workflow registration 保留 inline、dash-only、mapping、literal 与多 job/step 完整 match-set", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?workflow-positive-subset=${Date.now()}`);
  const target = makeTarget("vibe-exp-workflow-positive-subset-");
  try {
    const checkerPath = "tools/check-exp-001.mjs";
    const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
    const workflowContent = `jobs:\n  first:\n    steps:\n      - run: node ${checkerPath} --inline\n      -\n        run: |\n          node ${checkerPath} --literal\n      - run: |-\n          node ${checkerPath} --literal-strip\n  second:\n    steps:\n      - name: mapped step\n        run: node ${checkerPath} --mapping\n`;
    const ledger = sampleLedger({
      experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
      processedEvents: [{ ...event(), experienceId: "EXP-001" }],
    });
    setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
    write(target, checkerPath, checkerContent);
    write(target, ".github/workflows/quality.yml", workflowContent);
    const result = module.executeExperienceAction({
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "elevate",
      expectedRevision: 1,
      experienceId: "EXP-001",
      confirmation: confirmation("elevate", { tier: "L2" }),
      hardening: { path: checkerPath, registrationFiles: [".github/workflows/quality.yml"] },
    });
    assert.equal(result.ok, true);
    const registry = parseExperienceRegistry(fs.readFileSync(path.join(target, "docs/项目治理/宪法设计.md"), "utf8")).registry;
    assert.deepEqual(
      registry.rules[0].hardening.registrations.map((item) => item.command),
      [
        `node ${checkerPath} --inline`,
        `node ${checkerPath} --literal`,
        `node ${checkerPath} --literal-strip`,
        `node ${checkerPath} --mapping`,
      ],
    );
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("未加引号的单管道与中间单 ampersand 不得被合法 checker 遮蔽", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?single-shell-operator=${Date.now()}`);
  const checkerPath = "tools/check-exp-001.mjs";
  const commands = [
    `node ${checkerPath} | node --check ${checkerPath}`,
    `node ${checkerPath} & node --check ${checkerPath}`,
    `"&" node ${checkerPath}`,
  ];
  for (const command of commands) {
    const target = makeTarget("vibe-exp-single-shell-operator-");
    try {
      const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
      const packageContent = `${JSON.stringify({ scripts: { "check:experience": command } }, null, 2)}\n`;
      const ledger = sampleLedger({
        experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
        processedEvents: [{ ...event(), experienceId: "EXP-001" }],
      });
      setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
      write(target, checkerPath, checkerContent);
      write(target, "package.json", packageContent);
      assert.throws(() => module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: checkerPath, registrationFiles: ["package.json"] },
      }), /executable|execution|registration|执行/iu, command);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("package、workflow 与 Hook 保存同一执行块内全部 checker segment", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?complete-command-block-match-set=${Date.now()}`);
  const checkerPath = "tools/check-exp-001.mjs";
  const commands = [`node ${checkerPath} --mode a`, `node ${checkerPath} --mode b`];
  const surfaces = [
    {
      file: "package.json",
      content: `${JSON.stringify({ scripts: { "check:experience": commands.join("; ") } }, null, 2)}\n`,
      type: "package-script",
      entry: "scripts.check:experience",
    },
    {
      file: ".github/workflows/quality.yml",
      content: `jobs:\n  quality:\n    steps:\n      - run: ${commands.join("; ")}\n`,
      type: "workflow-run",
      entry: "run:4",
    },
    {
      file: ".github/workflows/quality.yml",
      content: `jobs:\n  quality:\n    steps:\n      - run: |\n          ${commands.join("; ")}\n`,
      type: "workflow-run",
      entry: "run:4",
    },
    {
      file: "hooks/check-experience.sh",
      content: `#!/usr/bin/env bash\n${commands.join("; ")}\n`,
      type: "line-command",
      entry: "line:2",
    },
  ];
  for (const surface of surfaces) {
    const target = makeTarget("vibe-exp-complete-block-match-set-");
    try {
      const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
      const ledger = sampleLedger({
        experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
        processedEvents: [{ ...event(), experienceId: "EXP-001" }],
      });
      setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
      write(target, checkerPath, checkerContent);
      write(target, surface.file, surface.content);
      const result = module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: checkerPath, registrationFiles: [surface.file] },
      });
      assert.equal(result.ok, true);
      const registry = parseExperienceRegistry(fs.readFileSync(path.join(target, "docs/项目治理/宪法设计.md"), "utf8")).registry;
      const registrations = registry.rules[0].hardening.registrations;
      assert.deepEqual(registrations.map(({ type, entry, command }) => ({ type, entry, command })), commands.map((command) => ({
        type: surface.type,
        entry: surface.entry,
        command,
      })), surface.file);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("L3 hardening 记录并退役同文件 checker 的完整 canonical match-set", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?complete-match-set=${Date.now()}`);
  const surfaces = [
    {
      file: "package.json",
      content: `${JSON.stringify({ scripts: {
        "check:experience:a": "node tools/check-exp-001.mjs --mode a",
        "check:experience:b": "node tools/check-exp-001.mjs --mode b",
      } }, null, 2)}\n`,
      entries: ["scripts.check:experience:a", "scripts.check:experience:b"],
      retiredContent: `${JSON.stringify({ scripts: {} }, null, 2)}\n`,
    },
    {
      file: ".github/workflows/quality.yml",
      content: "jobs:\n  quality:\n    steps:\n      - run: node tools/check-exp-001.mjs --mode a\n      - run: node tools/check-exp-001.mjs --mode b\n",
      entries: ["run:4", "run:5"],
      retiredContent: "jobs:\n  quality:\n    steps:\n",
    },
    {
      file: "hooks/check-experience.sh",
      content: "#!/usr/bin/env bash\nnode tools/check-exp-001.mjs --mode a\nnode tools/check-exp-001.mjs --mode b\n",
      entries: ["line:2", "line:3"],
      retiredContent: "#!/usr/bin/env bash\n",
    },
  ];
  for (const surface of surfaces) {
    const target = makeTarget("vibe-exp-complete-match-set-");
    try {
      const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
      const ledger = sampleLedger({
        experiences: [{ ...sampleLedger().experiences[0], tier: "L2", count: 8 }],
        processedEvents: [{ ...event(), experienceId: "EXP-001" }],
      });
      setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active" }]);
      write(target, "tools/check-exp-001.mjs", checkerContent);
      write(target, surface.file, surface.content);
      const elevated = module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("elevate", { tier: "L2" }),
        hardening: { path: "tools/check-exp-001.mjs", registrationFiles: [surface.file] },
      });
      const registry = parseExperienceRegistry(fs.readFileSync(path.join(target, "docs/项目治理/宪法设计.md"), "utf8")).registry;
      const stored = registry.rules[0].hardening.registrations;
      assert.deepEqual(stored.map((item) => item.entry).sort(), [...surface.entries].sort(), `${surface.file} 必须保存全部 entry`);

      const recorded = module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "record",
        expectedRevision: elevated.revision,
        experienceId: "EXP-001",
        event: event({ eventId: "EVT-RETIRE-SET", promptHash: sha256(`retire-${surface.file}`) }),
      });
      const retired = module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "retire",
        expectedRevision: recorded.revision,
        experienceId: "EXP-001",
        confirmation: confirmation("retire", {
          receiptId: `CONF-RETIRE-${surface.file}`,
          eventId: "EVT-RETIRE-SET",
          tier: "L3",
        }),
      });
      assert.equal(retired.ok, true);
      assert.equal(fs.readFileSync(path.join(target, surface.file), "utf8"), surface.retiredContent);
      assert.equal(fs.existsSync(path.join(target, "tools/check-exp-001.mjs")), false);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("checksum 合法的 registry 仍必须拒绝畸形 hardening 结构", () => {
  const valid = {
    checker: { path: "tools/check-exp-001.mjs", hash: sha256("checker"), owned: true },
    registrations: [{
      type: "package-script",
      path: "package.json",
      hash: sha256("package"),
      entry: "scripts.check:experience",
      command: "node tools/check-exp-001.mjs",
    }],
  };
  const malformed = [
    { ...valid, checker: { ...valid.checker, path: "../outside.mjs" } },
    { ...valid, checker: { ...valid.checker, hash: "bad" } },
    { ...valid, checker: { ...valid.checker, owned: "yes" } },
    { ...valid, registrations: [{ ...valid.registrations[0], path: "../package.json" }] },
    { ...valid, registrations: [{ ...valid.registrations[0], hash: "bad" }] },
    { ...valid, registrations: [{ ...valid.registrations[0], type: "unknown" }] },
    { ...valid, registrations: [{ ...valid.registrations[0], entry: "" }] },
    { ...valid, registrations: [{ ...valid.registrations[0], command: "" }] },
  ];
  for (const hardening of malformed) {
    assert.throws(
      () => parseExperienceRegistry(registryBlock([{ experienceId: "EXP-001", text: "规则", status: "active", hardening }])),
      /hardening|checker|registration|path|hash|owned|entry|command/iu,
    );
  }
});

await check("L3 退役会 fresh 验证 hardening，拒绝伪路径、间接残留及 evidence 漂移且不改文件", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?retire-adversarial=${Date.now()}`);
  const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
  const registrationContent = "jobs:\n  quality:\n    steps:\n      - run: node tools/check-exp-001.mjs\n";
  const validHardening = {
    checker: { path: "tools/check-exp-001.mjs", hash: sha256(checkerContent), owned: true },
    registrations: [{
      type: "workflow-run",
      path: ".github/workflows/quality.yml",
      hash: sha256(registrationContent),
      entry: "run:4",
      command: "node tools/check-exp-001.mjs",
    }],
  };
  const scenarios = [
    {
      name: "README 伪注册",
      prepare(target) {
        const fake = {
          ...validHardening,
          registrations: [{
            type: "line-command",
            path: "README.md",
            hash: sha256("must survive\n"),
            entry: "line:1",
            command: "node tools/check-exp-001.mjs",
          }],
        };
        write(target, "docs/项目治理/宪法设计.md", `# 宪法设计\n\n${registryBlock([{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active", hardening: fake }])}\n`);
      },
    },
    {
      name: "registration hash 漂移",
      prepare(target) {
        write(target, ".github/workflows/quality.yml", `${registrationContent}# drift\n`);
      },
    },
    {
      name: "registration entry 漂移",
      prepare(target) {
        const drift = {
          ...validHardening,
          registrations: [{ ...validHardening.registrations[0], entry: "run:99" }],
        };
        write(target, "docs/项目治理/宪法设计.md", `# 宪法设计\n\n${registryBlock([{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active", hardening: drift }])}\n`);
      },
    },
    {
      name: "registration command 漂移",
      prepare(target) {
        const drift = {
          ...validHardening,
          registrations: [{ ...validHardening.registrations[0], command: "node ./tools/check-exp-001.mjs" }],
        };
        write(target, "docs/项目治理/宪法设计.md", `# 宪法设计\n\n${registryBlock([{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active", hardening: drift }])}\n`);
      },
    },
    {
      name: "间接执行残留",
      prepare() {},
      replacement: {
        ".github/workflows/quality.yml": "jobs:\n  quality:\n    steps:\n      - run: |\n          CHECKER=tools/check-exp-001.mjs\n          node \"$CHECKER\"\n",
      },
    },
    {
      name: "分段变量注入 replacement",
      prepare() {},
      replacement: {
        ".github/workflows/quality.yml": "jobs:\n  quality:\n    steps:\n      - run: |\n          BASE=tools\n          NAME=check-exp-001.mjs\n          node \"$BASE/$NAME\"\n",
      },
    },
  ];
  for (const scenario of scenarios) {
    const target = makeTarget("vibe-exp-retire-adversarial-");
    try {
      const ledger = sampleLedger({
        experiences: [{ ...sampleLedger().experiences[0], tier: "L3", count: 0, landing: "tools/check-exp-001.mjs" }],
        processedEvents: [{ ...event({ eventId: "EVT-RETIRE" }), experienceId: "EXP-001" }],
      });
      setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active", hardening: validHardening }]);
      write(target, "tools/check-exp-001.mjs", checkerContent);
      write(target, ".github/workflows/quality.yml", registrationContent);
      write(target, "README.md", "must survive\n");
      scenario.prepare(target);
      const tracked = [
        "docs/项目治理/经验治理.md",
        "docs/项目治理/宪法设计.md",
        "AGENTS.md",
        "CLAUDE.md",
        ".vibe-runtime.json",
        "tools/check-exp-001.mjs",
        ".github/workflows/quality.yml",
        "README.md",
      ];
      const before = Object.fromEntries(tracked.map((file) => [file, fs.readFileSync(path.join(target, file), "utf8")]));
      const retirement = scenario.replacement ? { registrationUpdates: scenario.replacement } : undefined;
      assert.throws(() => module.executeExperienceAction({
        targetRoot: target,
        skillsRoot: repoRoot,
        action: "retire",
        expectedRevision: 1,
        experienceId: "EXP-001",
        confirmation: confirmation("retire", { eventId: "EVT-RETIRE", tier: "L3" }),
        retirement,
      }), /hardening|registration|checker|path|hash|entry|command|残留|references|executes/iu, scenario.name);
      for (const file of tracked) {
        assert.equal(fs.readFileSync(path.join(target, file), "utf8"), before[file], `${scenario.name} 不得修改 ${file}`);
      }
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

await check("L3 退役拒绝 stored match-set 少于当前 fresh match-set", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?incomplete-match-set=${Date.now()}`);
  const target = makeTarget("vibe-exp-incomplete-match-set-");
  try {
    const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
    const workflowContent = "jobs:\n  quality:\n    steps:\n      - run: node tools/check-exp-001.mjs\n      - run: node tools/check-exp-001.mjs --second\n";
    const incompleteHardening = {
      checker: { path: "tools/check-exp-001.mjs", hash: sha256(checkerContent), owned: true },
      registrations: [{
        type: "workflow-run",
        path: ".github/workflows/quality.yml",
        hash: sha256(workflowContent),
        entry: "run:4",
        command: "node tools/check-exp-001.mjs",
      }],
    };
    const ledger = sampleLedger({
      experiences: [{ ...sampleLedger().experiences[0], tier: "L3", count: 0, landing: "tools/check-exp-001.mjs" }],
      processedEvents: [{ ...event({ eventId: "EVT-RETIRE" }), experienceId: "EXP-001" }],
    });
    setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active", hardening: incompleteHardening }]);
    write(target, "tools/check-exp-001.mjs", checkerContent);
    write(target, ".github/workflows/quality.yml", workflowContent);
    const tracked = [
      "docs/项目治理/经验治理.md",
      "docs/项目治理/宪法设计.md",
      "AGENTS.md",
      "CLAUDE.md",
      ".vibe-runtime.json",
      "tools/check-exp-001.mjs",
      ".github/workflows/quality.yml",
    ];
    const before = Object.fromEntries(tracked.map((file) => [file, fs.readFileSync(path.join(target, file), "utf8")]));
    assert.throws(() => module.executeExperienceAction({
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "retire",
      expectedRevision: 1,
      experienceId: "EXP-001",
      confirmation: confirmation("retire", { eventId: "EVT-RETIRE", tier: "L3" }),
    }), /match-set|registration|entry|完整|集合|fresh/iu);
    for (const file of tracked) assert.equal(fs.readFileSync(path.join(target, file), "utf8"), before[file]);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("L3 退役拒绝任意文件操作、伪步骤和漏更新，并按证据完整撤销", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?retire=${Date.now()}`);
  const target = makeTarget("vibe-exp-retire-");
  try {
    const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
    const registrationContent = "jobs:\n  quality:\n    steps:\n      - run: node tools/check-exp-001.mjs\n";
    const hardening = {
      checker: { path: "tools/check-exp-001.mjs", hash: sha256(checkerContent), owned: true },
      registrations: [{
        type: "workflow-run",
        path: ".github/workflows/quality.yml",
        hash: sha256(registrationContent),
        entry: "run:4",
        command: "node tools/check-exp-001.mjs",
      }],
    };
    const ledger = sampleLedger({
      experiences: [{ ...sampleLedger().experiences[0], tier: "L3", count: 0, landing: "tools/check-exp-001.mjs" }],
      processedEvents: [{ ...event({ eventId: "EVT-RETIRE" }), experienceId: "EXP-001" }],
    });
    setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active", hardening }]);
    write(target, "tools/check-exp-001.mjs", checkerContent);
    write(target, ".github/workflows/quality.yml", registrationContent);
    write(target, "README.md", "must survive\n");
    const base = {
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "retire",
      expectedRevision: 1,
      experienceId: "EXP-001",
      confirmation: confirmation("retire", { eventId: "EVT-RETIRE", tier: "L3" }),
    };
    assert.throws(() => module.executeExperienceAction({
      ...base,
      retirement: { l3Operations: [{ file: "README.md", content: null }] },
    }), /l3Operations|任意.*操作|forbidden/iu);
    assert.equal(fs.readFileSync(path.join(target, "README.md"), "utf8"), "must survive\n");
    assert.throws(() => module.executeExperienceAction({ ...base, retirement: { removed: ["L1:fake"] } }), /removed|伪步骤|caller/iu);
    assert.throws(() => module.executeExperienceAction({ ...base, retirement: { registrationUpdates: {} } }), /registration.*update|登记.*更新|forbidden|不接受/iu);

    const result = module.executeExperienceAction(base);
    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(path.join(target, "tools/check-exp-001.mjs")), false, "owned checker must be deleted");
    assert.equal(fs.readFileSync(path.join(target, ".github/workflows/quality.yml"), "utf8"), "jobs:\n  quality:\n    steps:\n");
    const retiredLedger = ledgerCore.parseLedger(fs.readFileSync(path.join(target, "docs/项目治理/经验治理.md"), "utf8"));
    assert.deepEqual(retiredLedger.archived[0].retirement.removed.map((item) => item.split(":", 1)[0]), ["L3", "L2", "L1"]);
    assert.equal(parseExperienceRegistry(fs.readFileSync(path.join(target, "docs/项目治理/宪法设计.md"), "utf8")).registry.rules.length, 0);
    assert.doesNotMatch(fs.readFileSync(path.join(target, "AGENTS.md"), "utf8"), /\[EXP-001\]/u);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("L3 退役按 hardening type 确定性删除 exact package、workflow 与 Hook 注册", async () => {
  const module = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?retire-structured=${Date.now()}`);
  const target = makeTarget("vibe-exp-retire-structured-");
  try {
    const checkerContent = "// vibe-experience-owner: EXP-001\nconsole.log('checked');\n";
    const packageContent = `${JSON.stringify({
      scripts: {
        keep: "node tools/keep.mjs",
        "check:experience": "node tools/check-exp-001.mjs",
      },
    }, null, 2)}\n`;
    const workflowContent = "jobs:\n  quality:\n    steps:\n      - run: node tools/check-exp-001.mjs\n      - run: node tools/keep.mjs\n";
    const hookContent = "#!/usr/bin/env bash\nnode tools/check-exp-001.mjs\necho keep\n";
    const hardening = {
      checker: { path: "tools/check-exp-001.mjs", hash: sha256(checkerContent), owned: true },
      registrations: [
        {
          type: "package-script",
          path: "package.json",
          hash: sha256(packageContent),
          entry: "scripts.check:experience",
          command: "node tools/check-exp-001.mjs",
        },
        {
          type: "workflow-run",
          path: ".github/workflows/quality.yml",
          hash: sha256(workflowContent),
          entry: "run:4",
          command: "node tools/check-exp-001.mjs",
        },
        {
          type: "line-command",
          path: "hooks/check-experience.sh",
          hash: sha256(hookContent),
          entry: "line:2",
          command: "node tools/check-exp-001.mjs",
        },
      ],
    };
    const ledger = sampleLedger({
      experiences: [{ ...sampleLedger().experiences[0], tier: "L3", count: 0, landing: "tools/check-exp-001.mjs" }],
      processedEvents: [{ ...event({ eventId: "EVT-RETIRE" }), experienceId: "EXP-001" }],
    });
    setupGovernedTarget(target, ledger, [{ experienceId: "EXP-001", text: "必须执行项目 checker。", status: "active", hardening }]);
    write(target, "tools/check-exp-001.mjs", checkerContent);
    write(target, "package.json", packageContent);
    write(target, ".github/workflows/quality.yml", workflowContent);
    write(target, "hooks/check-experience.sh", hookContent);

    const result = module.executeExperienceAction({
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "retire",
      expectedRevision: 1,
      experienceId: "EXP-001",
      confirmation: confirmation("retire", { eventId: "EVT-RETIRE", tier: "L3" }),
    });
    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(path.join(target, "tools/check-exp-001.mjs")), false);
    const packageJson = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    assert.equal(packageJson.scripts["check:experience"], undefined);
    assert.equal(packageJson.scripts.keep, "node tools/keep.mjs");
    assert.equal(fs.readFileSync(path.join(target, ".github/workflows/quality.yml"), "utf8"), "jobs:\n  quality:\n    steps:\n      - run: node tools/keep.mjs\n");
    assert.equal(fs.readFileSync(path.join(target, "hooks/check-experience.sh"), "utf8"), "#!/usr/bin/env bash\necho keep\n");
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

await check("orchestrator 以 expectedRevision 原子记录事件并发布 runtime 投影", async () => {
  const modulePath = path.join(repoRoot, "tools", "experience-governance.mjs");
  assert.equal(fs.existsSync(modulePath), true, "缺少统一 experience governance orchestrator");
  const module = await import(`${pathToFileURL(modulePath).href}?integration=${Date.now()}`);
  const target = makeTarget("vibe-exp-orchestrator-");
  try {
    setupGovernedTarget(target, sampleLedger(), []);
    const result = module.executeExperienceAction({
      targetRoot: target,
      skillsRoot: repoRoot,
      action: "record",
      expectedRevision: 1,
      experienceId: "EXP-001",
      event: {
        eventId: "EVT-004",
        signalType: "explicit-correction",
        scope: "target-project",
        promptHash: sha256("orchestrator prompt"),
        occurredAt: "2026-07-23T10:04:00.000Z",
      },
    });
    assert.equal(result.ok, true);
    const ledger = ledgerCore.parseLedger(fs.readFileSync(path.join(target, "docs/项目治理/经验治理.md"), "utf8"));
    assert.equal(ledger.revision, 2);
    assert.equal(ledger.experiences[0].count, 3);
    assert.equal(ledger.processedEvents.some((item) => item.eventId === "EVT-004"), true);
    assert.equal(fs.existsSync(path.join(target, "AGENTS.md")), true);
    assert.equal(fs.existsSync(path.join(target, "CLAUDE.md")), true);
    assert.equal(fs.existsSync(path.join(target, ".vibe-experience-transaction.json")), false);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
