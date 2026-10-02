// 受管块「降级刷新」硬拦的行为契约测试（2026-10-02 接线）。
// 运行：node --test tests/test-init-target-runtime-downgrade.mjs
//
// 为什么这批测试必须存在：下发器过去只看「块与本文渲染结果是否不同」，不看方向。
// 于是目标项目装着 version=25 的块、执行者拿一份 version=23 的陈旧 skills 副本跑 `--write`，
// 计划里只有一行 `version 25 -> 23` 的 pending，写入后新代条款静默消失，而目标项目自己的
// 文档门禁照着自己那份登记放行——陈旧副本可以无声降级别人。守卫是纯决策逻辑，
// 没有测试就会在下一次改 planFile 时被顺手摘掉，所以这里把方向、粒度与「不写」钉住。
//
// 夹具口径：块正文由真生成器 renderBody() 现取，marker 的 checksum 自己算，
// 所以夹具是「自证完整」的块——checksum 分支不会抢在降级守卫前面，测到的就是守卫本身。
//
// 2026-10-02 追加 D4 组（同一出口的第二个谎）：某个入口判定失败时，runtime registry 的计划面
// 把该文件的 `version` 写成本代、`checksum` 写成失败计划自带的空串，还会把这一条整段删掉。
// 同一个函数、同一批夹具、同一类病，所以钉在同一份测试里。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TARGET_RUNTIME_BLOCK_VERSION, planTargetRuntimeUpdate, renderBody } from '../skills/event/experience-elevator/tools/init-target-runtime.mjs';

const selfDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(selfDir, '..');
const tool = join(repoRoot, 'skills', 'event', 'experience-elevator', 'tools', 'init-target-runtime.mjs');

const TARGETS = [
  { file: 'AGENTS.md', runtime: 'Codex', entry: 'AGENTS.md' },
  { file: 'CLAUDE.md', runtime: 'Claude', entry: 'CLAUDE.md' },
];

const START_PREFIX = '<!-- vibe-coding-skills:target-runtime:start';
const END_MARKER = '<!-- vibe-coding-skills:target-runtime:end -->';

const normalizeBody = (value) =>
  String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n$/u, '');
const checksum = (body) => createHash('sha256').update(normalizeBody(body), 'utf8').digest('hex');

// 与 renderBlock 同形（那是未导出的私有函数），逐字照它的拼接方式造块。
function blockOf(target, version, body) {
  const start = `${START_PREFIX} file=${target.file} version=${version} checksum=sha256:${checksum(body)} -->`;
  return `${start}\n\n${body}\n${END_MARKER}`;
}

function docOf(target, version, body) {
  return `# ${target.file}\n\n${blockOf(target, version, body ?? renderBody(target, repoRoot))}\n`;
}

let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rtblock-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function install(docs) {
  for (const target of TARGETS) {
    writeFileSync(join(root, target.file), docs[target.file] ?? docOf(target, TARGET_RUNTIME_BLOCK_VERSION));
  }
}

function planFor(file) {
  return planTargetRuntimeUpdate(root, repoRoot).plans.find((p) => p.file === file);
}

function cli(...flags) {
  const r = spawnSync('node', [tool, root, '--skills-root', repoRoot, ...flags], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, json: (() => {
    try {
      return JSON.parse(r.stdout);
    } catch {
      return null;
    }
  })() };
}

const FUTURE_VERSION = String(Number(TARGET_RUNTIME_BLOCK_VERSION) + 99);

// ---------- D1：方向判据 ----

test('D1 已装块版本高于本生成器：conflict/fail，reason 里带两个版本号', () => {
  install({ 'AGENTS.md': docOf(TARGETS[0], FUTURE_VERSION), 'CLAUDE.md': docOf(TARGETS[1], FUTURE_VERSION) });
  for (const target of TARGETS) {
    const plan = planFor(target.file);
    assert.equal(plan.action, 'conflict', `${target.file} 应判冲突：${plan.reason}`);
    assert.equal(plan.status, 'fail');
    assert.match(plan.reason, /降级刷新被阻断/);
    assert.match(plan.reason, new RegExp(`已装受管块 version=${FUTURE_VERSION}`));
    assert.match(plan.reason, new RegExp(`本生成器 version=${TARGET_RUNTIME_BLOCK_VERSION}`));
    // 不写：nextContent 必须逐字等于盘上现有内容，否则调用方照 nextContent 落盘就是静默降级。
    assert.equal(plan.nextContent, readFileSync(join(root, target.file), 'utf8'));
  }
});

