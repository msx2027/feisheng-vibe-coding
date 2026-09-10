# runtime 单位升级为「目录忠实」（accepted）

日期：2026-09-10
关联任务包：tasks/20260910-directory-faithful-runtime-unit.md（accepted）
前置：evidence/20260910-vibe-checker-promotion.md（物理导入）、evidence/20260910-line-ending-reproducibility.md（换行可复现）

## 一、结论

把 runtime 单位从「每条记录一个已批准文件」升级为「**目录忠实的显式白名单**」：

- 一等导入的技能目录（`skills/<group>/<id>/SKILL.md` 形式）现在把**整个目录**中策略许可的文件
  带进投影 —— 包括被正文引用的 `reference/`、`templates/`、`scripts/` 与同级格式文件。
- 控制面（`governance/sliver-core/SKILL.md`）**保持单文件**：那棵树的其余部分不是技能内容
  （含 hooks / packaging / tests），整体投影会违反既有禁止段约束。
- 文件清单在**生成 catalog 时枚举并逐文件记录 sha256**，所以它仍然是显式白名单，
  而不是「目录里有什么就发什么」。新增文件必须先重新生成 catalog 并提交。

效果：runtime include 文件数 **8 → 16**；Codex 投影 **13 → 20** 文件；发布包 **32 → 48** 文件；
`verify.ps1 -IncludePackage` **11/11 PASS**（`pwsh` 与 PS 5.1 均通过）。

## 二、为什么做

之前的投影是「一条记录一个文件」，于是被接受的技能在 bundle 里只有 `SKILL.md`：

- `critique` 的正文反复要求参考 `reference/personas.md` / `reference/heuristics-scoring.md` /
  `reference/cognitive-load.md`，但这三个文件不在 bundle 里；
- Matt 原语的 `codebase-design/SKILL.md` 指向 `DEEPENING.md`、`DESIGN-IT-TWICE.md`；
  `domain-modeling/SKILL.md` 指向 `CONTEXT-FORMAT.md`、`ADR-FORMAT.md`；
  `diagnosing-bugs/SKILL.md` 指向 `scripts/hitl-loop.template.sh`。全部缺失。

也就是说「已接入」在功能上是不完整的：宿主拿到一个引用不存在文件的 SKILL.md。

手工核对全部引用关系后确定的应进文件（实测 5 处引用，见第三节反例 A 覆盖的路径）：
`codebase-design` 3 个、`diagnosing-bugs` 2 个、`domain-modeling` 3 个、`critique` 4 个，
其余 4 条记录各 1 个（`audit`、`harden`、`optimize`、控制面）→ **合计 16**。

## 三、设计

**单一真源**：策略写在 `SKILL-CLASSIFICATION.json` 的 `runtimePromotionPolicy.bundlePolicy`
（数据），`build-canonical-catalog.ps1` 是唯一实现，产物写进 `CANONICAL-CATALOG.json` 的
`bundlePolicy` + 每条记录的 `bundle`，消费者（投影门禁 / verify / 发布包 / 能力索引）读**生成物**。

`bundlePolicy` 关键字段：

| 字段 | 作用 |
|---|---|
| `directoryScopePattern` | `^skills/[^/]+/(?<id>[^/]+)/SKILL\.md$` —— 命中即目录单位；目录名必须等于 canonical id（否则生成器 throw） |
| `directoryExcludedSegments` | `agents`、`.git` —— 宿主编排/版本控制资产，不是技能运行时内容 |
| `forbiddenSegments` | 投影禁止段（含 `project-entry` 别名）—— 生成期就校验白名单文件不得命中 |

记录形状（只出现在 `acceptedStatuses` 记录上）：

```json
"bundle": {
  "scope": "directory",
  "root": "skills/checker/critique",
  "excluded": [],
  "files": [ { "path": "skills/checker/critique/SKILL.md", "sha256": "…" }, … ]
}
```

生成期 fail-closed 校验（任一条失败即 `throw`，不产出 catalog）：

1. 记录指向的文件必须存在；
2. 目录单位时目录名必须等于 canonical id；
3. 目录内文件不得命中 `forbiddenSegments`；
4. 目录内必须包含记录自身的文件，且其 sha256 必须等于登记的 `sourceSha256`（交叉校验）；
5. 白名单不得为空。

**为什么排除 `agents/`**：`skills/engineering/*/agents/openai.yaml` 是宿主编排与插件资产
（内容形如 `interface: display_name / short_description`），**没有被任何技能正文引用**；
把它放进 bundle 有让宿主把它当额外 agent 定义加载的风险，且与单文件时代的投影行为不一致。
被排除的路径逐个记录在 `bundle.excluded` 里，所以这个判断是**可审查的**，不是隐式丢弃。

## 四、顺带收敛掉的重复

实施时发现禁止段列表在**三个地方**各写了一份（两个投影 builder + 发布包），
且发布包那份还含一个恒不匹配的 `'-hooks/'` 项。现在：

- 定义只有一处（classification 的 `bundlePolicy.forbiddenSegments`）；
- `guard.Get-ProjectionPlan` 从 `catalog.bundlePolicy` 读并合并入口别名，返回给两个 builder；
- 发布包的 `forbiddenSegmentViolations` 同样从 catalog 读。

`packaging/runtime-projection.json` 原先**手工复制**了每个宿主的 runtime 文件清单（会漂移的第三份清单），
现在改为描述性 `include`（入口 + host facts + 「runtime 记录由 catalog 的 bundle.files 决定」）。

## 五、反例实测（都按预期拒绝，已回退）

| 反例 | 实测 |
|---|---|
| A. 改动 `skills/checker/critique/reference/personas.md` | `verify: 7/10`（内容完整性 + 导入一致性等 3 处失败） |
| B. 在 `skills/checker/audit/` 新增未登记文件 `EXTRA.md` | `verify: 9/10`（catalog 新鲜度失败）；且生成器会把新文件纳入 bundle，证明**不会静默漏掉**，必须显式重生成 + 提交 |
| C. 在 `skills/checker/audit/` 放入 `hooks/probe.json` | 生成器直接 throw：`bundle 白名单文件落在禁止路径段 'hooks': …（skill 'audit'）` |

更新后的 `runtime include 内容完整性` 门禁不再只看 `SKILL.md`，而是遍历 `bundle.files` 逐文件比对 sha ——
这是反例 A 能被抓住的原因（旧版本只校验 SKILL.md，reference 文件漂移不会被发现）。

## 六、边界与未做

- 控制面保持单文件是**有意**的：`governance/sliver-core/` 下含 hooks / packaging / tests / plugins，
  目录忠实会立刻撞上禁止段约束。若将来要投影控制面的更多文件，应显式列出而不是整体目录。
- `agents/` 排除是基于「不被正文引用 + 宿主资产」的判断；若将来某技能正文开始引用 `agents/` 内容，
  应改为按文件显式纳入，而不是放开整段。
- 树的规模效应：目录单位意味着**任何**目录内新增文件都会要求重新生成 catalog（否则门禁失败）。
  这是有意的 fail-closed 行为，但会让「加一个 reference 文件」变成两步（改文件 + 重新生成并提交）。
- 未做宿主 fresh-session smoke；bundle 变大了 20 个文件，宿主 trust / 行为仍 `UNVERIFIED`。
- 仍未做路由绑定：Sliver 的 22 条路由目前**不引用**这 82 个技能（0 条绑定），
  所以即使技能在 bundle 里，项目入口也不会路由到它们。
