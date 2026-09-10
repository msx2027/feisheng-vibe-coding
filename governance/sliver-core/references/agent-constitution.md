# Agent Constitution

Use this when creating or revising the project's agent constitution.

## Role

The agent constitution is not a product requirement document and not an architecture manual. It is the highest-level project-specific behavior rule file that the AI must read before work.

It may specialize Sliver for the current repository, but it cannot weaken or override Sliver's universal authorization, risk, testing, fresh-evidence, unique-owner, or release gates. When a project clause conflicts with one of those gates, stop and report the conflict; do not silently choose the weaker rule. Project-specific product, architecture, command, path, and owner facts remain authoritative inside that protected envelope.

Detailed rules belong in truth documents. The constitution references them and prevents the AI from bypassing them.

The bundled base template is `agent-constitution-template.md`. Use it as raw material, not as a fill-in-the-blank form.

## Failure To Avoid

A bad project constitution often looks project-specific because it mentions the project name, stack, and a few directories. That is not enough.

Treat a constitution as failed when:

- It only describes the project briefly at the top, then leaves generic rules unchanged.
- It says "follow current architecture" without naming the actual truth documents.
- It says "respect framework best practices" without naming the actual framework, owner layers, and verification commands.
- It lists frontend or backend facts but does not convert them into enforceable rules.
- It preserves template placeholders, adapter examples, or irrelevant clauses.
- It pretends missing APIs, schemas, auth, or docs already exist.
- It has no owner map.
- It has no stop conditions tied to this project's real risks.
- It has no command evidence that can be run in the repo.
- It cannot explain why each project-specific rule exists.

## `项目宪法` Workflow

Do not start by editing `AGENTS.md`.

First produce a constitution design packet:

1. Project evidence pack.
2. Truth-document inventory.
3. Owner map.
4. Current stack map.
5. Rejected direction and non-goal map.
6. Verification command map.
7. Base-template clause mapping.
8. Missing evidence and user questions.

Only after that, draft the constitution.

## Read-Only Constitution Audit

For `项目宪法`, default to read-only inspection.

Always read `agent-constitution-template.md` and map its clauses during the audit. “This file was not created from the template” is not a reason to skip the mapping; the mapping is how universal redlines and genuinely project-specific adaptations are distinguished.

Allowed without extra approval:

- Reading files.
- Listing files.
- Searching text.
- Inspecting package scripts and config.
- Inspecting Git status.

Do not run these by default:

- Build commands.
- Test commands.
- Dev servers.
- Install commands.
- Code generators.
- Database migrations.
- Deployment or preview commands.
- Any command likely to write cache, generated files, build output, database state, or external state.

Instead, list those commands in the verification command map and mark them `未运行，只读体检未执行`.

## Project Evidence Pack

Collect evidence from current files, not memory or assumptions:

- Project name and product boundary.
- Current repo root and Git status.
- Main frontend stack and entry files.
- Main backend stack and entry files.
- Database/schema/migration state.
- Auth and permission state.
- Config and secret handling.
- Test, build, lint, preview, and run commands.
- Runtime/startup baseline, env placeholders, required local services, and known startup blockers.
- AI-generated debt status when the project has been heavily modified by agents.
- Existing truth documents.
- Existing agent instruction files.
- Known user-confirmed non-goals or rejected directions.

Each item should name the source file or say `未找到`.

## Owner Map

For each concept, name the owner file, folder, or truth document:

- Product positioning.
- Feature list and stage plan.
- Frontend routes.
- UI tokens and design system.
- UI prototype truth, approval state, and design-to-code handoff when the project uses visual prototypes.
- Shared components.
- API contracts.
- Backend business logic.
- Database schema/migrations.
- Auth.
- Permissions.
- Monetization and entitlements when present.
- Config.
- Tests.
- Deployment.
- Runtime/startup.
- AI debt cleanup.
- User acceptance.
- Internal docs.

If owner is missing, do not invent one in the constitution. Mark it as a gap and ask whether to create or document it.

## Base-Template Clause Mapping

Read `agent-constitution-template.md` and map its clauses like this:

| Template area | Decision | Project evidence | Resulting project rule |
| --- | --- | --- | --- |
| Core principles | keep/rewrite | file path or user decision | exact rule |
| Foundation technical judgment | keep/rewrite | product truth, technical-selection truth, current official evidence | AI-owned primary technical route, one-question blocking clarification, and product-consequence-only user confirmation |
| Adapter block | keep/delete | actual stack evidence | exact adapter |
| Stack rule | rewrite/delete | actual technology | exact project rule |
| Security redlines | keep/rewrite/not applicable | auth/data/config/provider/release evidence | exact owner, negative path, stop condition, and validation command |
| Test decision and quality | keep/rewrite | test runner, owner contracts, UI/live boundaries | classification rule, strict TDD boundary, existing-gate reuse, and anti-test-theater rule |
| Validation | rewrite | package scripts/tests | exact command |

