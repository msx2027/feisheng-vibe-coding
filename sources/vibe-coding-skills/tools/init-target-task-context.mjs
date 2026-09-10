#!/usr/bin/env node
// DocMap:
// Layer: L3 / target-project task context script
// Module: tools
// Depends on: .vibe-docs.json
// Syncs with: tools/INDEX.md, README.md, DOC-MAP.md, skills/dev-builder/SKILL.md
// Creates and validates optional target-project task capsules and session journal.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  assertSafeTargetRoot,
  inspectTargetDirectory,
  inspectTargetFile,
} from "./safe-target-fs.mjs";
import { commitTargetTransaction } from "./target-doc-transaction.mjs";
import { finalizeDocumentIndex, metadataForDocument, refreshDocumentEntries } from "./target-doc-index-core.mjs";
import { estimateTokens, hashContent, validateTargetDocManifest } from "./target-doc-manifest-core.mjs";
import { initializeContinuity, recoverContinuity } from "./target-task-continuity-core.mjs";

const MANIFEST_FILE = ".vibe-docs.json";
const DEFAULT_TASK_ROOT = "docs/plans/任务";
const DEFAULT_SESSION_JOURNAL = "docs/plans/会话记录.md";
const SCHEMA_VERSION = 2;
const MAX_SLUG_LENGTH = 80;
const CAPSULE_FILES = [
  "任务状态.json",
  "需求摘录.md",
  "实现计划.md",
  "研究记录.md",
  "实现上下文.jsonl",
  "验收上下文.jsonl",
];
const JSONL_SOURCES = new Set(["spec", "research", "code", "validation"]);
const SELECTOR_KINDS = new Set(["section", "lines", "jsonPointer", "wholeFile"]);

function usage() {
  console.error(`Usage:
  node tools/init-target-task-context.mjs <target-root> [--dry-run|--write|--check] [--json]
    [--slug <slug> --title <title>] [--record-session <summary>] [--continuity-mode <t2|t3|cross-session|long-task>]

Modes:
  --dry-run   Preview changes only. This is the default.
  --write     Create/update .vibe-docs.json, task capsule files, and session journal.
  --check     Validate configured task context files. Writes nothing.`);
}

function parseArgs(argv) {
  const args = {
    targetRoot: "",
    mode: "dry-run",
    json: false,
    help: false,
    slug: "",
    title: "",
    recordSession: "",
    continuityMode: "",
  };
  let explicitMode = false;

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--dry-run" || item === "--write" || item === "--check") {
      if (explicitMode) throw new Error("Only one mode flag is allowed.");
      args.mode = item.slice(2);
      explicitMode = true;
    } else if (item === "--json") {
      args.json = true;
    } else if (item === "--slug") {
      args.slug = argv[++index] || "";
    } else if (item === "--title") {
      args.title = argv[++index] || "";
    } else if (item === "--record-session") {
      args.recordSession = argv[++index] || "";
    } else if (item === "--continuity-mode") {
      args.continuityMode = argv[++index] || "";
    } else if (item === "-h" || item === "--help") {
      args.help = true;
    } else if (!item.startsWith("-") && !args.targetRoot) {
      args.targetRoot = item;
    } else {
      throw new Error(`Unknown argument: ${item}`);
    }
  }

  return args;
}

function normalizeText(value) {
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""));
}

function writeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function contentRevision(content) {
  return hashContent(content);
}

function localDate() {
  const now = new Date();
  const yyyy = String(now.getFullYear()).padStart(4, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function timestamp() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function toPosix(value) {
  return value.replaceAll(path.sep, "/").replaceAll("\\", "/");
}

function assertInsideRoot(root, candidateRel) {
  if (typeof candidateRel !== "string" || candidateRel.trim() === "") {
    return "path must be a non-empty string";
  }
  const normalized = candidateRel.replace(/\\/g, "/");
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized)) {
    return `path must be project-relative: ${candidateRel}`;
  }
  if (normalized.split("/").some((segment) => segment === "." || segment === "..")) {
    return `path escapes target root: ${candidateRel} (traversal segment)`;
  }
  const absolute = path.resolve(root, normalized);
  const relative = path.relative(root, absolute);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return "";
  return `path escapes target root: ${candidateRel}`;
}

