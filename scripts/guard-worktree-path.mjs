// 工区位置门禁硬拦截（工厂仓自装版，2026-09-25 owner 拍板「都执行」；移植自 fs-agent
// tools/guard-worktree-path.mjs 的实弹验证实现，路径与白名单按本仓改写）：
// 作为 PreToolUse hook 挂在本机两处（均 matcher: Bash）——Claude 宿主挂 .claude/settings.json，
// ZCode 宿主挂 .zcode/config.json 的 hooks.events.PreToolUse（实测：ZCode 不读 .claude/settings.json，
// 只登记一处 = 对另一宿主完全不生效）。本机接线不入库（.gitignore），换机按 evidence 重挂手册重挂。
// 规则一：本项目会话里的 `git worktree add / move` 目标只允许建在
//   F:\skiils\feisheng-vibe-coding-worktrees 下（worktree 集中一处，不再散落失联）。
// 规则二：对任意盘根一级的创建/改动/删除做白名单校验——只放行 skiils（项目区）、tmp（会话临时区）。
// 判定原则：识别出越界目标 → exit 2 + stderr 指明规则（fail-closed）；
// stdin 解析失败 / 非 Bash 工具 / 识别不了的写形态 → exit 0 静默放行（fail-open，不瘫痪会话）。
// 与 2026-09-20 防漂移拍板的关系：被否决的是「文件写入面路径白名单」（误拦合法 TDD 流）；
// 本守卫拦的是命令目标（worktree 越界/盘根乱建），fs-agent 实弹运行无 TDD 误拦记录。
// 覆盖边界：仅约束经过本机 hook 的运行时（Claude / ZCode）；Codex（无 pre-tool 事件）
// 靠规则 + `git worktree list --porcelain` 核查口径兜底。
// 白名单可用环境变量 FVC_WORKTREE_ROOT / FVC_DRIVE_ROOT_ALLOWLIST 覆盖（测试与异机调试用）。
//
// 运行入口：node --test scripts/guard-worktree-path.test.mjs
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const WHITELIST_ROOT = 'F:\\skiils\\feisheng-vibe-coding-worktrees';

/** 近似 bash 的分词：引号内为一个 token（闭合后继续并入，不保留引号），空白分隔。 */
export function tokenize(command) {
  const tokens = [];
  let cur = '';
  let quote = null;
  for (const ch of String(command)) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (cur) tokens.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

/** add 取第一个位置参数为目标路径；move 取第二个（第一个是旧路径）。 */
export function extractWorktreeTargets(command) {
  const tokens = tokenize(command);
  const targets = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] !== 'worktree') continue;
    const sub = tokens[i + 1];
    if (sub !== 'add' && sub !== 'move') continue;
    const skip = sub === 'move' ? 1 : 0;
    let j = i + 2;
    let pos = 0;
    let found = null;
    while (j < tokens.length) {
      const t = tokens[j];
      if (t.startsWith('-')) {
        // add 的取值旗标连写形态（-bfsa/x、--reason=x）不消耗下一个 token
        if (sub === 'add' && (t === '-b' || t === '-B' || t === '--reason')) j++;
      } else if (pos === skip) {
        found = t;
        break;
      } else {
        pos++;
      }
      j++;
    }
    if (found) targets.push({ op: sub, token: found });
  }
  return targets;
}

/** 统一成小写绝对 Windows 路径；先把 MSYS 形态 /f/foo 映射成 F:\foo，避免 resolve 到当前盘的 \f\foo。 */
function toLowerAbsolute(token, cwd) {
  let p = String(token);
  const msys = /^\/([a-zA-Z])(\/.*|$)$/.exec(p);
  if (msys) p = `${msys[1].toUpperCase()}:${msys[2]}`;
  return path.win32.resolve(cwd || process.cwd(), p).toLowerCase();
}

export function decideWorktreeCommand({ command, cwd, whitelistRoot = WHITELIST_ROOT }) {
  const targets = extractWorktreeTargets(command);
  if (targets.length === 0) return { allow: true };
  const rootN = path.win32.resolve(whitelistRoot).toLowerCase();
  const hasCd = tokenize(command).includes('cd');
  for (const { op, token } of targets) {
    const looksAbsolute = /^[a-zA-Z]:[\\/]/.test(token) || token.startsWith('/');
    if (!looksAbsolute && hasCd) {
      return {
        allow: false,
        reason: `git worktree ${op} 的目标 ${token} 是相对路径且命令含 cd，无法可靠解析；请改用 ${whitelistRoot}\\<主题> 形式的绝对路径`,
      };
    }
    const abs = toLowerAbsolute(token, cwd);
    if (abs === rootN) {
      return { allow: false, reason: `git worktree ${op} 不能占用白名单根目录本身，请使用 ${whitelistRoot}\\<主题> 子目录` };
    }
    if (!abs.startsWith(rootN + '\\')) {
      return {
        allow: false,
        reason: `git worktree ${op} 的目标 ${token}（解析为 ${abs}）不在白名单目录 ${whitelistRoot} 下`,
      };
    }
  }
  return { allow: true };
}

// —— 盘根乱建门禁（fs-agent 归位规范第十三节同款；AI 工具硬编码 /tmp 在 Windows
//   会落到「当前盘根」，曾在三个盘根各长出一个 tmp）——
// AI 命令在任意盘根一级创建/改动/删除白名单外条目 → 拦截；读取类命令与白名单内路径放行。
// 动词识别：段首精确匹配，或 PowerShell/cmd 等包裹器内层按词边界匹配；`>`/`>>` 重定向目标本身视为写动作。
// 局限（有意 fail-open）：shell 别名、脚本间接写、fd 重定向（2>）目标不在识别范围内，与 worktree 规则同哲学。

