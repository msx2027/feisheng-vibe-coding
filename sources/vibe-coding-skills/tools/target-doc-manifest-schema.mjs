#!/usr/bin/env node

import crypto from "node:crypto";
import path from "node:path";

export const MANIFEST_FILE = ".vibe-docs.json";
export const MANIFEST_SCHEMA_VERSION = 2;
export const DEFAULT_DOCUMENT_INDEX = "文档索引.md";
export const DEFAULT_LOAD_POLICY = Object.freeze({ always: ["documentIndex"], never: [] });
export const DOCUMENT_AUTHORITIES = Object.freeze(["source", "projection", "log", "archive"]);
export const SINGLE_DOCUMENT_ROLES = Object.freeze([
  "productSpec", "productSpecChangelog", "productSpecChangelogArchive", "designBrief", "devPlan",
  "currentExecution", "manualAcceptance", "interfaceContracts", "projectProfile", "constitutionDesign",
  "experienceGovernance", "systemArchitecture", "validatedEvidence", "projectLessons", "documentIndex", "taskState", "taskKnowledge", "taskHandoff",
  "implementationContext", "acceptanceContext", "sessionJournal",
]);
export const COLLECTION_DOCUMENT_ROLES = Object.freeze([
  "planDetails", "productSpecArchives", "devPlanArchives", "manualAcceptanceArchives", "sessionArchives", "historicalTaskCapsules",
]);
export const REQUIRED_DOCUMENT_ROLES = Object.freeze([
  "productSpec", "devPlan", "currentExecution", "manualAcceptance", "interfaceContracts", "projectProfile", "constitutionDesign", "documentIndex",
]);
export const OPTIONAL_DOCUMENT_ROLES = Object.freeze(
  SINGLE_DOCUMENT_ROLES.filter((role) => !REQUIRED_DOCUMENT_ROLES.includes(role)),
);
export const REGISTERED_DOCUMENT_ROLES = Object.freeze([...SINGLE_DOCUMENT_ROLES, ...COLLECTION_DOCUMENT_ROLES]);

export function normalizeDocumentPath(value) {
  return value.replaceAll("\\", "/");
}

export function validateProjectRelativePath(value, label = "path") {
  if (typeof value !== "string" || value.trim() === "" || value.includes("\0")) return `${label} must be a non-empty project-relative string`;
  const normalized = normalizeDocumentPath(value);
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized) || /^[A-Za-z]:/u.test(normalized)) return `${label} must be project-relative`;
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return `${label} must not contain empty or traversal segments`;
  if (segments.some((segment) => segment.includes(":") || /[. ]$/u.test(segment))) return `${label} contains a non-portable path segment`;
  return null;
}

export function estimateTokens(content) {
  const text = normalizeContent(content);
  const cjk = (text.match(/[\u3400-\u9fff]/gu) || []).length;
  return Math.ceil(cjk + (text.length - cjk) / 4);
}

export function hashContent(content) {
  return `sha256:${crypto.createHash("sha256").update(normalizeContent(content), "utf8").digest("hex")}`;
}

function normalizeContent(content) {
  return String(content ?? "").replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
}
