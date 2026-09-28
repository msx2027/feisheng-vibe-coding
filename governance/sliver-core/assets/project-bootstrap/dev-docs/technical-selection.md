# Technical Selection Decision

本文档是技术栈、框架与架构组合的决策理由和证据 owner。用户只确认产品结果、成本、停机、数据与不可逆影响；AI 负责技术判断、当前官方证据查询和唯一主推荐。

## Foundation Decision Control

- schema: sliver-foundation/v1
- decision_status: blocked
- source_coverage: incomplete
- blocking_unknowns: present
- source_conflicts: none
- network_evidence: missing
- poc_status: pending
- user_confirmation_scope: product_consequences_only
- product_consequence_confirmation: pending: 尚未确认主推荐对产品、成本和运行的影响
- recommendation: withheld
- decision_record: pending: 等待阻塞信息、当前证据和必要技术验证闭合

`recommendation_ready` 只能在阻塞未知、来源冲突、当前官方证据和关键 PoC 全部闭合后使用。不能用 `x`、`N/A`、空话或无来源的“最佳实践”凑齐。

守卫脚本只验证文档结构、证据关联和声明状态，不会授予真实世界的实施权限。实施还必须满足任务授权、风险门禁和当前运行态验收。

## Source Coverage

| Category | Source | Status | Evidence |
| --- | --- | --- | --- |
| product_scope | 产品边界、第一闭环与 MVP | blocking_unknown | 写入已确认的真源路径和条目 |
| users_outcomes | 目标用户、角色与产品结果 | blocking_unknown | 写入用户确认记录 |
| roadmap_boundaries | 功能、大阶段与已确认演进边界 | blocking_unknown | 写入当前真源索引 |
| existing_system | 现有代码和继承约束 | not_applicable | 空项目无现有系统；接管项目必须改为当前证据 |
| runtime_operations | 当前启动、测试、构建、数据库和运行约束 | not_applicable | 尚未物化运行时；物化后必须改为当前证据 |
| data_security_compliance | 数据、权限、安全、合规与第三方约束 | blocking_unknown | 写入具体证据或用户确认 |
| platform_organization | 平台能力、部署拓扑、成本、时间、组织和维护约束 | blocking_unknown | 写入具体证据或用户确认 |

## Architecture Drivers

| Driver | Business Priority | Architecture Impact | Source Evidence | Failure Consequence |
| --- | --- | --- | --- | --- |
| 写入一个真正改变系统结构的驱动因素 | 由用户确认业务优先级 | 由 AI 评估架构影响 | 引用真源或确认证据 | 写入选错后对产品的具体后果 |

## Quality Attribute Scenarios

只写会影响本次决策的质量场景，不要把所有属性全部拉满。

| Attribute | Source | Stimulus | Artifact | Environment | Response | Measure | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 写入安全、可靠性、性能、可修改性、可运维性或成本中的真实驱动项 | 谁或什么产生刺激 | 发生什么 | 影响哪个系统部分 | 在什么环境发生 | 系统必须怎么响应 | 可检验的数值或边界 | 业务优先级 |

## Pattern Axes

架构不是从一张名词表里单选。每个轴只写当前主决策、局部适用范围和升级条件。

