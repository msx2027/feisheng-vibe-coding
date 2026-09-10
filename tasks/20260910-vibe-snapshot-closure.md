# Task 20260910-vibe-snapshot-closure

## 状态

accepted

## 验收备注

证据已回写至 `evidence/20260910-vibe-snapshot-closure.md`，provenance 已更新为 schema v2 / `validationStatus=accepted`。550 个批准文件逐文件 SHA-256 一致，旧路由清单只保留在 quarantine；runtime projection 和 fresh-session smoke 仍未验证。

## 唯一目标

在不修改 `F:/skiils工具/vibe-coding-skills` 源目录的前提下，核对目标仓库 `sources/vibe-coding-skills` 是否只包含批准的源码白名单，更新 `provenance/VIBE-IMPORT.json` 的实际快照计数与校验字段，并把可复现的命令、结果和未验证项写入 `evidence/20260910-vibe-snapshot-closure.md`。

## 不做事项

- 不迁移 Matt 技能。
- 不修改 `SOURCE-INVENTORY.json`、`OWNER-LEDGER.json` 之外的治理设计。
- 不删除隔离区、源目录或任何疑似镜像；只能移动到已批准的 quarantine 路径。
- 不声明 runtime projection 或 fresh-session smoke 已通过。

## 允许读取

- `F:/skiils工具/vibe-coding-skills`
- `F:/skiils工具/feisheng-vibe-coding/sources/vibe-coding-skills`
- `F:/skiils工具/feisheng-vibe-coding/sources/_quarantine`
- `F:/skiils工具/feisheng-vibe-coding/provenance/VIBE-IMPORT.json`
- `F:/skiils工具/feisheng-vibe-coding/scripts/import-vibe-source.ps1`

## 允许写入

- `F:/skiils工具/feisheng-vibe-coding/provenance/VIBE-IMPORT.json`
- `F:/skiils工具/feisheng-vibe-coding/evidence/20260910-vibe-snapshot-closure.md`
- 必要时仅可写 `F:/skiils工具/feisheng-vibe-coding/sources/_quarantine/`

## 基线

`699d53db84275a42ae8a2676b0dfe899e3f996ed`

## 验收与停止条件

- 重新统计正式快照文件数，并逐文件对批准源码白名单做 SHA 校验。
- 证明 `.agents`、`.claude/skills`、`.claude/agents`、`.codex`、`MANIFEST.json`、`skills/ROUTING-MANIFEST.json` 不在正式快照中。
- 任一来源文件缺失、SHA 不匹配或 provenance 无法重建时停止并在证据中标记 `rework-required`。
