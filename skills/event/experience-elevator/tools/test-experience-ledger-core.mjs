#!/usr/bin/env node
// DocMap:
// Layer: L3 / experience ledger core tests
// Module: tools
// Depends on: tools/experience-ledger-core.mjs
// Syncs with: skills/experience-elevator/SKILL.md
//
// 作用（大白话）：给"经验治理台账"的核心逻辑当守门员。
// 台账 `经验治理.md` 是四级升级阶梯的唯一计数真源：顶部一段 ```json 代码块是机器真源，
// 下面的中文正文是给人看的投影。这个测试锁死：解析、静默 +1、达阀值判定、升档归零、
// 正文投影重渲这几件事的行为契约。先 RED，后实现。
//
// 用法：node tools/test-experience-ledger-core.mjs

import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  DEFAULT_THRESHOLDS,
  TIER_ORDER,
  parseLedger,
  serializeLedger,
  renderLedgerMarkdown,
  bumpExperience,
  addExperience,
  isAtThreshold,
  elevateExperience,
  removeExperience,
} from "./experience-ledger-core.mjs";

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function governedLedger(overrides = {}) {
  return {
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
      count: 3,
      trajectory: ["2026-07-23 记录@L0"],
      landing: null,
    }],
    archived: [],
    ...overrides,
  };
}

function governedEvent(overrides = {}) {
  return {
    eventId: "EVT-001",
    signalType: "explicit-correction",
    scope: "target-project",
    promptHash: sha256("prompt"),
    occurredAt: "2026-07-23T09:59:00.000Z",
    ...overrides,
  };
}

function confirmation(action, tier = "L0", overrides = {}) {
  const value = {
    receiptId: "CONF-001",
    eventId: "EVT-001",
    experienceId: "EXP-001",
    scope: "target-project",
    action,
    tier,
    confirmedAt: "2026-07-23T10:00:00.000Z",
    ...overrides,
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

function governedLedgerAtL2() {
  const firstEvent = { ...governedEvent(), experienceId: "EXP-001" };
  const once = elevateExperience(governedLedger({ processedEvents: [firstEvent] }), "EXP-001", {
    confirmation: confirmation("elevate"),
  });
  once.experiences[0].count = 5;
  once.processedEvents.push({
    ...governedEvent({ eventId: "EVT-002", promptHash: sha256("prompt-2"), occurredAt: "2026-07-23T10:01:00.000Z" }),
    experienceId: "EXP-001",
  });
  const twice = elevateExperience(once, "EXP-001", {
    confirmation: confirmation("elevate", "L1", { receiptId: "CONF-002", eventId: "EVT-002", confirmedAt: "2026-07-23T10:02:00.000Z" }),
  });
  return { once, twice };
}

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

// 一份最小合法台账原文：顶部 ```json 真源 + 正文投影。
function sampleLedgerText() {
  const source = {
    vibeExperienceLedger: "v1",
    thresholds: { L0: 3, L1: 5, L2: 8 },
    experiences: [
      {
        id: "EXP-001",
        summary: "改样式时误动了全局 token",
        tier: "L0",
        count: 2,
        trajectory: ["2026-07-16 记录@L0"],
        landing: null,
      },
    ],
  };
  const json = JSON.stringify(source, null, 2);
  return [
    "# 经验治理",
    "",
    "> 本文件是经验升级阶梯的唯一计数真源。顶部 json 区由工具维护，请勿手改。",
    "",
    "```json vibe-experience-ledger",
    json,
    "```",
    "",
    "## EXP-001 · 改样式时误动了全局 token",
    "- 当前档位：L0（阀值 3）",
    "- 当前计数：2 / 3",
    "- 历史轨迹：2026-07-16 记录@L0",
    "- 落点：（未升级）",
    "",
  ].join("\n");
}

// ---- 常量契约 ----
check("阶梯顺序为 L0<L1<L2<L3", () => {
  assert.deepEqual(TIER_ORDER, ["L0", "L1", "L2", "L3"]);
});

check("默认阀值逐级递增 3/5/8", () => {
  assert.equal(DEFAULT_THRESHOLDS.L0, 3);
  assert.equal(DEFAULT_THRESHOLDS.L1, 5);
  assert.equal(DEFAULT_THRESHOLDS.L2, 8);
});

// ---- 解析 ----
check("parseLedger 能从 ```json 真源读出结构", () => {
  const ledger = parseLedger(sampleLedgerText());
  assert.equal(ledger.vibeExperienceLedger, "v1");
  assert.equal(ledger.experiences.length, 1);
  assert.equal(ledger.experiences[0].id, "EXP-001");
  assert.equal(ledger.experiences[0].count, 2);
  assert.equal(ledger.thresholds.L0, 3);
});

check("parseLedger 缺 json 真源块时抛错", () => {
  assert.throws(() => parseLedger("# 经验治理\n\n没有 json 真源\n"));
});

check("parseLedger 真源 JSON 非法时抛错", () => {
  const broken = ["```json vibe-experience-ledger", "{ not valid json ", "```"].join("\n");
  assert.throws(() => parseLedger(broken));
});

check("legacy v1 保留 landing 可选兼容性，不受 v2 exact schema 收紧影响", () => {
  const legacy = JSON.parse(JSON.stringify(parseLedger(sampleLedgerText())));
  delete legacy.experiences[0].landing;
  const parsed = parseLedger(serializeLedger(legacy));
  assert.equal(parsed.experiences[0].id, "EXP-001");
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.experiences[0], "landing"), false);
});

