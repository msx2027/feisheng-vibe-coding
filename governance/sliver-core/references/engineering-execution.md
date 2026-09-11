# Engineering Execution Backbone

Use this as the detailed shared execution and UX-judgment backbone after the route and loading decision is made.

This file is conditional for `开发执行`: bounded mechanical `D0` work uses `development-execution-core.md`; `D1`-`D3`, non-mechanical implementation, and impact conditions named by the route registry load this detailed owner. The route-global `frontend-design` lens also loads this owner for UX analysis, audit, explanation, recommendation, design, or validation even when no edit is authorized. Match governance to owner topology and add only the controls required by active risk/effect boundaries, but never drop source truth, owner discipline, verification, or git hygiene.

## Current-Truth Audit

Before changing code or docs, inspect current truth at the smallest useful scope:

- Current git status, repo root, ignored/nested repo boundaries when staging or publishing.
- Repo-local agent constitution and any host-specific entry files that point to it.
- Active `dev-docs/README.md`, `docs/README.md`, stage truth, architecture truth, contracts, schemas, generated sources, tests, scripts, logs, and nearby owner patterns.
- Current source files and call chain for the touched surface.
- Current user statements and corrections, classified by the User Correction Evidence Gate instead of being promoted automatically to project truth.

Current files, tests, scripts, schemas, logs, live evidence, and git state beat memory, old summaries, and old chat transcripts. If current truth conflicts with history, report the conflict before coding.

## User Correction Evidence Gate

User disagreement is a re-audit signal, not proof that the user's replacement is correct. Before agreeing, reversing a decision, renaming a concept, or updating project truth, classify the disputed proposition as exactly one of:

- `product decision`: a choice about the user-visible outcome, scope, cost, downtime, migration, lock-in, data loss, or another irreversible effect. The user owns this choice. Once it is explicit, record it and remove the rejected product alternative.
- `observed fact`: a claim about current code, configuration, data, hardware, runtime behavior, provider state, or another externally observable condition. Evidence owns the verdict. Inspect the smallest sufficient current truth; when it cannot be checked, mark it `unverified`.
- `technical proposal`: a field or table name, owner, schema, module boundary, algorithm, framework, SDK, protocol interpretation, or implementation route. The AI owns the recommendation and must judge it against current truth, owner/contract coherence, and verification evidence. It may reject the user's proposed implementation while preserving the user's desired product result.
- `preference or feedback`: a request about communication, workflow, wording, pace, or dissatisfaction with the answer. Adjust the collaboration or run a deeper audit, but do not treat it as technical evidence.

Do not say “you are right” or an equivalent agreement until the disputed proposition, its class, and its supporting evidence are explicit. Return one evidence-calibrated verdict: `correct, incorrect, partially correct, or unverified`. Evidence, not confidence or conversational authority, decides observed facts and technical proposals.

Emotional pressure, repetition, confidence, insults, or criticism only increase the depth of the re-audit; they do not lower the evidence threshold or change the technical verdict. If the evidence changes, state what new evidence changed the verdict. If it does not, keep the conclusion and explain the conflict plainly.

When successive user corrections conflict, preserve the last evidence-backed conclusion, name the contradiction, and reopen current truth plus the owner/contract decision. Do not create a new field name, table, module, compatibility alias, or technical route merely to satisfy the latest message. A universal owner cannot silently absorb a domain-specific name; a rename must still pass semantic fit, existing-contract, caller/consumer, migration, and acceptance checks.

Truth write-back happens only after the correction closes: record the final proposition, classification, evidence, verdict, decision owner, superseded alternative, affected owner/contract, and validation path in the active truth document when the task requires durable truth. Remove a rejected concept only when it is either an explicit user-owned product decision or an evidence-backed observed/technical conclusion; otherwise keep the conflict visible as `unverified` instead of repeatedly rewriting the design.

## UX Judgment Contract

This is the single semantic owner for judging a user-visible interaction. It applies before any UX analysis, audit, explanation, recommendation, design, implementation, or validation. `ui-design-lifecycle.md`, `frontend-skeleton.md`, `routes-feature.md`, `project-flow.md`, and validation routes consume this decision; they must not define a second user-journey or mature-pattern owner.

Start from what the person believes they are using and the result they came to obtain. Do not start from a backend state machine, schema, wallet state, retry lineage, orchestration ledger, provider object, or another implementation concept and translate every known state into UI. System-owned complexity stays hidden by default. A system concept becomes visible only when it serves a named user decision, action, recognition, orientation, trust, or recovery need.

For the smallest relevant current surface or flow, record or state all of the following before giving a UX verdict:

- `operation`: `analyze | audit | explain | recommend | design | implement | validate`, plus whether writes, prototypes, browsing, or runtime interaction are authorized;
- `evidence boundary`: current product/flow owner, actual inspected source or runtime evidence, and a strict split between `observed`, `inferred`, and `unverified` claims;
- `user task`: one primary user, one single job, and one observable success signal;
- `interaction model`: the familiar product pattern, user-recognized objects, user-controlled actions, and the expected result of each action using the same user verb from control to result;
- `system concept projection`: every relevant internal concept is either `hidden_internal`, `progressive_disclosure`, or `user_visible`; the latter two require a concrete user need and visible element;
- `mature pattern`: first inspect a concrete same-role surface in the current product. If none exists and current research is authorized and necessary, inspect a mature same-class pattern in a real product or official platform, recording source, inspection date, comparable behavior, and the part that must not be copied. If neither is available, mark the pattern evidence `unverified`; never invent one;
- `journey`: entry, preconditions, primary action, system response, success, next action, and an explicit decision for cancel/back, error recovery, refresh/resume, deep link, and role handoff;
- `result`: evidence-backed findings, one recommended user-visible outcome, non-goals, and the exact unresolved product decision if one remains.

A screenshot can support layout, hierarchy, and visible-state observations only. It cannot prove navigation reachability, keyboard behavior, async state order, failure recovery, refresh/resume, or end-to-end completion. Source inspection can establish implemented branches but not prove a usable runtime journey. Preserve these evidence planes in the answer.

Mature behavior is the default, not a decorative inspiration board. A deviation is allowed only when current product truth or evidence shows why the familiar pattern would fail this user task; name the benefit, cost, and evidence. “More modern”, implementation convenience, schema completeness, and exposing every recoverable state are not evidence. Replacing domain nouns while preserving the same interaction topology must not change the governance verdict.

When the user corrects one step, replay the full journey and its boundaries against current evidence before changing the recommendation. Do not locally flip the answer while leaving entry, success, next action, or recovery inconsistent. If the corrected proposition remains unverified, say so and keep the prior evidence-backed parts stable.

## Reasoning Gate

Close this gate before `D2`/`D3` coding, and use the compact reasoning gate for `D0`/`D1` when owner or validation is not obvious.

1. What problem is actually being solved?
2. Who creates this concept?
3. Who calls it?
4. Who consumes it?
5. What is the current source of truth?
6. What is the single owner layer, module, schema, service, state store, adapter, or truth document?
7. Which layers are forbidden owners for this concept?
8. Which `T0`-`T4` Test Gate level applies, which tests are affected, and what is the smallest gate that would catch the expected failure or regression?

No closed reasoning gate, no implementation.

If the answer is "we can extract it later", the owner is not closed. Stop and place the concept in the right owner now.

## Hard Execution Gates

These gates are mandatory after route selection. Governance scales with task topology; protected risk and effects add only their relevant gates.

