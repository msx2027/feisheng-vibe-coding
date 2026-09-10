# 路由绑定（accepted）

日期：2026-09-10
关联任务包：tasks/20260910-control-plane-runtime-closure-and-route-binding.md（第 2 步）
关联补丁：provenance/LOCAL-PATCHES.json → `sliver-route-binding-capability-providers`

## 一、结论

「路由绑定 0 条」已消除：**7 条已接入技能全部在路由侧被显式引用，且唯一命中一次**，
并由新门禁 `scripts/validate-route-bindings.ps1` 强制（verify 步骤 `3b)`）。runtime include 文件数不变（65）。

| 指标 | 之前 | 现在 |
|---|---|---|
| 被路由引用的已接入技能 | 0 | **7 / 7** |
| 绑定 owner 文件 | 无 | 1（`references/engineering-execution.md`） |
| 门禁 | 无 | 4 条 fail-closed，7 个反例实测全部按预期失败 |

## 二、为什么绑定形态是「写进 owner 文档内容」

### 2.1 最直观的做法被机器校验排除

`governance/sliver-core/scripts/runtime_decision_contract.py` 里：

- `"skill"` 出现 **0 次**（Sliver 契约模型没有「技能」这个一等概念）；
- 路由表第 4 列 `Load` 受校验，但 `LOADED_OWNER_IDS` 是 **10 个抽象 owner 类别**
  （`routes`、`task_depth`、`testing`、`effect_recovery`、`risk_control`、`studio_execution`、
  `project_flow`、`plan_artifact`、`truth_capture`、`audit_artifact`），**不是文件路径**，未知 id 直接 `raise`。

⇒ 往 `Load` 列塞 `skills/<group>/<id>/SKILL.md` **不是合法绑定**。绑定只能落在
**Load 列已经指向的 reference owner 的内容里**。

### 2.2 为什么只选 1 个 owner 文件

候选比对（`grep -o "references/<file>.md" routes-index.md | wc -l`）：

| owner 文件 | 被 Load 命中 | 判断 |
|---|---|---|
| `references/engineering-execution.md` | **9** | ✅ 采用 |
| `references/architecture-patterns.md` | 1 | 语义贴合（有 Domain Modeling Axis），但只在 `技术选型` 加载 |
| `references/development-execution-core.md` | 每深度 | ❌ 它是 bounded D1 的**紧凑路径**，不该被 provider 清单加重 |

采用 `engineering-execution.md` 的理由：它已拥有 `Owner-Layer Rules`（模块/owner 层归属）、
`Debug Evidence Ladder`（诊断）、`Verification Matrix`（验证）——正是这 7 个 provider 的语义邻域；
被 9 处 Load 命中（`报错救援`、`安全审计`、`代码审计`、`验收`、`发布准备`、`上下文交接` 为 base，
`开发执行` 的 D2/D3 与 `frontend-design`/`security-impact` lens 为条件加载），所以绑定真的可达；
且**单一绑定 owner** 让「唯一命中」门禁最干净（多文件会引入跨文件重复的判断）。

## 三、绑定了什么

新增小节 `## Internal Capability Providers`（在 `Owner-Layer Rules` 与 `Anti-Patterns` 之间），
声明 provider 是**受限能力提供者**：只返回 finding / 选项 / 已证明的诊断，绝不选择主路由、
不改任务深度、不判定 action effect、不写项目真源；加载 provider 不替代任何 reference owner 或验收门。
并写明：frontmatter 禁止自然语言独立触发的 provider **只能由这次委派到达**（条件即为触发，不是用户关键词）。

| Provider | 加载条件 | 依据 |
|---|---|---|
| `skills/checker/audit/SKILL.md` | 某个已界定区域需要专项可访问性/性能/主题/响应式/反模式审计 | `review-and-test` 组规则 |
| `skills/checker/critique/SKILL.md` | 某区域、界面或设计产物在集成/验收前需要产品与设计批评 | 同上 |
| `skills/checker/harden/SKILL.md` | 用户可见界面要达到生产可用：错误处理、空状态、引导、i18n、文本溢出、边界 | 同上 |
| `skills/checker/optimize/SKILL.md` | 请求目标就是用户可感知的性能问题（慢、卡、jank） | 同族 + 技能 description |
| `skills/engineering/diagnosing-bugs/SKILL.md` | bug/失败测试/flaky/性能回退已经扛过简单修复，Debug Evidence Ladder 需要诊断回路 | `bug-rescue` 组规则 |
| `skills/engineering/codebase-design/SKILL.md` | 设计问题是模块接口、深化机会、seam 位置、owner 层的可测性与 AI 可导航性 | `architecture` 组规则 |
| `skills/engineering/domain-modeling/SKILL.md` | 需要澄清或维护项目术语、通用语言、架构决策记录（写入仍受 `target-truth` 约束） | `architecture` 组规则 |

