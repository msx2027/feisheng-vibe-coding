#!/usr/bin/env node

import fs from "node:fs";
import { assertSafeTargetRoot, inspectTargetFile } from "./safe-target-fs.mjs";
import {
  COLLECTION_DOCUMENT_ROLES, DEFAULT_DOCUMENT_INDEX, DOCUMENT_AUTHORITIES, MANIFEST_FILE,
  MANIFEST_SCHEMA_VERSION, OPTIONAL_DOCUMENT_ROLES, REGISTERED_DOCUMENT_ROLES, REQUIRED_DOCUMENT_ROLES,
  SINGLE_DOCUMENT_ROLES, estimateTokens, hashContent, normalizeDocumentPath, validateProjectRelativePath,
} from "./target-doc-manifest-schema.mjs";
import { markdownGovernanceIssues } from "./markdown-governance-core.mjs";
export {
  COLLECTION_DOCUMENT_ROLES, DEFAULT_DOCUMENT_INDEX, DEFAULT_LOAD_POLICY, DOCUMENT_AUTHORITIES,
  MANIFEST_FILE, MANIFEST_SCHEMA_VERSION, OPTIONAL_DOCUMENT_ROLES, REGISTERED_DOCUMENT_ROLES, REQUIRED_DOCUMENT_ROLES,
  SINGLE_DOCUMENT_ROLES, estimateTokens, hashContent, validateProjectRelativePath,
} from "./target-doc-manifest-schema.mjs";

const ROLE_SET = new Set(REGISTERED_DOCUMENT_ROLES);
const COLLECTION_ROLE_SET = new Set(COLLECTION_DOCUMENT_ROLES);
const TOP_LEVEL_SINGLE_ROLE_SET = new Set(SINGLE_DOCUMENT_ROLES.filter((role) => !["taskState", "taskKnowledge", "taskHandoff", "implementationContext", "acceptanceContext", "sessionJournal"].includes(role)));
const DOCUMENT_KEYS = new Set(["role", "path", "owner", "authority", "contentHash", "estimatedTokens", "dependsOn", "sections"]);
const SECTION_KEYS = new Set(["id", "heading", "startLine", "endLine", "hash", "tokens"]);
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mappedPaths(manifest, role) {
  const value = manifest?.[role];
  if (COLLECTION_ROLE_SET.has(role)) return Array.isArray(value) ? value : [];
  return typeof value === "string" ? [value] : [];
}

function normalizeLegacyDocuments(manifest) {
  const entries = [];
  for (const role of REGISTERED_DOCUMENT_ROLES) {
    for (const documentPath of mappedPaths(manifest, role)) {
      entries.push({
        role,
        path: normalizeDocumentPath(documentPath),
        owner: "legacy",
        authority: role === "currentExecution" || role === "documentIndex" ? "projection" : role === "sessionJournal" ? "log" : /Archive|Archives|historical/u.test(role) ? "archive" : "source",
        contentHash: "",
        estimatedTokens: 0,
        dependsOn: [],
        sections: [],
      });
    }
  }
  return entries;
}

export function collectDocumentEntries(manifest, options = {}) {
  if (Array.isArray(manifest?.documents)) return manifest.documents.map((entry) => ({ ...entry }));
  if (options.allowLegacy !== false) return normalizeLegacyDocuments(manifest || {});
  return [];
}

function addIssue(issues, code, message, at = "manifest") {
  issues.push({ code, message, at });
}

function validateLoadPolicy(manifest, documents, issues, { legacy }) {
  const policy = manifest.loadPolicy;
  if (!isRecord(policy)) {
    if (!legacy || Object.prototype.hasOwnProperty.call(manifest, "loadPolicy")) addIssue(issues, "invalid_load_policy", "loadPolicy must be an object", "loadPolicy");
    return;
  }
  for (const key of ["always", "never"]) {
    if (!Array.isArray(policy[key]) || policy[key].some((role) => typeof role !== "string" || role === "")) {
      addIssue(issues, "invalid_load_policy", `loadPolicy.${key} must be an array of non-empty role strings`, `loadPolicy.${key}`);
    }
  }
  if (!Array.isArray(policy.always) || !Array.isArray(policy.never)) return;
  const registered = new Set(documents.map((entry) => entry.role));
  for (const role of [...policy.always, ...policy.never]) {
    if ((!legacy && !registered.has(role)) || (legacy && !ROLE_SET.has(role))) {
      addIssue(issues, "unknown_policy_role", `loadPolicy references an unregistered role: ${role}`, "loadPolicy");
    }
  }
  for (const role of new Set(policy.always)) {
    if (policy.never.includes(role)) addIssue(issues, "policy_overlap", `${role} appears in both loadPolicy.always and loadPolicy.never`, "loadPolicy");
  }
  if (new Set(policy.always).size !== policy.always.length || new Set(policy.never).size !== policy.never.length) {
    addIssue(issues, "duplicate_policy_role", "loadPolicy role arrays must not contain duplicates", "loadPolicy");
  }
  if (!legacy && policy.always.length > 3) addIssue(issues, "always_role_limit", "loadPolicy.always may contain at most 3 roles", "loadPolicy.always");
  if (!legacy) {
    const always = new Set(policy.always);
    const total = documents.filter((entry) => always.has(entry.role)).reduce((sum, entry) => sum + (Number.isInteger(entry.estimatedTokens) ? entry.estimatedTokens : 0), 0);
    if (total > 12000) addIssue(issues, "always_budget_exceeded", `loadPolicy.always metadata totals ${total} tokens; limit is 12000`, "loadPolicy.always");
    const index = documents.find((entry) => entry.role === "documentIndex");
    if (index?.estimatedTokens > 5000) addIssue(issues, "index_budget_exceeded", `documentIndex metadata is ${index.estimatedTokens} tokens; limit is 5000`, "documents");
    for (const entry of documents.filter((item) => item.authority === "archive")) {
      if (!policy.never.includes(entry.role)) addIssue(issues, "archive_not_never", `archive role must be in loadPolicy.never: ${entry.role}`, "loadPolicy.never");
    }
  }
}

function validateSection(section, at, issues) {
  if (!isRecord(section)) {
    addIssue(issues, "invalid_section", "section must be an object", at);
    return;
  }
  for (const key of Object.keys(section)) if (!SECTION_KEYS.has(key)) addIssue(issues, "unknown_section_field", `unknown section field: ${key}`, `${at}.${key}`);
  if (typeof section.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(section.id)) addIssue(issues, "invalid_section_id", "section.id must be a stable ASCII identifier", `${at}.id`);
  if (typeof section.heading !== "string") addIssue(issues, "invalid_section_heading", "section.heading must be a string", `${at}.heading`);
  if (!Number.isInteger(section.startLine) || section.startLine < 1 || !Number.isInteger(section.endLine) || section.endLine < section.startLine) addIssue(issues, "invalid_section_range", "section line range must be positive and ordered", at);
  if (!HASH_PATTERN.test(section.hash || "")) addIssue(issues, "invalid_section_hash", "section.hash must be sha256:<64 lowercase hex>", `${at}.hash`);
  if (!Number.isInteger(section.tokens) || section.tokens < 0) addIssue(issues, "invalid_section_tokens", "section.tokens must be a non-negative integer", `${at}.tokens`);
}

