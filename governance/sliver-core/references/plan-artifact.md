# Plan Artifact Owner

Use this owner when work produces a multi-stage executable plan whose state must
survive implementation, user corrections, review, or context compaction, and
when requested, handoff or a later session. The recorded persistence scope must
match the selected storage; a current-task temporary file never proves
cross-session durability. The plan is working truth for the active task, not a chat
summary and not a second product, architecture, schema, or release owner.

## Eligibility

Materialize a plan artifact when at least one condition holds:

- execution has ordered stages or several owner-changing steps that cannot close
  safely in one turn;
- the user asks for a plan that will be executed, reviewed, resumed, or handed
  off;
- a correction changes the active execution order, scope, evidence gate, or
  forbidden action;
- context compaction, a new window, or another agent would otherwise have to
  reconstruct the plan from chat.

Do not create a plan artifact for `D0`, ordinary `D1`, a read-only answer that
does not request an executable plan, or a single bounded action whose scope and
acceptance fit safely in the current task. Depth alone never creates a document
requirement. A user request for a plan that will be executed, reviewed, resumed,
or handed off is not a chat-only read-only answer: it authorizes exactly one
local-reversible plan artifact and no change to the audited/source owners.

Record this boundary in Task Decision with `materialize_plan: true`, the exact
`plan_target`, a `plan_phase`, independent `plan_review`, and loaded owner ID
`plan_artifact`. Delivery `evidence` continues to describe the requested audit,
implementation, design, verification, or handoff; it never doubles as review
join evidence. The next
concrete action remains honest:

- before a blocking audit/review joins, use `plan_phase: pending_review` and
  `plan_review.status: pending`, while classifying the actual audit/read action;
- after every blocking review joins, regenerate Task Decision with
  `plan_phase: ready_to_write`, action `plan_artifact`, and the same exact
  `plan_target`; record non-empty review refs under
  `plan_review.status: collected`, then
  write the plan;
- when no blocking review applies, use `plan_review.status: not_required` with
  the reason and proceed to the exact-path plan write without inventing review
  evidence;
- after the artifact exists, use `plan_phase: materialized` and classify the
  next real implementation, validation, or handoff action.

Do not record the future plan write as the current action while a blocking
review is still running. If the user asked for the executable plan but
prohibited changing the audited Skill/source, write only the plan owner after
the review join; do not reinterpret that prohibition as permission to leave the
plan in chat.

The coordinator supplies the complete expected blocking-review ref set outside
the decision. `pending_review` requires that set to be non-empty.
`collected` must match it exactly—no omitted, substituted, duplicated, or
self-invented ref is accepted. `not_required` is valid only when the external
set is empty. Decision text cannot authenticate its own review convergence.

Immediately before a plan write with blocking reviews, validate the write event
through `references/formal-materialization.md` using
`artifact_kind: formal_deliverable`. Task Decision remains the owner of
`materialize_plan`, `plan_phase`, target provenance, and `plan_review`; the
formal event contract consumes those refs and independently verifies the same
Coordinator-authenticated complete set, source revision, accepted-input
digest, plan artifact identity, and single writer lease. Do not duplicate or
reinterpret review completeness in another plan-specific owner.

## Exactly One Owner

Reuse the active stage, feature, rescue, release, or governance truth document
when it already owns the executable plan. Otherwise choose exactly one path in
this order:

1. the user's explicit plan path;
2. the repository's established active internal-truth convention;
3. for `current_task` persistence, a deterministic task-specific file under the host task temporary
   directory, named from the stable task/session identity. If the host exposes
   no stable identity or stable task-scoped temporary root, stop before writing
   and request an explicit path. Never derive identity from request text, a
   timestamp, a random value, or an agent-invented repository convention;
4. for `cross_session` persistence, a host task-durable path only when the host
   explicitly guarantees later-session retention, otherwise stop and request
   an explicit path. Never relabel a session temporary directory as durable.

The third choice is the current-task fallback, not a new user decision. Use it when
the repository has no established plan-truth convention, including when the
repository is writable but its source owners are read-only for the current
audit. Do not invent `dev-docs/`, `docs/`, or another repository convention,
and the requested scope ends within the current task. A later-session promise
requires choice 1, 2, or 4 and cannot be satisfied by choice 3.

For choices 3 and 4, the host root and stable task identity are validation
context supplied outside the Task Decision record. Normalize the path and
require exact equality with that external root plus the canonical filename;
reject relative paths, traversal, symlink roots, identity mismatches, and a
decision that merely self-reports its own root.

Choice 1 likewise requires the exact user-authorized path as external
validation context. Choice 2 requires the exact repository plan owner found by
read-only discovery as external validation context. Merely labeling an invented
repository path `active_internal_truth` or `explicit_path` never establishes
provenance.

Do not create a second progress log, checklist, handoff plan, or chat-only copy.
A handoff points to the active plan owner and carries only the minimum state
needed to reopen it. Chat is not the plan owner.

The plan must record only task-local execution truth:

- outcome, scope, non-goals, current baseline, and unique writer;
- ordered steps, current step, acceptance gates, stop conditions, and forbidden
  actions;
- actual changed owners, fresh evidence, failures, remaining risks, and exact
  next action;
- Git/runtime state and unverified planes when they affect continuation.

Product, architecture, schema, permission, security, and release facts remain in
their canonical owners; link them instead of copying their full contracts.

## Write-Through Events

Write the initial artifact before calling a multi-stage plan final, executable,
approved, or ready. Then update the same owner before continuing whenever:

- the user corrects or rejects any part of the active plan;
- a step starts, completes, fails, is skipped, or changes owner;
- review or validation changes the implementation or acceptance boundary;
- the task stops, becomes blocked, compacts, hands off, or resumes;
- source, accepted input, Git state, runtime state, authorization, or evidence
  invalidates an earlier result.

When there is no blocking user decision, write the change to the artifact and
continue. Use chat only for necessary decisions, concise status, and final
verified outcomes; do not repeatedly paste the plan into conversation.

## Closeout

Close the plan with the honest terminal state: `completed`, `partial`, or
`blocked`. Record completed work, uncompleted work, exact verification, current
Git/runtime boundary, and the next safe action. A structurally complete plan is
not implementation, live behavior, release, or publication evidence.
