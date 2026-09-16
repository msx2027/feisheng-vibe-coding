import path from "node:path";
import {
  categoryFor, diagnosticFileSeverity, DUPLICATE_HELPER_FILE_EXCEPTIONS, DUPLICATE_NAME_IGNORE, HELPER_NAME_PATTERN,
  isTestPath, LIMITS, ratchetSeverity, toPosix,
} from "./hotspot-policy.mjs";

export function fileFinding(relPath, lines, stagedStat, staged) {
  const testFile = isTestPath(relPath);
  const reportThreshold = testFile ? LIMITS.testFileWarn : LIMITS.productionFileLines;
  if (lines <= reportThreshold) return null;
  const gateLimit = testFile ? LIMITS.testFileLines : LIMITS.productionFileLines;
  const baselineLines = stagedStat ? lines - stagedStat.added + stagedStat.deleted : null;
  // staged 未增长（含纯 git mv 内容不变）：继承旧 baseline，不新增 large-file
  if (staged && baselineLines !== null && lines <= baselineLines) return null;
  const diagnosticSeverity = diagnosticFileSeverity(relPath, lines);
  const severity = testFile && lines <= gateLimit ? diagnosticSeverity : ratchetSeverity({ currentLines: lines, baselineLines, limit: gateLimit, staged, fallback: diagnosticSeverity });
  const reportedLimit = !staged && severity === "blocker" ? LIMITS.fileBlocker : severity === "blocker" ? gateLimit : severity === "hotspot" ? LIMITS.fileHotspot : reportThreshold;
  const blockerMessage = staged
    ? baselineLines !== null && baselineLines > gateLimit
      ? `结构门禁：${relPath} ${lines} 行，历史基线 ${baselineLines} 行仍继续增长`
      : `结构门禁：${relPath} ${lines} 行，超过 ${gateLimit} 行`
    : `事故级阻断候选：${relPath} ${lines} 行，超过 ${LIMITS.fileBlocker} 行`;
  return {
    kind: "large-file", severity, file: relPath, lines, limit: reportedLimit, baselineLines,
    categories: categoryFor(relPath), stagedAdded: stagedStat?.added || 0, stagedDeleted: stagedStat?.deleted || 0,
    message: severity === "blocker" ? blockerMessage : severity === "hotspot"
      ? `核心热区：${relPath} ${lines} 行，超过 ${LIMITS.fileHotspot} 行`
      : `提醒线：${relPath} ${lines} 行，超过 ${reportThreshold} 行`,
  };
}

export function duplicateHelperFindings(functionIndex) {
  const findings = [];
  for (const [name, entries] of functionIndex.entries()) {
    const files = [...new Set(entries.map((entry) => toPosix(entry.file)))];
    const exceptionFiles = DUPLICATE_HELPER_FILE_EXCEPTIONS.get(name);
    const exactException = exceptionFiles?.size === files.length
      && files.every((file) => exceptionFiles.has(file));
    if (files.length < 2 || exactException || DUPLICATE_NAME_IGNORE.has(name) || !HELPER_NAME_PATTERN.test(name)) continue;
    findings.push({ kind: "duplicate-helper", severity: "warn", name, files, message: `重复 helper 候选：${name} 出现在 ${files.length} 个文件` });
  }
  return findings.sort((left, right) => left.name.localeCompare(right.name));
}

export function directoryHotspotFindings(files, root) {
  const counts = new Map();
  for (const file of files) {
    const directory = toPosix(path.dirname(toPosix(path.relative(root, file))));
    if (directory && directory !== ".") counts.set(directory, (counts.get(directory) || 0) + 1);
  }
  return Array.from(counts.entries()).filter(([, count]) => count > LIMITS.directoryFilesWarn).map(([directory, count]) => {
    const severity = count > LIMITS.directoryFilesHotspot ? "hotspot" : "warn";
    return { kind: "large-directory", severity, directory, fileCount: count, limit: severity === "hotspot" ? LIMITS.directoryFilesHotspot : LIMITS.directoryFilesWarn,
      message: severity === "hotspot" ? `超大目录：${directory} 直接包含 ${count} 个源码文件，超过 ${LIMITS.directoryFilesHotspot} 个` : `目录热区提醒：${directory} 直接包含 ${count} 个源码文件，超过 ${LIMITS.directoryFilesWarn} 个` };
  }).sort((left, right) => right.fileCount - left.fileCount || left.directory.localeCompare(right.directory));
}

export function stagedDiffFindings(files, root) {
  if (!files) return [];
  const findings = [];
  if (files.length > LIMITS.stagedFilesWarn) findings.push({ kind: "large-diff", severity: "warn", files: files.map((file) => toPosix(path.relative(root, file))), message: `staged 源码文件超过 ${LIMITS.stagedFilesWarn} 个（实际 ${files.length}）` });
  const scopes = new Set(files.map((file) => toPosix(path.relative(root, file)).split("/").slice(0, 2).join("/")).filter(Boolean));
  if (scopes.size > LIMITS.stagedScopesWarn) findings.push({ kind: "large-diff-scope", severity: "warn", scopes: Array.from(scopes).sort(), message: `staged 改动跨超过 ${LIMITS.stagedScopesWarn} 个顶层范围（实际 ${scopes.size}）` });
  return findings;
}
