# 证据：全链路审计与收口批次（分批多 Agent 审计 → 逐条复核 → 修复 → 新鲜验证）

- 日期：2026-09-12
- 触发：owner 指令「用 goal 目标做整个项目的链路审计扫描，分批次、每批多个子 Agent 审不同角度，不看单个技能包，只审整条链是否闭环自洽，并修复直到收口」
- 方法：批次 1 = 5 个只读子 Agent 并行（owner 写入权 / 来源快照 / 分类投影运行时 / 门禁 CI 证据 / 文档宿主部署）+ 基线 verify；主 Agent 对每条发现逐条复核证据后再修复；批次 2 = 复检 Agent 对抗性复审 + 双 shell 新鲜验证
- 范围声明：按 owner 要求未评审任何单个技能包的内容质量，只审链路闭环

## 1. 基线（修复前真值）

- pwsh 7（CI 同款）：verify 默认 13 步全绿。
- **Windows PowerShell 5.1：15 步门禁在第 5 步失败**——`tests/test-vibe-hook-adapter.ps1` 引用 PS Core 专有变量 `$IsLinux`，5.1 + StrictMode 直接抛错。单入口验证器在 win32 默认 shell 上跑不通，与 workflow 头注「5.1 也能运行同一套门禁」矛盾。

## 2. 发现与修复（P0/P1 全修，P2 择要修复）

### A. 退役/过期引用内容（修复 + 登记补丁，28c8089 同机制）

| # | 发现 | 处置 |
|---|---|---|
| A1 | **[P0] retired `shape` 的 `/shape` 命令引用残留 6 处**（audit/SKILL.md:122,141、critique/SKILL.md:162,227、impeccable/reference/craft.md:7,11）——28c8089 残留扫描把同形词 id 剔除在扫描外，`/shape` 命令形态漏网，该批「残留 0 处」结论对 shape 不成立 | 命令清单移除 `/shape`；craft.md 流程步骤改为已接入等价物 `/design-brief-builder`（accepted-product） |
| A2 | **[P0→扩大] 35 个已接入 SKILL.md 的 frontmatter description 门控短语仍指向已退役别名入口 `vibe-coding-skills`**（子 Agent 首报 2 处，主 Agent 全量扫描实为 35 处；宿主可见的 description 指向包内不存在的入口） | 总入口改名为唯一公开入口 `feisheng-vibe-coding`（每文件 1 行，不改触发语义） |
| A3 | 登记：`LOCAL-PATCHES.json` 更新 `retired-capability-reference-text-fix` 的 6 个文件 `patchedSha256`；新增补丁 `entry-gate-description-retarget`（30 文件，originalSha256=来源快照、patchedSha256=补丁后副本，fail-closed 可逆）；再生 `CANONICAL-CATALOG.json` 与 `docs/CAPABILITY-INDEX.md`；verify 1c 消费 40 个已登记补丁全绿 | — |
| A4 | **[P2] `docs/CAPABILITY-INDEX.md` 裁决表以现在时描述 retired 成员**——复核为生成器渲染层可改进项，本轮未改生成器（改动面/风险大于收益，已在 HANDOFF-NEXT 无登记负担；如需处理应在 build-capability-index.ps1 渲染层为 retired 成员加标记后再生） | 暂缓，登记于此 |

### B. 门禁链（新门禁 + 既有断链接通 + 双 shell 修复）

