#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { execTrustedGit, splitNullUtf8 } from "./trusted-git.mjs";
import {
  REQUIRED_RELEASE_INPUTS,
  PURE_PROFILE_EXCLUDED_PATHS as PURE_PROFILE_EXCLUDED_PATH_LIST,
  verifyLitePackageDirectory,
  verifyLitePackageZip,
} from "./verify-lite-package.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageName = "vibe coding skills";
const releaseRoot = path.join(repoRoot, "release");
const packageRoot = path.join(releaseRoot, packageName);
const zipPath = path.join(releaseRoot, `${packageName}.zip`);

const includeRootFiles = new Set([
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  "AGENTS.md",
  "CLAUDE.md",
  "codex-hooks.json",
  "DEV-PLAN.md",
  "DOC-MAP.md",
  "EVOLUTION.md",
  "Product-Spec-CHANGELOG.md",
  "Product-Spec.md",
  "README.md",
  "package.json",
  "settings.json",
  "TERMINOLOGY-AND-NAMING.md",
]);

const includeRootDirs = [
  ".agents/",
  ".claude/",
  ".codex/",
  ".githooks/",
  "agents/",
  "codex-hooks/",
  "docs/",
  "feedback/",
  "hooks/",
  "plans/",
  "skills/",
  "tools/",
];

const excludedPrefixes = [
  ".git/",
  ".github/",
  "examples/",
  "node_modules/",
  "release/",
  "tmp/",
];

const excludedFilePatterns = [
  /(^|\/)scripts\/tests\//u,
  /(^|\/)__tests__\//u,
  /(^|\/)\.env(?:\.|$)/u,
  /\.(?:log|tmp|bak|orig|rej)$/iu,
  /\.(?:db|sqlite|sqlite3)(?:-(?:shm|wal))?$/iu,
  /(^|\/)(?:credentials|secret|private|id_rsa|id_ed25519)(?:\.|$)/iu,
  /\.(?:pem|key|p12|pfx)$/iu,
  /(^|\/)plans\/\.(?:continuity-|rewrite-)/iu,
];

// 打包档位：safe-lite 是默认完整包，pure 额外剔除分发包自身的开发元文档。
const DEFAULT_PROFILE = "safe-lite";
const KNOWN_PROFILES = new Set([DEFAULT_PROFILE, "pure"]);
// 冻结以防被共享引用误改污染（两个集合会被多处只读复用）。
const EMPTY_EXCLUDED_PATHS = Object.freeze(new Set());
// pure 档位剔除的路径：6 份开发元文档 + EVOLUTION.md 的 .claude 镜像（成对移除，保持镜像一致性校验通过）。
const PURE_PROFILE_EXCLUDED_PATHS = Object.freeze(new Set(PURE_PROFILE_EXCLUDED_PATH_LIST));

function profileExcludedPaths(profile) {
  return profile === "pure" ? PURE_PROFILE_EXCLUDED_PATHS : EMPTY_EXCLUDED_PATHS;
}

const directRuntimeMirrorDirectoryRules = [
  { sourcePrefix: "skills/", targetPrefixes: [".agents/skills/", ".claude/skills/"] },
  {
    sourcePrefix: "agents/",
    targetPrefixes: [".claude/agents/"],
    excludedRelativePaths: new Set(["INDEX.md"]),
  },
  { sourcePrefix: "hooks/", targetPrefixes: [".claude/hooks/"] },
  { sourcePrefix: "codex-hooks/", targetPrefixes: [".codex/hooks/"] },
  { sourcePrefix: "feedback/templates/", targetPrefixes: [".claude/feedback/templates/"] },
];

