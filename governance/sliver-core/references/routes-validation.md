# Validation Routes

This file owns the primary `验收` route and the separate `用户验收陪跑` route. `验收` uses operation `stage` or `quality`; these operations are scopes inside one route, not competing user entries.

## Security negative-path evidence

This is the full `验收` list. The minimum set an implementation must actually run before claiming completion is owned by Runtime Boundary Verification in `testing-strategy.md`; `验收` checks that it ran and widens the coverage.

When the changed surface touches a security boundary, validate the relevant failure paths instead of reporting only the happy path:

- Invalid or missing input is rejected at the real owner boundary.
- Not-logged-in requests are blocked where login is required.
- Wrong-role and forbidden-function requests are blocked.
- A cross-user or cross-tenant identifier cannot read or modify another owner's data.
- Hidden, server-owned, price, role, owner, entitlement, or status fields cannot be changed through tampered fields or mass assignment.
- Injection-like input, unsafe HTML/template content, file metadata, URLs, commands, or model output is handled by the project's mature safety mechanism.
- Duplicate callbacks and repeated state-changing requests are idempotent where required.
- Request frequency, upload/body size, pagination, expensive jobs, queries, and model/provider calls have resource-abuse bounds where risk exists.
- Database before/after evidence matches the business rule, while logs and errors do not expose secrets or sensitive data.

Use the smallest honest evidence that proves the boundary: automated test, request/response capture, reproducible script, browser/network trace, database before/after check, redacted log, or provider sandbox evidence. Mark unavailable proof `未验证`.

For a standalone `安全审计`, collect findings without editing implementation. Do not run side-effecting negative requests, database writes, jobs, provider calls, builds, or startups until their side effects are explained and the user explicitly approves them. For an approved feature or fix, validate only the affected negative paths; do not expand one finding into an unapproved rewrite.

## `验收`

Choose the smallest operation that proves the requested result:

- `stage`: compare a sub-stage or large stage to its active truth, scope, done standards, and required gates.
- `quality`: decide whether the result is reliable enough for real use, including user-visible behavior, negative paths, data/security effects, regression, and delivery readiness.

Ambiguous “验收一下” starts with the requested result and available truth. Do not make the user choose an internal operation label.

### Shared checks

- Active requirements, stage truth, architecture/API/schema/security truth, and confirmed non-goals.
- Actual changed files, extra work, missing work, owner boundaries, and current Git scope.
- Original `T0`-`T4` Test Gate Classification, affected-test map, and honest pre/post-change evidence, including whether Runtime Boundary Verification ran for every changed entry and whether the level was inflated beyond what the owner and risk lanes justified.
- Commands, tests, builds, browser/UI evidence, API evidence, database evidence, logs, provider evidence, or user acceptance as applicable.
- Security negative-path evidence for every affected authentication, permission, ownership, input, data, secret, provider, or public-exposure boundary.
- Bootstrap/adoption/stage guardrails when governance artifacts were created or changed.
- Remaining `未验证` planes and whether they block the requested result.

### Stage operation

Additionally check:

- Every done standard in the active stage or sub-stage truth.
- Work performed outside confirmed scope.
- The defined stop point and whether the next stage was entered without authorization.
- Whether truth docs need write-back and whether a Git checkpoint is ready.
- For work governed by durable stage truth, first collect and return validation evidence without changing that owner. Writing results back is a separate `local_edit` action bound to the exact stage path. Only an original request or later confirmation that authorizes that exact write permits `truth_writeback: complete` and the `closeout` gate from `project-flow.md`. Without write authorization, leave the owner unchanged with `truth_writeback: pending`, report the evidence, and do not claim the sub-stage is complete.
- After the evidence is returned, run the Post-Acceptance Drift Check owned by `truth-capture.md`: list where the delivered work differs from the brief, function list, technical selection, architecture, and current stage truth. This is read-only; when differences exist, present its Authorization Card (update the document or change the code) and do not treat the batch as consistent with truth until the user answers. It is not stage write-back and does not change the rule that a pure audit or validation request never authorizes one.

### Quality operation

Additionally check:

- Happy path end to end.
- Empty, loading, invalid, canceled, failure, retry, refresh, and degraded states when relevant.
- Not-logged-in, wrong-role, own-data, cross-user, and admin paths when relevant.
- Database before/after effects, status transitions, money/inventory/quota, transaction, idempotency, and rollback risk when relevant.
- Visible UI state, responsive behavior, and screenshots for user-facing work.
- API request/response, status, and error-shape evidence for contract work.
- Official/provider contract, sandbox/callback, failure, quota, and redacted-log evidence for third parties.
- Existing core-flow regression and release implications.

