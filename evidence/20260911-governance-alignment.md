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
