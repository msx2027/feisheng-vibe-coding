# Task 20260910-line-ending-reproducibility

状态：accepted（主 Agent 本地复验 + fresh clone × 三种 autocrlf 配置验收）

## 背景（可复现的实测）

```
git clone <repo> /tmp/feisheng-head        # 全新 clone，继承本机 core.autocrlf=true
cd /tmp/feisheng-head
pwsh scripts/verify.ps1
→ [FAIL] 来源快照完整性
   树摘要变化: vibe-coding-skills 记录=sha256:d22a304c… 实际=sha256:c5d3f7d3…
   快照与来源不一致: vibe-coding-skills 共 492 个文件 content-vs-source
```
该结果在**本批改动之前的 HEAD（591710a）** 上即复现，因此是既有缺陷，不是本轮引入。

## 唯一目标

让「逐字节一致的来源快照」这一核心主张在**任何机器、任何 clone** 上可复现：
提交到仓库的字节 == 来源项目字节 == 记录在 `PROVENANCE-INTEGRITY.json` / catalog 里的 sha。

## 根因

1. 仓库**没有** `.gitattributes`（`git ls-files --eol` 的 `attr/` 列为空），
   换行行为完全由使用者本地的 `core.autocrlf` 决定 —— 本机为 `true`。
2. 因此 git 索引里保存的是**规范化后的 LF** blob，而：
   - `provenance/PROVENANCE-INTEGRITY.json` 的 `treeHash` 与逐文件 sha 是在**工作树字节**上算的；
   - Matt 快照按设计是 CRLF（导入时 `-NormalizeCrlf`），Vibe 快照是 LF（来源项目就是 LF）；
   - catalog 的 `sourceSha256` 同样来自工作树字节。
3. fresh clone 时工作树被 materialize 成 CRLF ⇒ 与 LF 来源不一致 ⇒ 完整性门禁失败。
   `scripts/verify.ps1` 的 `runtime include 内容完整性` 与 `导入副本与快照一致性` 中，
   前者同样受影响，后者刻意设计为不受影响（同一工作树内两侧受同样变换）。

## 允许写入（建议范围）

- 新增 `.gitattributes`，对必须逐字节保真的树声明不转换：`sources/** -text`、`skills/** -text`、
  `governance/sliver-core/** -text`（并复核 `scripts/**` 的 BOM 是否仍被保留）。
- 按来源字节重新提交上述树的 blob（Matt / Sliver 侧需要 blob 内就是 CRLF；Vibe 侧是 LF）。
- 重算并更新 `provenance/PROVENANCE-INTEGRITY.json`（`record-provenance-integrity.ps1`）。
- 重生成受影响生成物与 `provenance/SKILL-INVENTORY.json`（sha 语义若变化需同步）。
- 新证据文件 + 本任务包。

## 验收与停止条件

- `git clone` 到**新目录**后 `pwsh scripts/verify.ps1 -IncludePackage` 全绿（这是修复前缺失的验收）。
- `git ls-files --eol` 对上述树显示属性为 `-text` 且 `i/` 与 `w/` 相同（索引 blob == 工作树字节）。
- 不得放宽任何完整性门禁（不允许把 sha 比对改成 eol 归一化）——必须让字节本身可复现。
- 若发现某来源项目本身字节不稳定（例如 Matt 有未提交改动），先登记到 `provenance/LOCAL-PATCHES.json` 再继续。

## 主 Agent 验收记录

- 验收时间：2026-09-10；提交 `8e30d2f`（修复）、`00451d6`（防回归门禁）。
- 等价性证明（三个保真树内全部 1274 个文件）：工作树字节未变 1274/1274；索引 blob == 工作树 1274/1274；
  新旧 blob 归一化后相同 1274/1274；blob 实际变化 383；除换行外内容不同 0。
  即改的只是换行表示，**无需重算任何已登记 sha**。
- fresh clone 验收（三种配置各 clone 一次，均含发布包装配）：`autocrlf=true` 11/11、`false` 11/11、`input` 11/11，
  clone 后 `git status` 均为干净；代表文件（vibe LF / matt CRLF / sliver CRLF / 导入副本）与来源逐字节相同。
- 对照：修复前同一提交的 fresh clone 为 8/10。
- 防回归门禁反例：删 `sources/** -text` → FAIL；把 matt 文件索引 blob 重新规范化成 LF → FAIL。
- 兼容性：`pwsh`（7）与 Windows PowerShell 5.1 均为 11/11。
- 决定：本任务 accepted。见 `evidence/20260910-line-ending-reproducibility.md`。
- 遗留：未在真实 GitHub runner 跑过 CI；未改生成器的写入换行（生成物仍是 mixed 换行，但门禁做归一化比较，无影响）。

## 风险与注意

- 这是**大范围一次性规范化**：约 909 个快照文件 + 已导入副本的 blob 会全部改变，diff 很大但内容等价（只改换行）。
- 必须在**同一次提交**里完成 `.gitattributes` + 重新 add + 重算基线；分步提交会让中间态门禁变红。
- 不要用 `git add --renormalize` 代替：它会把所有内容收敛成 LF，与「来源是 CRLF」的 Matt/Sliver 相反。
- 参考仓库既有踩坑记录：`core.autocrlf=true` 会让提交改写工作树换行，提交后必须重跑 verify。
