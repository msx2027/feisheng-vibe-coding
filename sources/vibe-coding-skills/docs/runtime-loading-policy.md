# Runtime Loading Policy

[DocMap]
    层级：L2 / 运行时加载策略
    模块：Token 预算、状态恢复和严格流程按需加载
    依赖：
    - `AGENTS.md`
    - `CLAUDE.md`
    - `DOC-MAP.md`
    - `Product-Spec.md`
    - `DEV-PLAN.md`
    输出：
    - 加载预算
    - 场景到文档读取映射
    - T3 / T3+ 按需细则

## 1. 热路径原则

`AGENTS.md` 和 `.claude/CLAUDE.md` 会被运行时自动加载，所以它们只保留：

- 仓库定位
- 源码 / 镜像边界
- 默认路由
- 持久化真源
- execution tier 摘要
- 必须立即生效的安全规则

不要把长示例、完整清单、场景矩阵、模板、低频检查表放回入口文件。

包级 health 对 AGENTS.md、.claude/CLAUDE.md、DOC-MAP.md 和 README.md 分别以约 6,000 token、合计约 22,000 token 为警戒线；超限时优先下沉低频细则。

目标项目的 `AGENTS.md` / `CLAUDE.md` 也属于热路径。首次完整接入本包时先用 `tools/init-target-constitution.mjs` 生成 `项目画像.md` 和 `宪法设计.md`，再用 `tools/init-target-runtime.mjs` 写入短硬 managed block，并用 `.vibe-runtime.json` 记录 version / checksum；不要复制整份本包入口。

## 2. 默认读取顺序

默认不是线性全读，而是先分类再读取。

