#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { checkMarkdownGovernance } from "./markdown-governance-core.mjs";
import { resolveTargetDocContext } from "./resolve-target-doc-context.mjs";

const toolsRoot = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1)));
const corePath = path.join(toolsRoot, "target-doc-manifest-core.mjs");
const indexPath = path.join(toolsRoot, "build-target-doc-index.mjs");
const resolverPath = path.join(toolsRoot, "resolve-target-doc-context.mjs");
const markdownCheckerPath = path.join(toolsRoot, "check-markdown-governance.mjs");
const budgetPath = path.join(toolsRoot, "check-lifecycle-doc-budget.mjs");
const driftPath = path.join(toolsRoot, "check-target-doc-drift.mjs");

function makeRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `target-doc-governance-${label}-`));
}

function write(root, relative, content) {
  const target = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function readJson(root, relative = ".vibe-docs.json") {
  return JSON.parse(fs.readFileSync(path.join(root, ...relative.split("/")), "utf8"));
}

function run(script, root, args = []) {
  return spawnSync(process.execPath, [script, root, ...args], { encoding: "utf8" });
}

function baseDocuments() {
  const mappings = {
    productSpec: "需求文档.md",
    devPlan: "开发计划.md",
    currentExecution: "plans/执行光标.md",
    manualAcceptance: "验收记录.md",
    interfaceContracts: "接口契约.md",
    projectProfile: "项目画像.md",
    constitutionDesign: "宪法设计.md",
    documentIndex: "文档索引.md",
  };
  return Object.entries(mappings).map(([role, docPath], index) => ({
    role,
    path: docPath,
    owner: role === "documentIndex" ? "target-doc-index" : role === "devPlan" || role === "currentExecution" ? "dev-planner" : "target-doc-owner",
    authority: role === "documentIndex" || role === "currentExecution" ? "projection" : "source",
    contentHash: "sha256:" + String(index).repeat(64),
    estimatedTokens: 0,
    dependsOn: role === "productSpec" ? [] : ["productSpec"],
    sections: [],
  }));
}

function baseManifest(overrides = {}) {
  return {
    schemaVersion: 2,
    productSpec: "需求文档.md",
    devPlan: "开发计划.md",
    currentExecution: "plans/执行光标.md",
    manualAcceptance: "验收记录.md",
    interfaceContracts: "接口契约.md",
    projectProfile: "项目画像.md",
    constitutionDesign: "宪法设计.md",
    documentIndex: "文档索引.md",
    documents: baseDocuments(),
    loadPolicy: { always: ["documentIndex"], never: [] },
    ...overrides,
  };
}

function seedDocs(root) {
  write(root, "需求文档.md", "# 需求文档\n\n<!-- vibe-section:REQ-001 -->\n## 登录需求\n\n允许用户登录。\n");
  write(root, "开发计划.md", "# 开发计划\n\n<!-- vibe-section:PLAN-001 -->\n## 第一阶段\n\n实现登录。\n");
  write(root, "plans/执行光标.md", "# 执行光标\n\n当前任务：P1-T1\n");
  write(root, "验收记录.md", "# 验收记录\n\n尚未验收。\n");
  write(root, "接口契约.md", "# 接口契约\n\n暂无接口。\n");
  write(root, "项目画像.md", "# 项目画像\n\n测试项目。\n");
  write(root, "宪法设计.md", "# 宪法设计\n\n测试规则。\n");
}

test("manifest core exposes one strict v2 contract and a legacy adapter", async () => {
  const core = await import(pathToFileURL(corePath).href + `?t=${Date.now()}`);
  for (const name of ["loadTargetDocManifest", "validateTargetDocManifest", "collectDocumentEntries", "estimateTokens", "hashContent"]) {
    assert.equal(typeof core[name], "function", `missing public export ${name}`);
  }

  const valid = core.validateTargetDocManifest(baseManifest());
  assert.equal(valid.ok, true, JSON.stringify(valid.issues));
  assert.equal(core.collectDocumentEntries(baseManifest()).length, 8);
  assert.match(core.hashContent("hello"), /^sha256:[a-f0-9]{64}$/u);
  assert(core.estimateTokens("中文abcd") >= 3);

  const legacy = core.validateTargetDocManifest({ productSpec: "需求文档.md", loadPolicy: { always: [], never: [] } }, { allowLegacy: true });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.migrationRequired, true);
  assert.equal(legacy.manifest.productSpec, "需求文档.md");
});

