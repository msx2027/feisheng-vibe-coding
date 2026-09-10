#!/usr/bin/env node
// DocMap:
// Layer: L3 / constitution rule registry tests
// Module: tools
// Depends on: tools/constitution-rules.mjs, tools/check-constitution-rules.mjs, tools/init-target-runtime.mjs
// Syncs with: skills/rule-harvester/SKILL.md
//
// 作用（大白话）：给"宪法规则身份证登记表"和它的校验器上保险。
// 登记表以前是裸奔的——没有任何测试盯着它，正文改了规则忘同步登记表也不会有人拦。
// 这些测试锁死四件事：①登记表和真实宪法正文一一对应；②护栏档位全合法；
// ③退役候选池只放 candidate 档（三层护栏第一层）；④双向漂移检测真的抓得到。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getConstitutionBody } from "./init-target-runtime.mjs";
import {
  CONSTITUTION_RULES,
  RULE_TIERS,
  auditRegistryAgainstBody,
  candidateRuleIds,
  extractRuleIdsFromBody,
  ruleById,
} from "./constitution-rules.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checker = path.join(repo, "tools", "check-constitution-rules.mjs");

test("登记表与真实宪法正文一一对应，无漂移", () => {
  const audit = auditRegistryAgainstBody(getConstitutionBody());
  assert.deepEqual(audit.missingInRegistry, [], `正文有、登记表漏登记：${audit.missingInRegistry.join("、")}`);
  assert.deepEqual(audit.missingInBody, [], `登记表有、正文已不存在：${audit.missingInBody.join("、")}`);
  assert.deepEqual(audit.duplicateIds, [], `登记表内 id 重复：${audit.duplicateIds.join("、")}`);
  assert.equal(audit.ok, true);
  assert.equal(audit.bodyCount, audit.registryCount);
});

test("每条登记的护栏档位都是已知合法档位", () => {
  const known = new Set(Object.values(RULE_TIERS));
  const unknown = CONSTITUTION_RULES.filter((rule) => !known.has(rule.tier));
  assert.deepEqual(unknown, [], `出现未定义档位：${unknown.map((r) => `${r.id}:${r.tier}`).join("、")}`);
});

test("登记表每条都有非空 id、group、tier", () => {
  for (const rule of CONSTITUTION_RULES) {
    assert.ok(typeof rule.id === "string" && rule.id.trim() !== "", `规则缺 id：${JSON.stringify(rule)}`);
    assert.ok(typeof rule.group === "string" && rule.group.trim() !== "", `规则 ${rule.id} 缺 group`);
    assert.ok(typeof rule.tier === "string" && rule.tier.trim() !== "", `规则 ${rule.id} 缺 tier`);
  }
});

test("退役候选池只含 candidate 档——protected/background 被护栏挡在池外", () => {
  const pool = new Set(candidateRuleIds());
  assert.ok(pool.size > 0, "候选池不应为空，否则退役流程无对象");
  for (const rule of CONSTITUTION_RULES) {
    if (rule.tier === RULE_TIERS.CANDIDATE) {
      assert.ok(pool.has(rule.id), `candidate 规则 ${rule.id} 应在退役池内`);
    } else {
      assert.ok(!pool.has(rule.id), `${rule.tier} 规则 ${rule.id} 绝不能进退役池`);
    }
  }
});

test("生死线/安全/基础设施类规则必须是 protected，永不退役", () => {
  // 抽查若干条最要命的规则，防止有人误标成 candidate 后被列入退役候选。
  const mustBeProtected = [
    "文件落位",
    "证据纪律",
    "验收纪律",
    "禁止编造",
    "严格 TDD",
    "高风险停止",
    "用户内容保护",
    "受管文档自动同步",
  ];
  for (const id of mustBeProtected) {
    const rule = ruleById(id);
    assert.ok(rule, `缺失关键规则登记：${id}`);
    assert.equal(rule.tier, RULE_TIERS.PROTECTED, `${id} 必须是 protected，不得可退役`);
  }
});

test("extractRuleIdsFromBody 只抓行首 `- 名称：` 形式的规则", () => {
  const body = [
    "## 分组标题",
    "- 甲规则：正文内容",
    "普通说明行，不是规则",
    "- 乙规则：另一段正文",
    "  - 缩进行不算规则：不应命中",
  ].join("\n");
  assert.deepEqual(extractRuleIdsFromBody(body), ["甲规则", "乙规则"]);
});

test("auditRegistryAgainstBody 能抓到登记表有正文没有的漂移", () => {
  // 正文只有甲，登记表（真实的 CONSTITUTION_RULES）里那一堆 id 都不在这段正文里 → 应大量 missingInBody。
  const fakeBody = "- 甲规则：只有这一条";
  const audit = auditRegistryAgainstBody(fakeBody);
  assert.equal(audit.ok, false);
  assert.ok(audit.missingInBody.length > 0, "登记表有、正文没有的规则应被列为 missingInBody");
  assert.ok(audit.missingInRegistry.includes("甲规则"), "正文有、登记表没有的规则应被列为 missingInRegistry");
});

test("命令行校验器对当前真实正文返回 PASS 且退出码 0", () => {
  const result = spawnSync(process.execPath, [checker, "--json"], { cwd: repo, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + "\n" + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.unknownTiers.length, 0);
  assert.equal(report.tiers.protected + report.tiers.background + report.tiers.candidate, report.registryCount);
});
