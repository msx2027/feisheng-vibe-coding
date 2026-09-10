#!/usr/bin/env node
// DocMap:
// Layer: L3 / key script
// Module: tools
// Depends on: tools/check-runtime-sync.mjs, tools/check-hotspots.mjs, tools/hotspot-policy.mjs, tools/safe-target-fs.mjs
// Syncs with: tools/render-project-scaffold.sh, tools/INDEX.md, skills/dev-builder/references/workflow-initialization.md
// Installs target-project runtime hooks plus pre-commit document and structural gates.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assertSafeTargetRoot,
  inspectTargetFile,
} from "./safe-target-fs.mjs";
import { commitTargetTransaction } from "./target-doc-transaction.mjs";
import { resolveTrustedGit, spawnTrustedGit } from "./trusted-git.mjs";
import { mergeManagedHook, mergeRuntimeHookConfig } from "./target-hook-config.mjs";

// The managed hook body carries a marker so re-runs update it in place instead of
// clobbering a hook the user may have extended by hand.
const LEGACY_HOOK_MARKER = "# vibe-coding-skills:runtime-sync-hook";
const HOOK_START = "# vibe-coding-skills:runtime-sync-hook:start";
const HOOK_END = "# vibe-coding-skills:runtime-sync-hook:end";
const TOOL_MARKER = "vibe-coding-skills:managed-hotspot-tool";
const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(TOOLS_DIR);
const GIT_EXECUTABLE_TOKEN = "__VIBE_TRUSTED_GIT_EXECUTABLE__";
const MANAGED_TOOLS = ["check-hotspots.mjs", "hotspot-policy.mjs", "hotspot-git.mjs", "trusted-git.mjs"];
const LEGACY_HOOK_BODY = `#!/bin/sh
${LEGACY_HOOK_MARKER}
# 由 vibe-coding-skills 生成：提交前校验 runtime 同步，并阻止结构热区继续膨胀。
# 需要手动重装时运行：node tools/setup-target-hooks.mjs .

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd -P) || {
  echo "[pre-commit] blocked: cannot resolve hook root." >&2
  exit 2
}
if [ ! -d "$ROOT" ]; then
  echo "[pre-commit] blocked: hook root is unavailable." >&2
  exit 2
fi

if [ -f "$ROOT/tools/check-runtime-sync.mjs" ]; then
  node "$ROOT/tools/check-runtime-sync.mjs" "$ROOT" || exit $?
fi

HOTSPOT_CHECKER="$ROOT/tools/check-hotspots.mjs"
if [ ! -f "$HOTSPOT_CHECKER" ] && [ -n "\${VIBE_CODING_SKILLS_HOME:-}" ]; then
  HOTSPOT_CHECKER="$VIBE_CODING_SKILLS_HOME/tools/check-hotspots.mjs"
fi
if [ ! -f "$HOTSPOT_CHECKER" ]; then
  echo "[pre-commit] blocked: missing tools/check-hotspots.mjs; rerun the vibe target setup." >&2
  exit 2
fi
node "$HOTSPOT_CHECKER" "$ROOT" --strict --staged || exit $?

exit 0
`;
const MANAGED_HOOK_BLOCK = `${HOOK_START}
# 由 vibe-coding-skills 生成：提交前校验 runtime、受管文档与结构热区。
# 需要手动重装时运行：node tools/setup-target-hooks.mjs .

GIT_EXECUTABLE=${GIT_EXECUTABLE_TOKEN}
ROOT=$("$GIT_EXECUTABLE" --no-pager -c core.fsmonitor=false rev-parse --show-toplevel) || {
  echo "[pre-commit] blocked: cannot resolve the current Git worktree root." >&2
  exit 2
}
if [ ! -d "$ROOT" ]; then
  echo "[pre-commit] blocked: hook root is unavailable." >&2
  exit 2
fi

if [ -f "$ROOT/tools/check-runtime-sync.mjs" ]; then
  node "$ROOT/tools/check-runtime-sync.mjs" "$ROOT" || exit $?
fi

if [ -f "$ROOT/.vibe-docs.json" ]; then
  DOC_CHECKER="$ROOT/tools/check-target-doc-precommit.mjs"
  if [ ! -f "$DOC_CHECKER" ] && [ -n "\${VIBE_CODING_SKILLS_HOME:-}" ]; then
    DOC_CHECKER="$VIBE_CODING_SKILLS_HOME/tools/check-target-doc-precommit.mjs"
  fi
  if [ ! -f "$DOC_CHECKER" ]; then
    echo "[pre-commit] blocked: missing tools/check-target-doc-precommit.mjs in skills runtime." >&2
    exit 2
  fi
  node "$DOC_CHECKER" "$ROOT" || exit $?
fi

HOTSPOT_CHECKER="$ROOT/tools/check-hotspots.mjs"
if [ ! -f "$HOTSPOT_CHECKER" ] && [ -n "\${VIBE_CODING_SKILLS_HOME:-}" ]; then
  HOTSPOT_CHECKER="$VIBE_CODING_SKILLS_HOME/tools/check-hotspots.mjs"
fi
if [ ! -f "$HOTSPOT_CHECKER" ]; then
  echo "[pre-commit] blocked: missing tools/check-hotspots.mjs; rerun the vibe target setup." >&2
  exit 2
fi
node "$HOTSPOT_CHECKER" "$ROOT" --strict --staged || exit $?
${HOOK_END}`;
const HOOK_BODY = `#!/bin/sh
${MANAGED_HOOK_BLOCK}

exit 0
`;
const RUNTIME_HOOKS = [
  { source: path.join(REPO_ROOT, "hooks", "auto-sync-target-doc-index.sh"), target: ".claude/hooks/auto-sync-target-doc-index.sh" },
  { source: path.join(REPO_ROOT, "codex-hooks", "auto-sync-target-doc-index.ps1"), target: ".codex/hooks/auto-sync-target-doc-index.ps1" },
  { source: path.join(REPO_ROOT, "hooks", "detect-feedback-signal.sh"), target: ".claude/hooks/detect-feedback-signal.sh" },
  { source: path.join(REPO_ROOT, "codex-hooks", "detect-feedback-signal.ps1"), target: ".codex/hooks/detect-feedback-signal.ps1" },
  { source: path.join(REPO_ROOT, "hooks", "check-routing-session.sh"), target: ".claude/hooks/check-routing-session.sh" },
  { source: path.join(REPO_ROOT, "codex-hooks", "check-routing-session.ps1"), target: ".codex/hooks/check-routing-session.ps1" },
];

