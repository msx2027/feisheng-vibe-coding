---
name: ui-system-guardian
description: '仅当用户先明确调用 `vibe-coding-skills` 总入口并指定 `ui-system-guardian`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发；当用户要初始化组件库、补 token、补基础组件 / variant、治理 UI 债务...'
user-invocable: false
disable-model-invocation: true
---
[DocMap]
    层级：L3 / 关键 Skill
    模块：UI 系统治理
    依赖：
    - `.vibe-docs.json`
    - 目标项目设计令牌文档
    - 目标项目组件盘点文档
    - 目标项目设计复审报告
    - 目标项目 UI 包
    - `tools/check-ui-reuse.mjs`
    输出：
    - UI 系统初始化结果
    - UI 债务审计清单
    - token / 组件 / variant 补齐方案
    - 页面层样式迁移结果
    - UI 复用门禁修复证据

[任务]
    **初始化模式**：目标项目缺少 UI 包、token 入口、组件盘点或 UI 复用门禁时，建立最小可复用 UI 系统，让正式页面可以从第一屏开始复用。

    **审计模式**：目标项目 UI 已经散乱、页面层出现裸色值、重复基础组件、临时圆角 / 阴影或绕过 UI 包时，扫描并输出可执行的 UI 债务治理清单。

    **扩展模式**：组件、slot、variant 或 token 不够时，先补 UI 包、token 文档和组件盘点，再让页面消费。

    **迁移模式**：把页面层手搓的按钮、输入、弹窗、导航、标签、列表、卡片、状态、颜色、圆角、阴影迁回 UI 包和 design tokens。

    **门禁模式**：安装、修复或解释 `tools/check-ui-reuse.mjs` / `check:ui-reuse`，让目标项目能自动拦截页面层绕过 UI 系统的问题。

[依赖检测]
    Skill 启动时第一步自动执行。

    必需：
    - 目标项目根目录 → 用于识别工程类型、页面层、UI root 和门禁脚本
    - 前端源码或明确的 UI 治理对象 → 没有前端源码时，只输出初始化建议或说明不适用

    可选：
    - `.vibe-docs.json` → 优先解析 `designLanguageTokens`、`componentInventory`、`designReviewReport`、`uiGovernanceReport`
    - 目标项目设计令牌文档 → 默认 `设计令牌.md`
    - 目标项目组件盘点文档 → 默认 `组件盘点.md`
    - 目标项目设计复审报告 → 默认 `复审报告.md`
    - 目标项目 UI 治理报告 → 默认 `界面治理.md`
    - 目标项目 UI root → 常见为 `packages/ui`、`packages/design-system`、`src/shared/ui`、`src/ui`、`src/components/ui`、`libs/ui`、`libs/components`
    - `tools/check-ui-reuse.mjs` 或 `npm run check:ui-reuse` → 有则作为 hard gate 验证
    - 设计简报 / 设计稿 / 视觉参考 → 有则辅助 token 和组件语义命名

    安装策略：
    - 缺少 UI root 且本轮需要正式前端页面治理时，先执行 UI root 决策协议；只有证明没有可复用 UI root 后，才在目标 app 内创建最小 `src/shared/ui`
    - 缺少 token 或组件文档时，先补目标项目四字中文文档和 `.vibe-docs.json` 映射
    - 缺少 `check-ui-reuse` 时，优先复用本分发包 `tools/check-ui-reuse.mjs`，不另造第二套门禁
    - 缺少设计源时，不阻塞技术治理，但必须标记为“无设计源降级模式”

[本包治理继承]
    执行本 Skill 时必须继承本包主控纪律：
    - 先判定 `execution tier`；命中 UI 包、token、theme、Tailwind config、门禁脚本、Skill / Hook / Tool / Agent 路由变更时，按 T2/T3/T3+ 执行
    - 目标项目生命周期文档先读 `.vibe-docs.json`，再按角色映射读写四字中文 `.md`；新生成文档必须符合 `^[\u4e00-\u9fff]{4}\.md$`
    - 需要用户真实点击、操作或观察才能确认 UI 体验时，输出人工验收状态；只有用户明确确认后才能记录为 `用户已确认`
    - 正式前端页面先识别 UI 包、design tokens、组件盘点、设计复审报告和设计系统复用门禁；页面层优先复用 UI / token / 组件
    - references 采用 progressive references：先读 `SKILL.md`，只在下方 [按需加载 references] 表命中时读取对应 reference
    - 涉及 `.pen` 或 Pencil 时，必须使用 Pencil desktop 客户端和 desktop MCP server；不得 fallback 到 VS Code

