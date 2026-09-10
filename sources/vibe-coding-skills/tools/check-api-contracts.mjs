#!/usr/bin/env node
// DocMap:
// Layer: L3 / validation script
// Module: tools
// Depends on: .vibe-docs.json, target interface contract doc
// Syncs with: Product-Spec.md, DEV-PLAN.md, tools/INDEX.md, skills/dev-builder/SKILL.md
// Validates one canonical contract entry per business capability.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { assertSafeTargetRoot, inspectTargetFile } from "./safe-target-fs.mjs";

const MANIFEST_NAME = ".vibe-docs.json";
const CONTRACT_ROLE = "interfaceContracts";
const REQUIRED_HEADERS = ["能力ID", "统一能力", "入口类型", "契约入口", "调用方", "状态", "说明"];
const ALLOWED_TYPES = new Set(["none", "endpoint", "service", "publicEntry", "schema", "event"]);
const ALLOWED_STATUS = new Set(["planned", "active", "deprecated"]);
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "*"]);
const ROUTE_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];
const SKIP_DIRS = new Set([".git", ".next", ".electron-dist", ".agents", ".claude", ".codex", "coverage", "dist", "node_modules"]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/u;
const FOUR_CHINESE_MD = /^[\u4e00-\u9fff]{4}\.md$/u;
const DEFAULT_PATH_PREFIXES = ["/api"];
const DEFAULT_RAW_NETWORK_ALLOW_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "docs",
  "test",
  "tests",
  "__tests__",
]);

function usage() {
  console.error(`Usage:
  node ./tools/check-api-contracts.mjs <target-root>

Rules:
  - .vibe-docs.json must map interfaceContracts to a four-Chinese-character Markdown file, default 接口契约.md.
  - Interface contract docs must contain a table with:
    能力ID | 统一能力 | 入口类型 | 契约入口 | 调用方 | 状态 | 说明
  - One capability may have different entry types, but one capability cannot own multiple entries of the same type.
  - The same concrete entry cannot be assigned to multiple capabilities.
  - Discovered Next.js app/api route handlers and literal /api fetch calls must be registered as endpoint contracts.

Optional .vibe-docs.json scanner configuration:
  "interfaceContractScanner": {
    "pathPrefixes": ["/api", "/v1"],
    "serverRouteRoots": ["src/server"],
    "typedClientRoots": ["src/api-client"],
    "frontendRoots": ["src/app"],
    "allowedRawNetworkRoots": ["src/api-client", "src/server"],
    "eventPatterns": [{ "contains": "/v1/events", "entry": "WS /v1/events" }],
    "publicEntryPatterns": [{ "contains": "appBridge", "entry": "window.appBridge" }]
  }`);
}

function fail(issues, message) {
  issues.push(`[FAIL] ${message}`);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function parseArgs(argv) {
  const args = { root: null };
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    if (!args.root) {
      args.root = arg;
      continue;
    }
    console.error(`[FAIL] Unknown argument: ${arg}`);
    usage();
    process.exit(2);
  }
  if (!args.root) {
    usage();
    process.exit(2);
  }
  return args;
}

