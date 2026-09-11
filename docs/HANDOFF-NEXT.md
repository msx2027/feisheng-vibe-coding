# 交接必读：feisheng-vibe-coding 目标准完成手册

> 这是**唯一**的交接入口（取代并覆盖本文件的历史版本）。`docs/HANDOFF.md` 是历史留档，冲突时以本文为准。
> 本文自包含：新会话读完即可接手，不需要任何对话历史。请用 goal 模式按第 9 节推进到第 8 节定义的「完成」。

---

## 1. 最终目标（Definition of Done）

**目标**：`feisheng-vibe-coding` 可以被用户直接用起来 —— 用户只说自然语言，不需要知道任何内部名词。

**完成 = 下面 6 条全部可验证通过**：

| # | 验收项 | 判定方式（必须是新鲜证据） |
|---|---|---|
| D1 | **单一入口**：宿主里由我们负责的技能**只有一个** | 宿主技能根里只有 `feisheng-vibe-coding` 一个我们的目录；无重复/旧入口 |
| D2 | **自然语言能触发**：用户用中文说一句真实需求，宿主会加载我们的入口 | 全新会话实测（见 9.2），有可复现的命令与输出留存为证据 |
| D3 | **能自动路由到对应能力**：入口按控制面选到正确路由，并实际用上对应技能 | 同上会话中可观察到「选了哪个路由 / 调用了哪个 provider」；不是推断 |
| D4 | **门禁全绿** | `verify.ps1`（默认 12 步）+ 可选步全绿；**fresh clone** 下同样全绿（`autocrlf` true/false × pwsh/PS5.1） |
| D5 | **无回归** | 路由绑定、投影、NOTICE、来源快照完整性、保真树换行全部保持通过 |
| D6 | **诚实** | 未验证项明确标注 `UNVERIFIED`，不用推断代替证据；不声称宿主 trust / Hook 已生效 |

**注意**：D2/D3 曾是最大未知。2026-09-11 两轮实测后 **D2/D3 均已转绿**：owner 批准更新宿主全局路由块后，
纯中文需求首个动作即调用统一入口，并走通「控制面 → 项目体检路由 → provider → owner」全链路。
证据：`evidence/20260911-trigger-behavior-and-entry-fix.md`、`evidence/20260911-d2-green-t4-and-retirement.md`。

---

## 2. 一分钟现状（数字快照）

- 仓库：`F:/skiils工具/feisheng-vibe-coding`，分支 `main`，工作树干净，最新提交见 git log（本批末为证据提交）
- 远端：`https://github.com/msx2027/feisheng-vibe-coding`（private）；`origin` 已挂，push 即触发 release-gate CI
- 源项目：**已在 `F:\skiils工具\_archive\` 冷存并删除本体**（三个 zip 全等校验通过）；`sources/` 快照为唯一内容真源
- 门禁：`verify.ps1` 默认 **12 步**；`-IncludeHostEvidence`（宿主证据门）与 `-IncludePackage`（发布包）各加 1 步。2026-09-11 治理对齐批实测 `-IncludeHostEvidence -IncludePackage` = **14/14**；fresh clone 两种 shell × 两种 `autocrlf` 全过
- 分类：**82 条记录**，能力定编收口（2026-09-11）：**52 条 runtime 已接入**（控制面 1 + matt 13 + vibe 38）/**23 条 retired**/**7 条排除或兼容**；runtime bundle 共 **422** 文件
- 路由：22 条主路由 / 31 个 operation / **8 个 lens**（`lens-catalog` 实测）
- 路由绑定：**38/38**（每条已接入技能在路由 owner 里唯一命中，门禁步骤 `3b)` 强制）
- 控制面包：**75 文件**（9 core_files + 44 references + 22 assets）
- 宿主（本机）：共享根 `F:\skiils工具\_adapters\shared\skills`（`~/.claude/skills` 是它的 junction）**112 条**（2026-09-11 退役 29+35=64 个源仓库链接后：三源链接清零），其中我们的包 `feisheng-vibe-coding` **422 文件**（宿主中性投影，含控制面 + 全部 51 个技能）
- 宿主触发实测（2026-09-11）：纯中文需求首动作即调用入口；「立项」路由全链路冒烟通过（问题库/模板接管新手访谈）；Codex 注入含根入口 + 控制面 + 38 个技能嵌套条目
- Hook 状态（2026-09-11 治理对齐批口径）：**纠错信号采集面已启用**（SessionStart 只读待消化提醒 / UserPromptSubmit 纠错采集 / runner `-Mode Digest` 消化标记）；沉淀消费技能（三件套）未接入，不声称完整沉淀闭环；治理门禁事件（PreToolUse/PostToolUse/Stop）保持禁用归控制面；宿主 fresh-session 冒烟无仓库内留痕物，维持 `UNVERIFIED`
- 存量：`evidence/` 44、`tasks/` 38、`scripts/` 24

---

## 3. 总背景

### 3.1 这是什么

把三个**只读**来源项目统一成一个项目级入口，同时保留各自必要的分发边界：

| 来源 | 归档 zip（2026-09-11 冷存） | 角色 | 状态 |
|---|---|---|---|
| `sliver-vibe-coding` | `_archive/sliver-vibe-coding-20260911.zip` | 控制面：路由、任务深度、风险、授权、真源、测试、验收 | 已快照导入 `governance/sliver-core/`（220 文件） |
| `vibe-coding-skills` | `_archive/vibe-coding-skills-20260911.zip` | 产品/UI/专项 checker | 已快照（553 文件），46 条登记 |
| `mattpocock-skills` | `_archive/mattpocock-skills-20260911.zip` | 工程原语（TDD、调试、领域建模、模块设计、review） | 已快照（136 文件），35 条登记 |

**源项目本体已于 2026-09-11 归档后删除**（三个 zip 逐文件 sha256 + CRC 全等校验通过，见
`evidence/20260911-source-archive-and-ci.md`）。归档 zip 是只读历史，不参与迁移；
**仓库内 `sources/` 快照是唯一内容真源**（`governance/sliver-core/` + `sources/vibe-coding-skills` +
`sources/mattpocock-skills`，逐文件 sha256 由 `verify.ps1` 步骤 3 强制自证）。

### 3.2 四个唯一 Owner（`provenance/OWNER-LEDGER.json`）

| Owner | 真源 | 拥有 |
|---|---|---|
| `route-catalog` | `governance/sliver-core/references/routes-index.md` | 主路由、operation、lens、reference 加载映射（**排他**） |
| `skill-catalog` | `provenance/CANONICAL-CATALOG.json` | 技能 id、来源、调用类型、runtime 文件清单 |
| `target-truth` | `docs/target-truth-schema.json` | 目标项目的需求/计划/术语/验收/写权限 |
| `runtime-projection` | `packaging/runtime-projection.json` + builder | 生成 Codex/Claude 运行包的规则 |

### 3.3 分层

```text
项目治理控制面（Sliver：路由/深度/风险/授权/真源/验收）
  ├─ 工程原语（Matt）
  ├─ 产品/UI/专项 checker（Vibe）
  └─ 宿主适配（Codex / Claude / 插件 / Hook / 镜像）
