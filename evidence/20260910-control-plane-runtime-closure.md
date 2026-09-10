# 控制面 runtime 闭包（accepted）

日期：2026-09-10
关联任务包：tasks/20260910-control-plane-runtime-closure-and-route-binding.md（第 1 步）
前置：evidence/20260910-directory-faithful-runtime-unit.md

## 一、结论

修好了「唯一入口在 runtime bundle 里不可用」这个缺陷。runtime include 文件数 **16 → 65**，
其中控制面从 1 个文件变成 **50 个**。

## 二、缺陷（做路由绑定侦察时发现的）

`governance/sliver-core/SKILL.md` 的 Startup Protocol 明确要求：

1. Load `references/runtime-adapter.md`；
2. 运行 `python3 -B <sliver-runtime-root>/scripts/runtime_decision_contract.py route-catalog --format json`；
3. 按 `references/task-risk-gates.md`、`references/effect-recovery-gates.md`、`references/truth-capture.md`
   等 owner 执行。

而当时的投影**只有** `governance/sliver-core/SKILL.md` 一个文件。实测缺口：

| 项 | 事实 |
|---|---|
| `SKILL.md` 直接引用的 `references/*.md` | 21 个，全部不在 bundle |
| `routes-index.md` 引用的 `references/*.md` | 41 个（目录共 44 个文件） |
| 契约脚本的 import 依赖 | `scripts/validation_support.py` |
| references 引用的其它脚本 | `check_project_guardrails.py`（20 处）、`runtime_governance_contract.py`（6 处） |

即：控制面在 bundle 里**无法按自己的协议运行** → 整个 projection 事实上不可用。
这也是「路由绑定 0 条」为什么当时没有实际效果 —— 路由表本身都不在 bundle 里。

## 三、修法：第三种 bundle 单位（显式路径白名单）

`bundlePolicy` 原有两种单位（`directory` 技能目录、`file` 单文件）。控制面的情况是第三种：
**目录里有大量非运行时材料**（`packaging/` 42K、`tests/` 657K、`plugins/` 56K、`assets/` 121K、
`.github/`、`.agents/`），不能整目录带走，也不能只带一个文件。

因此新增显式路径单位，真源写在 `SKILL-CLASSIFICATION.json` 的控制面记录上：

```json
"bundleRoot": "governance/sliver-core",
"bundlePaths": [
  "SKILL.md", "LICENSE", "references",
  "scripts/runtime_decision_contract.py", "scripts/validation_support.py",
  "scripts/runtime_governance_contract.py", "scripts/check_project_guardrails.py"
]
```

- 目录项递归展开、文件项单文件；**未列出的一律不进**（显式白名单，fail-closed）。
- 生成期校验：条目不存在即报错；展开出的任一路径命中 `forbiddenSegments` 即报错；
  必须包含记录自身的文件且其 sha 等于登记的 `sourceSha256`。
- 实测展开结果：`SKILL.md` + `LICENSE` + 44 个 `references/*.md` + 4 个契约脚本 = **50 个文件**，
  且不含 `packaging/tests/plugins/assets/.github/.agents`（实测检查为空）。

## 四、功能验证（不只是「文件齐全」）

把投影构建到仓库**之外**的临时目录（69 个文件），然后在该 bundle 内部运行契约脚本：

```
python3 -B governance/sliver-core/scripts/runtime_decision_contract.py route-catalog --format json
→ {"schema":"sliver-route-catalog/v1","source":{"path":"references/routes-index.md","sha256":"1b44e3a8…"},
   "routes":[…22 条主路由…]}
```

即：bundle 内的脚本**真的能解析 bundle 内的路由表**，脚本与 references 的相对位置关系成立。
另确认无 `__pycache__` 污染（调 Sliver Python 工具必须带 `-B`，见踩坑 6）。

这条验证是这次改动价值的关键：之前的 bundle 在功能上是不能启动的。

## 五、已知缺口（不沉默）

- **`assets/` 有意未纳入**：`references/*.md` 里引用了 `assets/project-adoption/**`、
  `assets/project-audit/**` 等模板，这些在 bundle 里目前是**悬空引用**（实测确有引用）。
  判断理由：`assets/` 是 bootstrap 阶段复制进**目标项目**的模板材料，不是运行时被读取的 owner 文档；
  且 Sliver 自己的运行时清单把这些列为 overlay_files 而非 skill 内容。
  **若要纳入，只需往 `bundlePaths` 加 `assets`，机制已支持** —— 这是一个可以一步翻转的决定。
- 未做宿主 fresh-session smoke：bundle 从 20 增至 69 个文件，宿主侧**未重新验证**。
- 控制面闭包只覆盖 Sliver 侧；路由绑定（下一步）尚未开始。

## 六、边界

- `bundlePaths` 是显式列表：Sliver 侧新增被引用文件时必须同步更新，否则新文件不进 bundle
  （与技能目录的「枚举 + 排除」相反 —— 控制面刻意选择更保守的一侧）。
- 不修改 `governance/sliver-core/` 内任何内容：本次只改「哪些文件进 bundle」，
  快照字节与 `PROVENANCE-INTEGRITY.json` 均未变化。
