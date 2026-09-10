#!/usr/bin/env node
// vibe-coding-skills:managed-target-doc-sync-tool

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectDocumentEntries, loadTargetDocManifest } from "./target-doc-manifest-core.mjs";
import { spawnTrustedGit, splitNullUtf8 } from "./trusted-git.mjs";

const toolsRoot = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const options = { root: "", json: false };
  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (!arg.startsWith("-") && !options.root) options.root = arg;
    else throw new Error(`Unknown or duplicate argument: ${arg}`);
  }
  if (!options.root) throw new Error("target root is required");
  return options;
}

function gitPaths(root, args) {
  const result = spawnTrustedGit(root, args, { encoding: null });
  if (result.status !== 0) {
    const detail = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8").trim() : String(result.stderr || result.error?.message || "").trim();
    throw new Error(`trusted Git query failed${detail ? `: ${detail}` : ""}`);
  }
  return splitNullUtf8(result.stdout).map((item) => item.replaceAll("\\", "/")).filter(Boolean);
}

function runJsonTool(script, root, args) {
  const result = spawnSync(process.execPath, [path.join(toolsRoot, script), root, ...args, "--json"], {
    encoding: "utf8",
    windowsHide: true,
  });
  let payload = null;
  try { payload = JSON.parse(result.stdout); } catch {}
  return { status: result.status, payload, detail: result.stderr.trim() || result.stdout.trim() };
}

export function checkTargetDocPrecommit(rootInput) {
  const root = path.resolve(rootInput);
  if (!fs.existsSync(path.join(root, ".vibe-docs.json"))) return { root, ok: true, skipped: true, findings: [] };
  const { manifest } = loadTargetDocManifest(root, { allowLegacy: false });
  const entries = collectDocumentEntries(manifest, { allowLegacy: false });
  const indexPath = manifest.documentIndex;
  const sourcePaths = new Set(entries.filter((entry) => entry.role !== "documentIndex").map((entry) => entry.path));
  const generatedPaths = new Set([".vibe-docs.json", indexPath]);
  const governedPaths = new Set([...sourcePaths, ...generatedPaths]);
  const staged = new Set(gitPaths(root, ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMRD"]));
  const unstaged = new Set([
    ...gitPaths(root, ["diff", "--name-only", "-z", "--diff-filter=ACMRD"]),
    ...gitPaths(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  const findings = [];
  const stagedSources = [...sourcePaths].filter((item) => staged.has(item));
  if (stagedSources.length > 0) {
    for (const generated of generatedPaths) {
      if (!staged.has(generated)) findings.push({ code: "staged-metadata-missing", file: generated, message: "受管正文已暂存，但匹配的 metadata / index 未暂存" });
    }
    for (const governed of governedPaths) {
      if (unstaged.has(governed)) findings.push({ code: "partial-staged-document", file: governed, message: "受管文档原子提交范围仍有未暂存修改" });
    }
  }
  const indexCheck = runJsonTool("build-target-doc-index.mjs", root, ["--check"]);
  if (indexCheck.status !== 0) findings.push({ code: "stale-target-doc-index", file: indexPath, message: indexCheck.payload?.stale || indexCheck.detail });
  const driftCheck = runJsonTool("check-target-doc-drift.mjs", root, ["--quick", "--strict"]);
  if (driftCheck.status !== 0) findings.push({ code: "target-doc-drift", file: ".vibe-docs.json", message: driftCheck.payload?.findings || driftCheck.detail });
  return { root, ok: findings.length === 0, skipped: false, stagedSources, findings };
}

function main() {
  let options = { json: false };
  try {
    options = parseArgs(process.argv.slice(2));
    const result = checkTargetDocPrecommit(options.root);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else if (result.ok) console.log("[target-doc-precommit] PASS");
    else for (const finding of result.findings) console.error(`[target-doc-precommit] ${finding.code}: ${finding.file}`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    if (options.json) console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
    else console.error(`[target-doc-precommit] blocked: ${error.message}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
