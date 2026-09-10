// DocMap:
// Layer: L3 / 关键脚本
// Module: tools
// Depends on: tools/structural-gate.sh, tools/check-ui-reuse.mjs, tools/test-structural-gate.sh, tools/pre-commit-gate.sh
// Syncs with: Product-Spec.md, DEV-PLAN.md, tools/INDEX.md
// Structural lint checks for JS / TS repositories.

import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { runUiReuseCheck } from "./check-ui-reuse.mjs";
import { spawnTrustedGit, splitNullUtf8 } from "./trusted-git.mjs";

const ROOT = resolve(process.argv[2] || ".");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
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
]);
const LIMITS = {
  functionLines: 100,
  componentLines: 180,
  params: 4,
  complexity: 10,
  nesting: 4,
  stagedFilesWarn: 8,
  featureDirsWarn: 3,
};
const LOW_LAYERS = new Set(["lib", "services", "utils", "types"]);
const MIDDLE_LAYERS = new Set(["components", "hooks"]);
const HIGH_LAYERS = new Set(["pages", "app", "entrypoints"]);
const NON_FEATURE_SCOPE_ROOTS = new Set([
  ...LOW_LAYERS,
  ...MIDDLE_LAYERS,
  ...HIGH_LAYERS,
  "commands",
  "core",
  "electron",
  "scripts",
  "shared",
  "test",
  "tests",
  "tools",
  "__mocks__",
  "__tests__",
]);
const SCAN_ROOT_NAMES = [
  "src",
  "app",
  "pages",
  "components",
  "hooks",
  "lib",
  "electron",
  "entrypoints",
  "commands",
  "services",
  "utils",
  "types",
];

const toPosix = (value) => value.split("\\").join("/");
const under = (base, target) => target === base || target.startsWith(`${base}/`);
const countMatches = (text, pattern) => text.match(pattern)?.length || 0;
const unsafeEntries = new Set();

function printList(title, items) {
  console.error(title);
  for (const item of items) {
    console.error(`  - ${item}`);
  }
}

function skip(message) {
  console.log(message);
  process.exit(0);
}

function walk(dir, maxDepth = Infinity, depth = 0) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = join(dir, entry.name);
    const entryStat = lstatSync(fullPath);
    if (entryStat.isSymbolicLink()) {
      unsafeEntries.add(fullPath);
    } else if (entryStat.isDirectory()) {
      if (depth < maxDepth) {
        files.push(...walk(fullPath, maxDepth, depth + 1));
      }
    } else if (entryStat.isFile()) {
      files.push(fullPath);
    } else {
      unsafeEntries.add(fullPath);
    }
  }
  return files;
}

