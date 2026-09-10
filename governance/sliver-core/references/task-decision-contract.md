# Task Decision And Materialization Contract

This file is the single owner of the machine Task Decision schema, its closed enums and validation semantics, plan/stage materialization fields, and Task Decision anti-regression rules. Load it only under the conditional predicate in `routes-index.md`. Task depth definitions and bounded discovery remain owned by `task-risk-gates.md`.

## Task Decision v1

Task Decision is an internal and testable decision record. Do not force users to read it and do not create a per-task sidecar for ordinary work.

```yaml
schema: sliver-task-decision/v1
decision_status: resolved
primary_route: 开发执行
operation: implement
delivery_kind: implementation
result: <bounded requested result>
non_goals: [<explicit exclusions>]
scope:
  proposed_targets: [<exact path, path/**, or ** for the whole candidate scope>]
  excluded_targets: [<every still-active explicit exclusion>]
owner_topology:
  semantic_owners: [<stable owner IDs or paths>]
  owner_count: 1
  joint_contract_required: false
  shared_writable_surface: false
  mechanical_execution: false
  new_foundation_judgment: false
  contracts_stable: true
  ordered_dependencies: false
  studio_capability_available: false
  environment_isolation_credible: false
  independent_acceptance: false
  integration_gate_defined: false
  coordination_benefit_positive: false
delegation:
  decision: current_only
  independent_scopes: []
  join_point: null
  reason: <why local execution or delegation materially improves evidence/time>
task_depth: D1
depth_rule: single_owner_established_contract
risk_lanes: []
evidence:
  mode: test
  test_level: T2
  route_evidence_kind: null
  status: planned
effect:
  effect_class: local_reversible
  action: local_edit
  exact_target: <bounded path or asset>
  required_tier: local_reversible
  granted_tier: local_reversible
  authorization_evidence: <current user request or later explicit confirmation>
  recovery_known: true
  health_and_stop_required: false
  authorization_status: satisfied
operational_mode: planned
discovery: resolved
loaded_owner_ids:
  - routes
  - task_depth
  - testing
  - effect_recovery
materialize_plan: false
materialize_stage: false
reason: <short evidence-based explanation>
studio_decision: do_not_recommend
```

`scope` is the executable write-boundary projection, while `non_goals` remains the semantic explanation. The Host or Coordinator supplies the complete still-active exclusion set separately when it has one. The decision must reproduce that set exactly. A resolved decision fails when any proposed target intersects an excluded target. A later broad instruction does not revoke a named exclusion; only an explicit rescission or an explicit instruction naming the excluded target can reopen it.

`delegation.decision` is `current_only|use_subagents`. `D0` always stays current-only. Delegation requires at least two genuinely independent scopes, a join point, and positive coordination benefit; repository preference cannot manufacture those facts. Every `independent_scopes` entry under `use_subagents` is read-only (audit, review, diagnosis); an implementation-writing scope is never a subagent scope. When independent implementation scopes exist, resolve `studio_decision` first; if Studio is unavailable, not recommended, or declined, implementation stays `current_only` and serial.

### Closed enums and validation

- `decision_status`: `resolved|split_required|unresolved_safe|unresolved_protected_stop|unresolved_product_stop|invalid`.
- `delivery_kind`: `implementation|behavior_verification|audit|diagnosis|decision|design|verification|handoff|direct_artifact`.
- `task_depth`: `D0|D1|D2|D3`.
- `depth_rule`: `direct_bounded_contract|single_owner_established_contract|multi_owner_joint_contract|foundation_or_program_topology`.
- `evidence.mode`: `test|route`.
- `evidence.test_level`: exactly `T0|T1|T2|T3|T4` when mode is `test`; otherwise `null`.
- `evidence.route_evidence_kind`: exactly `audit|diagnosis|decision|design|verification|handoff` when mode is `route`; otherwise `null`.
- `evidence.status`: `planned|collected|unverified|failed`.
- `operational_mode`: `planned|urgent|incident`.
- `discovery`: `resolved|unresolved_safe|unresolved_protected_stop|unresolved_product_stop`.
- `studio_decision`: `recommend_studio|do_not_recommend|resolve_boundaries_first`.
- `plan_phase`: `pending_review|ready_to_write|materialized` when
  `materialize_plan: true`; otherwise `null`.
- `plan_target_kind`: `explicit_path|active_internal_truth|task_temporary|task_durable` when
  `materialize_plan: true`; otherwise `null`.
- `plan_persistence_scope`: `current_task|cross_session`. `task_temporary` is
  valid only for `current_task`; `task_durable` is valid only when the host
  explicitly guarantees a cross-session durable task store.
- `plan_review.status`: `pending|collected|not_required`; `collected` requires
  non-empty unique `refs`, while the other states require `refs: []`. `reason`
  always explains why review is pending, what joined, or why no blocking review
  applies.
