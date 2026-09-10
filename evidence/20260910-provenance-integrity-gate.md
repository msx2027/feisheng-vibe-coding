# 来源快照完整性门禁（provenance integrity）

日期：2026-09-10
目标：把「快照未被篡改 / 与来源一致」从**一次性审计结论**变成**每次运行的强制属性**。
关联任务包：tasks/20260910-provenance-integrity-gate.md（accepted）

## 一、为什么做这个（第一性判断）

这个仓库的核心承诺是「可审计的来源追溯」，而支撑它的最强证据
（`evidence/20260910-vibe-snapshot-closure.md` 的 550/550 SHA、`SLIVER-IMPORT` / `MATT-IMPORT` 的导入记录）
**只在一次性文档里断言过，没有任何可重复的校验**。也就是说：

> 「生成镜像不得手工修改」「三个来源仓库必须保持不被修改」这两条硬规则，此前只有自律，没有强制。

后果是真实的：任何一次对 `sources/` 的手工改动、任何一次 `git` 的换行符归一化、
或来源仓库被改动后的继续使用，都不会被发现，而仓库仍自称来源可追溯。

## 二、先测量，再落规则

设计任何不变量前先测量现状（避免把假的前提写进代码）：

| 快照 | 文件数 | 与来源逐字节一致 | 来源缺失 | 内容不一致 |
|---|---|---|---|---|
| `sources/vibe-coding-skills` | 550 | 550 | 0 | 0 |
| `sources/mattpocock-skills` | 132 | 132 | 0 | 0 |
| `governance/sliver-core` | 223 | 223 | 0 | 0 |

同时确认来源状态与导入记录一致：Sliver `git clean @ 30c7cfb3…`、Matt `git modified = 恰好记录里的 4 个文件 @ 9fe7e7a3…`、Vibe `not-a-git-checkout`。

结论：可用最强不变量 —— **快照每个文件必须与来源同路径文件逐字节一致**（或在记录的补充白名单内）。

## 三、实现（两层 + 单一实现 + fail-closed）

新增共享模块 `scripts/provenance-integrity.ps1`（被记录器与 `verify.ps1` 共同点源，禁止平行实现）：

| 层 | 内容 | 是否依赖来源目录 |
|---|---|---|
| 自证 self-integrity | 重算快照树摘要并与 `PROVENANCE-INTEGRITY.json` 记录比对；文件数比对 | 否（CI 可用） |
| 交叉校验 source comparison | 每个快照文件与来源同路径文件逐字节比对；白名单内的跳过；输出**具体漂移路径** | 是（来源在本地时） |

树摘要算法（`sha256-lines-v1`，写入记录并跨版本确定）：
每个文件一行 `相对路径` + LF + `文件SHA-256`；按 **Ordinal** 排序路径；以 LF 连接并追加结尾 LF；
对 UTF-8（无 BOM）字节求 SHA-256。

新增基线记录器 `scripts/record-provenance-integrity.ps1`（唯一「锁定基线」入口，**fail-closed**）：
只有在 ① 逐字节来源比对通过、② 来源 git 状态与导入记录一致（HEAD == sourceRevision；脏文件集合 == 记录）、
③ 快照文件集合与导入白名单一致 时才写基线。理由：**基线必须被独立证据背书**，不能把现状直接当真源。

快照清单从已有导入记录（`VIBE-IMPORT` / `MATT-IMPORT` / `SLIVER-IMPORT`）派生，**不新增分类真源**。

### 记录的基线

```json
{"vibe-coding-skills": {"files": 550, "treeHash": "sha256:7ed5f024007233341dfbdbaac2f49f27ca8193c57d7587ee053c16f504e753e0", "source": "not-a-git-checkout"},
 "mattpocock-skills": {"files": 132, "treeHash": "sha256:e4e2ceff8b031d210364ab7239c2f00fa0c0643a0756472ded6b9081a8343e42", "source": "git-modified-as-recorded"},
 "sliver-core":       {"files": 223, "treeHash": "sha256:1f0e7c44a7d93801e2f061e31d17960cdc66696bc4b6ad24ec6422669e99d696", "source": "git-clean"}}
```

记录时背书：**754 个文件逐字节经来源校验**，151 个文件落在 Sliver 补充白名单内。
写入 `provenance/PROVENANCE-INTEGRITY.json`。

## 四、接入与复验

`scripts/verify.ps1` 新增第 3 步「来源快照完整性」（在生成物新鲜度之后、NOTICE 门禁之前）：

```text
[PASS] catalog 与 SKILL-CLASSIFICATION.json 同步
[PASS] 能力索引新鲜度
[PASS] 来源快照完整性 — vibe-coding-skills=550, mattpocock-skills=132, sliver-core=223
[PASS] 发布 NOTICE 门禁 — runtime items = 5
[PASS] Vibe Hook 适配器保持禁用
[PASS] Codex 静态投影 Build + Validate
[PASS] Claude 静态投影 Build + Validate
verify: 7/7 steps passed          (pwsh 7；Windows PowerShell 5.1 同样 7/7)
```

跨版本确定性顺带被证明：树摘要在 pwsh 7 下记录、在 **Windows PowerShell 5.1** 下重算一致。

## 五、反例测试（证明门禁真的拦得住）

| 反例 | 注入 | 结果 |
|---|---|---|
| 快照被篡改 | 向 `sources/mattpocock-skills/README.md` 追加一行 | `verify.ps1` 失败并**指名路径**：`快照树摘要变化: mattpocock-skills …` + `快照与来源不一致: mattpocock-skills 共 1 个文件 → README.md (content-vs-source)`；`VERIFY_EXIT=1` |
| 试图把篡改后的现状写成基线 | 同一篡改下跑记录器 | 拒绝并 `PROCESS_EXIT=1`：`拒绝记录 provenance 基线（未通过来源背书）: … README.md (content-vs-source)` |
| 还原 | 从来源复制回该文件 | SHA 回到 `fb9eef1a…`；`verify.ps1` 7/7 通过；记录器 `EXIT=0` |

## 六、实现过程中发现并修掉的一个 bug

`Get-SourceDirtyPaths` 返回裸数组：**干净仓库的空数组被 PowerShell 解包成 `$null`**，与「不是 git 仓库」无法区分，
导致 Sliver（干净）被误判为 `not-a-git-checkout` 并触发 fail-closed。已改为返回对象
（`Get-SourceState` → `{ kind, dirtyPaths, revision }`），该类「空数组/单元素数组」陷阱在本轮出现两次
（另一次是能力索引的 `.Count`），后续新增函数一律避免从函数返回裸集合。

## 七、未验证项与限制

- 来源交叉校验只在来源目录存在时执行；CI（无 `F:\skiils工具\*` 来源）只跑自证层。这是设计选择：自证层能发现任何快照字节变化，来源层负责定位并证明「与来源一致」。
- Sliver 的补充白名单覆盖 223 个文件中的 151 个（`scripts`、`tests`、`.github/workflows`、`plugins` 等），
  这些文件不参与来源比对；其完整性仍由树摘要覆盖。收紧该白名单需要逐路径确认哪些是我们自有的补充件。
- `recordedAtRevision` 仅作信息记录，未做「是否为 HEAD 祖先」的校验。
- 未做（也不需要）：对来源仓库的写操作；全程只读来源。
