# vibe-event-only（经验沉淀三件套）来源声明

声明日期：2026-09-11
声明人：owner（本仓库与 vibe-coding-skills 集合的作者/维护者）
关联证据：`evidence/20260911-capability-finalization.md`
状态：runtimeEligible = true（能力定批评次，轻量形态接入）

## 覆盖技能

- `experience-elevator`
- `evolution-engine`
- `feedback-writer`

## 来源判定

| 项目 | 结论 |
|---|---|
| 作者 | owner 本人确认：vibe-coding-skills 为本人开发/维护的集合（2026-09-11，已记录于 LICENSE-MAP vibe-original-product-checker 族 reason），三件套属于其中自研的事件驱动能力 |
| 上游快照 | `sources/vibe-coding-skills/`（sourceCommit `635c54f9abb091c1293de346407663ad6af0862b` 口径，逐文件 SHA 闭包） |
| 第三方 bundled 内容 | 无（三件套不在 `docs/legal/BUNDLED-DESIGN-SKILLS-SOURCES.md` 的任何 bundled 清单内） |
| 许可证 | 随 owner 自用声明：仅本机自用、不对再分发；再分发前需补正式许可证文本 |

## 接入形态（轻量，诚实边界）

- **随批接入**：SKILL.md 方法学本体（AI 直接按正文维护经验台账/反馈索引）+ 各自 `RUNTIME-NOTES.md`。
- **未随批接入**：`tools/*.mjs` 自动化脚本族与 `.vibe-docs.json` 目标项目治理基础设施（其中
  target-constitution-setup / target-runtime-setup 因与控制面写入者冲突已在同批评次退役）。
  正文引用缺失脚本时必须如实报告「自动化层未接入」。
- **触发语义**：事件驱动、仅显式调用；与 Hook 采集面的衔接为
  「采集 → SessionStart 报待消化（PENDING=）→ 显式调用本组技能处理 → `-Mode Digest` 标记已消化」。
