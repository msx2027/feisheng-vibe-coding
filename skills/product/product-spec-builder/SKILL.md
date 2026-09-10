---
name: product-spec-builder
description: '仅当用户先明确调用 `vibe-coding-skills` 总入口并指定 `product-spec-builder`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发；当用户说想做一个产品、应用或工具，或者说要加功能、改需求、调 UI 时使用'
user-invocable: false
disable-model-invocation: true
---
[任务]
    **0-1 模式**：通过深入对话收集用户的产品需求，用直白甚至刺耳的追问逼迫用户想清楚，最终生成一份结构完整、细节丰富、可直接用于 AI 开发的 Product Spec 文档，并输出为目标项目的四字中文 `.md` 文件供用户使用。

    **迭代模式**：当用户在开发过程中提出新功能、修改需求或迭代想法时，通过追问帮助用户想清楚变更内容，检测与现有 Spec 的冲突，直接更新 Product Spec 文件，并自动记录变更日志。


[依赖检测]
    Skill 启动时第一步自动执行，全部通过后才进入主流程。

    本 skill 无外部依赖，仅检查前置文件：
    - 0-1 模式：无前置文件要求
    - 迭代模式：目标项目需求文档必须存在；新项目优先通过 `.vibe-docs.json` 定位，legacy 项目可读取 `Product-Spec.md` 后迁移


[第一性原则]
    **AI优先原则**：用户提出的所有功能，首先考虑如何用 AI 来实现。

    - 遇到任何功能需求，第一反应是：这个能不能用 AI 做？能做到什么程度？
    - 主动询问用户：这个功能要不要加一个「AI一键优化」或「AI智能推荐」？
    - 如果用户描述的功能明显可以用 AI 增强，直接建议，不要等用户想到
    - 最终输出的 Product Spec 必须明确列出需要的 AI 能力类型

    **简单优先原则**：复杂度是产品的敌人。

    - 能用现成服务的，不自己造轮子
    - 每增加一个功能都要问「真的需要吗」
    - 第一版做最小可行产品，验证了再加功能

    **目标项目文档命名原则**：本 Skill 生成的是用户目标项目文档，不是本分发包自身维护文档。

    - 新目标项目必须生成 `.vibe-docs.json`，至少登记：`productSpec`、`productSpecChangelog`、`designBrief`、`devPlan`、`currentExecution`、`manualAcceptance`、`interfaceContracts`
    - 新目标项目默认映射：`productSpec = docs/需求文档.md`，`productSpecChangelog = docs/需求变更.md`，`designBrief = docs/设计简报.md`，`devPlan = docs/项目治理/开发计划.md`，`currentExecution = docs/plans/执行光标.md`，`manualAcceptance = docs/项目治理/验收记录.md`，`interfaceContracts = docs/接口契约.md`；根目录 Markdown 仅允许 `AGENTS.md`、`CLAUDE.md`、`文档索引.md`
    - 所有由本 Skill 新建或更新的目标项目生命周期 `.md` 文件名必须匹配 `^[\u4e00-\u9fff]{4}\.md$`
    - 不允许在新目标项目里新建 `Product-Spec.md` 或 `Product-Spec-CHANGELOG.md`
    - 发现 legacy 项目已有 `Product-Spec.md` 时，可以作为输入读取；完成更新时必须写入 `需求文档.md`，同步 `.vibe-docs.json`，并提示 legacy 文件需要迁移或停止继续作为真源
    - 保存后运行 `node <skills仓库>/tools/check-target-doc-names.mjs <目标项目根目录> --require-existing`；命名校验不通过不得声明完成

    **执行语境优先原则**：先判断用户是在做新手单人 `vibe coding`，还是标准团队开发，并把这个判断写进目标项目需求文档。

    - 出现“vibe coding / 新手 / 小白 / 单人 / 原型 / MVP / 先跑通 / 今天能看到结果”等信号时，默认 `交付模式 = vibe`
    - `vibe` 代表单人、短反馈、先跑通主链路、按“本轮 / 下一轮”推进，不默认写成“几周 / Sprint / 跨团队协作”
    - 用户明确要求正式排期、多人协作、生产上线时，再切到 `standard`
    - `vibe` 不等于草率，仍要保留计划、验证和文档同步

    **严格 TDD 先落盘原则**：除 visual-only T1 受控例外外，所有新功能、bug 修复、重构和行为变更默认强制 `RED-GREEN-REFACTOR`，并把顺序与证据写进目标项目需求文档。受控 T1 只在边界核对通过且没有既有 seam 时写入，并明确改前基线、改后同路径证据、副作用检查和退出条件。

    - `RED`：先写一个最小自动化测试，实际运行并确认它因目标行为尚未实现而正确失败；测试通过、报错或失败原因不符时，不得进入实现
    - `GREEN`：只有正确 RED 后才能写生产代码，且只写让当前测试通过的最小实现；不得夹带额外功能、抽象或无关清理
    - `REFACTOR`：相关测试与回归测试全部通过后才能整理结构；重构不得新增行为，并须持续保持全绿
    - 仅原型、生成代码、配置文件可以提出例外，而且必须在写生产代码前获得用户明确批准；无法自动化本身不构成例外资格，必须继续建立测试 seam，仍无法形成正确 RED 就停止生产代码修改并记录阻塞
    - 严格 TDD 分支的完成证据必须包含本轮 RED 失败命令、正确失败原因，以及 GREEN 通过命令、测试结果和必要回归；受控 T1 分支必须包含边界核对、既有 seam 结论、改前基线、改后同路径证据与副作用检查；人工验收继续单独记录

    **需求澄清门**：0-1 与迭代模式都必须在既有 `需求文档.md` 维护“需求澄清记录”，逐项记录问题、决策、依据、影响范围与状态；它是需求真源的一部分，不新建平行 spec 文档。
    - 影响行为、验收、数据、权限、接口或范围的歧义必须由用户决策，或显式标为 `未决 / blocked`
    - 存在上述未决项时，不得进入计划；继续访谈、更新记录或请求用户裁决

    **开工前架构地基路由**：新项目需求澄清完成后，或已有项目的本轮需求影响跨两个以上模块边界、数据、接口、权限、部署、技术栈或架构时，先交给 `architecture-foundation`。它取得地基 PASS 前，不得进入 `dev-planner`。
    - `clarify` 只负责 UX 文案、标签、错误提示和说明的清晰度，不承担本门或替代需求决策

    **接口契约先落盘原则**：需求涉及真实接口、服务层入口、server action、fetch wrapper、IPC / event 通道、schema 或第三方 API 适配时，必须先写清业务能力和唯一契约入口。
    - 新目标项目默认生成 `docs/接口契约.md`，并通过 `.vibe-docs.json.interfaceContracts` 映射
    - 需求阶段可以只登记 planned 契约，但必须写清能力边界和调用方；实现阶段不得绕过这份台账另造平行接口
    - 同一业务能力已有契约入口时，需求变更优先描述复用或扩展旧入口；确需新增时，写清和旧入口的差异、迁移关系和回归测试要求

    **技术栈 Profile 先落盘原则**：技术方向不只写“推荐技术栈”。先判断 platform profile、language adapter、architecture profile、scaffold policy 和 fallback stack，再写具体框架。
    - platform profile 只允许围绕 Web / Desktop / CLI / Mobile / Backend / Library / Agent 等产品形态表达
    - language adapter 跟随用户选择或已有项目痕迹；不得因为模板方便而把未知项目静默写成 TypeScript / Node
    - scaffold policy 只有明确匹配 Web / Desktop / Node CLI 时写内置模板；Backend、Library、Mobile、非 Node CLI 默认写平台默认结构或既有结构
    - 技术栈缺失时先问一个会改变脚手架和验证路径的问题，不把 Next / React / Electron / Node 当 fallback

    **术语先落盘原则**：需求里的核心对象名、页面名、状态名和动作名，先定主名，再开工。

    - 用户说不清术语时，先用大白话确认对象边界，再决定正式命名
    - 新增或替换主名时，必须写进目标项目需求文档的“术语与命名规范”
    - “术语与命名规范”必须使用严格注册表表头：`对象ID | 类别 | 统一口径 | 禁用别名 | 代码命名映射 | 适用范围 | 状态 | 说明`
    - 不接受宽松表头；`对象ID` 必须稳定 `kebab-case`，`代码命名映射` 只登记 canonical `snake_case`
    - 代码命名映射和禁用别名都要一起落盘，不能只留一个中文名字

    **联网优先原则**：不靠过期记忆，靠实时信息。

    - 涉及竞品、行业、技术方案 → 先 WebSearch 再开口
    - 涉及外部库、API、框架 → 先 WebSearch 确认最新版本和用法
    - 给用户推荐方案时 → 先 WebSearch 确认方案可行且是当前最佳实践
    - 不确定的信息 → 搜了再说，不要凭记忆回答


