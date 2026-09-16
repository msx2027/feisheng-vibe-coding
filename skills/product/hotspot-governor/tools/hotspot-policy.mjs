// vibe-coding-skills:managed-hotspot-tool
// DocMap: L3 / tools；与 check-hotspots、hotspot-governor、dev-builder、tools/INDEX 同步。
// 核心热区阈值与路径分类真源；扫描器、脚手架和文档不得另设冲突数字。
import { createHash } from "node:crypto";
import path from "node:path";

export const LIMITS = Object.freeze({
  productionFileLines: 300,
  testFileWarn: 300,
  testFileLines: 800,
  fileHotspot: 800,
  fileBlocker: 1500,
  functionLines: 100,
  testFunctionLines: 250,
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

export const DUPLICATE_HELPER_FILE_EXCEPTIONS = new Map([
  ["ensurePolling", new Set([
    "app/src/screens/useAgentApprovalChannel.ts",
    "app/src/screens/useConversationEventRefresh.ts",
  ])],
  ["isInside", new Set([
    "tools/hotspot-files.mjs",
    "tools/trusted-git.mjs",
  ])],
  // 四个 CLI 工具各自解析自己的参数（--staged / --json、--repo-root + --worktree-path、
  // --repo-root + --agent + --task），同名但职责独立，抽公共层等于给互不相干的参数集硬造
  // 一个万能解析器。名单按「精确集合相等」匹配：出现第 5 处必须重新审计后登记，不会被静默吞掉。
  ["parseArgs", new Set([
    "tools/check-hotspots.mjs",
    "tools/check-runtime-sync.mjs",
    "tools/check-worktree-location.mjs",
    "tools/create-isolated-worktree.mjs",
  ])],
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
  ".rs",
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
]);

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "target",
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

export const toPosix = (value) => value.replace(/\\/g, "/");

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
    || /^test-.*\.(?:[cm]?[jt]sx?|sh|bash|zsh|ps1|psm1)$/.test(base)
    // Rust 用后缀命名测试文件（xxx_tests.rs / xxx_test.rs），既不带 .test. 中缀也不一定
    // 在 tests/ 目录下。漏掉这条会把纯测试文件按生产线拦住，逼人把断言拆散。
    // 只认 _test(s) 结尾，避免 test_hooks.rs 这类生产辅助文件被误放宽。
    || /_tests?\.rs$/.test(base);
}

// 测试函数是验收流水线（准备夹具 → 触发 → 逐条断言），天生比生产函数长；
// 硬按生产线拆反而把断言拆散、更难读，所以沿用「测试比生产宽」的既有惯例单独定线。
// 取值贴现存最长测试函数的实际行数、不预留余量（用户 2026-07-31 拍板）：放宽等于
// 给全库上千个测试函数一起发通行证，而超线的根因通常是重复样板这类噪音、不是内容。
// 贴线保留「谁碰它都被提醒该收样板」这个信号。
// 250 = 收样板轮做完后的实际极值：原先最长的那个 300 行函数
// （codex_service/tests/turn_success.rs 的会话快照投影测试）已抽出事件构造 helper，
// 七条事件不再各自照抄五个恒定字段，实测降到 247 行，断言一行未动。
export function functionLineLimit(relPath) {
  return isTestPath(relPath) ? LIMITS.testFunctionLines : LIMITS.functionLines;
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

export const HOTSPOT_EXCEPTIONS_REL = "tools/hotspot-exceptions.json";

function failException(message) {
  const error = new Error(message);
  error.exitCode = 2;
  throw error;
}

export function parseHotspotExceptions(text) {
  if (text === null) return new Map();
  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    failException(`hotspot-exceptions.json 无法解析：${error.message}`);
  }
  if (!config || config.version !== 1 || !Array.isArray(config.exceptions)) {
    failException("hotspot-exceptions.json schema 无效：需要 version=1 且 exceptions 为数组");
  }
  if (config.exceptions.length > 1000) failException("hotspot-exceptions.json 最多登记 1000 项");
  const exceptions = new Map();
  for (const item of config.exceptions) {
    const relPath = typeof item?.path === "string" ? toPosix(item.path) : "";
    const segments = relPath.split("/");
    const validPath = item?.path === relPath
      && /\.rs$/i.test(relPath)
      && !path.posix.isAbsolute(relPath)
      && segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
    if (!validPath || !/^[a-f0-9]{64}$/.test(item?.contentSha256 || "") || typeof item?.reason !== "string" || item.reason.trim() === "") {
      failException("hotspot-exceptions.json 含无效例外登记");
    }
    if (exceptions.has(relPath)) failException(`例外路径重复：${relPath}`);
    exceptions.set(relPath, item);
  }
  return exceptions;
}

export function contentSha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// 例外采用保守白名单：仅允许单行 Rust 类型别名，不尝试猜测任意表达式是否“像声明”。
export function isPureRustTypeDeclarations(text) {
  let found = false;
  for (const sourceLine of text.split(/\r\n|\n|\r/)) {
    const line = sourceLine.replace(/\/\/.*$/, "").trim();
    if (line === "") continue;
    if (!/^(?:pub(?:\s*\([^)]*\))?\s+)?type\s+(?:r#)?[A-Za-z_][A-Za-z0-9_]*(?:\s*<[^{};=]*>)?\s*=\s*[^{};=!|]+;$/.test(line)) {
      return false;
    }
    found = true;
  }
  return found;
}

export function isApprovedHotspotException(exceptions, relPath, text) {
  const entry = exceptions.get(relPath);
  if (!entry) return false;
  if (contentSha256(text) !== entry.contentSha256) failException(`例外内容摘要不符：${relPath}`);
  if (!isPureRustTypeDeclarations(text)) failException(`例外只允许 Rust 纯类型声明：${relPath}`);
  return true;
}

export function assertAllExceptionsSeen(exceptions, seenPaths) {
  for (const relPath of exceptions.keys()) {
    if (!seenPaths.has(relPath)) failException(`例外文件不存在、越出仓库或未进入扫描范围：${relPath}`);
  }
}
