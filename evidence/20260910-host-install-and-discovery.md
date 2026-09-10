# 宿主投递与发现性实证（accepted；仅「被识别」，行为未验证）

日期：2026-09-10
关联：`scripts/install-runtime-projection.ps1`（新增，宿主投递入口）、`docs/HANDOFF-NEXT.md` §4.3
本批同时修掉一处上一轮闭包漏项（见第五节）

## 一、装了什么

形态：用户拍定为**单目录**（不把 7 个技能各装成顶层技能）。

| 项 | 值 |
|---|---|
| 目标宿主 | Claude（默认；同一目录同时服务 Codex，见下） |
| 安装根 | `C:\Users\MSX\.claude\skills` |
| 安装根真实目标 | `F:\skiils工具\_adapters\shared\skills`（junction；**一次安装两个宿主都读**） |
| 安装路径 | `...\shared\skills\feisheng-vibe-coding`（单个技能目录） |
| 文件数 | 94（= 90 bundle + 3 宿主事实 + 1 manifest） |
| manifest sha256 | `238881bd363c86eeeccbd6e3e986d1f092cb1704bfef8c2aa6f1b2748f5950e9` |
| sourceRevision | `559d7fc60c39040cf946980cda4287c673419c1c` |
| 装后复核 | 用 builder 的 `Validate` 模式对**已安装目录**复核 = PASS |
| 回滚 | `Remove-Item -Recurse -Force "C:\Users\MSX\.claude\skills\feisheng-vibe-coding"` |

此前投影**没有任何安装入口**（builder 强制 OutputRoot 在仓库外且必须不存在），本批新增的
`scripts/install-runtime-projection.ps1` 补上这一环：目标已存在则拒绝；`-Force` 只允许覆盖带本仓库
manifest 标记的目录；装完必须 Validate 已安装目录。

## 二、A/B 发现性实证（方法沿用 Sliver 自己的 smoke 口径）

| 宿主 | 未安装（基线） | 安装后 | 判定 |
|---|---|---|---|
| Claude Code | **169** unique skills（user root = `~/.claude/skills`） | **170**（+1） | **DISCOVERED** ✓ |
| Codex | **203** | **212**（+9） | **DISCOVERED** ✓ |

- Claude 方法：`claude --debug-file <log> -p 'Reply with exactly: ok'` → 解析 `Loaded (\d+) unique skills`。2 次调用消耗真实额度。
- Codex 方法：`codex debug prompt-input` → 统计 `(file: r\d+` 条目数。
- 「一个根、两个宿主都读」由此**实测确认**（不是口头声明）。

## 三、重要更正：嵌套技能在 Codex 上是**会被列出**的

上一轮我告诉用户「单目录时 7 个技能对宿主不可见」。**实测把这个判断分成两半**：

- **Claude：只 +1** → 只登记顶层那一个技能（`feisheng-vibe-coding`），嵌套的不单独登记。
- **Codex：+9** → 它把包里**全部 9 个 `SKILL.md`** 都列出来了：

  ```
  r0/feisheng-vibe-coding/SKILL.md
  r0/feisheng-vibe-coding/governance/sliver-core/SKILL.md
  r0/feisheng-vibe-coding/skills/checker/audit/SKILL.md
  r0/feisheng-vibe-coding/skills/checker/{critique,harden,optimize}/SKILL.md
  r0/feisheng-vibe-coding/skills/engineering/{codebase-design,diagnosing-bugs,domain-modeling}/SKILL.md
  ```

（+9 正好等于包内 `SKILL.md` 数量，可交叉验证。）

**后果**：用户选「不要」的目标（技能不各自独立暴露）在 Claude 上成立，在 **Codex 上不成立** ——
Codex 会递归枚举嵌套 `SKILL.md`，因此 `skills/checker/audit/SKILL.md` 等会作为独立条目出现，
而那 4 个 Vibe checker 的 frontmatter 明确写着「不得根据用户自然语言独立触发」。
这是**宿主行为**，从我们这侧只能靠改名/挪位规避（代价是与来源格式和 catalog 路径不再一致）。

## 四、仍未解决：宿主事实文件的落点与 Sliver 自身契约不一致

Sliver 的 `runtime-manifest.json` 声明了 overlay 源→目标：

| 目标宿主 | Sliver 声明落点 | 我们的投影实际落点 |
|---|---|---|
| codex | `agents/openai.yaml` | `adapters/codex/agents/openai.yaml` |
| codex | `references/studio-codex.md` | `adapters/codex/references/studio-codex.md` |
| codex | `references/execution-liveness-host.md` | `adapters/codex/references/execution-liveness-host.md` |
| claude-code | `references/runtime-adapter.md`（**覆盖**核心同名文件） | `adapters/claude/runtime-adapter.md`（核心那份仍在，且它写着「本包不声明宿主适配」） |
| claude-code | `assets/project-claude/CLAUDE.md` | 根 `CLAUDE.md` |

