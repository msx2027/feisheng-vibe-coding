#!/usr/bin/env node
// DocMap:
// Layer: experience-recorder (auto-record batch, contract enabled-experience-auto-record-v1)
// Module: adapters/vibe-hooks/experience-recorder.mjs
// Depends on: (Node built-ins only, zero third-party dependency)
// Syncs with: skills/event/experience-elevator/SKILL.md, contract.json [recorder],
//             sources/vibe-coding-skills/tools/experience-ledger-core.mjs (read-only shape reference)
//
// 作用（大白话）：经验台账的本地记录器。Hook 采集到纠错信号并注入 autoRecord 路由后，
// 会话 AI 自主判断"是否值得记"；值得记就调用本工具把教训写进 L0 台账，不值得记就调用
// dismiss 留痕消化。本工具是 ledger 的唯一机器写入器（单一写入者），但只做"记录"：
//   - 不升档、不退役、不碰受管块（升档/退役走既有用户确认凭据流程）
//   - 不保存原始 prompt（只存 sha256 摘要）
//   - revision CAS + eventId 幂等重放/collision + 原子落盘，全部 fail-closed
//
// 台账文件格式（ledger v2）：
//   顶部 ```json vibe-experience-ledger 围栏 = 机器真源（本工具读写）
//   围栏外的中文/人工登记内容 = 原样保留，绝不改动
//
// 边界：台账路径必须同时满足 (a) 目标项目 .vibe-docs.json experienceGovernance 登记
// (b) 安装态契约 writeWhitelist 包含该路径。二者不一致 = 契约缺口，拒绝写入。

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const FENCE_OPEN = "```json vibe-experience-ledger";
const FENCE_CLOSE = "```";
const SIGNAL_TYPE = "explicit-correction";
const SCOPE = "target-project";
const TIER_ORDER = ["L0", "L1", "L2", "L3"];

function out(payload) {
  process.stdout.write(JSON.stringify(payload) + "\n");
}
function fail(code, message, extra = {}) {
  out({ ok: false, error: code, message, ...extra });
  process.exit(2);
}

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
function canonicalIso(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
function assertExactKeys(value, required, optional, where) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("schema", `${where}: 必须是对象`);
  }
  const allowed = new Set([...required, ...optional]);
  for (const field of required) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      fail("schema", `${where}: 缺少必需字段 ${field}`);
    }
  }
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) fail("schema", `${where}: 未知额外字段 ${field}`);
  }
}
function singleLine(value) {
  return typeof value === "string" && value.trim() !== "" && !/[\r\n]/u.test(value);
}

// ---- CLI ----
const VALUE_FLAGS = new Set(["--action", "--event-id", "--prompt-hash", "--prompt-material", "--occurred-at", "--summary", "--experience-id", "--expected-revision", "--source-dedup-key", "--reason", "--state-dir", "--policy-id", "--tier", "--count-below", "--days-unhit", "--confirmed-by", "--policy-source", "--session", "--finding"]);
const argv = process.argv.slice(2);
const opts = new Map();
const positional = [];
for (let index = 0; index < argv.length; index++) {
  const item = argv[index];
  if (VALUE_FLAGS.has(item)) {
    opts.set(item, argv[index + 1]);
    index++;
  } else if (item.startsWith("--")) {
    opts.set(item, true);
  } else {
    positional.push(item);
  }
}
function argValue(name) {
  return opts.get(name);
}
const ACTIONS = ["check", "record", "dismiss", "selfcheck", "policy-add", "policy-list", "govern"];
const optAction = opts.get("--action") || positional.find((item) => ACTIONS.includes(item));
const targetRootArg = positional.find((item) => !ACTIONS.includes(item));
const targetRoot = path.resolve(targetRootArg || process.cwd());

if (!ACTIONS.includes(optAction)) {
  fail("usage", "用法: experience-recorder.mjs <target-root> --action check|record|dismiss|policy-add|policy-list|govern [选项]");
}

