# 2026-10-01 口径账本收编 + 死引用棘轮（本包自食）

任务 id：本批（owner 2026-10-01 口头立项，无外部工单）。
源 revision：仓库 `vibe-coding-skills` HEAD `b40dfdb`（2026-09-30 统一改名批末），改动未提交前工作树=本批产物。
承接：`evidence/20260930-unified-name-rename.md`（改名批只能事后人工全仓审计，且当场漏改一处）。

## 1. 问题（owner 原话口径）

在 fs-agent 开发中「最近还是发现有大量文档口径漂移冲突的问题」。

- 显性：把「同一事实写进多处」这类复发口径变成机器常驻断言，而不是靠人事后全仓考古。
- 隐性：不要再让负责防漂移的技能自己带着错指——`doc-sync-guardian` 正文下发着只存在于快照、本包根本没有的脚本。

## 2. 边界（owner 逐条拍板，5 项）

1. 范围 = 收编口径账本为通用工具 **+** 收口 `doc-sync-guardian` 的错指；**不做**补齐上游 8 个未评审脚本。
2. 强度 = 两层都要：定期报告（`--report` 不阻断）**+** 提交拦已入账项（`--staged` fail-closed）。
3. 服务面 = 所有下游项目开箱可用（提供 init 接线器 + 空账本模板 + 行为契约文档）。
4. 追加大门 = 加一道死引用检测。
5. 自食 = 本包先吃自己的工具，账本里必须有自己的条目。

## 3. 第一性决策（AI 自定并记代价）

- **真源锚点 + 镜像表 + 禁出面**三件套，而不是「写一份规范文档」。文档不执行，能执行的是断言。
- 账本自身**不进**自己的扫描面：它会记录被禁词的字面形态，自扫必自红。代价：账本写错无人拦，靠单测与人工复核。
- 钉**存在**不钉**数值**：条目里的数字（步数、文件数）是时点快照，钉死会让正常迭代天天误伤；数值一致性另有「文档数字与实测一致」步负责。
- 历史不删史：旧措辞出现在 `docs/archive/**`、`provenance/**`、逐字登记面即豁免，但豁免**不庇护活体漂移**——挂账（`pending`）常驻打印示众，不阻断。
- CAL-004 只禁**陈旧框法**（「归档冷存」「归档 zip 是只读历史」「恢复对应源项目检出」），不禁裸词「冷存」：现行正确口径本身写作「不留冷存副本」，钉裸词会把真源句子一并判红，等于一盏只会误伤的灯。
- 死引用做**棘轮**不做清零：存量 25 处逐条登记（含每条收口法），新增未登记命中一律阻断；基线过期同样判红，防止「改路径不改基线」把门悄悄关掉。

## 4. 落地清单

新增（9，含本证据文件自身）：

- `tools/caliber-ledger.json` — 本包账本：9 条 conventions + 4 条 entries（CAL-001 唯一称呼 / CAL-002 现行措辞「源项目」/ CAL-003 状态目录名 / CAL-004 归档终态）。
- `scripts/check-caliber-ledger.mjs` — 执行器：`truth.anchorRegex` 锚点自检、`mirrors.require|forbid` 镜像同步、`scans.forbid` 禁出面、`pending` 挂账示众；`--staged` 触达清单。
- `scripts/init-caliber-ledger.mjs`、`scripts/caliber-ledger.example.json` — 下游项目开箱接线。
- `tests/test-check-caliber-ledger.mjs` — 行为契约 36 条（缺锚必须判畸形而非恒绿，防「恒绿假门」）。
- `scripts/check-skill-references.mjs`、`scripts/skill-reference-baseline.json` — 死引用棘轮 R1/R2/R3 + 25 处存量基线。
- `skills/product/doc-sync-guardian/references/caliber-ledger.md` — 账本用法契约（该技能第 4 份文件）。
- `evidence/20261001-caliber-ledger-and-dead-reference-ratchet.md` — 本文件。

