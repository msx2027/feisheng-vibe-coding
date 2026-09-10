# Beginner Failure Modes

Use this reference when a non-technical user is stuck, overwhelmed, unsure whether the project works, or when an AI-generated project has started to look impressive but behave unreliably.

## Contents

- Core Principle
- Non-Technical Output Shape
- Common Failure Modes
- `环境启动`
- `报错救援`
- `AI债务体检`
- `用户验收陪跑`
- `部署路线`
- Fake Done Guard
- AI Context Hygiene
- Recommended Defaults For Non-Technical Users

## Core Principle

The user should not have to act like a developer.

The agent owns technical diagnosis, risk classification, implementation boundaries, validation evidence, and the next recommended route. Inspect available project and runtime evidence first. Ask at most 1-3 questions, and only for an observable fact or product decision that is still undiscoverable and changes the result:

- What they want the product to do.
- What they clicked.
- What they saw.
- Which exact error text, screenshot, URL, account setting, or file path is available.
- Whether a recommended business tradeoff is acceptable.

Do not ask the user whether to create truth documents, define design tokens, research official documentation, choose validation evidence, or decide architecture, security, dependency versions, database design, or deployment route. The agent owns those decisions and presents one recommendation when a product-visible trade-off needs confirmation.

## Non-Technical Output Shape

For confused users, respond in this structure:

1. `现在判断`: one plain-language diagnosis.
2. `我建议先做`: one next route, not a menu.
3. `为什么`: risk of skipping this route.
4. `我需要你确认`: 1-3 observable answers or business decisions.
5. `我会怎么证明`: command, screenshot, API example, database evidence, or click-path evidence.

Avoid long code dumps. If code is necessary, explain what file it belongs to and how success will be verified.

## Common Failure Modes

| Failure mode | User phrasing | Real risk | Route |
| --- | --- | --- | --- |
| Project cannot start | 跑不起来, 本地打不开, npm 报错, 端口占用 | no reliable baseline, wrong folder, missing env, dependency/version mismatch | `环境启动` |
| Error loop | AI 一直改还报错, 又坏了, 同一个错误反复出现 | random patching, wrong failing boundary, stale context | `报错救援` |
| Unclear next step | 不知道该干嘛, 项目整体看看 | stage unknown, missing truth docs, hidden Git/security risk | `项目体检` |
| AI-generated sprawl | 文件好多, 组件重复, 看不懂哪些有用 | technical debt, parallel patterns, dead code, unowned logic | `AI债务体检` |
| Fake completion | AI 说完成但页面不对, 都是 mock | mock/fallback path shipped as real behavior | `验收` or `AI债务体检` |
| User cannot verify | 我怎么确认, 我该点哪里 | user forced to judge code instead of behavior | `用户验收陪跑` |
| Deployment unknown | 想上线但不知道放哪里 | wrong platform, missing env, public exposure, no rollback | `部署路线` |
| Secret or data exposure | 会不会泄露, 要推 GitHub | private docs, `.env`, customer data, public app settings | `git保护` or scoped `安全审计` |
| Third-party mismatch | API 接不上, OAuth 回调不对 | old docs, console config mismatch, sandbox/production confusion | `开发执行` with `third-party-provider` lens |
| Security illusion | 前端隐藏按钮就当权限 | backend does not enforce auth/ownership | `开发执行` with `identity-permission` and `security-impact` lenses |
| Cost surprise | AI、短信、存储突然收费 | quotas, billing owner, rate limits not designed | `开发执行` with `third-party-provider` lens, then `部署路线` when release is involved |
| Data loss | 数据库被清空, 迁移乱了 | destructive migration, no backup/rollback | `数据库设计`, `发布准备` |

## `环境启动`

Goal: produce a reliable local first-run baseline before feature work.

Use this when the project cannot run, the start command is unknown, dependencies are broken, environment variables are missing, or the user inherited a project and does not know how to open it.

Procedure:

1. Confirm the real project root and Git state before running install or build commands.
2. Identify package manager and runtime from lockfiles and config: npm/pnpm/yarn, Python, Go, Rust, Docker, framework config, Node version, Python version, or equivalent.
3. Inspect scripts and existing docs for install, dev, build, test, migration, seed, and preview commands.
4. Check `.env.example` or config templates. If missing, create or propose placeholders only; never invent real secrets.
5. Identify required local services: database, Redis, object storage emulator, backend server, frontend server, Docker service, or third-party sandbox.
6. Run the smallest safe command that proves the next state, when the environment allows it.
7. If install requires network or writes outside the allowed workspace, ask for approval or mark `未验证`.
8. Produce a first-run map the user can understand.

