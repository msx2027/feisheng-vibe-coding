---
name: requirements-test-designer
description: '仅当用户先明确调用 `feisheng-vibe-coding` 总入口并指定 `requirements-test-designer`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发；当用户要把 PRD、需求文档、用户故事、验收标准、接口说明或设计稿说明转成工程级测...'
user-invocable: false
disable-model-invocation: true
---
[任务]
    把 PRD / 需求文档 / 用户故事 / 验收标准 / 接口说明 / 设计稿说明转成生产级测试设计资产，而不是简单 checklist。

    **generate 模式**：从需求输入生成 requirements、scenarios、test cases、automation candidates 和 traceability matrix。

    **review profile**：审查已有测试用例体系是否达到工程级，指出弱断言、漏覆盖、不可追溯和导出问题。

    **impact-analysis 模式**：PRD 或需求变更后做增量影响分析，保留稳定 ID，只追加、修订或废弃受影响用例。

    **export 模式**：输出 Markdown、CSV / Excel、TestRail / Qase / qTest / Zephyr 友好字段结构。

    **handoff 模式**：识别自动化候选和技术栈信号，把后续测试代码生成交给 `test-automation`。

[依赖检测]
    Skill 启动时第一步自动执行。

    必需：
    - 需求输入 → PRD、需求文档、用户故事、验收标准、接口说明、设计稿说明或用户粘贴的需求片段；缺失时先要求用户提供最小需求输入
    - 目标输出形态 → 未指定时默认输出 Markdown 主报告 + CSV 友好表格字段

    可选：
    - `.vibe-docs.json` → 有则按角色映射读取目标项目需求、接口契约、验收记录和开发计划；没有则只基于用户提供输入工作
    - 目标项目需求文档 → 优先用 `.vibe-docs.json.productSpec`，默认 `需求文档.md`
    - 目标项目接口契约文档 → 优先用 `.vibe-docs.json.interfaceContracts`，默认 `接口契约.md`；用于 API contract / error / permission / data persistence 覆盖
    - 目标项目人工验收记录 → 优先用 `.vibe-docs.json.manualAcceptance`，默认 `验收记录.md`；用于标记人工验收状态和需回归复验路径
    - 已有测试用例或 traceability matrix → impact-analysis 模式必须读取；缺失时只能生成 baseline，不能声称保留旧 ID
    - 设计稿说明、Figma / Pencil 说明或截图文字 → 用于 accessibility、responsive、visual acceptance 和人工验收路径
    - 目标项目代码和测试配置 → 只用于识别自动化可行性和技术栈，不在本 Skill 中编写测试代码
    - `scripts/validate-test-suite.mjs` → 当生成 CSV 测试用例表时，用于检查必填字段、弱断言、ID 格式和追溯矩阵一致性

    降级策略：
    - 需求信息不足时，输出 assumptions、clarifying questions 和 blocked / partial 覆盖状态，不擅自补业务规则
    - 没有旧版测试资产时，impact-analysis 降级为 baseline generation，并明确无法证明旧 ID 稳定
    - 没有技术栈信息时，只输出自动化候选和待识别信号，不推荐具体框架

[本包治理继承]
    创建或执行本 Skill 时必须继承本包主控纪律：
    - 先判定 `execution tier`；命中 Skill / Hook / Tool / Agent、发布、权限、安全、数据、文件系统、shell、network 等风险时按 T3+ hazard mode 执行
    - 目标项目生命周期文档先读 `.vibe-docs.json`，再按角色映射读写四字中文 `.md`；新生成文档必须符合 `^[\u4e00-\u9fff]{4}\.md$`
    - 需要用户真实点击、操作或观察时，输出人工验收状态；只有用户明确确认后才能记录为 `用户已确认`
    - 涉及真实 endpoint、service、public entry、server action、fetch wrapper、IPC / event 通道或 schema 时，先读 `.vibe-docs.json.interfaceContracts` 映射的 `接口契约.md`，同一业务能力只复用或扩展一个统一入口
    - 正式前端页面先识别 UI 包、design tokens、组件盘点、设计复审报告和设计系统复用门禁；页面层优先复用 UI / token / 组件
    - references 采用 progressive references：先读 `SKILL.md`，只在下方 [按需加载 references] 表命中时读取对应 reference
    - 涉及 `.pen` 或 Pencil 时，必须使用 Pencil desktop 客户端和 desktop MCP server；不得 fallback 到 VS Code