修改（21）：`pre-commit` 加第 3 道检查；`verify.ps1` 加 5e/5f/5g 三步（默认档 21→24，全开 26）；README/SKILL/HANDOFF 步数与 bundle 数字同步；AGENTS.md 与 6 个脚本头注、「上游」→「源项目」措辞归一；`import-vibe-source.ps1` 头注重写为归档终态口径；`doc-sync-guardian` 正文 8 处错指收口；`LOCAL-PATCHES.json` 三条 `patchedSha256` 重录；catalog 与能力索引由生成器再生（82 records）；`.gitattributes` 尾注一处旧口径、`legal/ui-system-guardian/SOURCE-DECLARATION.md` 与 `tasks/20260919-v2-hardening-implementation.md` 各加一处指向现行名真源的括注（登记面不改史）、`install-runtime-projection.ps1` 补重解析点门与 DryRun 根解析回退，均系交叉复核与落地前现场核查所出（见 §6c、§6d）。

## 5. 当场抓到的活体冲突（本批存在的理由）

账本首跑即红两处，都不是本批引入的：

1. `AGENTS.md:44`「CRLF 是上游原样」——2026-09-30 改名批漏改，人工全仓审计没抓到。
2. 归档终态被写成现状：「归档 zip（2026-09-11 冷存）」「先恢复对应源项目检出再以 `-SourceRoot` 指向它」——那批 zip 已于 2026-09-12 由 owner 裁决删除，指导语指向一条不存在的恢复路径。

另有本批自造的一处：交接文档把账本条数写成「三条」而实为四条。**条数属自指**（改条目即须改文案），未纳入门禁，靠人工复核抓到——这恰好说明哪些事机器抓不到、别硬钉。

## 6. 验证（全部新鲜跑，2026-10-01）

- `scripts/verify.ps1 -IncludeHostEvidence -IncludePackage`：**26/26 全绿，且 `pwsh`（7）与 `powershell`（5.1）两个解释器各跑一次**；默认档 5.1 单跑亦 24/24。Detail 含 `claims=66 records=82 runtime=52 bundle=453 installed=455`、`default = 24 steps`、发布候选 `files = 924`。
- `node scripts/check-caliber-ledger.mjs --root . --report`：4 条目断言全绿，exit 0。
- `node --test tests/test-check-caliber-ledger.mjs`：36/36 通过。
- `node scripts/check-skill-references.mjs --root .`：扫描 162 文件、可执行面基名 689 个、命中 25 处（未登记 **0**，基线存量 25），exit 0。
- `node scripts/githooks/pre-commit.test.mjs .`：3 道声明全可实现且 fail-closed。
- 文档治理：0 error / 8 warn。

## 6b. 当场踩到的第二个坑：绿门在 5.1 下假失败

首跑 `powershell`(5.1) 得到 25/26，红的正是 5g 棘轮，而 Detail 指向一条**已登记**的存量提示行。原因：检查器把存量命中写到 stderr，5.1 的 `node … 2>&1` 会把 stderr 包成 ErrorRecord，`$ErrorActionPreference='Stop'` 下整条管道抛错；pwsh 7 不包 ErrorRecord，故 CI（`shell: pwsh`）永远看不见。修法：新增 `Invoke-Node` 包装（临时降 Continue、收全两路输出、成败只认退出码），5e/5f/5g 三步改用之。修后 **5.1 与 pwsh 7 双跑均 26/26**。

教训：本仓库门禁声明「5.1 也能跑同一套」，但只有 CI 用的那个解释器会被真跑——凡新增步骤消费子进程 stderr，必须在两个解释器下各跑一次，否则「本地红、CI 绿」会被当成环境问题忽略过去。

## 6c. 两批交叉复核（owner 指令：调用子代理对抗复核，确保修改没问题）

自跑全绿不等于门装对了。两路复核各查出真问题，以下按「查出什么／修了什么」如实登记。

**批 A（攻击账本执行器）——四种「无声摘门」在改动前一律全绿：**

