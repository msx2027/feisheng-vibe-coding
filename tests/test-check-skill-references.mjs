// check-skill-references.mjs 的行为契约测试（棘轮门禁，2026-10-01 接线）。
// 运行：node --test tests/test-check-skill-references.mjs
// 夹具在系统临时目录构建迷你包树（skills/ + tools/ + scripts/ 基线），每个用例独立。
//
// 为什么这批测试必须存在：检查器自己带过一个计数缺陷——把「基线登记过期」并进「未登记新增」一起
// 打印，25 条过期被报成「未登记 25」，读数的人据此会把已收口的正文再改一遍。无测试的门禁
// 会把这类毛病原样下发给每个下游，本包这条棘轮出厂时正是如此。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('../scripts/check-skill-references.mjs', import.meta.url));

let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'skillref-'));
  mkdirSync(join(root, 'skills', 'demo'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function w(rel, content = '') {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
  return rel;
}

function baseline(entries) {
  w(
    'scripts/skill-reference-baseline.json',
    JSON.stringify({ schema: 'vibe-coding-skills-skill-reference-baseline/v1', entries }, null, 2),
  );
}

function run(args = []) {
  const r = spawnSync('node', [checker, '--root', root, ...args], { encoding: 'utf8', cwd: root });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// ---------- R1：包根占位符路径 ----

test('R1 绿：包根占位符指向真实存在的工具', () => {
  w('tools/real-tool.mjs', '// ok\n');
  w('skills/demo/SKILL.md', '运行 `node <skills-root>/tools/real-tool.mjs .` 完成校验。\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /命中 0 处/);
});

test('R1 红：包根占位符指向不存在的工具，诊断给出规则号', () => {
  w('skills/demo/SKILL.md', '运行 `node <skills-root>/tools/ghost.mjs .` 完成校验。\n');
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /死引·R1/);
  assert.match(r.out, /ghost\.mjs/);
});

test('R1 认全部包根写法（skills仓库／本包／包根／skillsRoot）', () => {
  for (const ph of ['<skills仓库>', '<本包>', '<包根>', '<skillsRoot>']) {
    const dir = mkdtempSync(join(tmpdir(), 'skillref-ph-'));
    mkdirSync(join(dir, 'skills', 'demo'), { recursive: true });
    writeFileSync(join(dir, 'skills', 'demo', 'SKILL.md'), `见 \`${ph}/tools/missing.mjs\`。\n`);
    const r = spawnSync('node', [checker, '--root', dir], { encoding: 'utf8', cwd: dir });
    rmSync(dir, { recursive: true, force: true });
    assert.equal(r.status, 1, `${ph} 未判死引：${r.stdout}${r.stderr}`);
    assert.match(`${r.stdout}${r.stderr}`, /死引·R1/, `${ph} 应判 R1`);
  }
});

test('非包根占位符不判：目标项目自有路径归目标项目', () => {
  w('skills/demo/SKILL.md', '在目标项目运行 `node <目标项目根>/tools/its-own.mjs .`。\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /命中 0 处/);
});

// ---------- R2：SKILL.md 依赖块 ----

test('R2 红：依赖块声明 tools/ 下的工具而本包没有', () => {
  w('skills/demo/SKILL.md', ['依赖：', '    - `tools/absent.mjs`', '输出：报告', ''].join('\n'));
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /死引·R2/);
});

test('R2 放行：依赖块路径写错但同名工具存在（只纠路径不判假依赖）', () => {
  w('tools/present.mjs', '// ok\n');
  w('skills/demo/SKILL.md', ['依赖：', '    - `tools/deep/wrong-dir/present.mjs`', '输出：报告', ''].join('\n'));
  const r = run();
  assert.equal(r.code, 0, r.out);
});

test('依赖块之外带目录前缀的脚本名按目标项目 surface 不判', () => {
  w('skills/demo/SKILL.md', '目标项目里跑 `node tools/its-own-gate.mjs . --strict`。\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
});

test('依赖块在字段标签处结束：块外条目不再按 R2 判', () => {
  w('skills/demo/SKILL.md', ['依赖：', '    - `tools/real.mjs`', '输出：报告', '    - `tools/its-own-in-target.mjs`', ''].join('\n'));
  w('tools/real.mjs', '// ok\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
});

// ---------- R3：裸脚本名 ----

test('R3 红：正文教模型运行本包不存在的裸脚本名', () => {
  w('skills/demo/SKILL.md', '保存后运行 `check-target-doc-names.mjs --require-existing`。\n');
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /死引·R3/);
  assert.match(r.out, /check-target-doc-names\.mjs/);
});

test('R3 绿：同名脚本在本包可执行面内', () => {
  w('tools/check-target-doc-names.mjs', '// ok\n');
  w('skills/demo/SKILL.md', '保存后运行 `check-target-doc-names.mjs --require-existing`。\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
});

test('快照里有 ≠ 本包有：sources/** 的同名脚本不计入可执行面', () => {
  w('sources/vibe-coding-skills/tools/snapshot-only.mjs', '// 只读保真快照，永不下发\n');
  w('skills/demo/SKILL.md', '运行 `snapshot-only.mjs` 收口。\n');
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /死引·R3/);
});

test('宿主命令与包管理器永不判死引（含带 .cmd 后缀的真实形态）', () => {
  w('skills/demo/SKILL.md', '用 `node`、`npm`、`git`、`python3`、`bash` 执行；Windows 下跑 `npm.cmd` 与 `pwsh.ps1`。\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
  // `npm.cmd` / `pwsh.ps1` 会被脚本正则真命中，靠豁免集合放行——这条断言保证豁免不是空转。
  assert.match(r.out, /命中 0 处/);
});

// ---------- 棘轮：存量登记／登记过期／计数 ----------

test('已登记的存量：只计数并降级提示，不阻断', () => {
  w('skills/demo/SKILL.md', '运行 `ghost.mjs` 收口。\n');
  baseline([{ rule: 'R3', file: 'skills/demo/SKILL.md', token: 'ghost.mjs', why: '存量待收口' }]);
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /基线存量 1 处/);
  assert.match(r.out, /未登记新增 0 处/);
});

test('登记过期：死引实际不存在时判红，并明写「过期」', () => {
  w('skills/demo/SKILL.md', '正常运行，无死引。\n');
  baseline([{ rule: 'R3', file: 'skills/demo/SKILL.md', token: 'ghost.mjs', why: '已收口，条目忘了删' }]);
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /基线登记已过期/);
});

test('计数分治：未登记新增与登记过期各报各的数，不得混标', () => {
  // 1 处未登记新增（real-ghost.mjs）＋ 1 条登记过期（gone.mjs）。
  w('skills/demo/SKILL.md', '运行 `real-ghost.mjs` 收口。\n');
  baseline([{ rule: 'R3', file: 'skills/demo/SKILL.md', token: 'gone.mjs', why: '已收口，条目忘了删' }]);
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /未登记新增 1 处/);
  assert.match(r.out, /基线存量 0 处/);
  assert.match(r.out, /基线登记过期 1 条须删除/);
  assert.doesNotMatch(r.out, /未登记新增 2/, '过期条目不得被并进未登记新增计数');
});

test('基线缺 entries 数组：点名畸形并非零，不静默恒绿', () => {
  w('skills/demo/SKILL.md', '正常运行。\n');
  w('scripts/skill-reference-baseline.json', JSON.stringify({ schema: 'vibe-coding-skills-skill-reference-baseline/v1' }));
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /基线文件.*(不可读|畸形)/);
});

test('基线 JSON 语法坏：非零且不是裸堆栈', () => {
  w('skills/demo/SKILL.md', '正常运行。\n');
  w('scripts/skill-reference-baseline.json', '{ 这不是合法 JSON');
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.doesNotMatch(r.out, /at JSON\.parse|SyntaxError/, '应给成品诊断行而非裸堆栈');
  assert.match(r.out, /基线文件.*(不可读|畸形)/);
});

test('--print-baseline：把当前命中打成基线条目并 exit 0', () => {
  w('skills/demo/SKILL.md', '运行 `ghost.mjs` 收口。\n');
  const r = run(['--print-baseline']);
  assert.equal(r.code, 0, r.out);
  const doc = JSON.parse(r.out.slice(r.out.indexOf('{')));
  assert.equal(doc.entries.length, 1);
  assert.equal(doc.entries[0].rule, 'R3');
  assert.equal(doc.entries[0].token, 'ghost.mjs');
});

// ---------- 覆盖边界（如实钉住「不判」的形态，防止误以为已全覆盖）----

test('.md 目标：不声明本包路径的相对写法仍不判，声明了才判（R4 扩面的边界）', () => {
  // 前半：`references/not-there.md` 首段既不是 `skills` 也不是技能基名 → 按目标项目地面放行。
  w('skills/demo/SKILL.md', '细则见 `references/not-there.md`。\n');
  let r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /命中 0 处/);
  // 后半：同一个 `.md` 写成 `skills/...` 或 `<技能名>/references/...` 就是对本包的承诺，必须判。
  w('skills/product/demo-skill/SKILL.md', '// 占位，制造两级技能结构\n');
  w('skills/demo/SKILL.md', '细则见 `skills/product/demo-skill/references/ghost.md`。\n');
  r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /死引·R4/);
});