test('D1 真实形态：未来代块正文更长但自证完整，仍由降级守卫拦下而非 checksum 抢先', () => {
  const futureBody = `${renderBody(TARGETS[0], repoRoot)}\n\n### 未来代条款\n- 本生成器不知道的规矩`;
  install({
    'AGENTS.md': docOf(TARGETS[0], FUTURE_VERSION, futureBody),
    'CLAUDE.md': docOf(TARGETS[1], FUTURE_VERSION),
  });
  const plan = planFor('AGENTS.md');
  assert.equal(plan.action, 'conflict');
  assert.match(plan.reason, /降级刷新被阻断/, '正文不同＋版本更高时报的应是降级，不是「用户手改了块」');
  assert.doesNotMatch(plan.reason, /checksum mismatch/);
});

test('D1 粒度：只有 AGENTS.md 是新版时另一份入口照常 update，不全局短路', () => {
  install({
    'AGENTS.md': docOf(TARGETS[0], FUTURE_VERSION),
    'CLAUDE.md': docOf(TARGETS[1], String(Number(TARGET_RUNTIME_BLOCK_VERSION) - 1)),
  });
  assert.equal(planFor('AGENTS.md').action, 'conflict');
  assert.equal(planFor('CLAUDE.md').action, 'update');
});

// ---------- D2：对照——守卫只认方向，不认「所有差异' ----

test('D2 低版本仍走 update：reason 给出升级方向', () => {
  const lower = String(Number(TARGET_RUNTIME_BLOCK_VERSION) - 1);
  install({ 'AGENTS.md': docOf(TARGETS[0], lower), 'CLAUDE.md': docOf(TARGETS[1], lower) });
  for (const target of TARGETS) {
    const plan = planFor(target.file);
    assert.equal(plan.action, 'update', `${target.file}：${plan.reason}`);
    assert.equal(plan.status, 'pending');
    assert.equal(plan.reason, `version ${lower} -> ${TARGET_RUNTIME_BLOCK_VERSION}`);
  }
});

test('D2 同版本但正文已变：update（渲染变化，不是降级）', () => {
  const edited = `${renderBody(TARGETS[0], repoRoot)}\n\n- 本代新增的一行`;
  install({
    'AGENTS.md': docOf(TARGETS[0], TARGET_RUNTIME_BLOCK_VERSION, edited),
    'CLAUDE.md': docOf(TARGETS[1], TARGET_RUNTIME_BLOCK_VERSION),
  });
  const plan = planFor('AGENTS.md');
  assert.equal(plan.action, 'update');
  assert.equal(plan.reason, 'rendered block changed');
});

test('D2 版本不可比（非整数）时不判降级：沿用原口径当普通 update', () => {
  install({ 'AGENTS.md': docOf(TARGETS[0], '2.5'), 'CLAUDE.md': docOf(TARGETS[1], '2.5') });
  for (const target of TARGETS) {
    const plan = planFor(target.file);
    assert.equal(plan.action, 'update', `${target.file}：${plan.reason}`);
    assert.doesNotMatch(plan.reason, /降级/);
  }
});

test('D2 手改内容仍由 checksum 分支先报：降级守卫不替用户编辑背锅', () => {
  const tampered = `${renderBody(TARGETS[0], repoRoot)}\n\n用户自己加的话`;
  install({
    // marker 里的 checksum 故意留成本代正文的哈希——内容与登记不符＝手改
    'AGENTS.md': `# AGENTS.md\n\n${START_PREFIX} file=AGENTS.md version=${FUTURE_VERSION} checksum=sha256:${checksum(renderBody(TARGETS[0], repoRoot))} -->\n\n${tampered}\n${END_MARKER}\n`,
    'CLAUDE.md': docOf(TARGETS[1], TARGET_RUNTIME_BLOCK_VERSION),
  });
  const plan = planFor('AGENTS.md');
  assert.equal(plan.action, 'conflict');
  assert.match(plan.reason, /checksum mismatch/);
});

// ---------- D3：写入面 ----