1. include 面命中 0 个文件（门在跑但什么都不判）、整块 `scans` 被删、键名写错（`mirror` 少个 s，被当成「没有这道断言」）→ 三者全部改为非零阻断，并各配单测钉住；`--report` 模式照样拦（报告模式的豁免只给「口径断言红」，不给「账本自己写坏」）。
2. 零条目账本**保留** exit 0：下游项目 init 的第一天就需要能跑绿，代价是「清空账本」这一招摘不掉门——改为打印「零条目，未登记任何口径，放行」，把空转暴露在人眼里而不是静默。
3. glob 写法坑：`./docs/**` 与 Windows 反斜杠写法会让 exclude 整批失效、账本把自己扫红 → 加 `normalizeGlob` 归一，配单测（反斜杠经 bash heredoc 追加时会落成单反斜杠、被 JS 当转义序列，这类「测试自己假绿」也要防）。
4. 提交关卡自检原来只钉「密钥护栏」一项：手动删掉清单第 3 行（账本断言）仍报全绿 → 必需检查改成列表（密钥护栏 + 账本断言），删任一即红。

**批 B（复核文档与登记面）——五处与事实不符：**

1. 本证据文件三个数字是错的：基名 688→**689**、单测 30→**36**、「installed 455 → 456」这个数根本不存在（见 §7 更正）。
2. 死引用收口没做完：`doc-sync-guardian/SKILL.md` 里还留着一条指向 `code-review/references/review-profiles.md`（只存在于快照）的 .md 死依赖——棘轮只判脚本基名、判不到 .md 路径，这是它的覆盖洞，本条靠人工补掉。
3. 账本四条 `scans.include` 全部漏了 `tools/**`（账本自己的执行器与模板都在这个目录），CAL-001 另漏 `.github/**` → 补齐；补后面立刻红在 `tools/guardrails/gitleaks.toml`：密钥正则的字面形态撞上 CAL-002 措辞面，故单独 exclude 并写明理由（那是扫描器规则本体，不是文案）。
4. `LOCAL-PATCHES.json` 三处登记与事实不符：SKILL.md 哈希未随补漏重录、`linesChanged` 43→**42**、`document-surfaces.md` 2→**3**、`markdown-governance.md` 3→**4**。
5. `docs/HANDOFF-NEXT.md` 宿主态写成「已刷齐」过度：补漏又改了 SKILL.md，安装态实际回退 → 改为「内容待再刷一次，计数不变」，并把曾刷齐（哈希全等）与回退的原因都留下。**这一批结论后来被现场核查整条推翻**：本机宿主压根不是投影安装位（是回指仓库的 junction），见 §6d——登记保留是因为「谁在什么时候写过什么」本身要可回查。

**明确不修（记为已知边界，不假装已覆盖）：**

1. 棘轮只判**脚本基名**存在性，不判 .md 路径与目标项目路径：实测 46 处未解析引用里 45 处是下游项目自己的路径，一律判存在性会大面积误报——宁可留洞并写明，也不放一盏天天误伤的灯。
2. `tasks/**`、`evidence/**`、`legal/**`、`provenance/**` 不入账本 include：它们是时点登记面，旧口径是「当时的记录」不是「现行声明」。这条政策写进条目 note，免得下一个人当成遗漏去「修」。
3. 棘轮自身无单测、也不挂 `pre-commit`（只在 verify 默认档）：代价是不跑 verify 直接提交时死引用不设防。挂 pre-commit 需要棘轮先有契约测试兜住，否则改一个技能名就要动基线，提交关卡会先变成误伤源。

## 6d. 落地前的现场核查：一条差点删掉仓库的命令

owner 批准「现在刷宿主投影」后，先跑 `-DryRun`，被脚本自带的门拦下：`拒绝覆盖：C:\Users\MSX\.claude\skills\vibe-coding-skills 不带本仓库任何投影形态的标记`。现场查证结果与交接文档的口径不一样：

