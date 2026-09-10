#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  addExperience,
  bumpExperience,
  elevateExperience,
  parseLedger,
  parseLedgerForAnchorAdoption,
  removeExperience,
  renderLedgerMarkdown,
} from "./experience-ledger-core.mjs";
import {
  assertL1RegistryAnchorMatches,
  isL1RegistryAnchorAdoptionRequiredError,
  l1RegistryAnchorFromInfo,
} from "./experience-anchor-contract.mjs";
import {
  emptyExperienceRegistry,
  isAllowedExperienceRegistrationPath,
  parseExperienceRegistry,
  planExperienceRegistryContent,
  registryInfoFromRegistry,
} from "./experience-managed-blocks.mjs";
import { assertCurrentExperienceProjectionState, planTargetRuntimeUpdate } from "./init-target-runtime.mjs";
import { inspectTargetFile } from "./safe-target-fs.mjs";
import { commitTargetTransaction, sha256 } from "./target-doc-transaction.mjs";

function readText(root, file) {
  const state = inspectTargetFile(root, file);
  if (!state.exists) throw new Error(`required target file missing: ${file}`);
  return fs.readFileSync(state.path, "utf8");
}

function loadPaths(targetRoot) {
  const manifestState = inspectTargetFile(targetRoot, ".vibe-docs.json");
  if (!manifestState.exists) throw new Error("experience governance requires .vibe-docs.json");
  const manifest = JSON.parse(fs.readFileSync(manifestState.path, "utf8").replace(/^\uFEFF/u, ""));
  const ledger = manifest.experienceGovernance;
  const constitution = manifest.constitutionDesign || "docs/项目治理/宪法设计.md";
  if (typeof ledger !== "string" || ledger === "") {
    throw new Error("experienceGovernance is not enabled in .vibe-docs.json");
  }
  return { ledger, constitution };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findExperience(ledger, id) {
  return [...ledger.experiences, ...(Array.isArray(ledger.archived) ? ledger.archived : [])]
    .find((item) => item.id === id);
}

function eventReplay(ledger, request) {
  if (request.action !== "record" || !request.event?.eventId) return null;
  const existing = ledger.processedEvents.find((item) => item?.eventId === request.event.eventId);
  if (!existing) return null;
  const eventMatches = ["eventId", "signalType", "scope", "promptHash", "occurredAt"]
    .every((field) => existing[field] === request.event[field]);
  const experienceMatches = request.experienceId
    ? existing.experienceId === request.experienceId
    : findExperience(ledger, existing.experienceId)?.summary === request.summary;
  if (!eventMatches || !experienceMatches) {
    throw new Error("eventId collision: payload or experience does not match the processed event");
  }
  return { ok: true, action: request.action, replayed: true, revision: ledger.revision, changed: [] };
}

function verifiedFile(targetRoot, file, label) {
  if (typeof file !== "string" || file.trim() === "") throw new Error(`${label} path is required`);
  const state = inspectTargetFile(targetRoot, file);
  if (!state.exists) throw new Error(`${label} missing: ${file}`);
  const content = fs.readFileSync(state.path, "utf8");
  return { path: file, content, hash: sha256(content) };
}

function normalizedCommandPath(value) {
  return String(value).trim().replaceAll("\\", "/").replace(/^\.\//u, "");
}

function tokenizeCanonicalCommand(value) {
  const source = String(value);
  const words = [];
  let index = 0;
  while (index < source.length) {
    while (/\s/u.test(source[index] || "")) index += 1;
    if (index >= source.length) break;
    const quote = source[index] === '"' || source[index] === "'" ? source[index] : null;
    if (quote) {
      const end = source.indexOf(quote, index + 1);
      if (end === -1) return null;
      words.push({ value: source.slice(index + 1, end), quoted: true });
      index = end + 1;
      if (index < source.length && !/\s/u.test(source[index])) return null;
      continue;
    }
    const start = index;
    while (index < source.length && !/\s/u.test(source[index])) {
      if (source[index] === '"' || source[index] === "'") return null;
      index += 1;
    }
    words.push({ value: source.slice(start, index), quoted: false });
  }
  return words;
}

function splitCanonicalCommandSegments(value) {
  const source = String(value);
  const segments = [];
  let quote = null;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "|" && source[index + 1] !== "|") return null;
    if (char === "&" && source[index + 1] !== "&") {
      const leadingCallOperator = source.slice(start, index).trim() === "";
      if (!leadingCallOperator) return null;
      continue;
    }
    let separatorLength = 0;
    if (char === ";" || char === "\n") separatorLength = 1;
    else if (char === "\r" && source[index + 1] === "\n") separatorLength = 2;
    else if ((char === "&" && source[index + 1] === "&") || (char === "|" && source[index + 1] === "|")) separatorLength = 2;
    if (separatorLength === 0) continue;
    const adjacent = source[index + separatorLength];
    if (adjacent === ";" || adjacent === "&" || adjacent === "|") return null;
    segments.push({ command: source.slice(start, index), separator: source.slice(index, index + separatorLength) });
    start = index + separatorLength;
    index += separatorLength - 1;
  }
  segments.push({ command: source.slice(start), separator: null });
  return segments;
}