| 场景 | 读取 |
| --- | --- |
| 规则解释、token 消耗、有哪些 Skill、怎么用 | 当前入口 + compact v3 `skills/ROUTING-MANIFEST.json` / `README.md` / `skills/INDEX.md` / 定向 `rg` |
| 明确对象、明确动作、低风险且可定向验证的 T0/T1 小任务 | 对象可以是文件 / 路径 / 组件 / 当前选区 / 查询范围 / 非破坏性指定命令；只读命中文件和必要近邻上下文，或只运行指定轻量验证；不加载 `vibe-coding-skills` / `beginner-flow-guide`，不恢复完整真源，不跑 `vibe-health-check`，不默认进入 review / doc-sync |
| UI 微调快车道 | 同一组件 / 容器内的 visual-only 大小、位置、间距、颜色、字号、圆角、阴影、透明度等微调，且不改变用户路径、信息层级、响应式结构、全局 token / theme、UI 包契约或真实业务行为时，按 T1 light 直接定向处理；不因“布局 / 间距 / 对齐 / polish”等通用视觉词自动进入 `layout` / `polish` / `adapt` / `audit` / `impeccable`、`check-ui-reuse`、health 或完整视觉验收 |
| 外部强规划 Skill | `superpowers:brainstorming` 只在用户显式点名、明确要求头脑风暴 / 多方案探索，或需求尚未成形且确实需要先构思时读取；已批准计划、继续执行、bug、测试自动化、文档同步、发布、明确文件修改和 T0/T1 快车道任务不读取 |
| 用户首次显式调用总入口 | `vibe-coding-skills/SKILL.md`：打开当前对话授权闸门；有 Skill ID 就直接路由，没有 ID 时允许后续自然语言使用 routeHints |
| 用户已通过总入口指定 `beginner-flow-guide` 并要求体检 | `beginner-flow-guide/SKILL.md` + route matrix + 对应 package / target quick health |
| 继续、下一步、当前做到哪、卡住了 | `DOC-MAP.md`，再按需读 `Product-Spec.md` / `DEV-PLAN.md` / 当前光标 |
| 目标项目继续开发 | 先读 schema v2 `.vibe-docs.json` 和轻量 `文档索引.md`；启用胶囊时先读当前 `任务状态.json` 与执行光标当前片段，再由 `resolve-target-doc-context.mjs` 按当前任务追加 role / selector。不要默认全文读取需求、计划、契约或 archive |
| 目标项目文档治理 / 审计 | v2 使用 `build-target-doc-index.mjs --check|--write`、`resolve-target-doc-context.mjs` 和 `check-target-doc-drift.mjs --micro|--quick|--full`；legacy v1 仅给 migration warning，显式迁移才可写入 |
| 明确某个 Skill | 该 Skill 的 `SKILL.md`，再按“按需加载 references”读取命中文件 |
| 首次完整接入目标项目 / 生成画像、宪法设计和 AGENTS.md / CLAUDE.md | `target-constitution-setup/SKILL.md` + `tools/init-target-constitution.mjs` + `tools/init-target-runtime.mjs`；默认 dry-run，确认后 write |
| 只刷新或检查 AGENTS.md / CLAUDE.md managed block | `target-runtime-setup/SKILL.md` + `tools/init-target-runtime.mjs` + `.vibe-runtime.json` |
| 普通 T2 功能 / 组件 / 状态逻辑 | 需求澄清门 → 预实现一致性分析 PASS → RED-GREEN-REFACTOR + 定向验证 + `split-self-review` → 交付收敛检查；stage 后用 T2 check snapshot 收口，不默认独立 Reviewer / full doc-sync |
| 用户点名 codebase-memory / 代码地图 / 调用链 / 影响面，或 T2/T3 且跨模块、调用链不清、入口不明、影响面不明 | 先用 `codebase-memory-scout` 或 `rg` 缩小范围，再读源码 |
| 核心热区 / 大文件 / 文件太长 / 这一坨太大 / 看不懂 / 别往这里塞 | 进入 `hotspot-governor`；先运行或降级模拟 `check-hotspots` 诊断大文件、大测试、runtime/action、token/schema/config、重复 helper 和超大 diff，再决定是否交给 `dev-builder` / `test-automation` / `ui-system-guardian` |
| 目标项目 token / 上下文消耗排查 | 不扫描 `$CODEX_HOME` 全目录；只定向检查生命周期文档、当前入口和必要日志 / 配置。不得同时扫描 `skills/`、`.agents/skills/`、`.claude/skills/`；默认 `rg` / 静态审计排除目标项目运行时镜像、全局会话、全局缓存和全局 Skill 镜像目录 |
| 镜像同步验证 | 先改源码，再运行 `tools/sync-compat.ps1`；只有验证漂移时扫描 `.claude/`、`.agents/`、`.codex/` |

## 3. Skill 与 reference 预算

- `SKILL.md` 是启动必读入口，但应控制在主流程和导航范围。
- 总入口路由预判优先读确定性生成的 compact v3 `skills/ROUTING-MANIFEST.json`；manifest 缺失或校验失败时，再回退到 `skills/INDEX.md`、具体 `SKILL.md` 或定向 `rg`，但只有当前对话已激活总入口时才能使用 routeHints，不能把它们当作独立触发器。
- 新建或维护 Skill 时先判定 invocation：`vibe-coding-skills` 是唯一 `user-only` 用户入口，并打开当前对话授权闸门；具体 Skill 标记为 `router-only`，只由已激活总入口按 ID 或授权后的 routeHints 路由；Hook / 子 Agent 入口标记为 `event-only`。自然语言说明只作为已激活总入口的 `routeHints`，不作为 Skill 独立自动触发器。
- `routeHints` 只写总入口查找所需的场景提示；具体 Skill 的 frontmatter 不能再把自然语言写成独立自动触发条件。
- `references/` 只放低频细节、长模板、完整场景表、示例和检查清单。
- `reference/` 是历史或外部 Skill 的兼容目录名；预算脚本同时识别 `references/` 和 `reference/`，新建本包 Skill 默认用复数 `references/`。
- 一个任务只读取命中的 reference；不因“保险”读取全部 references。
- 每个 context pointer 的文字必须说明何时读取对应 reference；关键流程步骤必须有可检查 completion criterion，避免低频细节下沉后导致提前完成。
- reference 超过 100 行时，顶部要有目录或清晰小节，便于先判断是否需要深入。
- 大型资料型 Skill（例如设计数据库类 Skill）应优先用索引、脚本或数据文件查询，不把全部数据塞回 `SKILL.md`。
- 预算门禁：普通 `SKILL.md` 粗估超过 5k token 报警，router 类 Skill 超过 3k token 报警；超限时优先下沉到 `references/` / `reference/` 或查询脚本；`node tools/check-skill-token-budget.mjs . --strict` 可作为硬门禁。
- 路由 manifest 门禁：Skill 增删改后运行 `node tools/check-routing-manifest.mjs . --write` 刷新 compact v3 生成物；package quick health 用 `node tools/check-routing-manifest.mjs .` 校验 freshness、唯一用户入口、invocation、routeHints 和源码 reference 路径。

