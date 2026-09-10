# 能力索引（生成物）

> 本文件由 `scripts/build-capability-index.ps1` 从 `provenance/CANONICAL-CATALOG.json` 生成；**禁止手工编辑**。
> 分类唯一真源是 `provenance/SKILL-CLASSIFICATION.json`；改分类 = 改该文件后重生成 catalog。
> 新鲜度校验：`pwsh scripts/verify.ps1`。

统计：共 **82** 项来源技能 —— 可用 39、待启用 7、来源专用 28、阻塞 0、兼容/排除 8。

## 现在可用（进入 runtime 静态投影）

仅 `decisionPolicy.acceptedStatuses` = `control-plane`, `accepted-primitive`, `accepted-checker`, `accepted-product`, `accepted-ui` 可进入 runtime；其余一律排除。

| id | 来源 | 域 | 状态 | 可写（writeAuthority） | runtime 单位 | 文件 |
|---|---|---|---|---|---|---|
| `adapt` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `animate` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `architecture-foundation` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 2 |
| `audit` | vibe-coding-skills | checker | accepted-checker | none | `directory` | 1 |
| `bolder` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `brand` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 17 |
| `bug-fixer` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 1 |
| `code-review` | mattpocock-skills | checker | accepted-checker | none | `directory` | 1 |
| `codebase-design` | mattpocock-skills | primitive | accepted-primitive | none | `directory` | 3 |
| `colorize` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `critique` | vibe-coding-skills | checker | accepted-checker | none | `directory` | 4 |
| `delight` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `design-brief-builder` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 2 |
| `design-system` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 12 |
| `dev-builder` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 65 |
| `dev-planner` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 9 |
| `diagnosing-bugs` | mattpocock-skills | primitive | accepted-primitive | none | `directory` | 2 |
| `distill` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `doc-sync-guardian` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 3 |
| `domain-modeling` | mattpocock-skills | primitive | accepted-primitive | target-project-docs | `directory` | 3 |
| `harden` | vibe-coding-skills | checker | accepted-checker | none | `directory` | 1 |
| `hotspot-governor` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 1 |
| `impeccable` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 13 |
| `layout` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `optimize` | vibe-coding-skills | checker | accepted-checker | none | `directory` | 1 |
| `overdrive` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `polish` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `product-spec-builder` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 12 |
| `quieter` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `release-builder` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 1 |
| `requirements-test-designer` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 17 |
| `rule-harvester` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 1 |
| `sliver-vibe-coding` | sliver-vibe-coding | control-plane | control-plane | route-catalog、target-truth、validation-gate | `explicit` | 75 |
| `tdd` | mattpocock-skills | primitive | accepted-primitive | none | `directory` | 3 |
| `test-automation` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 4 |
| `typeset` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 1 |
| `ui-styling` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 93 |
| `ui-system-guardian` | vibe-coding-skills | product-or-checker | accepted-product | none | `directory` | 3 |
| `ui-ux-pro-max` | vibe-coding-skills | ui | accepted-ui | none | `directory` | 38 |

runtime 单位策略：`directory` = 以 `skills/<group>/<id>/` 整个导入目录为 runtime 单位（文件清单在生成时枚举并逐文件记 sha256，是显式白名单）；`file` = 只投影记录自身文件（如控制面 `governance/sliver-core/SKILL.md`，那棵树的其余部分不是技能内容）。真源：`SKILL-CLASSIFICATION.json` 的 `runtimePromotionPolicy.bundlePolicy`。


再次提醒：投影是**静态候选**，宿主 discovery / trust / fresh-session smoke 仍为 `UNVERIFIED`。

写权限约束：runtime include 必须声明 `writeAuthority`；控制面 token（`route-catalog`、`target-truth`、`validation-gate`、`skill-catalog`、`runtime-projection`、`hook-writer`）具有排他 owner，违反即门禁失败（防重复写入者）。

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
- **product-or-checker**（5）：`codebase-memory-scout`、`design-maker`、`skill-builder`、`target-constitution-setup`、`target-runtime-setup`
  - 原因：产品/checker 来源专用；逐技能审计与许可证映射已完成，待宿主行为 smoke
- **unreviewed**（3）：`beginner-flow-guide`、`clarify`、`shape`
  - 原因：尚未完成语义审查
- **user-tool**（6）：`grill-me`、`grill-with-docs`、`handoff`、`teach`、`to-questionnaire`、`wait-what`
  - 原因：用户显式工具；未做宿主行为 smoke

## 阻塞

（当前无阻塞项。早先因上游未提交改名而被阻塞的 `tdd`、`code-review` 已按「内容取已提交 revision、命名由本仓库决定」解除。）

## 兼容与排除

- `ask-matt`（mattpocock-skills，compatibility）：兼容选择器；不得拥有项目级路由
- `claude-handoff`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包
- `loop-me`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包
- `setup-ts-deep-modules`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包
- `vibe-coding-skills`（vibe-coding-skills，compatibility）：兼容入口别名；不得拥有项目级路由
- `writing-beats`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包
- `writing-fragments`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包
- `writing-shape`（mattpocock-skills，excluded）：上游 in-progress；不进入正式运行包

## 功能重叠裁决（duplicateGroups）

重叠能力已归属到唯一 owner；同一能力有多个技能时按下列规则分工。owner 均登记在 `provenance/OWNER-LEDGER.json`。

