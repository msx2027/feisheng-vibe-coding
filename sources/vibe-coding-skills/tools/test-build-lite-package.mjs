#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PURE_PROFILE_EXCLUDED_PATHS, REQUIRED_RELEASE_INPUTS } from "./verify-lite-package.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceScript = path.join(repoRoot, "tools", "build-lite-package.mjs");
const trustedGitSource = path.join(repoRoot, "tools", "trusted-git.mjs");
const verifierSource = path.join(repoRoot, "tools", "verify-lite-package.mjs");
const testSource = fileURLToPath(import.meta.url);
const toolsIndexSource = path.join(repoRoot, "tools", "INDEX.md");
const documentGovernanceReleaseInputs = Object.freeze([
  "tools/archive-lifecycle-docs.mjs",
  "tools/build-target-doc-index.mjs",
  "tools/check-lifecycle-doc-budget.mjs",
  "tools/check-target-doc-drift.mjs",
  "tools/target-doc-index-core.mjs",
  "tools/migrate-target-doc-system.mjs",
  "tools/resolve-target-doc-context.mjs",
  "tools/markdown-governance-core.mjs",
  "tools/check-markdown-governance.mjs",
  "tools/target-doc-manifest-core.mjs",
  "tools/target-doc-manifest-schema.mjs",
  "tools/target-doc-migration-helpers.mjs",
  "tools/target-doc-transaction.mjs",
  "tools/update-target-task-state.mjs",
]);
const pureEntryReferenceTokens = Object.freeze([
  ["Product-Spec.md", ["Product-Spec.md", "Product-Spec"]],
  ["Product-Spec-CHANGELOG.md", ["Product-Spec-CHANGELOG.md", "Product-Spec-CHANGELOG"]],
  ["DEV-PLAN.md", ["DEV-PLAN.md", "DEV-PLAN"]],
  ["DOC-MAP.md", ["DOC-MAP.md", "DOC-MAP"]],
  ["TERMINOLOGY-AND-NAMING.md", ["TERMINOLOGY-AND-NAMING.md", "TERMINOLOGY-AND-NAMING"]],
  ["EVOLUTION.md", ["EVOLUTION.md", "EVOLUTION"]],
]);

function skillDemoMirrorPaths(filePath) {
  const marker = `${path.sep}skills${path.sep}demo${path.sep}`;
  const markerIndex = filePath.lastIndexOf(marker);
  if (markerIndex < 0) return [];
  const root = filePath.slice(0, markerIndex).replace(/[\\/]+$/u, "");
  if ([".agents", ".claude"].includes(path.basename(root))) return [];
  const relativePath = filePath.slice(markerIndex + marker.length);
  return [
    path.join(root, ".agents", "skills", "demo", relativePath),
    path.join(root, ".claude", "skills", "demo", relativePath),
  ];
}

function writeRawFile(filePath, content, encoding) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, encoding);
}

function writeFile(filePath, content = "fixture\n") {
  writeRawFile(filePath, content, "utf8");
  for (const mirrorPath of skillDemoMirrorPaths(filePath)) {
    writeRawFile(mirrorPath, content, "utf8");
  }
}

function writeBuffer(filePath, content) {
  writeRawFile(filePath, content);
  for (const mirrorPath of skillDemoMirrorPaths(filePath)) {
    writeRawFile(mirrorPath, content);
  }
}