[第一性原则]
    **需求可追溯**：每条可测试需求必须有稳定 `REQ-ID`，每条测试用例必须有稳定 `TC-ID`，并通过 traceability matrix 连接 requirement -> scenario -> test case -> automation candidate。

    **断言可判定**：预期结果必须写成可观察、可复核的结果；禁止“验证功能正常”“符合预期”“should work”这类弱断言。

    **覆盖风险驱动**：必须逐项判断 happy path、negative path、boundary value、permission、role、state transition、workflow、data persistence、API contract、error handling、security、accessibility、performance / reliability、compatibility、regression；不适用也要标记原因。

    **领域风险触发**：小白输入命中支付、退款、库存、租户、权限、审计、导入导出、批处理、API key、Webhook、移动端、离线同步、AI / RAG、内容审核、隐私合规、GDPR / DSAR、KYC / AML、FHIR / PHI、数据平台、SRE / 发布、物流 / 预约 / 通知等高风险词时，必须读取 `domain-risk-catalog.md` 并补领域专项断言。

    **不脑补需求**：PRD 信息不足时先列 assumptions 和 clarifying questions；可以给测试设计占位，但覆盖状态必须标为 `blocked` 或 `needs clarification`。

    **自动化后置**：本 Skill 只判断自动化候选和建议层级；生成、接入、运行测试代码时交给 `test-automation`，并传递技术栈、测试层级、候选用例和人工验收状态。

    **语言无关**：PRD 到测试设计本身不绑定任何编程语言；只有进入自动化 handoff 时才识别目标项目技术栈和测试框架。

    **联网优先**：涉及第三方测试管理工具导入规则、字段限制、API 或当前产品能力时先查官方文档；不凭过期记忆承诺格式细节。

[文件结构]
    ```
    requirements-test-designer/
    |-- SKILL.md
    |-- references/
    |   |-- api-contract-checklist.md
    |   |-- automation-handoff.md
    |   |-- clarifying-questions.md
    |   |-- domain-risk-catalog.md
    |   |-- id-and-traceability.md
    |   |-- large-prd-slicing.md
    |   |-- output-formats.md
    |   |-- production-simulation.md
    |   |-- quality-gate.md
    |   |-- test-design-taxonomy.md
    |   `-- workflow.md
    |-- scripts/
    |   |-- simulate-production-suite.mjs
    |   `-- validate-test-suite.mjs
    `-- templates/
        |-- test-case-export-template.csv
        |-- test-suite-template.md
        `-- traceability-matrix-template.csv
    ```

[按需加载 references]
    不默认全量读取 references；只在当前任务命中下表场景时读取对应文件。

    | 场景 | 读取 |
    | --- | --- |
    | 实际生成、审查或增量更新测试用例体系 | `references/workflow.md` |
    | 需要设计稳定 REQ-ID / TC-ID、PRD 变更影响分析或追溯矩阵 | `references/id-and-traceability.md` |
    | 需要判断正反用例、边界、权限、状态、API、安全、可访问性、性能等覆盖维度 | `references/test-design-taxonomy.md` |
    | 小白自然语言输入、需求模糊 / 冲突，或命中高风险业务领域 | `references/domain-risk-catalog.md` |
    | 需要输出 Markdown、CSV / Excel、TestRail / Qase / qTest / Zephyr 友好格式 | `references/output-formats.md` |
    | 需要判断自动化候选、识别技术栈或转交 `test-automation` | `references/automation-handoff.md` |
    | 收口前需要做工程级质量门禁或运行 CSV 校验脚本 | `references/quality-gate.md` |
    | 需要证明本 Skill 能通过接近生产的复杂 PRD 模拟 | `references/production-simulation.md` |
    | PRD 很大、需求很多或需要控制输出规模 | `references/large-prd-slicing.md` |
    | PRD 信息不足，需要输出高影响澄清问题 | `references/clarifying-questions.md` |
    | 需求包含 API / endpoint / schema / 错误码 / audit log | `references/api-contract-checklist.md` |

[工程级测试用例字段]
    每条测试用例必须包含：
    - `TC-ID`
    - 标题
    - 关联需求（一个或多个 `REQ-ID`）
    - 优先级（P0 / P1 / P2 / P3）
    - 测试类型
    - 前置条件
    - 测试数据
    - 步骤
    - 预期结果
    - 是否可自动化
    - 自动化建议
    - 人工验收状态

    推荐补充：
    - `Scenario-ID`
    - 需求来源
    - 覆盖状态（covered / partial / blocked / needs clarification / not applicable）
    - 变更状态（new / unchanged / revised / deprecated）
    - 风险标签
    - 适用角色 / 权限
    - 数据持久化与审计日志断言

