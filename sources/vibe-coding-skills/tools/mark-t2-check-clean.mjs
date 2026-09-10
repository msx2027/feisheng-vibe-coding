#!/usr/bin/env node
// DocMap:
// Layer: L3 / 关键脚本
// Module: tools
// Depends on: tools/doc-sync-helpers.sh, .claude/.needs-t2-check, .claude/.t2-check-snapshot
// Writes a lightweight validation snapshot for ordinary T2 staged source changes.

import path from "node:path";
import { execTrustedGit, splitNullUtf8 } from "./trusted-git.mjs";
import { assertSafeTargetRoot, safeWriteTargetFile } from "./safe-target-fs.mjs";

function usage() {
  return [
    "Usage:",
    "  node tools/mark-t2-check-clean.mjs [repoRoot] --evidence \"<validation command or note>\" [--json]",
    "",
    "Only ordinary staged T2 source changes are accepted. Strict T2/T3 changes must use code-review/doc-sync.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { root: process.cwd(), evidence: "", json: false };
  const rest = [...argv];

  if (rest[0] && !rest[0].startsWith("-")) {
    args.root = rest.shift();
  }

  while (rest.length > 0) {
    const arg = rest.shift();
    if (arg === "--json") {
      args.json = true;
    } else if (arg === "--evidence") {
      args.evidence = rest.shift() || "";
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.evidence.trim()) {
    throw new Error("Missing required --evidence value.");
  }

  args.root = path.resolve(args.root);
  return args;
}

function git(root, args, options = {}) {
  return execTrustedGit(root, args, {
    encoding: options.encoding || "utf8",
    input: options.input,
  });
}

function normalizePath(value = "") {
  let normalized = String(value).replace(/\r/g, "").replace(/\\/g, "/");
  while (normalized.startsWith("./")) normalized = normalized.slice(2);
  return normalized === "." ? "" : normalized;
}

function isGeneratedPath(filePath) {
  return /^(\.claude|\.agents|\.codex|\.git)\//.test(filePath);
}

function isLowSignalPath(filePath) {
  return (
    !filePath ||
    /\.(lock|log|tmp|bak|swp|swo|cache)$/i.test(filePath) ||
    [".gitignore", ".gitattributes", ".editorconfig", ".DS_Store", "Thumbs.db", ".env"].includes(filePath) ||
    filePath.startsWith(".env.")
  );
}

function isModuleIndexPath(filePath) {
  return ["skills/INDEX.md", "agents/INDEX.md", "hooks/INDEX.md", "codex-hooks/INDEX.md", "tools/INDEX.md"].includes(filePath);
}

function isProtectedSourceDocPath(filePath) {
  return [
    "AGENTS.md",
    "CLAUDE.md",
    "DOC-MAP.md",
    "Product-Spec.md",
    "DEV-PLAN.md",
    "TERMINOLOGY-AND-NAMING.md",
    "skills/INDEX.md",
    "agents/INDEX.md",
    "hooks/INDEX.md",
    "codex-hooks/INDEX.md",
    "tools/INDEX.md",
  ].includes(filePath);
}

function isDocPath(filePath) {
  if (isGeneratedPath(filePath) || isLowSignalPath(filePath)) return false;
  if (isModuleIndexPath(filePath)) return true;
  if (/^(skills|agents|hooks|codex-hooks|tools|\.githooks)\//.test(filePath)) return false;
  return (
    ["README.md", "CHANGELOG.md", "CONTRIBUTING.md", "Product-Spec.md", "Product-Spec-CHANGELOG.md", "DEV-PLAN.md", "Design-Brief.md", "AGENTS.md", "CLAUDE.md"].includes(filePath) ||
    /^(docs|plans)\//.test(filePath) ||
    /\.(md|mdx|txt)$/i.test(filePath)
  );
}

function isBehaviorPath(filePath) {
  if (isGeneratedPath(filePath) || isLowSignalPath(filePath) || isDocPath(filePath)) return false;
  return /^(skills|agents|hooks|codex-hooks|tools|\.githooks|migrations)\//.test(filePath) ||
    ["settings.json", "codex-hooks.json"].includes(filePath) ||
    /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue|svelte|html|css|scss|py|sh|ps1|psm1|json|ya?ml|toml|sql)$/i.test(filePath);
}

function isSourceChangePath(filePath) {
  if (isGeneratedPath(filePath) || isLowSignalPath(filePath)) return false;
  return isProtectedSourceDocPath(filePath) || isBehaviorPath(filePath);
}

function isRepoWorkflowPath(filePath) {
  return /^(skills|agents|hooks|codex-hooks|tools|\.githooks)\//.test(filePath) ||
    ["settings.json", "codex-hooks.json"].includes(filePath);
}

function hasHazardPathSignal(filePath) {
  if (isRepoWorkflowPath(filePath)) return true;
  return /(^|[/_.-])(auth|permission|security|token|secret|payment|database|db|migration|migrations|data[-_]?loss|filesystem|shell|network|eval|pre[-_]?commit|hook|agent|routing|release|deploy|publish|delete|danger|admin|role|privacy|login|logout|signin|sign[-_]?in|signup|sign[-_]?up|authorize|authorization)([/_.-]|$)/i.test(filePath);
}

function diff(root, filePath) {
  return git(root, ["diff", "--cached", "--", filePath]);
}

function diffHasPattern(root, filePath, pattern) {
  return diff(root, filePath)
    .split(/\r?\n/)
    .some((line) => /^[+-][^+-]/.test(line) && pattern.test(line));
}

function diffHasHazardSignal(root, filePath) {
  if (hasHazardPathSignal(filePath)) return true;
  return diffHasPattern(root, filePath, /(auth|permission|security|token|secret|payment|database|db|migration|data[ _-]?loss|filesystem|file system|shell|network|eval|pre[-_ ]?commit|hook|agent routing|routing|release|deploy|publish|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|password|credential|private[_ -]?key|api[_ -]?key|sql|rollback|chmod|rm -rf|exec\(|spawn\(|child_process|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|test\(|expect\(|assert|https?:\/\/)/i);
}

function diffHasHighRiskSignal(root, filePath) {
  if (diffHasHazardSignal(root, filePath)) return true;
  return diffHasPattern(root, filePath, /(auth|permission|token|secret|payment|database|migration|security|eval|network|filesystem|shell|pre-commit|hook|agent|routing|route|env|sql|password|credential|private[_-]?key|api[_-]?key|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|api|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|test\(|expect\(|assert)/i);
}

function diffHasProtectedDocStrictSignal(root, filePath) {
  if (diffHasHazardSignal(root, filePath) || diffHasHighRiskSignal(root, filePath)) return true;
  return diffHasPattern(root, filePath, /(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)/i);
}

function isLowRiskChangedLine(line) {
  const trimmed = String(line).trim();
  if (!trimmed || /^\/\/.*$|^\/\*$|^\*\/$/.test(trimmed)) return true;
  if (/\bon[A-Z][A-Za-z]*=|@[A-Za-z-]+=|on:[A-Za-z-]+=|\{.*\}/.test(trimmed)) return false;
  if (/(className=|class=|aria-label=|title=|placeholder=|alt=|style=)/.test(trimmed)) return true;
  if (/^<[A-Za-z][^>]*>[^<>{}`=]+<\/[A-Za-z][A-Za-z0-9]*>$/.test(trimmed)) {
    return !/[`{}=]|\bon[A-Z][A-Za-z]*=|\b(if|for|while|switch|return|import|export|const|let|var|function|async|await)\b/.test(trimmed);
  }
  return /^(color|background|background-color|font|font-size|font-weight|line-height|letter-spacing|margin|margin-[A-Za-z-]+|padding|padding-[A-Za-z-]+|gap|row-gap|column-gap|border|border-[A-Za-z-]+|border-radius|box-shadow|opacity)\s*:/.test(trimmed);
}

function stagedDiffIsLight(root, filePath) {
  if (!/\.(tsx|jsx|vue|svelte|html|css|scss)$/i.test(filePath)) return false;
  let hasChanged = false;
  for (const line of diff(root, filePath).split(/\r?\n/)) {
    if (/^(\+\+\+|---|@@)/.test(line)) continue;
    if (/^[+-]/.test(line)) {
      hasChanged = true;
      if (!isLowRiskChangedLine(line.slice(1))) return false;
    }
  }
  return hasChanged;
}

function stagedTier(root, record, filePath) {
  if (isGeneratedPath(filePath) || isLowSignalPath(filePath)) return "t0";
  if (isProtectedSourceDocPath(filePath)) return diffHasProtectedDocStrictSignal(root, filePath) ? "t3" : "t2";
  if (isRepoWorkflowPath(filePath)) return "t3";
  if (/^(D|R|C)/.test(record.status)) {
    if (!isBehaviorPath(filePath)) return "t0";
    return diffHasHazardSignal(root, filePath) ? "t3" : "t2";
  }
  if (isDocPath(filePath)) {
    return diffHasPattern(root, filePath, /(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)/i) ? "t2" : "t0";
  }
  if (!isBehaviorPath(filePath)) return "t0";
  if (diffHasHazardSignal(root, filePath) || diffHasHighRiskSignal(root, filePath)) return "t3";
  if (stagedDiffIsLight(root, filePath)) return "t1";
  return "t2";
}

function gateLevel(root, record, filePath) {
  if (!isSourceChangePath(filePath)) return "none";
  const tier = stagedTier(root, record, filePath);
  if (tier === "t0" || tier === "t1") return "none";
  if (tier === "t3" || isRepoWorkflowPath(filePath)) return "strict";
  if (/^(D|R|C)/.test(record.status) && isBehaviorPath(filePath)) return "strict";
  return "t2-light";
}

function parseNameStatusZ(buffer) {
  const parts = splitNullUtf8(buffer).filter(Boolean);
  const records = [];
  for (let i = 0; i < parts.length;) {
    const status = parts[i++];
    if (/^(R|C)/.test(status)) {
      const oldPath = normalizePath(parts[i++]);
      const newPath = normalizePath(parts[i++]);
      records.push({ status, path: newPath, oldPath });
    } else {
      records.push({ status, path: normalizePath(parts[i++]), oldPath: "" });
    }
  }
  return records;
}

function stagedRecords(root) {
  const output = execTrustedGit(root, ["diff", "--cached", "--name-status", "-z", "--diff-filter=ACMRD"], {
    encoding: null,
  });
  return parseNameStatusZ(output);
}

function recordPaths(record) {
  return record.oldPath ? [record.oldPath, record.path] : [record.path];
}

function t2SnapshotContent(root, records) {
  const chunks = ["t2-check-snapshot-v1\n"];
  for (const record of records) {
    chunks.push(`record\t${record.status}\t${record.oldPath || record.path}\t${record.oldPath ? record.path : ""}\n`);
    const paths = recordPaths(record);
    chunks.push(git(root, ["diff", "--cached", "--binary", "--", ...paths]));
    chunks.push("\nend-record\n");
  }
  return chunks.join("");
}

function hashContent(root, content) {
  return git(root, ["hash-object", "--stdin"], { input: content }).trim();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  assertSafeTargetRoot(args.root);
  git(args.root, ["rev-parse", "--git-dir"]);

  const records = stagedRecords(args.root);
  const strict = [];
  const t2 = [];

  for (const record of records) {
    const paths = recordPaths(record);
    const levels = paths.map((filePath) => gateLevel(args.root, record, filePath));
    if (levels.includes("strict")) strict.push(record);
    else if (levels.includes("t2-light")) t2.push(record);
  }

  if (strict.length > 0) {
    throw new Error(`Strict staged source changes require code-review/doc-sync: ${strict.map((r) => r.path).join(", ")}`);
  }

  if (t2.length === 0) {
    throw new Error("No ordinary staged T2 source changes found.");
  }

  const snapshotContent = t2SnapshotContent(args.root, t2);
  const snapshotHash = hashContent(args.root, snapshotContent);
  const evidence = {
    status: "clean",
    evidence: args.evidence,
    snapshotHash,
    files: t2.map((record) => record.path),
    generatedAt: new Date().toISOString(),
  };

  safeWriteTargetFile(args.root, ".claude/.t2-check-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);
  safeWriteTargetFile(args.root, ".claude/.t2-check-snapshot", `${snapshotHash}\n`);
  safeWriteTargetFile(args.root, ".claude/.needs-t2-check", "clean\n");

  const result = { result: "PASS", ...evidence };
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`T2 check 状态已写为 clean，并记录当前普通 T2 staged source-change 快照：${snapshotHash}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