function ensureTargetRoot(targetRoot) {
  try {
    assertSafeTargetRoot(targetRoot);
  } catch (error) {
    throw Object.assign(error, { exitCode: 2 });
  }
}

function makePlan(file, action, status, reason, nextContent = null, expectedContent) {
  const plan = { file, action, status, reason, nextContent };
  if (arguments.length >= 6) plan.expectedContent = expectedContent;
  return plan;
}

function planManifest(root, patch, plannedFiles = [], refreshDocuments = false) {
  const file = MANIFEST_FILE;
  let current = {};
  let currentContent = "";
  let state;

  try {
    state = inspectTargetFile(root, file);
  } catch (error) {
    return makePlan(file, "conflict", "fail", error.message);
  }

  if (state.exists) {
    try {
      currentContent = fs.readFileSync(state.path, "utf8");
      current = JSON.parse(currentContent.replace(/^\uFEFF/u, ""));
    } catch (error) {
      return makePlan(file, "conflict", "fail", `invalid manifest JSON: ${error.message}`);
    }
  }

  const existingTaskContext =
    current.taskContext && typeof current.taskContext === "object" && !Array.isArray(current.taskContext)
      ? current.taskContext
      : {};
  const nextTaskContext = {
    enabled: false,
    taskCapsulesRoot: DEFAULT_TASK_ROOT,
    ...existingTaskContext,
    ...patch,
  };
  let next = { ...current, taskContext: nextTaskContext };
  if (refreshDocuments && current.schemaVersion === 2 && Array.isArray(current.documents) && nextTaskContext.currentTaskCapsule) {
    const planned = new Map(plannedFiles.filter((item) => typeof item.nextContent === "string").map((item) => [item.file, item.nextContent]));
    const capsule = nextTaskContext.currentTaskCapsule.replace(/\/$/u, "");
    const roleFiles = new Map([
      ["taskState", `${capsule}/任务状态.json`],
      ["implementationContext", `${capsule}/实现上下文.jsonl`],
      ["acceptanceContext", `${capsule}/验收上下文.jsonl`],
      ...(nextTaskContext.sessionJournal ? [["sessionJournal", nextTaskContext.sessionJournal]] : []),
    ]);
    const activeRoles = new Set(roleFiles.keys());
    const historical = [];
    const documents = current.documents.flatMap((doc) => {
      if (!activeRoles.has(doc.role)) return [doc];
      if (doc.role === "taskState" && doc.path !== roleFiles.get("taskState")) {
        historical.push(doc.path);
        return [{ ...doc, role: "historicalTaskCapsules", authority: "archive" }];
      }
      return [];
    });
    for (const [role, file] of roleFiles) {
      const content = planned.has(file) ? planned.get(file) : readTargetTextForManifest(root, file);
      if (content === null) continue;
      documents.push({
        role,
        path: file,
        owner: role === "taskState" ? "update-target-task-state" : "init-target-task-context",
        authority: role === "sessionJournal" ? "log" : "source",
        ...metadataForDocument(file, content),
        dependsOn: role === "taskState" ? [] : ["taskState"],
      });
    }
    const allHistorical = [...new Set([...(Array.isArray(current.historicalTaskCapsules) ? current.historicalTaskCapsules : []), ...historical])];
    next = { ...next, documents };
    if (allHistorical.length) {
      next.historicalTaskCapsules = allHistorical;
      next.loadPolicy = { ...next.loadPolicy, never: [...new Set([...(next.loadPolicy?.never || []), "historicalTaskCapsules"])] };
    }
  }
  const nextContent = writeJson(next);

  if (!state.exists) {
    return makePlan(file, "create", "pending", "manifest missing", nextContent, null);
  }
  if (normalizeText(currentContent) === nextContent) {
    return makePlan(file, "none", "pass", "manifest current", currentContent, currentContent);
  }
  return makePlan(file, "update", "pending", "taskContext changed", nextContent, currentContent);
}

