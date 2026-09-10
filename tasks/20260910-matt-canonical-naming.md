# Task 20260910-matt-canonical-naming

状态：accepted（主 Agent 本地复验）

## 唯一目标

解除 Matt 四项因「上游未提交改名」而 blocked 的状态：
canonical 命名由本仓库决定；内容改取**已提交 revision** 的 blob（不采用意图不可证的工作树改动），
并修掉由此暴露的「4 条记录指向不存在文件」数据缺陷。

## 不做事项

- 不修改三个源项目（对来源只读）。
- 不采用上游未提交的工作树内容。
- 不等待上游确认即可确定我方的 canonical id。
- 不声称宿主行为已验证。

## 允许写入

- `scripts/import-matt-source.ps1`（改取已提交 blob + 记录）
- `scripts/provenance-integrity.ps1`（`Export-GitBlobToFile`、`Sort-StringsOrdinal`、revision 来源校验）
- `scripts/record-provenance-integrity.ps1`（`revisionSourcedPaths`）
- `scripts/build-skill-inventory.ps1`（revision 来源路径改从快照读取）
- `scripts/runtime-projection-guard.ps1`（删除硬编码 blocked 名单）
- `scripts/build-capability-index.ps1`（空集合处理）
- `sources/mattpocock-skills/**`（新增 4 个已提交内容的 SKILL.md）
- `provenance/MATT-IMPORT.json`、`provenance/SKILL-INVENTORY.json`、`provenance/SKILL-CLASSIFICATION.json`、
  `provenance/CANONICAL-CATALOG.json`、`provenance/PROVENANCE-INTEGRITY.json`、`docs/CAPABILITY-INDEX.md`
- `evidence/20260910-matt-canonical-naming.md`、本任务包、`docs/HANDOFF.md`

## 验收与停止条件

- 快照新增恰好 4 个文件（132 → 136），无丢失。
- 4 个文件 frontmatter 为**已提交**名，换行与快照约定一致（CRLF），且内容 == 已提交 blob（LF 归一化后）。
- `catalog` 无 blocked 记录；82 条记录路径全部可寻址、`sourceSha256` 全部一致。
- provenance 校验对 revision 来源文件按记录 sha256 比对，不误报工作树差异。
- 篡改任一 revision 来源文件必须被校验器发现。
- `verify.ps1` 在 pwsh 7 与 Windows PowerShell 5.1 下全绿。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验 1：临时目标先导入对比 → 仅新增 4 个文件、无丢失；4 个文件与已提交 blob（LF 归一化）逐字节一致（4/4）；frontmatter 为已提交名。
- 复验 2：正式重新导入 → 快照 136 文件；git status 仅显示 4 个新增 + MATT-IMPORT 变更。
- 复验 3：重生成 inventory → 仅 5 处预期字段变化（4 个 sha256 + `code-review` name 回到 `code-review`）；catalog 82 条 0 缺失 0 不符。
- 复验 4：反例（篡改 `tdd/SKILL.md`）→ 校验器报 `content-vs-recorded-revision`；同机制还原后 sha256 回到记录值。
- 复验 5：`verify.ps1` pwsh 7 = 8/8、Windows PowerShell 5.1 = 7/7。
- 决定：本任务 accepted。上游改名中间状态仅作事实记录与周期复核，不再是任何技能的 blocked 理由。