// ---- 序列化往返 ----
check("serializeLedger→parseLedger 往返不丢数据", () => {
  const ledger = parseLedger(sampleLedgerText());
  const roundTrip = parseLedger(serializeLedger(ledger));
  assert.deepEqual(roundTrip.experiences, ledger.experiences);
  assert.deepEqual(roundTrip.thresholds, ledger.thresholds);
});

// ---- 静默 +1 ----
check("bumpExperience 命中经验时 count +1", () => {
  const ledger = parseLedger(sampleLedgerText());
  const next = bumpExperience(ledger, "EXP-001");
  assert.equal(next.experiences[0].count, 3);
  // 不可变：原对象不被改动
  assert.equal(ledger.experiences[0].count, 2);
});

check("bumpExperience 未知 id 抛错（不静默吞掉）", () => {
  const ledger = parseLedger(sampleLedgerText());
  assert.throws(() => bumpExperience(ledger, "EXP-404"));
});

// ---- 新记录 ----
check("addExperience 追加一条 L0 新记录并自动分配 id", () => {
  const ledger = parseLedger(sampleLedgerText());
  const next = addExperience(ledger, { summary: "忘跑 sync-compat 同步镜像" });
  assert.equal(next.experiences.length, 2);
  const added = next.experiences[1];
  assert.equal(added.tier, "L0");
  assert.equal(added.count, 1);
  assert.equal(added.id, "EXP-002");
  assert.equal(added.landing, null);
  assert.equal(added.trajectory.length, 1);
});