| Gate | Stop condition | Required response |
| --- | --- | --- |
| Current Truth Gate | Current truth is missing, stale, or conflicts with memory/chat/screenshots | Read repo files, docs, runtime evidence, and git state first; when sources conflict or the answer depends on current external executability, load `truth-resolution.md`, resolve by question plane, and report an open conflict as `unverified` before acting |
| User Correction Evidence Gate | A user correction, disagreement, replacement proposal, or criticism would change facts, technical design, naming, owner boundaries, or project truth without classification and evidence | Classify the proposition, re-audit the smallest sufficient current truth, return an evidence-calibrated verdict, and update truth only after the decision owner and contradiction are closed |
| Explicit Exclusion Scope Gate | A proposed write, broad “all changes” instruction, audit-with-remediation request, or continuation may intersect a path, owner, artifact, or surface that the user previously excluded | Preserve the named exclusion until explicitly rescinded; project the proposed and excluded targets into Task Decision scope, validate them against Host/Coordinator context, and stop the intersecting write instead of treating broad language as revocation |
| Intent Confirmation Gate | Two or more reasonable readings would produce a materially different user-visible result, scope, data rule, permission rule, payment rule, release path, core workflow, or delivery shape | Stop direct implementation; offer 2-3 plain-language choices based on current truth, recommend one option, and wait for the user's choice. Do not trigger this gate for technical details that preserve the same visible result. |
| Delivery Shape Lock | The requested result is clear, but the allowed UI/product surface, unchanged regions, reference role, concrete stable reference surface, device behavior, meaning-changing visible-copy scope, or stop point is not yet bounded | Record the smallest delivery-shape contract: allowed changes, required invariants, source/reference role, responsive semantics, the source for meaning-changing visible copy when applicable, and stop point. For a non-mechanical existing-project UI change, validate its allowed/unchanged/owner boundary with `runtime_governance_contract.py`. After the result is confirmed, optimization, responsive work, or best practice is not permission to redesign it. |
| Project UI Context Gate | UI design or design-to-code work has not read current layout, token, component, icon, theme, breakpoint, adjacent-page, or active prototype truth | Load the `frontend-design` lens and inspect the current UI owners before generating or implementing a design; a greenfield project establishes only the minimum visual foundation |
| Prototype Truth Gate | A generated or selected design is unversioned, unindexed, unapproved, rejected, superseded, or only present in chat/tool output | Use `ui-design-lifecycle.md`; materialize the prototype under the selected truth root and implement only its recorded approved version |
| Design Decomposition Gate | Design-to-code work has no component-reuse decision, asset boundary, semantic element plan, theme/responsive obligation, or interaction-state plan | Decompose the approved prototype before code; do not use a flattened image, screenshot slices, transparent hotspots, or a parallel component system |
| Professional Design Gate | The request has only been paraphrased, or relevant user flow, states, roles, data rules, failure behavior, edge cases, owner placement, acceptance, or non-goals have not been professionally considered | Complete the design at the depth the task needs; recommend the coherent product/technical route and ask the user only about choices that change the visible result, cost, scope, or irreversible effects |
| Owner/Contract Gate | Owner layer, contract, schema, state source, truth document, or dependency direction between a stable surface and a new consumer is unclear | Close the owner boundary and name forbidden owners before implementation; a stable shared default is upstream and a new UI consumer adapts downstream unless a controlled baseline evolution is explicitly justified |
| Studio Recommendation Gate | User-visible multi-task orchestration is being suggested or requested without the capability, task-graph, unique-writer, stable-contract, environment, acceptance, coordination-benefit, and user-confirmation evidence owned by `studio-execution.md` | Do not create work rooms; load `references/studio-execution.md`, return `recommend_studio`, `do_not_recommend`, or `resolve_boundaries_first`, and obtain confirmation for the bounded topology |
| Acceptance Gate | `D2`/`D3` work has no agreed behavior, non-goals, stop point, or validation method | No acceptance contract, no multi-owner or foundation implementation; write or propose the acceptance contract first |
| Stage Readiness Gate | Work requiring durable stage truth has not passed the matching `plan`, `execute`, or `closeout` gate owned by `project-flow.md` | No owner-code change before `execute`; no sub-stage completion claim before truth write-back and `closeout` |
| Blocking Review Join Gate | A known audit or review can veto the result or require rework, but formal materialization is about to start before that reviewer has returned | Start and join the blocking reviewer first. Immediately before the formal event, validate `formal-materialization.md` against the Coordinator-authenticated complete review set, current source/input binding, and single writer lease. Discovery, probes, drafts, and disposable preparation may run in parallel. |
| Security Impact Gate | The change may affect identity, permission, data ownership, input, money, status, database writes, secrets, third parties, uploads, public exposure, resource limits, or release settings, but the impact has not been classified | Apply `references/security.md` Security Impact Checklist, add only the relevant negative cases and evidence, or explicitly record that no security boundary changed |
| Bug Evidence Gate | Symptom is not reproduced, failing boundary is unknown, or root cause is guessed | No reproduction, no bug fix; capture reproduction, failing boundary, and a single hypothesis with disproof step |
| Test Decision Gate | The change has no recorded `T0`-`T4` classification, affected-test map, pre-change evidence, or post-change gate | Apply `references/testing-strategy.md`; no Test Gate Classification, no owner-code change. Test-framework presence alone cannot decide the level |
| Strict TDD Gate | A `T2` stable behavior, deterministic bug, or automatable high-risk contract is about to change without a meaningful failing test first | No `T2` production change without observed RED; then implement the minimum owner fix, observe GREEN, and run the mapped regression surface |
| Evidence Before Completion | Verification is old, partial, unrelated, or only inferred from code review | Require fresh verification output; No fresh verification, no completion claim; stale output is not evidence |
| Review Gate | Major feature, high-risk change, PR, release, or merge is about to proceed without a focused review | Review diff against requirements, owner boundaries, validation evidence, and remaining risks before integration |
| Three-Fix Gate | The same problem has failed three fix attempts or each fix exposes a new boundary issue | Three failed fixes reopen architecture; stop local patches and run an architecture/truth audit before any Fix #4 |

For ordinary engineering tasks, the gates are lightweight but complete: current truth, intended result, relevant professional considerations, owner and validation path, a compact Test Gate Classification, a minimal reproduction or check when relevant, targeted verification, and a clean git boundary. Do not require current-stage implementation truth for a clearly local one-owner change.

### Blocking Review Join Gate

Classify a planned review or audit by phase and effect, not by whether it is
read-only:

- `pre_materialization_input_review`: it can veto or require rework of current
  inputs, owner placement, architecture, or source implementation, so it is
  blocking before formal materialization;
- `post_materialization_acceptance`: it requires the produced artifact to
  inspect playback, rendering, packaging, runtime, or user-visible output. It
  does not block first materialization, but it blocks acceptance, release, or
  publication until it passes;
- `non_blocking_observation`: it only observes or summarizes a fixed boundary
  and cannot invalidate source or produced artifact.

All known `pre_materialization_input_review` reviewers must start early enough to affect the work and must
join before formal materialization begins. Formal materialization includes the
render, export, package, archive, signed build, deployment candidate, or other
expensive deliverable that would be handed to the user as the result. Reversible
discovery, probes, source edits, drafts, and disposable preparation may continue
while review runs when they do not create a competing writer or a falsely final
artifact.

If blocking review returns rework, integrate it at the owning source before
materializing. The invariant is: source or accepted input changes invalidate earlier downstream artifacts, which must be rebuilt and revalidated. Each formal artifact has one writer; compression, transcoding, packaging, or export must not race another
writer for the same output. This gate never moves
`post_materialization_acceptance` before the artifact it needs, never treats
post-build playback or visual inspection as an input review, and does not
prevent runtime-failure recovery or serialize `non_blocking_observation` work.

