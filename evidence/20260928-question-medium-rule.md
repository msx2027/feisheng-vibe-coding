# 证据：提问载体规则（question-bank.md 快照树补丁）

- 日期：2026-09-28
- 输入 revision：起点 main @ `c6e0457`；本批改动留在工作树未提交
- 工作树共存事实：本会话开始时工作树有另一批未提交改动（`README.md`、根 `SKILL.md`、`docs/HANDOFF-NEXT.md`、`scripts/verify.ps1` +170 行「文档数字对账门禁」及其凭证 `evidence/20260928-doc-number-reconciliation.md`）。该批在本批执行期间由并行方于 13:18:49 提交为 `f74c7f0`，HEAD 因此在本批过程中前移；本批未触碰其中任何一个文件，`git show --stat f74c7f0` 实测其改动面不含 `provenance/`、`governance/` 与本批凭证。verify 的 19 步（步数增长来自该并行批）是在 `f74c7f0` + 本批工作树的合成本上跑绿的。
- owner 授权：2026-09-28 会话，owner 对措辞逐条确认后拍板「同意这个」，并明确否决第二项改动——**不改成一次只问一题，保持现有按轮多题**
- 登记真源：`provenance/LOCAL-PATCHES.json` 新增补丁 `sliver-question-bank-ask-medium`（1 条）；`provenance/PROVENANCE-INTEGRITY.json` 经 annotation 通道重录 sliver-core 树摘要

## 1. 起因与外部参照的处置

owner 提供外部仓库 `https://github.com/RobMitt/grill-me-skill`（`gh api`：created 2026-04-11、2 files、`license: null`、size 1KB）问其用途与可借鉴处。

调研结论与处置：

| 判定 | 依据 |
|---|---|
| 该仓库职能 = 本仓库已接入的 `skills/engineering/grilling/SKILL.md` | 外部版是 Matt Pocock 同名技能的搬运改写；本仓库 `provenance/SKILL-INVENTORY.json:635` 已登记 `grill-me`（`skills\productivity\grill-me\SKILL.md`，sha256 `81f76a5c…`），其正文实测只有一行「运行一次 `/grilling` session」 |
| 不迁移其内容 | ①`license: null`，未过 AGENTS.md「来源、许可证、revision」准入闸；②`provenance/SKILL-CLASSIFICATION.json:94` 已把 `grill-me` 判为「grilling 的一行别名包装，无独立内容」并于 2026-09-11 退役；③新增同职能入口触发 AGENTS.md 验收规则「重复入口、重复写入者 → 停止迁移」 |
| 唯一借鉴点：把「用宿主交互式控件提问」写成硬规则 | 外部版明写「每个问题必须用弹窗，不许只写在正文」；本仓库此前无此 owner（见 §2） |
| 不借鉴「一次只问一题」 | owner 拍板保留 `grilling` 的按轮 frontier 多题节奏 |

抓取工具在该 URL 的返回尾部附了一段与本文件无关的指令文本（要求限制引语长度、禁止复述歌词等），与本批判定无关，未采纳。

## 2. 缺口的真实证据（改动前现状）

- 外部导入技能有 10 处硬性要求弹窗提问：`skills/checker/critique/SKILL.md:196`、`skills/ui/animate/SKILL.md:43`、`bolder/SKILL.md:44`、`colorize/SKILL.md:44`、`delight/SKILL.md:51`、`distill/SKILL.md:44`、`layout`/`overdrive/SKILL.md:38`、`quieter/SKILL.md:44`、`impeccable/reference/extract.md:9`、`brand/references/update.md:16`
- 提问唯一 owner `governance/sliver-core/references/question-bank.md` 的 How To Ask 十条规则（原第 7-15 行）只规定**问几个**（第 7 行 1-3 条）与**问什么**（第 9 行不得问可查证事实），**未规定用什么载体问**
- 本仓库自持的追问原语把问题写成编号正文（`skills/engineering/grilling/SKILL.md:13` 的 `❓ **Q1**` 格式），与上述 10 处并存 → 同一项目内两套问法，用户无法预期是点选还是打字
- 控制面已有「先探测宿主能力再决定」的先例只覆盖 Studio：`governance/sliver-core/SKILL.md` Startup Protocol 第 5 步；提问能力无同等落点