Output:

- Project root.
- Runtime and package manager.
- Install command and whether it was run.
- Start command and whether it was run.
- Required env vars with placeholder meanings.
- Required local services.
- First visible proof: URL, screenshot, health check, command output, or exact blocker.
- Next route if the project still cannot run.

Invalid:

- Saying "run npm install" without checking package manager and lockfile.
- Starting feature work before the project has a known run baseline.
- Putting real API keys into docs or commits.

## `报错救援`

Goal: stop random patching and find the first failing boundary.

Use this when an error repeats, AI has already tried multiple fixes, the app breaks after a change, or the user only has a screenshot/error text.

Procedure:

1. Capture exact evidence: command, URL, screenshot, stack trace, browser console, network error, API response, database error, or provider console message.
2. Reproduce the error if possible. If not possible, state what evidence is missing.
3. Classify the error:
   - setup/install/runtime
   - syntax/type/build
   - frontend render/state
   - API/network/CORS
   - backend route/service
   - database/schema/migration
   - auth/permission/session
   - third-party provider
   - deployment/platform
4. Find the first failing boundary. Do not fix downstream symptoms first.
5. Check official docs, current framework conventions, or upstream issue notes when the error comes from framework, SDK, provider, deployment platform, or package behavior.
6. Make the smallest targeted fix.
7. Re-run the failing command/path.
8. Apply the attempt-escalation sequence owned by `engineering-execution.md`. When it requires a reframe or architecture audit, summarize attempts, disproof, missing evidence, and the next safest route in plain language.

When the bug is not obvious, has appeared after recent edits, involves dependencies/frameworks/providers/deployment, or has already been guessed at by AI, add stricter evidence before changing more code:

- Reproduce the exact failure or state the missing evidence.
- Inspect the current call chain and config before editing.
- Check recent git history for the touched files when it may be a regression.
- Check official docs, release notes, GitHub issues, or provider docs when external behavior may be involved.
- Keep one small hypothesis table with evidence for/against and the next disproof step.
- Add or name the regression gate that proves the fix.

Output:

- Error evidence.
- Error category.
- First failing boundary.
- Root cause or best current hypothesis.
- Git/upstream evidence when relevant.
- Files changed, if any.
- Validation result.
- Regression gate.
- If unresolved, exact next evidence needed.

Invalid:

- Editing multiple unrelated layers to "try things".
- Hiding failed attempts.
- Declaring fixed without rerunning the failing path.
- Asking the user to understand stack traces without translating them into plain language.

## `AI债务体检`

Goal: detect whether AI-generated code has created a project that looks big but is hard to continue safely.

Use this before adding features to a project with many AI sessions, repeated rewrites, unexplained files, inconsistent UI, duplicate components, multiple SDK routes, fake data, or custom wrappers.

Check:

- Duplicate pages, components, services, APIs, schemas, config files, and provider wrappers.
- Dead routes, unused files, commented-out old implementations, TODO/FIXME piles, and backup files.
- Mock/fake data in user-visible flows.
- Fallback paths that silently pretend success.
- Hardcoded copy, styles, API URLs, IDs, user roles, secrets, or test accounts.
- Dependency sprawl: libraries added for one prompt but not actually needed.
- Multiple state-management, form, request, auth, UI, or database patterns in one area.
- Generated code that bypasses framework conventions.
- Weak typing, broad `any`, disabled lint rules, ignored errors, blanket try/catch, or swallowed exceptions.
- Inconsistent design tokens, spacing, colors, buttons, tables, empty states, loading states, and error states.
- Security illusions: frontend-only permission, hidden buttons instead of backend rules, fake admin checks.

Output:

- Debt summary in plain Chinese.
- `必须先修` list: blocks feature work, safety, data, or release.
- `可以排期` list: hurts maintainability but not current route.
- `暂不处理` list: harmless or not worth touching now.
- Recommended cleanup route.
- Files or modules likely affected.
- Validation method after cleanup.

Invalid:

- Rewriting the whole project because it is messy.
- Adding new features on top of duplicate or fake owner layers.
- Deleting files without proving they are unused.

