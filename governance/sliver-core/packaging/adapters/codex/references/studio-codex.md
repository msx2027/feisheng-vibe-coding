# Codex Studio Host Adapter

Load this adapter only after the portable `references/studio-execution.md` contract selects or evaluates `工作室模式`. This file owns the Codex tool mapping; it does not weaken the portable recommendation, owner, confirmation, environment, or acceptance gates.

## Capability Mapping

Use the current Codex task tools as follows:

| Studio operation | Codex tool | Contract |
| --- | --- | --- |
| Resolve the saved project | `list_projects` | Call before project-scoped creation and retain the returned opaque `projectId`; never invent or derive it. |
| Create one approved room | `create_thread` | Call only after the user confirms the bounded topology. Creation is asynchronous. Retain the exact `threadId` and `hostId`. |
| Observe progress | `wait_threads` | Prefer cursor-based compact waits over repeated full reads. Wait for up to eight rooms per call and retain each returned cursor. |
| Send rework or a bounded continuation | `send_message_to_thread` | Reuse the exact `threadId` and optional `hostId`; put the instruction in the real `prompt` field. Send the failed gate, evidence, unchanged boundary, and rerun instruction to the original room. |
| Inspect missing detail | `read_thread` | Use only when compact wait output cannot support the next decision; do not repeatedly replay complete histories. |
| Fork completed context | `fork_thread` | Not the default Studio creation path. A fork copies only completed history and requires separate user authorization for the exact source, environment, reason, and child deliverable. |
| Move task/Git state | `handoff_thread` | Requires separate user authorization for the exact task and destination. It may interrupt a running task and returns an asynchronous operation, not a completed move. |
| Observe handoff completion | `get_handoff_status` | Poll once after dispatch, then use `afterRevision` with a bounded wait and back off. Only terminal success proves the handoff completed. |
| Archive a terminal room | `set_thread_archived` | Requires separate user authorization after terminal state is observed and no artifact or decision remains to be returned; normally collected once through the portable Room Disposition step. Archiving is not completion or recovery evidence. |
| Recover an archived room | `set_thread_archived` with the archived flag cleared, or `fork_thread` from the recorded `threadId` | Use the identifiers recorded in the plan's closure section for a `reusable_context` room. Unarchiving reopens the same task; forking needs its own separate authorization. Verify the tool's current parameter shape before calling; do not guess an identifier. |

Studio Mode must not use collaboration subagent tools. Subagents remain a separate invisible execution mechanism and cannot satisfy user-visible work-room requirements.

Capability probing is the first Studio step in Codex, not an afterthought: when the portable owner requires a Studio decision (`D2`/`D3` with at least two independent deliverables), confirm that `list_projects`, `create_thread`, `wait_threads`, `send_message_to_thread`, and `set_thread_archived` are actually exposed in the current session. Record `studio_capability_available` from that probe; an absent tool makes Studio `unavailable` and the decision must say so, while a present tool set means the recommendation gate runs and its result is reported to the user without being asked.

## Creation Authorization

The portable recommendation card plus the user's explicit acceptance authorizes only its listed rooms. Before the first `create_thread` call, the director must retain a confirmation evidence reference and verify:

- room title, deliverable, owner scope, forbidden scope, environment, dependencies, self-check, and reviewer are present;
- the target is the intended saved project;
- every writer has a unique owner;
- no unapproved commit, merge, push, deploy, credential, production, destructive, or migration action is present.

An explicit request to “use Studio Mode” without an approved topology is not creation authorization. A successful `create_thread` result must be surfaced as a created Codex task using the host's thread directive. A failed or queued creation must not be reported as running.

The topology confirmation authorizes only the exact listed `create_thread` calls and bounded `send_message_to_thread` continuation/rework inside those rooms. `fork_thread`, `handoff_thread`, and `set_thread_archived` each require a later, operation-specific user confirmation. `wait_threads`, `read_thread`, and `get_handoff_status` are read-only observations and cannot create, replace, move, or close a room.

## Project And Environment Selection

For repository work:

1. Call `list_projects`.
2. Match the current repository to one returned project without rewriting the opaque `projectId`.
3. Choose `environment: {"type": "local"}` only for rooms whose complete task card is read-only.
4. Choose `environment: {"type": "worktree"}` for every room that may write, generate, format, delete, stage, or otherwise mutate project files.
5. Resolve the exact source state before creation:
   - omit `startingState` only when fresh Git evidence proves the clean saved-project default branch is the task-card truth;
   - use `working-tree` only after the user explicitly confirms that current uncommitted changes are part of the work-room starting point;
   - use `branch` only after the user explicitly confirms an existing branch/ref as the starting point.
