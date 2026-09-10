# Task 20260910-matt-primitive-inventory

## 状态

dispatched

## 唯一目标

从已接受的 Matt HEAD 快照中建立第一批工程原语接入候选：`tdd`、`diagnosing-bugs`、`codebase-design`、`domain-modeling`、`code-review`。只读分析每个技能的 frontmatter、引用路径、外部写入目标、许可证指针和与统一 owner 的冲突，写入证据，不复制技能正文。

## 不做事项

- 不修改 Matt 源目录或已提交快照。
- 不进入正式 `skills/` runtime。
- 不处理 4 个未提交文件。
- 不修改 route-catalog、target-truth 或 runtime projection。

## 允许写入

- `evidence/20260910-matt-primitive-inventory.md`
- 必要时更新 `provenance/SKILL-DECISIONS.md`，仅增加有证据的候选决策

## 基线

目标仓库 `c5c1e2c92e8adf3ed43a772e6ff99b90e1e229ef`；Matt snapshot revision `9fe7e7a3bb352851b986725bab1c7cfb17610a97`。

## 验收与停止条件

- 每个候选必须绑定 snapshot path、SHA、invocation、dependencies、write targets、license/provenance 和 evidence。
- 发现会写第二份 spec、route、truth 或 hook 的能力时标记 adapter-only 或 blocked。
- 没有 runtime smoke 不得声明接入完成。
