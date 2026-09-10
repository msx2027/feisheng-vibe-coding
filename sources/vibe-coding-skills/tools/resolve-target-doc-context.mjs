#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertSafeTargetRoot, inspectTargetDirectory, inspectTargetFile } from "./safe-target-fs.mjs";
import { collectDocumentEntries, estimateTokens, hashContent, loadTargetDocManifest, validateProjectRelativePath } from "./target-doc-manifest-core.mjs";
import { isMarkdownArchivePath, parseMarkdownFacade, resolveLinkedMarkdownDetail, resolveMarkdownGovernance } from "./markdown-governance-core.mjs";
import { recoverContinuity, resolveContinuityContext } from "./target-task-continuity-core.mjs";

const DEFAULT_BUDGET = 20000;
const MAX_AUDIT_BATCH = 50000;
const SELECTOR_KINDS = new Set(["section", "lines", "jsonPointer", "wholeFile"]);

function positiveInteger(value, flag) {
  if (typeof value !== "string" || !/^\d+$/u.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) throw new Error(`${flag} must be a positive integer`);
  return Number(value);
}

function parseDocumentReference(value) {
  const raw = String(value || "");
  const separator = raw.indexOf(":");
  if (separator < 1 || separator === raw.length - 1) throw new Error("--document must be <role>:<project-relative-file>");
  return { role: raw.slice(0, separator), path: raw.slice(separator + 1) };
}

function parseMarkdownPath(value) {
  const candidate = String(value || "").replaceAll("\\", "/");
  const issue = validateProjectRelativePath(candidate, "--markdown");
  if (issue || !candidate.endsWith(".md")) throw new Error("--markdown must be a project-relative Markdown file");
  return candidate;
}

function parseArgs(argv) {
  const options = { root: process.cwd(), roles: [], documents: [], markdown: [], capsule: "", budget: DEFAULT_BUDGET, allowNever: false, allowMarkdownArchive: false, reason: "", json: false };
  let rootSeen = false;
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--roles") options.roles.push(...String(argv[++index] || "").split(",").map((role) => role.trim()).filter(Boolean));
    else if (arg === "--document") options.documents.push(parseDocumentReference(argv[++index]));
    else if (arg === "--markdown") options.markdown.push(parseMarkdownPath(argv[++index]));
    else if (arg === "--capsule") options.capsule = argv[++index] || "";
    else if (arg === "--budget") options.budget = positiveInteger(argv[++index], arg);
    else if (arg === "--allow-never") options.allowNever = true;
    else if (arg === "--allow-markdown-archive") options.allowMarkdownArchive = true;
    else if (arg === "--reason") options.reason = argv[++index] || "";
    else if (arg === "--json") options.json = true;
    else if (!arg.startsWith("--") && !rootSeen) {
      options.root = path.resolve(arg);
      rootSeen = true;
    } else throw new Error(`Unknown or duplicate argument: ${arg}`);
  }
  if ((options.allowNever || options.allowMarkdownArchive) && options.reason.trim() === "") throw new Error("--allow-never and --allow-markdown-archive require --reason");
  if (options.budget > MAX_AUDIT_BATCH) throw new Error(`--budget may not exceed ${MAX_AUDIT_BATCH}; split full audits into batches`);
  return options;
}

function readJsonl(root, relativePath) {
  const state = inspectTargetFile(root, relativePath);
  if (!state.exists) return [];
  const content = fs.readFileSync(state.path, "utf8").replace(/^\uFEFF/u, "");
  const lines = content.split(/\r?\n/gu).filter((line) => line.trim() !== "");
  if (lines.length === 0) throw new Error(`capsule JSONL must not be empty: ${relativePath}`);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (cause) {
      throw new Error(`invalid JSONL at ${relativePath}:${index + 1}: ${cause.message}`);
    }
  });
}

