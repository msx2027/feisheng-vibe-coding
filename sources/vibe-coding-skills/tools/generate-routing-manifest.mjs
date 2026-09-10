#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = 3;
const MANIFEST_RELATIVE_PATH = "skills/ROUTING-MANIFEST.json";
const USER_ENTRY_SKILL = "vibe-coding-skills";
const EVENT_ONLY_SKILLS = new Set(["evolution-engine", "experience-elevator", "feedback-writer"]);
const ROUTER_ONLY_SKILLS = new Set(["beginner-flow-guide"]);
const REFERENCE_PATH_PATTERN =
  /(^|[^A-Za-z0-9_./-])((?:references|reference)\/[A-Za-z0-9._/-]+\.md|skills\/[A-Za-z0-9._-]+\/(?:references|reference)\/[A-Za-z0-9._/-]+\.md)\b/g;
const RISK_HINTS = [
  ["bug", /\bbug\b|报错|故障|异常|不正常/i],
  ["security", /安全|security/i],
  ["permission", /权限|permission/i],
  ["data", /数据|data/i],
  ["release", /发布|上线|部署|打包|release|deploy|publish/i],
  ["interface", /接口|endpoint|service|fetch|IPC|schema/i],
  ["hook", /hook/i],
  ["skill", /\bSkill\b|技能/i],
  ["agent", /\bAgent\b|子 Agent|代理/i],
  ["tool", /\bTool\b|工具|脚本/i],
  ["test", /测试|回归|E2E|Playwright|Vitest|pytest|test/i],
  ["ui", /\bUI\b|前端|页面|组件|样式|token/i],
];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function readUtf8(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");
}

function stripWrappingQuotes(value) {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(content, sourcePath) {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) {
    throw new Error(`Missing YAML frontmatter: ${sourcePath}`);
  }
  return match[1];
}

function frontmatterField(frontmatter, fieldName, sourcePath) {
  const pattern = new RegExp(`^${fieldName}:\\s*(.+?)\\s*$`, "m");
  const match = frontmatter.match(pattern);
  if (!match) {
    throw new Error(`Missing frontmatter field '${fieldName}' in ${sourcePath}`);
  }
  return stripWrappingQuotes(match[1]);
}

function frontmatterBoolean(frontmatter, fieldName, sourcePath) {
  const pattern = new RegExp(`^${fieldName}:\\s*(true|false)\\s*$`, "mi");
  const match = frontmatter.match(pattern);
  if (!match) throw new Error(`Missing or invalid frontmatter field '${fieldName}' in ${sourcePath}`);
  return match[1].toLowerCase() === "true";
}

function estimateTokens(content) {
  const cjk = (content.match(/[\u3400-\u9fff]/g) || []).length;
  const nonCjk = content.length - cjk;
  return Math.ceil(cjk + nonCjk / 4);
}

