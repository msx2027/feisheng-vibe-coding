#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { commitTargetTransaction, commitTargetTransactionPhases } from "./target-doc-transaction.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checkerPath = path.join(repoRoot, "tools", "check-target-constitution.mjs");
const setupPath = path.join(repoRoot, "tools", "init-target-constitution.mjs");
const migrationPath = path.join(repoRoot, "tools", "migrate-target-doc-system.mjs");
const docNameChecker = path.join(repoRoot, "tools", "check-target-doc-names.mjs");
const healthChecker = path.join(repoRoot, "tools", "vibe-health-check.mjs");
const resolverPath = path.join(repoRoot, "tools", "resolve-target-doc-context.mjs");

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function run(root, skillsRoot, ...extra) {
  return spawnSync(process.execPath, [checkerPath, root, "--skills-root", skillsRoot, "--json", ...extra], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function runSetup(root, skillsRoot, ...extra) {
  return spawnSync(process.execPath, [setupPath, root, "--skills-root", skillsRoot, "--json", ...extra], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function runMigration(root, ...extra) {
  return spawnSync(process.execPath, [migrationPath, root, "--json", ...extra], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function runDocNames(root) {
  return spawnSync(process.execPath, [docNameChecker, root, "--require-existing"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function runResolver(root, ...extra) {
  return spawnSync(process.execPath, [resolverPath, root, "--json", ...extra], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function runHealth(root, ...extra) {
  return spawnSync(process.execPath, [healthChecker, root, "--profile", "target", "--level", "quick", ...extra], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function parseJson(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Expected JSON output, got:\n${result.stdout}\n${result.stderr}`);
  }
}

function makeSkillsRoot(base) {
  const root = path.join(base, "skills-root");
  writeFile(path.join(root, "skills", "INDEX.md"), "# Skills\n");
  writeFile(path.join(root, "tools", "init-target-runtime.mjs"), "// fixture\n");
  return root;
}

function toCrLf(value) {
  return String(value).replace(/\r?\n/g, "\r\n");
}

function padMarkdownTables(value) {
  return String(value)
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return line;
      return `| ${trimmed
        .slice(1, -1)
        .split("|")
        .map((cell, index) => {
          const normalized = cell.trim();
          return /^-+$/u.test(normalized) ? "-".repeat(normalized.length + index + 3) : `${normalized}${" ".repeat(index + 1)}`;
        })
        .join(" | ")} |`;
    })
    .join("\n");
}

function makeRichTarget(base) {
  const root = path.join(base, "rich-target");
  writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        scripts: {
          dev: "next dev",
          build: "next build",
          test: "node --test",
          deploy: "echo deploy",
        },
        dependencies: {
          next: "15.0.0",
          react: "19.0.0",
          "next-auth": "5.0.0",
        },
      },
      null,
      2,
    ),
  );
  writeFile(path.join(root, ".vibe-docs.json"), JSON.stringify({ productSpec: "需求文档.md" }, null, 2));
  writeFile(path.join(root, "需求文档.md"), "# 需求\n");
  writeFile(path.join(root, "app", "api", "health", "route.ts"), "export function GET() {}\n");
  writeFile(path.join(root, "src", "auth", "session.ts"), "export const auth = true;\n");
  writeFile(path.join(root, "prisma", "schema.prisma"), "model User { id String @id }\n");
  writeFile(path.join(root, "Dockerfile"), "FROM node:22\n");
  return root;
}

function makeMonorepoBackendTarget(base) {
  const root = path.join(base, "monorepo-backend-target");
  writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        scripts: {
          dev: "vite",
          build: "vite build",
          test: "node --test",
          deploy: "echo deploy",
        },
        dependencies: {
          react: "19.0.0",
          vite: "6.0.0",
          "next-auth": "5.0.0",
        },
      },
      null,
      2,
    ),
  );
  writeFile(path.join(root, ".vibe-docs.json"), JSON.stringify({ productSpec: "需求文档.md" }, null, 2));
  writeFile(path.join(root, "需求文档.md"), "# 需求\n");
  writeFile(path.join(root, "apps", "core-service", "src", "server", "index.ts"), "export const server = true;\n");
  writeFile(path.join(root, "src", "auth", "session.ts"), "export const auth = true;\n");
  writeFile(path.join(root, "prisma", "schema.prisma"), "model User { id String @id }\n");
  writeFile(path.join(root, "Dockerfile"), "FROM node:22\n");
  return root;
}

function makeSparseTarget(base, name = "sparse-target") {
  const root = path.join(base, name);
  writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { build: "echo build" } }, null, 2));
  writeFile(path.join(root, "AGENTS.md"), "# Rules\n\n遵守架构，保证质量，按最佳实践执行。\n");
  return root;
}

// 仅有前端依赖 + 非 src/app/pages 目录下的前端源码：用来暴露 A1
// （owner 靠依赖判 verified，但证据列表按旧规则只收 src|app|pages 文件而为空）。
function makeDepsOnlyFrontendTarget(base) {
  const root = path.join(base, "deps-only-frontend-target");
  writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { react: "19.0.0" } }, null, 2));
  writeFile(path.join(root, "lib", "widget.tsx"), "export const Widget = () => null;\n");
  return root;
}

function makeRuntimeOnlyTarget(base) {
  const root = path.join(base, "runtime-only-target");
  writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { build: "echo build" } }, null, 2));
  writeFile(path.join(root, ".ddzj", "auth.json"), '{"token":"runtime-only"}\n');
  writeFile(path.join(root, ".ddzj", "state.sqlite"), "runtime database\n");
  writeFile(path.join(root, ".cache", "cache.json"), "{}\n");
  writeFile(path.join(root, ".tmp", "state.json"), "{}\n");
  writeFile(path.join(root, "tmp", "state.json"), "{}\n");
  writeFile(path.join(root, "sessions", "session.json"), "{}\n");
  writeFile(path.join(root, "archived_sessions", "session.json"), "{}\n");
  writeFile(path.join(root, ".claude", "worktrees", "nested", "src", "auth", "session.ts"), "export const auth = true;\n");
  writeFile(path.join(root, ".codex", "generated", "src", "auth", "session.ts"), "export const auth = true;\n");
  writeFile(path.join(root, ".agents", "generated", "src", "auth", "session.ts"), "export const auth = true;\n");
  writeFile(path.join(root, "target", "debug", "permissions", "auth.toml"), "generated = true\n");
  writeFile(path.join(root, "build", "permissions", "auth.json"), "{}\n");
  writeFile(path.join(root, "nested-worktree", ".git"), "gitdir: ../.git/worktrees/nested-worktree\n");
  writeFile(path.join(root, "nested-worktree", "src", "auth", "session.ts"), "export const auth = true;\n");
  writeFile(path.join(root, "runtime.sqlite-wal"), "runtime database journal\n");
  return root;
}

function makeHealthTarget(base) {
  const root = path.join(base, "health-target");
  writeFile(
    path.join(root, ".vibe-docs.json"),
    JSON.stringify(
      {
        productSpec: "需求文档.md",
        devPlan: "开发计划.md",
        currentExecution: "plans/执行光标.md",
        manualAcceptance: "验收记录.md",
        interfaceContracts: "接口契约.md",
        projectProfile: "项目画像.md",
        constitutionDesign: "宪法设计.md",
        loadPolicy: { always: [], never: [] },
      },
      null,
      2,
    ),
  );
  writeFile(path.join(root, "需求文档.md"), "# 需求文档\n\n## 范围\n\n## 不做什么\n\n## 验收\n\n## 停止条件\n\n## 未验证\n");
  writeFile(path.join(root, "开发计划.md"), "# 开发计划\n\n## 验收\n\n## 停止条件\n\n## 未验证\n");
  writeFile(path.join(root, "plans", "执行光标.md"), "# 执行光标\n");
  writeFile(path.join(root, "验收记录.md"), "# 验收记录\n\n## 验收\n\n## 停止条件\n\n## 未验证\n");
  writeFile(path.join(root, "接口契约.md"), "# 接口契约\n\n| 能力ID | 统一能力 | 入口类型 | 契约入口 | 调用方 | 状态 | 说明 |\n| --- | --- | --- | --- | --- | --- | --- |\n| none | 暂无业务接口 | none | none | none | active | 无 |\n");
  writeFile(path.join(root, "项目画像.md"), "# 项目画像\n\n## Owner Map\n\n## 验收\n\n## 停止条件\n\n## 未验证\n");
  writeFile(path.join(root, "宪法设计.md"), "# 宪法设计包\n\n## 项目证据包\n\n## 条款映射\n\n## 验收\n\n## 停止条件\n\n## 未验证\n");
  writeFile(path.join(root, "AGENTS.md"), "# Rules\n\n遵守架构，保证质量，按最佳实践执行。\n");
  writeFile(path.join(root, "CLAUDE.md"), "# Rules\n\n遵守架构，保证质量，按最佳实践执行。\n");
  return root;
}

function content(root, file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

let tmpRoot = "";

try {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "target-constitution-"));
  const skillsRoot = makeSkillsRoot(tmpRoot);
  const setupSource = fs.readFileSync(setupPath, "utf8");
  assert.match(setupSource, /commitTargetTransactionPhases\(/u, "constitution bootstrap must apply both rounds through the shared phased transaction helper");
  assert.doesNotMatch(setupSource, /safeWriteTargetFile\(/u, "constitution setup must not write planned files one by one");

  const transactionRoot = path.join(tmpRoot, "transaction-rollback");
  fs.mkdirSync(transactionRoot, { recursive: true });
  assert.throws(() => commitTargetTransaction(transactionRoot, {
    journalPath: ".transaction.json",
    kind: "constitution-bootstrap-test",
    operations: [
      { file: "parent", content: "blocks child directory\n", expectedContent: null },
      { file: "parent/child.md", content: "# Child\n", expectedContent: null },
    ],
  }));
  assert.equal(fs.existsSync(path.join(transactionRoot, "parent")), false, "failed transaction must roll back the first applied file");
  assert.equal(fs.existsSync(path.join(transactionRoot, ".transaction.json")), false, "successful rollback must remove the journal");

  const phasedTransactionRoot = path.join(tmpRoot, "phased-transaction-rollback");
  fs.mkdirSync(phasedTransactionRoot, { recursive: true });
  writeFile(path.join(phasedTransactionRoot, "existing.md"), "# Original\n");
  assert.throws(() => commitTargetTransactionPhases(phasedTransactionRoot, {
    journalPath: ".phased-transaction.json",
    kind: "constitution-bootstrap-test",
    firstOperations: [
      { file: "round-one.md", content: "# Round one\n", expectedContent: null },
      { file: "existing.md", content: "# Round one update\n", expectedContent: "# Original\n" },
    ],
    nextOperations() {
      throw new Error("bootstrap stabilization failed");
    },
  }), /bootstrap stabilization failed/u);
  assert.equal(fs.existsSync(path.join(phasedTransactionRoot, "round-one.md")), false, "a stabilization failure must restore the state before round one");
  assert.equal(content(phasedTransactionRoot, "existing.md"), "# Original\n", "a stabilization failure must restore files updated in round one");
  assert.equal(fs.existsSync(path.join(phasedTransactionRoot, ".phased-transaction.json")), false, "a completed cross-round rollback must remove its journal");

  const concurrentEditRoot = path.join(tmpRoot, "phased-transaction-concurrent-edit");
  fs.mkdirSync(concurrentEditRoot, { recursive: true });
  writeFile(path.join(concurrentEditRoot, "existing.md"), "# Original\n");
  assert.throws(() => commitTargetTransactionPhases(concurrentEditRoot, {
    journalPath: ".phased-transaction.json",
    kind: "constitution-bootstrap-test",
    firstOperations: [
      { file: "existing.md", content: "# Round one update\n", expectedContent: "# Original\n" },
    ],
    nextOperations() {
      writeFile(path.join(concurrentEditRoot, "existing.md"), "# External edit\n");
      throw new Error("bootstrap stabilization failed");
    },
  }), /cross-round rollback failed: target changed after planning: existing\.md/u);
  assert.equal(content(concurrentEditRoot, "existing.md"), "# External edit\n", "cross-round rollback must not overwrite a concurrent external edit");
  assert.equal(fs.existsSync(path.join(concurrentEditRoot, ".phased-transaction.json")), false, "a CAS conflict before rollback journal creation must not leave a false recovery journal");

  const rich = run(makeRichTarget(tmpRoot), skillsRoot, "--strict");
  const richPayload = parseJson(rich);
  assert.equal(rich.status, 0, rich.stderr || rich.stdout);
  assert.equal(richPayload.ok, true);
  assert.deepEqual(
    richPayload.owners.filter((owner) => owner.status !== "verified").map((owner) => owner.id),
    [],
  );

  const monorepoBackend = run(makeMonorepoBackendTarget(tmpRoot), skillsRoot, "--strict");
  const monorepoBackendPayload = parseJson(monorepoBackend);
  assert.equal(monorepoBackend.status, 0, monorepoBackend.stderr || monorepoBackend.stdout);
  assert.equal(monorepoBackendPayload.owners.find((owner) => owner.id === "backend")?.status, "verified");
  assert(
    monorepoBackendPayload.owners
      .find((owner) => owner.id === "backend")
      ?.evidence.includes("apps/core-service/src/server/index.ts"),
  );

  const sparse = run(makeSparseTarget(tmpRoot), skillsRoot);
  const sparsePayload = parseJson(sparse);
  assert.equal(sparse.status, 0, sparse.stderr || sparse.stdout);
  assert(sparsePayload.gaps.some((gap) => gap.id === "auth" && gap.status === "未验证"));
  assert(sparsePayload.findings.some((finding) => finding.id === "shallow-constitution"));

  const sparseStrict = run(makeSparseTarget(tmpRoot), skillsRoot, "--strict");
  assert.equal(sparseStrict.status, 1, "strict mode should fail on warnings");

  const explanatoryTodo = makeRichTarget(tmpRoot);
  writeFile(path.join(explanatoryTodo, "AGENTS.md"), "# Rules\n\n- 未实现能力只做占位、禁用态、mock 展示或 TODO。\n");
  const explanatoryTodoStrict = run(explanatoryTodo, skillsRoot, "--strict");
  assert.equal(explanatoryTodoStrict.status, 0, explanatoryTodoStrict.stderr || explanatoryTodoStrict.stdout);

  const runtimeOnlyTarget = makeRuntimeOnlyTarget(tmpRoot);
  const runtimeOnly = run(runtimeOnlyTarget, skillsRoot);
  const runtimeOnlyPayload = parseJson(runtimeOnly);
  assert.equal(runtimeOnly.status, 0, runtimeOnly.stderr || runtimeOnly.stdout);
  assert.deepEqual(
    runtimeOnlyPayload.evidence.files.filter((file) => [
      ".ddzj/auth.json",
      ".ddzj/state.sqlite",
      ".cache/cache.json",
      ".tmp/state.json",
      "tmp/state.json",
      "sessions/session.json",
      "archived_sessions/session.json",
      ".claude/worktrees/nested/src/auth/session.ts",
      ".codex/generated/src/auth/session.ts",
      ".agents/generated/src/auth/session.ts",
      "target/debug/permissions/auth.toml",
      "build/permissions/auth.json",
      "nested-worktree/.git",
      "nested-worktree/src/auth/session.ts",
      "runtime.sqlite-wal",
    ].includes(file)),
    [],
  );
  assert(!runtimeOnlyPayload.evidence.files.some((file) => /\.sqlite/iu.test(file)));
  assert.equal(runtimeOnlyPayload.owners.find((owner) => owner.id === "auth")?.status, "unverified");

  writeFile(path.join(runtimeOnlyTarget, "src", "auth", "session.ts"), "export const auth = true;\n");
  const sourceAuth = run(runtimeOnlyTarget, skillsRoot);
  const sourceAuthPayload = parseJson(sourceAuth);
  assert.equal(sourceAuth.status, 0, sourceAuth.stderr || sourceAuth.stdout);
  assert(sourceAuthPayload.evidence.files.includes("src/auth/session.ts"));
  assert.equal(sourceAuthPayload.owners.find((owner) => owner.id === "auth")?.status, "verified");

  const invalidSkills = run(makeSparseTarget(tmpRoot), path.join(tmpRoot, "missing-skills"));
  const invalidPayload = parseJson(invalidSkills);
  assert.equal(invalidSkills.status, 2, "invalid skills root should block");
  assert(invalidPayload.findings.some((finding) => finding.severity === "blocker"));

  const placeholderRoot = makeRichTarget(tmpRoot);
  writeFile(path.join(placeholderRoot, "AGENTS.md"), "# Rules\n\nTODO replace this constitution.\n");
  const placeholderStrict = run(placeholderRoot, skillsRoot, "--strict");
  const placeholderStrictPayload = parseJson(placeholderStrict);
  assert.equal(placeholderStrict.status, 1, "strict mode should fail on constitution placeholders");
  assert(placeholderStrictPayload.findings.some((finding) => finding.id === "constitution-placeholder"));

  const health = runHealth(makeHealthTarget(tmpRoot), "--strict");
  assert.equal(health.status, 1, "target health strict should fail shallow constitution");
  assert(health.stdout.includes("target-constitution"), health.stdout);

  const generatedTarget = makeRichTarget(tmpRoot);
  const setupWrite = runSetup(generatedTarget, skillsRoot, "--write");
  const setupWritePayload = parseJson(setupWrite);
  assert.equal(setupWrite.status, 0, setupWrite.stderr || setupWrite.stdout);
  assert(setupWritePayload.files.some((file) => file.file === "docs/项目治理/项目画像.md" && file.status === "written"));
  assert(content(generatedTarget, "docs/项目治理/项目画像.md").includes("-->\n\n# 项目画像"));
  assert(content(generatedTarget, "docs/项目治理/宪法设计.md").includes("-->\n\n# 宪法设计包"));
  assert(content(generatedTarget, "docs/项目治理/项目画像.md").includes("Owner Map"));
  assert(content(generatedTarget, "docs/项目治理/宪法设计.md").includes("条款映射"));
  const generatedProfile = content(generatedTarget, "docs/项目治理/项目画像.md");
  const generatedDesign = content(generatedTarget, "docs/项目治理/宪法设计.md");
  assert(generatedProfile.includes("- 项目根目录：`.`"), "generated profile must describe the target root portably");
  assert(generatedDesign.includes("| 项目根目录 | `.` | 已确认 |"), "generated design must describe the target root portably");
  assert(generatedDesign.includes("| Skills root | `<skills-root>` | 已确认 |"), "generated design must use the portable skills-root placeholder");
  assert(!generatedProfile.includes(generatedTarget), "generated profile must not embed the local target root");
  assert(!generatedDesign.includes(generatedTarget), "generated design must not embed the local target root");
  assert(!generatedDesign.includes(skillsRoot), "generated design must not embed the local skills root");
  const generatedManifest = JSON.parse(content(generatedTarget, ".vibe-docs.json"));
  assert.equal(generatedManifest.projectProfile, "docs/项目治理/项目画像.md");
  assert.equal(generatedManifest.constitutionDesign, "docs/项目治理/宪法设计.md");
  assert.deepEqual(generatedManifest.loadPolicy.always, []);
  assert.deepEqual(generatedManifest.taskContext, {
    enabled: false,
    taskCapsulesRoot: "docs/plans/任务",
  });
  // 经验库已彻底移除：生成的 manifest 不得再带 experience 字段，也不得生成经验入口文件。
  assert.equal(Object.prototype.hasOwnProperty.call(generatedManifest, "experience"), false, "generated manifest must not carry the removed experience field");
  assert.equal(fs.existsSync(path.join(generatedTarget, "经验教训.md")), false);
  assert.equal(fs.existsSync(path.join(generatedTarget, "经验索引.md")), false);
  const generatedDocNames = runDocNames(generatedTarget);
  assert.equal(generatedDocNames.status, 0, generatedDocNames.stderr || generatedDocNames.stdout);
  const setupCheck = runSetup(generatedTarget, skillsRoot, "--check");
  assert.equal(setupCheck.status, 0, setupCheck.stderr || setupCheck.stdout);

  const emptyTarget = path.join(tmpRoot, "empty-target");
  fs.mkdirSync(emptyTarget, { recursive: true });
  const emptyWrite = runSetup(emptyTarget, skillsRoot, "--write");
  assert.equal(emptyWrite.status, 0, emptyWrite.stderr || emptyWrite.stdout);
  const emptyManifest = JSON.parse(content(emptyTarget, ".vibe-docs.json"));
  assert.equal(emptyManifest.schemaVersion, 2, "empty target must bootstrap schema v2");
  assert.equal(emptyManifest.documentIndex, "文档索引.md");
  assert.deepEqual(emptyManifest.markdownGovernance, {
    enabled: true,
    maxTokens: 8000,
    facadeMaxTokens: 3000,
    archiveDirectories: [],
  }, "new target bootstrap must enable Markdown governance with the canonical budgets");
  assert.deepEqual(
    Object.fromEntries(
      ["productSpec", "devPlan", "currentExecution", "manualAcceptance", "interfaceContracts", "projectProfile", "constitutionDesign", "experienceGovernance", "documentIndex"]
        .map((role) => [role, emptyManifest[role]]),
    ),
    {
      productSpec: "docs/需求文档.md",
      devPlan: "docs/项目治理/开发计划.md",
      currentExecution: "docs/plans/执行光标.md",
      manualAcceptance: "docs/项目治理/验收记录.md",
      interfaceContracts: "docs/接口契约.md",
      projectProfile: "docs/项目治理/项目画像.md",
      constitutionDesign: "docs/项目治理/宪法设计.md",
      experienceGovernance: "docs/项目治理/经验治理.md",
      documentIndex: "文档索引.md",
    },
    "新项目的受管 Markdown 必须按职责归入 docs，根目录只保留文档索引",
  );
  assert.deepEqual(
    fs.readdirSync(emptyTarget).filter((name) => name.endsWith(".md")),
    ["文档索引.md"],
    "新项目根目录不得生成其他 Markdown 文档",
  );
  for (const role of ["productSpec", "devPlan", "currentExecution", "manualAcceptance", "interfaceContracts", "projectProfile", "constitutionDesign", "experienceGovernance", "documentIndex"]) {
    assert(emptyManifest.documents.some((entry) => entry.role === role), `empty target missing required document role: ${role}`);
  }
  assert.equal(fs.existsSync(path.join(emptyTarget, "docs/项目治理/经验治理.md")), true, "empty target must create the L0 experience governance ledger");
  const emptyLedger = JSON.parse(content(emptyTarget, "docs/项目治理/经验治理.md").match(/```json vibe-experience-ledger\n([\s\S]*?)\n```/u)[1]);
  assert.equal(emptyLedger.l1RegistryAnchor, null, "empty target ledger must bootstrap canonical l1RegistryAnchor=null");
  assert(content(emptyTarget, "docs/项目治理/宪法设计.md").includes("target-experience-registry:start"), "empty target constitution must carry the independent L1 registry block");
  const emptyResolve = runResolver(emptyTarget, "--roles", "documentIndex,projectProfile,constitutionDesign");
  assert.equal(emptyResolve.status, 0, emptyResolve.stderr || emptyResolve.stdout);
  const emptyCheck = runSetup(emptyTarget, skillsRoot, "--check");
  assert.equal(emptyCheck.status, 0, emptyCheck.stderr || emptyCheck.stdout);

  const legacyMarkerTarget = path.join(tmpRoot, "legacy-basename-marker-adoption");
  fs.cpSync(emptyTarget, legacyMarkerTarget, { recursive: true });
  for (const relativePath of ["docs/项目治理/项目画像.md", "docs/项目治理/宪法设计.md"]) {
    writeFile(
      path.join(legacyMarkerTarget, relativePath),
      content(legacyMarkerTarget, relativePath).replace(`file=${relativePath}`, `file=${path.basename(relativePath)}`),
    );
  }
  const legacyMarkerSetup = runSetup(legacyMarkerTarget, skillsRoot, "--write");
  assert.equal(legacyMarkerSetup.status, 0, legacyMarkerSetup.stderr || legacyMarkerSetup.stdout);
  for (const relativePath of ["docs/项目治理/项目画像.md", "docs/项目治理/宪法设计.md"]) {
    assert.match(content(legacyMarkerTarget, relativePath), new RegExp(`file=${relativePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")} `, "u"));
  }

  const adoptionTarget = path.join(tmpRoot, "existing-v2-adoption");
  fs.cpSync(emptyTarget, adoptionTarget, { recursive: true });
  const adoptionManifest = JSON.parse(content(adoptionTarget, ".vibe-docs.json"));
  delete adoptionManifest.experienceGovernance;
  adoptionManifest.documents = adoptionManifest.documents.filter((item) => item.role !== "experienceGovernance");
  writeFile(path.join(adoptionTarget, ".vibe-docs.json"), `${JSON.stringify(adoptionManifest, null, 2)}\n`);
  fs.rmSync(path.join(adoptionTarget, "docs/项目治理/经验治理.md"), { force: true });
  const adoptionSetup = runSetup(adoptionTarget, skillsRoot, "--write");
  assert.equal(adoptionSetup.status, 0, adoptionSetup.stderr || adoptionSetup.stdout);
  const adoptedManifest = JSON.parse(content(adoptionTarget, ".vibe-docs.json"));
  assert.equal(adoptedManifest.experienceGovernance, "docs/项目治理/经验治理.md");
  assert.equal(
    adoptedManifest.documents.some((item) => item.role === "experienceGovernance" && item.path === "docs/项目治理/经验治理.md"),
    true,
    "existing schema v2 manifest must register the canonical experienceGovernance document",
  );
  assert.equal(fs.existsSync(path.join(adoptionTarget, "docs/项目治理/经验治理.md")), true);

  const existingV2WithoutMarkdown = path.join(tmpRoot, "existing-v2-without-markdown-governance");
  fs.cpSync(emptyTarget, existingV2WithoutMarkdown, { recursive: true });
  const existingV2Manifest = JSON.parse(content(existingV2WithoutMarkdown, ".vibe-docs.json"));
  delete existingV2Manifest.markdownGovernance;
  writeFile(path.join(existingV2WithoutMarkdown, ".vibe-docs.json"), `${JSON.stringify(existingV2Manifest, null, 2)}\n`);
  const existingV2Setup = runSetup(existingV2WithoutMarkdown, skillsRoot, "--write");
  assert.equal(existingV2Setup.status, 0, existingV2Setup.stderr || existingV2Setup.stdout);
  const preservedExistingV2Manifest = JSON.parse(content(existingV2WithoutMarkdown, ".vibe-docs.json"));
  assert.equal(
    Object.prototype.hasOwnProperty.call(preservedExistingV2Manifest, "markdownGovernance"),
    false,
    "existing v2 target without markdownGovernance must not be silently enabled",
  );

  const nonCanonicalTarget = path.join(tmpRoot, "non-canonical-experience-mapping");
  fs.cpSync(emptyTarget, nonCanonicalTarget, { recursive: true });
  const nonCanonicalManifest = JSON.parse(content(nonCanonicalTarget, ".vibe-docs.json"));
  nonCanonicalManifest.experienceGovernance = "经验治理.md";
  nonCanonicalManifest.documents = nonCanonicalManifest.documents.map((item) => (
    item.role === "experienceGovernance" ? { ...item, path: "经验治理.md" } : item
  ));
  writeFile(path.join(nonCanonicalTarget, ".vibe-docs.json"), `${JSON.stringify(nonCanonicalManifest, null, 2)}\n`);
  writeFile(path.join(nonCanonicalTarget, "经验治理.md"), content(nonCanonicalTarget, "docs/项目治理/经验治理.md"));
  const nonCanonicalSetup = runSetup(nonCanonicalTarget, skillsRoot, "--dry-run");
  assert.notEqual(nonCanonicalSetup.status, 0, "non-canonical experience mapping must fail closed");
  assert.match(`${nonCanonicalSetup.stdout}\n${nonCanonicalSetup.stderr}`, /experienceGovernance.*canonical|显式迁移|migration/iu);

  const emptyAudit = run(emptyTarget, skillsRoot);
  const emptyAuditPayload = parseJson(emptyAudit);
  assert.equal(emptyAudit.status, 0, emptyAudit.stderr || emptyAudit.stdout);
  assert.deepEqual(
    emptyAuditPayload.recommendedManifestPatch,
    {
      projectProfile: "docs/项目治理/项目画像.md",
      constitutionDesign: "docs/项目治理/宪法设计.md",
      markdownGovernance: {
        enabled: true,
        maxTokens: 8000,
        facadeMaxTokens: 3000,
        archiveDirectories: [],
      },
      loadPolicy: {
        always: [],
        never: [],
        note: "always 集合每轮必加载，默认留空；只把体积 < 5KB 的核心导航文档加入 always，合计不超过 12,000 token；never 禁止自动加载；其余为 onDemand 按需加载",
      },
      taskContext: { enabled: false, taskCapsulesRoot: "docs/plans/任务" },
    },
    "宪法审计器必须推荐新项目的 docs 分类默认路径",
  );
  writeFile(
    path.join(generatedTarget, ".vibe-docs.json"),
    content(generatedTarget, ".vibe-docs.json").replace(
      '"always": [],',
      '"always": ["docMap", "developmentEntry", "glossaryIndex"],',
    ),
  );
  for (const [file, heading] of [
    ["docs/项目治理/项目画像.md", "# 项目画像"],
    ["docs/项目治理/宪法设计.md", "# 宪法设计包"],
  ]) {
    writeFile(
      path.join(generatedTarget, file),
      content(generatedTarget, file).replace(`-->\n\n${heading}`, `-->\n${heading}`),
    );
  }
  const formattedCheck = runSetup(generatedTarget, skillsRoot, "--check");
  assert.equal(formattedCheck.status, 0, formattedCheck.stderr || formattedCheck.stdout);
  for (const file of ["docs/项目治理/项目画像.md", "docs/项目治理/宪法设计.md"]) {
    writeFile(path.join(generatedTarget, file), padMarkdownTables(content(generatedTarget, file)));
  }
  const tableFormattingCheck = runSetup(generatedTarget, skillsRoot, "--check");
  assert.equal(tableFormattingCheck.status, 0, tableFormattingCheck.stderr || tableFormattingCheck.stdout);
  writeFile(
    path.join(generatedTarget, "docs/项目治理/项目画像.md"),
    content(generatedTarget, "docs/项目治理/项目画像.md").replace("| product ", "| product-edited "),
  );
  const tableContentConflict = runSetup(generatedTarget, skillsRoot, "--check");
  assert.equal(tableContentConflict.status, 2, "table cell content changes must still conflict");

  const migratedManagedTarget = makeHealthTarget(path.join(tmpRoot, "migration-marker-case"));
  const migratedManagedSetup = runSetup(migratedManagedTarget, skillsRoot, "--write");
  assert.equal(migratedManagedSetup.status, 0, migratedManagedSetup.stderr || migratedManagedSetup.stdout);
  const migratedManagedWrite = runMigration(migratedManagedTarget, "--write");
  assert.equal(migratedManagedWrite.status, 0, migratedManagedWrite.stderr || migratedManagedWrite.stdout);
  assert(content(migratedManagedTarget, "项目画像.md").includes("<!-- vibe-section:PROJECTPROFILE-001 -->"));
  assert(content(migratedManagedTarget, "宪法设计.md").includes("<!-- vibe-section:CONSTITUTIONDESIGN-001 -->"));
  const migratedManagedDryRun = runSetup(migratedManagedTarget, skillsRoot, "--dry-run");
  const migratedManagedPayload = parseJson(migratedManagedDryRun);
  assert(!migratedManagedPayload.files.some((file) => file.action === "conflict"), "migration markers must not cause a managed-block conflict");
  writeFile(
    path.join(migratedManagedTarget, "项目画像.md"),
    content(migratedManagedTarget, "项目画像.md").replace("项目根目录", "项目根目录已被修改"),
  );
  const migratedManagedContentConflict = runSetup(migratedManagedTarget, skillsRoot, "--dry-run");
  const migratedManagedContentPayload = parseJson(migratedManagedContentConflict);
  assert(migratedManagedContentPayload.files.some((file) => file.file === "项目画像.md" && file.action === "conflict"), "real managed-body changes must still conflict after migration");

  const sparseGenerated = makeSparseTarget(tmpRoot, "sparse-default-docs-target");
  const sparseSetup = runSetup(sparseGenerated, skillsRoot, "--write");
  assert.equal(sparseSetup.status, 0, sparseSetup.stderr || sparseSetup.stdout);
  assert(content(sparseGenerated, "docs/项目治理/项目画像.md").includes("未验证"));
  assert(content(sparseGenerated, "docs/项目治理/宪法设计.md").includes("缺失证据"));

  const existingDocTarget = makeSparseTarget(tmpRoot, "sparse-existing-root-doc-target");
  writeFile(path.join(existingDocTarget, "项目画像.md"), "# 手写画像\n\n保留这一行。\n");
  const existingSetup = runSetup(existingDocTarget, skillsRoot, "--write");
  assert.equal(existingSetup.status, 0, existingSetup.stderr || existingSetup.stdout);
  assert(content(existingDocTarget, "项目画像.md").startsWith("# 手写画像\n\n保留这一行。"));

  const crlfDocTarget = makeSparseTarget(tmpRoot, "sparse-crlf-root-doc-target");
  writeFile(path.join(crlfDocTarget, "项目画像.md"), "# 手写画像\r\n\r\n保留这一行。\r\n");
  writeFile(path.join(crlfDocTarget, "宪法设计.md"), "# 手写设计\r\n\r\n保留这一行。\r\n");
  const crlfFirstSetup = runSetup(crlfDocTarget, skillsRoot, "--write");
  assert.equal(crlfFirstSetup.status, 0, crlfFirstSetup.stderr || crlfFirstSetup.stdout);
  writeFile(path.join(crlfDocTarget, "项目画像.md"), toCrLf(content(crlfDocTarget, "项目画像.md")));
  writeFile(path.join(crlfDocTarget, "宪法设计.md"), toCrLf(content(crlfDocTarget, "宪法设计.md")));
  writeFile(path.join(crlfDocTarget, "package.json"), JSON.stringify({ scripts: { build: "echo build", test: "echo test" } }, null, 2));
  const crlfUpdateSetup = runSetup(crlfDocTarget, skillsRoot, "--write");
  assert.equal(crlfUpdateSetup.status, 0, crlfUpdateSetup.stderr || crlfUpdateSetup.stdout);
  assert(content(crlfDocTarget, "项目画像.md").startsWith("# 手写画像\r\n\r\n保留这一行。\r\n"));
  assert(content(crlfDocTarget, "宪法设计.md").startsWith("# 手写设计\r\n\r\n保留这一行。\r\n"));
  assert(!content(crlfDocTarget, "项目画像.md").includes("保留这一行。<!--"));
  assert(!content(crlfDocTarget, "宪法设计.md").includes("保留这一行。<!--"));

  const gluedDocTarget = makeSparseTarget(tmpRoot, "sparse-glued-root-doc-target");
  writeFile(path.join(gluedDocTarget, "项目画像.md"), "# 手写画像\n\n保留这一行。\n");
  const gluedSetup = runSetup(gluedDocTarget, skillsRoot, "--write");
  assert.equal(gluedSetup.status, 0, gluedSetup.stderr || gluedSetup.stdout);
  writeFile(
    path.join(gluedDocTarget, "项目画像.md"),
    content(gluedDocTarget, "项目画像.md").replace(
      "\n\n<!-- vibe-coding-skills:target-constitution:start",
      "<!-- vibe-coding-skills:target-constitution:start",
    ),
  );
  const gluedSetupCheck = runSetup(gluedDocTarget, skillsRoot, "--check");
  const gluedSetupCheckPayload = parseJson(gluedSetupCheck);
  assert.equal(gluedSetupCheck.status, 2, "glued constitution marker should fail check");
  assert(gluedSetupCheckPayload.files.some((file) => file.file === "项目画像.md" && file.action === "conflict"));

  const conflicted = content(existingDocTarget, "项目画像.md").replace("项目画像", "手动改坏");
  writeFile(path.join(existingDocTarget, "项目画像.md"), conflicted);
  const conflictSetup = runSetup(existingDocTarget, skillsRoot, "--check");
  const conflictSetupPayload = parseJson(conflictSetup);
  assert.equal(conflictSetup.status, 2, "checksum mismatch should fail constitution check");
  assert(conflictSetupPayload.files.some((file) => file.file === "项目画像.md" && file.action === "conflict"));

  const hardlinkTarget = makeSparseTarget(path.join(tmpRoot, "hardlink-case"));
  const outsideProfile = path.join(tmpRoot, "outside-project-profile.md");
  writeFile(outsideProfile, "# Outside profile\n\nMust remain unchanged.\n");
  fs.linkSync(outsideProfile, path.join(hardlinkTarget, "项目画像.md"));
  const hardlinkSetup = runSetup(hardlinkTarget, skillsRoot, "--write");
  assert.equal(hardlinkSetup.status, 0, hardlinkSetup.stderr || hardlinkSetup.stdout);
  assert.equal(
    fs.readFileSync(outsideProfile, "utf8"),
    "# Outside profile\n\nMust remain unchanged.\n",
    "constitution setup must atomically replace a target hardlink instead of mutating the outside inode",
  );
  assert(content(hardlinkTarget, "项目画像.md").includes("vibe-coding-skills:target-constitution:start"));

  const symlinkTarget = makeSparseTarget(path.join(tmpRoot, "symlink-case"));
  const outsideDesign = path.join(tmpRoot, "outside-constitution-design.md");
  writeFile(outsideDesign, "# Outside design\n");
  try {
    fs.symlinkSync(outsideDesign, path.join(symlinkTarget, "宪法设计.md"), "file");
    const symlinkSetup = runSetup(symlinkTarget, skillsRoot, "--write");
    assert.equal(symlinkSetup.status, 2, "constitution setup must reject a symlink destination");
    assert.equal(fs.readFileSync(outsideDesign, "utf8"), "# Outside design\n");
  } catch (error) {
    if (error?.code !== "EPERM" && error?.code !== "EACCES") throw error;
    console.warn(`SKIP constitution file-symlink regression: ${error.message}`);
  }

  // A1：任何被判 verified 的 owner 必须带非空、非“未验证”的证据，
  // 不允许出现“状态=已确认但证据列为空/未验证”的自相矛盾行。
  const depsOnlyFrontend = run(makeDepsOnlyFrontendTarget(tmpRoot), skillsRoot);
  const depsOnlyFrontendPayload = parseJson(depsOnlyFrontend);
  assert.equal(depsOnlyFrontend.status, 0, depsOnlyFrontend.stderr || depsOnlyFrontend.stdout);
  const depsFrontendOwner = depsOnlyFrontendPayload.owners.find((owner) => owner.id === "frontend");
  assert.equal(depsFrontendOwner?.status, "verified", "frontend with a react dependency should be verified");
  assert(
    depsFrontendOwner.evidence.length > 0 && !depsFrontendOwner.evidence.includes("未验证"),
    "A1: a verified owner must carry concrete evidence, never an empty or 未验证 evidence list",
  );
  for (const owner of depsOnlyFrontendPayload.owners) {
    if (owner.status === "verified") {
      assert(
        owner.evidence.length > 0 && !owner.evidence.includes("未验证"),
        `A1: verified owner ${owner.id} must carry evidence`,
      );
    }
  }

  // A3：完全空的目标目录在生成前应判为 bootstrap；
  // 生成后 --check 仍稳定，且 owner map 不得出现自相矛盾（A2）。
  const bootstrapKindTarget = path.join(tmpRoot, "bootstrap-kind-target");
  fs.mkdirSync(bootstrapKindTarget, { recursive: true });
  const bootstrapKindWrite = runSetup(bootstrapKindTarget, skillsRoot, "--write");
  assert.equal(bootstrapKindWrite.status, 0, bootstrapKindWrite.stderr || bootstrapKindWrite.stdout);
  assert(
    content(bootstrapKindTarget, "docs/项目治理/项目画像.md").includes("接入类型：新项目 bootstrap"),
    "A3: an empty target must be recorded as 新项目 bootstrap, not 已有项目 adoption polluted by its own bootstrap output",
  );
  const bootstrapKindCheck = runSetup(bootstrapKindTarget, skillsRoot, "--check");
  assert.equal(bootstrapKindCheck.status, 0, bootstrapKindCheck.stderr || bootstrapKindCheck.stdout);

  // A2：生成的宪法设计 Owner Map 不得出现“证据=未验证 且 缺口=无”的行。
  const designBody = content(bootstrapKindTarget, "docs/项目治理/宪法设计.md");
  assert(
    !/\| 未验证 \| 无 \|/u.test(designBody),
    "A2: constitution design Owner Map must not pair 证据=未验证 with 缺口=无",
  );

  console.log("Target constitution audit tests passed");
} finally {
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
}
