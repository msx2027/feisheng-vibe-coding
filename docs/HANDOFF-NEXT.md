# 接手必读（2026-09-10，控制面 runtime 闭包 + 路由绑定后刷新）

> 本文是**最新交接**，优先级高于 `docs/HANDOFF.md` 中的所有历史轮次记录。冲突时以本文为准。
> 历史轮次的四个第一优先（「物理导入 + 门禁策略化」「换行可复现性」「目录忠实 runtime 单位」「路由绑定」）**均已做完**。
> 本轮在动手做路由绑定前，先发现并修好了它的前提缺口（控制面在 bundle 里根本跑不起来）。

## 0. 仓库状态

- 仓库 `F:/skiils工具/feisheng-vibe-coding`，分支 `main`；本批提交为 `8e91e72`（控制面 runtime 闭包）、
  `955577e`（记录阻塞直观方案的真实约束）、`091b6f2`（路由绑定 + 门禁），其前为
  `3e14dd3`（Vibe 检查器接入）、`8e30d2f`（换行可复现性修复）、`00451d6`（防回归门禁）、
  `4fe6951`（目录忠实 runtime 单位）、`33ebb79`（生成物不再继承脚本源码换行），**工作树干净**。
- 门禁：`pwsh scripts/verify.ps1 -IncludePackage` = **12/12 PASS**（发布包 48 文件、0 违规）；
  `pwsh`（7）与 Windows PowerShell 5.1 均为 12/12。新步骤 `3b) 路由绑定`。
- **fresh clone 验收已通过**：`core.autocrlf` = `true` / `false` 各 clone 一次，两种 shell 均 12/12；
  已登记补丁在两种配置下都逐字节可复现（`patchedSha256` 一致、CRLF 保留、`git status` 干净）。
- runtime 覆盖：**8 条记录 / 65 个文件**，其中控制面 **50 个**（SKILL.md + LICENSE + 44 个 `references/*.md`
  + 4 个契约脚本，由显式白名单 `bundlePaths` 展开）；技能 7 条 / 15 个文件
  （3 Matt 原语 + 4 Vibe 检查器；技能目录为目录单位）。`packaging/tests/plugins/assets` 一律不进。
- **7 条已接入技能全部被路由 owner 引用**（唯一命中），由 `scripts/validate-route-bindings.ps1` 强制。
- 来源快照：`vibe-coding-skills=553`、`mattpocock-skills=136`、`sliver-core=220`，树摘要一致。
- 存量：`evidence/` 37 份、`tasks/` 37 份、`scripts/` 19 个。
- 脚手架 `_smoke/`（169 个文件，已 gitignore）：**总目标完成后统一清理**，勿提前删。

## 1. 本轮完成：首批 Vibe 技能物理导入 + 运行时门禁策略化

**结构前提**：`scripts/runtime-projection-guard.ps1` 禁止把 `sources` 段带进运行时 bundle，
所以在本仓库「接受一个技能」**意味着把内容物理导入到 `sources/` 之外的一等位置**。
上一轮只翻分类标签，被三个门禁同时如实拒绝；本轮把前提补齐。

**接入批次**：impeccable 侧 bundled 只读检查器 **4 个** —— `audit`、`critique`、`harden`、`optimize`
（Apache-2.0，`writeAuthority=none`，宿主证据 `model-visible`）。

| 步骤 | 落地物 |
|---|---|
| 1. 物理导入 | `scripts/import-vibe-skills.ps1`（新增，唯一导入路径，数据驱动：分类真源里 `readiness=accepted` 的 Vibe 记录即待导入集）；内容 `sources/vibe-coding-skills/skills/<dir>/` → `skills/checker/<id>/`；派生来源台账 `provenance/VIBE-IMPORTS.json`（逐文件 SHA-256 + sourceCommit，revision 从 LICENSE-MAP 读取，不硬编码） |
| 2. 生成器路径规则 | `build-canonical-catalog.ps1`：accepted 的 Vibe 记录 path → `skills/checker/<id>/SKILL.md`；并 fail-closed 要求 `sourceDir` 存在且等于上游目录名 |
| 3. NOTICE 门禁策略化 | `LICENSE-MAP.json` 新增逐族策略 `vibePerSkill.families[].runtimeEligible`（8 族全部显式声明）；`validate-release-notices.ps1` 读该字段，**删除**硬编码的「Vibe 条目必须 runtimeEligible=false」不变量 |
| 4. 分类真源 | `SKILL-CLASSIFICATION.json`：新增 `checker|accepted → accepted-checker`；`acceptedStatuses` 加入该状态；4 条记录 → `domain=checker / readiness=accepted / writeAuthority=["none"] / sourceDir=<上游目录>` |
| 5. 投影与包 | Codex/Claude 投影 manifest 的 `acceptedPrimitives`（硬编码 kind）→ `accepted`（含 status）；`build-release-package.ps1` 删除「Vibe 不贡献 runtime 文件」的硬编码声明，改为从门禁报告派生 |
| 6. 新门禁 | `verify.ps1` 新增：① runtime include 与登记的 `sourceSha256` 一致；② 导入副本与快照逐文件一致（**与 eol 无关**） |

