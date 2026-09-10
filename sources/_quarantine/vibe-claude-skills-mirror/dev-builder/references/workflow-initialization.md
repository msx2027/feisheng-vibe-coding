# 工作流程（初始化模式）

> 来源：dev-builder/SKILL.md 的 [工作流程（初始化模式）]。
> 读取时机：无代码新项目初始化、脚手架渲染、首次 commit/push 前。

[工作流程（初始化模式）]
    触发条件：有目标项目开发计划，无项目代码

    [启动阶段]
        第一步：依赖检测
            执行 [依赖检测]

        第二步：加载文档
            读取目标项目需求文档 → 提取产品概述、核心功能、测试与验证策略
            读取目标项目开发计划 → 提取技术栈表、Phase 1 内容、数据库表（如有）、测试与验证策略
            读取目标项目接口契约文档 → 提取 Phase 1 涉及的业务能力、统一契约入口和门禁要求
            如有目标项目设计简报 → 读取色彩方向、信息密度（配置 Tailwind 主题）
            如有设计工具 MCP → 读取 Phase 1 相关页面的设计数据

    [技术方案阶段]
        运用 [技术栈选择策略]
        根据目标项目开发计划的技术栈表确认方案
        WebSearch 验证框架版本和关键依赖兼容性
        如有多个合理选项 → 给用户 2-3 个方案选

    [项目搭建阶段]
        在 <project-name>/ 子文件夹中初始化项目，不在根目录。
        命名：小写字母 + 数字 + 连字符。
        按 `language adapter` 配置对应运行时、依赖、环境变量和测试入口；只有 JS / TS Web、Desktop、Node CLI 模板路径默认配置 TypeScript strict mode，Web / Desktop 模板再配置 Tailwind。
        如项目类型为 Web / Desktop / Node CLI、是新项目，且 `scaffold policy = template`：
        1. 先选择对应模板：`next-feature-first / vite-feature-first / electron-next-feature-first / cli-feature-first`
        2. 运行 `bash ./tools/render-project-scaffold.sh --template <template> --project-name <project-name> --output <project-dir>` 渲染默认骨架
        3. 确认脚手架已调用 `tools/init-target-runtime.mjs` 初始化目标项目 `AGENTS.md` / `CLAUDE.md` 轻量 managed block；已有项目接入时单独走 `target-runtime-setup`
        4. 先确认模板自带的运行壳齐全：Vite 至少有 `index.html`；Electron 至少有 `tsconfig.electron.json` 与 `scripts/dev-electron.mjs`；Node CLI 至少有 `src/index.mjs` 和 smoke 入口
        5. Web / Desktop 模板确认自带 `src/shared/ui`、`tools/check-ui-reuse.mjs` 和 `check:ui-reuse`，页面层从第一屏开始复用 UI 包；Node CLI 不创建 Web UI 包
        6. 确认模板自带 `接口契约.md`、`tools/check-api-contracts.mjs` 和 `check:api-contracts`，真实接口从第一版开始登记能力契约
        7. 再在渲染结果上补项目特有依赖、样式和业务模块
        8. 如果这次改的是脚手架模板本身，收口前额外运行 `bash ./tools/test-runtime-project-scaffold.sh`；普通业务开发不默认跑这层高成本验证
        如项目类型为 Backend / Library / Mobile / 非 Node CLI，或 `scaffold policy = platform-default / existing-incremental`，不渲染现有 JS / TS 模板，按平台生态结构创建或沿用目录。
        如明确是已有项目迭代，则改走 `legacy-incremental`，不强套模板。

        Git 准备：
        1. 根目录 git init + 创建 .gitignore（排除规划文档、设计资源、环境变量、构建产物）
        2. 创建 `.githooks/pre-commit`，写入最小自动门禁逻辑
        3. 执行 `git config core.hooksPath .githooks`
        4. 从当前技能包运行 `node <skills-root>/tools/setup-target-hooks.mjs <target-root>` 安装或升级提交护栏钩子与受管热区工具（提交前校验 AGENTS.md / CLAUDE.md runtime 同步，并执行 `check-hotspots --strict --staged` 结构棘轮）；脚手架渲染时已自动执行，git init 之后需再跑一次以写入 core.hooksPath
        4. 确保 gh CLI 可用且已认证（未安装则安装，未认证则引导用户完成 `gh auth login`）
        5. 创建 GitHub **private** 仓库并关联远程
        6. 首次 commit + push

    [Phase 1 开发]
        进入 [持续开发模式] 的 Phase 执行流程，从 Phase 1 开始

