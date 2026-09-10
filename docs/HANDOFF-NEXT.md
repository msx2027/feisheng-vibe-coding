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
| D4 | **门禁全绿** | `verify.ps1 -IncludePackage` = 12/12，且 **fresh clone** 下 12/12（`autocrlf` true/false × pwsh/PS5.1） |
| D5 | **无回归** | 路由绑定、投影、NOTICE、来源快照完整性、保真树换行全部保持通过 |
| D6 | **诚实** | 未验证项明确标注 `UNVERIFIED`，不用推断代替证据；不声称宿主 trust / Hook 已生效 |

**注意**：D2/D3 是当前**最大的未知**，也是唯一还没做的事。前面所有工作（catalog、门禁、投影、路由绑定、闭包、安装）都是为这三条铺路。

---

## 2. 一分钟现状（数字快照）

- 仓库：`F:/skiils工具/feisheng-vibe-coding`，分支 `main`，工作树干净，最新提交 `527b1bc`
- 门禁：`pwsh scripts/verify.ps1 -IncludePackage` = **12/12**；fresh clone 两种 shell × 两种 `autocrlf` 均 12/12
- 分类：**82 条记录**，其中 **8 条 runtime 已接入**（控制面 1 + Matt 原语 3 + Vibe 检查器 4）
- 路由：22 条主路由 / 31 个 operation / **8 个 lens**（`lens-catalog` 实测）
- 路由绑定：**7/7**（每条已接入技能在路由 owner 里唯一命中，门禁步骤 `3b)` 强制）
- 控制面包：**75 文件**（9 core_files + 44 references + 22 assets），runtime bundle 共 **90** 文件
- 宿主（本机）：共享根 `F:\skiils工具\_adapters\shared\skills`（`~/.claude/skills` 是它的 junction）**180 条**，其中我们的包 `feisheng-vibe-coding` **93 文件**
- 宿主发现性实测：Claude **162** 个技能（含我们 1 个入口）；Codex **204**（含我们包内 9 个 `SKILL.md`）
- 存量：`evidence/` 38、`tasks/` 37、`scripts/` 20

---

## 3. 总背景

### 3.1 这是什么

把三个**只读**来源项目统一成一个项目级入口，同时保留各自必要的分发边界：

| 来源 | 仓库 | 角色 | 状态 |
|---|---|---|---|
| `sliver-vibe-coding` | `F:\skiils工具\sliver-vibe-coding` | 控制面：路由、任务深度、风险、授权、真源、测试、验收 | 已快照导入 `governance/sliver-core/`（220 文件） |
| `vibe-coding-skills` | `F:\skiils工具\vibe-coding-skills` | 产品/UI/专项 checker | 已快照（553 文件），46 条登记 |
| `mattpocock-skills` | `F:\skiils工具\mattpocock-skills` | 工程原语（TDD、调试、领域建模、模块设计、review） | 已快照（136 文件），35 条登记 |

**三个来源仓库绝对不可修改**（只读）。

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
| 2 工程原语 | 🟡 3/5（`diagnosing-bugs`/`codebase-design`/`domain-modeling` 已接入；`tdd`/`code-review` 待宿主行为 smoke；7 个 adapter-candidate 未接） |
| 3 宿主适配 | 🟡 **投递已打通、行为未验证**（本批新建安装入口并装上，拿到「被识别」级证据） |
| 4 产品/UI/第三方 | 🟡 早期（Vibe 46 条里只接 4 条） |
| 5 灰度退役 | 🟡 旧入口已退役（本批），但新入口行为尚未验证 |

---

## 4. 当前架构（真源 → 生成物 → 门禁 → 投影 → 安装）

