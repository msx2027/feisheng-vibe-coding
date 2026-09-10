# Review Profile 与 Finding 闭环协议

> 读取时机：T2 及以上任务收口、需要判断是否派独立 Reviewer、建立 finding ledger、复审或 Phase 收口时。
> 规范关系：`execution tier` 决定实施与验证强度，`review profile` 决定审查阶段、Reviewer 隔离和 finding 闭环。二者正交计算，只允许风险信号把任一维度单向升级，不得相互降级。

## 默认映射

| Execution Tier | Review Profile | Spec Compliance | Code Quality | 独立 Reviewer |
| --- | --- | --- | --- | --- |
| T0 | `none` | 不启动正式审查 | 定向验证与 diff 摘要 | 否 |
| T1 | `directed-check` | 快速确认未偏离明确目标 | 同 Agent 检查明显副作用 | 否 |
| T2 | `split-self-review` | 强制独立成段 | 强制独立成段 | 默认否；高影响时升级 |
| T3 | `independent-two-stage` | fresh Spec Reviewer | fresh Quality Reviewer | 是 |
| T3+ | `hazard-review` | 独立 Spec review + hazard gate | 独立 Quality review + fresh verification | 是；冲突时由用户裁决 |

先判 execution tier，再计算 review profile。auth、permission、security、token、secret、payment、database、migration、data loss、filesystem、shell、network、eval、pre-commit、hook、agent routing、Skill / Hook / Tool 规则、release / deploy / publish、删除 / 重命名 / 迁移行为文件和影响面无法可靠判断，是现行入口的 T3+ 信号；不得为了只升级 review profile 而把它们留在 T2。表中 profile 是最低值，不是上限。

下列 `review-policy-json` 是本协议的机器可验证投影，供策略门禁校验默认映射、阶段、状态转换、权限和 implementer 门槛；自然语言规则仍是解释边界，二者不一致时门禁必须失败，不能把此投影视为第二份规则真源。

```review-policy-json
{
  "tierProfiles": {
    "T0": "none",
    "T1": "directed-check",
    "T2": "split-self-review",
    "T3": "independent-two-stage",
    "T3+": "hazard-review"
  },
  "stageRequirements": {
    "T0": [],
    "T1": ["directed-check"],
    "T2": ["spec", "quality"],
    "T3": ["spec", "quality"],
    "T3+": ["spec", "quality", "hazard"]
  },
  "independentReviewTriggers": [
    "public-contract",
    "modules-at-least-3",
    "files-at-least-5-with-business-logic",
    "subagent-implementation",
    "requirements-or-plan-changed",
    "same-fix-failed-at-least-2-times",
    "manual-acceptance-path",
    "phase-closeout",
    "release-or-merge",
    "automation-incomplete",
    "tier-risk-mismatch"
  ],
  "transitions": {
    "open": ["fixing", "accepted-risk", "deferred", "rejected-with-reason"],
    "fixing": ["fixed", "accepted-risk"],
    "fixed": ["reverified", "fixing", "accepted-risk"],
    "reverified": ["fixing"],
    "accepted-risk": [],
    "deferred": [],
    "rejected-with-reason": []
  },
  "constraints": {
    "acceptedRiskRequiresUser": true,
    "acceptedRiskRequiresUserEvidence": true,
    "reverifiedRequiresFreshEvidence": true,
    "nonOpenRequiresResolution": true,
    "reopenReverifiedRequiresNewRound": true,
    "reopenReverifiedRequiresInvalidationEvidence": true,
    "deferredSeverities": ["minor"],
    "rejectedWithReasonRequiresEvidence": true,
    "implementerThreshold": {
      "minimumModules": 3,
      "minimumFiles": 5,
      "operator": "and"
    }
  },
  "roles": {
    "reviewer": {
      "readOnly": true,
      "canModifyCode": false,
      "canWriteLedger": false,
      "canSpawnReviewer": false
    },
    "mainAgent": {
      "writesLedger": true
    }
  }
}
```

## 高影响 T2 自动升级

普通 T2 命中任一项，review profile 至少升级为 `independent-two-stage`：

- 涉及 auth、permission、secret、payment、database、migration 等信号时，先按入口规则判断是否已同时升级到 T3/T3+。
- 新增或修改公共 API、IPC、event channel、schema、server action、service/public entry 或其他公共契约。
- 跨越至少 3 个模块。
- 修改至少 5 个文件且包含真实业务逻辑。
- 实现由子 Agent 完成。
- 开发过程中需求或计划发生变化。
- 同一修复已失败至少两次。
- 涉及已经人工验收的路径。
- Phase 收口、发布或合并前。
- 自动化测试不能完全证明正确性。
- execution tier 与风险信号不匹配。

