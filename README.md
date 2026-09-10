# Feisheng Vibe Coding

统一的软件项目 AI 协作运行包。

本仓库只提供一个项目级公开入口：`feisheng-vibe-coding`。内部能力按职责拆分为治理内核、工程原语、产品/UI 技能和宿主适配器。源项目的镜像、插件清单和第三方素材不直接当作本仓库的真源。

## 当前状态

当前处于阶段 0：冻结取证与骨架建立。三个源项目尚未迁移，源目录不会被本仓库修改。基线已确认 Vibe 存在 manifest/mirror 漂移，Matt 存在未提交修改，因此内容迁移门禁暂为阻塞。

迁移前必须通过 `provenance/` 中的来源、调用类型、许可证、owner 和运行时清单门禁。

## 唯一 Owner

- `route-catalog`：项目级主路由、operation、lens 和 reference 映射。
- `skill-catalog`：技能名称、调用类型、触发边界和能力元数据。
- `target-truth`：目标项目的需求、计划、术语、任务状态和验收真源。
- `runtime-projection`：面向 Codex、Claude 等宿主生成的运行时镜像和安装清单。

下游 README、插件清单、镜像和生成 JSON 都只能是投影，不能反向成为 owner。

## 设计原则

1. 一个公开入口，一个主路由。
2. 规则只有一个 owner，其他位置只引用或生成投影。
3. Sliver 管项目级决策和门禁；Matt 管工程原语；Vibe 管产品/UI 和宿主适配。
4. 先证明来源、许可证、revision 和可重建性，再迁移行为。
5. 宿主 Hook 没有 fresh-session 证据时，只报告 `UNVERIFIED`。

## 目录

见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)、[`docs/MIGRATION-PLAN.md`](docs/MIGRATION-PLAN.md)、[`provenance/SOURCE-BASELINE.json`](provenance/SOURCE-BASELINE.json) 和 [`provenance/OWNER-LEDGER.json`](provenance/OWNER-LEDGER.json)。
