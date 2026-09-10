# Project Flow

This reference is the full project map. Use it to decide where a new or existing project enters the workflow.

## Contents

- Main Sequence
- Project Space And Internal Truth Root
- Pre-Code Foundation Rule
- Stage Inputs And Outputs
- UI Prototype Lifecycle Insertion
- Large Project Decomposition
- Current-Stage Implementation Truth Standard
- Proactive Project Health Lanes
- Feature Entry And Foundation Impact Gate
- Task Depth And Decision Gate
- Same-Class Solution Scan
- Third-Party Documentation Gate
- Truth-Document Order
- Truth Root Selection
- Template Materialization
- Project Guardrail Check
- Existing Project Entry Algorithm
- Context Handoff
- Drift Control

## Main Sequence

1. Project space, `dev-docs`, template set, and Git checkpoint rules.
2. Project brief: product, users, core flow, MVP, non-goals, confirmed evolution, and speculative boundaries.
3. Function list and large stages.
4. Existing-project runtime evidence when code already exists: current package manager, versions, env, services, commands, and visible proof or blocker.
5. Foundation decision readiness: source coverage, blocking clarification, quality scenarios, and architecture drivers.
6. Joint stack, framework, architecture, data, runtime, and deployment-topology constraints with current primary evidence.
7. Concrete project architecture and agent constitution.
8. Materialized runtime/startup baseline for the accepted foundation: package manager, versions, env placeholders, local services, start command, and first visible proof.
9. Conditional UI prototype lifecycle for design-led work, before or during frontend skeleton work as the current project requires: current project UI context, versioned prototype draft, constraint review, approval evidence, and semantic-implementation handoff.
10. Frontend skeleton.
11. Database design.
12. Backend boundary.
13. Backend architecture truth.
14. Minimal backend skeleton.
15. Backend skeleton validation.
16. Security validation.
17. Current large-stage implementation truth document.
18. Internal execution-depth decision before development.
19. Normal development intent, owner, execution-depth, and impact decision for the next change.
20. Monetization/entitlement truth when the stage touches paid access.
21. Sub-stage execution.
22. User acceptance walkthrough and quality validation.
23. Stage validation, truth-doc update, AI debt check, and Git checkpoint.
24. Concrete deployment-route decision before release.
25. Context handoff when the current window is too large or another agent will continue.
26. Release readiness and operations handoff when the project will be used by real users.

Do not treat this as a rigid from-zero checklist. Existing projects enter at the first missing or unstable point.

The runtime step has two different meanings: an existing project exposes current runtime evidence before foundation review; a new project cannot choose package managers, framework versions, or startup services until the foundation is accepted. Do not manufacture a new-project runtime baseline before selection.

## Project Space And Internal Truth Root

For a new project, help the user create or choose a clear English project folder before coding. Avoid starting from a random desktop, downloads, chat-export, or mixed-material folder.

Use `dev-docs/` as the preferred internal development truth root when no better convention exists. Explain to non-technical users that this folder is the internal "rule repository" for AI and the project team.

Do not treat internal truth docs as public product documentation. Before remote push, check whether `dev-docs/`, business plans, real cases, and agent constitution should stay private.

If the user wants version history for internal documents but does not want them pushed publicly, use dual-repo management: keep the code repo at the project root, add the internal truth-doc root to the code repo's `.gitignore`, and initialize a separate local-only Git repo inside the truth-doc root after confirming the path.

Before the first commit, create or repair `.gitignore` so secrets, internal docs, private agent constitution files, generated artifacts, local uploads, database dumps, and third-party reference projects are not accidentally staged.

When a new project or adoption truth surface must be materialized, use `references/project-templates.md` and the bundled templates:

- `assets/project-bootstrap/` for empty or effectively empty projects.
- `assets/project-adoption/` for half-built, inherited, forked, or AI-generated projects.

Templates are raw material. They must be adapted to project evidence before they become truth.

## Pre-Code Foundation Rule

Before writing business features in a new project, the standard order is:

1. Project brief and function list.
2. Source coverage, quality scenarios, and architecture drivers.
3. Joint stack-framework-architecture research and fit decision.
4. Product-consequence confirmation and technical-selection truth.
5. Concrete project architecture.
6. Agent constitution.

Frontend, database, backend, and security foundations are then built or audited according to the product shape. Do not let the agent jump directly from a one-sentence idea to feature code.

This is an iterative foundation decision, not “choose a framework, then invent an architecture around it.” Architecture drivers first eliminate impossible routes; framework-native constraints and current official evidence then reshape the candidate architecture until one coherent combination remains. If a blocking input or critical technical fact is unresolved, remain `blocked` and continue one-question clarification, research, or a bounded PoC instead of advancing the sequence.

