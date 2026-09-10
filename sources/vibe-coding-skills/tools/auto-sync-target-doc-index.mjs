#!/usr/bin/env node
// vibe-coding-skills:managed-target-doc-sync-tool

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { applyTargetDocIndexPlan, buildTargetDocIndex } from "./build-target-doc-index.mjs";
import { collectDocumentEntries, loadTargetDocManifest } from "./target-doc-manifest-core.mjs";

function parseArgs(argv) {
  const options = { root: "", file: "", hookInput: false, hookInputBase64: "", json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--file") options.file = argv[++index] || "";
    else if (arg === "--hook-input") options.hookInput = true;
    else if (arg === "--hook-input-base64") { options.hookInput = true; options.hookInputBase64 = argv[++index] || ""; }
    else if (arg === "--json") options.json = true;
    else if (!arg.startsWith("-") && !options.root) options.root = arg;
    else throw new Error(`Unknown or duplicate argument: ${arg}`);
  }
  if (!options.root && !options.hookInput) throw new Error("target root is required");
  return options;
}

function parseHookPayload(rawInput) {
  const raw = String(rawInput).replace(/^\uFEFF/u, "");
  if (!raw.trim()) throw new Error("hook input is required");
  const payload = JSON.parse(raw);
  return {
    cwd: String(payload?.cwd || ""),
    file: String(payload?.tool_input?.file_path || payload?.tool_input?.path || ""),
  };
}

function readHookPayload(options) {
  if (options.hookInputBase64) return parseHookPayload(Buffer.from(options.hookInputBase64, "base64").toString("utf8"));
  return parseHookPayload(fs.readFileSync(0, "utf8"));
}

function findTargetRoot(startInput) {
  let current = path.resolve(startInput || process.cwd());
  if (fs.existsSync(current) && fs.statSync(current).isFile()) current = path.dirname(current);
  while (true) {
    if (fs.existsSync(path.join(current, ".vibe-docs.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return "";
    current = parent;
  }
}

function projectRelativePath(root, candidate) {
  const absolute = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return relative === "" ? "" : null;
  return relative.replaceAll("\\", "/");
}

export function syncTargetDocIndex(rootInput, fileInput) {
  const root = path.resolve(rootInput);
  const manifestPath = path.join(root, ".vibe-docs.json");
  if (!fs.existsSync(manifestPath)) return { root, changed: false, skipped: true, reason: "manifest-missing" };
  const relative = projectRelativePath(root, fileInput);
  if (relative === null) throw new Error("edited file is outside target root");
  const loaded = loadTargetDocManifest(root, { allowLegacy: false });
  const registered = new Set(collectDocumentEntries(loaded.manifest, { allowLegacy: false }).map((entry) => entry.path));
  if (!registered.has(relative)) {
    return { root, file: relative, changed: false, skipped: true, reason: "unregistered-file" };
  }
  const plan = buildTargetDocIndex(root);
  if (plan.findings.length > 0) throw new Error(`target document index findings: ${plan.findings.map((item) => item.code).join(", ")}`);
  const missing = plan.stale.filter((item) => item.reason === "missing" && item.role !== "documentIndex");
  if (missing.length > 0) throw new Error(`registered document is missing: ${missing.map((item) => item.path).join(", ")}`);
  const applied = applyTargetDocIndexPlan(plan);
  return { root, file: relative, changed: applied.changed.length > 0, skipped: false, files: applied.changed };
}

function main() {
  let options = { json: false };
  try {
    options = parseArgs(process.argv.slice(2));
    const hook = options.hookInput ? readHookPayload(options) : null;
    const file = hook ? hook.file : options.file;
    if (!file) throw new Error("edited file path is required");
    const root = options.root || findTargetRoot(file) || findTargetRoot(hook?.cwd);
    if (!root) throw new Error("target manifest root was not found");
    const result = syncTargetDocIndex(root, file);
    console.log(options.json ? JSON.stringify({ ok: true, ...result }, null, 2) : `Target document auto-sync: ${result.changed ? "UPDATED" : "SKIPPED"}`);
  } catch (error) {
    const payload = { ok: false, error: error.message };
    if (options.json) console.log(JSON.stringify(payload, null, 2));
    else console.error(`[target-doc-auto-sync] blocked: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
