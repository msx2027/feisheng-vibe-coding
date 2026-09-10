# 更新日志

本文件只记录会改变 skill 行为、公开契约、安装兼容性或验证能力的发布；临时运营资源不进入 CHANGELOG。同一发行版可以按功能主题列出，不要求每个日常维护提交都占一项。

## v1.0.0 — 2026-09-07

### 审计发现修复

- 审计报告允许在独立复核后以 `reviewed_pending_promotion` 交付，保持 `open`；晋升需单独授权，不再要求纯审计越权写真源。报告索引写入仅限声明并计入作用域的同目录 `README.md`。
- `supersede` 新建 ADR 使用 `truth_doc_write`；旧记录只更新替代元数据，保持历史正文。ADR 默认索引统一使用 `active`。
- 真源索引验证改为精确链接路径与根索引到模块索引的完整链，不再用文件名子串证明可发现性。
- 工作室证据加入集成后的逐房处置确认，之后只允许已授权归档；阻止未决只读任务收尾，复用上下文的版本来自项目集成门输出。普通 bug 测试分类统一为 `T1`，保护边界、新共享合同及项目严格政策保留 `T2`/`T3` 要求。
- 验证边界：本轮修复不安装、不发布、不替换可信能力基线；完整聚合门仍须完成原更新的外部 baseline promotion，静态合同和合成轨迹不代表 fresh-session 通过。

### 测试门禁按项目现状缩放，入口改动必须真实运行验证

- `T2` 严格 TDD 只在三类情况触发：`identity_permission` / `money_entitlement` / `persistent_data_schema` / `public_contract_compatibility` 保护 lane 激活、`D2`/`D3` 设计新共享合同、项目真源明确声明严格 TDD。普通 `D1` 改动跟随项目现状：被改 owner 已有测试就补一条并跑绿，没有就不新建测试、不引入测试框架；分类拿不准默认 `T1` 并写明未受自动化保护的行为，不再默认 `T2`。
- 新增两条显式边界：普通删除功能或界面为 `T1`，删除旧测试与引用并跑剩余门禁；删除保护入口仍需适用的负向证明，不禁止有实际保护作用的入口拒绝断言；不带业务规则的 UI 新增或修改为 `T0`，用浏览器或截图证据验收。「改动小 / 用户没提 / 没有框架」只对保护边界不构成免除理由，对普通改动是不新增测试代码的合法依据。
- `testing-strategy.md` 新增 Runtime Boundary Verification，与 `T0`-`T4` 级别独立、任何深度强制：改动路由、handler、中间件、鉴权接线、CLI/任务入口或页面入口后，必须在本地跑起项目，用真实请求走一遍改动入口，并按 Security Impact Checklist 命中项发无凭证、他人身份、篡改服务端字段、畸形输入四类负向请求，记录状态码和脱敏响应；跑不了只能报「入口已改，未实测」。`security.md` 的 Checklist 命中项从「写进验收计划」改为当场执行；只读限制收窄为独立 `安全审计`。启动本地 dev server 与对本地运行时发请求明确为 `local_reversible`。
- `testing-execution-gates.md` 的诚实性审计改为双向：普通 `D1` 无保护 lane 却强加 `T2` 或引入新测试框架同样记为过程偏差；最低可信测试层不免除入口验证。`development-execution-core.md`、`routes-feature.md`、`engineering-execution.md`、`routes-validation.md`、`backend-boundary.md`、`SKILL.md` 与三份宪法模板同步为一句指向，不复制规则。
- 静态执行语料：`deterministic_behavior_bug_forces_t2` 由 `behavior_bug_with_existing_suite_forces_t2` 取代，`missing_test_framework_is_not_an_escape` 改为按 `money_entitlement` 保护 lane 论证；新增普通改动无套件保持 `T1`、删功能为 `T1`、无业务规则 UI 为 `T0`、接口入口触发 Runtime Boundary Verification 四例；`default to \`T2\``、旧 `T2` 定义句与 `security.md` 的「acceptance plan」措辞列入禁止短语。基础加载集因新增强制门禁增长，`D0` 预算 60,000 → 65,000 bytes，bounded `D1` 预算 65,000 → 72,000 bytes（当前 62,905 / 70,059）。以上属于 capability 变更，需在提交后完成 baseline promotion，`compare_capability_baseline.py` 在此之前按设计报告 retired/changed。

### 工作室模式：主动评估、分发粒度、模型档位、外部执行器与房间处置

- 关闭子 agent 后门：`SKILL.md` Multi-Agent Use 删除「disjoint implementation ownership」，子 agent 只用于独立只读审计、评审、诊断；`task-decision-contract.md` 规定 `use_subagents` 的每个独立范围都是只读，存在独立实现范围时必须先产出 `studio_decision`，Studio 不可用、不推荐或被拒绝后实现继续串行，不改派子 agent。
- 主动评估义务：Startup Protocol 第 5 步、`task-risk-gates.md` 决策顺序第 8 步、`routes-feature.md` 与 Codex `openai.yaml` 一致要求——深度 `D2`/`D3` 且结果含至少两个独立交付物时，导演必须先探测宿主能力，再主动返回 `recommend_studio` / `do_not_recommend` / `resolve_boundaries_first` 及理由，不等用户点名「工作室模式」。`studio_capability_available` 必须来自真实探测，未探测是缺字段而非 `false`，不能据此得出 `do_not_recommend`。`studio-execution.md` 删除「宁可错过并行机会」的偏向句，改为不安全时返回 `resolve_boundaries_first` 并列出缺失项。
- 新增 Distribution Granularity And Model Tier：房间的活必须大到值得重新认识项目，几分钟能改完的留给导演；每个节点标 `work_kind: judgment | mechanical`，按其提出模型档位与推理深度并写入确认卡；默认当前档，`mechanical` 可建议降档，升档需该房间的用户确认，reviewer 不得低于其 producer。Codex adapter 只在用户确认的档位下传 `model` / `thinking`。
- 新增 External Local Executor：本机安装的 Cursor / Trae / WorkBuddy 等定义为外部本地执行器，不是房间、不进房间证据链；四步协议为能力探测（宿主能否操作本机应用）、只接 `mechanical` 节点、分发前与所有活跃写房间做 `allowed_paths` 重叠检查、导演自行确认结束并读取实际 diff 后经 `reviewed_patch` 回传。Codex adapter 新增对应探测段。
- 新增 Room Disposition：集成通过且用户验收后，逐房间三分类 `one_off`（建议归档）、`likely_rework`（保留活跃到后续闭合）、`reusable_context`（归档并把任务标识与交付摘要写入计划收尾段，日后取消归档或 fork 拉回），一次征求确认；归档仍不等于完成、回滚或恢复。Codex adapter 补归档恢复映射。
- 用户确认卡由 13 行压成 11 行（合并顺序依赖、可改范围与独立目录、起点版本与未提交改动、单独确认动作与主要风险），新增「每任务档位与外部编辑器分配」一栏；`唯一执行计划保存在哪里` 与 `是否授权在该路径写入唯一计划` 两行保持原文。
- 测试与治理：`execution-backbone-cases.json` 新增五个静态用例（子 agent 不得替代合格 Studio 工作、`D2` 多交付物必须主动评估、档位不得静默升、外部执行器不是房间且查重叠、收尾必须给房间处置），`SKILL.md` 与 `studio-execution.md` 分别把旧后门句和偏向句列为禁止短语；Studio live rubric 升至 v4，新增 `proactive_recommendation` / `model_tier_assignment` / `closure_room_disposition` 三个拓扑族并纳入必需覆盖；`task-decision-live-cases.json` 新增用户未点名的 `proactive-studio-without-naming` 并加一组同构对；静态 mutation 语料新增 `subagent_implementation_backdoor_restored` 与 `studio_proactive_evaluation_removed`（63 → 65）。以上同属 capability 变更，与上一节一并做 baseline promotion。
- 未验证：真实 Codex 多任务下的主动评估、档位传参、外部编辑器操作与归档恢复均未在 fresh session 执行；外部编辑器能否被操作取决于宿主是否暴露本机应用控制能力，本 skill 只提供探测与协议。

