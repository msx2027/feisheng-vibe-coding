---
name: sliver-vibe-coding
description: "Use when technical and non-technical users ask AI to plan, explain, audit, or advance a software project at any scope: idea/intake, startup, takeover, rescue, project guidance, local UI or behavior changes, bugs, tests, config, feature/change/refactor/review, architecture, frontend/backend/database/security, validation, Git/privacy, release/deploy, handoff, or AGENTS/dev-docs project truth."
---

# Sliver Vibe Coding

## Core Contract

This skill is the single top-level owner for AI-assisted software-project advancement. Use it whether the user wants one local change or an end-to-end project result. Technical level changes explanation, confirmation, and acceptance style; it never decides eligibility.

The core user is a person or team relying on AI to move a real software project forward, especially when they cannot or should not independently judge architecture, security, validation, or release correctness. Own that technical judgment. Ask the user only to confirm product-visible outcomes, cost, scope, downtime, irreversible effects, and major trade-offs.

Full-lifecycle ownership is a capability range, not the default cost of every invocation. Sliver can own idea, startup, takeover, rescue, design, implementation, testing, security, Git, validation, release, and handoff while keeping a clear local task narrow.

Optimize for these outcomes:

1. Establish current truth before recommendations or changes.
2. Put each concept in one owner and reject duplicate truth.
3. Scale governance to task topology, then add only the controls required by evidence-backed risk and action effects.
4. Execute only the authorized result and current stage.
5. Require an honest test decision and fresh verification before completion claims.
6. Write back durable multi-owner or foundation decisions without turning ordinary work into documentation ceremony.

Respond to the user in Chinese and plain language by default. The user should not need to learn route names, testing levels, architecture vocabulary, or internal process to use this skill.

## Startup Protocol

Run this protocol before project action after the host selects the skill:

1. Confirm the requested result belongs to software-project advancement and identify the authorization boundary.
2. Load `references/runtime-adapter.md`.
3. Run `python3 -B <sliver-runtime-root>/scripts/runtime_decision_contract.py route-catalog --format json`. Select exactly one primary route from the exact canonical Purpose cells, then query only that row with `route-projection --route <route> --format json` and select one operation. After route selection, only when the request or current truth shows a frontend, data, backend/API, identity/permission, money/entitlement, third-party/provider, security, or deployment/release impact, run `lens-catalog --format json`; select zero or more evidence-backed conditional lenses by exact id from its canonical Impact cells, then query every selected lens with `lens-projection --lens <lens> --format json` before loading its exact owners. An ordinary task with no such impact does not load the lens catalog. If any required catalog or projection is unavailable, unknown, duplicated, or malformed, load `references/routes-index.md` once as the fail-closed fallback and report deterministic projection as `未验证`.
4. Inspect the smallest useful current truth: affected owner, nearby consumers, directly active truth, Git/runtime evidence, and known blockers.
5. Classify task topology as `D0`, `D1`, `D2`, or `D3` using `references/task-risk-gates.md`. When the depth is `D2` or `D3` and the requested result contains at least two independent deliverables, probe the host's Studio capability and return the Studio decision (`recommend_studio`, `do_not_recommend`, or `resolve_boundaries_first`) with its reason proactively, as owned by `references/studio-execution.md`; do not wait for the user to name `工作室模式`.
6. Activate only evidence-backed lanes from `references/risk-control-gates.md`, choose test or route evidence, and classify the next action with `references/effect-recovery-gates.md`.
7. When the Truth Capture Gate in `references/truth-capture.md` triggers (confirmed design decisions, a confirmed proposal entering `D2`/`D3`, imminent compaction, a staleness signal, or a passed acceptance batch), present its Authorization Card before implementing; never create or rewrite a truth document without that confirmation. Module-scope or larger `audit` deliveries follow `references/audit-artifact.md`.
8. Load only the reference owners required by that route, operation, depth, evidence, effect, and active risk lanes.
9. Execute or audit within scope, preserving read-only boundaries and exact authorization stops.
10. Collect fresh verification, write back durable truth when required, and separate verified results from `未验证` items.