- `~/.claude/skills` → junction → `F:\skiils\_adapters\shared\skills`（143 条），其中 `vibe-coding-skills` **又是一条 junction，指回仓库根 `F:\skiils\vibe-coding-skills`**（穿透见 1882 文件，含 `.git`，git status 与工作树同为 29 条；无 `shared-projection-manifest.json`）。也就是说本机宿主从来不是投影安装位，它直读仓库——**「宿主内容待再刷」这条待办在本机根本不成立**，此前交接文档把它写成待办是错的（上一会话比出的「宿主哈希与仓内全等」全等的是同一个文件，不是同步成功的证据）。
- 真实危险：脚本 `-Force` 覆盖前的下一步是 `Remove-Item -LiteralPath $targetPath -Recurse -Force`，而 `-Recurse` 对 junction 会穿透到它指向的真实目录树。拿默认根跑一次「重装投影」＝删掉仓库本体连同 29 条未提交改动。当场拦住它的是既有的 manifest 标记门——这道门本来为「别覆盖别人的目录」而设，这次救的是「别把自己的仓库当安装位删了」。
- 投影形态另行实测（把 `-InstallRoot` 指到临时**实体**目录）：`-DryRun` 与真装各跑一次，均 `status=INSTALLED/DRY-RUN`、`fileCount=455`、`validated=true`；装后 `doc-sync-guardian/SKILL.md` 哈希 `9c3afab4…` 与仓内全等，新增的 `references/caliber-ledger.md` 在场，被删的那条死依赖不在场——**投影内容本来就是最新的**。临时安装位测完删除，仓库未动。

补的两处代码（都是 fail-closed，不改变正常路径）：

1. `Assert-PhysicalDirectory`：安装与卸载两路都先判目标是否重解析点，是则拒绝并说明「摘链接单独用 rmdir，递归删会穿透」。判据用 `Attributes -band ReparsePoint` 而不是 `LinkType`——后者按 PowerShell 版本对 junction 有的给值有的给空，判空即放行等于没有这道门。既有 manifest 门只防「不是我们的安装」，防不住「仓库里混进一份同名 manifest」这种状态，故这道门是独立的第二层。
2. 输出字段 `installRootResolved` 原来无条件 `(Resolve-Path …).Path`：目标根还没建时（新机器第一次装前想先看一眼）DryRun 直接抛「找不到路径」，等于预演只能预演已装过的机器。改成根存在才解析、否则回填报出的绝对路径。

## 7. 残留与待办

- 本机宿主布局与投影形态的分工已写进交接文档：本机走 junction 直读仓库（改动即时生效，无需安装），投影安装留给「要一份去控制面以外内容的干净副本」的场合。若哪天要把本机也切成投影安装位，得先把那条 junction 用 `rmdir` 摘掉再装——顺序反了就是一次删仓库操作。
- ~~下游项目账本尚无真实接入例证~~ —— **已闭环（2026-10-01 同日，见 §8）**：fs-agent 已接上执行器（升级硬化版＋14 例测试＋三模式实跑全绿），并另接一道它原来没有的文档脚本死引用棘轮。
- 25 处存量死引按各自登记的收口法分批消化，棘轮只保证不新增。
- 8 个未评审上游脚本按边界 1 明确不做（owner 裁决），不属本批遗留。
- 本包没有生产文件行数门禁，下发工具「尺寸是否适配下游」这一项只能靠真实消费者接线时才暴露（§9 是本批第一次抓到）。若要常驻，需要在本包补一道等价的结构检查——不属本批边界，留给 owner 单独拍板。
- 受管块（`target-runtime` v23）引用的六个工具只存在于 `sources/` 快照——**本包自身**的下游可见缺陷，处置三条路见 §8b，待 owner 拍板，本批只登记不越权改模板。

## 8. 下游实接（owner 令「接 fs-agent」，2026-10-01）

**接法**：`E:\fs-agent` 侧新增 `tools/check-doc-script-refs.mjs`（本包 `scripts/check-skill-references.mjs` 的**判定面变体**，不是复制）＋ `tools/doc-script-ref-baseline.json`（存量基线）＋ `tools/check-doc-script-refs.test.mjs`（14 例行为契约），并接进该项目 `tools/githooks/pre-commit` 第 7 项（`--staged`，同步扩 `pre-commit.test.mjs` 的 REQUIRED_CHECKS）。

