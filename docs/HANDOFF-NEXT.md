# 接手必读（2026-09-10，功能重叠裁决补全后刷新）

> 本文是**最新交接**，优先级高于 `docs/HANDOFF.md` 中的所有历史轮次记录。冲突时以本文为准。
> 上一版交接（当时第一优先是功能重叠裁决补全）已被本轮完成，其完整历史仍见 `docs/HANDOFF.md` 与本文件末尾。

## 0. 仓库状态

- 仓库 `F:/skiils工具/feisheng-vibe-coding`，分支 `main`；功能重叠裁决补全的提交为 `c7f1f66`，
  之后仅剩本交接刷新提交，**工作树干净**。
- 门禁：`pwsh scripts/verify.ps1` = **7/7 PASS**；加 `-IncludePackage` = **8/8 PASS**（发布包 22 文件、0 违规）。
- 来源快照：`vibe-coding-skills=553`、`mattpocock-skills=136`、`sliver-core=220`，树摘要全部一致
  （matt 有 4 个按已提交 revision 校验；sliver 有 3 个已登记本地补丁）。
- 存量：`evidence/` 32 份、`tasks/` 33 份、`scripts/` 17 个。
- 脚手架 `_smoke/`（169 个文件，已 gitignore）：**总目标完成后统一清理**，勿提前删（内含宿主 junction 回滚映射等证据）。

## 1. 本轮完成：功能重叠裁决补全（原「第一优先」）

`duplicateGroups` 3 → **11 组**，覆盖交接点名的 **11 簇 / 50 个技能**；机读真源仍是
`provenance/SKILL-CLASSIFICATION.json`（未改 `readiness`/`status`）。

| 交接簇 | 组 id | owner | 成员 |
|---|---|---|---|
| review/审查 + test/测试 | `review-and-test` | `validation-gate` | code-review、vibe-code-review、audit、critique、harden、tdd、test-automation、requirements-test-designer |
| bug/排障 | `bug-rescue` | `bug-rescue` | bug-fixer、diagnosing-bugs |
| plan/spec/计划 | `truth-and-planning` | `target-truth` | product-spec-builder、dev-planner、to-spec、to-tickets、wayfinder |
| design/UI设计 | `ui-quality` | `ui-quality` | design-maker、design-brief-builder、ui-ux-pro-max、impeccable、design-system、layout、polish、prototype |
| memory/上下文 | `context-and-handoff` | `context-handoff` | codebase-memory-scout、handoff、claude-handoff |
| writing/文档 | `doc-authoring` | `doc-authoring` | writing-for-agents、writing-shape、writing-beats、writing-fragments、doc-sync-guardian |
| skill治理 | `skill-governance` | `skill-catalog` | skill-builder、rule-harvester、wizard、target-constitution-setup、target-runtime-setup、setup-ts-deep-modules |
| 澄清/提问 | `clarification-and-grilling` | `target-truth` | clarify、grilling、grill-me、grill-with-docs、to-questionnaire、wait-what |
| 架构 | `architecture` | `architecture` | architecture-foundation、improve-codebase-architecture、codebase-design、domain-modeling |
| git/冲突 | `git-and-release` | `git-release` | resolving-merge-conflicts、git-guardrails-claude-code、release-builder |
| （既有）总入口 | `project-entry` | `route-catalog` | 别名 vibe-coding-skills、ask-matt |

要点：

- **不删技能、不降级**：全量保留内容 + 声明归属 + Sliver 唯一路由；每组的 `rule` 写清「何时用谁」。
- **owner 归一化**：`project-entry` 的 `sliver-vibe-coding`→`route-catalog`；`review-and-test` 的
  `sliver-validation-gate`→`validation-gate`。新增登记 7 个域 owner：
  `validation-gate`、`bug-rescue`、`ui-quality`、`context-handoff`、`doc-authoring`、`architecture`、`git-release`。
- **新门禁**：`scripts/build-canonical-catalog.ps1` 生成前 fail-closed 校验
  ①group.owner 必须在 `OWNER-LEDGER.json`；②成员必须是 canonical id；③group.id 唯一。已用反例实测。
- **能力索引**：`docs/CAPABILITY-INDEX.md` 新增「功能重叠裁决（duplicateGroups）」表。
- 证据：`evidence/20260910-overlap-arbitration.md`；任务：`tasks/20260910-overlap-arbitration.md`。

## 2. 【下一步第一优先】物理导入 + 门禁策略化（提升 runtime 覆盖）

**关键结论（被门禁实测逼出）**：在本仓库「接受一个技能」**意味着把内容物理导入到 `sources/` 之外的一等位置**，
因为 `scripts/runtime-projection-guard.ps1` **禁止 `sources` 段进入运行时 bundle**。已验收的 Matt 原语是范例
（路径 `skills/engineering/<id>/SKILL.md`）。

