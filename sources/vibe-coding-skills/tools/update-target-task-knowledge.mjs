#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertSafeTargetRoot } from "./safe-target-fs.mjs";
import { readTargetText } from "./target-doc-transaction.mjs";
import { loadTargetDocManifest } from "./target-doc-manifest-core.mjs";
import {
  assertContinuityManifest,
  recoverContinuity,
  updateContinuityKnowledge,
} from "./target-task-continuity-core.mjs";

function parseArgs(argv) {
  const args = {
    root: "",
    category: "",
    id: "",
    kind: "",
    statement: "",
    evidenceJson: "[]",
    expectedRevision: "",
    write: false,
    json: false,
  };
  const values = new Map([
    ["--category", "category"], ["--id", "id"], ["--kind", "kind"],
    ["--statement", "statement"], ["--evidence-json", "evidenceJson"], ["--expected-revision", "expectedRevision"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (values.has(item)) args[values.get(item)] = argv[++index] ?? "";
    else if (item === "--write") args.write = true;
    else if (item === "--json") args.json = true;
    else if (!item.startsWith("-") && !args.root) args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function main(args) {
  if (!args.root || !args.category || !args.id || !args.kind || !args.statement) throw new Error("root, category, id, kind and statement are required");
  if (!args.write) throw new Error("--write is required; knowledge updates are never implicit");
  const root = path.resolve(args.root);
  assertSafeTargetRoot(root);
  recoverContinuity(root);
  const loaded = loadTargetDocManifest(root, { allowLegacy: false });
  const manifestRaw = readTargetText(root, ".vibe-docs.json");
  assertContinuityManifest(loaded.manifest);
  let evidence;
  try {
    evidence = JSON.parse(args.evidenceJson);
  } catch (error) {
    throw new Error(`--evidence-json invalid JSON: ${error.message}`);
  }
  const result = updateContinuityKnowledge(root, loaded.manifest, manifestRaw, args, evidence);
  return { ok: true, revision: result.revision, changed: result.changed };
}

let args = { json: false };
try {
  args = parseArgs(process.argv.slice(2));
  const result = main(args);
  process.exitCode = 0;
  console.log(args.json ? JSON.stringify(result, null, 2) : `Task knowledge updated: ${result.revision}`);
} catch (error) {
  process.exitCode = error.exitCode || 2;
  const payload = { ok: false, error: error.message };
  if (args.json) console.log(JSON.stringify(payload, null, 2));
  else console.error(error.message);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  // 入口逻辑已在模块加载时执行；此条件仅保持与其他 tools 的直接运行约定一致。
}

