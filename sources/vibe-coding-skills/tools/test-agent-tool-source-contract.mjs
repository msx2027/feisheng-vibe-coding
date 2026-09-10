#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const agentsIndex = read("agents/INDEX.md");
const findings = [];
if (!/`AGENTS\.md`/u.test(agentsIndex)) findings.push("Agent 索引缺少 Codex 真入口 AGENTS.md");
if (!/`\.claude\/CLAUDE\.md`/u.test(agentsIndex)) findings.push("Agent 索引缺少 Claude 真入口 .claude/CLAUDE.md");
if (/同时更新本索引和 `CLAUDE\.md`/u.test(agentsIndex)) findings.push("Agent 索引把根 CLAUDE.md 当成调度真源");

const commandSurfaces = [
  "skills/target-constitution-setup/SKILL.md",
  "skills/target-constitution-setup/references/workflow.md",
  "skills/target-runtime-setup/SKILL.md",
];
const requiredCommand = 'node "<skills-root>/tools/check-target-doc-names.mjs" "<target-root>" --require-existing';
for (const relativePath of commandSurfaces) {
  const content = read(relativePath);
  if (!/check-target-doc-names\.mjs/u.test(content)) findings.push(`${relativePath} 缺少目标文档命名检查`);
  else if (!content.includes(requiredCommand)) findings.push(`${relativePath} 未使用带引号的绝对 skills root 调用目标文档命名检查`);
  if (/node <skills-root>\/tools\//u.test(content)) findings.push(`${relativePath} 仍有未加引号的工具路径`);
}

assert.deepEqual(findings, [], `Agent 与工具入口真源不一致：\n${findings.join("\n")}`);

console.log("Agent and tool source contract tests passed");
