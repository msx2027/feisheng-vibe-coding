#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveTrustedGit, spawnTrustedGit } from "./trusted-git.mjs";
import { REQUIRED_RELEASE_INPUTS } from "./verify-lite-package.mjs";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(toolsDir);
const uiChecker = path.join(toolsDir, "check-ui-reuse.mjs");
const structuralLint = path.join(toolsDir, "structural-lint.mjs");
const buildLite = path.join(toolsDir, "build-lite-package.mjs");
const trustedGitSource = path.join(toolsDir, "trusted-git.mjs");
const verifyLiteSource = path.join(toolsDir, "verify-lite-package.mjs");

function write(root, relativePath, content = "fixture\n") {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  return target;
}

function runNode(script, args, { cwd, env = process.env, timeout = 30_000 } = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    env,
    encoding: "utf8",
    shell: false,
    timeout,
  });
}

function git(root, args) {
  const result = spawnTrustedGit(root, args, { encoding: "utf8" });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function initAndStage(root) {
  git(root, ["init", "--quiet"]);
  git(root, ["add", "."]);
}

function longFunction(name, bodyLines = 105) {
  return [
    `export function ${name}(value: string) {`,
    ...Array.from({ length: bodyLines }, () => "  const nextValue = value;"),
    "  return value;",
    "}",
    "",
  ].join("\n");
}

function createTargetLocalFakeGit(root) {
  if (process.platform === "win32") {
    fs.copyFileSync(process.env.ComSpec, path.join(root, "git.exe"));
    return { env: process.env, marker: "" };
  }
  const fakeBin = path.join(root, "fake-bin");
  const marker = path.join(root, "fake-git-ran.txt");
  const fakeGit = write(
    root,
    "fake-bin/git",
    `#!/usr/bin/env sh\nprintf ran > ${JSON.stringify(marker)}\nexit 0\n`,
  );
  fs.chmodSync(fakeGit, 0o755);
  return {
    env: { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ""}` },
    marker,
  };
}

function writeMarkerCommand(root, name, marker) {
  const script = write(
    root,
    `.git-helpers/${name}.cjs`,
    `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran");\n`,
  );
  const executable = process.execPath.replaceAll("\\", "/");
  const scriptPath = script.replaceAll("\\", "/");
  return `"${executable}" "${scriptPath}"`;
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "trusted-executables-"));

