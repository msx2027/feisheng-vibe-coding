// DocMap:
// Layer: L3 / 关键脚本
// Module: tools
// Depends on: tools/structural-lint.mjs, skills/dev-builder/references/ui-token-component-reuse.md
// Syncs with: tools/INDEX.md, skills/dev-builder/templates/project-scaffolds/
// Checks that page UI consumes the shared UI/token layer instead of recreating visual primitives.

import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnTrustedGit, splitNullUtf8 } from "./trusted-git.mjs";

const FRONTEND_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".html", ".css", ".scss"]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".electron-dist",
  ".git",
  ".claude",
  ".agents",
  ".codex",
]);
const UI_ROOTS = ["packages/ui", "src/shared/ui", "src/ui", "src/components/ui", "libs/ui"];
const SCAN_ROOTS = ["src", "app", "pages", "components", "packages", "libs"];
const BASE_COMPONENT_NAMES = new Set([
  "Button",
  "Input",
  "Modal",
  "Dialog",
  "Card",
  "Badge",
  "Tabs",
  "Toast",
  "Popover",
]);
const NATIVE_CONTROLS = /\<\s*(button|input|select|textarea|dialog)(?=[\s>/])/;
const RAW_COLOR = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\(/;
const ARBITRARY_VISUAL = /\b(?:bg|text|border|from|via|to|ring|outline|decoration|accent|caret|fill|stroke)-\[(?:#|rgb|rgba|hsl|hsla|oklch|oklab)[^\]]*\]|\b(?:rounded|shadow)-\[[^\]]+\]/;
// 拦截目标：页面层里硬编码的圆角与阴影视觉值。走设计 token 的写法必须放行，
// 否则用 CSS Module + token 的项目会被误报刷满，只能整文件豁免，反而连真硬编码也拦不住。
// 判据不是「值里有没有 var(」——那样 `border-radius: 12px /* TODO var(--x) */` 和
// `border-radius: var(--r) 12px` 都会被放行。正确做法是剔掉注释与 var(...) 后看残值里
// 还有没有带单位的数字或颜色（见 hardcodedVisualValue）。
const TEMP_VISUAL_PROPERTY_NAME = /\b(?:box-shadow|border-radius)\s*:/i;
// 残值里的硬编码视觉量：带单位的长度、百分比、裸颜色。
// 不含 0 / none / inherit / unset 等重置与继承关键字——它们没有对应 token 可复用。
// 单位清单必须齐全：漏一个就是一条静默绕过路径，故连动态视口单位（dvh/svh/lvh 及其
// 轴向变体）与逻辑单位（cap/rlh/lh/ic/rex/rch）一并覆盖。
const CSS_LENGTH_UNIT =
  "px|rem|em|%|ch|ex|cap|ic|lh|rlh|rex|rch|ric|pt|pc|cm|mm|in|q|(?:d|s|l)?v(?:h|w|i|b|min|max)";
const HARDCODED_VISUAL_VALUE = new RegExp(
  `\\b\\d*\\.?\\d+(?:${CSS_LENGTH_UNIT})\\b|#[0-9a-fA-F]{3,8}\\b|\\b(?:rgb|rgba|hsl|hsla|oklch|oklab|color-mix)\\s*\\(`,
  "i",
);
const BASE_DECLARATION =
  /\b(?:export\s+)?(?:default\s+)?(?:function|class)\s+(Button|Input|Modal|Dialog|Card|Badge|Tabs|Toast|Popover)\b|\b(?:export\s+)?(?:const|let|var)\s+(Button|Input|Modal|Dialog|Card|Badge|Tabs|Toast|Popover)\s*=/;

const toPosix = (value) => value.split("\\").join("/");
const normalizePath = (value) => toPosix(value).replace(/^\.\//, "");

function walk(dir) {
  const result = { files: [], unsafe: [] };
  let rootStat;
  try {
    rootStat = lstatSync(dir);
  } catch (error) {
    if (error?.code === "ENOENT") return result;
    throw error;
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    result.unsafe.push(dir);
    return result;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = resolve(dir, entry.name);
    const entryStat = lstatSync(fullPath);
    if (entryStat.isSymbolicLink()) {
      result.unsafe.push(fullPath);
    } else if (entryStat.isDirectory()) {
      const nested = walk(fullPath);
      result.files.push(...nested.files);
      result.unsafe.push(...nested.unsafe);
    } else if (entryStat.isFile()) {
      result.files.push(fullPath);
    } else {
      result.unsafe.push(fullPath);
    }
  }
  return result;
}

function listAllFrontendFiles(root) {
  const scanned = SCAN_ROOTS.map((name) => walk(resolve(root, name)));
  return {
    files: scanned
      .flatMap((item) => item.files)
      .map((file) => normalizePath(relative(root, file)))
      .filter((filePath) => FRONTEND_EXTENSIONS.has(extname(filePath).toLowerCase())),
    issues: scanned
      .flatMap((item) => item.unsafe)
      .map((file) => `${normalizePath(relative(root, file))}: 禁止扫描 symlink / junction / 非 regular 文件`),
    skipped: "",
  };
}

function listStagedFrontendFiles(root) {
  const result = spawnTrustedGit(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z", "--"], {
    encoding: null,
  });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    return { files: [], issues: [], skipped: "not-git" };
  }

  return {
    files: splitNullUtf8(result.stdout)
      .map(normalizePath)
      .filter((filePath) => FRONTEND_EXTENSIONS.has(extname(filePath).toLowerCase())),
    issues: [],
    skipped: "",
  };
}

function isUnderAny(path, roots) {
  return roots.some((root) => path === root || path.startsWith(`${root}/`));
}

/**
 * 从 index 行起取出一条完整 CSS 声明（拼到分号或块边界为止）。
 * 多层阴影常拆成多行书写，属性名单独一行、token 在后续行，逐行判断会看不到值。
 * 最多向后合并 6 行，够覆盖常见多层阴影又不会把整个规则块吞进来。
 */
function declarationFrom(lines, index) {
  let merged = lines[index];
  // 只有本行确实起了一条目标声明才向后合并；否则注释行会把下一条声明吞进来，
  // 使报警落在注释行上、与 allow-next-line 豁免的目标行错位。
  if (/[;{}]/.test(merged) || !TEMP_VISUAL_PROPERTY_NAME.test(merged)) {
    return merged;
  }
  for (let offset = 1; offset <= 6 && index + offset < lines.length; offset += 1) {
    const next = lines[index + offset];
    merged += ` ${next}`;
    if (/[;{}]/.test(next)) {
      break;
    }
  }
  return merged;
}

/**
 * 判断一条圆角 / 阴影声明里是否留有硬编码视觉值。
 * 先剔掉 CSS 注释（避免「注释里写 var( 」替硬编码打掩护），
 * 再剔掉 var(...) 引用（含带 fallback 的嵌套形式），最后看残值。
 */
function hardcodedVisualValue(declaration) {
  if (!TEMP_VISUAL_PROPERTY_NAME.test(declaration)) {
    return false;
  }
  const value = declaration
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\*[\s\S]*$/, " ")
    .replace(/var\((?:[^()]|\([^()]*\))*\)?/gi, " ");
  return HARDCODED_VISUAL_VALUE.test(value);
}

function isUiRoot(path) {
  return isUnderAny(path, UI_ROOTS);
}

function isPageLayer(path) {
  if (isUnderAny(path, ["app", "pages", "src/app", "src/pages"])) {
    return true;
  }

  const parts = path.split("/");
  const fileName = basename(path).toLowerCase();
  return parts[0] === "src" && parts[1] === "features" && /(page|screen|view)/.test(fileName);
}

function isTokenOrThemeFile(path) {
  const name = basename(path).toLowerCase();
  return (
    name === "tokens.css" ||
    name === "theme.css" ||
    name.startsWith("design-tokens.") ||
    name.startsWith("tailwind.config.")
  );
}

function reasonAfter(line, marker) {
  const index = line.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return line
    .slice(index + marker.length)
    .replace(/\s*(?:\*\/\}?|-->|})\s*$/, "")
    .trim();
}

