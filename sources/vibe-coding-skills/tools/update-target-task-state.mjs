#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { assertSafeTargetRoot } from "./safe-target-fs.mjs";
import { commitTargetTransaction, readTargetText, sha256 } from "./target-doc-transaction.mjs";
import { finalizeDocumentIndex, refreshDocumentEntries } from "./target-doc-index-core.mjs";
import { validateTargetDocManifest } from "./target-doc-manifest-core.mjs";
import { TASK_STATE_TRANSITIONS, recoverContinuity, updateContinuityState, validateTaskStateNotes } from "./target-task-continuity-core.mjs";

const STATUSES = new Set(["todo", "doing", "blocked", "done"]);
const JOURNAL = ".vibe-task-state.json";

function usage() {
  console.error("Usage: node tools/update-target-task-state.mjs <root> --status <todo|doing|blocked|done> --phase <id> --task <id> --checkpoint <text> --next <text> [--blocker <text>] [--done-when <text>] [--expected-revision <hash>] [--manual-acceptance-ref <id>] --write [--json]");
}

function parseArgs(argv) {
  const args = { root: "", status: "", phase: "", task: "", checkpoint: "", next: "", blocker: "", blockerProvided: false, doneWhen: "", doneWhenProvided: false, expectedRevision: "", expectedRevisionProvided: false, manualAcceptanceRef: null, write: false, json: false };
  const values = new Map([
    ["--status", "status"], ["--phase", "phase"], ["--task", "task"], ["--checkpoint", "checkpoint"],
    ["--next", "next"], ["--blocker", "blocker"], ["--done-when", "doneWhen"], ["--expected-revision", "expectedRevision"], ["--manual-acceptance-ref", "manualAcceptanceRef"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (values.has(item)) {
      const field = values.get(item);
      // 记录 --expected-revision 是否在命令行出现过，用于区分"未传"与"传空串"。
      if (field === "expectedRevision") args.expectedRevisionProvided = true;
      if (field === "blocker") args.blockerProvided = true;
      if (field === "doneWhen") args.doneWhenProvided = true;
      args[field] = argv[++index] ?? "";
    }
    else if (item === "--write") args.write = true;
    else if (item === "--json") args.json = true;
    else if (item === "-h" || item === "--help") args.help = true;
    else if (!item.startsWith("-") && !args.root) args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function parseJson(raw, label) {
  try { return JSON.parse(raw.replace(/^\uFEFF/u, "")); }
  catch (error) { throw new Error(`${label} invalid JSON: ${error.message}`); }
}

function singleLine(value) {
  return String(value).replace(/\s+/gu, " ").trim();
}

function stateRevision(state) {
  return sha256(JSON.stringify({ ...state, revision: "" }));
}

function cursorContent(state, source) {
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

function execute(args) {
  if (!args.root || args.help) { usage(); return { exitCode: args.help ? 0 : 2 }; }
  if (!args.write) throw Object.assign(new Error("--write is required; state updates are never implicit"), { exitCode: 2 });
  for (const key of ["status", "phase", "task", "checkpoint", "next"]) {
    if (typeof args[key] !== "string" || !args[key].trim()) throw Object.assign(new Error(`--${key} is required`), { exitCode: 2 });
  }
  if (!STATUSES.has(args.status)) throw Object.assign(new Error("--status must be todo, doing, blocked, or done"), { exitCode: 2 });
  validateTaskStateNotes(args);
  const root = path.resolve(args.root);
  assertSafeTargetRoot(root);
  recoverContinuity(root);
  const manifestRaw = readTargetText(root, ".vibe-docs.json");
  if (manifestRaw === null) throw Object.assign(new Error(".vibe-docs.json is required"), { exitCode: 2 });
  const manifest = parseJson(manifestRaw, ".vibe-docs.json");
  const validation = validateTargetDocManifest(manifest);
  if (!validation.ok) throw Object.assign(new Error(`invalid manifest: ${validation.issues[0].code} at ${validation.issues[0].at}`), { exitCode: 2 });
  if (manifest.taskContext?.continuity?.enabled === true) {
    const result = updateContinuityState(root, manifest, manifestRaw, args);
    return { exitCode: 0, payload: result };
  }
  const capsule = manifest.taskContext?.currentTaskCapsule;
  if (typeof capsule !== "string" || !capsule) throw Object.assign(new Error("taskContext.currentTaskCapsule is required"), { exitCode: 2 });
  const stateFile = `${capsule.replace(/\/$/u, "")}/任务状态.json`;
  const stateRaw = readTargetText(root, stateFile);
  if (stateRaw === null) throw Object.assign(new Error(`task state missing: ${stateFile}`), { exitCode: 2 });
  const current = parseJson(stateRaw, stateFile);
  // CAS 并发锁：区分"未传"和"传了空串"。--expected-revision 一旦出现在命令行（哪怕是空串），
  // 就视为调用方声明要做乐观锁校验；空串永远不等于真实 revision，因此必然冲突——
  // 这样空值无法因 falsy 短路而静默绕过并发保护。只有完全不传该参数才跳过校验。
  if (args.expectedRevisionProvided && current.revision !== args.expectedRevision) {
    throw Object.assign(new Error(`revision conflict: expected ${args.expectedRevision || "<empty>"}, found ${current.revision || "<missing>"}`), { exitCode: 1 });
  }
  // 转移合法性：读取当前状态，校验"当前状态 → 目标状态"是否在允许矩阵内。
  const allowed = TASK_STATE_TRANSITIONS.get(current.status);
  if (!allowed) {
    throw Object.assign(new Error(`current status is not a recognized state: ${current.status || "<missing>"}`), { exitCode: 2 });
  }
  if (!allowed.has(args.status)) {
    throw Object.assign(
      new Error(`illegal transition: ${current.status} -> ${args.status}. allowed from ${current.status}: ${[...allowed].join(", ")}`),
      { exitCode: 1 },
    );
  }
  const nextState = {
    ...current,
    schemaVersion: 2,
    phase: args.phase,
    task: args.task,
    status: args.status,
    checkpoint: args.checkpoint,
    nextStep: args.next,
    blocker: args.blockerProvided ? args.blocker : current.blocker ?? "",
    doneWhen: args.doneWhenProvided ? args.doneWhen : current.doneWhen ?? "",
    manualAcceptanceRef: args.manualAcceptanceRef ?? current.manualAcceptanceRef ?? "",
    updatedAt: new Date().toISOString(),
    revision: "",
  };
  delete nextState.resume;
  delete nextState.manualAcceptance;
  nextState.revision = stateRevision(nextState);
  const nextStateRaw = `${JSON.stringify(nextState, null, 2)}\n`;
  const cursorFile = manifest.currentExecution || manifest.documents?.find((doc) => doc.role === "currentExecution")?.path || "docs/plans/执行光标.md";
  const nextCursorRaw = cursorContent(nextState, stateFile);
  const updates = new Map([[stateFile, nextStateRaw], [cursorFile, nextCursorRaw]]);
  const nextManifest = {
    ...manifest,
    documents: refreshDocumentEntries(manifest.documents, (entry) => updates.get(entry.path) ?? readTargetText(root, entry.path)),
  };
  const { documents, indexContent, indexPath } = finalizeDocumentIndex(nextManifest.documents, nextManifest.documentIndex);
  const indexedManifest = { ...nextManifest, documentIndex: indexPath, documents };
  const nextManifestRaw = `${JSON.stringify(indexedManifest, null, 2)}\n`;
  const operations = [
    { file: stateFile, content: nextStateRaw, expectedContent: stateRaw },
    { file: cursorFile, content: nextCursorRaw, expectedContent: readTargetText(root, cursorFile) },
    { file: indexPath, content: indexContent, expectedContent: readTargetText(root, indexPath) },
  ];
  if (nextManifestRaw !== manifestRaw) operations.push({ file: ".vibe-docs.json", content: nextManifestRaw, expectedContent: manifestRaw });
  const transaction = commitTargetTransaction(root, { journalPath: JOURNAL, kind: "task-state", operations });
  return { exitCode: 0, payload: { ok: true, status: nextState.status, revision: nextState.revision, stateFile, cursorFile, changed: transaction.changed } };
}

let args = { json: false };
try {
  args = parseArgs(process.argv.slice(2));
  const result = execute(args);
  process.exitCode = result.exitCode;
  if (result.payload) console.log(args.json ? JSON.stringify(result.payload, null, 2) : `Task state updated: ${result.payload.revision}`);
} catch (error) {
  const exitCode = error.exitCode || (error.code === "UNSAFE_TARGET_PATH" ? 2 : 2);
  process.exitCode = exitCode;
  const payload = { ok: false, error: error.message };
  if (args.json) console.log(JSON.stringify(payload, null, 2));
  else console.error(error.message);
}