test('D3 --write 整笔事务不落盘：盘上字节与登记文件都不变', () => {
  install({ 'AGENTS.md': docOf(TARGETS[0], FUTURE_VERSION), 'CLAUDE.md': docOf(TARGETS[1], FUTURE_VERSION) });
  const before = TARGETS.map((t) => readFileSync(join(root, t.file), 'utf8'));
  const r = cli('--write');
  assert.notEqual(r.code, 0, `降级必须非零退出：${r.out}`);
  assert.match(r.out, /降级刷新被阻断/);
  const after = TARGETS.map((t) => readFileSync(join(root, t.file), 'utf8'));
  assert.deepEqual(after, before, '--write 不得改动任何入口文件');
  // 全有或全无：连 runtime registry 与写事务日志这种「本来会写」的旁支也不能落盘。
  assert.ok(!existsSync(join(root, '.vibe-runtime-setup.json')), '写事务应整体跳过，却在目标根留下事务日志');
  assert.ok(!existsSync(join(root, '.vibe-runtime.json')), 'runtime registry 不得在失败事务里生成');
});

test('D3 对照：同一夹具只差版本方向时 --write 正常落盘，证明上面的不写不是夹具本身坏了', () => {
  const lower = String(Number(TARGET_RUNTIME_BLOCK_VERSION) - 1);
  install({ 'AGENTS.md': docOf(TARGETS[0], lower), 'CLAUDE.md': docOf(TARGETS[1], lower) });
  const r = cli('--write');
  assert.equal(r.code, 0, r.out);
  for (const target of TARGETS) {
    const text = readFileSync(join(root, target.file), 'utf8');
    assert.match(text, new RegExp(`version=${TARGET_RUNTIME_BLOCK_VERSION}`), `${target.file} 应已升级到本代`);
  }
});

