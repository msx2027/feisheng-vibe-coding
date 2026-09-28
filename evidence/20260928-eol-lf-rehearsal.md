# 换行符演练：把 governance/sliver-core 整树从 CRLF 改回 LF（只演练，未落地）

- 日期：2026-09-28
- 基线 revision：`7b75bc4`（已推送、CI 21/21 绿的那一批）
- 结论：**在隔离副本里全流程跑通，门禁 21 步全绿；真树一个字节没动。**
- owner 决定：本轮「先只演练，不落地」，本报告是给决定用的数字，不是变更记录。

## 1. 为什么要算这笔账

`governance/sliver-core/` 这 220 个文件在仓库里是「保真快照」：仓库靠逐文件哈希和整树哈希证明它们没被改过。
2026-09-11 导入时它们落盘是 CRLF（Windows 换行），2026-09-25 那批给保真树加了 `-text` 属性并把当时的工作树字节冻结进 git 对象，于是 CRLF 从此就是仓库里的唯一形态。

代价有两处，都被实测抓到：

1. 控制面加载体积超标（`evidence/20260928-loading-budget-and-eol-root-cause.md`）——同一份内容，Windows 换行比 Unix 换行每行多 1 个字节，D0 因此从预算内涨到预算外，只能靠上调预算盖住。
2. 这棵树自带的 110 条 Python 契约测试红了一大片，红的原因是测试里的 fixture SHA-256 是 **LF 形态**的值（这些值是上游在自己还是 LF 的时候算出来的，是活跑证据的防篡改锚）。树是 CRLF，锚就对不上，套件就接不进任何关卡。

## 2. 演练怎么做的（可复现）

```powershell
# 全部在 %TEMP% 下的独立副本里做，真树只读
git clone --no-hardlinks F:/skiils/feisheng-vibe-coding <tmp>/repo        # 基线 7b75bc4
# 220 个文件逐字节剥离 CR（CRLF→LF），然后按仓库自己的记账流程改三份账本 + 重生成投影
pwsh -NoProfile -File <tmp>/repo/scripts/build-canonical-catalog.ps1 -RepoRoot <tmp>/repo
pwsh -NoProfile -File <tmp>/repo/scripts/verify.ps1 -RepositoryRoot <tmp>/repo
# A/B 用第二个未改动的克隆作对照组，两次都在 PYTHONUTF8=1 下跑同一套件
python3 -X utf8 -B -m unittest test_validation_contracts
```

对照参数：两侧都从同一个 `7b75bc4` 克隆，环境变量一致（`PYTHONUTF8=1 PYTHONIOENCODING=utf-8`），唯一差别是 220 个文件的换行。

## 3. 数字

### 3.1 体积

| | CRLF（HEAD 现状） | LF（演练） | 差 |
| --- | --- | --- | --- |
| 文件数 | 220 | 220 | 0 |
| 总字节 | 2,525,899 | 2,474,202 | −51,697（−2.05%） |
| CRLF 行数 | 51,697 | 0 | 省下的字节数正好等于 CRLF 行数（无孤 CR） |

220 个文件全部尺寸变化。219 个是纯换行转换（剥 CR 后与转换前逐字节相同）；第 220 个是 `tests/execution-backbone-cases.json`，它除了换行还带回了一个预算数字（见 3.3）。最大降幅：`tests/task-decision-cases.json` −2,708 字节、`tests/execution-backbone-cases.json` −2,477、`scripts/test_studio_live_contracts.py` −2,349、`scripts/test_validation_contracts.py` −2,292。最小：`VERSION` −1。

### 3.2 那 110 条契约测试

| 侧 | 跑 | 红 | 说明 |
| --- | --- | --- | --- |
| CRLF（对照） | 110 | **17** | 失败汇总 17 条，具名测试 16 个（其中 `test_synthetic_live_fixtures_require_existing_executable_workspaces` 内含子测试，计 2 次） |
| LF（演练） | 110 | **2** | 换行归一转绿 **14 个具名测试** |

残留 2 条红与换行无关，两条同因：`FAIL: trusted runtime baseline Git object is unavailable: 29695fe099c6b38c9b5c470abbb2e065fc1ff936`——可信运行时基线那个 git 对象随源项目删除而不可得（源项目目录与归档 zip 已按 owner 裁决清掉）。这 2 条落地 LF 也修不掉，所以「把 110 条套件接进 CI」这件事仍然被它挡住，本报告不能把它写成已解决。

订正：`evidence/20260928-loading-budget-and-eol-root-cause.md` 与 `provenance/LOCAL-PATCHES.json` 里写的「LF 红 3 / CRLF 红 18」是默认控制台（GBK）下测的，其中 1 条是控制台解码噪声不是真失败。UTF-8 环境下的正确数是 **LF 2 / CRLF 17**。这两处文字要随下一批补上环境口径。