**为什么是变体而不是复制**：本项目文档不写 `<skills仓库>/…` 占位符，直接写 `tools/x.mjs`、`worker/test/x.mjs`。故把「带仓内目录前缀的路径必须存在」升为 R1 主判据；R2 收窄为**只认本仓根占位符**（`<仓库根>/`、`<项目根>/`）。首版曾把 `<skills-root>/tools/x.mjs` 也剥前缀按本仓判，实测即误报——那是治理包的工具，本仓没有是对的。同理新增「跨仓占位符不判」一条并把两条误报登记从基线里删掉。

**三条放行面（都是实测逼出来的，不是设计时想到的）**：
1. **族名放行**：该项目文档惯按最长短语指一族测试（写 `worker/test/migration-safety.test.mjs`，盘上实为 `migration-safety-{success,failure}.test.mjs`）。首跑 6 处此类命中全属这一形。放行条件收紧为「同目录存在 以该词干 + `-` 开头、扩展尾一致 的文件」，计数打印，不做静默放宽。
2. **通配碎片不判**：`hotspot-*.test.mjs` 被正则截出 `.test.mjs` 碎片，首跑刷出 66 条假命中。只认紧贴名字的**单**星号为通配——Markdown 加粗 `**pre-commit.test.mjs**` 前两位都是星号，那是真名字必须照判（此条有回归例）。
3. **中文散文粘连**：正文里 `……各自合规的validate.mjs` 被连成一个 token。回退顺序＝原形 → 剥词首中文 → 取词尾中文之后一段，三形都不在盘上才判死；`docs/需求文档/**` 这类真含中文的段名不受影响（只在原形判不成立时才回退）。
4. **窄面不许判过期**：`--scope` 缩面时，被挡在面外的基线条目一度全部判「登记过期」，一次性假红 40 条。改为：文件在扫描面外且仍在盘上＝不判（计入「不在本轮扫描面」打印）；载体文件已不存在＝照判过期——「没看」不等于「没有了」。

**扫描面（三面排除，跳过量一律打印）**：`docs/**.md` 除 `docs/历史归档`（时点事实，改写＝伪造）、`docs/调研档案`（外部代码叙述面：调研卷里的 `tools/delegate_tool.py` 是**别人仓**的路径，首段恰好与本仓 `tools/` 同名）、`docs/项目治理/验收证据`（跑完即删的 `debug-*.mjs`／`.tmp-*-acceptance.mjs` 属当轮存证）＋ 根 `AGENTS.md`／`CLAUDE.md`／`文档索引.md`。实跑量：扫 82 个文档，排除 70／38／172。

## 8b. 顺带抓到的本包缺陷：受管块引用六个只存在于快照的脚本（未修，需 owner 拍板）

接入过程中逐条给 fs-agent 的存量定 `why`，实测出**本包自己的**病灶：

- fs-agent 的 `AGENTS.md`／`CLAUDE.md` 受管块（`vibe-coding-skills:target-runtime` **version=23**，checksum `e15269e0…`）正文引用六个脚本：`check-markdown-governance.mjs`、`build-target-doc-index.mjs`、`resolve-target-doc-context.mjs`、`setup-target-hooks.mjs`、`check-target-doc-precommit.mjs`、`check-ui-reuse.mjs`。
- 六个名字在本包**只存在于 `sources/vibe-coding-skills/tools/` 保真快照**，`tools/` 与 `scripts/` 的 live 树里没有（逐个 find 实测）。按本包 AGENTS 迁移规则，快照「只读、不可执行、永不下发」——即受管块在教每一个下游项目去跑本包根本不下发的工具。
- 同块引用的 `init-target-runtime.mjs` 确实存在（`tools/init-target-runtime.mjs`），属正当跨仓引用，两者必须在收口时分开处理。
- **本包的检查器抓不到它**：`scripts/check-skill-references.mjs` 的扫描面是 `skills/**/*.md` ＋ 根 `SKILL.md`，而这些名字写在 `skills/event/experience-elevator/tools/init-target-runtime.mjs` 的模板字符串里（.mjs 不在扫描面），且是裸脚本名而非 `<skills仓库>/…` 形态。这是本包死引用门的第二个真实盲区（第一个是棘轮只判脚本基名不判 .md 路径，已在 §6c 登记）。
- 范围澄清（不夸大也不缩小）：这六个名字**不止**受管块有——本包自有技能正文同样在引用它们（`dev-builder`、`bug-fixer`、`dev-planner`、`ui-system-guardian` 等），已按 §7 的 25 处存量逐条登记；受管块的特殊性只在于它随 `--write` 下发到**每一个下游项目**，所以同一处错会被复制 N 份。
- **未修理由**：动受管块＝动模板＋checksum＋全部下游项目的 AGENTS/CLAUDE 再刷一遍，属跨项目批量改动，按边界须 owner 单独拍板；本批只登记与给出处置选项（改文案指向现行工具 ／ 把这六件重新落进 live 树 ／ 明确标注为「旧代契约维持」并让下游文档不必再引其命令形态）。
- fs-agent 侧的处置：这六个名字的命中按「上游受管块死引、本仓不得手改」逐条登记进它的基线（`why` 字段写明实探结果），既不沉默放行也不越权代改。

