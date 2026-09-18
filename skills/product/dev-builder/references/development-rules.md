# 开发规则清单

> 来源：dev-builder/SKILL.md 的 [开发规则清单]。
> 读取时机：开始编码、修改源码、配置门禁、结构规范、Git 工作流或进程管理前。

## 目录

- 代码规范
- 测试与验证规则
- 最小自动门禁
- 结构门禁第一版
- 项目结构规范
- 代码结构与设计原则
- 数据库结构规范
- 环境变量与安全
- 扩展性与可维护性
- 质量门槛
- 修改纪律
- Git 工作流
- 进程管理

[开发规则清单]
    编码过程中必须遵守的所有规则，按类别组织。

    [代码规范]
        - 非低风险歧义先写清假设、备选解释和阻塞点，不静默脑补后直接编码
        - 人工维护生产文件以 300 行为提交门禁；历史超标只减不增。测试文件 300 行开始提醒、超过 800 行进入同一棘轮
        - TypeScript 项目使用 strict mode，不用 any（用 unknown + 类型守卫）
        - 命名：组件 PascalCase，函数/变量 camelCase，文件 kebab-case，常量 UPPER_SNAKE_CASE
        - 业务对象、页面名、状态名和公开文案默认跟随目标项目需求文档 / 开发计划已落盘的统一口径，不临时起新名
        - 每个文件单一职责，有明确的对外接口
        - 函数优先用纯函数，副作用隔离到专门的层（hooks、API route）
        - React 项目优先 function components + Hooks，不用 class
        - 已使用 Tailwind 的项目优先复用现有 utility / token；不用 Tailwind 的项目沿用既有样式体系
        - 不做无关重构——改哪里只动哪里，不"顺手"改别的
        - 遵循已有代码库的风格——不强推自己的偏好
        - YAGNI：不为假想的未来需求写代码
        - 新 Web / Desktop 项目里，业务代码默认放进 `src/features/*`；顶层 `components / hooks / lib` 不是默认业务收口点

    [测试与验证规则]
        - 开始当前 Task 前必须读取目标项目需求文档 / 开发计划的“测试与验证策略”
        - 涉及真实 endpoint、service、public entry、server action、fetch wrapper、IPC / event 通道或 schema 时，开始当前 Task 前必须读取 `.vibe-docs.json.interfaceContracts` 映射的 `接口契约.md`
        - 开始当前 Task 前必须判定 `execution tier`，并记录为什么是 T0 / T1 / T2 / T3
        - 开始当前 Task 前必须写清成功标准：这一步做完后用户能看到什么、用什么证据证明
        - 除 visual-only T1 受控例外外，所有新功能、bug 修复、重构和行为变更都强制 `RED-GREEN-REFACTOR`，不因 execution tier 较低而改变顺序
        - T0 纯文字且不改变行为时只需 diff 摘要；无既有 seam 的 visual-only T1 必须先做边界核对，再记录 seam 结论、改前基线、改后同路径定向视觉证据与副作用检查，已有 seam 或越界时必须先 RED；T2/T3 计划必须明确 RED 测试、GREEN 最小实现边界和 REFACTOR 范围
        - T2 必须写短工程计划：目标、影响面、RED/GREEN 验证路径、升级到 T3 的触发条件
        - T3 必须执行 strict execution loop，不允许跳过风险分析、回归计划、code-review、doc-sync 或 finish checklist
        - T3+ 必须先写 Hazard Task Packet；缺少风险类型、允许 / 禁止修改文件、复现或 RED 证据、rollback 方案时不得开工
        - RED 必须先实际运行并因目标行为缺失而正确失败；测试通过、报错或失败原因不符时不得写生产代码
        - GREEN 只能写让当前测试通过的最小实现；当前测试与相关回归全绿后才能 REFACTOR，且整理不得新增行为
        - 仅原型、生成代码或配置文件可在写生产代码前请求用户明确批准；记录替代验证、风险和恢复方案。无法自动化本身不构成例外资格；visual-only T1 受控例外必须满足 Skill 主规则的全部边界
        - 完成声明必须附本轮 RED 正确失败和 GREEN 通过的 fresh 证据；没有当场命令和结果，就不算完成
        - T2/T3 完成前必须跑 finish checklist；普通 T2 确认短计划、定向验证与 split-self-review，高影响 T2/T3 确认 independent-two-stage；T3 还必须确认必要 doc-sync，T3+ 额外确认 hazard review
        - finish checklist 必须确认人工验收状态；如状态不是 `不适用`，交付时列出用户验收路径、人工重点、自动化覆盖和回归触发条件
        - finish checklist 必须确认接口契约状态；如本轮新增或修改真实接口，交付时列出更新的 `能力ID`、契约入口和 `check-api-contracts` 验证证据

    [最小自动门禁]
        以下检查在 commit 前自动执行，失败则直接阻止提交：
        - T2/T3 staged source changes 对应的 `.claude/.needs-review` 必须是 `clean`，且 review 快照必须和当前 staged source changes 一致
        - 最小自动门禁由当前 platform profile、language adapter 和项目已有脚本决定；优先运行已有 build / typecheck / lint / test 入口
        - TypeScript 项目才检查本地 `tsc --noEmit`、显式 `any`、`@ts-ignore` 与 `@ts-nocheck`；没有 `tsconfig.json` 或本地 CLI 时不得临时下载，标记未验证
        - 非 TypeScript 项目按 `docs/language-platform-profiles.md` 的验证选择矩阵执行，不把 TypeScript 规则当成通用编译门禁
        - 人工维护生产文件超过 300 行时阻断；历史超标文件只减不增，测试文件 300 行开始提醒、超过 800 行时阻断，生成文件与第三方资源排除
        - 目标项目存在 `tools/check-api-contracts.mjs` 且本轮涉及 API route、fetch、service/public entry、server action、IPC / event、schema 时，接口契约门禁必须通过

        说明：
        - 这是给新手的最低兜底，不是完整质量标准
        - 双阶段审查完成后运行仓库现有的 review-clean 入口刷新快照；若仓库只提供 `tools/mark-review-clean.sh`，Windows PowerShell 先用 `Get-Command bash` 核对 Git Bash，再显式调用。`clean` 早于最新文件改动或快照对不上 staged source changes时仍视为过期
        - protected source doc 不能用自身覆盖自身；例如只改 `AGENTS.md` 不算已完成 doc-sync，必须同步另一份相关入口 / 真源 / INDEX 文档
        - 这层只管最基础的红线；结构问题由下面的“结构门禁第一版”和 Plan + Review 分工继续处理

    [结构门禁第一版]
        这是 repo-level `pre-commit` 里的单独一层，当前顺序固定是 `review gate → 最小质量 gate → 结构门禁 → terminology gate → doc sync gate`；它只负责 commit 前第一版最稳、最容易统一判断的结构红线；它不是完整架构审查，不替代 Plan、Review 或前后两层 gate。

        默认硬拦 7 类问题：
        - 人工维护生产文件超过 `300` 行，历史超标只减不增；测试文件超过 `800` 行进入同一棘轮
        - 单个函数超过 `100` 行
        - React 组件超过 `180` 行
        - 单个函数参数超过 `4` 个
        - 单个函数复杂度超过 `10`
        - 单个函数控制流嵌套超过 `4` 层
        - 引用关系违规：项目内出现循环依赖，或发现跨层乱引用
        - UI / token / 组件复用违规：页面层裸色值、Tailwind 任意视觉值、临时圆角 / 阴影、原生控件，或非 UI root 基础组件声明

        默认提醒但不硬拦：
        - staged 的 JS / TS 代码文件超过 `8` 个时，提醒“这次改动面偏大”
        - staged 改动跨超过 `3` 个顶层功能目录时，提醒“这次改动可能过散”

        边界和范围：
        - 阈值边界统一按“大于才拦”处理：等于 `300` / `800` / `100` / `180` 行、`4` 个参数、`10` 复杂度、`4` 层嵌套时默认放行；只有超过才拦
        - 历史超标按 Git HEAD 基线执行“只减不增”；缩小或保持不增长可继续拆分，新文件超标或既有项继续增长时失败
        - 自动生成目录、vendor、字体资源和 minified 产物不参与人工源码门禁
        - 没有可扫描的受支持源码，或当前 staged 没有受支持源码时直接跳过；Shell / Bash / Zsh / PowerShell 仍属于扫描范围
        - UI 复用检查默认通过 `tools/check-ui-reuse.mjs` 扫描 staged 前端文件；目标项目 build 可用 `node tools/check-ui-reuse.mjs . --all` 做全量检查
        - 函数门禁覆盖普通函数、箭头函数与 class method；动态 import 和运行时生成代码不作为静态函数边界

        继续交给 Plan + Review 的事：
        - 一个函数虽然没超阈值，但职责已经混了
        - 这次改动虽然没超提醒阈值，但方向明显发散
        - 抽象层次是否合适、边界是否切对、是不是为了“看起来整洁”而过度拆分

    [项目结构规范]
        项目代码放在以项目名命名的子文件夹里，不平铺在根目录。根目录只放规划文档、设计资源和 Agent 运行时目录（如 .claude/、.agents/、.codex/）。

        ```
        project/
        ├── .vibe-docs.json         # 目标项目文档角色映射
        ├── 文档索引.md             # 根目录导航投影
        ├── docs/
        │   ├── 需求文档.md
        │   ├── 需求变更.md
        │   ├── 设计简报.md
        │   ├── 接口契约.md         # 业务能力接口契约台账
        │   ├── 项目治理/
        │   │   ├── 开发计划.md
        │   │   └── 验收记录.md
        │   └── plans/              # 可选：复杂项目的补充计划文档，不替代开发计划
        │       ├── 执行光标.md     # 唯一当前执行光标投影
        │       ├── 第一阶段.md     # Phase 详细任务状态；文件名必须正好 4 个汉字
        │       └── archive/        # 已归档的历史计划明细
        ├── <project-name>/         # 项目代码文件夹
        │   ├── src/
        │   ├── package.json
        │   └── ...
        ├── .claude/                # 共享运行时状态（review / feedback）
        ├── .agents/                # Codex skill 发现目录
        └── .codex/                 # Codex hook 配置（如启用）
        ```

        项目文件夹内部结构，根据技术栈约定组织：

        **Next.js 全栈项目**：
        ```
        src/
        ├── app/              → 页面路由壳，只做路由和页面装配
        ├── app/api/          → API 路由
        ├── features/
        │   └── <feature-name>/
        │       ├── components/ → 该功能自己的 UI
        │       ├── hooks/      → 该功能自己的状态与交互
        │       ├── lib/        → 该功能自己的业务逻辑
        │       ├── types.ts    → 该功能自己的类型
        │       └── index.ts    → 该功能的公共入口
        ├── shared/
        │   ├── ui/             → 真正被多个 feature 复用的 UI
        │   ├── providers/      → 全局 provider
        │   └── utils/          → 真正共享的轻量工具
        ├── core/
        │   ├── api/            → API client / server adapter
        │   ├── config/         → 配置
        │   └── db/             → 数据库与基础设施
        └── styles/             → 全局样式（如有）
        ```

        **React + Vite 项目**：
        ```
        src/
        ├── pages/            → 页面路由壳（如有路由）
        ├── features/
        │   └── <feature-name>/
        │       ├── components/
        │       ├── hooks/
        │       ├── lib/
        │       ├── types.ts
        │       └── index.ts
        ├── shared/
        │   ├── ui/
        │   ├── providers/
        │   └── utils/
        ├── core/
        │   ├── api/
        │   └── config/
        └── styles/           → 全局样式
        ```

        **Node CLI 工具项目**：
        ```
        src/
        ├── commands/         → 各子命令实现
        ├── lib/              → 工具函数、核心逻辑
        ├── utils/            → 底层共用能力
        └── index.ts          → 入口（Commander.js 解析）
        ```

        **CLI Agent 产品**（复杂度较高的 Agent 类 CLI，参考成熟 Coding Agent 架构）：
        ```
        src/
        ├── entrypoints/      → 入口层（CLI 解析、命令路由）
        ├── commands/         → slash command 实现
        ├── tools/            → 工具定义与执行逻辑
        ├── services/         → 运行时服务（MCP、analytics、LLM 调用）
        ├── coordinator/      → 多 Agent 协调器
        ├── hooks/            → Hook 系统（事件驱动的自动化）
        ├── plugins/          → 插件生态
        ├── tasks/            → 异步任务管理
        ├── constants/        → prompt 模板、系统常量、输出规范
        ├── bootstrap/        → 状态初始化
        ├── utils/            → 底层共用能力
        └── types/            → TypeScript 类型定义
        ```
        注意：此结构适用于大型 Agent 产品（如 Coding Agent、AI 助手），小型 CLI 工具不需要这么多层。根据实际规模取用。

        **Desktop（Electron）项目**：
        ```
        electron/
        ├── main.ts           → Electron 主进程
        └── preload.ts        → 预加载脚本
        src/                  → 同 Next.js 全栈项目结构，默认 `feature-first`
        ```

        **通用原则**：
        - 一起变的文件放一起（按功能聚合，不按技术分层）
        - Web / Desktop 新项目默认 `feature-first`；要改聊天，就主要看 `features/chat`
        - 新 Web / Desktop / Node CLI 项目初始化时，只有 `scaffold policy = template` 才渲染现有 JS / TS 脚手架模板
        - Backend、Library、Mobile、非 Node CLI 沿用平台默认结构或既有项目结构，不创建 Web UI 包或 `src/shared/ui`
        - 已有项目跟随现有风格，但新增功能优先局部 feature 化（`legacy-incremental`）
        - 每个文件有明确的单一职责

    [代码结构与设计原则]
        **模块设计**：
        - 每个模块有明确边界和对外接口
        - 同一业务能力只有一个统一契约入口；新增 endpoint、service、public entry、server action、fetch wrapper、IPC / event 或 schema 前先查 `接口契约.md`
        - 别人不读内部实现也能知道这个模块做什么、怎么用
        - 能换掉内部实现而不影响调用方
        - 可以独立理解和测试
        - 页面层别塞业务：`app/`、`pages/` 只做路由、装配和数据入口
        - `shared/*` 不是垃圾桶；只服务单一 feature 的代码不准放进去
        - `core/*` 只放配置、数据库、API 客户端等基础设施
        - 一个 feature 只能通过另一个 feature 的公共入口访问，不能直接 import 对方内部文件

        **接口契约治理**：
        - `接口契约.md` 是目标项目的业务能力接口台账，默认由 `.vibe-docs.json.interfaceContracts` 指向
        - 契约表固定使用：`能力ID | 统一能力 | 入口类型 | 契约入口 | 调用方 | 状态 | 说明`
        - `入口类型` 只允许 `endpoint / service / publicEntry / schema / event / none`
        - server action 通常登记为 `publicEntry` 或 `service`；fetch wrapper 登记为 `service`；IPC channel / 事件通道登记为 `event`
        - 同一 `能力ID + 入口类型` 只能有一个 `契约入口`
        - 相同 endpoint / service / public entry 不能分配给多个业务能力，除非先合并能力边界或废弃旧契约
        - 目标项目有 `npm run check:api-contracts` 时，接口相关改动后必须运行；没有脚本但有工具时运行 `node tools/check-api-contracts.mjs .`

        **拆分信号**（什么时候该拆）：
        - 文件超过 300 行
        - 一个函数/组件做了 3 件以上不同的事
        - 改一个功能要同时动 5 个以上文件（耦合太紧）

        **不拆信号**（什么时候不该拆）：
        - 代码量小且逻辑内聚
        - 拆了反而要在多个文件间跳来跳去
        - 只是为了"看起来整洁"而拆（过度抽象）

    [数据库结构规范]
        - 表名 snake_case，字段名 snake_case
        - 每张表必须有 id（主键）、created_at、updated_at
        - 用 TEXT 存 JSON 时，在代码注释中注明 JSON 结构
        - 字段有默认值的必须在 schema 中声明 DEFAULT
        - migration 用 ALTER TABLE，执行前检查列/表是否已存在
        - 不在代码里写裸 SQL 字符串拼接（用参数化查询防注入）
        - 索引策略：频繁查询的字段加索引，但不滥加
        - 表之间的关系在 Phase 交付清单中说明

    [环境变量与安全]
        - Vite 的 VITE_ 前缀变量暴露到浏览器——不能放 API Key
        - Next.js 不带 NEXT_PUBLIC_ 前缀的变量只在服务端——安全
        - AI API 调用必须走服务端（Next.js API route 或 Express），不走浏览器
        - .env.example 作为模板提交到 Git，.env.local 放实际值（.gitignore）
        - 不在代码里硬编码任何密钥、路径、个人信息

    [扩展性与可维护性]
        - 配置优于硬编码：可能变化的值抽为常量或配置
        - 接口优于实现：依赖抽象（TypeScript interface），不依赖具体实现
        - 渐进增强：核心功能先跑通，增强功能后加
        - 错误处理分层：组件层 catch 显示 UI，服务层 catch 记录日志
        - 不为未来过度设计：当前需要什么就做什么

    [质量门槛]
        每个功能实现后必须满足：
        - ✅ 本轮 RED 因目标行为缺失而正确失败，GREEN 与相关回归全部通过
        - ✅ Happy path 正常工作
        - ✅ Error path 有清晰的错误提示
        - ✅ Loading state（异步操作有加载指示）
        - ✅ Empty state（无数据时有引导）
        - ✅ 验收范围以当前 Phase 交付清单为准；已按开发计划延后到后续 Phase 的状态补全与增强（如 Error / Loading / Empty）不在本轮门槛内，延后必须写在对应 Phase 的「不做边界/停止条件」里
        - ✅ 基本输入校验（必填、格式）
        - ✅ 无敏感信息硬编码
        - ✅ 如项目类型为 Web / Desktop，结构校验结果与当前代码组织策略一致

    [修改纪律]
        每次修改代码前必须执行：
        1. 评估影响范围：这个改动会影响哪些现有功能？列出来
        2. 检查副作用：特别是 CSS（overflow-hidden 裁切弹出层、z-index 层叠、flex-shrink 布局）
        3. 先想后改：确认方案不会破坏现有功能，再动手
        4. 回归验证：改完后不仅测新功能，还要验证相关的现有功能

    [Git 工作流]
        原子化提交：
        - 每完成一个独立功能就 commit，不要攒到 Phase 结束
        - 一个 commit 只包含一个逻辑变更（一个功能、一个修复、一个配置改动）
        - Phase 内可以有多次 commit，Phase 完成时不需要额外的汇总 commit

        Repo-level hook：
        - 新项目初始化 Git 后，创建 `.githooks/pre-commit`
        - 立刻执行 `git config core.hooksPath .githooks`
        - pre-commit 至少串起：未完成 review、最小质量问题、结构门禁、文档同步状态
        - 目标是让新手在 commit 时自动被兜底，而不是只靠 Agent 口头提醒

        Commit message 规范：
        - Phase 开发：`phase-N: 功能描述`
        - Bug 修复：`fix: 问题描述`
        - 功能新增：`feat: 功能描述`
        - 重构：`refactor: 描述`
        - 配置/依赖：`chore: 描述`

        Push 策略：
        - 每次 commit 后立刻 push 到远程仓库
        - push 前确认当前分支正确
        - 如远程仓库未设置 → 提醒用户先配置

        提交门槛：
        - 原子化 commit 的最低门槛：通过当前 platform profile、language adapter 和项目已有脚本选出的最小自动门禁
        - Phase 完成的门槛：四步走全部通过
        - 不通过编译不允许 commit

    [进程管理]
        项目存在需要启动或重启的长运行 dev server / service 时：
        - 根据项目技术栈确定 dev server 的进程名和端口号
        - kill 占用该端口的进程，等待 2 秒确保端口释放
        - 确认只有 0 或 1 个 dev server 在运行，防止多实例冲突