- `truth_capture` (optional block, fields exactly `decision`, `target`,
  `reason`, `authorization_status`): `decision` is
  `update_existing|create_new|merge_into|supersede|not_needed|deferred`;
  `authorization_status` is `pending|confirmed|declined|not_applicable`.
- `materialize_audit` (optional, default false), with `audit_target`,
  `audit_pass: triage|deep|review|reviewed_pending_promotion|closed`, and for `reviewed_pending_promotion` or `closed` also
  `unresolved_findings` (integer) and `promoted_to` (exact live-owner path or
  `none`).

For `resolved`, `operation` must be a non-empty operation owned by the selected
route and `delivery_kind` must be one that operation can actually deliver. For
example, an audit cannot be attached to `implement`, and release `prepare`
cannot be disguised as a `D0` direct artifact. Implementation and behavior
verification use `evidence.mode: test`; audit, diagnosis, decision, design,
verification, and handoff use `evidence.mode: route`. `direct_artifact` uses
the evidence mode that matches whether behavior is being verified.

`evidence.status` is required. `resolved` and `split_required` decisions use
`discovery: resolved`; each `unresolved_*` decision uses the identically named
discovery outcome. An `invalid` decision cannot claim resolved discovery. These
pairs keep decision readiness separate from whether planned evidence has already
been collected.

`risk_lanes` must contain only stable IDs from
`references/risk-control-gates.md`. A protected implementation cannot use
`T0` or exploratory `T4` as its release evidence. `effect.action` must use the
fixed action IDs from `references/effect-recovery-gates.md`, and
`effect.required_tier` must be derived from that action rather than chosen by
the task. A satisfied action also records the exact target, granted tier,
authorization evidence, and recovery/stop state. Unknown enum values fail
closed.

`loaded_owner_ids` is a closed set. Every decision loads `routes`,
`task_depth`, and `effect_recovery`; implementation additionally loads
`testing`; active risk, Studio, and materialized-stage decisions load only
their matching `risk_control`, `studio_execution`, and `project_flow` owners;
a recorded `truth_capture` block loads `truth_capture`, and
`materialize_audit: true` loads `audit_artifact`.
An eligible durable plan uses `materialize_plan: true`, records one exact
`plan_target`, its `plan_target_kind`, and loads `plan_artifact`. A
`task_temporary` or `task_durable` target also records the host-provided stable
`plan_task_identity` and must resolve to the matching host root plus
`/sliver-plan-<stable-task-id>.md`. The validator receives that root and task
identity as external host context; fields inside the decision cannot self-prove
their provenance. Relative, traversing, symlink-root, root-mismatched, or
identity-mismatched targets fail closed. A temporary target cannot claim
later-session recovery. If cross-session recovery is required and the host
exposes no durable task store, stop and request an explicit path. Never synthesize an owner
from a timestamp, random value, or request-text digest. `evidence` always
describes the requested delivery and never doubles as blocking-review proof.
`plan_review` owns that proof. `pending_review` classifies the actual read/audit
action while preserving the route's real delivery and evidence mode; after
blocking reviews join, regenerate the decision as `ready_to_write` with action
`plan_artifact` and `plan_review.status: collected`. When no blocking review is
required, use `not_required` rather than forging collected evidence. After the
file exists, `materialized` classifies the next real action. The user's request for an
executable/resumable plan is authorization only for that exact
local-reversible artifact.
The validator receives the coordinator's complete expected blocking-review ref
set outside the decision: `collected` must equal it exactly, `pending_review`
requires a non-empty set, and `not_required` requires an empty set. For
`explicit_path` it also receives the exact externally authorized path; for
`active_internal_truth` it receives the exact owner discovered before the
decision. Neither path kind nor review refs can self-authenticate.
Missing or unknown owners fail closed. An extra known owner currently emits a
diagnostic warning but does not fail the decision; record why it was loaded and
audit both the static corpus and real fresh-session distribution before any
separate proposal to make the required set exact.

`recommend_studio` additionally requires every Studio eligibility field in
`owner_topology` to be true, at least two semantic owners, stable contracts, and
`shared_writable_surface: false`. These fields record the conjunctive gate owned
by `references/studio-execution.md`; task size or domain nouns cannot substitute
for host capability, environment isolation, independent acceptance, a director
integration gate, or positive coordination benefit.

`studio_capability_available` must come from an actual host probe. For a
`D2`/`D3` result with at least two independent deliverables, `do_not_recommend`
is valid only when the probe ran or another eligibility field is honestly
false with evidence; an unprobed host cannot justify `do_not_recommend`, and the
decision must state the studio reason in `reason`.

When `shared_writable_surface: true`, `studio_decision` must be
`resolve_boundaries_first`. `do_not_recommend` is for a safely understood graph
whose coordination benefit is absent; it must not hide an unsafe concurrent
writer proposal. `resolve_boundaries_first` does not authorize parallel work.

## Truth Capture

