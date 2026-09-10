# Task 20260910-vibe-docs-import

状态：accepted（主 Agent 本地复验）

## 唯一目标

补齐 Vibe 被自身文档引为权威、但不在快照里的 3 个 md 文档，使「引用存在」。

## 不做事项

- 不导入非能力性产物（演示 html、开发计划、宿主镜像）。
- 不顺便扩大其它来源的快照范围。
- 不改变任何技能的 readiness/status。

## 允许写入

- `sources/vibe-coding-skills/docs/**`（3 个 md）
- `provenance/VIBE-IMPORT.json`、`provenance/PROVENANCE-INTEGRITY.json`（重记基线）
- `evidence/20260910-vibe-docs-import.md`、本任务包、`docs/HANDOFF.md`

## 验收与停止条件

- 源与快照 SHA-256 逐字节一致。
- 导入记录计数与 fileSha256 一致且有序。
- 快照完整性门禁通过（553/136/220），`verify.ps1` 全绿。

## 主 Agent 验收记录

- 复验 1：3 文件复制后 source/snapshot SHA 全部一致（match=True）。
- 复验 2：VIBE-IMPORT 计数更新为 553，fileSha256 按 path 排序 553 条，outsideAllowlist 789。
- 复验 3：基线重记通过（754 逐字节 + 4 revision + 3 补丁 + 148 白名单 = 909）。
- 复验 4：`verify.ps1 -IncludePackage` 8/8 通过，发布包 22 文件。
- 决定：本任务 accepted。
