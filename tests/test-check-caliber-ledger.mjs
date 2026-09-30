// check-caliber-ledger.mjs 的行为契约测试（执行器是命令行工具，故用子进程实测退出码与诊断）。
// 运行：node --test tests/test-check-caliber-ledger.mjs
// 夹具在系统临时目录构建迷你树，每个用例独立、互不共享。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('../scripts/check-caliber-ledger.mjs', import.meta.url));

let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'caliber-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function w(rel, content = '') {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
}

function ledger(obj) {
  w('tools/caliber-ledger.json', JSON.stringify({ schemaVersion: 1, conventions: [], entries: [] , ...obj }, null, 2));
  return 'tools/caliber-ledger.json';
}

function run(extraArgs = [], opts = {}) {
  const r = spawnSync('node', [checker, '--root', root, ...(opts.args ?? extraArgs)], {
    encoding: 'utf8',
    cwd: opts.cwd ?? root,
  });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// ---------- 空账本与账本损坏 ----------

test('零条目账本：未登记任何口径，放行', () => {
  ledger({ entries: [] });
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /零条目/);
});

test('账本 JSON 损坏：非零阻断，且给出修复动作', () => {
  w('tools/caliber-ledger.json', '{ 这不是合法 JSON');
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /不可读/);
  assert.match(r.out, /修复/);
});

test('entries 不是数组：判畸形非零（不许当成空账本放行）', () => {
  w('tools/caliber-ledger.json', JSON.stringify({ schemaVersion: 1, entries: {} }));
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /畸形/);
});

test('条目缺 id：判畸形非零', () => {
  ledger({ entries: [{ title: '无 id 条目' }] });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /缺 id/);
});