export const DRIVE_ROOT_ALLOWLIST = ['skiils', 'tmp'];

const MUTATION_VERBS = new Set([
  'mkdir', 'md', 'rmdir', 'rd', 'rm', 'del', 'erase', 'mv', 'move', 'cp', 'copy',
  'touch', 'tee', 'ln', 'mklink', 'unlink', 'dd',
  'new-item', 'ni', 'remove-item', 'ri', 'set-content', 'add-content',
  'out-file', 'copy-item', 'cpi', 'move-item', 'mi', 'robocopy', 'xcopy',
]);
const WRAPPERS = new Set(['sudo', 'powershell', 'powershell.exe', 'pwsh', 'cmd', 'cmd.exe']);
const VERB_INNER_RE =
  /\b(?:mkdir|md|rmdir|rd|rm|del|erase|mv|move|cp|copy|touch|tee|ln|mklink|unlink|new-item|remove-item|set-content|add-content|out-file|copy-item|move-item|robocopy|xcopy)\b/i;
const MSYS_DRIVE_RE = /^\/([a-zA-Z])(\/.*)?$/;
const WIN_DRIVE_RE = /^([a-zA-Z]):[\\/](.*)$/;
const ABS_PATH_RAW_RE = /[a-zA-Z]:[\\/][^\s"';|&()]*|\/[a-zA-Z](?:\/[^\s"';|&()]*)?/g;
const REDIRECT_RE = /(?<![0-9])>>?\s*(?:"([^"]+)"|'([^']+)'|([^\s;&|()]+))/g;

/** 取绝对路径 token 在盘根下的一级条目名（小写）；盘根本身返回 ''；非盘路径返回 null。 */
function driveRootSegment(token) {
  const p = String(token);
  if (p === '/dev/null') return null;
  let rest = null;
  let m = MSYS_DRIVE_RE.exec(p);
  if (m) rest = m[2] || '';
  else {
    m = WIN_DRIVE_RE.exec(p);
    if (m) rest = m[2];
  }
  if (rest === null) return null;
  // MSYS 形态的捕获组自带前导斜杠（/skiils/...），先剥掉再取一级，否则 split 首元素是空串
  const trimmed = rest.replace(/^[\\/]+/, '');
  if (trimmed === '') return '';
  return trimmed.split(/[\\/]/)[0].toLowerCase() || '';
}

function extractRedirectTargets(command) {
  const targets = [];
  const re = new RegExp(REDIRECT_RE.source, 'g');
  let m;
  while ((m = re.exec(String(command))) !== null) targets.push(m[1] || m[2] || m[3]);
  return targets;
}

/** 判定命令是否在盘根一级做白名单外的创建/改动/删除。 */
export function decideDriveRootMutation({ command, allowlist = DRIVE_ROOT_ALLOWLIST }) {
  const allow = new Set(allowlist.map((s) => s.toLowerCase()));
  const offending = new Set();
  const note = (token) => {
    const seg1 = driveRootSegment(token);
    if (seg1 !== null && !allow.has(seg1)) offending.add(token);
  };
  let mutating = false;
  for (const seg of String(command).split(/(?:\|\||&&|[;|\n()]|\{|\})/)) {
    const tokens = tokenize(seg);
    if (tokens.length === 0) continue;
    const head = tokens[0].toLowerCase();
    if (MUTATION_VERBS.has(head)) {
      mutating = true;
    } else if (WRAPPERS.has(head)) {
      // 包裹器：内层命令按词边界找动词，并对整段原文扫描绝对路径（引号内层路径不在独立 token 里）
      if (tokens.some((t, idx) => idx > 0 && VERB_INNER_RE.test(t))) mutating = true;
      for (const m of seg.matchAll(ABS_PATH_RAW_RE)) note(m[0]);
    }
    for (const t of tokens) note(t);
  }
  for (const t of extractRedirectTargets(command)) {
    note(t);
    mutating = true; // 重定向本身就是写
  }
  if (!mutating || offending.size === 0) return { allow: true };
  const first = [...offending][0];
  return {
    allow: false,
    reason: `命令要在盘根一级改动白名单外条目 ${first}；盘根防乱建只放行一级条目：${[...allow].join(', ')}（工厂仓工区守卫，证据见 evidence/20260925-gate-hardening.md）`,
  };
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  if (String(payload?.tool_name || '').toLowerCase() !== 'bash') process.exit(0);
  const command = payload?.tool_input?.command;
  if (typeof command !== 'string' || !command) process.exit(0);
  const cwd = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const root = process.env.FVC_WORKTREE_ROOT || WHITELIST_ROOT;
  const envAllowlist = (process.env.FVC_DRIVE_ROOT_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const worktree = decideWorktreeCommand({ command, cwd, whitelistRoot: root });
  const r = worktree.allow ? decideDriveRootMutation({ command, allowlist: envAllowlist.length ? envAllowlist : undefined }) : worktree;
  if (!r.allow) {
    process.stderr.write(
      `[工区位置门禁] ${r.reason}\n` +
        `工厂仓规则：worktree 只允许建在 ${root}\\<主题> 下（分支用 fvc/<主题>），` +
        `任何盘根一级禁止创建/改动白名单外条目（会话临时文件统一走项目 .tmp/）。请改用白名单内的路径重试。\n`,
    );
    process.exit(2);
  }
  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();
