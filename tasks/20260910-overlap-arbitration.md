# Task 20260910-overlap-arbitration

状态：accepted（主 Agent 本地复验）

## 唯一目标

把交接文档点名的 11 个功能簇，补齐为 `provenance/SKILL-CLASSIFICATION.json` 的 `duplicateGroups` 机读裁决；
owner 必须登记于 `provenance/OWNER-LEDGER.json`；不改动任何 `readiness`/`status`。

## 不做事项

- 不删除技能、不把技能降级为 excluded（全量保留内容 + 声明归属 + Sliver 唯一路由）。
- 不改动任何 `readiness`/`status`（只加裁决）。
- 不手工编辑 `provenance/CANONICAL-CATALOG.json` 或 `docs/CAPABILITY-INDEX.md`（生成物）。
- 不引入路由绑定、不做 runtime 提升、不触碰来源快照与三来源仓库。
- 不声称宿主 trust / 技能行为 / Hook 已验证。

## 允许写入

- `provenance/SKILL-CLASSIFICATION.json`（`duplicateGroups` 11 组 + 顶层 note）
- `provenance/OWNER-LEDGER.json`（登记 7 个域 owner）
- `scripts/build-canonical-catalog.ps1`（duplicateGroups owner/成员 fail-closed 校验）
- `scripts/build-capability-index.ps1`（裁决展示段）
- `provenance/CANONICAL-CATALOG.json`、`docs/CAPABILITY-INDEX.md`（重生成）
- `evidence/20260910-overlap-arbitration.md`、本任务包、`docs/HANDOFF-NEXT.md`

## 验收与停止条件

- 11 簇全部有机读裁决，且覆盖交接文档点名的 50 个技能（无遗漏）。
- 每个 group 的 owner 均在 `OWNER-LEDGER.json` 中；成员均为 canonical id（生成器 fail-closed 强制）。
- 未登记 owner / 未知成员 → 生成失败（反例实测）。
- `git diff` 证明 `readiness`/`status` 零改动。
- `pwsh scripts/verify.ps1 -IncludePackage` = 8/8。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验 1：`duplicateGroups` 3 → 11；交接 11 簇 cluster_distinct=50，`covered_by_groups=True`、`missing=[]`、`member_in_multiple_groups=[]`、`members_not_in_classification=[]`。
- 复验 2：owner 归一化（`project-entry`→`route-catalog`、`review-and-test`→`validation-gate`）后，owner 全部在 ledger 中。
- 复验 3：反例 owner/成员各注入一次，生成器均 `exit=1` 且不产出 catalog。
- 复验 4：catalog diff 仅 `generatedAt` 与 `duplicateGroups` 区；`records`/`decisionPolicy` 无改动行（readiness/status 未变）。
- 复验 5：`verify.ps1 -IncludePackage` 8/8 通过，发布包 22 文件、0 违规。
- 决定：本任务 accepted。遗留：路由绑定（0 条）、runtime 提升（4/82）、宿主 trust/行为/Hook（UNVERIFIED）。
