// vibe-coding-skills:managed-hotspot-tool
// 热区 staged 门禁的可信 Git 读取层；所有内容均从 index / HEAD 读取，不借用 worktree。
import path from "node:path";
import { shouldScanFile, toPosix } from "./hotspot-policy.mjs";
import { spawnTrustedGit, splitNullBuffer } from "./trusted-git.mjs";

function gitBuffer(root, args) {
  const result = spawnTrustedGit(root, args, {
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) return null;
  return result.stdout;
}

function gitToplevel(root) {
  const result = spawnTrustedGit(root, ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: 1 * 1024 * 1024,
  });
  if (result.status !== 0) return null;
  return String(result.stdout || "").trim().replace(/\\/g, "/");
}

export function stagedFiles(root) {
  // --staged 只接受 root 本身就是 git 工作树根：仓库内的子目录也会被 `git -C`
  // 向上解析到父仓库，若不加此闸，会把"非 git 临时目录"误当成可读 staged 的仓库。
  const toplevel = gitToplevel(root);
  const resolvedRoot = path.resolve(root).replace(/\\/g, "/");
  const isSameRoot = process.platform === "win32"
    ? resolvedRoot.toLowerCase() === toplevel?.toLowerCase()
    : resolvedRoot === toplevel;
  if (toplevel === null || !isSameRoot) return null;
  const output = gitBuffer(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z", "--"]);
  if (output === null) return null;
  return splitNullBuffer(output)
    .map((field) => field.toString("utf8"))
    .filter(shouldScanFile)
    .map((item) => path.resolve(root, item));
}

export function stagedNumstat(root) {
  const output = gitBuffer(root, ["diff", "--cached", "--numstat", "-z", "--"]);
  const stats = new Map();
  if (output === null) return null;
  const fields = splitNullBuffer(output);
  let index = 0;
  while (index < fields.length) {
    const header = fields[index++].toString("utf8");
    const firstTab = header.indexOf("\t");
    const secondTab = firstTab === -1 ? -1 : header.indexOf("\t", firstTab + 1);
    if (firstTab === -1 || secondTab === -1) return null;
    const added = header.slice(0, firstTab);
    const deleted = header.slice(firstTab + 1, secondTab);
    let relPath = header.slice(secondTab + 1);
    if (relPath === "") {
      if (index + 1 >= fields.length) return null;
      index += 1;
      relPath = fields[index++].toString("utf8");
    }
    stats.set(toPosix(relPath), {
      added: Number.parseInt(added, 10) || 0,
      deleted: Number.parseInt(deleted, 10) || 0,
    });
  }
  return stats;
}

export function stagedIndexModes(root) {
  const output = gitBuffer(root, ["ls-files", "--stage", "-z", "--"]);
  if (output === null) return null;
  const modes = new Map();
  for (const field of splitNullBuffer(output)) {
    const record = field.toString("utf8");
    const firstSpace = record.indexOf(" ");
    const tab = record.indexOf("\t");
    if (firstSpace === -1 || tab === -1) return null;
    modes.set(toPosix(record.slice(tab + 1)), record.slice(0, firstSpace));
  }
  return modes;
}

export function stagedBaselinePaths(root) {
  const output = gitBuffer(root, ["diff", "--cached", "--name-status", "-z", "--find-renames", "--diff-filter=ACMR", "--"]);
  if (output === null) return null;
  const fields = splitNullBuffer(output).map((field) => field.toString("utf8"));
  const paths = new Map();
  let index = 0;
  while (index < fields.length) {
    const status = fields[index++] || "";
    if (/^[RC]/.test(status)) {
      const source = fields[index++];
      const destination = fields[index++];
      if (destination) paths.set(toPosix(destination), toPosix(source));
      continue;
    }
    const destination = fields[index++];
    if (destination) paths.set(toPosix(destination), status.startsWith("A") ? null : toPosix(destination));
  }
  return paths;
}

export function stagedBaselineText(root, sourcePath) {
  if (!sourcePath) return null;
  const output = gitBuffer(root, ["show", `HEAD:${sourcePath}`]);
  return output === null ? null : output.toString("utf8");
}

export function stagedIndexText(root, relPath) {
  const output = gitBuffer(root, ["show", `:${relPath}`]);
  return output === null ? null : output.toString("utf8");
}