function analyzeExecutableCommand(command, checkerPath) {
  const normalizedChecker = normalizedCommandPath(checkerPath);
  const checkerReferencedInSource = String(command).replaceAll("\\", "/").includes(normalizedChecker);
  const matches = [];
  const segments = splitCanonicalCommandSegments(command);
  if (segments === null) return { valid: false, checkerReferenced: checkerReferencedInSource, matches };
  for (let index = 0; index < segments.length; index += 1) {
    const { command: rawSegment, separator: nextSeparator } = segments[index];
    const previousSeparator = index === 0 ? null : segments[index - 1].separator;
    const segment = rawSegment.trim();
    if (!segment) {
      const nextIsNewline = nextSeparator === "\n" || nextSeparator === "\r\n";
      const previousAllowsBlankLine = previousSeparator === null
        || previousSeparator === ";"
        || previousSeparator === "\n"
        || previousSeparator === "\r\n";
      const validBlankLine = nextIsNewline && previousAllowsBlankLine;
      const validTrailingTerminator = nextSeparator === null
        && (previousSeparator === ";" || previousSeparator === "\n" || previousSeparator === "\r\n");
      if (validBlankLine || validTrailingTerminator) continue;
      return { valid: false, checkerReferenced: checkerReferencedInSource, matches: [] };
    }
    const tokens = tokenizeCanonicalCommand(segment);
    if (tokens === null) return { valid: false, checkerReferenced: checkerReferencedInSource, matches: [] };
    if (tokens[0]?.value === "&" && !tokens[0].quoted) {
      tokens.shift();
      if (tokens.length === 0) return { valid: false, checkerReferenced: checkerReferencedInSource, matches: [] };
    }
    const normalizedTokens = tokens.map((token) => normalizedCommandPath(token.value));
    const checkerReferenced = normalizedTokens.includes(normalizedChecker);
    const executable = normalizedTokens.shift()?.split("/").at(-1) || "";
    const args = normalizedTokens;
    let canonicalCheckerCommand = false;
    if (executable === "node" || executable === "node.exe") {
      canonicalCheckerCommand = args[0] === normalizedChecker;
    } else if (["powershell", "powershell.exe", "pwsh", "pwsh.exe"].includes(executable)) {
      canonicalCheckerCommand = args[0]?.toLowerCase() === "-file" && args[1] === normalizedChecker;
    } else if (["bash", "bash.exe", "sh", "sh.exe"].includes(executable)) {
      canonicalCheckerCommand = args[0] === normalizedChecker;
    }
    if (canonicalCheckerCommand) {
      matches.push(segment);
      continue;
    }
    if (checkerReferenced) return { valid: false, checkerReferenced: true, matches: [] };
  }
  return { valid: true, checkerReferenced: checkerReferencedInSource, matches };
}

function packageRegistrations(content, checkerPath) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`package.json registration is invalid JSON: ${error.message}`);
  }
  if (!parsed?.scripts || typeof parsed.scripts !== "object" || Array.isArray(parsed.scripts)) return [];
  const matches = [];
  for (const [name, command] of Object.entries(parsed.scripts)) {
    if (typeof command !== "string") continue;
    const analysis = analyzeExecutableCommand(command, checkerPath);
    if (!analysis.valid) {
      if (analysis.checkerReferenced) return null;
      continue;
    }
    for (const matched of analysis.matches) {
      matches.push({ type: "package-script", entry: `scripts.${name}`, command: matched });
    }
  }
  return matches;
}