| # | 发现 | 处置 |
|---|---|---|
| B1 | **[P0] verify 在 PS 5.1 不可运行**（见基线） | hook 测试平台守卫改 `$env:OS` 判定（`$IsLinux/$IsMacOS` 为 PS7+ 专有）；非 Windows 平台显式打印 `[SKIPPED]`（此前静默跳过）；verify/hook 测试的 param 默认值改 `$MyInvocation` 写法（PS 5.1 的 param 默认值里 `$PSScriptRoot` 为空）。实测：PS 5.1 默认门禁 **15/15 全绿**，pwsh **17/17 全绿** |
| B2 | **[P1] `tests/test-collector-path-resolution.ps1` 声明了单测但从未接入任何入口**（宿主证据归属逻辑无回归保护） | 接入 verify 新步骤「collector 路径归属单测」（测试失败走 `exit 1`，步骤显式检查 `$LASTEXITCODE`） |
| B3 | **[P1] collector 测试文件是无 BOM UTF-8 + 中文注释**——PS 5.1 按 ANSI 误读时注释吞掉下一行赋值语句，4 个用例假红（该测试在 5.1 下从未真正通过过） | 补 UTF-8 BOM（与全仓 .ps1 约定一致）；双 shell 17/17 |
| B4 | **[P0] 退役引用扫描无门禁**（28c8089 的一次性人工扫描不防回归，同形词剔除是盲区） | 新增 `scripts/validate-retired-references.ps1` 并接入 verify：全量 retired id 的 `/id` 命令形态、屏蔽 `sources/` 快照路径引用（等长掩码保行号）、343 文件全扫。**反例注入实测**：写入 `/codebase-memory-scout` 即 FAIL（精确定位 行:列），移除即 PASS——fail-closed 成立 |
| B5 | **[P2] CI push+PR 双通道无 concurrency**，同 ref 重复消耗配额 | release-gate.yml 加 `concurrency.group = release-gate-${{ github.ref }}`（cancel-in-progress） |
| B6 | **[P2] `smoke-host-skill-discovery.ps1` 默认 `-SourceRepositoryRoot` 指向已删除的源目录**；`import-vibe-source.ps1` 历史角色未标注 | smoke 默认改空 + 显式守卫提示（`-FetchTrustedBaseline` 需显式传入含基线对象的检出）；import 脚本头加历史 bootstrap 注记（灾备恢复路径以 SOURCE-INVENTORY 为准） |

### C. 登记/基线（来源归档后的手工校正，双重对账 + 注记）

| # | 发现 | 处置 |
|---|---|---|
| C1 | **[P1] 三个归档 zip 不在登记位置**：`F:\skiils工具\_archive` 实测为空目录（0 文件，mtime 2026-09-11 23:52 晚于最后提交），全盘浅层搜索无 `*20260911*.zip`；AGENTS.md / SOURCE-INVENTORY / HANDOFF-NEXT 检查清单均声称或期望其存在 | **未擅改 AGENTS.md 归档规则**（owner 级裁决事项）：SOURCE-INVENTORY 加 `auditNotes` 登记实测事实；HANDOFF-NEXT §13 检查清单行改为「实测为空，下落待 owner 裁决」；仓库内快照 + PROVENANCE-INTEGRITY 仍是唯一可校验终态。**需 owner 裁决：zip 是被移动还是丢失** |
| C2 | **[P1] 归档 zip 的 files/bytes 两份记录互相矛盾**（SOURCE-INVENTORY vs evidence：vibe 1342/12,281,313 vs 553/5,767,024；matt 173/1,046,962 vs 136/3,057,201），zip 缺席后不可仲裁 | 并入 C1 的 `auditNotes`（前者疑为 zip 全量口径、后者疑为快照白名单口径，待 owner 裁决） |
| C3 | **[P1] `PROVENANCE-INTEGRITY.json` 文件级补丁记录过期**：sliver `engineering-execution.md` 的 `patchedSha256=5255fe09…`，与 LOCAL-PATCHES（b6c78417…）及实际文件三方不一致；且 49207c0/00498fb 曾部分手改该文件未重录 | 修正为实际值 b6c78417…（与 LOCAL-PATCHES、实际字节双重对账）+ 新增 `annotations` 注记说明来龙去脉。来源归档后 `record-provenance-integrity.ps1` 按设计不可重跑（fail-closed 要求与来源逐字节比对），故手工修正 + 注记是唯一合规路径 |
| C4 | **[P2] `SOURCE-INVENTORY.json` vibe 快照树摘要过期**（d74d2c5a=2026-09-10 旧基线，现值 d22a304c） | 刷新为 PROVENANCE-INTEGRITY 现值（注记说明） |
| C5 | **[P1] `OWNER-LEDGER.json` 把 skill-catalog 的写入点指到再生投影**（path=CANONICAL-CATALOG.json，与「唯一写入点=SKILL-CLASSIFICATION.json」规则在指认上漂移）；runtime-projection 条目指向 `packaging/runtime-projection.json` 及其 writes 声明与现实投影机制不符；status 停留在 "skeleton" | skill-catalog：path→SKILL-CLASSIFICATION.json，catalog 移入新字段 `ownedProjection`，加 note；runtime-projection：path→`scripts/runtime-projection-guard.ps1`（唯一共享实现），inputs/projections 对齐三个 builder 与安装清单，加 note；status→`active`（已核实：catalog 消费方只读 owner id，字段变更不影响门禁） |
| C6 | **[P1] `packaging/runtime-projection.json` 是过期投影**：无生成者/消费者/守护者，hostFacts 指向已不存在的 `adapters/codex|claude/...` 阶段 3 旧布局 | 4 处死路径对齐实际落盘（`governance/sliver-core/packaging/adapters/...`，逐一 Test-Path 验证存在）+ 加 projectionNotes 定位其「策略/叙事文档」角色 |
| C7 | **[P2] `contract.json` 前置条件 prose「39 admitted」过期**（证据文件实际 52） | 更正为 52 |
| C8 | AGENTS.md「逐文件 sha256 在 provenance/ 内自证（步骤 3 强制）」措辞过强（步骤 3 实为聚合树摘要） | 措辞精确化为「逐文件与聚合树摘要两级（1b/1c/1c-2 逐文件、步骤 3 树摘要）」，规则语义不变 |

