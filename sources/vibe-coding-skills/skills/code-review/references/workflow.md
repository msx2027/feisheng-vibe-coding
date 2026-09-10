# 工作流程

> 来源：code-review/SKILL.md 的 [工作流程]。
> 读取时机：实际执行审查、扫描代码、输出报告时。

[工作流程]
    [第一步：加载比对基准]
        读取目标项目需求文档 → 提取审查范围内涉及的功能需求、“术语与命名规范”和“测试与验证策略”，编号列出
        读取目标项目开发计划 → 读取当前 Phase 或 Task 的交付清单、关键文件、“术语对齐”和“测试与验证策略”
        读取目标项目人工验收记录 → 识别已确认范围、待验收范围和需回归复验路径
        如有目标项目设计简报 → 读取审查范围内涉及的视觉方向和页面备注
        如有设计工具 MCP → 通过设计工具找到审查范围对应的设计页面，读取这些页面及其组件的精确数值，作为 UI 一致性比对的基准
        确定审查范围：
        - `none`（T0）→ 不启动本 Skill；由实施 Agent 做定向验证和 diff 摘要
        - `directed-check`（T1）→ 当前 diff + 直接关联文件 + 定向验证证据，不加载完整 Spec
        - `split-self-review`（普通 T2）→ 当前 Task / Phase 的最小审查包；同一 Agent 分开执行 Spec Compliance 与 Code Quality
        - `independent-two-stage`（高影响 T2/T3）→ 主 Agent为两个 stage 派发 fresh Reviewer 实例
        - `hazard-review`（T3+）→ 独立双审 + Hazard Task Packet + rollback + 风险专项门禁 + fresh verification
        - 全量审查（/code-review）→ Spec 所有功能
        - Phase 审查（dev-builder Phase 完成验证触发）→ 当前 Phase 的交付清单
        - Task 审查（dev-builder per-Task review 触发）→ 当前 Task 的交付清单
        组装有界最小审查包；实现者 DONE 只是输入，主 Agent先核验真实 diff 和 fresh evidence。

    [第二步：建立有界代码地图]
        只扫描审查包规定的 diff、计划文件范围和直接依赖
        识别：页面/路由、组件、API endpoint、数据库表、hooks、工具函数
        跨模块、入口或调用链不清时才用 codebase-memory-scout / rg 扩展一层；不得为了保险遍历整个项目

    [第三步：逐项比对]
        先执行 Spec Compliance，只判断需求、验收、越界、术语、接口契约和人工验收影响：
        运用 [逐项对照法]：
        - 对照 [功能完整性] 维度，Spec 每条 vs 代码
        - 对照 [UI 一致性] 维度，设计稿 vs 实际页面（如有）
        - 对照 [术语一致性] 维度，检查主名、禁用别名和代码命名映射有没有漂移
        - 对照本轮验收条件中明确要求的测试 / 验证交付物是否漏项；RED-GREEN-REFACTOR 时序与测试质量留给 Quality stage，不在 Spec stage 重复审查
        - 对照 [人工验收一致性] 维度，检查是否漏提醒、误标通过或破坏已确认范围
        - 检查 [Spec 漂移检测]，代码中有没有 Spec 没写的功能

        Spec 阶段存在 Critical / Important 时，登记 finding 并暂缓 Quality；修复且 reverified 后继续，不能永久跳过第二阶段。

    [第四步：Code Quality + 安全审查]
        使用已经冻结的需求边界，不重新发明需求。
        运用 [审查维度清单] 中的 [代码质量] 和 [安全扫描]
        运用 [测试与验证策略一致性] 维度，检查每个新增或改变的可观察行为是否先有正确 RED、再有最小 GREEN、最后才 REFACTOR
        运用 [安全扫描法]，优先复用项目 checker 或 `rg` 检查危险模式；Windows 默认使用 PowerShell，不裸用 Bash-only 管道
        按 platform profile、language adapter 和项目已有脚本执行 build / typecheck / lint / test；不存在的验证项明确记录为不适用，不把 `tsc` 强加给非 TypeScript 项目

    [第五步：输出审查报告与 ledger delta]
        报告固定分为：
        - `## Spec Compliance`：本轮需求和验收条件、已满足项、未满足项、越界实现、契约 / 术语 / 人工验收影响、证据
        - `## Code Quality`：正确性与边界、可维护性、测试质量、重复与复杂度、性能 / 安全 / 兼容性风险、Findings
        - `## Finding Ledger Delta`：每条 finding 的 findingId、reviewStage、severity、evidence、affectedFiles、status、resolution、reverificationEvidence
        - `## Review Receipt`：Task/Phase、reviewStage、Reviewer、profile、reviewed diff hash、round、结论、验证证据、ledger hash

        严重度只用 Critical / Important / Minor。无阻断项时明确写 `NO BLOCKING FINDINGS`；这不替代主 Agent检查完整 ledger 和 fresh gates。

    注意：本 Skill 范围到只读报告为止。修复由主 Agent 拿到报告后路由执行：
    - Spec finding → 主 Agent 调用 dev-builder 补实现；需求冲突先请求用户裁决并更新真源
    - Quality finding → 主 Agent调用 bug-fixer 或明确修复者处理
    - 修复后把新的有界 diff、fresh evidence 与完整 ledger 交回对应审查方向；Spec / 契约变化时重新执行 Spec
    - 相同类型 finding 连续两轮仍未消除时，停止机械复审并判断需求、计划、架构或验证设计根因