Record `truth_capture` whenever `references/truth-capture.md` ran its gate, and
load owner `truth_capture`. `D0` never records it. The four write decisions
(`update_existing`, `create_new`, `merge_into`, `supersede`) require one exact
non-placeholder `target` and an Authorization Card status other than
`not_applicable`; `not_needed` and `deferred` require `target: null` and
`authorization_status: not_applicable`, with `reason` naming why nothing is
written or which card or drift check is still unanswered.

A confirmed card is the only path to a write. `create_new` or `supersede` with
`authorization_status: confirmed` uses `effect.action: truth_doc_write` for the
new document; `exact_target` equals `truth_capture.target`. `update_existing`
and `merge_into` use `local_edit` on the existing owner. A superseding ADR keeps
the old decision body immutable: its status/superseded_by metadata and the
index use separately targeted `local_edit` actions named by the same card. While the card is
`pending` or `declined`, `truth_doc_write` is invalid and `local_edit` on the
proposed target is invalid. `truth_doc_write` without a `truth_capture` block,
or with any decision other than `create_new` or `supersede`, fails closed. A `deferred`
decision after a Post-Acceptance Drift Check means the next batch has not been
authorized to start as if no drift existed.

## Audit Materialization

Set `materialize_audit: true` when `references/audit-artifact.md` decides that
the audit report is written (module scope or larger, or an explicit
audit/review/health-check request). It is valid only for `delivery_kind: audit`
and loads owner `audit_artifact`. `audit_target` is the exact report path and
must not equal `plan_target` or `stage_target`. `audit_pass` records the
current pass; the passes are ordered and none is skipped.

An audit with a materialized report classifies only `read`, `audit`,
`stateless_verify`, user-approved `test` or `build`, or `audit_artifact`;
`local_edit`, `plan_artifact`, `truth_doc_write`, and every controlled action
are invalid inside it. `audit_artifact` requires `effect.exact_target` to equal
`audit_target`. An optional `audit_index_target` permits only the report
folder's `README.md` as an auxiliary index update in the same report action;
include it in `scope.proposed_targets` so explicit exclusions still apply.
it is never permission to write a live owner. Without an established report-index convention, omit it. A first report may
create that conventional index. `reviewed_pending_promotion` records completed review with
`unresolved_findings > 0` and `promoted_to: none`; the report remains `open`.
Promotion is a separate authorized truth update outside audit delivery, never
an exemption from the audit action allowlist. When `audit_pass` is `closed`, `unresolved_findings` and
`promoted_to` are required: unresolved findings greater than zero with
`promoted_to: none` fail closed, and `promoted_to` may never be the report
itself. Audit fields without `materialize_audit: true`, or an `audit_artifact`
action without it, fail closed.

## Stage Materialization

Set `materialize_stage: true` only when the decision can name one trigger owned
by `project-flow.md`:

- `cross_owner_drift`: `owner_count >= 2`, every affected owner is named in `semantic_owners`, `joint_contract_required: true`, and the joint contract or acceptance has `contracts_stable: false`;
- `ordered_nonclosable_transition`: the decision has ordered dependencies that cannot close safely in the task record;
- `durable_handoff_requested`: `delivery_kind: handoff` is requested across at least two affected `semantic_owners` under one joint contract. A one-owner handoff is not this trigger.

An existing active stage is current truth, but its mere existence is not a
fourth trigger and does not by itself make this decision's
`materialize_stage` value true.
A stable `D2` Studio recommendation does not itself trigger materialization.
`D3` foundation or ordered-program work still materializes through the matching
trigger rather than depth alone.

When one task artifact serves as both the durable plan and Stage truth, the
decision records `stage_target` and it must be identical to `plan_target`.
Stage-only or plan-only decisions omit `stage_target`. The runtime rejects two
writable progress owners for the same task.

Do not materialize stage truth for `D0`, ordinary `D1`, or a `D2`/`D3` whose
contract and acceptance fit safely in the task record.

## Anti-Regression Rules

The following pairs must preserve depth:

- “change this exact button spacing from 12px to 16px” and the same request mentioning an admin/API/database/SDK context are both `D0` when the owner and mechanical transformation are unchanged;
- a normal one-owner bug and a cross-user authorization bug can share the same depth while the latter activates stronger risk/test/effect controls;
- reading a public schema and reading sensitive production logs can share the same depth while only the latter activates the privacy lane;
- discussing whether an artifact is ready to publish is a read-only decision and
  must not inherit the future publish effect; executing publication of an
  already verified artifact can be `D0` while still requiring
  `critical_operation` authorization for the exact production target.

The following must not recommend Studio:

- one module or one writable surface;
- two rooms that would edit the same owner;
- unstable contracts or missing acceptance;
- coordination cost greater than independent work saved.

Apply the proportional release-scope test rules owned by `testing-strategy.md`; task depth does not choose a fixed release case count or redefine the protected-boundary verdict.
