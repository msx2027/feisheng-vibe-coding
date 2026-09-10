# Security

Use `安全审计` for any explicit security-review goal, broad or narrow, and state the audit scope. During normal coding, apply the Security Impact Checklist automatically without requiring a command. Interface and configuration checks are audit scopes or development lenses, not competing user routes.

## Security Principle

Do not ask "is it safe?" Ask:

- What is the risk?
- Where is the rule?
- Which file or framework mechanism handles it?
- How was it verified?
- What remains unverified?

Security must include negative cases, not only normal flows.

For non-technical users, every security result must be explainable in plain Chinese. If the user cannot understand what risk was blocked, the security explanation is not complete.

## Audit Scope Selection

- Use the full audit below when the user asks about the whole project, release safety, attack exposure, or does not know which security surface matters.
- For a clearly narrow audit goal, keep the same read-only boundary and finding format but inspect only the named surface plus directly connected trust boundaries. Examples include one interface, role rule, upload path, secret/config surface, log path, or privacy concern.
- A narrow audit must not silently become permission to scan, start, mutate, or repair the whole project. Expand scope only when evidence shows a connected risk and explain the reason first.

## `安全审计` (Full Security Audit)

Goal: inspect the project's real attack surface, produce evidence-backed findings, and give a prioritized remediation plan before any broad security changes are made.

Use this route when the user asks whether the whole project is safe, requests a security audit or security health check, wants an audit before release, or cannot tell whether interface, configuration, data, integration, and deployment risks should be checked separately.

### Read-only Audit Boundary

A request to audit does not authorize remediation. By default:

- Read code, configuration shape, dependency manifests, schemas, migrations, deployment files, tests, logs supplied for review, and current git state.
- Without additional approval, limit execution to file inspection and commands already proven read-only for this project.
- Before any check that may write the workspace, caches, build output, database, queue, logs, running services, provider sandbox, device, or external state, explain the expected side effects and get explicit user approval.
- Do not edit product code, rotate or reveal secrets, change dependencies, rewrite permissions, migrate data, change provider consoles, alter firewall rules, deploy, or touch production state.
- Do not turn findings into automatic remediation. Report the evidence and recommended repair order first.
- If the user already gave explicit permission to fix a clearly bounded issue, fix only that agreed scope. New architecture, auth, schema, secret rotation, production, or destructive work still needs a separate decision.

Audit these lanes and mark each one `通过`, `有风险`, `不适用`, or `未验证`:

1. Attack surface: public pages, APIs, admin tools, uploads, generated files, callbacks, jobs, internal tools, preview URLs, and provider entry points.
2. Identity and access: authentication, authorization, role boundaries, data ownership, administrator paths, password reset, session/token behavior.
3. Input and execution: validation, mass assignment, injection, file handling, unsafe HTML/template rendering, command execution, model/tool output handling.
4. Data and database: reads/writes/deletes, sensitive fields, transactions, migrations, backup/restore/rollback, audit needs, database/cache exposure.
5. Configuration and privacy: secrets, `.env` examples, repo history risk, logs, errors, exports, screenshots, third-party data transfer.
6. Third parties and money: official documentation, scopes, signatures, replay protection, idempotency, sandbox/production separation, entitlement truth.
7. Abuse and resilience: resource abuse, rate/size limits, duplicate requests, retries, timeouts, quotas, expensive operations, user-visible failure states.
8. Release surface: development/production isolation, debug mode, public/private settings, HTTPS/domain/callbacks, monitoring, rollback, production ownership.

Every finding uses the common Finding Schema owned by `audit-artifact.md`
(编号, 严重度, 问题, 影响对象, 位置, 证据, 根因, 现有防护, 最佳方案与理由, 修复涉及代码点,
修复后验证, 状态) and adds the security-specific fields:

- Lane: which of the eight lanes above the finding belongs to.
- Attacker precondition: anonymous, any logged-in user, another tenant, or an
  administrator.
- Exposure: public, authenticated, internal-only, or release-only surface.
- Realistic consequence in plain Chinese: what an attacker or a mistaken user
  can actually do, so a non-technical owner understands what was blocked.
- Recommended repair owner and order relative to the other findings.
- Negative-path evidence still required after repair, from the security list in
  `routes-validation.md`.

End with one verdict: `可继续开发`, `修复阻断项后继续`, `暂缓上线`, or `禁止上线`. This verdict describes the audited evidence only; it is not permission to modify the project.

Whether the audit is delivered only in conversation or also as a report file
under `audits/`, and the three passes it must run, are decided by
`audit-artifact.md`; this file owns only the lanes, the security fields, and
the verdict.

For a standalone `安全审计`, negative requests, database before/after checks, provider sandbox calls, active scanners, dependency installation, builds, tests, and startup commands are evidence options, not default audit permission. If they were not separately approved and run, list them as the next validation step and mark the result `未验证`. This read-only limit applies to the audit route only; implementation work under `开发执行` runs its negative requests through Runtime Boundary Verification in `testing-strategy.md`.

