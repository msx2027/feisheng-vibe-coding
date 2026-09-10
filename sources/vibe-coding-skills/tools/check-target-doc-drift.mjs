#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { assertSafeTargetRoot, inspectTargetFile } from "./safe-target-fs.mjs";
import { readTargetText, sha256 } from "./target-doc-transaction.mjs";
import { stateConflict } from "./target-doc-migration-helpers.mjs";
import { COLLECTION_DOCUMENT_ROLES, hashContent, validateTargetDocManifest } from "./target-doc-manifest-core.mjs";
import { resolveTargetDocContext } from "./resolve-target-doc-context.mjs";
import { checkMarkdownGovernance } from "./markdown-governance-core.mjs";

const MAX_FINDINGS = 100;
const EXCLUDED_DIRS = new Set([".git", ".tmp", ".agents", ".claude", ".codex", "node_modules", "dist", "build", "coverage", ".next", "target"]);
const COLLECTION_ROLE_SET = new Set(COLLECTION_DOCUMENT_ROLES);

function parseArgs(argv) {
  const args = { root: "", level: "micro", strict: false, json: false, help: false };
  for (const item of argv) {
    if (["--micro", "--quick", "--full"].includes(item)) args.level = item.slice(2);
    else if (item === "--strict") args.strict = true;
    else if (item === "--json") args.json = true;
    else if (item === "-h" || item === "--help") args.help = true;
    else if (!item.startsWith("-") && !args.root) args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function finding(code, severity, file, message) {
  return { code, severity, file, message: String(message).slice(0, 500) };
}

function parseManifest(raw) {
  if (raw === null) throw Object.assign(new Error(".vibe-docs.json is required"), { exitCode: 2 });
  try { return JSON.parse(raw.replace(/^\uFEFF/u, "")); }
  catch (error) { throw Object.assign(new Error(`invalid .vibe-docs.json: ${error.message}`), { exitCode: 2 }); }
}

function validateManifest(root, manifest, findings) {
  if (manifest.schemaVersion !== 2) findings.push(finding("migration-required", "warning", ".vibe-docs.json", "schemaVersion 2 is required for strict drift checks"));
  if (!Array.isArray(manifest.documents)) {
    findings.push(finding("manifest-schema", "error", ".vibe-docs.json", "documents must be an array"));
    return;
  }
  const roles = new Set();
  const paths = new Set();
  for (const doc of manifest.documents) {
    if (!doc || typeof doc.role !== "string" || typeof doc.path !== "string") {
      findings.push(finding("manifest-schema", "error", ".vibe-docs.json", "each document requires string role/path"));
      continue;
    }
    if (!COLLECTION_ROLE_SET.has(doc.role) && roles.has(doc.role)) findings.push(finding("duplicate-role", "error", doc.path, `duplicate role: ${doc.role}`));
    if (paths.has(doc.path)) findings.push(finding("duplicate-path", "error", doc.path, "document path is registered more than once"));
    roles.add(doc.role);
    paths.add(doc.path);
    let state;
    try { state = inspectTargetFile(root, doc.path); }
    catch (error) { findings.push(finding("unsafe-path", "error", doc.path, error.message)); continue; }
    if (!state.exists) {
      findings.push(finding("missing-document", doc.authority === "archive" ? "warning" : "error", doc.path, "registered document is missing"));
      continue;
    }
    const content = fs.readFileSync(state.path, "utf8");
    if (doc.contentHash && doc.contentHash !== hashContent(content)) findings.push(finding("stale-document", "error", doc.path, "contentHash does not match current content"));
    for (const dependency of Array.isArray(doc.dependsOn) ? doc.dependsOn : []) {
      if (!roles.has(dependency) && !manifest.documents.some((item) => item.role === dependency)) {
        findings.push(finding("stale-dependency", "error", doc.path, `unknown dependency role: ${dependency}`));
      }
    }
  }
  const always = manifest.loadPolicy?.always;
  const never = manifest.loadPolicy?.never;
  if (!Array.isArray(always) || !Array.isArray(never)) findings.push(finding("manifest-schema", "error", ".vibe-docs.json", "loadPolicy.always/never must be arrays"));
  else {
    for (const role of [...always, ...never]) if (!roles.has(role)) findings.push(finding("unknown-policy-role", "error", ".vibe-docs.json", `unknown loadPolicy role: ${role}`));
    for (const role of always) if (never.includes(role)) findings.push(finding("policy-overlap", "error", ".vibe-docs.json", `${role} appears in always and never`));
  }
}

function validateState(root, manifest, findings) {
  const conflict = stateConflict(root, manifest);
  if (conflict) findings.push(finding("state-conflict", "error", "任务状态.json", conflict));
  const capsule = manifest.taskContext?.currentTaskCapsule;
  if (!capsule) return;
  const file = `${capsule}/任务状态.json`;
  const raw = readTargetText(root, file);
  if (raw === null) return findings.push(finding("missing-state", "error", file, "current task state is missing"));
  try {
    const state = JSON.parse(raw);
    const expected = sha256(JSON.stringify({ ...state, revision: "" }));
    if (state.revision !== expected) findings.push(finding("stale-state-revision", "error", file, "revision does not match task state content"));
  } catch (error) {
    findings.push(finding("invalid-state", "error", file, error.message));
  }
}

function validateCapsuleContext(root, manifest, findings) {
  const capsule = manifest.taskContext?.currentTaskCapsule;
  if (!capsule) return;
  try {
    const result = resolveTargetDocContext(root, {
      capsule,
      budget: 50_000,
      allowNever: true,
      reason: "strict document drift validation",
    });
    for (const stale of result.stale) {
      findings.push(finding("stale-selector", "error", stale.path || capsule, stale.reason));
    }
    for (const denied of result.denied) {
      findings.push(finding("invalid-selector", "error", denied.path || capsule, denied.reason));
    }
  } catch (error) {
    findings.push(finding("invalid-context", "error", capsule, error.message));
  }
}

function walkMarkdown(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) { if (!EXCLUDED_DIRS.has(entry.name)) visit(full); }
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path.relative(root, full).replaceAll("\\", "/"));
    }
  };
  visit(root);
  return files;
}

