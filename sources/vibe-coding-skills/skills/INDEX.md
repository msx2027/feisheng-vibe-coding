# Skills Index

## 模块职责

`skills/` 是这套包的技能源码入口。

每个子目录对应一个 Skill，负责一个明确场景。

`skills/ROUTING-MANIFEST.json` 是由 `tools/check-routing-manifest.mjs --write` 生成的 compact v3 路由索引；不要手写维护。它只用于预判和缩小读取面，真正执行某个 Skill 时仍按规则读取该 Skill 的 `SKILL.md`。

## 默认路由

- 唯一用户入口：用户显式调用 `vibe-coding-skills` 或 `/vibe-coding-skills`
- 具体 Skill 入口：总入口收到明确 Skill ID 后直接按 `router-only` 路由；总入口在当前对话已激活但未收到 ID 时，后续普通自然语言才可通过 `routeHints` 路由
- 新手辅助：`beginner-flow-guide` 只由当前对话已激活的总入口按需调用

`ROUTING-MANIFEST.json` 中的 `routeHints` 只是已激活总入口查找 Skill 的提示，不是模型可独立执行的触发器；没有当前对话显式总入口调用时，具体 Skill 路由结果为 `no-skill`。

## 默认策略

- 默认语言：中文
- 默认口径：严格 TDD；除 visual-only T1 受控例外外，生产行为强制 `RED-GREEN-REFACTOR`。受控 T1 仅限没有既有测试 / visual regression seam 的呈现微调，必须保留改前基线与改后同路径定向视觉证据；原型、生成代码、配置文件只有用户明确批准才可例外。
- 默认审查：execution tier 与 review profile 正交计算；T0=`none`、T1=`directed-check`、T2=`split-self-review`、T3=`independent-two-stage`、T3+=`hazard-review`。T2 以上始终分开 Spec Compliance 与 Code Quality，高影响任务才拆成两个 fresh Reviewer；finding ledger 必须闭环。
- 默认规格闭环：需求澄清门由 `product-spec-builder` 记录在既有需求真源；新项目和高影响变更先由 `architecture-foundation` 做开工前架构地基并取得 PASS；T2/T3 首个 RED 前由 `dev-planner` 做预实现一致性分析并取得 PASS；完成实现、fresh 验证和审查后由 `dev-builder` / `code-review` 做交付收敛检查。地基结论写入既有 `系统架构.md`，不创建平行 `spec.md` / `plan.md` / `tasks.md`。
- 默认快车道：明确对象（文件 / 路径 / 组件 / 当前选区 / 查询范围 / 非破坏性指定命令）、明确动作、低风险且可定向验证的 T0/T1 小任务，直接做定向读写、定向查询或轻量命令验证；这是普通对话的直接动作边界，不启动具体 Skill，不默认恢复完整真源、不跑完整体检、不启用 scout / review / doc-sync。只有当前对话显式调用 `vibe-coding-skills` 后，才允许总入口把普通自然语言路由到具体 Skill。同一组件 / 容器内 visual-only UI 大小、位置、间距等微调按 T1 快车道处理，不因“布局 / 间距 / 对齐 / polish”等词自动进入设计质量层。
- 默认新手辅助：当前对话已激活的 `vibe-coding-skills` 总入口把“我不会走流程 / 我现在该干嘛 / 先帮我看看”交给 `beginner-flow-guide` 时，显示真实 Markdown 导航卡并做 micro preflight；未激活时不独立加载。
- 默认加载：先读命中的 `SKILL.md`；只有命中该文件“按需加载 references”表时，才读取对应 `references/*.md`；历史 / 外部 Skill 可兼容 `reference/*.md`；不默认全量加载
- 默认路由索引：规则解释、Skill 列表或手动路由优先读取 compact v3 `skills/ROUTING-MANIFEST.json`；manifest 缺失或校验失败时，再回退 `skills/INDEX.md`、具体 `SKILL.md` 或定向 `rg`
- 默认外部强规划 Skill 边界：`superpowers:brainstorming` 只在用户显式点名、明确要求头脑风暴 / 多方案探索，或需求尚未成形且确实需要先构思时使用；已批准计划、继续执行、bug 修复、测试自动化、文档同步、发布、明确文件修改和 T0/T1 快车道任务不得被它拦截；`superpowers:brainstorming` 不能替代本包默认产品 / 设计 / 开发主链路
- 默认代码图侦察：`codebase-memory-scout` 是辅助层；用户明确点名，或 T2/T3 且跨模块、调用链不清、入口不明、影响面不明时启用；普通 T2、小改和中文文档真源不自动启用
- 默认验收纪律：需要用户真实点击 / 操作 / 观察才能确认的内容，交付时必须提醒人工验收；用户确认后写入 `.vibe-docs.json.manualAcceptance` 映射文档，默认 `验收记录.md`
- 默认目标文档治理：新目标项目使用 schema v2 `.vibe-docs.json`；required 顶层角色与 `documents[]` metadata 一致，`文档索引.md` 是默认唯一 always 导航。普通 Skill 只能通过 `resolve-target-doc-context.mjs` 申请 onDemand role / selector，never 默认拒绝；新项目 bootstrap / 脚手架默认启用 `markdownGovernance`，既有项目缺字段保持兼容关闭；启用后，任何项目 Markdown 都按“薄导航页 + 小正文分卷 + 精确 `--markdown` 读取”治理，检查不会自动改写或合并用户文档；legacy v1 只提示显式 migration，不自动写入或阻断 health。
- 默认任务上下文：目标项目 `.vibe-docs.json.taskContext` 默认 disabled；新项目非快车道 T2/T3 开始真实任务时可按需创建 `docs/plans/任务/<date-slug>/` 任务胶囊，开发读 `实现上下文.jsonl`，测试 / 审查读 `验收上下文.jsonl`，`docs/plans/会话记录.md` 只用于恢复。启用后 `任务状态.json` 是唯一可写状态真源，`docs/plans/执行光标.md` 是状态工具生成的投影；既有项目沿 manifest 路径。
- 默认接口纪律：同一业务能力只有一个统一接口契约入口；新增真实 endpoint、service、public entry、server action、fetch wrapper、IPC / event 通道或 schema 前，先查 `.vibe-docs.json.interfaceContracts` 映射的 `接口契约.md`，目标项目存在 `tools/check-api-contracts.mjs` 时必须运行
- 默认热区纪律：总入口指定 `hotspot-governor` 后，先诊断大文件 / 大测试 / runtime / token / schema / 超大 diff / 重复 helper，不默认直接大重构。普通自然语言只作为已激活总入口的 routeHint，不独立加载。提交门禁从生产文件 300 / 组件 180 / 函数 100 / 测试文件 800 行开始执行历史只减不增
- 默认目标项目接入：用户第一次在目标项目使用本包，或要求生成项目画像 / 宪法设计包 / 证据绑定的 `AGENTS.md` 与 `CLAUDE.md` 时，进入 `target-constitution-setup`；只要求刷新或检查 runtime managed block 时进入 `target-runtime-setup`
- 默认自然话压力覆盖：新手迷茫、半路接管、环境启动、功能开工、验收上线、安全隐私和小改快车道话术由 `tools/fixtures/routing-novice-cases.json` 回归保护；自然话用例不能靠堆热路径关键词解决
- 默认技术栈纪律：先识别 `platform profile + language adapter + architecture profile + scaffold policy + fallback stack`；现有 JS / TS Web、Desktop、Node CLI 模板不是所有新项目的隐式默认，未知技术栈只问一个关键问题
- 默认 UI 纪律：正式前端页面先识别目标项目 UI 包、design tokens、组件盘点、复审报告和门禁；页面层只做业务组合，基础视觉件回到 UI 包和 token 体系；除 T1 UI 微调快车道外，目标项目存在 `tools/check-ui-reuse.mjs` 时必须运行；初始化组件库、补 token、补组件 / variant、治理 UI 债务时进入 `ui-system-guardian`
- 默认设计主链路：`product-spec-builder -> design-brief-builder -> design-maker -> dev-planner / dev-builder`
- 新目标项目生命周期 `.md` 文档必须使用四字中文文件名，并通过 schema v2 `.vibe-docs.json` / `documents[]` 映射文档角色；归档新卷使用 `需求一卷.md` / `计划一卷.md` 这类四字文件名并注册为 never archive
- 新 Web / Desktop 项目默认 `feature-first`
- Backend、Library、Mobile、非 Node CLI 默认沿用平台结构或既有结构，不强套 `feature-first` / `src/shared/ui`
- 已有项目默认 `legacy-incremental`

