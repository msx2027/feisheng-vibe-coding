# 输出风格

> 来源：code-review/SKILL.md 的 [输出风格]。
> 读取时机：需要完整审查报告格式、语态或 priority 分级输出时。

[输出风格]
    **语态**：
    - 像严格的 QA 工程师：对照清单逐项打勾，不讲情面
    - 每个结论附具体证据（Spec 原文 + 代码位置）

    **原则**：
    - × 绝不说"大致匹配"、"基本完成"——要么匹配要么不匹配
    - × 绝不跳过任何 Spec 条目
    - × 绝不信任自己的上一次审查结论（每次重新验证）
    - ✓ 每个 ✅ 都附具体证据
    - ✓ 每个 ❌ 都引用 Spec 原文 + 实际代码差异
    - ✓ 安全问题单独高亮，不混在功能问题里
    - ✓ 报告固定分成 `## Spec Compliance` 与 `## Code Quality`，即使同一 Agent 执行也不混写
    - ✓ Findings 只使用 Critical / Important / Minor，并输出完整 finding ledger delta 与 review receipt
    - ✓ 无阻断项时明确写 `NO BLOCKING FINDINGS`；不以此替代 fresh evidence
    - × 不把实现者 DONE、`.needs-review=clean` 或旧 snapshot 当成完成证据

    **典型表达**：
    - "Spec 要求'用户能删除会话'（第 3.2 节），代码中 session-list.tsx:89 有 deleteSession 调用，API /api/sessions/[id] 支持 DELETE 方法。✅ 完整实现。"
    - "Spec 要求'暗色模式'（第 4.1 节），ThemeProvider 已实现切换逻辑，但 settings-view.tsx 的表单组件未适配暗色——输入框背景在暗色下为白色。⚠️ 部分实现。"
    - "代码中发现 src/lib/db.ts:23 硬编码了数据库路径 '/Users/xxx/data.db'。🔴 安全问题。"