test("contentHash 将逻辑相同的 LF 与 CRLF 文档视为同一内容", async () => {
  const { estimateTokens, hashContent } = await import(pathToFileURL(corePath).href + `?t=${Date.now()}`);
  const lfFixture = "# 接口契约\n\n<!-- vibe-section:API-001 -->\n## 登录\n\n允许用户登录。\n";
  const crlfFixture = lfFixture.replaceAll("\n", "\r\n");
  const crFixture = lfFixture.replaceAll("\n", "\r");

  assert.notEqual(lfFixture, crlfFixture, "夹具必须保留不同的原始换行符");
  assert.equal(hashContent(lfFixture), hashContent(crlfFixture));
  assert.equal(hashContent(lfFixture), hashContent(crFixture));
  assert.equal(estimateTokens(lfFixture), estimateTokens(crlfFixture));
  assert.equal(estimateTokens(lfFixture), estimateTokens(crFixture));
  assert.notEqual(hashContent(lfFixture), hashContent(lfFixture.replace("允许用户登录。", "拒绝用户登录。")));
});

test("仅将接口契约换为 CRLF 不会触发索引、resolver 或 drift 伪漂移", () => {
  const root = makeRoot("line-ending-drift");
  try {
    seedDocs(root);
    write(root, ".vibe-docs.json", JSON.stringify(baseManifest(), null, 2) + "\n");
    assert.equal(run(indexPath, root, ["--write"]).status, 0);

    const lfContract = fs.readFileSync(path.join(root, "接口契约.md"), "utf8");
    write(root, "接口契约.md", lfContract.replaceAll("\n", "\r\n"));

    assert.equal(run(indexPath, root, ["--check"]).status, 0, "换行符变化不得使索引 metadata 过期");
    assert.equal(run(resolverPath, root, ["--roles", "interfaceContracts", "--json"]).status, 0, "resolver 不得将 CRLF 视为正文变化");
    assert.equal(run(driftPath, root, ["--quick", "--strict", "--json"]).status, 0, "drift 检查不得报告仅换行符造成的过期");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("manifest core accepts the distributed optional architecture, evidence, and lessons roles", async () => {
  const { validateTargetDocManifest } = await import(pathToFileURL(corePath).href + `?t=${Date.now()}`);
  const extras = [
    ["systemArchitecture", "系统架构.md"],
    ["validatedEvidence", "实测证据.md"],
    ["projectLessons", "经验教训.md"],
  ];
  const manifest = baseManifest({
    ...Object.fromEntries(extras),
    documents: [
      ...baseDocuments(),
      ...extras.map(([role, docPath], index) => ({
        role,
        path: docPath,
        owner: `test:${role}`,
        authority: "source",
        contentHash: `sha256:${["8", "9", "a"][index].repeat(64)}`,
        estimatedTokens: 0,
        dependsOn: [],
        sections: [],
      })),
    ],
  });
  const result = validateTargetDocManifest(manifest);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("manifest core registers experienceGovernance as an optional source role", async () => {
  const core = await import(pathToFileURL(corePath));
  const manifest = baseManifest({
    experienceGovernance: "docs/项目治理/经验治理.md",
    documents: [
      ...baseDocuments(),
      {
        role: "experienceGovernance",
        path: "docs/项目治理/经验治理.md",
        owner: "experience-elevator",
        authority: "source",
        contentHash: `sha256:${"a".repeat(64)}`,
        estimatedTokens: 0,
        dependsOn: ["constitutionDesign"],
        sections: [],
      },
    ],
  });
  const result = core.validateTargetDocManifest(manifest);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("manifest core rejects malformed roles, duplicate paths, overlap, and mapping drift", async () => {
  const { validateTargetDocManifest } = await import(pathToFileURL(corePath).href + `?t=${Date.now()}`);
  const cases = [
    baseManifest({ schemaVersion: "2" }),
    baseManifest({ loadPolicy: { always: ["unknownRole"], never: [] } }),
    baseManifest({ loadPolicy: { always: ["productSpec"], never: ["productSpec"] } }),
    baseManifest({ documents: [...baseDocuments(), { ...baseDocuments()[1], role: "manualAcceptance" }] }),
    baseManifest({ productSpec: "其他需求.md" }),
  ];
  for (const manifest of cases) {
    const result = validateTargetDocManifest(manifest);
    assert.equal(result.ok, false, `expected invalid manifest: ${JSON.stringify(manifest)}`);
    assert(result.issues.length > 0);
  }
});

test("index writer generates 文档索引.md plus fresh file and section metadata", () => {
  const root = makeRoot("index");
  seedDocs(root);
  write(root, ".vibe-docs.json", JSON.stringify(baseManifest(), null, 2) + "\n");

  const written = run(indexPath, root, ["--write", "--json"]);
  assert.equal(written.status, 0, written.stderr || written.stdout);
  const output = JSON.parse(written.stdout);
  assert.equal(output.changed, true);
  assert(fs.existsSync(path.join(root, "文档索引.md")));
  const manifest = readJson(root);
  const spec = manifest.documents.find((entry) => entry.role === "productSpec");
  assert.match(spec.contentHash, /^sha256:[a-f0-9]{64}$/u);
  assert(spec.estimatedTokens > 0);
  assert.deepEqual(spec.sections.map((section) => section.id), ["REQ-001"]);
  assert.equal(spec.sections[0].heading, "登录需求");
  assert(spec.sections[0].startLine < spec.sections[0].endLine);

  const checked = run(indexPath, root, ["--check", "--json"]);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  assert.equal(JSON.parse(checked.stdout).stale.length, 0);
});

test("resolver defaults to always, loads explicit onDemand, and refuses never", () => {
  const root = makeRoot("resolver-policy");
  seedDocs(root);
  write(root, ".vibe-docs.json", JSON.stringify(baseManifest({ loadPolicy: { always: ["documentIndex"], never: ["devPlan"] } }), null, 2) + "\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);

  const defaultResult = run(resolverPath, root, ["--json"]);
  assert.equal(defaultResult.status, 0, defaultResult.stderr);
  assert.deepEqual(JSON.parse(defaultResult.stdout).allowed.map((entry) => entry.role), ["documentIndex"]);

  const onDemand = run(resolverPath, root, ["--roles", "productSpec", "--json"]);
  assert.equal(onDemand.status, 0, onDemand.stderr || onDemand.stdout);
  assert(JSON.parse(onDemand.stdout).allowed.some((entry) => entry.role === "productSpec"));

  const denied = run(resolverPath, root, ["--roles", "devPlan", "--json"]);
  assert.equal(denied.status, 1, denied.stderr || denied.stdout);
  assert.equal(JSON.parse(denied.stdout).denied[0].reason, "never-policy");

  const audited = run(resolverPath, root, ["--roles", "devPlan", "--allow-never", "--reason", "full audit", "--json"]);
  assert.equal(audited.status, 0, audited.stderr || audited.stdout);
});

test("resolver can select one registered collection document without loading its siblings", () => {
  const root = makeRoot("resolver-document");
  seedDocs(root);
  write(root, "plans/审批.md", "<!-- vibe-section:PLAN-010 -->\n## 审批\n\n只读这一份。\n");
  write(root, "plans/成果.md", "<!-- vibe-section:PLAN-022 -->\n## 成果\n\n不应被读取。\n");
  const manifest = baseManifest({
    planDetails: ["plans/审批.md", "plans/成果.md"],
    documents: [
      ...baseDocuments(),
      ...["plans/审批.md", "plans/成果.md"].map((docPath) => ({
        role: "planDetails",
        path: docPath,
        owner: "design-owner",
        authority: "source",
        contentHash: "sha256:" + "5".repeat(64),
        estimatedTokens: 0,
        dependsOn: ["productSpec"],
        sections: [],
      })),
    ],
  });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);

  const result = run(resolverPath, root, ["--document", "planDetails:plans/审批.md", "--budget", "1200", "--json"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.allowed.map((entry) => `${entry.role}:${entry.path}`), [
    "documentIndex:文档索引.md",
    "planDetails:plans/审批.md",
  ]);
  assert.equal(payload.totalTokens < 1200, true);
});

test("Markdown governance requires a small linked facade and supports precise single-file reads", () => {
  const root = makeRoot("markdown-governance");
  seedDocs(root);
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [审批](设计简报/010-审批.md)\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n\n[返回设计简报](../设计简报.md)\n\n只读这一份。\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000, archiveDirectories: ["Markdown文档备份"] } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  write(root, "Markdown文档备份/历史.md", "中".repeat(9000));
  const passed = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(passed.status, 0, passed.stderr || passed.stdout);

  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n## 审批\n\n[返回设计简报](../设计简报.md)\n");
  const failed = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(failed.status, 1, failed.stderr || failed.stdout);
  assert(JSON.parse(failed.stdout).findings.some((finding) => finding.code === "detail_heading_not_h1"));

  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n\n[返回设计简报](../设计简报.md)\n\n只读这一份。\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);
  const selected = run(resolverPath, root, ["--markdown", "设计简报/010-审批.md", "--budget", "1200", "--json"]);
  assert.equal(selected.status, 0, selected.stderr || selected.stdout);
  assert(JSON.parse(selected.stdout).allowed.some((entry) => entry.role === "markdown" && entry.path === "设计简报/010-审批.md"));

  const archive = run(resolverPath, root, ["--markdown", "Markdown文档备份/历史.md", "--json"]);
  assert.equal(archive.status, 1, archive.stderr || archive.stdout);
  assert.equal(JSON.parse(archive.stdout).denied.at(-1).reason, "markdown-archive-forbidden");
});

test("Markdown governance excludes runtime worktree capsules but keeps ordinary .claude Markdown", () => {
  const root = makeRoot("markdown-runtime-worktree");
  seedDocs(root);
  write(root, ".claude/说明.md", "<!-- vibe-markdown-facade: .claude/说明 -->\n# 真实运行时说明\n\n这是目标项目本体中的 Markdown。\n");
  write(root, ".codex/说明.md", "<!-- vibe-markdown-facade: .codex/说明 -->\n# 真实 Codex 说明\n\n这是目标项目本体中的 Markdown。\n");
  write(root, ".claude/worktrees/project-capsule/docs/设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 隔离副本\n\n- [副本详情](设计简报/010-副本.md)\n");
  write(root, ".claude/worktrees/project-capsule/docs/设计简报/010-副本.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 副本详情\n\n[返回](../设计简报.md)\n");
  write(root, ".codex/worktrees/project-capsule/docs/设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# Codex 隔离副本\n\n- [副本详情](设计简报/010-副本.md)\n");
  write(root, ".codex/worktrees/project-capsule/docs/设计简报/010-副本.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# Codex 副本详情\n\n[返回](../设计简报.md)\n");
  write(root, "worktree/.claude/diancang-frontend/文档索引.md", "<!-- vibe-markdown-facade: 文档索引 -->\n# 嵌套 Claude 任务副本\n");
  write(root, "worktree/.codex/turn-cancel-race/文档索引.md", "<!-- vibe-markdown-facade: 文档索引 -->\n# 嵌套 Codex 任务副本\n");
  write(root, "worktrees/说明.md", "<!-- vibe-markdown-facade: worktrees/说明 -->\n# 普通 worktrees 目录\n\n这不是运行时隔离树。\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");

  const coreResult = checkMarkdownGovernance(root, manifest, { includeFiles: true });
  assert.equal(coreResult.files, 10);
  assert(coreResult.findings.some((finding) => finding.file === ".claude/说明.md" && finding.code === "facade_has_no_details"));
  assert(coreResult.findings.some((finding) => finding.file === ".codex/说明.md" && finding.code === "facade_has_no_details"));
  assert(coreResult.findings.some((finding) => finding.file === "worktrees/说明.md" && finding.code === "facade_has_no_details"));
  assert(!coreResult.findings.some((finding) => finding.file?.startsWith(".claude/worktrees/") || finding.file?.startsWith(".codex/worktrees/")));
  assert(!coreResult.findings.some((finding) => finding.file?.startsWith("worktree/.claude/") || finding.file?.startsWith("worktree/.codex/")));
  assert(!coreResult.governedFiles.some((file) => file.startsWith(".claude/worktrees/") || file.startsWith(".codex/worktrees/")));
  assert(!coreResult.governedFiles.some((file) => file.startsWith("worktree/.claude/") || file.startsWith("worktree/.codex/")));

  const checked = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(checked.status, 1, checked.stderr || checked.stdout);
  const payload = JSON.parse(checked.stdout);
  assert(payload.files > 0);
  assert(!payload.findings.some((finding) => finding.file?.startsWith(".claude/worktrees/")));
  assert(!payload.findings.some((finding) => finding.file?.startsWith(".codex/worktrees/")));
  assert(!payload.findings.some((finding) => finding.file?.startsWith("worktree/.claude/") || finding.file?.startsWith("worktree/.codex/")));
});

test("Markdown governance rejects a detail without a backlink to its facade", () => {
  const root = makeRoot("markdown-backlink");
  seedDocs(root);
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [审批](设计简报/010-审批.md)\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n\n只读这一份。\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");

  const checked = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(checked.status, 1, checked.stderr || checked.stdout);
  assert(JSON.parse(checked.stdout).findings.some((finding) => finding.code === "detail_missing_facade_backlink" && finding.file === "设计简报/010-审批.md" && finding.facade === "设计简报.md"));
});

test("resolver rejects Markdown that is not linked from a facade", () => {
  const root = makeRoot("markdown-resolver-link-boundary");
  seedDocs(root);
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [审批](设计简报/010-审批.md)\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n\n[返回设计简报](../设计简报.md)\n");
  write(root, "设计简报/020-未登记.md", "<!-- vibe-section:DESIGNBRIEF-020 -->\n# 未登记\n\n[返回设计简报](../设计简报.md)\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);

  const result = run(resolverPath, root, ["--markdown", "设计简报/020-未登记.md", "--json"]);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert(JSON.parse(result.stdout).denied.some((entry) => entry.path === "设计简报/020-未登记.md" && entry.reason === "markdown-not-linked-from-facade"));
});

test("Markdown governance ignores links inside fenced code and HTML comments", () => {
  const root = makeRoot("markdown-visible-links");
  seedDocs(root);
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n```md\n[审批](设计简报/010-审批.md)\n```\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n\n<!-- [返回设计简报](../设计简报.md) -->\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);

  const checked = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(checked.status, 1, checked.stderr || checked.stdout);
  const codes = JSON.parse(checked.stdout).findings.map((finding) => finding.code);
  assert(codes.includes("detail_not_linked_from_facade"));
  assert(codes.includes("detail_missing_facade_backlink"));

  const selected = run(resolverPath, root, ["--markdown", "设计简报/010-审批.md", "--json"]);
  assert.equal(selected.status, 1, selected.stderr || selected.stdout);
  assert(JSON.parse(selected.stdout).denied.some((entry) => entry.reason === "markdown-not-linked-from-facade"));
});

test("Markdown governance ignores links inside multi-backtick inline code", () => {
  const root = makeRoot("markdown-multi-backtick-code");
  seedDocs(root);
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n``[审批](设计简报/010-审批.md)``\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n\n示例：```[返回设计简报](../设计简报.md)```\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");

  const checked = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(checked.status, 1, checked.stderr || checked.stdout);
  const codes = JSON.parse(checked.stdout).findings.map((finding) => finding.code);
  assert(codes.includes("detail_not_linked_from_facade"));
  assert(codes.includes("detail_missing_facade_backlink"));

  const selected = run(resolverPath, root, ["--markdown", "设计简报/010-审批.md", "--json"]);
  assert.equal(selected.status, 1, selected.stderr || selected.stdout);
  assert(JSON.parse(selected.stdout).denied.some((entry) => entry.reason === "markdown-not-linked-from-facade"));
});

test("Markdown governance keeps links next to escaped backticks visible", () => {
  const root = makeRoot("markdown-escaped-backticks");
  seedDocs(root);
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n\\`[审批](设计简报/010-审批.md)\\`\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n\n[返回设计简报](../设计简报.md)\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");

  const checked = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  assert.equal(run(indexPath, root, ["--write"]).status, 0);
  const selected = run(resolverPath, root, ["--markdown", "设计简报/010-审批.md", "--json"]);
  assert.equal(selected.status, 0, selected.stderr || selected.stdout);
  assert(JSON.parse(selected.stdout).allowed.some((entry) => entry.path === "设计简报/010-审批.md"));
});

test("resolver does not read unrelated Markdown when selecting one linked detail", () => {
  const root = makeRoot("markdown-bounded-read");
  seedDocs(root);
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [审批](设计简报/010-审批.md#验收)\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n\n[返回设计简报](../设计简报.md \"返回\")\n");
  write(root, "无关资料/999-不应读取.md", "# 不应读取\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);

  const unrelated = path.resolve(root, "无关资料", "999-不应读取.md");
  const originalReadFileSync = fs.readFileSync;
  fs.readFileSync = function guardedRead(file, ...args) {
    if (path.resolve(String(file)) === unrelated) throw new Error("resolver read unrelated Markdown");
    return originalReadFileSync.call(this, file, ...args);
  };
  try {
    let result;
    assert.doesNotThrow(() => {
      result = resolveTargetDocContext(root, { markdown: ["设计简报/010-审批.md"] });
    });
    assert(result.allowed.some((entry) => entry.role === "markdown" && entry.path === "设计简报/010-审批.md"));
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
});

test("resolver reports the parsed directory for an oversized nested facade", () => {
  const root = makeRoot("markdown-facade-diagnostic");
  seedDocs(root);
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [审批](设计简报/010-审批.md)\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-markdown-facade: 设计简报/010-审批 -->\n# 审批\n\n[返回设计简报](../设计简报.md)\n\n- [细则](010-审批/010-01-细则.md)\n");
  write(root, "设计简报/010-审批/010-01-细则.md", "<!-- vibe-section:DESIGNBRIEF-010-A -->\n# 细则\n\n[返回审批](../010-审批.md)\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 1 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);

  const selected = run(resolverPath, root, ["--markdown", "设计简报/010-审批.md", "--json"]);
  assert.equal(selected.status, 1, selected.stderr || selected.stdout);
  assert(JSON.parse(selected.stdout).denied.some((entry) => entry.reason === "facade-too-large" && entry.detailDirectory === "设计简报/010-审批"));
});

test("Markdown governance permits a small nested facade when a detail itself needs splitting", () => {
  const root = makeRoot("nested-markdown-facade");
  seedDocs(root);
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [审批](设计简报/010-审批.md)\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-markdown-facade: 设计简报/010-审批 -->\n# 审批\n\n[返回设计简报](../设计简报.md)\n\n- [细则](010-审批/010-01-细则.md)\n");
  write(root, "设计简报/010-审批/010-01-细则.md", "<!-- vibe-section:DESIGNBRIEF-010-A -->\n# 审批细则\n\n[返回审批](../010-审批.md)\n\n按需读取。\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  const checked = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  assert.equal(run(indexPath, root, ["--write"]).status, 0);
  const selected = run(resolverPath, root, ["--markdown", "设计简报/010-审批.md", "--budget", "1200", "--json"]);
  assert.equal(selected.status, 0, selected.stderr || selected.stdout);
});

test("Markdown governance requires a facade to use its own dedicated same-name directory", () => {
  const root = makeRoot("markdown-dedicated-directory");
  seedDocs(root);
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 分卷正文 -->\n# 设计简报\n\n- [审批](分卷正文/010-审批.md)\n");
  write(root, "分卷正文/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n");
  const checked = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(checked.status, 1, checked.stderr || checked.stdout);
  assert(JSON.parse(checked.stdout).findings.some((finding) => finding.code === "facade_directory_must_match_filename" && finding.file === "设计简报.md" && finding.expectedDirectory === "设计简报"));
});

test("Markdown governance keeps machine IDs out of human-facing detail filenames", () => {
  const root = makeRoot("markdown-human-filenames");
  seedDocs(root);
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [审批](设计简报/DESIGNBRIEF-010-审批.md)\n");
  write(root, "设计简报/DESIGNBRIEF-010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n\n[返回设计简报](../设计简报.md)\n");
  const machineNamed = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(machineNamed.status, 1, machineNamed.stderr || machineNamed.stdout);
  assert(JSON.parse(machineNamed.stdout).findings.some((finding) => finding.code === "detail_filename_not_human_readable"));

  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [审批](设计简报/010-审批.md)\n");
  fs.renameSync(path.join(root, "设计简报", "DESIGNBRIEF-010-审批.md"), path.join(root, "设计简报", "010-审批.md"));
  const humanNamed = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(humanNamed.status, 0, humanNamed.stderr || humanNamed.stdout);
});

test("Markdown governance rejects duplicate machine section IDs across detail files", () => {
  const root = makeRoot("markdown-duplicate-sections");
  seedDocs(root);
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [甲](设计简报/010-甲.md)\n- [乙](设计简报/010-乙.md)\n");
  write(root, "设计简报/010-甲.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 甲\n");
  write(root, "设计简报/010-乙.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 乙\n");
  const checked = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(checked.status, 1, checked.stderr || checked.stdout);
  const duplicates = JSON.parse(checked.stdout).findings.filter((finding) => finding.code === "duplicate_detail_section");
  assert.equal(duplicates.length, 2);
  assert(duplicates.every((finding) => finding.id === "DESIGNBRIEF-010" && finding.files.length === 2));
});

test("Markdown governance reports stale local Markdown links", () => {
  const root = makeRoot("markdown-stale-links");
  seedDocs(root);
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [审批](设计简报/010-审批.md)\n- [旧备份](已移出项目/设计简报.md)\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n");
  const checked = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(checked.status, 1, checked.stderr || checked.stdout);
  assert(JSON.parse(checked.stdout).findings.some((finding) => finding.code === "broken_project_markdown_link" && finding.file === "设计简报.md" && finding.target === "已移出项目/设计简报.md"));
});

test("Markdown governance derives Chinese appendix and version prefixes from machine IDs", () => {
  const root = makeRoot("markdown-human-prefixes");
  seedDocs(root);
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000 } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  write(root, "补充资料.md", "<!-- vibe-markdown-facade: 补充资料 -->\n# 补充资料\n\n- [附录](补充资料/附录-001-术语说明.md)\n- [版本变更](补充资料/版本2.21至2.16-入口调整.md)\n");
  write(root, "补充资料/附录-001-术语说明.md", "<!-- vibe-section:APPENDIX-001 -->\n# 术语说明\n\n[返回补充资料](../补充资料.md)\n");
  write(root, "补充资料/版本2.21至2.16-入口调整.md", "<!-- vibe-section:CHANGELOG-v2.21-v2.16 -->\n# 入口调整\n\n[返回补充资料](../补充资料.md)\n");
  const checked = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
});

test("Markdown governance reports a declared backup directory after it has been removed", () => {
  const root = makeRoot("missing-markdown-archive");
  seedDocs(root);
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000, archiveDirectories: ["已删除备份"] } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  const result = run(markdownCheckerPath, root, ["--json"]);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).findings[0].code, "archive_directory_missing");
});

test("resolver returns section ranges and rejects stale capsule revisions without whole-file fallback", () => {
  const root = makeRoot("resolver-selector");
  seedDocs(root);
  const manifest = baseManifest();
  manifest.taskContext = { enabled: true, taskCapsulesRoot: "plans/任务", currentTaskCapsule: "plans/任务/current" };
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);
  const indexed = readJson(root);
  const revision = indexed.documents.find((entry) => entry.role === "productSpec").contentHash;
  write(root, "plans/任务/current/实现上下文.jsonl", JSON.stringify({
    role: "productSpec",
    file: "需求文档.md",
    selector: { kind: "section", id: "REQ-001" },
    reason: "当前任务需求",
    source: "spec",
    required: true,
    sourceRevision: revision,
    maxTokens: 1200,
  }) + "\n");

  const selected = run(resolverPath, root, ["--capsule", "plans/任务/current", "--json"]);
  assert.equal(selected.status, 0, selected.stderr || selected.stdout);
  const selectedSpec = JSON.parse(selected.stdout).allowed.find((entry) => entry.role === "productSpec");
  assert.deepEqual(selectedSpec.selector, { kind: "section", id: "REQ-001" });
  assert(Number.isInteger(selectedSpec.startLine));
  assert(Number.isInteger(selectedSpec.endLine));

  write(root, "plans/任务/current/实现上下文.jsonl", fs.readFileSync(path.join(root, "plans/任务/current/实现上下文.jsonl"), "utf8").replace(revision, "sha256:" + "f".repeat(64)));
  const stale = run(resolverPath, root, ["--capsule", "plans/任务/current", "--json"]);
  assert.equal(stale.status, 1, stale.stderr || stale.stdout);
  assert.equal(JSON.parse(stale.stdout).stale[0].reason, "source-revision-mismatch");
});

test("resolver hard-fails oversized unindexed documents and ordinary-task budget overflow", () => {
  const root = makeRoot("resolver-budget");
  seedDocs(root);
  write(root, "需求文档.md", "中".repeat(21001));
  const manifest = baseManifest();
  manifest.documents.find((entry) => entry.role === "productSpec").estimatedTokens = 21001;
  manifest.documents.find((entry) => entry.role === "productSpec").sections = [];
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  const result = run(resolverPath, root, ["--roles", "productSpec", "--json"]);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert(payload.denied.some((entry) => entry.reason === "index_required"));
  assert(payload.totalTokens > 20000);
});

test("budget checker covers collection roles and current task capsule files", () => {
  const root = makeRoot("budget-collections");
  seedDocs(root);
  write(root, "plans/第一阶段.md", "中".repeat(120));
  write(root, "plans/第二阶段.md", "中".repeat(130));
  write(root, "plans/任务/current/任务状态.json", JSON.stringify({ phase: "P1", task: "T1" }));
  write(root, "plans/任务/current/实现上下文.jsonl", JSON.stringify({ role: "productSpec", file: "需求文档.md", selector: { kind: "wholeFile" }, reason: "test", source: "spec", required: true, sourceRevision: "sha256:" + "0".repeat(64), maxTokens: 1000 }) + "\n");
  const manifest = baseManifest({
    planDetails: ["plans/第一阶段.md", "plans/第二阶段.md"],
    taskContext: { enabled: true, taskCapsulesRoot: "plans/任务", currentTaskCapsule: "plans/任务/current" },
    documents: [
      ...baseDocuments(),
      ...["plans/第一阶段.md", "plans/第二阶段.md"].map((docPath) => ({ role: "planDetails", path: docPath, owner: "dev-planner", authority: "source", contentHash: "sha256:" + "3".repeat(64), estimatedTokens: 0, dependsOn: ["devPlan"], sections: [] })),
    ],
  });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  const result = run(budgetPath, root, ["--json"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.results.filter((entry) => entry.role === "planDetails").length, 2);
  assert(payload.results.some((entry) => entry.role === "taskState" && entry.relPath.endsWith("任务状态.json")));
  assert(payload.results.some((entry) => entry.role === "implementationContext" && entry.relPath.endsWith("实现上下文.jsonl")));
});

test("drift checker accepts multiple documents for a collection role", () => {
  const root = makeRoot("drift-collections");
  seedDocs(root);
  write(root, "plans/第一阶段.md", "# 第一阶段\n");
  write(root, "plans/第二阶段.md", "# 第二阶段\n");
  const manifest = baseManifest({
    planDetails: ["plans/第一阶段.md", "plans/第二阶段.md"],
    documents: [
      ...baseDocuments(),
      ...["plans/第一阶段.md", "plans/第二阶段.md"].map((docPath) => ({
        role: "planDetails",
        path: docPath,
        owner: "dev-planner",
        authority: "source",
        contentHash: "sha256:" + "4".repeat(64),
        estimatedTokens: 0,
        dependsOn: ["devPlan"],
        sections: [],
      })),
    ],
  });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);
  const result = run(driftPath, root, ["--quick", "--strict", "--json"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).findings.some((finding) => finding.code === "duplicate-role"), false);
});

test("drift checker ignores governed Markdown details and declared backup directories", () => {
  const root = makeRoot("drift-markdown-governance");
  seedDocs(root);
  write(root, "设计简报.md", "<!-- vibe-markdown-facade: 设计简报 -->\n# 设计简报\n\n- [审批](设计简报/010-审批.md)\n");
  write(root, "设计简报/010-审批.md", "<!-- vibe-section:DESIGNBRIEF-010 -->\n# 审批\n\n[返回设计简报](../设计简报.md)\n\n正文。\n");
  write(root, "Markdown文档备份/需求文档.md", "<!-- vibe-section:REQ-001 -->\n# 旧需求\n\n保留备份。\n");
  const manifest = baseManifest({ markdownGovernance: { enabled: true, maxTokens: 8000, facadeMaxTokens: 3000, archiveDirectories: ["Markdown文档备份"] } });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);
  const result = run(driftPath, root, ["--full", "--strict", "--json"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).findings.some((finding) => finding.code === "marked-orphan"), false);
});

test("drift checker rejects stale capsule selectors", () => {
  const root = makeRoot("drift-selector");
  seedDocs(root);
  const manifest = baseManifest({
    taskContext: { enabled: true, taskCapsulesRoot: "plans/任务", currentTaskCapsule: "plans/任务/current" },
  });
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  assert.equal(run(indexPath, root, ["--write"]).status, 0);
  const indexed = readJson(root);
  const revision = indexed.documents.find((entry) => entry.role === "productSpec").contentHash;
  const record = JSON.stringify({
    role: "productSpec",
    file: "需求文档.md",
    selector: { kind: "lines", startLine: 1, endLine: 999 },
    reason: "drift regression",
    source: "spec",
    required: true,
    sourceRevision: revision,
    maxTokens: 1200,
  }) + "\n";
  write(root, "plans/任务/current/任务状态.json", JSON.stringify({ phase: "P1", task: "T1", status: "doing", revision: "" }) + "\n");
  write(root, "plans/任务/current/实现上下文.jsonl", record);
  write(root, "plans/任务/current/验收上下文.jsonl", record);
  const result = run(driftPath, root, ["--quick", "--strict", "--json"]);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert(JSON.parse(result.stdout).findings.some((finding) => finding.message.includes("line-range-out-of-bounds")));
});

test("budget checker reports index_required above 20k and archive_required above 50k", () => {
  const root = makeRoot("budget-thresholds");
  seedDocs(root);
  write(root, "需求文档.md", "中".repeat(21001));
  write(root, "开发计划.md", "中".repeat(50001));
  write(root, ".vibe-docs.json", JSON.stringify(baseManifest(), null, 2) + "\n");
  const result = run(budgetPath, root, ["--strict", "--json"]);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert(payload.findings.some((finding) => finding.code === "index_required" && finding.role === "productSpec"));
  assert(payload.findings.some((finding) => finding.code === "archive_required" && finding.role === "devPlan"));
});

test("unsafe manifest document paths fail closed with exit code 2", () => {
  const root = makeRoot("unsafe");
  const manifest = baseManifest({ productSpec: "../需求文档.md" });
  manifest.documents.find((entry) => entry.role === "productSpec").path = "../需求文档.md";
  write(root, ".vibe-docs.json", JSON.stringify(manifest, null, 2) + "\n");
  const result = run(resolverPath, root, ["--roles", "productSpec", "--json"]);
  assert.equal(result.status, 2, result.stderr || result.stdout);
});
