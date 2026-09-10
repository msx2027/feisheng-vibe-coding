#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderLedgerMarkdown } from "./experience-ledger-core.mjs";
import {
  experienceHash,
  parseExperienceRegistry,
  parseExperienceProjection,
  registryInfoFromRegistry,
  renderExperienceProjectionBlock,
  renderExperienceRegistryBlock,
} from "./experience-managed-blocks.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtimeTool = path.join(repoRoot, "tools", "init-target-runtime.mjs");
const constitutionPath = "docs/项目治理/宪法设计.md";
const ledgerPath = "docs/项目治理/经验治理.md";

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function write(root, file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function read(root, file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function runRuntime(root, mode) {
  return spawnSync(process.execPath, [runtimeTool, root, "--skills-root", repoRoot, mode, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function registry(rules) {
  return { schemaVersion: 1, sourceRevision: 1, rules };
}

function rawRegistryBlock(registryValue) {
  const body = JSON.stringify(registryValue, null, 2);
  return rawRegistryBodyBlock(body);
}

function rawRegistryBodyBlock(body) {
  return [
    `<!-- vibe-coding-skills:target-experience-registry:start version=1 checksum=${experienceHash(body)} -->`,
    body,
    "<!-- vibe-coding-skills:target-experience-registry:end -->",
  ].join("\n");
}

const duplicateRegistryBodies = [
  ["duplicate schemaVersion", `{
  "schemaVersion": 999,
  "schemaVersion": 1,
  "sourceRevision": 1,
  "rules": [{ "experienceId": "EXP-001", "text": "必须遵守规则。", "status": "active" }]
}`, /duplicate|schemaVersion|重复/iu],
  ["escaped duplicate schemaVersion", `{
  "schema\\u0056ersion": 999,
  "schemaVersion": 1,
  "sourceRevision": 1,
  "rules": [{ "experienceId": "EXP-001", "text": "必须遵守规则。", "status": "active" }]
}`, /duplicate|schemaVersion|重复/iu],
  ["duplicate rule status", `{
  "schemaVersion": 1,
  "sourceRevision": 1,
  "rules": [{ "experienceId": "EXP-001", "text": "必须遵守规则。", "status": "bogus", "status": "active" }]
}`, /duplicate|status|重复/iu],
];

const malformedRegistries = [
  ["schemaVersion", (value) => ({ ...value, schemaVersion: 2 }), /schemaVersion|schema version/iu],
  ["extra root", (value) => ({ ...value, injected: true }), /unknown|extra|injected|额外/iu],
  ["extra rule", (value) => ({ ...value, rules: [{ ...value.rules[0], injected: true }] }), /unknown|extra|injected|额外/iu],
  ["bogus status", (value) => ({ ...value, rules: [{ ...value.rules[0], status: "bogus" }] }), /bogus|candidate or active|registry rule.*status/iu],
];

function anchorFor(registryValue) {
  if (registryValue.rules.length === 0) return null;
  const info = registryInfoFromRegistry(registryValue, constitutionPath);
  return {
    path: constitutionPath,
    blockIdentity: "target-experience-registry",
    blockVersion: "1",
    sourceHash: info.sourceHash,
  };
}

function baseLedger(registryValue, overrides = {}) {
  return {
    vibeExperienceLedger: "v2",
    revision: 1,
    l1RegistryAnchor: anchorFor(registryValue),
    thresholds: { L0: 3, L1: 5, L2: 8 },
    processedEvents: [],
    consumedConfirmations: [],
    experiences: [{
      id: "EXP-001",
      summary: "重复踩坑",
      tier: "L0",
      count: 2,
      trajectory: ["2026-07-23 记录@L0"],
      landing: null,
    }],
    archived: [],
    ...overrides,
  };
}

function setupTarget(rules = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-exp-anchor-"));
  const registryValue = registry(rules);
  write(root, ".vibe-docs.json", `${JSON.stringify({
    schemaVersion: 2,
    constitutionDesign: constitutionPath,
    experienceGovernance: ledgerPath,
  }, null, 2)}\n`);
  write(root, constitutionPath, `# 宪法设计\n\n${renderExperienceRegistryBlock(registryValue)}\n`);
  write(root, ledgerPath, renderLedgerMarkdown(baseLedger(registryValue)));
  const bootstrap = runRuntime(root, "--write");
  assert.equal(bootstrap.status, 0, bootstrap.stderr || bootstrap.stdout);
  return { root, registryValue };
}

function tracked(root) {
  return Object.fromEntries([ledgerPath, constitutionPath, "AGENTS.md", "CLAUDE.md", ".vibe-runtime.json"]
    .map((file) => [file, read(root, file)]));
}

function assertTracked(root, before) {
  for (const [file, content] of Object.entries(before)) assert.equal(read(root, file), content, file);
}

function replaceProjection(content, file, registryInfo) {
  const parsed = parseExperienceProjection(content, file);
  const block = renderExperienceProjectionBlock(file, registryInfo);
  return `${content.slice(0, parsed.block.start)}${block}${content.slice(parsed.block.end)}`;
}

function writeLedger(root, ledger) {
  write(root, ledgerPath, renderLedgerMarkdown(ledger));
}

function event(eventId) {
  return {
    eventId,
    signalType: "explicit-correction",
    scope: "target-project",
    promptHash: sha256(eventId),
    occurredAt: "2026-07-23T09:59:00.000Z",
  };
}

function confirmation(action, tier, eventId) {
  const value = {
    receiptId: `CONF-${action}-${tier}`,
    eventId,
    experienceId: "EXP-001",
    scope: "target-project",
    action,
    tier,
    confirmedAt: "2026-07-23T10:00:00.000Z",
  };
  value.confirmationHash = sha256(JSON.stringify(value));
  return value;
}

const governance = await import(`${pathToFileURL(path.join(repoRoot, "tools", "experience-governance.mjs")).href}?anchor=${Date.now()}`);

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error?.stack || error);
  }
}

await check("无 L1 registry 的新 bootstrap 允许 canonical anchor=null", () => {
  const { root } = setupTarget([]);
  try {
    const result = runRuntime(root, "--check");
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

await check("runtime check/write 对四类畸形 L1 registry 使用 exact validator 且文件不变", () => {
  const failures = [];
  for (const [name, mutate, errorPattern] of malformedRegistries) {
    const rules = [{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }];
    const { root, registryValue } = setupTarget(rules);
    try {
      write(root, constitutionPath, `# 宪法设计\n\n${rawRegistryBlock(mutate(registryValue))}\n`);
      const before = tracked(root);
      for (const mode of ["--check", "--write"]) {
        const result = runRuntime(root, mode);
        const output = `${result.stdout}\n${result.stderr}`;
        if (result.status === 0 || !errorPattern.test(output)) failures.push({ name, mode, status: result.status, output });
        try {
          assertTracked(root, before);
        } catch (error) {
          failures.push({ name, mode, modified: error.message });
        }
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  assert.deepEqual(failures, []);
});

await check("raw duplicate-key registry 在 parser 与 runtime check/write 前 fail closed 且文件不变", () => {
  const failures = [];
  for (const [name, body, errorPattern] of duplicateRegistryBodies) {
    const rules = [{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }];
    const { root } = setupTarget(rules);
    try {
      const block = rawRegistryBodyBlock(body);
      assert.throws(() => parseExperienceRegistry(`# 宪法设计\n\n${block}\n`), errorPattern, `${name}: parser`);
      write(root, constitutionPath, `# 宪法设计\n\n${block}\n`);
      const before = tracked(root);
      for (const mode of ["--check", "--write"]) {
        const result = runRuntime(root, mode);
        const output = `${result.stdout}\n${result.stderr}`;
        if (result.status === 0 || !errorPattern.test(output)) failures.push({ name, mode, status: result.status, output });
        try {
          assertTracked(root, before);
        } catch (error) {
          failures.push({ name, mode, modified: error.message });
        }
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  assert.deepEqual(failures, []);
});

for (const [name, mutate] of [
  ["missing", (ledger) => delete ledger.l1RegistryAnchor],
  ["null", (ledger) => { ledger.l1RegistryAnchor = null; }],
  ["path", (ledger) => { ledger.l1RegistryAnchor.path = "docs/项目治理/其他文档.md"; }],
  ["version", (ledger) => { ledger.l1RegistryAnchor.blockVersion = "2"; }],
  ["hash", (ledger) => { ledger.l1RegistryAnchor.sourceHash = `sha256:${"0".repeat(64)}`; }],
]) {
  await check(`runtime check/write 拒绝 ${name} anchor 且文件不变`, () => {
    const { root, registryValue } = setupTarget([{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }]);
    try {
      const ledger = baseLedger(registryValue);
      mutate(ledger);
      writeLedger(root, ledger);
      const before = tracked(root);
      for (const mode of ["--check", "--write"]) {
        const result = runRuntime(root, mode);
        assert.equal(result.status, 1, `${name} anchor 必须在 ${mode} fail closed`);
        const output = `${result.stdout}\n${result.stderr}`;
        assert.match(output, /anchor|adoption|conflict/iu);
        if (name === "missing" || name === "null") {
          assert.match(output, /anchor-adoption-required/iu);
        } else {
          assert.doesNotMatch(output, /anchor-adoption-required/iu);
        }
        assertTracked(root, before);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

await check("L1+双 L2+runtime registry 协同改写但 L0 不变时 fail closed", () => {
  const rules = [{ experienceId: "EXP-001", text: "原始规则。", status: "active" }];
  const { root } = setupTarget(rules);
  try {
    const tamperedRegistry = registry([{ experienceId: "EXP-001", text: "协同篡改规则。", status: "active" }]);
    const tamperedInfo = registryInfoFromRegistry(tamperedRegistry, constitutionPath);
    write(root, constitutionPath, `# 宪法设计\n\n${renderExperienceRegistryBlock(tamperedRegistry)}\n`);
    const outputs = {};
    for (const file of ["AGENTS.md", "CLAUDE.md"]) {
      const next = replaceProjection(read(root, file), file, tamperedInfo);
      write(root, file, next);
      outputs[file] = { sourceHash: tamperedInfo.sourceHash, outputHash: experienceHash(renderExperienceProjectionBlock(file, tamperedInfo)) };
    }
    const runtime = JSON.parse(read(root, ".vibe-runtime.json"));
    runtime.experienceProjection = { version: "1", source: constitutionPath, sourceHash: tamperedInfo.sourceHash, outputs };
    write(root, ".vibe-runtime.json", `${JSON.stringify(runtime, null, 2)}\n`);
    const before = tracked(root);
    for (const mode of ["--check", "--write"]) {
      const result = runRuntime(root, mode);
      assert.equal(result.status, 1, `L1+L2+runtime 协同篡改必须在 ${mode} 被 L0 anchor 拦截`);
      assert.match(`${result.stdout}\n${result.stderr}`, /anchor|sourceHash|conflict/iu);
      assertTracked(root, before);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

for (const scenario of [
  {
    name: "record",
    ledger(registryValue) {
      const value = baseLedger(registryValue);
      delete value.l1RegistryAnchor;
      return value;
    },
    request: { action: "record", expectedRevision: 1, experienceId: "EXP-001", event: event("EVT-RECORD") },
  },
  {
    name: "elevate",
    ledger(registryValue) {
      const actionEvent = event("EVT-ELEVATE");
      const value = baseLedger(registryValue, {
        experiences: [{ ...baseLedger(registryValue).experiences[0], count: 3 }],
        processedEvents: [{ ...actionEvent, experienceId: "EXP-001" }],
      });
      delete value.l1RegistryAnchor;
      return value;
    },
    request: {
      action: "elevate",
      expectedRevision: 1,
      experienceId: "EXP-001",
      ruleText: "必须遵守规则。",
      confirmation: confirmation("elevate", "L0", "EVT-ELEVATE"),
    },
  },
  {
    name: "retire",
    ledger(registryValue) {
      const actionEvent = event("EVT-RETIRE");
      const value = baseLedger(registryValue, {
        experiences: [{ ...baseLedger(registryValue).experiences[0], tier: "L1", count: 5 }],
        processedEvents: [{ ...actionEvent, experienceId: "EXP-001" }],
      });
      delete value.l1RegistryAnchor;
      return value;
    },
    request: {
      action: "retire",
      expectedRevision: 1,
      experienceId: "EXP-001",
      confirmation: confirmation("retire", "L1", "EVT-RETIRE"),
    },
  },
]) {
  await check(`orchestrator ${scenario.name} 在 current L1 缺 anchor 时 fail closed`, () => {
    const rules = [{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }];
    const { root, registryValue } = setupTarget(rules);
    try {
      writeLedger(root, scenario.ledger(registryValue));
      const before = tracked(root);
      assert.throws(
        () => governance.executeExperienceAction({ targetRoot: root, skillsRoot: repoRoot, ...scenario.request }),
        /anchor-adoption-required|anchor|adoption/iu,
      );
      assertTracked(root, before);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

await check("orchestrator 中途故障回滚 L1 与 L0 anchor", () => {
  const { root, registryValue } = setupTarget([]);
  const actionEvent = event("EVT-ROLLBACK");
  try {
    writeLedger(root, baseLedger(registryValue, {
      experiences: [{ ...baseLedger(registryValue).experiences[0], count: 3 }],
      processedEvents: [{ ...actionEvent, experienceId: "EXP-001" }],
    }));
    const before = tracked(root);
    const originalRename = fs.renameSync;
    let injected = false;
    fs.renameSync = (from, to) => {
      if (!injected && path.resolve(to) === path.resolve(root, ledgerPath)) {
        injected = true;
        throw new Error("injected anchor transaction failure");
      }
      return originalRename(from, to);
    };
    try {
      assert.throws(() => governance.executeExperienceAction({
        targetRoot: root,
        skillsRoot: repoRoot,
        action: "elevate",
        expectedRevision: 1,
        experienceId: "EXP-001",
        ruleText: "新建 L1 规则。",
        confirmation: confirmation("elevate", "L0", "EVT-ROLLBACK"),
      }), /injected anchor transaction failure/u);
    } finally {
      fs.renameSync = originalRename;
    }
    assert.equal(injected, true, "故障必须发生在 L1 写入后的 ledger anchor 写入阶段");
    assertTracked(root, before);
    assert.equal(fs.existsSync(path.join(root, ".vibe-experience-transaction.json")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

for (const anchorMode of ["missing", "null"]) {
  await check(`显式 adoption 成功接入 ${anchorMode} anchor 且只写 L0`, () => {
    const rules = [{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }];
    const { root, registryValue } = setupTarget(rules);
    try {
      const ledger = baseLedger(registryValue);
      if (anchorMode === "missing") delete ledger.l1RegistryAnchor;
      else ledger.l1RegistryAnchor = null;
      writeLedger(root, ledger);
      const before = tracked(root);
      const adopted = governance.executeExperienceAction({
        targetRoot: root,
        skillsRoot: repoRoot,
        action: "adopt-anchor",
        expectedRevision: 1,
      });
      assert.equal(adopted.ok, true);
      assert.deepEqual(adopted.changed, [ledgerPath]);
      const next = JSON.parse(read(root, ledgerPath).match(/```json vibe-experience-ledger\n([\s\S]*?)\n```/u)[1]);
      assert.deepEqual(next.l1RegistryAnchor, anchorFor(registryValue));
      assert.equal(next.revision, 2);
      for (const file of [constitutionPath, "AGENTS.md", "CLAUDE.md", ".vibe-runtime.json"]) {
        assert.equal(read(root, file), before[file], `${anchorMode} adoption 不得修改 ${file}`);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

await check("显式 adoption 对四类畸形 L1 registry fail closed 且不写文件", () => {
  const failures = [];
  for (const [name, mutate, errorPattern] of malformedRegistries) {
    const rules = [{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }];
    const { root, registryValue } = setupTarget(rules);
    try {
      const ledger = baseLedger(registryValue);
      delete ledger.l1RegistryAnchor;
      writeLedger(root, ledger);
      write(root, constitutionPath, `# 宪法设计\n\n${rawRegistryBlock(mutate(registryValue))}\n`);
      const before = tracked(root);
      let thrown;
      try {
        governance.executeExperienceAction({
          targetRoot: root,
          skillsRoot: repoRoot,
          action: "adopt-anchor",
          expectedRevision: 1,
        });
      } catch (error) {
        thrown = error;
      }
      if (!thrown || !errorPattern.test(thrown.message)) failures.push({ name, error: thrown?.message || "missing exception" });
      try {
        assertTracked(root, before);
      } catch (error) {
        failures.push({ name, modified: error.message });
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  assert.deepEqual(failures, []);
});

await check("显式 adoption 对 raw duplicate-key registry fail closed 且不写文件", () => {
  const failures = [];
  for (const [name, body, errorPattern] of duplicateRegistryBodies) {
    const rules = [{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }];
    const { root, registryValue } = setupTarget(rules);
    try {
      const ledger = baseLedger(registryValue);
      delete ledger.l1RegistryAnchor;
      writeLedger(root, ledger);
      write(root, constitutionPath, `# 宪法设计\n\n${rawRegistryBodyBlock(body)}\n`);
      const before = tracked(root);
      let thrown;
      try {
        governance.executeExperienceAction({ targetRoot: root, skillsRoot: repoRoot, action: "adopt-anchor", expectedRevision: 1 });
      } catch (error) {
        thrown = error;
      }
      if (!thrown || !errorPattern.test(thrown.message)) failures.push({ name, error: thrown?.message || "missing exception" });
      try {
        assertTracked(root, before);
      } catch (error) {
        failures.push({ name, modified: error.message });
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  assert.deepEqual(failures, []);
});

await check("普通治理动作对四类畸形 L1 registry fail closed 且不写文件", () => {
  const failures = [];
  for (const [name, mutate, errorPattern] of malformedRegistries) {
    const rules = [{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }];
    const { root, registryValue } = setupTarget(rules);
    try {
      write(root, constitutionPath, `# 宪法设计\n\n${rawRegistryBlock(mutate(registryValue))}\n`);
      const before = tracked(root);
      let thrown;
      try {
        governance.executeExperienceAction({
          targetRoot: root,
          skillsRoot: repoRoot,
          action: "record",
          expectedRevision: 1,
          experienceId: "EXP-001",
          event: event("EVT-MALFORMED-REGISTRY"),
        });
      } catch (error) {
        thrown = error;
      }
      if (!thrown || !errorPattern.test(thrown.message)) failures.push({ name, error: thrown?.message || "missing exception" });
      try {
        assertTracked(root, before);
      } catch (error) {
        failures.push({ name, modified: error.message });
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  assert.deepEqual(failures, []);
});

await check("普通治理动作对 raw duplicate-key registry fail closed 且不写文件", () => {
  const failures = [];
  for (const [name, body, errorPattern] of duplicateRegistryBodies) {
    const rules = [{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }];
    const { root } = setupTarget(rules);
    try {
      write(root, constitutionPath, `# 宪法设计\n\n${rawRegistryBodyBlock(body)}\n`);
      const before = tracked(root);
      let thrown;
      try {
        governance.executeExperienceAction({
          targetRoot: root,
          skillsRoot: repoRoot,
          action: "record",
          expectedRevision: 1,
          experienceId: "EXP-001",
          event: event("EVT-DUPLICATE-REGISTRY"),
        });
      } catch (error) {
        thrown = error;
      }
      if (!thrown || !errorPattern.test(thrown.message)) failures.push({ name, error: thrown?.message || "missing exception" });
      try {
        assertTracked(root, before);
      } catch (error) {
        failures.push({ name, modified: error.message });
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  assert.deepEqual(failures, []);
});

await check("显式 adoption 在既有 L2/runtime 不匹配 current L1 时失败且不写 anchor", () => {
  const rules = [{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }];
  const { root, registryValue } = setupTarget(rules);
  try {
    const ledger = baseLedger(registryValue);
    delete ledger.l1RegistryAnchor;
    writeLedger(root, ledger);
    write(root, "AGENTS.md", read(root, "AGENTS.md").replace("必须遵守规则。", "已漂移规则。"));
    const before = tracked(root);
    assert.throws(() => governance.executeExperienceAction({
      targetRoot: root,
      skillsRoot: repoRoot,
      action: "adopt-anchor",
      expectedRevision: 1,
    }), /projection|runtime|L2|drift|匹配|derived/iu);
    assertTracked(root, before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

await check("adoption 拒绝除缺 anchor 外还有其他 schema 问题", () => {
  const rules = [{ experienceId: "EXP-001", text: "必须遵守规则。", status: "active" }];
  const { root, registryValue } = setupTarget(rules);
  try {
    const ledger = baseLedger(registryValue, { injected: true });
    delete ledger.l1RegistryAnchor;
    writeLedger(root, ledger);
    const before = tracked(root);
    assert.throws(() => governance.executeExperienceAction({
      targetRoot: root,
      skillsRoot: repoRoot,
      action: "adopt-anchor",
      expectedRevision: 1,
    }), /anchor|adoption|canonical|injected|unknown/iu);
    assertTracked(root, before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
