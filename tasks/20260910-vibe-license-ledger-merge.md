# Task 20260910-vibe-license-ledger-merge

状态：accepted（主 Agent G1 完成，本地复验）

## 唯一目标

把 Vibe 逐技能许可证归类与缺口补齐的证据合并进 `provenance/LICENSE-MAP.json`，
补齐 ui-styling 6 个字体（IBMPlexSerif ×4、InstrumentSerif ×2）的 OFL 许可证证据，
补 ui-system-guardian 来源声明。**不改变 catalog 状态**（不把任何 Vibe 技能从
source-only 提升为 adapter-candidate），**不写入 runtime projection**。

## 不做事项

- 不修改三个源项目（`F:\skiils工具\sliver-vibe-coding`、`vibe-coding-skills`、`mattpocock-skills`）。
- 不手工修改 `sources/vibe-coding-skills/` 快照（保持 550/550 SHA 闭包）。
- 不把 Vibe runtimeEligible 翻转为 true；不把 Vibe 技能加入 runtime projection。
- 不把混合第三方许可证归并为统一根许可证。
- 不把中断的独立审计标记为通过；adapter-candidate 决定继续等待独立交叉审查。

## 允许写入

- `legal/fonts/IBMPlexSerif-OFL.txt`、`legal/fonts/InstrumentSerif-OFL.txt`、`legal/fonts/NOTICE.md`
- `legal/ui-system-guardian/SOURCE-DECLARATION.md`
- `provenance/LICENSE-MAP.json`（新增 `vibePerSkill` 台账字段；`entries` 聚合结构保持不变）
- `evidence/20260910-vibe-license-ledger-merge.md`
- `tasks/20260910-vibe-license-ledger-merge.md`

## 输入

- `evidence/20260910-vibe-product-audit-local.md`（29 项产品/checker 组）
- `evidence/20260910-vibe-ui-audit-local.md`（17 项 UI 组 + 字体缺口 + ui-system-guardian 缺口）
- `provenance/CANONICAL-CATALOG.json`（46 个 Vibe 技能 id/status）
- 上游来源 revision：
  - IBM Plex Serif：`github.com/IBM/plex` `packages/plex-serif/LICENSE.txt`（master）commit `c5f949677f6f163e8dfe98ca2c326bd48b42fa1b`（2024-06-12）
  - Instrument Serif：`github.com/google/fonts` `ofl/instrumentserif/OFL.txt`（main）commit `5e0122a40050ed2cc20e9d5c387d19dd13c6c69f`（2023-03-22）

## 验收与停止条件

- LICENSE-MAP.json 合法 JSON；`vibePerSkill` 覆盖 catalog 中全部 46 个 Vibe 技能，无重复、无遗漏、无目录外多余项。
- `scripts/validate-release-notices.ps1` 正例退出码 0（PASS）。
- 负例（Vibe runtimeEligible 翻转）仍被门禁拒绝退出非 0。
- 快照 SHA 闭包未被破坏（sources/ 无修改）。
- 不更新 CANONICAL-CATALOG.json 的 Vibe 状态；runtime projection 不含任何 Vibe 技能。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验 1：`python` 校验 46/46 覆盖、无重复；JSON 合法。
- 复验 2：NOTICE 门禁正例退出码 0、PASS。
- 复验 3：负例（Vibe runtimeEligible=true）被门禁拒绝（抛错「Vibe 条目必须保持 runtimeEligible=false」）。
- 复验 4：`git status` 确认 sources/ 无修改；仅 legal/、LICENSE-MAP.json、evidence/、tasks/、docs/ 变更。
- 决定：本任务 accepted；ui-styling 字体缺口已按上游 OFL 文本 + revision 补齐；
  ui-system-guardian 已补来源声明；adapter-candidate 提升仍等待独立交叉审查。
