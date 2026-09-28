#!/usr/bin/env node
// DocMap:
// Layer: L3 / target-project ledger checker CLI
// Module: tools
// Depends on: tools/experience-ledger-core.mjs
// Syncs with: test-experience-governance-closure.mjs（存活规格锁定：472/532 两用例）
//
// 作用（大白话）：验一个目标项目的经验台账是否健康。
// 规矩（由 test-experience-governance-closure 存活用例锁定，2026-09-29 复活批补装）：
//   - .vibe-docs.json 没有 experienceGovernance（或没有 manifest）→ 跳过（exit 0，输出含 skipped/跳过）
//   - 登记了台账但文件缺失 → 失败（exit 2，输出含 缺少/missing）
//   - --file 相对路径：必须是项目内相对路径；含 ..／绝对路径／越出项目根 → 失败（exit 2，输出含 越界/project-relative/traversal/路径）
//   - 台账存在 → experience-ledger-core 全量校验（清扫日志绑定与 init-target-runtime 同口径），坏账 exit 2
// 用法：node tools/check-experience-ledger.mjs <target-root> [--file <project-relative-path>] [--json]
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseLedger } from "./experience-ledger-core.mjs";

function finish(payload, code) {
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(code);
}

const argv = process.argv.slice(2);
const positional = [];
let fileOverride = null;
let json = false;
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === "--file") {
    fileOverride = argv[index + 1] ?? "";
    index += 1;
  } else if (argv[index] === "--json") {
    json = true;
  } else {
    positional.push(argv[index]);
  }
}
if (positional.length === 0) {
  finish({ ok: false, status: "fail", error: "usage", message: "用法: check-experience-ledger.mjs <target-root> [--file <project-relative-path>] [--json]" }, 2);
}
const targetRoot = path.resolve(positional[0]);

// --file 越界校验先于 manifest 判定：无论台账是否启用，越界路径一律拒绝。
let ledgerRelative = null;
if (fileOverride !== null) {
  const normalized = fileOverride.split("\\").join("/");
  const resolved = path.resolve(targetRoot, normalized);
  const rootResolved = path.resolve(targetRoot);
  const inside = resolved === rootResolved || resolved.startsWith(rootResolved + path.sep);
  if (path.isAbsolute(fileOverride) || normalized.split("/").includes("..") || !inside) {
    finish({ ok: false, status: "fail", error: "ledger-path-traversal", message: `台账路径越界：必须是项目内相对路径（project-relative），拒绝 traversal: ${fileOverride}` }, 2);
  }
  ledgerRelative = normalized;
}

const manifestPath = path.join(targetRoot, ".vibe-docs.json");
let governancePath = null;
if (fs.existsSync(manifestPath)) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
  } catch (error) {
    finish({ ok: false, status: "fail", error: "bad-manifest", message: `.vibe-docs.json 解析失败: ${error.message}` }, 2);
  }
  if (typeof manifest.experienceGovernance === "string" && manifest.experienceGovernance.trim() !== "") {
    governancePath = manifest.experienceGovernance;
  }
}
if (governancePath === null && ledgerRelative === null) {
  finish({ ok: true, status: "skipped", message: "未启用经验治理，跳过（skipped）" }, 0);
}

const relative = (ledgerRelative ?? String(governancePath)).split("\\").join("/").replace(/^\.\//, "");
const rootResolved = path.resolve(targetRoot);
const ledgerPath = path.resolve(rootResolved, relative);
if (!(ledgerPath === rootResolved || ledgerPath.startsWith(rootResolved + path.sep)) || ledgerPath === rootResolved) {
  finish({ ok: false, status: "fail", error: "ledger-path-traversal", message: `台账路径越界（project-relative traversal）: ${relative}` }, 2);
}
if (!fs.existsSync(ledgerPath)) {
  finish({ ok: false, status: "fail", error: "ledger-missing", message: `已启用经验治理但缺少台账文件（missing）: ${relative}` }, 2);
}

// 清扫日志绑定：与 init-target-runtime.readSweptExperienceIds 同口径。
const journalPath = path.resolve(rootResolved, relative.replace(/\.md$/iu, "") + "-清扫.md");
const sweptExperienceIds = new Set();
if (fs.existsSync(journalPath)) {
  for (const match of fs.readFileSync(journalPath, "utf8").matchAll(/^## (EXP-\d+) ·/gmu)) {
    sweptExperienceIds.add(match[1]);
  }
}
try {
  parseLedger(fs.readFileSync(ledgerPath, "utf8"), sweptExperienceIds);
} catch (error) {
  finish({ ok: false, status: "fail", error: "invalid-ledger", message: `台账校验失败: ${error.message}` }, 2);
}
finish({ ok: true, status: "pass", message: `台账校验通过: ${relative}` }, 0);
