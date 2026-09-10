# 审查维度清单

> 来源：code-review/SKILL.md 的 [审查维度清单]。
> 读取时机：执行 light/scoped/strict/hazard review，需要完整检查维度时。

## 目录

- Directed Check: T1 小改审查
- Split Self Review / Independent Two Stage: T2/T3 审查
- Hazard Review: T3+ 高风险审查
- Stage 1: Spec Compliance
- Stage 2: Code Quality

[审查维度清单]
    T2 及以上审查分两个阶段执行。Spec Compliance 存在 Critical / Important 时暂缓 Code Quality；阻断项 reverified 后仍必须执行 Code Quality。普通 T2 可由同一 Agent 分段执行，高影响 T2/T3 使用两个 fresh Reviewer。

    --- Directed Check: T1 小改审查 ---

    [适用范围]
        - 小范围 UI copy、样式、低风险配置
        - 不涉及数据、权限、安全、路由、环境变量、命令、Skill / Hook / Tool 规则
        - 只检查当前 diff 是否符合用户请求、是否有明显副作用、是否提供定向验证

    [升级条件]
        - 发现行为语义变化、风险关键词或影响面不清 → 立即升级为 Stage 1 标准审查
        - 混合批次按最高 tier 处理，不能只审低风险部分

    --- Split Self Review / Independent Two Stage: T2/T3 审查 ---

    [适用范围]
        - 普通功能、组件、状态逻辑或中等风险配置
        - 审查范围限定为当前 Task / Phase 的最小审查包、直接关联文件、影响面说明和 fresh 验证证据
        - 所有 T2 都必须分别输出 Spec Compliance 与 Code Quality；高影响 T2/T3 再增加 Reviewer 隔离

    [升级条件]
        - 出现 auth、permission、token、secret、payment、database、migration、security、eval、network、filesystem、shell、pre-commit、hook、agent routing、release 等信号 → 立即升级 T3
        - 影响面无法从 diff、计划或验证证据可靠判断 → 升级 T3
        - 混合批次包含 T3 文件或行为 → 整体按 T3
        - 公共 API / IPC / event / schema、≥3 模块、≥5 文件真实业务逻辑、子 Agent 实现、需求变化、重复失败、已人工验收路径或 Phase 收口 → review profile 至少 `independent-two-stage`

    --- Hazard Review: T3+ 高风险审查 ---

    [适用范围]
        - auth、permission、security、token、secret、payment、database、migration、data loss、filesystem、shell、network、eval、pre-commit、hook、agent routing、Skill / Hook / Tool 规则、release / deploy / publish
        - 删除、重命名、迁移行为文件，或影响面无法可靠判断

    [硬性检查]
        - Hazard Task Packet 是否完整：目标 / 非目标、风险类型、影响面、允许修改文件、禁止触碰文件、复现或 RED 证据、验证命令、rollback 方案、finish checklist
        - 是否有本轮 RED 正确失败证据和 GREEN 通过证据；例外是否在写生产代码前获得用户明确批准并记录替代验证和风险
        - 是否只修改了允许修改文件，是否触碰了禁止触碰文件
        - 是否有 rollback / 恢复路径，且路径和实际改动匹配
        - 是否执行对应风险专项检查：auth / permission 反向权限测试，data / migration rollback，security secret / injection / XSS / dependency scan，release 部署后 smoke

    --- Stage 1: Spec Compliance（做对了没有？）---

    [功能完整性]
        逐条对照目标项目需求文档的功能需求：
        - Spec 中的每个功能是否有对应的代码实现
        - 实现是否完整（不是半成品）
        - 行为是否符合 Spec 描述（不是"能跑"就算完成）
        - 如有目标项目开发计划 → 对照当前 Phase 的交付清单

        对每个功能输出：
        - ✅ 完整实现 — Spec 条目 + 代码位置 + 验证方式
        - ⚠️ 部分实现 — 缺失的具体内容
        - ❌ 未实现 — Spec 原文引用

    [UI 一致性]（如有设计稿）
        对照设计稿检查 UI 实现：
        - 如有设计工具 MCP → 提取设计数值，与代码中的 Tailwind class / style 逐项比对
        - 查看设计稿视觉效果作为参考
        - 对比：布局、组件、颜色、间距、交互状态
        - 如有目标项目设计简报 → 对照色彩方向、信息密度、交互风格

    [术语一致性]
        - 对照目标项目需求文档的“术语与命名规范”和开发计划的“术语对齐”
        - 检查页面文案、模块名、状态名、变量名是否继续混用禁用别名
        - 检查是否出现“未登记核心名”或“同一对象多主名冲突”
        - 发现新增核心对象名但没回写文档时，标记为“⚡ 术语漂移”
        - “未登记核心名 / 多主名冲突”默认按 Important 处理，先修复并复审再进入 Code Quality

      [人工验收一致性]
          - 检查当前 diff 是否包含 UI、设计、CLI 人机流程、权限、端到端链路、安装启动或发布交付
          - 检查交付说明或执行光标是否标出人工验收状态：`不适用 / 待用户验收 / 用户已确认 / 需回归复验`
          - 检查 `用户已确认` 是否有用户明确确认和 `验收记录.md` 记录支撑
          - 检查已确认记录是否被本轮改动影响；如影响，是否优先自动化回归，是否只复验受影响路径
          - 发现漏提醒、误标通过或无依据重复验收时，标记为“🧑 人工验收问题”

      [接口契约一致性]
          - 检查 `.vibe-docs.json.interfaceContracts` 是否映射到 `接口契约.md`
          - 检查新增或修改的 endpoint、service、public entry、server action、fetch wrapper、IPC / event、schema 是否登记到契约台账
          - 检查同一 `能力ID + 入口类型` 是否出现多个 `契约入口`
          - 检查同一 endpoint / service 是否被多个业务能力占用且没有合并 / 废弃说明
          - 目标项目有 `tools/check-api-contracts.mjs` 或 `check:api-contracts` 时，检查 fresh 验证证据
          - 发现未登记、重复造接口或门禁缺失时，标记为“🔌 接口漂移”

      [编码纪律一致性]
          - 检查实现是否静默脑补需求、默认选边处理歧义，或遗漏应说明的关键假设
          - 检查是否出现明显过度设计：单次任务引入过多抽象、配置层或提前通用化
          - 检查改动是否超出当前需求，存在顺手改无关代码、drive-by cleanup 或无关 refactor
          - 检查实现和汇报是否写清成功标准；如果只有“看起来对”“应该没问题”，标记为“🧭 编码纪律问题”

      --- Stage 2: Code Quality（做好了没有？）---
    Spec Compliance 的 Critical / Important reverified 后进入 Code Quality。报告若暂缓第二阶段，必须保留待执行状态；最终收口不能只做一个阶段。
    T2 `split-self-review` 可由同一 Agent 执行两个有界阶段；高影响 T2/T3 `independent-two-stage` 必须由两个 fresh Reviewer 实例执行。T3+ 在两阶段之外额外执行 [硬性检查]；缺 Hazard Task Packet、rollback、风险专项门禁或 fresh verification 任一项，按 Critical / Important 处理。

    [代码质量]
        - 命名规范：PascalCase 组件、camelCase 函数/变量、kebab-case 文件
        - 类型安全：无 any、无 @ts-ignore、无 as unknown as X
        - 文件大小：超过 300 行的文件标记
        - 单一职责：一个文件是否做了太多事
        - 重复代码：是否有可以提取的公共逻辑
        - 错误处理：异步操作有没有 catch、用户操作有没有错误提示

    [测试与验证策略一致性]
        - 对照目标项目需求文档 / 开发计划的“测试与验证策略”
        - 所有新功能、bug 修复、重构和行为变更必须先有最小失败测试；确认测试先运行，且因目标行为缺失而正确失败
        - 检查 GREEN 是否只写让测试通过的最小生产代码，当前测试与相关回归是否全部通过
        - 检查 REFACTOR 是否只发生在全绿后、是否未新增行为、整理后是否继续全绿
        - 原型、生成代码或配置文件的例外，检查是否在写生产代码前获得用户明确批准，并记录替代验证、风险和恢复方案；无法自动化本身不构成例外资格
        - 编译、启动、Happy path、error-loading-empty state、smoke 和人工验收只能作为补充；缺本轮 RED/GREEN 或时序不可信时，标记为 Important“🧪 测试/验证策略问题”

    [安全扫描]（必须）
        grep 检查以下模式：
        - 硬编码密钥：API Key、Token、密码明文
        - 危险函数：eval()、dangerouslySetInnerHTML、innerHTML
        - SQL 注入：字符串拼接的 SQL 语句
        - 路径泄露：代码中包含绝对路径（/Users/xxx/）
        - 环境变量：VITE_ 前缀变量是否暴露了敏感信息
        - 依赖漏洞：npm audit 结果

    [Spec 漂移检测]（必须）
        检查代码中是否存在 Spec 没有描述的功能：
        - 多出来的页面/路由
        - Spec 未提及的 API endpoint
        - `接口契约.md` 未登记的 endpoint / service / public entry / schema / event
        - 多余的数据库表或字段
        - 超出范围的 UI 组件
        标记为"⚡ Spec 漂移"——可能是好的扩展，也可能是 scope creep

