# 2026-10-02 D4 批：runtime registry 的计划面不得替失败块说谎

owner 令「提交推送，然后再继续查下一批」后的第一批自查产物。动的是**下发器内部登记逻辑**：
受管块正文一字未改（实测见 §5），下游不需要刷新；但 `init-target-runtime.mjs` 是本包 runtime include 面的
活树文件，**改了它就必须再生 catalog**——本批初稿写「catalog 不需要再生」是错的，路 A 复核对上后已重生成
（`provenance/CANONICAL-CATALOG.json` 只变两处：`generatedAt` 与该文件的 `sha256`，见 §5）。

## 1. 病：一个入口判定失败时，登记计划会造出一份装不出来的真源

`planTargetRuntimeUpdate` 的出口有三个：块计划、registry 计划、失败计划。前一批把第一个出口的谎
钉掉了（降级硬拦，`evidence/20261002-managed-block-self-scan-gate.md` §4），这一批复算第二个出口时发现：
`desiredRegistryFromPlans` 遍历的是「本次计划里的文件」，对判定失败的那一条**无条件**写

```js
version: TARGET_RUNTIME_BLOCK_VERSION,   // 本代号
checksum: plan.checksum,                 // 失败计划带的常是空串
```

并把不在计划里的条目整段丢掉。现场复现（**夹具＝`E:\fs-agent` 的只读副本**，落在 `%TEMP%`，
破坏方式是把其中一份入口换成同名目录；对 fs-agent 本体只做了 `copyFileSync`，零写入。
下表左列是 HEAD 版生成器（改前）的读数，右列是同一夹具跑现行版的读数，逐字取自 §5 的 A/B 输出）：

| 复现形 | 改前读数（registry 计划的 `nextContent`） | 改后读数（同一夹具） |
| --- | --- | --- |
| 盘上没有 registry，AGENTS.md 判定失败 | 凭空多一条 `AGENTS.md: v27 / cs=""` | `runtimeBlocks` 仍是 `{}`（没装过的不造） |
| 已装两条块，破坏 AGENTS.md（CLAUDE.md 健康） | 块条目**仍两条**，但 AGENTS 的真 checksum `3480e4e4…` 被抹成空串；`--check` 打 `update (runtime registry changed)`；`experienceProjection.outputs` 由 2 条掉到 1 条 | AGENTS 那条逐字照抄 `v27/3480e4e4…`，`outputs` 两条都在；`action` 仍是 `update`（另一半真要刷新），reason 点名「沿用上一轮：AGENTS.md 本轮判定失败未核对」 |
| 已装两条，破坏 CLAUDE.md（AGENTS.md 被级联判失败） | `CLAUDE.md` 的 checksum 抹空、`outputs` 掉成空集 | `action=none`，两条登记与两个 `outputs` 全部原样，reason 点名两份 |

**「删条目」只发生在 `outputs` 面**（路 B 复核第 2 条，据此更正本批初稿写的「块条目整条被删」——
块条目面是「被改写成空 checksum」，条目数不变）。

谎的落点**只在读数面**：`run()` 是全有或全无（`failures.length > 0` 时整笔事务不落盘），
实测两个破坏形用改前生成器跑 `--write` 都是 **exit 2 且盘上 `.vibe-runtime.json` 逐字节不变**
（路 A 复核第 3 条提出、路 B 复核第 3 条独立复现，本批初稿那句「已经落到别人盘上」据此作废）。
所以危害不是把别人的记录改坏，而是给下游一个**永远装不出来的待刷新目标**：`--check` 打 `update`、
`--json` 里带空 checksum 的 `nextContent`，人照着读数去排查「registry 为什么会漂」，而盘上的记录一直是对的。
`.vibe-runtime.json` 又是目标项目里**唯一**记录「装着哪一版块」的机器文件（块正文自己写着
「`--check` 发现 registry 缺失或漂移时必须刷新，不得口头声明当前」），所以这份谎会直接指挥别人的动作。

## 2. 改法：登记面只描述已装状态，判定失败一律照抄

`skills/event/experience-elevator/tools/init-target-runtime.mjs` 的 `desiredRegistryFromPlans`：