四步（已写入 `SKILL-CLASSIFICATION.json` 的 `runtimePromotionPolicy.structuralPrerequisite`）：

1. 把 `sources/vibe-coding-skills/skills/<id>/` 复制到一等位置（如 `skills/product/<id>/`），登记派生来源（源路径 + 源 SHA）。
2. `build-canonical-catalog.ps1` 对 `readiness=accepted` 的 Vibe 记录改用导入后路径（照 Matt 原语模式）。
3. **NOTICE 门禁策略化**：`validate-release-notices.ps1` **硬编码**要求「Vibe 条目必须 `runtimeEligible=false`」；
   放宽必须与物理导入**同批**，**不能先翻 flag**（本轮之前试过：verify 直接 4/8 拒绝，已回退）。
4. 再改 readiness 并跑全套门禁。

已具备前提：Vibe 46/46 许可证族已映射（`LICENSE-MAP.json` 的 `vibePerSkill`，8 族，字体缺口已补上游 OFL + revision）；
逐技能宿主证据在 `provenance/HOST-DISCOVERY-EVIDENCE.json`（62 model-visible / 14 installed-user-invoked-only / 6 not-installed）。

**建议首批**：审计明确记为「只读 checker / 文档输出工具」的 13 个（`writeAuthority=none`）：
`audit, bug-fixer, codebase-memory-scout, critique, design-brief-builder, design-maker, harden, hotspot-governor, optimize, requirements-test-designer, test-automation, ui-system-guardian, vibe-code-review`。

## 3. 【最后做】Hook 解锁（风险最大）

**尚未开始**。门槛：per-skill license（已具备）+ host discovery + 事件顺序/并发验证 + 写白名单/回滚 + **独立逻辑审查**。
**独立逻辑审查当前主 Agent 难以自供**（子 Agent 多次 503/中断），且 Hook 会写进宿主、影响每次工具调用、可阻断操作
→ 需 owner 明确授权并在专门会话中做。

## 4. 82 个技能的构成（回答"是否全量吸收"）

| 来源 | 源侧 SKILL.md | 我们登记 | 说明 |
|---|---|---|---|
| sliver-vibe-coding | 1 | 1 | 22 条主路由 + 9 lens 是 `references/*.md`，非独立技能 |
| vibe-coding-skills | **138** | **46** | 138 = `skills/` 46 + `.claude/skills/` 46 + `.agents/skills/` 46；后两者是**宿主适配变体**（同名不同内容） |
| mattpocock-skills | 36 | 35 | 未登记 `.skills/translate-skill`（翻译维护 meta-技能，建议不补） |

**关键佐证**：抽样 10 个技能，**宿主实际加载 == 我们的快照 == Vibe 规范 `skills/` 版本**（10/10），
且**不等于**镜像变体 → 我们吸收的就是宿主在跑的那份。

```
技能集合   82/83     几乎全量（差 1 个翻译维护技能）
文件内容   全量       能力性文件无缺失（Vibe tools 145/145、hooks 10/10、codex-hooks 22/22）
功能裁决   11/11 簇   已完成（evidence/20260910-overlap-arbitration.md）
交付runtime 4/82     只启用经证据+导入的技能（Sliver + 3 个 Matt 原语）
路由绑定   0 条       ← Sliver 的 22 路由不引用这 82 个技能（更深层缺口，未开工）
```

## 5. 历史踩坑（照抄省时间）

1. **heredoc 会吞反斜杠**（shell 层）→ 用 `chr(92)`、`DirectorySeparatorChar`，或改用 write/edit 工具写文件。
2. **`@()` 经 if 表达式赋值会解包成 `$null`** → 先 `$x = @()` 再条件赋值；函数别返回裸集合。
3. **`[ordered]@{}` 没有 `ContainsKey`** → 用普通 `@{}`。
4. **`Sort-Object` 是 culture 排序**（PS 5.1 vs 7 对 `-` 权重不同）→ 用 `[System.StringComparer]::Ordinal`。
5. **含中文的 .ps1 必须 UTF-8 BOM**，否则 Windows PowerShell 5.1 按 GBK 解码直接语法报错。
6. **调 Sliver 自带 Python 工具必须带 `-B`**，否则生成 `__pycache__` 被自家 provenance 门禁拦下（实测 220→224）。
7. **`Join-Path $a 'x/' + $b` 会把 `+` 当字面参数** → 写 `Join-Path $a ('x/' + $b)`。
8. **投影禁止 `sources` 段** → 提升必须先物理导入（见第 2 节）。
9. **NOTICE 门禁硬编码 Vibe `runtimeEligible=false`** → 不能单独翻 flag。
10. **`core.autocrlf=true`**：提交可能改写工作树换行 → **每次提交后都要重跑 `verify.ps1`**。
11. **宿主布局**：`~/.claude/skills` 与 `F:/skiils工具/_adapters/shared/skills` 是**同一目录**（junction）；
    `~/.codex/skills` 原有 157 个 junction 已清空（现 Codex 的 r0 即共享根）。
    删 junction 只能用 `os.rmdir`（`shutil.rmtree` 拒绝）；`os.path.islink` 对 junction 返回 False。
