#!/usr/bin/env node
// 口径账本执行器的判定核（2026-10-01 自 check-caliber-ledger.mjs 拆出，与下游实接同批）。
//
// 为什么拆：下游项目的结构门禁普遍把生产文件上限钉在 300 行，口径是「存量只减不增」
// （fs-agent 为 tools/hotspot-policy.mjs 的 LIMITS.productionFileLines）。执行器带上「无声摘门」
// 三条门后涨到 390 行——接线器把它复制进目标项目 tools/ 的那一刻，对方第一次提交就被自己的门禁
// 拦下，「开箱可用」当场失效。故按职责拆，而不是压薄断言迁就行数：本模块不碰 console、不碰
// process.exit，畸形与坏正则一律 throw LedgerError 并携带成品诊断行，由 CLI 侧逐行落 stderr 后
// 非零退出。诊断文案与退出语义都在本模块定死，CLI 只负责装载、编排与输出；两侧行为由
// tests/test-check-caliber-ledger.mjs 与下游同套回归钉共同守住。
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** 账本自身的缺陷（损坏／畸形／正则不可编译）：lines 为成品诊断行，CLI 逐行打印后 exit 1。 */
export class LedgerError extends Error {
  constructor(lines) {
    super(lines.join("\n"));
    this.name = "LedgerError";
    this.lines = lines;
  }
}

// 键名白名单：写错的键（mirrors→mirror、require→requrie）在 JSON 里没有语义，会被当成
// 「这条目没有这道断言」——门就这样少装一道且全绿。未知键一律判畸形，不静默忽略。
export const ALLOWED_KEYS = {
  ledger: ["schemaVersion", "description", "skipDirs", "conventions", "entries"],
  entry: ["id", "title", "origin", "rule", "note", "truth", "mirrors", "scans", "pendingMirrors"],
  truth: ["path", "anchorRegex", "note"],
  mirror: ["path", "anchorRegex", "require", "forbid", "note"],
  scan: ["name", "include", "exclude", "forbid", "note"],
  pending: ["path", "why"],
};

export function compileRegex(source, where) {
  try {
    return new RegExp(source, "m");
  } catch (err) {
    throw new LedgerError([
      `错误：口径账本条目正则不可编译（${where}）：/${source}/ —— ${err.message}`,
      "修复：修正账本中该正则后重试；不许删账本静默放行。",
    ]);
  }
}

export function assertKnownKeys(obj, allowed, where, ledgerRel) {
  const unknown = Object.keys(obj).filter((k) => !allowed.includes(k));
  if (unknown.length === 0) return;
  throw new LedgerError([
    `错误：口径账本畸形（${ledgerRel}）：${where} 有无法识别的键 ${unknown.join("、")}（认得的键：${allowed.join("、")}）。`,
    "修复：改回正确键名。写错键名会让这道断言无声消失，比缺锚更危险。",
  ]);
}

