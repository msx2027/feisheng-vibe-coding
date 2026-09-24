#!/usr/bin/env node
// 密钥泄漏护栏加购 · 目标项目侧扫描器（2026-09-19 批 C，install-hotspot-gate 投放；
//   2026-09-25 由「恒不阻断」升级为「两档分治」，owner 拍板；分档设计自 fs-agent
//   2026-09-21 起的实弹运行回流——零误伤记录，证明 9-18 的顾虑可用分档解决）。
// 执行语义（两档，2026-09-25 起）：
//   高置信命中（AWS key / GitHub token / Slack token / 私钥头；gitleaks 官方引擎的发现全部）
//     → 提交期阻断（退出码 1），且**不**吸收进基线。
//     不吸收是必须的：一旦吸收，第二次提交即被当作存量放行，阻断形同虚设。
//   低置信命中（通用赋值型，误报面大）→ stdout 警告一次并吸收进基线，不阻断（棘轮）。
//   9-18 原决议「不做提交期硬阻断」的顾虑是**误报**而非「不该拦」，故不取消阻断，
//   只把易误报的一类留在警告档；该决议自本版起被分档取代（owner 2026-09-25 拍板）。
//   阻断只在提交期（--staged）生效：安装期首检的用途是把存量吸收进基线，
//   历史密钥无法靠「拒绝这次提交」消除。
// 未验证 ≠ 干净（fail-closed）：列不出暂存区/全仓（git 失败）或扫描器异常时一律阻断，
//   不得静默当作「无发现」放行——原实现的 `|| exit 0` 与恒 0 退出正是该漏洞。
// 基线：<root>/tools/guardrails/secret-baseline.json（自动生成，随项目提交可审查）。
//   棘轮不变量：吸收必先警告；已修条目从基线剔除；修复后再犯 = 新警告（不得无警告回归）。
//   本运行未覆盖到的文件不动其基线条目（--staged 只扫暂存区，不能误剔全仓条目）。
// 扫描器级联（fail-open）：PATH 有 gitleaks → 官方二进制（v8.19+ 命令，
//   挂 tools/guardrails/gitleaks.toml 官方模板）；不可用或报错 → 内置轻量正则兜底（保守 5 类）。
// 用法：node tools/guardrails/secret-scan.mjs <项目根> [--staged]
//   --staged  只扫 git 暂存区将提交的文件（pre-commit 用）；缺省扫全仓（安装期首检基线用）。
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const MAX_FILE_BYTES = 512 * 1024;
const SKIP_PATH = /(?:^|\/)(?:\.git|node_modules|dist|build|vendor|coverage|target|tools\/guardrails)\//i;

// 内置轻量正则兜底（保守初值；误报数据回传 evidence，为「连续 2 次误拦降级」攒预算）。
// 此五类为兜底实现、非上游模板的一部分；上游 gitleaks 可用时以官方规则集为准。
// AWS 键字母表对齐官方 v8.30.1 aws-access-token（[A-Z2-7]，2026-09-19 审计整改）：
// 官方放行的含 0/1/8/9 形态不再兜底告警，省「2 次误拦降级」预算。
const FALLBACK_RULES = [
  { id: 'FALLBACK-AWS-KEY', re: /\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}\b/g },
  { id: 'FALLBACK-GITHUB-TOKEN', re: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g },
  { id: 'FALLBACK-SLACK-TOKEN', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
  { id: 'FALLBACK-PRIVATE-KEY', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g },
  {
    // 通用赋值型：变量名含 key/secret/token/password 且值 ≥20 位、同时含字母与数字；
    // 排除占位形态（全同字符、your*/example*/changeme 等前缀、纯数字、纯符号重复）。
    id: 'FALLBACK-GENERIC-SECRET-ASSIGNMENT',
    re: /\b(?:api[_-]?key|apikey|access[_-]?key|secret|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?token|password|passwd)\b["']?\s*[:=]\s*["']?([A-Za-z0-9+/_\-=]{20,})["']?/gi,
    value: (m) => m[1],
    plausible: (v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v) && !isPlaceholder(v),
  },
];