- 遍历骨架由「本次计划」改为 **`TARGET_FILES`**，计划按 `file` 取；取不到即视同失败处理，
  这样单个文件的失败不可能删掉别的文件的条目；
  **如实登记（路 A 复核第 2 条）**：把骨架换回 `for (const plan of plans)` 的突变**15 例全绿**——
  `planTargetRuntimeUpdate:809` 的 `basePlans` 恒按 `TARGET_FILES` 映射，两份入口永远在场，
  所以现有用例区分不了这两种写法。保留骨架取的是「登记键集＝TARGET_FILES」这条由结构保证的不变量，
  **不得**当成已被用例钉住的判据（代码注释里同步写了这句）；
- `plan.status === "fail"` 的条目：已登记过的（`kind === "target-runtime"`）原样照抄，没登记过的**不造**；
- `experienceProjection.outputs` 同理：只为判定失败的文件回填上一轮已登记的投影值，健康文件照常重算。
  本批初稿在这里还多写了一个「本次已算出该条就不回填」的短路条件，复算确认是死分支
  （`experience-managed-blocks.mjs:329/338/341/346`：凡判 `fail` 的分支一律 `projection: null`，
  而 `projectionOutputs[f]` 只在 `projection` 非空时才写），已删除；
  为什么仍要回填：registry 的自校验（`establishedExperienceProjectionState`）要求 `outputs` 键集恰为
  `TARGET_FILES`，读不到键集会报「outputs set drift」，回填把这条计划面读数维持在同一份已装状态上
  （注意：本批初稿写成「删条目会在下一轮变成漂移」，路 B 复核第 3 条实测否证——见 §1，落盘面根本走不到下一轮）；
- **照抄必须让读数面看得见**（路 A 复核第 4 条，本批据其实施）：新增 `carriedForwardRegistryEntries()`，
  registry 计划的 `reason` 在存在照抄项时追加「（沿用上一轮：`<文件>` 本轮判定失败未核对）」，
  `action`／`status` 不变。理由：修完之后失败面变成 `[PASS] none (runtime registry current)`，
  而「这个文件本轮根本没核对过」这件事在读数里消失了——把一个谎换成一个静默的盲区不合格。
  代价照实登记：**过期值不会自愈**，也没有任何门会替人去看这句点名，它只是把线索给到读数面上。

不改的方向：判定成功时仍写本代 `version` 与本次渲染的 `checksum`（那才是将要落盘的状态），
`updatedAt` 的「内容未变则保留旧值」逻辑与全有或全无的事务提交（`failures.length > 0` 完全不落盘）都没动。

**一条顺带查实的行为**（未改，登记）：一份入口读不成普通文件时，**另一份入口的计划也可能跟着判失败**，
reason 是 `established runtime experience projection missing`（已装投影自校验把整面对象读穿后扩散）。
方向不是固定的：fs-agent 副本实测「破坏 AGENTS.md → CLAUDE.md 仍 pass」而「破坏 CLAUDE.md → AGENTS.md 判 fail」
（§5 A/B 两形），D4-4 夹具（未装块、`runtimeBlocks` 为空）实测「破坏 AGENTS.md → CLAUDE.md 也 fail」。
所以「只有某一个文件失败」这种夹具不可依赖。两条点名断言因此口径不同，都是照各自夹具的实测读数写的：
D4-1 钉的是单份点名的逐字形态（那份夹具里另一份入口确实健康），D4-4 钉的是
`沿用上一轮：[^\n]*AGENTS\.md`（该夹具实测点名两份）。本批的照抄逻辑对级联是安全的（失败面一律不动登记）。

## 3. 契约测试 11 → 15 例，四次突变各打红

`tests/test-init-target-runtime-downgrade.mjs` 新增 D4 组四条（同一函数的同一个出口、同一批夹具，
所以钉在同一份套件里，不另开文件——本包每加一个测试文件就要多接一步门禁并改三处步数锚点）：

