# 重复检查 · 三包覆盖分析 · Codex 投影缺口修复

日期：2026-09-10
关联任务包：tasks/20260910-duplicate-and-coverage-audit.md（accepted）
数据来源：`provenance/CANONICAL-CATALOG.json`、`provenance/SKILL-INVENTORY.json`、各导入记录、
三来源文件树实测、`_smoke/host-skills.json`（宿主技能清单）

---

# 一、重复检查

## 1. 我们仓库内部：无重复

| 检查项 | 结果 |
|---|---|
| 82 条记录的 id | 无重复 |
| 82 条记录的 path | 无重复 |
| 82 个技能文件的 SHA-256 | **无两组内容相同**（即没有"同一内容挂两个 id"） |

## 2. 跨来源同名冲突：仅 1 个，且已消解

`code-review` 同时存在于 `vibe-coding-skills` 与 `mattpocock-skills`。已通过命名空间消解：
我们的 canonical id 是 `vibe-code-review`（Vibe）与 `code-review`（Matt），并在
`duplicateGroups.review-and-test` 登记（owner = `sliver-validation-gate`）。

## 3. 已登记的语义重复组（3 个，各有唯一 owner）

| 组 | owner | 成员 | 规则 |
|---|---|---|---|
| `project-entry` | `sliver-vibe-coding` | vibe-coding-skills、ask-matt（别名） | 别名可激活但不得拥有项目路由 |
| `review-and-test` | `sliver-validation-gate` | vibe-code-review、code-review、tdd | 专项方法只回findings/results，Sliver 拥有验收门 |
| `truth-and-planning` | `target-truth` | product-spec-builder、dev-planner、to-spec、to-tickets、wayfinder | 适配器投影到 target-truth，不得产生第二份 spec owner |

**结论**：功能重复是**被识别并被归属**的，不是并排堆叠。

## 4. 宿主安装层面：发现真实重复（需要你决定是否清理）

| 位置 | 技能数 | 说明 |
|---|---|---|
| `~/.claude/skills` | 187 | Claude Code 的 `user` 根；同时是 Codex 的技能根 **`r1`**（junction） |
| `~/.codex/skills` | 158 | Codex 的技能根 **`r0`** |
| **两边都有** | **157** | → **Codex 会把同一个技能列出两遍**（`r0` + `r1` 各一条） |

实测证据（`codex debug prompt-input`）：

```text
- sliver-vibe-coding: … (file: r0/sliver-vibe-coding/SKILL.md)
- sliver-vibe-coding: … (file: r1/sliver-vibe-coding/SKILL.md)
```

两者**不是**同一目录（标记法实测），仅 codex 独有 `.system`，仅 claude 独有 30 个。

**建议（未执行，需你授权）**：既然 `r1`（`~/.claude/skills`）对两个宿主都可见，
而 Claude **不读** `~/.codex/skills` —— 把 `~/.codex/skills` 里与 `r1` 重复的 157 个清掉，
只保留 Codex 专属内容（如 `.system`），即可消除 Codex 侧的双份注册。这会动你的环境，故未执行。

---

# 二、三包功能覆盖分析：我们的包能做到多少

## 1. 内容覆盖：能力性内容 ~100%

| 来源 | 源文件 | 已快照 | 未快照 | 未快照都排除了什么 |
|---|---|---|---|---|
| sliver-vibe-coding | 228 | **220** | 8 | 5 张营销图（海报/微信群二维码）+ 3 个 `__pycache__` 构建产物 |
| vibe-coding-skills | 1342 | **550** | 792 | `.claude` 344 + `.agents` 340 + `.codex` 27（宿主镜像，**故意不采用**）、`plans/` 71、4 个根配置、4 个 docs、旧路由清单 1 |
| mattpocock-skills | 145 | **136** | 9 | 4 个翻译维护脚本、`.out-of-scope/` 3、`.skills/translate-skill` 1、`.gitignore` |

**关键**：Vibe 的能力性目录**全部在内**——`tools/` 145/145（自带工具链）、`hooks/` 10/10、
`codex-hooks/` 22/22、`agents/` 5/5、`feedback/` 2/2、`skills/` 46/46。

被排除的 792 个里，711 个是宿主镜像（正是「不把 `.claude`/`.agents`/`.codex` 镜像当源码」这条规则的执行），
71 个是开发计划，其余是配置与旧清单。**没有能力性内容被丢弃。**

## 2. 技能级覆盖

| 指标 | 数量 | 占比 |
|---|---|---|
| 三来源技能总数 | 82 | 100% |
| **内容已在我们快照里** | **82** | **100%** |
| 已在宿主上可用（注：来自你**既有**安装，不是我们包的投影） | 75 | 91% |
| **属于我们包"正式投影"**（Sliver 控制面 + 3 个 Matt 原语） | **4** | **5%** |

