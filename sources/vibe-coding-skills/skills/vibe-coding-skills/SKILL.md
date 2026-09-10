---
name: vibe-coding-skills
description: '只有用户在当前对话中明确调用 `vibe-coding-skills` 或 `/vibe-coding-skills` 后，才允许把普通自然语言交给总入口路由；唯一用户可见的 Skill 总入口；cmd: /vibe-coding-skills'
user-invocable: true
disable-model-invocation: true
argument-hint: "[skill-id] [任务]"
---
[DocMap]
    层级：L3 / 关键 Skill
    模块：统一入口与分流
    依赖按需读取：
    - `skills/INDEX.md`
    - `DOC-MAP.md`（源码 / safe-lite 维护包可用；pure 运行包不读取）
    - `.vibe-docs.json`（目标项目文件，不是 pure 包内开发元文档）
    - 目标项目需求文档
    - 目标项目开发计划
    输出：
    - 当前阶段判断与下一步 Skill 路由

[任务]
    **唯一用户入口**：用户显式调用 `vibe-coding-skills` 或 `/vibe-coding-skills` 后，打开当前对话的总入口授权闸门。用户可以直接指定 Skill ID（格式为 `vibe-coding-skills <skill-id> <任务>`），也可以在同一轮或后续轮次只说普通自然语言，由总入口使用 `routeHints` 选择下一步；新对话默认未授权。

    **会话授权闸门**：只认用户消息中的 `vibe-coding-skills` / `/vibe-coding-skills`，不认助手文本、普通 Skill 名称或历史其他对话。闸门只在当前对话有效；用户明确说“关闭 / 不要使用 vibe-coding-skills”时立即关闭。未激活时，普通自然语言结果为 `no-skill`，不得读取路由矩阵或具体 Skill。

    **显式路由**：普通用户总入口只允许路由 `router-only`；`event-only` 只能由 structured-event caller 进入，不能通过普通自然语言、routeHints 或用户 Skill ID 进入。未知、缺失或试图直接绕过总入口的 Skill ID 必须停止并说明原因。

    **首次接入**：当用户说第一次在目标项目使用本包、把项目接入 vibe-coding-skills、生成项目画像 / 宪法设计包或初次生成 `AGENTS.md` 与 `CLAUDE.md` 时，先路由到 `target-constitution-setup`；只有目标项目已经完成宪法设计层、用户只要求刷新或检查 runtime managed block 时，才路由到 `target-runtime-setup`。

    **与 beginner-flow-guide 分工**：`beginner-flow-guide` 只是本总入口授权后的新手辅助，不再作为用户自然语言的独立入口。未激活时不自动启动具体 Skill；可以直接回答低风险问题，或说明需要用户先调用总入口。

    **只做分流**：本 Skill 不替代 product-spec-builder、dev-planner、dev-builder、bug-fixer、code-review 等专用 Skill；它只按用户明确的 Skill ID 判断下一步交给谁。

[Step 0：快车道预判]
    Skill 启动后先判断是否能直接轻量闭环，再决定是否读取 `DOC-MAP.md`、`.vibe-docs.json` 或生命周期文档。

    直接快车道条件：
    - 用户已经通过总入口给出明确 Skill ID，以及路径、文件、组件、当前选区、查询范围或非破坏性指定命令。
    - 用户动作明确，例如查规则、改说明文字、定向查询、单文件格式化、跑局部验证或低风险配置。
    - UI 微调也可直接命中：同一组件 / 容器内的大小、位置、间距、颜色、字号、圆角、阴影、透明度等 visual-only 调整，且不改变用户路径、信息层级、响应式结构、全局 token / theme、UI 包契约或真实业务行为。
    - 可判定为 T0/T1，且没有 bug、安全、权限、数据、发布、接口、删除、迁移、Skill / Hook / Tool / Agent 规则等风险信号；高风险任务仍按对应 Skill 的 T3/T3+ 规则执行。
    - 能用回读文件、定向 `rg`、局部脚本或用户指定轻量验证证明结果。

    命中后：
    - 直接定向读写和验证。
    - 不读取 `DOC-MAP.md`。
    - 不恢复 `.vibe-docs.json`、需求文档、设计简报、开发计划或执行光标。
    - 不自动进入 `codebase-memory-scout`、`code-review`、`doc-sync-guardian` 或 health 检查。

