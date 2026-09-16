import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { SCAN_ROOTS, shouldScanFile, shouldSkipDirectory, toPosix } from "./hotspot-policy.mjs";

const isInside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

export function inspectScanFile(root, file) {
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(file);
  if (!isInside(resolvedRoot, resolvedFile)) return { ok: false, reason: "path escapes scan root" };
  try {
    const rootStat = lstatSync(resolvedRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return { ok: false, reason: "scan root is not a regular directory" };
    const segments = path.relative(resolvedRoot, resolvedFile).split(path.sep).filter(Boolean);
    let current = resolvedRoot;
    for (let index = 0; index < segments.length; index += 1) {
      current = path.join(current, segments[index]);
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) return { ok: false, reason: `path contains a symlink or junction: ${toPosix(path.relative(resolvedRoot, current))}` };
      const final = index === segments.length - 1;
      if (final ? !stat.isFile() : !stat.isDirectory()) return { ok: false, reason: final ? "path is not a regular file" : "path parent is not a directory" };
    }
    if (!isInside(realpathSync(resolvedRoot), realpathSync(resolvedFile))) return { ok: false, reason: "real path escapes scan root" };
    return { ok: true, file: resolvedFile };
  } catch (error) {
    return { ok: false, reason: error?.code === "ENOENT" ? "path does not exist" : error.message };
  }
}

function walk(dir, root, unsafe, depth = 0) {
  const files = [];
  if (!existsSync(dir)) return files;
  let startStat;
  try {
    startStat = lstatSync(dir);
  } catch (error) {
    if (error?.code === "ENOENT") return files;
    throw error;
  }
  if (startStat.isSymbolicLink() || !startStat.isDirectory()) {
    unsafe.push({ file: toPosix(path.relative(root, dir)), reason: "scan root is a symlink, junction, or non-directory" });
    return files;
  }
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
    if (shouldSkipDirectory(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      // A16：链接一律不跟随，只登记。
      //
      // 为什么不跟随「指向根内」的链接：根内目标本来就会被普通目录遍历走到，
      // 结果又经 new Set 去重，所以跟随一个字节的覆盖率都不会多。而跟随会引入
      // 三个真实缺陷：
      //   1. 成环（junction 指回祖先）导致重复遍历，实测最长空转 15.9 秒；
      //   2. 绕过 SKIP_DIRS——链接名 vendor-link 通得过，真实路径 node_modules
      //      却被排除，等于给 node_modules / target 开后门；
      //   3. 同一文件出现两套路径身份，测试/生产分类与棘轮基线都可能判错。
      // 覆盖率零收益 + 三处缺陷 ⇒ 不跟随。指向根外的仍单独给出逃逸原因，便于定位。
      try {
        const realPath = realpathSync(absolute);
        const escaped = !isInside(realpathSync(root), realPath);
        unsafe.push({
          file: toPosix(path.relative(root, absolute)),
          reason: escaped ? "symlink target escapes scan root" : "path is a symlink or junction",
        });
      } catch (error) {
        unsafe.push({ file: toPosix(path.relative(root, absolute)), reason: `symlink resolution failed: ${error.message}` });
      }
      continue;
    }
    if (stat.isDirectory()) { files.push(...walk(absolute, root, unsafe, depth + 1)); continue; }
    if (!stat.isFile()) { unsafe.push({ file: toPosix(path.relative(root, absolute)), reason: "path is not a regular file" }); continue; }
    if (shouldScanFile(toPosix(path.relative(root, absolute)))) files.push(absolute);
  }
  return files;
}

export function listCodeFiles(root) {
  const unsafe = [];
  const roots = SCAN_ROOTS.map((item) => path.join(root, item)).filter((item) => existsSync(item));
  const scanRoots = roots.length > 0 ? roots : [root];
  return { files: [...new Set(scanRoots.flatMap((item) => walk(item, root, unsafe)))].sort(), unsafe };
}