## 8c. 下游实接的验证（全部新鲜跑，2026-10-01）

- `node --test tools/check-doc-script-refs.test.mjs tools/check-caliber-ledger.test.mjs tools/githooks/pre-commit.test.mjs` → **38/38 全绿**（检查器 14 例、口径账本 14 例、提交钩子 10 例）。
- 直接 `sh tools/githooks/pre-commit`（七项门禁全跑，只读不提交）→ **exit 0**，输出「口径账本：4 条目断言全绿」＋「文档脚本死引用检查：… 命中 50 处（未登记 0 处、基线存量 50 处）」＋ 钩子口径的一行存量摘要（明细收进 `why` 字段，避免每次提交刷 18 行）。
- 钩子里**没有代跑 git 暂存**：`--staged` 只读 `git diff --cached --name-only` 列触达文档，非仓库环境下 fail-closed 非零并点名原因（有回归例）。
- 突变试验（现场跑完即清，不留文件）：① 新造 `tools/definitely-not-a-real-tool.mjs`＋`nope-checker.mjs` 两处假引用 → 立即红 2 条；② 临时登记进基线 → 转绿并计入存量；③ 删掉载体文档但保留登记 → 报「基线登记已过期（载体文件不存在）」仍红。三态行为与棘轮设计一致。
- fs-agent 侧提交结果见 §9（owner 令「提交，推送」后落地，只提工具不含在途文档）。
- 该项目文档面（`docs/执行计划/执行光标.md` 的新门禁登记行）**刻意未写**：受管文档改动必须同批跑 `check-doc-index --fix` 刷指纹，会与他线在途文档搅在一起；登记落点改为本节与该项目钩子头注（钩子清单是它自己定义的单一真源）。


## 9. 提交时被下游门禁反噬：本包下发的执行器自己超行（owner 令「提交，推送」，同日闭环）

