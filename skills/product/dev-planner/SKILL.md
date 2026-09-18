---
name: dev-planner
description: '仅当用户先明确调用 `feisheng-vibe-coding` 总入口并指定 `dev-planner`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发；当目标项目需求文档已完成、需要规划怎么分阶段开发时使用'
user-invocable: false
disable-model-invocation: true
---
[任务]
    **生成模式**：读取目标项目需求文档（和设计简报，如有），分析功能依赖关系和执行语境，WebSearch 验证技术选型，输出分阶段开发计划。

    **迭代模式**：当 Product Spec 变更后，分析变更影响范围，更新目标项目开发计划中的 Phase 划分和文件清单。已完成的 Phase（标记 ✅）不动。


[依赖检测]
    Skill 启动时第一步自动执行：

    必需：
    - 目标项目需求文档 → 优先用 `.vibe-docs.json` 的 `productSpec`，默认 `需求文档.md`；legacy `Product-Spec.md` 只作为读取迁移输入，缺失则提示先调用 /product-spec-builder

    可选（降级模式）：
    - 设计简报 → 优先用 `.vibe-docs.json` 的 `designBrief`，新项目默认 `docs/设计简报.md`；legacy `Design-Brief.md` 只作为读取迁移输入，缺失则标记"无设计规范模式"，视觉相关细节标注 [待 Design Brief 补充]
    - 设计工具 MCP → 未连接或无文件则仅依据文字描述，标记"无设计稿模式"
    - 已有项目代码 → 有则扫描现有结构作为约束，进入迭代模式
    - 影响面侦察（`rg` / 可用的代码图工具）→ 已有项目规划、迭代计划或跨包影响面不清时，可先侦查结构、热点与相关测试；无代码或新项目空白规划不启用