function commandBlockRegistrations(lines, checkerPath) {
  const commands = lines.map((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("#") ? "" : trimmed;
  });
  const blockAnalysis = analyzeExecutableCommand(commands.join("\n"), checkerPath);
  if (!blockAnalysis.valid) return blockAnalysis.checkerReferenced ? null : [];
  if (blockAnalysis.matches.length === 0) return [];
  const matches = [];
  for (let index = 0; index < commands.length; index += 1) {
    const line = commands[index];
    if (!line) continue;
    const analysis = analyzeExecutableCommand(line, checkerPath);
    if (!analysis.valid) return analysis.checkerReferenced ? null : [];
    for (const command of analysis.matches) matches.push({ index, command });
  }
  return matches;
}

function previousYamlParent(lines, fromIndex, childIndent) {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.match(/^ */u)?.[0].length || 0;
    if (indent < childIndent) return { index, indent, trimmed };
  }
  return null;
}

function yamlMappingKey(trimmed) { return trimmed.match(/^(?<key>[A-Za-z0-9_.-]+):(?: +(?:#.*)?)?$/u)?.groups?.key || null; }
function yamlMappingKeyWithValue(trimmed) { return trimmed.match(/^(?<key>[A-Za-z0-9_.-]+):(?:$| +.*$)/u)?.groups?.key || null; }
function decodeYamlDoubleQuotedKey(raw) {
  let value = "";
  const simpleEscapes = { "0": "\0", a: "\u0007", b: "\b", t: "\t", n: "\n", v: "\u000B", f: "\f", r: "\r", e: "\u001B", " ": " ", '"': '"', "/": "/", "\\": "\\", N: "\u0085", _: "\u00A0", L: "\u2028", P: "\u2029" };
  for (let index = 1; index < raw.length - 1; index += 1) {
    const char = raw[index];
    if (char !== "\\") { value += char; continue; }
    const escape = raw[index + 1];
    const digits = escape === "x" ? 2 : escape === "u" ? 4 : escape === "U" ? 8 : 0;
    if (digits > 0) {
      const hex = raw.slice(index + 2, index + 2 + digits);
      const codePoint = Number.parseInt(hex, 16);
      if (!new RegExp(`^[0-9A-Fa-f]{${digits}}$`, "u").test(hex) || codePoint > 0x10FFFF) return null;
      value += String.fromCodePoint(codePoint);
      index += digits + 1;
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(simpleEscapes, escape)) return null;
    value += simpleEscapes[escape]; index += 1;
  }
  return value;
}
function yamlMappingKeyLike(trimmed) {
  const listItem = trimmed.startsWith("- ");
  const body = listItem ? trimmed.slice(2).trimStart() : trimmed;
  const canonical = yamlMappingKeyWithValue(body);
  if (canonical) return { key: canonical, listItem, quoted: false };
  const doubleQuoted = body.match(/^(?<raw>"(?:[^"\\]|\\.)*") *:/u)?.groups?.raw;
  if (doubleQuoted) return { key: decodeYamlDoubleQuotedKey(doubleQuoted), listItem, quoted: true };
  const singleQuoted = body.match(/^'(?<raw>(?:[^']|'')*)' *:/u)?.groups?.raw;
  if (singleQuoted !== undefined) return { key: singleQuoted.replaceAll("''", "'"), listItem, quoted: true };
  return null;
}
function isCanonicalYamlStepItem(trimmed) {
  return trimmed === "-" || /^- +[A-Za-z0-9_.-]+:(?: +.*)?$/u.test(trimmed);
}
function isWorkflowStepRun(lines, index, indent, listItem) {
  let stepIndex = index;
  let stepIndent = indent;
  if (!listItem) {
    const step = previousYamlParent(lines, index, indent);
    if (!step || !isCanonicalYamlStepItem(step.trimmed) || indent !== step.indent + 2) return null;
    stepIndex = step.index;
    stepIndent = step.indent;
  }
  const steps = previousYamlParent(lines, stepIndex, stepIndent);
  if (!steps || yamlMappingKey(steps.trimmed) !== "steps") return null;
  const job = previousYamlParent(lines, steps.index, steps.indent);
  if (!job || !yamlMappingKey(job.trimmed)) return null;
  const jobs = previousYamlParent(lines, job.index, job.indent);
  if (jobs?.indent !== 0 || yamlMappingKey(jobs.trimmed) !== "jobs") return null;
  return { stepIndex, stepsIndex: steps.index, jobIndex: job.index, jobsIndex: jobs.index };
}

function workflowRegistrations(content, checkerPath) {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const matches = [];
  const normalizedChecker = normalizedCommandPath(checkerPath);
  const checkerReferencedInFile = content.replaceAll("\\", "/").includes(normalizedChecker);
  const invalidControlCharacter = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(content);
  if (invalidControlCharacter) return checkerReferencedInFile ? null : [];
  const invalidIndentation = lines.some((line) => {
    const leadingWhitespace = line.match(/^\s*/u)?.[0] || "";
    return leadingWhitespace.includes("\t") || [...leadingWhitespace].some((char) => char !== " ");
  });
  if (invalidIndentation) return checkerReferencedInFile ? null : [];
  const rootJobsLines = lines.filter((line) => {
    if (line.trimStart().startsWith("#")) return false;
    const indent = line.match(/^ */u)?.[0].length || 0;
    const mapping = yamlMappingKeyLike(line.trim());
    return indent === 0 && !mapping?.listItem && mapping?.key === "jobs";
  });
  if (rootJobsLines.length !== 1 || yamlMappingKey(rootJobsLines[0].trim()) !== "jobs") {
    return checkerReferencedInFile ? null : [];
  }
  const seenJobKeys = new Set();
  const seenStepsByJob = new Set();
  const seenRunByStep = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.match(/^ */u)?.[0].length || 0;
    const mapping = yamlMappingKeyLike(trimmed);
    const key = mapping?.key;
    if (!key || indent === 0) continue;
    const parent = previousYamlParent(lines, index, indent);
    if (!mapping.listItem && parent?.indent === 0 && yamlMappingKey(parent.trimmed) === "jobs") {
      if (seenJobKeys.has(key)) return checkerReferencedInFile ? null : [];
      seenJobKeys.add(key);
      continue;
    }
    if (!mapping.listItem && key === "steps" && parent && yamlMappingKey(parent.trimmed)) {
      const jobs = previousYamlParent(lines, parent.index, parent.indent);
      if (jobs?.indent === 0 && yamlMappingKey(jobs.trimmed) === "jobs") {
        const identity = String(parent.index);
        if (seenStepsByJob.has(identity)) return checkerReferencedInFile ? null : [];
        seenStepsByJob.add(identity);
      }
    }
    if (key === "run") {
      const stepContext = isWorkflowStepRun(lines, index, indent, mapping.listItem);
      if (stepContext) {
        if (seenRunByStep.has(stepContext.stepIndex)) return checkerReferencedInFile ? null : [];
        seenRunByStep.add(stepContext.stepIndex);
      }
    }
  }
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trimStart().startsWith("#")) continue;
    const match = line.match(/^(?<indent> *)(?<listItem>- +)?run:(?: +(?<value>.*))?$/u);
    if (!match?.groups) {
      if (line.replaceAll("\\", "/").includes(normalizedChecker)) return null;
      continue;
    }
    const value = (match.groups.value || "").trim();
    const blockScalar = ["|", "|-", ">", ">-"].includes(value);
    let childLines = [];
    let lastChildIndex = index;
    if (blockScalar) {
      const baseIndent = match.groups.indent.length;
      for (let child = index + 1; child < lines.length; child += 1) {
        const childLine = lines[child];
        if (childLine.trim() === "") {
          childLines.push("");
          lastChildIndex = child;
          continue;
        }
        const childIndent = childLine.match(/^ */u)?.[0].length || 0;
        if (childIndent <= baseIndent) break;
        childLines.push(childLine);
        lastChildIndex = child;
      }
    }
    const candidate = blockScalar ? childLines.join("\n") : value;
    const checkerReferenced = candidate.replaceAll("\\", "/").includes(normalizedChecker);
    const stepContext = isWorkflowStepRun(
      lines,
      index,
      match.groups.indent.length,
      Boolean(match.groups.listItem),
    );
    if (!stepContext) {
      if (checkerReferenced) return null;
      if (blockScalar) index = lastChildIndex;
      continue;
    }
    if (blockScalar && value.startsWith(">")) {
      if (checkerReferenced) return null;
      index = lastChildIndex;
      continue;
    }
    if (blockScalar) {
      const blockMatches = commandBlockRegistrations(childLines, checkerPath);
      if (blockMatches === null) return null;
      for (const { command } of blockMatches) {
        if (command) matches.push({ type: "workflow-run", entry: `run:${index + 1}`, command });
      }
      index = lastChildIndex;
      continue;
    }
    const analysis = analyzeExecutableCommand(value, checkerPath);
    if (!analysis.valid) {
      if (analysis.checkerReferenced) return null;
      continue;
    }
    for (const command of analysis.matches) {
      matches.push({ type: "workflow-run", entry: `run:${index + 1}`, command });
    }
  }
  return matches;
}

