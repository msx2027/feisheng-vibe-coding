# 发布 NOTICE 门禁 smoke 证据

## 结论

任务 `20260910-release-notice-gate` 为 **accepted**（主 Agent 本地复验）。新增 `scripts/validate-release-notices.ps1` 作为发布 NOTICE 静态门禁：只读取 `provenance/LICENSE-MAP.json` 与 `provenance/CANONICAL-CATALOG.json`，校验每个 runtime include 文件都能按来源映射到具体许可证/NOTICE，并拒绝三类违规（根许可证覆盖混合内容、无 NOTICE 的 runtime inclusion、无 provenance 的手工许可证复制）。

正例（当前仓库）：退出码 0、`status: PASS`，报告 5 个 runtime 项（project-entry + Sliver control-plane + 3 个 Matt accepted primitives），每项都映射到具体 license 与 notice：

| id | source | license | notice |
|---|---|---|---|
| project-entry | repo-owned-entry | repo-owned; see governance/sliver-core/LICENSE (Apache-2.0) | governance/sliver-core/LICENSE |
| sliver-vibe-coding | sliver-vibe-coding | Apache-2.0 | governance/sliver-core/LICENSE |
| domain-modeling | mattpocock-skills | MIT plus localized/source notices | sources/mattpocock-skills/LICENSE; LICENSE.zh-CN.md |
| codebase-design | mattpocock-skills | MIT plus localized/source notices | 同上 |
| diagnosing-bugs | mattpocock-skills | MIT plus localized/source notices | 同上 |

负例（构造 LICENSE-MAP 将 Vibe `runtimeEligible` 从 false 翻转为 true）：脚本拒绝并退出非 0，报错 `LICENSE-MAP 的 Vibe 条目必须保持 runtimeEligible=false 直到逐技能许可证完整`。证明 mixed-license 越权进入 runtime 的防护真实生效。

## 重跑命令

```powershell
& 'F:\skiils工具\feisheng-vibe-coding\scripts\validate-release-notices.ps1' `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'
```

正例退出码 `0`；负例（`-LicenseMapOverride <临时副本>`）退出码 `2`。

## 边界

- 本门禁是静态 NOTICE 校验，不是发布授权；`note` 字段明确 `NOT a release authorization and does not prove host installation`。
- 未修改 `provenance/LICENSE-MAP.json`（负例使用仓库外临时副本）；未手工创建或复制许可证文件。
- Vibe 仍保持 `runtimeEligible=false`；Matt accepted primitives 的 notice 指向来源 LICENSE 与 LICENSE.zh-CN.md。
- 未启用真实宿主安装；fresh-session smoke 保持 UNVERIFIED。

## 未验证项

- 真实发布包（zip/tarball/NOTICE 文件）尚未构建；本门禁只验证 catalog include 层面的许可证映射。
- 尚未把门禁接入 CI / 发布流水线；当前为手动 smoke。
- 独立 Luna 交叉审查仍因宿主 503 不可用；本证据为逻辑审查 / review-unavailable。
