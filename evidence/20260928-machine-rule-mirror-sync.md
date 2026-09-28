# 证据：本机用户级 Agent 规则口径统一（7 份宿主复制 + 漂移检查脚本报红文案改进）

- 日期：2026-09-28
- 输入 revision：起点 main @ `31cff15`；本文件是本批在**本仓库内**的唯一改动
- 改动面在仓库外：内容改动落在 `C:\Users\MSX\` 下 7 份用户级规则文件与 `C:\Users\MSX\bin\check-agent-rule-mirrors.ps1`，两者都不在本仓库工作树内；未动 `provenance/`、`governance/`、任何生成镜像或 `sources/` 快照，故不产生 `provenance/LOCAL-PATCHES.json` 登记（该通道只记快照树内补丁）
- owner 授权链：本会话先做只读复核（三问 + 全机矛盾排查），owner 依次批准「A 改，带上 B」→「你来处理」→「接受你的建议」
- 归属拆分（同日同机两个会话，必须分清）：

| 动作 | 由谁完成 | 时刻 |
|---|---|---|
| Cursor 复制件由 2026-09-08 双入口旧约改写为统一入口版；检查脚本把 Cursor 加进 `$mirrorRels`、反查后缀补 `.mdc` | 并行会话 | 15:05:45 / 15:05:58 |
| 7 份文件「spec 真源唯一」一条的措辞改写 | 并行会话 | 19:08:05 |
| `C:\Users\MSX\.agents\skills.pre-unify-20260824` 整目录删除（owner 同日授权清空技能冷存） | 并行会话 | 15:1x–19:13 之间 |
| 检查脚本报错文案改进 + 故意打断实测 + 冷存整机复核 + 本证据 | 本会话 | 19:15–19:3x |

## 1. 起因：只读复核查出四处口径不一

复核问题是「帮我看看这个项目下一步怎么走该进哪个入口 / 旧入口 `vibe-coding-skills` 与同名 `tdd`、`code-review` 现状 / 判定项目治理类型要不要看 `.vibe-docs.json`」。答案全部由本机文件原文给出：进 `feisheng-vibe-coding`（`C:\Users\MSX\AGENTS.md:46`）；旧顶层条目已退役并从磁盘删除、不可回滚，同名独立条目不可直呼（`:47`、`:49`）；不用 `.vibe-docs.json` 判定项目类型，真源由统一入口控制面的 target-truth 拥有（`:48`）。

排查出的四处不一致，以及各自的最终处置：

| 发现 | 当时的原文证据 | 现状 |
|---|---|---|
| Cursor 复制件仍是旧双入口约，且 `alwaysApply: true` 每次对话注入 | `C:\Users\MSX\.cursor\rules\skills-routing.mdc`（2026-09-08 05:23 版）第 11 行「**工程纪律类一律 mattpocock**：写测试用 `tdd`；…」与第 13 行「**spec 真源二选一，禁止双轨**：vibe 治理项目（根目录存在 `.vibe-docs.json`）…」 | 已由并行会话按同款镜像块改写；全机反查「分流判据 / 2026-09-08 由 owner 授权固化 / spec 真源二选一」零命中 |
| 规则禁用某文件，统一入口自带的记录程序却要求必须有该文件 | 见 §2 | 措辞已改（见 §3） |
| 规则称「已从磁盘删除…均不留冷存」，盘上仍有含退役名字的旧备份 | `C:\Users\MSX\.agents\skills.pre-unify-20260824\` 内实测存在 `vibe-coding-skills\` 与 `code-review\`（该目录当时 48 项，无 `tdd`） | 目录已删除；复核见 §4 |
| 真源该节用三级标题、6 份复制件用二级标题 | 五条要点正文逐字一致 | 判为排版差异，不改（脚本按要点行比对，不按标题） |

## 2. 规则与代码互相打脸的硬证据

改动前真源第 48 行原文：

> `- **spec 真源唯一**`：…；**不再创建或使用** `.vibe-docs.json` 判定项目类型。

而本仓库自带的经验记录程序对该文件是硬依赖（缺即 fail-closed）：

- `adapters/vibe-hooks/contract.json:21` — `"ledgerSource": "target .vibe-docs.json experienceGovernance path; fail-closed when missing/unregistered/not contract-whitelisted"`
- `adapters/vibe-hooks/experience-recorder.mjs:130/133/142` — 拼路径、`if (!fs.existsSync(docsPath)) fail("ledger-disabled", "目标项目缺少 .vibe-docs.json，经验治理未启用");`、`.vibe-docs.json 未登记 experienceGovernance`

这条不是「安装态旧副本残留」：仓库本体与安装态副本 `F:\skiils\_adapters\shared\skills\feisheng-vibe-coding\adapters\vibe-hooks\experience-recorder.mjs` 实测同哈希（`00f8530d…`），即现役行为。字面的「不再创建或使用」会把下一个读规则的 agent 引向两条错路：拒绝为目标项目登记该文件，或把这条 fail-closed 判成遗留代码删掉。`docs/ARCHITECTURE.md:19` 早已给出正确边界——「`.vibe-docs.json`、issue tracker 和其他文档索引只能作为适配器或投影，不能形成并列 authority」，本次只是把这条边界提升到用户级规则的文字里。

## 3. 落地后的现状

真源 `C:\Users\MSX\AGENTS.md:48` 现文（7 份逐字一致）：

> `- **spec 真源唯一**`：目标项目的需求/计划/术语/验收真源由统一入口控制面的 target-truth 拥有；不再用 `.vibe-docs.json` 判定项目类型；这个文件的其他用途（比如经验台账登记存放路径）以控制面登记为准。

七份现状（字节数 / 修改时刻，全部同一分钟）：`AGENTS.md` 8404、`.codex\AGENTS.md` 13368、`.claude\CLAUDE.md` 9868、`.gemini\GEMINI.md` 3021、`.config\opencode\AGENTS.md` 1945、`.kiro\steering\skills-routing.md` 1972、`.cursor\rules\skills-routing.mdc` 2044，均为 2026-09-28 19:08:05。

本会话准备过一次「按旧句锚点改写」的批量脚本，实跑结果 7 份全部命中次数 0、`changed=0`，即**一个字节都没写**——锚点已被并行会话改走。这是本批不做二次改写的原因：两条流水线写同一行必然产生漂移。

## 4. 零冷存复核（含覆盖面与限度）

定点扫描结论：带退役名字的目录在本机只剩 `sources/vibe-coding-skills` 与 `sources/mattpocock-skills`，即根 `AGENTS.md` 迁移规则指定的唯一内容真源，按定义不属于「冷存」；宿主实际加载的技能根 `C:\Users\MSX\.agents\skills` → `F:\skiils\_adapters\shared\skills` 共 143 项，其中无退役名字；`F:\skiils\_archive`、`F:\skiils\_backups` 均为空目录；在 `F:\skiils`、`C:\Users\MSX\.kiro`、`C:\Users\MSX\.agents`、下载夹、桌面这几处按压缩包通配检索，命中为零。

限度要说清：这是**限深定点扫描**（`find -maxdepth 3`，`_archive`/`_backups` 下到 4 层，跳过 sessions/cache/node_modules 一类高噪声目录），不是整机全盘；压缩包口径是「名字含 vibe 的 .zip」「名字含 mattpocock 的 .zip」「名字含 7z 的任意文件」三种通配，命中为零。`C:\Users\MSX\.kiro\skills.pre-unify-20260824` 仍然存在，内容实测为 hyperframes 一族，与退役条目无关，本批未动它。

## 5. 机器门实测：从「知道哪个宿主错」升级到「知道哪个词错」

漂移检查 `C:\Users\MSX\bin\check-agent-rule-mirrors.ps1` 此前把两侧各截前 48 字打印，差异在 48 字之后时屏幕上就是两句一模一样的前缀。本会话新增 `Format-BulletDiff`（定位第一个不同的字 → 共享前缀照抄 → 分叉处插 `▏` → 两侧各多印 40 字），并只替换那条报错文案的调用处；判定逻辑（比对、条数、缺标记、未登记宿主、fail-closed）未改。改动量 194 行 / 9,324 字节 → 211 行 / 10,209 字节，工作树换行改前改后都是全 CRLF（194/194 与 211/211 带回车）、无字节顺序标记。

在系统临时目录克隆 7 份做故意打断，每例独立副本，真文件只读（前后 sha256 逐份比对一致）：

| # | 故意打断 | 期望 | 实测 |
|---|---|---|---|
| A | 原样复制 | exit 0 全绿 | `exit=0`、`all consistent`（证明文案改动没弄坏判定） |
| B | Codex 副本第 4 条中段「均不留冷存」→「仍留冷存」 | exit 1 且能看见差异词 | `exit=1`，报「前 173 字相同，▏ 后开始分叉」，两侧差异词直接印出 |
| C | Kiro 副本一条被截短 | exit 1 | `exit=1`，报「前 256 字相同」，被截短侧显示「▏」后为空 |
| D | Gemini 副本删掉整条 | exit 1 报条数 | `exit=1`，「条数 真源=5 本宿主=4」 |
| E | Claude 副本删掉镜像起始标记 + 新造 `.newhost\x.md` 带该节标题 | exit 1 两条 FAIL 都在 | `exit=1`，「找不到 SKILLS-ROUTING 镜像标记」+ 未登记宿主绝对路径 |
| F | 真源整个缺失（空根目录） | exit 1 不静默放行 | `exit=1`，真源缺失加 7 条「规则文件不存在」（改后脚本复跑确认） |
| G | Gemini 副本第 1 条改「由它的控制面选主路由」→「由宿主自行选路由」+ 带 `-LogFile` | 日志留 INCONSISTENT 明细 | `exit=1`，报「前 96 字相同，▏ 后开始分叉」；日志行 `2026-09-28 19:37:04 INCONSISTENT` 带同一分叉片段（改后脚本复跑；该日志写在临时目录，未进 `~\bin\agent-rule-mirrors.log`） |

表内 7 例均为**改后脚本**实测：A–E 一批，F、G 因初测用的是改前文案，本会话另起临时树复跑过。

改后拿真文件复跑：`exit=0`，7 份「5 条要点与真源逐字一致」。日志最近两行为 19:13:37 OK、19:21:00 OK（后者由改动前的脚本写入）；计划任务 `AgentRuleMirrors-Check` 状态 Ready、上次结果 0、下次 2026-09-29 10:30:30，明天起用新版报红。

## 6. 未做与遗留

- 本文件写完不提交。本会话在 19:2x 查 `git status --short` 时看到并行方的 `M  provenance/PROVENANCE-INTEGRITY.json`（已暂存）；紧接写本文件前再查一次为干净，而 HEAD 仍是 `31cff15` 未前移——该暂存的去向是并行方的动作，本会话未对其做任何处置，也不代其提交。
- 「T2 及以上」在 7 份规则里都只规定检查项（`C:\Users\MSX\.codex\AGENTS.md:51`、`C:\Users\MSX\.claude\CLAUDE.md:32`），未写该等级从哪读；本机规则层对这个判据仍是空缺，只能由统一入口控制面给。本批不补，因为补它需要新证据而不是改写措辞。
- 检查脚本继续不比对 pwsh 生成物摘要段（各宿主是改写摘要，逐字比对会天天误报），该取舍写在脚本注释里，本批未改。
- 本机技能冷存现为 0（`.agents` 那份已删）；`C:\Users\MSX\AppData\Local\Temp` 下本会话产生的克隆树、备份与三个临时脚本已清理，回退用备份按 owner 指示一并删除。
- 工作树共存事实（定责用）：本会话写本文件期间，并行方于 **19:35:48** 把 `governance/sliver-core/**` 的工作树换行由 CRLF 改成 LF——`git ls-files --eol` 实测 `i/crlf w/lf`，受影响 223 个文件；加 `--ignore-cr-at-eol` 复算后仍有 **1 个文件存在换行之外的 1 行内容差**（`governance/sliver-core/tests/execution-backbone-cases.json`）。该树带 `-text` 且其逐文件与树摘要登记在 `provenance/PROVENANCE-INTEGRITY.json`，本批未参与、未回退、也未据其结果下任何结论；因此本会话**没有跑 `verify.ps1`**（不在别人的在途改动上留门禁产物），本批的验证只到 §5 那 7 例实测为止。
