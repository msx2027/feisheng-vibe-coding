# Intake Routes

Use this file for project entry, project diagnosis, and early decomposition routes.

## Contents

- `立项`
- `拆分`
- `项目体检`

For empty projects or half-built projects that need truth files, also use `project-templates.md`.

## `立项`

Goal: produce the project brief without writing code.

For a new project, first help the user choose or create a clear English project folder name. Do not start coding from a random desktop/download/chat folder.

If the project is empty or effectively empty, use `assets/project-bootstrap/` through `project-templates.md` after confirming the project root and Git/privacy boundary. The template output is not final until it is adapted to user answers and project evidence.

Ask about:

- Target user, problem solved, core user action, and user journey.
- First version scope, explicit non-goals, confirmed next-stage capabilities, and speculative ideas that must not affect current architecture.
- Product form: website, app, mini program, admin system, API, script, or local tool.
- Core objects such as user, order, task, content item, file, role, permission.
- Similar products, competitor flows, open-source references, screenshots, or examples the user likes or dislikes.
- Differentiation, long-term direction, constraints, commercial-use needs, and acceptance standard.

Output:

- Project summary.
- Target user and scenario.
- Product flow and MVP core flow.
- Feature boundary and non-goals.
- Confirmed evolution boundary: current delivery, confirmed next-stage capabilities, must-not-block items, explicit non-goals, and speculative items.
- Data and business objects.
- Initial product form judgment.
- Initial technical route judgment, clearly marked as not final technical selection.
- Similar-product or reference notes, including what to learn and what not to copy.
- Differentiation or product value point.
- Later milestones.
- Acceptance rules.
- Open questions.
- Bootstrap truth files to create or update, if the user confirmed materialization.

If the user cannot answer a question, propose the most likely answer for this project and mark it `待确认`. Do not leave the user with several equal vague choices.

## `拆分`

Goal: turn the brief into a clear function list and large stages.

Procedure:

1. Confirm the internal truth-doc root, normally `dev-docs/`, and keep public docs separate from internal development truth.
2. Split by role, business process, and module.
3. For each function, write user, input, output, permissions, normal path, exceptions, and boundary cases.
4. Move complex functions into separate documents when they contain state machine, permissions, payment, refund, coupon, review, status-flow, or dependency rules.
5. Define large stages. The first stage must run a real core flow, not just a single component such as login.
6. Produce a truth-doc chain where one document has one responsibility: brief -> function list -> complex-feature docs -> large stage plan.

Large-stage criteria:

- A large stage must let at least one user role complete one meaningful product flow.
- A large stage must have a clear start, end, acceptance standard, and non-goals.
- A large stage can contain multiple modules only when they serve the same deliverable flow.
- A stage is too small if it only delivers an isolated component such as login, navbar, table styling, or one table.
- A stage is too large if it includes multiple unrelated user roles, several independent flows, or features that can ship separately.

Output:

- Function list.
- Complex-feature document index.
- Large stage plan.
- Truth-document map and reference chain.
- What is not planned yet.
- Whether the bootstrap/adoption guardrail must run before feature work.

## `项目体检`

Goal: help a non-technical user understand the current project state, the real next step, and hidden risks. Use this when the user is unsure what to do next, asks for an audit, or gives an existing project without a clear stage.

Default mode is read-only unless the user explicitly asks for edits.

## Bounded Project Health Audit

Use this compact path when the project is already understood, the repository
boundary is known, and the requested result is a read-only state, risk, or
next-action audit. Exit it when evidence is incomplete enough to require a new
takeover baseline, a foundation decision is being made, a release verdict is
requested, or durable stage readiness/materialization must be judged.

For the compact path, inspect the exact audit target, current Git/private-file
boundary, directly active truth, nearest owner and consumer, and the narrow
evidence that decides the next route. Report the observable current state and
next route without forcing a detailed lifecycle-stage label. Load
`project-flow.md` only when stage placement cannot be closed from current truth
or stage readiness/materialization must be judged. A read-only health audit uses
route evidence; it does not load a testing owner unless behavior changes or a
release verdict needs regression selection.

### Discovery Batch Contract

- Collect paths and size metadata before content. Give every content batch one semantic purpose
  and one closed owner/consumer question; do not combine the
  complete registry, long lifecycle owners, a full repository diff, and target
  source into one speculative read.
- Bind a consumed owner to its path and immutable digest, or to the current
  revision plus size when no digest is available. Do not request the same owner
  again while that identity is unchanged.
- When a Host reports truncation or an incomplete result, record the missing
  evidence and must not replay the same batch. Query only the missing boundary
  with a narrower file set, exact section, or bounded range, then continue from
  the already retained evidence.
- Semantic batch closure is portable correctness. Physical model/tool call
  counts and Host output ceilings are adapter telemetry; optimize them only
  against the same capability and evidence cases.

Procedure:

1. Inspect repo boundary, Git status, `.gitignore`, package/framework files, scripts, docs, agent instruction files, frontend/backend/database/deployment structure, and known run/test commands.
2. Inventory truth documents: project brief, function list, complex-feature docs, stage plan, technical selection, frontend architecture, database design, backend boundary/architecture, security boundary, current-stage truth, quality evidence, release notes, and agent constitution.
3. State the observable current project position. Load `project-flow.md` and
   produce a detailed stage mapping only when the compact-path escalation rule
   above is met.
4. Run a proactive risk sweep across product, docs, stack, runtime/startup, frontend, backend, database, security/privacy, third-party, AI-generated debt, quality, Git, deployment/release, cost/quota, and user support.
5. Mark each lane `健康`, `缺失`, `冲突`, `过期`, `未验证`, or `暂不相关`.
6. Choose one recommended next route. Do not give a list of equal next steps.
7. Ask only the blocking questions needed for that next route.
8. If the audit creates or changes bootstrap/adoption truth files, run the project guardrail script and report failures before recommending implementation.

Output:

- Current truth summary in plain Chinese.
- Stage mapping.
- Risk lane table.
- Missing or stale truth documents.
- Hidden foundation risks.
- Recommended next route and why.
- Rejected next routes and why not now.
- Blocking questions.
- What not to do yet.

Whether this output is also written as a report under `audits/`, and the three
passes a module-level or larger audit runs, are decided by `audit-artifact.md`;
the lanes and verdict above do not change. Reading `features/`, `decisions/`,
or `audits/` as whole directories violates the Discovery Batch Contract; open
only indexed entries.

`项目体检` is invalid if it only summarizes files and does not choose a next route, or if it recommends coding without checking current-stage truth, Git/private-file risk, and foundation impact.
