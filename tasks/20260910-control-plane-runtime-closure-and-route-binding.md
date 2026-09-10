# Task 20260910-control-plane-runtime-closure-and-route-binding

状态：**两步均 accepted**。第 1 步见 evidence/20260910-control-plane-runtime-closure.md；第 2 步（路由绑定）见 evidence/20260910-route-binding.md。

第 2 步实际采用的形态：绑定写在 `references/engineering-execution.md`（被 Load 命中 9 次的执行主干 owner，已拥有 Owner-Layer Rules / Debug Evidence Ladder / Verification Matrix）新增的 `## Internal Capability Providers` 小节里；门禁 = `scripts/validate-route-bindings.ps1`（verify 步骤 `3b)`），策略真源 = classification 的 `routeBinding`。7 条已接入技能全部唯一命中；7 个反例实测全部按预期失败。

> 本任务包是「继续做路由绑定」的**压缩上下文**：读完本文件即可继续，不需要对话历史。

## 一、目标（两步，顺序不可反）

1. **控制面 runtime 闭包**（前提，本轮先做）
2. **路由绑定**（用户要求的交付，建立在第 1 步之上）

原因见第二节：不改第 1 步而直接做第 2 步，会产出「运行时看不见的绑定」。

## 二、侦察事实（全部为实测，不是推测）

### 2.1 路由真源与它的机器约束

- 路由唯一 owner：`governance/sliver-core/references/routes-index.md`（`OWNER-LEDGER.json` 中 `route-catalog` 声明 `writes: primary-route / operation / conditional-lens / reference-loading`，排他）。
- 该文件被 **`governance/sliver-core/scripts/runtime_decision_contract.py`（1466 行）严格解析校验**：
  - 必须有 `Primary Workflow Routes` 段、canonical 表头、合法 separator；
  - `Operation -> delivery projection` 列必须是 `<op> -> <delivery>[, <delivery>]*`，delivery 取值受白名单约束（含 `direct_artifact`）；
  - 解析器同时被 `scripts/evaluate_routes.py` 等消费（不允许复制第二份表）。
- 表格 4 列：`Route | Purpose and operation rule | Operation -> delivery projection | Load`。
  `Load` 列目前**只列 `references/*.md`**。
- 该文件顶部明确写：`SKILL.md`、README、validators、平台适配器**都不得复制第二份 route-to-reference 表**。

### 2.2 「路由绑定 0 条」的真实含义（比交接里写的更严重）

```
grep -rln "code-review|critique|harden|diagnosing-bugs|codebase-design|domain-modeling" governance/sliver-core/references/
→ 无任何结果
```

即 Sliver 侧**从来没有**技能调用点。要让已接入技能被路由，必须新增一层（见第三节方案）。

### 2.3 控制面在 runtime bundle 里是残缺的（本任务真正的前提缺口）

`governance/sliver-core/SKILL.md` 的 Startup Protocol 要求：

- Load `references/runtime-adapter.md`；
- 运行 `python3 -B <sliver-runtime-root>/scripts/runtime_decision_contract.py route-catalog --format json`；
- 按 `references/task-risk-gates.md`、`references/effect-recovery-gates.md`、`references/truth-capture.md` 等 owner 执行。

而当前投影**只有** `governance/sliver-core/SKILL.md` 一个文件（`scope=file`，见 `docs/CAPABILITY-INDEX.md`）。实测缺口：

| 项 | 数量/事实 |
|---|---|
| `SKILL.md` 直接引用的 `references/*.md` | **21 个**，全部不在 bundle |
| `routes-index.md` 引用的 `references/*.md` | **41 个**（`references/` 共 44 个文件） |
| 契约脚本依赖 | `scripts/runtime_decision_contract.py` + `scripts/validation_support.py`（唯一 import 依赖） |
| references 引用的其它脚本 | `scripts/check_project_guardrails.py`（20 处）、`scripts/runtime_governance_contract.py`（6 处）、`scripts/runtime_decision_contract.py`（1 处） |
| references 引用的 assets | `assets/project-adoption/**`、`assets/project-audit/**` 等模板 |
| references 是否引用目录外文件 | 否（`../` 引用实测为空） |
| 目录体积 | `references/` 616K、`scripts/` 1.3M、`assets/` 121K、`tests/` 657K、`packaging/` 42K |

