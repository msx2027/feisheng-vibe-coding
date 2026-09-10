# 工作流程（持续开发模式）

> 来源：dev-builder/SKILL.md 的 [工作流程（持续开发模式）]。
> 读取时机：已有项目继续开发、恢复 doing/blocked 任务、逐 Task 实现时。

## 目录

- 加载阶段
- Phase 执行流程
- Phase 完成验证
- 用户确认
- 引导下一步

[工作流程（持续开发模式）]
    触发条件：有目标项目开发计划 + 有项目代码

    [加载阶段]
        第一步：依赖检测
            执行 [依赖检测]

        第二步：加载文档和代码状态
            读取目标项目开发计划 → 识别所有 Phase 及完成状态
            如目标项目开发计划中为当前 Phase 索引了补充计划文档 → 一并读取对应补充文档
            如仓库存在 `tools/plan-hygiene.ps1` 或 `tools/plan-hygiene.sh` → 先运行 Plan Hygiene 自动评估
            - `clean` → 继续
            - `cleanup_recommended` → 如本轮要继续多个 Task，先压缩目标项目开发计划并归档旧 Phase 明细后再继续
            - `cleanup_required` → 先修复未索引文档、失效路径或过度膨胀的主计划，再继续开发
            如仓库存在 `tools/plan-resume.ps1` 或 `tools/plan-resume.sh` → 先运行恢复评估
            - `resume_interrupted_task` / `resolve_blocked_task` → 先恢复或对账该任务
            - `manual_reconcile_required` → 先修正多个 `doing` 或状态冲突，再继续开发
            - `no_interrupted_task` → 正常继续
            读取目标项目需求文档 → 作为功能参照，并提取“测试与验证策略”
            读取目标项目开发计划的“测试与验证策略” → 作为当前 Phase / Task 的直接执行口径
            读取目标项目接口契约文档 → 作为 endpoint、service、public entry、server action、IPC / event 通道和 schema 的统一入口参照
            如有目标项目设计简报 → 读取视觉方向
            如有设计工具 MCP → 准备读取
            扫描已有代码结构 → 了解当前项目状态

        第三步：确定当前 Phase
            显示 Phase 列表和完成状态
            识别下一个待开发的 Phase
            如用户指定某个 Phase → 使用指定的

    [Phase 执行流程]
        第一步：Plan + 任务清单
            这一步是编码的前置条件，不可跳过，不需要用户确认。没有 Plan 和任务清单不允许写任何代码。
            1. 读取该 Phase 的交付清单、关键文件和“测试与验证策略”；如目标项目开发计划为该 Phase 索引了补充计划文档，则一并读取
            2. 如有设计工具 MCP 已连接，查看该 Phase 涉及的页面，读取精确数值。如无设计工具，以目标项目设计简报或需求文档为参照
            3. 探索现有代码，理解当前结构
            4. 规划实现步骤：除 visual-only T1 受控例外外，把每个新增或改变的可观察行为拆成 RED-GREEN-REFACTOR，并写明正确失败原因、最小实现边界和整理范围；受控 T1 写边界核对、既有 seam 结论、改前基线、改后同路径证据、副作用检查和越界停止条件
            5. 用任务清单工具列出具体任务清单，每个页面、组件、功能一个 Task，并给每个 Task 标明验证方式
            6. 将任务清单写入目标项目开发计划；如单文件过长，可写入该 Phase 对应的四字中文补充计划文档，并在开发计划中记录索引和恢复入口
            7. 任务清单列好并写入后直接进入第二步，不等用户确认

        第二步：逐个 Task 实现 + 单 Task Review 循环

            对每个 Task 执行以下循环：

            开发前——恢复或声明当前任务：
            1. 如 `docs/plans/执行光标.md` 的状态为 `doing` 或 `blocked` → 先恢复或对账该任务，不得直接开始新的 Task
            2. 读取目标项目开发计划中该 Task 对应的交付清单和关键文件
            3. 如目标项目开发计划为该 Task 或所在 Phase 索引了补充计划文档 → 一并读取该补充文档中的任务状态、备注和恢复信息
            4. 在对应的四字中文 Phase 明细中将当前 Task 标记为 `doing`
            5. 如仓库存在 `tools/plan-state.ps1` 或 `tools/plan-state.sh` → 写入 `.vibe-docs.json.currentExecution` 映射的投影，默认 `docs/plans/执行光标.md`，记录当前 Task、checkpoint 和下一步
            6. 读取目标项目需求文档中该 Task 涉及的功能描述
            7. 读取目标项目设计简报中该 Task 涉及的视觉方向和页面备注
            8. 如有设计工具 MCP 已连接，通过设计工具找到该 Task 对应的设计页面，读取该页面及其组件的精确数值。每个 Task 都重新读取，不凭记忆
            9. 明确该 Task 的交付目标：功能上实现什么、视觉上做成什么样
            9.1. 读取 `.vibe-docs.json.manualAcceptance` 映射文档（默认 `验收记录.md`），判断当前 Task 是否影响已人工验收范围；如果影响，记录自动化回归计划或限定复验路径
            9.2. 如当前 Task 涉及真实 endpoint、service、public entry、server action、fetch wrapper、IPC / event 通道或 schema，读取 `.vibe-docs.json.interfaceContracts` 映射文档（默认 `接口契约.md`），确认复用既有 `能力ID` 和统一契约入口；确需新增入口时先更新契约台账
            10. 判定当前 Task 的 `execution tier`，并按 tier 写入备注：
                - T2：短工程计划 = 目标、影响面、RED 测试、GREEN 验证路径、升级触发条件
                - T3：strict execution loop = 分类、成功标准、风险 / 影响面、RED、GREEN、REFACTOR、fresh 验证、独立双阶段 review、doc-sync、finish checklist
                - T3+：Hazard Task Packet = 目标 / 非目标、风险类型、影响面、允许修改文件、禁止触碰文件、RED 失败证据或用户明确批准的例外、验证命令、rollback 方案、finish checklist
            11. 独立计算 `review profile`：T0=`none`、T1=`directed-check`、T2=`split-self-review`、高影响 T2/T3=`independent-two-stage`、T3+=`hazard-review`
            12. 结合目标项目需求文档 / 开发计划，明确当前 Task 的 RED 用例与预期失败原因、GREEN 最小生产代码边界、REFACTOR 范围和相关回归命令
            12.1. 如属于原型、生成代码或配置文件，先请求用户明确批准例外；把批准依据、替代验证、风险和恢复方案写进 Task 备注或 checkpoint。无法自动化本身不构成例外资格
            12.2. 把 tier、review profile、TDD 证据要求和完成证据写进当前 Task 的备注或 checkpoint，避免中断后重猜
            12.3. T2/T3 在首个 RED 前读取既有开发计划或 Phase 明细的预实现一致性分析；仅当 sourceRevision 仍匹配且结论为 `PASS` 才能继续。缺失、过期或 `BLOCKED` 时先回到 dev-planner，不能用任务胶囊回执替代分析真源

            编码：
            13. RED：先写并运行一个最小失败测试；确认它因目标行为缺失而正确失败，测试通过、报错或失败原因不符时不得实现
            14. GREEN：只写让当前失败测试通过的最小生产代码，运行当前测试与相关回归；全部通过后才能 REFACTOR，并在整理后再次保持全绿
            15. T3+ 编码前检查隔离：Git 仓库默认独立 branch，多文件或高破坏性改动优先 worktree；如果不能隔离，记录原因和恢复方案后继续执行最小实现
            16. 严格按参照文档实现，逐个组件对照设计数值编码
            17. 每完成一个关键 checkpoint，更新 `.vibe-docs.json.currentExecution` 映射的投影，默认 `docs/plans/执行光标.md` 中的 `Last Checkpoint` 和 `Resume Next Step`

            开发后——对照验证 + Review 循环：
            18. 读取代码实际值，逐项与设计数值核对，有偏差则修正
            19. 对照目标项目需求文档确认功能行为符合描述，并确认验证方式符合“测试与验证策略”
            20. 按 review profile 执行：T1 `directed-check`；普通 T2 `split-self-review`，同一 Agent 也必须分别输出 Spec Compliance 与 Code Quality；高影响 T2/T3 `independent-two-stage`；T3+ `hazard-review`
            21. 主 Agent把所有 finding 合并进当前 Task 的 finding ledger；启用任务胶囊时持久化到 `审查台账.md`，否则写进当前 Task / Phase 计划或审查报告。Critical / Important 进入 fixing，Minor 必须修复或明确 accepted-risk / deferred / rejected-with-reason
            22. Spec finding → 补实现或请求用户裁决；Quality finding → 调用 bug-fixer 或明确修复者。修复后交回对应 fresh Reviewer reverify；Reviewer 只读，不直接修复。相同类型 finding 连续两轮仍未消除时停止机械循环并诊断根因
            23. 如本 Task 改变需求、术语、工作流、Skill、Hook、Tool、发布流程或对外文档承诺 → 调用 doc-sync-guardian 并同步文档
            23.1. 如本 Task 新增或修改真实接口、fetch 调用、service/public entry、server action、IPC / event 通道或 schema → 运行 `check:api-contracts` 或 `node tools/check-api-contracts.mjs .`，并把能力ID与验证结果写入收口证据
            23.2. 执行交付收敛检查：以代码、fresh 验证、需求、开发计划和 Phase/Task 逐项反查；有未计划或未实现缺口时回写既有计划/Phase Task 并重新进入 RED-GREEN-REFACTOR，无缺口才进入 finish checklist
            24. 跑 finish checklist，确认成功标准、fresh evidence、两个必要审查阶段、交付收敛检查、finding ledger、review receipt、doc-sync、状态文件、人工验收状态和残余风险全部闭环；T3+ 额外确认 Hazard Task Packet、rollback、风险专项门禁和 fresh verification 已闭环
            24.1. 如人工验收状态为 `待用户验收`，最终回复必须提醒用户真实点击 / 操作 / 观察，并列出路径；如用户已确认，更新 `验收记录.md`；如本轮影响已确认范围且自动化不能覆盖，标记为 `需回归复验`
            25. 全部通过 → 主 Agent再次核验真实 diff、验证证据、收敛结论与 ledger 终态，再标记任务 `done`；只有必要 review receipt 与当前 diff hash 一致时，才执行 `tools/mark-review-clean.sh` 刷新 review 状态与快照 → commit
            26. 进入下一个 Task

            编码过程中始终遵循：
            - [开发规则清单] 中的所有规则
            - [修改纪律]：每次改动前评估影响
            - [联网搜索策略]：用外部库前确认 API
            - 遇到阻塞时明确说明，不强行继续

        第三步：Phase 完成验证
            所有 Task 完成后，执行 [Phase 完成度判断] 的四步走验证
            Phase 收口至少使用 `independent-two-stage`，审查累计 BASE...HEAD diff 与所有 Task finding ledger，形成 Phase ledger，确保跨 Task 契约、状态和回归问题被发现
            每步附上证据
            不通过则修复后重新验证

        第四步：用户确认
            向用户汇报 Phase 完成情况，附证据
            如存在人工验收项，必须先提醒用户按指定路径真实点击 / 操作 / 观察；用户明确确认后，写入 `验收记录.md`，再标记为人工验收 `用户已确认`
            用户确认 OK → Phase 完成
            用户有修改意见 → 修改后重新走第三步

        第五步：引导下一步
            "Phase N 已完成验证。下一个：Phase N+1。继续？"
