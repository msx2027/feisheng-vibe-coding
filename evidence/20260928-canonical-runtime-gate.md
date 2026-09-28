# 规范化运行时批：入库文件只许用 PowerShell 7 生成，并给全机四个 Agent 立同一条规矩

- 时间：2026-09-28
- 基线 revision：`463bb93`（含前一天的数字对账批 `f74c7f0` 与提问载体批）；改前默认档 **19/19 全绿**（13:20 实测，退出码 0）
- 触发：owner 问「这台电脑不是用 PowerShell 7 吗，为什么会用到 5.1」，接着问「怎么让所有 Agent 强制用 pwsh」。
  前一问的事实核对引出一个真洞：**同一份数据用 5.1 存盘体积近乎翻倍，而现有门禁全绿**——它只比内容、不比排版。

## 实测事实（本机两版并存的真相）

| 项 | PowerShell 7 | Windows PowerShell 5.1 |
|---|---|---|
| 命令名 / 版本 | `pwsh` = 7.6.3 | `powershell` = 5.1.19041.6456 |
| 路径 | `C:\Users\MSX\AppData\Local\Programs\PowerShell\7` | `C:\Windows\System32\WindowsPowerShell\v1.0`（系统自带，删不掉） |
| 同一仓库同一时点重生成 catalog | **158,273 字节 / 3,656 行** | **289,370 字节 / 3,800 行** |
| JSON 每层缩进 | 2 空格（实测缩进档位 0/2/4/6/8/10/12） | 4 空格（档位 0/4/16/20/24/28/32…，**没有 2 空格档**） |
| 解析后逐字段比对 | 剥掉 `generatedAt` 后两边序列化结果 **全等**（实测 `True`） | 同左 |
| `Set-Content -Encoding UTF8` | 无 BOM，CRLF 结尾 | **多写 3 字节 BOM**（`ef bb bf`），同为 CRLF；同内容实测 14 字节对 17 字节 |

结论：两版算出来的东西**内容一样**，差别全在排版；而 `scripts/verify.ps1:101-107` 的第 1 步是把两边 JSON 解析后比语义，**对缩进不敏感**。谁用 5.1 重生成一次 catalog 并写回 `provenance/`，入库文件当场胖近一倍，门禁照样全绿。

订正：本条初稿把体积翻倍部分归因于「中文被转义 + 缩进」，实测 `\uXXXX` 转义在两版里分别只有 2 处与 0 处，**不足以解释翻倍**；真因是缩进宽度（2 对 4）与断行位置。另：初稿写「5.1 还多写 CRLF」也不准，实测两版行尾同为 CRLF，只有 BOM 是 5.1 独有。

## 变更物

### 1) 生成器侧：拒绝在 5.1 下写仓库内文件

- `scripts/build-canonical-catalog.ps1`（`$outputPath` 解析之后）与 `scripts/build-skill-inventory.ps1`（脚本开头）各加一道运行时闸门：
  主版本 < 7 **且** 目标路径落在仓库内 → `throw`，报错原文给出该改成的 pwsh 命令行。
- 只在「写入库镜像」时拦：`-OutputPath` 指向仓库外（verify 第 1 步的临时比对副本就是这种用法）**不受限**，
  以此保住仓库既有的双运行时口径——README 徽章写 `PowerShell 7 | 5.1`、`docs/HANDOFF-NEXT.md:20` 写「fresh clone 在 pwsh/PS5.1 下同样全绿」。
- 没做全局劫持：不动 `C:\Windows\...\powershell.exe`，也不在 PATH 前面塞同名转发文件。Windows 自身的控制面板、更新程序、计划任务与 Visual Studio 等就依赖 5.1，换了会把无关东西搞坏且难回退。

### 2) 门禁侧：新增第 1a 步「入库生成物为 pwsh 7 排版」

- 判据取**结构**而非体积：入库的 `provenance/CANONICAL-CATALOG.json` 与 `provenance/SKILL-INVENTORY.json` 必须存在缩进恰为 2 空格的行；
  5.1 排版的缩进全为 4 的倍数、绝无 2 空格档，故一定被抓住。