6. Record the effective starting-state kind and resolved revision. They must match the source revision in the task card; otherwise keep the node blocked.

A local room shares the saved project checkout and therefore shares dirty state; it is never a Studio write environment. A worktree request may initially return only `clientThreadId`; it is not waitable until Codex supplies a real `threadId`. Keep that node queued and surface the blocked evidence if the current host provides no safe way to resolve it.

Pass `model` or `thinking` on `create_thread` only for a tier the user confirmed on the recommendation card for that exact room. The portable Distribution Granularity And Model Tier rule decides the proposal: `mechanical` rooms may be proposed at a lower tier, a higher tier or deeper reasoning needs the user's confirmation for that room, a reviewer never runs below its producer, and omitting both fields keeps the current default. Studio decomposition is not permission to increase model cost silently.

## External Local Executor Probe

Before proposing that Cursor, Trae, WorkBuddy, or another locally installed IDE take a `mechanical` node, confirm the current Codex session actually exposes a way to operate local applications and read back their results (a computer-use or local-application control capability). If no such capability is present, report the external executor `unavailable` on the card and keep the node in a room or with the director; do not ask the user to relay work by hand as a substitute. When it is present, every dispatch, completion check, diff read, and gate run is recorded on the board with the base revision and exact paths, and the result still returns through the node's reviewed method. An external executor never appears in `wait_threads` targets and never counts as a room in live evidence.

## Director Tool Sequence

Use this sequence after confirmation:

```text
list_projects
  -> create_thread for each dependency-ready room
  -> record threadId + hostId
  -> wait_threads with bounded targets and afterCursor
  -> classify READY_FOR_REVIEW / BLOCKED / NEEDS_DECISION
  -> create or wake the approved reviewer only when dependencies pass
  -> send_message_to_thread for exact rework
  -> wait_threads again with the latest cursor
  -> verify the approved return artifact and destination has not drifted
  -> dry-apply and apply the reviewed patch/artifact in the director checkout
  -> run director integration gate
```

`create_thread` is non-blocking. Do not infer completion from successful creation. `wait_threads` commentary is progress, not acceptance. Preserve approval or user-input requests for the user; do not answer them on the user's behalf.

When an explicitly authorized fork is required, call `fork_thread` with the real source `threadId` and an explicit `{type: "same-directory"|"worktree"}` environment. A returned `clientThreadId` is queued setup, not a usable child task. When an explicitly authorized handoff is required, call `handoff_thread`, retain `operationId` and `revision`, then use `get_handoff_status`; dispatch success is not handoff success. Never archive until a prior wait/read has established a terminal state and all approved return artifacts and decisions have been recovered.

Use one bounded `wait_threads` call for the currently actionable rooms. Put each room's up-to-date cursor in that room's `targets[].afterCursor`; there is no call-level cursor. Read each returned cursor and state from the matching item in `polls[]`, and treat `wake` as the room that ended the wait. `errors[]` is per-target failure evidence. Use `timeoutMs: 0` for an immediate board snapshot and a bounded positive timeout for active monitoring. A zero-timeout or timed-out poll with `changed: false` may legitimately repeat the prior cursor; do not narrate unchanged snapshots.

Treat monitoring as a control loop, not a one-time tool step:

1. Save each real `threadId`, `hostId`, and returned cursor immediately.
2. When no director-local action is already needed to unblock a room, call `wait_threads` with a bounded positive timeout for the active room set.
3. After every bounded local work batch, every context-compaction recovery, and every new user message, call one `wait_threads` snapshot with `timeoutMs: 0` and each room's latest `afterCursor` before continuing unrelated work.
4. If a snapshot reports terminal or attention-needed state, review that result first. Do not continue preview, implementation, subagent, Cursor, or unrelated local work until the result is classified and its next edge is recorded.
5. After `send_message_to_thread` rework, reuse the same `threadId` and `hostId`, wait again with the latest prior `targets[].afterCursor`, require that room's returned poll to report `changed: true` with an advanced cursor, and repeat the same rule for the original reviewer room.

