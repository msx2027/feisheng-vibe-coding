#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { assertSafeTargetRoot, inspectTargetFile } from "./safe-target-fs.mjs";
import { commitTargetTransaction, recoverTargetTransaction, readTargetText, sha256 } from "./target-doc-transaction.mjs";
import { finalizeDocumentIndex, metadataForDocument, refreshDocumentEntries } from "./target-doc-index-core.mjs";
import { collectDocumentEntries, estimateTokens, hashContent, validateProjectRelativePath, validateTargetDocManifest } from "./target-doc-manifest-core.mjs";

export const CONTINUITY_JOURNAL = ".vibe-task-continuity.json";
const CONTINUITY_MODES = new Set(["t2", "t3", "cross-session", "long-task"]);
export const CONTINUITY_PROTOCOL_VERSION = 1;
const SELECTOR_KINDS = new Set(["section", "lines", "jsonPointer", "wholeFile"]);
const KNOWLEDGE_CATEGORIES = ["confirmed", "rejected", "unverified"];
const KNOWLEDGE_KINDS = new Set(["constraint", "conclusion", "decision", "attempt"]);
const MAX_STATEMENT_BYTES = 2000;
const ROLE_ORDER = ["taskHandoff", "taskState", "currentExecution", "taskKnowledge"];
const KNOWLEDGE_KEYS = new Set(["schemaVersion", "revision", "updatedAt", ...KNOWLEDGE_CATEGORIES]);
const KNOWLEDGE_RECORD_KEYS = new Set(["id", "kind", "statement", "evidence"]);
const EVIDENCE_KEYS = new Set(["kind", "role", "path", "selector", "sourceRevision"]);
const SELECTOR_KEYS = new Map([
  ["section", new Set(["kind", "id"])],
  ["lines", new Set(["kind", "startLine", "endLine"])],
  ["jsonPointer", new Set(["kind", "pointer"])],
  ["wholeFile", new Set(["kind"])],
]);
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const TASK_STATE_STATUSES = new Set(["todo", "doing", "blocked", "done"]);
export const TASK_STATE_TRANSITIONS = new Map([
  ["todo", new Set(["todo", "doing"])],
  ["doing", new Set(["doing", "blocked", "done"])],
  ["blocked", new Set(["blocked", "doing"])],
  ["done", new Set(["done", "doing"])],
]);

function now() {
  return new Date().toISOString();
}

function writeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJson(raw, label) {
  try {
    return JSON.parse(String(raw).replace(/^\uFEFF/u, ""));
  } catch (error) {
    throw new Error(`${label} invalid JSON: ${error.message}`);
  }
}

function normalizePath(value) {
  return String(value).replaceAll("\\", "/");
}

function fileContent(root, relativePath) {
  const state = inspectTargetFile(root, relativePath);
  return state.exists ? fs.readFileSync(state.path, "utf8") : null;
}

function requireContent(root, relativePath) {
  const content = fileContent(root, relativePath);
  if (content === null) throw new Error(`missing continuity file: ${relativePath}`);
  return content;
}

function semanticRevision(value) {
  const copy = { ...value, revision: "" };
  return sha256(`${JSON.stringify(copy, null, 2)}\n`);
}

function byteLength(value) {
  return Buffer.byteLength(String(value), "utf8");
}

