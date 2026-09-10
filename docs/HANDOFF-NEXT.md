# 接手必读（2026-09-10 主 Agent 交接，上下文用尽）

> 本文是**最新交接**，优先级高于 `docs/HANDOFF.md` 中的所有历史轮次记录。冲突时以本文为准。

## 0. 仓库状态

- 仓库 `F:/skiils工具/feisheng-vibe-coding`，分支 `main`，最新提交见 `git log -1 --oneline`（本轮为功能重叠裁决补全），**工作树干净**。
- 门禁：`pwsh scripts/verify.ps1` = **7/7 PASS**；加 `-IncludePackage` = **8/8 PASS**（发布包 22 文件、0 违规）。
- 来源快照：`vibe-coding-skills=553`、`mattpocock-skills=136`、`sliver-core=220`，树摘要全部一致
  （matt 有 4 个按已提交 revision 校验；sliver 有 3 个已登记本地补丁）。
- 脚手架 `_smoke/`（2.4M，已 gitignore）：**总目标完成后统一清理**，勿提前删（内含宿主 junction 回滚映射等证据）。
- 存量：`evidence/` 31 份、`tasks/` 32 份、`scripts/` 16 个。

## 1. 【已完成】功能重叠裁决补全（2026-09-10 本轮完成）

> 已完成：`duplicateGroups` 3 → **11 组**，覆盖交接点名的 11 簇 / 50 个技能；新增 7 个域 owner 并登记入
> `OWNER-LEDGER.json`；生成器增加 owner/成员 fail-closed 校验；`readiness`/`status` 零改动；
> `verify.ps1 -IncludePackage` 8/8。证据：`evidence/20260910-overlap-arbitration.md`、
> 任务：`tasks/20260910-overlap-arbitration.md`。
> **下一优先事项见第 2 节。**
> 注：owner 已归一化为 ledger 登记 id —— `project-entry`：`sliver-vibe-coding`→`route-catalog`；
> `review-and-test`：`sliver-validation-gate`→`validation-gate`。
> 下面保留原任务说明作为历史记录。

### 背景

82 个技能是三个仓库「规范技能」的**全集**（Sliver 1 + Vibe 46 + Matt 35），唯一未登记的是 Matt 的
`.skills/translate-skill`（翻译维护 meta-技能，建议不补）。所以"挑选"不在技能集合层，而在四层：
文件内容 / **功能重叠裁决** / 交付(runtime) / 路由。

其中**功能重叠裁决只做了 3 组、覆盖 10 个技能**，其余重叠未登记 —— 这就是本轮要补的洞。

### 已登记（3 组）

| 组 id | owner | members |
|---|---|---|
| `project-entry` | `sliver-vibe-coding` | vibe-coding-skills、ask-matt（aliases） |
| `review-and-test` | `sliver-validation-gate` | vibe-code-review、code-review、tdd |
| `truth-and-planning` | `target-truth` | product-spec-builder、dev-planner、to-spec、to-tickets、wayfinder |

### 待裁决的 11 个功能簇（实测：涉及 50 个技能，42 个未纳入任何组）

```
review/审查     5个 [未登记3]  code-review, vibe-code-review, audit, critique, harden
test/测试       3个 [未登记2]  tdd, test-automation, requirements-test-designer
bug/排障        2个 [未登记2]  bug-fixer, diagnosing-bugs
plan/spec/计划  6个 [未登记1]  product-spec-builder, dev-planner, to-spec, to-tickets, wayfinder, design-brief-builder
design/UI设计   8个 [未登记8]  design-maker, design-brief-builder, ui-ux-pro-max, impeccable, design-system, layout, polish, prototype
memory/上下文   3个 [未登记3]  codebase-memory-scout, handoff, claude-handoff
writing/文档    5个 [未登记5]  writing-for-agents, writing-shape, writing-beats, writing-fragments, doc-sync-guardian
skill治理       6个 [未登记6]  skill-builder, rule-harvester, setup-ts-deep-modules, wizard, target-runtime-setup, target-constitution-setup
澄清/提问       6个 [未登记6]  clarify, grilling, grill-me, grill-with-docs, to-questionnaire, wait-what
架构            4个 [未登记4]  architecture-foundation, improve-codebase-architecture, codebase-design, domain-modeling
git/冲突        3个 [未登记3]  resolving-merge-conflicts, git-guardrails-claude-code, release-builder
```

