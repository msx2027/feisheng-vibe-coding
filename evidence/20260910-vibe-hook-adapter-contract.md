# Vibe Hook adapter 合约证据

## 结论

任务 `20260910-vibe-hook-adapter-contract` 为 **accepted**。本仓库现在有一个可校验、默认禁用的唯一 Vibe Hook adapter 合约；它没有复制、安装或执行来源 `sources/vibe-coding-skills/codex-hooks/` 的脚本，也没有进入 Codex 候选运行时投影。

这不是 Hook 已启用或宿主已验证的结论。合约状态仍为 `defined-disabled-pending-gates`，真实宿主发现、事件顺序、并发、写入授权与 fresh-session smoke 仍为 `UNVERIFIED`。

## 合约边界

- 唯一 runner：`scripts/invoke-vibe-hook-adapter.ps1`。
- 事件范围：`SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`Stop`，每项都声明 timeout 与 handler 标识。
- 幂等：必须按 `sha256(eventNamespace,eventName,hostSessionId,hostEventId,toolUseId)` 形成键；状态存储和保留期只作为未来启用的合约声明。
- 禁用态：`writeWhitelist` 必须为空；来源执行和来源 runner 执行都必须为 `false`；Invoke 必须拒绝并返回退出码 `3`。
- 回滚：任一 prerequisite、manifest、写入边界或 smoke 失败时，只移除生成的宿主 overlay，保留来源快照与证据。

## 实际命令与结果

```powershell
& 'F:\skiils工具\feisheng-vibe-coding\tests\test-vibe-hook-adapter.ps1' `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'
```

退出码：`0`。输出先报告 `PASS: Vibe Hook adapter contract is valid and remains disabled.`，随后 Invoke 对 `Stop` 事件报告 `BLOCKED`，测试确认内部拒绝退出码为 `3`，最后报告 `PASS: disabled Vibe Hook adapter validates and refuses source execution.`。

随后使用全新临时目录执行投影 Build 与 Validate：

```powershell
& 'F:\skiils工具\feisheng-vibe-coding\scripts\build-codex-runtime-projection.ps1' `
  -Mode Build `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' `
  -OutputRoot 'C:\Users\MSX\Documents\Codex\2026-09-10\f-skiils-sliver-vibe-coding\work\codex-projection-hook-contract-cd0170dd58814bb181c59c4533f69457'

& 'F:\skiils工具\feisheng-vibe-coding\scripts\build-codex-runtime-projection.ps1' `
  -Mode Validate `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' `
  -OutputRoot 'C:\Users\MSX\Documents\Codex\2026-09-10\f-skiils-sliver-vibe-coding\work\codex-projection-hook-contract-cd0170dd58814bb181c59c4533f69457'
```

两次退出码均为 `0`，结果均为 `PASS`。投影源 revision 为 `cf3216825f28aebb0183337508f2cf614c8d7910`，catalog SHA-256 为 `8ecfd22d7ce46f079acb95fd5c6d9e1e674c9bcab25c45e22ed36e649c680e75`；输出仍是 5 个批准输入加 1 个 manifest。Hook contract 仅在 `packaging/runtime-projection.json` 作为禁用态 metadata 引用，未被复制到输出；`tdd`、`code-review`、`sources`、`hooks` 与 `codex-hooks` 仍被排除。

## 未验证项

- 没有写入真实 Codex 或 Claude 宿主目录。
- 没有执行来源 Vibe Hook、来源 dispatcher 或来源状态写入。
- 没有证明真实宿主发现、事件顺序、并发、失败回传或 fresh-session 行为。
- `LICENSE-MAP.json` 对 Vibe 仍为 `mixed; per bundled skill` 且 `runtimeEligible: false`，因此不能把该合约改为启用态。
- 独立 Luna Hook 审计因服务端流中断没有完成回执；本证据是主 Agent 验收记录，不能替代独立逻辑审查。
