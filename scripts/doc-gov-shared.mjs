// doc-gov-shared.mjs —— 文档治理检查器的共享工具与配置加载。
// 口径真源：各项目归位规范；宪法「文档真源与 Markdown 治理」条款。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const DEFAULT_CONFIG = {
  docsDir: 'docs',
  archive: { dir: 'docs/归档', facade: 'docs/归档.md' },
  exemptions: { files: [], dirs: [] },
};

export const ARCHIVABLE_STATUS = new Set(['completed', 'resolved', 'deprecated']);

export const toPosix = (p) => p.split('\\').join('/');
export const normKey = (p) => toPosix(p).toLowerCase();
export const posixJoin = (...parts) => parts.filter((x) => x && x !== '.').join('/').replace(/\/+/g, '/');

export function walkMd(dirAbs, out = []) {
  if (!existsSync(dirAbs)) return out;
  for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
    const abs = join(dirAbs, entry.name);
    if (entry.isDirectory()) walkMd(abs, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(abs);
  }
  return out;
}

export function walkDirs(dirAbs, out = []) {
  if (!existsSync(dirAbs)) return out;
  for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const abs = join(dirAbs, entry.name);
    out.push(abs);
    walkDirs(abs, out);
  }
  return out;
}

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.+?)\s*$/.exec(line);
    if (kv) meta[kv[1]] = kv[2];
  }
  return meta;
}

export function extractH1(text) {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  const m = /^#\s+(.+?)\s*$/m.exec(body);
  return m ? m[1] : null;
}

// stem → { numbered, appendix, topic }
export function splitStem(stem) {
  let m = /^附录-\d{3}-(.+)$/.exec(stem);
  if (m) return { numbered: true, appendix: true, topic: m[1] };
  m = /^\d{3}-(.+)$/.exec(stem);
  if (m) return { numbered: true, appendix: false, topic: m[1] };
  return { numbered: false, appendix: false, topic: stem };
}

export function mdTargets(text) {
  const out = [];
  const re = /\]\(([^)\s]+\.md)\)/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

export function resolveTarget(fromFileAbs, target) {
  if (/^(https?:|mailto:|#|\/)/i.test(target)) return null;
  return normKey(resolve(dirname(fromFileAbs), decodeURIComponent(target)));
}

export function mergeConfig(base, patch) {
  if (!patch) return base;
  const out = { ...base, archive: { ...base.archive, ...(patch.archive || {}) }, exemptions: { ...base.exemptions } };
  if (patch.docsDir) out.docsDir = patch.docsDir;
  if (patch.exemptions) {
    out.exemptions.files = [...new Set([...(base.exemptions.files || []), ...(patch.exemptions.files || [])])];
    out.exemptions.dirs = [...new Set([...(base.exemptions.dirs || []), ...(patch.exemptions.dirs || [])])];
  }
  return out;
}

export function loadConfig(root, explicitPath) {
  const candidates = explicitPath ? [join(root, explicitPath)] : [join(root, 'tools/doc-governance.json')];
  for (const p of candidates) {
    if (existsSync(p)) return mergeConfig(DEFAULT_CONFIG, JSON.parse(readFileSync(p, 'utf8')));
  }
  return DEFAULT_CONFIG;
}

export function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.error) throw r.error;
  return r;
}