**关键范围决策（与上一版交接的建议不同，且必须保留理由）**：
上一版建议首批 13 个只读检查器。按许可证证据逐项复核后，**只有 4 个可以进入 runtime**：

- 可接入：`audit`、`critique`、`harden`、`optimize` → 族 `impeccable-bundled-product-checker-overlap`，`runtimeEligible=true`。
- 不可接入（9 个）：`bug-fixer`、`codebase-memory-scout`、`design-brief-builder`、`design-maker`、
  `hotspot-governor`、`requirements-test-designer`、`test-automation`、`ui-system-guardian`
  → 族 `vibe-original-product-checker`；`vibe-code-review` → 族 `vibe-original-checker`。
  两族的 `runtimeEligible=false`：上游是 **private 分发包**（`package.json` `private:true`、
  `0.0.0-private`），**未逐技能授予许可证文本**；`legal/ui-system-guardian/SOURCE-DECLARATION.md`
  是仓库内的**来源记录**，不是上游许可授予，不能当可再分发的 NOTICE。

即：这 9 个的排除理由是**来源/许可证未通过**，不是「待办」。解除需要「上游逐技能许可证声明」
或「独立法律审查」，并同步改真源。这是本轮把原本写在文档里的法律判断**下沉为机读数据**的产物。

**反例实测**（都按预期拒绝，已回退）：

| 反例 | 实测 |
|---|---|
| 向 `skills/checker/audit/SKILL.md` 追加一行 | `[FAIL] runtime include 内容完整性 — audit (sha 与登记不一致)` |
| 族 `impeccable-bundled-product-checker-overlap.runtimeEligible=false` | `[FAIL] 发布 NOTICE 门禁`（族级策略生效） |
| 重复运行导入脚本 | `目标位置已存在，拒绝覆盖: skills/checker/audit` |

**明确未做（不得越界声明）**：

1. 投影契约仍是**「每条记录一个已批准文件」**：`critique` 的 `reference/*.md`、以及既有 Matt 原语的
   `DEEPENING.md` / `ADR-FORMAT.md` / `agents/` 都**没有**进入 bundle。导入是目录完整的，投影不是。
2. 这 4 个检查器依赖**未接入的 `impeccable` 父技能**（正文要求先 `Invoke /impeccable`），
   即 bundle 内是**部分依赖闭包**，不是可独立完整运行的技能。
3. 宿主 **trust**、技能**行为正确性**、Hook 强制：全部仍 `UNVERIFIED`；本轮未做任何宿主 smoke。
4. 未重采宿主证据（复用 2026-09-10 快照）。

证据：`evidence/20260910-vibe-checker-promotion.md`；任务：`tasks/20260910-vibe-checker-promotion.md`。

## 2. 【本轮已完成】换行可复现性：修好了一个压着 CI 与核心主张的既有缺陷

**本轮验证时附带发现的既有缺陷，与本批 Vibe 接入无关（修复前的 HEAD `591710a` 即可复现）。**
现已修复并有防回归门禁。提交 `8e30d2f` + `00451d6`，证据 `evidence/20260910-line-ending-reproducibility.md`。

修复前实测（`git clone` 到新目录后跑门禁）：

| 门禁 | 本机工作树 | fresh clone |
|---|---|---|
| `runtime include 内容完整性` | PASS (8) | **FAIL**（4 条 Vibe 记录 sha 与登记不一致） |
| `导入副本与快照一致性` | PASS (7) | PASS (7)（刻意设计为与 eol 无关） |
| `来源快照完整性` | PASS | **FAIL**（vibe 快照 492 文件 content-vs-source） |
| 总计数 | 10/10 | **8/10** |

