#!/usr/bin/env node
import crypto from "node:crypto";
import { assertCanonicalL1RegistryAnchor } from "./experience-anchor-contract.mjs";
// DocMap:
// Layer: L3 / experience ledger core
// Module: tools
// Depends on: (纯 Node 内置，零第三方依赖)
// Syncs with: skills/experience-elevator/SKILL.md, tools/check-experience-ledger.mjs
//
// 作用（大白话）：这是"经验治理台账"的算账内核。
// 台账文件 `经验治理.md` 是四级升级阶梯（L0 经验教训→L1 宪法设计→L2 项目规则→L3 技能硬门槛）
// 的唯一计数真源。文件长这样：
//   - 顶部一段 ```json vibe-experience-ledger 代码块 = 机器真源（工具读写，用户勿手改）
//   - 下面的中文段落 = 给人看的投影（由 renderLedgerMarkdown 从真源重渲，绝不撒谎）
//
// 本模块只做纯函数计算（解析/序列化/+1/判阀值/升档/渲投影），不碰文件系统，
// 落盘由上层调用方用 safe-target-fs 完成。所有变更函数都返回新对象，不改入参（不可变）。
//
// 关键设计约束（来自用户已拍板决策）：
//   - 计数只加不减、AI 不自作主张升档；达阀值只是"可升"信号，升不升由用户拍板。
//   - 升档后"下级计数归零、从头累积"，历史轨迹保留。
//   - L3 是顶档，无更高阀值。

// 四级阶梯顺序：L0 经验教训 → L1 宪法设计 → L2 项目规则 → L3 技能硬门槛。
export const TIER_ORDER = ["L0", "L1", "L2", "L3"];

// 默认阀值逐级递增：L0→L1 需 3 次，L1→L2 需 5 次，L2→L3 需 8 次。用户可在台账 thresholds 覆盖。
export const DEFAULT_THRESHOLDS = Object.freeze({ L0: 3, L1: 5, L2: 8 });

// 台账顶部真源代码块的围栏标记。
const FENCE_OPEN = "```json vibe-experience-ledger";
const FENCE_CLOSE = "```";

// 深拷贝一份台账，保证纯函数不可变语义（结构简单，用 JSON 往返即可）。
function clone(ledger) {
  return JSON.parse(JSON.stringify(ledger));
}

function isGovernedLedger(ledger) {
  return ledger?.vibeExperienceLedger === "v2" ||
    Object.prototype.hasOwnProperty.call(ledger || {}, "revision") ||
    Object.prototype.hasOwnProperty.call(ledger || {}, "processedEvents");
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function isCanonicalIso(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function assertPlainObject(value, where) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${where}: 必须是对象`);
  }
}

function assertExactKeys(value, required, optional, where) {
  assertPlainObject(value, where);
  const allowed = new Set([...required, ...optional]);
  for (const field of required) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      throw new Error(`${where}: 缺少必需字段 ${field}`);
    }
  }
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${where}: 未知额外字段 ${field}`);
  }
}

function assertGovernedState(ledger, where) {
  if (!Array.isArray(ledger.experiences)) {
    throw new Error(`${where}: experiences 必须是数组`);
  }
  if (!Number.isInteger(ledger.revision) || ledger.revision < 0) {
    throw new Error(`${where}: revision 必须是非负整数`);
  }
  if (!Array.isArray(ledger.processedEvents)) {
    throw new Error(`${where}: processedEvents 必须是数组`);
  }
  if (!Array.isArray(ledger.consumedConfirmations)) {
    throw new Error(`${where}: consumedConfirmations 必须是数组`);
  }
  if (!Array.isArray(ledger.archived)) {
    throw new Error(`${where}: archived 必须是数组`);
  }
}

function assertValidEvent(event, where, stored = false) {
  const required = ["eventId", "signalType", "scope", "promptHash", "occurredAt"];
  if (stored) required.push("experienceId");
  assertExactKeys(event, required, [], where);
  if (typeof event.eventId !== "string" || event.eventId.trim() === "") {
    throw new Error(`${where}: eventId 必须是非空字符串`);
  }
  if (event.signalType !== "explicit-correction") {
    throw new Error(`${where}: signalType 必须是 explicit-correction`);
  }
  if (event.scope !== "target-project") {
    throw new Error(`${where}: scope 必须是 target-project`);
  }
  if (typeof event.promptHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(event.promptHash)) {
    throw new Error(`${where}: promptHash 必须是 sha256 hash`);
  }
  if (!isCanonicalIso(event.occurredAt)) {
    throw new Error(`${where}: occurredAt 必须是 canonical ISO 时间`);
  }
  if (stored && (typeof event.experienceId !== "string" || event.experienceId.trim() === "")) {
    throw new Error(`${where}: experienceId 必须是非空字符串`);
  }
}