export function validateTaskStateNotes(args) {
  for (const field of ["blocker", "doneWhen"]) {
    if (args[field + "Provided"] && (typeof args[field] !== "string" || byteLength(args[field]) > MAX_STATEMENT_BYTES)) {
      throw new Error("task state " + field + " must be at most " + MAX_STATEMENT_BYTES + " UTF-8 bytes");
    }
  }
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function localDate() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function sourceEntry(manifest, role, relativePath) {
  const entries = collectDocumentEntries(manifest, { allowLegacy: false });
  const matches = entries.filter((entry) => entry.role === role && normalizePath(entry.path) === normalizePath(relativePath));
  if (matches.length !== 1) throw new Error(`manifest must register exactly one ${role}:${relativePath}`);
  return matches[0];
}

export function continuityPaths(manifest) {
  const capsule = manifest.taskContext?.currentTaskCapsule;
  const continuity = manifest.taskContext?.continuity;
  if (typeof capsule !== "string" || !capsule || continuity?.enabled !== true || continuity.protocolVersion !== CONTINUITY_PROTOCOL_VERSION) {
    throw new Error("taskContext.continuity is not enabled");
  }
  const pathIssue = validateProjectRelativePath(capsule, "taskContext.currentTaskCapsule");
  if (pathIssue) throw new Error(pathIssue);
  const normalized = capsule;
  const knowledge = `${normalized}/确认状态.json`;
  const handoff = `${normalized}/任务交接.md`;
  if (continuity.knowledge !== knowledge || continuity.handoff !== handoff) {
    throw new Error("continuity knowledge/handoff paths must belong to current task capsule");
  }
  return {
    capsule: normalized,
    state: `${normalized}/任务状态.json`,
    knowledge,
    handoff,
    currentExecution: manifest.currentExecution || manifest.documents?.find((entry) => entry.role === "currentExecution")?.path || "docs/plans/执行光标.md",
  };
}

function assertExactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} has unknown field: ${key}`);
}

function assertRoleEntry(manifest, role, relativePath, owner, authority, dependsOn) {
  const entry = sourceEntry(manifest, role, relativePath);
  if (entry.owner !== owner || entry.authority !== authority || JSON.stringify(entry.dependsOn) !== JSON.stringify(dependsOn)) {
    throw new Error(`continuity role contract mismatch: ${role}:${relativePath}`);
  }
  return entry;
}

export function assertContinuityManifest(manifest, { initial = false } = {}) {
  if (manifest?.schemaVersion !== 2 || !Array.isArray(manifest.documents)) {
    throw new Error("continuity requires a valid schemaVersion 2 manifest with documents[]");
  }
  const validation = validateTargetDocManifest(manifest, { allowLegacy: false });
  if (!validation.ok) throw new Error(`invalid continuity manifest: ${validation.issues[0].code} at ${validation.issues[0].at}`);
  const continuity = manifest.taskContext?.continuity;
  if (initial) {
    if (continuity?.enabled === true || manifest.taskContext?.currentTaskCapsule) {
      throw new Error("continuity is already enabled; task switch unsupported in V1");
    }
    return;
  }
  if (manifest.taskContext?.enabled !== true || !continuity || typeof continuity !== "object" || Array.isArray(continuity)) {
    throw new Error("taskContext.continuity is not enabled");
  }
  assertExactKeys(continuity, new Set(["enabled", "protocolVersion", "knowledge", "handoff"]), "taskContext.continuity");
  const paths = continuityPaths(manifest);
  assertRoleEntry(manifest, "taskState", paths.state, "update-target-task-state", "source", []);
  assertRoleEntry(manifest, "taskKnowledge", paths.knowledge, "update-target-task-knowledge", "source", ["taskState"]);
  assertRoleEntry(manifest, "taskHandoff", paths.handoff, "generate-target-task-handoff", "projection", ["taskState", "taskKnowledge"]);
  sourceEntry(manifest, "currentExecution", paths.currentExecution);
}

export function recoverContinuity(root) {
  const journal = readTargetText(root, CONTINUITY_JOURNAL);
  if (journal === null) return { recovered: false, reason: "journal-missing" };
  return recoverTargetTransaction(root, CONTINUITY_JOURNAL);
}

export function readKnowledge(root, manifest) {
  const paths = continuityPaths(manifest);
  const raw = requireContent(root, paths.knowledge);
  return { paths, raw, value: parseJson(raw, paths.knowledge) };
}

export function readTaskState(root, manifest) {
  const paths = continuityPaths(manifest);
  const raw = requireContent(root, paths.state);
  return { paths, raw, value: parseJson(raw, paths.state) };
}

export function makeInitialKnowledge() {
  const value = {
    schemaVersion: 1,
    revision: "",
    updatedAt: now(),
    confirmed: [],
    rejected: [],
    unverified: [],
  };
  value.revision = semanticRevision(value);
  return value;
}

function validateSelector(selector) {
  if (!selector || typeof selector !== "object" || Array.isArray(selector) || !SELECTOR_KINDS.has(selector.kind)) {
    throw new Error("evidence.selector.kind must be section, lines, jsonPointer, or wholeFile");
  }
  assertExactKeys(selector, SELECTOR_KEYS.get(selector.kind), `evidence.selector.${selector.kind}`);
  if (selector.kind === "section" && (typeof selector.id !== "string" || !selector.id.trim())) throw new Error("section selector requires id");
  if (selector.kind === "lines" && (!Number.isInteger(selector.startLine) || !Number.isInteger(selector.endLine) || selector.startLine < 1 || selector.endLine < selector.startLine)) {
    throw new Error("lines selector requires a valid range");
  }
  if (selector.kind === "jsonPointer" && (typeof selector.pointer !== "string" || !selector.pointer.startsWith("/"))) throw new Error("jsonPointer selector requires a pointer");
}

function validateKnowledgeRecord(record, label) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`${label} must be an object`);
  assertExactKeys(record, KNOWLEDGE_RECORD_KEYS, label);
  if (typeof record.id !== "string" || !/^K-[0-9]{3,}$/u.test(record.id)) throw new Error(`${label}.id must match K-[0-9]{3,}`);
  if (!KNOWLEDGE_KINDS.has(record.kind)) throw new Error(`${label}.kind is invalid`);
  if (typeof record.statement !== "string" || !record.statement.trim() || byteLength(record.statement) > MAX_STATEMENT_BYTES) throw new Error(`${label}.statement must be 1-${MAX_STATEMENT_BYTES} UTF-8 bytes`);
  if (!Array.isArray(record.evidence)) throw new Error(`${label}.evidence must be an array`);
  for (const [index, evidence] of record.evidence.entries()) {
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) throw new Error(`${label}.evidence[${index}] must be an object`);
    assertExactKeys(evidence, EVIDENCE_KEYS, `${label}.evidence[${index}]`);
    if (evidence.kind !== "document" || typeof evidence.role !== "string" || typeof evidence.path !== "string" || !HASH_PATTERN.test(evidence.sourceRevision || "")) throw new Error(`${label}.evidence[${index}] has invalid document fields`);
    validateSelector(evidence.selector);
  }
}

export function validateKnowledge(value) {
  if (!value || value.schemaVersion !== 1 || !/^sha256:[a-f0-9]{64}$/u.test(value.revision || "")) throw new Error("knowledge schemaVersion/revision is invalid");
  assertExactKeys(value, KNOWLEDGE_KEYS, "knowledge");
  if (typeof value.updatedAt !== "string") throw new Error("knowledge.updatedAt must be a string");
  const ids = new Set();
  for (const category of KNOWLEDGE_CATEGORIES) {
    if (!Array.isArray(value[category])) throw new Error(`knowledge.${category} must be an array`);
    for (const [index, record] of value[category].entries()) {
      validateKnowledgeRecord(record, `${category}[${index}]`);
      if (ids.has(record.id)) throw new Error(`duplicate knowledge id: ${record.id}`);
      ids.add(record.id);
    }
  }
  if (semanticRevision(value) !== value.revision) throw new Error("knowledge revision does not match semantic content");
  return value;
}

export function validateTaskState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== 2) throw new Error("task state schemaVersion is invalid");
  for (const field of ["id", "title", "createdAt", "updatedAt", "phase", "task", "checkpoint", "nextStep", "manualAcceptanceRef"]) {
    if (typeof value[field] !== "string") throw new Error(`task state ${field} must be a string`);
  }
  if (!TASK_STATE_STATUSES.has(value.status)) throw new Error("task state status is invalid");
  if (!value.context || typeof value.context !== "object" || Array.isArray(value.context)) throw new Error("task state context is invalid");
  for (const field of ["blocker", "doneWhen"]) {
    if (value[field] !== undefined && (typeof value[field] !== "string" || byteLength(value[field]) > MAX_STATEMENT_BYTES)) throw new Error(`task state ${field} must be at most ${MAX_STATEMENT_BYTES} UTF-8 bytes`);
  }
  if (!HASH_PATTERN.test(value.revision || "")) throw new Error("task state revision is invalid");
  if (semanticRevision(value) !== value.revision) throw new Error("task state revision does not match semantic content");
  return value;
}

export function validateEvidence(root, manifest, evidence) {
  if (!Array.isArray(evidence)) throw new Error("--evidence-json must be a JSON array");
  const seen = new Set();
  for (const [index, item] of evidence.entries()) {
    const label = `evidence[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item) || item.kind !== "document") throw new Error(`${label} must be a document object`);
    assertExactKeys(item, EVIDENCE_KEYS, label);
    if (typeof item.role !== "string" || typeof item.path !== "string" || !HASH_PATTERN.test(item.sourceRevision || "")) throw new Error(`${label} has invalid role/path/sourceRevision`);
    validateSelector(item.selector);
    const key = `${item.role}\0${normalizePath(item.path)}\0${JSON.stringify(item.selector)}`;
    if (seen.has(key)) throw new Error(`duplicate evidence: ${item.role}:${item.path}`);
    seen.add(key);
    const entry = sourceEntry(manifest, item.role, item.path);
    const content = requireContent(root, item.path);
    const actual = hashContent(content);
    if (entry.contentHash !== actual || item.sourceRevision !== actual) throw new Error(`${label} is stale: source hash does not match manifest and sourceRevision`);
    if (item.selector.kind === "section" && !entry.sections.some((section) => section.id === item.selector.id)) throw new Error(`${label} section is not indexed`);
    if (item.selector.kind === "lines") {
      const lines = content.replace(/\r\n?/gu, "\n").split("\n");
      if (item.selector.endLine > lines.length) throw new Error(`${label} line range is out of bounds`);
    }
  }
  return evidence;
}