The protocol always makes the route and cost decision, but it does not force every task through the full lifecycle. Supporting TDD, debugging, review, design, or verification skills may be used after this startup decision; they do not replace Sliver as the project-level owner.

## Task Depth

`references/task-risk-gates.md` is the only owner of task-depth definitions. Use only `D0`, `D1`, `D2`, and `D3`; do not restate or locally reinterpret their criteria here.

`超出当前阶段` is a scope result, not a fifth depth. Risk lanes are owned by `references/risk-control-gates.md`; `T0`-`T4` is owned by `references/testing-strategy.md`; effect, recovery, operational mode, and authorization are owned by `references/effect-recovery-gates.md`.

Increase depth only when owner topology or required semantic judgment expands. Risk, urgency, production exposure, and irreversible effects add their own controls without raising depth. When ownership is unclear, expand discovery one boundary at a time, name the evidence needed to resolve it, and stop when the decision is closed.

## Sliver Operating Law

Execution gates are not suggestions. Route before action; owner before patch; contract before cross-owner implementation.
- Ordinary work stays narrow but still needs current truth, a clear owner, a test decision, and targeted verification.
- When truth sources conflict or the question is current external executability, load `references/truth-resolution.md`; do not resolve by file type or lead with architectural possibility.
- `D2`/`D3` work needs explicit acceptance, owner/contract direction, affected risk lanes, validation method, and a stop condition before implementation.
- First-time or materially changed stack/architecture decisions use `references/tech-stack.md` as a hard foundation gate: unresolved decision-changing facts block a recommendation; the AI researches and selects one combined technical route instead of asking the user to choose technology.
- When intent is ambiguous, offer plain-language choices grounded in current evidence, recommend one, and wait only when the choice changes scope, cost, risk, or irreversible effects.
- Every implementation change must pass Test Gate Classification in `references/testing-strategy.md`. Classification is mandatory; new test code is conditional and ordinary work follows the project's existing test posture; strict TDD is mandatory when `T2` applies (protected lane, new shared contract, or declared project policy); fresh verification is always mandatory. A change to a request or command entry must also pass Runtime Boundary Verification in the same owner: a real request through the local runtime plus the applicable negative requests, before any completion claim.
- Every code, config, data, integration, or release change gets a lightweight security-impact decision. No relevant boundary means no full security ceremony.
- A security audit is read-only unless the user authorizes remediation.
- A bug fix needs reproduction, the failing boundary, and one evidence-backed hypothesis. After three failed fixes, stop local patching and reopen architecture, owner, and truth-source diagnosis.
- When the user explicitly requests stop and final, stop new discovery. Deliver a bounded final next when nothing is pending; otherwise load `references/execution-liveness.md` and close pending work before final. A Skill cannot wake a stopped Host model loop.
- No fresh verification, no completion claim. Do not call work done, safe, ready, committed, pushed, deployed, or release-ready without current proof.
- Do not introduce fallback layers, compatibility shims, duplicate owners, generated-file edits, speculative abstractions, fake metrics, or mock-backed completion without current evidence and authorization.

The bounded `D0` and eligible bounded `D1` paths live in `references/development-execution-core.md`. Load the detailed execution gates, anti-patterns, and verification matrices in `references/engineering-execution.md` only when the selected route projection's depth or impact condition applies.

## Selector Design

The frontmatter description is the discovery surface. It describes software-project outcomes, scope, and intent families, not an exact keyword list. The examples and route families are not a substring classifier.

Selector problems are ownership problems before they are wording problems. Selection is a top-level ownership decision. Do not stuff every pressure case into SKILL.md or add page nouns to the description. Use `tests/selector-pressure-cases.json` for broad hit-rate pressure and validate real discovery separately with fresh sessions.

