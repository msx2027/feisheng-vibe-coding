# 2026-10-01 技能正文死命令收口（owner 拍板 B）：23 个技能文件 47 行，把指向旧代工具的强制指令改为条件句

承接 `evidence/20261001-caliber-ledger-and-dead-reference-ratchet.md` §8b：死引用棘轮
（`scripts/check-skill-references.mjs`）首跑登记了 25 处存量死引，全部集中在
`skills/**` 的「必须运行某脚本」句上。owner 在三个选项里拍 **B**——不动受管块版本号、不把旧代脚本
实物化进活树，只把指令文本改回与实物对齐的 2026-09-17 已验证条件句。本文登记逐条处置、本批自查
带的两处检查器缺陷、**七路**对抗复核查实并修的问题（§4b 两路 7 类、§4c 第三路逐条复算本文数字 9 条、
§4d 第四路查口径封闭性 9 条、§4e 第五路把本批写下的读数再独立跑一遍——它否证了本文「一组死指数不可复现」
的判定，并查实本批自己的复算脚本静默换了口径；§4f 第六、七路只打在 §4e 这批新写文本上，又查出 7 条本批自己
写下的口径漏洞），以及收口过程中新查实但**本批不动**的三层更深问题。
最终落地面（`git diff --stat -- skills` 实测）：**23 个文件、47 增 47 删**；其中 §3 登记面 15 个文件，
§4b 复核补改另 8 个文件 + 回改已触及文件。

## 1. 病与第一性裁决

- **病**：`resolve-target-doc-context.mjs`、`check-target-doc-names.mjs`、`update-target-task-state.mjs`、
  `check-api-contracts.mjs`、`check-ui-reuse.mjs`、`constitution-rules.mjs` 等脚本名只存在于
  `sources/**` 保真快照。快照只读、不可执行、永不下发，所以技能正文实际是在教每一个读到它的模型
  去跑盘上不存在的命令：执行者要么当场扑空，要么静默跳过整个收口步骤（后者更坏——门禁看不见，
  「已校验」被口头声明）。偏差发生在指令层，路径门禁与口径账本都照不到。
- **为什么不选 A（只改受管块模板那一行）**：受管块里 6 句中有 5 句早在 2026-09-17 就带了免责条件句，
  真害在技能正文；只改门面等于把同一件事在两个面上留两种口径。
- **为什么不选 C（把旧代脚本实物化进活树）**：原实现只在已删除的源项目里，照快照重写等于把旧代契约
  请回来并制造第二个 owner；owner 边界 ① 也明写「不补齐 8 个未评审脚本」。
- **B 的口径**（与 2026-09-17 受管块同款，两分支都可核对）：
  ① 目标项目自备等价脚本时按其实际用法运行；② 未自备时由协作方按同一口径人工完成并留证据，
  且**明写不得口头声明机器校验／门禁已生效**。所有语义约束原样保留（role 清单、`onDemand` 不全文读取、
  请求 `never` 被拒绝即停止、胶囊输入、revision-aware 乐观锁的读旧值—比对—原位改写—重算、
  四字中文命名校验不通过不得声明完成、模板只发资产时改名与占位符替换步骤）。

## 2. 范围：25 处登记存量 + 1 处棘轮看不见的同技能自相矛盾（复核又补 7 类，见 §4b）

原本只承诺改 §8b 里那 5 个 `SKILL.md`。动手时把登记面上 25 处一并改了——同一病灶、同一句式，
只改一半会在同一套文档里留下两种口径。另加 1 处棘轮抓不到、但与本批改后的文本直接对立的：
`skills/product/ui-system-guardian/references/workflow.md` 的 init 流程第 6 步原写
「复制或接入 `tools/check-ui-reuse.mjs`」（教模型从分发包里取脚本），而同技能的 `SKILL.md`
本批刚改成「本包不随发该脚本」。不改它就是把自相矛盾留在同一技能的两份文档里。

## 3. 逐条处置（26 处）

规则含义：R1＝包根占位符路径必须真实存在；R2＝SKILL.md 依赖块声明的本包工具必须存在；
R3＝裸脚本名必须在本包可执行面内。

| # | 规则 | 文件 | token | 处置 |
|---|------|------|-------|------|
| 1 | R1 | `architecture-foundation/SKILL.md` | `<skills-root>/tools/architecture-foundation-policy.mjs` | **改指真源**：判定按本技能「地基只管高代价决策」段判据走；不为触发判定另设第二个 owner |
| 2 | R3 | `bug-fixer/SKILL.md` | `resolve-target-doc-context.mjs` | 降条件句，role 清单与「请求 `never` 被拒绝即停止」保留 |
| 3 | R1 | `design-brief-builder/SKILL.md` | `<skills仓库>/tools/check-target-doc-names.mjs` | 降条件句，保留「命名校验不通过不得声明完成」 |
| 4 | R1 | `dev-builder/references/workflow-initialization.md` | `<skills-root>/tools/setup-target-hooks.mjs` | **改指活树真入口** `skills/product/hotspot-governor/tools/install-hotspot-gate.mjs` |
| 5 | R1 | `dev-builder/SKILL.md` | `<skills-root>/tools/init-target-task-context.mjs` | 降条件句，保留胶囊目录与 `实现上下文.jsonl` 检查 |
| 6,7 | R1 | `dev-builder/SKILL.md` ×2 | `<skills-root>/tools/render-project-scaffold.sh` | 改口径为「本包只随发模板资产，不随发渲染器」，保留改名与占位符替换步骤 |
| 8 | R1 | `dev-builder/SKILL.md` | `<skills-root>/tools/resolve-target-doc-context.mjs` | 降条件句 |
| 9 | R1 | `dev-builder/SKILL.md` | `<skills仓库>/tools/check-target-doc-names.mjs` | 降条件句 |
| 10,11,12 | R3 | `dev-builder/SKILL.md` | `build-target-doc-index.mjs`／`check-target-doc-drift.mjs`／`update-target-task-state.mjs` | 三件一处合并降条件句，乐观锁口径逐步写出（先读 `任务状态.json` 现有 revision 作期望值，只在未变时原位改写并重算） |
| 13 | R1 | `dev-planner/SKILL.md` | `<skills仓库>/tools/check-target-doc-names.mjs` | 降条件句 |
| 14 | R3 | `dev-planner/SKILL.md` | `check-api-contracts.mjs` | 降条件句，人工兜底口径＝「新增入口已先写进 `接口契约.md` 且只留一个统一入口」 |
| 15 | R3 | `dev-planner/SKILL.md` | `resolve-target-doc-context.mjs` | 降条件句 |
| 16 | R1 | `product-spec-builder/SKILL.md` | `<skills仓库>/tools/check-target-doc-names.mjs` | 降条件句 |
| 17 | R3 | `product-spec-builder/SKILL.md` | `check-target-doc-names.mjs` | 降条件句（同一文件第二处，措辞不同故独立成条） |
| 18 | R3 | `product-spec-builder/templates/product-spec-template.md` | `check-api-contracts.mjs` | 契约表「门禁」行改为人可核对的两分支口径 |
| 19 | R3 | `release-builder/SKILL.md` | `resolve-target-doc-context.mjs` | 降条件句 |
| 20,21 | R3 | `rule-harvester/SKILL.md` | `check-constitution-rules.mjs`／`constitution-rules.mjs` | **改指活树真符号**：`skills/event/experience-elevator/tools/init-target-runtime.mjs` 的 `getConstitutionBody()`（842 行）与 `TARGET_RUNTIME_BLOCK_VERSION`（53 行，写该条时值 `"23"`；同日 C 批按 owner 第 ① 项升为 `"24"`，见 §9）；
登记表与双向校验脚本降条件句，并如实写明「本包没有这道机器校验」 |
| 22 | R3 | `test-automation/SKILL.md` | `resolve-target-doc-context.mjs` | 降条件句 |
| 23,24 | R2 | `ui-system-guardian/SKILL.md`（依赖块＋门禁模式＋hard gate 行＋「优先复用本分发包」句）与 `references/audit-rules.md` | `tools/check-ui-reuse.mjs` | 依赖块改述为「目标项目自有的 UI 复用门禁脚本」；删掉「缺少时优先复用本分发包」这一条**假承诺**（包内根本没有该脚本），改为「按 `references/audit-rules.md` 清单人工核对并说明未自动化，确需自动化由项目自建并登记为项目自有门禁」 |
| 25 | R3 | `ui/ui-ux-pro-max/references/professional-ui-checklist.md` | `check-ui-reuse.mjs` | 降条件句 |
| 26 | —（棘轮不判） | `ui-system-guardian/references/workflow.md` | init 第 6 步「复制或接入 `tools/check-ui-reuse.mjs`」 | 同 23/24 口径改写；第 7 步补「后者仅在项目内确有该脚本时」 |

改指真入口的三处（#1、#4、#20/21）不是文字游戏，而是把指令落到本批当场实测过的对象上：
`install-hotspot-gate.mjs` 实测会 `git config core.hooksPath tools/githooks` 并幂等追加一条跑
`check-hotspots --strict --staged` 的带标记 pre-commit 段；`getConstitutionBody()` 与
`TARGET_RUNTIME_BLOCK_VERSION` 实测存在于活树并可导出。其余 23 处一律降条件句，不新造承诺。

## 4. 本批自查：棘轮自己带的三处缺陷（都是真缺陷，已修）

- **计数混标**：汇总行原本打印 `未登记 ${errors.length}`，而 `errors` 里同时装着「未登记新增」和
  「基线登记过期」两类。实测把 25 条存量收口后再跑，输出是「未登记 25 处」——数字方向完全相反，
  读数的人会以为又新长了 25 处，进而把已改好的正文再改一遍。改为 `unregisteredHits`／
  `staleRegistrations` 双计数器分别打印，并加回归钉断言两者不得混标（同时造 1 处未登记＋1 条过期，
  要求「未登记新增 1 处」「基线登记过期 1 条须删除」且不得出现「未登记新增 2」）。
- **基线 JSON 坏掉走裸堆栈**：`JSON.parse` 未包 try，头注却承诺「基线畸形非零并点名」。实测坏基线
  打印的是 `SyntaxError ... at JSON.parse`，下游会当成检查器崩了而不是自己有活要修。现包成两行成品
  诊断（文件路径＋修复动作），缺 `entries` 数组那条也补上修复动作。
- **读数不封闭（第三路逐数字复算查实的，见 §4c）**：`SKIP_DIRS` 不跳 `.qoder`，而那是子代理 worktree
  的落点——里面是整棵仓库的临时副本，既有 `skills/**.md` 正文，也有一个**名为 `.git` 的指针文件**。
  后果分两层，且**两层触面不同**（早先把两层都写成「默认档就会」，是本批自己的口径不严谨）：①默认档下
  **只有可执行面基数会飘**——副本在仓库根的 `.qoder/` 下，不在 `skills/` 里，扫描数不动，而可执行面是
  从仓库根整树算的（复核会话实测 693 对干净树 692，差的正是那个名为 `.git` 的文件），这个数已被当实测值
  钉进交接文档；②**副本正文被当本包正文判**只在扫描面扩到仓库根（`--scope .`）时成立，本包门禁跑默认档
  所以自己不会中招，但 `--scope` 是文档化开关、下游把扫描面指向自己仓库根就会中招。门禁读数必须与
  自己正在查的内容无关，故把 `.qoder` 加入 `SKIP_DIRS`，并用一条夹具用例**两层各钉一次**：默认档下副本
  不计入可执行面（拆副本前后基数逐字相同），`--scope .` 下副本不计入扫描面且副本正文不判死引（该断言是
  突变验证过的：把 `.qoder` 从 `SKIP_DIRS` 摘掉即 1 例红，且红点落在扩面那次而非默认档那次）。
- **根因**：本包这条棘轮**没有任何测试文件**（`tests/` 零命中），而它的下游移植版有 15 例。
  无测试的门禁会把这类毛病原样下发给每个消费者。本批补 `tests/test-check-skill-references.mjs`
  24 例，并接进 `scripts/verify.ps1` 为新步「技能正文死引用棘轮单测」（5h），默认档 24→25 步、
  全开 26→27 步，README 徽章／正文与交接文档四处数字同步（步数由末步自计核对，写错即红）。
  24 例覆盖面：R1 红绿＋包根占位符四种写法（`<skills仓库>`／`<本包>`／`<包根>`／`<skillsRoot>`）都认＋
  非包根占位符不判；R2 红绿＋「路径写错但同名工具存在只纠路径不判假依赖」＋依赖块在字段标签处结束；
  R3 红绿＋**快照里有 ≠ 本包有**（`sources/**` 同名脚本不计入可执行面）＋宿主命令永不判（夹具含
  真实形态 `npm.cmd`／`pwsh.ps1`，确保豁免集合不是空转）；棘轮三态（存量登记降级不阻断／登记过期判红／
  计数分治）；基线两种畸形都给成品诊断；`--print-baseline` 出条目且 exit 0；`--scope` 换扫描面；
  **覆盖边界如实钉住「不判」**（死引的 `.md` 文档面、裸 `.cjs` 脚本名、带目录前缀的路径三种形态——
  后两条各用一个夹具专钉一个盲区，避免把「扩展名盲区」误钉成「前缀盲区」）；
  子代理 scratch 目录不进面且读数封闭。
  这批用例做过突变验证（在临时副本上改检查器，不动本仓）：汇总行改回混标 → 3 例红；坏基线回退裸堆栈
  → 4 例红；去掉 `entries` 数组守卫 → 1 例红；把 `sources/` 计入可执行面 → 1 例红；R3 短路 → 7 例红；
  依赖块永不结束 → 1 例红；删宿主命令豁免 → 1 例红；把 `cjs` 加进扩展名集合 → 1 例红；
  把 `.qoder` 从 `SKIP_DIRS` 摘掉 → 1 例红。

## 4b. 两路对抗复核：查实 7 类（逐处已修）＋ 查实不修 5 项

按 owner 规矩「自跑全绿不算证据」，收口后派两路子代理独立复核：一路查**正文诚实性**（我改写时有没有
新造承诺、有没有把原有语义改弱），一路查**覆盖率与同技能一致性**（有没有同一技能两份文档两种口径）。
两路都按文件＋行报，我逐条复验后才动。

**查实并修（7 类，逐处数如下）**：

- **新造的谎 1 处**：`rule-harvester/SKILL.md:66` 我写了「规则身份证与护栏档位以受管块正文为唯一真源」——
  复核实测 `getConstitutionBody()` 返回 101 行，正文里 `protected`／`candidate`／`background`／「档位」／
  「身份证」各出现 **0 次**，即正文只给规则文字，根本不含身份证与档位。已改为「正文只是文字真源，
  本包内没有机器化身份证／档位真源，判档只能人工标注留证据」，并在同文件 `:140` 用同一口径。
- **被我改弱的原有语义 7 处**：`design-brief-builder/SKILL.md` 两处丢了旧代 `--require-existing`
  的「**缺文件即阻塞**」力度（只写成「按其用法运行」）；`bug-fixer`／`dev-builder`／`dev-planner`／
  `release-builder`／`test-automation` 五份正文的「目标项目上下文加载协议」段把专名禁令
  `--allow-never` 泛化成「请求 never」——均补回原力度（实测改后 `grep -rn allow-never skills/`
  恰命中这五份各 1 次，加 `init-target-runtime.mjs:255` 下发给下游的那条共 6 处）。
- **手工渲染窄于旧代渲染器 1 处（后果最重）**：`dev-builder/SKILL.md:72` 我原来只写「整树复制 +
  去 `.template` 后缀」，实测旧代渲染器 `main()` 还会①合成 `_target-docs/`（`_vibe-docs.json.template`
  ＋`文档索引.md.template`＋`docs/` 下 9 份生命周期文档模板，逐个 `ls` 核过）、②Web/Desktop 三模板
  合成 `_shared-ui/src/shared/ui/`（实测恰 `button/card/index/tokens` 四份），③改名规则是通用的
  「去 `.template` ＋ 文件名以 `_` 起头者把 `_` 换成 `.`」。照我原来的写法手工渲染，目标项目会缺
  整套文档骨架与 UI 起点。已扩成六步口径并写明旧代还拷 33 个目标项目工具而本包一律不随发。
- **同技能残留自相矛盾 11 处**：`ui-system-guardian/references/workflow.md:66` 仍写「优先复用本分发包
  版本」（包内无此脚本）、同文件 gate 流程第 1 步同问题；`dev-builder/references/workflow-initialization.md:36`
  仍写「模板自带 `tools/check-api-contracts.mjs`」；`hotspot-governor/SKILL.md:110` 仍写
  「真人话术级回归由 `tools/test-hotspot-governor-human-scenarios.mjs` 覆盖」——实测该脚本活树零命中，
  这是**假承诺**而非死引用，棘轮按设计看不见（`.mjs` 目标在文档面不判）；另有 7 处裸写
  「运行 `tools/…mjs`／`bash tools/…sh`」分布在 `dev-builder/references/{development-rules,ui-token-component-reuse}`、
  `dev-planner/references/{workflow-generation,workflow-iteration}`、`dev-planner/templates/dev-plan-template`、
  `product-spec-builder/references/{workflow-iteration,workflow-zero-to-one}` 七个**本批首次改动**的文件。
  全部按同一条件句收口。
- **路径写错 1 处**：`workflow-initialization.md:33` 的 `references/routes-rescue.md` 实际在
  `governance/sliver-core/references/routes-rescue.md`（`find` 全仓唯一命中），已改指实测路径。
- **测试自身恒真/名不符实 2 处**：`.cjs` 不判那条用例的夹具其实带目录前缀，钉的是「前缀盲区」而不是
  「扩展名盲区」；宿主命令豁免那条的夹具没有扩展名，豁免集合是空转。改为裸 `generate-tokens.cjs` 与
  真实形态 `npm.cmd`／`pwsh.ps1`，并把前缀盲区单独立一条用例。改完做突变验证确认「有牙」（见 §4）。
- **棘轮当场抓住我自己新引入的死引 1 处**：改写在正文里的裸脚本名 `test-runtime-project-scaffold.sh`
  命中原文件即阻断（快照里有 4 份同类自测脚本，都不随发）——改成不带后缀的 `test-runtime-project-scaffold`
  一族写法后命中回到 0。这条是本包门禁在真实工作流里拦住人的直接证据。

**查实但本批（B 批）不修（5 项，全部登记）**：同日 C 批按 owner 令（其四项 ①②③④）把这五项**逐项收口**，映射与实测见 §9。
① 受管块模板 `init-target-runtime.mjs:278` 仍以
`check-ui-reuse.mjs` 作硬拦（选项 A，动它要升版本号并重刷所有下游运行时块）；② 4 个脚手架模板的
7 个死脚本位与 33 个不随发工具（触边界 ①／③，需 owner）；③ 51 行旧扁平路径与棘轮扩面（§5-2）；
④ 文档资产面 4 组真死指（§5-3，早先记作 3 组，第 ④ 组由第三路复核查实并升格）；⑤ `provenance/LOCAL-PATCHES.json` 的 `linesChanged` 口径——
实测 44 个 `runtime-import` 文件条目里 **30 项记的是「增删之和」、9 项记的是「新增行数」、
5 项两者都不是**（如 `governance/sliver-core/SKILL.md` 记 1 而 diff 为 0/0、
`experience-elevator/references/ledger-and-elevation.md` 记 2 而新增 12 行）；
`grep -rn linesChanged` 在全部 `.ps1`／`.mjs`／`.py` 里**零命中**，即该字段无任何门禁消费，只出现在
登记 JSON 与叙述证据里，所以口径混用没有机械后果。本批只把**自己改过的**文件按「增删之和」重算，
其余历史条目不动——统一 44 项是独立小事，等 owner 令。

## 4c. 第三路复核：只查「证据里每个数字能否独立复算」（查实 9 条：6 条一次修到位、2 条随后被第四路再订正见 §4d、1 条维持原判）

前两路查正文诚实性与覆盖率；第三路按 owner 规矩再派一路，任务只有一个：**把本文的数字逐条重算**。
它开局先报了一个前提性事实——这份证据不在它那颗干净 worktree 里（HEAD=`cdf2ccf`），全部整改在主树
未提交改动中，故它一切复算回到主树只读执行。结论与处置（除末条外全部已落进本文正文）：

- **§5-1 与 §4b 末条：全部可复算 ✅**。脚手架侧 4 份模板／8 个去重脚本位／Web-Desktop 各 8、CLI 7 且缺
  的正是 `check-ui-reuse`／活树只 `check-hotspots.mjs` 一件／`copy_shared_tools()` 恰 33 且 33 件在快照
  全部存在／`build`→`check:health`→`check:docs` 串联属实。登记侧 44 个 `runtime-import` 文件条目
  `patchedSha256` **44/44 与活树相符、零 SHA-MISMATCH**，`linesChanged` 三类分布 30／9／5 逐条对上，
  `linesChanged` 在全部 `.ps1`／`.mjs`／`.py` 里零命中（无任何门禁消费）——即 §4b 末条的口径混用
  确实没有机械后果，维持「登记不修、等 owner」。
