# 文档数字对账批：把「自称实测」的计数从人抄变成机器重算

- 时间：2026-09-28
- 基线 revision：`c6e0457`（改前 `verify.ps1` 默认档 **17/17 全绿**，该轮已打出 `runtime include 内容完整性 — files = 451`）
- 触发：owner 就「mattpocock/skills 还有什么可借鉴」发起，双子交叉复核（事实复核 / 反方质证）否掉了原建议的 PR 模板方案，同时指出一件更值钱的事——**同一个 bundle 数字在仓库里以四个值并存，没有一个程序知道当下真值**。上游 `retro` 技能那条「机械可查的一律写成确定性检查，不要写成条文」正是本批的实现口径。

## 问题实况（本批改前）

| 落点 | 原文写的 | 当下实测 | 状态 |
|---|---|---|---|
| `SKILL.md:19`（运行时入口，装到宿主上就是用户看到的现状） | 420 文件 | 451 | 过期，差 31 |
| `README.md:64` / `:72`（中英各一份） | 432 文件（自称「2026-09-18 门禁实测」） | 451 | 过期，差 19 |
| `docs/HANDOFF-NEXT.md:36` / `:40` / `:593` | 422 与 420（2026-09-12 口径） | 453 与 451 | 过期，差 31 |
| `docs/HANDOFF-NEXT.md:123-125` 投影落盘数 | 95 / 93 / 92 文件 | 456 / 454 / 453 | 过期约 5 倍 |
| `docs/HANDOFF-NEXT.md:20` / `:35` / `:115` 与 `README.md:74` / `:204`、徽章 `README.md:15` 的 verify 步数 | 15 / 17 并存 | 19（本批后） | 三处口径互不相同 |

同一族缺陷此前已靠人肉订正三次（`269bbd5`、`324715b`、`c6e0457`），`2026-09-25` 批的遗留项里就明写着「`verify.ps1` 若未来增删步骤，README 两处计数与徽章需同步」——即作者已知这笔债会复发，只是没有机器去收。

## 真值口径（本批实测留档）

- `provenance/CANONICAL-CATALOG.json`（`generatedAt` 2026-09-24）：记录 **82** 条；按 `decisionPolicy.acceptedStatuses` 命中 **52** 条 = 控制面 1 + Matt 13 + Vibe 38；退役 **23** 条、排除/兼容 **7** 条（excluded 6 + compatibility 1）。
- 同上的 bundle 逐文件条目 **451**，路径全局唯一（无重复）；按来源切：控制面 75 / Matt 24 / Vibe 352。
- 三个投影 Build + Validate 后落盘实测：Codex **456**、Claude **454**、宿主中性 **453**；关系成立 `453 = 451 bundle + 根入口 SKILL.md + shared-projection-manifest.json`（`fileCounts` 报 `copied=452, generated=1, total=453`）。
- 来源快照实测文件数（步骤 3 自证）：vibe 553 / matt 136 / sliver-core 220。

## 变更物

### 新步骤 6b「文档数字与实测一致」

- `scripts/verify.ps1`：从 catalog 现算记录数 / 已接入数 / 退役数 / 排除数 / bundle 文件数 / 各来源已接入数与各来源 bundle 数，配 **40 条锚点规则**（`$docNumberRules`，`scripts/verify.ps1:697-739` 实测计数）逐条比对 `README.md`（中英与徽章）、`SKILL.md`、`docs/HANDOFF-NEXT.md` 的登记数字，命中处共 **66 处断言**（`claims = 66`，取本次绿跑的实测输出）。
- **锚点未命中同样判失败**，不静默跳过：否则改一句文案就能把对账摘掉，等于把门留下框。捕获组数与预期不符也判失败（防正则写错却「通过」）。
- 消费两处已有实测而非另立口径：投影总数取自步骤 6 的 Validate 结果，快照文件数取自步骤 3 的 `Test-ProvenanceIntegrity`；任一方未通过时本步直接指名「先修它」，不给出看似通过的第二个数。
- 「控制面 1 + Matt 13 + Vibe 38」这类构成数一律算出来比对，不在检查器里写死——否则对账本身会变成第二个假数。
- 顺带在步骤 6 留存 `$projectionTotals`，不额外重跑投影。

### 新步骤 8「文档步数与实际步数一致」（末步自计）

- 步数是这批数字里唯一无法从 catalog 推出的：它只能由脚本自己数登记了几步。末步按「已登记步数 − 本次真跑过的可选步 + 本步自身」还原默认档步数，与 `README.md` 徽章和正文两处比对；带 `-IncludeHostEvidence` / `-IncludePackage` 跑时同一公式自动还原回默认档，不会误报。
- 从此增删门禁不再需要追着改徽章。

### 文档刷新

- `README.md`：`432 → 451`（中英 + 表格 + 徽章步数 `17 → 19`），并注明该数由本批门禁重算强制。
- `SKILL.md:19`：`420 → 451`。
- `docs/HANDOFF-NEXT.md`：`:36/:40/:593` 刷成 451 与 453（保留「两数并存不是漂移」的口径说明，补记历史值 420/422 与 432 已作废）；`:123-125` 投影数刷成实测 456/454/453；`:20/:35/:115` 步数口径统一为默认 19 / 全开 21，并保留 12/13/15/17 为历史口径的说明。
- `docs/HANDOFF-NEXT.md:33` 隐私口径更正：远端原记 **private**，经 `gh repo view` 核实为 **PUBLIC**。仓库公开，写入前按公开仓库标准自查——这条与本批同族（文档说的与实际不一致），但严重度更高，故同批修掉而非留账。
- `scripts/verify.ps1` 头注覆盖清单同步（该文件自己的注释也写着「对账勿依赖本文数字」，与此处口径一致）。

