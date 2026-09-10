# Vibe Coding Skills Route Matrix

> 来源：vibe-coding-skills/SKILL.md 的长场景映射与路由策略。
> 读取时机：需要完整中文场景映射、路由维度、阶段映射或缺失前置处理时。

> 重要边界：本表中的自然语言只作为已激活总入口的 `routeHints`，不会直接启动对应 Skill。用户必须先在当前对话调用 `vibe-coding-skills`；激活后可以指定 Skill ID，也可以让后续普通自然语言按提示路由。新对话未激活时记为 `no-skill`，不独立加载具体 Skill。

## 新手场景映射

- 不知道下一步 / 不会用 skills：当前对话已激活 `vibe-coding-skills` 后，再由总入口调用 `beginner-flow-guide`；未激活时不独立加载 Skill。
- 第一次在目标项目使用本包 / 接入 vibe-coding-skills / 生成项目画像、宪法设计包或初次生成 `AGENTS.md` 与 `CLAUDE.md`：先路由到 `target-constitution-setup`，完成宪法设计层后再进入 `target-runtime-setup`；已有宪法设计、只刷新 managed block 时直接走 `target-runtime-setup`。
- 想加功能 / 改需求 / 改界面：总入口的 `routeHints` 指向 `product-spec-builder`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想做前端页面设计 / 页面风格 / 页面方案：总入口的 `routeHints` 指向 `design-brief-builder`；Design Brief 定下来后再由总入口指定 `design-maker`。
- 想补配色 / 字体 / tokens / design-system / 样式体系：routeHints 指向 `ui-ux-pro-max`、`design-system`、`ui-styling` 或 `brand`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想初始化组件库 / 补 token / 补组件 / 治理 UI 债务 / 统一样式 / 修复 `check-ui-reuse`：routeHints 指向 `ui-system-guardian`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 只想调同一组件 / 容器内 UI 大小、位置、间距、颜色、字号、圆角、阴影、透明度等 visual-only 微调：走 T1 快车道，不路由到设计质量层。
- 想做 critique / audit / polish / 布局 / 排版 / 打磨：routeHints 指向对应 Skill，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想做移动端适配 / 响应式：routeHints 指向 `adapt`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想加微交互 / 过渡 / motion：routeHints 指向 `animate`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想更大胆 / 更有冲击力：routeHints 指向 `bolder`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想让错误提示或文案更清楚：routeHints 指向 `clarify`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想加一点颜色 / 更有色彩：routeHints 指向 `colorize`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想加惊喜感 / 更有趣 / 人格化体验：routeHints 指向 `delight`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想简化 / 减少噪音：routeHints 指向 `distill`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想补空状态 / 边界情况 / 生产可用：routeHints 指向 `harden`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想修页面卡顿 / 性能：routeHints 指向 `optimize`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想做惊艳 / 高阶动效：routeHints 指向 `overdrive`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想更克制 / 太花需要降噪：routeHints 指向 `quieter`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 总入口指定 `shape` 或用总入口路由 shape：加载 `shape`；普通页面设计规划仍走 `design-brief-builder` 的 routeHints。
- 想规划开发顺序：routeHints 指向 `dev-planner`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想先用 codebase-memory / 代码地图 / 调用链 / 影响面缩小范围：routeHints 指向 `codebase-memory-scout`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想开始开发 / 继续开发：routeHints 指向 `dev-builder`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想加自动化测试 / 补 E2E / 跑回归 / 提高测试覆盖 / 接入 Playwright / Vitest / pytest：routeHints 指向 `test-automation`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 功能坏了 / 报错 / 不正常：总入口的 `routeHints` 指向 `bug-fixer`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想检查有没有漏 / 做 review：routeHints 指向 `code-review`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想同步文档 / 防漂移：routeHints 指向 `doc-sync-guardian`，只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 想打包 / 部署 / 上线：总入口的 `routeHints` 指向 `release-builder`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。

## 路由维度

必须判断：

- 用户当前意图：提想法、改需求、做设计、写代码、修 bug、review、发布。
- 测试自动化意图：是否明确出现自动化测试、E2E、回归、覆盖率、Playwright、Vitest、pytest。
- 代码图侦察意图：是否明确出现 codebase-memory、代码地图、调用链、影响面，或是否属于 T2/T3 且入口 / 调用链 / 影响面不明。
- 显式调用：用户是否已经在当前对话通过 `vibe-coding-skills` 打开授权闸门；若同时指定 Skill ID，直接执行，不二次分流；未指定 ID 时才允许用自然语言查 `routeHints`。
- 执行强度：T0 trivial、T1 light、T2 standard、T3 strict。
- 当前文档状态：是否存在 `.vibe-docs.json`、需求文档、设计简报、开发计划。
- 当前工程状态：是否已有代码、是否已出现编译 / 运行 / 功能异常。
- 技术栈状态：是否已有 platform profile、language adapter、architecture profile、scaffold policy 和 fallback stack。

