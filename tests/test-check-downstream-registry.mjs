// check-downstream-registry.mjs 的行为契约测试（下游受管块登记门，2026-10-02 接线，owner 拍板「建，按路径登记」）。
// 运行：node --test tests/test-check-downstream-registry.mjs
//
// 为什么这批测试必须存在：本门管的是「本包改了下发件，别人停在第几代」这句话。这句话过去只活在一次性
// 普查的证据文里（evidence/20261002-runtime-registry-mirror.md §7），下一批又得重新问一遍——owner 说的
// 口径漂移在下游侧就是这个形状。登记面本身也会漂，所以这里钉死两类分支：
//   结构档（任何平台）：登记缺失/畸形/空清单一律不给绿；版本高于生成器必红；登记里的标记正则与入口清单
//   必须与生成器源码同源（否则「两处各存一份口径」就是新漂移源）。
//   盘上档（合成夹具）：version/checksum 与标记行逐字对账、根内未登记的块、排除面排除空气、
//   闭合只判稳定面（登记面 ⊎ git 跟踪的夹具面 == 读数对应两面；易逝面只报数）。
// 两档的退出码分工也是钉住的对象：门没跑成=2，判红=1，一致=0。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { TARGET_RUNTIME_BLOCK_VERSION } from '../skills/event/experience-elevator/tools/init-target-runtime.mjs';

const selfDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(selfDir, '..');
const gate = join(repoRoot, 'scripts', 'check-downstream-registry.mjs');
const realRegistryPath = join(repoRoot, 'provenance', 'DOWNSTREAMS.json');

const MARKER_BODY =
  '^<!-- vibe-coding-skills:target-runtime:start file=(?<file>[^ ]+) version=(?<version>[^ ]+) checksum=sha256:(?<checksum>[a-f0-9]{64}) -->$';
const FAKE_VERSION = '12';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const withSlash = (p) => `${p.replace(/[\\/]+$/u, '')}/`;
const markerLine = (file, version, hash) =>
  `<!-- vibe-coding-skills:target-runtime:start file=${file} version=${version} checksum=sha256:${hash} -->`;
const blockDoc = (file, version, hash) =>
  `# 项目规则\n\n${markerLine(file, version, hash)}\n受管块正文\n<!-- vibe-coding-skills:target-runtime:end -->\n`;