function eventRecord(event, experienceId) {
  return {
    eventId: event.eventId,
    signalType: event.signalType,
    scope: event.scope,
    promptHash: event.promptHash,
    occurredAt: event.occurredAt,
    experienceId,
  };
}

function sameEventRecord(existing, expected, allowStoredExperience = false) {
  return existing?.eventId === expected.eventId &&
    existing?.signalType === expected.signalType &&
    existing?.scope === expected.scope &&
    existing?.promptHash === expected.promptHash &&
    existing?.occurredAt === expected.occurredAt &&
    (allowStoredExperience ? typeof existing?.experienceId === "string" : existing?.experienceId === expected.experienceId);
}

function confirmationTransition(action, fromTier) {
  if (!TIER_ORDER.includes(fromTier)) throw new Error(`confirmation: fromTier 非法：${fromTier}`);
  if (action === "retire") return { fromTier, toTier: "retired" };
  if (action !== "elevate") throw new Error(`confirmation: action 非法：${action}`);
  const index = TIER_ORDER.indexOf(fromTier);
  if (index >= TIER_ORDER.length - 1) throw new Error("confirmation: L3 无法继续 elevate");
  return { fromTier, toTier: TIER_ORDER[index + 1] };
}

function assertValidConsumedConfirmation(record, eventById, knownExperienceIds, receiptIds, confirmationHashes, where) {
  assertExactKeys(record, [
    "receiptId",
    "eventId",
    "experienceId",
    "scope",
    "action",
    "tier",
    "confirmedAt",
    "confirmationHash",
    "fromTier",
    "toTier",
  ], [], where);
  for (const field of ["receiptId", "eventId", "experienceId"]) {
    if (typeof record[field] !== "string" || record[field].trim() === "") {
      throw new Error(`${where}: ${field} 必须是非空字符串`);
    }
  }
  if (record.scope !== "target-project") throw new Error(`${where}: scope 必须是 target-project`);
  if (!["elevate", "retire"].includes(record.action)) throw new Error(`${where}: action 必须是 elevate 或 retire`);
  if (!TIER_ORDER.includes(record.tier)) throw new Error(`${where}: tier 非法`);
  if (!isCanonicalIso(record.confirmedAt)) throw new Error(`${where}: confirmedAt 必须是 canonical ISO 时间`);
  if (typeof record.confirmationHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(record.confirmationHash)) {
    throw new Error(`${where}: confirmationHash 非法`);
  }
  const expectedHash = sha256(JSON.stringify(confirmationCanonicalFields(record)));
  if (record.confirmationHash !== expectedHash) throw new Error(`${where}: confirmationHash 与 canonical fields 不匹配`);
  const transition = confirmationTransition(record.action, record.tier);
  if (record.fromTier !== transition.fromTier || record.toTier !== transition.toTier) {
    throw new Error(`${where}: fromTier/toTier 与 action/tier 不匹配`);
  }
  if (!knownExperienceIds.has(record.experienceId)) throw new Error(`${where}: experienceId 未绑定现有经验`);
  const event = eventById.get(record.eventId);
  if (!event || event.experienceId !== record.experienceId) {
    throw new Error(`${where}: eventId 必须存在且绑定同一 experienceId`);
  }
  if (receiptIds.has(record.receiptId)) throw new Error(`${where}: receiptId 重复`);
  if (confirmationHashes.has(record.confirmationHash)) throw new Error(`${where}: confirmationHash 重复`);
  receiptIds.add(record.receiptId);
  confirmationHashes.add(record.confirmationHash);
}

