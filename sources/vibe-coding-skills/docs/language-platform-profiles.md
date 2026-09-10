# Language And Platform Profiles

[DocMap]
    层级：L2 / 专题说明
    模块：技术栈决策层
    依赖：
    - `Product-Spec.md`
    - `DEV-PLAN.md`
    - `TERMINOLOGY-AND-NAMING.md`
    - `skills/dev-builder/SKILL.md`
    输出：
    - platform profile 决策规则
    - language adapter 边界
    - architecture profile 口径
    - scaffold policy 口径
    - fallback stack 口径

## 目标

本文件定义 `vibe-coding-skills` 的技术栈匹配口径：通用 Core 规则继续负责需求、设计、计划、开发、测试、review、文档同步、发布、人工验收、接口契约和 UI 复用；具体落地前必须先识别 platform profile、language adapter、architecture profile、scaffold policy 和 fallback stack。

v1 只新增决策层，不新增 Python / Go / Rust 等完整脚手架。现有 `next-feature-first`、`vite-feature-first`、`electron-next-feature-first`、`cli-feature-first` 仍是 JS / TS 一等模板，但不是所有新项目的隐式默认。

## Profile 决策顺序

1. 先识别目标项目形态：Web、Desktop、CLI、Mobile、Backend、Library 或 Agent。
2. 再识别语言和运行时：TypeScript / Node、Python、Go、Rust、Java / Kotlin、C# / .NET、PHP、Ruby、Swift、Dart 等。
3. 再识别架构：frontend、fullstack、service、worker、library、desktop-shell、mobile-app、cli-tool、cli-agent。
4. 最后决定 scaffold policy：使用内置模板、沿用平台默认结构、沿用既有项目结构，或先向用户确认。

如果项目已有代码，以现有结构和依赖为准；新增能力默认 `legacy-incremental`，不强行迁移到 Web / Desktop 的 `feature-first`。

## Platform Profiles

| Profile | 适用信号 | 默认组织策略 | 内置模板 |
| --- | --- | --- | --- |
| Web | 浏览器页面、SaaS、后台、官网、表单、Dashboard | 新项目可用 `feature-first` | `next-feature-first` / `vite-feature-first` |
| Desktop | 需要本地文件、系统权限、桌面安装包或多窗口 | 新项目可用 `feature-first` | `electron-next-feature-first` |
| CLI | 开发者命令、批处理、自动化命令 | Node CLI 可用内置模板；其他语言沿用平台默认结构 | `cli-feature-first` 仅限 Node CLI |
| Mobile | 移动端、推送、相机、定位、碎片化使用 | 平台默认结构 | v1 不提供模板 |
| Backend | API 服务、队列、worker、数据处理、微服务 | 平台默认结构或既有结构 | v1 不提供模板 |
| Library | SDK、包、插件、可复用库 | 语言生态默认结构 | v1 不提供模板 |
| Agent | CLI Agent、自动化 Agent、工具编排、MCP / LLM 集成 | 小型项目按 CLI；复杂项目按 Agent 分层 | Node CLI Agent 参考结构，无单独模板 |

## Language Adapters

| Adapter | 识别信号 | 测试倾向 | 结构口径 |
| --- | --- | --- | --- |
| TypeScript / Node | `package.json`、`tsconfig.json`、Next / Vite / Electron / Commander | Vitest / Jest / node:test / Playwright | Web / Desktop / Node CLI 可使用内置模板 |
| Python | `pyproject.toml`、`requirements.txt`、`pytest.ini` | pytest | 沿用包结构、FastAPI / Django / CLI 生态约定 |
| Go | `go.mod` | `go test ./...` | 沿用 module、cmd、internal、pkg 等 Go 约定 |
| Rust | `Cargo.toml` | `cargo test` | 沿用 crate / workspace 约定 |
| Java / Kotlin | `pom.xml`、`build.gradle`、`settings.gradle` | Maven / Gradle test | 沿用 framework / module 约定 |
| C# / .NET | `.csproj`、`.sln` | `dotnet test` | 沿用 solution / project 结构 |
| PHP / Ruby | `composer.json`、`Gemfile` | PHPUnit / Pest / RSpec / Minitest | 沿用框架和包管理器约定 |
| Swift | `Package.swift`、Xcode project | XCTest / Swift Testing | 沿用 Apple 平台结构 |
| Dart / Flutter | `pubspec.yaml` | `flutter_test` / `integration_test` | 沿用 Flutter / Dart 包结构 |

## Architecture Profiles