function runGate(args) {
  const r = spawnSync(process.execPath, [gate, ...args], { encoding: 'utf8', cwd: repoRoot });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// 结构档夹具：拿真实登记表改字段，--repo 仍指真实包根（生成器是真源）。
function structureRun(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'dsreg-s-'));
  try {
    const reg = JSON.parse(readFileSync(realRegistryPath, 'utf8'));
    if (mutate) mutate(reg);
    const file = join(dir, 'DOWNSTREAMS.json');
    writeFileSync(file, JSON.stringify(reg, null, 2), 'utf8');
    return runGate(['--repo', repoRoot, '--registry', file, '--structure-only']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const FAKE_GENERATOR = (body) => `export const TARGET_RUNTIME_BLOCK_VERSION = "${FAKE_VERSION}";
export const DECOY_VERSION = "9";
const TARGET_FILES = [
  { file: "AGENTS.md", runtime: "Codex", entry: "AGENTS.md" },
  { file: "CLAUDE.md", runtime: "Claude", entry: "CLAUDE.md" },
];
const MARKER_RE = /${body}/u;
export function probe() {
  return [TARGET_FILES, MARKER_RE];
}
`;

// 盘上档夹具：完全合成，绝不碰 E:/ 与 G:/（CI 上没有那两个盘根，测试必须与本机无关）。
function diskFixture(options = {}) {
  const markerBody = options.grouplessBody
    ? MARKER_BODY.replace(/\(\?<[a-z]+>/gu, '(')
    : options.caretlessBody ? MARKER_BODY.replace(/^\^/u, '') : MARKER_BODY;
  const dir = mkdtempSync(join(tmpdir(), 'dsreg-d-'));
  const repo = join(dir, 'repo');
  mkdirSync(join(repo, 'provenance'), { recursive: true });
  mkdirSync(join(repo, 'tools'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'gen.mjs'), options.generatorSource ?? FAKE_GENERATOR(markerBody), 'utf8');
  const rootA = join(dir, 'root-a');
  mkdirSync(rootA, { recursive: true });
  writeFileSync(join(rootA, 'AGENTS.md'), blockDoc('AGENTS.md', options.onDiskVersion ?? FAKE_VERSION, options.onDiskHash ?? HASH_A), 'utf8');
  writeFileSync(join(rootA, 'CLAUDE.md'), blockDoc('CLAUDE.md', FAKE_VERSION, HASH_B), 'utf8');
  if (options.extraNested) {
    mkdirSync(join(rootA, 'docs'), { recursive: true });
    writeFileSync(join(rootA, 'docs', 'AGENTS.md'), blockDoc('AGENTS.md', FAKE_VERSION, HASH_C), 'utf8');
  }
  if (options.duplicateMarker) {
    writeFileSync(join(rootA, 'AGENTS.md'), blockDoc('AGENTS.md', FAKE_VERSION, HASH_A) + markerLine('AGENTS.md', FAKE_VERSION, HASH_A), 'utf8');
  }
  if (options.badMarkerFileField) {
    writeFileSync(join(rootA, 'AGENTS.md'), blockDoc('CLAUDE.md', FAKE_VERSION, HASH_A), 'utf8');
  }
  if (options.runtimeRegistry !== false) writeFileSync(join(rootA, '.vibe-runtime.json'), '{}\n', 'utf8');
  const exDir = join(dir, 'excluded');
  mkdirSync(exDir, { recursive: true });
  const stableExcludedFiles = options.excludedHits === 0 ? 0 : 2;
  if (options.excludedHits !== 0) {
    mkdirSync(join(exDir, 'wt1'), { recursive: true });
    writeFileSync(join(exDir, 'wt1', 'AGENTS.md'), blockDoc('AGENTS.md', options.excludedVersion ?? FAKE_VERSION, HASH_C), 'utf8');
    writeFileSync(join(exDir, 'wt1', 'CLAUDE.md'), blockDoc('CLAUDE.md', FAKE_VERSION, HASH_C), 'utf8');
  }
  // 易逝面夹具：一个「工作副本」目录，默认不带运行时登记（那才是检出的形态）。
  const volDir = join(dir, 'volatile');
  mkdirSync(volDir, { recursive: true });
  if (options.volatileFace !== false) {
    mkdirSync(join(volDir, 'wt-a'), { recursive: true });
    writeFileSync(join(volDir, 'wt-a', 'AGENTS.md'), blockDoc('AGENTS.md', FAKE_VERSION, HASH_C), 'utf8');
    if (options.volatileRuntimeRegistry) writeFileSync(join(volDir, 'wt-a', '.vibe-runtime.json'), '{}\n', 'utf8');
    if (options.volatileExtra) {
      mkdirSync(join(volDir, 'wt-b'), { recursive: true });
      writeFileSync(join(volDir, 'wt-b', 'AGENTS.md'), blockDoc('AGENTS.md', FAKE_VERSION, HASH_C), 'utf8');
    }
  }
  const registeredVersion = options.registeredVersion ?? FAKE_VERSION;
  const registeredChecksum = options.registeredChecksum ?? `sha256:${HASH_A}`;
  const reg = {
    schema: 'vibe-coding-skills/downstreams@1',
    block: {
      generator: 'tools/gen.mjs',
      versionConstant: 'TARGET_RUNTIME_BLOCK_VERSION',
      startMarkerRegex: markerBody,
      entryFiles: ['AGENTS.md', 'CLAUDE.md'],
    },
    scan: { depth: 3, skipDirs: ['node_modules', '.git'] },
    census: {
      capturedAt: '2026-10-02',
      command: "find /e /f /g -maxdepth 3 -type f \\( -name AGENTS.md -o -name CLAUDE.md \\) | xargs -0 grep -l 'vibe-coding-skills:target-runtime:start'",
      readings: {
        candidateFiles: 9,
        filesWithBlock: options.filesWithBlock ?? 4,
        rootsWithBlock: options.rootsWithBlock ?? 2,
        face: Object.assign(
          {
            registered: { files: 2, roots: 1 },
            excludedStable: { files: stableExcludedFiles, roots: stableExcludedFiles ? 1 : 0 },
            excludedVolatile: { files: options.volatileFace === false ? 0 : 1, roots: options.volatileFace === false ? 0 : 1 },
          },
          options.face,
        ),
      },
    },
    downstreams: [
      {
        root: options.missingRoot ? join(dir, 'gone-root') : rootA,
        kind: '合成下游',
        runtimeRegistry: true,
        entries: [
          { file: 'AGENTS.md', blockVersion: registeredVersion, checksum: registeredChecksum },
          { file: 'CLAUDE.md', blockVersion: FAKE_VERSION, checksum: `sha256:${HASH_B}` },
        ],
      },
    ],
    excluded: [
      {
        pathPrefix: withSlash(exDir),
        mutable: options.exMutable ?? false,
        reason: '合成夹具：这份排除项用来验证稳定排除面也能被判到，不是垃圾桶。',
      },
      ...(options.volatileFace === false
        ? []
        : [{ pathPrefix: withSlash(volDir), mutable: true, reason: '合成夹具：模拟随开随关的工作副本分身，不参与闭合等式。' }]),
    ],
  };
  if (options.mutateRegistry) options.mutateRegistry(reg);
  const registryPath = join(repo, 'provenance', 'DOWNSTREAMS.json');
  writeFileSync(registryPath, JSON.stringify(reg, null, 2), 'utf8');
  const run = (extra = []) => runGate(['--repo', repo, '--registry', registryPath, ...extra]);
  return { dir, run, registryPath };
}

// —— 真实登记表：结构档必须绿，且读数自证它没做盘上对账 ——
test('真实登记结构档绿，读数写明「未做盘上对账」', () => {
  const r = runGate(['--repo', repoRoot, '--structure-only']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /本次=结构档（未做盘上对账/);
  assert.match(r.out, new RegExp(`生成器 v${TARGET_RUNTIME_BLOCK_VERSION}`));
  assert.match(r.out, /登记 4 根、排除前缀 2 个/);
});

test('盘上路径不存在也不影响结构档（两档分工，CI 无 E:/ 与 G:/）', () => {
  const r = structureRun((reg) => { reg.downstreams[0].root = 'Z:/no/such/root'; });
  assert.equal(r.code, 0, `结构档不该碰盘：${r.out}`);
});

// —— 门没跑成 = 2 ——
test('登记表缺失 → exit 2，且明说这不是「没有下游」', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsreg-miss-'));
  try {
    const r = runGate(['--repo', repoRoot, '--registry', join(dir, 'DOWNSTREAMS.json'), '--structure-only']);
    assert.equal(r.code, 2, r.out);
    assert.match(r.out, /账本没了/);
    assert.doesNotMatch(r.out, /✓/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('登记表不是合法 JSON → exit 2（判据读不出来不降级为通过）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsreg-bad-'));
  try {
    const file = join(dir, 'DOWNSTREAMS.json');
    writeFileSync(file, '{ "downstreams": [', 'utf8');
    const r = runGate(['--repo', repoRoot, '--registry', file, '--structure-only']);
    assert.equal(r.code, 2, r.out);
    assert.match(r.out, /不是合法 JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('未知开关 → exit 2，不与判红共用退出码', () => {
  const r = runGate(['--wat', 'x', '--structure-only']);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /未知开关/);
});

test('block.generator 指不到盘上文件 → exit 2（装配失败，不是判过）', () => {
  const r = structureRun((reg) => { reg.block.generator = 'tools/nope.mjs'; });
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /block.generator/);
});

// —— 结构档判红 = 1 ——
test('downstreams 空数组判红：登记「没有任何下游」不能绿过去', () => {
  const r = structureRun((reg) => { reg.downstreams = []; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /空数组/);
});

test('entries 空数组判红：登记了根却没登记入口等于没登记', () => {
  const r = structureRun((reg) => { reg.downstreams[0].entries = []; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /entries 为空/);
});

test('盘上版本高于本生成器判红（本包副本陈旧＝D 批事故的另一半）', () => {
  const r = structureRun((reg) => {
    reg.downstreams[0].entries[0].blockVersion = String(Number(TARGET_RUNTIME_BLOCK_VERSION) + 1);
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /高于本生成器/);
});

test('登记的标记正则与生成器不同源判红（不许两处各存一份标记口径）', () => {
  const r = structureRun((reg) => { reg.block.startMarkerRegex = reg.block.startMarkerRegex.replace('version=', 'ver='); });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /未在生成器源码中逐字出现/);
});

test('入口清单与生成器 TARGET_FILES 不符判红', () => {
  const r = structureRun((reg) => { reg.block.entryFiles = ['AGENTS.md']; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /≠ 生成器 TARGET_FILES/);
});

test('versionConstant 改名判红（改名后连源码那一行都找不到，等于放弃版本口径对账）', () => {
  const r = structureRun((reg) => { reg.block.versionConstant = 'TARGET_RUNTIME_BLOCK_VERSION_V2'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /找不到「export const TARGET_RUNTIME_BLOCK_VERSION_V2 = <整数>」这一行/);
});

test('versionConstant 指向另一份整数导出判红（生成器里同时存在两个版本口径）', () => {
  const f = diskFixture({ mutateRegistry: (reg) => { reg.block.versionConstant = 'DECOY_VERSION'; } });
  try {
    const r = f.run(['--structure-only']);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /两份版本口径/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('同一根重复登记判红', () => {
  const r = structureRun((reg) => { reg.downstreams.push(JSON.parse(JSON.stringify(reg.downstreams[0]))); });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /根路径重复登记/);
});

test('排除前缀盖住已登记的根判红（同一件事两条口径）', () => {
  const r = structureRun((reg) => { reg.excluded[0].pathPrefix = 'E:/'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /两条口径/);
});

test('排除项没有理由判红：排除清单不是垃圾桶', () => {
  const r = structureRun((reg) => { reg.excluded[0].reason = '略'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /凭什么不算下游/);
});

test('排除前缀不带尾斜杠判红（E:/x 会连 E:/xy 一起排除）', () => {
  const r = structureRun((reg) => { reg.excluded[0].pathPrefix = reg.excluded[0].pathPrefix.replace(/\/$/u, ''); });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /必须以 \/ 结尾/);
});

test('checksum 形状不对判红（登记面自己先要可判）', () => {
  const r = structureRun((reg) => { reg.downstreams[0].entries[0].checksum = 'sha256:deadbeef'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /sha256:<64 hex>/);
});

test('普查命令里不含标记串判红：新下游的发现动作不可照抄＝等于没有', () => {
  const r = structureRun((reg) => { reg.census.command = 'find /e /f /g -maxdepth 6 -name AGENTS.md'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /没有可照抄命令/);
});

test('census.readings 缺字段判红（闭合检查没有对照数就是空判）', () => {
  const r = structureRun((reg) => { delete reg.census.readings.filesWithBlock; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /filesWithBlock/);
});

test('scan.depth 越界与 skipDirs 空都判红', () => {
  const a = structureRun((reg) => { reg.scan.depth = 0; });
  assert.equal(a.code, 1, a.out);
  assert.match(a.out, /1\.\.6/);
  const b = structureRun((reg) => { reg.scan.skipDirs = []; });
  assert.equal(b.code, 1, b.out);
  assert.match(b.out, /node_modules/);
});

test('根路径带尾斜杠判红（会把好登记读成「盘上没有」）', () => {
  const r = structureRun((reg) => { reg.downstreams[0].root = `${reg.downstreams[0].root}/`; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /错一位/);
});

test('根写成相对路径判红：按路径登记是设计前提，换 cwd 就换义', () => {
  const r = structureRun((reg) => { reg.downstreams[0].root = 'fs-agent'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /必须是绝对路径/);
});

test('入口写成绝对路径判红（盘上档拿它逐字对位，加料等于永远「盘上没有」）', () => {
  const r = structureRun((reg) => { reg.downstreams[0].entries[0].file = 'E:/fs-agent/AGENTS.md'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /必须是根内的相对路径名/);
});

test('入口写成 .. 上跳判红：basename 过得去但相对名对位会错', () => {
  const r = structureRun((reg) => { reg.downstreams[0].entries[1].file = 'docs/../CLAUDE.md'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /必须是根内的相对路径名/);
});

test('普查命令只含半截标记串判红：标记串取自登记的标记正则，不是门里写死的字面', () => {
  // 旧判据写死 'target-runtime:start'，这条命令含它、却不含登记里的完整标记串——旧判据会绿。
  const r = structureRun((reg) => { reg.census.command = 'grep -l "target-runtime:start"'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /没有可照抄命令/);
});

test('门脚本源码里不出现登记里的标记串字面（口径只有一处）', () => {
  const body = JSON.parse(readFileSync(realRegistryPath, 'utf8')).block.startMarkerRegex;
  const tokens = body.split(/\s+/u);
  const marker = tokens[tokens.findIndex((t) => t.includes('<!--')) + 1];
  assert.ok(marker && !marker.includes('='), `夹具前提：登记的标记正则要能取出标记串，实为 ${marker}`);
  assert.doesNotMatch(readFileSync(gate, 'utf8'), new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
});

test('登记的标记串取不出时判红，不静默放弃「普查命令可照抄」这项判定', () => {
  const r = structureRun((reg) => { reg.block.startMarkerRegex = '^<marker file=x>'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /取不出标记串/);
});

test('登记去掉开头锚点判红：不锚定的写法会吃住畸形标记行，字段认定就没了', () => {
  const f = diskFixture({ caretlessBody: true });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /必须两端锚定/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('登记写成生成器那条的子串判红（复核查实：只对上子串等于放宽判据）', () => {
  const r = structureRun((reg) => { reg.block.startMarkerRegex = reg.block.startMarkerRegex.replace(/\$$/u, ''); });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /不是生成器里完整的那条正则字面/);
});

test('登记缺命名组判红，而不是盘上档当场崩（崩出去的退码会被误读成判红）', () => {
  const r = structureRun((reg) => { reg.block.startMarkerRegex = reg.block.startMarkerRegex.replace('(?<checksum>', '('); });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /缺命名组 checksum/);
});

test('排除前缀写成相对路径判红（与 root 同一条口径）', () => {
  const r = structureRun((reg) => { reg.excluded[0].pathPrefix = 'fs-agent-worktrees/'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /pathPrefix 必须是绝对路径/);
});

test('排除项不写 mutable 判红：稳定面与易逝面必须分开，闭合等式才知道该算谁', () => {
  const r = structureRun((reg) => { delete reg.excluded[0].mutable; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /缺 mutable/);
});

test('读数里的登记面与登记表自身不符判红（这条不需要盘，CI 上也有牙）', () => {
  const files = structureRun((reg) => { reg.census.readings.face.registered.files = 3; });
  assert.equal(files.code, 1, files.out);
  assert.match(files.out, /face\.registered\.files = 3，而登记表自己写了 8 份入口/);
  const roots = structureRun((reg) => { reg.census.readings.face.registered.roots = 9; });
  assert.equal(roots.code, 1, roots.out);
  assert.match(roots.out, /读数与登记不同代/);
});

test('普查读数自相矛盾判红：候选文件少于带块文件，两个数不是同一次普查来的', () => {
  const r = structureRun((reg) => { reg.census.readings.candidateFiles = 1; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /自相矛盾/);
});

test('普查命令的 -maxdepth 浅于 scan.depth 判红（闭合比的是两个不同大小的面）', () => {
  const shallow = structureRun((reg) => { reg.census.command = reg.census.command.replace('-maxdepth 6', '-maxdepth 2'); });
  assert.equal(shallow.code, 1, shallow.out);
  assert.match(shallow.out, /浅于 scan\.depth/);
  const noDepth = structureRun((reg) => { reg.census.command = reg.census.command.replace('-maxdepth 6 ', ''); });
  assert.equal(noDepth.code, 1, noDepth.out);
  assert.match(noDepth.out, /没有 -maxdepth/);
});

test('带值开关不给值 → exit 2，绝不静默回落到默认包根（那等于查了另一本账还报绿）', () => {
  for (const flag of ['--repo', '--registry']) {
    const r = runGate([flag, '--structure-only']);
    assert.equal(r.code, 2, `${flag}：${r.out}`);
    assert.match(r.out, /后面没有值/);
  }
});

// —— 闭合按稳定面（2026-10-02 复核实测：易逝面半小时从 14 份掉到 12 份，旧等式当场自己变红）——
test('易逝面增减不动闭合：工作副本多一个根，盘上档照样绿（旧设计这里会无缘无故红）', () => {
  const f = diskFixture({ volatileExtra: true });
  try {
    const r = f.run();
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /易逝排除面：2 个／2 个根（普查时 1／1/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('稳定面闭合破裂判红：登记面或夹具面漂了要当场拦住', () => {
  const files = diskFixture({ face: { registered: { files: 5, roots: 1 }, excludedStable: { files: 2, roots: 1 }, excludedVolatile: { files: 1, roots: 1 } } });
  try {
    const r = files.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /稳定面闭合破裂/);
  } finally {
    rmSync(files.dir, { recursive: true, force: true });
  }
  const roots = diskFixture({ face: { registered: { files: 2, roots: 7 }, excludedStable: { files: 2, roots: 1 }, excludedVolatile: { files: 1, roots: 1 } } });
  try {
    const r = roots.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /稳定面根闭合破裂/);
  } finally {
    rmSync(roots.dir, { recursive: true, force: true });
  }
});

test('易逝排除面里出现运行时登记判红：那是活现场，不是工作副本，不能藏在排除面里', () => {
  const f = diskFixture({ volatileRuntimeRegistry: true });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /带着 \.vibe-runtime\.json/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('走树读不动就 exit 2「门没跑成」，不把看不见当成查过（断链目录实测）', () => {
  const f = diskFixture();
  try {
    symlinkSync(join(f.dir, 'no-such-target'), join(f.dir, 'root-a', 'dangling'), process.platform === 'win32' ? 'junction' : 'dir');
    const r = f.run();
    assert.equal(r.code, 2, r.out);
    assert.match(r.out, /扫描不完整/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

// —— 盘上档（合成夹具）——
test('夹具全一致时盘上档绿：证明上面那些红不是夹具根本跑不起来', () => {
  const f = diskFixture();
  try {
    const r = f.run();
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /盘上档（实对 1 根／2 份入口）/);
    assert.match(r.out, /稳定排除面：2 个带块文件／1 个根（进闭合等式）/);
    assert.match(r.out, /易逝排除面：1 个／1 个根（普查时 1／1/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('落后本代只报不判红（刷不刷下游是 owner 的发布决策）', () => {
  const f = diskFixture({ onDiskVersion: '11', registeredVersion: '11', mutateRegistry: null });
  try {
    const r = f.run();
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /落后本代（不判红/);
    assert.match(r.out, /root-a\/AGENTS\.md v11/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('登记过期判红：盘上写着 v12、登记写 v11', () => {
  const f = diskFixture({ registeredVersion: '11' });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /登记 v11，盘上 v12——登记过期/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('版本谎判红：同一版本号、正文哈希与登记不符', () => {
  const f = diskFixture({ registeredChecksum: `sha256:${'f'.repeat(64)}` });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /同一版本号换过内容（版本谎）/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('登记的根在盘上不存在判红（fail-closed，不静默当「没有下游」）', () => {
  const f = diskFixture({ missingRoot: true });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /登记的下游根在盘上不存在/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('登记的入口盘上没有带标记的块判红', () => {
  const f = diskFixture();
  try {
    rmSync(join(f.dir, 'root-a', 'CLAUDE.md'));
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /CLAUDE\.md 盘上没有带标记的块/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('根内冒出未登记的带块入口判红（登记面必须 cover 真实下游面）', () => {
  const f = diskFixture({ extraNested: true, filesWithBlock: 4 });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /未登记的带块入口 docs\/AGENTS\.md/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('一份文件两处起始标记判红', () => {
  const f = diskFixture({ duplicateMarker: true });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /有 2 处起始标记/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('标记里的 file= 与登记入口名不符判红', () => {
  const f = diskFixture({ badMarkerFileField: true });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /file=CLAUDE\.md 与登记入口名不符/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('.vibe-runtime.json 的登记与实际不符判红，且按根只报一条（不按入口份数翻倍）', () => {
  const f = diskFixture();
  try {
    rmSync(join(f.dir, 'root-a', '.vibe-runtime.json'));
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /runtimeRegistry=true，盘上 \.vibe-runtime\.json 不在/);
    // 这个根登记了 2 份入口：旧实现把判据写在入口循环里，同一件事报两遍，读起来像两个问题。
    assert.equal((r.out.match(/runtimeRegistry=true/gu) ?? []).length, 1, `同一件事按入口份数重复报红：\n${r.out}`);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('排除前缀在盘上已不存在判红：排除清单不会自己变干净', () => {
  const f = diskFixture();
  try {
    rmSync(join(f.dir, 'excluded'), { recursive: true, force: true });
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /排除前缀在盘上不存在/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('排除前缀零命中判红（它在排除空气，理由已过期）', () => {
  const f = diskFixture({ excludedHits: 0, filesWithBlock: 2 });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /排除空气/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('排除面里写着高于本代的版本判红：排除不等于免检', () => {
  const f = diskFixture({ excludedVersion: '99' });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /排除不等于免检/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('普查总数读数只作对照、不参与判定：总数写歪也不判红（等式只绑稳定面）', () => {
  // 旧设计拿 filesWithBlock／rootsWithBlock 做等式，而它们含易逝面；2026-10-02 复核实测易逝面
  // 半小时就从 14 份／7 根掉到 12 份／6 根——那种红与本包无关，红多了的门没人信。
  const f = diskFixture({ filesWithBlock: 7, rootsWithBlock: 5 });
  try {
    const r = f.run();
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /普查时 1／1，抓于 2026-10-02/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('本门只读不写：盘上档跑完，真实登记表字节分毫不动', () => {
  const before = createHash('sha256').update(readFileSync(realRegistryPath)).digest('hex');
  const f = diskFixture();
  try {
    f.run();
    runGate(['--repo', repoRoot, '--structure-only']);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
  assert.equal(createHash('sha256').update(readFileSync(realRegistryPath)).digest('hex'), before, '登记门把登记表改写了——账本必须只能由人改');
});

// —— 以下各组是 2026-10-02 两路对抗复核（路 C 打门禁代码本身、路 D 打跨文件数字）点名的分支 ——
// 共同主题有两种：一是「崩出去的退码也是 1，会被读成判红」，二是「某条红没有任何用例钉着」。

test('block.entryFiles 写成字符串判红而不崩溃（类型错要指向登记，不是指向栈）', () => {
  const r = structureRun((reg) => { reg.block.entryFiles = 'AGENTS.md'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /block\.entryFiles 必须是数组/);
  assert.doesNotMatch(r.out, /is not a function/, '抛异常等于把「读不出账」冒充成「查出违规」');
  assert.doesNotMatch(r.out, /≠ 生成器 TARGET_FILES/, '类型错已经判了，拿空清单再报一条不符是把一个因读成两个病');
  // 派生红不止那一条：清单读不出来时，登记里每个入口都会报一条「不在 block.entryFiles 里」（实测 8 条）。
  // 只断言「不多报」而不数总条数会漏掉这种按登记规模放大的噪声，所以这里钉死总条数＝1。
  assert.equal(r.out.split('\n').filter((l) => l.trim().startsWith('✗')).length, 1, `一个类型错报出了多红：\n${r.out}`);
});

test('scan.skipDirs 写成字符串判红而不崩溃', () => {
  const r = structureRun((reg) => { reg.scan.skipDirs = 'node_modules'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /scan\.skipDirs 必须是数组/);
  assert.doesNotMatch(r.out, /is not a function/);
});

test('downstreams 写成对象判红而不崩溃，且不另报一条「空数组」（一件事一条红）', () => {
  const r = structureRun((reg) => { reg.downstreams = { '0': { root: 'E:/x' } }; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /downstreams 必须是数组/);
  assert.doesNotMatch(r.out, /是空数组/, '类型错与真的空清单是两件事，同时报会把人引去改错的地方');
  assert.doesNotMatch(r.out, /读数与登记面分成两代/, '登记面读不出来时，与读数的比对是派生红，不另报');
  assert.doesNotMatch(r.out, /读数与登记不同代/);
  assert.doesNotMatch(r.out, /is not a function/);
});

test('盘上档同样不吃 entryFiles 的类型错（markedFilesOf 里那个漏网点）', () => {
  // 结构档先拦下类型错，但走树的函数自己也读一次这个字段：那处若还写 `?? []`，
  // 盘上档就会在别的调用路径上崩出去。这条夹具直接跑盘上档，钉住它只判红。
  const f = diskFixture({ mutateRegistry: (reg) => { reg.block.entryFiles = 'AGENTS.md'; } });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /block\.entryFiles 必须是数组/);
    assert.doesNotMatch(r.out, /is not a function/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('排除清单删空判红在结构档也有牙（常驻 CI 只跑这一档）', () => {
  // 盘上档能靠闭合等式抓住，但 CI 上没有那几个盘根；只有结构档判它，删空清单才不会换个绿。
  const r = structureRun((reg) => { reg.excluded = []; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /excluded 清单为空，而普查读数写着排除面/);
  assert.doesNotMatch(r.out, /✓/);
});

test('登记根盘上不存在时，摘要不数它、闭合等式也不重复报（一件事一条红）', () => {
  const f = diskFixture({ missingRoot: true });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /实对 0 根/, '「实对」只能数真核对过的根');
    assert.match(r.out, /登记的下游根在盘上不存在/);
    assert.doesNotMatch(r.out, /稳定面根闭合破裂/, '根因已经报了，等式红会把一件事读成三件事');
    assert.match(r.out, /闭合等式本次不另报/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('标记正则缺命名组时盘上档整段不跑（不把「没读」报成「查过」）', () => {
  const f = diskFixture({ grouplessBody: true });
  try {
    const r = f.run();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /登记的标记正则缺命名组/);
    assert.match(r.out, /盘上对账本次未跑/);
    assert.doesNotMatch(r.out, /实对 [1-9]/u, '字段都读不出来，任何「实对 N 根」都是坏判据的产物');
    assert.doesNotMatch(r.out, /TypeError/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('生成器里取不到 TARGET_FILES 判红（此前这条红没有用例）', () => {
  const f = diskFixture({
    generatorSource: `export const TARGET_RUNTIME_BLOCK_VERSION = "${FAKE_VERSION}";\nconst MARKER_RE = /x/u;\n`,
  });
  try {
    const r = f.run(['--structure-only']);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /取不到 TARGET_FILES/);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('runtimeRegistry 写成字符串判红（这条此前也没有用例）', () => {
  const r = structureRun((reg) => { reg.downstreams[0].runtimeRegistry = 'true'; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /runtimeRegistry 必须是布尔/);
});

test('入口写在登记之外判红：block.entryFiles 是入口清单的唯一口径', () => {
  const r = structureRun((reg) => { reg.downstreams[1].entries.push({ file: 'README.md', blockVersion: '27', checksum: `sha256:${HASH_C}` }); });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /不在 block\.entryFiles 里/);
});

test('两条排除前缀互相嵌套判红：命中数会被计两次', () => {
  const r = structureRun((reg) => {
    reg.excluded.push({ pathPrefix: `${reg.excluded[0].pathPrefix}098-sidecar/`, mutable: true, reason: '合成夹具：这条前缀嵌在既有前缀里面，命中数会被重复计。' });
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /与已有前缀 .* 嵌套/u);
});

// —— 路 C 复核查实「判据有牙但从没被用例咬过」的红分支：缺 kind／条目无 file／同根入口重复／前缀重复 ——
test('下游登记缺 kind 判红：这行是谁、凭什么算下游，不许留空', () => {
  const r = structureRun((reg) => { delete reg.downstreams[0].kind; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /缺 kind/);
});

test('入口条目没有 file 字段判红（条目被跳过不等于这条登记合法）', () => {
  const r = structureRun((reg) => { reg.downstreams[0].entries[0] = { blockVersion: '27', checksum: `sha256:${'b'.repeat(64)}` }; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /有条目没有 file/);
});

test('同一根里同一入口重复登记判红：盘上档拿它逐字对位，重复条目会把一份块算成两份', () => {
  const r = structureRun((reg) => { reg.downstreams[0].entries.push({ ...reg.downstreams[0].entries[0] }); });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /重复登记/);
});

test('排除前缀重复登记判红：命中数按前缀累加，两条一样的前缀等于把同一面数两遍', () => {
  const r = structureRun((reg) => { reg.excluded.push({ ...reg.excluded[0] }); });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /前缀重复登记/);
});