Decisions:

- `keep`: universal rule still applies as written.
- `rewrite`: rule applies but must be bound to project files, owners, commands, or risks.
- `delete`: rule is irrelevant to this project.
- `ask`: a missing or contradictory product fact, authorization boundary, or product consequence genuinely requires the user. Missing technical evidence triggers agent research, owner audit, or a bounded PoC instead of asking the user to choose technology.

Do not keep a clause just because it sounds professional.

## Required Content

Include:

- Always read and obey project truth documents.
- For `D2`/`D3` work that meets a stage-materialization trigger, do not change affected owners before current-stage truth is sufficient. `D0`/`D1` and bounded `D2` work may use an inline acceptance contract and fresh targeted validation instead of a stage document.
- Do not change technology stack, framework, directory architecture, database schema, auth, permissions, payment, or core data fields without evidence, one primary recommendation, and plain-language consequences. Ask the user only to confirm product scope, cost, irreversible effects, or major trade-offs they can evaluate.
- For a first or materially changed foundation, the AI owns the technical recommendation and must use current project truth plus current official evidence. If a decision-changing product fact is missing, ask exactly one highest-impact product question at a time; while blocked, do not publish a final or temporary route. The user confirms only product-visible scope, cost, downtime, migration, lock-in, data, or irreversible consequences before foundation implementation.
- Prefer framework-provided mechanisms over custom reinvention.
- Do not add compatibility layers, fallback branches, or broad rewrites without explicit approval.
- Keep changes scoped to the current stage.
- After each stage, report changed files, validation evidence, and unverified items.
- Before claiming a feature is done, require quality evidence: user-visible behavior, negative cases, data effects, regression risk, and security/privacy checks when relevant.
- Before implementation changes, require a test-decision classification. Reuse a causally related existing failure gate; require strict RED -> GREEN for stable automatable behavior that lacks one; use reproducible before/after evidence for credible non-automated boundaries; never let test code pollute production owners or mock behavior count as proof.
- During coding, automatically classify whether the current change touches authentication, authorization, ownership, input trust, secrets, data writes, third parties, public exposure, or resource limits. Apply the relevant negative paths without forcing a full audit onto unrelated local changes.
- Treat a broad security audit as read-only by default: report risk, location, consequence, evidence, priority, and remediation route before changing implementation or production state.
- Preserve universal safety redlines for untrusted frontend input, secrets, audit/remediation authorization, and evidence before safety claims; bind applicable rules to real project owners and commands.
- When UI prototype work applies, require current-project design context, indexed and versioned approval truth, semantic production elements, component/token/theme reuse, and fidelity evidence. Require a separate transparent raster/vector asset only when decomposition proves the element is genuinely an asset; otherwise prefer the current icon system, components, CSS, and tokens. Forbid unapproved implementation and whole-image UI shortcuts.
- Before adding features to an unstable generated project, require AI debt review when duplicate code, mock data, fake success paths, custom wrappers, or repeated error loops are present.
- Before asking a non-technical user to accept work, provide a user acceptance walkthrough: click path, expected result, failure signs, and what screenshot/text to report.
- Before release or customer handoff, require deployment-route and release readiness: environment, secrets, build, migration, rollback, monitoring/logs, public/private exposure, cost/quota, and support owner.
- Mark missing evidence as `未验证`.
- Commit only after a validated checkpoint and explicit user authorization for the exact staged scope. A workflow preference never supplies that authorization.

## Project-Specific Binding

The constitution must reference actual project files, such as:

- Project brief.
- Function list.
- Stage plan.
- Technical selection.
- Frontend architecture truth.
- Database design.
- Backend architecture truth.
- Security boundary.
- Monetization and entitlement truth.
- Runtime/startup notes.
- Current stage implementation truth.
- Quality evidence.
- User acceptance checklist.
- AI debt notes.
- Deployment route decision.
- Release and operations notes.

Do not paste a generic constitution without adapting it to the project's real stack and documents.

## Constitution Structure

Prefer this structure:

1. Language and scope.
2. Project boundary and non-goals.
3. Current truth priority.
4. Required workflow.
5. Owner map and architecture rules.
6. Stack-specific rules, grouped by actual stack only.
7. Product-specific rules.
8. Data, auth, permission, and security rules.
9. Validation commands.
10. Documentation rules.
11. Git rules.
12. Multi-agent rules.
13. Stop-and-ask conditions.
14. Handoff rules when relevant.

