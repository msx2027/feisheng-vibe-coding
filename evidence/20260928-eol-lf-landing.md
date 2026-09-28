# 换行归一落地：governance/sliver-core 保真树由 CRLF 恢复为 LF

- 日期：2026-09-28　批次：换行归一批
- owner 决策来源：「做」（在演练报告 `evidence/20260928-eol-lf-rehearsal.md` 交出后）
- 前置：同一改动已在隔离克隆里全流程跑通并 21/21 绿（见该报告），本批是把同一件事落到真仓库
- 一句话结论：**220 个保真文件的换行恢复为 LF，内容零差异；体积预算的 d0 上调撤销、有界 D1 上调保留；该树自带的 110 条契约测试红数 17→2；`verify.ps1` 新鲜跑 21/21。**

## 1. 改了什么

| 文件 | 改动 |
|---|---|
| `governance/sliver-core/**`（220 个） | 逐字节剥离 CR（CRLF→LF）；无文件含 NUL、无孤立 CR，故纯文本转换、不涉及二进制风险 |
| `governance/sliver-core/tests/execution-backbone-cases.json` | 除换行外另撤销一个数字：`development_loading_contract.d0_max_bytes` 68000→67000（回上游原值）；`bounded_d1_max_bytes` **保持 75000** |
| `provenance/LOCAL-PATCHES.json` | sliver-core 命名空间 5 条目/7 文件：`patchedSha256` 全重录为 LF 形态，其中 4 个可由本仓库历史 blob 反查的 `originalSha256` 同步重录，3 个 `assets/*` 的原文编号保持原值；`sliver-execution-loading-budget-raise` 正文改写（只保留 bounded_d1、`linesChanged` 2→1）；runtime-import 命名空间 `sliver-core-skill-md-projected-copy-boundary` 只重录 `patchedSha256`，`originalSha256` 保持 `35aebac3…` |
| `provenance/PROVENANCE-INTEGRITY.json` | 树摘要 35a40ec4b9aa0381… → **f8f7a8171a30ddd3…**（`fileCount` 220 不变）；`locallyPatchedPaths` 7 行随上面重录（全为对象）；`annotations` 追加一条 `status=LANDED` |
| `provenance/CANONICAL-CATALOG.json` | 经 pwsh 7 重生成（`scripts/build-canonical-catalog.ps1`），82 条记录 |
| `docs/HANDOFF-NEXT.md` | 门禁行追加换行归一批的实测数字与两处证据指向 |
| `evidence/20260928-loading-budget-and-eol-root-cause.md` | 追加订正：红数环境口径、d0 已撤销、两条未验证项已闭环 |
| `tools/guardrails/secret-baseline.json` | 基线由空补成 6 条唯一存量（全为合成夹具/证据引例，见 §4-1）；只存 `规则|文件|指纹前 16 位`，不含密文本体 |

合计入库 227 个文件（`git diff --cached --name-only` 落地后实测）：220 保真 + `provenance/LOCAL-PATCHES.json` + `provenance/PROVENANCE-INTEGRITY.json` + `provenance/CANONICAL-CATALOG.json` + `docs/HANDOFF-NEXT.md` + `tools/guardrails/secret-baseline.json` + 上一份体积预算证据的追加订正 + 本文件。另一会话留在工作区的未跟踪文件 `evidence/20260928-machine-rule-mirror-sync.md` 不在其中（见 §5）。

## 2. 新鲜实测（本批落地后重跑，不引用演练值）

### 2.1 体积

| 项 | 落地前（CRLF） | 落地后（LF，实测） | 上游原预算 |
|---|---|---|---|
| 整树字节 | 2,525,899 | **2,474,202**（−51,697，−2.05%） | — |
| CRLF 行数 | 51,697 | **0** | — |
| `UI_D0` | 67,420（超 420） | **66,839**（预算 67,000 内，余量 161） | 67,000 |
| `bounded_D1_UI` | 74,684（超 684） | **74,049**（仍超 74,000 达 49） | 74,000 → 保留 75,000 |
| `bounded_project_audit` | 60,629 | **59,977**（预算 65,000，合规） | 65,000 |