function lineRegistrations(content, checkerPath) {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const matches = commandBlockRegistrations(lines, checkerPath);
  if (matches === null) return null;
  return matches.map(({ index, command }) => ({
    type: "line-command",
    entry: `line:${index + 1}`,
    command,
  }));
}

function registrationMatches(file, content, checkerPath) {
  const normalized = file.replaceAll("\\", "/");
  if (normalized === "package.json") return packageRegistrations(content, checkerPath);
  if (/^\.github\/workflows\/[^/]+\.ya?ml$/u.test(normalized)) return workflowRegistrations(content, checkerPath);
  return lineRegistrations(content, checkerPath);
}

function verifyHardening(targetRoot, experience, hardening, confirmedAt) {
  const checker = verifiedFile(targetRoot, hardening?.path, "checker");
  const registrationFiles = hardening?.registrationFiles;
  if (!Array.isArray(registrationFiles) || registrationFiles.length === 0) {
    throw new Error("L2→L3 hardening requires registrationFiles from test/CI/Hook");
  }
  const registrations = [...new Set(registrationFiles)].flatMap((file) => {
    if (!isAllowedExperienceRegistrationPath(file)) throw new Error(`registration file is not a package/test/CI/Hook entry: ${file}`);
    const evidence = verifiedFile(targetRoot, file, "registration file");
    const matches = registrationMatches(file, evidence.content, checker.path);
    if (matches === null) throw new Error(`registration file contains a non-canonical checker command: ${file}`);
    if (matches.length === 0) throw new Error(`registration file does not contain an executable checker command: ${file}`);
    return matches.map((match) => ({
      type: match.type,
      path: evidence.path,
      hash: evidence.hash,
      entry: match.entry,
      command: match.command,
    }));
  });
  return {
    checker: {
      path: checker.path,
      hash: checker.hash,
      owned: checker.content.includes(`vibe-experience-owner: ${experience.id}`),
    },
    registrations,
    verifiedAt: confirmedAt,
  };
}