check("addExperience 生成的 id 不与已有重复", () => {
  let ledger = parseLedger(sampleLedgerText());
  ledger = addExperience(ledger, { summary: "坑A" });
  ledger = addExperience(ledger, { summary: "坑B" });
  const ids = ledger.experiences.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

// ---- 达阀值判定 ----
check("isAtThreshold：count 达当前档阀值为 true", () => {
  const ledger = parseLedger(sampleLedgerText());
  const bumped = bumpExperience(ledger, "EXP-001"); // 2→3，L0 阀值 3
  assert.equal(isAtThreshold(bumped, "EXP-001"), true);
});

check("isAtThreshold：未达阀值为 false", () => {
  const ledger = parseLedger(sampleLedgerText());
  assert.equal(isAtThreshold(ledger, "EXP-001"), false); // count=2 < 3
});

check("isAtThreshold：L3 顶档无阀值恒为 false", () => {
  const ledger = parseLedger(sampleLedgerText());
  const top = elevateExperience(
    elevateExperience(elevateExperience(ledger, "EXP-001"), "EXP-001"),
    "EXP-001",
  ); // L0→L1→L2→L3
  assert.equal(top.experiences[0].tier, "L3");
  assert.equal(isAtThreshold(top, "EXP-001"), false);
});

// ---- 升档 ----
check("elevateExperience：档位上移一级、计数归零、轨迹追加", () => {
  const ledger = parseLedger(sampleLedgerText());
  const bumped = bumpExperience(ledger, "EXP-001"); // count=3
  const elevated = elevateExperience(bumped, "EXP-001");
  const exp = elevated.experiences[0];
  assert.equal(exp.tier, "L1");
  assert.equal(exp.count, 0); // 下级计数归零、从头累积
  // 不可变：升档不得改动入参对象（防止未来误去掉 clone）
  assert.equal(bumped.experiences[0].tier, "L0", "elevate 不得改动入参档位");
  assert.equal(bumped.experiences[0].count, 3, "elevate 不得改动入参计数");
  assert.ok(exp.trajectory.length >= 2, "轨迹应追加升档记录");
  assert.ok(
    exp.trajectory.some((t) => t.includes("L0") && t.includes("L1")),
    "轨迹应体现 L0→L1",
  );
});

check("elevateExperience：L3 已是顶档，再升抛错", () => {
  const ledger = parseLedger(sampleLedgerText());
  let cur = ledger;
  for (let i = 0; i < 3; i += 1) cur = elevateExperience(cur, "EXP-001");
  assert.equal(cur.experiences[0].tier, "L3");
  assert.throws(() => elevateExperience(cur, "EXP-001"));
});

check("elevateExperience：可带落点引用写入 landing", () => {
  const ledger = parseLedger(sampleLedgerText());
  const bumped = bumpExperience(ledger, "EXP-001");
  const elevated = elevateExperience(bumped, "EXP-001", {
    landing: "宪法设计.md#手动扩展区#改样式先确认token",
  });
  assert.equal(
    elevated.experiences[0].landing,
    "宪法设计.md#手动扩展区#改样式先确认token",
  );
});

// ---- 正文投影 ----
check("renderLedgerMarkdown：真源与正文投影一致（含最新 json 块）", () => {
  const ledger = parseLedger(sampleLedgerText());
  const bumped = bumpExperience(ledger, "EXP-001"); // count→3
  const md = renderLedgerMarkdown(bumped);
  // 正文投影必须反映最新计数
  assert.ok(md.includes("EXP-001"), "投影应含经验 id");
  assert.ok(md.includes("3 / 3"), "投影应反映最新计数 3/3");
  // 重新解析渲染结果，真源应与内存一致（投影不撒谎）
  const reparsed = parseLedger(md);
  assert.equal(reparsed.experiences[0].count, 3);
});

check("renderLedgerMarkdown→parseLedger 往返稳定（幂等）", () => {
  const ledger = parseLedger(sampleLedgerText());
  const md1 = renderLedgerMarkdown(ledger);
  const md2 = renderLedgerMarkdown(parseLedger(md1));
  assert.equal(md1, md2);
});

// ---- A-01/A-02：thresholds 缺失或非法必须快速失败（不再静默补默认）----
function ledgerTextWithSource(source) {
  const json = JSON.stringify(source, null, 2);
  return ["```json vibe-experience-ledger", json, "```", ""].join("\n");
}

check("parseLedger：缺 thresholds 抛明确错误（不静默补默认）", () => {
  const text = ledgerTextWithSource({
    vibeExperienceLedger: "v1",
    experiences: [],
  });
  assert.throws(() => parseLedger(text), /thresholds/);
});

check("parseLedger：thresholds 某档为 0 或负数抛错", () => {
  for (const bad of [0, -1]) {
    const text = ledgerTextWithSource({
      vibeExperienceLedger: "v1",
      thresholds: { L0: bad, L1: 5, L2: 8 },
      experiences: [],
    });
    assert.throws(() => parseLedger(text), /thresholds/, `L0=${bad} 应抛错`);
  }
});

check("parseLedger：thresholds 某档为字符串抛错（不静默回退）", () => {
  const text = ledgerTextWithSource({
    vibeExperienceLedger: "v1",
    thresholds: { L0: "3", L1: 5, L2: 8 },
    experiences: [],
  });
  assert.throws(() => parseLedger(text), /thresholds/);
});

check("parseLedger：thresholds 某档为浮点抛错", () => {
  const text = ledgerTextWithSource({
    vibeExperienceLedger: "v1",
    thresholds: { L0: 2.5, L1: 5, L2: 8 },
    experiences: [],
  });
  assert.throws(() => parseLedger(text), /thresholds/);
});

// ---- A-03：内核对脏 count 快速失败 ----
check("bumpExperience：count 为字符串时抛错（不拼成 '31'）", () => {
  const ledger = {
    vibeExperienceLedger: "v1",
    thresholds: { ...DEFAULT_THRESHOLDS },
    experiences: [
      { id: "EXP-001", summary: "x", tier: "L0", count: "3", trajectory: ["a"], landing: null },
    ],
  };
  assert.throws(() => bumpExperience(ledger, "EXP-001"), /count/);
});

check("bumpExperience：count 为浮点时抛错", () => {
  const ledger = {
    vibeExperienceLedger: "v1",
    thresholds: { ...DEFAULT_THRESHOLDS },
    experiences: [
      { id: "EXP-001", summary: "x", tier: "L0", count: 2.5, trajectory: ["a"], landing: null },
    ],
  };
  assert.throws(() => bumpExperience(ledger, "EXP-001"), /count/);
});

// ---- A-04：elevate 缺 trajectory 给明确错误（非通用 TypeError）----
check("elevateExperience：缺 trajectory 时给明确错误", () => {
  const ledger = {
    vibeExperienceLedger: "v1",
    thresholds: { ...DEFAULT_THRESHOLDS },
    experiences: [{ id: "EXP-001", summary: "x", tier: "L0", count: 3, landing: null }],
  };
  assert.throws(() => elevateExperience(ledger, "EXP-001"), /trajectory/);
});

// ---- A-05：render 遇 null 经验给明确错误 ----
check("renderLedgerMarkdown：experiences 含 null 时给明确错误", () => {
  const ledger = {
    vibeExperienceLedger: "v1",
    thresholds: { ...DEFAULT_THRESHOLDS },
    experiences: [null],
  };
  assert.throws(() => renderLedgerMarkdown(ledger), /经验记录|experience/);
});

// ---- A-07：summary 含换行被拒绝（保护投影结构）----
check("addExperience：summary 含换行抛错", () => {
  const ledger = parseLedger(sampleLedgerText());
  assert.throws(() => addExperience(ledger, { summary: "坏\n摘要" }), /换行|摘要|summary/);
});

// ---- 每级归零完整锁定：逐级升档 count 都应为 0 ----
check("elevateExperience：逐级升档每级 count 都归零", () => {
  let led = parseLedger(sampleLedgerText());
  for (const [from, to] of [["L0", "L1"], ["L1", "L2"], ["L2", "L3"]]) {
    led = elevateExperience(led, "EXP-001");
    assert.equal(led.experiences[0].tier, to, `应升到 ${to}`);
    assert.equal(led.experiences[0].count, 0, `${from}→${to} 后 count 应为 0`);
  }
});

// ---- SPEC-DEL-01：removeExperience 从台账移除并归档，轨迹留档 ----
check("removeExperience：移除该条并归档到 archived，原轨迹保留", () => {
  const ledger = parseLedger(sampleLedgerText());
  const next = removeExperience(ledger, "EXP-001", { timestamp: "2026-07-18" });
  // 从活跃列表移除
  assert.equal(next.experiences.find((e) => e.id === "EXP-001"), undefined);
  // 归档区保留，轨迹留档
  assert.ok(Array.isArray(next.archived), "应有 archived 归档区");
  const archived = next.archived.find((e) => e.id === "EXP-001");
  assert.ok(archived, "EXP-001 应进归档区");
  assert.ok(archived.trajectory.length >= 1, "归档保留历史轨迹");
  assert.ok(
    archived.trajectory.some((t) => t.includes("淘汰") || t.includes("removed")),
    "归档应追加淘汰记录",
  );
  // 不可变：原 ledger 不被改动
  assert.ok(ledger.experiences.find((e) => e.id === "EXP-001"), "原对象仍含 EXP-001");
});

check("removeExperience：未知 id 抛错", () => {
  const ledger = parseLedger(sampleLedgerText());
  assert.throws(() => removeExperience(ledger, "EXP-404"), /未知|id/);
});

check("removeExperience 后台账仍能通过 render→parse 往返", () => {
  const ledger = parseLedger(sampleLedgerText());
  const next = removeExperience(ledger, "EXP-001", { timestamp: "2026-07-18" });
  const roundTrip = parseLedger(renderLedgerMarkdown(next));
  assert.ok(Array.isArray(roundTrip.archived));
  assert.equal(roundTrip.archived[0].id, "EXP-001");
});

check("ledger v2 缺 revision、processedEvents、consumedConfirmations 或 archived 时 fail closed", () => {
  for (const field of ["revision", "processedEvents", "consumedConfirmations", "archived"]) {
    const ledger = governedLedger();
    delete ledger[field];
    assert.throws(() => parseLedger(serializeLedger(ledger)), new RegExp(field, "u"));
  }
});

check("processedEvents 保存 occurrence timestamp 并绑定 experienceId", () => {
  const event = governedEvent();
  const next = bumpExperience(governedLedger({ experiences: [{ ...governedLedger().experiences[0], count: 2 }] }), "EXP-001", event);
  assert.deepEqual(next.processedEvents[0], { ...event, experienceId: "EXP-001" });
});

check("processedEvents 每条必须满足 canonical schema、唯一且绑定现有经验", () => {
  const valid = { ...governedEvent(), experienceId: "EXP-001" };
  for (const event of [
    { ...valid, occurredAt: "not-a-time" },
    { ...valid, scope: "package-feedback" },
    { ...valid, experienceId: "EXP-999" },
  ]) {
    assert.throws(() => parseLedger(serializeLedger(governedLedger({ processedEvents: [event] }))), /processedEvents|occurredAt|scope|experienceId|绑定/u);
  }
  assert.throws(
    () => parseLedger(serializeLedger(governedLedger({ processedEvents: [valid, { ...valid }] }))),
    /eventId.*重复|duplicate|唯一/u,
  );
});

check("ledger v2 对 active、archived 与机器记录执行 exact canonical schema", () => {
  const eventRecord = { ...governedEvent(), experienceId: "EXP-001" };
  const retired = removeExperience(governedLedger({ processedEvents: [eventRecord] }), "EXP-001", {
    confirmation: confirmation("retire"),
    retirement: { removed: [] },
  });

  const archivedOnlyId = governedLedger({
    experiences: [],
    processedEvents: [],
    archived: [{ id: "EXP-001" }],
  });
  assert.throws(
    () => parseLedger(serializeLedger(archivedOnlyId)),
    /archived|summary|tier|count|trajectory|canonical|字段/u,
  );

  for (const field of ["summary", "tier", "count", "trajectory"]) {
    const malformedActive = governedLedger();
    delete malformedActive.experiences[0][field];
    assert.throws(
      () => parseLedger(serializeLedger(malformedActive)),
      new RegExp(`experiences|${field}|canonical|字段`, "u"),
    );

    const malformedArchived = structuredClone(retired);
    delete malformedArchived.archived[0][field];
    assert.throws(
      () => parseLedger(serializeLedger(malformedArchived)),
      new RegExp(`archived|${field}|canonical|字段`, "u"),
    );
  }

  const eventWithExtraField = governedLedger({
    processedEvents: [{ ...eventRecord, injected: true }],
  });
  assert.throws(
    () => parseLedger(serializeLedger(eventWithExtraField)),
    /processedEvents|injected|未知|额外|canonical/u,
  );

  const activeWithExtraField = governedLedger();
  activeWithExtraField.experiences[0].injected = true;
  assert.throws(
    () => parseLedger(serializeLedger(activeWithExtraField)),
    /experiences|injected|未知|额外|canonical/u,
  );
});

check("相同 eventId 不同 payload 或 experienceId 必须报 collision", () => {
  const first = bumpExperience(governedLedger({ experiences: [
    { ...governedLedger().experiences[0], count: 2 },
    { id: "EXP-002", summary: "另一个问题", tier: "L0", count: 0, trajectory: [], landing: null },
  ] }), "EXP-001", governedEvent());
  assert.throws(() => bumpExperience(first, "EXP-001", governedEvent({ occurredAt: "2026-07-23T10:01:00.000Z" })), /collision|碰撞/u);
  assert.throws(() => bumpExperience(first, "EXP-002", governedEvent()), /collision|碰撞/u);
});

check("confirmation 重算 canonical hash、校验 ISO 时间和事件经验绑定", () => {
  const ledger = governedLedger({ processedEvents: [{ ...governedEvent(), experienceId: "EXP-001" }] });
  assert.throws(
    () => elevateExperience(ledger, "EXP-001", { confirmation: { ...confirmation("elevate"), confirmationHash: sha256("fake") } }),
    /confirmationHash|hash/u,
  );
  assert.throws(
    () => elevateExperience(ledger, "EXP-001", { confirmation: confirmation("elevate", "L0", { confirmedAt: "not-a-time" }) }),
    /confirmedAt|ISO|时间/u,
  );
  assert.throws(
    () => elevateExperience({ ...ledger, processedEvents: [{ ...governedEvent(), experienceId: "EXP-002" }] }, "EXP-001", { confirmation: confirmation("elevate") }),
    /experienceId|事件.*经验|绑定/u,
  );
});

check("确认 receipt/hash 一次性消费并保留历史，不能跨档重放", () => {
  const ledger = governedLedger({ processedEvents: [{ ...governedEvent(), experienceId: "EXP-001" }] });
  const once = elevateExperience(ledger, "EXP-001", { confirmation: confirmation("elevate") });
  assert.equal(once.consumedConfirmations.length, 1);
  assert.equal(once.consumedConfirmations[0].fromTier, "L0");
  assert.equal(once.consumedConfirmations[0].toTier, "L1");
  assert.equal(once.experiences[0].confirmationHistory.length, 1);
  const replayLedger = { ...once, experiences: [{ ...once.experiences[0], count: 5 }] };
  assert.throws(
    () => elevateExperience(replayLedger, "EXP-001", { confirmation: confirmation("elevate", "L1") }),
    /receipt|confirmationHash|消费|重放/u,
  );
});

check("consumedConfirmations 历史在 parse 时完整校验并保持合法往返", () => {
  const eventRecord = { ...governedEvent(), experienceId: "EXP-001" };
  const legal = elevateExperience(governedLedger({ processedEvents: [eventRecord] }), "EXP-001", {
    confirmation: confirmation("elevate"),
  });
  const roundTrip = parseLedger(renderLedgerMarkdown(legal));
  assert.deepEqual(roundTrip.consumedConfirmations, legal.consumedConfirmations);

  const malformed = structuredClone(legal);
  delete malformed.consumedConfirmations[0].eventId;
  assert.throws(() => parseLedger(serializeLedger(malformed)), /consumedConfirmations|eventId/u);

  const duplicateReceipt = structuredClone(legal);
  const second = confirmation("elevate", "L0", {
    receiptId: legal.consumedConfirmations[0].receiptId,
    confirmedAt: "2026-07-23T10:01:00.000Z",
  });
  duplicateReceipt.consumedConfirmations.push({ ...second, fromTier: "L0", toTier: "L1" });
  assert.throws(() => parseLedger(serializeLedger(duplicateReceipt)), /receiptId|重复|唯一/u);

  const duplicateHash = structuredClone(legal);
  duplicateHash.consumedConfirmations.push({ ...legal.consumedConfirmations[0] });
  assert.throws(() => parseLedger(serializeLedger(duplicateHash)), /confirmationHash|重复|唯一/u);

  const crossTier = structuredClone(legal);
  crossTier.consumedConfirmations[0].fromTier = "L1";
  crossTier.consumedConfirmations[0].toTier = "L2";
  assert.throws(() => parseLedger(serializeLedger(crossTier)), /fromTier|toTier|跨档|tier/u);
});

check("全局 consumedConfirmations 与 experience 内嵌 confirmation 状态双向 exact 一致", () => {
  const firstEvent = { ...governedEvent(), experienceId: "EXP-001" };
  const once = elevateExperience(governedLedger({ processedEvents: [firstEvent] }), "EXP-001", {
    confirmation: confirmation("elevate"),
  });
  const secondEvent = {
    ...governedEvent({
      eventId: "EVT-002",
      promptHash: sha256("prompt-2"),
      occurredAt: "2026-07-23T10:01:00.000Z",
    }),
    experienceId: "EXP-001",
  };
  once.experiences[0].count = 5;
  once.processedEvents.push(secondEvent);
  const twice = elevateExperience(once, "EXP-001", {
    confirmation: confirmation("elevate", "L1", {
      receiptId: "CONF-002",
      eventId: "EVT-002",
      confirmedAt: "2026-07-23T10:02:00.000Z",
    }),
  });
  assert.equal(parseLedger(serializeLedger(twice)).experiences[0].confirmationHistory.length, 2);

  const mutations = [
    ["删除 confirmationHistory", (ledger) => delete ledger.experiences[0].confirmationHistory],
    ["删除 confirmation", (ledger) => delete ledger.experiences[0].confirmation],
    ["同时删除内嵌 confirmation 状态", (ledger) => {
      delete ledger.experiences[0].confirmationHistory;
      delete ledger.experiences[0].confirmation;
    }],
    ["少一条 history", (ledger) => ledger.experiences[0].confirmationHistory.shift()],
    ["伪造 history 顺序", (ledger) => {
      ledger.experiences[0].confirmationHistory.reverse();
      ledger.experiences[0].confirmation = ledger.experiences[0].confirmationHistory.at(-1);
    }],
    ["伪造最后 confirmation", (ledger) => { ledger.experiences[0].confirmation = ledger.experiences[0].confirmationHistory[0]; }],
    ["删除对应升档轨迹", (ledger) => ledger.experiences[0].trajectory.pop()],
  ];
  for (const [name, mutate] of mutations) {
    const malformed = structuredClone(twice);
    mutate(malformed);
    assert.throws(
      () => parseLedger(serializeLedger(malformed)),
      /confirmationHistory|confirmation|consumedConfirmations|trajectory|升档|顺序|一致|绑定/u,
      name,
    );
  }
});

check("canonical transition trajectory 与 confirmation 有序 multiset 双向一致", () => {
  const { twice } = governedLedgerAtL2();
  const ordinary = structuredClone(twice);
  ordinary.experiences[0].trajectory.push("2026-07-23 记录@L2");
  assert.equal(parseLedger(serializeLedger(ordinary)).experiences[0].tier, "L2");

  const mutations = [
    ["额外 transition", (ledger) => ledger.experiences[0].trajectory.push("2026-07-23 升档 L2→L3")],
    ["重复 transition", (ledger) => ledger.experiences[0].trajectory.push(ledger.experiences[0].trajectory[1])],
    ["transition 乱序", (ledger) => {
      [ledger.experiences[0].trajectory[1], ledger.experiences[0].trajectory[2]] =
        [ledger.experiences[0].trajectory[2], ledger.experiences[0].trajectory[1]];
    }],
  ];
  for (const [name, mutate] of mutations) {
    const malformed = structuredClone(twice);
    mutate(malformed);
    assert.throws(
      () => parseLedger(serializeLedger(malformed)),
      /trajectory|confirmation|transition|顺序|一致|额外|重复/u,
      name,
    );
  }

  twice.experiences[0].count = 8;
  twice.processedEvents.push({
    ...governedEvent({ eventId: "EVT-003", promptHash: sha256("prompt-3"), occurredAt: "2026-07-23T10:03:00.000Z" }),
    experienceId: "EXP-001",
  });
  const retired = removeExperience(twice, "EXP-001", {
    confirmation: confirmation("retire", "L2", {
      receiptId: "CONF-003",
      eventId: "EVT-003",
      confirmedAt: "2026-07-23T10:04:00.000Z",
    }),
    retirement: { removed: ["L2:target-experience-projection", "L1:target-experience-registry"] },
  });
  retired.archived[0].trajectory.push("2026-07-23 退役 L2→retired tombstone（L0 保留确认与历史轨迹）");
  assert.throws(() => parseLedger(serializeLedger(retired)), /trajectory|confirmation|transition|重复|一致/u);
});

check("canonical transition 必须从 L0 连续演进且 active 当前档位与最终 transition 一致", () => {
  const { once, twice } = governedLedgerAtL2();

  const missingL0 = structuredClone(twice);
  missingL0.consumedConfirmations.shift();
  missingL0.experiences[0].confirmationHistory.shift();
  missingL0.experiences[0].trajectory.splice(1, 1);
  assert.throws(() => parseLedger(serializeLedger(missingL0)), /trajectory|transition|L0|连续|缺少/u);

  const tierConflict = structuredClone(once);
  tierConflict.experiences[0].tier = "L2";
  assert.throws(() => parseLedger(serializeLedger(tierConflict)), /trajectory|transition|tier|档位|最终|一致/u);

  const jumpSegment = structuredClone(once);
  jumpSegment.experiences[0].trajectory.push("2026-07-23 升档 L0→L2");
  assert.throws(() => parseLedger(serializeLedger(jumpSegment)), /trajectory|transition|跳档|连续|canonical/u);

  const malformedSegment = structuredClone(once);
  malformedSegment.experiences[0].trajectory.push("2026-07-23 升档 L1=>L2");
  assert.throws(() => parseLedger(serializeLedger(malformedSegment)), /trajectory|transition|canonical/u);

  for (const transition of [
    "2026-07-23 升档L1→L2",
    " 2026-07-23 升档 L1→L2",
    "2026-07-23 升\u200B档 L1→L2",
    "2026-07-23 升\uFE0F档 L1→L2",
  ]) {
    const concealedSegment = structuredClone(once);
    concealedSegment.experiences[0].trajectory.push(transition);
    assert.throws(
      () => parseLedger(serializeLedger(concealedSegment)),
      /trajectory|transition|canonical/u,
      transition,
    );
  }
});

check("archived 必须保留连续最终档位并以对应 retirement transition 收口", () => {
  const { once, twice } = governedLedgerAtL2();

  const tierConflict = structuredClone(once);
  const archivedRecord = tierConflict.experiences.shift();
  archivedRecord.status = "retired";
  archivedRecord.retirement = { removed: ["L1:target-experience-registry"] };
  tierConflict.archived.push(archivedRecord);
  assert.throws(
    () => parseLedger(serializeLedger(tierConflict)),
    /archived|retire|retirement|trajectory|transition|最终|收口/u,
  );

  twice.experiences[0].count = 8;
  twice.processedEvents.push({
    ...governedEvent({ eventId: "EVT-003", promptHash: sha256("prompt-3"), occurredAt: "2026-07-23T10:03:00.000Z" }),
    experienceId: "EXP-001",
  });
  const retired = removeExperience(twice, "EXP-001", {
    confirmation: confirmation("retire", "L2", {
      receiptId: "CONF-003",
      eventId: "EVT-003",
      confirmedAt: "2026-07-23T10:04:00.000Z",
    }),
    retirement: { removed: ["L2:target-experience-projection", "L1:target-experience-registry"] },
  });
  retired.archived[0].tier = "L1";
  retired.archived[0].retirement.removed = ["L1:target-experience-registry"];
  assert.throws(
    () => parseLedger(serializeLedger(retired)),
    /archived|retire|retirement|trajectory|transition|tier|档位|一致/u,
  );
});

check("ledger v2 要求 exact canonical l1RegistryAnchor，null 仅表示尚无 L1", () => {
  const canonicalNull = governedLedger({ l1RegistryAnchor: null });
  assert.equal(parseLedger(serializeLedger(canonicalNull)).l1RegistryAnchor, null);

  const missingAnchor = governedLedger();
  delete missingAnchor.l1RegistryAnchor;
  assert.throws(
    () => parseLedger(serializeLedger(missingAnchor)),
    /l1RegistryAnchor|anchor|必需|缺少/u,
  );
  for (const anchor of [
    {},
    { path: "../宪法设计.md", blockIdentity: "target-experience-registry", blockVersion: "1", sourceHash: sha256("registry") },
    { path: "docs/项目治理/宪法设计.md", blockIdentity: "wrong", blockVersion: "1", sourceHash: sha256("registry") },
    { path: "docs/项目治理/宪法设计.md", blockIdentity: "target-experience-registry", blockVersion: "2", sourceHash: sha256("registry") },
    { path: "docs/项目治理/宪法设计.md", blockIdentity: "target-experience-registry", blockVersion: "1", sourceHash: "bad" },
  ]) {
    assert.throws(
      () => parseLedger(serializeLedger(governedLedger({ l1RegistryAnchor: anchor }))),
      /l1RegistryAnchor|anchor|path|identity|version|hash|canonical/u,
    );
  }
});

check("L0 达阈值可直接退役为空步骤 tombstone，未达阈值仍阻断", () => {
  const eventRecord = { ...governedEvent(), experienceId: "EXP-001" };
  const below = governedLedger({
    experiences: [{ ...governedLedger().experiences[0], count: 2 }],
    processedEvents: [eventRecord],
  });
  assert.throws(
    () => removeExperience(below, "EXP-001", { confirmation: confirmation("retire"), retirement: { removed: [] } }),
    /阈值|threshold/u,
  );
  const retired = removeExperience(governedLedger({ processedEvents: [eventRecord] }), "EXP-001", {
    confirmation: confirmation("retire"),
    retirement: { removed: [] },
  });
  assert.equal(retired.archived[0].status, "retired");
  assert.deepEqual(retired.archived[0].retirement.removed, []);
  assert.equal(retired.archived[0].confirmationHistory.length, 1);
});

console.log(`\n${passed} passed`);
