import fs from "node:fs";
import path from "node:path";
import { inspectTargetDirectory, inspectTargetFile } from "./safe-target-fs.mjs";
import { estimateTokens, validateProjectRelativePath } from "./target-doc-manifest-schema.mjs";

export const DEFAULT_MARKDOWN_GOVERNANCE = Object.freeze({ enabled: false, maxTokens: 8000, facadeMaxTokens: 3000, archiveDirectories: [] });
export const DEFAULT_BOOTSTRAP_MARKDOWN_GOVERNANCE = Object.freeze({ ...DEFAULT_MARKDOWN_GOVERNANCE, enabled: true });
const EXCLUDED_DIRECTORIES = new Set([".git", ".tmp", "node_modules", "dist", "build", "coverage", ".next", "target"]);
const RUNTIME_WORKTREE_ROOTS = new Set([".claude/worktrees", ".codex/worktrees", "worktree/.claude", "worktree/.codex"]);
const FACADE_PATTERN = /^\s*<!--\s*vibe-markdown-facade:\s*([^<>]+?)\s*-->\s*$/mu;
const SECTION_PATTERN = /^\s*<!--\s*vibe-section:[A-Za-z0-9][A-Za-z0-9._:-]*\s*-->\s*$/u;

export function resolveMarkdownGovernance(manifest) {
  return { ...DEFAULT_MARKDOWN_GOVERNANCE, ...(manifest?.markdownGovernance || {}) };
}

export function markdownGovernanceIssues(manifest) {
  if (!Object.prototype.hasOwnProperty.call(manifest || {}, "markdownGovernance")) return [];
  const config = manifest.markdownGovernance;
  const issues = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) return [{ code: "invalid_markdown_governance", message: "markdownGovernance must be an object", at: "markdownGovernance" }];
  const allowed = new Set(["enabled", "maxTokens", "facadeMaxTokens", "archiveDirectories"]);
  for (const key of Object.keys(config)) if (!allowed.has(key)) issues.push({ code: "unknown_markdown_governance_field", message: `unknown markdownGovernance field: ${key}`, at: `markdownGovernance.${key}` });
  if (typeof config.enabled !== "boolean") issues.push({ code: "invalid_markdown_governance", message: "markdownGovernance.enabled must be boolean", at: "markdownGovernance.enabled" });
  for (const key of ["maxTokens", "facadeMaxTokens"]) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 1 || config[key] > 20000) issues.push({ code: "invalid_markdown_governance", message: `markdownGovernance.${key} must be an integer from 1 to 20000`, at: `markdownGovernance.${key}` });
  }
  if (Number.isSafeInteger(config.maxTokens) && Number.isSafeInteger(config.facadeMaxTokens) && config.facadeMaxTokens > config.maxTokens) {
    issues.push({ code: "invalid_markdown_governance", message: "markdownGovernance.facadeMaxTokens must not exceed maxTokens", at: "markdownGovernance.facadeMaxTokens" });
  }
  if (Object.prototype.hasOwnProperty.call(config, "archiveDirectories") && !Array.isArray(config.archiveDirectories)) {
    issues.push({ code: "invalid_markdown_governance", message: "markdownGovernance.archiveDirectories must be an array", at: "markdownGovernance.archiveDirectories" });
  } else if (Array.isArray(config.archiveDirectories)) {
    for (const [index, directory] of config.archiveDirectories.entries()) {
      const at = "markdownGovernance.archiveDirectories[" + index + "]";
      if (typeof directory !== "string" || validateProjectRelativePath(directory, at)) {
        issues.push({ code: "invalid_markdown_governance", message: "markdownGovernance.archiveDirectories must contain project-relative directories", at });
      }
    }
    if (new Set(config.archiveDirectories).size !== config.archiveDirectories.length) {
      issues.push({ code: "invalid_markdown_governance", message: "markdownGovernance.archiveDirectories must not repeat a directory", at: "markdownGovernance.archiveDirectories" });
    }
  }
  return issues;
}

