# Development Routes

Use this file for normal project changes, internal stage planning, and sub-stage execution. The user does not need to name a process. Adding, changing, fixing, refactoring, connecting, configuring, or continuing project behavior all enter the same `开发执行` route.

## Contents

- `开发执行`
- `阶段计划`
- `执行子阶段`

## `开发执行`

Goal: take a requested project change from natural-language intent through professional judgment, implementation, validation, and truth write-back at the depth its owner topology requires, with separate controls for risk and action effects.

Use this whenever the user wants the project to become different: a new capability, changed behavior, bug fix, UI adjustment, role or visibility rule, upload, notification, payment rule, provider integration, refactor, configuration change, or confirmed continuation.

Procedure:

1. Select operation `implement` unless current evidence requires `阶段计划`, `执行子阶段`, `工作室模式`, or `防漂移`, then read the smallest sufficient current truth: the source owner, nearest affected consumers, directly active truth, targeted tests/runtime evidence, and Git state. When operation is `防漂移`, load the canonical trigger and procedure from `project-flow.md`; this route only decides when to enter it.
2. Reconstruct the desired product result in plain language: who acts, what they do, what they see, important rules, and what should stay unchanged.
3. If several materially different outcomes remain possible, apply the Intent Confirmation Gate. Offer 2-3 plain-language options based on project evidence, recommend one, and wait only for the product choice that changes the result. Treat ambiguity as blocking only when reasonable readings change the user-visible result; do not ask the user to resolve implementation details with the same outcome.
4. Classify `D0-D3` execution depth with `task-risk-gates.md`. This is an internal topology decision; do not ask the user to choose a depth.
5. Locate the current owner layer and contract. Name who creates, calls, stores, enforces, and consumes the changed concept, plus which layers must not own it.
6. Professionally complete the design appropriate to the task: user flow, states, roles, data rules, failure behavior, edge cases, owner placement, acceptance, and non-goals. Do not merely repeat the user's sentence or ask the user to design the system.
7. Activate only evidence-backed protected lanes from `risk-control-gates.md`; risk adds the lane's minimum controls and does not raise D. Classify the next action, minimum authorization, and recovery with `effect-recovery-gates.md`.
8. Load zero or more conditional development lenses from the single registry owner, `routes-index.md`, based on impact evidence. When `security-impact` applies, run the Security Impact Checklist from `security.md`. Do not promote a lens into a competing primary route.
9. For user-visible work, consume the UX Judgment Contract and delivery-shape contract `sliver-delivery-shape-lock/v3` from `engineering-execution.md` whenever the task introduces or materially changes a visible field, action, status, navigation item, content block, data view, or permanent copy. Bind the user task, familiar interaction pattern, user-recognized objects/actions/results, system-concept projection, complete journey boundaries, source-schema projection when applicable, concrete same-role reference or constraint-owned visual target, allowed and unchanged regions, responsive semantics, and acceptance obligations before owner edits, even when no prototype is generated. A request for a new page that skips prototype generation does not bypass Delivery Shape Lock v3. Generic project-style claims and candidate-authored reference strings are not evidence. Apply the separate authority check only to meaning-changing visible copy; routine labels, help, and recovery text remain an implementation judgment inside confirmed behavior and current terminology.
10. For UI prototype generation or design-to-code work, select `prototype` or `implement` from `ui-design-lifecycle.md`. Pass its Project UI Context Gate and Prototype Truth Gate; before code, also pass its Design Decomposition Gate. When no comparable surface or stable visual owners exist, form a reviewable visual target before code. A bounded local color, spacing, clipping, or state correction with no new design artifact remains lightweight: use the touched owner and current rendered surface as an inline baseline, do not turn it into a whole-page redesign, and do not create a prototype, durable baseline, or governance worksheet.
11. Decide the execution shape: direct scoped implementation, compact plan inside the current task, current-stage truth update, separate complex-feature truth, a user-confirmed `工作室模式` graph, or foundation decision before code. Load `studio-execution.md` whenever the depth is `D2`/`D3` and the result contains at least two independent deliverables, or the user asks for multi-task orchestration; return its Studio decision with a reason before choosing serial execution or subagents. No room may be created before its recommendation, capability, owner, environment, acceptance, and user-confirmation gates pass.
12. Ask the user only about product-visible outcomes, scope, cost, irreversible data effects, or major trade-offs. Owner placement, risk classification, validation method, and technical design are AI responsibilities.
13. Apply the mandatory Test Gate Classification from `testing-strategy.md`, map the affected tests, and execute its `T0`-`T4` rule. Classification is mandatory; only the result decides whether new test code is required, and an ordinary `D1` without a protected lane follows the project's existing test posture instead of strict TDD.
14. Implement in the owner layer first, keep adapters thin, and stay inside the confirmed scope.
15. Run fresh targeted validation, including Design Fidelity Check and Visual Drift Check when applicable, and Runtime Boundary Verification from `testing-strategy.md` whenever a route, handler, middleware, auth wiring, CLI/job entry, or page entry changed; inspect the diff, update active truth, and report verified and unverified surfaces separately.