| Axis | Current Choice | Scope | Driver Fit | Rejected Alternative | Upgrade Trigger |
| --- | --- | --- | --- | --- | --- |
| 部署拓扑 | 写入单体、模块化单体、独立服务或函数等当前结果 | 适用范围 | 对应驱动因素 | 拒绝路线及具体原因 | 可观测的重评条件 |
| 内部代码组织 | 写入框架原生分层、Clean、六边形或其局部组合 | 适用范围 | 对应驱动因素 | 拒绝路线及具体原因 | 可观测的重评条件 |
| 领域建模 | 写入事务脚本、局部 DDD 或其他具体结果 | 适用范围 | 对应驱动因素 | 拒绝路线及具体原因 | 可观测的重评条件 |
| 数据与一致性 | 写入数据 owner、事务和读写模式 | 适用范围 | 对应驱动因素 | 拒绝路线及具体原因 | 可观测的重评条件 |
| 模块通信 | 写入同步调用、进程内事件或可靠异步边界 | 适用范围 | 对应驱动因素 | 拒绝路线及具体原因 | 可观测的重评条件 |
| 客户端接口 | 写入通用 API、BFF 或无独立后端接口的具体结果 | 适用范围 | 对应驱动因素 | 拒绝路线及具体原因 | 可观测的重评条件 |
| 扩展机制 | 写入内置模块、adapter 或插件协议的具体结果 | 适用范围 | 对应驱动因素 | 拒绝路线及具体原因 | 可观测的重评条件 |
| 组织与平台 | 写入单产品应用或有真实 owner 的共享平台 | 适用产品与团队 | 对应当前复用和治理证据 | 拒绝提前建设中台等路线及原因 | 当前多产品复用、SLA、资金和平台 owner 同时成立 |

## Framework Architecture Fit

| Candidate | Framework-Native Structure | Driver Fit | Native Support | Local Adaptation | Conflict/Bypass Cost | Operations Cost | Migration Cliff | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 候选语言、运行时、框架、数据与架构组合 | 框架原生结构和生命周期 | 对应哪些驱动因素与质量场景 | native / compatible_local / adapter_cost / conflict 及原生能力 | 有边界的本地适配 | 绕开框架或能力冲突的成本 | 部署、监控、备份、升级和人员成本 | 未来什么变化会造成重写或迁移 | primary / rejected |

只记录可信组合。硬平台、法律、组织或继承约束只留下一个可信组合时，不凑“常见替代项”；在 `rejected_alternatives` 记录表面候选为何不可信及其证据。

## Current Primary Evidence

| Candidate Or Decision | Claim Being Checked | Primary URL/Source | Source Type | Checked Date | Version/Support Target | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 必须与 Framework Architecture Fit 的候选名称完全一致 | 影响主推荐的具体可变事实 | 当前官方 HTTPS URL | official_docs / official_release / official_advisory / official_policy / official_pricing | YYYY-MM-DD | 目标版本、支持窗口或适用范围 | 官方证据支持或否定什么 |

## Proof Of Concept

- poc_hypothesis: 写入会改变主组合的关键未知；没有时写明为什么不需要 PoC
- disposable_boundary: 写入隔离、限时、可丢弃范围；不需要时写明不产生实施代码

| PoC ID | Success Criterion | Failure Criterion | Evidence Reference | Observed Result | Decision Impact |
| --- | --- | --- | --- | --- | --- |
| POC-001 | 可检验的成功条件 | 何时否定候选组合 | 可复跑的命令、日志、产物路径或官方证据 | 实际输出和通过/失败结论 | 证据怎样改变决策 |

## Product Consequence Confirmation

| Consequence | User-Visible Result | Cost Or Operation Impact | Data, Downtime Or Irreversible Impact | User Decision | Confirmation Evidence |
| --- | --- | --- | --- | --- | --- |
| 主推荐需要用户确认的产品后果 | 用户看到的结果 | 预算、交付、维护或运营影响 | 数据、停机、迁移或不可逆边界 | confirmed / original_request_confirmed / rejected / pending | 对话、需求真源或书面确认记录；pending 时写明待确认项 |

## Primary Decision And Tradeoffs

- primary_combination: 唯一主技术栈、框架与架构组合
- why_it_fits: 对应驱动因素、质量场景和当前证据
- accepted_downside: 主路线的真实代价
- rejected_alternatives: 被拒绝组合及证据原因
- minimum_reversible_boundary: 不提前实现未来能力时保留的最小 owner、contract 或迁移边界
- migration_cliff: 什么变化会造成重写、数据迁移、停机或成本跃升
- re_evaluation_trigger: 可观测的业务、平台、组织或技术重评条件
- architecture_writeback: 决策确认后将当前具体结构写入 `architecture.md`，不复制本文的理由和历史
