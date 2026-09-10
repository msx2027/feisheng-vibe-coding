#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import {
  inspectTargetFile,
  safeWriteTargetFile,
} from "./safe-target-fs.mjs";

export function sha256(content) {
  return `sha256:${crypto.createHash("sha256").update(content, "utf8").digest("hex")}`;
}

export function readTargetText(root, file) {
  const state = inspectTargetFile(root, file);
  return state.exists ? fs.readFileSync(state.path, "utf8") : null;
}

function removeExpectedFile(root, file, expectedContent) {
  const state = inspectTargetFile(root, file);
  if (!state.exists) return;
  const current = fs.readFileSync(state.path, "utf8");
  if (current !== expectedContent) throw new Error(`rollback conflict: ${file}`);
  fs.unlinkSync(state.path);
}

function removeJournal(root, journalPath, expectedContent) {
  const state = inspectTargetFile(root, journalPath);
  if (!state.exists) return;
  const current = fs.readFileSync(state.path, "utf8");
  if (current !== expectedContent) throw new Error(`transaction journal changed: ${journalPath}`);
  fs.unlinkSync(state.path);
}

function encode(value) {
  return value === null ? null : Buffer.from(value, "utf8").toString("base64");
}

function decode(value) {
  return value === null ? null : Buffer.from(value, "base64").toString("utf8");
}

function journalContent(journal) {
  return `${JSON.stringify(journal, null, 2)}\n`;
}

function normalizeOperations(root, operations) {
  const seen = new Set();
  return operations.map((operation) => {
    if (!operation || typeof operation.file !== "string" || (typeof operation.content !== "string" && operation.content !== null)) {
      throw new Error("transaction operations require a file string and string-or-null content");
    }
    const key = process.platform === "win32" ? operation.file.toLowerCase() : operation.file;
    if (seen.has(key)) throw new Error(`duplicate transaction destination: ${operation.file}`);
    seen.add(key);
    const before = readTargetText(root, operation.file);
    if (Object.prototype.hasOwnProperty.call(operation, "expectedContent") && operation.expectedContent !== before) {
      throw new Error(`target changed after planning: ${operation.file}`);
    }
    return {
      file: operation.file,
      before,
      after: operation.content,
    };
  });
}

function validatePreconditions(root, preconditions) {
  if (!Array.isArray(preconditions)) throw new Error("transaction preconditions must be an array");
  const seen = new Set();
  for (const precondition of preconditions) {
    if (!precondition || typeof precondition.file !== "string" || (typeof precondition.expectedContent !== "string" && precondition.expectedContent !== null)) {
      throw new Error("transaction preconditions require a file string and string-or-null expectedContent");
    }
    const key = process.platform === "win32" ? precondition.file.toLowerCase() : precondition.file;
    if (seen.has(key)) throw new Error("duplicate transaction precondition: " + precondition.file);
    seen.add(key);
    if (readTargetText(root, precondition.file) !== precondition.expectedContent) {
      throw new Error("target changed after planning: " + precondition.file);
    }
  }
}

function rollbackNormalized(root, operations, appliedCount) {
  const failures = [];
  for (let index = appliedCount - 1; index >= 0; index -= 1) {
    const operation = operations[index];
    try {
      if (operation.before === null) removeExpectedFile(root, operation.file, operation.after);
      else safeWriteTargetFile(root, operation.file, operation.before, { expectedContent: operation.after });
    } catch (error) {
      failures.push(`${operation.file}: ${error.message}`);
    }
  }
  if (failures.length > 0) throw new Error(`rollback failed: ${failures.join("; ")}`);
}

