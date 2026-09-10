#!/usr/bin/env node
// DocMap:
// Layer: L3 / experience ledger checker tests
// Module: tools
// Depends on: tools/check-experience-ledger.mjs, tools/experience-ledger-core.mjs
// Syncs with: skills/experience-elevator/SKILL.md
//
// 作用（大白话）：给"经验治理台账体检器"当守门员。
// check-experience-ledger.mjs 只报告不修改：把 `经验治理.md` 的机器真源和人类正文对一遍账，
// 真源非法、字段缺失、档位非法、id 重复、投影与真源对不上 → 报错。
// "计数达阀值还没升档" 属正常待办（等用户拍板），只提示不算错。
//
// 用法：node tools/test-check-experience-ledger.mjs

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { checkLedgerText } from "./check-experience-ledger.mjs";
import { elevateExperience, renderLedgerMarkdown } from "./experience-ledger-core.mjs";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value, "utf8").digest("hex")}`;
}

// 造一份合法台账（借用内核渲染，保证真源与投影天然一致）。
function validLedgerText(overrides = {}) {
  const ledger = {
    vibeExperienceLedger: "v1",
    thresholds: { L0: 3, L1: 5, L2: 8 },
    experiences: [
      {
        id: "EXP-001",
        summary: "改样式误动全局 token",
        tier: "L0",
        count: 2,
        trajectory: ["2026-07-16 记录@L0"],
        landing: null,
      },
    ],
    ...overrides,
  };
  return renderLedgerMarkdown(ledger);
}

function validV2LedgerText(overrides = {}) {
  return renderLedgerMarkdown({
    vibeExperienceLedger: "v2",
    revision: 1,
    l1RegistryAnchor: null,
    thresholds: { L0: 3, L1: 5, L2: 8 },
    processedEvents: [],
    consumedConfirmations: [],
    experiences: [{
      id: "EXP-001",
      summary: "重复踩坑",
      tier: "L0",
      count: 1,
      trajectory: ["2026-07-23 记录@L0"],
      landing: null,
    }],
    archived: [],
    ...overrides,
  });
}

// ---- 合法台账应 PASS ----
check("合法台账：ok=true，无 error", () => {
  const result = checkLedgerText(validLedgerText());
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

// ---- 结构级错误应 FAIL ----
check("缺真源块：ok=false", () => {
  const result = checkLedgerText("# 经验治理\n\n没有 json 真源\n");
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 1);
});

check("真源 JSON 非法：ok=false", () => {
  const text = ["```json vibe-experience-ledger", "{ 坏 json", "```"].join("\n");
  const result = checkLedgerText(text);
  assert.equal(result.ok, false);
});

check("ledger v2 consumedConfirmations 畸形时 checker 复用核心 validator 并失败", () => {
  const result = checkLedgerText(validV2LedgerText({ consumedConfirmations: [{}] }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /consumedConfirmations|receiptId/u);
});

check("ledger v2 archived tombstone 不完整或机器记录含额外字段时 checker fail closed", () => {
  const malformedArchived = checkLedgerText(validV2LedgerText({
    experiences: [],
    archived: [{ id: "EXP-001" }],
  }));
  assert.equal(malformedArchived.ok, false);
  assert.match(malformedArchived.errors.join("\n"), /archived|summary|tier|count|trajectory|canonical|字段/u);

  const eventWithExtraField = checkLedgerText(validV2LedgerText({
    processedEvents: [{
      eventId: "EVT-001",
      signalType: "explicit-correction",
      scope: "target-project",
      promptHash: `sha256:${"0".repeat(64)}`,
      occurredAt: "2026-07-23T10:00:00.000Z",
      experienceId: "EXP-001",
      injected: true,
    }],
  }));
  assert.equal(eventWithExtraField.ok, false);
  assert.match(eventWithExtraField.errors.join("\n"), /processedEvents|injected|未知|额外|canonical/u);
});

check("checker 拒绝全局 consumed 与内嵌 confirmationHistory 不双向一致", () => {
  const event = {
    eventId: "EVT-001",
    signalType: "explicit-correction",
    scope: "target-project",
    promptHash: sha256("prompt"),
    occurredAt: "2026-07-23T09:59:00.000Z",
    experienceId: "EXP-001",
  };
  const confirmation = {
    receiptId: "CONF-001",
    eventId: "EVT-001",
    experienceId: "EXP-001",
    scope: "target-project",
    action: "elevate",
    tier: "L0",
    confirmedAt: "2026-07-23T10:00:00.000Z",
  };
  confirmation.confirmationHash = sha256(JSON.stringify(confirmation));
  const base = {
    vibeExperienceLedger: "v2",
    revision: 1,
    l1RegistryAnchor: null,
    thresholds: { L0: 3, L1: 5, L2: 8 },
    processedEvents: [event],
    consumedConfirmations: [],
    experiences: [{ id: "EXP-001", summary: "重复踩坑", tier: "L0", count: 3, trajectory: ["2026-07-23 记录@L0"], landing: null }],
    archived: [],
  };
  const malformed = elevateExperience(base, "EXP-001", { confirmation });
  delete malformed.experiences[0].confirmationHistory;
  const result = checkLedgerText(renderLedgerMarkdown(malformed));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /confirmationHistory|consumedConfirmations|一致|缺少/u);
});

check("checker 拒绝 confirmation 未覆盖的额外 canonical transition", () => {
  const event = {
    eventId: "EVT-001",
    signalType: "explicit-correction",
    scope: "target-project",
    promptHash: sha256("prompt"),
    occurredAt: "2026-07-23T09:59:00.000Z",
    experienceId: "EXP-001",
  };
  const confirmation = {
    receiptId: "CONF-001",
    eventId: "EVT-001",
    experienceId: "EXP-001",
    scope: "target-project",
    action: "elevate",
    tier: "L0",
    confirmedAt: "2026-07-23T10:00:00.000Z",
  };
  confirmation.confirmationHash = sha256(JSON.stringify(confirmation));
  const elevated = elevateExperience({
    vibeExperienceLedger: "v2",
    revision: 1,
    l1RegistryAnchor: null,
    thresholds: { L0: 3, L1: 5, L2: 8 },
    processedEvents: [event],
    consumedConfirmations: [],
    experiences: [{ id: "EXP-001", summary: "重复踩坑", tier: "L0", count: 3, trajectory: ["2026-07-23 记录@L0"], landing: null }],
    archived: [],
  }, "EXP-001", { confirmation });
  elevated.experiences[0].trajectory.push("2026-07-23 升档 L1→L2");
  const result = checkLedgerText(renderLedgerMarkdown(elevated));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /trajectory|confirmation|transition|一致|额外/u);
});

check("checker 拒绝 active 当前档位与 canonical transition 最终档位冲突", () => {
  const event = {
    eventId: "EVT-001",
    signalType: "explicit-correction",
    scope: "target-project",
    promptHash: sha256("prompt"),
    occurredAt: "2026-07-23T09:59:00.000Z",
    experienceId: "EXP-001",
  };
  const confirmation = {
    receiptId: "CONF-001",
    eventId: "EVT-001",
    experienceId: "EXP-001",
    scope: "target-project",
    action: "elevate",
    tier: "L0",
    confirmedAt: "2026-07-23T10:00:00.000Z",
  };
  confirmation.confirmationHash = sha256(JSON.stringify(confirmation));
  const elevated = elevateExperience({
    vibeExperienceLedger: "v2",
    revision: 1,
    l1RegistryAnchor: null,
    thresholds: { L0: 3, L1: 5, L2: 8 },
    processedEvents: [event],
    consumedConfirmations: [],
    experiences: [{ id: "EXP-001", summary: "重复踩坑", tier: "L0", count: 3, trajectory: ["2026-07-23 记录@L0"], landing: null }],
    archived: [],
  }, "EXP-001", { confirmation });
  elevated.experiences[0].tier = "L2";
  const result = checkLedgerText(renderLedgerMarkdown(elevated));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /trajectory|transition|tier|档位|最终|一致/u);
});

check("checker 拒绝 Unicode format 字符伪装的 transition", () => {
  const event = {
    eventId: "EVT-001",
    signalType: "explicit-correction",
    scope: "target-project",
    promptHash: sha256("prompt"),
    occurredAt: "2026-07-23T09:59:00.000Z",
    experienceId: "EXP-001",
  };
  const confirmation = {
    receiptId: "CONF-001",
    eventId: "EVT-001",
    experienceId: "EXP-001",
    scope: "target-project",
    action: "elevate",
    tier: "L0",
    confirmedAt: "2026-07-23T10:00:00.000Z",
  };
  confirmation.confirmationHash = sha256(JSON.stringify(confirmation));
  const elevated = elevateExperience({
    vibeExperienceLedger: "v2",
    revision: 1,
    l1RegistryAnchor: null,
    thresholds: { L0: 3, L1: 5, L2: 8 },
    processedEvents: [event],
    consumedConfirmations: [],
    experiences: [{ id: "EXP-001", summary: "重复踩坑", tier: "L0", count: 3, trajectory: ["2026-07-23 记录@L0"], landing: null }],
    archived: [],
  }, "EXP-001", { confirmation });
  elevated.experiences[0].trajectory.push("2026-07-23 升\u200B档 L1→L2");
  const result = checkLedgerText(renderLedgerMarkdown(elevated));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /trajectory|transition|canonical|format|Unicode/u);
});

check("checker 要求 v2 exact canonical l1RegistryAnchor", () => {
  const canonical = checkLedgerText(validV2LedgerText());
  assert.equal(canonical.ok, true);
  const missing = checkLedgerText(validV2LedgerText({ l1RegistryAnchor: undefined }));
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join("\n"), /l1RegistryAnchor|anchor|缺少|必需/u);
});

// ---- 字段级错误应 FAIL ----
check("经验缺 id：ok=false", () => {
  const bad = validLedgerText({
    experiences: [{ summary: "无 id", tier: "L0", count: 1, trajectory: [], landing: null }],
  });
  const result = checkLedgerText(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("id")));
});

check("档位非法值（L9）：ok=false", () => {
  const bad = validLedgerText({
    experiences: [
      { id: "EXP-001", summary: "x", tier: "L9", count: 1, trajectory: [], landing: null },
    ],
  });
  const result = checkLedgerText(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("档位") || e.includes("tier")));
});

check("count 为负数：ok=false", () => {
  const bad = validLedgerText({
    experiences: [
      { id: "EXP-001", summary: "x", tier: "L0", count: -1, trajectory: [], landing: null },
    ],
  });
  const result = checkLedgerText(bad);
  assert.equal(result.ok, false);
});

check("id 重复：ok=false", () => {
  const bad = validLedgerText({
    experiences: [
      { id: "EXP-001", summary: "a", tier: "L0", count: 1, trajectory: [], landing: null },
      { id: "EXP-001", summary: "b", tier: "L0", count: 1, trajectory: [], landing: null },
    ],
  });
  const result = checkLedgerText(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("重复") || e.includes("id")));
});

// ---- 投影一致性 ----
check("正文投影与真源计数对不上：ok=false", () => {
  // 拿合法文本，手动把投影里的计数改花，制造真源↔投影漂移
  const good = validLedgerText();
  const drifted = good.replace("2 / 3", "9 / 3");
  const result = checkLedgerText(drifted);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("投影") || e.includes("一致")));
});

// ---- 达阀值是告警而非错误 ----
check("计数达阀值未升档：ok 仍 true，但有 warning", () => {
  const atThreshold = validLedgerText({
    experiences: [
      { id: "EXP-001", summary: "x", tier: "L0", count: 3, trajectory: ["a"], landing: null },
    ],
  });
  const result = checkLedgerText(atThreshold);
  assert.equal(result.ok, true, "达阀值是正常待办，不应判错");
  assert.ok(result.warnings.length >= 1, "应给出一条待升档提示");
  assert.ok(result.warnings.some((w) => w.includes("EXP-001")));
});

// ---- A-01：缺 thresholds 报明确错误（不再误导为"投影撒谎"）----
check("缺 thresholds：ok=false，错误信息指向 thresholds 而非投影", () => {
  const text = [
    "# 经验治理",
    "",
    "```json vibe-experience-ledger",
    JSON.stringify(
      {
        vibeExperienceLedger: "v1",
        experiences: [
          { id: "EXP-001", summary: "x", tier: "L0", count: 1, trajectory: ["a"], landing: null },
        ],
      },
      null,
      2,
    ),
    "```",
    "",
    "## EXP-001 · x",
    "- 当前档位：L0（阀值 3）",
    "- 当前计数：1 / 3",
    "- 历史轨迹：a",
    "- 落点：（未升级）",
  ].join("\n");
  const result = checkLedgerText(text);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes("thresholds")),
    "错误信息应明确指向 thresholds 缺失",
  );
});

// ---- A-02：thresholds 非法值报错 ----
check("thresholds 某档为 0：ok=false", () => {
  const text = [
    "```json vibe-experience-ledger",
    JSON.stringify(
      {
        vibeExperienceLedger: "v1",
        thresholds: { L0: 0, L1: 5, L2: 8 },
        experiences: [],
      },
      null,
      2,
    ),
    "```",
  ].join("\n");
  const result = checkLedgerText(text);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("thresholds")));
});

console.log(`\n${passed} passed`);
