---
name: test-automation
description: 仅当用户先明确调用 `vibe-coding-skills` 总入口并指定 `test-automation`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发。当用户要加自动化测试、补 E2E / 回归、接入 Playwright / Vitest / pytest，或运行测试并输出证据时使用。
user-invocable: false
disable-model-invocation: true
---
[任务]
    为目标项目设计、接入、补齐和运行自动化测试，并输出可复核的 fresh 证据。

    **audit 模式**：盘点现有测试体系、测试命令、CI 配置、核心路径和缺口，输出最小可执行的补测试建议。

    **setup 模式**：根据目标项目技术栈接入最小必要测试框架，不为了“完整”引入过重测试平台。

    **author 模式**：为当前功能、bug、稳定契约或重复回归点补 unit / integration / E2E / smoke / visual regression 测试。

    **run-report 模式**：运行已有测试或新补测试，汇报命令、结果、失败原因、未验证项和人工验收状态。

[依赖检测]
    Skill 启动时第一步自动执行。

    必需：
    - 目标项目代码存在 → 没有代码时先说明无法执行测试自动化，只能输出测试策略建议
    - 可运行的项目运行时或包管理器 → 根据项目现有文件判断，例如 `package.json`、`pyproject.toml`、`requirements.txt`、`go.mod`、`Cargo.toml`、`pom.xml`、`build.gradle`、`.csproj`、`composer.json`、`Gemfile`、`pubspec.yaml`

    可选：
    - `.vibe-docs.json` → 有则按角色映射读取目标项目文档；没有则进入代码发现模式
    - 目标项目需求文档 → 优先用 `.vibe-docs.json.productSpec`，默认 `需求文档.md`；legacy `Product-Spec.md` 只作为读取迁移输入
    - 目标项目开发计划 → 优先用 `.vibe-docs.json.devPlan`，默认 `开发计划.md`；用于读取当前 Phase / Task 的测试与验证策略
    - 目标项目人工验收记录 → 优先用 `.vibe-docs.json.manualAcceptance`，默认 `验收记录.md`；用于判断是否需要自动化回归或限定复验路径
    - 目标项目任务胶囊 → 优先用 `.vibe-docs.json.taskContext.currentTaskCapsule`；测试设计和 run-report 模式读取当前胶囊的 `验收上下文.jsonl`
    - 目标项目接口契约文档 → 优先用 `.vibe-docs.json.interfaceContracts`，默认 `接口契约.md`；用于判断 API / service / event 契约测试和门禁命令
    - 现有测试配置 → 例如 `playwright.config.*`、`vitest.config.*`、`jest.config.*`、`pytest.ini`、`tox.ini`、`.github/workflows/*`
    - 浏览器自动化依赖 → Playwright / browser binaries 有则做 UI 自动化；缺失则按安装策略处理
    - CI 环境 → 有则同步测试命令；缺失不阻塞本地测试自动化
    - codebase-memory-scout → author / audit 模式中用于找被测函数、调用链、相似测试和测试缺口；MCP 不可用时降级为 `rg`

    安装策略：
    - 已有测试框架时优先复用，不新增平行框架
    - 新增依赖前先检查标准库、平台自带能力和项目已安装依赖；确实不够时说明缺口，等待用户明确同意后才能安装
    - 必需依赖缺失或版本不满足且未获授权时，记录阻塞和替代验证路径，不执行安装命令
    - 需要用户权限、浏览器下载、系统依赖或交互登录时，说明阻塞和手动步骤
    - 可选依赖缺失时，标记降级模式并继续输出可执行的验证路径