## 4. 状态恢复边界

本分发包自身：

1. 用户只是问规则或解释时，不恢复 `Product-Spec.md` / `DEV-PLAN.md`。
2. 用户要求继续维护本包、同步文档、改 Skill / Hook / Tool 时，读 `DOC-MAP.md`、`Product-Spec.md`、`DEV-PLAN.md` 和相关模块 `INDEX.md`。
3. `plans/` 只有在计划明显变大时启用。

目标项目：

1. 先读 schema v2 `.vibe-docs.json`，校验 required 顶层角色和 `documents[]` metadata 的对应关系；再读默认 always 的 `documentIndex`，它只导航角色、路径、authority、hash、token 和 section，不复制正文。
2. `loadPolicy.always` 默认只有 `documentIndex`，最多 3 个角色、合计不超过 12,000 token；其他角色都是 onDemand，必须由 `resolve-target-doc-context.mjs` 以 role / selector / sourceRevision / maxTokens 显式申请。
3. `never` role 默认拒绝；只有用户明确授权的迁移、归档或审计任务才可通过 resolver 的 `--allow-never --reason <理由>` 访问，不得由普通 Skill 直接读取。
4. 如果 `taskContext.enabled`，先按需读取 `taskContext.currentTaskCapsule/任务状态.json`。它是唯一可写任务状态真源；`docs/plans/执行光标.md` 只有状态工具生成的前 10 行投影。实现阶段读取 `实现上下文.jsonl`，验收 / 测试 / review 阶段读取 `验收上下文.jsonl`，会话记录只服务恢复。
5. legacy v1 与英文生命周期文档只作为显式迁移输入，不作为新生成结果；health 对 legacy 保留 `migration_required` warning，v2 strict 才对 index freshness、drift 和 budget 硬失败。

**"继续/下一步"类请求的探针优先原则：**
1. 目标项目先取得 `.vibe-docs.json`、`文档索引.md`、当前 `任务状态.json`，再只读执行光标前 10 行；本分发包仍按自身 `plans/CURRENT-EXECUTION.md` 恢复。
2. 状态与 cursor 明确当前任务时：用 resolver 仅加载实现或验收 JSONL 指向的片段，不全量恢复状态、需求或计划。
3. 状态 / cursor 不存在、为空或语义不足时：resolver 才增加显式 role；`文档索引.md` 不足以替代正文时再小块读取命中 section。
4. 禁止因“继续”默认同时加载 Product-Spec.md + DEV-PLAN.md（合计最坏 25,000 token），也禁止绕过 resolver 读取 never archive。

### 4.1 目标项目文档治理 v2

