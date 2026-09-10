# Audit Artifact Owner

This file is the single owner of what an audit delivers and where it lives. It
applies to every route whose delivery is `audit`: `代码审计`, `项目体检`,
`安全审计`, `AI债务体检`, the `audit` operation of `项目宪法`, `接管项目`, and
the `防漂移` audit inside `开发执行`. Each route keeps its own lanes, judgment
criteria, and verdict vocabulary; this file decides the pass structure, the
finding schema, the report file, and its lifecycle.

An audit is read-only. Writing the audit report and its explicitly recorded
report-index entry is the only write it performs.
An audit report is never remediation authorization, never a stage write-back,
never a plan artifact, and never a change to product or source owners.

## Proportionality

- A single-file, single-question `D0`/`D1` audit answers in conversation. Do
  not create a report for "这个函数有没有问题".
- When the scope is a module or larger, or the user asks to audit, review,
  health-check, or "看看" the project or a subsystem, the report is written by
  default. Conversation carries the summary, the verdict, and the report path;
  it does not repeat the findings.
- The user may decline the report; record the refusal and keep the findings in
  conversation for the current task only.

## Three-Pass Audit

Every report-level audit runs three passes. No pass writes source code, and no
pass may be skipped or merged because the scope "looked small".

1. **Triage** (`audit_pass: triage`): fix the scope, inventory the owners in
   scope, mark hotspots, and list candidate findings. Every candidate is
   `待核实`. Write the draft report now so the pass survives compaction.
2. **Deep audit** (`audit_pass: deep`): verify each candidate against four
   sources and record which ones were checked:
   - the framework, SDK, or provider's current documented behavior (load
     `truth-resolution.md` when current external behavior decides the
     finding);
   - the project's requirement and design truth (brief, function list,
     feature documents, decision records, architecture, security boundary);
   - the actual call chain in source, not the file the finding was first
     noticed in;
   - runtime evidence when the user separately approved the command that
     produced it.
   A candidate that no source supports is closed as `误报` with the reason
   kept in the report.
3. **Review** (`audit_pass: review`): an independent read-only reviewer
   (a subagent or a Studio reviewer room, never the producer) re-reads every
   finding for false positives, wrong severity, missing evidence, and a
   recommended solution that would break another owner. Disagreements are
   recorded in the report, not silently resolved by either side.

Only after review does the report reach `audit_pass: closed`, when it has no
unresolved findings or their separate promotion is already complete. Otherwise
finish the requested audit with `audit_pass: reviewed_pending_promotion`,
`unresolved_findings > 0`, `promoted_to: none`, and frontmatter `status: open`.
This is a completed review, not a closed ledger or permission to change truth.

## Finding Schema

Every finding in every audit route records these fields. Route-specific owners
may add fields (for example the eight security lanes in `security.md`) but may
not remove any of these:

- `编号`: stable within the report.
- `严重度`: `阻断`, `高`, `中`, or `低`.
- `问题`: one sentence, plain Chinese, what is wrong.
- `影响对象`: which user, data, flow, or contract is affected.
- `位置`: exact file and line range, route, interface, configuration key, or
  deployment surface.
- `证据`: what was inspected or reproduced; a claim without evidence stays
  `待核实`.
- `根因`: why the problem exists (missing owner, wrong layer, stale contract,
  copied pattern, framework misuse), not a restatement of the symptom.
- `现有防护`: what already mitigates it and why that is or is not enough.
- `最佳方案与理由`: one recommended fix, why it is preferred, and the
  alternatives that were rejected with the reason for each.
- `修复涉及代码点`: the exact files, functions, schemas, or configuration the
  fix would touch, so the later remediation task can be bounded.
- `修复后验证`: the check that proves the fix.
- `状态`: `待核实`, `已证实`, `误报`, `未验证`, or `不适用`.

## Persistence

- When the project has an internal truth root, write
  `dev-docs/audits/<YYYY-MM-DD>-<scope>.md` from
  `assets/project-audit/audit-report.md` and add one line to
  `dev-docs/audits/README.md`. One report per audit; never edit a closed
  report, write a new one.
- When no truth root exists, do not invent `dev-docs/` or another repository
  convention. Use the current-task or explicit-path choices in the Exactly One
  Owner rules of `plan-artifact.md`, with owner ID `audit_artifact` and the
  canonical filename `sliver-audit-<stable-task-id>.md`.
- The report target may never equal the active plan target or stage target.
- Writing the report is action `audit_artifact`, tier `local_reversible`. For
  a module-level or larger audit the user's audit request is its authorization
  evidence; no second confirmation is needed. Every other action in the audit
  stays `audit` (`read_only`). If an established report index is updated, record
  its exact path as `audit_index_target`: only the report directory's
  `README.md` is allowed, and only the entry for this report may change.
  No index target is needed for a task-temporary report.

Record the state in Task Decision: `materialize_audit: true`, the exact
`audit_target`, `audit_pass`, and loaded owner ID `audit_artifact`.

## Closeout

The report ends with:

- one verdict from the route's own vocabulary (for example
  `可继续开发` / `修复阻断项后继续` / `暂缓上线` / `禁止上线`);
- repair units: findings grouped into bounded fixes, ordered by exploitability
  and business impact, each naming its code points and validation;
- the sentence that this report is audit evidence, not authorization to
  change the project.

Before closing a report, ask for a separate bounded truth-update authorization
to promote every finding that is `已证实` or `未验证` and not yet fixed into
exactly one live owner: `dev-docs/ai-debt.md`, or
the "风险与未决问题" section of the affected stage or feature document. Record
the destination as `promoted_to` in Task Decision only after that separately
authorized update has been verified. This update is outside audit delivery;
the audit request never authorizes it. If authorization or a suitable live
owner is absent, leave the report `reviewed_pending_promotion`, indexed `open`,
and deliver its findings. Do not invent a truth root to close it. A closed report with
unresolved findings and `promoted_to: none` is invalid. After promotion the
report is a ledger entry: it is listed as `closed` in `audits/README.md`, is
not read to establish current truth, and is archived through `整理开发资料`.

## Not This Owner

- Which lanes to inspect and what counts as a risk in each route stays in
  that route's owner (`routes-intake.md`, `security.md`, `routes-rescue.md`,
  `routes-constitution.md`, `project-flow.md`).
- Whether fixes may start, and in what order, is a separate `开发执行`
  decision with its own authorization.
- Stage write-back and plan write-through belong to `project-flow.md` and
  `plan-artifact.md`.
