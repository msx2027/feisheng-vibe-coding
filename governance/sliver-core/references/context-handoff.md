# Context Handoff

Use this when the conversation is too large, the user wants to continue in a new window, another agent will take over, or a stage is not fully closed.

The handoff must be copy-paste-ready. It should preserve current truth, not merely summarize what the agent feels was done.

## Required Contents

Include:

- Project path, current date, branch, and target environment.
- Hard instructions to preserve: language, AGENTS.md, truth root, no patching, no destructive actions, no deployment without approval.
- Git status for every relevant repo, including nested internal-doc repos.
- Latest commits for every relevant repo.
- Current source-truth documents.
- Active plan owner path and its current step/terminal state when `plan-artifact.md` applies; point to that owner instead of copying a second plan into the handoff.
- Work completed in this window, grouped by owner layer.
- Files changed but not committed.
- Validation evidence: exact commands and pass/fail result.
- Runtime state: running services, ports, URLs, stale process warnings, deploy/device state when relevant.
- Pending-operation state from `execution-liveness.md`: normalized operation identities/kinds, lifecycle or terminal decision, evidence quality, unknown/truncation flags, and the next matching refresh/cancel action. Do not copy raw tool output.
- Current architecture/product boundary and rejected routes.
- Known risks, blocked evidence, and unresolved user decisions.
- When Studio Mode is active: the active plan owner path and phase, Studio run identifier, user confirmation event reference and exact confirmed room set, room/task and host identifiers, latest progress cursors, current actionable/attention state, local/worktree environment, effective starting-state revision, and return-artifact locations needed to resume. The plan alone owns the task graph, deliverables, canonical states, acceptance evidence, blockers, decisions, destination-drift result, and next action; do not copy those fields into the handoff. Do not invent a recommendation or graph hash as proof of user confirmation. Mark that the first resumed action must be an immediate host task snapshot before unrelated work.
- Drift warnings: what the next agent must not do.
- Exact next safest commands or next action.

## Handoff Shape

Use this structure:

```markdown
# <Project> 新窗口交接

工作目录：
当前日期：
当前目标：

必须遵守：
- ...

## Git State

主仓：
```text
...
```

内部文档仓，如果存在：
```text
...
```

## Current Truth

- 产品边界：
- 当前阶段：
- 主要 owner：
- 当前真源文档：
- Active plan owner：
- Plan phase：
- Current plan step：
- Plan terminal state：
- 用户确认过的非目标：
- 被拒绝路线：

## 本窗口完成

### <owner layer / feature area>
- ...

## 变更文件

- ...

## 验证证据

已通过：
```bash
...
```

未运行 / 未验证：
- ...

## 运行状态

- ...

## 漂移警告

- 不要 ...
- 保持 ...

## 下一步

1. ...
2. ...
```

## Rules

- Do not omit dirty or untracked files.
- Do not say "all passed" without commands and results.
- Do not omit nested repo state.
- Do not hide missing evidence; mark it `未验证`.
- Before writing handoff, satisfy `pending_count=0_or_terminal_decision` for every observable operation. A known terminal result with optional metadata missing is degraded evidence, not an unrecoverable block; a still-running handle is not completion evidence.
- Do not give a generic continuation prompt. The next agent must be able to act from paths, files, commands, and boundaries.
- Do not copy complete Studio child histories when stable task identifiers, current artifacts, state, and evidence are sufficient.
- A handoff or Hook can preserve Studio telemetry and require a refresh; it cannot claim that it queried current task state. After compaction or a new session, run the host snapshot first and write any changed canonical state through to the active plan owner before continuing.
- The Studio board is host telemetry projected from execution state, not execution state itself and not a second executable-plan owner. When
  `plan-artifact.md` applies, the one active plan owns status, acceptance
  evidence, blocker, decision owner, and next action. Preserve only the board's
  plan-node references, room/host identifiers, and progress cursors; reconstruct
  the projection after loading the plan and never copy it into a parallel
  progress document.
- If suggesting a commit, use explicit pathspecs. Never suggest `git add .`.