export function evidenceStatuses(root, manifest, knowledge) {
  const result = [];
  for (const category of KNOWLEDGE_CATEGORIES) {
    for (const record of knowledge[category] || []) {
      for (const evidence of record.evidence || []) {
        try {
          const entry = sourceEntry(manifest, evidence.role, evidence.path);
          const actual = hashContent(requireContent(root, evidence.path));
          result.push({ id: record.id, role: evidence.role, path: evidence.path, status: entry.contentHash === actual && evidence.sourceRevision === actual ? "fresh" : "stale" });
        } catch (error) {
          result.push({ id: record.id, role: evidence.role, path: evidence.path, status: "stale", reason: error.message });
        }
      }
    }
  }
  return result;
}

function recordsText(records) {
  if (!records || records.length === 0) return "未记录";
  return records.map((record) => `- [${record.id}] ${record.statement}`).join("\n");
}

export function renderHandoff(state, knowledge) {
  const blocker = state.blocker || "未记录";
  const doneWhen = state.doneWhen || "未记录";
  return [
    `<!-- vibe-task-handoff:v1 stateRevision=${state.revision} knowledgeRevision=${knowledge.revision} -->`,
    "# 任务交接",
    "",
    "## 当前状态",
    `- 阶段：${state.phase || "未记录"}`,
    `- 任务：${state.task || state.title || "未记录"}`,
    `- 状态：${state.status || "未记录"}`,
    `- 检查点：${state.checkpoint || "未记录"}`,
    `- 下一步：${state.nextStep || "未记录"}`,
    `- 阻塞：${blocker}`,
    `- 完成条件：${doneWhen}`,
    "",
    "## 已确认结论",
    recordsText(knowledge.confirmed),
    "",
    "## 已拒绝结论",
    recordsText(knowledge.rejected),
    "",
    "## 未确认事项",
    recordsText(knowledge.unverified),
    "",
    "## 下一步",
    state.nextStep || "未记录",
    "",
  ].join("\n");
}

