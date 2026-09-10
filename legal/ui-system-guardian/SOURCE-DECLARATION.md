# ui-system-guardian 来源声明

审计日期：2026-09-10
审计人：主 Agent（G1 目标）
关联证据：`evidence/20260910-vibe-product-audit-local.md`、`evidence/20260910-vibe-ui-audit-local.md`
状态：source-only（本声明仅解除来源缺口，不构成 adapter-candidate 提升）

## 缺口背景

`provenance/CANONICAL-CATALOG.json` 中 `ui-system-guardian` 为
`source-only-product-or-checker`。本地审计发现其目录
`sources/vibe-coding-skills/skills/ui-system-guardian/`（SKILL.md + references/
audit-rules.md + references/workflow.md）内无 LICENSE/NOTICE，且
`docs/legal/BUNDLED-DESIGN-SKILLS-SOURCES.md` 的 bundled 清单（ui-ux-pro-max 侧
4 项、impeccable 侧 18 项）均未覆盖它。需先补充来源声明，再决定 adapter-candidate。

## 来源判定（本地只读核查）

| 项目 | 结论 | 证据 |
|---|---|---|
| 上游发布 | `F:\skiils工具\vibe-coding-skills`（vibe coding skills 分发包） | `MANIFEST.json`：`name: "vibe coding skills"`、`sourceCommit: 635c54f9abb091c1293de346407663ad6af0862b`、`sourceBranch: master` |
| 分发包性质 | `0.0.0-private`、`private: true`（非公开 npm 包） | 上游 `package.json` |
| 是否为 bundled 第三方 | 否 | `docs/legal/BUNDLED-DESIGN-SKILLS-SOURCES.md` 未列出 ui-system-guardian；`rg ui-system-guardian` 仅命中 vibe 自研路由/README/AGENTS 文件 |
| 许可证 | 随分发包根 README「许可证与来源」声明：仅两大来源族——ui-ux-pro-max 侧 MIT、impeccable 侧 Apache-2.0；ui-system-guardian 属于 vibe 自研 UI 系统治理能力，不归属于任一 bundled 来源，其许可证随分发包整体声明 | 上游 README「许可证与来源」节 |
| 依赖 | 依赖 `.vibe-docs.json`、目标项目设计令牌/组件盘点文档、`tools/check-ui-reuse.mjs`（全部为本分发包内能力）；无外部安装 | SKILL.md frontmatter / DocMap |

## 结论与建议

1. ui-system-guardian 为 vibe 自研技能（product/checker 类），非第三方 bundled 内容；
   其来源 = 上游分发包（sourceCommit `635c54f9abb091c1293de346407663ad6af0862b`）。
2. 因上游分发包对自研技能未逐项声明许可证文本，本仓库记录为
   `license: "vibe-distribution; see upstream package.json (private) + README license section"`，
   `runtimeEligible: false`。在获得上游逐技能许可证声明或独立审查前，保持
   `source-only-product-or-checker`，不转 adapter-candidate。
3. 快照 `sources/vibe-coding-skills/` 未做任何手工修改（550/550 SHA 闭包保持）。

## 未验证项

- 上游分发包是否有更细粒度（逐技能）许可证声明未在本轮核查到（README 只声明两大
  来源族）；如后续取得上游逐技能声明，可升级本条目。
- 独立 Luna 交叉审查仍不可用。
