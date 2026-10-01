# 2026-10-02 受管块「自己扫自己」门 ＋ 降级硬拦 ＋ v26/v27 谎报清零

owner 长期需求原话（本轮仍在办）：
「我在开发 fs-agent 的时候，最近还是发现有大量文档口径漂移冲突的问题，需要怎么优化当前 vibe-coding-skills 才能避免这种情况出现呢……」

本轮指令：「第一件入库。第二件123都要实施」——①给受管块加一道自己扫自己的门；②`planFile` 陈旧副本降级硬拦＋补契约测试；③块里剩的谎报清成 v26 并再刷一轮下游。
路 A 对抗复核（本批内）又查出**这道新门自己有两个「空判即绿」的洞**与一条边界矛盾，全部当场收口并升 v27；复核产物登记见 §8。

---

## 1. 病（为什么这两条门都得加）

受管块（下发到每个目标项目 `AGENTS.md` / `CLAUDE.md` 的宪法正文）此前**不在任何死引用门禁的扫描面内**：

- `scripts/check-skill-references.mjs` 的默认扫描面是 `skills/**/*.md` ＋ 根 `SKILL.md`，而块正文是
  `skills/event/experience-elevator/tools/init-target-runtime.mjs` 里的**模板字符串**，不是 `.md` 文件；
- 于是块正文怎么写，本包 26 步全绿照过。已连续两代出事：v24 把 `tools/check-ui-reuse.mjs` 写进块（下游
  `E:\fs-agent` 自己的门判红，见 evidence/20261001-skill-body-dead-command-cleanup.md §10），v25 之后仍有
  6 处把只存在于 `sources/**` 保真快照的旧代工具名当本包工具下发。

第二条是同一病的写入面：目标项目装着 v25 的块，而执行者手里是一份 v23 的陈旧 skills 副本，`planFile`
过去只看「块与本文渲染结果是否不同」，不看**方向**——计划里给的是 `[PENDING] update (version 25 -> 23)`，
`--write` 就把新代条款静默写回旧文本，而目标项目自己的文档门禁照它自己那份登记照样放行。

## 2. 落点规矩（本轮定的口径，写进门头注）

下发到别人仓库的正文（受管块、脚手架模板）**不得写本包不下发的脚本名或路径**；
连「某旧代工具未随本包分发」这种诚实提及也不写名字——名字写进块里，就是下游仓库的死引用。

## 3. ① 块文本自扫门

- `scripts/check-runtime-block-refs.mjs`（新增，约 95 行）：`import` 生成器 → `getConstitutionBody()` 取正文
  → 写到系统临时目录 → 以**虚拟面** `受管块/AGENTS+CLAUDE.md` 调 `check-skill-references.mjs --virtual-only`。
  规则不在这里复制一遍，存在性判据仍取真包面；`sources/**` 排除边界原样生效。
- 渲染失败（生成器抛异常／子进程起不来／未知开关）一律 exit 2 并明写
  「这不是『没有死引』，是本门没有跑起来。」——门不许把「没跑到」写成「实测 0」。
- 棘轮新增 **R6**：包根占位符路径必须至少有一个真实展开，且展开不得落在不下发的面。加它的理由：R1/R4 的正则跨不过
  `<…>` 段，块里 `skills/<技能>/SKILL.md` 这种「一层写法」的谎报此前对门完全不可见。
  路 A 复核后再改两处（详见 §8）：**判所有面**（原先只判虚拟面，盘上正文同样盲）；**首段或通配命中落在
  `SKIP_DIRS`（`sources/**` 保真快照、`node_modules`、`.qoder` 等）即判红**——那条路径盘上存在，但不在 bundle 里。
- 门的**两处非空自证**（路 A 复核后补，防本门恒绿）：
  ① 渲染结果必须非空、含 `## Agent 宪法` 标题、含至少一个 `### ` 规则面，否则 exit 2 并打印行数；
  ② 棘轮汇总行必须出现「扫描 1 个文件（含虚拟面 1 份）」，否则说明 `--virtual-only`／`--virtual-md` 已丢失，exit 2。
  没有 ② 时，把 `--virtual-only` 摘掉会让棘轮去扫盘上面（当前存量 0）并照样打「命中 0 处」，门透传绿；
  没有 ① 时，`getConstitutionBody()` 一旦退化成空串，棘轮「命中 0 处」同样恒绿——**门判的是渲染结果，渲染本身没人管**。
  子进程自己判红（死引／基线畸形／模块缺失）时原样透传其退出码，不改写成自证消息；`verdict` 初值为 2，
  任何没走完判定路径的意外都不算通过。