## 执行强度分级

| Tier | 场景 | 默认处理 |
| --- | --- | --- |
| T0 `trivial` | 低风险错字、注释、纯说明文字 | 直接动作 + diff 摘要，不进入完整 Skill 链路 |
| T1 `light` | visual-only、局部、数据无关、不改变用户路径的 UI copy / class / style / CSS 视觉属性小改，同一组件 / 容器内 UI 微调，或低风险配置 | 微计划 + 定向验证 |
| T2 `standard` | 普通功能、组件、状态逻辑；主 CTA、导航、表单顺序、布局结构、响应式结构、信息层级或组件跨容器移动 | 短工程计划 + 定向验证 + split-self-review；高影响 T2 升级 independent-two-stage |
| T3 `strict` | bug、安全、权限、数据、发布、删除 / 危险操作、登录授权、支付、admin、数据提交等高风险 UI、Skill / Hook / Tool / Agent 路由变更 | strict execution loop + finish checklist |

混合批次按最高风险级别执行；无法可靠分类时升到 T2/T3，不降级。

UI 改动不属于 T0。T1 只允许静态标签文案、`className` / `class`、`aria-label`、`title`、`placeholder`、`alt`、`style`、CSS / SCSS 视觉属性，或同一组件 / 同一容器内且 diff 仍为 visual-only 的大小、位置、间距、颜色、字号、圆角、阴影、透明度和轻微顺序调整。主 CTA 位置、导航入口、表单字段顺序、布局结构、响应式结构、信息层级、组件跨容器移动默认 T2；design token、Tailwind config、theme config、全局 CSS 变量默认 T2。删除 / 危险操作、登录授权、权限、安全、支付、隐私、admin、数据编辑 / 提交、发布相关 UI 默认 T3/T3+；diff 或路径出现 `auth`、`permission`、`security`、`payment`、`database`、`delete`、`danger`、`api`、`fetch`、`mutation`、`onSubmit`、`sql` 等信号时不得走 T1。T1 UI 微调不默认跑 `check-ui-reuse`、health、完整视觉验收或设计质量层。

