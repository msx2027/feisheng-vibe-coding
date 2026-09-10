# Studio Execution

Use this reference when `开发执行` is considering `工作室模式` (Studio Mode): one project-level user-visible task coordinates other full user-visible tasks. Studio Mode is an optional execution shape, not a primary route, not a Hook, not project truth, and not a substitute for subagents.

The main task is the director. It owns decomposition, dependency order, work-room creation, follow-up, conflict resolution, integration evidence, and the final completion claim. A work room owns only its assigned deliverable and may never declare the whole project complete.

## Domain-Neutral Coordination Model

Studio eligibility is a property of the task graph, not the software domain, job title, file type, or industry vocabulary. Normalize the requested work into:

- deliverable nodes with one artifact or result each;
- dependency, review, rework, and integration edges;
- one semantic owner and at most one writer for every node and shared contract;
- versioned input contracts and their freeze state;
- local/worktree environment and side-effect boundaries;
- one self-check and one downstream acceptance gate per executable node;
- user decisions and external-action approvals that remain outside room authority.

Two isomorphic task graphs must receive the same Studio decision when only their domain nouns change. A map -> asset preparation -> engine integration graph, a design -> asset preparation -> application integration graph, and a data contract -> transformation -> report integration graph are governed by the same owner, dependency, environment, and acceptance invariants.

Domain nouns must not change recommendation eligibility. Domain-specific knowledge still matters, but it enters through current project truth and each node's acceptance contract: tile size, alpha edges, and engine import rules for game assets; responsive states and accessibility for UI; schema and reconciliation for data; licensing and timing for media. The Studio core verifies that an authoritative contract and credible gate exist; it does not hard-code every domain's checklist.

Do not add a supported-domain registry, industry mode, role catalog, or one test suite per practical scenario. Add a new core rule only when a genuinely new graph invariant, authority boundary, side effect, or evidence type appears.

## Capability Gate

Studio Mode is available only when the current host exposes all capabilities needed to:

- create separate user-visible tasks in the intended project;
- choose and identify the execution environment, including local checkout or worktree when supported;
- list or retain stable task identifiers;
- wait for progress without repeatedly replaying complete histories;
- send bounded follow-up or rework instructions to an existing task;
- return artifacts and evidence to the director task.

If any required capability is absent, classify Studio Mode as `unavailable` and continue with serial execution in the current task. Do not silently degrade Studio Mode into subagents, background prompts, or invisible workers. Host adapters own exact tool names and invocation details; this portable owner defines behavior only.

## Studio Recommendation Gate

Evaluation is a director duty, not a user request. Whenever the task depth is `D2` or `D3` and the requested result contains at least two independent deliverables, run the Capability Gate and this gate before choosing serial execution or subagents, and state the decision with its reason to the user even when the decision is negative. The user must never have to name `工作室模式` to get the evaluation, and independent implementation scopes are never handed to subagents in its place.

Return exactly one internal decision, each with a concrete reason tied to current evidence:

- `recommend_studio`
- `do_not_recommend`
- `resolve_boundaries_first`

Use `recommend_studio` only when every condition below is supported by current evidence:

1. The requested result, active truth, contracts, current Git/runtime state, and relevant owner boundaries are sufficiently current.
2. The task graph contains at least two meaningful deliverables or a real producer -> reviewer -> rework loop.
3. Each write surface has a unique owner: one owner, one writer.
4. Shared API, schema, state, design, asset, permission, generated-contract, and acceptance contracts are stable enough for dependent work.
5. Environment isolation is credible for checkouts, worktrees, services, ports, generated files, dependency locks, Git effects, exact starting state, and the reviewed return path from every write room.
6. Every node has an honest self-check, independent acceptance or integration gate, and a defined stop condition.
7. Coordination benefit is materially greater than coordination overhead.

Use `do_not_recommend` when the work has a single owner, one tightly coupled module, one short delivery path, no credible independent deliverables, or insufficient benefit after coordination overhead. Task size and keywords never qualify a task by themselves.

Use `resolve_boundaries_first` when parallelism might become useful but an unstable shared contract, unclear owner, unsafe environment, missing integration path, or dirty shared checkout prevents safe execution.

If the proposed topology already contains concurrent writers for one owner or
shared writable surface, return `resolve_boundaries_first`, even when the final
safe resolution may be to keep one writer and execute serially.

