#!/usr/bin/env node
// check-doc-governance.mjs —— 文档命名、归位与归档治理检查器（可移植，零依赖）。
// 口径真源：各项目归位规范（fs-agent 为 docs/项目治理/归位规范.md）＋宪法「文档真源与 Markdown 治理」。
// 共享工具在 ./doc-gov-shared.mjs，归档操作在 ./doc-gov-archive.mjs。
//
// 检查项（error 阻断）：E1 门面 H1 缺文件名词；E2 docs 空目录残留；E3 类目目录散落 md；
//   E4 全项目正文重名；E5 门面导航双向核对；E6 孤儿卷目录。
// warn 级：W1 H1 叙事变体；W2 门面文件夹直属未编号正文。ℹ 归档候选（frontmatter 完结信号）。
//
// 用法：
//   node check-doc-governance.mjs [--root <项目根>] [--config <json>]     检查，error 级退出码 1
//   node check-doc-governance.mjs --candidates [--root <项目根>]          只列归档候选
//   node check-doc-governance.mjs --archive <docs/路径/文件.md> [--reason <原因>]
//         一键归档：git mv ＋ 引用改链 ＋ 归档门面登记行；目标有未提交改动时拒绝执行。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, basename, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CONFIG, normKey, posixJoin, splitStem, extractH1, mdTargets,
  resolveTarget, loadConfig, walkMd, walkDirs,
} from './doc-gov-shared.mjs';
import { findArchiveCandidates, archiveFile } from './doc-gov-archive.mjs';

export { DEFAULT_CONFIG, findArchiveCandidates, archiveFile, loadConfig };

const toPosixDir = (p) => p.split('\\').join('/').replace(/\/$/, '');
const posixPath = (root, abs) => relative(root, abs).split('\\').join('/');

function buildDocContext(root, cfg) {
  const docsRel = toPosixDir(cfg.docsDir);
  const docsAbs = join(root, docsRel);
  const mdAbs = walkMd(docsAbs);
  const dirAbs = walkDirs(docsAbs);
  const mdRels = mdAbs.map((a) => posixPath(root, a));
  const dirRels = dirAbs.map((a) => posixPath(root, a));
  const dirRelSet = new Set(dirRels);
  const ownerPairs = [];
  const ownerMdSet = new Set();
  const ownerDirSet = new Set();
  for (const md of mdRels) {
    const dir = posixJoin(dirname(md), basename(md).replace(/\.md$/, ''));
    if (!dirRelSet.has(dir)) continue;
    ownerPairs.push({ mdRel: md, dirRel: dir });
    ownerMdSet.add(md);
    ownerDirSet.add(dir);
  }
  return {
    root, docsRel, docsAbs, archiveDirRel: toPosixDir(cfg.archive.dir),
    mdAbs, mdRels, dirAbs, dirRels, ownerPairs, ownerMdSet, ownerDirSet,
    exemptFiles: new Set((cfg.exemptions.files || []).map(normKey)),
    exemptDirNames: new Set(cfg.exemptions.dirs || []),
  };
}

// E1/W1：H1 与文件名词/主题（归档区正文冻结只 warn；豁免目录跳过；owner 门面 error、其余 warn）
function checkH1Consistency(ctx, problems) {
  const { mdAbs, mdRels, ownerMdSet, archiveDirRel, exemptFiles, exemptDirNames } = ctx;
  for (let i = 0; i < mdAbs.length; i++) {
    if (exemptFiles.has(normKey(mdRels[i]))) continue;
    if (dirname(mdRels[i]).split('/').some((s) => exemptDirNames.has(s))) continue;
    const inArchive = mdRels[i].startsWith(archiveDirRel + '/');
    const { numbered, topic } = splitStem(basename(mdRels[i]).replace(/\.md$/, ''));
    const h1 = extractH1(readFileSync(mdAbs[i], 'utf8'));
    if (h1 && h1.includes(topic)) continue;
    if (numbered || inArchive || !ownerMdSet.has(mdRels[i])) {
      problems.warns.push({
        file: mdRels[i],
        message: numbered ? `W1 分卷 H1 未含主题「${topic}」` : `W1 文档 H1 未含文件名词「${topic}」`,
      });
    } else {
      problems.errors.push({ file: mdRels[i], message: `E1 门面 H1 缺文件名词「${topic}」（文件改名后正文标题未同步）` });
    }
  }
}