## Security Impact Checklist

Apply this checklist automatically before and after code, configuration, data, integration, or release changes. The user does not need to ask for security explicitly.

Ask whether the change touches:

- Identity, authentication, session, role, authorization, tenant, or data ownership.
- User-controlled fields, hidden fields, mass assignment, uploads, URLs, HTML/templates, SQL/query construction, commands, or model output.
- Money, inventory, quota, credits, entitlement, irreversible status, deletion, or multi-table writes.
- Secrets, environment variables, logs, errors, exports, screenshots, analytics, or private user/project data.
- Third-party APIs, OAuth scopes, webhooks, signatures, retries, idempotency, provider data transfer, or production credentials.
- Public routes, admin tools, storage buckets, generated assets, preview links, database/cache ports, or release settings.
- Resource abuse: request floods, repeated submissions, large uploads, unbounded pagination, expensive queries/jobs/model calls, missing timeouts, or missing quotas.

If none applies, record that no security boundary changed and continue with ordinary targeted verification. If any applies, execute the matching negative request now through the real entry as part of Runtime Boundary Verification owned by `testing-strategy.md`, record status and redacted response, and keep the result in the task's completion evidence; a negative case written only into a plan is not evidence. When a protected lane is active, the deterministic owner-bound test required by `T2` is in addition to, not instead of, the live negative request. Do not run the entire Full Security Audit for every local change.

## Interface Security Scope

Check these boundaries:

- Authentication: who sent the request and whether they are logged in.
- Authorization: whether that user can do this action.
- Input validation: whether frontend data is trusted too much.
- Field allowlists and mass assignment: whether callers can submit hidden, role, owner, price, status, or other server-owned fields.
- Data ownership: whether users can access or change other people's data.
- Password and administrator account rules.
- Injection risk.
- Public/private exposure: whether pages, files, uploads, generated assets, previews, or admin routes are accessible to people who should not see them.
- Resource abuse: whether request frequency, payload/file size, pagination, expensive jobs, and repeated state changes have appropriate bounds.
- Over-defense and dead code.

Output a security boundary table:

- Interface.
- Risk.
- Rule.
- Processing location.
- Validation method.
- Evidence.
- Status.

Do not summarize security as "handled" or "safe". Each row must name the risk, rule, processing location, and proof.

## Frontend Input Is Not Trusted

Backend must re-check data that affects:

- Identity.
- Role.
- Permission.
- Money.
- Inventory.
- Data ownership.
- Database writes.
- Status changes.

Frontend validation improves experience but does not secure backend rules.

## AI And LLM Feature Safety

Use this section when the project includes AI chat, AI generation, document analysis, agent actions, RAG/search, tool calls, plugins, workflow automation, or any model that reads user/private/project data.

Check:

- Prompt injection: external text, uploaded files, retrieved docs, web pages, user content, or provider responses must not be allowed to override system/business rules.
- Sensitive information disclosure: prompts, logs, traces, model outputs, screenshots, exports, and error messages must not reveal secrets, private docs, customer data, tokens, or internal instructions.
- Reusable or publishable Skill artifacts, documentation, examples, fixtures, and test cases must never copy private project evidence into the distributable repository. Real project names, paths, component or owner identifiers, business-specific terms, user content, screenshots, and trace excerpts can be used only in private audit evidence; publishable coverage uses synthetic, non-identifying substitutes that preserve the tested topology without preserving provenance.
- Untrusted output handling: model output must not be executed, rendered as raw HTML, used as SQL, used as shell commands, or trusted as a permission/payment/business decision without validation.
- Excessive agency: AI tools must not delete data, send emails, charge money, publish content, change permissions, rotate secrets, or call external APIs without scoped permission and human confirmation when impact is high.
- Cost and abuse: model calls need rate limits, quotas, timeout, retry rules, and user-visible failure states when relevant.
- Data retention: know what is sent to the provider, what is stored locally, what can be deleted, and what consent or notice is needed.
- External model evaluation: consume the fresh-session producer contract owned by `testing-execution-gates.md`. A synthetic prompt or fixture does not authorize loading the user's normal home, runtime memory, unrelated Skills, plugins, session history, or other project data. Release evidence must come from the isolated producer boundary and carry a passing privacy scan; a contaminated run is an incident artifact, never reusable release evidence.

Output an AI safety table:

- AI feature.
- Data entering the model.
- Model/provider.
- Action allowed.
- Action forbidden.
- Validation location.
- Human confirmation needed.
- Evidence.
- Status.

Do not present an AI feature as production-ready if prompt injection, sensitive output, tool permissions, and provider data handling are unreviewed.

## Password And Admin Accounts

Check:

