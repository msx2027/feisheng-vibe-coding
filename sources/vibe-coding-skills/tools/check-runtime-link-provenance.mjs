#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function parseArgs(argv) {
  const options = { packageRoot: "", links: [], json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--link") options.links.push(argv[++index] || "");
    else if (arg === "--json") options.json = true;
    else if (!arg.startsWith("-") && !options.packageRoot) options.packageRoot = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.packageRoot || options.links.length === 0) throw new Error("Usage: node tools/check-runtime-link-provenance.mjs <package-root> --link <path> [--link <path>] [--json]");
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const packageRoot = path.resolve(options.packageRoot);
  const entry = path.join(packageRoot, "skills", "vibe-coding-skills", "SKILL.md");
  if (!fs.existsSync(entry)) throw new Error(`Missing package entry: ${entry}`);
  const entryReal = fs.realpathSync(entry);
  const entryHash = sha256(entry);
  const results = options.links.map((link) => {
    const absolute = path.resolve(link);
    const real = fs.realpathSync(absolute);
    const expected = real === entryReal || real === fs.realpathSync(path.dirname(entry));
    return { link: absolute, realpath: real, entryHash, pointsIntoPackage: expected };
  });
  const failed = results.filter((result) => !result.pointsIntoPackage);
  const output = { ok: failed.length === 0, packageRoot, entry, entryHash, links: results };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
