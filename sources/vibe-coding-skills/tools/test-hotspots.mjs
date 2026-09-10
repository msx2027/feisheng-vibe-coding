#!/usr/bin/env node
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isGeneratedOrThirdPartyPath, shouldScanFile } from "./hotspot-policy.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const checker = path.join(repoRoot, "tools", "check-hotspots.mjs");

function makeTempProject() {
  const root = mkdtempSync(path.join(tmpdir(), "hotspot-check-"));
  mkdirSync(path.join(root, "src", "runtime"), { recursive: true });
  mkdirSync(path.join(root, "src", "components"), { recursive: true });
  mkdirSync(path.join(root, "tests", "integration"), { recursive: true });
  mkdirSync(path.join(root, "tools"), { recursive: true });
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  return root;
}

function lines(count, line = "export const value = 1;") {
  return Array.from({ length: count }, (_, index) => `${line} // ${index}`).join("\n");
}

function longFunction(name, bodyLines) {
  return [
    `export function ${name}(`,
    "  value: string,",
    ") {",
    lines(bodyLines, "  const nextValue = value;"),
    "  return value;",
    "}",
    "",
  ].join("\n");
}

function longArrow(name, bodyLines) {
  return [
    `export const ${name} = value => {`,
    lines(bodyLines, "  const nextValue = value;"),
    "  return value;",
    "};",
    "",
  ].join("\n");
}

function longComponent(name, bodyLines) {
  return [
    `export const ${name} = (`,
    "  props: { title: string },",
    ") => {",
    "  return <section>{props.title}</section>;",
    lines(bodyLines, "  const marker = props.title;"),
    "};",
    "",
  ].join("\n");
}

function longClassMethod(className, methodName, bodyLines) {
  return [
    `export class ${className} {`,
    `  ${methodName}(value: string) {`,
    lines(bodyLines, "    const nextValue = value;"),
    "    return value;",
    "  }",
    "}",
    "",
  ].join("\n");
}

function longGeneratorClassMethod(className, methodName, bodyLines) {
  return [
    `export class ${className} {`,
    `  *${methodName}(value: string) {`,
    lines(bodyLines, "    yield value;"),
    "  }",
    "}",
    "",
  ].join("\n");
}

function duplicateNamedFunctions(firstBodyLines, secondBodyLines) {
  return [
    "if (firstScope) {",
    longFunction("buildDuplicate", firstBodyLines),
    "}",
    "if (secondScope) {",
    longFunction("buildDuplicate", secondBodyLines),
    "}",
    "",
  ].join("\n");
}

function longExpressionArrow(name, bodyLines) {
  return [
    `export const ${name} = () => (`,
    "  [",
    ...Array.from({ length: bodyLines }, (_, index) => `    "item-${index}",`),
    "  ]",
    ");",
    "",
  ].join("\n");
}

function runChecker(root, ...args) {
  return spawnSync("node", [checker, root, ...args], { encoding: "utf8" });
}

