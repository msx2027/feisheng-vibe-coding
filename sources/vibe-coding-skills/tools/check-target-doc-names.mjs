#!/usr/bin/env node
// DocMap:
// Layer: L3 / validation script
// Module: tools
// Depends on: .vibe-docs.json
// Syncs with: tools/INDEX.md, skills/product-spec-builder/SKILL.md, skills/dev-planner/SKILL.md
// Validates target-project lifecycle Markdown document names.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { assertSafeTargetRoot, inspectTargetDirectory, inspectTargetFile } from "./safe-target-fs.mjs";
import { validateTargetDocManifest } from "./target-doc-manifest-core.mjs";

const REQUIRED_INDEX = ".vibe-docs.json";
const FOUR_CHINESE_MD = /^[\u4e00-\u9fff]{4}\.md$/u;
const ALLOWED_NON_LIFECYCLE_MD = new Set(["docs/99-归档/索引.md"]);
const LEGACY_DOC_NAMES = new Set([
  "Product-Spec.md",
  "Product-Spec-CHANGELOG.md",
  "Design-Brief.md",
  "DEV-PLAN.md",
  "CURRENT-EXECUTION.md",
]);

function usage() {
  console.error(`Usage:
  node ./tools/check-target-doc-names.mjs <target-root> [--require-existing] [--allow-legacy]

Rules:
  - Target-project lifecycle .md files must have a basename of exactly 4 Chinese characters.
  - .vibe-docs.json is the source of document-role to file-path mappings.
  - Existing legacy projects may be scanned with --allow-legacy, but new generation must not use it.`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function parseArgs(argv) {
  const args = {
    root: null,
    requireExisting: false,
    allowLegacy: false,
  };

  for (const arg of argv) {
    if (arg === "--require-existing") {
      args.requireExisting = true;
      continue;
    }
    if (arg === "--allow-legacy") {
      args.allowLegacy = true;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    if (!args.root) {
      args.root = arg;
      continue;
    }
    console.error(`[FAIL] Unknown argument: ${arg}`);
    usage();
    process.exit(2);
  }

  if (!args.root) {
    usage();
    process.exit(2);
  }

  return args;
}

function readJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, "");
    return JSON.parse(content);
  } catch (error) {
    fail(`Could not parse ${REQUIRED_INDEX}: ${error.message}`);
    return null;
  }
}

function collectMarkdownPaths(value, output = []) {
  if (typeof value === "string") {
    if (value.endsWith(".md")) {
      output.push(value);
    }
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectMarkdownPaths(item, output);
    }
    return output;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectMarkdownPaths(item, output);
    }
  }

  return output;
}

function isInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function scanLegacyDocs(root, allowLegacy) {
  const legacyFound = [];
  for (const name of LEGACY_DOC_NAMES) {
    if (fs.existsSync(path.join(root, name))) {
      legacyFound.push(name);
    }
  }

  let plans;
  try {
    plans = inspectTargetDirectory(root, "plans");
  } catch (error) {
    fail(`Unsafe plans directory: ${error.message}`);
    return;
  }
  if (plans.exists) {
    for (const entry of fs.readdirSync(plans.path, { withFileTypes: true })) {
      if (entry.isFile() && /^phase-\d+\.md$/u.test(entry.name)) {
        legacyFound.push(`plans/${entry.name}`);
      }
      if (entry.isSymbolicLink()) fail(`Unsafe lifecycle path in plans/: ${entry.name}`);
    }
  }

  if (legacyFound.length > 0 && !allowLegacy) {
    fail(`Found legacy lifecycle doc names in target project: ${legacyFound.join(", ")}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);

  try {
    assertSafeTargetRoot(root);
  } catch (error) {
    fail(error.message);
    return;
  }

  let indexState;
  try {
    indexState = inspectTargetFile(root, REQUIRED_INDEX);
  } catch (error) {
    fail(`Unsafe ${REQUIRED_INDEX}: ${error.message}`);
    return;
  }
  if (!indexState.exists) {
    fail(`Missing ${REQUIRED_INDEX}. New target projects must register lifecycle docs before generation.`);
    return;
  }

  const manifest = readJson(indexState.path);
  if (!manifest) {
    return;
  }
  const manifestValidation = validateTargetDocManifest(manifest, { allowLegacy: true });
  for (const issue of manifestValidation.issues) fail(`Invalid ${REQUIRED_INDEX}: ${issue.code} at ${issue.at}: ${issue.message}`);
  if (!manifestValidation.ok) return;
  if (manifestValidation.migrationRequired) console.log(`[WARN] ${REQUIRED_INDEX} uses the legacy schema; run migrate-target-doc-system.mjs before enabling v2 strict gates.`);

  // 经验库已彻底移除：存量项目 .vibe-docs.json 可能仍残留 experience / lessons /
  // lessonsIndex 死键，它们不是生命周期文档，收集前先剥离，避免把旧经验入口误判为必须存在的文档。
  const manifestWithoutLegacyExperience = { ...manifest };
  delete manifestWithoutLegacyExperience.experience;
  delete manifestWithoutLegacyExperience.lessons;
  delete manifestWithoutLegacyExperience.lessonsIndex;
  const mappedPaths = collectMarkdownPaths(manifestWithoutLegacyExperience).map((pathValue) => ({ path: pathValue, requireExisting: true }));
  const uniquePaths = new Map();
  for (const item of mappedPaths) {
    const current = uniquePaths.get(item.path);
    uniquePaths.set(item.path, current ? { ...item, requireExisting: current.requireExisting || item.requireExisting } : item);
  }
  const markdownPaths = [...uniquePaths.values()];
  if (markdownPaths.length === 0) {
    fail(`${REQUIRED_INDEX} does not contain any Markdown document paths.`);
    return;
  }

  for (const mapped of markdownPaths) {
    const docPath = mapped.path;
    const normalizedDocPath = docPath.replace(/\\/g, "/");
    if (path.isAbsolute(normalizedDocPath)) {
      fail(`Lifecycle doc path must be project-relative, got absolute path: ${docPath}`);
      continue;
    }

    const absoluteDocPath = path.resolve(root, normalizedDocPath);
    if (!isInsideRoot(root, absoluteDocPath)) {
      fail(`Lifecycle doc path escapes target root: ${docPath}`);
      continue;
    }

    const baseName = path.basename(normalizedDocPath);
    if (!FOUR_CHINESE_MD.test(baseName) && !ALLOWED_NON_LIFECYCLE_MD.has(normalizedDocPath)) {
      fail(`Lifecycle doc basename must be exactly 4 Chinese characters plus .md: ${docPath}`);
    }

    try {
      const docState = inspectTargetFile(root, normalizedDocPath);
      if (args.requireExisting && mapped.requireExisting && !docState.exists) fail(`Mapped lifecycle doc does not exist: ${docPath}`);
    } catch (error) {
      fail(`Mapped lifecycle doc is unsafe: ${docPath} (${error.message})`);
    }
  }

  scanLegacyDocs(root, args.allowLegacy);

  if (!process.exitCode) {
    pass(`Validated ${markdownPaths.length} lifecycle Markdown document path(s).`);
  }
}

main();
