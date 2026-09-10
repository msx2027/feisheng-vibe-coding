# Task 20260910-host-smoke-claude-discovery

状态：accepted（主 Agent 本地复验；用户已明确授权一次真实宿主安装 + smoke）

## 唯一目标

在用户授权下，对 Claude Code 做一次真实宿主 smoke，验证仓库自述的未验证项
「fresh-session discovery」，并把结论与发现固化为证据与可复现脚本。

## 不做事项

- 不覆盖、不修改宿主任何**既有**技能目录。
- 不自造安装集：安装内容必须由 Sliver 自带 `build_runtime_bundle.py` 按 `runtime-manifest.json` 产出。
- 不修改三个来源项目（含不为消错而改 Sliver 模板资产）。
- 不声称 trust / 技能行为 / Hook 强制已验证。
- 不把宿主 smoke 接入 `verify.ps1`（会消耗真实额度）。

## 允许写入

- `scripts/smoke-claude-skill-discovery.ps1`
- `evidence/20260910-host-smoke-claude-discovery.md`、本任务包
- `packaging/runtime-projection.json`（精确记录验证范围）
- `docs/HANDOFF.md`
- 宿主：仅新建 `~/.claude/skills/sliver-vibe-coding`（76 文件，可一键回滚）

## 验收与停止条件

- bundle 由产品自带工具构建，文件集符合白名单（禁入项不出现）。
- 安装只新增、不覆盖；产出回滚命令与装机清单。
- A/B 全新会话给出可判定的发现性结论（delta ≥ 1 为已发现）。
- 深度校验若因缺受信任基线不可完成，必须如实报告为 UNAVAILABLE，不得记为通过。
- 结论不得越界声明 trust / 行为 / Hook。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验 1：`build_runtime_bundle --target claude-code` → PASS，76 文件（禁入路径均未进入）。
- 复验 2：`validate_runtime_bundle` → UNAVAILABLE，原因 `trusted runtime baseline Git object is unavailable: 29695fe0…`（本地源仓库非浅克隆但不含该对象）。
- 复验 3：A/B 全新会话 → 169（装）vs 168（移出），delta=1 → **DISCOVERED**；加载根 `user=~/.claude/skills`。
- 复验 4：发现 3 个上游模板资产触发 Claude Code YAML frontmatter 解析失败（Sliver 上游问题，不改字节）。
- 复验 5：复现脚本 `-Probe` 独立跑通并复现同一结论（169 vs 168，`discoveryVerdict=DISCOVERED`）。
- 决定：本任务 accepted。已安装状态保留，回滚命令见证据；Codex 侧 smoke 与 trust/Hook 验证仍待后续。
