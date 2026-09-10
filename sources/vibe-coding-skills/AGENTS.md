# AGENTS.md

[DocMap]
    层级：L1 / Codex 入口
    模块：双运行时分发包主控规则
    依赖按需读取：
    - `README.md`
    - `skills/ROUTING-MANIFEST.json`
    - `skills/INDEX.md`
    - `agents/INDEX.md`
    - `hooks/INDEX.md`
    - `codex-hooks/INDEX.md`
    - `tools/INDEX.md`
    - `docs/runtime-loading-policy.md`
    输出：
    - Codex 默认行为
    - 技能路由规则
    - 按需加载与持久化约定

[仓库定位]
    这是一个对外分发的 `vibe coding skills` 双运行时包。
    目标是：别人拿到整个文件夹后，就能把它当成可直接使用的技能仓库。

[源码与镜像]
    - Claude 读取 `.claude/CLAUDE.md`、`.claude/settings.json`、`.claude/skills/`、`.claude/agents/`
    - Codex 读取根目录 `AGENTS.md`、`.agents/skills/`、`.codex/agents/`，如启用 hooks 再读取 `.codex/hooks.json`
    - 源码目录是：`skills/`、`agents/`、`hooks/`、`codex-hooks/`、`feedback/templates/`、`settings.json`、`codex-hooks.json`；Claude 入口真源为 `.claude/CLAUDE.md`，根目录 `CLAUDE.md` 是重定向占位，不参与 sync-compat 同步。
    - 运行时镜像目录是：`.claude/`、`.agents/`、`.codex/`
    - 不直接手改镜像目录；修改源码后运行 `powershell -ExecutionPolicy Bypass -File .\tools\sync-compat.ps1`
    - `agents/*.md` 是子 Agent 唯一源码；同步时生成 `.claude/agents/*.md` 和 `.codex/agents/*.toml`（排除 `agents/INDEX.md`）

