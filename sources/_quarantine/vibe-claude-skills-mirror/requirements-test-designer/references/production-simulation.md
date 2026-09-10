# production-simulation

[读取时机]
    需要证明本 Skill 能在接近真实生产的复杂 PRD 场景下产出并校验工程级测试用例体系时读取。

[目标]
    生产模拟不是替代真实项目验收，而是验证 Skill 的测试设计门禁能覆盖高风险业务场景，并能抓住弱断言、缺字段、追溯断裂和覆盖缺口。

[模拟场景要求]
    至少包含：
    - 多角色：普通用户、业务操作者、审批者、只读用户、越权用户
    - 多状态：draft、pending、approved / rejected、终态重复操作
    - API contract：成功、400、403、409、schema、错误码
    - 数据持久化：刷新、重查、audit log
    - 边界：金额、长度、空值或最大最小值
    - 安全：跨租户、敏感信息、权限拒绝
    - accessibility：键盘、焦点、错误关联或读屏标签
    - performance / reliability：指标缺失时必须标 `needs clarification`
    - compatibility：浏览器、视口、时区或语言
    - regression：历史缺陷或 release smoke
    - domain risk：最小 smoke 可抽样两个领域；完整生产门禁必须覆盖 B2B / SaaS、电商 / 支付、内容 / AI / RAG、移动 / 小程序 / 多端、内部工具 / API 平台、隐私合规、KYC / 金融、FHIR / PHI、数据平台、DevOps / SRE、物流 / 预约 / 通知等压力域。只读评估时不得运行会写临时文件的脚本，改用人工门禁。
    - per-REQ / per-risk-tag：高风险需求不能只靠 suite-level 类型覆盖；每个命中高风险的 `REQ-ID` 需要有领域专项断言、blocked / needs clarification 原因或 smoke baseline。

[可重复门禁]
    运行：

    ```powershell
    node skills/requirements-test-designer/scripts/simulate-production-suite.mjs
    ```

    通过标准：
    - 生成测试用例 CSV 和 traceability CSV 到系统临时目录
    - 调用 `validate-test-suite.mjs`
    - 强制 `--require-types` 覆盖 happy path、negative path、boundary value、permission、role、state transition、workflow、data persistence、API contract、error handling、security、accessibility、performance / reliability、compatibility、regression
    - 如需强制每个需求覆盖指定类型，可额外运行 `validate-test-suite.mjs ... --require-types-per-req "<types>"`；缺少类型时，必须用同类型 blocked / needs clarification / not applicable 记录说明原因
    - 执行领域语义 oracle，确认模拟套件包含幂等、跨租户、审计、弱网 / 离线、AI / RAG、内容审核治理、批处理部分失败、API key / Webhook、多端兼容、隐私合规、KYC / 金融账务、FHIR / PHI、移动 provider、数据平台、SRE 发布灾备、物流预约通知和人工验收等代表性高风险断言
    - 输出 `Production simulation: PASS`

[失败处理]
    - 如果缺测试类型，补用例或把不适用维度明确标为 `not applicable` 并说明原因。
    - 如果 traceability 断裂，补全每个 `REQ-ID` / `TC-ID` 的矩阵行。
    - 如果性能、兼容、安全信息不足，不能编造；保留用例但覆盖状态必须是 `needs clarification`。
    - 如果领域 oracle 缺失，优先补 `domain-risk-catalog.md` 的触发器和模拟用例中的领域专项断言，而不是只新增泛化 security / API 用例。