function readJson(filePath, issues) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""));
  } catch (error) {
    fail(issues, `Could not parse ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
}

function isInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeCell(value) {
  return value.trim().replace(/^`|`$/gu, "").trim();
}

function splitTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = [];
  let current = "";
  const inner = trimmed.slice(1, -1);

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === "\\" && inner[index + 1] === "|") {
      current += "|";
      index += 1;
      continue;
    }
    if (char === "|") {
      cells.push(normalizeCell(current));
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(normalizeCell(current));
  return cells;
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()));
}

function parseContractRows(content, issues) {
  const lines = content.split(/\r?\n/u);
  const rows = [];
  let foundContractTable = false;

  for (let index = 0; index < lines.length; index += 1) {
    const headerCells = splitTableRow(lines[index]);
    if (!headerCells) continue;

    const headerIndex = new Map(headerCells.map((header, position) => [header, position]));
    const hasRequiredHeaders = REQUIRED_HEADERS.every((header) => headerIndex.has(header));
    if (!hasRequiredHeaders) continue;

    const separatorCells = splitTableRow(lines[index + 1] || "");
    if (!separatorCells || !isSeparatorRow(separatorCells)) {
      fail(issues, "Interface contract table header must be followed by a Markdown separator row.");
      continue;
    }

    foundContractTable = true;
    index += 2;
    while (index < lines.length) {
      const cells = splitTableRow(lines[index]);
      if (!cells) break;
      const row = {};
      for (const header of REQUIRED_HEADERS) {
        row[header] = normalizeCell(cells[headerIndex.get(header)] || "");
      }
      const isPlaceholder = Object.values(row).some((value) => /^<.*>$/u.test(value));
      if (!isPlaceholder && Object.values(row).some(Boolean)) rows.push({ ...row, line: index + 1 });
      index += 1;
    }
  }

  if (!foundContractTable) {
    fail(issues, "Missing interface contract table with required headers.");
  }

  return rows;
}

function parseEndpointEntry(entry) {
  const cleaned = normalizeCell(entry);
  const methodPathMatch = cleaned.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|\*)\s+(\S.*)$/iu);
  if (methodPathMatch) {
    return { method: methodPathMatch[1].toUpperCase(), path: methodPathMatch[2].trim() };
  }
  if (cleaned.startsWith("/")) {
    return { method: "*", path: cleaned };
  }
  return null;
}

function normalizeNextApiPath(routeFile) {
  const normalized = routeFile.replace(/\\/gu, "/");
  if (/(?:^|\/)(?:src\/)?app\/api\/route\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(normalized)) {
    return "/api";
  }

  const match = normalized.match(/(?:^|\/)(?:src\/)?app\/api\/(.+)\/route\.(?:ts|tsx|js|jsx|mjs|cjs)$/u);
  if (!match) return null;

  const parts = match[1].split("/").filter(Boolean).filter((segment) => {
    return !/^\(.+\)$/u.test(segment) && !segment.startsWith("@");
  }).map((segment) => {
    if (/^\[\[\.\.\.(.+)\]\]$/u.test(segment)) return `:${segment.slice(5, -2)}*`;
    if (/^\[\.\.\.(.+)\]$/u.test(segment)) return `:${segment.slice(4, -1)}*`;
    if (/^\[(.+)\]$/u.test(segment)) return `:${segment.slice(1, -1)}`;
    return segment;
  });

  return parts.length === 0 ? "/api" : `/api/${parts.join("/")}`;
}

function inferFetchMethod(content, afterUrlIndex) {
  const tail = content.slice(afterUrlIndex, afterUrlIndex + 300);
  if (/^\s*\)/u.test(tail)) return "GET";

  const methodMatch = tail.match(/^\s*,[\s\S]{0,250}?\bmethod\s*:\s*(['"`])(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\1/iu);
  if (methodMatch) return methodMatch[2].toUpperCase();

  const staticObjectMatch = tail.match(/^\s*,\s*\{([\s\S]{0,250}?)\}/u);
  if (staticObjectMatch && !staticObjectMatch[1].includes("...")) return "GET";

  return "*";
}

function toPosixPath(value) {
  return value.replace(/\\/gu, "/").replace(/^\.\/+/u, "");
}

function normalizePathPrefix(prefix) {
  if (typeof prefix !== "string" || !prefix.trim()) return null;
  const normalized = prefix.trim().replace(/\/+$/u, "");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function normalizeConfiguredRoots(rootValues) {
  if (!Array.isArray(rootValues)) return [];
  return rootValues
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => toPosixPath(value.trim()).replace(/\/+$/u, ""));
}

function normalizeScannerPattern(item, fallbackType) {
  if (typeof item === "string") {
    const value = item.trim();
    return value ? { contains: value, entry: value, type: fallbackType } : null;
  }
  if (!item || typeof item !== "object") return null;

  const contains = typeof item.contains === "string" ? item.contains.trim() : "";
  const pattern = typeof item.pattern === "string" ? item.pattern.trim() : "";
  const entry = typeof item.entry === "string" ? item.entry.trim() : "";
  const type = typeof item.type === "string" && item.type.trim() ? item.type.trim() : fallbackType;
  const needle = contains || pattern;
  if (!needle || !entry) return null;
  return { contains: needle, entry, type };
}