- **首刀实拦**：fs-agent 的 `sh tools/githooks/pre-commit` 对暂存面跑结构棘轮，报 2 个 BLOCKER——`tools/check-caliber-ledger.mjs` 400 行、`tools/check-doc-script-refs.mjs` 366 行，超该项目 `tools/hotspot-policy.mjs` 的 `LIMITS.productionFileLines = 300`。棘轮口径是「存量只减不增」：HEAD 里 290 行的旧版被顶上去即算新增，新建文件无基线直接判红。该项目唯一的例外通道 `tools/hotspot-exceptions.json` 只收 sha 锁定的 `.rs` 类型别名，JS 侧无绕道；走 `--no-verify` 等于逃掉该仓唯一结构防线，不走。
- **修法按职责拆，不压薄断言迁就行数**：下游新增 `tools/caliber-ledger-core.mjs`（键名白名单／glob 归一／条目预编译／扫描器／暂存面解析）与 `tools/doc-script-refs-core.mjs`（盘上索引＋四条放行面判定），两个 CLI 只留装载、扫描面装配、基线对账与输出。核内不碰 `console` 与退出码，畸形与坏正则一律 throw 成品诊断行、由 CLI 逐行落 stderr——诊断文案与退出语义逐字照旧，回归钉全在。拆后 231／239（账本）与 247／148（死引），热区 blockers=0。
- **这条才是本批的真产物**：本包下发给每个下游的执行器 `scripts/check-caliber-ledger.mjs` 单文件 390 行，而下游普遍有 300 行生产文件门禁——第一个真实消费者恰好在「接线提交」这一步被自己的门禁拦下，边界 3「所有下游项目开箱可用」当场不成立。本包自身不带行数门禁（`verify.ps1` 无此步），所以这道毛病在本包内永远测不出来，只有实接才暴露；与 §8b 的受管块快照死名同属「只有下游才能发现的病灶」这一类。
- **上游同批拆**（毛病不留在下发面）：新建 `scripts/caliber-ledger-core.mjs`，`scripts/check-caliber-ledger.mjs` 瘦身为 223 行；`scripts/init-caliber-ledger.mjs` 改为一次复制**两个**文件——CLI 里是 `import "./caliber-ledger-core.mjs"`，只发一个文件等于给下游一个跑不起来的执行器——并把缺文件诊断改成列出缺哪个、头注写明两文件必须同批走及其动机。
- 同源性自证：脚本比对两仓 body（从首个 `import` 行起）→ 账本 CLI 与判定核均报「逐字同源」，差异只在头注的署名与动机段。
- 下游接线演练（隔离临时仓，跑完即删）：`node scripts/init-caliber-ledger.mjs <tmp>` → 两文件＋空账本＋新建 pre-commit 全绿；在临时仓里 `git add -A && git commit` 让接好的钩子真跑一遍 → 输出「口径账本：零条目，未登记任何口径，放行」且提交成功；目标项目内 `node tools/check-caliber-ledger.mjs --root . --report` exit 0。
- 验证：本包 `node --test tests/test-check-caliber-ledger.mjs` **36/36**、本包账本 4 条目全绿；下游三套 **38/38**、七项钩子 exit 0（测试文件 313／452 行只落 WARN 线，不阻断）。
- 提交与推送：本包 `04c867f`（§8／8b／8c 证据）与上游拆分同批；下游 `bd3bece7`（工具十件，逐名 stage，绕开在途 `docs/调研档案.md` 与 097／098 两卷，未用 `git add -A`）；两仓均已 push origin/main。
- 未做（如实）：本包 `scripts/check-skill-references.mjs`（188 行）不拆——没有门禁逼它，为拆而拆只增维护面；下游文档面登记仍未写（理由见 §8c 末条）。

## 9b. 拆分后的两路对抗复核（owner 老规矩：完工前 ≥2 路子代理交叉查）

复核口径：一路查「拆分是否行为保真＋有没有别处仍按单文件假设引用」，一路查「新文件是否漏进本包的清单／投影／登记面」。结论与处置逐条如实登记：

**查实的伪问题（不做，理由写清）**：
- 「新文件漏收进下发清单」——不成立。根 `scripts/` 从不进运行时投影（投影 include 只由 catalog 的 bundle 驱动，收录范围是 `skills/**` 与 `governance/sliver-core/**`；`packaging/runtime-projection.json` 还明文拒绝再存第三份文件清单），`provenance/LOCAL-PATCHES.json` 登记的 41 个文件里没有根 `scripts/` 的任何一条，`verify.ps1` 23 步里没有「枚举 scripts/ 文件数」这种门。早有同形先例：`scripts/init-doc-governance.mjs` 的 CLI＋共享模块就是多文件复制，而 `doc-gov-shared.mjs` 在所有清单里零命中。
- 「`SKILL.md` 依赖块只列 CLI 没列判定核」——不改。依赖块语义是「本技能要运行什么」，技能确实只调 CLI；真要手工只拷一个文件，执行时是 `Cannot find module` 的**当场炸响**，不是静默放行，属可自暴露的误用。动 `skills/**` 要连带重录 `patchedSha256`（保真树补丁登记），为一个不会静默的失败付漂移成本不值。

