import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  HOTSPOT_EXCEPTIONS_REL,
  LIMITS,
  assertAllExceptionsSeen,
  isApprovedHotspotException,
  parseHotspotExceptions,
  shouldScanFile,
  toPosix,
} from "./hotspot-policy.mjs";
import { stagedBaselinePaths, stagedBaselineText, stagedFiles, stagedIndexModes, stagedIndexText, stagedNumstat } from "./hotspot-git.mjs";
import { inspectScanFile, listCodeFiles } from "./hotspot-files.mjs";
import { scanFunctions } from "./hotspot-function-scan.mjs";
import { directoryHotspotFindings, duplicateHelperFindings, fileFinding, stagedDiffFindings } from "./hotspot-findings.mjs";

const lineCount = (text) => text.length === 0 ? 0 : text.split(/\r\n|\n|\r/).filter((line, index, all) => index < all.length - 1 || line !== "").length;

function exceptionError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  throw error;
}

function loadExceptions(root, staged, indexModes) {
  if (staged) {
    const mode = indexModes.get(HOTSPOT_EXCEPTIONS_REL);
    if (mode === undefined) return parseHotspotExceptions(null);
    if (!["100644", "100755"].includes(mode)) exceptionError("staged hotspot-exceptions.json 不是普通文件");
    const text = stagedIndexText(root, HOTSPOT_EXCEPTIONS_REL);
    if (text === null) exceptionError("无法从 staged index 读取 hotspot-exceptions.json");
    return parseHotspotExceptions(text);
  }
  const absolute = path.join(root, ...HOTSPOT_EXCEPTIONS_REL.split("/"));
  if (!existsSync(absolute)) return parseHotspotExceptions(null);
  const inspection = inspectScanFile(root, absolute);
  if (!inspection.ok) exceptionError(`拒绝不安全例外配置：${inspection.reason}`);
  return parseHotspotExceptions(readFileSync(inspection.file, "utf8"));
}

export function scanHotspots(rootInput, options) {
  const root = path.resolve(rootInput);
  if (!existsSync(root)) throw new Error(`Root does not exist or is not a directory: ${root}`);
  const rootStat = lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(`Root must be a regular directory, not a symlink or junction: ${root}`);
  const staged = options.staged ? stagedFiles(root) : null;
  if (options.staged && staged === null) throw new Error("--staged requires git and a valid repository with staged diff access");
  const stats = options.staged ? stagedNumstat(root) : new Map();
  if (options.staged && stats === null) throw new Error("--staged requires git and staged diff statistics");
  const baselinePaths = options.staged ? stagedBaselinePaths(root) : new Map();
  if (options.staged && baselinePaths === null) throw new Error("--staged requires git and staged baseline access");
  const indexModes = options.staged ? stagedIndexModes(root) : new Map();
  if (options.staged && indexModes === null) throw new Error("--staged requires git and staged index mode access");
  const exceptions = loadExceptions(root, options.staged, indexModes);
  const approvedStagedExceptions = new Set();
  if (options.staged) {
    for (const relPath of exceptions.keys()) {
      if (!shouldScanFile(relPath)) exceptionError(`staged 例外目标不属于源码扫描范围：${relPath}`);
      if (!["100644", "100755"].includes(indexModes.get(relPath))) exceptionError(`staged 例外目标不是普通文件：${relPath}`);
      const text = stagedIndexText(root, relPath);
      if (text === null) exceptionError(`无法从 staged index 读取例外目标：${relPath}`);
      if (isApprovedHotspotException(exceptions, relPath, text)) approvedStagedExceptions.add(relPath);
    }
  }
  const listed = options.staged ? { files: staged || [], unsafe: [] } : listCodeFiles(root);
  const unsafe = [...listed.unsafe], files = [];
  for (const candidate of listed.files) {
    const relPath = toPosix(path.relative(root, candidate));
    if (options.staged) {
      if (!["100644", "100755"].includes(indexModes.get(relPath))) unsafe.push({ file: relPath, reason: "staged entry is not a regular file" });
      else files.push(candidate);
      continue;
    }
    const inspection = inspectScanFile(root, candidate);
    if (inspection.ok) files.push(inspection.file); else unsafe.push({ file: toPosix(path.relative(root, candidate)), reason: inspection.reason });
  }
  const findings = [...new Map(unsafe.map((item) => [item.file, item])).values()].map((item) => ({ kind: "unsafe-input", severity: "blocker", file: item.file, message: `拒绝不安全扫描输入：${item.file}（${item.reason}）` }));
  const functionIndex = new Map();
  const seenExceptionPaths = new Set();
  for (const file of files) {
    const relPath = toPosix(path.relative(root, file));
    const text = options.staged ? stagedIndexText(root, relPath) : readFileSync(file, "utf8");
    if (text === null) { findings.push({ kind: "unsafe-input", severity: "blocker", file: relPath, message: `拒绝不安全扫描输入：${relPath}（无法读取 staged index blob）` }); continue; }
    if (approvedStagedExceptions.has(relPath)) continue;
    if (!options.staged && exceptions.has(relPath)) {
      seenExceptionPaths.add(relPath);
      if (isApprovedHotspotException(exceptions, relPath, text)) continue;
    }
    const issue = fileFinding(relPath, lineCount(text), stats.get(relPath), options.staged);
    if (issue) findings.push(issue);
    if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|rs)$/i.test(relPath)) {
      const { issues, names } = scanFunctions(text, relPath, { staged: options.staged, baselineText: options.staged ? stagedBaselineText(root, baselinePaths.get(relPath)) : null });
      findings.push(...issues);
      for (const item of names) { if (!functionIndex.has(item.name)) functionIndex.set(item.name, []); functionIndex.get(item.name).push({ file: relPath, line: item.line }); }
    }
  }
  if (!options.staged) assertAllExceptionsSeen(exceptions, seenExceptionPaths);
  findings.push(...directoryHotspotFindings(files, root), ...duplicateHelperFindings(functionIndex));
  if (options.staged) findings.push(...stagedDiffFindings(files, root));
  const blockers = findings.filter((item) => item.severity === "blocker"), hotspots = findings.filter((item) => item.severity === "hotspot"), warnings = findings.filter((item) => item.severity === "warn");
  return { root, mode: options.staged ? "staged" : "all", limits: LIMITS, summary: { scannedFiles: files.length, totalFindings: findings.length, blockers: blockers.length, hotspots: hotspots.length, warnings: warnings.length }, findings };
}