| 组 | owner | 成员/别名 | 分工规则 |
|---|---|---|---|
| `architecture` | `architecture` | `architecture-foundation`、`improve-codebase-architecture`、`codebase-design`、`domain-modeling` | 架构能力分工：新项目/架构变化用 architecture-foundation 建基线，寻找深化机会用 improve-codebase-architecture，设计模块接口/seam 用 codebase-design 的共享词汇，领域建模与 ADR 用 domain-modeling（写入受 target-truth 约束）。均不拥有项目路由或第二份真源。 |
| `bug-rescue` | `bug-rescue` | `bug-fixer`、`diagnosing-bugs` | Vibe bug-fixer 管分级修复流程与专项检查，Matt diagnosing-bugs 管诊断反馈回路纪律；两者都不得改写 Sliver 的 route/depth/truth，也不得跳过验收门。 |
| `clarification-and-grilling` | `target-truth` | `clarify`、`grilling`、`grill-me`、`grill-with-docs`、`to-questionnaire`、`wait-what` | 澄清与追问都服务于 target-truth 的需求清晰化：文本/标签不清用 clarify，对计划做持续追问用 grilling/grill-me，追问中要落 ADR/术语用 grill-with-docs，无法自答的决策转问卷用 to-questionnaire，要求对方复述用 wait-what。它们只产出澄清结果，不拥有 spec 真源。 |
| `context-and-handoff` | `context-handoff` | `codebase-memory-scout`、`handoff`、`claude-handoff` | 上下文交接是同一条能力：用 codebase-memory-scout 做代码图侦查与影响面分析，用 handoff 产出交接文档交给下一个代理；claude-handoff 属上游 in-progress，仅在完成独立行为验收后才可用。 |
| `doc-authoring` | `doc-authoring` | `writing-for-agents`、`writing-shape`、`writing-beats`、`writing-fragments`、`doc-sync-guardian` | 写作类技能按对象分工：为 agent 写文档/AGENTS.md/skill 用 writing-for-agents（唯一已审查原语），writing-shape/writing-beats/writing-fragments 属上游 in-progress 不得启用；doc-sync-guardian 只在代码/规则变更后同步项目文档，不拥有 target-truth。 |
| `git-and-release` | `git-release` | `resolving-merge-conflicts`、`git-guardrails-claude-code`、`release-builder` | git 与发布能力：解决 merge/rebase 冲突用 resolving-merge-conflicts，加破坏性 git 命令护栏用 git-guardrails-claude-code，打包/部署/上线用 release-builder。发布授权与验收门仍归 Sliver，release-builder 不得自任发布真源。 |
| `project-entry` | `route-catalog` | `vibe-coding-skills`、`ask-matt` | 别名可激活或选择入口，但不得拥有项目路由；唯一项目入口是 Sliver（governance/sliver-core/SKILL.md），route-catalog 是其路由 owner。 |
| `review-and-test` | `validation-gate` | `vibe-code-review`、`code-review`、`audit`、`critique`、`harden`、`tdd`、`test-automation`、`requirements-test-designer` | 专项 review/test 方法只产出 findings 或测试结果，不拥有验收门。review：需要双轴代码审查用 code-review（Matt），需要 Vibe 专项代码检查用 vibe-code-review，质量/可访问性/性能等专项检查用 audit/critique/harden。test：需要测试方法学（red-green-refactor）用 tdd，需要把需求/验收标准翻译成用例用 requirements-test-designer，需要接入自动化与 E2E 用 test-automation。Sliver（validation-gate）拥有最终验收门。 |
| `skill-governance` | `skill-catalog` | `skill-builder`、`rule-harvester`、`wizard`、`target-constitution-setup`、`target-runtime-setup`、`setup-ts-deep-modules` | 技能/规则/宿主事实的治理都收敛到 skill-catalog：新建技能用 skill-builder，规则归位用 rule-harvester，目标项目宪法/运行时事实用 target-constitution-setup/target-runtime-setup，只有人能做的手动流程脚手架用 wizard；setup-ts-deep-modules 属上游 in-progress 不得启用。 |
| `truth-and-planning` | `target-truth` | `product-spec-builder`、`dev-planner`、`to-spec`、`to-tickets`、`wayfinder` | 计划与 spec 适配器只能投影到 target-truth，不得产生第二份 spec 真源。需求产物用 product-spec-builder，阶段计划用 dev-planner，把对话转 spec/tickets 用 to-spec/to-tickets，跨 session 的大块工作规划用 wayfinder。 |
| `ui-quality` | `ui-quality` | `design-maker`、`design-brief-builder`、`ui-ux-pro-max`、`impeccable`、`design-system`、`layout`、`polish`、`prototype` | UI 原技能各自独立、不复制正文；先做设计简报（design-brief-builder）再出稿（design-maker），视觉方向/色彩/字体用 ui-ux-pro-max 与 impeccable，token/组件用 design-system，布局/间距/收尾用 layout/polish，一次性原型验证用 prototype。profile 只组合调用，不产生第二套设计真源。 |

## 如何改变可用集合

1. 改 `provenance/SKILL-CLASSIFICATION.json`（`skills.<id>.readiness`，需要时同时调 `domain`）——这是**唯一**分类入口。
2. 重生成 catalog：`pwsh scripts/build-canonical-catalog.ps1 -RepoRoot <repo>`。
3. 重生成本索引：`pwsh scripts/build-capability-index.ps1 -RepositoryRoot <repo>`。
4. 跑门禁：`pwsh scripts/verify.ps1`。

不要手工编辑 `CANONICAL-CATALOG.json` 或本文件（两者都是生成物）。


