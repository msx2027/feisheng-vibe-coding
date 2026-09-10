# Task 20260910-matt-blocked-followup

状态：accepted

## 目标

只读复核 Matt 源仓库中 `tdd`、`code-review` 以及其直接调用方 `ask-matt`、`implement` 的当前 HEAD、工作树变更、命名一致性和可追溯来源，决定是否仍为 `blocked-unclassified-working-tree`，或是否有充分证据转为可审计的 adapter-candidate。

## 不做事项

- 不修改 Matt 源仓库。
- 不复制或接入 `tdd`、`code-review`、`implement`。
- 不修改 canonical catalog，除非先在证据中给出精确字段 diff，并由主 Agent复验。

## 输入基线

- 目标仓库：`F:/skiils工具/feisheng-vibe-coding`
- 基线提交：`cf3216825f28aebb0183337508f2cf614c8d7910`
- Matt 源：`F:/skiils工具/mattpocock-skills`
- 已知源 HEAD：`9fe7e7a3bb352851b986725bab1c7cfb17610a97`

## 允许读取和写入

允许读取 Matt 源仓库 Git 元数据、四个直接相关技能、README/manifest/docs 交叉引用，以及目标仓库 provenance/tasks/evidence；仅写入 `evidence/20260910-matt-blocked-followup.md`。

## 必须回执

记录 HEAD、分支、dirty 文件、提交/PR/变更说明证据、旧新命名交叉引用、四项逐项结论、许可证/调用类型风险、未验证项和下一步。任何来源不确定性都必须保留 blocked。

## 验收

主 Agent 将复跑关键 Git 和 SHA 命令；没有已提交 revision、维护者确认或完整 manifest 一致性时，不得解锁。