export function facadeDirectory(content) {
  const match = String(content).match(FACADE_PATTERN);
  return match ? match[1].trim().replaceAll("\\", "/") : "";
}

export function parseMarkdownFacade(content) {
  const directory = facadeDirectory(content);
  return directory || null;
}

function readMarkdown(root, relativePath) {
  const state = inspectTargetFile(root, relativePath);
  return state.exists ? fs.readFileSync(state.path, "utf8").replace(/^\uFEFF/u, "") : null;
}

function walkMarkdown(root) {
  const files = [];
  const visit = (directory, relativeDirectory = "") => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const relativeEntry = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory() && RUNTIME_WORKTREE_ROOTS.has(relativeEntry)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute, relativeEntry);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path.relative(root, absolute).replaceAll("\\", "/"));
    }
  };
  visit(root);
  return files.sort();
}

function firstNonBlankLine(lines) {
  return lines.findIndex((line) => line.trim() !== "");
}

function hasMarkdownLink(content, sourceFile, targetFile) {
  return projectMarkdownLinks(content, sourceFile).includes(targetFile);
}

function isEscapedBacktick(content, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function stripInlineCodeSpans(content) {
  let visible = "";
  let cursor = 0;
  while (cursor < content.length) {
    if (content[cursor] !== "`") {
      visible += content[cursor];
      cursor += 1;
      continue;
    }
    if (isEscapedBacktick(content, cursor)) {
      visible += content[cursor];
      cursor += 1;
      continue;
    }
    const openerStart = cursor;
    while (cursor < content.length && content[cursor] === "`") cursor += 1;
    const openerLength = cursor - openerStart;
    let search = cursor;
    let closerEnd = -1;
    while (search < content.length) {
      const closerStart = content.indexOf("`", search);
      if (closerStart < 0) break;
      if (isEscapedBacktick(content, closerStart)) {
        search = closerStart + 1;
        continue;
      }
      let candidateEnd = closerStart;
      while (candidateEnd < content.length && content[candidateEnd] === "`") candidateEnd += 1;
      if (candidateEnd - closerStart === openerLength) {
        closerEnd = candidateEnd;
        break;
      }
      search = candidateEnd;
    }
    if (closerEnd < 0) {
      visible += content.slice(openerStart, cursor);
      continue;
    }
    visible += content.slice(openerStart, closerEnd).replace(/[^\n]/gu, " ");
    cursor = closerEnd;
  }
  return visible;
}

function projectMarkdownLinks(content, sourceFile) {
  const visibleLines = [];
  let inFence = false;
  for (const line of String(content).replace(/\r\n?/gu, "\n").split("\n")) {
    if (/^\s*(```|~~~)/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) visibleLines.push(line);
  }
  const visibleContent = stripInlineCodeSpans(visibleLines.join("\n").replace(/<!--[\s\S]*?-->/gu, ""));
  const targets = new Set();
  const pattern = /\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/gu;
  for (const match of visibleContent.matchAll(pattern)) {
    const destination = (match[1] || match[2] || "").trim();
    const targetPath = destination.split("#", 1)[0].replaceAll("\\", "/");
    if (!targetPath || !targetPath.toLowerCase().endsWith(".md")) continue;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/)/iu.test(targetPath)) continue;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(sourceFile), targetPath));
    targets.add(resolved);
  }
  return [...targets];
}

export function resolveLinkedMarkdownDetail(root, detailPath) {
  const directory = path.posix.dirname(detailPath);
  if (!directory || directory === ".") return { linked: false, facade: "" };
  const facade = `${directory}.md`;
  const content = readMarkdown(root, facade);
  if (content === null || parseMarkdownFacade(content) !== directory) return { linked: false, facade };
  return { linked: projectMarkdownLinks(content, facade).includes(detailPath), facade };
}

function parseDetailSections(content) {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const marker = /^\s*<!--\s*vibe-section:([A-Za-z0-9][A-Za-z0-9._:-]*)\s*-->\s*$/u;
  return lines.flatMap((line) => {
    const match = line.match(marker);
    return match ? [{ id: match[1] }] : [];
  });
}

function humanDetailPrefix(sectionId) {
  const namespace = sectionId.match(/^([A-Z][A-Z0-9_]*)-(.+)$/u);
  const namespaceName = namespace?.[1] || "";
  let suffix = namespace?.[2] || sectionId;
  if (namespaceName === "APPENDIX") return `附录-${humanDetailSuffix(suffix)}`;
  if (suffix.startsWith("APPENDIX-")) return `附录-${humanDetailSuffix(suffix.slice("APPENDIX-".length))}`;
  return humanDetailSuffix(suffix);
}

function humanDetailSuffix(value) {
  const versionRange = value.match(/^v(\d+(?:\.\d+)*)-v(\d+(?:\.\d+)*)$/u);
  if (versionRange) return `版本${versionRange[1]}至${versionRange[2]}`;
  const letterSuffix = value.match(/^(\d+)(?:-)?([A-Z])$/u);
  if (letterSuffix) return `${letterSuffix[1]}-${String(letterSuffix[2].charCodeAt(0) - 64).padStart(2, "0")}`;
  return value;
}

function isHumanReadableDetailFilename(name) {
  const stem = name.replace(/\.md$/iu, "");
  const pattern = /^(?:(?:附录-)?\d+(?:-\d+)*|版本\d+(?:\.\d+)*(?:至\d+(?:\.\d+)*)?)-.+$/u;
  return pattern.test(stem) && /[\p{Script=Han}]/u.test(stem);
}

function finding(code, file, extra = {}) {
  return { code, severity: "error", file, ...extra };
}

export function isMarkdownArchivePath(relativePath, archiveDirectories = []) {
  return archiveDirectories.some((directory) => relativePath === directory || relativePath.startsWith(directory + "/"));
}

export function checkMarkdownGovernance(root, manifest, options = {}) {
  const config = resolveMarkdownGovernance(manifest);
  if (!config.enabled && options.force !== true) return { enabled: false, findings: [], files: 0 };
  const files = walkMarkdown(root);
  const contents = new Map(files.map((file) => [file, readMarkdown(root, file) || ""]));
  const findings = [];
  const facades = new Map();
  const details = new Set();
  const linkedDetails = new Set();
  const detailSections = new Map();
  for (const directory of config.archiveDirectories) {
    const state = inspectTargetDirectory(root, directory);
    if (!state.exists) findings.push(finding("archive_directory_missing", directory, { message: "declared markdown archive directory is missing" }));
  }
  const archived = new Set(files.filter((file) => isMarkdownArchivePath(file, config.archiveDirectories)));

  for (const [file, content] of contents) {
    if (archived.has(file)) continue;
    for (const target of projectMarkdownLinks(content, file)) {
      if (target.startsWith("../") || target === ".." || !contents.has(target)) {
        findings.push(finding("broken_project_markdown_link", file, { target }));
      }
    }
  }

  for (const [file, content] of contents) {
    if (archived.has(file)) continue;
    const directory = parseMarkdownFacade(content);
    if (!directory) continue;
    const issue = validateProjectRelativePath(directory, `facade ${file}`);
    const expectedDirectory = file.replace(/\.md$/iu, "");
    const lines = content.replace(/\r\n?/gu, "\n").split("\n");
    if (issue) findings.push(finding("invalid_facade_directory", file, { message: issue }));
    else {
      if (directory !== expectedDirectory) findings.push(finding("facade_directory_must_match_filename", file, { directory, expectedDirectory }));
      if (firstNonBlankLine(lines) < 0 || !FACADE_PATTERN.test(lines[firstNonBlankLine(lines)])) findings.push(finding("facade_marker_not_leading", file));
      if (facades.has(directory)) findings.push(finding("duplicate_facade_directory", file, { directory }));
      else facades.set(directory, file);
    }
    const heading = lines.slice(firstNonBlankLine(lines) + 1).find((line) => line.trim() !== "");
    if (!/^\s*#\s+\S/u.test(heading || "")) findings.push(finding("facade_heading_not_h1", file));
    if (estimateTokens(content) > config.facadeMaxTokens) findings.push(finding("facade_too_large", file, { tokens: estimateTokens(content), maxTokens: config.facadeMaxTokens }));
  }

  for (const [directory, facade] of facades) {
    const childFiles = files.filter((file) => !archived.has(file) && path.posix.dirname(file) === directory);
    if (childFiles.length === 0) findings.push(finding("facade_has_no_details", facade, { directory }));
    for (const child of childFiles) {
      details.add(child);
      const content = contents.get(child);
      const tokens = estimateTokens(content);
      const name = path.posix.basename(child);
      if (!hasMarkdownLink(contents.get(facade), facade, child)) findings.push(finding("detail_not_linked_from_facade", child, { facade }));
      else linkedDetails.add(child);
      if (!hasMarkdownLink(content, child, facade)) findings.push(finding("detail_missing_facade_backlink", child, { facade }));
      if (tokens > config.maxTokens) findings.push(finding("detail_too_large", child, { tokens, maxTokens: config.maxTokens }));
      if (!isHumanReadableDetailFilename(name)) findings.push(finding("detail_filename_not_human_readable", child));
      if (parseMarkdownFacade(content)) continue;
      const lines = content.replace(/\r\n?/gu, "\n").split("\n");
      const first = firstNonBlankLine(lines);
      const sections = parseDetailSections(content);
      if (first < 0 || !SECTION_PATTERN.test(lines[first]) || sections.length !== 1) {
        findings.push(finding("detail_requires_one_leading_section", child));
        continue;
      }
      const section = sections[0];
      const sectionFiles = detailSections.get(section.id) || [];
      sectionFiles.push(child);
      detailSections.set(section.id, sectionFiles);
      const expectedPrefix = humanDetailPrefix(section.id);
      if (!name.startsWith(`${expectedPrefix}-`)) findings.push(finding("detail_filename_display_prefix_mismatch", child, { id: section.id, expectedPrefix }));
      const heading = lines.slice(first + 1).find((line) => line.trim() !== "");
      if (!/^\s*#\s+\S/u.test(heading || "")) findings.push(finding("detail_heading_not_h1", child));
    }
  }

  for (const [id, sectionFiles] of detailSections) {
    if (sectionFiles.length < 2) continue;
    for (const file of sectionFiles) findings.push(finding("duplicate_detail_section", file, { id, files: sectionFiles }));
  }

  for (const [file, content] of contents) {
    if (archived.has(file)) continue;
    const tokens = estimateTokens(content);
    if (details.has(file)) continue;
    if (tokens > config.maxTokens && !parseMarkdownFacade(content)) findings.push(finding("markdown_requires_split", file, { tokens, maxTokens: config.maxTokens }));
    const conventionalDirectory = file.replace(/\.md$/iu, "");
    if (!parseMarkdownFacade(content) && files.some((candidate) => candidate.startsWith(`${conventionalDirectory}/`))) {
      findings.push(finding("unmanaged_markdown_split", file, { expectedMarker: `<!-- vibe-markdown-facade: ${conventionalDirectory} -->` }));
    }
  }
  const result = { enabled: config.enabled, files: files.length, archiveFiles: archived.size, findings };
  if (options.includeFiles === true) {
    result.governedFiles = [...new Set([...facades.values(), ...details])].sort();
    result.linkedDetailFiles = [...linkedDetails].sort();
    result.archivedFiles = [...archived].sort();
  }
  return result;
}