[测试设计维度清单]
    必须逐项判断：
    - happy path：主成功路径和关键业务目标
    - negative path：无效输入、非法操作、失败依赖、拒绝路径
    - boundary value：长度、数量、时间、金额、分页、空值、最大最小值
    - permission / role：匿名、普通用户、管理员、跨租户、越权、权限降级
    - state transition：状态机、重复提交、撤销、过期、并发、幂等
    - workflow：跨页面 / 跨步骤 / 端到端业务流程
    - data persistence：创建、读取、更新、删除、刷新、重启、审计日志
    - API contract：请求、响应、状态码、schema、错误码、向后兼容
    - error handling：用户可见错误、重试、超时、离线、部分失败
    - security：认证、授权、输入注入、敏感信息、速率限制、审计
    - accessibility：键盘、焦点、语义、读屏、颜色对比、错误提示关联
    - performance / reliability：响应时间、吞吐、稳定性、恢复、降级
    - compatibility：浏览器、设备、系统、语言、时区、数据版本
    - regression：历史缺陷、核心路径、已人工验收路径和高风险变更点

    命中高风险业务词时，还必须按 `domain-risk-catalog.md` 补领域专项覆盖；例如交易账务一致性、异步回调幂等、移动权限撤销、离线同步冲突、RAG 引用可信度、API key 轮换、批处理部分失败、报表口径人工验收、GDPR 删除传播、KYC 活体和 watchlist 复核、FHIR Consent / AuditEvent、SLO burn-rate、booking hold 竞态和短信 opt-out。

[信息充足度判断]
    可以输出完整测试体系前，必须满足：
    - 至少能识别一个可测试业务目标或用户故事
    - 每条需求能拆成可判定的行为、输入、输出或约束
    - 角色 / 权限、主要状态、关键数据和错误处理至少有明确来源或被标记为 assumption / question
    - 能说明哪些覆盖维度已覆盖、部分覆盖、阻塞或不适用

    不满足时仍可输出：
    - assumptions
    - clarifying questions
    - blocked coverage matrix
    - 可先设计的 smoke / happy path baseline

    小白输入必须额外标记完整度：完整 / 中等 / 模糊 / 冲突。冲突输入先输出 conflict list；模糊但高风险的输入必须给 smoke baseline，不能只停在 blocked。

[工作流程]
    [第一步：识别模式和输入]
        判断当前是 generate、review、impact-analysis、export、handoff 或组合模式。
        定位 PRD / 需求文档 / 用户故事 / 验收标准 / 接口说明 / 设计稿说明和已有测试资产。
        对小白自然语言输入标记完整度，并识别高风险业务触发词。

    [第二步：读取必要 reference]
        生成、审查或增量更新时读取 `references/workflow.md`。
        需要 ID 稳定或变更分析时读取 `references/id-and-traceability.md`。
        需要覆盖维度设计时读取 `references/test-design-taxonomy.md`。
        命中小白模糊输入、冲突输入或高风险业务触发词时读取 `references/domain-risk-catalog.md`。
        需要导出格式时读取 `references/output-formats.md`。
        需要自动化衔接时读取 `references/automation-handoff.md`。
        收口前读取 `references/quality-gate.md`。

    [第三步：规范化需求]
        抽取 requirement candidates，合并重复项，拆分复合需求。
        为每条需求分配或复用稳定 `REQ-ID`，记录来源、状态、验收标准和信息缺口。

    [第四步：生成场景和用例]
        为每条需求生成 `Scenario-ID`，再生成 `TC-ID`。
        覆盖正向、反向、边界、权限、状态、工作流、持久化、API、错误、安全、可访问性、性能、兼容和回归维度。
        先应用 `domain-risk-catalog.md` 的高风险触发器，再生成用例；高风险模糊输入要同时输出 smoke baseline、blocked coverage matrix 和高影响澄清问题。
        每条用例必须有具体测试数据、步骤和可判定预期结果。

    [第五步：生成追溯矩阵和导出]
        输出 requirement -> scenario -> test case -> automation candidate 的 traceability matrix。
        按用户要求输出 Markdown、CSV / Excel 或测试管理工具友好字段；未指定时默认 Markdown + CSV 表头。

    [第六步：质量门禁]
        检查弱断言、缺字段、ID 不稳定、覆盖缺口、脑补需求、人工验收状态、自动化候选和领域专项断言。
        如果生成了 CSV 测试用例表，运行 `node skills/requirements-test-designer/scripts/validate-test-suite.mjs <test-cases.csv> --trace <traceability.csv> --require-types "happy path,negative path,boundary value,permission,role,state transition,workflow,data persistence,API contract,error handling,security,accessibility,performance / reliability,compatibility,regression"`；高风险套件可追加 `--require-types-per-req "<types>"` 检查每个需求的关键类型覆盖；无法运行时按 `quality-gate.md` 做人工门禁。
        需要验证 Skill 本身的生产级门禁时，运行 `node skills/requirements-test-designer/scripts/simulate-production-suite.mjs`。

    [第七步：自动化衔接]
        只给出 automation candidate、推荐测试层级、技术栈信号和 handoff packet。
        用户要求生成测试代码时，切换到 `test-automation`，不要在本 Skill 内直接写自动化测试。

[初始化]
    执行 [第一步：识别模式和输入]。
