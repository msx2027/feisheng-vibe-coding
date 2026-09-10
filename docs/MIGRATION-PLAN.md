# 迁移计划

## 阶段 0：冻结取证

- 记录三个源项目的路径、revision、工作树状态和清单摘要。
- 建立技能、调用类型、写入目标、依赖、许可证和 owner 账本。
- 对 Vibe 源码、镜像和 manifest 做一致性检查；目标为零 drift。
- 标记 Matt 的未提交改动，未经归类不得迁移。

当前证据：Vibe `MANIFEST.json` 有 1,341 条记录，其中 50 条 SHA-256 不匹配；quick strict health 有 97 项失败，其中 95 项为镜像漂移，routing manifest 过期；Matt 有 4 个未提交 Skill 修改。阶段 0 的结构取证已完成，内容迁移门禁仍为阻塞。

阶段 0 收口结果：Vibe 已形成 550 文件、逐文件 SHA-256 一致的正式快照；Matt 已形成绑定 HEAD `9fe7e7a3bb352851b986725bab1c7cfb17610a97` 的 132 文件快照，4 个未提交文件明确排除；82 个技能已在 `provenance/CANONICAL-CATALOG.json` 分类。截至 2026-09-10，候选运行包包含 Sliver control-plane、3 个 Matt 原语，以及首批 4 个 Vibe 只读检查器（`audit`、`critique`、`harden`、`optimize`）；当前可用集合的权威快照见 `docs/CAPABILITY-INDEX.md`。

## 阶段 1：控制面

- 固化 canonical route catalog、skill catalog、target truth schema 和 runtime projection schema。
- 生成单目标 Codex 最小运行包。
- 验证路由投影、allowlist、版本、来源 revision 和回滚点。

## 阶段 2：工程原语

优先接入 `tdd`、`diagnosing-bugs`、`codebase-design`、`domain-modeling` 和双轴 `code-review`。`to-spec`、`to-tickets`、`implement` 先作为适配器，不能创建第二份项目真源。

当前已接入：`diagnosing-bugs`、`codebase-design`、`domain-modeling`。`tdd` 与 `code-review` 的 `blocked-unclassified-working-tree` 已按 canonical 命名策略**解除**（该状态仍在策略里保留为 `checker|blocked` 的映射，但当前 0 条记录使用）：两者现为 `source-only-primitive` / `source-only-checker`，内容取自已提交 revision `9fe7e7a3` 的 blob（不采用上游工作树未提交改名），canonical id 由本仓库决定；解除阻塞后的剩余条件是**宿主行为 smoke**（可解除的完整依据见 `evidence/20260910-matt-canonical-naming.md`）。另有 7 条 `adapter-candidate`（`implement`、`to-spec`、`to-tickets`、`triage`、`wayfinder`、`setup-matt-pocock-skills`、`improve-codebase-architecture`）尚未接入。

## 阶段 3：宿主适配

先支持一个宿主，建议 Codex。由统一源码生成镜像和 Hook；Hook 没有 fresh-session 证据时保持 `UNVERIFIED`。Codex 通过后再接入 Claude。

## 阶段 4：产品、UI 和第三方包

逐组接入 Vibe 的产品/UI/checker 技能，保留每个来源组的许可证、NOTICE 和版本信息。UI 小技能先以 profile 组合，不直接物理合并。

## 阶段 5：灰度和退役

新入口与旧入口并行 smoke；只有 manifest、runtime、Hook、plugin、回滚和 fresh-session 证据全部通过，才退役旧入口。
