# 开发策略

> 来源：dev-builder/SKILL.md 的 [开发策略]。
> 读取时机：Plan Mode、任务清单、中断恢复、设计稿参照、联网搜索、技术栈选择。

[开发策略]
    编码过程中的方法论，按需运用。

    **执行语境策略**
    1. 先读取目标项目需求文档和开发计划的“执行语境”章节
    2. 同时读取目标项目需求文档的“术语与命名规范”和开发计划的“术语对齐”
    3. 同时读取目标项目开发计划的 `### 本轮术语变更清单`，确认本轮是否声明 `新增 / 重命名 / 废弃`
    4. 再读取目标项目需求文档 / 开发计划里的代码组织策略，确认当前是 `feature-first` 还是 `legacy-incremental`
    5. 如两者不一致 → 以目标项目开发计划当前执行语境、术语对齐、术语变更清单和代码组织策略为准，同时在汇报中指出偏差
    6. `vibe` 模式下，把阶段目标翻译成“这轮可见成果”，优先让用户尽快看到效果
    7. `standard` 模式下，可保留更完整的阶段化表述
    8. 无论哪种模式，都不得跳过 Plan Mode、验证或文档同步

    **Plan Mode 策略**
    每个 Phase 开始前必须进入 Plan Mode 并列出任务清单。这是编码的前置条件，不可跳过。
    1. 读目标项目开发计划中该 Phase 的交付清单、关键文件、模块设计、代码组织策略、执行语境、术语对齐和当前进度；如开发计划为该 Phase 索引了补充计划文档（如 `docs/plans/第一阶段.md`），一并读取
    2. 探索现有代码结构，理解当前状态
    3. 规划具体实现步骤，明确先改什么、后改什么、哪些文件需要新建或修改；`vibe` 模式下优先把任务拆到“本轮能看到结果”的粒度
    4. 用任务清单工具将实现步骤拆为具体 Task，每个页面、组件、功能一个 Task
    5. 将任务清单和当前状态写回目标项目开发计划；如单文件过长，可写入对应的四字中文补充计划文档，并在开发计划中记录路径、适用 Phase 和恢复入口
    6. 任务清单写入完成后直接开始编码，不需要等用户确认

    禁止在没有 Plan 和任务清单的情况下直接写代码。
    Plan Mode 负责"这个 Phase 怎么实现"，目标项目开发计划负责"做哪些 Phase"。
    只存在于会话里的任务清单不算完成；未写入文件的信息不得当作可靠状态继续执行。

    **中断恢复策略**
    - 唯一当前执行光标：新目标项目使用 `.vibe-docs.json` 的 `currentExecution`，默认 `docs/plans/执行光标.md`
    - 详细任务状态统一使用 `todo / doing / blocked / done`
    - 所有补充计划文档同一时间最多只能有 1 个 `doing`
    - 新 session 恢复顺序：`.vibe-docs.json` → `docs/项目治理/开发计划.md` → `docs/plans/执行光标.md` → `docs/项目治理/验收记录.md` → 对应四字中文 Phase 明细
    - 如 `docs/plans/执行光标.md` 的状态为 `doing` 或 `blocked`，先恢复或对账该任务，不得直接开始新 Task
    - 开始编码前，先把当前 Task 标记为 `doing`，再写入 `docs/plans/执行光标.md`
    - 每个关键 checkpoint 后更新当前执行光标中的 `Last Checkpoint` 和 `Resume Next Step`
    - 任务完成或阻塞后，立即同步更新详细任务表和 `docs/plans/执行光标.md`

    **设计稿参照策略**

    如有设计工具 MCP 已连接（如 Pencil、Figma 等），以下步骤**不可跳过**：

    **每个功能开发前**：
    - 通过设计工具 API 读取涉及的所有页面和变体的精确数值（宽高、padding、gap、字号、字重、颜色、圆角、阴影）
    - 查看设计稿视觉效果
    - 不是 Phase 开头看一次就够——每个 Task 开始前都要重新读取，不凭记忆

    **编码过程中**：
    - 逐个组件对照提取的数值实现
    - 遇到设计稿与 Design Brief 冲突时，以设计稿为准

    **每个功能开发后**：
    - 读取代码中的实际值（Tailwind class / style），逐项与设计数值核对
    - 查看设计稿，确认布局结构一致
    - 有偏差先修正再提交
    - 让用户在浏览器中确认最终视觉效果

    如无设计工具（降级模式）：
    - 以目标项目设计简报为主要参照
    - 如无目标项目设计简报 → 以目标项目需求文档文字描述为参照

    **联网搜索策略**
    以下场景必须先 WebSearch 再动手：
    1. 用到外部库/API → 确认当前版本的用法和 API 签名
    2. SDK/框架有没有内置功能 → 确认后决定是自己实现还是直接用
    3. 遇到不确定的技术方案 → 搜索最佳实践
    4. 报错信息不熟悉 → 搜索别人的解决方案

    **技术栈选择策略**（初始化模式使用）
    根据目标项目开发计划的技术栈 Profile 配置项目。必须先读取 platform profile、language adapter、architecture profile、scaffold policy 和 fallback stack。
    - Web（纯前端）+ TypeScript / Node + `scaffold policy = template` → React + Vite + TypeScript + Tailwind，模板 `vite-feature-first`
    - Web（全栈）+ TypeScript / Node + `scaffold policy = template` → Next.js + TypeScript + Tailwind，模板 `next-feature-first`
    - Desktop + TypeScript / Node + `scaffold policy = template` → Electron + Next.js + TypeScript + Tailwind，模板 `electron-next-feature-first`
    - Node CLI + TypeScript / Node + `scaffold policy = template` → Node.js + TypeScript + Commander，模板 `cli-feature-first`
    - CLI Agent + TypeScript / Node → 参考 [CLI Agent 产品] 项目结构；小型 Node CLI 可用 `cli-feature-first`
    - Mobile / Backend / Library / 非 Node CLI → 沿用平台默认结构或既有结构，不渲染现有 JS / TS 模板
    - 技术栈仍不明确 → 停止脚手架初始化，回到需求 / 计划补齐一个关键选择
    选定后 WebSearch 验证框架版本和兼容性。
