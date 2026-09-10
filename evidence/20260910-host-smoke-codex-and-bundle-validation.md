# 宿主 smoke（第二轮）：深度校验解锁 + Codex 发现性验证

日期：2026-09-10
授权：用户授权 ① 对来源仓库做一次 `git fetch` 以解锁深度校验；② Codex 侧 discovery smoke。
关联任务包：tasks/20260910-host-smoke-codex-and-bundle-validation.md（accepted）
复现脚本：`scripts/smoke-host-skill-discovery.ps1`（`-TargetHost Claude|Codex|Both`，`-FetchTrustedBaseline` / `-Install` / `-Uninstall` / `-Probe`）
脚手架位置：`<repo>/_smoke/`（已 gitignore；按 owner 要求放在项目根目录，总目标完成后统一清理）

## 一、① 深度校验：已解锁并通过

上一轮阻塞：`validate_runtime_bundle` 需要「受信任基线 git 对象」`29695fe099c6b38c9b5c470abbb2e065fc1ff936`，
本地来源仓库不含该对象（非浅克隆，但**不在任何本地分支/标签的历史里**）。

本轮授权后诊断与处置：

| 步骤 | 结果 |
|---|---|
| `git fetch origin` | 成功，但对象仍不可达（不在 `origin/main`、`origin/codex/pr4-integration`，也不在 7 个 tag 里） |
| `git fetch origin --tags` | 成功，对象仍不可达 |
| **`git fetch origin <SHA>`（按 SHA 直连）** | ✅ **成功**，对象进入本地对象库（`git cat-file -t` → `commit`） |
| 来源仓库工作树 | 未被改动（fetch 只写 `.git`）；HEAD 仍 `30c7cfb3` |

获得对象后，两个宿主的 bundle 深度校验**双双通过**：

```text
OK: claude-code runtime bundle validated (76 files); static/package proof only, fresh-session behavior not evaluated
OK: codex       runtime bundle validated (78 files); static/package proof only, fresh-session behavior not evaluated
```

值得记录：校验器自己的措辞就是「static/package proof only, fresh-session behavior not evaluated」——
与我们的两层结论完全一致（静态/包层已校验；fresh-session 行为由 A/B smoke 单独验证）。

**关键细节**：调用 Sliver 的 Python 工具必须带 `-B`。上一轮未带 `-B` 时在
`governance/sliver-core/scripts/` 生成了 `__pycache__/*.pyc`，**被我们自己的 provenance 门禁当场拦下**
（快照 220 → 224）。本轮全程 `python -B`，快照保持 220 不变。

## 二、② Codex 侧 discovery：VERIFIED

用 `codex debug prompt-input`（输出**模型可见输入**的 JSON）做 A/B，判定依据是「技能计数」与「该技能出现的技能根」：

| 阶段 | Available skills | 该技能出现的根 | 判定 |
|---|---|---|---|
| 未装 codex 专属 bundle | 203 | `r1` | 基线 |
| 装入 `~/.codex/skills/sliver-vibe-coding` | **204** | **`r0` + `r1`** | **DISCOVERED** |

实际条目（模型可见）：

```text
- sliver-vibe-coding: Use when technical and non (file: r0/sliver-vibe-coding/SKILL.md)
- sliver-vibe-coding: Use when technical and non (file: r1/sliver-vibe-coding/SKILL.md)
```

于是：

- ✅ **Codex 通过它自己文档指定的 install root（`r0` = `~/.codex/skills`）发现并注册了该技能**；
- ✅ Claude 侧上一轮已验证（`user=~/.claude/skills`，A/B 169 vs 168）。

## 三、两个新的宿主事实（对打包设计有直接影响）

1. **`:~/claude/skills` 与 `F:\skiils工具\_adapters\shared\skills` 是同一个目录（junction）**，
   且 Codex 把后者作为它的技能根 `r1` 之一。**所以一次安装（装在共享根）两个宿主都能发现。**
   实测证据：未装 codex 专属 bundle 时，Codex 已经通过 `r1` 看到我们的技能。
   据此本轮**移除了冗余的 codex 专属安装**，避免同一技能在两个根上重复注册。
2. **Codex 会把仓库根 `AGENTS.md` 注入为指令**：在仓库目录下运行时，模型可见输入里出现
   `# AGENTS.md instructions for F:\skiils工具\feisheng-vibe-coding <INSTRUCTIONS>…`，并附带
   `<environment_context>`（cwd / workspace_roots / permission_profile）。
   → **缺口**：我们的 Codex 投影（`packaging/runtime-projection.json` 的 `codex.include`）**不含 `AGENTS.md`**，
   而它才是 Codex 识别「项目入口/指令」的真实机制。已作为待补项记录。

## 四、当前宿主安装状态（可一键回滚）

| 位置 | 状态 | 说明 |
|---|---|---|
| `~/.claude/skills/sliver-vibe-coding` | **已安装（76 文件）** | 共享根，Claude 与 Codex 都能发现 |
| `~/.codex/skills/sliver-vibe-coding` | 已卸载 | 验证完成后移除，避免重复注册 |
| `~/.codex/skills/+` | 已清理 | 本轮脚本 bug 误建的目录（见下），已删除 |
| 宿主既有技能目录 | 未改动 | 探测用「临时移出再放回」做 A/B，不触碰既有内容 |

回滚：`Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\skills\sliver-vibe-coding"`

## 五、脚本交付与过程中修掉的 bug

`scripts/smoke-host-skill-discovery.ps1`（取代上一轮的单宿主脚本）：按宿主构建/校验/安装/卸载/探测，
全部脚手架写入 `<repo>/_smoke/`，一律 `python -B`，受信任基线 SHA **从 Sliver 自己的 baseline 记录读取**（不硬编码）。

过程中修掉一个真实 bug：`Join-Path $env:USERPROFILE '.codex/skills/' + $skillId` 中的 `+` 被当作**字面参数**，
导致装到 `~/.codex/skills/+/sliver-vibe-coding`。已加括号修正为单表达式，并清理了误建目录。
（这类「脚本装错地方」正是必须实测而不能只靠静态检查的原因。）

## 六、仍未验证（未越界声明）

- 宿主 **trust**（是否把技能指令当权威执行）。
- 技能**行为正确性**（端到端是否按契约工作）。
- **Hook 强制**（pre-action 拦截）——适配器文档亦声明为未验证。
- 我们自己的 **Codex 投影**（含 AGENTS.md 缺口）尚未做过它自身的 discovery smoke；
  本轮验证的是 Sliver 控制面 bundle 在 Codex 上的发现机制。
