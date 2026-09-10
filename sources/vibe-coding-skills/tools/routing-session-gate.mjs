#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const USER_ENTRY_ID = "vibe-coding-skills";
export const EVENT_ONLY_IDS = new Set(["evolution-engine", "experience-elevator", "feedback-writer"]);
let invocationMap;

function loadInvocationMap() {
  if (invocationMap) return invocationMap;
  try {
    const root = process.env.VIBE_CODING_SKILLS_HOME || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "skills", "ROUTING-MANIFEST.json"), "utf8"));
    invocationMap = new Map((manifest.skills || []).map((skill) => [skill.id, skill.invocation]));
  } catch {
    invocationMap = new Map();
  }
  return invocationMap;
}

function messageText(message) {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object" || message.role !== "user") return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((part) => typeof part === "string" || part?.type === "text")
      .map((part) => (typeof part === "string" ? part : part.text || ""))
      .join("\n");
  }
  return "";
}

function containsEntryToken(text) {
  return /(?:^|[^\p{L}\p{N}_-])\/?vibe-coding-skills(?:$|[^\p{L}\p{N}_-])/iu.test(text);
}

function hasEntryToken(text) {
  if (!containsEntryToken(text)) return false;
  const invocation = text.match(/^\s*\/?vibe-coding-skills(?=$|[\s,:，。!?])/iu);
  const verbInvocation = /^(?:\s*请\s*)?(?:调用|使用|打开|启动|进入|启用)\s+\/?vibe-coding-skills(?=$|[\s,:，。!?])/iu.test(text);
  if (!invocation && !verbInvocation) return false;
  const tokenEnd = invocation ? invocation[0].length : text.search(/\/?vibe-coding-skills/iu) + "vibe-coding-skills".length;
  const rest = text.slice(tokenEnd).replace(/^[\s,:，。!?]+/u, "");
  return !/^(?:是什么|什么意思|怎么用|如何使用|指什么|是什么东西|不要|别|不想|不再|不能|可以吗|是否|我不|请不要)/iu.test(rest);
}

function closesEntry(text) {
  return /(?:关闭|停用|不要(?:再)?(?:使用|调用|打开|启动)|不用|不想(?:再)?用|不再用)\s*(?:这个)?(?:总入口|vibe-coding-skills)/iu.test(text);
}

export function reduceConversation(messages = []) {
  let active = false;
  let activationTurn = null;
  let closedTurn = null;
  let turn = 0;

  for (const message of messages) {
    const text = messageText(message);
    if (!text) continue;
    if (closesEntry(text)) {
      active = false;
      closedTurn = turn;
    } else if (hasEntryToken(text)) {
      active = true;
      activationTurn = turn;
      closedTurn = null;
    }
    turn += 1;
  }

  return { active, activationTurn, closedTurn, turns: turn };
}

export function canLoadSkill({ skillId, invocation, conversation = {}, caller = "conversation" } = {}) {
  if (!skillId) return false;
  const expectedInvocation = loadInvocationMap().get(skillId);
  if (!expectedInvocation || (invocation && invocation !== expectedInvocation)) return false;
  if (expectedInvocation === "event-only") return caller === "structured-event" && EVENT_ONLY_IDS.has(skillId);
  if (expectedInvocation === "user-only") return skillId === USER_ENTRY_ID && caller === "user";
  return expectedInvocation === "router-only" && conversation.active === true && caller === "conversation";
}

export function evaluateSequence(messages, request) {
  const conversation = reduceConversation(messages);
  return {
    conversation,
    allowed: canLoadSkill({ ...request, conversation }),
  };
}

function firstString(input, fields) {
  for (const field of fields) {
    if (typeof input?.[field] === "string" && input[field].trim()) return input[field].trim();
  }
  return "";
}

function statePath(sessionId) {
  const stateRoot = process.env.VIBE_ROUTING_STATE_DIR || path.join(os.tmpdir(), "vibe-coding-skills-routing");
  const key = crypto.createHash("sha256").update(sessionId, "utf8").digest("hex");
  return path.join(stateRoot, `${key}.json`);
}

function readState(sessionId) {
  if (!sessionId) return { active: false, persisted: false };
  try {
    const value = JSON.parse(fs.readFileSync(statePath(sessionId), "utf8"));
    return { active: value.active === true, persisted: true };
  } catch {
    return { active: false, persisted: true };
  }
}

function writeState(sessionId, active) {
  if (!sessionId) return;
  const target = statePath(sessionId);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify({ active, updatedAt: new Date().toISOString() })}\n`, "utf8");
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

export function evaluateHook(input = {}) {
  const prompt = firstString(input, ["prompt", "userPrompt", "message"]);
  const sessionId = firstString(input, ["session_id", "sessionId", "conversation_id", "conversationId"]);
  const previous = readState(sessionId);
  const active = closesEntry(prompt) ? false : hasEntryToken(prompt) ? true : previous.active;
  writeState(sessionId, active);
  return {
    active,
    persisted: Boolean(sessionId),
    sessionIdPresent: Boolean(sessionId),
    additionalContext: active
      ? "[vibe-coding-skills routing gate: ACTIVE] 用户已在当前对话显式调用总入口。普通自然语言可以交给总入口 routeHints；event-only Skill 仍只接受 structured-event caller。"
      : "[vibe-coding-skills routing gate: CLOSED] 用户尚未在当前对话显式调用总入口，或已关闭它。不要加载任何 router-only / event-only Skill；普通自然语言保持 no-skill。",
  };
}

function parseArgs(argv) {
  const options = { runtime: "plain", hook: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--hook") options.hook = true;
    else if (argv[index] === "--runtime") options.runtime = argv[++index] || "plain";
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  if (!["plain", "claude", "codex"].includes(options.runtime)) throw new Error(`unsupported runtime: ${options.runtime}`);
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fs.readFileSync(0, "utf8").replace(/^\uFEFF/u, ""));
  if (!options.hook) {
    const result = evaluateSequence(input.messages || [], input.request || {});
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const gate = evaluateHook(input);
  if (options.runtime === "codex") {
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", ...gate } })}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(gate)}\n`);
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === "routing-session-gate.mjs") main();