### 设计原则（**不要走偏**）

1. **不删技能、不降级**：既定选择是「**全量保留内容 + 声明归属(owner) + 由 Sliver 作唯一路由裁决**」；
   重复功能靠"谁在什么条件下用哪个"解决，**不要为了"收敛"把技能改成 excluded**。
2. **依据已有语义判断**：`provenance/SKILL-DECISIONS.md`（散文级裁决，已覆盖 81/82）是主要依据，例如
   「Bug 救援：Vibe bug-fixer 管专项检查，Matt diagnosis 管反馈循环」「测试/TDD：Matt tdd 管方法，Vibe test automation 管专项执行」。
   任务就是把这些散文意图变成**可机读**裁决。
3. **唯一写入点**：`provenance/SKILL-CLASSIFICATION.json` 的 `duplicateGroups`。
   **禁止**手工编辑 `provenance/CANONICAL-CATALOG.json`（生成物）。
4. **owner 必须在 `provenance/OWNER-LEDGER.json` 里存在**。现有 owner：`route-catalog`、`skill-catalog`、
   `target-truth`、`runtime-projection`、`local-patch-registry`、`host-evidence`。
   若某簇需要新 owner（如 UI 质量），先登记 owner 再引用。
5. 保留 `duplicateGroups[].rule` 字段（已有引用），可在组内扩充分工说明。

### 落地步骤

1. 读 `provenance/SKILL-DECISIONS.md` 全文 + `SKILL-CLASSIFICATION.json` 的 `duplicateGroups`。
2. 为 11 簇补齐条目（语义相近者可合并）：`id` / `owner` / `members` / `rule`，把"何时用谁"写清楚。
3. `pwsh scripts/build-canonical-catalog.ps1 -RepoRoot <repo>`（重新生成 catalog）。
4. `pwsh scripts/build-capability-index.ps1 -RepositoryRoot <repo>`（如索引需展示裁决可扩展，勿破坏新鲜度校验）。
5. `pwsh scripts/verify.ps1 -IncludePackage` 必须 **8/8**。
6. 写 `evidence/<id>.md` + `tasks/<id>.md`，提交。

### 验收

- 全部簇有机读裁决；`verify.ps1` 8/8；**不改动任何 readiness/status**（本轮只加裁决）；owner 均在 ledger 中。

## 2. 下一步两件事（本交接剩余优先）

### 2.1 物理导入 + 门禁策略化（提升 runtime 覆盖，定义已完备）

**关键结论（被门禁实测逼出）**：在本仓库「接受一个技能」**意味着把内容物理导入到 `sources/` 之外的一等位置**，
因为 `scripts/runtime-projection-guard.ps1` **禁止 `sources` 段进入运行时 bundle**。已验收的 Matt 原语是范例
（路径 `skills/engineering/<id>/SKILL.md`）。

四步（已写入 `SKILL-CLASSIFICATION.json` 的 `runtimePromotionPolicy.structuralPrerequisite`）：

1. 把 `sources/vibe-coding-skills/skills/<id>/` 复制到一等位置（如 `skills/product/<id>/`），登记派生来源（源路径 + 源 SHA）。
2. `build-canonical-catalog.ps1` 对 `readiness=accepted` 的 Vibe 记录改用导入后路径（照 Matt 原语模式）。
3. **NOTICE 门禁策略化**：`validate-release-notices.ps1` **硬编码**要求「Vibe 条目必须 `runtimeEligible=false`」；
   放宽必须与物理导入**同批**，**不能先翻 flag**（本轮试过：verify 直接 4/8 拒绝，已回退）。
