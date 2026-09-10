#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function hash(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.includes(0)) return crypto.createHash("sha256").update(buffer).digest("hex");
  return crypto.createHash("sha256").update(buffer.toString("utf8").replace(/\r\n?/gu, "\n"), "utf8").digest("hex");
}

function args(argv) {
  if (argv.length !== 2) throw new Error("Usage: node tools/check-release-source-provenance.mjs <source-root> <package-root>");
  return { sourceRoot: path.resolve(argv[0]), packageRoot: path.resolve(argv[1]) };
}

function main() {
  const { sourceRoot, packageRoot } = args(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "MANIFEST.json"), "utf8"));
  const mismatches = [];
  for (const record of manifest.files || []) {
    if (
      record.path.startsWith(".agents/") ||
      record.path.startsWith(".claude/skills/") ||
      record.path.startsWith(".claude/agents/") ||
      record.path.startsWith(".claude/hooks/") ||
      record.path.startsWith(".codex/") ||
      record.path.startsWith("plans/") ||
      record.path.startsWith("skills/ui-ux-pro-max/data/") ||
      record.path === ".claude/settings.json" ||
      record.path === ".codex/hooks.json"
    ) continue;
    const sourcePath = path.join(sourceRoot, ...record.path.split("/"));
    if (!fs.existsSync(sourcePath)) {
      mismatches.push(`${record.path}: missing from source worktree`);
      continue;
    }
    if (hash(sourcePath) !== record.sha256) mismatches.push(`${record.path}: source content differs from release`);
  }
  const output = {
    ok: mismatches.length === 0,
    sourceRoot,
    packageRoot,
    sourceCommit: manifest.sourceCommit,
    sourceIndexTree: manifest.sourceIndexTree,
    basis: "selected-source-content",
    mismatches,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = mismatches.length === 0 ? 0 : 1;
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
