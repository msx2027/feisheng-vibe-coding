# Existing Project Intake

Use `接管项目` when the project is inherited, half-built, first seen by the current agent, or lacks a trustworthy continuation baseline and the requested result is to establish one. Use `项目体检` when the project is already understood and the user only wants current state, risks, or the next safest action. A non-empty repository alone does not force takeover.

## Read-Only First Pass

Inspect without editing:

- Repo boundary and nested repos.
- Git status and recent commits when useful.
- Directory tree.
- Package/framework files.
- Run/test scripts.
- Runtime version files, lockfiles, env examples, startup proof, and known startup blockers.
- Existing docs, especially `dev-docs`, `docs`, `AGENTS.md`, `README`, architecture docs, schema/migrations.
- Existing agent-instruction files, host entry files, and whether they are generic or project-bound.
- Frontend, backend, database, and deployment structure.
- Duplicate/generated/AI-sprawl clues: repeated components, repeated APIs, dead files, mock data, custom wrappers, abandoned backups, and inconsistent patterns.
- Config examples and secret risks.
- `.gitignore`, tracked/private-file risks, nested Git repos, and third-party reference projects placed inside the project tree.

Do not start by generating a new architecture.

## Current Truth Summary

Return:

- Project type and likely product form.
- Existing stack.
- Stack, framework, SDK, and dependency fit: viable, questionable, or mismatch.
- Existing truth documents.
- Existing agent constitution quality.
- Existing frontend/backend/database status.
- Runtime/startup baseline status.
- AI-generated debt status.
- Git safety status.
- `.gitignore` and private-file status.
- Quality evidence status.
- Release/deployment/operations readiness when relevant.
- Missing or stale truth documents.
- Immediate risks.
- Best entry command.

## Stage Mapping

Map the project to one of these:

- Needs project brief backfill.
- Needs function list and stage plan.
- Needs technical route review.
- Needs runtime/startup baseline.
- Needs AI debt cleanup before more feature work.
- Needs frontend skeleton consolidation.
- Needs database design repair.
- Needs backend boundary definition.
- Needs backend skeleton validation.
- Needs security validation.
- Ready for current stage implementation truth.
- Ready for one sub-stage execution.
- Needs quality validation.
- Needs release readiness check.
- Needs deployment-route decision.
- Needs stack/framework/SDK route decision.

## Development Docs Audit

Use `整理开发资料` when:

- `dev-docs/` does not exist and no narrow standard-path exception below applies.
- `dev-docs/` exists but contains non-development material.
- Development material is scattered across `docs/`, `README`, root markdown files, chat exports, issue notes, or random folders.
- Multiple docs disagree about product scope, stack, architecture, schema, or current stage.

Default to read-only audit first. Do not create, move, rename, delete, archive, or rewrite docs until the user approves the target structure, except for the narrow authorized UI prototype path below.

## If `dev-docs/` Is Missing

1. Search for existing internal development docs in `docs/`, root markdown files, agent-configuration directories, `README`, architecture docs, design docs, schema/migrations, and planning files.
2. If no internal-doc convention exists, propose `dev-docs/` as the internal truth root.
3. Ask for confirmation before creating it. Exception: when the user has already made an authorized UI prototype request, `dev-docs/` is absent and unoccupied, no other internal-doc convention exists, and no privacy, Git, or external-delivery conflict exists, create the minimal `dev-docs/README.md` root index plus the standard `dev-docs/design/` subtree without a second directory-choice question. If the selected truth root already has an index, merge only the design link into that index instead of replacing it.
4. If the user confirms, choose the correct template set from `references/project-templates.md`: bootstrap templates for empty projects, adoption templates for half-built or inherited projects.
5. Create only the minimal truth index and the current required truth files. Do not create a pile of empty documents.
6. Run `python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode bootstrap --foundation-gate contract` or the adoption equivalent after creating or changing an in-progress truth surface. Resolve `<sliver-runtime-root>` through `references/runtime-adapter.md`. Use the explicit `recommendation` and `implementation` gates only when those states are actually required.
7. Explain that internal truth docs are private by default and should not be pushed to a public remote unless the user explicitly approves.

The UI exception authorizes only the minimal root index and indexed prototype truth required by `ui-design-lifecycle.md`. It does not authorize the adoption template set, a full project-truth bootstrap, an AGENTS.md rewrite, moving existing docs, or publishing internal material. If any exception condition is uncertain, remain read-only and ask the one decision-changing question.

Minimal first files:

- `dev-docs/README.md` or `dev-docs/truth-index.md`.
- Current project evidence summary.
- Links to existing source docs instead of duplicating them.

## If `dev-docs/` Exists But Is Not Development Material

Do not hijack it.

