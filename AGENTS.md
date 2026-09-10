# Feisheng Vibe Coding 仓库规则

## Owner 规则

- `governance/` 是项目级决策控制面。
- `provenance/OWNER-LEDGER.json` 是 owner、投影和写入权限的机器可读记录。
- `provenance/SKILL-INVENTORY.json` 是三份源项目的事实快照，不是运行时决策真源。
- 技能分类决策的唯一写入点是 `provenance/SKILL-CLASSIFICATION.json`；`provenance/CANONICAL-CATALOG.json` 是由 `scripts/build-canonical-catalog.ps1` 从分类与清单生成的统一决策投影，只能再生、不得手工编辑。
- `provenance/SOURCE-INVENTORY.json` 是三个源项目的来源和迁移状态记录。
- 生成镜像不得手工修改；源文件、生成器和投影必须可区分。

## 迁移规则

- 不修改 `F:\skiils工具\sliver-vibe-coding`、`F:\skiils工具\vibe-coding-skills` 或 `F:\skiils工具\mattpocock-skills`。
- 未通过来源、许可证、revision、调用类型和运行时门禁，不迁移技能内容。
- 不把 Vibe 的 `.claude/`、`.agents/`、`.codex/` 镜像当作源码。
- 不把任何第三方许可证归并为统一根许可证。
- 每次迁移只接入一个有界能力组，并运行对应 smoke 验证。

## 验收规则

- 路由、skill catalog、target truth 和 runtime projection 必须各有唯一 owner。
- 发现重复入口、重复写入者、manifest drift、来源不明或宿主证据缺失时停止迁移。
- 没有新鲜验证不得声明完成、可发布或宿主 Hook 已强制生效。