T2 短工程计划固定包含目标、影响面、RED、GREEN 和升级触发条件；定向验证后仍分开 Spec Compliance / Code Quality，stage 后用 T2 check snapshot 收口，高影响时升级独立双审。T3 固定执行 `分类 -> 成功标准 -> 风险 / 影响面 -> RED -> GREEN -> REFACTOR -> fresh 验证 -> 独立 Spec review -> 独立 Quality review -> finding 闭环 -> doc-sync -> finish checklist`。finish checklist 必须包含人工验收状态：`不适用 / 待用户验收 / 用户已确认 / 需回归复验`。

T3+ `hazard mode` 是 T3 内部子模式，不新增 gate tier。auth、permission、security、token、secret、payment、database、migration、data loss、filesystem、shell、network、eval、pre-commit、hook、agent routing、Skill / Hook / Tool 规则、release / deploy / publish、删除 / 重命名 / 迁移行为文件、影响面无法可靠判断时启用；这些词也是快车道的统一风险信号，命中时不得按 T0/T1 轻量闭环；必须产出 hazard task packet、red-green evidence 或手动复现协议、rollback 方案和 hazard review。

`protected source doc` 也属于 gate 管控的 `source change`：`AGENTS.md`、`CLAUDE.md`、`DOC-MAP.md`、`Product-Spec.md`、`DEV-PLAN.md`、`TERMINOLOGY-AND-NAMING.md` 和各模块 `INDEX.md` 默认至少 T2。普通 README/docs typo 仍可 T0；但主控、真源和索引文档不能用 T0 绕过机器收口，规则口径、高影响或跨模块变更进入 strict review/doc-sync。Stop hook 会做 `current change recomputation`，按 staged、unstaged 和 untracked source changes 重新判断。

