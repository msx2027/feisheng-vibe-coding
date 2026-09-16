// check-doc-governance.mjs 的行为契约测试。
// 运行：node --test tools/check-doc-governance.test.mjs
// 夹具在系统临时目录构建迷你 docs 树，每个用例独立、互不共享。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runChecks, findArchiveCandidates, archiveFile, DEFAULT_CONFIG } from '../scripts/check-doc-governance.mjs';

let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'doc-gov-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function w(rel, content = '') {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
}

function problems(result, level) {
  return result[level].map((x) => `${x.file}：${x.message}`).join('\n');
}

// ---------- 结构检查 runChecks ----------

test('合规树：零 error 零 warn', () => {
  w('docs/需求文档.md', '# 需求文档\n\n| 卷 | 路径 |\n| --- | --- |\n| 001 | [001-产品概述](需求文档/001-产品概述.md) |\n');
  w('docs/需求文档/001-产品概述.md', '# 产品概述\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.equal(problems(r, 'errors'), '');
  assert.equal(problems(r, 'warns'), '');
});

test('E1 门面 H1 丢失文件名词（改名漏改正文）→ error', () => {
  w('docs/调研档案.md', '# 研究\n| [001-调研](调研档案/001-调研.md) |\n');
  w('docs/调研档案/001-调研.md', '# 调研\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.match(problems(r, 'errors'), /调研档案\.md/);
  assert.match(problems(r, 'errors'), /E1/);
});

test('E1 门面 H1 含文件名词（前缀变体）→ 不报', () => {
  w('docs/调研档案.md', '# 飞升调研档案\n| [001-调研](调研档案/001-调研.md) |\n');
  w('docs/调研档案/001-调研.md', '# 调研\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.equal(problems(r, 'errors'), '');
});

test('E1 治理文档（无文件夹）H1 不匹配 → warn 不阻塞', () => {
  w('docs/口径审计.md', '# 全仓口径一致性审计\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.equal(problems(r, 'errors'), '');
  assert.match(problems(r, 'warns'), /口径审计\.md/);
});

test('W1 分卷 H1 与主题不一致 → warn 不阻塞', () => {
  w('docs/需求文档.md', '# 需求文档\n| [001-工作记录归档](需求文档/001-工作记录归档.md) |\n');
  w('docs/需求文档/001-工作记录归档.md', '# 完全不相干的标题\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.equal(problems(r, 'errors'), '');
  assert.match(problems(r, 'warns'), /001-工作记录归档\.md/);
});

test('E2 docs/ 下的空目录残留 → error', () => {
  w('docs/需求文档.md', '# 需求文档\n');
  mkdirSync(join(root, 'docs/需求文档'), { recursive: true });
  mkdirSync(join(root, 'docs/需求文档/016-需求澄清转轮次'));
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.match(problems(r, 'errors'), /016-需求澄清转轮次/);
  assert.match(problems(r, 'errors'), /空目录/);
});

test('E3 类目目录下散落 md（无同名文件夹、非登记门面）→ error', () => {
  w('docs/执行计划.md-x-placeholder', '');
  rmSync(join(root, 'docs/执行计划.md-x-placeholder'));
  w('docs/执行光标.md', '# 执行光标\n');
  mkdirSync(join(root, 'docs/执行光标'), { recursive: true });
  w('docs/执行光标/001-技术债修复.md', '# 技术债修复\n');
  w('docs/执行计划/重复实现修复实施计划.md', '# 重复实现修复实施计划\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.match(problems(r, 'errors'), /重复实现修复实施计划\.md/);
});

test('E3 豁免文件（工具契约名）与豁免目录不报', () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    exemptions: { ...DEFAULT_CONFIG.exemptions, files: ['docs/technical-selection.md'], dirs: ['项目治理'] },
  };
  w('docs/technical-selection.md', '# 技术选型\n');
  w('docs/项目治理/归位规范.md', '# 归位规范\n');
  const r = runChecks(root, cfg);
  assert.equal(problems(r, 'errors'), '');
});

test('E4 全项目正文重名 → error', () => {
  w('docs/x.md', '# X\n| [001-主题](x/001-主题.md) |\n');
  w('docs/x/001-主题.md', '# 主题\n');
  w('docs/y.md', '# Y\n| [001-主题](y/001-主题.md) |\n');
  w('docs/y/001-主题.md', '# 主题\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.match(problems(r, 'errors'), /001-主题\.md/);
  assert.match(problems(r, 'errors'), /重名/);
});

test('E5 实体卷存在但门面表未登记（022 型漏登）→ error', () => {
  w('docs/调研档案.md', '# 调研档案\n\n| 卷 |\n| --- |\n| 021 | [021-实测](调研档案/021-实测.md) |\n');
  w('docs/调研档案/021-实测.md', '# 实测\n');
  w('docs/调研档案/022-技术债审计.md', '# 技术债审计\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.match(problems(r, 'errors'), /022-技术债审计\.md/);
});

test('E5 门面链接指向不存在的实体 → error', () => {
  w('docs/调研档案.md', '# 调研档案\n\n| [021-实测](调研档案/021-实测.md) |\n');
  w('docs/调研档案/022-技术债审计.md', '# 技术债审计\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.match(problems(r, 'errors'), /021-实测\.md/);
});

test('E6 含正文的文件夹无同名门面（孤儿卷目录）→ error；豁免目录不报', () => {
  w('docs/证据/r14/截图说明.md', '# 截图说明\n');
  w('docs/孤儿子卷/笔记.md', '# 笔记\n');
  const cfg = { ...DEFAULT_CONFIG, exemptions: { ...DEFAULT_CONFIG.exemptions, dirs: ['证据'] } };
  const r = runChecks(root, cfg);
  assert.doesNotMatch(problems(r, 'errors'), /证据/);
  assert.match(problems(r, 'errors'), /孤儿子卷/);
});

test('W2 归档目录内不加编号要求；正文门面目录直属未编号 md → warn', () => {
  w('docs/归档.md', '# 归档\n| [审计报告](归档/审计报告.md) |\n');
  w('docs/归档/审计报告.md', '# 审计报告\n');
  w('docs/设计简报.md', '# 设计简报\n| [画布对照](设计简报/画布对照.md) |\n');
  w('docs/设计简报/画布对照.md', '# 画布对照\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.doesNotMatch(problems(r, 'errors') + problems(r, 'warns'), /审计报告\.md/);
  assert.match(problems(r, 'warns'), /画布对照\.md/);
});

test('子卷文件夹（编号卷同名文件夹）内未编号正文不报编号问题，且须被子卷门面登记', () => {
  w('docs/设计简报.md', '# 设计简报\n| [009-画布清单](设计简报/009-画布清单.md) |\n');
  w('docs/设计简报/009-画布清单.md', '# 画布清单\n| [对照表](009-画布清单/画布导出图对照.md) |\n');
  w('docs/设计简报/009-画布清单/画布导出图对照.md', '# 画布导出图对照\n');
  const r = runChecks(root, DEFAULT_CONFIG);
  assert.equal(problems(r, 'errors'), '');
});

// ---------- 归档候选检测 ----------

test('归档候选：frontmatter 完结信号被识别，doing 不入候选', () => {
  w('docs/执行计划.md', '# 执行计划\n| [a](执行计划/a.md) | [b](执行计划/b.md) |\n');
  w('docs/执行计划/a.md', '---\nstatus: completed\nclosed: 2026-09-16\n---\n\n# A\n');
  w('docs/执行计划/b.md', '---\nstatus: doing\n---\n\n# B\n');
  const c = findArchiveCandidates(root, DEFAULT_CONFIG);
  assert.equal(c.length, 1);
  assert.match(c[0].path, /a\.md$/);
  assert.equal(c[0].status, 'completed');
});

// ---------- 一键归档 archiveFile ----------

function gitInit() {
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: root });
}

test('一键归档：git mv + 门面登记 + 引用改链', () => {
  w('docs/归档.md', '# 归档\n\n| 归档卷 | 原位置 | 归档原因 | 日期 |\n| --- | --- | --- | --- |\n');
  w('docs/执行计划.md', '# 执行计划\n| [旧计划](执行计划/旧计划.md) |\n');
  w('docs/执行计划/旧计划.md', '---\nstatus: completed\nclosed: 2026-09-16\n---\n\n# 旧计划\n');
  w('docs/其他.md', '# 其他\n见 [旧计划](执行计划/旧计划.md)。\n');
  gitInit();

  const out = archiveFile(root, 'docs/执行计划/旧计划.md', { reason: '测试归档', config: DEFAULT_CONFIG });
  assert.equal(out.moved, true);
  assert.ok(existsSync(join(root, 'docs/归档/旧计划.md')));
  assert.ok(!existsSync(join(root, 'docs/执行计划/旧计划.md')));
  assert.match(readFileSync(join(root, 'docs/执行计划.md'), 'utf8'), /\(归档\/旧计划\.md\)/);
  assert.match(readFileSync(join(root, 'docs/其他.md'), 'utf8'), /\(归档\/旧计划\.md\)/);
  const facade = readFileSync(join(root, 'docs/归档.md'), 'utf8');
  assert.match(facade, /旧计划\.md/);
  assert.match(facade, /docs\/执行计划\//);
  assert.match(facade, /测试归档/);
});

test('一键归档：目标有未提交改动 → 拒绝执行', () => {
  w('docs/归档.md', '# 归档\n');
  w('docs/执行计划.md', '# 执行计划\n');
  w('docs/执行计划/在途.md', '# 在途\n');
  gitInit();
  writeFileSync(join(root, 'docs/执行计划/在途.md'), '# 在途\n未提交改动\n');
  assert.throws(
    () => archiveFile(root, 'docs/执行计划/在途.md', { reason: 'x', config: DEFAULT_CONFIG }),
    /未提交|改动/,
  );
});

test('一键归档：目标已在归档目录 → 拒绝', () => {
  w('docs/归档.md', '# 归档\n');
  w('docs/归档/已归档.md', '# 已归档\n');
  gitInit();
  assert.throws(
    () => archiveFile(root, 'docs/归档/已归档.md', { reason: 'x', config: DEFAULT_CONFIG }),
    /归档/,
  );
});