[第一性原则]
    **目标项目上下文加载协议（优先级高于下列文档读取描述）**：先解析 `.vibe-docs.json` 的 schema v2、文档索引与 `loadPolicy`，再用 `resolve-target-doc-context.mjs` 显式请求 `documentIndex,currentExecution` 及当前测试真正需要的 `productSpec/devPlan/manualAcceptance/interfaceContracts`。启用胶囊时把 `验收上下文.jsonl` 作为 `--capsule` 输入；只读取 resolver 返回的 selector。onDemand 不得全量读取，never 被拒绝后立即停止且本 Skill 不得自行绕过。

    **严格 TDD 铁律**：`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`。除下述受控 T1 外，所有新功能、bug 修复、重构和行为变更强制 `RED-GREEN-REFACTOR`；目标项目文档不得降低这条默认纪律。如果生产代码已经先写，删除该实现并从 RED 重新开始，不保留作参考。

    **RED - 先写一个最小失败测试**：围绕 public seam、统一接口契约或用户可观察行为写一个最小测试，实际运行并确认它失败；失败必须来自目标行为尚未实现，而不是语法、环境、fixture 或路径错误。测试通过、测试自身报错或失败原因不符时先修测试，未得到正确 RED 前不得写生产代码。

    **GREEN - 只写让测试通过的最小生产代码**：正确 RED 后才允许实现，只写当前测试要求的最小行为；禁止夹带额外功能、提前抽象或无关清理。运行当前测试与相关回归，全部通过且输出无错误、警告后才进入下一步。

    **REFACTOR - 只在全绿后整理**：只消除重复、改善命名或提取 helper，不新增行为；每次整理后重跑测试并保持全绿。

    **例外必须审批**：仅原型、生成代码、配置文件可以提出例外，而且必须在写生产代码前获得用户明确批准。无法自动化本身不构成例外资格；缺测试框架、自动化成本高或外部系统不可控时必须继续建立测试 seam，仍无法形成正确 RED 就停止生产代码修改。

    **visual-only T1 受控例外**：仅限同一组件 / 容器内、不改变用户路径、信息层级、响应式结构、全局 token / theme、UI 包契约或真实业务行为的呈现微调。没有既有测试 / visual regression seam 时，先留可复现的改前基线，再取得改后同路径定向视觉证据与副作用检查；不为本次微调新建测试框架。已有 seam 仍执行 `RED-GREEN-REFACTOR`，任一边界被触发就退出例外并重新分级。

    **测试 seam 先确认**：补测试前先确认被测 seam 落在 public interface、统一契约或用户可观察行为边界，例如 public API、route、typed client、CLI 命令、组件 public props / events、可观察状态或关键用户路径；避免为了方便直接测试私有函数、内部调用顺序、临时 DOM 结构或非契约化实现细节。

    **最小测试层级**：在适用严格 TDD 时选择能稳定证明当前可观察行为的最轻测试层；测试层级可以是 unit、integration、E2E、smoke 或 visual regression，但必须先得到正确 RED。受控 T1 只走上面的基线证据分支，不伪造 RED。

    **测试反模式先排除**：避免 `implementation-coupled`（断言私有实现、内部调用顺序或临时结构）、`tautological assertion`（只验证 mock 自己返回自己、断言被测代码未参与的常量）和 `horizontal slicing`（为追求覆盖率横向铺很多低价值用例，却没有围绕一个可观察行为或契约闭环证明）。

    **复用现有测试体系**：项目已有 Vitest、Jest、pytest、Playwright、Detox、Flutter integration_test 或 CI 约定时，优先沿用命名、目录、fixture、mock 和命令。

    **接口契约先对齐**：补 API、service、event 或 schema 测试前，先读取 `接口契约.md`，确认被测能力ID和统一入口；不要为同一能力新造测试-only endpoint 或平行 service。目标项目启用 `interfaceContractScanner` 时，测试 fixture 应覆盖 server route、typed client path、event / publicEntry / IPC 和正式前端 raw network gate 的正反例。

    **UI 验收工具箱复用**：UI / Electron 验收脚本如果重复出现启动窗口、等待页面、点击路径、截图、DOM / 滚动条检查、report 输出和进程清理等样板逻辑，应优先复用或创建目标项目内的 UI 验收工具箱；一轮临时低风险脚本可以内联，第二次类似脚本或样板逻辑明显重复时不再继续复制整段脚本。

    **代码图辅助选点**：补测试前，如目标函数、调用链或现有测试位置不清，先用 `codebase-memory-scout` 找被测入口、相关 callers/callees 和相似测试；侦察不替代测试断言设计和 fresh 运行证据。

    **证据可复核**：完成声明必须同时包含本轮 RED 和 GREEN：刚刚运行的命令、RED 正确失败摘要、GREEN 测试数量或关键输出、相关回归结果和未验证项；`No test files found` 不是通过证据。

    **验收上下文 manifest**：目标项目启用任务胶囊时，测试设计和 run-report 要读取 `验收上下文.jsonl`。其中 `required !== false` 的项目相对路径必须作为验证证据或审查对象；缺失文件、绝对路径或逃逸路径视为上下文问题，先修正或明确阻塞。

    **自动化不替代人工验收**：UI、设计稿、CLI 人机流程、权限确认、端到端链路、安装启动或发布交付无法完全由自动化证明时，必须标记人工验收状态并限定路径。

    **联网优先**：涉及第三方框架安装命令、CLI 参数、版本兼容、浏览器依赖或 CI 写法时，先查官方文档，不凭过期记忆执行。

