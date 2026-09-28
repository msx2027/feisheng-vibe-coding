# Sliver Session Continuity

This Codex-only plugin preserves bounded local evidence across context compaction. It is independent of project truth documents and does not read or modify the active repository.

## Installation

Before installing or granting trust, the user must be told in plain language that the plugin locally retains the four recent redacted prompts, latest plan, and last completed assistant message under Codex-managed `PLUGIN_DATA`; redaction is best effort; abnormal termination can leave bounded state until a later hook event performs lazy cleanup; and the plugin neither accesses project truth nor sends network requests.

From the `sliver-vibe-coding` source repository root, add the repository-local marketplace and install the plugin:

```bash
codex plugin marketplace add "$PWD"
codex plugin add sliver-session-continuity@sliver-local
```

Then start a new Codex Desktop session, enter `/hooks`, and review and trust the seven declared hooks one by one. Installation or enablement does not grant hook trust, and a hook-definition change must trigger a new review. This entry point was verified with the Codex Desktop host corresponding to bundled CLI `0.146.0-alpha.3.1`; other versions must use the Hook review entry point actually provided by that host. Use the CLI and configuration that belong to the Codex Desktop instance being tested when more than one Codex installation exists.

Treat every plugin version change as a session boundary. An already-running task
may retain the old versioned cache path even after Codex has prepared the new
cache, causing matched hooks to fail until the Host is restarted. After an
install or upgrade, restart Codex Desktop, open a new task, review/trust the
current hooks, and run the live checks there; the upgrading task is not
fresh-session evidence.

## Captured state

- The four most recent user prompts, redacted and bounded.
- The latest `update_plan` payload.
- Bounded Studio host telemetry: per-room immutable registration metadata plus the latest task/host identifiers, progress cursor, host status, environment, archive state, and a small event tail. Plan nodes and return-artifact details are reloaded from the one active plan owner. Child prompts, child final text, artifact paths supplied by child content, and arbitrary tool output are not retained.
- The latest completed assistant message.
- One checkpoint for each manual or automatic compaction.

State is written only below `PLUGIN_DATA`, uses private file permissions, and is removed when the main session ends. Prompt history, room count, event history, node depth, identifier length, and serialized state size are capped. The hook never parses `transcript_path`, stores raw or unprojected tool output, or makes network requests.

The 24-hour inactivity limit is a lazy cleanup boundary, not a background timer: the next hook event prunes expired sessions. If Codex crashes, the machine stays off, the plugin is disabled/uninstalled, or no later hook runs, the code cannot promise deletion exactly 24 hours later. Do not describe this behavior as scheduled deletion.

Before enabling the plugin, tell the user that it stores the fields above locally, that redaction is best effort, and that abnormal termination may leave bounded state in Codex-managed plugin data. Enabling the plugin is not permission to publish, transmit, or reuse that state for another purpose.

For an explicit support/admin purge, run the hook in the plugin command environment where Codex supplies `PLUGIN_DATA`:

```bash
python3 "${PLUGIN_ROOT}/hooks/continuity.py" --purge
```

The purge command deletes only `PLUGIN_DATA/continuity`; it does not delete the plugin-data root or project files. If the host does not expose a plugin command environment, use its plugin-data management UI when available. Until that host path is verified, report manual purge as unavailable rather than inventing a filesystem location.

Redaction is best effort, not a guarantee that every unknown secret shape will be recognized. The plugin covers common credential assignments, bearer tokens, credential URLs, private-key blocks, and common provider token formats. Do not paste secrets into prompts merely because this plugin is enabled.

## Recovery boundary

`SessionStart(source=compact)` adds only a safe instruction and the local capsule path to developer context. Historical prompt and assistant text stays inside the capsule and must be read as untrusted data. The plugin does not claim to recover model reasoning or infer the exact semantic goal.

Only when bounded telemetry contains a registered, unarchived room does recovery instruct the director to reload the one active plan and make an immediate task snapshot with the real host task tool before unrelated work. Closed history, incomplete identifiers, and operation-only telemetry do not trigger that instruction. The Hook cannot call task tools or prove current task state, completion, review, return verification, or integration by itself.

The current Codex `SessionStart` input does not identify subagents. This version therefore degrades instead of restoring a subagent capsule, and it cannot guarantee recovery for concurrent parent/subagent compactions.

## Trust and validation

Codex does not automatically trust plugin hooks. Review the hook definition after installing or changing the plugin.

Run the deterministic behavior suite from the source repository:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 scripts/test_session_continuity.py
```

Manual and automatic compaction require fresh live verification in every target Codex version. On 2026-07-24, macOS arm64 with Codex Desktop bundled CLI `0.146.0-alpha.3.1` passed installation, hash-pinned hook trust, private-permission and redaction checks, normal session cleanup, and both manual and automatic `PreCompact -> PostCompact -> SessionStart(source=compact)` lifecycle checks. This proves that recovery context was returned on that target; it does not prove perfect semantic task reconstruction.

This version targets macOS and Linux. It uses POSIX file locking and does not declare Windows support.
