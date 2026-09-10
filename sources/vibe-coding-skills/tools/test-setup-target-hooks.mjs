#!/usr/bin/env node
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(toolsDir);
const installer = path.join(toolsDir, "setup-target-hooks.mjs");

function git(root, args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

function runInstaller(root, ...extra) {
  return spawnSync(process.execPath, [installer, root, "--json", ...extra], { encoding: "utf8" });
}

const helpResult = spawnSync(process.execPath, [installer, "--help"], { encoding: "utf8" });
assert.equal(helpResult.status, 0, helpResult.stderr || helpResult.stdout);
assert.match(helpResult.stderr, /--precommit-only/u);

function makeRepo(prefix) {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  assert.equal(git(root, ["init", "--quiet"]).status, 0);
  return root;
}

function bashExecutable() {
  const candidates = process.platform === "win32"
    ? [process.env.VIBE_GATE_BASH, "D:/Git/bin/bash.exe", "C:/Program Files/Git/bin/bash.exe"]
    : ["bash"];
  return candidates.find((candidate) => candidate && (candidate === "bash" || existsSync(candidate)));
}

const ancestorRoot = makeRepo("target-hooks-ancestor-");
try {
  const child = path.join(ancestorRoot, "child-target");
  mkdirSync(child, { recursive: true });
  const result = runInstaller(child);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.equal(existsSync(path.join(child, ".githooks", "pre-commit")), false);
  assert.notEqual(git(ancestorRoot, ["config", "--local", "--get", "core.hooksPath"]).stdout.trim(), ".githooks");
} finally {
  rmSync(ancestorRoot, { recursive: true, force: true });
}

const configFailureRoot = makeRepo("target-hooks-config-failure-");
try {
  writeFileSync(path.join(configFailureRoot, ".git", "config.lock"), "locked\n");
  const result = runInstaller(configFailureRoot);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.match(report.conflict, /core\.hooksPath/u);
  assert.equal(existsSync(path.join(configFailureRoot, ".githooks", "pre-commit")), false, "Git 配置失败必须回滚文件写入");
  assert.equal(existsSync(path.join(configFailureRoot, "tools", "check-hotspots.mjs")), false, "Git 配置失败不得留下部分工具");
} finally {
  rmSync(configFailureRoot, { recursive: true, force: true });
}

const lateConflictRoot = makeRepo("target-hooks-late-conflict-");
try {
  mkdirSync(path.join(lateConflictRoot, ".codex"), { recursive: true });
  writeFileSync(path.join(lateConflictRoot, ".codex", "hooks.json"), "{ invalid json\n");
  const result = runInstaller(lateConflictRoot);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.equal(existsSync(path.join(lateConflictRoot, ".githooks", "pre-commit")), false);
  assert.equal(existsSync(path.join(lateConflictRoot, "tools", "check-hotspots.mjs")), false);
  assert.equal(existsSync(path.join(lateConflictRoot, ".claude", "settings.json")), false);
  assert.equal(readFileSync(path.join(lateConflictRoot, ".codex", "hooks.json"), "utf8"), "{ invalid json\n");
} finally {
  rmSync(lateConflictRoot, { recursive: true, force: true });
}

const duplicateConfigRoot = makeRepo("target-hooks-duplicate-config-");
try {
  mkdirSync(path.join(duplicateConfigRoot, ".claude"), { recursive: true });
  const duplicate = { hooks: { PostToolUse: [
    { matcher: "Edit|Write", hooks: [{ type: "command", command: "auto-sync-target-doc-index one" }] },
    { matcher: "Edit|Write", hooks: [{ type: "command", command: "auto-sync-target-doc-index two" }] },
  ] } };
  writeFileSync(path.join(duplicateConfigRoot, ".claude", "settings.json"), JSON.stringify(duplicate));
  const result = runInstaller(duplicateConfigRoot);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.equal(existsSync(path.join(duplicateConfigRoot, ".githooks", "pre-commit")), false);
} finally {
  rmSync(duplicateConfigRoot, { recursive: true, force: true });
}

const duplicateMarkerRoot = makeRepo("target-hooks-duplicate-marker-");
try {
  mkdirSync(path.join(duplicateMarkerRoot, ".githooks"), { recursive: true });
  writeFileSync(path.join(duplicateMarkerRoot, ".githooks", "pre-commit"), "#!/bin/sh\n# vibe-coding-skills:runtime-sync-hook:start\na\n# vibe-coding-skills:runtime-sync-hook:end\n# vibe-coding-skills:runtime-sync-hook:start\nb\n# vibe-coding-skills:runtime-sync-hook:end\n");
  const result = runInstaller(duplicateMarkerRoot);
  assert.equal(result.status, 1, result.stderr || result.stdout);
} finally {
  rmSync(duplicateMarkerRoot, { recursive: true, force: true });
}

const runtimeOnlyRoot = makeRepo("target-hooks-runtime-only-");
try {
  const customTool = path.join(runtimeOnlyRoot, "tools", "check-hotspots.mjs");
  mkdirSync(path.dirname(customTool), { recursive: true });
  writeFileSync(customTool, "// 项目自定义热点检查器\n");
  const result = runInstaller(runtimeOnlyRoot, "--runtime-hooks-only");
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.match(report.actions.join("\n"), /Git pre-commit configuration unchanged/u);
  assert.doesNotMatch(report.actions.join("\n"), /not a git repo/u);
  assert.equal(readFileSync(customTool, "utf8"), "// 项目自定义热点检查器\n");
  assert.equal(existsSync(path.join(runtimeOnlyRoot, ".githooks", "pre-commit")), false);
  assert.equal(existsSync(path.join(runtimeOnlyRoot, ".claude", "hooks", "detect-feedback-signal.sh")), true);
  assert.equal(existsSync(path.join(runtimeOnlyRoot, ".codex", "hooks", "detect-feedback-signal.ps1")), true);
  assert.equal(existsSync(path.join(runtimeOnlyRoot, ".claude", "hooks", "check-routing-session.sh")), true);
  assert.equal(existsSync(path.join(runtimeOnlyRoot, ".codex", "hooks", "check-routing-session.ps1")), true);
  assert.match(readFileSync(path.join(runtimeOnlyRoot, ".claude", "settings.json"), "utf8"), /UserPromptSubmit/u);
  assert.match(readFileSync(path.join(runtimeOnlyRoot, ".codex", "hooks.json"), "utf8"), /UserPromptSubmit/u);
  assert.notEqual(git(runtimeOnlyRoot, ["config", "--local", "--get", "core.hooksPath"]).stdout.trim(), ".githooks");
} finally {
  rmSync(runtimeOnlyRoot, { recursive: true, force: true });
}

const upgradeRoot = makeRepo("target-hooks-upgrade-");
try {
  const targetTools = path.join(upgradeRoot, "tools");
  mkdirSync(targetTools, { recursive: true });
  writeFileSync(
    path.join(targetTools, "check-hotspots.mjs"),
    "// Scans target projects for large-file and high-coupling hotspot signals.\n// stale checker\n",
  );
  const result = runInstaller(upgradeRoot);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  for (const name of ["check-hotspots.mjs", "hotspot-policy.mjs", "hotspot-git.mjs", "trusted-git.mjs"]) {
    assert.equal(
      readFileSync(path.join(targetTools, name), "utf8"),
      readFileSync(path.join(toolsDir, name), "utf8"),
      `${name} must be synchronized from the current skills package`,
    );
  }
  const hook = readFileSync(path.join(upgradeRoot, ".githooks", "pre-commit"), "utf8");
  assert.doesNotMatch(hook, /ROOT=\$\(git\s+rev-parse/u, "the generated hook must not resolve Git from ambient PATH");
  assert.match(hook, /GIT_EXECUTABLE=/u, "the generated hook must use an installer-resolved Git executable");
  assert.match(hook, /check-target-doc-precommit\.mjs/u, "the generated hook must enforce target document freshness");
  const normalObservedRoot = path.join(upgradeRoot, "normal-observed-root.txt");
  writeFileSync(
    path.join(upgradeRoot, "tools", "check-hotspots.mjs"),
    `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(normalObservedRoot)}, process.argv[2]);\n`,
  );
  writeFileSync(path.join(upgradeRoot, "normal-change.txt"), "change\n");
  assert.equal(git(upgradeRoot, ["add", "tools/check-hotspots.mjs", "normal-change.txt"]).status, 0);
  const normalCommit = git(upgradeRoot, ["-c", "user.name=Target Hooks Test", "-c", "user.email=target-hooks@example.test", "commit", "--quiet", "-m", "normal worktree hook root"]);
  assert.equal(normalCommit.status, 0, normalCommit.stderr || normalCommit.stdout);
  assert.equal(path.normalize(readFileSync(normalObservedRoot, "utf8")), path.normalize(upgradeRoot), "pre-commit must pass a normal worktree root to its checker");
  const bash = bashExecutable();
  assert.ok(bash, "找不到可执行 Git Bash");
  const unavailableGitHook = spawnSync(bash, ["-c", "git() { return 1; }; . \"$1\"", "test", path.join(upgradeRoot, ".githooks", "pre-commit")], {
    cwd: upgradeRoot,
    encoding: "utf8",
  });
  assert.equal(unavailableGitHook.status, 0, unavailableGitHook.stderr || unavailableGitHook.stdout);
  const failingTrustedHook = path.join(upgradeRoot, ".githooks", "pre-commit-failing-git");
  writeFileSync(failingTrustedHook, hook.replace(/^GIT_EXECUTABLE=.*$/mu, "GIT_EXECUTABLE='/bin/false'"));
  const failingTrustedGit = spawnSync(bash, [failingTrustedHook], { cwd: upgradeRoot, encoding: "utf8" });
  assert.equal(failingTrustedGit.status, 2, failingTrustedGit.stderr || failingTrustedGit.stdout);
  assert.match(failingTrustedGit.stderr, /cannot resolve the current Git worktree root/u);
  assert.equal(existsSync(path.join(upgradeRoot, ".claude", "hooks", "auto-sync-target-doc-index.sh")), true);
  assert.equal(existsSync(path.join(upgradeRoot, ".codex", "hooks", "auto-sync-target-doc-index.ps1")), true);
  assert.equal(existsSync(path.join(upgradeRoot, ".claude", "hooks", "detect-feedback-signal.sh")), true);
  assert.equal(existsSync(path.join(upgradeRoot, ".codex", "hooks", "detect-feedback-signal.ps1")), true);
  assert.equal(existsSync(path.join(upgradeRoot, ".claude", "hooks", "check-routing-session.sh")), true);
  assert.equal(existsSync(path.join(upgradeRoot, ".codex", "hooks", "check-routing-session.ps1")), true);
  const claudeHook = readFileSync(path.join(upgradeRoot, ".claude", "hooks", "auto-sync-target-doc-index.sh"), "utf8");
  const codexHook = readFileSync(path.join(upgradeRoot, ".codex", "hooks", "auto-sync-target-doc-index.ps1"), "utf8");
  assert.doesNotMatch(claudeHook, /CLAUDE_PROJECT_DIR/u, "Claude auto-sync must locate manifest root from hook payload");
  assert.doesNotMatch(codexHook, /Join-Path \$root '\.git'/u, "Codex auto-sync must work before Git initialization");
  assert.match(codexHook, /hook input is required/u, "Codex blank hook input must fail closed");
  const claudeConfig = readFileSync(path.join(upgradeRoot, ".claude", "settings.json"), "utf8");
  const codexConfig = readFileSync(path.join(upgradeRoot, ".codex", "hooks.json"), "utf8");
  assert.match(claudeConfig, /auto-sync-target-doc-index/u);
  assert.match(claudeConfig, /UserPromptSubmit/u);
  assert.match(claudeConfig, /detect-feedback-signal/u);
  assert.match(claudeConfig, /check-routing-session/u);
  assert.match(codexConfig, /auto-sync-target-doc-index/u);
  assert.match(codexConfig, /UserPromptSubmit/u);
  assert.match(codexConfig, /detect-feedback-signal/u);
  assert.match(codexConfig, /check-routing-session/u);
  assert.match(codexConfig, /ReadToEnd/u);
  assert.match(codexConfig, /InputEncoding/u);
  assert.match(codexConfig, /-HookInput/u);
  assert.match(codexConfig, /Join-Path \$root/u);
  writeFileSync(
    path.join(upgradeRoot, "tools", "detect-experience-signal.mjs"),
    "process.stdout.write(JSON.stringify({ shadowed: true }) + '\\n');\n",
  );
  mkdirSync(path.join(upgradeRoot, "codex-hooks"), { recursive: true });
  writeFileSync(path.join(upgradeRoot, "codex-hooks", "shared.ps1"), "throw 'shadowed target runtime'\n");
  const signalInput = JSON.stringify({
    prompt: "这个坑又踩了",
    scope: "target-project",
    eventId: "EVT-0123456789abcdef01234567",
    occurredAt: "2026-07-26T00:00:00.000Z",
  });
  const signalEnv = { ...process.env, VIBE_CODING_SKILLS_HOME: repoRoot };
  assert.ok(bash, "找不到可执行 Git Bash");
  const claudeSignal = spawnSync(bash, [path.join(upgradeRoot, ".claude", "hooks", "detect-feedback-signal.sh")], {
    encoding: "utf8",
    input: signalInput,
    env: signalEnv,
  });
  assert.equal(claudeSignal.status, 0, claudeSignal.stderr || claudeSignal.stdout);
  assert.equal(JSON.parse(claudeSignal.stdout).signal.disposition, "record");
  assert.equal(JSON.parse(claudeSignal.stdout).shadowed, undefined, "VIBE_CODING_SKILLS_HOME must win over a target-project shadow tool");
  if (process.platform === "win32") {
    const codexHook = path.join(upgradeRoot, ".codex", "hooks", "detect-feedback-signal.ps1");
    const codexSignal = spawnSync("powershell", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-Command",
      "$utf8=New-Object System.Text.UTF8Encoding($false); [Console]::InputEncoding=$utf8; $payload=[Console]::In.ReadToEnd(); & $env:VIBE_TEST_HOOK -HookInput $payload; exit $LASTEXITCODE",
    ], { encoding: "utf8", input: signalInput, env: { ...signalEnv, VIBE_TEST_HOOK: codexHook } });
    assert.equal(codexSignal.status, 0, codexSignal.stderr || codexSignal.stdout);
    assert.equal(JSON.parse(codexSignal.stdout).hookSpecificOutput.signal.disposition, "record");
    assert.equal(JSON.parse(codexSignal.stdout).shadowed, undefined, "Codex must not load a target-project shadow runtime");
  }
  assert.equal(git(upgradeRoot, ["config", "--local", "--get", "core.hooksPath"]).stdout.trim(), ".githooks");
} finally {
  rmSync(upgradeRoot, { recursive: true, force: true });
}

const preserveRoot = makeRepo("target-hooks-preserve-");
try {
  mkdirSync(path.join(preserveRoot, ".githooks"), { recursive: true });
  writeFileSync(
    path.join(preserveRoot, ".githooks", "pre-commit"),
    "#!/bin/sh\n# vibe-coding-skills:runtime-sync-hook:start\necho old-managed\n# vibe-coding-skills:runtime-sync-hook:end\n\n# 项目自定义门禁\necho keep-me\n",
  );
  const result = runInstaller(preserveRoot);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const hook = readFileSync(path.join(preserveRoot, ".githooks", "pre-commit"), "utf8");
  assert.match(hook, /check-target-doc-precommit\.mjs/u);
  assert.match(hook, /# 项目自定义门禁\necho keep-me/u, "升级受管 hook 时必须保留项目自定义逻辑");
} finally {
  rmSync(preserveRoot, { recursive: true, force: true });
}

const precommitOnlyRoot = makeRepo("target-hooks-precommit-only-");
try {
  const customTool = path.join(precommitOnlyRoot, "tools", "check-hotspots.mjs");
  const hookPath = path.join(precommitOnlyRoot, ".githooks", "pre-commit");
  const claudeSettings = path.join(precommitOnlyRoot, ".claude", "settings.json");
  const codexHooks = path.join(precommitOnlyRoot, ".codex", "hooks.json");
  mkdirSync(path.dirname(customTool), { recursive: true });
  mkdirSync(path.dirname(hookPath), { recursive: true });
  mkdirSync(path.dirname(claudeSettings), { recursive: true });
  mkdirSync(path.dirname(codexHooks), { recursive: true });
  writeFileSync(customTool, "// 项目自定义热点检查器，不受安装器管理。\n");
  writeFileSync(
    hookPath,
    "#!/bin/sh\n# 项目自定义门禁（开始）\necho before\n# vibe-coding-skills:runtime-sync-hook:start\necho stale-managed\n# vibe-coding-skills:runtime-sync-hook:end\n# 项目自定义门禁（结束）\necho after\n",
  );
  writeFileSync(claudeSettings, "{\"custom\":\"claude\"}\n");
  writeFileSync(codexHooks, "{\"custom\":\"codex\"}\n");
  const checkerBefore = readFileSync(customTool);
  const claudeBefore = readFileSync(claudeSettings);
  const codexBefore = readFileSync(codexHooks);

  const incompatible = runInstaller(precommitOnlyRoot, "--precommit-only", "--runtime-hooks-only");
  assert.equal(incompatible.status, 2, incompatible.stderr || incompatible.stdout);
  assert.match(JSON.parse(incompatible.stdout).error, /cannot be used together/u);
  const result = runInstaller(precommitOnlyRoot, "--precommit-only");
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  const hook = readFileSync(hookPath, "utf8");
  assert.match(hook, /check-target-doc-precommit\.mjs/u);
  assert.match(hook, /# 项目自定义门禁（开始）\necho before/u);
  assert.match(hook, /# 项目自定义门禁（结束）\necho after/u);
  assert.deepEqual(readFileSync(customTool), checkerBefore, "pre-commit-only 不得改写项目自定义 checker");
  assert.deepEqual(readFileSync(claudeSettings), claudeBefore, "pre-commit-only 不得改写 Claude runtime 配置");
  assert.deepEqual(readFileSync(codexHooks), codexBefore, "pre-commit-only 不得改写 Codex runtime 配置");
  assert.equal(existsSync(path.join(precommitOnlyRoot, ".claude", "hooks", "auto-sync-target-doc-index.sh")), false);
  assert.equal(existsSync(path.join(precommitOnlyRoot, ".codex", "hooks", "auto-sync-target-doc-index.ps1")), false);
  assert.equal(git(precommitOnlyRoot, ["config", "--local", "--get", "core.hooksPath"]).stdout.trim(), ".githooks");
} finally {
  rmSync(precommitOnlyRoot, { recursive: true, force: true });
}

const precommitOnlyLinkedRoot = makeRepo("target-hooks-precommit-only-linked-");
try {
  writeFileSync(path.join(precommitOnlyLinkedRoot, "README.md"), "base\n");
  assert.equal(git(precommitOnlyLinkedRoot, ["add", "README.md"]).status, 0);
  assert.equal(git(precommitOnlyLinkedRoot, ["-c", "user.name=Target Hooks Test", "-c", "user.email=target-hooks@example.test", "commit", "--quiet", "-m", "base"]).status, 0);
  const linkedWorktree = path.join(precommitOnlyLinkedRoot, "precommit-only linked");
  assert.equal(git(precommitOnlyLinkedRoot, ["worktree", "add", "--detach", linkedWorktree, "HEAD"]).status, 0);
  try {
    const customTool = path.join(linkedWorktree, "tools", "check-hotspots.mjs");
    const hookPath = path.join(linkedWorktree, ".githooks", "pre-commit");
    const observedRoot = path.join(linkedWorktree, "precommit-only-observed-root.txt");
    mkdirSync(path.dirname(customTool), { recursive: true });
    mkdirSync(path.dirname(hookPath), { recursive: true });
    writeFileSync(customTool, `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(observedRoot)}, process.argv[2]);\n`);
    writeFileSync(hookPath, "#!/bin/sh\n# linked custom before\n# vibe-coding-skills:runtime-sync-hook:start\nstale\n# vibe-coding-skills:runtime-sync-hook:end\n# linked custom after\n");
    const checkerBefore = readFileSync(customTool);
    const result = runInstaller(linkedWorktree, "--precommit-only");
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const hook = readFileSync(hookPath, "utf8");
    assert.match(hook, /check-target-doc-precommit\.mjs/u);
    assert.match(hook, /# linked custom before/u);
    assert.match(hook, /# linked custom after/u);
    assert.deepEqual(readFileSync(customTool), checkerBefore, "linked worktree 的自定义 checker 必须保持字节不变");
    assert.equal(git(linkedWorktree, ["config", "--local", "--get", "core.hooksPath"]).stdout.trim(), ".githooks");
    writeFileSync(path.join(linkedWorktree, "precommit-only-change.txt"), "change\n");
    assert.equal(git(linkedWorktree, ["add", "tools/check-hotspots.mjs", "precommit-only-change.txt"]).status, 0);
    const commit = git(linkedWorktree, ["-c", "user.name=Target Hooks Test", "-c", "user.email=target-hooks@example.test", "commit", "--quiet", "-m", "precommit only linked worktree hook root"]);
    assert.equal(commit.status, 0, commit.stderr || commit.stdout);
    assert.equal(path.normalize(readFileSync(observedRoot, "utf8")), path.normalize(linkedWorktree), "pre-commit-only 必须将 linked worktree 根目录传给项目 checker");
  } finally {
    assert.equal(git(precommitOnlyLinkedRoot, ["worktree", "remove", "--force", linkedWorktree]).status, 0);
  }
} finally {
  rmSync(precommitOnlyLinkedRoot, { recursive: true, force: true });
}

const precommitOnlyMissingHookRoot = makeRepo("target-hooks-precommit-only-missing-");
try {
  assert.equal(git(precommitOnlyMissingHookRoot, ["config", "--local", "core.hooksPath", "custom-hooks"]).status, 0);
  const result = runInstaller(precommitOnlyMissingHookRoot, "--precommit-only");
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.match(report.conflict, /only refreshes an existing managed pre-commit/u);
  assert.equal(existsSync(path.join(precommitOnlyMissingHookRoot, ".githooks", "pre-commit")), false);
  assert.equal(git(precommitOnlyMissingHookRoot, ["config", "--local", "--get", "core.hooksPath"]).stdout.trim(), "custom-hooks");
} finally {
  rmSync(precommitOnlyMissingHookRoot, { recursive: true, force: true });
}

const precommitOnlyMissingHookLinkedRoot = makeRepo("target-hooks-precommit-only-missing-linked-");
try {
  writeFileSync(path.join(precommitOnlyMissingHookLinkedRoot, "README.md"), "base\n");
  assert.equal(git(precommitOnlyMissingHookLinkedRoot, ["add", "README.md"]).status, 0);
  assert.equal(git(precommitOnlyMissingHookLinkedRoot, ["-c", "user.name=Target Hooks Test", "-c", "user.email=target-hooks@example.test", "commit", "--quiet", "-m", "base"]).status, 0);
  const linkedWorktree = path.join(precommitOnlyMissingHookLinkedRoot, "missing hook linked");
  assert.equal(git(precommitOnlyMissingHookLinkedRoot, ["worktree", "add", "--detach", linkedWorktree, "HEAD"]).status, 0);
  try {
    assert.equal(git(linkedWorktree, ["config", "--local", "core.hooksPath", "custom-hooks"]).status, 0);
    const result = runInstaller(linkedWorktree, "--precommit-only");
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert.match(report.conflict, /only refreshes an existing managed pre-commit/u);
    assert.equal(existsSync(path.join(linkedWorktree, ".githooks", "pre-commit")), false);
    assert.equal(git(linkedWorktree, ["config", "--local", "--get", "core.hooksPath"]).stdout.trim(), "custom-hooks");
  } finally {
    assert.equal(git(precommitOnlyMissingHookLinkedRoot, ["worktree", "remove", "--force", linkedWorktree]).status, 0);
  }
} finally {
  rmSync(precommitOnlyMissingHookLinkedRoot, { recursive: true, force: true });
}

const linkedWorktreeRoot = makeRepo("target-hooks-linked-worktree-");
try {
  writeFileSync(path.join(linkedWorktreeRoot, "README.md"), "base\n");
  assert.equal(git(linkedWorktreeRoot, ["add", "README.md"]).status, 0);
  assert.equal(git(linkedWorktreeRoot, ["-c", "user.name=Target Hooks Test", "-c", "user.email=target-hooks@example.test", "commit", "--quiet", "-m", "base"]).status, 0);
  const installResult = runInstaller(linkedWorktreeRoot);
  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);
  assert.equal(git(linkedWorktreeRoot, ["add", "--all"]).status, 0);
  const installTree = git(linkedWorktreeRoot, ["write-tree"]);
  assert.equal(installTree.status, 0, installTree.stderr || installTree.stdout);
  const installCommit = git(linkedWorktreeRoot, ["-c", "user.name=Target Hooks Test", "-c", "user.email=target-hooks@example.test", "commit-tree", installTree.stdout.trim(), "-p", "HEAD", "-m", "install hooks"]);
  assert.equal(installCommit.status, 0, installCommit.stderr || installCommit.stdout);
  assert.equal(git(linkedWorktreeRoot, ["update-ref", "HEAD", installCommit.stdout.trim()]).status, 0);
  assert.equal(git(linkedWorktreeRoot, ["config", "--local", "core.hooksPath", path.join(linkedWorktreeRoot, ".githooks")]).status, 0);

  const linkedWorktree = path.join(linkedWorktreeRoot, "linked worktree");
  assert.equal(git(linkedWorktreeRoot, ["worktree", "add", "--detach", linkedWorktree, "HEAD"]).status, 0);
  try {
    const observedRoot = path.join(linkedWorktree, "observed-root.txt");
    const recordingChecker = `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(observedRoot)}, process.argv[2]);\n`;
    writeFileSync(path.join(linkedWorktreeRoot, "tools", "check-hotspots.mjs"), recordingChecker);
    writeFileSync(path.join(linkedWorktree, "tools", "check-hotspots.mjs"), recordingChecker);
    writeFileSync(path.join(linkedWorktree, "linked-change.txt"), "change\n");
    assert.equal(git(linkedWorktree, ["add", "tools/check-hotspots.mjs", "linked-change.txt"]).status, 0);
    const linkedCommit = git(linkedWorktree, ["-c", "user.name=Target Hooks Test", "-c", "user.email=target-hooks@example.test", "commit", "--quiet", "-m", "linked worktree hook root"]);
    assert.equal(linkedCommit.status, 0, linkedCommit.stderr || linkedCommit.stdout);
    assert.equal(path.normalize(readFileSync(observedRoot, "utf8")), path.normalize(linkedWorktree), "pre-commit must pass the current linked worktree root to its checker");
  } finally {
    assert.equal(git(linkedWorktreeRoot, ["worktree", "remove", "--force", linkedWorktree]).status, 0);
  }
} finally {
  rmSync(linkedWorktreeRoot, { recursive: true, force: true });
}

if (process.platform === "win32") {
  const localGitRoot = makeRepo("target-hooks-local-git-");
  try {
    const fakeGit = path.join(localGitRoot, "git.exe");
    copyFileSync(process.env.ComSpec, fakeGit);
    const result = runInstaller(localGitRoot);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    rmSync(fakeGit, { force: true });
    assert.equal(git(localGitRoot, ["config", "--local", "--get", "core.hooksPath"]).stdout.trim(), ".githooks");
  } finally {
    rmSync(localGitRoot, { recursive: true, force: true });
  }
}

console.log("Target hook setup tests passed");