### 讨论沉淀闸门：多轮讨论与验收后的结论必须经授权卡落为真源

- 新增唯一 owner `references/truth-capture.md`。触发条件：同一任务内至少两条已确认的产品或设计决策、已确认方案进入 `D2`/`D3`、即将发生上下文压缩、任一过期信号（用户在解释文档里没有的事、方案用了项目已弃用的东西、用户自己翻代码确认、新会话反复问已定过的事、没人记得某功能为何这样设计）、以及每批 `执行子阶段` / `验收` 通过后的 Post-Acceptance Drift Check。`D0` 与单点 `D1` 不触发。
- 流程固定为：只读扫描真源索引 → 逐条判定 `update_existing | create_new | merge_into | supersede | not_needed | deferred` → 按规模落点（一句回写既有 owner；owner 已存在则主文档加文末变更记录；功能内部有规则、状态机或被多处依赖则新建 `dev-docs/features/<feature>.md`；结果是「选 A 不选 B」的高成本决策则新建 `dev-docs/decisions/adr-<id>.md`，变更用新 ADR supersede 旧 ADR）→ 五行授权卡（已确认决策数 / 建议改 / 建议新建 / 依据 / 不落盘的后果）→ 用户确认后写盘并更新索引。默认姿态是提出并征求授权，禁止静默新建或改写真源；改既有真源永远先列出与现有内容的不一致。
- Post-Acceptance Drift Check：验收证据返回后，对照立项、功能清单、技术栈、架构与当前 stage 列出「做的事与文档的出入」；出入非空时出卡，由用户选「改文档」或「改代码」，未回答前下一批 `执行子阶段` 的 Task Decision 记 `truth_capture.decision: deferred`，不得当作无出入开工。此检查只读，不是 stage 写回。
- 合同：`task-decision-contract.md` 新增可选块 `truth_capture {decision, target, reason, authorization_status}`；`effect-recovery-gates.md` 新增 action `truth_doc_write`（`local_reversible`，授权证据只能是用户对授权卡的确认），改既有真源仍是 `local_edit` 加确认；`LOADED_OWNER_IDS` 加 `truth_capture`。`runtime_decision_contract.py` 强制：写决策必须带授权状态，未确认不得 `truth_doc_write` 或编辑目标 owner，`create_new` 不得伪装成 `local_edit`，`D0` 不运行闸门。
- 挂载：`SKILL.md` Startup Protocol 第 7 步与 Lifecycle And Truth；`routes-index.md` 在 `立项`、`拆分`、`技术选型`、`前端骨架`、`数据库设计`、`后端工程`、`开发执行`、`验收` 条件加载；`routes-validation.md` 与 `routes-feature.md` closeout 各加一句；`engineering-execution.md` Documentation Write-Back 改为「主文档加文末变更记录，新文档只经闸门产生」；`context-handoff` 前先跑闸门。
- 模板与门禁：新增 `assets/project-feature/feature-truth.md`、`assets/project-decision/adr.md` 与 `features/decisions/audits` 三份索引模板（frontmatter `status: active | superseded | archived`）；stage 与 feature 模板新增「风险与未决问题」必有小节；`check_project_guardrails.py` 新增模糊词扫描（warning 级，按文档类型分组，中英双语，`--vague-terms`）、索引与目录一致性检查（目录有活文档但索引缺失即失败）与 `archive/` 排除；`truth-capture.md` After Write 要求写盘后跑一次并把命中列给用户。

### 审计交付物：`代码审计` 独立路由、三轮分层审计与默认落盘报告

