# Task 20260910-line-ending-reproducibility

状态：open（本轮只做取证与登记，未修）

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

1. 仓库**没有** `.gitattributes`（`git check-attr` 无属性、`git ls-files --eol` 的 `attr/` 为空），
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

- `git clone` 到**新目录**后 `pwsh scripts/verify.ps1 -IncludePackage` 全绿（这是本轮缺失的验收）。
- `git ls-files --eol` 对上述树显示 `w/` 与来源字节一致，且 `git status` 在 clone 后为空。
- 不得放宽任何完整性门禁（不允许把 sha 比对改成 eol 归一化）——必须让字节本身可复现。
- 若发现某来源项目本身字节不稳定（例如 Matt 有未提交改动），先登记到 `provenance/LOCAL-PATCHES.json` 再继续。

## 风险与注意

- 这是**大范围一次性规范化**：约 909 个快照文件 + 已导入副本的 blob 会全部改变，diff 很大但内容等价（只改换行）。
- 必须在**同一次提交**里完成 `.gitattributes` + 重新 add + 重算基线；分步提交会让中间态门禁变红。
- 不要用 `git add --renormalize` 代替：它会把所有内容收敛成 LF，与「来源是 CRLF」的 Matt/Sliver 相反。
- 参考仓库既有踩坑记录：`core.autocrlf=true` 会让提交改写工作树换行，提交后必须重跑 verify。