The executable event owner is `references/formal-materialization.md` and
`scripts/runtime_governance_contract.py`. Missing, `interrupted`, `failed`,
stale, or extra review records fail closed, as do a missing writer lease or
more than one active writer. The expected review set, current source revision,
accepted-input digest, artifact identity, and active writer identities come
from Host/Coordinator context outside the candidate record.

The Security Impact Gate is always a decision, not always a full process. No relevant security boundary, no full security ceremony. When a boundary is touched, security checks happen automatically inside the current task even if the user never says "security". A separate `安全审计` remains read-only by default and audit does not authorize remediation.

For `D2`/`D3` tasks, code without acceptance is a drift source. Do not implement until the current truth, owner/contract direction, validation method, and first stop condition are explicit.

When intent is ambiguous, offer plain-language choices. Ambiguity matters when reasonable interpretations lead to a materially different user-visible result; implementation details that preserve the same user-visible outcome remain AI-owned technical judgment. When using the Intent Confirmation Gate, do not present a technical menu. Each option must state the user-visible outcome, what will not change, why it is or is not recommended, and the risk of choosing wrong. This applies to ambiguous delivery shape, data, permission, payment, release, or core workflow, not only UI wording.

For any materially ambiguous request, code without the product-visible intent choice is a drift source. Depth does not determine whether ambiguity is safe.

After intent is clear, apply the Delivery Shape Lock before user-visible implementation. A screenshot or existing screen must be classified as a finished-product source, structural source of truth, style reference, or diagnostic evidence; never silently choose its authority. The lock names the target surface, unchanged regions, information hierarchy, module order, navigation model, interaction steps, device-specific semantics, visual direction, and stop point only to the extent they affect the requested result. A clear local request uses the smallest scoped implementation and does not require ceremony for unrelated details.

For every non-mechanical UI change in an existing project, the Delivery Shape Lock first selects the closest concrete stable reference surface from the same-role mature UI when one exists and records the real repository path or captured artifact that proves it. Evidence described only as generic project style or token reuse is insufficient. If no same-role surface exists but stable layout, token, component, theme, and breakpoint owners do, bind those constraints into one reviewable visual target. Only a genuinely unbound visual direction calls for distinct visual options before implementation; do not force that ceremony onto a mature product.

The selected same-role mature surface is the default visual target, not an invitation to invent a parallel style.

Encode the lock as the single executable schema
`sliver-delivery-shape-lock/v3`. Do not retain v1 or v2 as a compatibility path.
Any new or materially changed field, action, status, navigation, content block,
data view, or permanent copy requires a `pre_implementation` record before
owner edits, even when no prototype is generated. The record binds:

- one primary user, one single user job, and one observable success signal;
- the familiar interaction pattern, user-recognized objects and actions, the
  expected result of each action, system-concept visibility decisions, and an
  evidence-backed reason for any mature-pattern deviation;
- the complete journey from entry through system response, success, and next
  action, with explicit `applicable | out_of_scope` decisions for cancel/back,
  error recovery, refresh/resume, deep link, and role handoff;
- owner and constraint paths, allowed and unchanged regions, and the proposed
  subset;
- only introduced or materially changed elements, each with a named user need,
  source owner, display condition, and
  `primary | contextual | advanced | hidden_internal` visibility;
- the concrete stable reference's role, kind, identity, and SHA-256, or the
  explicit constraint-owner set when no comparable surface exists;
- applicable interaction states and the viewport, visual-comparison, DOM,
  keyboard, and focus obligations needed for acceptance.

Source availability is not display authority. When an API, configuration, or
backend schema feeds the UI, the source schema projection must close every
Host-provided field as
`visible | derived | defaulted | advanced | omitted_internal | out_of_scope`.
Visible, derived, and advanced fields point to a declared element; internal,
defaulted, and out-of-scope fields do not. `hidden_internal` elements use a
never-visible condition. Do not replace this semantic decision with field,
card, or word-count limits, domain keyword rules, or a copy blacklist.

The Host/Coordinator supplies `--context` and authenticates the target,
owners, phase, source revision, pre-lock digest, source-field set, stable
reference, and expected evidence. The candidate cannot self-authenticate a
reference with an arbitrary string. Run
`python3 -B scripts/runtime_governance_contract.py --kind delivery-shape
--record <record.json> --context <context.json>`; missing context fails closed.

Acceptance reuses the same record with phase `acceptance`, and its normalized
pre-implementation fields must hash to the Host-bound pre-lock digest. It binds
the current source revision, a reference and candidate evidence pair at the
same viewport, state, and theme, a DOM or accessibility snapshot, applicable
interaction trace, changed-region proof, unchanged-region evidence, and an
independent review. A screenshot proves only the visual plane; build success or
one screenshot cannot prove information hierarchy, semantic DOM, keyboard,
focus, responsive behavior, or interaction states. If the Host cannot enforce
the pre-action hook or authenticate this context, report
`Host enforcement: UNVERIFIED` rather than claiming a hard prevention.