## `用户验收陪跑`

Goal: let a non-technical user confirm behavior without reading code.

Use this after implementation or before acceptance when the user asks how to check whether a feature is correct.

Procedure:

1. Translate the feature into a short user story.
2. Provide a click path or request path, one step at a time.
3. State the expected visible result after each step.
4. Include negative checks when relevant: empty input, wrong role, not logged in, third-party failure, canceled action, refresh page, mobile size.
5. Tell the user what screenshot, screen text, URL, or result to report.
6. Link the user-side result back to technical evidence when available.

Output:

- `你要验证什么`.
- `请按这个顺序点`.
- `每一步应该看到什么`.
- `如果看到这些情况就算失败`.
- `我已经验证过的技术证据`.
- `还需要你确认的体验点`.

Invalid:

- Asking the user "看代码应该没问题吧".
- Only listing test commands when the user needs product behavior.
- Omitting negative cases for login, permission, payment, upload, or third-party flows.

## `部署路线`

Goal: choose one deployment route before release work changes external state.

Use this when the user wants to deploy, publish, give to customers, run production, share a public URL, or choose a hosting/cloud/platform route.

Decision rules:

- Prefer managed, mainstream, well-documented routes for non-technical users when they fit the project.
- Prefer platform conventions and official integrations over hand-rolled servers, custom scripts, and obscure infrastructure.
- Choose one primary route. Compare alternatives only to explain why they are not primary.
- Do not deploy sensitive internal tools publicly by default.
- Do not treat a preview URL as production readiness.

Check:

- Product form: static site, frontend app, full-stack app, API backend, worker/function, mobile app, mini program, desktop/local tool.
- Current stack and official deployment recommendations.
- Database, storage, auth, email/SMS, payment, AI provider, cron/job, queue, or webhook needs.
- Environment separation: local, preview/staging, production.
- Secrets: where they are stored, who owns them, how examples are documented.
- Public/private exposure: who can access the app, admin routes, uploaded files, internal docs, generated assets.
- Domain, HTTPS, OAuth redirect, webhook URL, CORS, callback verification.
- Migration, seed, backup, restore, rollback.
- Logs, monitoring, health check, error reporting, support owner.
- Cost, quota, billing owner, free-tier risk, provider lock-in.

Output:

- Recommended deployment route.
- Why it fits this project.
- Rejected routes and why.
- Required accounts/services.
- Env and secret plan.
- Data and migration plan.
- Public/private exposure decision.
- Cost/quota notes.
- Pre-release blockers.
- Next route: `发布准备` only after route is accepted.

Invalid:

- Telling a non-technical user to "just deploy to any cloud".
- Choosing deployment before knowing backend/database/provider needs.
- Ignoring privacy settings on public URLs.
- Skipping rollback and log location for real users.

## Fake Done Guard

Before saying a feature is complete, check for these traps:

- The UI works only with mock data.
- The backend endpoint exists but the frontend is not calling it.
- The frontend calls an endpoint but errors are hidden.
- The database migration exists but was not run.
- The code works locally but production env vars are missing.
- The payment, OAuth, webhook, email, SMS, map, storage, or AI provider is only wired to sample code.
- Permissions are enforced only in frontend routes.
- Logs contain sensitive data.
- The user sees a success message even when the real operation failed.

If any trap is present, do not call the work done. Route to `验收`, `安全审计`, `开发执行` with the relevant conditional lenses, or `部署路线`.

## AI Context Hygiene

When the conversation or project context becomes too large:

- Create or update truth docs instead of relying on chat memory.
- Summarize current state, confirmed decisions, rejected routes, and next sub-stage.
- Remove stale assumptions from future prompts.
- If a previous AI conversation produced bad code, inspect files and evidence instead of trusting the conversation.
- If the same error loops, start from reproduction evidence and first failing boundary, not from the previous failed patch.

## Recommended Defaults For Non-Technical Users

Use these defaults unless project evidence says otherwise:

- One next action at a time.
- One recommended technical route.
- Managed platform over self-managed infrastructure.
- Official SDK over raw API calls.
- Framework convention over custom wrapper.
- Truth document before large or risky code change.
- Local Git checkpoint before major AI edits.
- Private internal docs by default.
- Placeholder env examples, never real secrets.
- User-visible validation before "done".
