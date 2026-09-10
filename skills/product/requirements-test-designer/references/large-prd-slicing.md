# large-prd-slicing

[读取时机]
    PRD 很大、需求很多、覆盖矩阵可能膨胀，或用户要求控制输出规模时读取。

[目标]
    保持工程级追溯和风险覆盖，同时避免把每个需求机械展开成所有维度的笨重表格。

[分片策略]
    1. 按业务能力分片：
        - 用户管理
        - 权限 / 角色
        - 核心交易 / 工作流
        - 数据导入导出
        - 通知
        - 报表
        - 管理后台
    2. 每个分片独立维护 `REQ-ID` 范围和 traceability。
    3. 跨分片需求用 shared scenario 标记，不重复生成相同用例。

[风险分层]
    P0 必须完整展开：
    - 资金、权限、安全、数据丢失、核心工作流、发布 smoke、合规。

    P1 需要覆盖主要正反路径：
    - 常用业务路径、关键 API、重要边界、状态变化。

    P2 / P3 可以先生成代表性用例：
    - 低风险展示、后台低频配置、辅助信息。

[覆盖去重]
    - 相同权限规则覆盖一次后，其他同类能力引用 shared permission scenario。
    - 相同输入边界规则覆盖一次后，其他字段引用 shared validation scenario。
    - 相同 API 错误体 schema 覆盖一次 contract suite，具体 endpoint 只补差异断言。

[输出节奏]
    大型 PRD 推荐分三层输出：
    1. Coverage model：需求分片、风险等级、覆盖策略、blocked 点。
    2. P0 / P1 full cases：完整测试用例和 traceability。
    3. P2 / P3 backlog：候选用例标题、覆盖维度、是否需要展开。

[不允许的降噪]
    - 不得删除 `REQ-ID`。
    - 不得省略 P0 / P1 的 negative、permission、state、data、API、安全断言。
    - 不得把 blocked 项伪装成 covered。
    - 不得为了压缩输出丢掉 traceability matrix。
