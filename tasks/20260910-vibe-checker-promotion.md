# Task 20260910-vibe-checker-promotion

状态：accepted（主 Agent 本地复验）

## 唯一目标

补齐上一轮定位出的结构前提（物理导入 + 生成器路径规则 + NOTICE 门禁策略化），
并把**一个有界能力组**——impeccable 侧 bundled 只读检查器 `audit`、`critique`、`harden`、`optimize`——
接入 runtime 静态投影。runtime 覆盖目标：4 → 8。

## 不做事项

- 不接入许可证未通过来源审查的技能：`vibe-original-*` 族（private 分发包，无逐技能许可证文本）一律不提升，
  且必须把该判定写成数据（`runtimeEligible: false` + reason），不能留成代码里的例外。
- 不接入 `unreviewed` 技能（`clarify`、`shape`、`beginner-flow-guide`）。
- 不改动三个来源项目；不手工编辑生成物（catalog / capability index）。
- 不改 `duplicateGroups`、不动 Hook、不做宿主安装或 fresh-session smoke。
- 不声称宿主 trust / 技能行为 / Hook 已验证。
- 不做 repo-wide 换行可复现性修复（另开任务，见第五节）。

## 允许写入

- `scripts/import-vibe-skills.ps1`（新增，唯一导入路径）
- `provenance/VIBE-IMPORTS.json`（新增，派生来源台账）
- `skills/checker/<id>/`（4 个技能的一等副本）
- `provenance/SKILL-CLASSIFICATION.json`（`checker|accepted` 策略行、acceptedStatuses、4 条记录、reasonsById、promotion policy）
- `provenance/LICENSE-MAP.json`（逐族 `runtimeEligible` + reason、overlap 族补 NOTICE、status/note）
- `scripts/build-canonical-catalog.ps1`（accepted Vibe path 规则 + `sourceDir` fail-closed）
- `scripts/validate-release-notices.ps1`（逐族策略取代硬编码 flag）
- `scripts/build-codex-runtime-projection.ps1`、`scripts/build-claude-runtime-projection.ps1`（manifest `accepted` 段）
- `scripts/build-release-package.ps1`（随包声明改为派生）
- `scripts/verify.ps1`（两条内容完整性门禁）
- `provenance/CANONICAL-CATALOG.json`、`docs/CAPABILITY-INDEX.md`（重生成）
- `README.md`、`docs/MIGRATION-PLAN.md`、`packaging/runtime-projection.json`（同步事实）
- `evidence/20260910-vibe-checker-promotion.md`、`tasks/20260910-line-ending-reproducibility.md`、本任务包、`docs/HANDOFF-NEXT.md`

## 验收与停止条件

- 4 个技能在 `sources/` 之外有完整一等副本，且 `provenance/VIBE-IMPORTS.json` 记录逐文件 SHA-256 与 sourceCommit。
- catalog 中 4 条记录的 path 均为 `skills/checker/<id>/SKILL.md`，`status=accepted-checker`，`writeAuthority=none`。
- NOTICE 门禁对 4 条 Vibe 条目按**逐族策略**判定并解析出真实 notice 文件（不是硬编码 flag）。
- 缺 `sourceDir` / `sourceDir` 与上游目录名不一致 / 导入目标已存在 → 一律 fail-closed。
- 反例实测：内容漂移被拒；族级 `runtimeEligible=false` 被拒。
- `pwsh scripts/verify.ps1 -IncludePackage` 全绿。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验 1：`import-vibe-skills.ps1` 导入 4 个技能（7 文件）并生成台账；重复运行被拒（`拒绝覆盖`）。
- 复验 2：catalog 4 条记录 → `checker/accepted/accepted-checker`，path 指向一等副本；runtime 可用集合 4 → 8。
- 复验 3：NOTICE 门禁 `PASS`，runtime items 5 → 9，其中 4 条 Vibe 条目带 `licenseFamily=impeccable-bundled-product-checker-overlap` + 2 个 notice。
- 复验 4（反例）：`skills/checker/audit/SKILL.md` 追加一行 → `runtime include 内容完整性` FAIL（sha 与登记不一致）。
- 复验 5（反例）：overlap 族 `runtimeEligible=false` → NOTICE 门禁 FAIL（族级策略生效）。
- 复验 6：Codex 投影 bundle 实测含 4 条 `skills/checker/<id>/SKILL.md`，无 `sources` 段；发布包 32 文件、0 违规。
- 复验 7：`verify.ps1 -IncludePackage` **10/10 PASS**（原 7 项 + 新增 2 项 + 发布包）。
- 决定：本任务 accepted。遗留：投影仍是「每条记录一个文件」（见证据第五节）、路由绑定（0 条）、宿主 trust/行为/Hook（UNVERIFIED）。

## 五、关联的发现任务

同一轮验证中发现**既有**缺陷：fresh clone 下 `来源快照完整性` 因 `core.autocrlf=true` 直接失败（492 文件）。
该缺陷与本批改动无关（HEAD 即可复现），已登记为 `tasks/20260910-line-ending-reproducibility.md`，本轮不修。