[第一性原则]
    **系统优先**：先补 UI 包、token 和组件盘点，再改页面；页面只负责业务布局、数据绑定和组件组合。

    **治理优先于美化**：本 Skill 不负责“把页面做漂亮”本身，而是把可复用的视觉基础能力收进系统。

    **最小可用系统**：缺组件库时先建最小可运行 UI root，不一次性设计巨型 design system。

    **复用现有入口**：monorepo、多 app、多 UI root 或非标准组件库场景下，先复用已有 UI / design-system / components 包；未证明不存在前，不新建第二套 `src/shared/ui`。

    **证据闭环**：治理完成必须有 `check-ui-reuse`、构建、组件预览、截图或代码引用等 fresh 证据；无法自动化时说明人工验收路径。

    **文档即状态**：token、组件、variant、豁免原因和 UI 债务状态必须落到目标项目文档，不能只留在聊天里。

    **联网优先**：涉及外部 UI 库、框架、Tailwind、Radix、shadcn/ui 或构建命令变化时，先 WebSearch 确认当前用法。

[文件结构]
    ```
    ui-system-guardian/
    ├── SKILL.md
    └── references/
        ├── workflow.md
        └── audit-rules.md
    ```

[按需加载 references]
    不默认全量读取 references；只在当前任务命中下表场景时读取对应文件。

    | 场景 | 读取 |
    | --- | --- |
    | 初始化 UI 包、补 token、扩展组件、迁移页面样式、修复门禁 | `references/workflow.md` |
    | 审计 UI 债务、解释 `check-ui-reuse` 失败、判断违规类型和优先级 | `references/audit-rules.md` |
    | `check-ui-reuse` 失败且需要定位并修复 | `references/workflow.md` + `references/audit-rules.md` |

[输出风格]
    **语态**：
    - 默认中文，技术名词保留英文
    - 像 UI 系统治理员，不像视觉灵感推荐
    - 先说系统现状，再说治理动作和验证证据

    **原则**：
    - x 不把“页面里改个 class”包装成 UI 系统治理完成
    - x 不用“以后再统一”代替本轮应补的 token 或组件
    - v 明确区分 UI root、页面层、token 文档、组件盘点和门禁
    - v 组件或 token 缺失时，先补系统，再消费
    - v 确需例外时，要求 allow 注释和原因可追溯

    **典型表达**：
    - "这不是页面样式问题，是 UI 系统缺口；先补 Button variant，再改页面引用。"
    - "当前页面层有裸色值和本地 Card，先迁回 `src/shared/ui`，再跑 `check:ui-reuse`。"
    - "这项需要人工看视觉是否符合预期；自动化只覆盖了复用门禁。"

[治理维度清单]
    **必须判断**：
    - 是否存在 UI root，以及页面是否从 UI root 消费基础组件
    - 是否存在 workspace / apps / packages / libs、非标准 UI 包、package exports 或路径别名，避免误建第二套 UI root
    - 是否存在 design tokens、token 文档、组件盘点和设计复审报告
    - 页面层是否出现裸色值、Tailwind 任意视觉值、临时圆角 / 阴影、原生控件或本地基础组件
    - 组件、slot、variant 或 token 不够时，是否回到 UI 包扩展
    - 目标项目是否有 `check-ui-reuse`，以及本轮是否运行 fresh 验证

    **推荐判断**：
    - 基础组件命名、variant、尺寸、状态是否和业务语义匹配
    - token 是否语义化，是否避免把页面一次性颜色写成长期主题变量
    - 页面层是否只保留业务布局、数据绑定和组合逻辑
    - UI 包 README、预览、截图或组件级证据是否足以支撑复审

    **按需判断**：
    - 是否需要引入或对齐 shadcn/ui、Radix、Tailwind 或现有组件库
    - 是否需要把旧页面分批治理，避免一次迁移影响太大
    - 是否存在必须保留的原生控件或第三方组件例外