function git(root, args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

function commitFixture(root, message) {
  const result = git(root, [
    "-c",
    "user.name=Hotspot Fixture",
    "-c",
    "user.email=hotspot@example.invalid",
    "commit",
    "--quiet",
    "-m",
    message,
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

const root = makeTempProject();
try {
  for (const excludedPath of [
    "assets/fonts/bundled-font.css",
    "fonts/bundled-font.css",
    "src/bundle.min.mjs",
    "src/bundle.min.cjs",
  ]) {
    assert.equal(isGeneratedOrThirdPartyPath(excludedPath), true, `${excludedPath} must be excluded`);
    assert.equal(shouldScanFile(excludedPath), false, `${excludedPath} must not enter hotspot scanning`);
  }

  const slashHeavyRoot = makeTempProject();
  try {
    writeFileSync(
      path.join(slashHeavyRoot, "src", "runtime", "slash-heavy.ts"),
      `export const slashHeavy = ${"a/".repeat(50_000)}a;\n`,
    );
    const slashHeavyResult = spawnSync(process.execPath, [checker, slashHeavyRoot, "--json"], {
      encoding: "utf8",
      timeout: 3_000,
    });
    assert.equal(
      slashHeavyResult.error,
      undefined,
      `100KB slash-heavy valid TypeScript must finish within the bounded timeout: ${slashHeavyResult.error?.message}`,
    );
    assert.equal(slashHeavyResult.status, 0, slashHeavyResult.stderr || slashHeavyResult.stdout);
  } finally {
    rmSync(slashHeavyRoot, { recursive: true, force: true });
  }

  writeFileSync(path.join(root, "src", "runtime", "runner.ts"), lines(801));
  writeFileSync(path.join(root, "src", "runtime", "中文热区.ts"), lines(401));
  writeFileSync(path.join(root, "tests", "integration", "runtime.test.ts"), lines(301, "it('works', () => {});"));
  writeFileSync(path.join(root, "src", "runtime", "exact-threshold.ts"), `${lines(300)}\n`);
  writeFileSync(path.join(root, "src", "design-tokens.ts"), lines(1501));
  writeFileSync(path.join(root, "src", "runtime", "multiline-function.ts"), longFunction("buildLargeRuntime", 105));
  writeFileSync(path.join(root, "src", "runtime", "UPPERCASE.TS"), longFunction("buildUppercaseRuntime", 105));
  writeFileSync(path.join(root, "src", "runtime", "expression-arrow.ts"), longExpressionArrow("buildExpressionList", 105));
  writeFileSync(
    path.join(root, "src", "runtime", "regex-boundary.ts"),
    [
      'export const normalizePath = (value: string) => value.replace(/^\\.\\//, "");',
      "",
      longFunction("buildAfterRegexLiteral", 105),
    ].join("\n"),
  );
  writeFileSync(path.join(root, "src", "components", "helpers.tsx"), longArrow("normalizePanelState", 110));
  writeFileSync(path.join(root, "src", "components", "HugePanel.tsx"), longComponent("HugePanel", 181));
  writeFileSync(
    path.join(root, "src", "runtime", "route-actions.ts"),
    "export function safeBudgetSignal(value: unknown) {\n  return value;\n}\n",
  );
  writeFileSync(path.join(root, "tools", "oversized.sh"), lines(1501, "echo fixture"));
  writeFileSync(path.join(root, "tools", "test-large-gate.sh"), lines(1501, "echo test fixture"));
  writeFileSync(path.join(root, "scripts", "large.ps1"), lines(801, "Write-Output fixture"));
  writeFileSync(path.join(root, "tools", "UPPERCASE.SH"), lines(1501, "echo fixture"));
  writeFileSync(path.join(root, "scripts", "UPPERCASE.PS1"), lines(801, "Write-Output fixture"));
  const declaredLanguageSourceFiles = [
    "python-service.py",
    "go-service.go",
    "rust-service.rs",
    "java-service.java",
    "kotlin-service.kt",
    "kotlin-script.kts",
    "dotnet-service.cs",
    "php-service.php",
    "ruby-service.rb",
    "swift-service.swift",
    "dart-service.dart",
  ];
  for (const file of declaredLanguageSourceFiles) {
    writeFileSync(path.join(root, "src", "runtime", file), lines(301, "// language adapter fixture"));
  }
  writeFileSync(
    path.join(root, "tests", "integration", "rust-integration.rs"),
    lines(801, "// Rust integration test fixture"),
  );
  writeFileSync(
    path.join(root, "src", "runtime", "helpers.ts"),
    "export function safeBudgetSignal(value: unknown) {\n  return value;\n}\n",
  );
  mkdirSync(path.join(root, ".agents", "skills", "mirror"), { recursive: true });
  writeFileSync(path.join(root, ".agents", "skills", "mirror", "ignored.ts"), lines(901));
  mkdirSync(path.join(root, "app", "src-tauri", "gen", "schemas"), { recursive: true });
  mkdirSync(path.join(root, "app", "src", "assets", "fonts"), { recursive: true });
  writeFileSync(path.join(root, "app", "src-tauri", "gen", "schemas", "desktop-schema.json"), lines(2603));
  writeFileSync(path.join(root, "app", "src", "assets", "fonts", "bundled-font.css"), lines(1001, ".glyph {}"));
  mkdirSync(path.join(root, "src", "features", "many"), { recursive: true });
  for (let index = 0; index < 81; index += 1) {
    writeFileSync(path.join(root, "src", "features", "many", `helper-${index}.ts`), "export const value = 1;\n");
  }

  const jsonResult = runChecker(root, "--json");
  assert.equal(jsonResult.status, 0, jsonResult.stderr || jsonResult.stdout);
  const report = JSON.parse(jsonResult.stdout);
  assert(report.summary.scannedFiles >= 90);
  assert(report.findings.some((item) => item.kind === "large-file" && item.file.endsWith("runner.ts") && item.severity === "hotspot"));
  assert(report.findings.some((item) => item.kind === "large-file" && item.file.endsWith("runtime.test.ts") && item.severity === "warn"));
  const diagnosticBlocker = report.findings.find(
    (item) => item.kind === "large-file" && item.file.endsWith("design-tokens.ts") && item.severity === "blocker",
  );
  assert(diagnosticBlocker);
  assert.equal(diagnosticBlocker.limit, 1500, "all-mode accident-level diagnostics must retain the 1500-line limit");
  assert.match(diagnosticBlocker.message, /1500/u);
  assert(!report.findings.some((item) => item.kind === "large-file" && item.file.endsWith("exact-threshold.ts")));
  assert(report.findings.some((item) => item.kind === "long-function" && item.name === "buildLargeRuntime"));
  assert(
    report.findings.some((item) => item.kind === "long-function" && item.name === "buildUppercaseRuntime"),
    "uppercase JS/TS extensions must still receive function-level scanning",
  );
  assert(report.findings.some((item) => item.kind === "long-function" && item.name === "buildExpressionList"));
  assert(report.findings.some((item) => item.kind === "long-function" && item.name === "buildAfterRegexLiteral"));
  assert(
    !report.findings.some((item) => item.kind === "long-function" && item.name === "normalizePath"),
    "regex literals containing an escaped slash must not swallow later functions",
  );
  assert(report.findings.some((item) => item.kind === "long-function" && item.name === "normalizePanelState"));
  assert(report.findings.some((item) => item.kind === "long-component" && item.name === "HugePanel"));
  assert(report.findings.some((item) => item.kind === "large-directory" && item.directory.endsWith("src/features/many")));
  assert(report.findings.some((item) => item.kind === "duplicate-helper" && item.name === "safeBudgetSignal"));
  assert(
    !report.findings.some((item) => item.file?.includes("src-tauri/gen/") || item.file?.includes("assets/fonts/")),
    "generated schemas and bundled font assets must be excluded from hotspot gates",
  );
  assert(
    report.findings.some(
      (item) => item.kind === "large-file" && item.file.endsWith("tools/oversized.sh") && item.severity === "blocker",
    ),
    "Shell hotspots must be scanned",
  );
  assert(
    report.findings.some(
      (item) =>
        item.kind === "large-file"
        && item.file.endsWith("tools/test-large-gate.sh")
        && item.severity === "hotspot"
        && item.categories?.includes("test"),
    ),
    "test-*.sh files must use the 800-line test policy instead of the production accident line",
  );
  assert(
    report.findings.some(
      (item) => item.kind === "large-file" && item.file.endsWith("scripts/large.ps1") && item.severity === "hotspot",
    ),
    "PowerShell hotspots must be scanned",
  );
  assert(
    report.findings.some(
      (item) => item.kind === "large-file" && item.file.endsWith("tools/UPPERCASE.SH") && item.severity === "blocker",
    ),
    "Shell extension matching must be case-insensitive",
  );
  assert(
    report.findings.some(
      (item) => item.kind === "large-file" && item.file.endsWith("scripts/UPPERCASE.PS1") && item.severity === "hotspot",
    ),
    "PowerShell extension matching must be case-insensitive",
  );
  for (const file of declaredLanguageSourceFiles) {
    assert(
      report.findings.some(
        (item) => item.kind === "large-file" && item.file.endsWith(file) && item.severity === "warn",
      ),
      `${file} must receive file-level hotspot scanning`,
    );
  }
  assert(
    report.findings.some(
      (item) =>
        item.kind === "large-file"
        && item.file.endsWith("tests/integration/rust-integration.rs")
        && item.severity === "hotspot"
        && item.categories?.includes("test"),
    ),
    "Rust integration tests must use the test-file hotspot policy",
  );

  const strictResult = runChecker(root, "--strict");
  assert.equal(strictResult.status, 1, strictResult.stderr || strictResult.stdout);

  const textResult = runChecker(root);
  assert.equal(textResult.status, 0, textResult.stderr || textResult.stdout);
  assert(textResult.stdout.includes("Default mode is warn-only"));

  const stagedWithoutGit = runChecker(root, "--staged", "--json");
  assert.equal(stagedWithoutGit.status, 2, stagedWithoutGit.stderr || stagedWithoutGit.stdout);
  assert(stagedWithoutGit.stderr.includes("--staged requires git"));

  const linkedRoot = makeTempProject();
  const outsideLinkedRoot = mkdtempSync(path.join(tmpdir(), "hotspot-outside-link-"));
  try {
    writeFileSync(path.join(outsideLinkedRoot, "outside.ts"), lines(10));
    symlinkSync(
      outsideLinkedRoot,
      path.join(linkedRoot, "src", "linked-runtime"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const linkedResult = runChecker(linkedRoot, "--strict", "--json");
    assert.equal(linkedResult.status, 1, linkedResult.stderr || linkedResult.stdout);
    const linkedReport = JSON.parse(linkedResult.stdout);
    assert(
      linkedReport.findings.some((item) => item.kind === "unsafe-input"),
      "all-mode scanning must reject symlink or junction inputs instead of silently skipping them",
    );
  } finally {
    rmSync(linkedRoot, { recursive: true, force: true });
    rmSync(outsideLinkedRoot, { recursive: true, force: true });
  }

  const gitReady = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
  if (gitReady) {
    assert.equal(spawnSync("git", ["init"], { cwd: root, encoding: "utf8" }).status, 0);
    assert.equal(spawnSync("git", ["add", "."], { cwd: root, encoding: "utf8" }).status, 0);
    const stagedResult = runChecker(root, "--staged", "--json");
    assert.equal(stagedResult.status, 0, stagedResult.stderr || stagedResult.stdout);
    const stagedReport = JSON.parse(stagedResult.stdout);
    assert(!stagedReport.findings.some((item) => item.file?.startsWith(".agents/")));
    const stagedChinese = stagedReport.findings.find(
      (item) => item.kind === "large-file" && item.file.endsWith("中文热区.ts"),
    );
    assert(stagedChinese, "staged scanning must preserve non-ASCII source paths");
    assert(stagedChinese.stagedAdded > 300, "staged numstat must stay attached to a non-ASCII source path");

    const strictStagedResult = runChecker(root, "--staged", "--strict", "--json");
    assert.equal(strictStagedResult.status, 1, strictStagedResult.stderr || strictStagedResult.stdout);
    const strictStagedReport = JSON.parse(strictStagedResult.stdout);
    assert(
      strictStagedReport.findings.some(
        (item) => item.kind === "large-file" && item.file.endsWith("中文热区.ts") && item.severity === "blocker",
      ),
      "a new production file over 300 lines must block staged strict checks",
    );
    assert(
      strictStagedReport.findings.some(
        (item) => item.kind === "long-component" && item.name === "HugePanel" && item.severity === "blocker",
      ),
      "a new React component over 180 lines must block staged strict checks",
    );
    assert(
      strictStagedReport.findings.some(
        (item) => item.kind === "long-function" && item.name === "buildLargeRuntime" && item.severity === "blocker",
      ),
      "a new function over 100 lines must block staged strict checks",
    );
    for (const file of declaredLanguageSourceFiles) {
      assert(
        strictStagedReport.findings.some(
          (item) => item.kind === "large-file" && item.file.endsWith(file) && item.severity === "blocker",
        ),
        `${file} must participate in staged strict file-level gates`,
      );
    }

    const ratchetRoot = makeTempProject();
    try {
      const legacyFile = path.join(ratchetRoot, "src", "runtime", "legacy-runtime.ts");
      const legacyFunction = path.join(ratchetRoot, "src", "runtime", "legacy-function.ts");
      const legacyComponent = path.join(ratchetRoot, "src", "components", "LegacyPanel.tsx");
      const legacyTest = path.join(ratchetRoot, "tests", "integration", "legacy.test.ts");
      writeFileSync(legacyFile, lines(401));
      writeFileSync(legacyFunction, longFunction("buildLegacyRuntime", 105));
      writeFileSync(legacyComponent, longComponent("LegacyPanel", 200));
      writeFileSync(legacyTest, lines(900, "it('legacy', () => {});"));
      assert.equal(git(ratchetRoot, ["init", "--quiet"]).status, 0);
      assert.equal(git(ratchetRoot, ["add", "."]).status, 0);
      commitFixture(ratchetRoot, "legacy hotspot baseline");

      writeFileSync(legacyFile, lines(400));
      writeFileSync(legacyFunction, longFunction("buildLegacyRuntime", 104));
      writeFileSync(legacyComponent, longComponent("LegacyPanel", 190));
      writeFileSync(legacyTest, lines(899, "it('legacy', () => {});"));
      writeFileSync(path.join(ratchetRoot, "src", "runtime", "exact-production-limit.ts"), lines(300));
      assert.equal(git(ratchetRoot, ["add", "."]).status, 0);
      const decreaseResult = runChecker(ratchetRoot, "--staged", "--strict", "--json");
      assert.equal(decreaseResult.status, 0, decreaseResult.stderr || decreaseResult.stdout);

      writeFileSync(legacyFile, lines(402));
      writeFileSync(legacyFunction, longFunction("buildLegacyRuntime", 106));
      writeFileSync(legacyComponent, longComponent("LegacyPanel", 201));
      writeFileSync(legacyTest, lines(901, "it('legacy', () => {});"));
      writeFileSync(path.join(ratchetRoot, "src", "runtime", "new-oversized.ts"), lines(301));
      assert.equal(git(ratchetRoot, ["add", "."]).status, 0);
      const growthResult = runChecker(ratchetRoot, "--staged", "--strict", "--json");
      assert.equal(growthResult.status, 1, growthResult.stderr || growthResult.stdout);
      const growthReport = JSON.parse(growthResult.stdout);
      assert(
        growthReport.findings.some(
          (item) => item.kind === "large-file" && item.file.endsWith("legacy-runtime.ts") && item.severity === "blocker",
        ),
        "a legacy production file over 300 lines must block when it grows",
      );
      assert(
        growthReport.findings.some(
          (item) => item.kind === "large-file" && item.file.endsWith("legacy.test.ts") && item.severity === "blocker",
        ),
        "a legacy test file over 800 lines must block when it grows",
      );
      assert(
        growthReport.findings.some(
          (item) => item.kind === "long-component" && item.name === "LegacyPanel" && item.severity === "blocker",
        ),
        "a legacy React component over 180 lines must block when it grows",
      );
      assert(
        growthReport.findings.some(
          (item) => item.kind === "long-function" && item.name === "buildLegacyRuntime" && item.severity === "blocker",
        ),
        "a legacy function over 100 lines must block when it grows",
      );
      assert(
        growthReport.findings.some(
          (item) => item.kind === "large-file" && item.file.endsWith("new-oversized.ts") && item.severity === "blocker",
        ),
        "a new production file over 300 lines must block",
      );
    } finally {
      rmSync(ratchetRoot, { recursive: true, force: true });
    }

    const stagedContentRoot = makeTempProject();
    try {
      const stagedOnlyFile = path.join(stagedContentRoot, "src", "runtime", "staged-only-oversized.ts");
      writeFileSync(path.join(stagedContentRoot, "src", "runtime", "baseline.ts"), lines(5));
      assert.equal(git(stagedContentRoot, ["init", "--quiet"]).status, 0);
      assert.equal(git(stagedContentRoot, ["add", "."]).status, 0);
      commitFixture(stagedContentRoot, "staged content baseline");

      writeFileSync(stagedOnlyFile, lines(301));
      assert.equal(git(stagedContentRoot, ["add", "."]).status, 0);
      writeFileSync(stagedOnlyFile, lines(5));
      const stagedContentResult = runChecker(stagedContentRoot, "--staged", "--strict", "--json");
      assert.equal(stagedContentResult.status, 1, stagedContentResult.stderr || stagedContentResult.stdout);
      const stagedContentReport = JSON.parse(stagedContentResult.stdout);
      assert(
        stagedContentReport.findings.some(
          (item) => item.kind === "large-file" && item.file.endsWith("staged-only-oversized.ts") && item.lines === 301,
        ),
        "staged checks must inspect the Git index blob, not a different unstaged worktree version",
      );
    } finally {
      rmSync(stagedContentRoot, { recursive: true, force: true });
    }

    const callableRatchetRoot = makeTempProject();
    try {
      const methodFile = path.join(callableRatchetRoot, "src", "runtime", "legacy-class.ts");
      const duplicateFile = path.join(callableRatchetRoot, "src", "runtime", "duplicate-functions.ts");
      writeFileSync(methodFile, longClassMethod("LegacyService", "run", 105));
      writeFileSync(duplicateFile, duplicateNamedFunctions(105, 5));
      assert.equal(git(callableRatchetRoot, ["init", "--quiet"]).status, 0);
      assert.equal(git(callableRatchetRoot, ["add", "."]).status, 0);
      commitFixture(callableRatchetRoot, "callable ratchet baseline");

      writeFileSync(methodFile, longClassMethod("LegacyService", "run", 106));
      writeFileSync(duplicateFile, duplicateNamedFunctions(5, 106));
      assert.equal(git(callableRatchetRoot, ["add", "."]).status, 0);
      const callableResult = runChecker(callableRatchetRoot, "--staged", "--strict", "--json");
      assert.equal(callableResult.status, 1, callableResult.stderr || callableResult.stdout);
      const callableReport = JSON.parse(callableResult.stdout);
      assert(
        callableReport.findings.some(
          (item) => item.kind === "long-function" && item.name === "run" && item.severity === "blocker",
        ),
        "a growing class method over 100 lines must block",
      );
      assert(
        callableReport.findings.some(
          (item) => item.kind === "long-function" && item.name === "buildDuplicate" && item.severity === "blocker",
        ),
        "a later same-name function must compare with its own baseline occurrence",
      );
    } finally {
      rmSync(callableRatchetRoot, { recursive: true, force: true });
    }

    const callableInsertionRoot = makeTempProject();
    try {
      const generatorFile = path.join(callableInsertionRoot, "src", "runtime", "legacy-generator.ts");
      const insertedDuplicateFile = path.join(callableInsertionRoot, "src", "runtime", "inserted-duplicate.ts");
      writeFileSync(generatorFile, longGeneratorClassMethod("LegacyStream", "stream", 105));
      writeFileSync(insertedDuplicateFile, longFunction("buildInserted", 120));
      assert.equal(git(callableInsertionRoot, ["init", "--quiet"]).status, 0);
      assert.equal(git(callableInsertionRoot, ["add", "."]).status, 0);
      commitFixture(callableInsertionRoot, "generator and duplicate baseline");

      writeFileSync(generatorFile, longGeneratorClassMethod("LegacyStream", "stream", 106));
      writeFileSync(
        insertedDuplicateFile,
        [longFunction("buildInserted", 107), longFunction("buildInserted", 5)].join("\n"),
      );
      assert.equal(git(callableInsertionRoot, ["add", "."]).status, 0);
      const insertionResult = runChecker(callableInsertionRoot, "--staged", "--strict", "--json");
      assert.equal(insertionResult.status, 1, insertionResult.stderr || insertionResult.stdout);
      const insertionReport = JSON.parse(insertionResult.stdout);
      assert(
        insertionReport.findings.some(
          (item) => item.kind === "long-function" && item.name === "stream" && item.severity === "blocker",
        ),
        "a growing generator class method over 100 lines must block",
      );
      assert(
        insertionReport.findings.some(
          (item) => item.kind === "long-function" && item.name === "buildInserted" && item.severity === "blocker",
        ),
        "a newly inserted same-name function must not borrow a longer legacy baseline",
      );
    } finally {
      rmSync(callableInsertionRoot, { recursive: true, force: true });
    }

    if (process.platform === "win32") {
      const fakeGit = path.join(root, "git.exe");
      copyFileSync(process.env.ComSpec, fakeGit);
      try {
        const hijackResult = runChecker(root, "--staged", "--json");
        assert.equal(hijackResult.status, 0, hijackResult.stderr || hijackResult.stdout);
        const hijackReport = JSON.parse(hijackResult.stdout);
        assert(
          hijackReport.findings.some((item) => item.kind === "large-file" && item.file.endsWith("runner.ts")),
          "staged scanning must not execute a target-local git.exe instead of the trusted Git executable",
        );
      } finally {
        rmSync(fakeGit, { force: true });
      }

      const outsideFakeBin = `${root}-outside-fake-bin`;
      const targetFakeBin = path.join(root, "fake-bin");
      mkdirSync(outsideFakeBin, { recursive: true });
      copyFileSync(process.env.ComSpec, path.join(outsideFakeBin, "git.exe"));
      symlinkSync(outsideFakeBin, targetFakeBin, "junction");
      try {
        const junctionHijackResult = spawnSync(process.execPath, [checker, root, "--staged", "--json"], {
          encoding: "utf8",
          env: { ...process.env, PATH: `${targetFakeBin}${path.delimiter}${process.env.PATH || ""}` },
        });
        assert.equal(
          junctionHijackResult.status,
          0,
          junctionHijackResult.stderr || junctionHijackResult.stdout,
        );
        const junctionHijackReport = JSON.parse(junctionHijackResult.stdout);
        assert(
          junctionHijackReport.findings.some(
            (item) => item.kind === "large-file" && item.file.endsWith("runner.ts"),
          ),
          "a target-local PATH junction must not redirect staged scanning to a fake Git executable",
        );
      } finally {
        rmSync(targetFakeBin, { recursive: true, force: true });
        rmSync(outsideFakeBin, { recursive: true, force: true });
      }
    }

    const stagedLinkRoot = makeTempProject();
    try {
      writeFileSync(path.join(stagedLinkRoot, "src", "runtime", "baseline.ts"), lines(5));
      assert.equal(spawnSync("git", ["init", "--quiet"], { cwd: stagedLinkRoot }).status, 0);
      assert.equal(spawnSync("git", ["add", "."], { cwd: stagedLinkRoot }).status, 0);
      const linkBlob = spawnSync("git", ["hash-object", "-w", "--stdin"], {
        cwd: stagedLinkRoot,
        input: "../outside.ts\n",
        encoding: "utf8",
      });
      assert.equal(linkBlob.status, 0, linkBlob.stderr || linkBlob.stdout);
      const cacheEntry = `120000,${linkBlob.stdout.trim()},src/runtime/staged-link.ts`;
      const stagedLink = spawnSync("git", ["update-index", "--add", "--cacheinfo", cacheEntry], {
        cwd: stagedLinkRoot,
        encoding: "utf8",
      });
      assert.equal(stagedLink.status, 0, stagedLink.stderr || stagedLink.stdout);

      const stagedLinkResult = runChecker(stagedLinkRoot, "--staged", "--strict", "--json");
      assert.equal(stagedLinkResult.status, 1, stagedLinkResult.stderr || stagedLinkResult.stdout);
      const stagedLinkReport = JSON.parse(stagedLinkResult.stdout);
      assert(
        stagedLinkReport.findings.some(
          (item) => item.kind === "unsafe-input" && item.file === "src/runtime/staged-link.ts",
        ),
        "staged scanning must reject symlink index entries or missing worktree inputs",
      );
    } finally {
      rmSync(stagedLinkRoot, { recursive: true, force: true });
    }

    const renameRoot = makeTempProject();
    try {
      const oldPath = path.join(renameRoot, "src", "runtime", "old-runtime.ts");
      const renamedPath = path.join(renameRoot, "src", "runtime", "重命名热区.ts");
      writeFileSync(oldPath, lines(301));
      assert.equal(spawnSync("git", ["init", "--quiet"], { cwd: renameRoot }).status, 0);
      assert.equal(spawnSync("git", ["add", "."], { cwd: renameRoot }).status, 0);
      const committed = spawnSync(
        "git",
        [
          "-c",
          "user.name=Hotspot Fixture",
          "-c",
          "user.email=hotspot@example.invalid",
          "commit",
          "--quiet",
          "-m",
          "fixture baseline",
        ],
        { cwd: renameRoot, encoding: "utf8" },
      );
      assert.equal(committed.status, 0, committed.stderr || committed.stdout);
      assert.equal(
        spawnSync("git", ["mv", "src/runtime/old-runtime.ts", "src/runtime/重命名热区.ts"], {
          cwd: renameRoot,
        }).status,
        0,
      );
      writeFileSync(renamedPath, lines(302));
      assert.equal(spawnSync("git", ["add", "."], { cwd: renameRoot }).status, 0);

      const renameResult = runChecker(renameRoot, "--staged", "--json");
      assert.equal(renameResult.status, 0, renameResult.stderr || renameResult.stdout);
      const renameReport = JSON.parse(renameResult.stdout);
      const renamedFinding = renameReport.findings.find(
        (item) => item.kind === "large-file" && item.file.endsWith("重命名热区.ts"),
      );
      assert(renamedFinding, "staged rename scanning must use the destination path");
      assert(renamedFinding.stagedAdded > 0, "rename numstat must be attached to the destination path");
    } finally {
      rmSync(renameRoot, { recursive: true, force: true });
    }
  }

} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("Hotspot checker tests passed");