```text
真源（人写）
  provenance/SKILL-CLASSIFICATION.json   分类 + 裁决 + runtimePromotionPolicy + routeBinding
  provenance/LICENSE-MAP.json            许可证台账（9 族，逐族 runtimeEligible）
  provenance/LOCAL-PATCHES.json          本地补丁登记（未登记偏差即漂移）
  provenance/OWNER-LEDGER.json           owner 机器可读记录
  provenance/HOST-DISCOVERY-EVIDENCE.json 逐技能宿主证据（注意：已过期，见 7.3）
  .gitattributes                         保真树 -text + scripts/** eol=lf

生成物（禁止手工编辑）
  provenance/CANONICAL-CATALOG.json      （82 条；bundlePolicy + 每条 bundle.files 逐文件 sha256）
  docs/CAPABILITY-INDEX.md
  provenance/PROVENANCE-INTEGRITY.json

门禁（scripts/verify.ps1，单入口，12 步）
  1 catalog 同步 · 1b runtime include 内容完整性 · 1c 导入副本一致性 · 1d 保真树换行
  2 capability index 新鲜度 · 3 来源快照完整性 · 3b 路由绑定 · 4 NOTICE
  5 Vibe Hook 保持禁用 · 6 Codex 投影 · 7 Claude 投影 · 8 发布包（-IncludePackage）

投影（runtime-projection）
  scripts/build-codex-runtime-projection.ps1    → 95 文件
  scripts/build-claude-runtime-projection.ps1   → 93 文件
  scripts/runtime-projection-guard.ps1          共享门禁/计划/overlay 实现（唯一）
  packaging/runtime-projection.json             策略描述

安装
  scripts/install-runtime-projection.ps1        宿主投递入口（本批新增）
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

---

## 6. 已拍定的决策（**不要推翻，也不要重新论证**）

| # | 决策 | 理由 / 出处 |
|---|---|---|
| 1 | **单目录形态**：7 个技能不做成独立顶层技能 | 用户明确选择（「不要」），目标是「一个根目录、所有 Agent 共读」 |
| 2 | **Codex 递归暴露嵌套 `SKILL.md` 不修改** | 用户明确指示。代价：Codex 会把包内 9 个 `SKILL.md` 都列出；改名会破坏与来源格式/catalog 路径的一致性 |
| 3 | **旧入口已退役**（8 个：旧控制面 + 7 专项） | 用户批准。共享根 188 → 180 |
| 4 | **选择 A**：共享根装**宿主中性**包（不带任何宿主专属 overlay） | 用户拍定。理由：一个槽位文件无法同时满足两个宿主；Codex 本就不覆盖该槽位，中性版对它才正确。**待实施，见 9.1** |
| 5 | `assets/` 纳入控制面包（22 文件） | 按 Sliver 自己的 `core_trees`；之前手写清单漏了它们 |
| 6 | 控制面清单**不手写**，从 Sliver 的 manifest 读 | 避免两份清单漂移 |
| 7 | 只接入 4 个 Vibe checker（不是 13 个） | 其余 9 个属 `vibe-original-*` 族：私有分发包、无逐技能许可证文本 |
| 8 | 路由绑定写在 `references/engineering-execution.md` 的 `## Internal Capability Providers` 小节 | 路由表 `Load` 列受 `LOADED_OWNER_IDS`（10 个抽象 owner 类别）校验，塞不进技能路径；该 owner 被 Load 命中 9 次 |
| 9 | 调 Sliver 自带 Python 工具**必须带 `-B`** | 否则生成 `__pycache__` 污染保真树 |
| 10 | 宿主安装走「一个技能目录 + junction 共享根」 | 实测 Claude 与 Codex 都从该根读，装一次两边可见 |

---

## 7. 当前宿主状态（精确）

### 7.1 布局

- `~/.claude/skills` 是**junction** → `F:\skiils工具\_adapters\shared\skills`（宿主技能根，180 条）
- 我们的包：`.../shared/skills/feisheng-vibe-coding`，**93 文件**（Claude 投影）
- `~/.codex/skills` 只有 `.system`（Codex 通过 junction 根读取同一目录）
- 已退役的 8 个旧条目**不在**这个根里了；它们的源仓库仍在原处（可回滚，见 `evidence/20260910-host-install-and-discovery.md` 第 8 节表格）

### 7.2 发现性实测（A/B，方法见 9.2）

| 宿主 | 最初 | 装我们的包后 | 退役旧条目后 |
|---|---|---|---|
| Claude | 169 | 170 | **162**（=169−8+1） |
| Codex | 203 | 212 | **204**（=203−8+9） |

### 7.3 已知过期物（引用前必须重采）