function planDocumentIndex(root, manifestPlan, plannedFiles = []) {
  if (manifestPlan.status === "fail" || typeof manifestPlan.nextContent !== "string") return null;
  let manifest;
  try {
    manifest = JSON.parse(manifestPlan.nextContent.replace(/^\uFEFF/u, ""));
  } catch (error) {
    manifestPlan.action = "conflict";
    manifestPlan.status = "fail";
    manifestPlan.reason = `generated manifest JSON is invalid: ${error.message}`;
    return null;
  }
  if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.documents)) return null;
  let finalized;
  try {
    const planned = new Map(plannedFiles.filter((item) => typeof item.nextContent === "string").map((item) => [item.file, item.nextContent]));
    manifest = {
      ...manifest,
      documents: refreshDocumentEntries(manifest.documents, (entry) => planned.get(entry.path) ?? readTargetTextForManifest(root, entry.path)),
    };
    finalized = finalizeDocumentIndex(manifest.documents, manifest.documentIndex);
    manifest = { ...manifest, documentIndex: finalized.indexPath, documents: finalized.documents };
    const validation = validateTargetDocManifest(manifest);
    if (!validation.ok) throw new Error(validation.issues.map((issue) => `${issue.code} at ${issue.at}`).join("; "));
  } catch (error) {
    manifestPlan.action = "conflict";
    manifestPlan.status = "fail";
    manifestPlan.reason = `cannot refresh document index: ${error.message}`;
    return null;
  }
  manifestPlan.nextContent = writeJson(manifest);
  const manifestCurrent = manifestPlan.expectedContent ?? "";
  if (normalizeText(manifestCurrent) === manifestPlan.nextContent) {
    manifestPlan.action = "none";
    manifestPlan.status = "pass";
    manifestPlan.reason = "manifest and document index current";
  } else {
    manifestPlan.action = manifestPlan.expectedContent === null ? "create" : "update";
    manifestPlan.status = "pending";
    manifestPlan.reason = "taskContext and document index changed";
  }
  let state;
  try {
    state = inspectTargetFile(root, finalized.indexPath);
  } catch (error) {
    return makePlan(finalized.indexPath, "conflict", "fail", error.message);
  }
  const current = state.exists ? fs.readFileSync(state.path, "utf8") : null;
  if (normalizeText(current || "") === finalized.indexContent) {
    return makePlan(finalized.indexPath, "none", "pass", "document index current", current);
  }
  return makePlan(
    finalized.indexPath,
    state.exists ? "update" : "create",
    "pending",
    state.exists ? "document index refreshed" : "document index missing",
    finalized.indexContent,
    current,
  );
}

function readTargetTextForManifest(root, file) {
  try {
    const state = inspectTargetFile(root, file);
    return state.exists ? fs.readFileSync(state.path, "utf8") : null;
  } catch {
    return null;
  }
}

function buildTaskStatus(id, title) {
  const now = timestamp();
  const status = {
    schemaVersion: SCHEMA_VERSION,
    id,
    title,
    status: "doing",
    createdAt: now,
    updatedAt: now,
    phase: "",
    task: title,
    checkpoint: "任务胶囊已创建",
    nextStep: "补充实现计划并开始实现",
    manualAcceptanceRef: "",
    context: {
      implementation: "实现上下文.jsonl",
      acceptance: "验收上下文.jsonl",
    },
    revision: "",
  };
  status.revision = contentRevision(JSON.stringify(status));
  return status;
}