// ---- 定位契约（与 recorder 同目录的安装态契约副本）与台账路径 ----
const recorderDir = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.join(recorderDir, "contract.json");
if (!fs.existsSync(contractPath)) fail("no-contract", "缺少安装态契约副本 contract.json（必须与 recorder 同目录）");
let contract;
try {
  contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
} catch (error) {
  fail("bad-contract", `契约副本解析失败: ${error.message}`);
}
const whitelist = Array.isArray(contract.writeWhitelist) ? contract.writeWhitelist.map((entry) => String(entry).replace(/\\/g, "/").replace(/\/+$/, "")) : [];
if (whitelist.length === 0) fail("bad-contract", "契约 writeWhitelist 为空，拒绝工作");

// 台账未启用/未登记 = fail-closed（dismiss/selfcheck 只写状态目录，不要求台账）
const docsPath = path.join(targetRoot, ".vibe-docs.json");
let ledgerRelative = "";
if (!["dismiss", "selfcheck"].includes(optAction)) {
  if (!fs.existsSync(docsPath)) fail("ledger-disabled", "目标项目缺少 .vibe-docs.json，经验治理未启用");
  let docs;
  try {
    docs = JSON.parse(fs.readFileSync(docsPath, "utf8"));
  } catch (error) {
    fail("ledger-disabled", `.vibe-docs.json 解析失败: ${error.message}`);
  }
  const registered = docs.experienceGovernance;
  if (typeof registered !== "string" || registered.trim() === "") {
    fail("ledger-disabled", ".vibe-docs.json 未登记 experienceGovernance");
  }
  ledgerRelative = registered.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  // 契约缺口：登记路径必须被安装态契约白名单显式覆盖，否则拒绝（防止绕过治理边界写任意路径）
  if (!whitelist.includes(ledgerRelative)) {
    fail("contract-gap", `台账路径 ${ledgerRelative} 不在契约 writeWhitelist 内（登记与契约不一致，fail-closed）`);
  }
  // 越根/junction 防线：规范化后必须仍在目标项目内
  const resolved = path.resolve(targetRoot, registered);
  const rootResolved = path.resolve(targetRoot);
  if (!resolved.startsWith(rootResolved + path.sep)) {
    fail("contract-gap", `台账路径越出目标项目根: ${ledgerRelative}`);
  }
  try {
    const realRoot = fs.realpathSync(rootResolved);
    const realLedgerDir = fs.realpathSync(path.dirname(resolved));
    if (!realLedgerDir.startsWith(realRoot + path.sep)) {
      fail("contract-gap", "台账目录经符号链接/junction 重定向出目标项目，拒绝写入");
    }
  } catch (error) {
    fail("io", `台账路径解析失败: ${error.message}`);
  }
}
const ledgerPath = ledgerRelative ? path.resolve(targetRoot, ledgerRelative) : "";

// ---- 状态目录（消化标记 / dismissals 审计）----
let stateDir = argValue("--state-dir");
if (!stateDir) stateDir = path.join(targetRoot, ".feisheng", "vibe-hook-state");
stateDir = path.resolve(stateDir);

function writeDigestMarker(dedupKey) {
  if (!/^[0-9a-f]{40}$/u.test(dedupKey)) fail("bad-dedup-key", "source-dedup-key 必须是 40 位小写十六进制");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, `${dedupKey}.digested`), new Date().toISOString(), "utf8");
}

// ---- 政策机制（政策制自治：owner 会话确认一次政策，AI 之后按政策自治清扫）----
const POLICY_FENCE_OPEN = "```json vibe-experience-policies";
const POLICY_REQUIRED_KEYS = ["policyId", "type", "tier", "countBelow", "daysUnhit", "confirmedAt", "confirmedBy", "source"];

