# 证据：反膨胀最小充分方案 v2（生成层计划边界 + 粒度 fail-closed）

- 日期：2026-09-18
- 触发：owner 主诉「只给需求文档 + 原子实施方案时项目过度膨胀」，要求双子代理交叉审计后一次收敛、不做 A→B→C 式无穷治理
- 关联真源：`provenance/LOCAL-PATCHES.json`（补丁登记 `anti-bloat-plan-boundary-minimal` + 两条既有条目 patchedSha256 更新）
- 门禁结果：`verify.ps1` 全绿（见 §5）

## 1. 诊断（为什么膨胀，双审计裁决）

两个独立子代理（红队=彻底性审计、YAGNI 守门人=收敛性审计）对初版「三层门禁」方案交叉复核，一致结论：

- 膨胀根因在**生成层**而非执行层：Spec 模板无「非目标」节（全集信号，dev-planner 成功标准还要求"覆盖全部功能"）、开发计划 Phase 无停止条件、粒度校准法阈值只是建议（无 fail-closed）、分析策略提供"细粒度 10-15 Phase"与总量控制矛盾。
- 初版方案自身的三个致命伤（被否决的部分）：①提交期路径允许集与 TDD 模板「关键文件不列测试文件」直接矛盾，每个 TDD commit 都会误拦；②Phase 预算由 AI 自估自批，门禁只是膨胀计划的忠实执行器；③质量档位字段对既有 [质量门槛] 全量清单开后门。
- 既有资产对账：`check-target-guardrails.mjs` 只存在于 sources/ 冻结快照（运行时面无副本可改）；phase-completion 四步走已有 scope creep 检查（只缺固定输出格式）；粒度校准法已有数值阈值（只缺机械执行）。因此本批**零新建脚本、零新增门禁层**。

## 2. 修法（6 文件，全部扩展现有文件）

| # | 文件 | 改动 |
|---|---|---|
| 1 | `skills/product/product-spec-builder/templates/product-spec-template.md` | 新增「非目标（本期明确不做）」真源节（模板结构 + 完整示例两行 + 写作要点一条）；无非目标时必须显式写「本期无非目标」，不允许删节 |
| 2 | `skills/product/product-spec-builder/SKILL.md` | 核心流程摘要的需求文档必备节清单加入「非目标」 |
| 3 | `skills/product/dev-planner/templates/dev-plan-template.md` | Phase 新增「不做边界/停止条件」字段（两个结构块 + 两个示例 + 写作要点一条） |
| 4 | `skills/product/dev-planner/references/workflow-generation.md` | 加载阶段提取非目标列表；Phase 列表字段加入不做边界/停止条件；自检修正"覆盖全部功能"矛盾表述（被非目标显式排除项不得建 Phase、不得混入其他 Phase）；新增 fail-closed 粒度计数自检；收尾引导语同步 |
| 5 | `skills/product/dev-planner/references/analysis-strategy.md` | 确认策略细粒度选项 10-15 → 8-10，并写明 Phase 总数上限 10（消除双真源冲突） |
| 6 | `skills/product/dev-planner/SKILL.md` | 粒度适中原则追加：Error/Loading/Empty 状态补全默认按洋葱剥皮法排辅助/收尾 Phase，核心链路 Phase 只验收 happy path |
| 7 | `skills/product/dev-builder/references/phase-completion.md` | scope creep 检查改为对照交付清单与「不做边界/停止条件」逐条核对；`## Spec Compliance` 增加固定行「超出计划的内容：无 / <清单>」 |
| 8 | `skills/product/dev-builder/references/development-rules.md` | [质量门槛] 增加「验收范围以当前 Phase 交付清单为准；按计划延后的状态补全不在本轮门槛内」 |

其中 #2 与 #6 两个 SKILL.md 已在既有补丁条目中登记（`entry-gate-description-retarget`、`retired-capability-reference-text-fix`），本次只更新其 patchedSha256 与 linesChanged，并在 change 字段追加 2026-09-18 注记。

## 3. 明确不做（审计裁决否决项，按证据准入防 A→B→C）

- **Phase 预算字段**：与粒度校准法数值阈值形成双真源，必然漂移；
- **提交期预算/路径允许集阻断**：与 TDD 模板矛盾、四副本 hook 同步成本、误拦会导致 hook 被整体禁用；剩余口子（Phase 内单次越界）由既有 300 行棘轮 + GREEN 最小实现 + Phase 收口收敛检查三面兜住；
- **质量档位体系**：降级为第 8 项的一条验收范围条款（改规则本身，不加平行体系）。

## 4. 终局条款（本次一并立约，防止本方案成为下一环）

- **加规则准入**：新反膨胀规则必须出示「现有规则拦不住的具体逃逸路径 + 最近 3 个 Phase 实测数据」，且零净增（加一条删一条）；
- **减法机制**：复用 rule-harvester 与 Three-Fix Gate 语义——新字段连续 3 个项目未影响任何计划决策即退役；同一门禁连续 2 次误拦降级为提醒，不在其上叠层；
- **换思路信号**：非目标/不做边界频繁被放宽批准 → 问题在 Spec 模板与拆分粒度（输入侧），应改输入而非加执行期拦截。

## 5. 验证

- 16 个 sha256（8 文件 × patched/original）逐条与实算比对一致（脚本直读文件回填后显式复核）；
- `verify.ps1` 全门禁新鲜执行，结果见会话交付报告（catalog 再生后语义比对、runtime include 完整性、1c 副本自洽、能力索引新鲜度等）。