function cursorContent(state, source) {
  const singleLine = (value) => String(value || "").replace(/\s+/gu, " ").trim();
  return [
    "<!-- vibe-state-projection -->",
    `phase: ${singleLine(state.phase)}`,
    `task: ${singleLine(state.task)}`,
    `status: ${state.status}`,
    `revision: ${state.revision}`,
    `checkpoint: ${singleLine(state.checkpoint)}`,
    `nextStep: ${singleLine(state.nextStep)}`,
    `source: ${source}`,
    "---",
    "# 执行光标",
    "",
    "本文件由 update-target-task-state.mjs 生成；任务状态.json 是唯一可写任务状态真源。",
    "",
  ].join("\n");
}

function upsertEntries(entries, additions) {
  const replacementKeys = new Set(additions.map((entry) => `${entry.role}\0${normalizePath(entry.path)}`));
  return [...entries.filter((entry) => !replacementKeys.has(`${entry.role}\0${normalizePath(entry.path)}`)), ...additions];
}

function continuityEntry(role, relativePath, owner, authority, dependsOn, content) {
  return {
    role,
    path: relativePath,
    owner,
    authority,
    ...metadataForDocument(relativePath, content),
    dependsOn,
  };
}

function assertFreshSource(root, manifest, role, relativePath) {
  const entry = sourceEntry(manifest, role, relativePath);
  const content = fileContent(root, relativePath);
  if (content === null) throw new Error("continuity source is missing: " + role + ":" + relativePath);
  const actual = hashContent(content);
  if (entry.contentHash !== actual) throw new Error("continuity source metadata is stale: " + role + ":" + relativePath);
  return content;
}

export function buildManifestOperations(root, manifest, manifestRaw, updates) {
  const planned = new Map(updates.map((item) => [normalizePath(item.file), item.content]));
  const sourceSnapshots = new Map();
  const preconditions = [];
  for (const entry of manifest.documents) {
    if (entry.authority !== "source" || planned.has(normalizePath(entry.path))) continue;
    const content = assertFreshSource(root, manifest, entry.role, entry.path);
    sourceSnapshots.set(normalizePath(entry.path), content);
    preconditions.push({ file: entry.path, expectedContent: content });
  }
  const documents = refreshDocumentEntries(manifest.documents, (entry) => planned.get(normalizePath(entry.path)) ?? sourceSnapshots.get(normalizePath(entry.path)) ?? fileContent(root, entry.path));
  const finalized = finalizeDocumentIndex(documents, manifest.documentIndex);
  const nextManifest = { ...manifest, documents: finalized.documents };
  const nextManifestRaw = writeJson(nextManifest);
  const operations = updates.map((item) => ({ file: item.file, content: item.content, expectedContent: Object.prototype.hasOwnProperty.call(item, "expectedContent") ? item.expectedContent : readTargetText(root, item.file) }));
  operations.push({ file: finalized.indexPath, content: finalized.indexContent, expectedContent: readTargetText(root, finalized.indexPath) });
  if (nextManifestRaw !== manifestRaw) operations.push({ file: ".vibe-docs.json", content: nextManifestRaw, expectedContent: manifestRaw });
  return { nextManifest, nextManifestRaw, indexContent: finalized.indexContent, operations, preconditions };
}

