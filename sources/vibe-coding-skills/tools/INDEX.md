# Tools Index

[DocMap]
    层级：L2 / 模块索引
    模块：tools
    依赖：
    - `DOC-MAP.md`
    - `AGENTS.md`
    - `README.md`
    输出：
    - 共享脚本职责
    - 同步、门禁、计划与脚手架入口

## 模块职责

`tools/` 保存这套包的共享脚本。
这里保留的是“会被工作流和技能正文实际用到”的脚本，不包含当前开发仓库的大量收口测试资产。

## 核心工具

| 文件 | 作用 |
| --- | --- |
| `sync-compat.ps1` | 同步源码到 `.claude/`、`.agents/`、`.codex/` 运行时镜像；从 `agents/*.md` 生成 `.codex/agents/*.toml`；拒绝源码或目标树 junction / reparse point，不复制 `agents/INDEX.md`；单文件、目录镜像文件和生成 TOML 使用目标同目录的有界 `.s-<PID>-<nonce>` / `.b-<PID>-<nonce>` 临时名 + replace / move，避免 hardlink 外写和 Windows 深路径膨胀；TOML parse 使用仓库外可信 Python、`-I` 与可信 cwd，stale 删除失败即中止 |
| `build-lite-package.mjs` | 构建 lite 分发包；先捕获 immutable Git index tree，再从该 tree 的 blob object 直接写入每个 payload，记录 object format、source blob、path / bytes / SHA / Git mode，并在前后拒绝 index 并发漂移；直接运行时镜像必须存在、无 stale 条目且与其真源拥有相同 index blob OID，运行时文本镜像固定为 LF；缺必需文件、untracked / unstaged 输入、输出 junction 或越界时 fail closed；使用可信 Git 生成 `/` 路径且保留 Unix executable mode 的 ZIP，并在返回前调用 verifier；过滤 `.rej/.orig` 等补丁残留；支持 `--no-zip`；支持 `--profile safe-lite\|pure`，默认 `safe-lite` 产出完整包，`pure` 额外剔除分发包自身的 6 份开发元文档（Product-Spec / Product-Spec-CHANGELOG / DEV-PLAN / DOC-MAP / TERMINOLOGY-AND-NAMING / EVOLUTION 及其 `.claude` 镜像），并由 verifier 拒绝运行时入口以有无 `.md` 后缀引用这些文档或 manifest / payload 回填这些文档，供全局安装、被外部新项目引用，未知 profile 值 fail closed |
| `verify-lite-package.mjs` | 验证 lite 目录与 ZIP：MANIFEST 精确集合、bytes、SHA-256、Git source blob、totals、必需 release inputs、regular / non-reparse 边界；高置信 secret / privacy / 个人绝对路径扫描覆盖 UTF-8、NUL 前缀 / binary ASCII strings、带 BOM 或高置信启发式的 UTF-16LE / BE，同时保留 placeholder username 降噪；ZIP 检查 duplicate / traversal / prefix / 内容 hash / Unix creator 与 0644/0755 mode |
| `safe-target-fs.mjs` | 目标项目共享安全文件系统层；校验项目相对路径和逐段 lexical / realpath containment，拒绝 NUL、drive-relative / ADS、Windows 设备名、尾随点 / 空格、symlink、junction 与非普通文件；提供安全建目录、临时文件 + fsync + rename 写入及 `expectedContent` CAS |
| `target-doc-manifest-schema.mjs` / `target-doc-manifest-core.mjs` | 目标项目文档治理共享 schema / core：定义 schema v2、required 与 collection role、authority、portable path、token / hash；内容 metadata 会先将 CRLF 或 CR 规范为 LF，避免 Git 换行策略造成 hash / token 伪漂移；校验顶层 mapping 与 `documents[]` 一致性，并通过 `allowLegacy` 保留 v1 migration warning 兼容 |
| `build-target-doc-index.mjs` | 构建或检查固定 `文档索引.md`：从 v2 `documents[]` 刷新 content hash、token 和 `<!-- vibe-section:id -->` metadata；`--check` 只报告 stale，`--write` 才写索引和 manifest；索引超 5,000 token、缺文件或大文档无 section index 时 fail |
| `auto-sync-target-doc-index.mjs` | Claude / Codex PostToolUse 的目标文档自动同步入口；仅当本次写入命中 `.vibe-docs.json.documents[]` 已登记路径时，事务刷新 manifest metadata 与 `文档索引.md`，不改正文、Git 暂存区或任务胶囊 `sourceRevision` |
| `check-target-doc-precommit.mjs` | 目标项目提交前文档门禁；检查工作树 index / drift，新暂存受管正文必须连同 `.vibe-docs.json` 和 `文档索引.md` 原子暂存，且受管范围不得残留未暂存修改；旧 `sourceRevision` 漂移继续硬失败 |
| `target-hook-config.mjs` | `setup-target-hooks.mjs` 的受管 Hook block 与 Claude / Codex 配置合并 helper；幂等合并 PostToolUse 文档同步和 UserPromptSubmit 显性纠错入口，只替换明确识别的受管项，保留其他配置与项目自定义逻辑，重复或非法配置时拒绝覆盖 |
| `resolve-target-doc-context.mjs` | 目标项目按需上下文 resolver：从 schema v2 manifest 仅选择 always / 显式 role / capsule selector，检查 source revision、section / lines / JSON pointer、maxTokens 和总预算；支持 `--document <角色>:<文件>` 精确读取集合成员；启用 `markdownGovernance` 后，`--markdown <项目相对路径>` 只读取请求正文及其直接门面，并只允许门面可见链接指向的正文；未链接正文与备份目录默认拒绝；onDemand 未申请不返回，never 默认拒绝，例外读取必须带理由；continuity.enabled 时先恢复 journal 再加载 manifest，固定返回 `taskHandoff -> taskState -> currentExecution -> taskKnowledge`，要求 `--capsule` 等于当前胶囊并校验 handoff revision |
| `markdown-governance-core.mjs` | 全项目 Markdown 分卷规则：缺少字段时按关闭兼容，新项目 bootstrap / 脚手架默认启用；启用后普通单文档最多 8,000 token，导航门面最多 3,000 token，门面必须以同名专属文件夹承载正文，可嵌套；正文须带全项目唯一 section、一级标题、反向链接和人读短编号文件名，机器编号只留在标记与索引；链接只认 fenced code、任意长度反引号 inline code span 与 HTML comment 之外的可见 Markdown，被反斜杠转义的反引号仍按可见正文处理；跳过精确的 `.claude/worktrees`、`.codex/worktrees`、`worktree/.claude`、`worktree/.codex` 隔离副本，但普通同名目录仍治理；检查项目内失效链接；`archiveDirectories` 中的备份不纳入日常治理，删备份或移出项目后必须同步删登记和旧链接；不按创建者或生命周期角色区分 |
| `check-markdown-governance.mjs` | 扫描目标项目全部 Markdown（跳过 Git、依赖、构建产物和 Claude / Codex 运行时隔离 worktree）：检查超限正文、未声明的同名分卷、门面大小、同名专属目录、目录链接、失效的项目内 Markdown 链接、中文短编号、重复正文编号和标题；只报告，绝不移动、拆分或合并用户内容；`--force` 可对尚未启用的老项目做全量体检 |
| `target-doc-transaction.mjs` / `target-doc-migration-helpers.mjs` | 文档状态、迁移和归档共享事务 / helper：使用 expected-content CAS、journal、rollback / recover；continuity planner 对未计划 source 保存 expectedContent，并在 journal 前置阶段校验晚到修改；支持删除型 rollback operation 与跨两轮 phased transaction，第二轮规划或提交失败时仅在文件仍等于上一轮受控值时恢复到第一轮前，并发外部编辑触发 rollback conflict 且不被覆盖；复用 manifest core 而不维护第二套 schema 常量 |
| `trusted-git.mjs` | 目标扫描器与发布工具共享的可信 executable 层；从绝对 override / 系统候选 / 绝对 PATH 解析 Git 与 PowerShell，执行 lexical + realpath 双 containment、可信 cwd、`shell:false`；Git 固定禁用 pager / `core.fsmonitor`，diff 禁用 external diff / textconv，并提供 Buffer / NUL 路径解析辅助 |
| `setup-repo.ps1` / `setup-repo.sh` | 首次初始化：同步镜像；若当前目录已是 Git 仓库、有 baseline commit 且已提供 `bash`，则继续安装 repo 级 Git hooks |
| `install-git-hooks.ps1` / `install-git-hooks.sh` | 单独安装 `.githooks/pre-commit`；要求当前目录已是 Git 仓库、已有 baseline commit，且系统里可用 `bash` |
| `plan-hygiene.ps1` / `plan-hygiene.sh` | 评估 `DEV-PLAN.md` / `plans/` 是否需要整理 |
| `plan-state.ps1` / `plan-state.sh` | 查看或更新当前执行光标 |
| `plan-resume.ps1` / `plan-resume.sh` | 辅助恢复当前执行光标 |
| `current-execution-template-helpers.ps1` | `CURRENT-EXECUTION` 相关共享辅助 |
| `render-project-scaffold.sh` | 渲染现有 JS / TS 一等脚手架模板，覆盖 Web / Desktop / Node CLI，并复制目标项目 health / guardrail / constitution / runtime / task-context / interface / UI 工具、完整文档治理链（manifest schema/core、index、resolver、budget、transaction、state、drift、migration、archive）、经验治理链（anchor、ledger、managed blocks）与任务连续性 core，以及 `trusted-git.mjs`、`safe-target-fs.mjs`；模板名使用 allowlist，项目名 / 标题按 JS、template literal、HTML / JSX、Markdown 上下文编码；四类模板携带 exact direct dependencies 与 lock template，runtime 安装验证使用 `npm ci --ignore-scripts`；不是所有平台的默认生成器 |
| `init-target-constitution.mjs` | 目标项目宪法生成器；基于只读证据包生成或更新 `docs/项目治理/项目画像.md`、`docs/项目治理/宪法设计.md`，其中项目根目录固定记为相对 `.`、Skills root 固定记为可迁移的 `<skills-root>`，不把本机绝对路径写进分发文档；缺 manifest 时 bootstrap schema v2、8 个必需角色和根目录 `文档索引.md`，其他生命周期文档按职责生成到 `docs/`；已有 manifest / 根目录旧文档保留路径，不静默迁移；v2 项目保留 required mapping / metadata 契约；checksum 可验证的旧 basename marker 会升级为 canonical 项目相对路径，其他 ownership/checksum 冲突继续 fail closed；受管 I/O 使用 `safe-target-fs.mjs` 与共享 transaction 做 linked / non-regular 拒绝、原子写和 `expectedContent` CAS；bootstrap 的首次写入与稳定化处于同一 phased rollback 边界，第二轮失败会恢复操作前状态；支持 dry-run / write / check、写后幂等与 checksum 冲突检测 |
| `init-target-runtime.mjs` | 目标项目 runtime 入口写入器；维护 `AGENTS.md` / `CLAUDE.md` 短硬 managed block 与 `.vibe-runtime.json`；managed block 同时分发 strict TDD、visual-only T1 受控例外与 review closeout（T2 双阶段、独立双审、finding / DONE / Phase 闭环），并要求 Git 提交标题和正文使用中文；block 版本号见 `BLOCK_VERSION` 常量；受管 I/O 使用安全路径、原子写与 CAS，支持 dry-run / write / check / upgrade 和 checksum 冲突检测 |
| `setup-target-hooks.mjs` | 安装 Claude / Codex 受管文档 PostToolUse 自动同步 Hook、UserPromptSubmit 显性纠错检测 Hook，并更新目标项目 `.githooks/pre-commit`；纠错 wrapper 调用当前 Skills root 的统一 Node 信号入口，不复制平行算法；pre-commit 通过安装时解析的可信 Git 获取当前 worktree 根目录，因此 Git linked worktree 提交只校验自身文件和暂存内容，且不信任运行时 PATH 的 Git；提交前依次校验 runtime、受管文档 freshness / 原子暂存和 `check-hotspots --strict --staged`。`--runtime-hooks-only` 只事务更新 runtime Hook/配置，不复制热点工具、不写 pre-commit、不改 `core.hooksPath`，用于保留项目自定义门禁。`--precommit-only` 只刷新受管 `.githooks/pre-commit` 标记区并设置 `core.hooksPath=.githooks`，不改项目 `tools/` 与 Claude / Codex runtime Hook/配置；新 managed block 只替换标记区并保留区外项目自定义逻辑。旧式混合 Hook、重复受管项或非法配置 fail closed |
| `init-target-task-context.mjs` | 目标项目任务胶囊工具；slug 规范化后最多 80 个 ASCII 字符；安全创建胶囊、`任务状态.json`、JSONL selector / sourceRevision / maxTokens 与 session journal，最后才提交 `.vibe-docs.json` manifest；v2 会登记当前 state / context metadata，旧 state 转 historical archive，失败不发布不存在的 current capsule；continuity 入口先恢复 continuity journal 再读取 manifest；支持 dry-run / write / check / json；`--continuity-mode t2\|t3\|cross-session\|long-task --write` 首次启用或刷新当前胶囊，切换任务在 V1 中拒绝 |
| `update-target-task-state.mjs` | 唯一任务状态写入器：需要显式 `--write`，以 expected revision / CAS journal 更新当前胶囊 `任务状态.json`、执行光标前 10 行投影和 manifest metadata；不允许从执行光标反写状态；所有状态分支都区分未传与显式空值并校验 `--blocker` / `--done-when` 的 UTF-8 2000 bytes 上限，continuity 模式再同步 `任务交接.md` |
| `update-target-task-knowledge.mjs` | continuity V1 的确认状态写入器：要求显式 `--expected-revision`、证据数组和 sourceRevision/CAS 校验，原子更新 `确认状态.json`、`任务交接.md`、metadata 与索引 |
| `generate-target-task-handoff.mjs` | continuity V1 的确定性交接单投影工具；支持 dry-run / write / check，source evidence 过期时只报告失败，不自动改写引用正文 |
| `target-task-continuity-core.mjs` | continuity V1 共享 planner / renderer / resolver 核心；复用现有任务胶囊、manifest、CAS、事务和恢复，不实现全工具审计、过程 JSONL Hook 或全局状态 |
| `check-project-structure.sh` | 检查项目目录结构是否符合默认策略 |
| `vibe-health-check.mjs` | 一键体检入口；按 `package / target / auto` profile 和 `micro / quick / full` level 检查本包或目标项目健康状态。target v2 quick / full 运行 index freshness、drift 和 hard budget，legacy v1 只给 migration warning；`micro` 只做项目标记、manifest、package scripts 和必要文件存在性检查。target quick 继续覆盖文档命名、guardrail、runtime registry、接口契约、热区和 UI 复用；package quick/full 覆盖本包技术栈 Profile、skills/hooks/codex-hooks/agents 镜像同步等门禁。默认只执行可信分发包中的 checker，也不运行目标项目 `package.json` 脚本；只有显式传入 `--trust-target-tools` 才执行目标仓库自带工具与 full scripts。Windows Git Bash 只从可核验的 Git for Windows `cmd`、`bin`、`usr/bin` 或 `mingw64/bin` 布局解析，不执行任意 PATH 中的 `bash.exe`。它是 Agent / CI / 高级用户入口，不要求小白手输命令 |
| `check-target-doc-names.mjs` | 校验目标项目 `.vibe-docs.json` 中登记的生命周期 `.md` 文档名是否为四字中文；v2 同时复用 manifest core 验证 required mapping / `documents[]` 一致性，legacy 仅迁移兼容；仅允许 `archiveIndex` 使用 `docs/99-归档/索引.md` 作为非生命周期归档入口 |
| `check-target-constitution.mjs` | 目标 runtime 宪法体检；接入前只读收集 evidence、owner map、未验证 gaps、project profile、clause map、stop conditions、真实验证命令和反浅改 findings，支持根目录与 `apps/*/src` / `packages/*/src` 的 backend 证据，默认排除 `.agents/.claude/.codex`、`.ddzj`、任意含 `.git` marker 的嵌套仓库、`build/target` 等运行态/构建目录和 `*.sqlite*` 数据，只把独立占位行视为 TODO / TBD，避免把旁路/生成物或缺 API / schema / auth / deploy 证据的能力写成已完成 |
| `check-target-guardrails.mjs` | 目标项目治理文档 guardrail；检查 manifest、四字中文文档、角色映射、关键标题、占位符、漂移词和疑似隐私文件名；v2 使用 `documents[]` 覆盖非 archive Markdown，legacy 保持兼容。root、manifest 与 mapped doc 必须为 root 内 regular non-linked input，root unsafe 时立即返回，不越界枚举；tracked 敏感运行态文件仍预警，Git scan 不可用时 warning / strict fail |
| `check-lifecycle-doc-budget.mjs` | 估算 v2 manifest 的 always / onDemand / never、collection role、当前任务胶囊和会话文档的 token 体积；always 最多 12,000 token，单文档超过 20,000 token 而无新鲜 section index 报 `index_required`，超过 50,000 token 报 `archive_required`，文档索引上限 5,000 token；legacy 仅给 migration warning，`externalStandaloneGameFolder` 不读取、不纳入预算 |
| `check-target-doc-drift.mjs` | 目标项目文档 drift 门禁：micro 检查 manifest / task state，quick 继续检查当前 capsule selector，full 才枚举 marked orphan、未分类四字文档和未登记 archive；启用 Markdown 治理时 full 同步检查全部 Markdown 分卷结构；v2 strict 对错误阻断，legacy v1 只保留 migration warning |
| `migrate-target-doc-system.mjs` | 显式 v1 / legacy 生命周期治理迁移器：默认 dry-run，只有 `--write` 通过 transaction journal / CAS 写入，`--recover` 恢复未完成事务；补 v2 metadata、section markers、document index 与 state projection，但不重命名、移动或删除用户既有文档 |
| `archive-lifecycle-docs.mjs` | 归档目标项目生命周期文档的历史内容；支持 dry-run / write / recover，使用 transaction journal；新增 archive 采用 `需求一卷.md` / `计划一卷.md` 等四字中文卷名，注册 archive authority、collection mapping 和 never policy，而不是修改用户既有文档路径 |
| `check-api-contracts.mjs` | 接口契约门禁；校验 `接口契约.md`、重复业务能力入口、未登记 API route / typed client path；默认覆盖 Next.js `app/api` 与字面量 `/api` fetch，配置后覆盖 server route、event / publicEntry / IPC 和正式前端 raw network gate；manifest、mapped doc 与 source tree 遇到 symlink / junction / non-regular input 时 fail closed，不静默跳过 linked source |
| `check-ui-reuse.mjs` | UI / token / 组件复用门禁；检查页面层是否绕过 UI 包、token 和组件体系；圆角与阴影按「剔掉注释与 `var(...)` 后残值是否仍有带单位长度或裸颜色」判定硬编码，重置关键字与 `var` fallback 放行、跨行声明合并后再判；staged 模式使用可信 Git + `-z` 解析特殊路径，all / staged 扫描都拒绝 symlink、junction 和非 regular 文件 |
| `check-hotspots.mjs` / `hotspot-policy.mjs` / `hotspot-git.mjs` | 核心热区扫描器、阈值 / 排除策略真源与 staged Git 读取层；文件级扫描覆盖已声明的 TypeScript / Node、Python、Go、Rust、Java / Kotlin、C# / .NET、PHP、Ruby、Swift、Dart adapter，函数与 React 组件分析仍限 JS / TS；全量模式诊断大文件、大测试、runtime/action、token/schema/config、超大目录、重复 helper 和超大 diff；`--strict --staged` 从 Git index blob 读取真实待提交内容，对生产文件 300 / React 组件 180 / 函数与 class method 100 / 测试文件 800 行执行历史只减不增门禁，并排除生成目录、vendor、字体资源和 minified 产物 |
| `generate-routing-manifest.mjs` | 从 `skills/*/SKILL.md` 与 `skills/INDEX.md` 生成确定性的 compact v3 `skills/ROUTING-MANIFEST.json`，记录 `routeHint/routeHints`、`invocation` 和当前对话 `activation`（`conversation-explicit` / `conversation-gated` / `structured-event`），供唯一总入口查找 Skill |
| `check-routing-manifest.mjs` | 校验或用 `--write` 刷新 compact v3 `skills/ROUTING-MANIFEST.json`，检查 LF-canonical manifest freshness、唯一用户入口、invocation、activation、Skill frontmatter 和源码 reference 路径 |
| `routing-session-gate.mjs` | 零依赖校验并持久化当前 session 是否由用户显式打开 `vibe-coding-skills`；拒绝未激活自然语言、助手文本伪激活、关闭后的路由和非 structured-event 的 event-only 调用 |
| `check-runtime-link-provenance.mjs` | 校验 Claude / Codex / Agents 外部 runtime link 是否解析到当前包入口，并输出入口 SHA-256；部署后用于防止 Junction 指向旧包 |
| `check-release-source-provenance.mjs` | 按 MANIFEST 文件 SHA-256 将 release 与选定源码工作树逐项比对；允许源码保持 dirty，但不允许发行物内容落后于选定源码 |
| `architecture-foundation-policy.mjs` | 开工前架构地基的纯触发策略；统一判定新项目、高影响变更与 T0/T1 / 单模块普通功能排除，供 Skill 与回归测试复用 |
| `experience-ledger-core.mjs` | 目标项目经验治理台账（`经验治理.md`）算账内核；纯函数零依赖，负责解析顶部 ```json 真源、静默 +1、达阀值判定、升档归零轨迹保留、真源→人类正文投影重渲；v2 exact validator 强制 transition 从 L0 逐档连续、active 最终 tier 一致、archived retirement 收口，并拒绝 Unicode default-ignorable 伪装与非 canonical 升档/退役文本；供 `experience-elevator` Skill 与 `check-experience-ledger.mjs` 复用 |
| `check-experience-ledger.mjs` | 经验治理台账体检器；校验真源合法性（字段 / 档位 / count / id 唯一）与真源↔正文投影一致，达阀值未升档仅告警不阻断；manifest 已启用却缺台账时 fail closed，只有未启用时才 SKIP；只报告不修改 |
| `detect-experience-signal.mjs` | Claude / Codex Hook 共用的零依赖显性纠错信号入口；生成稳定 `eventId` 与 prompt hash，不保存原始 prompt；单 scope 直接记录，多 scope 只返回提议并等待确认 |
| `experience-anchor-contract.mjs` | L0 `l1RegistryAnchor` 的独立 canonical 契约；固定 L1 registry block identity/version，校验项目相对 path 与 sourceHash，并区分 missing/null adoption 与伪 anchor conflict |
| `experience-managed-blocks.mjs` | 目标项目经验规则受管块内核；维护 `宪法设计.md` 的 L1 `target-experience-registry` 与 `AGENTS.md` / `CLAUDE.md` 的 L2 `target-experience-projection`，提供 checksum、`sourceHash` / `outputHash`、registration 可执行 surface allowlist 和路径安全检查；L1 registry 在 `JSON.parse` 前拒绝每层 object raw duplicate key，解析后共用 exact validator，固定 schemaVersion、root/rule keys 与 `candidate / active` status 枚举 |
| `experience-governance.mjs` | 目标项目经验治理统一编排器；以 `docs/项目治理/经验治理.md` ledger revision 与 L0 anchor 为前置条件，在单次原子事务内执行计数、升档、退役、L1/L2 投影和 L3 checker 注册校验；command token 保留 quoted provenance，workflow 只认 ASCII space 且无 C0/C1 控制字符的 canonical YAML block subset 内唯一 `jobs.<job>.steps[*].run` inline/exact literal command，`- run:` 与 mapping 冒号分隔、quoted/unquoted/escaped 等价重复 key、URL/scalar、folded/畸形 header、非 step `run` 和非 canonical shell operator 均 fail closed；既有缺/null anchor 仅通过显式 `adopt-anchor` 接入 |
| `check-global-skill-overlap.ps1` | 只读诊断项目 Skill 与全局 `$CODEX_HOME/skills`（未设置时为当前用户目录下 `.codex/skills`）的同名与哈希差异；不修改或禁用全局 Skill |
| `check-skill-token-budget.mjs` | 只读诊断 `skills/*/SKILL.md` 粗估 token 预算、router 超限和 reference 导航误导；支持 `references/` 默认目录与 `reference/` 历史兼容目录，`--strict` 可作为硬门禁 |
| `doc-sync-helpers.sh` | review / terminology / doc-sync 的兼容聚合入口；按固定顺序加载拆分后的 path / doc / tier / state helpers |
| `doc-sync-path-helpers.sh` | 仓库路径标准化、生成目录 / 低信号路径 / protected source doc / 模块索引分类 |
| `doc-sync-doc-helpers.sh` | source path 到相关持久化文档的映射，以及 strict doc-sync coverage 判定所需 pattern |
| `doc-sync-tier-helpers.sh` | behavior source change、execution tier、hazard signal 与 staged / unstaged / untracked diff 风险分类 |
| `doc-sync-state-helpers.sh` | review / T2 check snapshot、current change record、doc coverage 与状态文件读写辅助 |
| `review-gate.sh` | review gate；strict source changes 要求 review snapshot 匹配当前 staged diff 内容，普通 T2 staged source changes 可用 T2 check snapshot 放行 |
| `mark-review-clean.sh` | 双阶段审查完成后写入 `clean` 状态 |
| `mark-t2-check-clean.mjs` | 普通 T2 完成定向验证与 split-self-review 后，以 `evidence -> snapshot -> clean marker` 顺序写状态；snapshot 不保存 finding ledger / Review Receipt，也不覆盖未闭环 finding |
| `minimal-quality-gate.sh` | 最小质量 gate |
| `structural-gate.sh` | 结构门禁入口 |
| `structural-lint.mjs` | 结构门禁扫描器；staged 文件使用可信 Git + `-z` 解析，源码遍历拒绝 symlink、junction 和非 regular 文件 |
| `check-terminology-consistency.sh` | 术语一致性校验；staged 模式把每个已暂存输入物化为 Git index blob，绝不以干净 worktree overlay 替代真实 staged 内容；扫描禁用别名时排除 Product Spec 注册表、DEV-PLAN 变更清单和 `TERMINOLOGY-AND-NAMING.md` 的“默认术语表”自身行，避免把登记数据误报成泄漏 |
| `terminology-path-helpers.sh` | 术语门禁共享的稳定路径标准化、`.gitattributes` / `.editorconfig` 文本契约解析与 glob 匹配辅助 |
| `terminology-content-helpers.sh` | 术语门禁共享的 staged index 内容物化、临时根清理与 repo/staged 内容路径解析辅助 |
| `terminology-gate.sh` | 术语门禁入口 |
| `doc-sync-gate.sh` | 文档同步 gate；只拦未被相关文档覆盖的 strict source changes，普通 T2 不强制 doc-sync |
| `pre-commit-gate.sh` | 共享 pre-commit 总入口 |

## 保留的验证脚本

这些验证脚本被 README、索引或技能正文直接引用，因此继续保留：

| 文件 | 作用 |
| --- | --- |
| `test-runtime-project-scaffold.sh` | 高成本脚手架 runtime 验证；基于模板 lockfile 使用 `npm ci --ignore-scripts` 安装，不允许回退到浮动依赖的 `npm install` |
| `test-golden-path-examples.sh` | Web / Desktop / CLI golden path 样板 install、health、build、test / smoke 验证；Linux Electron smoke 前配置 `chrome-sandbox` 的 root 属主与 `4755` 权限 |
| `test-experience-governance-closure.mjs` | 经验治理闭环回归；覆盖 Claude/Codex wrapper 与跨平台 PowerShell（`pwsh` / `powershell`）调用，由 Windows CI job 执行 |
| `test-golden-path-real-code.mjs` | 真实 Web TSX/Vite 编译失败注入、Electron 主进程 / BrowserWindow / preload smoke 与锁定运行时契约验证；源码树复制使用逐文件路径，兼容 Windows 真实运行 |
| `test-scaffold-lockfiles.sh` | 四类脚手架 exact dependency 与 `package-lock.json.template` 一致性测试；验证渲染后 lockfile 无占位符，并约束 runtime smoke 使用 `npm ci --ignore-scripts` |
| `test-render-project-scaffold-security.sh` | 脚手架 template allowlist、控制字符拒绝，以及 JS / template literal / HTML / JSX 上下文编码与注入防护回归 |
| `test-path-security.mjs` | 生命周期预算 / 归档路径逃逸、绝对路径、数值参数、预检与原子归档回归，并验证 Brand 子进程不经 shell 传参 |
| `test-ui-reuse.mjs` | UI 复用门禁临时视觉属性判据回归；覆盖 token 写法放行、裸值拦截、注释掩护、单条声明混合裸值、重置关键字、`var` fallback、跨行声明合并与 `allow-next-line` 豁免不错位 |
| `test-build-lite-package.mjs` | lite 必需输入、untracked / unstaged fail-closed、output junction、DB WAL 与 `.rej/.orig` 补丁残留排除、NUL / UTF-16LE / UTF-16BE secret 与个人路径、binary 误报控制、manifest tamper、immutable source index blob provenance 与构建期间 index drift、ZIP portable path 与 Unix mode、POSIX CI 的 executable hook 工作区 / Git index mode 一致性及 Windows Git `core.filemode=false` 夹具语义、`--profile pure` 的运行时入口可达性（含无 `.md` 后缀引用和 manifest / payload 回填）、开发元文档与 EVOLUTION 镜像剔除 / 默认 safe-lite 保留 / 未知 profile 拒绝回归 |
| `test-trusted-executables.mjs` | 统一可信 Git / PowerShell、目标内伪造 executable、PATH junction、中文 staged 路径、scanner symlink、release executable 劫持，以及 POSIX executable hook 工作区 / Git index mode 一致性与 Windows Git `core.filemode=false` 夹具语义回归 |
| `test-codex-hook-git-trust.ps1` | Codex Hook bootstrap 与 PowerShell runtime 的 fake Git/Bash 回归；覆盖目标仓库内、仓库外普通 PATH、PATH junction、Git config fsmonitor、最近 `.git` 祖先 runner 分发和可信 Git 保持可用 |
| `test-sync-compat-safety.ps1` | runtime sync reparse 拒绝、可信 Python、stale 删除、单文件 / 目录镜像 / 生成 TOML hardlink 外写防护、Windows legacy 深路径边界，以及 Agent INDEX 排除回归 |
| `test-minimal-quality-gate.sh` | 最小质量门禁只使用项目本地 TypeScript compiler、缺失时 fail closed 且不调用 `npx` 下载依赖的回归 |
| `test-vibe-health-check.mjs` | health 默认不执行目标仓库自带 checker / scripts、外部 package profile 防伪、shell-free 子进程、层级单调、镜像字节一致性、正式分发输入与 hung child timeout 回归；Windows 额外覆盖 Git Bash 布局识别和伪造 PATH Bash 拒绝；`VIBE_HEALTH_COMMAND_TIMEOUT_MS` 只用于显式覆盖单子进程边界，默认 300,000ms |
| `test-target-doc-governance.mjs` | v2 manifest / documents metadata、document index、resolver、always / onDemand / never、selector freshness、collection role、task capsule、生命周期预算和全项目 Markdown 分卷检索的 fixture 回归 |
| `test-target-doc-migration.mjs` | task-state 唯一真源、执行光标投影、drift 分层、legacy dry-run / write / recover、四字 archive 分卷、CAS / rollback 的 fixture 回归 |
| `test-target-task-context.mjs` | 任务胶囊 fixture；覆盖 disabled 默认值、按需创建、journal、JSON / JSONL、路径逃逸、缺失 required、linked parent、超长 slug 拒绝和 manifest-last 事务顺序 |
| `test-target-task-continuity.mjs` | continuity V1 定向回归；覆盖 hash canonicalization、事务中途 rollback、首次启用/刷新/切换、dry-run、路径冲突、知识 CAS/evidence、状态联动、handoff header 和四角色 resolver |
| `test-target-runtime.mjs` | 目标项目 runtime 入口接入 fixture；覆盖 strict TDD + visual-only T1 受控例外 + review closeout、dry-run、写入、幂等、保留用户内容、checksum conflict、无效 skills root、package root 拒绝、`.vibe-runtime.json` 生成 / 漂移检测和 `.vibe-docs.json` 命名校验不受影响 |
| `test-target-constitution.mjs` | 目标 runtime 宪法体检与生成器 fixture 测试；覆盖富证据和 monorepo backend strict 通过、缺能力项目标记 `未验证`、说明性 TODO 不误报、画像 / 设计文档生成、表格格式化兼容、manifest 安全合并、四字中文命名、用户内容保留、checksum 冲突、浅改入口 warning 和无效 skills root blocker |
| `test-target-lifecycle-path-contract.mjs` | 新目标项目生命周期路径契约；禁止规则、模板和工具缺省值回落到根 `plans/...`，并保留本分发包与 legacy 项目的兼容边界 |
| `test-design-brief-source-contract.mjs` | 设计简报唯一真源契约；禁止根 `.impeccable.md` 和根 `设计简报.md`，并要求关键消费者先从 `.vibe-docs.json.designBrief` 解析 |
| `test-agent-tool-source-contract.mjs` | Agent 与工具入口契约；固定 `AGENTS.md` / `.claude/CLAUDE.md` 双真入口，并要求 target setup 使用带引号的绝对 skills-root 工具路径 |
| `test-target-guardrails.mjs` | guardrail fixture；覆盖 good / warning / blocker、strict、运行态 / tracked privacy、Git 不可用 / fake Git、non-regular manifest、mapped junction 和 linked root 入口 fail-closed |
| `test-execution-tier-gates.sh` | execution tier、review gate、doc-sync gate 分级验证；Codex PowerShell hook JSON 经 UTF-8 payload/config bridge 传递，避免 `-File` 参数改写导致假阳性 |
| `test-api-contracts.mjs` | 接口契约门禁跨平台验证；覆盖 route / client / event / public entry / raw network 正反例及 linked source root fail-closed；Windows 无 Bash 时首选 |
| `test-api-contracts.sh` | 接口契约门禁 Bash 兼容包装；内部调用 `test-api-contracts.mjs` |
| `test-hotspots.mjs` | 核心热区扫描器跨平台验证；覆盖生产文件 300、组件 180、函数 100、测试文件 800、历史只减不增、生成资源排除、目录热区、重复 helper、Shell / PowerShell、大小写扩展名、regex literal、rename、可信 Git、JSON 输出和 strict staged 失败 |
| `test-hotspot-governor-behavior.mjs` | `hotspot-governor` 行为验收；检查防误用边界、报告模板、典型输入样例和镜像目录过滤口径 |
| `test-hotspot-governor-human-scenarios.mjs` | `hotspot-governor` 真人话术场景验收；用临时项目和独立 golden fixture 模拟“看不懂 / 别往这里塞 / 大组件 / 大测试 / schema 太大 / 开始按方案拆”等输入并校验结论、路由和禁止行为 |
| `test-structural-gate.sh` | 结构门禁验证 |
| `test-terminology-consistency.sh` | 术语一致性验证 |
| `test-terminology-gate.sh` | 术语门禁验证 |
| `test-target-doc-names.sh` | 目标项目生命周期 `.md` 四字中文命名校验器测试 |
| `test-skill-token-budget.mjs` | Skill token 预算脚本 fixture 测试；覆盖通用 references 句子、缺失具体路径、无 references 策略和 `reference/` 单数兼容 |
| `test-routing-manifest.mjs` | 路由 manifest fixture 测试；覆盖 v3 `triggers[]`、`manualOnly`、缺失 / 损坏 manifest、缺 frontmatter 和 reference 路径 |
| `test-routing-keywords.mjs` | 路由关键词回归测试；覆盖中文 alias、`shape` 手动专用、测试自动化反例、自然话压力 fixture、快车道风险词和设计质量层边界 |
| `test-external-skill-boundaries.mjs` | 外部强规划 Skill 边界回归测试；覆盖 `superpowers:brainstorming` 显式点名、已批准计划、bug、测试自动化和 T0/T1 快车道分流 |
| `test-review-policy.mjs` | review profile 策略门禁；执行 execution tier 默认映射与高影响 T2 升级、T2 双阶段、独立 Reviewer 合同、带 resolution / invalidation evidence 的 finding 状态机、Review Receipt、Phase ledger、双运行时入口与 health / CI 接线 |
| `test-spec-driven-gates.mjs` | 原生规格闭环门回归；验证需求澄清门、T2/T3 预实现一致性分析、交付收敛检查、任务胶囊回执、`clarify` 边界、入口文档、package health 与 CI 接线 |
| `test-architecture-foundation.mjs` | 开工前架构地基回归；执行新项目、高影响变更与 T0/T1 / 单模块普通功能的正反场景，并验证 Skill、主链路 PASS 门禁、路由索引、入口、真源文档、package health 与 CI 接线 |
| `test-strict-tdd-policy.mjs` | 严格 TDD 策略门禁；检查入口、需求、计划、实现、修 bug、测试与 review 规则统一为 RED-GREEN-REFACTOR，拒绝遗留的先实现后验证口径，并确认 package health / CI 已纳入门禁 |
| `test-strict-tdd-human-scenarios.mjs` | review × strict TDD 机器策略情境门禁；从 `review-policy-json` 与 TDD 边界计算已有 seam / 无 seam visual-only T1、越界重分级、普通 T2、子 Agent T2、Phase、未复审 Important 与无 RED 场景，并验证仓库外目标 runtime 入口及临时目录清理；不把 fixture receipt 冒充 live Agent |

## CI 硬门禁

GitHub Actions 入口是 `.github/workflows/vibe-quality.yml`，默认分为：

- `package-health`：`node --check tools/*.mjs`、Skill token strict 预算与 `vibe-health-check --profile package --level quick --strict`，覆盖路由 manifest freshness、技术栈 Profile 决策文档、必备章节、核心术语与旧式 CLI 泛称漂移
- `lite-package`：构建并自验完整 ZIP，在 Ubuntu 解压后验证 `.githooks/pre-commit` executable mode、运行 `setup-repo.sh`、再次验证目录与 package quick strict health
- `gate-tests`：任务胶囊、原生规格闭环门、target document governance / migration、目标 runtime 接入、宪法体检、目标 guardrail、目标文档命名、接口契约、execution tier、结构、术语和 doc-sync 相关 gate
- `python-tests`：Python 3.12 compileall 与 pytest
- `runtime-scaffolds`：四模板 package-lock-only refresh 哈希稳定、`npm audit` 0 和 Next / Vite / Electron / CLI runtime smoke
- `golden-path-examples`：`examples/golden-path/` 三类迷你样板
- `windows-sync-check`：Windows 上先用 Git Bash 运行 runtime scaffold 与 golden path，再运行跨运行时 PowerShell 测试、`sync-compat.ps1` 并检查 `.claude/`、`.agents/`、`.codex/` 没有 diff 或 untracked 镜像漂移；Ubuntu `gate-tests` 不执行依赖 PowerShell 的经验治理闭环测试

## 提交前门禁顺序

共享 `pre-commit` 顺序固定为：

`review -> 最小质量 -> 结构门禁 -> 术语门禁 -> 文档同步`

其中 gate artifact 按级别分流：T0/T1 不阻塞；普通 T2 在 split-self-review 后用 T2 check snapshot；strict source changes 要求 full review snapshot 和必要 doc-sync。snapshot 不是 finding ledger / Review Receipt。`source change` 包含 behavior path 和 protected source doc；规则口径、高影响或跨模块变更进入 strict。

UI 文件分类由 `doc-sync-helpers.sh` 统一判断：`*.tsx`、`*.jsx`、`*.vue`、`*.svelte`、`*.html`、`*.css`、`*.scss` 只有在 staged / unstaged diff 全部是 visual-only 行时才走 T1。允许的 T1 行包括静态标签文案、`className` / `class`、`aria-label`、`title`、`placeholder`、`alt`、`style` 和 CSS / SCSS 视觉属性；CSS / SCSS 视觉属性覆盖颜色、字体、间距、边框、阴影、透明度，以及 `width` / `height`、`min-*` / `max-*` 尺寸、`inline-size` / `block-size`、`inset` / `top` / `right` / `bottom` / `left`、`transform` / `translate` / `scale` / `rotate` 等大小、位置和轻量变换微调。T1 UI 微调不默认跑 heavy gate、`check-ui-reuse`、health 或完整视觉验收；untracked 新 behavior 文件没有可比较 diff，默认至少 T2；路径、diff 或 untracked 文件内容出现 auth、permission、security、payment、database、delete、danger、api、fetch、mutation、onSubmit、sql 等信号时升级，不走 T1。

结构门禁会调用 `tools/check-ui-reuse.mjs`。该脚本默认检查 staged 前端文件，`--all` 检查全量源码；新 Web / Desktop 脚手架会复制它到目标项目，并由 `npm run check:health` 统一执行，build 只串一次 `check:health`。如确需例外，使用 `vibe-ui-allow-next-line: <reason>` 或 `vibe-ui-allow-file: <reason>`，reason 不能为空。

核心热区检查由 `tools/check-hotspots.mjs` 执行，阈值真源为 `tools/hotspot-policy.mjs`，staged Git 读取由 `tools/hotspot-git.mjs` 承担。已声明 language adapter 的源码均进入文件级行数扫描；当前只有 JS / TS 进入函数与 React 组件分析。`npm run check:hotspots` / `check:health` 保留全量诊断；目标项目 pre-commit 固定运行 `--strict --staged`，新生产文件超过 300 行、React 组件超过 180 行、函数或 class method 超过 100 行、测试文件超过 800 行时失败；测试文件从 300 行开始提醒。历史超标项只有继续增长才失败，缩小或保持不增长可继续拆分；生成目录、vendor、字体资源和 minified 产物不参与人工源码门禁。首次安装或升级 hook 应从当前技能包运行 `node <skills-root>/tools/setup-target-hooks.mjs <target-root>`，由安装器刷新受管工具，避免旧 checker 沿用旧阈值。

接口契约门禁由 `tools/check-api-contracts.mjs` 执行。目标项目默认通过 `.vibe-docs.json.interfaceContracts` 映射 `接口契约.md`；新 Web / Desktop / Node CLI 脚手架会复制该脚本，并由 `npm run check:health` 统一执行，build 只串一次 `check:health`。它会拦截同一业务能力多个同类型入口、同一 endpoint / service 分配给多个能力、未登记的 Next.js `app/api/**/route.*`，以及可静态识别的字面量 `/api` fetch 调用。目标项目可选配置 `.vibe-docs.json.interfaceContractScanner`，声明 `serverRouteRoots`、`typedClientRoots`、`frontendRoots`、`allowedRawNetworkRoots`、`eventPatterns` 和 `publicEntryPatterns`，把 Fastify / Express 风格 route、统一 client path、WebSocket / event channel、desktop preload public entry、IPC channel 和正式前端 raw `fetch` / `new WebSocket` 绕过也纳入门禁。

脚手架选择先遵守 `docs/language-platform-profiles.md`：只有明确匹配 Web / Desktop / Node CLI 的新项目才使用现有模板；Backend、Library、Mobile 和非 Node CLI 目标默认沿用平台生态结构或既有项目结构。

接口契约门禁回归优先运行 `node tools/test-api-contracts.mjs`。`bash tools/test-api-contracts.sh` 只是兼容旧 Bash 命令的薄包装；Windows 没有真实 Git Bash / WSL 时不影响接口契约测试本身。runtime scaffold 和 golden path smoke 仍依赖 Bash。

PostToolUse `Edit|Write` 只按当前文件快速写 `.claude/.source-change-touched`、strict review/doc-sync 状态、普通 T2 check 状态和必要的 snapshot 失效标记；不要在每次编辑后全量扫描 staged / unstaged / untracked。Stop 的 `current change recomputation` 每次都从当前 Git staged / unstaged / untracked source changes 重新计算，即使没有 dirty marker、state 或 snapshot 也不能跳过；对 staged 和 unstaged source changes 都要按 diff 分级，对 untracked source changes 要按文件内容扫描风险信号并保守处理；不能只凭 `*.tsx` / `*.css` 路径默认 T1。未 staged 或未跟踪的普通 T2 / strict UI 改动必须先收口，不能用旧 snapshot 放行。Codex PowerShell fallback gate 必须与 Bash gate 等价：普通 T2 接受 T2 check snapshot，strict source changes 才要求 review snapshot 和 strict doc-sync 覆盖。

Windows 上的完整 Bash gate 必须使用真实 Git Bash（例如 `D:\Git\bin\bash.exe`）。Codex PowerShell runtime gate 只能覆盖 Codex hook 可表达的子集，和 Bash full gate 不等价；如果没有 Git Bash，验证记录必须写“未执行完整 Bash gate”，不能把降级检查当作完整通过。

## 维护规则

- 改源码后，先跑 `sync-compat.ps1`
- 新目标项目首次接入本包时，运行 `node ./tools/init-target-runtime.mjs <目标项目根目录> --skills-root <skills仓库根目录> --dry-run` 预览；确认后运行 `--write`，复查运行 `--check`
- 新目标项目开始非快车道 T2/T3 真实任务时，可运行 `node ./tools/init-target-task-context.mjs <目标项目根目录> --slug <slug> --title "<title>" --write` 创建任务胶囊；长任务连续性 V1 使用 `--continuity-mode t2|t3|cross-session|long-task`；追加轻量恢复记录用 `--record-session "<summary>"`，收口检查用 `--check`
- 新目标项目生成生命周期 `.md` 文档后，运行 `node ./tools/check-target-doc-names.mjs <目标项目根目录> --require-existing`；legacy 英文文档名只能显式 `--allow-legacy` 读取迁移，不能作为新生成结果
- v2 目标项目先用 `node ./tools/build-target-doc-index.mjs <目标项目根目录> --check` 验证 index / metadata；需要刷新时显式传 `--write`。运行时只用 `node ./tools/resolve-target-doc-context.mjs <目标项目根目录> --roles <role> --budget <tokens> --json` 申请 onDemand 文档，不手工绕过 never。启用 Markdown 治理后，先精确定位路径，再用 `--markdown <项目相对路径>` 申请一份 Markdown；不得扫描或全文加载分卷目录。
- 启用任务胶囊后，只有 `node ./tools/update-target-task-state.mjs <目标项目根目录> --status <todo|doing|blocked|done> --phase <id> --task <id> --checkpoint <text> --next <text> --write` 能更新状态；执行光标是投影。用 `node ./tools/check-target-doc-drift.mjs <目标项目根目录> --micro|--quick|--full --strict` 按风险检查。
- continuity V1 恢复时先用 `node ./tools/resolve-target-doc-context.mjs <目标项目根目录> --capsule <当前胶囊> --json` 读取交接单、状态、执行光标和确认状态；知识更新使用 `update-target-task-knowledge.mjs`，交接单检查使用 `generate-target-task-handoff.mjs --check`。
- 既有项目先运行 `node ./tools/migrate-target-doc-system.mjs <目标项目根目录>` 查看 dry-run；获得明确授权后才运行 `--write`，中断时使用 `--recover`。迁移不会重命名、移动或删除用户原文；归档用 `archive-lifecycle-docs.mjs` 产生并登记四字 never 卷。
- 新目标项目首次完整接入前，运行 `node ./tools/init-target-constitution.mjs <目标项目根目录> --skills-root <skills仓库根目录> --dry-run` 预览；确认后运行 `--write` 生成 `项目画像.md`、`宪法设计.md` 和 `.vibe-docs.json` 映射；再用 `init-target-runtime.mjs` 写入 `AGENTS.md` / `CLAUDE.md`；缺 API / schema / auth / deploy 证据时只标记 `未验证`
- 新目标项目治理文档生成后，运行 `node ./tools/check-target-guardrails.mjs <目标项目根目录> --strict`；该检查会跳过 `.ddzj`、缓存 / 会话目录和 `*.sqlite*`，目标项目 `check:health` 会自动执行该 guardrail
- 新目标项目新增或修改真实接口后，运行 `node ./tools/check-api-contracts.mjs <目标项目根目录>`；没有真实接口时也保留 `接口契约.md` 的“暂无业务接口”初始行
- 新目标项目可由 Agent 运行 `npm run check:health`；需要单看热区时运行 `npm run check:hotspots` 或 `node tools/check-hotspots.mjs . --json`；本包维护可运行 `node tools/vibe-health-check.mjs . --profile package --level micro --strict` 做快速预检，或 `node tools/vibe-health-check.mjs . --profile package --level quick --strict` 做完整轻量门禁。小白入口先在当前对话调用 `vibe-coding-skills`，再说“我不会走流程，你先帮我看看”；新对话未激活时不自动进入新手 Skill。`event-only` 只接受结构化 Hook / Agent caller。
- 如新增、删除或修改 Skill，运行 `node ./tools/check-routing-manifest.mjs . --write` 刷新 compact v3 `skills/ROUTING-MANIFEST.json`；CI / health 使用 `node ./tools/check-routing-manifest.mjs .` 校验唯一总入口、invocation 和是否漂移
- 如怀疑 Skill 入口过重或 reference 导航误导，运行 `node tools/check-skill-token-budget.mjs .`；CI 或人工硬拦使用 `node tools/check-skill-token-budget.mjs . --strict`
- 改 hooks、门禁或主控规则时，同时检查 `README.md`、`AGENTS.md`、`CLAUDE.md`
- 改 protected source doc、review/doc-sync/Stop gate 或路径分类时，同步检查 Bash helper 与 PowerShell `codex-hooks/shared.ps1` 是否等价
- 如果要启用 repo 级 Git hooks，先确认当前目录已经是 Git 仓库、已有 baseline commit，且系统里可用真实 Git Bash；PATH 上的 WSL 占位 `bash` 不算完整 Bash gate
- 如改了计划恢复规则，同时检查 `DOC-MAP.md`、`Product-Spec.md`、`DEV-PLAN.md`
