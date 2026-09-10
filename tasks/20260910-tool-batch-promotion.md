# Task 20260910-tool-batch-promotion

状态：accepted（主 Agent 本地复验；提升尝试被门禁拦下，结论已固化）

## 唯一目标

把「成批提升」建立在真实宿主证据上：采集逐技能发现性证据并据此提升；
若门禁拒绝，则如实回退并把拒绝原因固化为可执行的结构性前提。

## 不做事项

- 不绕过门禁（不以放宽门禁的方式让不合格的提升通过）。
- 不把「发现性证据」写成「行为正确性」。
- 不留下失败门禁：要么完整完成，要么回退到绿色。

## 允许写入

- `scripts/collect-host-skill-evidence.ps1`、`provenance/HOST-DISCOVERY-EVIDENCE.json`
- `provenance/SKILL-CLASSIFICATION.json`（策略文档 + 提升/回退）、`provenance/LICENSE-MAP.json`、`docs/CAPABILITY-INDEX.md`、`provenance/CANONICAL-CATALOG.json`
- `evidence/20260910-tool-batch-promotion.md`、本任务包、`docs/HANDOFF.md`

## 验收与停止条件

- 证据台账分类正确（区分 model-visible / 已装但用户可调用 / 未安装）。
- 提升必须通过全部门禁；任一门禁拒绝即回退，并把原因写成可执行前提。
- 结束时 `verify.ps1` 必须全绿。

## 主 Agent 验收记录

- 复验 1：采集到 62 model-visible + 14 installed-user-invoked-only + 6 not-installed（= 82）；
  并实测出「`disable-model-invocation` 技能不在模型清单」这一宿主事实。
- 复验 2：提升 13 个只读 Vibe 技能 + 翻 Vibe runtimeEligible → `verify.ps1` **4/8**：
  投影门禁因 `sources` 段拒绝、NOTICE 门禁因硬编码不变量拒绝、打包同因拒绝。
- 复验 3：据此定位结构性前提（提升 = 物理导入到 sources/ 之外 + 门禁策略化），并写入 `runtimePromotionPolicy.structuralPrerequisite`。
- 复验 4：回退 13 个 + 回退 Vibe flag → `verify.ps1 -IncludePackage` **8/8**，runtime-eligible 回到 4。
- 决定：本任务 accepted（结论与前提是本轮最有价值产出）。下一步为「物理导入 + 门禁策略化」的有界批次。