test('.cjs 已纳入脚本面：裸 .cjs 脚本名指向不存在的工具即判（2026-10-01 前是盲区）', () => {
  // 用**裸名**夹具：扩展名面单独钉，避免与「前缀放行」那条混在一起。
  w('skills/demo/SKILL.md', '运行 `generate-tokens.cjs` 生成令牌。\n');
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /死引·R3/);
  assert.match(r.out, /generate-tokens\.cjs/);
});

test('R4 绿：带分类目录的包内路径按字面存在', () => {
  w('skills/ui/brand/scripts/extract-colors.cjs', '// 真身\n');
  w('skills/demo/SKILL.md', '运行 `node skills/ui/brand/scripts/extract-colors.cjs --palette`。\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
});

test('R4 红：扁平旧路径（缺分类目录）判死引，并把唯一解写进诊断', () => {
  w('skills/ui/brand/scripts/extract-colors.cjs', '// 真身\n');
  w('skills/demo/SKILL.md', '运行 `node skills/brand/scripts/extract-colors.cjs --palette`。\n');
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /死引·R4/);
  assert.match(r.out, /本包唯一解是 `skills\/ui\/brand\/scripts\/extract-colors\.cjs`/);
});

test('R4 红（目录形态）：正文把「目录在哪儿」写成扁平旧路径同样判死引', () => {
  // 2026-10-01 实测漏口：同一条扁平路径写成 `skills/x/scripts/y.cjs` 会判，写成 `skills/x/data/`
  // 不判——R4 当时要求 token 带扩展名，于是两处目录声明（`ui-ux-pro-max/data/`、`ui-styling/canvas-fonts`）
  // 在「本批复跑残留 0」的读数下静默活着。目录声明同样是可执行性指令，必须进同一扇门。
  mkdirSync(join(root, 'skills', 'ui', 'brand', 'data'), { recursive: true });
  w('skills/demo/SKILL.md', '数据文件位于 `skills/brand/data/`，默认不全文读取。\n');
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /死引·R4/);
  assert.match(r.out, /本包唯一解是 `skills\/ui\/brand\/data`/);
});