function contextItem(root, manifest, role, reason, source) {
  const file = manifest[role] || manifest.documents?.find((doc) => doc.role === role)?.path;
  if (typeof file !== "string" || !file) return null;
  let state;
  try {
    state = inspectTargetFile(root, file);
  } catch {
    return null;
  }
  if (!state.exists) return null;
  const content = fs.readFileSync(state.path, "utf8");
  return {
    role,
    file,
    selector: { kind: "wholeFile" },
    reason,
    source,
    required: true,
    sourceRevision: contentRevision(content),
    maxTokens: Math.max(1, Math.min(20_000, estimateTokens(content))),
  };
}

function contextJsonl(items) {
  return `${items.filter(Boolean).map((item) => JSON.stringify(item)).join("\n")}\n`;
}

function capsuleTemplates(root, manifest, id, title) {
  const implementationItems = [
    contextItem(root, manifest, "productSpec", "当前任务需求", "spec"),
    contextItem(root, manifest, "devPlan", "当前任务计划", "spec"),
  ];
  const acceptanceItems = [
    contextItem(root, manifest, "manualAcceptance", "当前任务验收事实", "validation"),
    contextItem(root, manifest, "productSpec", "当前任务验收依据", "validation"),
  ];
  return {
    "任务状态.json": writeJson(buildTaskStatus(id, title)),
    "需求摘录.md": `# 需求摘录\n\n- 任务：${title}\n- 胶囊ID：${id}\n\n本文件记录当前任务对应的需求摘录。创建时尚未摘录需求。\n`,
    "实现计划.md": `# 实现计划\n\n- 任务：${title}\n- 胶囊ID：${id}\n\n本文件记录当前任务的实现步骤、影响面、验证路径和升级触发条件。\n\n## 一致性分析回执\n\n- sourceRevision: <需求文档 / 开发计划 / Phase 明细的当前修订>\n- 分析证据: <来源 section / 契约 ID / 测试策略或依赖比较结果>\n- 分析结论: <待分析 / PASS / BLOCKED>\n- 阻断项: <无 / 对应 Critical 或 Important 矛盾>\n\n本节只记录预实现一致性分析的执行回执；分析真源仍在既有开发计划或 Phase 明细，不成为第二份计划真源。\n`,
    "研究记录.md": `# 研究记录\n\n- 任务：${title}\n- 胶囊ID：${id}\n\n本文件记录当前任务的调研结论、来源和未验证项。\n`,
    "实现上下文.jsonl": contextJsonl(implementationItems),
    "验收上下文.jsonl": contextJsonl(acceptanceItems),
  };
}

function planTaskCapsule(root, manifest, taskRoot, id, title) {
  const relativeDir = `${taskRoot.replace(/\\/g, "/").replace(/\/$/u, "")}/${id}`;
  const pathError = assertInsideRoot(root, relativeDir);
  if (pathError) return { plans: [makePlan(relativeDir, "conflict", "fail", pathError)], relativeDir };
  const templates = capsuleTemplates(root, manifest, id, title);
  const plans = [];
  for (const fileName of CAPSULE_FILES) {
    const relativeFile = `${relativeDir}/${fileName}`;
    const nextContent = templates[fileName];
    let state;
    try {
      state = inspectTargetFile(root, relativeFile);
    } catch (error) {
      plans.push(makePlan(relativeFile, "conflict", "fail", error.message));
      continue;
    }
    if (!state.exists) {
      plans.push(makePlan(relativeFile, "create", "pending", "file missing", nextContent, null));
      continue;
    }
    const current = fs.readFileSync(state.path, "utf8");
    if (normalizeText(current) === nextContent) {
      plans.push(makePlan(relativeFile, "none", "pass", "file current", current));
    } else {
      plans.push(makePlan(relativeFile, "none", "pass", "existing user content preserved", current));
    }
  }
  return { plans, relativeDir };
}

