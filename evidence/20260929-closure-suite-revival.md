# 证据：closure 套件复活批（14/52 → 65/65 全绿）

- 日期：2026-09-29
- 输入 revision：起点 main @ `83f2619`（含本日决策登记节）
- owner 授权：fs-agent 会话 2026-09-29 owner 拍板「分层复活（留金题修好）」并令「现在就开始做」；本批即该决策的执行批
- 执行口径：按 20260929-package-infra-restore-anchor-suite.md §closure 处置决策登记的批次范围

## 关键发现（纠正登记时的预估）

登记时预估「重映射后预期暴露真语义漂移当场修」——**实测零语义漂移**：52 个红的真实病根是**一个统一的路径病**（套件向 init-target-runtime / executeExperienceAction 传的 skillsRoot 指向工具所在的经验电梯目录而非真包根，发布布局校验统一拒绝）＋**3 个死实物用例**（wrapper 1 个＋checker CLI 依赖 2 个）。编排器（experience-governance.mjs）本体的升档凭据 fail-closed 语义完好无损，路径修对后 40 个金题用例全部直接转绿——迁移期间的语义是忠实的。

## 改动面（8 文件）

| 文件 | 改动 |
|---|---|
| `skills/event/experience-elevator/tools/check-experience-ledger.mjs`（新） | **checker CLI 补装**（查证结论：旧包 `tools/check-experience-ledger.mjs` 未随迁移，全仓无等价物）。规格取自存活用例锁定：无 experienceGovernance/无 manifest → skipped exit 0；登记缺台账 → exit 2（缺少/missing）；`--file` 越界（绝对路径/含 `..`/越出项目根）→ exit 2（越界/project-relative/traversal/路径），且越界校验先于 manifest 判定；台账存在 → ledger-core 全量校验（清扫日志绑定与 init-target-runtime 同口径） |
| `skills/event/experience-elevator/tools/test-experience-governance-closure.mjs` | ①harness 增 packageRoot（向上找 provenance/CANONICAL-CATALOG.json），35 处 `--skills-root`/`skillsRoot:` 从经验电梯目录改指真包根（模块路径 signalTool/runtimeTool/ledgerChecker/governance 导入保持迁移后真实位置不动）②**退役** wrapper 用例（「源码与镜像双运行时 wrapper」）及其专用 helper（bashExecutable/runBash/runPowerShell＋trusted-git 导入＋4 个死路径常量），附退役理由注释 ③修复编辑引入的一次重复 import |
| `provenance/CANONICAL-CATALOG.json`、`docs/CAPABILITY-INDEX.md` | 重生成（bundle 新增 checker CLI 一文件） |
| `README.md`、`SKILL.md`、`docs/HANDOFF-NEXT.md` | 文档数字对账：runtime bundle 451→452、安装态 453→454、codex 投影 456→457、claude 投影 454→455（按 verify 数字对账步指认串精准订正，历史口径值与提交哈希零触碰） |
| `evidence/20260929-closure-suite-revival.md` | 本文件 |

退役组实际规模（1 用例）小于登记预估（约 10）：复核发现 signalTool 系用例（277-381）本就走迁移后的活模块 `detect-experience-signal.mjs`，不属于死实物组，全部保留并复活。

## 验证证据（2026-09-29 实测）

- 四套最终回归：**ledger-core 48 passed ／ anchor 21 passed ／ closure 65 passed, 0 failed**（closure 由 14/52 → 65/65，套件总用例 66→65，净变化＝退役 1）；hook adapter 套件（`tests/test-vibe-hook-adapter.ps1`）本批未触碰其覆盖域，前次全绿结论继续有效
- `scripts/verify.ps1`：catalog/capability-index 重生成＋文档数字订正后 **21/21 all gates passed**（对账门禁三.iteration 逐一消化：先 8 处主计数、再 2 处宿主投影分计数）
- checker CLI 冒烟：fs-agent 真台账（150 条清扫＋清扫日志）经 checker 校验通过口径与 init-target-runtime 一致（同一 parseLedger 路径）