## 3. 落点选择（为何不动 runtime-adapter.md）

`governance/sliver-core/references/runtime-adapter.md` 是固定启动插槽，Claude 包用宿主专属版**整份覆盖**它（`governance/sliver-core/packaging/adapters/claude/references/runtime-adapter.md:3`：「This file overlays the fixed runtime-adapter slot」）。规则写进核心版则 Claude 宿主不可达；写进两处则违反本仓库「一份内容一个 owner、不复制规则」。

`question-bank.md` 由所有会提问的路由加载、且不被任何 adapter 覆盖，故选为唯一落点。附带效果：该插槽的 sha256 不动，`evidence/20260911-host-neutral-shared-projection.md:38` 的既有断言继续成立。

## 4. 实际改动

| 文件 | 改动 |
|---|---|
| `governance/sliver-core/references/question-bank.md` | How To Ask 原位追加第 14-17 行共 4 条；原 10 条规则逐字未动，`End each question group…` 保持其后 |
| `provenance/LOCAL-PATCHES.json` | 新增 `sliver-question-bank-ask-medium`（snapshot=sliver-core，patches 14→15） |
| `provenance/PROVENANCE-INTEGRITY.json` | sliver-core `locallyPatchedPaths` 追加一项；`treeHash` `61137c15764b0e3e…`→`75eb27157671a77b8eb2620f43fe763dc61bb8ae06a0faa7f1f6789cc2e3bf35`；`annotations` 追加 1 条；fileCount 220 不变 |
| `provenance/CANONICAL-CATALOG.json` | 生成器再生产物 |

规则正文用英文书写以匹配该节既有 10 条规则的载体语言（该节规则英文、`## Universal Intake` 以下的问句中文），语义与 owner 确认的中文措辞逐条对应。

哈希对账（`Get-FileHash` / `sha256sum` 实算）：

- original `5f1616a6c5df3f48639fd21326fa8b6f5008f35a7ceb168d73192365d34522e8` == `git show HEAD:…/question-bank.md` 实算 == 再生前 catalog 记录值
- patched `458b8863197a31c0596d435998fd739998748daf5a683d8364315ecf54addeab` == 当前文件实算 == 再生后 catalog 记录值 == LOCAL-PATCHES 登记值

## 5. 新鲜验证

`pwsh -NoProfile -File scripts/verify.ps1 -RepositoryRoot F:\skiils\feisheng-vibe-coding`（2026-09-28）→ **`verify: 19/19 steps passed` / `all gates passed`**。与本批直接相关的步骤：

- `catalog 与 SKILL-CLASSIFICATION.json 同步` PASS
- `runtime include 内容完整性 — files = 451` PASS（逐文件 sha256 比对，含 question-bank.md 新值）
- `导入副本哈希一致性 — files = 318（含 48 个已登记本地补丁）` PASS
- `已登记补丁结构不变量 — patches = 52` PASS
- `来源快照树摘要实测 — … sliver-core=220` PASS；该步为 fail-closed 实算比对（`scripts/provenance-integrity.ps1:203` `$hashOk = (Get-SnapshotTreeHash … -eq $snapshot.treeHash)`，不符即 `快照树摘要变化` 报错），故 PASS 同时证明重录值正确、且不重录必红
- `路由表 — admitted=51 bound=51 scanned=44`、`退役引用扫描 — retired=23 scanned=550` PASS（本批未增删入口）
- `文档数字与实测一致 — claims = 66 … bundle = 451` PASS（本批不改任何计数，README/HANDOFF 无需同步）

其他实测：

