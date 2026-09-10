# Task 20260910-write-authority-gate

状态：accepted（主 Agent 本地复验）

## 唯一目标

让 `writeAuthority` 从空占位变成被强制执行的门禁，并消除投影门禁的平行实现。

## 不做事项

- 不推断未验证技能的写权限（未验证者保持 absent，不填猜测值）。
- 不放宽任何现有门禁；不把 Vibe 技能提升进 runtime。
- 不修改三个源项目、`sources/` 快照、`LICENSE-MAP.json.runtimeEligible`。
- 不声称宿主行为已验证。

## 允许写入

- `provenance/SKILL-CLASSIFICATION.json`（词表、策略、4 条声明）
- `scripts/build-canonical-catalog.ps1`（词表校验 + 策略投影）
- `scripts/runtime-projection-guard.ps1`（规则 A/B + `Get-ExpectedDirectories`）
- `scripts/build-codex-runtime-projection.ps1`（收敛到共享门禁）
- `scripts/build-claude-runtime-projection.ps1`（移除本地重复 helper）
- `scripts/build-capability-index.ps1` + `provenance/CANONICAL-CATALOG.json` + `docs/CAPABILITY-INDEX.md`（重生成）
- `evidence/20260910-write-authority-gate.md`、本任务包

## 验收与停止条件

- runtime include 未声明 writeAuthority → 构建失败。
- 非排他 owner 声明控制面 token → 构建失败（重复写入者）。
- Codex 与 Claude 使用同一套投影门禁（无平行实现）。
- 收敛后 Codex 产物与收敛前逐文件一致（内容不变证明）。
- `scripts/verify.ps1` 全绿。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验 1：反例 B 修复前在 Codex 路径**未触发** → 据此发现 Codex 平行门禁实现；修复后触发。
- 复验 2：反例 A 修复后触发（`runtime include 必须声明 writeAuthority`）。
- 复验 3：收敛等价性 `CODEX OUTPUT IDENTICAL (per-file sha256 + file set)`。
- 复验 4：`verify.ps1 -IncludePackage` 7/7 通过，`VERIFY_EXIT=0`。
- 复验 5：`grep -c "function Get-ProjectionPlan"` → Codex 0、guard 1。
- 决定：本任务 accepted。遗留：78 条未声明写权限（诚实 absent）、`status` 别名收敛、宿主 smoke。
