# Test Decision, Test Quality, And Runtime Boundary Verification

Use this file as the single owner for deciding whether a project change needs new test code, strict TDD, an existing executable gate, or another reproducible proof path, and as the single owner of Runtime Boundary Verification for changes that touch a real request or command entry. It is a mandatory internal gate for implementation work, not a user-facing route.

The operating rule is:

> Test classification is always mandatory. New test code is conditional and ordinary work follows the project's existing test posture. Once strict TDD applies, RED -> GREEN -> REFACTOR is mandatory; it applies only to protected boundaries, new shared contracts, and declared project policy. Fresh verification is always mandatory, and a changed request or command entry must be exercised through its real entry before completion.

Do not classify by user technical level or by whether the user asked for tests. Size and framework presence affect infrastructure cost, not test level (see Decision Boundaries).

## Test Gate Classification

Before changing production code, runtime configuration, schema, generated contracts, or other owner behavior, record:

- `level`: exactly one of `T0`, `T1`, `T2`, `T3`, or `T4`.
- `behavior_or_risk`: the observable behavior, contract, data effect, security boundary, or runtime property that may change.
- `affected_test_map`: for `T0` and a direct `T1`, one line naming the direct gate or `不适用`; expand nearby tests, fixtures, scripts, callers, consumers, and API/browser/database paths for `T2`, `D2`/`D3`, active protected-risk lanes, or cross-owner changes.
- `pre_change_evidence`: the failing test/check or reproducible baseline available before implementation.
- `post_change_gate`: the narrow gate first, then the related regression surface.
- `why_this_gate`: why this is the smallest valuable proof.

No Test Gate Classification, no owner-code change. For `D0`, `T0`, and a direct `T1` the whole record may be one internal line (`level` plus the gate used).

| Level | Use when | Required execution |
| --- | --- | --- |
| `T0` Non-behavior verification | A docs, comment, copy, formatting, static-asset, or pure appearance change; or a UI addition/change whose only new behavior is presentation and ordinary navigation, with no business rule, validation logic, permission-gated rendering, data write, contract, or security boundary | Do not create new automated test code. Use targeted read-back, diff inspection, render/build, browser, screenshot, link, or asset verification; record the baseline and verify the resulting appearance and interaction in the browser when visual output changes. |
| `T1` Existing or characterization gate | An existing test, compiler, type checker, linter, build, contract check, or reproducible command already covers the target failure; a pure refactor must preserve behavior; a feature or surface is removed; or an ordinary `D1` behavior change lands in an owner with no protected boundary | Reuse the existing gate. For a bug, an existing causally related gate must fail then pass; without one, capture a real-entry reproduction and replay it after the fix. For a refactor, establish a passing baseline and, if important behavior is unprotected, add a passing characterization test. For an ordinary behavior change, follow the project's existing test posture. Do not create a redundant test for ceremony. |
| `T2` Strict TDD | A protected lane from `risk-control-gates.md` is active and automatable at its real owner (`identity_permission`, `money_entitlement`, `persistent_data_schema`, `public_contract_compatibility`); `D2`/`D3` designs a new shared contract; or active project truth declares strict TDD for this area | Write the smallest behavior-focused test first, observe the expected RED, make the minimum owner-layer change, observe GREEN, then run the related regression surface and refactor only while green. |
| `T3` Reproducible alternate gate | A reported visual defect, cross-browser/live rendering regression, hardware behavior, provider sandbox, external system, timing, or environment boundary cannot be represented reliably by maintainable automated test code at the current owner; or a protected boundary cannot honestly be tested at the owner and needs a live negative-path capture | Capture a repeatable failing path before the change and rerun the same path after it. Record expected versus actual results and why `T2` is not currently credible. “Hard to test” or “takes longer” is not sufficient for a protected boundary. |
| `T4` Isolated exploration | The contract or feasibility is unknown and the work is an explicitly disposable, time-boxed spike | Keep it isolated. It cannot be called complete, merged as production behavior, released, or used as the regression gate. Retained runtime or owner behavior must be reclassified to `T1`-`T3`; only retained docs or static non-behavior artifacts may use `T0`. |

If classification is uncertain and no protected lane is active, default to `T1`, state which behavior remains without automated protection, and rely on Runtime Boundary Verification plus fresh targeted checks. Escalate to `T2` only when a protected lane, new shared contract, or declared strict project policy applies. If it is unclear whether behavior changes at all, inspect the owner before coding; do not guess.

## Decision Boundaries

