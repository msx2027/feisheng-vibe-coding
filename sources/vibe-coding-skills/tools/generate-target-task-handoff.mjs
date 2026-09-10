#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertSafeTargetRoot } from "./safe-target-fs.mjs";
import { readTargetText } from "./target-doc-transaction.mjs";
import { loadTargetDocManifest } from "./target-doc-manifest-core.mjs";
import { assertContinuityManifest, generateContinuityHandoff, recoverContinuity } from "./target-task-continuity-core.mjs";

function parseArgs(argv) {
  const args = { root: "", mode: "dry-run", json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--dry-run" || item === "--write" || item === "--check") args.mode = item.slice(2);
    else if (item === "--json") args.json = true;
    else if (!item.startsWith("-") && !args.root) args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function main(args) {
  if (!args.root) throw new Error("target root is required");
  const root = path.resolve(args.root);
  assertSafeTargetRoot(root);
  recoverContinuity(root);
  const manifest = loadTargetDocManifest(root, { allowLegacy: false }).manifest;
  assertContinuityManifest(manifest);
  const manifestRaw = readTargetText(root, ".vibe-docs.json");
  return generateContinuityHandoff(root, manifest, manifestRaw, args.mode);
}

let args = { json: false };
try {
  args = parseArgs(process.argv.slice(2));
  const result = main(args);
  process.exitCode = result.ok ? 0 : 1;
  console.log(args.json ? JSON.stringify(result, null, 2) : `Task handoff ${args.mode}: ${result.ok ? "PASS" : "FAIL"}`);
} catch (error) {
  process.exitCode = error.exitCode || 2;
  const payload = { ok: false, error: error.message };
  if (args.json) console.log(JSON.stringify(payload, null, 2));
  else console.error(error.message);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  // 直接运行时已执行 main；保留入口形态供工具扫描。
}