Reviewer 升级条件与 implementer 门槛彼此独立。implementer 仍只在“至少 3 个独立模块 AND 预计至少 5 个文件”同时成立时派发；任何独立审查条件成立都可以派 Reviewer，即使实现始终由主 Agent 完成。

## 最小审查包

主 Agent只向 Reviewer 提供完成当前 stage 所必需的有界材料：

- Task / Phase 标识、review profile、reviewStage 与复审 round。
- 本轮验收条件，以及相关 REQ-ID、能力 ID、接口契约 ID。
- 计划规定的允许文件范围与明确非目标。
- `BASE...HEAD` diff、工作树等价补丁或其他有界变更包；不得用整个项目代替范围。
- 主 Agent亲自核验过的 RED、GREEN、回归、静态门禁和人工验收状态。
- 已知限制、未验证内容和环境阻塞。
- 当前完整 finding ledger；复审时标出本轮待 reverify 的 findingId。
- T3+ 的 Hazard Task Packet、rollback 与风险专项门禁。

实现者 DONE、`DONE_WITH_CONCERNS`、旧 review snapshot、旧 `.needs-review=clean` 或口头“已处理”都只是输入，不是完成证据。主 Agent必须先检查实际 diff 与 fresh evidence，再组装审查包。

## 两个审查阶段

### Spec Compliance

只回答“是否实现了正确需求”：

- 本轮需求和验收条件。
- 已满足项、未满足项与越界实现。
- 接口契约、术语和人工验收影响。
- 每项结论的文件、行号、diff 或验证证据。

Spec Reviewer 不评价代码风格、抽象偏好或一般可维护性。若发现需求、计划、接口契约或用户明确要求彼此冲突，登记 finding 并交给用户裁决；Reviewer 和主 Agent都不得自行选择哪一边优先。

### Code Quality

在冻结的需求边界内回答“实现质量是否合格”：

- 正确性与边界。
- 可维护性、重复和复杂度。
- 严格 TDD 的 RED-GREEN-REFACTOR 证据与测试质量。
- 性能、安全和兼容性风险。
- Findings 与具体证据。

Quality Reviewer 不重新发明需求，也不把个人产品偏好包装成质量 finding。Spec 阶段仍有 Critical / Important 时可以暂缓 Quality，但最终收口必须完成两个必要阶段。

## Finding Ledger

每条 finding 至少包含以下字段：

| 字段 | 约束 |
| --- | --- |
| `findingId` | 稳定且唯一；建议 `<task>-<spec|quality>-<序号>`，复审不得换 ID |
| `reviewStage` | 只允许 `spec` 或 `quality` |
| `severity` | 只允许 `critical`、`important`、`minor`；用户可见报告显示 Critical / Important / Minor |
| `evidence` | 文件:行号、diff、命令输出或契约 / 验收证据；不得写“看起来有问题” |
| `affectedFiles` | 有界项目相对路径数组；无文件时说明受影响契约或验收项 |
| `status` | 当前状态，必须符合下方状态机 |
| `resolution` | 修复内容、当前修复动作、用户裁决或拒绝理由；只有 `open` 时可为空 |
| `reverificationEvidence` | 对应 Reviewer 的 fresh 复审证据；只有 `reverified` 必填 |

主 Agent拥有 ledger 写入责任；Reviewer 只输出 `Finding Ledger Delta` 和 `Review Receipt`，不得直接修改代码、修改 ledger 文件或刷新 clean snapshot。启用任务胶囊时，完整 ledger 持久化到当前 Task 的 `审查台账.md`；未启用时，持久化到当前 Task / Phase 计划或审查报告的 `Finding Ledger` 章节。无论落点在哪里，都必须进入当前持久化交付物，不能只留在子 Agent 对话里。Phase 收口时把各 Task ledger 合并成 Phase ledger，并保留已 reverified 与已裁决条目。

### 状态机与权限

正常路径：

`open -> fixing -> fixed -> reverified`

合法分支：

- `fixed -> fixing`：对应 Reviewer 用 fresh evidence 判定复审失败；增加 round，保留原 resolution 和失败证据历史。
- `reverified -> fixing`：只有新 diff 触及原 finding 的受影响契约或文件、使旧复验证据失效时才允许；必须增加 round，记录 invalidation evidence 与本轮 resolution，并保留全部历史 receipt。
- `open | fixing | fixed -> accepted-risk`：只有用户明确接受具体风险后可用，必须记录用户裁决证据。Critical / Important 除 `reverified` 外唯一可关闭分支是用户明确接受风险。
- `open -> deferred`：只允许 Minor，必须记录原因、负责人或后续 Phase、触发条件；Critical / Important 不得用 deferred 收口。
- `open -> rejected-with-reason`：证据证明误报、重复或不属于本轮范围；必须记录理由和反证。若 finding 与 Spec、计划或用户要求冲突，不得用本状态绕过用户裁决。