1. 判定失败的块不得被写成本代版本：登记逐字照抄上一轮，且 registry 计划由 `update` 变回 `none`
   （即 `--check` 不再承诺一次装不出来的刷新）；同时断言整份登记面不得出现空 checksum，
   并断言 `reason` 必须点名「沿用上一轮：AGENTS.md 本轮判定失败未核对」；
2. 从未装过的文件判定失败时不得凭空造条目（键集仍是已装的那一份），且**没有照抄项时不得出现这句点名**
   ——证明上一条不是无条件贴出来的话术；
3. 对照例：同一夹具只差「失败 → 正常低版本升级」这一步，registry 必须真给出本代版本与新 checksum
   ——证明前两条的红不是「registry 永远不动」换来的；`reason` 此处必须逐字等于 `runtime registry changed`；
4. 投影登记面（`experienceProjection.outputs`）同样不得因单文件判定失败而删条目，且照抄的必须是已登记那一份
   （哨兵值）。夹具里 L0 台账故意缺席，用来钉「别的失败不影响这条判据」；该夹具里 AGENTS.md 无任何块条目，
   照抄只发生在投影面，故这条同时钉住「只照抄投影登记也必须点名」。

突变实测（摘掉护栏看是否有牙；四形都在真树上原地改一行、跑完立即按备份复原，
最终 sha256 与突变前逐字节相同 `91c7680c…`，无残留）：

- M1 摘掉块面 `plan.status === "fail"` 这道护栏（`if (!plan || …)` → `if (!plan)`）→ **3／15** 判红，
  红的正是 D4 第 1、2、3 条（第 3 条对照例也红，因为它的夹具第一阶段就要求照抄）；
- M2 只摘掉投影 outputs 回填那一段（`outputs[f] = recorded` → `void recorded`）→ **1／15** 判红，只有 D4 第 4 条；
- M3 **把 `carriedNote` 置为空串**（即只修谎、不留点名）→ **2／15** 判红，红的正是 D4 第 1 条与第 4 条的点名断言，
  第 2、3 条那两条「不得出现点名」仍绿——点名断言与被点名夹具是分别闭合的；
- M4 沿用上一批那条守卫突变（降级守卫 `> 0` 改成 `> 999`）→ **6／15** 判红（当时是 6／11，同一批用例，只是分母变了）。

## 4. 刻意不修（三条，逐条给理由）

- **受管块里「旧代 resolver 未随本包分发」这类措辞残留**（块正文两处提到 resolver／旧代解析器）：
  它已明确说了「未随本包分发」，属诚实提及而非谎报，棘轮 R3 只判 `*.mjs` 裸名所以对它无感。
  为两句措辞单独升 v28 要再刷两仓＋改三处文档锚点，收益只有语感；留到下一次真有正文变更时顺带收。
- **失败计划行的 `file` 字段把「AGENTS.md 读不了」标成 `.vibe-runtime.json`**（实测读数：
  `[FAIL   ] .vibe-runtime.json: conflict (target path is not a regular file: AGENTS.md)`；
  状态列按 7 字符补齐空格，本文早先写成 `[FAIL]` 是抄漏，路 B 复核第 8 条指出）：
  该检查确实是从 registry 出发的，reason 里点名了真凶，改字段要重划「谁拥有这条失败」的归属，
  代价大于收益；记下形态，不动。
- **`.vibe-runtime.json` 的 `source: "tools/init-target-runtime.mjs"` 字面**：它是机器读字段而非下发正文，
  且棘轮按口径把 `tools/` 前缀判为「目标项目自己的工具」放行；改成包内路径会让目标项目按一个新路径去找
  一个本来就不是给它跑的记录字段。

## 5. 新鲜读数（全部为本批现跑）

