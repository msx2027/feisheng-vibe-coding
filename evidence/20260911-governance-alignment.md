# 证据：治理对齐批（governance-alignment batch）

- 日期：2026-09-11
- 任务包：`tasks/20260911-governance-alignment-batch.md`
- 触发：owner 批准「五个按优先级修复 + 修复后多批子 Agent 交叉复核」。修复清单来自
  2026-09-11 的两批共 6 个只读子 Agent 全链路交叉复核（Owner 唯一性 / 迁移管道 / 文档一致性 /
  运行时闭环 + 红队对抗复核 + 四链生命周期走查）。

## 1. 修复内容与验证

### F1 口径对齐

- `AGENTS.md`：决策唯一写入点由 `CANONICAL-CATALOG.json`（生成物）改为 `SKILL-CLASSIFICATION.json`
  （分类唯一真源），catalog 明确为「只能再生」。依据：git 时间线（`b369cce` 加规则早于 `fd15146`
  引入分类文件）证明是规则滞后于架构演进，执行链自始以 classification 为真源。
- `README.md` / `SKILL.md`：阶段描述从「阶段 2 / 迁移前取证」刷新为闭环后受控运行
  （39 runtime / 399 文件 / D2-D3 实测 / Hook 采集面启用 + UNVERIFIED 边界照抄）。
- `scripts/verify.ps1` 头注释、`scripts/build-capability-index.ps1` 模板、`packaging/runtime-projection.json`
  hook 段：状态措辞精确化；`freshSessionSmoke` 维持 `UNVERIFIED`（仓库内外无留痕物，按 AGENTS.md 验收规则保守）。
- `docs/HANDOFF-NEXT.md`：清理 6 处内部矛盾（96 vs 401 文件、7.3 过期警告已被 T7 重采作废、
  §8 D2 未达成已转绿、9.5 旧数字被闭环批作废、步数 12/13 混用、13 节错误起点）+ 批次表补 11/12 批
  + 踩坑清单补 #31/#32。`docs/MIGRATION-PLAN.md` 头部加进度回填指引。

### F2 T6 正名 + 消化状态机

- 契约 `adapters/vibe-hooks/contract.json`：新增 `enablementScope`（采集面限定，明确三件套未接入、
  不得声称完整沉淀闭环）与 `digestion` 段；status id 保留（历史证据引用）。
- runner `scripts/invoke-vibe-hook-adapter.ps1` 新增 `-Mode Digest`：
  - 只认严格 40 位小写十六进制 dedupKey（索引行是不可信数据，防路径注入），在白名单状态目录写
    `<dedupKey>.digested`；
  - SessionStart 只统计未消化条数（ASCII 前缀 `PENDING=`/`TOTAL=`），全部消化后静默 exit 0。
- 测试 `tests/test-vibe-hook-adapter.ps1` 新增 4f 段：Digest 计数（marked/already/unmarkable）、
  待消化数递减、幂等、恶意 dedupKey 不逃逸。pwsh 实测 PASS。
- 实施中修的两个自查问题：Digest 首版按行计数（重复 key 重复计）改为按唯一 key；
  提醒断言受 GBK/UTF-8 管道解码影响 → 机器判定字段改 ASCII 前缀（踩坑 #25 的应用）。

### F3 纸面门变脚本门

- collector `scripts/collect-host-skill-evidence.ps1`：
  - `installedInSharedBundle` 判定从「目录名扫 skills/<group>/」改为「catalog path 精确落位」，
    控制面（嵌套 `governance/sliver-core/`）不再被记 not-installed，`vibe-code-review`
    不再冒充 Matt 版 code-review；
  - 模型可见归属改为 catalog path 后缀匹配（快照路径带剥 `sources/<repo>/` 变体），
    新增 `visibleVia`（unified-bundle / legacy）、`sharedRootEntryKind/Target`；
  - **真实踩坑（已进踩坑清单 #31）**：`[string](...EndsWith(...))` 把布尔结果转成 `"False"`
    字符串 → 恒真 → 首跑 82 条记录全部误匹配 231 条目；改为先赋布尔变量再判定后重采正常。
- verify `scripts/verify.ps1` 新增可选步 `-IncludeHostEvidence`（默认不跑，CI 不受影响）：
  证据新鲜度（`-HostEvidenceMaxAgeDays`，默认 7 天）+ admitted 记录必须非 not-installed
  （把 `runtimePromotionPolicy.host-discovery-evidenced` 纸面门变成机器门）+
  非 admitted 技能从统一包内可见的影子入口检测。
- 重采 `provenance/HOST-DISCOVERY-EVIDENCE.json`（capturedAt 2026-09-10T22:12Z）：
  model-visible=39（= 全部 admitted，且全部 `visibleVia=unified-bundle`）、installed-user-invoked-only=25
  （顶层遗留链接暴露）、not-installed=8（与 T6 时代「应缺席」清单吻合）、other=10（disable-model-invocation 类）。