- 新目标项目根目录 Markdown 白名单只有 `AGENTS.md`、`CLAUDE.md`、`文档索引.md`。其余生成 Markdown 一律写入 `docs/` 并按角色分类；`文档索引.md` 仍在根目录，以便运行时快速定位。已有项目只按 manifest 兼容读取，不自动移动已存在文件。
- 新目标项目由 constitution bootstrap 或脚手架生成的 `.vibe-docs.json` 默认包含并启用 `markdownGovernance`，预算为普通正文 `8,000`、门面 `3,000` token，归档目录初始为空；既有项目缺少该字段时保持关闭，只有用户明确决定后才补入并启用。
- `documents[]` 是 manifest 的机器 metadata：每项必须有 role、path、owner、authority、content hash、预估 token、依赖与 section。顶层 role 映射与 `documents[]` 不一致属于 v2 drift，不能用手工口头说明绕过。
- `setup-target-hooks.mjs` 为 Claude / Codex 安装受管文档 PostToolUse 自动同步：写入命中 `documents[]` 已登记路径时，`auto-sync-target-doc-index.mjs` 事务刷新 `文档索引.md`、hash 和 section metadata。自动同步不得改写正文、暂存区或旧任务胶囊 `sourceRevision`；正文变化后旧证据必须保持 stale，直到重新核对。
- `build-target-doc-index.mjs --check` 验证 `文档索引.md`、hash 和 section metadata 是否新鲜，`--write` 才刷新可再生索引与 manifest metadata。`check-target-doc-precommit.mjs` 在提交前额外要求受管正文与 metadata / index 原子暂存，并拒绝受管范围残留未暂存修改。超过 20,000 token 而没有新鲜 section index 的文档不能作为普通整篇上下文加载；超过 50,000 token 必须归档。
- `check-target-doc-drift.mjs` 的 micro 检查 manifest / state，quick 继续检查 capsule selector，full 才枚举 marked orphan 与未登记 archive。v2 strict 将这些错误阻断；legacy v1 不跑 v2 strict，而是给 migration warning。
- `migrate-target-doc-system.mjs` 不带写入参数时只输出 dry-run；只有显式 `--write` 才使用 CAS transaction journal 落盘，`--recover` 处理未完成写入。迁移不重命名、移动或删除既有用户生命周期文档。
- `archive-lifecycle-docs.mjs` 新增的 archive 使用如 `需求一卷.md`、`计划一卷.md` 的四字中文卷名，必须登记 archive authority 和 never policy；归档不是普通 Skill 的默认读取面。

## 5. T3 / T3+ 按需细则

T3 strict 用于 bug、安全、权限、数据、发布、Skill / Hook / Tool / Agent 路由变更。

普通 T2 用 T2 light closeout：需求澄清门后，首个 RED 前完成预实现一致性分析 PASS；定向验证、split-self-review 与交付收敛检查后再写 T2 check snapshot。跨至少 3 个模块、公共契约、Phase 完成、用户要求 review 或其他高影响 T2 升级 independent-two-stage。审查只加载当前 Task / Phase 最小审查包。

固定顺序：

1. 需求澄清门、分类与成功标准
2. 风险 / 影响面
3. 预实现一致性分析 PASS 与 test-first / 回归计划
4. 最小实现
5. fresh 验证
6. code-review
7. 交付收敛检查
8. doc-sync
9. finish checklist

T3+ hazard mode 是 T3 内部高风险子模式。命中 auth、permission、security、token、secret、payment、database、migration、data loss、filesystem、shell、network、eval、pre-commit、hook、agent routing、Skill / Hook / Tool 规则、release / deploy / publish、删除 / 重命名 / 迁移行为文件或影响面无法可靠判断时启用。

T3+ 开工前写 hazard task packet：

- 目标 / 非目标
- 风险类型
- 影响面
- 允许修改文件
- 禁止触碰文件
- 复现或 RED 失败证据
- 验证命令
- rollback 方案
- finish checklist

## 6. 高频避坑

