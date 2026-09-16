#!/usr/bin/env node
// init-doc-governance.mjs —— 把文档命名/归位治理接入一个目标项目（新项目开箱即用）。
//
// 用法：node scripts/init-doc-governance.mjs <目标项目根> [--force]
//
// 行为（只新增/追加，绝不覆盖用户已有规则与钩子正文）：
//   1) 复制 check-doc-governance.mjs（本脚本同目录）及其测试到 <目标>/tools/（已存在则跳过，--force 才覆盖）；
//   2) 生成 <目标>/tools/doc-governance.json 默认配置（已存在则保留不动）；
//   3) 接线 pre-commit：优先 core.hooksPath，其次 .git/hooks/pre-commit；
//      已有钩子且未接线则追加受控代码块，无钩子则新建；
//   4) 打印后续人工步骤（把归位口径写进项目自己的治理文档，豁免清单由项目拍板）。
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const selfDir = dirname(fileURLToPath(import.meta.url));

const targetArg = process.argv[2];
const force = process.argv.includes('--force');
if (!targetArg) {
  console.error('用法：node init-doc-governance.mjs <目标项目根> [--force]');
  process.exit(2);
}
const target = resolve(targetArg);
if (!existsSync(target)) {
  console.error(`✗ 目标项目根不存在：${target}`);
  process.exit(2);
}

const checkerSrc = join(selfDir, 'check-doc-governance.mjs');
const moduleSrc = ['doc-gov-shared.mjs', 'doc-gov-archive.mjs'].map((n) => join(selfDir, n));
const testSrcCandidates = [join(selfDir, 'check-doc-governance.test.mjs'), join(selfDir, '..', 'tests', 'test-check-doc-governance.mjs')];
const testSrc = testSrcCandidates.find((p) => existsSync(p));
if (!existsSync(checkerSrc) || moduleSrc.some((p) => !existsSync(p))) {
  console.error(`✗ 找不到检查器模块（${checkerSrc} 或 doc-gov-*.mjs）`);
  process.exit(2);
}

const toolsDir = join(target, 'tools');
mkdirSync(toolsDir, { recursive: true });

// 1) 复制检查器、共享模块与测试
const checkerDest = join(toolsDir, 'check-doc-governance.mjs');
if (existsSync(checkerDest) && !force) {
  console.log('· 已存在，跳过：tools/check-doc-governance.mjs（--force 覆盖）');
} else {
  copyFileSync(checkerSrc, checkerDest);
  console.log('✓ 已复制：tools/check-doc-governance.mjs');
}
for (const modSrc of moduleSrc) {
  const modDest = join(toolsDir, modSrc.split(/[\\/]/).pop());
  if (existsSync(modDest) && !force) {
    console.log(`· 已存在，跳过：tools/${modDest.split(/[\\/]/).pop()}（--force 覆盖）`);
  } else {
    copyFileSync(modSrc, modDest);
    console.log(`✓ 已复制：tools/${modDest.split(/[\\/]/).pop()}`);
  }
}
if (testSrc) {
  const testDest = join(toolsDir, 'check-doc-governance.test.mjs');
  if (existsSync(testDest) && !force) {
    console.log('· 已存在，跳过：tools/check-doc-governance.test.mjs（--force 覆盖）');
  } else {
    copyFileSync(testSrc, testDest);
    console.log('✓ 已复制：tools/check-doc-governance.test.mjs');
  }
}

// 2) 默认配置
const configPath = join(toolsDir, 'doc-governance.json');
if (existsSync(configPath) && !force) {
  console.log('· 已存在，保留项目配置：tools/doc-governance.json');
} else {
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        docsDir: 'docs',
        archive: { dir: 'docs/归档', facade: 'docs/归档.md' },
        exemptions: { files: [], dirs: [] },
      },
      null,
      2,
    ) + '\n',
  );
  console.log('✓ 已生成默认配置：tools/doc-governance.json（豁免清单按项目实际拍板后手改）');
}

// 3) pre-commit 接线
const probe = spawnSync('git', ['-C', target, 'config', 'core.hooksPath'], { encoding: 'utf8' });
const hooksPathRel = (probe.stdout || '').trim();
let hooksDir;
if (hooksPathRel) hooksDir = resolve(target, hooksPathRel);
else {
  const gitDir = spawnSync('git', ['-C', target, 'rev-parse', '--git-dir'], { cwd: target, encoding: 'utf8' });
  hooksDir = resolve(target, (gitDir.stdout || '.git').trim(), 'hooks');
}
if (!existsSync(hooksDir)) {
  console.log(`· 未找到 Git hooks 目录（${hooksDir}），跳过钩子接线；可稍后手动接线或重跑本命令。`);
} else {
  const hookFile = join(hooksDir, 'pre-commit');
  const block = [
    '',
    '# 文档命名与归位治理（feisheng-vibe-coding init-doc-governance 接线）',
    'if command -v node >/dev/null 2>&1; then',
    '  doc_root="$(git rev-parse --show-toplevel 2>/dev/null)" && \\',
    '    node "$doc_root/tools/check-doc-governance.mjs" --root "$doc_root" || exit 1',
    'else',
    '  echo "警告：未找到 node，跳过文档命名与归位治理检查。" >&2',
    'fi',
    '',
  ].join('\n');
  if (!existsSync(hookFile)) {
    writeFileSync(hookFile, `#!/bin/sh\n${block}`);
    chmodSync(hookFile, 0o755);
    console.log(`✓ 已新建 pre-commit 并接线：${hookFile}`);
  } else if (readFileSync(hookFile, 'utf8').includes('check-doc-governance')) {
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
    '  1. 手改 tools/doc-governance.json 的豁免清单（工具契约名、证据/素材目录等）；',
    '  2. 在项目自己的治理文档登记归位与归档口径（门面+同名文件夹、编号-主题、半自动归档流程）；',
    '  3. 首次运行：node tools/check-doc-governance.mjs --root . 按提示清零 error；',
    '  4. 归档操作：node tools/check-doc-governance.mjs --candidates 查候选，确认后 --archive <路径> --reason <原因>。',
  ].join('\n'),
);
