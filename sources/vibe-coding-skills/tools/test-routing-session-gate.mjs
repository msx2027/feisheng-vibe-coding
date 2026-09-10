#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";
import { canLoadSkill, evaluateHook, evaluateSequence, reduceConversation } from "./routing-session-gate.mjs";

const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-routing-session-gate-"));
const previousStateRoot = process.env.VIBE_ROUTING_STATE_DIR;
process.env.VIBE_ROUTING_STATE_DIR = stateRoot;
after(() => {
  if (previousStateRoot === undefined) delete process.env.VIBE_ROUTING_STATE_DIR;
  else process.env.VIBE_ROUTING_STATE_DIR = previousStateRoot;
  fs.rmSync(stateRoot, { recursive: true, force: true });
});

const routerRequest = { skillId: "bug-fixer", invocation: "router-only" };

test("未激活时普通自然语言不能加载具体 Skill", () => {
  const result = evaluateSequence([{ role: "user", content: "页面一直转圈" }], routerRequest);
  assert.equal(result.conversation.active, false);
  assert.equal(result.allowed, false);
});

test("当前轮调用总入口后可以继续使用自然语言路由", () => {
  const result = evaluateSequence(
    [
      { role: "user", content: "vibe-coding-skills" },
      { role: "user", content: "页面一直转圈" },
    ],
    routerRequest,
  );
  assert.equal(result.conversation.active, true);
  assert.equal(result.allowed, true);
});

test("同一消息调用总入口并给出任务也允许路由", () => {
  const result = evaluateSequence([{ role: "user", content: "vibe-coding-skills，页面一直转圈" }], routerRequest);
  assert.equal(result.allowed, true);
});

test("助手文本不能打开用户授权闸门", () => {
  const conversation = reduceConversation([
    { role: "assistant", content: "请使用 vibe-coding-skills" },
    { role: "user", content: "页面一直转圈" },
  ]);
  assert.equal(conversation.active, false);
});

test("普通解释或否定提及不能打开用户授权闸门", () => {
  assert.equal(reduceConversation([{ role: "user", content: "请解释一下 vibe-coding-skills 是什么" }]).active, false);
  assert.equal(reduceConversation([{ role: "user", content: "vibe-coding-skills 是什么" }]).active, false);
  assert.equal(reduceConversation([{ role: "user", content: "/vibe-coding-skills 是什么" }]).active, false);
  assert.equal(reduceConversation([{ role: "user", content: "vibe-coding-skills，我不想使用它" }]).active, false);
  assert.equal(reduceConversation([{ role: "user", content: "我不想使用 vibe-coding-skills" }]).active, false);
});

test("用户关闭总入口后再次禁止自然语言路由", () => {
  const result = evaluateSequence(
    [
      { role: "user", content: "vibe-coding-skills" },
      { role: "user", content: "关闭 vibe-coding-skills" },
      { role: "user", content: "页面一直转圈" },
    ],
    routerRequest,
  );
  assert.equal(result.conversation.active, false);
  assert.equal(result.allowed, false);
});

test("只说关闭总入口也会立即停用路由", () => {
  const result = evaluateSequence(
    [
      { role: "user", content: "vibe-coding-skills" },
      { role: "user", content: "关闭总入口" },
      { role: "user", content: "页面一直转圈" },
    ],
    routerRequest,
  );
  assert.equal(result.conversation.active, false);
  assert.equal(result.allowed, false);
});

test("直接点名具体 Skill 不能绕过总入口", () => {
  const result = evaluateSequence([{ role: "user", content: "bug-fixer" }], routerRequest);
  assert.equal(result.allowed, false);
});

test("event-only 只接受结构化 caller", () => {
  const request = { skillId: "experience-elevator", invocation: "event-only" };
  assert.equal(canLoadSkill({ ...request, caller: "conversation", conversation: { active: true } }), false);
  assert.equal(canLoadSkill({ ...request, caller: "structured-event" }), true);
  assert.equal(canLoadSkill({ skillId: "experience-elevator", invocation: "router-only", caller: "conversation", conversation: { active: true } }), false);
  assert.equal(canLoadSkill({ skillId: "unknown-skill", invocation: "router-only", caller: "conversation", conversation: { active: true } }), false);
});

test("Hook 状态支持多种 session ID 字段并跨轮次持久化", () => {
  const sessionId = "中文-session-id";
  assert.equal(evaluateHook({ session_id: sessionId, prompt: "vibe-coding-skills" }).active, true);
  assert.equal(evaluateHook({ sessionId, prompt: "页面一直转圈" }).active, true);
  assert.equal(evaluateHook({ conversation_id: sessionId, prompt: "关闭总入口" }).active, false);
  assert.equal(evaluateHook({ conversationId: sessionId, prompt: "页面一直转圈" }).active, false);
});

test("损坏的 Hook 状态按关闭处理", () => {
  const sessionId = "corrupt-session";
  const statePath = path.join(
    stateRoot,
    `${crypto.createHash("sha256").update(sessionId, "utf8").digest("hex")}.json`,
  );
  fs.writeFileSync(statePath, "{not-json", "utf8");
  const result = evaluateHook({ sessionId, prompt: "页面一直转圈" });
  assert.equal(result.active, false);
  assert.equal(result.persisted, true);
});

test("Claude 和 Codex Hook 输出各自的运行时结构", () => {
  const input = JSON.stringify({ sessionId: "runtime-shape", prompt: "vibe-coding-skills" });
  const tool = path.resolve("tools/routing-session-gate.mjs");
  const claude = spawnSync(process.execPath, [tool, "--hook", "--runtime", "claude"], { input, encoding: "utf8" });
  assert.equal(claude.status, 0, claude.stderr);
  assert.equal(JSON.parse(claude.stdout).active, true);

  const codex = spawnSync(process.execPath, [tool, "--hook", "--runtime", "codex"], { input, encoding: "utf8" });
  assert.equal(codex.status, 0, codex.stderr);
  const codexOutput = JSON.parse(codex.stdout);
  assert.equal(codexOutput.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.equal(codexOutput.hookSpecificOutput.active, true);
});

console.log("Routing session gate tests passed");