- **§5-2 数字全对，但一条定性说反了（已订正）**：51 行／17 个文件／18 条去重路径复算一致，18 条补分类
  前缀后全部命中活树真文件。可其中 `skills/vibe-hooks/experience-recorder.mjs` **不是改名遗留**——它是从
  `event/experience-elevator/RUNTIME-NOTES.md:9` 的目标项目路径
  `.vibe-coding-skills/vibe-hooks/experience-recorder.mjs` 中间截出的子串，本文早先写成「唯一落到
  `adapters/` 的改名遗留」，是把 grep 误切当成了发现。已改为「**真改名遗留 17 条 ＋ 1 条伪影**」并写明
  伪影出处。
- **§5-3 的 34／84 是巧合复算，不是口径复算（已把正则写死；取哪一组死指数先后经第四、五两路，见 §4d、§4e）**：
  照本文原写的口径（「含 `/` 的 `.md`／`.yaml`／`.json` 路径 token」）字面重扫得 **47 条去重／193 次**；
  只有把含中日韩字符的段排除才落到 34／84——被排除的恰是那 13 条中文生命周期文档路径（它们确属目标项目
  命名、本就该排除，但这条排除**此前没写出来**）。且「84 行级」实为**出现次数**，按行只有 72。当时把正则
  贴进 §5-3 并改取 34／84（不同行 72）——**这仍是把一次跑当成口径**：正则写下来了，解析 base 集与字符集
  却还没写死，第四路按同一段正则复算得到 token 面 134／236／220 与死指 **33／83／71**（这一组经第五路复核
  **可复现**，是「所属技能目录」读法下的正确值；本文当时判它「复现不出来」属误判，见 §4e），
  而 47/193 与 34/84/72 这两组本批始终没能用任何一条写死的口径跑出来，已作废。**这条正是本文开篇自责的那类病
  在本批自己的证据文件上复发了两次**：
  不写正则不算可复算，只写正则、不写判定基准与字符集，同样不算。
- **§5-3 又一处「只在」说反 ＋ 计数混用（已订正）**：两份 feedback 模板在快照里有**两处**
  （`sources/vibe-coding-skills/feedback/templates/` 与 `sources/vibe-coding-skills/.claude/feedback/templates/`），
  后者才与技能正文 `:71`/`:72` 的写法对齐；`review-profiles.md` 另有
  `sources/_quarantine/vibe-claude-skills-mirror/code-review/references/` 第二份。早先「4 个去重 token／6 行」
  把两套计数混用（6 行里有 2 行挂的是另外 2 个 token）。
- **§5-3 一处真缺陷被误判成非缺陷（已升格为第 ④ 组）**：`plans/CURRENT-EXECUTION.md`×5 与
  `plans/phase-N.md`×3 早先用一句「都是目标项目/宿主应产出的工件」豁免，但
  `doc-sync-guardian/references/document-surfaces.md:10-11` 明写「**本分发包的** `DEV-PLAN.md`／
  `plans/CURRENT-EXECUTION.md`」，而仓库根实测 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、
  `DEV-PLAN.md`、`plans/` 四者全不存在；同一时间 `dev-planner/SKILL.md:38` 又禁止在新目标项目生成它们——
  两头都不成立，是同技能族的口径冲突。真缺陷由 3 组升为 **4 组／落点 8 行**。
- **`692` 不封闭（已修代码，见 §4 第三条）**：复核会话在自己那颗 worktree 里跑到 693，差额是那棵树
  多出一个**名为 `.git` 的文件**。根因与处置见 §4。
- **`tests 22; pass 22` 与 23/23 并存（已订正）**：末段「全量验证」的 5h 读数没跟着本批自己的改动刷新，
  正是 §7 该防的过期值残留。棘轮单测现为 **24 例**（多出的那条即 scratch 目录读数封闭性）。
- **`dev-builder/SKILL.md:72`「逐项」略夸（已补三处）**：六步里缺「输出目录已存在即拒」（旧代 `main()`
  在 `mkdir` 前即 `[ ! -e "$OUTPUT_DIR" ] || fail`）、缺末步四件事中的三件（写目标项目宪法／重建文档索引／
  装提交钩子——实测这三件与渲染器一样只在快照，本包只随发装受管块那一件），也没交代「拷 33 个工具」
  这步发生在渲染所选模板**之前**。三处均已写进正文。
- **交接文档 `:43` 将机械核对范围说小了（第一次订正仍不准，终稿见 §4d）**：该行称数字对账步「只机械核对
  catalog／bundle／投影／控制面四类数」，实测该步共 **40 条锚点**，还覆盖来源快照实测文件数（README 三方
  来源表中英各 3 条）与登记/runtime/退役/排除四类记录数。本批第一次订正把它写成「七类重算值」——第四路
  按 `verify.ps1` 该步逐条清点后指出**类数与锚点数是两套计数，按来源枚举实为 18 个不同重算量**，已改为
  「40 条锚点／66 个预期数字位／18 个不同重算来源」并列出全量枚举（清点脚本只读 `$docNumberRules` 数组，
  逐条取 `Expect` 里的**来源表达式**去重：$docRecordsTotal、$docRuntimeRecords、$docBundleFiles、$docRetiredRecords、
  $docOutRecords、$docSharedTotal、三方 snapshot／registered／accepted 各 3、$docFilesBySource['sliver-…']、
  Codex 与 Claude 两份投影数）。**「18」的口径必须连同去重键一起写**：按来源表达式去重得 18，
  按 PowerShell **变量名**去重得 **17**——因为 `$projectionTotals['build-codex-runtime-projection.ps1']` 与
  `['build-claude-runtime-projection.ps1']` 挂在同一个变量名下、却是两份不同的实测数；本批取 18（一个变量名
  对两个数时，数才是来源）。第六路复核时正是用这条差异把「18」重新问了一遍，两组数都可复现（本轮实测：
  40 rules／66 Expect 槽位／18 个来源表达式）。

**查实但维持原判（1 条）**：`docs/agents/issue-tracker.md` 判非缺陷属**边缘结论**——指涉文件是
`skills/engineering/code-review/SKILL.md`，该文件 `:13` 自带「tracker 配置不随本包分发」免责，`:29` 却是
无条件祈使「按 `docs/agents/issue-tracker.md` 中的 workflow 获取」。补一条硬事实：全仓 `find` 该文件名
**0 命中**（活树与三份快照都没有；`skills/engineering/code-review/` 实测只有 `SKILL.md` 与
`agents/openai.yaml`，那个 `agents/` 不是 `docs/agents/`），即它只能是目标项目侧由上游 setup 技能写出的
工件，判非缺陷站得住。本批不改写它：判据已写进 §5-3，且改它属文档面扩面那一批（§5-2 末段，等 owner 授权）。

## 4d. 第四路复核：只查「口径闭不闭、定性有没有硬事实」（本路列 9 条；其中 2 条给出的读数判定随后被第五路否证，见 §4e）

第三路证明了「不写正则的数不算数」，但它自己给出的数（47／193）后来同样没保住——所以第四路换了个问法：
**不只看数字，看每个数字背后的口径是否封闭、每条定性是否有硬事实支撑**，并要求所有读数用可执行脚本重跑
一遍（临时脚本只读，仓库零改写）。本节共 9 条：第 1、4－9 条（7 条）为第四路查实且至今成立；第 2 条的
「死指数没保住」与字符集读数、第 3 条给三组数贴的标签与「21 行」，均随后被第五路否证或订正（见 §4e）。
**抬头计数这条本身就是修订痕迹**：本节早先写「查实 8 条」，是把第 3 条（本批末轮自复算所抓）算在 8 条之外，
而条目并没有那样分节；第六路复核时逐条数过才发现，现按实际 9 条登记。

- **§4 第三条把后果说过界（已订正）**：原文写「两种时刻报出不同的**扫描数**与可执行面基数」。实测默认档
  （`--root` 不带 `--scope`）下副本落在 `skills/` 之外，**扫描数根本不动**，只有从仓库根整树算的
  **可执行面基名**会 692↔693 飘；「副本正文被当本包正文判」只在扫描面扩到仓库根（`--scope .`）时成立，
  本包门禁跑默认档所以自己不中招，但 `--scope` 是文档化开关、下游扩面就中招。已按两层各自的触面重写。
- **§5-3 两组旧数作废重取（本条一半成立、一半被第五路推翻）**：47／193 与 34／84／72 三选一，本批至终
  没能用任何一条写死的口径复现出来，作废。第四路把口径列成扫描面 161 个文件／token 正则连字符集／解析 base 集三条，
  token 面 **134 条去重／236 次／220 行**当场对上，这一半成立；但本文随后据此断言「死指数（当时取 33／83／71）
  **没保住**」——**这个断言是错的**，33／83／71 正是「取该文档所属的那一个技能目录」读法下的正确值，第五路
  独立跑出来了，详见 §4e。**字符集敏感性当时也量错了**：本文写下过「放汉字得 136 条／238 次、死指多 2 条」，
  并用这个「2 条」去否定更早写的「差额恰是 13 条」——**反了**。汉字真正进字符集实测 token 面
  147 条／345 次／295 行、三种 base 读法下的死指各多**恰好 13 条**（＋109 次），早先那个 13 才是对的；
  「2 条」是坏字符集量出来的（背斜杠被 shell 吃掉，正则里的 `\p{Script=Han}` 变成一串字面字符），见 §4e。
  「排除中文」这条边界的真实作用不变：**不把目标项目中文命名当本包死指**。
- **末轮自复算查清 base 集「有三种读法、三种都能跑出数」（缺陷成立，结论与标签订正如 §4e）**：写全 §5-3 口径时
  才发现「base 集」这一项此前只写成「技能目录＋其 `references/`／`templates/`＋仓库根＋`skills/`＋`governance/`」，
  而「技能目录」有三种都自洽的读法，**结果差很远**：取**文档所在目录**（`dirname`）＝40 条／91 次／79 行，
  取**该文档所属的那一个技能目录**＝33 条／83 次／71 行，取 **`skills/` 下任一目录**＝**28 条／59 次／47 行**。
  「同一段自然语言口径能跑出三组数」这件事本身就是本条要登记的缺陷，成立；不成立的是当时给它的注解——
  本文当时把 40／91／79 错标成「所属技能目录」（它是 `dirname` 的值）、并说记录的 33／83／71
  「两种读法都复现不出来」，两处均已订正。
  定稿取第三种（任一目录），理由：本面判的是「这个路径在本包里到底有没有对应文件」，名相对写法
  （`dev-builder/SKILL.md` 这类）确实有对应文件，属 §5-2 那类**路径漂移**而非假承诺；取前两种会把这一族
  重新算进死指（分别比定稿多 32 行与 24 行），与 §5-2 对同族写法的判定自相矛盾。本批一度写的「21 行」
  是 §5-2 形态集口径下的数，串错了面，已订正。定稿后 28 条全部逐条列名并分类闭合
  （8＋3＋15＋1＋1 条、15＋4＋36＋2＋2 次），下一批可直接按表施工。
- **§5-2 的口径没闭（已补测并写明）**：那条 grep 要求路径以 `skills/` 开头，**同类但写成裸技能名**的形态
  整个在面外。补测得 5 个技能族／24 个不同行（形态集放宽到 `SKILL.md|references/|templates/|scripts/|agents/`），
  只取 `SKILL.md` 时 3 个族／21 个不同行——后者与第四路自报的「3 族 21 行」逐字对上，两组数都可复现，
  差额纯粹是形态集宽窄，已把这层写出来。结论修正：「真改名遗留 17 条」只是**带前缀那一子集**的总数，
  不是这一类缺陷的总数；跨技能裸名写法实测 2 行（`development-rules.md:95`、`ui-token-component-reuse.md:82`
  指向 `ui-system-guardian/references/audit-rules.md`），同类同判、一并登记不修。这 2 行按 §5-3 定稿的
  base 集**可解析**（分类层目录作 base 时拼得出真文件），所以不进 28 条死指；但按字面路径它们仍然不存在，
  属路径漂移而非假承诺——两个面各自的判定与理由都写在文中，不再共用一个数。
- **§4c 抬头自己就是它下面那些条目所治的病（已订正）**：抬头写「8 条已修、1 条维持」，实际下面 8 条 fix
  里有 2 条的处置随后被第四路再订正。已改为「6 条一次修到位、2 条随后被第四路再订正、1 条维持原判」——
  计数分治这件事在本文自己头上也适用。
- **「同文件 `:13`」指代不明 + 缺硬事实（已补）**：§4c 与 §5-3 判 `docs/agents/issue-tracker.md` 非缺陷时，
  只说「同文件自带免责」，没写是哪个文件、也没写最硬的那条证据。现补：指涉文件是
  `skills/engineering/code-review/SKILL.md`，且全仓 `find` 该文件名 **0 命中**（活树与三份快照都没有），
  即它只能是目标项目侧产物，判断从「靠一句免责」升级为「有实测支撑」。
- **测试里两条断言是空断言（已补第三次跑）**：scratch 目录那条夹具用例原本只断言「命中 0 处」与
  「副本正文不判死引」，而这两条在把 `.qoder` 从 `SKIP_DIRS` 摘掉后**仍然全绿**——即该用例钉不住它声称
  钉的东西。补法：同一次用例里再跑一遍 `--scope .`（副本正文真进扫描面的那一档），并加**拆副本前后
  逐字相同**的对照断言。现该用例突变可红（摘掉 `SKIP_DIRS` 里的 `.qoder` → 1 例红，红点落在扩面那次）。
- **正文措辞被读成 grep 结论（4 个文件已改，但改法分两种句式，第六路逐文件核过）**：本批多处写「实测活树
  零命中」，字面是「按内容 grep 零命中」，而那些**裸名确实出现在活树文档里**（作为文字提及），下游据此会以为
  文档也消失了。已按「按文件名查、不是按内容查」改正，两个文件写成完整句式「实测按文件名在活树 `find` 零命中、
  活树无此文件」（`ui-token-component-reuse.md:82`、`hotspot-governor/SKILL.md:110`），另两个文件改的是同义的
  分布句式——「属源项目旧代工具、未随本包分发」（`dev-builder/SKILL.md` 的胶囊／resolver／状态写入／文档名校验
  四处）＋「实测活树没有这些脚本文件，快照里有四份都不随发」（`workflow-initialization.md:38`）。本条早先写
  「四份文件都改成了同一句」是**「已修」声明比目标文本走得远**，第六路 grep 该句只命中 2 个文件后订正；
  语义（裸名不随发、活树无此文件）四个文件都已到位，全文 `grep 活树零命中` 现零残留。
- **一处本批自造的错字（已修）**：§4 首条「进而把把已改好的正文再改一遍」重字。

第四路另报两条**它自己口径下的读数分歧**，本批按「以 §5-3 定稿的四要素口径为准」处理而未采纳：
它把 `workflow-initialization.md:33` 的 `references/routes-rescue.md` 计为缺陷（该处已改写为实测存在的
`governance/sliver-core/references/routes-rescue.md`，本轮再 `ls` 确认在场）；其报「文档面 4 处」未含
人工读出的 `:10` 无斜杠 token（不在正则面内，另计）。两条都在 §5-3 有对应记录，不改判。

## 4e. 第五路复核：把本批写下的读数再独立跑一遍（查实 4 条，全部落在 §4d 第 2、3 条给出的判定与标签上）

第四路要求「所有读数用可执行脚本重跑」，但它重跑用的脚本本身没被复核过。第五路是只读复核（临时脚本、
禁改仓库），任务只有一个：**把本批新写的每个数字再独立跑一遍，包括再判一次本文的判定成不成立**。
结论是 §5-3 定稿口径下的读数**全部对上**（token 面 134／236／220、死指 28／59／47、三种读法各自的数、
Han 变体的面与死指、`claims = 66`、23 文件 47 行落地面、四份定稿 sha、棘轮 162 文件／692 基名／0 命中、
单测 24/24 与账本 37/37），另查出 4 条。**归属一并说清**：这 4 条都是打在**本文 §4d 第 2、3 条**上的，
而这两条的出处按现文本已无法可靠切分「第四路报的」与「本批末轮自复算抓的」——复核轮次与本批写作在同一段
会话里交错进行，所以本批只登记**条目号与内容**，不再给**单个读数**贴路别标签（此前写的「第四路判的」
「末轮自复算判的」按同一理由降级；能确定的是：口径三条列举与 token 面 134／236／220 出自第四路）。
**边界要说清**：本节与 §4d 各条小标题里仍保留的「第四路／末轮自复算」只标**发现场合**（哪一轮把这件事
摆到桌面上），不构成逐句归属担保。逐条如下——

- **本文对 33／83／71 的「不可复现」判定是错的（§4d 第 2、3 条都写它「没保住／两种读法都复现不出来」，
  现均订正）**：这一组正是「取该文档所属的那一个技能目录」读法下的值，第五路独立跑出来了。本批据此把
  「三次推翻」的说法降级：真正被推翻的是**读数标签与判定**，不是三组数本身——三种读法各有可复现的一组数，
  缺的是把读法写死。
- **40／91／79 的读法标签标错了（§4d 第 3 条，已订正）**：它是**取文档所在目录**（`dirname`）
  的值，不是「所属技能目录」。一处标错会让下一批按错的读法去复算，正好复现不出任何一组——这条比数字错更贵，
  第七路就照着错的标签按字面 dirname 跑了一次，得 50／110／95（差一整组，因为本批实际跑的时候隐含地给三种
  读法都拼了共享尾巴；尾巴现已写进 §5-3 口径 ③，见 §4f）。
- **「差额只有 2 条」是坏掉的字符集量出来的，13 条才是对的（已订正，且根因已复现）**：本批早先用 `node -e`／heredoc 传
  含 `\p{Script=Han}` 的正则，shell 的双引号把背斜杠吃掉，类内变成一串**字面字符**，实测其
  `re.source` 为 `[p{Script=Han}A-Za-z0-9._<>-]+(?:\/[p{Script=Han}A-Za-z0-9._<>-]+)+.(?:md|yaml|json)`
  ——不仅字符集换了，连 `.` 都从字面点变成了「任意字符」。脚本**不报错**，却悄悄换了口径，因此它给出的
  136／238 与「死指多 2 条」都是假数。第七路**用这个坏形态原样跑出 136／238／222**，与本批当时留下的数逐位相同，
  即根因不是推测。改用文件＋`String.raw` 后实测：面 147／345／295，死指在三种读法下
  各自**恰好多 13 条**（40→53、33→46、28→41，出现次数各 +109），新增 13 条全是目标项目侧中文命名。
- **「取前者会把 21 行算进死指」串错了面（已订正）**：21 是 §5-2 形态集口径下的行数，与 base 集读法无关；
  base 集读法下的真实差值是比定稿多 **32 行**（`dirname`）与 **24 行**（所属技能目录）。

**本路的元发现（比任何单个数字都重要）**：前三路都在治「文档里的数没有口径」，而第五、六、七这几轮查出**复算工具自己
就是第四个口径源**。它不报错、照样输出两组数，所以「我用脚本重跑过」并不自动等于「我的数可复算」。本批
落下的三条规矩，写进 §5-3 与交接文档，下一批必须照做：①**每次复算打印 `re.source`**（本轮已在临时脚本里
实装，上面那串坏源码就是打印出来的）；②**「本批跑不出来」与「不可复现」是两句话**，前者只描述一次尝试，
只有后者才是否证——47／193 与 34／84／72 的作废按前一句登记，不再写成「不可复现」；③**归属与「已修」声明也
要可对账**：数是谁跑的要能查、说改过的句子要 grep 得到，跑不清就降级为「本文写的」而不是硬贴路别标签
（§4f 按这三件套又查出 7 条）。

## 4f. 第六、七路复核：专门打在 §4e 这批新写文本上的两路（查实 7 条，逐条已修）

§4e 写完后再起两路并行只读复核（同样禁改仓库）：第六路只问「新写的文字自不自洽、归属贴得对不对、
『已修』声明的目标文本在不在」，第七路只问「不看本文任何标签，从头把每个数自己算一遍」。
两路各有分工，合起来查实 7 条——**全部是本批这几轮自己写下的话，不是技能正文**：

- **§4d 抬头的「8 条」与实际条目数不符（已修）**：本节列了 9 条，抬头与引言却按 8 条分治（「8 条中的 7 条」）。
  这正是 §4c 末条刚治过的那类「计数与条目脱节」，出现在**修计数的那一节**头上。现按 9 条重写，
  并把「早先为什么数成 8」留在原地而不是抹平。
