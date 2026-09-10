# Stack And Architecture Selection

Use `技术选型` for a new foundation decision or an evidence-backed review of an existing stack. This file is the single process owner for selecting the combined stack, framework, architecture, data, runtime, and deployment-topology constraints. `architecture-patterns.md` supplies pattern criteria; it does not own a second workflow.

## Core Decision Contract

- The AI owns technical judgment. It chooses the architecture, language, framework, database, SDKs, runtime boundaries, and deployment-topology constraints; the later `部署路线` workflow selects the concrete platform and runbook.
- The user supplies or confirms product facts and consequences they can judge: who uses the product, the first complete flow, cost, deadline, downtime, data loss, migration, vendor lock-in, compliance, and irreversible effects.
- Never ask the user to choose technical names. Translate uncertainty into product-visible outcomes, cost, downtime, migration, lock-in, or irreversible effects that the user can actually confirm.
- Never ask a non-technical user to choose React/Vue, Nest/Spring, SQL/NoSQL, monolith/microservices, Clean/DDD/CQRS, cloud vendors, or equivalent technical names.
- Produce exactly one primary `stack + architecture` combination. Alternatives exist only to show what was rejected and why.
- Product and platform fit are hard gates. AI familiarity, popularity, and personal preference cannot override them.
- A foundation decision is high-risk. If a blocking product fact, source conflict, current official technical fact, or critical capability proof is missing, stop at `blocked`; do not issue a final or temporary recommendation.
- Full foundation governance applies only to first selection or a material foundation change. Ordinary work inside an accepted foundation consumes current truth and does not rerun this process.

## Foundation Scope Gate

Run the full process when any of these is true:

- A new project needs its first technical foundation.
- An inherited project has no trustworthy selection record or the current route may not fit the product.
- The request changes framework, main language, database class, auth model, provider foundation, deployment topology, process boundary, or system architecture.
- A confirmed product capability creates a credible migration cliff in the current foundation.

Do not reopen the whole decision for a normal module, page, endpoint, field, dependency, bug, or refactor that fits the current owner and foundation. During normal development, use the smallest current owner placement and escalate only when evidence proves a foundation mismatch.

## Source Materials Gate

Before any recommendation, audit every available source rather than selecting from the latest chat message alone. Read or explicitly mark missing:

This is the project-intake evidence gate; missing intake cannot be replaced by a framework default.

- Project brief, target users, roles, scenarios, first complete user flow, MVP, and explicit non-goals.
- Active product truth for current delivery, confirmed next stage, must-not-block capabilities, and speculative ideas.
- Function list, complex-feature truth, large-stage plan, and current-stage truth.
- Existing technical-selection, architecture, frontend, backend, database, security, deployment, and agent-constitution truth.
- Package files, lockfiles, framework files, module/route layout, schema/migrations, scripts, deployment files, env examples, and current startup/build/runtime evidence.
- Core business objects and important lifecycle, transaction, permission, data-retention, and integration rules.
- Platform needs: browser, mobile, desktop, extension, CLI, background process, local files/devices/software, offline use, or hybrid execution.
- Business constraints: budget, launch deadline, expected operating model, commercial-use/license needs, regions, compliance, company standards, historical systems, required providers, and maintenance ownership.
- User-provided references, comparable products, screenshots, design constraints, and known rejected routes.

Output a source coverage report with each required source classified as:

- `confirmed`: current evidence is sufficient.
- `not_applicable`: evidence shows the source does not apply.
- `blocking_unknown`: missing or contradictory and capable of changing the decision.

Do not convert guesses, template defaults, stale documents, or AI inference into `confirmed` product facts.

## Decision Readiness Gate

The project decision record uses one of these states:

- `blocked`: one or more blocking facts, source conflicts, current external facts, or critical capability proofs remain unresolved. A source report and the next question or research/PoC action are allowed; a recommendation is forbidden.
- `researching`: product inputs are sufficient, but current primary-source research or candidate comparison is incomplete. No recommendation may be written as truth.
- `poc_required`: one critical uncertainty can only be resolved by a bounded experiment. No recommendation may be written as truth until the PoC has an honest result.
- `recommendation_ready`: blocking unknowns are empty, current evidence is complete, the combined fit analysis is finished, and exactly one primary combination exists.
- `implementation_ready`: `recommendation_ready` plus confirmation of product-visible cost, downtime, migration, lock-in, scope, or irreversible consequences. This is not user approval of technical vocabulary.

Rules:

