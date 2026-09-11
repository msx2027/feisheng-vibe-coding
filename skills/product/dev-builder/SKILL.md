---
name: dev-builder
description: '仅当用户先明确调用 `vibe-coding-skills` 总入口并指定 `dev-builder`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发；当目标项目开发计划就绪、用户说要开始写代码或继续开发下一个 Phase 时使用'
user-invocable: false
disable-model-invocation: true
---
[任务]
    **初始化模式**：无代码 + 有目标项目开发计划 → 根据技术栈搭建项目骨架，安装依赖，配置开发环境，完成 Phase 1。

    **持续开发模式**：有代码 + 有目标项目开发计划 → 按 Phase 逐步开发。每个 Phase：规划实现 → 读执行语境与设计稿 → 编码 → 按 review profile 收口 Task → Phase 集成验证与审查 → 用户确认。

[依赖检测]
    Skill 启动时第一步自动执行。

    必需：
    - 目标项目需求文档：优先 `.vibe-docs.json.productSpec`，默认 `需求文档.md`；legacy `Product-Spec.md` 只作迁移输入，缺失则回到 `product-spec-builder`。
    - 目标项目开发计划：优先 `.vibe-docs.json.devPlan`，默认 `docs/项目治理/开发计划.md`；legacy `DEV-PLAN.md` 只作迁移输入，缺失则回到 `dev-planner`。
    - 开发计划里的 platform profile、language adapter、architecture profile、scaffold policy、fallback stack 和系统工具要求。

    可选：
    - 设计简报：优先 `.vibe-docs.json.designBrief`，新项目默认 `docs/设计简报.md`；缺失则标记“无设计规范模式”。
    - 目标项目任务胶囊：优先读取 `.vibe-docs.json.taskContext`；启用后当前任务目录为 `taskContext.currentTaskCapsule`，新项目默认根目录 `docs/plans/任务`。非快车道 T2/T3 Task 优先用 `node <skills-root>/tools/init-target-task-context.mjs <target-root> --slug <slug> --title "<title>" --write` 创建或读取；编码前读取 `任务状态.json` 和 `实现上下文.jsonl`。
    - 设计工具 MCP、Playwright、gh CLI：可用则增强交付；缺失则记录降级，不阻塞。
    - 影响面侦察：已有项目 T2/T3、跨模块、入口不明、调用链不清或影响面不清时，先用 `rg` 沿 callers/callees、入口与相关测试缩小范围；有可用的代码图工具时再用。

    安装策略：新增依赖前先检查标准库、平台自带能力和项目已安装依赖；确实不够时说明缺口，等待用户明确同意后才能安装。必需依赖未获授权时记录阻塞；可选依赖缺失只记录降级模式。

