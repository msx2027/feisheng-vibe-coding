# 工作流程（迭代模式）

> 来源：dev-planner/SKILL.md 的 [工作流程（迭代模式）]。
> 读取时机：需求变化后更新已有开发计划和 Phase 明细时。

[工作流程（迭代模式）]
    触发条件：
    - 已有目标项目开发计划且 Product Spec 发生变更
    - 用户主动要求调整 Phase

    [变更分析阶段]
        第一步：加载现有文件
            读取现有目标项目开发计划；优先用 `.vibe-docs.json` 的 `devPlan`，默认 `docs/项目治理/开发计划.md`
            读取更新后的目标项目需求文档
            读取目标项目接口契约文档；优先用 `.vibe-docs.json` 的 `interfaceContracts`，默认 `接口契约.md`
            如有 `需求变更.md` → 读取最近的变更记录，快速定位变更范围
            如 `.vibe-docs.json.designBrief` 映射的 `docs/设计简报.md` 存在 → 读取，检查视觉方向是否也有变更
            如有设计工具 MCP 已连接 → 读取最新设计稿，对比变更涉及的页面

        第二步：识别变更影响
            对比 Spec 变更内容与现有 Plan：
            - 新功能 → 需要新增 Phase 或插入已有 Phase
            - 功能修改 → 需要更新对应 Phase 的交付清单和关键文件
            - 功能删除 → 需要移除或精简对应 Phase
            - 技术栈变更 → 可能需要重排多个 Phase
            - 代码组织策略变更 → 需要同步更新受影响 Phase 的模块设计、公共入口和依赖约束
            - 术语变更 → 需要同步更新“术语对齐”以及受影响 Phase 的名称、交付清单、关键文件说明
            - 测试与验证策略变更 → 需要同步更新“测试与验证策略”以及受影响 Phase 的验收标准和验证证据要求
            - 接口契约变更 → 需要同步更新“接口契约治理”、受影响 Phase 的模块设计、统一契约入口和 `check-api-contracts` 验证要求

        第三步：向用户说明影响
            "Spec 的变更会影响 Plan 中的以下 Phase：
             - Phase N：[影响说明]
             - Phase M：[影响说明]
             需要我直接更新吗？"

    [更新阶段]
        第一步：更新 Phase
            在现有目标项目开发计划上直接修改
            如开发计划中索引了补充计划文档，同步更新索引关系和恢复入口
            如某个 Phase 需要跨多次 session 持续执行或原有 Task 状态不够清晰 → 补出对应的四字中文 Phase 明细文档
            保持已完成 Phase 不变（标记 ✅ 的不动）
            只改受影响的待开发 Phase

        第二步：重新校验依赖
            确认更新后的 Phase 顺序不违反依赖关系
            确认同一时间最多只有 1 个 `doing` 任务

        第三步：Plan Hygiene 自检
            如仓库存在 `tools/plan-hygiene.ps1` 或 `tools/plan-hygiene.sh` → 运行自动评估
            - `clean` → 继续保存
            - `cleanup_recommended` → 在本轮内压缩目标项目开发计划、归档旧 Phase 明细、更新索引后再保存
            - `cleanup_required` → 先修复未索引文档、失效路径或过度膨胀的主计划，再保存

        第四步：保存文件
            保存更新后的 `docs/项目治理/开发计划.md`
            更新 `.vibe-docs.json` 中的计划文档映射，并保持 `interfaceContracts = 接口契约.md`
            运行 `tools/check-target-doc-names.mjs <目标项目根目录> --require-existing` 校验四字中文 `.md` 命名
            如本次变更涉及真实接口，运行 `tools/check-api-contracts.mjs <目标项目根目录>` 校验契约台账