The following are hard stops:

- two rooms would modify the same owner, module semantics, truth document, generated source, schema, shared configuration, or dependency lock;
- architecture, API, product outcome, permission, data rule, or delivery shape is still changing;
- the user-visible result is unresolved;
- any work room would write in the director's local checkout;
- a worktree writer lacks an exact starting-state contract or a reviewed return path;
- no gate can prove the combined result;
- multiple rooms would need competing local guesses or compatibility patches.

Any owner overlap is a hard stop. Do not use compatibility patches to reconcile competing writers. No local guess becomes a competing contract. An unsafe graph never becomes `recommend_studio`; return `resolve_boundaries_first`, list exactly which boundary, contract, environment, or gate is missing, and let the user decide whether to resolve it first. Do not implement a keyword classifier or a numeric score that can override these gates.

For each writer task card, record exact relative `allowed_paths` without globs,
absolute paths, or traversal segments. Before creating rooms, compare the whole
writer set: equal paths and parent/child path overlaps are the same writable
surface and must return `resolve_boundaries_first`. Per-room non-empty path
checks are not sufficient.

Recommendation is conjunctive, not score-based. Stable boundaries, isolated write surfaces, one writer per owner, independent acceptance, a director integration gate, and positive coordination benefit must all be present. A single module, one short owner path, an unresolved shared contract, shared writable state, or an acceptance method that cannot prove the combined result must never produce `recommend_studio`.

## User Confirmation Gate

Pass the User Confirmation Gate before any work-room creation. Present one recommendation card containing:

```text
建议：开启工作室模式 / 不开启 / 先整理边界
为什么：
唯一执行计划保存在哪里：
是否授权在该路径写入唯一计划：
将创建几个任务、各自交付什么、哪些必须等前一步通过后再开始：
每个任务可以修改什么、明确不能修改什么；写任务是否都在独立工作目录：
任务从哪个已确认版本开始；是否包含当前尚未提交的修改：
每个任务建议用哪一档模型、为什么；哪些活交给本机外部编辑器：
验收通过后，成果如何安全带回当前项目：
仍需单独确认的动作与主要风险：
是否按以上范围启动？
```

Naming Studio Mode is not approval of an unreviewed topology. A user request such as “用工作室模式做” still requires the director to show the bounded topology, owners, environments, and acceptance chain before creation. Until the user confirms that proposal, there is no work-room creation.

Confirmation authorizes only the exact plan artifact path, listed rooms, scopes, model tiers, external-executor assignments, and execution shape shown on the card. If the plan path is absent, conflicts with current truth, or the user did not authorize that local-reversible write, create zero rooms. It does not authorize commit, merge, push, deploy, production access, credentials, destructive actions, data migration, or additional rooms. A material topology, plan-owner, or scope change needs renewed confirmation.

The user card is a plain-language authorization surface, not an architecture worksheet. Keep terms such as owner, worktree, revision, patch, and contract on the internal Studio board unless the user already uses them. Translate them into visible consequences: whether two tasks can touch the same files, whether current uncommitted work is included, where a write occurs, how accepted output returns, and which later actions still require confirmation.

If the user declines, create zero rooms and continue with serial execution when the underlying task remains authorized. Declining Studio Mode does not block the underlying task.

## Host Operation Effects And Authorization

Host operations are classified by what they actually change, not by whether the call looks small:

| Portable operation | Effect | Authorization |
| --- | --- | --- |
| Resolve/list project or room status; wait; read recent task detail | Read-only observation | Existing read-only task scope. Failure may be retried only as observation; it never authorizes a replacement room. |
| Create one listed room | Creates a persistent user-visible task | The confirmed recommendation card must list that exact room, deliverable, environment, starting state, and boundary. |
| Fork a task | Creates a second persistent task from completed history | Separate explicit user authorization for the exact source, reason, environment, and new bounded deliverable. Studio topology confirmation alone is insufficient. |
| Send a continuation or rework instruction | Sends an irreversible message to an existing task | The original confirmation covers only bounded continuation/rework inside the same room, owner, deliverable, and cost. Any new owner, deliverable, model cost, effect, or scope requires renewed confirmation. |
| Handoff a task or its Git state | Interrupts a running task and moves its execution/Git environment | Separate explicit user authorization for the exact task and destination. Dispatch is not completion; the host's handoff status must reach a terminal success state. |
| Archive a task | Removes a user-visible task from the active list | Separate explicit user authorization after a terminal state is observed, normally collected once through Room Disposition at closure. Archive is not completion, rollback, recovery, or permission to discard an unreturned artifact. |