function loadCapsuleRecords(root, capsulePath) {
  if (!capsulePath) return [];
  if (/\.jsonl$/iu.test(capsulePath)) return readJsonl(root, capsulePath);
  const directory = inspectTargetDirectory(root, capsulePath);
  if (!directory.exists) throw new Error(`capsule directory is missing: ${capsulePath}`);
  const normalized = directory.relative;
  const records = [
    ...readJsonl(root, `${normalized}/实现上下文.jsonl`),
    ...readJsonl(root, `${normalized}/验收上下文.jsonl`),
  ];
  if (records.length === 0) throw new Error(`capsule has no context JSONL records: ${capsulePath}`);
  return records;
}

function validateCapsuleRecord(record, index, entries) {
  const label = `capsule record ${index + 1}`;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`${label} must be an object`);
  for (const key of ["role", "file", "reason", "source", "sourceRevision"]) if (typeof record[key] !== "string" || record[key].trim() === "") throw new Error(`${label}.${key} must be a non-empty string`);
  if (record.required !== true && record.required !== false) throw new Error(`${label}.required must be boolean`);
  if (!Number.isInteger(record.maxTokens) || record.maxTokens < 1) throw new Error(`${label}.maxTokens must be a positive integer`);
  if (!record.selector || typeof record.selector !== "object" || Array.isArray(record.selector) || !SELECTOR_KINDS.has(record.selector.kind)) throw new Error(`${label}.selector.kind must be section, lines, jsonPointer, or wholeFile`);
  const matches = entries.filter((entry) => entry.role === record.role && entry.path === record.file);
  if (matches.length !== 1) throw new Error(`${label} must reference exactly one registered role/path pair`);
  const selector = record.selector;
  if (selector.kind === "section" && (typeof selector.id !== "string" || selector.id === "")) throw new Error(`${label}.selector.id is required`);
  if (selector.kind === "lines" && (!Number.isInteger(selector.startLine) || !Number.isInteger(selector.endLine) || selector.startLine < 1 || selector.endLine < selector.startLine)) throw new Error(`${label}.selector line range is invalid`);
  if (selector.kind === "jsonPointer" && (typeof selector.pointer !== "string" || !selector.pointer.startsWith("/"))) throw new Error(`${label}.selector.pointer must be a JSON Pointer`);
  return matches[0];
}

function readEntryContent(root, entry) {
  const state = inspectTargetFile(root, entry.path);
  if (!state.exists) return null;
  const content = fs.readFileSync(state.path, "utf8").replace(/^\uFEFF/u, "");
  return { content, contentHash: hashContent(content), tokens: estimateTokens(content) };
}

function jsonPointerValue(content, pointer) {
  let current = JSON.parse(content);
  for (const raw of pointer.slice(1).split("/")) {
    const segment = raw.replace(/~1/gu, "/").replace(/~0/gu, "~");
    if (current === null || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, segment)) throw new Error(`JSON Pointer does not exist: ${pointer}`);
    current = current[segment];
  }
  return current;
}

function selectedRange(entry, record, contentState) {
  const selector = record.selector;
  if (selector.kind === "section") {
    const section = entry.sections.find((item) => item.id === selector.id);
    if (!section) return { stale: "section-not-indexed" };
    const lines = contentState.content.replace(/\r\n?/gu, "\n").split("\n");
    const actualHash = hashContent(lines.slice(section.startLine - 1, section.endLine).join("\n"));
    if (actualHash !== section.hash) return { stale: "section-hash-mismatch" };
    return { selector, startLine: section.startLine, endLine: section.endLine, tokens: section.tokens };
  }
  if (selector.kind === "lines") {
    const lines = contentState.content.replace(/\r\n?/gu, "\n").split("\n");
    if (selector.endLine > lines.length) return { stale: "line-range-out-of-bounds" };
    return { selector, startLine: selector.startLine, endLine: selector.endLine, tokens: estimateTokens(lines.slice(selector.startLine - 1, selector.endLine).join("\n")) };
  }
  if (selector.kind === "jsonPointer") {
    const value = jsonPointerValue(contentState.content, selector.pointer);
    return { selector, tokens: estimateTokens(JSON.stringify(value)) };
  }
  return { selector, tokens: contentState.tokens };
}