// E2：空目录
function checkEmptyDirs(ctx, problems) {
  for (let i = 0; i < ctx.dirAbs.length; i++) {
    if (readdirSync(ctx.dirAbs[i]).length === 0) {
      problems.errors.push({ file: ctx.dirRels[i], message: 'E2 空目录残留（Git 不跟踪空目录，须手动删除）' });
    }
  }
}

// E4：全项目正文重名
function checkDuplicateNames(ctx, problems) {
  const byBase = new Map();
  for (const md of ctx.mdRels) {
    const base = basename(md);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(md);
  }
  for (const [base, files] of byBase) {
    if (files.length > 1) {
      problems.errors.push({ file: files[0], message: `E4 全项目正文重名：${base} → ${files.join('、')}` });
    }
  }
}

// E3：类目目录下散落 md
function checkLooseMarkdown(ctx, problems) {
  const { mdRels, ownerMdSet, ownerDirSet, docsRel, exemptFiles, exemptDirNames } = ctx;
  for (const md of mdRels) {
    if (exemptFiles.has(normKey(md)) || ownerMdSet.has(md)) continue;
    const parent = dirname(md);
    if (parent === docsRel) continue; // docs 顶层单文件门面合法
    if (parent.split('/').some((s) => exemptDirNames.has(s))) continue;
    const contained = [...ownerDirSet].some((od) => md.startsWith(od + '/'));
    if (!contained) {
      problems.errors.push({ file: md, message: 'E3 类目目录下散落 md（无同名文件夹、未登记）——应迁为编号分卷或归档' });
    }
  }
}

// E5：门面导航双向核对
function checkFacadeNavigation(ctx, problems) {
  const { root, ownerPairs } = ctx;
  for (const { mdRel, dirRel } of ownerPairs) {
    const mdAbsPath = join(root, mdRel);
    const registered = new Set();
    for (const target of mdTargets(readFileSync(mdAbsPath, 'utf8'))) {
      const resolved = resolveTarget(mdAbsPath, target);
      if (!resolved) continue;
      if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        problems.errors.push({ file: mdRel, message: `E5 门面链接悬空：${target}` });
        continue;
      }
      const resolvedRel = posixPath(root, resolved);
      if (resolvedRel === dirRel || resolvedRel.startsWith(dirRel + '/')) registered.add(normKey(resolvedRel));
    }
    const directChildren = readdirSync(join(root, dirRel), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => `${dirRel}/${e.name}`);
    for (const child of directChildren) {
      if (!registered.has(normKey(child))) {
        problems.errors.push({ file: child, message: `E5 实体卷未登记「${basename(mdRel)}」导航（022 型漏登）` });
      }
    }
  }
}

// E6：孤儿卷目录（含正文却无同名门面承接）
function dirStructure(absDir) {
  let loose = false;
  let structured = false;
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const sib = join(absDir, entry.name.replace(/\.md$/, ''));
      if (existsSync(sib) && statSync(sib).isDirectory()) structured = true;
      else loose = true;
    }
  }
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sib = join(absDir, `${entry.name}.md`);
    if (existsSync(sib) && statSync(sib).isFile()) {
      structured = true;
      continue;
    }
    const r = dirStructure(join(absDir, entry.name));
    if (r.structured) structured = true;
    if (r.loose) loose = loose || !r.structured;
  }
  return { loose, structured };
}