Every host trace must retain the real request fields, actual target identifiers, response state, effect, and the user event that authorized a mutating operation. A generic “Studio approved” reference cannot authorize fork, handoff, archive, Git, deployment, production, credentials, migration, destructive work, or higher model cost.

Live evaluation links the confirmation event directly to its `case_id` and exact `room_ref` set, links every room to actual host task identifiers and tool events, and links reviewed output to the direct raw-result path. Do not add a graph hash, recommendation-card hash, runner hash, self-issued credential, or similar meta-proof; those values do not prove that the user confirmed the operation or that the host performed it.

## Task Graph And Lazy Provisioning

Build a dependency graph from deliverables, not a fixed team roster. Node types are:

- `producer`: creates one bounded deliverable;
- `reviewer`: independently evaluates a producer or integrated result;
- `integrator`: combines already accepted deliverables and runs cross-owner checks.

Use these states:

```text
proposed
  -> approved
  -> queued
  -> running
  -> ready_for_review
  -> passed | rework | blocked | needs_user_decision
  -> integrated
```

Use lazy provisioning: create a room only when its dependencies and start conditions have passed. Do not create every possible room up front. Reuse the same producer room for rework and the same reviewer room for re-review instead of creating a new task for every iteration.

The normal quality edge is producer -> reviewer -> rework until the defined gate passes. When a shared contract changes, pause dependent nodes, update the owner contract and affected task cards in the director task, then explicitly resume or replace downstream work. Do not let dependent rooms continue against stale assumptions.

## Distribution Granularity And Model Tier

A room is worth creating only when its deliverable is large enough to justify re-learning the project: every new room must read the relevant code, rules, and truth before it can work, and that cost repeats per room. Work the director can finish in a few minutes of bounded local edits stays with the director; a graph that only splits such work returns `do_not_recommend` even when the owners are disjoint. Do not create downstream rooms whose inputs are not yet passed; they would work from guesses that the user then pays to rework.

Mark each node with one `work_kind`:

- `judgment`: the room must decide how something should behave, be structured, or be verified;
- `mechanical`: the room applies an already fixed contract, design, or transformation with no new behavioral choice.

Before creation, propose one model tier and reasoning depth per room from its `work_kind`, and put the proposal with its reason on the recommendation card. Defaults are fixed: use the current default tier unless the user confirms a different one; a lower tier for `mechanical` rooms may be proposed; a higher tier or deeper reasoning for any room requires the user's confirmation for that room; a reviewer room never runs below the tier of the producer it reviews. Decomposition is never silent permission to increase model cost.

## Director Continuity Loop

After the first room is created, the director owns one uninterrupted control loop:

```text
register -> wait -> receive -> review -> PASS | REWORK | BLOCKED
  -> same-room rework -> wait again -> rereview
  -> return verification -> integration
```

Apply these invariants until the Studio graph closes:

- Register every real user-visible room identifier, host identifier, latest progress cursor, plan-node reference, environment, and return-artifact location immediately after creation. A successful create call is only registration, never completion.
- When no local action is already required to unblock a room, actively wait with a bounded positive timeout. After each bounded local batch, context-compaction recovery, or new user message, refresh the active room set before starting more work.
- A terminal or attention-needed room result becomes the director's highest-priority actionable input at the next wake-up. Receive and review it before unrelated local work, preview iteration, subagent work, Cursor work, or another room is started. The user must never have to remind the director that a room already finished.
- `READY_FOR_REVIEW` is only a producer handoff. Record the result, run or wake the approved independent reviewer, and do not claim the deliverable or graph complete.
- On `REWORK`, send the exact failed gate and evidence to the original producer room, retain the latest cursor, wait on that same room again, then return the new result to the original reviewer and wait for re-review. One earlier wait never covers a later rework phase.
- On `BLOCKED` or `NEEDS_USER_DECISION`, preserve the evidence and surface only the decision that actually belongs to the user. Do not keep unrelated execution moving through a blocked dependency.
- After `PASS`, verify the approved return artifact and destination-drift preconditions before applying anything. Only a fresh combined integration gate may move a node to `integrated`.