- 新增开关 `--virtual-md <面名> <内容文件>`（可重复）与 `--virtual-only`；缺参／面名重名／内容缺失均 fail-closed。
- 「登记过期」改为**按面判**（`registrationInCurrentFace`）：判据是路径属不属于当前扫描面，而不是文件还在不在。
  不按面判会让新门因为技能正文面的存量登记而假红。

非恒绿证明（v25 突变，同一套判据跑真包面）：

```
node scripts/check-runtime-block-refs.mjs --root . --print-body   # 取 v25 正文
# 实测 6 处命中，exit 1：
#   L7  R3 resolve-target-doc-context.mjs
#   L50 R3 setup-target-hooks.mjs
#   L50 R3 check-target-doc-precommit.mjs
#   L53 R3 check-markdown-governance.mjs
#   L59 R6 <skills-root>/.agents/skills/<skill>/SKILL.md
#   L59 R6 <skills-root>/skills/<skill>/SKILL.md
```

v26／v27 正文跑同一条命令：`扫描 1 个文件（含虚拟面 1 份）… 命中 0 处（未登记新增 0 处、基线存量 0 处）`，exit 0。
（读数里的「可执行面基名 696 个」不是锚点：它数的是全仓文件基名，仓库根多一个临时文件它就加一个，故不写进任何文档断言。）
门的自身单测 `tests/test-check-runtime-block-refs.mjs` **9 例**，其中 2 例是突变用例（把已收口的谎报形态
喂进同一入口必红），2 例钉路 A 补的两处自证，1 例断言 `--print-body` 逐字等于 `getConstitutionBody()`（证明门扫的是渲染结果而非某份副本），
1 例断言跑完不在本包工作树留 `block.md`，1 例断言 `--root` 指向无棘轮目录时非零。

自证的非恒绿实测（6 形，全部在 `%TEMP%` 的隔离迷你包里跑门副本，真树一字未动）：

| 形态 | 结果 | 读数 |
| --- | --- | --- |
| 基准：干净正文＋参数齐全 | exit 0 | `扫描 1 个文件（含虚拟面 1 份）… 命中 0 处` |
| 渲染成空串 | exit 2 | `✗ 受管块正文自证失败：渲染结果为空串；正文缺 \`## Agent 宪法\` 标题；正文不含任何 \`### \` 规则面` |
| 缺宪法标题 | exit 2 | `正文缺 \`## Agent 宪法\` 标题` |
| 无 `### ` 规则面 | exit 2 | `正文不含任何 \`### \` 规则面` |
| 丢 `--virtual-only` | exit 2 | 棘轮打 `扫描 2 个文件（含虚拟面 1 份）…`，门判 `未被棘轮确认为「只扫 1 份虚拟面」` |
| 丢 `--virtual-md` | exit 2 | 棘轮自己判 `--virtual-only 必须与至少一个 --virtual-md 同时给`，门透传其码 |

退化三形同时断言**不得**打印「命中 0 处」——否则读者会把「没得扫」当成「扫过且干净」。

## 4. ② 降级硬拦

`planFile` 在 checksum 分支之后、version/checksum/body 比较分支之前加方向判据：

- `blockVersionOrder(已装, 本生成器) > 0` → `action: conflict`／`status: fail`，
  reason 带两个版本号与「请改用不低于该版本的 skills-root」；
- 不可比（非整数版本，如 `2.5`）沿用原口径当普通 update，不为此发明第二套升级协议；
- 手改内容仍由 checksum 分支先报，降级守卫不替用户编辑背锅；
- `run()` 本来就是全有或全无（`failures.length > 0` 时完全跳过 `commitTargetTransaction`），
  所以降级不会写出半份文件。

契约测试 `tests/test-init-target-runtime-downgrade.mjs` 11 例。突变实测：把守卫条件改成永不成立
（`> 999`）后 6／11 例判红，恢复后 11/11 绿——不是恒绿套件。夹具的块正文由真 `renderBody()` 现取、
marker 的 checksum 自己算，保证测的是降级守卫本身而不是被 checksum 分支抢先。

## 5. ③ v26 与下游复算

