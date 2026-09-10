#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import { inspectTargetFile } from "./safe-target-fs.mjs";
import { L1_REGISTRY_BLOCK_VERSION } from "./experience-anchor-contract.mjs";

const REGISTRY_START = "<!-- vibe-coding-skills:target-experience-registry:start";
const REGISTRY_END = "<!-- vibe-coding-skills:target-experience-registry:end -->";
const PROJECTION_START = "<!-- vibe-coding-skills:target-experience-projection:start";
const PROJECTION_END = "<!-- vibe-coding-skills:target-experience-projection:end -->";
export const EXPERIENCE_REGISTRY_VERSION = L1_REGISTRY_BLOCK_VERSION;
export const EXPERIENCE_PROJECTION_VERSION = "1";

function normalizeText(value) {
  return String(value).replace(/\r\n?/gu, "\n");
}

function normalize(value) {
  return normalizeText(value).replace(/\n$/u, "");
}

function assertCanonicalProjectPath(value, label) {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) {
    throw new Error(`${label} path must be a non-empty canonical string`);
  }
  if (value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/u.test(value)) {
    throw new Error(`${label} path must be project-relative with forward slashes`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${label} path contains a forbidden segment`);
  }
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`${label} must be a canonical sha256 hash`);
  }
}

function assertExactKeys(value, required, optional, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const allowed = new Set([...required, ...optional]);
  for (const field of required) if (!Object.prototype.hasOwnProperty.call(value, field)) throw new Error(`${label}.${field} is required`);
  for (const field of Object.keys(value)) if (!allowed.has(field)) throw new Error(`${label} contains unknown field: ${field}`);
}

export function isAllowedExperienceRegistrationPath(value) {
  if (typeof value !== "string") return false;
  const normalized = value.replaceAll("\\", "/");
  if (normalized === "package.json" || /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(normalized)) return true;
  const basename = normalized.split("/").at(-1) || "";
  const executableScript = /\.(?:sh|bash|ps1|cmd|bat)$/iu.test(basename);
  if (!executableScript) return false;
  const executableDirectory = /(^|\/)(?:tests?|hooks?|\.githooks)(?:\/|$)/u.test(normalized);
  const executableTestFile = /^test[-_].+\.(?:sh|bash|ps1|cmd|bat)$/iu.test(basename);
  return executableDirectory || executableTestFile;
}

function validateHardening(hardening, experienceId) {
  assertExactKeys(hardening, ["checker", "registrations"], ["verifiedAt"], `${experienceId}: hardening`);
  const checker = hardening.checker;
  assertExactKeys(checker, ["path", "hash", "owned"], [], `${experienceId}: hardening.checker`);
  assertCanonicalProjectPath(checker.path, `${experienceId}: hardening.checker`);
  assertSha256(checker.hash, `${experienceId}: hardening.checker.hash`);
  if (typeof checker.owned !== "boolean") throw new Error(`${experienceId}: hardening.checker.owned must be boolean`);
  if (!Array.isArray(hardening.registrations) || hardening.registrations.length === 0) throw new Error(`${experienceId}: hardening.registrations must be a non-empty array`);
  const hashesByPath = new Map();
  const tuples = new Set();
  for (const registration of hardening.registrations) {
    assertExactKeys(registration, ["type", "path", "hash", "entry", "command"], [], `${experienceId}: hardening registration`);
    assertCanonicalProjectPath(registration.path, `${experienceId}: hardening.registration`);
    if (!isAllowedExperienceRegistrationPath(registration.path)) throw new Error(`${experienceId}: hardening registration path is outside package/CI/Hook/test surfaces`);
    assertSha256(registration.hash, `${experienceId}: hardening.registration.hash`);
    const knownHash = hashesByPath.get(registration.path);
    if (knownHash !== undefined && knownHash !== registration.hash) {
      throw new Error(`${experienceId}: hardening registrations for the same path must share one hash`);
    }
    hashesByPath.set(registration.path, registration.hash);
    if (typeof registration.entry !== "string" || registration.entry.trim() === "") throw new Error(`${experienceId}: hardening registration entry is required`);
    const expectedType = registration.path === "package.json"
      ? "package-script"
      : /^\.github\/workflows\//u.test(registration.path) ? "workflow-run" : "line-command";
    if (registration.type !== expectedType) throw new Error(`${experienceId}: hardening registration type does not match its registration surface`);
    const expectedEntry = registration.type === "package-script"
      ? /^scripts\.[^\s]+$/u
      : registration.type === "workflow-run" ? /^run:\d+$/u : /^line:\d+$/u;
    if (!expectedEntry.test(registration.entry)) throw new Error(`${experienceId}: hardening registration entry does not match its registration surface`);
    if (typeof registration.command !== "string" || registration.command.trim() === "" || /\r|\n/u.test(registration.command)) throw new Error(`${experienceId}: hardening registration command must be one line`);
    const tuple = JSON.stringify([registration.type, registration.path, registration.hash, registration.entry, registration.command]);
    if (tuples.has(tuple)) throw new Error(`${experienceId}: duplicate hardening registration tuple`);
    tuples.add(tuple);
  }
  if (hardening.verifiedAt !== undefined) {
    const parsed = new Date(hardening.verifiedAt);
    if (typeof hardening.verifiedAt !== "string" || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== hardening.verifiedAt) throw new Error(`${experienceId}: hardening.verifiedAt must be canonical ISO time`);
  }
}

export function experienceHash(value) {
  return `sha256:${crypto.createHash("sha256").update(normalize(value), "utf8").digest("hex")}`;
}

function isLineBreak(char) {
  return char === "\r" || char === "\n";
}

function findLineEnd(content, start, end) {
  for (let offset = start; offset < end; offset += 1) {
    if (isLineBreak(content[offset])) return offset;
  }
  return -1;
}

function skipLineBreak(content, offset) {
  if (content[offset] === "\r" && content[offset + 1] === "\n") return offset + 2;
  return isLineBreak(content[offset]) ? offset + 1 : offset;
}

function findBlock(content, startPrefix, endMarker, markerPattern) {
  const starts = [];
  const ends = [];
  for (let offset = 0; ; offset += startPrefix.length) {
    const found = content.indexOf(startPrefix, offset);
    if (found === -1) break;
    starts.push(found);
    offset = found;
  }
  for (let offset = 0; ; offset += endMarker.length) {
    const found = content.indexOf(endMarker, offset);
    if (found === -1) break;
    ends.push(found);
    offset = found;
  }
  if (starts.length === 0 && ends.length === 0) return null;
  if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) {
    return { conflict: "expected exactly one complete experience managed block" };
  }
  const start = starts[0];
  const end = ends[0] + endMarker.length;
  if ((start > 0 && !isLineBreak(content[start - 1])) || (ends[0] > 0 && !isLineBreak(content[ends[0] - 1]))) {
    return { conflict: "experience managed block markers must begin on their own lines" };
  }
  const lineEnd = findLineEnd(content, start, ends[0]);
  if (lineEnd === -1 || lineEnd > ends[0]) return { conflict: "experience managed block start marker malformed" };
  const marker = content.slice(start, lineEnd).trim().match(markerPattern);
  if (!marker?.groups) return { conflict: "experience managed block marker malformed" };
  const bodyStart = skipLineBreak(content, skipLineBreak(content, lineEnd));
  const body = normalize(content.slice(bodyStart, ends[0]));
  return { start, end, body, ...marker.groups };
}

function assertNoDuplicateJsonKeys(text) {
  const stack = [];
  for (let index = 0; index < text.length;) {
    const char = text[index];
    if (char === "{") {
      stack.push({ type: "object", keys: new Set() });
      index += 1;
      continue;
    }
    if (char === "[") {
      stack.push({ type: "array" });
      index += 1;
      continue;
    }
    if (char === "}" || char === "]") {
      stack.pop();
      index += 1;
      continue;
    }
    if (char !== '"') {
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const current = text[index];
      index += 1;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === '"') {
        break;
      }
    }
    let next = index;
    while (/[\t\n\r ]/u.test(text[next] || "")) next += 1;
    const scope = stack.at(-1);
    if (text[next] !== ":" || scope?.type !== "object") continue;
    const key = JSON.parse(text.slice(start, index));
    if (scope.keys.has(key)) throw new Error(`duplicate JSON key: ${key}`);
    scope.keys.add(key);
  }
}

export function validateExperienceRegistry(registry) {
  assertExactKeys(registry, ["schemaVersion", "sourceRevision", "rules"], [], "target experience registry");
  if (registry.schemaVersion !== Number(EXPERIENCE_REGISTRY_VERSION)) {
    throw new Error(`target experience registry schemaVersion must be ${EXPERIENCE_REGISTRY_VERSION}`);
  }
  if (!Number.isInteger(registry.sourceRevision) || registry.sourceRevision < 0) {
    throw new Error("target experience registry sourceRevision must be a non-negative integer");
  }
  if (!Array.isArray(registry.rules)) throw new Error("target experience registry rules must be an array");
  const ids = new Set();
  for (const rule of registry.rules) {
    assertExactKeys(rule, ["experienceId", "text", "status"], ["hardening"], "target experience registry rule");
    if (typeof rule.experienceId !== "string" || rule.experienceId.trim() === "" || typeof rule.text !== "string" || rule.text.trim() === "") {
      throw new Error("target experience registry rule requires experienceId and text");
    }
    if (!["candidate", "active"].includes(rule.status)) {
      throw new Error("target experience registry rule status must be candidate or active");
    }
    if (ids.has(rule.experienceId)) throw new Error(`duplicate target experience registry rule: ${rule.experienceId}`);
    ids.add(rule.experienceId);
    if (rule.hardening !== undefined) validateHardening(rule.hardening, rule.experienceId);
  }
  return registry;
}

export function parseExperienceRegistry(content) {
  const block = findBlock(
    content,
    REGISTRY_START,
    REGISTRY_END,
    /^<!-- vibe-coding-skills:target-experience-registry:start version=(?<version>[^ ]+) checksum=(?<checksum>sha256:[a-f0-9]{64}) -->$/u,
  );
  if (!block) return null;
  if (block.conflict) throw new Error(`target experience registry conflict: ${block.conflict}`);
  if (block.version !== EXPERIENCE_REGISTRY_VERSION) throw new Error(`unsupported target experience registry version: ${block.version}`);
  if (experienceHash(block.body) !== block.checksum) throw new Error("target experience registry checksum mismatch");
  let registry;
  try {
    assertNoDuplicateJsonKeys(block.body);
    registry = JSON.parse(block.body);
  } catch (error) {
    throw new Error(`target experience registry JSON invalid: ${error.message}`);
  }
  return { block, registry: validateExperienceRegistry(registry), sourceHash: experienceHash(block.body) };
}

export function renderExperienceRegistryBlock(registry) {
  const body = JSON.stringify(validateExperienceRegistry(registry), null, 2);
  return [
    `${REGISTRY_START} version=${EXPERIENCE_REGISTRY_VERSION} checksum=${experienceHash(body)} -->`,
    body,
    REGISTRY_END,
  ].join("\n");
}

export function registryInfoFromRegistry(registry, file = "docs/项目治理/宪法设计.md") {
  const body = JSON.stringify(validateExperienceRegistry(registry), null, 2);
  return {
    registry,
    file,
    sourceHash: experienceHash(body),
    block: null,
  };
}

export function planExperienceRegistryContent(currentContent, nextRegistry) {
  const parsed = parseExperienceRegistry(currentContent);
  const blockText = renderExperienceRegistryBlock(nextRegistry);
  if (!parsed) {
    const separator = currentContent.endsWith("\n") ? "\n" : "\n\n";
    return `${currentContent}${separator}${blockText}\n`;
  }
  return `${currentContent.slice(0, parsed.block.start)}${blockText}${currentContent.slice(parsed.block.end)}`;
}

export function loadExperienceRegistry(targetRoot, constitutionPath = "docs/项目治理/宪法设计.md") {
  const state = inspectTargetFile(targetRoot, constitutionPath);
  if (!state.exists) return null;
  const content = fs.readFileSync(state.path, "utf8");
  const parsed = parseExperienceRegistry(content);
  return parsed ? { ...parsed, content, file: constitutionPath } : null;
}

function renderProjectionBody(registryInfo) {
  const activeRules = registryInfo.registry.rules.filter((rule) => rule.status === "active");
  return [
    "## 项目经验规则（受管投影）",
    "",
    `> 此块由宪法设计中的 target experience registry 确定性生成；sourceHash=${registryInfo.sourceHash}。两份入口不是独立真源。`,
    "",
    ...(activeRules.length > 0
      ? activeRules.map((rule) => `- [${rule.experienceId}] ${rule.text}`)
      : ["- 当前没有已激活的项目经验规则。"]),
  ].join("\n");
}

function renderProjectionBlock(file, registryInfo) {
  const body = renderProjectionBody(registryInfo);
  return [
    `${PROJECTION_START} file=${file} version=${EXPERIENCE_PROJECTION_VERSION} source=${registryInfo.sourceHash} checksum=${experienceHash(body)} -->`,
    "",
    body,
    PROJECTION_END,
  ].join("\n");
}

export function renderExperienceProjectionBlock(file, registryInfo) { return renderProjectionBlock(file, registryInfo); }

export function parseExperienceProjection(content, expectedFile) {
  const block = findBlock(
    content,
    PROJECTION_START,
    PROJECTION_END,
    /^<!-- vibe-coding-skills:target-experience-projection:start file=(?<file>[^ ]+) version=(?<version>[^ ]+) source=(?<source>sha256:[a-f0-9]{64}) checksum=(?<checksum>sha256:[a-f0-9]{64}) -->$/u,
  );
  if (!block) return null;
  if (block.conflict) throw new Error(`experience projection conflict: ${block.conflict}`);
  if (block.version !== EXPERIENCE_PROJECTION_VERSION) throw new Error(`unsupported experience projection version: ${block.version}`);
  if (expectedFile && block.file !== expectedFile) throw new Error(`experience projection belongs to ${block.file}, expected ${expectedFile}`);
  if (experienceHash(block.body) !== block.checksum) throw new Error("experience projection checksum conflict");
  return {
    block,
    sourceHash: block.source,
    outputHash: experienceHash(content.slice(block.start, block.end)),
  };
}

export function applyExperienceProjectionToPlan(plan, registryInfo, options = {}) {
  if (!registryInfo || plan.status === "fail") return { plan, projection: null };
  const content = plan.nextContent;
  const block = findBlock(
    content,
    PROJECTION_START,
    PROJECTION_END,
    /^<!-- vibe-coding-skills:target-experience-projection:start file=(?<file>[^ ]+) version=(?<version>[^ ]+) source=(?<source>sha256:[a-f0-9]{64}) checksum=(?<checksum>sha256:[a-f0-9]{64}) -->$/u,
  );
  if (block?.conflict) {
    return { plan: { ...plan, action: "conflict", status: "fail", reason: `experience projection conflict: ${block.conflict}` }, projection: null };
  }
  if (block && (block.file !== plan.file || block.version !== EXPERIENCE_PROJECTION_VERSION || experienceHash(block.body) !== block.checksum)) {
    return { plan: { ...plan, action: "conflict", status: "fail", reason: "experience projection checksum conflict" }, projection: null };
  }
  if (!block && options.requireExisting) {
    return {
      plan: { ...plan, action: "conflict", status: "fail", reason: "established runtime experience projection missing" },
      projection: null,
    };
  }
  const nextBlock = renderProjectionBlock(plan.file, registryInfo);
  const nextContent = block
    ? `${content.slice(0, block.start)}${nextBlock}${content.slice(block.end)}`
    : `${content}${content.endsWith("\n") ? "\n" : "\n\n"}${nextBlock}\n`;
  const changed = normalizeText(nextContent) !== normalizeText(content);
  return {
    plan: changed
      ? {
          ...plan,
          action: plan.action === "none" ? "update" : plan.action,
          status: "pending",
          reason: "experience projection changed",
          nextContent,
          expectedContent: Object.prototype.hasOwnProperty.call(plan, "expectedContent")
            ? plan.expectedContent
            : content,
        }
      : plan,
    projection: {
      sourceHash: registryInfo.sourceHash,
      outputHash: experienceHash(nextBlock),
    },
  };
}

export function emptyExperienceRegistry() {
  return { schemaVersion: 1, sourceRevision: 0, rules: [] };
}
