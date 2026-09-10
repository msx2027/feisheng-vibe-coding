#!/usr/bin/env node
/**
 * Cleans up deprecated Impeccable skill files, symlinks, and
 * skills-lock.json entries left over from previous versions.
 *
 * Safe to run repeatedly -- it is a no-op when nothing needs cleaning.
 *
 * Usage (from the project root):
 *   node {{scripts_path}}/cleanup-deprecated.mjs
 *
 * What it does:
 *   1. Finds every harness-specific skills directory (.claude/skills,
 *      .cursor/skills, .agents/skills, etc.).
 *   2. For each deprecated skill name (with and without i- prefix),
 *      checks if the directory exists and its SKILL.md mentions
 *      "impeccable" (to avoid deleting unrelated user skills).
 *   3. Deletes confirmed matches (files, directories, or symlinks).
 *   4. Removes the corresponding entries from skills-lock.json.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, rmSync, lstatSync, unlinkSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Skills that were renamed, merged, or folded in v2.0 and v2.1.
const DEPRECATED_NAMES = [
  'frontend-design',    // renamed to impeccable (v2.0)
  'teach-impeccable',   // folded into /impeccable teach (v2.0)
  'arrange',            // renamed to layout (v2.1)
  'normalize',          // merged into polish (v2.1)
  'onboard',            // merged into harden (v2.1)
  'extract',            // merged into /impeccable extract (v2.1)
];

// All known harness directories that may contain a skills/ subfolder.
const HARNESS_DIRS = [
  '.claude', '.cursor', '.gemini', '.codex', '.agents',
  '.trae', '.trae-cn', '.pi', '.opencode', '.kiro', '.rovodev',
];

/**
 * Walk up from startDir until we find a directory that looks like a
 * project root (has package.json, .git, or skills-lock.json).
 */
