# Task 20260910-vibe-foundation-audit

状态：accepted（主 Agent 已复验）

## 目标

只读审计 Vibe 来源的 `architecture-foundation`、`target-constitution-setup`、`target-runtime-setup`、`doc-sync-guardian`，判断其 provenance、许可证、调用类型、写入目标、依赖和与 Sliver 唯一控制面的兼容性；给出每项应保持 source-only、转为 adapter-candidate 或接入 accepted-primitive 的结论。

## 不做事项

- 不修改三个源项目。
- 不直接把任何技能写入 Codex/Claude runtime projection。
- 不改变 Sliver route catalog、canonical catalog 的既有 owner 规则。

## 输入基线

- 目标仓库：`F:/skiils工具/feisheng-vibe-coding`
- 基线提交：`ae6908a94da55b8a7a0dcb2043d2160a423cdfc1`
- 来源：`F:/skiils工具/vibe-coding-skills`

## 允许读取

- 四个来源技能目录及其直接引用的 references/tools/manifest。
- 目标仓库 `provenance/`、`governance/`、`runtime/`、`tasks/`、`evidence/`。

## 允许写入

- `tasks/20260910-vibe-foundation-audit.md`（仅必要时补充审计说明）。
- `evidence/20260910-vibe-foundation-audit.md`。
- 如需更新 canonical catalog，必须先在证据中说明字段、理由和精确 diff；不得改写来源快照。

## 必须回执

记录实际读取/修改文件、命令与退出码、四项逐项结论、许可证与写入目标证据、未验证项/阻塞项和下一步建议。主 Agent 将重新执行关键验证命令后决定是否接受。

## 验收命令

主 Agent 重新运行：

```powershell
git -C F:\\skiils工具\\feisheng-vibe-coding status --short
Get-Content -Raw -Encoding UTF8 F:\\skiils工具\\feisheng-vibe-coding\\evidence\\20260910-vibe-foundation-audit.md
```

若发现来源 revision 漂移、写入越权、第二控制面或许可证无法证明，任务必须标记 `rework-required`，不得宣称 accepted。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验：四个 catalog `sourceSha256` 与目标快照实际 SHA-256 一致；四项均保持 `source-only-product-or-checker`、`user-invoked`、`writeAuthority: []`。
- 复验：Codex projection Build/Validate 均为 `PASS`，未引入这四项 Vibe 技能或第二入口。
- 决定：本批次 accepted；四项仅登记为后续 `adapter-candidate`，许可证、宿主 adapter 和行为 smoke 完成前不得进入 runtime。