[热路径加载规则]
    - `AGENTS.md` / `.claude/CLAUDE.md` 是热路径，只保留硬规则、路由和加载策略；低频细则放到按需文档或具体 Skill reference。
    - 小任务快车道优先：用户已经明确对象（文件 / 路径 / 组件 / 当前选区 / 查询范围 / 非破坏性指定命令）、动作和可定向验证方式，且任务可判为 T0/T1 时，直接执行定向读写或轻量命令验证；这是普通对话的直接动作边界，不加载具体 Skill，不恢复完整项目状态，不跑自动体检。只有用户在当前对话显式调用 `vibe-coding-skills` 后，才允许总入口把普通自然语言路由到具体 Skill。
    - UI 微调快车道：用户明确指向同一组件 / 同一容器内的大小、位置、间距、颜色、字号、圆角、阴影、透明度等 visual-only 微调，且不改变用户路径、信息层级、响应式结构、全局 token / theme、UI 包契约或真实业务行为时，按 T1 light 直接处理；不要因为出现“UI / 布局 / 间距 / 对齐 / 位置 / 大小”等词自动进入 `layout` / `polish` / `adapt` / `audit` / `impeccable`、`check-ui-reuse`、health 或完整视觉验收。
    - 入口加载后不要自动连续读取完整的需求 / 计划真源。先按用户请求分类，再决定要不要恢复状态。
    - 只问规则、token 消耗、Skill 列表、使用方式或概念解释时，优先用当前入口、`skills/ROUTING-MANIFEST.json`、`README.md`、`skills/INDEX.md` 或定向 `rg`；不要恢复完整需求 / 计划真源。
    - 用户说“继续 / 下一步 / 当前做到哪 / 卡住了”时，才读取恢复入口：本分发包按需求 / 计划真源按需恢复；目标项目先读 `.vibe-docs.json`、`文档索引.md`、当前 `任务状态.json` 与执行光标的当前片段，再由 resolver 增加显式 role，不默认全文恢复需求 / 计划。
    - 具体 Skill 只读该 `SKILL.md`；只有命中其“按需加载 references”表时，才读对应 reference，一次只读当前任务真正需要的文件。
    - 目标项目排查 token / 上下文消耗时，不扫描 `$CODEX_HOME` 全目录；只检查当前入口和必要日志 / 配置。
    - 搜索默认用 `rg` / `rg --files`。源码目录与镜像目录内容重复，除非验证同步漂移，不要同时扫描 `skills/`、`.agents/skills/`、`.claude/skills/`；默认静态审计排除 `.agents/`、`.claude/`、`.codex/` 以及全局 sessions / history / cache / skills 镜像目录。
    - 更完整的加载预算、T3+ 细则、镜像同步检查和常见场景表见 `docs/runtime-loading-policy.md`，只在任务需要时读取。
    - 向子 Agent 或工具分派任务时，只注入完成该任务必需的最小上下文（目标文件路径 + 明确动作），禁止将完整 Skill 路由列表或完整入口文件传入子 Agent prompt。
    - implementer 派发门槛：仅当任务跨越 ≥3 个独立模块且预估改动文件 ≥5 时才派发；否则主 Agent 直接实现。该门槛不限制 review profile 要求的独立 Reviewer；Reviewer 只读、不得递归派发 Reviewer。evolution-runner 每次触发最多执行 3 轮，无新信号自动停止。
    - 目标项目 `.vibe-docs.json` 新写入必须是 schema v2：required 顶层角色与 `documents[]` 的 role/path / metadata 一致，`documentIndex` 固定为 `文档索引.md`。`loadPolicy.always` 默认只含 `documentIndex`（最多 3 个角色、合计 ≤12,000 token），其余为 onDemand，`never` 由 resolver 默认拒绝；legacy v1 只给显式 migration warning，不静默改写也不当作既有项目 health blocker。
    - 生命周期大文档拆分标准：单文档超过 20,000 token 而无新鲜 section index 时必须先刷新 `文档索引.md` / metadata；超过 50,000 token 必须按版本或时间归档。归档卷使用四字中文名（如 `需求一卷.md` / `计划一卷.md`），注册为 archive authority 并加入 never，不能使用 `变更归档-v1.md` 一类绕过命名。
    - token 预算检查工具：`node <skills-root>/tools/check-lifecycle-doc-budget.mjs <target-root>`；建议在项目治理门禁中加入此检查。
    - 全项目 Markdown 分卷治理：新目标项目 bootstrap / 脚手架默认写入并启用 `.vibe-docs.json.markdownGovernance`；既有项目缺少该字段时不静默开启、不自动迁移。启用后普通正文超过 8,000 token 必须拆分为不超过 3,000 token 的门面和同名专属目录正文；每次 Markdown 写入 / 移动后运行 `check-markdown-governance.mjs`。检查器只报告不整理；读取先取门面再用 resolver 精确取一份正文。迁移、备份登记 / 删除和冗余源文件删除必须由用户明确授权、无并发写入，并验证内容、链接、索引与审计记录；完整细则见 `docs/runtime-loading-policy.md`。

[持久化真源]
    - 本分发包源码包的需求、计划、术语文档属于维护真源；纯分发档位不携带这些开发元文档。
    - `plans/` 只在计划明显变大时启用；启用后 `plans/CURRENT-EXECUTION.md` 是本分发包维护光标。
    - 目标项目优先读取 schema v2 `.vibe-docs.json` 和根目录 `文档索引.md`，再通过 `resolve-target-doc-context.mjs` 按角色 / selector 读取 `docs/` 内的四字中文生命周期文档；索引只是导航投影，不是正文真源。
    - 目标项目可选任务胶囊只补充单个任务上下文，不替代 `.vibe-docs.json`；新项目启用后默认目录为 `docs/plans/任务/<date-slug>/`，会话恢复可用 `docs/plans/会话记录.md`；既有项目沿 manifest 路径。
    - 需求、术语、计划、当前任务、关键决策要写回文件；没落盘的信息不视为可靠状态。

