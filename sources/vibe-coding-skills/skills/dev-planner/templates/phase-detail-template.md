---
name: phase-detail-template
description: Phase 详细任务清单模板。用于目标项目 docs/plans/第一阶段.md 这类四字中文文件，记录每个 Task 的结构化状态，供 dev-builder 和中断恢复工具读取。
---

# Phase [N] Detail — [功能名称]

> 本文件记录 Phase [N] 的详细任务状态。新 session 恢复时，先读 `.vibe-docs.json`，再读映射的需求文档、开发计划和人工验收记录，再读 `docs/plans/执行光标.md`，最后读本文件。

> 目标项目文件命名：新项目 Phase 明细必须使用 `docs/plans/第一阶段.md`、`docs/plans/第二阶段.md` 这类正好 4 个汉字的文件名；新目标项目不得生成 `plans/phase-N.md`。

## Task Table

| Task ID | Task | Status | 分析结论 | TDD Stage | RED Evidence | GREEN Evidence | Directed Visual Evidence | Manual Acceptance | Last Checkpoint | Resume Next Step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P[N]-T1 | [任务描述] | todo | [T2/T3: PASS / BLOCKED；T0/T1: 不适用] | RED | [测试 / 命令 / 预期失败原因] | - | - | 不适用 | - | - | - |
| P[N]-T2 | [任务描述] | todo | [T2/T3: PASS / BLOCKED；T0/T1: 不适用] | RED | [测试 / 命令 / 预期失败原因] | - | - | 待用户验收 | - | - | - |

## 预实现一致性分析回执

| Task ID | sourceRevision | 分析证据 | 分析结论 | 阻断项 |
| --- | --- | --- | --- | --- |
| P[N]-T1 | [需求 / 计划 / 契约当前修订] | [来源 section / 契约 ID / 测试策略或依赖比较结果] | [PASS / BLOCKED；T0/T1: 不适用] | [无 / Critical / Important 矛盾与处理路径] |

状态枚举：

- `todo`：尚未开始
- `doing`：正在执行；如 session 中断，下次优先恢复
- `blocked`：被阻塞，需要先解决依赖或问题
- `done`：已完成并已同步计划状态

TDD 阶段枚举：

- `RED`：最小测试已编写，必须实际运行并确认因目标行为缺失而正确失败
- `GREEN`：只实现让当前测试通过的最小生产代码，并记录当前测试与相关回归全绿证据
- `REFACTOR`：仅在全绿后整理，不新增行为，整理后继续全绿
- `CONTROLLED-VISUAL`：仅无既有 seam 的 visual-only T1 可用；记录改前基线、改后同路径定向视觉证据、副作用检查和边界复核
- `EXCEPTION-APPROVED`：仅原型、生成代码或配置文件，且已有用户明确批准与替代验证记录；无法自动化本身不构成例外资格

人工验收状态枚举：

- `不适用`：本任务没有需要用户真实点击 / 操作 / 观察确认的内容，并已说明原因
- `待用户验收`：自动化验证和 AI 自查已完成，但还需要用户真实验收
- `用户已确认`：用户已明确确认验收范围，并已写入 `验收记录.md`
- `需回归复验`：后续改动可能影响已确认范围，且自动化不能完全覆盖

规则：

- 所有 Phase 详细计划中同一时间最多只能有 1 个 `doing`
- 任务开始前先把对应行改为 `doing`，并同步写入 `docs/plans/执行光标.md`
- 每个关键 checkpoint 都要更新 `Last Checkpoint` 和 `Resume Next Step`
- 除 `CONTROLLED-VISUAL` 外，没有 `RED Evidence` 不得进入生产代码；严格 TDD 任务完成时保留 RED / GREEN，受控视觉任务保留完整 Directed Visual Evidence
- T2/T3 必须先在既有开发计划或本 Phase 明细记录 `sourceRevision`、`分析证据`、`分析结论` 与 `阻断项`，并得到预实现一致性分析 `PASS`，再写首个 RED；`BLOCKED` 时先回写需求或计划解决矛盾
- 任务完成或阻塞后，立即同步更新本文件和 `docs/plans/执行光标.md`
- 任务完成时必须更新 `Manual Acceptance`；用户未明确确认前，不得写成 `用户已确认`
- 后续任务如果影响已确认范围，优先补自动化回归；自动化无法覆盖时，把相关任务标为 `需回归复验` 并限定复验路径

## Recovery Notes

- [记录本 Phase 的额外恢复提示或依赖关系]
