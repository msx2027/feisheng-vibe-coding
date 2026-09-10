# vibe

## 馬师兄新手接管型双运行时技能包

**vibe**

这是一个面向 `Claude + Codex` 的双运行时技能包。
目标很简单：别人拿到整个 `vibe` 文件夹后，就能直接开始用，不需要先理解这套包是怎么开发出来的。

## 第一次用

第一次使用时，先在当前对话中写出总入口名称：

```text
vibe-coding-skills
```

也可以写 `/vibe-coding-skills`。总入口打开后，本轮对话后续的普通自然语言才会进入 routeHints；例如再说“页面一直转圈”，才会进入故障处理路由。新对话没有先调用总入口时，普通自然语言不会自动加载具体 Skill。

## 它包含什么
- 根目录源码（源码 / safe-lite 档位）：`skills/`、`agents/`、`hooks/`、`codex-hooks/`、`tools/`
- 工程样板与 CI 门禁只随源码 / safe-lite 档位提供；`pure` 运行包不携带 `examples/`、`.github/` 和开发元文档
- Claude 运行时：`.claude/`
- Codex 运行时：`.agents/`、`.codex/`
- 维护真源（源码 / safe-lite 档位）：`Product-Spec.md`、`DEV-PLAN.md`；`pure` 运行包不携带这些开发元文档
- 工具链约束：根 `package.json` 固定 Node `>=22 <26` 和常用 health / test 入口
- 许可证与来源记录：`docs/legal/`

## 默认怎么用
- 用户先显式调用 `vibe-coding-skills` 或 `/vibe-coding-skills` 打开当前对话闸门；可以直接指定 Skill ID，例如 `vibe-coding-skills bug-fixer`，也可以随后只说普通自然语言
- 具体 Skill 不再根据普通自然语言自行启动；只有已激活总入口才允许使用自然语言 routeHints
- `beginner-flow-guide` 只作为已激活总入口内部的新手辅助，不再独立抢入口
- 外部强规划 Skill 边界：`superpowers:brainstorming` 只在用户显式点名、明确要求头脑风暴 / 多方案探索，或需求尚未成形且确实需要先构思时使用；已批准计划、继续执行、bug 修复、测试自动化、文档同步、发布、明确文件修改和 T0/T1 快车道任务不被它拦截
- execution tier 与 review profile 分开计算：T0/T1 保持快车道，普通 T2 同 Agent 分开 Spec / Quality，高影响 T2/T3 用 fresh 独立双审；完整映射与 finding 闭环见 `code-review`
- T2/T3 规格闭环门：需求澄清门 → 新项目和高影响变更先经 `architecture-foundation` 完成开工前架构地基 PASS → 预实现一致性分析 → 交付收敛检查；地基结论写入既有 `系统架构.md`，不建平行真源
- 维护源码时，需求写进 `Product-Spec.md`，计划写进 `DEV-PLAN.md`
- 只有当计划明显变大时，才启用 `plans/`

经验治理闭环：Hook 生成稳定 `eventId`，不保存原 prompt，单事件只进一个 scope。L0 `经验治理.md` 管状态，L1 `宪法设计.md` 登记规则，L2 投影到双 runtime 入口，L3 只接受已注册 checker；升档、退役均需用户确认。

`Product-Spec.md` / `DEV-PLAN.md` 只属于本分发包的源码 / safe-lite 维护面，`pure` 运行包不依赖它们。新目标项目使用 schema v2 `.vibe-docs.json` 映射 `docs/` 下的四字中文生命周期文档；分卷正文用中文短编号加主题，机器编号只留在隐藏标记和索引。完整路径与命名规则见 `docs/runtime-loading-policy.md`。

## 一键体检与样板验证

这部分是给 Codex、CI 和会用终端的用户看的。小白不需要手输命令，说“我不会走流程，你先帮我看看”即可。

首次把目标项目接入本包时，Codex 会使用 `target-constitution-setup`：先生成 `项目画像.md` / `宪法设计.md` 并更新 `.vibe-docs.json`，再用 `target-runtime-setup` 合并短硬 `AGENTS.md` / `CLAUDE.md` managed block。默认先 dry-run，不覆盖用户已有规则：