A bounded `D0`/`D1` spacing, color, copy, clipping, or state correction may use the touched owner and current rendered surface as its inline baseline. It does not require a prototype, baseline form or durable document. Routine copy stays inside the confirmed behavior and current terminology; only meaning-changing copy activates the separate authority check below.

Treat an already stable surface, shared component default, or project-wide UI contract as upstream: a new UI consumer adapts downstream. Do not change shared defaults or already stable consumers merely to make the new consumer convenient. Evidence that the baseline itself is defective reopens the baseline decision but does not by itself authorize changing existing consumers; if the correction would alter non-target consumers, the current request must cover that product-visible scope or the user must confirm the expansion. For an authorized correction or system-wide redesign, evolve the baseline as a controlled shared change: enumerate affected existing consumers, bound the migration, collect before/after regression evidence for them, and state the rollback boundary. Stability is not permission to freeze a proven defect.

Visible copy needs a separate product authority decision only when it changes product meaning, makes a promise, introduces policy, materially changes risk disclosure, or creates legal or accessibility obligations. Routine labels, concise help, and recovery text may be authored by the implementation owner from the confirmed behavior, current product truth, and established terminology without asking the user to approve each string. Considering loading, empty, error, disabled, or risk states does not by itself authorize permanent explanatory commentary. Express the same fact through one primary channel; use contextual or progressive disclosure for necessary detail instead of repeating it across headings, banners, warnings, empty states, and disabled controls.

## Universal Execution Sequence

Use this order whenever implementation is allowed:

1. `current-truth audit`
2. `user-correction classification and evidence verdict when disputed`
3. `intent reconstruction`
4. `intent confirmation when visible outcomes differ`
5. `delivery-shape contract for user-visible work`
6. `project UI context / prototype truth / design decomposition when applicable`
7. `professional design at the required depth`
8. `reasoning gate and owner/contract decision`
9. `conditional development lenses`
10. `security impact decision`
11. `test decision (T0-T4) / affected-test map / fixture / gate plan`
12. `blocking review classification and join before formal materialization`
13. `execute readiness gate when durable stage truth is required`
14. `owner-layer implementation`
15. `thin adapter / UI / CLI / API wiring`
16. `targeted verification`
17. `doc write-back and closeout readiness when required`
18. `git boundary review`

Do not start from UI, route handlers, controllers, prompts, temporary scripts, local mocks, or compatibility branches and then reverse-engineer the core. If a concept is shared by two or more entry points, put shared semantics in the owner layer first.

When work materializes stage truth under `project-flow.md`, a named sub-stage is required before execution. Depth alone does not create that requirement.

## Owner-Layer Rules

- Shared business semantics belong in a core service, repository, schema, contract, registry, policy, state owner, domain module, or framework-approved owner.
- Protocol, HTTP, CLI, MCP, WSS, webhook, provider, and UI layers should be thin adapters over typed contracts or backend truth.
- Generated framework contracts must be changed at their source and regenerated. Do not hand-edit generated files when a generator exists.
- UI state is draft/display state unless the project explicitly makes it the source of truth.
- Mock files, local fallback data, prompt text, and screenshots are never core business authority. A screenshot may still own confirmed delivery-shape structure under the Delivery Shape Lock; it cannot invent data, permission, state, or backend truth.
- Reuse existing local helpers, validators, repository patterns, design tokens, component skeletons, framework conventions, and generated contracts before inventing a new pattern.

## Internal Capability Providers

Admitted internal skills are bounded capability providers under this backbone. They return findings,
options, or a proved diagnosis; they never select a route, set task depth, classify action effect,
declare the failing layer, or write project truth, and loading one never replaces an owner in this
reference set or the Sliver validation gate. Load a provider only when its condition below holds: do
not load the whole set, and never let a provider own a second copy of another owner's judgment.

A provider whose own frontmatter forbids independent natural-language activation is reachable only
through this delegation; the condition below, not a user keyword, is its trigger.

