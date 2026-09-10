#!/usr/bin/env node
// DocMap:
// Layer: L3 / key script
// Module: tools
// Depends on: tools/init-target-runtime.mjs, AGENTS.md, CLAUDE.md
// Syncs with: tools/INDEX.md, tools/test-target-runtime.mjs
// Verifies AGENTS.md and CLAUDE.md managed-block rules stay in sync (identical except the runtime line).

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const START_PREFIX = "<!-- vibe-coding-skills:target-runtime:start";
const END_MARKER = "<!-- vibe-coding-skills:target-runtime:end -->";
const TARGET_FILES = ["AGENTS.md", "CLAUDE.md"];

function usage() {
  console.error(`Usage:
  node tools/check-runtime-sync.mjs <target-root> [--json]

Verifies that the vibe-coding-skills managed blocks in AGENTS.md and CLAUDE.md
carry identical rules. They may differ only in the single "运行时：" line, which
names the runtime (Claude/Codex) and its entry file. Any other divergence means a
hand edit drifted the two files apart and must be resynced via init-target-runtime.mjs.`);
}

function parseArgs(argv) {
  const args = { root: "", json: false, help: false };
  for (const item of argv) {
    if (item === "--json") args.json = true;
    else if (item === "-h" || item === "--help") args.help = true;
    else if (!item.startsWith("-") && !args.root) args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function normalize(value) {
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

// Extract the managed-block body (between start-marker line and end marker).
function extractBlockBody(content) {
  const text = normalize(content);
  const start = text.indexOf(START_PREFIX);
  const end = text.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) return null;
  const startLineEnd = text.indexOf("\n", start);
  if (startLineEnd === -1 || startLineEnd > end) return null;
  return text.slice(startLineEnd + 1, end).replace(/\n$/u, "");
}

// Drop the single runtime-identity line so the rest can be compared verbatim.
// That line reads: "- 运行时：<Runtime> 会读取本项目根目录的 `<entry>`。"
function stripRuntimeLine(body) {
  return body
    .split("\n")
    .filter((line) => !/^- 运行时：/.test(line.trim()))
    .join("\n");
}

function run(args) {
  const root = path.resolve(args.root || ".");
  const files = {};
  const problems = [];

  for (const file of TARGET_FILES) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) {
      problems.push({ file, reason: "file missing" });
      continue;
    }
    const body = extractBlockBody(fs.readFileSync(filePath, "utf8"));
    if (body === null) {
      problems.push({ file, reason: "managed block missing or malformed" });
      continue;
    }
    files[file] = stripRuntimeLine(body);
  }

  let inSync = false;
  if (problems.length === 0) {
    inSync = files["AGENTS.md"] === files["CLAUDE.md"];
    if (!inSync) {
      problems.push({
        file: "AGENTS.md vs CLAUDE.md",
        reason:
          "managed-block rules diverge beyond the runtime line; resync via init-target-runtime.mjs --write",
      });
    }
  }

  return { ok: problems.length === 0 && inSync, root, problems };
}

function printText(result) {
  console.log(`Runtime sync check: root=${result.root}`);
  if (result.ok) {
    console.log("AGENTS.md and CLAUDE.md managed-block rules are in sync.");
    return;
  }
  for (const problem of result.problems) {
    console.log(`[FAIL] ${problem.file}: ${problem.reason}`);
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exitCode = 0;
  } else if (!args.root) {
    throw Object.assign(new Error("Missing target root."), { exitCode: 2 });
  } else {
    const result = run(args);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else printText(result);
    process.exitCode = result.ok ? 0 : 1;
  }
} catch (error) {
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  } else {
    console.error(`[FAIL] ${error.message}`);
  }
  process.exitCode = error.exitCode || 2;
}
