# 解除 Matt 四项阻塞：canonical 命名由本仓库决定 + 采用已提交 revision 内容

日期：2026-09-10
触发：用户指出「为什么要等上游确认改名？命名我们自己的不能定吗？」——该质疑成立，原阻塞把两件事混为一谈。
关联任务包：tasks/20260910-matt-canonical-naming.md（accepted）

## 一、原阻塞错在哪里（承认并更正）

原阻塞表述为「上游未提交改名未确认 → 四项保持 blocked」。这里混了两件不同的事：

| 事项 | 是否可以自行决定 | 说明 |
|---|---|---|
| **canonical 命名/id** | ✅ 完全可以 | 这是本仓库自己的决策真源（`SKILL-CLASSIFICATION.json`）。上游怎么叫不影响我们怎么叫；本仓库本就已有 `vibe-code-review` 与 `code-review` 并存的前缀命名方案。 |
| **是否采用未提交的工作树内容** | ❌ 不可以 | 未提交改动的意图不可证（该改名只改了 frontmatter 与 3 处调用方，`plugin.json` / `marketplace.json` 未同步）。采用它等于把一个内部不一致的产物当事实。 |

**并且发现一个真实数据缺陷**：原导入器对「工作树已改动」的文件直接 **删除**，导致 4 条 catalog 记录
（`ask-matt`、`code-review`、`implement`、`tdd`）**指向不存在的文件**。即：既没采用工作树内容，也没取已提交内容，
而是把它丢掉了。

## 二、正确做法

**取已提交 revision 的内容 + 命名由本仓库决定。**

1. **字节安全地从 git 取已提交 blob**：不能用 PowerShell 管道接 git 原生输出（会被当文本行处理，破坏字节与换行），
   改为 `ProcessStartInfo` + `RedirectStandardOutput` 读字节流（`Export-GitBlobToFile`）。
2. **换行约定**：源仓库 `core.autocrlf=true`，所以 git blob 存 LF、工作树与快照为 CRLF。
   先实测模型再落代码：对 6 个未改动文件抽样，**`blob 经 LF->CRLF 归一化后 == 源工作树`（6/6 逐字节相等）**。
   据此对取出的 blob 应用 `-NormalizeCrlf`，使快照内换行约定一致——这同时是**可复现**的必要条件
   （否则在 autocrlf 下同一文件会在 checkout 时被改回 CRLF，导致记录的哈希不可复现）。
3. **记录可复现的 provenance**：`MATT-IMPORT.json` 新增 `committedRevisionFiles`
   （每项含 `path` / `revision` / `blobSha256` / `snapshotSha256` / `normalization`），并把
   `migration` 改为 `dirty-working-tree-content-not-adopted; committed-revision-content-used`。

### 实测记录

| 文件 | 归一化 | blob sha256 | 快照 sha256 |
|---|---|---|---|
| `skills/engineering/ask-matt/SKILL.md` | lf-to-crlf | `007dd67edb52…` | `63a335a64eea…` |
| `skills/engineering/code-review/SKILL.md` | lf-to-crlf | `36ef136c3863…` | `44ef0f3afc5c…` |
| `skills/engineering/implement/SKILL.md` | lf-to-crlf | `9486ad4ebc36…` | `f4010e6a7fc9…` |
| `skills/engineering/tdd/SKILL.md` | lf-to-crlf | `a36a6860bb0e…` | `c675017606d3…` |

导入结果：快照 132 → **136** 文件（仅新增这 4 个，无丢失）；4 个文件的 frontmatter 是**已提交**名
（`name: code-review` / `tdd` / `implement` / `ask-matt`），**不是**工作树里的 `mattpocock-code-review`。

## 三、连带必须修的地方（否则会引入新漂移）

