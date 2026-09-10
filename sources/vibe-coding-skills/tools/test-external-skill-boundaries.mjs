#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);

try {
  if (JSON.parse(fs.readFileSync(path.join(repoRoot, "MANIFEST.json"), "utf8")).profile === "pure") {
    console.log("[SKIP] external-skill source boundary contract is not part of the pure runtime package");
    process.exit(0);
  }
} catch {
  // Source worktrees do not have a package manifest; run the full contract there.
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(relativePath, ...needles) {
  const text = read(relativePath);
  for (const needle of needles) {
    assert(
      text.includes(needle),
      `${relativePath} should mention ${JSON.stringify(needle)} for external skill boundary rules`,
    );
  }
}

function assertNotIncludes(relativePath, ...needles) {
  const text = read(relativePath);
  for (const needle of needles) {
    assert(!text.includes(needle), `${relativePath} should not mention ${JSON.stringify(needle)}`);
  }
}

function assertTypesetZoomGuidance() {
  const text = read("skills/typeset/SKILL.md");
  const neverSection = text.match(/\*\*NEVER\*\*:([\s\S]*?)(?=\n## )/u)?.[1];
  assert(neverSection, "typeset should define a NEVER guidance section");
  assert.equal(
    [...text.matchAll(/user-scalable=no/gu)].length,
    1,
    "typeset should mention user-scalable=no exactly once",
  );
  assert(
    neverSection.includes("- Disable browser zoom (`user-scalable=no`)"),
    "typeset should forbid disabling browser zoom rather than recommend it",
  );
  assert(text.includes("Is it zoomable to 200%?"), "typeset should preserve zoom accessibility verification");
}

assertTypesetZoomGuidance();

function readWorkflowJob(jobName, workflowText = read(".github/workflows/vibe-quality.yml")) {
  const lines = workflowText.replace(/\r\n/g, "\n").split("\n");
  const marker = `  ${jobName}:`;
  const matchingIndexes = lines.flatMap((line, index) => (line === marker ? [index] : []));
  assert.equal(matchingIndexes.length, 1, `workflow should define ${jobName} exactly once`);
  const start = matchingIndexes[0];
  const nextJob = lines.findIndex((line, index) => index > start && /^ {2}[A-Za-z0-9_-]+:$/u.test(line));
  return lines.slice(start + 1, nextJob === -1 ? undefined : nextJob).join("\n");
}

const windowsBashStepName = "Run Windows Git Bash scaffold and golden path tests";
const windowsBashStep = [
  `      - name: ${windowsBashStepName}`,
  "        shell: bash",
  "        run: |",
  "          bash tools/test-runtime-project-scaffold.sh",
  "          bash tools/test-golden-path-examples.sh",
].join("\n");

const windowsPowerShellNeedles = [
  "shell: pwsh",
  "powershell -NoProfile -ExecutionPolicy Bypass -File .\\tools\\test-sync-compat-safety.ps1",
];

function readNamedWorkflowStep(job, stepName) {
  const lines = job.split("\n");
  const marker = `      - name: ${stepName}`;
  const matchingIndexes = lines.flatMap((line, index) => (line === marker ? [index] : []));
  if (matchingIndexes.length !== 1) return null;
  const start = matchingIndexes[0];
  const nextStep = lines.findIndex((line, index) => index > start && line.startsWith("      - "));
  return lines.slice(start, nextStep === -1 ? undefined : nextStep).join("\n").trimEnd();
}

function hasForbiddenWindowsJobControl(job) {
  return /^ {4}(?:if|continue-on-error|["'](?:if|continue-on-error)["'])\s*:/mu.test(job);
}

function windowsCiContractSatisfied(job) {
  return (
    readNamedWorkflowStep(job, windowsBashStepName) === windowsBashStep
    && windowsPowerShellNeedles.every((needle) => job.includes(needle))
    && !hasForbiddenWindowsJobControl(job)
  );
}

function assertWindowsCiContract(jobName, workflowText = read(".github/workflows/vibe-quality.yml")) {
  assert(
    windowsCiContractSatisfied(readWorkflowJob(jobName, workflowText)),
    `${jobName} should preserve the Windows CI contract`,
  );
}

const boundaryDocs = [
  "AGENTS.md",
  ".claude/CLAUDE.md",
  "skills/INDEX.md",
  "skills/beginner-flow-guide/references/route-matrix.md",
  "docs/runtime-loading-policy.md",
  "README.md",
  "Product-Spec.md",
  "DEV-PLAN.md",
];

const dependencyAuthorizationDocs = [
  "skills/dev-builder/SKILL.md",
  "skills/release-builder/SKILL.md",
  "skills/test-automation/SKILL.md",
  "skills/ui-styling/SKILL.md",
  "skills/critique/SKILL.md",
  "skills/design-system/SKILL.md",
  "skills/skill-builder/templates/skill-template.md",
];

for (const file of dependencyAuthorizationDocs) {
  assertIncludes(
    file,
    "新增依赖前先检查标准库、平台自带能力和项目已安装依赖",
    "说明缺口",
    "等待用户明确同意后才能安装",
  );
  assertNotIncludes(file, "Agent 自主安装", "自主判断安装方式并直接安装");
}

assertNotIncludes("skills/critique/SKILL.md", "Bash(npx impeccable", "npx impeccable");
assertIncludes("skills/critique/SKILL.md", "node_modules/impeccable", "npm exec --offline -- impeccable");
assertIncludes("skills/ui-styling/SKILL.md", "以下安装命令只有在用户明确同意后才能执行");

for (const file of [
  "skills/design-system/references/tailwind-integration.md",
  "skills/ui-styling/references/shadcn-accessibility.md",
  "skills/ui-styling/references/shadcn-components.md",
  "skills/ui-styling/references/shadcn-theming.md",
  "skills/ui-styling/references/tailwind-customization.md",
]) {
  assertIncludes(file, "用户明确同意后");
}
assertNotIncludes("skills/design-system/references/tailwind-integration.md", "npx shadcn@latest");

for (const file of boundaryDocs) {
  assertIncludes(
    file,
    "外部强规划 Skill",
    "`superpowers:brainstorming`",
    "显式点名",
    "已批准计划",
    "T0/T1 快车道",
  );
}

for (const file of ["AGENTS.md", ".claude/CLAUDE.md"]) {
  assertIncludes(
    file,
    "除非验证同步漂移",
    "`skills/`",
    "`.agents/skills/`",
    "`.claude/skills/`",
    "UI 精修、复刻、image-to-code",
    "不得伪装成真实业务完成",
  );
}
assertIncludes(
  ".claude/CLAUDE.md",
  "placeholder / mock / disabled / noop / TODO / 静态状态",
  "说明占位范围",
);

assertIncludes(
  "skills/beginner-flow-guide/references/route-matrix.md",
  "用 superpowers:brainstorming",
  "按这个计划执行修复",
  "`dev-builder` / 当前计划执行链",
  "这个报错了",
  "`bug-fixer`",
  "补 Playwright 测试",
  "`test-automation`",
  "改 README 这一句",
  "T0/T1 快车道",
);

assertIncludes(
  "skills/INDEX.md",
  "`product-spec-builder -> design-brief-builder -> design-maker -> dev-planner / dev-builder`",
  "`superpowers:brainstorming` 不能替代本包默认产品 / 设计 / 开发主链路",
);

assertIncludes(
  ".github/workflows/vibe-quality.yml",
  "node tools/test-external-skill-boundaries.mjs",
  "permissions:",
  "contents: read",
  "ubuntu-24.04",
  "windows-2022",
  "node tools/test-target-constitution.mjs",
  "node tools/test-target-guardrails.mjs",
  "node tools/test-hotspots.mjs",
  "tools/test-vibe-health-check.mjs",
  "tools/test-path-security.mjs",
  "node tools/test-build-lite-package.mjs",
  "bash tools/test-render-project-scaffold-security.sh",
  "bash tools/test-minimal-quality-gate.sh",
  "VERIFY_PACKAGE_LOCK_ONLY=1 VERIFY_NPM_AUDIT=1 bash tools/test-scaffold-lockfiles.sh",
  "powershell -NoProfile -ExecutionPolicy Bypass -File .\\tools\\test-sync-compat-safety.ps1",
  "actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065",
  'python-version: "3.12"',
  "python -m pytest -q skills",
);
assertNotIncludes(
  ".github/workflows/vibe-quality.yml",
  "actions/checkout@v4",
  "actions/setup-node@v4",
  "actions/setup-python@v5",
  "ubuntu-latest",
  "windows-latest",
);
assertWindowsCiContract("windows-sync-check");

const windowsJob = readWorkflowJob("windows-sync-check");
const gateJob = readWorkflowJob("gate-tests");
assert(
  !gateJob.includes("node tools/test-experience-governance-closure.mjs"),
  "PowerShell-dependent experience governance closure must not run in the Ubuntu gate job",
);
assert(
  windowsJob.includes("node tools/test-experience-governance-closure.mjs"),
  "Windows CI must run the cross-platform experience governance closure test",
);
const windowsWorkflow = read(".github/workflows/vibe-quality.yml");
const crlfWindowsWorkflow = windowsWorkflow.replace(/\r?\n/g, "\r\n");
assert.doesNotThrow(
  () => assertWindowsCiContract("windows-sync-check", crlfWindowsWorkflow),
  "Windows CI contract should accept a CRLF-equivalent workflow source",
);
const invalidWindowsWorkflow = windowsWorkflow.replace("  windows-sync-check:\n", "   windows-sync-check:\n");
assert.notEqual(invalidWindowsWorkflow, windowsWorkflow, "mutation should change the Windows job indentation");
assert.throws(
  () => readWorkflowJob("windows-sync-check", invalidWindowsWorkflow),
  /workflow should define windows-sync-check/u,
  "Windows CI contract should reject a non-canonical job indentation",
);
const invalidWindowsJobs = [
  [
    "commands moved to PowerShell and reversed",
    windowsJob.replace(
      windowsBashStep,
      [
        "      - name: Run Windows Git Bash scaffold and golden path tests",
        "        shell: bash",
        "        run: echo noop",
        "      - name: Misplaced scaffold and golden path tests",
        "        shell: pwsh",
        "        run: |",
        "          bash tools/test-golden-path-examples.sh",
        "          bash tools/test-runtime-project-scaffold.sh",
      ].join("\n"),
    ),
  ],
  [
    "commands reversed inside the Bash step",
    windowsJob.replace(
      windowsBashStep,
      windowsBashStep.replace(
        "          bash tools/test-runtime-project-scaffold.sh\n          bash tools/test-golden-path-examples.sh",
        "          bash tools/test-golden-path-examples.sh\n          bash tools/test-runtime-project-scaffold.sh",
      ),
    ),
  ],
  [
    "Bash step allowed to fail",
    windowsJob.replace("        shell: bash\n", "        shell: bash\n        continue-on-error: true\n"),
  ],
  [
    "Windows job allowed to fail",
    windowsJob.replace("    runs-on: windows-2022\n", "    runs-on: windows-2022\n    continue-on-error: true\n"),
  ],
  [
    "Bash step has seven-space list indentation",
    windowsJob.replace(windowsBashStep, windowsBashStep.replace(/^ {6}- /u, "       - ")),
  ],
  [
    "Windows job is conditionally skipped",
    windowsJob.replace("    runs-on: windows-2022\n", "    if: ${{ false }}\n    runs-on: windows-2022\n"),
  ],
  [
    "Windows job has quoted continue-on-error",
    windowsJob.replace("    runs-on: windows-2022\n", "    \"continue-on-error\": true\n    runs-on: windows-2022\n"),
  ],
];

for (const [label, invalidJob] of invalidWindowsJobs) {
  assert.notEqual(invalidJob, windowsJob, `mutation should change the Windows job: ${label}`);
  assert.equal(windowsCiContractSatisfied(invalidJob), false, `Windows CI contract should reject: ${label}`);
}

assertNotIncludes("skills/ROUTING-MANIFEST.json", "superpowers:brainstorming");

assertIncludes(
  "skills/vibe-coding-skills/SKILL.md",
  "**首次接入**",
  "`target-constitution-setup`",
  "`target-runtime-setup`",
);
assertIncludes(
  "skills/beginner-flow-guide/SKILL.md",
  "目标项目首次接入：`target-constitution-setup`",
);
assertIncludes(
  "skills/vibe-coding-skills/references/route-matrix.md",
  "先路由到 `target-constitution-setup`",
  "再进入 `target-runtime-setup`",
);
assertIncludes(
  "skills/beginner-flow-guide/references/route-matrix.md",
  "`target-constitution-setup`",
  "再由该 Skill 衔接 `target-runtime-setup`",
);

const settings = JSON.parse(read("settings.json"));
const claudeCommands = Object.values(settings.hooks)
  .flat()
  .flatMap((entry) => entry.hooks || [])
  .map((hook) => hook.command);
assert(
  claudeCommands.every((command) => command.startsWith("bash ") || command.startsWith("node \"$VIBE_CODING_SKILLS_HOME/tools/routing-session-gate.mjs\"")),
  "Claude shell hooks must use bash, except the routing gate which must use direct Node",
);
assert(
  !(settings.hooks.PreToolUse?.[0]?.hooks?.[0] || {}).if,
  "Claude pre-commit hook must inspect every Bash command instead of relying on a narrow git commit prefix filter",
);

const codexHooks = read("codex-hooks.json");
assert(
  codexHooks.includes("Join-Path $root '.git'") && codexHooks.includes("Join-Path $root '.codex\\\\hooks\\\\run-hook.ps1'"),
  "Codex hooks must resolve the fixed runner beneath the nearest Git root marker",
);
assert(!codexHooks.includes("while ($true)"), "Codex hooks must not execute the first ancestor .codex runner");

const executableHookEntries = execFileSync(
  "git",
  ["-C", repoRoot, "ls-files", "--stage", ".githooks/pre-commit", "hooks/*.sh", "codex-hooks/*.sh"],
  { encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
assert(executableHookEntries.length > 0, "expected tracked shell hook entries");
for (const entry of executableHookEntries) {
  assert(entry.startsWith("100755 "), `shell hook must be tracked as executable: ${entry}`);
}

console.log("External skill boundary tests passed");
