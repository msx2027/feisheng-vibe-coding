---
name: doc-sync-guardian
description: '仅当用户先明确调用 `vibe-coding-skills` 总入口并指定 `doc-sync-guardian`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发；当代码、Skill、Hook、脚本、命令、目录结构或工作流规则发生变化，需要同步更新相关文档并阻止文...'
user-invocable: false
disable-model-invocation: true
---
[DocMap]
    层级：L3 / 关键 Skill
    模块：文档同步与防漂移
    依赖：
    - `DOC-MAP.md`
    - `TERMINOLOGY-AND-NAMING.md`
    - `Product-Spec.md`
    - `DEV-PLAN.md`
    - `skills/INDEX.md`
    - `hooks/INDEX.md`
    - `codex-hooks/INDEX.md`
    - `tools/INDEX.md`
    - `tools/init-target-task-context.mjs`
    - `tools/init-target-runtime.mjs`
    - `skills/code-review/references/review-profiles.md`
    输出：
    - 受影响文档面、同步动作、验证结果

[任务]
    **同步模式**：当代码或工作流刚改完，需要马上把 README、Product-Spec、DEV-PLAN、主控文档等同步更新时，分析影响面并直接补文档。

    **审计模式**：当怀疑“代码和文档已经漂了”时，先扫描行为层与文档层的缺口，再按影响优先级补文档。

[依赖检测]
    Skill 启动时第一步自动执行。

    必需：
    - 无硬性外部依赖

    可选：
    - `DOC-MAP.md` → 有则优先确认全局地图和模块入口是否需要更新
    - 目标项目需求文档 → 优先用 `.vibe-docs.json` 的 `productSpec`，新项目默认 `docs/需求文档.md`；legacy `Product-Spec.md` 只作为读取迁移输入
    - 目标项目开发计划 → 优先用 `.vibe-docs.json` 的 `devPlan`，新项目默认 `docs/项目治理/开发计划.md`；legacy `DEV-PLAN.md` 只作为读取迁移输入
    - 目标项目当前执行光标 → 优先用 `.vibe-docs.json` 的 `currentExecution`，新项目默认 `docs/plans/执行光标.md`
    - 目标项目人工验收记录 → 优先用 `.vibe-docs.json` 的 `manualAcceptance`，新项目默认 `docs/项目治理/验收记录.md`
    - 目标项目接口契约台账 → 优先用 `.vibe-docs.json` 的 `interfaceContracts`，新项目默认 `docs/接口契约.md`
    - 目标项目任务胶囊 → 优先用 `.vibe-docs.json.taskContext.currentTaskCapsule`；用于同步单任务需求摘录、实现计划、研究记录、阶段上下文 manifest
    - 目标项目 finding ledger / Review Receipt → 启用任务胶囊时优先使用当前 Task 的 `审查台账.md`；未启用时使用当前 Task / Phase 计划或审查报告的 `Finding Ledger` 章节
    - 目标项目会话记录 → 优先用 `.vibe-docs.json.taskContext.sessionJournal`，默认启用后为 `会话记录.md`；只作恢复/交接记录
    - 目标项目 runtime registry → `.vibe-runtime.json`；用于同步 `AGENTS.md` / `CLAUDE.md` managed block version 与 checksum
    - 目标项目设计令牌文档 → 优先用 `.vibe-docs.json` 的 `designLanguageTokens`，默认 `设计令牌.md`
    - 目标项目组件盘点文档 → 优先用 `.vibe-docs.json` 的 `componentInventory`，默认 `组件盘点.md`
    - 目标项目设计复审报告 → 优先用 `.vibe-docs.json` 的 `designReviewReport`，默认 `复审报告.md`
    - 目标项目 UI 治理报告 → 优先用 `.vibe-docs.json` 的 `uiGovernanceReport`，默认 `界面治理.md`
    - `README.md` / `docs/` / `plans/` → 用于同步使用说明、架构说明和补充设计
    - Git 工作区 → 有则优先根据 diff 判断影响面
    - 工程文件与源码目录 → 用于反查真实行为变化

    安装策略：
    - 本 Skill 不强依赖额外工具
    - 有 Git 则优先读 diff；没有 Git 时退化为直接扫描相关文件
    - 缺少可选文档时，不阻塞执行，但必须明确指出哪些持久化文件还不存在

