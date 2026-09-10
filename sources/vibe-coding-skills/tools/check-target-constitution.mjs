#!/usr/bin/env node
// Read-only target runtime constitution audit.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { assertSafeTargetRoot, inspectTargetFile } from "./safe-target-fs.mjs";
import { DEFAULT_BOOTSTRAP_MARKDOWN_GOVERNANCE } from "./markdown-governance-core.mjs";

const SKIP_DIRS = new Set([
  ".git", ".next", ".agents", ".claude", ".codex", "dist", "build", "coverage", "target", "node_modules",
  ".electron-dist", ".ddzj", ".cache", ".tmp", "tmp", "sessions", "archived_sessions",
]);
const SQLITE_RUNTIME_FILE = /\.sqlite.*$/iu;
const OWNER_IDS = ["product", "frontend", "backend", "schema", "auth", "config", "tests", "deploy"];
const PLACEHOLDERS = [
  /^\s*(?:[-*]\s*)?TODO(?:\s|[:：]|$)/mu,
  /^\s*(?:[-*]\s*)?TBD(?:\s|[:：]|$)/mu,
  /待填写/u,
  /@@/u,
];
const DEFAULT_MANIFEST_PATCH = {
  projectProfile: "docs/项目治理/项目画像.md",
  constitutionDesign: "docs/项目治理/宪法设计.md",
  markdownGovernance: { ...DEFAULT_BOOTSTRAP_MARKDOWN_GOVERNANCE },
  loadPolicy: {
    always: [],
    never: [],
    note: "always 集合每轮必加载，默认留空；只把体积 < 5KB 的核心导航文档加入 always，合计不超过 12,000 token；never 禁止自动加载；其余为 onDemand 按需加载",
  },
  taskContext: {
    enabled: false,
    taskCapsulesRoot: "docs/plans/任务",
  },
};

function parseArgs(argv) {
  const args = { root: "", skillsRoot: "", json: false, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--skills-root") args.skillsRoot = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "--strict") args.strict = true;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else if (!arg.startsWith("-") && !args.root) args.root = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node tools/check-target-constitution.mjs <target-root> --skills-root <skills-root> [--json] [--strict]`);
}

function rel(root, filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/") || ".";
}

function readJson(filePath) {
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, "")) };
  } catch (error) {
    return { error };
  }
}

function listFiles(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  const files = [];
  const hasNestedGitMarker = (directory) => {
    try {
      const marker = fs.lstatSync(path.join(directory, ".git"));
      return marker.isFile() || marker.isDirectory() || marker.isSymbolicLink();
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  };
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name.toLowerCase()) && !hasNestedGitMarker(absolute)) walk(absolute);
      else if (entry.isFile() && !SQLITE_RUNTIME_FILE.test(entry.name)) files.push(rel(root, absolute));
    }
  };
  walk(root);
  return files.sort();
}

function hasAny(files, patterns) {
  return files.some((file) => patterns.some((pattern) => pattern.test(file)));
}

function isBackendSourceFile(file) {
  return /^(?:(?:apps|packages)\/[^/]+\/)?(?:app\/api|src\/(?:server|api|routes))\//u.test(file);
}

function makeOwner(id, verified, evidence, note) {
  return { id, status: verified ? "verified" : "unverified", evidence, note };
}

function detectPackageManager(files) {
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("package-lock.json")) return "npm";
  if (files.includes("bun.lockb") || files.includes("bun.lock")) return "bun";
  return files.includes("package.json") ? "npm" : "未验证";
}

