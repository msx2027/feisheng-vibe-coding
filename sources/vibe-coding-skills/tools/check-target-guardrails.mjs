#!/usr/bin/env node
// Read-only guardrails for generated target-project lifecycle docs.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { assertSafeTargetRoot } from "./safe-target-fs.mjs";
import { spawnTrustedGit } from "./trusted-git.mjs";
import { collectDocumentEntries, validateTargetDocManifest } from "./target-doc-manifest-core.mjs";

const REQUIRED_ROLES = ["productSpec", "devPlan", "manualAcceptance", "interfaceContracts", "projectProfile", "constitutionDesign"];
const FOUR_CHINESE_MD = /^[\u4e00-\u9fff]{4}\.md$/u;
const PLACEHOLDERS = [
  /^\s*(?:[-*]\s*)?TODO(?:\s|[:：]|$)/mu,
  /^\s*(?:[-*]\s*)?TBD(?:\s|[:：]|$)/mu,
  /待填写/u,
  /@@/u,
];
const DRIFT_TERMS = [/后续再补/u, /暂时兼容/u, /以后再说/u];
const KEY_HEADINGS = ["范围", "不做什么", "验收", "停止条件", "未验证"];
const SENSITIVE_RUNTIME_DIRS = new Set([
  ".ddzj",
  ".cache",
  ".tmp",
  "tmp",
  "sessions",
  "archived_sessions",
]);
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "dist",
  "coverage",
  "node_modules",
  ".electron-dist",
  ...SENSITIVE_RUNTIME_DIRS,
]);

function isSensitiveRuntimeFile(name) {
  return name.toLowerCase().includes(".sqlite");
}

function isSensitiveRuntimePath(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
  return (
    normalized.split("/").some((segment) => SENSITIVE_RUNTIME_DIRS.has(segment)) ||
    isSensitiveRuntimeFile(path.basename(normalized))
  );
}

function isTestSourceFile(file) {
  return /(?:^|\.)(?:test|spec)\.[cm]?[jt]sx?$/u.test(path.basename(file));
}

