---
name: dev-plan-template
description: 开发计划输出模板。分析 Product Spec 后，按此模板结构填充内容，输出为目标项目四字中文 .md 文件，供 dev-builder 按 Phase 逐步开发。
---

# 开发计划输出模板

本模板用于生成分阶段开发计划。dev-builder 读取此文档按 Phase 逐步实现代码。

---

## 模板结构

**文件命名**：docs/项目治理/开发计划.md
**文档映射**：`.vibe-docs.json` 中 `devPlan = "docs/项目治理/开发计划.md"`

命名规则：
- 新目标项目生命周期 `.md` 文档文件名必须是正好 4 个汉字
- 新项目开发计划默认路径固定为 `docs/项目治理/开发计划.md`
- 新项目当前执行光标默认路径固定为 `docs/plans/执行光标.md`
- 新项目人工验收记录默认路径固定为 `docs/项目治理/验收记录.md`，并映射为 `.vibe-docs.json.manualAcceptance`
- 新项目接口契约台账默认路径固定为 `docs/接口契约.md`，并映射为 `.vibe-docs.json.interfaceContracts`
- 新项目 Phase 明细默认使用 `docs/plans/第一阶段.md`、`docs/plans/第二阶段.md` 这类四字中文文件名
- 不允许在新目标项目里生成 `DEV-PLAN.md`、`plans/CURRENT-EXECUTION.md` 或 `plans/phase-N.md`

---

