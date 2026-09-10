# 能力索引（生成物）

> 本文件由 `scripts/build-capability-index.ps1` 从 `provenance/CANONICAL-CATALOG.json` 生成；**禁止手工编辑**。
> 分类唯一真源是 `provenance/SKILL-CLASSIFICATION.json`；改分类 = 改该文件后重生成 catalog。
> 新鲜度校验：`pwsh scripts/verify.ps1`。

统计：共 **82** 项来源技能 —— 可用 4、待启用 7、来源专用 61、阻塞 2、兼容/排除 8。

## 现在可用（进入 runtime 静态投影）

仅 `decisionPolicy.acceptedStatuses` = `control-plane`, `accepted-primitive` 可进入 runtime；其余一律排除。

| id | 来源 | 域 | 状态 | 路径 |
|---|---|---|---|---|
| `codebase-design` | mattpocock-skills | primitive | accepted-primitive | `skills/engineering/codebase-design/SKILL.md` |
| `diagnosing-bugs` | mattpocock-skills | primitive | accepted-primitive | `skills/engineering/diagnosing-bugs/SKILL.md` |
| `domain-modeling` | mattpocock-skills | primitive | accepted-primitive | `skills/engineering/domain-modeling/SKILL.md` |
| `sliver-vibe-coding` | sliver-vibe-coding | control-plane | control-plane | `governance/sliver-core/SKILL.md` |

再次提醒：投影是**静态候选**，宿主 discovery / trust / fresh-session smoke 仍为 `UNVERIFIED`。

## 已审查、待启用

已具备适配条件但未进入 runtime。进入 runtime 需要行为证据（切换 `readiness` 为 `accepted`）。

| id | 来源 | 域 | 原因 |
|---|---|---|---|
| `implement` | mattpocock-skills | adapter | 已审查、待适配器与行为 smoke；未进入 runtime |
| `improve-codebase-architecture` | mattpocock-skills | adapter | 已审查、待适配器与行为 smoke；未进入 runtime |
| `setup-matt-pocock-skills` | mattpocock-skills | adapter | 已审查、待适配器与行为 smoke；未进入 runtime |
| `to-spec` | mattpocock-skills | adapter | 已审查、待适配器与行为 smoke；未进入 runtime |
| `to-tickets` | mattpocock-skills | adapter | 已审查、待适配器与行为 smoke；未进入 runtime |
| `triage` | mattpocock-skills | adapter | 已审查、待适配器与行为 smoke；未进入 runtime |
| `wayfinder` | mattpocock-skills | adapter | 已审查、待适配器与行为 smoke；未进入 runtime |

## 来源专用（未启用）

按域分组列出；`reason` 为未启用的统一原因。

- **checker**（1）：`vibe-code-review`
  - 原因：专项 checker；Sliver 拥有验收门，未进入 runtime
- **event**（3）：`evolution-engine`、`experience-elevator`、`feedback-writer`
  - 原因：仅限结构化事件调用；需宿主事件契约与独立审查
- **primitive**（10）：`git-guardrails-claude-code`、`grilling`、`migrate-to-shoehorn`、`prototype`、`research`、`resolving-merge-conflicts`、`scaffold-exercises`、`setup-pre-commit`、`wizard`、`writing-for-agents`
  - 原因：来源专用工程原语；未验收
- **product-or-checker**（22）：`architecture-foundation`、`audit`、`bug-fixer`、`codebase-memory-scout`、`critique`、`design-brief-builder`、`design-maker`、`dev-builder`、`dev-planner`、`doc-sync-guardian`、`harden`、`hotspot-governor`、`optimize`、`product-spec-builder`、`release-builder`、`requirements-test-designer`、`rule-harvester`、`skill-builder`、`target-constitution-setup`、`target-runtime-setup`、`test-automation`、`ui-system-guardian`
  - 原因：产品/checker 来源专用；逐技能审计与许可证映射已完成，待宿主行为 smoke
- **ui**（16）：`adapt`、`animate`、`bolder`、`brand`、`colorize`、`delight`、`design-system`、`distill`、`impeccable`、`layout`、`overdrive`、`polish`、`quieter`、`typeset`、`ui-styling`、`ui-ux-pro-max`
  - 原因：UI 来源专用；许可证台账已合并，待宿主行为 smoke
- **unreviewed**（3）：`beginner-flow-guide`、`clarify`、`shape`
  - 原因：尚未完成语义审查
- **user-tool**（6）：`grill-me`、`grill-with-docs`、`handoff`、`teach`、`to-questionnaire`、`wait-what`
  - 原因：用户显式工具；未做宿主行为 smoke

## 阻塞

| id | 来源 | 域 | 原因 |
|---|---|---|---|
| `code-review` | mattpocock-skills | primitive | Matt 工作树把 frontmatter 改为 mattpocock-code-review，但 plugin.json/marketplace.json 未同步；未解锁 |
| `tdd` | mattpocock-skills | primitive | Matt 工作树把 code-review 引用改为 mattpocock-code-review，但 manifest 未同步；未解锁 |

## 兼容与排除

- `ask-matt`（mattpocock-skills，compatibility）：兼容选择器；不得拥有项目级路由
- `claude-handoff`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包
- `loop-me`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包
- `setup-ts-deep-modules`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包
- `vibe-coding-skills`（vibe-coding-skills，compatibility）：兼容入口别名；不得拥有项目级路由
- `writing-beats`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包
- `writing-fragments`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包
- `writing-shape`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包

## 如何改变可用集合

1. 改 `provenance/SKILL-CLASSIFICATION.json`（`skills.<id>.readiness`，需要时同时调 `domain`）——这是**唯一**分类入口。
2. 重生成 catalog：`pwsh scripts/build-canonical-catalog.ps1 -RepoRoot <repo>`。
3. 重生成本索引：`pwsh scripts/build-capability-index.ps1 -RepositoryRoot <repo>`。
4. 跑门禁：`pwsh scripts/verify.ps1`。

不要手工编辑 `CANONICAL-CATALOG.json` 或本文件（两者都是生成物）。


