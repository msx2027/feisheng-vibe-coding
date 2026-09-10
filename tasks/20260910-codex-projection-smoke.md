# Task 20260910-codex-projection-smoke

## 状态

accepted

## 验收备注

最小 Codex 候选投影在新临时目录生成成功，共 12 个文件；blocked 技能和旧生成清单未进入输出。真实宿主安装与 fresh-session smoke 仍为 `UNVERIFIED`。

## 唯一目标

实现一个不修改源目录的最小 Codex runtime projection 生成/验证脚本，只从 `provenance/CANONICAL-CATALOG.json` 读取 `accepted-primitive` 与 control-plane 记录，复制已批准路径并拒绝 blocked、generated mirror、未授权 Hook；在临时输出目录执行一次 smoke，并把结果写入 evidence。

## 不做事项

- 不启用真实宿主安装。
- 不生成 Claude 投影。
- 不复制任何 Vibe/Matt 全量镜像。
- 不修改 canonical catalog 或 source snapshot。

## 允许写入

- `packaging/`
- `scripts/`
- `evidence/20260910-codex-projection-smoke.md`

## 基线

目标仓库 `925f507`；canonical catalog 当前包含 1 个 control-plane、3 个 accepted primitive、2 个 blocked record。

## 验收与停止条件

- fresh temporary output 必须包含唯一入口和 3 个 accepted primitive。
- 输出不得包含 `code-review`、`tdd`、Vibe 生成镜像或第二个项目 router。
- 重跑验证必须报告 source revision、include/exclude、文件数和退出码。
