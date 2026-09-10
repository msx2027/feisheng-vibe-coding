#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_REGULAR_LIMIT = 5000;
const DEFAULT_ROUTER_LIMIT = 3000;
const ROUTER_SKILLS = new Set(["beginner-flow-guide", "vibe-coding-skills"]);
const LOCAL_REFERENCE_SECTION_PATTERN =
  /^\s*(?:\[按需加载 references\]|#{1,6}\s*Reference Navigation\b)/im;
const REFERENCE_PATH_PATTERN =
  /(^|[^A-Za-z0-9_./-])((?:references|reference)\/[A-Za-z0-9._/-]+\.md|skills\/[A-Za-z0-9._-]+\/(?:references|reference)\/[A-Za-z0-9._/-]+\.md)\b/g;

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    regularLimit: DEFAULT_REGULAR_LIMIT,
    routerLimit: DEFAULT_ROUTER_LIMIT,
    strict: false,
    json: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--regular-limit") {
      options.regularLimit = Number(argv[++index]);
    } else if (arg === "--router-limit") {
      options.routerLimit = Number(argv[++index]);
    } else if (!arg.startsWith("--")) {
      options.root = path.resolve(arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.regularLimit) || options.regularLimit <= 0) {
    throw new Error("--regular-limit must be a positive number");
  }

  if (!Number.isFinite(options.routerLimit) || options.routerLimit <= 0) {
    throw new Error("--router-limit must be a positive number");
  }

  return options;
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function estimateTokens(content) {
  const cjk = (content.match(/[\u3400-\u9fff]/g) || []).length;
  const nonCjk = content.length - cjk;
  return Math.ceil(cjk + nonCjk / 4);
}

function listSkillFiles(root) {
  const skillsRoot = path.join(root, "skills");
  if (!fs.existsSync(skillsRoot)) {
    throw new Error(`Missing skills directory: ${skillsRoot}`);
  }

  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      skill: entry.name,
      filePath: path.join(skillsRoot, entry.name, "SKILL.md"),
      skillRoot: path.join(skillsRoot, entry.name),
    }))
    .filter((entry) => fs.existsSync(entry.filePath));
}

function hasReferenceNavigation(content) {
  return LOCAL_REFERENCE_SECTION_PATTERN.test(content);
}

// 明示"无 references"声明：规范要求即便没有 references 也要写独立 [按需加载 references] 段并写明
// "无，保持按需加载策略"。此时不应判为 misleading reference navigation。
const NO_REFERENCE_DECLARATION_PATTERN =
  /(无\s*references|无[，,]\s*保持按需加载|no\s+references)/i;
function declaresNoReferences(content) {
  return NO_REFERENCE_DECLARATION_PATTERN.test(content);
}

function extractReferencePaths(content) {
  const paths = new Set();
  let match;

  while ((match = REFERENCE_PATH_PATTERN.exec(content)) !== null) {
    paths.add(match[2]);
  }

  return Array.from(paths).sort();
}

function hasReferenceFiles(skillRoot) {
  for (const dirName of ["references", "reference"]) {
    const dir = path.join(skillRoot, dirName);
    if (
      fs.existsSync(dir) &&
      fs.readdirSync(dir, { withFileTypes: true }).some((entry) => entry.isFile())
    ) {
      return true;
    }
  }

  return false;
}

function resolveReferencePath(root, skillRoot, referencePath) {
  const normalized = referencePath.split("/").join(path.sep);
  if (referencePath.startsWith("skills/")) {
    return path.join(root, normalized);
  }

  return path.join(skillRoot, normalized);
}

function main() {
  const options = parseArgs(process.argv);
  const root = path.resolve(options.root);
  const results = [];
  const warnings = [];

  for (const entry of listSkillFiles(root)) {
    const content = readUtf8(entry.filePath);
    const tokenEstimate = estimateTokens(content);
    const isRouter = ROUTER_SKILLS.has(entry.skill);
    const limit = isRouter ? options.routerLimit : options.regularLimit;
    const relativePath = path.relative(root, entry.filePath).replace(/\\/g, "/");
    const hasNavigation = hasReferenceNavigation(content);
    const hasReferences = hasReferenceFiles(entry.skillRoot);
    const referencePaths = extractReferencePaths(content);
    const missingReferencePaths = referencePaths.filter((referencePath) => {
      return !fs.existsSync(resolveReferencePath(root, entry.skillRoot, referencePath));
    });

    const result = {
      skill: entry.skill,
      path: relativePath,
      tokenEstimate,
      limit,
      isRouter,
      hasReferenceNavigation: hasNavigation,
      hasReferenceFiles: hasReferences,
      referencePaths,
      missingReferencePaths,
      overBudget: tokenEstimate > limit,
      // 豁免：明示"无 references"（合规写法）且未引用任何 references 路径时，不算误导性导航。
      misleadingReferenceNavigation:
        (hasNavigation && !hasReferences && !declaresNoReferences(content)) ||
        missingReferencePaths.length > 0,
    };

    results.push(result);

    if (result.overBudget) {
      warnings.push(
        `${relativePath}: estimated ${tokenEstimate} token(s), limit ${limit}`,
      );
    }

    if (result.misleadingReferenceNavigation) {
      if (hasNavigation && !hasReferences) {
        warnings.push(
          `${relativePath}: declares reference navigation but no reference(s) directory with files was found`,
        );
      }

      if (missingReferencePaths.length > 0) {
        warnings.push(
          `${relativePath}: missing referenced file(s): ${missingReferencePaths.join(", ")}`,
        );
      }
    }
  }

  results.sort((a, b) => b.tokenEstimate - a.tokenEstimate);

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ root, warnings, results }, null, 2)}\n`);
  } else {
    console.log("Skill token budget diagnostic (read-only)");
    console.log(`Root: ${root}`);
    console.log(`Regular limit: ${options.regularLimit}; router limit: ${options.routerLimit}`);
    console.log("");
    for (const result of results) {
      const marker = result.overBudget ? "WARN" : "OK";
      console.log(
        `${marker} ${result.path} ~${result.tokenEstimate} token(s) / limit ${result.limit}`,
      );
    }

    if (warnings.length > 0) {
      console.log("");
      console.log("Warnings:");
      for (const warning of warnings) {
        console.log(`- ${warning}`);
      }
    }
  }

  if (options.strict && warnings.length > 0) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
