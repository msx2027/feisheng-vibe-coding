#!/usr/bin/env node
// vibe-coding-skills:managed-hotspot-tool

import { accessSync, constants, existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;
const SAFE_GIT_GLOBAL_ARGS = ["--no-pager", "-c", "core.fsmonitor=false"];

function isInside(root, candidate) {
  if (!root) return false;
  const relativePath = path.relative(path.resolve(root), path.resolve(candidate));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function absolutePathDirectories(env) {
  return String(env.PATH || "")
    .split(path.delimiter)
    .map((directory) => directory.replace(/^"|"$/g, ""))
    .filter((directory) => directory && path.isAbsolute(directory));
}

export function resolveTrustedExecutable({
  targetRoot = "",
  override = "",
  absoluteCandidates = [],
  pathNames = [],
  env = process.env,
} = {}) {
  const candidates = [];
  if (override && path.isAbsolute(override)) candidates.push(override);
  candidates.push(...absoluteCandidates.filter((candidate) => candidate && path.isAbsolute(candidate)));
  for (const directory of absolutePathDirectories(env)) {
    for (const name of pathNames) candidates.push(path.join(directory, name));
  }

  for (const candidate of candidates) {
    try {
      const absoluteCandidate = path.resolve(candidate);
      if (isInside(targetRoot, absoluteCandidate) || !existsSync(absoluteCandidate)) continue;
      const realCandidate = realpathSync(absoluteCandidate);
      if (isInside(targetRoot, realCandidate) || !statSync(realCandidate).isFile()) continue;
      if (process.platform !== "win32") accessSync(realCandidate, constants.X_OK);
      return realCandidate;
    } catch {
      // Keep searching trusted candidates.
    }
  }
  return "";
}

export function resolveTrustedGit(targetRoot, { env = process.env } = {}) {
  return resolveTrustedExecutable({
    targetRoot,
    override: env.VIBE_GIT_EXECUTABLE || "",
    pathNames: process.platform === "win32" ? ["git.exe", "git.com"] : ["git"],
    env,
  });
}

export function resolveTrustedPowerShell(targetRoot, { env = process.env } = {}) {
  const absoluteCandidates = [];
  if (process.platform === "win32" && env.SystemRoot) {
    absoluteCandidates.push(
      path.join(env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    );
  }
  return resolveTrustedExecutable({
    targetRoot,
    override: env.VIBE_POWERSHELL_EXECUTABLE || "",
    absoluteCandidates,
    pathNames: process.platform === "win32" ? ["pwsh.exe", "powershell.exe"] : ["pwsh", "powershell"],
    env,
  });
}

function missingExecutableResult(label, encoding) {
  const empty = encoding === null ? Buffer.alloc(0) : "";
  return {
    status: null,
    signal: null,
    error: new Error(`Trusted ${label} executable not found outside target root`),
    stdout: empty,
    stderr: empty,
  };
}

function spawnTrusted(executable, args, options = {}) {
  const encoding = Object.prototype.hasOwnProperty.call(options, "encoding") ? options.encoding : "utf8";
  if (!executable) return missingExecutableResult(options.label || "tool", encoding);
  return spawnSync(executable, args, {
    cwd: path.dirname(executable),
    shell: false,
    windowsHide: true,
    encoding,
    env: options.env || process.env,
    input: options.input,
    timeout: options.timeout,
    maxBuffer: options.maxBuffer || DEFAULT_MAX_BUFFER,
  });
}

function hardenGitArgs(args) {
  if (args[0] !== "diff") return [...args];
  const hardened = ["diff"];
  if (!args.includes("--no-ext-diff")) hardened.push("--no-ext-diff");
  if (!args.includes("--no-textconv")) hardened.push("--no-textconv");
  hardened.push(...args.slice(1));
  return hardened;
}

export function spawnTrustedGit(targetRoot, args, options = {}) {
  const root = path.resolve(targetRoot);
  const executable = resolveTrustedGit(root, { env: options.env || process.env });
  return spawnTrusted(executable, [...SAFE_GIT_GLOBAL_ARGS, "-C", root, ...hardenGitArgs(args)], {
    ...options,
    label: "Git",
  });
}

export function spawnTrustedPowerShell(targetRoot, args, options = {}) {
  const root = path.resolve(targetRoot);
  const executable = resolveTrustedPowerShell(root, { env: options.env || process.env });
  return spawnTrusted(executable, args, { ...options, label: "PowerShell" });
}

function outputText(value) {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return String(value || "");
}

function assertSucceeded(result, label) {
  if (!result.error && result.status === 0) return result;
  const detail = outputText(result.stderr).trim() || outputText(result.stdout).trim() || result.error?.message || "";
  const error = new Error(`${label} failed${detail ? `: ${detail}` : ""}`);
  error.result = result;
  throw error;
}

export function execTrustedGit(targetRoot, args, options = {}) {
  return assertSucceeded(spawnTrustedGit(targetRoot, args, options), "Git command").stdout;
}

export function execTrustedPowerShell(targetRoot, args, options = {}) {
  return assertSucceeded(spawnTrustedPowerShell(targetRoot, args, options), "PowerShell command").stdout;
}

export function splitNullBuffer(output) {
  const buffer = Buffer.isBuffer(output) ? output : Buffer.from(output || "");
  const fields = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] !== 0) continue;
    fields.push(buffer.subarray(start, index));
    start = index + 1;
  }
  if (start < buffer.length) fields.push(buffer.subarray(start));
  return fields;
}

export function splitNullUtf8(output) {
  return splitNullBuffer(output).map((field) => field.toString("utf8"));
}
