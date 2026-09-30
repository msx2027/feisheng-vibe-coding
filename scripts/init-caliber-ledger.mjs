#!/usr/bin/env node
// init-caliber-ledger.mjs —— 把口径账本接入一个目标项目（新项目开箱即用）。
//
// 用法：node scripts/init-caliber-ledger.mjs <目标项目根> [--force]
//
// 行为（只新增/追加，绝不覆盖项目已有的账本、规则与钩子正文）：
//   1) 复制 check-caliber-ledger.mjs（本脚本同目录）到 <目标>/tools/（已存在则跳过，--force 才覆盖）；
//   2) 由 caliber-ledger.example.json 生成 <目标>/tools/caliber-ledger.json 空账本
//      （含 conventions 入账规矩；已存在则保留不动——账本内容是项目的，不是本包的）；
//   3) 接线 pre-commit 跑 --staged：优先 core.hooksPath，其次 .git/hooks/pre-commit；
//      已有钩子且未接线则追加受控代码块，无钩子则新建；
//   4) 打印后续人工步骤（首批入账哪些口径由项目拍板）。
//
// 本包不发测试副本进目标项目：账本内容的对错是项目的事，执行器本身的契约测试留在本包 verify 里跑。
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const selfDir = dirname(fileURLToPath(import.meta.url));

const targetArg = process.argv[2];
const force = process.argv.includes('--force');
if (!targetArg) {
  console.error('用法：node init-caliber-ledger.mjs <目标项目根> [--force]');
  process.exit(2);
}
const target = resolve(targetArg);
if (!existsSync(target)) {
  console.error(`✗ 目标项目根不存在：${target}`);
  process.exit(2);
}

const checkerSrc = join(selfDir, 'check-caliber-ledger.mjs');
const exampleSrc = join(selfDir, 'caliber-ledger.example.json');
if (!existsSync(checkerSrc) || !existsSync(exampleSrc)) {
  console.error(`✗ 找不到执行器或空账本模板（${checkerSrc} / ${exampleSrc}）`);
  process.exit(2);
}

const toolsDir = join(target, 'tools');
mkdirSync(toolsDir, { recursive: true });

// 1) 复制执行器
const checkerDest = join(toolsDir, 'check-caliber-ledger.mjs');
if (existsSync(checkerDest) && !force) {
  console.log('· 已存在，跳过：tools/check-caliber-ledger.mjs（--force 覆盖）');
} else {
  copyFileSync(checkerSrc, checkerDest);
  console.log('✓ 已复制：tools/check-caliber-ledger.mjs');
}

// 2) 空账本（内容归项目所有，绝不用 --force 覆盖已有条目）
const ledgerDest = join(toolsDir, 'caliber-ledger.json');
if (existsSync(ledgerDest)) {
  console.log('· 已存在，保留项目账本：tools/caliber-ledger.json（本脚本不覆盖已入账条目）');
} else {
  writeFileSync(ledgerDest, readFileSync(exampleSrc, 'utf8'));
  console.log('✓ 已生成空账本：tools/caliber-ledger.json（conventions 即入账规矩原文，条目按项目实际拍板后追加）');
}

// 3) pre-commit 接线
const probe = spawnSync('git', ['-C', target, 'config', 'core.hooksPath'], { encoding: 'utf8' });
const hooksPathRel = (probe.stdout || '').trim();
let hooksDir;
if (hooksPathRel) hooksDir = resolve(target, hooksPathRel);
else {
  const gitDir = spawnSync('git', ['-C', target, 'rev-parse', '--git-dir'], { cwd: target, encoding: 'utf8' });
  if ((gitDir.stdout || '').trim()) hooksDir = resolve(target, gitDir.stdout.trim(), 'hooks');
}
if (!hooksDir || !existsSync(hooksDir)) {
  console.log(`· 未找到 Git hooks 目录（${hooksDir ?? '未知'}），跳过钩子接线；可稍后手动接线或重跑本命令。`);
} else {
  const hookFile = join(hooksDir, 'pre-commit');
  // fail-closed：找不到 node 一律阻断提交——「未验证」不等于「干净」。
  const block = [
    '',
    '# 口径账本断言（vibe-coding-skills init-caliber-ledger 接线）',
    'if ! command -v node >/dev/null 2>&1; then',
    '  echo "错误：未找到 node（Node.js），口径账本门禁无法运行，已阻断本次提交。" >&2',
    '  echo "例外：确需跳过门禁时用 git commit --no-verify，并在提交说明中注明原因。" >&2',
    '  exit 1',
    'fi',
    'caliber_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {',
    '  echo "错误：无法确定仓库根目录，口径账本门禁已阻断本次提交。" >&2',
    '  exit 1',
    '}',
    'node "$caliber_root/tools/check-caliber-ledger.mjs" --root "$caliber_root" --staged || exit 1',
    '',
  ].join('\n');
  if (!existsSync(hookFile)) {
    writeFileSync(hookFile, `#!/bin/sh\n${block}`);
    chmodSync(hookFile, 0o755);
    console.log(`✓ 已新建 pre-commit 并接线：${hookFile}`);
  } else if (readFileSync(hookFile, 'utf8').includes('check-caliber-ledger')) {
    console.log('· pre-commit 已接线，跳过。');
  } else {
    let hookText = readFileSync(hookFile, 'utf8');
    if (!hookText.endsWith('\n')) hookText += '\n';
    writeFileSync(hookFile, hookText + block);
    console.log(`✓ 已在既有 pre-commit 末尾追加接线块：${hookFile}`);
  }
}

// 4) 后续人工步骤
console.log(
  [
    '',
    '后续人工步骤（项目自行拍板）：',
    '  1. 首批入账：把「这次已经改过、以后还会被再写出来」的口径写进 tools/caliber-ledger.json 的 entries',
    '     （每条必有 truth.anchorRegex；判据见同文件 conventions，那是入账规矩的唯一真源）；',
    '  2. 首次全貌：node tools/check-caliber-ledger.mjs --root . --report（只汇总不阻断，看清有几处红）；',
    '  3. 清零后再靠提交门禁：node tools/check-caliber-ledger.mjs --root .（断言红即非零）；',
    '  4. 产物目录若不止默认那几类，改账本顶层 skipDirs。',
  ].join('\n'),
);