function planSessionJournal(root, relativeFile, summary) {
  const pathError = assertInsideRoot(root, relativeFile);
  if (pathError) return makePlan(relativeFile, "conflict", "fail", pathError);
  let state;
  try {
    state = inspectTargetFile(root, relativeFile);
  } catch (error) {
    return makePlan(relativeFile, "conflict", "fail", error.message);
  }
  const current = state.exists ? fs.readFileSync(state.path, "utf8") : "";
  const header = state.exists ? "" : "# 会话记录\n\n";
  const entry = summary
    ? `## ${timestamp()}\n\n${summary.trim()}\n\n`
    : "";
  const nextContent = `${current}${current && !current.endsWith("\n") ? "\n" : ""}${header}${entry}`;
  if (!state.exists) return makePlan(relativeFile, "create", "pending", "journal missing", nextContent, null);
  if (!summary) return makePlan(relativeFile, "none", "pass", "journal current", current);
  return makePlan(relativeFile, "append", "pending", "session summary added", nextContent, current);
}

function checkJsonlFile(root, capsuleDir, relativeFile) {
  const findings = [];
  const targetFile = `${capsuleDir}/${relativeFile}`;
  let state;
  try {
    state = inspectTargetFile(root, targetFile);
  } catch (error) {
    findings.push(`${targetFile} ${error.message}`);
    return findings;
  }
  if (!state.exists) {
    findings.push(`missing JSONL file: ${targetFile}`);
    return findings;
  }
  const lines = normalizeText(fs.readFileSync(state.path, "utf8")).split("\n");
  let entries = 0;
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let item;
    try {
      item = JSON.parse(trimmed);
    } catch (error) {
      findings.push(`${relativeFile}:${index + 1} invalid JSON: ${error.message}`);
      return;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      findings.push(`${relativeFile}:${index + 1} must be a JSON object`);
      return;
    }
    entries += 1;
    if (typeof item.role !== "string" || item.role.trim() === "") {
      findings.push(`${relativeFile}:${index + 1} role must be non-empty`);
    }
    const fileError = assertInsideRoot(root, item.file);
    if (fileError) findings.push(`${relativeFile}:${index + 1} ${fileError}`);
    if (typeof item.reason !== "string" || item.reason.trim() === "") {
      findings.push(`${relativeFile}:${index + 1} reason must be non-empty`);
    }
    if (!JSONL_SOURCES.has(item.source)) {
      findings.push(`${relativeFile}:${index + 1} source must be one of spec, research, code, validation`);
    }
    if (!Object.prototype.hasOwnProperty.call(item, "required")) {
      findings.push(`${relativeFile}:${index + 1} required must be present`);
    } else if (typeof item.required !== "boolean") {
      findings.push(`${relativeFile}:${index + 1} required must be boolean`);
    }
    if (!item.selector || typeof item.selector !== "object" || !SELECTOR_KINDS.has(item.selector.kind)) {
      findings.push(`${relativeFile}:${index + 1} selector.kind must be section, lines, jsonPointer, or wholeFile`);
    } else if (item.selector.kind === "section" && (typeof item.selector.id !== "string" || !item.selector.id.trim())) {
      findings.push(`${relativeFile}:${index + 1} section selector requires id`);
    } else if (
      item.selector.kind === "lines" &&
      (!Number.isInteger(item.selector.startLine) || !Number.isInteger(item.selector.endLine) ||
        item.selector.startLine < 1 || item.selector.endLine < item.selector.startLine)
    ) {
      findings.push(`${relativeFile}:${index + 1} lines selector requires valid startLine/endLine`);
    } else if (item.selector.kind === "jsonPointer" && (typeof item.selector.pointer !== "string" || !item.selector.pointer.startsWith("/"))) {
      findings.push(`${relativeFile}:${index + 1} jsonPointer selector requires pointer starting with /`);
    }
    if (!/^sha256:[a-f0-9]{64}$/u.test(item.sourceRevision || "")) {
      findings.push(`${relativeFile}:${index + 1} sourceRevision must be sha256:<64 lowercase hex>`);
    }
    if (!Number.isInteger(item.maxTokens) || item.maxTokens < 1 || item.maxTokens > 20_000) {
      findings.push(`${relativeFile}:${index + 1} maxTokens must be an integer between 1 and 20000`);
    }
    if (item.required !== false) {
      let referenced;
      try {
        referenced = inspectTargetFile(root, item.file);
      } catch (error) {
        findings.push(`${relativeFile}:${index + 1} unsafe required file: ${item.file} (${error.message})`);
        return;
      }
      if (!referenced.exists) {
        findings.push(`${relativeFile}:${index + 1} required file does not exist: ${item.file}`);
      } else if (/^sha256:[a-f0-9]{64}$/u.test(item.sourceRevision || "")) {
        const currentRevision = contentRevision(fs.readFileSync(referenced.path, "utf8"));
        if (currentRevision !== item.sourceRevision) {
          findings.push(`${relativeFile}:${index + 1} stale sourceRevision for ${item.file}`);
        }
      }
    }
  });
  if (entries === 0) findings.push(`${relativeFile} must contain at least one context entry`);
  return findings;
}