## Stage Inputs And Outputs

| Stage | Required input | Output | Existing project insertion |
| --- | --- | --- | --- |
| Project space / Git | Idea or existing directory | Project directory, `dev-docs`, Git baseline, privacy rules | Audit current repo and create a checkpoint before changes. |
| Runtime/startup | Project directory or inherited code | First-run map, command map, env placeholder map, startup proof or blocker | Use when project cannot run or startup is unknown. |
| Project brief | Idea, users, scenarios | Brief, user journey, MVP, non-goals, confirmed next-stage capabilities, must-not-block items, speculative boundaries, same-class/reference notes, differentiation, long-term direction | Backfill from existing app behavior and user answers without turning the takeover audit into a second permanent product truth. |
| Function list / stages | Brief | Function list, complex feature docs, large stage plan | Reverse-map existing features into a list. |
| Foundation decision | Product facts, complete user flow, source coverage, confirmed evolution, architecture-significant quality scenarios, hard constraints | Decision status, architecture drivers, current external evidence, credible candidate combinations, framework-architecture fit, one primary combination, deployment-topology constraints, migration cliffs, PoC result, and re-evaluation triggers in technical-selection truth | Review the inherited combination and classify keep, repair, local replacement, staged migration, or immediate stop. Blocking unknowns prevent recommendation; the user confirms only product-visible consequences. |
| Architecture / constitution | Accepted stack-architecture combination, framework-native norms, product truth | Concrete topology, process/module/data/trust/transaction/communication owner map, validation rules, and agent constitution | Audit current code and docs before changing current architecture; do not duplicate selection rationale. |
| Frontend skeleton | Design direction, style route, token truth, UI library, page flow | Runnable frontend base, UI rules, and token-backed components | Consolidate existing pages; do not rewrite by default. |
| UI prototype lifecycle (conditional) | Product flow plus current layout, token, component, asset, theme, breakpoint, and adjacent-page truth | Indexed and versioned prototype truth, project-constraint review, approval evidence, and one implementation-eligible approved version | Read the current UI system before designing. Use the selected truth root; do not create a parallel docs convention or treat a chat image as durable truth. |
| Database design | User flows, business objects, permissions | Schema/migrations, field rules, data validation | Add or repair migration/schema truth; do not drop/rebuild casually. |
| Backend boundary | Function list, accepted foundation decision, database design, API needs | Backend responsibilities and API boundary inside the selected language/framework route | Use before adding new backend features or fixing backend confusion; it consumes rather than reopens the foundation. |
| Backend architecture truth | Backend boundary, selected framework, database design, security requirements | Request lifecycle, owner layer map, API/error/log/config/data/auth rules, new-module placement | Audit current backend architecture before changing structure. |
| Backend skeleton | Architecture truth and framework norms | Minimal service with startup, config, health check, DB, responses, errors, logs, auth entry | Turn into skeleton audit for existing backend. |
| Skeleton validation | Code and architecture truth | Validation report and runtime evidence pack | Strong insertion point when backend is hard to change. |
| Security | APIs, permissions, config, dependencies, DB operations | Security boundary table, permission table, test evidence | Repeat per interface and before release. |
| Stage implementation | Large stage plan and truth docs | Current-stage implementation truth, sub-stage report | Most common existing-project entry: plan the next stage from current state. |
| Execution-depth decision | User request and likely owners | `D0`, `D1`, `D2`, or `D3`, plus independent risk, evidence, and effect decisions | Internal step inside normal development; never ask the user to choose the labels. |
| Development execution | Requested change, current truth, architecture, owner files | Professional product/technical decision, owner placement, implementation, validation, and write-back | Default path for any project change; load conditional checks from actual impact. |
| Monetization / entitlement check | A development task whose real design touches paid value | Paid value, entitlement truth, lifecycle, provider/webhook impact, validation | Conditional lens inside development, not a competing user route. |
| User acceptance walkthrough | Implemented feature and user-visible route | Click path, expected visible states, failure signs, evidence request | Use when the user needs to confirm behavior without reading code. |
| Quality validation | Implemented behavior, truth docs, run/test commands, UI/API/data evidence | Pass/fail/未验证 evidence table and fix list | Use before commit, handoff, release, or continuing after a risky change. |
| AI debt check | AI-heavy project, repeated prompts, duplicate or fake paths | Must-fix debt, schedulable debt, ignored debt, cleanup route | Use before adding features to a messy generated project. |
| Deployment route | Validated app, stack, data/provider needs, release target | One recommended deployment route and pre-release blockers | Use before `发布准备` if deployment target is not designed. |
| Release readiness | Validated stage, deployment target, env/config, data, third-party, security | Release verdict, deployment steps, rollback, monitoring, owner handoff | Use before real users, client delivery, public production, or private beta. |
| Context handoff | Large context, unfinished stage, or another agent will continue | Copy-paste-ready handoff with git state, truth docs, validation, drift warnings, and next commands | Use before changing windows or handing the project to another agent. |

