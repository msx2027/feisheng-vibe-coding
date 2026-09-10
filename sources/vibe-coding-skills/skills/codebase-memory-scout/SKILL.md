---
name: codebase-memory-scout
description: '仅当用户先明确调用 `vibe-coding-skills` 总入口并指定 `codebase-memory-scout`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发；当需要用 codebase-memory-mcp 做代码图侦察、影响面分析...'
user-invocable: false
disable-model-invocation: true
---
[任务]
    在 dev-builder、bug-fixer、code-review、test-automation 或 dev-planner 执行前，选择性使用 codebase-memory-mcp 做代码图侦察。
    本 Skill 只负责缩小代码阅读范围、标出影响面和相关测试，不替代主 Skill、源码真源或验证证据，也不负责最终实现、修复、审查结论或验收判断。

[依赖检测]
    Skill 启动时第一步自动执行。

    必需：
    - 目标项目代码已存在；无代码时不启用代码图侦察，交还原主 Skill。

    可选：
    - codebase-memory-mcp MCP 工具 → 有则优先使用图索引、符号搜索和调用链。
    - `rg` → MCP 不可用、结果明显偏离或需要回读中文原文时使用。
    - `.vibe-docs.json`、目标项目需求、开发计划、执行光标、人工验收记录 → 只作为原文真源读取，不把 MCP 输出当真源。

    安装策略：
    - 本 Skill 不安装 MCP、不修改全局 MCP 配置、不修改目标项目依赖。
    - 不要求用户手动执行 `codebase-memory-mcp config set auto_index true`；是否索引、是否重建由本 Skill 在启用时自动判断。
    - MCP 不存在、未索引、启动失败或查询质量不足时，标记“降级侦察”，使用 `rg` 和 UTF-8 原文读取继续，不阻塞主任务。
    - 项目未索引时，只有在用户明确要求，或任务为 T2/T3 且跨模块、调用链不清、入口不明、影响面不明时才索引；普通 T2、已知单文件 bug / review / 补测试不为了索引而增加成本。

[本包治理继承]
    创建或执行本 Skill 时必须继承本包主控纪律：
    - 先判定 `execution tier`；命中 Skill / Hook / Tool / Agent、发布、权限、安全、数据、文件系统、shell、network 等风险时按 T3+ hazard mode 执行
    - 目标项目生命周期文档先读 `.vibe-docs.json`，再按角色映射读写四字中文 `.md`；新生成文档必须符合 `^[\u4e00-\u9fff]{4}\.md$`
    - 需要用户真实点击、操作或观察时，输出人工验收状态；只有用户明确确认后才能记录为 `用户已确认`
    - 正式前端页面先识别 UI 包、design tokens、组件盘点、设计复审报告和设计系统复用门禁；页面层优先复用 UI / token / 组件
    - references 采用 progressive references：先读 `SKILL.md`，只在下方 [按需加载 references] 表命中时读取对应 reference
    - 涉及 `.pen` 或 Pencil 时，必须使用 Pencil desktop 客户端和 desktop MCP server；不得 fallback 到 VS Code

[第一性原则]
    **辅助层不抢主流程**：先由 beginner-flow-guide 或 vibe-coding-skills 判断主任务；本 Skill 只在合适场景做前置侦察，结束后交回 dev-builder、bug-fixer、code-review、test-automation 或 dev-planner。
    **选择性自动**：用户明确点名 codebase-memory、代码地图、调用链或影响面时启用；否则只在 T2/T3 且跨模块、调用链不清、入口不明或影响面不明时启用。T0/T1 小改、已知单文件改动、普通 T2、中文治理文档和 Pencil `.pen` 操作不自动启用。
    **用户零命令**：用户只需要说目标，不需要手动开 auto_index、不需要手动索引；本 Skill 自己做索引保鲜判断，必要时自动重建，风险太大或失败时自动降级。
    **原文真源**：AGENTS、CLAUDE、`.vibe-docs.json`、执行光标、人工验收、中文 docs 和项目规则必须回读 UTF-8 原文；MCP 只能提供路径和线索。
    **结果要可证伪**：输出必须说明查询了什么、命中了什么、哪些结论需要继续读源码或跑测试确认。
    **降级不阻塞**：MCP 不可用或质量不足时，直接降级到 `rg` / 文件读取，不让工具缺失卡住主任务。
    **联网优先**：涉及 codebase-memory-mcp 外部命令、版本、参数或安装方式时，先查官方资料，不凭记忆改配置。

[文件结构]
    ```
    codebase-memory-scout/
    |-- SKILL.md
    `-- references/
        `-- workflow.md
    ```

[按需加载 references]
    不默认全量读取 references；只在当前任务命中下表场景时读取对应文件。

    | 场景 | 读取 |
    | --- | --- |
    | 实际执行 MCP 侦察、判断是否索引、选择查询工具、输出影响面报告 | `references/workflow.md` |

