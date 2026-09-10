#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const checker = path.join(repoRoot, "tools", "check-hotspots.mjs");
const goldenScenarios = JSON.parse(
  readFileSync(path.join(repoRoot, "tools", "fixtures", "hotspot-governor-human-scenarios.json"), "utf8"),
);

const REPORT_SECTIONS = ["热区结论", "证据", "风险", "拆分路线", "后续路由", "人工验收状态"];
const FORBIDDEN_RESPONSE_PHRASES = ["已完成重构", "已经直接修改", "必须立刻重构", "无需确认直接开拆"];

function lines(count, line = "export const value = 1;") {
  return Array.from({ length: count }, (_, index) => `${line} // ${index}`).join("\n");
}

function writeFile(root, relPath, content) {
  const target = path.join(root, relPath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function largeComponent(name, bodyLines) {
  return [
    `export function ${name}() {`,
    "  const items = [",
    ...Array.from({ length: bodyLines }, (_, index) => `    "item-${index}",`),
    "  ];",
    "  return <section>{items.length}</section>;",
    "}",
    "",
  ].join("\n");
}

function runChecker(root, args = ["--json"]) {
  const result = spawnSync("node", [checker, root, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function initStagedRepo(root) {
  const gitVersion = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (gitVersion.status !== 0) return false;

  assert.equal(spawnSync("git", ["init"], { cwd: root, encoding: "utf8" }).status, 0);
  assert.equal(spawnSync("git", ["add", "."], { cwd: root, encoding: "utf8" }).status, 0);
  return true;
}

function conclusionFor(summary) {
  if (summary.blockers > 0) return "有阻断候选";
  if (summary.hotspots > 0) return "有核心热区";
  if (summary.warnings > 0) return "有提醒线";
  return "无明显热区";
}

function assertFinding(report, expected) {
  assert(
    report.findings.some((finding) => {
      if (expected.kind && finding.kind !== expected.kind) return false;
      if (expected.severity && finding.severity !== expected.severity) return false;
      if (expected.fileEndsWith && !finding.file?.endsWith(expected.fileEndsWith)) return false;
      if (expected.name && finding.name !== expected.name) return false;
      if (expected.category && !finding.categories?.includes(expected.category)) return false;
      return true;
    }),
    `Expected finding not found:\n${JSON.stringify(expected, null, 2)}\nActual:\n${JSON.stringify(report.findings, null, 2)}`,
  );
}

function assertGoldenResponse(golden, scenario, report) {
  assert.equal(conclusionFor(report.summary), golden.expectedConclusion, scenario.id);
  assert.equal(golden.userText, scenario.userText, scenario.id);

  const response = golden.expectedResponse;
  for (const section of REPORT_SECTIONS) {
    assert(response.includes(`**${section}**`), `${scenario.id} response should include ${section}`);
  }
  assert(response.includes(golden.expectedConclusion), `${scenario.id} should include expected conclusion`);
  assert(response.includes(golden.expectedRoute), `${scenario.id} should include expected route`);
  assert(response.includes(scenario.expectedFinding.fileEndsWith), `${scenario.id} should cite scanner file evidence`);
  for (const forbidden of FORBIDDEN_RESPONSE_PHRASES) {
    assert(!response.includes(forbidden), `${scenario.id} response should not include ${forbidden}`);
  }
}

const scenarios = [
  {
    id: "novice-cannot-understand-large-file",
    userText: "这一坨太大我看不懂，你先告诉我怎么办",
    intent: "diagnosis",
    route: "等待用户确认",
    expectedConclusion: "有提醒线",
    expectedFinding: { kind: "large-file", severity: "warn", fileEndsWith: "src/features/order-flow.ts" },
    setup(root) {
      writeFile(root, "src/features/order-flow.ts", lines(321, "export const orderStep = 1;"));
    },
  },
  {
    id: "stop-adding-to-hotspot",
    userText: "别往这里塞了，先看看 staged 里是不是又堆大了",
    intent: "review-before-adding",
    route: "code-review",
    staged: true,
    expectedConclusion: "有阻断候选",
    expectedFinding: { kind: "large-file", severity: "blocker", fileEndsWith: "src/runtime/runner.ts", category: "core-runtime" },
    setup(root) {
      writeFile(root, "src/runtime/runner.ts", lines(851, "export const runtimeStep = 1;"));
    },
  },
  {
    id: "large-react-component",
    userText: "这个超大组件怎么办，我只是觉得它越来越难改",
    intent: "diagnosis",
    route: "ui-system-guardian",
    expectedConclusion: "有提醒线",
    expectedFinding: { kind: "long-component", severity: "warn", fileEndsWith: "src/components/HugePanel.tsx", name: "HugePanel" },
    setup(root) {
      writeFile(root, "src/components/HugePanel.tsx", largeComponent("HugePanel", 181));
    },
  },
  {
    id: "large-test-file",
    userText: "这个测试文件太大了，后面还要继续加用例吗",
    intent: "diagnosis",
    route: "test-automation",
    expectedConclusion: "有核心热区",
    expectedFinding: { kind: "large-file", severity: "hotspot", fileEndsWith: "tests/checkout.e2e.test.ts", category: "test" },
    setup(root) {
      writeFile(root, "tests/checkout.e2e.test.ts", lines(851, "it('keeps checkout stable', () => {});"));
    },
  },
  {
    id: "large-schema-config",
    userText: "这个 schema/config 越来越大，是不是该拆一下",
    intent: "diagnosis",
    route: "dev-builder",
    expectedConclusion: "有提醒线",
    expectedFinding: {
      kind: "large-file",
      severity: "warn",
      fileEndsWith: "src/schema/customer.schema.ts",
      category: "token-schema-config",
    },
    setup(root) {
      writeFile(root, "src/schema/customer.schema.ts", lines(321, "export const customerSchemaField = 'value';"));
    },
  },
  {
    id: "start-implementing-split-plan",
    userText: "同意，开始按方案拆，但别乱动别的",
    intent: "implementation",
    route: "dev-builder",
    expectedConclusion: "有核心热区",
    expectedFinding: { kind: "large-file", severity: "hotspot", fileEndsWith: "src/actions/order-actions.ts", category: "core-runtime" },
    setup(root) {
      writeFile(root, "src/actions/order-actions.ts", lines(851, "export const actionStep = 1;"));
    },
  },
];

const goldenById = new Map(goldenScenarios.map((scenario) => [scenario.id, scenario]));

let executed = 0;
const skipped = [];
for (const scenario of scenarios) {
  const root = mkdtempSync(path.join(tmpdir(), `hotspot-human-${scenario.id}-`));
  try {
    scenario.setup(root);
    if (scenario.staged && !initStagedRepo(root)) {
      skipped.push(`${scenario.id}: git unavailable`);
      continue;
    }

    const report = runChecker(root, scenario.staged ? ["--staged", "--json"] : ["--json"]);
    assertFinding(report, scenario.expectedFinding);

    const golden = goldenById.get(scenario.id);
    assert(golden, `Missing golden scenario: ${scenario.id}`);
    assert.equal(golden.expectedRoute, scenario.route, scenario.id);
    assertGoldenResponse(golden, scenario, report);
    executed += 1;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

assert.deepEqual(skipped, [], `Human scenario tests should not skip staged evidence:\n${skipped.join("\n")}`);
assert.equal(goldenById.size, scenarios.length, "Golden scenario count should match executable scenarios");
assert.equal(executed, scenarios.length, `Expected ${scenarios.length} scenarios to run, executed ${executed}`);

console.log(`Hotspot governor human scenario tests passed (${executed} scenarios)`);
