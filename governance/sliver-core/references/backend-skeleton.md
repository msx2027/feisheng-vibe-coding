# Backend Skeleton And Validation

Use the `skeleton` operation of `后端工程` to create or repair a minimal backend foundation, and `acceptance` to decide whether that foundation is stable enough for business features. Ordinary local backend work does not enter this foundation workflow.

## Backend Architecture Gate

Do not write backend skeleton code until backend architecture truth exists or has been audited.

Backend architecture and skeleton work consume the framework-plus-architecture combination selected by `tech-stack.md`. They do not reopen technology selection unless current evidence proves that combination cannot satisfy a confirmed product requirement.

Backend architecture truth must combine two parts:

- Business boundary: users, roles, modules, non-goals, core flows, permissions, data ownership, and how important business objects relate.
- Engineering rules: selected language/framework conventions, directory responsibility, request lifecycle, API contract, error handling, logging, config, database access, security entry points, validation, tests, and new-module placement.

The architecture gate is invalid if it only says "use framework best practices" without naming the actual framework rules, owner layers, files, and validation commands.

## Required Backend Architecture Truth

Before skeleton code, write or update:

- Source docs used: project brief, function list, complex-feature docs, stage plan, technical selection, database design, security notes, and current code evidence if the project exists.
- Joint foundation decision reference: selected framework-plus-architecture combination, its allowed global/local architecture patterns, and any unresolved blocker.
- Backend scope: what backend owns and what it does not own.
- Actual lifecycle: record the selected framework's real request, command, event, job, or function sequence. Include validation, identity, permission, business, data/transaction, response/error, and logging owners only when the product and selected combination require them.
- Applicable owner map: name the real framework/project owners and explicitly omit non-applicable layers. Do not generate controllers, services/use cases, repositories/DAO/ORM, domain objects, middleware, or adapters merely to satisfy a generic list.
- API contract: URL/route pattern, request source, response shape, HTTP status use, pagination/list rules, error code/message rule, and versioning rule if needed.
- Data boundary: database access owner, transaction rule, migration/schema owner, seed/test data rule, and direct database operation limits.
- Auth and permission boundary: login verification, role permission, ownership check, admin entry, and no-permission response owner.
- Config and secrets boundary: env/config owner, example config, real secret handling, startup failure behavior.
- Logging and observability rule: normal request logs, error logs, sensitive-data redaction, health check, and runtime evidence.
- Framework-first rule: which framework mechanisms must be reused and what custom wrappers are forbidden unless justified.
- New-module rule: where files go and what minimum API/service/model/test/docs pieces are required when adding a module.
- Validation commands and evidence required before business development can start.

If any of these are unknown, mark them `未验证` and ask blocking questions before coding.

## Backend Architecture Truth First

Before coding, write or update backend architecture truth:

- Product/business boundary: user scenarios, modules, non-goals, and how login/order/payment/permissions relate when present.
- Technical-selection truth reference and the already selected backend language/framework.
- How the selected architecture pattern is realized through framework-native modules and lifecycle.
- Any local architecture pattern explicitly allowed by the joint decision; absence means do not add it.
- Language engineering norms.
- Framework best practices.
- Framework-first principle.
- Directory responsibility.
- API response rules.
- Error handling rules.
- Logging rules.
- Database connection method.
- Permission validation entry.
- How new modules should place files.

Explain the intended directory structure in plain language before writing skeleton code. A non-technical user should be able to tell where entry points, business rules, data/contracts, config, logs, and tests belong in this selected framework; do not promise layers the combination does not use.

Do not repeat candidate comparison or selection rationale in backend architecture truth. That belongs only to the technical-selection truth; this file is the single method and contract owner for concrete backend realization. Once project-specific backend architecture truth is materialized, the project-level `architecture.md` keeps only the macro process/cross-boundary projection plus a link to that detail owner; it must not copy request lifecycle, module placement, API/error/log/config/data/auth rules, or validation detail.

## Request Lifecycle Rule

Every backend feature must fit the declared lifecycle. Do not put business rules in route handlers, database files, frontend code, prompt text, or scattered conditionals when the selected architecture assigns them to another owner. Do not invent a service/use-case layer when the accepted framework-native combination assigns the rule to a different explicit owner.