| Provider | Load when |
| --- | --- |
| `skills/checker/audit/SKILL.md` | an identified area needs a specialist accessibility, performance, theme, responsive, or anti-pattern audit |
| `skills/checker/critique/SKILL.md` | an identified area, interface, or design artifact needs a product or design critique before integration or acceptance |
| `skills/checker/harden/SKILL.md` | a user-visible interface must reach production readiness: error handling, empty states, onboarding, i18n, text overflow, or edge cases |
| `skills/checker/optimize/SKILL.md` | the requested target is a user-perceived performance problem: slowness, jank, or lag |
| `skills/engineering/diagnosing-bugs/SKILL.md` | a bug, failing test, flaky test, or performance regression has resisted a simple fix and the Debug Evidence Ladder needs a diagnosis loop |
| `skills/engineering/codebase-design/SKILL.md` | module interfaces, deepening opportunities, seam placement, or the testability and AI-navigability of an owner layer is the design question |
| `skills/engineering/domain-modeling/SKILL.md` | project terminology, the ubiquitous language, or an architecture decision record must be clarified or maintained, with writes staying under `target-truth` |
| `skills/engineering/tdd/SKILL.md` | a change needs test-first discipline, a strict red-green-refactor loop, or test double / mocking guidance |
| `skills/engineering/code-review/SKILL.md` | a bounded diff or completed change needs a specialist review of correctness, coupling, and maintainability before acceptance |
| `skills/product/product-spec-builder/SKILL.md` | the user wants to build a product, app, or tool, or asks to add or change features, and a complete development-ready product specification does not yet exist |
| `skills/product/design-brief-builder/SKILL.md` | the visual direction is undecided and the user describes it vaguely (高级感, 简洁, 现代); run the designer-interview and produce the design brief |
| `skills/product/architecture-foundation/SKILL.md` | a new project is about to enter development, or an existing one faces cross-module, data, interface, permission, deployment, stack, or architecture change; scope and boundary decisions must land in target truth and reach PASS before coding |
| `skills/product/dev-planner/SKILL.md` | the target project requirement documents are complete and a phased development plan with dependency order is needed |
| `skills/product/requirements-test-designer/SKILL.md` | a PRD, requirement document, user story, acceptance criteria, interface spec, or design spec must be turned into production-grade test design assets |
| `skills/product/bug-fixer/SKILL.md` | the user reports a breakage in plain language (功能坏了, 报错了, 白屏, 转圈) and the defect needs a graded fix flow with an acceptance-scope check |
| `skills/product/test-automation/SKILL.md` | the project needs automated tests designed, wired in, or run: E2E, regression, or a Playwright/Vitest harness with fresh evidence |
| `skills/product/release-builder/SKILL.md` | the user asks to package, deploy, release, or ship; the build-package-test-release flow must produce an installable, privacy-safe, vulnerability-checked artifact |
| `skills/product/rule-harvester/SKILL.md` | rules need gold-panning: misplaced rules corrected, generic rules folded into skill packages, stale rules or constitutions retired |
| `skills/product/doc-sync-guardian/SKILL.md` | code, skill, hook, script, command, directory, or workflow changes require syncing the affected documents and blocking doc drift |
| `skills/product/hotspot-governor/SKILL.md` | core hotspots, oversized files or components, or hard-to-maintain modules need diagnosis, a split route, and follow-up control |
| `skills/product/dev-builder/SKILL.md` | the development plan is ready and the user says to start coding or continue the next phase; scaffold, dependencies, per-phase implementation, integration verification, and user confirmation follow this flow |
| `skills/product/ui-system-guardian/SKILL.md` | the component library needs initialization, tokens or base components/variants are missing, or UI debt needs an audit and migration gate |
| `skills/ui/impeccable/SKILL.md` | frontend interface work needs the production-grade craft workflow |
| `skills/ui/adapt/SKILL.md` | a design must adapt across screen sizes, devices, or contexts |
| `skills/ui/animate/SKILL.md` | animation, micro-interaction, transition, or motion work is requested |
| `skills/ui/bolder/SKILL.md` | the design looks bland, generic, or too safe and needs a bolder direction |
| `skills/ui/colorize/SKILL.md` | the interface is gray, dull, or lacks warmth and needs color work |
| `skills/ui/delight/SKILL.md` | the user asks for surprise, playfulness, or a more personable experience |
| `skills/ui/distill/SKILL.md` | the user asks to simplify, reduce noise, or declutter the interface |
| `skills/ui/layout/SKILL.md` | layout, spacing, or visual rhythm is the dominant UI problem |
| `skills/ui/overdrive/SKILL.md` | the user asks for a stunning, impress-level visual or motion pass |
| `skills/ui/polish/SKILL.md` | a final quality pass for alignment, spacing, and consistency is due |
| `skills/ui/quieter/SKILL.md` | the design is too bold or loud and needs a quieter, restrained pass |
| `skills/ui/typeset/SKILL.md` | fonts, typography, or text readability is the question |
| `skills/ui/design-system/SKILL.md` | token architecture, component specifications, or CSS systemization is the design question |
| `skills/ui/ui-styling/SKILL.md` | the user explicitly asks for a page-level style system or a component styling framework |
| `skills/ui/brand/SKILL.md` | brand voice, visual identity, messaging frameworks, or UI brand tokens need creating or reviewing |
| `skills/ui/ui-ux-pro-max/SKILL.md` | an explicit design enhancement request needs UI/UX intelligence across visual direction, color, typography, tokens, accessibility, layout, or charts |
| `skills/engineering/grilling/SKILL.md` | a plan or design needs structured stress-testing questioning before commitment (frontier-style decision interrogation rounds) |
| `skills/engineering/prototype/SKILL.md` | a design question is best answered by a throwaway playable prototype (logic/state feel or UI variant exploration), not by discussion |
| `skills/engineering/research/SKILL.md` | first-party background research with per-claim source attribution should run in a background agent while the main session continues |
| `skills/engineering/resolving-merge-conflicts/SKILL.md` | an in-progress merge or rebase has conflicts to resolve while preserving both sides' intent |
| `skills/engineering/setup-pre-commit/SKILL.md` | a JS/TS repository needs a commit-time quality gate (husky + lint-staged formatting, typecheck, tests) |
| `skills/engineering/wizard/SKILL.md` | a human-only procedure (provisioning, credentials, CI secrets, third-party dashboards, one-off migration) needs an interactive guided script |
| `skills/engineering/writing-for-agents/SKILL.md` | documentation written for agent consumption (AGENTS.md, CLAUDE.md, SKILL.md) is being created or revised |
| `skills/engineering/handoff/SKILL.md` | the current session must hand off to a fresh agent with a compressed, desensitized briefing document |
| `skills/product/design-maker/SKILL.md` | a completed design brief must be turned into concrete design deliverables in a design tool (Pencil/Figma MCP) |
| `skills/checker/clarify/SKILL.md` | UI copy is confusing - labels, error messages, empty states, or CTAs need UX-writing rewrites |
| `skills/event/experience-elevator/SKILL.md` | a recurring target-project correction must be promoted through the experience ledger (event-driven; explicit invocation only) |
| `skills/event/evolution-engine/SKILL.md` | accumulated feedback signals must be scanned for rule-graduation, skill-optimization, or new-skill proposals (event-driven; explicit invocation only) |
| `skills/event/feedback-writer/SKILL.md` | a notable correction or skill-performance signal must be recorded to the feedback index (event-driven; explicit invocation only) |

