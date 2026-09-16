#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function unsafe(message) {
  const error = new Error(message);
  error.code = "UNSAFE_TARGET_PATH";
  return error;
}

function isPathInside(root, candidate) {
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
  if (!isPathInside(rootInfo.root, absolute)) {
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
        if (!isPathInside(rootInfo.realRoot, realParent)) {
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
    if (!isPathInside(rootInfo.realRoot, realCurrent)) {
      throw unsafe(`target path resolves outside project root: ${relativePath}`);
    }
    if (final) return { ...normalized, path: absolute, exists: true, stat };
  }

  throw unsafe(`target path could not be inspected: ${relativePath}`);
}

export function inspectTargetFile(rootInput, relativePath) {
  return inspectWithRoot(assertSafeTargetRoot(rootInput), relativePath, "file");
}