function listSkillFiles(root) {
  const skillsRoot = path.join(root, "skills");
  if (!fs.existsSync(skillsRoot)) {
    throw new Error(`Missing skills directory: ${skillsRoot}`);
  }

  const directories = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const entry of directories) {
    if (fs.lstatSync(path.join(skillsRoot, entry.name)).isSymbolicLink()) {
      throw new Error(`Skill directory must not be a symlink or junction: skills/${entry.name}`);
    }
    const filePath = path.join(skillsRoot, entry.name, "SKILL.md");
    if (!fs.existsSync(filePath)) throw new Error(`Skill directory is missing SKILL.md: skills/${entry.name}`);
    if (!fs.statSync(filePath).isFile()) throw new Error(`Skill entry must be a regular file: skills/${entry.name}/SKILL.md`);
  }

  return directories
    .map((entry) => ({
      id: entry.name,
      skillRoot: path.join(skillsRoot, entry.name),
      filePath: path.join(skillsRoot, entry.name, "SKILL.md"),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function cleanTableCell(value) {
  return String(value || "").replace(/`([^`]+)`/g, "$1").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

function parseSkillsIndex(root) {
  const indexPath = path.join(root, "skills", "INDEX.md");
  if (!fs.existsSync(indexPath)) {
    return new Map();
  }

  const entries = new Map();
  for (const line of readUtf8(indexPath).split(/\r?\n/)) {
    if (!line.trim().startsWith("|") || !line.includes("`")) {
      continue;
    }
    const cells = line.split("|").slice(1, -1).map(cleanTableCell);
    const idMatch = cells[0]?.match(/^([^`|\s]+)$/);
    if (!idMatch || cells.length < 3 || cells[0] === "内部 Skill") {
      continue;
    }
    if (entries.has(idMatch[1])) throw new Error(`Skills index contains duplicate Skill: ${idMatch[1]}`);
    entries.set(idMatch[1], {
      scenario: cells[1] || "",
      defaultTrigger: cells[2] || "",
      output: cells[3] || "",
    });
  }
  return entries;
}

function pushHint(hints, value, maxLength = 140) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized || normalized === "-" || hints.includes(normalized)) {
    return;
  }
  hints.push(normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized);
}

function extractTriggerHints(description, indexEntry) {
  const hints = [];
  pushHint(hints, indexEntry?.scenario);
  pushHint(hints, indexEntry?.defaultTrigger);

  for (const match of description.matchAll(/当用户(.+?)(?:时使用|时|，|。)/g)) {
    pushHint(hints, `用户${match[1]}`);
  }

  for (const match of description.matchAll(/Use when\s+(.+?)(?:\.|$)/gi)) {
    pushHint(hints, match[1]);
  }

  for (const match of description.matchAll(/Use during\s+(.+?)(?:\.|$)/gi)) {
    pushHint(hints, `during ${match[1]}`);
  }

  for (const match of description.matchAll(/when the user\s+(.+?)(?:\.|$)/gi)) {
    const hint = `user ${match[1]}`;
    if (!hints.includes(`the ${hint}`)) {
      pushHint(hints, hint);
    }
  }

  if (hints.length === 0) {
    pushHint(hints, description);
  }

  return hints;
}

function extractRiskHints(...parts) {
  const source = parts.filter(Boolean).join("\n");
  return RISK_HINTS.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
}

function walkMarkdownFiles(dir, root) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(toPosix(path.relative(root, absolute)));
      }
    }
  };
  walk(dir);
  return files;
}

function extractReferencedMarkdownPaths(content, root, skillId) {
  const paths = new Set();
  let match;
  while ((match = REFERENCE_PATH_PATTERN.exec(content)) !== null) {
    const rawPath = match[2];
    const normalized = rawPath.startsWith("skills/")
      ? rawPath
      : `skills/${skillId}/${rawPath}`;
    paths.add(normalized.split("\\").join("/"));
  }
  return Array.from(paths);
}

function listReferenceMarkdownPaths(root, skillRoot) {
  return ["references", "reference"].flatMap((dirName) => walkMarkdownFiles(path.join(skillRoot, dirName), root));
}

function sourceHashFor(root, skillEntries, skillsIndexContent, referencePaths) {
  const hash = crypto.createHash("sha256");
  hash.update(skillsIndexContent);
  for (const entry of skillEntries) {
    hash.update(`\n--- ${entry.id} ---\n`);
    hash.update(readUtf8(entry.filePath));
  }
  for (const referencePath of referencePaths) {
    hash.update(`\n--- reference ${referencePath} ---\n`);
    const absolute = path.join(root, ...referencePath.split("/"));
    if (fs.existsSync(absolute) && fs.lstatSync(absolute).isFile()) hash.update(readUtf8(absolute));
    else hash.update("<missing-or-unsafe-reference>");
  }
  return hash.digest("hex");
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafeOutputPath(root, targetPath) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);
  if (!isInside(resolvedRoot, resolvedTarget) || resolvedTarget === resolvedRoot) {
    throw new Error(`Routing manifest output must stay inside repository root: ${resolvedTarget}`);
  }
  let current = resolvedRoot;
  const relative = path.relative(resolvedRoot, resolvedTarget);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Routing manifest output contains a symlink or junction: ${current}`);
    }
  }
  return resolvedTarget;
}

export function getRoutingManifestPath(root, outputPath = "") {
  const resolvedRoot = path.resolve(root);
  return assertSafeOutputPath(
    resolvedRoot,
    outputPath ? path.resolve(resolvedRoot, outputPath) : path.join(resolvedRoot, MANIFEST_RELATIVE_PATH),
  );
}

function assertReferencePath(root, referencePath, skillId) {
  if (
    typeof referencePath !== "string" ||
    referencePath.includes("\\") ||
    referencePath.startsWith("/") ||
    /^[A-Za-z]:/u.test(referencePath) ||
    referencePath.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
    !referencePath.endsWith(".md")
  ) {
    throw new Error(`Invalid reference path for ${skillId}: ${referencePath}`);
  }
  const absolute = path.resolve(root, ...referencePath.split("/"));
  if (!isInside(path.resolve(root), absolute)) throw new Error(`Reference path escapes repository root: ${referencePath}`);
}

export function buildRoutingManifestData(rootInput = process.cwd()) {
  const root = path.resolve(rootInput);
  const indexPath = path.join(root, "skills", "INDEX.md");
  const skillsIndexContent = fs.existsSync(indexPath) ? readUtf8(indexPath) : "";
  const indexEntries = parseSkillsIndex(root);
  const skillEntries = listSkillFiles(root);
  const skillIds = new Set(skillEntries.map((entry) => entry.id));
  for (const id of indexEntries.keys()) {
    if (!skillIds.has(id)) throw new Error(`Skills index contains an unknown Skill: ${id}`);
  }
  for (const id of skillIds) {
    if (!indexEntries.has(id)) throw new Error(`Skills index is missing Skill: ${id}`);
  }
  const allReferencePaths = [];
  const referenceChecks = [];

  const skills = skillEntries.map((entry) => {
    const relativePath = toPosix(path.relative(root, entry.filePath));
    const content = readUtf8(entry.filePath);
    const frontmatter = parseFrontmatter(content, relativePath);
    const name = frontmatterField(frontmatter, "name", relativePath);
    if (name !== entry.id) throw new Error(`Skill frontmatter name must match directory id: ${relativePath} -> ${name}`);
    const description = frontmatterField(frontmatter, "description", relativePath);
    const userInvocable = frontmatterBoolean(frontmatter, "user-invocable", relativePath);
    const disableModelInvocation = frontmatterBoolean(frontmatter, "disable-model-invocation", relativePath);
    const indexEntry = indexEntries.get(entry.id) || null;
    const actualReferencePaths = listReferenceMarkdownPaths(root, entry.skillRoot);
    const mentionedReferencePaths = extractReferencedMarkdownPaths(content, root, entry.id);
    const referencePaths = Array.from(new Set([...mentionedReferencePaths, ...actualReferencePaths])).sort();
    for (const referencePath of referencePaths) assertReferencePath(root, referencePath, entry.id);
    allReferencePaths.push(...referencePaths);
    referenceChecks.push({ id: entry.id, referencePaths });

    const routeHints = extractTriggerHints(description, indexEntry);
    const invocation = entry.id === USER_ENTRY_SKILL
      ? "user-only"
      : EVENT_ONLY_SKILLS.has(entry.id)
        ? "event-only"
        : "router-only";
    const activation = invocation === "user-only"
      ? "conversation-explicit"
      : invocation === "event-only"
        ? "structured-event"
        : "conversation-gated";
    const skill = {
      id: entry.id,
      routeHint: routeHints[0] || "",
      routeHints,
      invocation,
      activation,
      userInvocable,
      disableModelInvocation,
      risk: extractRiskHints(description, indexEntry?.scenario, indexEntry?.defaultTrigger, entry.id).slice(0, 3),
      refs: referencePaths.length,
      tokens: estimateTokens(content),
    };

    if (entry.id === USER_ENTRY_SKILL || ROUTER_ONLY_SKILLS.has(entry.id)) {
      skill.router = 1;
    }
    if (invocation === "router-only") {
      skill.manualOnly = true;
    }

    return skill;
  });

  const manifest = {
    version: VERSION,
    sourceHash: sourceHashFor(root, skillEntries, skillsIndexContent, allReferencePaths.sort()),
    skills,
  };

  return { manifest, referenceChecks };
}

export function buildRoutingManifest(rootInput = process.cwd()) { return buildRoutingManifestData(rootInput).manifest; }

export function canonicalManifestJson(manifest) { return `${JSON.stringify(manifest)}\n`; }

export function writeRoutingManifest(rootInput = process.cwd(), outputPath = "") {
  const root = path.resolve(rootInput);
  const manifest = buildRoutingManifest(root);
  const targetPath = getRoutingManifestPath(root, outputPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporaryPath, canonicalManifestJson(manifest), "utf8");
    fs.renameSync(temporaryPath, targetPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
  return { manifest, targetPath };
}

function parseArgs(argv) {
  const options = { root: process.cwd(), output: "", stdout: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") {
      options.output = argv[++index] || "";
    } else if (arg === "--stdout" || arg === "--json") {
      options.stdout = true;
    } else if (!arg.startsWith("--")) {
      options.root = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  if (options.stdout) {
    process.stdout.write(canonicalManifestJson(buildRoutingManifest(options.root)));
    return;
  }
  const { targetPath } = writeRoutingManifest(options.root, options.output);
  console.log(`Generated ${toPosix(targetPath)}`);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