Do not include sections for technologies the project does not use.

## Placement

Different AI coding tools read different files. Ask the current tool where it automatically reads agent instructions. Common names include `AGENTS.md`, but do not assume a universal filename.

If the repo already has an agent instruction file, update it carefully instead of creating a duplicate competing file.

## Keep It Lean

The constitution should stay short. Put detailed backend response examples, database field lists, security tables, and UI token rules in their own truth documents.

## Anti-Shallow Validation

Before writing or finalizing the constitution, check:

- No unresolved `@@...@@` placeholders.
- No generic adapter examples that do not apply to the project.
- Every project-specific rule has a source path, owner, command, or user decision behind it.
- Every actual stack has at least one concrete rule and one verification command or reason why no command exists.
- Every stop condition references a real project risk.
- Runtime/startup, AI debt, user acceptance, and deployment/release rules are included when relevant.
- Universal safety redlines remain present, and applicable auth/data/config/provider/release rules name their real owner and validation evidence.
- Universal test-decision rules remain present: classification cannot be skipped, strict TDD applies at the correct behavior boundary, existing gates are not duplicated for ceremony, and test theater cannot satisfy validation.
- Foundation rules remain present when the project is new or its foundation is being changed: AI-owned technical judgment, one primary route, one blocking product question at a time, current official evidence, and user confirmation limited to product consequences before implementation.
- UI rules remain present when visual prototypes are generated or implemented: project-context reading, prototype truth and approval state, immutable approved versions, component and asset decomposition, theme/responsive behavior, and semantic fidelity validation.
- Missing areas are marked as gaps, not silently filled.
- The constitution distinguishes current truth from future plans.
- It says what not to do, especially rejected product directions and forbidden compatibility.
- It does not duplicate large truth-document content.
- `python3 -B <sliver-runtime-root>/scripts/check_project_guardrails.py <project-root> --mode constitution` passes after the constitution is written when a local project path is available; `<sliver-runtime-root>` comes from the active runtime adapter, not the project cwd.
- A non-technical user can ask "what does this rule protect?" and get a clear answer.

If two or more checks fail, do not write the constitution yet. Return a rewrite plan.

## Verdict Thresholds

Use these verdicts for `项目宪法`.

`合格` requires all of these:

- Evidence pack exists and names source files.
- Owner map covers product, frontend, backend when present, database when present, auth, permissions, config, tests, docs, and Git.
- Base-template clause mapping exists with keep/rewrite/delete/ask decisions.
- No unresolved placeholders or irrelevant adapter examples.
- Stack-specific rules are bound to actual files or commands.
- Validation command map exists and distinguishes commands inspected from commands actually run.
- Test-decision and test-quality rules are present and preserve classification, existing-gate reuse, strict RED -> GREEN when applicable, and anti-test-theater boundaries.
- Stop conditions reference real project risks.
- No false claim that missing API, schema, auth, or backend capability already exists.

`只能作为临时约束` applies when:

- Some project-specific facts and paths are present.
- No major false fact is found.
- But at least one required map is missing: evidence pack, owner map, clause mapping, non-goal map, or validation command map.
- Or rules are useful but too soft, such as "at least consider" without required evidence.

`需要重写` applies when:

- It is mostly the base template with a project name pasted in.
- It contains stale or false project facts.
- It preserves irrelevant template placeholders or adapter examples.
- It pretends missing APIs, schemas, auth, permissions, or backend features exist.
- It conflicts with current code or truth docs.
- Two or more core maps are missing and the current file cannot reliably constrain future agents.

## `项目宪法` Output Shape

Use this when auditing an existing constitution:

```text
结论：合格 / 需要重写 / 只能作为临时约束

判定依据：
- ...

项目证据包：
| 项目 | 证据 | 状态 |
| --- | --- | --- |
| ... | ... | 已确认 / 未找到 / 冲突 |

Owner map：
| 概念 | Owner | 证据 | 缺口 |
| --- | --- | --- | --- |
| ... | ... | ... | ... |

底板条款映射：
| 底板区域 | 决策 | 项目证据 | 结果 |
| --- | --- | --- | --- |
| ... | keep/rewrite/delete/ask | ... | ... |

反浅改验收：
| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| ... | 通过 / 失败 / 未验证 | ... |

有效部分：
- ...

浅改或空泛部分：
- 条款：
  问题：
  应该绑定到：

缺失部分：
- ...

错误或过期部分：
- ...

下一步：
- ...
```

For weak constitutions, do not patch one or two sentences. First rebuild the evidence pack and clause mapping.