test('D3 --check 把降级报成 conflict 而非 pending 升级：检查模式不得给出「等着升级」的读数', () => {
  install({ 'AGENTS.md': docOf(TARGETS[0], FUTURE_VERSION), 'CLAUDE.md': docOf(TARGETS[1], FUTURE_VERSION) });
  const r = cli('--check');
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /\[FAIL\s*\] AGENTS\.md: conflict \(降级刷新被阻断/);
  // 旧口径会给一行 `[PENDING] AGENTS.md: update (version 125 -> 26)`——读数看着像「再跑一次就升级」，
  // 这正是静默降级的入口；现在这条不得出现在任何文件上。
  assert.doesNotMatch(r.out, /AGENTS\.md: update \(version/, r.out);
});

test('D3 --json 的 failures 里带该文件与 reason，summary.failures 不为 0', () => {
  install({ 'AGENTS.md': docOf(TARGETS[0], FUTURE_VERSION), 'CLAUDE.md': docOf(TARGETS[1], FUTURE_VERSION) });
  const r = cli('--check', '--json');
  assert.ok(r.json, `--json 输出不可解析：${r.out}`);
  assert.equal(r.json.summary.failures, 2, '两份入口都该计入失败');
  const failed = r.json.files.filter((f) => f.status === 'fail').map((f) => f.file).sort();
  assert.deepEqual(failed, ['AGENTS.md', 'CLAUDE.md']);
});

// ---------- D4：runtime registry 的计划面：判定失败的文件不得改写已登记状态 ----------
//
// 为什么钉在同一份测试里：D1–D3 管的是「块计划能不能说谎」，D4 管的是「登记计划能不能说谎」，
// 同一个函数（planTargetRuntimeUpdate）的同一个出口，同一批夹具。旧写法把失败块的
// `version` 写成本代、`checksum` 写成失败计划自带的空串（实测 2026-10-02）：
// 上一轮的真 checksum 被抹成空串，判定失败的那条还会被整条删掉，而 `--check` 把它打印成
// 「runtime registry changed」——目标项目照它落盘就会把唯一记录块状态的机器文件改成不可用。

const RUNTIME_REGISTRY_FILE = '.vibe-runtime.json';
const RECORDED_AT = '2026-01-01T00:00:00.000Z';

function registryPlanOf(out) {
  const plan = out.plans.find((p) => p.file === RUNTIME_REGISTRY_FILE && /runtime registry/u.test(p.reason));
  assert.ok(plan, `计划里没有 registry 那一条：${out.plans.map((p) => `${p.file}/${p.reason}`).join(' | ')}`);
  return plan;
}

function registryBlocksOf(out) {
  const plan = registryPlanOf(out);
  assert.ok(plan.nextContent, 'registry 计划没有正文，无从判定');
  return { plan, blocks: JSON.parse(plan.nextContent).runtimeBlocks };
}

function writeRegistry(entries) {
  writeFileSync(join(root, RUNTIME_REGISTRY_FILE), `${JSON.stringify({
    schemaVersion: 1,
    generatedBy: 'vibe-coding-skills',
    updatedAt: RECORDED_AT,
    runtimeBlocks: entries,
  }, null, 2)}\n`, 'utf8');
}

// 先跑一次健康夹具，取出生成器认可的 checksum，避免在测试里重算一遍哈希口径。
function liveChecksums() {
  install({});
  const out = planTargetRuntimeUpdate(root, repoRoot);
  return Object.fromEntries(out.plans
    .filter((p) => p.file !== RUNTIME_REGISTRY_FILE && p.checksum)
    .map((p) => [p.file, p.checksum]));
}

test('D4 判定失败的块不得被写成本代版本：登记照抄上一轮，且 --check 不再承诺刷新', () => {
  const live = liveChecksums();
  const recorded = {
    'AGENTS.md': { kind: 'target-runtime', version: '25', checksum: 'a'.repeat(64), source: 'tools/init-target-runtime.mjs', updatedAt: RECORDED_AT },
    'CLAUDE.md': { kind: 'target-runtime', version: TARGET_RUNTIME_BLOCK_VERSION, checksum: live['CLAUDE.md'], source: 'tools/init-target-runtime.mjs', updatedAt: RECORDED_AT },
  };
  // 让 AGENTS.md 的判定失败且拿不出可信 checksum：同名目录使路径检查直接抛错
  rmSync(join(root, 'AGENTS.md'));
  mkdirSync(join(root, 'AGENTS.md'));
  writeRegistry(recorded);

  const out = planTargetRuntimeUpdate(root, repoRoot);
  assert.equal(out.plans.find((p) => p.file === 'AGENTS.md').status, 'fail', '夹具必须先让块判定失败');
  const { plan, blocks } = registryBlocksOf(out);
  assert.equal(plan.action, 'none', `失败不该被读成「registry 待刷新」：${plan.reason}`);
  // 照抄是对的，但 action=none 单独看等于「一切正常」；降级必须在读数面点名（路 A 复核第 4 条）
  assert.match(plan.reason, /沿用上一轮：AGENTS\.md 本轮判定失败未核对/u, `读数不得把未核对说成正常：${plan.reason}`);
  assert.deepEqual(blocks['AGENTS.md'], recorded['AGENTS.md'], '已登记版本与 checksum 必须逐字保留');
  assert.equal(blocks['CLAUDE.md'].checksum, live['CLAUDE.md'], '健康文件的登记不受影响');
  assert.deepEqual(Object.values(blocks).map((b) => b.checksum).filter((c) => c === ''), [], '登记面不得出现空 checksum');
});

test('D4 从未装过的文件判定失败时不得凭空造条目', () => {
  const live = liveChecksums();
  writeRegistry({
    'CLAUDE.md': { kind: 'target-runtime', version: TARGET_RUNTIME_BLOCK_VERSION, checksum: live['CLAUDE.md'], source: 'tools/init-target-runtime.mjs', updatedAt: RECORDED_AT },
  });
  rmSync(join(root, 'AGENTS.md'));
  mkdirSync(join(root, 'AGENTS.md'));

  const { plan, blocks } = registryBlocksOf(planTargetRuntimeUpdate(root, repoRoot));
  assert.deepEqual(Object.keys(blocks), ['CLAUDE.md'], '失败的 AGENTS.md 不得被写成一份本代已装记录');
  assert.doesNotMatch(plan.reason, /沿用上一轮/u, `没有照抄任何一条时不得点名「未核对」（${plan.reason}）`);
});

test('D4 对照：同一夹具把失败换成正常升级时 registry 必须真给出本代版本与新 checksum', () => {
  const live = liveChecksums();
  const lower = String(Number(TARGET_RUNTIME_BLOCK_VERSION) - 1);
  const recorded = {
    'AGENTS.md': { kind: 'target-runtime', version: lower, checksum: 'a'.repeat(64), source: 'tools/init-target-runtime.mjs', updatedAt: RECORDED_AT },
    'CLAUDE.md': { kind: 'target-runtime', version: TARGET_RUNTIME_BLOCK_VERSION, checksum: live['CLAUDE.md'], source: 'tools/init-target-runtime.mjs', updatedAt: RECORDED_AT },
  };
  rmSync(join(root, 'AGENTS.md'));
  mkdirSync(join(root, 'AGENTS.md'));
  writeRegistry(recorded);
  assert.deepEqual(registryBlocksOf(planTargetRuntimeUpdate(root, repoRoot)).blocks['AGENTS.md'], recorded['AGENTS.md'], '夹具先证明失败面确实不动登记');

  // 只差这一步：把 AGENTS.md 换回可写的低版本块（判定不再失败）
  rmSync(join(root, 'AGENTS.md'), { recursive: true });
  writeFileSync(join(root, 'AGENTS.md'), docOf(TARGETS[0], lower), 'utf8');
  const { plan, blocks } = registryBlocksOf(planTargetRuntimeUpdate(root, repoRoot));
  assert.equal(plan.action, 'update', `健康升级该被读成待刷新：${plan.reason}`);
  assert.equal(plan.reason, 'runtime registry changed', '没有文件被照抄时，读数不得带「沿用上一轮」这句');
  assert.equal(blocks['AGENTS.md'].version, TARGET_RUNTIME_BLOCK_VERSION);
  assert.equal(blocks['AGENTS.md'].checksum, live['AGENTS.md']);
});

test('D4 投影登记面（experienceProjection.outputs）同样不得因单文件判定失败而删条目', () => {
  // 有 L1 宪法（登记表能加载）才会算投影；L0 台账故意缺席——它只影响另几条失败计划，
  // 不该改变「登记面照抄已装值」这条判据，正好把「一处读不到的故障」与「登记被改坏」分开钉。
  const writeAt = (relative, content) => {
    const target = join(root, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  };
  const registryBody = JSON.stringify({ schemaVersion: 1, sourceRevision: 1, rules: [] }, null, 2);
  writeAt('.vibe-docs.json', `${JSON.stringify({
    schemaVersion: 2,
    constitutionDesign: 'docs/项目治理/宪法设计.md',
    experienceGovernance: 'docs/项目治理/经验治理.md',
  }, null, 2)}\n`);
  writeAt('docs/项目治理/宪法设计.md', `# 宪法设计\n\n<!-- vibe-coding-skills:target-experience-registry:start version=1 checksum=sha256:${checksum(registryBody)} -->\n${registryBody}\n<!-- vibe-coding-skills:target-experience-registry:end -->\n`);

  const projectionOf = (out) => JSON.parse(registryPlanOf(out).nextContent).experienceProjection;
  const healthy = projectionOf(planTargetRuntimeUpdate(root, repoRoot));
  assert.deepEqual(Object.keys(healthy.outputs).sort(), ['AGENTS.md', 'CLAUDE.md'], `健康夹具本就该产出两份投影登记：${JSON.stringify(healthy)}`);

  // 把 AGENTS.md 换成同名目录使其判定失败，并把它已登记的投影值换成哨兵，看会不会被整条删掉
  healthy.outputs['AGENTS.md'] = { sourceHash: `sha256:${'b'.repeat(64)}`, outputHash: `sha256:${'c'.repeat(64)}` };
  rmSync(join(root, 'AGENTS.md'), { force: true });
  mkdirSync(join(root, 'AGENTS.md'));
  writeFileSync(join(root, RUNTIME_REGISTRY_FILE), `${JSON.stringify({
    schemaVersion: 1,
    generatedBy: 'vibe-coding-skills',
    updatedAt: RECORDED_AT,
    runtimeBlocks: {},
    experienceProjection: healthy,
  }, null, 2)}\n`, 'utf8');

  const out = planTargetRuntimeUpdate(root, repoRoot);
  assert.ok(out.plans.some((p) => p.file === 'AGENTS.md' && p.status === 'fail'), '夹具必须先让 AGENTS.md 判定失败');
  const after = projectionOf(out);
  assert.deepEqual(Object.keys(after.outputs).sort(), ['AGENTS.md', 'CLAUDE.md'], '失败文件的上一次投影登记不得被删条目');
  assert.deepEqual(after.outputs['AGENTS.md'], healthy.outputs['AGENTS.md'], '照抄的必须是已登记的那一份，不是重新算出来的');
  // 本夹具里 AGENTS.md 没有任何块条目，照抄只发生在投影面：点名必须照样给出。
  // （实测点名是两条：AGENTS.md 读不到之后，CLAUDE.md 的已装投影自校验也判失败，
  //   「established runtime experience projection missing」——一处故障在计划面扩散成两处，见 evidence §3）
  assert.match(registryPlanOf(out).reason, /沿用上一轮：[^\n]*AGENTS\.md/u, '只照抄投影登记时也必须点名');
});
