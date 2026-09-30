#!/usr/bin/env node
// 口径账本执行器（vibe-coding-skills 通用版；行为语义移植自下游项目 2026-09-30 实跑版本）。
//
// 病：同一事实（词位／数字／状态）常被写进多处——文档、代码、注释、画布。没人登记「这事实有几份、
// 谁是真源」，改一处其余变陈旧＝口径漂移。事后全仓审计抓得到，但审计快照自身会过期，批量词替换
// 还会误伤注释。本执行器把「会复发」的口径逐条钉住，常驻断言。
//
// 对 tools/caliber-ledger.json 每条目断言：
//   · 禁出（scans.forbid）：退休词在扫描面出现即红，历史材料按该条目 scans.exclude 豁免；
//   · 镜像同步（mirrors.require）：真源在，镜像关键串必须仍在——只钉存在不钉数目，
//     计数是书写时点的快照，合法增长不该判红；
//   · 禁出（mirrors.forbid）：镜像面各自禁出的字面；
//   · 锚点自检（truth.anchorRegex／mirrors.anchorRegex）：真源挪位或改名时锚点先响，
//     钉子不许静默失效——没有锚的钉子等于一盏恒绿的哑灯。
//
// 失败语义：账本损坏／条目畸形／锚点失效／断言红一律非零阻断（fail-closed）；账本零条目视为
// 未登记任何口径，放行。诊断必须点名条目与修复动作，不许裸非零。
//
// 用法：node check-caliber-ledger.mjs [--root <dir>] [--ledger <path>] [--staged] [--report]
//   --staged   提交钩子口径：断言照跑全量（毫秒级），另按暂存面列出触达条目作同步清单——真源／
//              镜像被 staged 即触达，删除与改名的旧名一并计入（不得用 --diff-filter=ACMR 口径，
//              会漏掉删除与改名）。钩子只阻断＋列清单：钩子内没有 AI 运行时代为改写镜像。
//   --report   定期报告口径：断言结果只汇总不阻断（退出码 0），用于全仓抽检与挂账盘点；
//              账本损坏／条目畸形／正则不可编译仍非零——坏账本在任何模式下都不许静默放行。
// 退出码：0 = 干净，或 --report 下的断言红；1 = 断言红／锚点失效／账本损坏。
//
// 结构与下游同步：判定面在同目录 caliber-ledger-core.mjs，接线器把两文件一起复制进目标项目
// tools/（单文件复制会让下游拿到的执行器 import 落空）。拆的动机是下游 300 行结构门禁，见核内头注。
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  LedgerError,
  checkLedgerShape,
  precompileEntries,
  createScanner,
  resolveSkipDirs,
  stagedPathSet,
} from "./caliber-ledger-core.mjs";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
function argValue(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

// 路径一律按 root 相对解析（默认仓库根；工区 worktree 内解析到 worktree 根）。
// 禁止写死绝对盘符，否则工区隔离即被破坏。
const root = path.resolve(argValue("--root") ?? path.resolve(toolsDir, ".."));
const ledgerPath = path.resolve(argValue("--ledger") ?? path.join(root, "tools", "caliber-ledger.json"));
const stagedMode = argv.includes("--staged");
const reportMode = argv.includes("--report");

const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const ledgerRel = rel(ledgerPath);

/** 账本自身坏掉的唯一出口：诊断已在核内写成成品行，逐行落 stderr 后非零。 */
function bail(err) {
  const lines = err instanceof LedgerError ? err.lines : [`${err.name}: ${err.message}`];
  for (const line of lines) console.error(line);
  process.exit(1);
}

let ledger;
try {
  ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
} catch (err) {
  console.error(`错误：口径账本不可读（${ledgerRel}）：${err.message}`);
  console.error("修复：恢复到上个提交的账本版本后重改；不许删除账本静默放行。");
  process.exit(1);
}
let skipDirs;
let entries;
try {
  checkLedgerShape(ledger, ledgerRel);
  if (ledger.entries.length === 0) {
    console.log("口径账本：零条目，未登记任何口径，放行。");
    process.exit(0);
  }
  skipDirs = resolveSkipDirs(ledger, ledgerRel);
  entries = precompileEntries(ledger, ledgerRel);
} catch (err) {
  bail(err);
}

const scanner = createScanner(root, skipDirs);
const problems = [];
const defects = []; // 账本自身坏掉（禁出空跑／文件读不出），与「被钉对象漂移」分开：defects 在 --report 下也非零
// 账本自身不算扫描面：条目里 forbid／require 的字面必然原样出现在账本里，若被扫到就是
// 「登记语义」被当成「现行口径」误伤。登记面不是用户可见面（同 CAL 规矩：审计与工作记录里
// 引用旧词属登记语义）。
function fail(entry, msg) {
  problems.push(`[${entry.id}] ${msg}`);
}
function fileText(entry, relPath, purpose) {
  try {
    return readFileSync(path.join(root, relPath), "utf8");
  } catch {
    fail(entry, `${purpose}文件不存在：${relPath} —— 挪位／改名？人工核对后更新账本锚点并注明，不许静默改钉。`);
    return null;
  }
}

for (const entry of entries) {
  if (entry.truth) {
    const text = fileText(entry, entry.truth.path, "真源");
    if (text !== null && !entry.truth.anchor.test(text)) {
      fail(entry, `真源锚点失效：${entry.truth.path} 中找不到 /${entry.truth.anchor.source}/ —— 真源挪位或措辞已变。人工核对后更新账本并注明；锚点失效的钉子等于哑灯。`);
    }
  }
  for (const m of entry.mirrors) {
    const text = fileText(entry, m.path, "镜像");
    if (text === null) continue;
    if (m.anchor && !m.anchor.test(text)) {
      fail(entry, `镜像锚点失效：${m.path} 中找不到 /${m.anchor.source}/ —— 人工核对后更新账本锚点并注明。`);
      continue;
    }
    for (const r of m.require) {
      if (!r.test(text)) {
        fail(entry, `镜像失步：${m.path} 缺关键串「${r.source}」。条目规则：${entry.rule} 改真源须同批同步镜像；历史材料应登记进账本豁免（scans.exclude）而不是删串。`);
      }
    }
    for (const r of m.forbid) {
      if (r.test(text)) {
        fail(entry, `镜像禁出命中：${m.path} 出现「${r.source}」。条目规则：${entry.rule}`);
      }
    }
  }
  for (const s of entry.scans) {
    const candidates = new Set();
    for (const inc of s.include) {
      const hits = scanner.filesUnder(inc.glob).filter((f) => inc.re.test(f));
      if (hits.length === 0) {
        // include 空集＝这道禁出正在空跑。分两种：目录在而一个文件都没命中＝glob 写错或目录改名，
        // 门被无声摘掉，任何模式都算坏账本（含 --report）；目录本身不存在＝这个项目确实没这个面
        // （如下游没用 GitHub Actions），只示众不判死，否则开箱接线第一天就红。
        const seed = scanner.globSeed(inc.glob);
        if (seed.missing) {
          console.log(`口径账本·扫描面目录不存在（不阻断）：[${entry.id}] ${inc.glob} —— 该项目无此面`);
        } else {
          defects.push(`[${entry.id}] scans.include「${inc.glob}」在 ${seed.base || "仓库根"} 下未命中任何文件 —— glob 写错或该面已改名，这道禁出正在空跑。`);
        }
        continue;
      }
      for (const f of hits) candidates.add(f);
    }
    for (const f of candidates) {
      if (f === ledgerRel) continue;
      if (s.exclude.some((ex) => ex.test(f))) continue;
      let text;
      try {
        text = readFileSync(path.join(root, f), "utf8");
      } catch (err) {
        defects.push(`[${entry.id}] 扫描面文件读不出：${f} —— ${err.message}`);
        continue;
      }
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        for (const r of s.forbid) {
          if (r.test(lines[i])) {
            fail(entry, `禁出词命中 ${f}:${i + 1} —— 「${lines[i].trim().slice(0, 80)}」。条目规则：${entry.rule} 历史材料应在账本 scans.exclude 登记豁免并写明理由，不是删史。`);
          }
        }
      }
    }
  }
}