**源文件取自正确位置，但目标路径是我们自己改写的**。最实质的一条是 Claude 的 `runtime-adapter`：
宿主会读到「本包不声明启动时宿主适配」的核心版本，而不是 Claude 专用版本。
判断哪一边对需要宿主行为证据（本次只拿到「被识别」级证据），因此本轮**未改**，如实记录。

## 五、顺带修掉的上一轮漏项

- 我上一轮手写的 `bundlePaths` 漏了 `VERSION`、`scripts/stage_contract.py`、`scripts/migrate_stage_contract.py`
  和 7 个 `assets/project-*` 树（22 文件）。其中 **`stage_contract.py` 是 `check_project_guardrails.py` 的
  import 依赖**，漏了会让该脚本在包里直接 ImportError，而 references 引用它 20 次。
- 修法不是补齐我的手写清单，而是**让清单来自 Sliver 自己**：分类真源改为
  `bundlePathsFrom = { manifest: packaging/runtime-manifest.json, keys: [core_files, core_trees] }`，
  由生成器读取。这样清单只有一份，不会再出现两边漂移。
- 效果：控制面 50 → **75 文件**（9 core_files + 44 references + 22 assets），runtime bundle 65 → **90**。
- 验证：`check_project_guardrails.py` 的 import 闭包实测为
  `{check_project_guardrails, runtime_decision_contract, runtime_governance_contract, stage_contract, validation_support}`，
  现已全部在包内；门禁 12/12。

## 六、当前未达成「单一入口」的原因（重要）

共享根里**同时存在两个控制面入口**：`sliver-vibe-coding`（旧，源仓库拷贝）+ `feisheng-vibe-coding`（我们的）。
而且 7 个专项技能在共享根里**仍有各自的顶层目录**（Matt 那几个是指向只读源仓库的符号链接）。

⇒ 本次安装只是**新增**我们的入口，并没有移除旧入口。要真正达到用户要的「只有一个入口」，
必须退役旧条目（阶段 5），那是独立决策，未执行。

## 七、已验证 / 未验证

- **已验证**：安装写盘正确（94 文件、manifest sha、装后 Validate PASS）；两个宿主都发现了该技能（+1 / +9）。
- **未验证**：宿主 trust；技能真实行为；Hook 强制；**自然语言触发是否真的按控制面选到正确路由**；
  以及第四节那 5 条落点差异的实际影响。
- 本证据只覆盖「被识别」。**不得**据此声明宿主可用性。

## 八、旧入口退役（用户批准后执行）

退役对象 = 共享根里那 8 个旧条目（它们与我们的运行包重复）：

| 条目 | 类型 | 处理 |
|---|---|---|
| `sliver-vibe-coding` | 实体目录（76 文件，早前 smoke 装的） | 删除 |
| `audit` / `critique` / `harden` / `optimize` | 指向 Vibe 源仓库的链接 | 删链接 |
| `codebase-design` / `diagnosing-bugs` / `domain-modeling` | 指向 Matt 源仓库的链接 | 删链接 |

三次尝试与结果（如实记录，因为中间有一次报错）：

1. `shutil.rmtree` —— 在 `audit` 上抛「Cannot call rmtree on a symbolic link」。**未造成任何删除**
   （`sliver-vibe-coding` 已成功删除，其余 7 个完好）。随后复核源仓库：`vibe-coding-skills/skills/audit/SKILL.md`
   仍是 9064 字节、8月28 的原文件。
2. `cmd /c rmdir` —— 因中文路径在 cmd 侧编码失配而报「语法不正确」，**无副作用**。
3. `os.rmdir` —— 成功。选它的理由：Windows 上对 junction/符号链接只删除链接本身，且**遇到真目录会报错**，
   是安全的失败方向（不会误递归删除内容）。

**源仓库未被改动（独立证据）**：删除前后 7 个源 `SKILL.md` 的 sha256 逐一相同；
且仓库门禁的「来源快照完整性」步骤（逐字节比对三个源仓库）仍 **12/12 PASS**。

结果：共享根条目 188 → **180**；我们的入口 `feisheng-vibe-coding` 完整（manifest 93 条全过，实文件 94）。

**退役后 A/B（与算术预测完全吻合，可作为交叉验证）**：

| 宿主 | 基线 | 装我们的包后 | 退役旧条目后 | 期望值 | 一致 |
|---|---|---|---|---|---|
| Claude | 169 | 170 | **162** | 169 − 8 + 1 = 162 | ✓ |
| Codex | 203 | 212 | **204** | 203 − 8 + 9 = 204 | ✓ |

即：Claude 上现在**只有我们的一个入口**登记为技能（旧控制面与 7 个专项都不再是独立技能）；
Codex 上仍是我们的包贡献 9 个条目（第三节那个「Codex 递归枚举嵌套 SKILL.md」的行为不因退役而改变）。

## 九、退役后的残余风险（未验证）

- 用户其它 Agent/项目若按名字直接调用 `audit`、`critique`、`codebase-design` 等，**现在会失败**
  （它们只存在于我们的包内，由控制面按路由委派）。回滚方式：按第 8 节表格，从对应源仓库重建链接/拷贝。
- 退役只影响宿主技能目录，**未触碰任何源仓库内容**。