```

内部能力只能**返回结果或 finding**，不得成为第二个项目级路由器。

### 3.4 迁移阶段与实际位置

`docs/MIGRATION-PLAN.md` 定义阶段 0–5。实际进度：

| 阶段 | 状态 |
|---|---|
| 0 冻结取证 | ✅ 完成（三源快照逐字节一致，82 技能已分类） |
| 1 控制面 | ✅ 基本完成（唯一入口、catalog、schema、投影、allowlist、revision、回滚点齐备） |
| 2 工程原语 | ✅ 完成（tdd/code-review/codebase-design/diagnosing-bugs/domain-modeling 已接入；7 个 adapter-candidate 未接） |
| 3 宿主适配 | ✅ 完成（中性安装、D2/D3 实测转绿、Hook 纠错信号采集已启用 + Digest 消化标记；trust 与 Hook fresh-session 冒烟仍 UNVERIFIED） |
| 4 产品/UI/第三方 | ✅ 主体完成（Vibe 46 条已接 33：checker 4 + product 13 + ui 16；剩 13 条按 §14 原因留待后续） |
| 5 灰度退役 | 🟡 进行中（12 个旧链接已退役：4 重名 + 29 双重曝光；剩 **35 个**服务未接入技能，待 owner 对 35 技能逐个「接入或退役」后清零；源项目本体去留见 9.9） |

---

## 4. 当前架构（真源 → 生成物 → 门禁 → 投影 → 安装）

```text
真源（人写）
  provenance/SKILL-CLASSIFICATION.json   分类 + 裁决 + runtimePromotionPolicy + routeBinding
  provenance/LICENSE-MAP.json            许可证台账（9 族，逐族 runtimeEligible）
  provenance/LOCAL-PATCHES.json          本地补丁登记（未登记偏差即漂移）
  provenance/OWNER-LEDGER.json           owner 机器可读记录
  provenance/HOST-DISCOVERY-EVIDENCE.json 逐技能宿主证据（2026-09-11 治理对齐批重采：path 精确归属，39 admitted 全部经统一包可见）
  .gitattributes                         保真树 -text + scripts/** eol=lf

生成物（禁止手工编辑）
  provenance/CANONICAL-CATALOG.json      （82 条；bundlePolicy + 每条 bundle.files 逐文件 sha256）
  docs/CAPABILITY-INDEX.md
  provenance/PROVENANCE-INTEGRITY.json

门禁（scripts/verify.ps1，单入口；默认 12 步，可选步另计）
  1 catalog 同步 · 1b runtime include 内容完整性 · 1c 导入副本一致性 · 1d 保真树换行
  2 capability index 新鲜度 · 3 来源快照完整性 · 3b 路由绑定 · 4 NOTICE
  5 Vibe Hook 适配器安全契约（采集面 + Digest）
  6 Codex/Claude/宿主中性投影 · 5b 宿主证据门（-IncludeHostEvidence，2026-09-11 新增）
  7 发布包（-IncludePackage）

投影（runtime-projection）
  scripts/build-codex-runtime-projection.ps1    → 95 文件
  scripts/build-claude-runtime-projection.ps1   → 93 文件
  scripts/build-shared-runtime-projection.ps1   → 92 文件（宿主中性，无 overlay）
  scripts/runtime-projection-guard.ps1          共享门禁/计划/overlay/主体实现（唯一；三 writer 共用 Invoke-RuntimeProjection）
  packaging/runtime-projection.json             策略描述

安装
  scripts/install-runtime-projection.ps1        宿主投递入口（默认 -TargetHost Shared 宿主中性）
```

### 4.1 三种 bundle 单位（`catalog.bundlePolicy`）

| 单位 | 用于 | 说明 |
|---|---|---|
| `directory` | 7 个技能 | 枚举导入目录，排除 `agents/`、`.git`；逐文件 sha |
| `file` | （历史） | 单文件 |
| `explicit` | 控制面 | 由 `bundlePathsFrom` 指向 Sliver 自己的 `runtime-manifest.json`（`core_files` + `core_trees`），**清单只有一份** |

`forbiddenSegments`（同时是投影禁止列表）：`sources`、`.agents`、`.claude`、`.codex`、`hooks`、
`codex-hooks`、`generated-mirrors`、`vibe-coding-skills`、`ask-matt`。

### 4.2 宿主 overlay 契约（本批修正的核心）

Sliver 的 `packaging/runtime-manifest.json` 用 `targets.<host>.overlay_files` 声明「哪个适配文件装到哪个路径」，
落点是**相对运行时 bundle 根**（Sliver 自己 SKILL.md 所在目录）。在 Sliver 自己的包里 bundle 根 == 技能根；
**本仓库把控制面嵌在 `governance/sliver-core/` 下，两者不再重合**，因此 overlay 目标必须重定位进控制面根。

| 宿主 | Sliver 声明 | 我们的最终落点 |
|---|---|---|
| codex | `agents/openai.yaml` | 投影根 `agents/openai.yaml`（插件元数据，宿主按技能根读，**例外不重定位**） |
| codex | `references/studio-codex.md` | `governance/sliver-core/references/studio-codex.md` |
| codex | `references/execution-liveness-host.md` | `governance/sliver-core/references/execution-liveness-host.md` |
| claude-code | `references/runtime-adapter.md`（**覆盖核心同名槽位**） | `governance/sliver-core/references/runtime-adapter.md` |
| claude-code | `assets/project-claude/CLAUDE.md` | `governance/sliver-core/assets/project-claude/CLAUDE.md` |

哈希实证：Claude 投影槽位 = Claude 专用版 `4ec051aed83a`；Codex 投影槽位 = 核心中性版 `4c7b5db64a83`（正确，因为 Codex 不覆盖该槽位）。

---

## 5. 已完成的批次（时间顺序）

| 批次 | 提交 | 做了什么 | 证据 |
|---|---|---|---|
| 1 | `3e14dd3` `1f3c7dc` | 首批 4 个 Vibe 检查器物理导入 + 门禁策略化（逐族 `runtimeEligible`） | `evidence/20260910-vibe-checker-promotion.md` |
| 2 | `8e30d2f` `00451d6` `f1bb034` | 换行可复现性修复（`.gitattributes` 保真树，383 blob 重登记，0 内容漂移） | `evidence/20260910-line-ending-reproducibility.md` |
| 3 | `4fe6951` `33ebb79` `3b360ad` | runtime 单位升级为「目录忠实」（bundlePolicy + 逐文件 sha + 反例） | `evidence/20260910-directory-faithful-runtime-unit.md` |
| 4 | `8e91e72` | **控制面 runtime 闭包**：入口首次真的能在 bundle 里跑（16 → 65 文件） | `evidence/20260910-control-plane-runtime-closure.md` |
| 5 | `955577e` | 记录「Load 列不能放技能路径」这一实测约束 | `tasks/20260910-control-plane-runtime-closure-and-route-binding.md` |
| 6 | `091b6f2` | **路由绑定**：7/7 唯一命中 + 门禁 `3b)` + 7 个反例实测 | `evidence/20260910-route-binding.md` |
| 7 | `ca998d8` `559d7fc` `2ea9fc1` `48f7ab1` `527b1bc` | 目标审计 → 文档纠错 → **安装入口 + 宿主实证** → **退役旧入口** → **overlay 落点修正** | `evidence/20260910-host-install-and-discovery.md` |
| 8 | `4fe8f43` `cb05fb1` `1155d8a` | **T1 选项 A 实施**：宿主中性投影（共享主体抽进 guard，三 writer 薄壳）+ 安装默认 Shared + 门禁 13 步 + DryRun 副作用修复 | `evidence/20260911-host-neutral-shared-projection.md` |
| 9 | `507a07f` | **T2 触发行为实测 + T3 入口修复**：D3 链路全通、紧急检查点通过（包内文件可读可执行）；D2 卡在宿主全局路由块（owner 决定）；入口加「启动动作」第一跳 | `evidence/20260911-trigger-behavior-and-entry-fix.md` |
| 10 | `e224c03` | **owner 确认批**：全局路由块更新（两文件）→ D2 复测转绿（纯中文首动作即调入口，全链路到体检报告）→ T4 接入 tdd/code-review（绑定 9/9）→ 4 个重名链接退役（共享根 180→176，包 96 文件） | `evidence/20260911-d2-green-t4-and-retirement.md` |
| 11 | `6161ddc`..`7c33764` | 闭环批 + T6 解锁：27+2 能力接入（39 条/399 文件）、D2/D3 转绿留档、Hook 契约 v2 解锁 | `evidence/20260911-loop-closure-batch.md`、`evidence/20260911-t6-hook-unlock.md` |
| 12 | 本批 | **治理对齐批**：AGENTS.md 决策写入规则修正、README/SKILL 阶段刷新、Hook 正名（采集面）+ Digest 消化状态机、宿主证据门（verify 5b）+ collector 伪影修复、retired readiness + 退役工具 + `vibe-coding-skills` 别名试点退役、遗留链接清点（64 条） | `evidence/20260911-governance-alignment.md` |
| 13 | 本批 | **能力定批评次**：35 技能全部定编（10+3 接入 / 22 退役），event 分组 + 事件三件套轻量接入，三源链接清零（共享根 147→112），投影 422 文件 | `evidence/20260911-capability-finalization.md` |
| 14 | 本批 | **终态收尾批**：三源项目归档并删除本体（`_archive/` 三个 zip 全等校验）、AGENTS.md/HANDOFF 规则文本对齐「源已归档」事实、SOURCE-INVENTORY/BASELINE 补归档终态、挂远端 `msx2027/feisheng-vibe-coding` 并首次真跑 CI、遗留清单四项收尾（collector 单测 / verify 5b readiness 校验 / OWNER-LEDGER 对齐 / 有界 D1 路径裁决） | `evidence/20260911-source-archive-and-ci.md`、`evidence/20260911-matt-source-dirty-state.md` |

---

## 6. 已拍定的决策（**不要推翻，也不要重新论证**）

| # | 决策 | 理由 / 出处 |
|---|---|---|
| 1 | **单目录形态**：7 个技能不做成独立顶层技能 | 用户明确选择（「不要」），目标是「一个根目录、所有 Agent 共读」 |
| 2 | **Codex 递归暴露嵌套 `SKILL.md` 不修改** | 用户明确指示。代价：Codex 会把包内 9 个 `SKILL.md` 都列出；改名会破坏与来源格式/catalog 路径的一致性 |
| 3 | **旧入口已退役**（8 个：旧控制面 + 7 专项） | 用户批准。共享根 188 → 180 |
| 4 | **选择 A**：共享根装**宿主中性**包（不带任何宿主专属 overlay） | 用户拍定。理由：一个槽位文件无法同时满足两个宿主；Codex 本就不覆盖该槽位，中性版对它才正确。**已实施（2026-09-11，`4fe8f43`+`cb05fb1`，见 `evidence/20260911-host-neutral-shared-projection.md`）** |
| 5 | `assets/` 纳入控制面包（22 文件） | 按 Sliver 自己的 `core_trees`；之前手写清单漏了它们 |
| 6 | 控制面清单**不手写**，从 Sliver 的 manifest 读 | 避免两份清单漂移 |
| 7 | 只接入 4 个 Vibe checker（不是 13 个） | 其余 9 个属 `vibe-original-*` 族：私有分发包、无逐技能许可证文本 |
| 8 | 路由绑定写在 `references/engineering-execution.md` 的 `## Internal Capability Providers` 小节 | 路由表 `Load` 列受 `LOADED_OWNER_IDS`（10 个抽象 owner 类别）校验，塞不进技能路径；该 owner 被 Load 命中 9 次 |
| 9 | 调 Sliver 自带 Python 工具**必须带 `-B`** | 否则生成 `__pycache__` 污染保真树 |
| 10 | 宿主安装走「一个技能目录 + junction 共享根」 | 实测 Claude 与 Codex 都从该根读，装一次两边可见 |

---

## 7. 当前宿主状态（精确）

### 7.1 布局

- `~/.claude/skills` 是**junction** → `F:\skiils工具\_adapters\shared\skills`（宿主技能根，176 条；2026-09-11 退役 4 个重名链接，见 `evidence/20260911-d2-green-t4-and-retirement.md`）
- 我们的包：`.../shared/skills/feisheng-vibe-coding`，**401 文件**（宿主中性投影，含全部 38 个技能）
- `~/.codex/skills` 只有 `.system`（Codex 通过 junction 根读取同一目录）
- 已退役的 8 个旧条目**不在**这个根里了；它们的源仓库仍在原处（可回滚，见 `evidence/20260910-host-install-and-discovery.md` 第 8 节表格）

### 7.2 发现性实测（A/B，方法见 9.2）

| 宿主 | 最初 | 装我们的包后 | 退役旧条目后 |
|---|---|---|---|
| Claude | 169 | 170 | **162**（=169−8+1） |
| Codex | 203 | 212 | **204**（=203−8+9） |

### 7.3 宿主证据（已重采，2026-09-11）

`provenance/HOST-DISCOVERY-EVIDENCE.json` 已由治理对齐批重采并修复采集器：
归属判定从「目录名扫描」改为 **catalog path 精确匹配**（修复了 `vibe-code-review` 因目录名相同被记成
Matt 版已装、以及控制面被记 not-installed 两个伪影）。当前口径：39 条 admitted 全部经统一包
model-visible（`visibleVia=unified-bundle`）；顶层目录态另记录遗留链接暴露（`installedInSharedRoot`）。
历史版本（capturedAt 2026-09-10T11:39 / 19:32）只入 git 历史，不要再引用。

---

## 8. 未验证清单（不要越界声明）

- 宿主 **trust** —— `UNVERIFIED`；Hook：**纠错信号采集面已启用**（SessionStart 待消化提醒 + UserPromptSubmit 采集 + `-Mode Digest` 消化标记，见 9.6/9.8），但宿主 fresh-session 冒烟无仓库内留痕物，维持 `UNVERIFIED`；治理门禁事件有意禁用
- ~~纯自然语言自动触发（D2）：未达成~~ **已转绿（2026-09-11）**：owner 批准更新宿主全局路由块后，纯中文需求首动作即调用统一入口（证据见第 1 节注与 `evidence/20260911-d2-green-t4-and-retirement.md`）
- `-p` 会话中技能**描述**是否进入模型决策上下文 —— UNVERIFIED（模型自述没有；无宿主日志可证）
- ~~发布 CI **从未在真实 GitHub runner 跑过**（本地已等价复现 fresh clone 情形）~~ **已转绿（2026-09-11）**：
  仓库已挂远端 `msx2027/feisheng-vibe-coding`（private），`.github/workflows/release-gate.yml` 已真实运行；
  运行链接与结论见 `evidence/20260911-source-archive-and-ci.md`。CI 按设计**不带 `-IncludeHostEvidence`**（无宿主环境）
- 宿主侧对 `assets/` 模板的实际使用 —— 未验证（`agents/openai.yaml` 只属宿主专属投影，共享根已不含）

---

## 9. 后续任务（按优先级，goal 推进顺序）

### 9.1 T1【已完成 2026-09-11】**实施选项 A：宿主中性安装**

已实施：中立 builder `build-shared-runtime-projection.ps1` + 安装默认 `Shared` + 门禁第 6 步扩为三投影。
验收全过（无宿主专属文件、槽位 = 核心中性版哈希一致、共享根重装成功、verify 13/13、fresh clone 四组合 13/13）。
证据：`evidence/20260911-host-neutral-shared-projection.md`。实现要点留档：

- 共享主体抽成 guard 模块的 `Invoke-RuntimeProjection`（参数：plan 差异、manifest 名、schema、输出根、
  overlay 目标、hostAdapter、结果附加字段），三个 writer 都是薄壳；没有第三个复制版 builder。
- 实施中发现并修复：带 `-Force` 的 DryRun 会删掉旧安装（`cb05fb1`）——DryRun 现在只读。

### 9.2 T2【已完成 2026-09-11】**触发行为验证**（D2/D3 的唯一证据来源）

实测结论（全部 stream-json 观察证据，见 `evidence/20260911-trigger-behavior-and-entry-fix.md`）：
- **D3 全通**：显式引用入口后，宿主注入 SKILL.md + base directory；模型读控制面 SKILL.md、中性 runtime-adapter.md、
  执行 `runtime_decision_contract.py route-catalog`、选中主路由「项目体检」、查投影、加载 owner（routes-intake.md）并实际体检。
- **紧急检查点通过**：宿主能读、能执行包内非 SKILL.md 文件（单目录形态成立，不需要停下来重新决策）。
- **D2 未达成**：纯中文需求不自动触发。根因 ①宿主全局内存 `~/.claude/CLAUDE.md` 旧路由块主动把工程需求引向
  独立 `tdd`/`code-review` 等条目（仓库外，owner 决定）；②共享根仍有 4 个竞争性旧顶层技能
  （退役须等 T4 把 tdd/code-review 接入后配套做，防能力回退）；③薄壳入口缺第一跳指针（已修，见 9.3）。
- Codex 侧可用性复测：204 条目含我们根入口 + 控制面 + 7 个嵌套条目（`sliver-vibe-coding` 名字出现 = 决策 #2 已知代价）。

### 9.3 T3【已完成 2026-09-11】**按 T2 的结果修触发**

- ✅ 已修（`507a07f`）：入口 SKILL.md 增加「启动动作」——第一条指令指向 `governance/sliver-core/SKILL.md` 的
  Startup Protocol，并禁止跳过控制面直接作答。对「技能已被引用」的一切路径生效。
- ⏸️ 未动（等 owner）：入口 description 已符合触发面最佳实践（中英文触发语句都在），但探测显示 `-p` 会话里
  描述是否在决策时可见本身 UNVERIFIED，盲目改描述无法验证，不折腾。
- ⏸️ owner 决定项：更新 `~/.claude/CLAUDE.md`（及镜像 `C:\Users\MSX\AGENTS.md`）的「Skills 路由规则」块，
  把统一入口 `feisheng-vibe-coding` 立为项目级请求的第一路由——这是 D2 转绿的关键一步（建议文案已给 owner）。

### 9.4 T4【已完成 2026-09-11】**阶段 2 收尾**：`tdd` / `code-review`

已接入（`e224c03`，见 `evidence/20260911-d2-green-t4-and-retirement.md`）：从 `9fe7e7a3` 快照逐字节导入
`skills/engineering/`、writeAuthority=none、绑定表 9/9、NOTICE 过、门禁 13/13 + fresh clone 四组合全过。
「宿主行为 smoke」阻塞由统一入口链路实测解除。共享根 4 个重名链接已退役（源仓库未动，回滚命令在证据里）。
注意：共享根其余 ~~~66 个~~~ **64 个**源仓库链接**未动**（阶段 5 口径待 owner 定；精确清点见 9.7）。

### 9.5 T5 ~~阶段 4 批次~~【已被闭环批超越 2026-09-11】

本节的原口径（"4 条已接入 / 18 条待接 / 24 条被许可证挡住"）已被闭环批（`8c800d7`）推翻：
owner 对 `vibe-original-*` 族做了自用豁免后，一批接入 27 条，Vibe 现共 33 条已接入。
剩余 13 条的留待原因见第 14 节；后续新批次以第 14 节为准，不要再按本节旧数字推进。

### 9.6 T6【已完成 2026-09-11；口径已在治理对齐批精确化】**Hook 解锁**（纠错信号采集启用；治理门禁保持禁用）

owner 授权「解锁，做全套安全门」后完成（`6311bc9`，见 `evidence/20260911-t6-hook-unlock.md`）：
- 启用面：SessionStart（只读**待消化**提醒）+ UserPromptSubmit（纠错信号采集，白名单内追加）；治理门禁事件禁用（exit 3）
- 六项门槛全 PASS：许可证（owner 自用豁免）、快照 revision、宿主发现性（重采）、事件顺序/并发
  （含幂等过期、junction 逃逸负面用例）、写白名单（规范化先行 + reparse 祖先守卫封顶 TargetRoot）+ 回滚、
  独立子代理审查两轮（APPROVE-WITH-FINDINGS，P1 已闭合）
- **口径修正（2026-09-11 治理对齐批）**：T6 的"解锁"指**采集面**。当时证据文件里"真实会话冒烟（两次）"
  在仓库内外均无留痕物（安装器按设计拒绝装进本仓库，产物外置不可复核），按 AGENTS.md 验收规则
  `freshSessionSmoke` 维持 `UNVERIFIED`；"经验沉淀闭环"的说法收缩为"纠错信号采集已启用"。
- 遗留（部分已在 9.8 补上）：沉淀消费三技能（experience-elevator / evolution-engine / feedback-writer）
  的技能级接入仍待后续批次；消化动作现可由 runner `-Mode Digest` 做状态标记（见 9.8）

### 9.7 T7【部分完成 2026-09-11】**收尾清理**

- ✅ `provenance/HOST-DISCOVERY-EVIDENCE.json` 已重采（~~60 模型可见 / 14 仅安装 / 8 应缺席~~ 本批 T7 时点数字；治理对齐批已按 path 精确归属再次重采为 **39 / 25 / 8 / 10**，见 7.3，以新数字为准）
- ✅ 本批文档一致性：交接文档数字、能力索引、 packaging 策略同步
- ⏸️ `_smoke/` 清理：等 owner 真人测试通过后统一删（探测脚手架可能复用）
- ⏸️ 新接入技能 frontmatter 描述里的旧入口名（`vibe-coding-skills`）：委派不受影响；改名需动导入保真机制，暂缓
- ⏸️ 共享根其余 ~~~66 个~~ **64 个**源仓库链接退役：阶段 5，需 owner 口径（精确清点见 `scripts/audit-host-legacy-links.ps1` 输出，快照 `_smoke/host-legacy-links-20260911.json`）
- 若 T2 推翻了形态决策，回头更新第 6 节决策日志（标注被推翻的原因）

### 9.8 GA【已完成 2026-09-11】**治理对齐批**（6 子 Agent 交叉复核后的五项修复）

owner 批准的五个优先级修复，全部完成并通过 `verify.ps1 -IncludeHostEvidence -IncludePackage` 14/14（见 `evidence/20260911-governance-alignment.md`）：

- **F1 口径对齐**：AGENTS.md 决策唯一写入点改为 `SKILL-CLASSIFICATION.json`（catalog 明确为只能再生的投影）；
  README/SKILL.md 阶段刷新到闭环后；verify 头注释、能力索引模板、packaging hook 段全部精确化；本文档 6 处内部矛盾清理。
- **F2 T6 正名 + 消化状态机**：契约加 `enablementScope`/`digestion`；runner 新增 `-Mode Digest`
  （40 位十六进制 dedupKey 严格校验后写 `<dedupKey>.digested` 标记；SessionStart 只报 `PENDING=` 未消化数）；
  测试补 Digest/恶意 dedupKey/幂等用例。
- **F3 纸面门变脚本门**：collector 归属判定改 catalog path 精确匹配（修复控制面 not-installed 与
  `vibe-code-review` 重名两个伪影，新增 `visibleVia`/`sharedRootEntryKind` 字段）；
  verify 新增 `-IncludeHostEvidence` 宿主证据门（证据新鲜度 + admitted 不得 not-installed + 统一包影子入口检测）。
- **F4 退役状态化**：`alias|retired → retired-alias` 策略行；`scripts/retire-capability.ps1`
  （fail-closed：缺策略行即拒；文本手术编辑 + 重生成 + 绑定校验）；试点退役 `vibe-coding-skills` 别名；
  `scripts/audit-host-legacy-links.ps1` 清点共享根：**64 个源仓库链接**（退役口径待 owner）、83 个与本项目无关链接（不动）、28 个普通目录。
- **F5 CI/remote 准备**：gh CLI 已认证（msx2027，repo+workflow scope）；远端仓库的创建/推送是外发动作，
  由 owner 决定名称与可见性后执行：
  ```powershell
  gh repo create <owner>/<name> --private --source . --remote origin --push
  # push 后 .github/workflows/release-gate.yml 即在每次 push/PR 自动跑 verify.ps1（注意 CI 无宿主环境，勿加 -IncludeHostEvidence）
  ```

GA 批后遗留（按优先级）：

| # | 遗留项 | 状态 | 证据/追踪 |
|---|---|---|---|
| 1 | 沉淀消费三技能迁移批次 | ⏸️ 未动 | 需许可证族决策 + statusPolicy + 绑定变更 |
| 2 | 64 个源仓库链接退役口径 | ✅ **已完成** | 三源链接清零（回滚记录 `_smoke/retire-{29,35}-rollback.json`） |
| 3 | 挂远端让 CI 真跑 | ✅ **已完成** | `msx2027/feisheng-vibe-coding`（private），运行链接见 `evidence/20260911-source-archive-and-ci.md` |
| 4a | OWNER-LEDGER 结构性议题 | ✅ **已对齐** | Sliver 实体已登记、裁决 owner 落点已补、skill-catalog path 已指向 `SKILL-CLASSIFICATION.json` |
| 4b | SOURCE-INVENTORY 状态停格 | ✅ **已对齐** | 补「归档终态」记录，与 AGENTS.md 口径一致 |
| 4c | LOCAL-PATCHES owner 字段悬空 | ✅ **已对齐** | owner 字段改为 "provenance-integrity"（ledger 已含） |
| 5 | collector 无单元测试 | ✅ **已补** | `tests/test-collector-path-resolution.ps1`（path 归属 + 布尔恒真回归） |
| 6 | verify 5b 不比对 readiness 漂移 | ✅ **已补** | 新增 `readiness` 字段内容级校验（admitted 必须 `accepted-*`，retired 必须 `retired-*`） |
| 7 | 有界 D1 路径不加载 engineering-execution.md | ✅ **已裁决** | 该路径为「独立技能显式调用」专用，不加载路由表是设计意图；已在 `references/engineering-execution.md` 加注释说明 |

**未改变边界**：
- 宿主 trust —— `UNVERIFIED`
- 逐技能行为质量 —— `UNVERIFIED`（用一次验一次）
- Hook fresh-session 冒烟 —— `UNVERIFIED`（无仓库内留痕物）
- `-p` 会话中技能描述是否进入模型决策上下文 —— `UNVERIFIED`
终审新增 P3：`packaging/runtime-projection.json` 的 `hostDiscovery` 段已加"历史时点快照"标注（描述的是退役前的
sliver 顶层条目时代）；`contract.json` status id 字面含 "sedimentation"（有意保留，改 id 需同步历史证据引用面）。

### 9.9 D1【已完成 2026-09-11】**owner 拍板：退役 29 个双重曝光链接 + 源项目终态路线**

owner 审计后拍板：29 个「已接入统一包但旧链接还在」的链接全部退役；vibe-coding-skills 为
**owner 本人开发**；matt 的 4 个脏文件是 owner 本人胡乱改的，不需要保留；AGENTS.md 规则文本可随事实修改
（源项目实际删除时再改写）。已执行：
- 29 个链接退役（`os.rmdir`，安全断言：必须为指向三源的 reparse 链接）；共享根 176 → **147**
- 回滚记录：`_smoke/retire-29-rollback.json`（name → linkType → target，逐条可重建）
- 重采宿主证据：39 条 admitted 仍全部经统一包 model-visible（零能力丢失）；门禁 14/14
- 剩余 35 个链接 = 35 个未接入技能的现役服务，待 owner 按下方路线第 2 步逐个「接入或退役」

**源项目终态路线（owner 已批终态 = 只保留 feisheng-vibe-coding 一个文件夹）**：
1. ✅ 29 链接退役（D1 批）
2. ✅ 35 技能全部定编（能力定批评次：13 接入 + 22 退役，裁决表见 `evidence/20260911-capability-finalization.md`）
   → 剩余 35 个源链接已全部退役（回滚记录 `_smoke/retire-35-rollback.json`），**三源链接清零**，投影重装 422 文件
3. ✅ 三源项目归档 + 规则文本对齐（本批）：三个源项目 zip 冷存 `F:\skiils工具\_archive\`
   （逐文件 sha256 + CRC 全等校验通过），**本地源目录已删除**；AGENTS.md「不修改源项目」改写为
   「源已归档、`sources/` 快照为唯一内容真源」；HANDOFF §10 两条边界按新事实改写。
   归档前状态证据：`evidence/20260911-matt-source-dirty-state.md`（matt 4 个脏文件如实记录）；
   批次证据：`evidence/20260911-source-archive-and-ci.md`。
   `sources/` 仓库内快照**永远保留**（未来接入唯一内容源，import 脚本只读快照，
   `import-vibe-skills.ps1`、`import-matt-source.ps1`）。

---

## 10. 不可突破的边界

- **仓库内 `sources/` 快照永不删除、永不改写**——它是唯一内容真源，也是未来接入的唯一来源
  （导入脚本 `import-vibe-skills.ps1` / `import-matt-source.ps1` / `import-sliver-core.ps1` 只读它）
- **归档 zip 是只读历史**（`F:\skiils工具\_archive\*.zip`）：不得解包回去当来源、不得在其上做迁移、不得删除
- **共享根里与本项目无关的 83 个链接和 28 个目录不要动**；本项目相关的源仓库链接已于 2026-09-11 全部退役
  （三源链接清零，回滚记录 `_smoke/retire-{29,35}-rollback.json`）
- 本仓库**自持，不依靠任何上游**：不产出上游 issue，不等上游确认；差异只作事实记录
- **不手工编辑生成物**；改分类/裁决只改 `provenance/SKILL-CLASSIFICATION.json`
- 不把 Vibe 的 `.claude/`/`.agents/`/`.codex/` 镜像当源码或运行时内容
- 不把混合第三方许可证并成根许可证；不改许可证族策略去迁就某个技能
- 修改 vendored 内容必须先登记 `LOCAL-PATCHES.json`（含 `originalSha256`）→ 再 `record-provenance-integrity.ps1`
- 路由绑定只能有一个 owner（`classification.routeBinding.ownerFiles`）；不得在 `routes-index.md` 的 `Load` 列、
  根 `SKILL.md`、README 或适配器里平行再写一份
- 保真树必须保持 `.gitattributes` 的 `-text`；**不得**把 sha 比对改成 eol 归一化
- 测试脚手架只放 `<repo>/_smoke/`；不覆盖宿主既有技能
- 没有新鲜验证不得声明完成、可发布、宿主已强制生效

---

## 11. 踩坑清单（照抄省时间）

1. **heredoc 会吞反斜杠** → 用正斜杠或 `DirectorySeparatorChar`；Python 里路径别以 `\` 结尾再接引号
2. **`@()` 经 if/函数返回值会解包成标量** → 函数返回的集合在调用处统一 `@()` 包裹
3. **`[ordered]@{}` 没有 `ContainsKey`** → 用普通 `@{}`
4. **`Sort-Object` 是 culture 排序** → 用 `[System.StringComparer]::Ordinal`
5. **含中文的 `.ps1` 必须 UTF-8 BOM**（`write` 工具写的没有，事后补）→ 否则 PS 5.1 按 GBK 解码
6. **调 Sliver 的 Python 工具必须带 `-B`** → 否则 `__pycache__` 污染保真树
7. **`Join-Path $a 'x/' + $b` 会把 `+` 当字面参数** → 写成 `Join-Path $a ('x/' + $b)`
8. **投影禁止 `sources` 段** → 要提升技能必须先物理导入到 `skills/` 一等位置
9. **NOTICE 门禁读逐族 `runtimeEligible`**，不硬编码 Vibe 标志
10. **`core.autocrlf=true`**：提交会警告换行改写 → **每次提交后重跑门禁**
11. **宿主布局**：`~/.claude/skills` 是 junction → 共享根；Codex 读同一根；**删 junction 只能用 `os.rmdir`**（`shutil.rmtree` 会报错，`cmd rmdir` 在中文路径下失败）
12. **`codex debug prompt-input` 输出里换行是转义的两字符** → 解析前先还原
13. **`disable-model-invocation: true` 的技能不出现在模型可见清单**；Codex 似乎不认这个字段
14. **可能存在并行写入者** → 动手前先 `git status`
15. **`ConvertFrom-Json` 会把单元素数组解包成标量** → 遍历统一 `@()` 包裹
16. **新增 `accepted` 的 Vibe 技能顺序**：改 classification（含 `sourceDir`、`writeAuthority`）→ `import-vibe-skills.ps1` → 重生成 catalog/index → 门禁
17. **`git ls-files --eol` 格式**：`i/<eol>` `w/<eol>` `attr/<attr>` 用**空格对齐** + 一个 TAB + 路径；只按 TAB 切会**每行跳过 → 门禁假通过**；比较前剥掉 `i/`、`w/` 前缀；必须加「解析行数 == 输入行数」自检
18. **保真树换行**：`sources/**`、`skills/**`、`governance/sliver-core/**` 由 `.gitattributes` 固定 `-text`
19. **大范围 blob 改写必须附等价证明**：逐文件测「工作树字节未变 / 索引==工作树 / 归一化后相同」
20. **runtime 单位是目录**：技能目录内新增/删除/修改任何文件都必须重生成 catalog 并提交（否则 catalog 同步与内容完整性门禁失败）
21. **本机绿不是证据，fresh clone 才是**：生成器里的多行字面字符串会让生成物继承脚本源码换行 → fresh clone 才暴露
22. **路由表的 `Load` 列不是文件清单**：`LOADED_OWNER_IDS` 是 10 个抽象 owner 类别；`"skill"` 在该脚本里出现 0 次；塞技能路径会 `raise`
23. **改 vendored 内容的正确姿势**：登记 `LOCAL-PATCHES.json` → 跑 `record-provenance-integrity.ps1`（它**接受**已登记补丁：快照须等于 `patchedSha256`、来源须仍等于 `originalSha256`）；顺序反了会被拒
24. **改 vendored 文件要保住原换行**：逐字节插入后 `git diff --stat` 应只显示新增行、**0 删除**
25. **PowerShell stdout 编码随「重定向到文件」与「管道捕获」而变**（文件里 GBK、管道像 UTF-8）→ 机器可读 JSON 的判定字段用 ASCII（`status`），中文只放 Detail
26. **比较两种 shell 的步骤数必须传相同参数**：`-IncludePackage` 与否差一步（11 vs 12）
27. **overlay 落点必然要重定位**：Sliver 的 overlay 目标相对「运行时 bundle 根」，我们把控制面嵌在 `governance/sliver-core/` 下，两者不重合；不重定位就等于**没覆盖槽位**（`references/runtime-adapter.md` 的教训）
28. **验证要看「谁真正读那个文件」**：只比对输出目录里同名文件的哈希是不够的 —— 必须确认它落在**协议实际解析的路径**上（我因此错过一次）
29. **安装脚本要 fail-closed**：拒绝覆盖非本仓库标记的目录；装完用 builder 的 `Validate` 复核**已安装目录**，不只看源
30. **共享根不能承载宿主专属适配**：一个槽位文件放不了两个宿主的内容（Claude 专用版与核心中性版差 58 行，且 Codex 不覆盖该槽位）→ 共享根用中性版
31. **`[string]` 套在布尔表达式上会把条件变成恒真**：`[string]$x.EndsWith(...)` 转换的是**整个方法调用结果**，布尔被转成 `"True"/"False"` 字符串，而非空字符串在 PowerShell 里是真值 → 条件永远成立（GA 批 collector 真实踩过：82 条记录全部误匹配 231 条目）。判定必须先赋给布尔变量再进 if
32. **同一份数据别让两种匹配规则并存**：目录名匹配会认领重名技能（vibe `code-review` ↔ Matt `code-review`），宿主归属判定一律用 catalog path 精确匹配（GA 批已改，见 `collect-host-skill-evidence.ps1`）

---

## 12. 入口速查

```
真源
  provenance/SKILL-CLASSIFICATION.json   分类 + 裁决 + runtimePromotionPolicy + routeBinding
  provenance/LICENSE-MAP.json            许可证台账（9 族）
  provenance/LOCAL-PATCHES.json          本地补丁登记
  provenance/OWNER-LEDGER.json           owner 机器可读
  .gitattributes                         保真树 -text（提交字节 == 来源字节）
生成物（禁止手工编辑）
  provenance/CANONICAL-CATALOG.json / docs/CAPABILITY-INDEX.md / provenance/PROVENANCE-INTEGRITY.json
门禁
  scripts/verify.ps1                     单入口（默认 12 步；-IncludeHostEvidence / -IncludePackage 各 +1）
  scripts/runtime-projection-guard.ps1   共享投影门禁 + 计划 + overlay 实现（唯一）
  scripts/validate-release-notices.ps1   NOTICE（逐族策略）
  scripts/validate-route-bindings.ps1    路由绑定（唯一命中 / 不得第二入口）
  scripts/build-canonical-catalog.ps1    分类 → catalog（bundlePolicy + bundlePathsFrom fail-closed）
退役 / 宿主清点
  scripts/retire-capability.ps1          单技能退役（fail-closed；翻 readiness + 重生成 + 绑定校验）
  scripts/audit-host-legacy-links.ps1    共享根顶层条目清点（只读；阶段 5 口径输入）
导入 / 投递
  scripts/import-vibe-skills.ps1         Vibe 技能物理导入（唯一路径）
  scripts/import-{matt-source,sliver-core,vibe-source}.ps1  来源快照导入
  scripts/install-runtime-projection.ps1 宿主投递（-DryRun / -Force / -Uninstall）
宿主 smoke（消耗真实额度，不接入 verify）
  scripts/smoke-host-skill-discovery.ps1
  scripts/collect-host-skill-evidence.ps1
```

常用命令：

```powershell
# 一键全套门禁（提交后必须重跑）
pwsh -NoProfile -File 'scripts/verify.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' -IncludePackage

# 宿主投递（干跑 / 安装 / 卸载）
pwsh -NoProfile -File 'scripts/install-runtime-projection.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' -DryRun
pwsh -NoProfile -File 'scripts/install-runtime-projection.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' -Force
pwsh -NoProfile -File 'scripts/install-runtime-projection.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' -Uninstall

# 改 vendored 内容（顺序不能反）
# 1. 改 governance/sliver-core/**  2. 登记 LOCAL-PATCHES.json（originalSha256 + patchedSha256）
pwsh -NoProfile -File 'scripts/record-provenance-integrity.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'
pwsh -NoProfile -File 'scripts/build-canonical-catalog.ps1' -RepoRoot 'F:\skiils工具\feisheng-vibe-coding'

# 新增 runtime 技能后的路由绑定（门禁 3b 会强制）
pwsh -NoProfile -File 'scripts/validate-route-bindings.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'

# 唯一可信的验收方式
git clone <repo> <新目录>; cd <新目录>; pwsh -NoProfile -File 'scripts/verify.ps1' -IncludePackage
```

---

## 13. 新会话起点检查清单

```powershell
cd F:/skiils工具/feisheng-vibe-coding
git log --oneline -3                      # 终态收尾批（2026-09-11）之后的提交
git status --porcelain                    # 应为空
pwsh -NoProfile -File 'scripts/verify.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' -IncludeHostEvidence -IncludePackage
                                          # 应为 14/14
ls 'F:/skiils工具/_adapters/shared/skills' | wc -l     # 应为 112（2026-09-11 定编批退役全部 64 个源链接后）
ls -d 'F:/skiils工具/sliver-vibe-coding' 'F:/skiils工具/vibe-coding-skills' 'F:/skiils工具/mattpocock-skills'
                                          # 应全部 not found（源项目已归档删除）
ls 'F:/skiils工具/_archive'               # 应有三个 *-20260911.zip
```

然后按顺序：T1–T7 与 GA 批均已完成。后续入口：**9.8 末尾的遗留清单**（沉淀消费三技能批次 →
OWNER-LEDGER/E1 有界路径剩余议题）；源项目归档、CI 上线、64 链接退役、D2/D3 转绿均已完成（见批次表）；
新增能力接入照 §11 #16 的顺序。

---

## 14. 能力构成现状（82 条的构成）

| 来源 | 登记 | 已接入 | 说明 |
|---|---|---|---|
| sliver-vibe-coding | 1 | **1** | 控制面（22 主路由 + 8 lens 是 `references/*.md`，非独立技能） |
| vibe-coding-skills | 46 | **33** | 2026-09-11 闭环批后：checker 4 + product 13（含 dev-builder 编码主手）+ ui 16 已接入；13 个留待后续（Hook 驱动 3、MCP 依赖 2、语义未审 3、真源重叠 2、职能重叠 1、边缘 1、别名 1 已于 GA 批退役）；许可证族经 owner 豁免（自用） |
| mattpocock-skills | 35 | **5** | 4 个原语 + code-review（checker）已接入（2026-09-11）；10 个 source-only-primitive；7 个 adapter-candidate；6 个 excluded（上游 in-progress）；6 个 user-tool；1 compat |

```text
技能集合   82/83     几乎全量（差 1 个翻译维护技能）
功能裁决   11/11 簇  已完成（duplicateGroups）
交付runtime 39/82     39 条记录 / 399 文件（控制面 75 + 38 技能 324）
路由绑定   38/38      已接入技能全部唯一命中
许可证策略 9 族全显式 4 族 runtimeEligible=true、5 族 false
交付宿主   1 个入口   Claude 已确认（+1）；Codex 会额外列出包内 9 个 SKILL.md（用户决定不改）
行为验证   D2/D3 已实测转绿（2026-09-11，见 9.2 与 evidence/20260911-*）
退役       1 条 retired-alias（vibe-coding-skills 别名，GA 批）+ 64 个源仓库链接待 owner 口径
```