[第一性原则]
    **目标项目上下文加载协议（优先级高于下列文档读取描述）**：存在 `.vibe-docs.json` 时，先解析 schema v2、`documentIndex` 和 `loadPolicy`，再运行 `resolve-target-doc-context.mjs`，默认只显式请求 `documentIndex,productSpec`；只有当前计划确实涉及设计或接口时才追加 `designBrief/interfaceContracts`。只读取 resolver 返回的 selector，onDemand 不全文读取，never 被拒绝后立即停止且本 Skill 不得自行使用 `--allow-never`。计划写回后刷新 `文档索引.md` 并运行目标项目 `check:docs`。

    **可验证原则**：每个 Phase 完成后必须能编译、能运行、能看到效果。不允许"写一堆代码但什么都跑不起来"的 Phase。

    **目标项目文档命名原则**：本 Skill 生成的是用户目标项目计划文档，不是本分发包自身维护文档。
    - 新目标项目开发计划默认保存为 `docs/项目治理/开发计划.md`
    - 当前执行光标默认保存为 `docs/plans/执行光标.md`
    - 人工验收记录默认保存为 `docs/项目治理/验收记录.md`
    - 接口契约台账默认保存为 `docs/接口契约.md`
    - Phase 明细默认保存为 `docs/plans/第一阶段.md`、`docs/plans/第二阶段.md`、`docs/plans/第三阶段.md` 等四字中文文件名
    - `.vibe-docs.json` 必须登记 `devPlan = "docs/项目治理/开发计划.md"`、`currentExecution = "docs/plans/执行光标.md"`、`manualAcceptance = "docs/项目治理/验收记录.md"`、`interfaceContracts = "docs/接口契约.md"`，并在生成 Phase 明细时登记 `planDetails`
    - 不允许在新目标项目里生成 `DEV-PLAN.md`、`plans/CURRENT-EXECUTION.md` 或 `plans/phase-N.md`
    - 保存后运行 `node <skills仓库>/tools/check-target-doc-names.mjs <目标项目根目录> --require-existing`；命名校验不通过不得声明完成

    **依赖正序原则**：地基先打，房子后盖。基础设施（项目骨架、数据库、路由）永远排在业务功能前面。功能之间有依赖关系的，被依赖方先做。

    **联网优先原则**：不靠过期记忆，靠实时信息。
    - 技术栈选型 → 先 WebSearch 确认框架最新稳定版本、已知问题、推荐搭配
    - 关键依赖 → 先 WebSearch 确认 API 兼容性、版本号、是否有 breaking changes
    - 不确定的技术方案 → 搜了再定，不凭过期记忆做架构决策

    **执行语境优先原则**：先读取目标项目需求文档的“执行语境”，再决定计划粒度和回复表述。
    - `交付模式 = vibe` → 默认按单人、短反馈、尽快形成可运行的可观察结果来拆 Phase
    - `vibe` 模式的大任务拆成多轮小 Phase，不默认换算成“几周 / Sprint”
    - `vibe` 模式的每个 Phase 优先对应 1 个主目标、1 个可见结果、1-3 个核心交付物
    - `vibe` 只改变粒度和措辞，不改变依赖顺序、验证标准和文档纪律

    **已有代码侦察原则**：迭代已有项目时，如果目录结构、模块边界、调用链或测试分布会影响 Phase 拆分，先用 `rg`（有可用的代码图工具时再用）获取包结构、热点、候选模块和相关测试；新项目从零规划不启用这层侦察。

    **严格 TDD 规划原则**：先读取目标项目需求文档的“测试与验证策略”；除已满足全部边界的 visual-only T1 受控例外外，把所有新功能、bug 修复、重构和行为变更拆成可执行的 `RED-GREEN-REFACTOR` 循环。受控 T1 必须改写为改前基线、改后同路径证据和越界停止条件，不能写成笼统的“手工看看”。
    - 目标项目开发计划必须显式写出 `## 测试与验证策略`，并按分支声明：严格 TDD Task 没有先失败且失败原因正确的测试不得写生产代码；受控 T1 Task 仅在无既有 seam 且边界核对通过时使用改前基线与改后证据
    - 每个严格 TDD Task 都要列出 RED 测试与预期失败原因、GREEN 最小实现边界、全绿后的 REFACTOR 范围，以及本轮 RED/GREEN fresh 证据
    - 每个受控 T1 Task 都要列出边界核对、既有 seam 结论、改前基线、改后同路径定向视觉证据、副作用检查和越界重新分级条件
    - 原型、生成代码、配置文件仅在用户明确批准后才能例外；无法自动化本身不构成例外资格，计划必须写明测试 seam、阻塞、风险和停止生产代码修改的条件
    - 编译、启动、smoke 和人工验收继续作为补充证据，不能替代严格 TDD Task 的 RED/GREEN，也不能替代受控 T1 Task 的基线、同路径证据和副作用检查

    **预实现一致性分析**：T2/T3 在生成或更新计划后、首个 RED 前，必须把既有需求、验收标准、术语、接口契约、测试策略、Phase/Task 映射与依赖顺序逐项核对。
    - 在既有 `开发计划.md` 或对应 Phase 明细记录 sourceRevision、分析结论、证据与阻断项；任务胶囊只保留回执，不成为第二份计划真源
    - 分析结论只允许 `PASS / BLOCKED`；任何未解决 Critical / Important 矛盾为 `BLOCKED`，不得进入生产代码
    - T0/T1 快车道不执行本门；需求澄清记录仍有 `未决 / blocked` 时先回到 `product-spec-builder`

    **开工前架构地基门**：新项目，或本轮影响跨两个以上模块边界、数据、接口、权限、部署、技术栈或架构时，计划前必须先运行 `architecture-foundation`。只有地基 PASS 且其 sourceRevision 未过期，才能生成或更新开发计划；否则停止并回到该 Skill。T0/T1 快车道及单模块普通功能不执行本门。

    **接口契约规划原则**：每个涉及真实接口或服务入口的 Phase，都必须写清它会复用、扩展还是新增哪条业务能力契约。
    - 先读取 `.vibe-docs.json.interfaceContracts` 映射的 `接口契约.md`
    - Phase 的模块设计或验收标准必须列出受影响 `能力ID` 和契约入口
    - 已有契约能覆盖时，计划写“复用 / 扩展”；确需新增时，计划写清边界差异、迁移关系和验证命令
    - 新 Web / Desktop / Node CLI 计划默认把 `check-api-contracts.mjs` 纳入 `check:health` / build 验证链路；其他平台可复用接口契约门禁，但不承诺由现有模板自动复制

    **技术栈 Profile 规划原则**：开发计划必须继承或补齐目标项目需求文档里的 `platform profile`、`language adapter`、`architecture profile`、`scaffold policy` 和 `fallback stack`。
    - Spec 已明确 Profile 时，计划直接继承，不重新静默推荐 Web / Node
    - Spec 只写产品形态时，先扫描已有代码和工程文件；仍无法判断语言 / 架构时，只问一个会改变脚手架和验证路径的问题
    - 只有明确匹配 Web / Desktop / Node CLI 的新项目，才规划现有 JS / TS 内置模板
    - Backend、Library、Mobile、非 Node CLI 默认规划为 `platform-default` 或 `existing-incremental`，不生成 `src/shared/ui` 或 Web UI 门禁
    - 技术栈 Profile 详细矩阵以 `docs/language-platform-profiles.md` 为准

    **人工验收规划原则**：每个 Phase 的验收标准必须区分自动化验证和人工验收。
    - UI、设计稿、CLI 人机流程、权限确认、端到端链路、安装启动、发布后 smoke 等自动化不能完全证明的内容，必须标记为需要人工验收
    - 人工验收状态只允许：`不适用`、`待用户验收`、`用户已确认`、`需回归复验`
    - 用户确认前不能把人工验收写成通过；用户确认后写入 `.vibe-docs.json.manualAcceptance` 映射文档，默认 `验收记录.md`
    - 已人工验收范围必须进入后续 Phase 的影响分析；能自动化回归的优先补自动化，不能覆盖时才提醒用户复验受影响路径

    **粒度适中原则**：Phase 太大做不完，太小管理成本高。一个 Phase 对应一个可独立验收的功能单元，通常 1-3 个核心交付物。Error / Loading / Empty 等状态补全与工程化收尾默认按洋葱剥皮法排入辅助功能或收尾 Phase，核心链路 Phase 只验收 happy path，除非需求文档显式要求本轮包含。

    **文件路径明确原则**：每个 Phase 必须列出要创建或修改的具体文件路径。"实现聊天功能"不是计划，"创建 src/components/views/chat-view.tsx 和 src/hooks/use-chat.ts" 才是计划。

    **术语继承原则**：先继承 Spec 已定的名字，再拆 Phase 和文件。
    - 从目标项目需求文档的“术语与命名规范”提取本轮核心对象名、禁用别名和代码命名映射
    - 目标项目开发计划必须显式写出“术语对齐”，不能让实现阶段边写边猜
    - 目标项目开发计划必须包含 `### 本轮术语变更清单`，表头固定为：`对象ID | 变更类型 | 影响范围 | 必须回写文件 | 完成状态`
    - `变更类型` 只允许：`新增 / 重命名 / 废弃 / 沿用`；`完成状态` 只允许：`todo / doing / blocked / done`
    - Phase 名、交付清单、关键文件说明和模块设计都要沿用统一口径，不继续混用旧别名

    **无占位符原则**：Plan 里每一个字都要具体到任何人拿到这份 Plan 都能直接开工。
    - 不允许：TBD、TODO、"待补充"、"待确定"、"implement later"
    - 不允许："类似 Task N"——重复具体内容，不引用
    - 不允许："添加适当的错误处理"——指明处理什么错误、怎么处理
    - 不允许："实现相关功能"——列出具体功能名称和行为
    - 每个 Task 描述必须完整到一个没有项目上下文的工程师也能读懂并执行