- 新增主路由 `代码审计`（`audit -> audit`），只审代码正确性、可维护性、owner 放置与需求 / 设计真源一致性，与 `安全审计`（攻击面）、`项目体检`（状态与下一步）、`AI债务体检`（生成物膨胀）并列；`SKILL.md` Selector Design 同步。基础加载 `references/audit-artifact.md` 与 `engineering-execution.md`，发现涉及信任边界时加载 `security.md`，需要框架 / SDK 当前行为时加载 `truth-resolution.md`。
- 新增唯一 owner `references/audit-artifact.md`，对所有 `delivery_kind: audit` 路由生效。Proportionality：单文件单问题 `D0`/`D1` 只在对话回答；范围为模块或更大、或用户要求审计 / review / 体检项目时默认写报告，对话只给摘要、结论与路径。Three-Pass Audit 全程只读：`triage` 列范围、清单与候选 finding；`deep` 逐条对照框架 / SDK 当前行为、需求与设计真源、实际调用链与已批准运行证据；`review` 由独立只读审阅者（子 agent 或 Studio reviewer，绝不是生产者）复核误报、严重度与方案，分歧写入报告而不由任一方静默裁定。Finding Schema 在通用字段之上新增 `根因`、`最佳方案与理由（含否决备选）`、`修复涉及代码点`、`修复后验证`；`security.md` 改为引用通用块并保留 8 lane 与安全专有字段。
- Persistence 与 Closeout：有内部真源根写 `dev-docs/audits/<YYYY-MM-DD>-<scope>.md`，否则复用 plan artifact 的任务临时 / 持久选路，owner ID `audit_artifact`；报告路径不得与 `plan_target` / `stage_target` 相同。关闭时给四选一 verdict 与按可利用性 / 业务影响排序的修复单元；未解决 finding 必须晋升到唯一活 owner（`dev-docs/ai-debt.md` 或受影响 stage / feature 的「风险与未决问题」），`promoted_to: none` 与未解决 finding 并存为不合法。报告不是修复授权，不写 stage、不写 plan、不改源码。
- 合同：`effect-recovery-gates.md` 与 `runtime_decision_contract.py` 新增 action `audit_artifact`（`local_reversible`，由模块级审计请求本身授权且只授权写报告）；`task-decision-contract.md` 新增 `materialize_audit`、`audit_target`、`audit_pass: triage | deep | review | reviewed_pending_promotion | closed`、`unresolved_findings`、`promoted_to`；`LOADED_OWNER_IDS` 加 `audit_artifact`。`routes-intake.md`、`routes-rescue.md`、`routes-constitution.md`、`security.md` 各加一句指向交付物 owner，不改各自 lane 与判据；`agent-constitution-template.md` 补审计记录文件形态与真源优先级链中的 `features/`、`decisions/`。
- 文档膨胀控制（大型项目）：`project-flow.md` 新增 Truth Ledger Boundary And Index Rules——`audits/`、`quality/`、`acceptance/` 是只追加账本、不用于建立当前真源；`features/`、`decisions/`、`audits/` 以索引为唯一入口，任何路由不得整目录读取；目录深度不超过二，超大项目按 `architecture.md` 模块分目录、每级一份索引；归档只移到同目录 `archive/`、不是删除；多部署单元允许 `dev-docs/<unit>/` 子根但不允许两份 brief 或技术栈文档。`project-intake.md` 新增 Post-Upgrade Reorganization Offer 与 Compaction Offer（活 feature 文档 40、活 ADR 30、open 审计 5、单文档 400 行、索引 150 行任一命中出压缩授权卡，用户批准前不移动任何文件，阈值可在项目真源块覆盖）。
- 测试与治理：`execution-backbone-cases.json` 新增两个 owner 的 required / forbidden terms 与七个静态用例（长讨论必出卡、既有真源不静默改、验收后出入必出卡且下一批不静默开工、模块级审计默认落盘、代码审计不可跳复核、关闭审计必晋升未解决 finding、Compaction Offer 必出卡且不自动移动文件）；`route-eval-cases.json` 新增 `代码审计` 四例；`selector-pressure-cases.json` 新增 `code_audit` 与 `truth_capture` 两个家族；`task-decision-cases.json` 新增 22 例（含 ADR 落点与晋升去向的正反例）及一组同构对；`task-decision-live-cases.json` 新增「长讨论后出卡不直接写」「选型结论建议 ADR」两例及一组同构对；`test_foundation_guardrail_contracts.py` 新增索引一致性、`archive/` 排除与模糊词 warning 的正反例；静态 mutation 语料新增七条 critical（`truth_capture_silent_write_allowed`、`post_acceptance_drift_check_removed`、`audit_artifact_default_removed`、`code_audit_route_folded_into_health_audit`、`audit_review_pass_removed`、`growing_dirs_bulk_read_allowed`、`audit_ledger_treated_as_truth`，65 → 72）。基础加载集因新增闸门增长，`D0` 预算 65,000 → 67,000 bytes，bounded `D1` 预算 72,000 → 74,000 bytes（当前 66,541 / 73,695）。以上同属 capability 变更，与前两节一并做 baseline promotion。
- 未验证：真实 fresh session 中的授权卡时机、审计三轮分工与报告落盘均未执行 live 验证；静态合同不得冒充 fresh-session PASS。

## v0.9.0 — 2026-08-23

### 项目体检与执行存活

- 普通只读 `项目体检` 改为确定性的渐进加载：route catalog、选中 route、lens catalog 和选中 lens 都按实际 UTF-8 bytes 计入，详细 `project-flow.md` 与测试背板只在阶段归位、阶段就绪/物化或发布回归判断确实需要时加载。当前静态候选为 54,962 bytes，原有阶段判断、Git/隐私、Owner、风险和下一路由能力不减少。
- 新增 Discovery Batch Contract：内容读取前先取路径和大小元数据，每批只闭合一个语义问题；不可变 owner 不重复读取，发生截断后禁止原批次重放，只查询缺失边界。对应预算、精确投影、默认 owner 回退、截断复读和 lens 漏算均有静态与 mutation 门。
- portable pending-operation 合同覆盖 running receipt、立即 refresh/cancel、一次非冲突只读批次、terminal/degraded/canceled/blocked 决策和 final/handoff 前零遗留 pending；用户明确要求停止并立即收尾时，停止新 discovery，在活跃 model loop 内先关闭 pending 再给 bounded final。
- Skill 只能预防仍在运行的 agent 编排错误，不能唤醒已经停止的 model loop，也不能修复 tool result 返回后 Host/service 丢失 continuation。`bounded_project_audit_governance_burden`、`discovery_batch_truncation_recovery`、`user_stop_to_bounded_final` 与 Host continuation 均保留为 `UNVERIFIED`，静态合同不得冒充 fresh-session PASS。
- continuity 插件 `0.2.0` 增加有界 Studio 房间登记、cursor/state 恢复与容量限制；仍不保存子任务 prompt、子任务 final text、任意原始工具输出或 transcript。插件升级是会话边界：旧任务可能仍绑定旧版本 cache 路径，必须重启宿主、在新任务重新检查/信任 Hook 后才能取得 live 证据；版本、安装、Hook 信任和 live 生命周期继续独立于根 Skill。

### 正常用户 UX 判断合同

- UX 分析、审计、解释、建议、设计、实现和验收统一经过 route-global `frontend-design` lens 与 `engineering-execution.md` 的唯一 UX Judgment Contract。`sliver-delivery-shape-lock/v3` 在实施前额外绑定用户认识的对象/动作/结果、系统概念投影、成熟模式偏离证据，以及 cancel/back、错误恢复、刷新恢复、深链和角色交接五类完整旅程边界；v1/v2 被直接拒绝，不保留旁路。
- UI live rubric 升级为 v5，并增加图书馆房间预约、照片冲印下单和截图证据边界三类 fresh-session 反例。reference/candidate 必须使用不同 capture 与不同内容，DOM/无障碍和交互轨迹必须是结构化证据，acceptance 的可验证 artifact refs 由外部 artifact 清单推导；外部 judge 的真实独立性仍明确保留为 `UNVERIFIED`。

### Studio 导演连续性

