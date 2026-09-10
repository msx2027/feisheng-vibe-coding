# Codex 投影 smoke 证据

## 结论

任务 `20260910-codex-projection-smoke` 为 **accepted**，但真实宿主安装和 fresh-session smoke 仍为 `UNVERIFIED`。

使用 `scripts/build-codex-projection.ps1` 在全新临时目录生成候选包，结果为 12 个文件：统一入口 `SKILL.md` 加上 3 个已验收 Matt 原语及其附属 references/agent 配置。`code-review`、`tdd` 两个 blocked record 未进入输出，旧 Vibe 路由清单和生成 manifest 也未进入输出。

## 重跑命令与结果

```powershell
& 'F:\skiils工具\feisheng-vibe-coding\scripts\build-codex-projection.ps1' `
  -RepoRoot 'F:\skiils工具\feisheng-vibe-coding' `
  -OutputRoot 'C:\Users\MSX\Documents\Codex\2026-09-10\f-skiils-sliver-vibe-coding\work\codex-projection-smoke3'
```

退出码：`0`。

```json
{"files":12,"records":4,"blockedRecordsExcluded":2,"freshSessionSmoke":"UNVERIFIED"}
```

主 Agent 重新检查输出：正式相对路径中没有 `code-review/`、`tdd/`、`skills/ROUTING-MANIFEST.json` 或根 `MANIFEST.json`；`projection-manifest.json` 是本次生成的审计输出，不是旧生成清单。

## 安全修正

脚本发现输出目录已存在时现在会停止并要求换新路径，不再自动删除已有目录；这样投影生成失败不会破坏旧候选包。

## 未验证项

- 没有写入用户的真实 Codex/Claude 目录。
- 没有证明宿主发现、slash 调用、Hook 顺序或 fresh-session 行为。
- Vibe 产品/UI 技能、Matt `tdd`/`code-review` 和第三方许可证包仍未启用。