推荐判断：

- 任务类型：新增能力、修改既有逻辑、诊断故障、质量审查、交付上线。
- 用户说的是普通页面设计，还是已经明确卡在设计系统 / 样式体系 / 页面打磨。
- 阻塞点：当前最缺的是需求、计划、实现，还是修复。
- 风险级别：明显故障或报错只作为 `bug-fixer` routeHint；没有总入口授权不加载。
- 行为层改动但文档未同步：优先 `doc-sync-guardian`。
- 执行语境：是否已有 `交付模式 = vibe / standard`。

## 路由策略

- 显式优先：用户已经通过总入口明确指定具体 Skill ID 时，直接执行该 Skill；仅打开总入口而未指定 ID 时，后续自然语言才可在本对话内查 `routeHints`。
- T0：低风险错字、注释、纯说明文字，直接动作 + diff 摘要。
- T1：小范围 UI copy、样式、同一组件 / 容器内 visual-only UI 微调、低风险配置、定向查询、单文件格式化或非破坏性指定命令，微计划 + 定向验证；不默认跑 `check-ui-reuse`、health、完整视觉验收或设计质量层。
- T2：普通功能、组件、状态逻辑，默认短计划 + 定向验证。
- T3：bug、安全、权限、数据、发布、Skill / Hook / Tool / Agent 路由变更，走 strict 根因、回归、review、doc-sync。
- T3+ 风险信号：auth、permission、security、token、secret、payment、database、migration、data loss、filesystem、shell、network、eval、pre-commit、hook、agent routing、Skill / Hook / Tool 规则、release / deploy / publish、删除 / 重命名 / 迁移行为文件、影响面无法可靠判断；这些信号不得走 T0/T1 快车道。
- 混合批次按最高 tier 处理；分类不确定时升到 T2/T3。

## 设计质量层边界

- 明确对象和动作的 UI 微调快车道不进入设计质量层；只有完整设计质量、响应式结构、系统治理、审计或用户显式点名时才进入。
- 代码 / Spec / 实现完整性、查漏补缺：`code-review`。
- accessibility / performance / theming / responsive / anti-pattern 技术审计：`audit` 或 `optimize`。
- 设计判断、视觉层级、信息架构和 UX 反馈：`critique`。
- 资料 / 规则增强、配色、字体、tokens、design system：`ui-ux-pro-max` / `design-system` / `ui-styling` / `brand`。
- motion / transition / micro-interaction：`animate`。
- 情绪 / 惊喜 / 人格化体验：`delight`。
- 交付前一致性和细节 QA：`polish`。

## 阶段映射

- 描述产品想法、功能需求、界面调整、需求变更：routeHints 指向 `product-spec-builder`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 已有需求文档，要明确视觉方向或设计风格：routeHints 指向 `design-brief-builder`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 已有需求文档和设计简报，要生成完整设计稿：routeHints 指向 `design-maker`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 已有需求文档但没有开发计划，或要规划开发阶段：routeHints 指向 `dev-planner`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 首次把目标项目接入 Codex / Claude 双运行时入口：`target-constitution-setup`，由它完成项目画像与宪法设计后衔接 `target-runtime-setup`。
- 已有需求文档和开发计划，要开始开发或继续下一个 Phase：routeHints 指向 `dev-builder`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 明确要求代码图、调用链、影响面，或主 Skill 判断影响面不明：routeHints 指向 `codebase-memory-scout`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 报告 bug、报错、异常、功能坏了：routeHints 指向 `bug-fixer`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 自动化测试、E2E、回归、覆盖率、测试框架：routeHints 指向 `test-automation`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 初始化组件库、补 token、补组件 / variant、治理 UI 债务、统一样式或修复 `check-ui-reuse`：routeHints 指向 `ui-system-guardian`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 定时任务、周期提醒、自动化办公且没有测试语义：使用当前运行时自动化 / 提醒工具，不路由到 `test-automation`。
- 同步文档、避免漂移、更新 README / Spec / Plan / 主控规则：routeHints 指向 `doc-sync-guardian`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- review、检查质量、核对完整性：routeHints 指向 `code-review`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。
- 打包、部署、发布、上线：routeHints 指向 `release-builder`；只有当前对话已激活总入口后才加载，激活后可由自然语言 routeHints 选择或直接指定。

## 缺失前置

- 目标 Skill 缺前置文件时，不硬跳；先路由到能补前置的上一步 Skill。
- 多个 Skill 都能做时，选最靠前的阻塞点，而不是最晚的目标。
- 用户明确说 `vibe coding`，但需求文档缺少“执行语境”章节时，优先 `product-spec-builder` 补写，再进入规划或开发。