| Profile | 适用信号 | 结构影响 | 脚手架口径 |
| --- | --- | --- | --- |
| frontend | 浏览器页面、静态交互、客户端状态 | 路由、页面、组件和客户端状态分层 | 仅 Web + TypeScript / Node 可用内置 Web 模板 |
| fullstack | 同时包含页面、服务端渲染、API 或 server action | 前端、服务入口、接口契约和数据层并列规划 | 仅 Web + TypeScript / Node 可用 `next-feature-first` |
| service | API 服务、后台服务、RPC / HTTP handler | 按语言生态组织 route、service、schema 和测试 | v1 不提供通用服务模板 |
| worker | 队列任务、定时任务、后台处理、数据管道 | 按运行时组织 job、adapter、调度和重试 | v1 不提供通用 worker 模板 |
| library | SDK、插件、可复用包或内部库 | 以 public entry、模块边界和版本发布为核心 | v1 不提供通用 library 模板 |
| desktop-shell | 桌面壳、本地权限、窗口和 preload / main 进程 | 区分 shell、renderer、IPC / event 和本地能力 | 仅 Electron + TypeScript / Node 可用内置 Desktop 模板 |
| mobile-app | 移动端页面、导航、设备能力和应用商店交付 | 沿用移动框架目录、平台配置和端到端验证 | v1 不提供 Mobile 模板 |
| cli-tool | 命令解析、批处理、文件副作用、退出码 | entrypoint、commands、core、adapters 和 smoke 验证 | 仅 Node CLI 可用 `cli-feature-first` |
| cli-agent | 自动化 Agent、工具编排、MCP / LLM 集成 | entrypoints、runtime、tools、memory、services 分层 | 小型 Node CLI 可参考 `cli-feature-first`，无单独模板 |

## Fallback Stack

当需求或代码只能判断“产品形态”，不能判断具体技术栈时，不直接套 Web / Node。先给用户一个最小选择题，或在计划中标记为“需要确认技术栈后才能脚手架初始化”。

允许自动推荐的情况：
- 用户明确说 Web 页面、SaaS、后台、官网，且无既有代码：推荐 Web profile，再在纯前端 / 全栈之间确认。
- 用户明确说 Desktop / Electron：推荐 Desktop profile。
- 用户明确说 Node CLI：推荐 Node CLI profile。

必须先确认的情况：
- 用户只说“做一个工具 / 系统 / 服务”，但没有平台、运行时或部署目标。
- 目标是 Backend、Library、Mobile、非 Node CLI，且没有现有代码约束。
- 存在多个合理选择会明显影响目录结构、测试框架或部署方式。

## Scaffold Policy

- `template`：仅用于现有内置模板覆盖的 JS / TS Web、Desktop、Node CLI 场景。
- `platform-default`：用于 Backend、Library、Mobile、非 Node CLI 或非 JS / TS 项目，沿用语言生态默认结构。
- `existing-incremental`：用于已有项目，先读现有结构，新增能力局部收口，不做全量迁移。
- `ask-once`：无法判断平台或语言时，只问一个会改变脚手架和验证路径的问题。

## 验证选择矩阵

优先运行项目已有的 build / typecheck / lint / test / smoke 脚本；没有现成脚本时才按 language adapter 选择生态原生命令。不得因为本包偏向 JS / TS，就给 Python、Go、Rust、Java、C#、Swift 或 Dart 项目强加 `tsc`、dev server、浏览器或 `npm audit`。

| Language adapter | 无现成脚本时的验证倾向 | 适用边界 |
| --- | --- | --- |
| TypeScript / Node | 项目本地 typecheck / build / test 脚本；存在 `tsconfig.json` 时才运行本地 `tsc --noEmit` | 不用 `npx` 临时下载；没有本地 CLI 时标记未验证 |
| Python | `pytest` 或项目现有测试入口 | 无 pytest 配置时不擅自安装 |
| Go | `go test ./...` | 以 `go.mod` 和 workspace 为准 |
| Rust | `cargo test` | 以 crate / workspace 为准 |
| Java / Kotlin | Maven / Gradle 的现有 test / verify 任务 | 复用 wrapper 或项目已固定版本 |
| C# / .NET | `dotnet test` | 以 solution / project 为准 |
| Swift | `swift test` 或 Xcode 项目现有测试方案 | 按 Package / Xcode 形态选择 |
| Dart / Flutter | `dart test`、`flutter test` 或项目现有集成测试 | 按 Dart / Flutter 项目形态选择 |

smoke 路径由 architecture profile 决定：Web / service 只有在存在可启动入口时才检查进程和 endpoint；CLI 检查命令、输出与退出码；Library 检查 build、导入或 public entry；worker 检查 job 入口；Mobile 使用项目已有 emulator / device / integration 路径。不存在的服务、API、浏览器或端口一律记为 `不适用 + 原因`，不能为了套模板临时造一个。

Windows 默认使用 Windows PowerShell，并在运行版本专属语法前确认 `$PSVersionTable.PSVersion`。仓库只有 `.sh` 验证脚本时，先用 `Get-Command bash` 核对 Git Bash 的真实路径，再从 PowerShell 显式调用；不得把 WSL 占位命令当作 Git Bash。HTTP smoke 在 Windows PowerShell 使用 `Invoke-WebRequest` 或项目已有脚本，文本扫描优先复用项目 checker 或 `rg`。

依赖与安全审计同样按生态和现有配置选择：只有 npm 项目且已有 lockfile / 审计脚本时才运行 npm 审计；其他语言使用项目现有审计入口。任何缺失工具都先按依赖授权规则处理，不得静默安装。

## 验证口径

每次改动技术栈决策规则后，至少检查：
- 文档中没有把 Next / React / Node 写成所有新项目的无条件默认。
- Web / Desktop / Node CLI 仍能找到对应内置模板。
- Backend / Library / Mobile / 非 Node CLI 明确写为 `platform-default` 或 `existing-incremental`。
- 测试框架选择优先复用项目现有配置，不为 v1 新增平行测试栈。