- **Ordinary `D1` follows the project's existing test posture.** If the touched owner already has a test file or suite, extend it with the smallest case for the new behavior and run it green after the change; RED is welcome but not required outside `T2`. If the owner has no tests, do not create a test file or introduce a framework for an ordinary change; prove it through existing gates plus Runtime Boundary Verification and record the unprotected behavior.
- **Removing an ordinary feature or surface is `T1`.** Delete obsolete tests, fixtures, references, and dead consumers; make build, type check, and remaining tests pass; confirm by read-back or a real run that the surface is gone. Do not add absence assertions for ceremony. Protected removals still require `T2`/`T3` negative proof, including entry rejection where applicable.
- **UI additions and changes are `T0` unless they carry a business rule.** Browser-side validation, business state transitions, and permission-gated rendering follow the ordinary-`D1` posture; a protected lane still forces `T2`/`T3`.
- Test-framework presence lowers the cost of `T2`; it does not make every change `T2`. Ordinary changes never justify installing a framework; only protected risk, a new shared contract, or declared strict policy justifies the smallest maintainable executable harness, and only when its continuing value exceeds its cost. Prefer the project's existing runner.
- A compiler, type checker, linter, build, or existing test may be the real RED when it directly and repeatedly detects the requested failure. Do not duplicate it with a fake unit test. `T1` takes precedence when an exact existing gate already catches the bug.
- A passing suite is not pre-change failure evidence for a new bug. Without a causally related failing gate, reproduce the bug through the real entry, fix it, rerun the reproduction, and add a regression test when the owner already has a suite; use `T2` when a protected lane, new shared contract, or declared strict project policy applies.
- A pure refactor stays `T1` and may add a passing characterization test when important current behavior is unprotected; characterization is a baseline, not a fabricated RED.
- A reported visual defect or environment-dependent visual failure uses `T3` unless a credible automated visual gate already exists.
- Authentication, authorization, cross-user ownership, money, quota, destructive data writes, migrations, and public API contracts cannot use `T0`. Use `T2` whenever a deterministic owner-bound test is feasible; otherwise require `T3` negative-path evidence and mark the missing automation risk.

For a protected boundary, the following are never valid exemptions: “the change is tiny”, “the user did not ask”, “we are in a hurry”, “there is no test framework”, “the test is inconvenient”, or “the code looks obvious”. For an ordinary change with no protected lane, change size and a missing framework are legitimate reasons not to add test code, never reasons to drop classification, existing gates, or Runtime Boundary Verification.

## Affected-Test Mapping

Inspect the local testing context instead of applying a generic recipe. Keep this to one direct-gate line for `T0` and straightforward `T1`; expand only for `T2`, `D2`/`D3`, an active protected-risk lane, or cross-owner impact:

1. Read the changed owner, its callers and consumers, nearby tests, test configuration, fixtures, package scripts, and current failure output.
2. Search for tests that import, call, exercise, or assert the touched owner or public contract.
3. Identify the narrowest affected tests first and the broader regression surface second. A full suite is not a substitute for knowing which test proves the requested behavior.
4. Reuse the project's established runner, file placement, fixture style, import pattern, database isolation, browser tooling, and generated-contract workflow.
5. If the repo already has coverage or test-impact tooling, use it. Do not add a graph database, coverage service, or new test framework for an ordinary change merely to automate impact analysis.

For large or high-risk changes, record the source -> owner -> caller/consumer -> affected test relationship explicitly.

## Runtime Boundary Verification

Independent of the `T0`-`T4` level and mandatory at every depth. Owner tests prove logic; they do not prove the entry is wired. Route registration, middleware order, auth attachment, request parsing, CORS, serialization, environment configuration, and database connectivity fail exactly where owner tests never look.

Trigger: the change adds, removes, or modifies an HTTP route or handler, middleware, authentication or authorization wiring, a CLI or job entry, a page or navigation entry, or configuration that changes how any of these are reached.

Before any completion claim:

1. Start the project's local runtime with its established command. This is `local_reversible` under `effect-recovery-gates.md` and needs no separate authorization.
2. Exercise the changed entry through its real path, not the owner function: one representative request, command, or page load, with status code and redacted response or rendered state recorded.
3. For each Security Impact Checklist item in `security.md` that the change touches, issue the matching negative request through the same entry and record status and redacted body: no or expired credential where login is required; a valid credential of another user, tenant, or role against a resource it must not touch; a tampered server-owned field (price, role, owner, status, entitlement, hidden id) or mass-assignment payload; malformed, oversized, or injection-shaped input. Skip only items whose boundary the change provably does not touch, and say which.
4. Confirm the negative responses come from the project's real enforcement point, and that neither responses nor logs echo secrets or sensitive data.

If the entry cannot be started or reached, record the exact blocker, mark the plane `未验证`, and report “入口已改，未实测”, never complete, working, safe, or ready. A green unit or contract suite does not upgrade this status.

Boundaries: a standalone `安全审计` keeps the read-only boundary owned by `security.md`; requests that would touch production, shared, paid, or external state stay `controlled` under `effect-recovery-gates.md`; the full `验收` negative-path list is owned by `routes-validation.md`, this section owns only the minimum set an implementation must run.

## Conditional Execution And Release Gates

Load `references/testing-execution-gates.md` for `T2`-`T4`, `D2`/`D3`, protected-boundary, external fresh-session, or release-scope work. It owns strict TDD execution, test quality, isolated live-evidence production, release regression selection, and completion evidence.