根因：仓库没有 `.gitattributes`，换行完全由使用者本地 `core.autocrlf` 决定；git 索引只存
**规范化后的 LF blob**，而三处登记 sha（`PROVENANCE-INTEGRITY` 的 `treeHash`、catalog 的
`sourceSha256`、`VIBE-IMPORTS` 的逐文件 sha）都是在**工作树字节**上算的。而三个来源字节本就不同：
`vibe-coding-skills` = LF、`mattpocock-skills` = CRLF、`sliver-core` = CRLF。
所以**两个值总有一个是错的**：`autocrlf=true` 时 LF 来源的 vibe 快照失败；
`autocrlf=false` 时 CRLF 来源的 matt / sliver 快照失败。

修法（比看上去便宜）：`.gitattributes` 给 `sources/**`、`skills/**`、`governance/sliver-core/**` 声明
`-text`（两个方向都不转换 ⇒ 提交的 blob 就是来源字节），再用 `git add --renormalize` 以工作树原始字节
重新登记。**因为工作树字节不变，所有已登记 sha 仍然有效，无需重算**。

> 遗留教训（下次做这类大范围 blob 改写要照做）：提交前必须给出「只改换行」的逐文件等价证明。
> 本轮对全部 1274 个文件测得：工作树字节未变 1274/1274、索引 blob == 工作树 1274/1274、
> 新旧 blob 归一化后相同 1274/1274、blob 变化 383、**除换行外内容不同 0**。

**注意**：`docs/CAPABILITY-INDEX.md`、`provenance/SLIVER-IMPORT.json` 等生成物仍是 **mixed 换行**
（`Set-Content` 追加的行尾与字符串内部 `\n` 不一致）。新鲜度校验做归一化比较所以无影响；
本轮**故意未改**生成器写入方式，避免把改动面扩到「所有生成物字节」。

## 3. 【本轮已完成】runtime 单位升级为「目录忠实」

之前 `path` 是**单个文件**，所以被接受的技能在 bundle 里只有 `SKILL.md`：
`critique` 正文反复要求的 `reference/personas.md` 等三个文件、Matt 原语的 `DEEPENING.md` / `DESIGN-IT-TWICE.md` /
`ADR-FORMAT.md` / `CONTEXT-FORMAT.md` / `scripts/hitl-loop.template.sh` 全部缺失。
即「已接入」在功能上是不完整的（宿主拿到引用不存在文件的 SKILL.md）。

现已改为目录忠实的**显式白名单**：

- 策略真源：`SKILL-CLASSIFICATION.json` 的 `runtimePromotionPolicy.bundlePolicy`
  （目录范围正则、`directoryExcludedSegments`、`forbiddenSegments`）；
- 唯一实现：`build-canonical-catalog.ps1`（生成时枚举目录、逐文件记 sha256、生成期 fail-closed），
  产物是 `CANONICAL-CATALOG.json` 的 `bundlePolicy` + 每条记录的 `bundle`；
- 消费者读生成物：投影门禁按 `bundle.files` 展开 `filePlan`，verify 逐文件比 sha，
  发布包与两个 builder 的禁止段也改从 catalog 策略读。

效果：runtime include 文件数 8 → **16**；Codex 投影 13 → 20 文件；发布包 32 → 48 文件。
三个反例实测：引用文件漂移、目录内新增未登记文件、目录内出现 `hooks/` 段 —— 均按预期拒绝。

关键设计点（不要退化）：

- **`agents/` 不进产物**（宿主编排/插件资产，如 `agents/openai.yaml`，未被正文引用）；
  被排除的路径记录在 `bundle.excluded` 里，判断可审查。
- **控制面保持单文件**：`governance/sliver-core/` 含 hooks / packaging / tests，整体目录会撞上禁止段。
- **新增文件必须重新生成 catalog 并提交**（否则 catalog 新鲜度门禁失败）——这是有意的 fail-closed。

证据：`evidence/20260910-directory-faithful-runtime-unit.md`；任务：`tasks/20260910-directory-faithful-runtime-unit.md`。

## 4. 【本轮已完成】控制面 runtime 闭包 + 路由绑定：技能现在真的被路由到

### 4.1 前提缺口（做绑定侦察时撞到的，比缺绑定更严重）

原投影里控制面只有 `governance/sliver-core/SKILL.md` 一个文件，而这个文件自己的 Startup Protocol 要求
加载 `references/runtime-adapter.md` 并运行 `scripts/runtime_decision_contract.py` —— 21 个直接引用、
41 个由路由表引用的文件、两个契约脚本**全都不在 bundle 里**。即：**唯一入口在自己的 runtime bundle 里启动不了**，
这也解释了为什么「路由绑定」当时不可能有实际效果（路由表本身都不在 bundle 里）。