[第一性原则]
    **目标项目上下文加载协议（优先级高于文档面 reference）**：存在 `.vibe-docs.json` 时先解析 schema v2、`documentIndex/documents/loadPolicy`，根据 Git diff / 用户点名范围计算受影响 role，再调用 `resolve-target-doc-context.mjs`；默认只读取 `documentIndex` 和受影响 role 的 selector，不遍历全部生命周期文档。never 默认禁止；只有用户明确要求迁移、归档或冷历史审计时，才可使用 `--allow-never --reason <具体理由>`，并在报告列出访问的冷文档。

    **索引与漂移收口**：同步后运行 `build-target-doc-index.mjs --write`、`check-target-doc-drift.mjs --quick --strict` 和 `check-lifecycle-doc-budget.mjs --strict`；无动作归档不得报告为已完成。`document-surfaces.md` 只生成候选 role，不授权全文读取。

    **影响驱动**：先判断“这次改动改变了什么行为”，再判断“哪些文档必须跟着变”。

    **源码优先**：只更新源码层文档和规则文件，不去手改 `.claude/`、`.agents/`、`.codex/` 镜像。

    **源头优先**：先补 Product-Spec、DEV-PLAN、AGENTS、CLAUDE 这类源头文档，再补 README、设计说明和使用说明。

    **目标项目文档解析原则**：同步用户目标项目时，先读 `.vibe-docs.json`，再按角色映射定位生命周期文档。
    - 新目标项目需求、设计、计划、执行光标、人工验收和 Phase 明细都必须写入四字中文 `.md`
    - 正文中出现的 `Product-Spec.md`、`DEV-PLAN.md`、`Design-Brief.md`、`plans/CURRENT-EXECUTION.md` 是 legacy 角色名；新目标项目必须解析到 `docs/需求文档.md`、`docs/项目治理/开发计划.md`、`docs/设计简报.md`、`docs/plans/执行光标.md`
    - 任务胶囊目录是可选的单任务上下文容器，不替代 `.vibe-docs.json`；不把不存在的 `会话记录.md` 或胶囊文件提前写入 manifest
    - 同步后运行 `node <skills仓库>/tools/check-target-doc-names.mjs <目标项目根目录> --require-existing`

    **术语源头优先**：新增或替换术语、口径、变量名映射时，先补 `TERMINOLOGY-AND-NAMING.md`、`Product-Spec.md` 和 `DEV-PLAN.md`，再补 Skill、README 和索引。

    **按 tier 同步**：T0 低风险错字、注释、纯说明文字不强制文档同步；T1 只在对外说明或低风险配置含义变化时同步；T2/T3 行为、需求、术语、工作流、Skill、Hook、Tool 规则变化必须同步。

    **审查协议同步**：execution tier、review profile、Reviewer 隔离、finding 状态或完成口径变化时，必须同步 `AGENTS.md`、`.claude/CLAUDE.md`、`code-review`、`dev-builder`、相关 Agent、Product-Spec / DEV-PLAN、README、索引、manifest 与镜像。finding ledger 和 Review Receipt 是持久化审查证据；hook snapshot 不等于 ledger、receipt 或完成证据，也不得覆盖未闭环 finding。

    **规格闭环同步**：需求澄清门、预实现一致性分析或交付收敛检查改变时，同步需求/计划模板、任务胶囊回执、`product-spec-builder` / `dev-planner` / `dev-builder` / `code-review`、相关 Agent、入口、README、索引、术语真源、测试注册、CI 与镜像；不得引入平行 spec / plan / task 真源。

    **最小闭环**：不追求一次生成完美文档，但必须做到“不能漏更、能恢复、能验证”。

    **联网优先**：涉及外部工具、框架命令或官方规则变化时先 WebSearch 确认再动手。

    **全项目 Markdown 治理**：命中 Markdown 新建、改写、移动、拆分、备份删除、分卷读取或 `markdownGovernance` 时，读取 `references/markdown-governance.md`；主流程只保留两条硬边界：检查器只报告不自动整理，迁移 / 删除必须有用户明确授权、无并发写入和可复核迁移证据。

[文件结构]
    ```
    doc-sync-guardian/
    ├── SKILL.md
    └── references/
        ├── document-surfaces.md
        └── markdown-governance.md
    ```

[按需加载 references]
    - `references/document-surfaces.md`：已确认需要同步 / 审计，需要把行为变化映射到具体持久化文档时读取。
    - `references/markdown-governance.md`：Markdown 治理、分卷、备份、链接、读取或迁移时读取；普通代码 / Skill 文档同步不加载。

[输出风格]
    **语态**：
    - 直接、像做变更影响分析，不像写宣传文案
    - 先说哪些行为变了，再说哪些文档要改，最后说验证结果

    **原则**：
    - × 不说“建议以后记得更新文档”这种空话
    - × 不把镜像目录当源码改
    - ✓ 明确列出受影响文档面
    - ✓ 明确说明哪些文档已经更新、哪些还缺
    - ✓ 更新后做最小必要验证

    **典型表达**：
    - "这不是单纯的代码修改，命令行为变了，README 和 AGENTS 必须一起补。"
    - "你改的是 Skill 路由，不补主控文档就是漂移。先同步 CLAUDE.md、AGENTS.md。"
    - "这次先把源头文档补齐；镜像目录等同步脚本生成。"