function assertValidExperienceBase(record, where, archived) {
  const required = ["id", "summary", "tier", "count", "trajectory", "landing"];
  const optional = archived
    ? []
    : ["confirmationHistory", "confirmation"];
  if (archived) required.push("status", "retirement", "confirmationHistory", "confirmation");
  assertExactKeys(record, required, optional, where);
  if (typeof record.id !== "string" || !/^EXP-\d{3,}$/u.test(record.id)) {
    throw new Error(`${where}: id 必须是 EXP- 加至少三位数字`);
  }
  if (typeof record.summary !== "string" || record.summary.trim() === "" || /[\r\n]/u.test(record.summary)) {
    throw new Error(`${where}: summary 必须是非空单行字符串`);
  }
  if (!TIER_ORDER.includes(record.tier)) throw new Error(`${where}: tier 非法`);
  assertValidCount(record, where);
  if (!Array.isArray(record.trajectory) || record.trajectory.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${where}: trajectory 必须是字符串数组`);
  }
  if (record.landing !== null && (typeof record.landing !== "string" || record.landing.trim() === "")) {
    throw new Error(`${where}: landing 必须是 null 或非空字符串`);
  }
  if (archived) {
    if (record.status !== "retired") throw new Error(`${where}: status 必须是 retired`);
    assertExactKeys(record.retirement, ["removed"], [], `${where}.retirement`);
    if (!Array.isArray(record.retirement.removed) || record.retirement.removed.some((item) => typeof item !== "string" || item.trim() === "")) {
      throw new Error(`${where}.retirement.removed 必须是字符串数组`);
    }
    const expectedTiers = ({ L0: [], L1: ["L1"], L2: ["L2", "L1"], L3: ["L3", "L2", "L1"] })[record.tier];
    const actualTiers = record.retirement.removed.map((item) => item.split(":", 1)[0]);
    if (JSON.stringify(actualTiers) !== JSON.stringify(expectedTiers)) {
      throw new Error(`${where}.retirement.removed 与退役档位不匹配`);
    }
  }
}

function canonicalTrajectoryTransition(item) {
  if (/\p{Default_Ignorable_Code_Point}/u.test(item)) return { invalid: true };
  const elevation = item.match(/^\d{4}-\d{2}-\d{2} 升档 (?<fromTier>L[0-3])→(?<toTier>L[0-3])$/u);
  if (elevation?.groups) {
    const expectedTo = { L0: "L1", L1: "L2", L2: "L3" }[elevation.groups.fromTier];
    if (elevation.groups.toTier === expectedTo) return { action: "elevate", ...elevation.groups };
    return { invalid: true };
  }
  const retirement = item.match(/^\d{4}-\d{2}-\d{2} 退役 (?<fromTier>L[0-3])→retired tombstone（L0 保留确认与历史轨迹）$/u);
  if (retirement?.groups) return { action: "retire", fromTier: retirement.groups.fromTier, toTier: "retired" };
  if (/(?:升档|退役)/u.test(item)) return { invalid: true };
  return null;
}

function assertTransitionTrajectoryHistory(record, confirmations, where, archived) {
  const parsed = record.trajectory.map(canonicalTrajectoryTransition);
  if (parsed.some((transition) => transition?.invalid)) {
    throw new Error(`${where}.trajectory 含非 canonical 或跳档 transition`);
  }
  const actual = parsed.filter(Boolean);
  const expected = confirmations.map(({ action, fromTier, toTier }) => ({ action, fromTier, toTier }));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${where}.trajectory canonical transition 必须与 confirmationHistory 有序 multiset 完全一致`);
  }
  let finalTier = "L0";
  for (let index = 0; index < actual.length; index += 1) {
    const transition = actual[index];
    if (transition.fromTier !== finalTier) {
      throw new Error(`${where}.trajectory canonical transition 必须从 L0 逐档连续演进`);
    }
    if (transition.action === "retire" && index !== actual.length - 1) {
      throw new Error(`${where}.trajectory retirement transition 必须是最终 canonical 状态`);
    }
    finalTier = transition.toTier;
  }
  if (archived) {
    const retirement = actual.at(-1);
    if (finalTier !== "retired" || retirement?.action !== "retire" || retirement.fromTier !== record.tier) {
      throw new Error(`${where}.trajectory archived 必须以退役前最终档位对应的 retirement transition 收口`);
    }
  } else if (finalTier !== record.tier) {
    throw new Error(`${where}.trajectory 最终档位必须与 active 当前 tier 一致`);
  }
}