`provenance/HOST-DISCOVERY-EVIDENCE.json` 的 `capturedAt` 是 `2026-09-10T11:39:40Z`，
比 Vibe 检查器接入提交（`3e14dd3`，20:14 +0800）**早约 34 分钟**。它记录的 4 个 checker 仍写 `source-only`，
且描述的是「控制面 1 文件时代」的 bundle。**不得**当作当前运行时集合的宿主证据。

---

## 8. 未验证清单（不要越界声明）

- 宿主 **trust**、技能**真实行为**、**Hook 强制** —— 三者均 `UNVERIFIED`
- **自然语言触发是否真的按控制面选到正确路由** —— 只有「被识别」级证据（技能出现在清单里），**没有行为级证据**
- 控制面协议里那些相对路径（`references/…`、`scripts/…`）在**真实宿主会话中是否真的可读/可执行** —— 未验证
- 发布 CI **从未在真实 GitHub runner 跑过**（本地已等价复现 fresh clone 情形）
- 宿主侧对 `assets/` 模板、`agents/openai.yaml` 插件的实际使用 —— 未验证

---

## 9. 后续任务（按优先级，goal 推进顺序）

### 9.1 T1【立即】**实施选项 A：宿主中性安装**（已决策，只差执行）

**目标**：共享根里装**不含任何宿主专属 overlay** 的包 —— 即核心中性 `governance/sliver-core/references/runtime-adapter.md`，
且**不含** `agents/openai.yaml`、`references/studio-codex.md`、`references/execution-liveness-host.md`、
`assets/project-claude/CLAUDE.md`。

**做法（提示，不强制）**：
- 中立投影 = guard 模块里 `Get-ProjectionPlan` 的基础计划（控制面 + 已接入技能，**无宿主 overlay**）+ manifest。
- ⚠️ **不要**再写第三个 builder 复制 ~200 行：实测两个 builder 的主体 230 行里只有 28 行不同（差异只在 codex/claude 命名与 manifest 名）。
  正确做法是把共享主体抽成 guard 模块的一个函数（参数：plan、manifest 名、schema、输出根），两个宿主 builder 与中立模式都调它。
- 安装脚本加「宿主中性」模式（新 manifest 名/schema，例如 `shared-projection-manifest.json` /
  `feisheng-shared-runtime-projection/v1`），并让 `-Force` 的标记校验认它。
- 建议同时把中立投影纳入 `verify.ps1`（或并入现有投影步骤），否则没有新鲜度门禁。

**验收**：中立投影里**没有**任何宿主专属文件；槽位是核心中性版；共享根重装成功；
`verify.ps1` 12/12（或 13/13）；fresh clone 12/12。

### 9.2 T2【核心】**触发行为验证**（D2/D3 的唯一证据来源）

**目标**：证明「用户说一句中文，入口被加载，并路由到正确能力」。

**方法（沿用 Sliver 的 A/B 口径，已在本机跑通）**：
```bash
# Claude：全新会话 + 中文自然语言需求
claude --debug-file <log> -p '<一句真实中文需求，例如：帮我看看这个项目现在有什么风险>'
# 解析日志：Loaded (\d+) unique skills；再人工/脚本判读是否加载了我们的入口
# Codex：
codex debug prompt-input   # 统计 (file: r\d+)，看是否出现 feisheng-vibe-coding 及其嵌套条目
```
**注意**：`claude -p` 消耗真实额度（用户已多次授权此类探测）。建议一次测 1–2 条真实指令，而不是批量烧额度。

**验收**：能观察到「入口技能被加载」+「选择了某个主路由」+「加载了该路由的 owner / 调用了某个 provider」。
如果做不到，把差距写成下一批的修复项（T3）。

### 9.3 T3 **按 T2 的结果修触发**（可能包含）

- 入口描述是否够宽/够准（现已在 `SKILL.md` 里覆盖中文 + 英文关键词）
- 控制面是否在宿主会话中**可读**（相对路径解析、`<sliver-runtime-root>` 解析）
- 若宿主只读 `SKILL.md` 而不给读 bundle 内其它文件，则单目录形态**从根上不成立** ——
  那就要回到「形态」重新决策（这是本目标的真正风险点，必须在 T2 里尽早暴露）
