#!/usr/bin/env node
// README 架构图生成器：输出双主题（浅色/深色）SVG，GitHub 按 prefers-color-scheme 自适应。
// 产物：architecture-runtime[-dark].svg、architecture-pipeline[-dark].svg
// SVG 是生成物，不要手工编辑；改本文件后运行 `node docs/assets/architecture.mjs` 再生。

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const SANS = `-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif`;
const MONO = `ui-monospace,'Cascadia Code',Consolas,Menlo,monospace`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- 主题 ----------
const THEMES = {
  light: {
    bg: '#ffffff', shadow: 0.12,
    ink: '#0f172a', ink2: '#475569', ink3: '#94a3b8',
    band: '#f8fafc', bandBorder: '#e2e8f0',
    card: '#ffffff', cardBorder: '#e2e8f0',
    arrow: '#94a3b8',
    userBg: '#ecfdf5', userBorder: '#6ee7b7', userInk: '#047857',
    entryBorder: '#c7d2fe',
    claudeBg: '#f5f3ff', claudeBorder: '#c4b5fd', claudeInk: '#6d28d9',
    codexBg: '#f0fdfa', codexBorder: '#5eead4', codexInk: '#0f766e',
    cpBg: '#eff6ff', cpBorder: '#bfdbfe', cpChipBg: '#ffffff', cpChipBorder: '#bfdbfe', cpChipInk: '#1d4ed8',
    caps: {
      eng: { bg: '#fffbeb', border: '#fde68a', ink: '#b45309' },
      prd: { bg: '#eff6ff', border: '#bfdbfe', ink: '#1d4ed8' },
      ui:  { bg: '#fdf2f8', border: '#fbcfe8', ink: '#be185d' },
      chk: { bg: '#ecfdf5', border: '#a7f3d0', ink: '#047857' },
      evt: { bg: '#f5f3ff', border: '#ddd6fe', ink: '#6d28d9' },
    },
    adBg: '#ecfeff', adBorder: '#a5f3fc',
    truth: { boxBg: '#fffbeb', boxBorder: '#fde68a', pill: '#d97706' },
    gen:   { boxBg: '#ecfeff', boxBorder: '#a5f3fc', pill: '#0891b2' },
    gate:  { boxBg: '#f0fdf4', boxBorder: '#bbf7d0', pill: '#16a34a' },
    del:   { boxBg: '#f5f3ff', boxBorder: '#ddd6fe', pill: '#7c3aed' },
    hostsSolid: '#7c3aed',
  },
  dark: {
    bg: '#0d1117', shadow: 0.45,
    ink: '#e6edf3', ink2: '#9da7b3', ink3: '#6e7681',
    band: '#161b22', bandBorder: '#30363d',
    card: '#161b22', cardBorder: '#30363d',
    arrow: '#6e7681',
    userBg: '#10b98122', userBorder: '#10b98188', userInk: '#34d399',
    entryBorder: '#3b82f677',
    claudeBg: '#8b5cf626', claudeBorder: '#8b5cf688', claudeInk: '#c4b5fd',
    codexBg: '#14b8a626', codexBorder: '#14b8a688', codexInk: '#5eead4',
    cpBg: '#3b82f614', cpBorder: '#3b82f655', cpChipBg: '#3b82f61f', cpChipBorder: '#3b82f655', cpChipInk: '#93c5fd',
    caps: {
      eng: { bg: '#f59e0b16', border: '#f59e0b66', ink: '#fbbf24' },
      prd: { bg: '#3b82f616', border: '#3b82f666', ink: '#60a5fa' },
      ui:  { bg: '#ec489916', border: '#ec489966', ink: '#f472b6' },
      chk: { bg: '#10b98116', border: '#10b98166', ink: '#34d399' },
      evt: { bg: '#8b5cf616', border: '#8b5cf666', ink: '#a78bfa' },
    },
    adBg: '#06b6d410', adBorder: '#06b6d444',
    truth: { boxBg: '#f59e0b10', boxBorder: '#f59e0b55', pill: '#d97706' },
    gen:   { boxBg: '#06b6d410', boxBorder: '#06b6d455', pill: '#0891b2' },
    gate:  { boxBg: '#22c55e10', boxBorder: '#22c55e55', pill: '#16a34a' },
    del:   { boxBg: '#8b5cf610', boxBorder: '#8b5cf655', pill: '#7c3aed' },
    hostsSolid: '#6d28d9',
  },
};