- Password length.
- Character rules.
- Common weak password rejection when appropriate.
- Password hash storage.
- Login failure limits when needed.
- Stronger administrator requirements.
- Reset and change-password flows.

Never store plaintext passwords.

## Permissions

Separate:

- Authentication: who you are.
- Authorization: what you can do.

Check vertical privilege issues, such as normal users calling admin APIs.

Check horizontal privilege issues, such as a logged-in user changing an ID and seeing another user's data.

Create a permission table:

- Interface.
- Login required.
- Roles allowed.
- Own-data only.
- Admin access.
- Check location.
- No-permission response.
- Test evidence.

## Injection

User input must not be directly inserted into:

- SQL.
- Database queries.
- System commands.
- HTML.
- Templates.

Prefer mature mechanisms:

- ORM.
- Parameterized queries.
- Query builders.
- Whitelist fields.
- Escaping or sanitization where appropriate.

Be suspicious of custom filtering code presented as complete security.

## Over-Defense

Security is not maximum code volume.

Reject:

- Repeated checks already guaranteed by the framework.
- Impossible branches.
- Dead code.
- New security wrappers without a real risk.

Keep strict checks where business impact exists: login, permission, ownership, money, inventory, status, sensitive data.

## Configuration Security Scope

Check:

- Secrets hard-coded in source.
- Database URL/password.
- Login token secrets such as JWT keys.
- Third-party API keys.
- Initial administrator password.
- Payment or notification secrets.
- Whether real secrets appeared in repo history.
- Whether example config files contain placeholders only.
- Whether key rotation is needed.

## Logs

Logs must not record raw:

- Passwords.
- Tokens.
- Secret keys.
- Phone numbers when not needed.
- ID numbers.
- Payment data.
- Sensitive callbacks.

Ask for normal request log and error log examples.

## Dependencies

List frameworks, libraries, and SDKs with versions. Pay special attention to:

- Network requests.
- Authentication.
- Encryption.
- File upload.
- Database connection.
- Logging.

Check current advisories when risk matters. Upgrade only after explaining impact.

## Public Exposure

Before any public URL, preview deployment, client handoff, or shared demo:

- Confirm whether the app, preview, storage bucket, uploaded files, generated files, admin pages, API docs, logs, and internal docs are public or private.
- Check platform privacy settings instead of assuming defaults are safe.
- Make sure search engines should or should not index the app.
- Verify no real customer data, medical/financial/private information, internal planning, or secret-like content is visible.
- Verify admin routes and internal tools require authentication and authorization.

For non-technical users, explain the difference between "anyone with the link can open it" and "only approved users can access it".

## Third-Party Provider Security

For third-party APIs, SDKs, OAuth, payment, webhooks, maps, AI providers, storage, messaging, analytics, or platform services, require official documentation evidence before implementation.

Check:

- Secret storage and rotation.
- OAuth scopes or API permissions.
- Webhook signature verification.
- Replay protection.
- Idempotency for payment, order, message, or state-changing calls.
- Rate limits and retry strategy.
- Sensitive data sent to provider.
- Sensitive data logged locally.
- Callback URL/domain verification.
- Sandbox versus production separation.
- User-facing failure state.

If docs are unavailable, mark the integration security review `未验证`.

## Payment And Entitlement Security

For payments, subscriptions, memberships, paid credits, usage quotas, paid downloads, or paid reports:

- Backend must own paid access checks.
- Provider webhook or server verification must be the source of payment truth.
- Webhook signatures must be verified.
- Duplicate webhook events must be idempotent.
- Refund, cancel, expiry, dispute, and failed renewal must update or remove entitlement according to product rules.
- Frontend success pages, local storage, URL parameters, or disabled buttons are not entitlement truth.
- Admin manual grants/revokes require strong authorization and audit logs.

Do not mark paid features ready if entitlement truth and provider verification are `未验证`.

## Database Operation Safety

For important data, list:

- Which interfaces read it.
- Which interfaces modify it.
- Which interfaces delete it.
- Login checks.
- Permission checks.
- Ownership checks.
- Business rules.
- Soft delete needs.
- Transaction needs.
- Audit log needs.

Operations touching multiple tables, money, inventory, coupon, balance, or payment records usually need transactions.

Prefer validating normal business behavior through the API path, because real users do not directly edit the database. Use database checks as before/after evidence, not as a substitute for endpoint validation.

## Evidence

Security validation should include:

- Normal request.
- Invalid parameters.
- Not logged in.
- No permission.
- Accessing another user's data.
- Database before/after evidence.
- Relevant logs.

Mark missing proof as `未验证`.

For each new or changed interface, do a business-and-security double validation:

- Normal request succeeds.
- Invalid input is rejected.
- Not-logged-in access is blocked when required.
- Wrong-role access is blocked.
- Cross-user or cross-tenant data access is blocked when ownership matters.
- Database before/after evidence matches the business rule.
- Logs help diagnose the action without leaking sensitive data.
