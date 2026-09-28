# 证据：check 瘦身＋search 按需检索＋治理账本预算（治理文档防膨胀三道闸）

- 日期：2026-09-29
- 输入 revision：起点 main @ `6a18db1`；本批含 provenance/CANONICAL-CATALOG.json 重生成
- owner 授权链：fs-agent 项目会话 2026-09-28 owner 三拍板（授权改 recorder check 输出＋契约文本／P-001 清扫直接执行／search 同时承载记账查重与干活召回）；2026-09-29 owner 追加两拍板（清扫阈值 30 天→未命中 3 天即扫；包源同步＋宪法条款「加」＋fs-agent 改完即重装）
- 起因（第一性根因）：fs-agent 实测 `--action check` 全量吐 211 条经验摘要＝47,639 字节/次（约 1.5 万 token），契约要求每次记账/收工自检都跑——token 消耗主凶不是台账文档长（agent 从不全读），而是**检索出口无界**；叠加**存量无界**（209 条 L0 只进不出，政策已登记却从未执行）与**增长无预警**。三重无界＝治理文档膨胀病的根。

## 1. 改动面（本仓库 7 文件）

| 文件 | 改动 |
|---|---|
| `adapters/vibe-hooks/experience-recorder.mjs` | check 只出索引（revision/entryCount/themeStats/governance/details 提示），删除 211 条全量 experiences dump；新增只读 `--action search --theme <枚举> / --keyword <词>`（theme 精确、keyword 对 summary+landing 大小写不敏感子串兜底，覆盖未分类与跨主题撞车）；VALUE_FLAGS/ACTIONS/usage 同步 |
| `adapters/vibe-hooks/contract.json` | contractVersion 升 v7.1（check-slim + search 注记）；actions 补 search（并补齐漏登的 selfcheck）；recorder.themes 描述改为「check 只出索引、search 按需取明细」；governance.model 增补提议义务（dueForReview/entryCount>100/无政策三触发任一，AI 必须主动提议政策，daysUnhit 按项目节奏建议、数字 owner 拍板） |
| `scripts/invoke-vibe-hook-adapter.ps1` | SessionStart 契约第 4 条记录方法改两步流（check 索引 → search 查重 → record）；autoRecord 路由 587 行插 search 查重步；治理义务（第 6 条）扩为三触发＋建议节奏示例（高速 3 天/低速 30 天） |
| `skills/event/experience-elevator/tools/init-target-runtime.mjs` | 受管宪法块「文档真源与 Markdown 治理」节新增一条：治理/台账类 Markdown 的 LLM 消费面必须有界（索引＋按需、禁止全量 dump；账本须登记衰减政策，异常增长先提议衰减）。未来新项目开箱自带；存量项目不受影响（init 不重跑不刷新） |
| `tests/test-vibe-hook-adapter.ps1` | 新增 5c-2a 瘦身守卫（check 输出禁含 `"summary"`、必含 entryCount）；5d-2b search 四用法（keyword 命中/theme 空结果合法/无参拒/坏枚举拒）；5d-4 record 带 `--theme env-platform`＋5d-4b theme 正向命中 EXP-002 |
| `provenance/CANONICAL-CATALOG.json` | 重生成（init-target-runtime.mjs sha 变更的一等副本登记随之更新；82 records） |
| `evidence/20260929-check-slim-search-ledger-budget.md` | 本文件 |

不改动：升档/退役红线（工具永不自动）、清扫必须已登记政策、台账 schema v2、幂等/CAS 机制、processedEvents 保留策略（重放防护依赖它）。

## 2. 与 fs-agent 安装态的关系

fs-agent 安装副本（`.feisheng/vibe-hooks/` 三件，gitignore 不入库）由 2026-09-28 会话先行手改并验证；本批经逐行 diff 确认包源与安装副本差异恰好＝本批三件改动后整文件覆盖移植，两边内容一致。fs-agent 的 `install-manifest.json` 哈希登记随后由重装刷新（装后行为验证在该项目侧收工凭据留痕）。

## 3. 验证证据（本仓库，2026-09-29 实测）

- `node --check` recorder 通过；contract.json JSON.parse 通过；两份 ps1 Parser 0 错误
- 测试套件 `powershell -NoProfile -File tests/test-vibe-hook-adapter.ps1`：PASS（含新增 search/瘦身用例；原有 capture/autoRecord/治理/Stop 门禁/白名单/幂等覆盖零回归）
- `scripts/verify.ps1`：初跑 19/21（两红＝catalog 过期＋init-target-runtime.mjs sha 漂移，均系本批改动的登记滞后，非逻辑缺陷）→ `pwsh scripts/build-canonical-catalog.ps1` 重生成后复跑 **21/21 all gates passed**
- 效果实测（fs-agent 侧，2026-09-28/29）：check 47,639→1,057→989 字节（-97.9%）；P-001 阈值 30 天改 3 天后 govern 清扫 150 条入 `经验治理-清扫.md`（可恢复）、留 63 条，台账 experiences 213→63