function safeDirectory(directory) {
  try {
    const directoryStat = lstatSync(directory);
    if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
      unsafeEntries.add(directory);
      return false;
    }
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function safeRegularFile(file) {
  try {
    const fileStat = lstatSync(file);
    if (fileStat.isSymbolicLink()) {
      unsafeEntries.add(file);
      return false;
    }
    if (fileStat.isDirectory()) {
      return false;
    }
    if (!fileStat.isFile()) {
      unsafeEntries.add(file);
      return false;
    }
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function blockUnsafeEntries() {
  if (unsafeEntries.size === 0) return;
  printList(
    "结构门禁拒绝 symlink / junction / 非 regular 文件：",
    [...unsafeEntries].map((file) => toPosix(relative(ROOT, file))).sort(),
  );
  process.exit(2);
}

function findTsconfig() {
  return walk(ROOT, 3).find((file) => file.endsWith("tsconfig.json")) || null;
}

function parseTsconfig(tsconfigPath) {
  try {
    const parsed = JSON.parse(readFileSync(tsconfigPath, "utf8"));
    const options = parsed.compilerOptions || {};
    return {
      baseUrl: resolve(dirname(tsconfigPath), options.baseUrl || "."),
      paths: options.paths || {},
    };
  } catch {
    return {
      baseUrl: dirname(tsconfigPath),
      paths: {},
    };
  }
}

function listCodeFiles(projectRoot) {
  const scanRoots = SCAN_ROOT_NAMES
    .map((name) => join(projectRoot, name))
    .filter((directory) => safeDirectory(directory));
  const roots = scanRoots.length > 0 ? [...new Set(scanRoots)] : [projectRoot];

  return roots.flatMap((dir) =>
    walk(dir).filter((file) => EXTENSIONS.some((extension) => file.toLowerCase().endsWith(extension))),
  );
}

function stagedCodeFiles(projectRoot) {
  const result = spawnTrustedGit(ROOT, ["diff", "--cached", "--name-only", "--diff-filter=ACMRD", "-z", "--"], {
    encoding: null,
  });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    return null;
  }

  return splitNullUtf8(result.stdout)
    .map((entry) => resolve(ROOT, entry))
    .filter((file) => under(toPosix(projectRoot), toPosix(file)))
    .filter((file) => EXTENSIONS.some((extension) => file.toLowerCase().endsWith(extension)));
}

function relativeCodePath(projectRoot, file) {
  return toPosix(relative(projectRoot, file));
}

function pathParts(relPath) {
  const parts = relPath.split("/").filter(Boolean);
  return parts[0] === "src" ? parts.slice(1) : parts;
}

function projectLayer(relPath) {
  return pathParts(relPath)[0] || "";
}

function changeScope(relPath) {
  const parts = pathParts(relPath);
  if (parts[0] === "features" && parts[1]) {
    return `features/${parts[1]}`;
  }
  if (NON_FEATURE_SCOPE_ROOTS.has(parts[0] || "")) {
    return "";
  }
  return parts[0] || "";
}

function resolveCandidate(candidate) {
  const candidates = [
    candidate,
    ...EXTENSIONS.map((extension) => `${candidate}${extension}`),
    ...EXTENSIONS.map((extension) => join(candidate, `index${extension}`)),
  ];

  return candidates.find((file) => safeRegularFile(file)) || null;
}

function resolveImport(fromFile, specifier, config) {
  const candidates = [];

  if (specifier.startsWith(".")) {
    candidates.push(resolve(dirname(fromFile), specifier));
  }

  if (specifier.startsWith("@/")) {
    candidates.push(resolve(config.baseUrl, specifier.slice(2)));
  }

  for (const [pattern, rawTargets] of Object.entries(config.paths)) {
    const targets = Array.isArray(rawTargets) ? rawTargets : [rawTargets];
    const starIndex = pattern.indexOf("*");
    const prefix = starIndex === -1 ? pattern : pattern.slice(0, starIndex);
    const suffix = starIndex === -1 ? "" : pattern.slice(starIndex + 1);
    const matched =
      starIndex === -1
        ? specifier === pattern
        : specifier.startsWith(prefix) && specifier.endsWith(suffix);

    if (!matched) {
      continue;
    }

    const fill = starIndex === -1 ? "" : specifier.slice(prefix.length, specifier.length - suffix.length);
    for (const target of targets) {
      candidates.push(resolve(config.baseUrl, target.replace("*", fill)));
    }
  }

  if (!specifier.startsWith(".") && !specifier.startsWith("@")) {
    candidates.push(resolve(config.baseUrl, specifier));
  }

  return candidates.map(resolveCandidate).find(Boolean) || null;
}

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}

function stripComments(text) {
  return stripBlockComments(text).replace(/\/\/.*$/gm, "");
}

function stripNonCode(text) {
  return stripComments(text).replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""');
}

function importSpecifiers(text) {
  const plain = stripComments(text);
  const matches = [];
  const patterns = [
    /\bimport\s+[^'"]*?\bfrom\s+["']([^"']+)["']/g,
    /\bexport\s+[^'"]*?\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(plain))) {
      matches.push(match[1]);
    }
  }

  return matches;
}

function countParams(signature) {
  const content = signature.trim();
  if (!content) {
    return 0;
  }

  let depth = 0;
  let count = 1;
  for (const char of content) {
    if ("([{<".includes(char)) {
      depth += 1;
    } else if (")]}>" .includes(char)) {
      depth = Math.max(0, depth - 1);
    } else if (char === "," && depth === 0) {
      count += 1;
    }
  }
  return count;
}

function countComplexity(body) {
  const plain = stripNonCode(body);
  const counts = [
    countMatches(plain, /\bif\b/g),
    countMatches(plain, /\bfor\b/g),
    countMatches(plain, /\bwhile\b/g),
    countMatches(plain, /\bcase\b/g),
    countMatches(plain, /\bcatch\b/g),
    countMatches(plain, /&&|\|\|/g),
    countMatches(plain, /\?(?![?.])/g),
  ];
  return 1 + counts.reduce((sum, value) => sum + value, 0);
}

function countNesting(lines) {
  let depth = 0;
  let maxDepth = 0;

  for (const raw of lines) {
    const line = stripNonCode(raw);
    if (/\b(if|for|while|switch|try|catch|else)\b[^{]*\{/.test(line)) {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
    }
    depth = Math.max(0, depth - countMatches(line, /\}/g));
  }

  return maxDepth;
}

function signatureState(signature) {
  const plain = stripNonCode(signature);
  const arrowMatch = plain.match(/\)\s*(?::[\s\S]*?)?=>/);
  if (arrowMatch) {
    const tail = plain.slice((arrowMatch.index || 0) + arrowMatch[0].length).trimStart();
    if (!tail) {
      return { complete: false, bodyType: null };
    }
    return { complete: true, bodyType: tail.startsWith("{") ? "block" : "expression" };
  }
  return { complete: /\)\s*(?::[\s\S]*?)?\{/.test(plain), bodyType: "block" };
}

function initialBlockBalance(signature) {
  const plain = stripNonCode(signature);
  const arrowIndex = plain.indexOf("=>");
  const braceIndex = arrowIndex === -1 ? plain.lastIndexOf("{") : plain.indexOf("{", arrowIndex + 2);
  if (braceIndex === -1) {
    return 0;
  }
  const tail = plain.slice(braceIndex);
  return countMatches(tail, /\{/g) - countMatches(tail, /\}/g);
}

function endsWithContinuation(text) {
  return /(?:=>|&&|\|\||\?\?|[([{,:?+\-*/%&|^!=<>.])$/.test(text);
}

function startsWithContinuation(text) {
  return /^(?:&&|\|\||\?\?|[([{.,:?+\-*/%&|^!=<>])/.test(text);
}

function findExpressionEnd(lines, startIndex) {
  const depth = { paren: 0, bracket: 0, brace: 0 };

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = stripNonCode(lines[index]);
    const segment = index === startIndex && line.includes("=>") ? line.slice(line.indexOf("=>") + 2) : line;

    for (const char of segment) {
      if (char === "(") depth.paren += 1;
      else if (char === ")") depth.paren = Math.max(0, depth.paren - 1);
      else if (char === "[") depth.bracket += 1;
      else if (char === "]") depth.bracket = Math.max(0, depth.bracket - 1);
      else if (char === "{") depth.brace += 1;
      else if (char === "}") depth.brace = Math.max(0, depth.brace - 1);
      else if (char === ";" && depth.paren === 0 && depth.bracket === 0 && depth.brace === 0) return index;
    }

    const current = segment.trim();
    const next = index + 1 < lines.length ? stripNonCode(lines[index + 1]).trim() : "";
    if (
      depth.paren === 0 &&
      depth.bracket === 0 &&
      depth.brace === 0 &&
      !endsWithContinuation(current) &&
      !startsWithContinuation(next)
    ) {
      return index;
    }
  }

  return lines.length - 1;
}

function scanFunctions(file, relPath) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const issues = [];

  for (let index = 0; index < lines.length; index += 1) {
    const start = lines[index];
    const match =
      start.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\((.*)$/) ||
      start.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:<[^=]*>\s*)?\((.*)$/);

    if (!match) {
      continue;
    }

    const name = match[1];
    let signature = start;
    let end = index;
    let state = signatureState(signature);

    while (!state.complete && end + 1 < lines.length) {
      end += 1;
      signature += `\n${lines[end]}`;
      state = signatureState(signature);
    }

    if (state.bodyType === "expression") {
      end = findExpressionEnd(lines, end);
    } else {
      let balance = initialBlockBalance(signature);
      while (balance > 0 && end + 1 < lines.length) {
        end += 1;
        const nextLine = stripNonCode(lines[end]);
        balance += countMatches(nextLine, /\{/g) - countMatches(nextLine, /\}/g);
      }
    }

    const fnLines = end - index + 1;
    const paramsMatch = signature.match(/\(([\s\S]*?)\)\s*(?::[\s\S]*?)?(?:=>|\{)/);
    const params = countParams(paramsMatch ? paramsMatch[1] : "");
    const bodyLines = lines.slice(index, end + 1);
    const bodyText = bodyLines.join("\n");
    const complexity = countComplexity(bodyText);
    const nesting = countNesting(bodyLines);
    const isComponent = /^[A-Z]/.test(name) || relPath.includes("/components/");

    if (!isComponent && fnLines > LIMITS.functionLines) {
      issues.push(`${relPath}:${index + 1} 函数 ${name} 超过 ${LIMITS.functionLines} 行（实际 ${fnLines}）`);
    }
    if (isComponent && fnLines > LIMITS.componentLines) {
      issues.push(`${relPath}:${index + 1} 组件 ${name} 超过 ${LIMITS.componentLines} 行（实际 ${fnLines}）`);
    }
    if (params > LIMITS.params) {
      issues.push(`${relPath}:${index + 1} 函数 ${name} 参数超过 ${LIMITS.params} 个（实际 ${params}）`);
    }
    if (complexity > LIMITS.complexity) {
      issues.push(`${relPath}:${index + 1} 函数 ${name} 复杂度超过 ${LIMITS.complexity}（实际 ${complexity}）`);
    }
    if (nesting > LIMITS.nesting) {
      issues.push(`${relPath}:${index + 1} 函数 ${name} 嵌套超过 ${LIMITS.nesting} 层（实际 ${nesting}）`);
    }

    index = end;
  }

  return issues;
}

function layerViolation(sourceLayer, targetLayer) {
  if (!sourceLayer || !targetLayer || sourceLayer === targetLayer) {
    return false;
  }
  if (LOW_LAYERS.has(sourceLayer) && (MIDDLE_LAYERS.has(targetLayer) || HIGH_LAYERS.has(targetLayer))) {
    return true;
  }
  if (MIDDLE_LAYERS.has(sourceLayer) && HIGH_LAYERS.has(targetLayer)) {
    return true;
  }
  if (sourceLayer === "hooks" && targetLayer === "components") {
    return true;
  }
  return false;
}

function detectCycles(graph, targetSet) {
  const visited = new Set();
  const stack = [];
  const seen = new Set();
  const cycles = [];

  function visit(node) {
    visited.add(node);
    stack.push(node);

    for (const next of graph.get(node) || []) {
      const cycleStart = stack.indexOf(next);
      if (cycleStart !== -1) {
        const cycle = [...stack.slice(cycleStart), next];
        const key = [...new Set(cycle)].sort().join(" -> ");
        if (!seen.has(key) && cycle.some((entry) => targetSet.has(entry))) {
          seen.add(key);
          cycles.push(cycle.join(" -> "));
        }
        continue;
      }

      if (!visited.has(next)) {
        visit(next);
      }
    }

    stack.pop();
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return cycles;
}

const tsconfigPath = findTsconfig();
blockUnsafeEntries();
const uiReuseResult = runUiReuseCheck({ root: ROOT, quiet: true });
if (uiReuseResult.issues.length > 0) {
  printList("UI 复用门禁未通过：", uiReuseResult.issues);
  process.exit(2);
}

if (!tsconfigPath) {
  skip("结构门禁跳过：没有找到 tsconfig.json。");
}

const PROJECT_ROOT = dirname(tsconfigPath);
const config = parseTsconfig(tsconfigPath);
const codeFiles = listCodeFiles(PROJECT_ROOT);
blockUnsafeEntries();
if (codeFiles.length === 0) {
  skip("结构门禁跳过：没有可扫描的 JS / TS 代码。");
}

const stagedFiles = stagedCodeFiles(PROJECT_ROOT);
if (stagedFiles && stagedFiles.length === 0) {
  skip("结构门禁跳过：当前 staged 里没有 JS / TS 代码。");
}

const codeFileSet = new Set(codeFiles.map((file) => relativeCodePath(PROJECT_ROOT, file)));
const targetSet = new Set((stagedFiles || codeFiles).map((file) => relativeCodePath(PROJECT_ROOT, file)));
const graph = new Map();
const failures = [];
const warnings = [];

for (const file of codeFiles) {
  const relPath = relativeCodePath(PROJECT_ROOT, file);
  const text = readFileSync(file, "utf8");
  const imports = importSpecifiers(text)
    .map((specifier) => resolveImport(file, specifier, config))
    .filter(Boolean)
    .map((resolved) => relativeCodePath(PROJECT_ROOT, resolved))
    .filter((resolved) => codeFileSet.has(resolved));

  graph.set(relPath, imports);

  if (targetSet.has(relPath)) {
    failures.push(...scanFunctions(file, relPath));
  }

  const sourceLayer = projectLayer(relPath);
  for (const imported of imports) {
    const targetLayer = projectLayer(imported);
    if (targetSet.has(relPath) && layerViolation(sourceLayer, targetLayer)) {
      failures.push(`${relPath} 不允许跨层引用 ${imported}`);
    }
  }
}

blockUnsafeEntries();

failures.push(...detectCycles(graph, targetSet).map((cycle) => `检测到循环依赖：${cycle}`));

if (stagedFiles && stagedFiles.length > LIMITS.stagedFilesWarn) {
  warnings.push(`staged 的 JS / TS 文件超过 ${LIMITS.stagedFilesWarn} 个（实际 ${stagedFiles.length}）`);
}

if (stagedFiles) {
  const scopes = new Set(stagedFiles.map((file) => changeScope(relativeCodePath(PROJECT_ROOT, file))).filter(Boolean));
  if (scopes.size > LIMITS.featureDirsWarn) {
    warnings.push(`staged 改动跨超过 ${LIMITS.featureDirsWarn} 个顶层功能目录（实际 ${scopes.size}）`);
  }
}

if (warnings.length > 0) {
  printList("结构门禁提醒（只提醒，不拦截）：", warnings);
}

if (failures.length > 0) {
  printList("结构门禁未通过：", failures);
  process.exit(2);
}

console.log("结构门禁通过。");