**结论**：控制面在 bundle 里无法按自己的 Startup Protocol 运行 → 现在的 runtime projection 事实上不可用（唯一入口不可用）。这也解释了为什么「路由绑定」当前无 runtime 效果。

### 2.4 修改 vendored 内容的约束

`governance/sliver-core/` 是 Sliver 只读快照，受 `provenance/PROVENANCE-INTEGRITY.json` 的 treeHash 校验。
任何对其内容的修改都是**本地补丁**，必须登记 `provenance/LOCAL-PATCHES.json`（含 `originalSha256`），
并重算 `PROVENANCE-INTEGRITY.json`。已有 3 个先例（`sliver-template-frontmatter-quoted`）。

## 三、设计（已定，实施时照此执行）

### 第 1 步：控制面 runtime 闭包

机制：给 `SKILL-CLASSIFICATION.json` 的控制面记录新增**显式路径白名单**字段，由生成器展开成 `bundle`：

```json
"sliver-vibe-coding": {
  "domain": "control-plane", "readiness": "runtime", "source": "sliver-vibe-coding",
  "writeAuthority": ["route-catalog","target-truth","validation-gate"],
  "bundleRoot": "governance/sliver-core",
  "bundlePaths": [
    "SKILL.md", "LICENSE",
    "references",
    "scripts/runtime_decision_contract.py", "scripts/validation_support.py",
    "scripts/runtime_governance_contract.py", "scripts/check_project_guardrails.py"
  ]
}
```

- `bundlePaths` 里目录项递归展开；文件项单文件。未列出的一律不进 → **显式白名单，fail-closed**。
- 生成器（`build-canonical-catalog.ps1` 的 `Get-BundlePlan`）新增「显式路径单位」（`scope=explicit`），
  与既有 `directory`（技能目录）/ `file` 三种单位共存；策略描述写进 `bundlePolicy`。
- **`assets/` 有意不纳入**（本轮）：它是 bootstrap 时复制进**目标项目**的模板材料，不是运行时被读取的 owner 文档。
  代价：references 里对 `assets/**` 的引用在 bundle 内是悬空引用 —— **必须记入证据的已知缺口**，不得沉默。
  （若 owner 认为该纳入，只需往 `bundlePaths` 加 `assets`，机制已支持。）
- 实测效果（已完成）：runtime include 文件 16 → **65**；控制面 1 → **50** 个文件。
  功能验证：在仓库外的投影 bundle 内运行契约脚本成功解析出 22 条路由（证明不是「文件齐全但跑不起来」）。

### 第 2 步：路由绑定（设计约束已实测，方案待 owner 确认）

**实测约束（关键，先说结论）**：`runtime_decision_contract.py` 里 `"skill"` 出现 **0 次**；
`LOADED_OWNER_IDS` 是 10 个**抽象 owner 类别**（`routes`、`task_depth`、`testing`、`effect_recovery`、
`risk_control`、`studio_execution`、`project_flow`、`plan_artifact`、`truth_capture`、`audit_artifact`），
**不是文件路径**；对未知 id 会 `raise ContractError`。

⇒ **Load 列是「owner 概念」而不是「文件清单」，把 `skills/<group>/<id>/SKILL.md` 直接塞进 Load 列
不符合 Sliver 的契约模型**（且 Sliver 完全没有「技能」这个一等概念）。所以方案 A 已排除。

**这一步是 owner/语义决策**（哪些 route 在什么条件下调用哪个技能，等于扩展路由语义），
按仓库规则「路由必须各有唯一 owner」，应由 owner 拍定形态后实施。三个候选：