```
node --test tests/test-init-target-runtime-downgrade.mjs        → 15 tests / 15 pass / 0 fail
pwsh -NoProfile -File scripts/build-canonical-catalog.ps1 -RepoRoot "F:/skiils/vibe-coding-skills"
                                                                → 82 records；CANONICAL-CATALOG.json 的 diff 恰两行：
                                                                  generatedAt ＋ init-target-runtime.mjs 的 sha256
                                                                  （新值 91c7680c…，与当前文件实测 sha 逐字相同）
node scripts/check-runtime-block-refs.mjs --root .              → exit 0；命中 0 处（未登记新增 0、基线存量 0）
node skills/event/experience-elevator/tools/init-target-runtime.mjs "E:\fs-agent" --skills-root . --check
                                                                → exit 0；三项全 [PASS] none：
                                                                  AGENTS.md／CLAUDE.md: none (managed block current)
                                                                  .vibe-runtime.json: none (runtime registry current)
                                                                  ——下游一切健康，故点名后缀不出现（§2 的对照面）
                                                                  （块面仍是 version=27，本批未触碰正文渲染 → 下游无需刷新）
node skills/product/hotspot-governor/tools/check-hotspots.mjs "E:\fs-agent" --strict
                                                                → exit 0；Scanned 99 files；findings=12 blockers=0 hotspots=0 warnings=12；0 条 FAIL
   （这条补的是上一批 §5 那条「写法安全」缺的另一半：把块里写的 `<skills-root>` 换成本仓根之后命令本身跑得通。
     路径**必须加引号**：路 B 复核实测在 Git Bash 里不加引号时背斜杠被吃掉，命令会静默改扫本仓且照样 exit 0——
     这是一次「跑通了但跑的不是目标」的读数，本批初稿那条未加引号的写法已按此更正）

改前／改后 A/B（HEAD 版生成器拷进 %TEMP%\itr-head\tools\，依赖同级模块一起拷、脚本零改写；
夹具＝E:\fs-agent 六个文件的只读副本，对 fs-agent 本体只有 copyFileSync）：
  起点（盘上登记）  blocks = AGENTS v27/3480e4e4 ＋ CLAUDE v27/7c756103，outputs 键 = [AGENTS.md, CLAUDE.md]
  破坏 AGENTS.md   HEAD : reason "runtime registry changed"/update，blocks 仍两条但 AGENTS 的 cs 被抹成 ""，outputs 掉到 [CLAUDE.md]
                FIXED: reason "runtime registry changed（沿用上一轮：AGENTS.md 本轮判定失败未核对）"/update，
                       blocks 照抄 3480e4e4，outputs 两条都在
                HEAD --write → exit 2，盘上 .vibe-runtime.json 逐字节不变（§1「谎只在读数面」的直接证据）
  破坏 CLAUDE.md   HEAD : CLAUDE 的 cs 抹空、outputs 掉成空集，且 AGENTS.md 也被级联判 fail
                FIXED: action=none ＋ 点名两份，两份登记与两个 outputs 全部原样
```

读数里**不引**「可执行面基名」这个数：它数的是全仓文件基名，本批新增一份证据文件它就 ＋1
（上一批 `evidence/20261002-managed-block-self-scan-gate.md` §3 末已写明它不是锚点）。

## 6. 两路对抗复核的处置（查出什么、不修什么都登记）

- **路 A（代码与突变）**六条：① catalog 必须再生——**成立，已修**，本批初稿那句「catalog 不需要再生」是错的（§ 开头已改）；
  ② 骨架换回 `plans` 的突变 15／15 全绿——**成立**，故 §2 与代码注释都改成「取不变量、未被用例钉住」，不再宣称它防住了什么；
  ③ `--write` 全有或全无使「下一轮漂移」不可达——**成立**，§1 的因果陈述已改为「只改变读数面」；
  ④ 照抄后 `action=none` 把降级读成正常——**成立且是本批漏的一条**，已按 §2 实施点名后缀并补断言（M3 实测 2／15 有牙）；
  ⑤ 健康路径 7 组夹具逐字节回归 `identical: true`——攻不动，通过；⑥ 无仓库残留文件——本批另自查一次
  （`git status --porcelain` 只含六个改动面 ＋ 新建证据文件），%TEMP% 自有件清单见 §8。