### Design Fidelity Check

For implementation governed by `ui-design-lifecycle.md`, verify more than visual similarity. Check the implementation source is the recorded approved version; text and controls use real semantics; current components, tokens, icons, layout owners, and framework conventions were reused; asset boundaries and transparency are correct; every supported theme and affected viewport works; and applicable loading, empty, error, disabled, hover, focus, retry, and refresh states are present.

Reject a whole-image page, screenshot slicing, transparent hotspots, baked-in text or controls, white-box icon crops, a parallel component system, or light-only constants in a themed project. Pixel or screenshot comparison proves only part of the visual plane; it cannot prove real semantics, reuse, interaction, accessibility, data truth, or asset boundaries.

### Visual Drift Check

For user-visible work governed by Delivery Shape Lock v3, validate its `acceptance` phase against the Host-bound pre-lock digest and current source revision, not merely against the changed code. Check the primary user and single job, interaction model, system-concept projection, complete journey boundaries, introduced-element visibility, source-schema projection, source/reference role, target surface, unchanged regions, information hierarchy, navigation model, interaction states, responsive semantics, visual direction, and stop point as applicable.

A pass requires both sides: the requested visible change is present, and locked semantics and non-target surfaces did not drift. Require a reference and candidate evidence pair at the same viewport, state, and theme whenever comparison is applicable; require a DOM or accessibility snapshot, applicable interaction trace, changed-region proof, unchanged-region evidence, and independent review. One screenshot, build success, or screenshot similarity alone is insufficient. For a non-mechanical UI change in an existing project, verify the concrete stable reference surface selected from the same-role UI, or the recorded constraint-owned visual target; generic style or token claims are not evidence. Verify that the new consumer adapted to stable upstream defaults, or that every affected existing consumer in an authorized shared-baseline evolution has paired regression evidence and a rollback boundary.

Also verify that meaning-changing visible copy has product authority, routine copy stays inside confirmed behavior and current terminology, state coverage was not converted into permanent implementation commentary, and the same fact is not repeated across multiple primary channels. Responsive behavior is not automatic permission to redesign. If the reference role, baseline, applicable copy authority, or dependency direction was never resolved, or the implementation exceeds the lock, report failure or `未验证`; do not reinterpret the original request during acceptance.

### Verdict

Lead with the outcome, then split evidence by the planes that matter:

- `结构门禁`: project truth and guardrail scripts.
- `代码门禁`: lint, type, unit, integration, build, or framework checks.
- `合同链路`: API, protocol, schema, and provider evidence.
- `UI/用户侧`: screenshot, click path, visible behavior, and acceptance questions.
- `数据/安全`: database effects, permissions, secrets, and negative cases.
- `发布级`: deployment route, rollback, monitoring, cost, and production settings.

Report passed, failed, and unverified items; evidence paths and current command results; blocking fixes; safe deferrals; truth write-back; and checkpoint readiness. Do not fabricate historical TDD evidence. If a `T2` change lacks observed RED, add the strongest honest protection now and report the process gap.

Guardrail language must stay precise: `项目结构门禁通过` proves only required truth files, headings, links, placeholders, and obvious drift markers. It does not prove code, UI, API, database, security, provider, deployment, or user acceptance.

Validation is invalid if it only says “tests passed,” lacks user-visible proof for user-visible work, ignores affected data/security boundaries, or claims release readiness from local checks alone.

## `用户验收陪跑`

Use this when the user wants to personally confirm behavior, needs plain product checks and click guidance, or cannot translate technical evidence into product acceptance.

Procedure:

1. Restate the result as a user story in plain Chinese.
2. Give the shortest click path or request path, one step at a time.
3. State the expected visible result for each step.
4. Include only relevant failure checks: empty input, wrong role, not logged in, canceled action, refresh, mobile size, provider failure, or slow network.
5. Tell the user exactly what screenshot, text, URL, or result to return.
6. Connect the user's checks to technical evidence already collected; do not outsource code, database, log, architecture, or test-quality judgment to them.

Output only what helps the user verify: what is being checked, steps, expected results, failure signs, already verified evidence, and open product-experience questions.

It is invalid to ask the user to read code, database rows, or logs as the primary method, or to provide only test commands when the user needs product behavior.
