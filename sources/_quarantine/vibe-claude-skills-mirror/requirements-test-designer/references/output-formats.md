# output-formats

[读取时机]
    需要输出 Markdown、CSV / Excel、TestRail / Qase / qTest / Zephyr 友好格式时读取。

[默认输出包]
    未指定格式时输出：
    1. Markdown 测试套件报告。
    2. 测试用例 CSV 字段表。
    3. 追溯矩阵 CSV 字段表。
    4. assumptions / clarifying questions。
    5. 自动化候选 handoff packet。

[Markdown 结构]
    使用 `templates/test-suite-template.md`。

    必须包含：
    - 输入来源
    - 小白输入完整度和领域风险触发器
    - assumptions
    - clarifying questions
    - requirements 表
    - scenarios 表
    - test cases 表
    - traceability matrix
    - automation candidates
    - coverage gaps
    - platform / environment matrix（如涉及移动端、多端、浏览器、设备、SDK 或 API client）
    - manual acceptance status

[CSV / Excel 字段]
    测试用例表使用 `templates/test-case-export-template.csv`。

    必填列：
    - `TC-ID`
    - `标题`
    - `关联需求`
    - `Scenario-ID`
    - `优先级`
    - `测试类型`
    - `前置条件`
    - `测试数据`
    - `步骤`
    - `预期结果`
    - `是否可自动化`
    - `自动化建议`
    - `人工验收状态`
    - `覆盖状态`
    - `变更状态`

    命中高风险领域时建议增加的扩展列；目标工具不支持时放入 custom fields 或 labels：
    - `风险标签`
    - `领域专项断言`
    - `外部服务依赖`
    - `第三方事件语义`
    - `幂等键`
    - `状态机版本`
    - `时区/locale`
    - `审计证据`
    - `人工验收证据链接`
    - `Risk Standard`
    - `Regulatory Basis`
    - `Data Category`
    - `Processing Purpose`
    - `Retention Rule`
    - `Processor Impact`
    - `Evidence Required`

    特定领域命中时的推荐扩展列：
    - AI / RAG：`Model/Prompt Version`、`Eval-ID`、`Safety Policy`、`Source/Citation Requirement`、`Confidence Threshold`、`Tool Approval Required`、`Retention/Deletion Evidence`。
    - 金融 / 支付：`Ledger Impact`、`Webhook/Event ID`、`Risk Decision Source`、`Manual Review SLA`、`Currency/Settlement Context`。
    - 医疗 / FHIR：`Regulated Data Tag`、`FHIR Resource/Profile`、`Consent Policy`、`AuditEvent Assertion`、`PHI Leakage Risk`、`Manual Clinical/Compliance Review`。
    - 移动端：`OS/version`、`device class`、`permission state`、`network profile`、`provider sandbox/prod`、`app version/API version`、`accessibility setting`、`storage/process death`。

    追溯矩阵使用 `templates/traceability-matrix-template.csv`。

    必填列：
    - `REQ-ID`
    - `Requirement Summary`
    - `Scenario-ID`
    - `Scenario Summary`
    - `TC-ID`
    - `Test Case Title`
    - `Test Type`
    - `Priority`
    - `Coverage Status`
    - `Automation Candidate`
    - `Automation Level`
    - `Manual Acceptance Status`
    - `Change Status`
    - `Source`

[CSV 写法]
    - 多值字段用分号分隔，例如 `REQ-001;REQ-004`。
    - 步骤和预期结果可用换行编号，CSV 中必须正确加引号。
    - 空值不可留空；不知道就写 `待澄清`、`不适用：原因` 或 `blocked：原因`。
    - 不把 rich text、Markdown 表格嵌入单元格；导出工具不一定保留格式。

[TestRail 友好格式]
    - 把 `TC-ID` 映射到 custom case ID 或 external ID。
    - 把标题映射到 title。
    - 把前置条件映射到 preconditions。
    - 把步骤和预期结果映射到 separated steps 或步骤字段。
    - 把优先级、测试类型、自动化状态、人工验收状态映射到 custom fields。
    - 如果项目已有 TestRail 字段名，优先使用项目字段名，不强制改字段。

[Qase 友好格式]
    - 保留稳定外部 ID 字段。
    - 步骤和预期结果保持可分离。
    - 标签可包含 `REQ-ID`、测试类型、风险标签和自动化层级。
    - 自定义字段承载人工验收状态、覆盖状态和变更状态。

[qTest 友好格式]
    - Excel-friendly 表格中保持一行一个测试用例。
    - 步骤较多时使用可映射的步骤列或单元格换行编号。
    - 关联需求字段保留 `REQ-ID`，便于后续链接 requirements。

[Zephyr 友好格式]
    - 一行一个测试用例，保持 title、priority、status、steps、expected result 可映射。
    - `REQ-ID`、`Scenario-ID`、automation candidate 和 manual acceptance status 放入 custom fields 或 labels。

[导出质量门禁]
    - 导出表不能丢失任何必填字段。
    - 不能为了适配工具删除 traceability 信息。
    - 如果目标工具字段限制导致信息不能完整导入，必须说明损失和替代字段。
    - 生成 CSV 后优先运行 `scripts/validate-test-suite.mjs` 检查基本质量。
    - 高风险扩展列如果未导出，必须在 Markdown 测试套件报告中保留同等信息，不能丢失领域专项断言或合规证据。