- **路 B（文档读数，全程只读；实验落在 `%TEMP%\adv-d4`，自称已删净并对活树做了 sha 自证）**十条，逐条复算后处置：
  ① §1 表前两行**攻不动**（用 `git show HEAD:` 的改前生成器复现了「凭空条目」与「真 checksum 抹空」）；
  ② 「块条目整条被删」**成立，已改**——删只发生在 `outputs` 面，块条目面是被改写成空 checksum、条目数不变
  （本批另用 fs-agent 副本 A/B 独立复现，见 §5）；③ 「下一轮投影登记面漂移」**成立，已改**——改前生成器的 `--check`
  实打 `update (runtime registry changed)`，从不打漂移，且 `--write` 两形都 exit 2、盘上登记逐字节不变；
  ④ §3 四条突变**攻不动**（隔离迷你包复现 3／1／2／6，与本批同数）；
  ⑤ §5 读数**部分成立，已改**：它抄了「可执行面基名 696」（实测 697，且该数本就不该进读数——同一条批内自相矛盾），
  命令里的 `…/init-target-runtime.mjs` 省略号不可照抄，`E:\fs-agent` 未加引号时在 Git Bash 里背斜杠被吃、
  **会静默改扫本仓且照样 exit 0**——三处均已按逐字可跑的形式更正；
  ⑥ 路 1 那条命令与命中**攻不动**（除上面那个 696）；
  ⑦ 路 2 普查**成立，口径不唯一，已改**——无命令可照抄时「7 个受管根」在另一读法下是 14 个（多出的是
  `E:\fs-agent-worktrees` 分身），43% 的真分母是 3／14＝21%；已把命令、两种读法与逐根版本写进 §7；
  ⑧ §4 三条「刻意不修」前提**攻不动**（resolver×1／解析器×2、R3 只判带扩展名裸名、`tools/` 放行确是检查器头注原文），
  只有一处打印形态小差：真打是 `[FAIL   ]`（状态列按 7 字符补齐空格），§4 引文已按真打补空格；
  ⑨ **新查实的边界，成立且未修，已登记**（下一节 §7 路 1 补充段）：棘轮默认面是 `--scope skills`（162 文件），
  `evidence/**`／`docs/**` 不在任何门眼下。本批复跑 `--scope evidence`：88 文件／命中 264 处／未登记新增 264 处，
  其中**这份证据文自己占 15 处、12 个不同基名**——只有 1 个（`build-target-doc-index.mjs`，4 处）是病灶本身，
  其余 11 个是 §8 那条「临时件清理清单」里点名的 `%TEMP%` 脚本名。也就是说：真要收文档面，
  「如实登记一个不存在的脚本名」这种写法会大面积判红，口径得先决定「提及」与「承诺」怎么分（这是新边界，不是本批的改动）。
  ⑩ 「手抄副本 vs 锚点」**成立且未修**（登记）：`15 例`与四个存量数已进「文档数字与实测一致」的锚点集，
  而 §5／§7 里的 `99 files`／`findings=12`／`14 个受管根`／`3／14＝21%`／`deyy:87`／本文「11 → 15 例」这类第二副本
  **没有任何门会重算**，改代码或改盘上的它就静默过期——本批的做法是给它们配上可照抄的命令（§7 已补），
  但「配命令」不等于「进门」，是否把证据文面收进常驻断言属新增门禁范围，等 owner 拍。
  ⑪ 路 B 另指 HANDOFF ⑥ 的「63 份虚拟面／地面外 75 处」无口径无命令（naive 复算 `.template` 面得 55）——
  **成立，已改**：该句现按「约」写并给出复算口径，见 `docs/HANDOFF-NEXT.md` ⑥。

## 7. 下一批候选（两路只读普查产物，等 owner 拍板范围）

路 1（下发面普查）合并读数：本包会写进别人仓库的面共 11 族，眼下只有两族在门眼下（受管块、`skills/**.md` 盘面）。
**唯一实测到硬命中的未接面**是脚手架文档模板，命令与读数逐字可照抄（本批复跑）：

```
node scripts/check-skill-references.mjs --root . --virtual-only \
  --virtual-md '_target-docs/文档索引.md.template' \
  'skills/product/dev-builder/templates/project-scaffolds/_target-docs/文档索引.md.template'
→ ✗ _target-docs/文档索引.md.template:3 死引·R3 未登记新增：`build-target-doc-index.mjs`
  扫描 1 个文件（含虚拟面 1 份），技能面 51 个，地面外路径 0 处不计，命中 1 处（未登记新增 1 处、基线存量 0 处），exit 1
```