- Studio 执行新增强制 Director Continuity Loop：创建后持续登记、等待、收件、评审、同房返工与复验、成果回传验证和导演集成；已完成或需注意的房间结果必须先于无关本地、subagent 或 Cursor 工作处理，不能依赖用户提醒。
- Codex adapter 在每轮本地工作、用户消息和上下文压缩恢复后使用保存的 `threadId`、`hostId` 与 cursor 先刷新任务；返工后必须再次等待且 cursor 前进。subagent、Cursor 和共享 checkout 写入都不能冒充 Studio 房间。
- Studio live 合同升级为 cases v2、results/raw v4 和 rubric v3；`wait_threads` 按真实 `targets[].afterCursor` 与 `wake/polls/errors` 校验，多目标和无变化快照不再误判。评审结论绑定直接房间结果，writer 回传与集成绑定独立 review、artifact hash/base revision 和成功宿主门禁；候选自报“完整轨迹”被拒绝，非宿主活动的遗漏仍明确为未验证。
- Codex continuity Hook 改为按房间保存不可变注册与最新 cursor/state，事件尾不再淘汰活跃房间；逐工具、逐路径抽取真实宿主 envelope，限制房间数、事件数、标识长度和序列化字节，不保存子任务 prompt、子任务 final text、child artifact path 或任意原始输出。只有注册且未归档的房间才触发压缩恢复快照，Hook 本身不声称已经查询或证明当前任务状态。

### 按拓扑加载执行治理

- `开发执行` 的机械 `D0` 路径改为只加载紧凑执行、深度选择、测试选择和动作效果 owner；完整工程背板、Task Decision schema、严格 TDD/发布级测试背板改由深度、测试级别和影响证据条件加载。
- 已完成的 `sliver-engineering-workflow` 能力迁移不再作为运行时路由映射或校验承诺重复出货；历史迁移仅在本更新日志保留，当前 route-to-owner 关系继续只由 `references/routes-index.md` 注册表负责。
- plan artifact 的完整资格与例外只由 `references/plan-artifact.md` 定义；Skill 入口和路由注册表只保留 owner 指针与最小加载条件。

## v0.8.0 — 2026-08-13

### 用户任务优先的 UI 交付形态

- 现有项目和新界面的 UI 工作统一使用 `sliver-delivery-shape-lock/v2` 合同。实施前必须绑定主要用户、单一任务、成功信号、信息层级、每个新增或变化的元素、适用的源字段投影、交互状态，以及由宿主验证的稳定参考；没有同类参考时必须明确记录。v1 被直接拒绝，不保留旁路。
- 验收阶段绑定规范化的实施前锁定摘要和当前源码版本，要求参考与候选在相同视口、状态和主题下形成视觉证据对，并分别提供 DOM/无障碍、适用交互、变化区域、不变区域和独立审查证据。候选记录不能自行证明其稳定参考，一张截图也不能冒充所有证据。
- 治理成本保持与任务相称：D0/D1 的局部颜色、间距、裁切或状态修正继续走轻量路径；新增或实质变化的界面不能因为没有要求原型，就跳过用户任务和信息架构判断。
- 合成且不可识别的行为 fixture 覆盖复杂设置页、仪表盘优先级、成熟参考适配、稳定 owner 的视觉目标、领域术语不影响判断，以及局部修正反例。静态/live 合同、直接变异和协同变异语料均已扩充；本地由源码引导的新任务只属于辅助行为证据。安装后的自然发现和发布级隔离 fresh-session 证据在单独产出前仍为 `UNVERIFIED`。

### 证据完整性与隐私边界

- Foundation/UI live 证据必须记录精确的工具类型和目标，并使用由行为验证器执行真实、无第三方依赖测试的合成工作区；渲染截图必须关联成功的渲染事件。泛化摘要、缺失的非 Web 工具轨迹、不存在的 fixture 路径，以及纯色或低信息量占位图都会失败关闭。
- 四组 live 结果合同必须绑定同一份 `sliver-live-evidence-isolation/v1` 清单，覆盖精确源码/runtime、GitHub producer run、完整且确定的可读输入闭包及其 SHA-256、隔离运行状态、隐私扫描、清理状态和外部授权引用；即使子集内容正确也会被拒绝。结果 schema 升级为 Foundation v4、UI v3、Task Decision v2 和 Studio v2。
- 完整 live 发布验证绑定所选提交和 run ID 实际报告的 producer workflow 路径，不再硬编码一个本地不存在的 producer；证据下载到源码 checkout 之外，保证干净候选门仍然有效。在另行授权的 producer 建立并成功运行前，fresh-session 行为保持 `UNVERIFIED`，本地交互运行不能取得同等资格。
- 可发布 fixture 必须使用合成且不可识别的项目真源。私有项目名称、路径、轨迹、截图和记忆内容禁止进入可复用的 Skill 产物。

### 合同归属与执行门禁

- 主路由表成为 operation 到 delivery 投影的唯一可执行 owner；runtime 和验证器解析同一份 Markdown 注册表，不再维护第二套 Python 映射。
- 阶段物化必须存在真实的跨 owner 漂移、带顺序且无法直接闭合的迁移，或多 owner 联合的持久交接。单个不稳定 owner，以及缺少联合合同的交接，都会被拒绝。
- 现有项目的 UI 工作必须记录具体稳定基线，或明确记录不存在可比较界面；新消费者保持在稳定共享默认值的下游。只有会改变含义的产品文案需要单独确认权限，普通标签、帮助和恢复文案仍由实施判断负责。获准修改共享基线时，必须列出所有消费者、回归证据和回滚边界。
- 失败修复升级只有一个 owner：第二次定向修复失败后重新表述问题，第三次失败后重新审计架构、owner 和真源；同一假设链不得继续进行第四次局部补丁。
- 发布行为的回归范围根据实际变化的合同和受保护边界选择；受保护边界出现漏检会阻断发布，但不会给无关改动强加固定测试数量。

## v0.7.0 — 2026-08-01

### Proportional task decisions and independent control axes

- 将任务深度迁移为 `D0`-`D3`：深度只由新语义判断和 owner 拓扑决定；精确机械改动可保持 `D0`，单 owner 行为修复为 `D1`，稳定多 owner 结果为 `D2`，只有基础或程序拓扑变化进入 `D3`。
- 风险、测试和动作效果拆成独立 owner：受保护风险只激活命中边界的负向证据，生产/外部/Git/不可逆动作按真实 effect 决定授权与恢复，不再通过抬高任务深度追加整套治理。
- 新增 `sliver-task-decision/v1` 可执行合同、正反例和变形语料：深度必须由 `mechanical_execution` 与联合 owner 拓扑约束，受保护实现不得使用 `T0/T4`，路由、operation 和 delivery 必须相容，加载 owner 为闭集且仅按命中边界扩展。
- 动作授权不再只看自报 `satisfied`：记录并校验精确目标、已授权层级、当前用户请求/确认证据与恢复/停止状态；“讨论是否发布”与“执行发布”分为两个不同动作合同。
- 新增 Task Decision fresh-session 结果门：11 个样例必须来自不同的新任务，逐条绑定当前 runtime digest、源码 revision、真实任务标识、起止时间、原始用户输入和完全一致的原始 JSON。

### Stage v2 and exact sub-stage authorization