4. 再改 readiness 并跑全套门禁。

已具备前提：Vibe 46/46 许可证族已映射（`LICENSE-MAP.json` 的 `vibePerSkill`，8 族，字体缺口已补上游 OFL + revision）；
逐技能宿主证据在 `provenance/HOST-DISCOVERY-EVIDENCE.json`（62 model-visible / 14 installed-user-invoked-only / 6 not-installed）。

**建议首批**：审计明确记为「只读 checker / 文档输出工具」的 13 个（`writeAuthority=none`）：
`audit, bug-fixer, codebase-memory-scout, critique, design-brief-builder, design-maker, harden, hotspot-governor, optimize, requirements-test-designer, test-automation, ui-system-guardian, vibe-code-review`。

### 2.2 Hook 解锁（最后，风险最大）

**尚未开始**。门槛：per-skill license（已具备）+ host discovery + 事件顺序/并发验证 + 写白名单/回滚 + **独立逻辑审查**。
**独立逻辑审查我无法自供**（子 Agent 多次 503/中断），且 Hook 会写进宿主、影响每次工具调用、可阻断操作
→ 需 owner 明确授权并在专门会话中做。

## 3. 82 个技能的构成（回答"是否全量吸收"）

| 来源 | 源侧 SKILL.md | 我们登记 | 说明 |
|---|---|---|---|
| sliver-vibe-coding | 1 | 1 | 22 条主路由 + 9 lens 是 `references/*.md`，非独立技能 |
| vibe-coding-skills | **138** | **46** | 138 = `skills/` 46 + `.claude/skills/` 46 + `.agents/skills/` 46；后两者是**宿主适配变体**（同名不同内容） |
| mattpocock-skills | 36 | 35 | 未登记 `.skills/translate-skill`（翻译维护 meta-技能） |

**关键佐证**：抽样 10 个技能，**宿主实际加载 == 我们的快照 == Vibe 规范 `skills/` 版本**（10/10），
且**不等于**镜像变体 → 我们吸收的就是你宿主在跑的那份。

```
技能集合   82/83     几乎全量（差 1 个翻译维护技能）
文件内容   全量       能力性文件无缺失（Vibe tools 145/145、hooks 10/10、codex-hooks 22/22）
功能裁决   11/11 簇   已完成（evidence/20260910-overlap-arbitration.md）
交付runtime 4/82     只启用经证据+导入的技能
路由绑定   0 条       ← Sliver 的 22 路由不引用这 82 个技能（更深层缺口，未开工）
```

## 4. 本会话踩过的坑（照抄省时间）

1. **heredoc 会吞反斜杠**（shell 层）→ 用 `chr(92)`、`DirectorySeparatorChar`，或改用 write/edit 工具写文件。
2. **`@()` 经 if 表达式赋值会解包成 `$null`** → 先 `$x = @()` 再条件赋值；函数别返回裸集合。
3. **`[ordered]@{}` 没有 `ContainsKey`** → 用普通 `@{}`。
4. **`Sort-Object` 是 culture 排序**（PS 5.1 vs 7 对 `-` 权重不同）→ 用 `[System.StringComparer]::Ordinal`。
5. **含中文的 .ps1 必须 UTF-8 BOM**，否则 Windows PowerShell 5.1 按 GBK 解码直接语法报错。
6. **调 Sliver 自带 Python 工具必须带 `-B`**，否则生成 `__pycache__` 被自家 provenance 门禁拦下（实测 220→224）。
7. **`Join-Path $a 'x/' + $b` 会把 `+` 当字面参数** → 写 `Join-Path $a ('x/' + $b)`。
8. **投影禁止 `sources` 段** → 提升必须先物理导入（见 2.1）。
9. **NOTICE 门禁硬编码 Vibe `runtimeEligible=false`** → 不能单独翻 flag。
10. **`core.autocrlf=true`**：提交可能改写工作树换行 → **每次提交后都要重跑 `verify.ps1`**。
11. **宿主布局**：`~/.claude/skills` 与 `F:/skiils工具/_adapters/shared/skills` 是**同一目录**（junction）；
    `~/.codex/skills` 原有 157 个 junction 已清空（现 Codex 的 r0 即共享根）。
    删 junction 只能用 `os.rmdir`（`shutil.rmtree` 拒绝）；`os.path.islink` 对 junction 返回 False。
