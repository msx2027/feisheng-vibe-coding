#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { safeWriteTargetFile } from "./safe-target-fs.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const archiveTool = path.join(repoRoot, "tools", "archive-lifecycle-docs.mjs");
const budgetTool = path.join(repoRoot, "tools", "check-lifecycle-doc-budget.mjs");
const brandTool = path.join(repoRoot, "skills", "brand", "scripts", "sync-brand-to-tokens.cjs");
const docNamesTool = path.join(repoRoot, "tools", "check-target-doc-names.mjs");
const apiContractsTool = path.join(repoRoot, "tools", "check-api-contracts.mjs");
const constitutionTool = path.join(repoRoot, "tools", "check-target-constitution.mjs");
const markT2Tool = path.join(repoRoot, "tools", "mark-t2-check-clean.mjs");

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function runNode(script, args = [], options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
}

function makeRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("safe target writes reject cross-platform path aliases", () => {
  const tmp = makeRoot("safe-target-alias-");
  try {
    for (const relativePath of ["C:outside.md", "file.md:stream", "CON", "name.", "bad\0name.md"]) {
      assert.throws(
        () => safeWriteTargetFile(tmp, relativePath, "unsafe\n"),
        /project-relative|NUL|non-portable|aliased/u,
        relativePath,
      );
    }
    assert.deepEqual(fs.readdirSync(tmp), []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("safe target writes refuse stale plan content", () => {
  const tmp = makeRoot("safe-target-stale-");
  try {
    write(path.join(tmp, "计划文档.md"), "planned content\n");
    write(path.join(tmp, "计划文档.md"), "concurrent edit\n");
    assert.throws(
      () => safeWriteTargetFile(tmp, "计划文档.md", "stale replacement\n", { expectedContent: "planned content\n" }),
      /changed after planning/u,
    );
    assert.equal(fs.readFileSync(path.join(tmp, "计划文档.md"), "utf8"), "concurrent edit\n");

    write(path.join(tmp, "新建文档.md"), "created concurrently\n");
    assert.throws(
      () => safeWriteTargetFile(tmp, "新建文档.md", "stale create\n", { expectedContent: null }),
      /expected missing file/u,
    );
    assert.equal(fs.readFileSync(path.join(tmp, "新建文档.md"), "utf8"), "created concurrently\n");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("target document scanners reject junction-backed mapped documents", () => {
  const tmp = makeRoot("target-scanner-junction-");
  try {
    const target = path.join(tmp, "target");
    const outsideDocs = path.join(tmp, "outside-docs");
    write(path.join(outsideDocs, "需求文档.md"), "# Outside spec\n");
    write(
      path.join(outsideDocs, "接口契约.md"),
      "# 接口契约\n\n| 能力ID | 统一能力 | 入口类型 | 契约入口 | 调用方 | 状态 | 说明 |\n| --- | --- | --- | --- | --- | --- | --- |\n",
    );
    fs.mkdirSync(target, { recursive: true });
    fs.symlinkSync(outsideDocs, path.join(target, "外部文档"), process.platform === "win32" ? "junction" : "dir");
    write(
      path.join(target, ".vibe-docs.json"),
      JSON.stringify({ productSpec: "外部文档/需求文档.md", interfaceContracts: "外部文档/接口契约.md" }),
    );

    const docNames = runNode(docNamesTool, [target, "--require-existing"]);
    assert.equal(docNames.status, 1, docNames.stdout || docNames.stderr);
    assert.match(`${docNames.stdout}\n${docNames.stderr}`, /unsafe|symlink|junction/iu);

    const apiContracts = runNode(apiContractsTool, [target]);
    assert.equal(apiContracts.status, 1, apiContracts.stdout || apiContracts.stderr);
    assert.match(`${apiContracts.stdout}\n${apiContracts.stderr}`, /unsafe|symlink|junction/iu);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("constitution audit rejects a non-regular manifest", () => {
  const tmp = makeRoot("constitution-unsafe-manifest-");
  try {
    fs.mkdirSync(path.join(tmp, ".vibe-docs.json"), { recursive: true });
    const result = runNode(constitutionTool, [tmp, "--skills-root", repoRoot, "--json"]);
    assert.equal(result.status, 2, result.stdout || result.stderr);
    const report = JSON.parse(result.stdout);
    assert(
      report.findings.some((finding) => finding.id === "vibe-docs-json" && /Unsafe/u.test(finding.message)),
      "constitution audit must reject a directory or link at .vibe-docs.json",
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("T2 snapshot writer rejects a .claude junction", () => {
  const tmp = makeRoot("mark-t2-junction-");
  try {
    const target = path.join(tmp, "target");
    const outsideState = path.join(tmp, "outside-state");
    write(path.join(target, "src", "value.ts"), "export const value = 1;\n");
    assert.equal(spawnSync("git", ["init", "--quiet"], { cwd: target }).status, 0);
    assert.equal(spawnSync("git", ["add", "."], { cwd: target }).status, 0);
    const commit = spawnSync(
      "git",
      ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "baseline"],
      { cwd: target, encoding: "utf8" },
    );
    assert.equal(commit.status, 0, commit.stderr || commit.stdout);
    write(path.join(target, "src", "value.ts"), "export const value = 2;\n");
    assert.equal(spawnSync("git", ["add", "src/value.ts"], { cwd: target }).status, 0);
    fs.mkdirSync(outsideState, { recursive: true });
    fs.symlinkSync(outsideState, path.join(target, ".claude"), process.platform === "win32" ? "junction" : "dir");

    const result = runNode(markT2Tool, [target, "--evidence", "node test"]);
    assert.equal(result.status, 1, result.stdout || result.stderr);
    assert.match(`${result.stdout}\n${result.stderr}`, /symlink|junction/iu);
    assert.deepEqual(fs.readdirSync(outsideState), []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("T2 snapshot writer commits the clean marker last", () => {
  const tmp = makeRoot("mark-t2-marker-order-");
  try {
    write(path.join(tmp, "src", "value.ts"), "export const value = 1;\n");
    assert.equal(spawnSync("git", ["init", "--quiet"], { cwd: tmp }).status, 0);
    assert.equal(spawnSync("git", ["add", "."], { cwd: tmp }).status, 0);
    const commit = spawnSync(
      "git",
      ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "baseline"],
      { cwd: tmp, encoding: "utf8" },
    );
    assert.equal(commit.status, 0, commit.stderr || commit.stdout);
    write(path.join(tmp, "src", "value.ts"), "export const value = 2;\n");
    assert.equal(spawnSync("git", ["add", "src/value.ts"], { cwd: tmp }).status, 0);
    fs.mkdirSync(path.join(tmp, ".claude", ".t2-check-snapshot"), { recursive: true });

    const result = runNode(markT2Tool, [tmp, "--evidence", "node test"]);
    assert.equal(result.status, 1, result.stdout || result.stderr);
    assert.equal(
      fs.existsSync(path.join(tmp, ".claude", ".needs-t2-check")),
      false,
      "clean marker must not exist when snapshot/evidence persistence fails",
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("lifecycle budget rejects parent and absolute document paths", () => {
  const tmp = makeRoot("lifecycle-budget-path-");
  try {
    const target = path.join(tmp, "target");
    const outside = path.join(tmp, "outside.md");
    write(outside, "outside secret\n");

    for (const configuredPath of ["../outside.md", outside]) {
      write(
        path.join(target, ".vibe-docs.json"),
        JSON.stringify({ productSpec: configuredPath, loadPolicy: { always: ["productSpec"], never: [] } }),
      );
      const result = runNode(budgetTool, [target, "--json"]);
      assert.equal(result.status, 2, `unsafe path should be rejected: ${configuredPath}\n${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /target root|relative path|escape|outside/iu);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("lifecycle budget validates numeric limits before scanning", () => {
  const tmp = makeRoot("lifecycle-budget-number-");
  try {
    write(path.join(tmp, ".vibe-docs.json"), JSON.stringify({ loadPolicy: { always: [], never: [] } }));
    for (const args of [
      ["--doc-limit", "NaN"],
      ["--doc-limit", "0"],
      ["--always-limit", "1.5"],
      ["--always-limit"],
    ]) {
      const result = runNode(budgetTool, [tmp, ...args]);
      assert.equal(result.status, 2, `invalid numeric option should fail: ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("lifecycle budget records allowlisted external configuration without reading it", () => {
  const tmp = makeRoot("lifecycle-budget-external-config-");
  try {
    write(path.join(tmp, "需求文档.md"), "# 需求文档\n");
    write(
      path.join(tmp, ".vibe-docs.json"),
      JSON.stringify({
        productSpec: "需求文档.md",
        externalStandaloneGameFolder: "E:\\standalone-game",
        loadPolicy: { always: ["productSpec"], never: [] },
      }),
    );
    const result = runNode(budgetTool, [tmp, "--json"]);
    assert.equal(result.status, 0, result.stdout || result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.deepEqual(
      payload.results.find((item) => item.key === "externalStandaloneGameFolder"),
      {
        key: "externalStandaloneGameFolder",
        relPath: "E:\\standalone-game",
        tokens: 0,
        policy: "onDemand",
        status: "external",
      },
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("lifecycle archive validates numeric options", () => {
  const tmp = makeRoot("lifecycle-archive-number-");
  try {
    write(path.join(tmp, ".vibe-docs.json"), "{}\n");
    for (const args of [
      ["--keep-versions", "0"],
      ["--keep-versions"],
    ]) {
      const result = runNode(archiveTool, [tmp, ...args]);
      assert.equal(result.status, 2, `invalid numeric option should fail: ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("lifecycle changelog archive preserves history in a four-character volume before shortening the source", () => {
  const tmp = makeRoot("lifecycle-changelog-success-");
  try {
    const changelog = path.join(tmp, "docs", "变更归档.md");
    const segment = (version, marker) => [
      `## [${version}] - 2020-01-01`,
      ...Array.from({ length: 200 }, (_, index) => `${marker} line ${index}`),
    ].join("\n");
    write(changelog, ["# 变更归档", segment("v3.0", "latest"), segment("v2.0", "older"), segment("v1.0", "oldest")].join("\n"));
    write(
      path.join(tmp, ".vibe-docs.json"),
      JSON.stringify({ productSpecChangelogArchive: "docs/变更归档.md" }),
    );

    const result = runNode(archiveTool, [tmp, "--write", "--keep-versions", "1"]);
    assert.equal(result.status, 0, result.stdout || result.stderr);
    const current = fs.readFileSync(changelog, "utf8");
    const history = fs.readFileSync(path.join(tmp, "docs", "变更一卷.md"), "utf8");
    assert.match(current, /\[v3\.0\]/u);
    assert.doesNotMatch(current, /\[v2\.0\]|\[v1\.0\]/u);
    assert.match(history, /\[v2\.0\]/u);
    assert.match(history, /\[v1\.0\]/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("brand token sync passes generator arguments without invoking a shell", () => {
  const tmp = makeRoot("brand-sync-parent-");
  const attackName = process.platform === "win32"
    ? "fixture & mkdir BRAND_INJECTION & echo x"
    : "fixture; mkdir BRAND_INJECTION; echo x";
  const fixture = path.join(tmp, attackName);
  try {
    write(
      path.join(fixture, "docs", "brand-guidelines.md"),
      [
        "Primary Color | #112233 (Ocean)",
        "Secondary Color | #445566 (Slate)",
        "Accent Color | #778899 (Mist)",
      ].join("\n"),
    );
    write(
      path.join(fixture, "assets", "design-tokens.json"),
      JSON.stringify({ primitive: { color: {} }, semantic: { color: {} }, component: {} }),
    );
    write(
      path.join(fixture, "skills", "design-system", "scripts", "generate-tokens.cjs"),
      [
        "const fs = require('node:fs');",
        "const args = process.argv.slice(2);",
        "fs.writeFileSync('generator-args.json', JSON.stringify(args));",
        "const output = args[args.indexOf('-o') + 1];",
        "fs.writeFileSync(output, ':root { --fixture: 1; }\\n');",
        "",
      ].join("\n"),
    );

    const result = runNode(brandTool, [], { cwd: fixture });
    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.equal(fs.existsSync(path.join(fixture, "BRAND_INJECTION")), false, "shell metacharacters in cwd must stay data");
    const generatorArgs = JSON.parse(fs.readFileSync(path.join(fixture, "generator-args.json"), "utf8"));
    assert.equal(generatorArgs[0], "--config");
    assert.match(generatorArgs[1], /^assets\/\.design-tokens\.json\.brand-.+\.json\.tmp$/u);
    assert.equal(generatorArgs[2], "-o");
    assert.match(generatorArgs[3], /^assets\/\.design-tokens\.css\.brand-.+\.css\.tmp$/u);
    assert.equal(fs.readFileSync(path.join(fixture, "assets", "design-tokens.css"), "utf8"), ":root { --fixture: 1; }\n");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("brand token sync rolls back when CSS generation fails", () => {
  const tmp = makeRoot("brand-sync-rollback-");
  try {
    write(
      path.join(tmp, "docs", "brand-guidelines.md"),
      "Primary Color | #112233 (Ocean)\nSecondary Color | #445566 (Slate)\nAccent Color | #778899 (Mist)\n",
    );
    const originalJson = '{"primitive":{"color":{}},"semantic":{"color":{}},"component":{}}\n';
    const originalCss = ":root { --original: 1; }\n";
    write(path.join(tmp, "assets", "design-tokens.json"), originalJson);
    write(path.join(tmp, "assets", "design-tokens.css"), originalCss);
    write(path.join(tmp, "skills", "design-system", "scripts", "generate-tokens.cjs"), "process.exit(7);\n");

    const result = runNode(brandTool, [], { cwd: tmp });
    assert.equal(result.status, 1, result.stdout || result.stderr);
    assert.equal(fs.readFileSync(path.join(tmp, "assets", "design-tokens.json"), "utf8"), originalJson);
    assert.equal(fs.readFileSync(path.join(tmp, "assets", "design-tokens.css"), "utf8"), originalCss);
    assert.equal(
      fs.readdirSync(path.join(tmp, "assets")).some((name) => name.includes(".brand-") || name.endsWith(".backup")),
      false,
      "failed brand sync must not leave transaction residue",
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("brand token sync replaces hardlinks without mutating outside files", () => {
  const tmp = makeRoot("brand-sync-hardlink-");
  try {
    const target = path.join(tmp, "target");
    write(
      path.join(target, "docs", "brand-guidelines.md"),
      "Primary Color | #112233 (Ocean)\nSecondary Color | #445566 (Slate)\nAccent Color | #778899 (Mist)\n",
    );
    const outsideTokens = path.join(tmp, "outside-tokens.json");
    const outsideContent = '{"primitive":{"color":{}},"semantic":{"color":{}},"component":{}}\n';
    write(outsideTokens, outsideContent);
    fs.mkdirSync(path.join(target, "assets"), { recursive: true });
    fs.linkSync(outsideTokens, path.join(target, "assets", "design-tokens.json"));
    write(path.join(target, "assets", "design-tokens.css"), ":root {}\n");
    write(
      path.join(target, "skills", "design-system", "scripts", "generate-tokens.cjs"),
      "const fs=require('node:fs');const a=process.argv.slice(2);fs.writeFileSync(a[a.indexOf('-o')+1],':root { --new: 1; }\\n');\n",
    );

    const result = runNode(brandTool, [], { cwd: target });
    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.equal(fs.readFileSync(outsideTokens, "utf8"), outsideContent);
    assert.notEqual(fs.readFileSync(path.join(target, "assets", "design-tokens.json"), "utf8"), outsideContent);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("brand token sync rejects an assets junction outside the project", () => {
  const tmp = makeRoot("brand-sync-junction-");
  try {
    const target = path.join(tmp, "target");
    const outsideAssets = path.join(tmp, "outside-assets");
    write(
      path.join(target, "docs", "brand-guidelines.md"),
      "Primary Color | #112233 (Ocean)\nSecondary Color | #445566 (Slate)\nAccent Color | #778899 (Mist)\n",
    );
    write(path.join(outsideAssets, "design-tokens.json"), '{"primitive":{"color":{}},"semantic":{"color":{}},"component":{}}\n');
    write(path.join(outsideAssets, "outside-marker.txt"), "must survive\n");
    fs.mkdirSync(target, { recursive: true });
    fs.symlinkSync(outsideAssets, path.join(target, "assets"), process.platform === "win32" ? "junction" : "dir");
    write(path.join(target, "skills", "design-system", "scripts", "generate-tokens.cjs"), "process.exit(0);\n");

    const result = runNode(brandTool, [], { cwd: target });
    assert.equal(result.status, 1, result.stdout || result.stderr);
    assert.deepEqual(fs.readdirSync(outsideAssets).sort(), ["design-tokens.json", "outside-marker.txt"]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