function removePackageScript(content, registration) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`package.json registration is invalid JSON: ${error.message}`);
  }
  const scriptName = registration.entry.slice("scripts.".length);
  if (!parsed?.scripts || !Object.prototype.hasOwnProperty.call(parsed.scripts, scriptName)) {
    throw new Error(`package script registration missing: ${registration.entry}`);
  }
  delete parsed.scripts[scriptName];
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function removeWorkflowRun(content, registration) {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const lineNumber = Number(registration.entry.slice("run:".length));
  const index = lineNumber - 1;
  const line = lines[index];
  const match = line?.match(/^(?<indent>\s*)(?:-\s*)?run\s*:\s*(?<value>.*)$/u);
  if (!match?.groups) throw new Error(`workflow registration entry missing: ${registration.entry}`);
  let deleteCount = 1;
  const value = match.groups.value.trim();
  if (["|", "|-", ">", ">-"].includes(value)) {
    const baseIndent = match.groups.indent.length;
    for (let child = index + 1; child < lines.length; child += 1) {
      const childLine = lines[child];
      if (childLine.trim() === "") {
        deleteCount += 1;
        continue;
      }
      const childIndent = childLine.match(/^\s*/u)?.[0].length || 0;
      if (childIndent <= baseIndent) break;
      deleteCount += 1;
    }
  }
  lines.splice(index, deleteCount);
  return lines.join("\n");
}

function removeLineCommand(content, registration) {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const lineNumber = Number(registration.entry.slice("line:".length));
  const index = lineNumber - 1;
  if (!Number.isInteger(lineNumber) || lineNumber <= 0 || index >= lines.length) {
    throw new Error(`line registration entry missing: ${registration.entry}`);
  }
  lines.splice(index, 1);
  return lines.join("\n");
}