// 阻断分档（2026-09-25 owner 裁决）：下列规则命中即阻断提交，且不进基线。
// 收紧/放宽只需在本集合增删 id——例如把 FALLBACK-GENERIC-SECRET-ASSIGNMENT 也列入
// 即为「全部命中都拦」；反之移除某条即降回警告档。gitleaks 引擎的发现不受本表约束
// （官方规则集整体计为高置信），见主流程 blocking 判定。
const BLOCKING_RULES = new Set([
  'FALLBACK-AWS-KEY',
  'FALLBACK-GITHUB-TOKEN',
  'FALLBACK-SLACK-TOKEN',
  'FALLBACK-PRIVATE-KEY',
]);

function isPlaceholder(v) {
  if (/^(.)\1{19,}$/.test(v) || /^\d+$/.test(v)) return true;
  if (/^(?:your|my|example|sample|dummy|fake|placeholder|changeme|change-me|redacted|removed|todo|tbd|fixme|insert|replace)/i.test(v)) return true;
  return false;
}

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return r.status === 0 ? String(r.stdout || '') : null;
}

// 返回 null = 「列不出来」（git 命令失败）；与「列出来但是空的」（返回 []）必须区分——
// 前者属于「未验证」，调用方须 fail-closed，不得当作无发现放行。
function listStaged(root) {
  // 含 D（删除）：文件整删视为已修复，其基线条目应被棘轮剔除。
  const out = git(root, ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMRTD']);
  return out === null ? null : [...new Set(out.split('\0').filter(Boolean))];
}

function listAll(root) {
  const out = git(root, ['ls-files', '-co', '-z', '--exclude-standard']);
  return out === null ? null : [...new Set(out.split('\0').filter(Boolean))];
}

function posix(p) {
  return p.replaceAll('\\', '/');
}

function readIfScannable(root, relPath) {
  if (SKIP_PATH.test(posix(relPath))) return null;
  const abs = path.join(root, relPath);
  let st;
  try { st = statSync(abs); } catch { return null; }
  if (!st.isFile() || st.size === 0 || st.size > MAX_FILE_BYTES) return null;
  try {
    const buf = readFileSync(abs);
    if (buf.subarray(0, 8192).includes(0)) return null; // 二进制不扫
    return buf.toString('utf8');
  } catch { return null; }
}

function fallbackScanFiles(root, files) {
  const findings = [];
  for (const relPath of files) {
    const content = readIfScannable(root, relPath);
    if (content === null) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const lineValues = new Set(); // 同一行同一密钥值只报最具体的一条，避免多规则双报
      for (const rule of FALLBACK_RULES) {
        rule.re.lastIndex = 0;
        let m;
        while ((m = rule.re.exec(lines[i])) !== null) {
          const value = rule.value ? rule.value(m) : m[0];
          if (rule.plausible && !rule.plausible(value)) continue;
          if (lineValues.has(value)) continue;
          lineValues.add(value);
          findings.push({ rule: rule.id, file: posix(relPath), line: i + 1, secret: value });
        }
      }
    }
  }
  return findings;
}

function gitleaksAvailable() {
  const r = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  return r.status === 0 && !r.error;
}

