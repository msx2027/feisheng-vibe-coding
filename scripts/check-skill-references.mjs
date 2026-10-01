#!/usr/bin/env node
// 技能正文死引用检查器（可移植，零依赖）。
//
// 病：技能正文教模型「去运行某个脚本」，而那个脚本在本包里根本不存在——执行者要么当场扑空，
//     要么静默跳过整个收口步骤。这类偏差发生在指令层而非路径层，门禁看不见就只会一代代传下去。
//     本检查器是「口径账本」管不到的另一类漂移：账本钉的是同一事实的多副本，这里钉的是指令与其
//     指向的实体之间的一致性。
//
// 三条判定（error 级，命中即非零）：
//   R1 显式包内引用：以**包根占位符**起头的 token（`<skills仓库>/tools/foo.mjs`、
//      `<skills-root>/tools/foo.mjs` 等，见 PKG_PREFIX），其包内路径必须真实存在。
//      `<目标项目根>/…` 这类非包根占位符前缀不判——那是目标项目自己的文件。
//      「真实存在」还不得算进不下发的面：路 A 复核实测 `<skills-root>/sources/…` 只查 existsSync
//      时命中 0，等于把「快照里有」当「本包有」，与本文件头注那条边界矛盾（现同 R6 判红）。
//   R2 依赖声明：SKILL.md 的 [DocMap] 依赖块里以 `tools/` 或 `scripts/` 起头的条目，
//      必须在本包存在（依赖块是「本技能要用什么」的自述，指不出实体就是假依赖）。
//   R3 裸脚本名：正文里出现 `foo.mjs` / `foo.ps1` / `foo.sh` / `foo.py` / `foo.cjs` 这类不带目录
//      的脚本名，且本包可执行面内没有任何同名文件——即指令指向一个不存在的工具。
//   R4 包内路径字面量：任何以 `skills/` 起头的路径（含 `.md`／`.json`／`.yaml` 这类非脚本目标，
//      2026-10-01 前是盲区）必须**按字面**在本包存在。写法缺分类目录（`skills/brand/…` 而真身在
//      `skills/ui/brand/…`）同样判红——命令照抄就是打不开，与「文件其实存在」无关。
//      目录声明（`skills/brand/data/`、`skills/ui-styling/canvas-fonts` 这类无扩展名目标）同判：
//      2026-10-01 实测两处扁平目录路径正因「必须带扩展名」这条从 R4 眼下漏过，报了残留 0。
//      左边界必须是真分界，所以 `.vibe-coding-skills/vibe-hooks/`、快照路径与外链里的
//      `…/skills/tree/…` 都不算本包声明（这三条是复算时真出现过的伪影）。
//   R5 裸技能名路径：`<技能基名>/SKILL.md`、`<技能基名>/references/…` 这类省略了 `skills/<分类>/`
//      的写法。只认技能目录里真实存在的那类子路径名（见 INNER_SHAPES），避免把目标项目产物
//      （如 `design-system/MASTER.md`）当成本包路径。
//   R6 占位符路径：路径里含 `<…>` 占位段时，把占位段当单层
//      通配展开，必须至少有一个真实落点；展开的首段或命中名不得落在不下发的面（`sources/**` 快照、
//      `.qoder`、`node_modules` 等，见 SKIP_DIRS）——那条路径盘上存在但不在 bundle 里，照抄必打不开。
//      判据来源是受管块 2026-10-02 实测的两条谎报
//      （`<skills-root>/.agents/skills/<skill>/SKILL.md`、`<skills-root>/skills/<skill>/SKILL.md`）：
//      占位段会打断 R1／R4 的 token 正则，扁平旧写法在两条判据下都是 0 命中——「自己扫自己」的门
//      若看不见本门要防的那类病，就只是把谎报换个地方藏起来。本条对**所有面**生效（盘上正文实测
//      162 个文件 0 命中，无存量要盘查；路 A 复核后由「只判虚拟面」扩到全量面）。
//      面判定（R1 与 R6 共用 `skipFace`）先解析再比首段：丢 `.`、按 `..` 回退、比小写。
//      路 B 复核实测过只比字面首段的四种放行写法——`./sources/…`、`skills/../sources/…`、
//      `tools/../sources/…`、`SOURCES/…`（Windows 大小写不敏感时后者真能打开，故更危险）。
//
// 虚拟面（--virtual-md / --virtual-only）：下发件（受管块、脚手架模板）的真身在生成器里，
//   只有落到目标仓库才有文件名，故本包的棘轮此前看不见注入后果。--virtual-md 给一份盘外内容
//   起一个面名（`--virtual-md <面名> <内容文件>`，可重复），它与真实正文过同一套判据；
//   --virtual-only 表示本次只扫虚拟面、不扫盘上面。虚拟面的命中按面名进基线键。
//
// 覆盖边界（有意不报的形态，别把它们当成已通过）：
//   · 带目录前缀但非 `<skills仓库>/`、也非 `skills/` 的引用（如 `tools/check-ui-reuse.mjs`、
//     `./tools/x.sh`、`docs/x.md`）按口径视为**目标项目自己的**工具与文档，本包不拥有也不该拥有，
//     故不判死引；这类放行每次计数并打印（地面外 N 次），不做静默放宽。
//   · 段名含中文的路径一律算目标项目命名面（本包文档惯用 `docs/项目治理/开发计划.md` 这类中文名），
//     与 §4e 定的「排除中文」边界一致。
//   · `.toml`／`.txt`／`.csv` 仍是盲区（未纳入 DOC 面扩展名集合）；无扩展名引用只有以 `skills/`
//     起头的那一类已按目录形态判（见 R4），其它前缀的无扩展名写法仍不判。
//   · `sources/**` 是保真快照，只读、不可执行、永不下发，故其内的同名脚本**不计入**可执行面：
//     快照里有 ≠ 本包有。这正是本检查器要抓的那种偏差。
//
// 存量与新增分治（棘轮，沿本包密钥基线同款设计）：命中若已在
//   scripts/skill-reference-baseline.json 登记（file+token+rule 三键），只计数不阻断；
//   未登记的新一律 error 阻断。**登记了但实际已不存在＝登记过期，同样 error**——基线不许变成
//   永久免检牌，每条必须在收口后被删掉。
//   「登记过期」只在**该条所属扫描面本次真被扫到时**才判（2026-10-02 加虚拟面时的必要约束）：
//   限定扫描面或只扫虚拟面时，把别面的登记报成过期会让门禁读数取决于「这次扫了谁」，
//   技能正文登记一条存量就会把下发件自扫门打假红。判据是「路径属于当前扫描面」而非「文件还在」，
//   所以删掉正文文件仍会报过期——收口了却忘了删登记，照样响。
//
// 用法：node scripts/check-skill-references.mjs [--root <项目根>] [--scope <相对目录>]
//   [--virtual-md <面名> <内容文件>] [--virtual-only]
//   默认扫描 skills/**/*.md 与根 SKILL.md；--scope 可换扫描面（测试夹具用）。
//   --virtual-only 时 --scope 与根 SKILL.md 都不参与，只判 --virtual-md 给出的内容。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 宿主命令与包管理器可执行文件不是「本包工具」，永不判死引。
const SYSTEM_COMMANDS = new Set([
  'node', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'git', 'python', 'python3', 'pip', 'pip3',
  'curl', 'wget', 'docker', 'make', 'cargo', 'pwsh', 'powershell', 'bash', 'sh', 'cmd',
]);