[第一性原则]
    **目标项目上下文加载协议（优先级高于下列文档读取描述）**：存在 `.vibe-docs.json` 时，先解析 `schemaVersion/documentIndex/documents/loadPolicy`，再运行 `node <skills-root>/tools/resolve-target-doc-context.mjs <target-root> --roles documentIndex,currentExecution,productSpec,devPlan --budget <本轮预算> --json`。只读取 resolver 返回的文件与 selector；某个 Task 不需要的 role 不加载，onDemand 不得因为“开发通常需要”而全文读取，never 被 resolver 拒绝后立即停止且不得由本 Skill 使用 `--allow-never` 绕过。启用任务胶囊时，把 `实现上下文.jsonl` 作为 `--capsule` 输入交给 resolver，而不是自行遍历胶囊或项目文档。

    **目标状态写入协议**：Phase / Task / checkpoint / nextStep 变化时使用 `update-target-task-state.mjs` 做 revision-aware 更新；文档写回后运行 `build-target-doc-index.mjs --write`，并以 `npm run check:docs` 或 `check-target-doc-drift.mjs --quick --strict` 收口，禁止只改 Markdown 后口头声明索引与状态已同步。

    **文档真源**：所有目标项目生命周期文档先通过 `.vibe-docs.json` 解析。新目标项目默认：`docs/需求文档.md`、`docs/需求变更.md`、`docs/设计简报.md`、`docs/项目治理/开发计划.md`、`docs/plans/执行光标.md`、`docs/项目治理/验收记录.md`、`docs/接口契约.md`；根目录 Markdown 仅保留 `AGENTS.md`、`CLAUDE.md`、`文档索引.md`。新生成或写回生命周期文档后运行 `node <skills仓库>/tools/check-target-doc-names.mjs <目标项目根目录> --require-existing`。

    **执行语境优先**：先读需求和计划里的执行语境、术语、测试策略和当前 Phase，再决定实现粒度；`vibe` 模式按单人短反馈推进，但不降低 Plan、验证、review、doc-sync 标准。

    **任务胶囊按需启用**：任务胶囊不替代 `.vibe-docs.json` 和生命周期文档，只作为“单个任务”的上下文容器。目标项目未启用 `taskContext` 时不要提前创建空胶囊；非快车道 T2/T3 开始真实任务时再按需创建或读取当前胶囊。编码前必须检查 `实现上下文.jsonl`：每行是需要读的项目相对路径、读取原因、来源和是否必需；必需项缺失先修正上下文或说明阻塞，不用口头记忆替代。

    **会话记录轻量恢复**：启用 `taskContext.sessionJournal` 后，可用 `会话记录.md` 记录“本轮做了什么、为什么这么做、下步是什么”。它只用于恢复和交接，不升级为需求、计划或验收真源。

    **歧义与影响面**：非低风险歧义先写清假设、备选解释和阻塞点；每次改代码前评估影响范围，不顺手重构，不清理无关文件；每一行改动都应能追溯到用户请求、当前 Task 或验证修复所必需的最小清理。T2/T3 且影响面不明时先用 `rg` 沿 callers/callees 与相关测试缩小范围（有可用的代码图工具时再用）。

    **执行强度与审查强度正交**：开工前先判定 `execution tier`，再独立计算 `review profile`。T0 低风险文字可直接改；T1 微计划 + 定向验证；T2 必须写短工程计划：目标、影响面、RED 测试、GREEN 验证路径、升级 T3 触发条件，并使用 `split-self-review`；高影响 T2 升为 `independent-two-stage`；T3 固定执行 `分类 -> 成功标准 -> 风险/影响面 -> RED -> GREEN -> REFACTOR -> fresh 验证 -> 独立 Spec review -> 独立 quality review -> doc-sync -> finish checklist`。高影响触发、Reviewer 隔离、finding 状态机、最小审查包、Phase ledger 与 Review Receipt 以 `code-review/references/review-profiles.md` 为统一协议。

    **T3+ hazard mode**：命中 auth、permission、security、token、secret、payment、database、migration、data loss、filesystem、shell、network、eval、hook、agent routing、Skill/Hook/Tool 规则、release/deploy/publish、删除/重命名/迁移行为文件，或影响面无法可靠判断时，先写 Hazard Task Packet：目标/非目标、风险类型、影响面、允许/禁止修改文件、RED 证据或用户明确批准的例外、验证命令、rollback、finish checklist。

    **UI 与设计边界**：正式前端页面优先复用目标项目 UI 包、design tokens、组件盘点和复审证据；UI 债务、组件库初始化、补 token、修 `check-ui-reuse` 交给 `ui-system-guardian`。UI 精修、复刻、image-to-code、截图/设计稿还原只做呈现层和必要纯 UI 状态；没有明确功能开发指令，不新增真实业务逻辑、接口、持久化、权限、支付、删除或后台任务。

    **接口契约**：新增或修改真实 endpoint、service、public entry、server action、fetch wrapper、IPC/event 通道或 schema 前，必须先读 `.vibe-docs.json.interfaceContracts` 指向的 `接口契约.md`。同一业务能力默认只保留一个统一契约入口；新增入口先更新契约，再实现并运行 `check-api-contracts` 或目标项目等价脚本。

    **严格 TDD 铁律**：除下述受控 T1 外，所有新功能、bug 修复、重构和行为变更强制 `RED-GREEN-REFACTOR`。没有先运行一个失败且失败原因正确的测试，不得写生产代码；如果生产代码已经先写，删除该实现并从 RED 重新开始，不保留作参考。
    - `RED`：围绕 public seam、统一接口契约或用户可观察行为写一个最小测试，运行并确认它因目标行为缺失而失败；测试通过、测试自身报错或失败原因不符时先修测试
    - `GREEN`：只写让当前失败测试通过的最小生产代码，不增加未被测试要求的功能、抽象或顺手重构；随后运行当前测试与相关回归，全部通过才算 GREEN
    - `REFACTOR`：只有全绿后才能消除重复、改善命名或提取 helper；不得新增行为，每次整理后重新保持全绿
    - 原型、生成代码、配置文件仅在写生产代码前获得用户明确批准时可以例外；无法自动化本身不构成例外资格，必须继续建立测试 seam 或停止生产代码修改
    - visual-only T1 受控例外：仅限同一组件 / 容器内、不改变用户路径、信息层级、响应式结构、全局 token / theme、UI 包契约或真实业务行为的呈现微调。没有既有测试 / visual regression seam 时，先留可复现的改前基线，再取得改后同路径定向视觉证据与副作用检查；不为本次微调新建测试框架。已有 seam 仍执行 `RED-GREEN-REFACTOR`，任一边界被触发就退出例外并重新分级
    - 严格 TDD 分支必须包含本轮 RED、GREEN 与回归证据；受控 T1 分支必须包含边界核对、既有 seam 结论、改前基线、改后同路径证据和副作用检查；编译、启动、smoke、接口契约门禁和人工验收只是补充证据

    **规格闭环门**：T2/T3 在首个 RED 前必须读取既有开发计划或对应 Phase 明细中的预实现一致性分析；只有 sourceRevision 仍匹配、分析结论为 `PASS` 才能写生产代码。新项目，或本轮影响跨两个以上模块边界、数据、接口、权限、部署、技术栈或架构时，还必须有 `architecture-foundation` 的地基 PASS 且基线未过期。任一 `BLOCKED`、缺失或已过期时先回到对应 Skill 更新，T0/T1 快车道及单模块普通功能不执行本门。
    - 实现、fresh 验证、Spec Compliance 与 Code Quality review 后执行交付收敛检查：用已实现代码和验证证据反查需求、计划与 Phase/Task。
    - 发现未计划或未实现缺口时，回写既有计划/Phase Task，重新进入 `RED-GREEN-REFACTOR`；任务胶囊、finding ledger 和 Review Receipt只留回执与证据，不另造真源。
    - 只有收敛检查确认无未计划或未实现缺口，才可标记完成。

    **实现者报告不等于完成**：无论由主 Agent 还是 implementer 实现，`DONE` / `DONE_WITH_CONCERNS` 只是输入。主 Agent必须检查有界 diff、实际运行的验证证据、已知限制和 finding ledger，再按 review profile 决定是否完成；子 Agent不得自行派发 Reviewer 或刷新 review clean。

    **finding 闭环**：T2 及以上由主 Agent维护 finding ledger。Critical / Important 修复后必须交回对应审查方向 reverify，或由用户明确 accepted-risk；Minor 必须修复、accepted-risk、deferred 或 rejected-with-reason。相同类型 finding 连续两轮仍未消除时停止机械循环，诊断需求、计划、架构或验证设计根因。

    **人工验收**：自动化不等于用户真实验收。页面、交互、CLI 人机流程、权限确认、端到端链路、发布安装等需要用户观察/操作的内容，交付前标记人工验收状态：`不适用 / 待用户验收 / 用户已确认 / 需回归复验`。没有用户明确确认，不得写成 `用户已确认`。

    **脚手架策略**：只有 `scaffold policy = template` 且平台匹配 Web / Desktop / Node CLI 时使用现有 JS/TS 模板；Backend、Library、Mobile、非 Node CLI 默认沿用平台生态或既有结构。模板入口从 skills root 执行：Windows PowerShell 先用 `$bash = (Get-Command bash).Source` 并确认它是真实 Git Bash，不是 WSL 占位程序，再运行 `& $bash "<skills-root>/tools/render-project-scaffold.sh" --template <template> --project-name "<name>" --output "<dir>"`；POSIX shell 使用 `bash "<skills-root>/tools/render-project-scaffold.sh" --template <template> --project-name "<name>" --output "<dir>"`。

    **源码纪律**：人工维护生产文件超过 300 行、React 组件超过 180 行、函数与 class method 超过 100 行时由 staged 结构门禁硬拦；历史超标只减不增，测试文件 300 行开始提醒、超过 800 行进入同一棘轮，生成文件与第三方资源排除。优先既有项目风格和 SDK/框架能力，不提前抽象，不为未来假设加配置层；单次使用的扩展点、策略层、provider 或配置项默认视为过早抽象，除非它复用既有架构或直接降低当前复杂度。涉及外部库/API 时查当前官方资料。source change gate 以 behavior path 或 protected source doc 为对象；T2/T3 必须有匹配当前改动的验证、review/doc-sync 证据。