12. **`codex debug prompt-input` 的 JSON 里换行是转义的两字符**（反斜杠+n）→ 解析前先替换成真换行。
13. **`disable-model-invocation: true` 的技能不会出现在模型可见清单里** → 证据必须分类，不能只看清单命中。
14. **存在并行写入者**：`docs/HANDOFF.md` 曾被另一写入者插入"当前接手快照"块（已保留意图并刷新为准确状态）。
    动手前先 `git status`，不要静默丢弃他人改动。

## 5. 入口速查

```
真源（唯一写入点）
  provenance/SKILL-CLASSIFICATION.json    ← 分类 + 裁决（domain/readiness/duplicateGroups/policy）
  provenance/LICENSE-MAP.json             ← 许可证台账（entries + vibePerSkill）
  provenance/LOCAL-PATCHES.json           ← 本地补丁登记（未登记偏差即漂移）
  provenance/OWNER-LEDGER.json            ← owner 机器可读记录
  provenance/HOST-DISCOVERY-EVIDENCE.json ← 逐技能宿主证据
生成物（禁止手工编辑）
  provenance/CANONICAL-CATALOG.json / docs/CAPABILITY-INDEX.md / provenance/PROVENANCE-INTEGRITY.json
门禁
  scripts/verify.ps1                      ← 单入口（7 项；-IncludePackage 共 8 项）
  scripts/runtime-projection-guard.ps1    ← 共享投影门禁（唯一实现）
  scripts/validate-release-notices.ps1    ← NOTICE 门禁
宿主 smoke（消耗真实额度，不接入 verify）
  scripts/smoke-host-skill-discovery.ps1  ← -TargetHost Claude|Codex|Both -Install/-Uninstall/-Probe
  scripts/collect-host-skill-evidence.ps1 ← 采集逐技能发现性证据
```

## 6. 仍未验证（不要越界声明）

- 宿主 **trust**、技能**真实行为正确性**、**Hook 强制** —— 三者均 `UNVERIFIED`。
- 发布 CI 未在真实 GitHub runner 跑过（工作流已接入，仅本地校验 YAML）。
- 我们自己的 **Codex 投影**尚未做其自身的 discovery smoke（已实测的是 Sliver 控制面 bundle 在 Codex 上的发现机制）。
- 宿主证据只证明"被识别"，**不证明行为正确**。

## 7. 不可突破的边界

- 不修改三个来源项目（只读）；`git fetch` 之类只写来源 `.git`，需 owner 授权。
- **本仓库自持，不依靠任何上游**：不产出上游问题报告、不等上游确认；上游差异只作事实记录 + 周期复核。
- 不手工编辑生成物；改分类/裁决只改 `SKILL-CLASSIFICATION.json`。
- 不把 Vibe 的 `.claude/`/`.agents/`/`.codex/` 镜像当源码或运行时内容。
- 不把混合第三方许可证并成根许可证；不手工复制许可证文件。
- 修改 vendored 内容必须先登记 `LOCAL-PATCHES.json`（含 `originalSha256`）。
- 测试脚手架只放 `<repo>/_smoke/`；不覆盖宿主既有技能；不把 static smoke 写成真实宿主可用。
