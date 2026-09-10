#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

export const REQUIRED_RELEASE_INPUTS = Object.freeze([
  ".githooks/pre-commit",
  "feedback/templates/feedback-index-template.md",
  "feedback/templates/feedback-topic-template.md",
  "package.json",
  "plans/CURRENT-EXECUTION.md",
  "plans/audit-remediation-20260710.md",
  "tools/archive-lifecycle-docs.mjs",
  "tools/build-target-doc-index.mjs",
  "tools/auto-sync-target-doc-index.mjs",
  "tools/check-target-doc-precommit.mjs",
  "tools/target-hook-config.mjs",
  "tools/check-lifecycle-doc-budget.mjs",
  "tools/check-target-doc-drift.mjs",
  "tools/target-doc-index-core.mjs",
  "tools/safe-target-fs.mjs",
  "tools/target-doc-manifest-schema.mjs",
  "tools/target-doc-manifest-core.mjs",
  "tools/target-doc-transaction.mjs",
  "tools/target-doc-migration-helpers.mjs",
  "tools/resolve-target-doc-context.mjs",
  "tools/markdown-governance-core.mjs",
  "tools/check-markdown-governance.mjs",
  "tools/update-target-task-state.mjs",
  "tools/migrate-target-doc-system.mjs",
]);

const MANIFEST_NAME = "MANIFEST.json";
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const PLACEHOLDER_USERNAMES = new Set([
  "example",
  "name",
  "sample",
  "user",
  "username",
  "xxx",
  "your-name",
  "your_name",
]);

const FORBIDDEN_FILE_PATTERNS = [
  /(^|\/)\.env(?:\.|$)/iu,
  /\.(?:db|sqlite|sqlite3)(?:-(?:shm|wal))?$/iu,
  /(^|\/)(?:credentials|secret|private-key|id_rsa|id_ed25519)(?:\.|$)/iu,
  /\.(?:pem|key|p12|pfx)$/iu,
];

export const PURE_PROFILE_EXCLUDED_PATHS = Object.freeze([
  "Product-Spec.md",
  "Product-Spec-CHANGELOG.md",
  "DEV-PLAN.md",
  "DOC-MAP.md",
  "TERMINOLOGY-AND-NAMING.md",
  "EVOLUTION.md",
  ".claude/EVOLUTION.md",
]);

const KNOWN_PROFILES = new Set(["safe-lite", "pure"]);

const PURE_PROFILE_RUNTIME_ENTRY_PATHS = Object.freeze(["AGENTS.md", ".claude/CLAUDE.md"]);
const PURE_PROFILE_ENTRY_REFERENCE_RULES = Object.freeze([
  {
    excludedPath: "Product-Spec.md",
    pattern: /(?:^|[^A-Za-z0-9_-])Product-Spec(?:\.md)?(?=$|[^A-Za-z0-9_-])/u,
  },
  {
    excludedPath: "Product-Spec-CHANGELOG.md",
    pattern: /(?:^|[^A-Za-z0-9_-])Product-Spec-CHANGELOG(?:\.md)?(?=$|[^A-Za-z0-9_-])/u,
  },
  {
    excludedPath: "DEV-PLAN.md",
    pattern: /(?:^|[^A-Za-z0-9_-])DEV-PLAN(?:\.md)?(?=$|[^A-Za-z0-9_-])/u,
  },
  {
    excludedPath: "DOC-MAP.md",
    pattern: /(?:^|[^A-Za-z0-9_-])DOC-MAP(?:\.md)?(?=$|[^A-Za-z0-9_-])/u,
  },
  {
    excludedPath: "TERMINOLOGY-AND-NAMING.md",
    pattern: /(?:^|[^A-Za-z0-9_-])TERMINOLOGY-AND-NAMING(?:\.md)?(?=$|[^A-Za-z0-9_-])/u,
  },
  {
    excludedPath: "EVOLUTION.md",
    pattern: /(?:^|[^A-Za-z0-9_-])EVOLUTION(?:\.md)?(?=$|[^A-Za-z0-9_-])/u,
  },
]);

const HIGH_CONFIDENCE_SECRET_PATTERNS = [
  { label: "private key", pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/u },
  { label: "OpenAI/Anthropic-style API token", pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/u },
  { label: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/u },
  { label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/u },
];

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function gitBlobObjectId(buffer, objectFormat) {
  return crypto
    .createHash(objectFormat)
    .update(Buffer.from(`blob ${buffer.length}\0`, "utf8"))
    .update(buffer)
    .digest("hex");
}