[目标项目硬规则]
    - 本节只约束用户用本包开发出来的目标项目，不改本分发包自身的维护真源。
    - 新目标项目根目录 Markdown 白名单仅为运行时入口 `AGENTS.md`、`CLAUDE.md` 与导航投影 `文档索引.md`；其他 Markdown 一律进入 `docs/` 并按职责分类，禁止就近散落根目录。
    - 新目标项目生命周期 `.md` 文件名必须是正好 4 个汉字，默认映射包括：`docs/需求文档.md`、`docs/需求变更.md`、`docs/设计简报.md`、`docs/项目治理/开发计划.md`、`docs/plans/执行光标.md`、`docs/项目治理/验收记录.md`、`docs/接口契约.md`、`docs/plans/第一阶段.md`。
    - 分卷正文文件名使用中文短编号加主题，如 `062-输出式学习.md`、`附录-001-术语说明.md`；`vibe-section` 和索引保留机器编号供精确检索，机器编号不得出现在人看的文件名中，且全项目正文不得重复。
    - 新目标项目必须生成 schema v2 `.vibe-docs.json` 和 `文档索引.md`；发现 legacy 英文生命周期文档或 v1 manifest 时可以读取迁移，但继续生成 / 更新时必须写入四字中文 `.md`。迁移默认 dry-run，只有显式 `migrate-target-doc-system.mjs --write` 才能落盘，且不重命名、移动或删除用户原文件。
    - 目标项目首次使用本包时，先使用 `tools/init-target-constitution.mjs` 生成或更新 `docs/项目治理/项目画像.md`、`docs/项目治理/宪法设计.md` 和 `.vibe-docs.json.projectProfile / constitutionDesign / loadPolicy`，再使用 `tools/init-target-runtime.mjs` 为目标根目录生成或合并短硬 `AGENTS.md` / `CLAUDE.md` managed block，并维护 `.vibe-runtime.json`；不得覆盖用户已有规则，不得复制整份本包入口，不得把这两个 runtime 入口写入 `.vibe-docs.json`。
    - `.vibe-docs.json.taskContext` 默认只登记 disabled 能力；真正开始非快车道 T2/T3 任务时再用 `tools/init-target-task-context.mjs` 按需在 `docs/plans/任务/` 创建任务胶囊，不提前创建空 `会话记录.md`。启用后 `任务状态.json` 是唯一可写任务状态真源，`docs/plans/执行光标.md` 只能由 `update-target-task-state.mjs` 生成投影；状态 / selector / metadata 漂移用 `check-target-doc-drift.mjs --micro|--quick|--full` 分层检查。
    - 目标项目运行 `setup-target-hooks.mjs` 后，Claude / Codex 修改 manifest 已登记文档必须由 PostToolUse 自动刷新 `.vibe-docs.json` metadata 与 `文档索引.md`；pre-commit 再硬检查原子暂存和 drift。自动同步只更新可再生投影，不改正文、Git 暂存区或旧任务胶囊 `sourceRevision`；正文变化后旧证据必须保持过期并重新核对。
    - 生成或更新生命周期文档后，运行 `node <skills仓库>/tools/check-target-doc-names.mjs <目标项目根目录> --require-existing`。
    - 需要用户真实点击、操作或观察才能确认的内容，交付前必须提醒人工验收；只有用户明确确认后才能记录为 `用户已确认`，并写入 `.vibe-docs.json.manualAcceptance` 映射文档。
    - 新增真实 endpoint、service、public entry、server action、fetch wrapper、IPC / event 通道或 schema 前，先读 `.vibe-docs.json.interfaceContracts` 映射的 `接口契约.md`；同一业务能力默认只保留一个统一契约入口。
    - 正式前端页面优先复用目标项目 UI 包、design tokens、组件盘点和复审证据；初始化组件库、补 token、补组件或修 `check-ui-reuse` 时进入 `ui-system-guardian`。
    - UI 精修、复刻、image-to-code、截图 / 设计稿还原和视觉 polish 默认只做呈现层与必要纯 UI 状态；没有明确功能开发指令时不得伪装成真实业务完成。

