#!/usr/bin/env node
import process from "node:process";
import { scanHotspots } from "./hotspot-scan.mjs";

function usage() {
  console.log(`Usage:
  node tools/check-hotspots.mjs <root> [--json] [--strict] [--staged]

Default mode reports hotspot warnings and exits 0.
--strict exits 1 when blocker candidates are found.
--strict --staged enforces 300-line production files, 800-line test files,
100-line functions and 180-line React components with a no-growth legacy ratchet.`);
}

function parseArgs(argv) {
  const args = { root: ".", json: false, strict: false, staged: false };
  for (const item of argv) {
    if (item === "--json") args.json = true;
    else if (item === "--strict") args.strict = true;
    else if (item === "--staged") args.staged = true;
    else if (item === "-h" || item === "--help") args.help = true;
    else if (!item.startsWith("-") && args.root === ".") args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function printText(report, strict) {
  console.log(`Hotspot check: root=${report.root} mode=${report.mode}`);
  console.log(`Scanned ${report.summary.scannedFiles} files; findings=${report.summary.totalFindings}, blockers=${report.summary.blockers}, hotspots=${report.summary.hotspots}, warnings=${report.summary.warnings}`);
  for (const item of report.findings) {
    console.log(`[${item.severity.toUpperCase().padEnd(7)}] ${item.message}`);
    if (item.file) console.log(`  file: ${item.file}`);
    if (item.files) console.log(`  files: ${item.files.join(", ")}`);
    if (item.scopes) console.log(`  scopes: ${item.scopes.join(", ")}`);
    if (item.categories) console.log(`  categories: ${item.categories.join(", ")}`);
  }
  if (strict && report.summary.blockers > 0) process.exitCode = 1;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage();
  else {
    const report = scanHotspots(args.root, args);
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else printText(report, args.strict);
    if (args.strict && report.summary.blockers > 0) process.exitCode = 1;
    // 「扫描器看不懂」与普通超标不同：普通 blocker 是看懂了确实超标，报告模式下只提示；
    // 看不懂意味着这片代码根本没被体检，任何模式下都不能报绿，否则又是失败即开放。
    if (report.findings.some((item) => item.kind === "unrecognized-function")) process.exitCode = 2;
  }
} catch (error) {
  if (process.argv.includes("--json")) console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  else console.error(`[FAIL] ${error.message}`);
  process.exitCode = error.exitCode || 2;
}