function sha256Buffer(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function gitBlobObjectId(content, objectFormat) {
  return crypto
    .createHash(objectFormat)
    .update(Buffer.from(`blob ${content.length}\0`, "utf8"))
    .update(content)
    .digest("hex");
}

function encodeUtf16Be(text, { bom = false } = {}) {
  const payload = Buffer.from(text, "utf16le");
  payload.swap16();
  return bom ? Buffer.concat([Buffer.from([0xfe, 0xff]), payload]) : payload;
}

function run(command, args, cwd) {
  const effectiveArgs = [...args];
  if (command === "git" && effectiveArgs[0] === "add") {
    const existing = new Set(effectiveArgs);
    for (const argument of args.slice(1)) {
      const normalized = argument.replaceAll("\\", "/").replace(/^\.\//u, "");
      if (!normalized.startsWith("skills/demo/")) continue;
      const relativePath = normalized.slice("skills/demo/".length);
      for (const prefix of [".agents/skills/demo/", ".claude/skills/demo/"]) {
        const mirrorPath = `${prefix}${relativePath}`;
        if (fs.existsSync(path.join(cwd, ...mirrorPath.split("/"))) && !existing.has(mirrorPath)) {
          effectiveArgs.push(mirrorPath);
          existing.add(mirrorPath);
        }
      }
    }
  }
  return spawnSync(command, effectiveArgs, { cwd, encoding: "utf8", shell: false });
}

function mutateZipCentralEntry(source, target, expectedName, mutate) {
  const buffer = fs.readFileSync(source);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  assert.notEqual(eocd, -1, "fixture ZIP must contain EOCD");
  const total = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  let found = false;
  for (let index = 0; index < total; index += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === expectedName) {
      mutate(buffer, offset, nameLength);
      found = true;
      break;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(found, true, `fixture ZIP entry not found: ${expectedName}`);
  fs.writeFileSync(target, buffer);
}

function makeFixture(root) {
  writeFile(path.join(root, "tools", "build-lite-package.mjs"), fs.readFileSync(sourceScript, "utf8"));
  writeFile(path.join(root, "tools", "trusted-git.mjs"), fs.readFileSync(trustedGitSource, "utf8"));
  writeFile(path.join(root, "tools", "verify-lite-package.mjs"), fs.readFileSync(verifierSource, "utf8"));
  writeFile(path.join(root, "tools", "test-build-lite-package.mjs"), fs.readFileSync(testSource, "utf8"));
  writeFile(path.join(root, "tools", "INDEX.md"), fs.readFileSync(toolsIndexSource, "utf8"));
  for (const releaseInput of documentGovernanceReleaseInputs) {
    writeFile(path.join(root, ...releaseInput.split("/")), "export {};\n");
  }
  writeFile(path.join(root, "tools", "safe-target-fs.mjs"), "export {};\n");
  writeFile(path.join(root, "tools", "sync-compat.ps1"));
  writeFile(path.join(root, "tools", "setup-repo.ps1"));
  writeFile(path.join(root, "feedback", "templates", "feedback-index-template.md"));
  writeFile(path.join(root, "feedback", "templates", "feedback-topic-template.md"));
  writeFile(path.join(root, ".claude", "feedback", "templates", "feedback-index-template.md"));
  writeFile(path.join(root, ".claude", "feedback", "templates", "feedback-topic-template.md"));
  const preCommitPath = path.join(root, ".githooks", "pre-commit");
  writeFile(preCommitPath, "#!/usr/bin/env bash\n");
  fs.chmodSync(preCommitPath, 0o755);
  writeFile(path.join(root, "plans", "audit-remediation-20260710.md"), "# Audit plan\n");
  writeFile(path.join(root, "plans", "CURRENT-EXECUTION.md"), "# Current execution\n");
  writeFile(path.join(root, "skills", "demo", "SKILL.md"));
  writeFile(path.join(root, "AGENTS.md"));
  writeFile(path.join(root, "package.json"), '{"name":"fixture","private":true}\n');
  writeFile(path.join(root, "settings.json"), "{}\n");
  writeFile(path.join(root, "codex-hooks.json"), "{}\n");
  writeFile(path.join(root, ".claude", "settings.json"), "{}\n");
  writeFile(path.join(root, ".codex", "hooks.json"), "{}\n");
  // 从唯一发布输入清单补齐 fixture，避免新增正式运行时文件后测试夹具静默漂移。
  for (const required of REQUIRED_RELEASE_INPUTS) {
    const requiredPath = path.join(root, ...required.split("/"));
    if (!fs.existsSync(requiredPath)) writeFile(requiredPath);
  }

  assert.equal(run("git", ["init", "--quiet"], root).status, 0);
  if (process.platform === "win32") {
    const filemode = run("git", ["config", "core.filemode", "false"], root);
    assert.equal(filemode.status, 0, filemode.stderr || filemode.stdout);
  }
  const add = run("git", ["add", "."], root);
  assert.equal(add.status, 0, add.stderr || add.stdout);
  const executable = run("git", ["update-index", "--chmod=+x", ".githooks/pre-commit"], root);
  assert.equal(executable.status, 0, executable.stderr || executable.stdout);
  const stagedHook = run("git", ["ls-files", "--stage", "--", ".githooks/pre-commit"], root);
  assert.equal(stagedHook.status, 0, stagedHook.stderr || stagedHook.stdout);
  assert.match(stagedHook.stdout, /^100755 /u, "executable release fixture must retain Git mode 100755");
  const fixtureStatus = run("git", ["status", "--porcelain", "--", ".githooks/pre-commit"], root);
  assert.equal(fixtureStatus.status, 0, fixtureStatus.stderr || fixtureStatus.stdout);
  assert(
    fixtureStatus.stdout.length === 0 || fixtureStatus.stdout.slice(1, 2) === " ",
    `executable release fixture must not contain a worktree mode delta: ${fixtureStatus.stdout.trim()}`,
  );
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "build-lite-package-"));

try {
  for (const releaseInput of documentGovernanceReleaseInputs) {
    assert(
      REQUIRED_RELEASE_INPUTS.includes(releaseInput),
      `lite package required inputs must retain document-governance runtime tool: ${releaseInput}`,
    );
  }

  for (const entryPath of ["AGENTS.md", ".claude/CLAUDE.md"]) {
    const entryContent = fs.readFileSync(path.join(repoRoot, ...entryPath.split("/")), "utf8");
    for (const [excludedPath, tokens] of pureEntryReferenceTokens) {
      for (const token of tokens) {
        assert.equal(
          entryContent.includes(token),
          false,
          `source runtime entry must not reference pure-excluded document: ${entryPath} -> ${excludedPath}`,
        );
      }
    }
  }

  const normalRoot = path.join(tmpRoot, "normal");
  makeFixture(normalRoot);
  const built = run(process.execPath, ["tools/build-lite-package.mjs"], normalRoot);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const packageRoot = path.join(normalRoot, "release", "vibe coding skills");
  const zipPath = path.join(normalRoot, "release", "vibe coding skills.zip");
  assert(
    fs.existsSync(path.join(packageRoot, "feedback", "templates", "feedback-index-template.md")),
    "lite package must retain feedback/templates required by sync-compat",
  );
  assert(
    fs.existsSync(path.join(packageRoot, ".githooks", "pre-commit")),
    "lite package must retain the repository hook installed by setup-repo",
  );
  assert(
    fs.existsSync(path.join(packageRoot, "plans", "audit-remediation-20260710.md")),
    "lite package must retain plans referenced by DEV-PLAN and DOC-MAP",
  );
  assert(fs.existsSync(path.join(packageRoot, "package.json")), "lite package must retain root package.json");
  assert(fs.existsSync(path.join(packageRoot, "tools", "safe-target-fs.mjs")), "lite package must retain safe-target-fs.mjs");
  for (const releaseInput of documentGovernanceReleaseInputs) {
    assert(
      fs.existsSync(path.join(packageRoot, ...releaseInput.split("/"))),
      `lite package must retain document-governance runtime tool: ${releaseInput}`,
    );
  }
  assert(fs.existsSync(zipPath), "lite package must create a ZIP by default");
  const manifestPath = path.join(packageRoot, "MANIFEST.json");
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.sourceInventory, "git-index-tree-blobs");
  assert.match(manifest.sourceObjectFormat, /^(?:sha1|sha256)$/u);
  const sourceObjectIdLength = manifest.sourceObjectFormat === "sha256" ? 64 : 40;
  const sourceObjectIdPattern = new RegExp(`^[a-f0-9]{${sourceObjectIdLength}}$`, "u");
  assert.match(manifest.sourceIndexTree, sourceObjectIdPattern);
  const hookRecord = manifest.files.find((file) => file.path === ".githooks/pre-commit");
  assert.equal(hookRecord?.mode, "100755");
  assert.match(hookRecord?.sourceBlob || "", sourceObjectIdPattern);
  const verified = run(
    process.execPath,
    ["tools/verify-lite-package.mjs", packageRoot, "--zip", zipPath, "--json"],
    normalRoot,
  );
  assert.equal(verified.status, 0, verified.stderr || verified.stdout);

  const runtimeMirrorEolRoot = path.join(tmpRoot, "runtime-mirror-eol");
  makeFixture(runtimeMirrorEolRoot);
  writeFile(
    path.join(runtimeMirrorEolRoot, ".gitattributes"),
    ["* text=auto eol=lf", "*.md text eol=lf", "/.agents/** -text", "/.claude/** -text", ""].join("\n"),
  );
  const mirrorTextWithCrLf = "same logical mirror content\r\nwith CRLF bytes\r\n";
  writeFile(path.join(runtimeMirrorEolRoot, "skills", "demo", "SKILL.md"), mirrorTextWithCrLf);
  writeFile(
    path.join(runtimeMirrorEolRoot, ".agents", "skills", "demo", "SKILL.md"),
    mirrorTextWithCrLf,
  );
  writeFile(
    path.join(runtimeMirrorEolRoot, ".claude", "skills", "demo", "SKILL.md"),
    mirrorTextWithCrLf,
  );
  assert.equal(
    run(
      "git",
      [
        "add",
        ".gitattributes",
        "skills/demo/SKILL.md",
        ".agents/skills/demo/SKILL.md",
        ".claude/skills/demo/SKILL.md",
      ],
      runtimeMirrorEolRoot,
    ).status,
    0,
  );
  const runtimeMirrorEolRed = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip"],
    runtimeMirrorEolRoot,
  );
  assert.notEqual(
    runtimeMirrorEolRed.status,
    0,
    "build-lite must reject a direct mirror whose raw index bytes setup-repo.ps1 would rewrite",
  );
  assert.match(
    `${runtimeMirrorEolRed.stdout}\n${runtimeMirrorEolRed.stderr}`,
    /runtime mirror index blob|setup-stable/i,
  );
  writeFile(
    path.join(runtimeMirrorEolRoot, ".gitattributes"),
    [
      "* text=auto eol=lf",
      "*.md text eol=lf",
      "/.agents/** text=auto eol=lf",
      "/.claude/** text=auto eol=lf",
      "",
    ].join("\n"),
  );
  assert.equal(
    run(
      "git",
      [
        "add",
        "--renormalize",
        ".gitattributes",
        "skills/demo/SKILL.md",
        ".agents/skills/demo/SKILL.md",
        ".claude/skills/demo/SKILL.md",
      ],
      runtimeMirrorEolRoot,
    ).status,
    0,
  );
  const runtimeMirrorEolGreen = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip"],
    runtimeMirrorEolRoot,
  );
  assert.equal(
    runtimeMirrorEolGreen.status,
    0,
    runtimeMirrorEolGreen.stderr || runtimeMirrorEolGreen.stdout,
  );

  const staleRuntimeMirrorRoot = path.join(tmpRoot, "stale-runtime-mirror");
  makeFixture(staleRuntimeMirrorRoot);
  writeFile(path.join(staleRuntimeMirrorRoot, ".claude", "agents", "INDEX.md"), "stale generated mirror\n");
  assert.equal(run("git", ["add", ".claude/agents/INDEX.md"], staleRuntimeMirrorRoot).status, 0);
  const staleRuntimeMirror = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip"],
    staleRuntimeMirrorRoot,
  );
  assert.notEqual(staleRuntimeMirror.status, 0, "build-lite must reject stale direct runtime mirrors");
  assert.match(
    `${staleRuntimeMirror.stdout}\n${staleRuntimeMirror.stderr}`,
    /stale direct runtime mirror|setup-stable/i,
  );

  const missingRuntimeMirrorRoot = path.join(tmpRoot, "missing-runtime-mirror");
  makeFixture(missingRuntimeMirrorRoot);
  const removeRuntimeMirror = run("git", ["rm", "--quiet", "-f", ".agents/skills/demo/SKILL.md"], missingRuntimeMirrorRoot);
  assert.equal(removeRuntimeMirror.status, 0, removeRuntimeMirror.stderr || removeRuntimeMirror.stdout);
  const missingRuntimeMirror = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip"],
    missingRuntimeMirrorRoot,
  );
  assert.notEqual(missingRuntimeMirror.status, 0, "build-lite must reject direct runtime mirrors missing from the package");
  assert.match(
    `${missingRuntimeMirror.stdout}\n${missingRuntimeMirror.stderr}`,
    /missing direct runtime mirror|setup-stable/i,
  );

  const sourceBlobTamper = structuredClone(manifest);
  sourceBlobTamper.files.find((file) => file.path === "AGENTS.md").sourceBlob = "0".repeat(sourceObjectIdLength);
  fs.writeFileSync(manifestPath, `${JSON.stringify(sourceBlobTamper, null, 2)}\n`, "utf8");
  const sourceBlobRejected = run(process.execPath, ["tools/verify-lite-package.mjs", packageRoot], normalRoot);
  assert.notEqual(sourceBlobRejected.status, 0, "verifier must bind package bytes to each declared Git source blob");
  assert.match(`${sourceBlobRejected.stdout}\n${sourceBlobRejected.stderr}`, /source blob|Git source/i);
  fs.writeFileSync(manifestPath, manifestText, "utf8");

  const badModeZip = path.join(normalRoot, "release", "bad-mode.zip");
  mutateZipCentralEntry(
    zipPath,
    badModeZip,
    "vibe coding skills/.githooks/pre-commit",
    (buffer, offset) => buffer.writeUInt32LE(0, offset + 38),
  );
  const badMode = run(
    process.execPath,
    ["tools/verify-lite-package.mjs", packageRoot, "--zip", badModeZip],
    normalRoot,
  );
  assert.notEqual(badMode.status, 0, "verifier must reject ZIP entries without Unix mode metadata");
  assert.match(`${badMode.stdout}\n${badMode.stderr}`, /mode|Unix metadata/i);

  const badPathZip = path.join(normalRoot, "release", "bad-path.zip");
  mutateZipCentralEntry(
    zipPath,
    badPathZip,
    "vibe coding skills/.githooks/pre-commit",
    (buffer, offset, nameLength) => {
      const nameStart = offset + 46;
      const slash = buffer.lastIndexOf(0x2f, nameStart + nameLength - 1);
      assert(slash >= nameStart);
      buffer[slash] = 0x5c;
    },
  );
  const badPath = run(
    process.execPath,
    ["tools/verify-lite-package.mjs", packageRoot, "--zip", badPathZip],
    normalRoot,
  );
  assert.notEqual(badPath.status, 0, "verifier must reject backslashes in ZIP entry paths");
  assert.match(`${badPath.stdout}\n${badPath.stderr}`, /portable entry path|backslash|ZIP/i);

  const junctionRoot = path.join(tmpRoot, "junction");
  makeFixture(junctionRoot);
  const outside = path.join(tmpRoot, "outside");
  writeFile(path.join(outside, "outside-marker.txt"), "must survive\n");
  fs.mkdirSync(path.join(junctionRoot, "release"), { recursive: true });
  fs.symlinkSync(outside, path.join(junctionRoot, "release", "vibe coding skills"), "junction");
  const rejected = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], junctionRoot);
  assert.notEqual(rejected.status, 0, "build-lite must reject a reparse-point output target");
  assert(
    fs.existsSync(path.join(outside, "outside-marker.txt")),
    "build-lite must not delete through a junction",
  );

  const untrackedRoot = path.join(tmpRoot, "untracked");
  makeFixture(untrackedRoot);
  writeFile(path.join(untrackedRoot, "tools", "untracked-helper.mjs"), "export {};\n");
  const untracked = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], untrackedRoot);
  assert.notEqual(untracked.status, 0, "build-lite must reject files that should ship but are untracked");
  assert.match(
    `${untracked.stdout}\n${untracked.stderr}`,
    /untracked/i,
    "build-lite should explain which release inputs are untracked",
  );

  const unstagedRoot = path.join(tmpRoot, "unstaged");
  makeFixture(unstagedRoot);
  writeFile(path.join(unstagedRoot, "skills", "demo", "SKILL.md"), "unstaged release content\n");
  const unstaged = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], unstagedRoot);
  assert.notEqual(unstaged.status, 0, "build-lite must reject unstaged tracked release inputs");
  assert.match(`${unstaged.stdout}\n${unstaged.stderr}`, /unstaged/i);

  const provenanceRoot = path.join(tmpRoot, "index-provenance");
  makeFixture(provenanceRoot);
  const provenancePath = path.join(provenanceRoot, "skills", "demo", "SKILL.md");
  const indexContent = "content committed to the captured index\n";
  const worktreeOnlyContent = "different content hidden by assume-unchanged\n";
  writeFile(provenancePath, indexContent);
  assert.equal(run("git", ["add", "skills/demo/SKILL.md"], provenanceRoot).status, 0);
  const indexBlob = run("git", ["rev-parse", ":skills/demo/SKILL.md"], provenanceRoot).stdout.trim();
  assert.match(indexBlob, /^[a-f0-9]{40,64}$/u);
  assert.equal(run("git", ["update-index", "--assume-unchanged", "skills/demo/SKILL.md"], provenanceRoot).status, 0);
  writeRawFile(provenancePath, worktreeOnlyContent, "utf8");
  const provenanceBuild = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], provenanceRoot);
  assert.equal(provenanceBuild.status, 0, provenanceBuild.stderr || provenanceBuild.stdout);
  const provenancePackageRoot = path.join(provenanceRoot, "release", "vibe coding skills");
  assert.equal(
    fs.readFileSync(path.join(provenancePackageRoot, "skills", "demo", "SKILL.md"), "utf8"),
    indexContent,
    "lite package payload must come from the captured Git index blob, never the mutable worktree",
  );
  const provenanceManifest = JSON.parse(
    fs.readFileSync(path.join(provenancePackageRoot, "MANIFEST.json"), "utf8"),
  );
  assert.equal(
    provenanceManifest.files.find((file) => file.path === "skills/demo/SKILL.md")?.sourceBlob,
    indexBlob,
    "MANIFEST sourceBlob must bind the payload to the captured index object",
  );

  const indexDriftRoot = path.join(tmpRoot, "index-drift");
  makeFixture(indexDriftRoot);
  const indexDriftBuilder = await import(
    `${pathToFileURL(path.join(indexDriftRoot, "tools", "build-lite-package.mjs")).href}?index-drift`,
  );
  let indexDriftCallbackRan = false;
  assert.throws(
    () => indexDriftBuilder.buildLitePackage(
      { createZip: false },
      {
        beforeFinalIndexConsistencyCheck() {
          indexDriftCallbackRan = true;
          writeFile(path.join(indexDriftRoot, "skills", "demo", "index-drift.md"), "staged during build\n");
          const add = run("git", ["add", "skills/demo/index-drift.md"], indexDriftRoot);
          assert.equal(add.status, 0, add.stderr || add.stdout);
        },
      },
    ),
    /Git index changed while the lite package was being built/u,
    "build-lite must fail closed if the index changes after payload generation",
  );
  assert.equal(indexDriftCallbackRan, true, "index drift regression must mutate the index at the final consistency boundary");

  const privacyRoot = path.join(tmpRoot, "privacy");
  makeFixture(privacyRoot);
  writeFile(
    path.join(privacyRoot, "skills", "demo", "SKILL.md"),
    `fixture token sk-proj-${"a".repeat(32)}\n`,
  );
  assert.equal(run("git", ["add", "skills/demo/SKILL.md"], privacyRoot).status, 0);
  const privacy = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], privacyRoot);
  assert.notEqual(privacy.status, 0, "build-lite must reject high-confidence secrets in release content");
  assert.match(`${privacy.stdout}\n${privacy.stderr}`, /secret|token|privacy/i);

  const nulSecretRoot = path.join(tmpRoot, "nul-prefixed-secret");
  makeFixture(nulSecretRoot);
  const nulSecret = `sk-proj-${"b".repeat(32)}`;
  writeBuffer(
    path.join(nulSecretRoot, "skills", "demo", "nul-secret.bin"),
    Buffer.concat([Buffer.from([0]), Buffer.from(`fixture token ${nulSecret}\n`, "utf8")]),
  );
  assert.equal(run("git", ["add", "skills/demo/nul-secret.bin"], nulSecretRoot).status, 0);
  const nulSecretBuild = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], nulSecretRoot);
  assert.notEqual(nulSecretBuild.status, 0, "NUL-prefixed payloads must not bypass high-confidence secret scanning");
  assert.match(`${nulSecretBuild.stdout}\n${nulSecretBuild.stderr}`, /secret|token|privacy/i);

  const utf16SecretRoot = path.join(tmpRoot, "utf16le-secret");
  makeFixture(utf16SecretRoot);
  const utf16Secret = `sk-proj-${"c".repeat(32)}`;
  writeBuffer(
    path.join(utf16SecretRoot, "skills", "demo", "utf16-secret.txt"),
    Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`fixture token ${utf16Secret}\n`, "utf16le")]),
  );
  assert.equal(run("git", ["add", "skills/demo/utf16-secret.txt"], utf16SecretRoot).status, 0);
  const utf16SecretBuild = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], utf16SecretRoot);
  assert.notEqual(utf16SecretBuild.status, 0, "UTF-16LE payloads must not bypass high-confidence secret scanning");
  assert.match(`${utf16SecretBuild.stdout}\n${utf16SecretBuild.stderr}`, /secret|token|privacy/i);

  const nulUtf16SecretRoot = path.join(tmpRoot, "nul-prefixed-utf16le-secret");
  makeFixture(nulUtf16SecretRoot);
  const nulUtf16Secret = `sk-proj-${"d".repeat(32)}`;
  writeBuffer(
    path.join(nulUtf16SecretRoot, "skills", "demo", "nul-utf16le-secret.txt"),
    Buffer.concat([Buffer.alloc(32), Buffer.from([0xff, 0xfe]), Buffer.from(`fixture token ${nulUtf16Secret}\n`, "utf16le")]),
  );
  assert.equal(run("git", ["add", "skills/demo/nul-utf16le-secret.txt"], nulUtf16SecretRoot).status, 0);
  const nulUtf16SecretBuild = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], nulUtf16SecretRoot);
  assert.notEqual(nulUtf16SecretBuild.status, 0, "NUL-prefixed UTF-16LE payloads must not bypass high-confidence secret scanning");
  assert.match(`${nulUtf16SecretBuild.stdout}\n${nulUtf16SecretBuild.stderr}`, /secret|token|privacy/i);

  const utf16BeSecretRoot = path.join(tmpRoot, "utf16be-secret");
  makeFixture(utf16BeSecretRoot);
  const utf16BeSecret = `sk-proj-${"e".repeat(32)}`;
  writeBuffer(
    path.join(utf16BeSecretRoot, "skills", "demo", "utf16be-secret.txt"),
    encodeUtf16Be(`fixture token ${utf16BeSecret}\n`, { bom: true }),
  );
  assert.equal(run("git", ["add", "skills/demo/utf16be-secret.txt"], utf16BeSecretRoot).status, 0);
  const utf16BeSecretBuild = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], utf16BeSecretRoot);
  assert.notEqual(utf16BeSecretBuild.status, 0, "UTF-16BE payloads must not bypass high-confidence secret scanning");
  assert.match(`${utf16BeSecretBuild.stdout}\n${utf16BeSecretBuild.stderr}`, /secret|token|privacy/i);

  const headerUtf16SecretRoot = path.join(tmpRoot, "header-prefixed-utf16le-secret");
  makeFixture(headerUtf16SecretRoot);
  const headerUtf16Secret = `sk-proj-${"f".repeat(32)}`;
  writeBuffer(
    path.join(headerUtf16SecretRoot, "skills", "demo", "header-utf16le-secret.txt"),
    Buffer.concat([
      Buffer.from([0x7f]),
      Buffer.alloc(128),
      Buffer.from(`fixture token ${headerUtf16Secret}\n`, "utf16le"),
    ]),
  );
  assert.equal(run("git", ["add", "skills/demo/header-utf16le-secret.txt"], headerUtf16SecretRoot).status, 0);
  const headerUtf16SecretBuild = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], headerUtf16SecretRoot);
  assert.notEqual(headerUtf16SecretBuild.status, 0, "Binary-header UTF-16LE payloads must not bypass high-confidence secret scanning");
  assert.match(`${headerUtf16SecretBuild.stdout}\n${headerUtf16SecretBuild.stderr}`, /secret|token|privacy/i);

  const personalPathRoot = path.join(tmpRoot, "personal-path");
  makeFixture(personalPathRoot);
  const personalFixturePath = ["", "Users", "alice", "private", "project"].join("/");
  writeFile(
    path.join(personalPathRoot, "skills", "demo", "SKILL.md"),
    `source = "${personalFixturePath}"\n`,
  );
  assert.equal(run("git", ["add", "skills/demo/SKILL.md"], personalPathRoot).status, 0);
  const personalPath = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], personalPathRoot);
  assert.notEqual(personalPath.status, 0, "build-lite must reject real personal absolute paths");
  assert.match(`${personalPath.stdout}\n${personalPath.stderr}`, /user home|absolute home|privacy/i);

  const nulPersonalPathRoot = path.join(tmpRoot, "nul-prefixed-personal-path");
  makeFixture(nulPersonalPathRoot);
  const nulPersonalFixturePath = ["", "Users", "bob", "private", "project"].join("/");
  writeBuffer(
    path.join(nulPersonalPathRoot, "skills", "demo", "nul-personal-path.bin"),
    Buffer.concat([Buffer.from([0]), Buffer.from(`source = "${nulPersonalFixturePath}"\n`, "utf8")]),
  );
  assert.equal(run("git", ["add", "skills/demo/nul-personal-path.bin"], nulPersonalPathRoot).status, 0);
  const nulPersonalPathBuild = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip"],
    nulPersonalPathRoot,
  );
  assert.notEqual(nulPersonalPathBuild.status, 0, "NUL-prefixed payloads must not bypass personal path scanning");
  assert.match(`${nulPersonalPathBuild.stdout}\n${nulPersonalPathBuild.stderr}`, /user home|absolute home|privacy/i);

  const utf16PersonalPathRoot = path.join(tmpRoot, "utf16le-personal-path");
  makeFixture(utf16PersonalPathRoot);
  const utf16PersonalFixturePath = ["", "home", "carol", "private", "project"].join("/");
  writeBuffer(
    path.join(utf16PersonalPathRoot, "skills", "demo", "utf16-personal-path.txt"),
    Buffer.from(`source = "${utf16PersonalFixturePath}"\n`, "utf16le"),
  );
  assert.equal(run("git", ["add", "skills/demo/utf16-personal-path.txt"], utf16PersonalPathRoot).status, 0);
  const utf16PersonalPathBuild = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip"],
    utf16PersonalPathRoot,
  );
  assert.notEqual(utf16PersonalPathBuild.status, 0, "UTF-16LE payloads must not bypass personal path scanning");
  assert.match(`${utf16PersonalPathBuild.stdout}\n${utf16PersonalPathBuild.stderr}`, /user home|absolute home|privacy/i);

  const nulUtf16PersonalPathRoot = path.join(tmpRoot, "nul-prefixed-utf16be-personal-path");
  makeFixture(nulUtf16PersonalPathRoot);
  const nulUtf16PersonalFixturePath = ["", "Users", "dana", "private", "project"].join("/");
  writeBuffer(
    path.join(nulUtf16PersonalPathRoot, "skills", "demo", "nul-utf16be-personal-path.txt"),
    Buffer.concat([Buffer.alloc(16), encodeUtf16Be(`source = "${nulUtf16PersonalFixturePath}"\n`, { bom: true })]),
  );
  assert.equal(run("git", ["add", "skills/demo/nul-utf16be-personal-path.txt"], nulUtf16PersonalPathRoot).status, 0);
  const nulUtf16PersonalPathBuild = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip"],
    nulUtf16PersonalPathRoot,
  );
  assert.notEqual(nulUtf16PersonalPathBuild.status, 0, "NUL-prefixed UTF-16BE payloads must not bypass personal path scanning");
  assert.match(`${nulUtf16PersonalPathBuild.stdout}\n${nulUtf16PersonalPathBuild.stderr}`, /user home|absolute home|privacy/i);

  const utf16BePersonalPathRoot = path.join(tmpRoot, "utf16be-personal-path");
  makeFixture(utf16BePersonalPathRoot);
  const utf16BePersonalFixturePath = ["", "home", "erin", "private", "project"].join("/");
  writeBuffer(
    path.join(utf16BePersonalPathRoot, "skills", "demo", "utf16be-personal-path.txt"),
    encodeUtf16Be(`source = "${utf16BePersonalFixturePath}"\n`, { bom: true }),
  );
  assert.equal(run("git", ["add", "skills/demo/utf16be-personal-path.txt"], utf16BePersonalPathRoot).status, 0);
  const utf16BePersonalPathBuild = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip"],
    utf16BePersonalPathRoot,
  );
  assert.notEqual(utf16BePersonalPathBuild.status, 0, "UTF-16BE payloads must not bypass personal path scanning");
  assert.match(`${utf16BePersonalPathBuild.stdout}\n${utf16BePersonalPathBuild.stderr}`, /user home|absolute home|privacy/i);

  const headerUtf16PersonalPathRoot = path.join(tmpRoot, "header-prefixed-utf16be-personal-path");
  makeFixture(headerUtf16PersonalPathRoot);
  const headerUtf16PersonalFixturePath = ["", "Users", "frank", "private", "project"].join("/");
  writeBuffer(
    path.join(headerUtf16PersonalPathRoot, "skills", "demo", "header-utf16be-personal-path.txt"),
    Buffer.concat([
      Buffer.from([0x42]),
      Buffer.alloc(96),
      encodeUtf16Be(`source = "${headerUtf16PersonalFixturePath}"\n`),
    ]),
  );
  assert.equal(run("git", ["add", "skills/demo/header-utf16be-personal-path.txt"], headerUtf16PersonalPathRoot).status, 0);
  const headerUtf16PersonalPathBuild = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip"],
    headerUtf16PersonalPathRoot,
  );
  assert.notEqual(headerUtf16PersonalPathBuild.status, 0, "Binary-header UTF-16BE payloads must not bypass personal path scanning");
  assert.match(`${headerUtf16PersonalPathBuild.stdout}\n${headerUtf16PersonalPathBuild.stderr}`, /user home|absolute home|privacy/i);

  const binaryControlRoot = path.join(tmpRoot, "binary-control");
  makeFixture(binaryControlRoot);
  writeBuffer(
    path.join(binaryControlRoot, "skills", "demo", "ordinary-binary.bin"),
    Buffer.from([0x00, 0x01, 0x02, 0x7f, 0x80, 0xff, 0x10, 0x00, 0x03]),
  );
  const placeholderPath = ["", "Users", "example", "project"].join("/");
  writeBuffer(
    path.join(binaryControlRoot, "skills", "demo", "placeholder-utf16le.txt"),
    Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(placeholderPath, "utf16le")]),
  );
  writeBuffer(
    path.join(binaryControlRoot, "skills", "demo", "placeholder-utf16be.txt"),
    encodeUtf16Be(placeholderPath, { bom: true }),
  );
  assert.equal(
    run("git", ["add", "skills/demo/ordinary-binary.bin", "skills/demo/placeholder-utf16le.txt", "skills/demo/placeholder-utf16be.txt"], binaryControlRoot).status,
    0,
  );
  const binaryControlBuild = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], binaryControlRoot);
  assert.equal(binaryControlBuild.status, 0, binaryControlBuild.stderr || binaryControlBuild.stdout);

  const databaseRoot = path.join(tmpRoot, "database-artifact");
  makeFixture(databaseRoot);
  writeFile(path.join(databaseRoot, "tools", "data.db-wal"), "runtime database state\n");
  writeFile(path.join(databaseRoot, "tools", "failed.patch.rej"), "rejected patch\n");
  writeFile(path.join(databaseRoot, "tools", "failed.patch.orig"), "original patch\n");
  assert.equal(run("git", ["add", "tools/data.db-wal", "tools/failed.patch.rej", "tools/failed.patch.orig"], databaseRoot).status, 0);
  const databaseBuild = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], databaseRoot);
  assert.equal(databaseBuild.status, 0, databaseBuild.stderr || databaseBuild.stdout);
  assert.equal(
    fs.existsSync(path.join(databaseRoot, "release", "vibe coding skills", "tools", "data.db-wal")),
    false,
    "database WAL artifacts must be excluded from lite packages",
  );
  assert.equal(
    fs.existsSync(path.join(databaseRoot, "release", "vibe coding skills", "tools", "failed.patch.rej")),
    false,
    "rejected patch artifacts must be excluded from lite packages",
  );
  assert.equal(
    fs.existsSync(path.join(databaseRoot, "release", "vibe coding skills", "tools", "failed.patch.orig")),
    false,
    "original patch artifacts must be excluded from lite packages",
  );

  const hookModeRoot = path.join(tmpRoot, "hook-mode");
  makeFixture(hookModeRoot);
  fs.chmodSync(path.join(hookModeRoot, ".githooks", "pre-commit"), 0o644);
  assert.equal(run("git", ["update-index", "--chmod=-x", ".githooks/pre-commit"], hookModeRoot).status, 0);
  const hookModeBuild = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], hookModeRoot);
  assert.notEqual(hookModeBuild.status, 0, "lite packages must reject a non-executable pre-commit hook mode");
  assert.match(`${hookModeBuild.stdout}\n${hookModeBuild.stderr}`, /executable|100755/i);

  writeFile(path.join(packageRoot, "AGENTS.md"), "tampered after build\n");
  const tampered = run(process.execPath, ["tools/verify-lite-package.mjs", packageRoot], normalRoot);
  assert.notEqual(tampered.status, 0, "verifier must reject directory content that differs from MANIFEST");
  assert.match(`${tampered.stdout}\n${tampered.stderr}`, /SHA-256|byte count|verification failed/i);

  // pure 档位：剔除 6 份分发包自身的开发元文档（含 EVOLUTION 镜像对），默认 safe-lite 仍完整保留。
  const developmentDocs = [
    "Product-Spec.md",
    "Product-Spec-CHANGELOG.md",
    "DEV-PLAN.md",
    "DOC-MAP.md",
    "TERMINOLOGY-AND-NAMING.md",
    "EVOLUTION.md",
  ];
  const profileRoot = path.join(tmpRoot, "profile-pure");
  makeFixture(profileRoot);
  writeFile(
    path.join(profileRoot, "AGENTS.md"),
    "继续执行前请读取 Product-Spec 和 DEV-PLAN。\n",
  );
  writeFile(
    path.join(profileRoot, ".claude", "CLAUDE.md"),
    "恢复任务时请读取 DOC-MAP。\n",
  );
  for (const doc of developmentDocs) {
    writeFile(path.join(profileRoot, doc), `# ${doc}\n`);
  }
  // EVOLUTION.md 是 directRuntimeMirrorFilePairs 的镜像源；镜像内容必须与源逐字节一致才能通过一致性校验。
  writeFile(path.join(profileRoot, ".claude", "EVOLUTION.md"), "# EVOLUTION.md\n");
  assert.equal(run("git", ["add", "."], profileRoot).status, 0);

  const defaultProfileBuild = run(process.execPath, ["tools/build-lite-package.mjs", "--no-zip"], profileRoot);
  assert.equal(defaultProfileBuild.status, 0, defaultProfileBuild.stderr || defaultProfileBuild.stdout);
  const defaultProfilePackage = path.join(profileRoot, "release", "vibe coding skills");
  for (const doc of developmentDocs) {
    assert(
      fs.existsSync(path.join(defaultProfilePackage, doc)),
      `default safe-lite profile must retain development document: ${doc}`,
    );
  }
  assert(
    fs.existsSync(path.join(defaultProfilePackage, ".claude", "EVOLUTION.md")),
    "default safe-lite profile must retain the EVOLUTION runtime mirror",
  );
  const defaultProfileManifest = JSON.parse(
    fs.readFileSync(path.join(defaultProfilePackage, "MANIFEST.json"), "utf8"),
  );
  assert.equal(defaultProfileManifest.profile, "safe-lite", "default profile must be labelled safe-lite");

  const pureProfileBuild = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip", "--profile", "pure"],
    profileRoot,
  );
  assert.notEqual(
    pureProfileBuild.status,
    0,
    "pure profile must reject runtime entries that reference excluded source documents",
  );
  assert.match(
    `${pureProfileBuild.stdout}\n${pureProfileBuild.stderr}`,
    /pure|excluded|entry|Product-Spec|DEV-PLAN|DOC-MAP/i,
    "pure profile rejection should identify the dangling runtime entry reference",
  );

  writeFile(path.join(profileRoot, "AGENTS.md"), "可直接使用的运行时规则。\n");
  writeFile(path.join(profileRoot, ".claude", "CLAUDE.md"), "可直接使用的 Claude 运行时规则。\n");
  assert.equal(run("git", ["add", "AGENTS.md", ".claude/CLAUDE.md"], profileRoot).status, 0);
  const pureProfileFixedBuild = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip", "--profile", "pure"],
    profileRoot,
  );
  assert.equal(pureProfileFixedBuild.status, 0, pureProfileFixedBuild.stderr || pureProfileFixedBuild.stdout);
  const pureProfilePackage = path.join(profileRoot, "release", "vibe coding skills");
  for (const doc of developmentDocs) {
    assert.equal(
      fs.existsSync(path.join(pureProfilePackage, doc)),
      false,
      `pure profile must drop development document: ${doc}`,
    );
  }
  assert.equal(
    fs.existsSync(path.join(pureProfilePackage, ".claude", "EVOLUTION.md")),
    false,
    "pure profile must drop the EVOLUTION runtime mirror alongside its source",
  );
  assert(fs.existsSync(path.join(pureProfilePackage, "AGENTS.md")), "pure profile must retain AGENTS.md runtime entry");
  assert(
    fs.existsSync(path.join(pureProfilePackage, "skills", "demo", "SKILL.md")),
    "pure profile must retain skills payload",
  );
  assert(
    fs.existsSync(path.join(pureProfilePackage, "tools", "resolve-target-doc-context.mjs")),
    "pure profile must retain document-governance runtime tools used by target projects",
  );
  const pureProfileManifest = JSON.parse(
    fs.readFileSync(path.join(pureProfilePackage, "MANIFEST.json"), "utf8"),
  );
  assert.equal(pureProfileManifest.profile, "pure", "pure profile must be labelled pure in the manifest");
  const pureProfileVerified = run(
    process.execPath,
    ["tools/verify-lite-package.mjs", pureProfilePackage, "--json"],
    profileRoot,
  );
  assert.equal(pureProfileVerified.status, 0, pureProfileVerified.stderr || pureProfileVerified.stdout);

  // verifier 不能只信任 builder：纯档位被手动回填开发元文档和匹配的 manifest 记录时也必须 fail closed。
  const contaminatedPath = "Product-Spec.md";
  const contaminatedContent = fs.readFileSync(path.join(profileRoot, contaminatedPath));
  fs.writeFileSync(path.join(pureProfilePackage, contaminatedPath), contaminatedContent);
  pureProfileManifest.files.push({
    path: contaminatedPath,
    bytes: contaminatedContent.length,
    sha256: sha256Buffer(contaminatedContent),
    mode: "100644",
    sourceBlob: gitBlobObjectId(contaminatedContent, pureProfileManifest.sourceObjectFormat),
  });
  pureProfileManifest.totals.files += 1;
  pureProfileManifest.totals.bytes += contaminatedContent.length;
  fs.writeFileSync(
    path.join(pureProfilePackage, "MANIFEST.json"),
    `${JSON.stringify(pureProfileManifest, null, 2)}\n`,
    "utf8",
  );
  const contaminatedPureProfile = run(
    process.execPath,
    ["tools/verify-lite-package.mjs", pureProfilePackage],
    profileRoot,
  );
  assert.notEqual(
    contaminatedPureProfile.status,
    0,
    "verifier must reject a pure package whose manifest and payload contain an excluded development document",
  );
  assert.match(
    `${contaminatedPureProfile.stdout}\n${contaminatedPureProfile.stderr}`,
    /pure.*(?:payload|manifest).*excluded|excluded.*pure/iu,
    "pure profile contamination should identify the excluded payload or manifest entry",
  );

  const unknownProfileBuild = run(
    process.execPath,
    ["tools/build-lite-package.mjs", "--no-zip", "--profile", "bogus"],
    profileRoot,
  );
  assert.notEqual(unknownProfileBuild.status, 0, "build-lite must reject an unknown --profile value");
  assert.match(`${unknownProfileBuild.stdout}\n${unknownProfileBuild.stderr}`, /profile/i);

  console.log("build-lite package tests passed");
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
