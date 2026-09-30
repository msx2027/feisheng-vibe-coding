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
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const compile = (source, where) => {
  try {
    return new RegExp(source, "m");
  } catch (err) {
    console.error(`错误：口径账本条目正则不可编译（${where}）：/${source}/ —— ${err.message}`);
    console.error("修复：修正账本中该正则后重试；不许删账本静默放行。");
    process.exit(1);
  }
};

let ledger;
try {
  ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
} catch (err) {
  console.error(`错误：口径账本不可读（${rel(ledgerPath)}）：${err.message}`);
  console.error("修复：恢复到上个提交的账本版本后重改；不许删除账本静默放行。");
  process.exit(1);
}
// 键名白名单：写错的键（mirrors→mirror、require→requrie）在 JSON 里没有语义，会被当成
// 「这条目没有这道断言」——门就这样少装一道且全绿。未知键一律判畸形，不静默忽略。
const ALLOWED_KEYS = {
  ledger: ["schemaVersion", "description", "skipDirs", "conventions", "entries"],
  entry: ["id", "title", "origin", "rule", "note", "truth", "mirrors", "scans", "pendingMirrors"],
  truth: ["path", "anchorRegex", "note"],
  mirror: ["path", "anchorRegex", "require", "forbid", "note"],
  scan: ["name", "include", "exclude", "forbid", "note"],
  pending: ["path", "why"],
};
function rejectUnknownKeys(obj, allowed, where) {
  const unknown = Object.keys(obj).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) {
    console.error(`错误：口径账本畸形（${rel(ledgerPath)}）：${where} 有无法识别的键 ${unknown.join("、")}（认得的键：${allowed.join("、")}）。`);
    console.error("修复：改回正确键名。写错键名会让这道断言无声消失，比缺锚更危险。");
    process.exit(1);
  }
}
rejectUnknownKeys(ledger, ALLOWED_KEYS.ledger, "账本根");
if (ledger.conventions !== undefined && (!Array.isArray(ledger.conventions) || ledger.conventions.some((c) => typeof c !== "string"))) {
  console.error(`错误：口径账本畸形（${rel(ledgerPath)}）：conventions 必须是字符串数组。`);
  process.exit(1);
}
if (!Array.isArray(ledger.entries)) {
  console.error(`错误：口径账本畸形（${rel(ledgerPath)}）：entries 不是数组。`);
  console.error("修复：补回 entries 数组（格式见账本 conventions 与既有条目）。");
  process.exit(1);
}
if (ledger.entries.length === 0) {
  console.log("口径账本：零条目，未登记任何口径，放行。");
  process.exit(0);
}

// 扫描跳过的目录名：账本可配（下游项目的产物目录各不相同，默认只跳最通用的三类）。
// 写成非字符串数组一律判畸形——静默按默认值跑会让配置意图无声落空，等于一盏哑灯。
if (ledger.skipDirs !== undefined && (!Array.isArray(ledger.skipDirs) || ledger.skipDirs.some((d) => typeof d !== "string"))) {
  console.error(`错误：口径账本畸形（${rel(ledgerPath)}）：skipDirs 必须是字符串数组。`);
  console.error("修复：改成字符串数组（如 [\"node_modules\", \"dist\"]），或整字段删掉用默认值。");
  process.exit(1);
}
const skipDirs = new Set(ledger.skipDirs ?? ["node_modules", ".git", "target"]);