- 为什么不写「体积不得超过 N 字节」：那是个会随记录数增长自己烂掉的数字（前一天的数字对账批刚演示过手抄数字怎么漂移）。
- 只查这两份由生成器产出的镜像，不查 `LOCAL-PATCHES.json` / `PROVENANCE-INTEGRITY.json`（人工修订登记，非生成物）。

### 3) 文档步数同步

- 本批写入的是 `19 → 20`：`README.md:15` 徽章、`:74` 中文表、`:205` 英文表；`docs/HANDOFF-NEXT.md:20`（D4）、`:35`（门禁条）、`:115-116`（步数口径与清单，新增 `1a` 一行，历史口径补记 19）。
- 落账时实测：同一份工作树里另一会话把 `README.md` 三处与 `HANDOFF-NEXT.md:20/:35` 从 20 续写成 **21 / 全开 23**（他们的 1e 步），
  末步自计对 README 两处的比对随现实自动移动判据，本批无需再追（见「实弹验证」最后两条）。
- `docs/HANDOFF-NEXT.md:115` 的清单行停留在本批写的 20，与实测 21 不符——已改为 **21** 并把 `1e 控制面静态契约评测` 补进该枚举；
  历史口径补记 `20`。**这条仍是手抄**：末步自计只对 README 徽章与正文两处，HANDOFF 的步数不在锚点内（下一批可把 HANDOFF 两处并入同一公式）。


### 4) 全机 Agent 规矩（四个用户级文件，均在本机、不在仓库）

| 文件 | 加在哪 | 说明 |
|---|---|---|
| `C:\Users\MSX\AGENTS.md` | 「Shell 环境规则」节末（真源，该节标题写明「对所有 agent 生效」） | 新增一条：生成入库文件一律 `pwsh`，跨版本验证才允许 `powershell` 且输出须指临时目录 |
| `C:\Users\MSX\.codex\AGENTS.md` | 「[Windows 命令环境规则]」块内 | 显式写明与既有那条「语法保持 5.1 与 7 均可运行」**不冲突**：那条管脚本语法，这条管产出运行时 |
| `C:\Users\MSX\.claude\CLAUDE.md` | 新节「## Windows 生成物必须用 pwsh（PowerShell 7）」 | 沿用该文件既有的 `<!-- ===== X-START (mirror of ...) ===== -->` 镜像约定 |
| `C:\Users\MSX\.gemini\GEMINI.md` | 同款镜像节 | 该文件此前完全没有 PowerShell 相关条文（实测 `grep -c powershell` = 0） |

`.cursor` 目录下无全局规则文件（Cursor 的全局规则在设置里，不在文件系统），故未动。

## 实弹验证

- **闸门拦住 5.1 入库写**：`powershell -File scripts/build-canonical-catalog.ps1 -RepoRoot F:\skiils\feisheng-vibe-coding` → 退出码 **1**，
  报错原文「拒绝用 Windows PowerShell 5.1.19041.6456 写入仓库内生成物 …… 请改用 PowerShell 7 重跑: pwsh -NoProfile -File …」；文件未落盘（仍 158,273 字节）。
- **放行 5.1 写临时目录**：同命令加 `-OutputPath <临时目录>` → `Generated ... with 82 records.`，证明双运行时没被这条打破。
- **新门抓到冒充入库**：把 5.1 生成的 289,370 字节文件直接覆盖 `provenance/CANONICAL-CATALOG.json` 后跑门禁 →
  第 1 步 `[PASS] catalog 与 SKILL-CLASSIFICATION.json 同步`（**正是旧门的洞**），
  第 1a 步 `[FAIL] 入库生成物为 pwsh 7 排版 — provenance/CANONICAL-CATALOG.json 不是 pwsh 7 排版（无缩进 2 空格行，疑似 Windows PowerShell 5.1 生成的每层 4 空格；用 pwsh 重生成该文件）`，退出码 **1**。随后 `git restore` 还原，实测体积回到 158,273。
