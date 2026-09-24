// 工区位置门禁单测（移植自 fs-agent 同名测试的关键用例，路径按本仓改写）。
// 运行入口：node --test scripts/guard-worktree-path.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  tokenize,
  extractWorktreeTargets,
  decideWorktreeCommand,
  decideDriveRootMutation,
  DRIVE_ROOT_ALLOWLIST,
} from './guard-worktree-path.mjs';

const REPO = path.dirname(fileURLToPath(import.meta.url)); // scripts/
const ROOT = path.dirname(REPO); // 仓库根
const WT = 'F:\\skiils\\feisheng-vibe-coding-worktrees';

test('tokenize：引号内为一个 token，不保留引号', () => {
  assert.deepEqual(tokenize('git worktree add "F:/a b/c" -b x'), ['git', 'worktree', 'add', 'F:/a b/c', '-b', 'x']);
  assert.deepEqual(tokenize("git worktree add 'F:/x'"), ['git', 'worktree', 'add', 'F:/x']);
});

test('extractWorktreeTargets：add 取第一位置参数，-b 取值旗标不消耗目标', () => {
  assert.deepEqual(
    extractWorktreeTargets(`git worktree add -b feat/x ${WT}\\feat-x`),
    [{ op: 'add', token: `${WT}\\feat-x` }],
  );
  assert.deepEqual(
    extractWorktreeTargets('git worktree move old new'),
    [{ op: 'move', token: 'new' }],
  );
  assert.deepEqual(extractWorktreeTargets('git worktree list'), []);
});

test('decideWorktreeCommand：白名单内放行（含 MSYS 形态）', () => {
  assert.equal(decideWorktreeCommand({ command: `git worktree add ${WT}\\topic`, cwd: ROOT }).allow, true);
  assert.equal(decideWorktreeCommand({ command: 'git worktree add /f/skiils/feisheng-vibe-coding-worktrees/topic', cwd: ROOT }).allow, true);
});

test('decideWorktreeCommand：占根本身 / 白名单外 / 相对路径+cd 拒绝', () => {
  assert.equal(decideWorktreeCommand({ command: `git worktree add ${WT}`, cwd: ROOT }).allow, false);
  const outside = decideWorktreeCommand({ command: 'git worktree add E:/elsewhere/topic', cwd: ROOT });
  assert.equal(outside.allow, false);
  assert.match(outside.reason, /不在白名单目录/);
  const rel = decideWorktreeCommand({ command: 'cd /f && git worktree add topic', cwd: ROOT });
  assert.equal(rel.allow, false);
  assert.match(rel.reason, /相对路径且命令含 cd/);
});

test('decideWorktreeCommand：非 worktree 命令一律放行', () => {
  assert.equal(decideWorktreeCommand({ command: 'git status && git add scripts/x.mjs', cwd: ROOT }).allow, true);
});

test('盘根门禁：白名单一级（skiils/tmp）放行', () => {
  assert.equal(decideDriveRootMutation({ command: 'mkdir F:/tmp/scratch' }).allow, true);
  assert.equal(decideDriveRootMutation({ command: 'mkdir F:/skiils/new-project' }).allow, true);
  assert.deepEqual([...DRIVE_ROOT_ALLOWLIST].sort(), ['skiils', 'tmp']);
});

test('盘根门禁：白名单外一级创建/删除拒绝', () => {
  const a = decideDriveRootMutation({ command: 'mkdir F:/random-stuff' });
  assert.equal(a.allow, false);
  assert.match(a.reason, /盘根一级/);
  assert.equal(decideDriveRootMutation({ command: 'rm -rf C:/Windows/tmp-backup' }).allow, false);
  assert.equal(decideDriveRootMutation({ command: 'pwsh -c "New-Item D:/junk.txt"' }).allow, false);
});

test('盘根门禁：读取类命令与项目内路径放行', () => {
  assert.equal(decideDriveRootMutation({ command: 'cat C:/Windows/win.ini' }).allow, true);
  assert.equal(decideDriveRootMutation({ command: `ls -la ${ROOT}/scripts` }).allow, true);
  assert.equal(decideDriveRootMutation({ command: 'git status' }).allow, true);
});

test('盘根门禁：重定向目标视为写动作', () => {
  const r = decideDriveRootMutation({ command: 'echo hi > D:/junk.txt' });
  assert.equal(r.allow, false);
  assert.equal(decideDriveRootMutation({ command: `echo hi > ${ROOT}/.tmp/out.txt` }).allow, true);
});