export function commitContinuityPlan(root, plan, kind) {
  const operations = Array.isArray(plan) ? plan : plan.operations;
  const preconditions = Array.isArray(plan) ? [] : plan.preconditions || [];
  return commitTargetTransaction(root, { journalPath: CONTINUITY_JOURNAL, kind, operations, preconditions });
}

function initialState(id, title) {
  const value = {
    schemaVersion: 2,
    id,
    title,
    status: "doing",
    createdAt: now(),
    updatedAt: now(),
    phase: "",
    task: title,
    checkpoint: "任务胶囊已创建",
    nextStep: "补充实现计划并开始实现",
    blocker: "",
    doneWhen: "",
    manualAcceptanceRef: "",
    context: { implementation: "实现上下文.jsonl", acceptance: "验收上下文.jsonl" },
    revision: "",
  };
  value.revision = semanticRevision(value);
  return value;
}

function initialCapsuleFiles(root, manifest, capsule, id, title, state, knowledge, handoff) {
  const sourceItem = (role, reason, source) => {
    const file = manifest[role] || manifest.documents.find((entry) => entry.role === role)?.path;
    if (!file) return null;
    const content = requireContent(root, file);
    return { role, file, selector: { kind: "wholeFile" }, reason, source, required: true, sourceRevision: hashContent(content), maxTokens: 20000 };
  };
  const implementation = [sourceItem("productSpec", "当前任务需求", "spec"), sourceItem("devPlan", "当前任务计划", "spec")].filter(Boolean);
  const acceptance = [sourceItem("manualAcceptance", "当前任务验收事实", "validation"), sourceItem("productSpec", "当前任务验收依据", "validation")].filter(Boolean);
  return new Map([
    [`${capsule}/任务状态.json`, writeJson(state)],
    [`${capsule}/需求摘录.md`, `# 需求摘录\n\n- 任务：${title}\n- 胶囊ID：${id}\n\n本文件记录当前任务对应的需求摘录。创建时尚未摘录需求。\n`],
    [`${capsule}/实现计划.md`, `# 实现计划\n\n- 任务：${title}\n- 胶囊ID：${id}\n\n本文件记录当前任务的实现步骤、影响面、验证路径和升级触发条件。\n`],
    [`${capsule}/研究记录.md`, `# 研究记录\n\n- 任务：${title}\n- 胶囊ID：${id}\n\n本文件记录当前任务的调研结论、来源和未验证项。\n`],
    [`${capsule}/实现上下文.jsonl`, `${implementation.map((item) => JSON.stringify(item)).join("\n")}\n`],
    [`${capsule}/验收上下文.jsonl`, `${acceptance.map((item) => JSON.stringify(item)).join("\n")}\n`],
    [`${capsule}/确认状态.json`, writeJson(knowledge)],
    [`${capsule}/任务交接.md`, handoff],
  ]);
}