[依赖检测]
    Step 0 未命中、且需要阶段判断或手动路由结果时执行。

    可选读取：
    - `skills/INDEX.md`：需要查看 Skill 清单和默认触发边界时。
    - `references/route-matrix.md`：无法凭本文件判断复合意图、设计增强层、测试、发布、review 或缺前置时。
    - `DOC-MAP.md`：只有需要恢复阶段、继续任务或判断本分发包真实状态时读取。
    - `.vibe-docs.json`：只有目标项目需要按角色映射恢复状态时读取。

[第一性原则]
    **单一路由**：闸门关闭时不接受自然语言路由；闸门打开后每次只选择一个明确的下一步 Skill，不把未授权的自然语言猜测结果当作用户授权。

    **主链路优先**：总入口只按用户指定的 `router-only` Skill ID 或已激活后的 routeHints 执行；需要连续阶段时，由当前 Skill 明确路由到下一个 `router-only` Skill，不从普通措辞自动猜入口，也不路由 `event-only`。

    **增强层按需**：配色、字体、tokens、design system、样式体系、critique、audit、polish、布局、排版或打磨只能作为总入口下的 `routeHints`，不能独立触发对应 Skill。

    **测试语义独立**：自动化测试、E2E、回归、覆盖率、Playwright、Vitest、pytest 由用户显式指定 `test-automation`；定时任务、周期提醒和办公自动化交给宿主自动化能力。

    **代码图只做辅助**：用户明确提到 codebase-memory、代码地图、调用链、影响面，或 T2/T3 且入口 / 调用链 / 影响面不明时，才进入 `codebase-memory-scout`。

    **前置优先**：缺需求、设计简报、开发计划或执行语境时，先路由到能补前置的上一步 Skill，不硬跳到后续实现。

    **执行强度优先**：先判定 T0/T1/T2/T3；T0/T1 轻量推进，T2/T3 才进入完整专业流程。分类不确定时升到 T2/T3；但明确对象、明确动作且 visual-only 的 UI 微调不因“布局 / 间距 / 对齐 / polish”等词被当作不确定。

    **目标接入独立**：首次接入目标项目先建立证据绑定的项目画像与宪法设计，再由 `target-constitution-setup` 衔接轻量 runtime 入口；不复制本包完整 `AGENTS.md` / `CLAUDE.md`，不自动体检，不自动进入开发。

[按需加载 references]
    本 Skill 的 `SKILL.md` 只保留总入口、快车道和最小路由原则。不要默认读取全部 references。

    | Reference | 读取时机 |
    | --- | --- |
    | `references/route-matrix.md` | 需要完整中文场景映射、路由维度、阶段映射或缺失前置处理时。 |

[输出契约]
    - 先说当前判断属于哪个中文阶段。
    - 只给一个下一步 Skill 或直接动作。
    - 说明为什么是这一步，不是更重链路或别的阶段。
    - 缺前置文件时，直接指出缺什么和先补哪一步。
    - 没有 Skill ID 时只列出可用 ID 和调用格式；不把自然语言匹配结果当成已授权路由。

[工作流程]
    1. 先检查当前对话是否已经由用户明确调用总入口；未激活时只返回 `no-skill` 或说明调用格式，不读取具体 Skill。
    2. 已激活时，优先解析显式 Skill ID；没有 ID 时才用普通自然语言查 `routeHints`，再交给 `beginner-flow-guide` 或唯一下一步 Skill。
    3. 校验 invocation 状态；`router-only` 才能由总入口路由，`event-only` 只能在结构化事件上下文中使用。
    4. 读取选定 Skill 的 `SKILL.md`，再按需读取其 reference。
    5. 按选定 Skill 的 execution tier、验证和人工验收规则执行。

[初始化]
    执行 [Step 0：快车道预判]。