function checkOrphanDirs(ctx, problems) {
  const { dirAbs, dirRels, ownerDirSet, docsRel, exemptDirNames } = ctx;
  for (let i = 0; i < dirAbs.length; i++) {
    const rel = dirRels[i];
    if (ownerDirSet.has(rel)) continue; // 目录本身就是门面文件夹
    const relDocs = rel.slice(docsRel.length + 1);
    if (!relDocs || relDocs.split('/').some((s) => exemptDirNames.has(s))) continue;
    const { loose, structured } = dirStructure(dirAbs[i]);
    if (loose && !structured) {
      problems.errors.push({ file: rel, message: 'E6 孤儿卷目录：含正文 md 但无同名门面承接（目录名错字或漏建门面）' });
    }
  }
}

// W2：门面文件夹直属未编号正文（编号卷同名文件夹内豁免；归档目录豁免）
function checkVolumeNumbering(ctx, problems) {
  const { root, ownerPairs, archiveDirRel } = ctx;
  for (const { mdRel, dirRel } of ownerPairs) {
    if (dirRel === archiveDirRel) continue;
    if (splitStem(basename(mdRel).replace(/\.md$/, '')).numbered) continue;
    for (const entry of readdirSync(join(root, dirRel), { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const { numbered, appendix } = splitStem(entry.name.replace(/\.md$/, ''));
      if (!numbered && !appendix) {
        problems.warns.push({ file: `${dirRel}/${entry.name}`, message: 'W2 门面文件夹直属未编号正文（应为「编号-主题」分卷）' });
      }
    }
  }
}

// ---------- 结构检查 ----------

export function runChecks(rootAbs, config = DEFAULT_CONFIG) {
  const root = resolve(rootAbs);
  const ctx = buildDocContext(root, config);
  const problems = { errors: [], warns: [], infos: [] };
  if (!existsSync(ctx.docsAbs)) {
    problems.errors.push({ file: ctx.docsRel, message: `文档目录不存在：${ctx.docsRel}` });
    return problems;
  }
  checkH1Consistency(ctx, problems);
  checkEmptyDirs(ctx, problems);
  checkDuplicateNames(ctx, problems);
  checkLooseMarkdown(ctx, problems);
  checkFacadeNavigation(ctx, problems);
  checkOrphanDirs(ctx, problems);
  checkVolumeNumbering(ctx, problems);
  for (const c of findArchiveCandidates(root, config)) {
    problems.infos.push({
      file: c.path,
      message: `ℹ 归档候选：${c.path}（status: ${c.status}${c.date ? `，${c.date}` : ''}）——确认后 --archive 执行`,
    });
  }
  return problems;
}

// ---------- CLI ----------

function main(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const rootArg = get('--root') || process.cwd();
  const cfg = loadConfig(rootArg, get('--config'));

  const archiveTarget = get('--archive');
  if (archiveTarget) {
    try {
      const out = archiveFile(rootArg, archiveTarget, { reason: get('--reason'), config: cfg });
      console.log(`✓ 已归档：${out.from} → ${out.to}`);
      for (const l of out.linksUpdated) console.log(`  改链：${l}`);
      console.log(`✓ 归档门面已登记（${cfg.archive.facade}）`);
      console.log('提示：若项目有文档索引指纹检查，请运行 node tools/check-doc-index.mjs --fix 刷新。');
      return 0;
    } catch (e) {
      console.error(`✗ 归档拒绝：${e.message}`);
      return 1;
    }
  }

  const { errors, warns, infos } = runChecks(rootArg, cfg);
  if (get('--candidates')) {
    for (const i of infos) console.log(i.message);
    return 0;
  }
  for (const e of errors) console.error(`✗ ${e.file}：${e.message}`);
  for (const w of warns) console.warn(`△ ${w.file}：${w.message}`);
  for (const i of infos) console.log(i.message);
  console.log(`文档治理检查：${errors.length} 项 error，${warns.length} 项 warn，${infos.length} 项归档候选。`);
  return errors.length ? 1 : 0;
}

if (process.argv[1] && normKey(fileURLToPath(import.meta.url)) === normKey(resolve(process.argv[1]))) {
  process.exit(main(process.argv.slice(2)));
}