```markdown
# Development Plan — [项目名称]

> 本文件记录项目的开发阶段划分、当前进度和剩余工作。
> 新 session 启动时应首先阅读此文件，了解项目状态后再继续开发。

---

## 当前状态

- **当前阶段**：[未开始 / Phase N / 已完成]
- **当前进度**：[一句话说明目前做到哪里]
- **下一步**：[下一条最具体的执行动作]
- **当前执行状态文件**：`docs/plans/执行光标.md`（如不存在，表示当前没有活跃执行光标）
- **人工验收记录文件**：`验收记录.md`（如不存在，表示尚未发生需要用户确认的人工验收）
- **接口契约文件**：`接口契约.md`（新增或修改真实接口前必须读取）
- **恢复规则**：如 `docs/plans/执行光标.md` 的状态为 `doing` 或 `blocked`，新 session 先恢复或对账该任务，再决定是否开始新 Task

## 执行语境

| 项目 | 设定 | 说明 |
|------|------|------|
| 交付模式 | <vibe / standard> | <为什么按这个模式推进> |
| 用户类型 | <新手 / 有经验开发者 / 团队负责人> | <谁在主导开发> |
| 协作方式 | <单人 + AI / 双人 / 多人协作> | <默认按谁来拆任务> |
| 默认时间尺度 | <当前 session / 今天 / 多轮迭代 / 周级排期> | <默认用什么粒度规划和汇报> |
| 成功标准 | <先跑通主链路 / 先看到结果 / 再补工程化> | <当前阶段最优先完成什么> |
| 回复约束 | <优先说“这轮 / 下一轮”，不默认说“几周 / Sprint”> | <后续开发回复要遵守什么口径> |

## 补充计划文档索引（可选）

- [无；如需要拆分详细任务清单，再列出 `docs/plans/*.md` 路径、适用 Phase 和用途]
- [已归档的历史明细写入 `docs/plans/archive/`，不占用活动索引]
- [`docs/plans/第一阶段.md` 使用结构化任务表，状态枚举固定为 `todo / doing / blocked / done`]

---

## 代码组织策略

| 项目 | 设定 | 说明 |
|------|------|------|
| 策略类型 | <feature-first / legacy-incremental / 平台默认结构> | <为什么按这种方式组织代码> |
| 业务代码位置 | <src/features/* / 跟随现有结构并增量收口> | <新功能主要放哪里> |
| 共享能力位置 | <src/shared/* / 跟随现有结构> | <什么才算共享能力> |
| 基础设施位置 | <src/core/* / 跟随现有结构> | <配置、数据库、API 客户端等放哪里> |
| 迁移策略 | <新项目默认 / 已有项目渐进演进> | <是否允许整体迁移旧目录> |

填写规则：
- 新 Web / Desktop 项目默认写 `feature-first`，并说明为什么让业务代码进入 `src/features/*`、共享能力进入 `src/shared/*`、基础设施进入 `src/core/*`
- 已有项目默认写 `legacy-incremental`，并说明哪些目录继续沿用、哪些新增能力要局部收进 feature 模块
- 如果产品不是 Web / Desktop，可以写 `平台默认结构`，但要明确说明为什么不套用本轮模块化策略

---

## 技术栈 Profile

| 项目 | 设定 | 说明 |
|------|------|------|
| Platform Profile | <Web / Desktop / CLI / Mobile / Backend / Library / Agent> | <产品形态如何影响实现路线> |
| Language Adapter | <TypeScript / Python / Go / Rust / Java / C# / PHP / Swift / Dart / 既有项目语言> | <语言运行时、包管理器和测试工具依据> |
| Architecture Profile | <frontend / fullstack / service / worker / library / desktop-shell / mobile-app / cli-tool / cli-agent> | <架构形态如何影响目录、接口和部署> |
| Scaffold Policy | <template / platform-default / existing-incremental / ask-once> | <是否使用内置模板；未使用时沿用什么平台约定> |
| Fallback Stack | <不适用 / 已确认 / 需确认> | <技术栈缺失时问过什么关键问题或继承了什么现有痕迹> |

填写规则：
- 只有明确匹配 Web / Desktop / Node CLI 的新项目才写 `Scaffold Policy = template`。
- Backend、Library、Mobile、非 Node CLI 默认写 `platform-default` 或 `existing-incremental`，不要规划 `src/shared/ui`、Web UI 门禁或 JS / TS 模板。
- 技术栈仍不明确时，写 `ask-once`，并把需要用户确认的问题写进“下一步”。

---

## 术语对齐

| 项目 | 设定 | 说明 |
|------|------|------|
| 术语来源 | <需求文档.md → 术语与命名规范> | <本轮以哪份持久化规则为准> |
| 本轮核心对象 | <列出 1-3 个本轮最关键的对象名> | <后续实现和汇报统一怎么称呼> |
| 禁用别名 | <列出不再继续混用的别名> | <为什么这些叫法会造成漂移> |
| 回写规则 | <新增术语先改 Product-Spec，再改 DEV-PLAN / 代码> | <什么时候必须回写> |

填写规则：
- `术语来源` 默认指向目标项目需求文档的“术语与命名规范”
- 如果本轮新增核心对象名，必须明确写出回写规则，不能只在实现时临时起名
- 如果用户是小白、术语来自大白话归纳，也要把最终统一口径写在这里

### 本轮术语变更清单

| 对象ID | 变更类型 | 影响范围 | 必须回写文件 | 完成状态 |
|------|----------|----------|--------------|----------|
| <stable-kebab-case-id> | <新增 / 重命名 / 废弃 / 沿用> | <受影响的 Phase / 模块 / 页面 / 文档> | <需求文档.md / 开发计划.md / README.md / 代码模块等> | <todo / doing / blocked / done> |

填写规则：
- 小节标题固定写 `### 本轮术语变更清单`，不要改名
- 表头固定为：`对象ID | 变更类型 | 影响范围 | 必须回写文件 | 完成状态`
- `对象ID` 必须引用目标项目需求文档术语注册表里的已有行；如果是本轮新增，先补 Spec 再回到这里引用
- `变更类型` 只允许：`新增 / 重命名 / 废弃 / 沿用`
- `完成状态` 只允许：`todo / doing / blocked / done`
- 本轮准备新增、重命名或废弃术语时，必须在这里显式登记，不能只在交付描述里暗示

---

## 预实现一致性分析

| 核对对象 | sourceRevision | 分析证据 | 分析结论 | 关联 Phase / Task | 阻断项 |
|----------|----------------|----------|----------|-------------------|--------|
| <需求、验收、术语、接口契约、测试策略、Phase/Task 映射、依赖顺序> | <当前来源修订> | <来源 section / 契约 ID / 测试策略或依赖比较结果> | <PASS / BLOCKED> | <Phase / Task ID> | <无 / Critical / Important 矛盾与处理路径> |

填写规则：
- 仅 T2/T3 在首个 RED 前填写；T0/T1 快车道不创建该分析。
- 每一行必须能追溯到既有需求、计划、Phase 明细或契约；任务胶囊只能记录回执，不成为第二份计划真源。
- `分析证据` 必须指向来源 section、契约 ID、测试策略或依赖比较结果，不能只写“已核对”。
- 存在未解决 Critical / Important 矛盾，或需求澄清记录有 `未决 / blocked` 时，分析结论为 `BLOCKED`，不得进入生产代码。

---

## 测试与验证策略

| 项目 | 设定 | 说明 |
|------|------|------|
| 默认策略 | 严格 TDD | 除 visual-only T1 受控例外外，所有新功能、bug 修复、重构和行为变更强制 RED-GREEN-REFACTOR |
| RED 计划 | <测试文件 / 最小用例 / 命令 / 正确失败原因> | 未实际看到正确 RED 前不得写生产代码 |
| GREEN 边界 | <只够通过当前测试的生产代码范围 / 回归命令> | 禁止额外功能、提前抽象和无关清理 |
| REFACTOR 范围 | <全绿后允许的整理> | 不新增行为，整理后继续全绿 |
| 例外审批 | <原型 / 生成代码 / 配置文件，或不适用> | 写生产代码前获得用户明确批准，记录替代验证、风险和恢复方案；无法自动化不属于例外类型 |
| 受控 T1 | visual-only T1 受控例外 | 边界核对通过且没有既有测试 / visual regression seam 时，记录 seam 结论、改前基线、改后同路径定向视觉证据与副作用检查；已有 seam 或越界时回到 RED-GREEN-REFACTOR |
| 分支化完成证据 | 严格 TDD Task：<RED 失败 + GREEN 通过 + 必要回归>；受控 T1 Task：<边界 + seam + 基线 + 同路径证据 + 副作用> | 编译、启动、smoke 和人工验收只能补充，不能替代对应分支的主证据 |

填写规则：
- 这一节默认继承目标项目需求文档的“测试与验证策略”，不要另起一套口径
- 默认策略是严格 TDD，目标项目文档不得降低为事后补测
- 每个严格 TDD Phase 的验收标准都要写清 RED 测试与正确失败原因、GREEN 最小实现与全绿结果、REFACTOR 后回归；受控 T1 Phase 改写为对应的分支证据
- 只有原型、生成代码或配置文件可申请例外；无法自动化本身不构成例外资格，未获用户明确批准不得写生产代码
- visual-only T1 受控例外不是“难自动化”例外，只能在边界核对通过且没有既有 seam 时使用；必须记录 seam 结论、基线、同路径证据和副作用检查，任务扩大就重新分级

---

## 人工验收与回归保护

| 项目 | 设定 | 说明 |
|------|------|------|
| 验收记录文件 | `验收记录.md` | 通过 `.vibe-docs.json.manualAcceptance` 映射 |
| 状态枚举 | `不适用 / 待用户验收 / 用户已确认 / 需回归复验` | 用户未明确确认前不得写成已通过 |
| 触发场景 | <UI / 设计 / CLI 人机流程 / 权限确认 / 端到端链路 / 发布安装等> | 自动化无法完全证明时必须提醒用户人工验收 |
| 交付提醒 | <真实点击路径 + 人工重点 + 自动化覆盖 + 回归触发条件> | 交付时必须列出，不用泛泛提醒 |
| 回归保护 | <影响分析优先，自动化优先> | 后续改动命中已验收范围时，优先自动化回归；无法覆盖才复验受影响路径 |

填写规则：
- 每个 Phase 的验收标准都要写明人工验收状态，不能只写“测试通过”
- 纯内部逻辑、类型定义或文档同步可写 `不适用`，但要说明原因
- 用户确认后，记录到 `验收记录.md` 的“已确认记录”；开发完成但未确认时，记录或提醒为“待验收”
- 后续 Phase 如影响已确认记录，必须写出影响面和是否需要 `需回归复验`

---

## 接口契约治理

| 项目 | 设定 | 说明 |
|------|------|------|
| 契约台账 | `接口契约.md` | 通过 `.vibe-docs.json.interfaceContracts` 映射 |
| 默认原则 | 同一业务能力一个统一契约入口 | endpoint、service、public entry、server action、fetch wrapper、IPC / event、schema 都先查台账再新增 |
| 新增条件 | <能力边界差异 / 迁移关系 / 调用方影响 / 测试证据> | 无法说明差异时不得新增平行接口 |
| 门禁命令 | `node tools/check-api-contracts.mjs .` | 新增或修改 API route、fetch、service/public entry、server action、IPC / event、schema 后运行 |

填写规则：
- 每个 Phase 如涉及接口，必须列出受影响的 `能力ID`。
- 如果只是 UI 呈现或占位，写“本 Phase 不新增真实接口”。
- 新增 endpoint 前，先判断是否应扩展已有能力契约；不能把同一功能拆成多个临时接口。
- `入口类型` 只允许 `endpoint / service / publicEntry / schema / event / none`；server action 通常登记为 `publicEntry` 或 `service`，fetch wrapper 登记为 `service`，IPC / event 通道登记为 `event`。

---

## Phase 1: [功能名称]

**交付内容**：
- [用动词开头，描述交付物1——用户能做什么 / 系统做什么]
- [交付物2]
- [交付物3]

**不做边界/停止条件**：
- [本 Phase 明确不做的 1-3 项：写“不做什么”而不是“少做什么”，例如“不做 XX 失败重试，失败直接报错”]
- [停止线：满足下方验收标准即停止，不顺手加固、重构或补本 Phase 未列的状态与功能]

**关键文件**：
- `src/path/to/file1.tsx` — [用途说明]
- `src/path/to/file2.ts` — [用途说明]
- `src/path/to/file3.ts` — [用途说明]

**模块设计**：
- `[模块名]`
  职责：[这个模块负责什么，不负责什么]
  公共入口：`src/path/to/index.ts`
  依赖约束：[允许依赖哪些层；禁止直连哪些内部实现]
  接口契约：[不涉及真实接口 / 复用 `能力ID` / 新增 `能力ID`，对应 `接口契约.md` 行]
- `[第二个模块名]`（如有）
  职责：[职责]
  公共入口：`src/path/to/index.ts`
  依赖约束：[约束]
  接口契约：[不涉及真实接口 / 复用 `能力ID` / 新增 `能力ID`，对应 `接口契约.md` 行]

**验收标准**：
- [能编译、能启动、能看到XX效果]
- 人工验收状态：[不适用 / 待用户验收 / 用户已确认 / 需回归复验]
- 人工验收路径：[如适用，列出用户真实点击 / 操作 / 观察路径；不适用则说明原因]
- 回归触发条件：[后续哪些文件、模块、接口、数据结构或 UI 变更会影响本 Phase 已验收范围]
- 接口契约门禁：[不适用 / `node tools/check-api-contracts.mjs .` / `npm run check:api-contracts`]

---

## Phase 2: [功能名称]

**交付内容**：
- [交付物列表]

**不做边界/停止条件**：
- [本 Phase 明确不做的 1-3 项]
- [停止线：满足验收标准即停止]

**关键文件**：
- [文件路径 + 用途]

**模块设计**：
- [模块名]
  职责：[职责]
  公共入口：`src/path/to/index.ts`
  依赖约束：[允许依赖哪些层；禁止直连哪些内部实现]
  接口契约：[不涉及真实接口 / 复用 `能力ID` / 新增 `能力ID`，对应 `接口契约.md` 行]

**验收标准**：
- [验证标准]
- 人工验收状态：[不适用 / 待用户验收 / 用户已确认 / 需回归复验]
- 人工验收路径：[如适用，列出用户真实点击 / 操作 / 观察路径；不适用则说明原因]
- 回归触发条件：[后续哪些文件、模块、接口、数据结构或 UI 变更会影响本 Phase 已验收范围]
- 接口契约门禁：[不适用 / `node tools/check-api-contracts.mjs .` / `npm run check:api-contracts`]

---

<根据实际功能数量动态增减 Phase>

---

## 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| [层级名] | [技术名] | [版本号] | [选择理由或用途] |

## 数据库表（如有）

| 表名 | 所属 Phase | 用途 |
|------|-----------|------|
| `table_name` | Phase N | [用途说明] |

## 开发规则

- 每完成一个 Phase 执行四步走：Code Review → 验证完整性 → 编译验证 → 功能测试
- 新增或修改真实接口的 Phase 必须先更新 `接口契约.md` 并运行接口契约门禁
- 每完成一个 Phase 判断人工验收状态：需要真实点击 / 操作 / 观察时，提醒用户验收；用户确认后写入 `验收记录.md`
- 四步走全部通过后才能 commit
- Commit message 格式：`phase-N: 简要描述`
- 包管理器：[pnpm/npm/yarn]
```

---

## 完整示例

以下是「Forge — 本地 AI 桌面代理」项目的 DEV-PLAN 片段，供参考：

```markdown
# Development Plan — Forge

> 本文件记录 Forge 项目的开发阶段划分、当前进度和剩余工作。
> 新 session 启动时应首先阅读此文件，了解项目状态后再继续开发。

---

## 执行语境

| 项目 | 设定 | 说明 |
|------|------|------|
| 交付模式 | vibe | 单人 + AI 的本地原型开发 |
| 用户类型 | 有一定工具经验的独立开发者 | 需要先把核心路径跑通 |
| 协作方式 | 单人 + AI | 不默认多人并行排期 |
| 默认时间尺度 | 本轮 / 今天 | 按可见成果推进 |
| 成功标准 | 先能聊天并持久化 | 再补更多工作台能力 |
| 回复约束 | 优先说“这轮 / 下一轮” | 不默认给“2 周里程碑” |

---

## 测试与验证策略

| 项目 | 设定 | 说明 |
|------|------|------|
| 默认策略 | 严格 TDD | 除 visual-only T1 受控例外外，全部新增或改变的可观察行为强制 RED-GREEN-REFACTOR |
| RED 计划 | 每个 Task 先写最小失败测试，记录命令和正确失败原因 | RED 未成立不得实现 |
| GREEN 边界 | 只写让当前测试通过的最小生产代码，并跑相关回归 | 全部通过后才算 GREEN |
| REFACTOR 范围 | 全绿后只整理重复、命名和 helper | 不新增行为，整理后继续全绿 |
| 例外审批 | 仅原型、生成代码或配置文件先请求用户明确批准 | 记录批准范围、替代验证、风险和恢复方案；无法自动化不属于例外类型 |
| 受控 T1 | 边界核对通过且没有既有测试 / visual regression seam 的呈现微调 | 记录 seam 结论、改前基线、改后同路径定向视觉证据与副作用检查；已有 seam 仍先 RED |
| 分支化完成证据 | 严格 TDD Task 记录 RED/GREEN/回归；受控 T1 Task 记录边界/seam/基线/同路径证据/副作用 | 没有对应分支的 fresh 主证据不能汇报“完成” |

---

## Phase 1: Electron + Next.js 骨架

**交付内容**：
- Electron 主进程 + Next.js 渲染器基础框架
- 三区布局：左侧栏（可折叠）+ 主内容区 + 右侧栏（可折叠）
- 标题栏组件（窗口控制按钮）
- 导航图标栏（聊天 / 管理 / IM / 定时 / 设置）
- 深色/浅色/跟随系统主题切换（ThemeProvider）
- Tailwind CSS 语义色彩系统

**不做边界/停止条件**：
- 不做窗口位置记忆、不做自动更新检查；骨架能启动、布局与主题切换可用即停止

**关键文件**：
- `src/app/(workspace)/page.tsx` — 路由壳，负责组装工作台页面
- `src/features/workspace-shell/components/app-layout.tsx` — 主布局
- `src/features/workspace-shell/components/left-sidebar.tsx` — 左侧栏
- `src/features/workspace-shell/components/right-sidebar.tsx` — 右侧栏
- `src/features/workspace-shell/components/title-bar.tsx` — 标题栏
- `src/shared/providers/theme-provider.tsx` — 主题
- `src/app/globals.css` — 色彩变量定义

**模块设计**：
- `workspace-shell` — 桌面工作台骨架与导航布局
  公共入口：`src/features/workspace-shell/index.ts`
  依赖约束：可依赖 `src/shared/*` 与 `src/core/*`；页面壳只通过模块入口装配，不直接碰内部组件实现

**验收标准**：
- TypeScript 编译无错误
- Electron 窗口可启动，显示三区布局
- 主题切换正常工作

---

## Phase 2: 聊天核心 + SQLite 持久化

**交付内容**：
- SQLite 数据库初始化（better-sqlite3，WAL 模式）
- sessions 和 messages 表
- settings 表（key-value 全局设置）
- 会话 CRUD API（/api/sessions）
- 聊天 API（/api/chat）— Claude API 流式调用 + SSE 输出
- 前端聊天界面：用户消息 + Agent 消息 + 流式渲染
- 会话列表 + 新建会话 + 切换会话

**不做边界/停止条件**：
- 不做消息重发与断线重连，失败直接报错；验收标准通过即停止，不顺手补错误态 UI

**关键文件**：
- `src/core/db/index.ts` — 数据库初始化 + 表创建
- `src/app/api/chat/route.ts` — 聊天 API
- `src/features/chat/hooks/use-chat.ts` — 聊天状态管理
- `src/features/chat/hooks/use-sessions.ts` — 会话管理
- `src/features/chat/components/chat-view.tsx` — 聊天视图
- `src/features/chat/index.ts` — 聊天模块公共入口

**模块设计**：
- `chat` — 会话、消息流和聊天视图
  公共入口：`src/features/chat/index.ts`
  依赖约束：可依赖 `src/core/db`、`src/shared/*`；不允许直接引用其他 feature 的内部文件

**验收标准**：
- 能创建会话、发送消息、收到 Claude 流式回复
- 刷新后会话和消息不丢失

---

## 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 桌面框架 | Electron | 40.x | 跨平台桌面壳 |
| 前端 | Next.js + React | 15.x | 全栈框架 |
| UI | Tailwind CSS | 4.x | 工具类 CSS |
| AI 引擎 | Claude API (@anthropic-ai/sdk) | latest | 核心 AI 能力 |
| 数据库 | SQLite (better-sqlite3) | latest | 本地持久化，WAL 模式 |
| 包管理 | pnpm | 10.x | 快速、磁盘高效 |

## 代码组织策略

| 项目 | 设定 | 说明 |
|------|------|------|
| 策略类型 | feature-first | 新 Desktop 项目默认按功能模块收口 |
| 业务代码位置 | `src/features/*` | 聊天、工作台等业务能力各自独立 |
| 共享能力位置 | `src/shared/*` | 只放被多个 feature 复用的 UI / provider / util |
| 基础设施位置 | `src/core/*` | 数据库、配置、API 客户端等底层能力 |
| 迁移策略 | 新项目默认 | 旧项目不强迁，新增功能再渐进收口 |

## 数据库表

| 表名 | 所属 Phase | 用途 |
|------|-----------|------|
| `sessions` | Phase 2 | 会话元数据 |
| `messages` | Phase 2 | 消息内容（JSON content blocks） |
| `settings` | Phase 2 | 全局 key-value 设置 |
| `skills` | Phase 3 | Skill 定义 |
| `agents` | Phase 3 | Agent 配置 |
| `mcp_servers` | Phase 3 | MCP 服务器配置 |
| `im_channels` | Phase 4 | IM 通道配置 |
| `cron_tasks` | Phase 4 | 定时任务定义 |
| `api_providers` | Phase 5 | 多模型 API 提供商 |
| `workspaces` | Phase 6 | Workspace 定义 |

## 开发规则

- 每完成一个 Phase 执行四步走：Code Review → 验证完整性 → 编译验证 → 功能测试
- 四步走全部通过后才能 commit
- Commit message 格式：`phase-N: 简要描述`
- 包管理器：pnpm
```

---

## 写作要点

1. **Phase 命名**：用功能名称命名，不用编号序列。"聊天核心 + SQLite 持久化"比"Phase 2"更容易理解
2. **执行语境**：
   - 目标项目需求文档里如果已经有“执行语境”，这里必须继承并回显
   - `vibe` 模式默认按单人、短反馈、可见结果导向写，不默认给周级排期
   - `vibe` 模式可以拆更多小 Phase，但每个 Phase 仍要可验证
3. **交付内容**：
   - 用动词开头（搭建、实现、创建、配置）
   - 每条描述一个可感知的交付物
   - 基础设施 Phase 可以写"XX 表 + CRUD API"
   - 业务功能 Phase 要写用户能做什么
   - 每个 Phase 必须写「不做边界/停止条件」：列出本 Phase 明确不做的内容；满足验收标准即停止，不顺手加固
4. **关键文件**：
    - 使用完整的项目内相对路径
    - 每个文件附用途说明
    - 不列测试文件和配置文件（除非是 Phase 的核心交付物）
5. **模块设计**：
   - 每个 Phase 都写 `模块设计`
   - 至少包含：职责、公共入口、依赖约束
   - `依赖约束` 不能只写“按需依赖”，要写清允许依赖哪些层、禁止碰哪些内部实现
   - `feature-first` 时，优先写清 `features/*`、`shared/*`、`core/*` 的边界
   - `legacy-incremental` 时，也要写清哪些旧目录继续沿用、哪些新增能力要局部 feature 化
6. **验收标准**：
   - 最低要求：能编译 + 能启动 + 新功能可用
   - 推荐加上：现有功能未破坏
7. **技术栈表**：
   - 标注版本号（经 WebSearch 验证的最新稳定版）
   - 说明列写选择理由或用途
8. **代码组织策略**：
   - 新 Web / Desktop 项目默认 `feature-first`
   - 已有项目默认 `legacy-incremental`
   - 非 Web / Desktop 可写 `平台默认结构`，但必须说明原因
   - 说明要写清“为什么选这个策略”和“旧代码怎么处理”
9. **数据库表**：
   - 标注在哪个 Phase 创建
   - 后续 Phase 如果新增列（migration），在该 Phase 的交付内容中说明
10. **Phase 顺序**：
   - 基础设施（骨架/数据库/路由）→ 核心功能 → 辅助功能 → 收尾（i18n/打包/部署）
   - 不违反依赖关系
11. **测试与验证策略**：
   - 默认继承目标项目需求文档的“测试与验证策略”
   - 除 visual-only T1 受控例外外，所有包含新功能、bug 修复、重构或行为变更的 Phase 都拆出 RED-GREEN-REFACTOR
   - 验收标准必须包含本轮 RED 正确失败、GREEN 全绿和 REFACTOR 后回归证据；例外必须有用户明确批准
