#!/usr/bin/env node

export const L1_REGISTRY_BLOCK_IDENTITY = "target-experience-registry";
export const L1_REGISTRY_BLOCK_VERSION = "1";

function assertExactKeys(value, required, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} 必须是对象或 null`);
  const allowed = new Set(required);
  for (const field of required) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) throw new Error(`${label}.${field} 是必需字段`);
  }
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label} 含未知字段：${field}`);
  }
}

function assertCanonicalProjectPath(value, label) {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) {
    throw new Error(`${label} 必须是 canonical 项目相对路径`);
  }
  if (value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/u.test(value)) {
    throw new Error(`${label} 必须使用正斜杠项目相对路径`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${label} 含非法路径段`);
  }
}

export function assertCanonicalL1RegistryAnchor(anchor, label = "l1RegistryAnchor") {
  if (anchor === null) return null;
  assertExactKeys(anchor, ["path", "blockIdentity", "blockVersion", "sourceHash"], label);
  assertCanonicalProjectPath(anchor.path, `${label}.path`);
  if (anchor.blockIdentity !== L1_REGISTRY_BLOCK_IDENTITY) {
    throw new Error(`${label}.blockIdentity 必须是 ${L1_REGISTRY_BLOCK_IDENTITY}`);
  }
  if (anchor.blockVersion !== L1_REGISTRY_BLOCK_VERSION) {
    throw new Error(`${label}.blockVersion 必须是 ${L1_REGISTRY_BLOCK_VERSION}`);
  }
  if (typeof anchor.sourceHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(anchor.sourceHash)) {
    throw new Error(`${label}.sourceHash 必须是 canonical sha256 hash`);
  }
  return anchor;
}

export function l1RegistryAnchorFromInfo(registryInfo) {
  if (!registryInfo || registryInfo.registry.rules.length === 0) return null;
  return {
    path: registryInfo.file,
    blockIdentity: L1_REGISTRY_BLOCK_IDENTITY,
    blockVersion: L1_REGISTRY_BLOCK_VERSION,
    sourceHash: registryInfo.sourceHash,
  };
}

export function assertL1RegistryAnchorMatches(anchor, registryInfo, label = "l1RegistryAnchor") {
  assertCanonicalL1RegistryAnchor(anchor, label);
  const expected = l1RegistryAnchorFromInfo(registryInfo);
  if (expected === null) {
    if (anchor !== null) throw new Error(`${label} 必须为 null，因为当前没有 L1 registry 规则`);
    return null;
  }
  if (anchor === null) throw new Error("anchor-adoption-required: current L1 registry 存在但 l1RegistryAnchor 为 null");
  for (const field of ["path", "blockIdentity", "blockVersion", "sourceHash"]) {
    if (anchor[field] !== expected[field]) throw new Error(`${label}.${field} 与 current L1 registry 不匹配`);
  }
  return anchor;
}

export function isL1RegistryAnchorAdoptionRequiredError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("anchor-adoption-required") || message.includes("缺少必需字段 l1RegistryAnchor");
}