function removeRegistration(content, registration) {
  if (registration.type === "package-script") return removePackageScript(content, registration);
  if (registration.type === "workflow-run") return removeWorkflowRun(content, registration);
  if (registration.type === "line-command") return removeLineCommand(content, registration);
  throw new Error(`unsupported hardening registration type: ${registration.type}`);
}

function registrationTuple(registration) {
  return JSON.stringify([
    registration.type,
    registration.path,
    registration.hash,
    registration.entry,
    registration.command,
  ]);
}

function registrationEntryNumber(registration) {
  return Number(registration.entry.split(":").at(-1)) || 0;
}

function retirementPlan(targetRoot, experience, rule, retirement) {
  if (retirement?.l3Operations !== undefined) throw new Error("retirement.l3Operations is forbidden");
  if (retirement?.removed !== undefined) throw new Error("caller-provided retirement.removed is forbidden");
  if (retirement?.registrationUpdates !== undefined) throw new Error("retirement.registrationUpdates is forbidden; registrations are removed deterministically");
  const removed = [];
  const operations = [];
  if (experience.tier === "L3") {
    const hardening = rule?.hardening;
    if (!hardening?.checker || !Array.isArray(hardening.registrations) || hardening.registrations.length === 0) {
      throw new Error("L3 retirement requires registry hardening evidence");
    }
    const checker = verifiedFile(targetRoot, hardening.checker.path, "checker");
    if (checker.hash !== hardening.checker.hash) throw new Error("checker hash does not match registry hardening evidence");
    const registrationsByPath = new Map();
    for (const registration of hardening.registrations) {
      const group = registrationsByPath.get(registration.path) || [];
      group.push(registration);
      registrationsByPath.set(registration.path, group);
    }
    for (const [registrationPath, storedRegistrations] of registrationsByPath) {
      if (!isAllowedExperienceRegistrationPath(registrationPath)) {
        throw new Error(`registration path is outside package/test/CI/Hook surfaces: ${registrationPath}`);
      }
      const storedHashes = new Set(storedRegistrations.map((item) => item.hash));
      if (storedHashes.size !== 1) throw new Error(`registration hashes disagree for the same path: ${registrationPath}`);
      const current = verifiedFile(targetRoot, registrationPath, "registration file");
      if (current.hash !== storedRegistrations[0].hash) throw new Error(`registration hash does not match hardening evidence: ${registrationPath}`);
      const freshMatches = registrationMatches(registrationPath, current.content, checker.path);
      if (freshMatches === null) throw new Error(`registration file contains a non-canonical checker command: ${registrationPath}`);
      const freshRegistrations = freshMatches.map((item) => ({
        ...item,
        path: registrationPath,
        hash: current.hash,
      }));
      const storedSet = storedRegistrations.map(registrationTuple).sort();
      const freshSet = freshRegistrations.map(registrationTuple).sort();
      if (JSON.stringify(storedSet) !== JSON.stringify(freshSet)) {
        throw new Error(`stored registration match-set does not exactly match fresh evidence: ${registrationPath}`);
      }
      const entries = [...new Map(storedRegistrations.map((item) => [`${item.type}\0${item.entry}`, item])).values()]
        .sort((left, right) => registrationEntryNumber(right) - registrationEntryNumber(left));
      let nextContent = current.content;
      for (const registration of entries) nextContent = removeRegistration(nextContent, registration);
      const remaining = registrationMatches(registrationPath, nextContent, checker.path);
      if (remaining === null) throw new Error(`registration deterministic removal left a non-canonical checker command: ${registrationPath}`);
      if (remaining.length > 0) throw new Error(`registration deterministic removal left checker matches: ${registrationPath}`);
      operations.push({ file: registrationPath, content: nextContent, expectedContent: current.content });
    }
    if (hardening.checker.owned === true) {
      if (!checker.content.includes(`vibe-experience-owner: ${experience.id}`)) {
        throw new Error("owned checker marker does not match experienceId");
      }
      operations.push({ file: checker.path, content: null, expectedContent: checker.content });
    }
    removed.push(`L3:${checker.path}`);
  }
  if (experience.tier === "L3" || experience.tier === "L2") removed.push("L2:target-experience-projection");
  if (experience.tier !== "L0") removed.push("L1:target-experience-registry");
  return { operations, audit: { removed } };
}