export function initializeContinuity(root, manifest, manifestRaw, args) {
  assertSafeTargetRoot(root);
  recoverContinuity(root);
  if (!CONTINUITY_MODES.has(args.continuityMode)) throw new Error("unsupported --continuity-mode");
  if (manifest.taskContext?.continuity?.enabled === true) {
    assertContinuityManifest(manifest);
    if (args.slug || args.title) throw new Error("continuity task switch unsupported in V1");
    const paths = continuityPaths(manifest);
    const state = readTaskState(root, manifest).value;
    const knowledge = readKnowledge(root, manifest).value;
    validateTaskState(state);
    validateKnowledge(knowledge);
    const handoff = renderHandoff(state, knowledge);
    const handoffRaw = requireContent(root, paths.handoff);
    const plan = buildManifestOperations(root, manifest, manifestRaw, [
      { file: paths.handoff, content: handoff, expectedContent: handoffRaw },
    ]);
    if (args.mode !== "write") {
      const changes = plan.operations.filter((operation) => operation.content !== readTargetText(root, operation.file));
      return { ok: args.mode === "dry-run" || changes.length === 0, mode: args.mode, targetRoot: root, taskContext: manifest.taskContext, files: changes.map((operation) => ({ file: operation.file, action: "planned", status: "pending" })), summary: { changes: changes.length, failures: 0 } };
    }
    const transaction = commitContinuityPlan(root, plan, "task-continuity-refresh");
    return { ok: true, mode: args.mode, targetRoot: root, taskContext: manifest.taskContext, files: transaction.changed.map((file) => ({ file, action: "written", status: "written" })), summary: { changes: transaction.changed.length, failures: 0 } };
  }
  assertContinuityManifest(manifest, { initial: true });
  if (!args.slug || !args.title) throw new Error("首次启用 continuity requires --slug and --title");
  const slug = slugify(args.slug);
  if (!slug) throw new Error("--slug must contain at least one ASCII letter or digit");
  if (slug.length > 80) throw new Error("--slug must normalize to at most 80 ASCII characters");
  const taskRoot = manifest.taskContext?.taskCapsulesRoot || "docs/plans/任务";
  const capsule = `${taskRoot.replace(/\/$/u, "")}/${localDate()}-${slug}`;
  const pathIssue = validateProjectRelativePath(capsule, "currentTaskCapsule");
  if (pathIssue) throw new Error(pathIssue);
  const id = `${localDate()}-${slug}`;
  const state = initialState(id, args.title);
  const knowledge = makeInitialKnowledge();
  const continuity = { enabled: true, protocolVersion: CONTINUITY_PROTOCOL_VERSION, knowledge: `${capsule}/确认状态.json`, handoff: `${capsule}/任务交接.md` };
  const nextTaskContext = { ...(manifest.taskContext || {}), enabled: true, taskCapsulesRoot: taskRoot, currentTaskCapsule: capsule, continuity };
  const nextManifestBase = { ...manifest, taskContext: nextTaskContext };
  const handoff = renderHandoff(state, knowledge);
  const files = initialCapsuleFiles(root, manifest, capsule, id, args.title, state, knowledge, handoff);
  const additions = [
    continuityEntry("taskState", `${capsule}/任务状态.json`, "update-target-task-state", "source", [], files.get(`${capsule}/任务状态.json`)),
    continuityEntry("implementationContext", `${capsule}/实现上下文.jsonl`, "init-target-task-context", "source", ["taskState"], files.get(`${capsule}/实现上下文.jsonl`)),
    continuityEntry("acceptanceContext", `${capsule}/验收上下文.jsonl`, "init-target-task-context", "source", ["taskState"], files.get(`${capsule}/验收上下文.jsonl`)),
    continuityEntry("taskKnowledge", continuity.knowledge, "update-target-task-knowledge", "source", ["taskState"], files.get(continuity.knowledge)),
    continuityEntry("taskHandoff", continuity.handoff, "generate-target-task-handoff", "projection", ["taskState", "taskKnowledge"], files.get(continuity.handoff)),
  ];
  const nextManifest = { ...nextManifestBase, documents: upsertEntries(manifest.documents, additions) };
  const updates = [...files.entries()].map(([file, content]) => ({ file, content, expectedContent: null }));
  const plan = buildManifestOperations(root, nextManifest, manifestRaw, updates);
  if (args.mode !== "write") {
    const changes = plan.operations.filter((operation) => operation.content !== readTargetText(root, operation.file));
    return { ok: args.mode === "dry-run" || changes.length === 0, mode: args.mode, targetRoot: root, taskContext: nextTaskContext, files: changes.map((operation) => ({ file: operation.file, action: "planned", status: "pending" })), summary: { changes: changes.length, failures: 0 } };
  }
  const transaction = commitContinuityPlan(root, plan, "task-continuity-init");
  return { ok: true, mode: args.mode, targetRoot: root, taskContext: nextTaskContext, files: transaction.changed.map((file) => ({ file, action: "written", status: "written" })), summary: { changes: transaction.changed.length, failures: 0 } };
}