- `blocking_unknowns` must be empty before `recommendation_ready`.
- A source conflict that affects platform, data, security, deployment, framework, topology, or operating cost is always blocking.
- An unverified item may remain only as `unverified_nonblocking` with evidence showing why every candidate decision is unchanged by it.
- If current web research is unavailable and a mutable fact affects the choice, remain `blocked` or `researching`. Never finalize from model memory.
- Do not offer a `暂定技术路线` as a substitute. Candidate research may be shown, but it must not be phrased as a recommendation or written to the active foundation truth.
- While blocked, ask one blocking question at a time and must not produce a final recommendation.

## Clarification Loop

When foundation inputs are insufficient:

1. Inspect documents, code, runtime, and available evidence first.
2. Select the single unanswered product question with the highest decision impact.
3. Ask exactly that one question in plain language. Explain the visible consequence only when useful.
4. Do not offer technical options. If the user cannot answer, help them describe observable product facts; keep the fact blocking until confirmed.
5. Recompute source coverage and ask the next single blocking question only after the prior answer is understood.
6. Stop asking when all decision-changing product facts are closed; research technical facts yourself.

This one-question rule is specific to foundation selection. It does not replace proportional small-group clarification for unrelated ordinary work.

## Product Horizon Gate

The active product truth is the only owner of present and future product facts. Classify every relevant item as:

- `current_required`: required by the current complete flow.
- `confirmed_next`: supported by a current user decision, approved stage, function list, contract, or equivalent evidence.
- `must_not_block`: not implemented now, but the current decision must preserve a credible low-cost route.
- `explicit_non_goal`: intentionally outside the product direction.
- `speculative`: hypothetical future capability or scale with no confirming evidence.

For each material item, record its source, current effect, smallest reversible boundary, migration cliff, and measurable re-evaluation trigger.

- MVP is a delivery boundary, not an architecture ceiling.
- Protect confirmed evolution with the smallest owner, contract, data, process, or migration seam that works now.
- Treat confirmed next-stage capabilities as real constraints only when their source is current. Every must-not-block boundary needs a concrete migration cliff and an evidence-backed re-evaluation trigger.
- Do not implement deferred capability merely to prove extensibility.
- Speculative ideas are re-evaluation inputs, not architecture requirements. They do not justify services, Kubernetes, queues, multi-runtime code, abstraction layers, schemas, or operational burden.

## Quality Attribute Scenario Gate

Do not use empty adjectives such as “high performance”, “high availability”, “secure”, “enterprise-grade”, or “scalable” as architecture evidence. Convert each architecture-significant quality need into a testable scenario:

| Source | Stimulus | Affected flow/artifact | Environment | Required response | Response measure | Priority | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |

Activate only relevant attributes, but assess whether the project needs evidence for:

- security, privacy, audit, and compliance;
- availability, recovery, durability, and acceptable data loss;
- latency, throughput, concurrency, data size, and workload shape;
- consistency, transaction, idempotency, and ordering;
- modifiability, confirmed evolution, replaceability, and migration;
- deployability, operability, observability, backup, rollback, and support ownership;
- testability, accessibility, offline behavior, portability, and cost.

Prioritize by product importance and architecture impact. Do not force every attribute to the maximum or create a ceremony for a non-applicable concern.

## Architecture Drivers Gate

Derive a small set of architecture drivers from functional flows, quality scenarios, hard constraints, and confirmed evolution. For every driver record:

- source and status;
- business priority and architecture impact;
- failure consequence;
- affected architecture axes;
- evidence or remaining blocker.

Before choosing a framework, form only the minimum architecture envelope needed to eliminate impossible routes:

- client and platform boundary;
- deployment/process boundary;
- trust, tenant, and data boundary;
- transaction and consistency boundary;
- integration and asynchronous-work boundary;
- module/domain ownership boundary;
- operational and release boundary.

Do not announce DDD, Clean Architecture, CQRS, microservices, event-driven architecture, BFF, or plugin architecture merely because an envelope exists. Apply the pattern criteria in `architecture-patterns.md` only after a driver points to that axis.

## Capability Platform Gate

Classify each required capability as browser web, mobile, desktop, local system automation, browser extension, CLI/background worker, backend service, or hybrid.

- Never finalize a browser-only route for local software, OS permissions, keyboard/mouse, unrestricted filesystem, local device control, screen capture, or persistent local background execution.
- Do not finalize a browser-only web stack when a confirmed capability requires desktop, local-system, extension, worker, or native ownership.
- A hybrid route must name UI ownership, local/backend capability ownership, communication contract, auth boundary, startup/health path, and bridge validation.
- A web UI may participate but cannot pretend to own capabilities outside browser security boundaries.

Record the primary platform route, rejected route, and proof for every material capability.

## External Evidence Gate

Research current primary sources for every mutable technical fact that can affect the decision. The evidence table must include:

| Candidate or decision | Claim being checked | Primary URL/source | Source type | Checked date | Version/support target | Result |
| --- | --- | --- | --- | --- | --- | --- |

Required evidence when applicable:

- official architecture, lifecycle, module, data, test, build, and deployment conventions;
- current stable/LTS version, compatibility matrix, support window, and migration path;
- official SDK/API capability, authentication, quota, region, pricing, sandbox, webhook, and operational limits;
- release activity, maintenance status, license/commercial-use fit, and security advisories;
- official examples or maintained reference implementations for architecture-critical capabilities.

Primary official sources are required when available. Community articles, GitHub discussions, benchmarks, and search summaries may supplement but cannot independently support the final recommendation. Each source must support a named claim; a list of unrelated links is not evidence.

Record each claim, checked date, version/support target, license result, security result, and conclusion from current primary sources.

## Candidate Combination Gate

Compare only credible candidate combinations after the architecture drivers are known. Two or three candidates are common, but a hard platform, organization, inherited-system, or legal constraint may leave only one credible route. In that case, record the constraint and why apparent alternatives are not viable; never invent a weaker “comparison candidate” for ceremony. A combination includes, when relevant:

- product/platform shape;
- frontend and design-system route;
- backend language/framework and runtime count;
- database, migration, transaction, and consistency route;
- deployment topology, process boundaries, and constraints that a later concrete deployment route must satisfy;
- module/domain organization, communication style, client API shape, and extensibility style;
- official SDK/provider and operational route.

Candidates are internal comparison material, not equal choices for the user. Eliminate any candidate that violates a hard product, platform, security, legal, data, or deployment constraint before scoring preferences.

Foundation selection owns deployment topology, runtime shape, capability constraints, and foundation-critical provider limits. The `部署路线` workflow owns the later concrete platform/account choice, domains, environments, secrets, prices, backup/migration steps, release commands, rollback, monitoring, and operating runbook. Do not maintain those as two selection owners.

## Framework-Architecture Fit Gate

For every surviving combination, record:

| Candidate | Framework-native structure | Driver fit | Native support | Local adaptation | Conflict/bypass cost | Operations cost | Migration cliff | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Use these fit outcomes:

- `native`: framework conventions directly support the required boundary.
- `compatible_local`: a bounded project-specific layer is justified and does not replace framework lifecycle or duplicate owners.
- `adapter_cost`: feasible only with material adapters, extra layers, processes, or operational ownership; cost must be explicit.
- `conflict`: the combination fights framework lifecycle, deployment model, data guarantees, or required platform capability; reject it.

Do not force a generic Clean/hexagonal/DDD directory over a framework whose native structure already satisfies the drivers. Do not let framework defaults decide macro topology, trust, data, consistency, or deployment boundaries that the framework cannot know.

After comparing framework-native support and adaptation cost, select one primary stack-and-architecture combination; never preserve several equal primary routes.

## Framework And SDK Preference Gate

Evaluate preferences only after hard constraints and framework-architecture fit pass:

1. Product, platform, security, legal, data, and deployment fit.
2. Architecture-driver and quality-scenario fit.
3. Framework-native fit with minimal custom glue.
4. Current official support, maintenance, license, security, and migration evidence.
5. Operational simplicity, predictable cost, backup/rollback, and managed deployment fit.
6. Strong conventions, scaffolding, validation, testing, documentation, examples, and reduced from-scratch work.
7. Reversibility and protection of confirmed evolution without speculative complexity.
8. AI familiarity: widespread, stable patterns that coding agents can maintain and diagnose.

AI familiarity is an important tie-breaker among valid candidates, not permission to choose a worse-fitting route. Do not rely on “I know this framework”; use ecosystem prevalence, stable conventions, official docs, maintained examples, and diagnosable common patterns as evidence.

Prefer official SDKs, framework-supported patterns, mature UI/component systems, ORM/migration tools, auth/provider flows, and convention-heavy frameworks when they fit. A low-level, from-scratch, raw-HTTP, custom-wrapper, or hand-rolled route must prove the project need and state its additional owner, test, documentation, and maintenance cost.

## Frontend Design-System Gate

A styling utility, raw CSS route, or copied component snippets are not a complete design system by themselves. A frontend combination must name:

- design-token and theme owner;
- UI/component base and business-component owner;
- reuse and accessibility rules;
- forbidden mixed systems and style-drift prevention;
- screenshot, interaction, responsive, token, and component-reuse validation.

## Single Runtime And Cross-Language Gate

Default to one main backend runtime/language when it can cover the required API, automation, AI, data, jobs, and provider needs with acceptable official support and structure. Record this as the single-runtime route.

Allow another runtime only when current evidence proves a required SDK/native capability, a stable inherited service, necessary process/dependency isolation, material workload constraint, or company requirement. The resulting `Cross-Language Architecture Truth` must define service/process ownership, contracts and versioning, shared schema source, startup/health, config/secrets, auth, errors/retry/idempotency, logs/traces, data consistency, jobs, contract tests, deployment order, and rollback.