- **「4 个文件都改成了同一句」说过界（已订正）**：§4d 那条措辞修正登记为「已改为『实测按文件名在活树 `find`
  零命中、活树无此文件』：dev-builder/SKILL.md、workflow-initialization.md、ui-token-component-reuse.md、
  hotspot-governor/SKILL.md」，第六路 grep 该句只命中 2 个文件——另 2 个文件当时改的是同义但不同形的句子。
  语义目标（按文件名而非按内容）四个文件都达到了，`grep 活树零命中` 全文现已零残留；登记改为分句式列出各自落点。
- **`dirname` 读法的口径当时没写全（已补，这是本批「口径写死到四要素」承诺自己的漏洞）**：第七路按字面
  「文档所在目录」跑 `dirname` 得 **50 条／110 次／95 行**，与本批登记的 40／91／79 差一整组——差额来自
  本批实际跑的时候隐含地给三种读法都拼了同一条共享尾巴（仓库根＋`skills/`＋`governance/`），而这句话
  只在 `any` 读法里写了出来。现把尾巴提到口径 ③ 的公共部分并写明「只按字面 dirname 会得到另一组数」。
- **「比定稿多 24 行／32 行」顺序与「前两种」对不上（已修）**：`dirname` 多 32 行、`skill` 多 24 行，
  原文按列举顺序写成 24／32，把两个数贴反了位置。§4e 第 2 条刚说「标签标错比数字错更贵」，同一节自己就踩了一次。
- **§5-2 的裸技能名面只给了结果、没给可执行口径（已补三条规则）**：第七路必须自行重建「技能基名集＝
  `skills/` 下两层目录基名（51 个）」「前置字符不得是 `/` 或路径字符（否则带前缀的写法被重复计入）」「族＝
  token 首段」这三条，才落到 5 族／24 行与 3 族／21 行。三缺一数就变，已把这三条写进 §5-2。
- **「18 个重算来源」缺去重键（已补）**：第七路按 PowerShell 变量名去重得 **17**，本批按来源表达式去重得 **18**，
  差在 Codex 与 Claude 两份投影数同名挂在 `$projectionTotals` 一个变量下。两组都可复现，取 18 的理由
  （一个变量名对两份不同实测数时，数才是来源）已连同数字一起写进 §4c 末条与交接文档 `:43`。
- **路别归属贴不稳（已降级）**：§4d 第 2、3 条里「哪一句出自第四路、哪一句出自末轮自复算」按现文本无法可靠
  切分——复核与写作在同一会话里交错。本批此前多处把这些读数写成「第四路报的／第四路判的」，现统一降级为
  「本文（§4d）写的」，只保留能站住的那条归属（口径三条列举与 token 面 134／236／220 确为第四路所出）。

**两路独立复现一致的部分**（登记以免下批重跑）：扫描面 161、token 面 134／236／220、三种读法各自的死指数、
Han 变体面 147／345／295 与三种读法各 +13 条（＋109 次）、28 条分类闭合 8＋3＋15＋1＋1／15＋4＋36＋2＋2、
真缺陷 8 条＝15 次落 12 个不同行且 `document-surfaces.md:10` 确在正则面外、§5-2 的 51 行／17 文件／18 条
（第 18 条伪影复现，17/17 补前缀后可解析）、6b 的 40 锚点／66 数字位、`git diff --stat -- skills` 23／47／47、
棘轮 162／692／0、单测 24/24、账本 37/37、四份定稿 sha 与 `linesChanged` 19／12／10／2。
第七路另把 §4e 的根因**做了正向复现**：用坏形态字符集（`\p` 丢背斜杠、`.` 未转义）跑出 **136／238／222**，
与本批当时留下的数逐位相同——「复算脚本自己换了口径」不是解释，是被复现的事实。

## 5. 收口过程中新查实、本批不动的三层更深问题（如实登记）

1. **脚手架模板比正文更严重**：`dev-builder/templates/project-scaffolds/` 的 **4 个**
   `package.json.template`（`next-feature-first`、`vite-feature-first`、`electron-next-feature-first`、
   `cli-feature-first`）合计声明 **8 个不同的** `tools/*.mjs` 脚本位（Web/Desktop 三份各 8 个，
   Node CLI 那份没有 `check-ui-reuse`），逐个 `find` 核过两侧：活树只有 `check-hotspots.mjs`
   存在（由 `install-hotspot-gate.mjs` 拷入目标项目），其余 **7 个在活树零命中**、在快照各有 1 份。
   缺的 7 件：`build-target-doc-index`、`check-target-doc-drift`、`check-lifecycle-doc-budget`、
   `vibe-health-check`、`check-api-contracts`、`check-runtime-sync`、`check-ui-reuse`。后果不是
   「某条命令可选缺失」而是**新项目开箱即炸**：模板里 `check:health` 串起 `check:docs`，`build` 又先跑
   `check:health`——按模板生成的项目第一次 `npm run build` 就死。
   根因在旧代渲染器：`sources/vibe-coding-skills/tools/render-project-scaffold.sh` 的
   `copy_shared_tools()` 实测向目标项目 `tools/` 逐个拷入 **33 个**目标项目工具（上面缺的 7 件都在列），
   而本包只随发模板资产、这份渲染器与它的 4 份自测脚本（`test-runtime-project-scaffold.sh`、
   `test-render-project-scaffold-security.sh`、`test-scaffold-doc-placement.mjs`、
   `test-scaffold-lockfiles.sh`）**一律不随发**——脚本位随发了，填脚本位的工具没随发。
   这条与 owner 边界 ③「所有下游项目开箱可用」正面冲突，但两条修法都越界：
   删脚本位＝改变新项目自带哪些校验（产品方向），补脚本＝边界 ① 明写不做的「补齐 8 个未评审脚本」。
   **待 owner 拍板，本批不动模板。**
2. **改名前的扁平旧路径（本批按对抗复核定型后改写了数字）**：技能文档仍以 2026-09-30 统一改名前的
   `skills/<技能名>/…` 写命令。复算口径：`grep -rEno 'skills/[A-Za-z0-9._+-]+(/[A-Za-z0-9._+-]+)*'
   --include='*.md' skills/`，再剔除本身已带分类目录（`engineering|product|ui|event`）的 token 与
   `skills/tools`／`skills/INDEX.md`／`skills/README.md`／`tree/main` 四类噪声。结果
   **51 行、17 个文件、18 条去重路径**（`ui/brand`、`ui/design-system`、`ui/layout`、`ui/typeset`、
   `ui/ui-styling`、`ui/ui-ux-pro-max` 及其 references，`product/requirements-test-designer`、
   `product/ui-system-guardian`，`event/experience-elevator`）。
   **其中 1 条是正则伪影不是缺陷**：`skills/vibe-hooks/experience-recorder.mjs` 是从
   `event/experience-elevator/RUNTIME-NOTES.md:9` 的目标项目路径
   `.vibe-coding-skills/vibe-hooks/experience-recorder.mjs` 中间截出来的子串（本批早先把它记成
   「唯一落到 `adapters/` 的改名遗留」，那是把误切当发现，已作废）。**真改名遗留为 17 条**，
   逐条 `-e` 验过：补上分类目录后 **17/17 全部解析到活树真实文件，0 条是缺文件**。例如
   `skills/ui/design-system/SKILL.md:69` 写 `node skills/design-system/scripts/generate-tokens.cjs`，
   真实文件是 `skills/ui/design-system/scripts/generate-tokens.cjs`；`skills/ui/layout/SKILL.md:59`
   写 `skills/impeccable/reference/spatial-design.md`，真身在 `skills/ui/impeccable/reference/`。
   这类是**路径漂移**而不是假承诺，修法纯机械（补前缀），但量在 51 行且分布广，属独立一批活。棘轮对这类**完全看不见**：
   它只认 `<skills-root>/…` 包根占位符（R1）与裸脚本名（R3），带普通目录前缀的路径按「目标项目自有」
   放行；且扩展名集合只有 `mjs|ps1|sh|py|cmd`，`.cjs` 与 `.md` 是盲区（本批已用测试把盲区钉成
   可见事实而非默认通过）。要收就得先扩面（R1 加「已知分类前缀白名单」＋补 `.cjs`／`.md`），
   扩面会一次性报出这批存量，必须先登记基线再谈收口——**等 owner 授权，本批不动。**
   **本条口径未收，第四路查实（见 §4d）**：上面这条 grep 要求路径以 `skills/` 开头，因此**同一类但写成裸技能名**
   （`<技能名>/SKILL.md`、`<技能名>/references/…`）的形态整个落在面外。按「技能基名 + 已知子路径」重扫
   `skills/**/*.md`：形态取 `SKILL.md|references/|templates/|scripts/|agents/` 时得 **5 个技能族／24 个不同行**，
   只取 `SKILL.md` 时得 **3 个族／21 个不同行**（两组都可复现，差额纯粹是形态集宽窄）；
   **这一面早先只给了结果没给可执行口径，第七路复算时需要自行补出三条规则才落到同一组数，现把它们写死**：
   (a) 技能基名集＝`skills/` 下两层目录的基名（实测 51 个）；(b) 前置字符不得是 `/` 或路径字符——否则
   已带分类前缀的 `skills/product/dev-builder/SKILL.md` 会被再计一次成 `dev-builder/SKILL.md`；
   (c) 「族」＝token 的首段路径，行数按 `文件:行号` 去重。缺任一条都会得到不同的数，这与 §4e 那条元发现同因。
   其中 **23 行**补上分类目录即可解析到活树真文件，**1 行**不可解析（`dev-builder/SKILL.md:43` 的
   `code-review/references/review-profiles.md`，与 §5-3 ① 是同一条缺陷的另一个面，不重复计数）。
   所以「真改名遗留 17 条」**不是这一类的总数**，只是「带 `skills/` 前缀」那一子集的总数；跨技能的裸名写法
   （如 `dev-builder/references/development-rules.md:95` 与 `ui-token-component-reuse.md:82` 指向
   `ui-system-guardian/references/audit-rules.md`）实测 2 行，属同一缺陷同类，随本批一并登记不修，
   扩面时一起收。
3. **文档资产面的死指（口径写死到可执行四要素；同一面在不同读法下有三组都可复现的读数）**：
   口径 = ①扫描面 `skills/**/*.md`（跳过 `.git`／`node_modules`／`sources`／`__pycache__`／`.venv`／`venv`／
   `dist`／`build`／`.qoder`）共 **161** 个文件；
   ②token 正则 `[A-Za-z0-9._<>-]+(?:\/[A-Za-z0-9._<>-]+)+\.(md|yaml|json)`（旗标 `gu`），字符集**不含**中日韩；
   ③解析 base 集 = **一个共享尾巴**（仓库根＋`skills/`＋`governance/`）**加上**「技能目录」那一部分，
   三种读法只差在那一部分：`dirname`＝文档所在目录（及其 `references/`／`templates/`）、
   `skill`＝该文档所属的那一个技能目录（及其 `references/`／`templates/`）、
   `any`＝`skills/` 下**每一个**目录（分类层 `skills/<类>/` 与技能层 `skills/<类>/<技能>/` 都算，
   含各自的 `references/`／`templates/`）；**共享尾巴必须写进来**——只按字面「文档所在目录」当 base 跑
   `dirname` 会得到 50 条／110 次／95 行（第七路实测），与本批登记的 40／91／79 差一整组；
   ④判「死指」= 把 token 依次拼到**每个** base 上，`existsSync` **全部**落空。
   按此实测：**token 面 134 条去重／236 次出现／220 个不同行；死指（定稿 `any`）28 条去重／59 次出现／47 个不同行。**
   **base 集为什么必须逐条列（本条的病因）**：这一项此前只写成「技能目录＋其 `references/`／`templates/`＋
   仓库根＋`skills/`＋`governance/`」，而「技能目录」有三种都自洽的读法，**三种都能跑出数、结果差很远**：
   取**文档所在目录**（`dirname`）＝40 条／91 次／79 行；取**该文档所属的那一个技能目录**＝
   **33 条／83 次／71 行**（本文此前记录的正是这一组，第五路复核证实**它可复现**，早前在 §4d 里判它
   「两种读法都复现不出来」是**复算工具自己坏了**，见 §4e）；取 **`skills/` 下任一目录**＝
   28 条／59 次／47 行。定稿取第三种，理由要说清：本面判的是「这个路径在本包里到底有没有对应文件」，
   名相对写法（`dev-builder/SKILL.md` 这类）确实有对应文件，属 §5-2 那类**路径漂移**而非假承诺；
   取前两种会把这一族重新算进死指（`dirname` 比定稿多 **32** 行、`skill` 多 **24** 行），
   与 §5-2 对同族写法的判定自相矛盾。
   **字符集敏感性（本轮先算错过一次，两值都留下）**：把汉字真正放进字符集（`\p{Script=Han}`＋`u` 旗标）
   实测 token 面 **147 条／345 次／295 行**、死指 **41 条／168 次／122 行**——差额恰是 **13 条**（＋109 次），
   新增的 13 条全部是目标项目侧中文命名（`docs/项目治理/{宪法设计,开发计划,系统架构,经验治理,验收记录}.md`、
   `docs/{设计简报,需求文档,需求变更,接口契约}.md`、`docs/plans/{第一阶段,第二阶段,第三阶段,执行光标}.md`），
   即「排除中文」这条边界的作用是**不把目标项目命名当本包死指**，数量影响是 13 条而不是本批中途一度写下的
   「只有 2 条」——那个 2 条是用坏掉的字符集量出来的（`node -e`／heredoc 把 `\p` 的背斜杠吃掉，
   类内只剩字面 `p{Script=Han}` 这些字符，脚本不报错却悄悄换了口径），详见 §4e。
   28 条死指**逐条清点**（下一批的输入就是这张表，别按「28 处都要改」理解；`次数`＝出现次数）：
   **真缺陷 4 组／8 条／15 次／分布在 12 个不同行**（其中「写下错口径的那一句」是下面的落点表 8 行，
   `document-surfaces.md:10` 在正则面外，故面内 7 行；余下 5 行是同一 token 作为目标项目产物被正常提及——
   `dev-planner/SKILL.md:38`、`current-execution-template.md:10`、`dev-plan-template.md:24`、
   `phase-detail-template.md:10`、`doc-sync-guardian/SKILL.md:69`，这些不是缺陷，别一起改）——
   `code-review/references/review-profiles.md`×1、
   `docs/language-platform-profiles.md`×2、`templates/feedback-{index,topic}-template.md`×1+1 与
   `.claude/feedback/templates/feedback-{index,topic}-template.md`×1+1（同物四名）、
   `plans/CURRENT-EXECUTION.md`×5 与 `plans/phase-N.md`×3；
   §5-2 已数过的**带 `skills/` 前缀改名遗留 3 条／4 次**——`skills/ui-system-guardian/SKILL.md`×2、
   `skills/impeccable/reference/spatial-design.md`×1、`skills/impeccable/reference/typography.md`×1；
   **目标项目／宿主／外部依赖 15 条／36 次**——`docs/brand-guidelines.md`×6、`.claude/CLAUDE.md`×5、
   `assets/design-tokens.json`×5、`.claude/feedback/FEEDBACK-INDEX.md`×3、`.codex/AGENTS.md`×3、
   `{agents,hooks,codex-hooks,tools}/INDEX.md`×1+2+2+2、`.assets/manifest.json`×2、
   `./src/{ordering,billing,fulfillment}/CONTEXT.md`×1×3、`node_modules/shadcn/package.json`×1、
   `design-system/MASTER.md`×1；**散文伪切 1 条／2 次**（`CLAUDE.md/AGENTS.md` 把「或」写成了斜杠）；
   **边缘结论 1 条／2 次**（`docs/agents/issue-tracker.md`，判据见下）。8+3+15+1+1 = 28、15+4+36+2+2 = 59 闭合。
   其中**真缺陷 4 组**的落点（`:10` 那条是无斜杠 token、不在正则面内，属人工读出的同段冲突）：
   `dev-builder/SKILL.md:43`、`development-rules.md:63`、`dev-planner/SKILL.md:81`、
   `feedback-writer/SKILL.md:66／71／72`、`document-surfaces.md:10／11`：
   ① `code-review/references/review-profiles.md` ← `dev-builder/SKILL.md:43`——把「Reviewer 隔离、
   finding 状态机、Phase ledger、Review Receipt」的整体协议指给一份活树没有的文档
   （`skills/engineering/code-review/` 实测只有 `SKILL.md` 与 `agents/openai.yaml`；原件在快照有两份：
   `sources/vibe-coding-skills/skills/code-review/references/` 与
   `sources/_quarantine/vibe-claude-skills-mirror/code-review/references/`）；
   ② `docs/language-platform-profiles.md` ← `dev-builder/references/development-rules.md:63` 与
   `dev-planner/SKILL.md:81`——两处都把「非 TS 项目验证选择矩阵 / 技术栈 Profile 详细矩阵」的准绳
   指给这份只在 `sources/vibe-coding-skills/docs/` 的文档；
   ③ `event/feedback-writer/SKILL.md` 的两份 feedback 模板**同物四名**：`:66` 写
   `templates/feedback-{index,topic}-template.md`，`:71`/`:72` 写
   `.claude/feedback/templates/feedback-{index,topic}-template.md`；`skills/event/feedback-writer/`
   实测只有 `SKILL.md` 与 `RUNTIME-NOTES.md`，两份模板在快照也有两处
   （`sources/vibe-coding-skills/feedback/templates/` 与 `sources/vibe-coding-skills/.claude/feedback/templates/`，
   后者才与 `:71`/`:72` 的写法对齐——本批早先写「只在 `feedback/templates/`」是错的，已订正）；
   ④ **计划真源两头都不成立**（复核新查实，本批早先误判为「目标项目产物」而豁免，是**把真缺陷判成非缺陷**）：
   `doc-sync-guardian/references/document-surfaces.md:10-11` 明写「需求源头：**本分发包的**
   `Product-Spec.md`／`Product-Spec-CHANGELOG.md`」「计划源头：**本分发包的** `DEV-PLAN.md`／
   `plans/CURRENT-EXECUTION.md`」，而仓库根实测 `Product-Spec.md`、`Product-Spec-CHANGELOG.md`、
   `DEV-PLAN.md`、`plans/` **四者全不存在**；同一时间 `dev-planner/SKILL.md:38` 又写
   「不允许在新目标项目里生成 `DEV-PLAN.md`、`plans/CURRENT-EXECUTION.md` 或 `plans/phase-N.md`」——
   一条说它是本包真源、一条说它不许出现在目标项目，**同一技能族内两种口径**，命中面
   `plans/CURRENT-EXECUTION.md`×5 与 `plans/phase-N.md`×3。
   **判为非缺陷**（写明判据，避免下轮重复误报）：`.claude/feedback/FEEDBACK-INDEX.md`、
   `assets/design-tokens.json`、`.assets/manifest.json`、`docs/brand-guidelines.md`、
   `node_modules/shadcn/package.json`、`./src/*/CONTEXT.md`（domain-modeling 的示例链接）、
   `docs/plans/*.md`（通配写法）均为目标项目/宿主应产出的工件或外部依赖；
   `docs/agents/issue-tracker.md` 属**边缘结论**——指涉文件 `skills/engineering/code-review/SKILL.md:13`
   自带「tracker 配置不随本包分发」免责，但 `:29`「按 `docs/agents/issue-tracker.md` 中的 workflow 获取」
   是无条件祈使，判非缺陷原本只靠住了前一句；第四路补了硬事实后升级（全仓 `find` 该文件名 0 命中，
   见 §4c 末条）。
   `{agents,hooks,codex-hooks,tools}/INDEX.md` 与 `design-system/MASTER.md` 是目标项目表面，
   `.codex/AGENTS.md`／`.claude/CLAUDE.md` 在 `rule-harvester` 正文里明确指用户全局 `~/`。
   `workflow-initialization.md:33` 的 `references/routes-rescue.md` 本批已改为
   实测存在的 `governance/sliver-core/references/routes-rescue.md`，不再计入。
   这四条属**文档面**（棘轮的扩展名集合根本不扫 `.md` 目标），修法与 §5-2 一样要先扩面再登记，
   **等 owner 授权，本批不动**（④ 是文案口径冲突，也可走口径账本登记，同样等令）。

## 6. 登记面

- `scripts/skill-reference-baseline.json`：25 条存量按各自 `why` 收口后**整批删除**，`entries: []`。
  这一步同时验证了「登记过期同样判红」真的会红——删条目前先复跑，棘轮逐条点名 25 处过期。