| 位置 | 问题 | 处理 |
|---|---|---|
| `provenance-integrity.ps1` / 记录器 | 这 4 个文件与工作树**有意**不同，会被来源比对误报为漂移 | 新增 `revisionSourcedPaths`：与记录的 `sha256` 比对，**跳过**工作树比对；校验器新增 `revisionSourcedCheckedFiles` |
| `build-skill-inventory.ps1` | 它读**来源工作树**，于是把这 4 个文件的脏哈希与脏 `name` 写进事实快照（`code-review` 的 canonicalCandidate 变成 `mattpocock-code-review`，会让 catalog id 漂移） | 对 revision 来源路径改为**从快照读取**（快照里就是已采纳内容）。重生成后仅 5 处预期变化：4 个 sha256 + `code-review` 的 name 回到 `code-review` |
| `runtime-projection-guard.ps1` | 硬编码 `requiredBlockedIds = @('code-review','tdd')` ——一条**写在代码里的分类判断** | 删除；保留通用规则「`blocked-*` 一律不得进入投影」。分类改由数据 + 证据驱动 |
| `build-capability-index.ps1` | `blocked` 集合变空后，Mandatory 数组参数 binds 空数组报错；空「阻塞」段渲染成空表 | 参数加 `[AllowEmptyCollection()]`；空段落渲染为「当前无阻塞项」并说明原因 |

## 四、分类变更（数据编辑，非代码）

| id | 原状态 | 新状态 | 依据 |
|---|---|---|---|
| `tdd` | `blocked-unclassified-working-tree` | `source-only-primitive`（primitive/source-only） | 内容取自已提交 revision；`bench` 语义（SKILL-DECISIONS 列为工程 primitive）；待宿主行为 smoke |
| `code-review` | `blocked-unclassified-working-tree` | `source-only-checker`（checker/source-only） | 同上；Sliver 拥有验收门（review-and-test 组 owner） |

并新增 `canonicalNamingPolicy` 到分类真源：
> canonical id 由本仓库决定。上游未提交的工作树改名只作为事实记录，不采用、也不等待上游确认；
> 不采用工作树内容是因为其意图不可证，而不是因为命名冲突。

**结果：catalog 中 `blocked` 记录数 = 0。** 上游那个未提交改名仍被记录在 `reasonsById` 里（作为事实）。

## 五、验证

```text
82 条记录：missing paths = 0，sha mismatches = 0        （此前 4 条路径不存在）
pwsh 7            : verify 8/8 passed（含打包）
Windows PS 5.1    : verify 7/7 passed
来源快照完整性     : vibe=550, matt=136, sliver=223；754 逐字节 + 4 按记录 revision + 151 白名单
```

**反例**（篡改一个 revision 来源文件 `tdd/SKILL.md`）：校验器报
`skills/engineering/tdd/SKILL.md (content-vs-recorded-revision)`，`ok=False`；用同一机制
（`Export-GitBlobToFile -NormalizeCrlf`）还原后 sha256 回到 `c675017606d3…`，与记录一致。

## 六、实现过程中发现并修掉的 bug

1. `[ordered]@{}`（`OrderedDictionary`）没有 `ContainsKey` 方法 → 改用普通哈希表。
2. 我一度用 `Sort-Object -Property @{Expression=…}` 排序 → **又是 culture 排序**（本轮第三次踩）；
   改为共享的 `Sort-StringsOrdinal`（`StringComparer.Ordinal`）。
3. 空数组绑定 Mandatory 参数报错 → `[AllowEmptyCollection()]`。
4. `MemoryStream` 在 `finally` 里先释放、之后才 `ToArray()` → 先取字节再释放。

## 七、未验证项与后续

- **上游仍在改名的中间状态**：本地/远程 HEAD 均为 `9fe7e7a3`、0 开放 PR。若上游日后**提交**该改名，
  我们的快照相对上游方向就"旧"了——这不是阻塞，而是一次**有意的重新导入**事件（复核后再决定是否跟进命名）。
  建议保留周期性上游复核，但不再作为任何技能的 blocked 理由。
- 4 个文件未经宿主行为 smoke（与其它 source-only 技能同状态）。
- 我们**没有**修改上游工作树，也**没有**采用其未提交内容。