function checkCapsule(root, capsuleDir) {
  const findings = [];
  const dirError = assertInsideRoot(root, capsuleDir);
  if (dirError) return [dirError];
  let directory;
  try {
    directory = inspectTargetDirectory(root, capsuleDir);
  } catch (error) {
    return [`task capsule directory is unsafe: ${capsuleDir} (${error.message})`];
  }
  if (!directory.exists) {
    return [`task capsule directory missing: ${capsuleDir}`];
  }
  for (const fileName of CAPSULE_FILES) {
    try {
      const state = inspectTargetFile(root, `${capsuleDir}/${fileName}`);
      if (!state.exists) findings.push(`missing capsule file: ${capsuleDir}/${fileName}`);
    } catch (error) {
      findings.push(`unsafe capsule file: ${capsuleDir}/${fileName} (${error.message})`);
    }
  }
  let statusState;
  try {
    statusState = inspectTargetFile(root, `${capsuleDir}/任务状态.json`);
  } catch (error) {
    findings.push(`unsafe capsule file: ${capsuleDir}/任务状态.json (${error.message})`);
  }
  if (statusState?.exists) {
    try {
      const status = readJson(statusState.path);
      if (status.schemaVersion !== SCHEMA_VERSION) findings.push("任务状态.json schemaVersion must be 2");
      for (const key of ["id", "title", "status", "createdAt", "updatedAt", "phase", "task", "checkpoint", "nextStep", "manualAcceptanceRef", "revision"]) {
        if (typeof status[key] !== "string") findings.push(`任务状态.json ${key} must be a string`);
      }
      if (status.context?.implementation !== "实现上下文.jsonl") {
        findings.push("任务状态.json context.implementation must be 实现上下文.jsonl");
      }
      if (status.context?.acceptance !== "验收上下文.jsonl") {
        findings.push("任务状态.json context.acceptance must be 验收上下文.jsonl");
      }
      if (!/^sha256:[a-f0-9]{64}$/u.test(status.revision || "")) findings.push("任务状态.json revision must be sha256:<64 lowercase hex>");
    } catch (error) {
      findings.push(`任务状态.json invalid JSON: ${error.message}`);
    }
  }
  findings.push(...checkJsonlFile(root, capsuleDir, "实现上下文.jsonl"));
  findings.push(...checkJsonlFile(root, capsuleDir, "验收上下文.jsonl"));
  return findings;
}

