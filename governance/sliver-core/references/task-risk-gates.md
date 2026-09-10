# Task Depth And Decision Gates

This file is the single runtime owner of task depth, owner topology, bounded discovery, and the Task Decision shape. Risk controls, test level, effects, and authorization are independent axes owned by their referenced files.

The goal is proportional execution:

- a small task stays small even when its nouns sound technical;
- a dangerous one-line action gets the required control without becoming a large project;
- a genuinely cross-owner result gets enough design, truth, and acceptance to avoid drift;
- uncertainty expands only the discovery needed to resolve it.

## Decision Order

Use this order:

1. Select one primary route and operation from `references/routes-index.md`.
2. State the requested result and non-goals. Preserve every explicit excluded target until the user explicitly rescinds it; later broad language such as “all changes” does not silently remove a named exclusion.
3. Inspect the smallest current-truth boundary needed to identify semantic owners and consumers.
4. Classify task depth as `D0`, `D1`, `D2`, or `D3`.
5. Activate only evidence-backed risk lanes from `references/risk-control-gates.md`.
6. Choose test evidence from `references/testing-strategy.md` or route evidence for non-implementation work.
7. Classify the next action and authorization with `references/effect-recovery-gates.md`.
8. Decide Studio only after the topology is known: when the depth is `D2` or `D3` and the result contains at least two independent deliverables, probe host capability and return `recommend_studio`, `do_not_recommend`, or `resolve_boundaries_first` with the reason proactively, as owned by `references/studio-execution.md`. Do not wait for the user to name `工作室模式`, and do not hand independent implementation scopes to subagents as a substitute.

Route, depth, risk, evidence, effect, authorization, and operational mode must not be collapsed into one score.

## D0-D3 Task Depth

Task depth measures new semantic judgment and owner coordination in the requested result. It does not measure file count, code size, risk, urgency, user technical level, or the presence of words such as API, database, security, SDK, admin, production, or architecture.

| Depth | Use when | Maximum default governance |
| --- | --- | --- |
| `D0` | Direct read-back, transcription, deterministic rendering or mechanical execution of an already bounded contract; no new semantic decision. An exact local code or configuration edit can be `D0` when both the target and transformation are already fixed. | exact target, direct operation, proportional read-back or existing check |
| `D1` | One semantic owner, one bounded result, established contract, no new shared judgment | relevant owner and nearby consumers, inline result/non-goals, one evidence decision, targeted verification |
| `D2` | Several semantic owners must agree on one result, or one new shared contract/flow must be designed inside the existing foundation | compact owner map, acceptance/non-goals, contract direction, affected evidence map, smallest durable truth only when drift would otherwise occur |
| `D3` | Foundation or ownership topology changes, a new program dependency order must itself be designed or changed, or a new architecture/stack/schema/auth/deployment model is being decided | explicit foundation decision, durable truth, staged execution, integration acceptance and stop conditions |

Choose the lowest depth that can honestly deliver the result.

### Depth invariants

- File count does not set depth. A deterministic bulk rewrite can remain `D1`; a two-file change can be `D2`.
- Risk does not raise depth. A one-line production permission change can remain `D1` while requiring strict risk, test, authorization, and recovery controls.
- `D0` is the strict mechanical subset of one-owner work. “Change this exact value from A to B” can be `D0`; locating or choosing a behavioral fix inside one established owner is normally `D1`.
- A final integration or acceptance gate does not by itself mean `ordered_dependencies: true` and does not raise a stable multi-owner result from `D2` to `D3`. Set `ordered_dependencies: true` only when the dependency order is itself part of the new program topology or safe execution/recovery contract.
- Urgency does not raise or lower depth.
- A broad audit is not justified by `D0` or `D1` unless the requested result or an evidence-backed owner conflict requires it.
- `D2` does not automatically require Studio or a stage document.
- `D3` does not authorize implementation, external writes, Git history changes, or release.

## Owner Topology

Record only the fields needed for the current decision:

```text
semantic_owners
owner_count
joint_contract_required
shared_writable_surface
mechanical_execution
new_foundation_judgment
contracts_stable
ordered_dependencies
studio_capability_available
environment_isolation_credible
independent_acceptance
integration_gate_defined
coordination_benefit_positive
```

Count semantic owners, not files, folders, frameworks, roles, or tools. A frontend component and its colocated test normally share one owner. Frontend and backend can be separate owners only when each has a stable contract and independently accepted result.

`contracts_stable` describes the semantic/product contract, not whether the
proposed writers are safely isolated. Record writer overlap separately in
`shared_writable_surface`. Resolved `D0` and `D1` decisions require an already
bounded or established semantic contract.

`studio_capability_available` records the result of an actual host probe (the
tools needed to create, wait on, message, and archive user-visible tasks). Fill
it `false` only after probing shows a required capability is absent; an
unprobed host is a missing field, not `false`, and cannot yield
`do_not_recommend` for a multi-deliverable `D2`/`D3` result.

`mechanical_execution` is true only when the exact target and transformation
are already fixed and no new behavioral choice is needed. `D0` requires it;
`D1`-`D3` forbid it. Several owners do not justify `D2` unless
`joint_contract_required` is also true. `ordered_dependencies` justifies `D3`
only for a multi-owner joint program topology; an ordinary sequence or final
integration check is insufficient.

## Bounded Discovery

Discovery exists to resolve a decision, not to perform a free project audit.

Start with:

- the exact target;
- its semantic owner;
- the nearest caller or consumer needed to understand behavior;
- the active truth document that directly governs it;
- the narrow validation path;
- current Git state for overlapping user work.

Expand one boundary at a time only when evidence shows:

- the owner is ambiguous or duplicated;
- the requested result crosses a consumer contract;
- current truth conflicts with code or runtime evidence;
- a protected risk boundary may be touched;
- the next action's effect or recovery cannot be determined.

Stop expanding when the route, depth, owner, evidence, effect, and authorization decision are resolvable. Do not read every doc, schema, test, deployment file, or agent file for an ordinary bounded task.

If the decision remains unresolved after bounded discovery:

| Outcome | Allowed work |
| --- | --- |
| `unresolved_safe` | Continue only the already authorized read/audit/direct-artifact or `local_reversible` work; do not create a foundation decision, stage truth, Studio topology, external effect, or completion claim |
| `unresolved_protected_stop` | Continue read/design/dry-run or redacted local verification; stop every action that could touch the protected boundary |
| `unresolved_product_stop` | Ask one plain-language question because different answers change visible scope, cost, downtime, policy, or irreversible effect |

## Conditional Detailed Contract

Load `references/task-decision-contract.md` only under the registry conditions. That file owns the machine Task Decision schema, closed enums, plan/stage materialization, and its anti-regression rules. Do not materialize stage truth for `D0`; ordinary bounded work stays inline.
## User Communication

Keep the decision internal for normal work. Tell the user only:

- the result or current finding;
- the owner or files changed when useful;
- fresh verification and honest unverified items;
- one product-visible decision when it actually blocks progress.

Explain depth and controls when the user asks, a dangerous action needs authorization, truth conflicts, Studio is proposed, or the task is blocked. Never ask a non-technical user to choose D, risk lanes, test level, architecture quality, or verification sufficiency.