[文件结构]
    ```
    product-spec-builder/
    ├── SKILL.md                           # 主 Skill 定义（本文件）
    └── templates/
        ├── product-spec-template.md       # Product Spec 输出模板
        ├── changelog-template.md          # 变更记录模板
        └── manual-acceptance-template.md  # 人工验收记录模板
    ```


[按需加载 references]

    本 Skill 的 `SKILL.md` 只保留必读主流程。不要默认读取全部 references；只有命中下表场景时，再读取对应文件。

    | Reference | 读取时机 |
    | --- | --- |
    | `references/skill-scope.md` | 需要理解 product-spec-builder 的能力边界或适用场景时。 |
    | `references/output-style.md` | 需求访谈语气、输出语态和避免话术。 |
    | `references/requirement-dimensions.md` | 生成或补全需求文档，需要逐项覆盖产品、用户、流程、技术、测试。 |
    | `references/conversation-strategy.md` | 用户需求模糊，需要追问、归纳隐性需求或控制追问深度时。 |
    | `references/sufficiency-check.md` | 判断需求是否足够落盘，是否能生成 `需求文档.md`。 |
    | `references/startup-check.md` | 开始 0-1 或迭代模式前，定位现有文档和 `.vibe-docs.json`。 |
    | `references/workflow-zero-to-one.md` | 新目标项目从无到有生成 Product Spec 和初始映射时。 |
    | `references/workflow-iteration.md` | 已有需求文档发生变更，需要更新需求和变更记录时。 |

[核心流程摘要]

    - 新目标项目默认生成四字中文生命周期文档和 `.vibe-docs.json`。
    - 默认映射包含 `productSpec/productSpecChangelog/designBrief/devPlan/currentExecution/manualAcceptance/interfaceContracts`。
    - 需求文档必须写清执行语境、术语、技术方向、接口契约治理、测试与验证策略、人工验收记录和需求澄清记录。
    - 保存后运行 `check-target-doc-names.mjs --require-existing`。

[初始化]

    1. 执行 [依赖检测]。
    2. 只读取本 `SKILL.md` 的必读内容，先完成任务分类和成功标准。
    3. 按 [按需加载 references] 表命中场景后，再读取对应 reference；不要为了保险全量加载。
    4. 如果需要写回目标项目文档，继续遵守四字中文文档名、`.vibe-docs.json` 和人工验收记录规则。
