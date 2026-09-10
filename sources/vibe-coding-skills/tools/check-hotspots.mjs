#!/usr/bin/env node
// vibe-coding-skills:managed-hotspot-tool
// DocMap:
// Layer: L3 / key script
// Module: tools
// Depends on: tools/hotspot-policy.mjs, skills/hotspot-governor/SKILL.md, tools/vibe-health-check.mjs, tools/test-hotspots.mjs
// Syncs with: README.md, DEV-PLAN.md, Product-Spec.md, TERMINOLOGY-AND-NAMING.md, tools/INDEX.md
// Scans target projects for large-file and high-coupling hotspot signals.

import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import {
  categoryFor,
  diagnosticFileSeverity,
  DUPLICATE_NAME_IGNORE,
  HELPER_NAME_PATTERN,
  isTestPath,
  LIMITS,
  ratchetSeverity,
  SCAN_ROOTS,
  shouldScanFile,
  shouldSkipDirectory,
} from "./hotspot-policy.mjs";
import {
  stagedBaselinePaths,
  stagedBaselineText,
  stagedFiles,
  stagedIndexModes,
  stagedIndexText,
  stagedNumstat,
} from "./hotspot-git.mjs";

function usage() {
  console.log(`Usage:
  node tools/check-hotspots.mjs <root> [--json] [--strict] [--staged]

Default mode reports hotspot warnings and exits 0.
--strict exits 1 when blocker candidates are found.
--strict --staged enforces 300-line production files, 800-line test files,
100-line functions and 180-line React components with a no-growth legacy ratchet.`);
}