```bash
node tools/init-target-constitution.mjs <target-root> --skills-root <skills-root> --dry-run|--write|--check
node tools/init-target-runtime.mjs <target-root> --skills-root <skills-root> --dry-run|--write|--check
```

`.vibe-runtime.json` 记录 managed block 版本、checksum 和经验投影哈希；`AGENTS.md` / `CLAUDE.md` 不属于生命周期文档。缺 API、schema、auth、deploy 证据时只能标记 `未验证`，Git 提交标题和正文使用中文描述。

任务胶囊只在真实任务中按需创建：`node tools/init-target-task-context.mjs <target-root> --slug <slug> --title "<title>" --write`，收口用 `--check`；长任务可增加 `--continuity-mode t2|t3|cross-session|long-task`。恢复时以胶囊状态、交接单和执行光标为准，不把聊天记忆当真源。

schema v2 要求顶层角色与 `documents[]` metadata 一致，默认只加载 `文档索引.md`。新目标项目 bootstrap / 脚手架默认启用 `markdownGovernance`；既有项目缺少该字段时保持兼容关闭，不会静默迁移。启用后按预算分卷，检查器只报告不整理，迁移或删除仍需用户确认。完整细则见 `docs/runtime-loading-policy.md`。

新目标项目的根目录 Markdown 白名单只有 `AGENTS.md`、`CLAUDE.md`、`文档索引.md`。其余由本包生成的 Markdown 一律放在 `docs/`：需求、设计、接口放对应主题目录，开发计划、验收、项目画像和宪法放 `docs/项目治理/`，执行光标和任务胶囊放 `docs/plans/`。已有项目只沿用 manifest 已登记路径，不会被自动搬迁。

设计入口以 `.vibe-docs.json.designBrief` 为准，新项目默认指向 `docs/设计简报.md`；不会在根目录维护 `.impeccable.md` 这类第二设计状态文件。

运行 `node <skills-root>/tools/setup-target-hooks.mjs <target-root>` 后，受管文档变化会自动刷新 metadata 与索引；提交前检查哈希、原子暂存和任务胶囊漂移。正文变化不会静默刷新旧 `sourceRevision`，旧分析必须重新核对。

常用的文档治理命令：

```bash
node tools/build-target-doc-index.mjs <target-root> --check|--write
node tools/resolve-target-doc-context.mjs <target-root> --roles <role[,role]> --budget <tokens> --json
node tools/resolve-target-doc-context.mjs <target-root> --markdown <project-relative-file> --budget <tokens> --json
node tools/resolve-target-doc-context.mjs <target-root> --markdown <archive-file> --allow-markdown-archive --reason "<理由>" --budget <tokens> --json
node tools/check-markdown-governance.mjs <target-root> [--force] --json
node tools/check-target-doc-drift.mjs <target-root> --micro|--quick|--full --strict
node tools/check-lifecycle-doc-budget.mjs <target-root> --strict
```

既有 v1 项目仍可做 health；它只会得到 `migration_required` warning。只有用户明确执行 `node tools/migrate-target-doc-system.mjs <target-root> --write` 才会事务升级，默认命令是 dry-run，可用 `--recover` 处理未完成 journal。迁移不重命名、移动或删除用户现有文档；需要归档时，新增 `需求一卷.md` / `计划一卷.md` 这类四字中文卷名，并登记为 never archive。

本包提供统一体检入口：

```bash
node tools/vibe-health-check.mjs <root> --profile package|target|auto --level micro|quick|full [--strict] [--json] [--trust-target-tools]
```

- 检查本包：`node tools/vibe-health-check.mjs . --profile package --level quick --strict`
- 检查目标项目：`npm run check:health`，或 `node tools/vibe-health-check.mjs . --profile target --level quick`
- `micro` 只做项目标记、manifest、package scripts 和必要文件存在性检查；不跑接口契约、UI 复用、镜像树比对或全量 `node --check`
- `target quick` 对 v2 覆盖文档命名、index freshness、drift、硬 budget、guardrail、接口契约、热区和 UI 复用；legacy v1 保持 migration warning 而不被 v2 strict 检查破坏。`package quick` 覆盖本包静态和镜像门禁；`full` 继续运行 build / test / gate
- 安全默认：target / auto 体检不执行目标仓库自带 checker 或 `package.json` scripts；只有你已审阅这些工具时才传 `--trust-target-tools`
- 工具内部不拼接 shell 字符串：子进程使用可信绝对入口、argv 和 `shell:false`；Windows npm 通过 Node + `npm-cli.js` 执行，并拒绝目标根或 junction 内伪造的 Git / checker
- exit code：`0` 通过，`1` 失败，`2` 环境阻塞

