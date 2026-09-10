#!/usr/bin/env node
// DocMap:
// Layer: L3 / key script
// Module: tools
// Depends on: target document governance tools, API/UI/hotspot checkers, and target runtime registry
// Syncs with: README.md, DEV-PLAN.md, Product-Spec.md, TERMINOLOGY-AND-NAMING.md,
// docs/language-platform-profiles.md, tools/INDEX.md
// Unified health check for this skills package and generated target projects.

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PURE_PROFILE_EXCLUDED_PATHS } from "./verify-lite-package.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PACKAGE_ROOT = path.resolve(path.dirname(SCRIPT_DIR));
const RUNTIME_PACKAGE_ROOT = path.resolve(process.env.VIBE_CODING_SKILLS_HOME || SOURCE_PACKAGE_ROOT);
const TRUSTED_PACKAGE_ROOTS = Object.freeze([...new Set([SOURCE_PACKAGE_ROOT, RUNTIME_PACKAGE_ROOT])]);
const configuredCommandTimeout = Number.parseInt(process.env.VIBE_HEALTH_COMMAND_TIMEOUT_MS || "", 10);
const hasConfiguredCommandTimeout = Number.isInteger(configuredCommandTimeout) && configuredCommandTimeout > 0;
const COMMAND_TIMEOUT_MS = hasConfiguredCommandTimeout
  ? configuredCommandTimeout
  : 300_000;