修法 = 第三种 bundle 单位（控制面既不适合整目录也不适合单文件）：分类真源声明 `bundleRoot` + 显式 `bundlePaths`，
生成器展开（目录递归、文件单个、未列出的不进）。
**功能验证**：把投影构建到仓库外的临时目录，在**该 bundle 内部**运行契约脚本，成功解析出 22 条主路由。

### 4.2 路由绑定（证据：evidence/20260910-route-binding.md）

**最直观的做法被机器校验排除**：`runtime_decision_contract.py` 里 `"skill"` 出现 **0 次**；路由表 `Load` 列
受校验，但 `LOADED_OWNER_IDS` 是 **10 个抽象 owner 类别**（`routes`/`task_depth`/`testing`/…），**不是文件路径**。
⇒ 往 `Load` 列塞 `skills/…/SKILL.md` 不是合法绑定，绑定只能落在 **Load 已指向的 owner 文档内容里**。

落地：在 `references/engineering-execution.md`（被 Load 命中 **9 次**的执行主干 owner，已拥有
`Owner-Layer Rules` / `Debug Evidence Ladder` / `Verification Matrix`）新增 `## Internal Capability Providers` 小节，
写清 provider 只返回 finding / 诊断，绝不选路由、不改深度、不写真源。7 个加载条件全部来自既有
`duplicateGroups[].rule`（**没有新决策**，也没有第二份 route→reference 表）。

强制：`scripts/validate-route-bindings.ps1`（verify 步骤 `3b)`），策略真源 = classification 的 `routeBinding`。
4 条 fail-closed：命中次数必须恰为 1（0 = 看不见，>1 = 重复入口）／owner 之外出现技能路径即 FAIL（第二入口）／
owner 里出现未接入技能即 FAIL／缺策略或缺 owner 文件直接 throw。**7 个反例实测全部按预期失败**。

vendored 修改已按规矩登记 `LOCAL-PATCHES.json`（`originalSha256` → `patchedSha256`，+24 行、0 删除、CRLF 保留），
并用 `record-provenance-integrity.ps1` 重算 `PROVENANCE-INTEGRITY.json`（该脚本接受已登记补丁）。

### 4.3 【本轮已完成】宿主投递 + 发现性实证（证据：evidence/20260910-host-install-and-discovery.md）

用户拍定**单目录**形态。新增 `scripts/install-runtime-projection.ps1`（此前**没有任何安装入口**），
把统一投影装成一个技能目录到宿主技能根：

- 安装根 `~/.claude/skills` 实为 junction → `F:\skiils工具\_adapters\shared\skills`，
  所以**装一次两个宿主都读**（实测确认，不是声明）。
- 装成 `.../shared/skills/feisheng-vibe-coding`，94 文件，装后用 builder 的 `Validate` 复核已安装目录 = PASS。

A/B 发现性（沿用 Sliver 自己的口径）：**Claude 169 → 170（+1）**；**Codex 203 → 212（+9）**，两者均 DISCOVERED。

**重要更正（我上一轮说错了）**：我说「单目录时嵌套技能不会被发现」——只对 Claude 成立。
**Codex 会递归枚举嵌套 `SKILL.md`**，把包里 9 个 `SKILL.md` 全部列出（含 4 个 Vibe checker，
而它们 frontmatter 明写「不得自然语言独立触发」）。这是宿主行为，从我们这侧只能靠改名规避。

仍未解决：**宿主事实文件落点与 Sliver overlay 契约不一致**（我们把 `agents/openai.yaml`、`references/*`、
`references/runtime-adapter.md`、`assets/project-claude/CLAUDE.md` 改写成了 `adapters/*` 与根 `CLAUDE.md`），
其中最实质的是 Claude 会读到写着「本包不声明宿主适配」的核心 `runtime-adapter`。判断需宿主行为证据，本轮未改。

**旧入口已退役（用户批准）**：共享根里 8 个与运行包重复的旧条目（旧控制面 `sliver-vibe-coding` + 7 个专项）
已移除，共享根 188 → **180**。退役后 A/B 与算术预测完全吻合：Claude **162**（169−8+1）、Codex **204**（203−8+9）。
⇒ Claude 上现在**只有我们一个入口**；Codex 上仍是包内 9 个条目（第 4.3 节的「Codex 递归枚举」行为不变）。
移除全靠 `os.rmdir`（遇到真目录会报错，是安全的失败方向），且**源仓库逐文件 sha256 前后一致**。