function checkConfiguredContext(root, manifest) {
  const findings = [];
  const taskContext = manifest.taskContext;
  if (!taskContext) return findings;
  if (typeof taskContext !== "object" || Array.isArray(taskContext)) {
    return ["taskContext must be an object"];
  }
  if (typeof taskContext.enabled !== "boolean") findings.push("taskContext.enabled must be boolean");
  const taskRoot = taskContext.taskCapsulesRoot || DEFAULT_TASK_ROOT;
  const rootError = assertInsideRoot(root, taskRoot);
  if (rootError) findings.push(`taskContext.taskCapsulesRoot ${rootError}`);
  if (taskContext.sessionJournal) {
    const journalError = assertInsideRoot(root, taskContext.sessionJournal);
    if (journalError) findings.push(`taskContext.sessionJournal ${journalError}`);
    else if (taskContext.enabled) {
      try {
        const journal = inspectTargetFile(root, taskContext.sessionJournal);
        if (!journal.exists) findings.push(`session journal missing: ${taskContext.sessionJournal}`);
      } catch (error) {
        findings.push(`session journal is unsafe: ${taskContext.sessionJournal} (${error.message})`);
      }
    }
  }
  if (taskContext.currentTaskCapsule) {
    findings.push(...checkCapsule(root, taskContext.currentTaskCapsule));
  }
  try {
    const taskDirectory = inspectTargetDirectory(root, taskRoot);
    if (taskDirectory.exists) {
      for (const entry of fs.readdirSync(taskDirectory.path, { withFileTypes: true })) {
        if (entry.isDirectory()) findings.push(...checkCapsule(root, `${taskRoot}/${entry.name}`));
        else if (entry.isSymbolicLink()) findings.push(`task capsule entry is unsafe: ${taskRoot}/${entry.name}`);
      }
    }
  } catch (error) {
    findings.push(`taskContext.taskCapsulesRoot is unsafe: ${taskRoot} (${error.message})`);
  }
  return findings;
}

function applyPlans(root, plans) {
  const writable = plans.filter((plan) => ["create", "update", "append"].includes(plan.action) && plan.status !== "fail");
  commitTargetTransaction(root, {
    journalPath: ".vibe-task-context.json",
    kind: "task-context",
    operations: writable.map((plan) => ({ file: plan.file, content: plan.nextContent, expectedContent: plan.expectedContent })),
  });
  for (const plan of writable) plan.status = "written";
}

