# Feisheng Vibe Coding

统一的软件项目 AI 协作运行包。

本仓库只提供一个项目级公开入口：`feisheng-vibe-coding`。内部能力按职责拆分为治理内核、工程原语、产品/UI 技能和宿主适配器。源项目的镜像、插件清单和第三方素材不直接当作本仓库的真源。

## 当前状态

处于闭环后受控运行阶段（2026-09-11）：三个源项目已归档冷存并删除本体，仓库内 `sources/` 快照为**唯一内容真源**。82 个技能已全量登记并完成能力定编：**52 条进入 runtime**（Sliver 控制面 + 13 个 Matt 条目 + 38 个 Vibe 能力），runtime bundle 共 **420 文件**；**23 条正式退役**（快照保留、可重走准入），7 条排除/兼容不在迁移面。纯中文自然语言触发（D2）与全链路路由（D3）已在真实宿主会话实测转绿；Vibe Hook 适配器已按契约 v2 解锁**纠错信号采集**两事件（SessionStart 只读提醒 / UserPromptSubmit 纠错采集 + Digest 消化标记）。**GitHub Actions CI 已全绿**（`ubuntu-latest`，verify.ps1 静态门禁 + 发布候选包装配；门禁步数随演进更新，口径见 docs/HANDOFF-NEXT.md）。

仍保持 `UNVERIFIED` 的：宿主 trust、逐技能行为质量（用一次验一次）、Hook 的宿主 fresh-session 冒烟（无仓库内留痕物）、沉淀消费技能（三件套）的接入。

迁移前必须通过 `provenance/` 中的来源、调用类型、许可证、owner 和运行时清单门禁；决策唯一写入点是 `provenance/SKILL-CLASSIFICATION.json`，`CANONICAL-CATALOG.json` 只能再生。

## 唯一 Owner

- `route-catalog`：项目级主路由、operation、lens 和 reference 映射。
- `skill-catalog`：技能名称、调用类型、触发边界和能力元数据。
- `target-truth`：目标项目的需求、计划、术语、任务状态和验收真源。
- `runtime-projection`：面向 Codex、Claude 等宿主生成的运行时镜像和安装清单。

下游 README、插件清单、镜像和生成 JSON 都只能是投影，不能反向成为 owner。

以上是四个核心 owner；`provenance/OWNER-LEDGER.json` 另登记 9 个仲裁/登记类 owner（local-patch-registry、host-evidence、validation-gate、bug-rescue、ui-quality、context-handoff、doc-authoring、architecture、git-release）。target-truth 在本仓库内只持有 schema 契约（`docs/target-truth-schema.json`），真源数据属目标项目。

## 设计原则

1. 一个公开入口，一个主路由。
2. 规则只有一个 owner，其他位置只引用或生成投影。
3. Sliver 管项目级决策和门禁；Matt 管工程原语；Vibe 管产品/UI 和宿主适配。
4. 先证明来源、许可证、revision 和可重建性，再迁移行为。
5. 宿主 Hook 没有 fresh-session 证据时，只报告 `UNVERIFIED`。

## 文档治理工具（新项目接入）

`scripts/check-doc-governance.mjs` 是面向任意目标项目的文档命名/归位治理检查器（零依赖 Node，可移植）：门面 H1 与文件名同步、docs 空目录残留、类目目录散落 md、全项目正文重名、门面导航双向登记、孤儿卷目录；并从 frontmatter（`status: completed|resolved|deprecated`）自动检测归档候选，归档经人确认后由 `--archive` 一键执行（git mv + 引用改链 + 归档门面登记；有未提交改动时拒绝执行）。

新项目开箱接入：

```sh
node scripts/init-doc-governance.mjs <目标项目根>
```

接入器只新增/追加，不覆盖既有内容：复制检查器与测试到 `<项目>/tools/`、生成默认 `tools/doc-governance.json`（豁免清单由项目拍板）、在 pre-commit 末尾追加接线块（已接线则跳过）。归档语义为「检测全自动 + 执行一键确认」：机器判据只是候选，是否使命完结仍由人确认。

## 目录

见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)、[`docs/archive/MIGRATION-PLAN.md`](docs/archive/MIGRATION-PLAN.md)（历史基线）、[`provenance/SOURCE-BASELINE.json`](provenance/SOURCE-BASELINE.json) 和 [`provenance/OWNER-LEDGER.json`](provenance/OWNER-LEDGER.json)。