1. Identify what it actually contains.
2. Treat it as occupied by another purpose.
3. Propose a separate internal truth root, such as `internal-dev-docs/` or `docs/internal/`, matching repo style.
4. Recommend one truth root that matches repo style. Ask for confirmation only if creating it changes public/private visibility, moves existing material, or creates a material tooling trade-off.
5. Record in the truth index why `dev-docs/` was not used.

## If Development Docs Are Messy

Produce a docs inventory table:

| File | Current role | Status | Action |
| --- | --- | --- | --- |
| path | project brief / architecture / schema / stale / public docs / unknown | active / stale / conflict / duplicate / unrelated | keep / link / merge / archive / ask |

Then produce a target truth map:

- Product brief owner.
- Function list owner.
- Stage plan owner.
- Technical selection owner.
- Frontend architecture owner.
- Database design owner.
- Backend architecture owner.
- Security boundary owner.
- Monetization/entitlement owner.
- Agent constitution owner.
- Current stage implementation truth owner.
- Runtime/startup owner.
- Quality evidence owner.
- User acceptance owner.
- AI debt owner.
- Deployment route owner.
- Release/operations owner.

Rules:

- Do not move files during the audit.
- Do not delete stale docs until the user confirms.
- Prefer creating an index that marks active, stale, conflict, duplicate, public, or unrelated before reorganizing files.
- Public docs and internal truth docs must stay separate.
- If two docs conflict, report evidence and ask which truth wins.
- If the user wants version history for internal truth docs, suggest a separate local-only Git repo for that docs root instead of mixing it with public code delivery by default.

## `整理开发资料`

Goal: turn scattered or missing development docs into a clear truth-document structure.

Output before edits:

- Current docs inventory.
- Conflicts and stale docs.
- Recommended truth root.
- Proposed file map.
- Files to keep as public docs.
- Files to archive or mark stale.
- Questions requiring user decision.

After approval:

- Create or update the truth index.
- Link to existing docs where possible.
- Move or archive only paths the user approved.
- Update `AGENTS.md` or equivalent only if the user approves the new truth root.
- If templates are used, adapt them to actual project evidence before treating them as truth.
- Run the project guardrail script and report failures as `未验证` or blockers.

## Post-Upgrade Reorganization Offer

When the truth root predates the current convention (no truth index; no
`features/`, `decisions/`, or `audits/` index while such documents exist;
design decisions recoverable only from chat, commit messages, or code
comments; a stage document without a "风险与未决问题" section), do one read-only
inventory and present one Authorization Card:

- what exists and where it would move or be indexed;
- which conclusions found only outside documents would be recorded, and as
  which document type;
- what stays untouched.

Nothing moves, merges, or is created until the user approves the card. Do not
repeat the offer on every task; record the user's decision in the truth index
and re-offer only when the inventory changes.

## Compaction Offer

Default budgets, overridable per project in the truth index the constitution's
`@@TRUTH:<path>@@` entry points to (record the overridden values there, not in
chat):

- active feature documents: 40
- active decision records: 30
- open audit reports: 5
- lines in one truth document: 400
- lines in one index: 150

When the read-only inventory finds any budget exceeded, present one Compaction
Card listing, per document: merge into which owner, archive, or split into
which parts, each with the reason (shared owner concern, superseded, closed
ledger, multiple concerns). The user approves the card before any move; an
approved archive goes to the sibling `archive/` directory and the index is
updated in the same change. Exceeding a budget blocks nothing; it only
triggers the offer.

## Existing Project Guardrails

- Do not say the workflow cannot apply because the project did not start from zero.
- Do not delete or rebuild working code to match the ideal sequence.
- Do not switch framework, stack, SDK, provider library, or integration style just because it is not the agent's preferred default.
- If the current route is materially worse for maintainability, security, deployment, official support, or product fit, run `技术选型`, recommend one route with evidence and rejected alternatives, and ask the user only to confirm product impact, cost, disruption, or irreversible effects before changing it.
- Do not add compatibility layers unless the user approves after seeing the tradeoff.
- If current code violates architecture, identify the owner layer and repair there.
- If documentation is stale, update the truth document before implementation.

## Adoption Template And Guardrail

For half-built projects with no reliable internal truth, use the adoption template set:

```text
assets/project-adoption/
  AGENTS.md
  dev-docs/README.md
  dev-docs/current-state-audit.md
  dev-docs/technical-selection.md
  dev-docs/architecture.md
  dev-docs/acceptance.md
```

Do not write these files automatically just because they exist in the skill. First report the dangerous adoption action and ask the user to confirm the truth-root and AGENTS.md target.

After the user confirms and the files are adapted, run:

```bash
python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode adoption --foundation-gate contract
```

Before presenting a retain/repair/migrate recommendation, rerun with `--foundation-gate recommendation`; before changing the accepted foundation, rerun with `--foundation-gate implementation`. Neither structural result replaces current source reading or external authorization.

If the repo uses a different internal docs directory, pass `--truth-dir <dir>` and record that decision in the truth index.
