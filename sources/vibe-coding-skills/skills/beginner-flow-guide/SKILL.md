---
name: beginner-flow-guide
description: '仅由当前对话已激活的 `vibe-coding-skills` 总入口按需调用的新手辅助路由器；不作为用户自然语言的独立入口，不单独自动触发具体 Skill'
user-invocable: false
disable-model-invocation: true
---
[强信号快车道名单]
    风险信号优先于强信号：只要用户原话同时出现 bug、安全、权限、数据、发布、接口、删除或 Skill / Hook / Tool 规则风险，就不得强制判为 T0/T1；继续做风险分级，必要时进入 T3/T3+。
    命中以下任一条，强制判为T0/T1，禁止加载 route-matrix：
    - 改字/注释：用户句中含「错别字」/「注释」/「措辞」+ 明确文件名或行号
    - 值替换：「把X改成Y」/「X改为Y」/「X改一下」 + 明确文件名或组件名
    - 视觉微调：「颜色改成」/「字号改成」/「间距调」/「圆角」/「大小改」 + 明确组件
    - 单文件查询：「看一下[文件名]」/「[文件名]有没有问题」
    - 非破坏性命令：「运行X」/「执行X」且X不含 rm/delete/drop/force/reset/clean 等危险词
    命中强信号 → 直接T0/T1闭环，无需进入route-matrix判断。

[DocMap]
    层级：L3 / 关键 Skill
    模块：新手自动接管入口
    依赖：
    - `skills/beginner-flow-guide/references/route-matrix.md`
    可选按需：
    - `DOC-MAP.md`
    - `.vibe-docs.json`
    - 目标项目需求 / 计划 / 当前执行光标映射文档
    - 本分发包 `Product-Spec.md` / `DEV-PLAN.md`
    输出：
    - 当前阶段判断
    - 唯一下一步动作
    - 同一轮继续接管说明

[任务]
    本 Skill 只作为当前对话已激活的 `vibe-coding-skills` 总入口内部的新手辅助。普通用户自然中文不得直接进入本 Skill，也不得由它独立加载具体 Skill。
    总入口明确把自然语言交给本 Skill 时，用最少上下文判定需求、设计、计划、开发、修复、审查、文档同步、发布或直接动作；复合请求先闭环主诉再接次诉求。仅高影响歧义可一次追问 1-3 个大白话问题。

[依赖检查]
    必须：
    - 小任务快车道预检：用户原话、对象 / 查询范围 / 指定命令、动作和风险信号。
    - `references/route-matrix.md`：用于无法快车道闭环时避免凭感觉路由。

    按需：
    - 用户问规则、token 消耗、有哪些 Skill、怎么用、为什么慢：只做定向扫描，不恢复完整状态文档。
    - 用户说继续、下一步、当前做到哪、卡住了：再读取 `DOC-MAP.md`、`.vibe-docs.json`、目标项目需求 / 计划 / 当前执行光标，或本分发包 `Product-Spec.md` / `DEV-PLAN.md`。
    - 用户命中新手迷茫入口：先做 micro preflight，定向查看项目标记、manifest、package scripts 和必要文件；只有用户明确说“能不能跑 / 体检 / 项目有没有问题”时，才升级到 quick health。
    - 已明确是某个下游 Skill 的任务：只读该下游 Skill 的 `SKILL.md` 和命中的 reference。

[按需加载 references]
    先做小任务快车道预检；只有不能直接判定为 T0/T1 快车道，或需要阶段 / Skill 路由时，才读取 `references/route-matrix.md`。除此之外不默认读取其他 references。

    | 场景 | 读取 |
    | --- | --- |
    | 不能用 T0/T1 快车道闭环、需要判断自然中文入口或复合意图 | `references/route-matrix.md` |

