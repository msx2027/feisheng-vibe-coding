import fs from "node:fs";
import { inspectTargetDirectory, inspectTargetFile } from "./safe-target-fs.mjs";
import { readTargetText, sha256 } from "./target-doc-transaction.mjs";
import { parseMarkdownSections, renderTargetDocIndex } from "./target-doc-index-core.mjs";
import { COLLECTION_DOCUMENT_ROLES, estimateTokens, hashContent, REGISTERED_DOCUMENT_ROLES } from "./target-doc-manifest-core.mjs";

const NON_DOCUMENT_KEYS = new Set([
  "schemaVersion", "documentIndex", "documents", "loadPolicy", "taskContext", "ignore",
]);
const REGISTERED_ROLE_SET = new Set(REGISTERED_DOCUMENT_ROLES);
const COLLECTION_ROLE_SET = new Set(COLLECTION_DOCUMENT_ROLES);

function tokens(content) {
  return estimateTokens(content);
}

function sectionPrefix(role) {
  const cleaned = String(role).replace(/[^A-Za-z0-9]+/gu, "-").replace(/^-|-$/gu, "").toUpperCase();
  return cleaned || "DOC";
}

export function addSectionMarkers(content, role) {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  let count = 0;
  const output = [];
  for (const line of lines) {
    if (/^#{1,6}\s+/u.test(line)) {
      const previous = output.at(-1) || "";
      if (!/^<!-- vibe-section:[A-Za-z0-9._-]+ -->$/u.test(previous)) {
        count += 1;
        output.push(`<!-- vibe-section:${sectionPrefix(role)}-${String(count).padStart(3, "0")} -->`);
      }
    }
    output.push(line);
  }
  return output.join("\n");
}

export function sectionsFor(content) {
  return parseMarkdownSections(content);
}

function authorityFor(role, file) {
  if (/archive|history|归档|[一二三四五六七八九十]卷/iu.test(`${role} ${file}`)) return "archive";
  if (/cursor|index|projection|光标|索引/iu.test(`${role} ${file}`)) return "projection";
  if (/journal|log|session|记录/iu.test(`${role} ${file}`)) return "log";
  return "source";
}

function ownerFor(role) {
  return `migration:${role}`;
}

function pathLooksLikeDocument(value) {
  return typeof value === "string" && /\.(?:md|json|jsonl)$/iu.test(value);
}

export function discoverLegacyDocuments(root, manifest) {
  const byRole = new Map();
  const add = (document) => {
    if (!document || typeof document.role !== "string" || typeof document.path !== "string") return;
    const current = byRole.get(document.role) || [];
    if (!current.some((item) => item.path === document.path)) current.push({ ...document });
    byRole.set(document.role, current);
  };
  if (Array.isArray(manifest.documents)) {
    for (const doc of manifest.documents) {
      add(doc);
    }
  }
  for (const [role, value] of Object.entries(manifest)) {
    if (NON_DOCUMENT_KEYS.has(role) || !REGISTERED_ROLE_SET.has(role)) continue;
    const paths = COLLECTION_ROLE_SET.has(role) ? value : [value];
    if (!Array.isArray(paths) || paths.some((item) => !pathLooksLikeDocument(item))) continue;
    byRole.set(role, paths.map((documentPath) => ({
      role,
      path: documentPath,
      owner: ownerFor(role),
      authority: authorityFor(role, documentPath),
    })));
  }
  byRole.set("documentIndex", [{
    ...(byRole.get("documentIndex")?.[0] || {}),
    role: "documentIndex",
    path: manifest.documentIndex || "文档索引.md",
    owner: byRole.get("documentIndex")?.[0]?.owner || "build-target-doc-index",
    authority: "projection",
  }]);
  return [...byRole.values()].flat();
}

export function enrichDocuments(root, documents, overrides = new Map()) {
  return documents.map((doc) => {
    const content = overrides.has(doc.path) ? overrides.get(doc.path) : readTargetText(root, doc.path);
    return {
      role: doc.role,
      path: doc.path,
      owner: typeof doc.owner === "string" && doc.owner ? doc.owner : ownerFor(doc.role),
      authority: doc.authority || authorityFor(doc.role, doc.path),
      contentHash: content === null ? "" : hashContent(content),
      estimatedTokens: content === null ? 0 : tokens(content),
      dependsOn: Array.isArray(doc.dependsOn) ? [...new Set(doc.dependsOn.filter((item) => typeof item === "string"))] : [],
      sections: content === null || !doc.path.endsWith(".md") ? [] : sectionsFor(content),
    };
  });
}