### 3.3 加载体积预算

| 契约 | CRLF 实测 | LF 实测 | 上游原预算 | 结论 |
| --- | --- | --- | --- | --- |
| D0 | 67,420 | **66,839** | 67,000 | 回到预算内（余量 161）→ `d0_max_bytes` 撤销到 67000 |
| 有界 D1 | 74,684 | **74,049** | 74,000 | 仍超 49 字节 → `bounded_d1_max_bytes` **必须保持 75000** |

也就是说：换行归一只救得回 D0 那一半，D1 的 1,000 字节上调是真需求，两件事不能混着撤。

### 3.4 门禁

演练副本 `verify.ps1`：**21/21 全绿**。关键步：

- `保真树换行可复现性 — files = 1645 (-text，索引==工作树)` → 换成 LF 后这条依然绿（它只要求索引与工作树一致，不要求哪种换行）；`sources/**`、`skills/**` 保持原样、与 sliver-core 混着也没问题。
- `控制面静态契约评测 — ... UI_D0=66839 bytes, bounded_D1_UI=74049 bytes ...` → 1e 在预算回到 67000 后仍然通过。
- `导入副本与快照一致性 — files = 318（含 48 个已登记本地补丁）`、`已登记补丁结构不变量 — patches = 52`、`来源快照完整性 — sliver-core=220`、`文档数字与实测一致`、`文档步数与实际步数一致 — default = 21 steps` 全绿。

## 4. 落地要动的账（精确到字段）

单次提交会碰 **223 个文件**：220 个保真文件 + `PROVENANCE-INTEGRITY.json` + `LOCAL-PATCHES.json` + `CANONICAL-CATALOG.json`。

1. 220 个文件剥 CR，然后 `git add`（`-text` 下 blob 跟着工作树走，这是必须的收口动作）。
2. `provenance/PROVENANCE-INTEGRITY.json`
   - `snapshots[sliver-core].treeHash`：`sha256:35a40ec4b9aa0381…` → `sha256:f8f7a8171a30ddd3a74dfab5c1480cadee10eda4107c575a8af3dd3f07205269`（`fileCount` 220 不变）。
     注意踩过的坑：中途量到的是 `fb142a7d…`，那是**还没撤销 `d0_max_bytes` 时**的树；先做完全部文件内容改动、再算树哈希，否则第 10 步「来源快照完整性」会红。
   - `locallyPatchedPaths` 7 行的 `patchedSha256` 换成 LF 形态（见 §5）。
   - `annotations` 追加一条说明（换行归一、红数 17→2、D0 回 67000、D1 留 75000）。
3. `provenance/LOCAL-PATCHES.json`
   - `sliver-core` 命名空间 5 个条目、7 个文件：`patchedSha256` 全换 LF 形态；其中 4 个 `originalSha256` 在本仓库历史 blob 里能对上（`SKILL.md`、`references/engineering-execution.md`、`references/question-bank.md`、`tests/execution-backbone-cases.json`），同步换 LF 形态；3 个 `assets/*` 模板的 `originalSha256`（`dcc25ed5…`/`10821d1c…`/`7dac5bfa…`）在本仓库**全部历史 blob 里既无 CRLF 形态也无 LF 形态可匹配**，只能来自已删除的来源项目，**保持原值**。
   - `runtime-import` 命名空间 `sliver-core-skill-md-projected-copy-boundary`：`patchedSha256` `39c04631…` → `d0f1f1ac6cc1db6c…`；`originalSha256` **必须保持 `35aebac3…`**——`build-canonical-catalog.ps1` 拿它跟 `SKILL-INVENTORY.json` 里冻结的 `sourceSha256` 比，改了就抛异常。这是唯一被机器强制的、对换行敏感的登记项；其余 sliver-core 行的哈希在来源删除后已无关卡校验（`record-provenance-integrity.ps1` 对来源缺失 fail-closed）。
   - `sliver-execution-loading-budget-raise` 条目正文改写：只保留 `bounded_d1_max_bytes` 74000→75000（1 行），`d0` 撤销回上游 67000。
4. `pwsh -NoProfile -File scripts/build-canonical-catalog.ps1 -RepoRoot <repo>` 重生成投影（只许 PowerShell 7 落盘）。
5. 文档：README / `docs/HANDOFF-NEXT.md` 里引用的预算数字，以及 §3.2 说的红数环境口径。

## 5. 七条 LF 形态指纹（演练算出，落地直接用）

