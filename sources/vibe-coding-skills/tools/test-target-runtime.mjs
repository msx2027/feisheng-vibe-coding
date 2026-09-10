#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  experienceHash,
  parseExperienceProjection,
  renderExperienceRegistryBlock,
} from "./experience-managed-blocks.mjs";
import { safeWriteTargetFile } from "./safe-target-fs.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptPath = path.join(repoRoot, "tools", "init-target-runtime.mjs");
const docNameChecker = path.join(repoRoot, "tools", "check-target-doc-names.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function coordinatedProjectionDrift(content, file) {
  const parsed = parseExperienceProjection(content, file);
  const tamperedBody = parsed.block.body.replace(
    "- 当前没有已激活的项目经验规则。",
    "- [EXP-999] 协同篡改但未写回 L1 的规则。",
  );
  const tamperedBlock = [
    `<!-- vibe-coding-skills:target-experience-projection:start file=${file} version=${parsed.block.version} source=${parsed.sourceHash} checksum=${experienceHash(tamperedBody)} -->`,
    "",
    tamperedBody,
    "<!-- vibe-coding-skills:target-experience-projection:end -->",
  ].join("\n");
  const nextContent = `${content.slice(0, parsed.block.start)}${tamperedBlock}${content.slice(parsed.block.end)}`;
  return { content: nextContent, outputHash: parseExperienceProjection(nextContent, file).outputHash };
}

function run(args, options = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
  });
}