### F4 退役状态化

- `SKILL-CLASSIFICATION.json`：新增 `alias|retired → retired-alias` 策略行 + reasonsByStatus 文案。
- 新工具 `scripts/retire-capability.ps1`：fail-closed（id 不存在 / 缺 `<domain>|retired` 策略行 /
  记录形状不匹配即拒）；文本手术编辑（不整文件重排）；退役后自动重生成 catalog/index + 路由绑定校验；
  支持 `-DryRun`。
- 试点（走工具全链路）：`vibe-coding-skills` 别名 → `RETIRED`（compatibility → retired-alias），
  数据层状态补齐到与批次 10 的宿主侧事实一致；catalog 记录带退役原因与 `retiredAt`。
- `build-capability-index.ps1` 新增「已退役」展示段与统计位（能进也能出，且退出可见）。
- 新工具 `scripts/audit-host-legacy-links.ps1`（只读）：共享根清点 = **64 个源仓库链接**
  （阶段 5 退役候选，口径待 owner）+ 83 个与本项目无关链接（不动）+ 28 个普通目录 + 1 个统一包；
  快照存 `_smoke/host-legacy-links-20260911.json`。

### F5 CI/remote 准备

- `gh` CLI 已认证（账号 msx2027，repo + workflow scope）。远端创建/推送是外发动作，
  命令已写入 HANDOFF-NEXT §9.8，由 owner 决定仓库名与可见性后执行；
  CI（`.github/workflows/release-gate.yml`）跑 verify 不带 `-IncludeHostEvidence`（CI 无宿主环境）。

## 2. 门禁结果

```
pwsh scripts/verify.ps1 -IncludeHostEvidence -IncludePackage
[PASS] catalog 同步 / runtime include 399 / 导入副本 312 / 保真树 1585 / 索引新鲜度
[PASS] 来源快照 553+136+220 / 路由绑定 admitted=38 bound=38 / NOTICE runtime items=40
[PASS] Vibe Hook 适配器安全契约（含 Digest 用例）
[PASS] 宿主证据门 — admitted=39 ageDays=0.34
[PASS] Codex / Claude / 宿主中性投影 Build + Validate
[PASS] 发布候选包装配 — files = 815
verify: 14/14 steps passed
```

## 3. 边界（本批明确不做）

- 不删除 64 个源仓库链接（阶段 5，owner 口径）；不动 83 个无关链接。
- 不把沉淀三件套接入 runtime（需独立迁移批次：许可证族决策 + statusPolicy 决策 + 绑定变更）。
- 不改写 `evidence/` 历史记录（T6 证据原文保留，口径修正只在活文档）。
- 不改 OWNER-LEDGER 拓扑（"Sliver" 未登记、裁决 owner 无落点、owner 文件不在完整性基线内 → 已列入 9.8 遗留）。

## 4. UNVERIFIED 边界（照抄 AGENTS.md 验收规则）

宿主 trust、逐技能行为质量（用一次验一次）、Hook 宿主 fresh-session 冒烟（无仓库内留痕物）、
沉淀消费技能接入、发布 CI 实跑（无远端）——全部维持 `UNVERIFIED`，本批不改变这些边界。

## 5. 复扫轮（4 子 Agent）与增量修复（提交 c93cb7d）

修复后按 owner 要求执行多批交叉复核。第一批 4 个只读子 Agent 按原四维度复扫
（Owner/写入权限、新增脚本红队深审、文档一致性、运行时闭环），结论：**五项修复全部成立**——
AGENTS.md 新规与执行链四处互证一致；沉淀链「采集→提醒→消化标记→提醒递减」四跳闭合且消费跳
在三份活文档与契约中一致地保持敞口；数字六处对账（82/39/399/176/401/64/12步/14步）；
collector 两个伪影确认修复且不再复发。红队独立实证：retire 工具 fail-closed 属实（含 -DryRun 也拒）、
幂等成立、正则锚定无前缀误配、Digest 注入防线成立、测试全绿。

复扫发现的增量项及处置（提交 `c93cb7d`，门禁复跑 14/14 + fresh clone 14/14）：

