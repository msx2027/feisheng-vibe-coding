# quality-gate

[读取时机]
    收口前需要做工程级质量门禁或运行 CSV 校验脚本时读取。

[工程级完成定义]
    只有同时满足以下条件，才可以声明测试用例体系达到工程级：
    - 每条可测试需求有稳定 `REQ-ID`。
    - 每条测试用例有稳定 `TC-ID`。
    - 有 requirement -> scenario -> test case -> automation candidate 追溯矩阵。
    - 每个 `REQ-ID` 的覆盖状态明确：covered / partial / blocked / needs clarification / not applicable。
    - 每条测试用例包含必填字段。
    - 每条测试用例有具体测试数据、可执行步骤和可判定预期结果。
    - 没有“验证功能正常”“符合预期”“should work”等弱断言。
    - PRD 信息不足处已列 assumptions 和 clarifying questions。
    - 自动化候选只标候选，不伪装成已实现。
    - 人工验收状态明确。
    - 导出格式不丢 traceability 信息。
    - 命中高风险业务触发器时，已补领域专项断言，或明确标记为 blocked / needs clarification 并给出 smoke baseline。
    - 高风险需求不能只靠 suite-level 覆盖凑数；每个命中风险的 `REQ-ID` 或 risk tag 都要有对应专项断言、阻塞原因或澄清问题。

[必查问题]
    1. 是否有需求没有用例，也没有 blocked / not applicable 原因？
    2. 是否有用例没有关联 `REQ-ID`？
    3. 是否有 `TC-ID` 重复或格式不稳定？
    4. 是否有一个用例塞入多个不相关断言？
    5. 是否有步骤无法执行或依赖未声明？
    6. 是否有预期结果只写“正常 / 成功 / 正确”？
    7. 是否有权限、错误、边界、状态、数据持久化或 API 维度被漏判？
    8. 是否把需要人工观察的设计稿 / 可用性判断误判为已自动化？
    9. 是否在需求不清时脑补了业务规则？
    10. 是否在 PRD 变更后重洗了编号？
    11. 交易场景是否覆盖金额、流水、幂等、重复回调和对账？
    12. 多租户 / 权限场景是否覆盖 API 直接访问、旧会话权限撤销和审计？
    13. 导入、批处理、Webhook、离线同步或异步任务是否覆盖部分失败、重试、回滚和最终一致性？
    14. 移动端、AI / RAG、内容审核或 BI 报表是否输出了真实设备 / 引用可信度 / 审核治理 / 指标口径等领域验收点？
    15. 隐私 / GDPR / DSAR 是否覆盖身份验证、机器可读导出、下载过期、legal hold、下游 processor 回执、consent 撤回传播、保留期和目的限制？
    16. KYC / 金融 / 账务是否覆盖 document/selfie/liveness、watchlist/PEP 复核、bank relink、micro-deposit 锁定、ledger 借贷平衡、争议期限、step-up auth 和监管留存冲突？
    17. 医疗 / FHIR / PHI 是否覆盖 SMART requested/granted scope、FHIR compartment、Consent revocation、AuditEvent、break-glass 复核、PHI 日志脱敏和 amendment/version 链？
    18. 移动 provider 场景是否覆盖 OTP TTL/429/anti-fraud、定位精度和后台权限、地图配额和 fallback、推送 token/opt-out、移动读屏/动态字号、process death 恢复？
    19. AI / RAG / Agent 是否覆盖 RAG injection、vector ACL、citation faithfulness、moderation、eval regression、rate limit/quota、PII retention、human review、tool approval、fine-tune/dataset deletion 和 feedback-to-eval？
    20. DevOps / SRE 是否覆盖 pagination / retry-after、Webhook signature/replay、least privilege scopes、readiness/liveness、rollback trigger、burn-rate alert、incident/postmortem、secret hot reload 限制、deprecation/sunset、RPO/RTO restore evidence？
    21. 物流 / 预约 / 通知是否覆盖地图 quota、geofence 边界、状态 webhook 乱序、booking hold expiration race、SMS opt-out、split fulfillment 数量守恒、DST pickup window 和人工调账审计？

[CSV 校验脚本]
    如果生成了 CSV 测试用例表，运行：

    ```powershell
    node skills/requirements-test-designer/scripts/validate-test-suite.mjs <test-cases.csv> --trace <traceability.csv>
    ```

    对生产级套件要求覆盖指定类型时，追加：

    ```powershell
    node skills/requirements-test-designer/scripts/validate-test-suite.mjs <test-cases.csv> --trace <traceability.csv> --require-types "happy path,negative path,boundary value,permission,role,state transition,workflow,data persistence,API contract,error handling,security,accessibility,performance / reliability,compatibility,regression"
    ```

    对高风险套件要求每个 `REQ-ID` 都至少有领域相关的类型覆盖时，追加：

    ```powershell
    node skills/requirements-test-designer/scripts/validate-test-suite.mjs <test-cases.csv> --trace <traceability.csv> --require-types-per-req "happy path,negative path,API contract,error handling,security"
    ```

    注意：`--require-types-per-req` 只证明每个需求都有必要类型或 blocked / needs clarification 的测试记录；领域专项语义仍需结合 `domain-risk-catalog.md` 和人工 review 判断。

    自测脚本：

    ```powershell
    node skills/requirements-test-designer/scripts/validate-test-suite.mjs --self-test
    ```

    生产级模拟门禁：

    ```powershell
    node skills/requirements-test-designer/scripts/simulate-production-suite.mjs
    ```

    脚本能检查：
    - 必填字段
    - `REQ-ID` / `TC-ID` / `Scenario-ID` 基础格式
    - 重复 `TC-ID`
    - 弱断言
    - 空步骤 / 空测试数据 / 空预期
    - 自动化状态枚举
    - 人工验收状态枚举
    - 覆盖状态和变更状态枚举
    - traceability matrix 中 test case 和 requirement 的基本一致性
    - traceability matrix 中不存在孤儿 `REQ-ID` / `TC-ID`
    - `--require-types-per-req` 要求的类型是否在每个 `REQ-ID` 下出现，或该需求是否有 blocked / needs clarification 的合理记录

    脚本不能替代人工 QA 判断：
    - 业务规则是否真的正确
    - 覆盖维度是否足够深入
    - 性能阈值是否合理
    - 设计稿视觉验收是否通过
    - 领域专项断言是否充分，例如支付幂等、离线同步冲突、AI 引用可信度、API key 轮换、批处理回滚、GDPR 删除传播、KYC 活体、FHIR Consent、SLO burn-rate 或 booking hold 竞态

[弱断言替换]
    不合格：
    - 验证功能正常。
    - 页面正常显示。
    - 接口返回正确。
    - 用户可以成功操作。

    合格：
    - 提交有效表单后，系统返回 `201`，响应体包含新建资源 ID；列表刷新后显示该资源，数据库记录状态为 `active`。
    - 无权限用户访问审批接口时返回 `403`，资源状态保持 `pending`，审计日志记录拒绝原因和操作者 ID。
    - 输入 101 个字符的名称时，保存按钮保持禁用，字段下方显示“最多 100 个字符”，请求不会发送。

[收口输出]
    收口时输出：
    - 是否达到工程级：是 / 否 / 部分达到
    - 证据：用例数量、需求覆盖、矩阵状态、脚本运行结果
    - 不足：blocked / needs clarification / partial
    - 下一步：澄清问题、补用例、交给 `test-automation` 或人工验收
