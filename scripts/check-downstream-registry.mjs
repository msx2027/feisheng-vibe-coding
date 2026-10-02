#!/usr/bin/env node
// 下游受管块登记门（provenance/DOWNSTREAMS.json，2026-10-02 owner 拍板「建，按路径登记」）。
//
// 病：本包把 AGENTS.md／CLAUDE.md 里的受管块从 v23 一路改到 v27，每批都要靠一次性磁盘普查才知道
//     「谁装了、装到哪代」，普查读数只活在证据文里。下一次改动又回到零 Known 状态——owner 说的
//     「文档口径漂移」在下游这一侧就是这个形状（docs/HANDOFF-NEXT.md 与 evidence/20261002-runtime-registry-mirror.md §7）。
// 做法：把下游清单登记成机器可读文件，本门读它并把「登记面」钉死成可判定的账：
//   · 结构档（任何平台都跑，verify 5l）：登记文件存在／形状合法／数组字段类型不对一律判红而不崩出去（崩的退码
//     也是 1，会被读成「判红」，而要改的是登记）／非空清单（`downstreams` 空、`excluded` 空而普查读数写着排除面
//     为正，都判红——常驻 CI 只跑这一档，排除面删空不能换绿）／根与排除前缀必须绝对路径、入口必须写成根内相对名／
//     版本方向 vs 生成器常量（且生成器里不许同时存在两份版本口径）／登记里的标记正则必须是生成器那条**完整字面**
//     （子串、去 `^` 锚、缺 file／version／checksum 命名组都判红：放宽形状等于放宽判据，缺组会让盘上档当场崩）／
//     入口文件清单必须逐字出现在生成器源码里（防止两处各存一份口径）／普查命令必须含由该标记正则取出的同一个标记串、
//     其 `-maxdepth` 不得浅于 `scan.depth`／排除项必须写 `mutable`／`census.readings` 三面读数与登记表自身同代且不自我矛盾。
//   · 盘上档（只在下游真在这台机器上的验收跑，verify 可选步 -IncludeDownstreamDisk）：逐根逐入口比对
//     标记行的 version＋checksum、根内未登记的带块文件、排除前缀命中数；闭合只判**稳定面**
//     （登记面 ⊎ git 跟踪的夹具面 == 读数里对应的两面），易逝面（别人的 worktree 分身）只报数不判等，
//     但它里面出现 `.vibe-runtime.json` 就判红（那是活现场，不许藏在排除面里）；
//     目录读不动一律 exit 2「扫描不完整」，登记根不在盘上时闭合等式不另报（一条根因不拆成三件事）。
// 为什么盘上档不做成常驻：CI 是 ubuntu-latest（.github/workflows/release-gate.yml:13），没有 E:/ 与 G:/ 盘根。
//   若让常驻步「盘够不到就当没有下游」，那是本包 2026-10-02 一批门禁正在拆的「空判即绿」；
//   若让它常红，CI 就再也跑不绿。所以拆成两档，且两档各自在步名里写明自己判什么。
// 边界（如实写明，不当成已判）：
//   · 块正文的 checksum 到底等不等于本代渲染结果，由 init-target-runtime.mjs --check／--strict 判；
//     本门只比对「标记行写着什么 vs 登记着什么」。判版本真伪的逻辑不许有第二份。
//   · 落后本代不判红：刷不刷下游是 owner 的发布决策，本门只把「几个根停在第几代」打成读数。
//   · 新下游不会被本门发现——它只认登记面。发现靠 census.command 那条普查（登记着可照抄命令与当次读数），
//     代价登记在 census.cost。
//   · 按绝对路径登记的代价：换机器／改盘符／挪项目后本文件必须同步改，否则盘上档判红。这是刻意的 fail-closed。
//
// 用法：node scripts/check-downstream-registry.mjs [--repo <包根>] [--registry <路径>] [--structure-only]
// 退出码：0 = 已判定的面全部一致；1 = 判红（登记过期、盘上变化、空清单、版本高于本代、闭合破裂）；
//         2 = 门自己没跑成（开关不认识、登记文件缺失、JSON 畸形、生成器读不到）——不是「判过了」。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const argValue = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
const FLAGS = ['--repo', '--registry', '--structure-only'];
for (const item of argv) {
  if (item.startsWith('--') && !FLAGS.includes(item)) {
    console.error(`✗ 未知开关：${item}（本门只接 ${FLAGS.join('／')}）`);
    process.exit(2);
  }
}
// 带值开关没给值：绝不静默回落到默认包根（那会让「--registry 打错一个字母」变成「查了另一本账还报绿」）。
for (const flag of ['--repo', '--registry']) {
  const i = argv.indexOf(flag);
  if (i < 0) continue;
  const value = argv[i + 1];
  if (value === undefined || String(value).startsWith('--')) {
    console.error(`✗ ${flag} 后面没有值（实为 ${value ?? '参数末尾'}）——不回落默认，门没跑成就是 2`);
    process.exit(2);
  }
}
// 用法级失败：一律 exit 2，绝不与「判红」共用退出码。
const failUsage = (messages, hint) => {
  for (const line of messages) console.error(`✗ ${line}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(2);
};

const repo = resolve(argValue('--repo') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const registryPath = resolve(argValue('--registry') ?? join(repo, 'provenance', 'DOWNSTREAMS.json'));
const structureOnly = argv.includes('--structure-only');
const reds = [];
const red = (message) => reds.push(message);
// 登记面里的数组字段：类型错了要判红，不能让 `.map`／`.has` 抛出去。崩溃的退码也是 1，
// 而本门 1 的含义是「查出了违规」——一本读不出来的账会被下一批人当成「门判过红」去修盘上现场，
// 真正要改的却是登记。所以畸形字段一律进 reds，退回码 1 的是「判红」而不是异常。
const asArray = (value, label) => {
  if (Array.isArray(value)) return value;
  red(`${label} 必须是数组，实为 ${value === null ? 'null' : typeof value}——本门不把类型错崩成退码，照着这条改登记`);
  return [];
};

if (!existsSync(registryPath)) {
  failUsage([`下游登记文件不存在：${registryPath}`], '这不是「没有下游」，是账本没了；先建 provenance/DOWNSTREAMS.json。');
}
let reg;
try {
  reg = JSON.parse(readFileSync(registryPath, 'utf8'));
} catch (error) {
  failUsage([`下游登记不是合法 JSON：${registryPath}（${error.message}）`], '判据读不出来，本门不降级为通过。');
}

const generatorPath = join(repo, String(reg?.block?.generator ?? ''));
if (!reg?.block?.generator || !existsSync(generatorPath)) {
  failUsage([`登记里的 block.generator 指不到盘上文件：${reg?.block?.generator ?? '(缺字段)'}`], `解析为 ${generatorPath}`);
}
let generatorSource;
try {
  generatorSource = readFileSync(generatorPath, 'utf8');
} catch (error) {
  failUsage([`生成器源码读不出来：${generatorPath}（${error.message}）`]);
}
let generatorVersion;
try {
  ({ TARGET_RUNTIME_BLOCK_VERSION: generatorVersion } = await import(pathToFileURL(generatorPath).href));
} catch (error) {
  failUsage([`生成器模块导入失败，本代版本号取不到：${error.message}`]);
}
const genVersionInt = Number(generatorVersion);
if (!Number.isInteger(genVersionInt)) failUsage([`生成器 TARGET_RUNTIME_BLOCK_VERSION 不是整数串：${generatorVersion}`]);

// —— 结构档：登记表必须与生成器同源，否则「两处各写一份标记口径」就是新的漂移源 ——
// 同源判据要的是「同一条完整正则」，不是「同一串字符」：写成生成器那条的子串（去掉 ^ $ 或去掉命名组）
// 也是逐字出现，但它匹配得更宽、字段读不出来，盘上档会当场崩——所以子串与缺锚都判红。
// 若生成器将来不再用 /…/ 字面量构造标记，本判据会红并要求重录登记，这是刻意的 fail-closed。
const markerBody = String(reg?.block?.startMarkerRegex ?? '');
if (!markerBody) failUsage(['登记缺 block.startMarkerRegex']);
if (!generatorSource.includes(markerBody)) {
  red('block.startMarkerRegex 未在生成器源码中逐字出现——登记与生成器的标记口径已经分成两份');
} else if (!generatorSource.includes(`/${markerBody}/`)) {
  red('block.startMarkerRegex 不是生成器里完整的那条正则字面（只对上子串等于放宽判据：畸形标记行也会算「对上了」）');
}
if (!/^\^.*\$$/u.test(markerBody)) {
  red('block.startMarkerRegex 必须两端锚定（以 ^ 开头、以 $ 结尾）——不锚定的登记吃得住「标记行后面还有别的东西」，版本与哈希就无从认定');
}
let markerRe;
try {
  markerRe = new RegExp(markerBody, 'u');
} catch (error) {
  failUsage([`登记的标记正则编译失败：${error.message}`]);
}
const MARKER_GROUPS = ['file', 'version', 'checksum'];
// 命名组名单从登记的正则**文本**里取：V8 不在 RegExp 对象上暴露组名（re.groups 是 undefined），
// 想吃匹配结果那个 .groups 只能等真去 match 一行——那时已经晚了，所以在这里按字面扫 (?<name> 声明。
const groupsSeen = [...markerBody.matchAll(/\(\?<([A-Za-z_$][\w$]*)>/gu)].map((m) => m[1]);
const groupsMissing = MARKER_GROUPS.filter((g) => !groupsSeen.includes(g));
if (groupsMissing.length) {
  red(`登记的标记正则缺命名组 ${groupsMissing.join('／')}——盘上档读不出这几个字段，本门不会「读不出就当没这回事」`);
}
// 取标记行字段：匹配失败或取不到命名组一律返回 null，由调用点判红而不是抛异常（抛出去退码是 1，
// 会被读成「判红」，与本门「2 = 门没跑成／1 = 判红」的分工串味）。
const groupsOf = (line) => line.trim().match(markerRe)?.groups ?? null;
const entryFilesList = asArray(reg?.block?.entryFiles, 'block.entryFiles');
// 入口清单的**形状**坏了时，凡是「拿这份清单去比别的东西」的派生判据一律不跑：
// 一份读不出来的清单会让每条入口都报「不在 block.entryFiles 里」，一个因被读成 N＋1 个病（实测 8 个入口＝9 条红）。
// 类型错那条红本身已经把要改的地方指清楚了，多报只会把人引去改盘上现场。
const entryFilesShapeOk = Array.isArray(reg?.block?.entryFiles);
const targetFilesMatch = /const TARGET_FILES = \[([\s\S]*?)\];/u.exec(generatorSource);
if (!targetFilesMatch) {
  red('生成器源码里取不到 TARGET_FILES 数组，入口文件清单无法与真源对账');
} else {
  const truth = [...targetFilesMatch[1].matchAll(/file:\s*"([^"]+)"/gu)].map((m) => m[1]);
  const claimed = entryFilesList.map(String);
  if (claimed.length === 0 && Array.isArray(reg?.block?.entryFiles)) red('登记缺 block.entryFiles（空清单等于放弃判定）');
  if (Array.isArray(reg?.block?.entryFiles) && claimed.join('|') !== truth.join('|')) {
    red(`block.entryFiles 登记 [${claimed.join(', ')}] ≠ 生成器 TARGET_FILES [${truth.join(', ')}]`);
  }
}
const versionConstant = String(reg?.block?.versionConstant ?? '');
if (!versionConstant) failUsage(['登记缺 block.versionConstant']);
const constLineRe = new RegExp(`export const ${versionConstant.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*=\\s*"?(\\d+)"?`, 'u');
const constLineMatch = constLineRe.exec(generatorSource);
if (!constLineMatch) {
  red(`block.versionConstant=${versionConstant} 在生成器源码里找不到「export const ${versionConstant} = <整数>」这一行`);
} else if (Number(constLineMatch[1]) !== genVersionInt) {
  red(`block.versionConstant 指向的源码字面量是 v${constLineMatch[1]}，而导入得到的本代版本是 v${genVersionInt}——生成器里有两份版本口径`);
}

const depth = Number(reg?.scan?.depth);
const skipDirs = new Set(asArray(reg?.scan?.skipDirs, 'scan.skipDirs').map(String));
if (!Number.isInteger(depth) || depth < 1 || depth > 6) red(`scan.depth 必须是 1..6 的整数，实为 ${reg?.scan?.depth}`);
if (skipDirs.size === 0 && Array.isArray(reg?.scan?.skipDirs)) red('scan.skipDirs 为空——盘上档会爬进 node_modules');

const downstreams = asArray(reg?.downstreams, 'downstreams');
if (Array.isArray(reg?.downstreams) && downstreams.length === 0) {
  red('downstreams 是空数组：登记「本包没有任何下游」不是一个可以绿过去的结论');
}
const excluded = asArray(reg?.excluded, 'excluded');
const CHECKSUM_RE = /^sha256:[a-f0-9]{64}$/u;
// 绝对路径判据自己写，不用 path.isAbsolute：登记里是 Windows 盘符路径，而 CI 在 ubuntu 上跑结构档，
// 那边 path.isAbsolute('E:/fs-agent') 返回 false，会把一份好登记判成红——跨平台口径只能固定一种。
const isAbsoluteRoot = (p) => /^[A-Za-z]:[\\/]/u.test(p) || p.startsWith('/') || p.startsWith('\\\\');
const rootsSeen = new Set();
const registeredFiles = new Map(); // root -> Map(entryFile -> {version, checksum})
for (const [i, ds] of downstreams.entries()) {
  const tag = `downstreams[${i}]${ds?.root ? ` ${ds.root}` : ''}`;
  if (typeof ds?.root !== 'string' || !ds.root) { red(`${tag} 缺 root`); continue; }
  if (!isAbsoluteRoot(ds.root)) {
    red(`${tag} 的 root 必须是绝对路径（实为 ${ds.root}）——按路径登记是本门的设计前提，相对路径会随调用方的当前目录换义，同一份登记在两台机器上指两个项目`);
  }
  if (/[\\/]$/u.test(ds.root)) red(`${tag} 根路径不要以 / 结尾（入口相对名会错一位，盘上档会把好登记读成「盘上没有」）`);
  if (rootsSeen.has(ds.root)) red(`${tag} 根路径重复登记`);
  rootsSeen.add(ds.root);
  if (typeof ds.kind !== 'string' || !ds.kind) red(`${tag} 缺 kind（这行是谁、为什么算下游）`);
  if (typeof ds.runtimeRegistry !== 'boolean') red(`${tag} 的 runtimeRegistry 必须是布尔（.vibe-runtime.json 在不在）`);
  const entries = asArray(ds.entries, `${tag} entries`);
  if (Array.isArray(ds.entries) && entries.length === 0) red(`${tag} entries 为空——登记了根却没登记入口文件等于没登记`);
  if (entries.length === 0) continue;
  const perRoot = new Map();
  for (const e of entries) {
    const file = String(e?.file ?? '');
    if (!file) { red(`${tag} 有条目没有 file`); continue; }
    if (file.startsWith('/') || file.startsWith('\\') || /^[A-Za-z]:[\\/]/u.test(file) || file.includes('\\') || file.split('/').includes('..')) {
      red(`${tag} 入口 ${file} 必须是根内的相对路径名（不含 ..、不带反斜杠与盘符、不以 / 开头）——盘上档拿它和扫描出的相对名逐字对位，这里加料等于让登记的入口永远「盘上没有」`);
    }
    if (perRoot.has(file)) red(`${tag} 入口 ${file} 重复登记`);
    if (entryFilesShapeOk && !entryFilesList.map(String).includes(basename(file))) {
      red(`${tag} 入口 ${file} 不在 block.entryFiles 里`);
    }
    if (!/^\d+$/u.test(String(e?.blockVersion ?? ''))) red(`${tag} ${file} 的 blockVersion 不是整数串：${e?.blockVersion}`);
    if (!CHECKSUM_RE.test(String(e?.checksum ?? ''))) red(`${tag} ${file} 的 checksum 不是 sha256:<64 hex>：${e?.checksum}`);
    perRoot.set(file, e);
    const v = Number(e?.blockVersion);
    if (Number.isInteger(v) && v > genVersionInt) {
      red(`${tag} ${file} 盘上/登记版本 v${v} 高于本生成器 v${genVersionInt}——本包副本陈旧，正是「旧代工具对着新下游回写旧文本」那类事故的另一半`);
    }
  }
  registeredFiles.set(ds.root, perRoot);
  for (const ex of excluded) {
    const prefix = String(ex?.pathPrefix ?? '');
    if (prefix && ds.root.startsWith(prefix)) red(`登记的根 ${ds.root} 落在排除前缀 ${prefix} 里——同一件事两条口径`);
  }
}
const prefixesSeen = new Set();
for (const [i, ex] of excluded.entries()) {
  const prefix = String(ex?.pathPrefix ?? '');
  const tag = `excluded[${i}]${prefix ? ` ${prefix}` : ''}`;
  if (!prefix) { red(`${tag} 缺 pathPrefix`); continue; }
  if (!prefix.endsWith('/')) red(`${tag} 前缀必须以 / 结尾（否则 E:/x 会连 E:/xy 一起排除）`);
  if (prefixesSeen.has(prefix)) red(`${tag} 前缀重复登记`);
  prefixesSeen.add(prefix);
  for (const other of prefixesSeen) {
    if (other !== prefix && (prefix.startsWith(other) || other.startsWith(prefix))) red(`${tag} 与已有前缀 ${other} 嵌套，命中数会重复计`);
  }
  if (typeof ex.reason !== 'string' || ex.reason.trim().length < 20) red(`${tag} 缺「凭什么不算下游」的理由（exclusion 不是垃圾桶）`);
  if (typeof ex.mutable !== 'boolean') red(`${tag} 缺 mutable 布尔：这一面会不会随别人的日常动作增减，决定了它进不进闭合账（worktree 分身会，git 跟踪的夹具不会）`);
  if (!isAbsoluteRoot(prefix)) red(`${tag} 的 pathPrefix 必须是绝对路径（实为 ${prefix}）——相对前缀会随调用目录换义，「排除空气」和「误排除真下游」两种错都判不出来`);
}
const readings = reg?.census?.readings ?? {};
for (const key of ['candidateFiles', 'filesWithBlock', 'rootsWithBlock']) {
  if (!Number.isInteger(readings[key]) || readings[key] < 0) red(`census.readings.${key} 必须是普查实得的非负整数，实为 ${readings[key]}`);
}
if (Number.isInteger(readings.candidateFiles) && Number.isInteger(readings.filesWithBlock) && readings.candidateFiles < readings.filesWithBlock) {
  red(`census.readings 自相矛盾：候选文件 ${readings.candidateFiles} 少于带块文件 ${readings.filesWithBlock}——带块的必然是候选，两个数不是同一次普查来的`);
}
// 闭合账拆成三面：登记面与稳定排除面（git 跟踪，不会自己变）参与判等；易逝排除面（别人的工作副本，
// 随开随关）只报数不判等。原先拿 28／14 这种含易逝面的总数做等式，本门会因无关的 git 动作自己变红——
// 红太多次的门没人信，等于没有门。代价见 census.cost。
const face = readings.face ?? {};
const registeredEntryCount = downstreams.reduce((n, ds) => n + (Array.isArray(ds?.entries) ? ds.entries.length : 0), 0);
for (const key of ['registered', 'excludedStable', 'excludedVolatile']) {
  for (const sub of ['files', 'roots']) {
    if (!Number.isInteger(face[key]?.[sub]) || face[key][sub] < 0) {
      red(`census.readings.face.${key}.${sub} 必须是普查实得的非负整数，实为 ${face[key]?.[sub]}`);
    }
  }
}
// 下面两条是**派生**判据：拿读数与登记面自己算出来的数比。来源字段已经因类型畸形判过红的，
// 这里算出来的数必然跟着失真，再报一条就是把一个因读成两个病（本包「同一事实一条红」的规矩，
// 与 §11 里「一个根不存在别报三条红」同一条）。所以只在来源确实是数组时才判。
if (Array.isArray(reg?.downstreams) && Number.isInteger(face.registered?.files) && face.registered.files !== registeredEntryCount) {
  red(`census.readings.face.registered.files = ${face.registered.files}，而登记表自己写了 ${registeredEntryCount} 份入口——读数与登记面分成两代，先重跑普查再改读数`);
}
if (Array.isArray(reg?.downstreams) && Number.isInteger(face.registered?.roots) && face.registered.roots !== downstreams.length) {
  red(`census.readings.face.registered.roots = ${face.registered.roots}，而登记表登记了 ${downstreams.length} 个根——同上，读数与登记不同代`);
}
// 排除面在结构档也要有牙：`downstreams` 删空有上面那条红，`excluded` 删空此前一声不响退 0，
// 而常驻 CI 只跑结构档——「把排除清单清空」在 CI 上就是一个绿。盘上档虽然能靠闭合抓住，
// 但那是另一台机器上的另一档，不能拿它给 CI 担保（同一件事两条口径的另一形）。
if (Array.isArray(reg?.excluded) && excluded.length === 0
  && ((Number(face.excludedStable?.files) || 0) > 0 || (Number(face.excludedVolatile?.files) || 0) > 0)) {
  red(`excluded 清单为空，而普查读数写着排除面稳定 ${face.excludedStable?.files} 份／易逝 ${face.excludedVolatile?.files} 份——排除面不会自己从盘上消失：删空清单等于把这些块从账上抹掉，要么恢复登记要么重跑 census.command 再改读数`);
}
const markerReFrom = (body) => /^\^?\s*<!--\s+(\S+)/u.exec(String(body ?? ''))?.[1] ?? '';
const censusMarker = markerReFrom(markerBody);
if (!censusMarker) {
  red('block.startMarkerRegex 里取不出标记串（要以 `<!-- <marker> …` 开头）——「普查命令可照抄」这项判据无从判定');
} else if (typeof reg?.census?.command !== 'string' || !reg.census.command.includes(censusMarker)) {
  red(`census.command 缺失或不含登记里的标记串 ${censusMarker}——新下游的发现动作没有可照抄命令，就等于没有`);
}

// 普查命令与门内扫描必须是一个口径：命令浅于 scan.depth 时，闭合比的是「门看见的小面」与「普查的大面」。
const censusCommand = typeof reg?.census?.command === 'string' ? reg.census.command : '';
const maxDepthMatch = /-maxdepth\s+(\d+)/u.exec(censusCommand);
if (!maxDepthMatch) {
  red('census.command 里没有 -maxdepth：普查范围与 scan.depth 是两份没人对账的口径');
} else if (Number.isInteger(depth) && Number(maxDepthMatch[1]) < depth) {
  red(`census.command 的 -maxdepth ${maxDepthMatch[1]} 浅于 scan.depth ${depth}——门会扫到普查从没扫过的深度，闭合等式两边的面不是同一个`);
}

// —— 盘上档 ——
// 走树的每一条失败都必须留下痕迹：目录读不动就整段放弃（原先的 break）等于「漏检且不说」。
const unreadable = [];
const markedFilesOf = (dir, maxDepth) => {
  const names = new Set(entryFilesList.map(String));
  const hits = [];
  const stack = [[dir, 0]];
  while (stack.length) {
    const [current, d] = stack.pop();
    let items;
    try {
      items = readdirSync(current, { withFileTypes: true });
    } catch (error) {
      unreadable.push(`${current}（${error.code ?? error.message}）`);
      continue;
    }
    for (const item of items) {
      const full = join(current, item.name);
      let isDir = item.isDirectory();
      let isFile = item.isFile();
      if (item.isSymbolicLink()) {
        try {
          const st = statSync(full);
          isDir = st.isDirectory();
          isFile = st.isFile();
        } catch (error) {
          unreadable.push(`${full}（链接指向不存在的东西：${error.code ?? error.message}）`);
          continue;
        }
      }
      if (isDir) {
        if (d + 1 < maxDepth && !skipDirs.has(item.name)) stack.push([full, d + 1]);
      } else if (isFile && names.has(item.name)) {
        let text;
        try {
          text = readFileSync(full, 'utf8');
        } catch (error) {
          unreadable.push(`${full}（读不出：${error.code ?? error.message}）`);
          continue;
        }
        const lines = text.split(/\r?\n/u).filter((line) => markerRe.test(line.trim()));
        if (lines.length) hits.push({ full, rel: relative(dir, full).split(sep).join('/'), lines });
      }
    }
  }
  return hits;
};

let diskRoots = 0;
let diskFiles = 0;
let missingRootCount = 0;
let stableExcludedFiles = 0;
let stableExcludedRoots = 0;
let volatileExcludedFiles = 0;
let volatileExcludedRoots = 0;
const behindReport = [];
// 标记正则取不出命名组时，盘上档一个字段都读不出来：这时再跑对账，跑出来的每条「盘上没有」都是
// 坏判据的产物。所以整段不跑，只报一条「本次未跑」的红——不拿「没读」当「查过」。
if (!structureOnly && groupsMissing.length) {
  red(`盘上对账本次未跑：登记的标记正则缺命名组 ${groupsMissing.join('／')}，字段读不出来就别把「没读」报成「查过」——先修上面那条同源判红再跑盘上档`);
}
if (!structureOnly && !groupsMissing.length) {
  for (const ds of downstreams) {
    if (!registeredFiles.has(ds.root)) continue;
    if (!existsSync(ds.root)) { red(`登记的下游根在盘上不存在：${ds.root}（挪项目／改机就要同步改登记，本门不放过「看不见」）`); missingRootCount++; continue; }
    // 「实对 N 根」只能数真核对过的根。原先自增在存在性判断之前，一个盘上根本不存在、
    // 一份入口都没读的根会被写进摘要里；总伴随一条红不会假绿，但读数本身是谎的。
    diskRoots++;
    // 每根一条：这个字段判的是根，不是入口。放在入口循环里会让同一件事按入口份数重复报红，
    // 读的人会把「两条一样的红」当成两个问题。
    if (typeof ds.runtimeRegistry === 'boolean') {
      const hasRegistry = existsSync(join(ds.root, '.vibe-runtime.json'));
      if (hasRegistry !== ds.runtimeRegistry) red(`${ds.root} 登记 runtimeRegistry=${ds.runtimeRegistry}，盘上 .vibe-runtime.json ${hasRegistry ? '在' : '不在'}`);
    }
    const hits = markedFilesOf(ds.root, depth);
    const hitByRel = new Map(hits.map((h) => [h.rel, h]));
    for (const [file, e] of registeredFiles.get(ds.root)) {
      const hit = hitByRel.get(file);
      if (!hit) {
        red(`${ds.root} 登记的入口 ${file} 盘上没有带标记的块（被删了？挪了？还是本来就漏刷）`);
        continue;
      }
      diskFiles++;
      if (hit.lines.length > 1) red(`${ds.root}/${file} 有 ${hit.lines.length} 处起始标记——一份文件两个块，版本无从谈起`);
      const groups = groupsOf(hit.lines[0]);
      if (!groups) { red(`${ds.root}/${file} 的标记行匹配后取不到命名组，本门不猜字段`); continue; }
      if (groups.file !== basename(file)) red(`${ds.root}/${file} 标记里 file=${groups.file} 与登记入口名不符`);
      if (groups.version !== String(e.blockVersion)) red(`${ds.root}/${file} 登记 v${e.blockVersion}，盘上 v${groups.version}——登记过期`);
      else if (`sha256:${groups.checksum}` !== e.checksum) red(`${ds.root}/${file} v${groups.version} 的正文哈希与登记不符——同一版本号换过内容（版本谎）`);
      else if (Number(groups.version) < genVersionInt) behindReport.push(`${basename(ds.root)}/${file} v${groups.version}`);
    }
    for (const hit of hitByRel.keys()) {
      if (!registeredFiles.get(ds.root).has(hit)) red(`${ds.root} 根内出现未登记的带块入口 ${hit}——登记面小于真实下游面`);
    }
  }
  for (const ex of excluded) {
    const prefix = String(ex?.pathPrefix ?? '');
    if (!prefix || !existsSync(prefix)) { red(`排除前缀在盘上不存在：${prefix || '(缺字段)'}——排除清单不会自己变干净，删掉这条或改路径`); continue; }
    const hits = markedFilesOf(prefix, depth);
    const roots = new Set(hits.map((h) => dirname(h.rel))).size;
    if (ex.mutable === true) {
      volatileExcludedFiles += hits.length;
      volatileExcludedRoots += roots;
    } else {
      stableExcludedFiles += hits.length;
      stableExcludedRoots += roots;
      if (hits.length === 0) red(`排除前缀 ${prefix} 一个带块文件都没命中——它在排除空气，理由已经过期`);
    }
    for (const hit of hits) {
      const groups = groupsOf(hit.lines[0]);
      if (!groups) { red(`排除面里的 ${hit.full} 标记行取不到命名组，本门不猜字段`); continue; }
      if (Number(groups.version) > genVersionInt) red(`排除面里的 ${prefix}${hit.rel} 写着 v${groups.version}，高于本生成器 v${genVersionInt}——排除不等于免检，版本谎照样是谎`);
      // 易逝面（工作副本）里只要出现运行时登记，它就不是「另一份检出」而是「一个活现场」：
      // 要么登记成真下游，要么改排除理由。不判这一条，排除面会变成藏下游的地方。
      if (ex.mutable === true && existsSync(join(dirname(hit.full), '.vibe-runtime.json'))) {
        red(`易逝排除面 ${dirname(hit.rel)}（在 ${prefix} 下）带着 .vibe-runtime.json——这是活现场的形态，不是工作副本：登记它，或改这条排除的理由`);
      }
    }
  }
  const stableExpectFiles = Number.isInteger(face.registered?.files) && Number.isInteger(face.excludedStable?.files)
    ? face.registered.files + face.excludedStable.files : null;
  const stableExpectRoots = Number.isInteger(face.registered?.roots) && Number.isInteger(face.excludedStable?.roots)
    ? face.registered.roots + face.excludedStable.roots : null;
  if (missingRootCount === 0) {
    if (stableExpectFiles !== null && diskFiles + stableExcludedFiles !== stableExpectFiles) {
      red(`稳定面闭合破裂：盘上登记 ${diskFiles} ＋ 稳定排除 ${stableExcludedFiles} ≠ 普查读数 ${face.registered.files} ＋ ${face.excludedStable.files} = ${stableExpectFiles}——要么下游面漂了，要么读数该重跑`);
    }
    if (stableExpectRoots !== null && diskRoots + stableExcludedRoots !== stableExpectRoots) {
      red(`稳定面根闭合破裂：盘上 ${diskRoots} ＋ 稳定排除 ${stableExcludedRoots} ≠ 读数 ${stableExpectRoots}`);
    }
  } else {
    // 根不在盘上时，上面那条「根不存在」就是根因；再补两条等式红会把一件事读成三件事
    // （本文件对 runtimeRegistry 那条也写过同一条理由）。不判是刻意的，且这条说明会打出来。
    console.log(`  闭合等式本次不另报：${missingRootCount} 个登记根盘上不存在，先修那一条`);
  }
  if (unreadable.length) {
    failUsage([`扫描不完整：${unreadable.length} 处目录／文件读不出来，前几条：${unreadable.slice(0, 3).join('；')}`], '本门不把「看不见」算作「查过了」——补齐盘上现场或把路径改登记，再跑。');
  }
}

const mode = structureOnly ? '结构档（未做盘上对账，CI 无 /e／f／g 盘根）' : `盘上档（实对 ${diskRoots} 根／${diskFiles} 份入口）`;
console.log(`下游登记：登记 ${downstreams.length} 根、排除前缀 ${excluded.length} 个，生成器 v${genVersionInt}，本次=${mode}`);
if (behindReport.length) console.log(`  落后本代（不判红，刷不刷归 owner 定）：${behindReport.join('、')}`);
if (!structureOnly && excluded.length) {
  const volatileNote = volatileExcludedFiles === 0 ? '（工作副本这次一个都没有——它不参与闭合，缩到零不改账）' : '';
  console.log(`  稳定排除面：${stableExcludedFiles} 个带块文件／${stableExcludedRoots} 个根（进闭合等式）；易逝排除面：${volatileExcludedFiles} 个／${volatileExcludedRoots} 个根${volatileNote}（普查时 ${face.excludedVolatile?.files ?? '?'}／${face.excludedVolatile?.roots ?? '?'}，抓于 ${reg?.census?.capturedAt ?? '?'}）`);
}
if (reds.length) {
  for (const line of reds) console.error(`✗ ${line}`);
  console.error(`共 ${reds.length} 条判红（登记面与盘上／生成器不一致，一律先改账或收口，不用豁免换绿：本门没有基线）`);
  process.exit(1);
}
console.log(`✓ 下游登记与${structureOnly ? '生成器' : '生成器及盘上标记行'}一致：${downstreams.length} 根全部核对`);