function assertEmbeddedConfirmationHistory(record, globalForExperience, where, required) {
  if (!Object.prototype.hasOwnProperty.call(record, "confirmationHistory")) {
    if (required || globalForExperience.length > 0) {
      throw new Error(`${where}: consumedConfirmations 存在时缺少必需字段 confirmationHistory`);
    }
    if (Object.prototype.hasOwnProperty.call(record, "confirmation")) {
      throw new Error(`${where}: confirmation 存在时必须同时提供 confirmationHistory`);
    }
    assertTransitionTrajectoryHistory(record, globalForExperience, where, required);
    return;
  }
  if (!Array.isArray(record.confirmationHistory) || (required && record.confirmationHistory.length === 0)) {
    throw new Error(`${where}.confirmationHistory 必须是非空数组`);
  }
  record.confirmationHistory.forEach((confirmation, index) => {
    assertExactKeys(confirmation, [
      "receiptId", "eventId", "experienceId", "scope", "action", "tier", "confirmedAt",
      "confirmationHash", "fromTier", "toTier",
    ], [], `${where}.confirmationHistory[${index}]`);
    if (confirmation.experienceId !== record.id) {
      throw new Error(`${where}.confirmationHistory[${index}] experienceId 不匹配`);
    }
  });
  if (JSON.stringify(record.confirmationHistory) !== JSON.stringify(globalForExperience)) {
    throw new Error(`${where}.confirmationHistory 必须与该经验的 canonical consumedConfirmations 双向 exact 且顺序一致`);
  }
  assertTransitionTrajectoryHistory(record, globalForExperience, where, required);
  if (!Object.prototype.hasOwnProperty.call(record, "confirmation")) {
    throw new Error(`${where}: confirmationHistory 存在时必须提供 confirmation`);
  }
  assertExactKeys(record.confirmation, [
    "receiptId", "eventId", "experienceId", "scope", "action", "tier", "confirmedAt",
    "confirmationHash", "fromTier", "toTier",
  ], [], `${where}.confirmation`);
  const latest = record.confirmationHistory.at(-1);
  if (JSON.stringify(record.confirmation) !== JSON.stringify(latest)) {
    throw new Error(`${where}.confirmation 必须等于 confirmationHistory 最后一条`);
  }
}

export function validateGovernedLedger(ledger, where = "validateGovernedLedger") {
  assertExactKeys(ledger, [
    "vibeExperienceLedger",
    "revision",
    "l1RegistryAnchor",
    "thresholds",
    "processedEvents",
    "consumedConfirmations",
    "experiences",
    "archived",
  ], [], where);
  if (ledger.vibeExperienceLedger !== "v2") throw new Error(`${where}: vibeExperienceLedger 必须是 v2`);
  assertCanonicalL1RegistryAnchor(ledger.l1RegistryAnchor, `${where}.l1RegistryAnchor`);
  assertGovernedState(ledger, where);
  assertValidThresholds(ledger.thresholds, where);
  ledger.experiences.forEach((record, index) => assertValidExperienceBase(record, `${where}.experiences[${index}]`, false));
  ledger.archived.forEach((record, index) => assertValidExperienceBase(record, `${where}.archived[${index}]`, true));
  const records = [...ledger.experiences, ...ledger.archived];
  const knownExperienceIds = new Set();
  for (const record of records) {
    if (!record || typeof record.id !== "string" || record.id.trim() === "") {
      throw new Error(`${where}: experience id 必须是非空字符串`);
    }
    if (knownExperienceIds.has(record.id)) throw new Error(`${where}: experience id 重复：${record.id}`);
    knownExperienceIds.add(record.id);
  }
  const eventById = new Map();
  for (const event of ledger.processedEvents) {
    assertValidEvent(event, `${where}.processedEvents`, true);
    if (!knownExperienceIds.has(event.experienceId)) {
      throw new Error(`${where}: processedEvents.experienceId 必须绑定现有经验`);
    }
    if (eventById.has(event.eventId)) throw new Error(`${where}: processedEvents eventId 重复：${event.eventId}`);
    eventById.set(event.eventId, event);
  }
  const receiptIds = new Set();
  const confirmationHashes = new Set();
  ledger.consumedConfirmations.forEach((record, index) => {
    assertValidConsumedConfirmation(
      record,
      eventById,
      knownExperienceIds,
      receiptIds,
      confirmationHashes,
      `${where}.consumedConfirmations[${index}]`,
    );
  });
  const globalByExperienceId = new Map();
  for (const confirmation of ledger.consumedConfirmations) {
    const history = globalByExperienceId.get(confirmation.experienceId) || [];
    history.push(confirmation);
    globalByExperienceId.set(confirmation.experienceId, history);
  }
  ledger.experiences.forEach((record, index) => {
    assertEmbeddedConfirmationHistory(record, globalByExperienceId.get(record.id) || [], `${where}.experiences[${index}]`, false);
  });
  ledger.archived.forEach((record, index) => {
    assertEmbeddedConfirmationHistory(record, globalByExperienceId.get(record.id) || [], `${where}.archived[${index}]`, true);
  });
  return ledger;
}