function allowState(lines, relPath) {
  const allowedNext = new Set();
  const issues = [];
  let fileAllowed = false;

  lines.forEach((line, index) => {
    const fileReason = reasonAfter(line, "vibe-ui-allow-file:");
    if (fileReason !== null) {
      if (!fileReason) {
        issues.push(`${relPath}:${index + 1} vibe-ui-allow-file 缺少原因`);
      } else {
        fileAllowed = true;
      }
    }

    const nextReason = reasonAfter(line, "vibe-ui-allow-next-line:");
    if (nextReason !== null) {
      if (!nextReason) {
        issues.push(`${relPath}:${index + 1} vibe-ui-allow-next-line 缺少原因`);
      } else {
        allowedNext.add(index + 2);
      }
    }
  });

  return { allowedNext, fileAllowed, issues };
}

function componentDeclarationName(line) {
  const match = line.match(BASE_DECLARATION);
  return match ? match[1] || match[2] : "";
}

function scanFile(root, relPath) {
  const absolutePath = resolve(root, relPath);
  let fileStat;
  try {
    fileStat = lstatSync(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    return [`${relPath}: 禁止扫描 symlink / junction / 非 regular 文件`];
  }
  if (!existsSync(absolutePath)) {
    return [];
  }

  const text = readFileSync(absolutePath, "utf8");
  const lines = text.split(/\r?\n/);
  const { allowedNext, fileAllowed, issues } = allowState(lines, relPath);
  if (fileAllowed) {
    return issues;
  }

  const pageLayer = isPageLayer(relPath);
  const uiRoot = isUiRoot(relPath);
  const tokenFile = isTokenOrThemeFile(relPath);
  const codeFile = CODE_EXTENSIONS.has(extname(relPath).toLowerCase());

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (allowedNext.has(lineNumber)) {
      return;
    }

    if (!uiRoot && codeFile) {
      const declared = componentDeclarationName(line);
      if (declared && BASE_COMPONENT_NAMES.has(declared)) {
        issues.push(`${relPath}:${lineNumber} 基础组件 ${declared} 必须放在 UI 包 / UI 目录`);
      }
    }

    if (!pageLayer || tokenFile) {
      return;
    }

    if (RAW_COLOR.test(line)) {
      issues.push(`${relPath}:${lineNumber} 页面层禁止裸色值，先补 design token`);
    }
    if (ARBITRARY_VISUAL.test(line)) {
      issues.push(`${relPath}:${lineNumber} 页面层禁止 Tailwind 任意视觉值，先补 token 或组件 variant`);
    }
    if (hardcodedVisualValue(declarationFrom(lines, index))) {
      issues.push(`${relPath}:${lineNumber} 页面层禁止临时圆角 / 阴影，先补 UI 组件或 token`);
    }
    if (NATIVE_CONTROLS.test(line)) {
      issues.push(`${relPath}:${lineNumber} 页面层禁止直接使用原生表单/弹窗控件，先复用 UI 组件`);
    }
  });

  return issues;
}

