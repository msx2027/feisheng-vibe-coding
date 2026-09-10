# test-design-taxonomy

[读取时机]
    需要判断正反用例、边界、权限、状态、API、安全、可访问性、性能等覆盖维度时读取。

[覆盖矩阵]
    每个 `REQ-ID` 都要逐项判断以下维度。不是每个维度都必须生成用例；但必须标记 covered / partial / blocked / needs clarification / not applicable，并写明原因。

| 维度 | 设计问题 | 常见用例 |
| --- | --- | --- |
| happy path | 用户按预期路径完成目标时，系统必须给出什么结果？ | 创建成功、保存成功、查询命中、审批通过、流程完成 |
| negative path | 用户输入无效、依赖失败或操作非法时，系统如何拒绝？ | 空值、格式错误、未登录、重复提交、外部服务失败 |
| boundary value | 输入、数量、时间、金额、分页、长度边界在哪里？ | 0、1、最大值、超最大值、最短、最长、时区边界 |
| permission | 谁能做，谁不能做，越权时如何表现？ | 匿名、普通用户、管理员、跨租户、权限撤销 |
| role | 不同角色看到和操作的内容是否不同？ | owner / reviewer / admin / guest 差异 |
| state transition | 状态如何变化，哪些跳转非法？ | draft -> submitted、approved 后不可编辑、过期、撤销 |
| workflow | 多步骤路径是否保持上下文和数据一致？ | 表单分步、结账、审批流、导入导出 |
| data persistence | 数据刷新、重启、回退后是否保留正确？ | 保存后刷新、删除后不可查、审计日志记录 |
| API contract | 请求、响应、状态码、schema 和错误码是否稳定？ | 200 / 400 / 401 / 403 / 409 / 500，字段缺失，版本兼容 |
| error handling | 错误是否可理解、可恢复、不吞失败？ | 超时、离线、重试、部分失败、用户可见错误 |
| security | 是否防止认证绕过、注入、敏感信息泄露？ | XSS、SQL / command injection、CSRF、敏感字段脱敏 |
| accessibility | 键盘、焦点、读屏、错误关联是否可用？ | Tab 顺序、aria、label、焦点恢复、颜色对比 |
| performance / reliability | 在负载、慢网、重试和故障下是否可靠？ | 响应时间、批量数据、并发、幂等、降级 |
| compatibility | 不同环境下是否一致？ | 浏览器、移动端、系统、语言、时区、数据版本 |
| regression | 哪些历史缺陷或核心路径必须守住？ | 旧 bug 复现路径、已人工验收路径、核心 smoke |

[领域触发补充]
    命中高风险业务词时，读取 `domain-risk-catalog.md` 并补以下专项断言；这些不是新测试类型，而是对现有维度的生产级加深。

    - 交易 / 支付：金额精度、价格快照、库存不可负、支付 / 退款流水、重复回调幂等、乱序事件、对账差异。
    - SaaS / 权限：跨租户访问、旧会话权限撤销、字段级权限、导出脱敏、失败操作审计。
    - 移动 / 小程序：权限拒绝和撤销、弱网重试、离线队列、真机系统差异、App / 小程序版本兼容。
    - AI / RAG：prompt injection、引用来源、无来源拒答、越权检索、向量索引删除、流式中断、provider 降级。
    - 内容安全：举报去重、审核状态机、误杀申诉、恶意举报、封禁撤销、审核日志。
    - 数据 / 批处理：部分成功、错误行下载、重试退避、死信队列、回滚粒度、任务恢复。
    - API / DevOps：API key 轮换、Webhook 签名、429 reset 语义、schema 向后兼容、日志脱敏、发布回滚失败。
    - 隐私 / 合规：DSAR 身份验证、机器可读导出、下载过期、legal hold、processor 回执、consent 撤回、retention / purpose limitation。
    - 金融 / KYC：document/selfie/liveness、watchlist 复核、bank relink、micro-deposit 锁定、double-entry ledger、dispute deadline、step-up auth、监管留存冲突。
    - 医疗 / FHIR：SMART scope、FHIR compartment、security label、Consent、AuditEvent、break-glass、PHI 日志脱敏、amendment/version。
    - 移动 provider：OTP TTL/429、防刷、定位精度/后台权限、地图 quota/fallback、推送 token/opt-out、移动读屏/动态字号、process death。
    - AI / Agent：eval baseline、model/prompt version、approval state machine、source-groundedness、citation faithfulness、PII retention、dataset lineage deletion、feedback-to-regression。
    - SRE / 发布：readiness/liveness、PDB/maxUnavailable、rollback trigger、burn-rate alert、incident role/postmortem、secret hot reload 限制、RPO/RTO 演练。
    - 物流 / 预约：geofence 边界、ETA stale、booking hold expiration、status webhook ordering、SMS opt-out、split fulfillment 数量守恒、DST pickup window。