## Architecture PoC Gate

Use a PoC only when one critical uncertainty can change the selected combination and cannot be resolved from current primary sources or existing runtime evidence.

The PoC must be:

- isolated, time-bounded, and disposable;
- tied to one explicit hypothesis;
- equipped with success and failure measures;
- forbidden from silently becoming the production skeleton;
- closed with evidence and a decision impact.

Do not build a PoC for every candidate or use “we can try it later” to bypass decision readiness.

## Primary Combination And User Boundary

The AI selects one primary combination and records rejected alternatives. Ask the user only to confirm consequences they can evaluate:

- product capability or scope change;
- launch delay or operating cost;
- downtime, data migration, data-loss tolerance, or rollback limit;
- vendor/account commitment or lock-in;
- user-visible disruption or irreversible external action.

The user does not confirm that a framework, pattern, database, or architecture is technically correct. If the user specifies technology, treat it as a constraint to audit; explain conflicts and recommend the safer project-fit route instead of complying mechanically.

## Project Truth Write-Back

- `project-brief.md` owns product facts and horizon.
- `technical-selection.md` owns source coverage, drivers, quality scenarios, current evidence, credible candidate combinations, rejected or non-credible alternatives, PoC result, the selected combination, deployment-topology constraints, confidence, and re-evaluation triggers.
- `architecture.md` consumes the accepted combination and owns current topology, processes, modules, owner map, trust/data/transaction boundaries, communication, framework-native placement, directory rules, and validation commands.
- High-cost individual decisions may use ADRs linked from the selection record. ADRs own rationale/history, not a competing copy of current architecture.
- Frontend/backend/database/security truth consumes the selected combination and may refine its local owner rules; it must not reopen the foundation casually.
- Deployment-route truth consumes the selected topology and constraints, then owns the concrete platform and operational runbook.

## Existing Project Review

Audit current package/framework/SDK/runtime/deployment evidence and classify the route:

- `继续沿用`: fit remains valid; document conventions and continue.
- `沿用但修正`: retain the stack and repair owner boundaries, versions, docs, scripts, or framework use.
- `局部替换`: replace a risky library/SDK/provider adapter without changing the foundation.
- `分阶段迁移`: proven product, security, maintenance, deployment, support, or migration-cliff problem requires a dedicated migration truth.
- `立即停止`: critical security, data-loss, license, platform, or provider-contract risk.

Do not migrate because another framework is newer, more fashionable, or more familiar to the current AI. Before a foundation change, compare the cost and risk of staying, repairing, and switching; identify affected data/auth/API/schema/deployment surfaces; then ask the user only to confirm the resulting consequences.

## Required Output

When `blocked`, output only:

- source coverage and current evidence;
- the exact blocker and why it can change the decision;
- the single next product question, research action, or PoC contract;
- what must not be decided or implemented yet.

When `recommendation_ready` or `implementation_ready`, output:

- decision status and project evidence reviewed;
- product-horizon source and derived minimum boundaries;
- prioritized architecture drivers and quality scenarios;
- platform/capability fit;
- current primary-source evidence with dates and version/support targets;
- one primary `stack + architecture` combination;
- framework-architecture fit result;
- selected architecture axes and justified non-applicable axes;
- rejected combinations and evidence-backed reasons;
- risks, PoC result or `not_required`, migration cliffs, confidence, and re-evaluation triggers;
- product-visible consequences requiring user confirmation;
- exact write-back targets for technical selection and concrete architecture.

## Invalid Foundation Decision

The decision is invalid if it:

- recommends anything while a blocking product fact, source conflict, current official technical fact, or critical PoC remains unresolved;
- uses a default, guess, stale memory, template value, or user technical choice to close a blocking fact;
- asks the user to select a framework, language, database, provider, deployment architecture, or architecture pattern;
- gives multiple equal primary combinations;
- chooses mainly because the AI is familiar with it;
- skips current primary sources for mutable or provider-critical facts;
- lists links without mapping them to claims, dates, versions, and results;
- selects a framework without its native architecture and conflict/adaptation cost;
- applies microservices, queues, CQRS, DDD, Clean/hexagonal, BFF, plugins, cross-language, or Kubernetes without a current driver and bounded scope;
- under-designs complex consistency, security, tenant, lifecycle, platform, or operational needs merely to stay simple;
- treats speculative scale as a current architecture requirement or treats MVP as the architecture ceiling;
- writes a selected stack without its architecture combination, rejected alternatives, migration cliffs, and re-evaluation triggers;
- duplicates product facts, technical rationale, and current concrete architecture across competing truth owners;
- reruns full foundation governance for ordinary work that current truth already supports.