- 阶段真源升级为 `sliver-stage/v2`，只服务满足物化条件的 `D2`/`D3`；`D0`/`D1` 不能因为模板存在而被升级成阶段工程。
- `plan`、`execute`、`closeout` 继续使用同一真源，但执行授权新增 `authorization_substage` 并必须与当前 `active_substage` 精确绑定；切换子阶段不能复用旧授权。
- 旧 v1、缺失 schema 和旧中文等级统一返回 `MIGRATION_REQUIRED`；迁移器只生成显式 sibling draft，不覆盖原文件，也不继承授权、完成、验证、风险或 Studio 状态。
- 结构门永远不自证真实完成；即使 closeout 结构通过，运行、provider、设备、用户验收和授权证据仍由外部新鲜证据负责。Stage `execute` 显式拒绝用范围授权执行 `controlled` 动作。

### Studio and release evidence hardening

- Studio 推荐改为严格合取：宿主能力、稳定合同、可信环境隔离、唯一 writer、独立验收、导演集成门和正向协调收益缺一不可；共享写面必须返回 `resolve_boundaries_first`。
- 明确最终联调不等于新的程序依赖拓扑，稳定前后端或游戏交付图可以保持 `D2`；行业名词不参与资格判断。
- Studio live evidence 以 `case_id`、确认事件、真实任务/工具事件、作用与授权、直接原始结果、runtime digest 和源码 revision 为准；writer 的精确相对路径在整个房间集合中做父子/相同路径交集检查。
- 所有 live 结果新增 7 天新鲜度上限；结果文件验证只能表达其记录和可复核的行为，不被包装成密码学或外部信任证明。
- 完整 live 验证现在同时要求 Task Decision、Foundation、UI 和 Studio 四组结果指向同一份干净候选；普通 CI 继续只证明源码合同和三个 runtime bundle，不把静态绿灯包装成模型行为通过。

### User correction evidence gate

- 修正“用户否定概念就直接删除”的绝对化规则：先把纠正分类为产品决定、现场事实、技术方案或偏好反馈；用户拥有产品结果，事实由证据裁决，技术方案继续由 AI 基于当前真源、owner 和合同负责判断。
- 新增迎合性反转防线：连续矛盾建议、重复施压、批评或情绪只能触发重新审计，不能在没有新证据时改变字段名、表设计、架构结论或项目真源；结论必须明确标为正确、错误、部分正确或未验证。
- 增加字段命名反复、硬件事实跳过核验和情绪施压三类静态压力用例，并让项目宪法模板、空项目入口和接管入口继承同一边界。

### Claude Code platform adapter

- 每个发布 bundle 新增固定启动插槽 `references/runtime-adapter.md`，并由 `SKILL.md` 在 Startup Protocol 第 2 步直接加载。portable core 提供无启动期宿主适配的默认实现；平台 adapter 只能替换同一路径，不能改变路由、任务深度、工程门禁或验证合同。
- `claude-code` target 只覆盖该固定插槽，并新增 `assets/project-claude/CLAUDE.md` 薄入口，内容严格为 `@AGENTS.md`。共享 bootstrap/adoption `AGENTS.md` 保持唯一宪法 owner，所有 target 使用同一份模板；不再出货第二套 `.claude/rules` 治理文件。
- source 与 runtime validator 共享一份 adapter 拓扑门禁：拒绝覆盖共享宪法、错误 overlay 目标、Claude 入口泄漏到其他 target 和缺失固定引用；具体 source-to-destination 映射仍只由 manifest 拥有。配套正向 bundle 矩阵与负向 mutation 测试。
- Claude runtime adapter 记录宿主入口、安装位置和 auto memory 边界。auto memory 只作本机便利，不是项目真源或发布证据；冲突时忽略并报告旧记忆，未经用户明确授权不修改、删除、迁移或关闭它。
- 当前证据只覆盖源码与 package/static 合同。新的 Claude bundle 仍需在目标 Claude Code 版本做 fresh-session 发现、固定 adapter 加载和薄入口物化验收。

## v0.6.0 — 2026-07-24

### User-visible Studio task orchestration

- 新增 `工作室模式`：只在任务图、唯一写 owner、稳定共享合同、环境隔离、验收链和并行收益全部成立时建议；单模块、重叠 writer、未定合同、脏共享 checkout 或没有集成门禁时拒绝创建任务。
- 主任务负责推荐、用户确认、懒创建、等待、返工、独立只读验收与最终集成；工作任务只能报告 `READY_FOR_REVIEW`、`BLOCKED` 或 `NEEDS_DECISION`，工作室模式与子 Agent、Hook、项目真源保持独立。
- Codex runtime 新增专属任务工具 adapter，映射 `list_projects`、`create_thread`、`wait_threads`、`send_message_to_thread`、环境选择、cursor 和任务卡；portable runtime 不携带 Codex 产品合同。
- Studio 验证改为 9 个任务图拓扑族与领域名词同构变形，不按游戏、前端、数据等行业逐项枚举；配套哈希 raw artifact/独立 judge 结果 schema、21 个反向合同测试，并把 Studio live package 接入可选的全量 live 资格认证。没有可信 live package 时只把该行为层标记为 `UNVERIFIED`，不阻断已经通过源码与 runtime 门禁的 Skill 发包。
- 收紧写入安全：本地 checkout 只允许只读工作房间，所有 writer 强制独立 worktree；非默认分支或未提交真源必须经过明示起点确认，写房间创建前必须固定 reviewed patch、artifact manifest 或另行授权提交的成果回收合同。
- Studio live evidence 改为保留并校验结构化 `create_thread` 请求/响应、真实环境、有效起点 revision、写入模式和成果回收合同，拒绝“自由文本声称用了 worktree”的假绿。

### Codex session continuity plugin

- 会话连续性插件明确 24 小时为下一次 Hook 触发的惰性清理阈值，新增只删除 `PLUGIN_DATA/continuity` 的受限清除入口，并将其确定性安全测试纳入仓库正式发布门。
- Codex 会话连续性插件 `0.1.0` 增加本地 Marketplace 安装入口；2026-07-24 在 macOS arm64、Codex Desktop bundled CLI `0.146.0-alpha.3.1` 上完成安装、Hook 哈希信任、脱敏/权限/正常结束清理，以及手动与自动压缩的 `PreCompact → PostCompact → SessionStart(source=compact)` 生命周期实测。该证据证明恢复上下文已返回，不承诺模型一定恢复唯一语义目标。

### Release evidence hardening

