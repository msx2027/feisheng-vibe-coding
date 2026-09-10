# Execution Liveness

Load this owner only before an operation that may yield a running receipt, while an observable pending operation exists, or when context degradation/handoff must close such operations. A pending operation is any Host-observable asynchronous tool action with a stable identity and a matching refresh or cancel mechanism; a shell session handle is one subtype, not the portable model.

This contract prevents agent-side orchestration mistakes only while the model loop is still running. It cannot wake a stopped model loop, repair a lost tool-result continuation, provide a Host watchdog, or prove scheduler/service recovery. Operations without observable identity or continuation support remain Host/service evidence gaps.

## Pending Operation Transition Table

| Current state | Observed event | Required state or decision | Evidence quality |
| --- | --- | --- | --- |
| no_pending | operation_returns_running | pending | identity_recorded |
| pending | matching_refresh_returns_running | pending | terminal_unknown |
| pending | matching_refresh_returns_terminal | terminal | terminal_proof_recorded |
| pending | cancel_confirmed | canceled | cancel_proof_recorded |
| pending | final_or_handoff_requested | terminal_decision_required | pending_count=0_or_terminal_decision |
| terminal | optional_metadata_missing | terminal | metadata_incomplete_degraded |
| pending | operation_identity_unrecoverable | blocked_unrecoverable | unknown_terminal_state |

Lifecycle state and evidence quality are separate. A known terminal result with missing optional Host counters is deliverable as `metadata_incomplete_degraded`; it must not be converted to `blocked_unrecoverable`. Reserve `blocked_unrecoverable` for loss of the operation identity or continuation mechanism when terminal state cannot be established or canceled.

## Running Refresh Schedule

| Trigger | Next tool boundary | Allowed action | Constraint |
| --- | --- | --- | --- |
| first_running_receipt | next_tool_action | matching_refresh_or_cancel | no_unrelated_batch |
| matching_refresh_still_running | before_next_refresh | at_most_one_non_conflicting_read_only_batch | must_not_change_operation_preconditions |
| bounded_batch_completed | next_tool_action | matching_refresh_or_cancel | no_second_batch |

Prefer a Host-supported longer yield, terminal notification, or bounded blocking refresh over rapid busy polling. After the first matching refresh remains running, the one allowed local batch must be bounded, read-only, independent of the pending result, unable to alter files/processes/configuration/inputs used by the operation, and unable to trigger another pending operation. Then refresh immediately. Physical poll counts and elapsed thresholds are target-specific telemetry, not portable correctness.

## Portable Receipt Schema

| Field | Presence | Portable meaning |
| --- | --- | --- |
| operation_identity | required | stable_identity_for_matching_refresh_or_cancel |
| operation_kind | required | pending_operation_subtype |
| lifecycle | required | running_terminal_canceled_or_error |
| terminal_proof | required_when_not_running | terminal_canceled_or_error_proof |
| unknown_flags | required | unknown_evidence_is_explicit |
| truncation_flag | required | truncated_evidence_is_explicit |
| metadata_status | required | complete_or_metadata_incomplete |
| host_optional_fields | optional | exit_chunk_count_token_count_digest_or_wall_time |

The receipt records normalized lifecycle facts, not raw output. The exact command result or artifact may remain in the Host tool receipt; do not duplicate full stdout, tool responses, transcripts, credentials, or secrets into a Hook, handoff, fixture, or continuity store. Host adapters may map optional fields only when actually supplied and must preserve unknown/truncation flags.

## Final, Cancel, And Handoff Gate

Before final or handoff, enumerate operations started in the current task and satisfy `pending_count=0_or_terminal_decision`. Each operation must have terminal/canceled/error proof, an honest degraded terminal receipt, or an explicit blocked decision naming why identity/continuation is unrecoverable and which Host evidence remains missing. Never call a still-running operation successful, silently abandon its handle, or claim a test/build result whose terminal receipt was not retrieved.

## User Stop Finalization

When the user asks to stop and receive the result while the model loop is active,
perform no new discovery and start no new pending operation. Close every
observable operation with `pending_count=0_or_terminal_decision`, then deliver a
bounded final using evidence already collected. If no operation is pending, the
next model response is the bounded final. This contract cannot wake a stopped
model loop or repair a Host/service continuation that was never delivered.

On context degradation, first refresh/cancel observable pending operations. Then write only normalized identities, lifecycle decisions, evidence quality, source/Git drift information, and the next exact action through to the active plan/handoff owner. A fresh successor reloads that owner and rechecks current state; it does not replay raw tool output or infer terminal state from elapsed time.

## Host Capability Boundary

Scripted or programmatic tool reduction is allowed only for bounded, read-only, deterministic projection or reduction with stable operation identity, explicit stop/retry bounds, and complete program/final receipts. It does not replace semantic route selection, owner decisions, authorization decisions, writes, or final judgment.

Model and reasoning choices can reduce latency only when matched evals preserve capability. A Skill may recommend a model/effort policy before a run; it cannot force-switch a model or reasoning level after the Host has started the task.
