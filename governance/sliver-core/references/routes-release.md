# Release Routes

Use this file for deployment-route decisions, release readiness, handoff, and the internal drift-control gate.

## Contents

- `部署路线`
- `发布准备`
- `上下文交接`
- Internal `防漂移` gate

## Programming-Owned Production Security

Release safety in this skill covers engineering and runtime boundaries only.

Check these boundaries when applicable:

- Development and production isolation: separate environments, credentials, databases, storage, callbacks, provider modes, and data. Test data must not silently become production data.
- Production debug mode: debug pages, verbose stack traces, dev tools, sample accounts, seed routes, API explorers, and unsafe diagnostics are disabled or access-controlled.
- Database and cache exposure: databases, Redis/cache, queues, admin panels, internal APIs, storage management, and metrics endpoints are not broadly exposed to the public internet. If exposure is required, document the access-control owner and evidence.
- Secrets and logs: production secrets come from the approved configuration owner; logs, traces, errors, exports, and screenshots are redacted.
- Data change safety: migrations have backup/restore/rollback and data-loss notes; important multi-table or money/status changes have transaction and idempotency evidence.
- Public surface: preview links, admin paths, uploads, generated files, buckets, API docs, source maps, internal docs, health/metrics endpoints, and search indexing match the intended audience.
- Resource protection: request/body/upload limits, timeouts, retries, quotas, expensive jobs, and provider cost ceilings match the real traffic risk.
- Runtime change discipline: do not patch production files or databases manually as the primary release process. Use versioned source, migrations, deployment commands, and post-release verification.

Host-specific firewall, SSH, operating-system, container, or cloud controls belong in a deployment adapter for the real platform. Do not turn one server setup into a universal project rule. Never promise that application code alone prevents infrastructure attacks.

## `部署路线`

Goal: choose one deployment route before the agent changes external state or treats a preview URL as production.

Use this when the user asks where to deploy, wants a public URL, plans to hand off to a client/team, or has a stack but no production route.

Procedure:

1. Confirm the release target: local self-use, internal team, private beta, client delivery, public production, or demo only.
2. Read current stack, framework docs, package scripts, backend/database/storage/auth/provider needs, and deployment files.
3. Classify the app form: static frontend, SPA, full-stack web, API backend, serverless function, worker, mobile app, mini program, desktop/local tool, or automation script.
4. Compare deployment options and choose one primary route. Prefer managed, mainstream, official or framework-recommended routes for non-technical users when they fit.
5. Check Development and production isolation, env vars, secret storage, production owner, placeholder docs, and whether Production debug mode is disabled.
6. Check database, storage, migration, backup, restore, rollback, and seed data needs.
7. Check public/private exposure and Database and cache exposure: app privacy setting, admin path, upload files, internal docs, generated assets, preview URLs, database/cache/internal-service access, and search-engine indexing risk.
8. Check domain, HTTPS, CORS, OAuth redirect URI, webhook URL, callback verification, and provider console settings.
9. Check monitoring/logs, health check, support owner, cost/quota/billing owner, and provider lock-in.
10. Recommend one deployment route. Before `发布准备`, ask the user to confirm only the release target, public/private exposure, required accounts or cost, downtime/data operations, and other irreversible external effects.

Output:

- Recommended deployment route.
- Why it fits this project.
- Rejected routes and why.
- Required accounts and services.
- Env/secret plan.
- Data/migration/backup/rollback plan.
- Public/private exposure decision.
- Cost/quota notes.
- Pre-release blockers.
- User approval needed.

Invalid:

- Saying "just deploy to Vercel/Netlify/Render" without stack and backend/data evidence.
- Skipping privacy settings for public URLs.
- Treating preview deployment as production readiness.

## `发布准备`

Goal: prepare a project or stage to be used outside local development by real users, a team, or a customer.

Do not deploy first and explain later. Produce a release readiness report before changing external state.

Check:

- Release target: local handoff, internal team, private beta, public production, or client delivery.
- Environment separation: local, test/staging, production.
- Build/run commands and exact artifacts.
- Environment variables, secret storage, `.env.example`, key rotation needs, and production secret ownership.
- Domain, callback URLs, OAuth redirect URIs, webhook URLs, CORS, HTTPS, storage bucket, email/SMS/payment/provider console settings when relevant.
- Database migration plan, seed data, backup, restore, rollback, and data-loss risk.
- Third-party production/sandbox switch, quota, billing, rate limits, webhook signature, idempotency, and failure handling.
- Security/privacy: sensitive data, logs, admin accounts, password reset, access control, and dependency/license compatibility when it directly affects build or distribution.
- Monitoring and support: health check, error logs, request logs, alert owner, support path, known unverified items.
- Cost and resource limits: hosting, database, storage, provider API, email/SMS/payment fees, expected first-month risk.
- Public surface: README or handoff notes, user instructions, admin instructions, not internal truth docs.
- Fake-done check: no mock data, fake success state, unconnected backend, skipped migration, or sample-provider path is being presented as real production behavior.
- Git/release checkpoint: branch, commit, tag or release note when appropriate.

Output:

- Release readiness verdict: `可发布`, `可内测`, `暂缓发布`, or `禁止发布`.
- Blocking issues.
- Pre-release checklist.
- Deployment steps.
- Rollback steps.
- Post-release verification.
- Known risks and owners.
- User confirmations required.

Release is invalid if rollback, secrets, database migration, third-party production settings, or monitoring/log evidence are skipped while the project is meant for real users.

### Executable release verdict

Keep artifact deployment separate from behavior that exercises money, permissions, persistent state, or an external provider. A green build may prove that an artifact can be packaged or deployed; it does not prove that a real-money or real-user state machine is safe to exercise.

When a release verdict covers sandbox or real funds, activate `money_entitlement` and require collected evidence for lifecycle/state effects, idempotency/replay, failure recovery, the protected boundary, and current external state. Missing evidence permits only `defer` or `block`; do not relabel a deployable artifact as a real-funds test candidate.

Validate the record against Host/Coordinator-provided artifact identity, source revision, and complete active risk-lane set:

The `--kind release` command is the only executable release-verdict interface.

```bash
python3 -B scripts/runtime_governance_contract.py --kind release --record <record.json> --context <host-context.json>
```

Map internal verdicts to user-facing results: `release_ready` -> `可发布`, `sandbox_ready` -> `可内测`, `defer` -> `暂缓发布`, `block` -> `禁止发布`; `artifact_only` describes only a build/package plane and is never a funds authorization.

If release is not completed in the current window, or another agent/user will continue the release, run `上下文交接` before ending.

## `上下文交接`

`context-handoff.md` is the sole procedure owner. This route contributes only
release-specific inputs: release target, artifact identity, deploy/migration
state, rollback, monitoring, public exposure, and still-unverified release
planes. Do not copy the general handoff procedure here.

## Internal Gate: `防漂移`

`project-flow.md` is the sole trigger and procedure owner. This release route
contributes only release evidence that may have drifted: confirmed target,
artifact/source identity, migration/rollback/monitoring state, Git boundary,
and public exposure. Load `project-flow.md` when this gate activates; do not
maintain a second drift-control procedure here.