## UI Prototype Lifecycle Insertion

Use this conditional stage when the requested result includes generating, revising, approving, or implementing a UI design, screenshot, mockup, or other visual prototype. The detailed design and design-to-code rules are owned by `ui-design-lifecycle.md`; this section owns where that truth enters the project flow.

The sequence is:

```text
current project UI truth
  -> prototype draft
  -> project-constraint review
  -> schema-owned recorded approval transition
  -> semantic implementation
  -> fidelity and project-constraint validation
```

Materialize each feature under the already selected internal truth root. The version directory contains only real output referenced by its artifact manifest; surface, state, viewport, and theme are data, not fixed filenames or mandatory device pairs:

```text
<truth-root>/design/
  README.md
  prototypes/
    <feature>/
      prototype.md
      v001/
        <manifest-listed real artifacts only>
```

`design/README.md` indexes feature prototype truth. Each feature's `prototype.md` records a lifecycle instance and its version artifact manifest. `references/ui-design-lifecycle.md` is the single owner of the schema, enums, version ownership, approval eligibility, and transitions; this insertion consumes that contract and does not redefine it. Continuous authorization must pass through the same recorded transition before implementation.

An approved version is immutable evidence. Never overwrite its images, assets, review record, or approval evidence; create the next `vNNN` directory and update `prototype.md`. Draft, rejected, and superseded versions do not authorize implementation. A newer draft also does not silently revoke the currently recorded approved version.

In an existing project, follow its established internal-doc convention. If no convention exists, `dev-docs/` is absent and unoccupied, and the user authorized generating or storing a UI prototype, that request authorizes a minimal `dev-docs/README.md` root index plus the standard `dev-docs/design/` subtree without a second directory-choice question. If a root and index already exist, merge only the design link into the current index. Stop when the path conflicts with an existing convention, an occupied directory, privacy or Git rules, or an external delivery boundary. Never create a parallel truth root.

## Large Project Decomposition

For large projects, never ask the agent to implement the whole product at once.

Decompose in this order:

1. Product roles.
2. Core business flows.
3. Modules that support those flows.
4. Complex feature documents for state machines, permissions, payment, refunds, coupons, content review, or other rule-heavy areas.
5. Large stages that each deliver one meaningful flow.
6. Current-stage implementation truth for only the next large stage.

Large stages should be ordered by usable product value, not by technical component order alone. A stage such as "login only" is not a valid large stage unless the product itself is an authentication product.

## Current-Stage Implementation Truth Standard

Create one file per active large stage, normally under `dev-docs/stages/<stage-name>.md` unless the repo already has a better convention.

This section is the single owner of the stage-truth schema and readiness lifecycle. `routes-feature.md` owns when each gate runs; `engineering-execution.md` owns the cross-route stop rule. Do not copy the field contract into another reference.

Required sections:

1. Stage goal.
2. Target user role and complete flow.
3. Source truth documents.
4. Same-class solution evidence from GitHub, official examples, mature open-source products, or comparable product references.
5. Reference comparison: what to learn, what not to copy, business-fit judgment, and how this project should exceed the reference.
6. Third-party integration evidence when the stage depends on an external API, SDK, webhook, OAuth, payment, platform, or cloud service.
7. Monetization/entitlement evidence when the stage touches paid access: paid value, plan, entitlement truth, lifecycle, provider/webhook route, refund/cancel/expiry, quota, and audit.
8. Scope.
9. Non-goals.
10. Sub-stage table.
11. Per-sub-stage done standard.
12. Per-sub-stage validation evidence.
13. Owner files or modules likely touched.
14. Development-entry evidence and chosen owner placement.
15. Execution-depth decision and split recommendation.
16. Product confirmation status.
17. Foundation-impact check.
18. Security, permission, and data requirements.
19. Stop conditions.
20. Git checkpoint rule.
21. Unverified items.
22. Risks and open questions: known risks, product questions still awaiting the user, and unresolved findings promoted from a closed audit report, each with its source and decider. This section is the live owner those findings are promoted into; write `无` when empty rather than omitting it.