function validateFull(root, manifest, findings) {
  const registered = new Set((manifest.documents || []).map((doc) => doc.path));
  const ignored = new Set((Array.isArray(manifest.ignore) ? manifest.ignore : []).filter((item) => item && typeof item.path === "string" && typeof item.reason === "string" && item.reason.trim()).map((item) => item.path));
  const markdown = checkMarkdownGovernance(root, manifest, { includeFiles: true });
  const governed = new Set(markdown.governedFiles || []);
  const archived = new Set(markdown.archivedFiles || []);
  for (const file of walkMarkdown(root)) {
    if (registered.has(file) || ignored.has(file) || governed.has(file) || archived.has(file)) continue;
    const content = readTargetText(root, file) || "";
    if (/<!--\s*vibe-(?:lifecycle|section):?/u.test(content)) findings.push(finding("marked-orphan", "error", file, "marked lifecycle document is not registered"));
    else if (/^[\p{Script=Han}]{4}\.md$/u.test(path.basename(file))) findings.push(finding("unclassified-doc", "warning", file, "four-character Markdown document is not classified"));
    if (/[一二三四五六七八九十]卷\.md$/u.test(file)) findings.push(finding("unregistered-archive", "error", file, "archive document is not registered"));
  }
  for (const item of markdown.findings) findings.push(finding(`markdown-${item.code}`, item.severity, item.file, item.message || item.code));
}

function execute(args) {
  if (!args.root || args.help) {
    console.error("Usage: node tools/check-target-doc-drift.mjs <root> --micro|--quick|--full [--strict] [--json]");
    return { exitCode: args.help ? 0 : 2 };
  }
  const root = path.resolve(args.root);
  assertSafeTargetRoot(root);
  const manifest = parseManifest(readTargetText(root, ".vibe-docs.json"));
  const findings = [];
  const coreValidation = validateTargetDocManifest(manifest, { allowLegacy: true });
  for (const issue of coreValidation.issues) findings.push(finding(issue.code, "error", issue.at, issue.message));
  validateManifest(root, manifest, findings);
  validateState(root, manifest, findings);
  if (args.level !== "micro") validateCapsuleContext(root, manifest, findings);
  if (args.level === "full") validateFull(root, manifest, findings);
  const errors = findings.filter((item) => item.severity === "error").length;
  const warnings = findings.length - errors;
  return {
    exitCode: args.strict && errors > 0 ? 1 : 0,
    payload: { ok: errors === 0, level: args.level, strict: args.strict, errors, warnings, totalFindings: findings.length, findings: findings.slice(0, MAX_FINDINGS), truncated: findings.length > MAX_FINDINGS },
  };
}

let args = { json: false };
try {
  args = parseArgs(process.argv.slice(2));
  const result = execute(args);
  process.exitCode = result.exitCode;
  if (result.payload) console.log(args.json ? JSON.stringify(result.payload, null, 2) : `Target doc drift ${result.payload.ok ? "PASS" : "FAIL"}: ${result.payload.errors} errors`);
} catch (error) {
  process.exitCode = error.exitCode || (error.code === "UNSAFE_TARGET_PATH" ? 2 : 2);
  if (args.json) console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  else console.error(error.message);
}