export function renderDocumentIndex(documents) {
  return renderTargetDocIndex(documents);
}

export function normalizeLoadPolicy(manifest, documents) {
  const roles = new Set(documents.map((doc) => doc.role));
  const always = (Array.isArray(manifest.loadPolicy?.always) ? manifest.loadPolicy.always : []).filter((role) => roles.has(role) && role !== "documentIndex");
  always.unshift("documentIndex");
  const never = (Array.isArray(manifest.loadPolicy?.never) ? manifest.loadPolicy.never : []).filter((role) => roles.has(role));
  for (const doc of documents) if (doc.authority === "archive" && !never.includes(doc.role)) never.push(doc.role);
  return { always: [...new Set(always)].slice(0, 3), never: [...new Set(never)].filter((role) => !always.includes(role)) };
}

export function listTaskCapsules(root, manifest) {
  const taskRoot = manifest.taskContext?.taskCapsulesRoot || "plans/任务";
  let directory;
  try { directory = inspectTargetDirectory(root, taskRoot); } catch { return []; }
  if (!directory.exists) return [];
  return fs.readdirSync(directory.path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${taskRoot}/${entry.name}`.replaceAll("\\", "/"));
}

export function stateConflict(root, manifest) {
  const capsule = manifest.taskContext?.currentTaskCapsule;
  if (!capsule) return null;
  const stateRaw = readTargetText(root, `${capsule}/任务状态.json`);
  if (stateRaw === null) return null;
  let state;
  try { state = JSON.parse(stateRaw); } catch { return "current 任务状态.json is invalid JSON"; }
  const cursorPath = manifest.currentExecution || manifest.documents?.find((doc) => doc.role === "currentExecution")?.path || "plans/执行光标.md";
  const cursor = readTargetText(root, cursorPath);
  if (cursor === null) return null;
  const projected = Object.fromEntries([...cursor.matchAll(/^(phase|task|status):\s*(.+)$/gmu)].map((match) => [match[1], match[2].trim()]));
  for (const key of ["phase", "task", "status"]) {
    if (projected[key] && String(state[key] || "") !== projected[key]) return `${key} conflicts between 任务状态.json and ${cursorPath}`;
  }
  return null;
}

export function cleanupCandidates(root, documents) {
  const candidates = [];
  for (const doc of documents) {
    let state;
    try { state = inspectTargetFile(root, doc.path); } catch { continue; }
    if (!state.exists) continue;
    const content = fs.readFileSync(state.path, "utf8").trim();
    if (/^#\s+[^\n]+$/u.test(content)) candidates.push(doc.path);
  }
  return candidates;
}

export function normalizeCurrentTaskState(root, manifest) {
  const capsule = manifest.taskContext?.currentTaskCapsule;
  if (!capsule) return null;
  const file = `${capsule}/任务状态.json`;
  const raw = readTargetText(root, file);
  if (raw === null) return null;
  let current;
  try { current = JSON.parse(raw.replace(/^\uFEFF/u, "")); }
  catch (error) { throw new Error(`invalid current task state: ${error.message}`); }
  const next = {
    ...current,
    schemaVersion: 2,
    phase: String(current.phase || ""),
    task: String(current.task || current.title || ""),
    status: String(current.status || "todo"),
    checkpoint: String(current.checkpoint || current.resume?.lastCheckpoint || ""),
    nextStep: String(current.nextStep || current.resume?.nextStep || ""),
    manualAcceptanceRef: String(current.manualAcceptanceRef || ""),
    revision: "",
  };
  delete next.resume;
  delete next.manualAcceptance;
  next.revision = sha256(JSON.stringify(next));
  const content = `${JSON.stringify(next, null, 2)}\n`;
  const cursor = [
    "<!-- vibe-state-projection -->",
    `phase: ${next.phase.replace(/\s+/gu, " ")}`,
    `task: ${next.task.replace(/\s+/gu, " ")}`,
    `status: ${next.status}`,
    `revision: ${next.revision}`,
    `checkpoint: ${next.checkpoint.replace(/\s+/gu, " ")}`,
    `nextStep: ${next.nextStep.replace(/\s+/gu, " ")}`,
    `source: ${file}`,
    "---",
    "# 执行光标",
    "",
    "本文件由 update-target-task-state.mjs 生成；任务状态.json 是唯一可写任务状态真源。",
    "",
  ].join("\n");
  return { file, raw, content, state: next, cursor };
}