function parsePolicyDoc(markdown) {
  const openIdx = markdown.indexOf(POLICY_FENCE_OPEN);
  if (openIdx === -1) return { doc: { vibeExperiencePolicies: "v1", policies: [] }, rawBlock: null };
  const bodyStart = openIdx + POLICY_FENCE_OPEN.length;
  const closeIdx = markdown.indexOf("\n```", bodyStart);
  if (closeIdx === -1) fail("schema", "政策围栏缺少闭合 ```");
  let doc;
  try {
    doc = JSON.parse(markdown.slice(bodyStart, closeIdx).trim());
  } catch (error) {
    fail("schema", `政策围栏 JSON 非法: ${error.message}`);
  }
  if (!doc || doc.vibeExperiencePolicies !== "v1" || !Array.isArray(doc.policies)) {
    fail("schema", "政策围栏必须是 {vibeExperiencePolicies:'v1', policies:[...]}");
  }
  const seen = new Set();
  for (const policy of doc.policies) {
    assertExactKeys(policy, POLICY_REQUIRED_KEYS, [], "policies[]");
    if (!/^P-\d{3,}$/u.test(policy.policyId)) fail("schema", "policyId 必须是 P- 加至少三位数字");
    if (policy.type !== "sweep") fail("schema", "policy.type 目前仅支持 sweep");
    if (policy.tier !== "L0") fail("schema", "清扫政策目前仅支持 tier=L0（更高档位退役必须逐次用户确认）");
    if (!Number.isInteger(policy.countBelow) || policy.countBelow < 1) fail("schema", "countBelow 必须是正整数");
    if (!Number.isInteger(policy.daysUnhit) || policy.daysUnhit < 1) fail("schema", "daysUnhit 必须是正整数");
    if (!isCanonicalIsoStrict(policy.confirmedAt)) fail("schema", "confirmedAt 必须是 canonical ISO 时间");
    if (!singleLine(policy.confirmedBy) || !singleLine(policy.source)) fail("schema", "confirmedBy/source 必须是非空单行字符串");
    if (seen.has(policy.policyId)) fail("schema", `policyId 重复: ${policy.policyId}`);
    seen.add(policy.policyId);
  }
  return { doc, rawBlock: markdown.slice(openIdx, closeIdx + 4) };
}

function policyBlockText(doc) {
  return `${POLICY_FENCE_OPEN}\n${JSON.stringify(doc, null, 2)}\n\`\`\``;
}

function sweepJournalRelative() {
  const dir = path.dirname(ledgerRelative);
  const base = path.basename(ledgerRelative).replace(/\.md$/u, "");
  const relative = (dir ? dir + "/" : "") + base + "-清扫.md";
  if (!whitelist.includes(relative)) {
    fail("contract-gap", `清扫日志路径 ${relative} 不在契约 writeWhitelist 内（非常规台账路径需先扩充契约，fail-closed）`);
  }
  return relative;
}

function readLastGovern() {
  const markerPath = path.join(stateDir, "last-govern.json");
  if (!fs.existsSync(markerPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(markerPath, "utf8"));
  } catch {
    return null;
  }
}

// ---- ledger v2 解析与校验（镜像 experience-ledger-core 的形状约束，fail-closed 子集）----
function parseLedgerMarkdown(markdown) {
  if (typeof markdown !== "string") fail("schema", "台账必须是文本");
  let body = markdown;
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  const openIdx = body.indexOf(FENCE_OPEN);
  if (openIdx === -1) fail("schema", "未找到经验治理真源块（```json vibe-experience-ledger）");
  const bodyStart = openIdx + FENCE_OPEN.length;
  const closeIdx = body.indexOf(`\n${FENCE_CLOSE}`, bodyStart);
  if (closeIdx === -1) fail("schema", "真源块缺少闭合围栏 ```");
  let parsed;
  try {
    parsed = JSON.parse(body.slice(bodyStart, closeIdx).trim());
  } catch (error) {
    fail("schema", `真源 JSON 非法: ${error.message}`);
  }
  return { ledger: parsed, prefix: body.slice(0, bodyStart), suffix: body.slice(closeIdx), bom: markdown.charCodeAt(0) === 0xfeff ? "\uFEFF" : "" };
}