### Stage Control Contract

Every materialized stage truth uses one `## 阶段控制` or `## Stage Control` section with these machine-readable bullet fields. Lifecycle states use stable ASCII enums across platforms, and `task_depth` reuses `D0-D3` from `task-risk-gates.md`. The surrounding explanation remains in the project's working language.

| Field | Allowed value and meaning |
| --- | --- |
| `schema` | Exactly `sliver-stage/v2`. |
| `stage_id` | Stable non-empty ASCII identifier. |
| `primary_route` | One canonical route key from `routes-index.md`. |
| `operation` | One operation owned by `primary_route` in `routes-index.md`. |
| `delivery_kind` | One `sliver-task-decision/v1` delivery kind allowed by the exact `primary_route` + `operation` projection. Route, operation, and delivery cannot be mixed independently. |
| `task_depth` | Exactly `D2` or `D3`. `D0`/`D1` cannot materialize stage truth. Depth alone never materializes a stage. |
| `materialization_trigger` | One or more of `cross_owner_drift`, `ordered_nonclosable_transition`, or `durable_handoff_requested`. |
| `risk_lanes` | Stable IDs from `risk-control-gates.md`, or `[]`. |
| `evidence_mode` | `test` or `route`. |
| `test_level` | `T0`-`T4` when evidence mode is `test`; otherwise `null`. |
| `route_evidence_kind` | `audit`, `diagnosis`, `decision`, `design`, `verification`, or `handoff` when evidence mode is `route`; otherwise `null`. |
| `effect_class` | `none`, `local_reversible`, or `controlled`. |
| `operational_mode` | `planned`, `urgent`, or `incident`. |
| `scope_authorization` | `blocked: <reason>`, `confirmed: <evidence>`, or `original_request_authorized: <evidence>`. |
| `authorization_substage` | `pending` while scope authorization is blocked; otherwise it must exactly equal `active_substage`, preventing authorization for an earlier sub-stage from being reused. |
| `product_decision` | `not_required: <reason>`, `confirmed: <evidence>`, or `pending: <reason>`. |
| `active_substage` | One named sub-stage that also appears in the sub-stage plan. It is the only sub-stage currently eligible for execution. |
| `result_status` | `not_started`, `in_progress`, `completed`, `partial`, or `blocked`. Partial and blocked are honest closeout results, not completion claims. |
| `truth_writeback` | `pending` or `complete`. Completion requires `complete`. |
| `migration_state` | `not_applicable` or `reclassified`. |
| `evidence_refs` | A list of current evidence locations or `[]`; the checker validates structure, not truthfulness. |

The `## 调研决策` or `## Research Decision` section must contain `research_status` with evidence or a reason:

- `completed: <evidence>` when same-class or official research is complete.
- `not_required: <reason>` when the feature is project-internal or no credible external comparison would improve the decision.
- `unverified_nonblocking: <reason>` when the missing evidence does not decide feasibility or safety.
- `unverified_blocking: <reason>` when an external contract, provider, market constraint, or architecture fact must be verified before implementation.

This forces a research decision, not universal browsing. Third-party official-contract requirements still come from the Third-Party Documentation Gate below.

When `effect_class` is `controlled`, the action itself must pass `effect-recovery-gates.md`. Do not duplicate its authorization or recovery schema inside the stage file.

### Readiness Gates

Use the same stage truth through all three gates:

1. `plan`: requires a valid v2 Stage Control, `result_status: not_started`, `truth_writeback: pending`, at least one valid materialization trigger, and non-empty stage goal/user flow, current truth/owner, research decision, scope/non-goals, sub-stage table, evidence plan, validation method, and stop/unverified sections. Product decision and scope authorization may still be pending or blocked because writing the plan is not execution.
2. `execute`: requires `result_status: not_started|in_progress`, `truth_writeback: pending`, a non-pending product decision, satisfied scope authorization for the bounded result, no `unverified_blocking` research, one `active_substage` matching the plan, and a valid evidence union. The structural Stage execute gate rejects `effect_class: controlled`: reclassify the next action to the exact local implementation step, or stop and pass the independent action gate before the separate controlled operation. Stage scope authorization never substitutes for that gate. No execute gate, no owner-code change.
3. `closeout`: first collect and return acceptance evidence as a read-only action. Updating the stage owner is a separate exact-target local write governed by `task-risk-gates.md` and `effect-recovery-gates.md`. Only when that write is authorized may the agent set `truth_writeback: complete` and record an `## 实施回写` or `## Implementation Write-Back` section containing actual result, changed owners, plan deviation, fresh evidence references, remaining risk, next sub-stage, and Git checkpoint. Without write authorization, leave `truth_writeback: pending`, return the evidence to the user, and do not claim structural closeout. The checker proves structural closeout only; the current route must independently verify the evidence before any completion claim.

