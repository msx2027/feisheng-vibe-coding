#!/usr/bin/env node
// DocMap:
// Layer: L3 / test script
// Module: tools
// Depends on: tools/check-api-contracts.mjs
// Syncs with: README.md, tools/INDEX.md, .github/workflows/vibe-quality.yml
// Cross-platform tests for the target-project interface contract gate.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(SCRIPT_DIR);
const GATE = path.join(REPO_ROOT, "tools", "check-api-contracts.mjs");
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-api-contracts-"));

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function writeManifest(root, contractDoc = "接口契约.md", scanner = null) {
  const manifest = {
    productSpec: "需求文档.md",
    devPlan: "开发计划.md",
    currentExecution: "plans/执行光标.md",
    manualAcceptance: "验收记录.md",
    interfaceContracts: contractDoc,
  };
  if (scanner) manifest.interfaceContractScanner = scanner;
  writeFile(path.join(root, ".vibe-docs.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeDocs(root) {
  writeFile(path.join(root, "需求文档.md"), "# 需求文档\n");
  writeFile(path.join(root, "开发计划.md"), "# 开发计划\n");
  writeFile(path.join(root, "plans", "执行光标.md"), "# 执行光标\n");
  writeFile(path.join(root, "验收记录.md"), "# 验收记录\n");
}

function writeContractDoc(root, body, docName = "接口契约.md") {
  writeFile(path.join(root, docName), `# 接口契约

## 契约清单

| 能力ID | 统一能力 | 入口类型 | 契约入口 | 调用方 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
${body}
`);
}

function makeCase(label, options = {}) {
  const root = path.join(TMP_ROOT, label);
  fs.mkdirSync(root, { recursive: true });
  writeManifest(root, options.contractDoc || "接口契约.md", options.scanner || null);
  writeDocs(root);
  return root;
}

function scannerConfig() {
  return {
    pathPrefixes: ["/api", "/v1"],
    serverRouteRoots: ["src/server"],
    typedClientRoots: ["src/client"],
    frontendRoots: ["src/features"],
    allowedRawNetworkRoots: ["src/client", "src/server"],
    eventPatterns: [
      { contains: "/v1/events", entry: "WS /v1/events?topic={topic}&cursor={cursor}" },
      { contains: "app:window-control", entry: "ipc:app:window-control" },
    ],
    publicEntryPatterns: [
      { contains: "appBridge", entry: "window.appBridge" },
    ],
  };
}

function runGate(root) {
  return spawnSync(process.execPath, [GATE, root], { encoding: "utf8" });
}

function expect(label, root, shouldPass) {
  console.log(`[STEP] ${label} should ${shouldPass ? "pass" : "fail"}`);
  const result = runGate(root);
  const passed = result.status === 0;
  if (passed !== shouldPass) {
    const expected = shouldPass ? "pass" : "fail";
    const actual = passed ? "pass" : "fail";
    console.error(`[FAIL] ${label} expected ${expected}, got ${actual}`);
    console.error(result.stdout.trim());
    console.error(result.stderr.trim());
    process.exitCode = 1;
    return;
  }
  console.log(`[PASS] ${label}`);
}

function writeSource(root, relPath, content) {
  writeFile(path.join(root, relPath), content);
}

function main() {
  const validRoot = makeCase("valid");
  writeSource(validRoot, "src/app/api/sessions/route.ts", "export async function GET() {\n  return Response.json([]);\n}\n");
  writeContractDoc(validRoot, "| session-list | 会话列表 | endpoint | GET /api/sessions | src/features/session | active | 会话列表唯一服务端入口 |");
  expect("registered Next.js route", validRoot, true);

  const routeGroupRoot = makeCase("route-group");
  writeSource(routeGroupRoot, "src/app/api/(admin)/sessions/route.ts", "export async function GET() {\n  return Response.json([]);\n}\n");
  writeContractDoc(routeGroupRoot, "| session-list | 会话列表 | endpoint | GET /api/sessions | src/features/session | active | route group is not a URL segment |");
  expect("Next.js route group path normalization", routeGroupRoot, true);

  const rootRouteRoot = makeCase("root-route");
  writeSource(rootRouteRoot, "src/app/api/route.ts", "export async function GET() {\n  return Response.json({ ok: true });\n}\n");
  writeContractDoc(rootRouteRoot, "| health-check | 健康检查 | endpoint | GET /api | src/features/health | active | app/api/route.ts maps to /api |");
  expect("Next.js app/api root route path normalization", rootRouteRoot, true);

  const routeGroupRootRouteRoot = makeCase("route-group-root-route");
  writeSource(routeGroupRootRouteRoot, "src/app/api/(admin)/route.ts", "export async function GET() {\n  return Response.json({ ok: true });\n}\n");
  writeContractDoc(routeGroupRootRouteRoot, "| health-check | 健康检查 | endpoint | GET /api | src/features/health | active | route group root route maps to /api |");
  expect("Next.js route group root route path normalization", routeGroupRootRouteRoot, true);

  const fetchGetRoot = makeCase("fetch-get");
  writeSource(fetchGetRoot, "src/features/session/client.ts", "export async function loadSessions() {\n  return fetch(\"/api/sessions?limit=10\");\n}\n");
  writeContractDoc(fetchGetRoot, "| session-list | 会话列表 | endpoint | GET /api/sessions | src/features/session | active | default fetch method is GET and query string is ignored |");
  expect("registered literal GET fetch with query string", fetchGetRoot, true);

  const fetchPostRoot = makeCase("fetch-post");
  writeSource(fetchPostRoot, "src/features/session/client.ts", "export async function createSession() {\n  return fetch(\"/api/sessions\", { method: \"POST\" });\n}\n");
  writeContractDoc(fetchPostRoot, "| session-create | 会话创建 | endpoint | POST /api/sessions | src/features/session | active | literal fetch method is detected |");
  expect("registered literal POST fetch", fetchPostRoot, true);

  const fetchMethodMismatchRoot = makeCase("fetch-method-mismatch");
  writeSource(fetchMethodMismatchRoot, "src/features/session/client.ts", "export async function createSession() {\n  return fetch(\"/api/sessions\", { method: \"POST\" });\n}\n");
  writeContractDoc(fetchMethodMismatchRoot, "| session-list | 会话列表 | endpoint | GET /api/sessions | src/features/session | active | wrong method |");
  expect("literal fetch method mismatch", fetchMethodMismatchRoot, false);

  const deprecatedRoot = makeCase("deprecated-entry");
  writeContractDoc(deprecatedRoot, "| session-read | 会话读取 | endpoint | GET /api/old-sessions | src/features/session | deprecated | replaced by v2 |\n| session-read | 会话读取 | endpoint | GET /api/sessions | src/features/session | active | current canonical endpoint |");
  expect("deprecated old entry can coexist with active replacement", deprecatedRoot, true);

  const duplicateCapabilityRoot = makeCase("duplicate-capability");
  writeContractDoc(duplicateCapabilityRoot, "| session-read | 会话读取 | endpoint | GET /api/sessions | src/features/session | active | first |\n| session-read | 会话读取 | endpoint | GET /api/session-list | src/features/session | active | second |");
  expect("same capability has two endpoint entries", duplicateCapabilityRoot, false);

  const duplicateEntryRoot = makeCase("duplicate-entry");
  writeContractDoc(duplicateEntryRoot, "| session-read | 会话读取 | endpoint | GET /api/sessions | src/features/session | active | first |\n| workspace-read | 工作区读取 | endpoint | GET /api/sessions | src/features/workspace | active | second |");
  expect("same endpoint assigned to two capabilities", duplicateEntryRoot, false);

  const wildcardDuplicateRoot = makeCase("wildcard-duplicate");
  writeContractDoc(wildcardDuplicateRoot, "| session-read | 会话读取 | endpoint | * /api/sessions | src/features/session | active | wildcard owns all methods |\n| workspace-read | 工作区读取 | endpoint | GET /api/sessions | src/features/workspace | active | overlaps wildcard |");
  expect("wildcard endpoint overlaps method-specific endpoint", wildcardDuplicateRoot, false);

  const escapedPipeRoot = makeCase("escaped-pipe");
  writeContractDoc(escapedPipeRoot, "| session-read | 会话读取 | endpoint | GET /api/sessions | src/features/session | active | 说明允许转义竖线 \\| 不应打断表格 |");
  expect("escaped pipe in Markdown table cell", escapedPipeRoot, true);

  const unregisteredRoot = makeCase("unregistered");
  writeSource(unregisteredRoot, "src/app/api/sessions/route.ts", "export async function POST() {\n  return Response.json({});\n}\n");
  writeContractDoc(unregisteredRoot, "| session-list | 会话列表 | endpoint | GET /api/sessions | src/features/session | active | wrong method |");
  expect("unregistered route method", unregisteredRoot, false);

  const scannerValidRoot = makeCase("scanner-valid", { scanner: scannerConfig() });
  writeSource(scannerValidRoot, "src/server/routes.ts", "export function register(app) {\n  app.get(\"/v1/jobs/:job_id/events\", async () => []);\n  app.post(\"/v1/jobs\", async () => ({}));\n}\n");
  writeSource(scannerValidRoot, "src/client/http.ts", "export function request(path: string) {\n  return fetch(path);\n}\n\nexport function listJobEvents(jobId: string) {\n  return request(`/v1/jobs/${jobId}/events`);\n}\n\nconst eventsUrl = \"/v1/events\";\n\nexport function openEvents(topic: string) {\n  return new WebSocket(`${eventsUrl}?topic=${topic}`);\n}\n\nexport function pingHealth() {\n  return fetch(\"/v1/health\");\n}\n");
  writeSource(scannerValidRoot, "src/client/preload.ts", "contextBridge.exposeInMainWorld(\"appBridge\", {});\nipcRenderer.send(\"app:window-control\");\n");
  writeContractDoc(scannerValidRoot, "| job-events | 作业事件回放 | endpoint | GET /v1/jobs/{job_id}/events?cursor={cursor} | src/client/http | active | server route and typed client share one endpoint |\n| job-create | 作业创建 | endpoint | POST /v1/jobs | src/client/http | active | server route endpoint |\n| health-check | 健康检查 | endpoint | GET /v1/health | src/client/http | active | typed client may use raw fetch internally |\n| realtime-events | 实时事件订阅 | event | WS /v1/events?topic={topic}&cursor={cursor} | src/client/http | active | one realtime entry |\n| desktop-bridge | 桌面桥接 | publicEntry | window.appBridge | src/client/preload | active | one public preload entry |\n| desktop-window | 桌面窗口控制 | event | ipc:app:window-control | src/client/preload | active | one IPC channel |");
  expect("configured scanner accepts registered server routes typed client events public entries and allowed raw network", scannerValidRoot, true);

  const unregisteredServerRouteRoot = makeCase("unregistered-server-route", { scanner: scannerConfig() });
  writeSource(unregisteredServerRouteRoot, "src/server/routes.ts", "export function register(app) {\n  app.get(\"/v1/jobs/:job_id/events\", async () => []);\n}\n");
  writeContractDoc(unregisteredServerRouteRoot, "| job-list | 作业列表 | endpoint | GET /v1/jobs | src/client/http | active | wrong endpoint |");
  expect("configured scanner rejects unregistered server route", unregisteredServerRouteRoot, false);

  const unregisteredClientPathRoot = makeCase("unregistered-client-path", { scanner: scannerConfig() });
  writeSource(unregisteredClientPathRoot, "src/client/http.ts", "export function listJobEvents(jobId: string) {\n  return request(`/v1/jobs/${jobId}/events`);\n}\n");
  writeContractDoc(unregisteredClientPathRoot, "| job-list | 作业列表 | endpoint | GET /v1/jobs | src/client/http | active | wrong endpoint |");
  expect("configured scanner rejects unregistered typed client path", unregisteredClientPathRoot, false);

  const unregisteredEventRoot = makeCase("unregistered-event", { scanner: scannerConfig() });
  writeSource(unregisteredEventRoot, "src/client/realtime.ts", "export function openEvents() {\n  return new WebSocket(\"/v1/events?topic=jobs\");\n}\n");
  writeContractDoc(unregisteredEventRoot, "| job-list | 作业列表 | endpoint | GET /v1/jobs | src/client/http | active | no event contract |");
  expect("configured scanner rejects unregistered WebSocket event entry", unregisteredEventRoot, false);

  const unregisteredPublicEntryRoot = makeCase("unregistered-public-entry", { scanner: scannerConfig() });
  writeSource(unregisteredPublicEntryRoot, "src/client/preload.ts", "contextBridge.exposeInMainWorld(\"appBridge\", {});\nipcRenderer.send(\"app:window-control\");\n");
  writeContractDoc(unregisteredPublicEntryRoot, "| desktop-window | 桌面窗口控制 | event | ipc:app:window-control | src/client/preload | active | only IPC registered |");
  expect("configured scanner rejects unregistered public preload entry", unregisteredPublicEntryRoot, false);

  const rawFetchRoot = makeCase("raw-fetch", { scanner: scannerConfig() });
  writeSource(rawFetchRoot, "src/features/dashboard/view.ts", "export async function loadDashboard() {\n  return fetch(\"/v1/jobs\");\n}\n");
  writeContractDoc(rawFetchRoot, "| job-list | 作业列表 | endpoint | GET /v1/jobs | src/client/http | active | frontend must call typed client |");
  expect("configured scanner rejects raw frontend fetch", rawFetchRoot, false);

  const rawWebsocketRoot = makeCase("raw-websocket", { scanner: scannerConfig() });
  writeSource(rawWebsocketRoot, "src/features/dashboard/view.ts", "export function openDashboardEvents() {\n  return new WebSocket(\"/v1/events?topic=dashboard\");\n}\n");
  writeContractDoc(rawWebsocketRoot, "| realtime-events | 实时事件订阅 | event | WS /v1/events?topic={topic}&cursor={cursor} | src/client/http | active | frontend must call typed client |");
  expect("configured scanner rejects raw frontend WebSocket", rawWebsocketRoot, false);

  const linkedSourceRoot = makeCase("linked-source-root", { scanner: scannerConfig() });
  const outsideSourceRoot = path.join(TMP_ROOT, "linked-source-outside");
  writeFile(path.join(outsideSourceRoot, "view.ts"), "export async function loadSecret() {\n  return fetch(\"/v1/secret\");\n}\n");
  fs.mkdirSync(path.join(linkedSourceRoot, "src"), { recursive: true });
  fs.symlinkSync(
    outsideSourceRoot,
    path.join(linkedSourceRoot, "src", "features"),
    process.platform === "win32" ? "junction" : "dir",
  );
  writeContractDoc(linkedSourceRoot, "");
  expect("configured scanner rejects linked source roots", linkedSourceRoot, false);

  const badDocNameRoot = path.join(TMP_ROOT, "bad-doc-name");
  fs.mkdirSync(badDocNameRoot, { recursive: true });
  writeManifest(badDocNameRoot, "Interface-Contracts.md");
  writeDocs(badDocNameRoot);
  writeFile(path.join(badDocNameRoot, "Interface-Contracts.md"), "# Interface Contracts\n");
  expect("non-Chinese interface contract doc name", badDocNameRoot, false);
}

try {
  main();
  if (!process.exitCode) console.log("All API contract gate tests passed.");
} finally {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
}
