---
name: code-review
description: 仅当用户先明确调用 `vibe-coding-skills` 总入口并指定 `code-review`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发。当用户说要审查代码、检查质量、验证功能是否完整，或需要对照 Spec 和设计稿验证代码实现时使用。输出结构化审查报告，每项结论附证据。
user-invocable: false
disable-model-invocation: true
---
[任务]
    对照目标项目需求文档和设计稿，审查代码实现的完整度和质量。
    输出结构化审查报告。修复由主 Agent 拿到报告后使用 dev-builder 或 bug-fixer skill 执行。

    review profile 与 execution tier 分开计算：
    - `none`：T0 不启动正式审查，只保留定向验证和 diff 摘要。
    - `directed-check`：T1 由同一 Agent 快速确认目标与明显副作用，不加载完整 Spec。
    - `split-self-review`：普通 T2 由同一 Agent 强制分开输出 Spec Compliance 与 Code Quality。
    - `independent-two-stage`：高影响 T2/T3 由主 Agent 派发 fresh Spec Reviewer 与 fresh Quality Reviewer。
    - `hazard-review`：T3+ 在独立双审外检查 Hazard Task Packet、rollback、风险专项门禁和 fresh verification。


[依赖检测]
    Skill 启动时第一步自动执行：

    必需：
    - 目标项目需求文档 → 优先用 `.vibe-docs.json` 的 `productSpec`，新项目默认 `docs/需求文档.md`；legacy `Product-Spec.md` 只作为读取迁移输入，缺失则提示先调用 /product-spec-builder
    - 项目代码已存在 → 无代码则提示先调用 /dev-builder

    可选（增强审查能力）：
    - 目标项目开发计划 → 优先用 `.vibe-docs.json` 的 `devPlan`，新项目默认 `docs/项目治理/开发计划.md`；legacy `DEV-PLAN.md` 只作为读取迁移输入，有则可对照 Phase 交付清单检查
    - 目标项目设计简报 → 优先用 `.vibe-docs.json` 的 `designBrief`，新项目默认 `docs/设计简报.md`；legacy `Design-Brief.md` 只作为读取迁移输入，有则可对照视觉规范
    - 目标项目人工验收记录 → 优先用 `.vibe-docs.json` 的 `manualAcceptance`，新项目默认 `docs/项目治理/验收记录.md`；用于检查已验收范围是否被本轮改动影响
    - 目标项目任务胶囊 → 优先用 `.vibe-docs.json.taskContext.currentTaskCapsule`；scoped / strict / hazard review 检查 `任务状态.json`、`实现上下文.jsonl`、`验收上下文.jsonl` 是否与当前 diff 和验证证据匹配
    - 设计工具 MCP（Pencil / Figma 等）→ 有则可提取设计数值与代码对比
    - Playwright plugin → 有则可自动化 UI 交互测试
    - git → 有则可用 git diff 追溯变更范围
    - codebase-memory-scout → scoped / strict / hazard review 中用于查当前 diff 的调用链、相关测试和跨模块影响面；MCP 不可用时降级为 `rg`


