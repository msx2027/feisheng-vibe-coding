# 证据：T2 触发行为验证 + T3 入口修复

- 日期：2026-09-11
- 提交：`507a07f`（入口加启动动作指针）
- 探测脚手架：`_smoke/probe-t2/`（已 gitignore；探测项目为带真实 KeyError 缺陷的 3 文件 Python 小项目）
- 探测消耗：`claude -p` 共 6 次（owner 已授权）；`codex debug prompt-input` 为本地命令，不耗额度

## 方法

全新会话 `claude -p '<中文需求>' --output-format stream-json --verbose --debug-file <log>`，
从流 JSON 精确提取 `tool_use` 调用（Skill 调用、Read 的文件路径、执行的命令），不做推断。
探测目录在仓库 `_smoke` 下（会继承父级内存，已作为污染源识别并记录，见「污染源」）。

## 结果一：D3 机制链路 —— 全部打通（实测观察，非推断）

同一会话内依次观察到（探测 5，`claude-stream-chain.jsonl`）：

1. `Skill {"skill": "feisheng-vibe-coding", "args": "帮我看看这个项目现在有什么风险"}` —— 入口被调用
2. 宿主注入 SKILL.md 正文 + `Base directory for this skill: C:\Users\MSX\.claude\skills\feisheng-vibe-coding`
3. 模型读取包内文件：`governance/sliver-core/SKILL.md`、`references/runtime-adapter.md`（核心中性槽位）、`references/routes-intake.md`
4. 模型**执行包内脚本**：`python -B ...\governance\sliver-core\scripts\runtime_decision_contract.py route-catalog --format json`
5. 选出主路由 **「项目体检」**，查询 `route-projection --route 项目体检 --format json`
6. 加载路由 owner（`routes-intake.md`），对项目实际体检（运行 `inventory.py` 复现 KeyError），产出结构化报告

对应验收：D3 的「选了哪个主路由 / 加载了该路由 owner / 调用了 provider」三项均观察到。

**紧急检查点（用户命令：宿主读不到包内非 SKILL.md 文件则停）：通过。**
宿主能读、能执行包内任意文件（references、scripts 实测动手），「单目录」形态成立，不需要停下来重新决策。

## 结果二：D2 纯自然语言自动触发 —— 未达成（根因已定位）

| 探测 | 触发方式 | Skill 被调用？ | 行为 |
|---|---|---|---|
| 探测 1（真实环境） | 纯中文需求 | **否** | 自由发挥（分析质量高，找到埋的缺陷，但绕开入口；还直接推荐了 `tdd` 技能） |
| 探测 3 | `/feisheng-vibe-coding …` | 否 | `-p` 模式不展开斜杠命令，模型把名字当目录去找 |
| 探测 4 | 「请用 Skill 工具调用 …」 | **是** | 调用后读入口正文，但**猜错控制面路径**（试了 `governance/SKILL.md`），随后自行分析 |
| 探测 5 | 显式指令 + 指路 | **是** | 完整走通控制面链路（见结果一） |
| 探测 6（T3 修复后） | 纯中文需求 | 否 | 同探测 1 |

可用性事实（非行为）：init 事件 `skills` 数组含 `feisheng-vibe-coding`（145 个模型可见技能名）；Skill 工具已提供；
诊断探测（探测 2）中模型自述「带一行描述的技能清单还没出现在对话里」——`-p` 会话里描述是否在决策时可用：**UNVERIFIED**。

### 根因（按影响排序）

1. **宿主侧全局内存对抗（主因，仓库外）**：`C:\Users\MSX\.claude\CLAUDE.md` 的「Skills 路由规则」块
   （镜像自 `C:\Users\MSX\AGENTS.md`，2026-09-08 固化，早于本迁移）明确指示：
   「工程纪律类一律 mattpocock：写测试用 `tdd`……可被自然语言自动触发」、用 `.vibe-docs.json` 判定 vibe 治理项目
   （探测 1、3 中模型两度执行 `Test-Path .vibe-docs.json`，即此规则的直接效果）。
   该块把工程类需求主动引向共享根里的旧独立技能（`tdd`、`code-review`、`vibe-coding-skills` 等）。
   探测 3 的最终回答里模型原话引用了这套规则来论证「不适用 Skills 路由」。
2. **共享根竞争条目**：`tdd`、`code-review`、`mattpocock-code-review`、`vibe-coding-skills` 仍以独立顶层技能存在。
   它们是宿主里更「具体」的技能名，抢走触发。退役它们的前提是 tdd/code-review 先接入我们的包（T4），
   否则会造成用户能力回退——顺序不可反。
3. **薄壳入口缺少第一跳指针（已修，`507a07f`）**：入口正文只说「由 `governance/` 统一拥有」，
   没给文件路径；探测 4 中模型猜 `governance/SKILL.md` 猜错。修复后入口第一条指令就是读
   `governance/sliver-core/SKILL.md` 并执行其 Startup Protocol，禁止跳过控制面作答。
   该修复对「技能已被引用」的一切路径生效（显式请求、交互式 `/` 命令、owner 记忆指向等）。

### 结论

- D2 当前**不绿**。在本机，纯自然语言触发被宿主侧全局路由宪法压制；这不是仓库内任何文件的缺陷，
  修它需要 owner 决定是否更新 `~/.claude/CLAUDE.md`（及镜像 `C:\Users\MSX\AGENTS.md`）的路由块——该文件不在本仓库授权范围内。
- D3 机制**全绿**：入口一旦被引用（无论何种方式），控制面链路必然可达、可执行（T3 修复后连猜路径这一步也消除了）。

## 探测污染源记录（后续探测必须规避）

- 探测目录在 `F:\skiils工具\` 树下 → 会继承用户全局与父级内存（`~/.claude/CLAUDE.md`、仓库 AGENTS.md）。
  Codex 侧实测把本仓库 AGENTS.md 注入了会话（`codex-prompt-input.txt` 可见）。干净行为探测应把项目放在仓库树外。
- 探测 5 里模型注意到上一轮留下的调试日志文件（目录复用污染），已在新目录（project-clean）复测规避。

## 门禁与安装状态

- `507a07f` 后本机 `verify.ps1 -IncludePackage` = **13/13**；fresh clone 四组合（autocrlf true/false × pwsh/PS5.1）全部 **13/13**
- 共享根已重装宿主中性投影（92 文件，`feisheng-shared-runtime-projection/v1`，sourceRevision = `507a07f`，Validate 通过）
- Codex 可用性复测：`codex debug prompt-input` 共 204 条目，含根入口（带完整描述）、控制面（以 `sliver-vibe-coding` 名字出现，决策 #2 已知代价）、7 个已接入技能嵌套条目

## UNVERIFIED / 待 owner 决定

- D2 自动触发在「全局路由块更新后」是否转绿：UNVERIFIED（需 owner 决定后复测）
- `-p` 会话中技能描述是否进入模型决策上下文：UNVERIFIED（模型自述没有；无宿主侧日志可证）
- `tdd`/`code-review` 接入评估（T4）：等 D2 方向定了再动（它们正是全局路由块的指向目标，接入与退役要配套）
