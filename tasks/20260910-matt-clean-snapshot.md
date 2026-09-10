# Task 20260910-matt-clean-snapshot

## 状态

accepted

## 验收备注

已生成 Matt HEAD `9fe7e7a3bb352851b986725bab1c7cfb17610a97` 的 132 文件只读快照；4 个未提交文件未进入快照。源文件与快照逐文件 SHA-256 一致。运行时接入仍阻塞。

## 唯一目标

从 Matt 的已提交 HEAD 创建只读来源快照，排除证据中确认的 4 个未提交文件，并写出可重建的 provenance；不把快照直接启用为运行时。

## 不做事项

- 不修改 Matt 源目录。
- 不复制或猜测 4 个未提交文件的意图。
- 不启用 Matt runtime、插件或 issue tracker adapter。

## 允许写入

- `sources/mattpocock-skills/`
- `provenance/MATT-IMPORT.json`
- `scripts/import-matt-source.ps1`
- `evidence/20260910-matt-clean-snapshot.md`

## 基线

Matt HEAD `9fe7e7a3bb352851b986725bab1c7cfb17610a97`；目标仓库基线 `c5c1e2c92e8adf3ed43a772e6ff99b90e1e229ef`。

## 验收与停止条件

- provenance 必须记录 source revision、工作树状态、排除的 4 个路径和快照文件数。
- 重新计算快照与 `git show <HEAD>:<path>` 的 SHA 时，所有已提交纳入文件必须一致。
- 任一来源文件无法绑定到 HEAD，停止并标记 `rework-required`。