function collectEvidence(root, skillsRoot, findings, rootSafe = true) {
  const files = rootSafe ? listFiles(root) : [];
  let packageJson = null;
  let manifestJson = null;
  if (rootSafe) {
    for (const [file, id] of [["package.json", "package-json"], [".vibe-docs.json", "vibe-docs-json"]]) {
      try {
        const state = inspectTargetFile(root, file);
        const parsed = state.exists ? readJson(state.path) : null;
        if (file === "package.json") packageJson = parsed;
        else manifestJson = parsed;
      } catch (error) {
        findings.push({ severity: "blocker", id, message: `Unsafe ${file}: ${error.message}` });
        if (file === "package.json") packageJson = { error };
        else manifestJson = { error };
      }
    }
  }
  const scripts = packageJson?.value?.scripts && typeof packageJson.value.scripts === "object" ? packageJson.value.scripts : {};
  const deps = {
    ...((packageJson?.value?.dependencies && typeof packageJson.value.dependencies === "object") ? packageJson.value.dependencies : {}),
    ...((packageJson?.value?.devDependencies && typeof packageJson.value.devDependencies === "object") ? packageJson.value.devDependencies : {}),
  };

  if (packageJson?.error) findings.push({ severity: "blocker", id: "package-json", message: `Invalid package.json: ${packageJson.error.message}` });
  if (manifestJson?.error) findings.push({ severity: "blocker", id: "vibe-docs-json", message: `Invalid .vibe-docs.json: ${manifestJson.error.message}` });

  const hasSkillIndex = fs.existsSync(path.join(skillsRoot, "skills", "INDEX.md"));
  const hasRuntimeWriter = fs.existsSync(path.join(skillsRoot, "tools", "init-target-runtime.mjs"));
  const hasConstitutionChecker = fs.existsSync(path.join(skillsRoot, "tools", "check-target-constitution.mjs"));

  return {
    files,
    scripts,
    dependencies: Object.keys(deps).sort(),
    packageManager: detectPackageManager(files),
    manifest: manifestJson?.value || null,
    skillsRootValid: hasRuntimeWriter && (hasSkillIndex || hasConstitutionChecker),
    skillsRootKind: hasSkillIndex ? "skills-package" : hasRuntimeWriter && hasConstitutionChecker ? "target-tool-bundle" : "invalid",
    packageJsonValid: !packageJson?.error,
  };
}

