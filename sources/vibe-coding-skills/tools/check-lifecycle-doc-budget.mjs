#!/usr/bin/env node
// DocMap:
// Layer: L3 / target-project lifecycle doc budget checker
// Module: tools
// Depends on: target-doc-manifest-core.mjs, safe-target-fs.mjs

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspectTargetDirectory, inspectTargetFile } from "./safe-target-fs.mjs";
import { collectDocumentEntries, estimateTokens, hashContent, loadTargetDocManifest } from "./target-doc-manifest-core.mjs";

const DEFAULT_DOC_LIMIT = 20000;
const DEFAULT_ALWAYS_LIMIT = 12000;
const DEFAULT_ARCHIVE_LIMIT = 50000;

function parsePositiveInteger(value, flag) {
  if (typeof value !== "string" || !/^\d+$/u.test(value) || Number(value) <= 0 || !Number.isSafeInteger(Number(value))) throw new Error(`${flag} must be a positive integer`);
  return Number(value);
}

function parseArgs(argv) {
  const options = { root: process.cwd(), docLimit: DEFAULT_DOC_LIMIT, alwaysLimit: DEFAULT_ALWAYS_LIMIT, strict: false, json: false };
  let rootSeen = false;
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict") options.strict = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--doc-limit") options.docLimit = parsePositiveInteger(argv[++index], arg);
    else if (arg === "--always-limit") options.alwaysLimit = parsePositiveInteger(argv[++index], arg);
    else if (!arg.startsWith("--") && !rootSeen) {
      options.root = path.resolve(arg);
      rootSeen = true;
    } else throw new Error(`Unknown or duplicate argument: ${arg}`);
  }
  return options;
}

function addFinding(findings, code, message, entry = {}) {
  findings.push({ code, message, ...entry });
}

function inspectBudgetFile(root, entry, policy, findings) {
  const state = inspectTargetFile(root, entry.path);
  if (!state.exists) {
    addFinding(findings, "missing_document", `file is missing: ${entry.path}`, { role: entry.role, path: entry.path });
    return { key: entry.role, role: entry.role, relPath: entry.path, tokens: 0, policy, status: "missing" };
  }
  const content = fs.readFileSync(state.path, "utf8").replace(/^\uFEFF/u, "");
  const tokens = estimateTokens(content);
  const actualHash = hashContent(content);
  const indexed = entry.sections?.length > 0 && entry.contentHash === actualHash;
  if (tokens > DEFAULT_ARCHIVE_LIMIT) addFinding(findings, "archive_required", `${entry.path} is ~${tokens} tokens and must be archived`, { role: entry.role, path: entry.path, tokens });
  if (tokens > DEFAULT_DOC_LIMIT && !indexed) addFinding(findings, "index_required", `${entry.path} is ~${tokens} tokens without a fresh section index`, { role: entry.role, path: entry.path, tokens });
  if (entry.contentHash && !/^sha256:0{64}$/u.test(entry.contentHash) && entry.contentHash !== actualHash) addFinding(findings, "stale_metadata", `content hash is stale: ${entry.path}`, { role: entry.role, path: entry.path });
  return { key: entry.role, role: entry.role, relPath: entry.path, tokens, policy, status: "ok", indexed };
}

function capsuleEntries(root, manifest, findings) {
  const taskContext = manifest.taskContext;
  if (!taskContext?.enabled || typeof taskContext.currentTaskCapsule !== "string" || taskContext.currentTaskCapsule === "") return [];
  const directory = inspectTargetDirectory(root, taskContext.currentTaskCapsule);
  if (!directory.exists) {
    addFinding(findings, "missing_task_capsule", `current task capsule is missing: ${taskContext.currentTaskCapsule}`, { role: "taskCapsule", path: taskContext.currentTaskCapsule });
    return [];
  }
  const names = [
    ["taskState", "任务状态.json"],
    ["implementationContext", "实现上下文.jsonl"],
    ["acceptanceContext", "验收上下文.jsonl"],
    ["taskRequirements", "需求摘录.md"],
    ["taskPlan", "实现计划.md"],
    ["taskResearch", "研究记录.md"],
  ];
  const entries = [];
  for (const [role, name] of names) {
    const relPath = `${directory.relative}/${name}`;
    const state = inspectTargetFile(root, relPath);
    if (!state.exists) continue;
    const content = fs.readFileSync(state.path, "utf8").replace(/^\uFEFF/u, "");
    if (/Context$/u.test(role) && content.trim() === "") addFinding(findings, "empty_context_manifest", `${relPath} must not be empty`, { role, path: relPath });
    entries.push({ key: role, role, relPath, tokens: estimateTokens(content), policy: "onDemand", status: "ok" });
  }
  return entries;
}