## 实弹验证

- 反例一（写错数）：把 `README.md` 的 bundle 数改成 461 → `[FAIL] 文档数字与实测一致 — README.md 登记=461 实测=451 处: | Runtime bundle | 461 文件`，`verify: 18/19`，退出码 **1**。
- 反例二（摘锚点）：把 `SKILL.md:19` 的「82 条来源技能已登记」改写为「已完成登记」→ `[FAIL] … SKILL.md 锚点未命中（文案被改写请同步本步锚点）`，两处锚点同时点名（含被连带破坏的第二条规则），退出码 **1**。
- 还原后终局：`verify.ps1` 默认档 **19/19 全绿**，本批两步输出为 `claims = 66 records = 82 runtime = 52 bundle = 451 installed = 453` 与 `default = 19 steps`，退出码 0。
- 中途一次真实拦截：本批第一版正则把 `/**23 条 retired**/` 写成 `/(\d+) 条 retired/`，门禁直接报「锚点未命中」并指名文件——即它对本批自己的错误同样不留情面。
- 未跑档：`-IncludeHostEvidence`（依赖本机宿主安装态）与 `-IncludePackage` 本批未跑；CI 跑的是默认档，与本文终局口径一致。

## 明确不做

- **不引入上游 `pr` / `retro` / `implement-spec` 本体**：三者**不在 `sources/mattpocock-skills/` 快照内**，且上游自己也把它们放在 `skills/in-progress/` 下（作者标注未完成）。快照缺口实测（2026-09-28 重跑 `gh api .../git/trees/HEAD?recursive=1` 与本地逐路径 `comm` 对账）：上游 169 个 blob / 快照 136 个文件；36 条上游路径在快照里无同名路径，其中 `.agents/adr/0001-...`、`.agents/invocation.md` 两条快照里改放在 `docs/` 下（路径重排，不是缺内容），**真正缺的 34 个文件**为 `skills/in-progress/` 三技能 7 个文件、`.changeset/` 13、`.agents/` 另 3（`install-block.md`、`writing-docs.md`、`adr/0002-ship-as-a-claude-code-plugin.md`）、`scripts/` 3（含 `sync-plugin-version.mjs`）、`.out-of-scope/` 3、`package.json`、`package-lock.json`、`CHANGELOG.md`、`.gitignore`、`.github/workflows/release.yml`。快照另有 3 条上游无同名文件的路径：`LICENSE.zh-CN.md`（自有译本）与上述 2 条重排。按 `AGENTS.md` 迁移规则「未通过来源/许可证/revision/调用类型与运行时门禁不迁移内容」，要用就先重跑一次快照采集与哈希登记，那是独立一批。
  - 订正：本条初稿写「快照还缺上游 37 个文件」，是把路径重排当成了缺内容、且没实测就落数——正是本批门禁要拦的那类错。留此记录以说明检查口径。
- **不加 PR 正文模板**：改动说明与证据配对的 owner 已在 `governance/sliver-core/references/git-and-delivery.md`（Commit Readiness / Delivery Evidence），合并危险度字段已在 `effect-recovery-gates.md`（`maximum_blast_radius` / `code_reversal` / `remaining_risk`）；且本仓单人直推 main、PR 列表为空，模板永不渲染，也不进 bundle。再加一份即 `AGENTS.md` 验收规则要拦的重复入口。
- **不动 `skills/event/experience-elevator` 契约**：`retro` 那条「机械 vs 判断」二分若要落地，得给 L0 加标签并处理 `SKILL.md:50` 阈值线与 `:53` L3 注册证据的关系，属改契约，需 owner 拍板。本批只做了一条它的正确实现：能机器判的就去写检查。
- **不改 `provenance/CANONICAL-CATALOG.json`**：本批纯消费生成物，未新增或改动任何记录，故无需重生成 catalog 与能力索引（两者新鲜度步仍绿即证）。
- **不回改历史留账**：`evidence/` 与 `docs/archive/` 内的 401 / 422 / 432 等属当时口径，改它们等于伪造历史。

## 遗留

- `docs/HANDOFF-NEXT.md` 的步数（默认 19 / 全开 21）与宿主侧 `112 条`、README 的 `22 / 31 / 8` 路由数仍是人抄口径，本批未覆盖：前者只有 README 两处进了自计对账，后三者的真值需要另立 owner 或扩锚点。
- 6b 的锚点是正则，改写被登记的那句话就会撞墙——这是**有意**的失败（提示同步），不是缺陷；但意味着以后改这几行文案必须同时改 `scripts/verify.ps1` 的规则表。
- 反例只验到「文档与生成物不一致」这一类；若 catalog 本身与 `SKILL-CLASSIFICATION.json` 一起被同时改错（两级同源漂移），6b 会跟着一起「一致地错」——该风险由步骤 1 的语义比对与步骤 1b 的逐文件 sha256 承担，不在本步职责内。
- CI 侧无需改动：默认档即包含本批两步，push 后 `release-gate.yml` 自动执行。