The director may perform a bounded related read, review, or integration action while rooms run. It must not hide competing work behind an incomplete activity trace. Studio live evidence therefore needs the complete director activity interval, including local writes, subagent activity, Cursor/local-executor activity, compaction recovery, and user messages; a filtered list containing only compliant Studio host calls is incomplete evidence. When the host exposes only task tools and transcript events, the evaluator must label that narrower scope honestly and leave absence of omitted non-host activity `UNVERIFIED`; a candidate-authored completeness flag is not evidence.

Mechanism boundaries are strict:

- a user-visible task created through the approved host operation is a Studio room;
- a collaboration subagent is never a Studio room and cannot satisfy room, reviewer, wait, or return evidence;
- Cursor or another local executor is not a Studio room. It may be used only under External Local Executor below, with one writer and audited paths, and its work cannot satisfy Studio room evidence;
- a shared-checkout writer is never converted into a Studio writer by naming, prompting, or recording it as one.

Every completed-room observation, review decision, rework dispatch, repeated wait, re-review, return verification, and integration result must retain monotonic timestamps and direct event references. If the evidence cannot show what the director did between child completion and review, the continuity claim is unverified.

## External Local Executor

A locally installed IDE or coding agent (Cursor, Trae, WorkBuddy, or similar) is an external local executor: another program on the user's machine that edits files. It is not a Studio room. It does not appear in the host task list, cannot be waited on through host task tools, and never satisfies room, reviewer, wait, or return evidence. The director may hand it bounded work only under this protocol:

1. Capability probe: confirm the current host can actually operate local applications and read their results. If it cannot, report the executor `unavailable` and do not simulate it by asking the user to relay work.
2. Suitability: hand off only `mechanical` nodes with an exact deliverable, exact `allowed_paths`, and a gate the director can run itself. `judgment` nodes, protected-lane changes, and shared-contract owners stay in rooms or with the director.
3. Overlap check: before dispatch, compare the executor's `allowed_paths` with every active writer room and other executor using the same equal-or-parent rule as rooms. Any overlap waits until the other writer finishes; two writers never run on one surface.
4. Completion and return: the director itself confirms when the executor has finished, reads the actual diff against the recorded base revision, verifies it stayed inside `allowed_paths`, and runs the node's gate. The result returns through the same reviewed method the node would use as a room, normally `reviewed_patch`, and enters integration only through the director's combined gate.

Every executor assignment is listed on the recommendation card as its own line and recorded on the board with its base revision, paths, dispatch and completion evidence. A shared-checkout executor writing in the director's working copy is a shared-checkout writer and stops the graph until it is isolated or serialized.

## Studio Board

Keep one transient Studio board in the director task. When a durable plan is
active, every board node references exactly one plan node and the durable plan
is the sole owner of deliverable, dependencies, status, acceptance evidence,
blocker, decision owner, and next action. The board may cache only host/runtime
telemetry needed to operate rooms; update canonical execution state in the plan
before refreshing the projection. A topology/recommendation card before user
confirmation is not a Studio board. After confirmation, materialize the one
eligible plan owner before creating the first room; there is no exception that
lets a running Studio board temporarily own a second copy of execution state.

Each node records or projects:

- Studio run identifier and room title;
- stable room/task identifier and host identifier when the host exposes one;
- deliverable and dependencies;
- `work_kind`, confirmed model tier and reasoning depth, and whether the node runs in a room or an external local executor;
- input truth, contract version, and source revision;
- allowed owner/file scope and forbidden scope;
- local checkout or worktree, services, ports, and generated-file boundaries;
- exact starting-state kind and resolved revision;
- return method, return artifact, manifest/hash, and apply preconditions for write rooms;
- status and latest progress cursor when supported;
- self-validation gate;
- independent reviewer or integration gate;
- artifact paths and evidence;
- rework iteration and exact failure evidence;
- blocker, decision owner, and next action;
- room disposition once the run reaches closure.

The board is orchestration telemetry, not a second execution-state owner and
not durable project truth. Do not write it into the project merely to survive
context compression. When a durable plan exists, handoff and compaction reload
the plan first and reconstruct the board projection from plan node IDs plus
room/host identifiers, progress cursors, actionable states, and return-artifact
locations. Before any other post-compaction action, refresh the recorded rooms
through the host adapter and handle any terminal or attention-needed result.
Approved designs, assets,
contracts, source changes, and acceptance evidence become durable only through
their existing project owners and truth conventions.

