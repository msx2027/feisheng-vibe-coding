# 加载体积预算上调 + 检查接线（含超标与测试红的同一根因实测）

日期：2026-09-28　批次：体积预算批　owner 决策来源：「这个也要处理」（指向上一批留账里的「加载体积门在 HEAD 上就已超标 420/684 字节且这个检查没接进任何关卡」）

## 一句话结论

预算按当前工作树真实字节上调（D0 67000→68000、有界 D1 74000→75000），并把这条唯一没人跑的体积检查接进 `verify.ps1`（默认档 20 步→21 步，本机 pwsh 7 实测 21/21 全绿）。同时测出：超标本身与 sliver-core 自带契约测试红 15 条，是**同一个根因**——这份控制面文件树在本仓以 Windows 换行（CRLF）落盘，而它内部记录的指纹是在 Unix 换行（LF）字节上生成的。

## 1. 修了什么

| 文件 | 改动 |
|---|---|
| `governance/sliver-core/tests/execution-backbone-cases.json` | `development_loading_contract.d0_max_bytes` 67000→68000、`bounded_d1_max_bytes` 74000→75000；只动这 2 行，文件 87199 字节不变、CRLF 行数 2477 不变 |
| `scripts/verify.ps1` | 新增第 `1e` 步「控制面静态契约评测」：调用 `governance/sliver-core/scripts/evaluate_execution_backbone.py`，退出码非 0 即本步失败；本机找不到 `python3`/`python` 也判失败，不静默跳过 |
| `README.md` / `docs/HANDOFF-NEXT.md` | 步数徽章与正文 20→21（徽章与正文由末步自计核对，写错即红） |
| `provenance/LOCAL-PATCHES.json` | 新条目 `sliver-execution-loading-budget-raise`（sliver-core 快照命名空间），补丁 15→16 |
| `provenance/PROVENANCE-INTEGRITY.json` | sliver-core 树摘要 75eb2715→`sha256:35a40ec4b9aa038108dac4ef4668a9f5847b70102bdd85862871bb8d80237b1c`；`locallyPatchedPaths` 6→7；annotation 4→5 |
| `provenance/CANONICAL-CATALOG.json` | `build-canonical-catalog.ps1` 重生成，diff 只有 `generatedAt` 一行（该测试文件不在 runtime bundle 内） |

预算取值的依据是本仓既有登记习惯：预算 = 实测值向上取整到千位。导入时在 LF 字节上实测 D0=66,772（预算 67,000，余 228）、有界 D1=73,982（预算 74,000，余 18）；本次按当前工作树字节实测 67,420 → 记 68,000、74,684 → 记 75,000。

**步数口径说明（避免误读）**：HEAD（提交 `463bb93`）的 `verify.ps1` 是 19 步，本批净增 1 步 = 20。但本机工作树里还有另一批**尚未提交**的改动（`scripts/build-canonical-catalog.ps1`、`scripts/build-skill-inventory.ps1`、`scripts/verify.ps1` 的「入库生成物为 pwsh 7 排版」步、`evidence/20260928-canonical-runtime-gate.md`），它再加 1 步。两批都在工作树里时实测 21/21 全绿，README 与 HANDOFF 的步数也被该批同步到 21。**本批单独提交时步数应为 20**，README/HANDOFF 的 21 是两批叠加口径，落地顺序由 owner 决定；本仓工作树是共享工作区，提交前必须确认另一批是否同行。

## 2. 为什么这条检查能长期静默

`evaluate_execution_backbone.py` 是 D0 / 有界 D1 加载体积预算的唯一 owner，但：

- `scripts/verify.ps1` 里没有任何 python 调用（改动前 `grep -n python scripts/verify.ps1` 无命中）；
- `.github/workflows/release-gate.yml` 只有 pwsh 步骤，同样不跑 python。

所以这条预算从 2026-09-10 导入起到本次实测前，只有人手跑到才会看见。接进步骤后，任何人改控制面正文导致加载体积超预算，本机与 CI 都会立刻红。

## 3. 超标归因实测（并更正上一批的口头归因）

上一批我在对话里说「六个 D0 owner 文件净增 648 字节」。**这个数字的解释是错的**，本批实测更正如下：那 648 字节里有 635 字节来自换行表示差异，真实内容增长只有 67 字节。

已提交记录（`evidence/20260928-question-medium-rule.md`、`LOCAL-PATCHES`、annotation）只写了「超标为 HEAD 既有状态、非本批引入」与「移除本补丁后数字不变」，这两条经复查仍然成立，无需返工；错只错在我对话里的口头分解。

### 3.1 逐文件分解（同一文件：699d53d 的 LF 字节 / HEAD 的 LF 等价字节 / HEAD 的 CRLF 工作树字节）