`completed` in the document does not itself permit a completion claim. `partial` and `blocked` may close the work honestly but never permit a success claim. Passing closeout does not authorize the next sub-stage or any external/critical action.

### Stage v1 migration

The checker must return `MIGRATION_REQUIRED` with exit code `3` when the schema is absent, is `sliver-stage/v1`, or an active task-depth field uses a legacy Chinese label. In that state only read, audit, and generation of a migration draft are allowed; plan, execute, closeout, completion claims, inferred risk/effect, reused authorization, and inferred Studio topology are denied.

Migration is an explicit command, never an automatic checker rewrite. It creates a sibling v2 draft and may mechanically copy only goal, scope, non-goals, owner evidence, sub-stage table, and research text. It must not map the old depth, inherit `completed` or `verified`, infer lanes/effects, or reuse authorization. Replace the old truth only after the draft passes the v2 plan gate and every decision is reclassified from current evidence.

Run the structural gates with:

```bash
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode stage --stage-gate plan --stage-file dev-docs/stages/<stage-name>.md
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode stage --stage-gate execute --stage-file dev-docs/stages/<stage-name>.md
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode stage --stage-gate closeout --stage-file dev-docs/stages/<stage-name>.md
```

The checker proves only that the document records a coherent state and evidence references. It uses explicit enums and exact sub-stage identity, not natural-language keyword guessing. It cannot independently prove that authorization is real, evidence is fresh, implementation works, or the next stage is authorized; those still require current conversation, repository, runtime, and validation evidence.

The document is ready for implementation only when a non-technical user can answer:

- What will be usable after this stage?
- What will not be touched?
- What is the next sub-stage?
- How will completion be proven?
- Which changes would require stopping and asking?
- Which existing owner or module is the correct placement, and what alternatives were rejected?
- Does this feature touch foundation, and what exact evidence proves the answer?
- Is this exact work `D0`, `D1`, `D2`, or `D3` under the owner-topology rules, and what evidence prevents choosing a lower or higher depth?
- Did the user confirm the product-visible scope, non-goals, first usable result, and any major trade-off that actually needs their decision?
- Which same-class references were checked, what was learned, what was rejected, and how this project will fit the user's business better?
- Which third-party official docs were checked, what version/date was recorded, what API boundary was chosen, and what remains unverified?
- If paid access exists, what entitlement truth owns access, what lifecycle states exist, and how payment/refund/cancel/expiry are verified?

## Proactive Project Health Lanes

When the current stage is unclear, audit these lanes before selecting the next route:

| Lane | What to check | Common next route |
| --- | --- | --- |
| Product | user, core flow, MVP, non-goals, acceptance | `立项` or `拆分` |
| Docs | truth root, active docs, stale/conflicting docs, current-stage truth | `整理开发资料` or `阶段计划` |
| Foundation | source coverage, architecture drivers, quality scenarios, framework-native fit, current official evidence, operational simplicity, AI maintainability, migration cliffs | `技术选型` |
| Runtime/startup | package manager, versions, scripts, env placeholders, local services, ports, first visible proof | `环境启动` |
| Frontend | style route, token truth, UI library, routing, components, responsive states | `前端骨架` |
| Database | business objects, schema/migrations, relationships, transactions, backup | `数据库设计` |
| Backend | responsibility boundary, architecture truth, skeleton, API contract | `后端工程`, `后端工程`, or `后端工程` |
| Security | auth, permission, ownership, input trust, secrets, logs, dependencies, release exposure | `安全审计` for an audit goal; `security-impact` lens during development |
| Third-party | official docs, SDK/API route, sandbox, webhook, quota, billing | `开发执行` with `third-party-provider` lens |
| Monetization | paid value, plan/order/subscription, entitlement, quota, refund/cancel/expiry, webhook truth | `开发执行` with `monetization-entitlement` lens |
| AI debt | duplicate code, mock data, custom wrappers, unused files, dependency sprawl, inconsistent patterns | `AI债务体检` |
| User acceptance | click path, expected states, failure signs, user evidence request | `用户验收陪跑` |
| Stage or quality acceptance | stage truth, happy path, negative cases, role cases, data effects, regression | `验收` with the matching operation |
| Git/privacy | repo root, ignore policy, internal docs, secrets, checkpoint | `git保护` |
| Deployment/release | platform route, env, build, deploy, migration, rollback, monitoring, cost, handoff | `部署路线` then `发布准备` |

