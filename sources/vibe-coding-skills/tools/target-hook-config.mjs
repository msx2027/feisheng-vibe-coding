#!/usr/bin/env node

export function mergeManagedHook(current, options) {
  const { legacyBody, hookBody, managedBlock, startMarker, endMarker } = options;
  const normalized = current?.replace(/\r\n/g, "\n") ?? null;
  if (normalized === null || normalized === legacyBody) return { content: hookBody, conflict: null };
  const startCount = normalized.split(startMarker).length - 1;
  const endCount = normalized.split(endMarker).length - 1;
  if (startCount !== 1 || endCount !== 1) return { content: null, conflict: "managed pre-commit markers are missing, partial, or duplicated; left untouched." };
  const start = normalized.indexOf(startMarker);
  const end = normalized.indexOf(endMarker);
  if (start >= 0 && end > start) {
    const after = end + endMarker.length;
    return { content: `${normalized.slice(0, start)}${managedBlock}${normalized.slice(after)}`, conflict: null };
  }
  return { content: null, conflict: "existing pre-commit is not safely mergeable; left untouched. Merge the managed block manually." };
}

function autoSyncHookEntry(kind) {
  if (kind === "claude") {
    return { matcher: "Edit|Write", hooks: [{ type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/auto-sync-target-doc-index.sh"', timeout: 10 }] };
  }
  const command = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$root=[System.IO.Path]::GetFullPath((Get-Location).Path); while (-not (Test-Path -LiteralPath (Join-Path $root '.codex\\hooks\\auto-sync-target-doc-index.ps1') -PathType Leaf)) { $parent=Split-Path -Parent $root; if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $root) { exit 2 }; $root=$parent }; & (Join-Path $root '.codex\\hooks\\auto-sync-target-doc-index.ps1'); exit $LASTEXITCODE\"";
  return { matcher: "Edit|Write", hooks: [{ type: "command", command, timeout: 10 }] };
}

function feedbackHookEntry(kind) {
  if (kind === "claude") {
    return { hooks: [{ type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/detect-feedback-signal.sh"', timeout: 5 }] };
  }
  const command = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$root=[System.IO.Path]::GetFullPath((Get-Location).Path); while (-not (Test-Path -LiteralPath (Join-Path $root '.codex\\hooks\\detect-feedback-signal.ps1') -PathType Leaf)) { $parent=Split-Path -Parent $root; if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $root) { exit 2 }; $root=$parent }; $utf8=New-Object System.Text.UTF8Encoding($false); [Console]::InputEncoding=$utf8; $payload=[Console]::In.ReadToEnd(); & (Join-Path $root '.codex\\hooks\\detect-feedback-signal.ps1') -HookInput $payload; exit $LASTEXITCODE\"";
  return { hooks: [{ type: "command", command, timeout: 5 }] };
}

function routingSessionHookEntry(kind) {
  if (kind === "claude") {
    return { hooks: [{ type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/check-routing-session.sh"', timeout: 5 }] };
  }
  const command = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$root=[System.IO.Path]::GetFullPath((Get-Location).Path); while (-not (Test-Path -LiteralPath (Join-Path $root '.codex\\hooks\\check-routing-session.ps1') -PathType Leaf)) { $parent=Split-Path -Parent $root; if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $root) { exit 2 }; $root=$parent }; $utf8=New-Object System.Text.UTF8Encoding($false); $global:OutputEncoding=$utf8; [Console]::InputEncoding=$utf8; [Console]::OutputEncoding=$utf8; $payload=[Console]::In.ReadToEnd(); & (Join-Path $root '.codex\\hooks\\check-routing-session.ps1') -HookInput $payload; exit $LASTEXITCODE\"";
  return { hooks: [{ type: "command", command, timeout: 5 }] };
}

function mergeHookEntry(config, eventName, token, desired, kind) {
  if (!Array.isArray(config.hooks[eventName])) config.hooks[eventName] = [];
  const existingIndexes = config.hooks[eventName]
    .map((entry, index) => JSON.stringify(entry).includes(token) ? index : -1)
    .filter((index) => index >= 0);
  if (existingIndexes.length > 1) return `duplicate managed ${kind} ${token} hooks; left untouched`;
  if (existingIndexes.length === 1) config.hooks[eventName][existingIndexes[0]] = desired;
  else config.hooks[eventName].push(desired);
  return null;
}

export function mergeRuntimeHookConfig(current, kind) {
  let config;
  try { config = current === null ? {} : JSON.parse(current.replace(/^\uFEFF/u, "")); }
  catch (error) { return { content: null, conflict: `invalid ${kind} hook config: ${error.message}` }; }
  if (!config || typeof config !== "object" || Array.isArray(config)) return { content: null, conflict: `${kind} hook config must be an object` };
  if (!config.hooks || typeof config.hooks !== "object" || Array.isArray(config.hooks)) config.hooks = {};
  const autoSyncConflict = mergeHookEntry(config, "PostToolUse", "auto-sync-target-doc-index", autoSyncHookEntry(kind), kind);
  if (autoSyncConflict) return { content: null, conflict: autoSyncConflict };
  const feedbackConflict = mergeHookEntry(config, "UserPromptSubmit", "detect-feedback-signal", feedbackHookEntry(kind), kind);
  if (feedbackConflict) return { content: null, conflict: feedbackConflict };
  const routingConflict = mergeHookEntry(config, "UserPromptSubmit", "check-routing-session", routingSessionHookEntry(kind), kind);
  if (routingConflict) return { content: null, conflict: routingConflict };
  return { content: `${JSON.stringify(config, null, 2)}\n`, conflict: null };
}
