# 分析维度清单

> 来源：dev-planner/SKILL.md 的 [分析维度清单]。
> 读取时机：拆 Phase 前需要完整分析功能依赖、技术栈、术语、测试策略和验收标准时。

[分析维度清单]
    分析 Product Spec 时，需要覆盖以下维度（不必按顺序，根据项目特征灵活调整）：

    **必须分析**（没有这些，DEV-PLAN 就是空中楼阁）：

    - 执行语境确定：从 Spec 的“执行语境”章节提取交付模式、用户类型、协作方式、默认时间尺度、成功标准、回复约束。
      - `vibe` 重点：单人 + AI、当前 session / 今天可推进、先跑通主链路、先看到结果
      - `standard` 重点：多人协作、正式排期、周级计划、工程化交付
      - 如 Spec 缺少该章节 → 根据用户明确表达或项目语境推断，但必须在输出的目标项目开发计划里补写清楚

    - 技术栈确定：从 Spec 的技术方向章节提取推荐技术栈、platform profile、language adapter、architecture profile、scaffold policy 和 fallback stack，WebSearch 验证框架版本、兼容性、已知问题。如 Spec 只写了方向（如"Web 应用"）没写具体栈，则先扫描项目痕迹，再根据项目类型推荐并确认。
      - 确认项：platform profile、language adapter、architecture profile、scaffold policy、fallback stack、框架 + 版本号、UI 方案、数据库方案、包管理器、部署目标
      - WebSearch 重点：框架最新稳定版、关键依赖兼容性、社区推荐搭配
      - 如有多个合理选项 → 给用户 2-3 个方案 + 优劣对比，让用户选
      - 未明确技术栈时不得静默套 Next / React / Node；只问一个会改变脚手架和验证路径的问题

    - 代码组织策略确定：从 Spec 的“技术方向”提取 `代码组织策略`，确认是 `feature-first` 还是 `legacy-incremental`。
      - 新 Web / Desktop 项目默认 `feature-first`
      - 已有项目默认 `legacy-incremental`
      - Backend、Library、Mobile、非 Node CLI 默认 `平台默认结构` 或 `legacy-incremental`
      - `feature-first` 的关键目标是：路由壳保留框架目录，业务进入 `src/features/*`，共享能力进入 `src/shared/*`，基础设施进入 `src/core/*`
      - `legacy-incremental` 的关键目标是：不强迁旧结构，但新增功能优先局部收进 feature 模块
      - 如果 Spec 只写了策略名没写原因，Plan 要先把原因补全，不能把模糊输入原样抄下去

    - 术语对齐确定：从 Spec 的“术语与命名规范”提取本轮核心对象名、禁用别名和代码命名映射。
      - 目标项目开发计划必须显式写出“术语对齐”
      - 本轮涉及的新模块名、状态名和公开文案都要沿用统一口径
      - 如果 Spec 缺少这一节，Plan 要先补清楚，不把漂移留给实现阶段

    - 测试与验证策略确定：从 Spec 的“测试与验证策略”提取严格 TDD 范围、RED 用例与正确失败原因、GREEN 最小实现边界、REFACTOR 范围和例外审批。
      - 目标项目开发计划必须显式写出“测试与验证策略”
      - 如果 Spec 缺少这一节，Plan 要先补清楚，不把 TDD 顺序留给实现阶段临时猜
      - 除 visual-only T1 受控例外外，每个包含新功能、bug 修复、重构或行为变更的 Phase 都要继承 RED-GREEN-REFACTOR；原型、生成代码或配置文件例外须有用户明确批准

    - 接口契约治理确定：从 Spec 的“接口契约治理”和 `接口契约.md` 提取业务能力、入口类型、统一契约入口和门禁命令。
      - 目标项目开发计划必须显式写出“接口契约治理”
      - 涉及真实 endpoint、service、public entry、server action、fetch wrapper、IPC / event 通道或 schema 的 Phase 必须写清对应 `能力ID`
      - 新入口只有在既有统一契约无法复用或扩展时才允许规划，并写明迁移 / 废弃关系

    - Phase 拆分：将 Spec 中的功能需求按依赖关系和复杂度分解为有序的 Phase 序列。每个 Phase 是一个可独立验收的功能单元。
      - 拆分依据：功能依赖关系（A 依赖 B → B 先做）、技术基础设施放最前、核心功能优先于辅助功能
      - 粒度标准：一个 Phase 通常包含 1-3 个核心交付物

    - 每个 Phase 的交付清单：每个 Phase 必须明确交付什么。用动词开头，描述用户可感知的功能。
      - 格式："用户能做什么 → 系统做什么"或"完成 XX 基础设施搭建"

    - 每个 Phase 的关键文件：每个 Phase 必须列出将要创建或修改的具体文件路径。
      - 对新项目：根据技术栈与代码组织策略推导目录结构；`feature-first` 时优先落在 `src/features/*`、`src/shared/*`、`src/core/*`
      - 对已有项目：扫描现有代码结构作为基础

    - 每个 Phase 的模块设计：每个 Phase 必须写清模块边界，不允许只列文件路径不给职责。
      - 至少包含：模块职责、公共入口、依赖约束
      - 涉及接口时必须包含：`能力ID`、统一契约入口、调用方和 `check-api-contracts` 验证要求
      - `依赖约束` 至少写清：允许依赖哪些层，禁止直连哪些内部实现
      - `feature-first` 时，模块入口默认是 `src/features/<name>/index.ts`
      - `legacy-incremental` 时，也要写清新旧边界：哪些代码继续沿用旧目录，哪些新增能力要收进 feature 模块

    - 功能依赖图：识别功能之间的依赖关系，确保 Phase 排序不违反依赖。
      - 例：聊天 UI 依赖消息数据库 → 数据库必须在聊天 UI 之前
      - 例：IM Bridge 依赖 Agent 引擎 → Agent 引擎必须在 IM 之前

    **尽量分析**（有这些，Plan 更落地）：

    - 数据库设计：如项目需要数据库，梳理所有数据表、所属 Phase、用途。
      - 格式：表名 + 首次创建的 Phase + 用途说明

    - 每个 Phase 的验收标准：每个 Phase 完成时如何验证。
      - 最低标准：每个新增或改变的行为都有本轮 RED 正确失败、GREEN 全绿和 REFACTOR 后回归证据
      - 实现顺序：最小 failing test / regression test → 确认正确 RED → GREEN 最小实现 → 全绿后 REFACTOR
      - 例外顺序：仅原型、生成代码或配置文件可申请；用户明确批准后才按批准范围使用替代验证，无法自动化本身不构成例外资格
      - 推荐标准：能编译 + 能启动 + 新功能可用 + 现有功能未破坏
      - 人工验收标准：说明人工验收是否适用；如适用，列出用户真实点击 / 操作 / 观察路径、人工重点和回归触发条件

    - 已知风险与限制：标注某些 Phase 中预期会有的技术风险或已知限制。
      - 例："Phase 4 只实现 UI 配置界面，IM 实际连接引擎在 Phase 10"

    **不需要分析**（交给 dev-builder 决定）：
    - 具体的代码实现细节（函数签名、类接口）
    - 具体的 CSS 样式方案
    - 细粒度测试用例设计
    - Git 分支策略

