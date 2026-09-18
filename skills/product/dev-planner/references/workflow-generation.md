# 工作流程（生成模式）

> 来源：dev-planner/SKILL.md 的 [工作流程（生成模式）]。
> 读取时机：从需求文档生成开发计划、执行光标、Phase 明细和验收记录时。

## 目录

- 加载阶段
- 技术验证阶段
- 分析阶段
- 输出阶段
- Plan Hygiene 自检
- 引导下一步

[工作流程（生成模式）]
    [加载阶段]
        目的：读取所有输入文档，建立分析基础

        第一步：依赖检测
            执行 [依赖检测]

        第二步：加载 Product Spec
            读取目标项目需求文档；优先用 `.vibe-docs.json` 的 `productSpec`，默认 `需求文档.md`
            提取：执行语境、术语与命名规范、非目标（本期明确不做）列表、测试与验证策略、产品类型、核心功能列表、辅助功能列表、AI 能力需求、技术方向、UI 布局结构、数据存储方式
            检查目标项目需求文档中是否包含 [待补充] 标记。如有，列出涉及的条目并提示用户先补充或确认可以跳过

        第三步：加载 Design Brief（如有）
            读取目标项目设计简报；优先用 `.vibe-docs.json` 的 `designBrief`，新项目默认 `docs/设计简报.md`
            提取：核心页面列表、视觉方向（影响组件拆分粒度）

        第四步：加载设计稿（如有）
            检查设计工具 MCP 是否连接
            如有 → 通过设计工具读取设计稿，提取：
            - 所有页面和变体的完整清单
            - 各页面的组件构成和布局结构
            - 具体的交互元素和状态变体
            - 页面之间的跳转关系
            - 可复用组件列表
            设计稿存在时，Phase 拆分和关键文件规划必须以设计稿的实际页面结构为准。设计稿中的页面数量、组件数量直接决定 Phase 的工作量和文件清单，不能只看 Spec 文字描述。
            如无 → 跳过，仅依据 Spec 和 Design Brief 的文字描述

        第五步：加载接口契约台账
            读取目标项目接口契约文档；优先用 `.vibe-docs.json` 的 `interfaceContracts`，默认 `接口契约.md`
            提取：已有业务能力、入口类型、契约入口、调用方、状态和说明
            如果缺失且目标项目计划包含真实接口、服务入口、server action、fetch wrapper、IPC / event 通道或 schema → 输出阶段必须创建初始 `接口契约.md`

        第六步：扫描已有代码（如有）
            如果项目目录中已有代码 → 扫描目录结构，识别技术栈和已实现的功能
            标记为已有代码约束，避免 Plan 与现有结构冲突

    [技术验证阶段]
        目的：确定并验证技术栈

        第一步：提取技术方向
            从 Spec 的技术方向章节提取推荐的技术栈
            同时提取 platform profile、language adapter、architecture profile、scaffold policy 和 fallback stack
            如 Spec 无明确技术栈 → 先扫描已有代码和工程文件；仍无结论时根据项目类型推荐并确认：
            - Web（纯前端）→ 可推荐 React + Vite + TypeScript + Tailwind，并确认 `scaffold policy = template`
            - Web（全栈）→ 可推荐 Next.js + TypeScript + Tailwind，并确认 `scaffold policy = template`
            - Desktop → 可推荐 Electron + Next.js + TypeScript + Tailwind，并确认 `scaffold policy = template`
            - Node CLI → 可推荐 Node.js + TypeScript + Commander，并确认 `scaffold policy = template`
            - Mobile / Backend / Library / 非 Node CLI → 推荐平台生态方案并确认，`scaffold policy` 默认 `platform-default`
            - 技术栈仍不明确 → 只问一个关键问题，不静默套 Web / Node
            同时提取或推断代码组织策略：
            - Web / Desktop 新项目 → 默认 `feature-first`
            - 已有项目 → 默认 `legacy-incremental`
            - CLI / CLI Agent → 本轮保持现有结构，不强行套 `feature-first`
            - Backend / Library / Mobile / 非 Node CLI → 默认 `平台默认结构` 或 `legacy-incremental`

        第二步：WebSearch 验证
            对照 [分析维度清单] 中的"技术栈确定"维度
            运用 [分析策略] 中的"WebSearch 验证法"
            验证框架版本、关键依赖兼容性、已知问题

        第三步：确认技术栈
            如有多个合理选项 → 向用户展示 2-3 个方案 + 优劣对比，让用户选
            如 Spec 技术方向明确且验证通过 → 直接确认，不需要问用户
            输出确认的技术栈表

    [分析阶段]
        目的：分析功能依赖关系，拆分 Phase

        第一步：功能拆解
            将 Spec 中的功能需求逐条列出
            如有设计稿 → 以设计稿的页面结构为准，逐页面确认涉及的功能和组件。设计稿中的页面数量和组件构成直接决定 Phase 的文件清单
            如无设计稿 → 依据 Spec 和 Design Brief 的文字描述推导页面结构
            标注每个功能的：类型、依赖的其他功能、涉及的数据表、涉及的页面和组件

        第二步：依赖图构建
            运用 [分析策略] 中的"依赖图构建法"
            构建功能依赖图，识别先后顺序

        第三步：Phase 拆分
            运用 [分析策略] 中的"洋葱剥皮法"和"风险前置法"
            将功能按依赖顺序和优先级分组为 Phase
            运用"粒度校准法"检查每个 Phase 的粒度

        第四步：充足度判断
            对照 [信息充足度判断]
            「必须满足」全部达成 → 进入输出阶段
            有疑问 → 向用户确认后继续

    [输出阶段]
        目的：生成目标项目开发计划文件

        第一步：加载模板
            读取 templates/dev-plan-template.md

        第二步：填充内容
            按模板结构填写：
            - 当前阶段、当前进度、下一步动作
            - 当前执行状态文件（固定为 `docs/plans/执行光标.md`）
            - 执行语境表
            - 术语对齐（术语来源、本轮核心对象、禁用别名、回写规则）
            - 本轮术语变更清单（固定表头与固定枚举）
            - 测试与验证策略（默认策略、场景拆分、最小完成证据、回补规则）
            - 人工验收与回归保护（验收记录文件、状态枚举、用户确认规则、复验触发条件）
            - 接口契约治理（接口契约文件、统一入口原则、Phase 级登记规则和门禁命令）
            - 代码组织策略（`feature-first / legacy-incremental` + 适用边界）
            - 技术栈 Profile（platform profile、language adapter、architecture profile、scaffold policy、fallback stack 判断）
            - Phase 列表（编号 + 功能名 + 交付清单 + 关键文件 + 模块设计 + 不做边界/停止条件 + 验收标准）
            - 补充计划文档索引（如开发计划过大，需要拆到 `docs/plans/` 时）
            - 技术栈表
            - 数据库表汇总（如有）
            - 开发规则
            - 如某个 Phase 预计跨多个 session、Task 数明显多于 3 个，或存在高风险中断点 → 同时生成 `docs/plans/第一阶段.md` 这类四字中文 Phase 明细
            - 如启用 `docs/plans/` → 同时准备 `docs/plans/执行光标.md` 模板，作为唯一当前执行光标

        第三步：自检
            运用 [分析策略] 中的"粒度校准法"再次检查
            确认 Spec 中每个核心功能都有对应 Phase，或已被需求文档「非目标（本期明确不做）」节显式排除；被排除项不得创建 Phase，也不得作为隐含功能混进其他 Phase
            确认每个 Phase 交付清单不超过 5 项、关键文件不超过 10 个（对照 `references/analysis-strategy.md` 粒度校准法阈值），Phase 总数不超过 10 个；任一超限即计划无效——先合并交付物或拆分为多期，重新自检通过后再输出，不得带超限计划进入引导下一步
            确认 Phase 顺序不违反依赖关系
            确认每个 Phase 的 `模块设计` 都写了职责、公共入口、依赖约束，而不是只写模块名
            确认 Phase 名、交付清单、关键文件说明和模块设计没有继续混用目标项目需求文档里已经禁用的别名
            确认目标项目开发计划已写出“测试与验证策略”，且除 visual-only T1 受控例外外，每个新增或改变的可观察行为都拆成 RED-GREEN-REFACTOR；受控 T1 必须列出边界核对、既有 seam 结论、基线、同路径证据和副作用检查
            确认目标项目开发计划已写出“人工验收与回归保护”，且 `.vibe-docs.json` 登记 `manualAcceptance = "验收记录.md"`
            确认目标项目开发计划已写出“接口契约治理”，且 `.vibe-docs.json` 登记 `interfaceContracts = "接口契约.md"`
            确认涉及真实 endpoint、service、public entry、server action、fetch wrapper、IPC / event 通道或 schema 的 Phase 已写明对应 `能力ID`、统一契约入口和 `check-api-contracts` 验证要求
            确认每个例外都有用户明确批准、替代验证、风险和恢复方案；编译 / 启动 / 手动路径 / smoke 只作为补充证据
            如 `代码组织策略 = feature-first`，确认新 Web / Desktop 项目的关键文件没有重新滑回顶层 `components / hooks / lib`
            如 `代码组织策略 = legacy-incremental`，确认 Plan 没有偷偷把整个旧项目改写成全量迁移任务
            如启用了补充计划文档，确认开发计划中仍保留阶段划分、当前进度、文档索引和恢复入口
        如启用了补充计划文档，确认详细任务表统一使用 `todo / doing / blocked / done`，并预留 `docs/plans/执行光标.md`
        无占位符检查：扫描输出内容中是否包含 TBD、TODO、待补充、待确定、"类似 Phase/Task N"等占位符，如有则替换为具体内容

        第四步：Plan Hygiene 自检
            如仓库存在 `tools/plan-hygiene.ps1` 或 `tools/plan-hygiene.sh` → 运行自动评估
            - `clean` → 继续输出
            - `cleanup_recommended` → 在本轮内压缩目标项目开发计划、归档旧 Phase 明细、更新索引后再输出
            - `cleanup_required` → 先修复未索引文档、失效路径或过度膨胀的主计划，再输出
            清理优先级：归档已完成且早于当前 Phase 两个阶段以上的详细文档到 `docs/plans/archive/`，其次合并低信号碎片文档；不直接删除仍承载唯一状态的信息

        第五步：输出文件
            保存为 `docs/项目治理/开发计划.md`
            创建或更新 `.vibe-docs.json`，写入 `devPlan = docs/项目治理/开发计划.md`、`currentExecution = docs/plans/执行光标.md`、`manualAcceptance = docs/项目治理/验收记录.md`、`interfaceContracts = docs/接口契约.md` 和已生成的 `planDetails`
            如目标项目尚无 `验收记录.md`，创建初始文档，包含：文档职责、触发规则、用户确认口径、回归保护规则、已确认记录、待验收记录
            如目标项目尚无 `接口契约.md`，创建初始接口契约台账；没有真实接口时登记 `暂无业务接口`
            运行 `tools/check-target-doc-names.mjs <目标项目根目录> --require-existing` 校验四字中文 `.md` 命名
            如目标项目存在 `tools/check-api-contracts.mjs`，运行 `node tools/check-api-contracts.mjs <目标项目根目录>` 校验接口契约

        第六步：引导下一步
            "✅ 开发计划已生成！

             文件：docs/项目治理/开发计划.md
             共 N 个 Phase，覆盖 Spec 中除「非目标」外的全部 X 个功能（Y 项已被非目标显式排除，不生成 Phase）。

             接下来：
             - 调用 /dev-builder 按 Phase 开始开发
             - 或先调用 /design-brief-builder 确定视觉方向（如还没做）
             - 想调整 Phase 粒度或顺序？直接告诉我。"