Owner-layer decision must answer:

- Who creates this concept.
- Who calls it.
- Who consumes it.
- Which file, module, schema, service, state store, adapter, or truth document is the single owner.
- Which layers are forbidden owners.
- Which existing pattern proves the chosen owner.
- Which validation gate would catch the old or expected failure.

Task depth is defined only in `task-risk-gates.md`: `D0`, `D1`, `D2`, or `D3`. Do not create local aliases. `超出当前阶段` is a separate scope result: stop and recommend defer, split, or stage redesign.

If no current-stage implementation truth exists:

- `D0` and `D1` may proceed with an inline acceptance contract and fresh targeted validation.
- `D2` needs enough truth to prevent multi-owner drift, but materializes a stage only when ordered owners or acceptance would otherwise drift.
- `D3` must not change the affected foundation until its product outcome, owner topology, impact, rollback difficulty, and stop conditions are explicit.
- If the truth root is missing, occupied, or messy, run `整理开发资料` before creating new governance files. The only narrow exception is the standard `dev-docs/design/` subtree for an authorized UI prototype request when `project-intake.md` confirms no existing convention, occupied path, privacy/Git conflict, or external-delivery conflict.

Only inspect affected foundation lanes. A full foundation-impact table is required for `D3`, a proposed foundation change, or evidence-backed cross-lane uncertainty. Do not require it for clear `D0`/`D1`, or a `D2` whose affected owners are already bounded. When warranted, cover only the plausibly affected stack/framework, directory ownership, frontend route/state/component system, API contract, database/schema, auth/roles/permissions, payment/money/quota, third-party providers, deployment/env/secrets/jobs, and logging/monitoring/privacy/security.

Security impact must state:

- Which security boundaries are touched and where their owner lives.
- Which client-controlled values must be revalidated by the server.
- Which negative paths will prove authentication, authorization, data ownership, allowed fields, idempotency, and resource bounds when relevant.
- Which boundaries are not touched, so a local feature does not get inflated into a full `安全审计`.
- Whether the feature needs a separate security decision before implementation.

Output when a separate pre-implementation report is warranted:

- Requested product result.
- Execution depth and impact decision.
- Current owner evidence.
- Foundation-impact table.
- Recommended owner placement.
- Rejected placements and reasons.
- Proposed or existing implementation truth document path.
- Truth documents that must be updated.
- Required product decisions, if any.
- First executable sub-stage and validation method.

Development execution is invalid if it merely paraphrases the request, treats professional checks as competing commands, asks the non-technical user to choose technical architecture, claims low risk without evidence, writes across unclear owners, or claims completion without fresh validation.

## Internal Operation: `阶段计划`

Goal: write the implementation truth document for the current large stage only.

When this operation produces the active executable plan, use `plan-artifact.md` for write-through timing and one-owner rules. The stage truth itself satisfies that owner; do not create a second plan or keep the real execution state only in chat.

Procedure:

1. Read project brief, function list, stage plan, architecture truth, and relevant domain docs.
2. Prefer a same-class solution scan before designing the stage plan when the stage involves a common product or engineering pattern.
3. If any sub-stage depends on a provider or platform capability, load the `third-party-provider` lens and verify official contracts before finalizing implementation truth.
4. Apply the intent, owner, impact, execution-depth, and conditional-lens decisions from `开发执行` before finalizing the first or riskiest implementation target.
5. Split the current large stage into sub-stages.
6. For each sub-stage, write what to do, done standard, validation method, files/modules likely involved, and what not to touch.
7. Present the product-visible scope, non-goals, first usable result, and any major trade-off that needs a user decision. Record AI-owned technical choices and proceed only after the necessary product confirmation.
8. Do not implement yet.

The stage-truth schema, statuses, and readiness conditions are owned only by `project-flow.md`. Materialize the smallest project-specific document that satisfies that contract; do not copy a second field list here.

Same-class solution evidence must include source name/link or local path, why comparable, useful pattern, what not to copy, license or reuse risk, business-fit differences, and how the current project should do better.

Do not copy source code, UI, content, brand, data, or product positioning from references. Use references to avoid blind design and raise the user's business outcome. If live GitHub/web search is unavailable, say so and mark the scan `未验证`, or ask the user for reference projects.