`TARGET_RUNTIME_BLOCK_VERSION` 25→26，块内 6 处改写：

- 真源入口／受管文档一致性／Markdown 治理三条：去掉旧代脚本名，改说「未随本包分发，本块也不写它的脚本名
  （写进来就成了下游仓库的死引用）」；
- 非快车道任务：`<skills-root>/skills/<分类>/<技能>/SKILL.md` ＋「本包技能目录固定两级，不存在一级写法」；
- 加载策略硬边界：不再宣称 resolver 存在，`--allow-never --reason <理由>` 降为条件句；
- 结构阈值真源：对目标项目的跑法写成完整包内路径
  `node <skills-root>/skills/product/hotspot-governor/tools/check-hotspots.mjs <目标项目根> --strict`
  （下游 `E:\fs-agent` 的门 R2 不判 `<skills-root>/…` 跨仓前缀，实测其只判裸名，故安全）。

范围如实登记：原计划清 3 处，实际清 6 处——多出的 3 处是新门 R3 当场逼出的「诚实提及」，
按 §2 落点规矩同样不能留名。

下游刷新（均只改工作树，不在其仓提交）：

- `E:\fs-agent`：`--dry-run` 给 `version 25 -> 26`，`--write` 落 AGENTS.md／CLAUDE.md／`.vibe-runtime.json`，
  复跑 `--check` 三项全 `[PASS] none`。其自有门 `tools/check-doc-script-refs.mjs` 随块文改写报出
  **6 条「基线登记已过期」**（`R3|AGENTS.md|resolve-target-doc-context.mjs`／`setup-target-hooks.mjs`／
  `check-target-doc-precommit.mjs`，CLAUDE.md 同三条）——正是下游卡点该有的反应，按该门自己的要求删除这 6 条
  登记（`tools/doc-script-ref-baseline.json` entries 36→30），删后 `命中 40 处（未登记 0 处、基线存量 40 处）`、exit 0。
  留在其工作树待其 owner 提交（该仓另有两条他线在途文档改动，本批未触碰）。
- `F:\skiils\sess-find`：`version 23 -> 26` 直接升级，`--check` 全 `[PASS] none`；该仓把
  `AGENTS.md`／`CLAUDE.md`／`.vibe-runtime.json` 写进了 `.gitignore`（第 6/7/8 行），故其工作树干净、无需其提交。
- `G:\历史项目\deyy`（v21）与 `G:\历史项目\ddzj`（v23）是归档面，本批不动（owner 既有裁定）。

本包侧：`provenance/CANONICAL-CATALOG.json` 经 pwsh 7 再生（生成器逐文件 sha 随块文改写重录）；
`provenance/LOCAL-PATCHES.json` 无需重录——该文件两条相关登记分别指向 `tools/init-target-runtime.mjs`
（bundle 面，本批未改）与 `snapshot: runtime-import` 的 SKILL.md 集合，活树 `skills/event/...` 不在其覆盖内。

## 5b. ③续：v26 → v27（门接线后自己逼出的第一跳）

v26 清完旧代工具名之后，块里还剩**两处把刷新写成裸脚本名**：

