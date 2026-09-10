# framework-selection

[读取时机]
    需要选择、接入或调整测试框架、测试层级、目录和命令时读取。

[选择原则]
    - 先复用项目已有框架，不新增并行测试栈。
    - 先查官方文档确认当前安装命令、CLI 参数和配置写法。
    - 优先选择能覆盖当前风险的最轻测试层，不用 E2E 代替所有测试。
    - 新增框架必须同步 `package.json` / 配置 / CI 命令中的最小入口。
    - 不为 v1 引入独立“测试报告文档”角色；证据先进入最终回复、执行光标或开发计划备注。

[常见技术栈默认选择]
    | 项目信号 | 首选测试层 | 默认框架倾向 | 说明 |
    | --- | --- | --- | --- |
    | Vite / React / Vue / Svelte / TS UI | unit + component + E2E | 复用现有 Vitest / Jest；E2E 用 Playwright | 如果已有 Jest，不为单次任务强迁 Vitest |
    | Next.js / Web 全栈 | unit + integration + E2E smoke | 复用现有测试栈；关键路径用 Playwright | API / server action 先测契约，再测浏览器路径 |
    | Node CLI / library | unit + integration | 复用 Vitest / Jest / node:test | CLI 输出、退出码、文件副作用要用临时目录 |
    | Python | unit + integration | pytest | 复用 `pytest.ini`、`pyproject.toml`、fixtures |
    | Go service / library | unit + integration | `go test ./...` | 复用现有 package 测试；HTTP handler / repository 走 integration 或 httptest |
    | Rust crate / service | unit + integration | `cargo test` | 复用 crate / workspace 测试；CLI 行为可用 assert_cmd 或现有方案 |
    | Java / Kotlin service | unit + integration | Maven / Gradle 既有 test task | 复用 JUnit / Kotest / Spring 测试约定，不为单次任务强换构建系统 |
    | C# / .NET service / library | unit + integration | `dotnet test` | 复用 solution / project 测试结构；Web API 优先测契约和 service |
    | PHP / Ruby app | unit + integration | PHPUnit / Pest / RSpec / Minitest | 跟随 composer / bundle 既有约定，不新增平行测试栈 |
    | React Native | E2E critical flows | Detox 或项目既有方案 | 只为关键路径接入，避免一次性全量覆盖 |
    | Flutter | integration / widget | integration_test / flutter_test | 遵守现有 `pubspec.yaml` 和平台依赖 |
    | 纯静态站点 | smoke + accessibility | Playwright 或现有站点测试 | 先测核心链接、渲染和表单路径 |

[层级选择]
    - unit：纯逻辑、格式化、校验、状态机、权限判断、解析器。
    - integration：API 契约、数据库读写、组件与服务协作、跨模块数据流。
    - E2E：登录、权限、表单提交、支付前检查、导航、发布后 smoke、关键用户路径。
    - smoke：启动、主要页面加载、核心命令可运行、健康检查 200。
    - visual regression：设计系统组件、关键截图、视觉基线稳定且团队接受基线更新流程。

[目录和命名]
    - 复用项目已有测试目录和命名，不为了新 Skill 另起风格。
    - 没有既有约定时，优先把测试靠近被测功能；E2E / smoke 放在项目已有 `e2e`、`tests` 或 `playwright` 约定目录。
    - 测试必须表达用户行为或契约，不用“should work”这类空名。

[假绿风险]
    - 看到 `No test files found`、`--passWithNoTests`、跳过断言、只 snapshot 不断言行为时，不得声明通过。
    - 包级测试必须确认实际加载了目标测试文件和用例数量。
    - 临时目录测试不能把运行态写进真实仓库。
