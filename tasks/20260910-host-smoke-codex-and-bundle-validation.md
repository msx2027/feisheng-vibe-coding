# Task 20260910-host-smoke-codex-and-bundle-validation

状态：accepted（主 Agent 本地复验；用户已授权 fetch 与 Codex smoke）

## 唯一目标

① 用授权的一次 `git fetch` 解锁并执行 bundle 深度校验；
② 对 Codex 做真实宿主 discovery A/B smoke；
并把两者固化为证据与可复现的双宿主脚本。

## 不做事项

- 不覆盖、不修改宿主任何既有技能目录。
- 不自造安装集：必须由 Sliver 自带 `build_runtime_bundle.py` 按 `runtime-manifest.json` 产出。
- 不做上游问题报告（owner 决定：本仓库自持，不再依靠上游）。
- 不声称 trust / 技能行为 / Hook 强制已验证。
- 不把宿主 smoke 接入 `verify.ps1`（会消耗真实额度）。
- 测试脚手架不得散落到临时目录或其它宿主配置目录：统一放 `<repo>/_smoke/`。

## 允许写入

- `scripts/smoke-host-skill-discovery.ps1`（取代单宿主脚本）、删除 `scripts/smoke-claude-skill-discovery.ps1`
- `evidence/20260910-host-smoke-codex-and-bundle-validation.md`、本任务包
- `packaging/runtime-projection.json`（新增 `hostDiscovery`，精确记录验证范围与缺口）
- `docs/HANDOFF.md`、`.gitignore`（忽略 `_smoke/`）
- `<repo>/_smoke/**`（脚手架，最后统一清理）
- 宿主：仅 Claude 共享根安装（可一键回滚）；Codex 专属根在验证后卸载
- 来源仓库：仅 `git fetch`（只写 `.git`，不动工作树）

## 验收与停止条件

- 深度校验：两个宿主 bundle 均需 `validate_runtime_bundle` PASS，或如实报不可完成。
- Codex 发现性：A/B 必须给出可判定结论（计数增加或新获技能根）。
- 调用 Python 一律带 `-B`；快照文件数不得变化（220）。
- 不污染：不遗留 `+` 之类误建目录；既有技能目录未被改动。
- 结论不得越界声明 trust / 行为 / Hook。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验 1：常规 `fetch origin` / `--tags` 均无法取得基线对象；**按 SHA 直连 fetch 成功**；来源工作树未变（HEAD 仍 `30c7cfb3`）。
- 复验 2：`validate_runtime_bundle` claude-code 76 文件 PASS、codex 78 文件 PASS（均带 `--trusted-base-root`）。
- 复验 3：Codex A/B（脚本化）`with=204 without=203 gainedRoots=[r0]` → **DISCOVERED**。
- 复验 4：`python -B` 下快照保持 220；未带 `-B` 时产生的 `__pycache__` 曾被 provenance 门禁拦下（上一轮）。
- 复验 5：修掉脚本 `Join-Path ... + $skillId` 把 `+` 当字面参数的 bug，并清理误建的 `~/.codex/skills/+`。
- 复验 6：`verify.ps1` 7/7 通过；`_smoke/` 被 git 忽略。
- 决定：本任务 accepted。遗留：trust / 技能行为 / Hook、代码投影自身的 smoke、Codex 投影缺 `AGENTS.md`。
