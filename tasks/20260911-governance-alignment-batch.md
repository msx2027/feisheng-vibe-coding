# 任务包：治理对齐批次（governance-alignment batch）

- 日期：2026-09-11
- 发起：owner 批准（「同意。把这五个按照优先级修复，修复完成继续执行多批多子 Agent 交叉复核扫描」）
- 背景：两批共 6 个只读子 Agent 对仓库做了全链路交叉复核，确认「准入→投影→路由」静态闭环成立
  （82 登记 / 39 runtime / 399 文件精确对账，门禁本机全绿），同时发现 5 个需要修复的结构性问题。
- 验收：每项修复后 `verify.ps1` 全绿；批次末尾 fresh clone 复验 + 新一批子 Agent 交叉复核。

## Goal（目标声明）

把「闭环」声明的口径收敛到可验证的事实：静态准入/路由闭环继续全绿；
经验沉淀链路的声明收缩为「纠错信号采集已启用 + 消化状态机」；
宿主证据从纸面门变成机器门；退役获得数据状态与工具；
CI/remote 的接入路径写清（远端创建本身需 owner 提供仓库地址）。

## 工作项（按优先级）

### F1 口径对齐（最高优先级）
- AGENTS.md 第 7 行：决策唯一写入点从 `CANONICAL-CATALOG.json`（生成物）改为
  `SKILL-CLASSIFICATION.json`（分类唯一真源），catalog 明确为「只能再生的投影」。
  依据：git 时间线证明这是规则滞后（`b369cce` 早于 `fd15146`），执行链自 `fd15146` 起一直以 classification 为真源。
- README「当前状态」、SKILL.md「当前阶段」：从「阶段 2 / 3 Matt + 4 Vibe 检查器 / 迁移前取证」
  刷新到「39 条 runtime / 399 文件 / D2-D3 已实测 / Hook 采集面已启用」。
- `scripts/verify.ps1` 头注释「Hook 保持禁用」→ v2 启用语义。
- `docs/CAPABILITY-INDEX.md` 生成器模板「discovery / trust / fresh-session smoke 仍为 UNVERIFIED」
  → 精确化（discovery 已重采；trust 与 Hook fresh-session smoke 仍 UNVERIFIED）。
- `docs/HANDOFF-NEXT.md` 内部矛盾清理：96 vs 401 文件、§7.3 过期警告已被 T7 重采作废、
  §8「D2 未达成」已被 D2 转绿作废、§9.5 数字被闭环批作废、步数 12/13、§13 起点/顺序、批次表补 11 批。
- `packaging/runtime-projection.json` hook 段：补「capture-scope」限定；`freshSessionSmoke: UNVERIFIED` 保持
  （仓库内无留痕物，安装器拒绝装进本仓库属设计使然；按 AGENTS.md 验收规则维持保守口径）。

### F2 T6 正名 + 消化状态机
- 契约（`adapters/vibe-hooks/contract.json`）：status id 保留（历史证据引用它），
  增加 `enablementScope` 与 `digestion` 段：采集面已启用，沉淀三件套（experience-elevator /
  evolution-engine / feedback-writer）未接入，不得声称完整沉淀闭环。
- runner（`scripts/invoke-vibe-hook-adapter.ps1`）新增 `-Mode Digest`：
  读取索引中的 40 位十六进制 dedupKey（严格格式校验，防路径注入），在白名单状态目录写
  `<dedupKey>.digested` 标记；SessionStart 只统计未消化条数，全部消化后静默。
  闭环状态：采集 → 提醒 → 消化标记 → 提醒数递减（消费技能接入仍是后续批次）。
- 测试（`tests/test-vibe-hook-adapter.ps1`）补 Digest 用例 + 恶意 dedupKey 负面用例。

### F3 纸面门变脚本门
- `scripts/collect-host-skill-evidence.ps1`：
  1) 控制面 bundle 检测补 `governance/sliver-core`（修复「已装被记 not-installed」伪影）；
  2) 可见性/安装判定从「目录名扫描」改为「catalog path 精确匹配」（修复 vibe-code-review 重名伪影）；
  3) 每条记录增加 `visibleVia`（unified-bundle / legacy）与共享根条目类型，区分统一包暴露与遗留链接暴露。
- `scripts/verify.ps1` 新增可选步 `-IncludeHostEvidence`（默认不跑，CI 不受影响）：
  宿主证据新鲜度 + admitted 记录必须非 not-installed（把 runtimePromotionPolicy 的
  `host-discovery-evidenced` 纸面门变成机器门）+ 统一包内影子入口检测。

### F4 退役状态化
- `SKILL-CLASSIFICATION.json`：新增 `alias|retired → retired-alias` 策略行 + reasonsByStatus 条目。
- `scripts/retire-capability.ps1`：单技能退役工具（fail-closed：缺策略行即拒绝；附 -DryRun；
  退役后自动重生成 catalog/index 并跑路由绑定校验）。
- 试点：把 `vibe-coding-skills` 别名记录退役（宿主链接已于批次 10 删除，数据层状态补齐到与事实一致）。
- `build-capability-index.ps1` 增加「已退役」展示段（能进也能出，且退出可见）。
- `scripts/audit-host-legacy-links.ps1`（只读）：枚举共享根中指向源仓库的遗留链接，输出清单快照
  （约 66 条的退役口径是 owner 决定项，本批次只清点不删除）。

### F5 CI/remote 准备
- 检查 `gh` CLI 可用性与认证状态；把「挂远端 + 让 release-gate CI 真正运行」的确切命令
  写进 HANDOFF-NEXT（远端仓库地址需 owner 提供，本批次不创建远端、不外发任何内容）。

## 明确不做（本批次边界）

- 不删除共享根 ~66 个遗留链接（阶段 5，owner 口径）。
- 不把沉淀三件套接入 runtime（它们在 classification 里被三重门挡住；接入是一个完整的迁移批次，
  需要独立的许可证族决策 + statusPolicy 决策 + 绑定变更，不在本批口径内）。
- 不改写 evidence/ 历史记录（历史证据保持原样；口径修正只发生在活文档）。
- 不改 OWNER-LEDGER 的 owner 拓扑（"Sliver 未登记"、"裁决 owner 无落点" 等结构性议题留档为遗留项）。

## 验收门

1. 每个 feat 提交点上门禁全绿（verify.ps1，含新增可选步的自测）。
2. 批次末：`verify.ps1 -IncludePackage -IncludeHostEvidence` 全绿 + fresh clone（本地 `git clone`）复验。
3. 宿主证据重采一次（collector 修复后的新鲜快照）。
4. 新一批多子 Agent 交叉复核：四个维度复扫 + 红队对新增代码（Digest 模式、retire 工具、新 verify 步）。