[第一性原则]
    **目标项目上下文加载协议（优先级高于下列文档读取描述）**：先解析 `.vibe-docs.json` 的 schema v2、`documentIndex/documents/loadPolicy`，再按本次 review 范围显式请求 role；默认从 `documentIndex,currentExecution` 开始，只有 diff / Task 命中时才追加 `productSpec/devPlan/manualAcceptance/interfaceContracts`。任务胶囊的 `验收上下文.jsonl` 必须作为 resolver 的 `--capsule` 输入。只审 resolver 返回的 selector；never 被拒绝即记录阻塞，本 Skill 不得用 `--allow-never` 绕过。

    **双阶段与 ledger 硬规则**：T2 及以上必须把 Spec Compliance 与 Code Quality 分成两个审查阶段；Reviewer 只读，不直接修复、不写 ledger、不刷新 review clean。每条 finding 使用 `Critical / Important / Minor` 严重度并包含 findingId、reviewStage、evidence、affectedFiles、status、resolution、reverificationEvidence。主 Agent负责把完整 finding ledger 持久化、分配修复、核验 diff 与 fresh evidence；Critical / Important 必须 `reverified` 或有用户明确证据的 `accepted-risk`，Minor 必须修复或明确裁决，不能静默删除。状态机、升级条件、最小审查包、Phase ledger 与 Review Receipt 统一以 `references/review-profiles.md` 为准。

    **阶段边界**：Spec Reviewer 只判断需求、验收、越界、术语、接口契约和人工验收影响，不把代码风格混入第一阶段；Quality Reviewer 使用已经冻结的需求边界，只判断正确性、边界、可维护性、测试质量、复杂度、性能、安全和兼容性，不重新发明需求。Spec 阶段仍有 Critical / Important 时暂缓 Quality，但最终收口必须完成两个必要阶段。

    **交付收敛检查**：实现、fresh 验证和必要审查后，将已实现代码与验证证据逐项反查需求、计划、Task；这是既有 finding ledger / Review Receipt 的收口维度，不新建平行清单。
    - 发现未计划或未实现缺口时，报告具体证据；主 Agent必须回写既有计划/Phase Task，重新进入 RED-GREEN-REFACTOR 后再复审
    - 只有无未计划或未实现缺口、Critical / Important 已闭环且收敛结论有证据，任务才可标记完成

    **目标项目文档解析原则**：审查用户目标项目时，先读 `.vibe-docs.json`，再按角色映射定位 `docs/需求文档.md`、`docs/项目治理/开发计划.md`、`docs/设计简报.md`、`docs/plans/执行光标.md` 和 `docs/项目治理/验收记录.md`。
    - 正文中出现的 `Product-Spec.md`、`DEV-PLAN.md`、`Design-Brief.md` 是 legacy 角色名；新目标项目必须解析到四字中文 `.md`
    - 如果发现新目标项目继续生成英文生命周期 `.md` 文档名，按命名漂移处理
    - 审查目标项目文档命名时运行 `node <skills仓库>/tools/check-target-doc-names.mjs <目标项目根目录> --require-existing`

    **任务胶囊一致性检查**：目标项目启用 `taskContext` 时，scoped / strict / hazard review 必须检查当前胶囊是否指向本轮任务。`实现上下文.jsonl` 的必需文件应覆盖实现所依赖的上下文，`验收上下文.jsonl` 的必需文件应覆盖验证证据；当前 diff、验证命令或人工验收记录与胶囊不一致时，按上下文漂移或验证缺口报告。

    **不信任声明**：不接受"已实现"、"大致匹配"这种模糊结论。每个功能要么有代码实现（附文件路径和行号），要么没有。
    **证据为王**：说"通过"必须附编译输出、API 响应或数值对比结果。没有证据的"通过"等于没审查。
    **扫描命中分类**：安全、隐私、危险 API 或密钥扫描命中时，必须区分真实执行代码、构建产物、规则样本、文档示例、测试 fixture 和外部数据资产；不能把文档里的检测规则样例误报成运行时漏洞，也不能用“只是示例”掩盖真实执行路径。
    **假设也算审查对象**：实现里如果静默选了一个解释、没说明关键假设，或该质疑的前提没有被质疑，也算问题。
    - 多种合理解释并存却直接挑一个落地，要在报告里显式指出
    - 用户前提、Spec、代码证据互相冲突时，不能默认帮实现者圆过去
    **简洁优先**：能简单完成的任务却被写成过度抽象、过度配置或提前通用化，也算质量问题。
    - 单次任务引入多层抽象、单次使用的扩展点或明显超量配置时，要单独报问题
    **手术式修改检查**：与当前需求无关的顺手修改、邻近清理和 drive-by refactor，不是“顺便优化”，而是审查问题。
    **代码图影响面检查**：用户点名或 T2/T3 review 命中跨模块、调用链不清、入口不明、影响面不明时，可先用 `codebase-memory-scout` 查改动函数、callers/callees、相关测试和跨包影响；MCP 结果只作为审查线索，最终结论必须绑定 diff、源码和 fresh 验证证据。
    **术语一致性优先**：Spec 和 Plan 已定的主名就是审查基准。代码、文档、UI 文案继续混用禁用别名，算漂移，不算“小问题”。
    **UI / token / 组件复用检查**：审查正式前端页面、组件库、样式、token、theme 或设计稿落地时，必须检查是否遵守目标项目的设计系统复用链路。
    - 先确认目标项目是否已有 UI 包、token 文档、组件盘点、复审报告和门禁脚本
    - 页面层绕过 UI 包手搓按钮、输入、弹窗、导航、标签、列表、卡片或状态组件，标记问题
    - 页面层新增裸色值、Tailwind 任意视觉值、临时圆角、阴影、全局 token 或 theme 变量，且没有 `vibe-ui-allow-next-line` / `vibe-ui-allow-file` 或目标项目等价 allow 注释，标记问题
    - 页面层直接使用原生 `button/input/select/textarea/dialog`，且没有明确 allow 原因，标记问题
    - 组件、slot、variant 或 token 不够却没有回到 UI 包扩展，标记问题
    - UI 包 / token 变更没有同步 token 文档、组件盘点、预览、复审证据或 `check-ui-reuse` 门禁说明，标记 doc-sync 问题
    - 如问题主因是 UI 系统缺口或历史 UI 债务，审查结论应建议后续进入 `ui-system-guardian`，不要只要求页面层继续打补丁
    **UI 精修 / 复刻边界检查**：审查精修 UI、复刻 UI、image-to-code、截图 / 设计稿还原或视觉 polish 时，必须检查是否把视觉任务扩大成未经确认的业务开发。
    - 目标项目没有对应功能、接口、状态流、数据模型或业务流程，却新增真实业务逻辑、接口调用、持久化、提交、权限、支付、删除或后台任务，标记问题
    - 占位符、mock 数据、disabled、noop、TODO 或静态状态没有在交付说明中标明，标记问题
    - 用户未明确要求开发对应功能，却把按钮、表单或流程做成真实生效，按风险信号升级到 T2/T3 审查
    **业务能力接口契约检查**：审查新增或修改真实 endpoint、service、public entry、server action、fetch wrapper、IPC / event 通道或 schema 时，必须检查接口契约台账。
    - 先读取 `.vibe-docs.json.interfaceContracts` 映射的 `接口契约.md`
    - 新增 API route、typed client path、fetch wrapper、service/public entry、IPC / event 或 schema 没有登记到契约台账，标记“接口漂移”
    - 目标项目配置 raw network gate 时，正式前端源码直接 `fetch(` 或 `new WebSocket(` 绕过统一 client，标记 Important，除非有明确 allowlist 和契约证据
    - 同一业务能力出现多个 endpoint / service / public entry / schema / event，且没有迁移关系、调用方影响和测试证据，标记 Important
    - 目标项目存在 `tools/check-api-contracts.mjs` 或 `check:api-contracts` 但本轮未运行，标记验证缺口
    - Spec 未提及的 API endpoint 继续按 Spec 漂移处理
    **严格 TDD 审查**：除下述受控 T1 外，所有新功能、bug 修复、重构和行为变更必须遵守 `RED-GREEN-REFACTOR`，目标项目文档不能降低这条纪律。
    - 必须有时间顺序可信的本轮 RED 证据：测试先运行、因目标行为缺失而正确失败；测试通过、测试报错或失败原因不符都不算 RED
    - RED 后的生产代码必须是让测试通过的最小实现；GREEN 必须包含当前测试与相关回归全绿证据；REFACTOR 只能发生在全绿后且不得新增行为
    - 只有原型、生成代码或配置文件可提出例外，而且必须有写生产代码前的用户明确批准；无法自动化本身不构成例外资格，缺审批按 Important 处理
    - 编译、启动、smoke、手动复现和人工验收是补充证据，不能替代 RED/GREEN；完成声明必须同时包含本轮 RED 和 GREEN fresh 证据
    - visual-only T1 受控例外：仅限同一组件 / 容器内、不改变用户路径、信息层级、响应式结构、全局 token / theme、UI 包契约或真实业务行为的呈现微调。没有既有测试 / visual regression seam 时，必须有可复现的改前基线、改后同路径定向视觉证据与副作用检查；不因缺 RED 报 finding，也不得为本次微调新建测试框架。已有 seam 仍执行 `RED-GREEN-REFACTOR`，任一边界被触发就退出例外并重新分级
    **目标驱动验证检查**：如果实现没有明确成功标准，或验证证据不足以证明“完成”，不能用“基本可以”放过。
    **人工验收检查**：自动化通过不等于人工验收通过。审查必须检查本轮改动是否命中需要用户真实点击 / 操作 / 观察的内容，以及是否正确记录人工验收状态。
    - UI、设计稿、CLI 人机流程、权限确认、端到端链路、安装启动、发布后 smoke 等自动化不能完全证明的内容，如果没有人工验收提醒，标记问题
    - 没有用户明确确认却写成 `用户已确认`，标记 Important
    - 本轮改动影响 `验收记录.md` 中已确认范围，却没有影响分析、自动化回归或限定复验路径，标记问题
    - 要求用户全量重复验收但没有说明自动化无法覆盖原因，标记为过度人工回归
    **不放过**：Spec 里的每一条功能需求都必须被检查到。不允许"其余功能看起来正常"这种笼统结论。
    **联网优先**：审查中发现的可疑代码模式或安全隐患，先 WebSearch 确认是否是已知问题再下结论。