[同步策略]
    **第一步：识别行为变化**
    - 有 Git → 优先读取变更文件和 diff
    - 无 Git → 直接检查本次修改涉及的文件
    - 判断这次变更属于：T0 trivial、T1 light、T2 standard、T3 strict 中哪一类
    - 判断这次变更属于：功能行为、命令行为、目录结构、工作流规则、Skill 路由、门禁规则中的哪一类

    **第二步：映射文档面**
    - 读取 `references/document-surfaces.md`，只选择由当前 diff / 用户范围命中的 role；不要把候选清单当作全文读取授权。

    **第三步：按源头顺序更新**
    - 先更新 `DOC-MAP.md`、Product-Spec、DEV-PLAN 这类源头文档
    - 再更新对应模块 `INDEX.md`
    - 再更新面向用户或维护者的说明文档
    - 如改了 Skill、Hook、主控文档，最后运行同步脚本生成镜像
    - 如果只是 T0 低风险错字、注释、纯说明文字，明确记录“不需要文档同步”，不强制补无意义文档

    **第四步：验证**
    - 检查文档里提到的命令、文件路径、状态文件名是否真实存在
    - 检查 `.vibe-docs.json.manualAcceptance` 指向的文件是否存在；如果记录了 `用户已确认`，必须能看到用户明确确认范围和后续回归触发条件
    - 检查 `.vibe-docs.json.interfaceContracts` 指向的文件是否存在；如果本轮新增或修改 API route、typed client path、fetch wrapper、service/public entry、server action、IPC / event 或 schema，运行 `node tools/check-api-contracts.mjs .` 或目标项目等价脚本；目标项目配置 `interfaceContractScanner` 时，文档证据需覆盖 scanner roots、event / publicEntry pattern、raw network allowlist 与统一 client 复用边界
    - 检查启用的任务胶囊是否通过 `node <skills仓库>/tools/init-target-task-context.mjs <目标项目根目录> --check`
    - 检查 Critical / Important 是否为 `reverified` 或有用户明确 accepted-risk，Minor 是否已修复或明确裁决；检查 Review Receipt 的 diff 范围 / hash 与当前变更一致
    - 检查 target runtime managed block 是否通过 `node <skills仓库>/tools/init-target-runtime.mjs <目标项目根目录> --skills-root <skills仓库> --check`
    - 检查 UI / token / 组件变更是否同步目标项目设计令牌、组件盘点、复审报告、UI 治理报告和 UI 包 README；如执行 UI root 决策或迁移删除，确认已记录候选、取舍、unused 证明和 rollback；如目标项目有 `tools/check-ui-reuse.mjs` 或设计系统复用门禁，运行对应脚本
    - 如新增门禁或脚本，运行对应验证脚本
    - 如改了术语门禁顺序，确认口径为 `review -> minimal-quality -> structural -> terminology -> doc-sync`
    - 如本次改动涉及术语、口径、命名规则或一致性校验，运行 `bash ./tools/test-terminology-consistency.sh`
    - 记录本次已同步的文档面和残余限制

[信息充足度判断]
    只有当以下条件满足时，才算可以结束：

    必须满足：
    - 已识别本次行为变化来自哪些文件
    - 已明确至少一个应该更新的持久化文档
    - 已完成文档更新或明确指出缺失文档
    - 已执行最小必要验证

    尽量满足：
    - 给出“为什么改这些文档，不改那些文档”的依据
    - 如改了 Skill / Hook / 主控，完成兼容目录同步

[工作流程]
    [工作流程（同步模式）]
        第一步：加载改动证据
            - 有 Git 时读取 diff、staged files、最近改动文件
            - 无 Git 时读取用户点名的文件和相关文档

        第二步：做影响分析
            - 按 `references/document-surfaces.md` 映射必然受影响的文档
            - 明确哪些属于源头文档，哪些属于衍生说明

        第三步：更新文档
            - 先改源头文档
            - 再改 README / 专题说明
            - 不直接修改镜像目录

        第四步：执行验证
            - 运行相关脚本或最小 smoke test
            - 如改了 Skill、Hook 或主控文档，执行同步脚本

    [工作流程（审计模式）]
        第零步：文档体积预检
            - 目标项目存在 `.vibe-docs.json` 时，先运行 `build-target-doc-index.mjs --check`，再运行 `check-lifecycle-doc-budget.mjs <目标根目录> --strict`
            - 本分发包审计时，检查 `CLAUDE.md`、`AGENTS.md`、`DOC-MAP.md`、`README.md` 是否超出热路径合理体积（单文档 ~6k tokens 报警）
            - 有膨胀文档时：优先建议归档历史 Phase、已完成需求或老版本计划，而不是继续在同一文档里追加

        第一步：扫描行为层文件
            - 有 Git 时先读当前 diff；无 Git 时只读用户点名范围和直接依赖
            - 从改动证据建立受影响 role 清单，不做无边界全仓遍历

        第二步：扫描文档层文件
            - 调用 resolver 读取 `documentIndex` 与受影响 role 的 selector
            - 找出缺项、旧命令、旧路径、旧流程

        第三步：列出漂移清单
            - 哪些文档落后了
            - 每项漂移对应哪个真实文件变化

        第四步：补文档并验证
            - 优先补最上游源头文档
            - 再补用户可见说明
            - 运行最小必要验证

[初始化]
    执行 [依赖检测]