Choose one primary next route after the audit. Do not ask the user to choose from the whole map.

## Normal Development And Foundation Impact Gate

Every requested project change enters `开发执行`. The intent, owner, execution-depth, and foundation-impact decisions are internal stages of normal work, not a separate user command before coding.

The goal is to avoid hidden foundation changes. A small user-facing feature can still change core architecture if it introduces new auth rules, new ownership rules, new data fields, new API contracts, new providers, or a new directory pattern.

If no current-stage implementation truth exists, `D0`/`D1` work may still
proceed with an inline acceptance contract. `D2`/`D3` work creates or updates
durable truth only when cross-owner drift, an ordered non-closable transition,
or a durable handoff requires it. Protected risk adds its own narrow control
and evidence; it never materializes a stage or changes depth by itself.

The AI must choose one owner placement:

- Reuse an existing owner module.
- Extend an existing page/component/service/API.
- Add a sibling module that follows current conventions.
- Add a backend endpoint or service boundary.
- Add a schema/migration inside the current data model.
- Add a third-party adapter after official documentation review.
- Redesign foundation after the user approves the product-visible trade-off and consequences.
- Stop because owner evidence is missing or contradictory.

Prefer the smallest owner placement that completes the user's business result while respecting current architecture. Do not create a parallel system because it is faster in the moment.

Stop and ask only when the unresolved choice changes the user-visible result, scope, cost, irreversible data effect, or major foundation trade-off. The AI must decide and explain risk level, owner placement, architecture, and validation method instead of handing technical judgment to the user.

Also stop before coding when:

- A protected boundary or controlled action lacks its required narrow control, authorization, or recovery evidence.
- `D2`/`D3` work meets a stage-materialization trigger but the relevant durable truth is missing or contradictory.
- The user-visible behavior or non-goals remain materially ambiguous.
- Execution depth cannot be classified from current docs, code, runtime evidence, and user answers.

## Task Depth And Decision Gate

Use `task-risk-gates.md` before applying full feature governance when the request may be small. This prevents copy, README, poster, local style, or docs-only edits from being treated like database/auth/payment work.

Task depth has one owner: `task-risk-gates.md`. Use only `D0`, `D1`, `D2`, and `D3`; do not redefine them here. Stage materialization depends on drift, ordered-transition, or durable-handoff evidence, not a depth label alone. Every depth still requires current evidence, clear scope, proportional professional judgment, fresh validation, and a clean Git boundary.

When an active stage document owns an executable multi-stage plan, it is also the plan artifact consumed by `plan-artifact.md`. Update that same file on corrections, step transitions, evidence changes, stop, compaction, and handoff; never create a parallel progress owner.

## Same-Class Solution Scan

Before writing the current-stage implementation truth document, prefer checking same-class solutions when the stage belongs to a mature problem space.

Good sources:

- GitHub repositories with active maintenance and clear docs.
- Official framework examples.
- Mature open-source products in the same category.
- Public product flows or docs from comparable products.

The goal is not copying. The goal is to avoid blind invention, understand common boundaries, then design a better fit for this user's business.

Record:

- Source.
- Why it is comparable.
- Useful pattern.
- Risk or mismatch.
- What not to copy.
- Business adaptation.
- How this project should be simpler, clearer, safer, more focused, or more valuable.

If current search is unavailable, mark the reference scan `未验证` and either proceed with local evidence only or ask the user to provide references.

## Third-Party Documentation Gate

Any stage involving a third-party provider must load the `third-party-provider` lens inside `开发执行` before implementation truth is final.

The implementation truth must record:

- Official docs source.
- Checked date.
- API or SDK version.
- Auth method.
- Required configuration.
- API boundary.
- Webhook/callback behavior.
- Error and retry handling.
- Rate limit or quota risk.
- Security and secret handling.
- Sandbox/test plan.

If official docs cannot be checked, mark the item `未验证` and do not present the integration as ready.

## Truth-Document Order

Prefer these files, adjusting names to local convention:

1. `dev-docs/project-brief.md`
2. `dev-docs/function-list.md`
3. `dev-docs/stage-plan.md`
4. `dev-docs/technical-selection.md`
5. `dev-docs/architecture.md`
6. `dev-docs/frontend-architecture.md`
7. `dev-docs/design/README.md` and `dev-docs/design/prototypes/<feature>/prototype.md` when a UI prototype lifecycle is active.
8. `dev-docs/database-design.md`
9. `dev-docs/backend-boundary.md`
10. `dev-docs/backend-architecture.md`
11. `dev-docs/security-boundary.md`
12. `dev-docs/stages/<stage-name>.md`
13. `dev-docs/features/<feature>.md` with `dev-docs/features/README.md`, only for a feature whose internal rules, states, dependencies, or owner span exceed one sentence in an existing owner (created through `truth-capture.md`).
14. `dev-docs/decisions/adr-<id>.md` with `dev-docs/decisions/README.md`, only for a costly or later-questioned choice of A over B (created through `truth-capture.md`; changes supersede, never rewrite).
15. `dev-docs/monetization.md`
16. `dev-docs/runtime.md`
17. `dev-docs/quality/<stage-or-feature-name>.md`
18. `dev-docs/acceptance/<feature-or-stage-name>.md`
19. `dev-docs/audits/<YYYY-MM-DD>-<scope>.md` with `dev-docs/audits/README.md` (written through `audit-artifact.md`; append-only ledger).
20. `dev-docs/ai-debt.md`
21. `dev-docs/deployment-route.md`
22. `dev-docs/release/<release-name>.md`

Do not force these exact paths if the repo already has a clear convention. The
`features/`, `decisions/`, and `audits/` directories are created with their
first document and index, never pre-created empty.

## Truth Ledger Boundary And Index Rules

Documents may keep growing; the truth the agent reads per session may not.

- **Truth versus ledger.** Items 1-16 and 20-22 above establish current truth.
  `quality/`, `acceptance/`, and `audits/` are append-only ledgers: they record
  what was checked and found at one time, and they are never read to establish
  what the project currently is. An unresolved finding leaves the ledger only
  by promotion into one live owner (`ai-debt.md`, or the "风险与未决问题" section
  of the affected stage or feature document) through a separately authorized
  truth update before audit closeout. Completed reviews awaiting that update
  stay `reviewed_pending_promotion` and indexed `open`.
- **Index is the entry.** `features/README.md`, `decisions/README.md`, and
  `audits/README.md` each hold one line per document (path, title, status,
  affected owners). The function list links each feature document; the
  decisions index lists `active` records by default; the audits index lists
  `open` reports by default. Reach a document from its index or from the
  current owner closure. Reading `features/`, `decisions/`, or `audits/` as a
  whole directory is never a discovery step, in any route.
- **Depth and modules.** Directory depth under the truth root stays at two.
  When `architecture.md` names modules and a directory grows past its budget,
  split as `features/<module>/` with one index per level.
- **Status and archive.** Feature, decision, and audit documents carry
  frontmatter `status: active | superseded | archived` (audits use
  `open | closed | archived`). Only `整理开发资料` moves documents into a sibling
  `archive/` after user approval; `archive/` is excluded from default reads, the
  default index view, and guardrail active checks. Archiving is never deletion.
- **Multiple deployable units.** When `architecture.md` defines independently
  deployable units, each unit may own a `dev-docs/<unit>/` sub-root with the
  same index and budget rules and a top-level index linking them. Two sub-roots
  may not each hold a project brief or a technical selection; those stay at
  the top.
- **Budgets and compaction.** Size thresholds and the Compaction Offer are
  owned by `project-intake.md`; consolidation decisions (`merge_into`,
  split) are owned by `truth-capture.md`.

## Truth Root Selection

`dev-docs/` is the preferred internal truth root only when it is absent or already used for internal development material.

If `dev-docs/` does not exist:

- Search for an existing internal-doc convention first.
- If none exists, propose `dev-docs/`.
- Create it only after user confirmation, except that an authorized UI prototype request may materialize the minimal `dev-docs/README.md` plus standard `dev-docs/design/` subtree when no convention, occupied path, privacy/Git conflict, or external-delivery conflict exists.

If `dev-docs/` exists but is not development material:

- Do not repurpose it.
- Treat it as occupied.
- Propose another internal truth root, such as `internal-dev-docs/` or `docs/internal/`, matching repo style.
- Record the decision in the truth index.

If docs are messy:

- Create a docs inventory first.
- Mark files active, stale, conflicting, duplicate, public, or unrelated.
- Build a truth index before moving files.
- Ask before archiving, moving, deleting, or rewriting.

`features/`, `decisions/`, and `audits/` follow the Truth Ledger Boundary And
Index Rules above: each appears with its first document and its README index,
under the same truth root, never as a second root.

## Template Materialization

