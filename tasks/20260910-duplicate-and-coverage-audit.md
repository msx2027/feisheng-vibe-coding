# Task 20260910-duplicate-and-coverage-audit

状态：accepted（主 Agent 本地复验）

## 唯一目标

1. 修掉已定位的 Codex 投影缺口（缺 codex 宿主事实资产）。
2. 检查技能重复（仓库内部、跨来源、宿主层面）。
3. 评估「三包功能，我们的包能实现多少」并给出已知缺口。

## 不做事项

- 不动宿主 `~/.codex/skills` 里的既有内容（重复清理需 owner 授权）。
- 不补非能力性缺口（Vibe `plans/`、Matt 翻译维护脚本）。
- 不声称宿主 trust / 技能行为 / Hook 已强制。

## 允许写入

- `scripts/build-codex-runtime-projection.ps1`（新增 codex overlay）
- `packaging/runtime-projection.json`（codex include + 入口说明）
- `evidence/20260910-duplicate-and-coverage-audit.md`、本任务包、`docs/HANDOFF.md`
- `_smoke/**`（分析中间产物）

## 验收与停止条件

- Codex 投影 Build 与 Validate 均 PASS，且确实包含 Sliver manifest 规定的 3 个 codex overlay 文件。
- 发布包随之更新且 0 违规。
- 重复检查与覆盖分析有可复核的数字与来源。
- `verify.ps1` 全绿。

## 主 Agent 验收记录

- 复验 1：Codex 投影 6 → 9 文件（3 个 adapters/codex/*），Build PASS、Validate PASS。
- 复验 2：`verify.ps1 -IncludePackage` 8/8 通过，发布包 19 → 22 文件、0 违规。
- 复验 3：仓库内部无重复 id / path / 同内容文件；跨来源仅 1 处同名冲突且已由命名空间 + duplicateGroups 消解。
- 复验 4：宿主层面实测 `~/.claude/skills`(187) 与 `~/.codex/skills`(158) 有 **157 个重复**，Codex 会双份注册（证据：prompt-input 中 r0/r1 各一条）。已给出清理建议，未执行。
- 复验 5：覆盖分析：内容 82/82 全覆盖（能力性目录无缺失）；正式投影 4/82；唯一结构性未实现能力 = Hook 自动强制；已知小缺口 3 个 Vibe docs + 1 个 Matt 技能（建议不补后者）。
- 决定：本任务 accepted。遗留：宿主重复清理（待授权）、Vibe 3 个 docs 的有界导入（待决定）。
