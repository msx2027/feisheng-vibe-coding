# 统一唯一称呼改名：feisheng-vibe-coding → vibe-coding-skills（2026-09-30）

## 决策

owner 2026-09-30 指令：项目统一为唯一称呼 `vibe-coding-skills`——GitHub 仓库、本地文件夹、宿主技能名、文档叙事全部同名；不再有「本仓库 vs 上游包」的双重身份叙事（受管块上的 `vibe-coding-skills:target-runtime` 门牌从「上游署名」变为「自我署名」，正是本次动机）。历史记录（evidence/tasks/docs-archive/legal/provenance 旧条目）按 owner 裁决保持原样，只追加不涂改。

## 改动清单（实测落地）

**代码/守卫硬编码（漏改=守卫静默失效）**：`guard-worktree-path.mjs`（白名单根 `F:\skiils\vibe-coding-skills-worktrees`）及测试、`install-vibe-hooks.ps1`（含自装拒绝哨兵）、`collect-host-skill-evidence.ps1`×3、`verify.ps1`×2（宿主证据前缀 + 文档对账锚点）、`build-release-package.ps1`、`install-runtime-projection.ps1`、`runtime-projection-guard.ps1`、`audit-host-legacy-links.ps1`、`init-doc-governance.mjs`、`release-gate.yml`、本机 `.claude/settings.json` hook 路径。

**身份/叙事**：根 `SKILL.md`（name 字段 = 宿主调用名 → `vibe-coding-skills`、标题）、`README.md`（badge/入口句/目录树/英文段）、35 个技能门控短语（`调用 \`vibe-coding-skills\` 总入口`）、`docs/HANDOFF-NEXT.md`、`skills/README.md`、doc-sync-guardian 两文件、`architecture.mjs`+4 张 SVG 重生成、`flow-and-lifecycle.html`、`packaging/runtime-projection.json`、collector 测试夹具×6。

**「上游」→「源项目」**：活文档全改（HANDOFF-NEXT×6 处、CAPABILITY-INDEX 经重生成、skills/README、doc-sync、生成器注释与报错文案、`SKILL-CLASSIFICATION.json` 9 处后重生成 catalog/index）。provenance 旧记录与 import 脚本按历史保持原样。

**状态目录 `.feisheng/` → `.vibe-coding-skills/`（owner 拍板一并改）**：contract.json 路径×6 + `contractVersion` v7.1→**v8**（lineage 续写）；`experience-recorder.mjs`、`invoke-vibe-hook-adapter.ps1`、`install-vibe-hooks.ps1`、`test-vibe-hook-adapter.ps1`、hotspot-gate、RUNTIME-NOTES。

**线协议常量保留（裁定）**：`eventNamespace: feisheng.vibe`（幂等键材料，改动使存量 `.digested` 标记全部失配）、`feisheng-vibe-hook-adapter/v2`、`feisheng-vibe-hook-install/v1`、`feisheng-local-patches/v1`、`feisheng-runtime-projection/v1` 等数据格式标识——它们是不可见的数据格式常量，非身份叙事。

## 台账手术（LOCAL-PATCHES）

35 个已登记门控短语文件 sha256 重录 + 追加说明；改名后 **23 个 vibe 源文件与快照重新字节一致**（门控短语本来就是快照原文，2026-09-18 批改名造成偏离、本次改回消除偏离），按「无偏离不登记」剪除悬空登记；`document-surfaces.md` 因「上游真源→真源」改写新入登记（快照原文在 `sources/vibe-coding-skills/skills/doc-sync-guardian/references/`）。校验链全绿。

## 过程事故与修复（如实登记）

1. **`sed -i` 行尾篡改**：Git Bash `sed -i` 对 CRLF 技能文件整文件按 LF 重写（13 个文件，含 10 个不含改名串的 engineering 技能）——正是根 AGENTS.md 保真树行尾规则禁止的事故。抢救：Node 字节级重做（HEAD 原字节 + 仅目标串替换）逐文件恢复，最终全仓 diff 形状均为小改。**教训：保真树上的替换一律字节级工具，禁用 `sed -i`。**
2. **台账登记过损伤 sha**：第一轮基于损伤字节登记，第二轮基于 git diff 名单漏掉已恢复文件；第三轮改为「对台账全部 skills 条目验证『HEAD+替换 == 当前字节』后按当前字节登记」，拒绝无法自证的条目（doc-sync 因专属短语规则单独补验）。
3. **安装器两个既有 bug（改名迁移暴露，非改名引入）**：① `@() | Where-Object` 过滤结果单项时退化为标量，`+=`/`+` 抛 op_Addition（fs-agent 2026-09-25 加单条工区守卫组后触发）——三处包 `@()` 修复；② 注册去重标记只认新 runner 绝对路径，v8 改名前的旧注册不被清理成重复 hook——`Test-RunnerMarkedGroup` 增加旧路径兼容标记，`-Uninstall`/`-Force` 即可完成存量升级。