### D. 文档与现实收口 + 卫生

- **[P0] 「静态门禁 12/12」文档漂移**（README/SKILL vs 现实 13 步）：README/SKILL 改为去步数口径（「verify.ps1 静态门禁 + 发布候选包装配」），今后加门禁步不再产生数字漂移；HANDOFF-NEXT 门禁行更新为「默认 15 步 / 全开 17 步」并保留历史口径演变。
- **[P0] HANDOFF-NEXT 4 个段落停留旧时点**（§14 技能集合 82/83、runtime 39/399、退役 1 条；§7.1 共享根 176 条/401 文件；§13 检查清单；3 处「39 admitted」）：逐段就地更新为现值（82/82、52/420/422、23 条 retired、112 条/422 文件、52 admitted），历史值以「历史时点」标注保留。
- **[P2] 420 vs 422 双口径无解释**：HANDOFF-NEXT §2 加口径说明（420=catalog bundle 门禁对象；422=部署态 +根入口+manifest）。
- **[P1] event 域在 skills/README.md 与 ARCHITECTURE 分层缺位**：两处补齐（checker/engineering/event/product/ui 五组）。
- **[P2] ARCHITECTURE route-catalog「将成为唯一执行真源」将来时 + 双文件两层未写清；target-truth 契约语义未注明**：两段改写为现行事实。
- **[P1] 三个退役/卸载回滚凭据存放在 gitignore 区**（`_smoke/retire-29/35-rollback.json`、`r0-junction-removal.json`），清理后永久不可回滚：迁入 `evidence/`（20260911-/20260910- 前缀），HANDOFF-NEXT 引用同步更新。
- **[P1] `.workbuddy-ai/` 未入库未 ignore 未交代**：.gitignore 加条目。
- **[P2] `sources/_quarantine/vibe-routing-manifest` 零登记空目录**：删除（无内容、无链路影响）。
- **[P2] README「13 个 Matt 工程原语」措辞不精确**（实为 11 primitive + code-review + handoff）：改「13 个 Matt 条目」；README 唯一 Owner 段补「另有 9 个仲裁/登记类 owner」与 target-truth 契约语义。
- **[P2] HANDOFF.md 3 处历史布局死路径无注记**：顶部加路径迁移注记。
- **[P2] 上批证据更正**：`evidence/20260911-retired-reference-cleanup.md` §4.3 加 2026-09-12 更正块（shape 盲区如实登记）。
- **[P2] 择暂缓**：CAPABILITY-INDEX 裁决表退役标记（A4）；Hook 启用事件 4 处硬编码的派生化改造（当前四处一致，改造风险大于收益，留待契约下次演进）；Windows CI 的引入与否（owner 配额决策，跳过行为已可见）。

