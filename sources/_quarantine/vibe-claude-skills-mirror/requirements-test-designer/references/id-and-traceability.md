# id-and-traceability

[读取时机]
    需要设计稳定 REQ-ID / TC-ID、PRD 变更影响分析或追溯矩阵时读取。

[ID 目标]
    ID 的作用是审计和增量维护，不是展示排序。不要因为新增、删除或重排需求而全量重洗编号。

[REQ-ID 规则]
    - 格式：`REQ-001`、`REQ-002`、`REQ-003`。
    - 每个 `REQ-ID` 对应一个可测试需求或约束。
    - 需求措辞变化但语义不变时保留原 ID。
    - 需求拆分时：
        - 原 ID 保留给最核心的原始语义。
        - 新拆出的独立语义追加新 ID。
        - 在变更说明中记录拆分关系。
    - 需求合并时：
        - 保留主要业务语义的 ID。
        - 被合并 ID 标记 deprecated / merged，不删除。
    - 删除需求时保留 ID，状态标记 deprecated。

[Scenario-ID 规则]
    - 格式：`SCN-001`、`SCN-002`。
    - scenario 表示一个路径、规则、状态变化、接口契约或风险面。
    - 一个 scenario 可以覆盖多个 `REQ-ID`，但必须说明主需求。
    - scenario 重排不改变 ID。

[TC-ID 规则]
    - 格式：`TC-001`、`TC-002`。
    - 每条 test case 只验证一个主要断言。
    - 用例修订时保留 `TC-ID`，变更状态标记 revised。
    - 用例不再适用时保留 `TC-ID`，变更状态标记 deprecated。
    - 新增用例追加新编号，不填补旧编号空洞。

[自动化候选 ID]
    推荐格式：`AUTO-001`。
    自动化候选不是已实现测试。只有测试代码存在且 fresh 运行通过，才可以标记为 implemented。

[追溯矩阵字段]
    最小字段：
    - `REQ-ID`
    - Requirement Summary
    - `Scenario-ID`
    - Scenario Summary
    - `TC-ID`
    - Test Case Title
    - Test Type
    - Priority
    - Coverage Status
    - Automation Candidate
    - Automation Level
    - Manual Acceptance Status
    - Change Status
    - Source

[覆盖状态]
    - covered：已有用例可验证该需求。
    - partial：只覆盖部分路径或断言。
    - blocked：缺关键需求信息或环境条件，无法设计可执行用例。
    - needs clarification：能提出用例轮廓，但关键断言需要确认。
    - not applicable：该维度不适用，必须写原因。

[变更状态]
    - new：新增 requirement / scenario / case。
    - unchanged：语义未变。
    - revised：语义或断言改变，需要更新用例。
    - deprecated：不再适用但保留审计记录。
    - split：原需求拆分。
    - merged：并入其他需求。

[增量影响分析]
    1. 先对 requirement 做语义级 diff，不按行号机械 diff。
    2. 再找共享对象：
        - 角色 / 权限
        - 状态机
        - API / schema
        - 数据对象
        - 工作流步骤
        - 设计稿交互
        - 非功能约束
    3. 标记影响：
        - direct：需求本身变化。
        - indirect：依赖对象变化。
        - regression：高风险核心路径或历史缺陷相关。
    4. 输出：
        - 保留 ID 列表
        - 新增 ID 列表
        - revised ID 列表
        - deprecated ID 列表
        - 需要人工确认的 ID 列表

[禁止行为]
    - 不因为排序变化重新编号。
    - 不删除 deprecated ID。
    - 不把一个 `TC-ID` 同时验证多个不相关业务断言。
    - 不把自动化候选写成已自动化。