// ---- staged 触达清单（钩子口径）：只列清单指同步义务，不替代断言 ----
if (stagedMode) {
  const { set, error } = stagedPathSet(root);
  if (error) {
    // 降级仅限触达清单（建议性）；断言主面照跑，门禁不被绕过。但不许静默。
    console.error("警告：--staged 触达清单不可用（git diff --cached 失败，非仓库目录或 git 异常）；断言仍全量执行。");
  } else {
    const touched = [];
    for (const entry of entries) {
      const hit =
        (entry.truth && set.has(entry.truth.path)) ||
        entry.mirrors.some((m) => set.has(m.path)) ||
        entry.scans.some((s) =>
          [...set].some((p) => s.include.some((inc) => inc.re.test(p)) && !s.exclude.some((ex) => ex.test(p))),
        );
      if (hit) touched.push(entry);
    }
    if (touched.length > 0) {
      console.log(`口径账本·本次改动触达条目（改真源须同批同步镜像，账本见 ${ledgerRel}）：`);
      for (const t of touched) console.log(`  - ${t.id} ${t.title}｜${t.rule}`);
    }
  }
}

// ---- 挂账待修面：登记即可见，不阻断 ----
// 豁免不得庇护活体漂移，但也不该让他线在途文件误伤无关提交——挂账在这里常驻示众，
// 修净后由入账会话删除该挂账与本豁免。
for (const entry of entries) {
  for (const p of entry.pending) {
    console.log(`口径账本·挂账待修（不阻断）：[${entry.id}] ${p.path} —— ${p.why ?? ""}`);
  }
}

if (defects.length > 0) {
  console.error(`口径账本：${entries.length} 条目，账本自身缺陷 ${defects.length} 处 —— 任何模式都阻断（含 --report）：禁出正在空跑时，报告里的「绿」是假的。`);
  for (const d of defects) console.error(`  ${d}`);
  console.error(`修复：把 scans.include 指回真实存在的面（格式见 ${ledgerRel} 的 conventions）。`);
  process.exit(1);
}

if (problems.length > 0) {
  const mode = reportMode ? "报告（不阻断）" : "阻断";
  console.error(`口径账本：${entries.length} 条目断言 ${problems.length} 处红 —— ${mode}`);
  for (const p of problems) console.error(`  ${p}`);
  if (reportMode) {
    console.error(`（--report 档：结果只汇总不阻断；提交门禁请跑 --staged。账本见 ${ledgerRel}）`);
    process.exit(0);
  }
  console.error("修复：按各条目规则同步镜像／登记豁免／人工改锚后重试。");
  process.exit(1);
}
console.log(`口径账本：${entries.length} 条目断言全绿（禁出／镜像同步／锚点自检）。`);
