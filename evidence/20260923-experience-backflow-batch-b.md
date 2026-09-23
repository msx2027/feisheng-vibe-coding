# 经验回流批 B：升格 orchestrator 实物化 + 主题记账 + 契约 v7（2026-09-23）

## 事件

承批次 A，owner 拍板「同意」的回流批第二部分：①把只在 `sources/` 快照里存在、从未随发行包分发的升格工具族（`experience-governance.mjs` 等，fs-agent 台账人工登记区 2026-09-15 已注明「当前发行包未提供登记工具」）按 hotspot-governor/tools 先例编入 `skills/event/experience-elevator/tools/` 发行；②给台账加主题（「疼的部位」）维度，修掉「单条计数看不见主题级复发」的机制缺口；③契约 v6→v7。

## 变更物

### 1. orchestrator 工具族随包发行（`skills/event/experience-elevator/tools/`）

新增文件 13 个，全部零第三方依赖：

- 主体 9 件：`experience-governance.mjs`、`experience-ledger-core.mjs`、`experience-anchor-contract.mjs`、`experience-managed-blocks.mjs`、`init-target-runtime.mjs`、`safe-target-fs.mjs`、`target-doc-transaction.mjs`、`detect-experience-signal.mjs`、`trusted-git.mjs`（后两件为依赖闭包）。
- 测试 4 件：`test-experience-ledger-core.mjs`、`test-experience-governance-anchor.mjs`、`test-experience-governance-closure.mjs`（快照 `test-experience-governance-doc-contracts.mjs` **不随包**——其断言对象是快照包根的 `MANIFEST.json` 与已退役 setup 技能，属快照仓库作用域，在目标包内永远不可满足）。

**部署 delta（三处，均有正文注释标注 + 本文件凭证）**：

| # | 文件 | delta | 动机 |
| --- | --- | --- | --- |
| ① | `experience-ledger-core.mjs` | 经验记录可选 `theme` 字段（固定枚举 `EXPERIENCE_THEMES`，archived 同样允许保留）；导出枚举 | 主题记账（见下） |
| ② | `experience-governance.mjs` | 台账写回由 `renderLedgerMarkdown` 整文件重渲染改为 `spliceLedgerFence` 围栏拼接 | 快照版会**静默删除围栏外内容**——fs-agent 实账的人工登记区与 P-001 清扫政策围栏都在围栏外；包内 `experience-recorder.mjs` 的写入语义本就是「围栏外原样保留」，orchestrator 对齐之 |
| ③ | `init-target-runtime.mjs` | 头注 `Syncs with` 去掉对已退役 setup 技能的路径引用（改为不含 id 的表述） | 退役引用扫描门禁（快照内同款引用享快照豁免，部署副本不豁免，属真实引用退役 id） |

### 2. 夹具实测（临时真包根 + 部署副本）

validateSkillsRoot 要求 `skills/INDEX.md` + `tools/init-target-runtime.mjs`，故以快照包根为底、覆盖部署副本、把测试放入同布局临时目录运行：

| 测试件 | 结果 |
| --- | --- |
| test-experience-ledger-core | **46 PASS / 0 FAIL**（含 theme delta 回归） |
| test-experience-governance-anchor | **21 PASS / 0 FAIL** |
| test-experience-governance-closure | **63 PASS / 3 FAIL**，3 个失败均为包作用域豁免：2 个因 `check-experience-ledger.mjs` 未随包（其「台账文件 == 整文件重渲染」断言与部署态围栏拼接语义**故意冲突**，不随包是设计决定，部署态校验由 recorder `check` + orchestrator `parseLedger` 承担）；1 个断言快照 `hooks/`/`codex-hooks/` wrapper 存在（契约 v6 明文：源钩子永不执行，由包内 runner 自实现取代） |
| test-experience-governance-doc-contracts | 不随包（快照仓库作用域，见上） |

与 `evidence/20260917-hotspot-governor-tool-sync.md` 的「仓库作用域断言豁免」同一豁免类，且本次在真包根夹具运行，覆盖强于先例的仓库内直跑。