## Work-Room Task Card

Every initial work-room instruction must contain:

- Studio run identifier and room title;
- target result and exact deliverable;
- start condition and dependencies already satisfied;
- current truth, contract version, source revision, and relevant artifact paths;
- allowed files, modules, semantics, and owner;
- forbidden owners, files, semantics, and scope expansion;
- environment, services, ports, generated sources, dependency locks, and Git constraints;
- exact starting state and proof that it matches the task card source revision;
- reviewed return method and the conditions that must still hold before the director applies it;
- output artifact paths;
- self-validation commands or repeatable acceptance path;
- required handoff format;
- stop conditions and decisions reserved for the director or user;
- explicit prohibition on commit, merge, push, deploy, credentials, production access, and destructive actions unless separately authorized.

A producer final report must use exactly one status:

- `READY_FOR_REVIEW`
- `BLOCKED`
- `NEEDS_DECISION`

It must also report changed files or artifacts, validation evidence, unverified surfaces, blockers, and the smallest next action. `READY_FOR_REVIEW` means only that the deliverable can be reviewed; it is not an integration or project completion claim.

## Independent Acceptance And Rework

Acceptance has three levels:

1. The producer self-validates and reports `READY_FOR_REVIEW`.
2. An independent reviewer performs a read-only evaluation and returns `PASS`, `REWORK`, `BLOCKED`, or `NEEDS_USER_DECISION` with exact evidence.
3. The director runs the cross-room integration gate and decides whether accepted artifacts are `integrated`.

A reviewer must not edit producer-owned output. On `REWORK`, the director sends the exact failed expectation, evidence, unchanged boundaries, and rerun gate to the original producer room. The original producer returns a new `READY_FOR_REVIEW`; the independent reviewer then reruns the same gate.

The director is the only task allowed to claim the Studio graph integrated or closed. User acceptance remains required for product-visible results or trade-offs that project rules reserve for the user.

## Environment, Starting State, And Git Isolation

The director's local checkout is read-only for Studio work rooms. Every room that creates, edits, deletes, generates, formats, stages, or otherwise mutates project files must use its own worktree, even when file owners appear disjoint. Do not rely on model judgment to prove that Git index state, generators, caches, lockfiles, services, or cleanup commands cannot interact in one checkout.

Before creating a worktree writer, resolve one exact starting-state contract:

- `default_branch`: allowed only when fresh evidence proves the clean project default branch is the current task truth;
- `working_tree`: required when current uncommitted changes are part of the task truth, and usable only after the user explicitly confirms in plain language that those changes may be copied into the independent task directory;
- `branch`: required when an existing non-default branch or ref is the task truth, and usable only after the user explicitly confirms that existing branch/ref as the work-room starting point.

The task card source revision and the worktree's resolved revision must match. If the host cannot expose or verify the effective starting state, return `resolve_boundaries_first`; never silently fall back to the default branch, copy files manually, or ask the room to reconstruct missing changes.

Every write room also needs one return contract before creation. Use the smallest method that preserves review evidence:

- `reviewed_patch`: default for source/config changes. The producer returns a binary-capable patch, an allowed-path manifest, the exact base revision, and SHA-256; the reviewer checks the worktree result and the return artifact. The director confirms the destination paths have not drifted, runs a dry apply, applies once, and then runs the integration gate.
- `reviewed_artifact_manifest`: only for bounded artifacts that cannot credibly use a patch. The manifest records source/destination paths, hashes, overwrite policy, and reviewer evidence; any unexpected existing destination stops the copy.
- `authorized_git_commit`: only after separate user authorization for the exact commit/integration action. Studio confirmation alone never authorizes it.

If no safe return method fits, classify the topology `resolve_boundaries_first`. Successful room execution, a PASS review, or an archived room is not integration until the reviewed artifact has entered the director checkout and the combined gate passes.

Every shared generated contract, OpenAPI document, generated client, schema, migration owner, or lockfile has one unique owner. No automatic commit, merge, push, or deploy is part of Studio Mode.

## Illustrative Topologies