- 发布证据按 Skill 的真实风险分层：源码合同与三个 runtime bundle 是每次发包硬门槛；目标宿主 fresh-session 按本次变化选择少量代表性 smoke；Foundation、UI、Studio 三套完整 live corpus 只用于明确声明“全量 live 资格通过”，不再把全部语料逐条转换成用户可见任务。
- Foundation 多轮案例固定每一条后续用户回答且禁止复用 session；所有要求当前官网证据的 fixture 必须提供具体产品事实、完整首条流程、部署边界、具名候选和待核验可变声明，避免用“资料完整”等抽象标签逼模型猜测。
- UI live evidence 对原型图、透明资产及桌面/主题/移动截图统一验证可解码 PNG、像素数据、格式与最低尺寸，文本文件或 1×1 占位图不能冒充视觉证据。
- Studio live evidence 将 writer 起点绑定顶层候选 revision，要求 wait 覆盖所有已创建任务，并强制返工回原 producer、复验回原 reviewer。

## v0.5.0 — 2026-07-20

### Project-aware UI design and semantic design-to-code

- 新增 UI 原型生命周期：设计前读取当前项目布局、token、组件、图标、主题、断点、相邻页面和活跃设计真源；空项目只建立首个闭环所需的最小视觉基础。
- 原型进入项目内部真源并按版本保存，批准证据绑定具体版本；设计与实现连续执行也必须完成可审计的批准转换，草稿、拒绝或已替代版本不得直接实现。
- 设计转代码先形成组件复用和资产边界决策，禁止整图铺页面、截图切片、透明热区、烘焙文字与控件；图标、插画、照片和 CSS/token 按真实语义边界落地，并跟随项目主题、响应式和可访问性约束。
- 原型交付物改为按实际 surface、state、viewport、theme 和文件记录的 manifest，不再把某个宽度或 desktop/mobile 图片组合写成所有项目的默认交付形态。

### Beginner routing, installer safety, and release evidence

- 收紧 VC 新人提问边界：AI 先读取可发现事实，只询问无法从项目获得且会改变产品结果的少量阻断信息；技术真源、design token、官方资料检索和验证方式继续由 AI 判断。
- 修正轻量纯视觉调整与发布问法的上下文路由，路由合同开始校验风险证据必须位于对应风险 Owner，而不是只搜索风险标签是否存在。
- runtime builder 的 `--force` 只允许安全替换空的标准 leaf 或已验证的 Sliver bundle；拒绝 symlink、宽目录、错误 leaf 和非 Sliver 内容，并使用同父目录 staging、原子替换和失败恢复。
- 发布证据绑定明确候选版本、源码 revision 和 runtime digest；源码合同、runtime bundle、自然语言交互、foundation 与 UI fresh-session 证据继续分层，缺少真实宿主结果时必须保持 `UNVERIFIED`。

## v0.4.0 — 2026-07-16

### AI-owned joint stack and architecture decisions

- 将公开行为版本提升到 `0.4.0`：技术选型不再只选框架或语言，而是从产品真源、质量属性场景和架构驱动出发，联网核对当前一手资料后，由 AI 给出唯一的“技术栈＋框架原生结构＋架构＋数据＋运行时＋部署”组合。
- 新增 Decision Readiness、Architecture Drivers、External Evidence、Framework-Architecture Fit 和 Architecture PoC 门禁；阻断产品事实、真源冲突、当前官方证据或关键 PoC 未闭合时，不得输出最终或暂定技术路线。
- 技术栈与架构基础决策改为一次只问一个阻断产品事实；用户不再选择框架、数据库、迁移策略或 DDD/Clean/CQRS 等技术名词，只确认产品结果、成本、停机、迁移、锁定和不可逆影响。
- 新增 `references/architecture-patterns.md`，把部署拓扑、内部组织、领域建模、读写、通信、BFF 和插件化拆成独立决策轴，每个模式都要求当前驱动、适用范围、框架 fit、额外成本和重评条件，防止同时叠满架构名词或只为纯设想上微服务。
- 新增 bootstrap/adoption `technical-selection.md` 决策证据真源；`architecture.md` 只消费已定组合并记录当前拓扑、进程、owner、数据/事务/安全边界和真实运行链路，不再硬编码通用分层调用链或复制候选理由。
- 强化项目 guardrail、foundation evaluator、压力语料和反向变异测试，拒绝阻断未知却标 final、无当前官方证据、让用户选技术、多个平级主组合、框架架构冲突、纯设想基础设施和机械填 `x` 的假绿；静态合同仍不冒充真实模型行为。
- 二次对 foundation 验证做攻击性收口：live evaluator 升级为版本化 fixture，raw runner artifact、结构化会话/工具/网络证据、SHA-256 交叉引用和独立 judge 的 v2 合同；guardrail 拆分 `contract` / `recommendation` / `implementation` 三个显式结构门，不再用一个 `OK` 混淆推荐完成与实施授权。
- 修复 technical-selection 模板与方法真源漂移：允许硬约束下只有一个可信组合，补齐 Organization Axis、完整 External Evidence 和 Framework-Architecture Fit 字段，并统一宏观 architecture 投影、局部详情 owner、项目宪法的 AI 技术判断边界与 conditional lens 注册表 owner。

### Product-horizon-aware technical selection

- 把 MVP 明确为当前交付边界而非架构上限；立项/接管真源区分当前必须、已确认下一阶段、不能堵死、明确不做与纯设想，没有已确认后续时允许明确写“无”。
- `references/tech-stack.md` 新增 Product Horizon Gate：只消费产品真源，记录最小可逆边界、迁移悬崖和重评触发条件，不复制第二份产品路线。
- 确认后续能力可以约束当前选型，但不因此提前实现；未确认未来只能作为重评输入，禁止据此新增微服务、进程、依赖、抽象或基础设施。
- 新增 bootstrap/adoption 演进边界护栏、选型压力用例与反向变异测试；接管审计仅为临时 fallback，选定长期产品真源后必须迁移并只保留链接。

### Stage truth readiness gates

- 将公开行为版本提升到 `0.3.0`，为需要持久阶段真源的标准/高风险大功能增加 `plan`、`execute`、`closeout` 三道递进门禁；轻量和常规单 owner 工作继续使用内联验收。
- `references/project-flow.md` 成为阶段真源 schema 与生命周期唯一 owner；同一份真源记录调研决策、产品确认、当前唯一子阶段、实际结果、偏差、验证证据和回写状态，不再为计划、实施、收尾复制三份文档。
- 强化 `check_project_guardrails.py --mode stage`：要求显式 `--stage-gate`，拒绝正文空壳、待确认时执行、阻断调研未解决、伪子阶段表、终态重新执行、高风险缺少授权/回滚，以及缺少真实实施回写却声称收尾。
- 子阶段授权与精确名称绑定，不能复用旧授权自动继续；完成声明改由 `evidence_status: verified` 结构化状态决定，不对自然语言做关键词推断。
- 新增共享 `assets/project-stage/stage-truth.md` 模板和阶段状态契约测试；允许 `partial` / `blocked` 诚实收尾，但只有完成且回写闭环时才允许完成声明。
- 明确结构门禁只证明文档声明完整，不能替代真实用户授权、新鲜运行证据或 live 行为验证。

