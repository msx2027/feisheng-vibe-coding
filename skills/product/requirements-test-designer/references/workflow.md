# workflow

[读取时机]
    实际生成、审查或增量更新测试用例体系时读取。

[generate 模式]
    1. 收集输入：PRD、用户故事、验收标准、接口说明、设计稿说明、目标用户、角色权限、数据对象、状态流和非功能约束。
    2. 对小白自然语言输入标记完整度：完整 / 中等 / 模糊 / 冲突。命中支付、退款、库存、租户、权限、审计、导入导出、批处理、API key、Webhook、移动端、离线同步、AI / RAG、内容审核、隐私合规、KYC、FHIR、SRE、物流、预约或发布回滚时读取 `domain-risk-catalog.md`。
    3. 如果 PRD 很大或覆盖矩阵可能膨胀，读取 `large-prd-slicing.md`，先按业务能力和风险分片，不机械展开低风险重复用例；高风险能力优先于低风险展示类用例。
    4. 抽取 requirement candidates：
        - 一条 requirement 只表达一个可测试行为或约束。
        - 复合句拆分；重复需求合并；模糊词进入 assumptions / questions。
        - 冲突需求进入 conflict list，不擅自选择解释。
        - 每条 requirement 记录来源位置、业务价值、优先级、状态和验收标准。
    5. 分配或复用 `REQ-ID`：
        - 初次生成用 `REQ-001` 递增。
        - 有旧矩阵时按语义匹配复用旧 ID，不因措辞变化重排。
        - 无法匹配时新增 ID，不复用废弃 ID。
    6. 生成 scenario：
        - 每个 scenario 表达一个用户路径、业务规则、状态变化、接口契约或风险面。
        - `Scenario-ID` 推荐格式：`SCN-001`，并关联一个或多个 `REQ-ID`。
    7. 生成 test case：
        - 每个 case 只验证一个主要断言，但可包含必要前置步骤。
        - 标题必须表达行为和期望结果，不用“测试功能”“验证流程”。
        - 步骤必须可执行，预期结果必须可观察。
        - 命中 `domain-risk-catalog.md` 高风险触发器时，必须补对应领域专项断言。
    8. 需求包含 endpoint、schema、错误码、audit log、Webhook、API key、限流、第三方回调、移动端同步、异步任务、FHIR/SMART、支付/KYC provider、BI export、对象存储、地图/通知 provider 或 SRE 发布语义时，读取 `api-contract-checklist.md`，补齐 contract 字段和缺失信息问题。
    9. 命中第三方平台、行业标准或受监管领域时，优先抽取官方文档中的限制、状态、错误、权限、过期、数据保留、兼容性和回调语义；如果无法确认，写入 assumptions / blocked matrix，不把通用经验伪装成已确认规则。
    10. 生成 traceability matrix：
        - 每个 `REQ-ID` 至少有一个 scenario。
        - 每个 scenario 至少有一个 test case，除非状态是 `blocked`。
        - 自动化候选必须说明推荐层级和阻塞条件。
    11. 输出 assumptions 和 clarifying questions：
        - assumptions 只写为了继续测试设计而临时采用的假设。
        - clarifying questions 优先问影响覆盖、优先级、权限、接口和数据的高影响问题。
        - 需要问题模板时读取 `clarifying-questions.md`。
        - 高风险模糊输入不能只输出 blocked；必须同时输出 smoke baseline 和 blocked coverage matrix。
    12. 对高风险需求做 per-REQ / per-risk-tag 自检：不能只因为整个套件已有某类测试，就宣称每条支付、隐私、KYC、FHIR、AI、SRE、物流或数据平台需求已覆盖；每条命中需求都要有专项断言、阻塞原因或澄清问题。

[review profile]
    1. 检查必填字段是否完整。
    2. 检查 ID 是否稳定、唯一、可追溯。
    3. 检查是否存在弱断言：
        - “验证功能正常”
        - “符合预期”
        - “页面正常显示”
        - “接口返回正确”
        - “should work”
    4. 检查步骤和预期是否一一对应。
    5. 检查每个 `REQ-ID` 的覆盖状态：covered / partial / blocked / needs clarification / not applicable。
    6. 检查是否把自动化结论写成真实已实现；未写代码时只能标 automation candidate。
    7. 检查高风险 `REQ-ID` 是否有领域专项断言，不接受只在 suite-level 出现一次 security / API / reliability 用例的覆盖假阳性。
    8. 输出缺口清单、修订建议和是否达到工程级。

[impact-analysis 模式]
    1. 读取旧 PRD、旧 requirements、旧 test cases 和旧 traceability matrix。
    2. 对新 PRD 做语义 diff：
        - unchanged：需求语义不变，只是措辞变化。
        - revised：行为、约束、角色、数据、状态或接口发生变化。
        - new：新增需求。
        - deprecated：需求被移除或不再适用。
    3. 保留旧 `REQ-ID` / `TC-ID`：
        - unchanged 保留。
        - revised 保留 ID 并增加变更说明，不重排编号。
        - new 追加新 ID。
        - deprecated 保留 ID，标记 deprecated，不删除历史。
    4. 标记受影响测试：
        - direct impact：需求直接变更。
        - indirect impact：共享角色、状态、接口、数据或工作流变更。
        - regression impact：历史缺陷、已人工验收路径或高频路径需复验。
    5. 输出影响矩阵、需新增用例、需修订用例、可废弃用例和自动化回归建议。

[export 模式]
    1. 先确定目标格式：Markdown、CSV、Excel-friendly、TestRail、Qase、qTest、Zephyr 或组合。
    2. 不同工具字段名称可以映射，但核心字段不能丢：
        `TC-ID`、标题、关联需求、优先级、测试类型、前置条件、测试数据、步骤、预期结果、是否可自动化、自动化建议、人工验收状态。
    3. CSV / Excel 中多值字段用分号分隔，步骤和预期结果可以用换行编号。
    4. 导出前检查每个字段是否能被目标工具映射；工具不支持的字段放入 custom field 或备注列。

[handoff 模式]
    1. 识别自动化候选，不直接写测试代码。
    2. 为每个候选补充：
        - 推荐测试层级：unit / integration / contract / E2E / smoke / visual / accessibility / performance
        - 技术栈信号：语言、框架、测试配置、包管理器、运行命令
        - 阻塞条件：环境、登录、测试数据、外部服务、人工观察
    3. 交给 `test-automation` 时传递 handoff packet。

[收口报告]
    必须包含：
    - 输入来源和覆盖范围
    - requirements 数量、scenarios 数量、test cases 数量、automation candidates 数量
    - traceability matrix 摘要
    - assumptions 和 clarifying questions
    - 覆盖缺口和 blocked 项
    - 导出格式和字段映射说明
    - 人工验收状态
    - 后续如需自动化测试代码时的 `test-automation` handoff packet