const EXECUTION_TIER_GATE_TIMEOUT_MS = 600_000;
const DEFAULT_ROLES = ["productSpec", "devPlan", "currentExecution", "manualAcceptance", "interfaceContracts", "projectProfile", "constitutionDesign"];
const PACKAGE_DOCS = [
  "AGENTS.md",
  ".claude/CLAUDE.md",
  "CLAUDE.md",
  "DOC-MAP.md",
  "Product-Spec.md",
  "DEV-PLAN.md",
  "README.md",
  "TERMINOLOGY-AND-NAMING.md",
  "skills/INDEX.md",
  "tools/INDEX.md"
];
const HOT_PATH_DOCS = [".claude/CLAUDE.md", "AGENTS.md", "DOC-MAP.md", "README.md"];
const HOT_PATH_TOKEN_WARN = 6000; // 单文档警报阈值
const HOT_PATH_TOTAL_WARN = 22500; // 四份包级热路径文档的合计警报阈值；显式路由闸门规则属于必驻留硬规则
const PACKAGE_DIRS = [
  "skills",
  "agents",
  "hooks",
  "codex-hooks",
  "feedback",
  "plans",
  "tools",
  ".githooks",
  ".claude",
  ".agents",
  ".codex",
];
const PACKAGE_TOOLS = [
  "tools/check-target-doc-names.mjs",
  "tools/check-target-guardrails.mjs",
  "tools/check-target-constitution.mjs",
  "tools/check-target-doc-drift.mjs",
  "tools/check-target-doc-precommit.mjs",
  "tools/auto-sync-target-doc-index.mjs",
  "tools/check-lifecycle-doc-budget.mjs",
  "tools/archive-lifecycle-docs.mjs",
  "tools/build-target-doc-index.mjs",
  "tools/resolve-target-doc-context.mjs",
  "tools/markdown-governance-core.mjs",
  "tools/check-markdown-governance.mjs",
  "tools/target-doc-index-core.mjs",
  "tools/target-doc-manifest-schema.mjs",
  "tools/target-doc-manifest-core.mjs",
  "tools/target-doc-transaction.mjs",
  "tools/target-doc-migration-helpers.mjs",
  "tools/init-target-constitution.mjs",
  "tools/init-target-task-context.mjs",
  "tools/update-target-task-state.mjs",
  "tools/migrate-target-doc-system.mjs",
  "tools/check-api-contracts.mjs",
  "tools/check-ui-reuse.mjs",
  "tools/check-hotspots.mjs",
  "tools/architecture-foundation-policy.mjs",
  "tools/hotspot-policy.mjs", "tools/hotspot-git.mjs",
  "tools/check-routing-manifest.mjs",
  "tools/generate-routing-manifest.mjs",
  "tools/routing-session-gate.mjs",
  "tools/test-routing-session-gate.mjs",
  "tools/check-runtime-link-provenance.mjs",
  "tools/check-release-source-provenance.mjs",
  "tools/check-global-skill-overlap.ps1",
  "tools/init-target-runtime.mjs",
  "tools/mark-t2-check-clean.mjs",
  "tools/render-project-scaffold.sh",
  "tools/safe-target-fs.mjs",
  "tools/trusted-git.mjs",
  "tools/target-hook-config.mjs",
  "tools/verify-lite-package.mjs",
  "tools/doc-sync-helpers.sh",
  "tools/doc-sync-doc-helpers.sh",
  "tools/doc-sync-path-helpers.sh",
  "tools/doc-sync-state-helpers.sh",
  "tools/doc-sync-tier-helpers.sh",
  "tools/terminology-path-helpers.sh",
  "tools/test-api-contracts.mjs",
  "tools/test-api-contracts.sh",
  "tools/test-target-task-context.mjs",
  "tools/test-update-target-task-state.mjs",
  "tools/test-target-doc-transaction.mjs",
  "tools/test-plan-state-transitions.mjs",
  "tools/test-hotspots.mjs",
  "tools/test-hotspot-governor-behavior.mjs",
  "tools/test-hotspot-governor-human-scenarios.mjs",
  "tools/test-target-runtime.mjs",
  "tools/test-target-guardrails.mjs",
  "tools/test-target-constitution.mjs",
  "tools/test-target-doc-governance.mjs",
  "tools/test-target-doc-auto-sync.mjs",
  "tools/test-target-doc-migration.mjs",
  "tools/test-agent-tool-source-contract.mjs",
  "tools/test-design-brief-source-contract.mjs",
  "tools/test-target-lifecycle-path-contract.mjs",
  "tools/test-runtime-project-scaffold.sh",
  "tools/test-golden-path-examples.sh",
  "tools/test-build-lite-package.mjs",
  "tools/test-minimal-quality-gate.sh",
  "tools/test-path-security.mjs",
  "tools/test-render-project-scaffold-security.sh",
  "tools/test-scaffold-lockfiles.sh",
  "tools/test-sync-compat-safety.ps1",
  "tools/test-trusted-executables.mjs",
  "tools/test-vibe-health-check.mjs",
  "tools/vibe-health-check.mjs",
];
const PACKAGE_TEMPLATES = ["skills/dev-builder/templates/project-scaffolds/next-feature-first", "skills/dev-builder/templates/project-scaffolds/vite-feature-first", "skills/dev-builder/templates/project-scaffolds/electron-next-feature-first", "skills/dev-builder/templates/project-scaffolds/cli-feature-first"];
const PACKAGE_PROFILE_DOC = "docs/language-platform-profiles.md";
const PACKAGE_PROFILE_TERMS = ["platform profile", "language adapter", "architecture profile", "scaffold policy", "fallback stack"];
const PACKAGE_PROFILE_SECTIONS = ["## Platform Profiles", "## Language Adapters", "## Architecture Profiles", "## Fallback Stack", "## Scaffold Policy"];
const PACKAGE_PROFILE_SOURCES = ["Product-Spec.md", "DEV-PLAN.md", "TERMINOLOGY-AND-NAMING.md", "skills/INDEX.md"];
const PACKAGE_PROFILE_SCAN_ROOTS = ["AGENTS.md", ".claude/CLAUDE.md", "DOC-MAP.md", "README.md", "Product-Spec.md", "DEV-PLAN.md", "Product-Spec-CHANGELOG.md", "TERMINOLOGY-AND-NAMING.md", "docs", "skills", "tools"];
const PACKAGE_PROFILE_SCAN_IGNORE = [
  /^skills\/dev-builder\/templates\/project-scaffolds\//,
  /\.pen$/,
  /\.expanded\.pen$/
];
const PACKAGE_PROFILE_FORBIDDEN = [
  {
    label: "unqualified Web/Desktop/CLI scaffold scope",
    pattern: /新 Web \/ Desktop \/ CLI|Web \/ Desktop \/ CLI (脚手架|模板)/
  }
];
const SKIP_DIRS = new Set([".git", ".next", ".electron-dist", "coverage", "dist", "node_modules"]);
const FRONTEND_FILE = /\.(tsx|jsx|vue|svelte|html|css|scss)$/;
function parseArgs(argv) {
  const args = { root: ".", profile: "auto", level: "quick", strict: false, json: false, trustTargetTools: false };
  const rest = [...argv];
  while (rest.length > 0) {
    const item = rest.shift();
    if (item === "--profile") args.profile = rest.shift() || "";
    else if (item === "--level") args.level = rest.shift() || "";
    else if (item === "--strict") args.strict = true;
    else if (item === "--json") args.json = true;
    else if (item === "--trust-target-tools") args.trustTargetTools = true;
    else if (item === "--ci") args.strict = true;
    else if (item === "-h" || item === "--help") args.help = true;
    else if (!item.startsWith("-") && args.root === ".") args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node tools/vibe-health-check.mjs <root> --profile package|target|auto --level micro|quick|full [--strict] [--json] [--trust-target-tools]

Exit codes: 0 pass, 1 health check failed, 2 environment blocked`);
}

function norm(root, rel = "") {
  return path.resolve(root, rel);
}

function rel(root, abs) {
  return path.relative(root, abs).replaceAll(path.sep, "/") || ".";
}

function samePath(left, right) {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function add(results, status, id, message, detail = "") {
  results.push({ status, id, message, detail });
}

function exists(root, relPath) {
  return existsSync(norm(root, relPath));
}

function readJson(filePath) {
  try {
    return { value: JSON.parse(readFileSync(filePath, "utf8")) };
  } catch (error) {
    return { error };
  }
}

function detectPackageProfile(root) {
  const manifestPath = norm(root, "MANIFEST.json");
  if (!existsSync(manifestPath)) return "safe-lite";
  const parsed = readJson(manifestPath);
  return parsed.value?.profile === "pure" ? "pure" : "safe-lite";
}

const commandCache = new Map();

function findOnPath(command, extensions) {
  const names = path.extname(command) ? [command] : extensions.map((extension) => `${command}${extension}`);
  for (const directory of (process.env.PATH || "").split(path.delimiter).filter(Boolean)) {
    const normalizedDirectory = directory.replace(/^"|"$/g, "");
    const match = names.map((name) => path.join(normalizedDirectory, name)).find((candidate) => existsSync(candidate));
    if (match) return match;
  }
  return "";
}

function commandSpec(command) {
  if (commandCache.has(command)) return commandCache.get(command);

  let spec = null;
  if (command === "node") {
    spec = { file: process.execPath, prefix: [] };
  } else if (command === "npm") {
    const candidates = [
      process.env.npm_execpath,
      path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
      path.join(path.dirname(path.dirname(process.execPath)), "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    ].filter(Boolean);
    const npmCli = candidates.find((candidate) => existsSync(candidate));
    if (npmCli) spec = { file: process.execPath, prefix: [npmCli] };
  } else if (command === "bash" && process.platform === "win32") {
    const gitExecutable = findOnPath("git", [".exe", ".com", ""]);
    const gitBinDirectory = gitExecutable ? path.dirname(gitExecutable) : "";
    const gitBinParent = gitBinDirectory ? path.dirname(gitBinDirectory) : "";
    const gitBinName = path.basename(gitBinDirectory).toLowerCase();
    const gitBinParentName = path.basename(gitBinParent).toLowerCase();
    const gitRoot = ["mingw64", "usr"].includes(gitBinParentName)
      ? path.dirname(gitBinParent)
      : ["bin", "cmd"].includes(gitBinName)
        ? gitBinParent
        : "";
    const candidates = [
      gitRoot && path.join(gitRoot, "bin", "bash.exe"),
      gitRoot && path.join(gitRoot, "usr", "bin", "bash.exe"),
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Git", "bin", "bash.exe"),
      process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Git", "bin", "bash.exe"),
    ].filter(Boolean);
    const gitBash = candidates.find((candidate) => existsSync(candidate));
    if (gitBash) spec = { file: gitBash, prefix: [] };
  } else {
    const executable = findOnPath(command, process.platform === "win32" ? [".exe", ".com", ""] : [""]);
    if (executable) {
      spec = { file: executable, prefix: [] };
    }
  }

  commandCache.set(command, spec);
  return spec;
}

function run(command, args, options = {}) {
  const spec = commandSpec(command);
  if (!spec) {
    return { status: null, error: new Error(`Executable not found: ${command}`), stdout: "", stderr: "" };
  }
  const timeout = options.timeout ?? COMMAND_TIMEOUT_MS;
  const result = spawnSync(spec.file, [...spec.prefix, ...args], {
    cwd: options.cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    stdio: options.quiet ? "pipe" : "inherit",
    timeout,
  });
  if (result.error?.code === "ETIMEDOUT") {
    return {
      ...result,
      stderr: result.stderr || `Command timed out after ${timeout}ms: ${command} ${args.join(" ")}`,
    };
  }
  return result;
}

function hasScript(pkg, name) {
  return Boolean(pkg?.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, name));
}

function listFiles(root, dirRel) {
  const start = norm(root, dirRel);
  if (!existsSync(start)) return [];
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) walk(absolute);
      else if (entry.isFile()) files.push(rel(root, absolute));
    }
  };
  walk(start);
  return files.sort();
}

function listTreeEntries(root, dirRel) {
  const start = norm(root, dirRel);
  const files = [];
  const unsafe = [];
  let startStat;
  try {
    startStat = lstatSync(start);
  } catch (error) {
    if (error?.code === "ENOENT") return { files, unsafe };
    throw error;
  }

  if (startStat.isSymbolicLink() || !startStat.isDirectory()) {
    unsafe.push(rel(root, start));
    return { files, unsafe };
  }

  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const entryStat = lstatSync(absolute);
      const relativePath = rel(root, absolute);
      if (entryStat.isSymbolicLink()) {
        unsafe.push(relativePath);
      } else if (entryStat.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(absolute);
      } else if (entryStat.isFile()) {
        files.push(relativePath);
      } else {
        unsafe.push(relativePath);
      }
    }
  };
  walk(start);
  return { files: files.sort(), unsafe: unsafe.sort() };
}

function isAtOrBelow(relPath, ancestor) {
  return relPath === ancestor || relPath.startsWith(`${ancestor}/`);
}

function isBlockedByUnsafeEntry(relPath, unsafeEntries) {
  return unsafeEntries.some((entry) => isAtOrBelow(relPath, entry));
}

function lstatIfPresent(filePath) {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function listExistingPackageProfileScanFiles(root) {
  const files = [];
  for (const item of PACKAGE_PROFILE_SCAN_ROOTS) {
    const absolute = norm(root, item);
    if (!existsSync(absolute)) continue;
    if (statSync(absolute).isFile()) files.push(item);
    else files.push(...listFiles(root, item));
  }
  return [...new Set(files)]
    .map((item) => item.replaceAll(path.sep, "/"))
    .filter((item) => !PACKAGE_PROFILE_SCAN_IGNORE.some((pattern) => pattern.test(item)))
    .sort();
}

function findSiblingTool(root, toolName, trustTargetTools = false) {
  const local = norm(root, `tools/${toolName}`);
  const trustedRoot = process.env.VIBE_CODING_SKILLS_HOME
    ? path.resolve(process.env.VIBE_CODING_SKILLS_HOME, "tools")
    : SCRIPT_DIR;
  const sibling = path.join(trustedRoot, toolName);
  if (trustTargetTools && existsSync(local)) return local;
  if (existsSync(sibling)) return sibling;
  if (trustTargetTools && existsSync(local)) return local;
  return "";
}

function detectProfile(root) {
  const packageMarkers = ["AGENTS.md", "Product-Spec.md", "skills", "tools"];
  if (packageMarkers.every((item) => exists(root, item))) return "package";
  if (exists(root, ".vibe-docs.json")) return "target";
  console.warn("[WARN] auto-detect: no package or target markers found, defaulting to target profile");
  return "target";
}

function commandReady(command) {
  const result = run(command, ["--version"], { quiet: true });
  return result.status === 0;
}

function summarizeHotspots(stdout) {
  try {
    const report = JSON.parse(stdout);
    const summary = report.summary || {};
    return {
      ok: true,
      findings: summary.totalFindings || 0,
      detail: `findings=${summary.totalFindings || 0}, blockers=${summary.blockers || 0}, hotspots=${summary.hotspots || 0}, warnings=${summary.warnings || 0}`,
    };
  } catch (error) {
    return { ok: false, findings: 0, detail: stdout || error.message };
  }
}

function summarizeGuardrails(stdout) {
  try {
    const report = JSON.parse(stdout);
    const summary = report.summary || {};
    return {
      ok: true,
      blockers: summary.blockers || 0,
      warnings: summary.warnings || 0,
      detail: `blockers=${summary.blockers || 0}, warnings=${summary.warnings || 0}`,
    };
  } catch (error) {
    return { ok: false, blockers: 0, warnings: 0, detail: stdout || error.message };
  }
}

function summarizeConstitution(stdout) {
  try {
    const report = JSON.parse(stdout);
    const summary = report.summary || {};
    return {
      ok: true,
      blockers: summary.blockers || 0,
      warnings: summary.warnings || 0,
      detail: `blockers=${summary.blockers || 0}, warnings=${summary.warnings || 0}, unverified=${(report.unverifiedCapabilities || []).join(",") || "none"}`,
    };
  } catch (error) {
    return { ok: false, blockers: 0, warnings: 0, detail: stdout || error.message };
  }
}

function findConstitutionSkillsRoot(root) {
  if (process.env.VIBE_CODING_SKILLS_HOME) return process.env.VIBE_CODING_SKILLS_HOME;
  if (exists(root, "tools/init-target-runtime.mjs")) return root;
  return path.dirname(SCRIPT_DIR);
}

function compareTree(results, root, sourceRel, mirrorRel, { excludeNames = [] } = {}) {
  if (!lstatIfPresent(norm(root, sourceRel)) || !lstatIfPresent(norm(root, mirrorRel))) return;
  const excluded = new Set(excludeNames.map((name) => name.toLowerCase()));
  const sourceTree = listTreeEntries(root, sourceRel);
  const mirrorTree = listTreeEntries(root, mirrorRel);
  for (const entry of sourceTree.unsafe) {
    add(results, "fail", "mirror-sync", `Source tree contains symlink or non-regular entry: ${entry}`);
  }
  for (const entry of mirrorTree.unsafe) {
    add(results, "fail", "mirror-sync", `Mirror tree contains symlink or non-regular entry: ${entry}`);
  }

  const sourceFiles = sourceTree.files.filter(
    (file) => !excluded.has(path.basename(file).toLowerCase()),
  );
  const mirrorFiles = new Set(mirrorTree.files);
  const expectedMirrorFiles = new Set(sourceFiles.map((file) => `${mirrorRel}/${file.slice(sourceRel.length + 1)}`));
  for (const sourceFile of sourceFiles) {
    const mirrorFile = `${mirrorRel}/${sourceFile.slice(sourceRel.length + 1)}`;
    if (isBlockedByUnsafeEntry(mirrorFile, mirrorTree.unsafe)) continue;
    if (!mirrorFiles.has(mirrorFile)) {
      add(results, "fail", "mirror-sync", `Mirror file missing: ${mirrorFile}`, `source=${sourceFile}`);
      continue;
    }
    const left = readFileSync(norm(root, sourceFile));
    const right = readFileSync(norm(root, mirrorFile));
    if (!left.equals(right)) add(results, "fail", "mirror-sync", `Mirror file differs: ${mirrorFile}`, `source=${sourceFile}`);
  }
  for (const mirrorFile of mirrorTree.files) {
    if (!expectedMirrorFiles.has(mirrorFile)) add(results, "fail", "mirror-sync", `Mirror file has no source: ${mirrorFile}`);
  }
}

function compareFile(results, root, sourceRel, mirrorRel) {
  const sourceStat = lstatIfPresent(norm(root, sourceRel));
  const mirrorStat = lstatIfPresent(norm(root, mirrorRel));
  if (!sourceStat || !mirrorStat) {
    if (Boolean(sourceStat) !== Boolean(mirrorStat)) {
      add(results, "fail", "mirror-sync", `Mirror mapping incomplete: ${mirrorRel}`, `source=${sourceRel}`);
    }
    return;
  }
  if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
    add(results, "fail", "mirror-sync", `Source mapping is a symlink or non-regular file: ${sourceRel}`);
    return;
  }
  if (mirrorStat.isSymbolicLink() || !mirrorStat.isFile()) {
    add(results, "fail", "mirror-sync", `Mirror mapping is a symlink or non-regular file: ${mirrorRel}`, `source=${sourceRel}`);
    return;
  }
  const left = readFileSync(norm(root, sourceRel));
  const right = readFileSync(norm(root, mirrorRel));
  if (!left.equals(right)) add(results, "fail", "mirror-sync", `Mirror file differs: ${mirrorRel}`, `source=${sourceRel}`);
}

function tomlBasicString(value = "") {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\r", "").replaceAll("\n", "\\n")}"`;
}

function tomlMultilineBasicString(value = "") {
  const normalized = String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const escaped = normalized.replaceAll("\\", "\\\\").replaceAll('"""', '\\"\\"\\"').replace(/\n+$/g, "");
  return `"""\n${escaped}\n"""`;
}

function frontmatterField(frontmatter, fieldName, sourceRel) {
  const pattern = new RegExp(`^${fieldName}:\\s*(.+?)\\s*$`, "m");
  const match = frontmatter.match(pattern);
  if (!match) throw new Error(`Missing frontmatter field '${fieldName}' in ${sourceRel}`);
  let value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

function convertAgentMarkdownToCodexToml(content, sourceRel) {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`Agent file must start with YAML frontmatter: ${sourceRel}`);
  const frontmatter = match[1];
  const body = match[2].replace(/^[\r\n]+/, "");
  const name = frontmatterField(frontmatter, "name", sourceRel);
  const description = frontmatterField(frontmatter, "description", sourceRel);
  return [
    `name = ${tomlBasicString(name)}`,
    `description = ${tomlBasicString(description)}`,
    `developer_instructions = ${tomlMultilineBasicString(body)}`,
    ""
  ].join("\n");
}

function compareCodexAgentMirror(results, root) {
  if (!lstatIfPresent(norm(root, "agents")) || !lstatIfPresent(norm(root, ".codex/agents"))) return;
  const sourceTree = listTreeEntries(root, "agents");
  const mirrorTree = listTreeEntries(root, ".codex/agents");
  for (const entry of sourceTree.unsafe) {
    add(results, "fail", "codex-agent-mirror", `Agent source contains symlink or non-regular entry: ${entry}`);
  }
  for (const entry of mirrorTree.unsafe) {
    add(results, "fail", "codex-agent-mirror", `Codex agent mirror contains symlink or non-regular entry: ${entry}`);
  }

  const sourceFiles = sourceTree.files.filter((file) => file.endsWith(".md") && path.basename(file) !== "INDEX.md");
  const mirrorFiles = new Set(mirrorTree.files);
  const expectedMirrorFiles = new Set(sourceFiles.map((file) => `.codex/agents/${path.basename(file, ".md")}.toml`));

  for (const sourceFile of sourceFiles) {
    const mirrorFile = `.codex/agents/${path.basename(sourceFile, ".md")}.toml`;
    if (isBlockedByUnsafeEntry(mirrorFile, mirrorTree.unsafe)) continue;
    if (!mirrorFiles.has(mirrorFile)) {
      add(results, "fail", "codex-agent-mirror", `Codex agent mirror missing: ${mirrorFile}`, `source=${sourceFile}`);
      continue;
    }

    try {
      const expected = convertAgentMarkdownToCodexToml(readFileSync(norm(root, sourceFile), "utf8"), sourceFile);
      const actual = readFileSync(norm(root, mirrorFile), "utf8").replace(/\r\n/g, "\n");
      if (actual !== expected) add(results, "fail", "codex-agent-mirror", `Codex agent mirror differs: ${mirrorFile}`, `source=${sourceFile}`);
    } catch (error) {
      add(results, "fail", "codex-agent-mirror", `Codex agent mirror check failed: ${sourceFile}`, error.message);
    }
  }

  for (const mirrorFile of mirrorTree.files.filter((file) => file.endsWith(".toml"))) {
    if (!expectedMirrorFiles.has(mirrorFile)) add(results, "fail", "codex-agent-mirror", `Codex agent mirror has no source: ${mirrorFile}`);
  }
}

function checkPackage(root, level, trustRootTools = false) {
  const results = [];
  const packageProfile = detectPackageProfile(root);
  const packageMicroFiles = [
    ...PACKAGE_DOCS,
    PACKAGE_PROFILE_DOC,
    "package.json",
    "settings.json",
    "codex-hooks.json",
    "agents/INDEX.md",
    "hooks/INDEX.md",
    "codex-hooks/INDEX.md"
  ].filter((item) => packageProfile !== "pure" || !PURE_PROFILE_EXCLUDED_PATHS.includes(item));

  for (const item of packageMicroFiles) add(results, exists(root, item) ? "pass" : "fail", "package-file", item);
  for (const item of PACKAGE_DIRS) add(results, exists(root, item) ? "pass" : "fail", "package-dir", item);
  for (const item of PACKAGE_TOOLS) add(results, exists(root, item) ? "pass" : "fail", "package-tool", item);
  for (const item of PACKAGE_TEMPLATES) add(results, exists(root, item) ? "pass" : "fail", "package-template", item);
  if (level === "micro") return results;

  if (exists(root, PACKAGE_PROFILE_DOC)) {
    const profileDoc = readFileSync(norm(root, PACKAGE_PROFILE_DOC), "utf8");
    for (const term of PACKAGE_PROFILE_TERMS) {
      add(results, profileDoc.includes(term) ? "pass" : "fail", "package-profile-policy", `${PACKAGE_PROFILE_DOC} contains ${term}`);
    }
    for (const section of PACKAGE_PROFILE_SECTIONS) {
      add(results, profileDoc.includes(section) ? "pass" : "fail", "package-profile-policy", `${PACKAGE_PROFILE_DOC} contains section ${section}`);
    }
  }
  for (const source of PACKAGE_PROFILE_SOURCES) {
    if (!exists(root, source)) continue;
    const content = readFileSync(norm(root, source), "utf8");
    const hasPolicy = PACKAGE_PROFILE_TERMS.every((term) => content.includes(term));
    add(results, hasPolicy ? "pass" : "fail", "package-profile-policy", `${source} mentions profile policy terms`);
  }
  const profileBiasMatches = [];
  for (const source of listExistingPackageProfileScanFiles(root)) {
    const content = readFileSync(norm(root, source), "utf8");
    for (const rule of PACKAGE_PROFILE_FORBIDDEN) {
      const match = content.match(rule.pattern);
      if (match) profileBiasMatches.push({ source, rule, match: match[0] });
    }
  }
  if (profileBiasMatches.length === 0) {
    add(results, "pass", "package-profile-bias", "No forbidden unqualified profile bias phrases found");
  } else {
    for (const item of profileBiasMatches) {
      add(results, "fail", "package-profile-bias", `${item.source} contains ${item.rule.label}`, `matched=${item.match}`);
    }
  }

  // 热路径文档膨胀检测
  {
    let hotTotal = 0;
    for (const docRel of HOT_PATH_DOCS) {
      const docPath = norm(root, docRel);
      if (!existsSync(docPath)) continue;
      const content = readFileSync(docPath, "utf8");
      const cjk = (content.match(/[　-鿿豈-﫿＀-￯]/g) || []).length;
      const tokens = Math.ceil(cjk + (content.length - cjk) / 4);
      hotTotal += tokens;
      if (tokens > HOT_PATH_TOKEN_WARN) {
        add(results, "warn", "package-doc-budget", `${docRel} ~${tokens} tokens 超过热路径单文档上限 ${HOT_PATH_TOKEN_WARN}`);
      }
    }
    if (hotTotal > HOT_PATH_TOTAL_WARN) {
      add(results, "warn", "package-doc-budget", `热路径文档合计 ~${hotTotal} tokens 超过上限 ${HOT_PATH_TOTAL_WARN}`);
    }
  }

  compareTree(results, root, "skills", ".agents/skills");
  compareTree(results, root, "skills", ".claude/skills");
  compareTree(results, root, "agents", ".claude/agents", { excludeNames: ["INDEX.md"] });
  compareCodexAgentMirror(results, root);
  compareTree(results, root, "hooks", ".claude/hooks");
  compareTree(results, root, "feedback/templates", ".claude/feedback/templates");
  compareTree(results, root, "codex-hooks", ".codex/hooks");
  compareFile(results, root, "EVOLUTION.md", ".claude/EVOLUTION.md");
  compareFile(results, root, "settings.json", ".claude/settings.json");
  compareFile(results, root, "codex-hooks.json", ".codex/hooks.json");

  if (!trustRootTools && !TRUSTED_PACKAGE_ROOTS.some((trustedRoot) => samePath(root, trustedRoot))) {
    add(
      results,
      "fail",
      "package-trust",
      "Refusing to execute package-local gates from an untrusted root",
      `trusted=${TRUSTED_PACKAGE_ROOTS.join(",")}`,
    );
    return results;
  }

  if (!commandReady("node")) add(results, "block", "env-node", "node is required");
  else {
    for (const file of listFiles(root, "tools").filter((item) => item.endsWith(".mjs"))) {
      const check = run("node", ["--check", norm(root, file)], { cwd: root, quiet: true });
      add(results, check.status === 0 ? "pass" : "fail", "node-check", file, check.stderr || check.stdout || "");
    }

    const routingManifestChecker = "tools/check-routing-manifest.mjs";
    if (!exists(root, routingManifestChecker)) {
      add(results, "fail", "package-routing-manifest", "Missing tools/check-routing-manifest.mjs");
    } else {
      const routingManifestCheck = run("node", [norm(root, routingManifestChecker), root, "--json"], { cwd: root, quiet: true });
      add(
        results,
        routingManifestCheck.status === 0 ? "pass" : "fail",
        "package-routing-manifest",
        "skills/ROUTING-MANIFEST.json is fresh",
        routingManifestCheck.stderr || routingManifestCheck.stdout || "",
      );
    }
  }

  if (level === "full") {
    const sourceOnlyPureGates = new Set([
      "tools/test-external-skill-boundaries.mjs",
      "tools/test-spec-driven-gates.mjs",
      "tools/test-architecture-foundation.mjs",
      "tools/test-review-policy.mjs",
    ]);
    const nodeGates = [
      { script: "tools/test-api-contracts.mjs" },
      { script: "tools/test-target-task-context.mjs" },
      { script: "tools/test-hotspots.mjs" },
      { script: "tools/test-hotspot-governor-behavior.mjs" },
      { script: "tools/test-hotspot-governor-human-scenarios.mjs" },
      { script: "tools/test-target-constitution.mjs" },
      { script: "tools/test-target-guardrails.mjs" },
      { script: "tools/test-target-runtime.mjs" },
      { script: "tools/test-target-doc-governance.mjs" },
      { script: "tools/test-target-doc-migration.mjs" },
      { script: "tools/test-routing-manifest.mjs" },
      { script: "tools/test-routing-keywords.mjs" },
      { script: "tools/test-routing-session-gate.mjs" },
      { script: "tools/test-external-skill-boundaries.mjs" },
      { script: "tools/test-spec-driven-gates.mjs" },
      { script: "tools/test-agent-tool-source-contract.mjs" },
      { script: "tools/test-design-brief-source-contract.mjs" },
      { script: "tools/test-target-lifecycle-path-contract.mjs" },
      { script: "tools/test-architecture-foundation.mjs" },
      { script: "tools/test-review-policy.mjs" },
      { script: "tools/test-strict-tdd-policy.mjs" },
      { script: "tools/test-strict-tdd-human-scenarios.mjs" },
      { script: "tools/test-skill-token-budget.mjs" },
      { script: "tools/check-skill-token-budget.mjs", args: [root, "--strict"] },
      { script: "tools/test-vibe-health-check.mjs", args: [] },
      { script: "tools/test-build-lite-package.mjs", args: [] },
    ].filter((gateSpec) => packageProfile !== "pure" || !sourceOnlyPureGates.has(gateSpec.script));
    for (const gateSpec of nodeGates) {
      const script = gateSpec.script;
      const gateArgs = gateSpec.args || [];
      const gate = run("node", [norm(root, script), ...gateArgs], { cwd: root, quiet: true });
      add(results, gate.status === 0 ? "pass" : "fail", "package-full-node-gate", script, gate.stderr || gate.stdout || "");
    }

    if (!commandReady("bash")) add(results, "block", "env-bash", "bash is required for full package gates");
    else {
      const scripts = [
        "tools/test-target-doc-names.sh",
        "tools/test-execution-tier-gates.sh",
        "tools/test-structural-gate.sh",
        "tools/test-terminology-consistency.sh",
        "tools/test-terminology-gate.sh",
        "tools/test-minimal-quality-gate.sh"
      ];
      for (const script of scripts) {
        const timeout = !hasConfiguredCommandTimeout && script === "tools/test-execution-tier-gates.sh"
          ? EXECUTION_TIER_GATE_TIMEOUT_MS
          : COMMAND_TIMEOUT_MS;
        const gate = run("bash", [norm(root, script)], { cwd: root, quiet: true, timeout });
        add(results, gate.status === 0 ? "pass" : "fail", "package-full-gate", script, gate.stderr || gate.stdout || "");
      }
    }
  }

  return results;
}

function targetHasFrontend(root) {
  const dirs = ["src", "app", "pages"];
  return dirs.some((dir) => exists(root, dir)) && listFiles(root, ".").some((file) => FRONTEND_FILE.test(file));
}

function checkTarget(root, level, strict = false, trustTargetTools = false) {
  const results = [];
  const manifestPath = norm(root, ".vibe-docs.json");
  const parsedManifest = existsSync(manifestPath) ? readJson(manifestPath) : null;

  if (!existsSync(manifestPath)) {
    add(results, "fail", "target-docs", "Missing .vibe-docs.json");
  } else {
    add(results, "pass", "target-docs", ".vibe-docs.json exists");
    if (parsedManifest.error) add(results, "fail", "target-docs", "Invalid .vibe-docs.json", parsedManifest.error.message);
    else {
      for (const role of DEFAULT_ROLES) {
        const mapped = parsedManifest.value[role];
        const ok = typeof mapped === "string" && exists(root, mapped);
        add(results, ok ? "pass" : "fail", "target-doc-role", `${role}: ${mapped || "<missing>"}`);
      }
    }
  }

  const pkgPath = norm(root, "package.json");
  let pkg = null;
  if (!existsSync(pkgPath)) {
    add(results, "warn", "target-package", "package.json not found");
  } else {
    const parsedPackage = readJson(pkgPath);
    if (parsedPackage.error) {
      add(results, "fail", "target-package", "Invalid package.json", parsedPackage.error.message);
    } else {
      pkg = parsedPackage.value;
    add(results, hasScript(pkg, "check:health") ? "pass" : "warn", "target-script", "check:health");
    add(results, hasScript(pkg, "build") ? "pass" : "fail", "target-script", "build");
    add(results, hasScript(pkg, "test") || hasScript(pkg, "smoke") ? "pass" : "warn", "target-script", "test or smoke");
    }
  }

  if (level === "micro") {
    const v2Docs = parsedManifest?.value?.schemaVersion === 2;
    if (!v2Docs && parsedManifest?.value) {
      add(results, "warn", "target-doc-migration", "Legacy .vibe-docs.json; preview schema v2 migration before enabling strict document gates");
    } else if (v2Docs) {
      const driftChecker = findSiblingTool(root, "check-target-doc-drift.mjs", trustTargetTools);
      if (!driftChecker) add(results, "fail", "target-doc-drift", "Missing tools/check-target-doc-drift.mjs");
      else {
        const driftArgs = [driftChecker, root, "--micro", "--json"];
        if (strict) driftArgs.push("--strict");
        const driftGate = run("node", driftArgs, { cwd: root, quiet: true });
        add(results, driftGate.status === 0 ? "pass" : "fail", "target-doc-drift", "micro document drift gate", driftGate.stderr || driftGate.stdout || "");
      }
    }
    return results;
  }

  const docChecker = findSiblingTool(root, "check-target-doc-names.mjs", trustTargetTools);
  if (!docChecker) add(results, "fail", "target-doc-names", "Missing tools/check-target-doc-names.mjs");
  else {
    const docGate = run("node", [docChecker, root, "--require-existing"], { cwd: root, quiet: true });
    add(results, docGate.status === 0 ? "pass" : "fail", "target-doc-names", "four-character lifecycle docs", docGate.stderr || docGate.stdout || "");
  }

  const constitutionChecker = findSiblingTool(root, "check-target-constitution.mjs", trustTargetTools);
  if (!constitutionChecker) {
    add(results, "fail", "target-constitution", "Missing tools/check-target-constitution.mjs");
  } else {
    const constitutionArgs = [constitutionChecker, root, "--skills-root", findConstitutionSkillsRoot(root), "--json"];
    if (strict) constitutionArgs.push("--strict");
    const constitutionGate = run("node", constitutionArgs, { cwd: root, quiet: true });
    if (constitutionGate.status !== 0) {
      add(results, "fail", "target-constitution", "check-target-constitution failed", constitutionGate.stderr || constitutionGate.stdout || "");
    } else {
      const constitutionSummary = summarizeConstitution(constitutionGate.stdout);
      add(
        results,
        constitutionSummary.ok && constitutionSummary.blockers === 0 && constitutionSummary.warnings === 0 ? "pass" : "warn",
        "target-constitution",
        "check-target-constitution",
        constitutionSummary.detail,
      );
    }
  }

  const guardrailChecker = findSiblingTool(root, "check-target-guardrails.mjs", trustTargetTools);
  if (!guardrailChecker) {
    add(results, "fail", "target-guardrails", "Missing tools/check-target-guardrails.mjs");
  } else {
    const guardrailArgs = [guardrailChecker, root, "--json"];
    if (strict) guardrailArgs.push("--strict");
    const guardrailGate = run("node", guardrailArgs, { cwd: root, quiet: true });
    if (guardrailGate.status !== 0) {
      add(results, "fail", "target-guardrails", "check-target-guardrails failed", guardrailGate.stderr || guardrailGate.stdout || "");
    } else {
      const guardrailSummary = summarizeGuardrails(guardrailGate.stdout);
      add(
        results,
        guardrailSummary.ok && guardrailSummary.blockers === 0 && guardrailSummary.warnings === 0 ? "pass" : "warn",
        "target-guardrails",
        "check-target-guardrails",
        guardrailSummary.detail,
      );
    }
  }

  const docBudgetChecker = findSiblingTool(root, "check-lifecycle-doc-budget.mjs", trustTargetTools);
  if (!docBudgetChecker) {
    add(results, "warn", "target-doc-budget", "Missing tools/check-lifecycle-doc-budget.mjs");
  } else {
    const docBudgetGate = run("node", [docBudgetChecker, root, "--strict"], { cwd: root, quiet: true });
    const v2Docs = parsedManifest?.value?.schemaVersion === 2;
    add(results, docBudgetGate.status === 0 ? "pass" : v2Docs ? "fail" : "warn", "target-doc-budget", "lifecycle doc token budget", docBudgetGate.stderr || docBudgetGate.stdout || "");
  }

  const v2Docs = parsedManifest?.value?.schemaVersion === 2;
  if (!v2Docs && parsedManifest?.value) {
    add(results, "warn", "target-doc-migration", "Legacy .vibe-docs.json; preview schema v2 migration before enabling strict document gates");
  }
  if (v2Docs) {
    const indexChecker = findSiblingTool(root, "build-target-doc-index.mjs", trustTargetTools);
    if (!indexChecker) add(results, "fail", "target-doc-index", "Missing tools/build-target-doc-index.mjs");
    else {
      const indexGate = run("node", [indexChecker, root, "--check", "--json"], { cwd: root, quiet: true });
      add(results, indexGate.status === 0 ? "pass" : "fail", "target-doc-index", "document index freshness", indexGate.stderr || indexGate.stdout || "");
    }

    const driftChecker = findSiblingTool(root, "check-target-doc-drift.mjs", trustTargetTools);
    if (!driftChecker) add(results, "fail", "target-doc-drift", "Missing tools/check-target-doc-drift.mjs");
    else {
      const driftLevel = level === "full" ? "--full" : "--quick";
      const driftGate = run("node", [driftChecker, root, driftLevel, "--strict", "--json"], { cwd: root, quiet: true });
      add(results, driftGate.status === 0 ? "pass" : "fail", "target-doc-drift", `${driftLevel.slice(2)} document drift gate`, driftGate.stderr || driftGate.stdout || "");
    }
  }

  if (!exists(root, ".vibe-runtime.json")) {
    add(results, "warn", "target-runtime-registry", "Missing .vibe-runtime.json");
  } else {
    const registry = readJson(norm(root, ".vibe-runtime.json"));
    const blocks = registry.value?.runtimeBlocks || {};
    const requiredBlocks = ["AGENTS.md", "CLAUDE.md"];
    const missingBlocks = requiredBlocks.filter((file) => !blocks[file]);
    const malformedBlocks = requiredBlocks.filter((file) => {
      const block = blocks[file];
      return block && (block.kind !== "target-runtime" || typeof block.version !== "string" || !/^[a-f0-9]{64}$/u.test(block.checksum || ""));
    });
    if (registry.error) add(results, "fail", "target-runtime-registry", "Invalid .vibe-runtime.json", registry.error.message);
    else if (registry.value?.schemaVersion !== 1 || registry.value?.generatedBy !== "vibe-coding-skills") {
      add(results, "fail", "target-runtime-registry", ".vibe-runtime.json has invalid schema header");
    } else if (missingBlocks.length > 0 || malformedBlocks.length > 0) {
      add(results, "fail", "target-runtime-registry", ".vibe-runtime.json has invalid runtime blocks", `missing=${missingBlocks.join(",") || "none"} malformed=${malformedBlocks.join(",") || "none"}`);
    } else {
      add(results, "pass", "target-runtime-registry", ".vibe-runtime.json schema current");
    }
  }

  const apiContractChecker = findSiblingTool(root, "check-api-contracts.mjs", trustTargetTools);
  if (!apiContractChecker) add(results, "fail", "target-api-contracts", "Missing tools/check-api-contracts.mjs");
  else {
    const apiContractGate = run("node", [apiContractChecker, root], { cwd: root, quiet: true });
    add(results, apiContractGate.status === 0 ? "pass" : "fail", "target-api-contracts", "check-api-contracts", apiContractGate.stderr || apiContractGate.stdout || "");
  }

  const hotspotChecker = findSiblingTool(root, "check-hotspots.mjs", trustTargetTools);
  if (!hotspotChecker) {
    add(results, "warn", "target-hotspots", "Missing tools/check-hotspots.mjs");
  } else {
    const hotspotGate = run("node", [hotspotChecker, root, "--json"], { cwd: root, quiet: true });
    if (hotspotGate.status !== 0) {
      add(results, "fail", "target-hotspots", "check-hotspots failed", hotspotGate.stderr || hotspotGate.stdout || "");
    } else {
      const hotspotSummary = summarizeHotspots(hotspotGate.stdout);
      add(
        results,
        hotspotSummary.ok && hotspotSummary.findings === 0 ? "pass" : "warn",
        "target-hotspots",
        "check-hotspots",
        hotspotSummary.detail,
      );
    }
  }

  if (targetHasFrontend(root)) {
    const uiChecker = findSiblingTool(root, "check-ui-reuse.mjs", trustTargetTools);
    if (!uiChecker) add(results, "fail", "target-ui-reuse", "Missing tools/check-ui-reuse.mjs");
    else {
      const uiGate = run("node", [uiChecker, root, "--all"], { cwd: root, quiet: true });
      add(results, uiGate.status === 0 ? "pass" : "fail", "target-ui-reuse", "check-ui-reuse", uiGate.stderr || uiGate.stdout || "");
    }
  } else {
    add(results, "pass", "target-ui-reuse", "No frontend UI files detected");
  }

  if (level === "full" && pkg) {
    const targetScripts = ["build", "test", "smoke"].filter((name) => hasScript(pkg, name));
    if (!trustTargetTools) {
      for (const script of targetScripts) {
        add(
          results,
          "warn",
          "target-full-script",
          script,
          "Skipped untrusted package.json script; pass --trust-target-tools to execute target-owned scripts.",
        );
      }
    } else if (targetScripts.length > 0 && !commandReady("npm")) {
      add(results, "block", "env-npm", "npm is required for trusted full target checks");
    } else {
      for (const script of targetScripts) {
        const result = run("npm", script === "test" ? ["test"] : ["run", script], { cwd: root, quiet: true });
        add(results, result.status === 0 ? "pass" : "fail", "target-full-script", script, result.stderr || result.stdout || "");
      }
    }
  }

  return results;
}

function summarize(results, strict) {
  const blocked = results.some((item) => item.status === "block");
  const failed = results.some((item) => item.status === "fail");
  const warned = results.some((item) => item.status === "warn");
  const exitCode = blocked ? 2 : failed || (strict && warned) ? 1 : 0;
  return { blocked, failed, warned, exitCode };
}

function printText(profile, root, results, summary) {
  console.log(`Vibe health check: profile=${profile} root=${root}`);
  for (const item of results) {
    const mark = item.status.toUpperCase().padEnd(5);
    console.log(`[${mark}] ${item.id}: ${item.message}`);
    if (item.detail && item.status !== "pass") console.log(item.detail.trim());
  }
  console.log(`Result: ${summary.exitCode === 0 ? "PASS" : summary.blocked ? "BLOCKED" : "FAIL"}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return 0;
  }
  if (!["package", "target", "auto"].includes(args.profile)) throw new Error(`Invalid profile: ${args.profile}`);
  if (!["micro", "quick", "full"].includes(args.level)) throw new Error(`Invalid level: ${args.level}`);

  const root = path.resolve(args.root);
  const profile = args.profile === "auto" ? detectProfile(root) : args.profile;
  const results = profile === "package"
    ? checkPackage(root, args.level, args.trustTargetTools)
    : checkTarget(root, args.level, args.strict, args.trustTargetTools);
  const summary = summarize(results, args.strict);

  if (args.json) console.log(JSON.stringify({ profile, root, level: args.level, strict: args.strict, trustTargetTools: args.trustTargetTools, summary, results }, null, 2));
  else printText(profile, root, results, summary);
  return summary.exitCode;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`[BLOCK] ${error.message}`);
  process.exitCode = 2;
}