function validateDocuments(manifest, issues) {
  if (!Array.isArray(manifest.documents)) {
    addIssue(issues, "invalid_documents", "documents must be an array", "documents");
    return [];
  }
  const paths = new Map();
  const roleCounts = new Map();
  for (const [index, entry] of manifest.documents.entries()) {
    const at = `documents[${index}]`;
    if (!isRecord(entry)) {
      addIssue(issues, "invalid_document", "document entry must be an object", at);
      continue;
    }
    for (const key of Object.keys(entry)) if (!DOCUMENT_KEYS.has(key)) addIssue(issues, "unknown_document_field", `unknown document field: ${key}`, `${at}.${key}`);
    for (const key of DOCUMENT_KEYS) if (!Object.prototype.hasOwnProperty.call(entry, key)) addIssue(issues, "missing_document_field", `missing document field: ${key}`, `${at}.${key}`);
    if (typeof entry.role !== "string" || !ROLE_SET.has(entry.role)) addIssue(issues, "unknown_document_role", `unknown document role: ${String(entry.role)}`, `${at}.role`);
    const pathIssue = validateProjectRelativePath(entry.path, `${at}.path`);
    if (pathIssue) addIssue(issues, "invalid_document_path", pathIssue, `${at}.path`);
    else {
      const normalized = normalizeDocumentPath(entry.path).toLowerCase();
      if (paths.has(normalized)) addIssue(issues, "duplicate_document_path", `duplicate document path: ${entry.path}`, `${at}.path`);
      paths.set(normalized, at);
    }
    if (typeof entry.owner !== "string" || entry.owner.trim() === "") addIssue(issues, "invalid_document_owner", "document.owner must be a non-empty string", `${at}.owner`);
    if (!DOCUMENT_AUTHORITIES.includes(entry.authority)) addIssue(issues, "invalid_document_authority", `invalid document authority: ${String(entry.authority)}`, `${at}.authority`);
    if (!HASH_PATTERN.test(entry.contentHash || "")) addIssue(issues, "invalid_document_hash", "document.contentHash must be sha256:<64 lowercase hex>", `${at}.contentHash`);
    if (!Number.isInteger(entry.estimatedTokens) || entry.estimatedTokens < 0) addIssue(issues, "invalid_document_tokens", "document.estimatedTokens must be a non-negative integer", `${at}.estimatedTokens`);
    if (!Array.isArray(entry.dependsOn) || entry.dependsOn.some((role) => typeof role !== "string" || !ROLE_SET.has(role))) addIssue(issues, "invalid_document_dependencies", "document.dependsOn must contain registered roles", `${at}.dependsOn`);
    if (!Array.isArray(entry.sections)) addIssue(issues, "invalid_document_sections", "document.sections must be an array", `${at}.sections`);
    else {
      const ids = new Set();
      for (const [sectionIndex, section] of entry.sections.entries()) {
        validateSection(section, `${at}.sections[${sectionIndex}]`, issues);
        if (isRecord(section) && typeof section.id === "string") {
          if (ids.has(section.id)) addIssue(issues, "duplicate_section_id", `duplicate section id in ${entry.path}: ${section.id}`, `${at}.sections`);
          ids.add(section.id);
        }
      }
    }
    if (typeof entry.role === "string") roleCounts.set(entry.role, (roleCounts.get(entry.role) || 0) + 1);
  }
  for (const [role, count] of roleCounts) {
    if (count > 1 && !COLLECTION_ROLE_SET.has(role)) addIssue(issues, "duplicate_document_role", `non-collection role appears ${count} times: ${role}`, "documents");
  }
  return manifest.documents;
}