[治理策略]
    **先盘点再下手**：
    - 先识别工程结构、页面层、UI root、token 文件和门禁脚本
    - 再决定当前是 init、audit、extend、migrate 还是 gate

    **UI root 决策协议**：
    - 先枚举 `package.json` workspaces、`pnpm-workspace.yaml`、Turbo / Nx 配置、`apps/`、`packages/`、`libs/` 和目标 app 入口
    - 查找已有 `ui`、`design-system`、`components`、`shared/ui` 包及其 `package.json` exports、`tsconfig` paths、Vite / Next alias
    - 单一明确 UI root → 优先复用并补 token / component inventory
    - 多候选、非标准 root 或已有业务大量引用 → 先说明候选和取舍，必要时询问用户；未证明不可复用前不得创建 `src/shared/ui`
    - 确认无可复用 UI root 后，才在目标 app 内创建最小 UI root，并记录判断证据到 `界面治理.md`

    **先系统后页面**：
    - 缺 token → 先补 token 和 `设计令牌.md`
    - 缺组件 / variant → 先补 UI 包和 `组件盘点.md`
    - 缺复审证据 → 先补 `复审报告.md` 或 `界面治理.md`
    - 缺 UI root → 先执行 UI root 决策协议
    - 缺门禁 → 先接入 `check-ui-reuse`

    **债务分级治理**：
    - P0：门禁失效、页面层大面积绕过 UI 包、基础组件重复实现
    - P1：裸色值、任意视觉值、临时圆角 / 阴影、原生控件缺 allow
    - P2：token 命名混乱、组件盘点缺失、预览证据不足
    - P3：可读性、命名、README 和示例补充

    **豁免可追溯**：
    - 例外必须有 `vibe-ui-allow-next-line: <reason>`、`vibe-ui-allow-file: <reason>` 或目标项目等价机制
    - reason 不能为空，且必须说明为什么不能回到 UI 包或 token

    **删除安全协议**：
    - 迁移后如要删除本地基础组件或重复样式，必须先列出候选文件、引用扫描命令、构建 / 类型检查或等价验证、rollback 方案
    - 无法证明 unused 或无法提供 rollback 时，不删除；只标记 deprecated，并把后续清理写入 `界面治理.md`

[多模式工作流程]
    [工作流程（init）]
        执行 `references/workflow.md` 的初始化流程：识别工程栈，创建或补齐最小 UI root、tokens、基础组件、导出入口、文档映射和门禁脚本。

    [工作流程（audit）]
        执行 `references/audit-rules.md`：扫描页面层和 UI root，按 P0-P3 输出债务清单、证据和建议修复顺序。

    [工作流程（extend）]
        执行 `references/workflow.md` 的扩展流程：把缺失 token、组件、slot 或 variant 补进 UI 包和文档，再更新页面引用。

    [工作流程（migrate）]
        执行 `references/workflow.md` 的迁移流程：把页面层本地基础组件和视觉基础值迁回 UI 包，并保留最小行为 diff；删除旧文件前必须执行删除安全协议。

    [工作流程（gate）]
        执行 `references/workflow.md` 的门禁流程：安装、修复、解释或运行 `check-ui-reuse`，并记录验证证据。

[信息充足度判断]
    必须满足：
    - 已识别目标项目根目录、页面层和 UI root 状态
    - 已判断当前模式是 init、audit、extend、migrate 或 gate
    - 已明确本轮是否需要写目标项目文档或 `.vibe-docs.json`
    - 已明确验证方式：`check-ui-reuse`、build、测试、截图、组件预览或人工验收路径

    尽量满足：
    - 给出债务优先级和最小迁移顺序
    - 说明哪些例外可以保留，哪些必须回到 UI 包
    - 对已有人工验收范围做影响分析

[初始化]
    1. 执行 [依赖检测]。
    2. 判定 `execution tier` 和当前治理模式。
    3. 按 [按需加载 references] 表读取一个或多个当前必要 reference。
    4. 输出或执行对应治理动作，并用 fresh 证据收口。