目标项目体检覆盖生命周期文档、runtime registry、任务胶囊、接口契约、UI 复用和热区；提交时先由 `check-target-doc-precommit.mjs` 阻止受管文档哈希、索引、原子暂存或旧证据漂移，再由 `check-hotspots --strict --staged` 阻止结构热点继续增长。首次安装或升级 hook 时从当前技能包运行 `node <skills-root>/tools/setup-target-hooks.mjs <target-root>`；安装器会同时刷新文档同步 Hook、Claude/Codex `UserPromptSubmit` 显性纠错检测和 pre-commit 门禁，避免已有项目只有经验规则却没有计数入口。项目已有自定义 pre-commit 或热点工具时，使用 `--runtime-hooks-only` 只更新 runtime Hook/配置，不覆盖项目工具或修改 `core.hooksPath`。维护诊断、完整工具清单与参数见 `tools/INDEX.md`。Skill 变化后用 `node tools/check-routing-manifest.mjs . --write` 刷新路由索引。

接口契约门禁回归首选跨平台 Node 入口，Windows 没有 Git Bash / WSL 时也能跑：

```powershell
node tools/test-api-contracts.mjs
```

`bash tools/test-api-contracts.sh` 仍保留，但只是调用同一个 Node 测试的兼容包装。

四类内置脚手架使用 allowlist，依赖是精确版本，并且每类都携带对应 `package-lock.json.template`：

Web / Desktop 模板当前安全基线为 Next 15.5.21、PostCSS 8.5.12、Sharp 0.35.0；锁文件以 CI 的 Node 22 生成，并要求 `package-lock-only` 稳定与 `npm audit` 为零漏洞。

```bash
bash ./tools/render-project-scaffold.sh \
  --template <next-feature-first|vite-feature-first|electron-next-feature-first|cli-feature-first> \
  --project-name <project-name> \
  --output <target-dir> \
  [--title <project-title>]
```

渲染器拒绝已存在输出目录、路径越界和用户输入进入代码上下文。runtime scaffold 与 golden path 的依赖安装统一使用 `npm ci --ignore-scripts`，不使用 `npm install`、`npx` 或浮动 `@latest`；Electron 样板随后显式运行 `npm run prepare:electron` 下载锁定版本的运行时二进制。

`examples/golden-path/` 提供三类迷你可运行样板：

- `web-vite-mini`
- `desktop-electron-mini`
- `cli-node-mini`

统一验证入口：

```bash
bash tools/test-golden-path-examples.sh
```

`test-runtime-project-scaffold.sh` 和 `test-golden-path-examples.sh` 仍属于 Bash runtime smoke；Linux Electron smoke 会在启动前配置 `chrome-sandbox` 的 root 属主与 `4755` 权限；Windows 本机没有真实 Git Bash / WSL 时，记录为环境阻塞，不把它们说成已执行。

GitHub Actions 默认使用 `.github/workflows/vibe-quality.yml`，只授予 `contents: read`，固定 Ubuntu / Windows 版本，并用 commit SHA 锁定 checkout / setup-node / setup-python。工作流覆盖 package health、静态 gate、runtime scaffolds、golden path examples、Python 3.12 compile / pytest，以及 Windows 的 Git Bash scaffold / golden path、跨运行时 PowerShell 测试、镜像与 sync 安全检查；依赖 PowerShell 的测试不放在 Ubuntu 静态 gate 中执行。

## 主要 Skill