The user is not a completion notification mechanism. A user prompt asking whether a finished task was noticed is continuity-failure evidence when the task had already reached a terminal or attention-needed state before director review.

## Task Card Prompt

The `create_thread.prompt` must be a complete portable Work-Room Task Card. In Codex it must additionally name:

- saved project and chosen local/worktree environment;
- source revision or explicit dirty-working-tree boundary;
- effective starting-state kind and resolved revision;
- exact allowed paths and forbidden paths;
- service and port ownership;
- whether the room is read-only, producer, reviewer, or integrator;
- for every writer, the approved return method, artifact/manifest/hash requirements, and destination drift stop;
- the required terminal status: `READY_FOR_REVIEW`, `BLOCKED`, or `NEEDS_DECISION`;
- the prohibition on creating further tasks unless that nested topology was separately shown and confirmed.

Review rooms are explicitly read-only. They return `PASS`, `REWORK`, `BLOCKED`, or `NEEDS_USER_DECISION` with evidence and do not edit producer-owned output.

## Board And Recovery

For every created room retain:

- confirmed `case_id`, exact `room_ref` set, and confirmation event reference;
- exact `threadId`, `hostId`, and latest wait cursor;
- returned `clientThreadId` while worktree creation is queued;
- target project and environment;
- actual request target, supplied/omitted `startingState`, and effective source revision;
- room write mode, reviewed return method, return artifact/manifest/hash, and destination drift state;
- `work_kind`, confirmed `model`/`thinking` values or their omission, and room-versus-external-executor placement;
- room disposition (`one_off`, `likely_rework`, `reusable_context`) once the run reaches closure;
- current Studio state;
- latest final status and evidence;
- pending rework or user decision.

When the session-continuity plugin is installed, include the existing active plan owner path in the normal `update_plan` explanation so its capsule retains a pointer to the sole plan owner. This is a pointer only: `update_plan`, the Hook capsule, and the Studio board must not copy or replace the plan's executable state.

For every mutating host operation also retain its effect and authorization boundary:

| Tool | Effect | Required authorization |
| --- | --- | --- |
| `create_thread` | Persistent room created or queued | Exact confirmed recommendation room |
| `fork_thread` | Persistent child task created or queued | Separate user confirmation |
| `send_message_to_thread` | Irreversible prompt delivered | Confirmed same-room continuation/rework; otherwise renewed confirmation |
| `handoff_thread` | Task interrupted/moved and Git environment changed | Separate user confirmation |
| `set_thread_archived` | Terminal task removed from, or restored to, the active list | Separate user confirmation, normally the single Room Disposition confirmation at closure |
| `wait_threads`, `read_thread`, `get_handoff_status` | Observation only | Existing read-only scope |

After context compression, reconstruct orchestration from this board and stable task identifiers. Do not create replacement rooms merely because prior prose was compacted. If an identifier or environment cannot be recovered, stop that node and report the missing evidence instead of guessing.

The first post-compaction Studio action is an immediate `wait_threads` snapshot over every recoverable active room using its saved cursor. The continuity Hook may preserve identifiers and inject this instruction, but it cannot call task tools, inspect current task state, or claim that the snapshot happened. Only the actual host-tool result proves recovery.

## Codex Evidence Boundary

Static bundle validation proves only that this adapter is present in the Codex target and absent from portable targets. A Studio live pass requires fresh Codex tasks with recorded `create_thread`, `wait_threads`, and every applicable host-operation effect and authorization linked by `case_id`, `room_ref`, real task identifiers, user-confirmation events, the direct raw-result path, and source revision.

The raw evidence for every `create_thread` must retain the actual request target, opaque `projectId`, local/worktree environment, supplied or omitted `startingState`, complete prompt, returned identifiers, effective starting-state revision, room write mode, and return contract. `wait_threads` evidence must preserve the real `targets[].afterCursor` request and `wake`/`polls[]`/`errors[]` response. Review decisions must bind to the direct room result; writer return and integration decisions must bind to successful host verification commands, exact artifact hashes/base revisions, and an independent raw-case digest reviewer. The current evaluator proves the host-tool and transcript interval only. It cannot prove that an omitted local, subagent, or Cursor action never occurred; that negative completeness remains `UNVERIFIED` until a trusted host activity export exists. A prose summary, filtered host-call list, completeness boolean, or judge assertion cannot substitute for these fields.