function assertSafeRelativePath(relativePath, role = "package path") {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error(`${role} must be a non-empty string`);
  }
  if (
    relativePath.includes("\\") ||
    relativePath.includes("\0") ||
    relativePath.startsWith("/") ||
    /^[A-Za-z]:/u.test(relativePath)
  ) {
    throw new Error(`${role} is not a portable relative path: ${relativePath}`);
  }
  const segments = relativePath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${role} contains an empty or traversal segment: ${relativePath}`);
  }
  return relativePath;
}

function assertRegularDirectory(root, role) {
  const resolved = path.resolve(root);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${role} must be a regular directory: ${resolved}`);
  }
  return resolved;
}

function listRegularFiles(root) {
  const resolvedRoot = assertRegularDirectory(root, "Package root");
  const realRoot = fs.realpathSync(resolvedRoot);
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = toPosix(path.relative(resolvedRoot, absolute));
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        throw new Error(`Package contains a symlink or junction: ${relative}`);
      }
      const realPath = fs.realpathSync(absolute);
      if (!isInside(realRoot, realPath)) {
        throw new Error(`Package path resolves outside package root: ${relative}`);
      }
      if (stat.isDirectory()) {
        if (entry.name === ".git") throw new Error(`Package contains forbidden Git metadata: ${relative}`);
        walk(absolute);
        continue;
      }
      if (!stat.isFile()) {
        throw new Error(`Package contains a non-regular filesystem entry: ${relative}`);
      }
      files.push(relative);
    }
  };
  walk(resolvedRoot);
  return files.sort();
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function isLikelyUtf16(buffer, littleEndian) {
  if (littleEndian && buffer[0] === 0xff && buffer[1] === 0xfe) return true;
  if (!littleEndian && buffer[0] === 0xfe && buffer[1] === 0xff) return true;
  if (buffer.length < 8) return false;
  const byteLength = Math.min(buffer.length - (buffer.length % 2), 8192);
  const pairs = byteLength / 2;
  let expectedNulls = 0;
  let unexpectedNulls = 0;
  let asciiLikeUnits = 0;
  for (let offset = 0; offset < byteLength; offset += 2) {
    const characterByte = buffer[offset + (littleEndian ? 0 : 1)];
    const highByte = buffer[offset + (littleEndian ? 1 : 0)];
    if (highByte === 0) expectedNulls += 1;
    if (characterByte === 0) unexpectedNulls += 1;
    if (characterByte === 9 || characterByte === 10 || characterByte === 13 || (characterByte >= 0x20 && characterByte <= 0x7e)) {
      asciiLikeUnits += 1;
    }
  }
  return expectedNulls / pairs >= 0.6 && unexpectedNulls / pairs <= 0.1 && asciiLikeUnits / pairs >= 0.6;
}

function decodeUtf16Be(buffer) {
  const start = buffer[0] === 0xfe && buffer[1] === 0xff ? 2 : 0;
  const byteLength = buffer.length - start - ((buffer.length - start) % 2);
  const swapped = Buffer.from(buffer.subarray(start, start + byteLength));
  swapped.swap16();
  return swapped.toString("utf16le");
}

function utf16CandidateOffsets(buffer) {
  const offsets = [0];
  let firstNonNul = 0;
  while (firstNonNul < buffer.length && buffer[firstNonNul] === 0) firstNonNul += 1;
  if (firstNonNul > 0 && firstNonNul < buffer.length) offsets.push(firstNonNul);
  return offsets;
}

function addUtf16AsciiRunViews(buffer, littleEndian, add) {
  const label = littleEndian ? "UTF-16LE" : "UTF-16BE";
  for (const parity of [0, 1]) {
    let run = "";
    const flush = () => {
      if (run.length >= 8) add(label, run);
      run = "";
    };
    for (let offset = parity; offset + 1 < buffer.length; offset += 2) {
      const characterByte = buffer[offset + (littleEndian ? 0 : 1)];
      const highByte = buffer[offset + (littleEndian ? 1 : 0)];
      if (
        highByte === 0 &&
        (characterByte === 9 || characterByte === 10 || characterByte === 13 || (characterByte >= 0x20 && characterByte <= 0x7e))
      ) {
        run += String.fromCharCode(characterByte);
      } else {
        flush();
      }
    }
    flush();
  }
}