[默认路由]
    - 显性纠错事件只能进入一个 scope：`package-feedback`、`target-project` 或 `global-codex`；范围不唯一时只提议并等待确认，禁止自动跨域双写。
    - `vibe-coding-skills` 是唯一用户可见总入口。用户必须先在当前对话显式调用总入口；指定 Skill ID 时直接路由，未指定 ID 时，后续普通自然语言才可在本对话内由总入口查 `routeHints`。新对话未激活时具体 Skill 不得由普通自然语言触发。`beginner-flow-guide` 只能由已激活总入口按需调用。
    - T2/T3：需求澄清门；新项目和高影响变更先走 `architecture-foundation` 开工前架构地基并取得 PASS；再做预实现一致性分析与交付收敛检查。T0/T1 快车道不变。
    - 外部强规划 Skill：`superpowers:brainstorming` 仅限显式点名、明确多方案探索或需求未成形；已批准计划、继续执行、bug、测试、同步、发布、明确修改和 T0/T1 快车道不得被它拦截。
    - 用户通过总入口指定 `beginner-flow-guide` 并交给它“我不会走流程”“我现在该干嘛”“先帮我看看”时，显示真实 Markdown 渲染的新手导航卡，再做 micro preflight 或状态扫描；不要要求用户手输命令。
    - 用户显式点名 `vibe-coding-skills` 时打开当前对话入口闸门；用户直接写具体 Skill 名称但未打开总入口时，不自动加载该 Skill。用户明确关闭总入口后，闸门立即失效。
    - 首次接入或要求项目画像、宪法设计包、证据绑定入口时用 `target-constitution-setup`；已有宪法层且只刷新 / 检查 managed block 时用 `target-runtime-setup`。
    - 自动化测试、E2E、回归、测试覆盖、Playwright、Vitest、pytest、Detox 或 integration_test：只有总入口明确指定 `test-automation` 才走该 Skill。
    - 无测试语义的定时 / 办公 / 流程自动化交宿主自动化工具；无工具时说明缺口并给手动替代。
    - 核心热区 / 大文件 / 大组件等进 `hotspot-governor`，先诊断大文件 / 大测试 / runtime / token / schema / 大 diff / 重复 helper 并给拆分路线，不默认大重构。
    - codebase-memory / 代码地图 / 调用链 / 影响面：显式点名用 `codebase-memory-scout`；未点名只在 T2/T3 且跨模块、调用链 / 入口 / 影响面不明时启用；普通 T2、小改、中文治理、执行光标、人工验收和 Pencil `.pen` 不自动启用。
    - 默认语言使用中文，技术名词保留英文；只有高影响歧义才问，而且一次最多 1-3 个问题。

