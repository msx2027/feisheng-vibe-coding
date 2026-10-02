#!/usr/bin/env node
// 受管块下发文本自扫门（本包「自己扫自己」，2026-10-02 接线，owner 令「第二件 123 都要实施」第 ① 项）。
//
// 病：受管块由生成器渲染后写进每个目标项目的 AGENTS.md / CLAUDE.md，而本包的死引用棘轮只扫
//     `skills/**/*.md`——它看不见注入后果。2026-10-01 那批为此付过一整轮返工：块里写了一个本包
//     不下发的脚本名，谎报只能落到别人仓库、被别人那道门撞上才暴露
//     （docs/HANDOFF-NEXT.md「新增的待拍板项」②，evidence/20261001-skill-body-dead-command-cleanup.md §10-11）。
// 做法：把渲染出的块正文当一份**虚拟 .md**，过 `scripts/check-skill-references.mjs` 的同一套判据
//     （R1 包根占位符／R3 裸脚本名／R4 包内路径／R5 裸技能名／R6 占位符展开）。
//     存在性判据取的是**真包面**（--root 指本包），所以「快照里有 ≠ 本包有」这条边界原样生效。
// 非空自证（路 A 复核 2026-10-02 补，防「本门恒绿」）：本门判的是**渲染结果**，而渲染可能退化成
//     空串或半截正文——那时棘轮「命中 0 处」照样 exit 0，门禁全绿却什么都没扫。故三道自证：
//   ① 正文本身：非空、含 `## Agent 宪法` 标题、`### ` 规则面标题数不低于下限（实测 v27 渲染 11 个，
//      下限取 6＝「至少还剩一半规则面」；它只防「渲染塌了」，不逐节钉死内容），否则 exit 2；
//   ② 棘轮读数：必须出现「扫描 1 个文件（含虚拟面 1 份）」，否则说明 `--virtual-only`／`--virtual-md`
//      任一参数丢了——丢 `--virtual-md` 是「只扫盘面 0 命中」，丢 `--virtual-only` 是「盘面＋虚拟面混扫」，
//      两种退化在当前存量下都不报错，只有按读数自证才看得见；
//   ③ 写盘回读（路 B 复核 2026-10-02 补的第三条空判）：①②判的都是 `body` 这个字符串和棘轮的自述，
//      都不校验**写进 block.md 的字节就是 body**。把 `writeFileSync` 突变成写空串或 `body.slice(0,20)`
//      （谎报行正好被截掉），①②全过、棘轮照打「命中 0 处」、本门照绿。回读比对是这条缝的唯一可见法。
// 下发面不吃基线豁免（路 B 复核同批补）：棘轮的 `scripts/skill-reference-baseline.json` 能让任何一条
//     命中变成「存量」从而 exit 0。对技能正文这是对的（存量收口要分期），对下发件是错的——受管块里的
//     一个脚本名是对**别人仓库**的承诺，登记它只等于承认「我们知道这是谎报还是要发」。
//     故本门额外要求汇总行「基线存量 0 处」，>0 一律 exit 2。这条把上面那句「落点规矩」从纸面变成机器。
// 落点规矩（本门强制的那条口径）：块里不写本包不下发的脚本名或路径，连「某旧代工具未随本包分发」
//     这种诚实提及也不能写名字——目标项目读到的每个名字都是对本包的承诺。
// 边界（如实写明，不当成已通过）：
//   · R3 的存在性判据是「本包**有**这个基名」（可执行面＝仓库内全部文件基名），不是「本包给目标项目用」。
//     块里写 `verify.ps1` 这类本包自用门禁会被放行。要判后者得有一份「可下发给目标项目的工具」真源，
//     而 CANONICAL-CATALOG.json 的 `bundle.files`（453 条，含 29 个 `tools/`）说的是**宿主运行时投影**带哪些
//     文件，跟「目标项目能照抄哪条命令」不是一回事——拿它当面会同时漏掉与误报，故不采用，登记为已知偏差。
//   · 只判宪法正文（getConstitutionBody）。经验投影块由 experience-managed-blocks.mjs 渲染，内容来自
//     目标项目自己的台账，不含本包路径，不在本门眼下。
//   · 脚手架模板（*.template）面已接入棘轮默认扫描面（2026-10-02，owner 拍板「接进门禁＋修那 1 处」）：模板正身
//     就是盘上文件，不需要渲染上下文，所以走 `scripts/check-skill-references.mjs` 的常规面而不是本门的虚拟面。
//     本门仍只判宪法正文——模板与受管块是两条不同的下发通道，判据同一套、扫描面各管各的。
//   · AGENTS.md 与 CLAUDE.md 两份正文只在「运行时名 / 入口文件名」两个字段上不同，故只扫一份 canonical
//     正文；那两个字段的值来自 TARGET_FILES，不指向任何工具，没有可判的死引面。
//
// 用法：node scripts/check-runtime-block-refs.mjs [--root <包根>] [--print-body]
// 退出码：0 = 块文本无死引（且下发面零豁免）；1 = 棘轮判有死引（透传其判定）；
//         2 = 用法／缺棘轮脚本／渲染或写盘退化／扫描面或基线读数不符——一律是「本门没判成」，不是「判过了」。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TARGET_RUNTIME_BLOCK_VERSION,
  getConstitutionBody,
} from '../skills/event/experience-elevator/tools/init-target-runtime.mjs';

