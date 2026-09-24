#!/usr/bin/env node
// 提交关卡清单自检（fs-agent tools/githooks/pre-commit.test.mjs 同款模式的最小实现）。
// 解析 scripts/githooks/pre-commit 的「检查清单」声明块，断言：
//   ① 清单非空（空清单 = 提交关卡形同虚设）；
//   ② 每条声明引用的脚本文件真实存在（改名/挪位后清单不漂成假红）；
//   ③ 必需检查在列（密钥泄漏护栏）；
//   ④ 清单行与 run_check 定义均无 `|| true` / `|| exit 0` 类放行后缀（fail-closed 不变量）。
// 由两处消费：scripts/githooks/pre-commit 清单第 2 项（提交期）与
// verify.ps1 步骤「提交关卡清单自检」（总验期）。
// 用法：node scripts/githooks/pre-commit.test.mjs <repoRoot>
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const hookRel = ['scripts', 'githooks', 'pre-commit'];
const hookPath = path.join(root, ...hookRel);

let text;
try {
  text = readFileSync(hookPath, 'utf8');
} catch (error) {
  console.error(`[pre-commit.test] 读不到提交关卡文件 ${hookPath}：${error.message}`);
  process.exit(1);
}

const failures = [];
const block = text.split('---- 检查清单')[1] ?? '';
const declared = block.split('\n').filter((line) => line.trim().startsWith('run_check '));

if (declared.length === 0) {
  failures.push('检查清单声明块为空或丢失——提交关卡形同虚设');
}

const scriptTokens = [];
for (const line of declared) {
  const m = /^run_check\s+"([^"]+)"\s+node\s+(\S+)/.exec(line.trim());
  if (!m) {
    failures.push(`清单行不是预期的「run_check "<标签>" node <脚本>」格式：${line.trim()}`);
    continue;
  }
  const [, label, token] = m;
  scriptTokens.push(token);
  const scriptPath = token.replaceAll('$root', root).replaceAll('"', '');
  if (!existsSync(scriptPath)) {
    failures.push(`清单项「${label}」引用的脚本不存在：${token}`);
  }
  if (/\|\|\s*(true|exit 0)/.test(line)) {
    failures.push(`清单项「${label}」带放行后缀（|| true / || exit 0）——违反 fail-closed`);
  }
}

if (!scriptTokens.some((token) => token.includes('secret-scan.mjs'))) {
  failures.push('必需检查缺失：密钥泄漏护栏（secret-scan.mjs）不在清单中');
}

if (!/run_check\(\)\s*\{/.test(text)) {
  failures.push('run_check 函数定义丢失——清单行不会被真正执行');
} else {
  const fn = text.slice(text.indexOf('run_check()'), text.indexOf('---- 检查清单'));
  if (/\|\|\s*(true|exit 0)/.test(fn)) failures.push('run_check 定义含放行后缀——违反 fail-closed');
  if (!/exit 1/.test(fn)) failures.push('run_check 失败分支不阻断（缺 exit 1）');
}

if (failures.length > 0) {
  console.error('[pre-commit.test] 提交关卡清单自检未通过：');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`[pre-commit.test] 清单自检通过：${declared.length} 项声明全部可实现且 fail-closed。`);
