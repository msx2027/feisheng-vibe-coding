#!/usr/bin/env node
/**
 * sync-brand-to-tokens.cjs
 *
 * Syncs brand-guidelines.md colors → design-tokens.json → design-tokens.css
 *
 * Usage:
 *   node sync-brand-to-tokens.cjs
 *   node sync-brand-to-tokens.cjs --dry-run
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');

// Paths
const BRAND_GUIDELINES = 'docs/brand-guidelines.md';
const DESIGN_TOKENS_JSON = 'assets/design-tokens.json';
const DESIGN_TOKENS_CSS = 'assets/design-tokens.css';
const GENERATE_TOKENS_SCRIPT = 'skills/design-system/scripts/generate-tokens.cjs';

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function inspectProjectFile(root, relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error(`Unsafe project-relative path: ${relativePath}`);
  }

  const rootStat = fs.lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`Project root must be a regular directory: ${root}`);
  }
  const realRoot = fs.realpathSync(root);
  const segments = normalized.split('/').filter(Boolean);
  const absolute = path.join(root, ...segments);
  let current = root;

  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        const realParent = fs.realpathSync(path.dirname(current));
        if (!isInside(realRoot, realParent)) throw new Error(`Project path resolves outside root: ${relativePath}`);
        return { path: absolute, relative: normalized, exists: false, stat: null };
      }
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Project path contains a symlink or junction: ${relativePath}`);
    const final = index === segments.length - 1;
    if (final ? !stat.isFile() : !stat.isDirectory()) {
      throw new Error(`Project path is not a regular ${final ? 'file' : 'directory'}: ${relativePath}`);
    }
    if (!isInside(realRoot, fs.realpathSync(current))) {
      throw new Error(`Project path resolves outside root: ${relativePath}`);
    }
    if (final) return { path: absolute, relative: normalized, exists: true, stat };
  }

  throw new Error(`Could not inspect project path: ${relativePath}`);
}

function tempRelative(relativePath, label, nonce) {
  const directory = path.posix.dirname(relativePath);
  const name = `.${path.posix.basename(relativePath)}.brand-${process.pid}-${nonce}.${label}`;
  return directory === '.' ? name : `${directory}/${name}`;
}

function removeRegularFile(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Refusing to remove unsafe temporary path: ${filePath}`);
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function commitGeneratedFiles(root, entries, nonce) {
  const assertExpected = (item, destination) => {
    if (item.expectedContent === null) {
      if (destination.exists) throw new Error(`Brand target changed after planning; expected missing file: ${item.destinationRelative}`);
      return;
    }
    if (!destination.exists) throw new Error(`Brand target changed after planning; expected existing file: ${item.destinationRelative}`);
    if (fs.readFileSync(destination.path, 'utf8') !== item.expectedContent) {
      throw new Error(`Brand target content changed after planning: ${item.destinationRelative}`);
    }
  };
  const prepared = entries.map((entry) => {
    const destination = inspectProjectFile(root, entry.destination);
    assertExpected(entry, destination);
    const temporary = inspectProjectFile(root, entry.temporary);
    if (!temporary.exists) throw new Error(`Generated temporary file is missing: ${entry.temporary}`);
    const backupRelative = tempRelative(entry.destination, 'backup', nonce);
    const backup = inspectProjectFile(root, backupRelative);
    if (backup.exists) throw new Error(`Backup path already exists: ${backupRelative}`);
    return { ...entry, destinationRelative: entry.destination, destination, temporary, backupRelative, backupPath: backup.path, installed: false, backedUp: false };
  });

  try {
    for (const item of prepared) {
      item.destination = inspectProjectFile(root, item.destinationRelative);
      assertExpected(item, item.destination);
      if (item.destination.exists) {
        fs.renameSync(item.destination.path, item.backupPath);
        item.backedUp = true;
      }
      fs.renameSync(item.temporary.path, item.destination.path);
      item.installed = true;
    }
  } catch (error) {
    for (const item of [...prepared].reverse()) {
      if (item.installed) removeRegularFile(item.destination.path);
      if (item.backedUp) fs.renameSync(item.backupPath, item.destination.path);
    }
    throw error;
  }

  for (const item of prepared) {
    if (item.backedUp) removeRegularFile(item.backupPath);
  }
}

/**
 * Extract color info from brand guidelines markdown
 */