export function commitTargetTransaction(root, options) {
  const { journalPath, operations, preconditions = [], kind = "target-doc" } = options;
  if (readTargetText(root, journalPath) !== null) {
    throw new Error(`unfinished transaction exists; recover first: ${journalPath}`);
  }
  validatePreconditions(root, preconditions);
  const normalized = normalizeOperations(root, operations).filter((item) => item.before !== item.after);
  if (normalized.length === 0) return { changed: [], journalPath };
  const journal = {
    schemaVersion: 1,
    kind,
    createdAt: new Date().toISOString(),
    status: "applying",
    operations: normalized.map((item) => ({
      file: item.file,
      beforeBase64: encode(item.before),
      afterBase64: encode(item.after),
      beforeHash: item.before === null ? null : sha256(item.before),
      afterHash: item.after === null ? null : sha256(item.after),
    })),
  };
  const initialJournal = journalContent(journal);
  safeWriteTargetFile(root, journalPath, initialJournal, { expectedContent: null });
  let appliedCount = 0;
  try {
    for (const operation of normalized) {
      options.testHooks?.beforeApply?.(operation, appliedCount);
      if (operation.after === null) removeExpectedFile(root, operation.file, operation.before);
      else safeWriteTargetFile(root, operation.file, operation.after, { expectedContent: operation.before });
      appliedCount += 1;
    }
    removeJournal(root, journalPath, initialJournal);
    return { changed: normalized.map((item) => item.file), journalPath };
  } catch (error) {
    try {
      rollbackNormalized(root, normalized, appliedCount);
      removeJournal(root, journalPath, initialJournal);
    } catch (rollbackError) {
      throw new Error(`${error.message}; ${rollbackError.message}; recover with journal ${journalPath}`);
    }
    throw error;
  }
}

export function commitTargetTransactionPhases(root, options) {
  const { journalPath, firstOperations, nextOperations, kind = "target-doc-phases" } = options;
  if (!Array.isArray(firstOperations) || typeof nextOperations !== "function") {
    throw new Error("phased transaction requires firstOperations and nextOperations");
  }
  const originalByFile = new Map();
  const controlledByFile = new Map();
  const rememberOriginals = (operations) => {
    if (!Array.isArray(operations)) throw new Error("phased transaction operations must be arrays");
    for (const operation of operations) {
      if (originalByFile.has(operation.file)) continue;
      const current = readTargetText(root, operation.file);
      originalByFile.set(operation.file, current);
      controlledByFile.set(operation.file, current);
    }
  };
  try {
    rememberOriginals(firstOperations);
    const first = commitTargetTransaction(root, { journalPath, operations: firstOperations, kind: `${kind}:first` });
    for (const operation of firstOperations) controlledByFile.set(operation.file, operation.content);
    const secondOperations = nextOperations(first);
    rememberOriginals(secondOperations);
    const second = commitTargetTransaction(root, { journalPath, operations: secondOperations, kind: `${kind}:second` });
    return { changed: [...new Set([...first.changed, ...second.changed])], journalPath };
  } catch (error) {
    const restoreOperations = [...originalByFile].map(([file, content]) => ({
      file,
      content,
      expectedContent: controlledByFile.get(file),
    }));
    try {
      commitTargetTransaction(root, { journalPath, operations: restoreOperations, kind: `${kind}:rollback` });
    } catch (rollbackError) {
      const recovery = readTargetText(root, journalPath) === null ? "" : `; recover with journal ${journalPath}`;
      throw new Error(`${error.message}; cross-round rollback failed: ${rollbackError.message}${recovery}`);
    }
    throw error;
  }
}

export function recoverTargetTransaction(root, journalPath) {
  const raw = readTargetText(root, journalPath);
  if (raw === null) return { recovered: false, reason: "journal-missing" };
  const journal = JSON.parse(raw.replace(/^\uFEFF/u, ""));
  if (journal?.schemaVersion !== 1 || !Array.isArray(journal.operations)) {
    throw new Error(`invalid transaction journal: ${journalPath}`);
  }
  const operations = journal.operations.map((item) => ({
    file: item.file,
    before: decode(item.beforeBase64),
    after: decode(item.afterBase64),
  }));
  for (const operation of [...operations].reverse()) {
    const current = readTargetText(root, operation.file);
    if (current === operation.before) continue;
    if (current !== operation.after) throw new Error(`recover conflict: ${operation.file}`);
    if (operation.before === null) removeExpectedFile(root, operation.file, operation.after);
    else safeWriteTargetFile(root, operation.file, operation.before, { expectedContent: operation.after });
  }
  removeJournal(root, journalPath, raw);
  return { recovered: true, files: operations.map((item) => item.file) };
}
