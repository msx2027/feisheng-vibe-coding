# hotspot-governor 结构阈值工具同步登记（2026-09-17）

## 事件

owner 指令：以历史项目 deyy 的结构阈值为准，把 `check-hotspots` 工具家族落进本仓库
`skills/product/hotspot-governor/` 的 bundle，作为**后续新项目的默认结构限制标准**；
再由同一份制品同步到目标项目 fs-agent。

此前状态：hotspot-governor 已定编 accepted 并物理导入（SKILL.md 单文件），但其依赖的
`tools/check-hotspots.mjs` 从未随包——目标项目 AGENTS.md 里的「结构阈值真源」承诺没有
对应实物，行数限制从未真正强制过（fs-agent 即为此状态的实例）。

## 来源与授权

- 工具实现取自 deyy 仓库 `tools/`（该实现文件头自识 `vibe-coding-skills:managed-hotspot-tool`，
  即同一工具在 deyy 演进后的版本）。相对 `sources/vibe-coding-skills` 快照版的差异：
  模块化拆分、Rust 函数扫描、**测试函数 250 行阈值**（owner 2026-07-31 拍板）等；
  阈值口径以 owner 本日选定的 deyy 表为准（生产文件 300/800/1500、组件 180、
  函数 100/测试 250、目录 80/150、暂存 8 文件/3 scope）。
- 授权：owner 2026-09-17 会话指令（显性）+ deyy 阈值表选区（显性）。
- 未改动 `sources/` 快照；未改动 SKILL.md（既有 entry-gate-description-retarget 补丁状态不变）。

## 变更物

- 新增 `skills/product/hotspot-governor/tools/`（11 个 .mjs，与 deyy 逐字节一致：
  check-hotspots / hotspot-scan / hotspot-policy / hotspot-git / hotspot-files /
  hotspot-findings / hotspot-function-scan / hotspot-function-shared /
  hotspot-rust-function-scan / trusted-git / safe-target-fs）。
  这些文件在快照 skills/hotspot-governor/ 下无对应物，属**新增**而非副本偏差，
  故不经 LOCAL-PATCHES 登记；来源与授权以本文件 + 提交说明为凭证。
- 再生：`provenance/CANONICAL-CATALOG.json`（82 records，bundle 逐文件 sha256
  已含 11 个新文件）、`docs/CAPABILITY-INDEX.md`。

## 新鲜验证

- deyy 测试套件（12 个 .test.mjs + helpers）对 bundle 副本运行：
  **104/106 pass**；2 个失败均为 deyy 仓库作用域断言
  （「仓库应存在多处 parseArgs 定义」等豁免名单核对，对 11 模块子集不成立），
  非模块缺陷。
- `scripts/verify.ps1`：**15/15 steps passed**（bundle files = 431，
  含导入副本一致性 318 files / 40 登记补丁；三份投影 Build + Validate 全过）。
- bundle 自扫描：`node tools/check-hotspots.mjs <bundle tools 目录>` →
  11 files, blockers=0（1 条 warn 为 deyy 原生状态的重复 helper 候选）。