function run(args) {
  const targetRoot = path.resolve(args.targetRoot || ".");
  ensureTargetRoot(targetRoot);
  try {
    recoverContinuity(targetRoot);
  } catch (error) {
    const files = [makePlan(MANIFEST_FILE, "conflict", "fail", error.message)];
    return { ok: false, mode: args.mode, targetRoot, files, summary: { failures: 1, changes: 0 } };
  }
  let manifest = {};
  let manifestState;
  try {
    manifestState = inspectTargetFile(targetRoot, MANIFEST_FILE);
  } catch (error) {
    const files = [makePlan(MANIFEST_FILE, "conflict", "fail", error.message)];
    return { ok: false, mode: args.mode, targetRoot, files, summary: { failures: 1, changes: 0 } };
  }
  if (manifestState.exists) {
    try {
      manifest = readJson(manifestState.path);
    } catch (error) {
      const files = [makePlan(MANIFEST_FILE, "conflict", "fail", `invalid manifest JSON: ${error.message}`)];
      return { ok: false, mode: args.mode, targetRoot, files, summary: { failures: 1, changes: 0 } };
    }
  } else {
    const files = [makePlan(MANIFEST_FILE, "conflict", "fail", "complete .vibe-docs.json is required before task context setup")];
    return { ok: false, mode: args.mode, targetRoot, files, summary: { failures: 1, changes: 0 } };
  }
  if (args.continuityMode) {
    try {
      return initializeContinuity(targetRoot, manifest, fs.readFileSync(manifestState.path, "utf8"), args);
    } catch (error) {
      const files = [makePlan(MANIFEST_FILE, "conflict", "fail", error.message)];
      return { ok: false, mode: args.mode, targetRoot, files, summary: { failures: 1, changes: 0 } };
    }
  }
  const manifestValidation = validateTargetDocManifest(manifest, { allowLegacy: true });
  if (!manifestValidation.ok) {
    const reason = manifestValidation.issues.slice(0, 20).map((issue) => `${issue.code} at ${issue.at}: ${issue.message}`).join("; ");
    const files = [makePlan(MANIFEST_FILE, "conflict", "fail", `complete .vibe-docs.json is required: ${reason}`)];
    return { ok: false, mode: args.mode, targetRoot, files, summary: { failures: 1, changes: 0 } };
  }

  const requestedTask = Boolean(args.slug || args.title);
  if (requestedTask && !args.slug) throw new Error("--slug is required when creating a task capsule.");
  const safeSlug = args.slug ? slugify(args.slug) : "";
  if (args.slug && !safeSlug) throw new Error("--slug must contain at least one ASCII letter or digit.");
  if (safeSlug.length > MAX_SLUG_LENGTH) {
    throw new Error(`--slug must normalize to at most ${MAX_SLUG_LENGTH} ASCII characters.`);
  }
  const title = args.title || args.slug || safeSlug;
  const taskRoot = manifest.taskContext?.taskCapsulesRoot || DEFAULT_TASK_ROOT;
  const files = [];
  let currentTaskCapsule = manifest.taskContext?.currentTaskCapsule || "";

  if (requestedTask) {
    const id = `${localDate()}-${safeSlug}`;
    const capsule = planTaskCapsule(targetRoot, manifest, taskRoot, id, title);
    currentTaskCapsule = capsule.relativeDir;
    files.push(...capsule.plans);
  }

  const shouldEnable = requestedTask || Boolean(args.recordSession) || Boolean(manifest.taskContext?.enabled);
  const manifestPatch = shouldEnable
    ? {
        enabled: true,
        taskCapsulesRoot: taskRoot,
        ...((args.recordSession || manifest.taskContext?.sessionJournal)
          ? { sessionJournal: manifest.taskContext?.sessionJournal || DEFAULT_SESSION_JOURNAL }
          : {}),
        ...(currentTaskCapsule ? { currentTaskCapsule } : {}),
      }
    : { enabled: false, taskCapsulesRoot: taskRoot };
  if (args.recordSession) {
    files.push(planSessionJournal(targetRoot, manifestPatch.sessionJournal, args.recordSession));
  }
  const manifestPlan = planManifest(targetRoot, manifestPatch, files, requestedTask || Boolean(args.recordSession));
  const indexPlan = planDocumentIndex(targetRoot, manifestPlan, files);
  if (indexPlan) files.push(indexPlan);
  files.push(manifestPlan);

  if (args.mode === "check") {
    const nextManifestPlan = files.find((item) => item.file === MANIFEST_FILE);
    const nextManifest =
      nextManifestPlan?.nextContent && nextManifestPlan.status !== "fail"
        ? JSON.parse(nextManifestPlan.nextContent)
        : manifest;
    const findings = checkConfiguredContext(targetRoot, nextManifest);
    for (const finding of findings) {
      files.push(makePlan("taskContext", "check", "fail", finding));
    }
  }

  const failures = files.filter((item) => item.status === "fail");
  const changes = files.filter((item) => item.action !== "none" && item.status !== "fail");
  if (args.mode === "write" && failures.length === 0) {
    applyPlans(targetRoot, files);
  }
  const checkFailed = args.mode === "check" && (failures.length > 0 || changes.length > 0);
  const writeFailed = args.mode === "write" && failures.length > 0;
  return {
    ok: !checkFailed && !writeFailed,
    mode: args.mode,
    targetRoot,
    taskContext: manifestPatch,
    files: files.map(({ file, action, status, reason }) => ({ file, action, status, reason })),
    summary: {
      changes: changes.length,
      failures: failures.length,
    },
  };
}

function printText(result) {
  console.log(`Target task context setup: mode=${result.mode} target=${result.targetRoot}`);
  for (const file of result.files) {
    console.log(`[${file.status.toUpperCase().padEnd(7)}] ${file.file}: ${file.action} (${file.reason})`);
  }
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
    process.exitCode = result.ok ? 0 : result.summary.failures > 0 ? 2 : 1;
  }
} catch (error) {
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  } else {
    console.error(`[FAIL] ${error.message}`);
  }
  process.exitCode = error.exitCode || 2;
}