function privacyTextViews(buffer) {
  const views = [];
  const seen = new Set();
  const add = (encoding, text) => {
    if (seen.has(text)) return;
    seen.add(text);
    views.push({ encoding, text });
  };

  // High-confidence ASCII indicators embedded in otherwise binary data remain
  // security-sensitive. Replacing NULs keeps byte-adjacent strings visible
  // without accidentally concatenating fields across a binary separator.
  add("UTF-8/ASCII", buffer.toString("utf8").replaceAll("\0", "\n"));
  for (const offset of utf16CandidateOffsets(buffer)) {
    const candidate = buffer.subarray(offset);
    if (isLikelyUtf16(candidate, true)) {
      const start = candidate[0] === 0xff && candidate[1] === 0xfe ? 2 : 0;
      const byteLength = candidate.length - start - ((candidate.length - start) % 2);
      add("UTF-16LE", candidate.subarray(start, start + byteLength).toString("utf16le"));
    }
    if (isLikelyUtf16(candidate, false)) add("UTF-16BE", decodeUtf16Be(candidate));
  }
  // Scan isolated UTF-16 ASCII runs at both byte alignments so a binary header
  // cannot hide a high-confidence token or absolute path. Each run is decoded
  // independently; binary separators never concatenate unrelated fields.
  addUtf16AsciiRunViews(buffer, true, add);
  addUtf16AsciiRunViews(buffer, false, add);
  return views;
}