export function normalizeGlob(glob) {
  // 反斜杠与 `./` 前缀都会让「同一个面」在 include／exclude／自跳三处对不上：
  // 实测 `./docs/**` 会让 exclude 整批失效、账本自跳失效而把自己判红，Windows 写法更静默。
  return glob.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function globToRegExp(glob, where) {
  const re = glob
    .split("/")
    .map((seg) =>
      seg === "**" ? ".+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, "[^/]*"),
    )
    .join("/");
  return compileRegex(`^${re}$`, where);
}

/** 账本根形态校验（键名白名单／conventions／entries）。与 skipDirs 校验分成两步是**顺序要求**：
 *  原执行器在 entries 为空数组时直接放行退出，skipDirs 写坏也不报——先合起来判会让「零条目＋坏
 *  skipDirs」从放行变阻断，改掉了既有语义。 */
export function checkLedgerShape(ledger, ledgerRel) {
  assertKnownKeys(ledger, ALLOWED_KEYS.ledger, "账本根", ledgerRel);
  if (
    ledger.conventions !== undefined &&
    (!Array.isArray(ledger.conventions) || ledger.conventions.some((c) => typeof c !== "string"))
  ) {
    throw new LedgerError([`错误：口径账本畸形（${ledgerRel}）：conventions 必须是字符串数组。`]);
  }
  if (!Array.isArray(ledger.entries)) {
    throw new LedgerError([
      `错误：口径账本畸形（${ledgerRel}）：entries 不是数组。`,
      "修复：补回 entries 数组（格式见账本 conventions 与既有条目）。",
    ]);
  }
}

/** 扫描跳过的目录名：账本可配（下游项目的产物目录各不相同，默认只跳最通用的三类）。
 *  写成非字符串数组一律判畸形——静默按默认值跑会让配置意图无声落空，等于一盏哑灯。 */
export function resolveSkipDirs(ledger, ledgerRel) {
  if (
    ledger.skipDirs !== undefined &&
    (!Array.isArray(ledger.skipDirs) || ledger.skipDirs.some((d) => typeof d !== "string"))
  ) {
    throw new LedgerError([
      `错误：口径账本畸形（${ledgerRel}）：skipDirs 必须是字符串数组。`,
      "修复：改成字符串数组（如 [\"node_modules\", \"dist\"]），或整字段删掉用默认值。",
    ]);
  }
  return new Set(ledger.skipDirs ?? ["node_modules", ".git", "target"]);
}

/** 条目预编译（畸形条目＝账本损坏，一律 throw）：把正则与 glob 一次编译好，主循环只做判定。 */
export function precompileEntries(ledger, ledgerRel) {
  return ledger.entries.map((e, idx) => {
    const where = `entries[${idx}]${e?.id ? `=${e.id}` : ""}`;
    const malformed = (msg) => {
      throw new LedgerError([
        `错误：口径账本畸形（${ledgerRel}）：${where} ${msg}`,
        "修复：按账本既有条目格式修正后重试；不许删除账本静默放行。",
      ]);
    };
    if (!e || typeof e !== "object" || !e.id) malformed("缺 id。");
    assertKnownKeys(e, ALLOWED_KEYS.entry, where, ledgerRel);
    if (e.truth) assertKnownKeys(e.truth, ALLOWED_KEYS.truth, `${where}.truth`, ledgerRel);
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
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) malformed(`${name} 必须是字符串数组。`);
      return v;
    };
    const pending = e.pendingMirrors ?? [];
    if (!Array.isArray(pending) || pending.some((p) => !p || typeof p.path !== "string")) {
      malformed("pendingMirrors 必须是 {path, why} 数组。");
    }
    pending.forEach((p, i) => assertKnownKeys(p, ALLOWED_KEYS.pending, `${where}.pendingMirrors[${i}]`, ledgerRel));
    if (e.mirrors !== undefined && (!Array.isArray(e.mirrors) || e.mirrors.some((m) => !m || typeof m.path !== "string"))) {
      malformed("mirrors 必须是 {path, ...} 数组。");
    }
    if (e.scans !== undefined && (!Array.isArray(e.scans) || e.scans.some((s) => !s || typeof s !== "object"))) {
      malformed("scans 必须是对象数组。");
    }
    const mirrors = (e.mirrors ?? []).map((m, i) => {
      assertKnownKeys(m, ALLOWED_KEYS.mirror, `${where}.mirrors[${i}]`, ledgerRel);
      return {
        path: m.path,
        anchor: m.anchorRegex ? compileRegex(m.anchorRegex, `${e.id}.mirrors.anchorRegex`) : null,
        require: strArr(m.require, `${e.id}.mirrors.require`).map((r) => compileRegex(r, `${e.id}.mirrors.require`)),
        forbid: strArr(m.forbid, `${e.id}.mirrors.forbid`).map((r) => compileRegex(r, `${e.id}.mirrors.forbid`)),
      };
    });
    const scans = (e.scans ?? []).map((s, i) => {
      assertKnownKeys(s, ALLOWED_KEYS.scan, `${where}.scans[${i}]`, ledgerRel);
      return {
        name: s.name ?? s.include?.join(",") ?? "scan",
        // include 保留原始 glob 串：树遍历种子要用字面前缀，正则化后不可逆。
        include: strArr(s.include, `${e.id}.scans.include`).map((g) => ({ glob: normalizeGlob(g), re: globToRegExp(normalizeGlob(g), `${e.id}.scans.include`) })),
        exclude: strArr(s.exclude, `${e.id}.scans.exclude`).map((g) => globToRegExp(normalizeGlob(g), `${e.id}.scans.exclude`)),
        forbid: strArr(s.forbid, `${e.id}.scans.forbid`).map((r) => compileRegex(r, `${e.id}.scans.forbid`)),
      };
    });
    // truth 锚点先编译（坏正则是账本内容缺陷，优先于「条目没有断言面」报出）；
    // 只有 truth 的条目钉不住任何抄件面：本执行器的价值在「改真源当批同步镜像」，
    // 无 mirrors 无 scans 的条目等于登记了一条没人执行的规矩，判畸形而不是恒绿。
    const truth = e.truth
      ? { path: e.truth.path, anchor: compileRegex(e.truth.anchorRegex, `${e.id}.truth.anchorRegex`) }
      : null;
    if (mirrors.length === 0 && scans.length === 0) {
      malformed("既无 mirrors 也无 scans：没有任何可断言的抄件面（要么登记镜像，要么登记禁出面）。");
    }
    return { id: e.id, title: e.title ?? "", rule: e.rule ?? "", truth, mirrors, scans, pending };
  });
}

/** 文件收集器：只走 include 涉及的子树，跳过 skipDirs，按种子目录缓存清单。 */
export function createScanner(root, skipDirs) {
  const cache = new Map(); // 种子目录 → 文件清单
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
  return {
    /** include 种子目录与该目录是否存在：区分「glob 写错＝门在空跑」与「该项目确实没这个面」。 */
    globSeed(glob) {
      const segs = glob.split("/");
      const wi = segs.findIndex((s) => /[*]/.test(s));
      const base = wi > 0 ? segs.slice(0, wi).join("/") : "";
      return { base, missing: !existsSync(path.join(root, base)) };
    },
    filesUnder(glob) {
      const seed = glob.split("/").findIndex((s) => /[*]/.test(s));
      // 无通配（精确文件路径）时以空串为根，不能用 "."：walkFiles 会产出 "./docs/.." 前缀，
      // 与条目里的 "docs/.." 永远对不上，禁出断言静默全绿成哑灯。
      const base = seed > 0 ? glob.split("/").slice(0, seed).join("/") : "";
      if (!cache.has(base)) cache.set(base, walkFiles(base, []));
      return cache.get(base);
    },
  };
}

/** 暂存面路径集（含删除与改名的旧名）；git 不可用时返回 {set:null, error}，由 CLI 决定降级口径。 */
export function stagedPathSet(root) {
  let out;
  try {
    out = execFileSync("git", ["-C", root, "diff", "--cached", "--name-status", "-z"], { encoding: "utf8" });
  } catch (err) {
    return { set: null, error: err };
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
  return { set, error: null };
}
