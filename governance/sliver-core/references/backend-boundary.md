# Backend Boundary

Use the `boundary` operation of `后端工程` when the backend foundation is being created, audited, or is genuinely unclear. Ordinary local backend work with a known owner and validation path stays in `开发执行`.

## Script Or Project Backend

First distinguish:

- Small script: file processing, spreadsheet cleanup, image compression, single API call, scheduled local task, one-off automation.
- Project backend: users, orders, content publishing, permissions, payments, reviews, analytics, API service, multi-user data.

Do not force a full backend onto a small script.

## Project Backend Responsibilities

A project backend usually handles:

- Business rules.
- Data flow.
- API collaboration with frontend.
- Authentication.
- Authorization.
- Ownership checks.
- Validation.
- External service calls.
- Tasks or jobs.

Explain that frontend is for user operation, database is for storage, and backend decides whether an action can happen and how data changes.

Business rules that affect money, permissions, ownership, status, inventory, quotas, or database writes must not live only in the frontend. Hiding a button is not the same as backend enforcement.

## Before Code

Ask or derive:

- Which business rules must be enforced by backend.
- Which APIs frontend needs.
- Which tables each API reads or writes.
- Which APIs require login.
- Which APIs require roles.
- Which operations must be limited to owner data.
- Error response rules.
- Authentication approach.
- Permission entry point.

Ask business questions before code questions, exactly one at a time when the answer blocks the foundation decision. Never ask a non-technical user to choose a language, framework, database, or architecture pattern.

If backend is needed, complete the `boundary` operation before the `architecture` operation inside `后端工程`. The boundary decision says what backend owns; it consumes the selected foundation route rather than choosing a second language, framework, or architecture.

## Consume The Joint Foundation Decision

Read the active technical-selection truth produced by `tech-stack.md`. It must already contain the selected framework-plus-architecture combination and the evidence that supports it.

Rules:

- Do not rank languages, frameworks, databases, runtimes, or architecture patterns again in this reference.
- If the joint decision is missing, still blocked, or contradicts the backend responsibilities discovered here, return the evidence to `技术选型`; do not silently pick a backend stack.
- If the selected framework has a native request lifecycle, module system, validation path, data-access convention, or security entry point, backend architecture must use it unless the joint decision records a proven exception.
- A normal endpoint, service, bug fix, or one-owner backend change inside the current foundation does not reopen technical selection or architecture design.
- The user confirms only product-visible migration consequences such as cost, downtime, data conversion, delivery impact, or irreversible effects. The AI owns the technical recommendation.

## Runtime Boundary Consumption

If the selected route uses one runtime, keep the backend inside that runtime. If it uses more than one, consume the recorded process ownership, contracts, startup order, auth propagation, observability, deployment, and rollback truth from the joint decision.

Do not add a second runtime during backend boundary or skeleton work. Evidence that the selected runtime cannot satisfy a confirmed product requirement reopens the joint foundation decision before production code changes.

Every backend entry that is later added or changed under `开发执行` is proven through Runtime Boundary Verification owned by `testing-strategy.md`: the local runtime is started and the entry is exercised with a real request plus the applicable negative requests. Record the established local start command in backend truth so that gate has one known way to run.

## Output

Write:

- Whether backend is needed.
- Backend responsibilities.
- API boundary.
- Required auth and permission model.
- Data read/write responsibility.
- Active technical-selection truth reference.
- Selected framework-plus-architecture combination being consumed.
- Framework-native capabilities and owner boundaries used by the backend.
- Any blocking contradiction that must return to `技术选型`.
- Required backend architecture truth sections that must be created before skeleton code.
- What must be written into truth docs.