function collectPersonalPathIssues(text, relativePath) {
  const issues = [];
  const patterns = [
    { label: "macOS user home", regex: /(^|[\s"'`(=])\/Users\/([^/<>{}"'`\s\\]+)(?=\/)/gmu, userGroup: 2 },
    { label: "Linux user home", regex: /(^|[\s"'`(=])\/home\/([^/<>{}"'`\s\\]+)(?=\/)/gmu, userGroup: 2 },
    { label: "Windows user home", regex: /\b[A-Za-z]:\\Users\\([^\\/<>{}"'`\s]+)(?=\\)/gmu, userGroup: 1 },
  ];
  for (const { label, regex, userGroup } of patterns) {
    for (const match of text.matchAll(regex)) {
      const username = String(match[userGroup] || "").toLowerCase();
      if (PLACEHOLDER_USERNAMES.has(username)) continue;
      issues.push(`${relativePath}:${lineNumberAt(text, match.index)} contains a ${label} path for "${username}"`);
    }
  }
  return issues;
}

function collectPrivacyIssues(root, files) {
  const issues = [];
  const homeCandidates = [process.env.USERPROFILE, process.env.HOME]
    .filter((value) => value && path.isAbsolute(value))
    .flatMap((value) => [value, value.replaceAll("\\", "/")]);

  for (const relativePath of files) {
    if (FORBIDDEN_FILE_PATTERNS.some((pattern) => pattern.test(relativePath))) {
      issues.push(`${relativePath} has a privacy-sensitive filename`);
    }
    const absolute = path.join(root, ...relativePath.split("/"));
    const buffer = fs.readFileSync(absolute);
    const fileIssues = new Set();
    for (const { encoding, text } of privacyTextViews(buffer)) {
      for (const { label, pattern } of HIGH_CONFIDENCE_SECRET_PATTERNS) {
        const match = pattern.exec(text);
        if (match) {
          fileIssues.add(
            `${relativePath}:${lineNumberAt(text, match.index)} contains a high-confidence ${label} (${encoding})`,
          );
        }
      }
      for (const home of homeCandidates) {
        if (home.length >= 4 && text.toLowerCase().includes(home.toLowerCase())) {
          fileIssues.add(`${relativePath} contains the current user's absolute home path (${encoding})`);
        }
      }
      for (const issue of collectPersonalPathIssues(text, relativePath)) fileIssues.add(`${issue} (${encoding})`);
    }
    issues.push(...fileIssues);
  }
  return issues;
}

function collectPureProfileEntryIssues(root, manifest, files) {
  if (manifest.profile !== "pure") return [];
  const fileSet = new Set(files);
  const issues = [];
  for (const entryPath of PURE_PROFILE_RUNTIME_ENTRY_PATHS) {
    if (!fileSet.has(entryPath)) continue;
    const content = fs.readFileSync(path.join(root, ...entryPath.split("/")), "utf8");
    for (const { excludedPath, pattern } of PURE_PROFILE_ENTRY_REFERENCE_RULES) {
      if (pattern.test(content)) {
        issues.push(`Pure profile runtime entry references excluded source file: ${entryPath} -> ${excludedPath}`);
      }
    }
  }
  return issues;
}

function collectPureProfilePayloadIssues(manifest, records, files) {
  if (manifest.profile !== "pure") return [];
  const fileSet = new Set(files);
  const issues = [];
  for (const excludedPath of PURE_PROFILE_EXCLUDED_PATHS) {
    if (records.has(excludedPath)) {
      issues.push(`Pure profile manifest includes excluded source file: ${excludedPath}`);
    }
    if (fileSet.has(excludedPath)) {
      issues.push(`Pure profile payload contains excluded source file: ${excludedPath}`);
    }
  }
  return issues;
}

function readManifest(packageRoot) {
  const manifestPath = path.join(packageRoot, MANIFEST_NAME);
  const stat = fs.lstatSync(manifestPath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${MANIFEST_NAME} must be a regular file`);
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
  } catch (error) {
    throw new Error(`Could not parse ${MANIFEST_NAME}: ${error.message}`);
  }
  return { manifest, manifestPath };
}

export function verifyLitePackageDirectory(packageRootInput) {
  const packageRoot = assertRegularDirectory(packageRootInput, "Package root");
  const { manifest, manifestPath } = readManifest(packageRoot);
  const issues = [];
  const records = new Map();
  const sourceObjectFormat = manifest.sourceObjectFormat;
  const sourceObjectIdLength = sourceObjectFormat === "sha1" ? 40 : sourceObjectFormat === "sha256" ? 64 : 0;

  if (manifest.sourceInventory !== "git-index-tree-blobs") {
    issues.push("MANIFEST sourceInventory must be git-index-tree-blobs");
  }
  if (!KNOWN_PROFILES.has(manifest.profile)) {
    issues.push(`MANIFEST profile must be safe-lite or pure: ${manifest.profile || "<missing>"}`);
  }
  const declaredProfilePaths = manifest.exclude?.profilePaths;
  const expectedProfilePaths = manifest.profile === "pure" ? [...PURE_PROFILE_EXCLUDED_PATHS].sort() : null;
  if (manifest.profile === "pure") {
    if (!Array.isArray(declaredProfilePaths) || JSON.stringify([...declaredProfilePaths].sort()) !== JSON.stringify(expectedProfilePaths)) {
      issues.push("Pure profile MANIFEST exclude.profilePaths is missing or does not match the canonical exclusion list");
    }
  } else if (declaredProfilePaths !== undefined) {
    issues.push("safe-lite MANIFEST must not declare pure profile exclusions");
  }
  if (sourceObjectIdLength === 0) {
    issues.push("MANIFEST sourceObjectFormat must be sha1 or sha256");
  } else if (!new RegExp(`^[a-f0-9]{${sourceObjectIdLength}}$`, "u").test(manifest.sourceIndexTree || "")) {
    issues.push("MANIFEST sourceIndexTree is invalid for its Git object format");
  }

  if (!Array.isArray(manifest.files)) issues.push("MANIFEST.files must be an array");
  for (const record of Array.isArray(manifest.files) ? manifest.files : []) {
    try {
      assertSafeRelativePath(record.path, "MANIFEST file path");
    } catch (error) {
      issues.push(error.message);
      continue;
    }
    if (records.has(record.path)) issues.push(`MANIFEST contains duplicate file: ${record.path}`);
    if (!Number.isSafeInteger(record.bytes) || record.bytes < 0) issues.push(`MANIFEST bytes are invalid: ${record.path}`);
    if (!/^[a-f0-9]{64}$/u.test(record.sha256 || "")) issues.push(`MANIFEST sha256 is invalid: ${record.path}`);
    if (!/^(?:100644|100755)$/u.test(record.mode || "")) issues.push(`MANIFEST mode is invalid: ${record.path}`);
    if (
      sourceObjectIdLength > 0 &&
      !new RegExp(`^[a-f0-9]{${sourceObjectIdLength}}$`, "u").test(record.sourceBlob || "")
    ) {
      issues.push(`MANIFEST sourceBlob is invalid: ${record.path}`);
    }
    if (
      (record.path === ".githooks/pre-commit" || /^(?:hooks|codex-hooks)\/[^/]+\.sh$/u.test(record.path)) &&
      record.mode !== "100755"
    ) {
      issues.push(`Runtime hook must be executable in the Git index: ${record.path}`);
    }
    records.set(record.path, record);
  }

  const actualFiles = listRegularFiles(packageRoot);
  const payloadFiles = actualFiles.filter((file) => file !== MANIFEST_NAME);
  const actualSet = new Set(payloadFiles);
  for (const relativePath of records.keys()) {
    if (!actualSet.has(relativePath)) issues.push(`Package is missing MANIFEST file: ${relativePath}`);
  }
  for (const relativePath of actualSet) {
    if (!records.has(relativePath)) issues.push(`Package contains an extra file not in MANIFEST: ${relativePath}`);
  }

  let totalBytes = 0;
  for (const [relativePath, record] of records) {
    if (!actualSet.has(relativePath)) continue;
    const absolute = path.join(packageRoot, ...relativePath.split("/"));
    const stat = fs.statSync(absolute);
    const content = fs.readFileSync(absolute);
    const digest = sha256Buffer(content);
    totalBytes += stat.size;
    if (stat.size !== record.bytes) issues.push(`Byte count mismatch for ${relativePath}`);
    if (digest !== record.sha256) issues.push(`SHA-256 mismatch for ${relativePath}`);
    if (sourceObjectIdLength > 0 && gitBlobObjectId(content, sourceObjectFormat) !== record.sourceBlob) {
      issues.push(`Git source blob mismatch for ${relativePath}`);
    }
  }

  if (manifest.totals?.files !== records.size) issues.push("MANIFEST totals.files does not match file records");
  if (manifest.totals?.bytes !== totalBytes) issues.push("MANIFEST totals.bytes does not match file records");
  for (const required of REQUIRED_RELEASE_INPUTS) {
    if (!records.has(required)) issues.push(`Required release input is missing: ${required}`);
  }
  issues.push(...collectPureProfileEntryIssues(packageRoot, manifest, actualFiles));
  issues.push(...collectPureProfilePayloadIssues(manifest, records, actualFiles));
  issues.push(...collectPrivacyIssues(packageRoot, actualFiles));

  if (issues.length > 0) {
    throw new Error(`Lite package directory verification failed:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
  }

  const allRecords = new Map(records);
  allRecords.set(MANIFEST_NAME, {
    path: MANIFEST_NAME,
    bytes: fs.statSync(manifestPath).size,
    sha256: sha256File(manifestPath),
    mode: "100644",
  });
  return {
    packageRoot,
    manifest,
    records: allRecords,
    files: [...allRecords.keys()].sort(),
    totals: {
      files: allRecords.size,
      bytes: [...allRecords.values()].reduce((sum, record) => sum + record.bytes, 0),
    },
  };
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - (0xffff + 22));
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("ZIP end-of-central-directory record was not found");
}

function readZipEntries(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const eocd = findEndOfCentralDirectory(buffer);
  const disk = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new Error("Multi-disk ZIP archives are not supported");
  }
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported for the lite package");
  }

  const entries = [];
  const names = new Set();
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`Invalid ZIP central directory entry ${index}`);
    }
    const versionMadeBy = buffer.readUInt16LE(offset + 4);
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (names.has(name)) throw new Error(`ZIP contains a duplicate entry: ${name}`);
    names.add(name);
    if (name.includes("\\") || name.startsWith("/") || /^[A-Za-z]:/u.test(name)) {
      throw new Error(`ZIP contains a non-portable entry path: ${name}`);
    }
    const normalizedName = name.endsWith("/") ? name.slice(0, -1) : name;
    const segments = normalizedName.split("/");
    if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      throw new Error(`ZIP contains an empty or traversal entry path: ${name}`);
    }
    entries.push({
      name,
      versionMadeBy,
      flags,
      method,
      compressedSize,
      uncompressedSize,
      externalAttributes,
      localOffset,
      isDirectory: name.endsWith("/"),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== centralOffset + centralSize) throw new Error("ZIP central directory size does not match EOCD");
  return { buffer, entries };
}

function readZipEntryData(buffer, entry) {
  const offset = entry.localOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== LOCAL_SIGNATURE) {
    throw new Error(`Invalid ZIP local header for ${entry.name}`);
  }
  const localFlags = buffer.readUInt16LE(offset + 6);
  const localMethod = buffer.readUInt16LE(offset + 8);
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  if ((localFlags & 0x1) !== 0) throw new Error(`Encrypted ZIP entries are not allowed: ${entry.name}`);
  if (localMethod !== entry.method) throw new Error(`ZIP method mismatch for ${entry.name}`);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  let data;
  if (entry.method === 0) data = compressed;
  else if (entry.method === 8) data = zlib.inflateRawSync(compressed);
  else throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.name}`);
  if (data.length !== entry.uncompressedSize) throw new Error(`ZIP byte count mismatch for ${entry.name}`);
  return data;
}

export function verifyLitePackageZip(zipPathInput, directoryVerification) {
  const zipPath = path.resolve(zipPathInput);
  const stat = fs.lstatSync(zipPath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`ZIP must be a regular file: ${zipPath}`);
  const packageName = String(directoryVerification.manifest.name || "");
  if (!packageName || packageName.includes("/") || packageName.includes("\\")) {
    throw new Error(`MANIFEST name is not a safe ZIP prefix: ${packageName}`);
  }
  const prefix = `${packageName}/`;
  const { buffer, entries } = readZipEntries(zipPath);
  const files = new Map();
  for (const entry of entries) {
    if (!entry.name.startsWith(prefix)) throw new Error(`ZIP entry is outside the package prefix: ${entry.name}`);
    if (entry.isDirectory) continue;
    const relativePath = entry.name.slice(prefix.length);
    assertSafeRelativePath(relativePath, "ZIP file path");
    files.set(relativePath, entry);
  }

  const expected = directoryVerification.records;
  for (const relativePath of expected.keys()) {
    if (!files.has(relativePath)) throw new Error(`ZIP is missing package file: ${relativePath}`);
  }
  for (const relativePath of files.keys()) {
    if (!expected.has(relativePath)) throw new Error(`ZIP contains an extra package file: ${relativePath}`);
  }

  for (const [relativePath, record] of expected) {
    const entry = files.get(relativePath);
    const data = readZipEntryData(buffer, entry);
    if (data.length !== record.bytes) throw new Error(`ZIP bytes differ from directory for ${relativePath}`);
    if (sha256Buffer(data) !== record.sha256) throw new Error(`ZIP SHA-256 differs from directory for ${relativePath}`);
    const unixMode = (entry.externalAttributes >>> 16) & 0xffff;
    if ((entry.versionMadeBy >>> 8) !== 3) {
      throw new Error(`ZIP entry is not marked as Unix metadata: ${relativePath}`);
    }
    const expectedPermissions = record.mode === "100755" ? 0o755 : 0o644;
    if ((unixMode & 0o777) !== expectedPermissions) {
      throw new Error(
        `ZIP Unix mode mismatch for ${relativePath}: expected ${expectedPermissions.toString(8)}, got ${(unixMode & 0o777).toString(8)}`,
      );
    }
  }

  return {
    zipPath,
    sha256: sha256File(zipPath),
    bytes: stat.size,
    entries: entries.length,
    files: files.size,
  };
}

function parseArgs(argv) {
  const args = { packageRoot: "", zip: "", json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--zip") args.zip = argv[++index] || "";
    else if (arg === "--json") args.json = true;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else if (!arg.startsWith("-") && !args.packageRoot) args.packageRoot = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  console.log("Usage: node tools/verify-lite-package.mjs <package-root> [--zip <archive.zip>] [--json]");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.packageRoot) {
      usage();
      process.exitCode = args.help ? 0 : 2;
    } else {
      const directory = verifyLitePackageDirectory(args.packageRoot);
      const zip = args.zip ? verifyLitePackageZip(args.zip, directory) : null;
      const result = {
        ok: true,
        packageRoot: directory.packageRoot,
        files: directory.totals.files,
        bytes: directory.totals.bytes,
        zip,
      };
      if (args.json) console.log(JSON.stringify(result, null, 2));
      else console.log(`[PASS] Lite package verified: ${result.files} file(s), ${result.bytes} byte(s)${zip ? `, ZIP ${zip.sha256}` : ""}`);
    }
  } catch (error) {
    console.error(`[FAIL] ${error.message}`);
    process.exitCode = 1;
  }
}
