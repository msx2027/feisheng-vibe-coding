#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  buildRoutingManifestData,
  canonicalManifestJson,
  getRoutingManifestPath,
  writeRoutingManifest,
} from "./generate-routing-manifest.mjs";

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    write: false,
    json: false,
    output: "",
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--output") {
      options.output = argv[++index] || "";
    } else if (!arg.startsWith("--")) {
      options.root = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function readManifest(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    try {
      return { content, manifest: JSON.parse(content) };
    } catch (error) {
      return { content, parseError: error };
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { missing: true };
    }
    return { error };
  }
}

function validateManifestShape(manifest) {
  const issues = [];
  if (!manifest || typeof manifest !== "object") {
    return ["Manifest must be a JSON object."];
  }
  if (manifest.version !== 3) {
    issues.push(`Manifest version must be 3, got ${manifest.version}`);
  }
  if (!manifest.sourceHash || typeof manifest.sourceHash !== "string") {
    issues.push("Manifest must include sourceHash.");
  }
  if (!Array.isArray(manifest.skills)) {
    issues.push("Manifest must include skills array.");
    return issues;
  }

  const seen = new Set();
  const userOnlyIds = [];
  for (const skill of manifest.skills) {
    if (!skill.id) issues.push("Skill entry is missing id.");
    if (skill.id && seen.has(skill.id)) issues.push(`Duplicate skill id: ${skill.id}`);
    if (skill.id) seen.add(skill.id);
    if (typeof skill.routeHint !== "string") {
      issues.push(`${skill.id || "<unknown>"} routeHint must be a string.`);
    }
    if (!Array.isArray(skill.routeHints) || skill.routeHints.length === 0) {
      issues.push(`${skill.id || "<unknown>"} routeHints must be a non-empty array.`);
    } else if (skill.routeHints.some((hint) => typeof hint !== "string" || hint.trim() === "")) {
      issues.push(`${skill.id || "<unknown>"} routeHints must contain only non-empty strings.`);
    }
    if (!['user-only', 'router-only', 'event-only'].includes(skill.invocation)) {
      issues.push(`${skill.id || "<unknown>"} invocation must be user-only, router-only, or event-only.`);
    }
    const expectedActivation = skill.invocation === "user-only"
      ? "conversation-explicit"
      : skill.invocation === "event-only"
        ? "structured-event"
        : "conversation-gated";
    if (skill.activation !== expectedActivation) {
      issues.push(`${skill.id || "<unknown>"} activation must be ${expectedActivation}.`);
    }
    if (typeof skill.userInvocable !== "boolean") {
      issues.push(`${skill.id || "<unknown>"} userInvocable must be a boolean.`);
    }
    if (typeof skill.disableModelInvocation !== "boolean") {
      issues.push(`${skill.id || "<unknown>"} disableModelInvocation must be a boolean.`);
    }
    if (skill.invocation === "user-only") userOnlyIds.push(skill.id);
    if (skill.invocation === "user-only" && (skill.id !== "vibe-coding-skills" || !skill.userInvocable || !skill.disableModelInvocation)) {
      issues.push(`${skill.id || "<unknown>"} user-only invocation must be the disabled-model user-facing vibe-coding-skills entry.`);
    }
    if (skill.invocation === "router-only" && (skill.userInvocable || !skill.disableModelInvocation || skill.manualOnly !== true)) {
      issues.push(`${skill.id || "<unknown>"} router-only invocation must be non-user-invocable, model-disabled, and manualOnly.`);
    }
    if (skill.invocation === "event-only" && (skill.userInvocable || !skill.disableModelInvocation || skill.manualOnly !== undefined)) {
      issues.push(`${skill.id || "<unknown>"} event-only invocation must be non-user-invocable, model-disabled, and not manualOnly.`);
    }
    if (skill.manualOnly !== undefined && typeof skill.manualOnly !== "boolean") {
      issues.push(`${skill.id || "<unknown>"} manualOnly must be a boolean when present.`);
    }
    if (!Array.isArray(skill.risk)) {
      issues.push(`${skill.id || "<unknown>"} risk must be an array.`);
    }
    if (!Number.isInteger(skill.refs) || skill.refs < 0) {
      issues.push(`${skill.id || "<unknown>"} refs must be a non-negative integer.`);
    }
    if (!Number.isInteger(skill.tokens) || skill.tokens <= 0) {
      issues.push(`${skill.id || "<unknown>"} tokens must be a positive integer.`);
    }
  }

  if (userOnlyIds.length !== 1 || userOnlyIds[0] !== "vibe-coding-skills") {
    issues.push(`Exactly one user-only entry is required: vibe-coding-skills; got ${userOnlyIds.join(", ") || "none"}.`);
  }

  return issues;
}

function validateReferencePaths(root, referenceChecks) {
  const issues = [];
  for (const skill of referenceChecks || []) {
    for (const referencePath of skill.referencePaths) {
      const absolute = path.resolve(root, ...referencePath.split("/"));
      if (!isInside(path.resolve(root), absolute)) {
        issues.push(`${skill.id}: reference path escapes root ${referencePath}`);
      } else if (!fs.existsSync(absolute)) {
        issues.push(`${skill.id}: missing reference path ${referencePath}`);
      } else {
        const stat = fs.lstatSync(absolute);
        if (!stat.isFile() || stat.isSymbolicLink()) issues.push(`${skill.id}: reference path is not a regular file ${referencePath}`);
      }
    }
  }
  return issues;
}

function compareManifest(root, targetPath, expectedJson) {
  const current = readManifest(targetPath);
  if (current.error) {
    return [`Failed to read ${toPosix(targetPath)}: ${current.error.message}`];
  }
  if (current.missing) {
    return [
      `${toPosix(path.relative(root, targetPath))} is missing. Run: node tools/check-routing-manifest.mjs . --write`,
    ];
  }
  if (current.parseError) {
    return [`Failed to parse ${toPosix(path.relative(root, targetPath))}: ${current.parseError.message}`];
  }
  if (current.content !== expectedJson) {
    return [
      `${toPosix(path.relative(root, targetPath))} is stale. Run: node tools/check-routing-manifest.mjs . --write`,
    ];
  }
  return [];
}

function printText(root, targetPath, issues) {
  console.log("Routing manifest check");
  console.log(`Root: ${root}`);
  console.log(`Manifest: ${toPosix(targetPath)}`);
  if (issues.length === 0) {
    console.log("Result: PASS");
    return;
  }
  console.log("Result: FAIL");
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }
}

function main() {
  const options = parseArgs(process.argv);
  const root = path.resolve(options.root);
  const targetPath = getRoutingManifestPath(root, options.output);
  const { manifest: expected, referenceChecks } = buildRoutingManifestData(root);
  const expectedJson = canonicalManifestJson(expected);
  const expectedIssues = [
    ...validateManifestShape(expected),
    ...validateReferencePaths(root, referenceChecks),
  ];
  if (options.write && expectedIssues.length === 0) writeRoutingManifest(root, options.output);
  const current = readManifest(targetPath);
  const currentShapeIssues =
    current.manifest && !current.parseError && !current.missing && !current.error
      ? validateManifestShape(current.manifest)
      : [];
  const issues = [
    ...expectedIssues,
    ...currentShapeIssues,
    ...compareManifest(root, targetPath, expectedJson),
  ];

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          root,
          manifest: targetPath,
          ok: issues.length === 0,
          issues,
          skillCount: expected.skills.length,
          sourceHash: expected.sourceHash,
        },
        null,
        2,
      ),
    );
  } else {
    printText(root, targetPath, issues);
  }

  return issues.length === 0 ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 2;
}
