# Constitution Routes

Use this file with `agent-constitution.md` and `agent-constitution-template.md` when creating or auditing AGENTS.md or equivalent project agent rules. The base template is required for every audit, not only a template-conformance request, because the audit verdict depends on an explicit clause mapping.

## Contents

- `create`
- `audit`

## Operation: `create`

Goal: create a project-specific agent constitution from the bundled base template.

Required references:

- `agent-constitution.md`
- `agent-constitution-template.md`
- Project truth documents.
- Current code, package files, framework files, docs, scripts, tests, and Git state.

Procedure:

1. Run a read-only project evidence audit.
2. Produce an owner map for product, frontend, backend, database, auth, permissions, security boundaries, config, deployment/public exposure, tests, docs, and Git.
3. Produce a template-clause mapping table. For each important base-template clause, mark it `keep`, `rewrite`, `delete`, or `ask`. Security redlines and test-decision/test-quality rules must be mapped individually; do not delete either as one generic block.
4. Ask any blocking questions before drafting if evidence is missing or contradictory.
5. Draft the constitution using project-specific rules and evidence paths.
6. Run the anti-shallow validation in `agent-constitution.md`.
7. Only then write or update the actual agent instruction file if the user approved the path and direction.
8. After writing or changing the target file, resolve `<sliver-runtime-root>` through `references/runtime-adapter.md`, then run `python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode constitution`.

Output before writing:

- Project evidence pack.
- Owner map.
- Clause mapping table.
- Missing evidence and user questions.
- Draft structure.
- Constitution guardrail plan.

Do not write the final constitution if the user has not approved the direction and the target file path.

Security mapping rules:

- Keep universal rules for untrusted frontend input, secret handling, audit/remediation separation, evidence before safety claims, and automatic security-impact decisions.
- Rewrite applicable auth, permission, ownership, database, third-party, AI, payment, upload, and release rules against real project owners and commands.
- Mark a technical boundary `不适用` only when current evidence proves the project does not have it. Do not invent missing infrastructure or keep irrelevant platform instructions.
- A project-specific constitution may shorten detailed audit steps by pointing to its security truth document, but it must not remove the stop conditions or evidence requirement.

Testing mapping rules:

- Keep mandatory test classification, causally related existing-gate reuse, strict RED -> GREEN for stable automatable behavior, reproducible alternate evidence, and anti-test-theater boundaries.
- Bind the rule to the project's real runner, owner contracts, fixtures, browser/live path, and validation commands without copying a generic framework recipe.
- Do not turn the project constitution into universal TDD for docs or pure appearance changes, and do not let a missing framework become an excuse to skip regression protection.

## Operation: `audit`

Goal: determine whether an existing `AGENTS.md` or equivalent file is useful or only a shallow template adaptation.

Default mode is read-only. Inspect files and scripts, but do not run build, test, install, dev-server, codegen, deploy, migration, or preview commands unless the user explicitly approves, because those commands may write caches, generated files, build outputs, databases, or external state.

Read the bundled base template before evaluating the project file and use the same `keep|rewrite|delete|ask` decisions as creation. For a scoped clause audit, map the named clause plus only the universal redlines and direct upstream/downstream clauses needed to judge it; do not expand into a whole-file audit. A whole-file constitution verdict requires the complete mapping. State which audit scope was used.

Check:

- Does it bind rules to actual files, owners, commands, and truth documents?
- Does it delete irrelevant template clauses?
- Does it distinguish universal rules from stack-specific adapters?
- Does it explain current product boundaries and rejected directions?
- Does it include real stop conditions?
- Does it include validation commands that exist in this repo?
- Does it avoid pretending missing backend/API/schema/docs already exist?
- Does it force document updates when truth changes?
- Does it preserve the universal safety redlines and bind applicable auth/data/provider/release rules to actual owners and validation commands?
- Does it preserve mandatory test classification, strict TDD at the correct boundary, existing-gate reuse, and prohibitions on mock/coverage theater and production-code test pollution?
- Would it pass the constitution guardrail without placeholders, empty critical fields, or generic rules?

Output:

- Project evidence pack.
- Owner map.
- Base-template clause mapping.
- Anti-shallow validation table.
- Verdict with threshold.
- Useful clauses.
- Shallow or generic clauses.
- Missing project-specific rules.
- Wrong or stale rules.
- Required questions.
- Rewrite plan.

For a whole-file audit, whether this output is also written as a report under
`audits/` is decided by `audit-artifact.md`; the clause mapping, anti-shallow
table, and verdict threshold here do not change, and the report never
authorizes rewriting the constitution.
