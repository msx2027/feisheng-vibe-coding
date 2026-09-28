# 证据：清扫日志绑定契约对齐（ledger-core × init-target-runtime）

- 日期：2026-09-29
- 输入 revision：起点 main @ `260336a`
- owner 授权：fs-agent 会话 2026-09-29，owner 拍板「修包并刷新」（两契约打架挡住 fs-agent 宪法块刷新的处置方案）
- 缺陷定性：**Critical 级包内契约冲突**——recorder 的 govern（contract v7 sweepJournal：清扫把经验移出台账只存外部日志，事件按重放幂等要求留在 processedEvents，测试 5d-5 专守此语义）与 ledger-core 的绑定规则（processedEvents.experienceId 必须绑定 experiences∪archived，对清扫日志零感知）互斥。任何执行过清扫的台账将永远无法通过 governed 校验 → 块刷新/anchor 校验/升档全部 fail-closed。fs-agent 清扫 150 条后首次触发（init-target-runtime --upgrade 报 `processedEvents.experienceId 必须绑定现有经验`）。

## 改动面（4+1 文件）

| 文件 | 改动 |
|---|---|
| `skills/event/experience-elevator/tools/experience-ledger-core.mjs` | `validateGovernedLedger` 增第三可选参 `sweptExperienceIds`（可迭代，默认空）；绑定判定改用 `knownExperienceIds ∪ sweptIds`，事件与 consumedConfirmations 两处绑定同用；错误文案改为「必须绑定现有经验或已登记的清扫日志条目」。函数保持纯函数不读文件。`parseLedger` / `parseLedgerForAnchorAdoption` 透传该参数（默认空，既有调用方零改动） |
| `skills/event/experience-elevator/tools/init-target-runtime.mjs` | 新增 `readSweptExperienceIds(targetRoot, ledgerPath)`：按 contract v7 确定性路径（台账同目录、去 .md 加「-清扫.md」）读日志提取 `## EXP-NNN ·` id 集合，日志缺失返回空集；`l1AnchorFailureState` 的 parseLedger 调用传入 |
| `skills/event/experience-elevator/tools/test-experience-ledger-core.mjs` | 新增 2 用例：无清扫集合时指向已清扫 id 的事件校验/往返解析必须抛绑定错误；传入集合后校验与 round-trip 必须放行且不影响现存经验绑定 |
| `provenance/CANONICAL-CATALOG.json` | 重生成（ledger-core/init-target-runtime sha 变更同步） |
| `evidence/20260929-sweep-journal-binding-alignment.md` | 本文件 |

否决过的替代案：①把清扫条目回填 `archived[]`——governed schema 的 archived 变体要求 `status=retired`＋`retirement.removed`＋confirmationHash 等用户确认凭据形态，清扫条目硬填=伪造确认凭据；②清扫时删除对应 processedEvents——破坏重放幂等（5d-5 P1 回归）；③govern 写 retired 形态——同①。

## 验证证据（2026-09-29 实测）

- `node test-experience-ledger-core.mjs`：**48 passed**（含 2 个新 swept 绑定用例）
- `scripts/verify.ps1`：catalog 重生成后 **21/21 all gates passed**
- 端到端：fs-agent（150 条清扫台账，本事故现场）块刷新在修复后执行成功——见同日 fs-agent 侧提交与收工凭据
- **存量断裂如实登记（stash 前后对照证明与本批无关）**：`test-experience-governance-anchor.mjs`（0 passed/21 failed）与 `test-experience-governance-closure.mjs`（14 passed/52 failed）在 HEAD~1（无本批改动）上同样全红，根因是工具从 `tools/` 迁移至 `skills/event/experience-elevator/tools/` 后 `validateSkillsRoot` 的发布布局检查（skills/INDEX.md + tools/init-target-runtime.mjs）与测试骨架未随迁（closure 显式传 skillsRoot=包根也因缺 INDEX.md 被拒）；`VIBE_CODING_SKILLS_HOME` 环境变量指向已不存在的 `F:\skiils工具\vibe-coding-skills`。此断裂使两套测试自迁移起不可运行，本批未修复（独立批处理），本批的端到端覆盖由 fs-agent 真实事故场景承担
- fs-agent 侧临时手段登记：为运行真工具，在 fs-agent `.tmp/skills-root-shim/` 建立自包含骨架（包工具 6 文件副本＋README 生命周期标注），满足存在性校验后以真实路径调用（isMain 守卫 + Node realpath 解析软链，必须按真实存储路径调用，经 `C:\Users\MSX\.agents` 软链调用会静默跳过主流程——此坑已入 EXP 台账）