- **本批绿跑**：13:41 `pwsh -NoProfile -File scripts/verify.ps1 -RepositoryRoot .` → `verify: 20/20 steps passed`，退出码 0；新步输出 `入库生成物为 pwsh 7 排版 — files = 2 (2-space indent)`。
- **终局 fresh 跑（13:54）：`verify: 19/21 steps passed`，退出码 1，两条红项**——
  ① `来源快照完整性`（成因见「附带发现」第 2 条，已用临时目录复算定责到他会话的未提交改动）；
  ② `文档数字与实测一致 — 来源快照文件数未获得（第 3 步未通过，先修它）`——这是上一批刻意设计的 **fail-closed**：
  该步的快照文件数消费第 3 步的实测值，第 3 步没给数就不自己另立一个「看起来通过」的数。
  其余 19 步全绿，含本批新增的第 1a 步。
- **总步数从 20 变成 21**：13:41 之后，另一会话把「控制面静态契约评测」接进同一份工作树（`verify.ps1` 的第 1e 步，实测 diff 在案）。
  末步自计随即把判据移到 21（README 再写 20 就判红，本批写的 20 被对方续写成 21）——**上一批那句「增删门禁不必再手抄」当场兑现**：
  新增一步只需改一处（脚本本身），徽章与正文的对账由脚本自己数，红/绿判据不依赖任何人记得回头改文档。

## 附带发现（另案，本批未修，需 owner 拍板）

- **快照目录里的 python 字节码缓存会把门禁弄红**：`governance/sliver-core/scripts/__pycache__/*.pyc` 一旦生成，
  「来源快照完整性」立刻由登记的 220 个文件变成实测 222 而判红（13:36 与 13:44 两次实测命中；删掉该目录即恢复 220）。
  这些 `.pyc` 是 git 已忽略的可再生缓存（`git status --ignored` 显示 `!!`），但树摘要按「盘上有什么就算什么」，两者口径不一致。
  三个候选修法：① 摘要计算时排除 gitignore 命中项；② 所有调用 `python` 的位置统一带 `-B`（实测本仓库三处 python 调用现已全部带 `-B`：
  `scripts/smoke-host-skill-discovery.ps1:113`、`:121`、以及本批期间另一会话新接的 `verify.ps1` 第 1e 步；故剩下的触发面是**人工不带 `-B` 直接跑 `python`**）；
  ③ 环境设 `PYTHONDONTWRITEBYTECODE=1`。
  本批只做了清理（删缓存恢复 220），**没有改摘要口径**——那是 provenance 语义变更，属 owner 决策。
- **工作区里另有他会话的未提交改动，且会把「来源快照完整性」弄红**：13:47 与 13:54 两轮跑门禁均为
  `[FAIL] 来源快照完整性 — 快照树摘要变化: 记录=sha256:75eb2715 实际=sha256:4d64a25a / 35a40ec4`（同批改动被续写，实测摘要随之再变），
  成因是另一会话于 13:43:43 修改了 `governance/sliver-core/tests/execution-backbone-cases.json`（加载体积预算 67000→68000、74000→75000）而尚未登记树摘要。
  本批只读该文件、未改它。
  **归因做了隔离实证**（不只是看 diff 猜）：把 `governance/sliver-core` 整目录复制到临时目录，只把这一个文件换回 `git show HEAD:` 的版本，
  直接调 `Get-SnapshotFileRecords` + `Get-SnapshotTreeHash` 重算 → `files=220`、`treeHash=sha256:75eb27157671a77b8eb2620f43fe763dc61bb8ae06a0faa7f1f6789cc2e3bf35`，
  与登记值逐字符相同。即：工作区里 `governance/sliver-core/` 下除该文件外无任何改动，这一条红与本批无关。
  按「没有新鲜验证不得声明完成」的规矩如实记在这里：本批自身的绿证据是 13:41 那次 `20/20`（当时树摘要仍为登记值）。
