# RUNTIME NOTES（能力定批评次 2026-09-11）

本技能已按「轻量形态」接入统一运行包：

- **随批接入的**：SKILL.md 方法学本体——AI 按正文流程直接维护目标项目的经验台账/反馈索引
  （Markdown 文件操作，不依赖任何外部脚本）。
- **未随批接入的**：正文引用的 `tools/*.mjs` 自动化脚本族与 `.vibe-docs.json` 目标项目治理基础设施。
  它们仍完整保存在本仓库 `sources/vibe-coding-skills/` 快照中；若未来采纳目标项目治理基础设施
  （需先裁决与控制面 target-truth / runtime-projection 的写入者边界），再以独立批次接入自动化层。
- **运行方式**：事件驱动、仅显式调用（不由自然语言独立触发）。与 Hook 采集面的衔接：
  UserPromptSubmit 采集纠错信号 → SessionStart 报告待消化数（`PENDING=`）→ 本技能被显式调用后
  按正文方法学处理信号 → 处理完成后运行 `invoke-vibe-hook-adapter.ps1 -Mode Digest` 标记已消化。
- 引用 `tools/...` 的正文步骤在当前形态下按上述轻量方式等价执行；遇到必须依赖缺失脚本才能
  完成的步骤时，如实报告「自动化层未接入」，不得假装完成。
