# Rescue Routes

Use this file for startup rescue, repeated error rescue, and AI-generated code debt audits.

## Contents

- `环境启动`
- `报错救援`
- `AI债务体检`

## `环境启动`

Goal: establish or repair the local first-run baseline before feature work.

Use this when the project cannot run, the user does not know how to start it, dependency installation fails, environment variables are missing, a port is occupied, or an inherited project has no reliable startup proof.

Procedure:

1. Confirm the real project root and Git status before running install/build/start commands.
2. Identify package manager, runtime, framework, lockfile, language version, and scripts.
3. Read existing run docs, README, package scripts, Docker config, framework config, and env examples.
4. Identify required services: frontend, backend, database, Redis/cache, object storage, worker, Docker, provider sandbox, or emulator.
5. Check env/config placeholders. Create or propose `.env.example` only with placeholder values; never write real secrets into source.
6. Run the smallest safe install/start/build/check command when the environment allows it.
7. Capture first visible proof: local URL, health endpoint, screenshot, command output, or exact blocker.
8. If startup fails, classify the blocker and route to `报错救援` instead of random feature work.

Output:

- Project root.
- Runtime/package manager/framework.
- Install/start/build/test command map.
- Required env vars and local services.
- First-run evidence or exact blocker.
- What the user should not do yet.
- Next route.

Invalid:

- Starting feature work before a known run baseline exists.
- Guessing package manager or commands while lockfiles/scripts say otherwise.
- Asking the user to paste real secrets into chat or docs.

## `报错救援`

Goal: stop repeated AI patching and find the first failing boundary.

Use this when the user reports an error, an AI fix loop, a broken start/build/deploy, or a feature that worked before and now fails.

Procedure:

1. Capture exact evidence: error text, screenshot, command, URL, browser console, network response, stack trace, provider console message, or log.
2. Reproduce if possible. If not, state what is missing and ask only for the smallest observable evidence.
3. Classify the error: setup/runtime, syntax/type/build, frontend render/state, API/network/CORS, backend service, database/migration, auth/session/permission, third-party provider, deployment/platform, or data/content.
4. Locate the first failing boundary. Do not patch downstream symptoms first.
5. Check official docs, framework behavior, SDK docs, provider docs, or upstream issue notes when the error belongs to external tooling.
6. Make one targeted fix at a time.
7. Re-run the failing path and report the result.
8. Apply the attempt-escalation sequence owned by `engineering-execution.md`. At its reframe or architecture-audit stop, summarize attempts, disproof, missing evidence, and the next safest route instead of repeating a local hypothesis.

For non-trivial bugs, flaky tests, regressions, dependency/framework/runtime issues, deployment issues, provider issues, or any bug already guessed at by AI, use this evidence ladder:

1. Reproduction truth: exact command, URL, click path, request, fixture, input, screenshot, log, expected result, and actual result.
2. Current repo truth: source call chain, config, generated files, env examples, package/lock versions, runtime logs, browser console/network, database state when relevant.
3. Git introduction truth: `git log -- <path>`, `git blame`, `git show`, branch/tag comparison, or manual narrowing when the regression window matters.
4. Upstream truth: official docs, release notes, changelog, framework source, GitHub issues, GitHub PRs, provider docs, or platform docs when behavior may come from external tooling.
5. Owner-layer decision: the first layer that can explain the symptom and should own the fix.
6. Test decision and regression gate: classify the fix with `testing-strategy.md`. A causally related existing failure may be the `T1` RED; do not create a duplicate test for ceremony. Stable owner behavior that lacks such a gate normally requires `T2`, while live browser/provider/hardware boundaries may require a reproducible `T3` path.

Maintain a small hypothesis table when the cause is not obvious:

| 假设 | 支持证据 | 反证 | 下一步证伪 | 状态 |
| --- | --- | --- | --- | --- |
|  |  |  |  | 未验证 |

Do not call a hypothesis the root cause until it explains the symptom, the failing layer, and the current evidence.

Output:

- Error evidence.
- Error category.
- First failing boundary.
- Root cause or current hypothesis.
- Git introduction finding when relevant.
- Upstream/official-doc finding when relevant.
- Fix made or why no fix was made.
- Test Gate level, pre-change evidence, and regression gate added, reused, or missing.
- Validation result.
- Next evidence needed if unresolved.

Invalid:

- Editing several unrelated layers in one attempt.
- Declaring fixed without rerunning the failing path.
- Hiding repeated failures.
- Guessing dependency/framework/runtime behavior without current upstream evidence or an explicit `未验证`.

## `AI债务体检`

Goal: decide whether AI-generated sprawl must be repaired before more development.

Use this when the project was built by many AI prompts, has duplicate files, fake data, inconsistent UI, unexplained wrappers, dead routes, or repeated fragile fixes.

Check:

- Duplicate pages, components, hooks, services, APIs, schemas, config, and provider wrappers.
- Dead files, old backups, commented-out implementation blocks, abandoned routes, TODO/FIXME piles.
- Mock/fake data in user-facing flows.
- Silent fallbacks that pretend success.
- Hardcoded URLs, roles, IDs, style values, test accounts, or provider config.
- Multiple competing state, request, auth, UI, form, or database patterns.
- Dependency sprawl and unused packages.
- Framework bypasses and custom wrappers that replace official conventions.
- Weak typing, ignored lint/type errors, swallowed exceptions, broad try/catch.
- Frontend style drift from design tokens and component rules.
- Security illusions such as frontend-only permissions or fake admin checks.

Output:

- Debt verdict: `可继续开发`, `先局部清理`, `必须先治理`, or `建议暂停重整`.
- `必须先修` list.
- `可以排期` list.
- `暂不处理` list.
- Recommended cleanup route.
- Files/modules likely affected.
- Validation method after cleanup.

Each item in the three lists uses the common Finding Schema, and whether the
verdict is also written as a report under `audits/` is decided by
`audit-artifact.md`; the debt lanes and verdict vocabulary here do not change.

Invalid:

- Rewriting the whole project without evidence.
- Adding features on top of fake owner layers.
- Deleting files without proving they are unused.