| 方案 | 做法 | 代价 | 评价 |
|---|---|---|---|
| **1（推荐）** | 在相关 route 的 **reference owner 文件**（Load 列已指向的 md）里新增「内部技能调用点」小节，声明「条件 → 技能路径 → 分工」 | 内容层改动，**不动 Python 契约**、不动表结构；需 `LOCAL-PATCHES.json` 登记 | 最贴合 Sliver 设计（Load 指向的 owner 负责说明能力）；改动面可控（预计 2–3 个 owner 文件） |
| 2 | 新增我们自己的集中 owner 文件（如 `references/internal-skill-bindings.md`），加进相关 route 的 Load 列 | 需同时改 `LOADED_OWNER_IDS`（机器校验核心） | 绑定集中、易审查，但改动直击契约校验器，风险最高 |
| 3 | 只在根 `SKILL.md`（我们的入口）声明技能清单，不动 Sliver | 最小 | Sliver 路由仍不引用技能 ⇒ 绑定效果最弱；且容易被判为「第二份路由表」 |

推荐方案 1，理由：绑定内容**已经存在**（`duplicateGroups[].rule` 的 11 组裁决给出了唯一 owner 与分工），
只需把它落到 route 的 owner 文档里；且不改机器校验层，风险最低。

**绑定内容的来源（不需要新决策）**：`SKILL-CLASSIFICATION.json` 的 `duplicateGroups[].rule`。
需绑定的已接入技能（8 条记录去掉控制面自身 = 7 个）：
`audit`、`critique`、`harden`、`optimize`、`codebase-design`、`diagnosing-bugs`、`domain-modeling`。

**新增门禁（`verify.ps1`）**：每条 runtime 已接入的技能记录必须在路由绑定 owner 里有**唯一命中**；
反例（删掉一条绑定）必须使门禁失败。

## 四、不做事项

- 不把 Sliver 的 `packaging/`、`tests/`、`plugins/`、`.github/`、`.agents/` 纳入 bundle。
- 不把 `assets/` 纳入（本轮），但要如实记录为缺口。
- 不在根 `SKILL.md` / README / 适配器里建第二份路由表。
- 不放宽既有门禁（禁止段、blocked、写权限排他、NOTICE、保真树换行、bundle 显式白名单）。
- 不做宿主安装 / fresh-session smoke；不声称宿主行为已验证。
- 宿主 trust / 行为 / Hook 仍 `UNVERIFIED`。

## 五、验收

- 控制面 bundle 含 `SKILL.md` + `references/**` + 4 个契约脚本 + `LICENSE`，且不含 packaging/tests/plugins/assets。
- 生成器对显式路径单位 fail-closed：路径不存在即报错；白名单文件命中禁止段即报错。
- `runtime_decision_contract.py` 在 bundle 内的路径关系仍成立（脚本与 references 的相对位置不变）。
- 路由绑定：已接入技能在路由 owner 里有唯一命中；反例（去掉一条绑定）使新门禁失败。
- `pwsh scripts/verify.ps1 -IncludePackage` 全绿；**且新目录 clone 三种 `core.autocrlf` 配置均全绿**
  （生成器改动一律必须跑 fresh clone，见 HANDOFF 踩坑 21）。
- vendored 修改已登记 `LOCAL-PATCHES.json`，`PROVENANCE-INTEGRITY.json` 已重算，来源快照完整性门禁仍通过。

## 六、起点（接手时先跑这几条）

```bash
cd F:/skiils工具/feisheng-vibe-coding
git log --oneline -3                       # 起点提交：3b360ad（目录忠实 + 证据）
pwsh -NoProfile -File scripts/verify.ps1 -RepositoryRoot . -IncludePackage   # 起点应为 11/11
python -c "import json;d=json.load(open('provenance/CANONICAL-CATALOG.json',encoding='utf-8'));print([ (r['id'],r['bundle']['scope'],len(r['bundle']['files'])) for r in d['records'] if r.get('bundle')])"
```