## 3. 新鲜验证（全部为本批实测）

```text
pwsh 7.6.3：verify.ps1 -IncludeHostEvidence -IncludePackage = 17/17（默认 15 步 + 宿主证据门 + 包装配）
  新增步：退役引用扫描（retired=23, scanned=343, 0 残留）、collector 路径归属单测（17/17 用例）
  宿主证据门：admitted=52, ageDays=1.06（7 天门内）；包装配 files=858
Windows PowerShell 5.1：verify.ps1 裸调无参数 = 15/15（修复前为第 5 步失败；批次 2 后最终态复测）
反例注入：skills/ 下写入 /codebase-memory-scout 引用 → 退役引用扫描 FAIL（定位到行），移除即 PASS
退役引用扫描（批次 2 收紧 IgnoreCase + 扩展名白名单后）：retired=23, scanned=520, PASS
部署面：install-runtime-projection.ps1 -TargetHost Shared -Force → INSTALLED, fileCount=422, validated=true
  （链路终点：宿主实际加载的 ~/.claude/skills/feisheng-vibe-coding == 仓库 HEAD 内容）
门禁反例（登记不可过期、未登记偏差必失败）由 verify 1c/1c-2 与 catalog 自洽校验既有 fail-closed 保证，
  本批 40 个登记补丁全部被其消费核对。
```

## 4. owner 裁决与已知债处置（2026-09-12 第二轮，全部收口）

1. **归档 zip 下落——已裁决**：owner 确认三个归档 zip 为**主动删除**，不留冷存副本。终态落档：AGENTS.md 迁移规则段改为「快照与 zip 校验通过后，zip 由 owner 于 2026-09-12 裁决删除；已删除的源项目不是工作对象，不得从任何外部副本/缓存/备份解包回去」；SOURCE-INVENTORY 各 archive 块加 `zipDisposition: deleted-by-owner`，auditNotes 改为终态说明（files/bytes 口径差异保留为历史记录，不作对账依据）；HANDOFF-NEXT §13 检查清单对应项作废。仓库内快照 + PROVENANCE-INTEGRITY.json 为唯一可对账终态。
2. **CI 结果留痕**：本批已按 A/B/C/D 分组拆分提交；推送后 release-gate 触发的 run 应补登 evidence（延续 run 9 之后的空档）。
3. **三项已知债——已处置**：
   - CAPABILITY-INDEX 裁决表退役标记：**已修**——build-capability-index.ps1 渲染层为 retired 成员追加「（已退役）」标记并加图例说明，再生生效（rule 文案保留退役前口径，属溯源内容）。
   - Hook 事件面 4 处硬编码：**已修**——install-vibe-hooks.ps1 改为从 contract.json 派生启用事件集（timeout 取契约 timeoutSeconds，matcher 保持宿主侧映射），契约与 runner 支持面漂移时拒绝安装（fail-closed）；测试的禁用事件清单同样改为契约派生。
   - 派生化落地补充：改动过程中另清理了两处硬编码残留（安装清单与 INSTALLED 输出里的 `events` 表、else 分支残留的 `$spec` 引用），并将 `-join`/`-ne` 同表达式比较拆为中间变量（PowerShell 运算符优先级陷阱）；双 shell 安装/卸载/幂等/junction 全部用例实测通过。
   - Windows CI：**决策为不引入**（windows runner 配额，沿用 workflow 头注既有决策）；junction 负面用例保持 Windows 本机运行 + 非 Windows 显式 `[SKIPPED]` 输出，覆盖边界已在 HANDOFF-NEXT 登记。

## 4b. 批次 2（复检 + 红队对抗）与二轮修复

两个只读子 Agent 对修复面做定检与对抗攻击（2026-09-12 同日）：

