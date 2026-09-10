#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "skills", "ROUTING-MANIFEST.json"), "utf8"));
const indexText = fs.readFileSync(path.join(repoRoot, "skills", "INDEX.md"), "utf8");
const beginnerFlowText = fs.readFileSync(path.join(repoRoot, "skills", "beginner-flow-guide", "SKILL.md"), "utf8");
const routeMatrixText = fs.readFileSync(
  path.join(repoRoot, "skills", "beginner-flow-guide", "references", "route-matrix.md"),
  "utf8",
);
const noviceCases = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "tools", "fixtures", "routing-novice-cases.json"), "utf8"),
);

const designMicroTweakBoundarySkills = [
  "animate",
  "bolder",
  "clarify",
  "colorize",
  "critique",
  "delight",
  "distill",
  "overdrive",
  "quieter",
  "shape",
  "typeset",
];

function skill(id) {
  const item = manifest.skills.find((entry) => entry.id === id);
  assert(item, `Missing skill in manifest: ${id}`);
  return item;
}

function routeHintsOf(id) {
  const item = skill(id);
  assert(Array.isArray(item.routeHints), `${id}.routeHints should be an array`);
  assert(item.routeHints.length > 0, `${id}.routeHints should not be empty`);
  return item.routeHints.join(" / ");
}

function assertRouteHintIncludes(id, ...needles) {
  const haystack = routeHintsOf(id);
  for (const needle of needles) {
    assert(
      haystack.includes(needle),
      `Expected ${id}.routeHints to include ${JSON.stringify(needle)}, got:\n${haystack}`,
    );
  }
}

function assertIndexIncludes(id, ...needles) {
  const row = indexText
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("|") && line.includes(`\`${id}\``));
  assert(row, `skills/INDEX.md should list ${id}`);
  for (const needle of needles) {
    assert(row.includes(needle), `skills/INDEX.md row for ${id} should mention ${JSON.stringify(needle)}, got:\n${row}`);
  }
}

function assertRouteMatrixIncludes(...needles) {
  for (const needle of needles) {
    assert(
      routeMatrixText.includes(needle),
      `beginner-flow route matrix should mention ${JSON.stringify(needle)}`,
    );
  }
}

function assertRouteMatrixRowIncludes(anchor, ...needles) {
  const row = routeMatrixText
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("|") && line.includes(anchor));
  assert(row, `beginner-flow route matrix should include row anchor ${JSON.stringify(anchor)}`);
  for (const needle of needles) {
    assert(
      row.includes(needle),
      `beginner-flow route matrix row ${JSON.stringify(anchor)} should mention ${JSON.stringify(needle)}, got:\n${row}`,
    );
  }
}

const virtualRoutes = new Map([
  ["fast-lane", "小任务快车道"],
  ["ui-micro-tweak-fast-lane", "UI 微调快车道"],
  ["hazard-mode", "hazard mode"],
  ["no-skill", "自然语言不自动加载具体 Skill"],
]);

function assertNoviceFixtureSchema(cases) {
  assert(Array.isArray(cases), "routing-novice-cases fixture should be an array");
  const seen = new Set();
  for (const testCase of cases) {
    for (const field of ["id", "utterance", "expectedRoute", "expectedTier", "mustContain", "mustNotRoute", "notes"]) {
      assert(Object.hasOwn(testCase, field), `Fixture case is missing ${field}: ${JSON.stringify(testCase)}`);
    }
    assert(!seen.has(testCase.id), `Duplicate novice route fixture id: ${testCase.id}`);
    seen.add(testCase.id);
    assert(/^[a-z0-9-]+$/.test(testCase.id), `Fixture id should be kebab-case: ${testCase.id}`);
    assert(testCase.utterance.trim().length > 0, `${testCase.id}.utterance should not be empty`);
    assert(/^(T0|T1|T2|T3|T3\+)$/.test(testCase.expectedTier), `${testCase.id}.expectedTier is invalid`);
    assert(Array.isArray(testCase.mustContain), `${testCase.id}.mustContain should be an array`);
    assert(Array.isArray(testCase.mustNotRoute), `${testCase.id}.mustNotRoute should be an array`);
    assert(testCase.mustContain.length > 0, `${testCase.id}.mustContain should include at least one evidence phrase`);
    if (testCase.activation !== undefined) {
      assert(
        ["closed", "current-turn", "prior-turn"].includes(testCase.activation),
        `${testCase.id}.activation is invalid: ${testCase.activation}`,
      );
    }
  }
}