export function updateContinuityKnowledge(root, manifest, manifestRaw, args, evidence) {
  recoverContinuity(root);
  assertContinuityManifest(manifest);
  const { paths, raw: knowledgeRaw, value: current } = readKnowledge(root, manifest);
  validateKnowledge(current);
  if (!KNOWLEDGE_CATEGORIES.includes(args.category)) throw new Error("knowledge category is invalid");
  if (typeof args.expectedRevision !== "string" || args.expectedRevision !== current.revision) throw new Error(`revision conflict: expected ${args.expectedRevision || "<empty>"}, found ${current.revision}`);
  validateEvidence(root, manifest, evidence);
  const next = { ...current, updatedAt: now(), revision: "" };
  for (const category of KNOWLEDGE_CATEGORIES) next[category] = (current[category] || []).filter((record) => record.id !== args.id);
  const record = { id: args.id, kind: args.kind, statement: args.statement, evidence };
  validateKnowledgeRecord(record, "knowledge record");
  next[args.category].push(record);
  next.revision = semanticRevision(next);
  const state = readTaskState(root, manifest).value;
  validateTaskState(state);
  const handoff = renderHandoff(state, next);
  const updates = [
    { file: paths.knowledge, content: writeJson(next), expectedContent: knowledgeRaw },
    { file: paths.handoff, content: handoff, expectedContent: readTargetText(root, paths.handoff) },
  ];
  const plan = buildManifestOperations(root, manifest, manifestRaw, updates);
  const transaction = commitContinuityPlan(root, plan, "task-continuity-knowledge");
  return { ok: true, revision: next.revision, changed: transaction.changed, knowledge: next };
}

export function updateContinuityState(root, manifest, manifestRaw, args) {
  recoverContinuity(root);
  assertContinuityManifest(manifest);
  const { paths, raw: stateRaw, value: current } = readTaskState(root, manifest);
  validateTaskState(current);
  validateTaskStateNotes(args);
  if (args.expectedRevisionProvided && current.revision !== args.expectedRevision) throw new Error(`revision conflict: expected ${args.expectedRevision || "<empty>"}, found ${current.revision || "<missing>"}`);
  const allowed = TASK_STATE_TRANSITIONS.get(current.status);
  if (!allowed || !allowed.has(args.status)) throw new Error(`illegal transition: ${current.status} -> ${args.status}`);
  const next = {
    ...current,
    schemaVersion: 2,
    phase: args.phase,
    task: args.task,
    status: args.status,
    checkpoint: args.checkpoint,
    nextStep: args.next,
    manualAcceptanceRef: args.manualAcceptanceRef ?? current.manualAcceptanceRef ?? "",
    blocker: args.blockerProvided ? args.blocker : current.blocker ?? "",
    doneWhen: args.doneWhenProvided ? args.doneWhen : current.doneWhen ?? "",
    updatedAt: now(),
    revision: "",
  };
  next.revision = semanticRevision(next);
  validateTaskState(next);
  const knowledge = readKnowledge(root, manifest).value;
  validateKnowledge(knowledge);
  const handoff = renderHandoff(next, knowledge);
  const cursor = cursorContent(next, paths.state);
  const updates = [
    { file: paths.state, content: writeJson(next), expectedContent: stateRaw },
    { file: paths.currentExecution, content: cursor, expectedContent: readTargetText(root, paths.currentExecution) },
    { file: paths.handoff, content: handoff, expectedContent: readTargetText(root, paths.handoff) },
  ];
  const plan = buildManifestOperations(root, manifest, manifestRaw, updates);
  const transaction = commitContinuityPlan(root, plan, "task-continuity-state");
  return { ok: true, status: next.status, revision: next.revision, stateFile: paths.state, cursorFile: paths.currentExecution, changed: transaction.changed };
}

export function generateContinuityHandoff(root, manifest, manifestRaw, mode) {
  recoverContinuity(root);
  assertContinuityManifest(manifest);
  const paths = continuityPaths(manifest);
  assertFreshSource(root, manifest, "taskState", paths.state);
  assertFreshSource(root, manifest, "taskKnowledge", paths.knowledge);
  const state = readTaskState(root, manifest).value;
  const knowledge = readKnowledge(root, manifest).value;
  validateTaskState(state);
  validateKnowledge(knowledge);
  const statuses = evidenceStatuses(root, manifest, knowledge);
  if (statuses.some((item) => item.status === "stale")) throw new Error("continuity source evidence is stale");
  const nextHandoff = renderHandoff(state, knowledge);
  const current = readTargetText(root, paths.handoff);
  if (mode === "check") {
    if (current !== nextHandoff) throw new Error("task handoff is stale");
    return { ok: true, changed: [] };
  }
  if (mode === "dry-run") return { ok: true, changed: current === nextHandoff ? [] : [paths.handoff], handoff: nextHandoff };
  const updates = [{ file: paths.handoff, content: nextHandoff, expectedContent: current }];
  const plan = buildManifestOperations(root, manifest, manifestRaw, updates);
  const transaction = commitContinuityPlan(root, plan, "task-continuity-handoff");
  return { ok: true, changed: transaction.changed };
}

