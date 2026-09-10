# domain-risk-catalog

[读取时机]
    用户输入来自小白自然语言、需求表达模糊或冲突，或出现支付、退款、库存、租户、权限、审计、导入导出、批处理、API key、Webhook、移动端、离线同步、AI / RAG、内容审核、发布回滚、KYC、AML、FHIR、PHI、GDPR、DSAR、RLS、地图、预约、派单、通知或 SRE 等高风险业务词时读取。

[目标]
    通用测试维度只能保证“覆盖面”，不能保证“业务深度”。本文件把常见生产事故域转成触发器：命中触发器时，必须补充领域专项断言、澄清问题和失败信号。

[小白输入分级]
    - 完整：有角色、行为、数据、状态、验收标准、错误处理和非功能约束；可以直接生成完整套件。
    - 中等：业务目标明确，但缺边界、权限、状态或接口细节；生成用例时同步列 assumptions / questions。
    - 模糊：只有“能用、别卡、别乱、最好支持”等目标；只能输出 smoke baseline + blocked coverage matrix + 高影响澄清问题。
    - 冲突：同一需求存在互斥约束，例如“随便改状态但审计不可变”“错的跳过但要全量一致”；先输出 conflict list，不擅自选边。

[高风险触发器]
    命中下列触发器时，即使 PRD 没明说接口、状态或安全，也要补对应测试维度。

| 领域 | 触发词 | 必补断言 |
| --- | --- | --- |
| B2B / SaaS | 多租户、客户隔离、RBAC、菜单权限、审批、审计日志、报表、导入导出、批量操作、配置中心 | API 越权、跨租户访问、旧会话权限撤销、审计字段、部分失败、数据口径、导出脱敏、配置影响范围、规则版本/effective time、历史流程快照、合并 lineage |
| 身份治理 / 访问控制 | MFA、Conditional Access、风险登录、step-up auth、session、refresh token、设备撤销、账号恢复、lockout、break-glass、legacy auth | 高风险登录、可信设备、session lifetime、sign-in log、per-user MFA 状态迁移、break-glass、旧会话/refresh token 失效、设备撤销、恢复流程防绕过 MFA、管理员代恢复审计 |
| 隐私 / 合规 | GDPR、DSAR、访问请求、删除请求、right to be forgotten、portability、consent、withdrawal、processor、subprocessor、legal hold、retention、data minimization、purpose limitation | 身份验证、请求时限、机器可读导出、下载链接过期、删除例外、下游 processor 回执、同意版本、撤回传播、保留期、目的限制、最小审计、安全下载、缓存/搜索/备份处理 |
| 电商 / 支付 | 购物车、优惠券、库存、订单、支付、退款、发票、积分、会员价、秒杀、拼团、风控、跨境、subscription、dispute、chargeback、tokenization、PCI | 金额精度、价格快照、库存不可负、支付/退款流水、重复回调幂等、乱序事件、退款分摊、对账差异、优惠叠加冲突、争议证据期限、订阅 proration、PAN/CVV 不落库、汇率/零小数币种、分仓履约 |
| 金融 / KYC / 账务 | KYC、AML、sanctions、watchlist、PEP、liveness、selfie、document verification、bank link、relink、micro-deposit、ACH、NSF、hold、ledger、double-entry、risk score、PII redaction | 活体攻击、证件/自拍匹配、watchlist 复核闭环、银行链接 token 生命周期、micro-deposit 锁定、资金 hold/NSF/return、double-entry 借贷平衡、争议终态、误伤申诉、AAL step-up、监管留存冲突、不可篡改审计 |
| 医疗 / 受监管数据 | FHIR、SMART on FHIR、PHI、ePHI、HIPAA、CMS Patient Access API、Consent、AuditEvent、Bulk Export、break-glass、lab result、secure message、eligibility | 最小必要访问、patient/proxy/provider/care team/system client 角色、requested vs granted scope、FHIR compartment、security label、Consent revocation、AuditEvent、break-glass 复核、PHI 日志脱敏、amendment/version、下游传播 |
| 移动端 / 小程序 | 验证码、微信登录、定位、推送、相机、相册、扫码、离线、弱网、权限弹窗、深色模式、分享、蓝牙、NFC、App 升级、地图、deep link | 权限拒绝/撤销、真机/系统差异、弱网重试、离线队列、冲突合并、本地加密、厂商通道、深链回跳、设备不支持、旧版本兼容、OTP TTL/429/防刷、定位精度/后台权限、地图配额/fallback、移动读屏/动态字号 |
| 内容 / 社区 | 发帖、评论、举报、审核、敏感词、私信、封禁、排行榜、推荐、版权、订阅 | 审核状态机、举报去重、误杀申诉、恶意举报、XSS、内容权限、通知隐私、审计日志、版权/法务人工确认 |
| AI / RAG / Agent | AI 生成、提示词、配额、历史记录、知识库、文档问答、向量、引用、模型、流式输出、eval、moderation、tool calling、fine-tuning | prompt injection、越权检索、向量索引 ACL、citation faithfulness、无来源拒答、moderation、安全拒答率、eval baseline、模型/提示词版本、流式中断/计费幂等、human review、tool approval、dataset lineage 删除、反馈投毒 |
| 内部工具 / 数据平台 | Excel、CSV、字段映射、数据质量、批处理、回滚、BI、报表调度、同步、任务面板、BigQuery、Snowflake、Power BI、S3、object storage | 事务语义、all-or-nothing / partial success、错误行下载、重试退避、死信队列、回滚粒度、字段级权限、报表口径人工验收、CSV/Excel formula injection、load validation 差异、RLS export/embed/API 一致性、watermark/DST、multipart checksum、presigned URL 过期 |
| API 平台 / DevOps / SRE | API key、Webhook、限流、schema 兼容、日志、监控、告警、发布、回滚、Kubernetes、SLO、incident、backup、restore | key 轮换/禁用、scope、签名、防重放、429 语义、版本兼容、日志脱敏、告警抑制/恢复、生产权限、readiness/liveness、滚动发布、回滚失败、SLO burn-rate、incident/postmortem、RPO/RTO |
| 物流 / 预约 / Marketplace | 派单、打车、配送、预约、slot、ETA、geofence、地址解析、短信通知、split fulfillment、surge pricing、proof of delivery、courier | 匹配/取消费/退款联动、ETA 重新计算、地图失败 fallback、围栏边界、状态机、签收证明、地址歧义人工修正、并发预约 hold 过期、短信回执/opt-out、跨时区/DST、客服手工调整审计 |