| 文件 | patched：CRLF（现在登记） | patched：LF（落地要登记） | original 处理 |
| --- | --- | --- | --- |
| `SKILL.md` | `39c046319ff4…` | `d0f1f1ac6cc1db6cb945117d4a9e9d7bb8c72f10b60dde31f0703b7dca78ef51` | `35aebac3…` → `86a54779954e…`（历史 blob `6b3df41b1080`） |
| `references/engineering-execution.md` | `b6c78417705e…` | `e7a9f553a80c045c7f3016243dfa4cc173a8f512addd0ac01f3db76add26e5a4` | `b7f30562…` → `79071c1d56fa…`（历史 blob `328b2212f6d3`） |
| `references/question-bank.md` | `458b8863197a…` | `d92b4a864fcbf0a9b7d48c055e46dd9580ebdddb0c859624440909fe18e6f3c1` | `5f1616a6…` → `a4491bd28284…`（历史 blob `b1b61ae9abad`） |
| `tests/execution-backbone-cases.json` | `3b4c7fe0be1d…` | `3e1377d7a041db9191dc354d2c4ac5a4d775d0e67a68a3652d3ab98d857c6084`（d0 已撤销的形态） | `fba19016…` → `a00d313f4caf…` |
| `assets/project-audit/audit-report.md` | `39c104e9ad4b…` | `2e38de28766ddb2f76d3df491bbcb14b4c3b5a342d2f5ab56885478df7bda031` | 保持 `dcc25ed5…`（无历史 blob 可对） |
| `assets/project-decision/adr.md` | `c8032387c078…` | `74dffc386ccec2a59ca87388c4484fefacbf47a73caf4a74877b26dc71ff39de` | 保持 `10821d1c…` |
| `assets/project-feature/feature-truth.md` | `a877d81ff0d8…` | `6575c00bba821d8569ffb85dd74753b1bd128c74402a89029d23c31d729a697b` | 保持 `7dac5bfa…` |

交叉验证：3 个 `assets/*` 的 LF 形态 digest 在本仓库历史里已作为真实 blob 存在（`8458605f27ba`、`8f57ee4ae984`、`871838f66dba`），即这些值不是我这次转换才造出来的，历史上以 LF 存在过。

## 6. 顺手抓到的一个真缺陷（与换行无关，已在 HEAD 里）

`provenance/PROVENANCE-INTEGRITY.json` 的 `snapshots[sliver-core].locallyPatchedPaths`：6 行是对象，第 7 行（`tests/execution-backbone-cases.json`，本会话上一批追加、已随 `7b75bc4` 推送）被写成了**字符串**。格式与其余 6 行不一致，也与生产它的 `scripts/record-provenance-integrity.ps1:187`（输出 `[ordered]@{path;patchedSha256;originalSha256;patchId}`）不一致。

- 为什么现在不红：没有任何关卡读这个字段——它只被记录脚本生产，是给人看的镜像。
- 为什么要修：这个字段的存在意义就是「机器可读的补丁镜像」，一行格式不同等于给未来加了一个隐形分支；而且来源已删除，记录脚本永远跑不回来，这行不会自愈。
- 修法：还原成对象并补 `patchId`（演练副本已这么修好，可直接照抄）。它不依赖换行决定，可以单独一批修。
- **状态：本批已修。** 真仓库那一行已还原成对象，三串指纹值逐字未动（改动 6 增 1 删）；修后复验：7 行全为对象且字段齐全、逐行登记的 `patchedSha256` 与当时文件字节重算全等、`snapshots[sliver-core].treeHash` 不变（该字段不参与树指纹计算），`verify.ps1` 新鲜跑 **21/21**。
- 刻意没顺手改的一处：这 7 行的**排列顺序**与生产脚本 `record-provenance-integrity.ps1` 的按名 ordinal 排序不一致（历史上按批次追加留下），重排会让 diff 变大且不影响正确性，留到真需要重录时再处理。

## 7. 未验证项

- **CI**：演练副本只在本地 Windows 跑过 21/21，GitHub 的 ubuntu runner 没跑过。落地必须在 CI 复跑才算数。
- 残留 2 条红（`29695fe0` 基线对象不可得）无法通过换行修复；因此「110 条套件接进 CI」本批仍未达成，不能声称已解决。
- `sources/**`、`skills/**` 两棵保真树是否也该统一 LF：本次只动 `governance/sliver-core`，演练证明混合状态门禁仍绿，但没测「全树统一」的额外收益与代价。
- git 对象库体积、clone 耗时变化未测。
- 落地后对既有工作树的影响未测：其他会话/宿主若有未提交改动，220 个文件的重写会与其冲突；本次演练副本是从干净 HEAD 克隆的。
- `assets/*` 三行 `originalSha256` 到底对应来源项目的 LF 还是 CRLF 形态，**永久不可知**（原文随源项目删除），本报告不下结论。

## 8. 撤法

真树未动，无需撤。临时副本（演练用的 3 个目录：`repo`、`ab-ctrl`、中间产物）在本报告落盘后按 owner 的「测完删除测试文件」要求删除；本报告与 §5 的指纹足以让任何人在不依赖那些副本的情况下重做或落地。
