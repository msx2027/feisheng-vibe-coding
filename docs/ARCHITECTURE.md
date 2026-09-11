# 统一架构

## 目标

让用户只接触一个项目级入口，同时保留三个源项目中可复用的能力和各自必要的分发边界。

## 四个唯一 Owner

### route-catalog

拥有主路由、operation、条件 lens 和 reference 加载映射。路由真源是双文件两层：`governance/sliver-core/references/routes-index.md` 拥有映射语义（主路由/operation/lens/reference 加载）；技能级绑定 owner 由 `provenance/SKILL-CLASSIFICATION.json` 的 routeBinding 指认，`scripts/validate-route-bindings.ps1` 强制 admitted 技能在绑定 owner 中唯一命中。`provenance/CANONICAL-CATALOG.json` 是再生投影，不是路由真源。

### skill-catalog

拥有技能的 canonical id、来源、调用类型、触发边界、输出形态和依赖。技能分类决策的唯一写入点是 `provenance/SKILL-CLASSIFICATION.json`；`provenance/SKILL-INVENTORY.json` 只记录三份来源的原始事实；`provenance/SKILL-DECISIONS.md` 记录人工语义判断；`provenance/CANONICAL-CATALOG.json` 是由 `scripts/build-canonical-catalog.ps1` 从分类生成的统一决策投影，只能再生、不得手工编辑（2026-09-11 与 AGENTS.md 对齐）。README、plugin manifest 和宿主清单只能由它生成或校验。

### target-truth

拥有目标项目的需求、计划、术语、任务状态、接受证据和写入权限。`.vibe-docs.json`、issue tracker 和其他文档索引只能作为适配器或投影，不能形成并列 authority。本仓库内 target-truth 只持有 schema 契约（`docs/target-truth-schema.json`），真源数据属目标项目本身。

### runtime-projection

拥有从源码和 catalog 生成 Codex、Claude 等宿主运行包的规则。宿主镜像、Hook 配置和 plugin manifest 必须注明来源 revision，并能重建。

## 分层

```text
项目治理控制面
  ├─ Sliver：路由、深度、风险、授权、测试、真源、验收
  ├─ 工程原语：Matt 的 TDD、调试、领域建模、模块设计、review
  ├─ 产品/UI/事件：Vibe 的需求、设计、UI、文档、事件沉淀和专项 checker
  └─ 宿主适配：Codex、Claude、插件、Hook、镜像和发布清单
```

内部能力只能通过清晰 interface 返回结果或 finding，不得成为第二个项目级路由器。

## 不可物理合并的边界

- Sliver runtime allowlist 与 Vibe source-to-mirror 生成链不是同一合同。
- Vibe Hooks 与 Sliver continuity 必须经过事件分发器、命名空间、顺序和幂等规则。
- Matt plugin、中文翻译同步和 `agents/openai.yaml` 需要独立 provenance。
- Apache-2.0、MIT、OFL 和 NOTICE 必须按来源目录保留。