## 存量目标迁移（实测）

- `E:\fs-agent`：`.feisheng/` 整目录改名（台账/凭据/消化标记全保留）→ `.gitignore` 更新 → `-Uninstall`+`install -HostAdapter all -Force` → 三宿主注册零旧引用、hook 套件实测 PASS。
- `F:\skiils\sess-find`：同法，三宿主零旧引用。
- 迁移语义已写入 contract v8 说明：`重跑 install-vibe-hooks.ps1 -Force` 即完成存量升级。

## 验证

- `verify.ps1` **21/21**（含 catalog 82 records 重生成、能力索引重生成、文档数字 66/82/52/452/454 与步数 21 对账门）。
- hook 适配器安全契约套件 PASS；ledger-core / anchor / closure 三套件全绿；doc-governance 18/18；guard-worktree 9/9。
- 本机宿主注册实测：fs-agent、sess-find 三宿主（claude/zcode/codex）注册命令全部指向 `.vibe-coding-skills\vibe-hooks\`。

## 待办（owner 侧收尾清单）

1. GitHub 改名（`gh repo rename`，本次由 AI 执行）与本地 remote 更新——见同日提交。
2. **本地文件夹改名**：`F:\skiils\feisheng-vibe-coding` → `F:\skiils\vibe-coding-skills`（owner 亲自执行；改名前本仓库 hook 路径短暂失联，属预期窗口）。
3. 改名后重建 4 条软链：`~/.agents/skills/`、`~/.claude/skills/`、`~/.codex/skills/`（经 `_adapters/shared/skills/` 中转）——旧名软链在文件夹改名后即失效。
4. ZCode 记忆库目录迁移（按新项目路径键）。
5. 改名后跑一次 `collect-host-skill-evidence.ps1` 重采宿主证据（新前缀 `vibe-coding-skills/skills/...`；`verify.ps1 -IncludeHostEvidence` 未跑前宿主结论保持 UNVERIFIED）。

## 收尾执行记录（2026-09-30，同日追加；待办 2–5 全部落地）

文件夹改名由 owner 完成后，本会话在新路径 `F:\skiils\vibe-coding-skills` 实测执行：

1. **宿主软链重建（待办 3）**。实测布局与清单口径不同：`~/.claude/skills` 与 `~/.agents/skills` 都是**指向 `F:\skiils\_adapters\shared\skills` 的 junction**（同一目录两门牌），`~/.codex/skills` 是实体目录；旧布局物理上只有 2 条链接（共享根内 Junction→仓库根 直连；codex 内 Junction→共享根 中转）。按原格式重建为同名 2 条：`_adapters\shared\skills\vibe-coding-skills`→`F:\skiils\vibe-coding-skills`（Junction）、`~\.codex\skills\vibe-coding-skills`→共享根（Junction）；旧名 2 条死链经 `rmdir` 删除（只删重解析点，遇实体目录会拒绝）。四入口（claude/agents/codex/共享根）穿透验证全部 `name: vibe-coding-skills`，零旧名残留。
2. **记忆库迁移（待办 4）**。旧项目键 `feisheng-vibe-coding-fb3f6fb57fe8caf9` 下 9 个文件已拷贝至新键 `vibe-coding-skills-4e6a244ec35f3734`（拷贝非移动，旧键保留）。
3. **宿主证据重采（待办 5）**。两处小障碍如实登记：①脚本参数默认值 `(Split-Path -Parent $PSScriptRoot)` 在 `powershell -File` 直跑时取空（既有问题，非本次引入），显式传 `-RepositoryRoot` 绕过；②首次运行被 `~/.codex/config.toml` 第 814 行重复键阻断——`[projects."f:\\skiils\\vibe-coding-skills"]` 表头在同日 01:44 被追加第二次（393 行已有一份，内容相同；疑似两个 codex 进程在新路径并发写入撞车，与 hook 安装器无关）。备份至 `%TEMP%\config.toml.bak-20260930` 后以 head 字节级截断删除末尾重复段（吸取本证据 §事故 1 教训，未用 sed -i），codex 恢复可启动。重采结果：**model-visible=55 / installed-user-invoked-only=27 / not-installed=0**，前缀已换新。证据 JSON 内仅存的 1 处 `feisheng` 是 `schema: feisheng-host-discovery-evidence/v1`——线协议常量，属裁定保留范围。
4. **验证**：默认 `verify.ps1` **21/21** 全绿。
5. **新发现（owner 待裁决）：`-IncludeHostEvidence` 宿主证据门首次实测即红，非改名引入，系真实暴露面**。codex **0.154.0** 对技能根做深度递归扫描，把统一包内 `sources/vibe-coding-skills/skills/`、`sources/mattpocock-skills/skills/` 快照与 `sources/_quarantine/vibe-claude-skills-mirror/`（46 个 SKILL.md，2026-09-10 c5c1e2c 入库）里的副本全部列为**模型可调用**技能（同名条目最多 3 份：正式装/快照/隔离镜像；mattpocock 快照带 `mattpocock-skills:` 命名空间前缀，vibe 快照与隔离镜像不带）。门禁咬住 8 个**仅在快照中存在、无正式安装**的名字：beginner-flow-guide、codebase-memory-scout、git-guardrails-claude-code、migrate-to-shoehorn、scaffold-exercises、shape、skill-builder、target-constitution-setup——即模型现在可以直接调用未 admitted 的退役/未评审快照副本。已 admit 的技能名其快照副本因后缀匹配计入正式证据（后缀匹配按 catalog path 判定，物理多副本同名的暴露仍在，门禁口径之外）。对照：上次采集 2026-09-11（旧版 codex）`parsedModelVisibleEntries=194` 但 records 中 `sources/` 出现 0 次——旧行为未暴露这些副本；本次暴露不是采集器逻辑变化（改名提交对采集器仅改字符串常量，`git diff HEAD~1 HEAD` 可证），是 codex 扫描器行为变化 + 19 天未重采。候选处置（owner 裁决，未擅自执行）：a) 查证 codex 0.154 技能扫描排除配置（最干净，待验证是否存在）；b) 调整宿主链接布局使宿主只见 `skills/` 树（涉及 hooks/provenance 同根的设计权衡）；c) 接受为已知影子暴露并修订门禁口径（弱化保证，与操作法相悖）；d) 快照树不可动（保真树），`_quarantine` 非三棵登记保真树、法理上可处置但不解决 8 名字问题。证据现状：本次重采 JSON（含影子条目）已如实写入 `provenance/HOST-DISCOVERY-EVIDENCE.json`（工作树，未提交）。

## 交叉复核与补漏（2026-09-30 同日第三批，owner 指令「2 批 × 4 子代理交叉复核」）

**方法**：批一 4 代理分域扫描（仓内全量 / 本机宿主接线 / 外部仓库与未知依赖方 / 识别调用实测），批二 4 代理对批一发现做对抗式证伪 + 补漏 + 修前核验。全程只读，共 8 代理，修正批一多处结论后由本会话统一施修。

**批二修正批一的关键点（交叉复核价值实证）**：①三个 H1 标题（AGENTS.md/README.md/SKILL.md）批一 A 判漏改、批一 B 判「合法品牌保留」——批二以 evidence 自述改过「标题」+ 白名单判据只豁免不可见数据格式常量为由裁决**应改漏改**，本会话据此施修；②批一「忽略路径零命中」被推翻——`.zcode/config.json` 与 `.tmp/skill-census.tsv` 在忽略区含旧名，磁盘扫描必须含 dot 目录；③codex 可见条目批一记 210/124，实为 **256/139**（正则漏计带冒名的 46 条，其中统一包 15 条），定性结论不变；④`.zcode/config.json` 不止路径旧——`enabled:true` 误放在条目层，ZCode 语义要求在 hooks 根层（以本仓安装器 `Register-ZcodeHost` 实战参照为准），只改路径修不出能响的守卫。

**本会话施修清单（全部两批核实零门禁风险）**：
1. `.zcode/config.json`（gitignored 本机接线）：runner 路径改指 `F:\skiils\vibe-coding-skills\scripts\guard-worktree-path.mjs` + hooks 根层补 `"enabled": true`——修复改名后 ZCode 侧工区守卫静默失效（node 找不到模块 exit 1 不阻断，守卫能力为零）。JSON 已验合法；**hook 不热加载，新会话生效**，实弹验证法见 `evidence/20260925-gate-hardening.md`（发 `git worktree add E:/x` 应被拦）。
2. 三个 H1 标题：`AGENTS.md:1`、`README.md:3`、根 `SKILL.md:6` → `# vibe-coding-skills`（AGENTS.md 带「仓库规则」后缀）。同时更正本证据文件 §改动清单 的不准确自述：改名提交对根 SKILL.md **只改了 name 字段、未改标题**，标题系本批补改。
3. `scripts/build-release-package.ps1:161` NOTICE 头 → `'vibe-coding-skills release package NOTICE'`（生成物不入库，无门禁断言）。
4. 三个临时目录前缀：`verify.ps1:70` → `vibe-verify-`、`install-runtime-projection.ps1:143` → `vibe-install-`、`tests/test-vibe-hook-adapter.ps1:35` → `vibe-hook-test-`（均唯一出现点、零断言）。
5. `docs/target-truth-schema.json:4` title → `"vibe-coding-skills target project truth"`（JSON Schema 注解字段，全仓零消费方；`$id` 与 `const` 两个线协议标识按裁定**未动**）。
6. **用户全局路由块 7 份镜像一次改齐**（真源 `C:\Users\MSX\AGENTS.md` L42/46/49 + `~\.claude\CLAUDE.md`、`~\.codex\AGENTS.md`、`~\.gemini\GEMINI.md`、`~\.config\opencode\AGENTS.md`、`~\.kiro\steering\skills-routing.md`、`~\.cursor\rules\skills-routing.mdc`——最后一份含 frontmatter description 共 4 处）：现役路由引用 `feisheng-vibe-coding` → `vibe-coding-skills` 共 22 处；历史叙述句（「取代 2026-09-08 的 vibe-coding-skills × mattpocock-skills 双入口规则」「旧的 vibe-coding-skills 总入口已退役」）按史实**未动**。验证：七文件 feisheng 残留 0，官方漂移检查 `C:\Users\MSX\bin\check-agent-rule-mirrors.ps1` **6 镜像 PASS、exit 0**。此块此前每个会话都在教模型走旧入口名（codex prompt 注入实证），系「识别调用」层面的真实偏差，非路径断链。

