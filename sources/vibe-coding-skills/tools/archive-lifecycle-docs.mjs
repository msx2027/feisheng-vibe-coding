#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { assertSafeTargetRoot, inspectTargetFile } from "./safe-target-fs.mjs";
import { commitTargetTransaction, readTargetText, recoverTargetTransaction } from "./target-doc-transaction.mjs";
import { metadataForDocument, refreshDocumentEntries, renderTargetDocIndex } from "./target-doc-index-core.mjs";
import { estimateTokens, validateTargetDocManifest } from "./target-doc-manifest-core.mjs";

const JOURNAL = ".vibe-doc-archive.json";
const VOLUME_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const MAX_VOLUME_TOKENS = 50_000;

function parseInteger(value, flag, minimum) {
  if (!/^\d+$/u.test(value || "")) throw new Error(`${flag} must be an integer >= ${minimum}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`${flag} must be an integer >= ${minimum}`);
  return parsed;
}

function parseArgs(argv) {
  const args = { root: "", mode: "dry-run", json: false, keepVersions: 20 };
  let explicitMode = "";
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (["--write", "--dry-run", "--recover"].includes(item)) {
      if (explicitMode) throw new Error("Use only one mode flag");
      explicitMode = item;
      args.mode = item.slice(2);
    } else if (item === "--json") args.json = true;
    else if (item === "--keep-versions") args.keepVersions = parseInteger(argv[++index], item, 1);
    else if (!item.startsWith("-") && !args.root) args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function parseManifest(raw) {
  if (raw === null) return {};
  try { return JSON.parse(raw.replace(/^\uFEFF/u, "")); }
  catch (error) { throw new Error(`invalid .vibe-docs.json: ${error.message}`); }
}

function safeConfiguredFile(root, configured, label) {
  if (typeof configured !== "string" || !configured) throw new Error(`${label} must be a project-relative path`);
  try { return inspectTargetFile(root, configured); }
  catch (error) { throw new Error(`${label}: ${error.message}`); }
}

function estimatedTokens(content) {
  return estimateTokens(content);
}

function metadataFor(file, content) {
  return metadataForDocument(file, content);
}

function registerArchive(manifest, role, file, content) {
  const documents = Array.isArray(manifest.documents) ? [...manifest.documents] : [];
  const entry = {
    role,
    path: file,
    owner: "archive-lifecycle-docs",
    authority: "archive",
    ...metadataFor(file, content),
    dependsOn: [],
  };
  const index = documents.findIndex((doc) => doc.path === file);
  if (index >= 0) documents[index] = { ...documents[index], ...entry };
  else documents.push(entry);
  const loadPolicy = manifest.loadPolicy && typeof manifest.loadPolicy === "object" ? manifest.loadPolicy : {};
  const never = [...new Set([...(Array.isArray(loadPolicy.never) ? loadPolicy.never : []), role])];
  const mappedArchives = [...new Set([...(Array.isArray(manifest[role]) ? manifest[role] : []), file])];
  return { ...manifest, [role]: mappedArchives, documents, loadPolicy: { ...loadPolicy, always: Array.isArray(loadPolicy.always) ? loadPolicy.always : [], never } };
}

function archiveRole(file) {
  const prefix = archivePrefix(file);
  if (prefix === "计划") return "devPlanArchives";
  if (prefix === "验收") return "manualAcceptanceArchives";
  if (prefix === "会话") return "sessionArchives";
  return "productSpecArchives";
}

function registerSourceMetadata(manifest, file, content) {
  if (!Array.isArray(manifest.documents)) return manifest;
  return {
    ...manifest,
    documents: manifest.documents.map((doc) => doc.path === file ? { ...doc, ...metadataFor(file, content) } : doc),
  };
}

function parseVersionSegments(content) {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})/u);
    if (match) starts.push({ index, version: match[1], date: match[2] });
  }
  const preamble = starts.length ? lines.slice(0, starts[0].index).join("\n") : content;
  const segments = starts.map((start, index) => ({
    version: start.version,
    date: start.date,
    content: lines.slice(start.index, index + 1 < starts.length ? starts[index + 1].index : lines.length).join("\n").trimEnd(),
  }));
  return { preamble, segments };
}

function archivePrefix(file) {
  const name = path.posix.basename(file);
  if (name.includes("需求")) return "需求";
  if (name.includes("计划")) return "计划";
  if (name.includes("验收")) return "验收";
  if (name.includes("会话")) return "会话";
  return "变更";
}

function planVolumes(root, sourceFile, archivedSegments) {
  const directory = path.posix.dirname(sourceFile);
  const prefix = archivePrefix(sourceFile);
  const volumes = [];
  for (const segment of archivedSegments.sort((a, b) => a.date.localeCompare(b.date) || a.version.localeCompare(b.version))) {
    const last = volumes.at(-1);
    const nextPiece = `${segment.content}\n\n`;
    if (!last || estimatedTokens(last.content + nextPiece) > MAX_VOLUME_TOKENS) {
      if (volumes.length >= VOLUME_NUMERALS.length) throw new Error("archive requires more than ten four-character volumes; split the source scope first");
      const fileName = `${prefix}${VOLUME_NUMERALS[volumes.length]}卷.md`;
      const file = directory === "." ? fileName : `${directory}/${fileName}`;
      const before = readTargetText(root, file);
      volumes.push({ file, before, content: `${before || `# ${prefix}${VOLUME_NUMERALS[volumes.length]}卷\n\n`}${nextPiece}` });
    } else last.content += nextPiece;
  }
  return volumes;
}

function planChangelog(root, manifest, keepVersions) {
  const sourceFile = manifest.productSpecChangelogArchive || "docs/01-产品/变更归档.md";
  const state = safeConfiguredFile(root, sourceFile, "productSpecChangelogArchive");
  if (!state.exists) return { operations: [], archives: [], result: null };
  const content = fs.readFileSync(state.path, "utf8");
  const parsed = parseVersionSegments(content);
  if (content.split(/\r?\n/u).length <= 500 && estimatedTokens(content) <= MAX_VOLUME_TOKENS) {
    return { operations: [], archives: [], result: { lines: content.split(/\r?\n/u).length } };
  }
  const newest = [...parsed.segments].sort((a, b) => b.date.localeCompare(a.date) || b.version.localeCompare(a.version));
  const keep = newest.slice(0, keepVersions);
  const archive = newest.slice(keepVersions);
  if (archive.length === 0) return { operations: [], archives: [], result: { lines: content.split(/\r?\n/u).length, warn: "no archiveable versions" } };
  const volumes = planVolumes(root, sourceFile, archive);
  const nextSource = `${parsed.preamble.trimEnd()}\n\n${keep.map((item) => item.content).join("\n\n")}\n`;
  return {
    operations: [...volumes.map((volume) => ({ file: volume.file, content: volume.content, expectedContent: volume.before })), { file: sourceFile, content: nextSource, expectedContent: content }],
    archives: volumes.map((volume) => ({ role: archiveRole(sourceFile), file: volume.file, content: volume.content })),
    source: { file: sourceFile, content: nextSource },
    result: { lines: content.split(/\r?\n/u).length, archivedVersions: archive.map((item) => item.version), volumes: volumes.map((item) => item.file) },
  };
}

function execute(args) {
  if (!args.root) throw new Error("target root is required");
  const root = path.resolve(args.root);
  assertSafeTargetRoot(root);
  if (args.mode === "recover") return { ok: true, mode: "recover", ...recoverTargetTransaction(root, JOURNAL) };
  const manifestRaw = readTargetText(root, ".vibe-docs.json");
  let manifest = parseManifest(manifestRaw);
  const changelog = planChangelog(root, manifest, args.keepVersions);
  const operations = [...changelog.operations];
  for (const archive of changelog.archives) manifest = registerArchive(manifest, archive.role, archive.file, archive.content);
  for (const source of [changelog.source].filter(Boolean)) manifest = registerSourceMetadata(manifest, source.file, source.content);
  if (manifest.schemaVersion === 2 && Array.isArray(manifest.documents)) {
    const planned = new Map(operations.map((operation) => [operation.file, operation.content]));
    manifest = {
      ...manifest,
      documents: refreshDocumentEntries(manifest.documents, (entry) => planned.get(entry.path) ?? readTargetText(root, entry.path)),
    };
    const indexFile = manifest.documentIndex || "文档索引.md";
    const indexBefore = readTargetText(root, indexFile);
    const indexAfter = renderTargetDocIndex(manifest.documents);
    if (indexBefore !== indexAfter) operations.push({ file: indexFile, content: indexAfter, expectedContent: indexBefore });
    manifest = registerSourceMetadata(manifest, indexFile, indexAfter);
    const validation = validateTargetDocManifest(manifest);
    if (!validation.ok) throw new Error(`archive would produce an invalid manifest: ${validation.issues[0].code} at ${validation.issues[0].at}`);
  }
  const nextManifestRaw = `${JSON.stringify(manifest, null, 2)}\n`;
  if (manifestRaw !== null && nextManifestRaw !== manifestRaw) operations.push({ file: ".vibe-docs.json", content: nextManifestRaw, expectedContent: manifestRaw });
  let changed = [];
  if (args.mode === "write" && operations.length) changed = commitTargetTransaction(root, { journalPath: JOURNAL, kind: "lifecycle-archive", operations }).changed;
  return { ok: true, mode: args.mode, changelog: changelog.result, plannedFiles: operations.map((item) => item.file).slice(0, 100), changed };
}

let args = { json: false };
try {
  args = parseArgs(process.argv.slice(2));
  const result = execute(args);
  console.log(args.json ? JSON.stringify(result, null, 2) : `Lifecycle archive ${result.mode}: ${result.plannedFiles?.length || 0} planned`);
} catch (error) {
  process.exitCode = error.code === "UNSAFE_TARGET_PATH" ? 2 : 2;
  if (args.json) console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  else console.error(error.message);
}