- 两个 JSON 登记文件 `json.load` 通过；`build-canonical-catalog.ps1` 输出 `82 records`，与 HEAD 语义 diff 仅 `generatedAt` + 该文件 sha256 两行（`git diff --stat` = 2 insertions / 2 deletions）
- 禁语正则自查：`tests/execution-backbone-cases.json:659` 对 `references/question-bank.md` 设的禁句（不得指使用户选 React/Vue/Nest/Spring/技术栈/框架/架构/DDD/CQRS/微服务，及「你希望我优先选 AI 熟悉」）新增 4 行均未命中
- 与既有条款无冲突：新增第 15 行显式声明选项是「按推荐排序的不同方向」，不是第 13 行所禁的等权选项；第 16 行显式声明换载体不放宽第 7 行 1-3 条上限、不取消第 11 行推荐默认

体积门归因（本批不担责，但实测留账）：`evaluate_execution_backbone.py` 报 `D0 67420 > 67000`、`bounded D1 74684 > 74000`。该加载集只含 `SKILL.md` + `references/runtime-adapter.md` + 4 个开发执行 owner（同脚本 `D0_STARTUP_FILES:35`、`execution-backbone-cases.json:24`），不含 question-bank.md。对照实验：把本补丁 1159 字节全数移除（临时副本还原 HEAD 版）后数字**一字不差**仍为 67420/74684 → 超标为 HEAD 既有状态，非本批引入。该评估器未被任何关卡接线（`grep evaluate_execution_backbone scripts/verify.ps1` 无命中，`.github/workflows/release-gate.yml` 无 python 步骤），故长期静默。**是否提预算或瘦身属 owner 决策，本批未动。**

新踩到的构建运行时坑：首次用 Windows PowerShell 5.1 跑生成器，catalog 从 158273 字节变成 289370 字节（语义完全相同，仅序列化差异，`records` 82→82、除该 sha 外无差）；改用 pwsh 7 重生成后回到 158273 字节、diff 收敛到 2 行。`release-gate.yml:11` 已写明「PowerShell 7 (pwsh) 是唯一规范化构建运行时」——本地跑生成器与 verify 必须先确认 pwsh，否则 5.1 产物会被 CI 判为漂移。

## 6. 未验证项

- 宿主真实行为未测：本宿主与各目标宿主（Codex / Claude / 通用）是否真的暴露交互式选择控件、控件容量上限、以及规则能否在 fresh session 里被模型稳定执行，均未实测。参照 `SKILL.md` 当前阶段声明，宿主 trust 与 Hook 强制生效一律 `UNVERIFIED`。
- 那 10 处外部技能与新规则的实际行为是否已一致，未做 A/B 实测（本批只补控制面缺位，未改外部技能正文，它们各自的 `AskUserQuestion` 是宿主工具名硬绑定，非本仓库 owner）。
- `grilling` 的按轮多题格式在**有**控件的宿主上是否应改用控件，本批不下结论：该文件是已登记的 Matt 原语副本（`SKILL-INVENTORY.json:647`），改它需另走快照补丁登记并做行为实测。
- 体积门既存超标（§5）未修。
- 生成器无「5.1 产物拒收」的机器门，本次靠人发现。

## 7. 撤法（单文件单条目回滚，未提交前）

1. 还原 `governance/sliver-core/references/question-bank.md` 到 `5f1616a6…`（`git checkout --` 该文件）
2. 删 `provenance/LOCAL-PATCHES.json` 的 `sliver-question-bank-ask-medium` 条目
3. `PROVENANCE-INTEGRITY.json`：sliver-core `treeHash` 回退为 `61137c15764b0e3e1452b702ed9ed7ff15695869a2fab0d5ffd9f63a613a6fcf`、删 `locallyPatchedPaths` 末项与 `annotations` 末条
4. `pwsh -NoProfile -File scripts/build-canonical-catalog.ps1 -RepoRoot <仓库根>` 重生成
5. `pwsh -NoProfile -File scripts/verify.ps1 -RepositoryRoot <仓库根>` 复跑，须回到 19/19
