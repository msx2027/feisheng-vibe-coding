---
name: feedback-writer
description: '仅由 feedback-observer 子 Agent structured-event caller 调用，不接受普通用户自然语言或 `vibe-coding-skills` 总入口路由；由 feedback-observer sub-agent 调用'
user-invocable: false
disable-model-invocation: true
---
[结构化事件闸门]
    本 Skill 只接受 `feedback-observer` 提供的 structured-event caller。普通自然语言、总入口 routeHints 和直接 Skill ID 都必须停止，不执行分析或写入。

[任务]
接收主 Agent 传入的上下文，分析是否有值得记录的 feedback 信号。
有 → 写入共享反馈目录 `.claude/feedback/` 并更新索引。
无 → 返回"无新 feedback"。

[观察维度]
以下 5 类信号触发 feedback 记录：

    1. **用户修正**
       用户修正了 AI 的行为。
       信号："不是这样的"、"别这样做"、"你搞错了"、用户手动改了 AI 的输出。
       → 标注被修正的 Skill 和具体行为。

    2. **未覆盖场景**
       Skill 执行中遇到了 Skill 没有指导的情况。
       信号：AI 临时发明了做法、跳过了步骤、不确定怎么做。
       → 标注哪个 Skill 缺了什么。

    3. **重复操作**
       用户反复做同一类操作但没有 Skill 支持。
       信号：连续 3 次以上用自然语言要求做同一类事。
       → 标注操作模式。

    4. **质量问题**
       反复发现同类代码质量问题。
       信号：连续多个 Phase 出现类型错误、命名不一致、CSS 副作用等。
       → 标注问题类型和频率。

    5. **Skill 效能评估**
       Skill 执行完毕后，按 4 个维度打分（1-5）。
       仅在 Skill 执行后评估，日常对话不打分。

       **精准度** — Skill 指引是否准确？
       5: 零修正 / 4: 微调 1-2 处 / 3: 修正 3+ 处 / 2: 方向重做 / 1: 用户放弃

       **覆盖度** — Skill 是否覆盖实际需要？
       5: 完全按指引 / 4: 1 处自行处理 / 3: 2-3 处临时决策 / 2: 大量自由发挥 / 1: 严重不匹配

       **效率** — 流程是否顺畅？
       5: 一次通过 / 4: 1 次澄清 / 3: 2-3 次来回 / 2: 多次来回 / 1: 卡死

       **满意度** — 用户接受程度？
       5: 主动表达满意 / 4: 无负面评价 / 3: 提了修改意见 / 2: 要求大幅修改 / 1: 否定产出

       **反膨胀**：有修正 → 精准度 ≤ 3 / 临时发明 → 覆盖度 ≤ 3 / 2+ 次来回 → 效率 ≤ 3 / 有修改意见 → 满意度 ≤ 3

    **判断标准**：
    只有确实观察到信号时才记录。宁可漏记，不可滥记。

[路由规则]
先把显性纠错事件判为单 scope；同一 `eventId` 只能进一个系统，禁止自动双写：
- `package-feedback` → 本 Skill 写 `.claude/feedback/`，服务本包 Skill / Hook / Tool / 规则改进。
- `target-project` → 不写 package feedback，交给 `experience-elevator` 与目标项目 `experienceGovernance` 台账。
- `global-codex` → 本包不写用户全局经验库，只向主 Agent 返回跨域提议。
- 同时命中多个 scope → 只返回 `proposal-required`，由用户选一个；不得把同一事件同时写 feedback 与项目经验。

[写入流程] 1. 读取 `.claude/feedback/FEEDBACK-INDEX.md`（如不存在，从 templates/feedback-index-template.md 创建）2. 检查是否已有同主题 feedback（去重）- 已有 → 更新内容 + occurrences +1 + 更新 updated - 没有 → 创建新文件 + 更新索引 3. 文件名用 kebab-case，简短描述主题 4. 按 templates/feedback-topic-template.md 格式写入 5. 更新 FEEDBACK-INDEX.md

[文件规范]
存放位置：`.claude/feedback/`
索引文件：`.claude/feedback/FEEDBACK-INDEX.md`
索引模板：`.claude/feedback/templates/feedback-index-template.md`
内容模板：`.claude/feedback/templates/feedback-topic-template.md`

[返回格式]
执行完毕后返回给主 Agent：- 有新记录："记录了 1 条 feedback：[标题]（[文件名]）" - 更新已有："更新了 [文件名]，occurrences: N → N+1" - 无信号："无新 feedback"

[事件最小化]
package-feedback 文档只保留完成改进所需摘要、scope 与 eventId 引用；项目 pending marker 不保存原始用户 prompt。Hook 的关键词与 promptHash/eventId schema 统一由 `tools/detect-experience-signal.mjs` 维护。