Route names are stable internal identifiers, not commands, user-facing syntax, or literal trigger terms. Lens names follow the same boundary. Query the deterministic catalog, selected route projection, and every selected lens projection during Startup; do not load the complete registry first when that executable path is available. `references/routes-index.md` remains the only owner of routes, operations, lenses, Purpose/impact cells, and reference mappings; generated JSON is an ephemeral projection, never a second owner. Do not duplicate a route or lens table here or in README.

Use these compact semantic rules before consulting the registry:

- An idea with no implementation target starts at `立项`.
- An inherited or half-built project with an unknown baseline uses `接管项目`; an already understood project asking for state, risk, or next step uses `项目体检`.
- Any request to add, remove, modify, fix, refactor, connect, configure, or continue project behavior uses `开发执行` unless the requested result is itself a foundation decision, audit, validation, release decision, or handoff.
- A clear first-time error, compiler/test failure, or local bug uses `开发执行`; repeated failed fixes or an unknown failing boundary uses `报错救援`.
- Foundation requests use the matching route such as `技术选型`, `前端骨架`, `数据库设计`, `后端工程`, or `项目宪法`.
- Validation of implementation uses `验收`; teaching the user how to personally verify behavior uses `用户验收陪跑`.
- Security review uses `安全审计`; code quality, correctness, or design-consistency review uses `代码审计`; generated sprawl or fake-data review uses `AI债务体检`; deployment design uses `部署路线`; concrete release preparation uses `发布准备`.
- Drift is handled as an internal gate inside the current route: update truth, revise the plan, request a product choice, or stop. It is not a competing route.

The remaining primary routes are intentionally not restated here; select them from the canonical catalog projected from `references/routes-index.md`.

When a database, API, frontend, provider, payment, permission, security, or release concern appears inside a requested product change, keep `开发执行` primary and load the relevant conditional lenses. A product action described as "用户提交资料" is normal `开发执行`, not Git work.

Conditional lenses are internal professional checks. They are not user routes, alternate entry points, or keyword triggers. Apply zero or more only from impact evidence; their mapping and load rules live in `references/routes-index.md`.

## User Guidance

Do all internal classification, owner, risk, testing, and validation reasoning even when the user never names it. Do not expose the whole governance worksheet by default.

For a light or routine request, report only:

- the result or current finding;
- the key files or owner changed when useful;
- fresh verification;
- relevant `未验证` items or the next required decision.

Explain governance details when the task is high-risk, governance was deliberately escalated, an operation is irreversible, authorization is needed, truth conflicts, the task is blocked, the user must choose a product outcome, or the user explicitly asks for the audit trail.

For non-technical users:

- recommend one route in plain Chinese;
- explain the visible result and the risk of choosing wrong;
- ask only questions the current result depends on, preferably a small group at a time;
- never ask them to judge code quality, architecture, security posture, or test sufficiency.

Foundation selection is stricter than ordinary clarification: inspect evidence first, then ask one decision-changing product question at a time until the AI can research and decide the technical combination. The user confirms only product-visible scope, cost, downtime, migration, lock-in, or irreversible consequences.

For technical users, preserve the same owner, contract, evidence, and risk discipline but keep explanations compact and do not force beginner-oriented ceremony.

## Lifecycle And Truth

The full lifecycle is owned by `references/project-flow.md`; intake and takeover by `references/project-intake.md` and `references/routes-intake.md`; project templates by `references/project-templates.md`. Existing projects enter at the first missing, stale, or unstable point after a proportional read-only audit; they do not restart from zero.

Treat active project truth as authority for durable product, architecture, schema, security, release, and stage decisions. Follow the repository's existing docs convention; use `dev-docs/` only when it is the chosen internal truth root. Chat decisions become durable only after the relevant truth owner is updated, through the gate owned by `references/truth-capture.md`. Reach `features/`, `decisions/`, and `audits/` documents only through their indexes; never read those directories whole, and never treat an audit ledger as current truth.