- 需要时给 `Internal Capability Providers` 的 7 条补更明确的触发条件

### 9.4 T4 **阶段 2 收尾**：`tdd` / `code-review`

两者现为 `source-only-*`，理由明确写着「待宿主行为 smoke」。T2 通过后可评估接入。
注意它们的内容取自已提交 revision `9fe7e7a3` 的 blob（**不采用**上游工作树未提交的改名）。

### 9.5 T5 **阶段 4 批次**（需 owner 定批次口径）

Vibe 46 条中：4 条已接入；**18 条许可证已放行但未接入**（16 个 `source-only-ui` + 2 个 `source-only-unreviewed`，MIT/Apache-2.0）；
**24 条被许可证挡住**（`vibe-original-*` / event-only / alias：私有分发包无逐技能许可证文本）。

### 9.6 T6 **Hook 解锁**（最后做，风险最大）

门槛：per-skill license + host discovery + 事件顺序/并发验证 + 写白名单/回滚 + **独立逻辑审查** + **owner 明确授权**。
注意：`vibe-original-*` 族 `runtimeEligible=false`，**不得**因 Hook 解锁而绕过许可证门禁。

### 9.7 T7 **收尾清理**

- `_smoke/`（169 文件，已 gitignore）：**总目标完成后统一清理**，勿提前删
- 文档一致性：`docs/HANDOFF.md`（历史）与本文的表述；`provenance/HOST-DISCOVERY-EVIDENCE.json` 重采
- 若 T2 推翻了形态决策，回头更新第 6 节决策日志（标注被推翻的原因）

---

## 10. 不可突破的边界

- **不修改三个来源项目**（只读）；`git fetch` 之类只写来源 `.git`，需 owner 授权
- **宿主的 junction 与源仓库链接不要动**：`_adapters/shared/skills` 里有指向源仓库的符号链接，
  源仓库在迁移完成前是**运行时依赖**，不是可归档的历史
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
  scripts/verify.ps1                     单入口（12 步）
  scripts/runtime-projection-guard.ps1   共享投影门禁 + 计划 + overlay 实现（唯一）
  scripts/validate-release-notices.ps1   NOTICE（逐族策略）
  scripts/validate-route-bindings.ps1    路由绑定（唯一命中 / 不得第二入口）
  scripts/build-canonical-catalog.ps1    分类 → catalog（bundlePolicy + bundlePathsFrom fail-closed）
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
git log --oneline -3                      # 起点应为 527b1bc
git status --porcelain                    # 应为空
pwsh -NoProfile -File 'scripts/verify.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' -IncludePackage
                                          # 应为 12/12
ls 'F:/skiils工具/_adapters/shared/skills' | wc -l     # 应为 180
```

然后按顺序：**9.1（T1 实施选项 A）→ 9.2（T2 触发行为验证）→ 9.3（T3 按结果修）→ 9.4 起**。

---

## 14. 能力构成现状（82 条的构成）

| 来源 | 登记 | 已接入 | 说明 |
|---|---|---|---|
| sliver-vibe-coding | 1 | **1** | 控制面（22 主路由 + 8 lens 是 `references/*.md`，非独立技能） |
| vibe-coding-skills | 46 | **4** | 4 个 checker 已接入；18 条许可证已放行但未接；24 条被许可证挡住 |
| mattpocock-skills | 35 | **3** | 3 个原语已接；11 个 source-only-primitive；7 个 adapter-candidate；6 个 excluded（上游 in-progress）；6 个 user-tool；1 compat；1 checker |

```text
技能集合   82/83     几乎全量（差 1 个翻译维护技能）
功能裁决   11/11 簇  已完成（duplicateGroups）
交付runtime 8/82      8 条记录 / 90 文件（控制面 75 + 7 技能 15）
路由绑定   7/7        已接入技能全部唯一命中
许可证策略 9 族全显式 4 族 runtimeEligible=true、5 族 false
交付宿主   1 个入口   Claude 已确认（+1）；Codex 会额外列出包内 9 个 SKILL.md（用户决定不改）
行为验证   0          ← 唯一还没做的大项（见 9.2）
```