| 文件 | 导入时(LF) | 现在(LF 等价) | 现在(CRLF 实盘) | 真实内容增长 | 换行多出的字节 |
|---|---|---|---|---|---|
| `SKILL.md` | 19715 | 19782 | 19939 | +67 | +157 |
| `references/runtime-adapter.md` | 3681 | 3681 | 3729 | 0 | +48 |
| `references/development-execution-core.md` | 5977 | 5977 | 6036 | 0 | +59 |
| `references/task-risk-gates.md` | 8654 | 8654 | 8788 | 0 | +134 |
| `references/testing-strategy.md` | 12290 | 12290 | 12369 | 0 | +79 |
| `references/effect-recovery-gates.md` | 6795 | 6795 | 6899 | 0 | +104 |
| 小计（D0 六件） | 57112 | 57179 | 57760 | **+67** | **+581** |
| `references/testing-execution-gates.md`（有界 D1 另加） | 7210 | 7210 | 7264 | 0 | +54 |

投影部分两档相同：`route_projection=6952`、`lens_catalog=1619`、`frontend-design_projection=1089`，合计 9,660 字节。

### 3.2 A/B 实验：同一份 HEAD 内容，只换换行表示

方法（临时目录在仓库外，不污染任何仓库；跑完即删）：

```bash
T="$TEMP/fs-eolab-20260928"; mkdir -p "$T/lf"
git archive HEAD governance/sliver-core | tar -x -C "$T/lf"     # HEAD 当前字节 = CRLF
python3 -c '按文件把 \r\n 换成 \n（220 个文件命中）'              # 得到同一内容的 LF 副本
cd "$T/lf/governance/sliver-core" && python3 -B scripts/evaluate_execution_backbone.py .
cd "$T/lf/governance/sliver-core/scripts" && python3 -m unittest test_validation_contracts
```

| 度量 | LF 副本 | 当前 CRLF 工作树 |
|---|---|---|
| D0 加载体积（预算原为 67000） | 66,839 → 合规 | 67,420 → 超 420 |
| 有界 D1 加载体积（预算原为 74000） | 74,049 → 超 49 | 74,684 → 超 684 |
| 体检路由有界加载 | 59,910（预算 65,000，合规） | 60,629（合规） |
| `test_validation_contracts`（110 条） | 红 3（2 failures + 1 error） | 红 18 |

两份副本按 CRLF 剥离后逐字节相同，内容零差异。**多红的那 15 条全部是同一句失败**：`FAIL: <case> fixture SHA-256 does not match its contract`，报错出处 `scripts/evaluate_foundation_live_behavior.py:87 sha256_file()`（以 `rb` 裸字节读文件）与 `:286` 的比对；`scripts/evaluate_execution_backbone.py:356/388` 同样按裸字节计数。也就是说：这份树内部记录的指纹要求 LF 字节，而本仓落的是 CRLF 字节。

残留的 3 条红与本议题无关，是来源项目已被删除造成的（例如 `trusted runtime baseline Git object is unavailable: 29695fe099c6b38c9b5c470abbb2e065fc1ff936`——该 git 对象随源项目本体一起在 2026-09-11/12 删除，本地不可恢复）。

### 3.3 换行是谁改的

- `699d53d`（2026-09-10 导入）：无 `.gitattributes`，`core.autocrlf=input`，blob 为 LF，与树内契约记录的指纹一致。
- `8e30d2f`（同日「让保真树在任何 clone 上字节可复现」）：给 `sources/**`、`skills/**`、`governance/sliver-core/**` 打 `-text`，并把当时**工作树里已经是 CRLF** 的字节重新入库（该提交自述：工作树字节 1274/1274 未变、383 个 blob 变化、除换行外零差异）。这一步让「clone 原样还原」成立，同时把 CRLF 固化成这份树的真源字节。
- 现在：`governance/sliver-core` 的 220 个已跟踪文件**全部**是纯 CRLF（实测 `git ls-files` 220 条，逐文件统计：pureCRLF 220 / pureLF 0 / mixed 0）。
- 原始来源目录 `F:\skiils工具\sliver-vibe-coding` 已不存在（2026-09-28 实测），无法再与来源逐字节对账，故只能在 annotation 里留账。

## 4. 本批没有做的事（留给 owner 拍板）

恢复 LF 还是接受 CRLF，是同一根因的两个相反处置，且要改 220 个保真文件的字节，属高影响动作，本批不动：

- **方案 A（把 `governance/sliver-core/**` 换行恢复为 LF）**：树内 15 条契约测试立刻可用、D0 预算可回落 67000（只剩有界 D1 需 75000）。代价：220 个文件字节变化 → 需重录 sliver-core 树摘要、`LOCAL-PATCHES` 里 7 条 sliver-core 命名空间的 original/patched 指纹、以及 4 条 annotation 的对账；且这是对「唯一内容真源」字节的改写，来源已删、只能靠换行剥离逐字节等值来自证。
- **方案 B（接受 CRLF 为真源字节）**：把树内契约里那批 fixture 指纹重录成 CRLF 字节的值。代价小（改动集中在测试契约文件），但等于改写上游自己生成的证据数值，且这份树从此只能在 CRLF 表示下自洽。
- 本批实际做的是**既不选 A 也不选 B 的最小可用面**：按当前真实字节调预算 + 把检查接进关卡，并把根因与两套方案的代价留账。