function assertNoviceCasesCovered(cases) {
  const evidenceCorpus = [routeMatrixText, indexText, JSON.stringify(manifest)].join("\n");
  const allowedRoutes = new Set([...manifest.skills.map((entry) => entry.id), ...virtualRoutes.keys()]);

  for (const testCase of cases) {
    const activation = testCase.activation || "closed";
    assert(allowedRoutes.has(testCase.expectedRoute), `${testCase.id} uses unknown expectedRoute: ${testCase.expectedRoute}`);
    if (activation === "closed") {
      const isVirtualRoute = virtualRoutes.has(testCase.expectedRoute);
      assert(
        isVirtualRoute || testCase.expectedRoute === "no-skill",
        `${testCase.id} must not load a concrete Skill while the gate is closed`,
      );
    } else {
      assert.notEqual(testCase.expectedRoute, "no-skill", `${testCase.id} must exercise a route after activation`);
    }

    if (virtualRoutes.has(testCase.expectedRoute)) {
      const evidence = virtualRoutes.get(testCase.expectedRoute);
      assert(evidenceCorpus.includes(evidence), `${testCase.id} should have evidence for virtual route ${evidence}`);
    } else {
      assert(skill(testCase.expectedRoute), `${testCase.id} expected skill should exist: ${testCase.expectedRoute}`);
    }

    for (const phrase of testCase.mustContain) {
      assert(evidenceCorpus.includes(phrase), `${testCase.id} evidence should include ${JSON.stringify(phrase)}`);
    }

    for (const forbiddenRoute of testCase.mustNotRoute) {
      assert.notEqual(
        testCase.expectedRoute,
        forbiddenRoute,
        `${testCase.id} should not be routed to ${forbiddenRoute}`,
      );
      assert(
        evidenceCorpus.includes(`不进入 \`${forbiddenRoute}\``) ||
          evidenceCorpus.includes(`不走 \`${forbiddenRoute}\``) ||
          evidenceCorpus.includes(`不启动 \`${forbiddenRoute}\``),
        `${testCase.id} should document why it does not route to ${forbiddenRoute}`,
      );
    }
  }
}

function assertExplicitInvocationPolicy() {
  const userEntries = manifest.skills.filter((entry) => entry.invocation === "user-only");
  assert.deepEqual(userEntries.map((entry) => entry.id), ["vibe-coding-skills"]);

  for (const entry of manifest.skills) {
    assert.equal(typeof entry.invocation, "string", `${entry.id}.invocation should be present`);
    assert.equal(typeof entry.userInvocable, "boolean", `${entry.id}.userInvocable should be present`);
    assert.equal(typeof entry.disableModelInvocation, "boolean", `${entry.id}.disableModelInvocation should be present`);
    if (entry.id === "vibe-coding-skills") {
      assert.equal(entry.userInvocable, true);
      assert.equal(entry.disableModelInvocation, true);
      assert.equal(entry.activation, "conversation-explicit");
      assert.equal(entry.manualOnly, undefined);
      continue;
    }
    assert.equal(entry.userInvocable, false, `${entry.id} must not be a user-facing entry`);
    if (entry.invocation === "event-only") {
      assert.equal(entry.disableModelInvocation, true, `${entry.id} must not be model-invoked from ordinary natural language`);
      assert.equal(entry.activation, "structured-event", `${entry.id} must remain structured-event activated`);
      assert.equal(entry.manualOnly, undefined);
    } else {
      assert.equal(entry.invocation, "router-only", `${entry.id} must be routed by the total entry`);
      assert.equal(entry.disableModelInvocation, true, `${entry.id} must not be model-invoked from natural language`);
      assert.equal(entry.activation, "conversation-gated", `${entry.id} must be gated by the current conversation entry`);
      assert.equal(entry.manualOnly, true, `${entry.id} must be marked router-only in the manifest`);
      assert(routeHintsOf(entry.id).length > 0, `${entry.id} must retain router hints`);
    }
  }
}

function assertNoStaleMicroTweakFastPathText(id) {
  const skillText = fs.readFileSync(path.join(repoRoot, "skills", id, "SKILL.md"), "utf8");
  const stalePhrase = "use existing context and skip `/impeccable teach`";
  const staleLines = skillText
    .split(/\r?\n/)
    .filter((line) => line.includes(stalePhrase))
    .filter((line) => !(line.includes("do not invoke this Skill") || line.includes("UI micro-tweak fast lane")));

  assert.deepEqual(
    staleLines,
    [],
    `${id} should route T0/T1 visual tweaks to the UI micro-tweak fast lane before reusing context:\n${staleLines.join(
      "\n",
    )}`,
  );
}

assert.equal(manifest.version, 3);
assertExplicitInvocationPolicy();
assert.equal(skill("shape").manualOnly, true);
assertRouteHintIncludes("shape", "shape", "总入口指定");
assertNoviceFixtureSchema(noviceCases);
assertNoviceCasesCovered(noviceCases);