- `provenance/LOCAL-PATCHES.json`（`runtime-import` 命名空间，patches 16 → 17）：
  - **新条目** `skill-body-oldgen-tool-promise-reality-fix` 登记 **11 个**此前与快照逐字相同、本批起产生
    偏差的文件：design-brief-builder、release-builder、rule-harvester、ui-system-guardian 的 SKILL／
    `audit-rules.md`／`workflow.md`、ui-ux-pro-max 的 `professional-ui-checklist.md`，复核批再加
    `dev-builder/references/ui-token-component-reuse.md`、`dev-planner/references/workflow-iteration.md`、
    `product-spec-builder/references/{workflow-iteration,workflow-zero-to-one}.md`。
  - **12 个**文件落在 4 个既有条目里刷新 `patchedSha256`：`retired-capability-reference-text-fix` 6 个
    （architecture-foundation、bug-fixer、workflow-initialization、dev-planner、hotspot-governor、
    test-automation）、`anti-bloat-plan-boundary-minimal` 4 个（development-rules、workflow-generation、
    dev-plan-template、product-spec-template）、`entry-gate-description-retarget` 1 个
    （product-spec-builder/SKILL）、`vibe-dev-builder-multi-session-git-pointer` 1 个（dev-builder/SKILL）。
  - 本批定稿哈希（前 8 位，实测值）：`architecture-foundation 6563d32d`、`bug-fixer c60bf892`、
    `design-brief-builder 06a061eb`、`dev-builder/SKILL 00d632e8`、`development-rules ee7202e5`、
    `ui-token-component-reuse f6593eb4`、`workflow-initialization fb5e8859`、`dev-planner/SKILL 942f40e5`、
    `workflow-generation 4eccc8b8`、`dev-planner/references/workflow-iteration 739dff39`、
    `dev-plan-template 65dcf7e8`、`hotspot-governor 87d90bb6`、`product-spec-builder/SKILL 1de1ef04`、
    `psb/references/workflow-iteration cd7dc183`、`psb/references/workflow-zero-to-one d1f8336b`、
    `product-spec-template 1b36f397`、`release-builder 25e5634a`、`rule-harvester 0e441b96`、
    `test-automation 1288f145`、`ui-system-guardian/SKILL 55962585`、`audit-rules 794ee8ab`、
    `workflow.md bc5c467d`、`professional-ui-checklist 59e66dca`。
    （本文早先记的 `bug-fixer 2fbd6e57`／`workflow-initialization 5de7249f`／`dev-planner 127291ea`／
    `test-automation 945ee817`／`dev-builder 1877dccd` 是复核批**之前**的中间值；`dev-builder/SKILL`
    的 `ff9d2f03` 是第三路「补末步四件事」之前的中间值，`20e060ac` 又是第四路改措辞（「实测活树零命中」→
    「按文件名 `find` 零命中、活树无此文件」）之前的中间值——同批被该措辞扫到的另外三份
    （`workflow-initialization 5103b93e`、`hotspot-governor a87e7b49`、`ui-token-component-reuse 8d4b67b4`）
    同样已作废。四份的 `linesChanged` 经 `git diff --no-index --numstat` 实测复核后**均不变**
    （19／12／10／2），因为改的都在本批已经改过的那几行内。）
  - `linesChanged` 本批统一按「快照↔活树增删之和」重算，理由与实测分布见 §4b 末条。
- 行尾：`skills/**` 与 `scripts/**` 全部按 `.gitattributes` 原样落盘，未做任何批量行尾改写
  （曾误用 `grep -c '\r'` 度量得出「基线 CR 从 156 掉到 5」的假警报，用 `cat -A` 复验证明
  HEAD 与工作树同为 LF，实际无改写）。

## 7. 新鲜验证

- `node scripts/check-skill-references.mjs --root .`：扫描 162 个文件，可执行面基名 692 个，
  **命中 0 处（未登记新增 0 处、基线存量 0 处）**，exit 0。
- `node --test tests/test-check-skill-references.mjs`：**24/24 pass**。
  其中两条在补测试前是红的，暴露的就是 §4 前两个缺陷（计数混标、坏基线走裸堆栈）；第 24 条是
  第三路复核逼出来的读数封闭性用例，做过突变验证（摘掉 `.qoder` 跳过即 1 例红）。
- `node --test tests/test-check-caliber-ledger.mjs`：37/37 pass（本批未触碰账本执行器，复跑确认无回归）。
- 登记面逐文件复算（临时脚本对 `git diff --name-only -- skills` 的 23 个文件重算 sha256 与登记比对）：
  **匹配 23、过期 0、未登记 0**。
- `runtime-import` 全 44 个文件条目的 `patchedSha256` 与活树重算一致（无 SHA-MISMATCH），
  `linesChanged` 口径分布见 §4b。
- 脚手架脚本位实测口径见 §5-1（**4** 个 `package.json.template`、8 个去重 `tools/*.mjs` 脚本位，
  逐个 `find` 核过活树与快照两侧；`copy_shared_tools` 的 33 个工具名逐个点过）。
- 正文改动面：`git diff --stat -- skills` = **23 files changed, 47 insertions(+), 47 deletions(-)**。
- `scripts/verify.ps1` 全量：**25/25 步通过**（先只 23/25，两处红是登记面滞后，处置见文末「全量验证」段）。

## 8. 未做与待拍板（不藏）

> **本节全部是 B 批（本文 §1–§7）时点的读数与敞口清单。同日 C 批按 owner 令「1234 都处理」把下面
> 前四条逐条收口，末轮读数（26 步／棘轮单测 33 例／`skills` 59 文件 147 增 147 删）见 §9；
> §7 里的 24/24 与 25/25 同为 B 批中间时点值，未被回改，按本文自己的 §4e 规矩保留为历史读数并在此声明过期。**

- 受管块模板 line 278 的 `check-ui-reuse.mjs` 硬拦措辞未动（那是选项 A：要升
  `TARGET_RUNTIME_BLOCK_VERSION` 23→24 并重刷所有下游 `AGENTS.md`／`CLAUDE.md`，跨项目批量改动，等 owner）。
  —— **C 批已做模板侧，下游重刷卡在下游自己的账本数据，见 §9-①。**
- §5-1 脚手架脚本位、§5-2 扁平旧路径与棘轮扩面、§5-3 文档资产死指：均未动，等 owner 分批授权。
  §5-2 的扩面**含本批第四路新查实的裸技能名形态**（5 族／24 行，其中 2 行跨技能），
  以及第四路报但本批未采纳的两条读数分歧（`routes-rescue.md` 已修不应再计、`:10` 无斜杠 token 属人工面），
  两条的处理与理由见 §4d 末段。
- 本包是否给 `scripts/**` 加生产文件行数门：未拍板。
- **登记面与证据里的「测试例数／步数」类自由文本数字不在任何锚点集内**：本批实测三处各自漂过一次
  （棘轮单测 22→23→24 在证据与 `LOCAL-PATCHES.verification` 里各留一个过期值，门禁全绿也抓不到，
  见 §7）。要收就得给「`tests/test-*.mjs` 的实际例数」加一条常驻断言（把 JSON 登记字段与 `--test` 输出
  一并核），属新增门，**等 owner 拍板**，本批不擅自加门。
- `install-runtime-projection.ps1` 单测：仍无。
- fs-agent 侧执行光标登记行：需 `check-doc-index --fix` 刷指纹，刻意延后。

## 全量验证（已回填）

- `pwsh -NoProfile -File scripts/verify.ps1`：**25/25 steps passed，exit 0**（`all steps passed`）。
- 首轮跑的是 23/25，两处红都不是逻辑错而是登记面滞后，逐个关掉：
  1. `catalog 与 SKILL-CLASSIFICATION.json 同步` → 正文改完后 catalog 的 16 条 bundle sha 过期；
     按 owner 规则「生成镜像只能再生」执行 `pwsh scripts/build-canonical-catalog.ps1 -RepoRoot .`
     （82 records 重生成，git diff 恰 16 增 16 删，全是 sha）。
  2. `runtime include 内容完整性` → 同一条目在 1b 步逐文件对 sha，15 个改动文件全报「sha 与登记不一致」；
     再生 catalog 后转绿（files = 54）。这一步的存在本身是本批的正面证据：**改 `skills/**` 忘刷投影**
     这条路是机器拦住的，不是靠人记。
- 死引用棘轮步（5g）现报「扫描 162 个文件，可执行面基名 692 个，命中 0 处（未登记新增 0 处、基线存量
  0 处）」；棘轮单测步（5h）报 `tests 24; pass 24`——本段早先写的是 `tests 22; pass 22`，那是第三路复核
  之前的过期值，被复核自己点名（§4c），属本文开篇自责的那类「读数残留」，此处按末轮实测订正；
  口径账本两步继续绿（37/37 单测、4 条目断言）。
- **同一类过期值在本批自己的登记面也留了一处（本轮末轮自查抓到并已修）**：
  `provenance/LOCAL-PATCHES.json` 该条 `verification` 字段写的是棘轮单测 `23/23`，而 scratch 读数封闭性
  用例加进来之后实际是 `24/24`（本轮 `node --test` 重跑为 `tests 24; pass 24`）。登记面没有任何门禁消费
  `verification` 这段自由文本，所以它不会自己变红——这正是 §4e 那条元发现的另一个侧面：**没有断言的副本
  就会漂**，本批的正文、证据、登记三处各自漂过一次，全靠人工逐字段复算才抓到。已把该字段改为 `24/24`
  并写明「此前停在 23/23」的原因。
- catalog 本批共再生**四次**（三次正文批 ＋ 第四路措辞批），末次对 HEAD 的差为 **24 增 24 删** ＝ `generatedAt` 1 行 ＋ **23 条** bundle sha，
  与 `git diff --name-only -- skills` 的 23 个改动文件逐一对上（第三路复核补写 `dev-builder/SKILL.md`
  末步四件事后，该文件登记哈希由 `ff9d2f03` 变 `20e060ac`，第四路改「零命中」措辞后再变 `00d632e8`，
  `linesChanged` 始终 19）。
- 数字对账步（6b）末轮读数 **claims = 66**，与 §4c 末条给交接文档 `:43` 定稿的「40 条锚点／66 个预期数字位／
  18 个不同重算来源（去重键＝来源表达式；按变量名去重为 17）」一致——锚点数与数字位数是两套计数，
  这一点正是第四路从交接文档里揪出来的（§4c 末条）。
- **末轮整跑发生在全部写入之后**（技能正文、检查器、单测、登记面、catalog、证据、交接文档均已定稿），
  上述读数即末轮读数；本批不以「改动前跑绿」充当完工证据。**§4e 与登记面 `verification` 字段写完后再跑一轮**，
  结果仍 **25/25 steps passed，exit 0**，且逐项复现同一读数：棘轮「扫描 162 个文件／可执行面基名 692／命中 0 处」、
  棘轮单测 `tests 24; pass 24`、账本单测 37/37、`claims = 66 records = 82 runtime = 52 bundle = 453 installed = 455`、
  `default = 25 steps`。本轮只改证据、交接文档与一段自由文本登记字段，`skills/**` 零改动，
  因此 catalog 与 LOCAL-PATCHES 的 sha 类字段无需再生（同步步与完整性步在这一轮仍绿即为该判断的机器凭据）。
- **§4f 之后再整跑一轮，仍是同一组读数**（第六、七路只改本文、交接文档与登记面的自由文本字段，
  `skills/**`、检查器、单测、catalog 均零改动）：`pwsh -NoProfile -File scripts/verify.ps1` →
  **25/25 steps passed**、`claims = 66 records = 82 runtime = 52 bundle = 453 installed = 455`、
  `default = 25 steps`；棘轮「扫描 162 个文件／可执行面基名 692／命中 0 处（未登记新增 0、基线存量 0）」；
  node 三份单测分开跑——棘轮 `tests 24; pass 24; fail 0`、口径账本 `tests 37; pass 37; fail 0`、
  文档治理 `tests 18; pass 18; fail 0`（合并跑为 `tests 79; pass 79; fail 0`，与三份相加一致）；
  隐私护栏 `secret-scan` 退出码 0（新增疑似 0、阻断 0、修复剔除 0、基线存量 6 未动）；
  `git diff --stat -- skills` 仍 **23 files changed, 47 insertions(+), 47 deletions(-)**。
  整跑仍按「末轮发生在全部写入之后」的自设判据重起，不以之前那轮 25/25 充当本轮完工证据。
  **如实标注先后**：三份单测、`secret-scan`、棘轮三读数是本段末次补写证据正文**之前**几分钟跑的，
  只有门禁整跑（25/25）在之后；这条先后靠下面那条 A/B 实测兜住——只改证据正文不动其它任何面时，
  门禁输出逐字节不变，所以那三项读数不会因为这最后一次补写而变化（不是推测，是实测）。
- **A/B 实测：证据正文不进任何锚点**（末轮自证，用 `diff` 而非口头声明）。两次整跑分别落在
  `14:46` 与 `14:50`，中间只发生过一次仓库写入——本文本段的那条补写（文件 mtime `14:49:24`），
  其余三个写入面（`provenance/LOCAL-PATCHES.json` `14:11:59`、`docs/HANDOFF-NEXT.md` `14:34:34`、
  `evidence/20261001-caliber-ledger-and-dead-reference-ratchet.md` `14:35:00`）均早于 `14:46`。
  两次输出 **各 2010 字节、`diff` 零差异**，且都含同一行 `claims = 66 records = 82 runtime = 52
  bundle = 453 installed = 455`。这正是 §8 那条「自由文本数字不在锚点集内」的正面侧写：
  证据与交接文档的叙述文字**不会被门禁消费**，所以本文写错了数不会变红——要靠人逐字段复算，
  本批七路复核干的就是这件事。
  **最后一轮在这批路别归属与口径补全全部写完之后再起，仍是 25/25 steps passed**；本批每一轮都是改完东西
  重跑的，没有一次是复用上轮结果——按会话记录数不出一个可靠的「共几轮」（首轮 23/25 两条红，之后各轮全绿），
  故此处不写具体轮数，只写「末轮在所有写入之后」这条可核判据。
- 复跑顺序说明：先 `pwsh` 再生 catalog，再整跑门禁——`build-canonical-catalog.ps1` 在 PowerShell 5.1 下
  拒绝写仓库内文件（排版膨胀 158,273→289,370 字节的实测结论，见 2026-09-28 批），首轮我正是用
  `powershell` 起门禁才看到那两条红。


## 9. C 批：owner 令「1234 都处理，处理完成后提交推送」（2026-10-01 同日）

owner 的四项对应本文 §5 三层更深问题 + §4b 末条 + 上一批（`20261001-caliber-ledger-and-dead-reference-ratchet.md` §8）
的受管块敞口，映射如下：**①＝受管块选项 A**（本文 §4b①）、**②＝棘轮扩面**（含 §5-1 脚手架脚本位、§5-2 扁平
旧路径与裸技能名）、**③＝文档资产面 4 组真死指**（§5-3）、**④＝无门管的数字**（§4b⑤ `linesChanged`、
§8 的目录存量与测试例数）。B 批 §4b 登记的「不修 5 项」至此逐项关闭。

### 9-① 受管块：模板侧两行，下游侧卡在下游自己的账本

改动面：`git diff --numstat -- skills/event/experience-elevator/tools/init-target-runtime.mjs` =
**2 增 2 删**，两行都在模板字符串里——

- `:53` `TARGET_RUNTIME_BLOCK_VERSION` `"23"` → `"24"`（契约文本变更信号；机制原生支持升版：存量块下次
  `--check` 即报待刷新，`--upgrade` 换新，无迁移代码）。
