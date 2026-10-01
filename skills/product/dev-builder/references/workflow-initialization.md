# 工作流程（初始化模式）

> 来源：skills/product/dev-builder/SKILL.md 的 [工作流程（初始化模式）]。
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
        2. 渲染默认骨架：`render-project-scaffold` 属源项目旧代工具、未随本包分发——目标项目自备等价渲染脚本时按 `--template/--project-name/--output` 用法运行；未自备时按本技能「脚手架策略」段列的六步手工合成（`_target-docs` → Web/Desktop 另加 `_shared-ui` → 模板树 → `_`→`.` 与去 `.template` 改名 → 占位符替换 → 运行时块与提交护栏），不得跳过改名与占位符替换
        3. 确认目标项目 `AGENTS.md` / `CLAUDE.md` 已有轻量 managed block：本包随发的入口是 `node <skills-root>/tools/init-target-runtime.mjs <target-root> --skills-root <skills-root> --write`（旧代渲染器会自动调用它，手工渲染时必须自己跑这一步）；已有项目接入时按控制面的接管路由处理（`governance/sliver-core/references/routes-rescue.md`），不在本 Skill 内另写目标项目运行时块
        4. 先确认模板自带的运行壳齐全：Vite 至少有 `index.html`；Electron 至少有 `tsconfig.electron.json` 与 `scripts/dev-electron.mjs`；Node CLI 至少有 `src/index.mjs` 和 smoke 入口
        5. Web / Desktop 模板确认自带 `src/shared/ui` 组件起点与 `check:ui-reuse` 脚本位，页面层从第一屏开始复用 UI 包；该脚本位指向的 UI 复用门禁属源项目旧代工具，未随本包分发——目标项目自备等价脚本时按其执行，未自备时由 `ui-system-guardian` 按同一清单人工核对，不得因为 package.json 里有这条脚本就声明门禁已生效；Node CLI 不创建 Web UI 包
        6. 确认模板合成出的 `接口契约.md` 与 `check:api-contracts` 脚本位存在，真实接口从第一版开始登记能力契约；`check-api-contracts` 执行器属源项目旧代工具、未随本包分发，项目自备等价脚本时跑到通过，未自备时人工核对「新增入口已先写进契约、同一业务能力只留一个统一入口」并留证据，不得因为脚本位存在就宣称契约已被机器校验
        7. 再在渲染结果上补项目特有依赖、样式和业务模块
        8. 如果这次改的是脚手架模板本身，收口前还要做模板冒烟：旧代脚手架自测脚本（`test-runtime-project-scaffold` 一族）属源项目旧代工具、未随本包分发，实测活树没有这些脚本文件，快照里有四份都不随发，因此由协作方自备等价冒烟——在临时目录手工合成一份骨架、按上第 2 步核对改名与占位符替换结果、`npm install` 后跑 `npm run build` 冒烟并留命令与输出证据；普通业务开发不默认跑这层高成本验证，不得口头声明「脚手架自测已通过」
        如项目类型为 Backend / Library / Mobile / 非 Node CLI，或 `scaffold policy = platform-default / existing-incremental`，不渲染现有 JS / TS 模板，按平台生态结构创建或沿用目录。
        如明确是已有项目迭代，则改走 `legacy-incremental`，不强套模板。

        Git 准备：
        1. 根目录 git init + 创建 .gitignore（排除规划文档、设计资源、环境变量、构建产物）
        2. 创建 `.githooks/pre-commit`，写入最小自动门禁逻辑
        3. 执行 `git config core.hooksPath .githooks`
        4. 从当前分发包运行 `node <skills-root>/skills/product/hotspot-governor/tools/install-hotspot-gate.mjs <target-root>` 安装或升级提交护栏——拷 `check-hotspots` 模块、按项目布局扩扫描根、未设 `core.hooksPath` 时置为 `tools/githooks`、幂等追加带标记的 pre-commit 段（提交前跑 `check-hotspots --strict --staged` 结构棘轮）并跑首检基线（含密钥护栏）；脚手架渲染时已自动执行，git init 之后需再跑一次。提交前校验 AGENTS.md / CLAUDE.md 受管块与真源同步属源项目旧代 `setup-target-hooks` 的文档门禁，未随本包分发：目标项目自备等价检查时按其执行，未自备时由协作方在交付前人工核对受管块版本与 checksum，不得把棘轮接线当成文档同步已完成
        4. 确保 gh CLI 可用且已认证（未安装则安装，未认证则引导用户完成 `gh auth login`）
        5. 创建 GitHub **private** 仓库并关联远程
        6. 首次 commit + push

    [Phase 1 开发]
        进入 [持续开发模式] 的 Phase 执行流程，从 Phase 1 开始