[执行强度]
     - 所有任务先判 `execution tier` 再独立算 `review profile`；前者定实施验证，后者定审查阶段 / 上下文边界 / finding 闭环；这里的“独立”是逻辑角色和输入边界独立，不等于独立进程、物理隔离或只读沙箱。
    - T0 `trivial`：低风险错字、注释、纯说明文字；直接改并列 diff 摘要，无需完整 review / doc-sync / 编译或读取完整的需求 / 计划真源。
    - T1 `light`：小范围 UI copy、样式、同一组件 / 容器内 visual-only 微调、低风险配置；微计划 + 定向验证，不跑 package / target health / check-ui-reuse，除非用户要求或触发门禁；对象和动作明确时强制留在 T1。
    - T2 `standard`：普通功能、组件、状态逻辑；短工程计划后，`split-self-review` 分开 Spec Compliance 与 Code Quality。跨至少 3 个模块、公共契约、Phase 完成、子 Agent 实现、需求变化、重复失败或其他高影响 T2 自动升为 `independent-two-stage`。
     - T3 `strict`：bug、安全、权限、数据、发布、Skill / Hook / Tool / Agent 路由变更；执行 strict loop：分类 -> 成功标准 -> 风险 / 影响面 -> 回归计划 -> RED-GREEN-REFACTOR -> fresh 验证 -> 独立双审 -> doc-sync -> finish checklist。独立双审默认是逻辑审查角色，不要求物理隔离。
    - T3+ `hazard mode` 是 T3 内部高风险子模式；命中 auth、permission、security、token、secret、payment、database、migration、data loss、filesystem、shell、network、eval、pre-commit、hook、agent routing、Skill / Hook / Tool 规则、release / deploy / publish、删除 / 重命名 / 迁移行为文件或影响面无法可靠判断时，先写 hazard task packet，并使用 `hazard-review`。
     - review profile 默认映射：T0=`none`、T1=`directed-check`、T2=`split-self-review`、T3=`independent-two-stage`、T3+=`hazard-review`。T0/T1 快车道不得因此加载完整 Spec、派 Reviewer Agent 或运行完整 health。任何 profile 都不默认要求物理隔离；物理只读 Reviewer 仅在用户明确要求时启用。
    - T2+ 分开 Spec Compliance 与 Code Quality；高影响任务 fresh 独立双审。Critical / Important 须 reverify 或用户 accepted-risk，Minor 须裁决；implementer DONE / 旧 snapshot 不是证据。细则见 `skills/code-review/references/review-profiles.md`。
    - `skills/`、`agents/`、`hooks/`、`codex-hooks/`、`tools/`、`settings.json`、`codex-hooks.json` 的源码变更默认 T3。
    - `AGENTS.md`、`.claude/CLAUDE.md` 和各模块 `INDEX.md` 是 protected source doc，默认至少 T2，不能当普通 typo 绕过门禁；规则口径、高影响或跨模块变更进入 strict review/doc-sync。

[前端页面设计主链路]
    - 默认主链路：`product-spec-builder -> design-brief-builder -> design-maker -> dev-planner / dev-builder`
    - 用户只说“前端页面设计”时，不误进营销设计场景。
    - 用户明确说 UI 债务、组件库初始化、补 token、补组件、统一样式或 `check-ui-reuse` 失败时，进入 `ui-system-guardian`。
    - 明确提配色、字体、tokens、design system、样式体系才用设计增强层；提 critique、audit、polish、布局、排版、打磨才用质量层；明确对象 / 动作的 UI 微调不升级。

[技术栈与验证]
    - 技术方向先识别 `platform profile + language adapter + architecture profile + scaffold policy + fallback stack`；详见 `docs/language-platform-profiles.md`。
    - 技术栈缺失时先扫描需求和工程痕迹；仍无法判断时只问一个关键问题，不静默套 Web / Node。
    - 内置脚手架仅一等支持 JS / TS Web、Desktop、Node CLI；Backend、Library、Mobile、非 Node CLI 沿用平台或既有结构。
    - 严格 TDD：除下条外，行为走 `RED-GREEN-REFACTOR`；无正确 RED 不得实现，GREEN 最小，REFACTOR 全绿后。
    - 原型 / 生成代码 / 配置文件仅事前获用户明确批准；难自动化 / 后补测试不豁免，须附 RED / GREEN / 回归。
    - visual-only T1 受控例外：边界已核对且无既有测试 / visual regression seam 时，留改前基线、改后同路径定向视觉证据和副作用检查；有 seam 或触及用户路径 / 信息层级 / 响应式 / 全局 token / theme / UI 包契约 / 真实业务行为，升级走 TDD。

[初始化]
    Codex 入口已加载；先理解请求，再按命中场景读 manifest、README、INDEX、具体 Skill 或真源；非恢复 / 继续 / 开发 / 审查时不自动加载整套持久化文档。