[按需加载 references]
    本 Skill 的 `SKILL.md` 只保留必读主流程。不要默认读取全部 references；只有命中下表场景时，再读取对应文件。

    | Reference | 读取时机 |
    | --- | --- |
    | `references/output-style.md` | 汇报口径、最终回复格式、用户可见进度表达。 |
    | `references/file-structure.md` | 需要查看 dev-builder 自身目录结构或脚手架模板位置。 |
    | `references/development-rules.md` | 开始编码、修改源码、配置门禁、结构规范、Git 工作流或进程管理前。 |
    | `references/development-strategy.md` | Plan Mode、任务清单、中断恢复、设计稿参照、联网搜索、技术栈选择。 |
    | `references/ui-token-component-reuse.md` | 正式前端页面、UI 包、组件库、design token、theme、Tailwind config 或页面层视觉样式改动前。 |
    | `references/anti-rationalization.md` | 判断是否能跳过计划、验证、review、doc-sync 或完成证据时。 |
    | `references/phase-completion.md` | Task/Phase 收口、四步走验证、人工验收提醒和用户确认前。 |
    | `references/workflow-initialization.md` | 无代码新项目初始化、脚手架渲染、首次 commit/push 前。 |
    | `references/workflow-continuous-development.md` | 已有项目继续开发、恢复 doing/blocked 任务、逐 Task 实现时。 |

