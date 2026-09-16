// doc-gov-archive.mjs —— 归档候选检测与一键归档执行。
// 归档语义（归位规范第八节，2026-09-17）：检测全自动 + 执行一键确认；
// 机器判据只是候选，是否使命完结仍由人确认；有未提交改动时拒绝执行。
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ARCHIVABLE_STATUS, DEFAULT_CONFIG, normKey, parseFrontmatter, toPosix, walkMd, git } from './doc-gov-shared.mjs';

export function findArchiveCandidates(rootAbs, config = DEFAULT_CONFIG) {
  const cfg = config;
  const root = resolve(rootAbs);
  const docsAbs = join(root, cfg.docsDir);
  const archiveAbs = join(root, cfg.archive.dir);
  const out = [];
  for (const abs of walkMd(docsAbs)) {
    if (normKey(abs).startsWith(normKey(archiveAbs))) continue; // 已在归档区
    const meta = parseFrontmatter(readFileSync(abs, 'utf8'));
    if (!ARCHIVABLE_STATUS.has(meta.status)) continue;
    out.push({ path: toPosix(relative(root, abs)), status: meta.status, date: meta.closed || meta.resolved || '' });
  }
  return out;
}

export function archiveFile(rootAbs, relPath, { reason, config = DEFAULT_CONFIG, date } = {}) {
  const cfg = config;
  const root = resolve(rootAbs);
  const fromRel = toPosix(relPath).replace(/^\.\//, '');
  const docsRel = toPosix(cfg.docsDir).replace(/\/$/, '');
  const archiveDirRel = toPosix(cfg.archive.dir).replace(/\/$/, '');
  const facadeRel = toPosix(cfg.archive.facade);

  if (!fromRel.startsWith(docsRel + '/')) throw new Error(`归档目标不在 ${docsRel}/ 内：${fromRel}`);
  if (fromRel.startsWith(archiveDirRel + '/')) throw new Error(`目标已在归档目录内，无须归档：${fromRel}`);
  const fromAbs = join(root, fromRel);
  if (!existsSync(fromAbs) || !statSync(fromAbs).isFile()) throw new Error(`归档目标不存在：${fromRel}`);

  // 门禁：有未提交改动的文件不得归档（防止归掉在途工作）
  const st = git(root, ['status', '--porcelain', '--', fromRel]);
  if ((st.stdout || '').trim()) throw new Error(`目标有未提交改动，先收口再归档：${fromRel}`);

  // 门禁：归档门面必须存在
  const facadeAbs = join(root, facadeRel);
  if (!existsSync(facadeAbs)) throw new Error(`归档门面不存在：${facadeRel}`);

  const name = basename(fromRel);
  const toRel = `${archiveDirRel}/${name}`;
  const toAbs = join(root, toRel);
  if (existsSync(toAbs)) throw new Error(`归档目录已存在同名卷：${toRel}`);

  mkdirSync(join(root, archiveDirRel), { recursive: true });
  execFileSync('git', ['mv', fromRel, toRel], { cwd: root });

  // 引用改链：全 docs 内其他 md 中指向旧位置的相对链接改指新位置（归档卷正文本身一字不改）
  const linksUpdated = [];
  const docsAbs = join(root, docsRel);
  const oldKey = normKey(fromAbs);
  for (const mdAbs of walkMd(docsAbs)) {
    if (normKey(mdAbs) === normKey(toAbs)) continue;
    const text = readFileSync(mdAbs, 'utf8');
    let changed = false;
    const next = text.replace(/\]\(([^)\s]+\.md)([^)]*)\)/g, (whole, target, suffix) => {
      if (/^(https?:|mailto:|#|\/)/i.test(target)) return whole;
      const resolved = normKey(resolve(dirname(mdAbs), decodeURIComponent(target)));
      if (resolved !== oldKey) return whole;
      const newTarget = toPosix(relative(dirname(mdAbs), toAbs)).replace(/^\.\//, '');
      changed = true;
      linksUpdated.push(`${toPosix(relative(root, mdAbs))}: ${target} → ${newTarget}`);
      return `](${newTarget}${suffix})`;
    });
    if (changed) writeFileSync(mdAbs, next);
  }

  // 归档门面登记行
  const label = name.replace(/\.md$/, '');
  const facadeLink = toPosix(relative(dirname(facadeAbs), toAbs));
  const row = `| [${label}](${facadeLink}) | ${dirname(fromRel)}/ | ${reason || '使命完结，仅作历史留证'} | ${date || new Date().toISOString().slice(0, 10)} |\n`;
  let facadeText = readFileSync(facadeAbs, 'utf8');
  if (!facadeText.endsWith('\n')) facadeText += '\n';
  writeFileSync(facadeAbs, facadeText + row);

  return { moved: true, from: fromRel, to: toRel, linksUpdated, rowAppended: true };
}
