# Test Execution And Release Gates

This file is the single owner of strict TDD execution, test-quality review, external fresh-session evidence production, release-scope regression selection, and detailed completion evidence. Load it only under the conditional predicate in `routes-index.md`. Test level definitions and classification remain owned by `testing-strategy.md`.

## Strict TDD Protocol For T2

1. State the observable behavior and enforcing owner boundary.
2. Write the smallest test that fails only when that behavior is missing or wrong.
3. Run it and confirm a real test fails for the expected behavioral reason, not syntax, fixture, import, environment, or mock setup. If it passes, prove the behavior exists or fix the path/assertion; no meaningful expected RED means no owner edit.
4. Make the minimum production change and minimum owner-layer change at the real owner; add no test-only API, flag, branch, or getter.
5. Run the same test and observe GREEN.
6. Run mapped neighboring tests and the relevant package/contract/integration suite, treat new failures as regression evidence, and refactor only while green.

If code predates classification, do not overwrite user work or claim historical TDD; this recovery is not permission for the current agent to implement first. Preserve the dirty tree. Use a pre-fix revision, reverse patch, or focused mutation only in a temporary copy, isolated worktree, test process, or reversible sandbox that cannot overwrite user hunks, reset the active tree, mutate production data, or touch live state. Otherwise mark RED/process evidence `未验证` and add the strongest honest regression gate.

## Test Quality Gate

Test code constrains production code and must pass these checks:

- Test outcomes, state, contracts, and user-visible effects, not private steps or call order unless that interaction is the contract. Use one behavioral concept per test and only realistic cases that can catch the failure.
- Prefer real implementations, then behavior-preserving fakes and stubs. Mock only the lowest slow, destructive, non-deterministic, or external boundary after understanding its real side effects.
- Configured mock returns, imports, generic keys, or “did not throw” without the required result are coverage theater. Never add test-only methods or branches to production owners.
- Use real schemas and representative shapes. For a reusable or publishable Skill, follow the fixture sanitization rule owned by `security.md`: preserve mechanics with synthetic data, never user project names, paths, identifiers, business terms, content, screenshots, or traces.
- Keep tests deterministic, isolated, order-independent, cleanup-aware, and free of arbitrary sleeps. Use snapshots only for reviewed serialized contracts; bulk snapshot rewrites are not acceptance.
- Coverage percentage is diagnostic evidence, not a fitness target. Confirm the intended tests ran: a zero-test pass, skipped/filtered case, or unrelated green suite is no evidence.
- Do not delete, skip, weaken, or rewrite an expectation merely to obtain GREEN. If a test conflicts with current truth, prove the expected behavior changed before updating it.
- Do not rerun a flaky test until it happens to pass. Record the pattern and conditions, mark it flaky or `未验证`, and investigate state, time, randomness, concurrency, or ordering.

### External Fresh-Session Evidence Production

Release fresh-session evidence must come from ephemeral CI or a dedicated disposable VM, never the user's normal interactive environment. Readable inputs are limited to the exact candidate runtime, versioned synthetic fixture workspace, runner, and credential for that bounded run; normal `HOME`, active runtime state, global memory, unrelated Skills/plugins/history/projects, and personal configuration are forbidden.

Fail closed unless one isolation manifest binds all of these to the result:

- exact source revision, canonical runtime digest, ephemeral environment, and synthetic-workspace origin;
- isolated `HOME` and runtime state with user config/rules disabled and no forbidden input mounted;
- the exact readable-input closure derived from the runtime manifest, live contracts, referenced synthetic fixtures/workspaces, and runner/evaluator sources, with every file SHA-256 bound; any omitted or extra path fails;
- exact external-call authorization, post-run privacy scan of transcripts/traces/screenshots/paths/exports, and completed credential/workspace cleanup.

Expose only the validated disposable closure to the model. Self-authored prose, `--ephemeral`, a synthetic prompt, a workspace-only directory, or `--ignore-user-config` alone is not isolation proof. A local runner that can read normal user data is private-diagnosis evidence only. The release consumer binds the artifact to the exact producer run and workflow and rejects missing, false, stale, unhashed, underdeclared, extra, or mismatched provenance.

### Release-Scope Regression

A behavior release chooses the smallest risk-relevant release set from changed contracts, protected boundaries, known invariants, and credible regressions. Add a positive, negative, paired or metamorphic, or state-effect case only when it can catch a real release failure; never impose every category or a fixed count.

A protected-boundary false negative blocks release and cannot be averaged away by ordinary passes. This is a release verdict rule, not permission to inflate an unrelated local change into a broad security or regression suite.

Choose the lowest credible layer: unit/property for deterministic owner logic; contract/integration for API, database, file, queue, process, or component boundaries; owner-bound negative/state-effect tests for auth, ownership, money, transitions, migration, or idempotency; a few end-to-end cases plus lower-layer edge coverage for critical journeys; browser/render/screenshot evidence for layout and style. The lowest layer proves logic; it never exempts a changed entry from Runtime Boundary Verification owned by `testing-strategy.md`.

## Completion Evidence

Retain the chosen `T0`-`T4` level and reason; pre-change RED/baseline or explicit `未验证`; tests, fixtures, scripts, or acceptance paths used; narrow and regression results; discovery count when filtering could run zero tests; required UI/API/database/security/live evidence; and remaining unverified risk.

Validation must audit whether the original level was honest in both directions. Do not recreate a fake historical RED during final review. If a protected-boundary or new-shared-contract change was classified below `T2` to avoid TDD, mark the process evidence incomplete, add the best current regression protection, and report the violation. If an ordinary `D1` change with no protected lane, new shared contract, or declared strict project policy was forced into `T2`, or a new test file or framework was introduced into an owner that had none, report that as a process deviation too: it costs the user time without adding proof, and it hides which gates actually matter. Also confirm Runtime Boundary Verification ran when an entry changed; a green suite without it leaves the runtime plane `未验证`.