// 虚拟面名：命中定位与基线键都用它。改名**不会**让旧登记报「过期」——「登记过期」只在所属面
// 本次真被扫到时才判（棘轮 `registrationInCurrentFace` 那条），所以改名等于让旧面的存量**静默退出判定**。
// 要改名就得同时手工删掉基线里 `受管块/…` 的旧条目，并重新盘查它们各自的落点。
const BLOCK_FACE = '受管块/AGENTS+CLAUDE.md';

const selfDir = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argValue = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
// 只校验开关本身：--root 的取值是路径，不能按「未知参数」判。
for (const item of argv) {
  if (item.startsWith('--') && item !== '--root' && item !== '--print-body') {
    console.error(`✗ 未知开关：${item}（本门只接 --root 与 --print-body）`);
    process.exitCode = 2;
    process.exit(2);
  }
}
const root = resolve(argValue('--root') ?? resolve(selfDir, '..'));
const checkerPath = join(root, 'scripts', 'check-skill-references.mjs');

let body;
try {
  body = getConstitutionBody();
} catch (error) {
  console.error(`✗ 受管块正文渲染失败：${error.message}`);
  console.error('  这不是「没有死引」，是本门没有跑起来。');
  process.exitCode = 2;
  process.exit(2);
}

// 自证 ①：正文非空且仍是「宪法」——退化成正则只剩一节或渲染成空串时，棘轮无从判起。
// 位置在 --print-body 之前（路 B 复核：打印支路早于自证时，`--print-body` 对着空正文也 exit 0，
// 等于把本文件宣布的「0＝块文本无死引」用在一个什么都没扫的支路上）。
const RULE_FACE_FLOOR = 6; // 实测 v27 渲染 11 个 `### `；下限只防「渲染塌了」，见头注自证 ①
{
  const lines = body.split(/\r?\n/);
  const ruleFaces = lines.filter((line) => /^### /.test(line)).length;
  const problems = [];
  if (!body.trim()) problems.push('渲染结果为空串');
  if (!/^## Agent 宪法\s*$/m.test(body)) problems.push('正文缺 `## Agent 宪法` 标题');
  if (ruleFaces < RULE_FACE_FLOOR) problems.push(`正文只剩 ${ruleFaces} 个 \`### \` 规则面，低于下限 ${RULE_FACE_FLOOR}`);
  if (problems.length) {
    console.error(`✗ 受管块正文自证失败：${problems.join('；')}（version=${TARGET_RUNTIME_BLOCK_VERSION}，共 ${lines.length} 行）`);
    console.error('  这不是「没有死引」，是本门没有可扫的正文。判据退化了要先修生成器。');
    process.exitCode = 2;
    process.exit(2);
  }
}

if (argv.includes('--print-body')) {
  console.log(body);
  process.exit(0);
}

// 装配自证：`--root` 指向的包根没有棘轮时，直接判「门没跑起来」（2），不要让 node 的
// MODULE_NOT_FOUND 以 exit 1 出现——那与本文件宣布的「1＝棘轮判有死引」是同码两义。
if (!existsSync(checkerPath)) {
  console.error(`✗ 包根里没有棘轮脚本：${checkerPath}`);
  console.error('  这不是「没有死引」，是本门的判据不存在（--root 指错了或该文件被移走）。');
  process.exitCode = 2;
  process.exit(2);
}

const workDir = mkdtempSync(join(tmpdir(), 'vibe-block-scan-'));
let verdict = 2; // 默认判红：正文没扫成、或扫的过程出了意外，都不算「通过」。
console.log(
  `受管块下发文本自扫：version=${TARGET_RUNTIME_BLOCK_VERSION} 面=${BLOCK_FACE}（判据同 R1／R3／R4／R5／R6）`,
);
try {
  const bodyPath = join(workDir, 'block.md');
  const payload = `${body}\n`;
  writeFileSync(bodyPath, payload, 'utf8');
  // 自证 ③：棘轮读的是盘上那份文件，所以判据也得比对盘上那份文件。
  if (readFileSync(bodyPath, 'utf8') !== payload) {
    console.error('✗ 写盘回读与渲染结果不一致——本门扫的字节不是生成器渲染出来的正文，判定不可信。');
    console.error('  多半是 writeFileSync 的内容被改过（截断、加了前缀、写成了别的变量）。');
  } else {
    const r = spawnSync(
      process.execPath,
      [
        checkerPath,
        '--root', root,
        '--virtual-only',
        '--virtual-md', BLOCK_FACE, bodyPath,
      ],
      { encoding: 'utf8' },
    );
    if (r.error || r.status === null) {
      console.error(`✗ 棘轮子进程未能运行：${r.error ? r.error.message : '无退出码（被信号终止？）'}`);
      console.error('  本门不降级为通过——跑不起来与没有死引是两句话。');
      verdict = 2;
    } else {
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
      if (r.status !== 0) {
        // 子进程自己判红（死引／基线畸形／模块缺失）：原样透传，不改写成自证消息。
        verdict = r.status;
      } else {
        // 自证 ②＋下发面零豁免：全部只看棘轮自己打出的那一行汇总读数。
        const reading = /扫描 (\d+) 个文件（含虚拟面 (\d+) 份）[\s\S]*?未登记新增 (\d+) 处、基线存量 (\d+) 处/.exec(r.stdout ?? '');
        if (!reading) {
          console.error('✗ 受管块自扫未被棘轮确认为「只扫 1 份虚拟面」——本门没有判据可读。');
          console.error('  多半是 spawnSync 的 --virtual-only／--virtual-md 参数变了；按读数回查，别把它当通过。');
          verdict = 2;
        } else if (Number(reading[1]) !== 1 || Number(reading[2]) !== 1) {
          console.error(`✗ 本次扫描面是 ${reading[1]} 个文件（虚拟面 ${reading[2]} 份），不是「只有 1 份受管块正文」。`);
          console.error('  混进盘面就把「技能正文没新增」当成了「块文本没问题」，这两句不是一句。');
          verdict = 2;
        } else if (Number(reading[4]) > 0) {
          console.error(`✗ 下发面出现 ${reading[4]} 处基线豁免——受管块的死引用「登记已知」不等于它可以下发到别人仓库。`);
          console.error(`  收口正文，或把该条登记从 ${join('scripts', 'skill-reference-baseline.json')} 里删掉；本门不接受用豁免换绿。`);
          verdict = 2;
        } else {
          verdict = 0;
        }
      }
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
process.exitCode = verdict;