export function findProjectRoot(startDir = process.cwd()) {
  let dir = resolve(startDir);
  const { root } = { root: '/' };
  while (dir !== root) {
    if (
      existsSync(join(dir, 'package.json')) ||
      existsSync(join(dir, '.git')) ||
      existsSync(join(dir, 'skills-lock.json'))
    ) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(startDir);
}

/**
 * Check whether a skill directory belongs to Impeccable by reading its
 * SKILL.md and looking for the word "impeccable" (case-insensitive).
 * Returns false for non-existent paths or skills that don't match.
 */
export function isImpeccableSkill(skillDir) {
  const skillMd = join(skillDir, 'SKILL.md');
  if (!existsSync(skillMd)) return false;
  try {
    const content = readFileSync(skillMd, 'utf-8');
    const frontmatter = content.match(/^---\s*\r?\n(?<body>.*?)\r?\n---/s)?.groups?.body || '';
    const declaredName = frontmatter.match(/^name:\s*['"]?(?<name>[^'"\r\n]+?)['"]?\s*$/m)?.groups?.name?.trim();
    const declaredSource = frontmatter.match(/^source:\s*['"]?(?<source>[^'"\r\n]+?)['"]?\s*$/m)?.groups?.source?.trim();
    const declaredRepository = frontmatter.match(/^repository:\s*['"]?(?<repository>[^'"\r\n]+?)['"]?\s*$/m)?.groups?.repository?.trim();
    const directoryName = basename(skillDir);
    const expectedNames = new Set([
      directoryName.toLowerCase(),
      directoryName.replace(/^i-/i, '').toLowerCase(),
    ]);
    return Boolean(
      declaredName &&
      expectedNames.has(declaredName.toLowerCase()) &&
      (
        declaredSource === 'pbakaus/impeccable' ||
        declaredRepository === 'pbakaus/impeccable' ||
        declaredRepository === 'https://github.com/pbakaus/impeccable'
      ),
    );
  } catch {
    return false;
  }
}

/**
 * Build the full list of names to check: each deprecated name, plus
 * its i-prefixed variant.
 */
export function buildTargetNames() {
  const names = [];
  for (const name of DEPRECATED_NAMES) {
    names.push(name);
    names.push(`i-${name}`);
  }
  return names;
}

/**
 * Find every skills directory across all harness dirs in the project.
 * Returns absolute paths that exist on disk.
 */
export function findSkillsDirs(projectRoot) {
  const dirs = [];
  const root = resolve(projectRoot);
  for (const harness of HARNESS_DIRS) {
    const candidate = join(root, harness, 'skills');
    if (existsSync(candidate) && !pathContainsSymlink(root, candidate)) {
      dirs.push(candidate);
    }
  }
  return dirs;
}

function pathContainsSymlink(root, candidate) {
  const relativePath = relative(resolve(root), resolve(candidate));
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) return true;
  let current = resolve(root);
  for (const segment of relativePath.split(/[/\\]+/).filter(Boolean)) {
    current = join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Remove deprecated skill directories/symlinks from all harness dirs.
 * Returns an array of paths that were deleted.
 */
export function removeDeprecatedSkills(projectRoot, { write = false } = {}) {
  const targets = buildTargetNames();
  const skillsDirs = findSkillsDirs(projectRoot);
  const deleted = [];

  for (const skillsDir of skillsDirs) {
    for (const name of targets) {
      const skillPath = join(skillsDir, name);

      // Use lstat to detect symlinks (existsSync follows symlinks and
      // returns false for dangling ones).
      let stat;
      try {
        stat = lstatSync(skillPath);
      } catch {
        continue; // does not exist at all
      }

      if (stat.isSymbolicLink()) {
        // Only remove live symlinks whose target has verifiable provenance.
        // A dangling link is reported by neither path because its ownership
        // cannot be established safely.
        const targetAlive = existsSync(skillPath);
        const isMatch = targetAlive && isImpeccableSkill(skillPath);
        if (isMatch) {
          if (write) unlinkSync(skillPath);
          deleted.push(skillPath);
        }
        continue;
      }

      // Regular directory -- verify it belongs to impeccable
      if (isImpeccableSkill(skillPath)) {
        if (write) rmSync(skillPath, { recursive: true, force: true });
        deleted.push(skillPath);
      }
    }
  }

  return deleted;
}

/**
 * Remove deprecated entries from skills-lock.json.
 * Only removes entries whose source is "pbakaus/impeccable".
 * Returns the list of removed skill names.
 */
export function cleanSkillsLock(projectRoot, { write = false } = {}) {
  const plan = planSkillsLockCleanup(projectRoot);
  if (write && plan.removed.length > 0) {
    commitSkillsLockCleanup(plan);
  }
  return plan.removed;
}

function planSkillsLockCleanup(projectRoot) {
  const lockPath = join(projectRoot, 'skills-lock.json');
  if (!existsSync(lockPath)) {
    return { lockPath, originalContent: '', updatedContent: '', removed: [] };
  }

  const lockStat = lstatSync(lockPath);
  if (lockStat.isSymbolicLink() || !lockStat.isFile()) {
    throw new Error(`skills-lock.json must be a regular file: ${lockPath}`);
  }

  let originalContent;
  let lock;
  try {
    originalContent = readFileSync(lockPath, 'utf-8');
    lock = JSON.parse(originalContent);
  } catch (error) {
    throw new Error(`Cannot safely update skills-lock.json: ${error.message}`);
  }

  if (!lock.skills || typeof lock.skills !== 'object') {
    return { lockPath, originalContent, updatedContent: originalContent, removed: [] };
  }

  const targets = buildTargetNames();
  const removed = [];

  for (const name of targets) {
    const entry = lock.skills[name];
    if (!entry) continue;
    // Only remove if it belongs to impeccable
    if (entry.source === 'pbakaus/impeccable') {
      delete lock.skills[name];
      removed.push(name);
    }
  }

  return {
    lockPath,
    originalContent,
    updatedContent: JSON.stringify(lock, null, 2) + '\n',
    removed,
  };
}

function commitSkillsLockCleanup(plan) {
  const temporaryPath = `${plan.lockPath}.cleanup-${process.pid}.tmp`;
  try {
    if (lstatIfExists(temporaryPath)) {
      throw new Error(`Temporary cleanup path already exists: ${temporaryPath}`);
    }
    writeFileSync(temporaryPath, plan.updatedContent, 'utf-8');
    renameSync(temporaryPath, plan.lockPath);
  } finally {
    const temporaryStat = lstatIfExists(temporaryPath);
    if (temporaryStat) {
      if (temporaryStat.isSymbolicLink() || temporaryStat.isFile()) {
        unlinkSync(temporaryPath);
      } else {
        rmSync(temporaryPath, { recursive: true, force: true });
      }
    }
  }
}

function lstatIfExists(target) {
  try {
    return lstatSync(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function quarantineDeprecatedSkills(paths, renamePath) {
  const quarantined = [];
  try {
    paths.forEach((originalPath, index) => {
      const quarantinePath = `${originalPath}.cleanup-${process.pid}-${index}.pending`;
      if (lstatIfExists(quarantinePath)) {
        throw new Error(`Cleanup quarantine path already exists: ${quarantinePath}`);
      }
      renamePath(originalPath, quarantinePath);
      quarantined.push({ originalPath, quarantinePath });
    });
    return quarantined;
  } catch (error) {
    rollbackQuarantinedSkills(quarantined, renamePath);
    throw error;
  }
}

function rollbackQuarantinedSkills(quarantined, renamePath) {
  for (const item of [...quarantined].reverse()) {
    if (!lstatIfExists(item.quarantinePath)) continue;
    if (lstatIfExists(item.originalPath)) {
      throw new Error(`Cannot roll back cleanup because the original path was recreated: ${item.originalPath}`);
    }
    renamePath(item.quarantinePath, item.originalPath);
  }
}

function removeQuarantinedSkills(quarantined) {
  for (const item of quarantined) {
    const stat = lstatIfExists(item.quarantinePath);
    if (!stat) continue;
    if (stat.isSymbolicLink()) {
      unlinkSync(item.quarantinePath);
    } else {
      rmSync(item.quarantinePath, { recursive: true, force: true });
    }
  }
}

/**
 * Run the full cleanup. Returns a summary object.
 */
export function cleanup(projectRoot, { write = false, operations = {} } = {}) {
  const root = projectRoot || findProjectRoot();
  const matchedPaths = removeDeprecatedSkills(root, { write: false });
  const lockPlan = planSkillsLockCleanup(root);

  if (!write) {
    return {
      deletedPaths: [],
      removedLockEntries: [],
      candidatePaths: matchedPaths,
      candidateLockEntries: lockPlan.removed,
      projectRoot: root,
      write,
    };
  }

  const renamePath = operations.renamePath || renameSync;
  const commitLock = operations.commitLock || commitSkillsLockCleanup;
  const quarantined = quarantineDeprecatedSkills(matchedPaths, renamePath);
  try {
    if (lockPlan.removed.length > 0) {
      commitLock(lockPlan);
    }
  } catch (error) {
    rollbackQuarantinedSkills(quarantined, renamePath);
    throw error;
  }

  removeQuarantinedSkills(quarantined);
  return {
    deletedPaths: matchedPaths,
    removedLockEntries: lockPlan.removed,
    candidatePaths: [],
    candidateLockEntries: [],
    projectRoot: root,
    write,
  };
}

// CLI entry point
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const cliArgs = process.argv.slice(2);
  if (cliArgs.includes('-h') || cliArgs.includes('--help')) {
    console.log('Usage: node cleanup-deprecated.mjs [--dry-run|--write]');
    process.exit(0);
  }
  const unknown = cliArgs.filter((arg) => arg !== '--dry-run' && arg !== '--write');
  if (unknown.length > 0 || (cliArgs.includes('--dry-run') && cliArgs.includes('--write'))) {
    console.error(`Invalid arguments: ${unknown.join(', ') || '--dry-run and --write are mutually exclusive'}`);
    process.exit(2);
  }

  const write = cliArgs.includes('--write');
  const result = cleanup(undefined, { write });
  const paths = write ? result.deletedPaths : result.candidatePaths;
  const lockEntries = write ? result.removedLockEntries : result.candidateLockEntries;

  if (!write) {
    console.log('Dry run: no files were changed.');
  }

  if (paths.length === 0 && lockEntries.length === 0) {
    console.log('No verified deprecated Impeccable skills found. Nothing to clean up.');
  } else {
    if (paths.length > 0) {
      console.log(`${write ? 'Removed' : 'Would remove'} ${paths.length} deprecated skill(s):`);
      for (const p of paths) console.log(`  - ${p}`);
    }
    if (lockEntries.length > 0) {
      console.log(`${write ? 'Cleaned' : 'Would clean'} ${lockEntries.length} entry/entries from skills-lock.json:`);
      for (const name of lockEntries) console.log(`  - ${name}`);
    }
  }

  if (!write && (paths.length > 0 || lockEntries.length > 0)) {
    console.log('Re-run with --write to apply the verified cleanup.');
  }
}