try {
  const uiRoot = path.join(tmpRoot, "ui-target");
  write(
    uiRoot,
    "src/pages/中文页面.tsx",
    'export const Page = () => <div style={{ color: "#fff" }}>fixture</div>;\n',
  );
  initAndStage(uiRoot);
  const outsideFakeBin = path.join(tmpRoot, "outside-fake-bin");
  fs.mkdirSync(outsideFakeBin, { recursive: true });
  const outsideFakeGit = path.join(outsideFakeBin, process.platform === "win32" ? "git.exe" : "git");
  if (process.platform === "win32") {
    fs.copyFileSync(process.env.ComSpec, outsideFakeGit);
  } else {
    fs.writeFileSync(outsideFakeGit, "#!/usr/bin/env sh\nexit 0\n", "utf8");
    fs.chmodSync(outsideFakeGit, 0o755);
  }
  const targetFakeBin = path.join(uiRoot, "path-junction-bin");
  fs.symlinkSync(outsideFakeBin, targetFakeBin, "junction");
  const junctionEnv = {
    ...process.env,
    PATH: `${targetFakeBin}${path.delimiter}${process.env.PATH || ""}`,
  };
  assert.notEqual(
    resolveTrustedGit(uiRoot, { env: junctionEnv }),
    fs.realpathSync(outsideFakeGit),
    "target-local PATH junction resolved to the fake Git executable",
  );
  const uiFake = createTargetLocalFakeGit(uiRoot);
  const uiResult = runNode(uiChecker, [uiRoot], { cwd: uiRoot, env: junctionEnv });
  assert.equal(uiResult.status, 2, uiResult.stderr || uiResult.stdout);
  assert.match(`${uiResult.stdout}\n${uiResult.stderr}`, /中文页面\.tsx/u);
  if (uiFake.marker) assert.equal(fs.existsSync(uiFake.marker), false, "target-local fake Git was executed");

  const outsideUi = path.join(tmpRoot, "outside-ui");
  write(tmpRoot, "outside-ui/outside.tsx", 'export const Outside = () => <div style={{ color: "#000" }} />;\n');
  const uiLink = path.join(uiRoot, "src", "pages", "external-link");
  fs.symlinkSync(outsideUi, uiLink, "junction");
  const uiAllResult = runNode(uiChecker, [uiRoot, "--all"], { cwd: uiRoot });
  assert.equal(uiAllResult.status, 2, uiAllResult.stderr || uiAllResult.stdout);
  assert.match(`${uiAllResult.stdout}\n${uiAllResult.stderr}`, /external-link.*symlink/iu);

  const structuralRoot = path.join(tmpRoot, "structural-target");
  write(structuralRoot, "tsconfig.json", '{"compilerOptions":{}}\n');
  write(structuralRoot, "src/runtime/中文结构.ts", longFunction("buildChineseRuntime"));
  initAndStage(structuralRoot);
  const structuralFake = createTargetLocalFakeGit(structuralRoot);
  const structuralResult = runNode(structuralLint, [structuralRoot], {
    cwd: structuralRoot,
    env: structuralFake.env,
  });
  assert.equal(structuralResult.status, 2, structuralResult.stderr || structuralResult.stdout);
  assert.match(`${structuralResult.stdout}\n${structuralResult.stderr}`, /中文结构\.ts/u);
  if (structuralFake.marker) {
    assert.equal(fs.existsSync(structuralFake.marker), false, "structural lint executed target-local fake Git");
  }

  const releaseRoot = path.join(tmpRoot, "release-source");
  write(releaseRoot, "tools/build-lite-package.mjs", fs.readFileSync(buildLite, "utf8"));
  write(releaseRoot, "tools/trusted-git.mjs", fs.readFileSync(trustedGitSource, "utf8"));
  write(releaseRoot, "tools/verify-lite-package.mjs", fs.readFileSync(verifyLiteSource, "utf8"));
  write(releaseRoot, "tools/safe-target-fs.mjs", "export {};\n");
  write(releaseRoot, "AGENTS.md");
  write(releaseRoot, "package.json", '{"name":"fixture","private":true}\n');
  write(releaseRoot, "settings.json", "{}\n");
  write(releaseRoot, "codex-hooks.json", "{}\n");
  write(releaseRoot, "feedback/templates/feedback-index-template.md");
  write(releaseRoot, "feedback/templates/feedback-topic-template.md");
  // build-lite requires direct runtime copies to match the immutable source blobs.
  write(releaseRoot, ".claude/settings.json", "{}\n");
  write(releaseRoot, ".codex/hooks.json", "{}\n");
  write(releaseRoot, ".claude/feedback/templates/feedback-index-template.md");
  write(releaseRoot, ".claude/feedback/templates/feedback-topic-template.md");
  write(releaseRoot, "plans/CURRENT-EXECUTION.md");
  write(releaseRoot, "plans/audit-remediation-20260710.md");
  const preCommitPath = write(releaseRoot, ".githooks/pre-commit", "#!/usr/bin/env bash\n");
  fs.chmodSync(preCommitPath, 0o755);
  for (const required of REQUIRED_RELEASE_INPUTS) {
    if (!fs.existsSync(path.join(releaseRoot, required))) write(releaseRoot, required);
  }
  initAndStage(releaseRoot);
  if (process.platform === "win32") {
    git(releaseRoot, ["config", "core.filemode", "false"]);
  }
  git(releaseRoot, ["update-index", "--chmod=+x", ".githooks/pre-commit"]);
  const stagedHook = git(releaseRoot, ["ls-files", "--stage", "--", ".githooks/pre-commit"]);
  assert.match(stagedHook.stdout, /^100755 /u, "executable release fixture must retain Git mode 100755");
  const fixtureStatus = git(releaseRoot, ["status", "--porcelain", "--", ".githooks/pre-commit"]);
  assert(
    fixtureStatus.stdout.length === 0 || fixtureStatus.stdout.slice(1, 2) === " ",
    `executable release fixture must not contain a worktree mode delta: ${fixtureStatus.stdout.trim()}`,
  );
  const releaseFake = createTargetLocalFakeGit(releaseRoot);
  if (process.platform === "win32") {
    fs.copyFileSync(process.env.ComSpec, path.join(releaseRoot, "powershell.exe"));
  }
  const noZipResult = runNode(path.join(releaseRoot, "tools", "build-lite-package.mjs"), ["--no-zip"], {
    cwd: releaseRoot,
    env: releaseFake.env,
  });
  assert.equal(noZipResult.status, 0, noZipResult.stderr || noZipResult.stdout);
  assert(fs.existsSync(path.join(releaseRoot, "release", "vibe coding skills", "AGENTS.md")));
  if (releaseFake.marker) {
    assert.equal(fs.existsSync(releaseFake.marker), false, "release builder executed target-local fake Git");
  }

  if (process.platform === "win32") {
    const zipResult = runNode(path.join(releaseRoot, "tools", "build-lite-package.mjs"), [], {
      cwd: releaseRoot,
      env: releaseFake.env,
      timeout: 60_000,
    });
    assert.equal(zipResult.status, 0, zipResult.stderr || zipResult.stdout);
    assert(fs.existsSync(path.join(releaseRoot, "release", "vibe coding skills.zip")));
  }

  const configRoot = path.join(tmpRoot, "git-config-target");
  write(configRoot, "src/value.ts", "export const value = 1;\n");
  initAndStage(configRoot);

  const externalDiffMarker = path.join(configRoot, "external-diff-ran.txt");
  const externalDiffCommand = writeMarkerCommand(configRoot, "external-diff", externalDiffMarker);
  git(configRoot, ["config", "diff.external", externalDiffCommand]);
  const diffResult = spawnTrustedGit(configRoot, ["diff", "--cached", "--", "src/value.ts"], {
    encoding: "utf8",
  });
  assert.equal(diffResult.status, 0, diffResult.stderr || diffResult.stdout);
  assert.equal(fs.existsSync(externalDiffMarker), false, "trusted Git allowed target diff.external code execution");

  const fsmonitorMarker = path.join(configRoot, "fsmonitor-ran.txt");
  const fsmonitorCommand = writeMarkerCommand(configRoot, "fsmonitor", fsmonitorMarker);
  git(configRoot, ["config", "core.fsmonitor", fsmonitorCommand]);
  const statusResult = spawnTrustedGit(configRoot, ["status", "--porcelain"], { encoding: "utf8" });
  assert.equal(statusResult.status, 0, statusResult.stderr || statusResult.stdout);
  assert.equal(fs.existsSync(fsmonitorMarker), false, "trusted Git allowed target core.fsmonitor code execution");

  console.log("Trusted executable security tests passed");
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
