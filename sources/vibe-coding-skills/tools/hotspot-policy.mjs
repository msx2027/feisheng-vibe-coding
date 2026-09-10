// vibe-coding-skills:managed-hotspot-tool
// DocMap: L3 / tools；与 check-hotspots、hotspot-governor、dev-builder、tools/INDEX 同步。
// 核心热区阈值与路径分类真源；扫描器、脚手架和文档不得另设冲突数字。
import path from "node:path";

export const LIMITS = Object.freeze({
  productionFileLines: 300,
  testFileWarn: 300,
  testFileLines: 800,
  fileHotspot: 800,
  fileBlocker: 1500,
  functionLines: 100,
  componentLines: 180,
  directoryFilesWarn: 80,
  directoryFilesHotspot: 150,
  stagedFilesWarn: 8,
  stagedScopesWarn: 3,
});

export const SCAN_ROOTS = Object.freeze([
  "src",
  "skills",
  "agents",
  "hooks",
  "codex-hooks",
  "app",
  "apps",
  "pages",
  "components",
  "packages",
  "libs",
  "tests",
  "test",
  "tools",
  "scripts",
  "electron",
]);

export const HELPER_NAME_PATTERN =
  /^(safe|describe|normalize|parse|format|resolve|collect|build|create|ensure|validate|read|write|load|save|map|to[A-Z]|from[A-Z]|is[A-Z]|has[A-Z])/;

export const DUPLICATE_NAME_IGNORE = new Set([
  "main",
  "render",
  "setup",
  "teardown",
  "handler",
  "default",
  "describe",
  "it",
  "test",
]);

const EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
  ".css",
  ".scss",
  ".json",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".psm1",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".kts",
  ".cs",
  ".php",
  ".rb",
  ".swift",
  ".dart",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".git",
  ".claude",
  ".agents",
  ".codex",
  ".electron-dist",
  "__pycache__",
]);

const GENERATED_DIRS = new Set(["gen", "generated", "__generated__", "vendor", "third_party", "third-party"]);

const toPosix = (value) => value.split(path.sep).join("/");

function shouldScanJson(relPath) {
  const base = path.basename(relPath).toLowerCase();
  return /token|schema|contract|registry|theme|config|manifest/.test(base) && !/lock/.test(base);
}

export function isGeneratedOrThirdPartyPath(relPath) {
  const normalized = toPosix(relPath).toLowerCase();
  const parts = normalized.split("/");
  if (parts.some((part) => GENERATED_DIRS.has(part))) return true;
  if (/(^|\/)assets\/fonts\//.test(normalized) || /(^|\/)fonts\//.test(normalized)) return true;
  return /\.min\.(?:js|mjs|cjs|css|scss)$/.test(normalized) || /\.map$/.test(normalized);
}

export function shouldScanFile(relPath) {
  const normalized = toPosix(relPath);
  if (normalized.split("/").some((part) => SKIP_DIRS.has(part.toLowerCase()))) return false;
  if (isGeneratedOrThirdPartyPath(normalized)) return false;
  const ext = path.extname(normalized).toLowerCase();
  if (!EXTENSIONS.has(ext)) return false;
  if (ext === ".json" && !shouldScanJson(normalized)) return false;
  return true;
}

export function shouldSkipDirectory(name) {
  return SKIP_DIRS.has(name.toLowerCase());
}

export function isTestPath(relPath) {
  const normalized = toPosix(relPath).toLowerCase();
  const base = path.basename(normalized);
  return /(^|\/)(tests?|__tests__)\//.test(normalized)
    || /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)
    || /^test-.*\.(?:[cm]?[jt]sx?|sh|bash|zsh|ps1|psm1)$/.test(base);
}

export function categoryFor(relPath) {
  const categories = [];
  if (isTestPath(relPath)) categories.push("test");
  if (/runtime|runner|route-actions|ipc|bridge|event|core-service|desktop|actions|service/.test(relPath)) {
    categories.push("core-runtime");
  }
  if (/token|schema|contract|registry|theme|config|manifest/.test(relPath)) {
    categories.push("token-schema-config");
  }
  if (/\.(tsx|jsx|vue|svelte)$/.test(relPath) || /(^|\/)components?\//.test(relPath)) {
    categories.push("ui-component");
  }
  return categories.length > 0 ? categories : ["source"];
}

export function diagnosticFileSeverity(relPath, lines) {
  if (isTestPath(relPath)) return lines > LIMITS.testFileLines ? "hotspot" : "warn";
  if (lines > LIMITS.fileBlocker) return "blocker";
  if (lines > LIMITS.fileHotspot) return "hotspot";
  return "warn";
}

export function ratchetSeverity({ currentLines, baselineLines, limit, staged, fallback = "warn" }) {
  if (currentLines <= limit) return null;
  if (!staged) return fallback;
  if (baselineLines !== null && baselineLines > limit && currentLines <= baselineLines) return fallback;
  return "blocker";
}