function sessionEntry(root, manifest, findings) {
  const journal = manifest.taskContext?.sessionJournal;
  if (!manifest.taskContext?.enabled || typeof journal !== "string" || journal === "") return [];
  const state = inspectTargetFile(root, journal);
  if (!state.exists) return [];
  const content = fs.readFileSync(state.path, "utf8").replace(/^\uFEFF/u, "");
  if (content.trim() === "") addFinding(findings, "empty_session_log", `${journal} must not be empty`, { role: "sessionJournal", path: journal });
  return [{ key: "sessionJournal", role: "sessionJournal", relPath: journal, tokens: estimateTokens(content), policy: "onDemand", status: "ok" }];
}

export function evaluateLifecycleDocBudget(rootInput, options = {}) {
  const loaded = loadTargetDocManifest(rootInput, { allowLegacy: true });
  const { root, manifest, migrationRequired } = loaded;
  const docLimit = options.docLimit || DEFAULT_DOC_LIMIT;
  const alwaysLimit = options.alwaysLimit || DEFAULT_ALWAYS_LIMIT;
  const loadPolicy = manifest.loadPolicy && typeof manifest.loadPolicy === "object" ? manifest.loadPolicy : null;
  const always = new Set(Array.isArray(loadPolicy?.always) ? loadPolicy.always : []);
  const never = new Set(Array.isArray(loadPolicy?.never) ? loadPolicy.never : []);
  const findings = [];
  if (migrationRequired) addFinding(findings, "migration_required", "legacy manifest requires explicit v2 migration");
  if (!loadPolicy) addFinding(findings, "missing_load_policy", "legacy manifest has no loadPolicy");
  const results = [];
  for (const entry of collectDocumentEntries(manifest, { allowLegacy: true })) {
    const policy = !loadPolicy ? "no-policy" : always.has(entry.role) ? "always" : never.has(entry.role) ? "never" : "onDemand";
    results.push(inspectBudgetFile(root, entry, policy, findings));
  }
  if (typeof manifest.externalStandaloneGameFolder === "string") {
    results.push({ key: "externalStandaloneGameFolder", relPath: manifest.externalStandaloneGameFolder, tokens: 0, policy: "onDemand", status: "external" });
  }
  const seenResults = new Set(results.map((entry) => `${entry.role}\0${entry.relPath}`));
  for (const entry of [...capsuleEntries(root, manifest, findings), ...sessionEntry(root, manifest, findings)]) {
    const key = `${entry.role}\0${entry.relPath}`;
    if (seenResults.has(key)) continue;
    seenResults.add(key);
    results.push(entry);
  }
  const alwaysTotal = results.filter((entry) => entry.policy === "always" && entry.status === "ok").reduce((sum, entry) => sum + entry.tokens, 0);
  if (alwaysTotal > alwaysLimit) addFinding(findings, "always_budget_exceeded", `always roles total ~${alwaysTotal} tokens; limit is ${alwaysLimit}`, { tokens: alwaysTotal });
  const indexResult = results.find((entry) => entry.role === "documentIndex" && entry.status === "ok");
  if (indexResult?.tokens > 5000) addFinding(findings, "index_budget_exceeded", `documentIndex is ~${indexResult.tokens} tokens; limit is 5000`, { role: "documentIndex", path: indexResult.relPath, tokens: indexResult.tokens });
  for (const result of results) {
    if (result.policy === "always" && result.tokens > docLimit) addFinding(findings, "always_document_too_large", `${result.relPath} exceeds the always document limit ${docLimit}`, { role: result.role, path: result.relPath, tokens: result.tokens });
  }
  return {
    targetRoot: root,
    migrationRequired,
    findings,
    warnings: findings.map((finding) => finding.message),
    results,
    alwaysTotal,
    limits: { document: docLimit, always: alwaysLimit, archive: DEFAULT_ARCHIVE_LIMIT, documentIndex: 5000 },
    ok: findings.length === 0,
  };
}

function emit(payload, json) {
  if (json) process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  else {
    console.log("Lifecycle doc budget diagnostic");
    console.log(`Root: ${payload.targetRoot}`);
    for (const entry of payload.results) console.log(`- [${entry.status === "ok" ? "OK" : "WARN"}] ${entry.role}: ${entry.relPath} ~${entry.tokens} [${entry.policy}]`);
    console.log(`Always-set total: ~${payload.alwaysTotal} / ${payload.limits.always}`);
    for (const finding of payload.findings) console.log(`- [FAIL] ${finding.code}: ${finding.message}`);
    console.log(`Result: ${payload.ok ? "PASS" : "FAIL"}`);
  }
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv);
    const payload = evaluateLifecycleDocBudget(options.root, options);
    emit(payload, options.json);
    if (options.strict && !payload.ok) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options?.json) process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 2) + "\n");
    console.error(message);
    process.exitCode = 2;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