function parseArgs(argv) {
  const args = { root: "", json: false, strict: false };
  for (const arg of argv) {
    if (arg === "--json") args.json = true;
    else if (arg === "--strict") args.strict = true;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else if (!arg.startsWith("-") && !args.root) args.root = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node tools/check-target-guardrails.mjs <target-root> [--json] [--strict]`);
}

function rel(root, filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/") || ".";
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function inspectRegularFile(root, filePath) {
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(filePath);
  if (!isInside(resolvedRoot, resolvedFile)) {
    return { ok: false, reason: "path escapes target root" };
  }

  try {
    const rootStat = fs.lstatSync(resolvedRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      return { ok: false, reason: "target root is not a regular directory" };
    }

    const relative = path.relative(resolvedRoot, resolvedFile);
    const segments = relative.split(path.sep).filter(Boolean);
    let current = resolvedRoot;
    for (let index = 0; index < segments.length; index += 1) {
      current = path.join(current, segments[index]);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        return { ok: false, reason: `path contains a symlink or junction: ${rel(resolvedRoot, current)}` };
      }
      const final = index === segments.length - 1;
      if (final ? !stat.isFile() : !stat.isDirectory()) {
        return { ok: false, reason: final ? "path is not a regular file" : "path parent is not a directory" };
      }
    }

    const realRoot = fs.realpathSync(resolvedRoot);
    const realFile = fs.realpathSync(resolvedFile);
    if (!isInside(realRoot, realFile)) {
      return { ok: false, reason: "real path escapes target root" };
    }
    return { ok: true, file: resolvedFile };
  } catch (error) {
    if (error?.code === "ENOENT") return { ok: false, missing: true, reason: "path does not exist" };
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function readJson(filePath) {
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, "")) };
  } catch (error) {
    return { error };
  }
}

function listFiles(root) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name.toLowerCase())) walk(absolute);
      else if (entry.isFile() && !isSensitiveRuntimeFile(entry.name)) files.push(rel(root, absolute));
    }
  };
  if (fs.existsSync(root)) walk(root);
  return files.sort();
}

function listTrackedFiles(root) {
  let current = path.resolve(root);
  let hasGitContext = false;
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      hasGitContext = true;
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (!hasGitContext) return { files: [], error: null };

  const commonOptions = {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  };
  const topLevelResult = spawnTrustedGit(root, ["rev-parse", "--show-toplevel"], commonOptions);
  if (topLevelResult.status !== 0 || topLevelResult.error) {
    return {
      files: [],
      error:
        topLevelResult.error?.message ||
        topLevelResult.stderr?.trim() ||
        `git rev-parse exited ${topLevelResult.status}`,
    };
  }
  const topLevel = path.resolve(topLevelResult.stdout.trim());
  const result = spawnTrustedGit(root, ["ls-files", "--full-name", "-z", "--", "."], commonOptions);
  if (result.status !== 0 || result.error) {
    return {
      files: [],
      error: result.error?.message || result.stderr?.trim() || `git ls-files exited ${result.status}`,
    };
  }
  return {
    files: result.stdout
      .split("\0")
      .map((file) => path.resolve(topLevel, file))
      .filter((file) => isInside(path.resolve(root), file))
      .map((file) => rel(path.resolve(root), file))
      .filter(Boolean)
      .sort(),
    error: null,
  };
}

function add(findings, severity, id, message, file = "") {
  findings.push({ severity, id, message, file });
}

function collectMappedDocs(manifest) {
  if (manifest?.schemaVersion === 2) {
    return collectDocumentEntries(manifest, { allowLegacy: false })
      .filter((entry) => entry.authority !== "archive" && typeof entry.path === "string" && entry.path.endsWith(".md"))
      .map((entry) => ({ role: entry.role, file: entry.path }));
  }
  const docs = [];
  for (const role of REQUIRED_ROLES) {
    const value = manifest?.[role];
    if (typeof value === "string") docs.push({ role, file: value });
  }
  return docs;
}

function checkManifest(root, findings) {
  const manifestPath = path.join(root, ".vibe-docs.json");
  const inspection = inspectRegularFile(root, manifestPath);
  if (inspection.missing) {
    add(findings, "blocker", "manifest-missing", "Missing .vibe-docs.json");
    return { manifest: null, docs: [] };
  }
  if (!inspection.ok) {
    add(findings, "blocker", "manifest-unsafe-file", `.vibe-docs.json must be a root-contained regular file: ${inspection.reason}`);
    return { manifest: null, docs: [] };
  }

  const parsed = readJson(inspection.file);
  if (parsed.error) {
    add(findings, "blocker", "manifest-invalid", `Invalid .vibe-docs.json: ${parsed.error.message}`);
    return { manifest: null, docs: [] };
  }

  const manifestValidation = validateTargetDocManifest(parsed.value, { allowLegacy: true });
  for (const issue of manifestValidation.issues) {
    add(findings, "blocker", `manifest-${issue.code}`, `${issue.at}: ${issue.message}`, ".vibe-docs.json");
  }

  for (const role of REQUIRED_ROLES) {
    if (typeof parsed.value[role] !== "string" || parsed.value[role].trim() === "") {
      add(findings, "blocker", "role-missing", `.vibe-docs.json is missing required role: ${role}`);
    }
  }

  return { manifest: parsed.value, docs: collectMappedDocs(parsed.value) };
}

function checkDocs(root, docs, findings) {
  const contents = [];
  for (const doc of docs) {
    const normalized = doc.file.replace(/\\/g, "/");
    if (isSensitiveRuntimePath(normalized)) {
      add(findings, "blocker", "doc-sensitive-runtime-path", `${doc.role} must not map to runtime state`, doc.file);
      continue;
    }
    if (path.isAbsolute(normalized)) {
      add(findings, "blocker", "doc-absolute-path", `${doc.role} must be project-relative`, doc.file);
      continue;
    }
    const absolute = path.resolve(root, normalized);
    if (!isInside(root, absolute)) {
      add(findings, "blocker", "doc-path-escape", `${doc.role} escapes target root`, doc.file);
      continue;
    }
    if (!FOUR_CHINESE_MD.test(path.basename(normalized))) {
      add(findings, "blocker", "doc-name", `${doc.role} must use exactly four Chinese characters plus .md`, doc.file);
    }
    const inspection = inspectRegularFile(root, absolute);
    if (inspection.missing) {
      add(findings, "blocker", "doc-missing", `${doc.role} mapped document does not exist`, doc.file);
      continue;
    }
    if (!inspection.ok) {
      add(
        findings,
        "blocker",
        "doc-unsafe-file",
        `${doc.role} must map to a root-contained regular file: ${inspection.reason}`,
        doc.file,
      );
      continue;
    }
    const content = fs.readFileSync(inspection.file, "utf8");
    contents.push({ ...doc, content });
    for (const pattern of PLACEHOLDERS) {
      if (pattern.test(content)) add(findings, "warning", "placeholder", `Lifecycle doc contains placeholder pattern ${pattern}`, doc.file);
    }
    for (const pattern of DRIFT_TERMS) {
      if (pattern.test(content)) add(findings, "warning", "drift-term", `Lifecycle doc contains unexplained drift term ${pattern}`, doc.file);
    }
  }

  const combined = contents.map((doc) => doc.content).join("\n");
  for (const heading of KEY_HEADINGS) {
    if (!combined.includes(heading)) {
      add(findings, "warning", "heading-missing", `Lifecycle docs should mention ${heading}`);
    }
  }
  return contents;
}

function checkPrivacyFiles(root, findings) {
  const tracked = listTrackedFiles(root);
  if (tracked.error) {
    add(findings, "warning", "git-tracked-scan", `Unable to inspect tracked files: ${tracked.error}`);
  }
  const trackedSensitiveFiles = new Set(tracked.files.filter(isSensitiveRuntimePath));
  const files = new Set([...listFiles(root), ...trackedSensitiveFiles]);
  for (const file of [...files].sort()) {
    if (trackedSensitiveFiles.has(file)) {
      add(
        findings,
        "warning",
        "privacy-file",
        "Tracked file is inside excluded runtime state; remove it from Git or document why it is safe.",
        file,
      );
      continue;
    }
    if (isTestSourceFile(file)) continue;
    const base = path.basename(file).toLowerCase();
    if (base === ".env.example" || base === ".env.sample") continue;
    if (
      base === ".env" ||
      base.startsWith(".env.") ||
      base.includes("secret") ||
      base.includes("private-key") ||
      base === "database.sql" ||
      base === "dump.sql"
    ) {
      add(findings, "warning", "privacy-file", "Suspicious privacy-sensitive filename; confirm before commit.", file);
    }
  }
}

function buildReport(rootInput, strict) {
  const root = path.resolve(rootInput || ".");
  const findings = [];
  try {
    assertSafeTargetRoot(root);
  } catch (error) {
    add(
      findings,
      "blocker",
      "target-root",
      error instanceof Error ? error.message : `Target root is unavailable: ${root}`,
    );
    return summarize(root, [], findings, strict);
  }

  const { docs } = checkManifest(root, findings);
  const checkedDocs = checkDocs(root, docs, findings);
  checkPrivacyFiles(root, findings);
  return summarize(root, checkedDocs.map((doc) => ({ role: doc.role, file: doc.file })), findings, strict);
}

function summarize(root, docs, findings, strict) {
  const blockers = findings.filter((finding) => finding.severity === "blocker").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  return {
    ok: blockers === 0 && (!strict || warnings === 0),
    root,
    docs,
    findings,
    summary: { blockers, warnings },
  };
}

function printText(report) {
  console.log(`Target guardrails: ${report.root}`);
  for (const doc of report.docs) console.log(`[DOC] ${doc.role}: ${doc.file}`);
  for (const finding of report.findings) {
    const suffix = finding.file ? ` (${finding.file})` : "";
    console.log(`[${finding.severity.toUpperCase()}] ${finding.id}: ${finding.message}${suffix}`);
  }
  console.log(`Result: ${report.ok ? "PASS" : report.summary.blockers > 0 ? "BLOCKED" : "FAIL"}`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.root) {
    usage();
    process.exitCode = args.help ? 0 : 2;
  } else {
    const report = buildReport(args.root, args.strict);
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else printText(report);
    process.exitCode = report.summary.blockers > 0 ? 1 : report.ok ? 0 : 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
