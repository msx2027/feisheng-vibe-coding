# 技能归并决策表

本文是人工语义审查的暂存结果。`SKILL-INVENTORY.json` 记录每个文件事实；本文记录跨项目职责判断。任何技能进入正式运行包前，必须补齐输入、输出、写入目标、依赖、许可证和行为 smoke。

## Sliver

公开技能只有 `sliver-vibe-coding`。内部 canonical routes 来自 `references/routes-index.md`：

```text
项目体检、环境启动、报错救援、AI债务体检、接管项目、立项、拆分、整理开发资料、技术选型、开发执行、git保护、项目宪法、前端骨架、数据库设计、后端工程、安全审计、代码审计、验收、用户验收陪跑、部署路线、发布准备、上下文交接
```

条件 lens：

```text
frontend-design、data-model、backend-api、identity-permission、monetization-entitlement、third-party-provider、security-impact、deployment-release
```

决策：Sliver 拥有项目级 route、operation、lens、depth、risk、effect、truth、test 和验收，不再引入第二套项目 router。

## Vibe

### 治理、产品和检查器

```text
vibe-coding-skills、beginner-flow-guide、architecture-foundation、target-constitution-setup、target-runtime-setup、doc-sync-guardian、codebase-memory-scout、hotspot-governor、rule-harvester、skill-builder、product-spec-builder、design-brief-builder、design-maker、dev-planner、dev-builder、bug-fixer、test-automation、requirements-test-designer、release-builder、shape、code-review、audit、critique、optimize、harden、ui-system-guardian、experience-elevator、feedback-writer、evolution-engine
```

### UI 和视觉

```text
ui-ux-pro-max、impeccable、design-system、ui-styling、brand、layout、polish、adapt、animate、colorize、bolder、delight、distill、overdrive、quieter、typeset
```

初步决策：

- `vibe-coding-skills`：降为宿主激活和兼容适配，不再拥有项目级 route。
- `architecture-foundation`、`target-constitution-setup`、`target-runtime-setup`：分别映射到 Sliver 的技术选型、项目宪法、环境启动，但保留 Vibe 的目标项目工具实现。
- `product-spec-builder`、`design-brief-builder`、`dev-planner`、`dev-builder`：作为产品/设计/阶段交付模块，不能写第二份项目真源。
- `bug-fixer`、`code-review`、`audit`、`requirements-test-designer`、`release-builder`：作为专项 checker 或 profile，不得自行改变 route、depth 或 truth。
- `experience-elevator`、`feedback-writer`、`evolution-engine`：保留 event-only 语义，不开放普通自然语言直接调用。（2026-09-11 能力定批评次更新：三者已以轻量形态接入 runtime——方法学层随批、tools/*.mjs 自动化层与 .vibe-docs.json 基础设施留快照；仅显式/事件调用，见 contract.json enablementScope 与各技能 RUNTIME-NOTES.md。）
- UI 技能先保持独立来源和 canonical id；只新增组合 profile，不立即物理合并。

## Matt

### 工程

```text
ask-matt、grill-with-docs、triage、improve-codebase-architecture、setup-matt-pocock-skills、to-spec、to-tickets、wayfinder、implement、prototype、diagnosing-bugs、research、tdd、domain-modeling、codebase-design、code-review、resolving-merge-conflicts、wizard
```

### Productivity

```text
grill-me、handoff、teach、to-questionnaire、wait-what、grilling、writing-for-agents
```

### Misc 和 beta

```text
git-guardrails-claude-code、migrate-to-shoehorn、scaffold-exercises、setup-pre-commit、claude-handoff、loop-me、setup-ts-deep-modules、writing-beats、writing-fragments、writing-shape
```

初步决策：

- 保留为工程 primitive：`tdd`、`diagnosing-bugs`、`codebase-design`、`domain-modeling`、`code-review`、`research`、`prototype`、`wizard`、`resolving-merge-conflicts`。
- 作为 Sliver 执行适配器：`implement`、`to-spec`、`to-tickets`、`triage`、`wayfinder`、`improve-codebase-architecture`。
- 作为用户显式工具：`grill-me`、`grill-with-docs`、`handoff`、`teach`、`to-questionnaire`、`wait-what`。
- `ask-matt` 不再做项目总路由，只能作为兼容选择器。
- `in-progress/*` 不进入正式运行包，除非后续完成独立行为验收。
- `setup-matt-pocock-skills` 的 tracker 和 docs 写入必须改为 adapter，不能覆盖 target-truth owner。

## 语义重复组

| 重复组 | canonical owner | 组合方式 |
|---|---|---|
| 总入口/路由 | Sliver route-catalog | Vibe 和 Matt 仅保留宿主激活或兼容选择器 |
| 需求澄清 | Sliver target-truth | Vibe product spec + Matt grilling 作为内部方法和产物适配器 |
| Bug 救援 | Sliver `报错救援` | Vibe bug-fixer 管专项检查，Matt diagnosis 管反馈循环 |
| 测试/TDD | Sliver test gate | Matt tdd 管方法，Vibe test automation 管专项执行 |
| Review/Audit | Sliver review gate | Matt 双轴 review + Vibe 专项 checker |
| 阶段计划/Issue | Sliver plan artifact | Matt tickets 和 Vibe planner/builder 作为不同投影，不并列真源 |
| 文档真源 | target-truth | Vibe `.vibe-docs.json` 和 Matt tracker 只能做 adapter |
| UI 质量 | Vibe UI profiles | 原始技能先独立，profile 只组合调用，不复制正文 |