function validateLegacyLedger(ledger, where) {
  assertPlainObject(ledger, where);
  if (ledger.vibeExperienceLedger !== "v1") throw new Error(`${where}: vibeExperienceLedger 必须是 v1 或 v2`);
  if (!Array.isArray(ledger.experiences)) throw new Error(`${where}: experiences 必须是数组`);
  if (ledger.archived !== undefined && !Array.isArray(ledger.archived)) throw new Error(`${where}: archived 必须是数组`);
  assertValidThresholds(ledger.thresholds, where, false);
  const records = [...ledger.experiences, ...(ledger.archived || [])];
  const ids = new Set();
  records.forEach((record, index) => {
    const recordWhere = `${where}.records[${index}]`;
    assertPlainObject(record, recordWhere);
    if (typeof record.id !== "string" || !/^EXP-\d{3,}$/u.test(record.id)) {
      throw new Error(`${recordWhere}: id 必须是 EXP- 加至少三位数字`);
    }
    if (typeof record.summary !== "string" || record.summary.trim() === "" || /[\r\n]/u.test(record.summary)) {
      throw new Error(`${recordWhere}: summary 必须是非空单行字符串`);
    }
    if (!TIER_ORDER.includes(record.tier)) throw new Error(`${recordWhere}: tier 非法`);
    assertValidCount(record, recordWhere);
    if (!Array.isArray(record.trajectory)) throw new Error(`${recordWhere}: trajectory 必须是数组`);
    if (record.landing !== undefined && record.landing !== null && typeof record.landing !== "string") {
      throw new Error(`${recordWhere}: landing 必须是字符串、null 或省略`);
    }
    if (ids.has(record.id)) throw new Error(`${where}: experience id 重复：${record.id}`);
    ids.add(record.id);
  });
  return ledger;
}

function prepareEventMutation(ledger, event, where, experienceId, allowStoredExperience = false) {
  if (!isGovernedLedger(ledger) && event === undefined) {
    return { next: clone(ledger), replay: false, governed: false };
  }
  assertValidEvent(event, where);
  const next = clone(ledger);
  validateGovernedLedger(next, where);
  const existing = next.processedEvents.find((item) => item?.eventId === event.eventId);
  const expected = eventRecord(event, experienceId);
  if (existing && !sameEventRecord(existing, expected, allowStoredExperience)) {
    throw new Error(`${where}: eventId collision，事件 payload 或 experienceId 不匹配`);
  }
  return { next, replay: Boolean(existing), governed: true, existing };
}

function finishEventMutation(next, event, governed, experienceId) {
  if (!governed) return next;
  next.processedEvents.push(eventRecord(event, experienceId));
  next.revision += 1;
  return next;
}