## 成员清单

> 下列表格中的中文场景只是当前对话已激活的 `vibe-coding-skills` 总入口的 routeHints；新对话或未激活时不加载具体 Skill，统一保持 `no-skill`。

| 内部 Skill | 中文场景 | 默认触发方式（总入口激活后） | 主要输出 |
| --- | --- | --- | --- |
| `beginner-flow-guide` | 不会走流程 / 不知道下一步 / 先帮我看看 | 仅由 `vibe-coding-skills` 总入口按需调用 | 真实 Markdown 新手导航卡 + micro preflight / 状态扫描 + 唯一下一步 |
| `vibe-coding-skills` | 想看总入口 / 想手动路由 | 唯一用户入口；调用后可指定 Skill ID，也可在本对话后续使用自然语言 | 路由结果 |
| `product-spec-builder` | 整理需求 / 加功能 / 改需求 | 命中明确需求意图时进入 | 新项目默认 `docs/需求文档.md` + `.vibe-docs.json` |
| `design-brief-builder` | 定设计方向 | 手动或链路进入 | 新项目默认 `docs/设计简报.md` |
| `design-maker` | 出设计稿 | 手动或链路进入 | 设计交付物 |
| `ui-ux-pro-max` | 页面设计增强层总入口 | 用户明确要设计增强时露出 | 视觉方向与增强建议 |
| `design-system` | tokens / design system | 用户明确提到时露出 | 设计系统建议 |
| `ui-styling` | 页面样式体系 | 用户明确提到时露出 | 样式体系建议 |
| `ui-system-guardian` | 初始化组件库 / 补 token / 治理 UI 债务 | 用户明确说 UI 太乱、样式不统一、组件库不全或 `check-ui-reuse` 失败时进入 | UI 系统初始化、债务清单、token / 组件补齐和门禁证据 |
| `brand` | 品牌一致性 | 用户明确提到时露出 | 品牌与语气建议 |
| `impeccable` | 页面设计质量层总入口 | 用户明确要打磨时露出 | 质量层路由 |
| `audit` | 设计审视 | 用户明确说 audit 时露出 | 审计结果 |
| `critique` | 设计批评 | 用户明确说 critique 时露出 | 设计反馈 |
| `polish` | 精修打磨 | 用户明确说 polish 时露出 | 打磨建议 |
| `adapt` | 移动端适配 / 响应式 | 用户明确说移动端适配、响应式、断点或跨设备兼容时进入 | 响应式布局和触控适配建议 |
| `animate` | 微交互 / 过渡 / motion | 用户明确说微交互、过渡、动画或 motion / transition 时进入 | 动效方案和实现建议 |
| `bolder` | 更大胆 / 更有冲击力 | 用户明确说太普通、太安全、缺少个性或想更大胆时进入 | 更强视觉表达建议 |
| `clarify` | 错误提示更清楚 / 文案更清楚 | 用户明确说文案、标签、错误提示或说明难懂时进入 | UX copy 改写建议 |
| `colorize` | 加一点颜色 / 更有色彩 | 用户明确说太灰、太 dull、缺少温度或想更有色彩时进入 | 色彩增强建议 |
| `delight` | 惊喜感 / 更有趣 | 用户明确说惊喜感、更有趣、人格化体验或记忆点时进入 | 情绪化体验建议 |
| `distill` | 简化 / 减少噪音 | 用户明确说简化、去噪、减少复杂度或更聚焦时进入 | 信息精简建议 |
| `harden` | 空状态 / 边界情况 / 生产可用 | 用户明确说空状态、错误态、边界情况、i18n、overflow 或生产可用时进入 | 生产级边界处理建议 |
| `optimize` | 页面卡顿 / 性能 | 用户明确说页面卡顿、慢、janky、bundle size 或加载时间时进入 | 性能诊断和优化建议 |
| `overdrive` | 惊艳 / 高阶动效 | 用户明确说惊艳、wow、go all-out、高阶动效或技术野心时进入 | 高阶技术表现方案 |
| `quieter` | 更克制 / 太花 | 用户明确说太花、太吵、太强、overwhelming 或想更克制时进入 | 视觉降噪建议 |
| `shape` | shape 规划 | 仅当总入口指定 `shape` 时进入；普通页面设计规划走 `design-brief-builder` | UX / UI 规划访谈与 design brief |
| `layout` | 布局梳理 | 用户明确说布局时露出 | 布局优化 |
| `typeset` | 排版梳理 | 用户明确说排版时露出 | 排版优化 |
| `dev-planner` | 规划开发顺序 | 命中明确规划意图或开发计划缺口时进入 | 新项目默认 `docs/项目治理/开发计划.md` |
| `architecture-foundation` | 开工前架构地基 | 新项目准备开发，或已有项目发生跨模块、数据、接口、权限、部署、技术栈或架构变化时进入 | 可确认、可过期的地基 PASS / BLOCKED 结论 |
| `codebase-memory-scout` | 代码图侦察 / 影响面分析 / 调用链定位 | 用户明确要求，或 T2/T3 且跨模块、调用链不清、入口不明、影响面不明时作为辅助层进入 | 候选文件 / 函数、调用链、相关测试和下一步主 Skill |
| `target-constitution-setup` | 首次完整接入目标项目 / 生成项目画像与宪法设计 | 用户第一次在目标项目使用本包，或要求生成项目画像、宪法设计包、证据绑定的 Agent 宪法时进入 | `项目画像.md`、`宪法设计.md`、schema v2 `.vibe-docs.json` / `文档索引.md`、runtime managed block 和验证证据 |
| `target-runtime-setup` | 刷新或检查 AGENTS.md 与 CLAUDE.md managed block | 目标项目已完成宪法设计层，或用户只要求刷新 / 检查 / 合并 runtime 入口块时进入 | 目标项目短硬 runtime managed block + `.vibe-runtime.json` + dry-run / check 结果 |
| `hotspot-governor` | 核心热区 / 大文件 / 超大组件 / 这一坨太大 | 用户说文件太长、模块越来越大、看不懂、别往这里塞、核心热区、大测试、重复 helper 或需要拆热区时进入 | 热区诊断、拆分路线和后续路由建议 |
| `dev-builder` | 开始开发 / 继续开发 | 命中明确开发意图且计划就绪时进入 | 代码 + 验证证据 |
| `requirements-test-designer` | PRD / 需求文档 -> 工程级测试用例体系 | 用户明确要求把 PRD、需求文档、用户故事、验收标准、接口说明或设计稿说明转成生产级测试用例、追溯矩阵或测试管理工具导出时进入 | 稳定 REQ-ID / TC-ID、测试用例体系、追溯矩阵、自动化候选和导出友好字段 |
| `test-automation` | 自动化测试 / E2E / 回归测试 / 测试覆盖 | 总入口指定 `test-automation` 后进入 | 严格 TDD + seam-first 测试体系诊断 + 测试代码 / 配置 + RED / GREEN fresh 证据 |
| `bug-fixer` | 功能坏了 / 报错 / 白屏 / 转圈圈 / 一堆红字 / 点了没反应 | 命中明确故障、异常或报错时进入 | red-capable feedback loop + 修复结果 |
| `doc-sync-guardian` | 补文档 / 防漂移 | 命中明确文档同步、规则变更或漂移风险时进入 | 同步后的文档 |
| `code-review` | review / 查漏补缺 | 用户明确要求审查、检查质量或核对完整性，或 T2+ 按 review profile 收口时进入 | 双阶段审查报告 + finding ledger delta + Review Receipt |
| `release-builder` | 打包 / 部署 / 上线 | 命中明确交付、打包、部署或发布意图时进入 | 发布产物 |
| `skill-builder` | 创建新 Skill | 用户明确提出时进入 | 带 invocation / context-load 决策的新 Skill 骨架 |
| `feedback-writer` | 记录 `package-feedback` 信号 | 仅由 `feedback-observer` structured-event caller 调用；普通自然语言和总入口 ID 均拒绝 | package feedback 文档 |
| `evolution-engine` | 扫描可升级的 `package-feedback` 规则 | 仅由 `evolution-runner` / SessionStart structured-event caller 调用；普通自然语言和总入口 ID 均拒绝 | 需用户确认的进化提案 |
| `rule-harvester` | 规则淘金：扫描项目扩展区与全局，纠正放错位置的规则、把通用规则半自动回流进本包源码 | 用户说"淘金规则 / 看看规则放对没 / 收敛通用规则"时手动进入 | 放错纠正 + 通用回流提议（经确认写入 `init-target-runtime.mjs` 并刷新） |
| `experience-elevator` | 目标项目经验四级向上升级（L0 经验教训 → L1 宪法设计 → L2 项目规则 → L3 checker 硬门槛） | 仅由有效 `target-project` Hook structured-event 信号触发 AI 判断并记录 L0；普通自然语言和总入口 ID 均拒绝 | `docs/项目治理/经验治理.md` 计数、达阀值提议与用户确认凭据，不自行跨域双写或自动升级 |