### 2.2 该树自带的 110 条 python 契约测试

统一 UTF-8 环境（`PYTHONUTF8=1 PYTHONIOENCODING=utf-8`，`python3 -X utf8 -B -m unittest test_validation_contracts`）：

| 侧 | 跑 | 结果 |
|---|---|---|
| 落地前 CRLF | 110 | `FAILED (failures=17)` |
| 落地后 LF | 110 | **`FAILED (failures=2)`** |

残留 2 条同因且不可修：`FAIL: trusted runtime baseline Git object is unavailable: 29695fe099c6b38c9b5c470abbb2e065fc1ff936` —— 该 git 对象随源项目删除而不可得，与换行无关。**因此「把 110 条套件接进 CI」本批仍未达成，不得声称已解决。**

### 2.3 门禁

`pwsh -NoProfile -File scripts/verify.ps1`：**21/21**。关键步：

- `来源快照完整性 — vibe-coding-skills=553, mattpocock-skills=136, sliver-core=220`（新树摘要实算与登记吻合）
- `保真树换行可复现性 — files = 1645 (-text，索引==工作树)`
- `控制面静态契约评测 — … UI_D0=66839 bytes, bounded_D1_UI=74049 bytes …`
- `catalog 与 SKILL-CLASSIFICATION.json 同步`、`入库生成物为 pwsh 7 排版`、`文档数字与实测一致 — claims = 66 records = 82 runtime = 52 bundle = 451 installed = 453`

## 3. 演练预测与落地实测逐字对上了

- 树摘要：演练预测 `sha256:f8f7a8171a30ddd3…` 与落地后用门禁自身函数 `Get-SnapshotTreeHash` 实算**逐字相同**。
- 7 条 `patchedSha256`：落地时用断言逐条比对演练值，全部相等后才写入。
- D0/D1、红数、21/21：三处均与演练一致。

这条对账是「先在隔离副本跑通再落地」流程的价值证明：落地过程没有出现过需要临时改判的意外。

## 4. 踩到并留证的一处顺序坑

`保真树换行可复现性` 这一步比的是 **git 索引 vs 工作树**。剥离 CR 之后、`git add` 之前跑门禁会得到 `verify: 20/21`，红项是 220 个 `i/crlf != w/lf`。这不是转换失败，是暂存没做——`-text` 属性下 blob 必须跟着工作树走，索引不更新就一直红。

正确顺序：**改内容 → `git add` → 再算树摘要/再跑门禁**。演练时因为整批 `git add -A` 一起做了没暴露，落地时分步做才撞上。

## 4-1. 提交被自家密钥扫描拦下，暴露一处与换行无关的既存缺口

首次 `git commit` 被 `pre-commit` 的密钥护栏阻断：**阻断 6**，全部落在本批只改了换行的两个文件里——

| 位置 | 命中规则 | 实际内容 |
|---|---|---|
| `governance/sliver-core/scripts/check_project_guardrails.py:612` | `FALLBACK-PRIVATE-KEY` | 检测代码自己的字符串字面量（PEM 私钥头，BEGIN/PRIVATE/KEY 三连） |
| `governance/sliver-core/scripts/test_session_continuity.py:142/170` | `FALLBACK-AWS-KEY` | AWS 官方文档示例 key（`AKIA` 前缀、末段 `EXAMPLE`，20 位标准形态） |
| `…/test_session_continuity.py:144/173` | `FALLBACK-SLACK-TOKEN` | Slack 前缀 `xoxb-` 的编造值（数字段 + `secretvalue`） |
| `…/test_session_continuity.py:147` | `FALLBACK-PRIVATE-KEY` | 断言"会被脱敏"的假私钥字面量 |