**施修后验证**：`verify.ps1` **21/21** 全绿；hook 契约套件 PASS exit 0；漂移检查 exit 0；`.zcode/config.json` JSON 合法。

**遗留 owner 裁决清单（本轮新增，均未擅自处置）**：
- `E:\fs-agent\.feisheng\` 整树仅剩 2 枚旧收工凭据（写入源为零已证，fs-agent 记忆已登记待处置）——owner 可删；
- `E:\fs-agent\docs\项目治理\归位规范.md:11,12,38,85` 与 `AGENTS.md:129`/`CLAUDE.md:131` 旧口径——fs-agent 受管文档，走其治理流程；
- `E:\fs-agent-worktrees\080-pi-agent-core` 分支（b7a10ed1）整分支为改名前内容——合流时以主仓为准；
- `~\.codex\config.toml:597,660` 两条死项目信任条目（g:\feisheng 无关条目 + 旧仓路径）与 `~\.claude\projects\` 8 个旧名会话目录——无行为面，可清理；
- `scripts/invoke-vibe-hook-adapter.ps1:466` 横幅硬编码 v4 措辞（autonomous）与 contract.status（hard-gate）不一致——纯文案、无行为影响，非改名引入；
- `node scripts/check-doc-governance.mjs` 直跑 exit 1（docs/archive 三处 E3/E6）——**2026-09-12 d238931 预存**，不在 verify 21 步内（verify 跑的是其契约测试 18/18），非本批回归；
- 上一节第 5 条的宿主证据门（codex 0.154 快照暴露）裁决仍待 owner。
