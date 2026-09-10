---
name: current-execution-template
description: 当前执行状态模板。用于目标项目 docs/plans/执行光标.md，记录唯一进行中或被阻塞的任务游标，供新 session 恢复。
---

# Current Execution State

> This file is the only active execution cursor. New sessions should read .vibe-docs.json, then the mapped requirement document and development plan, then this file, before starting a new task.

> Target-project filename: docs/plans/执行光标.md. Do not generate plans/CURRENT-EXECUTION.md for new target projects.

- **Status**: [STATUS]
- **Current Phase**: [CURRENT_PHASE]
- **Current Task ID**: [CURRENT_TASK_ID]
- **Current Task Title**: [CURRENT_TASK_TITLE]
- **Source Plan File**: [SOURCE_PLAN_FILE]
- **Last Checkpoint**: [LAST_CHECKPOINT]
- **Resume Next Step**: [RESUME_NEXT_STEP]
- **Touched Files**: [TOUCHED_FILES]
- **TDD Stage**: [RED / GREEN / REFACTOR / CONTROLLED-VISUAL / EXCEPTION-APPROVED]
- **RED Evidence**: [test command + expected failure reason + actual failure summary]
- **GREEN Evidence**: [test command + passing result + related regression result]
- **TDD Exception Approval**: [不适用 / 用户明确批准依据 + 范围 + 替代验证 + 风险]
- **Controlled Visual Evidence**: [不适用 / 改前基线 + 改后同路径定向视觉证据 + 副作用检查 + 边界复核]
- **Manual Acceptance Status**: [不适用 / 待用户验收 / 用户已确认 / 需回归复验]
- **Manual Acceptance Record**: 验收记录.md
- **Manual Acceptance Path**: [需要用户真实点击 / 操作 / 观察的路径；不适用则说明原因]
- **Regression Trigger**: [后续哪些变更会影响已人工验收范围]
- **Last Updated**: [LAST_UPDATED]

## Recovery Rule

- If Status = doing, treat this task as interrupted on the next session and reconcile it before starting new work.
- If Status = blocked, resolve the blocker before starting new work.
- If Status = done or idle, it is safe to move to the next planned task.
- Do not move from RED to production code until the test has failed for the expected missing-behavior reason. Do not enter REFACTOR until GREEN is fully passing. `CONTROLLED-VISUAL` is only valid for a visual-only T1 with no existing seam and complete before/after evidence.
- If Manual Acceptance Status = 待用户验收, do not claim manual acceptance passed until the user explicitly confirms real clicking / operation / observation.
- If Manual Acceptance Status = 需回归复验, inspect 验收记录.md and retest only the affected paths unless automation fully covers the risk.
