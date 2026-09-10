# Codex Execution Liveness Adapter

Load this Codex-only fragment after `references/execution-liveness.md`. The portable owner remains authoritative; this file only maps currently documented Codex unified-exec receipts.

## Unified Exec Mapping

- An `exec_command` result containing `session_id` represents an observable running operation. Record that `session_id` as `operation_identity` and `unified_exec_session` as `operation_kind`.
- The next tool action after the first running receipt is a matching `write_stdin` refresh with that exact `session_id`, or a matching Host-supported cancel. Use an empty write to poll; use non-empty input only when the command contract requires it and the input is authorized.
- When a matching refresh remains running, prefer a longer supported `yield_time_ms`. The portable one-bounded-batch exception still applies; do not start a second pending command or modify the pending command's files, process inputs, configuration, or test preconditions.
- Treat `exit_code` as terminal metadata when supplied. `chunk_id`, `original_token_count`, `wall_time_seconds`, output truncation, and repeated `session_id` are Host-optional receipt fields; absence of optional counters makes evidence `metadata_incomplete`, not automatically unrecoverable.
- Keep command output in the Host tool receipt. Do not copy complete stdout/stderr, tool responses, transcripts, credentials, or secrets into continuity hooks, handoffs, or live fixtures. Normalize only lifecycle/evidence fields and artifact references needed by the portable receipt.

Codex Responses API background mode and Codex Desktop unified-exec sessions are different lifecycle contracts. Do not use API response IDs, polling endpoints, or API background guarantees as proof about a Desktop `session_id`.

## Host Boundary

This adapter can guide polling only while the model loop continues. It cannot guarantee that a tool result schedules the next model turn, wake a silent task, reap an orphan after the loop is lost, or provide scheduler/watchdog telemetry. Those remain Codex Host/service responsibilities and `UNVERIFIED` until matched Host evidence exists.