function usage() {
  console.error(`Usage:
  node tools/setup-target-hooks.mjs <target-root> [--runtime-hooks-only | --precommit-only] [--json]

Installs target-project Claude/Codex document auto-sync, explicit-correction signal and conversation routing gate hooks plus .githooks/pre-commit
(runtime sync, target-document freshness, and staged hotspot ratchet gates), then points core.hooksPath at .githooks.
Idempotent: re-running refreshes the managed hook in place. If a non-managed
pre-commit already exists, it is left untouched and reported as a conflict.
--runtime-hooks-only updates only runtime hooks and configuration. --precommit-only updates only the
managed pre-commit block and core.hooksPath, preserving project tools and runtime hooks.`);
}

function parseArgs(argv) {
  const args = { root: "", json: false, help: false, runtimeHooksOnly: false, precommitOnly: false };
  for (const item of argv) {
    if (item === "--json") args.json = true;
    else if (item === "--runtime-hooks-only") args.runtimeHooksOnly = true;
    else if (item === "--precommit-only") args.precommitOnly = true;
    else if (item === "-h" || item === "--help") args.help = true;
    else if (!item.startsWith("-") && !args.root) args.root = item;
    else throw new Error(`Unknown argument: ${item}`);
  }
  if (args.runtimeHooksOnly && args.precommitOnly) throw new Error("--runtime-hooks-only and --precommit-only cannot be used together.");
  return args;
}

function existingText(root, relativePath) {
  const inspection = inspectTargetFile(root, relativePath);
  return inspection.exists ? fs.readFileSync(inspection.path, "utf8") : null;
}