12. **`codex debug prompt-input` 的 JSON 里换行是转义的两字符**（反斜杠+n）→ 解析前先替换成真换行。
13. **`disable-model-invocation: true` 的技能不会出现在模型可见清单里** → 证据必须分类，不能只看清单命中。
14. **存在并行写入者**：`docs/HANDOFF.md` 曾被另一写入者插入"当前接手快照"块（已保留意图并刷新为准确状态）。
    动手前先 `git status`，不要静默丢弃他人改动。
15. **generated 文件的删除逻辑**：`ConvertFrom-Json` 读含单元素数组的 JSON 时可能解包成标量；遍历统一 `@()` 包裹。

## 6. 入口速查

```
真源（唯一写入点）
  provenance/SKILL-CLASSIFICATION.json    ← 分类 + 裁决（domain/readiness/duplicateGroups/policy）
  provenance/LICENSE-MAP.json             ← 许可证台账（entries + vibePerSkill）
  provenance/LOCAL-PATCHES.json           ← 本地补丁登记（未登记偏差即漂移）
  provenance/OWNER-LEDGER.json            ← owner 机器可读记录（duplicateGroups owner 必须在其中）
  provenance/HOST-DISCOVERY-EVIDENCE.json ← 逐技能宿主证据
生成物（禁止手工编辑）
  provenance/CANONICAL-CATALOG.json / docs/CAPABILITY-INDEX.md / provenance/PROVENANCE-INTEGRITY.json
门禁
  scripts/verify.ps1                      ← 单入口（7 项；-IncludePackage 共 8 项）
  scripts/runtime-projection-guard.ps1    ← 共享投影门禁（唯一实现）
  scripts/validate-release-notices.ps1    ← NOTICE 门禁
  scripts/build-canonical-catalog.ps1     ← 含 duplicateGroups owner/成员 fail-closed 校验
宿主 smoke（消耗真实额度，不接入 verify）
  scripts/smoke-host-skill-discovery.ps1  ← -TargetHost Claude|Codex|Both -Install/-Uninstall/-Probe
  scripts/collect-host-skill-evidence.ps1 ← 采集逐技能发现性证据
```

常用命令：

```powershell
# 一键全套门禁 + 生成物新鲜度
pwsh -NoProfile -File 'scripts/verify.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' -IncludePackage

# 改分类/裁决后重生成（顺序不能反）
pwsh -NoProfile -File 'scripts/build-canonical-catalog.ps1' -RepoRoot 'F:\skiils工具\feisheng-vibe-coding'
pwsh -NoProfile -File 'scripts/build-capability-index.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'
```

## 7. 仍未验证（不要越界声明）

- 宿主 **trust**、技能**真实行为正确性**、**Hook 强制** —— 三者均 `UNVERIFIED`。
- 发布 CI 未在真实 GitHub runner 跑过（工作流已接入，仅本地校验 YAML）。
- 我们自己的 **Codex 投影**尚未做其自身的 discovery smoke（已实测的是 Sliver 控制面 bundle 在 Codex 上的发现机制）。
- 宿主证据只证明"被识别"，**不证明行为正确**。

## 8. 不可突破的边界

- 不修改三个来源项目（只读）；`git fetch` 之类只写来源 `.git`，需 owner 授权。
- **本仓库自持，不依靠任何上游**：不产出上游问题报告、不等上游确认；上游差异只作事实记录 + 周期复核。
- 不手工编辑生成物；改分类/裁决只改 `SKILL-CLASSIFICATION.json`。
- 不把 Vibe 的 `.claude/`/`.agents/`/`.codex/` 镜像当源码或运行时内容。
- 不把混合第三方许可证并成根许可证；不手工复制许可证文件。
- 修改 vendored 内容必须先登记 `LOCAL-PATCHES.json`（含 `originalSha256`）。
- 测试脚手架只放 `<repo>/_smoke/`；不覆盖宿主既有技能；不把 static smoke 写成真实宿主可用。
- `duplicateGroups[].owner` 必须是 `OWNER-LEDGER.json` 中登记的 owner；新增 owner 先登记再引用。