**查实并已修的四处（都是本刀自己带的毛病）**：
1. 基线 JSON 坏掉走裸堆栈：`tools/check-doc-script-refs.mjs` 的 `JSON.parse` 未包 try，而头注承诺「基线畸形非零并点名」——现包成诊断行「基线文件不可读或 JSON 畸形 ＋ 修复：恢复到上个提交的基线版本」，并补回归例（坏基线必须非零且不是堆栈）。
2. 排除面计数打印 `undefined`：`isExcluded` 认「exclude 整项就是文件名」，而计数键只用 `startsWith(面/)` 匹配，找不到键名 → 汇总行出「排除面：undefined 1」。改为两处用同一判定，并在窄面例里加 `doesNotMatch(/undefined/)` 钉。
3. 核内 12 个导出无人消费（`ALLOWED_KEYS`／`compileRegex`／`assertKnownKeys`／`normalizeGlob`／`globToRegExp`／`SYSTEM_COMMANDS`／`EXTS`／`SCRIPT_TOKEN`／`SKIP_DIRS`／`splitStem`／`stripLeadingCjk`／`familyExists`）：两仓测试都只从 CLI 入口子进程整跑，导出它们只凭空扩公共面。全部收回为模块内私有，并把核内头注那句「两侧各自可独立测」改成实话（契约由 CLI 入口守住，拆内部函数不带来可独立测的好处）。
4. 「零条目先于 skipDirs 校验」这条拆法要件**没有任何回归钉**——核内注释把它当拆两步的理由，两仓测试却都没覆盖；谁把两步合回一次校验，测试仍全绿，而「还没登记口径的项目」会被坏 skipDirs 连带判红，正好挡在接线第一步。补钉两仓各一条（空账本＋`skipDirs: "dist"` 必须 exit 0 并打印零条目），本包用例由 36 → 37。

**查实并补的接线缺口**：fs-agent 的 `tools/verify-project.mjs` 步骤表里没有死引用检查——它只活在 pre-commit 的 `--staged`。owner 边界 2 明写「两层都要：定期报告 ＋ 提交拦已入账项」，全量档不跑它＝定期报告那半永远看不见。已补 `docs:scriptrefs` 步进步骤表快慢两档共用段（fast／full 都常驻，毫秒级），位置在 `caliber:ledger` 之后不打乱既有按位解构。

**第三条门禁（同一条命令连续三次被拦，每次都是真问题，无一次绕）**：补完那一步，`planVerifySteps` 函数体达 106 行，触该项目 `LIMITS.functionLines = 100` 的 BLOCKER——前两条是文件行数、这条是函数行数，拆文件不解决它。修法是把「fast 与 full 共用的那一段步骤」抽成独立函数 `coreSharedSteps(rootDir)`，编排函数只留按档拼装；顺手删掉该段里从未使用的 `workerDir` 局部量。抽后 `verify-project.mjs` 222 行、各函数都在线内，步骤顺序复验不变（fast 8 步、full 20 步，`docs:scriptrefs` 紧随 `caliber:ledger`）。本包自身没有行数与函数长度门（`verify.ps1` 无此步），这三条只能由真实下游逼出来——与 §9 那条同因。

**数字口径澄清（防后来人误读 git）**：复核按 git 取「拆前」基线时发现，`bd3bece7~1` 里 `tools/check-caliber-ledger.mjs` 是 **290 行的硬化前旧版**，被门禁报的 400 行属于**当时暂存面的工作树版本**（＝上游 390 行 ＋ 下游头注 10 行），从未单独入过 git；366 行那个尺寸同理只存在于暂存面。§9 说的「下发执行器单文件 390 行」才是 git 里可复现的那个数。

**复核实跑数（新鲜）**：fs-agent 四套 58/58（账本 16、死引 15、verify-project 编排 17、钩子语义 10）；本包 `node --test tests/test-check-caliber-ledger.mjs` 37/37、账本 4 条目全绿、`verify.ps1` 24/24。两仓 body 逐字同源自证复跑：账本 CLI 与判定核均「逐字同源」。