// gitleaks 官方级联：命令取自上游 v8.19.0 命令对照（作者 zricethezav 官方 gist）：
//   提交期暂存区 → gitleaks git --pre-commit --staged；全仓 → gitleaks directory <root>。
//   配置挂 tools/guardrails/gitleaks.toml（官方 [extend] useDefault 模板）。
function gitleaksScan(root, staged) {
  const work = mkdtempSync(path.join(tmpdir(), 'secret-scan-'));
  const report = path.join(work, 'report.json');
  try {
    const args = staged
      ? ['git', '--pre-commit', '--staged', '--exit-code', '0', '--config',
        path.join(root, 'tools', 'guardrails', 'gitleaks.toml'),
        '--report-format', 'json', '--report-path', report]
      : ['directory', root, '--exit-code', '0', '--config',
        path.join(root, 'tools', 'guardrails', 'gitleaks.toml'),
        '--report-format', 'json', '--report-path', report];
    const r = spawnSync('gitleaks', args, { cwd: root, encoding: 'utf8' });
    if (r.error || !existsSync(report)) return { ok: false, findings: [] };
    const raw = JSON.parse(readFileSync(report, 'utf8'));
    const findings = (Array.isArray(raw) ? raw : []).filter((f) => f && f.RuleID).map((f) => ({
      rule: f.RuleID, file: posix(f.File || ''), line: f.StartLine || 0, secret: f.Secret || f.Match || '',
    }));
    return { ok: true, findings };
  } catch {
    return { ok: false, findings: [] };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function fingerprint(f) {
  return `${f.rule}|${f.file}|${createHash('sha256').update(f.secret).digest('hex').slice(0, 16)}`;
}

function loadBaseline(baselinePath) {
  try {
    const parsed = JSON.parse(readFileSync(baselinePath, 'utf8'));
    if (parsed && parsed.version === 1 && parsed.entries) return parsed;
  } catch { /* 首检或损坏：按空基线重建 */ }
  return { version: 1, entries: {} };
}

try {
  const root = path.resolve(process.argv[2] ?? '.');
  const staged = process.argv.includes('--staged');
  const grDir = path.join(root, 'tools', 'guardrails');
  mkdirSync(grDir, { recursive: true });
  const baselinePath = path.join(grDir, 'secret-baseline.json');
  const baseline = loadBaseline(baselinePath);

  // 本运行覆盖的文件集合（非「有发现的文件」）——棘轮剔除的判定边界。
  const listed = staged ? listStaged(root) : listAll(root);
  if (listed === null) {
    console.log(`[secret-scan] 无法列出${staged ? '暂存区' : '全仓'}文件（git 命令失败）——`
      + '未验证不等于干净，按 fail-closed 阻断提交。修复 git 环境后重试；'
      + '确需跳过用 git commit --no-verify 并在提交说明注明原因。');
    process.exit(1);
  }
  const files = listed.map(posix).filter((f) => !SKIP_PATH.test(f));
  const scope = new Set(files);

  let findings = [];
  let engine = 'fallback';
  if (gitleaksAvailable()) {
    const r = gitleaksScan(root, staged);
    if (r.ok) { engine = 'gitleaks'; findings = r.findings; }
    else console.log('[secret-scan] gitleaks 可用但扫描未产出报告（fail-open），改用内置正则兜底');
  }
  if (engine === 'fallback') findings = fallbackScanFiles(root, files);

  // 阻断只在提交期（--staged）生效。gitleaks 官方规则集整体计为高置信。
  const isBlockingRule = engine === 'gitleaks' ? () => true : (f) => BLOCKING_RULES.has(f.rule);
  const fresh = findings.filter((f) => !baseline.entries[fingerprint(f)]);
  const blockers = staged ? fresh.filter(isBlockingRule) : [];
  const blockerSet = new Set(blockers);
  const warned = fresh.filter((f) => !blockerSet.has(f));

  for (const f of blockers) {
    console.log(`ERROR [${f.rule}] ${f.file}:${f.line} 疑似高置信密钥/凭据——阻断提交。`
      + '请修掉来源后重新提交（本项不吸收进基线，不存在「再提交一次即放行」）。');
  }
  for (const f of warned) {
    console.log(`WARNING [${f.rule}] ${f.file}:${f.line} 疑似新增密钥/凭据（警告级：已吸收进基线，不阻断提交）`);
    baseline.entries[fingerprint(f)] = {
      rule: f.rule, file: f.file, line: f.line, absorbedAt: new Date().toISOString(),
    };
  }

  // 棘轮只减不增：剔除本运行覆盖文件中已消失的条目（未覆盖文件一律不动）。
  const seen = new Set(findings.map(fingerprint));
  let dropped = 0;
  for (const [key, entry] of Object.entries(baseline.entries)) {
    if (scope.has(entry.file) && !seen.has(key)) { delete baseline.entries[key]; dropped += 1; }
  }

  if (warned.length > 0 || dropped > 0 || !existsSync(baselinePath)) {
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  }
  console.log(`[secret-scan] ${staged ? '暂存区' : '全仓'}扫描（引擎：${engine}）：`
    + `新增疑似 ${warned.length}（已警告并进基线），阻断 ${blockers.length}，修复剔除 ${dropped}，`
    + `基线存量 ${Object.keys(baseline.entries).length}。`
    + (blockers.length ? '退出码 1（高置信命中，阻断提交）。' : '退出码 0（无高置信命中）。'));
  process.exitCode = blockers.length ? 1 : 0;
} catch (error) {
  // 未验证不等于干净：扫描器自身异常同样阻断（原实现此处 fail-open 放行）。
  console.log(`[secret-scan] 扫描器异常，未验证不等于干净，按 fail-closed 阻断提交：${error.message}`);
  process.exitCode = 1;
}
