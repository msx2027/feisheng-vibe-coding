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
- 下游项目账本尚无真实接入例证：init 接线器已就位，第一个消费者是 fs-agent，接完才知道模板是否真开箱可用。
- 25 处存量死引按各自登记的收口法分批消化，棘轮只保证不新增。
- 8 个未评审上游脚本按边界 1 明确不做（owner 裁决），不属本批遗留。
