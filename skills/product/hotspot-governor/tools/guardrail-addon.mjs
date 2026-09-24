// 密钥泄漏护栏加购 · 安装器侧供给/卸载模块（2026-09-19 批 C）。
// 由 install-hotspot-gate.mjs import 调用：同一入口、同一 owner、幂等标记段内追加，
// 不新增第二个安装器。上游模板在 ./templates/（零自研，来源与锁定值见模板文件头）。
//
// 降级矩阵（tasks/20260919-v2-hardening-implementation.md 批 C「C2 降级矩阵」）：
//   非 git 仓库       → 沿 hotspot 先例拒绝安装（主入口已挡，本模块不重复）；
//   git 仓库无远端    → 本地 pre-commit 层足够；CI 模板仍写入但不激活（semgrep-ci.yml.disabled）；
//   非 Node 栈        → 裸 .git/hooks 受控标记段接线，不走 Husky（本模块永不设置 core.hooksPath；
//                       若项目已有 core.hooksPath——hotspot 的 tools/githooks、Husky 或用户自设——
//                       则写入实际生效的钩子文件，绝不写入 git 不会执行的死钩子文件）；
//   已装 hotspot 门禁 → 合并装配路径下 core.hooksPath 已由主门禁指到 tools/githooks，
//                       加购追加到同一钩子文件的同一标记段风格内；重跑幂等零改动跳过。
//
// 卸载（--uninstall）：只移除本加购写入段（钩子标记段 / tools/guardrails/ 内本加购点名文件 /
//   本加购激活的 CI 工作流）；目录内有用户自有文件时保留目录不整删（本地适配神圣）。
//   不动 hotspot 主门禁（模块、棘轮段、core.hooksPath 配置）与用户自有 hook/CI。
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const HOOK_MARKER = 'guardrail-secret-wired';
const CI_MARKER = 'guardrail-semgrep-ci';
const RUNNER_FILES = ['secret-scan.mjs'];
// 常驻投放：执行器 + gitleaks 官方模板。semgrep-ci.yml 只落一处：激活态在
// .github/workflows/semgrep.yml，未激活态在 tools/guardrails/semgrep-ci.yml.disabled。
const TEMPLATE_FILES = ['gitleaks.toml'];
// tools/guardrails/ 内本加购可能写入的全部文件（点名卸载用，不整删目录）：执行器、官方模板、
// 未激活 CI 副本、首检基线。
const GUARDRAIL_DIR_FILES = [...RUNNER_FILES, ...TEMPLATE_FILES, 'semgrep-ci.yml.disabled', 'secret-baseline.json'];

const HOOK_SEGMENT = `# --- 密钥泄漏护栏加购（install-hotspot-gate 接线，标记：${HOOK_MARKER}）---
grroot="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
if command -v node >/dev/null 2>&1; then
  node "$grroot/tools/guardrails/secret-scan.mjs" "$grroot" --staged || {
    echo "错误：密钥泄漏护栏阻断本次提交（高置信命中，或无法完成验证）。" \\
         "修复来源后重新提交；确需跳过用 git commit --no-verify，并在提交说明注明原因。" >&2
    exit 1
  }
fi
`;

