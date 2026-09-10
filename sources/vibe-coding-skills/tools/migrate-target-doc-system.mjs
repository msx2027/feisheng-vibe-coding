#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { assertSafeTargetRoot } from "./safe-target-fs.mjs";
import { commitTargetTransaction, readTargetText, recoverTargetTransaction } from "./target-doc-transaction.mjs";
import { validateTargetDocManifest } from "./target-doc-manifest-core.mjs";
import {
  addSectionMarkers,
  cleanupCandidates,
  discoverLegacyDocuments,
  enrichDocuments,
  listTaskCapsules,
  normalizeLoadPolicy,
  normalizeCurrentTaskState,
  renderDocumentIndex,
  stateConflict,
} from "./target-doc-migration-helpers.mjs";

const JOURNAL = ".vibe-doc-migration.json";
const MAX_REPORT_ITEMS = 100;

function usage() {
  console.error("Usage: node tools/migrate-target-doc-system.mjs <root> [--write|--recover] [--json]");
}

function parseArgs(argv) {
  const args = { root: "", mode: "dry-run", json: false, help: false };
  for (const item of argv) {
    if (item === "--write" || item === "--recover") {
      if (args.mode !== "dry-run") throw new Error("Use only one of --write or --recover");
      args.mode = item.slice(2);
    } else if (item === "--json") args.json = true;
    else if (item === "-h" || item === "--help") args.help = true;
    else if (!item.startsWith("-") && !args.root) args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function parseManifest(raw) {
  if (raw === null) throw Object.assign(new Error(".vibe-docs.json is required; migration never creates a partial manifest"), { exitCode: 2 });
  try {
    const value = JSON.parse(raw.replace(/^\uFEFF/u, ""));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("root must be an object");
    return value;
  } catch (error) {
    throw Object.assign(new Error(`invalid .vibe-docs.json: ${error.message}`), { exitCode: 2 });
  }
}

function taskDocuments(root, manifest, documents) {
  const paths = new Set(documents.map((doc) => doc.path));
  const current = manifest.taskContext?.currentTaskCapsule || "";
  for (const capsule of listTaskCapsules(root, manifest).sort()) {
    const statePath = `${capsule}/任务状态.json`;
    if (readTargetText(root, statePath) === null || paths.has(statePath)) continue;
    const isCurrent = capsule === current;
    documents.push({
      role: isCurrent ? "taskState" : "historicalTaskCapsules",
      path: statePath,
      owner: "update-target-task-state",
      authority: isCurrent ? "source" : "archive",
      dependsOn: [],
    });
    paths.add(statePath);
  }
  const historical = documents.filter((doc) => doc.role === "historicalTaskCapsules").map((doc) => doc.path);
  if (historical.length) manifest.historicalTaskCapsules = historical;
  return documents;
}

function buildPlan(root, manifestRaw) {
  const manifest = parseManifest(manifestRaw);
  const conflict = stateConflict(root, manifest);
  if (conflict) throw Object.assign(new Error(`legacy state conflict: ${conflict}`), { exitCode: 1 });
  const sourceDocuments = taskDocuments(root, manifest, discoverLegacyDocuments(root, manifest));
  const overrides = new Map();
  const normalizedState = normalizeCurrentTaskState(root, manifest);
  if (normalizedState) {
    overrides.set(normalizedState.file, normalizedState.content);
    const cursorPath = manifest.currentExecution || "plans/执行光标.md";
    overrides.set(cursorPath, normalizedState.cursor);
    manifest.currentExecution = cursorPath;
    if (!sourceDocuments.some((doc) => doc.path === cursorPath)) {
      sourceDocuments.push({ role: "currentExecution", path: cursorPath, owner: "update-target-task-state", authority: "projection", dependsOn: ["taskState"] });
    }
  }
  for (const doc of sourceDocuments) {
    if (doc.role === "documentIndex" || doc.authority !== "source" || !doc.path.endsWith(".md")) continue;
    const current = readTargetText(root, doc.path);
    if (current !== null) overrides.set(doc.path, addSectionMarkers(current, doc.role));
  }
  let documents = enrichDocuments(root, sourceDocuments, overrides);
  const indexPath = manifest.documentIndex || "文档索引.md";
  const indexContent = renderDocumentIndex(documents);
  overrides.set(indexPath, indexContent);
  documents = enrichDocuments(root, documents, overrides);
  const nextManifest = {
    ...manifest,
    schemaVersion: 2,
    documentIndex: indexPath,
    documents,
  };
  nextManifest.loadPolicy = normalizeLoadPolicy(nextManifest, documents);
  const validation = validateTargetDocManifest(nextManifest);
  if (!validation.ok) {
    const detail = validation.issues.slice(0, 20).map((issue) => `${issue.code} at ${issue.at}: ${issue.message}`).join("; ");
    throw Object.assign(new Error(`migration would produce an invalid manifest: ${detail}`), { exitCode: 1 });
  }
  const nextManifestRaw = `${JSON.stringify(nextManifest, null, 2)}\n`;
  const operations = [];
  for (const [file, content] of overrides) {
    const before = readTargetText(root, file);
    if (before !== content) operations.push({ file, content, expectedContent: before });
  }
  if (nextManifestRaw !== manifestRaw) operations.push({ file: ".vibe-docs.json", content: nextManifestRaw, expectedContent: manifestRaw });
  return {
    operations,
    cleanupCandidates: cleanupCandidates(root, documents),
    conflicts: [],
    documents: documents.length,
  };
}

function execute(args) {
  if (!args.root || args.help) { usage(); return { exitCode: args.help ? 0 : 2 }; }
  const root = path.resolve(args.root);
  assertSafeTargetRoot(root);
  if (args.mode === "recover") {
    const recovered = recoverTargetTransaction(root, JOURNAL);
    return { exitCode: 0, payload: { ok: true, mode: "recover", ...recovered } };
  }
  if (readTargetText(root, JOURNAL) !== null) {
    throw Object.assign(new Error(`unfinished migration exists; run --recover first: ${JOURNAL}`), { exitCode: 1 });
  }
  const manifestRaw = readTargetText(root, ".vibe-docs.json");
  const plan = buildPlan(root, manifestRaw);
  const plannedFiles = plan.operations.map((item) => item.file);
  let changed = [];
  if (args.mode === "write" && plan.operations.length > 0) {
    changed = commitTargetTransaction(root, { journalPath: JOURNAL, kind: "target-doc-migration", operations: plan.operations }).changed;
  }
  return {
    exitCode: 0,
    payload: {
      ok: true,
      mode: args.mode,
      migrationRequired: plan.operations.length > 0,
      documents: plan.documents,
      plannedCount: plannedFiles.length,
      plannedFiles: plannedFiles.slice(0, MAX_REPORT_ITEMS),
      truncated: plannedFiles.length > MAX_REPORT_ITEMS,
      cleanupCandidates: plan.cleanupCandidates.slice(0, MAX_REPORT_ITEMS),
      changed,
    },
  };
}

let args = { json: false };
try {
  args = parseArgs(process.argv.slice(2));
  const result = execute(args);
  process.exitCode = result.exitCode;
  if (result.payload) console.log(args.json ? JSON.stringify(result.payload, null, 2) : `Migration ${result.payload.mode}: ${result.payload.plannedCount ?? 0} planned`);
} catch (error) {
  process.exitCode = error.exitCode || (error.code === "UNSAFE_TARGET_PATH" ? 2 : 2);
  const payload = { ok: false, mode: args.mode, error: error.message };
  if (args.json) console.log(JSON.stringify(payload, null, 2));
  else console.error(error.message);
}