A specialist finding enters this backbone's normal flow: it is evidence for the failing layer, it never
authorizes remediation, and the active route with `代码审计` or `验收` still owns the verdict and gate.

## Anti-Patterns

Treat these as design failures, not style preferences.

| Anti-pattern | Symptoms | Required response |
| --- | --- | --- |
| Patchwork Development | scattered `if` branches, sleeps, retries, string checks, temporary fields, fixing one call site while owner remains wrong | reopen owner boundary, move semantics to the owner, add a regression gate |
| Meaningless Compatibility | old fields/routes/config/product terms/mock contracts kept without migration value | remove rejected surfaces, or ask the user for a product migration decision before coding |
| Second Source Of Truth | UI mock, adapter, controller, global config, or copied status map owns the same fact as schema/service/source truth | name the authority, delete or redirect duplicate logic, add drift or contract checks |
| Layer Violation | controller writes SQL/business rules, adapter owns registry/policy/executor, business layer imports vendor internals | restore dependency direction and keep adapters thin |
| Guess-Driven Debugging | root cause stated before reproduction/logs/call-chain/failing-layer evidence | reproduce, build a hypothesis table, audit git/upstream when relevant, fix the proven owner layer |
| Fake Verification | stale logs, old outputs, README claims, build-only evidence for UI/live/release claims | state exactly what passed and what remains unverified |
| Fake Observability | fixed metrics, placeholder ready states, finite snapshots described as global totals | use real source data or return structured unavailable/degraded state |
| Documentation Drift | code behavior, architecture, API, schema, UI truth, or acceptance changed without active docs/index updates | update the right active truth document and index |
| Generated-File Edits | hand-editing generated DAO/entity/API/contracts or running the wrong generator | edit source schema/API, run project generator, inspect generated diff |
| Over-Engineering And Fake Abstraction | wrappers/interfaces/future flags without current consumers, hard-coded cue lists as semantic authority | keep the design as small as current evidence permits |

Do not add retries, sleeps, prewarming, caches, fallback branches, compatibility shims, or string contains checks unless evidence proves that mechanism belongs in the owner-layer fix. Do not add compatibility shims without approval when the purpose is only to preserve an old rejected path.

## Debug Evidence Ladder

For non-trivial bugs, flaky tests, performance regressions, dependency/framework/runtime behavior, or anything that has already resisted a simple fix:

1. Capture the exact symptom, reproduction command/path, input, expected result, and actual result.
2. Inspect current call chain, logs, config, generated sources, runtime state, browser network/console, database state, and current git status.
3. Audit git introduction truth with `git log -- <path>`, `git blame`, `git show`, or manual narrowing when a regression window matters.
4. Check upstream primary sources when external behavior may be involved: official docs, source, release notes, changelogs, GitHub issues, and GitHub PRs.
5. Maintain a small hypothesis table with evidence for, evidence against, next disproof step, and status.
6. Decide the failing layer, classify the Test Gate with `references/testing-strategy.md`, apply the minimal owner-layer fix, and add or reuse the smallest honest regression gate.

Do not call a hypothesis the root cause until it explains the symptom, failing layer, and current evidence. If upstream/network access is unavailable, mark upstream evidence `未验证` instead of guessing. Reject guess-driven debugging as a completion path: no reproduction, no failing layer, no owner-layer fix.

The Three-Fix Gate owns attempt escalation. After the second failed targeted attempt on the same symptom, stop repeating that hypothesis and reframe from the accumulated reproduction, disproof, call-chain, and missing-evidence record before any third fix. A third failed fix reopens architecture, owner, and truth-source diagnosis; no Fix #4 may begin from another local patch. This sequence counts failed fixes, not harmless evidence reads or reruns, and other routes consume it rather than defining a competing threshold.

## Verification Matrix

Choose gates by touched risk, not by habit.