> 本表刻意不逐字复现这些字符串：`FALLBACK-{AWS-KEY,SLACK-TOKEN,PRIVATE-KEY}` 属高置信类目、按规则永不进基线，证据文件逐字抄一遍就会在提交期把自家护栏点着（本批实际踩过，见下）；且仓库为 public，逐字形态本身就像泄漏。原始字面量以 `git show` 读上述两个源文件为准。

**六处逐条读源码确认为合成夹具，零真凭据**（这些文件的用途恰恰是测试脱敏与私有风险扫描灵不灵）。

根因不是换行：指纹键是 `规则|文件|sha256(密文)[0:16]`，与换行无关。真实缺口是 **`tools/guardrails/secret-baseline.json` 此前为空**（上一批"工厂自家密钥扫描基线落盘"提交的是空基线），而 `secret-scan.mjs:203` 的设计是「阻断只在 `--staged` 生效，安装期全仓首检负责把存量吸收进基线」——首检从未跑过，存量就一直没入账。本批把这两个文件放进暂存区，任何后续批次碰到它们都会同样红。

处置走设计内路径、**未用 `--no-verify`**：跑一次 `node skills/product/hotspot-governor/tools/secret-scan.mjs .`（全仓首检），吸收 8 条告警得 **6 条唯一基线条目**（同文件同密文跨行去重），基线只存 `规则|文件|指纹前 16 位`、不存密文本体，随仓库可审查。复跑 `--staged` 得「新增疑似 0，阻断 0，基线存量 6，退出码 0」。

同一拦截随即**在本批自己的证据文件上复现了一次**：§4-1 初稿逐字抄了那三类字符串，第二次 `git commit` 报 `阻断 3`、来源全是 `evidence/20260928-eol-lf-landing.md`。与存量的区别是设计性的——新内容的指纹不在基线里，而高置信类目按 `secret-scan.mjs:207` 只报不吸收，所以「再提交一次即放行」这条路对它关着。采用的解法是**改写表述、不逐字复现字面量**（见上表脚注），夹具与护栏代码一行未动。

留给你的判断：这条设计对"新写的脱敏测试/安全文档"是硬的——以后要引用这类形态，只能描述形态或走官方 `gitleaks.toml` 白名单，二者都需要人决定，本批未擅自扩白名单、未改扫描器。

## 5. 并行会话隔离

本批开工前的 `git status` 只有我自己那份未跟踪证据文件；转换完成后工作区出现**另一会话留下的未跟踪文件** `evidence/20260928-machine-rule-mirror-sync.md`（内容不是本批产生）。本批按文件名精确暂存，未把它纳入提交，也未删除。

## 6. 未验证项（一律 `UNVERIFIED`）

- **CI**：本批推送后由 GitHub `ubuntu-latest` 实跑，推送前不声明。
- **fresh clone 字节复现**：`.gitattributes` 对 `governance/sliver-core/**` 已打 `-text`，理论上任何 `core.autocrlf` 取值下 clone 都还原 LF，但本批未做 fresh clone 实测（演练副本是 clone 后改的，不是改完再 clone 验的）。
- **混合状态**：`sources/**`、`skills/**` 两棵保真树仍是 CRLF，本批未动。门禁在混合状态下绿（上面第 2.3 条已实测），但「是否也把它们统一为 LF」的额外收益与代价未评估。
- 残留 2 条红的根因（基线 git 对象缺失）不在本批能力范围内，未尝试恢复。
- 宿主端行为、Hook 强制生效：与上一批相同，仍 `UNVERIFIED`。

## 7. 回滚配方

```bash
git revert <本批提交>     # 227 个文件一次还原；换行、两个预算数字、三份账本与投影、密钥基线 6 条一并回到 31cff15 形态
```

手工回滚要点（顺序敏感）：内容改回 CRLF → `git add` → 树摘要回 `35a40ec4b9aa0381…` → `locallyPatchedPaths` 7 行与 `LOCAL-PATCHES` 8 处编号回 CRLF 形态 → 预算数字回 68000/75000 且 `linesChanged` 回 2 → pwsh 7 重生成 catalog → 文档两处回写。
