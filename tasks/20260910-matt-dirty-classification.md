# Task 20260910-matt-dirty-classification

## 状态

accepted

## 验收备注

证据已回写至 `evidence/20260910-matt-dirty-classification.md`。任务本身通过；四个源文件仍因 provenance 不足保持 `unclassified`，Matt 内容迁移门禁继续阻塞。

## 唯一目标

只读检查 `F:/skiils工具/mattpocock-skills` 的当前 Git 状态，记录 4 个未提交文件的 diff、SHA、文件用途和迁移风险，并把证据写入 `evidence/20260910-matt-dirty-classification.md`；不得修改源目录或目标仓库技能内容。

## 不做事项

- 不提交、清理、回滚或重置 Matt 源目录。
- 不把这 4 个文件迁移到统一仓库。
- 不推断作者意图；只能基于 diff、路径、历史和内容给出 `formal-local-change`、`temporary-change` 或 `unclassified` 分类。

## 允许读取

- `F:/skiils工具/mattpocock-skills`
- 目标仓库 `provenance/` 与 `tasks/`

## 允许写入

- `F:/skiils工具/feisheng-vibe-coding/evidence/20260910-matt-dirty-classification.md`

## 基线

目标仓库当前 `699d53db84275a42ae8a2676b0dfe899e3f996ed`；Matt 源目录以 worker 启动时 `git status --short` 为准。

## 验收与停止条件

- 证据必须包含实际命令、退出码、路径、HEAD、diff stat、每个文件的分类及置信度。
- 任何无法证明来源/意图的文件必须标记 `unclassified`，并建议停止迁移，而不是自行丢弃。
