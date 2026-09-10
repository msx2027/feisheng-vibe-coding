# Task 20260910-classification-data-driven-and-index

状态：accepted（主 Agent 本地复验）

## 唯一目标

把技能分类从生成器脚本的硬编码数组搬到声明式真源，并让「提升一个技能」成为低风险数据编辑；同时产出
人类可读能力索引与单入口验证器。

## 不做事项

- 不改变任何既有技能的分类结果（等价性必须成立）。
- 不手工编辑 `CANONICAL-CATALOG.json`（生成物）或 `docs/CAPABILITY-INDEX.md`（生成物）。
- 不把任何 Vibe 技能提升为 `accepted`（运行时）；保持 fail-closed。
- 不修改三个源项目、`sources/` 快照、`LICENSE-MAP.json` 的 `runtimeEligible`。
- 不声称宿主行为已验证。

## 允许写入

- 新增 `provenance/SKILL-CLASSIFICATION.json`
- `scripts/build-canonical-catalog.ps1`（改为数据驱动 + `-OutputPath`）
- `scripts/runtime-projection-guard.ps1`、`scripts/validate-release-notices.ps1`（改为读 `decisionPolicy`）
- 新增 `scripts/build-capability-index.ps1`、`docs/CAPABILITY-INDEX.md`（生成物）
- 新增 `scripts/verify.ps1`
- `provenance/CANONICAL-CATALOG.json`（重生成产物）
- `provenance/OWNER-LEDGER.json`（所有权记录）
- `.github/workflows/release-gate.yml`
- `evidence/20260910-classification-data-driven-and-index.md`、本任务包

## 验收与停止条件

- 重生成后 catalog 与 HEAD 版本在既有字段上逐字段一致（等价性证明）。
- `scripts/verify.ps1` 全绿，退出码 0。
- 反例（真源与生成物不同步）时 `verify.ps1` 必须失败并返回 1。
- 提升一个技能只需改 `SKILL-CLASSIFICATION.json` 的 `readiness`（策略行已存在时）。
- 无第二分类真源；门禁不再硬编码状态字面量。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验 1：等价性 `EQUIVALENCE: PASS (82/82 legacy fields identical)`；比对过程抓到并修复了 accepted 原语 path 重映射回归。
- 复验 2：`verify.ps1` 6/6 通过，`VERIFY_EXIT=0`。
- 复验 3：反例（`ui-styling.readiness=candidate` 且无策略行）→ `VERIFY_EXIT=1`，随后补齐 candidate 策略行。
- 复验 4：提升实测（一行数据编辑 → 索引自动归类）通过，随后还原。
- 决定：本任务 accepted。④（writeAuthority 填充 + 门禁强制）作为下一批独立提交。