[核心流程摘要]
    1. 执行依赖检测，解析 `.vibe-docs.json`，读取需求、计划、执行光标、验收记录、必要契约和已启用的任务胶囊。
    2. 判定 execution tier、成功标准、影响面、验证方式和升级触发条件；非快车道 T2/T3 按需创建或读取当前任务胶囊。
    3. 按 reference 表读取当前任务需要的细节；编码前读取 `实现上下文.jsonl`，不要为了保险全量加载。
    4. 写源码前更新执行光标为 `doing`；每个 checkpoint 回写恢复信息，启用会话记录时追加简短 session 摘要。
    5. T2/T3 先取得预实现一致性分析 PASS，再按当前 Task 已落盘的测试与验证策略最小实现并取得 fresh evidence；随后按 review profile 完成双阶段审查、交付收敛检查、finding 闭环、必要 doc-sync 和 finish checklist。
    6. 如需用户真实点击/观察，交付时提醒人工验收；用户确认后写入 `验收记录.md`。

[初始化]
    1. 执行 [依赖检测]。
    2. 只读取本 `SKILL.md` 的必读内容，先完成任务分类、成功标准和验证路径。
    3. 按 [按需加载 references] 表命中场景后，再读取对应 reference。
    4. 如果写回目标项目文档，继续遵守四字中文文档名、`.vibe-docs.json`、接口契约和人工验收规则。