const selfDir = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const argValue = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
const root = resolve(argValue('--root') ?? resolve(selfDir, '..'));
const scopes = (argValue('--scope') ?? 'skills').split(',').map((s) => s.trim()).filter(Boolean);
const includeRootSkill = !argValue('--scope');

// 虚拟面：--virtual-md <面名> <内容文件>，可重复；--virtual-only 表示只扫虚拟面。
// 面名就是命中报告与基线键里的 file，所以必须稳定、可读、不与盘上路径撞名。
const virtualSpecs = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] !== '--virtual-md') continue;
  const [label, contentPath] = [argv[i + 1], argv[i + 2]];
  if (!label || !contentPath || label.startsWith('--')) {
    console.error('✗ --virtual-md 需要两个参数：--virtual-md <面名> <内容文件>（缺一个就判用法错误，不静默跳过）');
    process.exit(2);
  }
  virtualSpecs.push({ label, path: resolve(contentPath) });
  i += 2;
}
const virtualOnly = argv.includes('--virtual-only');
if (virtualOnly && virtualSpecs.length === 0) {
  console.error('✗ --virtual-only 必须与至少一个 --virtual-md 同时给（否则本次没有任何扫描面，空跑不算通过）');
  process.exit(2);
}

const EXTS = 'mjs|cjs|ps1|sh|py|cmd';
const DOC_EXTS = 'md|json|yaml';
// 主扫描面：脚本与文档扩展名都要收（`<skills仓库>/…` 占位符指的是文档还是脚本，正文分不出来，
// 只收脚本就会漏掉占位符指向 `.md` 的那批——2026-10-01 实测正是如此）。
// 目录前缀可反复，允许 <skills仓库> 这类含尖括号的段与中文段名。
const ANY_TOKEN = new RegExp(`(?:<[^>]+>/)?(?:[\\w.\\-\\u4e00-\\u9fff]+/)*[\\w.\\-\\u4e00-\\u9fff]+\\.(?:${EXTS}|${DOC_EXTS})\\b`, 'g');
const isScriptExt = (t) => /\.(?:mjs|cjs|ps1|sh|py|cmd)$/.test(t);
// R4/R5 面：段名**不含**中文（中文段属目标项目命名面，见头注），扩展名同时覆盖脚本与文档目标。
const PKG_PATH_TOKEN = new RegExp(`(?:[\\w.\\-]+/)+[\\w.\\-]+\\.(?:${EXTS}|${DOC_EXTS})\\b`, 'g');
// 目录形态（无扩展名目标）：至少两段，段名不含中文；是否属本包由扫描处的「首段必须是 skills」收。
const PKG_DIR_TOKEN = /(?:[\w.\-]+\/)+[\w.\-]+/g;
// R6 面：允许 `<…>` 占位段的整条路径；至少两段，否则一个裸占位符（`<理由>`）也会被卷进来。
const PLACEHOLDER_PATH_TOKEN =
  /(?:<[^>]+>|[\w.\-\u4e00-\u9fff]+)\/(?:(?:<[^>]+>|[\w.\-\u4e00-\u9fff]+)\/?)+/g;