// 从台账 Markdown 原文里抠出顶部 ```json 真源块并解析成对象。
function parseLedgerSource(markdown) {
  if (typeof markdown !== "string") {
    throw new Error("parseLedger: 输入必须是字符串");
  }
  const openIdx = markdown.indexOf(FENCE_OPEN);
  if (openIdx === -1) {
    throw new Error("parseLedger: 未找到经验治理真源块（```json vibe-experience-ledger）");
  }
  const bodyStart = openIdx + FENCE_OPEN.length;
  const closeIdx = markdown.indexOf(`\n${FENCE_CLOSE}`, bodyStart);
  if (closeIdx === -1) {
    throw new Error("parseLedger: 真源块缺少闭合围栏 ```");
  }
  const jsonText = markdown.slice(bodyStart, closeIdx).trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`parseLedger: 真源 JSON 非法：${error.message}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("parseLedger: 真源必须是 JSON 对象");
  }
  if (!Array.isArray(parsed.experiences)) {
    throw new Error("parseLedger: 真源缺少 experiences 数组");
  }
  return parsed;
}

export function parseLedger(markdown) {
  const parsed = parseLedgerSource(markdown);
  if (parsed.vibeExperienceLedger === "v2") {
    validateGovernedLedger(parsed, "parseLedger");
  } else {
    validateLegacyLedger(parsed, "parseLedger");
  }
  return parsed;
}

export function parseLedgerForAnchorAdoption(markdown) {
  const parsed = parseLedgerSource(markdown);
  if (parsed.vibeExperienceLedger !== "v2") throw new Error("anchor adoption requires ledger schema v2");
  const anchorMissing = !Object.prototype.hasOwnProperty.call(parsed, "l1RegistryAnchor");
  if (anchorMissing) parsed.l1RegistryAnchor = null;
  validateGovernedLedger(parsed, "parseLedgerForAnchorAdoption");
  return { ledger: parsed, anchorMissing };
}

// 校验 thresholds：必须是对象，且 L0/L1/L2 三档都是正整数。非法抛明确错误。
function assertValidThresholds(thresholds, where = "parseLedger", exact = true) {
  if (exact) assertExactKeys(thresholds, ["L0", "L1", "L2"], [], `${where}.thresholds`);
  else {
    assertPlainObject(thresholds, `${where}.thresholds`);
    for (const tier of ["L0", "L1", "L2"]) {
      if (!Object.prototype.hasOwnProperty.call(thresholds, tier)) throw new Error(`${where}: thresholds.${tier} 缺失`);
    }
  }
  for (const tier of ["L0", "L1", "L2"]) {
    const value = thresholds[tier];
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new Error(
        `${where}: thresholds.${tier} 必须是正整数，实际：${JSON.stringify(value)}`,
      );
    }
  }
}

// 把台账对象序列化成"只含真源块"的最小原文（不含正文投影，用于往返/测试）。
export function serializeLedger(ledger) {
  const json = JSON.stringify(ledger, null, 2);
  return `${FENCE_OPEN}\n${json}\n${FENCE_CLOSE}\n`;
}

// 按 id 找一条经验的下标，找不到返回 -1。
function indexOfExperience(ledger, id) {
  return ledger.experiences.findIndex((exp) => exp.id === id);
}

// 校验一条经验的 count 是非负整数，否则抛错（防止脏输入静默拼成 "31" 之类垃圾值）。
function assertValidCount(exp, where) {
  if (typeof exp.count !== "number" || !Number.isInteger(exp.count) || exp.count < 0) {
    throw new Error(`${where}: count 必须是非负整数，实际：${JSON.stringify(exp.count)}`);
  }
}

// 静默 +1：命中某条已记录经验，当前档计数加一。未知 id 或脏 count 抛错（不静默吞）。
export function bumpExperience(ledger, id, event) {
  const mutation = prepareEventMutation(ledger, event, "bumpExperience", id);
  const { next } = mutation;
  if (mutation.replay) return next;
  const idx = indexOfExperience(next, id);
  if (idx === -1) {
    throw new Error(`bumpExperience: 未知经验 id：${id}`);
  }
  assertValidCount(next.experiences[idx], "bumpExperience");
  next.experiences[idx].count += 1;
  return finishEventMutation(next, event, mutation.governed, id);
}

// 为新经验分配一个不与已有重复的稳定 id（EXP-001、EXP-002……）。
function nextExperienceId(ledger) {
  let max = 0;
  const records = [
    ...(Array.isArray(ledger.experiences) ? ledger.experiences : []),
    ...(Array.isArray(ledger.archived) ? ledger.archived : []),
  ];
  for (const exp of records) {
    const match = /^EXP-(\d+)$/.exec(exp.id || "");
    if (match) {
      const num = Number(match[1]);
      if (num > max) max = num;
    }
  }
  const seq = String(max + 1).padStart(3, "0");
  return `EXP-${seq}`;
}

// 追加一条 L0 新记录（没匹配到已有经验时用）。计数从 1 起。
export function addExperience(ledger, { summary, timestamp, event } = {}) {
  if (!summary || typeof summary !== "string") {
    throw new Error("addExperience: 必须提供 summary 摘要");
  }
  // summary 会渲进投影标题（## id · summary），含换行会破坏投影结构，拒绝。
  if (/[\r\n]/.test(summary)) {
    throw new Error("addExperience: summary 摘要不得含换行符");
  }
  const mutation = prepareEventMutation(ledger, event, "addExperience", null, true);
  const { next } = mutation;
  if (mutation.replay) return next;
  const id = nextExperienceId(next);
  const stamp = timestamp || new Date().toISOString().slice(0, 10);
  next.experiences.push({
    id,
    summary,
    tier: "L0",
    count: 1,
    trajectory: [`${stamp} 记录@L0`],
    landing: null,
  });
  return finishEventMutation(next, event, mutation.governed, id);
}

// 取某档的阀值；L3 顶档无阀值返回 null。
function thresholdOf(ledger, tier) {
  if (tier === "L3") return null;
  const value = ledger.thresholds?.[tier];
  return typeof value === "number" ? value : DEFAULT_THRESHOLDS[tier];
}

// 判断某条经验当前档计数是否已达该级阀值（达到=可升信号）。L3 顶档恒 false。
export function isAtThreshold(ledger, id) {
  const idx = indexOfExperience(ledger, id);
  if (idx === -1) {
    throw new Error(`isAtThreshold: 未知经验 id：${id}`);
  }
  const exp = ledger.experiences[idx];
  const threshold = thresholdOf(ledger, exp.tier);
  if (threshold === null) return false;
  return exp.count >= threshold;
}

function confirmationCanonicalFields(confirmation) {
  return {
    receiptId: confirmation.receiptId,
    eventId: confirmation.eventId,
    experienceId: confirmation.experienceId,
    scope: confirmation.scope,
    action: confirmation.action,
    tier: confirmation.tier,
    confirmedAt: confirmation.confirmedAt,
  };
}

function assertConfirmation(ledger, exp, confirmation, action) {
  const id = exp.id;
  if (!confirmation || typeof confirmation !== "object") {
    throw new Error(`${action}: 缺少用户确认凭据 confirmation`);
  }
  if (confirmation.experienceId !== id) {
    throw new Error(`${action}: confirmation experienceId 不匹配`);
  }
  if (confirmation.scope !== "target-project") {
    throw new Error(`${action}: confirmation scope 必须是 target-project`);
  }
  if (confirmation.action !== action) {
    throw new Error(`${action}: confirmation action 不匹配`);
  }
  if (typeof confirmation.receiptId !== "string" || confirmation.receiptId.trim() === "") {
    throw new Error(`${action}: confirmation receiptId 缺失`);
  }
  if (confirmation.tier !== exp.tier) {
    throw new Error(`${action}: confirmation tier 与当前档位不匹配`);
  }
  if (!isCanonicalIso(confirmation.confirmedAt)) {
    throw new Error(`${action}: confirmation confirmedAt 必须是 canonical ISO 时间`);
  }
  if (typeof confirmation.confirmationHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(confirmation.confirmationHash)) {
    throw new Error(`${action}: confirmationHash 非法`);
  }
  const expectedHash = sha256(JSON.stringify(confirmationCanonicalFields(confirmation)));
  if (confirmation.confirmationHash !== expectedHash) {
    throw new Error(`${action}: confirmationHash 与 canonical fields 不匹配`);
  }
  validateGovernedLedger(ledger, action);
  const event = ledger.processedEvents.find((item) => item?.eventId === confirmation.eventId);
  if (!event) throw new Error(`${action}: confirmation eventId 未登记到 processedEvents`);
  if (event.experienceId !== id) {
    throw new Error(`${action}: confirmation eventId 未绑定当前 experienceId`);
  }
  if (ledger.consumedConfirmations.some((item) => item?.receiptId === confirmation.receiptId || item?.confirmationHash === confirmation.confirmationHash)) {
    throw new Error(`${action}: confirmation receipt/hash 已消费，禁止重放`);
  }
}

function consumeConfirmation(ledger, exp, confirmation) {
  const record = {
    ...confirmationCanonicalFields(confirmation),
    confirmationHash: confirmation.confirmationHash,
    ...confirmationTransition(confirmation.action, exp.tier),
  };
  ledger.consumedConfirmations.push(record);
  if (!Array.isArray(exp.confirmationHistory)) exp.confirmationHistory = [];
  exp.confirmationHistory.push(record);
  exp.confirmation = clone(record);
}

// 升档：档位上移一级、当前档计数归零、历史轨迹追加、可选写入落点引用。
// L3 已是顶档，再升抛错。
export function elevateExperience(ledger, id, { landing, timestamp, confirmation } = {}) {
  const next = clone(ledger);
  const idx = indexOfExperience(next, id);
  if (idx === -1) {
    throw new Error(`elevateExperience: 未知经验 id：${id}`);
  }
  const exp = next.experiences[idx];
  const curTierIdx = TIER_ORDER.indexOf(exp.tier);
  if (curTierIdx === -1) {
    throw new Error(`elevateExperience: 非法档位：${exp.tier}`);
  }
  if (curTierIdx >= TIER_ORDER.length - 1) {
    throw new Error(`elevateExperience: ${id} 已是顶档 L3，无法再升`);
  }
  if (!Array.isArray(exp.trajectory)) {
    throw new Error(`elevateExperience: ${id} 缺少 trajectory 数组，无法追加升档轨迹`);
  }
  if (isGovernedLedger(next)) {
    if (!isAtThreshold(next, id)) {
      throw new Error(`elevateExperience: ${id} 当前计数未达升级阈值`);
    }
    assertConfirmation(next, exp, confirmation, "elevate");
  }
  const fromTier = exp.tier;
  const toTier = TIER_ORDER[curTierIdx + 1];
  const stamp = timestamp || new Date().toISOString().slice(0, 10);
  if (isGovernedLedger(next)) {
    consumeConfirmation(next, exp, confirmation);
  }
  exp.tier = toTier;
  exp.count = 0; // 下级计数归零、从头累积
  exp.trajectory.push(`${stamp} 升档 ${fromTier}→${toTier}`);
  if (landing !== undefined) {
    exp.landing = landing;
  }
  if (isGovernedLedger(next)) {
    next.revision += 1;
  }
  return next;
}

// 淘汰：把某条经验从活跃列表移除，归档到 archived 区并追加淘汰记录（轨迹留档）。
// 未知 id 抛错。符合"删除后原记录保留"的拍板决策。
export function removeExperience(ledger, id, { timestamp, confirmation, retirement } = {}) {
  const next = clone(ledger);
  const idx = indexOfExperience(next, id);
  if (idx === -1) {
    throw new Error(`removeExperience: 未知经验 id：${id}`);
  }
  const removed = next.experiences[idx];
  if (isGovernedLedger(next)) {
    if (removed.tier !== "L3" && !isAtThreshold(next, id)) {
      throw new Error(`removeExperience: ${id} 当前计数未达退役阈值`);
    }
    assertConfirmation(next, removed, confirmation, "retire");
    const expectedTiers = ({ L0: [], L1: ["L1"], L2: ["L2", "L1"], L3: ["L3", "L2", "L1"] })[removed.tier];
    const removedSteps = retirement?.removed;
    const tiers = Array.isArray(removedSteps) ? removedSteps.map((item) => String(item).split(":", 1)[0]) : null;
    if (!tiers || JSON.stringify(tiers) !== JSON.stringify(expectedTiers)) {
      throw new Error(`removeExperience: retirement.removed 必须匹配当前档位 ${removed.tier} 的逆序步骤`);
    }
  }
  next.experiences.splice(idx, 1);
  const stamp = timestamp || new Date().toISOString().slice(0, 10);
  if (!Array.isArray(removed.trajectory)) {
    removed.trajectory = [];
  }
  removed.trajectory.push(
    isGovernedLedger(next)
      ? `${stamp} 退役 ${removed.tier}→retired tombstone（L0 保留确认与历史轨迹）`
      : `${stamp} 淘汰（从活跃台账移除，归档留存）`,
  );
  if (isGovernedLedger(next)) {
    removed.status = "retired";
    removed.retirement = clone(retirement);
    consumeConfirmation(next, removed, confirmation);
    next.revision += 1;
  }
  if (!Array.isArray(next.archived)) {
    next.archived = [];
  }
  next.archived.push(removed);
  return next;
}

// 渲染一条经验的正文投影段落。
function renderExperienceSection(ledger, exp) {
  if (!exp || typeof exp !== "object") {
    throw new Error("renderLedgerMarkdown: 经验记录必须是对象，实际含非法项（如 null）");
  }
  const threshold = thresholdOf(ledger, exp.tier);
  const countLine =
    threshold === null
      ? `- 当前计数：${exp.count}（L3 顶档，无更高阀值）`
      : `- 当前计数：${exp.count} / ${threshold}`;
  const tierLine =
    threshold === null
      ? `- 当前档位：${exp.tier}（技能硬门槛）`
      : `- 当前档位：${exp.tier}（阀值 ${threshold}）`;
  const trajectory = (exp.trajectory || []).join("；") || "（无）";
  const landing = exp.landing ? exp.landing : "（未升级）";
  return [
    `## ${exp.id} · ${exp.summary}`,
    tierLine,
    countLine,
    `- 历史轨迹：${trajectory}`,
    `- 落点：${landing}`,
  ].join("\n");
}