test('正则不可编译：非零并点名位置（不许静默跳过该断言）', () => {
  w('docs/说明.md', '正文\n');
  ledger({
    entries: [
      { id: 'CAL-X', truth: { path: 'docs/说明.md', anchorRegex: '(未闭合' } },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /不可编译/);
  assert.match(r.out, /CAL-X\.truth\.anchorRegex/);
});

// ---------- 锚点自检：缺锚必须判哑洞，不能退化成恒绿 ----------

test('truth.anchorRegex 缺失 → 判畸形，绝不退化成恒绿哑灯', () => {
  w('docs/说明.md', '正文里没有那个词\n');
  w('docs/镜像.md', '正文');
  ledger({
    entries: [
      {
        id: 'CAL-NOANCHOR',
        truth: { path: 'docs/说明.md' },
        mirrors: [{ path: 'docs/镜像.md', require: ['绝不存在的关键串'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /缺锚＝恒绿哑洞/);
});

test('真源锚点失效（措辞已变）→ 非零并提示人工核对不许静默改钉', () => {
  w('docs/说明.md', '已改成另一种说法\n');
  ledger({
    entries: [{ id: 'CAL-ANCHOR', truth: { path: 'docs/说明.md', anchorRegex: '旧说法' }, scans: [{ name: '面', include: ['docs/**'], forbid: ['永不出现的词'] }] }],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /真源锚点失效/);
  assert.match(r.out, /哑灯/);
});

test('真源文件不存在 → 非零（挪位／改名必须响）', () => {
  w('docs/别的.md', 'x\n');
  ledger({
    entries: [{ id: 'CAL-MISS', truth: { path: 'docs/已被移走.md', anchorRegex: '词' }, scans: [{ name: '面', include: ['docs/**'], forbid: ['永不出现的词'] }] }],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /真源文件不存在/);
});

// ---------- 镜像同步：只钉存在不钉数目 ----------

test('镜像失步（缺 require 关键串）→ 非零并带条目规则', () => {
  w('docs/真源.md', '现行口径：首年半价\n');
  w('docs/镜像.md', '这里还写着别的\n');
  ledger({
    entries: [
      {
        id: 'CAL-MIRROR',
        rule: '一律写「首年半价」',
        truth: { path: 'docs/真源.md', anchorRegex: '首年半价' },
        mirrors: [{ path: 'docs/镜像.md', require: ['首年半价'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /镜像失步/);
  assert.match(r.out, /一律写「首年半价」/);
});

test('镜像有 require 串即绿——同一串出现多份不因数目增长判红（只钉存在不钉数目）', () => {
  w('docs/真源.md', '首年半价\n');
  w('docs/镜像.md', '首年半价…再提一次首年半价…又提首年半价\n');
  ledger({
    entries: [
      {
        id: 'CAL-COUNT',
        truth: { path: 'docs/真源.md', anchorRegex: '首年半价' },
        mirrors: [{ path: 'docs/镜像.md', require: ['首年半价'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /全绿/);
});

test('镜像禁出命中 → 非零', () => {
  w('docs/真源.md', '现行\n');
  w('docs/镜像.md', '这里漏出了退役词\n');
  ledger({
    entries: [
      {
        id: 'CAL-MFORBID',
        truth: { path: 'docs/真源.md', anchorRegex: '现行' },
        mirrors: [{ path: 'docs/镜像.md', forbid: ['退役词'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /镜像禁出命中/);
});

// ---------- 扫描面禁出 ----------

test('扫描面禁出命中 → 非零并给到文件与行号', () => {
  w('docs/真源.md', '首年半价\n');
  w('docs/需求/001.md', '第一行\n第二行写着首月半价\n');
  ledger({
    entries: [
      {
        id: 'CAL-SCAN',
        rule: '首月半价已退役',
        truth: { path: 'docs/真源.md', anchorRegex: '首年半价' },
        scans: [{ name: '用户可见面', include: ['docs/需求/**'], forbid: ['首月半价'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /禁出词命中 docs\/需求\/001\.md:2/);
});

test('exclude 豁免生效 → 历史材料不判红（豁免通道可用，不必删史）', () => {
  w('docs/真源.md', '首年半价\n');
  w('docs/需求/001.md', '首月半价\n');
  ledger({
    entries: [
      {
        id: 'CAL-EXCL',
        truth: { path: 'docs/真源.md', anchorRegex: '首年半价' },
        scans: [
          {
            name: '用户可见面',
            include: ['docs/需求/**'],
            exclude: ['docs/需求/001.md'],
            forbid: ['首月半价'],
          },
        ],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 0, r.out);
});

test('include 用精确文件路径（无通配）时禁出仍要命中——防 seed 用点号造成静默全绿', () => {
  w('docs/真源.md', '首年半价\n');
  w('docs/需求/002.md', '这里写着首月半价\n');
  ledger({
    entries: [
      {
        id: 'CAL-EXACT',
        rule: '首月半价已退役',
        truth: { path: 'docs/真源.md', anchorRegex: '首年半价' },
        scans: [{ name: '单文件面', include: ['docs/需求/002.md'], forbid: ['首月半价'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1, '精确路径未命中＝seed 拼出 ./ 前缀的回归，禁出哑灯');
  assert.match(r.out, /禁出词命中 docs\/需求\/002\.md/);
});

test('CRLF 行尾下无锚禁出串必须命中（行尾锚会对 \\r 失配，故规矩要求用无锚子串）', () => {
  w('docs/真源.md', '首年半价\r\n');
  w('docs/需求/003.md', '第二行写着首月半价\r\n');
  ledger({
    entries: [
      {
        id: 'CAL-CRLF',
        truth: { path: 'docs/真源.md', anchorRegex: '首年半价' },
        scans: [{ name: '面', include: ['docs/需求/**'], forbid: ['首月半价'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /禁出词命中 docs\/需求\/003\.md/);
});

// ---------- skipDirs ----------

test('账本自身不算扫描面：禁出词原文写在账本里不该自己判红', () => {
  w('docs/真源.md', '首年半价\n');
  ledger({
    entries: [
      {
        id: 'CAL-SELF',
        rule: '首月半价已退役，一律写首年半价',
        truth: { path: 'docs/真源.md', anchorRegex: '首年半价' },
        scans: [{ name: '全仓', include: ['**'], forbid: ['首月半价'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 0, '扫到 tools/caliber-ledger.json 自身＝登记语义被误伤');
  assert.doesNotMatch(r.out, /caliber-ledger\.json/);
});

test('默认跳过 node_modules：产物里的禁出不算用户可见面', () => {
  w('docs/真源.md', '首年半价\n');
  w('node_modules/pkg/index.md', '首月半价\n');
  ledger({
    entries: [
      {
        id: 'CAL-SKIP',
        truth: { path: 'docs/真源.md', anchorRegex: '首年半价' },
        scans: [{ name: '全仓', include: ['**'], forbid: ['首月半价'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 0, r.out);
});

test('账本可自配 skipDirs 覆盖默认值', () => {
  w('docs/真源.md', '首年半价\n');
  w('vendor/lib.md', '首月半价\n');
  w('node_modules/pkg/index.md', '首月半价\n');
  ledger({
    skipDirs: ['vendor'],
    entries: [
      {
        id: 'CAL-SKIPCFG',
        truth: { path: 'docs/真源.md', anchorRegex: '首年半价' },
        scans: [{ name: '全仓', include: ['**'], forbid: ['首月半价'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /node_modules\/pkg\/index\.md/);
  assert.doesNotMatch(r.out, /vendor\/lib\.md/);
});

test('skipDirs 写成非数组 → 判畸形（配置意图不许无声落空）', () => {
  w('tools/caliber-ledger.json', JSON.stringify({ schemaVersion: 1, skipDirs: 'dist', entries: [{ id: 'CAL-1' }] }));
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /skipDirs 必须是字符串数组/);
});

// 判定顺序钉：账本根校验 → 零条目放行 → skipDirs → 条目预编译。执行器拆成「判定核＋CLI」时最容易被
// 顺手把两步合成一次校验（看着更整洁），合回去就让「还没登记口径」的项目连带坏 skipDirs 一起变红，
// 把新接线的第一步挡在门外——与既有「零条目放行」语义相反。此钉保证合回去会红。
test('零条目先于 skipDirs 校验：空账本＋坏 skipDirs 仍放行（顺序不许合并）', () => {
  w('tools/caliber-ledger.json', JSON.stringify({ schemaVersion: 1, skipDirs: 'dist', entries: [] }));
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /零条目/);
});

// ---------- 挂账与 --report ----------

test('pendingMirrors 挂账常驻示众且本身不阻断', () => {
  w('docs/真源.md', '首年半价\n');
  ledger({
    entries: [
      {
        id: 'CAL-PEND',
        truth: { path: 'docs/真源.md', anchorRegex: '首年半价' },
        scans: [{ name: '面', include: ['docs/**'], forbid: ['永不出现的词'] }],
        pendingMirrors: [{ path: 'docs/图集.html', why: '自称现行却仍存旧词，归属图集批次修净' }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /挂账待修（不阻断）：\[CAL-PEND\] docs\/图集\.html/);
  assert.match(r.out, /自称现行/);
});

test('--report：断言红只汇总，退出码 0（定期抽检档不阻断在制工作）', () => {
  w('docs/真源.md', '已改口径\n');
  ledger({
    entries: [{ id: 'CAL-REP', truth: { path: 'docs/真源.md', anchorRegex: '旧口径' }, scans: [{ name: '面', include: ['docs/**'], forbid: ['永不出现的词'] }] }],
  });
  const r = run(['--report']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /报告（不阻断）/);
  assert.match(r.out, /真源锚点失效/);
});

test('--report 下账本损坏仍非零：坏账本在任何模式下都不许静默放行', () => {
  w('tools/caliber-ledger.json', '{坏');
  const r = run(['--report']);
  assert.equal(r.code, 1);
  assert.match(r.out, /不可读/);
});

// ---------- --staged 触达清单 ----------

function gitInitAndCommit() {
  const g = (args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  g(['init', '-q']);
  g(['config', 'user.email', 't@example.com']);
  g(['config', 'user.name', 't']);
  g(['add', '-A']);
  g(['commit', '-q', '-m', 'init']);
  return g;
}

function ledgerForStaged() {
  return ledger({
    entries: [
      {
        id: 'CAL-STAGE',
        title: '词位口径',
        rule: '改真源须同批同步镜像',
        truth: { path: 'docs/真源.md', anchorRegex: '现行词' },
        mirrors: [{ path: 'docs/镜像.md', require: ['现行词'] }],
      },
    ],
  });
}

test('--staged：真源被改名时，旧名与新名都算触达（R 记录三 token 解析）', () => {
  w('docs/真源.md', '现行词\n');
  w('docs/镜像.md', '现行词\n');
  const g = gitInitAndCommit();
  ledgerForStaged();
  g(['mv', 'docs/真源.md', 'docs/源头.md']);
  const r = run(['--staged']);
  assert.match(r.out, /触达条目/);
  assert.match(r.out, /CAL-STAGE 词位口径/);
});

test('--staged：真源被删除也算触达（不得用只认新增修改的口径）', () => {
  w('docs/真源.md', '现行词\n');
  w('docs/镜像.md', '现行词\n');
  const g = gitInitAndCommit();
  ledgerForStaged();
  g(['rm', '-q', 'docs/真源.md']);
  const r = run(['--staged']);
  assert.match(r.out, /CAL-STAGE/);
});

test('--staged：未触达任何条目时不输出清单，但断言照跑', () => {
  w('docs/真源.md', '现行词\n');
  w('docs/镜像.md', '现行词\n');
  w('docs/无关.md', '无关内容\n');
  const g = gitInitAndCommit();
  ledgerForStaged();
  g(['rm', '-q', 'docs/无关.md']);
  const r = run(['--staged']);
  assert.doesNotMatch(r.out, /触达条目/);
  assert.match(r.out, /全绿/);
  assert.equal(r.code, 0, r.out);
});

test('--staged 下断言红仍阻断（触达清单只是建议，不替代断言）', () => {
  w('docs/真源.md', '现行词\n');
  w('docs/镜像.md', '被漏改了\n');
  const g = gitInitAndCommit();
  ledgerForStaged();
  g(['add', 'docs/镜像.md']);
  const r = run(['--staged']);
  assert.equal(r.code, 1);
  assert.match(r.out, /镜像失步/);
});

test('非仓库目录跑 --staged：触达清单降级但断言仍全量执行，且不静默', () => {
  w('docs/真源.md', '已改口径\n');
  ledger({
    entries: [
      {
        id: 'CAL-NOGIT',
        truth: { path: 'docs/真源.md', anchorRegex: '旧口径' },
        scans: [{ name: 'docs 面', include: ['docs/**'], forbid: ['这个词永不出现在夹具里'] }],
      },
    ],
  });
  const r = run(['--staged']);
  assert.equal(r.code, 1);
  assert.match(r.out, /触达清单不可用/);
  assert.match(r.out, /断言仍全量执行/);
  assert.match(r.out, /真源锚点失效/);
});

// ---------- 结构畸形（防把断言写成恒真的形态）----------

test('mirrors 条目缺 path → 判畸形', () => {
  ledger({ entries: [{ id: 'CAL-BAD1', mirrors: [{ require: ['x'] }] }] });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /mirrors 必须是/);
});

test('mirrors.require 写成裸字符串 → 判畸形（不许静默当空数组绿过去）', () => {
  w('docs/真源.md', '现行词\n');
  ledger({
    entries: [
      {
        id: 'CAL-BAD2',
        truth: { path: 'docs/真源.md', anchorRegex: '现行词' },
        mirrors: [{ path: 'docs/镜像.md', require: '现行词' }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /必须是字符串数组/);
});

test('scans 缺 forbid 时判为无断言面（不误报也不误拦）', () => {
  w('docs/真源.md', '现行词\n');
  ledger({
    entries: [
      {
        id: 'CAL-NOFORBID',
        truth: { path: 'docs/真源.md', anchorRegex: '现行词' },
        scans: [{ name: '空面', include: ['docs/**'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 0, r.out);
});

// ---------- 门本身被无声摘掉（2026-10-01 交叉复核补）----------
// 复核实测：include 命中 0 文件、键名写错、只有 truth 的条目，四种都在旧实现下全绿 exit 0——
// 「一道不在跑的门」比没有门更危险，因为报告里它长得和绿门一模一样。

test('include 面命中 0 文件而目录存在：判红（禁出正在空跑），--report 也非零', () => {
  w('docs/x/深一层.md', '内容\n');
  ledger({
    entries: [
      {
        id: 'CAL-EMPTYGLOB',
        truth: { path: 'docs/x/深一层.md', anchorRegex: '内容' },
        scans: [{ name: '写错的单星面', include: ['docs/*.md'], forbid: ['永不出现'] }],
      },
    ],
  });
  const plain = run();
  assert.equal(plain.code, 1);
  assert.match(plain.out, /正在空跑/);
  const report = run(['--report']);
  assert.equal(report.code, 1, '报告档不许庇护空跑的门');
});

test('include 面所在目录不存在：只示众不判死（下游项目确实可能没有这个面）', () => {
  w('docs/真源.md', '现行口径\n');
  ledger({
    entries: [
      {
        id: 'CAL-NOSUCHDIR',
        truth: { path: 'docs/真源.md', anchorRegex: '现行口径' },
        scans: [{ name: 'CI 面', include: ['.github/**'], forbid: ['永不出现'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /该项目无此面/);
});

test('键名写错（mirror 少 s）：判畸形而不是当成「没有这道断言」', () => {
  w('docs/真源.md', '现行口径\n');
  w('docs/镜像.md', '现行口径\n');
  ledger({
    entries: [
      {
        id: 'CAL-TYPOKEY',
        truth: { path: 'docs/真源.md', anchorRegex: '现行口径' },
        mirror: [{ path: 'docs/镜像.md', require: ['现行口径'] }],
        scans: [{ name: '面', include: ['docs/**'], forbid: ['永不出现'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /无法识别的键/);
});

test('镜像项里的 require 写成 requrie：同样判畸形', () => {
  w('docs/真源.md', '现行口径\n');
  w('docs/镜像.md', '现行口径\n');
  ledger({
    entries: [
      {
        id: 'CAL-TYPOREQ',
        truth: { path: 'docs/真源.md', anchorRegex: '现行口径' },
        mirrors: [{ path: 'docs/镜像.md', requrie: ['现行口径'] }],
        scans: [{ name: '面', include: ['docs/**'], forbid: ['永不出现'] }],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /无法识别的键/);
});

test('只有 truth、既无 mirrors 又无 scans：判畸形（登记了规矩却没有可执行的断言面）', () => {
  w('docs/真源.md', '现行口径\n');
  ledger({ entries: [{ id: 'CAL-TRUTHONLY', truth: { path: 'docs/真源.md', anchorRegex: '现行口径' } }] });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /既无 mirrors 也无 scans/);
});

test('glob 写法 `./docs/**` 与反斜杠 `docs\\\\archive\\\\**`：归一后 exclude 与自跳照常生效', () => {
  w('docs/真源.md', '现行口径\n');
  w('docs/漏网.md', '写了退休词\n');
  w('docs/archive/历史.md', '当年写的退休词\n');
  ledger({
    entries: [
      {
        id: 'CAL-GLOBNORM',
        truth: { path: 'docs/真源.md', anchorRegex: '现行口径' },
        scans: [
          {
            name: '点斜杠与反斜杠混写的面',
            include: ['./docs/**'],
            exclude: ['docs\\archive\\**'],
            forbid: ['退休词'],
          },
        ],
      },
    ],
  });
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /docs\/漏网\.md/);
  assert.doesNotMatch(r.out, /archive/, 'exclude 若因写法不匹配而失效，历史面会被误伤');
});