[领域专项深度门禁]
    命中高风险触发器时，不能只在整个测试套件层面有一个 security / API / reliability 用例就算覆盖。必须按 `REQ-ID` 或风险标签逐项说明：
    - 该需求命中了哪些领域风险。
    - 哪些领域专项断言已 covered。
    - 哪些因 PRD 缺少规则而 blocked / needs clarification。
    - smoke baseline 至少覆盖一个核心正向路径和一个拒绝 / 失败路径。
    - 如果依赖第三方平台、行业标准或协议，必须列出官方语义假设，例如状态枚举、限流窗口、回调重试、权限模型、数据保留或版本兼容。

[高风险模糊输入兜底]
    如果高风险触发器命中但 PRD 信息不足，不允许只说 blocked 后停止。必须输出：
    - 可验证的 smoke baseline：至少覆盖一个正向核心路径和一个拒绝/失败路径。
    - blocked coverage matrix：说明哪些维度因缺少规则阻塞。
    - clarifying questions：只问会改变断言、优先级、权限、状态、接口或自动化可行性的问题。
    - automation candidate：只标候选和阻塞条件，不写成已实现。

[领域失败信号]
    生成或审查时出现下列情况，应判定为工程深度不足：
    - 交易场景没有金额、流水、幂等、重复回调或对账断言。
    - 多租户 / 权限场景只测 UI 按钮隐藏，不测 API 直接访问。
    - 导入 / 批处理场景没有部分失败、错误行、重试、回滚或审计断言。
    - 移动端场景没有权限撤销、弱网、真机/系统差异或离线恢复。
    - AI / RAG 场景没有 prompt injection、引用来源、越权检索或无来源拒答。
    - 内容审核场景没有状态机、误杀申诉、恶意举报或审核日志。
    - 报表 / BI 场景没有指标口径、样本数据和人工验收状态。
    - GDPR / 隐私场景没有身份验证、下载过期、legal hold、下游 processor 回执或 retention 断言。
    - KYC / 金融场景没有活体攻击、watchlist 复核、double-entry ledger、step-up auth 或监管留存冲突断言。
    - FHIR / PHI 场景没有 SMART scope、Consent、AuditEvent、break-glass 或 PHI 日志脱敏断言。
    - OTP / 地图 / 出行场景没有 provider 限流、权限精度、配额 fallback、Webhook 乱序去重或通知回执断言。
    - SRE / 发布场景没有 readiness、rollback、SLO / alert、incident 或 backup restore 断言。