function validateTopLevelMappings(manifest, documents, issues) {
  for (const role of REQUIRED_DOCUMENT_ROLES) {
    if (!Object.prototype.hasOwnProperty.call(manifest, role)) addIssue(issues, "missing_required_role", `missing required top-level role mapping: ${role}`, role);
    if (!documents.some((entry) => entry?.role === role)) addIssue(issues, "missing_required_document", `documents[] must register required role: ${role}`, "documents");
  }
  for (const role of [...TOP_LEVEL_SINGLE_ROLE_SET, ...COLLECTION_DOCUMENT_ROLES]) {
    if (!Object.prototype.hasOwnProperty.call(manifest, role)) continue;
    const value = manifest[role];
    if (COLLECTION_ROLE_SET.has(role)) {
      if (!Array.isArray(value) || value.some((item) => validateProjectRelativePath(item, role))) addIssue(issues, "invalid_role_mapping", `${role} must be an array of project-relative paths`, role);
    } else {
      const pathIssue = validateProjectRelativePath(value, role);
      if (pathIssue) addIssue(issues, "invalid_role_mapping", pathIssue, role);
    }
  }
  for (const role of [...TOP_LEVEL_SINGLE_ROLE_SET, ...COLLECTION_DOCUMENT_ROLES]) {
    const topPaths = mappedPaths(manifest, role).map(normalizeDocumentPath).sort();
    const documentPaths = documents.filter((entry) => entry?.role === role && typeof entry.path === "string").map((entry) => normalizeDocumentPath(entry.path)).sort();
    if (topPaths.length === 0 && documentPaths.length === 0) continue;
    if (JSON.stringify(topPaths) !== JSON.stringify(documentPaths)) {
      addIssue(issues, "mapping_drift", `${role} top-level mapping and documents[] paths must match`, role);
    }
  }
}

export function validateTargetDocManifest(input, options = {}) {
  const allowLegacy = options.allowLegacy === true;
  const issues = [];
  const warnings = [];
  if (!isRecord(input)) {
    addIssue(issues, "invalid_manifest", "manifest must be a JSON object");
    return { ok: false, manifest: input, issues, warnings, migrationRequired: false };
  }
  const legacy = input.schemaVersion !== MANIFEST_SCHEMA_VERSION;
  if (legacy) {
    if (!allowLegacy) addIssue(issues, "migration_required", `schemaVersion must be ${MANIFEST_SCHEMA_VERSION}`, "schemaVersion");
    else warnings.push({ code: "migration_required", message: "legacy manifest requires explicit migration to schemaVersion 2" });
    if (Object.prototype.hasOwnProperty.call(input, "schemaVersion") && input.schemaVersion !== undefined && !Number.isInteger(input.schemaVersion)) addIssue(issues, "invalid_schema_version", "schemaVersion must be an integer", "schemaVersion");
  }
  for (const issue of markdownGovernanceIssues(input)) addIssue(issues, issue.code, issue.message, issue.at);
  const documents = legacy ? normalizeLegacyDocuments(input) : validateDocuments(input, issues);
  if (!legacy) {
    if (input.documentIndex !== DEFAULT_DOCUMENT_INDEX) addIssue(issues, "invalid_document_index", `documentIndex must be ${DEFAULT_DOCUMENT_INDEX}`, "documentIndex");
    validateTopLevelMappings(input, documents, issues);
  }
  validateLoadPolicy(input, documents, issues, { legacy });
  return { ok: issues.length === 0, manifest: input, issues, warnings, migrationRequired: legacy };
}

export function loadTargetDocManifest(rootInput, options = {}) {
  const rootInfo = assertSafeTargetRoot(rootInput);
  const state = inspectTargetFile(rootInfo.root, MANIFEST_FILE);
  if (!state.exists) {
    const error = new Error(`Missing ${MANIFEST_FILE} at ${rootInfo.root}`);
    error.code = "TARGET_DOC_MANIFEST_MISSING";
    throw error;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(state.path, "utf8").replace(/^\uFEFF/u, ""));
  } catch (cause) {
    const error = new Error(`Invalid ${MANIFEST_FILE}: ${cause.message}`, { cause });
    error.code = "TARGET_DOC_MANIFEST_PARSE";
    throw error;
  }
  const validation = validateTargetDocManifest(manifest, options);
  if (!validation.ok) {
    const error = new Error(`Invalid ${MANIFEST_FILE}: ${validation.issues.map((issue) => issue.message).join("; ")}`);
    error.code = "TARGET_DOC_MANIFEST_INVALID";
    error.issues = validation.issues;
    throw error;
  }
  return { root: rootInfo.root, path: state.path, manifest, migrationRequired: validation.migrationRequired, warnings: validation.warnings };
}
