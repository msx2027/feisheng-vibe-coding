#!/usr/bin/env node
// Generate target-project constitution profile docs from audited evidence.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildReport } from "./check-target-constitution.mjs";
import { assertSafeTargetRoot, inspectTargetFile } from "./safe-target-fs.mjs";
import { validateTargetDocManifest } from "./target-doc-manifest-core.mjs";
import { DEFAULT_BOOTSTRAP_MARKDOWN_GOVERNANCE } from "./markdown-governance-core.mjs";
import { finalizeDocumentIndex, metadataForDocument } from "./target-doc-index-core.mjs";
import { commitTargetTransaction, commitTargetTransactionPhases } from "./target-doc-transaction.mjs";
import { renderLedgerMarkdown } from "./experience-ledger-core.mjs";
import {
  emptyExperienceRegistry,
  parseExperienceRegistry,
  planExperienceRegistryContent,
} from "./experience-managed-blocks.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKILLS_ROOT = path.dirname(SCRIPT_DIR);
const BLOCK_VERSION = "1";
const START_PREFIX = "<!-- vibe-coding-skills:target-constitution:start";
const END_MARKER = "<!-- vibe-coding-skills:target-constitution:end -->";
const MANAGED_SECTION_PREFIXES = {
  "项目画像.md": "PROJECTPROFILE",
  "宪法设计.md": "CONSTITUTIONDESIGN",
};
const DEFAULT_DOCUMENT_PATHS = Object.freeze({
  productSpec: "docs/需求文档.md",
  devPlan: "docs/项目治理/开发计划.md",
  currentExecution: "docs/plans/执行光标.md",
  manualAcceptance: "docs/项目治理/验收记录.md",
  interfaceContracts: "docs/接口契约.md",
  projectProfile: "docs/项目治理/项目画像.md",
  constitutionDesign: "docs/项目治理/宪法设计.md",
  experienceGovernance: "docs/项目治理/经验治理.md",
  documentIndex: "文档索引.md",
});
const LEGACY_DOCUMENT_PATHS = Object.freeze({
  productSpec: "需求文档.md",
  devPlan: "开发计划.md",
  currentExecution: "plans/执行光标.md",
  manualAcceptance: "验收记录.md",
  interfaceContracts: "接口契约.md",
  projectProfile: "项目画像.md",
  constitutionDesign: "宪法设计.md",
  experienceGovernance: "经验治理.md",
  documentIndex: "文档索引.md",
});
const DEFAULT_LOAD_POLICY = {
  always: [],
  never: [],
  note: "always 集合每轮必加载，默认留空；只把体积 < 5KB 的核心导航文档加入 always，合计不超过 12,000 token；never 禁止自动加载；其余为 onDemand 按需加载",
};
const PORTABLE_TARGET_ROOT = ".";
const PORTABLE_SKILLS_ROOT = "<skills-root>";
function usage() {
  console.error(`Usage:
  node tools/init-target-constitution.mjs <target-root> [--skills-root <path>] [--dry-run|--write|--check] [--json]`);
}

function parseArgs(argv) {
  const args = { targetRoot: "", skillsRoot: "", mode: "dry-run", json: false, help: false };
  let explicitMode = false;
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--skills-root") args.skillsRoot = argv[++index] || "";
    else if (item === "--dry-run" || item === "--write" || item === "--check") {
      if (explicitMode) throw new Error("Only one mode flag is allowed.");
      args.mode = item.slice(2);
      explicitMode = true;
    } else if (item === "--json") args.json = true;
    else if (item === "-h" || item === "--help") args.help = true;
    else if (!item.startsWith("-") && !args.targetRoot) args.targetRoot = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function normalizeText(value) {
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeBody(value) {
  return normalizeText(value).replace(/\n$/u, "");
}

function normalizeManagedBody(value) {
  const normalized = normalizeBody(value);
  return normalized.startsWith("\n") ? normalized.slice(1) : normalized;
}

function normalizeManagedTablePadding(value) {
  return normalizeBody(value)
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return line;
      return `| ${trimmed
        .slice(1, -1)
        .split("|")
        .map((cell) => {
          const normalized = cell.trim();
          return /^:?-+:?$/u.test(normalized) ? "---" : normalized;
        })
        .join(" | ")} |`;
    })
    .join("\n");
}