## 2026-07-15

### 运行内核、单一路由真源与干净安装包

- 将 `SKILL.md` 收回为发现、启动、风险缩放、硬门禁和用户沟通内核；完整 route/reference 映射迁移到 `references/routes-index.md` 唯一 owner，validator 禁止在 SKILL 或 README 复制第二张表。
- 统一任务深度为 `轻量任务`、`常规任务`、`标准任务`、`高风险任务`；`超出当前阶段` 保留为 scope 结果，`T0`-`T4` 继续作为独立测试轴。
- 合并有明确重叠证据的内部路由：阶段/质量收口为 `验收` operations，后端边界/架构/骨架/验收收口为 `后端工程` operations，宪法生成/体检收口为 `项目宪法` operations；阶段计划和防漂移下沉为开发执行内部操作或门禁。
- 保留完整内部风险、owner、测试和验证判断，但默认用户输出只展示结果、关键证据、`未验证` 项和必要决策；高风险、不可逆、授权、真源冲突和主动强化治理时才展开治理原因。
- 新增 runtime manifest、Codex adapter、bundle builder 和 runtime validator；源码测试、CI、README、CHANGELOG、海报和微信群二维码不再进入模型运行包，Codex metadata 只注入 Codex bundle。
- README 继续保留三群二维码，并新增 `https://openbeetles.com/` 作为长期社区入口；核心用户保持为所有依赖 AI 推进真实项目的人，非技术用户由 AI 承担技术判断，技术用户获得紧凑可控的工程证据。

### Lightweight startup protocol and semantic route migration

- 将公开行为版本提升到 `0.2.0`，标记内部路由键和启动合同的破坏性迁移。
- 将现有 `sliver-vibe-coding` 明确为单一顶层软件项目 owner：宿主完成 skill 发现后，先执行轻量启动协议，再选择一个主路由和必要的专业检查；不新增第二个启动 skill。
- 将活跃合同中的 slash 风格工作流标签迁移为普通语义路由，`references/commands.md` 重命名为 `references/routes-index.md`；内部路由不再伪装成用户命令或跨平台调用接口。
- 启动协议固定最小当前真相、任务分级、单一主路由、按需 reference 加载、授权边界和新鲜验证，同时明确完整生命周期是能力范围而不是每次调用的默认成本。
- 同步迁移路由解析器、测试语料和执行骨架，并增加启动协议缺失、关键步骤退化和 slash 路由复发的变异测试。
- 更新 README、兼容说明和 Codex UI 元数据，分开记录文档声明、静态验证和目标平台新会话运行证据；Trae 在官方加载机制和 live bundle 验收前保持 `未验证`。

## 2026-07-14

### Mandatory test decisions and test-quality governance

- 新增 `references/testing-strategy.md` 作为测试决策唯一 owner：任何实现改动先强制分类 `T0`-`T4`，新测试代码按分类决定，命中 `T2` 后严格执行 RED -> GREEN -> 回归。
- 引入受影响测试映射：先审 owner、调用链、现有测试、fixture 和运行门，再决定最小有价值的测试层，避免只给 AI 通用 TDD 流程口号。
- 补齐测试质量边界：要求真实行为断言、mock 边界纪律、回归追踪、覆盖率表演防护和受影响测试定位，不引入全量强制 TDD、固定覆盖率或重型质量产物。
- 将测试决策门接入 `/开发执行`、`/报错救援`、`/阶段验收`和 `/质量验收`，并持久化到 bootstrap、adoption 和 Agent 宪法模板。
- 强化离线防退化：分级场景必须携带与 `T0`-`T4` 一致的等级断言，项目宪法按独立“测试与验证”章节检查正向规则并拒绝“可按需跳过”类反向规则；这些仍是静态合同，不冒充真实模型行为测试。
- 重构 README 为稳定入口：收紧定位和核心能力，补齐技术/非技术用户、局部任务与完整生命周期边界，并将安装、仓库结构和验证说明与当前真源对齐；版本变化继续只记录在 CHANGELOG。

## 2026-07-12

### Correct selector eligibility and lifecycle scope

- 修正 selector 适用资格：技术用户和非技术用户只要使用 AI 推进软件项目，都可以由本 skill 做顶层路由。
- 明确“完整生命周期”是能力覆盖范围，不是用户必须提出的触发条件；局部 UI、单文件 bug、测试和配置等任务也先进入本 skill，再按现有风险分级窄执行。
- 保留对非技术用户的白话解释、技术判断与验收支持，但不再把用户身份当成 selector 门槛。
- 更新静态 selector 合同：语料同时覆盖不同技术水平和局部任务，并禁止用固定 description 词组伪装语义验证；是否真正提升模型命中率仍需要独立的 live selector 验收。

## 2026-07-10

### Unified development execution and security governance

#### 中文

- 将新增、修改、修复、重构、接入、配置和继续开发统一收口到 `/开发执行`；任务深度与前端、数据、后端、身份权限、收费权益、第三方、安全、发布等专业判断改为内部条件检查，不再让业务词或低级关键词抢占主流程。
- 明确治理成本按真实风险缩放：普通单 owner 改动与文案、静态资源等轻量任务只做范围内真源、owner 和验证检查；首次接管、启动未知、owner 不清、真源冲突或标准/高风险工作才进入更深治理。
- 新增 `Intent Confirmation Gate`：用户表达存在多种产品结果时，AI 先根据当前代码、文档和运行证据给出 2-3 个白话选项和主推荐；技术路线由 AI 负责，用户只确认可见结果、成本、停机、迁移或不可逆影响。
- 将工程执行骨架完整并入 `references/engineering-execution.md`，统一约束根因定位、owner/contract、测试或复现门禁、反补丁纪律、三次失败重审架构、新鲜验证、文档回写和 Git 边界，不再依赖已退役的第二套 workflow skill。
- 建立三层安全闭环：显式 `/安全审计` 默认只读；日常代码、配置、数据、第三方和发布改动自动执行相关的 `Security Impact Gate`；bootstrap、adoption 与 Agent 宪法模板持久化安全红线。
- 重构离线合同评测：68 条路由合同覆盖 28 个生命周期入口和 8 个条件检查，selector 语料覆盖 25 个场景族、125 条正例和 15 条负例，执行骨架覆盖 16 个压力场景；这些脚本明确不冒充真实模型命中率。
- 新增共享验证解析层和负向变异测试：HTML 注释、代码围栏、重复路由/章节、空壳或重复语料、错误 JSON、仓库外 owner 路径不能再冒充有效真源；仓库验证流程同时覆盖 bootstrap、adoption 和 constitution guardrail 模式。

#### English