### 4.4 其余待 owner 拍的口径

- **阶段 4 批次**：46 条 Vibe 记录里，18 条许可证已放行（16 个 `source-only-ui` + 2 个 unrevied，MIT/Apache-2.0）但未接入；
  24 条被 private 分发许可证挡着。按什么粒度接入、要不要接，需 owner 定。
- **控制面 `assets/`**：见第 9 节的悬空引用条目 —— 加一个词就能纳入。

## 5. 【最后做】Hook 解锁（风险最大）

**尚未开始**。门槛：per-skill license（部分具备）+ host discovery + 事件顺序/并发验证 + 写白名单/回滚
+ **独立逻辑审查**（当前主 Agent 难以自供，子 Agent 多次 503/中断）。Hook 会写进宿主、影响每次工具调用、
可阻断操作 → 需 owner 明确授权并在专门会话中做。注意：`vibe-original-*` 族 `runtimeEligible=false`，
该族技能不得因 Hook 解锁而绕过许可证门禁。

## 6. 82 个技能的构成与当前可用集合

| 来源 | 源侧 SKILL.md | 我们登记 | 说明 |
|---|---|---|---|
| sliver-vibe-coding | 1 | 1 | 22 条主路由 + 8 lens 是 `references/*.md`，非独立技能（实测 `lens-catalog` 输出 8） |
| vibe-coding-skills | **138** | **46** | 138 = `skills/` 46 + `.claude/skills/` 46 + `.agents/skills/` 46；后两者是宿主适配变体 |
| mattpocock-skills | 36 | 35 | 未登记 `.skills/translate-skill`（翻译维护 meta-技能，建议不补） |

```
技能集合   82/83     几乎全量（差 1 个翻译维护技能）
文件内容   全量       能力性文件无缺失（Vibe tools 145/145、hooks 10/10、codex-hooks 22/22）
功能裁决   11/11 簇   已完成（evidence/20260910-overlap-arbitration.md）
交付runtime 8/82      8 条记录 / 65 个文件（控制面 50 + 7 技能 15；控制面用显式 bundlePaths 白名单）
许可证策略 8 族全显式 4 族 runtimeEligible=true、5 族 false（不可用族见第 1 节）
路由绑定   7/7        已接入技能全部在 references/engineering-execution.md 里唯一命中（步骤 3b 强制）
```

## 7. 历史踩坑（照抄省时间）

1. **heredoc 会吞反斜杠**（shell 层）→ 用 `chr(92)`、`DirectorySeparatorChar`，或改用 write/edit 工具写文件。
2. **`@()` 经 if/函数返回值会解包成标量** → 函数别返回裸集合，调用处统一 `@(...)` 包裹。
   （本轮实测：`Get-RelativeFilePathList` 返回单元素时 `.Count` 在 StrictMode 下直接抛错。）
3. **`[ordered]@{}` 没有 `ContainsKey`** → 用普通 `@{}`。
4. **`Sort-Object` 是 culture 排序**（PS 5.1 vs 7 对 `-` 权重不同）→ 用 `[System.StringComparer]::Ordinal`。
5. **含中文的 .ps1 必须 UTF-8 BOM**，否则 Windows PowerShell 5.1 按 GBK 解码直接语法报错。
   注意：`write` 工具写出的新 .ps1 **不带 BOM**，必须事后补（本轮 `import-vibe-skills.ps1` 已补）。
6. **调 Sliver 自带 Python 工具必须带 `-B`**，否则生成 `__pycache__` 被 provenance 门禁拦下。
7. **`Join-Path $a 'x/' + $b` 会把 `+` 当字面参数** → 写 `Join-Path $a ('x/' + $b)`。
8. **投影禁止 `sources` 段** → 提升必须先物理导入（第 1 节）。
9. **NOTICE 门禁不再硬编码 Vibe flag**（本轮起读 `vibePerSkill.families[].runtimeEligible`）；
   新增/修改许可证族时**必须**声明该字段，缺字段即 fail-closed。
10. **`core.autocrlf=true`**：提交会警告换行将被改写 → **每次提交后都要重跑 `verify.ps1`**。
    由它引起的 fresh clone 字节不一致已修（第 2 节 + 踩坑 18）；保真树的字节现在与本地配置无关。
11. **宿主布局**：`~/.claude/skills` 与 `F:/skiils工具/_adapters/shared/skills` 是**同一目录**（junction）；
    `~/.codex/skills` 原有 157 个 junction 已清空。删 junction 只能用 `os.rmdir`。