function buildOwners(root, evidence) {
  const files = evidence.files;
  const deps = evidence.dependencies.join(" ");
  const scripts = evidence.scripts;
  const hasScript = (...names) => names.some((name) => Object.hasOwn(scripts, name));
  const backendSources = files.filter(isBackendSourceFile);
  // 命中 owner verified 判定的依赖名，必须回填进 evidence，
  // 否则会出现“靠依赖判 verified 但 evidence 为空”的自相矛盾（A1）。
  const depsMatching = (pattern) => evidence.dependencies.filter((name) => pattern.test(name)).map((name) => `dep:${name}`);

  return [
    makeOwner("product", files.includes(".vibe-docs.json") || hasAny(files, [/^需求文档\.md$/u, /^README\.md$/u]), files.filter((file) => [".vibe-docs.json", "需求文档.md", "README.md"].includes(file)), "产品边界和生命周期文档映射"),
    makeOwner("frontend", hasAny(files, [/^(src|app|pages)\//u, /\.(tsx|jsx|vue|svelte|html|css)$/u]) || /react|vue|svelte|next|vite/.test(deps), [...files.filter((file) => /^(src|app|pages)\//u.test(file)), ...depsMatching(/^(react|vue|svelte|next|vite)/u)].slice(0, 8), "前端页面或前端依赖"),
    makeOwner("backend", backendSources.length > 0 || /express|fastify|hono|next/.test(deps), [...backendSources, ...depsMatching(/^(express|fastify|hono|next)/u)].slice(0, 8), "API、server route 或后端依赖"),
    makeOwner("schema", hasAny(files, [/^prisma\/schema\.prisma$/u, /migrations\//u, /(^|\/)schema\.(ts|js|json|sql)$/u]), files.filter((file) => /^prisma\/schema\.prisma$/u.test(file) || /migrations\//u.test(file) || /(^|\/)schema\.(ts|js|json|sql)$/u.test(file)).slice(0, 8), "数据 schema 或 migration"),
    makeOwner("auth", hasAny(files, [/(^|\/)(auth|permission|rbac)[-.]/iu, /(^|\/)(auth|permissions|rbac)\//iu]) || /next-auth|auth0|clerk|passport/.test(deps), [...files.filter((file) => /(^|\/)(auth|permission|rbac)/iu.test(file)), ...depsMatching(/^(next-auth|auth0|clerk|passport)/u)].slice(0, 8), "认证、权限或 RBAC 证据"),
    makeOwner("config", files.includes("package.json") || hasAny(files, [/tsconfig\.json$/u, /(vite|next|eslint)\.config\./u, /^\.env\.example$/u]), files.filter((file) => file === "package.json" || /tsconfig\.json$/u.test(file) || /(vite|next|eslint)\.config\./u.test(file) || file === ".env.example").slice(0, 8), "配置文件和环境变量样例"),
    makeOwner("tests", hasScript("test", "smoke") || hasAny(files, [/^(test|tests|__tests__)\//u, /\.(test|spec)\.(ts|tsx|js|jsx)$/u]), [...Object.keys(scripts).filter((name) => ["test", "smoke"].includes(name)), ...files.filter((file) => /^(test|tests|__tests__)\//u.test(file) || /\.(test|spec)\.(ts|tsx|js|jsx)$/u.test(file)).slice(0, 6)], "自动化测试或 smoke 入口"),
    makeOwner("deploy", hasScript("deploy") || hasAny(files, [/^Dockerfile$/u, /^vercel\.json$/u, /^netlify\.toml$/u, /^\.github\/workflows\//u]), [...Object.keys(scripts).filter((name) => name === "deploy"), ...files.filter((file) => /^Dockerfile$/u.test(file) || /^vercel\.json$/u.test(file) || /^netlify\.toml$/u.test(file) || /^\.github\/workflows\//u.test(file)).slice(0, 8)], "部署配置、CI 或 deploy 脚本"),
  ].filter((owner) => OWNER_IDS.includes(owner.id));
}

function detectStack(evidence) {
  const files = evidence.files;
  const deps = evidence.dependencies;
  const depText = deps.join(" ");
  const language = files.some((file) => /\.(ts|tsx)$/u.test(file)) ? "TypeScript" : files.some((file) => /\.(js|jsx|mjs|cjs)$/u.test(file)) ? "JavaScript" : "未验证";
  const frameworks = [];
  if (/next/.test(depText) || files.some((file) => /^next\.config\./u.test(file))) frameworks.push("Next.js");
  if (/vite/.test(depText) || files.some((file) => /^vite\.config\./u.test(file))) frameworks.push("Vite");
  if (/react/.test(depText)) frameworks.push("React");
  if (/electron/.test(depText) || files.some((file) => /^electron\//u.test(file))) frameworks.push("Electron");
  if (/express/.test(depText)) frameworks.push("Express");
  if (/fastify/.test(depText)) frameworks.push("Fastify");
  return {
    language,
    framework: frameworks.length > 0 ? frameworks.join(" + ") : "未验证",
    packageManager: evidence.packageManager,
    entryFiles: files.filter((file) => /^(src\/index|src\/main|app\/layout|pages\/index|electron\/main)\.(ts|tsx|js|jsx|mjs)$/u.test(file)).slice(0, 8),
    configFiles: files.filter((file) => file === "package.json" || /(^|\/)(tsconfig|vite|next|eslint|playwright|vitest|jest)\.config|\btsconfig\.json$/u.test(file)).slice(0, 10),
  };
}

function buildValidationCommands(evidence) {
  const scripts = evidence.scripts;
  const commands = [];
  const addScript = (name, purpose) => {
    if (Object.hasOwn(scripts, name)) commands.push({ name, command: `npm run ${name}`, purpose, status: "verified" });
  };
  addScript("check:health", "统一目标项目体检");
  addScript("build", "构建或类型验证");
  addScript("test", "自动化测试");
  addScript("smoke", "smoke 验证");
  addScript("dev", "本地启动");
  addScript("deploy", "部署");
  return {
    packageManager: evidence.packageManager,
    commands,
    unverified: ["check:health", "build", "test", "smoke", "dev"].filter((name) => !Object.hasOwn(scripts, name)),
  };
}

function buildStopConditions(owners) {
  const missing = new Set(owners.filter((owner) => owner.status === "unverified").map((owner) => owner.id));
  const conditions = [
    "没有读取 `.vibe-docs.json` 和当前任务相关真源时，不开始中高风险任务。",
    "没有实际运行过命令、截图、日志、报告或用户验收路径时，不声明完成、通过或修好。",
    "没有复现、源码、配置、日志或命令输出证据时，不断言 bug 根因。",
    "涉及 API、schema、auth、permission、payment、deployment、migration、secret、数据删除或公开访问时，先确认 owner、真源和验证路径。",
  ];
  for (const id of ["backend", "schema", "auth", "deploy"]) {
    if (missing.has(id)) conditions.push(`${id} 证据缺失时，该能力只能标记为 未验证，不得写成已落地。`);
  }
  return conditions;
}

function buildClauseMap(evidence, owners, validationCommands) {
  const ownerEvidence = owners.flatMap((owner) => owner.evidence.map((item) => `${owner.id}:${item}`));
  const implementationEvidence = evidence.files.filter((file) => [".vibe-docs.json", "package.json", "README.md"].includes(file)).slice(0, 3);
  return [
    { clause: "真源入口", decision: "rewrite", evidence: evidence.files.includes(".vibe-docs.json") ? [".vibe-docs.json"] : ["未验证"], generatedRule: "先读 `.vibe-docs.json`，再通过 resolver 按当前任务显式角色/selector 读取映射文档；只读 resolver 返回的内容，不因进入 T2/T3 固定全文读取画像、需求、计划或契约。" },
    { clause: "证据纪律", decision: "keep", evidence: ownerEvidence.slice(0, 10), generatedRule: "没有真实文件、配置、命令或用户确认，不把模板愿望写成项目事实。" },
    { clause: "验收纪律", decision: "rewrite", evidence: validationCommands.commands.map((item) => item.command), generatedRule: "只使用目标项目真实存在的验证命令；缺失命令写 `未验证`。" },
    { clause: "最小实现", decision: "keep", evidence: implementationEvidence.length > 0 ? implementationEvidence : ["未验证"], generatedRule: "写代码前先查现有实现、标准库、平台能力和已安装依赖，最后才新增最小实现。" },
    { clause: "高风险停止", decision: "keep", evidence: owners.filter((owner) => owner.status === "verified").map((owner) => owner.id), generatedRule: "高风险能力改动前先确认 owner、真源和验证路径。" },
  ];
}

function inspectConstitutionText(root, files, owners, findings) {
  const ownerMap = new Map(owners.map((owner) => [owner.id, owner.status]));
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    if (!files.includes(file)) continue;
    const content = fs.readFileSync(path.join(root, file), "utf8");
    for (const pattern of PLACEHOLDERS) {
      if (pattern.test(content)) {
        findings.push({ severity: "warning", id: "constitution-placeholder", message: `${file} contains placeholder pattern ${pattern}.` });
      }
    }
    if (/遵守架构|保证质量|最佳实践|高质量/u.test(content) && !/\.vibe-docs\.json|package\.json|npm run|未验证/u.test(content)) {
      findings.push({ severity: "warning", id: "shallow-constitution", message: `${file} contains generic rules without project evidence.` });
    }
    for (const [id, pattern] of [["backend", /API|接口|endpoint/iu], ["schema", /schema|数据库|迁移/iu], ["auth", /auth|权限|认证/iu], ["deploy", /deploy|部署|上线/iu]]) {
      if (ownerMap.get(id) === "unverified" && pattern.test(content) && !/未验证/u.test(content)) {
        findings.push({ severity: "warning", id: `unverified-claim-${id}`, message: `${file} mentions ${id} capability without evidence or 未验证 marker.` });
      }
    }
  }

  for (const id of ["backend", "schema", "auth", "deploy"]) {
    if (ownerMap.get(id) === "unverified") findings.push({ severity: "warning", id: `unverified-${id}`, message: `${id} evidence is missing; mark this capability as 未验证.` });
  }
}

function buildProjectProfile(root, evidence, owners, gaps, stopConditions, validationCommands) {
  const stack = detectStack(evidence);
  // targetKind 只看“项目自带”的证据，排除本包 bootstrap 出来的生命周期文档与
  // 元数据，否则空项目在稳定化阶段会因自己刚生成的文件被误判为 adoption（A3）。
  const GENERATED_ARTIFACTS = new Set([
    ".vibe-docs.json", ".vibe-runtime.json", "文档索引.md",
    "项目画像.md", "宪法设计.md", "需求文档.md", "开发计划.md",
    "验收记录.md", "接口契约.md", "plans/执行光标.md",
    "经验治理.md",
    "docs/项目治理/项目画像.md", "docs/项目治理/宪法设计.md",
    "docs/需求文档.md", "docs/项目治理/开发计划.md",
    "docs/项目治理/验收记录.md", "docs/接口契约.md", "docs/plans/执行光标.md",
    "docs/项目治理/经验治理.md",
  ]);
  const projectOwnedFiles = evidence.files.filter((file) => !GENERATED_ARTIFACTS.has(file));
  const targetKind = projectOwnedFiles.length === 0 && !evidence.files.includes("package.json") ? "bootstrap" : "adoption";
  return {
    file: DEFAULT_MANIFEST_PATCH.projectProfile,
    targetKind,
    root,
    stack,
    owners,
    validationCommands,
    risks: stopConditions,
    unverified: gaps,
  };
}

export function buildReport(rootInput, skillsRootInput, strict = false) {
  const root = path.resolve(rootInput || ".");
  const skillsRoot = path.resolve(skillsRootInput || ".");
  const findings = [];
  let rootSafe = true;
  try {
    assertSafeTargetRoot(root);
  } catch (error) {
    rootSafe = false;
    findings.push({ severity: "blocker", id: "target-root", message: error.message });
  }
  if (!fs.existsSync(skillsRoot) || !fs.statSync(skillsRoot).isDirectory()) findings.push({ severity: "blocker", id: "skills-root", message: `Skills root is not a directory: ${skillsRoot}` });

  const evidence = collectEvidence(root, skillsRoot, findings, rootSafe);
  if (!evidence.skillsRootValid) findings.push({ severity: "blocker", id: "skills-root-invalid", message: "skills root must contain tools/init-target-runtime.mjs and either skills/INDEX.md or tools/check-target-constitution.mjs." });

  const owners = rootSafe ? buildOwners(root, evidence) : [];
  if (rootSafe) inspectConstitutionText(root, evidence.files, owners, findings);
  const gaps = owners.filter((owner) => owner.status === "unverified").map((owner) => ({ id: owner.id, status: "未验证", note: owner.note }));
  const stopConditions = buildStopConditions(owners);
  const validationCommands = buildValidationCommands(evidence);
  const clauseMap = buildClauseMap(evidence, owners, validationCommands);
  const projectProfile = buildProjectProfile(root, evidence, owners, gaps, stopConditions, validationCommands);
  const unverifiedCapabilities = gaps.map((gap) => gap.id);
  const blockers = findings.filter((finding) => finding.severity === "blocker").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;

  return {
    ok: blockers === 0 && (!strict || warnings === 0),
    root,
    skillsRoot,
    evidence,
    owners,
    gaps,
    findings,
    projectProfile,
    clauseMap,
    stopConditions,
    validationCommands,
    unverifiedCapabilities,
    recommendedManifestPatch: DEFAULT_MANIFEST_PATCH,
    summary: { blockers, warnings },
  };
}

function printText(report) {
  console.log(`Target constitution audit: ${report.root}`);
  for (const owner of report.owners) {
    console.log(`[${owner.status.toUpperCase()}] ${owner.id}: ${owner.note}`);
    if (owner.evidence.length > 0) console.log(`  evidence: ${owner.evidence.join(", ")}`);
  }
  for (const finding of report.findings) console.log(`[${finding.severity.toUpperCase()}] ${finding.id}: ${finding.message}`);
  console.log(`Result: ${report.ok ? "PASS" : report.summary.blockers > 0 ? "BLOCKED" : "FAIL"}`);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.root || !args.skillsRoot) {
      usage();
      process.exitCode = args.help ? 0 : 2;
    } else {
      const report = buildReport(args.root, args.skillsRoot, args.strict);
      if (args.json) console.log(JSON.stringify(report, null, 2));
      else printText(report);
      process.exitCode = report.summary.blockers > 0 ? 2 : report.ok ? 0 : 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