| 级别 | 发现 | 处置 |
|---|---|---|
| P2 | retire 工具不转义控制字符 → 可写出 pwsh 宽容但严格解析器拒收的 JSON，仓库工具链全盲 | `ConvertTo-JsonStringScalar` 对 <0x20 字符直接 throw（fail-closed）；在临时 clone（加 checker\|retired 策略行）实测 `[char]10` reason 被拒：`TOOL-REJECTED: reason 含控制字符（0x0A）` |
| P2 | collector path 后缀归属缺全局唯一性守护（构造性歧义埋雷） | verify 步骤 1b 新增 O(n²) 检查：任何记录 path 是另一记录 path 的后缀即 FAIL |
| 活矛盾 | `contract.json` enablePrerequisites 仍有一条 `host-discovery-and-fresh-session-smoke: PASS`，与全仓 UNVERIFIED 口径相抵 | 拆为 `host-discovery-evidenced: PASS` + `hook-fresh-session-smoke: UNVERIFIED`（并注明 D2/D3 入口探测不可引作 hook 冒烟）；幂等键补 40-hex 截断说明 |
| 活矛盾 | `ARCHITECTURE.md:15` 仍称 catalog 是"唯一技能决策真源" | 改为与 AGENTS.md 一致（classification 唯一写入点、catalog 只能再生） |
| 滞后 | HANDOFF-NEXT §9.7 旧数字 60/14/8、§9.4/§9.7 "~66"未随新口径回收 | 划线标注被 39/25/8/10 与 64 取代 |
| P3 | runner `-match` 忽略大小写，契约却声明 lowercase hex | 改 `-cmatch`；测试复跑 PASS |
| P3 | verify 5b 非 admitted 缺证据记录时空引用报错信息差 | 空值守卫 |
| P3 | tests/verify 注释残留"经验沉淀启用"旧措辞 | 改采集面口径 |
| 记账 | SOURCE-INVENTORY 停格迁移前、OWNER-LEDGER skill-catalog 条目 path/writes 指向生成物、collector 无单元测试、verify 5b 不比对 readiness 内容漂移 | 全部写入 HANDOFF-NEXT §9.8 遗留清单，留待下批 |

复扫确认的「有意遗留」（非本批失败，均有留痕）：13 owner vs README 4 owner 表述、7 个裁决 owner 无落点、
PROVENANCE-INTEGRITY 不锁 owner 文件、LOCAL-PATCHES owner 字段悬空、根 SKILL.md 委托链措辞、
retiredAt 为 UTC 日期（2026-09-10）与本地批次日期差一天。

## 6. D1：退役 29 个双重曝光链接（owner 同日拍板）+ 35 技能原因分组

owner 对终态审计拍板：终态 = 只保留 feisheng-vibe-coding 一个文件夹；29 个「已接入但旧链接还在」的
双重曝光链接全部退役；vibe-coding-skills 为 owner 本人开发（已记入 LICENSE-MAP reason）；matt 的
4 个脏文件为 owner 本人胡乱改的，不保留；AGENTS.md 规则文本可在源项目实际删除时改写。

**执行记录**：
- 29 个链接经 python `os.rmdir` 退役（安全断言：必须为指向三源的 reparse 链接且名字在批准清单内）；共享根 176 → **147**
- 回滚记录：`_smoke/retire-29-rollback.json`（29 条 name → linkType → target，逐条可 `mklink /j` 重建）
- 重采 `HOST-DISCOVERY-EVIDENCE.json`：**39 条 admitted 仍全部 model-visible 且经统一包**（零能力丢失）；
  门禁 `verify.ps1 -IncludeHostEvidence -IncludePackage` = **14/14**
- 退役后共享根构成：unified-bundle 1 + source-repo-link 35 + other-link 83 + directory 28 = 147

**吸收完整性（防删源丢技能的审计结论）**：
1. 内容层：三源完整快照在仓库内（vibe 553 + matt 136 + sliver-core 220 文件，逐文件 sha 闭包，
   verify 步骤 3 含来源逐字节交叉校验，本日 PASS = 源目录与快照无漂移）——删源项目本体**不丢任何字节**；
2. 未来接入层：`import-vibe-skills.ps1:144` 与 `import-matt-source.ps1:26` 的复制源都是**仓库内快照**，
   不读源项目本体——删源不堵后续任何接入；
3. 运行时层：39 admitted 全部经统一包可达（宿主证据门强制）。

**35 个未接入技能的原因分组**（阶段 2「接入或退役」的决策清单）：

| 数量 | 原因（catalog reason 原文） | 技能 |
|---|---|---|
| 10 | 来源专用工程原语；未验收 | git-guardrails-claude-code, grilling, migrate-to-shoehorn, prototype, research, resolving-merge-conflicts, scaffold-exercises, setup-pre-commit, wizard, writing-for-agents |
| 7 | 已审查、待适配器与行为 smoke | implement, improve-codebase-architecture, setup-matt-pocock-skills, to-spec, to-tickets, triage, wayfinder |
| 6 | 用户显式工具；未做宿主行为 smoke | grill-me, grill-with-docs, handoff, teach, to-questionnaire, wait-what |
| 5 | 产品/checker 来源专用；审计与许可证映射已完成，待宿主行为 smoke | codebase-memory-scout, design-maker, skill-builder, target-constitution-setup, target-runtime-setup |
| 3 | 尚未完成语义审查 | beginner-flow-guide, clarify, shape |
| 3 | 仅限结构化事件调用；需宿主事件契约与独立审查 | evolution-engine, experience-elevator, feedback-writer |
| 1 | 专项 checker；Sliver 拥有验收门，未进入 runtime | vibe-code-review |

另：6 个 excluded（上游 in-progress）+ 1 个 retired-alias（vibe-coding-skills）本就不在迁移面内。