12. **`codex debug prompt-input` 的 JSON 里换行是转义的两字符**（反斜杠+n）→ 解析前先替换成真换行。
13. **`disable-model-invocation: true` 的技能不会出现在模型可见清单里** → 证据必须分类。
    **补充实测**：Codex 似乎不认这个 Claude 侧的 frontmatter 字段，所以带该标记的 Vibe 技能在 Codex 上仍是 `model-visible`。
14. **存在并行写入者**：`docs/HANDOFF.md` 曾被另一写入者插入块（已保留意图并刷新）。动手前先 `git status`。
15. **generated 文件的删除逻辑**：`ConvertFrom-Json` 读含单元素数组的 JSON 时可能解包成标量；遍历统一 `@()` 包裹。
16. **新增 `accepted` 的 Vibe 技能的正确顺序**：改 `SKILL-CLASSIFICATION.json`（含 `sourceDir`、`writeAuthority`）
    → 跑 `scripts/import-vibe-skills.ps1`（它按分类驱动导入，目标已存在则拒绝）→ 重生成 catalog/index → 跑门禁。
    顺序反了会被门禁拒绝（这正是设计意图）。
17. **`git ls-files --eol` 的输出格式**：`i/<eol>` `w/<eol>` `attr/<attr>` 三段用**空格对齐**，
    之后才是一个 TAB 再跟路径。只按 TAB 切会得到 2 段，**每一行都被跳过 → 门禁假通过**。
    另外 `i/` 与 `w/` 前缀天生不同，比较前必须各自剥掉，否则会把全部文件假报成违规。
    写解析类门禁时务必加「解析行数 == 输入行数」自检：本轮这两类 bug **都真实发生过**，且都不会报错。
18. **保真树的换行**：`sources/**`、`skills/**`、`governance/sliver-core/**` 由 `.gitattributes` 固定为 `-text`
    （提交字节 == 来源字节）。**改动这些树或新增快照前先看 `.gitattributes`**；
    在自动转换生效时重新 add 会让 `保真树换行可复现性` 门禁失败（这是有意的），
    正确做法是用工作树原始字节重新登记（`git add --renormalize`）。
19. **大范围 blob 改写必须附等价证明**：不要只说「只改了换行」——逐文件测「工作树字节未变 /
    索引==工作树 / 新旧 blob 归一化后相同 / 除换行外差异为 0」四个数字，写进证据。
    另外值得知道：磁盘上的工作树字节不变，所以**登记 sha 不需要重算**。
20. **runtime 单位是目录（bundle）**：技能目录内新增/删除/修改任何文件，都必须重新生成 catalog 并提交，
    否则 `catalog 与分类真源同步` 与 `runtime include 内容完整性` 会失败。
    新增文件**不会**被静默忽略（生成器会纳入并导致不同步）——这是有意的 fail-closed。
    另外：`agents/` 与 `.git` 永不进产物（`bundlePolicy.directoryExcludedSegments`），
    目录内出现 `hooks`/`.claude`/`sources` 等禁止段时**生成器直接报错**。
21. **本机绿不是证据，fresh clone 才是**：实测过一个真实缺陷 —— 生成器里一个**多行字面字符串**
    使生成物的字符串值继承**脚本源码换行**，而 `scripts/**` 当时无属性规则 → 本机（LF）绿，
    fresh clone（`autocrlf=true`，脚本 CRLF）`catalog 同步` 门禁失败。
    已修：①生成物字符串不从源码字面字符串来（从真源数据读）；②`.gitattributes` 加了 `scripts/** text eol=lf`。
    **凡是改动生成器（尤其新增字符串/字段），必须跑一次新目录 clone 验收。**

22. **路由表的 `Load` 列不是文件清单**：`runtime_decision_contract.py` 的 `LOADED_OWNER_IDS` 是 **10 个抽象 owner 类别**
    （`routes`/`task_depth`/`testing`/…），不是路径；`"skill"` 在该脚本里出现 **0 次**。
    把 `skills/…/SKILL.md` 塞进 `Load` 会直接 `raise` —— 技能绑定只能写进 Load 已指向的 owner **文档内容**里。
23. **vendored 内容的正确修改姿势**：改 `governance/sliver-core/**` → 登记 `LOCAL-PATCHES.json`（`originalSha256`+`patchedSha256`）
    → 跑 `scripts/record-provenance-integrity.ps1` 重算 `PROVENANCE-INTEGRITY.json`。
    记录脚本**接受已登记补丁**（快照须 == `patchedSha256`，来源须仍 == `originalSha256`），所以补丁不会把基线卡死；
    但顺序反了（先记录后登记）会被拒。