[输出风格]
    **语态**：
    - 中文，短句，先结论后证据。
    - 不夸大 token 节省；同时说明质量限制。

    **固定输出字段**：
    - 索引状态：已索引 / 已重建 / 未索引降级 / MCP 不可用降级。
    - 侦察结论：最可能相关的模块、函数、测试和影响面。
    - 建议读取：具体文件、函数或行号。
    - 必须回读原文：中文规则、执行光标、验收记录或项目真源。
    - 下一步：交给哪个主 Skill 继续；只读现状 / 纯影响面报告则写明“本轮到此结束，等待用户确认是否继续”。

[代码图侦察维度清单]
    必须判断：
    - 当前主任务：开发、修 bug、review、补测试、规划，还是只读现状。
    - 当前 `execution tier`，以及是否符合选择性自动触发条件。
    - 目标项目是否已有代码，是否已经被 codebase-memory-mcp 索引。
    - 本次问题是否跨模块、跨 packages、涉及调用链、权限、数据、测试或 UI 组件复用。
    - 图谱是否新鲜：是否未索引、刚发生结构性大改、存在新增 / 删除 / 重命名源码文件、或查询缺失刚新增的函数。
    - 查询结果是否足够具体到文件 / 函数 / 测试；不足时是否需要 `rg` 补查。
    - 是否命中中文文档真源或人工验收规则；命中则必须回读原文。

    推荐判断：
    - 是否需要 `get_architecture` 获取包结构和热点。
    - 是否需要 `trace_path` 获取 callers / callees。
    - 是否需要 `get_code_snippet` 只读关键函数，避免整文件读取。
    - 是否需要找现有测试、相似测试或测试缺口。
    - 索引是否可能过期：结构性大改、重命名、批量新增文件或用户明确说刚重构。

[代码图侦察策略]
    **主 Skill 优先策略**：用户意图仍由主路由裁决；本 Skill 只提供上下文压缩和影响面。
    **最小查询策略**：先用 1-3 个高信号查询缩小范围，再读源码；不要为了“看起来全面”倾倒大段 MCP JSON。
    **真源回读策略**：中文 Markdown、`.vibe-docs.json`、执行光标、人工验收、Pencil 规则和主控约束一律用 UTF-8 原文确认。
    **自动保鲜策略**：启用 scout 时先检查索引状态和变更信号；未索引、结构性大改、重命名 / 删除 / 批量新增源码文件、用户明确说刚改过相关代码、或查询明显漏掉新符号时，自动重建索引。
    **重建克制策略**：索引不是每轮必跑；普通小改和已知单文件任务不为了“保险”重建，避免 token 与时间反向增加。
    **失败可恢复策略**：MCP 失败不算任务失败；报告降级原因和替代检索路径后继续主任务。

[工作流程]
    [第一步：判断是否启用]
        先识别主任务和 `execution tier`。
        如果是 T0/T1、单文件明确小改、中文治理文档、人工验收记录、执行光标或 Pencil `.pen` 操作，不启用本 Skill。
        如果用户明确点名 codebase-memory / 代码地图 / 调用链 / 影响面，启用本 Skill。
        如果未明确点名，只有 T2/T3 且跨模块、调用链不清、入口不明或影响面不明时启用本 Skill。
        普通 T2、已知单文件 bug / review / 补测试先用 `rg`、命中文件和主 Skill 自身上下文处理。

    [第二步：检查索引状态]
        使用 MCP `list_projects` 查目标项目是否已索引。
        未索引且符合启用条件时，用 `index_repository` 索引目标项目；索引失败则降级。
        已索引时自动做保鲜判断：如果目标项目是 Git 仓库，先查看是否存在新增、删除、重命名、批量源码变更或结构性目录变化；命中则重建索引。
        已索引但用户说明刚发生结构性大改、重命名、刚新增相关代码，或 MCP 查询结果明显漏掉新符号时，重建索引。
        仅有少量已知文件的小改时，不重建索引；优先用 `detect_changes`、`rg` 和目标文件读取补足上下文。

    [第三步：执行最小侦察]
        架构或规划问题先用 `get_architecture`。
        功能、组件、工具脚本或测试入口先用 `search_graph`。
        调用链、权限、数据流或影响面问题用 `trace_path`。
        需要看源码时优先 `get_code_snippet` 读取关键函数。
        普通文本或文档线索用 `search_code`；中文内容不可读或结果不全时立刻用 `rg` / UTF-8 原文回读。

    [第四步：产出侦察报告]
        输出索引状态、命中模块、建议读取文件 / 函数、调用链 / 影响面、相关测试候选、必须回读原文的文档和下一步主 Skill。
        如果当前只是只读现状、纯影响面报告或用户只要求“先看看”，报告后直接结束本轮侦察；不要强行交回 dev-builder、bug-fixer、code-review、test-automation 或 dev-planner。
        不声明“已修复”“已通过”“人工验收通过”；这些必须由主 Skill 和验证流程完成。

    [第五步：交回主流程]
        开发任务交回 `dev-builder`。
        bug 任务交回 `bug-fixer`。
        review 任务交回 `code-review`。
        测试任务交回 `test-automation`。
        计划任务交回 `dev-planner`。
        只读现状或纯影响面报告不交回主 Skill；如用户要求继续，再由 beginner-flow-guide 重新判断主任务。

[初始化]
    执行 [第一步：判断是否启用]。