function roleEntry(manifest, role, relativePath) {
  return sourceEntry(manifest, role, relativePath);
}

function resultEntry(role, relativePath, entry, content, policy = "onDemand") {
  return { role, path: relativePath, policy, estimatedTokens: Math.max(1, estimateTokens(content)), contentHash: entry.contentHash };
}

function handoffRevisions(content) {
  const match = String(content).match(/^<!-- vibe-task-handoff:v1 stateRevision=(sha256:[a-f0-9]{64}) knowledgeRevision=(sha256:[a-f0-9]{64}) -->/u);
  if (!match) return null;
  return { stateRevision: match[1], knowledgeRevision: match[2] };
}

function continuitySort(items) {
  const rank = (role) => {
    const index = ROLE_ORDER.indexOf(role);
    return index < 0 ? ROLE_ORDER.length : index;
  };
  return [...items].sort((left, right) => rank(left.role) - rank(right.role) || String(left.path || "").localeCompare(String(right.path || "")) || String(left.reason || "").localeCompare(String(right.reason || "")));
}

export function resolveContinuityContext(root, manifest, options = {}) {
  recoverContinuity(root);
  assertContinuityManifest(manifest);
  const paths = continuityPaths(manifest);
  if (options.capsule !== paths.capsule) throw new Error("--capsule must exactly match current task capsule");
  const mapping = [
    ["taskHandoff", paths.handoff],
    ["taskState", paths.state],
    ["currentExecution", paths.currentExecution],
    ["taskKnowledge", paths.knowledge],
  ];
  const stale = [];
  const blockedRoles = new Set();
  const sources = new Map();
  const addStale = (role, relativePath, reason, extra = {}) => {
    blockedRoles.add(role);
    stale.push({ role, path: relativePath, reason, ...extra });
  };

  for (const [role, relativePath] of mapping) {
    const entry = roleEntry(manifest, role, relativePath);
    const content = fileContent(root, relativePath);
    if (content === null) {
      addStale(role, relativePath, "missing");
      continue;
    }
    const actual = hashContent(content);
    if (entry.contentHash !== actual) {
      addStale(role, relativePath, "content-hash-mismatch", { expected: entry.contentHash, actual });
      continue;
    }
    sources.set(role, { entry, content });
  }

  let state = null;
  const stateSource = sources.get("taskState");
  if (stateSource) {
    try {
      state = parseJson(stateSource.content, paths.state);
      validateTaskState(state);
    } catch (error) {
      addStale("taskState", paths.state, "invalid-state", { detail: error.message });
    }
  }

  let knowledge = null;
  const knowledgeSource = sources.get("taskKnowledge");
  if (knowledgeSource) {
    try {
      knowledge = parseJson(knowledgeSource.content, paths.knowledge);
      validateKnowledge(knowledge);
    } catch (error) {
      addStale("taskKnowledge", paths.knowledge, "invalid-knowledge", { detail: error.message });
    }
  }

  const handoffSource = sources.get("taskHandoff");
  if (handoffSource) {
    const revisions = handoffRevisions(handoffSource.content);
    if (!revisions) {
      addStale("taskHandoff", paths.handoff, "handoff-header-invalid");
    } else if (!state || !knowledge) {
      addStale("taskHandoff", paths.handoff, "source-unavailable");
    } else if (revisions.stateRevision !== state.revision || revisions.knowledgeRevision !== knowledge.revision) {
      addStale("taskHandoff", paths.handoff, "source-revision-mismatch");
    }
  }

  if (knowledge && !blockedRoles.has("taskKnowledge")) {
    for (const status of evidenceStatuses(root, manifest, knowledge)) {
      if (status.status === "stale") {
        stale.push({ role: "taskKnowledge", path: paths.knowledge, reason: "evidence-stale", evidence: status });
      }
    }
  }

  const allowed = [];
  for (const [role, relativePath] of mapping) {
    if (blockedRoles.has(role)) continue;
    const source = sources.get(role);
    if (!source) continue;
    allowed.push(resultEntry(role, relativePath, source.entry, source.content));
  }
  const sortedAllowed = continuitySort(allowed);
  const sortedStale = continuitySort(stale);
  const budget = options.budget || 20000;
  const totalTokens = sortedAllowed.reduce((sum, entry) => sum + entry.estimatedTokens, 0);
  const denied = totalTokens > budget ? [{ role: "continuity", path: paths.capsule, reason: "budget-exceeded", estimatedTokens: totalTokens, budget }] : [];
  return { root, allowed: sortedAllowed, denied, stale: sortedStale, estimatedTokens: totalTokens, totalTokens, budget, ok: denied.length === 0 && sortedStale.length === 0 };
}