三来源里**未装到宿主**的技能 7 个：`vibe-code-review`、`claude-handoff`、`loop-me`、
`setup-ts-deep-modules`、`writing-beats`、`writing-fragments`、`writing-shape`（后 6 个是我们按设计排除的 in-progress）。

## 3. 功能维度（不是技能计数）覆盖

| 功能维度 | 三来源中的量 | 我们包能实现多少 |
|---|---|---|
| **Sliver 控制面** |22 条主路由 + 9 条条件 lens | ✅ **全部**：220 文件全在快照，且宿主 discovery 已实测（169 vs 168） |
| **Vibe 技能** | 46 个 | 🟡 内容 100% 在；**行为证据**未做 → 全部 `source-only` |
| **Vibe 自带工具链** | `tools/` 145 个（体检/门禁/构建脚本） | ✅ 内容全在（可运行；未逐个跑过） |
| **Matt 技能** | 35 个 | 🟡 3 个已验收原语进投影；7 个 candidate；6 个 in-progress 按设计排除 |
| **许可证与来源可追溯** | — | ✅ 比三个原包更强（逐技能台账 + 树摘要 + 偏差登记 + 独立审计） |
| **Hook 自动强制** | Vibe hooks 10 + codex-hooks 22 | ❌ **未实现**（内容在，但适配器**故意禁用**，需 host discovery/事件契约/写白名单/回滚全过） |

## 4. 结论：一句话

> **内容层面接近 100% 覆盖（能力性文件无一缺失）；"正式可交付"目前 4/82（5%），
> 差距不是内容而是"逐技能行为证据"；唯一结构性未实现的能力是 Hook 自动强制。**

## 5. 已知内容缺口（都是小口子，可用一次有界导入补齐）

| 缺口 | 影响 | 建议 |
|---|---|---|
| Vibe `docs/runtime-loading-policy.md`、`docs/reference-main-chain.md`、`docs/language-platform-profiles.md`（+1 html） | `runtime-loading-policy.md` 被 Vibe 的 `AGENTS.md`/README 引为「tier/路由/Hook/生命周期/rollback」的权威之一 → **引用了但不在包里** | 作为一次有界导入补入（3 个 md；html 属演示物可略） |
| Matt `.skills/translate-skill/SKILL.md` | 1 个技能（翻译维护用，非用户能力） | 建议不补（自持后无上游翻译需求） |
| Matt `scripts/audit-english.mjs` 等 4 个 | 翻译维护脚本 | 建议不补 |
| Vibe `plans/` 71 个 | 开发计划产物，非能力 | 不补 |

---

# 三、Codex 投影缺口修复（已完成）

## 缺口

Claude 投影挂了 **2 个宿主事实资产**（`CLAUDE.md` 薄入口 + `adapters/claude/runtime-adapter.md`），
而 **Codex 投影一个都没挂** —— 非对称，导致 Codex 侧缺少 Sliver 为 codex 规定的宿主事实。

## 权威依据

Sliver 自己的 `packaging/runtime-manifest.json` 的 `targets.codex.overlay_files` 明确规定：

```text
packaging/adapters/codex/agents/openai.yaml                        -> agents/openai.yaml
packaging/adapters/codex/references/studio-codex.md                -> references/studio-codex.md
packaging/adapters/codex/references/execution-liveness-host.md     -> references/execution-liveness-host.md
```

## 修复

`scripts/build-codex-runtime-projection.ps1` 新增 `Get-CodexProjectionPlan`（包装共享门禁的 `Get-ProjectionPlan`
并追加上述 3 个文件），两个调用点改用它；投影布局与 Claude 侧对称，落在 `adapters/codex/…`。

结果：Codex 投影 6 → **9 文件**；`-Mode Build` 与 `-Mode Validate` 均 PASS；发布包 19 → **22 文件**。

## 关于「要不要挂 AGENTS.md」——结论：不挂，且理由有实测支撑

- Codex **原生读目标项目的 `AGENTS.md`**（smoke 中实测到它把仓库根 `AGENTS.md` 注入为 instructions）。
- 那份宪法**属于目标项目**，由 Sliver 的 bootstrap/adoption 模板materialize。
- Claude 侧同样**不挂** `AGENTS.md`：它的薄入口 `CLAUDE.md` 内容**只有一行** `@AGENTS.md`（指向目标项目的 AGENTS.md）。
- 所以缺的不是「薄入口」，而是「codex 宿主事实资产」——已按上游 manifest 补齐。