// ---- 条目预编译（畸形条目＝账本损坏，fail-closed）----
const entries = ledger.entries.map((e, idx) => {
  const where = `entries[${idx}]${e?.id ? `=${e.id}` : ""}`;
  const malformed = (msg) => {
    console.error(`错误：口径账本畸形（${rel(ledgerPath)}）：${where} ${msg}`);
    console.error("修复：按账本既有条目格式修正后重试；不许删除账本静默放行。");
    process.exit(1);
  };
  if (!e || typeof e !== "object" || !e.id) malformed("缺 id。");
  rejectUnknownKeys(e, ALLOWED_KEYS.entry, where);
  if (e.truth) rejectUnknownKeys(e.truth, ALLOWED_KEYS.truth, `${where}.truth`);
  // truth.anchorRegex 缺失会让 new RegExp(undefined) 退化成恒匹配的空正则——断言永远绿，
  // 比根本没有锚更危险，故判畸形而不是补默认值。
  if (e.truth && typeof e.truth.anchorRegex !== "string") {
    malformed("truth.anchorRegex 缺失或非字符串（缺锚＝恒绿哑洞，fail-closed）。");
  }
  if (e.mirrors?.some((m) => m?.anchorRegex !== undefined && typeof m.anchorRegex !== "string")) {
    malformed("mirrors.anchorRegex 非字符串。");
  }
  const strArr = (v, name) => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
      malformed(`${name} 必须是字符串数组。`);
    }
    return v;
  };
  const pending = e.pendingMirrors ?? [];
  if (!Array.isArray(pending) || pending.some((p) => !p || typeof p.path !== "string")) {
    malformed("pendingMirrors 必须是 {path, why} 数组。");
  }
  pending.forEach((p, i) => rejectUnknownKeys(p, ALLOWED_KEYS.pending, `${where}.pendingMirrors[${i}]`));
  if (e.mirrors !== undefined && (!Array.isArray(e.mirrors) || e.mirrors.some((m) => !m || typeof m.path !== "string"))) {
    malformed("mirrors 必须是 {path, ...} 数组。");
  }
  if (e.scans !== undefined && (!Array.isArray(e.scans) || e.scans.some((s) => !s || typeof s !== "object"))) {
    malformed("scans 必须是对象数组。");
  }
  const mirrors = (e.mirrors ?? []).map((m, i) => {
    rejectUnknownKeys(m, ALLOWED_KEYS.mirror, `${where}.mirrors[${i}]`);
    return {
      path: m.path,
      anchor: m.anchorRegex ? compile(m.anchorRegex, `${e.id}.mirrors.anchorRegex`) : null,
      require: strArr(m.require, `${e.id}.mirrors.require`).map((r) => compile(r, `${e.id}.mirrors.require`)),
      forbid: strArr(m.forbid, `${e.id}.mirrors.forbid`).map((r) => compile(r, `${e.id}.mirrors.forbid`)),
    };
  });
  const scans = (e.scans ?? []).map((s, i) => {
    rejectUnknownKeys(s, ALLOWED_KEYS.scan, `${where}.scans[${i}]`);
    return {
      name: s.name ?? s.include?.join(",") ?? "scan",
      // include 保留原始 glob 串：树遍历种子要用字面前缀，正则化后不可逆。
      include: strArr(s.include, `${e.id}.scans.include`).map((g) => ({ glob: normalizeGlob(g), re: globToRegExp(normalizeGlob(g), `${e.id}.scans.include`) })),
      exclude: strArr(s.exclude, `${e.id}.scans.exclude`).map((g) => globToRegExp(normalizeGlob(g), `${e.id}.scans.exclude`)),
      forbid: strArr(s.forbid, `${e.id}.scans.forbid`).map((r) => compile(r, `${e.id}.scans.forbid`)),
    };
  });
  // truth 锚点先编译（坏正则是账本内容缺陷，优先于「条目没有断言面」报出）；
  // 只有 truth 的条目钉不住任何抄件：本执行器的价值在「改真源当批同步镜像」，
  // 无 mirrors 无 scans 的条目等于登记了一条没人执行的规矩，判畸形而不是恒绿。
  const truth = e.truth
    ? { path: e.truth.path, anchor: compile(e.truth.anchorRegex, `${e.id}.truth.anchorRegex`) }
    : null;
  if (mirrors.length === 0 && scans.length === 0) {
    malformed("既无 mirrors 也无 scans：没有任何可断言的抄件面（要么登记镜像，要么登记禁出面）。");
  }
  return {
    id: e.id,
    title: e.title ?? "",
    rule: e.rule ?? "",
    truth,
    mirrors,
    scans,
    pending,
  };
});

