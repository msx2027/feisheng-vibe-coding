# Task 20260910-local-patch-registry

状态：accepted（主 Agent 本地复验；owner 选定方案 B）

## 唯一目标

把 provenance 模型从「镜像 · 字节一致」升级为「vendor · 偏差登记」：允许对 vendored 内容打补丁，
但每个偏差必须登记（含原始哈希，保证可逆与可验证），并修掉 Sliver 三个模板资产在 Claude Code 的 YAML 解析错误。

## 不做事项

- 不修改**未登记**的文件；除已登记补丁外，快照仍须与来源逐字节一致。
- 不修改三个来源项目（对来源只读）。
- 不用「改登记」的方式掩盖意外漂移。
- 不声称宿主 trust / 技能行为 / Hook 已强制。
- 不产出上游问题报告（owner 决定：本仓库自持）。

## 允许写入

- `provenance/LOCAL-PATCHES.json`（新真源）
- `governance/sliver-core/assets/{project-audit/audit-report.md, project-decision/adr.md, project-feature/feature-truth.md}`（已登记补丁）
- `scripts/provenance-integrity.ps1`（`Get-LocalPatches` + 校验分支）、`scripts/record-provenance-integrity.ps1`（识别登记）
- `provenance/PROVENANCE-INTEGRITY.json`、`provenance/OWNER-LEDGER.json`（新 owner）
- `evidence/20260910-local-patch-registry.md`、本任务包、`docs/HANDOFF.md`

## 验收与停止条件

- 三个文件的 YAML frontmatter 可解析，且**解析后的值等于原 `@@…@@` 占位符**（语义无损）。
- 未登记偏差与登记过期都必须让 verification 失败；已登记偏差通过。
- 两宿主 bundle 的 `validate_runtime_bundle` 仍 PASS。
- 真实宿主中我们技能触发的 YAML 解析失败降为 0，且发现性不变。
- 快照文件数不得意外变化（sliver-core 仍 220）。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验 1：根因用真实 YAML 解析器定位（`found character '@' that cannot start any token`），非猜测。
- 复验 2：补丁后 3 文件解析 OK，解析值仍为原占位符；diff 仅 3 文件 × 4 行。
- 复验 3：记录器背书 `751 逐字节 + 4 revision + 3 已登记补丁 + 148 白名单 = 906`（= 550+136+220）。
- 复验 4：先读校验器源码确认只比对 bundle ↔ 自身快照、baseline 仅校验路径，再实测两 bundle PASS。
- 复验 5：真实 Claude Code 中 YAML 失败 3 → 0，加载数仍 169。
- 复验 6：反例（篡改已登记文件）→ 失败并点名 `content-vs-registered-patch`；还原后 PASS。
- 复验 7：`verify.ps1` 7/7 通过；`_smoke/` 仍被 git 忽略。
- 决定：本任务 accepted。遗留：宿主 trust / 技能行为 / Hook；模板在真实目标项目中的实例化行为。