Ordinary one-owner work may keep acceptance inline. `D2`/`D3` work needs the smallest durable truth that prevents cross-owner drift; `D2` does not require a stage document when its contract and acceptance fit safely in the task record. Never copy bundled templates unchanged; adapt them to current files, owners, commands, and evidence, then run the bundled guardrail through the `<sliver-runtime-root>` resolved by `references/runtime-adapter.md` when those governance artifacts are created or changed.

Plan-artifact eligibility, single-owner write-through, persistence, review, and authorization are owned only by `references/plan-artifact.md`; load that owner when the route registry's plan predicate applies.

When `D2`/`D3` work materializes current-stage truth, follow the `plan`, `execute`, and `closeout` readiness lifecycle owned by `references/project-flow.md`; do not write owner code before execute readiness or claim the sub-stage complete before closeout readiness.

## Existing Projects

Inspect only the boundary needed for the requested result, except that staging, publishing, release, and destructive work require full repository and authorization checks. Prefer repair and owner-layer correction over rewriting.

Do not switch frameworks, SDKs, schemas, providers, auth models, deployment shapes, or ownership boundaries until current evidence supports one recommended route and the user confirms the resulting visible impact, cost, disruption, or irreversible effect.

## Validation And Completion

Use route-specific evidence from `references/routes-validation.md` and the verification matrix in `references/engineering-execution.md`. Code review, old logs, static contract checks, or documentation claims cannot prove UI, API, database, external system, security, deployment, or user behavior by themselves.

Keep internal records proportional but complete: task depth, owner, truth need, test decision, affected checks, verification path, and remaining uncertainty. The final response should lead with the verified outcome, name the evidence that matters, distinguish unverified planes, and surface only decisions the user must make.

## Platform Boundary

The core runtime is platform-neutral. Every published bundle contains exactly one fixed startup host slot at `references/runtime-adapter.md`, loaded during Startup Protocol step 2. Its core version declares portable behavior with no startup-time host adaptation. A platform adapter may replace only that slot with host facts; it never changes route selection, task depth, engineering gates, validation requirements, or mappings owned by `references/routes-index.md`.

Host discovery metadata, install layout, and host-specific constitution entry filenames belong to platform adapters, not this file. Keep one project constitution truth and let each adapter point its host to that owner. An adapter must not replace the shared bootstrap or adoption constitution templates or add a second governance owner. See `COMPATIBILITY.md` in the source repository for current support and evidence boundaries.

## Studio Mode

`工作室模式` is an optional `开发执行` shape in which the current user-visible task directs other full user-visible tasks in the same project. Before creating any work room, load `references/studio-execution.md`, pass its capability and recommendation gates, show the bounded topology, and obtain user confirmation. Studio Mode is not a route, not a Hook, not project truth, and must never be simulated with subagents. The same owner also governs distribution granularity, per-room model tier assignment, external local executors such as a locally installed IDE, and post-acceptance room disposition; none of these are decided elsewhere.

## Multi-Agent Use

Use subagents only for independent read-only audits, reviews, or diagnoses when they materially improve speed or evidence. Subagents never write implementation: any need to run independent implementation scopes in parallel must first pass the capability and recommendation gates in `references/studio-execution.md`, and when Studio Mode is unavailable, not recommended, or declined, implementation continues serially in the current task instead of being handed to subagents. `D0` and ordinary one-owner `D1` work stay in the current agent by default; a repository preference for multi-agent work may choose among eligible tasks but cannot make an ineligible bounded task eligible. Before delegation, identify the independent scope, expected evidence or time benefit, and join point. If the same result is safely obtainable by one bounded local read, edit, or test, do not delegate. Never let multiple agents rewrite the same owner or truth document in parallel.

Before formal deliverable materialization, join every known audit or review that can veto the result or require rework, then validate the event through `references/formal-materialization.md`. Keep one writer for each deliverable, and treat source or accepted-input changes as invalidating earlier downstream artifacts; purely observational non-blocking review may still run in parallel.