24. **改 vendored 文件要保住原换行**：`governance/sliver-core/**` 是 CRLF 且 `-text`。用 Python 逐字节插入
    （按检测到的 `\r\n` 拼接）后，`git diff --stat` 应只显示新增行、**0 删除** —— 这就是「没有换行漂移」的判据；
    混入 LF 会显示整块改写。
25. **PowerShell stdout 编码随「重定向到文件」与「管道捕获」而变**（本机实测：文件里是 GBK、管道给 Python 时像 UTF-8）。
    所以机器可读 JSON 的判定字段用 ASCII（`status` = `PASS`/`FAIL`），中文只放 Detail。
26. **比较两种 shell 的步骤数必须传相同参数**：`-IncludePackage` 与否差一步（11 vs 12）。
    本 Agent 就先误判过一次「5.1 少了一步」，其实是自己没带参数。

## 8. 入口速查

```
真源（唯一写入点）
  provenance/SKILL-CLASSIFICATION.json     ← 分类 + 裁决（domain/readiness/writeAuthority/sourceDir/duplicateGroups/policy/routeBinding）
  provenance/LICENSE-MAP.json              ← 许可证台账（entries + vibePerSkill.families[].runtimeEligible 逐族 runtime 策略）
  provenance/LOCAL-PATCHES.json            ← 本地补丁登记（未登记偏差即漂移）
  provenance/OWNER-LEDGER.json             ← owner 机器可读记录
  provenance/HOST-DISCOVERY-EVIDENCE.json  ← 逐技能宿主证据
  provenance/VIBE-IMPORTS.json             ← Vibe 物理导入派生来源台账（逐文件 sha，脚本生成）
  .gitattributes                           ← 保真树 -text（提交字节 == 来源字节，与本地 core.autocrlf 无关）
生成物（禁止手工编辑）
  provenance/CANONICAL-CATALOG.json / docs/CAPABILITY-INDEX.md / provenance/PROVENANCE-INTEGRITY.json
门禁
  scripts/verify.ps1                       ← 单入口（12 项；含内容完整性、导入一致性、保真树换行、路由绑定）
  scripts/runtime-projection-guard.ps1     ← 共享投影门禁（唯一实现）
  scripts/validate-release-notices.ps1     ← NOTICE 门禁（逐族策略驱动）
  scripts/validate-route-bindings.ps1      ← 路由绑定门禁（唯一命中 + 不得第二入口/未接入；策略在 classification.routeBinding）
  scripts/build-canonical-catalog.ps1      ← duplicateGroups owner/成员 + sourceDir + bundlePolicy fail-closed 校验
导入
  scripts/import-vibe-skills.ps1           ← Vibe 技能物理导入（唯一路径，数据驱动）
  scripts/import-matt-source.ps1 / import-sliver-core.ps1 / import-vibe-source.ps1 ← 来源快照导入
宿主 smoke（消耗真实额度，不接入 verify）
  scripts/smoke-host-skill-discovery.ps1   ← -TargetHost Claude|Codex|Both -Install/-Uninstall/-Probe
  scripts/collect-host-skill-evidence.ps1  ← 采集逐技能发现性证据
```

常用命令：

```powershell
# 一键全套门禁 + 生成物新鲜度（提交后必须重跑）
pwsh -NoProfile -File 'scripts/verify.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' -IncludePackage

# 新增 accepted 的 Vibe 技能（顺序不能反）
# 1. 改 SKILL-CLASSIFICATION.json（readiness=accepted + sourceDir + writeAuthority + reason）
pwsh -NoProfile -File 'scripts/import-vibe-skills.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'
pwsh -NoProfile -File 'scripts/build-canonical-catalog.ps1' -RepoRoot 'F:\skiils工具\feisheng-vibe-coding'
pwsh -NoProfile -File 'scripts/build-capability-index.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'

# 换行可复现性验收（唯一可信的验收方式）
git clone <repo> <新目录>; cd <新目录>; pwsh -NoProfile -File 'scripts/verify.ps1' -IncludePackage

# 修改 vendored 内容（顺序不能反）
# 1. 改 governance/sliver-core/**
# 2. 登记 provenance/LOCAL-PATCHES.json（originalSha256 + patchedSha256，原 sha 取来源同路径文件）
pwsh -NoProfile -File 'scripts/record-provenance-integrity.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'
pwsh -NoProfile -File 'scripts/build-canonical-catalog.ps1' -RepoRoot 'F:\skiils工具\feisheng-vibe-coding'

# 新增 runtime 技能后的路由绑定（门禁会强制，不加绑定则 verify 步骤 3b 失败）
# 在 classification.routeBinding.ownerFiles 指向的文件里，为该技能的 catalog path 加恰好一行引用
pwsh -NoProfile -File 'scripts/validate-route-bindings.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'
```

