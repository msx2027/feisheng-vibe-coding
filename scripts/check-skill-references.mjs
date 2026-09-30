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
//   R2 依赖声明：SKILL.md 的 [DocMap] 依赖块里以 `tools/` 或 `scripts/` 起头的条目，
//      必须在本包存在（依赖块是「本技能要用什么」的自述，指不出实体就是假依赖）。
//   R3 裸脚本名：正文里出现 `foo.mjs` / `foo.ps1` / `foo.sh` / `foo.py` 这类不带目录的脚本名，
//      且本包可执行面内没有任何同名文件——即指令指向一个不存在的工具。
//
// 覆盖边界（有意不报的形态，别把它们当成已通过）：
//   · 带目录前缀但非 `<skills仓库>/` 的引用（如 `tools/check-ui-reuse.mjs`、`./tools/x.sh`）
//     按口径视为**目标项目自己的**工具，本包不拥有也不该拥有，故不判死引。
//   · 非脚本扩展名（.md / .json / .toml 等）不在本检查范围——那是文档面，归文档治理与口径账本。
//   · `sources/**` 是保真快照，只读、不可执行、永不下发，故其内的同名脚本**不计入**可执行面：
//     快照里有 ≠ 本包有。这正是本检查器要抓的那种偏差。
//
// 存量与新增分治（棘轮，沿本包密钥基线同款设计）：命中若已在
//   scripts/skill-reference-baseline.json 登记（file+token+rule 三键），只计数不阻断；
//   未登记的新一律 error 阻断。**登记了但实际已不存在＝登记过期，同样 error**——基线不许变成
//   永久免检牌，每条必须在收口后被删掉。
//
// 用法：node scripts/check-skill-references.mjs [--root <项目根>] [--scope <相对目录>]
//   默认扫描 skills/**/*.md 与根 SKILL.md；--scope 可换扫描面（测试夹具用）。
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

const EXTS = 'mjs|ps1|sh|py|cmd';
// 目录前缀可反复，末尾必须是脚本扩展名；允许 <skills仓库> 这类含尖括号的段。
const SCRIPT_TOKEN = new RegExp(`(?:<[^>]+>/)?(?:[\\w.\\-\\u4e00-\\u9fff]+/)*[\\w.\\-\\u4e00-\\u9fff]+\\.(?:${EXTS})\\b`, 'g');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'sources', '__pycache__', '.venv', 'venv', 'dist', 'build']);

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

const scannedFiles = [];
for (const s of scopes) {
  if (!existsSync(join(root, s))) continue;
  if (statSync(join(root, s)).isFile()) {
    scannedFiles.push(s);
    continue;
  }
  for (const f of walk(s, [])) if (f.endsWith('.md')) scannedFiles.push(f);
}
if (includeRootSkill && existsSync(join(root, 'SKILL.md'))) scannedFiles.push('SKILL.md');

// 包根占位符白名单：只有这几种写法声明的是「本包自己」的路径，必须真实存在。
// 其余 `<...>/` 前缀（如 `<目标项目根>/tools/x.mjs`）按口径属于目标项目 surface，不判死引——
// 把目标项目路径当包内路径查会整批误报，门禁一红就没人再信它。
const PKG_PREFIX = /^<(?:skills仓库|skills 仓库|skills-root|skillsRoot|本包|包根|package)>\/(.+)$/;
const ANY_PREFIX = /^<[^>]+>\//;

const errors = [];
const hits = [];
const seenKeys = new Set();
for (const fileRel of scannedFiles) {
  const text = readFileSync(join(root, fileRel), 'utf8');
  const lines = text.split(/\r?\n/);
  let inDepBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // [DocMap] 依赖块：自「依赖：」起，到下一个中文字段标签止。
    if (/^\s*依赖：\s*$/.test(line)) { inDepBlock = true; continue; }
    if (inDepBlock && /^\s*(输出|层级|模块|任务)：/.test(line)) inDepBlock = false;

    let m;
    SCRIPT_TOKEN.lastIndex = 0;
    while ((m = SCRIPT_TOKEN.exec(line)) !== null) {
      const token = m[0];
      const where = `${fileRel}:${i + 1}`;
      const bare = token.includes('/') ? null : token.replace(/\.(?:mjs|ps1|sh|py|cmd)$/, '');
      if (SYSTEM_COMMANDS.has(bare)) continue;
      const pkgMatch = ANY_PREFIX.test(token) ? PKG_PREFIX.exec(token) : null;
      if (ANY_PREFIX.test(token)) {
        // 只有包根占位符前缀才是对本包的引用；其它 `<…>/` 前缀属目标项目，不判死引。
        if (pkgMatch && !existsSync(join(root, pkgMatch[1]))) {
          hits.push({ where, rule: 'R1', token, file: fileRel });
        }
        continue;
      }
      if (token.includes('/')) {
        if (inDepBlock) {
          // 依赖块认「本包有这个工具」：路径写错但同名工具确实存在，只纠路径不判假依赖。
          if (!existsSync(join(root, token)) && !execBasenames.has(basename(token))) {
            hits.push({ where, rule: 'R2', token, file: fileRel });
          }
        }
        continue;
      }
      if (!execBasenames.has(token)) hits.push({ where, rule: 'R3', token, file: fileRel });
    }
  }
}

// ---- 棘轮基线：存量登记可见、新增一律阻断、登记过期同样阻断 ----
const baselinePath = join(root, 'scripts', 'skill-reference-baseline.json');
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : { entries: [] };
if (!Array.isArray(baseline.entries)) {
  console.error(`✗ 基线文件畸形：${baselinePath} 缺 entries 数组`);
  process.exit(1);
}
const baselineKeys = new Map(
  baseline.entries.map((e) => [`${e.rule}|${e.file}|${e.token}`, e]),
);

for (const h of hits) {
  const key = `${h.rule}|${h.file}|${h.token}`;
  seenKeys.add(key);
  if (baselineKeys.has(key)) continue;
  errors.push(`${h.where} 死引·${h.rule} 未登记新增：\`${h.token}\`（收口正文，或在 scripts/skill-reference-baseline.json 登记理由）`);
}
for (const e of baseline.entries) {
  const key = `${e.rule}|${e.file}|${e.token}`;
  if (!seenKeys.has(key)) {
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
  `技能正文死引用检查：扫描 ${scannedFiles.length} 个文件，可执行面基名 ${execBasenames.size} 个，` +
  `命中 ${hits.length} 处（未登记 ${errors.length} 处，基线存量 ${registered.length} 处）。`,
);
process.exit(errors.length ? 1 : 0);
