# Vibe Hook 审计证据

## 状态

`review-unavailable`：已派发低成本 Luna，但因服务过载未返回证据；以下为主 Agent 的只读本地审计，不能视为独立交叉审查通过，也不能据此启用 Hook。

## 已核查事实

- `sources/vibe-coding-skills/codex-hooks.json` 声明 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`Stop` 五类事件。
- `codex-hooks/run-hook.ps1` 维护固定 allowlist，仅分发 8 个 Hook 名称；未知名称和缺失实现退出码为 `2`，具备 fail-closed 基础。
- `codex-hooks/INDEX.md` 与 `hooks/INDEX.md` 将脚本分为状态标记、文档索引同步、提交前 gate、Stop gate、反馈检测和路由 session gate；同时存在 Claude、Codex 两套目录及兼容入口。
- Hook 主要写入目标为目标项目的 `.claude/` 状态 marker、`.vibe-docs.json` 对应文档索引和 `.codex/hooks` runner；这些不是统一仓库的 canonical route、target-truth 或 runtime projection owner。
- Stop / commit gate 依赖 Git diff、状态快照和文档覆盖检查；Hook 文本强调 staged snapshot、幂等 marker 失效和当前变更重算，但本地未执行宿主事件回放，无法证明真实优先级、并发和重复触发行为。

## 安全结论

1. 当前不能把 Vibe Hook 直接纳入 runtime projection：`LICENSE-MAP.json` 仍将 Vibe 标记为 `mixed; per bundled skill`、`runtimeEligible: false`。
2. 不能同时安装 Claude/Codex/源目录镜像三套 Hook；需要一个未来的宿主 adapter 作为唯一安装入口，其他目录只能作为 provenance 快照。
3. 事件命名空间和顺序只能作为来源声明：真实宿主的 matcher、超时、并发、失败传播和 session id 绑定尚未验证。
4. 最小可接受方向是后续建立 `vibe-hook-adapter`：显式 allowlist、单一 runner、事件去重键、超时/失败策略、写入目标白名单和回滚清单；在 fresh-session smoke 与许可证逐项核验通过前维持 source-only。

## 未验证项

- 未验证 Codex/Claude 宿主是否发现 `codex-hooks.json` 或 `.claude` 配置。
- 未验证五类事件的实际触发顺序、重复调用、并发写入和超时行为。
- 未验证 Hook 在目标项目之外运行时的路径边界和权限失败表现。
- 未验证第三方脚本许可证与 NOTICE 的逐文件映射。

## 主 Agent 复核命令

以下只读检查均退出码 `0`：

```powershell
Get-Content -Raw -Encoding UTF8 F:\\skiils工具\\feisheng-vibe-coding\\sources\\vibe-coding-skills\\codex-hooks.json
Get-Content -Raw -Encoding UTF8 F:\\skiils工具\\feisheng-vibe-coding\\sources\\vibe-coding-skills\\codex-hooks\\run-hook.ps1
Get-Content -Raw -Encoding UTF8 F:\\skiils工具\\feisheng-vibe-coding\\sources\\vibe-coding-skills\\codex-hooks\\INDEX.md
Get-Content -Raw -Encoding UTF8 F:\\skiils工具\\feisheng-vibe-coding\\provenance\\LICENSE-MAP.json
```

本任务状态保持 `review-unavailable`，不得标记 accepted；下一步应在服务可用时重派独立审计，或由主 Agent 先设计 adapter 合约而不启用来源 Hook。