（该读数里**故意不抄**「可执行面基名 N 个」：它数的是全仓文件基名，仓里多一个文件它就 ＋1，
本批实测已从上一批的 696 变成 697；§5 末已写明它不是锚点。）

`build-target-doc-index.mjs` 只存在于 `sources/` 保真快照（本包不下发），而这句话会随模板拷进**每一个**
新项目——与受管块 v24/v25 那两代谎报同形，只是还没进任何常驻断言。

路 1 的口径补充（路 B 复核第 9 条，本批复算成立，**这是对「门能看见什么」的新边界，不是本批的改动**）：
棘轮默认 `--scope skills`（实测 162 文件），**`evidence/**` 与 `docs/**` 不在扫描面内**。
按 `--scope evidence` 复跑得 88 文件／251 命中，其中本批这份新证据文自己占 2 处
（就是上面引的那两句 `build-target-doc-index.mjs`）。也就是说：**证据文与交接文档里写死的脚本名，
任何常驻门都不会去看**，它们靠人读；把「下发面」接进门时，这条边界要一并决定（收不收文档面、收了要不要先清存量）。

路 2（磁盘下游普查）——**上一批与初稿都没写命令，导致「7 个受管根」在另一种读法下是 14 个**。
本批把口径写死成可照抄的一条命令（Git Bash；深度按 `find` 自己的计数，挂载点算第 0 层）：

```
find /e /f /g -maxdepth 6 -type f \( -name AGENTS.md -o -name CLAUDE.md \)     # 实测命中 146 个入口文件
  | 逐个 grep 受管块起始标记 vibe-coding-skills:target-runtime:start           # 实测 28 个文件 / 14 个受管根
```

| 受管根 | find 深度 | 块版本 | 份数 |
| --- | --- | --- | --- |
| `E:\fs-agent` | 2 | 27 | 1 |
| `E:\fs-agent-worktrees\*`（098／bug-sweep-backend／bug-sweep-frontend／bug-sweep-verify／fabao-real／fsa-task-card-grouping／lingmai-oauth） | 3 | **5 份 23 ＋ 2 份 25** | 7 |
| `F:\skiils\sess-find` | 3 | 27 | 1 |
| `G:\历史项目\ddzj` | 3 | 3 | 1 |
| `G:\历史项目\deyy` | 3 | 21 | 1 |
| `G:\历史项目\vibe\examples\golden-path\{cli-node-mini,desktop-electron-mini,web-vite-mini}` | 6 | 21 | 3 |

- **两种读法的数都给出**：按「一切受管根」是 14 个，其中 7 个是别人仓库的 git worktree 副本（同一份工作内容的分身，
  刷新时会被 `git worktree` 自己带上，不该进下游登记）；prune 掉 worktrees 才是 7 个。
  上一批与初稿写的「7 个受管根」「深度 ≤3／≤4 漏 3／7＝43%」都只在 prune 口径下成立——路 B 复核第 7 条据此更正；
  按不 prune 的真分母，深度 ≤3 漏的是 golden-path 3 个／14＝21%，深度 ≤6 才全（worktrees 在深度 3，一直都在）。
- 本批复算与路 B 自带读数有一处不一致：路 B 报「多出的 6 个（5×v23＋1×v25）」，本批按上表命令实得 7 个（5×v23＋2×v25，
  `bug-sweep-backend` 与 `fsa-task-card-grouping` 都在 25）。差异以本批命令为准（表内逐根列名，可逐条复查）。
- deyy 的 v21 块第 87 行仍锁着 `check-ui-reuse` 那句谎报（路 B 复核第 7 条复算 ✓；块 checksum 自洽，手改不掉，只能刷新）。
- **收口时把上表命令原样重跑了一遍**（`%TEMP%\census_final.txt` → 逐个 `grep -l` 标记 → `dirname | sort -u`）：
  入口 146、带标记文件 28、受管根 14，逐根版本与上表逐条相同（27 两份／25 两份／23 五份／21 四份／3 一份）。
  重跑当场抓到本批自己的一处口径错：第二次 grep 用了不存在的标记串 `VIBE-CODING-SKILLS:BEGIN`，
  得 0 命中——若不复查就会把「下游一个都没刷」当成实测结论登记。真标记是小写 `vibe-coding-skills:target-runtime:start`
  （生成器 `init-target-runtime.mjs:353` 的起始行正则），上表命令用的就是它。