[文件结构]
    ```
    dev-planner/
    ├── SKILL.md                           # 主 Skill 定义（本文件）
    └── templates/
        ├── dev-plan-template.md           # 开发计划.md 输出模板
        ├── phase-detail-template.md       # docs/plans/第一阶段.md 输出模板
        └── current-execution-template.md  # docs/plans/执行光标.md 输出模板
    ```


[按需加载 references]

    本 Skill 的 `SKILL.md` 只保留必读主流程。不要默认读取全部 references；只有命中下表场景时，再读取对应文件。

    | Reference | 读取时机 |
    | --- | --- |
    | `references/analysis-dimensions.md` | 拆 Phase 前需要完整分析功能依赖、技术栈、术语、测试策略和验收标准时。 |
    | `references/analysis-strategy.md` | 需要构建依赖图、校准 Phase 粒度、风险前置或 WebSearch 验证时。 |
    | `references/sufficiency-check.md` | 判断计划输入是否足够生成 `开发计划.md`。 |
    | `references/workflow-generation.md` | 从需求文档生成开发计划、执行光标、Phase 明细和验收记录时。 |
    | `references/workflow-iteration.md` | 需求变化后更新已有开发计划和 Phase 明细时。 |

[核心流程摘要]

    - 先读 `.vibe-docs.json`，再定位需求文档、设计简报和已有代码结构。
    - 每个 Phase 必须有交付清单、关键文件、模块设计、验证标准、人工验收状态和 T2/T3 预实现一致性分析结论。
    - `.vibe-docs.json` 必须登记 `devPlan/currentExecution/manualAcceptance/interfaceContracts`。
    - 计划生成后运行目标文档命名校验。

[初始化]

    1. 执行 [依赖检测]。
    2. 只读取本 `SKILL.md` 的必读内容，先完成任务分类和成功标准。
    3. 按 [按需加载 references] 表命中场景后，再读取对应 reference；不要为了保险全量加载。
    4. 如果需要写回目标项目文档，继续遵守四字中文文档名、`.vibe-docs.json` 和人工验收记录规则。