The following are examples of reusable topology families, not an exhaustive list of supported work.

### UI design to implementation

Use a dependency chain such as:

```text
design producer
  -> independent visual reviewer
  -> rework in the original design room when needed
  -> asset producer when assets are actually required
  -> asset reviewer
  -> implementation producer
  -> browser/product reviewer
  -> integration gate
```

Skip an asset room when no separate asset deliverable exists. Do not turn optional roles into permanent ceremony.

### Frontend and backend

Parallel frontend/backend execution requires a stable shared contract and disjoint owners:

- preserve one owner, one writer across every changed contract and implementation surface;
- a contract owner finishes first when the API, schema, errors, permission, or state contract is not already current;
- frontend owns only the declared UI/client surface and versioned fixtures allowed by that contract;
- backend owns only the declared handler/service/data surface;
- generated clients, OpenAPI, schemas, migrations, and dependency locks each have a unique owner;
- real API or end-to-end integration is the integration gate.

Do not create redundant architecture or documentation rooms when current approved architecture and documents already provide the required inputs.

## Handoff, Platform Evidence, And Closure

When Studio Mode is active, a context handoff points to the one active plan owner and records only the confirmation reference plus host telemetry needed to reopen the run: room/task identifiers, host identifiers, progress cursors, environments, and artifact locations. Deliverables, graph dependencies, canonical status, acceptance evidence, blockers, decisions, and next action remain only in the plan. Do not serialize the Studio board or copy complete child histories into the handoff.

Portable static validation can prove that these gates, states, and ownership rules exist. It cannot prove that a host created, waited on, messaged, or integrated real tasks, and fresh-session behavior remains unverified until a host-specific live harness records those actions.

Validation should target topology invariants and metamorphic changes instead of enumerating industries:

- renaming domain nouns while preserving the graph must preserve the decision;
- adding writer overlap must change a safe graph to `resolve_boundaries_first`;
- changing a shared contract from stable to unstable must pause dependents;
- removing user confirmation must reduce allowed room creation to zero;
- removing the integration gate must prevent `recommend_studio`;
- `REWORK` must return to the original producer and reviewer identifiers;
- adding task size or fashionable role names without independent deliverables must not create eligibility;
- a multi-deliverable `D2`/`D3` result without a capability probe must not settle as `do_not_recommend`, and eligible implementation scopes must not become subagent work;
- raising any room's model tier without that room's user confirmation must fail;
- closing a run with accepted rooms left undispositioned must fail.

Close Studio Mode only after every required node is passed or explicitly removed by an approved scope change, the integration gate has fresh evidence, durable project truth is updated where required, and remaining unverified surfaces are reported.

## Room Disposition

After the integration gate passes and the user accepts the result, the director classifies every room before closing the run. Leaving accepted rooms in the active list without a decision is a closure defect. Use exactly one disposition per room:

- `one_off`: the deliverable is integrated, nothing in it is expected to change, and its history holds no context a later task would need. Propose archive.
- `likely_rework`: the accepted result is still likely to receive follow-up changes on the same owner, or the user has said acceptance is provisional. Keep the room active until the follow-up is closed or the user says to stop, then reclassify.
- `reusable_context`: the deliverable is final, but the room's history (design iterations, rejected options, environment setup) would save a future task real work. Propose archive and record the room's task identifier, host identifier, deliverable summary, and integrated revision in the plan's closure section so the room can later be unarchived or forked instead of rebuilt.

Present the dispositions once, together, and collect a single confirmation; archiving still needs that explicit user authorization and only after a terminal state was observed and every return artifact and decision recovered. Archiving is neither completion, rollback, nor recovery, and a room with an unreturned artifact or pending decision cannot be archived under any disposition.

Live evidence records `room_dispositions_confirmed` after `integration_completed`:
one direct post-integration user acceptance/confirmation ref and exactly one
`one_off`, `likely_rework`, or `reusable_context` row per room. Reusable context
also binds the task/host identifiers, deliverable, integrated revision, and
plan closure path; the revision comes from exactly one `integrated_revision=<Git hash>`
line in the successful combined gate output, never the Skill source revision.
Only confirmed archive tool events may follow; no further
implementation, review, or integration work belongs to that completed run.
Every confirmed archive must succeed before closure; likely-rework rooms stay
active. These events do not replace terminal observation or return verification.