### 3. theme 主题记账（机制修正）

- **动机**：fs-agent 实账 115 条全部停在 L0、仅 1 条达单条阈值——账本按**单条**计数，主题级复发不可见（多会话 Git 纪律以 13 条不同 EXP 各 1–2 次存在，按单条阈值永远够不着升格线）。
- **形态**：`record --theme`（仅新建 L0）；`classify --experience-id --theme --expected-revision`（存量回填/修正，CAS）；`check` 输出 `themeStats`（按主题 L0 计数）+ `THEME_PROPOSAL_THRESHOLD=6` 打包提议信号。**不落盘派生值、不改单条阈值、不自动执行任何升格**；红线全数不变。
- 存量口径：未分类 = 字段缺席，不设 unknown 值；无对应主题的项目特化条目允许保持未分类。

### 4. 契约 v6→v7（`adapters/vibe-hooks/contract.json`）

- `contractVersion` v7 说明；`recorder.actions` 增 `classify` + `themes` 字段说明；新增 `experienceGovernance` 节（orchestrator 部署位置、三处 delta、写入面、确认凭据不变、hook 侧 recorder 边界不变）；`governance.elevationAndRetirement` 更新为「v7 起工具承载，凭据确认不变」；`enablePrerequisites.hook-fresh-session-smoke` 注明 v7 不触碰 capture/Stop 门禁行为（仅 classify/theme 声明为强制时才需重冒烟）。

### 5. 技能文档（登记 2 条 runtime-import 补丁；RUNTIME-NOTES.md 为包自有文件免登记）

- `skills/event/experience-elevator/SKILL.md`：依赖与真源节注明工具族随包发行与 hook 侧分工；自动入口节增补 theme/classify/打包提议句。
- `references/ledger-and-elevation.md`：新增「theme 主题字段」与「部署副本 delta」两节。
- `RUNTIME-NOTES.md`：新增「orchestrator 实物化 + theme」小节（含夹具实测数字与豁免清单）。

## fs-agent 115 条主题映射（classify 回填凭据，owner 2026-09-23 会话批准口径）

| 主题 | 条数 | EXP 列表 |
| --- | --- | --- |
| canvas-design | 30 | 020 021 022 023 024 025 026 043 044 048 049 052 053 079 080 083 084 085 086 090 091 092 093 100 102 103 105 109 110 113 |
| browser-verify | 17 | 001 004 005 017 036 041 050 059 062 063 066 067 074 075 095 099 101 |
| decision-communication | 16 | 006 016 045 047 056 076 077 078 081 087 088 089 094 097 108 111 |
| git-concurrency | 11 | 013 018 055 058 064 065 068 072 104 107 114 |
| assertion-quality | 11 | 011 015 028 029 030 032 039 040 051 054 069 |
| evidence-honesty | 9 | 010 012 031 033 057 060 070 098 115 |
| gate-ops | 8 | 019 027 037 061 071 073 096 112 |
| env-platform | 7 | 002 014 035 038 042 046 106 |
| （未分类） | 6 | 003 007 008 009 034 082（重构操作纪律/项目专属细节，无对应主题，按设计保持缺席） |

合计 115。映射时点主题热度（L0）：canvas-design 30、browser-verify 17、decision-communication 16、git-concurrency 11、assertion-quality 11、evidence-honesty 9、gate-ops 8、env-platform 7——**全部超过打包提议阈值 6**，与批次 A 覆盖审计的四大空白结论互相印证；打包提议的升格裁决留待 owner 逐次确认，不在本批执行。

## 新鲜验证

- 部署副本语法检查通过（node --check 全件）；夹具实测数字见上表。
- `scripts/build-canonical-catalog.ps1`：82 records 再生；`scripts/build-capability-index.ps1` 再生。
- `scripts/verify.ps1`：**16/16 全绿**（含退役引用扫描对部署副本的覆盖——delta ③ 即该门禁真实拦截后修正的产物）。
- 首次升格实弹（EXP-010 → L1 candidate）在 fs-agent 执行，见 evidence/20260923-experience-backflow-first-elevation.md（随 ③d 落盘）。
