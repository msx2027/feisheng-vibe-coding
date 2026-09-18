#!/usr/bin/env node
// 结构棘轮门禁自动装配器（2026-09-17，owner 预授权：入口技能启动动作调用）。
// 用途：对目标项目一次性装齐 check-hotspots 门禁——拷模块、按项目布局扩扫描根、
// 接 pre-commit 棘轮、跑首检基线。宿主加载 feisheng-vibe-coding 后由启动动作执行，
// 用户无需逐次开口；重复调用幂等（已装齐 = 零改动退出）。
//
// 密钥泄漏护栏加购（2026-09-19 批 C，guardrail-addon.mjs）：默认随装配一同装上——
// gitleaks/Semgrep 官方模板投放（templates/，零自研）+ 密钥首检基线棘轮 +
// pre-commit 警告级接线（不阻断提交）。降级矩阵与卸载语义见 guardrail-addon.mjs 文件头。
//
// 安全边界（fail-safe）：
//   - 已存在但与本 bundle 不一致的模块一律跳过不覆盖（本地适配神圣，如 fs-agent 的 SCAN_ROOTS）；
//   - pre-commit 只追加带标记的自包含段，不动既有内容；
//   - 拒绝装回本分发包自身；
//   - 首检基线允许存量超标（棘轮语义：只减不增），装配成功 ≠ 零热点；
//   - 密钥护栏永远警告级（退出码恒 0），不做提交期硬阻断（9-18 否决项：误拦致 hook 被禁）。
// 用法：node install-hotspot-gate.mjs <目标项目根> [--guardrails-only] [--uninstall]
//   --guardrails-only  只装密钥护栏加购，不动 hotspot 主门禁（非 Node 栈等场景）
//   --uninstall        只卸载密钥护栏加购写入段（hotspot 主门禁与用户自有 hook 不动）
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { provisionGuardrails, uninstallGuardrails } from './guardrail-addon.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const MODULES = [
  'check-hotspots.mjs', 'hotspot-scan.mjs', 'hotspot-policy.mjs', 'hotspot-git.mjs',
  'hotspot-files.mjs', 'hotspot-findings.mjs', 'hotspot-function-scan.mjs',
  'hotspot-function-shared.mjs', 'hotspot-rust-function-scan.mjs',
  'trusted-git.mjs', 'safe-target-fs.mjs',
];
const CODE_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|rs)$/i;
const SKIP_TOP = new Set(['node_modules', 'target', 'dist', 'build', 'vendor', 'coverage']);
// 明确不入人工源码门禁的顶层目录（调研/夹具/样例/产物等）。
const GENERIC_SKIP = new Set(['docs', 'doc', 'experiments', 'experiment', 'fixtures', 'fixture', 'examples',
  'example', 'samples', 'sample', 'benchmarks', 'benchmark', 'tmp', 'temp', 'scratch', 'drafts',
  'assets', 'static', 'public', 'contracts', 'migrations', 'scripts', ...SKIP_TOP]);
// 保守候选：目录名是约定源码名，或内容带 src/lib/app 子目录 / 包清单文件。
const SRC_MARKERS = ['src', 'lib', 'app', 'tests', 'test'];
const SRC_DIR_NAME = /^(src|app|apps|lib|libs|packages|components|pages|server|client|frontend|backend|worker|workers|services?|api|ui|web|mobile|tests?|tools)$/;
const PKG_MARKERS = ['package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml'];
const WIRE_MARKER = 'hotspot-gate-wired';

const say = (msg) => console.log(`[install-hotspot-gate] ${msg}`);

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout || '').trim() : null;
}

function hasCodeFile(dir, depth, budget) {
  if (depth > 3 || budget.value <= 0 || !existsSync(dir)) return false;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return false; }
  for (const e of entries) {
    if (budget.value <= 0) return false;
    budget.value -= 1;
    const p = path.join(dir, e.name);
    if (e.isFile()) { if (CODE_EXT.test(e.name)) return true; continue; }
    if (e.isDirectory() && e.name !== 'node_modules' && hasCodeFile(p, depth + 1, budget)) return true;
  }
  return false;
}

