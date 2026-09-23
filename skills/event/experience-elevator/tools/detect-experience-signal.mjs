#!/usr/bin/env node

import crypto from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CORRECTION_PHRASES = Object.freeze([
  "不是这样", "别这样做", "你搞错", "搞错了", "你错了", "不对", "不应该",
  "你漏了", "你忘了", "你又忘", "你又犯错", "又犯错", "又踩", "上次说过", "说过了", "提醒过", "怎么还",
  "每次都", "不要再", "别再", "没有执行", "没有生效",
]);
const SCOPES = new Set(["global-codex", "target-project", "package-feedback"]);
const IDENTITY_FIELDS = Object.freeze([
  ["event", ["eventId", "event_id", "hookEventId", "hook_event_id"]],
  ["message", ["messageId", "message_id", "userMessageId", "user_message_id"]],
  ["turn", ["turnId", "turn_id"]],
  ["request", ["requestId", "request_id", "interactionId", "interaction_id"]],
]);
const OCCURRED_AT_FIELDS = Object.freeze(["occurredAt", "occurred_at", "timestamp", "createdAt", "created_at"]);

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function parseArgs(argv) {
  const args = { runtime: "plain" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--runtime") {
      args.runtime = argv[index + 1] || "";
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  if (!new Set(["plain", "claude", "codex"]).has(args.runtime)) {
    throw new Error(`unsupported runtime: ${args.runtime}`);
  }
  return args;
}

function normalizePrompt(value) {
  return String(value || "").replace(/\r\n?/gu, "\n").trim();
}

function scopeSelection(input) {
  const supplied = Object.prototype.hasOwnProperty.call(input || {}, "scopes")
    ? input.scopes
    : input?.scope;
  const raw = Array.isArray(supplied) ? supplied : typeof supplied === "string" ? [supplied] : [];
  if (raw.length === 0 || raw.some((scope) => typeof scope !== "string" || !SCOPES.has(scope))) {
    return { disposition: "scope-required", scope: null };
  }
  const scopes = [...new Set(raw)];
  return scopes.length === 1
    ? { disposition: "record", scope: scopes[0] }
    : { disposition: "proposal-required", scope: null, proposedScopes: scopes };
}

function firstString(input, fields) {
  for (const field of fields) {
    if (typeof input?.[field] === "string" && input[field].trim() !== "") return input[field].trim();
  }
  return null;
}

function occurrenceIdentity(input) {
  for (const [kind, fields] of IDENTITY_FIELDS) {
    const value = firstString(input, fields);
    if (value) return { kind, value };
  }
  return null;
}

function occurredAt(input) {
  const raw = firstString(input, OCCURRED_AT_FIELDS);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function detectExperienceSignal(input) {
  const prompt = normalizePrompt(input?.prompt);
  if (!prompt || !CORRECTION_PHRASES.some((phrase) => prompt.includes(phrase))) return null;
  const promptHash = sha256(prompt);
  const selection = scopeSelection(input);
  const identity = occurrenceIdentity(input);
  const stamp = occurredAt(input);
  const directEventId = firstString(input, ["eventId", "event_id", "hookEventId", "hook_event_id"]);
  const eventId = identity
    ? directEventId || `EVT-${sha256(JSON.stringify(identity)).slice("sha256:".length, "sha256:".length + 24)}`
    : null;
  const disposition = selection.disposition !== "record"
    ? selection.disposition
    : !identity
      ? "identity-required"
      : !stamp
        ? "occurrence-required"
        : "record";
  return {
    eventId,
    promptHash,
    signalType: "explicit-correction",
    scope: selection.scope,
    disposition,
    ...(stamp ? { occurredAt: stamp } : {}),
    ...(selection.proposedScopes ? { proposedScopes: selection.proposedScopes } : {}),
  };
}

export function renderHookSignal(signal, runtime) {
  const contexts = {
    "proposal-required": "检测到显性纠错事件，但它命中多个 scope。只能提议一个范围并取得用户确认，禁止自动双写。",
    "scope-required": "检测到显性纠错事件，但缺少唯一合法 scope。必须先明确范围，禁止默认写入 package-feedback。",
    "identity-required": "检测到显性纠错事件，但宿主没有提供稳定 occurrence identity。禁止自动计数。",
    "occurrence-required": "检测到显性纠错事件，但缺少有效 occurrence timestamp。禁止自动计数。",
  };
  const autoRecord = signal.disposition === "record" && signal.scope === "target-project"
    ? { skill: "experience-elevator", action: "record", decision: "ai", scope: "target-project", caller: "structured-event" }
    : null;
  const context = contexts[signal.disposition]
    || (autoRecord
      ? `检测到目标项目显性纠错事件 ${signal.eventId}。本轮任务完成后，AI 必须自动判断它是否是可复用教训；是则加载 experience-elevator 并调用现有 experience-governance.mjs 的 action=record 自动记录 L0，写入经验文件，不再等待用户确认。一次性偏好或证据不足则跳过；不得自动升级 L1/L2/L3，不保存原始 prompt。`
      : `检测到显性纠错事件 ${signal.eventId}，scope=${signal.scope}。只记录最小信号，不保存原始 prompt。`);
  const route = autoRecord ? { autoRecord } : {};
  if (runtime === "claude") return { additionalContext: context, signal, ...route };
  if (runtime === "codex") {
    return { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context, signal, ...route } };
  }
  return { signal, ...route };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = await new Promise((resolve, reject) => {
    let content = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { content += chunk; });
    process.stdin.on("end", () => resolve(content));
    process.stdin.on("error", reject);
  });
  if (!raw.trim()) return;
  const input = JSON.parse(raw.replace(/^\uFEFF/u, ""));
  const signal = detectExperienceSignal(input);
  if (signal) process.stdout.write(`${JSON.stringify(renderHookSignal(signal, args.runtime))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