function normalizeManagedSectionMarkers(value, file) {
  const prefix = MANAGED_SECTION_PREFIXES[path.basename(file)];
  if (!prefix) return normalizeBody(value);
  const marker = new RegExp(`^<!-- vibe-section:${prefix}-\\d+ -->$`, "u");
  const lines = normalizeBody(value).split("\n");
  return lines
    .filter((line, index) => !(marker.test(line) && /^#{1,6}\s+/u.test(lines[index + 1] || "")))
    .join("\n");
}

function managedFileIdentityMatches(markerFile, targetFile) {
  if (markerFile === targetFile) return true;
  return !markerFile.includes("/")
    && !markerFile.includes("\\")
    && markerFile === path.basename(targetFile);
}

function managedBodyVariants(value, file) {
  const normalized = normalizeBody(value);
  const withoutSectionMarkers = normalizeManagedSectionMarkers(normalized, file);
  return [
    normalized,
    normalizeManagedTablePadding(normalized),
    withoutSectionMarkers,
    normalizeManagedTablePadding(withoutSectionMarkers),
  ];
}

function checksum(body) {
  return crypto.createHash("sha256").update(normalizeBody(body), "utf8").digest("hex");
}

function matchesManagedChecksum(body, expected, file) {
  return managedBodyVariants(body, file).some((variant) => checksum(variant) === expected);
}

function sameManagedBody(left, right, file) {
  const rightVariants = new Set(managedBodyVariants(right, file));
  return managedBodyVariants(left, file).some((variant) => rightVariants.has(variant));
}

function markdownList(values) {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- 未验证";
}

function tableRows(rows) {
  return rows.length > 0 ? rows.join("\n") : "| 未验证 | 未验证 | 未验证 |";
}

function renderProfileBody(report) {
  const stack = report.projectProfile.stack;
  const commands = report.validationCommands.commands.map((item) => `\`${item.command}\`：${item.purpose}`);
  return [
    "# 项目画像",
    "",
    "## 项目边界",
    "",
    `- 项目根目录：\`${PORTABLE_TARGET_ROOT}\``,
    `- 接入类型：${report.projectProfile.targetKind === "bootstrap" ? "新项目 bootstrap" : "已有项目 adoption"}`,
    "- 项目做什么：未验证；以需求文档或用户确认内容为准。",
    "- 不做什么：未验证；没有证据的能力不得写成已完成。",
    "- 已否定方向：未验证。",
    "",
    "## 技术栈证据",
    "",
    `- 语言：${stack.language}`,
    `- 框架：${stack.framework}`,
    `- 包管理器：${stack.packageManager}`,
    `- 入口文件：${stack.entryFiles.length > 0 ? stack.entryFiles.map((item) => `\`${item}\``).join("、") : "未验证"}`,
    `- 配置文件：${stack.configFiles.length > 0 ? stack.configFiles.map((item) => `\`${item}\``).join("、") : "未验证"}`,
    "",
    "## 启动和验证",
    "",
    markdownList(commands),
    "",
    `- 缺失或未验证命令：${report.validationCommands.unverified.length > 0 ? report.validationCommands.unverified.map((item) => `\`${item}\``).join("、") : "无"}`,
    "",
    "## Owner Map",
    "",
    "| Owner | 状态 | 证据 | 说明 |",
    "| --- | --- | --- | --- |",
    ...report.owners.map((owner) => `| ${owner.id} | ${owner.status === "verified" ? "已确认" : "未验证"} | ${owner.evidence.length > 0 ? owner.evidence.map((item) => `\`${item}\``).join("<br>") : "未验证"} | ${owner.note} |`),
    "",
    "## 风险和停止条件",
    "",
    markdownList(report.stopConditions),
    "",
    "## 未验证项",
    "",
    markdownList(report.gaps.map((gap) => `${gap.id}：${gap.note}`)),
  ].join("\n");
}

function renderDesignBody(report) {
  const evidenceRows = [
    `| 项目根目录 | \`${PORTABLE_TARGET_ROOT}\` | 已确认 |`,
    `| Skills root | \`${PORTABLE_SKILLS_ROOT}\` | ${report.evidence.skillsRootValid ? "已确认" : "未验证"} |`,
    `| package.json | ${report.evidence.files.includes("package.json") ? "`package.json`" : "未验证"} | ${report.evidence.files.includes("package.json") ? "已确认" : "未验证"} |`,
    `| .vibe-docs.json | ${report.evidence.files.includes(".vibe-docs.json") ? "`.vibe-docs.json`" : "未验证"} | ${report.evidence.files.includes(".vibe-docs.json") ? "已确认" : "未验证"} |`,
  ];
  return [
    "# 宪法设计包",
    "",
    "## 项目证据包",
    "",
    "| 项目 | 证据 | 状态 |",
    "| --- | --- | --- |",
    tableRows(evidenceRows),
    "",
    "## Owner Map",
    "",
    "| 概念 | Owner | 证据 | 缺口 |",
    "| --- | --- | --- | --- |",
    ...report.owners.map((owner) => `| ${owner.note} | ${owner.id} | ${owner.evidence.length > 0 ? owner.evidence.map((item) => `\`${item}\``).join("<br>") : "未验证"} | ${owner.status === "verified" ? "无" : "未验证"} |`),
    "",
    "## 条款映射",
    "",
    "| 通用条款 | 决策 | 项目证据 | 生成规则 |",
    "| --- | --- | --- | --- |",
    ...report.clauseMap.map((item) => `| ${item.clause} | ${item.decision} | ${item.evidence.length > 0 ? item.evidence.map((value) => `\`${value}\``).join("<br>") : "未验证"} | ${item.generatedRule} |`),
    "",
    "## 停止条件",
    "",
    markdownList(report.stopConditions),
    "",
    "## 缺失证据和用户问题",
    "",
    markdownList(report.gaps.map((gap) => `${gap.id}：${gap.note}。需要用户确认或补充项目证据后才能写成已落地能力。`)),
  ].join("\n");
}

function renderBlock(file, body) {
  const hash = checksum(body);
  return `${START_PREFIX} file=${file} version=${BLOCK_VERSION} checksum=sha256:${hash} -->\n\n${body}\n${END_MARKER}`;
}

function findManagedBlock(content) {
  const start = content.indexOf(START_PREFIX);
  const endStart = content.indexOf(END_MARKER);
  if (start === -1 && endStart === -1) return null;
  if (start === -1 || endStart === -1 || endStart < start || content.indexOf(START_PREFIX, start + 1) !== -1 || content.indexOf(END_MARKER, endStart + 1) !== -1) {
    return { conflict: "Expected exactly one complete constitution block." };
  }
  if (start > 0 && content[start - 1] !== "\n") {
    return { conflict: "Constitution block start marker must begin on its own line." };
  }
  if (endStart > 0 && content[endStart - 1] !== "\n") {
    return { conflict: "Constitution block end marker must begin on its own line." };
  }
  const startLineEnd = content.indexOf("\n", start);
  if (startLineEnd === -1 || startLineEnd > endStart) {
    return { conflict: "Constitution block start marker must be on its own line." };
  }
  const startLine = content.slice(start, startLineEnd).trim();
  const marker = startLine.match(/^<!-- vibe-coding-skills:target-constitution:start file=(?<file>[^ ]+) version=(?<version>[^ ]+) checksum=sha256:(?<checksum>[a-f0-9]{64}) -->$/u);
  if (!marker?.groups) return { conflict: "Constitution block start marker is malformed." };
  return {
    start,
    end: endStart + END_MARKER.length,
    ...marker.groups,
    body: normalizeManagedBody(content.slice(startLineEnd + 1, endStart)),
  };
}

function planManagedFile(root, file, body) {
  const blockText = renderBlock(file, body);
  let state;
  try {
    state = inspectTargetFile(root, file);
  } catch (error) {
    return { file, action: "conflict", status: "fail", reason: error.message, nextContent: "" };
  }
  if (!state.exists) return { file, action: "create", status: "pending", reason: "file missing", nextContent: `${blockText}\n`, expectedContent: null };
  const current = fs.readFileSync(state.path, "utf8");
  const block = findManagedBlock(current);
  if (!block) {
    const separator = current.endsWith("\n") ? "\n" : "\n\n";
    return { file, action: "append", status: "pending", reason: "managed block missing", nextContent: `${current}${separator}${blockText}\n`, expectedContent: current };
  }
  if (block.conflict) return { file, action: "conflict", status: "fail", reason: block.conflict, nextContent: current };
  if (!managedFileIdentityMatches(block.file, file)) return { file, action: "conflict", status: "fail", reason: `managed block belongs to ${block.file}`, nextContent: current };
  if (!matchesManagedChecksum(block.body, block.checksum, file)) return { file, action: "conflict", status: "fail", reason: "managed block checksum mismatch; preserve user edits and resolve manually", nextContent: current };
  if (block.file !== file || block.version !== BLOCK_VERSION || !sameManagedBody(block.body, body, file)) {
    return { file, action: "update", status: "pending", reason: "rendered block changed", nextContent: `${current.slice(0, block.start)}${blockText}${current.slice(block.end)}`, expectedContent: current };
  }
  return { file, action: "none", status: "pass", reason: "managed block current", nextContent: current };
}

function selectDocumentPath(root, role, current = {}) {
  if (typeof current[role] === "string" && current[role] !== "") return current[role];
  const defaultPath = DEFAULT_DOCUMENT_PATHS[role];
  const legacyPath = LEGACY_DOCUMENT_PATHS[role];
  if (defaultPath === legacyPath) return defaultPath;
  if (inspectTargetFile(root, defaultPath).exists) return defaultPath;
  if (inspectTargetFile(root, legacyPath).exists) return legacyPath;
  return defaultPath;
}

function resolveDocumentPaths(root, current = {}) {
  return Object.fromEntries(Object.keys(DEFAULT_DOCUMENT_PATHS).map((role) => [role, selectDocumentPath(root, role, current)]));
}

function mergeManifest(root, current = {}, experienceContent = null) {
  const existingTaskContext =
    current.taskContext && typeof current.taskContext === "object" && !Array.isArray(current.taskContext)
      ? current.taskContext
      : {};
  const next = {
    ...current,
    projectProfile: selectDocumentPath(root, "projectProfile", current),
    constitutionDesign: selectDocumentPath(root, "constitutionDesign", current),
    loadPolicy: { ...DEFAULT_LOAD_POLICY, ...(current.loadPolicy && typeof current.loadPolicy === "object" ? current.loadPolicy : {}) },
    taskContext: {
      enabled: false,
      taskCapsulesRoot: "docs/plans/任务",
      ...existingTaskContext,
    },
  };
  // 经验库已彻底移除：重跑初始化时主动清除存量 .vibe-docs.json 里的遗留死键，
  // 使存量项目也能真正清干净，而不只是"不再写入"。
  delete next.experience;
  delete next.lessons;
  delete next.lessonsIndex;
  if (next.schemaVersion === 2 && Array.isArray(next.documents)) {
    next.experienceGovernance = DEFAULT_DOCUMENT_PATHS.experienceGovernance;
    const ledgerContent = experienceContent
      ?? (inspectTargetFile(root, DEFAULT_DOCUMENT_PATHS.experienceGovernance).exists
        ? fs.readFileSync(inspectTargetFile(root, DEFAULT_DOCUMENT_PATHS.experienceGovernance).path, "utf8")
        : initialLedgerContent());
    const experienceDocument = {
      role: "experienceGovernance",
      path: DEFAULT_DOCUMENT_PATHS.experienceGovernance,
      owner: "experience-elevator",
      authority: "source",
      dependsOn: ["constitutionDesign"],
      ...metadataForDocument(DEFAULT_DOCUMENT_PATHS.experienceGovernance, ledgerContent),
    };
    let replaced = false;
    next.documents = next.documents.map((item) => {
      if (item.role !== "experienceGovernance") return item;
      replaced = true;
      return experienceDocument;
    });
    if (!replaced) next.documents.push(experienceDocument);
  }
  return next;
}

function planPlainFile(root, file, fallbackContent) {
  let state;
  try {
    state = inspectTargetFile(root, file);
  } catch (error) {
    return { file, action: "conflict", status: "fail", reason: error.message, nextContent: "", expectedContent: null };
  }
  if (!state.exists) {
    return { file, action: "create", status: "pending", reason: "bootstrap document missing", nextContent: fallbackContent, expectedContent: null };
  }
  const current = fs.readFileSync(state.path, "utf8");
  return { file, action: "none", status: "pass", reason: "document already exists", nextContent: current, expectedContent: current };
}

function initialLedgerContent() {
  return renderLedgerMarkdown({
    vibeExperienceLedger: "v2",
    revision: 0,
    l1RegistryAnchor: null,
    thresholds: { L0: 3, L1: 5, L2: 8 },
    processedEvents: [],
    consumedConfirmations: [],
    experiences: [],
    archived: [],
  });
}

function bootstrapManifestBundle(root, paths, profileContent, designContent) {
  const initialLedger = initialLedgerContent();
  const bootstrapDefinitions = [
    ["productSpec", paths.productSpec, "product-spec-builder", "source", [], "<!-- vibe-section:PRODUCTSPEC-BOOTSTRAP -->\n# 需求文档\n\n## 当前状态\n\n- 状态：待 product-spec-builder 完善\n"],
    ["devPlan", paths.devPlan, "dev-planner", "source", ["productSpec"], "<!-- vibe-section:DEVPLAN-BOOTSTRAP -->\n# 开发计划\n\n## 当前状态\n\n- 状态：待 dev-planner 完善\n"],
    ["currentExecution", paths.currentExecution, "update-target-task-state", "projection", ["devPlan"], "<!-- vibe-section:CURRENTEXECUTION-BOOTSTRAP -->\n# 执行光标\n\n## 当前任务\n\n- 状态：未开始\n- 下一步：完善需求文档与开发计划\n"],
    ["manualAcceptance", paths.manualAcceptance, "code-review", "source", ["productSpec"], "<!-- vibe-section:MANUALACCEPTANCE-BOOTSTRAP -->\n# 验收记录\n\n## 当前状态\n\n- 状态：待验收\n- 用户确认：无\n"],
    ["interfaceContracts", paths.interfaceContracts, "project", "source", ["productSpec"], "<!-- vibe-section:INTERFACECONTRACTS-BOOTSTRAP -->\n# 接口契约\n\n## 当前状态\n\n- 已登记能力：无\n"],
    ["experienceGovernance", paths.experienceGovernance, "experience-elevator", "source", ["constitutionDesign"], initialLedger],
  ];
  const plans = bootstrapDefinitions.map(([, file, , , , content]) => planPlainFile(root, file, content));
  const contentByPath = new Map(plans.map((plan) => [plan.file, plan.nextContent]));
  contentByPath.set(paths.projectProfile, profileContent);
  contentByPath.set(paths.constitutionDesign, designContent);

  const entries = bootstrapDefinitions.map(([role, file, owner, authority, dependsOn]) => ({
    role,
    path: file,
    owner,
    authority,
    dependsOn,
    ...metadataForDocument(file, contentByPath.get(file)),
  }));
  entries.push(
    { role: "projectProfile", path: paths.projectProfile, owner: "target-constitution-setup", authority: "source", dependsOn: [], ...metadataForDocument(paths.projectProfile, profileContent) },
    { role: "constitutionDesign", path: paths.constitutionDesign, owner: "target-constitution-setup", authority: "source", dependsOn: ["projectProfile"], ...metadataForDocument(paths.constitutionDesign, designContent) },
    { role: "documentIndex", path: paths.documentIndex, owner: "build-target-doc-index", authority: "projection", dependsOn: [], contentHash: "", estimatedTokens: 0, sections: [] },
  );
  const finalized = finalizeDocumentIndex(entries, paths.documentIndex);
  const indexPlan = planPlainFile(root, finalized.indexPath, finalized.indexContent);
  if (indexPlan.action === "none" && indexPlan.nextContent !== finalized.indexContent) {
    indexPlan.action = "update";
    indexPlan.status = "pending";
    indexPlan.reason = "document index bootstrap metadata changed";
    indexPlan.nextContent = finalized.indexContent;
  }
  const manifest = {
    schemaVersion: 2,
    productSpec: paths.productSpec,
    devPlan: paths.devPlan,
    currentExecution: paths.currentExecution,
    manualAcceptance: paths.manualAcceptance,
    interfaceContracts: paths.interfaceContracts,
    projectProfile: paths.projectProfile,
    constitutionDesign: paths.constitutionDesign,
    experienceGovernance: paths.experienceGovernance,
    documentIndex: paths.documentIndex,
    documents: finalized.documents,
    markdownGovernance: { ...DEFAULT_BOOTSTRAP_MARKDOWN_GOVERNANCE },
    loadPolicy: { ...DEFAULT_LOAD_POLICY, always: ["documentIndex"] },
    taskContext: { enabled: false, taskCapsulesRoot: "docs/plans/任务" },
  };
  const validation = validateTargetDocManifest(manifest);
  if (!validation.ok) {
    const detail = validation.issues.map((issue) => `${issue.code} at ${issue.at}: ${issue.message}`).join("; ");
    throw new Error(`bootstrap manifest invalid: ${detail}`);
  }
  return { plans: [...plans, indexPlan], manifest };
}

function planManifest(root, bootstrapManifest = null, experienceContent = null) {
  const file = ".vibe-docs.json";
  let state;
  try {
    state = inspectTargetFile(root, file);
  } catch (error) {
    return { file, action: "conflict", status: "fail", reason: error.message, nextContent: "" };
  }
  if (!state.exists) {
    const next = bootstrapManifest || mergeManifest(root, {}, experienceContent);
    return { file, action: "create", status: "pending", reason: "manifest missing", nextContent: `${JSON.stringify(next, null, 2)}\n`, expectedContent: null };
  }
  try {
    const currentContent = fs.readFileSync(state.path, "utf8");
    const current = JSON.parse(currentContent.replace(/^\uFEFF/u, ""));
    const next = bootstrapManifest || mergeManifest(root, current, experienceContent);
    const nextContent = `${JSON.stringify(next, null, 2)}\n`;
    return JSON.stringify(current) === JSON.stringify(next)
      ? { file, action: "none", status: "pass", reason: "manifest current", nextContent, expectedContent: currentContent }
      : { file, action: "update", status: "pending", reason: "manifest fields changed", nextContent, expectedContent: currentContent };
  } catch (error) {
    return { file, action: "conflict", status: "fail", reason: `invalid manifest JSON: ${error.message}`, nextContent: "" };
  }
}

function applyPlans(root, plans) {
  const writable = plans.filter((item) => item.action !== "none" && item.status !== "fail");
  commitTargetTransaction(root, {
    journalPath: ".vibe-constitution-setup.json",
    kind: "target-constitution-setup",
    operations: writable.map((item) => ({ file: item.file, content: item.nextContent, expectedContent: item.expectedContent })),
  });
  for (const item of writable) item.status = "written";
}

function planOperations(plans) {
  return plans
    .filter((item) => item.action !== "none" && item.status !== "fail")
    .map((item) => ({ file: item.file, content: item.nextContent, expectedContent: item.expectedContent }));
}

function run(args) {
  const targetRoot = path.resolve(args.targetRoot || ".");
  const skillsRoot = path.resolve(args.skillsRoot || process.env.VIBE_CODING_SKILLS_HOME || DEFAULT_SKILLS_ROOT);
  assertSafeTargetRoot(targetRoot);
  const report = buildReport(targetRoot, skillsRoot, false);
  const manifestState = inspectTargetFile(targetRoot, ".vibe-docs.json");
  let currentManifest = {};
  if (manifestState.exists) {
    try {
      currentManifest = JSON.parse(fs.readFileSync(manifestState.path, "utf8").replace(/^\uFEFF/u, ""));
    } catch {
      currentManifest = {};
    }
  }
  let experienceMappingFailure = null;
  if (manifestState.exists && currentManifest.schemaVersion === 2) {
    const mapped = currentManifest.experienceGovernance;
    const document = Array.isArray(currentManifest.documents)
      ? currentManifest.documents.find((item) => item.role === "experienceGovernance")
      : null;
    if ((mapped && mapped !== DEFAULT_DOCUMENT_PATHS.experienceGovernance) || (document && document.path !== DEFAULT_DOCUMENT_PATHS.experienceGovernance)) {
      experienceMappingFailure = {
        file: ".vibe-docs.json",
        action: "conflict",
        status: "fail",
        reason: "experienceGovernance uses a non-canonical path; explicit migration is required",
        nextContent: "",
      };
    }
  }
  const paths = resolveDocumentPaths(targetRoot, currentManifest);
  if (currentManifest.schemaVersion === 2) paths.experienceGovernance = DEFAULT_DOCUMENT_PATHS.experienceGovernance;
  const profilePlan = planManagedFile(targetRoot, paths.projectProfile, renderProfileBody(report));
  const designPlan = planManagedFile(targetRoot, paths.constitutionDesign, renderDesignBody(report));
  const experienceEnabled = !manifestState.exists || currentManifest.schemaVersion === 2 || typeof currentManifest.experienceGovernance === "string";
  if (experienceEnabled && designPlan.status !== "fail") {
    try {
      if (!parseExperienceRegistry(designPlan.nextContent)) {
        designPlan.nextContent = planExperienceRegistryContent(designPlan.nextContent, emptyExperienceRegistry());
        if (designPlan.action === "none") designPlan.action = "update";
        designPlan.status = "pending";
        designPlan.reason = "target experience registry missing";
      }
    } catch (error) {
      designPlan.action = "conflict";
      designPlan.status = "fail";
      designPlan.reason = error.message;
    }
  }
  const bootstrap = manifestState.exists ? null : bootstrapManifestBundle(targetRoot, paths, profilePlan.nextContent, designPlan.nextContent);
  const adoptionLedgerPlan = manifestState.exists && currentManifest.schemaVersion === 2
    ? planPlainFile(targetRoot, paths.experienceGovernance, initialLedgerContent())
    : null;
  const documents = [
    profilePlan,
    designPlan,
    ...(bootstrap?.plans || []),
    ...(adoptionLedgerPlan ? [adoptionLedgerPlan] : []),
    planManifest(targetRoot, bootstrap?.manifest || null, adoptionLedgerPlan?.nextContent || null),
  ];
  const failures = [
    ...report.findings.filter((finding) => finding.severity === "blocker").map((finding) => ({ file: "", action: "block", status: "fail", reason: finding.message })),
    ...(experienceMappingFailure ? [experienceMappingFailure] : []),
    ...documents.filter((item) => item.status === "fail"),
  ];
  const changes = documents.filter((item) => item.action !== "none" && item.status !== "fail");

  if (args.mode === "write" && failures.length === 0) {
    if (bootstrap) {
      commitTargetTransactionPhases(targetRoot, {
        journalPath: ".vibe-constitution-setup.json",
        kind: "target-constitution-bootstrap",
        firstOperations: planOperations(changes),
        nextOperations() {
          const stableReport = buildReport(targetRoot, skillsRoot, false);
          const stablePaths = resolveDocumentPaths(targetRoot);
          const stableProfile = planManagedFile(targetRoot, stablePaths.projectProfile, renderProfileBody(stableReport));
          const stableDesign = planManagedFile(targetRoot, stablePaths.constitutionDesign, renderDesignBody(stableReport));
          const stableBootstrap = bootstrapManifestBundle(targetRoot, stablePaths, stableProfile.nextContent, stableDesign.nextContent);
          const stablePlans = [stableProfile, stableDesign, ...stableBootstrap.plans, planManifest(targetRoot, stableBootstrap.manifest)];
          const stableFailures = [
            ...stableReport.findings.filter((finding) => finding.severity === "blocker"),
            ...stablePlans.filter((item) => item.status === "fail"),
          ];
          if (stableFailures.length > 0) {
            const detail = stableFailures.map((item) => item.reason || item.message).join("; ");
            throw new Error(`bootstrap stabilization failed: ${detail}`);
          }
          return planOperations(stablePlans);
        },
      });
      for (const item of changes) item.status = "written";
    } else applyPlans(targetRoot, changes);
  }
  const checkFailed = args.mode === "check" && (failures.length > 0 || changes.length > 0);
  const blocked = failures.length > 0;
  return { ok: !checkFailed && !blocked, mode: args.mode, targetRoot, skillsRoot, audit: report.summary, files: documents.map(({ file, action, status, reason }) => ({ file, action, status, reason })), failures };
}

function printText(result) {
  console.log(`Target constitution setup: mode=${result.mode} target=${result.targetRoot}`);
  console.log(`Skills root: ${result.skillsRoot}`);
  for (const file of result.files) console.log(`[${file.status.toUpperCase().padEnd(7)}] ${file.file}: ${file.action} (${file.reason})`);
  for (const failure of result.failures) console.log(`[FAIL] ${failure.reason}`);
  console.log(`Result: ${result.ok ? "PASS" : "FAIL"}`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exitCode = 0;
  } else {
    if (!args.targetRoot) throw Object.assign(new Error("Missing target root."), { exitCode: 2 });
    const result = run(args);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else printText(result);
    process.exitCode = result.ok ? 0 : result.failures.length > 0 ? 2 : 1;
  }
} catch (error) {
  if (process.argv.includes("--json")) console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  else console.error(`[FAIL] ${error.message}`);
  process.exitCode = error.exitCode || 2;
}
