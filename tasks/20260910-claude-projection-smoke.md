# Task 20260910-claude-projection-smoke

状态：accepted（主 Agent 已复验）

## 唯一目标

实现一个不修改源目录的最小 Claude runtime projection 生成/验证脚本 `scripts/build-claude-runtime-projection.ps1`，只从 `provenance/CANONICAL-CATALOG.json` 读取 control-plane 与 `accepted-primitive` 记录，复用 Codex 投影同一套门禁（唯一入口、blocked 排除、sources/hooks/镜像段拒绝、逐文件 SHA、Build/Validate 双模式），并加入 Sliver Claude adapter 的薄入口与宿主事实文件；在全新临时目录执行一次 smoke，并把结果写入证据。

## 不做事项

- 不启用真实宿主安装。
- 不复制任何 Vibe/Matt 全量镜像、`.claude/`、`.agents/`、`.codex/`、hooks。
- 不把 Claude 投影写成真实宿主可用（fresh-session smoke 保持 UNVERIFIED）。
- 不修改 canonical catalog、license map、owner ledger 或三个来源项目。
- 不引入第二个 runtime owner（脚本是 Claude 投影的唯一 writer）。

## 允许写入

- `scripts/build-claude-runtime-projection.ps1`
- `packaging/runtime-projection.json`（仅更新 claude host 的 status/include，须同步 buildContract 与 manifest；若既有结构与 Codex 一致则保留）
- `evidence/20260910-claude-projection-smoke.md`
- `tasks/20260910-claude-projection-smoke.md`

## 输入基线

- 目标仓库：`F:\skiils工具\feisheng-vibe-coding`
- 基线提交：`7a76866fc847d686f404c9767c566f0cb40ab8c4`
- canonical catalog：control-plane 1、accepted-primitive 3、blocked 2
- Sliver Claude adapter 资产：`governance/sliver-core/packaging/adapters/claude/assets/project-claude/CLAUDE.md`（内容 `@AGENTS.md`）、`references/runtime-adapter.md`

## 验收与停止条件

- 在全新临时目录 `Build` 后同一目录 `Validate` 均退出码 0。
- 输出包含：唯一入口 `SKILL.md`、Sliver control-plane、3 个 accepted primitives、`CLAUDE.md` 薄入口、`runtime-adapter.md`、1 个 manifest；blocked（code-review/tdd）不得出现。
- 输出不得包含 `sources/`、`.agents/`、`.claude/`、`.codex/`、`hooks/`、`codex-hooks/`、`generated-mirrors/`。
- 输出不得出现第二个项目入口、第二 route catalog 或 Vibe/Matt 全量镜像。
- 真实宿主 fresh-session smoke 必须保持 `UNVERIFIED`，不得伪称已安装。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验：`scripts/build-claude-runtime-projection.ps1` 在全新临时目录 Build/Validate 均退出码 0、`status: PASS`；输出 8 文件（7 批准输入 + 1 manifest），blocked（code-review/tdd）未进入输出，sources/hooks/镜像段未进入输出，顶层仅 SKILL.md + CLAUDE.md + manifest。
- 复验：Codex 投影脚本未改动，重跑 Build 仍 PASS（输出 6 文件），无第二个 runtime owner。
- 决定：本任务 accepted；Claude 投影登记为 `candidate-unverified; static-smoke-only`，真实宿主 fresh-session smoke 保持 `UNVERIFIED`，未写入真实宿主目录。