test('R4 绿（目录形态）：带分类目录且盘上真实存在的目录声明不判', () => {
  mkdirSync(join(root, 'skills', 'ui', 'brand', 'data'), { recursive: true });
  w('skills/demo/SKILL.md', '数据文件位于 `skills/ui/brand/data/`，搜索 `skills/ui/brand/data` 目录。\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /命中 0 处/);
});

test('目录形态不误吞目标项目与外链：子串 `skills/…` 不是本包声明', () => {
  // 三条都是本批复算时真出现过的伪影：运行时目录前缀、快照路径、GitHub 外链里的 `…/skills/tree/…`。
  w('skills/demo/SKILL.md', [
    '目标项目调用 `.vibe-coding-skills/vibe-hooks/recorder.mjs` 与运行时目录 `.vibe-coding-skills/vibe-hooks/`。',
    '来源为快照 `sources/vibe-coding-skills/tools/`。',
    '外链见 https://github.com/anthropics/skills/tree/main/skills/frontend-design 。',
    '',
  ].join('\n'));
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /命中 0 处/);
});

test('R5 红：裸技能名 + 已知子路径是省略了 skills/<分类>/ 的本包承诺', () => {
  w('skills/product/demo-skill/references/audit-rules.md', '// 真身\n');
  w('skills/demo/SKILL.md', '细则见 `demo-skill/references/audit-rules.md` 与 `demo-skill/SKILL.md`。\n');
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /死引·R5/);
});