- `:278` UI 复用条：原句「UI / token 复用**硬拦以** \`check-ui-reuse.mjs\` 与 \`ui-system-guardian\` **为执行口径**」，改为
  口径以本包 `ui-system-guardian` 为准、机器化扫描按**目标项目自备**的门禁脚本执行（写明常见位置
  `tools/check-ui-reuse.mjs`、该脚本不随本包分发、项目内已有则按其用法跑、**未自备时不得声称「已安装」**、
  改按 `ui-system-guardian` 清单人工核对并留证据）。「待生效」从句逐字保留。
  改的是「承诺了什么」而不是排版：v23 块向每个下游项目宣告一个本包不下发的脚本为硬拦口径，下游照抄就
  得到一个跑不了的命令。

**下游重刷实测（新鲜跑，非推断）**：在 `E:\fs-agent` 里跑
`node <本包>/skills/event/experience-elevator/tools/init-target-runtime.mjs . --skills-root <本包> --check --json`
→ `summary = { changes: 3, failures: 1 }`、`exitCode 1`。三条 pending 是预期的机制行为：
`AGENTS.md`「version 23 -> 24」、`CLAUDE.md`「version 23 -> 24」、`.vibe-runtime.json`「runtime registry changed」。
唯一 failure **不是本包的**，是 fs-agent 自己的经验账本：
`docs/项目治理/经验治理.md → parseLedger.experiences[56].confirmationHistory[0]: 未知额外字段 confirmationMaterial`。

复算（真树只读）。**口径先立一条规矩**：那份账本各线共享，绝对行号一天内就漂过（本节初稿写的
`3898／3912／3142` 到次日实测已变成 `3906／3920／3150`，本包自己抓不到这种漂，因为它不在任何锚点面内），
所以下面一律按 **experienceId + 字段路径**记，不记行号。

`EXP-257` 这一条手写条目经隔离副本逐处修、逐处验，查实是**四处独立缺陷**，不是一处：

- **① 未知字段**：`confirmationHistory[0]` 与 `confirmation` 两处各带一个 `"confirmationMaterial"`，
  值是人读的升档凭据串。该字段在本包**全部历史**（`git log -S` 跨 `--all`）零命中，本包从未定义、也从未写过它。
- **② 凭据没进全局数组**：`CONF-20260930-001` 只出现在 `EXP-257` 内部（2 次），全局 `consumedConfirmations`
  里没有它；账本核要求条目内 `confirmationHistory` 与全局 canonical 凭据**双向 exact 且顺序一致**
  （`experience-ledger-core.mjs:309`）。
- **③ 凭据哈希不是 canonical 口径**：账本核要的是「7 个 canonical 字段（`receiptId/eventId/experienceId/
  scope/action/tier/confirmedAt`）JSON 的 sha256」（`experience-ledger-core.mjs:186` + `:607`）。按该口径重算
  得 `sha256:b77b5d52…`，条目登记的是 `sha256:7e8d23af…`；后者经变体穷举**恰等于对 `confirmationMaterial`
  那个材料串本身取 sha256**——且下游提交 **f2abd8cc** 的说明自述「哈希 sha256:7e8d23af… 系确认材料串实算」。
  同文件另外三条**机器写入**的凭据（`CONF-20260923-001`／`0928-001`／`0929-001`）按 canonical 口径重算
  **三条全等**，所以不是本包口径读错，是那一条手写条目换了口径。
- **④ trajectory 行带了注解**：账本核的升档行必须是 `^YYYY-MM-DD 升档 L0→L1$` 整行锚定
  （`experience-ledger-core.mjs:245`），该条目写成 `2026-09-30 升档 L0→L1（用户令「升」；4 命中达…）`。
  同文件其余升档行（`09-23`／`09-27`／`09-29`）全是裸 canonical 形态——**只有这一条带括号**，
  即它偏离的是下游自己 recorder 的日常产物。

**演练到底（新鲜跑，非推断）**：隔离副本 `F:\skiils\_rehearse-fsagent-block24`（只放 `AGENTS.md`／`CLAUDE.md`／
`.vibe-docs.json`／`.vibe-runtime.json`／`docs/项目治理/{宪法设计,经验治理,经验治理-清扫}.md`，本批**从当时的真树重拷一份**，
真树零改动），四步逐处修、每步复跑 `--check`：

| 副本状态 | `--check` 读数 | 报错推进到 |
| --- | --- | --- |
| 原样 | `changes 3 / failures 1` | ① 未知额外字段 `confirmationMaterial` |
| 删掉那 2 处字段 | `changes 3 / failures 1` | ② `confirmationHistory 必须与…consumedConfirmations 双向 exact` |
| 补全局凭据条目 | `changes 3 / failures 1` | ③ `consumedConfirmations[3]: confirmationHash 与 canonical fields 不匹配` |
| 换 canonical 哈希 | `changes 3 / failures 1` | ④ `trajectory 含非 canonical 或跳档 transition` |
| 去掉 trajectory 括号 | `changes 3 / failures 0` | — |

最后一步 `--write` → **`ok = true`、`version = 24`、三个文件全 `written`**；再跑 `--check` →
`changes 0 / failures 0 / ok true`（这一步会重算块内 checksum，不等即抛 `checksum mismatch`，所以它同时是
「渲染落盘且自校验通过」的凭据）；落盘文本实测：`AGENTS.md` 与 `CLAUDE.md` 的 marker 均为 `version=24`，
新句「未自备时不得声称「已安装」」各命中 1 次，旧「硬拦执行口径」措辞两份文件各 **0 次**。

> **这条读数当时是空判，2026-10-02 落地批实测订正**：v23 的原句写法是「UI / token 复用**硬拦以** `check-ui-reuse.mjs`
> 与 `ui-system-guardian` **为执行口径**」，全仓任何版本里都不存在连写的「硬拦执行口径」这五个字——
> 拿它当「旧措辞已消失」的证据，等于用一个从来没出现过的字符串证明一件事，**0 次是恒真的**。
> 可复算的正确配对（`git -C E:\fs-agent show HEAD:AGENTS.md` 对 v23，工作树对 v25）：
> `为执行口径` 每份文件 v23 **1 次** → v25 **0 次**；`硬拦` 每份 v23 **3 次** → v25 **2 次**（余下两条是块外/别的条款：
> 第 74 行「结构阈值真源…硬拦以 `check-hotspots.mjs`」——该脚本在 fs-agent 真实存在，不属本次谎报面；
> 第 134 行「隔离工区位置门禁」在 managed block（第 3–106 行）之外）；`check-ui-reuse` v23/v24 各 1 次 → v25 **0 次**。

这一步把初稿里那句**预测**换成实测，并如实记它**错了**：初稿写「两处一起改，改完 `--write` 一步即可」，
实测是**四处**才到 `failures 0`——「本批跑不出来」与「改一处就够」都是没跑过的话。
它同时钉住两句结论：**卡点在下游数据、不在本包模板**（本包模板侧 `--check` 的三条 pending 全程正常），
且这四处**各自独立**，删字段修不完。

**本批不代改真树的理由**（不藏）：① 要动的是另一个项目的治理账本正文，账本条目属该项目真源；
② 该仓当前有在途未提交工作（本批最后一次实跑 `git status` 为 **1 项未暂存**：`docs/项目治理/经验治理.md`
自身 `10 增 2 删`；初稿记的「4 项含 staged」是 B 批时点值，同一份账本已被他线继续改过——这正是行号会漂的同因），
受管块正文一改就须同批跑它自己的 `check-doc-index --fix` 刷指纹，会与他线搅在一起（同一理由见
`20261001-caliber-ledger-and-dead-reference-ratchet.md` §8c 末条）；③ 写入受事务门控
（`init-target-runtime.mjs:798` 的 `run()`：`failures.length === 0` 才 `commitTargetTransaction`），
带故障强行刷＝绕过下游唯一真源校验；④ 第③处的修法是**替另一个项目重算一张凭据的密码学身份**
（登记哈希要改成 canonical 值），比删字段更侵入，不是本包单方面能替它定的口径。
**要刷就得先由 owner 授权把上面四处一起改到那条账本**；四处改完的副本已实测 `--write` 一步成功，
命令与读数见上表，可直接照抄到真树。

> **后续状态（2026-10-02，见 §10）**：owner 令「现在改＋刷 v24」，真树四处已改、块已刷；
> 但刷完之后去跑**下游自己的门禁**，抓出本批 v24 措辞自带的一处新死路径，块文本已再收口为 **v25**。
> 本节上面那段「marker 均为 `version=24`」是当时的真实读数，现在过期。

### 9-② 棘轮扩面：三条新判据落地 + 脚手架死脚本位改条件执行体

判据面（`scripts/check-skill-references.mjs`）本批新增／扩到：

- **R4 扩面**：`skills/` 起头的路径不再要求带扩展名——`.md`／`.json`／`.yaml` 目标与**目录形态**
  （`skills/ui-ux-pro-max/data/`、`skills/ui-styling/canvas-fonts` 这类「把目录在哪儿写成指令」的声明）
  一并进面；按字面必须存在，写法缺分类目录即判红并把本包唯一解写进诊断。
  目录形态的前置门（首段字面为 `skills`、且左邻不是路径字符）是为排除三条复算时真踩到的子串伪影：
  运行时目录 `.vibe-coding-skills/vibe-hooks/`、快照 `sources/vibe-coding-skills/tools/`、
  外链 `…/skills/tree/…`。
- **R5 新增**：`<技能基名>/SKILL.md`、`<技能基名>/references/…` 这类省略 `skills/<分类>/` 的写法；
  只认盘上真实技能基名（现取 51 个）＋已知内层子路径名（`INNER_SHAPES`），所以 `design-system/MASTER.md`
  这种目标项目产物不吞。
- **扩展名面补 `.cjs`**（`EXTS` 与 `isScriptExt` 两处一致），原「`.cjs`／`.md` 盲区」的负向用例改成正负各一条。

收口效果（新鲜跑）：`node scripts/check-skill-references.mjs --root .` →
**扫描 162 个文件、可执行面基名 692 个、技能面 51 个、地面外路径 278 处不计、命中 0 处
（未登记新增 0、基线存量 0）**，exit 0。棘轮单测 **24 → 33 例**，`node --test` → `tests 33; pass 33; fail 0`。

脚手架面（§5-1 那条「新项目开箱即炸」）：4 份 `package.json.template`（`next`／`vite`／`electron-next`／
`cli` `-feature-first`，合计 **19 增 19 删**）里那 7 个活树零命中的脚本位改成**条件执行体**——
`node -e` 先 `existsSync`，缺件打 `[skip] <路径> 未随本包脚手架分发` 并 exit 0，在件则 `execFileSync`
继承 stdio 原样跑。`check:hotspots` 保持硬拦（该工具确在发放面内，由 `install-hotspot-gate.mjs` 拷入目标项目）。
三条退出码路径实测：缺件跳过＝0／在件且失败＝1 且 fail-fast／在件且通过＝0。
- **复核路 B 查出「在件且失败」这条路径的形态不对，本批加固**：`execFileSync` 抛的是 `Error: Command failed`
  且带子进程整段 stderr，原写法没有 `catch`，于是父进程再吐一坨 V8 栈——下游看到「红＋栈」会当成脚手架坏了，
  而不是「被调的那个检查真失败了」。现 19 个脚本位（`next`／`vite`／`electron-next` 各 5、`cli` 4）统一包成
  `try{…}catch(e){process.exit(typeof e.status==='number'?e.status:1)}`：**透传子进程真实退出码**，
  拿不到码（ENOENT 之类）才退 1。四路径在临时建的真包里经 `npm run` 实跑（不是手搓 `-e` 传参，那条会因
  cmd 的引号转义把脚本体截断，第一次试就是这么假的红了）：缺件＝**0** 且打 `[skip] tools/check-runtime-sync.mjs
  未随本包脚手架分发`；在件且通过＝**0**；在件 `process.exit(3)`＝**3**（原写法这里给的是 1，把「检查说 3」
  洗成了「脚手架说 1」）；子进程抛错＝**1**；四例 `Command failed`／`Uncaught` 包装栈均 **0 命中**，
  子进程自己的输出照旧可见（`stdio:'inherit'` 未动）。四份模板改后仍 strict JSON 可 `JSON.parse`，
  `try{`／`catch(e){process.exit(…)}`／`[skip]` 三者计数逐文件为 5/5/5、5/5/5、5/5/5、4/4/4。
  登记面随之重录：这 4 个文件的 `patchedSha256` 换新（`ecb1bb24…`／`263507c3…`／`db83abd4…`／`bc457e81…`），
  `linesChanged` 逐条**不变**（8／10／10／10，因为改的是同一批行的行内内容，行数没动）——
  全仓登记条目 diff 复核为**恰好 4 处、且只动 `patchedSha256` 这一个键**。
**顺手钉一条本机实测**（模板所在项目是 `"type": "module"`，`require` 可用是这条修法成立的前提）：
Node `v24.21.0` 下在 `"type":"module"` 的包里跑 `node -e "require('fs')…"` 仍按 CommonJS 求值、正常打出
`[skip]`——不是推测，是当场建包跑出来的。

### 9-③ 文档资产面：4 组真死指逐条收口

按 §5-3 定稿的落点表改（只改「把不存在的东西当本包承诺」的 4 组；同一 token 作为**目标项目产物**被正常提及的
另外 5 行不动）：

- `dev-builder/SKILL.md:43`：`code-review/references/review-profiles.md` → 改指活树三处
  （`skills/engineering/code-review/SKILL.md` 的双轴审查与 Reviewer 隔离、本技能
  `references/phase-completion.md` 的 Phase ledger 与两个 review receipt、
  `references/workflow-continuous-development.md` 的跨 Task 合并规则），并明写那份参考文档只在 `sources/`
  快照、不要按可执行引用去找。
- `dev-builder/references/development-rules.md:63` 与 `dev-planner/SKILL.md:81`：
  `docs/language-platform-profiles.md` → 改为按 platform profile → language adapter → architecture profile
  的读取顺序推导，并写明该矩阵未随本包分发、缺登记项时问用户，不把 TypeScript 规则当通用编译门禁。
- `event/feedback-writer/SKILL.md:66／71／72`：四个模板引用（同物四名）→ 改为正文内联「索引格式」「条目格式」
  两节（frontmatter 字段与正文三节全列），并写明模板只在快照。
- `doc-sync-guardian/references/document-surfaces.md:10／11`：「需求源头／计划源头：**本分发包的**
  `Product-Spec.md`／`DEV-PLAN.md`／`plans/CURRENT-EXECUTION.md`」→ 改为目标项目 `.vibe-docs.json` 映射的
  现行真源（`需求文档.md`／`需求变更.md`／`docs/项目治理/开发计划.md`／`docs/plans/执行光标.md`），
  旧代命名加免责并点明「本包仓库根实测没有这四份文件」，与 `dev-planner` 的「不许在新目标项目生成」同口径
  ——这一条正是 §5-3 ④ 那处「同一技能族两种口径」。

### 9-④ 无门管的数字：三处收编 + 一处新门

- **新步「已登记补丁行数与实算一致」**（`verify.ps1` 步 `1c-4`，默认步数 25→**26**）：
  `provenance/LOCAL-PATCHES.json` 的 `linesChanged` 此前在全仓 `.ps1`／`.mjs`／`.py` 里**零消费者**，
  44 项三种口径并存（30 加删之和／9 只记新增／5 两者都不是）。owner 第 ④ 项令统一，现由该步机械强制：
  **对来源快照原文的 `added + deleted`**（`git diff --no-index --numstat`），本批重录 **24 项**；
  `snapshotPath == path` 的那条（sliver-core 投影双通道）活树无法复算，计入 exempt 并把条目名**打印在读数里**
  ——「检查不了」必须可见，不当成通过。
  同一步顺带机械查重复登记：同一 `path` 在 `runtime-import` 命名空间下只允许一条活条目，
  因为下游 `Get-RuntimeCopyPatches` 用哈希表按 path 收条目，重复登记不是「多记一遍」而是**后一条静默覆盖前一条**
  （实测两处重复曾让结构不变量步与行数步各报各的分母 74／75 却全绿）。
- **复核路 B 查出这条新门自己有两个「空判即绿」的洞，本批一并加固**（同一个病根：门只核有登记的条目，
  不核「登记面本身还在不在」）：
  ① **重复检测只收集不上报**——`$duplicates` 在函数里累加，返回体只把 `$errors` 当判据，所以这一步
  对它宣称要防的那件事**是盲的**。接线后**当场**抓出两条既有重复登记：
  `skills/product/design-maker/SKILL.md` 与 `skills/ui/polish/SKILL.md` 各被 `entry-gate-description-retarget`
  和 `vibe-design-maker-pencil-pitfalls-pointer`／`vibe-polish-browser-acceptance-pointer` 各记一遍，
  四条登记项的 `originalSha256／patchedSha256／linesChanged／snapshotPath` **逐字相同**（纯双记账，无语义差）。
  处置：删掉**较早**那两条（`entry-gate-description-retarget` 名下的两个文件条目），保留消费者实际生效的较后一条
  ——即删的是本来就never winning 的死记账，行为零变化。**门禁全绿状态下躺着两条重复登记**这件事本身，
  与本批要消灭的「没有消费者的数字」是同一类：写了检测≠接了检测。
  ② **对账前提塌了却判通过**——登记文件缺失时直接 `return ok=$true; checked=0`；命名空间改名／`patches` 结构变了／
  登记被清空时 `$scanned` 归零同样静默绿（缺 `linesChanged`、缺 `snapshotPath`、原文或副本缺失的条目都走 `continue`，
  不进 `checked`，只看 `checked` 的调用方会把「全批条目字段名变了」读成「没有账要对」）。
  现两处都改成 **fail-closed 判红**，且新增 `$scanned` 计数进读数。实测三形各打红：登记文件缺失 →
  `对账前提不成立：provenance/LOCAL-PATCHES.json 登记文件缺失`；把 runtime-import 命名空间整批摘掉 →
  `scanned = 0` + `对账前提不成立：runtime-import 命名空间扫到 0 个文件条目…`；重复登记 →
  `runtime-import 命名空间存在重复登记（同一 path 多条活条目，后者静默覆盖前者）`
  （第三条是**全仓真跑时抓到的真读数**，不是夹具）。
- **测试例数进锚点**：`verify.ps1` 新增 `Get-NodeTestCount`，从 `node --test` 汇总行现取 `tests N` 供 6b 对账；
  **取不到一律抛**——返回 0 或 null 会把「没跑到」写成「实测 0」，那正是本批要消灭的第二类假数。
  此前棘轮单测例数在证据、`LOCAL-PATCHES.verification`、交接文档三处各自漂过一次（22→23→24），门禁全绿抓不到。
- **四个存量目录进锚点**：`evidence/`／`tasks/`／`scripts/`／`tests/` 的文件数与 `scripts/` 子目录数由 6b 现算
  （交接文档旧数 44／38／24 全为过期值，现为 **89／42／37（另有 1 个子目录）／7**）。
- 6b 自身规模也进对账：锚点数／预期数字位数／不同量数／变量名去重数改读 `$PSCommandPath` 现算，
  此后加一条锚点不必再追改文档。末轮读数 **claims = 77**、锚点 **45**、不同量 **29**、按变量名去重 **25**
  （两组差 4 的真因见 §4c 末条：一个变量名挂多份实测数）。

### 9-新查实（不修，登记并给复现口径）：受管块生成器本体不在任何登记与比对面内

> **本节标题的定性写重了，2026-10-02 订正（正文按原样保留）**：该文件并非「不在任何比对面内」——它的 sha256 由
> `provenance/CANONICAL-CATALOG.json` 的 `bundle.files` 逐文件钉住，`verify.ps1` 步 `1b` 覆盖全部 accepted 记录的 bundle 文件；
> 落地批改 `:53`／`:278` 后步 1b 当场判红并逼出 catalog 再生，实证它**在**比对面内。本节真正成立的只有
> 「不在步 `1c` 的 VIBE-IMPORTS 条目内、不在 LOCAL-PATCHES 两套命名空间内」，即**与快照原文的分叉没有来源级对账**。
> 读数与订正见 §10-3。

这条是执行 ① 时复算出来的，与本批四项都无关，但它落在「**受管块向全下游复制承诺**」这条链上唯一的
**无凭据改动面**，所以必须写在这里：

- 生成器本体 `skills/event/experience-elevator/tools/init-target-runtime.mjs`（870 行）相对它的快照原文
  `sources/vibe-coding-skills/tools/init-target-runtime.mjs`（827 行）已分叉 **63 行**（`diff` 计 `^[<>]` 行数，
  与 `git diff --no-index --numstat` 的 `53 加 + 10 删 = 63` 同数；本批前 HEAD 版为 61 行，含 2026-09-17 模板去谎、
  2026-09-29 包根解析复活、2026-09-23 bundle 迁移、本批 v24 两行）。
  初稿此处误贴 **901 行**——把一次 `wc -l` 的两文件输出读串了行，复核路 A 复算纠正为 827；这条本身就是
  「没有断言的数字就会漂」的又一个命中，数字不在任何锚点面内。
  本批前 HEAD 版为 61 行，含 2026-09-17 模板去谎、2026-09-29 包根解析复活、2026-09-23 bundle 迁移、
  本批 v24 两行）。
- 该文件**不在**「导入副本与快照一致性」（步 `1c`）的比对面内：该步遍历
  `provenance/VIBE-IMPORTS.json` 的 **318** 个文件条目（38 个 import，扩展名分布 130 `.md`／55 `.template`／
  32 `.csv`／29 `.txt`／**3 `.mjs`**／…），逐条对 `init-target-runtime` **零命中**。
- 也**登记不了**：`LOCAL-PATCHES.json` 两套命名空间都装不下——快照命名空间的对象是 `sources/**` 树内文件
  （`tools/init-target-runtime.mjs` 那条 `snapshot = vibe-coding-skills` 的登记，其 `patchedSha256 = 6536deae…`
  实测等于**快照里那份**的当前哈希，与活树 bundle 副本无关）；`runtime-import` 命名空间的消费方只认
  VIBE-IMPORTS 里出现的偏差（`verify.ps1:322-328`：登记了却没被任何「副本偏离快照」的导入项消费＝
  `本地补丁登记未对应任何…` **fail-closed 判红**）。所以「本批这两行没登记」**不是漏登记**，
  而是现有结构里没有它能待的位置——强行登记会让步 `1c` 当场变红。
- 后果：这个文件 2026-09-17／09-29／10-01 三次契约级改动**都没有机器凭据**，唯一叙述性记录是
  `skills/event/experience-elevator/RUNTIME-NOTES.md` 里那句「含两处部署 delta」。
  「没有断言的副本就会漂」是本文 §4e 的元发现，这条是它最贵的一次命中：**漂的那一份正是下发给每个下游的那一份**。
- 修法两条（都属新增门，**等 owner 单独拍板**，本批不擅自加门）：
  (A) 给 VIBE-IMPORTS 增加「bundle 工具随迁」的当代记录条目（必须如实标注它是 2026-09-23 迁移追加而非
  2026-09-10 导入原样，否则就是把 import 记录写成没发生过的历史）；(B) 另起一层「活树可执行文件 ↔ 快照原文」
  按基名对账门，未登记分叉即红。两条的取舍点相同：**是否愿意为本包多维护一套映射**。

### 9-复核查实但本批不修（登记并给复现口径）

交叉复核路 B 与我自己复算又查出 5 条**真实但不在本批授权面内**的洞。共同特征：它们都是「门/句子的覆盖面比它
宣称的窄」，改哪一条都要动判据口径或本包技能正文的对外承诺，属新增面，**等 owner 单独拍板**，本批一律不擅自扩。

1. **R4 目录形态判据会误判目标项目自己的 `skills/` 路径**。判据按「首段字面是 `skills`」认定是本包承诺，
   但下游项目若在自己仓库里放 `skills/<自有子目录>/`，正文提及它就被判死指。
   现状靠「扫描面只有本包 `skills/**` 正文」间接躲过——本包正文里不会出现下游的 `skills/` 路径。
   一旦把棘轮扩到目标项目（owner 早前拍过「所有下游项目开箱可用」，那是受管块下发面，不是棘轮扩面），
   这条必须先在判据里区分「包根相对」与「目标根相对」，否则给的是假红。复现：在任意正文写
   `skills/notes/index.md` 且盘上不建该目录 → R4 判红。
2. **v24 那句 UI 复用把 11 类基础件列为「不手搓第二套」，而它让下游去对的清单 `ui-system-guardian/references/audit-rules.md`
   里没有其中 2 类的规则**：块内枚举是 按钮、输入、弹窗、导航、标签、列表行、卡片、状态、颜色、圆角、阴影；
   audit-rules（全文 73 行）P0 第 3 条具名的组件是
   `Button/Input/Modal/Dialog/Card/Badge/Tabs/Toast/Popover`（＋「等」），P1 覆盖裸色值、`rounded-[…]`/`shadow-[…]`、
   `box-shadow`/`border-radius`、裸 `<button>/<input>/<select>/<textarea>/<dialog>`，行 43 覆盖 variant/size/state。
   实测 `grep -i 'nav|导航|list|列表|row|Menu|Sidebar|Header'` 对该文件**零命中**——**「导航」与「列表行」两类没有任何规则**。
   （初稿这里写的是「少 颜色/圆角/阴影」，那是照抄复核路 B 的转述、我没回原文核，实为写错；
   颜色/圆角/阴影恰恰是覆盖最全的三项。这条自纠正好是 §4f 立的规矩「『已修』的句子必须 grep 得到」的反面教材，
   所以把它留在文里而不是抹平。）
   修法要么缩块内枚举到 audit-rules 真有规则的 9 类，要么给 audit-rules 补「导航件／列表行」两条 P0/P1——
   后者是改产品口径，等拍板。
3. **脚手架模板整体不在棘轮扫描面内**：`check-skill-references.mjs` 只扫 `.md`，而本批 ② 的 19 个脚本位
   全在 `*.package.json.template` 里。也就是说 §5-1 那类「新项目开箱即炸」的缺陷，**棘轮对它的重犯零可见性**
   ——本批靠的是人工复算＋单测，不是常驻门。要收就得把 `.template`／`.json` 纳入扫描面并按 JSON 语义取
   `scripts` 值，属新门。
4. **`check:health`／`build` 在零工具状态下会「绿而什么都没验」**：条件执行体对缺件打 `[skip]` 并 exit 0，
   所以一个只装了模板、一个门禁脚本都没拷的新项目，`npm run check:health` 全 skip 仍返回 0。
   这是②的修法自带的代价（当时的取舍是不炸 CI 优先于强制有门禁），不是 bug；若要改，方向是
   「skip 计数为 N 时打印醒目汇总」或「`--strict-skip` 才判红」，都要下游改调用，等拍板。
5. **`secret-scan.mjs` 对不存在的根不报错，反而就地建目录写基线**。本批一次误把 `--help` 当根传入，
   它在仓库根建出 `--help/tools/guardrails/secret-baseline.json`（`"entries": {}`）并 exit 0——
   一份**空基线**被静默写到错误路径下。若有人把它当输出重定向进真基线，等于清空隐私防线登记。
   已删除该误建目录（`git status` 复核干净，未入库）。修法：入参根不存在即报错退出、且不自动创建父目录，
   属改扫描器本身——而 `AGENTS.md` 明写这是本仓库唯一机器化隐私防线、不得放宽，所以**只登记不动**。
   复现：`node skills/product/hotspot-governor/tools/secret-scan.mjs --help` → 观察到 `--help/` 被创建。

### 9-末轮新鲜验证（全部写入之后重跑，不复用上轮结果）

- `pwsh -NoProfile -File scripts/verify.ps1` → **26/26 steps passed，exit 0**（本节写完之后重跑一次整跑，
  与加固代码后的整跑各一次，两次都 26/26；中间那次 23/26 的三条红见下条，不是靠运气绿的）。
- 加固与重录的**当场读数**（这一段是本轮唯一一次「改门 → 门立刻抓到真东西」）：整跑首轮 **23/26**，三条红分别是
  ① catalog 过期（模板又改过一次，须 pwsh 7 再生）、② `runtime include` 四条模板 sha 与登记不符（同因，
  重录 4 个 `patchedSha256`）、③ **新接线的重复登记判红**——就是我本批删掉的那两条既有重复。
  再生 catalog（`build-canonical-catalog.ps1 -RepoRoot .` → `82 records`）＋重录后重跑 → **26/26**。
- 步 `1c-4` 末轮读数（直调函数取，非读数面板）：`ok=True scanned=74 checked=73 exempt=1`
  （exempt 条目名照例打印：`governance/sliver-core/SKILL.md[sliver-core-skill-md-projected-copy-boundary]`）。
- 空判加固实测三形各打红：登记文件缺失 / runtime-import 命名空间清零 / 人为再造一条重复
  （夹具在 `F:\skiils\_tmp-scaffold-check\vacuity\case{A,B,C}`，用完随本目录一并删除；
  第三条的真读数来自全仓真跑，见上条②）。
- `node scripts/check-skill-references.mjs --root .` → 命中 0（读数见 §9-②）；
  `node --test tests/test-check-skill-references.mjs` → `tests 33; pass 33; fail 0`；
  `node --test tests/test-check-caliber-ledger.mjs` → `tests 37; pass 37; fail 0`。
- 正文改动面：`git diff --stat -- skills` = **59 files changed, 147 insertions(+), 147 deletions(-)**
  （B 批 23 文件／47 增 47 删 ＋ C 批 36 文件／100 增 100 删；其中非 `.md` 共 5 个＝生成器 2/2
  ＋ 4 份脚手架模板 19/19）。
- 登记面：`provenance/LOCAL-PATCHES.json` patches **20**、文件条目 **82**，其中 `runtime-import` 命名空间
  **14** 个 patch／**74** 个文件条目（B 批前为 11／44；本批末因删掉两条重复登记由 76 降到 74，见 §9-④）。
  catalog 由 pwsh 7 再生，`runtime bundle = 453`、`installed = 455`、`records = 82`，
  门禁「文档数字与实测一致」步末轮读数 `claims = 77 records = 82 runtime = 52 bundle = 453 installed = 455`。
- 隐私：`secret-scan` 与 pre-commit 两档扫描按 §7 口径未动基线（本批新增文本不含密钥形态字面量，
  门禁内 `secret-scan` 步在末轮整跑中为绿）。

## 10. v24 落地实测（2026-10-02 owner 令「现在改＋刷 v24」）：落地时抓出 v24 自己带的新死路径，块文本再收口为 v25

owner 一句话拍板「现在改＋刷 v24」，即授权把 §9-① 那四处改到 `E:\fs-agent` 的真账本并重刷受管块。
本节全部是**真树读数**，不沿用 §9-① 的隔离副本数。

### 10-1 账本四处（按字段路径记，仍不记行号——那份账本各线共享）

| 位置 | 改法 |
| --- | --- |
| `experiences[EXP-257].trajectory[1]` | 去掉整段括号注释，收成契约要求的裸形态 `2026-09-30 升档 L0→L1` |
| `experiences[EXP-257].confirmationHistory[0].confirmationMaterial` | 删除（本包从未定义过该字段） |
| `experiences[EXP-257].confirmation.confirmationMaterial` | 删除（同上） |
| 上述两处的 `confirmationHash` | `sha256:7e8d23af…` → `sha256:b77b5d52…` |
| `consumedConfirmations` | 追加 `CONF-20260930-001`（10 个 canonical 键、canonical 顺序），数组 3 → 4 |

改前改后在同一条命令里现算复验（不凭记忆）：7 个 canonical 字段的 sha256 =
`sha256:b77b5d523f5c54ce676568813502120291db06244ea0446c5de6dc472c1a60a2`；
旧登记值 `sha256:7e8d23af…` 恰等于**对 `confirmationMaterial` 那条材料串本身**取 sha256——
§9-① 推出的根因在真树上复算成立。改后校验：`check-experience-ledger.mjs .` →
`{"ok":true,"status":"pass","message":"台账校验通过: docs/项目治理/经验治理.md"}`。

`--check` 由 `changes 3 / failures 1` 变 `changes 3 / failures 0`（三条 pending＝两份受管块＋runtime registry），
`--write` → 三文件 `written`、exit 0，复跑 `--check` → `changes 0 / failures 0 / ok true`；
marker 当时为 `version=24`，AGENTS `checksum=sha256:7fc25284…`、CLAUDE `checksum=sha256:46c10067…`。
**中间态读数不可复算声明（本轮三路复核之账本修复路指出的口径漏洞）**：上面 `changes 3 / failures 1`、`version=24` 与那两个 checksum
是 v24 的一次性落地态——v24 块文本已被 v25 覆盖，下游与本包两侧现在都只能读到 v25，**没有任何命令能重跑出这四个值**；
它们只能由「v24 确随 `883c198` 入库」这条间接证据支撑（`git -C . show 883c198:skills/event/experience-elevator/tools/init-target-runtime.mjs`
→ `:53 = "24"`、`:278` 含 `tools/check-ui-reuse.mjs` 路径形态）。同段的 `命中 50／未登记 2`（10-2）与 `24/26`（10-3）同理。
受管块一改就得刷下游指纹：`node tools/check-doc-index.mjs --fix` 重录 `.vibe-docs.json` 的 manifest 指纹与
`文档索引.md` 的索引行，复跑三查通过。**到这一步 §9-① 的演练就算照抄完了，而它不够——见 10-2。**

### 10-2 演练没跑的那一步：下游自己的门禁把 v24 判红

`E:\fs-agent` 的 `tools/check-doc-script-refs.mjs` 实跑 **exit 1**，四条红（当次读数：命中 50 处、未登记 2 处、基线存量 48 处）：

- `✗ AGENTS.md:88`／`✗ CLAUDE.md:88` 死引·**R1 未登记新增**：`tools/check-ui-reuse.mjs`
- `✗ 基线登记已过期：R3|AGENTS.md|check-ui-reuse.mjs`／`R3|CLAUDE.md|…`（该死引实际不存在，请删除此条）

根因是**形状换了判据**：v23 那句写的是裸脚本名 `check-ui-reuse.mjs`，落在下游 R3 判据里、早已作为「上游模板死引」
被它的基线收下（登记理由原文：「收口归上游，本仓不手改受管正文」）；v24 我把它改写成路径形态
`tools/check-ui-reuse.mjs`，同一下游门的 R1 判据不认既有基线，于是**未登记新增 2 条＋原基线登记过期 2 条**同时冒出来。
定性要如实：**本批第 ① 项没治错病，是把一处谎报换成了另一处死引用**——旧句谎称有个把它「硬拦以…为执行口径」的脚本，
新句仍然指向一个本包不下发、目标项目大概率也不存在的脚本路径。

**这条差别值得钉成规矩**（下一句）：受管块正文与本包技能正文落在**不同的对账表面**上。

- **落点规矩**：凡会被写进目标仓库的下发件（managed block、脚手架模板及其 `package.json.template`），
  正文里**不得出现本包不下发的具体脚本路径或脚本名**；要指位置就写成「项目自备的 X 门禁脚本——已自备的把真实路径
  登记到本块之外的项目规则区再按该路径跑；未自备不得声称『已安装』或『已扫描』」。
  这一面由**下游仓库自己的死引门禁**兜，本包棘轮兜不住：`scripts/check-skill-references.mjs` 只扫 `skills/**` 正文，
  扫不到模板字符串注入到别人仓之后会发生什么（同一盲区此前已登记过：`.template` 整体不在扫描面，见本文
  §9-复核查实但本批不修 第 3 条）。
- **技能正文保持原样**：`skills/product/ui-system-guardian/references/workflow.md:66` 一类「常见位置
  `tools/check-ui-reuse.mjs`……本分发包不随发该脚本」的写法继续保留——它由代理在本包内就地读，是给执行者的提示，
  不进任何目标仓库的文档面。两者口径一致（都不谎称已安装），差别只在**是否随包注入他人仓库**。

### 10-3 v25 修法与本包侧读数

`:278` 去掉脚本名与路径，只留义务与激活路径，并把「本块不写它的路径」的理由就地写进句中（防后人把名字加回去）；
`:53` 版本 **24 → 25**。为什么另起一个版本号而不沿用 24 改文本：24 已随本包提交 `883c198` 推送，
版本号与块内文本必须一一对应，沿用会让「v24」指向两种内容——正是本包一直在防的那种多解口径。
本包 `scripts/verify.ps1` 首跑 **24/26**，两条红：`catalog 与 SKILL-CLASSIFICATION.json 同步`（过期）与
`runtime include 内容完整性`（`skills/event/experience-elevator/tools/init-target-runtime.mjs (sha 与登记不一致)`）；
`pwsh -NoProfile -File scripts/build-canonical-catalog.ps1 -RepoRoot .` 再生后复跑 **26/26 全绿**
（catalog 差异只有 `generatedAt` 与该文件一个 sha；records 82／bundle 453／installed 455 不变）。

**顺带否证本包自己写下的一条断言**（原断言在 §9-新查实：「受管块生成器本体不在任何登记与比对面内」）——不实：
该文件的 sha256 由 `provenance/CANONICAL-CATALOG.json` 的 `bundle.files` 逐文件钉住，步 `1b` 覆盖
**所有 accepted 状态记录的 bundle 文件**（`verify.ps1:206` 对不在 `acceptedStatuses` 的记录直接 `continue`，
所以不是字面意义的「整个 bundle」；本文件所在记录是 `accepted-event`，故在覆盖面内），
本批改 `:53`／`:278` 后步 1b 当场判红就是实证。该断言真正剩下的覆盖面只有两条：① 它不在步 `1c` 遍历的
`provenance/VIBE-IMPORTS.json` 的 318 个条目里（38 个 import 只含 3 个 `.mjs`）；② 它不在 `LOCAL-PATCHES.json`
两套命名空间里——所以它与快照原文那 63 行分叉**没有行级／来源级对账**，只有整文件哈希级。HANDOFF 已按此订正。

### 10-4 下游落地后的全套新鲜读数（写入之后重跑）

- `init-target-runtime . --check` → `version 24 -> 25`、`changes 3 / failures 0`；`--write` → 三文件 `written`；
  复跑 `--check` → `changes 0 / failures 0 / ok true`；marker 现为 `version=25`，
  AGENTS `checksum=sha256:fea15f36…`、CLAUDE `checksum=sha256:44591e1d…`；`check-ui-reuse` 字面在两份文件各 **0 次**。
- 按下游门自己的要求删掉那 2 条已失效的基线豁免（`tools/doc-script-ref-baseline.json`，删前后各解析一次并逐条比对：
  只少那 2 条、无其它增删）。**该文件的条目数登记过三次数值，按时间序全记**：本批动手前 HEAD ＝ **38**；
  我删 2 条后工作树 ＝ **36**（本节此前写的「37 → 36」是误记，复核按 HEAD 实测 38 订正——删 2 条不可能得 37→36）；
  随后下游 HEAD 移动（他线 01:11 `060d2464` 新登记 2 条 → HEAD ＝ **40**），**最终正确落点＝ 40 − 2 ＝ 38**
  （R3 35／R1 3），见 §10-10 第 1 条的那次当场补救。
  **【此处「最终」只到本批落点为止，不是现值】** 2026-10-02 复查：他线 `8c496440` 又删掉他们自己那 2 条 a5 例外，
  现 HEAD 与工作树均为 **36（R3 33／R1 3）**；全跳序列与复算命令见 §10-11 第 3 条。
  `check-doc-script-refs.mjs` 在 HEAD 移动前 **exit 0**（未登记 0／基线存量 48）；移动后为 **exit 1**，
  但两条红不是本批造成的，见 §10-10 第 2 条。
- `check-doc-index` exit 0（其输出原文「12 份登记文档指纹一致」；口径说明：`.vibe-docs.json` 的 `documents.length = 13`，其中 1 项是 `文档索引.md` 自身、不入指纹比对，**12 与 13 不是漂移**）、`check-doc-governance` exit 0（0 error／3 warn 均为存量）、
  `check-caliber-ledger` exit 0（4 条目断言全绿）、`contracts/test/**` → tests 100 / pass 100 / fail 0、
  `frontend` 的 `tsc -b` exit 0、`git diff --check` exit 0、本包 `check-experience-ledger.mjs .` → `ok:true`。
- `node tools/verify-project.mjs --fast` **未全绿**：`hotspots:test` exit 1，且它 fail-fast 挡住了后三步，
  故上面三步是逐条单独跑的。**该红不是本次改动造成的**，证据链：断言是「`parseArgs` 豁免名单必须与仓库实际定义处
  精确相等」，期望 3 项、实得 4 项，多出的是 `tools/check-style-families.mjs`（2026-10-01 commit `dbfd5c30` 由他线提交，
  内含 `parseArgs` 定义）未登记进 `tools/hotspot-policy.mjs` 的 `DUPLICATE_HELPER_FILE_EXCEPTIONS`；
  本次在 fs-agent 只触碰 6 个文件，对每个文件 `grep 'function parseArgs\|const parseArgs'` 零命中，
  且 `tools/hotspot-policy.mjs` 未被本次改动（md5 `b8dcb16d…`）。修法归它那条线（补登记或改名复用），本包不代改、不代裁。
- fs-agent 工作树最终 **6 项未提交**：`.vibe-docs.json`、`AGENTS.md`、`CLAUDE.md`、`docs/项目治理/经验治理.md`、
  `tools/doc-script-ref-baseline.json`、`文档索引.md`。其中账本那份同时含他线在途改动
  （`revision 511 → 512`、新 `processedEvents` 条目 `1cd50a2e-placeholder`／`EXP-077`、`EXP-077.count 3 → 4`）；
  本次按字段路径**纯增量**改，改后复验 `EXP-077.count` 仍 4，未回退他线任何内容。
  **未在 fs-agent 提交**（共享仓、他线在途，需单独指令）。
  **【2026-10-02 日间失效】** 这 6 项已由**他线三笔**提交入库（`85a820bf` 一次收齐 6 件、`17e6fe0b` 又改写其中 `.vibe-docs.json`
  与 `文档索引.md`、`8c496440` 删基线那 2 条 a5 例外），本包未在该仓执行过任何 `git commit`；
  HEAD 侧逐字段对账读数见 §10-11 第 1–2 条（含「归属只算间接证据」的说明）。
- 上面这三行是**本轮三路复核时的快照，其中 `revision 仍 512` 一项已失效**：见 §10-7 第 1 条——那份账本有**并发写入者**，
  本批复验时 `revision` 已自行涨到 **517**、新增 `EXP-330…EXP-333`；`文档索引.md` 与 `.vibe-docs.json` 的
  `experienceGovernance` 行随之为 **53508（HEAD）→ 54151**、指纹 `7f3121946bb8… → cb8f3a369dba…`
  （本节此前登记的 `→ 53492／29ad1bae5b7c…` 是并发写入到来前的一次性中间态，现不可复算，按上面的最终读数订正）。
  **这条订正本身也已经被下一次写入作废**：见 §10-9 第 1 条——同一份账本又涨到 134 条，索引现为
  `~54534`／`fa7a394cc06f…`。结论写死：**该文件的令牌数与指纹不可作为登记锚点，只能登记复算命令**。

### 10-5 新查实（未修，待 owner 拍板）：受管块有第二个写入者，且它停在 v23

`E:\fs-agent\.vibe-coding-skills\experience-tools\init-target-runtime.mjs:53` 仍是
`TARGET_RUNTIME_BLOCK_VERSION = "23"`。该目录**不是软链也不是回指仓库的 junction**
（`realpath` 自证：`E:\fs-agent\.vibe-coding-skills\experience-tools\init-target-runtime.mjs`），
是 2026-09-29 从旧包名位置整包拷去的**项目自备副本，`ls -1` = 14 个文件**（13 个 `.mjs` ＋ 1 份本包没有的 `README.md`；本批原记「13 文件」是漏数 README，复核订正），且自带两处对上游 `experience-governance.mjs`／
`experience-ledger-core.mjs` 的 swept 契约补丁，其 `README.md` 明写「上游包更新时以本副本为参照核对契约对齐情况」。

- 后果：任何人在 fs-agent 里跑那份副本的 `--write`，两份门面会被**降级回 v23**——即重新写进本批第 ① 项刚收口掉的那句谎报
  （`--check` 会以 `version 25 -> 23` 的 pending 出现，机制上它与正常升级完全同形，看不见就得靠人盯）。
- 本包不代改该项目那份未入库的分叉副本（改了要替它重打它那两处补丁，属越界）。
- 可收口的通用防线在**本包侧**：给 `planFile` 加降级硬拦——`block.version` 高于常量时判 `conflict`（fail）而不是
  `pending update`，让陈旧副本无法把新块写回旧文本。这是 `AGENTS.md`「runtime 版本与入口保护」一条的真实缺位，
  但它属新的授权面（动下发件核心判定＋要补契约测试），**登记待拍**，本批不擅自扩面。

### 10-6 下游存量普查（本批新查实，未刷，待拍板）

v24 那条死路径只到过 `E:\fs-agent`（唯一被刷到 24 的根），但 v23 那句谎报**在本机其他下游里还活着**。
普查口径写清楚：`find` 深度上限 3、排除 `node_modules`、按 `.vibe-runtime.json` 定位受管根——**这是有界扫描，不是全盘穷举**。
命中 4 个根（含 fs-agent）：

| 根 | 块版本 | `check-ui-reuse` 字面 | 「硬拦以…为执行口径」谎报句 | 最近提交 | 本批是否动过 |
| --- | --- | --- | --- | --- | --- |
| `E:\fs-agent` | 23 → 24 → **25** | v23/v24 各 1 → v25 **0** | v23 有（`为执行口径` 每份 1 次）→ v25 **0** | 工作树 6 项未提交（**2026-10-02 已由他线入库，见 §10-11**） | 是（本次唯一落地对象） |
| `F:\skiils\sess-find` | 23 | `AGENTS.md`／`CLAUDE.md` 各 **1** | **仍在**（`AGENTS.md:88`） | `8251ce1` 2026-09-29 | 否（其工作树原有 3 项无关改动：`.gitignore`／`bin/sf.mjs`／`test/bin.test.mjs`） |
| `G:\历史项目\deyy` | 21 | 各 **1** | **仍在**（`AGENTS.md:87`） | `f7b239ed` 2026-09-04 | 否（工作树干净，且属「历史项目」） |
| `G:\历史项目\ddzj` | 3 | 0 | 无该句（v3 早于此条款，两个字面均 0） | — | 否 |

- 建议口径（**等 owner 拍，不擅自动手**）：`sess-find` 是在会话目录里活跃使用的项目，按 ① 项同一收口刷到 v25 才有意义；
  两个 `G:\历史项目\*` 属已归档项目，刷新＝改动归档交付面，收益为零而代价是给归档面写下新的时间戳，倾向不动。
- **顺带查实的一条结构性缺位（未修，待拍板）**：本包**没有任何「下游清单」**，也没有任何门检查「哪些根停在哪个版本」。
  所以上表只能靠一次人工磁盘普查得到，且普查面受深度与目录命名限制——「向全下游复制承诺」的受管块，
  其**分发状态本身不在任何门禁的视野内**。这与 §9-新查实（生成器分叉无来源级对账）是同一条链上的两个缺口：
  前者管不到「发出去的是哪一版」，后者管不到「发的那份从哪来」。可选收口：给本包加一张 `provenance/DOWNSTREAMS.json`
  （根／块版本／checksum／最近实跑时间）＋一步门禁，把「刷新所有下游」从口头承诺变成可对账项。属新增登记面，本批不擅自建。

### 10-7 本轮三路对抗复核产物（下发件文本面／账本修复面／数字复算面）：当场修 1 处、登记 6 项

三路各自独立跑数、不许引用本文已有结论。数字面查出 1 条写错的数（已订正在 §10-4）、
定性面查出 2 条写重的口径（已订正在 §10-1／§10-3）；账本面查出 2 条**结构合法但语义错**的残留，其中 1 条当场修掉。

1. **那份账本有并发写入者（实况，非推测）**。本批复验时 `docs/项目治理/经验治理.md` 的 `revision` 已从 512 自行涨到
   **517**，`experiences` 新增 `EXP-330／331／332／333`、`processedEvents` 新增对应条目（`occurredAt` 全部落在
   2026-10-01T17:22–17:26Z，即本批手工编辑的同一时间窗内）——fs-agent 侧有自己的自动写入路径在跑。
   本次五处改动（4 处修复＋1 处 `count`）**复算后全部在场**、`check-experience-ledger.mjs` `ok:true`，因为那份写入者是
   「解析 JSON 围栏→改对象→整体重序列化」，会带上磁盘上的既有字段；**但这是运气不是保证**：若它先解析后写、
   或本包手改与它交错，我的修复会被**静默回退**且没有任何门会红。登记口径（属他人项目的自动化，本包不代改）：
   手写他人账本前先复算字段、写完立即复验；要把这类竞态变成可对账项，得由**下游自己**加字段级回归钉或单写入者锁。
2. **当场修：`EXP-257.count` 4 → 0**（本批第 5 处账本改动）。依据是账本自己的两条硬事实：
   `experience-ledger-core.mjs:703` 升档时 `exp.count = 0; // 下级计数归零、从头累积`；不变量「`count` ＝ `confirmedAt`
   之后的 `processedEvents` 条数」对三条机器写入的 L1 记录全部成立（实测 `EXP-010` 2/2、`EXP-077` 4/4、`EXP-212` 0/0）。
   `EXP-257` 独错：它的 4 条事件全在 `2026-09-29T22:36:59.450Z` **之前**（16:25:52／16:48:53／20:29:11／22:33:15），
   之后 **0** 条 → 正确值 0。不修的后果是真实的：L1→L2 阈值 5，`isAtThreshold` 会把它报成「再命中 1 次可升 L2」，
   而它 L1 阶段的真实命中为 0——下一次升档提案将建立在幻影计数上。且**没有任何门能抓到**：`assertValidCount` 只验非负整数，
   实测改前改后 `check-experience-ledger.mjs` 都是 `ok:true`。改后复验：`--check` → `changes 0 / failures 0`、
   `check-doc-governance`／`check-caliber-ledger`／`check-doc-script-refs` 各 exit 0、`--fix` 重录索引后三查通过。
3. **登记不修（需 owner 拍，动的是他人项目的规则内容）：`EXP-257` 是 L1 却不在 L1 registry 里**。
   `docs/项目治理/宪法设计.md:58-78` 的 `target-experience-registry` 只有 3 条规则（`EXP-010`／`EXP-077`／`EXP-212`，
   全 `status: "candidate"`），因此 AGENTS／CLAUDE 的第二受管块投影照原文渲染 `- 当前没有已激活的项目经验规则。`
   （`AGENTS.md:114`）——账本声称 4 条 L1，门面一条都不出。机器路径 `experience-governance.mjs:632-635` 要求升档**必须带
   `ruleText`** 并追加 registry 条目；那份账本的升档是手写的，跳过了这步。补全需要四件事：① 依 `EXP-257.summary`
   （「挂账清单转述前须逐条对main落库证据现查现列，记忆与索引钩子会过期」）定一条 `ruleText`；② `landing` 由 `null`
   改为 `docs/项目治理/宪法设计.md#target-experience-registry`（另三条 L1 皆如此）；③ 重录 registry checksum 与
   `l1RegistryAnchor.sourceHash`；④ 再刷两份门面的投影块。本批只把它的 schema 修合法，**没有替他人项目拟规则文本**。
   为什么门看不见：`assertL1RegistryAnchorMatches`（`experience-anchor-contract.mjs:56-68`）比的是「账本存的锚点哈希 vs
   registry 当前哈希」，两边同为 `sha256:a71087eb…`——**正因为这条规则从没进 registry，这对哈希才「一致」**。
4. **如实登记一处证明力降级（不是新洞，是修法的代价）**：旧 `confirmationHash` 是对 `confirmationMaterial` 那段
   **字符串本身**取 sha256（实测复算 `sha256("elevate|EXP-257|L0->L1|scope=target-project|trigger=8f46771f…|用户令「升」|2026-09-30")`
   ＝ `7e8d23af…`，与旧值逐字符相等），也就是说它把用户那句原话「升」钉进了哈希；本批按 schema 删掉该字段、
   改用 7 个 canonical 字段重算得 `b77b5d52…`，**新哈希不再绑定任何自由文本**——账本内部从此无法自证「用户确实说过升」，
   只有 git 能（`git show 50dfbc12:docs/项目治理/经验治理.md`、`git log -S confirmationMaterial` 均可复原原文，
   且他线已推送的 `f2abd8cc` 正文里逐字含「用户令「升」」与该旧哈希）。**下一次次在 fs-agent 提交时，commit message
   必须写明这次重推导**（旧值＝对材料串取哈希→schema 不允许该字段→按 canonical 字段重算），否则审计链读起来像哈希被替换。
   **【已由下游满足，2026-10-02 销账】** 他线 `85a820bf` 正文写了「确认哈希按新格式重算、命中计数清零重计」，见 §10-11 第 9 条。
   本批不替他仓写提交信息。同因残留一份会长期矛盾的运行态：`E:\fs-agent\.vibe-coding-skills\vibe-hook-state\
   stop-credential-sess_56626e54-….json:11` 断言「EXP-257 tier L1、确认凭据 CONF-20260930-001 哈希复算一致」，
   该说法只在旧口径下成立；该文件被 `.gitignore:85` 排除、不被任何门扫。属他人项目运行态，登记不改。
5. **受管块文本里还剩三处同类谎报**（与 v24 那条死路径同一类：块内声称的能力本包不存在），修＝v26＋再刷下游，属 owner 可见面：
   - `init-target-runtime.mjs:253`（＝`AGENTS.md:63`）写「只加载 `<skills-root>/.agents/skills/<skill>/SKILL.md` 或
     `<skills-root>/skills/<skill>/SKILL.md`」——**两种形态在本包都不存在**：包根无 `.agents/`（`ls -d .agents` →
     No such file），真实布局是 `skills/<分类>/<技能>/SKILL.md`（实测 `skills/checker/audit` 等）。
   - `:255`（＝`AGENTS.md:65`）声称 never 文档只能经 resolver 的 `--allow-never --reason <理由>` 这道硬门访问，
     而 `resolve-target-doc-context.mjs` **只存在于 `sources/` 快照**（`ls skills/*/*/tools/resolve-target-doc-context.mjs`
     → 不存在；`find` 仅命中 `sources/vibe-coding-skills/tools/`）——即向下游承诺一个本包不下发的闸门。
     此条本文 `:126` 早已登记，本次确认它同样被注入到他人门面里，属「登记了但下发件仍在说」的漏网面。
   - `:264` 的「硬拦以 `check-hotspots.mjs` 与结构门禁为唯一真源」：本包把它放在 `skills/product/hotspot-governor/tools/`，
     块内既不写「项目自备」也不写真实位置；下游恰好自带同名脚本才没判红，属 NIT 级同形问题。
   - **为什么本包看不见这些（REAL 级门面缺位）**：本包**没有任何门检查受管块文本**——`scripts/check-skill-references.mjs:139`
     只扫 `.md`，其头注 `:29-30` 明确把 `tools/...` 形态 token 划给「下游自有门禁负责」。于是块文本的假引用只有落到别人仓库、
     被别人那道门撞上才暴露，而这次已经为此付过一轮 v24→v25 返工。候选收口（待拍）：给本包加一步「块文本自扫」——
     把渲染出的受管块当作虚拟 `.md` 过同一套死引判据，让谎报在**下发前**红。
6. **§10-5 的降级危害由预测升级为实测**：用 fs-agent 那份 v23 副本跑只读 `--check` →
   `{"ok":false,"version":"23","exitCode":1}`，pending 三条＝`AGENTS.md version 25 -> 23`、`CLAUDE.md version 25 -> 23`、
   `.vibe-runtime.json runtime registry changed`。换成 `--write` 会把 marker 退回 `version=23` 与 HEAD 那两个 checksum
   （`e15269e0…`／`e986d1d2…`），并**把 `check-ui-reuse.mjs` 重新写回 `AGENTS.md:88`／`CLAUDE.md:88`**；而本批已按下游门的
   原文要求删掉它那 2 条基线豁免，所以降级后下游 `check-doc-script-refs.mjs` 立刻判「R3 未登记新增」并**卡住 pre-commit**——
   那份副本会自称在满足提交门、实际在打破它。两道隐形叠加让它无法被提前看见：`.gitignore:87` 忽略
   `.vibe-coding-skills/experience-tools/`（`git check-ignore -v` 实证命中），`tools/doc-script-refs-core.mjs:30` 又把
   `.vibe-coding-skills` 放进 `SKIP_DIRS`。块内指令形态是加重项：`:197`／`:282` 用裸名 `init-target-runtime.mjs`、
   `:295` 用 `node <skills-root>/tools/init-target-runtime.mjs`（占位符前缀恰是下游判据跳过的那一类），
   按裸名解析就可能命中陈旧副本。**降级硬拦**（§10-5）＋「块内刷新指令一律带 `<skills-root>` 前缀」一并待拍。
   补充一条实测：不带 `--skills-root` 的裸调用是 fail-closed 的
   （`[FAIL] Invalid skills root … Missing: skills/INDEX.md, tools/init-target-runtime.mjs`，exit 2），
   所以危害只在「有人补了 `--skills-root` 又 `--write`」时落地。
7. **新查实（登记待拍）：本包下发的账本核跑不动真实的下游账本**。用本包副本直接 `parseLedger(经验治理.md)` →
   `parseLedger: processedEvents.experienceId 必须绑定现有经验或已登记的清扫日志条目`（该账本的清扫日志
   `经验治理-清扫.md` 实测有 **200** 条 `## EXP-\d+ ·`，其中 id 既不在 `experiences[]` 也不在 archived）。
   fs-agent 本地副本正是为这点打的补丁：`:619 assertConfirmation(…, sweptExperienceIds)`、`:649`、`:674 elevateExperience(…, sweptExperienceIds)`；
   **本包副本这三处签名都没有该参数**（`sweptExperienceIds` 只出现在 `:330/:356/:475/:478/:485/:490`），也没有导出任何
   清扫 id 读取器。后果：本包向下游承诺的「自动升档／写账本」在他人真实账本上**不可执行**，下游只能自 patch；
   而 `check-experience-ledger.mjs` 两份**字节相同**，所以只读校验绿、写路径红。这正是「只读绿≠可用」的口径漏洞，
   收口（贯穿参数＋补契约测试）属核心写路径改动，本批不擅自扩面。

### 10-8 复核补记（第四路账本复核产物：订正本文 3 条，另登记 3 条）

同一面再开一路独立复核（它被允许否证本文），产出如下。**其中第 1 条是本批自己的测法错误，先认。**

1. **订正 §10-7 第 7 条的定性——我把「只读面跑不动」写重了，红只在写路径。** 我当时直接调
   `parseLedger(markdown)`（不传第二个参数）→ 报 `processedEvents.experienceId 必须绑定现有经验或已登记的清扫日志条目`，
   就据此写成「本包下发的账本核跑不动真实下游账本」。但**本包自己的 checker 会供这份 id**：
   `skills/event/experience-elevator/tools/check-experience-ledger.mjs:84-93` 先读清扫日志（注释原文
   「与 `init-target-runtime.readSweptExperienceIds` 同口径」）再 `parseLedger(…, sweptExperienceIds)`。
   即：**只读校验面对这类账本是绿的**，真正的洞在写路径——本包副本 `experience-ledger-core.mjs:674`
   `elevateExperience(ledger, id, { landing, timestamp, confirmation })` 与 `assertConfirmation` 两处签名
   **都没有 `sweptExperienceIds`**，写路径内的 `validateGovernedLedger(ledger, action)` 是裸调（清扫集为空），
   而 `experience-governance.mjs:668` 正是走这条路径升档。fs-agent 的本地补丁补的就是这三处
   （`:619`／`:649`／`:674`）。所以准确说法是：**「本包能验别人的账本，但用不了自己的写路径去动它」**，
   下游只能自 patch 才能自动升档。收口面（贯穿写路径参数＋契约测试）仍属核心写路径改动，维持「登记待拍」。
2. **订正一处证据路径（避免后人照抄打不通的命令）**：本文 §10-1／§10-4 写的 `check-experience-ledger.mjs .`
   在 fs-agent 里**不存在 `E:\fs-agent\tools\check-experience-ledger.mjs`**（`fs.existsSync` → false）。
   实跑路径是该项目自备副本 `E:\fs-agent\.vibe-coding-skills\experience-tools\check-experience-ledger.mjs .`
   （exit 0；无参数调用是 exit 2 usage），或本包副本带目标根 `node skills/event/experience-elevator/tools/check-experience-ledger.mjs E:/fs-agent`。
   读数本身两路都成立，但**登记的命令形态不可照抄**，这属本仓库一直防的那类「指令指向不存在的位置」。
3. **订正 §10-7 第 2 条的时间线（并发写入者让「谁改的」变得说不清，必须写死）**：另一路复核在同一窗口读到
   `revision 515 → 517`、`experiences 132 → 134`（`EXP-330／331／332`）、文件 `184112 → 185415` 字节、
   mtime `2026-10-02 01:27:08`，并据此推断 `EXP-257.count` 的 4→0 是那个并发写入者干的。**不是**：
   这一处是本批用编辑工具按字段路径改的（改前后各解析一次，见 §10-7 第 2 条的读数），
   且它当时的观察点里 `EXP-333` 已在、`revision` 已 517，属同一竞态窗口的不同时刻。
   **由此得一条对本包有用的口径**：下游那份账本正在被自动写入，任何「手改＋登记一个具体数字」的证据都会随树移动而失效
   （本批的 `revision 511 → 512` 就是这样在下一次复验时变成 `→ 517`）。所以 §10-4／§10-7 里凡涉及该文件的数，
   一律按**字段路径＋复算命令**读，不把某个 `revision` 值当锚点。
4. **新登记：账本修复**没有下游提交门兜**。`core.hooksPath = E:\fs-agent\tools\githooks`，其 `pre-commit` 的
   `run_check` 实跑清单为 **10 条**（`tools/check-doc-index`、`check-doc-governance`、`check-dep-boundaries`、
   `check-hotspots`、`check-style-vars`、`guardrails/secret-scan`、`check-caliber-ledger`、`check-doc-script-refs`、
   `check-style-families` 等），**其中没有 `check-experience-ledger.mjs`**——即那四处结构缺陷当初不会被任何提交门拦住，
   修完之后回退同样不会被拦。属他人项目的门禁面，本包不代加，登记为「下游账本面无棘轮」。
5. **新登记（同一类缺陷的类级证据）：修复只收了「一个实例」，但这一类已由机器契约收口，不是靠我逐条查**。
   现树 134 条 `experiences` 里带确认凭据的只有 4 条（`EXP-010`／`EXP-077`／`EXP-212`／`EXP-257`）：
   全局 `consumedConfirmations` 哈希重算不符 **0／4**，内嵌 `confirmationHistory` 不符 0，非 schema 额外键 0；
   同一测试打在 HEAD 上得 2 处不符、且两条都是 `EXP-257`。原因是结构性的：`assertValidConsumedConfirmation`
   逐条重算全局哈希、`:309` 强制内嵌≡全局，**`parseLedger` 通过就不可能同时留着坏哈希**。
   轨迹面同理：HEAD 133 条轨迹串里非规范 1 条（正是 `EXP-257` 那句带括号的原话），现树 138 条为 0。
6. **新登记（下发件与自备副本的三文件分叉，带 sha）**：两棵树**不是同一份代码**——
   `experience-ledger-core.mjs` 本包 `8ab3927728cfd0a5…` vs fs-agent `006e9bc40a4bc1e0…`（24 行差异／6 个 hunk，全在 swept 贯穿）；
   `experience-governance.mjs` `9ae1a3d08668…` vs `fa2eb4c9e7af…`；`init-target-runtime.mjs` `6358d8b6859c…`（＝本包 catalog 现登记值）
   vs `80cb5e4b44bf…`（其 `:53` 仍 `"23"`）；该目录另有本包没有的 `README.md`。这与 §10-5 是同一件事的两面：
   版本面差 2 个档（23 vs 25），**契约面差的是能力**（写路径能不能动真实账本）。

### 10-9 数字复算路复核产物（当场追平 1 条、订正 3 条、标注 4 条不可复算）

1. **并发写入把下游门自己搞红了——本批当场追平。** 本批 `--fix` 之后、复核独立复跑期间，
   `node tools/check-doc-index.mjs` **exit 1**：`manifest cb8f3a369dba… → 实际 fa7a394cc06f…`、
   令牌 `54151 → 54534`（账本又被写入：`revision` 稳定在 **517**、`experiences` **134** 条）。
   即：**那份账本不需要我改，也会让它自己的文档索引门变红**。本批重跑 `--fix` → 三查通过、`check-doc-index` **exit 0**，
   索引现为 `~54534`／`sha256:fa7a394cc06f…`；`EXP-257.count` 复验仍为 0、五处改动全在场。
   口径据此定死：**凡自动写入者的文件，登记「复算命令」而不是登记「读数」**——本批已三次看到登记值在两次复验之间移动。
2. **订正 §10-5 的「13 文件」**：`ls -1` 实为 **14**（13 个 `.mjs` ＋ 1 份 `README.md`，而同一句正好引用了那份 README）。
3. **补 `check-doc-index` 的 12／13 口径**：工具输出原文「12 份登记文档指纹一致」，而 `.vibe-docs.json` 的
   `documents.length = 13`——多出的 1 项是 `文档索引.md` 自身、不入比对。两数并存不是漂移，但原文未写排除口径，已补。
4. **补一处裸字面计数口径**：v25 里裸字面 `已安装` 命中 **2** 处（`AGENTS.md:34` 另有一句与 UI 复用无关的同词句子），
   `已扫描` 1 处；本文与 HANDOFF 的「新句各 1 次」指的是 `未自备时不得声称` 这一**句形态**（每份确实 1 次），不是裸字面计数。
   按裸字面去配对读数会得出「2 → ？」这种没法解释的数，所以把口径写死在这一条里。
5. **本包步数 26 的结构复算（把「26」从时点读数变成可复算口径）**：`scripts/verify.ps1` 里字面 `-Step '…'` **25** 个
   ＋ 投影类动态 `StepName` **3** 个 － 默认关闭的 2 个可选步（`-IncludeHostEvidence` 的宿主证据门、`-IncludePackage` 的
   发布候选包装配）＝ 默认 **26**；全开 **28**。与 README:74 的锚点句一致。§10-3 的 `24/26`／`26/26 全绿` 是**当次运行读数**，
   机制可复算（catalog 里 HEAD 钉 `b60fd18e…`＝已提交 v24 的 sha，工作树 sha 变 `6358d8b6…` → 步 1b 判红），
   但「几条绿」本身不可事后复算，属 §10-1 已声明的那类中间态。
6. **不可复算项集中标注（不再逐处解释）**：`version=24` 时期两个 checksum（`7fc25284…`／`46c10067…`）、
   `--check changes 3 / failures 1`、`命中 50／未登记 2`、`verify.ps1 24/26`、`tsc -b exit 0`、
   `contracts tests 100 / pass 100`（静态数 `test(` 声明确为 **100**，但整套件未复跑）、
   `parseArgs 期望 3／实得 4`（该 4 是**下游豁免名单口径**；用更宽的正则在本仓可数出 5 处定义，
   故引用它时必须带上「按 `hotspot-policy.mjs` 的登记表口径」这一句）。
   以上都发生在同一批的时间窗内、只有间接证据（v24 确随 `883c198` 入库）支撑，**不得当作可复算读数引用**。

### 10-10 共享下游的 HEAD 在本批中途移动：当场拦住一次「提交即删他人成果」，并登记第二盏无关红灯

本批在 fs-agent 留下的 6 项改动一直**未提交**（**该状态已于 2026-10-02 由他线入库终结，见 §10-11；本节 5 条都是当时窗口的读数**），而该仓在我干活期间自己前进了两笔：
`060d2464`（2026-10-02 01:11，登记 098 边车握手契约与文档门禁例外）与 `c03a5589`（01:32，合并 098 路线二边车控制层 M1 收尾）。

1. **当场查出的真实事故（不是风险，是已经发生在我工作树里的状态）**：我的 `tools/doc-script-ref-baseline.json`
   是在 01:11 之前从旧 HEAD 改出来的（删掉那 2 条 `check-ui-reuse.mjs` 豁免），所以他线新增的 **2 条豁免不在我的工作树副本里**；
   照当时的状态提交，等于**替他们把那两行删掉**。检出方法不是看 `git diff --numstat`（它只给 `0/32`，看不出少的是谁的），
   而是**逐条 set-diff** HEAD 版与工作树版的 `entries`：
   `in HEAD not in WORK` 得 4 条＝我有意删的 2 条（`R3|AGENTS.md|check-ui-reuse.mjs`／`R3|CLAUDE.md|…`）
   ＋ 我漏掉的 2 条（`R3|docs/项目治理/验收记录.md|a5-rerun-walkthrough.mjs`／`R3|docs/项目治理/自动扫修/001-总指挥手册.md|…`）；
   `in WORK not in HEAD` 为空。修法：把工作树文件**还原成新 HEAD 的内容**，再在其上重放我那 2 条删除
   → 条目 **40 → 38**（R3 35／R1 3），`git diff --numstat` 回到 `0/16`（＝只删我那 2 条、每条 8 行），
   他们那 2 行逐字在场（`grep -c a5-rerun-walkthrough.mjs` ＝ 3：2 条登记行 ＋ 1 处 why 文本）。
   **动手前先自证格式无损**：该文件 `json.load` 后 `json.dumps(indent=2, ensure_ascii=False)+'\n'` 与原文**逐字节相同**
   （`12205 == 12205`），所以按对象删条目不会带来任何格式化噪声；第一次我用「按行回溯找 `{`」的文本切法，
   第二个块多吃了 1 行、`json.loads` 当场抛错——**因为断言在写文件之前，树没被写坏**（`git diff` 为空可证），
   改走对象层删除才对。这条测法教训记在这儿：改他人 JSON 真源一律走解析层，不走行号。
2. **登记第二盏与本批无关的既有红灯**：`node tools/check-doc-script-refs.mjs` 现 **exit 1**，两条
   `✗ 基线登记已过期：R3|…|a5-rerun-walkthrough.mjs（该死引实际不存在，请删除此条——基线不是永久免检牌）`。
   成因不在本批：那两条例外是他线 01:11 按 owner 2026-09-30 的 C 案登记的，理由原文写「脚本在主工区被 gitignore 的
   `.workbuddy/` 目录里，**隔离工区看不见**，所以被误判成死引」，并且同一句已经写明「**合回主线时须删除该条**」。
   本次实测：`c03a5589` 正是那次合回；而主工区里 `find .workbuddy -maxdepth 4 -name 'a5-rerun-walkthrough*'`
   → `.workbuddy/audit/a8c/a5-rerun-walkthrough.mjs` 真实在场（`.gitignore:69` 忽略该目录），
   于是 R3 命中消失、例外转「过期」。**本包不代删**：删了会把他们隔离工区（那里看不见 `.workbuddy`）的门禁直接弄红，
   且那是他们的销账动作、归他们那条线。连同 §10-4 的 `hotspots:test`，下游现在有 **2 盏与本批无关的红灯**，
   本批未修、已逐条给出归属证据链。
3. **由这两条落一条对本包有用的口径（登记待拍，不擅自替他人项目改）**：同一份基线 JSON 同时服务「主工区」和「隔离工区」，
   而判据依赖工区可见性（被 gitignore 的目录在一侧存在、另一侧不存在）——这样的基线**必然在一侧显示为「过期」**，
   门禁的「过期即红」就退化成了按工区随机亮灭的噪声。可选做法是下游侧把例外按工区分档，或让 R3 在扫描面里
   把「被 gitignore 但真实存在」的脚本单独归类。属他人项目设计，本包只登记。
4. **复算其余 HEAD 相对读数，确认没被这次移动污染**：HEAD 版 `docs/项目治理/经验治理.md` 仍含 `confirmationMaterial`
   2 处、`"revision": 511`（＝我修前的状态，说明他线那两笔没把我的账本修复吃掉）；HEAD 版 `AGENTS.md:3` marker 仍
   `version=23`、`checksum=sha256:e15269e0…`（＝§10-5 说的降级落点仍然成立）。工作树侧 `--fix` 后
   `check-doc-index` exit 0（原文「12 份登记文档指纹一致」，`documents.length = 13`、多出的是索引自身）、
   `check-doc-governance` exit 0、`check-caliber-ledger` exit 0、`check-experience-ledger` → `ok:true`、
   `EXP-257.count` 复验 0、`revision` 稳定在 517。本包 `scripts/verify.ps1` 全部文档改动落地后重跑 **26/26 全绿**。
5. **同一盏索引门在不到一小时内自己红了第二次，成因与他线合并有关、与账本无关**：第二次 `✗ 指纹过期：docs/接口契约.md`
   （`manifest 60ac9cb34190… → 实际 2eacc4e90989…`、令牌 `44880 → 45750`、分卷 `1-701 → 1-707`）——
   该文件最后一次提交是他线 `060d2464`（01:11），而它的工作树 mtime ＝ **01:34:18**，
   即 `c03a5589`（01:32 那笔合并）**把这份文档原地重写了一遍**，于是把我上一次 `--fix` 录进去的指纹打掉。
   重跑 `--fix` → exit 0，且 20 秒后复查仍 exit 0（这次不是活写入者在动，是合并的一次性重写）。
   **最终落点读数**：`experienceGovernance ~54534／sha256:fa7a394cc06f…`、`interfaceContracts ~45750／sha256:2eacc4e90989…`；
   （**【时点读数，已再失效】** 2026-10-02 复查：`experienceGovernance` 一行的 HEAD 登记值已被他线换成 `~55136／b9a321cf4757…`，
   而该值对任何已提交的账本内容都不匹配（成因见 §10-11 第 5 条）；工作树侧自本批以来已实测跳过两跳，**不在此登记数值**。
   `interfaceContracts` 未变。复算命令见 §10-11 第 5 条。）
   三查绿（index／governance／caliber 各 exit 0）、`check-experience-ledger` `ok:true`、块 `--check` exit 0、
   唯 `check-doc-script-refs` 仍 exit 1（第 2 条那两盏无关红灯）。
   **给本包的口径**：在共享仓上「跑绿一次」不等于交付时还是绿的——落点状态必须由**下游自己的 pre-commit（`--staged` 口径）**
   在提交那一刻再判一次；我们这边只登记复算命令，不把任何一次绿当承诺。

### 10-11 交接后复查（2026-10-02 日间，两路对抗复核后的重写版）：下游那 6 项已由**他线三笔**入库，两盏旧红灯一盏自解一盏仍在，并新亮第三盏——且第三盏的成因不是我第一次写的那条

复查动机：本包与交接文档写着「fs-agent 内 6 项改动未提交」（§10-4 那条「工作树最终 6 项未提交」／§10-6 表），这是**时点状态**，而它引用的仓在别的线上一直在动。
本节全部读数为本次实跑，命令原样登记。

**先记一条本批自己的失误**：本节第一版（未入库、复核时否掉）把归属写成「`85a820bf` 一笔收 6 件」，
并把新亮的红灯归因为「并发写入者在他们提交之后又动了账本」。两路复核各抓一处、我复算后又自己改口一次——
下面第 1 条与第 5 条是复算后的版本，第 5 条的结论与第一版**相反**。

1. **归属：6 个文件落点分属他线三笔**（`git -C E:\fs-agent show --stat` 逐笔核）：
   - `85a820bf`（01:53）「刷新宪法受管块至v25并落账经验治理518」：一次收齐 6 件
     （`.vibe-docs.json 6 / AGENTS.md 4 / CLAUDE.md 4 / 经验治理.md 148 / doc-script-ref-baseline.json −16 / 文档索引.md 2`）。
     那个 `−16` 正是我删的 2 条 `check-ui-reuse.mjs` 豁免（每条 8 行）。
   - `17e6fe0b`（02:07）「神通导入钮复用AddRow底行母件沉底并删脚注行」：**他线的 UI 笔**，却再次改写了 `.vibe-docs.json` 与 `文档索引.md`——
     HEAD 上那两件的现态出自这里，不是 `85a820bf`（第 5 条的红就长在它这一笔）。
   - `8c496440`（02:23）「销账死引基线两条过期登记（a5-rerun-walkthrough.mjs）」：只动基线，删他们自己那 2 条例外。
   **本包从未在该仓执行过 `git commit`**（owner 从未授权）。这条**靠什么成立**要说清，别拿身份糊过去：
   fs-agent 本地 `user.name = msx2027`、本包是 `MC0823`，**身份不同不能当证据**——我要是在那儿提交，署的同样是 `msx2027`。
   可用的是**提交正文自述**（这部分是可复算的，原文就在 git object 里）：`85a820bf` 正文逐条点名本包的改动——
   「AGENTS/CLAUDE 宪法受管块**随 vibe-coding-skills 包升级 v23→v25**：UI 复用条款改按包内 `ui-system-guardian` 口径执行，
   不再点名 `check-ui-reuse.mjs`（该脚本不随包分发，避免下游死引）；`tools/doc-script-ref-baseline.json` 同步退役该脚本两条 R3 死引登记」
   「补登 `EXP-257` 升档 L1 确认凭据 `CONF-20260930-001`，确认哈希按新格式重算、命中计数清零重计」——
   即**他们把本包交付读进去并替本包落账**，动作主语是他们那条线；旁证是 `git worktree list` 有 6 个非主工区、
   `git reflog` 02:05「merge fsa/099-knife0」、02:06「代提交：他线前端在途件四件保合并通道」。
   **同一笔正文还写明它用了 `no-verify`**，理由原文是「死引棘轮误判基线两条 `a5-rerun-walkthrough.mjs` 登记过期——
   该脚本在 gitignore 区 `.workbuddy/audit/` 下，主工区盘面可见即判『死引已消』，即基线 note 已登记的缺陷①」。
   **这一句把 §10-10 第 3 条我登记为「待拍」的那条 hazard 当场坐实成真实成本**（他们为此绕过自己的提交门），
   收口结果见下面第 6 条。
2. **HEAD 侧对账（可复算，且是少数能钉住的锚点）**：`git show HEAD:AGENTS.md`／`CLAUDE.md` 第 3 行 marker 均 `version=25`、
   checksum `fea15f36…`／`44591e1d…`；把 HEAD 版账本的围栏块（开栏行是 json 围栏紧跟 `vibe-experience-ledger{`）`JSON.parse` 后按字段路径读：
   `revision = 518`、`experiences = 135`、`EXP-257.count = 0`、该经验对象自身键集不含 `confirmationMaterial`（整份 HEAD 文件 grep 该词 **0 次**）、
   **顶层** `consumedConfirmations = 4` 且含 `CONF-20260930-001`（注意它是账本顶层字段，不在 `EXP-257` 对象里，两者并列易误读）。
   **本批那五处修复全部在 HEAD 里，没被合并吃掉。**
3. **基线条目数第四跳**：38（动手前 HEAD）→ 36（我删 2）→ 40−2＝38（本批落点，§10-10 第 1 条）→ **36**（`8c496440` 删他们那 2 条 a5 例外）。
   复算命令：解析 `tools/doc-script-ref-baseline.json` 的 `entries` 并按 `rule` 计数（现 R3 33／R1 3，工作树与 HEAD 逐字节相同）。
4. **两盏旧红灯复查**：
   - `node tools/check-doc-script-refs.mjs` → **exit 0**（本次读数：命中 48／未登记 0／基线存量 48、族名放行 10、通配碎片 **17** 不判）。
     §10-10 第 2 条那盏由他们自己按登记原文销账了——**本包当时不代删是对的**。**注**：我上一版此处写「16」，同一命令两跑之间就从 16 变 17
     （他线在途文档在动扫描面），所以这一类计数**只登记命令与窗口，不登记数值**。
   - `hotspots:test` **仍红**，且**失败断言是 2 条不是我写的 1 条**：`node --test tools/check-hotspots-policy.test.mjs` →
     `✖ parseArgs 豁免名单必须与仓库实际定义处精确相等` ＋ `✖ 重复 helper 报告应忽略已核实的同名误报并保留真实候选`；
     `grep -n check-style-families tools/hotspot-policy.mjs` 零命中，即 §10-4 诊断的缺口无人补。修法与归属不变，本包不代裁。
5. **第三盏红灯的真正成因（这一条是本节最有价值的产物，我第一版写错了）**：`node tools/check-doc-index.mjs` → **exit 1**，
   唯一过期项 `docs/项目治理/经验治理.md`（`manifest b9a321cf4757… → 实际 …`、令牌 `55136 → …`），而 `docs/接口契约.md` 未报。
   我第一版把它归因为「他们提交后并发写入者又涨了 6 条」。**复算否证了这个归因**：逐笔取该文件在提交面上的 sha256
   （`git show <c>:docs/项目治理/经验治理.md | sha256sum`）——`85a820bf`／`17e6fe0b`／`19bcd7f4`／`46fe18c4`／`8c496440`／`HEAD`
   **六个提交里的账本 blob 全是同一个 `73c42cea2d3f`**，而 HEAD 的 manifest 记的是 `b9a321cf4757／~55136`；
   再把范围扩到**全部历史**：`git rev-list HEAD -- <该文件>` 得 **138 笔**，逐笔取 buffer 算 sha256 后
   **等于 `b9a321cf…` 的有 0 笔**——即 **HEAD 的 manifest 指向一份在任何提交里都不存在的账本内容**。
   `85a820bf` 当时是自洽的（blob＝manifest＝`73c42cea2d3f`／54754）。
   即：**`17e6fe0b` 把一次 `--fix` 的结果录成了「工作树里那份从未入库的账本」的哈希，而该笔并没有提交账本内容**。
   后果比「过期」更硬：**把他们的 HEAD 干净签出来也是红的**，不依赖任何工作树状态——
   属「登记面与内容面在提交那一刻被拆开」，与本包一直在防的「同一事实多副本失步」是同一类，只是发生在下游。
   工作树侧读数本节内就已移动两次：`b7bc5349b2e5／55975` → `4fef790015f5／56195`、`revision 524 → 525`、`experiences 141 → 142`
   （并发写入者仍在动，`EXP-257.count` 复验仍 0）。**所以第 2 条那种「HEAD 字段路径」才是可用锚点，工作树读数一律只登记命令。**
6. **§10-10 第 3 条那条「工区可见性 hazard」的收口结果：他们把例外删了，于是红从主工区搬到隔离工区**（本批不代删的判断因此拿到新证据）：
   - 他们自称的修法（`8c496440` 正文「缺陷①（死引用棘轮按文件系统判定存在性）修复落地后」）**我在代码面没核到**：
     `git log --oneline -- tools/check-doc-script-refs.mjs` 与 `-- tools/doc-script-refs-core.mjs` 的最新一笔都还是
     本包 2026-10-01 接线批的 `6b8085a7`／`bd3bece7`；现行过期判据在 `tools/check-doc-script-refs.mjs:166-178`，
     它按「该文档本轮是否被扫过（`scannedSet`）」分流，只有**载体文档文件本身不存在**时才另判一条（`:172-173`），
     与「被引用的脚本在不在盘上」无关——即**判据没改，是那 2 条例外被删掉才让主工区变绿**（`8c496440` 的 stat 只有基线 JSON、16 行删除）。
   - 于是代价换了边：实测隔离工区 `E:\fs-agent-worktrees\fsa\099-knife1`（HEAD `17e6fe0b`）里
     `.workbuddy` **整个不存在**（`ls` 报 No such file）、`docs/项目治理/验收记录.md` 仍含该 token **1 次**、
     其 `tools/doc-script-ref-baseline.json` 仍含该 token **3 处**（2 条登记行＋1 处 why 文本）。
     **推论（可复算的前瞻）**：该线一合回 `8c496440`，例外消失而脚本在它那边仍不可见 → 同一条死引改判「未登记新增」→ 它那侧的门变红。
   - 本包判断：**这是他们那条线的销账动作，代价由他们付**；但 §10-10 第 3 条登记的「同一份基线服务两种工区可见性」这条 hazard
     **状态要改**——不是「等拍是否收」，而是「**已被他们以删例外的方式收了主工区一侧，隔离侧未收**」。
     可选收口仍在下游侧（按工区分档，或让 R3 对「被 gitignore 但真实存在」的脚本单独归类），本包只登记、不代做。
7. **本包不代跑 `--fix`**（§10-9 第 1 条口径的升级，理由换两条更硬的）：① 活写入者未停时任何一次 `--fix` 只把红推后几分钟，
   而它改的是**他人项目的入库面**，本包在该仓无提交授权；② 即便 `--fix` 也只能把工作树对齐——**第 5 条那种 HEAD 自相矛盾要靠他们
   重录 manifest 或把账本一并提交才能消**，本包既无授权也无判断「该以哪一版账本为落点」的依据。
   与 §10-9 那次的区别要说清，别当同一件事：那一次是本批自己刚 `--fix` 完就被并发写入打掉、属本批交付落点，所以当场追平；
   这一次全部变动来自他人且发生在他人提交之后。**「不代跑」只适用于后一种**，否则等于拿「并发写入者会动」当借口，把本批自己的落点推给别人。
8. **由此落四条口径（已写进 HANDOFF）**：
   ① 交接文档里「未提交／已提交／全绿／条目数／计数」这类**状态类陈述必须带复查时间＋复算命令**，不得当事实长期引用；
   ② **共享仓上「谁改了哪个文件」必须按文件逐笔核**（`git show --stat` ＋ 按提交面取 blob sha），**不能只看提交标题**——
   我第一版就是靠标题把 `.vibe-docs.json`／`文档索引.md` 的 HEAD 现态记错了笔；
   ③ 凡活写入者所在文件，**HEAD 字段路径读数是锚点、工作树读数不是**；
   ④ 他人提交正文里**自述的修法**要在代码面复核，不能当成已发生的事实——本批就碰到一次：正文写「缺陷①（棘轮按文件系统判存在性）修复落地后」，
   而判据文件最后一次改动仍是本包接线批那两笔、现行逻辑按 `scannedSet` 与载体文档分流（第 6 条），**变绿实际来自删条目**。
9. **其余下游根同时点复跑，§10-6 的表仍成立**：`F:\skiils\sess-find` 两份 marker 仍 `version=23`
   （`e15269e0…`／`e986d1d2…`，HEAD 仍 `8251ce1`，工作树仍 `.gitignore`／`bin/sf.mjs`／`test/bin.test.mjs` 三项）、
   `G:\历史项目\deyy` 仍 `version=21`、`G:\历史项目\ddzj` 仍 `version=3`。**本包侧待拍板项一条未动**（刷 `sess-find` 到 v25、
   `provenance/DOWNSTREAMS.json`、`planFile` 降级硬拦、块文本自扫门等，见 HANDOFF「新增的待拍板项」）。
   **只有一项已被下游自己满足、当场销账**：§10-7 第 4 条要求的「下一次在 fs-agent 提交时须写明确认哈希这次重推导」——
   `85a820bf` 正文已逐字写「补登 `EXP-257` 升档 L1 确认凭据 `CONF-20260930-001`，**确认哈希按新格式重算、命中计数清零重计**」，
   审计链读得通了，这条不用再催。
10. **本节自身的可信度标注**（哪些能长期引用、哪些不能）：
   - **可复算**：第 2 条 HEAD 字段路径读数、第 3 条基线条目数、第 5 条的提交面 blob sha（含 138 笔历史零命中）、
     第 6 条的三处 `ls`／`grep -c` 读数与 `:166-178` 判据、第 1 条引用的**提交正文原文**（原文在 git object 里，可逐字复算）。
   - **时点读数**（命令已登记、数值会动）：第 4 条的门禁计数与放行面、第 5 条末的工作树指纹／`revision`／条数。
   - **推论而非实测**：第 6 条末「隔离工区合回即变红」——前提三点都测了，但**没在他们那侧实跑过门**（跑一次要在他人工区落盘噪声，本包不做）。
   - **不成立的条件**：归属那条**不能**用 git 身份证明（两仓 `user.name` 不同，但我在下游提交署的也是 `msx2027`）；
     它靠的是正文自述主语＋worktree／reflog 旁证，属**强间接**，比第一版写的「没有机器证据」进了一步，但仍未达复算级。

