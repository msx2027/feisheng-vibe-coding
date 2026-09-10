# Effect, Authorization, And Recovery Gates

This file is the single runtime owner of action effect class, minimum authorization tier, controlled-action recovery, and operational mode. These controls do not change task depth.

## Effect Class

Classify the next concrete action:

| Effect class | Meaning |
| --- | --- |
| `none` | read, audit, design, planning, dry-run or stateless verification |
| `local_reversible` | exact-path local edit/build/test or isolated state created by the current run, with no shared/external/production/paid/privileged effect and a known diff, stop, unstage or cleanup route |
| `controlled` | persistent, shared, external, paid, privileged, production, real-device, delete, overwrite, or recovery-uncertain effect |

Statefulness alone does not make an action `controlled`. Cleanup of an exact, current-run-created isolated namespace may remain `local_reversible`; deletion or overwrite of pre-existing user or authoritative state is `controlled`.

Starting the project's local dev server or local process with its established command, creating a local test database or fixture data for this run, and issuing requests against that local runtime for Runtime Boundary Verification (owned by `testing-strategy.md`) are `local_reversible` and map to the existing `test`/`build` actions; they need no separate authorization beyond the local-edit authorization already granted. Requests against production, shared, paid, or external state remain `controlled`.

## Minimum Authorization

The task cannot choose a lower tier. Task Decision uses the stable action ID in parentheses; derive the minimum from the action, and if several actions match, use the highest.

| Operation and stable action ID | Minimum tier |
| --- | --- |
| read (`read`), audit (`audit`), design (`design`), chat-only plan (`plan`), stateless verification (`stateless_verify`) | `read_only` |
| exact-path local edit (`local_edit`), durable plan artifact write (`plan_artifact`), new feature/decision truth document (`truth_doc_write`), audit report write (`audit_artifact`), build (`build`), test (`test`), isolated current-run cleanup (`isolated_cleanup`) | `local_reversible` |
| stage (`stage`) or commit (`commit`) exact Git changes | `git_history` |
| push (`push`), ordinary third-party write (`third_party_write`), send message (`send_message`), create external resource (`create_external_resource`) | `external_write` |
| publish (`publish`), deploy (`deploy`), production change (`production_change`), migration (`migration`), persistent/shared sample write (`persistent_sample_write`), real cost (`real_cost`), credential use/rotation (`credential`), real-device control (`real_device_control`), delete (`delete_existing_state`) or overwrite (`overwrite_existing_state`) pre-existing user/authoritative state | `critical_operation` |

Authorization covers only the exact target and effect the user approved. A lower tier never implies a higher one. Reconfirm when target, environment, blast radius, cost, downtime, permissions, data loss, public exposure, or external side effect expands.

When the user asks for an executable, resumable, reviewable, or handoff-ready
plan, that request authorizes exactly one local-reversible `plan_artifact` at
the explicit path, established internal-truth path, or task-specific temporary
path selected by `references/plan-artifact.md`. It does not authorize changes
to product/source owners, staging, commit, push, release, or any controlled
effect. A request for advice or a chat-only outline remains action `plan`.

Truth writes proposed by `references/truth-capture.md` (`truth_doc_write` for
a new feature or decision document, `local_edit` for an existing owner) are
`local_reversible` but never self-authorized: the only valid
`authorization_evidence` is the user's confirmation of the Authorization Card
for that exact target; a long discussion or the agent's judgment that "this
should be documented" authorizes neither. An audit report write
(`audit_artifact`) is authorized by the module-level audit request itself and
authorizes nothing else; every other audit action stays `audit`. Only `audit_index_target` (sibling `README.md`) may accompany the report write.
Promotion needs separate authorization; otherwise keep `reviewed_pending_promotion` / `open`.

## Compact Action Gate

Retain:

```text
operation
exact_target
effect_class = none | local_reversible | controlled
required_tier
granted_tier = read_only | local_reversible | git_history | external_write | critical_operation | null
authorization_evidence = <current user request or later explicit confirmation> | null
recovery_known
health_and_stop_required
authorization_status = satisfied | insufficient | blocked_unknown
```

Unknown effect class, exact target, or minimum tier blocks that action. It does not block unrelated safe discovery.
`authorization_status: satisfied` is invalid unless `granted_tier` meets the
derived minimum and `authorization_evidence` identifies the current user
request or a later explicit confirmation for that exact target. A model's own
statement, a plan, a prior stage, a generic workflow instruction, or product
confirmation is not authorization evidence. For `insufficient` or
`blocked_unknown`, `granted_tier` and `authorization_evidence` may be `null`;
the action remains stopped.

Before a `controlled` action, establish:

```text
exact_target_and_environment
maximum_blast_radius
artifact_or_change_identity
code_reversal
state_or_data_recovery
health_signal
stop_condition
remaining_risk
```

Every applicable field must be concrete. Code rollback does not restore data or revoke an already sent message. When an effect cannot be reversed, state the correction route and remaining impact before asking for authorization.

## Operational Mode

`operational_mode` is exactly:

- `planned`: normal default.
- `urgent`: a real deadline or imminent harm changes ordering.
- `incident`: serious impact is already occurring or repeating.

Operational mode changes ordering only. It does not change `D0-D3`, activate Studio, increase authorization, widen discovery, or waive owner evidence, protected-boundary controls, recovery, health, and stop requirements.

An existing break-glass/runbook may replace a fresh confirmation only when it is current and records policy reference, authorized actor, exact target, allowed action, expiry, and audit record. Otherwise stop before the first `controlled` production action.

## Completion Boundary

An action being authorized does not prove it succeeded. A local test does not prove a provider write, deployment, production health, device state, public URL, or recovery path. Report code, contract, runtime, external effect, and release evidence separately and keep missing planes `unverified`.
