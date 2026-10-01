// check-runtime-block-refs.mjs 的行为契约测试（受管块下发文本自扫门，2026-10-02 接线）。
// 运行：node --test tests/test-check-runtime-block-refs.mjs
//
// 为什么这批测试必须存在：本包 2026-10-01 那轮 v24→v25 返工的根因是「受管块由生成器渲染后写进
// 别人仓库，而本包棘轮只扫 skills/**/*.md，看不见注入后果」。新门若自己没有被测过，就只是把一个
// 没人消费的包装脚本当成防线；所以这里钉的是「本门不能把没判成报成判过了」的全部分支：
// 渲染正文与生成器同形、正文与写盘字节同形、扫描面只有那 1 份虚拟面、下发面不吃基线豁免、
// 子进程起不来与门没装配时都给 2 而不是 0/1、临时件用完真删掉。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  TARGET_RUNTIME_BLOCK_VERSION,
  getConstitutionBody,
} from '../skills/event/experience-elevator/tools/init-target-runtime.mjs';

const selfDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(selfDir, '..');
const gate = join(repoRoot, 'scripts', 'check-runtime-block-refs.mjs');

function runGate(args = []) {
  const r = spawnSync(process.execPath, [gate, ...args], { encoding: 'utf8', cwd: repoRoot });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

test('门绿：当前受管块正文在本包面内没有死引用', () => {
  const r = runGate();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /命中 0 处/);
  assert.match(r.out, new RegExp(`version=${TARGET_RUNTIME_BLOCK_VERSION}`), '读数必须带块版本，否则不知道扫的是哪一代');
});

test('门扫的是渲染结果：--print-body 与生成器 getConstitutionBody() 逐字相同', () => {
  const r = runGate(['--print-body']);
  assert.equal(r.code, 0, r.out);
  const printed = r.out.replace(/\r\n/g, '\n').replace(/\n$/, '');
  assert.equal(printed, getConstitutionBody(), '门自扫的正文必须是生成器渲染结果，不是盘上某份旧副本');
});

test('突变可见：把已收口的谎报形态（本包不下发的脚本名）喂给同一套判据必红', () => {
  // 端到端突变需要改生成器本体，属下一批；这里用同一判据入口（--virtual-md）钉住「形态必红」，
  // 保证门不是恒绿包装。v25 实测命中 6 处的复算过程见 evidence/20261002-managed-block-self-scan-gate.md。
  const dir = mkdtempSync(join(tmpdir(), 'blockref-mutate-'));
  try {
    const bodyPath = join(dir, 'block.md');
    writeFileSync(bodyPath, '交付前跑 `resolve-target-doc-context.mjs` 收口。\n', 'utf8');
    const r = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'scripts', 'check-skill-references.mjs'),
        '--root', repoRoot, '--virtual-only',
        '--virtual-md', '受管块/AGENTS+CLAUDE.md', bodyPath,
      ],
      { encoding: 'utf8', cwd: repoRoot },
    );
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    assert.equal(r.status, 1, out);
    assert.match(out, /死引·R3/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('突变可见（占位符面）：块内把技能写成一层时同一套判据必红', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blockref-mutate2-'));
  try {
    const bodyPath = join(dir, 'block.md');
    writeFileSync(bodyPath, '只加载 `<skills-root>/skills/<skill>/SKILL.md`。\n', 'utf8');
    const r = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'scripts', 'check-skill-references.mjs'),
        '--root', repoRoot, '--virtual-only',
        '--virtual-md', '受管块/AGENTS+CLAUDE.md', bodyPath,
      ],
      { encoding: 'utf8', cwd: repoRoot },
    );
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    assert.equal(r.status, 1, out);
    assert.match(out, /死引·R6/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('子进程起不来时不降级为绿：--root 指向没有棘轮的目录判 exit 2（本门没跑起来，不是有死引）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blockref-nochecker-'));
  try {
    // 假包根：目录结构正常但没有 scripts/check-skill-references.mjs。
    const r = runGate(['--root', dir]);
    assert.equal(r.code, 2, `缺检查器必须是「门没跑起来」的 2，不能借 node 的 exit 1 与本门的「有死引」同码：${r.out}`);
    assert.match(r.out, /包根里没有棘轮脚本/);
    assert.doesNotMatch(r.out, /命中 0 处/, '缺判据时不得打印任何扫描读数');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('未知开关判用法错误（exit 2），不当成「扫过了」', () => {
  const r = runGate(['--scope', 'skills']);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /未知开关/);
});

test('门的临时渲染件用完即删：仓库根不留文件，系统临时目录也不留残包', () => {
  const sweep = () => readdirSync(tmpdir()).filter((n) => n.startsWith('vibe-block-scan-'));
  const before = sweep();
  const r = runGate();
  assert.equal(r.code, 0, r.out);
  assert.equal(existsSync(join(repoRoot, 'block.md')), false, '渲染正文不得落在仓库根');
  assert.deepEqual(sweep(), before, `临时目录残留了 ${sweep().length - before.length} 个 vibe-block-scan-*（rmSync 被摘掉时只有这条看得见）`);
});