function isManagedTool(name, content) {
  if (content?.includes(TOOL_MARKER)) return true;
  if (name === "check-hotspots.mjs") {
    return content?.includes("Scans target projects for large-file and high-coupling hotspot signals.");
  }
  if (name === "trusted-git.mjs") {
    return content?.includes("SAFE_GIT_GLOBAL_ARGS") && content?.includes("export function spawnTrustedGit");
  }
  return false;
}

function exactGitRoot(rootInfo) {
  const result = spawnTrustedGit(rootInfo.root, ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (result.status !== 0) return { inGitRepo: false, conflict: null };
  const reported = path.resolve(result.stdout.trim());
  let realReported;
  try {
    realReported = fs.realpathSync(reported);
  } catch (error) {
    return { inGitRepo: true, conflict: `cannot resolve Git top-level: ${error.message}` };
  }
  if (path.normalize(realReported).toLowerCase() !== path.normalize(rootInfo.realRoot).toLowerCase()) {
    return { inGitRepo: true, conflict: `target root is inside another Git repository: ${reported}` };
  }
  return { inGitRepo: true, conflict: null };
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function renderHook(template, trustedGit) {
  return template.replaceAll(GIT_EXECUTABLE_TOKEN, shellQuote(trustedGit));
}

function applyInstallation(root, plans, gitState, hookRelative = null) {
  const actions = [];
  const changedPlans = plans.filter((plan) => plan.current !== plan.content);
  const journalPath = ".vibe-target-hooks.json";
  const hookPath = hookRelative ? path.join(root, hookRelative) : null;
  const originalHookMode = hookPath && fs.existsSync(hookPath) ? fs.statSync(hookPath).mode : null;
  try {
    commitTargetTransaction(root, {
      journalPath,
      kind: "target-hook-setup",
      operations: changedPlans.map((plan) => ({ file: plan.file, content: plan.content, expectedContent: plan.current })),
    });
    if (hookPath) fs.chmodSync(hookPath, 0o755);
    if (hookPath) {
      if (gitState.inGitRepo) {
        const configured = spawnTrustedGit(root, ["config", "--local", "core.hooksPath", ".githooks"], { encoding: "utf8" });
        if (configured.status !== 0) throw new Error(`failed to set core.hooksPath: ${(configured.stderr || configured.stdout || "unknown Git error").trim()}`);
        actions.push("set core.hooksPath=.githooks");
      } else actions.push("not a git repo yet; run git init then re-run to set core.hooksPath");
    } else actions.push("runtime hooks only; Git pre-commit configuration unchanged");
  } catch (error) {
    if (changedPlans.length > 0) {
      try {
        commitTargetTransaction(root, {
          journalPath,
          kind: "target-hook-setup-rollback",
          operations: changedPlans.map((plan) => ({ file: plan.file, content: plan.current, expectedContent: plan.content })),
        });
        if (hookPath && originalHookMode !== null && fs.existsSync(hookPath)) fs.chmodSync(hookPath, originalHookMode);
      } catch (rollbackError) {
        return { ok: false, actions: [], conflict: `${error.message}; rollback failed: ${rollbackError.message}` };
      }
    }
    return { ok: false, actions: [], conflict: error.message };
  }
  for (const plan of plans) actions.unshift(plan.current === plan.content ? `${plan.file} already current` : `${plan.current === null ? "created" : "updated"} ${plan.file}`);
  return { ok: true, actions, conflict: null };
}

function planRuntimeHooks(root) {
  try {
    const runtimeHookPlans = RUNTIME_HOOKS.map((hook) => {
      const source = fs.readFileSync(hook.source, "utf8").replace(/\r\n/g, "\n");
      const current = existingText(root, hook.target);
      const managed = current?.includes("managed-target-doc-auto-sync-hook")
        || current?.includes("managed-target-experience-signal-hook");
      if (current !== null && current.replace(/\r\n/g, "\n") !== source && !managed) throw new Error(`${hook.target} exists but is not vibe-managed; left untouched.`);
      return { file: hook.target, current, content: source };
    });
    const configPlans = [["claude", ".claude/settings.json"], ["codex", ".codex/hooks.json"]].map(([kind, target]) => {
      const current = existingText(root, target);
      const merged = mergeRuntimeHookConfig(current, kind);
      if (merged.conflict) throw new Error(merged.conflict);
      return { file: target, current, content: merged.content };
    });
    return { plans: [...runtimeHookPlans, ...configPlans], conflict: null };
  } catch (error) {
    return { plans: [], conflict: error.message };
  }
}

function run(rootInput, options = {}) {
  const rootInfo = assertSafeTargetRoot(rootInput || ".");
  const root = rootInfo.root;
  const gitState = exactGitRoot(rootInfo);
  if (gitState.conflict) return { ok: false, root, actions: [], conflict: gitState.conflict };
  const trustedGit = gitState.inGitRepo ? resolveTrustedGit(root) : "";
  if (gitState.inGitRepo && !trustedGit) return { ok: false, root, actions: [], conflict: "trusted Git executable is unavailable outside the target root" };

  if (options.runtimeHooksOnly) {
    const runtimeHooks = planRuntimeHooks(root);
    if (runtimeHooks.conflict) return { ok: false, root, actions: [], conflict: runtimeHooks.conflict };
    return { root, ...applyInstallation(root, runtimeHooks.plans, gitState) };
  }

  const actions = [];
  const hookRelative = ".githooks/pre-commit";
  const currentHook = existingText(root, hookRelative);
  if (options.precommitOnly && currentHook === null) {
    return {
      ok: false,
      root,
      actions,
      conflict: "--precommit-only only refreshes an existing managed pre-commit; no hook was written.",
    };
  }

  const hookMerge = mergeManagedHook(currentHook, { legacyBody: LEGACY_HOOK_BODY, hookBody: renderHook(HOOK_BODY, trustedGit), managedBlock: renderHook(MANAGED_HOOK_BLOCK, trustedGit), startMarker: HOOK_START, endMarker: HOOK_END });
  if (hookMerge.conflict) {
    return {
      ok: false,
      root,
      actions,
      conflict: hookMerge.conflict,
    };
  }

  const desired = hookMerge.content.replace(/\r\n/g, "\n");
  const plans = [{ file: hookRelative, current: currentHook, content: desired }];
  if (!options.precommitOnly) {
    const toolPlans = MANAGED_TOOLS.map((name) => {
      const source = fs.readFileSync(path.join(TOOLS_DIR, name), "utf8");
      const relativePath = `tools/${name}`;
      const current = existingText(root, relativePath);
      return { name, source, relativePath, current };
    });
    const toolConflict = toolPlans.find(
      ({ name, source, current }) => current !== null && current !== source && !isManagedTool(name, current),
    );
    if (toolConflict) {
      return {
        ok: false,
        root,
        actions,
        conflict: `${toolConflict.relativePath} exists but is not vibe-managed; left untouched.`,
      };
    }
    const runtimeHooks = planRuntimeHooks(root);
    if (runtimeHooks.conflict) return { ok: false, root, actions: [], conflict: runtimeHooks.conflict };
    plans.push(
      ...toolPlans.map((plan) => ({ file: plan.relativePath, current: plan.current, content: plan.source })),
      ...runtimeHooks.plans,
    );
  }
  const applied = applyInstallation(root, plans, gitState, hookRelative);
  return { root, ...applied };
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exitCode = 0;
  } else if (!args.root) {
    throw Object.assign(new Error("Missing target root."), { exitCode: 2 });
  } else {
    const result = run(args.root, { runtimeHooksOnly: args.runtimeHooksOnly, precommitOnly: args.precommitOnly });
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      for (const action of result.actions) console.log(`[hook] ${action}`);
      if (result.conflict) console.log(`[hook] conflict: ${result.conflict}`);
      console.log(`Result: ${result.ok ? "PASS" : "FAIL"}`);
    }
    process.exitCode = result.ok ? 0 : 1;
  }
} catch (error) {
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  } else {
    console.error(`[FAIL] ${error.message}`);
  }
  process.exitCode = error.exitCode || 2;
}