- **两个会话共用一份工作树，提交边界不干净，故本批未提交**：实测 `git diff` 显示
  `README.md`、`docs/HANDOFF-NEXT.md`、`scripts/verify.ps1` 三个文件里**同时叠着两批未提交的 hunks**——
  本批的 1a 步与他会话的 1e 步（控制面静态契约评测）在同一个 `verify.ps1` 里相邻落地；
  README 徽章与正文的步数被对方从 20 续写成 21（本批写的是 20），`docs/HANDOFF-NEXT.md:35` 同样被对方补写了 20→21 的口径。
  此时按路径提交会把对方**尚未登记树摘要、当时正弄红门禁**的那半批一起提交进去，违反「没有新鲜验证不得声明完成」；
  按 hunk 拆分（`git add -p` 一类）需要在共享工作树上做交互式暂存，风险高于收益。
  后续实况：对方于 14:03 前完成登记（见「终局补记」），整棵树转为 21/21 全绿；但混排格局未变——
  `verify.ps1` / `README.md` / `docs/HANDOFF-NEXT.md` 里的两批 hunks 无法按路径拆开提交，拆要动交互式暂存。
  **本批未提交**：用户本轮未要求提交，且一次提交会同时替另一批背书，归属决定权在 owner。


## 明确不做

- 不劫持系统 `powershell.exe`（理由见上，波及面与回退成本都不划算）。
- 不改 `tests/run-isolated.ps1:15` 里那句故意的 `& powershell`——它是跨版本验证入口，且不产出入库文件；
  `tests/test-vibe-hook-adapter.ps1:33` 的「有 pwsh 用 pwsh、否则退回 powershell」同理保留。
- 不在本仓库 `agents.md` 复写这条规矩：owner 是生成器里的那道闸门（能机器判的写成检查，不写成条文），
  再加一份文字就是双真源。
- 不加体积/行数上限，改判结构（理由见「门禁侧」小节）。
- 不动 `provenance/` 任何登记内容：本批未新增技能、未改分类，故无需重生成 catalog 与能力索引。

## 终局补记（14:03 实测）

- 上面那条未登记账由它自己的 owner 收口了（`provenance/PROVENANCE-INTEGRITY.json` 的 sliver-core 树摘要 `75eb2715 → 35a40ec4`、
  `provenance/LOCAL-PATCHES.json` 新增 `sliver-execution-loading-budget-raise`、新证据 `evidence/20260928-loading-budget-and-eol-root-cause.md`）后，
  14:03 重跑 `pwsh -NoProfile -File scripts/verify.ps1 -RepositoryRoot .` → **`verify: 21/21 steps passed`，退出码 0，`all gates passed`**。
- 这一轮不再是「本批自身绿」，而是**整棵工作树（两批改动并存）绿**。本批判据在其中的实测输出：
  `入库生成物为 pwsh 7 排版 — files = 2 (2-space indent)`；末步自计 `default = 21 steps`（与 README 徽章、正文两处一致）；
  数字对账 `claims = 66 records = 82 runtime = 52 bundle = 451 installed = 453`。
- 13:54 那轮的判红因此闭环：红项（未登记树摘要）被其 owner 如实登记，不是被绕过或放宽。
  两轮都留档——13:54 是本批写完但未提交时的实况，14:03 是可作为提交基线的实况。
- 本批最后一次实弹复核（改完报错文案后）：`powershell -NoProfile -File scripts/build-skill-inventory.ps1 -TargetRoot . -SourceRootBase Z:\nope`
  → 退出码 **1**，原文「拒绝用 Windows PowerShell 5.1.19041.6456 生成入库镜像: 5.1 的 JSON 每层 4 空格缩进外加 3 字节 BOM……」，
  `provenance/SKILL-INVENTORY.json` 未被写入（`git status` 无该文件）。

## 本批文件清单（提交边界，供 owner 拆提时对照）


- 本批**独有**、不含他会话改动的文件：`scripts/build-canonical-catalog.ps1`、`scripts/build-skill-inventory.ps1`、
  `evidence/20260928-canonical-runtime-gate.md`。
- 与本批**同文件混排**、按路径整份提交会连带他会话工作的文件：`scripts/verify.ps1`（本批 1a + 他会话 1e）、
  `README.md`（本批 19→20 已被他会话续写为 21）、`docs/HANDOFF-NEXT.md`（同上，另含本批对 `:115` 的订正）。
- 明确**不属于**本批、须由对方登记树摘要后再提的文件：`governance/sliver-core/tests/execution-backbone-cases.json`。