// 以下各例钉「本门不是恒绿」（路 A＋路 B 两轮对抗复核查出的洞，逐条补在此）：
//   洞①（路 A）：渲染退化成空串／半截正文时，棘轮照样「命中 0 处」exit 0——门恒绿却什么都没扫。
//   洞②（路 A）：spawnSync 的 `--virtual-only`／`--virtual-md` 一旦被改动，棘轮去扫盘面存量并判 0，
//                 本门透传绿——所以必须读棘轮自己的汇总行，确认本次真只有那 1 份虚拟面。
//   洞③（路 B）：①②判的都是 `body` 这个字符串，不校验**写进 block.md 的字节就是 body**；把
//                 writeFileSync 换成写空串或写 `payload.slice(0, 20)`（谎报行正好被截掉），①②全绿。
//   洞④（路 B）：棘轮的基线文件能把任何一条命中洗成「存量」从而 exit 0——下发件不接受这种换法。
//   洞⑤（路 B）：`--print-body` 支路早于自证时，对着空正文也 exit 0，等于用「没扫」兑换一个 0。
// 突变必须真突变：这里把门与棘轮复制进隔离迷你包，改的是副本的源码行，不动真树。
const gateSrc = readFileSync(gate, 'utf8');

// 夹具正文要过门的自证 ①（`### ` 规则面数 ≥ 6，见门头注那条下限的推导），所以给 7 个规则面。
const cleanBody = `## Agent 宪法\n${Array.from({ length: 7 }, (_, i) => `### 规则面${i + 1}\n- 干净正文\n`).join('')}`;