- Unified add/change/fix/refactor/integration/configuration/continuation work under `/开发执行`; task depth and specialist concerns now remain internal, evidence-driven conditional checks instead of competing keyword routes.
- Scaled governance cost to real risk: ordinary one-owner and lightweight asset/docs work stays scoped, while takeover, unknown runtime, unclear owners, conflicting truth, and standard/high-risk work receive deeper governance.
- Added an Intent Confirmation Gate that gives non-technical users plain-language outcome choices while keeping technical-route ownership with the AI.
- Integrated the complete engineering execution backbone into `references/engineering-execution.md`, including owner/contract discipline, evidence-led debugging, regression gates, anti-patchwork rules, fresh verification, truth write-back, and Git boundaries.
- Added a three-layer security model: read-only-by-default explicit audits, automatic change-scoped security impact decisions, and persistent constitution/template redlines.
- Reworked offline contracts across 68 route cases, 25 selector families with 125 positive and 15 negative prompts, and 16 execution pressure cases while preserving the boundary that live model routing is not evaluated.
- Added shared validation parsers and negative mutation tests so comments, fenced inactive structures, duplicates, empty corpora, malformed JSON, and repository-escaping owner paths cannot satisfy validation.

## 2026-07-03

### b60da80 - Improve skill selector hit-rate coverage

#### 中文

- 新增 selector 压力评测：覆盖 22 个非技术用户意图族、110 条正向说法和 15 条负向说法，避免命中率改进变成临时补关键词。
- 重写 skill 选择器描述：从“收费/会员/API 等业务词”转向“我要加一个功能、继续做、不知道下一步、能不能上线、会不会泄露”等小白真实意图。
- 明确 `SKILL.md` 的 selector 设计规则：frontmatter `description` 是 discovery surface，自动触发例子不是精确关键词白名单，宽覆盖用测试池维护，不能把所有压力用例塞进正文。
- 强化自然语言路由回归：新增泛功能开工、接管、继续做、验收、上线、隐私泄露、接口真源漂移、设计文档和 agent 宪法等真实口语用例。
- 更新 README：把常用入口和验证命令改成面向非技术用户的说法，并加入 `evaluate_selector_pressure.py`。

#### English

- Added selector pressure evaluation with 22 beginner intent families, 110 positive prompts, and 15 negative prompts so hit-rate improvements are tested as a maintained surface instead of ad hoc keyword additions.
- Reworked selector wording around beginner intent families instead of business-specific keywords.
- Documented selector design rules in `SKILL.md`: the frontmatter `description` is the discovery surface, routing examples are not an exact keyword whitelist, and broad hit-rate coverage belongs in pressure tests.
- Added route regressions for generic feature starts, takeover, continuation, acceptance, release readiness, privacy leakage, API truth drift, and agent constitution wording.
- Updated README usage examples and verification commands for non-technical users.

## 2026-06-29

### e69fe6b - Strengthen project guardrails and route validation

#### 中文

- 集成空项目和半路接管模板，让公开 `sliver-vibe-coding` skill 可以直接物化项目真源，不再依赖第二套 workflow skill。
- 新增 `scripts/check_project_guardrails.py`，用于检查用户项目治理文档结构和明显漂移，但不替代真实启动、测试、UI/API/数据库、安全或部署验收。
- 新增 `/上下文交接` 和 `references/context-handoff.md`，用于新窗口或换 agent 时复制交接。
- 强化 Git 安全：远程地址配置不等于推送审批，回滚/reset/restore 要先做损失审计，混合 commit 禁止直接整提交误撤。
- 强化任务分级、功能执行、报错救援、质量验收、技术选型和跨语言门禁，避免小任务过度治理、大任务跳过真源。

#### English

- Integrated bootstrap/adoption project templates into the public skill.
- Added `scripts/check_project_guardrails.py` for structural checks of user-project governance artifacts.
- Added `/上下文交接` and `references/context-handoff.md` for copy-paste-ready handoffs.
- Strengthened Git safety rules around remote configuration, push approval, rollback, reset, restore, and mixed-commit reverts.
- Strengthened task classification, feature execution, rescue, validation, technical selection, and cross-language architecture gates.

## 2026-06-23

### afc16cd - Tighten technical stack selection gates

#### 中文

- 强化技术选型门禁：平台能力、前端设计系统、单运行时优先、跨语言架构真源。
- 要求在桌面/本机自动化、浏览器插件、后台任务或混合能力不清楚时，先补阻断问题，不直接给最终技术栈。

#### English

- Tightened technical stack gates for platform capability, frontend design-system fit, single-runtime preference, and cross-language architecture truth.
- Required blocking questions before final stack selection when hybrid or local-system capabilities are unclear.

## 2026-06-22

### ddffdd5 - Clarify governance fit and expand route evaluations

#### 中文

- 明确本 skill 是项目治理层，不是深度工程执行 skill。
- 新增轻量 skill-fit assessment，普通 bug、局部 UI、单文件改动、测试/构建修复先轻量评估，不强制套完整治理。
- 新增 `普通工程任务` 风险等级，让普通工程任务可以窄查、窄改、窄验。
- 路由评测从 9 个 smoke cases 扩到 18 个行为回归用例。

#### English

- Clarified that this is a project-governance skill, not a deep engineering execution skill.
- Added lightweight skill-fit assessment for ordinary engineering tasks.
- Added `普通工程任务` to task risk gates.
- Expanded route evaluation coverage from 9 smoke cases to 18 behavior-regression cases.

## 2026-06-20

### ffd78d1 - Improve skill routing governance and validation

#### 中文

- 拆分路由执行说明，不再依赖单个大 `references/commands.md`。
- 增加 focused route references、任务风险门禁、本地结构验证和路由回归脚本。
- 增加 HTTPS 安装路径、兼容说明和版本治理说明。

#### English

- Split route procedures out of the former monolithic `references/commands.md` into focused route references.
- Added task risk gates, local validation, and route regression scripts.
- Added HTTPS install path, compatibility notes, and version governance.

## 2026-06-19

### 299d76e - Add license and README poster

#### 中文

- 新增许可证。
- 新增 README 海报资产和展示。

#### English

- Added the license.
- Added README poster assets and display.

### 37caaac - Add repository README

#### 中文

- 新增仓库 README。
- 说明 skill 定位、使用方式、安装方式和目录结构。

#### English

- Added the repository README.
- Documented the skill positioning, usage, installation, and directory structure.

### 1c568bd - Initial sliver vibe coding skill

#### 中文

- 初始化 `sliver-vibe-coding` skill。
- 建立面向非技术用户的项目治理、接管、救援、真源、验收、发布和宪法工作流基础。

#### English

- Initialized the `sliver-vibe-coding` skill.
- Established the baseline project-governance workflow for non-technical users, including intake, adoption, rescue, truth documents, validation, release, and agent constitution support.