function isCanonicalIsoStrict(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function validateLedger(ledger) {
  assertExactKeys(ledger, ["vibeExperienceLedger", "revision", "l1RegistryAnchor", "thresholds", "processedEvents", "consumedConfirmations", "experiences", "archived"], [], "ledger");
  if (ledger.vibeExperienceLedger !== "v2") fail("schema", "只支持 ledger schema v2");
  if (!Number.isInteger(ledger.revision) || ledger.revision < 0) fail("schema", "revision 必须是非负整数");
  if (ledger.l1RegistryAnchor !== null && (typeof ledger.l1RegistryAnchor !== "object" || Array.isArray(ledger.l1RegistryAnchor))) {
    fail("schema", "l1RegistryAnchor 必须是 null 或对象");
  }
  assertExactKeys(ledger.thresholds, ["L0", "L1", "L2"], [], "ledger.thresholds");
  for (const tier of ["L0", "L1", "L2"]) {
    if (!Number.isInteger(ledger.thresholds[tier]) || ledger.thresholds[tier] <= 0) {
      fail("schema", `thresholds.${tier} 必须是正整数`);
    }
  }
  for (const key of ["processedEvents", "consumedConfirmations", "experiences", "archived"]) {
    if (!Array.isArray(ledger[key])) fail("schema", `${key} 必须是数组`);
  }
  const ids = new Set();
  const eventIds = new Set();
  for (const event of ledger.processedEvents) {
    assertExactKeys(event, ["eventId", "signalType", "scope", "promptHash", "occurredAt", "experienceId"], [], "processedEvents[]");
    if (typeof event.eventId !== "string" || event.eventId.trim() === "") fail("schema", "processedEvents[].eventId 必须是非空字符串");
    if (event.signalType !== SIGNAL_TYPE) fail("schema", `processedEvents[].signalType 必须是 ${SIGNAL_TYPE}`);
    if (event.scope !== SCOPE) fail("schema", `processedEvents[].scope 必须是 ${SCOPE}`);
    if (typeof event.promptHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(event.promptHash)) fail("schema", "processedEvents[].promptHash 必须是 sha256:<64hex>");
    if (!isCanonicalIsoStrict(event.occurredAt)) fail("schema", "processedEvents[].occurredAt 必须是 canonical ISO 时间");
    if (typeof event.experienceId !== "string" || event.experienceId.trim() === "") fail("schema", "processedEvents[].experienceId 必须是非空字符串");
    if (eventIds.has(event.eventId)) fail("schema", `processedEvents eventId 重复: ${event.eventId}`);
    eventIds.add(event.eventId);
  }
  const checkExperience = (record, where) => {
    assertExactKeys(record, ["id", "summary", "tier", "count", "trajectory", "landing"], ["confirmationHistory", "confirmation"], where);
    if (typeof record.id !== "string" || !/^EXP-\d{3,}$/u.test(record.id)) fail("schema", `${where}.id 必须是 EXP- 加至少三位数字`);
    if (!singleLine(record.summary)) fail("schema", `${where}.summary 必须是非空单行字符串`);
    if (!TIER_ORDER.includes(record.tier)) fail("schema", `${where}.tier 非法`);
    if (!Number.isInteger(record.count) || record.count < 0) fail("schema", `${where}.count 必须是非负整数`);
    if (!Array.isArray(record.trajectory) || record.trajectory.some((item) => typeof item !== "string" || item.trim() === "")) {
      fail("schema", `${where}.trajectory 必须是非空字符串数组`);
    }
    if (record.landing !== null && !singleLine(record.landing)) fail("schema", `${where}.landing 必须是 null 或非空字符串`);
    if (ids.has(record.id)) fail("schema", `experience id 重复: ${record.id}`);
    ids.add(record.id);
  };
  for (const record of ledger.experiences) checkExperience(record, "experiences[]");
  for (const record of ledger.archived) checkExperience(record, "archived[]");
}

function nextExperienceId(ledger) {
  let max = 0;
  const scan = (id) => {
    const match = /^EXP-(\d+)$/u.exec(id || "");
    if (match) max = Math.max(max, Number(match[1]));
  };
  for (const record of [...ledger.experiences, ...ledger.archived]) scan(record.id);
  // 清扫日志中的 id 持续占用，永不复用（防止新教训与已清扫教训身份混淆）
  const journalRelative = (() => {
    const dir = path.dirname(ledgerRelative);
    const base = path.basename(ledgerRelative).replace(/\.md$/u, "");
    const relative = (dir ? dir + "/" : "") + base + "-清扫.md";
    return whitelist.includes(relative) ? relative : null;
  })();
  if (journalRelative) {
    const journalPath = path.resolve(targetRoot, journalRelative);
    if (fs.existsSync(journalPath)) {
      const text = fs.readFileSync(journalPath, "utf8");
      for (const match of text.matchAll(/^## (EXP-\d+) ·/gmu)) scan(match[1]);
    }
  }
  return `EXP-${String(max + 1).padStart(3, "0")}`;
}

function thresholdOf(ledger, tier) {
  return tier === "L3" ? null : ledger.thresholds[tier];
}

// ---- 动作 ----
if (optAction === "check") {
  if (!fs.existsSync(ledgerPath)) fail("no-ledger", `台账文件不存在: ${ledgerRelative}`);
  const markdown = fs.readFileSync(ledgerPath, "utf8");
  const { ledger } = parseLedgerMarkdown(markdown);
  validateLedger(ledger);
  const { doc: policyDoc } = parsePolicyDoc(markdown);
  const marker = readLastGovern();
  const DAY_MS = 86400000;
  const ageOver = marker ? (Date.now() - new Date(marker.at).getTime() > 14 * DAY_MS) : true;
  const growthOver = marker ? (ledger.revision - (Number.isInteger(marker.revision) ? marker.revision : 0) >= 5) : true;
  out({
    ok: true,
    action: "check",
    ledgerPath: ledgerRelative,
    revision: ledger.revision,
    thresholds: ledger.thresholds,
    experiences: ledger.experiences.map((record) => ({ id: record.id, summary: record.summary, tier: record.tier, count: record.count })),
    archivedCount: ledger.archived.length,
    policies: policyDoc.policies.map((policy) => ({ policyId: policy.policyId, tier: policy.tier, countBelow: policy.countBelow, daysUnhit: policy.daysUnhit })),
    governance: {
      dueForReview: policyDoc.policies.length > 0 && (ageOver || growthOver),
      lastGovernAt: marker ? marker.at : null,
      note: policyDoc.policies.length === 0 ? "未登记清扫政策：可向用户提议政策文本，经确认后 policy-add" : undefined,
    },
  });
  process.exit(0);
}

if (optAction === "dismiss") {
  const dedupKey = argValue("--source-dedup-key") || "";
  const reason = argValue("--reason") || "";
  if (!/^[0-9a-f]{40}$/u.test(dedupKey)) fail("bad-dedup-key", "--source-dedup-key 必须是 40 位小写十六进制");
  if (!singleLine(reason)) fail("usage", "--reason 必须是非空单行字符串");
  fs.mkdirSync(stateDir, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), dedupKey, reason }) + "\n";
  fs.appendFileSync(path.join(stateDir, "dismissals.log"), line, "utf8");
  fs.writeFileSync(path.join(stateDir, `${dedupKey}.digested`), new Date().toISOString(), "utf8");
  out({ ok: true, action: "dismiss", dedupKey, digestMarked: true });
  process.exit(0);
}

// selfcheck：Stop 硬门禁的自检留痕（无新教训时也要留痕；与 runner 的会话 id 消毒规则一致）
if (optAction === "selfcheck") {
  let sid = argValue("--session") || "nosession";
  if (sid.length > 80 || !/^[A-Za-z0-9._-]{1,80}$/u.test(sid)) {
    sid = crypto.createHash("sha256").update(sid, "utf8").digest("hex").slice(0, 40);
  }
  const finding = argValue("--finding") || "none";
  if (!singleLine(finding)) fail("usage", "--finding 必须是非空单行字符串（none 表示本会话无可复用教训）");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, `selfcheck-${sid}.json`), JSON.stringify({ at: new Date().toISOString(), sessionId: sid, finding }, null, 2), "utf8");
  out({ ok: true, action: "selfcheck", sessionId: sid, finding, acknowledged: true });
  process.exit(0);
}