[文件结构]
    ```
    test-automation/
    |-- SKILL.md
    `-- references/
        |-- framework-selection.md
        |-- ui-acceptance-harness.md
        `-- workflow.md
    ```

[按需加载 references]

    本 Skill 的 `SKILL.md` 只保留必读主流程。不要默认读取全部 references；只有命中下表场景时，再读取对应文件。

    | Reference | 读取时机 |
    | --- | --- |
    | `references/framework-selection.md` | 需要选择、接入或调整测试框架、测试层级、目录和命令时。 |
    | `references/ui-acceptance-harness.md` | UI / Electron 验收脚本重复包含启动、等待、点击、截图、DOM / 滚动条检查、report 输出或进程清理样板逻辑时。 |
    | `references/workflow.md` | 实际执行 audit / setup / author / run-report，或需要输出测试证据时。 |

[自动化测试维度清单]
    必须判断：
    - 当前请求类型：audit / setup / author / run-report，或组合模式
    - 当前 `execution tier`：新增测试框架、CI 或测试路由默认 T3；只运行已有测试可按风险降级
    - 项目技术栈、包管理器、现有测试框架和已有测试命令
    - 需求 / 开发计划中的严格 TDD 策略、当前 RED 用例、预期失败原因和 GREEN 最小实现边界
    - 当前任务胶囊的 `验收上下文.jsonl` 是否存在、合法，并与本轮验证目标一致
    - 接口契约文档中的能力ID、统一契约入口和 `check-api-contracts` 门禁是否需要纳入 fresh 证据
    - 当前测试目标：unit、integration、E2E、smoke、visual regression 或组合
    - 需要覆盖的用户路径、API 契约、错误态、权限路径和已人工验收范围
    - 自动化能证明什么，哪些仍需要人工验收

    推荐判断：
    - CI 是否已有测试 job，新增命令是否会拖慢关键路径
    - 测试数据、fixture、mock、数据库和外部服务依赖是否可控
    - 浏览器自动化是否需要下载 browser binaries 或系统依赖
    - 是否存在假绿风险，例如 `--passWithNoTests`、跳过断言、只测渲染不测交互

[自动化测试策略]
    **最小闭环策略**：优先补一条能稳定证明当前目标的测试，再考虑覆盖更多分支。

    **层级选择策略**：
    - 纯函数、校验规则、状态机和解析逻辑 → unit test
    - API 契约、数据转换、组件与服务协作 → integration test
    - 关键用户路径、权限流程、表单提交、导航和回归路径 → E2E / smoke
    - 视觉回归、设计系统组件、截图一致性 → visual regression，但必须有稳定基线和更新规则

    **失败优先策略**：除受控 T1 外，每个新增或改变的可观察行为都先记录正确的 RED 失败证据，再写最小实现，最后记录 GREEN 通过证据；一个循环只推进一个行为。

    **阻塞与审批策略**：除已满足全部边界的 visual-only T1 外，如果项目没有测试基础设施或当前行为无法自动化，先尝试建立最小测试 seam；仍不可行时停止生产代码修改并报告阻塞。只有原型、生成代码或配置文件获得用户明确批准后，才能按批准范围使用编译 / 启动 / curl / 临时脚本 / 手动路径替代，并保留审批证据。

    **证据策略**：输出不只写 exit code，要写运行命令、测试文件或用例数量、核心断言、失败摘要和未覆盖风险。

[核心流程摘要]
    - 先发现现有测试体系和目标项目文档，再决定测试层级和工作模式。
    - 目标项目启用任务胶囊时，把 `验收上下文.jsonl` 纳入测试设计和 run-report 证据范围。
    - 需要接入框架时，先查官方文档和项目现有包管理器，最小新增依赖和命令。
    - 除受控 visual-only T1 外，每个新功能、bug 修复、重构和行为变更都执行 RED-GREEN-REFACTOR；不能自动化时继续建立测试 seam 或停止生产代码修改，不自行降级。
    - 严格 TDD 分支输出本轮 RED/GREEN fresh 证据；受控 T1 输出边界核对、既有 seam 结论、改前基线、改后同路径证据和副作用检查；两者都明确人工验收状态。

[初始化]
    1. 执行 [依赖检测]。
    2. 判断当前请求属于 audit / setup / author / run-report 哪种模式。
    3. 读取目标项目文档、现有测试配置和必要 reference；不要为了保险全量读取 references。
    4. 写清成功标准、测试层级、验证命令和人工验收状态，再开始执行。
