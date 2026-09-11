# Feisheng Vibe Coding 仓库规则

## Owner 规则

- `governance/` 是项目级决策控制面。
- `provenance/OWNER-LEDGER.json` 是 owner、投影和写入权限的机器可读记录。
- `provenance/SKILL-INVENTORY.json` 是三份源项目的事实快照，不是运行时决策真源。
- 技能分类决策的唯一写入点是 `provenance/SKILL-CLASSIFICATION.json`；`provenance/CANONICAL-CATALOG.json` 是由 `scripts/build-canonical-catalog.ps1` 从分类与清单生成的统一决策投影，只能再生、不得手工编辑。
- `provenance/SOURCE-INVENTORY.json` 是三个源项目的来源、快照与**归档终态**记录。
- 生成镜像不得手工修改；源文件、生成器和投影必须可区分。

## 迁移规则

- 三个源项目已于 **2026-09-11 完成快照与全量校验**（逐个经 CRC 与逐文件 sha256 全等校验），本地源目录删除；
  归档 zip 亦已由 owner 于 **2026-09-12 裁决删除**，不留冷存副本。**已删除的源项目不是工作对象**：
  不得从任何外部副本、缓存或备份解包回去当来源、不得在其上做迁移；
  仓库内 `sources/` 快照是唯一内容真源，也是来源唯一可对账副本（树摘要见 `provenance/PROVENANCE-INTEGRITY.json`）。
- 仓库内 `sources/` 快照（`sources/vibe-coding-skills`、`sources/mattpocock-skills`、`governance/sliver-core/`）
  是**唯一内容真源**，逐文件与聚合树摘要两级 sha256 在 `provenance/` 内自证（`verify.ps1` 步骤 1b/1c/1c-2 逐文件、步骤 3 树摘要强制）。所有导入脚本
  （`import-vibe-skills.ps1`、`import-matt-source.ps1`、`import-sliver-core.ps1`）只读这份快照，**永不删改**。
- 未通过来源、许可证、revision、调用类型和运行时门禁，不迁移技能内容。
- 不把 Vibe 的 `.claude/`、`.agents/`、`.codex/` 镜像当作源码。
- 不把任何第三方许可证归并为统一根许可证。
- 每次迁移只接入一个有界能力组，并运行对应 smoke 验证。

## 验收规则

- 路由、skill catalog、target truth 和 runtime projection 必须各有唯一 owner。
- 发现重复入口、重复写入者、manifest drift、来源不明或宿主证据缺失时停止迁移。
- 没有新鲜验证不得声明完成、可发布或宿主 Hook 已强制生效。