- `vibe-coding-skills`：唯一用户入口；激活当前对话后可指定 Skill 或使用自然语言路由
- `beginner-flow-guide`：仅由已激活总入口按需调用的新手辅助
- `target-constitution-setup`：目标项目首次完整接入，生成 `项目画像.md`、`宪法设计.md` 并安全合并短硬 `AGENTS.md` / `CLAUDE.md`
- `target-runtime-setup`：目标项目 runtime managed block 刷新或检查
- `product-spec-builder`：需求梳理
- `design-brief-builder`：设计方向
- `design-maker`：设计稿
- `dev-planner`：开发计划
- `codebase-memory-scout`：代码图侦察、影响面分析、调用链定位
- `dev-builder`：开发实现
- `hotspot-governor`：核心热区治理，诊断大文件/测试/runtime/token/schema/目录/重复 helper，给拆分路线
- `ui-system-guardian`：初始化组件库、补 token、补组件 / variant、治理 UI 债务、统一样式和修复 `check-ui-reuse`
- `requirements-test-designer`：PRD / 需求文档生成工程级测试用例体系、追溯矩阵和自动化候选
- `test-automation`：严格 TDD 铁律、自动化测试、E2E、回归测试和 RED / GREEN 证据
- `bug-fixer`：修 bug
- `doc-sync-guardian`：同步文档
- `code-review`：按 review profile 执行 Spec Compliance / Code Quality，维护 finding ledger、Review Receipt 与复审闭环
- `release-builder`：发布交付

## 前端页面设计链路

- 默认主链路：`product-spec-builder -> design-brief-builder -> design-maker -> dev-planner / dev-builder`
- 设计增强层：`ui-ux-pro-max`、`design-system`、`ui-styling`、`brand`
- UI 系统治理层：`ui-system-guardian`
- 设计质量层：`impeccable`、`audit`、`critique`、`polish`、`layout`、`typeset`

## 技术栈 Profile

- 这套包的 Core 规则是通用的：需求、设计、计划、开发、测试、review、文档同步、发布、人工验收、接口契约和 UI 复用不绑定单一语言
- 新目标项目先识别 `platform profile + language adapter + architecture profile + scaffold policy + fallback stack`，再决定是否使用脚手架
- 现有内置模板覆盖 JS / TS 一等路径：Web（Next / Vite）、Desktop（Electron + Next）和 Node CLI；它们不是 Backend、Library、Mobile 或非 Node CLI 的隐式默认
- 技术栈不明确时先扫描需求和工程痕迹；仍无法判断时只问一个关键问题，不静默套 Web / Node
- 详细矩阵见 `docs/language-platform-profiles.md`

## 首次打开时看什么
1. `AGENTS.md`
2. 先按问题分类，不要直接全量读取所有真源
3. 规则解释 / token 消耗 / Skill 列表：优先看 compact v3 `skills/ROUTING-MANIFEST.json`，再看 `README.md`、`skills/INDEX.md` 或定向搜索
4. 继续 / 下一步 / 当前做到哪：源码 / safe-lite 维护包再看 `DOC-MAP.md`、`Product-Spec.md`、`DEV-PLAN.md`；pure 运行包只读取当前任务和目标项目文档
5. 具体 Skill：只有当前对话已激活总入口后，才看对应 `SKILL.md` 和命中的 reference

## Token 和按需加载

- 先按请求分类；规则解释、Skill 列表和手动路由优先读 compact v3 `skills/ROUTING-MANIFEST.json`，不自动串读全部需求 / 计划真源。
- T0/T1 快车道只读命中文件与必要近邻，不启动具体 Skill、不跑完整体检；只有当前对话已激活总入口后才加载专项 Skill。
- 具体 Skill 先读 `SKILL.md`，只在其 reference 表命中时读取对应 `references/`；历史单数 `reference/` 继续兼容。
- 静态搜索默认只扫真源，排除 `.agents/`、`.claude/`、`.codex/` 镜像及全局 sessions / history / cache。
- 跨模块、入口或调用链不清的 T2/T3 才选择性启用 `codebase-memory-scout`；侦察不能替代源码与 fresh 验证。
- 预算与 manifest 门禁：`node tools/check-skill-token-budget.mjs . --strict`、`node tools/check-routing-manifest.mjs .`；Skill 变化后用后者的 `--write` 刷新。
- 完整规则见 `docs/runtime-loading-policy.md`。

## 如果你要改这套包本身

这套包同时保留了源码目录和运行时镜像。
- 改源码：`skills/`、`agents/`、`hooks/`、`codex-hooks/`、`tools/`、`.claude/CLAUDE.md`、`settings.json`、`codex-hooks.json`；根 `CLAUDE.md` 只是重定向占位，不是 Claude 真入口
- 不要直接手改：`.claude/skills/`、`.claude/agents/`、`.agents/skills/`、`.codex/agents/` 等同步生成的运行时镜像；`.claude/CLAUDE.md` 是明确例外，它本身是 Claude 入口真源
- 子 Agent 的唯一源码是 `agents/*.md`；同步脚本会生成 Claude 的 `.claude/agents/*.md` 镜像和 Codex 的 `.codex/agents/*.toml` 镜像