function nextRegistryForAction(registry, experience, request) {
  const next = clone(registry);
  const index = next.rules.findIndex((rule) => rule.experienceId === experience.id);
  if (request.action === "elevate") {
    if (experience.tier === "L0") {
      if (typeof request.ruleText !== "string" || request.ruleText.trim() === "") {
        throw new Error("L0→L1 elevation requires ruleText");
      }
      const rule = { experienceId: experience.id, text: request.ruleText.trim(), status: "candidate" };
      if (index === -1) next.rules.push(rule);
      else next.rules[index] = rule;
    } else if (experience.tier === "L1") {
      if (index === -1) throw new Error("L1→L2 elevation requires an existing L1 registry rule");
      next.rules[index] = { ...next.rules[index], status: "active" };
    } else if (experience.tier === "L2") {
      if (!request.hardening?.checker || !Array.isArray(request.hardening.registrations)) throw new Error("L2→L3 elevation requires verified hardening evidence");
      if (index === -1) throw new Error("L2→L3 elevation requires an active registry rule");
      next.rules[index] = { ...next.rules[index], status: "active", hardening: clone(request.hardening) };
    }
  }
  if (request.action === "retire" && index !== -1) next.rules.splice(index, 1);
  if (JSON.stringify(next.rules) !== JSON.stringify(registry.rules)) next.sourceRevision += 1;
  return next;
}

function elevationLanding(experience, request) {
  if (experience.tier === "L0") return "docs/项目治理/宪法设计.md#target-experience-registry";
  if (experience.tier === "L1") return "AGENTS.md/CLAUDE.md#target-experience-projection";
  if (experience.tier === "L2") return request.hardening.path;
  return experience.landing;
}

function mutateLedger(ledger, request) {
  if (request.action === "record") {
    return request.experienceId
      ? bumpExperience(ledger, request.experienceId, request.event)
      : addExperience(ledger, { summary: request.summary, event: request.event });
  }
  const experience = ledger.experiences.find((item) => item.id === request.experienceId);
  if (!experience) throw new Error(`unknown experience id: ${request.experienceId}`);
  if (request.action === "elevate") {
    return elevateExperience(ledger, experience.id, {
      landing: elevationLanding(experience, request),
      confirmation: request.confirmation,
    });
  }
  if (request.action === "retire") {
    return removeExperience(ledger, experience.id, {
      confirmation: request.confirmation,
      retirement: request.retirement,
    });
  }
  throw new Error(`unsupported experience action: ${request.action}`);
}

function adoptL1RegistryAnchor(targetRoot, paths, ledgerContent, adoption, currentRegistryInfo, request) {
  const { ledger, anchorMissing } = adoption;
  if (!Number.isInteger(request.expectedRevision) || request.expectedRevision < 0) {
    throw new Error("expectedRevision must be an explicit non-negative integer");
  }
  if (ledger.revision !== request.expectedRevision) {
    throw new Error(`experience ledger revision conflict: expected ${request.expectedRevision}, actual ${ledger.revision}`);
  }
  if (currentRegistryInfo.registry.rules.length === 0) throw new Error("anchor adoption requires a current non-empty L1 registry");
  if (!anchorMissing && ledger.l1RegistryAnchor !== null) {
    throw new Error("anchor adoption only accepts a missing or null l1RegistryAnchor");
  }
  assertCurrentExperienceProjectionState(targetRoot, currentRegistryInfo);
  const nextLedger = clone(ledger);
  nextLedger.l1RegistryAnchor = l1RegistryAnchorFromInfo(currentRegistryInfo);
  nextLedger.revision += 1;
  const transaction = commitTargetTransaction(targetRoot, {
    journalPath: ".vibe-experience-transaction.json",
    kind: "experience-governance:adopt-anchor",
    operations: [{ file: paths.ledger, content: renderLedgerMarkdown(nextLedger), expectedContent: ledgerContent }],
  });
  return { ok: true, action: request.action, revision: nextLedger.revision, changed: transaction.changed };
}

