#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  existsSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(TOOLS_DIR);
const HEALTH_CHECK = path.join(TOOLS_DIR, "vibe-health-check.mjs");
const REMEDIATION_PACKAGE_DIRS = ["feedback", "plans", ".githooks"];
const REMEDIATION_PACKAGE_TOOLS = [
  "tools/doc-sync-helpers.sh",
  "tools/doc-sync-doc-helpers.sh",
  "tools/doc-sync-path-helpers.sh",
  "tools/doc-sync-state-helpers.sh",
  "tools/doc-sync-tier-helpers.sh",
  "tools/terminology-path-helpers.sh",
  "tools/safe-target-fs.mjs",
  "tools/trusted-git.mjs",
  "tools/test-build-lite-package.mjs",
  "tools/test-minimal-quality-gate.sh",
  "tools/test-path-security.mjs",
  "tools/test-render-project-scaffold-security.sh",
  "tools/test-scaffold-lockfiles.sh",
  "tools/test-sync-compat-safety.ps1",
  "tools/test-trusted-executables.mjs",
  "tools/test-vibe-health-check.mjs",
];

function makeTempRoot(prefix = "vibe-health-") {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(root, relativePath, content = "") {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  return target;
}

function runHealthWithEnv(root, envOverrides, timeout, ...args) {
  return spawnSync(
    process.execPath,
    [HEALTH_CHECK, root, ...args, "--json"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, VIBE_CODING_SKILLS_HOME: REPO_ROOT, ...envOverrides },
      shell: false,
      timeout,
    },
  );
}

function runHealth(root, ...args) {
  return runHealthWithEnv(root, {}, 30_000, ...args);
}