function parseArgs(argv) {
  const args = { root: ".", json: false, strict: false, staged: false };
  const rest = [...argv];
  while (rest.length > 0) {
    const item = rest.shift();
    if (item === "--json") args.json = true;
    else if (item === "--strict") args.strict = true;
    else if (item === "--staged") args.staged = true;
    else if (item === "-h" || item === "--help") args.help = true;
    else if (!item.startsWith("-") && args.root === ".") args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

const toPosix = (value) => value.split(path.sep).join("/");
const countMatches = (text, pattern) => text.match(pattern)?.length || 0;

function splitLines(text) {
  if (text.length === 0) return [];
  const lines = text.split(/\r\n|\n|\r/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function lineCount(text) {
  return splitLines(text).length;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function inspectScanFile(root, file) {
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(file);
  if (!isInside(resolvedRoot, resolvedFile)) return { ok: false, reason: "path escapes scan root" };

  try {
    const rootStat = lstatSync(resolvedRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      return { ok: false, reason: "scan root is not a regular directory" };
    }

    const segments = path.relative(resolvedRoot, resolvedFile).split(path.sep).filter(Boolean);
    let current = resolvedRoot;
    for (let index = 0; index < segments.length; index += 1) {
      current = path.join(current, segments[index]);
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) {
        return { ok: false, reason: `path contains a symlink or junction: ${toPosix(path.relative(resolvedRoot, current))}` };
      }
      const final = index === segments.length - 1;
      if (final ? !stat.isFile() : !stat.isDirectory()) {
        return { ok: false, reason: final ? "path is not a regular file" : "path parent is not a directory" };
      }
    }

    const realRoot = realpathSync(resolvedRoot);
    const realFile = realpathSync(resolvedFile);
    if (!isInside(realRoot, realFile)) return { ok: false, reason: "real path escapes scan root" };
    return { ok: true, file: resolvedFile };
  } catch (error) {
    return { ok: false, reason: error?.code === "ENOENT" ? "path does not exist" : error.message };
  }
}

function walk(dir, root, unsafe, maxDepth = Infinity, depth = 0) {
  const files = [];
  if (!existsSync(dir)) return files;
  const startStat = lstatSync(dir);
  if (startStat.isSymbolicLink() || !startStat.isDirectory()) {
    unsafe.push({ file: toPosix(path.relative(root, dir)), reason: "scan root is a symlink, junction, or non-directory" });
    return files;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (shouldSkipDirectory(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      unsafe.push({ file: toPosix(path.relative(root, absolute)), reason: "path is a symlink or junction" });
      continue;
    }
    if (stat.isDirectory()) {
      if (depth < maxDepth) files.push(...walk(absolute, root, unsafe, maxDepth, depth + 1));
      continue;
    }
    if (!stat.isFile()) {
      unsafe.push({ file: toPosix(path.relative(root, absolute)), reason: "path is not a regular file" });
      continue;
    }
    const relPath = toPosix(path.relative(root, absolute));
    if (shouldScanFile(relPath)) files.push(absolute);
  }
  return files;
}

function listCodeFiles(root) {
  const unsafe = [];
  const roots = SCAN_ROOTS.map((item) => path.join(root, item)).filter((item) => existsSync(item));
  const scanRoots = roots.length > 0 ? roots : [root];
  return {
    files: [...new Set(scanRoots.flatMap((item) => walk(item, root, unsafe)))].sort(),
    unsafe,
  };
}

const REGEX_PREFIX_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "else",
  "in",
  "instanceof",
  "new",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);

function canStartRegex(output) {
  let index = output.length - 1;
  while (index >= 0 && /\s/.test(output[index])) index -= 1;
  if (index < 0) return true;
  const previous = output[index];
  if (/[(\[{,:;=!?&|+\-*%^~<>]/.test(previous)) return true;
  let wordStart = index;
  while (wordStart >= 0 && /[A-Za-z0-9_$]/.test(output[wordStart])) wordStart -= 1;
  const word = output.slice(wordStart + 1, index + 1);
  return Boolean(word && REGEX_PREFIX_KEYWORDS.has(word));
}

function maskNonCode(text) {
  let output = "";
  let state = "code";
  let escaped = false;
  let regexClass = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1] || "";

    if (state === "line-comment") {
      if (char === "\n" || char === "\r") {
        output += char;
        state = "code";
      } else {
        output += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "code";
      } else {
        output += char === "\n" || char === "\r" ? char : " ";
      }
      continue;
    }

    if (state === "single" || state === "double" || state === "template") {
      const closing = state === "single" ? "'" : state === "double" ? '"' : "`";
      output += char === "\n" || char === "\r" ? char : " ";
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === closing) {
        state = "code";
      }
      continue;
    }

    if (state === "regex") {
      output += char === "\n" || char === "\r" ? char : " ";
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "[") {
        regexClass = true;
      } else if (char === "]") {
        regexClass = false;
      } else if (char === "/" && !regexClass) {
        state = "code";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      output += "  ";
      index += 1;
      state = "line-comment";
    } else if (char === "/" && next === "*") {
      output += "  ";
      index += 1;
      state = "block-comment";
    } else if (char === "/" && canStartRegex(output)) {
      output += " ";
      state = "regex";
      escaped = false;
      regexClass = false;
    } else if (char === "'") {
      output += " ";
      state = "single";
      escaped = false;
    } else if (char === '"') {
      output += " ";
      state = "double";
      escaped = false;
    } else if (char === "`") {
      output += " ";
      state = "template";
      escaped = false;
    } else {
      output += char;
    }
  }

  return output;
}

function initialBlockBalance(text) {
  return countMatches(text, /\{/g) - countMatches(text, /\}/g);
}

function findBlockEnd(lines, startIndex, signatureEndIndex) {
  const signature = lines.slice(startIndex, signatureEndIndex + 1).join("\n");
  let balance = initialBlockBalance(signature);
  let end = signatureEndIndex;
  while (balance > 0 && end + 1 < lines.length) {
    end += 1;
    const clean = lines[end];
    balance += countMatches(clean, /\{/g) - countMatches(clean, /\}/g);
  }
  return end;
}

function findExpressionEnd(lines, startIndex, signatureEndIndex) {
  let parens = 0;
  let brackets = 0;
  let end = signatureEndIndex;
  for (let index = startIndex; index < lines.length; index += 1) {
    const clean = lines[index];
    parens += countMatches(clean, /\(/g) - countMatches(clean, /\)/g);
    brackets += countMatches(clean, /\[/g) - countMatches(clean, /\]/g);
    if (index >= signatureEndIndex && parens <= 0 && brackets <= 0 && /;\s*$/.test(clean)) {
      return index;
    }
    if (index > signatureEndIndex && clean.trim() === "" && parens <= 0 && brackets <= 0) {
      return Math.max(startIndex, index - 1);
    }
    end = index;
  }
  return end;
}

function classMemberLines(lines) {
  const members = new Array(lines.length).fill(false);
  const classes = [];
  let depth = 0;
  let pendingClass = false;
  for (let index = 0; index < lines.length; index += 1) {
    while (classes.length > 0 && depth < classes.at(-1).bodyDepth) classes.pop();
    members[index] = classes.length > 0 && depth === classes.at(-1).bodyDepth;
    const line = lines[index];
    if (/\bclass\s+[A-Za-z_$][\w$]*/.test(line)) pendingClass = true;
    const opens = countMatches(line, /\{/g);
    const closes = countMatches(line, /\}/g);
    if (pendingClass && opens > 0) {
      classes.push({ bodyDepth: depth + 1 });
      pendingClass = false;
    }
    depth += opens - closes;
  }
  return members;
}

function functionStartAt(line, isClassMember = false) {
  const declaration = line.match(
    /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)(?:\s*<[^>{}]*>)?\s*\(/,
  );
  if (declaration) return { name: declaration[1], kind: "declaration" };

  const variable = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b[^=]*=/);
  if (variable) return { name: variable[1], kind: "variable" };

  if (isClassMember) {
    const method = line.match(
      /^\s*(?:(?:public|private|protected|static|abstract|override|async|readonly|get|set)\s+)*\*?\s*(#?[A-Za-z_$][\w$]*|constructor)\s*(?:<[^>{}]*>)?\s*\(/,
    );
    if (method) return { name: method[1], kind: "method" };
  }

  return null;
}

function collectSignature(lines, startIndex, kind) {
  let signature = "";
  let sawCallable = kind === "declaration" || kind === "method";
  const max = Math.min(lines.length, startIndex + 30);

  for (let index = startIndex; index < max; index += 1) {
    const clean = lines[index];
    signature += `${index === startIndex ? "" : "\n"}${clean}`;
    if (/\bfunction\b|=>/.test(clean)) sawCallable = true;
    if (sawCallable && clean.includes("{")) {
      return { valid: sawCallable, end: index, hasBlock: true };
    }
    if (sawCallable && /=>/.test(clean)) {
      return { valid: true, end: index, hasBlock: false };
    }
    if (/;\s*$/.test(clean)) {
      return { valid: sawCallable, end: index, hasBlock: false };
    }
  }

  return { valid: false, end: startIndex, hasBlock: false };
}

function looksLikeJsx(lines, startIndex, endIndex) {
  const body = lines.slice(startIndex, Math.min(lines.length, endIndex + 1)).join("\n");
  return /(?:return|=>)\s*\(?\s*<[A-Za-z][\w.-]*(?:\s|>|\/)/.test(body);
}

function isReactComponent(name, relPath, lines, startIndex, endIndex) {
  const jsxCapable = /\.(tsx|jsx)$/.test(relPath) || /(^|\/)components?\//.test(relPath);
  if (!jsxCapable) return false;
  return /^[A-Z]/.test(name) || looksLikeJsx(lines, startIndex, endIndex);
}

function scanFunctions(text, relPath, options = {}) {
  const lines = splitLines(text);
  const cleanLines = splitLines(maskNonCode(text));
  const memberLines = classMemberLines(cleanLines);
  const issues = [];
  const names = [];
  const records = [];
  const occurrenceCounts = new Map();
  const currentRecords = options.collectOnly ? [] : scanFunctions(text, relPath, { collectOnly: true }).records;
  const baselineRecords = options.baselineText
    ? scanFunctions(options.baselineText, relPath, { collectOnly: true }).records
    : [];
  const groupCounts = (items) => {
    const counts = new Map();
    for (const item of items) {
      const key = `${item.name}\0${item.isComponent}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  };
  const currentGroupCounts = groupCounts(currentRecords);
  const baselineGroupCounts = groupCounts(baselineRecords);

  for (let index = 0; index < lines.length; index += 1) {
    const start = functionStartAt(cleanLines[index] || "", memberLines[index]);
    if (!start) continue;

    const signature = collectSignature(cleanLines, index, start.kind);
    if (!signature.valid) continue;

    const name = start.name;
    const end = signature.hasBlock
      ? findBlockEnd(cleanLines, index, signature.end)
      : findExpressionEnd(cleanLines, index, signature.end);
    const fnLines = end - index + 1;
    const isComponent = isReactComponent(name, relPath, lines, index, end);
    const occurrenceKey = `${name}\0${isComponent}`;
    const occurrence = occurrenceCounts.get(occurrenceKey) || 0;
    occurrenceCounts.set(occurrenceKey, occurrence + 1);
    names.push({ name, line: index + 1 });
    records.push({ name, line: index + 1, lines: fnLines, isComponent, occurrence });

    if (options.collectOnly) {
      continue;
    }

    const baseline = currentGroupCounts.get(occurrenceKey) === baselineGroupCounts.get(occurrenceKey)
      ? baselineRecords.find(
          (item) => item.name === name && item.isComponent === isComponent && item.occurrence === occurrence,
        )
      : undefined;

    if (!isComponent && fnLines > LIMITS.functionLines) {
      const severity = ratchetSeverity({
        currentLines: fnLines,
        baselineLines: baseline?.lines ?? null,
        limit: LIMITS.functionLines,
        staged: options.staged,
      });
      issues.push({
        kind: "long-function",
        severity,
        file: relPath,
        line: index + 1,
        name,
        lines: fnLines,
        limit: LIMITS.functionLines,
        message: `函数 ${name} 超过 ${LIMITS.functionLines} 行（实际 ${fnLines}）`,
      });
    }
    if (isComponent && fnLines > LIMITS.componentLines) {
      const severity = ratchetSeverity({
        currentLines: fnLines,
        baselineLines: baseline?.lines ?? null,
        limit: LIMITS.componentLines,
        staged: options.staged,
      });
      issues.push({
        kind: "long-component",
        severity,
        file: relPath,
        line: index + 1,
        name,
        lines: fnLines,
        limit: LIMITS.componentLines,
        message: `组件 ${name} 超过 ${LIMITS.componentLines} 行（实际 ${fnLines}）`,
      });
    }
  }

  return { issues, names, records };
}

function fileFinding(relPath, lines, stagedStat, staged) {
  const testFile = isTestPath(relPath);
  const reportThreshold = testFile ? LIMITS.testFileWarn : LIMITS.productionFileLines;
  if (lines <= reportThreshold) return null;
  const gateLimit = testFile ? LIMITS.testFileLines : LIMITS.productionFileLines;
  const baselineLines = stagedStat ? lines - stagedStat.added + stagedStat.deleted : null;
  const diagnosticSeverity = diagnosticFileSeverity(relPath, lines);
  const severity = testFile && lines <= gateLimit
    ? diagnosticSeverity
    : ratchetSeverity({
        currentLines: lines,
        baselineLines,
        limit: gateLimit,
        staged,
        fallback: diagnosticSeverity,
      });
  const reportedLimit = !staged && severity === "blocker"
    ? LIMITS.fileBlocker
    : severity === "blocker"
      ? gateLimit
      : severity === "hotspot"
        ? LIMITS.fileHotspot
        : reportThreshold;
  const blockerMessage = staged
    ? baselineLines !== null && baselineLines > gateLimit
      ? `结构门禁：${relPath} ${lines} 行，历史基线 ${baselineLines} 行仍继续增长`
      : `结构门禁：${relPath} ${lines} 行，超过 ${gateLimit} 行`
    : `事故级阻断候选：${relPath} ${lines} 行，超过 ${LIMITS.fileBlocker} 行`;
  return {
    kind: "large-file",
    severity,
    file: relPath,
    lines,
    limit: reportedLimit,
    baselineLines,
    categories: categoryFor(relPath),
    stagedAdded: stagedStat?.added || 0,
    stagedDeleted: stagedStat?.deleted || 0,
    message:
      severity === "blocker"
        ? blockerMessage
        : severity === "hotspot"
          ? `核心热区：${relPath} ${lines} 行，超过 ${LIMITS.fileHotspot} 行`
          : `提醒线：${relPath} ${lines} 行，超过 ${reportThreshold} 行`,
  };
}

function duplicateHelperFindings(functionIndex) {
  const findings = [];
  for (const [name, entries] of functionIndex.entries()) {
    const files = [...new Set(entries.map((entry) => entry.file))];
    if (files.length < 2) continue;
    if (DUPLICATE_NAME_IGNORE.has(name)) continue;
    if (!HELPER_NAME_PATTERN.test(name)) continue;
    findings.push({
      kind: "duplicate-helper",
      severity: "warn",
      name,
      files,
      message: `重复 helper 候选：${name} 出现在 ${files.length} 个文件`,
    });
  }
  return findings.sort((left, right) => left.name.localeCompare(right.name));
}

function directoryHotspotFindings(files, root) {
  const counts = new Map();
  for (const file of files) {
    const relPath = toPosix(path.relative(root, file));
    const directory = toPosix(path.dirname(relPath));
    if (!directory || directory === ".") continue;
    counts.set(directory, (counts.get(directory) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > LIMITS.directoryFilesWarn)
    .map(([directory, count]) => {
      const severity = count > LIMITS.directoryFilesHotspot ? "hotspot" : "warn";
      return {
        kind: "large-directory",
        severity,
        directory,
        fileCount: count,
        limit: severity === "hotspot" ? LIMITS.directoryFilesHotspot : LIMITS.directoryFilesWarn,
        message:
          severity === "hotspot"
            ? `超大目录：${directory} 直接包含 ${count} 个源码文件，超过 ${LIMITS.directoryFilesHotspot} 个`
            : `目录热区提醒：${directory} 直接包含 ${count} 个源码文件，超过 ${LIMITS.directoryFilesWarn} 个`,
      };
    })
    .sort((left, right) => right.fileCount - left.fileCount || left.directory.localeCompare(right.directory));
}

function scopeFor(relPath) {
  const parts = relPath.split("/");
  const srcIndex = parts.findIndex((part) => ["src", "app", "apps", "packages", "libs", "tests", "test"].includes(part));
  if (srcIndex === -1) return parts[0] || "";
  if (parts[srcIndex] === "apps" || parts[srcIndex] === "packages" || parts[srcIndex] === "libs") {
    return parts.slice(srcIndex, srcIndex + 2).join("/");
  }
  return parts.slice(srcIndex, srcIndex + 2).join("/");
}

function stagedDiffFindings(files, root) {
  if (!files) return [];
  const findings = [];
  if (files.length > LIMITS.stagedFilesWarn) {
    findings.push({
      kind: "large-diff",
      severity: "warn",
      files: files.map((file) => toPosix(path.relative(root, file))),
      message: `staged 源码文件超过 ${LIMITS.stagedFilesWarn} 个（实际 ${files.length}）`,
    });
  }
  const scopes = new Set(files.map((file) => scopeFor(toPosix(path.relative(root, file)))).filter(Boolean));
  if (scopes.size > LIMITS.stagedScopesWarn) {
    findings.push({
      kind: "large-diff-scope",
      severity: "warn",
      scopes: Array.from(scopes).sort(),
      message: `staged 改动跨超过 ${LIMITS.stagedScopesWarn} 个顶层范围（实际 ${scopes.size}）`,
    });
  }
  return findings;
}

function scan(rootInput, options) {
  const root = path.resolve(rootInput);
  if (!existsSync(root)) {
    throw new Error(`Root does not exist or is not a directory: ${root}`);
  }
  const rootStat = lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`Root must be a regular directory, not a symlink or junction: ${root}`);
  }

  const staged = options.staged ? stagedFiles(root) : null;
  if (options.staged && staged === null) {
    throw new Error("--staged requires git and a valid repository with staged diff access");
  }
  const stats = options.staged ? stagedNumstat(root) : new Map();
  if (options.staged && stats === null) {
    throw new Error("--staged requires git and staged diff statistics");
  }
  const baselinePaths = options.staged ? stagedBaselinePaths(root) : new Map();
  if (options.staged && baselinePaths === null) {
    throw new Error("--staged requires git and staged baseline access");
  }
  const indexModes = options.staged ? stagedIndexModes(root) : new Map();
  if (options.staged && indexModes === null) {
    throw new Error("--staged requires git index mode access");
  }
  const listed = options.staged ? { files: staged || [], unsafe: [] } : listCodeFiles(root);
  const unsafe = [...listed.unsafe];
  const files = [];
  for (const candidate of listed.files) {
    const relPath = toPosix(path.relative(root, candidate));
    if (options.staged && !["100644", "100755"].includes(indexModes.get(relPath))) {
      unsafe.push({ file: relPath, reason: "staged entry is not a regular file" });
      continue;
    }
    const inspection = inspectScanFile(root, candidate);
    if (inspection.ok) files.push(inspection.file);
    else unsafe.push({ file: toPosix(path.relative(root, candidate)), reason: inspection.reason });
  }
  const findings = [...new Map(unsafe.map((item) => [item.file, item])).values()].map((item) => ({
    kind: "unsafe-input",
    severity: "blocker",
    file: item.file,
    message: `拒绝不安全扫描输入：${item.file}（${item.reason}）`,
  }));
  const functionIndex = new Map();

  for (const file of files) {
    const relPath = toPosix(path.relative(root, file));
    const text = options.staged ? stagedIndexText(root, relPath) : readFileSync(file, "utf8");
    if (text === null) {
      findings.push({
        kind: "unsafe-input",
        severity: "blocker",
        file: relPath,
        message: `拒绝不安全扫描输入：${relPath}（无法读取 staged index blob）`,
      });
      continue;
    }
    const lines = lineCount(text);
    const stagedStat = stats.get(relPath);
    const baselineText = options.staged ? stagedBaselineText(root, baselinePaths.get(relPath)) : null;
    const fileIssue = fileFinding(relPath, lines, stagedStat, options.staged);
    if (fileIssue) findings.push(fileIssue);

    if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i.test(relPath)) {
      const { issues, names } = scanFunctions(text, relPath, { staged: options.staged, baselineText });
      findings.push(...issues);
      for (const item of names) {
        if (!functionIndex.has(item.name)) functionIndex.set(item.name, []);
        functionIndex.get(item.name).push({ file: relPath, line: item.line });
      }
    }
  }

  findings.push(...directoryHotspotFindings(files, root));
  findings.push(...duplicateHelperFindings(functionIndex));
  if (options.staged) findings.push(...stagedDiffFindings(files, root));

  const blockers = findings.filter((item) => item.severity === "blocker");
  const hotspots = findings.filter((item) => item.severity === "hotspot");
  const warnings = findings.filter((item) => item.severity === "warn");

  return {
    root,
    mode: options.staged ? "staged" : "all",
    limits: LIMITS,
    summary: {
      scannedFiles: files.length,
      totalFindings: findings.length,
      blockers: blockers.length,
      hotspots: hotspots.length,
      warnings: warnings.length,
    },
    findings,
  };
}

function printText(report, strict) {
  console.log(`Hotspot check: root=${report.root} mode=${report.mode}`);
  console.log(
    `Scanned ${report.summary.scannedFiles} files; findings=${report.summary.totalFindings}, blockers=${report.summary.blockers}, hotspots=${report.summary.hotspots}, warnings=${report.summary.warnings}`,
  );

  if (report.findings.length === 0) {
    console.log("No hotspot findings.");
    return;
  }

  const order = { blocker: 0, hotspot: 1, warn: 2 };
  for (const finding of [...report.findings].sort((left, right) => order[left.severity] - order[right.severity])) {
    const mark = finding.severity.toUpperCase().padEnd(7);
    console.log(`[${mark}] ${finding.message}`);
    if (finding.categories?.length) console.log(`  categories: ${finding.categories.join(", ")}`);
    if (finding.files?.length) console.log(`  files: ${finding.files.slice(0, 8).join(", ")}${finding.files.length > 8 ? " ..." : ""}`);
    if (finding.scopes?.length) console.log(`  scopes: ${finding.scopes.join(", ")}`);
  }

  if (!strict) {
    console.log("Default mode is warn-only. Use --strict to fail on blocker candidates.");
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exitCode = 0;
  } else {
    const report = scan(args.root, args);
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else printText(report, args.strict);
    process.exitCode = args.strict && report.summary.blockers > 0 ? 1 : 0;
  }
} catch (error) {
  console.error(`[BLOCK] ${error.message}`);
  process.exitCode = 2;
}
