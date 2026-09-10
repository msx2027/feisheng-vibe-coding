#!/usr/bin/env node
// DocMap:
// Layer: L3 / experience ledger checker
// Module: tools
// Depends on: tools/experience-ledger-core.mjs, tools/safe-target-fs.mjs
// Syncs with: skills/experience-elevator/SKILL.md
//
// 作用（大白话）：给"经验治理台账"当体检器，只报告不修改（遵守半自动铁律）。
// 把 `经验治理.md` 的机器真源和人类正文对一遍账：
//   - 真源块缺失 / JSON 非法          → error（挂 CI）
//   - 经验字段缺失 / 档位非法 / count 非法 / id 重复 → error
//   - 正文投影与真源计数或档位对不上（投影撒谎）      → error
//   - 某条计数达当前档阀值还没升档                    → warning（正常待办，等用户拍板，不算错）
//
// 用法：
//   node tools/check-experience-ledger.mjs <目标项目根目录> [--file 经验治理.md] [--json]
//   （被测试直接调用 checkLedgerText 时不碰文件系统）

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  parseLedger,
  renderLedgerMarkdown,
} from "./experience-ledger-core.mjs";
import { inspectTargetFile } from "./safe-target-fs.mjs";

const DEFAULT_LEDGER_FILE = "docs/项目治理/经验治理.md";

// 纯函数：给一段台账原文体检，返回 { ok, errors, warnings }。不碰文件系统，便于测试。
export function checkLedgerText(markdown) {
  const errors = [];
  const warnings = [];

  let ledger;
  try {
    ledger = parseLedger(markdown);
  } catch (error) {
    errors.push(`真源解析失败：${error.message}`);
    return { ok: false, errors, warnings };
  }

  // 结构合法性只由 experience-ledger-core 的 parser/validator 判定；checker 不维护平行浅 schema。
  for (const exp of ledger.experiences) {
    if (exp.tier !== "L3" && exp.count >= ledger.thresholds[exp.tier]) {
      warnings.push(
        `${exp.id} 当前档 ${exp.tier} 计数已达阀值（${exp.count}/${ledger.thresholds[exp.tier]}），待用户拍板升档或删除`,
      );
    }
  }

  // 投影一致性：真源重渲后的正文，应与文件里的正文一致（投影不许撒谎）。
  // 只有在字段级无错时才比对，避免噪声。
  if (errors.length === 0) {
    const expected = renderLedgerMarkdown(ledger);
    if (normalize(expected) !== normalize(markdown)) {
      errors.push(
        "正文投影与真源不一致：正文里的计数/档位与顶部 json 真源对不上（也可能是顶部 json 真源缺 thresholds 等字段导致重渲差异），请用 experience-ledger-core 工具重渲投影",
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// 归一化：统一换行、去掉首尾空白，避免纯排版差异造成误判。
function normalize(text) {
  return text.replace(/\r\n/g, "\n").replace(/\s+$/g, "").trim();
}

// CLI 入口：读目标项目里的台账文件并体检。
function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1 && (args[fileIdx + 1] === undefined || args[fileIdx + 1].startsWith("--"))) {
    console.error("用法错误：--file 后必须跟台账文件名（如 --file 经验治理.md）");
    process.exit(2);
  }
  const explicitLedgerFile = fileIdx !== -1 ? args[fileIdx + 1] : "";
  const positional = args.filter((a, idx) => {
    if (a.startsWith("--")) return false;
    if (fileIdx !== -1 && idx === fileIdx + 1) return false;
    return true;
  });
  const targetRoot = positional[0];

  if (!targetRoot) {
    console.error("用法：node tools/check-experience-ledger.mjs <目标项目根目录> [--file 经验治理.md] [--json]");
    process.exit(2);
  }

  let manifest = null;
  try {
    const manifestState = inspectTargetFile(targetRoot, ".vibe-docs.json");
    if (manifestState.exists) {
      manifest = JSON.parse(fs.readFileSync(manifestState.path, "utf8").replace(/^\uFEFF/u, ""));
    }
  } catch (error) {
    const result = { ok: false, errors: [`manifest 读取失败：${error.message}`], warnings: [] };
    if (json) console.log(JSON.stringify(result, null, 2));
    else console.error(`ERROR ${result.errors[0]}`);
    process.exit(1);
  }

  const registeredDocument = Array.isArray(manifest?.documents)
    ? manifest.documents.find((item) => item?.role === "experienceGovernance")?.path
    : "";
  const mappedLedgerFile = typeof manifest?.experienceGovernance === "string"
    ? manifest.experienceGovernance
    : registeredDocument;
  const enabled = typeof mappedLedgerFile === "string" && mappedLedgerFile !== "";
  const ledgerFile = explicitLedgerFile || mappedLedgerFile || DEFAULT_LEDGER_FILE;

  let ledgerState;
  try {
    ledgerState = inspectTargetFile(targetRoot, ledgerFile);
  } catch (error) {
    const result = { ok: false, errors: [`台账路径非法：${error.message}`], warnings: [] };
    if (json) console.log(JSON.stringify(result, null, 2));
    else console.error(`ERROR ${result.errors[0]}`);
    process.exit(1);
  }
  if (!ledgerState.exists) {
    if (enabled) {
      const result = { ok: false, errors: [`经验治理已启用但缺少台账：${ledgerFile}`], warnings: [] };
      if (json) console.log(JSON.stringify(result, null, 2));
      else console.error(`ERROR ${result.errors[0]}`);
      process.exit(1);
    }
    const result = { ok: true, errors: [], warnings: [], skipped: `未启用 experienceGovernance，跳过 ${ledgerFile}` };
    if (json) console.log(JSON.stringify(result, null, 2));
    else console.log(`SKIP 未启用 experienceGovernance（${ledgerFile} 不存在）`);
    process.exit(0);
  }

  const markdown = fs.readFileSync(ledgerState.path, "utf8");
  const result = checkLedgerText(markdown);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const w of result.warnings) console.log(`WARN ${w}`);
    for (const e of result.errors) console.error(`ERROR ${e}`);
    console.log(result.ok ? `PASS ${ledgerFile} 台账体检通过` : `FAIL ${ledgerFile} 台账体检未通过`);
  }
  process.exit(result.ok ? 0 : 1);
}

// 仅在作为 CLI 直接运行时执行 main（被 import 时不跑）。
// 用 Node 官方 pathToFileURL 归一化，跨平台稳妥（Windows 反斜杠、盘符都能对上）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