function inspectTopDirs(target) {
  const candidates = [];
  const uncovered = [];
  for (const e of readdirSync(target, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.') || GENERIC_SKIP.has(e.name)) continue;
    const dir = path.join(target, e.name);
    const budget = { value: 400 };
    if (!hasCodeFile(dir, 0, budget)) continue;
    const hasSrcMarker = SRC_MARKERS.some((m) => existsSync(path.join(dir, m)));
    const hasPkg = PKG_MARKERS.some((m) => existsSync(path.join(dir, m)));
    if (SRC_DIR_NAME.test(e.name) || hasSrcMarker || hasPkg) candidates.push(e.name);
    else uncovered.push(e.name);
  }
  return { candidates: candidates.sort(), uncovered: uncovered.sort() };
}

function mergeScanRoots(policyFile, candidates) {
  const text = readFileSync(policyFile, 'utf8');
  const block = text.match(/export const SCAN_ROOTS = Object\.freeze\(\[([\s\S]*?)\]\);/);
  if (!block) return { changed: false, added: [] };
  const existing = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const additions = candidates.filter((name) => !existing.includes(name));
  if (additions.length === 0) return { changed: false, added: [] };
  const items = [...existing, ...additions].map((n) => `  "${n}",`).join('\n');
  writeFileSync(policyFile, text.replace(block[0], `export const SCAN_ROOTS = Object.freeze([\n${items}\n]);`));
  return { changed: true, added: additions };
}

function hookWired(hookFile) {
  // 已含标记段或任何形式的 check-hotspots 调用都算已接线（兼容手工接线，避免重复追加）。
  if (!existsSync(hookFile)) return false;
  const text = readFileSync(hookFile, 'utf8');
  return text.includes(WIRE_MARKER) || text.includes('check-hotspots.mjs');
}

const WIRE_BLOCK = `# --- 结构热区棘轮（install-hotspot-gate 接线，标记：${WIRE_MARKER}）---
hsroot="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 1
if command -v node >/dev/null 2>&1; then
  node "$hsroot/tools/check-hotspots.mjs" "$hsroot" --strict --staged || exit 1
fi
`;

function wirePreCommit(target) {
  let hooksDir = git(target, ['config', '--get', 'core.hooksPath']);
  if (!hooksDir) {
    hooksDir = 'tools/githooks';
    git(target, ['config', 'core.hooksPath', hooksDir]) ?? say(`已设置 core.hooksPath=${hooksDir}`);
  }
  const hookFile = path.join(target, hooksDir, 'pre-commit');
  if (hookWired(hookFile)) return { wired: false, file: hookFile };
  const header = existsSync(hookFile) ? '' : '#!/bin/sh\n';
  mkdirSync(path.dirname(hookFile), { recursive: true });
  writeFileSync(hookFile, (existsSync(hookFile) ? readFileSync(hookFile, 'utf8') : header) + WIRE_BLOCK);
  return { wired: true, file: hookFile };
}

function inventory(target) {
  const rows = [];
  rows.push(['AGENTS.md 运行时承诺', existsSync(path.join(target, 'AGENTS.md')), '']);
  rows.push(['.vibe-runtime.json（AGENTS/CLAUDE 块）', existsSync(path.join(target, '.vibe-runtime.json')), '']);
  rows.push(['vibe-hooks 纠错信号（.feisheng）', existsSync(path.join(target, '.feisheng', 'vibe-hooks', 'install-manifest.json')),
    '可用分发包 scripts/install-vibe-hooks.ps1 安装']);
  return rows;
}

function installHotspotGate(target) {
  const targetTools = path.join(target, 'tools');
  mkdirSync(targetTools, { recursive: true });
  let copied = 0, skippedLocal = 0, identical = 0;
  for (const name of MODULES) {
    const src = path.join(TOOL_DIR, name), dst = path.join(targetTools, name);
    if (!existsSync(dst)) { writeFileSync(dst, readFileSync(src)); copied += 1; continue; }
    if (readFileSync(dst, 'utf8') === readFileSync(src, 'utf8')) { identical += 1; continue; }
    skippedLocal += 1; say(`跳过覆盖（本地适配）：tools/${name}`);
  }
  say(`模块：新装 ${copied}，一致 ${identical}，本地适配保留 ${skippedLocal}`);

  const layout = inspectTopDirs(target);
  const roots = mergeScanRoots(path.join(targetTools, 'hotspot-policy.mjs'), layout.candidates);
  say(roots.changed ? `扫描根扩展：+${roots.added.join(', ')}` : '扫描根：已覆盖，无需扩展');
  if (layout.uncovered.length > 0) {
    say(`警告：以下目录含代码但非约定源码布局，未自动纳入扫描（如需纳入请手动加 SCAN_ROOTS）：${layout.uncovered.join(', ')}`);
  }

  const hook = wirePreCommit(target);
  say(hook.wired ? `pre-commit 棘轮已接线：${path.relative(target, hook.file)}` : 'pre-commit：已接线，跳过');

  say('—— 首检基线（存量超标只减不增，不阻断装配）——');
  const scan = spawnSync(process.execPath, [path.join(targetTools, 'check-hotspots.mjs'), target], { stdio: 'inherit' });
  if (scan.status === 2) throw new Error('首检无法完成：扫描器对部分代码不可读（fail-closed），请人工排查');
}

try {
  const target = path.resolve(process.argv[2] ?? '.');
  const flags = new Set(process.argv.slice(3));
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new Error(`目标不存在或非目录：${target}`);
  if (existsSync(path.join(target, 'skills', 'product', 'hotspot-governor', 'tools'))) {
    throw new Error('拒绝装回分发包自身：请指向目标项目根');
  }
  if (flags.has('--uninstall')) {
    uninstallGuardrails({ target, say });
    say('卸载完成。');
  } else {
    if (git(target, ['rev-parse', '--show-toplevel']) === null) throw new Error('目标不是 git 仓库（棘轮依赖 git 基线）');
    say(`目标：${target}`);
    if (flags.has('--guardrails-only')) {
      provisionGuardrails({ target, say, toolDir: TOOL_DIR });
      say('装配完成（仅护栏加购；hotspot 主门禁未装，需要时去掉 --guardrails-only 重跑）。');
    } else {
      installHotspotGate(target);
      provisionGuardrails({ target, say, toolDir: TOOL_DIR });
      say('—— 运行件盘点（超出本装配器职责的只报告）——');
      for (const [name, ok, hint] of inventory(target)) say(`${ok ? '✓' : '○'} ${name}${ok || !hint ? '' : `（缺失；${hint}）`}`);
      say('装配完成。');
    }
  }
} catch (error) {
  say(`装配失败：${error.message}`);
  process.exitCode = 1;
}