// 从真源重渲整份台账 Markdown：顶部 json 真源 + 下方人类可读投影。
// 投影绝不撒谎——始终由真源生成，与内存计数一致。
export function renderLedgerMarkdown(ledger) {
  const header = [
    "# 经验治理",
    "",
    "> 本文件是经验升级阶梯（L0 经验教训 → L1 宪法设计 → L2 项目规则 → L3 技能硬门槛）的唯一计数真源。",
    "> 顶部 json 区由 experience-elevator 工具维护，请勿手改；下方为其人类可读投影。",
    "",
  ].join("\n");
  const source = serializeLedger(ledger).trimEnd();
  const sections = ledger.experiences
    .map((exp) => renderExperienceSection(ledger, exp))
    .join("\n\n");
  const parts = [header, source, ""];
  if (sections) {
    parts.push(sections, "");
  }
  // 已淘汰经验：轨迹留档，渲染在独立分区，不参与计数。
  if (Array.isArray(ledger.archived) && ledger.archived.length > 0) {
    const archivedSections = ledger.archived
      .map((exp) => renderArchivedSection(exp))
      .join("\n\n");
    parts.push("## 已淘汰经验", "", archivedSections, "");
  }
  return parts.join("\n");
}

// 渲染一条已淘汰经验的归档段落（只留档，不参与计数）。
function renderArchivedSection(exp) {
  if (!exp || typeof exp !== "object") {
    throw new Error("renderLedgerMarkdown: 归档经验记录必须是对象");
  }
  const trajectory = (exp.trajectory || []).join("；") || "（无）";
  return [
    `### ${exp.id} · ${exp.summary}`,
    `- 淘汰前档位：${exp.tier}`,
    `- 历史轨迹：${trajectory}`,
  ].join("\n");
}