export function resolveTargetDocContext(rootInput, options = {}) {
  const root = path.resolve(rootInput);
  assertSafeTargetRoot(root);
  recoverContinuity(root);
  const { manifest } = loadTargetDocManifest(root, { allowLegacy: false });
  if (manifest.taskContext?.continuity?.enabled === true) {
    return resolveContinuityContext(root, manifest, options);
  }
  const entries = collectDocumentEntries(manifest, { allowLegacy: false });
  const always = new Set(manifest.loadPolicy.always);
  const never = new Set(manifest.loadPolicy.never);
  const requestedRoles = [...new Set(options.roles || [])];
  const registeredRoles = new Set(entries.map((entry) => entry.role));
  for (const role of requestedRoles) if (!registeredRoles.has(role)) throw new Error(`unregistered role requested: ${role}`);
  const requestedDocuments = [...new Map((options.documents || []).map((document) => [`${document.role}\0${document.path}`, document])).values()];
  for (const document of requestedDocuments) {
    if (!registeredRoles.has(document.role)) throw new Error(`unregistered role requested: ${document.role}`);
    const matches = entries.filter((entry) => entry.role === document.role && entry.path === document.path);
    if (matches.length !== 1) throw new Error(`--document must reference exactly one registered role/path pair: ${document.role}:${document.path}`);
  }
  const capsuleRecords = loadCapsuleRecords(root, options.capsule || "");
  const capsuleEntries = capsuleRecords.map((record, index) => ({ record, entry: validateCapsuleRecord(record, index, entries) }));
  const capsuleKeys = new Set(capsuleEntries.map(({ entry }) => `${entry.role}\0${entry.path}`));
  const rolesToLoad = new Set([...always, ...requestedRoles]);
  const documentsToLoad = new Set(requestedDocuments.map((document) => `${document.role}\0${document.path}`));
  const requestedMarkdown = [...new Set(options.markdown || [])];
  const markdownGovernance = resolveMarkdownGovernance(manifest);
  if (requestedMarkdown.length > 0 && !markdownGovernance.enabled) throw new Error("markdownGovernance is disabled; enable it in .vibe-docs.json before using --markdown");
  const allowed = [];
  const denied = [];
  const stale = [];

  for (const entry of entries) {
    const key = `${entry.role}\0${entry.path}`;
    if ((!rolesToLoad.has(entry.role) && !documentsToLoad.has(key)) || capsuleKeys.has(key)) continue;
    if (never.has(entry.role) && !options.allowNever) {
      denied.push({ role: entry.role, path: entry.path, reason: "never-policy" });
      continue;
    }
    const contentState = readEntryContent(root, entry);
    if (!contentState) {
      stale.push({ role: entry.role, path: entry.path, reason: "missing" });
      continue;
    }
    if (contentState.tokens > 20000 && entry.sections.length === 0) {
      denied.push({ role: entry.role, path: entry.path, reason: "index_required", estimatedTokens: contentState.tokens });
      continue;
    }
    if (entry.contentHash !== contentState.contentHash) {
      stale.push({ role: entry.role, path: entry.path, reason: "content-hash-mismatch", expected: entry.contentHash, actual: contentState.contentHash });
      continue;
    }
    allowed.push({ role: entry.role, path: entry.path, policy: always.has(entry.role) ? "always" : never.has(entry.role) ? "never" : "onDemand", estimatedTokens: contentState.tokens });
  }

  for (const { record, entry } of capsuleEntries) {
    if (never.has(entry.role) && record.selector.kind === "wholeFile") {
      denied.push({ role: entry.role, path: entry.path, reason: "whole-file-never-forbidden", selector: record.selector });
      continue;
    }
    if (never.has(entry.role) && !options.allowNever) {
      denied.push({ role: entry.role, path: entry.path, reason: "never-policy", selector: record.selector });
      continue;
    }
    const contentState = readEntryContent(root, entry);
    if (!contentState) {
      if (record.required === false) continue;
      stale.push({ role: entry.role, path: entry.path, reason: "missing", selector: record.selector });
      continue;
    }
    if (record.sourceRevision !== entry.contentHash || entry.contentHash !== contentState.contentHash) {
      stale.push({ role: entry.role, path: entry.path, reason: "source-revision-mismatch", expected: entry.contentHash, actual: contentState.contentHash, selector: record.selector });
      continue;
    }
    const range = selectedRange(entry, record, contentState);
    if (range.stale) {
      stale.push({ role: entry.role, path: entry.path, reason: range.stale, selector: record.selector });
      continue;
    }
    if (record.selector.kind === "wholeFile" && (contentState.tokens > 20000 || contentState.tokens > record.maxTokens)) {
      denied.push({ role: entry.role, path: entry.path, reason: contentState.tokens > 20000 && entry.sections.length === 0 ? "index_required" : "whole-file-budget-exceeded", selector: record.selector, estimatedTokens: contentState.tokens });
      continue;
    }
    if (range.tokens > record.maxTokens) {
      denied.push({ role: entry.role, path: entry.path, reason: "selector-budget-exceeded", selector: record.selector, estimatedTokens: range.tokens, maxTokens: record.maxTokens });
      continue;
    }
    allowed.push({ role: entry.role, path: entry.path, policy: never.has(entry.role) ? "never" : always.has(entry.role) ? "always" : "onDemand", reason: record.reason, selector: range.selector, startLine: range.startLine, endLine: range.endLine, estimatedTokens: range.tokens });
  }

  for (const markdownPath of requestedMarkdown) {
    if (isMarkdownArchivePath(markdownPath, markdownGovernance.archiveDirectories) && !options.allowMarkdownArchive) {
      denied.push({ role: "markdown", path: markdownPath, reason: "markdown-archive-forbidden" });
      continue;
    }
    const state = inspectTargetFile(root, markdownPath);
    if (!state.exists) {
      stale.push({ role: "markdown", path: markdownPath, reason: "missing" });
      continue;
    }
    if (!resolveLinkedMarkdownDetail(root, markdownPath).linked) {
      denied.push({ role: "markdown", path: markdownPath, reason: "markdown-not-linked-from-facade" });
      continue;
    }
    const content = fs.readFileSync(state.path, "utf8").replace(/^\uFEFF/u, "");
    const tokens = estimateTokens(content);
    const facade = parseMarkdownFacade(content);
    const limit = facade ? markdownGovernance.facadeMaxTokens : markdownGovernance.maxTokens;
    if (tokens > limit) {
      denied.push({ role: "markdown", path: markdownPath, reason: facade ? "facade-too-large" : "markdown-too-large", estimatedTokens: tokens, maxTokens: limit, detailDirectory: facade || undefined });
      continue;
    }
    allowed.push({ role: "markdown", path: markdownPath, policy: "onDemand", source: "markdownGovernance", estimatedTokens: tokens });
  }

  const totalTokens = allowed.reduce((sum, entry) => sum + entry.estimatedTokens, 0) + denied.filter((entry) => entry.reason === "index_required").reduce((sum, entry) => sum + (entry.estimatedTokens || 0), 0);
  const budget = options.budget || DEFAULT_BUDGET;
  if (totalTokens > budget) denied.push({ reason: "budget-exceeded", estimatedTokens: totalTokens, budget });
  return { root, allowed, denied, stale, estimatedTokens: totalTokens, totalTokens, budget, ok: denied.length === 0 && stale.length === 0 };
}

function emit(result, json) {
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  else {
    console.log("Target document context plan");
    console.log(`Root: ${result.root}`);
    for (const entry of result.allowed) console.log(`- [ALLOW] ${entry.role}: ${entry.path} (~${entry.estimatedTokens})`);
    for (const entry of result.denied) console.log(`- [DENY] ${entry.role || "context"}: ${entry.path || "-"} (${entry.reason})`);
    for (const entry of result.stale) console.log(`- [STALE] ${entry.role}: ${entry.path} (${entry.reason})`);
    console.log(`Total: ~${result.totalTokens} / ${result.budget}`);
    console.log(`Result: ${result.ok ? "PASS" : "FAIL"}`);
  }
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv);
    const result = resolveTargetDocContext(options.root, options);
    emit(result, options.json);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options?.json) process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 2) + "\n");
    else console.error(message);
    process.exitCode = 2;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
