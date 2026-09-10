#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { assertSafeTargetRoot } from "./safe-target-fs.mjs";
import { loadTargetDocManifest } from "./target-doc-manifest-core.mjs";
import { checkMarkdownGovernance } from "./markdown-governance-core.mjs";

function parseArgs(argv) {
  const options = { root: "", force: false, json: false, help: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--force") options.force = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (!arg.startsWith("-") && !options.root) options.root = path.resolve(arg);
    else throw new Error(`Unknown or duplicate argument: ${arg}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  if (options.help || !options.root) {
    console.error("Usage: node tools/check-markdown-governance.mjs <target-root> [--force] [--json]");
    process.exitCode = options.help ? 0 : 2;
    return;
  }
  assertSafeTargetRoot(options.root);
  const { manifest } = loadTargetDocManifest(options.root, { allowLegacy: false });
  const result = checkMarkdownGovernance(options.root, manifest, { force: options.force });
  const payload = { ok: result.findings.length === 0, ...result };
  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else console.log(payload.ok ? "Markdown governance: PASS" : `Markdown governance: FAIL (${payload.findings.length})`);
  if (!payload.ok) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 2;
}