- 登记表只有 `generatedBy`／`source` 两个常量字段，**无法**从中回推是哪个 skills 副本刷的（路 B 复算 ✓）；
  `updatedAt` 在内容未变时原样保留（本批 §2 也未改这条），它是声明值不是刷新时间。

→ 落 `provenance/DOWNSTREAMS.json` ＋一步门禁属**新增真源面**，且普查已给出三条反例：
① worktree 分身要不要算下游（本批实测 7／14）；② golden-path 那 3 份登记表被 git 跟踪，
克隆会把旧版本登记表搬到任意新路径；③ 深度写死多少直接决定漏多少（≤3 漏 21％、不 prune 与 prune 差一倍面）。
口径必须先由 owner 定，本批不代拍。

## 8. 本批自有临时件（清理归属）

真树零残留（`git status --porcelain` 只含六个改动面与这份新证据文件）；本批在 `%TEMP%` 里落下的自有件为
探路与调试脚本 `repro_registry_mis.mjs`、`dbg_case2.mjs`、`dbg_projection.mjs`、`dbg_projection2.mjs`、
`dbg_carried.mjs`、`dbg_d44.mjs`、`dbg_d44b.mjs`、`dbg_d44c.mjs`、`ab_head_fixed.mjs`，
改前生成器的隔离副本 `itr-head/tools/`（含同级依赖一起拷，脚本零改写），
突变用度 `mut_run.sh`、`mut.log`、`mut_base.mjs`、`itr-pre-mut.mjs`，
读数文本 `hs.txt`、`selfscan.txt`、`fsa.txt`、`verify_d4.txt`、`verify_d4b.txt`、`verify_d4c.txt`、`verify_d4d.txt`、
`verify_d4e.txt`、`census_raw.txt`、`census_hits.txt`、`census_final.txt`、`census_marked.txt`、`census_roots.txt`，
以及脚本自建的临时夹具目录（`ab-d4-*`／`ab-fsa-*`／`d44*-*`，脚本内已 `rmSync` 自删）
和上一批留下的隔离突变副本 `vibe-mut-d4/`。**清理已在收口时执行**，复算命令与读数逐字为：

```
cd "$TEMP" && rm -f census_final.txt census_marked.txt census_roots.txt verify_d4d.txt verify_d4e.txt vfinal_d4.txt
ls -1 itr-head vibe-mut-d4 repro_registry_mis.mjs dbg_*.mjs ab_head_fixed.mjs mut_run.sh mut.log \
      mut_base.mjs itr-pre-mut.mjs hs.txt selfscan.txt fsa.txt census_*.txt verify_d4*.txt vfinal_d4.txt
→ 空输出（exit 2＝全部无命中）；find . -maxdepth 1 -type d -name 'vibe-exp-anchor-*' | wc -l → 126（原样保留）
```

最后一次全量门读数写在 `vfinal_d4.txt`（29/29），删该日志之后本文件只剩本节这一处文字改动；
`evidence/**` 的内容不在任何门禁读取面（6b 只读 README 与 `docs/HANDOFF-NEXT.md`，口径账本只读
`tools/caliber-ledger.json` 登记的面），故不再为此重跑全量门。
另：`%TEMP%` 里 126 个 `vibe-exp-anchor-*` **不是本批产物**，不动——逐条 `stat` 实测日期对半分成
2026-09-23 与 2026-09-29 两批各 63 个（本文早先写成「2026-09-29 的 126 个」是读数口径错，已改）。
路 B 的实验目录 `adv-d4/` 收口时复查已不存在（`find "$TEMP" -maxdepth 1 -iname 'adv-d4*'` 空输出），
与 §6 登记的「自称删净」一致，故本批无第三方残留需要处置。