function runInMiniPackage({ body = cleanBody, mutate = (src) => src, args = [], baseline = null, throwsOnRender = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'blockref-mini-'));
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    mkdirSync(join(dir, 'skills', 'event', 'experience-elevator', 'tools'), { recursive: true });
    // 盘面上放一份干净的 .md：丢了 --virtual-only 时它会混进扫描面，让突变可见。
    mkdirSync(join(dir, 'skills', 'event', 'demo'), { recursive: true });
    writeFileSync(join(dir, 'skills', 'event', 'demo', 'SKILL.md'), '# demo\n\n干净正文\n', 'utf8');
    copyFileSync(join(repoRoot, 'scripts', 'check-skill-references.mjs'), join(dir, 'scripts', 'check-skill-references.mjs'));
    if (baseline) writeFileSync(join(dir, 'scripts', 'skill-reference-baseline.json'), JSON.stringify(baseline, null, 2), 'utf8');
    writeFileSync(
      join(dir, 'skills', 'event', 'experience-elevator', 'tools', 'init-target-runtime.mjs'),
      throwsOnRender
        ? 'export const TARGET_RUNTIME_BLOCK_VERSION = "99";\nexport function getConstitutionBody() {\n  throw new Error("夹具：渲染失败");\n}\n'
        : `export const TARGET_RUNTIME_BLOCK_VERSION = "99";\nexport function getConstitutionBody() {\n  return ${JSON.stringify(body)};\n}\n`,
      'utf8',
    );
    const gateCopy = join(dir, 'scripts', 'gate.mjs');
    writeFileSync(gateCopy, mutate(gateSrc), 'utf8');
    const r = spawnSync(process.execPath, [gateCopy, '--root', dir, ...args], { encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('突变可见（正文退化）：空串／缺宪法标题／规则面塌到下限以下，三种退化都判红 2', () => {
  const cases = [
    ['空串', { body: '' }, /渲染结果为空串/],
    ['缺标题', { body: '### 规则面\n- 干净正文\n' }, /正文缺 `## Agent 宪法` 标题/],
    ['规则面塌陷', { body: '## Agent 宪法\n### 只剩一面\n- 一条规则\n' }, /低于下限/],
    ['对照：干净正文', { body: cleanBody }, null],
  ];
  for (const [name, opts, expect] of cases) {
    const r = runInMiniPackage(opts);
    if (expect === null) {
      assert.equal(r.code, 0, `对照组必须绿，否则下面三例的红来自夹具本身：${r.out}`);
      assert.match(r.out, /命中 0 处/);
      continue;
    }
    assert.equal(r.code, 2, `${name}：退化不得判绿：${r.out}`);
    assert.match(r.out, expect, `${name}：要说清是哪一种退化：${r.out}`);
    assert.match(r.out, /这不是「没有死引」，是本门没有可扫的正文/);
    assert.doesNotMatch(r.out, /命中 0 处/, `${name}：退化时不得打印棘轮的「命中 0 处」冒充足扫`);
  }
});

test('突变可见（扫描面退化）：丢 --virtual-only 或 --virtual-md 都判红，不得透传盘面绿', () => {
  const mutations = [
    ['丢 --virtual-only', (src) => src.replace("        '--virtual-only',\n", ''), /扫描面是 2 个文件|只扫 1 份虚拟面/],
    ['丢 --virtual-md', (src) => src.replace("        '--virtual-md', BLOCK_FACE, bodyPath,", ''), /--virtual-only 必须与至少一个 --virtual-md|只扫 1 份虚拟面/],
  ];
  for (const [name, mutate, expect] of mutations) {
    assert.notEqual(gateSrc.indexOf("        '--virtual-only',\n"), -1, `${name}：门的参数行形态变了，先修本测试`);
    const r = runInMiniPackage({ mutate });
    assert.equal(r.code, 2, `${name}：没扫到虚拟面却判绿，是本门最坏的失败：${r.out}`);
    assert.match(r.out, expect, `${name}：要给出「没有判据可读」的原因：${r.out}`);
  }
});

test('突变可见（写盘与渲染脱钩）：写入空串或截断正文，回读自证必须判红 2', () => {
  const mutations = [
    ['写成空串', (src) => src.replace('writeFileSync(bodyPath, payload, \'utf8\');', "writeFileSync(bodyPath, '', 'utf8');")],
    ['写成截断', (src) => src.replace('writeFileSync(bodyPath, payload, \'utf8\');', "writeFileSync(bodyPath, payload.slice(0, 20), 'utf8');")],
    ['写成另一份正文', (src) => src.replace('writeFileSync(bodyPath, payload, \'utf8\');', "writeFileSync(bodyPath, '## Agent 宪法\\n### a\\n### b\\n### c\\n### d\\n### e\\n### f\\n### g\\n', 'utf8');")],
  ];
  for (const [name, mutate] of mutations) {
    assert.notEqual(gateSrc.indexOf("writeFileSync(bodyPath, payload, 'utf8');"), -1, `${name}：门的写盘行形态变了，先修本测试`);
    const r = runInMiniPackage({ mutate });
    assert.equal(r.code, 2, `${name}：扫的不是渲染正文时，本门不得报绿：${r.out}`);
    assert.match(r.out, /写盘回读与渲染结果不一致/);
    assert.doesNotMatch(r.out, /命中 0 处/, `${name}：脱钩时不得打印棘轮读数冒充足扫`);
  }
});

test('突变可见（下发面不吃基线豁免）：同一句谎报，登记进基线后本门仍判红 2', () => {
  // 棘轮自己的口径是「登记即存量、存量不阻断」，对技能正文是对的；对下发件不是。
  // 这里不加这条禁令，头注那句「落点规矩」就只是纸面：登记一行就能把块里的谎报洗绿。
  const lieBody = `${cleanBody}\n交付前跑 \`ghost-tool.mjs\` 收口。\n`;
  const plain = runInMiniPackage({ body: lieBody });
  assert.equal(plain.code, 1, `没登记时必须是棘轮判红（先确认谎报形态真被判）：${plain.out}`);
  assert.match(plain.out, /死引·R3/);

  const washed = runInMiniPackage({
    body: lieBody,
    baseline: {
      schema: 'vibe-coding-skills-skill-reference-baseline/v1',
      entries: [{ rule: 'R3', file: '受管块/AGENTS+CLAUDE.md', token: 'ghost-tool.mjs', reason: '测试用：把下发面的谎报登记成存量' }],
    },
  });
  assert.match(washed.out, /命中 1 处（未登记新增 0 处、基线存量 1 处）/, `夹具应让棘轮自己 exit 0：${washed.out}`);
  assert.equal(washed.code, 2, '下发面的豁免必须被本门拦下，而不是透传棘轮的绿');
  assert.match(washed.out, /下发面出现 1 处基线豁免/);
});

test('突变可见（--print-body 也过正文自证）：正文退化时不得用打印支路换一个 exit 0', () => {
  const r = runInMiniPackage({ body: '', args: ['--print-body'] });
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /渲染结果为空串/);
  const ok = runInMiniPackage({ args: ['--print-body'] });
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /## Agent 宪法/);
});

test('渲染抛异常时判红 2，不降级为「没有死引」', () => {
  const r = runInMiniPackage({ throwsOnRender: true });
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /受管块正文渲染失败：夹具：渲染失败/);
  assert.match(r.out, /这不是「没有死引」，是本门没有跑起来/);
  assert.doesNotMatch(r.out, /命中 0 处/);
});

test('突变可见（临时目录自证有牙）：摘掉 rmSync 后「用完即删」那条必须真的红', () => {
  const sweep = () => readdirSync(tmpdir()).filter((n) => n.startsWith('vibe-block-scan-'));
  const before = sweep();
  const r = runInMiniPackage({ mutate: (src) => src.replace('rmSync(workDir, { recursive: true, force: true });', 'void workDir;') });
  const leaked = sweep().filter((n) => !before.includes(n));
  try {
    assert.equal(r.code, 0, `摘掉清理不影响判定，只影响残留：${r.out}`);
    assert.equal(leaked.length, 1, '突变必须真的留下 1 个残留包，否则上面那条「深比较临时目录」是空断言');
  } finally {
    for (const name of leaked) rmSync(join(tmpdir(), name), { recursive: true, force: true });
  }
});
