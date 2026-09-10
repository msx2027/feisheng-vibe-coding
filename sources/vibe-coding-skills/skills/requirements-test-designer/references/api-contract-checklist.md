# api-contract-checklist

[读取时机]
    PRD / 接口说明包含 endpoint、service、IPC / event、schema 或错误码，且需要生成 API contract 测试用例时读取。

[API contract 字段]
    每个接口相关 requirement 至少确认或标记缺失：
    - endpoint / capability ID
    - method
    - auth requirement
    - role / permission
    - path params
    - query params
    - request body schema
    - success status
    - success response schema
    - error status
    - error code
    - error response schema
    - idempotency / duplicate request behavior
    - state precondition
    - state transition
    - persistence side effect
    - audit log side effect
    - rate limit / throttling
    - pagination / cursor / next link behavior
    - retry-after / reset header semantics
    - backward compatibility / versioning
    - deprecation / sunset behavior

[第三方 / Webhook / 异步 contract 字段]
    命中 Webhook、provider callback、异步任务、外部支付、通知、地图、身份验证、BI export、云存储或派单平台时，至少确认或标记缺失：
    - provider name / API version / sandbox vs production difference
    - provider status enum mapping
    - webhook signature / timestamp / replay window
    - event ID / idempotency key / duplicate delivery behavior
    - callback ordering / out-of-order reconciliation
    - retry / backoff / acknowledgement semantics
    - dead-letter / manual replay / redelivery handling
    - canonical object fetch or source-of-truth refresh
    - provider quota window / rate-limit headers
    - provider outage / billing disabled / invalid key fallback
    - external state vs local state reconciliation
    - download URL / presigned URL authorization and expiry

[安全 contract 字段]
    对认证、权限、隐私、审计或敏感数据接口，至少确认或标记缺失：
    - object owner / tenant source of truth
    - field-level authorization / object property authorization
    - refresh token rotation / token family invalidation
    - device revocation / old session invalidation
    - schema strictness / payload size limit
    - sensitive-field masking in response, logs and exports
    - audit immutability / retention / export integrity

[领域 contract 补充]
    - FHIR / 医疗：FHIR version/profile/IG、CapabilityStatement、SMART requested/granted scope、OperationOutcome、Bundle/NDJSON、async polling、`_since`、ETag/versionId、security labels、Consent/AuditEvent side effects。
    - 金融 / KYC：identity session state、document/selfie/liveness result、watchlist review state、ledger impact、balance state、dispute state、regulatory retention/redaction behavior。
    - 数据平台 / BI：load validation vs execution、bad record policy、RLS effective identity、export job state、incremental watermark/timezone、multipart checksum、presigned URL expiry。
    - DevOps / SRE：health check contract、rollout status, rollback trigger, SLO/error budget signal、incident status enum、backup/restore evidence, RPO/RTO target.

[测试类型映射]
    - 必填字段缺失 → negative path / API contract
    - schema 类型错误 → API contract
    - 无权限 → permission / security
    - 对象 ID / 字段越权 → permission / security / API contract
    - 非法状态 → state transition / error handling
    - 重复请求 → reliability / idempotency
    - 重复 / 乱序 Webhook → reliability / idempotency / API contract
    - provider 限流或 outage → error handling / performance / reliability
    - 成功后数据变化 → data persistence
    - 敏感字段出现在响应中 → security
    - 旧客户端字段兼容 → compatibility / regression

[断言模板]
    成功：
    - 返回指定 success status。
    - 响应体包含 contract 要求字段，字段类型和枚举值正确。
    - 资源状态或数据副作用与需求一致。
    - audit log 记录 actor、action、resource、timestamp 和结果。

    失败：
    - 返回指定 error status。
    - 错误体包含稳定 error code 和可展示 message。
    - 资源状态不变。
    - 不泄露敏感字段、跨租户资源或内部堆栈。
    - audit / security log 记录拒绝原因。

[缺失信息处理]
    如果缺 success schema、error schema、audit log 字段或幂等规则，不要编造。
    将覆盖状态标记为 `needs clarification`，并从 `clarifying-questions.md` 选取最小问题集。