[正向用例]
    happy path 用例必须包含：
    - 明确前置条件
    - 有代表性的有效测试数据
    - 用户动作或接口请求
    - 成功后的可观察结果
    - 数据持久化或状态变化断言

[反向用例]
    negative path 用例必须包含：
    - 失败输入或非法状态
    - 系统拒绝方式
    - 错误信息或错误码
    - 状态不得变化的断言
    - 审计日志或安全事件断言（如适用）

[边界用例]
    boundary value 用例必须覆盖：
    - 最小合法值
    - 最大合法值
    - 低于最小值
    - 高于最大值
    - 空值 / null / undefined / 缺字段
    - 多语言、emoji、空白字符、超长文本（文本输入时）

[权限与角色用例]
    permission / role 用例至少判断：
    - 未登录访问
    - 无权限角色访问
    - 有权限角色访问
    - 权限变化后的旧会话
    - 跨租户 / 跨组织 / 跨项目访问（如存在多租户）
    - 字段级授权、对象属性级授权、导出 / 报表 / 异步下载二次授权（如涉及敏感数据）
    - refresh token、设备撤销、consent 撤销或 break-glass 结束后的旧访问失效（如涉及身份 / 医疗 / 隐私）

[状态转换用例]
    state transition 用例至少判断：
    - 合法跳转成功
    - 非法跳转被拒绝
    - 重复提交幂等或拒绝
    - 并发更新冲突
    - 终态不可修改

[接口契约用例]
    API contract 用例至少判断：
    - 请求必填字段
    - 响应 schema
    - 状态码
    - 错误码和错误体
    - 认证授权
    - 向后兼容
    - 幂等性和重复请求

[可访问性用例]
    accessibility 用例至少判断：
    - 键盘能完成核心路径
    - 焦点顺序符合视觉和任务顺序
    - 表单控件有可读 label
    - 错误提示和字段关联
    - 弹窗打开和关闭后焦点管理
    - 颜色不是唯一信息载体
    - WCAG 2.2 的 bypass blocks / skip link、focus visible / not obscured、error identification / suggestion、status message / aria-live
    - 移动端 Dynamic Type / font scale、VoiceOver / TalkBack、触控目标、横竖屏和文本截断（如涉及移动端）

[性能与可靠性用例]
    performance / reliability 用例需要先确认指标来源。没有指标时，不编造 SLA；标记为 needs clarification，并提出需要确认：
    - 响应时间阈值
    - 并发量或数据规模
    - 可用性 / 重试 / 降级要求
    - 超时和恢复策略
    - 对应领域规模：文件大小、批任务数量、订单 / 支付峰值、知识库文档数、向量条数、移动弱网条件、API 限流窗口或报表查询时间范围
    - SLO、error budget、alert routing、rollback trigger、health check、RTO/RPO、恢复演练频率（如涉及 DevOps / SRE）
    - provider quota、retry-after、Webhook 重试、下载链接过期、地理编码配额、短信状态回调、地图 / 支付 / KYC / AI provider 降级策略（如涉及外部服务）

[回归用例]
    regression 用例优先来自：
    - 历史缺陷
    - P0 / P1 核心路径
    - 已人工验收功能
    - 高风险改动影响面
    - 生产事故或客服高频问题