改完源码后运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\sync-compat.ps1
```

`sync-compat.ps1` 会拒绝 junction / reparse point，并以同目录原子替换生成镜像；package health 会复核字节一致性。安全边界见 `tools/INDEX.md`。

需要本地检查 lite 分发包时，可以不生成 zip：

```powershell
node tools/build-lite-package.mjs --no-zip
```

lite builder 对 linked path、未纳入正式 index 的发布输入和构建期漂移 fail-closed，并做隐私 / secret 与镜像 provenance 校验。修改 Skill 路由后先刷新 manifest、同步镜像，再选择性 stage；详细合同与独立 verifier 命令见 `tools/INDEX.md`。

Codex Hook 只接受经边界校验的 Git-for-Windows 工具链，拒绝仓库内或 PATH junction 的伪造入口；完整信任模型见 `tools/INDEX.md`。

普通 T2 完成定向验证与 split-self-review 并 stage 后，可用 T2 light closeout 写入机器快照；快照不替代 finding ledger：

```powershell
node tools/mark-t2-check-clean.mjs . --evidence "<验证命令或说明>"
```

如果你只是把它当一个可直接使用的 skills 文件夹，到这里就够了。

如果你还想启用 repo 级 Git hooks：
1. 先让当前文件夹成为 Git 仓库，比如先 `git init`
2. 如果这是刚导入的全新仓库，先提交一次 baseline；否则 pre-commit 会把整套包的初始导入当成待 review 的 T3 source change
3. Windows 建议安装 Git Bash；完整 Bash gate 需要真实 Git Bash（例如 `D:\Git\bin\bash.exe`），PATH 上只有 WSL 占位 `bash` 时不等同于完整 gate
4. 再运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\setup-repo.ps1
```

## 验证和纪律

- 默认严格 TDD：除下述受控 T1 外，生产行为按 `RED-GREEN-REFACTOR`；原型、生成代码、配置文件仅在事前获得用户明确批准时可例外，难自动化或后补测试不豁免。
- visual-only T1 受控例外：边界已核对且没有既有测试 / visual regression seam 时，用改前基线、改后同路径定向视觉证据和副作用检查；有 seam，或涉及用户路径 / 信息层级 / 响应式 / 全局 token / theme / UI 包契约 / 真实业务行为，重新分级并走 TDD。
- 审查按风险分级；T2+ 分开 Spec / Quality，高影响 T2/T3 用 fresh 独立 Reviewer；finding 必须复审或裁决，DONE / snapshot 不是完成证据。
- 目标 runtime 同时携带 strict TDD、受控 T1 与 review closeout；CI fixture 不冒充 live Agent receipt。
- 外部 `superpowers:brainstorming` 只在显式点名或确需探索时进入，不拦截既定任务和 T0/T1 快车道。
- Bash full gate 只认真实 Git Bash / WSL；PowerShell 降级检查不得冒充，Stop gate 每次从 Git 重算 source changes。
- 技术选型先判 platform / language / architecture profile；内置脚手架只覆盖明确匹配的 Web、Desktop 和 Node CLI。
- 正式前端优先复用 UI 包与 tokens；新增业务入口先对齐 `接口契约.md`。视觉精修没有功能真源时只保留明确标注的占位状态。
- 目标项目的需求、计划、术语、任务上下文和人工验收必须落盘；需要真实点击、安装或观察的路径不能用自动化结果代替用户确认。
- 大文件治理走 `hotspot-governor`，UI 系统债务走 `ui-system-guardian`，跨模块调用链不清时才使用 `codebase-memory-scout`。
- 完整 tier、路由、Hook、接口、UI、生命周期和 rollback 规则以 `AGENTS.md`、`docs/runtime-loading-policy.md` 与各具体 Skill 为准。

## 许可证与来源

- `ui-ux-pro-max` 侧：MIT
- `impeccable` 侧：Apache-2.0
- 具体来源和打包说明见 `docs/legal/BUNDLED-DESIGN-SKILLS-SOURCES.md`
