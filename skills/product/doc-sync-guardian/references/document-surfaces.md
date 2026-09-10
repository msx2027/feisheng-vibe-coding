# 文档面映射

> 读取时机：同步或审计已确认需要更新持久化文档，需要把行为变化映射到具体文档面时。

## 必须检查

- 全局地图：`DOC-MAP.md`
- 仓库级术语源：`TERMINOLOGY-AND-NAMING.md`
- 需求源头：本分发包的 `Product-Spec.md` / `Product-Spec-CHANGELOG.md`；目标项目 `.vibe-docs.json` 映射的 `需求文档.md` / `需求变更.md`
- 计划源头：本分发包的 `DEV-PLAN.md` / `plans/CURRENT-EXECUTION.md`；目标项目映射的 `docs/项目治理/开发计划.md` / `docs/plans/执行光标.md` / 必要 Phase 明细
- 人工验收：目标项目映射的 `验收记录.md`
- 接口契约：目标项目映射的 `接口契约.md`
- 任务胶囊：启用后检查 `任务状态.json`、`需求摘录.md`、`实现计划.md`、`研究记录.md`、`实现上下文.jsonl`、`验收上下文.jsonl`
- 审查状态：当前 Task / Phase 的 review profile、finding ledger、各 stage Review Receipt、用户 accepted-risk 证据和 Phase ledger；不得只保存在子 Agent 对话或 clean snapshot
- 会话记录：启用后的 `会话记录.md`，只作恢复摘要
- runtime registry：目标项目 `.vibe-runtime.json` 与 `AGENTS.md` / `CLAUDE.md` managed block
- UI / token / 组件复用：设计令牌、组件盘点、复审报告、UI 治理报告和 UI 包 README
- 术语执行清单：目标项目开发计划的 `### 本轮术语变更清单`
- 工作流与用户入口：`AGENTS.md`、`.claude/CLAUDE.md`、`README.md`
- 模块索引：`skills/INDEX.md`、`agents/INDEX.md`、`hooks/INDEX.md`、`codex-hooks/INDEX.md`、`tools/INDEX.md`
- 行为与门禁：相关 `SKILL.md`、Hook、脚本说明和 pre-commit 顺序

## 推荐或按需检查

- 目录结构、安装 / 启动 / 提交命令、新增状态文件与验证脚本说明。
- 本分发包或 legacy 设计输入 `Design-Brief.md`；新目标项目映射的 `docs/设计简报.md`。
- 过长设计或架构细节放入 `docs/`、`plans/` 或专题文档，不继续膨胀热路径入口。

## 行为到文档的映射

- 恢复顺序 / 全局入口 → `DOC-MAP.md`
- 仓库默认术语、口径或命名 → `TERMINOLOGY-AND-NAMING.md`
- 需求 / 主名 / 禁用别名 → 需求文档
- 实施步骤、Phase、统一阶段叫法 → 开发计划与必要 Phase 明细
- 当前状态 / 中断恢复 → `docs/plans/执行光标.md` 与任务胶囊
- runtime managed block → `.vibe-runtime.json` 与 runtime 初始化说明
- 人工验收或已验收影响 → `验收记录.md`
- endpoint、service、public entry、server action、fetch wrapper、IPC / event 或 schema → `接口契约.md`
- UI 包、组件、variant、token、theme、迁移删除或 `check-ui-reuse` → UI 治理文档、包 README 与复审证据
- review profile、finding 状态、复审 round 或用户风险裁决 → 当前 `审查台账.md` 或 Task / Phase 的 `Finding Ledger`；Phase 收口同步 Phase ledger 与两个 Review Receipt
- Skill / Agent / Hook / Tool / 主控规则 → 上游真源、对应 `SKILL.md` / Agent、模块索引、README、manifest 与镜像