function loadScannerConfig(manifest) {
  const raw = manifest?.interfaceContractScanner || manifest?.apiContractScanner;
  const base = {
    pathPrefixes: DEFAULT_PATH_PREFIXES,
    serverRouteRoots: [],
    typedClientRoots: [],
    frontendRoots: [],
    allowedRawNetworkRoots: [],
    eventPatterns: [],
    publicEntryPatterns: [],
  };

  if (!raw || typeof raw !== "object") return base;

  const pathPrefixes = Array.isArray(raw.pathPrefixes)
    ? raw.pathPrefixes.map(normalizePathPrefix).filter(Boolean)
    : DEFAULT_PATH_PREFIXES;

  return {
    pathPrefixes: pathPrefixes.length > 0 ? pathPrefixes : DEFAULT_PATH_PREFIXES,
    serverRouteRoots: normalizeConfiguredRoots(raw.serverRouteRoots),
    typedClientRoots: normalizeConfiguredRoots(raw.typedClientRoots || raw.clientRoots),
    frontendRoots: normalizeConfiguredRoots(raw.frontendRoots),
    allowedRawNetworkRoots: normalizeConfiguredRoots(raw.allowedRawNetworkRoots || raw.rawNetworkAllowRoots),
    eventPatterns: Array.isArray(raw.eventPatterns)
      ? raw.eventPatterns.map((item) => normalizeScannerPattern(item, "event")).filter(Boolean)
      : [],
    publicEntryPatterns: Array.isArray(raw.publicEntryPatterns)
      ? raw.publicEntryPatterns.map((item) => normalizeScannerPattern(item, "publicEntry")).filter(Boolean)
      : [],
  };
}

function isUnderAnyConfiguredRoot(file, roots) {
  if (!roots || roots.length === 0) return false;
  const normalized = toPosixPath(file);
  return roots.some((root) => {
    if (!root) return false;
    return normalized === root || normalized.startsWith(`${root}/`);
  });
}

function isDefaultRawNetworkAllowed(file) {
  const parts = toPosixPath(file).split("/");
  return parts.some((part) => DEFAULT_RAW_NETWORK_ALLOW_DIRS.has(part));
}

function normalizeDiscoveredPath(value) {
  const withoutQuery = value.split("?")[0];
  return withoutQuery
    .replace(/\$\{[^}]+\}/gu, "{param}")
    .replace(/:([A-Za-z0-9_]+)/gu, "{$1}")
    .replace(/\/+/gu, "/");
}

function pathStartsWithConfiguredPrefix(value, prefixes) {
  return prefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`));
}

function pathSegmentsMatch(contractPath, discoveredPath) {
  const contractSegments = normalizeDiscoveredPath(contractPath).split("/");
  const discoveredSegments = normalizeDiscoveredPath(discoveredPath).split("/");
  if (contractSegments.length !== discoveredSegments.length) return false;

  return contractSegments.every((segment, index) => {
    const other = discoveredSegments[index];
    const contractParam = /^\{[^}]+\}$/u.test(segment);
    const discoveredParam = /^\{[^}]+\}$/u.test(other);
    return segment === other || (contractParam && discoveredParam);
  });
}

function literalMatchesPatternEntry(value, patterns) {
  const normalized = normalizeDiscoveredPath(value);
  return patterns.some((pattern) => {
    if (!pattern.contains.startsWith("/")) return false;
    return normalizeDiscoveredPath(pattern.contains) === normalized;
  });
}

function extractLiteralApiPaths(content, prefixes, ignoredPatterns = []) {
  const paths = [];
  const literalRegex = /(['"`])(\/(?:\\.|(?!\1)[^'"`\s),;])+)\1/gu;
  for (const match of content.matchAll(literalRegex)) {
    const before = content.slice(Math.max(0, match.index - 40), match.index);
    if (/\b(?:WebSocket|EventSource)\s*\(\s*$/u.test(before)) continue;
    const value = match[2];
    if (literalMatchesPatternEntry(value, ignoredPatterns)) continue;
    if (pathStartsWithConfiguredPrefix(value, prefixes)) {
      paths.push({ path: normalizeDiscoveredPath(value), index: match.index + match[0].length });
    }
  }
  return paths;
}

function collectServerRouteEndpoints(content, file) {
  const endpoints = [];
  const methodAlternation = ROUTE_METHODS.join("|");
  const routeRegex = new RegExp(`\\b(?:app|router|server|fastify)\\.(${methodAlternation})\\s*\\(\\s*(['"\`])([^'"\`]+)\\2`, "giu");
  for (const match of content.matchAll(routeRegex)) {
    const pathValue = match[3].trim();
    if (!pathValue.startsWith("/")) continue;
    endpoints.push({
      method: match[1].toUpperCase(),
      path: normalizeDiscoveredPath(pathValue),
      source: file,
      kind: "server route",
    });
  }
  return endpoints;
}

function collectPatternEntries(content, file, patterns) {
  const entries = [];
  for (const pattern of patterns) {
    if (content.includes(pattern.contains)) {
      entries.push({ type: pattern.type, entry: pattern.entry, source: file, kind: pattern.type });
    }
  }
  return entries;
}

function listSourceFiles(root) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
      if (SKIP_DIRS.has(entry.name) && (entry.isDirectory() || entry.isSymbolicLink())) {
        continue;
      }
      if (entry.isSymbolicLink()) {
        throw new Error(`linked source path is not allowed: ${relative}`);
      }
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (entry.isFile() && SOURCE_EXT.test(entry.name)) {
        files.push(relative);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`non-regular source path is not allowed: ${relative}`);
      }
    }
  };
  walk(root);
  return files.sort();
}