const closedCases = noviceCases.filter((testCase) => !testCase.activation || testCase.activation === "closed");
assert(closedCases.length > 0, "routing fixtures must retain closed-gate natural language cases");
assert(
  closedCases.every((testCase) => testCase.expectedRoute === "no-skill" || virtualRoutes.has(testCase.expectedRoute)),
  "closed-gate cases must not load a concrete Skill",
);
const activatedCases = noviceCases.filter((testCase) => testCase.activation === "current-turn" || testCase.activation === "prior-turn");
assert(activatedCases.some((testCase) => testCase.expectedRoute === "bug-fixer"), "activated fixtures must cover natural-language bug routing");
assert(activatedCases.some((testCase) => testCase.expectedRoute === "optimize"), "activated fixtures must cover follow-up natural-language routing");
assertRouteMatrixIncludes("当前对话", "新对话默认关闭", "后续普通自然语言");

const strongSignalSection = beginnerFlowText.split("[强信号快车道名单]")[1]?.split("[DocMap]")[0] || "";
for (const phrase of ["风险信号优先于强信号", "安全", "权限", "不得强制判为 T0/T1"]) {
  assert(
    strongSignalSection.includes(phrase),
    `beginner-flow strong-signal fast lane must preserve the risk veto: ${JSON.stringify(phrase)}`,
  );
}

const lowFrequencySkills = [
  ["adapt", "移动端适配", "响应式"],
  ["animate", "微交互", "过渡"],
  ["bolder", "更大胆", "更有冲击力"],
  ["clarify", "错误提示更清楚", "文案更清楚"],
  ["colorize", "加一点颜色", "更有色彩"],
  ["delight", "惊喜感", "更有趣"],
  ["distill", "简化", "减少噪音"],
  ["harden", "空状态", "边界情况", "生产可用"],
  ["optimize", "页面卡顿", "性能"],
  ["overdrive", "惊艳", "高阶动效"],
  ["quieter", "更克制", "太花"],
  ["shape", "shape 规划"],
];

for (const [id, ...needles] of lowFrequencySkills) {
  assertIndexIncludes(id, ...needles);
  const hints = routeHintsOf(id);
  for (const needle of needles) {
    assert(hints.includes(needle), `Expected ${id}.routeHints to include ${JSON.stringify(needle)}, got:\n${hints}`);
  }
}

for (const id of designMicroTweakBoundarySkills) {
  assertNoStaleMicroTweakFastPathText(id);
}

const testAutomationHints = routeHintsOf("test-automation");
assert(testAutomationHints.includes("自动化测试"), "test-automation route hints should include automation testing");
assert(testAutomationHints.includes("E2E"), "test-automation route hints should include E2E");
assert(testAutomationHints.includes("回归"), "test-automation route hints should include regression");
assert(testAutomationHints.includes("Playwright"), "test-automation route hints should include Playwright");
assert(testAutomationHints.includes("Vitest"), "test-automation route hints should include Vitest");
assert(testAutomationHints.includes("pytest"), "test-automation route hints should include pytest");
assert(!testAutomationHints.includes("自动化办公"), "test-automation should not claim office automation");
assertRouteMatrixIncludes("自动化办公", "不走 `test-automation`");

assertIndexIncludes("requirements-test-designer", "PRD", "工程级测试用例体系", "追溯矩阵");
const requirementsTestHints = routeHintsOf("requirements-test-designer");
for (const needle of ["PRD", "需求文档", "测试用例", "追溯矩阵"]) {
  assert(requirementsTestHints.includes(needle), `requirements-test-designer route hints should include ${JSON.stringify(needle)}`);
}
assertRouteMatrixRowIncludes("PRD 生成测试用例", "requirements-test-designer", "不进入 `test-automation` 写测试代码");

assertIndexIncludes("hotspot-governor", "核心热区", "大文件", "超大组件");
const hotspotHints = routeHintsOf("hotspot-governor");
for (const needle of ["核心热区", "大文件", "这一坨太大", "别往这里塞"]) {
  assert(hotspotHints.includes(needle), `hotspot-governor route hints should include ${JSON.stringify(needle)}`);
}
assertRouteMatrixRowIncludes("文件太长", "hotspot-governor", "大测试", "重复 helper");

assertRouteMatrixIncludes(
  "agent routing",
  "pre-commit",
  "filesystem",
  "shell",
  "network",
  "eval",
);

assertRouteMatrixIncludes(
  "Spec / diff / 实现完整性",
  "UI 微调快车道",
  "accessibility / performance / theming / responsive / anti-pattern",
  "设计判断",
  "资料 / 规则增强",
  "motion / transition / micro-interaction",
  "情绪 / 惊喜 / 人格化体验",
  "交付前一致性",
);

console.log("Routing keyword coverage tests passed");
