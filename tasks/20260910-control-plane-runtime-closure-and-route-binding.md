# Task 20260910-control-plane-runtime-closure-and-route-binding

状态：第 1 步 accepted（控制面 runtime 闭包已完成，见 evidence/20260910-control-plane-runtime-closure.md）；第 2 步（路由绑定）open

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

### 第 2 步：路由绑定

绑定**必须写在路由 owner 里**（不得在根 `SKILL.md` 或 README 里另建第二份路由表）。
两条候选路径，实施时择一并记录理由：

- **方案 A（推荐，改动小）**：在 `routes-index.md` 相关 route 的 `Load` 列中，把已接入技能作为**附加 owner** 列出
  （如 `开发执行` 的 `Load` 里加 `skills/engineering/diagnosing-bugs/SKILL.md`）。
  必须先用 `runtime_decision_contract.py` 实测该列是否被校验、以及非 `references/` 路径是否被接受。
- **方案 B**：在 route 的 reference owner 文件（如 `references/development-execution-core.md`）里新增
  「技能调用点」小节，声明何时调用哪个技能。更贴合 Sliver 语义（Load 列是 reference owner），但需要改 reference 内容。

两条路径都会修改 vendored 内容 → 必须登记 `LOCAL-PATCHES.json` + 重算 `PROVENANCE-INTEGRITY.json`（见 2.4）。

绑定内容来源：`SKILL-CLASSIFICATION.json` 的 `duplicateGroups[].rule`（11 组已给出唯一 owner 与分工）。
至少覆盖当前已接入的 8 条记录：`audit`、`critique`、`harden`、`optimize`、`codebase-design`、`diagnosing-bugs`、
`domain-modeling`、`sliver-vibe-coding`（后者是控制面自身，不需要绑定）。

新增门禁（`verify.ps1`）：每条 runtime 已接入的技能记录必须在路由 owner 里有**唯一命中**，
且不得引入第二入口（与既有 `duplicateGroups` / `entryAliases` 检查一致）。

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
