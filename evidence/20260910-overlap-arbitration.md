# 功能重叠裁决补全（11 簇机读化）

日期：2026-09-10
目标：把 `provenance/SKILL-DECISIONS.md` 中已有人工语义判断的 11 个功能簇，变成**可机读**的裁决，写进唯一真源 `provenance/SKILL-CLASSIFICATION.json` 的 `duplicateGroups`；并让「owner 必须已登记」成为 fail-closed 门禁。
关联任务包：tasks/20260910-overlap-arbitration.md（accepted）
关联交接：docs/HANDOFF-NEXT.md 第 1 节（本轮第一优先）

## 结论

`duplicateGroups` 由 3 组扩充为 **11 组**，覆盖交接文档点名的 **全部 11 簇 / 50 个技能**；新增 **7 个域 owner** 并登记入 `provenance/OWNER-LEDGER.json`；生成器增加 **owner + 成员 fail-closed 校验**（并有反例实测）。
`readiness` / `status` **零改动**；`pwsh scripts/verify.ps1 -IncludePackage` = **8/8 PASS**。

## 一、11 簇 → 组映射（覆盖证明）

| 交接簇 | 组 id | owner | 成员 |
|---|---|---|---|
| review/审查 | `review-and-test` | `validation-gate` | code-review、vibe-code-review、audit、critique、harden |
| test/测试 | `review-and-test` | `validation-gate` | tdd、test-automation、requirements-test-designer |
| bug/排障 | `bug-rescue` | `bug-rescue` | bug-fixer、diagnosing-bugs |
| plan/spec/计划 | `truth-and-planning` | `target-truth` | product-spec-builder、dev-planner、to-spec、to-tickets、wayfinder（design-brief-builder 归 ui-quality） |
| design/UI设计 | `ui-quality` | `ui-quality` | design-maker、design-brief-builder、ui-ux-pro-max、impeccable、design-system、layout、polish、prototype |
| memory/上下文 | `context-and-handoff` | `context-handoff` | codebase-memory-scout、handoff、claude-handoff |
| writing/文档 | `doc-authoring` | `doc-authoring` | writing-for-agents、writing-shape、writing-beats、writing-fragments、doc-sync-guardian |
| skill治理 | `skill-governance` | `skill-catalog` | skill-builder、rule-harvester、wizard、target-constitution-setup、target-runtime-setup、setup-ts-deep-modules |
| 澄清/提问 | `clarification-and-grilling` | `target-truth` | clarify、grilling、grill-me、grill-with-docs、to-questionnaire、wait-what |
| 架构 | `architecture` | `architecture` | architecture-foundation、improve-codebase-architecture、codebase-design、domain-modeling |
| git/冲突 | `git-and-release` | `git-release` | resolving-merge-conflicts、git-guardrails-claude-code、release-builder |

说明（设计原则，未走偏）：

- **不删技能、不降级**：全部成员仍保留原 `domain`/`readiness`；本轮只加归属与「何时用谁」。
- **review 与 test 合并**进既有 `review-and-test`（语义相近可合并，保留既有组 id 与引用），rule 内区分 review 子角色与 test 子角色。
- 每组的 `rule` 都写清「何时用谁」，例如 bug 簇：「Vibe bug-fixer 管分级修复流程，Matt diagnosing-bugs 管诊断反馈回路纪律」。

## 二、owner 归一化（消除既有的悬空 owner）

既有 3 组里有 2 个 owner **不在** OWNER-LEDGER 中；本轮按「owner 必须是 ledger 登记的 owner id」归一化：

| 组 | 旧 owner | 新 owner | 依据 |
|---|---|---|---|
| `project-entry` | `sliver-vibe-coding` | `route-catalog` | 项目入口=路由权威；`route-catalog` 是 routes-index owner |
| `review-and-test` | `sliver-validation-gate` | `validation-gate` | 验收门权威；`validation-gate` 是既有控制面 token |
| `truth-and-planning` | `target-truth` | `target-truth`（不变） | 已在 ledger |

`runtime-projection-guard.ps1` 只读 `project-entry` 的 `aliases`、`validate-release-notices.ps1` 只按 id 硬编码 `project-entry`，均不读 group owner；改动不影响任何投影/发布门禁（8/8 复核证明）。

## 三、新增登记的 owner（domain arbiter）

`provenance/OWNER-LEDGER.json` 新增 7 个 owner（`id` / `writes` / `rule`；域裁决 owner 不声称单文件写入权，故不给 `path`，避免与既有文件 owner 冲突）：

```text
validation-gate, bug-rescue, ui-quality, context-handoff, doc-authoring, architecture, git-release
```

## 四、fail-closed 校验（新门禁）

`scripts/build-canonical-catalog.ps1` 在生成前校验：

1. 每个 group 的 `owner` **必须**在 `provenance/OWNER-LEDGER.json` 的 `owners[].id` 中；
2. 每个 group 的成员（`members` 或 `aliases`）**必须**是本文件 `skills` 中的 canonical id；
3. `group.id` 唯一且每组至少有一个成员。

反例实测（对 `provenance/` 的临时副本执行，未触碰仓库）：

```text
owner='no-such-owner'          -> 抛出：duplicateGroups[project-entry] 的 owner 'no-such-owner' 未在 OWNER-LEDGER.json 中登记。 exit=1, 不产出 catalog
member='no-such-member'        -> 抛出：duplicateGroups[review-and-test] 的成员 'no-such-member' 不在 SKILL-CLASSIFICATION.skills 中。 exit=1, 不产出 catalog
```

## 五、复验

```text
[PASS] catalog 与 SKILL-CLASSIFICATION.json 同步
[PASS] 能力索引新鲜度
[PASS] 来源快照完整性 — vibe-coding-skills=553, mattpocock-skills=136, sliver-core=220
[PASS] 发布 NOTICE 门禁 — runtime items = 5
[PASS] Vibe Hook 适配器保持禁用
[PASS] Codex 静态投影 Build + Validate
[PASS] Claude 静态投影 Build + Validate
[PASS] 发布候选包装配 — files = 22
verify: 8/8 steps passed
all gates passed
```

覆盖检查（脚本复算）：

```text
cluster_distinct=50 covered_by_groups=True missing=[]
member_in_multiple_groups=[]
members_not_in_classification=[]
group_count=11
```

「未改 readiness/status」证明：`git diff -U0 provenance/CANONICAL-CATALOG.json` 的改动段只有
第 3 行（`generatedAt`）与第 1090 行之后（`duplicateGroups` 区）；`records` 与 `decisionPolicy` 无任何改动行。

## 六、能力索引

`scripts/build-capability-index.ps1` 新增「功能重叠裁决（duplicateGroups）」表（组 / owner / 成员 / 分工规则），
从 catalog 读取，仍是生成物；新鲜度由 `verify.ps1` 校验。

## 已知限制 / 未做（不要越界声明）

- **路由绑定仍为 0 条**：Sliver 的 22 条主路由尚不引用这 82 个技能（更深的缺口，未开工）。
- **交付 runtime 仍 4/82**：本轮不提升任何技能，`accepted` 仍只有 Sliver + 3 个 Matt 原语。
- **宿主 trust / 技能真实行为 / Hook 强制** 仍 `UNVERIFIED`。
- `SKILL-DECISIONS.md` 仍是人工语义底稿（未改造为生成物）；机读真源现在是 `SKILL-CLASSIFICATION.json`。