// 把一个路径段编译成匹配器：`<…>` 段整体或片段都退化为单层通配（`docs/<主题>.md` 也要能展开）。
function segmentMatcher(segment) {
  let pattern = '';
  let wildcard = false;
  for (const part of segment.split(/(<[^>]*>)/)) {
    if (!part) continue;
    if (/^<[^>]*>$/.test(part)) {
      pattern += '[^/]*';
      wildcard = true;
    } else {
      pattern += part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return { re: new RegExp(`^${pattern}$`), wildcard };
}

// `.qoder` 是子代理 worktree 的落点：里面是整棵仓库的临时副本（含 skills/**.md 与一个名为 `.git`
// 的指针文件）。不跳它，同一个包会在「有子代理在跑」和「没在跑」两种时刻报出不同的扫描数与
// 可执行面基数，且副本里的正文会被当成本包正文判——门禁读数必须与自己正在查的内容无关。
const SKIP_DIRS = new Set(['.git', 'node_modules', 'sources', '__pycache__', '.venv', 'venv', 'dist', 'build', '.qoder']);
// 「盘上存在」不等于「本包下发」：保真快照与依赖／构建目录都在扫描面之外，指进它们的路径照抄必打不开。
const SKIP_FACE_NOTE = '首段落在不下发的面（保真快照／依赖与构建目录），盘上存在也不构成本包落点';
// 面判定要先解析（路 B 复核 2026-10-02 查出的绕过面）：只按字面 `split('/')[0]` 判时，
// `./sources/…`、`skills/../sources/…`、`tools/../sources/…` 首段都是别的目录，`SOURCES/…` 在
// Windows（大小写不敏感）上又能真打开——四种写法落的是同一个不下发的面，却全部放行。
// 这里只做「解析等价」这一件事：丢掉 `.`、按 `..` 回退，再比首段（SKIP_DIRS 全小写，故 lower）。
// 通配段（`<技能>`）不是目录名，不参与折叠判定；它落在不下发的面由展开时的逐项过滤兜住。
const skipFace = (pathLike) => {
  const folded = [];
  for (const seg of String(pathLike).split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') folded.pop();
    else folded.push(seg);
  }
  return folded.length > 0 && SKIP_DIRS.has(folded[0].toLowerCase());
};

function walk(relDir, out) {
  let items;
  try {
    items = readdirSync(join(root, relDir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const it of items) {
    const r = relDir ? `${relDir}/${it.name}` : it.name;
    if (it.isDirectory()) {
      if (SKIP_DIRS.has(it.name)) continue;
      walk(r, out);
    } else if (statSync(join(root, r)).isFile()) {
      out.push(r);
    }
  }
  return out;
}

// 可执行面：本包内（不含保真快照）所有文件的基名。快照里有不算有。
const execBasenames = new Set(walk('', []).map((f) => basename(f)));

// 本包结构面（R4/R5 判据）：分类目录名与技能基名都从盘上现取，不写死清单——
// 新增技能不需要改检查器，改检查器也不需要重录技能清单。
const skillRoot = join(root, 'skills');
const CATS = new Set();
const SKILL_NAMES = new Set();
if (existsSync(skillRoot)) {
  for (const c of readdirSync(skillRoot)) {
    if (SKIP_DIRS.has(c) || !statSync(join(skillRoot, c)).isDirectory()) continue;
    CATS.add(c);
    for (const s of readdirSync(join(skillRoot, c))) {
      if (SKIP_DIRS.has(s) || !statSync(join(skillRoot, c, s)).isDirectory()) continue;
      SKILL_NAMES.add(s);
    }
  }
}
// 刻意收窄：只有跟着这些子路径名的裸技能写法才算「声明本包路径」。动态取全部子项名会把
// 目标项目产物（`design-system/MASTER.md` 这类与技能基名撞名的写法）误判成本包死引。
const INNER_SHAPES = new Set(['SKILL.md', 'RUNTIME-NOTES.md', 'references', 'templates', 'scripts', 'tools', 'agents']);

// 缺分类前缀的写法给出唯一解：正文补上即可，报红时不必让人自己去猜。
function suggestFix(token) {
  const norm = token.replace(/^\.\//, '');
  const rest = norm.startsWith('skills/') ? norm.slice('skills/'.length) : norm;
  const hits = [...CATS].filter((c) => existsSync(join(root, 'skills', c, rest)));
  return hits.length === 1 ? `skills/${hits[0]}/${rest}` : null;
}

const scannedFiles = [];
if (!virtualOnly) {
  for (const s of scopes) {
    if (!existsSync(join(root, s))) continue;
    if (statSync(join(root, s)).isFile()) {
      scannedFiles.push(s);
      continue;
    }
    for (const f of walk(s, [])) if (f.endsWith('.md')) scannedFiles.push(f);
  }
  if (includeRootSkill && existsSync(join(root, 'SKILL.md'))) scannedFiles.push('SKILL.md');
}
// 虚拟面：正文来自盘外（生成器渲染结果），面名参与命中定位与基线键；内容缺失一律 fail-closed。
const virtualTexts = new Map();
for (const v of virtualSpecs) {
  if (scannedFiles.includes(v.label)) {
    console.error(`✗ --virtual-md 面名与扫描面内的真实文件重名：${v.label}（换一个可区分的面名）`);
    process.exit(2);
  }
  if (!existsSync(v.path)) {
    console.error(`✗ --virtual-md 内容文件不存在：${v.path}（面 ${v.label}）`);
    process.exit(2);
  }
  virtualTexts.set(v.label, readFileSync(v.path, 'utf8'));
  scannedFiles.push(v.label);
}

// 包根占位符白名单：只有这几种写法声明的是「本包自己」的路径，必须真实存在。
// 其余 `<...>/` 前缀（如 `<目标项目根>/tools/x.mjs`）按口径属于目标项目 surface，不判死引——
// 把目标项目路径当包内路径查会整批误报，门禁一红就没人再信它。
const PKG_PREFIX = /^<(?:skills仓库|skills 仓库|skills-root|skillsRoot|本包|包根|package)>\/(.+)$/;
const ANY_PREFIX = /^<[^>]+>\//;

const errors = [];
const hits = [];
const seenKeys = new Set();
let externalRefs = 0;
for (const fileRel of scannedFiles) {
  const isVirtual = virtualTexts.has(fileRel);
  const text = isVirtual ? virtualTexts.get(fileRel) : readFileSync(join(root, fileRel), 'utf8');
  const lines = text.split(/\r?\n/);
  let inDepBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // [DocMap] 依赖块：自「依赖：」起，到下一个中文字段标签止。
    if (/^\s*依赖：\s*$/.test(line)) { inDepBlock = true; continue; }
    if (inDepBlock && /^\s*(输出|层级|模块|任务)：/.test(line)) inDepBlock = false;

    let m;
    ANY_TOKEN.lastIndex = 0;
    while ((m = ANY_TOKEN.exec(line)) !== null) {
      const token = m[0];
      const where = `${fileRel}:${i + 1}`;
      const bare = token.includes('/') ? null : token.replace(/\.(?:mjs|cjs|ps1|sh|py|cmd)$/, '');
      if (SYSTEM_COMMANDS.has(bare)) continue;
      const pkgMatch = ANY_PREFIX.test(token) ? PKG_PREFIX.exec(token) : null;
      if (ANY_PREFIX.test(token)) {
        // 只有包根占位符前缀才是对本包的引用；其它 `<…>/` 前缀属目标项目，不判死引。
        // 路 A 复核补的第二半：占位符指向 `sources/**` 这类不下发的面时，路径**盘上存在**但不在 bundle 里，
        // 只查 existsSync 等于把「快照里有」当「本包有」——与本文件头注那条边界正面矛盾。
        const intoSkipFace = pkgMatch && skipFace(pkgMatch[1]);
        if (pkgMatch && (intoSkipFace || !existsSync(join(root, pkgMatch[1])))) {
          hits.push({ where, rule: 'R1', token, file: fileRel, note: intoSkipFace ? SKIP_FACE_NOTE : '' });
        }
        continue;
      }
      if (token.includes('/')) {
        if (inDepBlock && isScriptExt(token)) {
          // 依赖块认「本包有这个工具」：路径写错但同名工具确实存在，只纠路径不判假依赖。
          if (!existsSync(join(root, token)) && !execBasenames.has(basename(token))) {
            hits.push({ where, rule: 'R2', token, file: fileRel });
          }
        }
        continue;
      }
      // 裸名只有脚本扩展名才判：`README.md` 这类裸文档名在本包里满地都是，不是指令指向的实体。
      if (isScriptExt(token) && !execBasenames.has(token)) hits.push({ where, rule: 'R3', token, file: fileRel });
    }

    // R4/R5：包内路径字面量（含 `.md`/`.json`/`.yaml` 这些脚本面看不见的目标）与裸技能名写法。
    PKG_PATH_TOKEN.lastIndex = 0;
    let pm;
    while ((pm = PKG_PATH_TOKEN.exec(line)) !== null) {
      const pathToken = pm[0];
      // `<skills仓库>/…` 的内层路径由 R1 负责（它判的是占位符展开后的整条路径），这里不重复报。
      if (line.slice(0, pm.index).endsWith('>/')) continue;
      const segs = pathToken.replace(/^\.\//, '').split('/');
      const bareSkillRef = SKILL_NAMES.has(segs[0]) && INNER_SHAPES.has(segs[1]);
      if (segs[0] !== 'skills' && !bareSkillRef) { externalRefs++; continue; }
      const norm = pathToken.startsWith('./') ? pathToken.slice(2) : pathToken;
      if (existsSync(join(root, norm))) continue;
      const where2 = `${fileRel}:${i + 1}`;
      hits.push({
        where: where2, rule: segs[0] === 'skills' ? 'R4' : 'R5', token: pathToken, file: fileRel,
        fix: suggestFix(pathToken),
      });
    }

    // R4 目录形态：正文也会把「某个目录在这儿」写成指令（`skills/ui-ux-pro-max/data/`、
    // `skills/ui-styling/canvas-fonts` 这类不带扩展名的目标）。此前只有带扩展名的写法进 R4，
    // 于是同一批扁平旧路径里恰好是目录声明的两条漏在门外——「检查不了」必须变成可见判据。
    // 口径：先把上一轮判过的文件形态 token 从行里摘掉（避免 `skills/ui/x.mjs` 的前缀 `skills/ui/`
    // 被重复报），再要求整条路径的**第一段字面就是 `skills`**，且左侧紧邻不是路径字符
    // （`.vibe-coding-skills/vibe-hooks/`、URL 里的 `…/skills/tree/` 都是子串而非本包声明）。
    const dirFace = line.replace(PKG_PATH_TOKEN, ' ');
    PKG_DIR_TOKEN.lastIndex = 0;
    let dmm;
    while ((dmm = PKG_DIR_TOKEN.exec(dirFace)) !== null) {
      const before = dmm.index === 0 ? '' : dirFace[dmm.index - 1];
      if (/[A-Za-z0-9._\-\/]/.test(before)) continue;
      const pathToken = dmm[0];
      const segs = pathToken.replace(/^\.\//, '').split('/').filter(Boolean);
      if (segs[0] !== 'skills') continue;
      if (existsSync(join(root, segs.join('/')))) continue;
      hits.push({
        where: `${fileRel}:${i + 1}`, rule: 'R4', token: pathToken, file: fileRel,
        fix: suggestFix(pathToken), dirForm: true,
      });
    }

    // R6：含 `<…>` 占位段的本包路径必须至少有一个真实展开（2026-10-02 起判所有面，含盘上正文）。
    // 为什么单独一条：占位段会打断 R1／R4 的 token 正则（段名里不许出现 `<`），所以
    // 「块内把技能写成一层」这种谎报在 R1／R4 下是 0 命中——门必须能看见它要防的那类病。
    {
      PLACEHOLDER_PATH_TOKEN.lastIndex = 0;
      let hm;
      while ((hm = PLACEHOLDER_PATH_TOKEN.exec(line)) !== null) {
        const token = hm[0];
        if (!token.includes('<')) continue; // 无占位段的整条路径归 R1／R4
        const before = hm.index === 0 ? '' : line[hm.index - 1];
        if (/[A-Za-z0-9._\u4e00-\u9fff]/.test(before)) continue; // 左邻是路径字符＝子串，不是本包声明
        let rest = token.replace(/\/$/, '');
        if (ANY_PREFIX.test(token)) {
          const pkg = PKG_PREFIX.exec(token);
          if (!pkg) continue; // 非包根占位符前缀属目标项目命名面
          rest = pkg[1].replace(/\/$/, '');
        } else if (!/^skills(?:\/|$)/.test(rest)) {
          continue; // 只有声明本包路径的写法才是对本包的承诺
        }
        const segs = rest.split('/').filter(Boolean);
        const matchers = segs.map(segmentMatcher);
        if (!matchers.some((m) => m.wildcard)) continue; // 展开后与原文同形，交给 R1／R4
        // 首段落在不下发的面上（`sources/**` 保真快照、`.qoder` 子代理副本、`node_modules` 等）
        // 就是对本包可执行面的谎报：那条路径盘上「存在」，但它不在 bundle 里，照抄到目标项目必打不开。
        // 复核（路 A，2026-10-02）实测不排除时 `<skills-root>/sources/…/skills/<技能>/SKILL.md` 命中 0，
        // 与头注「快照里有 ≠ 本包有」这条边界自相矛盾。放在通配检查之后：无占位段的整条路径仍归 R1，不重复报。
        if (skipFace(rest)) {
          hits.push({ where: `${fileRel}:${i + 1}`, rule: 'R6', token, file: fileRel, note: SKIP_FACE_NOTE });
          continue;
        }
        let candidates = [root];
        let dead = false;
        for (let depth = 0; depth < segs.length; depth += 1) {
          const { re, wildcard } = matchers[depth];
          const next = [];
          for (const dir of candidates) {
            if (!wildcard) {
              const exact = join(dir, segs[depth]);
              if (existsSync(exact)) next.push(exact);
              continue;
            }
            let names;
            try {
              names = readdirSync(dir);
            } catch {
              names = [];
            }
            // 通配展开同样不得吃进不下发的目录（`<分类>` 匹配到 `sources` 这类也算死落点）。
            for (const name of names) if (re.test(name) && !SKIP_DIRS.has(name.toLowerCase())) next.push(join(dir, name));
          }
          candidates = next;
          if (!candidates.length) { dead = true; break; }
        }
        if (dead) hits.push({ where: `${fileRel}:${i + 1}`, rule: 'R6', token, file: fileRel });
      }
    }
  }
}

// ---- 棘轮基线：存量登记可见、新增一律阻断、登记过期同样阻断 ----
const baselinePath = join(root, 'scripts', 'skill-reference-baseline.json');
let baseline;
if (existsSync(baselinePath)) {
  try {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch {
    // 头注承诺「基线畸形非零并点名」：裸堆栈会让下游把它当成检查器崩了而不是自己有活要修。
    console.error(`✗ 基线文件不可读或 JSON 畸形：${baselinePath}`);
    console.error('  修复：恢复到上个提交的基线版本（该文件只登记存量死引，不含可执行逻辑）。');
    process.exit(1);
  }
} else {
  baseline = { entries: [] };
}
if (!Array.isArray(baseline.entries)) {
  console.error(`✗ 基线文件畸形：${baselinePath} 缺 entries 数组（修复：恢复到上个提交的基线版本，或按 --print-baseline 重新播种）`);
  process.exit(1);
}
const baselineKeys = new Map(
  baseline.entries.map((e) => [`${e.rule}|${e.file}|${e.token}`, e]),
);

let unregisteredHits = 0;
let staleRegistrations = 0;
// 登记过期只在「该条所属扫描面本次真被扫到」时判：限定扫描面或只扫虚拟面时，别面的登记
// 不能报成过期——否则技能正文登记一条存量，就会把「下发件自扫门」打成与它无关的假红。
// 判据是路径属于当前面（不是文件是否还在盘上），所以正文文件被删掉仍会报过期。
const facePrefixes = virtualOnly ? [] : scopes.map((s) => `${s.replace(/\/$/, '')}/`);
function registrationInCurrentFace(file) {
  if (virtualTexts.has(file)) return true;
  if (virtualOnly) return false;
  if (includeRootSkill && file === 'SKILL.md') return true;
  return facePrefixes.some((p) => file.startsWith(p));
}
for (const h of hits) {
  const key = `${h.rule}|${h.file}|${h.token}`;
  seenKeys.add(key);
  if (baselineKeys.has(key)) continue;
  unregisteredHits++;
  errors.push(`${h.where} 死引·${h.rule} 未登记新增：\`${h.token}\`` +
    (h.fix ? `（本包唯一解是 \`${h.fix}\`，照抄的写法打不开）` : '') +
    (h.rule === 'R6' && !h.note ? '（占位符展开后在本包没有任何真实落点）' : '') +
    (h.note ? `（${h.note}）` : '') +
    '（收口正文，或在 scripts/skill-reference-baseline.json 登记理由）');
}
for (const e of baseline.entries) {
  const key = `${e.rule}|${e.file}|${e.token}`;
  if (!registrationInCurrentFace(e.file)) continue;
  if (!seenKeys.has(key)) {
    staleRegistrations++;
    errors.push(`基线登记已过期：${key}（该死引实际不存在，请删除此条——基线不是永久免检牌）`);
  }
}

const registered = hits.filter((h) => baselineKeys.has(`${h.rule}|${h.file}|${h.token}`));
for (const h of registered) console.warn(`△ ${h.where} 存量死引·${h.rule}（已登记）：\`${h.token}\``);

// --print-baseline：把当前命中打成基线条目 JSON（播种存量用，避免手抄 key 打错）。
if (argv.includes('--print-baseline')) {
  console.log(
    JSON.stringify(
      {
        schema: 'vibe-coding-skills-skill-reference-baseline/v1',
        note: '技能正文死引用存量基线：只兜底「已知但未收口」，新增一律阻断；每条收口后必须删除本条，登记过期同样判红。',
        entries: hits.map((h) => ({ rule: h.rule, file: h.file, token: h.token, why: '<待补：为何暂不收口／它属于哪一面>' })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

for (const e of errors) console.error(`✗ ${e}`);
console.log(
  `技能正文死引用检查：扫描 ${scannedFiles.length} 个文件` +
  (virtualTexts.size ? `（含虚拟面 ${virtualTexts.size} 份）` : '') +
  `，可执行面基名 ${execBasenames.size} 个，` +
  `技能面 ${SKILL_NAMES.size} 个，地面外路径 ${externalRefs} 处不计，` +
  `命中 ${hits.length} 处（未登记新增 ${unregisteredHits} 处、基线存量 ${registered.length} 处）` +
  (staleRegistrations ? `，基线登记过期 ${staleRegistrations} 条须删除` : '') + '。',
);
process.exit(errors.length ? 1 : 0);