Use templates only when they reduce ambiguity and create usable truth.

Rules:

- Empty projects use the bootstrap template set only after the project root and privacy/Git boundary are clear.
- Existing projects use the adoption template set only after a read-only audit. Do not treat a half-built repo as empty.
- UI prototype work may add the shared `assets/project-design/` template only after the active truth root is known. For an existing root, merge its `dev-docs/design/` subtree into `<truth-root>/design/` and add only the design link to the current root index; do not replace that index or create a second truth root.
- Do not copy template text as final truth. Replace generic fields with current file paths, owners, commands, risks, and user decisions.
- If a field cannot be known from files or user answers, write `未验证` and ask the smallest blocking question.
- When generating `AGENTS.md`, still follow `agent-constitution.md`: evidence pack, owner map, clause mapping, validation command map, then final draft.
- If `dev-docs/` is missing, occupied, or messy, run the development-docs audit before creating template files.
- If the truth docs are private, decide whether to keep them out of the public code remote before the first push.

## Project Guardrail Check

After creating or changing bootstrap/adoption/constitution/stage truth, run the structural guardrail when a local project path is available:

```bash
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode bootstrap --foundation-gate contract
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode adoption --foundation-gate contract
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode constitution
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode stage --stage-gate plan --stage-file dev-docs/stages/<stage-name>.md
```

The bootstrap/adoption/constitution modes check required files, headings, links, placeholder fields, obvious drift markers, and suspicious private filenames. Foundation work must then explicitly pass `--foundation-gate recommendation` before a primary recommendation and `--foundation-gate implementation` before foundation owner code. Stage `execute` or `closeout` does not silently waive a required foundation gate. All readiness is structural evidence-contract proof only; stage and foundation gates do not independently prove that the implementation works, that the user approved the plan, that cited evidence is true, or that security is safe.

If the guardrail fails:

- Fix missing structure before coding when the task depends on that truth.
- If the failure is intentional because the repo uses another proven convention, document the evidence and use `--truth-dir <dir>`; ask only when changing the convention would alter product scope, privacy, delivery, or another user-visible boundary.
- Do not hide placeholder or empty-field failures by calling them "template style" in a real project.

## Existing Project Entry Algorithm

1. Inspect repo boundary, Git status, package files, framework files, docs, tests, run commands, env examples, and startup evidence.
2. Summarize what exists and what is missing.
3. If the project cannot start or startup is unknown, choose `环境启动` before feature work.
4. Review whether the current combined stack, framework-native structure, architecture, data, runtime, deployment, SDK, and third-party route fit the project.
5. If the foundation may be mismatched, run `技术选型`. Close blocking product facts one at a time, research mutable technical facts from current primary sources, compare complete candidate combinations, and recommend one of keep, repair, local replacement, staged migration, or immediate stop. Ask the user only to confirm product impact, cost, disruption, downtime, lock-in, or irreversible migration effects.
6. Audit whether AI-generated debt blocks safe continuation.
7. Map the project to the earliest unstable stage.
8. Preserve the goal already expressed by the user. Ask only if several materially different goals remain possible after inspecting current evidence.
9. Choose one primary workflow internally; normal add/change/fix/refactor work uses `开发执行`.
10. Keep the first action read-only only when the user did not request implementation or current truth is insufficient to act safely.

## Context Handoff

Run `上下文交接` when:

- The conversation is too large and the user wants to continue in a new window.
- Another agent or teammate will continue the project.
- A stage is partially complete and continuing without a written handoff would rely on chat memory.
- Release, deployment, or customer handoff is being prepared.

Use `references/context-handoff.md`. The handoff must include current git state, latest commits, changed files, validation evidence, missing evidence, runtime state, active truth docs, drift warnings, and exact next safe commands.

A handoff records state; it does not make conversation conclusions durable.
Before the handoff is written, run the Truth Capture Gate in
`truth-capture.md` so that confirmed product, design, or architecture
conclusions are proposed for their real owners instead of surviving only inside
the handoff note.

## Drift Control

Use `防漂移` when:

- The current plan disagrees with a truth document.
- The AI proposes extra features not in the current stage.
- A request affects stack, schema, permissions, payment, auth, directory architecture, or core data fields.
- A change has no proven owner placement or silently changes foundation.
- A proposed feature quietly switches framework, SDK, provider library, or technology stack.
- Validation evidence contradicts claimed completion.

Handle drift by writing:

1. What changed.
2. Which truth document is affected.
3. Whether it touches foundation.
4. Options: reject, update truth document, redesign stage, or stop for user decision.
