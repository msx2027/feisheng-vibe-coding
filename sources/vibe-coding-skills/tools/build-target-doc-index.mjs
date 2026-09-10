#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspectTargetFile } from "./safe-target-fs.mjs";
import { commitTargetTransaction } from "./target-doc-transaction.mjs";
import {
  finalizeDocumentIndex,
  metadataForDocument,
  parseMarkdownSections,
  renderTargetDocIndex,
} from "./target-doc-index-core.mjs";
import {
  DEFAULT_DOCUMENT_INDEX,
  collectDocumentEntries,
  loadTargetDocManifest,
  validateTargetDocManifest,
} from "./target-doc-manifest-core.mjs";

export { parseMarkdownSections, renderTargetDocIndex } from "./target-doc-index-core.mjs";

function parseArgs(argv) {
  const options = { root: process.cwd(), mode: null, json: false };
  let rootSeen = false;
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write" || arg === "--check") {
      const mode = arg.slice(2);
      if (options.mode && options.mode !== mode) throw new Error("choose exactly one of --check or --write");
      options.mode = mode;
    } else if (arg === "--json") options.json = true;
    else if (!arg.startsWith("--") && !rootSeen) {
      options.root = path.resolve(arg);
      rootSeen = true;
    } else throw new Error(`Unknown or duplicate argument: ${arg}`);
  }
  if (!options.mode) throw new Error("one of --check or --write is required");
  return options;
}

function readDocument(root, entry) {
  const state = inspectTargetFile(root, entry.path);
  if (!state.exists) return { ...entry, missing: true };
  const content = fs.readFileSync(state.path, "utf8");
  return {
    ...entry,
    ...metadataForDocument(entry.path, content),
  };
}

function sameMetadata(left, right) {
  return left.contentHash === right.contentHash
    && left.estimatedTokens === right.estimatedTokens
    && JSON.stringify(left.sections) === JSON.stringify(right.sections);
}

export function buildTargetDocIndex(rootInput) {
  const loaded = loadTargetDocManifest(rootInput, { allowLegacy: false });
  const { root, manifest } = loaded;
  const previousManifestContent = fs.readFileSync(loaded.path, "utf8");
  const currentEntries = collectDocumentEntries(manifest, { allowLegacy: false });
  const indexedEntries = [];
  const stale = [];
  const findings = [];

  for (const entry of currentEntries.filter((item) => item.role !== "documentIndex")) {
    const indexed = readDocument(root, entry);
    if (indexed.missing) {
      stale.push({ role: entry.role, path: entry.path, reason: "missing" });
      indexedEntries.push(entry);
      continue;
    }
    indexedEntries.push(indexed);
    if (!sameMetadata(entry, indexed)) stale.push({ role: entry.role, path: entry.path, reason: "metadata-stale" });
    if (indexed.estimatedTokens > 20000 && indexed.sections.length === 0) findings.push({ code: "index_required", role: indexed.role, path: indexed.path, tokens: indexed.estimatedTokens });
    if (indexed.estimatedTokens > 50000) findings.push({ code: "archive_required", role: indexed.role, path: indexed.path, tokens: indexed.estimatedTokens });
  }

  const metadataEntries = currentEntries.map((entry) => {
    if (entry.role === "documentIndex") return entry;
    return indexedEntries.find((candidate) => candidate.role === entry.role && candidate.path === entry.path) || entry;
  });
  const indexEntry = currentEntries.find((entry) => entry.role === "documentIndex");
  if (!indexEntry) throw new Error("documents[] must register documentIndex");
  const { documents, indexContent, indexPath } = finalizeDocumentIndex(metadataEntries, DEFAULT_DOCUMENT_INDEX);
  const indexedIndexEntry = documents.find((entry) => entry.role === "documentIndex");
  if (indexedIndexEntry.estimatedTokens > 5000) findings.push({ code: "index_budget_exceeded", role: "documentIndex", path: DEFAULT_DOCUMENT_INDEX, tokens: indexedIndexEntry.estimatedTokens });
  if (!sameMetadata(indexEntry, indexedIndexEntry)) stale.push({ role: "documentIndex", path: DEFAULT_DOCUMENT_INDEX, reason: "metadata-stale" });

  let currentIndexContent = null;
  const indexState = inspectTargetFile(root, indexPath);
  if (indexState.exists) currentIndexContent = fs.readFileSync(indexState.path, "utf8").replace(/^\uFEFF/u, "");
  if (currentIndexContent !== indexContent && !stale.some((entry) => entry.role === "documentIndex" && entry.reason === "content-stale")) {
    stale.push({ role: "documentIndex", path: indexPath, reason: indexState.exists ? "content-stale" : "missing" });
  }

  const nextManifest = { ...manifest, documentIndex: indexPath, documents };
  const validation = validateTargetDocManifest(nextManifest);
  if (!validation.ok) throw new Error(`generated manifest is invalid: ${validation.issues.map((issue) => issue.message).join("; ")}`);
  return {
    root,
    manifestPath: loaded.path,
    manifest,
    previousManifestContent,
    nextManifest,
    previousIndexContent: indexState.exists ? fs.readFileSync(indexState.path, "utf8") : null,
    indexContent,
    stale,
    findings,
    changed: stale.length > 0,
  };
}

export function applyTargetDocIndexPlan(plan) {
  if (!plan.changed) return { changed: [] };
  return commitTargetTransaction(plan.root, {
    journalPath: ".vibe-doc-index.json",
    kind: "target-doc-index",
    operations: [
      { file: plan.nextManifest.documentIndex, content: plan.indexContent, expectedContent: plan.previousIndexContent },
      { file: ".vibe-docs.json", content: JSON.stringify(plan.nextManifest, null, 2) + "\n", expectedContent: plan.previousManifestContent },
    ],
  });
}

function emit(payload, json) {
  if (json) process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  else {
    console.log("Target document index");
    console.log(`Root: ${payload.root}`);
    console.log(`Changed: ${payload.changed ? "yes" : "no"}`);
    for (const item of payload.stale) console.log(`- [STALE] ${item.role}: ${item.path} (${item.reason})`);
    for (const item of payload.findings) console.log(`- [FAIL] ${item.code}: ${item.role} ${item.path} (~${item.tokens})`);
    console.log(`Result: ${payload.ok ? "PASS" : "FAIL"}`);
  }
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv);
    const plan = buildTargetDocIndex(options.root);
    if (plan.findings.length > 0 || plan.stale.some((item) => item.reason === "missing" && item.role !== "documentIndex")) {
      emit({ ...plan, ok: false, nextManifest: undefined, manifest: undefined, indexContent: undefined, previousIndexContent: undefined }, options.json);
      process.exitCode = 1;
      return;
    }
    if (options.mode === "write" && plan.changed) {
      applyTargetDocIndexPlan(plan);
    }
    const stale = options.mode === "write" ? [] : plan.stale;
    const ok = stale.length === 0;
    emit({ root: plan.root, mode: options.mode, changed: plan.changed, stale, findings: [], ok }, options.json);
    if (!ok) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options?.json) process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 2) + "\n");
    else console.error(message);
    process.exitCode = error?.code === "TARGET_DOC_MANIFEST_INVALID" ? 2 : 2;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