export function executeExperienceAction(request) {
  const { targetRoot, skillsRoot } = request;
  if (!targetRoot || !skillsRoot) throw new Error("targetRoot and skillsRoot are required");
  const paths = loadPaths(targetRoot);
  const ledgerContent = readText(targetRoot, paths.ledger);
  const constitutionContent = readText(targetRoot, paths.constitution);
  const parsedRegistry = parseExperienceRegistry(constitutionContent);
  const currentRegistry = parsedRegistry?.registry || emptyExperienceRegistry();
  const currentRegistryInfo = parsedRegistry
    ? { ...parsedRegistry, file: paths.constitution, content: constitutionContent }
    : registryInfoFromRegistry(currentRegistry, paths.constitution);
  if (request.action === "adopt-anchor") {
    return adoptL1RegistryAnchor(
      targetRoot,
      paths,
      ledgerContent,
      parseLedgerForAnchorAdoption(ledgerContent),
      currentRegistryInfo,
      request,
    );
  }
  let ledger;
  try {
    ledger = parseLedger(ledgerContent);
  } catch (error) {
    if (currentRegistry.rules.length > 0 && isL1RegistryAnchorAdoptionRequiredError(error)) {
      throw new Error(`anchor-adoption-required: ${error.message}`);
    }
    throw error;
  }
  if (ledger.vibeExperienceLedger !== "v2") throw new Error("experience governance writes require ledger schema v2");
  assertL1RegistryAnchorMatches(ledger.l1RegistryAnchor, currentRegistryInfo, "l1RegistryAnchor");
  if (!Number.isInteger(request.expectedRevision) || request.expectedRevision < 0) {
    throw new Error("expectedRevision must be an explicit non-negative integer");
  }
  const replay = eventReplay(ledger, request);
  if (replay) return replay;
  if (ledger.revision !== request.expectedRevision) {
    throw new Error(`experience ledger revision conflict: expected ${request.expectedRevision}, actual ${ledger.revision}`);
  }
  const experience = request.experienceId
    ? ledger.experiences.find((item) => item.id === request.experienceId)
    : null;
  let effectiveRequest = request;
  let l3Operations = [];
  if (request.action === "elevate" && experience?.tier === "L2") {
    effectiveRequest = {
      ...request,
      hardening: verifyHardening(targetRoot, experience, request.hardening, request.confirmation?.confirmedAt),
    };
  }
  if (request.action === "retire") {
    if (!experience) throw new Error(`unknown experience id: ${request.experienceId}`);
    const rule = currentRegistry.rules.find((item) => item.experienceId === experience.id);
    const planned = retirementPlan(targetRoot, experience, rule, request.retirement);
    l3Operations = planned.operations;
    effectiveRequest = { ...request, retirement: planned.audit };
  }
  const nextLedger = mutateLedger(ledger, effectiveRequest);
  const nextRegistry = experience ? nextRegistryForAction(currentRegistry, experience, effectiveRequest) : currentRegistry;
  const nextConstitution = JSON.stringify(nextRegistry) === JSON.stringify(currentRegistry)
    ? constitutionContent
    : planExperienceRegistryContent(constitutionContent, nextRegistry);
  const registryInfo = registryInfoFromRegistry(nextRegistry, paths.constitution);
  nextLedger.l1RegistryAnchor = l1RegistryAnchorFromInfo(registryInfo);
  const runtime = planTargetRuntimeUpdate(targetRoot, skillsRoot, new Date().toISOString(), {
    registryInfo,
    requireExperienceProjection: true,
  });
  if (runtime.failures.length > 0) {
    throw new Error(`experience runtime projection blocked: ${runtime.failures.map((item) => item.reason).join("; ")}`);
  }

  const runtimeOperations = runtime.changes.map((plan) => ({
    file: plan.file,
    content: plan.nextContent,
    expectedContent: plan.expectedContent,
  }));
  const operations = [
    ...l3Operations,
    ...runtimeOperations,
    ...(nextConstitution !== constitutionContent
      ? [{ file: paths.constitution, content: nextConstitution, expectedContent: constitutionContent }]
      : []),
    { file: paths.ledger, content: renderLedgerMarkdown(nextLedger), expectedContent: ledgerContent },
  ];
  const transaction = commitTargetTransaction(targetRoot, {
    journalPath: ".vibe-experience-transaction.json",
    kind: `experience-governance:${request.action}`,
    operations,
  });
  return { ok: true, action: request.action, revision: nextLedger.revision, changed: transaction.changed };
}

async function main() {
  const targetRoot = process.argv[2];
  if (!targetRoot) throw new Error("usage: node tools/experience-governance.mjs <target-root> < request.json");
  const raw = await new Promise((resolve) => {
    let content = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { content += chunk; });
    process.stdin.on("end", () => resolve(content));
  });
  const request = JSON.parse(raw.replace(/^\uFEFF/u, ""));
  const result = executeExperienceAction({ ...request, targetRoot });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
