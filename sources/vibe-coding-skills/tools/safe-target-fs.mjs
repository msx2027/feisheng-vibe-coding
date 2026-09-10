#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function unsafe(message) {
  const error = new Error(message);
  error.code = "UNSAFE_TARGET_PATH";
  return error;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeRelative(relativePath) {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    throw unsafe("target path must be a non-empty project-relative string");
  }
  const normalized = relativePath.replaceAll("\\", "/");
  if (normalized.includes("\0")) {
    throw unsafe("target path must not contain NUL bytes");
  }
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized) || /^[A-Za-z]:/u.test(normalized)) {
    throw unsafe(`target path must be project-relative: ${relativePath}`);
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw unsafe(`target path must not contain traversal segments: ${relativePath}`);
  }
  for (const segment of segments) {
    const deviceBase = segment.split(".", 1)[0];
    if (
      segment.includes(":") ||
      /[. ]$/u.test(segment) ||
      /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/iu.test(deviceBase)
    ) {
      throw unsafe(`target path contains a non-portable or aliased segment: ${relativePath}`);
    }
  }
  return { relative: segments.join("/"), segments };
}

export function assertSafeTargetRoot(rootInput) {
  const root = path.resolve(rootInput);
  let stat;
  try {
    stat = fs.lstatSync(root);
  } catch (error) {
    throw unsafe(`target root is unavailable: ${root} (${error.message})`);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw unsafe(`target root must be a regular directory, not a symlink or junction: ${root}`);
  }
  const realRoot = fs.realpathSync(root);
  return { root, realRoot };
}

function inspectWithRoot(rootInfo, relativePath, kind) {
  const normalized = normalizeRelative(relativePath);
  const absolute = path.join(rootInfo.root, ...normalized.segments);
  if (!isInside(rootInfo.root, absolute)) {
    throw unsafe(`target path escapes project root: ${relativePath}`);
  }

  let current = rootInfo.root;
  for (let index = 0; index < normalized.segments.length; index += 1) {
    current = path.join(current, normalized.segments[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error?.code === "ENOENT") {
        const realParent = fs.realpathSync(path.dirname(current));
        if (!isInside(rootInfo.realRoot, realParent)) {
          throw unsafe(`target parent resolves outside project root: ${relativePath}`);
        }
        return { ...normalized, path: absolute, exists: false, stat: null };
      }
      throw unsafe(`cannot inspect target path ${relativePath}: ${error.message}`);
    }

    if (stat.isSymbolicLink()) {
      throw unsafe(`target path contains a symlink or junction: ${normalized.segments.slice(0, index + 1).join("/")}`);
    }
    const final = index === normalized.segments.length - 1;
    if (!final && !stat.isDirectory()) {
      throw unsafe(`target path parent is not a directory: ${normalized.segments.slice(0, index + 1).join("/")}`);
    }
    if (final && kind === "file" && !stat.isFile()) {
      throw unsafe(`target path is not a regular file: ${relativePath}`);
    }
    if (final && kind === "directory" && !stat.isDirectory()) {
      throw unsafe(`target path is not a regular directory: ${relativePath}`);
    }

    const realCurrent = fs.realpathSync(current);
    if (!isInside(rootInfo.realRoot, realCurrent)) {
      throw unsafe(`target path resolves outside project root: ${relativePath}`);
    }
    if (final) return { ...normalized, path: absolute, exists: true, stat };
  }

  throw unsafe(`target path could not be inspected: ${relativePath}`);
}

export function inspectTargetFile(rootInput, relativePath) {
  return inspectWithRoot(assertSafeTargetRoot(rootInput), relativePath, "file");
}

export function inspectTargetDirectory(rootInput, relativePath) {
  return inspectWithRoot(assertSafeTargetRoot(rootInput), relativePath, "directory");
}

function ensureDirectorySegments(rootInfo, segments) {
  let current = rootInfo.root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw unsafe(`target directory contains a symlink, junction, or non-directory: ${segments.slice(0, index + 1).join("/")}`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      try {
        fs.mkdirSync(current);
      } catch (mkdirError) {
        if (mkdirError?.code !== "EEXIST") throw mkdirError;
      }
      const created = fs.lstatSync(current);
      if (created.isSymbolicLink() || !created.isDirectory()) {
        throw unsafe(`created target directory is unsafe: ${segments.slice(0, index + 1).join("/")}`);
      }
    }

    const realCurrent = fs.realpathSync(current);
    if (!isInside(rootInfo.realRoot, realCurrent)) {
      throw unsafe(`target directory resolves outside project root: ${segments.slice(0, index + 1).join("/")}`);
    }
  }
  return current;
}

export function ensureTargetDirectory(rootInput, relativePath) {
  const rootInfo = assertSafeTargetRoot(rootInput);
  if (relativePath === "" || relativePath === ".") return rootInfo.root;
  const normalized = normalizeRelative(relativePath);
  return ensureDirectorySegments(rootInfo, normalized.segments);
}

export function safeWriteTargetFile(rootInput, relativePath, content, options = {}) {
  const normalizedOptions = typeof options === "string" ? { encoding: options } : options;
  const encoding = normalizedOptions.encoding || "utf8";
  const hasExpectedContent = Object.prototype.hasOwnProperty.call(normalizedOptions, "expectedContent");
  const expectedContent = normalizedOptions.expectedContent;
  const rootInfo = assertSafeTargetRoot(rootInput);
  const normalized = normalizeRelative(relativePath);
  const parentSegments = normalized.segments.slice(0, -1);
  const parent = ensureDirectorySegments(rootInfo, parentSegments);
  const before = inspectWithRoot(rootInfo, normalized.relative, "file");
  const assertExpectedContent = (state) => {
    if (!hasExpectedContent) return;
    if (expectedContent === null) {
      if (state.exists) throw unsafe(`target changed after planning; expected missing file: ${relativePath}`);
      return;
    }
    if (!state.exists) throw unsafe(`target changed after planning; expected existing file: ${relativePath}`);
    const currentContent = fs.readFileSync(state.path, encoding);
    if (currentContent !== expectedContent) {
      throw unsafe(`target content changed after planning: ${relativePath}`);
    }
  };
  assertExpectedContent(before);
  const mode = before.exists ? before.stat.mode & 0o777 : 0o666;
  const tempName = `.${path.basename(normalized.relative)}.vibe-${process.pid}-${crypto.randomBytes(8).toString("hex")}.tmp`;
  const tempPath = path.join(parent, tempName);
  let fd = null;

  try {
    fd = fs.openSync(tempPath, "wx", mode);
    fs.writeFileSync(fd, content, { encoding });
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    ensureDirectorySegments(rootInfo, parentSegments);
    const latest = inspectWithRoot(rootInfo, normalized.relative, "file");
    assertExpectedContent(latest);
    fs.renameSync(tempPath, before.path);
    const after = inspectWithRoot(rootInfo, normalized.relative, "file");
    if (!after.exists) throw unsafe(`target write did not create a regular file: ${relativePath}`);
    return after.path;
  } finally {
    if (fd !== null) fs.closeSync(fd);
    try {
      const tempStat = fs.lstatSync(tempPath);
      if (!tempStat.isSymbolicLink() && tempStat.isFile()) fs.unlinkSync(tempPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}