| Touch surface | Minimum evidence |
| --- | --- |
| Docs only | read back changed docs, check index links, run targeted `rg` for old terms or contradictions |
| Static asset | inspect file path, dimensions/type when relevant, README/link reference when public |
| Frontend | build or targeted test, design-token/style scan when relevant, browser or screenshot evidence for visible behavior |
| Backend/API | existing package tests or the owner's suite per `testing-strategy.md`, plus mandatory Runtime Boundary Verification against the local runtime: one real request through the changed entry with recorded status/body, and the negative requests (no credential, other user/role, tampered server-owned field, malformed input) for every Security Impact Checklist item touched; structured errors and idempotency/rate/size evidence when those boundaries are touched |
| Database/schema | migration/schema diff, generated contracts when present, rollback/data-risk note |
| Third-party/provider | official docs or provider contract, sandbox/mock boundary, webhook/error/quota/security cases |
| Security/privacy | security impact decision, secret scan, env/log review, input trust, role/ownership/cross-user/tampered-field negative cases, resource-abuse bounds where relevant |
| Release/publish | clean staged scope, changelog/release notes, build/deploy route, env/secrets, rollback, monitoring, cost, public/private exposure |
| Live/user acceptance | current live logs, app URL, screenshots, click path, user-visible expected states, blocked checks |

Never claim more than the evidence supports. Split status into code gate, contract chain, UI verification, live/user acceptance, and release readiness when those planes differ. Never claim release-ready from local tests only.

## Documentation Write-Back

Update active truth when behavior, architecture boundary, API contract, schema, profile, feature matrix, device behavior, UI truth, acceptance gate, deployment route, or removed legacy surface changes.

Use the repo convention:

- `dev-docs/`: internal product boundary, architecture, implementation plans, acceptance gates, audits, readiness, agent constitution.
- `docs/`: external usage, deployment, integration, API, hardware wiring, operations, troubleshooting.

Do not put internal agent rules or temporary audits into external user docs. Update the relevant README/index when creating active docs.

Write back into the existing owner: update the main document and append one entry to its change-log section (date, what changed, which confirmation). Do not create a new document for every change; a new feature or decision document is created only through the Truth Capture Gate in `truth-capture.md` after the user confirms its Authorization Card.

## Drift Lock Hard Stops

Stop before coding, finalizing, or claiming done when any item is true:

- Source truth conflicts with memory, old chat, archive docs, or previous summaries.
- An explicit user-owned product decision or evidence-backed conclusion rejected a concept, but it still appears in active docs, code, tests, templates, or wording.
- A fact, field name, owner boundary, schema, or technical recommendation changed only because the user repeated it, expressed confidence, or applied emotional pressure, without new evidence.
- The plan has no stop condition or validation method.
- A bug fix has no reproduction, failing layer, or evidence-backed hypothesis.
- Owner behavior is about to change without Test Gate Classification, or a `T2` change has no meaningful observed RED.
- A dependency/framework/runtime explanation is asserted without upstream evidence or an explicit `未验证`.
- UI/API/adapter/prompt/mock owns semantics that belong in core, schema, service, contract, or truth docs.
- Verification relies on old output, assumptions, or unrelated gates.
- The commit set contains ignored, unrelated, nested-repo, or untracked-required ambiguity.
- The proposed gain is only speed while correctness, safety, reconciliation, or user-visible truth is weakened.
- User-visible implementation is about to exceed its Delivery Shape Lock, reinterpret a reference without resolving its role, or change confirmed structure under the label of optimization or responsive work.
- UI design is about to ignore current project constraints, remain outside the selected truth root, overwrite approved evidence, implement an unapproved version, or flatten interactive UI into screenshots instead of semantic components.
- A half-built repo is being treated as an empty bootstrap.
- A governance/source-truth/product-boundary change is about to be made without user confirmation.

## Dangerous Action Stops

Before these actions, the AI must recommend one technical route with evidence and rejected alternatives. Ask the user to confirm only the resulting product-visible scope, cost, downtime, migration risk, destructive effect, credential/production access, or external publication:

- Change stack, framework, SDK, package manager, database model, auth model, permission model, payment model, deployment topology, or directory ownership only after the recommendation is complete and the user confirms the consequences they can evaluate.
- Preserve old and new paths as compatibility only when a real product migration need is explicit; technical convenience is not approval.
- Delete, archive, mass-rename, or reframe active docs, product names, API fields, routes, or configs only after the affected visible/public contract and loss boundary are confirmed.
- Use credentials, production data, live hardware, destructive commands, or remote deployment only with explicit permission for that external or irreversible action.
- Do not commit or publish while staged, untracked, ignored, or nested-repository boundaries remain unclear; resolve and report the scope first.

## Git Boundary Review

Before staging, committing, or publishing:

1. Identify repo root.
2. Inspect `git status --short`.
3. Check nested repos and ignored files when relevant.
4. Stage explicit paths only. Never use `git add .`.
5. Review staged names and diff/stat.
6. Keep unrelated dirty worktree changes out of the commit.

Final reports must include what changed, files changed, validation run, unverified items, and next safe sub-stage or stop condition.