function normalizeGlob(glob) {
  // 反斜杠与 `./` 前缀都会让「同一个面」在 include／exclude／自跳三处对不上：
  // 实测 `./docs/**` 会让 exclude 整批失效、账本自跳失效而把自己判红，Windows 写法更静默。
  return glob.replace(/\\/g, "/").replace(/^\.\//, "");
}

function globToRegExp(glob, where) {
  const re = glob
    .split("/")
    .map((seg) =>
      seg === "**" ? ".+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, "[^/]*"),
    )
    .join("/");
  return compile(`^${re}$`, where);
}

// ---- 文件收集：只走 include 涉及的子树，跳过 skipDirs ----
function walkFiles(relDir, out) {
  let items;
  try {
    items = readdirSync(path.join(root, relDir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const it of items) {
    const r = relDir ? `${relDir}/${it.name}` : it.name;
    if (it.isDirectory()) {
      if (skipDirs.has(it.name)) continue;
      walkFiles(r, out);
    } else {
      out.push(r);
    }
  }
  return out;
}
const scanFileCache = new Map(); // include 首段 → 文件清单
function filesUnder(glob) {
  const seed = glob.split("/").findIndex((s) => /[*]/.test(s));
  // 无通配（精确文件路径）时以空串为根，不能用 "."：walkFiles 会产出 "./docs/.." 前缀，
  // 与条目里的 "docs/.." 永远对不上，禁出断言静默全绿成哑灯。
  const base = seed > 0 ? glob.split("/").slice(0, seed).join("/") : "";
  if (!scanFileCache.has(base)) scanFileCache.set(base, walkFiles(base, []));
  return scanFileCache.get(base);
}

const problems = [];
const defects = []; // 账本自身坏掉（禁出空跑／文件读不出），与「被钉对象漂移」分开：defects 在 --report 下也非零
function globSeed(glob) {
  const segs = glob.split("/");
  const wi = segs.findIndex((s) => /[*]/.test(s));
  const base = wi > 0 ? segs.slice(0, wi).join("/") : "";
  return { base, missing: !existsSync(path.join(root, base)) };
}
// 账本自身不算扫描面：条目里 forbid／require 的字面必然原样出现在账本里，若被扫到就是
// 「登记语义」被当成「现行口径」误伤。登记面不是用户可见面（同 CAL 规矩：审计与工作记录里
// 引用旧词属登记语义）。
const ledgerRel = rel(ledgerPath);
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
      const hits = filesUnder(inc.glob).filter((f) => inc.re.test(f));
      if (hits.length === 0) {
        // include 空集＝这道禁出正在空跑。分两种：目录在而一个文件都没命中＝glob 写错或目录改名，
        // 门被无声摘掉，任何模式都算坏账本（含 --report）；目录本身不存在＝这个项目确实没这个面
        // （如下游没用 GitHub Actions），只示众不判死，否则开箱接线第一天就红。
        const seed = globSeed(inc.glob);
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
function stagedPaths() {
  let out;
  try {
    out = execFileSync("git", ["-C", root, "diff", "--cached", "--name-status", "-z"], { encoding: "utf8" });
  } catch {
    // 降级仅限触达清单（建议性）；断言主面照跑，门禁不被绕过。但不许静默。
    console.error("警告：--staged 触达清单不可用（git diff --cached 失败，非仓库目录或 git 异常）；断言仍全量执行。");
    return new Set();
  }
  const toks = out.split("\0").filter(Boolean);
  const set = new Set();
  for (let i = 0; i < toks.length; ) {
    const code = toks[i];
    // 只有 R/C 记录是三 token（状态＋旧名＋新名）；T（typechange）与 M/A/D 同为两 token。
    // 误按三 token 消费会吞掉紧邻记录的路径。
    if (/^[RC]/.test(code)) {
      set.add(toks[i + 1].split(path.sep).join("/"));
      set.add(toks[i + 2].split(path.sep).join("/"));
      i += 3;
    } else {
      set.add(toks[i + 1].split(path.sep).join("/"));
      i += 2;
    }
  }
  return set;
}

if (stagedMode) {
  const staged = stagedPaths();
  const touched = [];
  for (const entry of entries) {
    const hit =
      (entry.truth && staged.has(entry.truth.path)) ||
      entry.mirrors.some((m) => staged.has(m.path)) ||
      entry.scans.some((s) =>
        [...staged].some((p) => s.include.some((inc) => inc.re.test(p)) && !s.exclude.some((ex) => ex.test(p))),
      );
    if (hit) touched.push(entry);
  }
  if (touched.length > 0) {
    console.log(`口径账本·本次改动触达条目（改真源须同批同步镜像，账本见 ${rel(ledgerPath)}）：`);
    for (const t of touched) console.log(`  - ${t.id} ${t.title}｜${t.rule}`);
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
  console.error(`修复：把 scans.include 指回真实存在的面（格式见 ${rel(ledgerPath)} 的 conventions）。`);
  process.exit(1);
}

if (problems.length > 0) {
  const mode = reportMode ? "报告（不阻断）" : "阻断";
  console.error(`口径账本：${entries.length} 条目断言 ${problems.length} 处红 —— ${mode}`);
  for (const p of problems) console.error(`  ${p}`);
  if (reportMode) {
    console.error(`（--report 档：结果只汇总不阻断；提交门禁请跑 --staged。账本见 ${rel(ledgerPath)}）`);
    process.exit(0);
  }
  console.error("修复：按各条目规则同步镜像／登记豁免／人工改锚后重试。");
  process.exit(1);
}
console.log(`口径账本：${entries.length} 条目断言全绿（禁出／镜像同步／锚点自检）。`);