[文件结构]
    ```
    code-review/
    ├── SKILL.md                           # 主 Skill 定义（本文件）
    └── references/
        ├── llm-coding-antipatterns.md     # LLM 编码反模式速查
        ├── output-style.md
        ├── review-dimensions.md
        ├── review-profiles.md             # review profile、finding 状态机与复审协议
        ├── review-strategy.md
        └── workflow.md
    ```


[按需加载 references]

    本 Skill 的 `SKILL.md` 只保留必读主流程。不要默认读取全部 references；只有命中下表场景时，再读取对应文件。

    | Reference | 读取时机 |
    | --- | --- |
    | `references/llm-coding-antipatterns.md` | 审查实现纪律、过度抽象、静默假设、顺手重构或验证目标不清时。 |
    | `references/output-style.md` | 需要完整审查报告格式、语态或 priority 分级输出时。 |
    | `references/review-dimensions.md` | 执行 light/scoped/strict/hazard review，需要完整检查维度时。 |
    | `references/review-profiles.md` | T2+ 收口、选择独立 Reviewer、建立 / 更新 finding ledger、复审或 Phase 收口时。 |
    | `references/review-strategy.md` | 需要逐项对照、设计数值比对、Playwright 或安全扫描方法时。 |
    | `references/workflow.md` | 实际执行审查、扫描代码、输出报告时。 |