// ---- 政策动作 ----
if (optAction === "policy-list") {
  if (!fs.existsSync(ledgerPath)) fail("no-ledger", `台账文件不存在: ${ledgerRelative}`);
  const markdown = fs.readFileSync(ledgerPath, "utf8");
  const { doc } = parsePolicyDoc(markdown);
  out({ ok: true, action: "policy-list", policies: doc.policies });
  process.exit(0);
}

if (optAction === "policy-add") {
  const policyId = argValue("--policy-id") || "";
  const tier = argValue("--tier") || "";
  const countBelow = Number(argValue("--count-below"));
  const daysUnhit = Number(argValue("--days-unhit"));
  const confirmedBy = argValue("--confirmed-by") || "";
  const source = argValue("--policy-source") || "";
  if (!/^P-\d{3,}$/u.test(policyId)) fail("usage", "--policy-id 必须是 P- 加至少三位数字");
  if (tier !== "L0") fail("usage", "--tier 目前仅支持 L0（清扫政策只作用于 L0 尘埃条目）");
  if (!Number.isInteger(countBelow) || countBelow < 1) fail("usage", "--count-below 必须是正整数");
  if (!Number.isInteger(daysUnhit) || daysUnhit < 1) fail("usage", "--days-unhit 必须是正整数");
  if (!singleLine(confirmedBy)) fail("usage", "--confirmed-by 必须是非空单行字符串（谁确认的政策）");
  if (!singleLine(source)) fail("usage", "--policy-source 必须是非空单行字符串（确认来源，如会话/日期）");
  if (!fs.existsSync(ledgerPath)) fail("no-ledger", `台账文件不存在: ${ledgerRelative}`);
  const raw = fs.readFileSync(ledgerPath, "utf8");
  parseLedgerMarkdown(raw); // 台账结构合法才允许挂政策
  const { doc, rawBlock } = parsePolicyDoc(raw);
  const policy = {
    policyId,
    type: "sweep",
    tier,
    countBelow,
    daysUnhit,
    confirmedAt: new Date().toISOString(),
    confirmedBy,
    source,
  };
  const index = doc.policies.findIndex((item) => item.policyId === policyId);
  if (index >= 0) doc.policies[index] = policy;
  else doc.policies.push(policy);
  if (rawBlock) {
    const updated = raw.replace(rawBlock, policyBlockText(doc));
    const tmpPath = `${ledgerPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, updated, "utf8");
    fs.renameSync(tmpPath, ledgerPath);
  } else {
    const appended = raw.replace(/\n*$/u, "\n\n") + policyBlockText(doc) + "\n";
    const tmpPath = `${ledgerPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, appended, "utf8");
    fs.renameSync(tmpPath, ledgerPath);
  }
  out({ ok: true, action: "policy-add", policy });
  process.exit(0);
}

