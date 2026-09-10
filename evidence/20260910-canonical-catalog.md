# Canonical 技能目录证据

## 结论

任务 `20260910-canonical-catalog` 为 **accepted**。`scripts/build-canonical-catalog.ps1` 从 `provenance/SKILL-INVENTORY.json` 的三项目事实快照生成 82 条统一记录，且把“来源事实”和“运行时决策”分开：

- Sliver：1 条 `control-plane`。
- Vibe：46 条，分别标记为兼容入口、事件专用、产品/checker、UI 或待审来源。
- Matt：35 条，其中 3 条 `accepted-primitive`、2 条因未提交命名改动 `blocked-unclassified-working-tree`，其余为 adapter、用户工具、来源专用或 in-progress。

主 Agent 重跑生成器后检查：总数 `82`，来源计数 `1/46/35`；accepted 原语路径均指向正式 `skills/engineering/*/SKILL.md`，不存在 `sources/` runtime 路径；blocked 的 `code-review` 和 `tdd` 保持排除。

## 决策边界

唯一技能决策 owner 是 `provenance/CANONICAL-CATALOG.json`；`SKILL-INVENTORY.json` 只记录来源文件事实，`SKILL-DECISIONS.md` 只记录人工语义判断。README、插件清单和宿主 manifest 只能由 canonical catalog 投影。

## 未验证项

- Vibe UI/产品技能仍未经过逐技能 license、write-target 和行为 smoke。
- Matt `tdd`/`code-review` 的 4 个未提交文件尚未得到维护者确认。
- 真实宿主 discovery、Hook trust 和 fresh-session 仍为 `UNVERIFIED`。