function git(target, args) {
  const r = spawnSync('git', args, { cwd: target, encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout || '').trim() : null;
}

function activeHookFile(target) {
  // 实际生效的钩子文件优先：core.hooksPath 已设（hotspot 主门禁 / Husky / 用户自设）→ 用它；
  // 未设 → 裸 .git/hooks/pre-commit（降级矩阵「非 Node 栈」行；不走 Husky、不动 hooksPath）。
  const hooksPath = git(target, ['config', '--get', 'core.hooksPath']);
  return hooksPath
    ? path.join(target, hooksPath, 'pre-commit')
    : path.join(target, '.git', 'hooks', 'pre-commit');
}

function hookWired(hookFile) {
  return existsSync(hookFile) && readFileSync(hookFile, 'utf8').includes(HOOK_MARKER);
}

function wireHook(target) {
  const hookFile = activeHookFile(target);
  if (hookWired(hookFile)) return { wired: false, file: hookFile };
  const fresh = !existsSync(hookFile);
  mkdirSync(path.dirname(hookFile), { recursive: true });
  const base = fresh ? '#!/bin/sh\n' : readFileSync(hookFile, 'utf8');
  writeFileSync(hookFile, base + HOOK_SEGMENT);
  if (fresh && process.platform !== 'win32') chmodSync(hookFile, 0o755);
  return { wired: true, file: hookFile };
}

function stripSegment(hookFile, say) {
  if (!existsSync(hookFile)) return false;
  const lines = readFileSync(hookFile, 'utf8').split('\n');
  const start = lines.findIndex((line) => line.includes(HOOK_MARKER));
  if (start === -1) return false;
  let end = start;
  while (end < lines.length && lines[end].trim() !== 'fi') end += 1;
  const kept = [...lines.slice(0, start), ...lines.slice(end + 1)].join('\n').replace(/^\n+/, '');
  writeFileSync(hookFile, kept.startsWith('#!/bin/sh') || kept === '' ? kept : `${kept}\n`);
  say(`已摘除钩子标记段：${hookFile}`);
  return true;
}

function provisionFiles(target, toolDir, say) {
  const grDir = path.join(target, 'tools', 'guardrails');
  mkdirSync(grDir, { recursive: true });
  let copied = 0, identical = 0, kept = 0;
  const sources = [
    ...RUNNER_FILES.map((name) => [path.join(toolDir, name), path.join(grDir, name), name]),
    ...TEMPLATE_FILES.map((name) => [path.join(toolDir, 'templates', name), path.join(grDir, name), name]),
  ];
  for (const [src, dst, name] of sources) {
    if (!existsSync(dst)) { writeFileSync(dst, readFileSync(src)); copied += 1; continue; }
    if (readFileSync(dst, 'utf8') === readFileSync(src, 'utf8')) { identical += 1; continue; }
    kept += 1; say(`跳过覆盖（本地适配）：tools/guardrails/${name}`);
  }
  say(`护栏加购文件：新装 ${copied}，一致 ${identical}，本地适配保留 ${kept}`);
  return grDir;
}

function githubRemote(target) {
  const names = (git(target, ['remote']) || '').split('\n').map((s) => s.trim()).filter(Boolean);
  for (const name of names) {
    const url = git(target, ['config', '--get', `remote.${name}.url`]) || '';
    if (/github\.com/i.test(url)) return url;
  }
  return null;
}

function provisionCi(target, grDir, toolDir, say) {
  const template = readFileSync(path.join(toolDir, 'templates', 'semgrep-ci.yml'), 'utf8');
  const active = path.join(target, '.github', 'workflows', 'semgrep.yml');
  const disabled = path.join(grDir, 'semgrep-ci.yml.disabled');
  if (githubRemote(target)) {
    if (existsSync(active)) {
      say(readFileSync(active, 'utf8').includes(CI_MARKER)
        ? 'Semgrep CI：已激活，跳过'
        : 'Semgrep CI：检测到用户自有 .github/workflows/semgrep.yml，跳过不覆盖');
    } else {
      mkdirSync(path.dirname(active), { recursive: true });
      writeFileSync(active, template);
      say('Semgrep CI：检测到 GitHub 远端，已激活 .github/workflows/semgrep.yml');
    }
    if (existsSync(disabled)) { rmSync(disabled); say('已清理旧的不激活 CI 模板副本'); }
  } else {
    // 降级矩阵「无远端」行：本地 pre-commit 层足够；CI 模板仍写入但不激活。
    if (!existsSync(disabled)) {
      writeFileSync(disabled, template);
      say('Semgrep CI：无 GitHub 远端，模板写入但不激活（tools/guardrails/semgrep-ci.yml.disabled）；'
        + '加 GitHub 远端后重跑本安装器即激活');
    } else {
      say('Semgrep CI：模板已写入（未激活态），跳过');
    }
  }
}

function firstBaseline(target, grDir, say) {
  const baseline = path.join(grDir, 'secret-baseline.json');
  if (existsSync(baseline)) {
    try {
      const parsed = JSON.parse(readFileSync(baseline, 'utf8'));
      say(`首检基线：已存在（存量 ${Object.keys(parsed.entries || {}).length} 条，只减不增），跳过`);
    } catch { say('首检基线：已存在（无法解析，保留原样），跳过'); }
    return;
  }
  say('—— 密钥首检基线（存量违规吸收进基线；阻断只在提交期生效，安装期不拦历史存量）——');
  const scan = spawnSync(process.execPath, [path.join(grDir, 'secret-scan.mjs'), target], { stdio: 'inherit' });
  if (scan.status !== 0) say(`警告：首检基线脚本异常退出（${scan.status}），已按 fail-open 处理，不阻断装配`);
}

export function provisionGuardrails({ target, say, toolDir }) {
  say('—— 密钥泄漏护栏加购（gitleaks/Semgrep 官方模板 + 基线棘轮 + 两档分治）——');
  const grDir = provisionFiles(target, toolDir, say);
  const hook = wireHook(target);
  say(hook.wired
    ? `密钥护栏已接线（两档：高置信命中阻断提交，低置信警告进基线）：${path.relative(target, hook.file)}`
    : `密钥护栏：已接线，跳过（${path.relative(target, hook.file)}）`);
  provisionCi(target, grDir, toolDir, say);
  firstBaseline(target, grDir, say);
}

export function uninstallGuardrails({ target, say }) {
  say('—— 密钥泄漏护栏加购卸载（只移除本加购写入段）——');
  const hooksPath = git(target, ['config', '--get', 'core.hooksPath']);
  const candidates = [
    hooksPath ? path.join(target, hooksPath, 'pre-commit') : null,
    path.join(target, '.git', 'hooks', 'pre-commit'),
  ].filter(Boolean);
  let stripped = false;
  for (const file of [...new Set(candidates)]) {
    if (stripSegment(file, say)) stripped = true;
  }
  if (!stripped) say('钩子标记段：未发现，跳过');
  const grDir = path.join(target, 'tools', 'guardrails');
  if (existsSync(grDir)) {
    // 按加购清单点名删除（本地适配过的同名文件也随之移除——卸载即移除整个加购能力），
    // 用户自有的其他文件一律保留；目录因此变空才整体移除。
    let removed = 0;
    for (const name of GUARDRAIL_DIR_FILES) {
      const filePath = path.join(grDir, name);
      if (existsSync(filePath)) { rmSync(filePath); removed += 1; }
    }
    const rest = readdirSync(grDir);
    if (rest.length === 0) {
      rmSync(grDir, { recursive: true, force: true });
      say(`已移除加购目录：${path.relative(target, grDir)}（模板 + 扫描器 + 首检基线，点名删除 ${removed} 个文件）`);
    } else {
      say(`加购文件已点名移除（${removed} 个）；目录内有非本加购文件，保留目录与这些文件：${rest.join('、')}`);
    }
  } else {
    say('加购目录：不存在，跳过');
  }
  const active = path.join(target, '.github', 'workflows', 'semgrep.yml');
  if (existsSync(active) && readFileSync(active, 'utf8').includes(CI_MARKER)) {
    rmSync(active);
    say('已移除本加购激活的 CI 工作流：.github/workflows/semgrep.yml');
  } else {
    say('激活态 CI 工作流：未由本加购写入，跳过（用户自有 CI 不动）');
  }
  say('未动：hotspot 主门禁（模块/棘轮段/core.hooksPath）与用户自有 hook、用户自有 CI。');
}