function runDocNames(root) {
  return spawnSync(process.execPath, [docNameChecker, root, "--require-existing"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Expected JSON output, got:\n${stdout}`);
  }
}

function makeSkillsRoot(base) {
  const root = path.join(base, "skills root with spaces");
  writeFile(path.join(root, "skills", "INDEX.md"), "# Skills\n");
  writeFile(path.join(root, "tools", "init-target-runtime.mjs"), "// fixture\n");
  return root;
}

function toCrLf(value) {
  return String(value).replace(/\r?\n/g, "\r\n");
}

function toCr(value) {
  return String(value).replace(/\r?\n/g, "\r");
}

function toMixed(value) {
  // 避免纯 CR 后紧接纯 LF，防止字节序列被误读为一个 CRLF。
  const endings = ["\n", "\r\n", "\r", "\r\n", "\n"];
  let line = 0;
  return String(value).replace(/\r?\n|\r/gu, () => endings[line++ % endings.length]);
}

function fileContent(root, file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function removeExperienceProjection(content) {
  return content.replace(
    /\n*<!-- vibe-coding-skills:target-experience-projection:start[^\n]* -->[\s\S]*?<!-- vibe-coding-skills:target-experience-projection:end -->\n?/u,
    "\n",
  );
}

function makeTarget(base, name) {
  const root = path.join(base, name);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

let tmpRoot = "";

try {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "target-runtime-"));
  const fixtureSkillsRoot = makeSkillsRoot(tmpRoot);

  const dryRunTarget = makeTarget(tmpRoot, "empty target");
  const dryRun = run([dryRunTarget, "--skills-root", fixtureSkillsRoot, "--dry-run", "--json"]);
  const dryRunPayload = parseJson(dryRun.stdout);
  assert(dryRun.status === 0, `dry-run should pass: ${dryRun.stderr || dryRun.stdout}`);
  assert(dryRunPayload.files.every((file) => file.action === "create"), "dry-run should report create actions");
  assert(!fs.existsSync(path.join(dryRunTarget, "AGENTS.md")), "dry-run must not write AGENTS.md");
  assert(!fs.existsSync(path.join(dryRunTarget, "CLAUDE.md")), "dry-run must not write CLAUDE.md");

  const writeTarget = makeTarget(tmpRoot, "write target");
  const write = run([writeTarget, "--skills-root", fixtureSkillsRoot, "--write", "--json"]);
  const writePayload = parseJson(write.stdout);
  assert(write.status === 0, `write should pass: ${write.stderr || write.stdout}`);
  assert(writePayload.files.every((file) => file.status === "written"), "write should create both files");
  assert(fileContent(writeTarget, "AGENTS.md").includes("vibe-coding-skills:target-runtime:start"), "AGENTS marker missing");
  assert(fileContent(writeTarget, "AGENTS.md").includes("-->\n\n## Agent 宪法"), "AGENTS block needs Markdown spacing");
  assert(fileContent(writeTarget, "CLAUDE.md").includes("-->\n\n## Agent 宪法"), "CLAUDE block needs Markdown spacing");
  assert(fileContent(writeTarget, "CLAUDE.md").includes("运行时：Claude"), "CLAUDE runtime text missing");
  assert(fileContent(writeTarget, "CLAUDE.md").includes("小任务快车道优先"), "CLAUDE fast lane text missing");
  assert(
    fileContent(writeTarget, "AGENTS.md").includes("否则使用 `<skills-root>` 表示的本包根目录"),
    "runtime block must use a portable skills-root placeholder",
  );
  assert(
    !fileContent(writeTarget, "AGENTS.md").includes(fixtureSkillsRoot),
    "runtime block must not embed the local skills-root path",
  );
  assert(fileContent(writeTarget, "AGENTS.md").includes("任务胶囊"), "AGENTS task capsule text missing");
  assert(fileContent(writeTarget, "AGENTS.md").includes("受管文档自动同步"), "AGENTS target document auto-sync rule missing");
  assert(fileContent(writeTarget, "CLAUDE.md").includes("绝不改写正文、Git 暂存区或旧任务胶囊的 `sourceRevision`"), "CLAUDE sourceRevision safety boundary missing");
  assert(fileContent(writeTarget, "CLAUDE.md").includes("大白话回复"), "CLAUDE plain-language rule missing");
  assert(fileContent(writeTarget, "CLAUDE.md").includes("体感对比"), "CLAUDE experience-contrast rule missing");
  assert(fileContent(writeTarget, "AGENTS.md").includes("Git 提交语言"), "AGENTS Chinese Git commit-message rule missing");
  assert(
    fileContent(writeTarget, "AGENTS.md").includes("严格 TDD：生产代码的新功能、bug 修复、重构和行为变更强制 `RED-GREEN-REFACTOR`"),
    "AGENTS strict TDD rule missing",
  );
  assert(
    fileContent(writeTarget, "CLAUDE.md").includes("未先写最小测试并确认它因目标行为缺失而正确失败，不得写或保留实现"),
    "CLAUDE failing-test-first rule missing",
  );
  assert(
    fileContent(writeTarget, "AGENTS.md").includes("原型、生成代码、配置文件只有用户明确批准可例外"),
    "AGENTS strict TDD exception-approval rule missing",
  );
  for (const [needle, label] of [
    ["visual-only T1 受控例外", "controlled visual-only T1 policy"],
    ["既有测试 / visual regression seam", "existing-seam TDD boundary"],
    ["改前基线", "before-change baseline evidence"],
    ["改后同路径定向视觉证据", "same-path after-change evidence"],
    ["全局 token / theme", "visual-only T1 exit boundary"],
  ]) {
    assert(fileContent(writeTarget, "AGENTS.md").includes(needle), `AGENTS ${label} missing`);
    assert(fileContent(writeTarget, "CLAUDE.md").includes(needle), `CLAUDE ${label} missing`);
  }

  const projectionTarget = makeTarget(tmpRoot, "experience projection target");
  writeFile(
    path.join(projectionTarget, ".vibe-docs.json"),
    `${JSON.stringify({ schemaVersion: 2, constitutionDesign: "docs/项目治理/宪法设计.md" }, null, 2)}\n`,
  );
  writeFile(
    path.join(projectionTarget, "docs/项目治理/宪法设计.md"),
    `# 宪法设计\n\n${renderExperienceRegistryBlock({ schemaVersion: 1, sourceRevision: 0, rules: [] })}\n`,
  );
  const projectionBootstrap = run([projectionTarget, "--skills-root", fixtureSkillsRoot, "--write", "--json"]);
  assert(projectionBootstrap.status === 0, projectionBootstrap.stderr || projectionBootstrap.stdout);
  assert(fileContent(projectionTarget, "AGENTS.md").includes("target-experience-projection:start"), "bootstrap should create AGENTS projection");
  assert(fileContent(projectionTarget, "CLAUDE.md").includes("target-experience-projection:start"), "bootstrap should create CLAUDE projection");
  const projectionRegistry = JSON.parse(fileContent(projectionTarget, ".vibe-runtime.json"));
  assert(projectionRegistry.experienceProjection?.outputs?.["AGENTS.md"], "bootstrap should register AGENTS projection evidence");
  assert(projectionRegistry.experienceProjection?.outputs?.["CLAUDE.md"], "bootstrap should register CLAUDE projection evidence");
  const projectionCurrent = run([projectionTarget, "--skills-root", fixtureSkillsRoot, "--check", "--json"]);
  assert(projectionCurrent.status === 0, projectionCurrent.stderr || projectionCurrent.stdout);

  // 已存在的经验投影即使被 Git checkout 为 CRLF，也必须能正常复查。
  writeFile(path.join(projectionTarget, "AGENTS.md"), toCrLf(fileContent(projectionTarget, "AGENTS.md")));
  writeFile(path.join(projectionTarget, "CLAUDE.md"), toCrLf(fileContent(projectionTarget, "CLAUDE.md")));
  const projectionCrlfCheck = run([projectionTarget, "--skills-root", fixtureSkillsRoot, "--check", "--json"]);
  assert(
    projectionCrlfCheck.status === 0,
    `CRLF experience projection check should pass: ${projectionCrlfCheck.stderr || projectionCrlfCheck.stdout}`,
  );
  writeFile(path.join(projectionTarget, "AGENTS.md"), fileContent(projectionTarget, "AGENTS.md").replace(/\r\n/gu, "\n"));
  writeFile(path.join(projectionTarget, "CLAUDE.md"), fileContent(projectionTarget, "CLAUDE.md").replace(/\r\n/gu, "\n"));

  const projectionOriginal = {
    agents: fileContent(projectionTarget, "AGENTS.md"),
    claude: fileContent(projectionTarget, "CLAUDE.md"),
    registry: fileContent(projectionTarget, ".vibe-runtime.json"),
  };
  const projectionLineEndingVariants = [
    ["CR", toCr],
    ["mixed", toMixed],
  ];
  for (const [name, convertLineEndings] of projectionLineEndingVariants) {
    writeFile(path.join(projectionTarget, "AGENTS.md"), convertLineEndings(projectionOriginal.agents));
    writeFile(path.join(projectionTarget, "CLAUDE.md"), convertLineEndings(projectionOriginal.claude));
    const beforeVariant = {
      agents: fileContent(projectionTarget, "AGENTS.md"),
      claude: fileContent(projectionTarget, "CLAUDE.md"),
    };
    for (const mode of ["--check", "--dry-run", "--write"]) {
      const result = run([projectionTarget, "--skills-root", fixtureSkillsRoot, mode, "--json"]);
      const payload = parseJson(result.stdout);
      assert(result.status === 0, `${name} projection ${mode} should pass: ${result.stderr || result.stdout}`);
      assert(payload.files.every((file) => file.action === "none"), `${name} projection ${mode} should be idempotent`);
      assert(fileContent(projectionTarget, "AGENTS.md") === beforeVariant.agents, `${name} ${mode} rewrote AGENTS`);
      assert(fileContent(projectionTarget, "CLAUDE.md") === beforeVariant.claude, `${name} ${mode} rewrote CLAUDE`);
    }
  }
  writeFile(path.join(projectionTarget, "AGENTS.md"), projectionOriginal.agents);
  writeFile(path.join(projectionTarget, "CLAUDE.md"), projectionOriginal.claude);
  const projectionDrifts = [
    {
      name: "总 sourceHash",
      mutate() {
        const registry = JSON.parse(projectionOriginal.registry);
        registry.experienceProjection.sourceHash = `sha256:${"0".repeat(64)}`;
        writeFile(path.join(projectionTarget, ".vibe-runtime.json"), `${JSON.stringify(registry, null, 2)}\n`);
      },
    },
    {
      name: "单 output sourceHash",
      mutate() {
        const registry = JSON.parse(projectionOriginal.registry);
        registry.experienceProjection.outputs["AGENTS.md"].sourceHash = `sha256:${"1".repeat(64)}`;
        writeFile(path.join(projectionTarget, ".vibe-runtime.json"), `${JSON.stringify(registry, null, 2)}\n`);
      },
    },
    {
      name: "单 output outputHash",
      mutate() {
        const registry = JSON.parse(projectionOriginal.registry);
        registry.experienceProjection.outputs["AGENTS.md"].outputHash = `sha256:${"2".repeat(64)}`;
        writeFile(path.join(projectionTarget, ".vibe-runtime.json"), `${JSON.stringify(registry, null, 2)}\n`);
      },
    },
    {
      name: "实际 projection block",
      mutate() {
        writeFile(
          path.join(projectionTarget, "AGENTS.md"),
          projectionOriginal.agents.replace("当前没有已激活的项目经验规则", "已篡改的项目经验规则"),
        );
      },
    },
    {
      name: "L2 body、block checksum 与 registry outputHash 协同漂移",
      mutate() {
        const agents = coordinatedProjectionDrift(projectionOriginal.agents, "AGENTS.md");
        const claude = coordinatedProjectionDrift(projectionOriginal.claude, "CLAUDE.md");
        writeFile(path.join(projectionTarget, "AGENTS.md"), agents.content);
        writeFile(path.join(projectionTarget, "CLAUDE.md"), claude.content);
        const registry = JSON.parse(projectionOriginal.registry);
        registry.experienceProjection.outputs["AGENTS.md"].outputHash = agents.outputHash;
        registry.experienceProjection.outputs["CLAUDE.md"].outputHash = claude.outputHash;
        writeFile(path.join(projectionTarget, ".vibe-runtime.json"), `${JSON.stringify(registry, null, 2)}\n`);
      },
    },
  ];
  for (const drift of projectionDrifts) {
    writeFile(path.join(projectionTarget, "AGENTS.md"), projectionOriginal.agents);
    writeFile(path.join(projectionTarget, "CLAUDE.md"), projectionOriginal.claude);
    writeFile(path.join(projectionTarget, ".vibe-runtime.json"), projectionOriginal.registry);
    drift.mutate();
    const driftBefore = {
      agents: fileContent(projectionTarget, "AGENTS.md"),
      claude: fileContent(projectionTarget, "CLAUDE.md"),
      registry: fileContent(projectionTarget, ".vibe-runtime.json"),
    };
    for (const mode of ["--check", "--write"]) {
      const result = run([projectionTarget, "--skills-root", fixtureSkillsRoot, mode, "--json"]);
      const payload = parseJson(result.stdout);
      assert(result.status === 1, `${drift.name} 漂移必须在 ${mode} fail closed`);
      assert(payload.files.some((file) => file.action === "conflict"), `${drift.name} 漂移必须报告 conflict`);
      assert(fileContent(projectionTarget, "AGENTS.md") === driftBefore.agents, `${drift.name} ${mode} 不得修改 AGENTS`);
      assert(fileContent(projectionTarget, "CLAUDE.md") === driftBefore.claude, `${drift.name} ${mode} 不得修改 CLAUDE`);
      assert(fileContent(projectionTarget, ".vibe-runtime.json") === driftBefore.registry, `${drift.name} ${mode} 不得修改 registry`);
    }
  }

  writeFile(path.join(projectionTarget, "AGENTS.md"), projectionOriginal.agents);
  writeFile(path.join(projectionTarget, "CLAUDE.md"), projectionOriginal.claude);
  writeFile(path.join(projectionTarget, ".vibe-runtime.json"), projectionOriginal.registry);

  writeFile(path.join(projectionTarget, "AGENTS.md"), removeExperienceProjection(fileContent(projectionTarget, "AGENTS.md")));
  const establishedBefore = {
    agents: fileContent(projectionTarget, "AGENTS.md"),
    claude: fileContent(projectionTarget, "CLAUDE.md"),
    registry: fileContent(projectionTarget, ".vibe-runtime.json"),
  };
  for (const mode of ["--check", "--write"]) {
    const establishedResult = run([projectionTarget, "--skills-root", fixtureSkillsRoot, mode, "--json"]);
    const establishedPayload = parseJson(establishedResult.stdout);
    assert(establishedResult.status === 1, `established runtime missing projection must fail ${mode}`);
    assert(
      establishedPayload.files.some((file) => file.file === "AGENTS.md" && file.action === "conflict"),
      `established runtime missing projection should report AGENTS conflict for ${mode}`,
    );
    assert(fileContent(projectionTarget, "AGENTS.md") === establishedBefore.agents, `${mode} must not restore missing AGENTS projection`);
    assert(fileContent(projectionTarget, "CLAUDE.md") === establishedBefore.claude, `${mode} must not change CLAUDE projection`);
    assert(fileContent(projectionTarget, ".vibe-runtime.json") === establishedBefore.registry, `${mode} must not change runtime registry`);
  }
  for (const [needle, label] of [
    ["审查分层：先判 `execution tier`，再独立计算 `review profile`", "orthogonal review profile"],
    ["T2 必须把 `Spec Compliance` 与 `Code Quality` 分成两个阶段", "T2 split review"],
    ["高影响 T2、T3、T3+ 使用 fresh 独立 Reviewer", "independent review isolation"],
    ["跨至少 3 个模块", "three-module review threshold"],
    ["子 Agent 的 `DONE` 不是完成证据", "implementer DONE rejection"],
    ["Critical / Important finding", "finding closure"],
    ["Phase 收口", "Phase integration review"],
  ]) {
    assert(fileContent(writeTarget, "AGENTS.md").includes(needle), `AGENTS ${label} rule missing`);
    assert(fileContent(writeTarget, "CLAUDE.md").includes(needle), `CLAUDE ${label} rule missing`);
  }
  assert(!fileContent(writeTarget, "AGENTS.md").includes("公共契约、跨模块、"), "AGENTS must not drop the three-module threshold");
  assert(!fileContent(writeTarget, "CLAUDE.md").includes("公共契约、跨模块、"), "CLAUDE must not drop the three-module threshold");
  assert(fileContent(writeTarget, "AGENTS.md").includes("Markdown 已记录内容不得因命名或分卷而删除"), "AGENTS Markdown content-preservation rule missing");
  assert(fileContent(writeTarget, "AGENTS.md").includes("Markdown 分卷命名：正文文件名使用中文短编号加主题"), "AGENTS Markdown human-filename rule missing");
  assert(fileContent(writeTarget, "AGENTS.md").includes("全项目正文不得重复"), "AGENTS Markdown unique-section rule missing");
  assert(fileContent(writeTarget, "AGENTS.md").includes("Markdown 专属文件夹：每个导航门面 `X.md` 的正文只能放入同名 `X/` 文件夹"), "AGENTS Markdown dedicated-directory rule missing");
  assert(fileContent(writeTarget, "AGENTS.md").includes("Markdown 自动治理：启用 `markdownGovernance` 的项目中，每次新建、改写、移动或拆分 Markdown 后"), "AGENTS Markdown automatic-governance rule missing");
  assert(fileContent(writeTarget, "AGENTS.md").includes("Markdown 链接与备份：项目内 Markdown 链接必须指向实际存在的文件"), "AGENTS Markdown link rule missing");
  // 经验库已彻底移除：宪法正文不得再出现任何经验库规则（零残留回归）。
  assert(!fileContent(writeTarget, "AGENTS.md").includes("项目经验"), "AGENTS must not retain the removed project-experience rule");
  assert(!fileContent(writeTarget, "CLAUDE.md").includes("双运行时经验边界"), "CLAUDE must not retain the removed dual-runtime experience boundary");
  assert(!fileContent(writeTarget, "CLAUDE.md").includes("experience-governance"), "CLAUDE must not reference the removed experience tool");
  // 经验升级体系主干：宪法正文须声明经验治理台账是受控例外（正向断言）。
  assert(fileContent(writeTarget, "AGENTS.md").includes("经验治理受控例外"), "AGENTS must declare experience-ledger controlled exception");
  assert(fileContent(writeTarget, "CLAUDE.md").includes("经验治理受控例外"), "CLAUDE must declare experience-ledger controlled exception");
  assert(fileContent(writeTarget, "AGENTS.md").includes("显性纠错事件只能进入一个 scope"), "AGENTS must carry the single-scope correction rule");
  assert(fileContent(writeTarget, "CLAUDE.md").includes("docs/项目治理/经验治理.md"), "CLAUDE must point at the governed L0 ledger path");
  assert(fileContent(writeTarget, "AGENTS.md").includes("（待生效："), "AGENTS pending-rules marker missing");
  // C1：待生效条款的激活动作必须落在 block 外，且禁止手改受 checksum 保护的 block 文字，
  // 否则“自助激活”与“checksum 保护”互相锁死。
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    assert(fileContent(writeTarget, file).includes("不得手改 block 内文字"), `${file} C1 no-hand-edit rule missing`);
    assert(fileContent(writeTarget, file).includes("在 block 外登记激活"), `${file} C1 out-of-block activation rule missing`);
    assert(
      !fileContent(writeTarget, file).includes("去掉“待生效”标注"),
      `${file} must not instruct hand-deleting the 待生效 marker inside the managed block`,
    );
  }
  assert(fileContent(writeTarget, "CLAUDE.md").includes("先契约后代码"), "CLAUDE interface-first rule missing");
  // 方案甲：两文件规则同源，除“运行时：”一行外应逐字一致，check-runtime-sync 必须通过。
  const syncChecker = path.join(repoRoot, "tools", "check-runtime-sync.mjs");
  const syncOk = spawnSync(process.execPath, [syncChecker, writeTarget, "--json"], { cwd: repoRoot, encoding: "utf8" });
  assert(syncOk.status === 0, `runtime sync check should pass on freshly generated files: ${syncOk.stdout || syncOk.stderr}`);
  // 手改 CLAUDE.md 制造漂移后，sync check 必须报错。
  const drifted = fileContent(writeTarget, "CLAUDE.md").replace("先契约后代码", "先写代码后补契约");
  writeFile(path.join(writeTarget, "CLAUDE.md"), drifted);
  const syncFail = spawnSync(process.execPath, [syncChecker, writeTarget, "--json"], { cwd: repoRoot, encoding: "utf8" });
  assert(syncFail.status === 1, "runtime sync check should fail when the two files diverge");
  // 复原，避免污染后续断言。
  writeFile(path.join(writeTarget, "CLAUDE.md"), fileContent(writeTarget, "CLAUDE.md").replace("先写代码后补契约", "先契约后代码"));
  const runtimeRegistry = JSON.parse(fileContent(writeTarget, ".vibe-runtime.json"));
  assert(runtimeRegistry.runtimeBlocks["AGENTS.md"], "AGENTS registry entry missing");
  assert(runtimeRegistry.runtimeBlocks["CLAUDE.md"], "CLAUDE registry entry missing");
  assert(runtimeRegistry.runtimeBlocks["AGENTS.md"].version === "21", "AGENTS registry version should be 21");
  assert(runtimeRegistry.runtimeBlocks["CLAUDE.md"].version === "21", "CLAUDE registry version should be 21");
  assert(fileContent(writeTarget, "AGENTS.md").includes("根目录 Markdown 白名单仅 `AGENTS.md`、`CLAUDE.md`、`文档索引.md`"), "runtime block must state the root Markdown whitelist");
  assert(fileContent(writeTarget, "AGENTS.md").includes("Git worktree 身份核对与单任务单工区"), "runtime block must include the Git worktree identity rule");
  assert(fileContent(writeTarget, "AGENTS.md").includes("临时产物、验证副本和 Git 基线保护"), "runtime block must include the baseline and temporary-artifact rule");

  const afterFirstWrite = {
    agents: fileContent(writeTarget, "AGENTS.md"),
    claude: fileContent(writeTarget, "CLAUDE.md"),
    registry: fileContent(writeTarget, ".vibe-runtime.json"),
  };
  const secondWrite = run([writeTarget, "--skills-root", fixtureSkillsRoot, "--write", "--json"]);
  const secondPayload = parseJson(secondWrite.stdout);
  assert(secondWrite.status === 0, "second write should pass");
  assert(secondPayload.files.every((file) => file.action === "none"), "second write should be idempotent");
  assert(fileContent(writeTarget, "AGENTS.md") === afterFirstWrite.agents, "AGENTS should be unchanged on second write");
  assert(fileContent(writeTarget, "CLAUDE.md") === afterFirstWrite.claude, "CLAUDE should be unchanged on second write");
  assert(fileContent(writeTarget, ".vibe-runtime.json") === afterFirstWrite.registry, "registry should be unchanged on second write");
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    writeFile(path.join(writeTarget, file), fileContent(writeTarget, file).replace("-->\n\n## Agent 宪法", "-->\n## Agent 宪法"));
  }
  const legacyFormattingCheck = run([writeTarget, "--skills-root", fixtureSkillsRoot, "--check", "--json"]);
  assert(legacyFormattingCheck.status === 0, `legacy formatting should pass: ${legacyFormattingCheck.stderr || legacyFormattingCheck.stdout}`);

  const existingTarget = makeTarget(tmpRoot, "existing target");
  writeFile(path.join(existingTarget, "AGENTS.md"), "# Custom Agent Rules\n\nKeep this line.\n");
  writeFile(path.join(existingTarget, "CLAUDE.md"), "# Custom Claude Rules\n\nKeep this too.\n");
  const existingWrite = run([existingTarget, "--skills-root", fixtureSkillsRoot, "--write", "--json"]);
  assert(existingWrite.status === 0, "existing file write should pass");
  assert(fileContent(existingTarget, "AGENTS.md").startsWith("# Custom Agent Rules\n\nKeep this line.\n"), "AGENTS user content changed");
  assert(fileContent(existingTarget, "CLAUDE.md").startsWith("# Custom Claude Rules\n\nKeep this too.\n"), "CLAUDE user content changed");

  const checkCurrent = run([existingTarget, "--skills-root", fixtureSkillsRoot, "--check", "--json"]);
  assert(checkCurrent.status === 0, `check current should pass: ${checkCurrent.stdout}`);

  const crlfTarget = makeTarget(tmpRoot, "crlf target");
  writeFile(path.join(crlfTarget, "AGENTS.md"), "# Custom Agent Rules\r\n\r\nKeep this line.\r\n");
  writeFile(path.join(crlfTarget, "CLAUDE.md"), "# Custom Claude Rules\r\n\r\nKeep this too.\r\n");
  const crlfFirstWrite = run([crlfTarget, "--skills-root", fixtureSkillsRoot, "--write", "--json"]);
  assert(crlfFirstWrite.status === 0, `CRLF first write should pass: ${crlfFirstWrite.stderr || crlfFirstWrite.stdout}`);
  writeFile(path.join(crlfTarget, "AGENTS.md"), toCrLf(fileContent(crlfTarget, "AGENTS.md")));
  writeFile(path.join(crlfTarget, "CLAUDE.md"), toCrLf(fileContent(crlfTarget, "CLAUDE.md")));
  const alternateSkillsRoot = makeSkillsRoot(path.join(tmpRoot, "alternate"));
  const crlfUpdate = run([crlfTarget, "--skills-root", alternateSkillsRoot, "--write", "--json"]);
  assert(crlfUpdate.status === 0, `CRLF update should pass: ${crlfUpdate.stderr || crlfUpdate.stdout}`);
  const crlfAgents = fileContent(crlfTarget, "AGENTS.md");
  const crlfClaude = fileContent(crlfTarget, "CLAUDE.md");
  assert(crlfAgents.startsWith("# Custom Agent Rules\r\n\r\nKeep this line.\r\n"), "CRLF AGENTS user content changed");
  assert(crlfClaude.startsWith("# Custom Claude Rules\r\n\r\nKeep this too.\r\n"), "CRLF CLAUDE user content changed");
  assert(!crlfAgents.includes("Keep this line.<!--"), "CRLF AGENTS marker was glued to user content");
  assert(!crlfClaude.includes("Keep this too.<!--"), "CRLF CLAUDE marker was glued to user content");
  const crlfCheck = run([crlfTarget, "--skills-root", alternateSkillsRoot, "--check", "--json"]);
  assert(crlfCheck.status === 0, `CRLF check should pass after update: ${crlfCheck.stderr || crlfCheck.stdout}`);

  const gluedTarget = makeTarget(tmpRoot, "glued marker target");
  const gluedWrite = run([gluedTarget, "--skills-root", fixtureSkillsRoot, "--write", "--json"]);
  assert(gluedWrite.status === 0, "glued marker target write should pass");
  writeFile(
    path.join(gluedTarget, "AGENTS.md"),
    fileContent(gluedTarget, "AGENTS.md").replace(
      "\n\n<!-- vibe-coding-skills:target-runtime:start",
      "<!-- vibe-coding-skills:target-runtime:start",
    ),
  );
  const gluedCheck = run([gluedTarget, "--skills-root", fixtureSkillsRoot, "--check", "--json"]);
  const gluedCheckPayload = parseJson(gluedCheck.stdout);
  assert(gluedCheck.status === 1, "glued runtime marker should fail check");
  assert(
    gluedCheckPayload.files.some((file) => file.file === "AGENTS.md" && file.action === "conflict"),
    "glued runtime marker should be reported as AGENTS conflict",
  );

  fs.rmSync(path.join(existingTarget, ".vibe-runtime.json"), { force: true });
  const missingRegistryCheck = run([existingTarget, "--skills-root", fixtureSkillsRoot, "--check", "--json"]);
  const missingRegistryPayload = parseJson(missingRegistryCheck.stdout);
  assert(missingRegistryCheck.status === 1, "missing runtime registry should fail check");
  assert(
    missingRegistryPayload.files.some((file) => file.file === ".vibe-runtime.json" && file.action === "create"),
    "missing registry should be reported",
  );
  const restoreRegistry = run([existingTarget, "--skills-root", fixtureSkillsRoot, "--write", "--json"]);
  assert(restoreRegistry.status === 0, "registry restore should pass");

  const staleRegistry = JSON.parse(fileContent(existingTarget, ".vibe-runtime.json"));
  staleRegistry.runtimeBlocks["AGENTS.md"].checksum = "0".repeat(64);
  writeFile(path.join(existingTarget, ".vibe-runtime.json"), `${JSON.stringify(staleRegistry, null, 2)}\n`);
  const staleRegistryCheck = run([existingTarget, "--skills-root", fixtureSkillsRoot, "--check", "--json"]);
  const staleRegistryPayload = parseJson(staleRegistryCheck.stdout);
  assert(staleRegistryCheck.status === 1, "stale runtime registry should fail check");
  assert(
    staleRegistryPayload.files.some((file) => file.file === ".vibe-runtime.json" && file.action === "update"),
    "stale registry should be reported",
  );

  const conflictedAgents = fileContent(existingTarget, "AGENTS.md").replace(
    "小任务快车道优先",
    "Manual edit inside managed block",
  );
  writeFile(path.join(existingTarget, "AGENTS.md"), conflictedAgents);
  const conflictCheck = run([existingTarget, "--skills-root", fixtureSkillsRoot, "--check", "--json"]);
  const conflictPayload = parseJson(conflictCheck.stdout);
  assert(conflictCheck.status === 1, "checksum mismatch should fail check");
  assert(
    conflictPayload.files.some((file) => file.file === "AGENTS.md" && file.action === "conflict"),
    "conflict should be reported for AGENTS.md",
  );

  const invalidSkills = run([makeTarget(tmpRoot, "invalid skills target"), "--skills-root", path.join(tmpRoot, "missing"), "--dry-run"]);
  assert(invalidSkills.status === 2, "invalid skills root should exit 2");

  const packageRoot = makeTarget(tmpRoot, "package root");
  writeFile(path.join(packageRoot, "AGENTS.md"), "# AGENTS\n");
  writeFile(path.join(packageRoot, "Product-Spec.md"), "# Spec\n");
  writeFile(path.join(packageRoot, "DEV-PLAN.md"), "# Plan\n");
  fs.mkdirSync(path.join(packageRoot, "skills"), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, "tools"), { recursive: true });
  const packageRefusal = run([packageRoot, "--skills-root", fixtureSkillsRoot, "--dry-run"]);
  assert(packageRefusal.status === 2, "package-like root should be refused");

  const docsTarget = makeTarget(tmpRoot, "docs target");
  writeFile(
    path.join(docsTarget, ".vibe-docs.json"),
    JSON.stringify(
      {
        productSpec: "需求文档.md",
        devPlan: "开发计划.md",
      },
      null,
      2,
    ),
  );
  writeFile(path.join(docsTarget, "需求文档.md"), "# 需求\n");
  writeFile(path.join(docsTarget, "开发计划.md"), "# 计划\n");
  const docsWrite = run([docsTarget, "--skills-root", fixtureSkillsRoot, "--write"]);
  assert(docsWrite.status === 0, "docs target write should pass");
  const docNames = runDocNames(docsTarget);
  assert(docNames.status === 0, `runtime files should not affect target doc names: ${docNames.stderr || docNames.stdout}`);

  const hardlinkTarget = makeTarget(tmpRoot, "hardlink target");
  const outsideAgents = path.join(tmpRoot, "outside-AGENTS.md");
  writeFile(outsideAgents, "# Outside rules\n\nMust remain unchanged.\n");
  fs.linkSync(outsideAgents, path.join(hardlinkTarget, "AGENTS.md"));
  const hardlinkWrite = run([hardlinkTarget, "--skills-root", fixtureSkillsRoot, "--write", "--json"]);
  assert(hardlinkWrite.status === 0, hardlinkWrite.stderr || hardlinkWrite.stdout);
  assert(
    fs.readFileSync(outsideAgents, "utf8") === "# Outside rules\n\nMust remain unchanged.\n",
    "runtime setup must atomically replace a target hardlink instead of mutating the outside inode",
  );
  assert(fileContent(hardlinkTarget, "AGENTS.md").includes("vibe-coding-skills:target-runtime:start"));

  const symlinkTarget = makeTarget(tmpRoot, "symlink target");
  const outsideClaude = path.join(tmpRoot, "outside-CLAUDE.md");
  writeFile(outsideClaude, "# Outside Claude rules\n");
  try {
    fs.symlinkSync(outsideClaude, path.join(symlinkTarget, "CLAUDE.md"), "file");
    const symlinkWrite = run([symlinkTarget, "--skills-root", fixtureSkillsRoot, "--write", "--json"]);
    assert(symlinkWrite.status === 2, "runtime setup must reject a symlink destination");
    assert(fs.readFileSync(outsideClaude, "utf8") === "# Outside Claude rules\n");
  } catch (error) {
    if (error?.code !== "EPERM" && error?.code !== "EACCES") throw error;
    const outsideLinkedDirectory = makeTarget(tmpRoot, "outside linked directory");
    writeFile(path.join(outsideLinkedDirectory, "CLAUDE.md"), "# Outside linked Claude rules\n");
    const linkedDirectory = path.join(symlinkTarget, "linked parent");
    fs.symlinkSync(outsideLinkedDirectory, linkedDirectory, "junction");
    let fallbackError = null;
    try {
      safeWriteTargetFile(symlinkTarget, "linked parent/CLAUDE.md", "# Replacement\n");
    } catch (writeError) {
      fallbackError = writeError;
    }
    assert(
      fallbackError && /symlink|junction|outside project root/iu.test(fallbackError.message),
      "safe target writer must reject a junction parent when file symlink creation is unavailable",
    );
    assert(
      fs.readFileSync(path.join(outsideLinkedDirectory, "CLAUDE.md"), "utf8") === "# Outside linked Claude rules\n",
      "junction fallback must not mutate the outside file",
    );
    console.warn(`ENVIRONMENT-BLOCKED runtime file-symlink regression: ${error.message}`);
    console.warn("PASS runtime junction-parent fallback: safe target writer rejected the linked path");
  }

  if (process.platform === "win32") {
    const junctionRealTarget = makeTarget(tmpRoot, "junction real target");
    const junctionPath = path.join(tmpRoot, "junction target");
    fs.symlinkSync(junctionRealTarget, junctionPath, "junction");
    const junctionWrite = run([junctionPath, "--skills-root", fixtureSkillsRoot, "--write", "--json"]);
    assert(junctionWrite.status === 2, "runtime setup must reject a Windows junction target root");
  }

  console.log("Target runtime setup tests passed");
} finally {
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
}