设计质量层边界：明确对象和动作的 UI 微调快车道不进入设计质量层；`code-review` 负责代码 / Spec / 实现完整性审查；`audit` 负责 accessibility / performance / theming / responsive / anti-pattern 技术审计；`critique` 负责设计判断与 UX 反馈；`ui-ux-pro-max` 负责设计增强资料与规则建议。动效与打磨边界：`animate` 负责 motion / transition / micro-interaction 专项；`delight` 负责情绪 / 惊喜 / 人格化体验；`polish` 负责交付前一致性和细节 QA。外部强规划 Skill 边界：`superpowers:brainstorming` 不能替代本包默认产品 / 设计 / 开发主链路；普通页面设计规划继续走 `product-spec-builder -> design-brief-builder -> design-maker -> dev-planner / dev-builder`。

## 恢复提示

- 本分发包维护时先看 `Product-Spec.md` 和 `DEV-PLAN.md`
- 目标项目先看 schema v2 `.vibe-docs.json` 与 `文档索引.md`；启用 `taskContext` 时先读当前 `任务状态.json` 与执行光标片段，再由 resolver 按角色 / selector 读取需求、计划、验收或契约，不默认全文恢复。
- 目标项目如 `任务状态.json` 的状态为 `doing` / `blocked`，先恢复当前任务；不要把 `docs/plans/执行光标.md` 当可写真源。
- legacy v1 只在用户明确要迁移时运行 `migrate-target-doc-system.mjs`；默认 dry-run，`--write` 才允许 CAS / journal 落盘。
- 需要查入口规则时，看 `beginner-flow-guide` 和 `vibe-coding-skills`