function extractColorsFromMarkdown(content) {
  const colors = {
    primary: { name: 'primary', shades: {} },
    secondary: { name: 'secondary', shades: {} },
    accent: { name: 'accent', shades: {} }
  };

  // Extract primary color name and hex from Quick Reference table
  const quickRefMatch = content.match(/Primary Color\s*\|\s*#([A-Fa-f0-9]{6})\s*\(([^)]+)\)/);
  if (quickRefMatch) {
    colors.primary.name = quickRefMatch[2].toLowerCase().replace(/\s+/g, '-');
    colors.primary.base = `#${quickRefMatch[1]}`;
  }

  const secondaryMatch = content.match(/Secondary Color\s*\|\s*#([A-Fa-f0-9]{6})\s*\(([^)]+)\)/);
  if (secondaryMatch) {
    colors.secondary.name = secondaryMatch[2].toLowerCase().replace(/\s+/g, '-');
    colors.secondary.base = `#${secondaryMatch[1]}`;
  }

  const accentMatch = content.match(/Accent Color\s*\|\s*#([A-Fa-f0-9]{6})\s*\(([^)]+)\)/);
  if (accentMatch) {
    colors.accent.name = accentMatch[2].toLowerCase().replace(/\s+/g, '-');
    colors.accent.base = `#${accentMatch[1]}`;
  }

  // Extract all shades from Primary Colors table
  const primarySection = content.match(/### Primary Colors[\s\S]*?\|[\s\S]*?(?=###|$)/i);
  if (primarySection) {
    const hexMatches = primarySection[0].matchAll(/\*\*([^*]+)\*\*\s*\|\s*#([A-Fa-f0-9]{6})/g);
    for (const match of hexMatches) {
      const name = match[1].trim().toLowerCase();
      const hex = `#${match[2]}`;
      if (name.includes('dark')) colors.primary.dark = hex;
      else if (name.includes('light')) colors.primary.light = hex;
      else colors.primary.base = hex;
    }
  }

  // Extract secondary shades
  const secondarySection = content.match(/### Secondary Colors[\s\S]*?\|[\s\S]*?(?=###|$)/i);
  if (secondarySection) {
    const hexMatches = secondarySection[0].matchAll(/\*\*([^*]+)\*\*\s*\|\s*#([A-Fa-f0-9]{6})/g);
    for (const match of hexMatches) {
      const name = match[1].trim().toLowerCase();
      const hex = `#${match[2]}`;
      if (name.includes('dark')) colors.secondary.dark = hex;
      else if (name.includes('light')) colors.secondary.light = hex;
      else colors.secondary.base = hex;
    }
  }

  // Extract accent shades
  const accentSection = content.match(/### Accent Colors[\s\S]*?\|[\s\S]*?(?=###|$)/i);
  if (accentSection) {
    const hexMatches = accentSection[0].matchAll(/\*\*([^*]+)\*\*\s*\|\s*#([A-Fa-f0-9]{6})/g);
    for (const match of hexMatches) {
      const name = match[1].trim().toLowerCase();
      const hex = `#${match[2]}`;
      if (name.includes('dark')) colors.accent.dark = hex;
      else if (name.includes('light')) colors.accent.light = hex;
      else colors.accent.base = hex;
    }
  }

  return colors;
}

/**
 * Generate color scale from base color (simple approach)
 */
function generateColorScale(baseHex, darkHex, lightHex) {
  // Use provided shades or generate approximations
  return {
    "50": { "$value": lightHex || adjustBrightness(baseHex, 0.9), "$type": "color" },
    "100": { "$value": lightHex || adjustBrightness(baseHex, 0.8), "$type": "color" },
    "200": { "$value": adjustBrightness(baseHex, 0.6), "$type": "color" },
    "300": { "$value": adjustBrightness(baseHex, 0.4), "$type": "color" },
    "400": { "$value": adjustBrightness(baseHex, 0.2), "$type": "color" },
    "500": { "$value": baseHex, "$type": "color" },
    "600": { "$value": darkHex || adjustBrightness(baseHex, -0.15), "$type": "color" },
    "700": { "$value": adjustBrightness(baseHex, -0.3), "$type": "color" },
    "800": { "$value": adjustBrightness(baseHex, -0.45), "$type": "color" },
    "900": { "$value": adjustBrightness(baseHex, -0.6), "$type": "color" }
  };
}

/**
 * Adjust hex color brightness
 */
function adjustBrightness(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * percent)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + Math.round(255 * percent)));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + Math.round(255 * percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()}`;
}

/**
 * Update design tokens JSON
 */
function updateDesignTokens(tokens, colors) {
  // Update brand name
  const brandName = `Brand System - ${colors.primary.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`;
  tokens.brand = brandName;

  // Update primitive colors with new names
  const primitiveColors = tokens.primitive?.color || {};

  // Remove old color keys, add new ones
  delete primitiveColors.coral;
  delete primitiveColors.purple;
  delete primitiveColors.mint;

  // Add new named colors
  primitiveColors[colors.primary.name] = generateColorScale(
    colors.primary.base,
    colors.primary.dark,
    colors.primary.light
  );
  primitiveColors[colors.secondary.name] = generateColorScale(
    colors.secondary.base,
    colors.secondary.dark,
    colors.secondary.light
  );
  primitiveColors[colors.accent.name] = generateColorScale(
    colors.accent.base,
    colors.accent.dark,
    colors.accent.light
  );

  tokens.primitive.color = primitiveColors;

  // Update ALL semantic color references
  if (tokens.semantic?.color) {
    const sem = tokens.semantic.color;
    const p = colors.primary.name;
    const s = colors.secondary.name;
    const a = colors.accent.name;

    // Primary variants
    sem.primary = { "$value": `{primitive.color.${p}.500}`, "$type": "color" };
    sem['primary-hover'] = { "$value": `{primitive.color.${p}.600}`, "$type": "color" };
    sem['primary-active'] = { "$value": `{primitive.color.${p}.700}`, "$type": "color" };
    sem['primary-light'] = { "$value": `{primitive.color.${p}.400}`, "$type": "color" };
    sem['primary-lighter'] = { "$value": `{primitive.color.${p}.100}`, "$type": "color" };
    sem['primary-dark'] = { "$value": `{primitive.color.${p}.600}`, "$type": "color" };

    // Secondary variants
    sem.secondary = { "$value": `{primitive.color.${s}.500}`, "$type": "color" };
    sem['secondary-hover'] = { "$value": `{primitive.color.${s}.600}`, "$type": "color" };
    sem['secondary-light'] = { "$value": `{primitive.color.${s}.300}`, "$type": "color" };
    sem['secondary-dark'] = { "$value": `{primitive.color.${s}.600}`, "$type": "color" };

    // Accent variants
    sem.accent = { "$value": `{primitive.color.${a}.500}`, "$type": "color" };
    sem['accent-hover'] = { "$value": `{primitive.color.${a}.600}`, "$type": "color" };
    sem['accent-light'] = { "$value": `{primitive.color.${a}.300}`, "$type": "color" };

    // Status colors (use accent for success, primary for error/info)
    sem.success = { "$value": `{primitive.color.${a}.500}`, "$type": "color" };
    sem['success-light'] = { "$value": `{primitive.color.${a}.300}`, "$type": "color" };
    sem.error = { "$value": `{primitive.color.${p}.500}`, "$type": "color" };
    sem['error-light'] = { "$value": `{primitive.color.${p}.300}`, "$type": "color" };
    sem.info = { "$value": `{primitive.color.${s}.500}`, "$type": "color" };
    sem['info-light'] = { "$value": `{primitive.color.${s}.300}`, "$type": "color" };
  }

  // Update component references (button uses primary color with opacity)
  if (tokens.component?.button?.secondary) {
    const primaryBase = colors.primary.base;
    tokens.component.button.secondary['bg-hover'] = {
      "$value": `${primaryBase}1A`,
      "$type": "color"
    };
  }

  return tokens;
}

/**
 * Main
 */
function main() {
  const dryRun = process.argv.includes('--dry-run');
  const root = path.resolve(process.cwd());

  console.log('🔄 Syncing brand guidelines → design tokens\n');

  // Read brand guidelines
  const guidelines = inspectProjectFile(root, BRAND_GUIDELINES);
  if (!guidelines.exists) throw new Error(`Brand guidelines not found: ${guidelines.path}`);
  const guidelinesContent = fs.readFileSync(guidelines.path, 'utf-8');

  // Extract colors
  const colors = extractColorsFromMarkdown(guidelinesContent);
  console.log('📊 Extracted colors:');
  console.log(`   Primary: ${colors.primary.name} (${colors.primary.base})`);
  console.log(`   Secondary: ${colors.secondary.name} (${colors.secondary.base})`);
  console.log(`   Accent: ${colors.accent.name} (${colors.accent.base})\n`);

  // Read existing tokens
  const tokensState = inspectProjectFile(root, DESIGN_TOKENS_JSON);
  const originalTokensContent = tokensState.exists ? fs.readFileSync(tokensState.path, 'utf8') : null;
  let tokens = {};
  if (tokensState.exists) {
    tokens = JSON.parse(originalTokensContent);
  }

  // Update tokens
  tokens = updateDesignTokens(tokens, colors);

  if (dryRun) {
    console.log('📋 Would update design-tokens.json:');
    console.log(JSON.stringify(tokens.primitive.color, null, 2).slice(0, 500) + '...');
    console.log('\n⏭️  Dry run - no files changed');
    return;
  }

  const generator = inspectProjectFile(root, GENERATE_TOKENS_SCRIPT);
  if (!generator.exists) throw new Error(`Token generator not found: ${generator.path}`);
  const cssState = inspectProjectFile(root, DESIGN_TOKENS_CSS);
  const originalCssContent = cssState.exists ? fs.readFileSync(cssState.path, 'utf8') : null;

  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const jsonTemp = tempRelative(DESIGN_TOKENS_JSON, 'json.tmp', nonce);
  const cssTemp = tempRelative(DESIGN_TOKENS_CSS, 'css.tmp', nonce);
  const jsonTempState = inspectProjectFile(root, jsonTemp);
  const cssTempState = inspectProjectFile(root, cssTemp);
  if (jsonTempState.exists || cssTempState.exists) throw new Error('Brand sync temporary path already exists.');

  try {
    fs.writeFileSync(jsonTempState.path, `${JSON.stringify(tokens, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    execFileSync(process.execPath, [generator.path, '--config', jsonTemp, '-o', cssTemp], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      shell: false
    });
    const generatedCss = inspectProjectFile(root, cssTemp);
    if (!generatedCss.exists) throw new Error(`Token generator did not create ${cssTemp}`);
    commitGeneratedFiles(
      root,
      [
        { destination: DESIGN_TOKENS_JSON, temporary: jsonTemp, expectedContent: originalTokensContent },
        { destination: DESIGN_TOKENS_CSS, temporary: cssTemp, expectedContent: originalCssContent },
      ],
      nonce,
    );
  } finally {
    removeRegularFile(jsonTempState.path);
    removeRegularFile(cssTempState.path);
  }

  console.log(`✅ Updated: ${DESIGN_TOKENS_JSON}`);
  console.log(`✅ Regenerated: ${DESIGN_TOKENS_CSS}`);

  console.log('\n✨ Brand sync complete!');
}

try {
  main();
} catch (error) {
  console.error(`❌ Brand sync failed: ${error.message}`);
  process.exitCode = 1;
}