// ---------- 基元 ----------
function doc(w, h, th, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${SANS}">
<defs>
<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="${th.shadow}"/></filter>
${defs}
</defs>
<rect width="${w}" height="${h}" fill="${th.bg}"/>
${body}
</svg>\n`;
}

const marker = (id, color) =>
  `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>`;

const T = (x, y, s, { size = 11, fill, w = 400, anchor = 'start', ff = SANS, ls, halo } = {}) => {
  const style = halo ? ` style="paint-order:stroke" stroke="${halo}" stroke-width="4" stroke-linejoin="round"` : '';
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${w}" text-anchor="${anchor}" font-family="${ff}"${ls ? ` letter-spacing="${ls}"` : ''}${style}>${esc(s)}</text>`;
};

const rect = (x, y, w, h, { fill, stroke, r = 10, sw = 1, shadow = false, dash } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${shadow ? ` filter="url(#sh)"` : ''}/>`;

const line = (x1, y1, x2, y2, { stroke, sw = 1.6, dash, marker: mk } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}${mk ? ` marker-end="url(#${mk})"` : ''}/>`;

// 居中多行卡片
function card({ x, y, w, h, fill, stroke, r = 10, shadow = true, lines, cx }) {
  const c = cx ?? x + w / 2;
  let s = rect(x, y, w, h, { fill, stroke, r, shadow });
  for (const ln of lines) s += T(c, y + ln.dy, ln.t, { size: ln.size ?? 11, fill: ln.fill, w: ln.w ?? 400, ff: ln.ff ?? SANS, anchor: 'middle', ls: ln.ls });
  return s;
}

const chip = (x, y, w, h, t, { bg, border, ink, size = 10.5 }) =>
  card({ x, y, w, h, fill: bg, stroke: border, r: h / 2, shadow: false, lines: [{ t, dy: h / 2 + 3.7, size, fill: ink, w: 600 }] });

const bandLabel = (x, y, cn, en, th) =>
  T(x, y, cn, { size: 10, fill: th.ink3, w: 700, ls: 1.4 }) + T(x + cn.length * 10.2 + 10, y, en.toUpperCase(), { size: 9, fill: th.ink3, w: 500, ls: 1.6 });

const arrowLabel = (x, y, t, th, { size = 10.5, fill, anchor = 'start', w = 600 } = {}) =>
  T(x, y, t, { size, fill: fill ?? th.ink2, w, anchor, halo: th.bg });

// ---------- 图 1：运行时架构 ----------
function runtimeSVG(th) {
  const W = 1160, H = 700;
  const defs = marker('m-ink', th.arrow) + marker('m-blue', '#3b82f6') + marker('m-green', '#10b981');
  const blue = th.dark ? '#60a5fa' : '#2563eb';
  const green = th.dark ? '#34d399' : '#059669';
  let b = '';

  // 标题
  b += T(70, 42, '运行时架构', { size: 16, fill: th.ink, w: 700 });
  b += T(178, 42, 'RUNTIME ARCHITECTURE', { size: 10, fill: th.ink3, w: 600, ls: 2 });
  b += T(1090, 42, 'feisheng-vibe-coding', { size: 10.5, fill: th.ink3, ff: MONO, anchor: 'end' });

  // 用户
  b += card({ x: 390, y: 62, w: 380, h: 48, fill: th.userBg, stroke: th.userBorder, r: 24, shadow: true, lines: [
    { t: '用户 · 自然语言目标', dy: 21, size: 13, fill: th.userInk, w: 700 },
    { t: 'User · natural-language goal', dy: 38, size: 10, fill: th.ink2 },
  ] });
  b += line(580, 114, 580, 134, { stroke: th.arrow, marker: 'm-ink' });

  // 宿主层
  b += rect(70, 140, 1020, 110, { fill: th.band, stroke: th.bandBorder, r: 14, shadow: true });
  b += bandLabel(90, 162, '宿主', 'Hosts', th);
  b += T(772, 170, '已验证宿主 verified hosts', { size: 9.5, fill: th.ink3 });
  b += chip(772, 178, 150, 32, 'Claude Code', { bg: th.claudeBg, border: th.claudeBorder, ink: th.claudeInk });
  b += chip(936, 178, 118, 32, 'Codex', { bg: th.codexBg, border: th.codexBorder, ink: th.codexInk });
  b += card({ x: 310, y: 164, w: 430, h: 62, fill: th.card, stroke: th.entryBorder, r: 12, shadow: true, lines: [
    { t: '唯一入口 Single entry', dy: 26, size: 13, fill: th.ink, w: 700 },
    { t: 'feisheng-vibe-coding · SKILL.md', dy: 46, size: 11.5, fill: th.ink2, ff: MONO },
  ] });
  b += line(580, 250, 580, 272, { stroke: th.arrow, marker: 'm-ink' });

  // 控制面
  b += rect(70, 278, 1020, 106, { fill: th.cpBg, stroke: th.cpBorder, r: 14, shadow: true });
  b += bandLabel(90, 300, '治理控制面', 'Control plane', th);
  b += T(1074, 300, 'governance/sliver-core', { size: 10, fill: th.ink3, ff: MONO, anchor: 'end' });
  const cpChips = ['路由 Routing', '深度 Depth', '风险 Risk', '授权 Authz', '真源 Truth', '验收 Acceptance'];
  cpChips.forEach((t, i) => b += chip(90 + i * 118, 312, 108, 26, t, { bg: th.cpChipBg, border: th.cpChipBorder, ink: th.cpChipInk, size: 10 }));
  b += T(90, 366, '22 主路由 main routes · 31 操作 operations · 8 透镜 lenses', { size: 11, fill: th.ink2, w: 600 });

  // 控制面 ⇄ 能力
  b += line(430, 388, 430, 428, { stroke: blue, marker: 'm-blue' });
  b += arrowLabel(442, 410, '调用 invoke', th, { fill: blue });
  b += line(730, 428, 730, 388, { stroke: green, marker: 'm-green' });
  b += arrowLabel(742, 410, '只返回结果 / finding', th, { fill: green });
  b += arrowLabel(742, 424, '不得成为第二路由器 no second router', th, { size: 9, fill: th.ink3, w: 400 });

  // 内部能力
  b += rect(70, 434, 1020, 126, { fill: th.band, stroke: th.bandBorder, r: 14, shadow: true });
  b += bandLabel(90, 456, '内部能力', 'Internal capabilities', th);
  b += T(1074, 456, '52 进入 runtime · in runtime', { size: 10, fill: th.ink3, ff: MONO, anchor: 'end' });
  const caps = [
    { id: 'eng', name: 'engineering', n: '×13', cn: '工程原语 primitives', ex: 'TDD · review · modeling' },
    { id: 'prd', name: 'product', n: '×14', cn: '产品与交付', ex: 'spec · builder · release' },
    { id: 'ui', name: 'ui', n: '×16', cn: '界面与设计系统', ex: 'design-system · polish' },
    { id: 'chk', name: 'checker', n: '×5', cn: '专项检查', ex: 'audit · critique · harden' },
    { id: 'evt', name: 'event', n: '×3', cn: '事件沉淀', ex: 'elevator · engine · writer' },
  ];
  caps.forEach((c, i) => {
    const x = 84 + i * 202, y = 468, w = 184;
    b += card({ x, y, w, h: 76, fill: th.caps[c.id].bg, stroke: th.caps[c.id].border, r: 10, shadow: true, lines: [] });
    b += T(x + 12, y + 28, c.name, { size: 12.5, fill: th.caps[c.id].ink, w: 700, ff: MONO });
    b += T(x + w - 12, y + 28, c.n, { size: 12, fill: th.caps[c.id].ink, w: 700, anchor: 'end' });
    b += T(x + w / 2, y + 48, c.cn, { size: 10.5, fill: th.ink2, anchor: 'middle' });
    b += T(x + w / 2, y + 64, c.ex, { size: 9.5, fill: th.ink3, ff: MONO, anchor: 'middle' });
  });

  // 宿主适配层
  b += rect(70, 566, 1020, 108, { fill: th.adBg, stroke: th.adBorder, r: 14, shadow: true });
  b += bandLabel(90, 588, '宿主适配层', 'Host adapters', th);
  b += T(1074, 588, 'adapters/ · packaging + builders', { size: 10, fill: th.ink3, ff: MONO, anchor: 'end' });
  b += card({ x: 84, y: 598, w: 486, h: 62, fill: th.card, stroke: th.cardBorder, r: 10, shadow: true, lines: [
    { t: '运行时投影 Runtime projections', dy: 25, size: 12.5, fill: th.ink, w: 700 },
    { t: 'Codex 95 · Claude 93 · Shared 92 files', dy: 45, size: 10.5, fill: th.ink2, ff: MONO },
  ] });
  b += card({ x: 590, y: 598, w: 486, h: 62, fill: th.card, stroke: th.cardBorder, r: 10, shadow: true, lines: [
    { t: 'Hook 契约 v2 · 纠错信号采集', dy: 25, size: 12.5, fill: th.ink, w: 700 },
    { t: 'SessionStart 提醒 · UserPromptSubmit 采集 · Digest 消化', dy: 45, size: 9.5, fill: th.ink2 },
  ] });

  // 静态投影安装（虚线，右侧通道上行）
  b += `<path d="M 1090 628 H 1122 V 195 H 1096" fill="none" stroke="${th.arrow}" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#m-ink)"/>`;
  b += `<text x="1136" y="412" font-size="10" fill="${th.ink2}" font-weight="600" text-anchor="middle" transform="rotate(-90 1136 412)" style="paint-order:stroke" stroke="${th.bg}" stroke-width="4" stroke-linejoin="round">${esc('静态投影安装 static install')}</text>`;

  return doc(W, H, th, defs, b);
}

// ---------- 图 2：治理与构建流水线 ----------
function pipelineSVG(th) {
  const W = 1200, H = 502;
  const defs = marker('m-ink', th.arrow);
  let b = '';

  b += T(40, 42, '治理与构建流水线', { size: 16, fill: th.ink, w: 700 });
  b += T(198, 42, 'GOVERNANCE & BUILD PIPELINE', { size: 10, fill: th.ink3, w: 600, ls: 2 });
  b += T(1160, 42, 'truth → generated → gates → delivery', { size: 10.5, fill: th.ink3, ff: MONO, anchor: 'end' });

  const cols = [
    { x: 26,  g: th.truth, pill: '真源 TRUTH' },
    { x: 328, g: th.gen,   pill: '生成物 GENERATED' },
    { x: 630, g: th.gate,  pill: '门禁 GATES' },
    { x: 932, g: th.del,   pill: '投递 DELIVERY' },
  ];
  const BW = 246, TOP = 78, BH = 352;
  for (const c of cols) {
    b += rect(c.x, TOP, BW, BH, { fill: c.g.boxBg, stroke: c.g.boxBorder, r: 14, shadow: true });
    b += card({ x: c.x + BW / 2 - 62, y: TOP - 13, w: 124, h: 26, fill: c.g.pill, stroke: 'none', r: 13, shadow: true,
      lines: [{ t: c.pill, dy: 17.5, size: 10.5, fill: '#ffffff', w: 700, ls: 0.5 }] });
  }

  const cardLine = (colX, y, h, lines) => card({ x: colX + 16, y, w: BW - 32, h, fill: th.card, stroke: th.cardBorder, r: 10, shadow: true, lines });
  const CY = 296;

  // 列 1：真源
  b += cardLine(26, 112, 80, [
    { t: 'sources/', dy: 27, size: 12.5, fill: th.ink, w: 700, ff: MONO },
    { t: '只读快照 read-only snapshots', dy: 48, size: 10.5, fill: th.ink2 },
    { t: '唯一内容真源 · single content truth', dy: 65, size: 9.5, fill: th.ink3 },
  ]);
  b += cardLine(26, 206, 88, [
    { t: 'SKILL-CLASSIFICATION.json', dy: 26, size: 11, fill: th.ink, w: 700, ff: MONO },
    { t: '分类唯一写入点 sole write point', dy: 47, size: 10.5, fill: th.ink2 },
    { t: 'readiness · domain · routeBinding', dy: 64, size: 9, fill: th.ink3, ff: MONO },
  ]);
  b += cardLine(26, 308, 88, [
    { t: 'OWNER-LEDGER · LICENSE-MAP', dy: 26, size: 10.5, fill: th.ink, w: 700 },
    { t: 'LOCAL-PATCHES · SOURCE-INVENTORY', dy: 47, size: 9, fill: th.ink3, ff: MONO },
    { t: 'owner · 许可证 · 补丁台账', dy: 64, size: 9.5, fill: th.ink2 },
  ]);

  // 列 2：生成物
  b += cardLine(328, 112, 88, [
    { t: 'CANONICAL-CATALOG.json', dy: 26, size: 11, fill: th.ink, w: 700, ff: MONO },
    { t: '再生投影 · 禁止手工编辑 never hand-edit', dy: 47, size: 10, fill: th.ink2 },
    { t: 'bundle 逐文件 sha256 per-file', dy: 64, size: 9.5, fill: th.ink3 },
  ]);
  b += cardLine(328, 214, 80, [
    { t: 'docs/CAPABILITY-INDEX.md', dy: 27, size: 10.5, fill: th.ink, w: 700, ff: MONO },
    { t: '能力索引 capability index', dy: 48, size: 10.5, fill: th.ink2 },
    { t: '由分类再生 regenerated', dy: 65, size: 9.5, fill: th.ink3 },
  ]);
  b += cardLine(328, 308, 80, [
    { t: 'PROVENANCE-INTEGRITY.json', dy: 27, size: 10, fill: th.ink, w: 700, ff: MONO },
    { t: '完整性自证 integrity ledger', dy: 48, size: 10.5, fill: th.ink2 },
  ]);

  // 列 3：门禁
  const gx = 630 + 16, gw = BW - 32;
  b += rect(gx, 112, gw, 284, { fill: th.card, stroke: th.cardBorder, r: 10, shadow: true });
  b += `<path d="M ${630 + BW / 2} 138 l 20 8 v 20 c 0 16 -10 26 -20 32 c -10 -6 -20 -16 -20 -32 v -20 z" fill="${th.gate.pill}" opacity="0.92"/>`;
  b += T(630 + BW / 2, 168, '✓', { size: 14, fill: '#ffffff', w: 700, anchor: 'middle' });
  b += T(630 + BW / 2, 226, 'verify.ps1', { size: 13.5, fill: th.ink, w: 700, ff: MONO, anchor: 'middle' });
  b += T(630 + BW / 2, 246, '静态门禁 static gates', { size: 11, fill: th.ink2, anchor: 'middle' });
  b += T(630 + BW / 2, 264, '默认 15 步 default steps', { size: 10, fill: th.ink3, anchor: 'middle' });
  b += line(gx + 18, 280, gx + gw - 18, 280, { stroke: th.cardBorder, sw: 1 });
  const checks = ['catalog 同步 · 投影 ×3', 'NOTICE · 路由绑定', '来源快照完整性 · 保真树', 'Hook 契约 · 退役引用'];
  checks.forEach((t, i) => {
    b += T(652, 302 + i * 20, '✓', { size: 10, fill: th.gate.pill, w: 700 });
    b += T(666, 302 + i * 20, t, { size: 10, fill: th.ink2 });
  });
  b += T(630 + BW / 2, 384, '可选步 +1：宿主证据 / 发布包', { size: 9, fill: th.ink3, anchor: 'middle' });

  // 列 4：投递
  b += cardLine(932, 112, 84, [
    { t: '运行时投影 Runtime projections', dy: 27, size: 11.5, fill: th.ink, w: 700 },
    { t: 'Codex 95 · Claude 93 · Shared 92', dy: 48, size: 10, fill: th.ink2, ff: MONO },
    { t: 'packaging + builders ×3', dy: 65, size: 9, fill: th.ink3, ff: MONO },
  ]);
  b += cardLine(932, 212, 76, [
    { t: 'install-runtime-projection.ps1', dy: 28, size: 10, fill: th.ink, w: 700, ff: MONO },
    { t: '宿主投递 · DryRun / Force / Uninstall', dy: 50, size: 9.5, fill: th.ink2 },
  ]);
  b += card({ x: 948, y: 306, w: 214, h: 70, fill: th.hostsSolid, stroke: 'none', r: 10, shadow: true, lines: [
    { t: 'Claude Code · Codex', dy: 30, size: 12.5, fill: '#ffffff', w: 700 },
    { t: '已验证宿主 verified hosts', dy: 50, size: 9.5, fill: '#ffffff', },
  ] });
  b += line(1055, 196, 1055, 208, { stroke: th.arrow, marker: 'm-ink' });
  b += line(1055, 288, 1055, 302, { stroke: th.arrow, marker: 'm-ink' });

  // 列间箭头 + 标签胶囊
  const flow = [
    { x: 300, t1: '再生', t2: 'regenerate' },
    { x: 602, t1: '新鲜度', t2: 'freshness' },
    { x: 904, t1: '全绿', t2: 'all green' },
  ];
  for (const f of flow) {
    b += card({ x: f.x - 42, y: CY - 17, w: 84, h: 34, fill: th.card, stroke: th.arrow, r: 17, shadow: true, lines: [
      { t: f.t1, dy: 15, size: 11, fill: th.ink, w: 700 },
      { t: f.t2, dy: 28, size: 8.5, fill: th.ink3 },
    ] });
  }

  b += T(600, 468, '唯一可信的验收：fresh clone 下门禁全绿 · The only trustworthy acceptance — gates green on a fresh clone', { size: 11, fill: th.ink2, anchor: 'middle' });

  return doc(W, H, th, defs, b);
}

// ---------- 输出 ----------
const out = {
  'architecture-runtime.svg': runtimeSVG(THEMES.light),
  'architecture-runtime-dark.svg': runtimeSVG(THEMES.dark),
  'architecture-pipeline.svg': pipelineSVG(THEMES.light),
  'architecture-pipeline-dark.svg': pipelineSVG(THEMES.dark),
};
for (const [name, svg] of Object.entries(out)) {
  writeFileSync(join(HERE, name), svg, 'utf8');
  console.log('written', name);
}