## 9. 仍未验证（不要越界声明）

- 宿主 **trust**、技能**真实行为正确性**、**Hook 强制** —— 三者均 `UNVERIFIED`。
- 发布 CI **从未在真实 GitHub runner 跑过**（工作流已接入，仅本地校验 YAML）。
  但本地已等价复现最危险的情形：fresh clone + `core.autocrlf=true`（Windows runner 默认）为 12/12，
  `false`（Linux/macOS runner 默认）也为 12/12，两种 shell 均如此。仍需一次真实 CI 运行确认。
- **fresh clone 可复现性已修复**（第 2 节）：本机工作树与两种 `core.autocrlf` 配置均 12/12；
  已登记补丁在两种配置下都逐字节可复现（CRLF 保留）。
- **已接入技能的宿主委派行为未验证**（第 4.3 节）：路由绑定只在静态层被门禁强制；
  没有任何证据表明宿主会按 `Internal Capability Providers` 的 7 个条件去委派技能。
- 宿主侧**从未在扩大后的 bundle 上重验**：控制面 bundle 从 1 个文件增到 **50 个**（总投影 65 文件），
  宿主发现性/行为都没有重新采证。
- 宿主证据只证明「被识别」，**不证明行为正确**；本轮也未重采。
- **现存宿主证据已过期，不得当作当前运行时集合的证据**：`provenance/HOST-DISCOVERY-EVIDENCE.json`
  的 `capturedAt` 为 `2026-09-10T11:39:40Z`（= 19:39 +0800），而 Vibe 检查器接入提交 `3e14dd3` 在 **20:14 +0800**，
  即证据比接入**早约 34 分钟**。所以那份证据里 `audit`/`critique`/`harden`/`optimize` 仍写着 `source-only`、
  并且它记录的是**控制面 1 文件时代的 bundle**。重采前不得引用它作为运行时集合的宿主证据。
- 控制面的 `assets/` **有意未纳入 bundle**（references 里有 `assets/project-adoption/**` 等引用，目前是悬空引用）。
  加 `"assets"` 到 `bundlePaths` 即可翻转，但那是「bootstrap 进目标项目的模板」还是「运行时 owner」，需 owner 拍定。

## 10. 不可突破的边界

- 不修改三个来源项目（只读）；`git fetch` 之类只写来源 `.git`，需 owner 授权。
- **本仓库自持，不依靠任何上游**：不产出上游问题报告、不等上游确认；上游差异只作事实记录 + 周期复核。
- 不手工编辑生成物；改分类/裁决只改 `SKILL-CLASSIFICATION.json`。
- 不把 Vibe 的 `.claude/`/`.agents/`/`.codex/` 镜像当源码或运行时内容。
- 不把混合第三方许可证并成根许可证；不手工复制许可证文件。
- **不改许可证族策略去迁就某个技能**：`runtimeEligible` 的取值必须由许可证/来源证据决定；
  改它等于改法律判断，必须留 reason + 证据。
- 修改 vendored 内容必须先登记 `LOCAL-PATCHES.json`（含 `originalSha256`）。
- 测试脚手架只放 `<repo>/_smoke/`；不覆盖宿主既有技能；不把 static smoke 写成真实宿主可用。
- `duplicateGroups[].owner` 必须是 `OWNER-LEDGER.json` 中登记的 owner；新增 owner 先登记再引用。
- 新增 accepted 的 Vibe 技能必须声明 `sourceDir` 且等于上游目录名（生成器 fail-closed 强制）。
- 保真树（`sources/**`、`skills/**`、`governance/sliver-core/**`）必须保持 `.gitattributes` 的 `-text`；
  **不得**为了省事把 sha 比对改成 eol 归一化 —— 那等于放弃「字节可复现」这个主张本身。
- **路由绑定只能有一个 owner**：写在 `classification.routeBinding.ownerFiles` 指向的文件里；
  不得在 `routes-index.md` 的 `Load` 列、根 `SKILL.md`、README 或适配器里平行再写一份
  （`Load` 列还受 `LOADED_OWNER_IDS` 抽象类别校验，塞技能路径根本不合法）。