- 排查目标项目 token / 上下文消耗时，不要扫描 `$CODEX_HOME` 全目录；只定向检查生命周期文档、当前入口和必要日志 / 配置。
- 不要同时扫描 `skills/`、`.agents/skills/`、`.claude/skills/`，除非验证同步漂移。
- 默认 `rg` / 静态审计只扫真源目录；除同步漂移验证外，排除 `.agents/`、`.claude/` 和 `.codex/` 镜像目录，也排除全局会话 / 缓存 / 镜像目录，例如 `$CODEX_HOME/sessions`、`$CODEX_HOME/history`、`$CODEX_HOME/cache`、`$CODEX_HOME/skills`、`$CODEX_HOME/.agents/skills` 和 `$CODEX_HOME/.claude/skills`。
- 不要在普通问答里自动读取 `Product-Spec.md` 和 `DEV-PLAN.md`。
- 不要把明确、低风险、可定向验证的 T0/T1 小任务送进 `vibe-coding-skills`、`beginner-flow-guide` 或完整 health / scout / review / doc-sync 链路。
- 不要把明确对象和动作的 UI 微调送进设计质量层；只有改到响应式结构、主 CTA / 导航、信息层级、组件跨容器移动、全局 token / theme、UI 包契约、真实业务行为，或用户明确要求完整打磨 / 审计时才升级。
- 不要让外部强规划 Skill 抢路由：`superpowers:brainstorming` 只处理显式点名或真实方案构思；已批准计划、修 bug、补测试、同步文档、发布和 T0/T1 快车道任务按本包主链路执行。
- 不要把普通 T2 送进 T3 strict loop；普通 T2 仍需短计划、定向验证和 `split-self-review`，再写 T2 check snapshot；不默认独立 Reviewer / full doc-sync。
- 不要把“先帮我看看”直接等同于 quick health；默认先跑 `vibe-health-check --level micro` 或等价轻量预检，用户明确要求“能不能跑 / 体检 / 项目有没有问题”才升级 quick。
- 不要把普通 T2 自动送进 `codebase-memory-scout`；只有用户点名或跨模块 / 调用链 / 入口 / 影响面不清时才启用。
- 不要用 codebase-memory 替代中文真源回读；MCP 输出只作为候选路径和调用链线索。
- 不要把 `AGENTS.md` / `CLAUDE.md` 写入 `.vibe-docs.json`，也不要为了目标项目接入复制整份本包入口；`.vibe-docs.json` 只登记 `projectProfile: "项目画像.md"`、`constitutionDesign: "宪法设计.md"` 等生命周期文档，runtime 入口只更新 managed block。
- 不要把任务胶囊当成 `.vibe-docs.json` 的替代品；新脚手架只登记 disabled `taskContext`，不提前写不存在的 `会话记录.md` 或空任务胶囊。
- 不要把 `docs/plans/执行光标.md` 当作可写任务状态或从中反向修复 `任务状态.json`；它只是可再生投影。状态更新必须通过 `update-target-task-state.mjs --write`。
- 不要把 legacy v1 的 migration warning 当成目标项目 health blocker，也不要为了消除 warning 自动运行 migration；用户必须显式选择 `--write`。
- 不要让普通 Skill 直接全文读取 onDemand 或 never 文档；先由 resolver 通过 role / selector / source revision / token budget 得出允许面。
- 不要忽略 `.vibe-runtime.json` 漂移；`init-target-runtime.mjs --check` 发现 registry 缺失或 checksum 不一致时，应刷新 managed block，而不是口头声明当前。
- Windows PowerShell 读取中文 Markdown / JSON / 配置 / 日志时必须显式 `-Encoding UTF8`。
- 涉及 `.pen` 文件时只用 Pencil 桌面客户端和 desktop MCP，不 fallback 到 VS Code。

## 7. 验证口径

入口瘦身完成后至少检查：

- 入口文件尺寸下降或默认读取链变短。
- `DOC-MAP.md` 不再要求启动后线性全读所有真源。
- `beginner-flow-guide` 不再对元问题恢复完整项目状态。
- `tools/sync-compat.ps1` 可以同步镜像。
- package quick health 可运行，或明确记录环境阻塞。
- v2 目标项目通过 `node tools/build-target-doc-index.mjs <target-root> --check`、`node tools/check-target-doc-drift.mjs <target-root> --full --strict` 和 `node tools/check-lifecycle-doc-budget.mjs <target-root> --strict`；legacy 项目则确认只报告 `migration_required` warning。
- `node tools/migrate-target-doc-system.mjs <target-root>` 无写入副作用；显式 `--write` 后可用 `--recover` 处理未完成 journal；归档输出仍满足四字卷名并被注册为 never。