**定检结论**：核心机制全部字节级属实——46 条 LOCAL-PATCHES 登记逐条 sha256 对账（42 runtime-import + 4 sliver）、
35 个 frontmatter 改写无第 36 处、verify 新步骤的失败路径（collector `exit 1`→显式检查、扫描脚本全路径 fail-closed）、
OWNER-LEDGER 改动不影响唯一消费方（build-canonical-catalog 只读 owners[].id）、catalog 与 59 条 frontmatter 0 mismatch。

**红队击穿点与二轮修复**：
| 发现 | 修复 |
|---|---|
| [P1] 再生投影字节形态随宿主漂移（PS 5.1 写出 BOM+CRLF+4 缩进 vs HEAD pwsh 形态，约 7200 行 diff 噪音；provenance/ 无 .gitattributes 归一） | build-canonical-catalog.ps1 / build-capability-index.ps1 改确定性字节写出（LF、无 BOM、单尾换行）；pwsh 再生恢复 HEAD 形态。缩进风格仍随宿主（pwsh 7 是工作流头注声明的规范化构建运行时，语义门禁对缩进不敏感） |
| [P1] HANDOFF-NEXT 三处「默认 13 步」残留（:19/:114/:519）与 :306/:337/:446 的 `_smoke/retire-*` 失效路径 | 统一改 15 步（全开 17）口径 + 引用改 evidence/ 实际路径；HANDOFF.md:238 r0 凭据引用同步 |
| [P2] 新门禁大小写可绕过（/SHAPE 形态） | 正则加 IgnoreCase（宁误报不漏报） |
| [P2] 扫描扩展名白名单缺 .template/.sh/.yaml/.yml/.py/.mjs/.cjs/.csv | 收口后扫描面 343→520 文件，PASS |
| [P2] 三个 provenance JSON 缺文件尾换行 | 补 LF |
| [P2] VIBE-IMPORT.json 的 snapshotTreeSha256 为导入时点旧基线且无注记 | 加 auditNotes 指向 PROVENANCE-INTEGRITY 权威值 |
| [P2] verify 头注编号与实现段编号漂移、「只读仓库」与 collector 写日志不符 | 头注改无编号步骤清单 + 措辞放宽（日志写 gitignore 区） |
| [P1] 二轮自伤：`$MyInvocation` param 默认值改法少一层 Parent；且实测 PS 5.1 高级脚本（CmdletBinding）param 默认值里 `$PSScriptRoot` 为空、`$MyInvocation.MyCommand.Path` 为 **null**，无跨版本表达式可用 | 三脚本（verify / 退役扫描 / hook 测试）改「param 默认空 + 脚本体解析 `$PSScriptRoot`」的唯一可移植写法；PS 5.1 裸调无参数实测 15/15 |

红队确认的失手面（无需修复）：`sources/` 屏蔽正则不跨行不误吞；treeSha256 改值经 sha256-lines-v1 独立重算精确复现（快照未篡改）；catalog 与 frontmatter 0 mismatch；CAPABILITY-INDEX 中的 vibe-coding-skills 为 retired-alias 描述非命令引用。

**登记为已知债（本轮不修，代价/收益已评估）**：CAPABILITY-INDEX 裁决表退役成员标记（生成器渲染层改造）；Hook 启用事件 4 处硬编码的派生化；Windows CI 与 runner 配额的 owner 决策；PS 5.1 ConvertTo-Json 缩进风格差异（pwsh 为规范化宿主）。

## 5. 边界（未变项）

- 未修改 `sources/**`、`SKILL-INVENTORY.json`、`VIBE-IMPORT.json`（内容真源与来源事实快照保持逐字节忠实）。
- 未解包归档 zip；未改 AGENTS.md 归档规则段（仅步骤 3 措辞精确化）。
- 宿主 trust、逐技能行为质量、Hook fresh-session 冒烟维持 `UNVERIFIED`（本批无宿主行为主张）。
- 修复未提交；工作树变更待 owner 过目后提交（提交后 1d 保真树门禁在 CI 侧以提交内容复验）。
