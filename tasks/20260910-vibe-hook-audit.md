# Task 20260910-vibe-hook-audit

状态：dispatched

## 目标

只读审计 Vibe 来源中的 Hook / dispatcher / 事件相关实现，明确事件命名空间、优先级、幂等、失败策略、写入目标、是否生成镜像，以及与 Sliver 唯一控制面和 runtime projection 的兼容边界。

## 不做事项

- 不修改三个源项目及目标仓库的 runtime projection。
- 不把任何 Hook 直接标为 accepted 或写入宿主目录。
- 不替换 Sliver 的 route/truth/runtime owner。

## 输入基线

- 目标仓库：`F:/skiils工具/feisheng-vibe-coding`
- 基线提交：`624bf694174017c386f74a757e70271e0dafc8bd`
- 来源快照：`F:/skiils工具/feisheng-vibe-coding/sources/vibe-coding-skills`

## 允许读取和写入

允许读取来源 Hook/dispatcher 及直接引用文件、目标仓库 `provenance/`、`governance/`、`runtime/`、`tasks/`、`evidence/`；仅允许写入本任务证据 `evidence/20260910-vibe-hook-audit.md`，必要时补充本任务说明。不得改 canonical catalog，除非证据先证明字段变更并由主 Agent验收。

## 必须回执

记录实际文件、命令与退出码、事件/优先级/幂等/失败策略表、许可证与 provenance、运行时资格结论、未验证项和下一步。

## 验收

主 Agent 将复查证据、确认无越权写入，再重新运行关键命令；若存在动态行为无法证明、第二 Hook owner 或失败策略不确定，必须 `rework-required`。
