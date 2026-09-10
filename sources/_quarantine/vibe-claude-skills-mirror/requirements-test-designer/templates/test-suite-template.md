# 测试用例体系

## 输入来源

| 来源 | 版本 / 日期 | 范围 | 备注 |
| --- | --- | --- | --- |
|  |  |  |  |

## Assumptions

| ID | 假设 | 影响范围 | 需确认对象 |
| --- | --- | --- | --- |
| ASM-001 |  |  |  |

## Input Completeness / Domain Risk

| 输入完整度 | 命中的领域风险触发器 | 冲突点 | 处理策略 |
| --- | --- | --- | --- |
| 中等 |  |  | 生成 baseline + 澄清问题 |

## Clarifying Questions

| ID | 问题 | 阻塞的 REQ-ID / TC-ID | 优先级 |
| --- | --- | --- | --- |
| Q-001 |  |  |  |

## Requirements

| REQ-ID | 摘要 | 来源 | 优先级 | 状态 | 验收标准 | 信息缺口 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-001 |  |  | P1 | new |  |  |

## Scenarios

| Scenario-ID | 关联需求 | 场景摘要 | 风险维度 | 覆盖状态 |
| --- | --- | --- | --- | --- |
| SCN-001 | REQ-001 |  | happy path | covered |

## Test Cases

| TC-ID | 标题 | 关联需求 | Scenario-ID | 优先级 | 测试类型 | 前置条件 | 测试数据 | 步骤 | 预期结果 | 是否可自动化 | 自动化建议 | 人工验收状态 | 覆盖状态 | 变更状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC-001 |  | REQ-001 | SCN-001 | P1 | happy path |  |  |  |  | 是 |  | 不适用 | covered | new |

## Traceability Matrix

| REQ-ID | Requirement Summary | Scenario-ID | Scenario Summary | TC-ID | Test Case Title | Test Type | Priority | Coverage Status | Automation Candidate | Automation Level | Manual Acceptance Status | Change Status | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 |  | SCN-001 |  | TC-001 |  | happy path | P1 | covered | 是 | E2E | 不适用 | new |  |

## Coverage Gaps

| REQ-ID | 维度 | 状态 | 原因 | 需要的澄清 / 后续动作 |
| --- | --- | --- | --- | --- |
| REQ-001 | performance / reliability | needs clarification | 缺少响应时间阈值 | 确认 P95 响应时间和数据规模 |

## Platform / Environment Matrix

| 范围 | 环境 / 端 | 必测差异 | 自动化状态 | 人工验收状态 |
| --- | --- | --- | --- | --- |
| Web / Mobile / API |  |  |  | 待用户验收 |

## Automation Handoff

```text
Handoff to test-automation
- 目标：
- TC-ID：
- 推荐层级：
- 技术栈信号：
- 测试数据：
- 断言：
- 阻塞：
- Fresh 证据要求：
```
