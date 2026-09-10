# Codex 投影 smoke 证据

## 结论

任务 `20260910-codex-projection-smoke` 为 **accepted**，但真实宿主安装和 fresh-session smoke 仍为 `UNVERIFIED`。

使用 `scripts/build-codex-runtime-projection.ps1` 在全新临时目录生成并验证候选包，结果为 6 个运行时文件（含 1 个 manifest）：统一入口 `SKILL.md`、Sliver control-plane 和 3 个已验收 Matt 原语。`code-review`、`tdd` 两个 blocked record 未进入输出，旧 Vibe 路由清单和生成 mirror 也未进入输出。该脚本是唯一 Codex projection writer。

## 重跑命令与结果

```powershell
& 'F:\skiils工具\feisheng-vibe-coding\scripts\build-codex-runtime-projection.ps1' `
  -Mode Build `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' `
  -OutputRoot 'C:\Users\MSX\Documents\Codex\2026-09-10\f-skiils-sliver-vibe-coding\work\codex-runtime-smoke-fresh2'
```

退出码：`0`。

随后使用同一输出目录执行 `-Mode Validate`，退出码同样为 `0`，并重新核对 source revision、catalog SHA、文件集合和逐文件 SHA-256。

```json
{"status":"PASS","fileCounts":{"copied":5,"generated":1,"total":6},"blockedRecordsExcluded":2,"freshSessionSmoke":"UNVERIFIED"}
```

主 Agent 重新检查输出：正式相对路径中没有 `code-review/`、`tdd/`、`skills/ROUTING-MANIFEST.json` 或根 `MANIFEST.json`；`projection-manifest.json` 是本次生成的审计输出，不是旧生成清单。

## 安全修正

脚本具备路径越界检查、source revision/catalog SHA、逐文件 SHA 和 Build/Validate 双模式；输出目录已存在时会停止并要求换新路径，不会自动删除已有候选包。旧的简版 writer 已移除，避免出现两个 runtime owner。

## 未验证项

- 没有写入用户的真实 Codex/Claude 目录。
- 没有证明宿主发现、slash 调用、Hook 顺序或 fresh-session 行为。
- Vibe 产品/UI 技能、Matt `tdd`/`code-review` 和第三方许可证包仍未启用。

## 主 Agent 复验记录

后续将唯一 writer 收敛为 `scripts/build-codex-runtime-projection.ps1`，在新的临时目录执行 Build 与 Validate，两个退出码均为 `0`。输出 6 个文件（5 个批准输入加 1 个生成 manifest），source revision 为 `b369cce125c06b586a6b87bd37c7a87bf83b9214`，catalog SHA-256 为 `72d3b131ba4f7edc717a47fd9ed849c9309d502def01a032d27d6af72a0f5b84`。旧的简版 writer 已删除，避免重复 runtime owner。
