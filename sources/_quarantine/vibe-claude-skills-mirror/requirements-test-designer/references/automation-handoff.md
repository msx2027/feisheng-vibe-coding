# automation-handoff

[读取时机]
    需要判断自动化候选、识别技术栈或转交 `test-automation` 时读取。

[边界]
    本 Skill 不编写、接入或运行自动化测试代码。
    本 Skill 只输出 automation candidate、推荐测试层级、技术栈信号、阻塞条件和 handoff packet。
    用户要求生成测试代码、补 E2E、接入 Playwright / Vitest / pytest 或运行测试时，切到 `test-automation`。

[自动化候选判断]
    高优先级候选：
    - P0 / P1 happy path
    - 稳定 API contract
    - 权限拒绝路径
    - 边界校验和错误码
    - 状态机和幂等
    - 历史缺陷回归
    - 数据持久化核心路径

    谨慎自动化：
    - 强依赖人工视觉判断
    - 频繁变化的视觉稿
    - 需要第三方真实支付、短信、邮件或外部不可控服务
    - 没有稳定测试数据或环境
    - 性能指标未定义

    不适合自动化或暂缓：
    - 一次性探索性测试
    - 用户主观满意度判断
    - 无法构造稳定前置条件
    - 需求仍处于 blocked / needs clarification

[推荐测试层级]
    - unit：纯逻辑、校验规则、权限判断、状态机、解析器。
    - integration：API contract、数据库读写、服务协作、组件与状态协作。
    - contract：请求 / 响应 schema、状态码、错误码、向后兼容。
    - E2E：登录、权限、表单提交、关键工作流、核心 smoke。
    - visual：稳定组件或页面基线；需要明确更新规则。
    - accessibility：键盘、焦点、语义和错误提示关联。
    - performance：已有明确阈值和可控环境时。

[技术栈识别信号]
    读取目标项目时只识别信号，不为了自动化代码生成而改项目。

    常见信号：
    - `package.json`、`pnpm-lock.yaml`、`package-lock.json`、`yarn.lock`
    - `playwright.config.*`、`vitest.config.*`、`jest.config.*`
    - `pyproject.toml`、`pytest.ini`、`requirements.txt`
    - `go.mod`
    - `Cargo.toml`
    - `pom.xml`、`build.gradle`
    - `.csproj`、`.sln`
    - `composer.json`
    - `Gemfile`
    - `pubspec.yaml`

[handoff packet]
    交给 `test-automation` 时，输出以下结构：

    ```text
    Handoff to test-automation
    - 目标：为哪些 TC-ID 生成或补齐自动化测试
    - 需求：关联 REQ-ID / Scenario-ID
    - 推荐层级：unit / integration / contract / E2E / smoke / visual / accessibility / performance
    - 技术栈信号：已发现的框架、包管理器、测试配置和命令
    - 测试数据：可复用 fixtures、账号、种子数据、mock 策略
    - 断言：每个 TC-ID 的关键可自动化断言
    - 阻塞：环境、权限、外部服务、人工验收、需求澄清
    - Fresh 证据要求：生成代码后必须运行的命令和通过标准
    ```

[人工验收状态]
    自动化候选不能替代人工验收状态。

    可用状态：
    - `不适用`
    - `待用户验收`
    - `用户已确认`
    - `需回归复验`

    只有用户明确确认后才能写 `用户已确认`。