另外，本批接进 `verify.ps1` 的只有 `evaluate_execution_backbone.py` 这一个评测器。`evaluate_routes.py`、`evaluate_selector_pressure.py`、`evaluate_ui_design_lifecycle.py` 本机实测退出码均为 0，但同样没有关卡接线——是否一并接入（会再加步数）属同类决策，本批未扩。

## 5. 未验证项（一律保持 `UNVERIFIED`）

- **CI 能否跑通新步骤**：GitHub `ubuntu-latest` 是否提供 `python3` 未在本仓实测。本步设计为找不到解释器即失败（fail-closed），首次推送后以 CI 实跑为准。
- fresh clone 下 `evaluate_execution_backbone.py` 与 110 条契约套件的字节表现（`autocrlf` true/false × pwsh/5.1）未做。
- 那 15 条红在方案 A 下是否**全部**转绿：只在 LF 副本实测到「红 18 → 红 3」，未逐条核对 15 条的其余前置条件（如可执行工作区是否存在）。
- 上一批留下的行为实测（新提问载体规则在真实宿主会话里的表现）不在本批范围。

## 6. 回滚配方

```bash
git revert <本批提交>            # 5 个入库文件一次还原
# 或手工：
# 1) tests/execution-backbone-cases.json 两个数字回 67000 / 74000（按字节回写，勿改换行）
# 2) scripts/verify.ps1 删除 1e 步与其头部注释一行
# 3) README.md 徽章与两处表 21→20；docs/HANDOFF-NEXT.md 三处 21→20、全开 23→22
# 4) provenance/LOCAL-PATCHES.json 去掉末条、provenance/PROVENANCE-INTEGRITY.json 树摘要回 75eb2715…、
#    locallyPatchedPaths 去掉末条、annotations 去掉末条
# 5) pwsh -NoProfile -File scripts/build-canonical-catalog.ps1 -RepoRoot <repo>
# 6) pwsh -NoProfile -File scripts/verify.ps1 -RepositoryRoot <repo>   # 预期回到 20/20
```

---

## 8. 追加订正（2026-09-28 同日换行归一批，owner 决定「做」）

本文件上面几处结论已被同日下一批改变，按「原文不改、追加指针」的方式留账：

1. **§1 与 §一句话结论：`d0_max_bytes` 67000→68000 已撤销。** 换行归一批把 `governance/sliver-core` 220 个保真文件恢复为 LF 后实测 `UI_D0=66839`，回到上游预算 67000 之内，该数字已回写；`bounded_d1_max_bytes` **仍是 75000**（实测 74049 仍超 49 字节，这部分是真需求，撤不掉）。所以本批正文里「按当前工作树真实字节上调」这句记录的是当时的真实字节，不再是现在的状态。
2. **§3.2 表格的红数要加环境口径。** 「LF 红 3 / CRLF 红 18」是在默认 GBK 控制台测的，其中 1 条（`test_route_operation_delivery_projection_drift_fails_end_to_end`）是 Python 子进程输出解码崩溃造成的噪声、不是真失败。统一 UTF-8 环境（`PYTHONUTF8=1 PYTHONIOENCODING=utf-8`）下的正确数：**LF failures=2 / CRLF failures=17**（17 对应具名测试 16 个，其一含子测试计两次）。换行归一转绿的具名测试是 **14 个**，不是 15 个。
3. **§3.2「残留 3 条红」现为 2 条**，且两条同因：`trusted runtime baseline Git object is unavailable: 29695fe099c6b38c9b5c470abbb2e065fc1ff936`。与换行无关，来源项目删除后不可恢复，故「把 110 条套件接进 CI」至今仍未达成。
4. **§5 未验证项两条已闭环：**
   - 「CI 能否跑通新步骤（ubuntu-latest 是否有 python3）」→ 已闭环：本批接线的 `1e)` 步在 GitHub `ubuntu-latest` 实跑通过（run `36385532091`，21/21）。
   - 「那 15 条红在方案 A 下是否全部转绿」→ 已实测：LF 下具名转绿 14 个，残留 2 个属另一根因（第 3 条），方案 A 无法修掉。
   - 仍开放：fresh clone 下 LF 是否被 `core.autocrlf` 改写；`sources/**`、`skills/**` 两棵树是否同步归一。
5. **§6 回滚配方作废为本批的配方**（它回滚的是「CRLF 状态下上调预算」这件事，而该状态已不存在）。现在的回滚对象是换行归一批，配方见 `evidence/20260928-eol-lf-landing.md` §7。
6. 换行归一的完整数字、账本改动清单、落地时的顺序坑（`git add` 之前跑门禁会得 20/21），见 `evidence/20260928-eol-lf-rehearsal.md`（演练）与 `evidence/20260928-eol-lf-landing.md`（落地）。