function collectDiscoveredContracts(root, scannerConfig) {
  const discovered = {
    endpoints: [],
    entries: [],
    rawNetwork: [],
  };

  for (const file of listSourceFiles(root)) {
    const absolute = path.join(root, file);
    const content = fs.readFileSync(absolute, "utf8");
    const routePath = normalizeNextApiPath(file);

    if (routePath) {
      const methods = new Set();
      const methodRegex = /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/giu;
      for (const match of content.matchAll(methodRegex)) methods.add(match[1].toUpperCase());
      if (methods.size === 0) methods.add("*");
      for (const method of methods) discovered.endpoints.push({ method, path: routePath, source: file, kind: "Next.js route" });
    }

    const fetchPathPattern = scannerConfig.pathPrefixes.map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
    const fetchRegex = new RegExp(`\\bfetch\\s*\\(\\s*(['"\`])((?:${fetchPathPattern})(?:\\/[^'"\`?,\\s)]*)?)(?:\\?[^'"\`]*)?\\1`, "gu");
    for (const match of content.matchAll(fetchRegex)) {
      discovered.endpoints.push({
        method: inferFetchMethod(content, match.index + match[0].length),
        path: normalizeDiscoveredPath(match[2]),
        source: file,
        kind: "fetch",
      });
    }

    if (isUnderAnyConfiguredRoot(file, scannerConfig.serverRouteRoots)) {
      discovered.endpoints.push(...collectServerRouteEndpoints(content, file));
    }

    if (isUnderAnyConfiguredRoot(file, scannerConfig.typedClientRoots)) {
      for (const literal of extractLiteralApiPaths(content, scannerConfig.pathPrefixes, scannerConfig.eventPatterns)) {
        discovered.endpoints.push({
          method: "*",
          path: literal.path,
          source: file,
          kind: "typed client path",
        });
      }
    }

    discovered.entries.push(...collectPatternEntries(content, file, scannerConfig.eventPatterns));
    discovered.entries.push(...collectPatternEntries(content, file, scannerConfig.publicEntryPatterns));

    const shouldGateRawNetwork = isUnderAnyConfiguredRoot(file, scannerConfig.frontendRoots)
      && !isUnderAnyConfiguredRoot(file, scannerConfig.allowedRawNetworkRoots)
      && !isDefaultRawNetworkAllowed(file);
    if (shouldGateRawNetwork) {
      const rawNetworkRegex = /\bfetch\s*\(|\bnew\s+WebSocket\s*\(/gu;
      for (const match of content.matchAll(rawNetworkRegex)) {
        discovered.rawNetwork.push({ primitive: match[0].replace(/\s+/gu, " "), source: file });
      }
    }
  }

  return discovered;
}

function endpointMatches(contract, discovered) {
  const methodMatches = contract.method === "*" || discovered.method === "*" || contract.method === discovered.method;
  return methodMatches && pathSegmentsMatch(contract.path, discovered.path);
}

function normalizeContractEntry(entryType, entry) {
  if (entryType === "endpoint") {
    const endpoint = parseEndpointEntry(entry);
    if (endpoint) return `${endpoint.method} ${endpoint.path}`;
  }
  return entry;
}

function contractEntriesOverlap(left, right) {
  if (left.entryType !== right.entryType) return false;
  if (left.entryType === "endpoint" && left.endpoint && right.endpoint) {
    const samePath = left.endpoint.path === right.endpoint.path;
    const overlappingMethod = left.endpoint.method === "*" || right.endpoint.method === "*" || left.endpoint.method === right.endpoint.method;
    return samePath && overlappingMethod;
  }
  return left.entryKey === right.entryKey;
}

function validateRows(rows, issues) {
  const capabilityTypeToEntry = new Map();
  const activeEntries = [];
  const endpointContracts = [];
  const exactContracts = new Map();

  for (const row of rows) {
    const capabilityId = row["能力ID"];
    const entryType = row["入口类型"];
    const entry = row["契约入口"];
    const status = row["状态"];
    const endpoint = entryType === "endpoint" ? parseEndpointEntry(entry) : null;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(capabilityId)) {
      fail(issues, `Line ${row.line}: 能力ID must be stable kebab-case, got "${capabilityId}".`);
    }
    if (!ALLOWED_TYPES.has(entryType)) {
      fail(issues, `Line ${row.line}: 入口类型 must be one of ${[...ALLOWED_TYPES].join(", ")}, got "${entryType}".`);
    }
    if (!ALLOWED_STATUS.has(status)) {
      fail(issues, `Line ${row.line}: 状态 must be one of ${[...ALLOWED_STATUS].join(", ")}, got "${status}".`);
    }
    if (entryType !== "none" && !entry) {
      fail(issues, `Line ${row.line}: 契约入口 is required for entry type "${entryType}".`);
    }

    if (entryType !== "none" && status !== "deprecated") {
      const capabilityTypeKey = `${capabilityId}|${entryType}`;
      const normalizedEntry = normalizeContractEntry(entryType, entry);
      const previousEntry = capabilityTypeToEntry.get(capabilityTypeKey);
      if (previousEntry && previousEntry !== normalizedEntry) {
        fail(issues, `Line ${row.line}: capability "${capabilityId}" has multiple "${entryType}" entries: "${previousEntry}" and "${normalizedEntry}". Split the capability or reuse one canonical entry.`);
      }
      capabilityTypeToEntry.set(capabilityTypeKey, normalizedEntry);

      const currentEntry = { entryType, entryKey: normalizedEntry, endpoint, capabilityId };
      const previous = activeEntries.find((candidate) => candidate.capabilityId !== capabilityId && contractEntriesOverlap(candidate, currentEntry));
      if (previous) {
        fail(issues, `Line ${row.line}: "${entryType}" entry "${normalizedEntry}" overlaps with capability "${previous.capabilityId}" and is also assigned to "${capabilityId}".`);
      }
      activeEntries.push(currentEntry);

      if (!exactContracts.has(entryType)) exactContracts.set(entryType, new Set());
      exactContracts.get(entryType).add(normalizedEntry);
    }

    if (entryType === "endpoint" && status !== "deprecated") {
      if (!endpoint || !HTTP_METHODS.has(endpoint.method) || !endpoint.path.startsWith("/")) {
        fail(issues, `Line ${row.line}: endpoint entry must look like "GET /api/example" or "* /api/example", got "${entry}".`);
      } else {
        endpointContracts.push({ ...endpoint, row });
      }
    }
  }

  return { endpointContracts, exactContracts };
}

function validateDiscoveredEndpoints(discoveredEndpoints, endpointContracts, issues) {
  const uniqueDiscovered = new Map();
  for (const endpoint of discoveredEndpoints) {
    uniqueDiscovered.set(`${endpoint.method} ${endpoint.path} ${endpoint.kind}`, endpoint);
  }

  for (const endpoint of uniqueDiscovered.values()) {
    const matched = endpointContracts.some((contract) => endpointMatches(contract, endpoint));
    if (!matched) {
      fail(issues, `Unregistered ${endpoint.kind} endpoint ${endpoint.method} ${endpoint.path} discovered in ${endpoint.source}. Add it to 接口契约.md or reuse an existing contract.`);
    }
  }
}

function validateDiscoveredEntries(discoveredEntries, exactContracts, issues) {
  const uniqueDiscovered = new Map();
  for (const entry of discoveredEntries) {
    uniqueDiscovered.set(`${entry.type} ${entry.entry} ${entry.source}`, entry);
  }

  for (const entry of uniqueDiscovered.values()) {
    const registered = exactContracts.get(entry.type)?.has(entry.entry);
    if (!registered) {
      fail(issues, `Unregistered ${entry.kind} entry "${entry.entry}" discovered in ${entry.source}. Add it to 接口契约.md or reuse an existing contract.`);
    }
  }
}

function validateRawNetwork(rawNetworkReferences, issues) {
  const uniqueRawNetwork = new Map();
  for (const reference of rawNetworkReferences) {
    uniqueRawNetwork.set(`${reference.primitive} ${reference.source}`, reference);
  }

  for (const reference of uniqueRawNetwork.values()) {
    fail(issues, `Raw network primitive "${reference.primitive}" discovered in frontend source ${reference.source}. Route calls through the typed client or add a narrow allowedRawNetworkRoots exception.`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);
  const issues = [];
  let rootSafe = true;

  try {
    assertSafeTargetRoot(root);
  } catch (error) {
    rootSafe = false;
    fail(issues, error.message);
  }

  let manifestState = null;
  if (rootSafe) {
    try {
      manifestState = inspectTargetFile(root, MANIFEST_NAME);
      if (!manifestState.exists) fail(issues, `Missing ${MANIFEST_NAME}.`);
    } catch (error) {
      fail(issues, `Unsafe ${MANIFEST_NAME}: ${error.message}`);
    }
  }

  const manifest = manifestState?.exists ? readJson(manifestState.path, issues) : null;
  const contractRelPath = manifest?.[CONTRACT_ROLE];
  if (typeof contractRelPath !== "string" || !contractRelPath.endsWith(".md")) {
    fail(issues, `${MANIFEST_NAME} must map ${CONTRACT_ROLE} to 接口契约.md or another four-character Markdown path.`);
  }
  if (typeof contractRelPath === "string" && !FOUR_CHINESE_MD.test(path.basename(contractRelPath.replace(/\\/gu, "/")))) {
    fail(issues, `${MANIFEST_NAME}.${CONTRACT_ROLE} basename must be exactly four Chinese characters plus .md, got "${contractRelPath}".`);
  }

  const contractPath = contractRelPath ? path.resolve(root, contractRelPath) : "";
  if (contractPath && !isInsideRoot(root, contractPath)) {
    fail(issues, `Interface contract doc path escapes target root: ${contractRelPath}`);
  }
  let contractState = null;
  if (contractRelPath && isInsideRoot(root, contractPath)) {
    try {
      contractState = inspectTargetFile(root, contractRelPath);
      if (!contractState.exists) fail(issues, `Mapped interface contract doc does not exist: ${contractRelPath}`);
    } catch (error) {
      fail(issues, `Mapped interface contract doc is unsafe: ${contractRelPath} (${error.message})`);
    }
  }

  const rows = contractState?.exists
    ? parseContractRows(fs.readFileSync(contractState.path, "utf8"), issues)
    : [];
  const { endpointContracts, exactContracts } = validateRows(rows, issues);
  const scannerConfig = loadScannerConfig(manifest);
  let discovered = { endpoints: [], entries: [], rawNetwork: [] };
  if (rootSafe) {
    try {
      discovered = collectDiscoveredContracts(root, scannerConfig);
    } catch (error) {
      fail(issues, `Source scan refused unsafe input: ${error.message}`);
    }
  }
  validateDiscoveredEndpoints(discovered.endpoints, endpointContracts, issues);
  validateDiscoveredEntries(discovered.entries, exactContracts, issues);
  validateRawNetwork(discovered.rawNetwork, issues);

  if (issues.length > 0) {
    for (const issue of issues) console.error(issue);
    process.exitCode = 1;
    return;
  }

  pass(`Validated ${rows.length} interface contract row(s), ${discovered.endpoints.length} discovered endpoint reference(s), ${discovered.entries.length} discovered event/public entry reference(s).`);
}

main();