[核心流程摘要]

    - 先判 execution tier，再独立计算 review profile；普通 T2 也必须分开执行 Spec Compliance 与 Code Quality。
    - 审查前只组装当前 Task/Phase 的最小审查包，不把实现者 DONE 当完成证据。
    - 不接受“已实现/大致匹配/应该没问题”，每个结论必须有证据。
    - 所有生产代码行为变化都要检查本轮 RED-GREEN-REFACTOR，或受控 visual-only T1 的边界、seam、基线、同路径证据与副作用检查；必要例外审批和相关回归证据不得遗漏。
    - T3 使用两个 fresh Reviewer；T3+ 还要检查 hazard task packet、rollback、风险专项门禁和 fresh verification。
    - 交付收敛检查必须反查需求、计划、Task 与代码/验证证据；发现遗漏就回补既有计划并重新进入 RED-GREEN-REFACTOR。
    - Critical / Important 修复后必须交回对应审查方向 reverify；Minor 必须修复、accepted-risk、deferred 或 rejected-with-reason；每轮输出 Finding Ledger Delta 与 Review Receipt。
    - 必查人工验收：是否漏提醒、误标 `用户已确认`、或破坏已验收范围。

[初始化]

    1. 执行 [依赖检测]。
    2. 只读取本 `SKILL.md` 的必读内容，先完成任务分类和成功标准。
    3. 按 [按需加载 references] 表命中场景后，再读取对应 reference；不要为了保险全量加载。
    4. 如果需要写回目标项目文档，继续遵守四字中文文档名、`.vibe-docs.json` 和人工验收记录规则。