if (optAction === "govern") {
  const policyId = argValue("--policy-id") || "";
  if (!/^P-\d{3,}$/u.test(policyId)) fail("usage", "--policy-id 必须是 P- 加至少三位数字");
  if (!fs.existsSync(ledgerPath)) fail("no-ledger", `台账文件不存在: ${ledgerRelative}`);
  const raw = fs.readFileSync(ledgerPath, "utf8");
  const { ledger, prefix, suffix, bom } = parseLedgerMarkdown(raw);
  validateLedger(ledger);
  const { doc: policyDoc } = parsePolicyDoc(raw);
  const policy = policyDoc.policies.find((item) => item.policyId === policyId);
  if (!policy) fail("unknown-policy", `政策未登记: ${policyId}（先 policy-add，政策必须经用户确认后才能登记）`);

  const DAY_MS = 86400000;
  const now = Date.now();
  const swept = [];
  const kept = [];
  for (const experience of ledger.experiences) {
    const bound = ledger.processedEvents.filter((event) => event.experienceId === experience.id);
    let lastHitMs = null;
    if (bound.length > 0) {
      lastHitMs = Math.max(...bound.map((event) => new Date(event.occurredAt).getTime()));
    } else {
      const stampMatch = /^(\d{4}-\d{2}-\d{2}) /u.exec(experience.trajectory[0] || "");
      if (stampMatch) lastHitMs = new Date(`${stampMatch[1]}T00:00:00.000Z`).getTime();
    }
    // 无任何命中时间证据的条目保守跳过（宁可漏扫，不可错扫）
    if (lastHitMs === null || Number.isNaN(lastHitMs)) { kept.push(experience.id); continue; }
    const daysUnhit = (now - lastHitMs) / DAY_MS;
    if (experience.tier === policy.tier && experience.count < policy.countBelow && daysUnhit >= policy.daysUnhit) {
      swept.push({ experience, events: bound });
    } else {
      kept.push(experience.id);
    }
  }

  const sweptAt = new Date().toISOString();
  let journalRelative = null;
  if (swept.length > 0) {
    journalRelative = sweepJournalRelative();
    const journalPath = path.resolve(targetRoot, journalRelative);
    const resolved = path.resolve(journalPath);
    if (!resolved.startsWith(path.resolve(targetRoot) + path.sep)) fail("contract-gap", "清扫日志路径越出目标项目根");
    const lines = swept.map(({ experience, events }) =>
      `## ${experience.id} · 清扫于 ${sweptAt}（政策 ${policy.policyId}，tier=${experience.tier}，count=${experience.count}）\n\n` +
      "```json\n" + JSON.stringify({ experience, events }, null, 2) + "\n```\n\n" +
      `恢复方式：将 experience 条目重新加入台账 experiences（保持原 id），其 events 已在台账 processedEvents 中保留，重放幂等会自动拦截重复计数。\n`
    );
    fs.appendFileSync(journalPath, lines.join("\n") + "\n", "utf8");
    const sweptIds = new Set(swept.map((item) => item.experience.id));
    ledger.experiences = ledger.experiences.filter((experience) => !sweptIds.has(experience.id));
    ledger.revision += 1;
    validateLedger(ledger);
    const content = bom + prefix + JSON.stringify(ledger, null, 2) + suffix;
    const tmpPath = `${ledgerPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, content, "utf8");
    try {
      fs.renameSync(tmpPath, ledgerPath);
    } catch (error) {
      try { fs.unlinkSync(tmpPath); } catch {}
      fail("io", `清扫原子写入失败: ${error.message}`);
    }
  }

  fs.mkdirSync(stateDir, { recursive: true });
  const marker = { at: sweptAt, revision: ledger.revision, policyId, swept: swept.map((item) => item.experience.id) };
  fs.writeFileSync(path.join(stateDir, "last-govern.json"), JSON.stringify(marker, null, 2), "utf8");

  out({
    ok: true,
    action: "govern",
    policyId,
    swept: swept.map((item) => item.experience.id),
    keptCount: kept.length,
    revision: ledger.revision,
    sweepJournal: swept.length > 0 ? journalRelative : null,
    restored: "清扫条目完整存于清扫日志，可人工恢复",
  });
  process.exit(0);
}

// record
const eventId = argValue("--event-id") || "";
const promptHashArg = argValue("--prompt-hash");
const promptMaterial = argValue("--prompt-material");
const occurredAtArg = argValue("--occurred-at");
const summary = argValue("--summary");
const experienceIdArg = argValue("--experience-id");
const expectedRevisionRaw = argValue("--expected-revision");
const sourceDedupKey = argValue("--source-dedup-key") || "";

if (typeof eventId !== "string" || eventId.trim() === "") fail("usage", "record 必须提供 --event-id");
let promptHash = "";
if (promptHashArg !== undefined) {
  if (!/^sha256:[a-f0-9]{64}$/u.test(promptHashArg)) fail("usage", "--prompt-hash 必须是 sha256:<64hex>");
  promptHash = promptHashArg;
} else if (promptMaterial !== undefined) {
  if (!singleLine(promptMaterial)) fail("usage", "--prompt-material 必须是非空单行字符串");
  promptHash = `sha256:${sha256Hex(promptMaterial)}`;
} else {
  fail("usage", "record 必须提供 --prompt-hash 或 --prompt-material");
}
let occurredAt = canonicalIso(occurredAtArg !== undefined ? occurredAtArg : new Date().toISOString());
if (!occurredAt) fail("usage", "--occurred-at 必须是可解析的时间");
if (experienceIdArg !== undefined && !/^(EXP-\d{3,})$/u.test(experienceIdArg)) fail("usage", "--experience-id 必须是 EXP- 加至少三位数字");
if (experienceIdArg === undefined && summary === undefined) fail("usage", "新经验必须提供 --summary；命中已有经验请提供 --experience-id");
if (summary !== undefined && !singleLine(summary)) fail("usage", "--summary 必须是非空单行字符串（禁止换行，禁止照抄原始 prompt）");
if (experienceIdArg !== undefined && summary !== undefined) fail("usage", "--experience-id 与 --summary 只能二选一");
const expectedRevision = Number(expectedRevisionRaw);
if (!Number.isInteger(expectedRevision) || expectedRevision < 0) fail("usage", "--expected-revision 必须是显式非负整数（先 --action check 获取）");
if (sourceDedupKey && !/^[0-9a-f]{40}$/u.test(sourceDedupKey)) fail("bad-dedup-key", "--source-dedup-key 必须是 40 位小写十六进制");

if (!fs.existsSync(ledgerPath)) fail("no-ledger", `台账文件不存在: ${ledgerRelative}`);
const { ledger, prefix, suffix, bom } = parseLedgerMarkdown(fs.readFileSync(ledgerPath, "utf8"));
validateLedger(ledger);

if (ledger.revision !== expectedRevision) {
  fail("revision-conflict", `revision 冲突：台账当前 ${ledger.revision}，调用方期望 ${expectedRevision}；请重新 --action check 后再试`, { currentRevision: ledger.revision, expectedRevision });
}

const event = { eventId, signalType: SIGNAL_TYPE, scope: SCOPE, promptHash, occurredAt };
const existingEvent = ledger.processedEvents.find((item) => item?.eventId === eventId);
let replay = false;
let experienceId = experienceIdArg || null;
if (existingEvent) {
  const payloadMatch = existingEvent.signalType === event.signalType &&
    existingEvent.scope === event.scope &&
    existingEvent.promptHash === event.promptHash &&
    existingEvent.occurredAt === event.occurredAt &&
    (experienceId !== null ? existingEvent.experienceId === experienceId : typeof existingEvent.experienceId === "string" && existingEvent.experienceId !== "");
  if (!payloadMatch) fail("event-collision", "eventId collision：同一 eventId 的事件 payload 不一致；如为超时重试，请携带 stored 字段原样重发即可 no-op 重放", { stored: existingEvent, expected: { ...event, experienceId } });
  replay = true;
  experienceId = existingEvent.experienceId;
} else {
  if (experienceId !== null) {
    const index = ledger.experiences.findIndex((record) => record.id === experienceId);
    if (index === -1) fail("unknown-experience", `未知经验 id：${experienceId}（先 --action check 查看现有经验）`);
    ledger.experiences[index].count += 1;
  } else {
    experienceId = nextExperienceId(ledger);
    ledger.experiences.push({
      id: experienceId,
      summary,
      tier: "L0",
      count: 1,
      trajectory: [`${occurredAt.slice(0, 10)} 记录@L0`],
      landing: null,
    });
  }
  ledger.processedEvents.push({ ...event, experienceId });
  ledger.revision += 1;
}

validateLedger(ledger);
const record = ledger.experiences.find((item) => item.id === experienceId);
const threshold = thresholdOf(ledger, record.tier);
const atThreshold = threshold !== null && record.count >= threshold;

const content = bom + prefix + JSON.stringify(ledger, null, 2) + suffix;
const tmpPath = `${ledgerPath}.tmp-${process.pid}-${Date.now()}`;
fs.writeFileSync(tmpPath, content, "utf8");
try {
  fs.renameSync(tmpPath, ledgerPath);
} catch (error) {
  try { fs.unlinkSync(tmpPath); } catch {}
  fail("io", `原子写入失败: ${error.message}`);
}

let digestMarked = false;
if (sourceDedupKey) {
  writeDigestMarker(sourceDedupKey);
  digestMarked = true;
}

out({
  ok: true,
  action: "record",
  experienceId,
  count: record.count,
  tier: record.tier,
  revision: ledger.revision,
  replay,
  atThreshold,
  threshold: threshold ?? null,
  digestMarked,
  note: atThreshold ? "已达升档阈值：只向用户报告可升信号，升档必须用户确认，本工具不会升档" : undefined,
});