export function runUiReuseCheck(options = {}) {
  const root = resolve(options.root || ".");
  const all = Boolean(options.all);
  const quiet = Boolean(options.quiet);
  const result = all ? listAllFrontendFiles(root) : listStagedFrontendFiles(root);
  const files = [...new Set(result.files)].sort();
  const issues = [...(result.issues || []), ...files.flatMap((file) => scanFile(root, file))];

  if (result.skipped === "not-git" && !quiet) {
    console.log("UI 复用门禁跳过：当前目录不是 Git 仓库，且未传 --all。");
  }
  if (files.length === 0 && issues.length === 0) {
    if (!quiet) {
      console.log("UI 复用门禁跳过：没有需要扫描的前端文件。");
    }
    return { status: 0, issues: [], files };
  }

  if (issues.length > 0) {
    if (!quiet) {
      console.error("UI 复用门禁未通过：");
      for (const issue of issues) {
        console.error(`  - ${issue}`);
      }
    }
    return { status: 2, issues, files };
  }

  if (!quiet) {
    console.log("UI 复用门禁通过。");
  }
  return { status: 0, issues: [], files };
}

function parseCliArgs(argv) {
  const args = { root: ".", all: false };
  for (const arg of argv) {
    if (arg === "--all") {
      args.all = true;
    } else if (arg === "-h" || arg === "--help") {
      console.log("Usage: node tools/check-ui-reuse.mjs <project-root> [--all]");
      process.exit(0);
    } else if (!arg.startsWith("--")) {
      args.root = arg;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

const isCli = fileURLToPath(import.meta.url) === resolve(process.argv[1] || "");
if (isCli) {
  const result = runUiReuseCheck(parseCliArgs(process.argv.slice(2)));
  process.exit(result.status);
}
