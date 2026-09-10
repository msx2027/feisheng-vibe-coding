# Task 20260910-vibe-hook-adapter-contract

状态：accepted

## 目标

定义统一仓库唯一的 Vibe Hook adapter 合约。它必须在来源 Hook 尚未完成许可证、revision、宿主发现和 fresh-session smoke 前保持禁用，且不得执行或安装来源 Hook。

## 允许写入

- `adapters/vibe-hooks/`
- `scripts/invoke-vibe-hook-adapter.ps1`
- `tests/test-vibe-hook-adapter.ps1`
- `packaging/runtime-projection.json`
- `evidence/20260910-vibe-hook-adapter-contract.md`

## 验收

1. 合约声明单一 runner、五类事件、幂等键、超时、失败策略、写入白名单和回滚条件。
2. `Validate` 成功。
3. `Invoke` 在禁用态拒绝执行，退出码为 `3`。
4. 不复制、安装或执行 `sources/vibe-coding-skills/codex-hooks/` 任何脚本。
