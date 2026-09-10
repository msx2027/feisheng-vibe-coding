# Project Templates

Use this file when materializing project truth documents for a new project or a half-built project adoption.

The bundled templates are starting assets, not final truth. The agent must adapt them to the user's real project evidence before treating them as authoritative.

## Template Sets

### Empty Or New Project

Use `assets/project-bootstrap/` when the project has no real code, no business behavior, or only an empty directory.

Files:

- `assets/project-bootstrap/AGENTS.md`
- `assets/project-bootstrap/dev-docs/README.md`
- `assets/project-bootstrap/dev-docs/project-brief.md`
- `assets/project-bootstrap/dev-docs/technical-selection.md`
- `assets/project-bootstrap/dev-docs/architecture.md`
- `assets/project-bootstrap/dev-docs/acceptance.md`

Use this sequence:

```text
project root check
  -> Git/privacy baseline
  -> bootstrap AGENTS.md draft
  -> project brief
  -> foundation source coverage and blocking-question loop
  -> architecture drivers and quality scenarios
  -> current primary-source research and bounded PoC when required
  -> one technical-stack + framework + architecture recommendation
  -> user confirmation of product consequences
  -> current architecture truth
  -> acceptance truth
  -> guardrail check
```

### Half-Built Or Inherited Project

Use `assets/project-adoption/` when the repo already has code, docs, deployment scripts, generated files, or AI-made behavior.

Files:

- `assets/project-adoption/AGENTS.md`
- `assets/project-adoption/dev-docs/README.md`
- `assets/project-adoption/dev-docs/current-state-audit.md`
- `assets/project-adoption/dev-docs/technical-selection.md`
- `assets/project-adoption/dev-docs/architecture.md`
- `assets/project-adoption/dev-docs/acceptance.md`

Use this sequence:

```text
read-only takeover audit
  -> dangerous adoption action check
  -> truth-root decision
  -> current-state audit
  -> foundation source coverage and blocking-question loop
  -> current-stack/framework/architecture joint-fit audit
  -> current primary-source research and bounded PoC when required
  -> one retain/repair/migrate recommendation
  -> user confirmation of product consequences
  -> current architecture owner map
  -> acceptance truth
  -> guardrail check
  -> first safe task proposal
```

### Shared Current-Stage Truth

Use `assets/project-stage/stage-truth.md` only when `project-flow.md` identifies cross-owner drift, an ordered non-closable transition, or an explicitly requested durable handoff. Depth alone does not materialize it. It is one shared template for both project entry paths; do not copy separate bootstrap/adoption variants and do not create separate plan, execution, and closeout documents.

Materialize it under the project's active truth convention, normally `dev-docs/stages/<stage-name>.md`, replace every placeholder with current evidence, and add the real materialized path to the project's truth index. The stage schema and lifecycle are owned by `project-flow.md`.

Run the gates in order:

```bash
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode stage --stage-gate plan --stage-file dev-docs/stages/<stage-name>.md
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode stage --stage-gate execute --stage-file dev-docs/stages/<stage-name>.md
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode stage --stage-gate closeout --stage-file dev-docs/stages/<stage-name>.md
```

The raw shared template is intentionally not gate-ready. `--allow-template` cannot be used to bypass a materialized stage gate.

Before `execute`, record a non-pending product decision and scope authorization for the bounded result. A `controlled` action also passes `effect-recovery-gates.md`; do not duplicate its authorization/recovery contract in the stage file. Before `closeout`, record current evidence references. Structural closeout never proves the evidence or implementation by itself.

### Shared Feature, Decision, And Audit Documents

These templates are shared by both entry paths and are materialized only through their owners, never as part of bootstrap or adoption:

- `assets/project-feature/feature-truth.md` -> `<truth-root>/features/<feature>.md`, plus `assets/project-feature/features-index.md` -> `<truth-root>/features/README.md` when the directory is first created. Created only by the Truth Capture Gate in `truth-capture.md` after a confirmed Authorization Card.
- `assets/project-decision/adr.md` -> `<truth-root>/decisions/adr-<id>.md`, plus `assets/project-decision/decisions-index.md` -> `<truth-root>/decisions/README.md`. Same owner and authorization; a changed decision is a new record that supersedes the old one.
- `assets/project-audit/audit-report.md` -> `<truth-root>/audits/<YYYY-MM-DD>-<scope>.md`, plus `assets/project-audit/audits-index.md` -> `<truth-root>/audits/README.md`. Written by `audit-artifact.md` for module-level or larger audits; append-only.

Replace every placeholder with current evidence, keep the `status` frontmatter current, and add one index line in the same write. Run the guardrail in the mode matching the truth root (`bootstrap`, `adoption`, or `stage`); it checks placeholders, index consistency, and vague terms for these files.

### Shared UI Prototype Truth

Use `assets/project-design/` only when the requested work generates, revises, approves, or implements a UI prototype. It is shared by new and adopted projects; do not create separate lifecycle contracts for each entry path.

Files:

- `assets/project-design/dev-docs/README.md` (only when the narrow exception creates an absent root)
- `assets/project-design/dev-docs/design/README.md`
- `assets/project-design/dev-docs/design/prototypes/_template/prototype.md`