Implementation truth is invalid when the `plan` gate in `project-flow.md` fails or when it lets the agent continue automatically into the next sub-stage.

When the implementation truth file is created or substantially changed, run:

```bash
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode stage --stage-gate plan --stage-file dev-docs/stages/<stage-name>.md
```

`scripts/check_project_guardrails.py` is a structural and recorded-state check for the stage truth surface, not proof that the implementation, UI, API, database, security, or release behavior works. If the repo uses another truth path, pass that path with `--stage-file`.

## Internal Operation: `执行子阶段`

Goal: implement one sub-stage, then stop.

Rules:

- Read agent constitution and current stage implementation truth.
- Read `references/engineering-execution.md` and apply the shared engineering execution backbone.
- For `D0`/`D1`, use `task-risk-gates.md` instead of forcing a stage truth document.
- If `D2`/`D3` product code meets the materialization conditions but lacks sufficient implementation truth, remain inside `开发执行`, create or update `阶段计划`, and do not change the affected owner until the product result is confirmed.
- If the required product-visible scope or major trade-off is not confirmed, stop and ask in plain language; do not ask the user to approve technical details they cannot evaluate.
- A named sub-stage is required. Do not treat vague continuation language as permission to code.
- Before changing an owner, keep `result_status: not_started|in_progress` and `truth_writeback: pending`, pass the `execute` gate owned by `project-flow.md`, and bind `authorization_substage` to the exact current `active_substage`. Switching sub-stages requires fresh bounded scope authorization and a new execute check. An original request may count as `scope_authorization: original_request_authorized: <evidence>` only when it already makes the product-visible scope, non-goals, first usable result, material trade-offs, and bounded implementation permission explicit; a generic feature request does not avoid either gate.
- A `controlled` action also needs the authorization and recovery evidence owned by `effect-recovery-gates.md`; product confirmation alone does not authorize production data, credentials, release, migration, or another irreversible action.
- Only implement the named sub-stage.
- Apply the Security Impact Checklist before owner-code changes. Add the relevant negative-path gate when a security boundary is touched; otherwise record that no security boundary changed and keep validation narrow.
- Do not move to the next sub-stage automatically.
- Do not change foundation documents, schema, stack, permissions, or directory architecture unless the sub-stage explicitly says so.
- If the requested work conflicts with truth docs, stop and run `防漂移`.
- After validation, first return the collected evidence without changing stage truth. Stage write-back is a separate Task Decision whose current action is `local_edit`, whose exact target is the active stage path, and whose authorization is satisfied by the original request only when that request explicitly entered the named active sub-stage and did not exclude documentation writes; otherwise obtain confirmation. Only then write `result_status`, `evidence_refs`, and `Implementation Write-Back`, set `truth_writeback: complete`, and pass the `closeout` gate. A pure audit or validation request never authorizes this write-back. A structural closeout never proves the referenced evidence and never authorizes the next sub-stage.
- With the evidence returned, run the Post-Acceptance Drift Check owned by `truth-capture.md`: compare what the sub-stage actually did against the brief, function list, technical selection, architecture, and current stage truth. When differences exist, present its Authorization Card (update the document or change the code) and record `truth_capture.decision: deferred` on the next sub-stage's Task Decision until the user answers; the next sub-stage does not start as if no drift existed. When nothing differs, record `not_needed` without a card. The check is read-only and is not the stage write-back above.

Execution order:

```text
current truth
  -> owner and contract
  -> security impact
  -> test decision and affected-test gate
  -> owner-layer implementation
  -> thin adapter/UI/CLI/API wiring
  -> targeted validation
  -> doc write-back
  -> git boundary check
```

Rules:

- Shared by two or more UI/API/CLI/provider/runtime paths means shared owner first, not duplicated adapter logic.
- UI, route handlers, controller, prompt text, local mock files, and temporary scripts must not own core business semantics.
- If the next sentence would be "we can extract it later", stop and put the concept in the right owner now.
- If the correct owner is unclear, stop and ask or do a read-only owner audit.
- Record the `T0`-`T4` decision and add or reuse the smallest gate that would catch the failure: unit test, contract test, fixture, API example, browser check, migration check, or manual user acceptance path. When `T2` applies, strict RED -> GREEN is mandatory; for an ordinary `D1` with no protected lane, follow the project's existing test posture. A changed entry must also pass Runtime Boundary Verification before the sub-stage reports completion.
- Do not add retries, sleeps, fallback branches, compatibility shims, or string contains checks unless evidence proves that mechanism is the real owner-layer fix.

Completion report:

- What was implemented.
- Files changed.
- What was intentionally not done.
- Validation run.
- Unverified items.
- Next sub-stage from the truth document.