- 首段（正文 L3）：「需要刷新本块时，重新运行 \`init-target-runtime.mjs\`」；
- 待生效条款段（正文 L88）：「改本包生成器并重跑 \`init-target-runtime.mjs\`」。

这两处**本包棘轮判不出来是对的方向**：`init-target-runtime.mjs` 确实随包分发，R3 只查同名文件在不在可执行面，
所以 v26 门跑绿。但对目标项目它是谎报——那个路径不在它仓里，照句子跑必然打不开；
块末尾 L101 早就写了唯一正确形态
（`node <skills-root>/tools/init-target-runtime.mjs <target-root> --skills-root <skills-root> --write`），
同一个块里两种口径并存本身就是 owner 说的那类「文档口径漂移」。同跳再改一处：正文 L62
「光标不足时才让 resolver 增加显式 role」→「让项目自备的等价取读工具增加显式 role（未自备时由协作方按同一口径人工补光标）」，
把 §7 原第 4 条「名字清了、动作主体还在」收掉。

下游复算（只改工作树，两仓都不提交）：

- `E:\fs-agent`：`--check` 先给 `[PENDING] update (version 26 -> 27)`，`--write` → 三文件 `[WRITTEN]`，复跑 `--check`
  三项全 `[PASS   ] … none`；marker 现为 `version=27`，AGENTS `3480e4e4…`／CLAUDE `7c756103…`。
  其自有门 `tools/check-doc-script-refs.mjs` **当场报出 2 条「基线登记已过期」**
  （`R3|AGENTS.md|init-target-runtime.mjs`、`R3|CLAUDE.md|init-target-runtime.mjs`，`hits:2` 正是这两处裸名）
  ——按它自己的要求删这 2 条（`tools/doc-script-ref-baseline.json` entries **30 → 28**），删后
  `命中 36 处（未登记 0 处、基线存量 36 处）`、exit 0。
  **这一跳是跨仓卡点的正面证据**：本包门放行的写法，下游门按裸名面判它过期，两边读数差正好等于本批删掉的字数。
- `F:\skiils\sess-find`：26 → 27，`--check` 三项 `[PASS] none`，两份 marker 的 checksum 与 fs-agent **逐字相同**
  （同一生成器渲染，跨仓一致）；该仓把 `AGENTS.md`／`CLAUDE.md`／`.vibe-runtime.json` 写进 `.gitignore`，工作树无涉。
- 归因（不背锅也不遮）：fs-agent `tools/check-doc-index.mjs` 仍 exit 1，红的是
  「指纹过期：docs/项目治理/经验治理.md（manifest `cc797ecd635b…` → 实际 `890b07309094…`）」加两条令牌估算漂移，
  该文件本批从未触碰、在其 `git status` 里是他线在途改动，AGENTS.md／CLAUDE.md 不在它的过期清单内。
  HANDOFF 待拍板项 ① 原先写的外推论「不等他们收就刷完会分不清哪盏红是谁的」**实测不成立**——按门归属逐盏读，分得清。
  未跑其 `--fix`、未在其仓提交（owner 既有约束）。

## 6. 门禁接线（默认 26 → 29 步）

- 5i 受管块正文自扫、5j 受管块正文自扫单测（**9** 例）、5k 受管块降级硬拦契约测试（11 例）。
- 三处步数锚点（README 徽章、README 正文、交接文档全部「默认 N 步／全开 N 步」）由末步自计核对；
  「棘轮自身的单测（N 例」「受管块自扫自身的单测（N 例」「降级硬拦自身的契约测试（N 例」都进
  「文档数字与实测一致」步的锚点集，例数由 `node --test` 汇总行现取——**写错数字本身就判红**，
  这是 owner 那条「文档口径漂移」痛点在本包的机器化形式。
- 路 A 复核后棘轮单测由 47 → **51** 例（R6 判盘面 1 例、R6 快照面首段排除 1 例、R6 通配展开排除 1 例含对照、R1 快照面排除 1 例），
  自扫门单测由 7 → **9** 例；步数不变（仍是那三步在跑这两套），所以 29 步读数不动、动的是例数锚点。

## 7. 刻意不修与门抓不到的（登记给下一轮）

本批内路 A 复核把原第 1、4 条**改成了已修**，此处保留条目并写清现状，避免后人以为它们仍是洞：

1. ~~R6 只判虚拟面~~ **已修**：R6 现判所有面。扩面前先实测盘上 162 个文件 0 命中（无存量要盘查），
   所以扩面是免费的；单测各钉一条「盘上一层写法必红」「快照面落点必红」。
2. **模板面未接入**：脚手架 `*.template` 与 `docs/**` 模板正文同样不在自扫门眼下；本批只接宪法块一面。
   （下一批要接它，得先给每个模板按其渲染上下文出正文。）
3. **投影块不在门眼下**：经验治理 L1 registry 生成的第二受管投影（AGENTS/CLAUDE 里的投影块）由
   `experience-managed-blocks.mjs` 渲染，不经 `check-runtime-block-refs.mjs`。
4. ~~`:265` 仍隐含 resolver~~ **已修（v27）**：动作主体换成「项目自备的等价取读工具」，并补了未自备时的人工口径。
5. **`check-hotspots.mjs` 属判断类谎报**：它确实随包分发、路径可打开，但「对目标项目的跑法」是否真能给
   出块里承诺的效果，属机器门抓不到的语义面，本批不承诺。
6. **冲突 plan 的 registry 期望值沿用 desired**：`planRuntimeRegistry` 在块判 conflict 时仍把
   `TARGET_RUNTIME_BLOCK_VERSION` 写进期望值，读数上会出现「块 conflict 而 registry 期望 27」的错位；
   改它要动 registry 面口径，本批只做块的方向守卫，不扩面。
7. **白名单外的包根占位符写法三判据全盲**（原样仍在）：`PKG_PREFIX` 只认
   `skills仓库／skills 仓库／skills-root／skillsRoot／本包／包根／package` 七种，
   写成 `<skillsRepo>/…`、`<vibe-coding-skills>/…` 时 R1 与 R6 都不判（R6 的第一步就是「非包根占位符前缀 → 放行」）。
   实测本包正文里带 `/` 的非白名单占位符只有 `<project-name>/`、`<feature-name>/`、`<target>/` 这类
   **目标项目或参数**命名面（共 10 种／12 处，最多的两种各 2 次），没有一种是本包自称，所以盲区当前无存量；
   扩白名单是加字符不是加判据，但要先量下游有没有人这么写，本批不动。
8. **R4 的快照面排除没做**：本批给 R1／R6 加了「首段落进 `SKIP_DIRS` 即判红」，R4 没加——
   R4 的入口条件是「首段字面是 `skills`」，而 `sources/…`、`node_modules/…` 天然进不来，所以它靠这条边界自带免疫；
   真要把快照里的技能路径写成 `skills/<分类>/<技能>/SKILL.md` 字面量，R4 会按活树查、活树里那些分类下确实有技能，
   于是放行——**这是口径面而非笔面**（正解本来就存在），不判。
9. **`--print-body` 不做自证**（**本条已由路 B 复核推翻并修掉，原样留着只为记下这次改判**）：原设计把它当
   「排障用的打印口」，正文退化时照样打印并 exit 0。路 B 指出这等于一处公开的「用没扫换 0」——同一份退化正文
   走门禁支路是 2、走打印支路是 0，而头注宣布的正是后者。现已把自证 ① 挪到 `--print-body` 之前，
   打印支路也必须是判过的正文；新增一例钉这个顺序（空正文 `--print-body` 判 2，干净正文判 0 且能打出内容）。

---

## 8. 三路对抗复核产物（owner 令「完工前 ≥2 路复核」，本批跑了 A／B／C 三路）

复核都是只读＋隔离副本突变，真树未被它们改动；下表「处置」列是本批随后做的事。

### 8-1 路 A（加固前的第一轮，产物已并入 §3／§6）

查出两处「本门恒绿」：正文退化（渲染塌了照样 0 命中）与扫描面退化（丢 `--virtual-only`／`--virtual-md`
后透传盘面绿）→ 各补一道自证；另查出 R6 只判虚拟面、R1 不吃 `sources/**` 面 → 扩面与排除，实测 162 个文件
0 命中、扩面零存量。**这两处自证当时被认为已经封住了「空判即绿」，路 B 证明没有。**

### 8-2 路 B（专门试「怎么骗过这道门」，6 条查实）

| # | 查实的洞 | 处置 |
|---|---|---|
| 1 | **第三条空判：写进去的内容与 `body` 脱钩**。自证 ①② 判的都是字符串 `body` 与棘轮自述，没人校验 `block.md` 里的字节。把 `writeFileSync(bodyPath, payload)` 突变成写空串、或写 `payload.slice(0, 20)`（谎报行恰好被截掉）——①②全过、棘轮照打「扫描 1 个文件（含虚拟面 1 份）… 命中 0 处」、本门 exit 0 | **已修**：新增自证 ③ 写盘回读比对（`readFileSync(bodyPath) !== payload` → 2 且不打扫描读数）；单测三形各判红（写空串／截断／写另一份正文） |
| 2 | **基线登记能把块里的谎报洗绿**：同一句 `resolve-target-doc-context.mjs` 无登记 exit 1，给面 `受管块/AGENTS+CLAUDE.md` 登记一条即 exit 0（存量 1 处）。门头注那句「落点规矩（本门强制的那条口径）」不实 | **已修**：棘轮说「通过」之后还要求其汇总行「基线存量 0 处」，>0 一律 2（`下发面出现 N 处基线豁免`）。单测先钉「无登记时必 exit 1」再钉「登记后仍 exit 2」，两头都有牙。这条把「下发件不写本包不下发的名字」从纸面口径变成机器判据 |
| 3 | **面判定只比 `split('/')[0]` 的字面**，实测放行：`<skills-root>/./sources/…`、`<skills-root>/SOURCES/…`（Windows 大小写不敏感，那条路径**真能打开**）、`<skills-root>/skills/../sources/…`、`<skills-root>/tools/../sources/…`、裸 `sources/vibe-coding-skills/tools/x.mjs`、`<skillsRepo>/…`（连不存在的工具也盲） | **已修（前四种）**：R1／R6 改用共用的 `skipFace()`——丢 `.`、按 `..` 回退、比小写后再判首段；棘轮单测四形各钉红例＋一条「折叠后落回真实下发面（`skills/../tools/real-tool.mjs`）必须放行」的对照。**不修（后两种）并说明**：裸 `sources/…` 字面路径落在 R4 之外是**口径选择**——技能正文里「真源在快照 `sources/…`」是正当指路，判它需要区分「指路」与「承诺落点」，没有判据；白名单外占位符（`<skillsRepo>/`）本批复测仍为「10 种写法／12 处，全部是目标项目与参数命名面，零本包自称」，改判需要新造一本「合法占位符名」真源，本批不造 |
| 4 | **R3 判的是「仓库里有这个基名」（696 个，含 `scripts/`／`tests/`），不是「本包下发给目标项目」**：块里写 `verify.ps1`、`build-canonical-catalog.ps1` 判绿 | **不修，登记为已知偏差**（门头注「边界」第一条已写明）。理由：要判后者需要一本「可下发给目标项目的工具」真源，而现成的 `CANONICAL-CATALOG.json` 的 `records[].bundle.files`（实测 82 条记录／453 文件、29 条带 `tools/`）说的是**宿主运行时投影**带哪些文件，跟「目标项目照抄哪条命令打得开」是两个面——拿它当判据会同时漏报与误报（见 §8-3 第 2 条）。造第三本真源正是这批在防的漂移 |
| 5 | **`--print-body` 早于两道自证**：正文退化成空串时 `exit 0`、stdout 长度 0 | **已修**：自证 ① 挪到打印之前；单例钉「空正文 `--print-body` 判 2／干净正文判 0 且打出内容」。§7 第 9 条原写「故意不修」，本批改判并在原地记下改判原因 |
| 6 | **断言强度**：①「用完即删」只断言仓库根无 `block.md`，把 `rmSync` 整行摘掉门仍 exit 0、%TEMP% 净增 1 个 `vibe-block-scan-*`，该例照绿（空断言）；②「子进程起不来」那例的两个断言在门自身 import 崩时同时满足；③自证 ① 的 `### ` 下限只有 1（对照夹具 3 行即绿） | **已修**：①改为对 %TEMP% 的 `vibe-block-scan-*` 集合做深比较，并加「有牙例」——把 `rmSync` 换成 `void workDir` 必须真留下 1 个残包（留下一条断言这条不是空判）；②改为精确 `exit 2`＋`/包根里没有棘轮脚本/`＋「不得打印命中读数」，并在门里加**装配预检**（此前 `--root` 指错时借 node 的 MODULE_NOT_FOUND 出 exit 1，与本门宣布的「有死引」同码）；③下限取 6（实测 v27 渲染 11 个 `### `，下限语义写成「至少还剩一半规则面」，只防渲染塌掉，不逐节钉死） |

路 B 同时报了**复现不了**的四条，原样登记不当成已修：棘轮 exit 1 时本门不掩盖读数（`status !== 0` 先判，实测透传 1）；
exit 2 各分支均不泄漏 workDir（正常／子进程 exit 2／自证失败三形净增 0）；`--root` 换一个面来洗绿理论上可行但
verify 5i 传的是 `$repoRoot`；改面名让旧登记静默退出判定——现基线该面 `entries = 0`，无存量可洗。
头注核对结果：「见棘轮 :56-57」指错（面感知那条在 58-61）本批已改指 `registrationInCurrentFace`；
退出码表与实测不符那条（缺棘轮＝1）已按第 6 条改掉；「AGENTS 与 CLAUDE 只差两个字段」属实（逐字对比只差第 5 行，
`getConstitutionBody()` 就是 Claude 变体）；「两道自证防恒绿」被第 1 条推翻，现为三道。

### 8-3 路 C（数字与文档复算，5 条）

1. **「全开 31 步」不是实测**：`verify.ps1` 末步写死 `$fullOpenStepCount = $defaultStepCount + 2`，并逐条硬点名
   两个开关——再加第 3 个可选步时该步仍绿、README 与交接文档照旧写 31。**已修**：可选步个数改为自扫本脚本
   「独立成行的 `if ($Include…) {`」（实测 2 处），本次真跑几个由同名开关现算；31 这个数不变，但从「写死」变成「算出」。
2. **「块里 `<skills-root>/tools/init-target-runtime.mjs` 在投影安装位打不开」——否证**。仓库根 `tools/init-target-runtime.mjs`
   确实存在（1214 字节，2026-09-29 补装的**发布布局转发启动器**，头注原文就写着「宪法受管块承诺的刷新指令是……本启动器
   以 realpath 定位本体后子进程转发」）；`E:\fs-agent\.vibe-runtime.json` 两条记录的 `source` 字段登记的也正是
   `tools/init-target-runtime.mjs`。C 引用的「catalog 453 条零 `tools/` 前缀」经复算不成立：实测 82 条记录的
   `bundle.files` 共 453 个文件，其中 **29 个带 `tools/` 前缀**（含 `skills/event/experience-elevator/tools/init-target-runtime.mjs`）。
   更深一层的口径错在「把宿主投影面当 skills-root 面」——见 §8-2 第 4 条为什么不采用它。
3. **交接文档两处普查停在旧读数**（fs-agent「已刷到 25」／sess-find「停在 23」）→ 已就地加现态段：两仓实测 `--check`
   各三项 `[PASS] none`、`.vibe-runtime.json` 版本 27、AGENTS checksum 同为 `3480e4e4c803…`；
   并如实写明「缺口一（没有下游清单、没有任何门看分发状态）」**仍未修**——这个 27 是人工复算出来的，不是门禁读出来的。
4. **「逐笔哈希 138 笔，等于 `b9a321cf…` 的 0 笔」这句的现态已失效**：复算 `git rev-list --count HEAD -- docs/项目治理/经验治理.md`
   得 **141**（他们线又推进 3 笔），`node tools/check-doc-index.mjs` 现 **exit 0**（读数「文档治理三查通过：12 份登记文档指纹一致」），
   且全仓 grep 已取不到 `b9a321cf`。**处置**：把那段分析就地标成「只对其当时 HEAD 成立」的时点读数，不重跑 141 笔逐笔哈希——
   现树已自洽，重算只能证明过去，不能证明现在。`hotspots:test` 那两条本批**未复算**（属其自有测试面）。
5. **本批写下但没有锚的数字**（marker `version=27`、两个 checksum、fs-agent entries `30→28`、新增例数 +18／9→14／51→52）：
   例数与步数已在锚点集里（verify 末两步现算比对，写错即红）；checksum 与 entries 属**下游仓**状态，本包没有真源可锚，
   按既有口径写成「带复算命令的时点读数」，不为其造第三个登记面。

### 8-4 本批复算读数（三路改完之后重跑，全部新鲜）

```
node scripts/check-runtime-block-refs.mjs --root .
  受管块下发文本自扫：version=27 面=受管块/AGENTS+CLAUDE.md（判据同 R1／R3／R4／R5／R6）
  技能正文死引用检查：扫描 1 个文件（含虚拟面 1 份），可执行面基名 696 个，技能面 51 个，
                      地面外路径 2 处不计，命中 0 处（未登记新增 0 处、基线存量 0 处）。        exit 0
node scripts/check-skill-references.mjs --root .          # 全量面（加固前后必须同数，否则排除逻辑误伤）
  … 扫描 162 个文件，可执行面基名 696 个，技能面 51 个，地面外路径 278 处不计，命中 0 处 …      exit 0
6 形绕过写法（./、SOURCES、skills/../sources、tools/../sources、两种占位符折叠）            exit 1，R1×4＋R6×2 全判红
node --test tests/test-check-runtime-block-refs.mjs      14 pass / 0 fail
node --test tests/test-check-skill-references.mjs        52 pass / 0 fail
E:\fs-agent        --check → AGENTS.md／CLAUDE.md／.vibe-runtime.json 三项 [PASS] none；版本 27；checksum 3480e4e4c803…
                   node tools/check-doc-script-refs.mjs → exit 0（本批删掉的 2 条过期登记未被要求补回）
                   node tools/check-doc-index.mjs       → exit 0（现态，见 §8-3 第 4 条）
F:\skiils\sess-find --check → 三项 [PASS] none；版本 27；checksum 与 fs-agent 逐字相同
```