Materialize the `dev-docs/design/` subtree under the project's already selected truth root, normally as `<truth-root>/design/`. Replace `_template` with the feature name, start the first captured output in `v001/`, and register the feature in `<truth-root>/design/README.md` as well as the root truth index. If the narrow exception creates `dev-docs/`, materialize the template's minimal `dev-docs/README.md`; if the root index exists, merge only the design link.

The resulting structure is:

```text
<truth-root>/design/
  README.md
  prototypes/
    <feature>/
      prototype.md
      vNNN/
        <manifest-listed real artifacts only>
```

Do not manufacture placeholder files, mandatory device pairs, states, themes, or asset directories. Create only actual prototype output and list it in that version's artifact manifest. `prototype.md` is an instance of the lifecycle. `references/ui-design-lifecycle.md` alone owns its field meanings, enums, version ownership, approval eligibility, and transitions; this materialization guide consumes that owner and does not redefine lifecycle enums. An approved version is immutable; any revision creates the next `vNNN` directory rather than overwriting it.

This template does not override an established truth-root decision. Bootstrap projects still need a clear project root and privacy/Git boundary; adoption projects still need the read-only audit required by `project-flow.md`. When that audit finds no convention, no occupied `dev-docs/`, and no privacy/Git or external-delivery conflict, an authorized UI prototype request may materialize the minimal root index plus standard `dev-docs/design/` subtree without a separate directory-choice question.

## Adaptation Rules

- Do not copy templates without project evidence.
- Replace generic sections with actual file paths, commands, owners, risks, and user decisions.
- `technical-selection.md` is the only owner of foundation-decision drivers, quality scenarios, pattern axes, framework fit, current primary evidence, PoC, trade-offs, rejected alternatives, and decision history.
- `architecture.md` owns the selected route's current macro topology: deployables/processes, cross-boundary owner map, shared contracts, data/security boundaries, deployment shape, real runtime flows, and links to any materialized local architecture truth. Link the active technical decision; do not copy its rationale.
- Once frontend, backend, database, security, or deployment detail truth is materialized, that local document becomes the only owner of its route/state/token, request lifecycle, field/rule, policy, or runbook detail. `architecture.md` keeps only the cross-boundary projection and link; it must not retain a second copy of those details.
- Foundation source rows use only `confirmed`, `not_applicable`, or `blocking_unknown`. If a decision-changing fact is unknown or conflicting, keep the decision `blocked` and ask one product question at a time.
- `recommendation_ready` means AI research has produced exactly one evidence-backed primary combination. It does not authorize implementation. Only `implementation_ready`, after the user confirms product-visible cost, downtime, migration, data, scope, lock-in, or irreversible consequences, may unlock architecture implementation.
- The user confirms product consequences, not technology names. AI owns the stack, framework, architecture-pattern and test/verification judgment.
- Current official web evidence is mandatory for mutable framework, SDK, provider, version, support, license, security, price, region, and deployment facts that affect the decision. Model memory is not evidence.
- If a critical technical uncertainty changes the primary combination, run a bounded, isolated, disposable PoC with explicit success and failure criteria before recommendation readiness.
- If a non-foundation section is unknown, write `未验证` and ask the smallest blocking question.
- Do not create `dev-docs/` if it is already occupied by non-development material; use `project-intake.md` to choose another truth root.
- In adoption mode, do not declare a nonstandard or conflicting truth root, rewrite AGENTS.md, move docs, or delete old docs without user confirmation. The narrow standard-path exception for an authorized UI prototype request is defined above and does not authorize any of those other actions.
- Do not leave UI prototypes only in chat, a temporary export path, or an unindexed asset folder. Materialize the shared UI prototype truth under the selected root when the UI lifecycle applies.
- Do not implement a prototype that the lifecycle marks ineligible. Only the recorded approved version authorizes implementation; an explicit continuous design-and-implement request must still preserve a versioned prototype, compatible constraint review, atomic approval transition, and approval evidence.
- Keep public docs and internal truth docs separate.
- Before remote push, decide whether generated truth docs and AGENTS.md are public-safe or should stay private.

## Guardrail Check

After creating or changing the template-derived project truth, run:

```bash
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode <bootstrap-or-adoption> --foundation-gate contract
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode <bootstrap-or-adoption> --foundation-gate recommendation
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode <bootstrap-or-adoption> --foundation-gate implementation
```

Use `contract` while the decision is still blocked or being researched, `recommendation` before presenting the AI-owned primary combination, and `implementation` before materializing that foundation. A passed `implementation` gate proves only that the recorded structural evidence contract is complete; it always reports `foundation_external_implementation_authorized: false`, so real product confirmation, source reading, live evidence, credentials, production access, release, migration, and irreversible actions still need their own evidence or authorization.

When checking the bundled templates themselves, add `--allow-template`.

The guardrail script also validates the structured foundation-decision state, source resolution, current network evidence, single primary combination, framework-architecture fit, PoC status, product-consequence confirmation, and its handoff into the current architecture truth. Its readiness fields are deliberately named `structural`; it cannot prove that cited evidence is truthful or grant real-world implementation authority. Source reading and live validation remain mandatory.
