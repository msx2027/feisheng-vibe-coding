#!/usr/bin/env node
// DocMap:
// Layer: L3 / constitution rule registry validator
// Module: tools
// Depends on: tools/init-target-runtime.mjs (getConstitutionBody), tools/constitution-rules.mjs
// Syncs with: skills/rule-harvester/SKILL.md
//
// 作用（大白话）：把"规则登记表"和"真实宪法正文"对一遍账，锁死两者不许对不上。
// 只要有人在 init-target-runtime.mjs 里加了/删了/改名了一条宪法规则，却忘了同步登记表，
// 这个检查就 FAIL、非零退出，能挂进测试/CI 当守门员。
// 它只报告、不修改任何文件（遵守 rule-harvester 的半自动铁律）。
//
// 用法：
//   node tools/check-constitution-rules.mjs [--json]

import process from "node:process";
import { getConstitutionBody } from "./init-target-runtime.mjs";
import { CONSTITUTION_RULES, RULE_TIERS, auditRegistryAgainstBody } from "./constitution-rules.mjs";

function tierBreakdown() {
  const counts = { protected: 0, background: 0, candidate: 0 };
  for (const rule of CONSTITUTION_RULES) {
    if (counts[rule.tier] === undefined) counts[rule.tier] = 0;
    counts[rule.tier] += 1;
  }
  return counts;
}

function main() {
  const json = process.argv.includes("--json");
  const body = getConstitutionBody();
  const audit = auditRegistryAgainstBody(body);
  const tiers = tierBreakdown();

  // 额外守卫：登记表里的 tier 必须都是已知档位
  const unknownTiers = CONSTITUTION_RULES.filter(
    (rule) => !Object.values(RULE_TIERS).includes(rule.tier),
  ).map((rule) => `${rule.id}:${rule.tier}`);

  const ok = audit.ok && unknownTiers.length === 0;

  if (json) {
    console.log(JSON.stringify({ ok, ...audit, tiers, unknownTiers }, null, 2));
  } else {
    console.log(`宪法规则登记表校验：正文 ${audit.bodyCount} 条 / 登记表 ${audit.registryCount} 条`);
    console.log(`护栏分档：protected ${tiers.protected} / background ${tiers.background} / candidate ${tiers.candidate}`);
    if (audit.missingInRegistry.length > 0) {
      console.log(`[缺登记] 正文有、登记表没登记（新增规则忘了登记）：${audit.missingInRegistry.join("、")}`);
    }
    if (audit.missingInBody.length > 0) {
      console.log(`[缺正文] 登记表有、正文已不存在（规则被删/改名，表没同步）：${audit.missingInBody.join("、")}`);
    }
    if (audit.duplicateIds.length > 0) {
      console.log(`[重复] 登记表内 id 重复：${audit.duplicateIds.join("、")}`);
    }
    if (unknownTiers.length > 0) {
      console.log(`[未知档位] 出现未定义的护栏档位：${unknownTiers.join("、")}`);
    }
    console.log(`结果：${ok ? "PASS" : "FAIL"}`);
  }

  process.exitCode = ok ? 0 : 1;
}

main();