绑定内容**没有引入新决策**：全部来自 `SKILL-CLASSIFICATION.json` 的 `duplicateGroups[].rule`
（11 组既有裁决给出的唯一 owner 与分工）。也没有引入第二份路由表 —— 它写的是「条件 → 能力提供者」，
不是 route → reference 映射。

## 四、门禁（唯一实现：`scripts/validate-route-bindings.ps1`）

策略真源 = `SKILL-CLASSIFICATION.json` 的 `routeBinding`（`ownerFiles` / `exemptRecords`）。
已接入集合不重新推导，直接取 `CANONICAL-CATALOG.json` 里**有 `bundle`** 的记录（生成物即事实）。

fail-closed 项：

1. 缺 `routeBinding` 策略 / `ownerFiles` 为空 / owner 文件不存在 → throw；
2. 每条已接入记录在绑定 owner 里命中次数必须 **恰为 1**（0 = 控制面看不见该技能；>1 = 重复入口）；
3. 绑定 owner **之外**的任何 `references/*.md` 出现技能路径 → FAIL（第二入口）；
4. 绑定 owner 里出现**未被 runtime 接入**的技能路径 → FAIL（绑定不得越权）。

自检：owner 文件读取数量 == 声明数量；references 扫描数量 == 枚举数量。

### 反例实测（7/7 按预期，每次在干净临时树上跑）

| 反例 | 结果 |
|---|---|
| 基线 | **PASS**（bound 7/7，scanned 44） |
| 删掉一条绑定（harden） | **FAIL** — 命中次数 0 |
| 同一条绑定出现两次（audit） | **FAIL** — 命中次数 2 |
| 别的 reference 文件也引用技能 | **FAIL** — `绑定 owner 之外出现技能路径（第二入口）: audit-artifact.md` |
| owner 里绑定未接入技能（tdd） | **FAIL** — `绑定 owner 引用了未接入的技能: skills/engineering/tdd/SKILL.md` |
| 删除 `routeBinding` 策略 | **throw**（fail-closed） |
| `ownerFiles` 指向不存在的文件 | **throw**（fail-closed） |

## 五、vendored 补丁

`references/engineering-execution.md` 是 Sliver 快照内容，修改属于本地补丁，已登记：

- 补丁 id：`sliver-route-binding-capability-providers`，`snapshot: sliver-core`，
  `sourceRevision: 30c7cfb3…`；
- `originalSha256 = b7f30562cf2c020087414620c920220ee74d0953f876ea6064b80047b74734a1`
  `patchedSha256 = 31f4edbf8044f663e62f45c06893c5aa3d60a40f92094ad492c74efa6f93a02f`（+24 行）；
- 插入**只增不改**：`git diff --stat` 显示 24 行新增、0 删除，且沿用文件原有 CRLF（无换行漂移）；
- `PROVENANCE-INTEGRITY.json` 已用 `record-provenance-integrity.ps1` 重算
  （该脚本会接受已登记补丁：快照须等于 `patchedSha256`、来源仍须等于 `originalSha256`）；
- 回滚路径：`originalSha256` 可从 `sourceRevision` 的工作树逐字节恢复。

## 六、已验证 / 未验证

- **已验证**：`pwsh` 与 Windows PowerShell 5.1 均 **12/12**；门禁 7 个反例；
  绑定 owner 内的 provider 条件与 `duplicateGroups` 规则一致；
  新目录 clone（`core.autocrlf` = true / false）均 12/12。
- **未验证**：宿主是否真的按这个绑定去委派技能（无 fresh-session smoke）；
  provider 在宿主中的实际行为；Hook 仍然禁用。
- **边界**：`bundlePaths` 与 `routeBinding.ownerFiles` 都是显式白名单 —— Sliver 侧或技能侧新增内容时
  必须同步更新，否则新内容不进 bundle / 新技能不会被门禁要求绑定（这是刻意选的保守侧）。
- 本次只绑定 runtime 已接入的 7 个技能；其余 74 条记录（`blocked` / `source-only`）**不得**出现在绑定 owner 里，
  门禁第 4 条正好守住这一点。
