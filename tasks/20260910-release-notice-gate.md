# Task 20260910-release-notice-gate

状态：accepted（主 Agent 已复验）

## 唯一目标

实现并 smoke 一个发布 NOTICE 门禁脚本 `scripts/validate-release-notices.ps1`：

- 只读取 `provenance/LICENSE-MAP.json` 与 `provenance/CANONICAL-CATALOG.json` 作为输入真源；
- 校验每个进入 runtime projection 的文件都能按来源映射到具体许可证/NOTICE（Sliver -> Apache-2.0；Matt accepted primitives -> MIT + notices；Vibe -> mixed per-skill，runtimeEligible=false 时不得进入）；
- 拒绝「单一根许可证覆盖混合内容」「runtime inclusion without notice」「手工复制许可证文件无 provenance」三类违规；
- 输出 NOTICE 汇总（每个 runtime 文件 -> 许可证/notice 路径），并在仓库外临时目录跑一次 smoke 写入证据。

## 不做事项

- 不修改三个源项目。
- 不把 Vibe mixed-license 内容并入根许可证或根 NOTICE。
- 不手工创建或复制许可证文件（只生成校验报告）。
- 不启用真实宿主安装。

## 允许写入

- `scripts/validate-release-notices.ps1`
- `evidence/20260910-release-notice-gate.md`
- `tasks/20260910-release-notice-gate.md`

## 验收与停止条件

- 脚本在仓库根运行退出码 0，输出报告包含每个 runtime include 文件的许可证映射。
- 对「Vibe runtimeEligible=false 却尝试 include」的负例，脚本必须报错退出非 0。
- 输出不得声称已生成正式根 NOTICE 或已发布；fresh-session/宿主验证保持 UNVERIFIED。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验：`scripts/validate-release-notices.ps1` 正例退出码 0、`status: PASS`，5 个 runtime 项全部映射到具体 license/notice。
- 复验：构造负例（Vibe `runtimeEligible` 翻转为 true）脚本退出码 2 并报错，证明 mixed-license 防护生效。
- 决定：本任务 accepted；门禁为静态 NOTICE 校验，不是发布授权；真实发布包、CI 接入与宿主 fresh-session 验证留待后续。