test('R5 不吞目标项目产物：裸技能名后跟未知子路径按地面外放行，并计入可见计数', () => {
  w('skills/ui/design-system/SKILL.md', '// 让 design-system 成为已知技能基名\n');
  w('skills/demo/SKILL.md', '用 `--persist` 写入 `design-system/MASTER.md`。\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /地面外路径 [1-9]\d* 处不计/);
});

test('R1 与 R4 不重复报：包根占位符的内层路径只由 R1 负责', () => {
  w('skills/demo/SKILL.md', '运行 `node <skills-root>/skills/ghost/x.md`。\n');
  const r = run();
  assert.equal(r.code, 1, r.out);
  const rules = (r.out.match(/死引·R\d/g) ?? []);
  assert.equal(rules.length, 1, r.out);
  assert.match(r.out, /死引·R1/);
});

test('中文段路径属目标项目命名面：整行不判（排除中文这条边界要能被复算）', () => {
  w('skills/demo/SKILL.md', '真源见 `docs/项目治理/开发计划.md`，Phase 明细见 `docs/plans/第一阶段.md`。\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /命中 0 处/);
});

test('带普通目录前缀的路径一律放行：非 `skills/` 前缀仍按目标项目地面处理', () => {
  w('skills/demo/SKILL.md', '运行 `node tools/its-own-gate.mjs . --all` 与 `bash ./tools/legacy.sh`。\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
});

test('子代理 scratch 目录（.qoder）不进扫描面也不进可执行面：读数不得随本机有没有临时副本变化', () => {
  w('skills/demo/SKILL.md', '本包正文没有死引。\n');
  // 副本里带一处死引 + 一个同名脚本 + 一个名为 .git 的 worktree 指针文件
  w('.qoder/worktrees/x/skills/demo/SKILL.md', '运行 `ghost-in-copy.mjs`。\n');
  w('.qoder/worktrees/x/tools/real-in-copy.mjs', '// x\n');
  w('.qoder/worktrees/x/.git', 'gitdir: /somewhere\n');
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /扫描 1 个文件/, `scratch 里的副本不该计入扫描面：${r.out}`);
  assert.doesNotMatch(r.out, /ghost-in-copy/, 'scratch 副本正文不该被判死引');
  // 默认扫描面是 `skills`，副本在 `.qoder/…/skills/` 下、本来就够不着；只有把扫描面放到仓库根，
  // 才真能验出「跳过 .qoder」挡住了什么——所以这一条必须两种 scope 都跑。
  const dot = run(['--scope', '.']);
  assert.equal(dot.code, 0, `扫描面扩到仓库根时，scratch 副本正文不得被当本包正文判：${dot.out}`);
  // 拆掉副本后再跑同一条命令：两个读数必须逐字相同，否则门禁读数会随「本机此刻有没有子代理在跑」变化。
  const withCopy = r.out.match(/扫描 (\d+) 个文件，可执行面基名 (\d+) 个/).slice(1);
  rmSync(join(root, '.qoder'), { recursive: true, force: true });
  assert.deepEqual(
    run().out.match(/扫描 (\d+) 个文件，可执行面基名 (\d+) 个/).slice(1),
    withCopy,
    '有副本与无副本的扫描数／可执行面基数必须一致',
  );
});

test('--scope 可换扫描面：只查指定文件', () => {
  w('skills/demo/SKILL.md', '运行 `ghost.mjs`。\n');
  w('skills/demo/other.md', '运行 `other-ghost.mjs`。\n');
  const r = run(['--scope', 'skills/demo/other.md']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /skills\/demo\/other\.md:1 死引·R3/);
  assert.doesNotMatch(r.out, /SKILL\.md:1 死引/, '未列入扫描面的文件不应报');
});

test('无基线文件：按空基线跑，命中即未登记新增', () => {
  w('skills/demo/SKILL.md', '运行 `ghost.mjs`。\n');
  const r = run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /未登记新增 1 处/);
});