禁止状态跳跃：`open -> fixed`、`fixing -> reverified`、`fixed -> accepted-risk` 但没有用户证据、或任何非 `open` 状态没有 resolution。`reverified` 后若新 diff 使证据失效，应携带新 round 与 invalidation evidence 回到 `fixing`，不能保留旧 clean 结论；没有这两项证据时 `reverified` 仍是终态。

### 严重度闭环

- Critical / Important：必须修复并由原审查方向或 fresh 同方向 Reviewer reverify，或者由用户明确接受风险。
- Minor：必须修复并 reverify、由用户 accepted-risk、带责任与触发条件 deferred，或以反证 rejected-with-reason；不得静默删除。
- 主 Agent合并两个 Reviewer 的 ledger delta 时只可去重，不可丢项。去重后保留所有来源 ID、证据和较高严重度；不得为了“零 finding”降低严重度。

相同类型问题连续两轮仍未消除时停止机械循环，判断根因属于需求、计划、架构还是验证设计。只有确实无法在既定权限和范围内继续推进时才向用户报告阻塞；不得递归派发 Reviewer，也不得让 Reviewer 审查 Reviewer。

## 交付收敛检查

实现、fresh 验证和必要 review 后，主 Agent以代码、验证证据、需求、开发计划与当前 Phase/Task 逐项反查：每项需求是否有计划映射、每项计划 Task 是否有实现与验证、是否出现未计划或未实现缺口。

- 收敛结论只记录在既有 finding ledger / Review Receipt；不创建平行 `tasks.md`、收敛清单或状态真源。
- 发现缺口时登记 finding 与证据，回写既有计划/Phase Task，重新进入 `RED-GREEN-REFACTOR`，并在修复后由对应 stage fresh reverify。
- 仅当无未计划或未实现缺口，且所有 Critical / Important 都已 `reverified` 或由用户明确 accepted-risk，才能形成完成结论。

## Reviewer 与修复责任

- 主 Agent：选择 profile、验证实现者 diff、维护 ledger、派发修复、决定何时复审、核验最终 gates。
- Implementer / 修复者：只处理明确 findingId 和允许文件；回报修复 diff 与 fresh 验证，不自行关闭 finding。
- Spec Reviewer：只读、只审 spec stage、输出 delta / receipt，不修复、不递归派发 Reviewer。
- Quality Reviewer：只读、只审 quality stage、输出 delta / receipt，不修复、不递归派发 Reviewer。
- 用户：裁决 Spec / 计划 / 明确要求冲突，以及 Critical / Important 的 accepted-risk。

`independent-two-stage` 和 `hazard-review` 必须使用两个 fresh Reviewer 实例；同一个 code-reviewer Agent 可以作为角色真源，但每个实例只接收 `reviewStage=spec` 或 `reviewStage=quality`。两个 Reviewer 不继承彼此对话或结论。

## Review Receipt

每个 stage、每个 round 都输出一张收据：

- Task / Phase、profile、reviewStage、Reviewer 实例标识、round。
- reviewed diff 范围或 hash。
- 输入验证证据与已知未验证项。
- 新增、更新、关闭的 findingId。
- 结论：`NO BLOCKING FINDINGS` 或仍存在的 Critical / Important。
- ledger 版本或 hash，以及复审使用的 fresh evidence。

`NO BLOCKING FINDINGS` 只说明该 stage 当前没有阻断项，不代表另一 stage、完整 ledger、同步、测试或人工验收已经完成。

## Phase 与成本控制

- T0/T1 不加载完整 Spec、不创建 formal ledger、不派 Reviewer Agent、不运行完整 health；UI 探索、纯视觉微调、脚手架和一次性原型仍按既有 tier 与验证规则处理。
- 普通 T2 由同一 Agent用两个明确标题完成，不复制上下文；只有高影响触发才支付独立 Reviewer 成本。
- Phase 收口、发布或合并前使用累计 Task diff、各 Task Review Receipt、Phase ledger 和集成验证，专门检查跨 Task 契约、状态、命名、重复实现和回归问题。
- Reviewer 默认只加载最小审查包；需要扩大范围时先说明缺失证据和新增边界，不自行恢复完整项目。
- hook snapshot 只证明某个 diff 曾通过门禁，不保存 finding 状态，也不等于 ledger、Review Receipt 或完成证据。