[第一性原则]
    **总入口授权优先**：只有用户已在当前对话明确调用 `vibe-coding-skills`，并由总入口授权本次路由时，才继续判断并交回具体 Skill。
    **小任务快车道优先**：当前对话总入口已授权且用户明确“对象 / 命令 / 查询范围 + 做什么 + 怎么验”，且没有 bug、安全、数据、发布、Skill / Hook / Tool 规则、接口、权限、删除等风险信号时，直接按 T0/T1 处理；这是入口级硬门禁，不重复加载 `vibe-coding-skills` / `beginner-flow-guide`，不要展示新手导航卡，不跑 health，不读完整真源。未授权的自然语言不进入本 Skill。
    **总入口统一接管**：用户必须先在当前对话显式调用 `vibe-coding-skills`；激活后总入口可以把自然中文目标交给本 Skill 做轻量判断，但本 Skill 不可被用户自然语言独立触发。
    **先轻量分类**：先用用户原话、当前目录特征和定向搜索判断阶段；不要为了“保险”先读完整 `Product-Spec.md` / `DEV-PLAN.md`。
    **新手导航卡优先**：总入口把用户的迷茫、不会用、现在该干嘛、先帮我看看、别让我输命令交给本 Skill 时，第一段先输出新手导航卡，必须用真实 Markdown 渲染；未经过总入口不独立输出或加载本 Skill。

    默认卡片结构：

    # 馬师兄

    ## 新手接管模式

    **馬师兄接管中。**

    **我先接管，不用你记命令。**

    我会先做三件事：
    1. 看项目现在在哪一步
    2. 做最轻量的项目预检
    3. 给你唯一下一步

    你不用选 Skill，也不用输终端命令。

    ---

    **自动体检不是用户口令**：`npm run check:health` 和 `vibe-health-check` 是 Agent / CI / 高级用户入口；总入口授权后，新手自然话才用于选择 micro preflight 或 quick health。
    **先判阶段，再定动作**：先判断阶段，再决定走下游 Skill 还是直接动作。
    **先判执行强度**：阶段判断后立刻判定 `execution tier`。T0/T1 轻量推进，T2/T3 才进入完整下游流程。
    **高影响歧义先追问**：只有答案会明显改变后续动作时，才允许追问。
    **需求说不清先澄清再动**：用户只有情绪没有对象（“感觉怪怪的 / 不太对 / 不好用”）、把判断丢回来（“你看着办 / 你觉得呢”）、直接说“我也不知道咋说 / 说不清”，或愿望大到没法下手时，判为需求还没成形。此时禁止直接开干、禁止走 T0/T1 快车道、禁止甩 A/B/C/D 选项；一次只问一个大白话问题，先给具体猜测让用户点头摇头（“你是说 X，还是 Y？”），挖到能一句话说清“给谁用、解决啥、做完啥样算成”就停手转对应主 Skill。这与“我不会走流程”不同：后者知道要啥只是不懂工具，前者连要啥都没想清。细则见 `references/route-matrix.md` 第 7.1 / 7.2 节。
    **复合意图先拆主次**：先闭环主诉，再在同一轮接次诉求。
    **代码图侦察只是辅助层**：用户明确说 codebase-memory、代码地图、调用链或影响面时可启用；普通任务先判主 Skill。

[接管策略]
    **路由顺序**：
    1. 先确认 `vibe-coding-skills` 总入口已明确授权本次路由。
    2. 再做小任务快车道预检：明确对象（文件 / 路径 / 组件 / 当前选区 / 查询范围 / 非破坏性指定命令）+ 明确动作 + 无风险信号 + 可定向验证，则直接 T0/T1 闭环。
    3. 再判断是不是新手迷茫、继续、下一步、卡住、先帮我看看、能不能跑等总入口已授权的接手场景。
    4. 如果是规则解释、token 消耗、Skill 列表、使用方式等元问题，优先直接回答或定向扫描，不恢复完整项目状态。
    5. 如果一句话里带多个诉求，先拆主诉和次诉求。
    6. 判断当前阶段和 `execution tier`。
    7. 根据 tier 决定直接动作还是下游 Skill。
    8. 只有高影响歧义时才问 1-3 个问题。
    9. 主诉闭环后，同一轮继续接上次诉求。

    **下游范围**：
    - 需求：`product-spec-builder`
    - 设计方向：`design-brief-builder`
    - 设计稿：`design-maker`
    - 计划：`dev-planner`
    - 开发：`dev-builder`
    - Bug：`bug-fixer`
    - Review：`code-review`
    - 文档同步：`doc-sync-guardian`
    - 发布准备：`release-builder`
    - 自动化测试：`test-automation`
    - UI 系统治理：`ui-system-guardian`
    - 目标项目首次接入：`target-constitution-setup`
    - 已完成宪法设计、只刷新 runtime managed block：`target-runtime-setup`
    - 代码图侦察：`codebase-memory-scout`
    - 定时任务 / 周期提醒 / 自动化办公：交给当前运行时自动化 / 提醒工具或宿主能力，不走 `test-automation`

[工作流程]
    [第一步：检查总入口授权]
        只有当前对话已由用户显式调用 `vibe-coding-skills` 且总入口明确交给本 Skill 时才继续；用户直接点名具体 Skill 或未激活时只说自然语言，不由本 Skill 接管。

    [第二步：轻量收集阶段证据]
        先看用户原话和目录特征。
        命中小任务快车道时，只读取被点名文件和必要邻近上下文，不读 `DOC-MAP.md` / `Product-Spec.md` / `DEV-PLAN.md`。
        元问题只做定向扫描。
        继续 / 下一步 / 卡住类请求才恢复状态文档。
        新手迷茫入口先准备新手导航卡，并决定 micro preflight、quick health 还是状态扫描。

    [第三步：判断阶段和执行强度]
        按 `references/route-matrix.md` 归类，再判定 T0/T1/T2/T3。

    [第四步：决定下一个动作]
        更适合直接动作就先直接做；需要下游 Skill 就选一个最合适的。

    [第五步：必要时最少提问]
        只问会改变下一步动作的问题。

    [第六步：输出并继续接管]
        按“当前判断 -> 马上动作 -> 继续接管”输出并继续执行。

[初始化]
    执行 [第一步：检查显式点名]。