If the project framework has a different standard lifecycle, use the framework's standard pattern and record it in the architecture truth. Do not create a parallel architecture because it looks cleaner in isolation.

## Owner Layer Rules

The backend architecture must say which applicable owner handles:

- API routing.
- Request parsing and validation.
- Authentication.
- Role permission.
- Data ownership.
- Business rules.
- Database reads/writes.
- Transactions.
- Response formatting.
- Error mapping.
- Logs.
- External provider calls.
- Background jobs.
- Tests.

When changing behavior later, `开发执行` must locate the owner layer before coding. If the owner layer is unclear, stop and update backend architecture truth first.

## Minimal Skeleton Scope

The first backend skeleton should include only the applicable items from:

- Startup entry.
- Environment/config reading.
- Route grouping.
- Health check endpoint.
- Database connection when persistent data is required.
- Unified successful response.
- Unified error response.
- Logging.
- Basic parameter validation.
- The real permission enforcement entry when identity or restricted actions are required; do not add an empty placeholder merely for appearance.
- README startup instructions.

Do not implement full login, order, payment, or other complete business features during skeleton setup.

Do not add fake business modules just to make the skeleton look complete. Use the smallest rehearsal path needed to prove the applicable routing/function entry, validation, response, error, logging, data access, and permission boundary.

## Four Lines To Prove

1. Startup line: service starts, config loads, `/health` works.
2. API line: routes and response format are consistent for list, object, create, update, delete, empty list, and errors.
3. Business line: request entry, validation, business rules, and database access are not mixed together.
4. Operations line: logs, errors, DB connection, permission entry, and README are clear.

## Framework Reuse

Prefer framework-provided mechanisms for:

- HTTP status codes.
- Routing.
- Middleware.
- Parameter validation.
- Error handling.
- Logging.
- Dependency injection when the framework has it.
- Database access pattern when the framework recommends it.

Custom wrappers must explain what real problem they solve. Remove or reject wrappers that exist only to look professional.

Avoid:

- Parallel response helpers when the framework already has a standard.
- Custom validation systems when the framework has a supported validator.
- Hand-written database abstraction that bypasses the selected ORM/query pattern.
- Security wrappers that do not name the risk they block.
- Compatibility layers or fallback branches without user approval.

## `后端工程` Procedure

Require an evidence report with:

- Rule source.
- Corresponding file.
- Validation method.
- Actual result.
- Pass or `未验证`.

Validate:

1. Directory responsibility table.
2. Minimal module rehearsal without full business implementation.
3. API response examples.
4. Framework reuse and custom wrapper boundary.
5. Runtime evidence pack.
6. Final go/no-go for business development.

API response examples must cover the project-appropriate version of:

- List success.
- Detail/object success.
- Create success.
- Update success.
- Delete success.
- Empty list.
- Parameter error.
- Not logged in.
- No permission.
- Resource not found.
- System error.

Each example should include HTTP status, JSON shape, and the file or framework mechanism that standardizes the response.

## Runtime Evidence Pack

Must include:

- Dependency install command.
- Startup command.
- Listening port.
- Health check command and result.
- Config source.
- Example config file check.
- Database connection validation.
- Normal request log example.
- Error log example.

If a command was not actually run, mark it `未验证`.

After backend skeleton validation passes, write the result into the backend architecture implementation truth document and create a Git checkpoint when the workflow requires it. The agent constitution should reference this truth document; it should not contain all detailed backend examples itself.

## Existing Backend

For existing backend, turn `后端工程` into an audit:

- Identify current framework.
- Identify startup path.
- Identify config and secrets handling.
- Identify route structure.
- Identify response/error pattern.
- Identify database access.
- Identify auth/permission entry.
- Identify logs.
- Compare current state with truth docs.
- Recommend smallest owner-layer repair.

An ordinary local backend change with a known owner and validation path stays in `开发执行`; it does not require this full foundation audit. Reopen backend architecture only when current evidence shows missing or conflicting owners, framework bypass, or a foundation decision mismatch.
