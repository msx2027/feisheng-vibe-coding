import assert from "node:assert/strict";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repositoryRoot, "examples", "golden-path", "web-vite-mini");
const desktopRoot = path.join(repositoryRoot, "examples", "golden-path", "desktop-electron-mini");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
    encoding: "utf8",
    env: {
      ...process.env,
      ELECTRON_DISABLE_GPU: "1"
    }
  });
}

function describeProcess(result) {
  return [
    `status=${result.status}`,
    result.signal ? `signal=${result.signal}` : "",
    result.error ? `error=${result.error.message}` : "",
    result.stdout?.trim() || "",
    result.stderr?.trim() || ""
  ].filter(Boolean).join("\n");
}

function assertProcessSucceeded(result, label) {
  assert.equal(result.error, undefined, `${label} failed to start:\n${describeProcess(result)}`);
  assert.equal(result.status, 0, `${label} failed:\n${describeProcess(result)}`);
}

function copyDirectoryContents(sourceRoot, targetRoot) {
  mkdirSync(targetRoot, { recursive: true });
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const targetPath = path.join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
    } else {
      copyFileSync(sourcePath, targetPath);
    }
  }
}

const viteCli = path.join(webRoot, "node_modules", "vite", "bin", "vite.js");

const webPackage = readJson(path.join(webRoot, "package.json"));
assert.match(webPackage.scripts.build, /tsc --noEmit/u, "Web build must type-check TypeScript");
assert.match(webPackage.scripts.build, /vite build/u, "Web build must execute Vite");
for (const file of ["index.html", "vite.config.ts", "tsconfig.json", "src/main.tsx"]) {
  assert.equal(existsSync(path.join(webRoot, file)), true, `Missing Web source file: ${file}`);
}

const webSmoke = run(process.execPath, ["scripts/test.mjs"], webRoot);
assertProcessSucceeded(webSmoke, "Web real-source smoke");

const brokenWebRoot = mkdtempSync(path.join(webRoot, ".real-source-fixture-"));
try {
  for (const file of ["index.html", "package.json", "tsconfig.json", "vite.config.ts"]) {
    cpSync(path.join(webRoot, file), path.join(brokenWebRoot, file));
  }
  copyDirectoryContents(path.join(webRoot, "src"), path.join(brokenWebRoot, "src"));
  const brokenEntry = path.join(brokenWebRoot, "src", "main.tsx");
  writeFileSync(brokenEntry, 'import "./missing-entry";\n');
  const brokenBuild = run(process.execPath, [viteCli, "build"], brokenWebRoot);
  assert.equal(brokenBuild.error, undefined, `Vite broken-entry build could not start:\n${describeProcess(brokenBuild)}`);
  assert.notEqual(brokenBuild.status, null, `Vite broken-entry build timed out:\n${describeProcess(brokenBuild)}`);
  assert.notEqual(brokenBuild.status, 0, `Vite build must fail when the TSX entry is broken:\n${describeProcess(brokenBuild)}`);
  assert.match(`${brokenBuild.stdout}\n${brokenBuild.stderr}`, /missing-entry/u, "Vite failure must identify the broken TSX entry");
} finally {
  rmSync(brokenWebRoot, { recursive: true, force: true });
}

const desktopPackage = readJson(path.join(desktopRoot, "package.json"));
assert.equal(desktopPackage.dependencies.electron, "43.4.0", "Electron version must remain locked");
assert.match(desktopPackage.scripts.smoke, /electron/u, "Desktop smoke must launch Electron");
assert.match(desktopPackage.scripts["prepare:electron"], /node_modules[\\/]electron[\\/]install\.js/u, "Desktop runner must expose the Electron binary preparation step");
const desktopMain = readFileSync(path.join(desktopRoot, "src", "main.mjs"), "utf8");
assert.match(desktopMain, /BrowserWindow/u, "Desktop main must create an Electron window");
assert.match(desktopMain, /app\.whenReady/u, "Desktop main must use Electron readiness lifecycle");
assert.match(desktopMain, /Content-Security-Policy/u, "Desktop renderer must define a Content Security Policy");

const desktopBuild = run(process.execPath, ["scripts/build.mjs"], desktopRoot);
assertProcessSucceeded(desktopBuild, "Electron source build");

const electronBinary = path.join(
  desktopRoot,
  "node_modules",
  "electron",
  "dist",
  process.platform === "win32" ? "electron.exe" : "electron"
);
assert.equal(existsSync(electronBinary), true, `Electron binary is missing: ${electronBinary}`);

const electronArgs = ["--disable-gpu", ".electron-dist/main.js", "--smoke"];
let electronCommand = electronBinary;
let electronCommandArgs = electronArgs;
if (process.platform === "linux" && !process.env.DISPLAY) {
  const xvfbProbe = run("xvfb-run", ["--help"], desktopRoot);
  if (xvfbProbe.status === 0) {
    electronCommand = "xvfb-run";
    electronCommandArgs = ["-a", electronBinary, ...electronArgs];
  }
}

const desktopSmoke = run(electronCommand, electronCommandArgs, desktopRoot);
assertProcessSucceeded(desktopSmoke, "Electron real-source smoke");
const desktopResult = desktopSmoke.stdout.match(/\{[^\n]*"app":"desktop-electron-mini"[^\n]*\}/u);
assert(desktopResult, "Electron smoke output is missing the app marker");
const desktopSmokePayload = JSON.parse(desktopResult[0]);
assert.deepEqual(desktopSmokePayload, {
  ok: true,
  app: "desktop-electron-mini",
  process: "electron-main",
  window: true,
  preload: "ready"
});

console.log("Golden path real-source tests passed");