const directRuntimeMirrorFilePairs = new Map([
  ["EVOLUTION.md", ".claude/EVOLUTION.md"],
  ["settings.json", ".claude/settings.json"],
  ["codex-hooks.json", ".codex/hooks.json"],
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function runGit(args, fallback = "") {
  try {
    return execTrustedGit(repoRoot, args, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

function readObjectFormat() {
  const format = execTrustedGit(repoRoot, ["rev-parse", "--show-object-format"], { encoding: "utf8" }).trim();
  if (format !== "sha1" && format !== "sha256") {
    throw new Error(`Unsupported Git object format: ${format || "unknown"}`);
  }
  return format;
}

function captureIndexTree(objectFormat) {
  const tree = execTrustedGit(repoRoot, ["write-tree"], { encoding: "utf8" }).trim();
  const expectedLength = objectFormat === "sha256" ? 64 : 40;
  if (!new RegExp(`^[a-f0-9]{${expectedLength}}$`, "u").test(tree)) {
    throw new Error(`Git write-tree returned an invalid ${objectFormat} object id`);
  }
  return tree;
}

function listTrackedEntries(sourceIndexTree, objectFormat) {
  const output = execTrustedGit(repoRoot, ["ls-tree", "-r", "-z", "--full-tree", sourceIndexTree], {
    encoding: null,
  });
  const expectedLength = objectFormat === "sha256" ? 64 : 40;
  return splitNullUtf8(output)
    .filter(Boolean)
    .map((record) => {
      const match = /^(\d{6}) (blob|commit) ([0-9a-f]+)\t([\s\S]+)$/u.exec(record);
      if (!match) throw new Error(`Could not parse tracked Git record: ${JSON.stringify(record)}`);
      if (match[3].length !== expectedLength) {
        throw new Error(`Tracked Git object id has the wrong length for ${objectFormat}: ${match[4]}`);
      }
      return { mode: match[1], type: match[2], oid: match[3], path: match[4] };
    });
}

function listUntrackedFiles() {
  const output = execTrustedGit(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"], { encoding: null });
  return splitNullUtf8(output)
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));
}

function listUnstagedFiles() {
  const output = execTrustedGit(repoRoot, ["diff", "--name-only", "-z", "--"], { encoding: null });
  return splitNullUtf8(output)
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));
}

function shouldInclude(file, excludedPaths = EMPTY_EXCLUDED_PATHS) {
  if (excludedPaths.has(file)) return false;
  if (includeRootFiles.has(file)) return true;
  if (!includeRootDirs.some((prefix) => file.startsWith(prefix))) return false;
  if (excludedPrefixes.some((prefix) => file.startsWith(prefix))) return false;
  if (excludedFilePatterns.some((pattern) => pattern.test(file))) return false;
  return true;
}

function assertDirectRuntimeMirrorIndexParity(included) {
  const entriesByPath = new Map(included.map((entry) => [entry.path, entry]));
  const expectedPairs = new Map();
  const issues = [];

  for (const entry of included) {
    for (const rule of directRuntimeMirrorDirectoryRules) {
      if (!entry.path.startsWith(rule.sourcePrefix)) continue;
      const relativePath = entry.path.slice(rule.sourcePrefix.length);
      if (rule.excludedRelativePaths?.has(relativePath)) continue;
      for (const targetPrefix of rule.targetPrefixes) {
        expectedPairs.set(`${targetPrefix}${relativePath}`, entry.path);
      }
    }
  }

  for (const [sourcePath, targetPath] of directRuntimeMirrorFilePairs) {
    if (entriesByPath.has(sourcePath)) expectedPairs.set(targetPath, sourcePath);
  }

  for (const [targetPath, sourcePath] of expectedPairs) {
    const sourceEntry = entriesByPath.get(sourcePath);
    const targetEntry = entriesByPath.get(targetPath);
    if (!targetEntry) {
      issues.push(`Missing direct runtime mirror ${targetPath} for ${sourcePath}`);
    } else if (!sourceEntry) {
      issues.push(`Direct runtime mirror has no source input: ${targetPath} -> ${sourcePath}`);
    } else if (targetEntry.oid !== sourceEntry.oid) {
      issues.push(`Direct runtime mirror index blob differs: ${targetPath} != ${sourcePath}`);
    }
  }

  for (const entry of included) {
    for (const rule of directRuntimeMirrorDirectoryRules) {
      for (const targetPrefix of rule.targetPrefixes) {
        if (!entry.path.startsWith(targetPrefix)) continue;
        if (!expectedPairs.has(entry.path)) {
          issues.push(`Stale direct runtime mirror is excluded from sync: ${entry.path}`);
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(
      `Refusing to build because direct runtime mirror index blobs are not setup-stable:\n${issues
        .map((issue) => `  - ${issue}`)
        .join("\n")}`,
    );
  }
}

function isInside(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafeRepoPath(target, role) {
  const resolved = path.resolve(target);
  if (!isInside(repoRoot, resolved) || resolved === repoRoot) {
    throw new Error(`${role} must stay below repository root: ${resolved}`);
  }

  const realRepoRoot = fs.realpathSync(repoRoot);
  const relative = path.relative(repoRoot, resolved);
  let current = repoRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`${role} contains a symlink or junction: ${current}`);
    }
    const realCurrent = fs.realpathSync(current);
    if (!isInside(realRepoRoot, realCurrent)) {
      throw new Error(`${role} resolves outside repository root: ${current}`);
    }
  }
  return resolved;
}

function removeInsideRepo(target) {
  const resolved = assertSafeRepoPath(target, "Removal target");
  fs.rmSync(resolved, { recursive: true, force: true });
}

function readIndexBlob(entry, objectFormat) {
  if (entry.type !== "blob") {
    throw new Error(`Release input must be a Git blob, got ${entry.type}: ${entry.path}`);
  }
  const content = execTrustedGit(repoRoot, ["cat-file", "blob", entry.oid], {
    encoding: null,
    maxBuffer: 256 * 1024 * 1024,
  });
  const header = Buffer.from(`blob ${content.length}\0`, "utf8");
  const calculatedOid = crypto.createHash(objectFormat).update(header).update(content).digest("hex");
  if (calculatedOid !== entry.oid) {
    throw new Error(`Git blob content does not match its object id: ${entry.path}`);
  }
  return content;
}

function writePackageBlob(relPath, content, gitMode) {
  const target = assertSafeRepoPath(path.join(packageRoot, relPath), "Package target");
  assertSafeRepoPath(path.dirname(target), "Package target parent");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  assertSafeRepoPath(path.dirname(target), "Package target parent");
  fs.writeFileSync(target, content, { flag: "wx", mode: gitMode === "100755" ? 0o755 : 0o644 });
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`Package target must be a newly created regular file: ${target}`);
  }
}

function runPackageGit(args) {
  return execTrustedGit(repoRoot, ["-C", packageRoot, ...args], { encoding: "utf8" }).trim();
}

function normalizeZipUnixModes(copiedFiles) {
  const buffer = fs.readFileSync(zipPath);
  const minimum = Math.max(0, buffer.length - (0xffff + 22));
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("Could not find ZIP end-of-central-directory record");
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const modeByPath = new Map(copiedFiles.map((file) => [file.path, file.mode]));
  modeByPath.set("MANIFEST.json", "100644");
  const prefix = `${packageName}/`;
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory entry ${index}`);
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (!name.startsWith(prefix)) throw new Error(`ZIP entry is outside package prefix: ${name}`);
    const relativePath = name.slice(prefix.length);
    let unixMode;
    if (name.endsWith("/")) unixMode = 0o040755;
    else {
      const gitMode = modeByPath.get(relativePath);
      if (!gitMode) throw new Error(`ZIP contains an unexpected file: ${relativePath}`);
      unixMode = Number.parseInt(gitMode, 8);
    }
    const madeBy = buffer.readUInt16LE(offset + 4);
    buffer.writeUInt16LE((3 << 8) | (madeBy & 0xff), offset + 4);
    const dosAttributes = buffer.readUInt32LE(offset + 38) & 0xffff;
    buffer.writeUInt32LE((((unixMode & 0xffff) << 16) | dosAttributes) >>> 0, offset + 38);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  fs.writeFileSync(zipPath, buffer);
}

function createZip(copiedFiles) {
  const gitDir = path.join(packageRoot, ".git");
  try {
    runPackageGit(["init", "--quiet"]);
    const infoDir = assertSafeRepoPath(path.join(gitDir, "info"), "Temporary archive attributes directory");
    fs.mkdirSync(infoDir, { recursive: true });
    fs.writeFileSync(
      path.join(infoDir, "attributes"),
      "* -text -filter -diff -merge -export-ignore -export-subst\n",
      "utf8",
    );
    runPackageGit(["add", "-A", "--", "."]);
    const executablePaths = copiedFiles
      .filter((file) => file.mode === "100755")
      .map((file) => file.path);
    if (executablePaths.length > 0) {
      runPackageGit(["update-index", "--chmod=+x", "--", ...executablePaths]);
    }
    const tree = runPackageGit(["write-tree"]);
    runPackageGit([
      "archive",
      "--format=zip",
      `--prefix=${packageName}/`,
      `--output=${zipPath}`,
      tree,
    ]);
    normalizeZipUnixModes(copiedFiles);
  } finally {
    if (fs.existsSync(gitDir)) removeInsideRepo(gitDir);
  }
}

function parseArgs(argv) {
  const options = { createZip: true, profile: DEFAULT_PROFILE };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--no-zip") options.createZip = false;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "--profile") {
      const value = argv[index + 1];
      if (!value || !KNOWN_PROFILES.has(value)) {
        throw new Error(`Unknown profile: ${value ?? "(missing)"}. Known profiles: ${[...KNOWN_PROFILES].join(", ")}`);
      }
      options.profile = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export function buildLitePackage(options, { beforeFinalIndexConsistencyCheck } = {}) {
  const profile = options.profile || DEFAULT_PROFILE;
  if (!KNOWN_PROFILES.has(profile)) {
    throw new Error(`Unknown profile: ${profile}. Known profiles: ${[...KNOWN_PROFILES].join(", ")}`);
  }
  const excludedPaths = profileExcludedPaths(profile);
  const sourceObjectFormat = readObjectFormat();
  const sourceIndexTree = captureIndexTree(sourceObjectFormat);
  const untrackedReleaseInputs = listUntrackedFiles().filter((file) => shouldInclude(file, excludedPaths)).sort();
  if (untrackedReleaseInputs.length > 0) {
    throw new Error(
      `Refusing to build with untracked release inputs:\n${untrackedReleaseInputs.map((file) => `  - ${file}`).join("\n")}`,
    );
  }
  const unstagedReleaseInputs = listUnstagedFiles().filter((file) => shouldInclude(file, excludedPaths)).sort();
  if (unstagedReleaseInputs.length > 0) {
    throw new Error(
      `Refusing to build with unstaged release inputs:\n${unstagedReleaseInputs.map((file) => `  - ${file}`).join("\n")}`,
    );
  }
  if (captureIndexTree(sourceObjectFormat) !== sourceIndexTree) {
    throw new Error("Refusing to build because the Git index changed during release preflight");
  }

  assertSafeRepoPath(releaseRoot, "Release root");
  fs.mkdirSync(releaseRoot, { recursive: true });
  assertSafeRepoPath(releaseRoot, "Release root");
  removeInsideRepo(packageRoot);
  removeInsideRepo(zipPath);

  const tracked = listTrackedEntries(sourceIndexTree, sourceObjectFormat);
  const included = tracked
    .filter((entry) => shouldInclude(entry.path, excludedPaths))
    .sort((left, right) => left.path.localeCompare(right.path));
  const includedPaths = new Set(included.map((entry) => entry.path));
  for (const required of REQUIRED_RELEASE_INPUTS) {
    if (!includedPaths.has(required)) {
      throw new Error(`Required release input is not tracked and included: ${required}`);
    }
  }
  assertDirectRuntimeMirrorIndexParity(included);
  const copiedFiles = [];
  for (const entry of included) {
    if (!/^(?:100644|100755)$/u.test(entry.mode)) {
      throw new Error(`Release input must be a regular Git file, got mode ${entry.mode}: ${entry.path}`);
    }
    const content = readIndexBlob(entry, sourceObjectFormat);
    writePackageBlob(entry.path, content, entry.mode);
    copiedFiles.push({
      path: entry.path,
      bytes: content.length,
      sha256: sha256Buffer(content),
      mode: entry.mode,
      sourceBlob: entry.oid,
    });
  }

  const manifest = {
    name: packageName,
    profile,
    generatedAt: new Date().toISOString(),
    sourceCommit: runGit(["rev-parse", "HEAD"], "unknown"),
    sourceIndexTree,
    sourceObjectFormat,
    sourceBranch: runGit(["branch", "--show-current"], "unknown"),
    sourceInventory: "git-index-tree-blobs",
    outputDirectory: toPosix(path.relative(repoRoot, packageRoot)),
    outputZip: options.createZip ? toPosix(path.relative(repoRoot, zipPath)) : null,
    include: {
      rootFiles: [...includeRootFiles].filter((file) => !excludedPaths.has(file)).sort(),
      rootDirs: includeRootDirs,
    },
    exclude: {
      prefixes: excludedPrefixes,
      filePatterns: excludedFilePatterns.map((pattern) => pattern.source),
      // 仅非空时写入，保证默认 safe-lite 的 manifest 与改动前逐字节一致。
      ...(excludedPaths.size > 0 ? { profilePaths: [...excludedPaths].sort() } : {}),
    },
    totals: {
      files: copiedFiles.length,
      bytes: copiedFiles.reduce((sum, file) => sum + file.bytes, 0),
    },
    files: copiedFiles,
  };

  fs.writeFileSync(path.join(packageRoot, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const directoryVerification = verifyLitePackageDirectory(packageRoot);
  let zipVerification = null;
  if (options.createZip) {
    createZip(copiedFiles);
    zipVerification = verifyLitePackageZip(zipPath, directoryVerification);
  }
  beforeFinalIndexConsistencyCheck?.();
  if (captureIndexTree(sourceObjectFormat) !== sourceIndexTree) {
    throw new Error("Refusing to publish because the Git index changed while the lite package was being built");
  }

  const zipBytes = options.createZip ? fs.statSync(zipPath).size : 0;
  console.log(JSON.stringify({
    packageRoot: toPosix(path.relative(repoRoot, packageRoot)),
    zip: options.createZip ? toPosix(path.relative(repoRoot, zipPath)) : null,
    files: copiedFiles.length + 1,
    unpackedMB: Number(((manifest.totals.bytes + fs.statSync(path.join(packageRoot, "MANIFEST.json")).size) / 1024 / 1024).toFixed(2)),
    zipMB: Number((zipBytes / 1024 / 1024).toFixed(2)),
    zipSha256: zipVerification?.sha256 || null,
    sourceIndexTree: manifest.sourceIndexTree,
  }, null, 2));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node tools/build-lite-package.mjs [--no-zip] [--profile safe-lite|pure]");
  } else {
    buildLitePackage(options);
  }
}