function parseReport(result) {
  assert.equal(result.error, undefined, result.error?.message);
  assert.notEqual(result.status, null, `health check timed out\n${result.stderr}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    assert.fail(`health check did not emit JSON: ${error.message}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

function createTargetManifest(root) {
  const mappings = {
    productSpec: "需求文档.md",
    devPlan: "开发计划.md",
    currentExecution: "plans/执行光标.md",
    manualAcceptance: "验收记录.md",
    interfaceContracts: "接口契约.md",
    projectProfile: "项目画像.md",
    constitutionDesign: "宪法设计.md",
  };
  for (const relativePath of Object.values(mappings)) write(root, relativePath, "fixture\n");
  write(root, ".vibe-docs.json", `${JSON.stringify(mappings, null, 2)}\n`);
  write(root, "package.json", `${JSON.stringify({ scripts: { build: "node --version" } }, null, 2)}\n`);
}

test("target checks ignore repository-local tools unless explicitly trusted", () => {
  const root = makeTempRoot();
  try {
    createTargetManifest(root);
    const marker = path.join(root, "local-tool-ran.txt");
    write(
      root,
      "tools/check-target-doc-names.mjs",
      `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran\\n");\n`,
    );

    parseReport(runHealth(root, "--profile", "target", "--level", "quick"));
    assert.throws(
      () => readFileSync(marker, "utf8"),
      /ENOENT/,
      "default target health must not execute repository-local checker code",
    );

    parseReport(runHealth(root, "--profile", "target", "--level", "quick", "--trust-target-tools"));
    assert.equal(readFileSync(marker, "utf8"), "ran\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("full target health does not execute package scripts unless explicitly trusted", () => {
  const root = makeTempRoot();
  try {
    createTargetManifest(root);
    const marker = path.join(root, "target-script-ran.txt");
    write(
      root,
      "malicious-script.mjs",
      `import { appendFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(marker)}, \`${"${process.argv[2]}"}\\n\`);\n`,
    );
    write(
      root,
      "package.json",
      `${JSON.stringify({
        scripts: {
          build: "node malicious-script.mjs build",
          test: "node malicious-script.mjs test",
          smoke: "node malicious-script.mjs smoke",
        },
      }, null, 2)}\n`,
    );

    const untrustedReport = parseReport(
      runHealth(root, "--profile", "target", "--level", "full"),
    );
    assert.equal(
      existsSync(marker),
      false,
      "default full target health executed untrusted package.json scripts",
    );
    assert.deepEqual(
      untrustedReport.results
        .filter((item) => item.id === "target-full-script" && item.status === "warn")
        .map((item) => item.message)
        .sort(),
      ["build", "smoke", "test"],
      "every skipped target script must leave an auditable warning",
    );

    parseReport(
      runHealth(root, "--profile", "target", "--level", "full", "--trust-target-tools"),
    );
    assert.deepEqual(
      readFileSync(marker, "utf8").trim().split(/\r?\n/u).sort(),
      ["build", "smoke", "test"],
      "explicit trust must enable the requested full target scripts",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("external roots cannot spoof the package profile and execute local gates", () => {
  const root = makeTempRoot();
  try {
    for (const relativePath of ["skills", "agents", "hooks", "codex-hooks", "feedback", "tools", ".githooks", ".claude", ".agents", ".codex"]) {
      mkdirSync(path.join(root, relativePath), { recursive: true });
    }
    write(root, "AGENTS.md", "fixture\n");
    write(root, "Product-Spec.md", "fixture\n");
    const marker = path.join(root, "spoofed-package-gate-ran.txt");
    write(
      root,
      "tools/check-routing-manifest.mjs",
      `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran\\n");\n`,
    );

    for (const args of [
      ["--profile", "auto", "--level", "quick"],
      ["--profile", "package", "--level", "quick"],
    ]) {
      const report = parseReport(runHealth(root, ...args));
      assert.equal(report.profile, "package");
      assert(
        report.results.some((item) => item.id === "package-trust" && item.status === "fail"),
        "external package roots must be marked untrusted",
      );
      assert.equal(existsSync(marker), false, "untrusted package-local gate code was executed");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source checkout remains trusted when runtime home points at the installed package", () => {
  const report = parseReport(
    runHealthWithEnv(
      REPO_ROOT,
      { VIBE_CODING_SKILLS_HOME: "C:\\vibe-skills" },
      30_000,
      "--profile",
      "package",
      "--level",
      "quick",
      "--strict",
    ),
  );
  assert.equal(
    report.results.some((item) => item.id === "package-trust" && item.status === "fail"),
    false,
    "the source checkout must stay trusted alongside the configured runtime package",
  );
});

test("child process arguments cannot be interpreted by a command shell", { skip: process.platform !== "win32" }, () => {
  const root = makeTempRoot("vibe-health-&echo.VIBE_HEALTH_CMD_INJECTION&-");
  try {
    createTargetManifest(root);
    const result = runHealth(root, "--profile", "target", "--level", "quick");
    assert.equal(result.stdout.trimStart().startsWith("{"), true, result.stdout);
    const report = parseReport(result);
    const details = report.results.flatMap((item) => String(item.detail || "").split(/\r?\n/u));
    assert.equal(
      details.includes("VIBE_HEALTH_CMD_INJECTION"),
      false,
      "a path metacharacter reached cmd.exe and executed an injected echo command",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Windows package health ignores arbitrary PATH bash entries", { skip: process.platform !== "win32" }, () => {
  const root = makeTempRoot("vibe-health-bash-path-");
  try {
    write(root, "tools/test-execution-tier-gates.sh", "sleep 1\n");
    const pathEntries = (process.env.PATH || "")
      .split(path.delimiter)
      .map((entry) => entry.replace(/^"|"$/g, ""))
      .filter(Boolean);
    const gitRootCandidates = [
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Git"),
      process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Git"),
      ...pathEntries.flatMap((entry) => [
        entry,
        path.dirname(entry),
        path.dirname(path.dirname(entry)),
        path.dirname(path.dirname(path.dirname(entry))),
      ]),
    ].filter(Boolean);
    const gitRoot = gitRootCandidates.find(
      (candidate) => existsSync(path.join(candidate, "mingw64", "bin", "git.exe"))
        && ["bin", "usr/bin"].some((relativePath) => existsSync(path.join(candidate, ...relativePath.split("/"), "bash.exe"))),
    );
    assert.ok(gitRoot, "test requires a Git for Windows installation with mingw64 git and Bash");

    const fakeBin = path.join(root, "fake-bin");
    mkdirSync(path.join(fakeBin, "bash.exe"), { recursive: true });
    const result = runHealthWithEnv(
      root,
      {
        VIBE_CODING_SKILLS_HOME: root,
        VIBE_HEALTH_COMMAND_TIMEOUT_MS: "100",
        PATH: [fakeBin, path.join(gitRoot, "mingw64", "bin"), ...pathEntries].join(path.delimiter),
      },
      10_000,
      "--profile",
      "package",
      "--level",
      "full",
      "--trust-target-tools",
    );
    const report = parseReport(result);
    const timeoutGate = report.results.find(
      (item) => item.id === "package-full-gate" && item.message === "tools/test-execution-tier-gates.sh",
    );
    assert(timeoutGate, "Git Bash lookup must not execute an arbitrary PATH bash entry");
    assert.equal(timeoutGate.status, "fail");
    assert.match(timeoutGate.detail, /timed out after 100ms/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("all package levels require remediation distribution inputs", () => {
  const root = makeTempRoot();
  try {
    // Deliberately omit the newly required distribution directories and formal tools.
    for (const relativePath of ["skills", "agents", "hooks", "codex-hooks", "tools", ".claude", ".agents", ".codex"]) {
      mkdirSync(path.join(root, relativePath), { recursive: true });
    }

    for (const level of ["micro", "quick", "full"]) {
      const report = parseReport(runHealth(root, "--profile", "package", "--level", level));
      assert.ok(
        report.results.some((item) => item.status === "fail" && item.message === "settings.json"),
        `${level} omitted the micro prerequisite settings.json`,
      );
      for (const relativePath of REMEDIATION_PACKAGE_DIRS) {
        assert.ok(
          report.results.some(
            (item) => item.status === "fail" && item.id === "package-dir" && item.message === relativePath,
          ),
          `${level} omitted required distribution directory ${relativePath}`,
        );
      }
      for (const relativePath of REMEDIATION_PACKAGE_TOOLS) {
        assert.ok(
          report.results.some(
            (item) => item.status === "fail" && item.id === "package-tool" && item.message === relativePath,
          ),
          `${level} omitted required remediation tool ${relativePath}`,
        );
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an invalid target package.json is a failure, not a missing-package warning", () => {
  const root = makeTempRoot();
  try {
    createTargetManifest(root);
    write(root, "package.json", "{ invalid json\n");
    const report = parseReport(runHealth(root, "--profile", "target", "--level", "micro"));
    assert.ok(
      report.results.some(
        (item) => item.status === "fail" && item.id === "target-package" && item.message === "Invalid package.json",
      ),
      JSON.stringify(report.results.filter((item) => item.id === "target-package"), null, 2),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("mirror health covers every sync-compat mapping and compares exact bytes", () => {
  const root = makeTempRoot();
  try {
    const directoryPairs = [
      ["skills", ".agents/skills"],
      ["skills", ".claude/skills"],
      ["agents", ".claude/agents"],
      ["hooks", ".claude/hooks"],
      ["feedback/templates", ".claude/feedback/templates"],
      ["codex-hooks", ".codex/hooks"],
    ];
    for (const [source, mirror] of directoryPairs) {
      mkdirSync(path.join(root, source), { recursive: true });
      mkdirSync(path.join(root, mirror), { recursive: true });
    }
    mkdirSync(path.join(root, "tools"), { recursive: true });
    mkdirSync(path.join(root, ".codex/agents"), { recursive: true });

    write(root, "skills/line-endings.txt", Buffer.from("same text\n", "utf8"));
    write(root, ".agents/skills/line-endings.txt", Buffer.from("same text\r\n", "utf8"));
    write(root, ".claude/skills/line-endings.txt", Buffer.from("same text\r\n", "utf8"));
    write(root, "feedback/templates/template.txt", "source\n");
    write(root, ".claude/feedback/templates/template.txt", "mirror\n");
    write(root, "hooks/same.sh", "same\n");
    const outsideHooks = path.join(root, "outside-hooks");
    write(root, "outside-hooks/same.sh", "same\n");
    rmSync(path.join(root, ".claude", "hooks"), { recursive: true, force: true });
    symlinkSync(outsideHooks, path.join(root, ".claude", "hooks"), "junction");

    const fileMappings = [
      ["EVOLUTION.md", ".claude/EVOLUTION.md"],
      ["settings.json", ".claude/settings.json"],
      ["codex-hooks.json", ".codex/hooks.json"],
    ];
    for (const [source, mirror] of fileMappings) {
      write(root, source, `source:${source}\n`);
      write(root, mirror, `mirror:${mirror}\n`);
    }

    const report = parseReport(runHealth(root, "--profile", "package", "--level", "quick"));
    const mirrorFailures = report.results
      .filter((item) => item.status === "fail" && item.id === "mirror-sync")
      .map((item) => item.message);

    for (const expected of [
      ".agents/skills/line-endings.txt",
      ".claude/skills/line-endings.txt",
      ".claude/feedback/templates/template.txt",
      ".claude/hooks",
      ".claude/EVOLUTION.md",
      ".claude/settings.json",
      ".codex/hooks.json",
    ]) {
      assert.ok(
        mirrorFailures.some((message) => message.includes(expected)),
        `missing exact mirror failure for ${expected}\n${mirrorFailures.join("\n")}`,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("full package health includes CI static gates but excludes installation fixtures", () => {
  const root = makeTempRoot();
  try {
    mkdirSync(path.join(root, "tools"), { recursive: true });
    const report = parseReport(
      runHealth(root, "--profile", "package", "--level", "full", "--trust-target-tools"),
    );
    const fullGates = report.results
      .filter((item) => item.id === "package-full-node-gate" || item.id === "package-full-gate")
      .map((item) => item.message);

    for (const expected of [
      "tools/test-skill-token-budget.mjs",
      "tools/check-skill-token-budget.mjs",
      "tools/test-target-runtime.mjs",
      "tools/test-routing-manifest.mjs",
      "tools/test-routing-keywords.mjs",
      "tools/test-external-skill-boundaries.mjs",
      "tools/test-spec-driven-gates.mjs",
      "tools/test-design-brief-source-contract.mjs",
      "tools/test-agent-tool-source-contract.mjs",
      "tools/test-target-lifecycle-path-contract.mjs",
      "tools/test-review-policy.mjs",
      "tools/test-strict-tdd-policy.mjs",
      "tools/test-strict-tdd-human-scenarios.mjs",
    ]) {
      assert.ok(fullGates.includes(expected), `full health omitted CI static gate ${expected}`);
    }
    assert.equal(fullGates.includes("tools/test-runtime-project-scaffold.sh"), false);
    assert.equal(fullGates.includes("tools/test-golden-path-examples.sh"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("full package health terminates a hung child gate at the configured boundary", () => {
  const root = makeTempRoot("vibe-health-timeout-");
  try {
    write(root, "tools/test-api-contracts.mjs", "setInterval(() => {}, 1_000);\n");
    const result = runHealthWithEnv(
      root,
      { VIBE_HEALTH_COMMAND_TIMEOUT_MS: "100" },
      10_000,
      "--profile",
      "package",
      "--level",
      "full",
      "--trust-target-tools",
    );
    const report = parseReport(result);
    const timeoutGate = report.results.find(
      (item) => item.id === "package-full-node-gate" && item.message === "tools/test-api-contracts.mjs",
    );
    assert(timeoutGate, "hung full gate result is missing");
    assert.equal(timeoutGate.status, "fail");
    assert.match(timeoutGate.detail, /timed out after 100ms/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
    assert(!existsSync(root), `temporary timeout fixture was not removed: ${root}`);
  }
});

test("execution-tier shell gate honors an explicit health timeout override", () => {
  const root = makeTempRoot("vibe-health-execution-tier-timeout-");
  try {
    write(root, "tools/test-execution-tier-gates.sh", "sleep 1\n");
    const result = runHealthWithEnv(
      root,
      { VIBE_CODING_SKILLS_HOME: root, VIBE_HEALTH_COMMAND_TIMEOUT_MS: "100" },
      10_000,
      "--profile",
      "package",
      "--level",
      "full",
      "--trust-target-tools",
    );
    const report = parseReport(result);
    const timeoutGate = report.results.find(
      (item) => item.id === "package-full-gate" && item.message === "tools/test-execution-tier-gates.sh",
    );
    assert(timeoutGate, "execution-tier shell gate result is missing");
    assert.equal(timeoutGate.status, "fail");
    assert.match(timeoutGate.detail, /timed out after 100ms/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
    assert(!existsSync(root), `temporary execution-tier timeout fixture was not removed: ${root}`);
  }
});
