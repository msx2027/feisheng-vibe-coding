# @@阶段名称@@

> 仅在跨 owner 漂移、有序且不可一次闭合的转换，或用户明确要求持久交接计划时物化本阶段真源。它同时承载计划、执行状态和收尾记录，但结构通过只证明记录自洽，不能证明实现、授权或真实验收已经发生。

## 阶段控制

- schema: sliver-stage/v2
- stage_id: @@stable-ascii-stage-id@@
- primary_route: @@canonical-primary-route@@
- operation: @@canonical-route-operation@@
- delivery_kind: @@implementation-or-route-delivery-kind@@
- task_depth: @@D2-or-D3@@
- materialization_trigger: [@@cross_owner_drift-or-ordered_nonclosable_transition-or-durable_handoff_requested@@]
- risk_lanes: []
- evidence_mode: @@test-or-route@@
- test_level: @@T0-T4-or-null@@
- route_evidence_kind: @@audit-diagnosis-decision-design-verification-handoff-or-null@@
- effect_class: @@none-local_reversible-or-controlled@@
- operational_mode: planned
- scope_authorization: blocked:阶段计划本身不授予执行权限
- authorization_substage: pending
- product_decision: @@not_required-reason-or-confirmed-evidence-or-pending-reason@@
- active_substage: @@当前唯一子阶段名称@@
- result_status: not_started
- truth_writeback: pending
- migration_state: not_applicable
- evidence_refs: []

## 阶段目标与用户流程

@@写清目标用户、完整操作、可见结果和保持不变的行为@@

## 当前真相与 Owner

@@列出 source truth、现有 owner、调用者、消费者、禁止 owner 和当前证据@@

## 调研决策

- research_status: @@completed-evidence-or-not_required-reason-or-unverified_nonblocking-reason-or-unverified_blocking-reason@@

@@记录当前证据、可比较对象、官方资料、学什么、不复制什么和业务适配@@

## 范围与非目标

@@写本阶段范围、非目标和不会改变的基础边界@@

## 子阶段计划

| 子阶段 | 结果 | Owner | 完成标准 | 验证 | 不触碰 |
| --- | --- | --- | --- | --- | --- |
| @@与 active_substage 一致@@ | @@可验收结果@@ | @@文件或模块@@ | @@done standard@@ | @@验证方法@@ | @@明确非目标@@ |

## 测试、安全与影响

@@按 evidence_mode 记录 T0-T4 或非实施 route evidence；只记录真实命中的风险通道、影响面和必要控制，风险不得改变 D@@

## 验证方法

@@写定向 gate、相关回归，以及 UI、API、数据库、第三方、设备或用户侧实际需要的证据；结构 checker 不能替代这些证据@@

## 停止条件与未验证

@@写何时必须停止、哪些证据仍未验证，以及当前子阶段结束后不得自动继续@@

## 风险与未决问题

@@逐条写本阶段已知风险、尚未拿到用户答案的产品问题、审计收尾晋升进来的未解决 finding；每条注明来源（讨论、审计报告路径或验收出入）与谁来拍板；没有就写「无」@@

## 实施回写

本节在实现和验证后填写。字段完整且 `truth_writeback: complete` 仍只构成结构记录；真实完成声明必须另外由当前任务的新鲜证据支持。

- actual_result:
- changed_owners:
- plan_deviation:
- fresh_evidence:
- remaining_risk:
- next_substage:
- git_checkpoint:
